// Mock AWS SDK clients before importing the handler
const mockTranslateSend = jest.fn();
const mockDynamoSend = jest.fn();
const mockBedrockSend = jest.fn();
const mockApiGatewaySend = jest.fn();

jest.mock('@aws-sdk/client-translate', () => ({
    TranslateClient: jest.fn().mockImplementation(() => ({
        send: mockTranslateSend,
    })),
    TranslateTextCommand: jest.fn(),
}));

jest.mock('@aws-sdk/client-dynamodb', () => ({
    DynamoDBClient: jest.fn().mockImplementation(() => ({
        send: mockDynamoSend,
    })),
    PutItemCommand: jest.fn(),
    GetItemCommand: jest.fn(),
    UpdateItemCommand: jest.fn(),
}));

jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
    BedrockRuntimeClient: jest.fn().mockImplementation(() => ({
        send: mockBedrockSend,
    })),
    InvokeModelCommand: jest.fn(),
}));

jest.mock('@aws-sdk/client-apigatewaymanagementapi', () => ({
    ApiGatewayManagementApiClient: jest.fn().mockImplementation(() => ({
        send: mockApiGatewaySend,
    })),
    PostToConnectionCommand: jest.fn(),
}));

// Import the command classes for type checking
import { TranslateTextCommand } from '@aws-sdk/client-translate';
import { PutItemCommand, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';

import { handler } from '../index';

describe('Debug Translation Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Set environment variables
        process.env.AWS_REGION = 'us-east-1';
        process.env.TRANSLATION_CACHE_TABLE = 'healthcare-translation-cache';
    });

    test('should debug basic translation flow', async () => {
        // Mock cache miss - return proper structure
        mockDynamoSend.mockResolvedValue({ Item: undefined });

        // Mock Bedrock responses - return proper structure
        mockBedrockSend.mockResolvedValue({
            body: new TextEncoder().encode(JSON.stringify({
                content: [{ text: '["chest pain", "patient"]' }]
            }))
        });

        // Mock Amazon Translate - return proper structure
        mockTranslateSend.mockResolvedValue({
            TranslatedText: 'El paciente tiene dolor de pecho'
        });

        // Mock API Gateway WebSocket response
        mockApiGatewaySend.mockImplementation((command) => {
            if (command instanceof PostToConnectionCommand) {
                return Promise.resolve({});
            }
            return Promise.resolve({});
        });

        const mockEvent = {
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

        const mockContext = {
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

        const result = await handler(mockEvent, mockContext);

        console.log('Result status:', result.statusCode);
        console.log('Result body:', result.body);

        if (result.statusCode !== 200) {
            const errorBody = JSON.parse(result.body);
            console.log('Error details:', errorBody);
        }

        expect(result.statusCode).toBe(200);
    });
});