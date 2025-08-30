import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { TranslateClient, TranslateTextCommand } from '@aws-sdk/client-translate';
import { DynamoDBClient, PutItemCommand, GetItemCommand, QueryCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';

// Initialize AWS clients
const translateClient = new TranslateClient({ region: process.env.AWS_REGION });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION });

// Types for translation service
interface TranslationRequest {
    action: string;
    sessionId: string;
    text: string;
    sourceLanguage: string;
    targetLanguage: string;
    medicalContext?: MedicalContext;
    useCache?: boolean;
}

interface MedicalContext {
    specialty?: string;
    commonTerms: string[];
    previousContext: string[];
    urgencyLevel: 'low' | 'medium' | 'high';
}

interface TranslationResult {
    originalText: string;
    translatedText: string;
    sourceLanguage: string;
    targetLanguage: string;
    confidence: number;
    medicalTermsDetected: string[];
    cached: boolean;
    timestamp: string;
}

interface CachedTranslation {
    translationKey: string;
    translatedText: string;
    confidence: number;
    medicalTermsDetected: string[];
    createdAt: string;
    accessCount: number;
}

// Cache key generation for medical phrases
function generateCacheKey(text: string, sourceLanguage: string, targetLanguage: string): string {
    const normalizedText = text.toLowerCase().trim().replace(/\s+/g, ' ');
    return `${sourceLanguage}-${targetLanguage}-${Buffer.from(normalizedText).toString('base64')}`;
}

// Check translation cache in DynamoDB
async function checkTranslationCache(
    text: string,
    sourceLanguage: string,
    targetLanguage: string
): Promise<CachedTranslation | null> {
    try {
        const cacheKey = generateCacheKey(text, sourceLanguage, targetLanguage);
        
        const command = new GetItemCommand({
            TableName: process.env.TRANSLATION_CACHE_TABLE || 'healthcare-translation-cache',
            Key: {
                translationKey: { S: cacheKey }
            }
        });

        const result = await dynamoClient.send(command);
        
        if (result.Item) {
            // Update access count
            await updateCacheAccessCount(cacheKey);
            
            return {
                translationKey: cacheKey,
                translatedText: result.Item.translatedText.S!,
                confidence: parseFloat(result.Item.confidence.N!),
                medicalTermsDetected: result.Item.medicalTermsDetected?.SS || [],
                createdAt: result.Item.createdAt.S!,
                accessCount: parseInt(result.Item.accessCount.N!) + 1
            };
        }
        
        return null;
    } catch (error) {
        console.error('Error checking translation cache:', error);
        return null;
    }
}

// Update cache access count
async function updateCacheAccessCount(cacheKey: string): Promise<void> {
    try {
        const command = new UpdateItemCommand({
            TableName: process.env.TRANSLATION_CACHE_TABLE || 'healthcare-translation-cache',
            Key: {
                translationKey: { S: cacheKey }
            },
            UpdateExpression: 'ADD accessCount :inc SET lastAccessed = :timestamp',
            ExpressionAttributeValues: {
                ':inc': { N: '1' },
                ':timestamp': { S: new Date().toISOString() }
            }
        });

        await dynamoClient.send(command);
    } catch (error) {
        console.error('Error updating cache access count:', error);
    }
}

// Store translation in cache
async function storeTranslationCache(
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
    translatedText: string,
    confidence: number,
    medicalTermsDetected: string[]
): Promise<void> {
    try {
        const cacheKey = generateCacheKey(text, sourceLanguage, targetLanguage);
        const timestamp = new Date().toISOString();
        
        const command = new PutItemCommand({
            TableName: process.env.TRANSLATION_CACHE_TABLE || 'healthcare-translation-cache',
            Item: {
                translationKey: { S: cacheKey },
                originalText: { S: text },
                translatedText: { S: translatedText },
                sourceLanguage: { S: sourceLanguage },
                targetLanguage: { S: targetLanguage },
                confidence: { N: confidence.toString() },
                medicalTermsDetected: { SS: medicalTermsDetected },
                createdAt: { S: timestamp },
                lastAccessed: { S: timestamp },
                accessCount: { N: '1' },
                ttl: { N: Math.floor(Date.now() / 1000 + 7 * 24 * 60 * 60).toString() } // 7 days TTL
            }
        });

        await dynamoClient.send(command);
    } catch (error) {
        console.error('Error storing translation cache:', error);
    }
}

