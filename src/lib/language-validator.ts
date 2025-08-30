/**
 * Language validation utilities for Healthcare Translation App
 * Ensures language codes are valid across all AWS services
 */

import { 
    SUPPORTED_LANGUAGES, 
    AWS_SERVICE_LANGUAGE_MAPPINGS, 
    isLanguageSupported,
    getAWSLanguageCode 
} from './languages';

export interface LanguageValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    serviceSupport: {
        transcribe: boolean;
        translate: boolean;
        polly: boolean;
    };
}

/**
 * Validate a language code for all AWS services
 */
export function validateLanguageCode(languageCode: string): LanguageValidationResult {
    const result: LanguageValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        serviceSupport: {
            transcribe: false,
            translate: false,
            polly: false
        }
    };

    // Check if language is in our supported list
    if (!isLanguageSupported(languageCode)) {
        result.isValid = false;
        result.errors.push(`Language code '${languageCode}' is not in the supported languages list`);
        return result;
    }

    // Check service support
    const services = ['transcribe', 'translate', 'polly'] as const;
    
    services.forEach(service => {
        const serviceCode = getAWSLanguageCode(service, languageCode);
        const serviceMapping = AWS_SERVICE_LANGUAGE_MAPPINGS[service];
        const hasMapping = serviceMapping[languageCode] !== undefined;
        
        (result.serviceSupport as Record<string, boolean>)[service] = hasMapping;
        
        if (!hasMapping) {
            result.warnings.push(`No ${service} mapping found for '${languageCode}', will use fallback`);
        }
        
        // Special case for Polly fallbacks
        if (service === 'polly' && serviceCode !== languageCode && serviceCode !== serviceMapping[languageCode]) {
            result.warnings.push(`Polly will use fallback voice for '${languageCode}' -> '${serviceCode}'`);
        }
    });

    return result;
}

/**
 * Validate a language pair for translation
 */
export function validateLanguagePair(sourceLanguage: string, targetLanguage: string): LanguageValidationResult {
    const result: LanguageValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        serviceSupport: {
            transcribe: false,
            translate: false,
            polly: false
        }
    };

    // Validate source language
    const sourceValidation = validateLanguageCode(sourceLanguage);
    if (!sourceValidation.isValid) {
        result.isValid = false;
        result.errors.push(`Source language validation failed: ${sourceValidation.errors.join(', ')}`);
    }
    result.warnings.push(...sourceValidation.warnings.map(w => `Source: ${w}`));

    // Validate target language
    const targetValidation = validateLanguageCode(targetLanguage);
    if (!targetValidation.isValid) {
        result.isValid = false;
        result.errors.push(`Target language validation failed: ${targetValidation.errors.join(', ')}`);
    }
    result.warnings.push(...targetValidation.warnings.map(w => `Target: ${w}`));

    // Check if languages are the same
    if (sourceLanguage === targetLanguage) {
        result.errors.push('Source and target languages cannot be the same');
        result.isValid = false;
    }

    // Set service support based on both languages
    result.serviceSupport.transcribe = sourceValidation.serviceSupport.transcribe;
    result.serviceSupport.translate = sourceValidation.serviceSupport.translate && targetValidation.serviceSupport.translate;
    result.serviceSupport.polly = targetValidation.serviceSupport.polly;

    return result;
}

/**
 * Get all validation issues for the current language configuration
 */
export function validateAllLanguages(): Record<string, LanguageValidationResult> {
    const results: Record<string, LanguageValidationResult> = {};
    
    SUPPORTED_LANGUAGES.forEach(language => {
        if (language.isSupported) {
            results[language.code] = validateLanguageCode(language.code);
        }
    });
    
    return results;
}

/**
 * Get summary of language support across services
 */
export function getLanguageSupportSummary(): {
    totalLanguages: number;
    transcribeSupported: number;
    translateSupported: number;
    pollySupported: number;
    fullySupported: number;
    issues: string[];
} {
    const validationResults = validateAllLanguages();
    const issues: string[] = [];
    
    let transcribeSupported = 0;
    let translateSupported = 0;
    let pollySupported = 0;
    let fullySupported = 0;
    
    Object.entries(validationResults).forEach(([languageCode, result]) => {
        if (result.serviceSupport.transcribe) transcribeSupported++;
        if (result.serviceSupport.translate) translateSupported++;
        if (result.serviceSupport.polly) pollySupported++;
        
        if (result.serviceSupport.transcribe && result.serviceSupport.translate && result.serviceSupport.polly) {
            fullySupported++;
        }
        
        if (result.errors.length > 0) {
            issues.push(`${languageCode}: ${result.errors.join(', ')}`);
        }
        
        if (result.warnings.length > 0) {
            issues.push(`${languageCode}: ${result.warnings.join(', ')}`);
        }
    });
    
    return {
        totalLanguages: Object.keys(validationResults).length,
        transcribeSupported,
        translateSupported,
        pollySupported,
        fullySupported,
        issues
    };
}

/**
 * Check if a language pair is safe to use (no critical errors)
 */
export function isLanguagePairSafe(sourceLanguage: string, targetLanguage: string): boolean {
    const validation = validateLanguagePair(sourceLanguage, targetLanguage);
    return validation.isValid && validation.serviceSupport.transcribe && validation.serviceSupport.translate;
}

/**
 * Get recommended language pairs for healthcare scenarios
 */
export function getRecommendedLanguagePairs(): Array<{ source: string; target: string; reason: string }> {
    const recommendations = [
        { source: 'en-US', target: 'es-US', reason: 'Most common healthcare language pair in US' },
        { source: 'en-US', target: 'es-ES', reason: 'Common for international patients' },
        { source: 'en-US', target: 'fr-FR', reason: 'Common in multilingual healthcare settings' },
        { source: 'en-US', target: 'de-DE', reason: 'Common for medical research and documentation' },
        { source: 'en-US', target: 'zh-CN', reason: 'Large patient population' },
        { source: 'en-US', target: 'ar-AE', reason: 'Growing patient demographic' },
        { source: 'es-US', target: 'en-US', reason: 'Reverse translation for Spanish speakers' },
        { source: 'fr-FR', target: 'en-US', reason: 'Reverse translation for French speakers' }
    ];
    
    // Filter to only include safe language pairs
    return recommendations.filter(pair => isLanguagePairSafe(pair.source, pair.target));
}

/**
 * Development helper: Log all language validation issues
 */
export function logLanguageValidationIssues(): void {
    if (process.env.NODE_ENV === 'development') {
        const summary = getLanguageSupportSummary();
        
        console.log('🌐 Language Support Summary:');
        console.log(`  Total Languages: ${summary.totalLanguages}`);
        console.log(`  Transcribe Support: ${summary.transcribeSupported}/${summary.totalLanguages}`);
        console.log(`  Translate Support: ${summary.translateSupported}/${summary.totalLanguages}`);
        console.log(`  Polly Support: ${summary.pollySupported}/${summary.totalLanguages}`);
        console.log(`  Fully Supported: ${summary.fullySupported}/${summary.totalLanguages}`);
        
        if (summary.issues.length > 0) {
            console.warn('⚠️ Language Issues:');
            summary.issues.forEach(issue => console.warn(`  - ${issue}`));
        } else {
            console.log('✅ No language validation issues found');
        }
        
        const recommendations = getRecommendedLanguagePairs();
        console.log(`🎯 Recommended Language Pairs: ${recommendations.length}`);
        recommendations.forEach(rec => {
            console.log(`  - ${rec.source} → ${rec.target}: ${rec.reason}`);
        });
    }
}