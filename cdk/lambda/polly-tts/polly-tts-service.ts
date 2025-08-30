import {
    PollyClient,
    SynthesizeSpeechCommand,
    Voice,
    Engine,
    OutputFormat,
    TextType,
    LanguageCode,
    VoiceId
} from '@aws-sdk/client-polly';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export interface TTSRequest {
    text: string;
    language: string;
    voiceId?: string;
    useSSML?: boolean;
    cacheKey?: string;
}

export interface TTSResult {
    audioUrl?: string;
    audioData?: Uint8Array;
    voiceId: string;
    language: string;
    format: string;
    duration?: number;
    cached: boolean;
}

export interface SSMLOptions {
    rate?: 'x-slow' | 'slow' | 'medium' | 'fast' | 'x-fast';
    pitch?: 'x-low' | 'low' | 'medium' | 'high' | 'x-high';
    volume?: 'silent' | 'x-soft' | 'soft' | 'medium' | 'loud' | 'x-loud';
    emphasis?: 'strong' | 'moderate' | 'reduced';
    pauseAfter?: string; // e.g., '1s', '500ms'
}

export class PollyTTSService {
    private pollyClient: PollyClient;
    private s3Client: S3Client;
    private audioBucket: string;

    // Neural voices optimized for healthcare communication
    private readonly NEURAL_VOICES: Record<string, VoiceId[]> = {
        'en-US': [VoiceId.Joanna, VoiceId.Matthew, VoiceId.Ruth, VoiceId.Stephen],
        'es-US': [VoiceId.Lupe, VoiceId.Pedro],
        'es-ES': [VoiceId.Lucia, VoiceId.Sergio],
        'fr-FR': [VoiceId.Lea, VoiceId.Remi],
        'de-DE': [VoiceId.Vicki, VoiceId.Daniel],
        'it-IT': [VoiceId.Bianca, VoiceId.Adriano],
        'pt-BR': [VoiceId.Camila, VoiceId.Thiago],
        'ja-JP': [VoiceId.Takumi, VoiceId.Kazuha],
        'ko-KR': [VoiceId.Seoyeon],
        'zh-CN': [VoiceId.Zhiyu],
        'ar-AE': [VoiceId.Hala, VoiceId.Zayd],
        'hi-IN': [VoiceId.Aditi, VoiceId.Kajal],
        'ru-RU': [VoiceId.Tatyana, VoiceId.Maxim],
        'pl-PL': [VoiceId.Ola],
        'nl-NL': [VoiceId.Laura, VoiceId.Ruben],
        'sv-SE': [VoiceId.Astrid],
        'da-DK': [VoiceId.Naja, VoiceId.Mads],
        'no-NO': [VoiceId.Liv],
        'fi-FI': [VoiceId.Suvi],
        'tr-TR': [VoiceId.Filiz],
        'th-TH': [VoiceId.Aditi] // Using Hindi voice as fallback for Thai
    };

    // Medical terminology pronunciation mappings
    private readonly MEDICAL_PRONUNCIATIONS: Record<string, string> = {
        'acetaminophen': '<phoneme alphabet="ipa" ph="əˌsiːtəˈmɪnəfən">acetaminophen</phoneme>',
        'ibuprofen': '<phoneme alphabet="ipa" ph="ˌaɪbjuːˈproʊfən">ibuprofen</phoneme>',
        'hypertension': '<phoneme alphabet="ipa" ph="ˌhaɪpərˈtɛnʃən">hypertension</phoneme>',
        'diabetes': '<phoneme alphabet="ipa" ph="ˌdaɪəˈbiːtiːz">diabetes</phoneme>',
        'pneumonia': '<phoneme alphabet="ipa" ph="nuːˈmoʊniə">pneumonia</phoneme>',
        'bronchitis': '<phoneme alphabet="ipa" ph="brɒŋˈkaɪtɪs">bronchitis</phoneme>',
        'myocardial': '<phoneme alphabet="ipa" ph="ˌmaɪoʊˈkɑːrdiəl">myocardial</phoneme>',
        'electrocardiogram': '<phoneme alphabet="ipa" ph="ɪˌlɛktroʊˈkɑːrdioʊˌɡræm">electrocardiogram</phoneme>',
        'stethoscope': '<phoneme alphabet="ipa" ph="ˈstɛθəˌskoʊp">stethoscope</phoneme>',
        'auscultation': '<phoneme alphabet="ipa" ph="ˌɔːskəlˈteɪʃən">auscultation</phoneme>'
    };

