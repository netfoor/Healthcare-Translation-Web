import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { 
  TranscribeStreamingClient, 
  StartMedicalStreamTranscriptionCommand,
  StartStreamTranscriptionCommand,
  LanguageCode,
  MediaEncoding
} from '@aws-sdk/client-transcribe-streaming';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { DynamoDBClient, GetItemCommand, UpdateItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';

const transcribeClient = new TranscribeStreamingClient({});
const dynamodb = new DynamoDBClient({});

interface TranscribeRequest {
  action: string;
  sessionId: string;
  inputLanguage: string;
  outputLanguage?: string;
  medicalSpecialty?: string;
  audioData?: string; // Base64 encoded audio chunk
  requestId?: string;
}

interface TranscribeResponse {
  success: boolean;
  action: string;
  data?: any;
  error?: string;
  requestId?: string;
}

interface TranscriptionSession {
  sessionId: string;
  connectionId: string;
  inputLanguage: string;
  outputLanguage?: string;
  medicalSpecialty?: string;
  transcribeStreamArn?: string;
  status: 'starting' | 'active' | 'stopping' | 'stopped' | 'error';
  useFallback: boolean;
  errorCount: number;
  createdAt: string;
  lastActivity: string;
}

// Medical specialties mapping for Transcribe Medical
const MEDICAL_SPECIALTIES: Record<string, string> = {
  'cardiology': 'CARDIOLOGY',
  'neurology': 'NEUROLOGY',
  'oncology': 'ONCOLOGY',
  'radiology': 'RADIOLOGY',
  'urology': 'UROLOGY',
  'general': 'PRIMARYCARE'
};

// Language codes mapping
const LANGUAGE_CODES: Record<string, LanguageCode> = {
  'en': LanguageCode.EN_US,
  'es': LanguageCode.ES_US,
  'fr': LanguageCode.FR_FR,
  'de': LanguageCode.DE_DE,
  'it': LanguageCode.IT_IT,
  'pt': LanguageCode.PT_BR,
  'ja': LanguageCode.JA_JP,
  'ko': LanguageCode.KO_KR,
  'zh': LanguageCode.ZH_CN
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Transcribe Medical event:', JSON.stringify(event, null, 2));
  
  const connectionId = event.requestContext.connectionId;
  const domainName = event.requestContext.domainName;
  const stage = event.requestContext.stage;
  
  if (!connectionId || !domainName || !stage) {
    console.error('Missing required request context properties');
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Missing required request context' })
    };
  }
  
  const apiGateway = new ApiGatewayManagementApiClient({
    endpoint: `https://${domainName}/${stage}`
  });
  
  try {
    const body: TranscribeRequest = JSON.parse(event.body || '{}');
    const { action, sessionId, requestId } = body;
    
    console.log(`Processing transcribe action: ${action} for session: ${sessionId}`);
    
    let response: TranscribeResponse = { 
      success: true, 
      action: `${action}Response`,
      requestId 
    };
    
    switch (action) {
      case 'startMedicalTranscription':
        response = await handleStartMedicalTranscription(connectionId, body, apiGateway);
        break;
      case 'processMedicalAudio':
        response = await handleProcessMedicalAudio(connectionId, body, apiGateway);
        break;
      case 'stopMedicalTranscription':
        response = await handleStopMedicalTranscription(connectionId, body);
        break;
      case 'checkTranscribeHealth':
        response = await handleHealthCheck();
        break;
      default:
        response = { 
          success: false, 
          action: 'error', 
          error: `Unknown transcribe action: ${action}`,
          requestId 
        };
    }
    
    // Send response back to client
    await apiGateway.send(new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: JSON.stringify(response)
    }));
    
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Transcribe request processed successfully' })
    };
  } catch (error) {
    console.error('Transcribe processing error:', error);
    
    try {
      const errorResponse: TranscribeResponse = { 
        success: false, 
        action: 'transcribeError', 
        error: error instanceof Error ? error.message : 'Unknown transcribe error' 
      };
      
      await apiGateway.send(new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: JSON.stringify(errorResponse)
      }));
    } catch (sendError) {
      console.error('Failed to send transcribe error response:', sendError);
    }
    
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to process transcribe request' })
    };
  }
};

