import { 
  BedrockRuntimeClient, 
  InvokeModelCommand 
} from '@aws-sdk/client-bedrock-runtime';

export interface MedicalContext {
  specialty?: string;
  commonTerms?: string[];
  previousContext?: string[];
  urgencyLevel?: 'low' | 'medium' | 'high';
  patientAge?: string;
  symptoms?: string[];
  conditions?: string[];
  medications?: string[];
  procedures?: string[];
}

export interface ContextEnhancementResult {
  enhancedContext: MedicalContext;
  confidence: number;
  detectedTerms: DetectedMedicalTerms;
  recommendations: string[];
  consistencyScore: number;
}

export interface DetectedMedicalTerms {
  symptoms: string[];
  conditions: string[];
  medications: string[];
  procedures: string[];
  anatomicalTerms: string[];
  vitalSigns: string[];
}

export interface TranslationEnhancement {
  originalText: string;
  enhancedTranslation: string;
  medicalTermsPreserved: string[];
  contextualImprovements: string[];
  confidence: number;
  culturalAdaptations: string[];
}

export class MedicalContextService {
  private bedrockClient: BedrockRuntimeClient;
  
  // Comprehensive medical terminology database
  private readonly medicalTerminology = {
    symptoms: [
      'chest pain', 'shortness of breath', 'dyspnea', 'headache', 'nausea', 'vomiting',
      'fever', 'pyrexia', 'cough', 'fatigue', 'dizziness', 'vertigo', 'abdominal pain',
      'palpitations', 'syncope', 'diaphoresis', 'malaise', 'anorexia', 'weight loss',
      'edema', 'orthopnea', 'paroxysmal nocturnal dyspnea', 'claudication'
    ],
    conditions: [
      'hypertension', 'diabetes mellitus', 'asthma', 'pneumonia', 'bronchitis',
      'myocardial infarction', 'stroke', 'sepsis', 'pneumothorax', 'heart failure',
      'atrial fibrillation', 'chronic obstructive pulmonary disease', 'copd',
      'acute coronary syndrome', 'pulmonary embolism', 'deep vein thrombosis'
    ],
    medications: [
      'aspirin', 'acetylsalicylic acid', 'ibuprofen', 'acetaminophen', 'paracetamol',
      'lisinopril', 'metformin', 'albuterol', 'prednisone', 'amoxicillin',
      'warfarin', 'insulin', 'metoprolol', 'amlodipine', 'atorvastatin',
      'furosemide', 'omeprazole', 'levothyroxine', 'clopidogrel'
    ],
    procedures: [
      'electrocardiogram', 'ecg', 'ekg', 'x-ray', 'radiograph', 'ct scan',
      'computed tomography', 'mri', 'magnetic resonance imaging', 'ultrasound',
      'blood test', 'complete blood count', 'cbc', 'biopsy', 'endoscopy',
      'catheterization', 'intubation', 'lumbar puncture', 'thoracentesis'
    ],
    anatomicalTerms: [
      'heart', 'cardiac', 'lung', 'pulmonary', 'brain', 'cerebral', 'liver',
      'hepatic', 'kidney', 'renal', 'stomach', 'gastric', 'intestine',
      'abdomen', 'thorax', 'pelvis', 'extremities', 'spine', 'vertebral'
    ],
    vitalSigns: [
      'blood pressure', 'bp', 'heart rate', 'hr', 'pulse', 'respiratory rate',
      'rr', 'temperature', 'oxygen saturation', 'spo2', 'pulse oximetry'
    ]
  };

  // Medical specialty indicators
  private readonly specialtyIndicators = {
    cardiology: [
      'chest pain', 'heart rate', 'blood pressure', 'ecg', 'ekg', 'myocardial infarction',
      'cardiac', 'coronary', 'arrhythmia', 'palpitations', 'angina', 'heart failure'
    ],
    neurology: [
      'headache', 'dizziness', 'stroke', 'seizure', 'neurological', 'brain',
      'cerebral', 'vertigo', 'syncope', 'paralysis', 'weakness', 'numbness'
    ],
    respiratory: [
      'shortness of breath', 'dyspnea', 'cough', 'pneumonia', 'asthma', 'respiratory',
      'lung', 'pulmonary', 'bronchitis', 'copd', 'oxygen', 'breathing'
    ],
    emergency: [
      'trauma', 'emergency', 'urgent', 'critical', 'acute', 'severe', 'life-threatening',
      'resuscitation', 'code blue', 'cardiac arrest', 'shock', 'unconscious'
    ],
    gastroenterology: [
      'abdominal pain', 'nausea', 'vomiting', 'diarrhea', 'constipation', 'gastric',
      'intestinal', 'liver', 'hepatic', 'gallbladder', 'pancreas'
    ],
    orthopedics: [
      'fracture', 'bone', 'joint', 'muscle', 'ligament', 'tendon', 'spine',
      'back pain', 'arthritis', 'osteoporosis', 'dislocation'
    ]
  };

