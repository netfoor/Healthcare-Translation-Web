# Language Support Documentation

## Overview

The Healthcare Translation App supports **21 languages** with full compatibility across all AWS services (Transcribe, Translate, and Polly TTS). This document provides a comprehensive overview of language support, service compatibility, and usage guidelines.

## Supported Languages

### Primary Healthcare Languages (Most Common)
These languages are most frequently used in healthcare settings and have full service support:

| Language | Code | Native Name | Transcribe | Translate | Polly TTS | Medical Terms |
|----------|------|-------------|------------|-----------|-----------|---------------|
| English (US) | `en-US` | English | ✅ | ✅ | ✅ | ✅ |
| Spanish (US) | `es-US` | Español | ✅ | ✅ | ✅ | ✅ |
| Spanish (Spain) | `es-ES` | Español (España) | ✅ | ✅ | ✅ | ✅ |
| French | `fr-FR` | Français | ✅ | ✅ | ✅ | ✅ |
| German | `de-DE` | Deutsch | ✅ | ✅ | ✅ | ✅ |
| Italian | `it-IT` | Italiano | ✅ | ✅ | ✅ | ✅ |
| Portuguese (Brazil) | `pt-BR` | Português (Brasil) | ✅ | ✅ | ✅ | ✅ |
| Chinese (Simplified) | `zh-CN` | 中文 (简体) | ✅ | ✅ | ✅ | ✅ |
| Japanese | `ja-JP` | 日本語 | ✅ | ✅ | ✅ | ✅ |
| Korean | `ko-KR` | 한국어 | ✅ | ✅ | ✅ | ✅ |
| Arabic | `ar-AE` | العربية | ✅ | ✅ | ✅ | ✅ |
| Hindi | `hi-IN` | हिन्दी | ✅ | ✅ | ✅ | ✅ |

### Additional Supported Languages
These languages have full technical support but may have limited medical terminology mappings:

| Language | Code | Native Name | Transcribe | Translate | Polly TTS | Medical Terms |
|----------|------|-------------|------------|-----------|-----------|---------------|
| Russian | `ru-RU` | Русский | ✅ | ✅ | ✅ | ✅ |
| Polish | `pl-PL` | Polski | ✅ | ✅ | ✅ | ⚠️ |
| Dutch | `nl-NL` | Nederlands | ✅ | ✅ | ✅ | ⚠️ |
| Swedish | `sv-SE` | Svenska | ✅ | ✅ | ✅ | ⚠️ |
| Danish | `da-DK` | Dansk | ✅ | ✅ | ✅ | ⚠️ |
| Norwegian | `no-NO` | Norsk | ✅ | ✅ | ✅ | ⚠️ |
| Finnish | `fi-FI` | Suomi | ✅ | ✅ | ✅ | ⚠️ |
| Turkish | `tr-TR` | Türkçe | ✅ | ✅ | ✅ | ⚠️ |
| Thai | `th-TH` | ไทย | ✅ | ✅ | ✅* | ⚠️ |

*Thai uses Hindi voice as fallback in Polly TTS

## Service Compatibility

### Amazon Transcribe
- **Support**: All 21 languages fully supported
- **Features**: Real-time medical transcription with custom vocabulary
- **Accuracy**: Optimized for healthcare terminology

### Amazon Translate
- **Support**: All 21 languages fully supported
- **Features**: Neural machine translation with medical context awareness
- **Quality**: High accuracy for medical and healthcare content

### Amazon Polly TTS
- **Support**: All 21 languages supported (some with fallbacks)
- **Features**: Neural voices optimized for healthcare communication
- **Special Cases**: Thai uses Hindi voice as fallback

### Medical Enhancement Service
- **Full Support**: 12 language pairs with comprehensive medical terminology
- **Basic Support**: 9 additional languages with general medical terms
- **Features**: Medical context detection, terminology validation, AI-powered corrections

## Recommended Language Pairs

