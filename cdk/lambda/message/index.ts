import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';

const dynamodb = new DynamoDBClient({});

interface WebSocketMessage {
  action: string;
  data: any;
  sessionId?: string;
  requestId?: string;
}

interface WebSocketResponse {
  success: boolean;
  action: string;
  data?: any;
  error?: string;
  requestId?: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('WebSocket Message event:', JSON.stringify(event, null, 2));
  
  const connectionId = event.requestContext.connectionId!;
  const domainName = event.requestContext.domainName!;
  const stage = event.requestContext.stage!;
  
  const apiGateway = new ApiGatewayManagementApiClient({
    endpoint: `https://${domainName}/${stage}`
  });
  
  try {
    const body: WebSocketMessage = JSON.parse(event.body || '{}');
    const { action, data, sessionId, requestId } = body;
    
    console.log(`Processing action: ${action} for connection: ${connectionId}`);
    
    let response: WebSocketResponse = { 
      success: true, 
      action: `${action}Response`,
      requestId 
    };
    
    switch (action) {
      case 'startTranscription':
        response = await handleStartTranscription(connectionId, data, sessionId);
        break;
      case 'audioChunk':
        response = await handleAudioChunk(connectionId, data, sessionId);
        break;
      case 'stopTranscription':
        response = await handleStopTranscription(connectionId, data, sessionId);
        break;
      case 'translate':
        response = await handleTranslation(connectionId, data, sessionId);
        break;
      case 'synthesizeSpeech':
        response = await handleSpeechSynthesis(connectionId, data, sessionId);
        break;
      case 'ping':
        response = { success: true, action: 'pong', data: { timestamp: new Date().toISOString() } };
        break;
      default:
        response = { 
          success: false, 
          action: 'error', 
          error: `Unknown action: ${action}`,
          requestId 
        };
    }
    
    // Add requestId to response if provided
    if (requestId) {
      response.requestId = requestId;
    }
    
    // Send response back to client
    await apiGateway.send(new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: JSON.stringify(response)
    }));
    
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Message processed successfully' })
    };
  } catch (error) {
    console.error('Message processing error:', error);
    
    try {
      const errorResponse: WebSocketResponse = { 
        success: false, 
        action: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
      
      await apiGateway.send(new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: JSON.stringify(errorResponse)
      }));
    } catch (sendError) {
      console.error('Failed to send error response:', sendError);
    }
    
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to process message' })
    };
  }
};