  // Urgency level keywords
  private readonly urgencyKeywords = {
    high: [
      'emergency', 'urgent', 'critical', 'severe', 'acute', 'immediate', 'stat',
      'life-threatening', 'unstable', 'deteriorating', 'code', 'arrest'
    ],
    medium: [
      'moderate', 'concerning', 'significant', 'notable', 'worsening',
      'progressive', 'persistent', 'recurrent', 'chronic exacerbation'
    ],
    low: [
      'mild', 'slight', 'minor', 'routine', 'follow-up', 'stable', 'improving',
      'resolved', 'maintenance', 'preventive', 'screening'
    ]
  };

  constructor() {
    this.bedrockClient = new BedrockRuntimeClient({});
  }

  /**
   * Detect and classify medical terms in text
   */
  public detectMedicalTerms(text: string): DetectedMedicalTerms {
    const lowerText = text.toLowerCase();
    
    const detectedTerms: DetectedMedicalTerms = {
      symptoms: [],
      conditions: [],
      medications: [],
      procedures: [],
      anatomicalTerms: [],
      vitalSigns: []
    };

    // Check each category of medical terms
    Object.entries(this.medicalTerminology).forEach(([category, terms]) => {
      terms.forEach(term => {
        if (lowerText.includes(term.toLowerCase())) {
          (detectedTerms as any)[category].push(term);
        }
      });
    });

    // Remove duplicates
    Object.keys(detectedTerms).forEach(category => {
      (detectedTerms as any)[category] = [...new Set((detectedTerms as any)[category])];
    });

    return detectedTerms;
  }

  /**
   * Analyze medical context and determine specialty, urgency, etc.
   */
  public analyzeMedicalContext(text: string, providedContext?: MedicalContext): MedicalContext {
    const detectedTerms = this.detectMedicalTerms(text);
    
    // Determine likely medical specialty
    let likelySpecialty = 'general';
    let maxMatches = 0;
    
    Object.entries(this.specialtyIndicators).forEach(([specialty, indicators]) => {
      const matches = indicators.filter(indicator => 
        text.toLowerCase().includes(indicator.toLowerCase())
      ).length;
      
      if (matches > maxMatches) {
        maxMatches = matches;
        likelySpecialty = specialty;
      }
    });

    // Determine urgency level
    let urgencyLevel: 'low' | 'medium' | 'high' = 'medium';
    Object.entries(this.urgencyKeywords).forEach(([level, keywords]) => {
      if (keywords.some(keyword => text.toLowerCase().includes(keyword.toLowerCase()))) {
        urgencyLevel = level as 'low' | 'medium' | 'high';
      }
    });

    // Extract symptoms, conditions, etc. from detected terms
    const symptoms = detectedTerms.symptoms;
    const conditions = detectedTerms.conditions;
    const medications = detectedTerms.medications;
    const procedures = detectedTerms.procedures;

    return {
      specialty: likelySpecialty,
      urgencyLevel,
      symptoms,
      conditions,
      medications,
      procedures,
      commonTerms: [
        ...symptoms,
        ...conditions,
        ...medications,
        ...procedures
      ].slice(0, 10), // Limit to top 10 terms
      ...providedContext
    };
  }

  /**
   * Enhance medical context using Bedrock AI
   */
  public async enhanceMedicalContext(
    text: string, 
    baseContext: MedicalContext
  ): Promise<ContextEnhancementResult> {
    try {
      const detectedTerms = this.detectMedicalTerms(text);
      
      // Create prompt for context enhancement
      const enhancementPrompt = this.createContextEnhancementPrompt(text, baseContext, detectedTerms);
      
      // Call Bedrock for enhanced analysis
      const enhancedResult = await this.invokeBedrockModel(
        'anthropic.claude-3-haiku-20240307-v1:0',
        enhancementPrompt,
        {
          max_tokens: 800,
          temperature: 0.1,
          top_p: 0.8
        }
      );

      // Parse the enhanced context
      const enhancedContext = this.parseEnhancedContext(enhancedResult, baseContext);
      
      // Calculate confidence and consistency scores
      const confidence = this.calculateContextConfidence(detectedTerms, enhancedContext);
      const consistencyScore = this.calculateConsistencyScore(text, enhancedContext);
      
      // Generate recommendations
      const recommendations = this.generateContextRecommendations(enhancedContext, detectedTerms);

      return {
        enhancedContext,
        confidence,
        detectedTerms,
        recommendations,
        consistencyScore
      };
    } catch (error) {
      console.error('Context enhancement error:', error);
      
      // Fallback to basic analysis
      return {
        enhancedContext: baseContext,
        confidence: 0.5,
        detectedTerms: this.detectMedicalTerms(text),
        recommendations: ['Context enhancement unavailable - using basic analysis'],
        consistencyScore: 0.6
      };
    }
  }

