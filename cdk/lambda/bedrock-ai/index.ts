import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand
} from '@aws-sdk/client-bedrock-runtime';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { DynamoDBClient, GetItemCommand, UpdateItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { MedicalContextService, MedicalContext } from './medical-context-service';

const bedrockClient = new BedrockRuntimeClient({});
const dynamodb = new DynamoDBClient({});
const medicalContextService = new MedicalContextService();

interface BedrockRequest {
  action: string;
  sessionId: string;
  text: string;
  inputLanguage?: string;
  outputLanguage?: string;
  medicalContext?: MedicalContext;
  requestId?: string;
  translations?: Array<{ original: string; translated: string; language: string }>;
}

interface BedrockResponse {
  success: boolean;
  action: string;
  data?: any;
  error?: string;
  requestId?: string;
}



interface EnhancementSession {
  sessionId: string;
  connectionId: string;
  inputLanguage: string;
  outputLanguage?: string;
  medicalContext: MedicalContext;
  enhancementHistory: EnhancementRecord[];
  confidenceThreshold: number;
  createdAt: string;
  lastActivity: string;
}

interface EnhancementRecord {
  id: string;
  originalText: string;
  enhancedText: string;
  enhancementType: 'normalization' | 'translation' | 'context-aware';
  confidence: number;
  medicalTermsDetected: string[];
  timestamp: string;
}

// Medical terminology patterns for detection
const MEDICAL_TERM_PATTERNS = {
  symptoms: [
    'chest pain', 'shortness of breath', 'headache', 'nausea', 'vomiting',
    'fever', 'cough', 'fatigue', 'dizziness', 'abdominal pain'
  ],
  conditions: [
    'hypertension', 'diabetes', 'asthma', 'pneumonia', 'bronchitis',
    'myocardial infarction', 'stroke', 'sepsis', 'pneumothorax'
  ],
  medications: [
    'aspirin', 'ibuprofen', 'acetaminophen', 'lisinopril', 'metformin',
    'albuterol', 'prednisone', 'amoxicillin', 'warfarin', 'insulin'
  ],
  procedures: [
    'ecg', 'x-ray', 'ct scan', 'mri', 'ultrasound', 'blood test',
    'biopsy', 'endoscopy', 'catheterization', 'intubation'
  ]
};

// Bedrock model configurations
const BEDROCK_MODELS = {
  CLAUDE_3_HAIKU: 'anthropic.claude-3-haiku-20240307-v1:0',
  CLAUDE_3_SONNET: 'anthropic.claude-3-sonnet-20240229-v1:0',
  TITAN_TEXT: 'amazon.titan-text-express-v1'
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Bedrock AI event:', JSON.stringify(event, null, 2));

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
    const body: BedrockRequest = JSON.parse(event.body || '{}');
    const { action, sessionId, requestId } = body;

    console.log(`Processing Bedrock AI action: ${action} for session: ${sessionId}`);

    let response: BedrockResponse = {
      success: true,
      action: `${action}Response`,
      requestId
    };

    switch (action) {
      case 'enhanceTranscript':
        response = await handleEnhanceTranscript(connectionId, body, apiGateway);
        break;
      case 'normalizeTerminology':
        response = await handleNormalizeTerminology(connectionId, body, apiGateway);
        break;
      case 'enhanceTranslation':
        response = await handleEnhanceTranslation(connectionId, body, apiGateway);
        break;
      case 'detectMedicalContext':
        response = await handleDetectMedicalContext(connectionId, body, apiGateway);
        break;
      case 'scoreConfidence':
        response = await handleScoreConfidence(connectionId, body, apiGateway);
        break;
      case 'checkTerminologyConsistency':
        response = await handleCheckTerminologyConsistency(connectionId, body, apiGateway);
        break;
      case 'enhanceContextWithAI':
        response = await handleEnhanceContextWithAI(connectionId, body, apiGateway);
        break;
      default:
        response = {
          success: false,
          action: 'error',
          error: `Unknown Bedrock AI action: ${action}`,
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
      body: JSON.stringify({ message: 'Bedrock AI request processed successfully' })
    };
  } catch (error) {
    console.error('Bedrock AI processing error:', error);

    try {
      const errorResponse: BedrockResponse = {
        success: false,
        action: 'bedrockError',
        error: error instanceof Error ? error.message : 'Unknown Bedrock AI error'
      };

      await apiGateway.send(new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: JSON.stringify(errorResponse)
      }));
    } catch (sendError) {
      console.error('Failed to send Bedrock AI error response:', sendError);
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to process Bedrock AI request' })
    };
  }
};

