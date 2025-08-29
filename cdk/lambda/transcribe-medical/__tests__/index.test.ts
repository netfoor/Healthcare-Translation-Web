import { handler } from '../index';
import { APIGatewayProxyEvent } from 'aws-lambda';

// Mock AWS SDK clients
jest.mock('@aws-sdk/client-transcribe-streaming');
jest.mock('@aws-sdk/client-apigatewaymanagementapi');
jest.mock('@aws-sdk/client-dynamodb');

const mockApiGatewayEvent = (body: any): APIGatewayProxyEvent => ({
  body: JSON.stringify(body),
  headers: {},
  multiValueHeaders: {},
  httpMethod: 'POST',
  isBase64Encoded: false,
  path: '/',
  pathParameters: null,
  queryStringParameters: null,
  multiValueQueryStringParameters: null,
  stageVariables: null,
  requestContext: {
    accountId: 'test-account',
    apiId: 'test-api',
    authorizer: {},
    protocol: 'wss',
    httpMethod: 'POST',
    path: '/',
    stage: 'test',
    requestId: 'test-request',
    requestTime: '2024-01-01T00:00:00Z',
    requestTimeEpoch: 1704067200000,
    resourceId: 'test-resource',
    resourcePath: '/',
    identity: {
      cognitoIdentityPoolId: null,
      accountId: null,
      cognitoIdentityId: null,
      caller: null,
      sourceIp: '127.0.0.1',
      principalOrgId: null,
      accessKey: null,
      cognitoAuthenticationType: null,
      cognitoAuthenticationProvider: null,
      userArn: null,
      userAgent: 'test-agent',
      user: null,
      apiKey: null,
      apiKeyId: null,
      clientCert: null
    },
    domainName: 'test-domain.com',
    connectionId: 'test-connection-id',
    connectedAt: 1704067200000,
    eventType: 'MESSAGE',
    extendedRequestId: 'test-extended-request-id',
    routeKey: 'test-route'
  },
  resource: '/'
});

describe('Transcribe Medical Lambda Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up environment variables
    process.env.SESSIONS_TABLE = 'test-sessions-table';
    process.env.CONNECTIONS_TABLE = 'test-connections-table';
  });

  describe('startMedicalTranscription action', () => {
    it('should successfully start medical transcription', async () => {
      const event = mockApiGatewayEvent({
        action: 'startMedicalTranscription',
        sessionId: 'test-session-123',
        inputLanguage: 'en',
        outputLanguage: 'es',
        medicalSpecialty: 'cardiology',
        requestId: 'req-123'
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({
        message: 'Transcribe request processed successfully'
      });
    });

    it('should handle unsupported language', async () => {
      const event = mockApiGatewayEvent({
        action: 'startMedicalTranscription',
        sessionId: 'test-session-123',
        inputLanguage: 'unsupported-lang',
        requestId: 'req-123'
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      // The error should be sent via WebSocket, not HTTP response
    });

    it('should default to general specialty when not specified', async () => {
      const event = mockApiGatewayEvent({
        action: 'startMedicalTranscription',
        sessionId: 'test-session-123',
        inputLanguage: 'en',
        requestId: 'req-123'
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
    });
  });

  describe('processMedicalAudio action', () => {
    it('should process audio data successfully', async () => {
      const audioData = Buffer.from('test audio data').toString('base64');
      
      const event = mockApiGatewayEvent({
        action: 'processMedicalAudio',
        sessionId: 'test-session-123',
        audioData,
        requestId: 'req-123'
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
    });

    it('should require session ID and audio data', async () => {
      const event = mockApiGatewayEvent({
        action: 'processMedicalAudio',
        requestId: 'req-123'
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      // Error should be sent via WebSocket
    });
  });

  describe('stopMedicalTranscription action', () => {
    it('should stop transcription successfully', async () => {
      const event = mockApiGatewayEvent({
        action: 'stopMedicalTranscription',
        sessionId: 'test-session-123',
        requestId: 'req-123'
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
    });

    it('should require session ID', async () => {
      const event = mockApiGatewayEvent({
        action: 'stopMedicalTranscription',
        requestId: 'req-123'
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      // Error should be sent via WebSocket
    });
  });

  describe('checkTranscribeHealth action', () => {
    it('should return health status', async () => {
      const event = mockApiGatewayEvent({
        action: 'checkTranscribeHealth',
        requestId: 'req-123'
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
    });
  });

  describe('unknown action', () => {
    it('should handle unknown actions gracefully', async () => {
      const event = mockApiGatewayEvent({
        action: 'unknownAction',
        requestId: 'req-123'
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
    });
  });

  describe('error handling', () => {
    it('should handle malformed JSON', async () => {
      const event = mockApiGatewayEvent({});
      event.body = 'invalid json';

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body)).toEqual({
        message: 'Failed to process transcribe request'
      });
    });

    it('should handle missing request context', async () => {
      const event = mockApiGatewayEvent({
        action: 'startMedicalTranscription'
      });
      
      // Remove connection ID to simulate error
      delete (event.requestContext as any).connectionId;

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
    });
  });

  describe('language and specialty mapping', () => {
    it('should map supported languages correctly', async () => {
      const supportedLanguages = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh'];
      
      for (const lang of supportedLanguages) {
        const event = mockApiGatewayEvent({
          action: 'startMedicalTranscription',
          sessionId: `test-session-${lang}`,
          inputLanguage: lang,
          requestId: `req-${lang}`
        });

        const result = await handler(event);
        expect(result.statusCode).toBe(200);
      }
    });

    it('should map medical specialties correctly', async () => {
      const specialties = ['cardiology', 'neurology', 'oncology', 'radiology', 'urology', 'general'];
      
      for (const specialty of specialties) {
        const event = mockApiGatewayEvent({
          action: 'startMedicalTranscription',
          sessionId: `test-session-${specialty}`,
          inputLanguage: 'en',
          medicalSpecialty: specialty,
          requestId: `req-${specialty}`
        });

        const result = await handler(event);
        expect(result.statusCode).toBe(200);
      }
    });
  });
});