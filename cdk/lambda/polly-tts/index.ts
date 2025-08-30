import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { PollyTTSService, TTSRequest, TTSResult } from './polly-tts-service';

interface WebSocketEvent {
    requestContext: {
        connectionId: string;
        domainName: string;
        stage: string;
    };
    body: string;
}

interface TTSWebSocketRequest {
    action: string;
    sessionId: string;
    text: string;
    language: string;
    voiceId?: string;
    useSSML?: boolean;
    enableCaching?: boolean;
}

interface TTSResponse {
    action: string;
    sessionId: string;
    success: boolean;
    audioUrl?: string;
    audioData?: string; // Base64 encoded for WebSocket transmission
    voiceId?: string;
    language?: string;
    format?: string;
    cached?: boolean;
    error?: string;
    timestamp: string;
}

class PollyTTSHandler {
    private ttsService: PollyTTSService;
    private dynamoClient: DynamoDBDocumentClient;
    private apiGatewayClient: ApiGatewayManagementApiClient | null = null;
    private connectionsTable: string;
    private sessionsTable: string;

    constructor() {
        this.ttsService = new PollyTTSService();
        const dynamoDBClient = new DynamoDBClient({});
        this.dynamoClient = DynamoDBDocumentClient.from(dynamoDBClient);
        this.connectionsTable = process.env.CONNECTIONS_TABLE || '';
        this.sessionsTable = process.env.SESSIONS_TABLE || '';
    }

    /**
     * Initialize API Gateway Management API client
     */
    private initializeApiGatewayClient(event: WebSocketEvent): void {
        if (!this.apiGatewayClient) {
            const endpoint = `https://${event.requestContext.domainName}/${event.requestContext.stage}`;
            this.apiGatewayClient = new ApiGatewayManagementApiClient({
                endpoint
            });
        }
    }

    /**
     * Main Lambda handler for WebSocket events
     */
    async handleWebSocketEvent(event: WebSocketEvent): Promise<APIGatewayProxyResult> {
        console.log('Received WebSocket event:', JSON.stringify(event, null, 2));

        try {
            this.initializeApiGatewayClient(event);
            
            const request: TTSWebSocketRequest = JSON.parse(event.body);
            const connectionId = event.requestContext.connectionId;

            // Validate request
            if (!this.validateTTSRequest(request)) {
                await this.sendErrorResponse(connectionId, request.sessionId, 'Invalid TTS request format');
                return { statusCode: 400, body: 'Invalid request' };
            }

            // Process TTS request based on action
            switch (request.action) {
                case 'synthesizeSpeech':
                    await this.handleSynthesizeSpeech(connectionId, request);
                    break;
                case 'generateSSML':
                    await this.handleGenerateSSML(connectionId, request);
                    break;
                default:
                    await this.sendErrorResponse(connectionId, request.sessionId, `Unknown action: ${request.action}`);
                    return { statusCode: 400, body: 'Unknown action' };
            }

            return { statusCode: 200, body: 'Success' };

        } catch (error) {
            console.error('Error processing TTS request:', error);
            
            try {
                const request = JSON.parse(event.body);
                await this.sendErrorResponse(
                    event.requestContext.connectionId,
                    request.sessionId || 'unknown',
                    error instanceof Error ? error.message : 'Unknown error'
                );
            } catch (parseError) {
                console.error('Error parsing request for error response:', parseError);
            }

            return { statusCode: 500, body: 'Internal server error' };
        }
    }

