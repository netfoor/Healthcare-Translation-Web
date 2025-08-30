import { PollyTTSService, TTSRequest, SSMLOptions } from '../polly-tts-service';
import { PollyClient, SynthesizeSpeechCommand, VoiceId, Engine, OutputFormat, TextType, LanguageCode } from '@aws-sdk/client-polly';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Mock AWS SDK clients
jest.mock('@aws-sdk/client-polly');
jest.mock('@aws-sdk/client-s3');

const mockPollyClient = {
    send: jest.fn()
};

const mockS3Client = {
    send: jest.fn()
};

(PollyClient as jest.Mock).mockImplementation(() => mockPollyClient);
(S3Client as jest.Mock).mockImplementation(() => mockS3Client);

describe('PollyTTSService', () => {
    let ttsService: PollyTTSService;

    beforeEach(() => {
        jest.clearAllMocks();
        ttsService = new PollyTTSService('us-east-1', 'test-audio-bucket');
    });

    describe('synthesizeSpeech', () => {
        it('should synthesize speech successfully with basic text', async () => {
            const mockAudioStream = {
                transformToByteArray: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4]))
            };

            mockPollyClient.send.mockResolvedValue({
                AudioStream: mockAudioStream
            });

            const request: TTSRequest = {
                text: 'Hello, this is a test message.',
                language: 'en-US'
            };

            const result = await ttsService.synthesizeSpeech(request);

            expect(result).toEqual({
                audioData: new Uint8Array([1, 2, 3, 4]),
                voiceId: VoiceId.Joanna,
                language: 'en-US',
                format: 'mp3',
                cached: false
            });

            expect(mockPollyClient.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    input: expect.objectContaining({
                        Text: 'Hello, this is a test message.',
                        TextType: TextType.TEXT,
                        VoiceId: VoiceId.Joanna,
                        OutputFormat: OutputFormat.MP3,
                        Engine: Engine.NEURAL,
                        LanguageCode: LanguageCode.en_US,
                        SampleRate: '24000'
                    })
                })
            );
        });

        it('should synthesize speech with SSML enhancement', async () => {
            const mockAudioStream = {
                transformToByteArray: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4]))
            };

            mockPollyClient.send.mockResolvedValue({
                AudioStream: mockAudioStream
            });

            const request: TTSRequest = {
                text: 'Take your medication immediately.',
                language: 'en-US',
                useSSML: true
            };

            const result = await ttsService.synthesizeSpeech(request);

            expect(result.audioData).toEqual(new Uint8Array([1, 2, 3, 4]));
            expect(mockPollyClient.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    input: expect.objectContaining({
                        TextType: TextType.SSML,
                        Engine: Engine.NEURAL
                    })
                })
            );
        });

        it('should use preferred voice when specified', async () => {
            const mockAudioStream = {
                transformToByteArray: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4]))
            };

            mockPollyClient.send.mockResolvedValue({
                AudioStream: mockAudioStream
            });

            const request: TTSRequest = {
                text: 'Test message',
                language: 'en-US',
                voiceId: VoiceId.Matthew
            };

            await ttsService.synthesizeSpeech(request);

            expect(mockPollyClient.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    input: expect.objectContaining({
                        VoiceId: VoiceId.Matthew
                    })
                })
            );
        });

        it('should store audio in S3 when cache key is provided', async () => {
            const mockAudioStream = {
                transformToByteArray: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4]))
            };

            mockPollyClient.send.mockResolvedValue({
                AudioStream: mockAudioStream
            });

            mockS3Client.send.mockResolvedValue({});

            const request: TTSRequest = {
                text: 'Test message',
                language: 'en-US',
                cacheKey: 'test-cache-key'
            };

            const result = await ttsService.synthesizeSpeech(request);

            expect(result.audioUrl).toBe('s3://test-audio-bucket/tts-cache/test-cache-key.mp3');
            expect(mockS3Client.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    input: expect.objectContaining({
                        Bucket: 'test-audio-bucket',
                        Key: 'tts-cache/test-cache-key.mp3',
                        Body: new Uint8Array([1, 2, 3, 4]),
                        ContentType: 'audio/mp3',
                        ServerSideEncryption: 'aws:kms'
                    })
                })
            );
        });

        it('should handle Spanish language correctly', async () => {
            const mockAudioStream = {
                transformToByteArray: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4]))
            };

            mockPollyClient.send.mockResolvedValue({
                AudioStream: mockAudioStream
            });

            const request: TTSRequest = {
                text: 'Hola, tome su medicamento.',
                language: 'es-US'
            };

            await ttsService.synthesizeSpeech(request);

            expect(mockPollyClient.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    input: expect.objectContaining({
                        VoiceId: VoiceId.Lupe,
                        LanguageCode: LanguageCode.es_US
                    })
                })
            );
        });

        it('should throw error when Polly fails', async () => {
            mockPollyClient.send.mockRejectedValue(new Error('Polly service error'));

            const request: TTSRequest = {
                text: 'Test message',
                language: 'en-US'
            };

            await expect(ttsService.synthesizeSpeech(request)).rejects.toThrow('TTS synthesis failed: Polly service error');
        });

        it('should throw error when no audio stream is received', async () => {
            mockPollyClient.send.mockResolvedValue({
                AudioStream: null
            });

            const request: TTSRequest = {
                text: 'Test message',
                language: 'en-US'
            };

            await expect(ttsService.synthesizeSpeech(request)).rejects.toThrow('TTS synthesis failed: No audio stream received from Polly');
        });
    });

    describe('generateSSML', () => {
        it('should generate basic SSML with default options', () => {
            const text = 'Take your medication.';
            const language = 'en-US';

            const ssml = ttsService.generateSSML(text, language);

            expect(ssml).toContain('<speak>');
            expect(ssml).toContain('<prosody rate="medium" pitch="medium" volume="medium">');
            expect(ssml).toContain('<lang xml:lang="en-US">');
            expect(ssml).toContain('<emphasis level="moderate">Take</emphasis>');
            expect(ssml).toContain('</speak>');
        });

        it('should generate SSML with custom options', () => {
            const text = 'Take your medication immediately.';
            const language = 'en-US';
            const options: SSMLOptions = {
                rate: 'slow',
                pitch: 'high',
                volume: 'loud',
                emphasis: 'strong',
                pauseAfter: '500ms'
            };

            const ssml = ttsService.generateSSML(text, language, options);

            expect(ssml).toContain('<prosody rate="slow" pitch="high" volume="loud">');
            expect(ssml).toContain('<emphasis level="strong">Take</emphasis>');
            expect(ssml).toContain('<emphasis level="strong">immediately</emphasis>');
        });

        it('should add pauses after medical terms', () => {
            const text = 'The diagnosis shows symptoms of the condition.';
            const language = 'en-US';

            const ssml = ttsService.generateSSML(text, language);

            expect(ssml).toContain('diagnosis<break time="300ms"/>');
            expect(ssml).toContain('symptoms<break time="300ms"/>');
            expect(ssml).toContain('condition<break time="300ms"/>');
        });

        it('should enhance medical pronunciation', () => {
            const text = 'Take acetaminophen for your hypertension.';
            const language = 'en-US';

            const ssml = ttsService.generateSSML(text, language);

            expect(ssml).toContain('<phoneme alphabet="ipa" ph="əˌsiːtəˈmɪnəfən">acetaminophen</phoneme>');
            expect(ssml).toContain('<phoneme alphabet="ipa" ph="ˌhaɪpərˈtɛnʃən">hypertension</phoneme>');
        });

        it('should handle different languages correctly', () => {
            const text = 'Bonjour, prenez votre médicament.';
            const language = 'fr-FR';

            const ssml = ttsService.generateSSML(text, language);

            expect(ssml).toContain('<lang xml:lang="fr-FR">');
        });
    });

    describe('generateCacheKey', () => {
        it('should generate consistent cache keys for same input', () => {
            const text = 'Test message';
            const language = 'en-US';
            const voiceId = 'Joanna';

            const key1 = PollyTTSService.generateCacheKey(text, language, voiceId);
            const key2 = PollyTTSService.generateCacheKey(text, language, voiceId);

            expect(key1).toBe(key2);
            expect(typeof key1).toBe('string');
            expect(key1.length).toBeGreaterThan(0);
        });

        it('should generate different cache keys for different inputs', () => {
            const key1 = PollyTTSService.generateCacheKey('Text 1', 'en-US', 'Joanna');
            const key2 = PollyTTSService.generateCacheKey('Text 2', 'en-US', 'Joanna');
            const key3 = PollyTTSService.generateCacheKey('Text 1', 'es-US', 'Joanna');
            const key4 = PollyTTSService.generateCacheKey('Text 1', 'en-US', 'Matthew');

            expect(key1).not.toBe(key2);
            expect(key1).not.toBe(key3);
            expect(key1).not.toBe(key4);
        });

        it('should handle undefined voiceId', () => {
            const key = PollyTTSService.generateCacheKey('Test message', 'en-US');

            expect(typeof key).toBe('string');
            expect(key.length).toBeGreaterThan(0);
        });
    });

    describe('voice selection', () => {
        it('should select appropriate neural voices for different languages', async () => {
            const mockAudioStream = {
                transformToByteArray: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4]))
            };

            mockPollyClient.send.mockResolvedValue({
                AudioStream: mockAudioStream
            });

            // Test different languages
            const languages = [
                { lang: 'en-US', expectedVoice: VoiceId.Joanna },
                { lang: 'es-ES', expectedVoice: VoiceId.Lucia },
                { lang: 'fr-FR', expectedVoice: VoiceId.Lea },
                { lang: 'de-DE', expectedVoice: VoiceId.Vicki },
                { lang: 'zh-CN', expectedVoice: VoiceId.Zhiyu }
            ];

            for (const { lang, expectedVoice } of languages) {
                const request: TTSRequest = {
                    text: 'Test message',
                    language: lang
                };

                await ttsService.synthesizeSpeech(request);

                expect(mockPollyClient.send).toHaveBeenCalledWith(
                    expect.objectContaining({
                        input: expect.objectContaining({
                            VoiceId: expectedVoice
                        })
                    })
                );
            }
        });

        it('should fallback to English voice for unsupported languages', async () => {
            const mockAudioStream = {
                transformToByteArray: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4]))
            };

            mockPollyClient.send.mockResolvedValue({
                AudioStream: mockAudioStream
            });

            const request: TTSRequest = {
                text: 'Test message',
                language: 'unsupported-lang'
            };

            await ttsService.synthesizeSpeech(request);

            expect(mockPollyClient.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    input: expect.objectContaining({
                        VoiceId: VoiceId.Joanna,
                        LanguageCode: LanguageCode.en_US
                    })
                })
            );
        });
    });

    describe('medical pronunciation enhancement', () => {
        it('should enhance common medical terms', () => {
            const text = 'Patient has diabetes and needs ibuprofen for pneumonia.';
            const language = 'en-US';

            const ssml = ttsService.generateSSML(text, language);

            expect(ssml).toContain('<phoneme alphabet="ipa" ph="ˌdaɪəˈbiːtiːz">diabetes</phoneme>');
            expect(ssml).toContain('<phoneme alphabet="ipa" ph="ˌaɪbjuːˈproʊfən">ibuprofen</phoneme>');
            expect(ssml).toContain('<phoneme alphabet="ipa" ph="nuːˈmoʊniə">pneumonia</phoneme>');
        });

        it('should be case insensitive for medical terms', () => {
            const text = 'ACETAMINOPHEN and Hypertension';
            const language = 'en-US';

            const ssml = ttsService.generateSSML(text, language);

            expect(ssml).toContain('<phoneme alphabet="ipa" ph="əˌsiːtəˈmɪnəfən">ACETAMINOPHEN</phoneme>');
            expect(ssml).toContain('<phoneme alphabet="ipa" ph="ˌhaɪpərˈtɛnʃən">Hypertension</phoneme>');
        });

        it('should not affect partial word matches', () => {
            const text = 'The word diabeteslike is not a medical term.';
            const language = 'en-US';

            const ssml = ttsService.generateSSML(text, language);

            expect(ssml).not.toContain('<phoneme');
            expect(ssml).toContain('diabeteslike');
        });
    });
});