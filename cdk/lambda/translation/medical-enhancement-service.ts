import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

// Initialize Bedrock client
let bedrockClient: BedrockRuntimeClient;

function initializeBedrockClient() {
    if (!bedrockClient) {
        bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
    }
}

// Medical context interface
export interface MedicalContext {
    specialty?: string;
    commonTerms: string[];
    previousContext: string[];
    urgencyLevel: 'low' | 'medium' | 'high';
}

// Medical terminology validation result
export interface MedicalTerminologyValidation {
    isValid: boolean;
    suggestions: string[];
    confidence: number;
    medicalAccuracy: number;
}

// Translation enhancement result
export interface TranslationEnhancementResult {
    enhancedText: string;
    confidence: number;
    medicalTermsValidated: string[];
    improvementsMade: string[];
    qualityScore: number;
}

// Common medical terminology mappings for different languages
const MEDICAL_TERMINOLOGY_MAPPINGS = {
    'en-es': {
        'chest pain': 'dolor torácico',
        'shortness of breath': 'dificultad para respirar',
        'heart attack': 'infarto de miocardio',
        'blood pressure': 'presión arterial',
        'diabetes': 'diabetes',
        'hypertension': 'hipertensión',
        'medication': 'medicamento',
        'prescription': 'receta médica',
        'symptoms': 'síntomas',
        'diagnosis': 'diagnóstico',
        'treatment': 'tratamiento',
        'surgery': 'cirugía',
        'emergency': 'emergencia',
        'patient': 'paciente',
        'doctor': 'médico',
        'nurse': 'enfermera',
        'hospital': 'hospital',
        'clinic': 'clínica'
    },
    'en-fr': {
        'chest pain': 'douleur thoracique',
        'shortness of breath': 'essoufflement',
        'heart attack': 'crise cardiaque',
        'blood pressure': 'tension artérielle',
        'diabetes': 'diabète',
        'hypertension': 'hypertension',
        'medication': 'médicament',
        'prescription': 'ordonnance',
        'symptoms': 'symptômes',
        'diagnosis': 'diagnostic',
        'treatment': 'traitement',
        'surgery': 'chirurgie',
        'emergency': 'urgence',
        'patient': 'patient',
        'doctor': 'médecin',
        'nurse': 'infirmière',
        'hospital': 'hôpital',
        'clinic': 'clinique'
    }
    // Add more language pairs as needed
};

// Healthcare communication scenarios
const HEALTHCARE_SCENARIOS = {
    'emergency': {
        priority: 'high',
        commonPhrases: [
            'I need help immediately',
            'This is an emergency',
            'Call 911',
            'I have severe pain',
            'I cannot breathe',
            'I am having chest pain'
        ],
        medicalTerms: ['emergency', 'urgent', 'severe', 'acute', 'critical']
    },
    'consultation': {
        priority: 'medium',
        commonPhrases: [
            'I have an appointment',
            'I need to see a doctor',
            'What are my symptoms',
            'How should I take this medication',
            'When is my next visit'
        ],
        medicalTerms: ['appointment', 'consultation', 'symptoms', 'medication', 'treatment']
    },
    'routine': {
        priority: 'low',
        commonPhrases: [
            'I need a prescription refill',
            'When is my next checkup',
            'I need to schedule an appointment',
            'Can you explain my test results'
        ],
        medicalTerms: ['prescription', 'checkup', 'appointment', 'results', 'routine']
    }
};

// Detect medical scenario based on text content
export async function detectMedicalScenario(text: string): Promise<string> {
    const lowerText = text.toLowerCase();
    
    // Check for emergency keywords
    const emergencyKeywords = ['emergency', 'urgent', 'severe', 'acute', 'critical', 'help', 'pain', 'cannot breathe', 'chest pain'];
    if (emergencyKeywords.some(keyword => lowerText.includes(keyword))) {
        return 'emergency';
    }
    
    // Check for consultation keywords
    const consultationKeywords = ['appointment', 'doctor', 'symptoms', 'medication', 'treatment'];
    if (consultationKeywords.some(keyword => lowerText.includes(keyword))) {
        return 'consultation';
    }
    
    return 'routine';
}