async function handleEnhanceTranscript(
  connectionId: string,
  request: BedrockRequest,
  apiGateway: ApiGatewayManagementApiClient
): Promise<BedrockResponse> {
  try {
    const { sessionId, text, medicalContext } = request;

    if (!text || text.trim().length === 0) {
      throw new Error('Text is required for transcript enhancement');
    }

    // Detect medical terms in the original text
    const detectedTerms = detectMedicalTerms(text);

    // Create enhancement prompt for medical transcript normalization
    const enhancementPrompt = createTranscriptEnhancementPrompt(text, medicalContext, detectedTerms);

    // Call Bedrock for transcript enhancement
    const enhancedResult = await invokeBedrockModel(
      BEDROCK_MODELS.CLAUDE_3_HAIKU,
      enhancementPrompt,
      {
        max_tokens: 1000,
        temperature: 0.1, // Low temperature for consistent medical terminology
        top_p: 0.9
      }
    );

    // Parse the enhanced transcript
    const enhancedText = parseEnhancementResult(enhancedResult);

    // Calculate confidence score
    const confidence = calculateEnhancementConfidence(text, enhancedText, detectedTerms);

    // Store enhancement record
    const enhancementRecord: EnhancementRecord = {
      id: generateId(),
      originalText: text,
      enhancedText,
      enhancementType: 'normalization',
      confidence,
      medicalTermsDetected: detectedTerms,
      timestamp: new Date().toISOString()
    };

    await storeEnhancementRecord(sessionId, enhancementRecord);

    return {
      success: true,
      action: 'transcriptEnhanced',
      data: {
        sessionId,
        originalText: text,
        enhancedText,
        confidence,
        medicalTermsDetected: detectedTerms,
        enhancementType: 'normalization',
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Enhance transcript error:', error);
    return {
      success: false,
      action: 'enhanceTranscriptError',
      error: error instanceof Error ? error.message : 'Failed to enhance transcript'
    };
  }
}

async function handleNormalizeTerminology(
  connectionId: string,
  request: BedrockRequest,
  apiGateway: ApiGatewayManagementApiClient
): Promise<BedrockResponse> {
  try {
    const { sessionId, text, medicalContext } = request;

    if (!text || text.trim().length === 0) {
      throw new Error('Text is required for terminology normalization');
    }

    // Detect medical terms that need normalization
    const detectedTerms = detectMedicalTerms(text);

    // Create normalization prompt
    const normalizationPrompt = createTerminologyNormalizationPrompt(text, medicalContext, detectedTerms);

    // Call Bedrock for terminology normalization
    const normalizedResult = await invokeBedrockModel(
      BEDROCK_MODELS.CLAUDE_3_HAIKU,
      normalizationPrompt,
      {
        max_tokens: 800,
        temperature: 0.05, // Very low temperature for consistent terminology
        top_p: 0.8
      }
    );

    // Parse the normalized text
    const normalizedText = parseNormalizationResult(normalizedResult);

    // Calculate confidence score
    const confidence = calculateNormalizationConfidence(text, normalizedText, detectedTerms);

    return {
      success: true,
      action: 'terminologyNormalized',
      data: {
        sessionId,
        originalText: text,
        normalizedText,
        confidence,
        medicalTermsDetected: detectedTerms,
        normalizedTerms: extractNormalizedTerms(text, normalizedText),
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Normalize terminology error:', error);
    return {
      success: false,
      action: 'normalizeTerminologyError',
      error: error instanceof Error ? error.message : 'Failed to normalize terminology'
    };
  }
}

async function handleEnhanceTranslation(
  connectionId: string,
  request: BedrockRequest,
  apiGateway: ApiGatewayManagementApiClient
): Promise<BedrockResponse> {
  try {
    const { sessionId, text, inputLanguage, outputLanguage, medicalContext } = request;

    if (!text || !inputLanguage || !outputLanguage) {
      throw new Error('Text, input language, and output language are required for translation enhancement');
    }

    // Detect medical context in the source text
    const detectedTerms = detectMedicalTerms(text);
    const contextInfo = analyzeMedicalContext(text, medicalContext);

    // Create context-aware translation enhancement prompt
    const translationPrompt = createTranslationEnhancementPrompt(
      text,
      inputLanguage,
      outputLanguage,
      contextInfo,
      detectedTerms
    );

    // Call Bedrock for context-aware translation enhancement
    const enhancedTranslationResult = await invokeBedrockModel(
      BEDROCK_MODELS.CLAUDE_3_SONNET, // Use more capable model for translation
      translationPrompt,
      {
        max_tokens: 1200,
        temperature: 0.2, // Slightly higher for natural language flow
        top_p: 0.9
      }
    );

    // Parse the enhanced translation
    const enhancedTranslation = parseTranslationResult(enhancedTranslationResult);

    // Calculate translation confidence
    const confidence = calculateTranslationConfidence(text, enhancedTranslation, detectedTerms);

    return {
      success: true,
      action: 'translationEnhanced',
      data: {
        sessionId,
        originalText: text,
        enhancedTranslation,
        inputLanguage,
        outputLanguage,
        confidence,
        medicalContext: contextInfo,
        medicalTermsDetected: detectedTerms,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Enhance translation error:', error);
    return {
      success: false,
      action: 'enhanceTranslationError',
      error: error instanceof Error ? error.message : 'Failed to enhance translation'
    };
  }
}

async function handleDetectMedicalContext(
  connectionId: string,
  request: BedrockRequest,
  apiGateway: ApiGatewayManagementApiClient
): Promise<BedrockResponse> {
  try {
    const { sessionId, text } = request;

    if (!text || text.trim().length === 0) {
      throw new Error('Text is required for medical context detection');
    }

    // Detect medical terms and context
    const detectedTerms = detectMedicalTerms(text);
    const contextAnalysis = analyzeMedicalContext(text);

    // Create context detection prompt
    const contextPrompt = createContextDetectionPrompt(text, detectedTerms);

    // Call Bedrock for advanced context analysis
    const contextResult = await invokeBedrockModel(
      BEDROCK_MODELS.CLAUDE_3_HAIKU,
      contextPrompt,
      {
        max_tokens: 600,
        temperature: 0.1,
        top_p: 0.8
      }
    );

    // Parse context analysis result
    const enhancedContext = parseContextResult(contextResult);

    return {
      success: true,
      action: 'medicalContextDetected',
      data: {
        sessionId,
        text,
        detectedTerms,
        contextAnalysis: {
          ...contextAnalysis,
          ...enhancedContext
        },
        confidence: calculateContextConfidence(detectedTerms, enhancedContext),
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Detect medical context error:', error);
    return {
      success: false,
      action: 'detectMedicalContextError',
      error: error instanceof Error ? error.message : 'Failed to detect medical context'
    };
  }
}

async function handleScoreConfidence(
  connectionId: string,
  request: BedrockRequest,
  apiGateway: ApiGatewayManagementApiClient
): Promise<BedrockResponse> {
  try {
    const { sessionId, text, medicalContext } = request;

    if (!text || text.trim().length === 0) {
      throw new Error('Text is required for confidence scoring');
    }

    // Use the medical context service for enhanced analysis
    const detectedTerms = medicalContextService.detectMedicalTerms(text);
    const contextAnalysis = medicalContextService.analyzeMedicalContext(text, medicalContext);

    // Calculate various confidence metrics
    const confidenceMetrics = {
      medicalTerminologyAccuracy: calculateTerminologyAccuracy(Object.values(detectedTerms).flat()),
      contextConsistency: calculateContextConsistency(text, contextAnalysis),
      linguisticQuality: calculateLinguisticQuality(text),
      medicalRelevance: calculateMedicalRelevance(text, Object.values(detectedTerms).flat()),
      overallConfidence: 0
    };

    // Calculate weighted overall confidence
    confidenceMetrics.overallConfidence = (
      confidenceMetrics.medicalTerminologyAccuracy * 0.3 +
      confidenceMetrics.contextConsistency * 0.25 +
      confidenceMetrics.linguisticQuality * 0.25 +
      confidenceMetrics.medicalRelevance * 0.2
    );

    return {
      success: true,
      action: 'confidenceScored',
      data: {
        sessionId,
        text,
        confidenceMetrics,
        detectedTerms,
        contextAnalysis,
        recommendations: generateConfidenceRecommendations(confidenceMetrics),
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Score confidence error:', error);
    return {
      success: false,
      action: 'scoreConfidenceError',
      error: error instanceof Error ? error.message : 'Failed to score confidence'
    };
  }
}

async function handleCheckTerminologyConsistency(
  connectionId: string,
  request: BedrockRequest,
  apiGateway: ApiGatewayManagementApiClient
): Promise<BedrockResponse> {
  try {
    const { sessionId, translations } = request;

    if (!translations || !Array.isArray(translations) || translations.length === 0) {
      throw new Error('Translations array is required for consistency checking');
    }

    // Use the medical context service for consistency analysis
    const consistencyResult = medicalContextService.checkTerminologyConsistency(translations);

    return {
      success: true,
      action: 'terminologyConsistencyChecked',
      data: {
        sessionId,
        consistencyScore: consistencyResult.consistencyScore,
        inconsistentTerms: consistencyResult.inconsistentTerms,
        recommendations: consistencyResult.recommendations,
        translationsAnalyzed: translations.length,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Check terminology consistency error:', error);
    return {
      success: false,
      action: 'checkTerminologyConsistencyError',
      error: error instanceof Error ? error.message : 'Failed to check terminology consistency'
    };
  }
}

async function handleEnhanceContextWithAI(
  connectionId: string,
  request: BedrockRequest,
  apiGateway: ApiGatewayManagementApiClient
): Promise<BedrockResponse> {
  try {
    const { sessionId, text, medicalContext } = request;

    if (!text || text.trim().length === 0) {
      throw new Error('Text is required for AI context enhancement');
    }

    // Get base context analysis
    const baseContext = medicalContextService.analyzeMedicalContext(text, medicalContext);

    // Enhance context using AI
    const enhancementResult = await medicalContextService.enhanceMedicalContext(text, baseContext);

    return {
      success: true,
      action: 'contextEnhancedWithAI',
      data: {
        sessionId,
        text,
        baseContext,
        enhancedContext: enhancementResult.enhancedContext,
        confidence: enhancementResult.confidence,
        detectedTerms: enhancementResult.detectedTerms,
        recommendations: enhancementResult.recommendations,
        consistencyScore: enhancementResult.consistencyScore,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Enhance context with AI error:', error);
    return {
      success: false,
      action: 'enhanceContextWithAIError',
      error: error instanceof Error ? error.message : 'Failed to enhance context with AI'
    };
  }
}

// Utility functions for Bedrock integration

async function invokeBedrockModel(
  modelId: string,
  prompt: string,
  parameters: any
): Promise<string> {
  try {
    const requestBody = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: parameters.max_tokens || 1000,
      temperature: parameters.temperature || 0.1,
      top_p: parameters.top_p || 0.9,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    };

    const command = new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(requestBody)
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    return responseBody.content[0].text;
  } catch (error) {
    console.error('Bedrock model invocation error:', error);
    throw new Error(`Failed to invoke Bedrock model: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function detectMedicalTerms(text: string): string[] {
  const detectedTerms: string[] = [];
  const lowerText = text.toLowerCase();

  // Check for medical terms in all categories
  Object.values(MEDICAL_TERM_PATTERNS).forEach(category => {
    category.forEach(term => {
      if (lowerText.includes(term.toLowerCase())) {
        detectedTerms.push(term);
      }
    });
  });

  return [...new Set(detectedTerms)]; // Remove duplicates
}

function analyzeMedicalContext(text: string, providedContext?: MedicalContext): any {
  const detectedTerms = detectMedicalTerms(text);

  // Determine likely medical specialty based on detected terms
  const specialtyIndicators = {
    cardiology: ['chest pain', 'heart rate', 'blood pressure', 'ecg', 'myocardial infarction'],
    neurology: ['headache', 'dizziness', 'stroke', 'seizure', 'neurological'],
    respiratory: ['shortness of breath', 'cough', 'pneumonia', 'asthma', 'respiratory'],
    emergency: ['trauma', 'emergency', 'urgent', 'critical', 'acute']
  };

  let likelySpecialty = 'general';
  let maxMatches = 0;

  Object.entries(specialtyIndicators).forEach(([specialty, indicators]) => {
    const matches = indicators.filter(indicator =>
      text.toLowerCase().includes(indicator.toLowerCase())
    ).length;

    if (matches > maxMatches) {
      maxMatches = matches;
      likelySpecialty = specialty;
    }
  });

  // Determine urgency level based on keywords
  const urgencyKeywords = {
    high: ['emergency', 'urgent', 'critical', 'severe', 'acute', 'immediate'],
    medium: ['moderate', 'concerning', 'significant', 'notable'],
    low: ['mild', 'slight', 'minor', 'routine', 'follow-up']
  };

  let urgencyLevel = 'medium';
  Object.entries(urgencyKeywords).forEach(([level, keywords]) => {
    if (keywords.some(keyword => text.toLowerCase().includes(keyword.toLowerCase()))) {
      urgencyLevel = level;
    }
  });

  return {
    detectedSpecialty: likelySpecialty,
    urgencyLevel,
    medicalTermsCount: detectedTerms.length,
    contextConfidence: Math.min(0.9, detectedTerms.length * 0.1 + 0.3),
    ...providedContext
  };
}

function createTranscriptEnhancementPrompt(
  text: string,
  medicalContext?: MedicalContext,
  detectedTerms?: string[]
): string {
  return `You are a medical transcription specialist. Please enhance the following medical transcript by:

1. Correcting any obvious transcription errors
2. Standardizing medical terminology to proper clinical terms
3. Ensuring proper medical abbreviations and formatting
4. Maintaining the original meaning and context

Original transcript: "${text}"

Medical context: ${medicalContext ? JSON.stringify(medicalContext) : 'General healthcare'}
Detected medical terms: ${detectedTerms ? detectedTerms.join(', ') : 'None specified'}

Please provide the enhanced transcript with improved medical accuracy while preserving the original clinical meaning. Focus on:
- Proper medical terminology
- Correct spelling of medical terms
- Appropriate clinical abbreviations
- Clear and professional language

Enhanced transcript:`;
}

function createTerminologyNormalizationPrompt(
  text: string,
  medicalContext?: MedicalContext,
  detectedTerms?: string[]
): string {
  return `You are a medical terminology expert. Please normalize the medical terms in the following text to standard clinical terminology:

Text: "${text}"

Medical context: ${medicalContext ? JSON.stringify(medicalContext) : 'General healthcare'}
Terms to normalize: ${detectedTerms ? detectedTerms.join(', ') : 'All medical terms'}

Please provide the text with normalized medical terminology, ensuring:
- Standard medical abbreviations (e.g., "MI" for myocardial infarction)
- Proper clinical terms (e.g., "hypertension" instead of "high blood pressure")
- Consistent terminology throughout
- Maintain original sentence structure and meaning

Normalized text:`;
}

function createTranslationEnhancementPrompt(
  text: string,
  inputLanguage: string,
  outputLanguage: string,
  contextInfo: any,
  detectedTerms: string[]
): string {
  return `You are a medical translation specialist. Please provide a context-aware translation that preserves medical accuracy:

Source text (${inputLanguage}): "${text}"
Target language: ${outputLanguage}
Medical context: ${JSON.stringify(contextInfo)}
Medical terms detected: ${detectedTerms.join(', ')}

Please provide a translation that:
- Maintains medical accuracy and terminology
- Uses appropriate medical terms in the target language
- Preserves clinical meaning and context
- Follows medical translation best practices
- Considers cultural healthcare communication norms

Enhanced translation (${outputLanguage}):`;
}

function createContextDetectionPrompt(text: string, detectedTerms: string[]): string {
  return `You are a medical context analysis expert. Please analyze the following medical text and provide detailed context information:

Text: "${text}"
Detected terms: ${detectedTerms.join(', ')}

Please provide analysis including:
- Medical specialty most relevant to this text
- Urgency level (low/medium/high)
- Key medical concepts mentioned
- Potential diagnoses or conditions referenced
- Treatment or procedure mentions
- Patient care context (emergency, routine, follow-up, etc.)

Provide your analysis in JSON format with clear categories and confidence levels.

Context analysis:`;
}

// Parsing and calculation utility functions

function parseEnhancementResult(result: string): string {
  // Extract the enhanced text from the Bedrock response
  const lines = result.split('\n');
  const enhancedLine = lines.find(line =>
    line.toLowerCase().includes('enhanced') ||
    line.toLowerCase().includes('improved') ||
    !line.toLowerCase().includes('original')
  );

  return enhancedLine ? enhancedLine.replace(/^[^:]*:?\s*/, '').trim() : result.trim();
}

function parseNormalizationResult(result: string): string {
  // Extract normalized text from the response
  const lines = result.split('\n');
  const normalizedLine = lines.find(line =>
    line.toLowerCase().includes('normalized') ||
    !line.toLowerCase().includes('text:')
  );

  return normalizedLine ? normalizedLine.replace(/^[^:]*:?\s*/, '').trim() : result.trim();
}

function parseTranslationResult(result: string): string {
  // Extract enhanced translation from the response
  const lines = result.split('\n');
  const translationLine = lines.find(line =>
    line.toLowerCase().includes('translation') ||
    line.toLowerCase().includes('enhanced') ||
    !line.toLowerCase().includes('source')
  );

  return translationLine ? translationLine.replace(/^[^:]*:?\s*/, '').trim() : result.trim();
}

function parseContextResult(result: string): any {
  try {
    // Try to parse JSON response
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.warn('Failed to parse context JSON, using text analysis');
  }

  // Fallback to text parsing
  return {
    specialty: extractSpecialty(result),
    urgency: extractUrgency(result),
    concepts: extractConcepts(result)
  };
}

// Confidence calculation functions

function calculateEnhancementConfidence(
  original: string,
  enhanced: string,
  detectedTerms: string[]
): number {
  let confidence = 0.5; // Base confidence

  // Increase confidence based on medical terms preserved
  const preservedTerms = detectedTerms.filter(term =>
    enhanced.toLowerCase().includes(term.toLowerCase())
  );
  confidence += (preservedTerms.length / Math.max(detectedTerms.length, 1)) * 0.3;

  // Increase confidence based on text improvement indicators
  if (enhanced.length > original.length * 0.8 && enhanced.length < original.length * 1.5) {
    confidence += 0.1; // Reasonable length change
  }

  // Check for medical terminology improvements
  if (enhanced.includes('mg') || enhanced.includes('ml') || enhanced.includes('°C')) {
    confidence += 0.1; // Contains proper medical units
  }

  return Math.min(0.95, confidence);
}

function calculateNormalizationConfidence(
  original: string,
  normalized: string,
  detectedTerms: string[]
): number {
  let confidence = 0.6; // Base confidence for normalization

  // Check if medical abbreviations are properly used
  const medicalAbbreviations = ['BP', 'HR', 'RR', 'T', 'O2', 'CO2', 'ECG', 'EKG'];
  const abbreviationsUsed = medicalAbbreviations.filter(abbr =>
    normalized.includes(abbr)
  ).length;

  confidence += Math.min(0.2, abbreviationsUsed * 0.05);

  // Check terminology consistency
  if (normalized.length >= original.length * 0.9) {
    confidence += 0.1; // Maintained content
  }

  return Math.min(0.9, confidence);
}

function calculateTranslationConfidence(
  original: string,
  translation: string,
  detectedTerms: string[]
): number {
  let confidence = 0.7; // Base confidence for translation

  // Medical terms should be appropriately translated or preserved
  const medicalTermsInTranslation = detectedTerms.filter(term => {
    // Check if term is preserved or appropriately translated
    return translation.toLowerCase().includes(term.toLowerCase()) ||
      translation.length > original.length * 0.8; // Reasonable translation length
  }).length;

  confidence += (medicalTermsInTranslation / Math.max(detectedTerms.length, 1)) * 0.2;

  return Math.min(0.9, confidence);
}

function calculateContextConfidence(detectedTerms: string[], enhancedContext: any): number {
  let confidence = 0.5;

  // More detected terms = higher confidence in context analysis
  confidence += Math.min(0.3, detectedTerms.length * 0.05);

  // Structured context analysis increases confidence
  if (enhancedContext && typeof enhancedContext === 'object') {
    confidence += 0.2;
  }

  return Math.min(0.85, confidence);
}

// Additional utility functions

function calculateTerminologyAccuracy(detectedTerms: string[]): number {
  // Base accuracy on number and quality of detected medical terms
  return Math.min(0.9, 0.5 + (detectedTerms.length * 0.1));
}

function calculateContextConsistency(text: string, contextAnalysis: any): number {
  // Analyze consistency between text content and detected context
  let consistency = 0.6;

  if (contextAnalysis.detectedSpecialty && contextAnalysis.detectedSpecialty !== 'general') {
    consistency += 0.2;
  }

  if (contextAnalysis.urgencyLevel && contextAnalysis.urgencyLevel !== 'medium') {
    consistency += 0.1;
  }

  return Math.min(0.9, consistency);
}

function calculateLinguisticQuality(text: string): number {
  // Basic linguistic quality assessment
  let quality = 0.5;

  // Check for proper sentence structure
  if (text.includes('.') || text.includes('?') || text.includes('!')) {
    quality += 0.2;
  }

  // Check for reasonable length
  if (text.length > 10 && text.length < 500) {
    quality += 0.2;
  }

  // Check for medical terminology presence
  const medicalWords = ['patient', 'diagnosis', 'treatment', 'symptoms', 'condition'];
  const medicalWordsFound = medicalWords.filter(word =>
    text.toLowerCase().includes(word)
  ).length;

  quality += Math.min(0.1, medicalWordsFound * 0.02);

  return Math.min(0.9, quality);
}

function calculateMedicalRelevance(text: string, detectedTerms: string[]): number {
  // Calculate how medically relevant the text is
  let relevance = 0.3;

  // Base relevance on detected medical terms
  relevance += Math.min(0.5, detectedTerms.length * 0.1);

  // Check for medical context indicators
  const medicalContextWords = ['patient', 'doctor', 'nurse', 'hospital', 'clinic', 'medical'];
  const contextWordsFound = medicalContextWords.filter(word =>
    text.toLowerCase().includes(word)
  ).length;

  relevance += Math.min(0.2, contextWordsFound * 0.05);

  return Math.min(0.9, relevance);
}

function generateConfidenceRecommendations(confidenceMetrics: any): string[] {
  const recommendations: string[] = [];

  if (confidenceMetrics.medicalTerminologyAccuracy < 0.7) {
    recommendations.push('Consider reviewing medical terminology for accuracy');
  }

  if (confidenceMetrics.contextConsistency < 0.6) {
    recommendations.push('Medical context may need clarification');
  }

  if (confidenceMetrics.linguisticQuality < 0.7) {
    recommendations.push('Text quality could be improved for better processing');
  }

  if (confidenceMetrics.medicalRelevance < 0.6) {
    recommendations.push('Content may not be medically relevant');
  }

  if (confidenceMetrics.overallConfidence > 0.8) {
    recommendations.push('High confidence - content is well-suited for medical translation');
  }

  return recommendations;
}

// Helper functions for context extraction

function extractSpecialty(text: string): string {
  const specialtyKeywords = {
    cardiology: ['heart', 'cardiac', 'chest pain', 'blood pressure'],
    neurology: ['brain', 'neurological', 'headache', 'stroke'],
    respiratory: ['lung', 'breathing', 'cough', 'respiratory'],
    emergency: ['emergency', 'urgent', 'trauma', 'critical']
  };

  for (const [specialty, keywords] of Object.entries(specialtyKeywords)) {
    if (keywords.some(keyword => text.toLowerCase().includes(keyword))) {
      return specialty;
    }
  }

  return 'general';
}

function extractUrgency(text: string): string {
  const urgencyKeywords = {
    high: ['emergency', 'urgent', 'critical', 'severe'],
    low: ['routine', 'mild', 'follow-up', 'stable']
  };

  for (const [level, keywords] of Object.entries(urgencyKeywords)) {
    if (keywords.some(keyword => text.toLowerCase().includes(keyword))) {
      return level;
    }
  }

  return 'medium';
}

function extractConcepts(text: string): string[] {
  const concepts: string[] = [];
  const conceptKeywords = [
    'diagnosis', 'treatment', 'symptoms', 'medication', 'procedure',
    'examination', 'test', 'condition', 'disease', 'therapy'
  ];

  conceptKeywords.forEach(concept => {
    if (text.toLowerCase().includes(concept)) {
      concepts.push(concept);
    }
  });

  return concepts;
}

function extractNormalizedTerms(original: string, normalized: string): string[] {
  // Simple extraction of terms that were changed during normalization
  const originalWords = original.toLowerCase().split(/\s+/);
  const normalizedWords = normalized.toLowerCase().split(/\s+/);

  const changes: string[] = [];

  // This is a simplified approach - in production you'd want more sophisticated diff analysis
  normalizedWords.forEach((word, index) => {
    if (originalWords[index] && originalWords[index] !== word) {
      changes.push(`${originalWords[index]} → ${word}`);
    }
  });

  return changes;
}

// Utility functions

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

async function storeEnhancementRecord(sessionId: string, record: EnhancementRecord): Promise<void> {
  try {
    await dynamodb.send(new PutItemCommand({
      TableName: process.env.SESSIONS_TABLE || 'healthcare-translation-sessions',
      Item: {
        sessionId: { S: sessionId },
        recordId: { S: record.id },
        recordType: { S: 'enhancement' },
        originalText: { S: record.originalText },
        enhancedText: { S: record.enhancedText },
        enhancementType: { S: record.enhancementType },
        confidence: { N: record.confidence.toString() },
        medicalTermsDetected: { SS: record.medicalTermsDetected },
        timestamp: { S: record.timestamp },
        ttl: { N: String(Math.floor(Date.now() / 1000) + 86400) } // 24 hours TTL
      }
    }));
  } catch (error) {
    console.error('Failed to store enhancement record:', error);
    // Don't throw - this is not critical for the main functionality
  }
}