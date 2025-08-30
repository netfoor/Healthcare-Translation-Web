import { PollyTTSHandler } from '../index';
import { PollyTTSService } from '../polly-tts-service';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

// Mock dependencies
jest.mock('../polly-tts-service');
jest.mock('@aws-sdk/client-apigatewaymanagementapi');
jest.mock('@aws-sdk/lib-dynamodb');
jest.mock('@aws-sdk/client-dynamodb');

const mockTTSService = {
    synthesizeSpeech: jest.fn(),
    generateSSML: jest.fn()
};

const mockApiGatewayClient = {
    send: jest.fn()
};

const mockDynamoClient = {
    send: jest.fn()
};

(PollyTTSService as jest.MockedClass<typeof PollyTTSService>).mockImplementation(() => mockTTSService as any);
(ApiGatewayManagementApiClient as jest.Mock).mockImplementation(() => mockApiGatewayClient);
(DynamoDBDocumentClient.from as jest.Mock).mockReturnValue(mockDynamoClient);

describe('PollyTTSHandler', () => {
    let handler: PollyTTSHandler;

    const mockWebSocketEvent = {
        requestContext: {
            connectionId: 'test-connection-id',
            domainName: 'test-domain.com',
            stage: 'prod'
        },
        body: JSON.stringify({
            action: 'synthesizeSpeech',
            sessionId: 'test-session-id',
            text: 'Hello, this is a test message.',
            language: 'en-US'
        })
    };

    beforeEach(() => {
        jest.clearAllMocks();
        handler = new PollyTTSHandler();
        
        // Set environment variables
        process.env.CONNECTIONS_TABLE = 'test-connections-table';
        process.env.SESSIONS_TABLE = 'test-sessions-table';
    });

    describe('handleWebSocketEvent', () => {
        it('should handle synthesizeSpeech request successfully', async () => {
            const mockTTSResult = {
                audioUrl: 's3://bucket/audio.mp3',
                audioData: new Uint8Array([1, 2, 3, 4]),
                voiceId: 'Joanna',
                language: 'en-US',
                format: 'mp3',
                cached: false
            };

            mockTTSService.synthesizeSpeech.mockResolvedValue(mockTTSResult);
            mockApiGatewayClient.send.mockResolvedValue({});
            mockDynamoClient.send.mockResolvedValue({});

            const result = await handler.handleWebSocketEvent(mockWebSocketEvent);

            expect(result.statusCode).toBe(200);
            expect(mockTTSService.synthesizeSpeech).toHaveBeenCalledWith({
                text: 'Hello, this is a test message.',
                language: 'en-US',
                voiceId: undefined,
                useSSML: false,
                cacheKey: undefined
            });

            expect(mockApiGatewayClient.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    input: expect.objectContaining({
                        ConnectionId: 'test-connection-id',
                        Data: expect.stringContaining('"action":"speechSynthesized"')
                    })
                })
            );
        });

        it('should handle generateSSML request successfully', async () => {
            const ssmlEvent = {
                ...mockWebSocketEvent,
                body: JSON.stringify({
                    action: 'generateSSML',
                    sessionId: 'test-session-id',
                    text: 'Take your medication immediately.',
                    language: 'en-US'
                })
            };

            const mockSSML = '<speak><prosody rate="medium">Take your <emphasis level="moderate">medication</emphasis> <emphasis level="moderate">immediately</emphasis>.</prosody></speak>';
            
            mockTTSService.generateSSML.mockReturnValue(mockSSML);
            mockApiGatewayClient.send.mockResolvedValue({});

            const result = await handler.handleWebSocketEvent(ssmlEvent);

            expect(result.statusCode).toBe(200);
            expect(mockTTSService.generateSSML).toHaveBeenCalledWith('Take your medication immediately.', 'en-US');

            expect(mockApiGatewayClient.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    input: expect.objectContaining({
                        ConnectionId: 'test-connection-id',
                        Data: expect.stringContaining('"action":"ssmlGenerated"')
                    })
                })
            );
        });

        it('should handle cached audio results', async () => {
            const cachedEvent = {
                ...mockWebSocketEvent,
                body: JSON.stringify({
                    action: 'synthesizeSpeech',
                    sessionId: 'test-session-id',
                    text: 'Cached message',
                    language: 'en-US',
                    enableCaching: true
                })
            };

            // Mock cached result
            mockDynamoClient.send.mockResolvedValueOnce({
                Item: {
                    audioUrl: 's3://bucket/cached-audio.mp3',
                    voiceId: 'Joanna',
                    language: 'en-US',
                    format: 'mp3',
                    ttl: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
                }
            });

            mockApiGatewayClient.send.mockResolvedValue({});

            const result = await handler.handleWebSocketEvent(cachedEvent);

            expect(result.statusCode).toBe(200);
            expect(mockTTSService.synthesizeSpeech).not.toHaveBeenCalled();

            expect(mockApiGatewayClient.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    input: expect.objectContaining({
                        Data: expect.stringContaining('"cached":true')
                    })
                })
            );
        });

        it('should handle expired cached results', async () => {
            const cachedEvent = {
                ...mockWebSocketEvent,
                body: JSON.stringify({
                    action: 'synthesizeSpeech',
                    sessionId: 'test-session-id',
                    text: 'Expired cached message',
                    language: 'en-US',
                    enableCaching: true
                })
            };

            // Mock expired cached result
            mockDynamoClient.send.mockResolvedValueOnce({
                Item: {
                    audioUrl: 's3://bucket/expired-audio.mp3',
                    voiceId: 'Joanna',
                    language: 'en-US',
                    format: 'mp3',
                    ttl: Math.floor(Date.now() / 1000) - 3600 // 1 hour ago (expired)
                }
            });

            const mockTTSResult = {
                audioUrl: 's3://bucket/new-audio.mp3',
                audioData: new Uint8Array([1, 2, 3, 4]),
                voiceId: 'Joanna',
                language: 'en-US',
                format: 'mp3',
                cached: false
            };

            mockTTSService.synthesizeSpeech.mockResolvedValue(mockTTSResult);
            mockApiGatewayClient.send.mockResolvedValue({});

            const result = await handler.handleWebSocketEvent(cachedEvent);

            expect(result.statusCode).toBe(200);
            expect(mockTTSService.synthesizeSpeech).toHaveBeenCalled();
        });

        it('should validate request format', async () => {
            const invalidEvent = {
                ...mockWebSocketEvent,
                body: JSON.stringify({
                    action: 'synthesizeSpeech',
                    sessionId: 'test-session-id',
                    // Missing required 'text' field
                    language: 'en-US'
                })
            };

            mockApiGatewayClient.send.mockResolvedValue({});

            const result = await handler.handleWebSocketEvent(invalidEvent);

            expect(result.statusCode).toBe(400);
            expect(mockApiGatewayClient.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    input: expect.objectContaining({
                        Data: expect.stringContaining('"error":"Invalid TTS request format"')
                    })
                })
            );
        });

        it('should handle unknown actions', async () => {
            const unknownActionEvent = {
                ...mockWebSocketEvent,
                body: JSON.stringify({
                    action: 'unknownAction',
                    sessionId: 'test-session-id',
                    text: 'Test message',
                    language: 'en-US'
                })
            };

            mockApiGatewayClient.send.mockResolvedValue({});

            const result = await handler.handleWebSocketEvent(unknownActionEvent);

            expect(result.statusCode).toBe(400);
            expect(mockApiGatewayClient.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    input: expect.objectContaining({
                        Data: expect.stringContaining('"error":"Unknown action: unknownAction"')
                    })
                })
            );
        });

        it('should handle TTS service errors', async () => {
            mockTTSService.synthesizeSpeech.mockRejectedValue(new Error('Polly service unavailable'));
            mockApiGatewayClient.send.mockResolvedValue({});

            const result = await handler.handleWebSocketEvent(mockWebSocketEvent);

            expect(result.statusCode).toBe(200); // Handler doesn't fail, but sends error response
            expect(mockApiGatewayClient.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    input: expect.objectContaining({
                        Data: expect.stringContaining('"error":"Speech synthesis failed: Polly service unavailable"')
                    })
                })
            );
        });

        it('should handle malformed JSON in request body', async () => {
            const malformedEvent = {
                ...mockWebSocketEvent,
                body: 'invalid json'
            };

            const result = await handler.handleWebSocketEvent(malformedEvent);

            expect(result.statusCode).toBe(500);
        });

        it('should update session activity after successful synthesis', async () => {
            const mockTTSResult = {
                audioUrl: 's3://bucket/audio.mp3',
                audioData: new Uint8Array([1, 2, 3, 4]),
                voiceId: 'Joanna',
                language: 'en-US',
                format: 'mp3',
                cached: false
            };

            mockTTSService.synthesizeSpeech.mockResolvedValue(mockTTSResult);
            mockApiGatewayClient.send.mockResolvedValue({});
            mockDynamoClient.send.mockResolvedValue({});

            await handler.handleWebSocketEvent(mockWebSocketEvent);

            expect(mockDynamoClient.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    input: expect.objectContaining({
                        TableName: 'test-sessions-table',
                        Key: { sessionId: 'test-session-id' },
                        UpdateExpression: 'SET lastActivity = :lastActivity, #activity = :activityValue',
                        ExpressionAttributeValues: expect.objectContaining({
                            ':activityValue': 'tts_synthesis'
                        })
                    })
                })
            );
        });

        it('should cache audio results when caching is enabled', async () => {
            const cachingEvent = {
                ...mockWebSocketEvent,
                body: JSON.stringify({
                    action: 'synthesizeSpeech',
                    sessionId: 'test-session-id',
                    text: 'Message to cache',
                    language: 'en-US',
                    enableCaching: true
                })
            };

            // Mock no cached result initially
            mockDynamoClient.send.mockResolvedValueOnce({ Item: null });

            const mockTTSResult = {
                audioUrl: 's3://bucket/audio.mp3',
                audioData: new Uint8Array([1, 2, 3, 4]),
                voiceId: 'Joanna',
                language: 'en-US',
                format: 'mp3',
                cached: false
            };

            mockTTSService.synthesizeSpeech.mockResolvedValue(mockTTSResult);
            mockApiGatewayClient.send.mockResolvedValue({});
            mockDynamoClient.send.mockResolvedValue({});

            await handler.handleWebSocketEvent(cachingEvent);

            // Should call DynamoDB to cache the result
            expect(mockDynamoClient.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    input: expect.objectContaining({
                        TableName: 'healthcare-translation-cache',
                        UpdateExpression: expect.stringContaining('SET audioUrl = :audioUrl')
                    })
                })
            );
        });
    });

    describe('request validation', () => {
        it('should reject requests with empty text', async () => {
            const emptyTextEvent = {
                ...mockWebSocketEvent,
                body: JSON.stringify({
                    action: 'synthesizeSpeech',
                    sessionId: 'test-session-id',
                    text: '   ', // Only whitespace
                    language: 'en-US'
                })
            };

            mockApiGatewayClient.send.mockResolvedValue({});

            const result = await handler.handleWebSocketEvent(emptyTextEvent);

            expect(result.statusCode).toBe(400);
        });

        it('should reject requests with missing sessionId', async () => {
            const noSessionEvent = {
                ...mockWebSocketEvent,
                body: JSON.stringify({
                    action: 'synthesizeSpeech',
                    text: 'Test message',
                    language: 'en-US'
                })
            };

            mockApiGatewayClient.send.mockResolvedValue({});

            const result = await handler.handleWebSocketEvent(noSessionEvent);

            expect(result.statusCode).toBe(400);
        });

        it('should reject requests with non-string text', async () => {
            const invalidTextEvent = {
                ...mockWebSocketEvent,
                body: JSON.stringify({
                    action: 'synthesizeSpeech',
                    sessionId: 'test-session-id',
                    text: 123, // Number instead of string
                    language: 'en-US'
                })
            };

            mockApiGatewayClient.send.mockResolvedValue({});

            const result = await handler.handleWebSocketEvent(invalidTextEvent);

            expect(result.statusCode).toBe(400);
        });
    });
});