import {
    validateLanguageCode,
    validateLanguagePair,
    getLanguageSupportSummary,
    isLanguagePairSafe,
    getRecommendedLanguagePairs
} from '../language-validator';

describe('Language Validator', () => {
    describe('validateLanguageCode', () => {
        it('should validate supported languages', () => {
            const result = validateLanguageCode('en-US');
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.serviceSupport.transcribe).toBe(true);
            expect(result.serviceSupport.translate).toBe(true);
            expect(result.serviceSupport.polly).toBe(true);
        });

        it('should reject unsupported languages', () => {
            const result = validateLanguageCode('xx-XX');
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain("Language code 'xx-XX' is not in the supported languages list");
        });

        it('should handle Thai language correctly', () => {
            const result = validateLanguageCode('th-TH');
            expect(result.isValid).toBe(true);
            expect(result.serviceSupport.transcribe).toBe(true);
            expect(result.serviceSupport.translate).toBe(true);
            expect(result.serviceSupport.polly).toBe(true);
        });
    });

    describe('validateLanguagePair', () => {
        it('should validate common language pairs', () => {
            const result = validateLanguagePair('en-US', 'es-US');
            expect(result.isValid).toBe(true);
            expect(result.serviceSupport.transcribe).toBe(true);
            expect(result.serviceSupport.translate).toBe(true);
            expect(result.serviceSupport.polly).toBe(true);
        });

        it('should reject same source and target languages', () => {
            const result = validateLanguagePair('en-US', 'en-US');
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Source and target languages cannot be the same');
        });

        it('should handle unsupported source language', () => {
            const result = validateLanguagePair('xx-XX', 'en-US');
            expect(result.isValid).toBe(false);
            expect(result.errors.some(e => e.includes('Source language validation failed'))).toBe(true);
        });
    });

    describe('getLanguageSupportSummary', () => {
        it('should provide comprehensive language support summary', () => {
            const summary = getLanguageSupportSummary();
            expect(summary.totalLanguages).toBeGreaterThan(0);
            expect(summary.transcribeSupported).toBeGreaterThan(0);
            expect(summary.translateSupported).toBeGreaterThan(0);
            expect(summary.pollySupported).toBeGreaterThan(0);
            expect(summary.fullySupported).toBeGreaterThan(0);
            expect(Array.isArray(summary.issues)).toBe(true);
        });
    });

    describe('isLanguagePairSafe', () => {
        it('should return true for safe language pairs', () => {
            expect(isLanguagePairSafe('en-US', 'es-US')).toBe(true);
            expect(isLanguagePairSafe('en-US', 'fr-FR')).toBe(true);
        });

        it('should return false for unsafe language pairs', () => {
            expect(isLanguagePairSafe('xx-XX', 'en-US')).toBe(false);
            expect(isLanguagePairSafe('en-US', 'en-US')).toBe(false);
        });
    });

    describe('getRecommendedLanguagePairs', () => {
        it('should return recommended language pairs', () => {
            const recommendations = getRecommendedLanguagePairs();
            expect(Array.isArray(recommendations)).toBe(true);
            expect(recommendations.length).toBeGreaterThan(0);
            
            // Check that all recommendations are safe
            recommendations.forEach(rec => {
                expect(isLanguagePairSafe(rec.source, rec.target)).toBe(true);
            });
        });

        it('should include common healthcare language pairs', () => {
            const recommendations = getRecommendedLanguagePairs();
            const pairs = recommendations.map(r => `${r.source}-${r.target}`);
            
            expect(pairs).toContain('en-US-es-US');
            expect(pairs).toContain('en-US-fr-FR');
        });
    });
});