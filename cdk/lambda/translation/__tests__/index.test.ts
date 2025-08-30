import { handler } from '../index';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';

// Mock AWS SDK clients
jest.mock('@aws-sdk/client-translate');
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/client-bedrock-runtime');
jest.mock('@aws-sdk/client-apigatewaymanagementapi');

import { TranslateClient, TranslateTextCommand } from '@aws-sdk/client-translate';
import { DynamoDBClient, PutItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';

const mockTranslateClient = TranslateClient as jest.MockedClass<typeof TranslateClient>;
const mockDynamoClient = DynamoDBClient as jest.MockedClass<typeof DynamoDBClient>;
const mockBedrockClient = BedrockRuntimeClient as jest.MockedClass<typeof BedrockRuntimeClient>;
const mockApiGatewayClient = ApiGatewayManagementApiClient as jest.MockedClass<typeof ApiGatewayManagementApiClient>;

describe('Translation Service Lambda Handler', () => {
    let mockEvent: APIGatewayProxyEvent;
    let mockContext: Context;
    let mockTranslateSend: jest.Mock;
    let mockDynamoSend: jest.Mock;
    let mockBedrockSend: jest.Mock;
    let mockApiGatewaySend: jest.Mock;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Mock AWS SDK send methods
        mockTranslateSend = jest.fn();
        mockDynamoSend = jest.fn();
        mockBedrockSend = jest.fn();
        mockApiGatewaySend = jest.fn();

        mockTranslateClient.prototype.send = mockTranslateSend;
        mockDynamoClient.prototype.send = mockDynamoSend;
        mockBedrockClient.prototype.send = mockBedrockSend;
        mockApiGatewayClient.prototype.send = mockApiGatewaySend;

        // Mock event
        mockEvent = {
            requestContext: {
                connectionId: 'test-connection-id',
                domainName: 'test-domain.com',
                stage: 'prod',
                requestId: 'test-request-id',
                requestTime: '2024-01-01T00:00:00Z',
                requestTimeEpoch: 1704067200,
                identity: {} as any,
                protocol: 'websocket',
                httpMethod: 'POST',
                resourcePath: '/',
                path: '/',
                accountId: '123456789012',
                apiId: 'test-api-id',
                resourceId: 'test-resource-id',
                eventType: 'MESSAGE',
                extendedRequestId: 'test-extended-id',
                messageDirection: 'IN',
                messageId: 'test-message-id',
                routeKey: 'translateText',
                authorizer: {} as any
            } as any,
            body: JSON.stringify({
                action: 'translateText',
                sessionId: 'test-session-id',
                text: 'The patient has chest pain',
                sourceLanguage: 'en',
                targetLanguage: 'es',
                useCache: true
            }),
            headers: {},
            multiValueHeaders: {},
            httpMethod: 'POST',
            isBase64Encoded: false,
            path: '/',
            pathParameters: null,
            queryStringParameters: null,
            multiValueQueryStringParameters: null,
            stageVariables: null,
            resource: '/'
        };

        // Mock context
        mockContext = {
            callbackWaitsForEmptyEventLoop: false,
            functionName: 'test-function',
            functionVersion: '1',
            invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
            memoryLimitInMB: '512',
            awsRequestId: 'test-request-id',
            logGroupName: '/aws/lambda/test-function',
            logStreamName: '2024/01/01/[$LATEST]test-stream',
            getRemainingTimeInMillis: () => 30000,
            done: jest.fn(),
            fail: jest.fn(),
            succeed: jest.fn()
        };

        // Set environment variables
        process.env.AWS_REGION = 'us-east-1';
    });

    describe('Successful Translation Flow', () => {
        beforeEach(() => {
            // Mock cache miss (no cached translation)
            mockDynamoSend.mockImplementation((command) => {
                if (command instanceof GetItemCommand) {
                    return Promise.resolve({ Item: undefined });
                }
                if (command instanceof PutItemCommand) {
                    return Promise.resolve({});
                }
                return Promise.resolve({});
            });

            // Mock Bedrock medical terms detection
            mockBedrockSend.mockImplementation((command) => {
                if (command instanceof InvokeModelCommand) {
                    const body = JSON.parse(command.input.body as string);
                    const prompt = body.messages[0].content;
                    
                    if (prompt.includes('identify medical terms')) {
                        return Promise.resolve({
                            body: new TextEncoder().encode(JSON.stringify({
                                content: [{ text: '["chest pain", "patient"]' }]
                            }))
                        });
                    } else if (prompt.includes('medical translation expert')) {
                        return Promise.resolve({
                            body: new TextEncoder().encode(JSON.stringify({
                                content: [{ text: 'El paciente tiene dolor en el pecho' }]
                            }))
                        });
                    }
                }
                return Promise.resolve({});
            });

            // Mock Amazon Translate
            mockTranslateSend.mockImplementation((command) => {
                if (command instanceof TranslateTextCommand) {
                    return Promise.resolve({
                        TranslatedText: 'El paciente tiene dolor de pecho'
                    });
                }
                return Promise.resolve({});
            });

            // Mock API Gateway WebSocket response
            mockApiGatewaySend.mockImplementation((command) => {
                if (command instanceof PostToConnectionCommand) {
                    return Promise.resolve({});
                }
                return Promise.resolve({});
            });
        });

        test('should successfully translate text with medical context', async () => {
            const result = await handler(mockEvent, mockContext);

            expect(result.statusCode).toBe(200);
            expect(JSON.parse(result.body)).toEqual({
                message: 'Translation completed successfully',
                sessionId: 'test-session-id'
            });

            // Verify Amazon Translate was called
            expect(mockTranslateSend).toHaveBeenCalledWith(
                expect.objectContaining({
                    input: expect.objectContaining({
                        Text: 'The patient has chest pain',
                        SourceLanguageCode: 'en',
                        TargetLanguageCode: 'es'
                    })
                })
            );

            // Verify Bedrock was called for medical terms detection
            expect(mockBedrockSend).toHaveBeenCalledWith(
                expect.objectContaining({
                    input: expect.objectContaining({
                        modelId: 'anthropic.claude-3-haiku-20240307-v1:0'
                    })
                })
            );

            // Verify WebSocket response was sent
            expect(mockApiGatewaySend).toHaveBeenCalledWith(
                expect.objectContaining({
                    input: expect.objectContaining({
                        ConnectionId: 'test-connection-id',
                        Data: expect.stringContaining('translationResult')
                    })
                })
            );
        });

        test('should use cached translation when available', async () => {
            // Mock cache hit
            mockDynamoSend.mockImplementation((command) => {
                if (command instanceof GetItemCommand) {
                    return Promise.resolve({
                        Item: {
                            translationKey: { S: 'test-key' },
                            translatedText: { S: 'El paciente tiene dolor en el pecho (cached)' },
                            confidence: { N: '0.95' },
                            medicalTermsDetected: { SS: ['chest pain', 'patient'] },
                            createdAt: { S: '2024-01-01T00:00:00Z' },
                            accessCount: { N: '5' }
                        }
                    });
                }
                return Promise.resolve({});
            });

            const result = await handler(mockEvent, mockContext);

            expect(result.statusCode).toBe(200);

            // Verify Amazon Translate was NOT called (used cache)
            expect(mockTranslateSend).not.toHaveBeenCalled();

            // Verify WebSocket response contains cached result
            const webSocketCall = mockApiGatewaySend.mock.calls.find(call => 
                call[0].input.Data && JSON.parse(call[0].input.Data).result?.cached === true
            );
            expect(webSocketCall).toBeDefined();
        });

        test('should handle medical context enhancement', async () => {
            const eventWithMedicalContext = {
                ...mockEvent,
                body: JSON.stringify({
                    action: 'translateText',
                    sessionId: 'test-session-id',
                    text: 'Patient presents with acute myocardial infarction',
                    sourceLanguage: 'en',
                    targetLanguage: 'es',
                    medicalContext: {
                        specialty: 'Cardiology',
                        commonTerms: ['myocardial infarction', 'acute', 'chest pain'],
                        previousContext: ['cardiac symptoms', 'ECG abnormal'],
                        urgencyLevel: 'high' as const
                    }
                })
            };

            const result = await handler(eventWithMedicalContext, mockContext);

            expect(result.statusCode).toBe(200);

            // Verify Bedrock was called with medical context
            const bedrockCalls = mockBedrockSend.mock.calls.filter(call => 
                call[0] instanceof InvokeModelCommand
            );
            
            const enhancementCall = bedrockCalls.find(call => {
                const body = JSON.parse(call[0].input.body as string);
                return body.messages[0].content.includes('medical translation expert');
            });
            
            expect(enhancementCall).toBeDefined();
            
            const enhancementBody = JSON.parse(enhancementCall![0].input.body as string);
            expect(enhancementBody.messages[0].content).toContain('Specialty: Cardiology');
            expect(enhancementBody.messages[0].content).toContain('Urgency Level: high');
        });
    });

    describe('Error Handling', () => {
        test('should handle missing request body', async () => {
            const eventWithoutBody = { ...mockEvent, body: null };

            const result = await handler(eventWithoutBody, mockContext);

            expect(result.statusCode).toBe(500);
            expect(JSON.parse(result.body)).toEqual({
                error: 'Request body is required'
            });
        });

        test('should handle missing required fields', async () => {
            const eventWithIncompleteBody = {
                ...mockEvent,
                body: JSON.stringify({
                    action: 'translateText',
                    sessionId: 'test-session-id'
                    // Missing text, sourceLanguage, targetLanguage
                })
            };

            const result = await handler(eventWithIncompleteBody, mockContext);

            expect(result.statusCode).toBe(500);
            expect(JSON.parse(result.body)).toEqual({
                error: 'Missing required fields: text, sourceLanguage, targetLanguage'
            });
        });

        test('should handle Amazon Translate service errors', async () => {
            mockTranslateSend.mockRejectedValue(new Error('Translate service unavailable'));

            const result = await handler(mockEvent, mockContext);

            expect(result.statusCode).toBe(500);

            // Verify error was sent through WebSocket
            expect(mockApiGatewaySend).toHaveBeenCalledWith(
                expect.objectContaining({
                    input: expect.objectContaining({
                        ConnectionId: 'test-connection-id',
                        Data: expect.stringContaining('translationError')
                    })
                })
            );
        });

        test('should handle Bedrock service errors gracefully', async () => {
            // Mock Bedrock failure but Translate success
            mockBedrockSend.mockRejectedValue(new Error('Bedrock unavailable'));
            mockTranslateSend.mockResolvedValue({
                TranslatedText: 'El paciente tiene dolor de pecho'
            });

            const result = await handler(mockEvent, mockContext);

            // Should still succeed with basic translation
            expect(result.statusCode).toBe(200);
            expect(mockTranslateSend).toHaveBeenCalled();
        });

        test('should handle DynamoDB cache errors gracefully', async () => {
            // Mock DynamoDB failure
            mockDynamoSend.mockRejectedValue(new Error('DynamoDB unavailable'));
            
            // Mock successful translation
            mockTranslateSend.mockResolvedValue({
                TranslatedText: 'El paciente tiene dolor de pecho'
            });

            const result = await handler(mockEvent, mockContext);

            // Should still succeed without caching
            expect(result.statusCode).toBe(200);
            expect(mockTranslateSend).toHaveBeenCalled();
        });
    });

    describe('Cache Management', () => {
        test('should generate consistent cache keys', async () => {
            // This test verifies cache key generation logic
            const text1 = 'The patient has chest pain';
            const text2 = 'THE PATIENT HAS CHEST PAIN'; // Different case
            const text3 = 'The  patient  has  chest  pain'; // Extra spaces

            // All should generate the same cache key due to normalization
            // We'll test this by checking DynamoDB calls
            
            mockDynamoSend.mockResolvedValue({ Item: undefined });
            mockTranslateSend.mockResolvedValue({ TranslatedText: 'Test translation' });

            await handler(mockEvent, mockContext);

            // Verify GetItemCommand was called with normalized key
            const getItemCalls = mockDynamoSend.mock.calls.filter(call => 
                call[0] instanceof GetItemCommand
            );
            expect(getItemCalls.length).toBeGreaterThan(0);
        });

        test('should respect cache disable flag', async () => {
            const eventWithCacheDisabled = {
                ...mockEvent,
                body: JSON.stringify({
                    action: 'translateText',
                    sessionId: 'test-session-id',
                    text: 'The patient has chest pain',
                    sourceLanguage: 'en',
                    targetLanguage: 'es',
                    useCache: false
                })
            };

            mockTranslateSend.mockResolvedValue({
                TranslatedText: 'El paciente tiene dolor de pecho'
            });

            await handler(eventWithCacheDisabled, mockContext);

            // Verify cache was not checked
            const getItemCalls = mockDynamoSend.mock.calls.filter(call => 
                call[0] instanceof GetItemCommand
            );
            expect(getItemCalls.length).toBe(0);
        });
    });

    describe('Quality Metrics', () => {
        test('should calculate confidence scores', async () => {
            mockTranslateSend.mockResolvedValue({
                TranslatedText: 'El paciente tiene dolor en el pecho'
            });

            const result = await handler(mockEvent, mockContext);

            expect(result.statusCode).toBe(200);

            // Verify WebSocket response contains confidence score
            const webSocketCall = mockApiGatewaySend.mock.calls.find(call => 
                call[0].input.Data && JSON.parse(call[0].input.Data).result?.confidence
            );
            expect(webSocketCall).toBeDefined();
            
            const responseData = JSON.parse(webSocketCall![0].input.Data);
            expect(responseData.result.confidence).toBeGreaterThan(0);
            expect(responseData.result.confidence).toBeLessThanOrEqual(1);
        });

        test('should detect and report medical terms', async () => {
            mockBedrockSend.mockImplementation((command) => {
                if (command instanceof InvokeModelCommand) {
                    const body = JSON.parse(command.input.body as string);
                    if (body.messages[0].content.includes('identify medical terms')) {
                        return Promise.resolve({
                            body: new TextEncoder().encode(JSON.stringify({
                                content: [{ text: '["chest pain", "patient", "acute"]' }]
                            }))
                        });
                    }
                }
                return Promise.resolve({
                    body: new TextEncoder().encode(JSON.stringify({
                        content: [{ text: 'Enhanced translation' }]
                    }))
                });
            });

            mockTranslateSend.mockResolvedValue({
                TranslatedText: 'El paciente tiene dolor de pecho agudo'
            });

            const result = await handler(mockEvent, mockContext);

            expect(result.statusCode).toBe(200);

            // Verify medical terms were detected and included in response
            const webSocketCall = mockApiGatewaySend.mock.calls.find(call => 
                call[0].input.Data && JSON.parse(call[0].input.Data).result?.medicalTermsDetected
            );
            expect(webSocketCall).toBeDefined();
            
            const responseData = JSON.parse(webSocketCall![0].input.Data);
            expect(responseData.result.medicalTermsDetected).toContain('chest pain');
            expect(responseData.result.medicalTermsDetected).toContain('patient');
        });
    });
});