    constructor(region: string = 'us-east-1', audioBucket?: string) {
        this.pollyClient = new PollyClient({ region });
        this.s3Client = new S3Client({ region });
        this.audioBucket = audioBucket || process.env.AUDIO_BUCKET || '';
    }

    /**
     * Synthesize speech using Amazon Polly with medical pronunciation optimization
     */
    async synthesizeSpeech(request: TTSRequest): Promise<TTSResult> {
        try {
            const voiceId = this.selectOptimalVoice(request.language, request.voiceId);
            const processedText = request.useSSML
                ? this.generateSSML(request.text, request.language)
                : this.enhanceMedicalPronunciation(request.text);

            const command = new SynthesizeSpeechCommand({
                Text: processedText,
                TextType: request.useSSML ? TextType.SSML : TextType.TEXT,
                VoiceId: voiceId,
                OutputFormat: OutputFormat.MP3,
                Engine: Engine.NEURAL, // Use neural engine for better quality
                LanguageCode: this.mapLanguageToPollyCode(request.language),
                SampleRate: '24000' // High quality for medical communication
            });

            const response = await this.pollyClient.send(command);

            if (!response.AudioStream) {
                throw new Error('No audio stream received from Polly');
            }

            // Convert stream to Uint8Array
            const audioData = await this.streamToUint8Array(response.AudioStream);

            let audioUrl: string | undefined;

            // Store in S3 if bucket is configured and cache key is provided
            if (this.audioBucket && request.cacheKey) {
                audioUrl = await this.storeAudioInS3(audioData, request.cacheKey, 'mp3');
            }

            return {
                audioUrl,
                audioData,
                voiceId,
                language: request.language,
                format: 'mp3',
                cached: false
            };

        } catch (error) {
            console.error('Error synthesizing speech:', error);
            throw new Error(`TTS synthesis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Generate SSML for enhanced medical speech synthesis
     */
    generateSSML(text: string, language: string, options: SSMLOptions = {}): string {
        const {
            rate = 'medium',
            pitch = 'medium',
            volume = 'medium',
            emphasis = 'moderate',
            pauseAfter = '300ms'
        } = options;

        // Apply medical pronunciation enhancements
        let enhancedText = this.enhanceMedicalPronunciation(text);

        // Add pauses after medical terms for clarity
        enhancedText = enhancedText.replace(
            /\b(diagnosis|treatment|medication|prescription|symptoms|condition)\b/gi,
            `$1<break time="${pauseAfter}"/>`
        );

        // Emphasize important medical instructions
        enhancedText = enhancedText.replace(
            /\b(take|avoid|stop|continue|immediately|urgent|emergency)\b/gi,
            `<emphasis level="${emphasis}">$1</emphasis>`
        );

        const ssml = `
            <speak>
                <prosody rate="${rate}" pitch="${pitch}" volume="${volume}">
                    <lang xml:lang="${this.mapLanguageToXMLLang(language)}">
                        ${enhancedText}
                    </lang>
                </prosody>
            </speak>
        `.trim();

        return ssml;
    }

    /**
     * Select optimal voice for the given language and healthcare context
     */
    private selectOptimalVoice(language: string, preferredVoiceId?: string): VoiceId {
        const availableVoices = this.NEURAL_VOICES[language];

        if (!availableVoices || availableVoices.length === 0) {
            // Fallback to English if language not supported
            return VoiceId.Joanna;
        }

        // Use preferred voice if specified and available
        if (preferredVoiceId && availableVoices.includes(preferredVoiceId as VoiceId)) {
            return preferredVoiceId as VoiceId;
        }

        // Default to first available neural voice for the language
        return availableVoices[0];
    }

    /**
     * Enhance text with medical pronunciation phonemes
     */
    private enhanceMedicalPronunciation(text: string): string {
        let enhancedText = text;

        // Apply medical pronunciation mappings
        Object.entries(this.MEDICAL_PRONUNCIATIONS).forEach(([term, pronunciation]) => {
            const regex = new RegExp(`\\b${term}\\b`, 'gi');
            enhancedText = enhancedText.replace(regex, pronunciation);
        });

        return enhancedText;
    }

    /**
     * Map language codes to Polly LanguageCode enum
     */
    private mapLanguageToPollyCode(language: string): LanguageCode {
        const languageMap: Record<string, LanguageCode> = {
            'en-US': LanguageCode.en_US,
            'es-US': LanguageCode.es_US,
            'es-ES': LanguageCode.es_ES,
            'fr-FR': LanguageCode.fr_FR,
            'de-DE': LanguageCode.de_DE,
            'it-IT': LanguageCode.it_IT,
            'pt-BR': LanguageCode.pt_BR,
            'ja-JP': LanguageCode.ja_JP,
            'ko-KR': LanguageCode.ko_KR,
            'zh-CN': LanguageCode.cmn_CN,
            'ar-AE': LanguageCode.arb,
            'hi-IN': LanguageCode.hi_IN,
            'ru-RU': LanguageCode.ru_RU,
            'pl-PL': LanguageCode.pl_PL,
            'nl-NL': LanguageCode.nl_NL,
            'sv-SE': LanguageCode.sv_SE,
            'da-DK': LanguageCode.da_DK,
            'no-NO': LanguageCode.nb_NO,
            'fi-FI': LanguageCode.fi_FI,
            'tr-TR': LanguageCode.tr_TR,
            'th-TH': LanguageCode.hi_IN // Using Hindi as fallback for Thai
        };

        return languageMap[language] || LanguageCode.en_US;
    }

    /**
     * Map language codes to XML lang attributes for SSML
     */
    private mapLanguageToXMLLang(language: string): string {
        const xmlLangMap: Record<string, string> = {
            'en-US': 'en-US',
            'es-US': 'es-US',
            'es-ES': 'es-ES',
            'fr-FR': 'fr-FR',
            'de-DE': 'de-DE',
            'it-IT': 'it-IT',
            'pt-BR': 'pt-BR',
            'ja-JP': 'ja-JP',
            'ko-KR': 'ko-KR',
            'zh-CN': 'zh-CN',
            'ar-AE': 'ar-AE',
            'hi-IN': 'hi-IN',
            'ru-RU': 'ru-RU',
            'pl-PL': 'pl-PL',
            'nl-NL': 'nl-NL',
            'sv-SE': 'sv-SE',
            'da-DK': 'da-DK',
            'no-NO': 'no-NO',
            'fi-FI': 'fi-FI',
            'tr-TR': 'tr-TR',
            'th-TH': 'th-TH'
        };

        return xmlLangMap[language] || 'en-US';
    }

    /**
     * Store audio data in S3 with encryption
     */
    private async storeAudioInS3(audioData: Uint8Array, cacheKey: string, format: string): Promise<string> {
        const key = `tts-cache/${cacheKey}.${format}`;

        const command = new PutObjectCommand({
            Bucket: this.audioBucket,
            Key: key,
            Body: audioData,
            ContentType: `audio/${format}`,
            ServerSideEncryption: 'aws:kms',
            CacheControl: 'max-age=86400', // Cache for 24 hours
            Metadata: {
                'generated-by': 'polly-tts-service',
                'format': format,
                'timestamp': new Date().toISOString()
            }
        });

        await this.s3Client.send(command);

        // Return S3 URL (would need presigned URL for actual access)
        return `s3://${this.audioBucket}/${key}`;
    }

    /**
     * Convert ReadableStream to Uint8Array
     */
    private async streamToUint8Array(stream: any): Promise<Uint8Array> {
        const chunks: Uint8Array[] = [];

        if (stream.transformToByteArray) {
            // AWS SDK v3 stream
            return await stream.transformToByteArray();
        }

        // Fallback for other stream types
        return new Promise((resolve, reject) => {
            stream.on('data', (chunk: any) => {
                chunks.push(new Uint8Array(chunk));
            });

            stream.on('end', () => {
                const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
                const result = new Uint8Array(totalLength);
                let offset = 0;

                for (const chunk of chunks) {
                    result.set(chunk, offset);
                    offset += chunk.length;
                }

                resolve(result);
            });

            stream.on('error', reject);
        });
    }

    /**
     * Generate cache key for TTS requests
     */
    static generateCacheKey(text: string, language: string, voiceId?: string): string {
        const content = `${text}-${language}-${voiceId || 'default'}`;
        // Simple hash function for cache key
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }
}