// Detect medical terms in text using Bedrock
async function detectMedicalTerms(text: string): Promise<string[]> {
    try {
        const prompt = `Analyze the following text and identify medical terms, conditions, procedures, medications, and anatomical references. Return only a JSON array of the medical terms found, without any additional text or explanation.

Text: "${text}"

Response format: ["term1", "term2", "term3"]`;

        const command = new InvokeModelCommand({
            modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
            contentType: 'application/json',
            body: JSON.stringify({
                anthropic_version: 'bedrock-2023-05-31',
                max_tokens: 1000,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            })
        });

        const response = await bedrockClient.send(command);
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        
        try {
            const medicalTerms = JSON.parse(responseBody.content[0].text);
            return Array.isArray(medicalTerms) ? medicalTerms : [];
        } catch {
            return [];
        }
    } catch (error) {
        console.error('Error detecting medical terms:', error);
        return [];
    }
}

// Core translation using Amazon Translate
async function translateWithAmazonTranslate(
    text: string,
    sourceLanguage: string,
    targetLanguage: string
): Promise<{ translatedText: string; confidence: number }> {
    try {
        const command = new TranslateTextCommand({
            Text: text,
            SourceLanguageCode: sourceLanguage,
            TargetLanguageCode: targetLanguage,
            Settings: {
                Formality: 'FORMAL', // Use formal tone for healthcare
                Profanity: 'MASK' // Mask any profanity
            }
        });

        const result = await translateClient.send(command);
        
        return {
            translatedText: result.TranslatedText || '',
            confidence: 0.85 // Amazon Translate doesn't provide confidence scores, using default
        };
    } catch (error) {
        console.error('Error with Amazon Translate:', error);
        throw new Error('Translation service unavailable');
    }
}

// Enhance translation with medical context using Bedrock
async function enhanceTranslationWithMedicalContext(
    originalText: string,
    translatedText: string,
    sourceLanguage: string,
    targetLanguage: string,
    medicalContext?: MedicalContext
): Promise<{ enhancedText: string; confidence: number }> {
    try {
        const contextInfo = medicalContext ? `
Medical Context:
- Specialty: ${medicalContext.specialty || 'General'}
- Common Terms: ${medicalContext.commonTerms.join(', ')}
- Urgency Level: ${medicalContext.urgencyLevel}
- Previous Context: ${medicalContext.previousContext.slice(-3).join(', ')}
` : '';

        const prompt = `You are a medical translation expert. Review and improve the following translation for accuracy in healthcare context.

Original text (${sourceLanguage}): "${originalText}"
Current translation (${targetLanguage}): "${translatedText}"
${contextInfo}

Instructions:
1. Ensure medical terminology is accurately translated
2. Maintain professional healthcare tone
3. Preserve critical medical information
4. Consider cultural healthcare communication norms
5. Return only the improved translation without explanation

Improved translation:`;

        const command = new InvokeModelCommand({
            modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
            contentType: 'application/json',
            body: JSON.stringify({
                anthropic_version: 'bedrock-2023-05-31',
                max_tokens: 2000,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            })
        });

        const response = await bedrockClient.send(command);
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        
        const enhancedText = responseBody.content[0].text.trim();
        
        return {
            enhancedText: enhancedText || translatedText,
            confidence: 0.92 // Higher confidence for AI-enhanced translations
        };
    } catch (error) {
        console.error('Error enhancing translation with medical context:', error);
        return {
            enhancedText: translatedText,
            confidence: 0.85
        };
    }
}

// Calculate translation quality metrics
function calculateTranslationMetrics(
    originalText: string,
    translatedText: string,
    medicalTermsDetected: string[]
): { confidence: number; qualityScore: number } {
    // Basic quality metrics
    const lengthRatio = translatedText.length / originalText.length;
    const lengthScore = Math.max(0, 1 - Math.abs(lengthRatio - 1));
    
    // Medical terms preservation score
    const medicalTermsScore = medicalTermsDetected.length > 0 ? 0.9 : 1.0;
    
    // Overall confidence calculation
    const confidence = (lengthScore * 0.3 + medicalTermsScore * 0.7);
    const qualityScore = Math.min(0.95, Math.max(0.6, confidence));
    
    return { confidence: qualityScore, qualityScore };
}