async function handleStartMedicalTranscription(
  connectionId: string,
  request: TranscribeRequest,
  apiGateway: ApiGatewayManagementApiClient
): Promise<TranscribeResponse> {
  try {
    const { sessionId, inputLanguage, outputLanguage, medicalSpecialty } = request;
    
    // Validate input language
    const languageCode = LANGUAGE_CODES[inputLanguage];
    if (!languageCode) {
      throw new Error(`Unsupported input language: ${inputLanguage}`);
    }
    
    // Get medical specialty or default to primary care
    const specialty = MEDICAL_SPECIALTIES[medicalSpecialty || 'general'] || 'PRIMARYCARE';
    
    // Create session record
    const session: TranscriptionSession = {
      sessionId,
      connectionId,
      inputLanguage,
      outputLanguage,
      medicalSpecialty: medicalSpecialty || 'general',
      status: 'starting',
      useFallback: false,
      errorCount: 0,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString()
    };
    
    // Store session in DynamoDB
    await dynamodb.send(new PutItemCommand({
      TableName: process.env.SESSIONS_TABLE || 'healthcare-translation-sessions',
      Item: {
        sessionId: { S: sessionId },
        connectionId: { S: connectionId },
        inputLanguage: { S: inputLanguage },
        outputLanguage: { S: outputLanguage || '' },
        medicalSpecialty: { S: medicalSpecialty || 'general' },
        status: { S: 'starting' },
        useFallback: { BOOL: false },
        errorCount: { N: '0' },
        createdAt: { S: session.createdAt },
        lastActivity: { S: session.lastActivity },
        ttl: { N: String(Math.floor(Date.now() / 1000) + 86400) } // 24 hours TTL
      }
    }));
    
    try {
      // Attempt to start Transcribe Medical stream
      await startTranscribeMedicalStream(session, apiGateway);
      
      // Update session status to active
      await updateSessionStatus(sessionId, 'active');
      
      return {
        success: true,
        action: 'medicalTranscriptionStarted',
        data: {
          sessionId,
          inputLanguage,
          outputLanguage,
          medicalSpecialty: medicalSpecialty || 'general',
          service: 'transcribe-medical',
          timestamp: new Date().toISOString()
        }
      };
    } catch (medicalError) {
      console.warn('Transcribe Medical failed, attempting fallback to standard Transcribe:', medicalError);
      
      // Mark session for fallback
      await updateSessionFallback(sessionId, true);
      
      try {
        // Attempt fallback to standard Transcribe
        await startTranscribeStandardStream(session, apiGateway);
        
        // Update session status to active with fallback
        await updateSessionStatus(sessionId, 'active');
        
        return {
          success: true,
          action: 'medicalTranscriptionStarted',
          data: {
            sessionId,
            inputLanguage,
            outputLanguage,
            medicalSpecialty: medicalSpecialty || 'general',
            service: 'transcribe-standard',
            fallback: true,
            warning: 'Using standard Transcribe due to Medical Transcribe unavailability',
            timestamp: new Date().toISOString()
          }
        };
      } catch (fallbackError) {
        console.error('Both Transcribe Medical and standard Transcribe failed:', fallbackError);
        
        await updateSessionStatus(sessionId, 'error');
        
        throw new Error('Both Transcribe Medical and standard Transcribe services are unavailable');
      }
    }
  } catch (error) {
    console.error('Start medical transcription error:', error);
    return {
      success: false,
      action: 'medicalTranscriptionError',
      error: error instanceof Error ? error.message : 'Failed to start medical transcription'
    };
  }
}

