import { TranscribeClient, CreateVocabularyCommand, GetVocabularyCommand, VocabularyState } from '@aws-sdk/client-transcribe';

const transcribeClient = new TranscribeClient({});

// Medical vocabulary terms for better transcription accuracy
const MEDICAL_VOCABULARY_TERMS = [
  // Common medical terms
  'acetaminophen', 'ibuprofen', 'aspirin', 'antibiotic', 'antihistamine',
  'hypertension', 'diabetes', 'asthma', 'pneumonia', 'bronchitis',
  'cardiovascular', 'respiratory', 'gastrointestinal', 'neurological',
  'dermatological', 'orthopedic', 'oncological', 'psychiatric',
  
  // Body parts and systems
  'cardiovascular', 'pulmonary', 'hepatic', 'renal', 'neurologic',
  'musculoskeletal', 'integumentary', 'endocrine', 'hematologic',
  'immunologic', 'reproductive', 'urogenital',
  
  // Common symptoms
  'dyspnea', 'tachycardia', 'bradycardia', 'hypertensive', 'hypotensive',
  'febrile', 'afebrile', 'nauseous', 'dizzy', 'fatigue', 'malaise',
  'syncope', 'palpitations', 'chest pain', 'abdominal pain',
  
  // Medical procedures
  'electrocardiogram', 'echocardiogram', 'computed tomography', 'magnetic resonance',
  'ultrasound', 'x-ray', 'blood pressure', 'pulse oximetry',
  'intubation', 'catheterization', 'biopsy', 'endoscopy',
  
  // Medications and dosages
  'milligrams', 'micrograms', 'milliliters', 'intravenous', 'intramuscular',
  'subcutaneous', 'oral', 'topical', 'sublingual', 'rectal',
  'twice daily', 'three times daily', 'four times daily', 'as needed',
  
  // Medical specialties
  'cardiology', 'pulmonology', 'gastroenterology', 'neurology',
  'orthopedics', 'dermatology', 'psychiatry', 'oncology',
  'endocrinology', 'rheumatology', 'nephrology', 'urology',
  
  // Emergency terms
  'emergency', 'urgent', 'stat', 'code blue', 'code red',
  'resuscitation', 'defibrillation', 'epinephrine', 'atropine',
  'naloxone', 'glucose', 'insulin', 'oxygen',
  
  // Common abbreviations (spelled out)
  'blood pressure', 'heart rate', 'respiratory rate', 'temperature',
  'oxygen saturation', 'body mass index', 'complete blood count',
  'comprehensive metabolic panel', 'lipid panel', 'thyroid function'
];

interface VocabularyCreationResult {
  success: boolean;
  vocabularyName: string;
  state?: VocabularyState;
  error?: string;
}

export const handler = async (): Promise<VocabularyCreationResult> => {
  const vocabularyName = 'medical-vocabulary';
  
  try {
    console.log('Creating medical vocabulary for Transcribe fallback system...');
    
    // Check if vocabulary already exists
    try {
      const getVocabularyResponse = await transcribeClient.send(new GetVocabularyCommand({
        VocabularyName: vocabularyName
      }));
      
      if (getVocabularyResponse.VocabularyState === VocabularyState.READY) {
        console.log('Medical vocabulary already exists and is ready');
        return {
          success: true,
          vocabularyName,
          state: getVocabularyResponse.VocabularyState
        };
      } else if (getVocabularyResponse.VocabularyState === VocabularyState.PENDING) {
        console.log('Medical vocabulary creation is in progress');
        return {
          success: true,
          vocabularyName,
          state: getVocabularyResponse.VocabularyState
        };
      }
    } catch (error) {
      // Vocabulary doesn't exist, we'll create it
      console.log('Medical vocabulary does not exist, creating new one...');
    }
    
    // Create the vocabulary
    const createVocabularyCommand = new CreateVocabularyCommand({
      VocabularyName: vocabularyName,
      LanguageCode: 'en-US', // Primary language for medical terms
      Phrases: MEDICAL_VOCABULARY_TERMS
    });
    
    const createResponse = await transcribeClient.send(createVocabularyCommand);
    
    console.log('Medical vocabulary creation initiated:', createResponse);
    
    return {
      success: true,
      vocabularyName,
      state: createResponse.VocabularyState
    };
  } catch (error) {
    console.error('Failed to create medical vocabulary:', error);
    
    return {
      success: false,
      vocabularyName,
      error: error instanceof Error ? error.message : 'Unknown error creating vocabulary'
    };
  }
};

// Function to get vocabulary status
export const getVocabularyStatus = async (vocabularyName: string = 'medical-vocabulary'): Promise<VocabularyCreationResult> => {
  try {
    const response = await transcribeClient.send(new GetVocabularyCommand({
      VocabularyName: vocabularyName
    }));
    
    return {
      success: true,
      vocabularyName,
      state: response.VocabularyState
    };
  } catch (error) {
    console.error('Failed to get vocabulary status:', error);
    
    return {
      success: false,
      vocabularyName,
      error: error instanceof Error ? error.message : 'Unknown error getting vocabulary status'
    };
  }
};

// Function to add more medical terms to the vocabulary
export const updateMedicalVocabulary = async (additionalTerms: string[]): Promise<VocabularyCreationResult> => {
  const vocabularyName = 'medical-vocabulary';
  
  try {
    const allTerms = [...MEDICAL_VOCABULARY_TERMS, ...additionalTerms];
    
    const createVocabularyCommand = new CreateVocabularyCommand({
      VocabularyName: `${vocabularyName}-updated-${Date.now()}`,
      LanguageCode: 'en-US',
      Phrases: allTerms
    });
    
    const response = await transcribeClient.send(createVocabularyCommand);
    
    return {
      success: true,
      vocabularyName: `${vocabularyName}-updated-${Date.now()}`,
      state: response.VocabularyState
    };
  } catch (error) {
    console.error('Failed to update medical vocabulary:', error);
    
    return {
      success: false,
      vocabularyName,
      error: error instanceof Error ? error.message : 'Unknown error updating vocabulary'
    };
  }
};