// Main translation function
async function performTranslation(request: TranslationRequest): Promise<TranslationResult> {
    const { text, sourceLanguage, targetLanguage, medicalContext, useCache = true } = request;
    
    // Check cache first if enabled
    if (useCache) {
        const cachedResult = await checkTranslationCache(text, sourceLanguage, targetLanguage);
        if (cachedResult) {
            return {
                originalText: text,
                translatedText: cachedResult.translatedText,
                sourceLanguage,
                targetLanguage,
                confidence: cachedResult.confidence,
                medicalTermsDetected: cachedResult.medicalTermsDetected,
                cached: true,
                timestamp: new Date().toISOString()
            };
        }
    }
    
    // Detect medical terms in original text
    const medicalTermsDetected = await detectMedicalTerms(text);
    
    // Perform core translation
    const { translatedText, confidence: baseConfidence } = await translateWithAmazonTranslate(
        text,
        sourceLanguage,
        targetLanguage
    );
    
    // Enhance with medical context if available
    const { enhancedText, confidence: enhancedConfidence } = await enhanceTranslationWithMedicalContext(
        text,
        translatedText,
        sourceLanguage,
        targetLanguage,
        medicalContext
    );
    
    // Calculate final quality metrics
    const { confidence: finalConfidence } = calculateTranslationMetrics(
        text,
        enhancedText,
        medicalTermsDetected
    );
    
    const result: TranslationResult = {
        originalText: text,
        translatedText: enhancedText,
        sourceLanguage,
        targetLanguage,
        confidence: Math.max(enhancedConfidence, finalConfidence),
        medicalTermsDetected,
        cached: false,
        timestamp: new Date().toISOString()
    };
    
    // Store in cache for future use
    if (useCache && medicalTermsDetected.length > 0) {
        await storeTranslationCache(
            text,
            sourceLanguage,
            targetLanguage,
            enhancedText,
            result.confidence,
            medicalTermsDetected
        );
    }
    
    return result;
}

// Send response back through WebSocket
async function sendWebSocketResponse(
    connectionId: string,
    apiGatewayEndpoint: string,
    data: any
): Promise<void> {
    try {
        const apiGatewayClient = new ApiGatewayManagementApiClient({
            endpoint: apiGatewayEndpoint
        });
        
        const command = new PostToConnectionCommand({
            ConnectionId: connectionId,
            Data: JSON.stringify(data)
        });
        
        await apiGatewayClient.send(command);
    } catch (error) {
        console.error('Error sending WebSocket response:', error);
        throw error;
    }
}

// Lambda handler
export const handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
    console.log('Translation service event:', JSON.stringify(event, null, 2));
    
    try {
        const { connectionId, domainName, stage } = event.requestContext;
        const apiGatewayEndpoint = `https://${domainName}/${stage}`;
        
        if (!event.body) {
            throw new Error('Request body is required');
        }
        
        const request: TranslationRequest = JSON.parse(event.body);
        
        // Validate required fields
        if (!request.text || !request.sourceLanguage || !request.targetLanguage) {
            throw new Error('Missing required fields: text, sourceLanguage, targetLanguage');
        }
        
        // Perform translation
        const translationResult = await performTranslation(request);
        
        // Send result back through WebSocket
        await sendWebSocketResponse(connectionId!, apiGatewayEndpoint, {
            action: 'translationResult',
            sessionId: request.sessionId,
            result: translationResult,
            success: true
        });
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Translation completed successfully',
                sessionId: request.sessionId
            })
        };
        
    } catch (error) {
        console.error('Translation service error:', error);
        
        try {
            const { connectionId, domainName, stage } = event.requestContext;
            const apiGatewayEndpoint = `https://${domainName}/${stage}`;
            
            await sendWebSocketResponse(connectionId!, apiGatewayEndpoint, {
                action: 'translationError',
                error: error instanceof Error ? error.message : 'Translation service error',
                success: false
            });
        } catch (wsError) {
            console.error('Error sending WebSocket error response:', wsError);
        }
        
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: error instanceof Error ? error.message : 'Internal server error'
            })
        };
    }
};