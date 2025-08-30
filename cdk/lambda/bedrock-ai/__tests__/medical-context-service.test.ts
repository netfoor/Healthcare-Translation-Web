import { MedicalContextService, MedicalContext, DetectedMedicalTerms } from '../medical-context-service';

// Mock Bedrock client
jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn(() => ({
    send: jest.fn()
  })),
  InvokeModelCommand: jest.fn()
}));

describe('MedicalContextService', () => {
  let service: MedicalContextService;
  let mockBedrockSend: jest.Mock;

  beforeEach(() => {
    service = new MedicalContextService();
    
    // Mock Bedrock client send method
    const { BedrockRuntimeClient } = require('@aws-sdk/client-bedrock-runtime');
    const mockClient = new BedrockRuntimeClient();
    mockBedrockSend = mockClient.send as jest.Mock;
    
    // Setup default Bedrock response
    mockBedrockSend.mockResolvedValue({
      body: new TextEncoder().encode(JSON.stringify({
        content: [{
          text: JSON.stringify({
            specialty: 'cardiology',
            urgencyLevel: 'high',
            treatmentContext: 'emergency',
            differentialDiagnoses: ['myocardial infarction', 'unstable angina']
          })
        }]
      }))
    });
  });

  describe('detectMedicalTerms', () => {
    it('should detect symptoms in medical text', () => {
      const text = 'Patient reports chest pain and shortness of breath with nausea';
      const result = service.detectMedicalTerms(text);
      
      expect(result.symptoms).toContain('chest pain');
      expect(result.symptoms).toContain('shortness of breath');
      expect(result.symptoms).toContain('nausea');
    });

    it('should detect medical conditions', () => {
      const text = 'Patient has history of hypertension and diabetes mellitus';
      const result = service.detectMedicalTerms(text);
      
      expect(result.conditions).toContain('hypertension');
      expect(result.conditions).toContain('diabetes mellitus');
    });

    it('should detect medications', () => {
      const text = 'Prescribed aspirin 325mg and lisinopril 10mg daily';
      const result = service.detectMedicalTerms(text);
      
      expect(result.medications).toContain('aspirin');
      expect(result.medications).toContain('lisinopril');
    });

    it('should detect medical procedures', () => {
      const text = 'Ordered ECG and chest x-ray, considering CT scan';
      const result = service.detectMedicalTerms(text);
      
      expect(result.procedures).toContain('ecg');
      expect(result.procedures).toContain('x-ray');
      expect(result.procedures).toContain('ct scan');
    });

    it('should detect vital signs', () => {
      const text = 'Blood pressure 140/90, heart rate 85, temperature normal';
      const result = service.detectMedicalTerms(text);
      
      expect(result.vitalSigns).toContain('blood pressure');
      expect(result.vitalSigns).toContain('heart rate');
    });

    it('should handle empty text', () => {
      const result = service.detectMedicalTerms('');
      
      expect(result.symptoms).toHaveLength(0);
      expect(result.conditions).toHaveLength(0);
      expect(result.medications).toHaveLength(0);
      expect(result.procedures).toHaveLength(0);
    });
  });

  describe('analyzeMedicalContext', () => {
    it('should identify cardiology specialty', () => {
      const text = 'Patient presents with chest pain and abnormal ECG findings';
      const result = service.analyzeMedicalContext(text);
      
      expect(result.specialty).toBe('cardiology');
    });

    it('should identify neurology specialty', () => {
      const text = 'Patient reports severe headache and neurological symptoms';
      const result = service.analyzeMedicalContext(text);
      
      expect(result.specialty).toBe('neurology');
    });

    it('should identify respiratory specialty', () => {
      const text = 'Patient has shortness of breath and chronic cough with lung involvement';
      const result = service.analyzeMedicalContext(text);
      
      expect(result.specialty).toBe('respiratory');
    });

    it('should detect high urgency level', () => {
      const text = 'Emergency: Critical patient with severe symptoms requiring immediate attention';
      const result = service.analyzeMedicalContext(text);
      
      expect(result.urgencyLevel).toBe('high');
    });

    it('should detect low urgency level', () => {
      const text = 'Routine follow-up visit for mild symptoms, patient is stable';
      const result = service.analyzeMedicalContext(text);
      
      expect(result.urgencyLevel).toBe('low');
    });

    it('should extract symptoms and conditions', () => {
      const text = 'Patient has chest pain and hypertension, taking aspirin';
      const result = service.analyzeMedicalContext(text);
      
      expect(result.symptoms).toContain('chest pain');
      expect(result.conditions).toContain('hypertension');
      expect(result.medications).toContain('aspirin');
    });

    it('should merge with provided context', () => {
      const text = 'Patient reports chest pain';
      const providedContext: MedicalContext = {
        patientAge: '65',
        previousContext: ['diabetes history']
      };
      
      const result = service.analyzeMedicalContext(text, providedContext);
      
      expect(result.patientAge).toBe('65');
      expect(result.previousContext).toContain('diabetes history');
      expect(result.specialty).toBe('cardiology'); // Should still detect from text
    });
  });

  describe('enhanceMedicalContext', () => {
    it('should enhance context using Bedrock AI', async () => {
      const text = 'Patient presents with acute chest pain and elevated cardiac enzymes';
      const baseContext: MedicalContext = {
        specialty: 'cardiology',
        urgencyLevel: 'medium'
      };

      const result = await service.enhanceMedicalContext(text, baseContext);
      
      expect(result.enhancedContext).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.detectedTerms).toBeDefined();
      expect(result.recommendations).toBeInstanceOf(Array);
      expect(result.consistencyScore).toBeGreaterThan(0);
      
      // Verify Bedrock was called
      expect(mockBedrockSend).toHaveBeenCalled();
    });

    it('should handle Bedrock service errors gracefully', async () => {
      mockBedrockSend.mockRejectedValue(new Error('Bedrock unavailable'));
      
      const text = 'Patient has chest pain';
      const baseContext: MedicalContext = { specialty: 'general' };
      
      const result = await service.enhanceMedicalContext(text, baseContext);
      
      expect(result.enhancedContext).toEqual(baseContext);
      expect(result.confidence).toBe(0.5);
      expect(result.recommendations).toContain('Context enhancement unavailable - using basic analysis');
    });

    it('should generate appropriate recommendations', async () => {
      const text = 'chest pain'; // Minimal text
      const baseContext: MedicalContext = { specialty: 'general' };
      
      const result = await service.enhanceMedicalContext(text, baseContext);
      
      expect(result.recommendations).toContain('Consider adding more specific medical details for better context analysis');
    });
  });

  describe('enhanceTranslationWithContext', () => {
    beforeEach(() => {
      // Mock enhanced translation response
      mockBedrockSend.mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify({
          content: [{
            text: 'Enhanced translation: El paciente presenta dolor torácico agudo con disnea'
          }]
        }))
      });
    });

    it('should enhance translation with medical context', async () => {
      const originalText = 'Patient has chest pain and shortness of breath';
      const translation = 'Paciente tiene dolor de pecho y falta de aire';
      const medicalContext: MedicalContext = {
        specialty: 'cardiology',
        urgencyLevel: 'high'
      };

      const result = await service.enhanceTranslationWithContext(
        originalText,
        translation,
        'en',
        'es',
        medicalContext
      );
      
      expect(result.originalText).toBe(originalText);
      expect(result.enhancedTranslation).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.medicalTermsPreserved).toBeInstanceOf(Array);
      expect(result.contextualImprovements).toBeInstanceOf(Array);
      expect(result.culturalAdaptations).toBeInstanceOf(Array);
      
      // Verify Bedrock was called
      expect(mockBedrockSend).toHaveBeenCalled();
    });

    it('should handle translation enhancement errors', async () => {
      mockBedrockSend.mockRejectedValue(new Error('Translation enhancement failed'));
      
      const originalText = 'Patient has fever';
      const translation = 'Paciente tiene fiebre';
      const medicalContext: MedicalContext = { specialty: 'general' };
      
      const result = await service.enhanceTranslationWithContext(
        originalText,
        translation,
        'en',
        'es',
        medicalContext
      );
      
      expect(result.enhancedTranslation).toBe(translation); // Should return original
      expect(result.confidence).toBe(0.5);
    });

    it('should identify preserved medical terms', async () => {
      const originalText = 'Patient diagnosed with myocardial infarction';
      const translation = 'Paciente diagnosticado con infarto de miocardio';
      const medicalContext: MedicalContext = { specialty: 'cardiology' };
      
      const result = await service.enhanceTranslationWithContext(
        originalText,
        translation,
        'en',
        'es',
        medicalContext
      );
      
      // Should identify that medical terms were preserved in some form
      expect(result.medicalTermsPreserved.length).toBeGreaterThan(0);
    });
  });

  describe('checkTerminologyConsistency', () => {
    it('should check consistency across multiple translations', () => {
      const translations = [
        {
          original: 'Patient has chest pain',
          translated: 'Paciente tiene dolor torácico',
          language: 'es'
        },
        {
          original: 'Patient reports chest pain',
          translated: 'Paciente reporta dolor de pecho',
          language: 'es'
        }
      ];

      const result = service.checkTerminologyConsistency(translations);
      
      expect(result.consistencyScore).toBeGreaterThan(0);
      expect(result.inconsistentTerms).toBeInstanceOf(Array);
      expect(result.recommendations).toBeInstanceOf(Array);
    });

    it('should identify inconsistent terminology', () => {
      const translations = [
        {
          original: 'Patient has hypertension',
          translated: 'Paciente tiene hipertensión',
          language: 'es'
        },
        {
          original: 'Patient has hypertension',
          translated: 'Paciente tiene presión alta',
          language: 'es'
        }
      ];

      const result = service.checkTerminologyConsistency(translations);
      
      // Should detect inconsistency in hypertension translation
      expect(result.consistencyScore).toBeLessThan(1.0);
      expect(result.recommendations).toContain('Consider standardizing medical terminology across translations');
    });

    it('should handle empty translations array', () => {
      const result = service.checkTerminologyConsistency([]);
      
      expect(result.consistencyScore).toBe(1.0);
      expect(result.inconsistentTerms).toHaveLength(0);
      expect(result.recommendations).toHaveLength(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle text with no medical terms', () => {
      const text = 'The weather is nice today and I feel good';
      const result = service.detectMedicalTerms(text);
      
      Object.values(result).forEach(category => {
        expect(category).toHaveLength(0);
      });
    });

    it('should handle very long medical text', () => {
      const longText = 'Patient presents with chest pain and shortness of breath. '.repeat(100);
      const result = service.analyzeMedicalContext(longText);
      
      expect(result.specialty).toBe('cardiology');
      expect(result.symptoms).toContain('chest pain');
    });

    it('should handle mixed language text gracefully', () => {
      const mixedText = 'Patient has dolor de pecho and shortness of breath';
      const result = service.detectMedicalTerms(mixedText);
      
      // Should still detect English medical terms
      expect(result.symptoms).toContain('shortness of breath');
    });

    it('should handle special characters and formatting', () => {
      const formattedText = 'Patient has:\n- Chest pain (severe)\n- BP: 140/90 mmHg\n- HR: 85 bpm';
      const result = service.detectMedicalTerms(formattedText);
      
      expect(result.symptoms).toContain('chest pain');
      expect(result.vitalSigns).toContain('blood pressure');
    });
  });
});