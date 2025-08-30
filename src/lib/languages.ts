/**
 * Comprehensive language configuration for Healthcare Translation App
 * Ensures consistency across all services (Transcribe, Translate, Polly TTS)
 */

import { Language } from './types';

// Supported languages with full service compatibility
export const SUPPORTED_LANGUAGES: Language[] = [
    // Primary healthcare languages (most common)
    {
        code: 'en-US',
        name: 'English (US)',
        nativeName: 'English',
        isSupported: true,
        isCommon: true
    },
    {
        code: 'es-US',
        name: 'Spanish (US)',
        nativeName: 'Español',
        isSupported: true,
        isCommon: true
    },
    {
        code: 'es-ES',
        name: 'Spanish (Spain)',
        nativeName: 'Español (España)',
        isSupported: true,
        isCommon: true
    },
    {
        code: 'fr-FR',
        name: 'French',
        nativeName: 'Français',
        isSupported: true,
        isCommon: true
    },
    {
        code: 'de-DE',
        name: 'German',
        nativeName: 'Deutsch',
        isSupported: true,
        isCommon: true
    },
    {
        code: 'it-IT',
        name: 'Italian',
        nativeName: 'Italiano',
        isSupported: true,
        isCommon: true
    },
    {
        code: 'pt-BR',
        name: 'Portuguese (Brazil)',
        nativeName: 'Português (Brasil)',
        isSupported: true,
        isCommon: true
    },
    {
        code: 'zh-CN',
        name: 'Chinese (Simplified)',
        nativeName: '中文 (简体)',
        isSupported: true,
        isCommon: true
    },
    {
        code: 'ja-JP',
        name: 'Japanese',
        nativeName: '日本語',
        isSupported: true,
        isCommon: true
    },
    {
        code: 'ko-KR',
        name: 'Korean',
        nativeName: '한국어',
        isSupported: true,
        isCommon: true
    },
    {
        code: 'ar-AE',
        name: 'Arabic',
        nativeName: 'العربية',
        isSupported: true,
        isCommon: true
    },
    {
        code: 'hi-IN',
        name: 'Hindi',
        nativeName: 'हिन्दी',
        isSupported: true,
        isCommon: true
    },
    
    // Additional supported languages
    {
        code: 'ru-RU',
        name: 'Russian',
        nativeName: 'Русский',
        isSupported: true,
        isCommon: false
    },
    {
        code: 'pl-PL',
        name: 'Polish',
        nativeName: 'Polski',
        isSupported: true,
        isCommon: false
    },
    {
        code: 'nl-NL',
        name: 'Dutch',
        nativeName: 'Nederlands',
        isSupported: true,
        isCommon: false
    },
    {
        code: 'sv-SE',
        name: 'Swedish',
        nativeName: 'Svenska',
        isSupported: true,
        isCommon: false
    },
    {
        code: 'da-DK',
        name: 'Danish',
        nativeName: 'Dansk',
        isSupported: true,
        isCommon: false
    },
    {
        code: 'no-NO',
        name: 'Norwegian',
        nativeName: 'Norsk',
        isSupported: true,
        isCommon: false
    },
    {
        code: 'fi-FI',
        name: 'Finnish',
        nativeName: 'Suomi',
        isSupported: true,
        isCommon: false
    },
    {
        code: 'tr-TR',
        name: 'Turkish',
        nativeName: 'Türkçe',
        isSupported: true,
        isCommon: false
    },
    {
        code: 'th-TH',
        name: 'Thai',
        nativeName: 'ไทย',
        isSupported: true,
        isCommon: false
    }
];

// Get commonly used languages for quick selection
export const getCommonLanguages = (): Language[] => {
    return SUPPORTED_LANGUAGES.filter(lang => lang.isCommon);
};

// Get all supported languages
export const getAllSupportedLanguages = (): Language[] => {
    return SUPPORTED_LANGUAGES.filter(lang => lang.isSupported);
};

// Get language by code
export const getLanguageByCode = (code: string): Language | undefined => {
    return SUPPORTED_LANGUAGES.find(lang => lang.code === code);
};

// Validate if language is supported
export const isLanguageSupported = (code: string): boolean => {
    return SUPPORTED_LANGUAGES.some(lang => lang.code === code && lang.isSupported);
};

// Get language pairs for translation (source -> target combinations)
export const getTranslationPairs = (): Array<{ source: string; target: string }> => {
    const supportedCodes = getAllSupportedLanguages().map(lang => lang.code);
    const pairs: Array<{ source: string; target: string }> = [];
    
    supportedCodes.forEach(source => {
        supportedCodes.forEach(target => {
            if (source !== target) {
                pairs.push({ source, target });
            }
        });
    });
    
    return pairs;
};