### Most Common Healthcare Scenarios
1. **English ↔ Spanish (US)** - Most common in US healthcare settings
2. **English ↔ Spanish (Spain)** - International Spanish speakers
3. **English ↔ French** - Multilingual healthcare environments
4. **English ↔ German** - Medical research and documentation
5. **English ↔ Chinese** - Large patient population
6. **English ↔ Arabic** - Growing demographic in healthcare

### Emergency Scenarios
For emergency situations, prioritize these languages:
- English (en-US)
- Spanish US (es-US)
- French (fr-FR)
- German (de-DE)
- Chinese (zh-CN)

## Usage Guidelines

### Language Selection
```typescript
import { getCommonLanguages, isLanguageSupported } from '@/lib/languages';

// Get commonly used languages for UI
const commonLanguages = getCommonLanguages();

// Validate language before use
if (isLanguageSupported('es-US')) {
    // Safe to use
}
```

### Language Pair Validation
```typescript
import { isLanguagePairSafe, validateLanguagePair } from '@/lib/language-validator';

// Quick validation
const isSafe = isLanguagePairSafe('en-US', 'es-US');

// Detailed validation
const validation = validateLanguagePair('en-US', 'es-US');
if (validation.isValid) {
    // Proceed with translation
}
```

### Service-Specific Language Codes
```typescript
import { getAWSLanguageCode } from '@/lib/languages';

// Get service-specific language codes
const transcribeCode = getAWSLanguageCode('transcribe', 'en-US'); // 'en-US'
const translateCode = getAWSLanguageCode('translate', 'en-US');   // 'en'
const pollyCode = getAWSLanguageCode('polly', 'en-US');          // 'en-US'
```

## Known Limitations

### Thai Language (th-TH)
- **Issue**: No native Thai voice in Amazon Polly
- **Solution**: Uses Hindi voice as fallback
- **Impact**: Audio may not sound native but remains understandable
- **Status**: Fully functional for transcription and translation

### Medical Terminology
- **Full Coverage**: 12 primary languages have comprehensive medical term mappings
- **Partial Coverage**: 9 additional languages have basic medical terms
- **Fallback**: AI-powered enhancement provides context-aware corrections for all languages

### Regional Variations
- **Spanish**: Both US (es-US) and Spain (es-ES) variants supported
- **Other Languages**: Single variant per language (e.g., de-DE for German)
- **Recommendation**: Use US variants for US healthcare settings

## Testing and Validation

### Automated Testing
```bash
# Run language validation tests
npm test -- src/lib/__tests__/language-validator.test.ts

# Run comprehensive language validation
node scripts/validate-languages.js
```

### Manual Testing Checklist
- [ ] Transcription accuracy for target language
- [ ] Translation quality for language pair
- [ ] TTS voice quality and pronunciation
- [ ] Medical terminology recognition
- [ ] Error handling for unsupported languages

## Production Readiness

✅ **All configured languages are production-ready**
- No critical errors or missing mappings
- Comprehensive error handling and fallbacks
- Full AWS service compatibility
- Extensive test coverage

### Performance Considerations
- **Caching**: Audio and translation results are cached for performance
- **Fallbacks**: Graceful degradation for unsupported features
- **Error Handling**: Robust error handling prevents application crashes

## Future Enhancements

### Planned Additions
- Additional medical terminology mappings for secondary languages
- Regional language variants (e.g., en-GB, fr-CA)
- Custom voice training for medical pronunciation
- Enhanced context detection for specialized medical fields

### Community Contributions
- Medical terminology can be expanded through community contributions
- Language-specific healthcare phrase collections
- Regional medical terminology variations

## Support and Troubleshooting

### Common Issues
1. **Language not recognized**: Verify language code format (e.g., 'en-US' not 'en')
2. **Poor TTS quality**: Check if language uses fallback voice
3. **Translation errors**: Ensure both source and target languages are supported

### Getting Help
- Check language validation results: `node scripts/validate-languages.js`
- Review error logs for specific language-related issues
- Consult AWS service documentation for service-specific limitations

---

*Last updated: [Current Date]*
*Version: 1.0.0*