    /**
     * Handle speech synthesis request
     */
    private async handleSynthesizeSpeech(connectionId: string, request: TTSWebSocketRequest): Promise<void> {
        try {
            // Generate cache key if caching is enabled
            const cacheKey = request.enableCaching 
                ? PollyTTSService.generateCacheKey(request.text, request.language, request.voiceId)
                : undefined;

            // Check cache first if enabled
            if (cacheKey && request.enableCaching) {
                const cachedResult = await this.getCachedAudio(cacheKey);
                if (cachedResult) {
                    await this.sendTTSResponse(connectionId, {
                        action: 'speechSynthesized',
                        sessionId: request.sessionId,
                        success: true,
                        audioUrl: cachedResult.audioUrl,
                        voiceId: cachedResult.voiceId,
                        language: cachedResult.language,
                        format: cachedResult.format,
                        cached: true,
                        timestamp: new Date().toISOString()
                    });
                    return;
                }
            }

            // Synthesize speech using Polly
            const ttsRequest: TTSRequest = {
                text: request.text,
                language: request.language,
                voiceId: request.voiceId,
                useSSML: request.useSSML || false,
                cacheKey
            };

            const result = await this.ttsService.synthesizeSpeech(ttsRequest);

            // Cache the result if caching is enabled
            if (cacheKey && request.enableCaching) {
                await this.cacheAudioResult(cacheKey, result);
            }

            // Send response with audio data
            const response: TTSResponse = {
                action: 'speechSynthesized',
                sessionId: request.sessionId,
                success: true,
                audioUrl: result.audioUrl,
                audioData: result.audioData ? Buffer.from(result.audioData).toString('base64') : undefined,
                voiceId: result.voiceId,
                language: result.language,
                format: result.format,
                cached: result.cached,
                timestamp: new Date().toISOString()
            };

            await this.sendTTSResponse(connectionId, response);

            // Update session with TTS activity
            await this.updateSessionActivity(request.sessionId, 'tts_synthesis');

        } catch (error) {
            console.error('Error in speech synthesis:', error);
            await this.sendErrorResponse(
                connectionId,
                request.sessionId,
                `Speech synthesis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    /**
     * Handle SSML generation request
     */
    private async handleGenerateSSML(connectionId: string, request: TTSWebSocketRequest): Promise<void> {
        try {
            const ssml = this.ttsService.generateSSML(request.text, request.language);

            const response: TTSResponse = {
                action: 'ssmlGenerated',
                sessionId: request.sessionId,
                success: true,
                audioData: ssml, // Return SSML as text
                language: request.language,
                timestamp: new Date().toISOString()
            };

            await this.sendTTSResponse(connectionId, response);

        } catch (error) {
            console.error('Error generating SSML:', error);
            await this.sendErrorResponse(
                connectionId,
                request.sessionId,
                `SSML generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    /**
     * Validate TTS request format
     */
    private validateTTSRequest(request: TTSWebSocketRequest): boolean {
        return !!(
            request.action &&
            request.sessionId &&
            request.text &&
            request.language &&
            typeof request.text === 'string' &&
            typeof request.language === 'string' &&
            request.text.trim().length > 0
        );
    }

    /**
     * Send TTS response to WebSocket client
     */
    private async sendTTSResponse(connectionId: string, response: TTSResponse): Promise<void> {
        if (!this.apiGatewayClient) {
            throw new Error('API Gateway client not initialized');
        }

        const command = new PostToConnectionCommand({
            ConnectionId: connectionId,
            Data: JSON.stringify(response)
        });

        try {
            await this.apiGatewayClient.send(command);
            console.log('TTS response sent successfully:', response.action);
        } catch (error) {
            console.error('Error sending TTS response:', error);
            throw error;
        }
    }

    /**
     * Send error response to WebSocket client
     */
    private async sendErrorResponse(connectionId: string, sessionId: string, errorMessage: string): Promise<void> {
        const errorResponse: TTSResponse = {
            action: 'ttsError',
            sessionId,
            success: false,
            error: errorMessage,
            timestamp: new Date().toISOString()
        };

        try {
            await this.sendTTSResponse(connectionId, errorResponse);
        } catch (error) {
            console.error('Error sending error response:', error);
        }
    }

    /**
     * Get cached audio result from DynamoDB
     */
    private async getCachedAudio(cacheKey: string): Promise<TTSResult | null> {
        try {
            const command = new GetCommand({
                TableName: 'healthcare-translation-cache',
                Key: {
                    translationKey: `tts-${cacheKey}`
                }
            });

            const result = await this.dynamoClient.send(command);
            
            if (result.Item && result.Item.ttl > Math.floor(Date.now() / 1000)) {
                return {
                    audioUrl: result.Item.audioUrl,
                    voiceId: result.Item.voiceId,
                    language: result.Item.language,
                    format: result.Item.format,
                    cached: true
                };
            }

            return null;
        } catch (error) {
            console.error('Error getting cached audio:', error);
            return null;
        }
    }

    /**
     * Cache audio result in DynamoDB
     */
    private async cacheAudioResult(cacheKey: string, result: TTSResult): Promise<void> {
        try {
            const ttl = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 24 hours

            const command = new UpdateCommand({
                TableName: 'healthcare-translation-cache',
                Key: {
                    translationKey: `tts-${cacheKey}`
                },
                UpdateExpression: 'SET audioUrl = :audioUrl, voiceId = :voiceId, #lang = :language, #format = :format, ttl = :ttl, updatedAt = :updatedAt',
                ExpressionAttributeNames: {
                    '#lang': 'language',
                    '#format': 'format'
                },
                ExpressionAttributeValues: {
                    ':audioUrl': result.audioUrl,
                    ':voiceId': result.voiceId,
                    ':language': result.language,
                    ':format': result.format,
                    ':ttl': ttl,
                    ':updatedAt': new Date().toISOString()
                }
            });

            await this.dynamoClient.send(command);
            console.log('Audio result cached successfully');
        } catch (error) {
            console.error('Error caching audio result:', error);
            // Don't throw error - caching failure shouldn't break the main flow
        }
    }

    /**
     * Update session activity in DynamoDB
     */
    private async updateSessionActivity(sessionId: string, activity: string): Promise<void> {
        try {
            const command = new UpdateCommand({
                TableName: this.sessionsTable,
                Key: { sessionId },
                UpdateExpression: 'SET lastActivity = :lastActivity, #activity = :activityValue',
                ExpressionAttributeNames: {
                    '#activity': 'activity'
                },
                ExpressionAttributeValues: {
                    ':lastActivity': new Date().toISOString(),
                    ':activityValue': activity
                }
            });

            await this.dynamoClient.send(command);
        } catch (error) {
            console.error('Error updating session activity:', error);
            // Don't throw error - session update failure shouldn't break the main flow
        }
    }
}

// Export the main Lambda handler
export const handler = async (event: APIGatewayProxyEvent, _context: Context): Promise<APIGatewayProxyResult> => {
    const ttsHandler = new PollyTTSHandler();
    return ttsHandler.handleWebSocketEvent(event as unknown as WebSocketEvent);
};

// Export for testing
export { PollyTTSHandler };