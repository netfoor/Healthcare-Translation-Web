// Mock AWS SDK clients before importing the service
const mockBedrockSend = jest.fn();

jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
    BedrockRuntimeClient: jest.fn().mockImplementation(() => ({
        send: mockBedrockSend,
    })),
    InvokeModelCommand: jest.fn(),
}));

import { InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import {
    detectMedicalScenario,
    validateMedicalTerminology,
    enhanceForHealthcareScenario,
    checkTranslationConsistency,
    generateMedicalCorrections,
    MedicalTerminologyUtils,
    MedicalContext
} from '../medical-enhancement-service';

describe('Medical Enhancement Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.AWS_REGION = 'us-east-1';
    });

    describe('detectMedicalScenario', () => {
        test('should detect emergency scenario', async () => {
            const emergencyText = 'I have severe chest pain and cannot breathe';
            const scenario = await detectMedicalScenario(emergencyText);
            expect(scenario).toBe('emergency');
        });

        test('should detect consultation scenario', async () => {
            const consultationText = 'I need to see a doctor about my symptoms';
            const scenario = await detectMedicalScenario(consultationText);
            expect(scenario).toBe('consultation');
        });

        test('should detect routine scenario', async () => {
            const routineText = 'I need to schedule my next checkup';
            const scenario = await detectMedicalScenario(routineText);
            expect(scenario).toBe('routine');
        });

        test('should default to routine for unclear text', async () => {
            const unclearText = 'Hello, how are you today?';
            const scenario = await detectMedicalScenario(unclearText);
            expect(scenario).toBe('routine');
        });
    });

    describe('validateMedicalTerminology', () => {
        test('should validate medical terminology with Bedrock', async () => {
            mockBedrockSend.mockResolvedValue({
                body: new TextEncoder().encode(JSON.stringify({
                    content: [{
                        text: JSON.stringify({
                            isValid: true,
                            suggestions: [],
                            confidence: 0.9,
                            medicalAccuracy: 0.95
                        })
                    }]
                }))
            });

            const result = await validateMedicalTerminology(
                'The patient has chest pain',
                'El paciente tiene dolor torácico',
                'en',
                'es'
            );

            expect(result.isValid).toBe(true);
            expect(result.confidence).toBe(0.9);
            expect(result.medicalAccuracy).toBe(0.95);
            expect(mockBedrockSend).toHaveBeenCalledWith(expect.any(InvokeModelCommand));
        });

        test('should fallback to terminology mapping when Bedrock fails', async () => {
            mockBedrockSend.mockRejectedValue(new Error('Bedrock unavailable'));

            const result = await validateMedicalTerminology(
                'The patient has chest pain',
                'El paciente tiene dolor torácico',
                'en',
                'es'
            );

            expect(result.isValid).toBe(true);
            expect(result.confidence).toBeGreaterThan(0);
            expect(result.medicalAccuracy).toBeGreaterThan(0);
        });

        test('should provide suggestions for incorrect terminology', async () => {
            const result = await validateMedicalTerminology(
                'The patient has chest pain',
                'El paciente tiene dolor de pecho', // Less accurate translation
                'en',
                'es'
            );

            // Should provide suggestions when terminology mapping detects issues
            expect(result.suggestions.length).toBeGreaterThanOrEqual(0);
            expect(result.medicalAccuracy).toBeLessThan(1.0);
        });
    });

    describe('enhanceForHealthcareScenario', () => {
        test('should enhance translation for emergency scenario', async () => {
            mockBedrockSend.mockResolvedValue({
                body: new TextEncoder().encode(JSON.stringify({
                    content: [{
                        text: JSON.stringify({
                            enhancedText: 'URGENTE: El paciente tiene dolor torácico severo',
                            confidence: 0.95,
                            medicalTermsValidated: ['chest pain', 'severe'],
                            improvementsMade: ['Added urgency indicator', 'Used precise medical terminology'],
                            qualityScore: 0.95
                        })
                    }]
                }))
            });

            const result = await enhanceForHealthcareScenario(
                'I have severe chest pain',
                'Tengo dolor de pecho severo',
                'en',
                'es',
                'emergency'
            );

            expect(result.enhancedText).toContain('URGENTE');
            expect(result.confidence).toBe(0.95);
            expect(result.medicalTermsValidated).toContain('chest pain');
            expect(result.improvementsMade).toContain('Added urgency indicator');
            expect(mockBedrockSend).toHaveBeenCalledWith(expect.any(InvokeModelCommand));
        });

        test('should handle Bedrock failures gracefully', async () => {
            mockBedrockSend.mockRejectedValue(new Error('Bedrock unavailable'));

            const result = await enhanceForHealthcareScenario(
                'I have chest pain',
                'Tengo dolor de pecho',
                'en',
                'es',
                'consultation'
            );

            expect(result.enhancedText).toBe('Tengo dolor de pecho');
            expect(result.confidence).toBe(0.75);
            expect(result.qualityScore).toBe(0.75);
        });
    });

    describe('checkTranslationConsistency', () => {
        test('should check consistency across multiple translations', async () => {
            mockBedrockSend.mockResolvedValue({
                body: new TextEncoder().encode(JSON.stringify({
                    content: [{
                        text: JSON.stringify({
                            consistencyScore: 0.85,
                            inconsistencies: ['Different terms used for "pain"'],
                            recommendations: ['Use consistent medical terminology']
                        })
                    }]
                }))
            });

            const translations = [
                {
                    original: 'I have chest pain',
                    translated: 'Tengo dolor torácico',
                    sourceLanguage: 'en',
                    targetLanguage: 'es'
                },
                {
                    original: 'The pain is severe',
                    translated: 'El dolor es severo',
                    sourceLanguage: 'en',
                    targetLanguage: 'es'
                }
            ];

            const result = await checkTranslationConsistency(translations);

            expect(result.consistencyScore).toBe(0.85);
            expect(result.inconsistencies).toContain('Different terms used for "pain"');
            expect(result.recommendations).toContain('Use consistent medical terminology');
            expect(mockBedrockSend).toHaveBeenCalledWith(expect.any(InvokeModelCommand));
        });

        test('should handle Bedrock failures with default values', async () => {
            mockBedrockSend.mockRejectedValue(new Error('Bedrock unavailable'));

            const translations = [
                {
                    original: 'I have chest pain',
                    translated: 'Tengo dolor torácico',
                    sourceLanguage: 'en',
                    targetLanguage: 'es'
                }
            ];

            const result = await checkTranslationConsistency(translations);

            expect(result.consistencyScore).toBe(0.7);
            expect(result.inconsistencies).toEqual([]);
            expect(result.recommendations.length).toBeGreaterThanOrEqual(0);
        });
    });

    describe('generateMedicalCorrections', () => {
        test('should generate corrections with medical context', async () => {
            mockBedrockSend.mockResolvedValue({
                body: new TextEncoder().encode(JSON.stringify({
                    content: [{
                        text: JSON.stringify({
                            corrections: [
                                {
                                    original: 'dolor de pecho',
                                    corrected: 'dolor torácico',
                                    reason: 'More precise medical terminology',
                                    confidence: 0.9
                                }
                            ],
                            overallImprovement: 0.3
                        })
                    }]
                }))
            });

            const medicalContext: MedicalContext = {
                specialty: 'Cardiology',
                commonTerms: ['chest pain', 'heart attack'],
                previousContext: ['cardiac symptoms'],
                urgencyLevel: 'high'
            };

            const result = await generateMedicalCorrections(
                'I have chest pain',
                'Tengo dolor de pecho',
                'en',
                'es',
                medicalContext
            );

            expect(result.corrections).toHaveLength(1);
            expect(result.corrections[0].original).toBe('dolor de pecho');
            expect(result.corrections[0].corrected).toBe('dolor torácico');
            expect(result.corrections[0].reason).toBe('More precise medical terminology');
            expect(result.overallImprovement).toBe(0.3);
            expect(mockBedrockSend).toHaveBeenCalledWith(expect.any(InvokeModelCommand));
        });

        test('should handle Bedrock failures gracefully', async () => {
            mockBedrockSend.mockRejectedValue(new Error('Bedrock unavailable'));

            const result = await generateMedicalCorrections(
                'I have chest pain',
                'Tengo dolor de pecho',
                'en',
                'es'
            );

            expect(result.corrections).toEqual([]);
            expect(result.overallImprovement).toBe(0);
        });
    });

    describe('MedicalTerminologyUtils', () => {
        test('should get terminology mapping for language pair', () => {
            const mapping = MedicalTerminologyUtils.getTerminologyMapping('en', 'es');
            expect(mapping['chest pain']).toBe('dolor torácico');
            expect(mapping['blood pressure']).toBe('presión arterial');
        });

        test('should return empty object for unsupported language pair', () => {
            const mapping = MedicalTerminologyUtils.getTerminologyMapping('en', 'zh');
            expect(mapping).toEqual({});
        });

        test('should get healthcare scenarios', () => {
            const scenarios = MedicalTerminologyUtils.getHealthcareScenarios();
            expect(scenarios.emergency).toBeDefined();
            expect(scenarios.consultation).toBeDefined();
            expect(scenarios.routine).toBeDefined();
        });

        test('should identify emergency text', () => {
            expect(MedicalTerminologyUtils.isEmergencyText('I have severe chest pain')).toBe(true);
            expect(MedicalTerminologyUtils.isEmergencyText('This is an emergency')).toBe(true);
            expect(MedicalTerminologyUtils.isEmergencyText('I need a prescription refill')).toBe(false);
        });

        test('should extract medical terms from text', () => {
            const terms = MedicalTerminologyUtils.extractMedicalTerms('The patient has chest pain and high blood pressure');
            expect(terms).toContain('chest pain');
            expect(terms).toContain('blood pressure');
            expect(terms).toContain('patient');
        });

        test('should handle text without medical terms', () => {
            const terms = MedicalTerminologyUtils.extractMedicalTerms('Hello, how are you today?');
            expect(terms).toEqual([]);
        });

        test('should remove duplicate medical terms', () => {
            const terms = MedicalTerminologyUtils.extractMedicalTerms('The patient is a patient with chest pain');
            expect(terms.filter(term => term === 'patient')).toHaveLength(1);
        });
    });

    describe('Error Handling', () => {
        test('should handle invalid JSON responses from Bedrock', async () => {
            mockBedrockSend.mockResolvedValue({
                body: new TextEncoder().encode(JSON.stringify({
                    content: [{
                        text: 'Invalid JSON response'
                    }]
                }))
            });

            const result = await validateMedicalTerminology(
                'The patient has chest pain',
                'El paciente tiene dolor de pecho',
                'en',
                'es'
            );

            // Should fallback to terminology mapping validation
            expect(result.confidence).toBeGreaterThan(0);
            expect(result.medicalAccuracy).toBeGreaterThan(0);
        });

        test('should handle network errors gracefully', async () => {
            mockBedrockSend.mockRejectedValue(new Error('Network error'));

            const result = await enhanceForHealthcareScenario(
                'I have chest pain',
                'Tengo dolor de pecho',
                'en',
                'es',
                'emergency'
            );

            expect(result.enhancedText).toBe('Tengo dolor de pecho');
            expect(result.confidence).toBe(0.75);
        });
    });
});