  /**
   * Enhance translation with medical context awareness
   */
  public async enhanceTranslationWithContext(
    originalText: string,
    translation: string,
    inputLanguage: string,
    outputLanguage: string,
    medicalContext: MedicalContext
  ): Promise<TranslationEnhancement> {
    try {
      const detectedTerms = this.detectMedicalTerms(originalText);
      
      // Create prompt for translation enhancement
      const enhancementPrompt = this.createTranslationEnhancementPrompt(
        originalText,
        translation,
        inputLanguage,
        outputLanguage,
        medicalContext,
        detectedTerms
      );

      // Call Bedrock for translation enhancement
      const enhancedResult = await this.invokeBedrockModel(
        'anthropic.claude-3-sonnet-20240229-v1:0',
        enhancementPrompt,
        {
          max_tokens: 1200,
          temperature: 0.2,
          top_p: 0.9
        }
      );

      // Parse the enhanced translation
      const enhancedTranslation = this.parseEnhancedTranslation(enhancedResult);
      
      // Analyze improvements
      const medicalTermsPreserved = this.identifyPreservedMedicalTerms(originalText, enhancedTranslation);
      const contextualImprovements = this.identifyContextualImprovements(translation, enhancedTranslation);
      const culturalAdaptations = this.identifyCulturalAdaptations(enhancedTranslation, outputLanguage);
      
      // Calculate confidence
      const confidence = this.calculateTranslationEnhancementConfidence(
        originalText,
        translation,
        enhancedTranslation,
        detectedTerms
      );

      return {
        originalText,
        enhancedTranslation,
        medicalTermsPreserved,
        contextualImprovements,
        confidence,
        culturalAdaptations
      };
    } catch (error) {
      console.error('Translation enhancement error:', error);
      
      // Return original translation with basic analysis
      return {
        originalText,
        enhancedTranslation: translation,
        medicalTermsPreserved: [],
        contextualImprovements: [],
        confidence: 0.5,
        culturalAdaptations: []
      };
    }
  }

  /**
   * Check consistency of medical terminology across translations
   */
  public checkTerminologyConsistency(
    translations: Array<{ original: string; translated: string; language: string }>
  ): {
    consistencyScore: number;
    inconsistentTerms: Array<{ term: string; variations: string[] }>;
    recommendations: string[];
  } {
    const termMappings = new Map<string, Set<string>>();
    
    // Analyze each translation for medical terms
    translations.forEach(({ original, translated }) => {
      const originalTerms = this.detectMedicalTerms(original);
      const translatedTerms = this.detectMedicalTerms(translated);
      
      // Map original terms to translated terms (simplified approach)
      Object.values(originalTerms).flat().forEach(term => {
        if (!termMappings.has(term)) {
          termMappings.set(term, new Set());
        }
        
        // Find corresponding translated terms (this is a simplified heuristic)
        Object.values(translatedTerms).flat().forEach(translatedTerm => {
          termMappings.get(term)!.add(translatedTerm);
        });
      });
    });

    // Identify inconsistent terms
    const inconsistentTerms: Array<{ term: string; variations: string[] }> = [];
    let totalTerms = 0;
    let consistentTerms = 0;

    termMappings.forEach((variations, term) => {
      totalTerms++;
      if (variations.size <= 1) {
        consistentTerms++;
      } else {
        inconsistentTerms.push({
          term,
          variations: Array.from(variations)
        });
      }
    });

    const consistencyScore = totalTerms > 0 ? consistentTerms / totalTerms : 1.0;

    // Generate recommendations
    const recommendations: string[] = [];
    if (consistencyScore < 0.8) {
      recommendations.push('Consider standardizing medical terminology across translations');
    }
    if (inconsistentTerms.length > 0) {
      recommendations.push(`Review ${inconsistentTerms.length} terms with multiple translations`);
    }
    if (consistencyScore > 0.9) {
      recommendations.push('Medical terminology consistency is excellent');
    }

    return {
      consistencyScore,
      inconsistentTerms,
      recommendations
    };
  }