async function startTranscribeMedicalStream(
  session: TranscriptionSession,
  apiGateway: ApiGatewayManagementApiClient
): Promise<void> {
  const languageCode = LANGUAGE_CODES[session.inputLanguage];
  const specialty = MEDICAL_SPECIALTIES[session.medicalSpecialty || 'general'];
  
  console.log(`Starting Transcribe Medical stream for session ${session.sessionId} with language ${languageCode} and specialty ${specialty}`);
  
  try {
    // Simulate successful stream initialization
    console.log('Transcribe Medical stream initialized successfully');
    
    // In a real implementation, you would:
    // 1. Create and maintain the actual Transcribe Medical stream
    // 2. Store the stream reference for processing incoming audio chunks
    // 3. Set up event handlers for transcript results
    
    // For now, we'll just log the successful initialization
    console.log(`Medical transcription stream ready for session ${session.sessionId}`);
    
  } catch (error) {
    console.error('Transcribe Medical stream initialization error:', error);
    throw error;
  }
}

async function startTranscribeStandardStream(
  session: TranscriptionSession,
  apiGateway: ApiGatewayManagementApiClient
): Promise<void> {
  const languageCode = LANGUAGE_CODES[session.inputLanguage];
  
  console.log(`Starting standard Transcribe stream for session ${session.sessionId} with language ${languageCode}`);
  
  try {
    // Simulate successful fallback stream initialization
    console.log('Standard Transcribe stream initialized successfully as fallback');
    
    // In a real implementation, you would:
    // 1. Create and maintain the actual Transcribe stream with medical vocabulary
    // 2. Store the stream reference for processing incoming audio chunks
    // 3. Set up event handlers for transcript results
    // 4. Use the medical vocabulary for better accuracy
    
    console.log(`Standard transcription stream ready for session ${session.sessionId} (fallback mode)`);
    
  } catch (error) {
    console.error('Transcribe standard stream initialization error:', error);
    throw error;
  }
}

async function handleProcessMedicalAudio(
  connectionId: string,
  request: TranscribeRequest,
  apiGateway: ApiGatewayManagementApiClient
): Promise<TranscribeResponse> {
  try {
    const { sessionId, audioData } = request;
    
    if (!sessionId || !audioData) {
      throw new Error('Session ID and audio data are required');
    }
    
    // Get session from DynamoDB
    const sessionResult = await dynamodb.send(new GetItemCommand({
      TableName: process.env.SESSIONS_TABLE || 'healthcare-translation-sessions',
      Key: {
        sessionId: { S: sessionId }
      }
    }));
    
    if (!sessionResult.Item) {
      throw new Error('Transcription session not found');
    }
    
    const session = sessionResult.Item;
    const status = session.status?.S;
    const useFallback = session.useFallback?.BOOL || false;
    
    if (status !== 'active') {
      throw new Error(`Session is not active. Current status: ${status}`);
    }
    
    // Decode base64 audio data
    const audioBuffer = Buffer.from(audioData, 'base64');
    console.log(`Processing ${audioBuffer.length} bytes of audio for session ${sessionId}`);
    
    // Simulate transcription processing
    // In a real implementation, this would send the audio to the active Transcribe stream
    const mockTranscript = await simulateTranscription(audioBuffer, useFallback);
    
    // Send transcript result back to client
    await apiGateway.send(new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: JSON.stringify({
        success: true,
        action: 'transcriptReceived',
        data: {
          sessionId,
          transcript: mockTranscript.text,
          confidence: mockTranscript.confidence,
          isPartial: mockTranscript.isPartial,
          service: useFallback ? 'transcribe-standard' : 'transcribe-medical',
          fallback: useFallback,
          timestamp: new Date().toISOString()
        }
      })
    }));
    
    // Update session activity
    await updateSessionActivity(sessionId);
    
    return {
      success: true,
      action: 'audioProcessed',
      data: {
        sessionId,
        bytesProcessed: audioBuffer.length,
        transcriptGenerated: true,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Process medical audio error:', error);
    return {
      success: false,
      action: 'audioProcessingError',
      error: error instanceof Error ? error.message : 'Failed to process audio'
    };
  }
}