async function handleStartTranscription(
  connectionId: string, 
  data: any, 
  sessionId?: string
): Promise<WebSocketResponse> {
  try {
    const { inputLanguage, outputLanguage, medicalSpecialty } = data;
    const newSessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store session information in DynamoDB
    await dynamodb.send(new PutItemCommand({
      TableName: process.env.SESSIONS_TABLE || 'healthcare-translation-sessions',
      Item: {
        sessionId: { S: newSessionId },
        connectionId: { S: connectionId },
        inputLanguage: { S: inputLanguage },
        outputLanguage: { S: outputLanguage },
        medicalSpecialty: { S: medicalSpecialty || 'general' },
        status: { S: 'active' },
        createdAt: { S: new Date().toISOString() },
        lastActivity: { S: new Date().toISOString() },
        ttl: { N: String(Math.floor(Date.now() / 1000) + 86400) } // 24 hours TTL
      }
    }));
    
    console.log(`Transcription session ${newSessionId} started for connection ${connectionId}`);
    
    return {
      success: true,
      action: 'transcriptionStarted',
      data: {
        sessionId: newSessionId,
        inputLanguage,
        outputLanguage,
        medicalSpecialty: medicalSpecialty || 'general',
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Start transcription error:', error);
    return {
      success: false,
      action: 'transcriptionError',
      error: error instanceof Error ? error.message : 'Failed to start transcription'
    };
  }
}

async function handleAudioChunk(
  connectionId: string, 
  data: any, 
  sessionId?: string
): Promise<WebSocketResponse> {
  try {
    const { audioData, chunkId, timestamp } = data;
    
    if (!sessionId) {
      throw new Error('Session ID required for audio processing');
    }
    
    // Verify session exists and is active
    const sessionResult = await dynamodb.send(new GetItemCommand({
      TableName: process.env.SESSIONS_TABLE || 'healthcare-translation-sessions',
      Key: {
        sessionId: { S: sessionId }
      }
    }));
    
    if (!sessionResult.Item) {
      throw new Error('Session not found');
    }
    
    // Update last activity
    await dynamodb.send(new UpdateItemCommand({
      TableName: process.env.SESSIONS_TABLE || 'healthcare-translation-sessions',
      Key: {
        sessionId: { S: sessionId }
      },
      UpdateExpression: 'SET lastActivity = :timestamp',
      ExpressionAttributeValues: {
        ':timestamp': { S: new Date().toISOString() }
      }
    }));
    
    // Here we would process the audio chunk with Transcribe Medical
    // For now, we'll simulate processing
    console.log(`Processing audio chunk ${chunkId} for session ${sessionId}`);
    
    // Simulate transcription result
    const mockTranscript = `Transcribed audio chunk ${chunkId}`;
    
    return {
      success: true,
      action: 'audioProcessed',
      data: {
        chunkId,
        sessionId,
        transcript: mockTranscript,
        confidence: 0.95,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Audio chunk processing error:', error);
    return {
      success: false,
      action: 'audioProcessingError',
      error: error instanceof Error ? error.message : 'Failed to process audio chunk'
    };
  }
}

async function handleStopTranscription(
  connectionId: string, 
  data: any, 
  sessionId?: string
): Promise<WebSocketResponse> {
  try {
    if (!sessionId) {
      throw new Error('Session ID required to stop transcription');
    }
    
    // Update session status to stopped
    await dynamodb.send(new UpdateItemCommand({
      TableName: process.env.SESSIONS_TABLE || 'healthcare-translation-sessions',
      Key: {
        sessionId: { S: sessionId }
      },
      UpdateExpression: 'SET #status = :status, stoppedAt = :timestamp',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': { S: 'stopped' },
        ':timestamp': { S: new Date().toISOString() }
      }
    }));
    
    console.log(`Transcription session ${sessionId} stopped for connection ${connectionId}`);
    
    return {
      success: true,
      action: 'transcriptionStopped',
      data: {
        sessionId,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Stop transcription error:', error);
    return {
      success: false,
      action: 'transcriptionStopError',
      error: error instanceof Error ? error.message : 'Failed to stop transcription'
    };
  }
}

async function handleTranslation(
  connectionId: string, 
  data: any, 
  sessionId?: string
): Promise<WebSocketResponse> {
  try {
    const { text, sourceLang, targetLang, medicalContext } = data;
    
    // Here we would integrate with Amazon Translate and Bedrock
    // For now, we'll simulate translation
    console.log(`Translating text from ${sourceLang} to ${targetLang} for session ${sessionId}`);
    
    const mockTranslation = `[${targetLang}] ${text}`;
    
    return {
      success: true,
      action: 'translationComplete',
      data: {
        originalText: text,
        translatedText: mockTranslation,
        sourceLang,
        targetLang,
        confidence: 0.92,
        medicalContext: medicalContext || false,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Translation error:', error);
    return {
      success: false,
      action: 'translationError',
      error: error instanceof Error ? error.message : 'Failed to translate text'
    };
  }
}

async function handleSpeechSynthesis(
  connectionId: string, 
  data: any, 
  sessionId?: string
): Promise<WebSocketResponse> {
  try {
    const { text, language, voiceId, ssmlEnabled } = data;
    
    // Here we would integrate with Amazon Polly
    // For now, we'll simulate speech synthesis
    console.log(`Synthesizing speech for text in ${language} for session ${sessionId}`);
    
    const mockAudioUrl = `https://example.com/audio/${Date.now()}.mp3`;
    
    return {
      success: true,
      action: 'speechSynthesized',
      data: {
        text,
        language,
        voiceId: voiceId || 'default',
        audioUrl: mockAudioUrl,
        duration: 5.2, // Mock duration in seconds
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Speech synthesis error:', error);
    return {
      success: false,
      action: 'speechSynthesisError',
      error: error instanceof Error ? error.message : 'Failed to synthesize speech'
    };
  }
}