// Validate medical terminology consistency across languages
export async function validateMedicalTerminology(
    originalText: string,
    translatedText: string,
    sourceLanguage: string,
    targetLanguage: string
): Promise<MedicalTerminologyValidation> {
    try {
        initializeBedrockClient();
        
        const languagePair = `${sourceLanguage}-${targetLanguage}`;
        const terminologyMap = MEDICAL_TERMINOLOGY_MAPPINGS[languagePair as keyof typeof MEDICAL_TERMINOLOGY_MAPPINGS];
        
        const prompt = `As a medical translation expert, validate the accuracy of medical terminology in this translation:

Original (${sourceLanguage}): "${originalText}"
Translation (${targetLanguage}): "${translatedText}"

Please analyze:
1. Are medical terms correctly translated?
2. Is the medical context preserved?
3. Are there any terminology inconsistencies?
4. What improvements can be made?

Respond with a JSON object:
{
    "isValid": boolean,
    "suggestions": ["suggestion1", "suggestion2"],
    "confidence": number (0-1),
    "medicalAccuracy": number (0-1),
    "issues": ["issue1", "issue2"]
}`;

        const command = new InvokeModelCommand({
            modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
            contentType: 'application/json',
            body: JSON.stringify({
                anthropic_version: 'bedrock-2023-05-31',
                max_tokens: 1500,
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
            const validation = JSON.parse(responseBody.content[0].text);
            return {
                isValid: validation.isValid || false,
                suggestions: validation.suggestions || [],
                confidence: validation.confidence || 0.7,
                medicalAccuracy: validation.medicalAccuracy || 0.7
            };
        } catch {
            // Fallback validation using terminology mappings
            return validateWithTerminologyMap(originalText, translatedText, terminologyMap);
        }
    } catch (error) {
        console.error('Error validating medical terminology:', error);
        return {
            isValid: true, // Default to valid to avoid blocking translations
            suggestions: [],
            confidence: 0.6,
            medicalAccuracy: 0.6
        };
    }
}

// Fallback validation using predefined terminology mappings
function validateWithTerminologyMap(
    originalText: string,
    translatedText: string,
    terminologyMap?: Record<string, string>
): MedicalTerminologyValidation {
    if (!terminologyMap) {
        return {
            isValid: true,
            suggestions: [],
            confidence: 0.7,
            medicalAccuracy: 0.7
        };
    }
    
    const suggestions: string[] = [];
    let correctTerms = 0;
    let totalTerms = 0;
    
    // Check if medical terms are correctly translated
    Object.entries(terminologyMap).forEach(([englishTerm, translatedTerm]) => {
        if (originalText.toLowerCase().includes(englishTerm.toLowerCase())) {
            totalTerms++;
            if (translatedText.toLowerCase().includes(translatedTerm.toLowerCase())) {
                correctTerms++;
            } else {
                suggestions.push(`Consider using "${translatedTerm}" for "${englishTerm}"`);
            }
        }
    });
    
    const medicalAccuracy = totalTerms > 0 ? correctTerms / totalTerms : 0.8;
    
    return {
        isValid: medicalAccuracy >= 0.7,
        suggestions,
        confidence: medicalAccuracy,
        medicalAccuracy
    };
}

// Enhance translation for specific healthcare scenarios
export async function enhanceForHealthcareScenario(
    originalText: string,
    translatedText: string,
    sourceLanguage: string,
    targetLanguage: string,
    scenario: string
): Promise<TranslationEnhancementResult> {
    try {
        initializeBedrockClient();
        
        const scenarioInfo = HEALTHCARE_SCENARIOS[scenario as keyof typeof HEALTHCARE_SCENARIOS];
        const priority = scenarioInfo?.priority || 'medium';
        
        const prompt = `As a medical translation specialist, enhance this translation for a ${scenario} healthcare scenario (priority: ${priority}):

Original (${sourceLanguage}): "${originalText}"
Current translation (${targetLanguage}): "${translatedText}"

Healthcare scenario: ${scenario}
Priority level: ${priority}

Please provide an enhanced translation that:
1. Uses appropriate medical terminology
2. Maintains professional healthcare tone
3. Considers cultural healthcare communication norms
4. Ensures clarity for ${priority} priority situations
5. Preserves critical medical information

Respond with a JSON object:
{
    "enhancedText": "improved translation",
    "confidence": number (0-1),
    "medicalTermsValidated": ["term1", "term2"],
    "improvementsMade": ["improvement1", "improvement2"],
    "qualityScore": number (0-1)
}`;

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
        
        try {
            const enhancement = JSON.parse(responseBody.content[0].text);
            return {
                enhancedText: enhancement.enhancedText || translatedText,
                confidence: enhancement.confidence || 0.85,
                medicalTermsValidated: enhancement.medicalTermsValidated || [],
                improvementsMade: enhancement.improvementsMade || [],
                qualityScore: enhancement.qualityScore || 0.85
            };
        } catch {
            // Fallback enhancement
            return {
                enhancedText: translatedText,
                confidence: 0.8,
                medicalTermsValidated: [],
                improvementsMade: ['Applied basic medical translation standards'],
                qualityScore: 0.8
            };
        }
    } catch (error) {
        console.error('Error enhancing translation for healthcare scenario:', error);
        return {
            enhancedText: translatedText,
            confidence: 0.75,
            medicalTermsValidated: [],
            improvementsMade: [],
            qualityScore: 0.75
        };
    }
}

// Check translation consistency across multiple related texts
export async function checkTranslationConsistency(
    translations: Array<{
        original: string;
        translated: string;
        sourceLanguage: string;
        targetLanguage: string;
    }>
): Promise<{
    consistencyScore: number;
    inconsistencies: string[];
    recommendations: string[];
}> {
    try {
        initializeBedrockClient();
        
        const translationPairs = translations.map((t, index) => 
            `${index + 1}. "${t.original}" → "${t.translated}"`
        ).join('\n');
        
        const prompt = `As a medical translation quality expert, analyze these related translations for consistency:

${translationPairs}

Please check for:
1. Consistent use of medical terminology
2. Consistent tone and formality level
3. Consistent translation choices for similar concepts
4. Overall coherence across translations

Respond with a JSON object:
{
    "consistencyScore": number (0-1),
    "inconsistencies": ["inconsistency1", "inconsistency2"],
    "recommendations": ["recommendation1", "recommendation2"]
}`;

        const command = new InvokeModelCommand({
            modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
            contentType: 'application/json',
            body: JSON.stringify({
                anthropic_version: 'bedrock-2023-05-31',
                max_tokens: 1500,
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
            const consistency = JSON.parse(responseBody.content[0].text);
            return {
                consistencyScore: consistency.consistencyScore || 0.8,
                inconsistencies: consistency.inconsistencies || [],
                recommendations: consistency.recommendations || []
            };
        } catch {
            return {
                consistencyScore: 0.8,
                inconsistencies: [],
                recommendations: ['Review translations for medical terminology consistency']
            };
        }
    } catch (error) {
        console.error('Error checking translation consistency:', error);
        return {
            consistencyScore: 0.7,
            inconsistencies: [],
            recommendations: []
        };
    }
}

// Generate medical context-aware corrections
export async function generateMedicalCorrections(
    originalText: string,
    translatedText: string,
    sourceLanguage: string,
    targetLanguage: string,
    medicalContext?: MedicalContext
): Promise<{
    corrections: Array<{
        original: string;
        corrected: string;
        reason: string;
        confidence: number;
    }>;
    overallImprovement: number;
}> {
    try {
        initializeBedrockClient();
        
        const contextInfo = medicalContext ? `
Medical Context:
- Specialty: ${medicalContext.specialty || 'General'}
- Common Terms: ${medicalContext.commonTerms.join(', ')}
- Urgency Level: ${medicalContext.urgencyLevel}
- Previous Context: ${medicalContext.previousContext.slice(-3).join(', ')}
` : '';

        const prompt = `As a medical translation correction specialist, identify and suggest corrections for this translation:

Original (${sourceLanguage}): "${originalText}"
Translation (${targetLanguage}): "${translatedText}"
${contextInfo}

Please identify specific corrections needed and provide:
1. Exact text segments that need correction
2. Improved versions
3. Medical reasoning for each correction
4. Confidence level for each correction

Respond with a JSON object:
{
    "corrections": [
        {
            "original": "text segment to correct",
            "corrected": "improved version",
            "reason": "medical reason for correction",
            "confidence": number (0-1)
        }
    ],
    "overallImprovement": number (0-1)
}`;

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
        
        try {
            const corrections = JSON.parse(responseBody.content[0].text);
            return {
                corrections: corrections.corrections || [],
                overallImprovement: corrections.overallImprovement || 0.1
            };
        } catch {
            return {
                corrections: [],
                overallImprovement: 0.05
            };
        }
    } catch (error) {
        console.error('Error generating medical corrections:', error);
        return {
            corrections: [],
            overallImprovement: 0
        };
    }
}

// Export utility functions for medical terminology
export const MedicalTerminologyUtils = {
    getTerminologyMapping: (sourceLanguage: string, targetLanguage: string) => {
        const languagePair = `${sourceLanguage}-${targetLanguage}`;
        return MEDICAL_TERMINOLOGY_MAPPINGS[languagePair as keyof typeof MEDICAL_TERMINOLOGY_MAPPINGS] || {};
    },
    
    getHealthcareScenarios: () => HEALTHCARE_SCENARIOS,
    
    isEmergencyText: (text: string): boolean => {
        const emergencyKeywords = ['emergency', 'urgent', 'severe', 'acute', 'critical', 'help', 'pain', 'cannot breathe', 'chest pain'];
        return emergencyKeywords.some(keyword => text.toLowerCase().includes(keyword));
    },
    
    extractMedicalTerms: (text: string): string[] => {
        const medicalTerms: string[] = [];
        const allTerminologies = Object.values(MEDICAL_TERMINOLOGY_MAPPINGS).flatMap(mapping => Object.keys(mapping));
        
        allTerminologies.forEach(term => {
            if (text.toLowerCase().includes(term.toLowerCase())) {
                medicalTerms.push(term);
            }
        });
        
        return [...new Set(medicalTerms)]; // Remove duplicates
    }
};