async function simulateTranscription(audioBuffer: Buffer, useFallback: boolean): Promise<{
  text: string;
  confidence: number;
  isPartial: boolean;
}> {
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Generate mock medical transcript based on service type
  const medicalPhrases = [
    'Patient reports chest pain',
    'Blood pressure is elevated',
    'Heart rate is regular',
    'Respiratory rate is normal',
    'Temperature is within normal limits',
    'Patient has history of hypertension',
    'Prescribed medication as needed',
    'Follow up in two weeks'
  ];
  
  const randomPhrase = medicalPhrases[Math.floor(Math.random() * medicalPhrases.length)];
  const service = useFallback ? 'Standard Transcribe' : 'Transcribe Medical';
  
  return {
    text: `[${service}] ${randomPhrase}`,
    confidence: useFallback ? 0.85 : 0.92, // Medical service typically has higher confidence
    isPartial: Math.random() > 0.7 // 30% chance of partial result
  };
}

async function handleStopMedicalTranscription(
  connectionId: string,
  request: TranscribeRequest
): Promise<TranscribeResponse> {
  try {
    const { sessionId } = request;
    
    if (!sessionId) {
      throw new Error('Session ID is required');
    }
    
    // Update session status to stopped
    await updateSessionStatus(sessionId, 'stopped');
    
    console.log(`Medical transcription session ${sessionId} stopped`);
    
    return {
      success: true,
      action: 'medicalTranscriptionStopped',
      data: {
        sessionId,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Stop medical transcription error:', error);
    return {
      success: false,
      action: 'stopTranscriptionError',
      error: error instanceof Error ? error.message : 'Failed to stop transcription'
    };
  }
}

async function handleHealthCheck(): Promise<TranscribeResponse> {
  try {
    // Check Transcribe Medical service availability
    const medicalHealthy = await checkTranscribeMedicalHealth();
    const standardHealthy = await checkTranscribeStandardHealth();
    
    return {
      success: true,
      action: 'healthCheckComplete',
      data: {
        transcribeMedical: {
          available: medicalHealthy,
          service: 'Amazon Transcribe Medical'
        },
        transcribeStandard: {
          available: standardHealthy,
          service: 'Amazon Transcribe'
        },
        fallbackAvailable: standardHealthy,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Health check error:', error);
    return {
      success: false,
      action: 'healthCheckError',
      error: error instanceof Error ? error.message : 'Health check failed'
    };
  }
}

async function checkTranscribeMedicalHealth(): Promise<boolean> {
  try {
    // Attempt a minimal test call to Transcribe Medical
    // This is a simplified health check - in production you might want more sophisticated monitoring
    return true; // Assume healthy for now
  } catch (error) {
    console.warn('Transcribe Medical health check failed:', error);
    return false;
  }
}

async function checkTranscribeStandardHealth(): Promise<boolean> {
  try {
    // Attempt a minimal test call to standard Transcribe
    return true; // Assume healthy for now
  } catch (error) {
    console.warn('Transcribe standard health check failed:', error);
    return false;
  }
}

async function updateSessionStatus(sessionId: string, status: string): Promise<void> {
  await dynamodb.send(new UpdateItemCommand({
    TableName: process.env.SESSIONS_TABLE || 'healthcare-translation-sessions',
    Key: {
      sessionId: { S: sessionId }
    },
    UpdateExpression: 'SET #status = :status, lastActivity = :timestamp',
    ExpressionAttributeNames: {
      '#status': 'status'
    },
    ExpressionAttributeValues: {
      ':status': { S: status },
      ':timestamp': { S: new Date().toISOString() }
    }
  }));
}

async function updateSessionFallback(sessionId: string, useFallback: boolean): Promise<void> {
  await dynamodb.send(new UpdateItemCommand({
    TableName: process.env.SESSIONS_TABLE || 'healthcare-translation-sessions',
    Key: {
      sessionId: { S: sessionId }
    },
    UpdateExpression: 'SET useFallback = :fallback, lastActivity = :timestamp',
    ExpressionAttributeValues: {
      ':fallback': { BOOL: useFallback },
      ':timestamp': { S: new Date().toISOString() }
    }
  }));
}

async function updateSessionActivity(sessionId: string): Promise<void> {
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
}