// Language code mappings for different AWS services
export const AWS_SERVICE_LANGUAGE_MAPPINGS: Record<string, Record<string, string>> = {
    // Amazon Transcribe language codes
    transcribe: {
        'en-US': 'en-US',
        'es-US': 'es-US',
        'es-ES': 'es-ES',
        'fr-FR': 'fr-FR',
        'de-DE': 'de-DE',
        'it-IT': 'it-IT',
        'pt-BR': 'pt-BR',
        'zh-CN': 'zh-CN',
        'ja-JP': 'ja-JP',
        'ko-KR': 'ko-KR',
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
    },
    
    // Amazon Translate language codes
    translate: {
        'en-US': 'en',
        'es-US': 'es',
        'es-ES': 'es',
        'fr-FR': 'fr',
        'de-DE': 'de',
        'it-IT': 'it',
        'pt-BR': 'pt',
        'zh-CN': 'zh',
        'ja-JP': 'ja',
        'ko-KR': 'ko',
        'ar-AE': 'ar',
        'hi-IN': 'hi',
        'ru-RU': 'ru',
        'pl-PL': 'pl',
        'nl-NL': 'nl',
        'sv-SE': 'sv',
        'da-DK': 'da',
        'no-NO': 'no',
        'fi-FI': 'fi',
        'tr-TR': 'tr',
        'th-TH': 'th'
    },
    
    // Amazon Polly language codes (already defined in polly-tts-service.ts)
    polly: {
        'en-US': 'en-US',
        'es-US': 'es-US',
        'es-ES': 'es-ES',
        'fr-FR': 'fr-FR',
        'de-DE': 'de-DE',
        'it-IT': 'it-IT',
        'pt-BR': 'pt-BR',
        'zh-CN': 'cmn-CN',
        'ja-JP': 'ja-JP',
        'ko-KR': 'ko-KR',
        'ar-AE': 'arb',
        'hi-IN': 'hi-IN',
        'ru-RU': 'ru-RU',
        'pl-PL': 'pl-PL',
        'nl-NL': 'nl-NL',
        'sv-SE': 'sv-SE',
        'da-DK': 'da-DK',
        'no-NO': 'nb-NO',
        'fi-FI': 'fi-FI',
        'tr-TR': 'tr-TR',
        'th-TH': 'hi-IN' // Fallback to Hindi for Thai
    }
};

// Get AWS service-specific language code
export const getAWSLanguageCode = (
    service: 'transcribe' | 'translate' | 'polly',
    languageCode: string
): string => {
    const serviceMapping = AWS_SERVICE_LANGUAGE_MAPPINGS[service] as Record<string, string>;
    return serviceMapping[languageCode] || languageCode;
};

// Default language settings
export const DEFAULT_LANGUAGES = {
    input: 'en-US',
    output: 'es-US'
};

// Language detection patterns for common healthcare phrases
export const LANGUAGE_DETECTION_PATTERNS: Record<string, RegExp[]> = {
    'en-US': [
        /\b(doctor|nurse|hospital|pain|help|emergency)\b/i,
        /\b(I need|I have|I am|please help)\b/i
    ],
    'es-US': [
        /\b(doctor|enfermera|hospital|dolor|ayuda|emergencia)\b/i,
        /\b(necesito|tengo|soy|por favor)\b/i
    ],
    'fr-FR': [
        /\b(docteur|infirmière|hôpital|douleur|aide|urgence)\b/i,
        /\b(j'ai besoin|j'ai|je suis|s'il vous plaît)\b/i
    ],
    'de-DE': [
        /\b(arzt|krankenschwester|krankenhaus|schmerz|hilfe|notfall)\b/i,
        /\b(ich brauche|ich habe|ich bin|bitte)\b/i
    ]
};

// Validate language detection
export const detectLanguage = (text: string): string | null => {
    for (const [langCode, patterns] of Object.entries(LANGUAGE_DETECTION_PATTERNS)) {
        if (patterns.some(pattern => pattern.test(text))) {
            return langCode;
        }
    }
    return null;
};

// Healthcare-specific language priorities
export const HEALTHCARE_LANGUAGE_PRIORITIES: Record<string, string[]> = {
    'emergency': ['en-US', 'es-US', 'fr-FR', 'de-DE', 'zh-CN'],
    'consultation': ['en-US', 'es-US', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR'],
    'routine': getAllSupportedLanguages().map(lang => lang.code)
};

// Get prioritized languages for healthcare scenario
export const getLanguagesForScenario = (scenario: keyof typeof HEALTHCARE_LANGUAGE_PRIORITIES): Language[] => {
    const priorityCodes = HEALTHCARE_LANGUAGE_PRIORITIES[scenario];
    return priorityCodes
        .map(code => getLanguageByCode(code))
        .filter((lang): lang is Language => lang !== undefined);
};