  // Private helper methods

  private async invokeBedrockModel(
    modelId: string,
    prompt: string,
    parameters: any
  ): Promise<string> {
    const requestBody = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: parameters.max_tokens || 1000,
      temperature: parameters.temperature || 0.1,
      top_p: parameters.top_p || 0.9,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    };

    const command = new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(requestBody)
    });

    const response = await this.bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    return responseBody.content[0].text;
  }

  private createContextEnhancementPrompt(
    text: string,
    baseContext: MedicalContext,
    detectedTerms: DetectedMedicalTerms
  ): string {
    return `You are a medical context analysis expert. Analyze the following medical text and enhance the context information:

Text: "${text}"

Current context analysis:
- Specialty: ${baseContext.specialty || 'unknown'}
- Urgency: ${baseContext.urgencyLevel || 'unknown'}
- Symptoms: ${baseContext.symptoms?.join(', ') || 'none detected'}
- Conditions: ${baseContext.conditions?.join(', ') || 'none detected'}

Detected medical terms:
- Symptoms: ${detectedTerms.symptoms.join(', ')}
- Conditions: ${detectedTerms.conditions.join(', ')}
- Medications: ${detectedTerms.medications.join(', ')}
- Procedures: ${detectedTerms.procedures.join(', ')}

Please provide enhanced analysis in JSON format with:
1. Refined medical specialty (be specific, e.g., "interventional cardiology" vs "cardiology")
2. More precise urgency assessment
3. Additional medical insights not captured in basic analysis
4. Potential differential diagnoses if applicable
5. Treatment context (emergency, outpatient, inpatient, etc.)
6. Patient care pathway stage (triage, diagnosis, treatment, follow-up)

Enhanced context:`;
  }

  private createTranslationEnhancementPrompt(
    originalText: string,
    translation: string,
    inputLanguage: string,
    outputLanguage: string,
    medicalContext: MedicalContext,
    detectedTerms: DetectedMedicalTerms
  ): string {
    return `You are a medical translation specialist. Enhance the following medical translation for accuracy and cultural appropriateness:

Original text (${inputLanguage}): "${originalText}"
Current translation (${outputLanguage}): "${translation}"

Medical context:
- Specialty: ${medicalContext.specialty}
- Urgency: ${medicalContext.urgencyLevel}
- Key medical terms: ${detectedTerms.symptoms.concat(detectedTerms.conditions).join(', ')}

Please provide an enhanced translation that:
1. Uses precise medical terminology in ${outputLanguage}
2. Maintains clinical accuracy and meaning
3. Considers cultural healthcare communication norms for ${outputLanguage} speakers
4. Preserves urgency and emotional tone appropriate for medical context
5. Uses standard medical abbreviations and units for ${outputLanguage} healthcare systems

Enhanced translation (${outputLanguage}):`;
  }

  private parseEnhancedContext(result: string, baseContext: MedicalContext): MedicalContext {
    try {
      // Try to parse JSON response
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          ...baseContext,
          ...parsed
        };
      }
    } catch (error) {
      console.warn('Failed to parse enhanced context JSON');
    }

    // Fallback to text parsing
    return {
      ...baseContext,
      // Extract any additional insights from text response
    };
  }

  private parseEnhancedTranslation(result: string): string {
    // Extract the enhanced translation from the response
    const lines = result.split('\n');
    const translationLine = lines.find(line => 
      line.toLowerCase().includes('enhanced translation') ||
      line.toLowerCase().includes('improved translation') ||
      (!line.toLowerCase().includes('original') && line.trim().length > 10)
    );
    
    return translationLine ? 
      translationLine.replace(/^[^:]*:?\s*/, '').trim() : 
      result.trim();
  }

  private calculateContextConfidence(
    detectedTerms: DetectedMedicalTerms,
    enhancedContext: MedicalContext
  ): number {
    let confidence = 0.5;
    
    // More detected terms = higher confidence
    const totalTerms = Object.values(detectedTerms).flat().length;
    confidence += Math.min(0.3, totalTerms * 0.05);
    
    // Specific specialty detection increases confidence
    if (enhancedContext.specialty && enhancedContext.specialty !== 'general') {
      confidence += 0.15;
    }
    
    // Clear urgency level increases confidence
    if (enhancedContext.urgencyLevel && enhancedContext.urgencyLevel !== 'medium') {
      confidence += 0.05;
    }
    
    return Math.min(0.95, confidence);
  }

  private calculateConsistencyScore(text: string, context: MedicalContext): number {
    let score = 0.6;
    
    // Check if detected specialty aligns with text content
    if (context.specialty) {
      const specialtyTerms = this.specialtyIndicators[context.specialty as keyof typeof this.specialtyIndicators] || [];
      const matchingTerms = specialtyTerms.filter(term => 
        text.toLowerCase().includes(term.toLowerCase())
      ).length;
      
      score += Math.min(0.3, matchingTerms * 0.1);
    }
    
    // Check urgency consistency
    if (context.urgencyLevel) {
      const urgencyTerms = this.urgencyKeywords[context.urgencyLevel] || [];
      const matchingUrgencyTerms = urgencyTerms.filter(term =>
        text.toLowerCase().includes(term.toLowerCase())
      ).length;
      
      score += Math.min(0.1, matchingUrgencyTerms * 0.05);
    }
    
    return Math.min(0.95, score);
  }

  private generateContextRecommendations(
    context: MedicalContext,
    detectedTerms: DetectedMedicalTerms
  ): string[] {
    const recommendations: string[] = [];
    
    const totalTerms = Object.values(detectedTerms).flat().length;
    
    if (totalTerms < 3) {
      recommendations.push('Consider adding more specific medical details for better context analysis');
    }
    
    if (context.urgencyLevel === 'high') {
      recommendations.push('High urgency detected - prioritize immediate medical attention language');
    }
    
    if (context.specialty === 'general') {
      recommendations.push('Medical specialty unclear - consider adding specialty-specific terminology');
    }
    
    if (detectedTerms.symptoms.length > 0 && detectedTerms.conditions.length === 0) {
      recommendations.push('Symptoms detected without clear conditions - consider diagnostic context');
    }
    
    return recommendations;
  }

  private identifyPreservedMedicalTerms(original: string, enhanced: string): string[] {
    const originalTerms = this.detectMedicalTerms(original);
    const enhancedTerms = this.detectMedicalTerms(enhanced);
    
    const preserved: string[] = [];
    
    Object.values(originalTerms).flat().forEach(term => {
      if (Object.values(enhancedTerms).flat().some(enhancedTerm => 
        enhancedTerm.toLowerCase().includes(term.toLowerCase()) ||
        term.toLowerCase().includes(enhancedTerm.toLowerCase())
      )) {
        preserved.push(term);
      }
    });
    
    return preserved;
  }

  private identifyContextualImprovements(original: string, enhanced: string): string[] {
    const improvements: string[] = [];
    
    // Simple heuristics for identifying improvements
    if (enhanced.length > original.length * 1.1) {
      improvements.push('Added contextual details');
    }
    
    if (enhanced.includes('mg') || enhanced.includes('ml') || enhanced.includes('°C')) {
      improvements.push('Standardized medical units');
    }
    
    if (enhanced.split(' ').length > original.split(' ').length) {
      improvements.push('Enhanced medical terminology');
    }
    
    return improvements;
  }

  private identifyCulturalAdaptations(translation: string, language: string): string[] {
    const adaptations: string[] = [];
    
    // Language-specific adaptations (simplified examples)
    const culturalIndicators = {
      'es': ['señor', 'señora', 'doctor', 'doctora'],
      'fr': ['monsieur', 'madame', 'docteur'],
      'de': ['herr', 'frau', 'doktor'],
      'it': ['signore', 'signora', 'dottore']
    };
    
    const indicators = culturalIndicators[language as keyof typeof culturalIndicators] || [];
    indicators.forEach(indicator => {
      if (translation.toLowerCase().includes(indicator)) {
        adaptations.push(`Cultural title usage: ${indicator}`);
      }
    });
    
    return adaptations;
  }

  private calculateTranslationEnhancementConfidence(
    original: string,
    basicTranslation: string,
    enhanced: string,
    detectedTerms: DetectedMedicalTerms
  ): number {
    let confidence = 0.6;
    
    // Medical terms preservation
    const preservedTerms = this.identifyPreservedMedicalTerms(original, enhanced);
    const totalMedicalTerms = Object.values(detectedTerms).flat().length;
    
    if (totalMedicalTerms > 0) {
      confidence += (preservedTerms.length / totalMedicalTerms) * 0.25;
    }
    
    // Enhancement quality indicators
    if (enhanced.length >= basicTranslation.length * 0.9) {
      confidence += 0.1; // Maintained content
    }
    
    if (enhanced !== basicTranslation) {
      confidence += 0.05; // Actually enhanced
    }
    
    return Math.min(0.9, confidence);
  }
}