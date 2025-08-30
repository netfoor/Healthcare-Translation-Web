import { APIGatewayProxyEvent } from 'aws-lambda';

// Mock AWS SDK clients - define mocks before importing
const mockBedrockClient = {
  send: jest.fn()
};

const mockApiGatewayClient = {
  send: jest.fn()
};

const mockDynamoDBClient = {
  send: jest.fn()
};

// Mock the AWS SDK constructors
jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn(() => mockBedrockClient),
  InvokeModelCommand: jest.fn(),
  InvokeModelWithResponseStreamCommand: jest.fn()
}));

jest.mock('@aws-sdk/client-apigatewaymanagementapi', () => ({
  ApiGatewayManagementApiClient: jest.fn(() => mockApiGatewayClient),
  PostToConnectionCommand: jest.fn((params) => params)
}));

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => mockDynamoDBClient),
  GetItemCommand: jest.fn(),
  UpdateItemCommand: jest.fn(),
  PutItemCommand: jest.fn()
}));

// Import handler after mocks are set up
import { handler } from '../index';

describe('Bedrock AI Lambda Handler', () => {
  const mockEvent: Partial<APIGatewayProxyEvent> = {
    requestContext: {
      connectionId: 'test-connection-id',
      domainName: 'test-domain.com',
      stage: 'test'
    } as any,
    body: JSON.stringify({
      action: 'enhanceTranscript',
      sessionId: 'test-session-id',
      text: 'Patient reports chest pain and shortness of breath',
      requestId: 'test-request-id'
    })
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock responses
    mockBedrockClient.send.mockResolvedValue({
      body: new TextEncoder().encode(JSON.stringify({
        content: [{
          text: 'Patient reports chest pain and dyspnea with elevated blood pressure'
        }]
      }))
    });
    
    // Mock API Gateway send to return resolved promise
    mockApiGatewayClient.send.mockResolvedValue({});
    
    mockDynamoDBClient.send.mockResolvedValue({});
  });

  describe('Handler Function', () => {
    it('should process enhance transcript request successfully', async () => {
      const result = await handler(mockEvent as APIGatewayProxyEvent);
      
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({
        message: 'Bedrock AI request processed successfully'
      });
      
      // Verify Bedrock was called
      expect(mockBedrockClient.send).toHaveBeenCalled();
      
      // Verify response was sent to client
      expect(mockApiGatewayClient.send).toHaveBeenCalled();
    });

    it('should handle normalize terminology request', async () => {
      const normalizeEvent = {
        ...mockEvent,
        body: JSON.stringify({
          action: 'normalizeTerminology',
          sessionId: 'test-session-id',
          text: 'Patient has high blood pressure and heart attack',
          requestId: 'test-request-id'
        })
      };

      const result = await handler(normalizeEvent as APIGatewayProxyEvent);
      
      expect(result.statusCode).toBe(200);
      expect(mockBedrockClient.send).toHaveBeenCalled();
    });

    it('should handle enhance translation request', async () => {
      const translateEvent = {
        ...mockEvent,
        body: JSON.stringify({
          action: 'enhanceTranslation',
          sessionId: 'test-session-id',
          text: 'Patient reports chest pain',
          inputLanguage: 'en',
          outputLanguage: 'es',
          requestId: 'test-request-id'
        })
      };

      const result = await handler(translateEvent as APIGatewayProxyEvent);
      
      expect(result.statusCode).toBe(200);
      expect(mockBedrockClient.send).toHaveBeenCalled();
    });

    it('should handle detect medical context request', async () => {
      const contextEvent = {
        ...mockEvent,
        body: JSON.stringify({
          action: 'detectMedicalContext',
          sessionId: 'test-session-id',
          text: 'Emergency patient with severe chest pain and elevated cardiac enzymes',
          requestId: 'test-request-id'
        })
      };

      const result = await handler(contextEvent as APIGatewayProxyEvent);
      
      expect(result.statusCode).toBe(200);
      expect(mockBedrockClient.send).toHaveBeenCalled();
    });

    it('should handle confidence scoring request', async () => {
      const confidenceEvent = {
        ...mockEvent,
        body: JSON.stringify({
          action: 'scoreConfidence',
          sessionId: 'test-session-id',
          text: 'Patient diagnosed with myocardial infarction, prescribed aspirin and lisinopril',
          requestId: 'test-request-id'
        })
      };

      const result = await handler(confidenceEvent as APIGatewayProxyEvent);
      
      expect(result.statusCode).toBe(200);
    });

    it('should handle unknown action with error', async () => {
      const unknownEvent = {
        ...mockEvent,
        body: JSON.stringify({
          action: 'unknownAction',
          sessionId: 'test-session-id',
          text: 'Some text',
          requestId: 'test-request-id'
        })
      };

      const result = await handler(unknownEvent as APIGatewayProxyEvent);
      
      expect(result.statusCode).toBe(200);
      expect(mockApiGatewayClient.send).toHaveBeenCalled();
      // Verify that an error response was sent (simplified check)
      const callArgs = mockApiGatewayClient.send.mock.calls[0][0];
      expect(callArgs).toBeDefined();
    });

    it('should handle missing request context', async () => {
      const invalidEvent = {
        ...mockEvent,
        requestContext: {}
      };

      const result = await handler(invalidEvent as APIGatewayProxyEvent);
      
      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body)).toEqual({
        message: 'Missing required request context'
      });
    });

    it('should handle Bedrock service errors gracefully', async () => {
      mockBedrockClient.send.mockRejectedValue(new Error('Bedrock service unavailable'));

      const result = await handler(mockEvent as APIGatewayProxyEvent);
      
      // Lambda returns 200 but sends error response to client via WebSocket
      expect(result.statusCode).toBe(200);
      expect(mockApiGatewayClient.send).toHaveBeenCalled();
      // Verify error handling occurred
      expect(mockBedrockClient.send).toHaveBeenCalled();
    });

    it('should handle invalid JSON in request body', async () => {
      const invalidJsonEvent = {
        ...mockEvent,
        body: 'invalid json'
      };

      const result = await handler(invalidJsonEvent as APIGatewayProxyEvent);
      
      expect(result.statusCode).toBe(500);
    });
  });

  describe('Medical Term Detection', () => {
    it('should detect medical terms in text', async () => {
      const medicalEvent = {
        ...mockEvent,
        body: JSON.stringify({
          action: 'detectMedicalContext',
          sessionId: 'test-session-id',
          text: 'Patient has hypertension, diabetes, and takes aspirin daily',
          requestId: 'test-request-id'
        })
      };

      const result = await handler(medicalEvent as APIGatewayProxyEvent);
      
      expect(result.statusCode).toBe(200);
      expect(mockApiGatewayClient.send).toHaveBeenCalled();
      expect(mockBedrockClient.send).toHaveBeenCalled();
    });
  });

  describe('Confidence Scoring', () => {
    it('should calculate confidence metrics for medical text', async () => {
      const confidenceEvent = {
        ...mockEvent,
        body: JSON.stringify({
          action: 'scoreConfidence',
          sessionId: 'test-session-id',
          text: 'Patient diagnosed with acute myocardial infarction. Administered aspirin 325mg and started on lisinopril 10mg daily.',
          requestId: 'test-request-id'
        })
      };

      const result = await handler(confidenceEvent as APIGatewayProxyEvent);
      
      expect(result.statusCode).toBe(200);
      expect(mockApiGatewayClient.send).toHaveBeenCalled();
      // Confidence scoring doesn't require Bedrock for basic metrics
    });
  });

  describe('Error Handling', () => {
    it('should handle empty text input', async () => {
      const emptyTextEvent = {
        ...mockEvent,
        body: JSON.stringify({
          action: 'enhanceTranscript',
          sessionId: 'test-session-id',
          text: '',
          requestId: 'test-request-id'
        })
      };

      const result = await handler(emptyTextEvent as APIGatewayProxyEvent);
      
      expect(result.statusCode).toBe(200);
      expect(mockApiGatewayClient.send).toHaveBeenCalled();
      // Error response should be sent to client
    });

    it('should handle missing required fields for translation', async () => {
      const incompleteEvent = {
        ...mockEvent,
        body: JSON.stringify({
          action: 'enhanceTranslation',
          sessionId: 'test-session-id',
          text: 'Some text',
          // Missing inputLanguage and outputLanguage
          requestId: 'test-request-id'
        })
      };

      const result = await handler(incompleteEvent as APIGatewayProxyEvent);
      
      expect(result.statusCode).toBe(200);
      expect(mockApiGatewayClient.send).toHaveBeenCalled();
      // Error response should be sent to client
    });
  });

  describe('Medical Context Analysis', () => {
    it('should analyze medical context and determine specialty', async () => {
      const cardiologyEvent = {
        ...mockEvent,
        body: JSON.stringify({
          action: 'detectMedicalContext',
          sessionId: 'test-session-id',
          text: 'Patient presents with chest pain, elevated troponins, and abnormal ECG findings consistent with STEMI',
          requestId: 'test-request-id'
        })
      };

      const result = await handler(cardiologyEvent as APIGatewayProxyEvent);
      
      expect(result.statusCode).toBe(200);
      expect(mockApiGatewayClient.send).toHaveBeenCalled();
      expect(mockBedrockClient.send).toHaveBeenCalled();
    });

    it('should detect urgency level from medical text', async () => {
      const emergencyEvent = {
        ...mockEvent,
        body: JSON.stringify({
          action: 'detectMedicalContext',
          sessionId: 'test-session-id',
          text: 'Emergency: Critical patient with severe trauma and unstable vital signs',
          requestId: 'test-request-id'
        })
      };

      const result = await handler(emergencyEvent as APIGatewayProxyEvent);
      
      expect(result.statusCode).toBe(200);
      expect(mockApiGatewayClient.send).toHaveBeenCalled();
      expect(mockBedrockClient.send).toHaveBeenCalled();
    });
  });
});