export interface ClinicalState {
  // Core Chief Complaint
  chiefComplaint: string | null;
  chiefComplaintOriginal: string | null; // Raw in patient's language

  // Symptoms (dynamic, unconstrained array)
  symptoms: Array<{
    name: string; // Normalized English (e.g., 'fatigue', 'ear pain', 'chest tightness')
    originalText: string;
    onset: string | null;
    duration: string | null;
    severity: number | null; // 1-10 scale
    location: string | null;
    character: string | null; // sharp, dull, burning, aching, throbbing, etc.
    radiation: string | null;
    aggravatingFactors: string[];
    relievingFactors: string[];
    timing: string | null; // constant, intermittent, morning, night
    progression: string | null; // worsening, improving, unchanged
  }>;

  // Associated Symptoms
  associatedSymptoms: Array<{
    name: string;
    present: boolean | null;
  }>;

  // Medical & Surgical History
  pastMedicalHistory: string[];
  pastSurgicalHistory: string[];

  // Medications & Allergies
  medications: Array<{ name: string; dose?: string; frequency?: string; duration?: string }>;
  allergies: Array<{ allergen: string; reaction?: string; severity?: string }>;

  // Daily Routine & Lifestyle (NEW — Turn 5)
  lifestyle: {
    sleep: string | null;        // Sleep quality / duration
    diet: string | null;         // Dietary habits (veg/non-veg, oily, fast food)
    activity: string | null;     // Physical activity level
    occupation: string | null;   // Occupation / stress exposure
    smoking: string | null;      // Smoking status
    alcohol: string | null;      // Alcohol use
  };

  // Family & Social History
  familyHistory: string[];
  socialHistory: {
    smoking: string | null;
    alcohol: string | null;
    occupation: string | null;
    other: string[];
  };

  // Review of Systems (relevant findings)
  reviewOfSystems: Record<string, string | null>;

  // AYUSH Assessment (if applicable)
  ayushAssessment?: {
    prakriti?: string;
    vikriti?: string;
    agni?: string;
    koshtha?: string;
    ahara?: string;
    vihara?: string;
  };

  // Detected Red Flags
  redFlags: Array<{
    type: string;
    severity: 'HIGH' | 'CRITICAL';
    description: string;
    detectedAt: string;
    source: 'RULE' | 'AI';
  }>;

  // Conversation tracking
  questionsAsked: string[]; // List of previous questions to guarantee NO repetition
  turnsCompleted: number;
  completenessScore: number; // 0 to 100
  missingFields: string[]; // Missing clinical dimensions (e.g., 'onset', 'severity', 'associated')
  confidence: number;

  // Multilingual metadata
  currentLanguage: 'EN' | 'HI' | 'GU';
  languageHistory: Array<{ lang: string; switchedAt: string }>;
  respondentType?: 'PATIENT' | 'CAREGIVER' | 'STAFF_ASSISTED';
}

export interface QuestionOutput {
  question: string;
  questionLanguage: 'EN' | 'HI' | 'GU';
  questionCategory: 'CHIEF_COMPLAINT' | 'ONSET' | 'DURATION' | 'SEVERITY' | 'LOCATION' | 'CHARACTER' | 'RADIATION' | 'ASSOCIATED' | 'PAST_HISTORY' | 'LIFESTYLE' | 'MEDICATIONS' | 'ALLERGIES' | 'AYUSH' | 'CLOSING';
  touchOptions: string[];
  isRedFlag: boolean;
  redFlagReason: string | null;
  isComplete: boolean;
  clinicalRationale: string;
}

export function createInitialClinicalState(language: 'EN' | 'HI' | 'GU' = 'EN', respondentType: 'PATIENT' | 'CAREGIVER' | 'STAFF_ASSISTED' = 'PATIENT'): ClinicalState {
  return {
    chiefComplaint: null,
    chiefComplaintOriginal: null,
    symptoms: [],
    associatedSymptoms: [],
    pastMedicalHistory: [],
    pastSurgicalHistory: [],
    medications: [],
    allergies: [],
    lifestyle: {
      sleep: null,
      diet: null,
      activity: null,
      occupation: null,
      smoking: null,
      alcohol: null,
    },
    familyHistory: [],
    socialHistory: {
      smoking: null,
      alcohol: null,
      occupation: null,
      other: [],
    },
    reviewOfSystems: {},
    redFlags: [],
    questionsAsked: [],
    turnsCompleted: 0,
    completenessScore: 0,
    missingFields: ['chiefComplaint', 'onset', 'duration', 'severity', 'character', 'associatedSymptoms', 'pastMedicalHistory', 'lifestyle', 'medications', 'allergies'],
    confidence: 1.0,
    currentLanguage: language,
    languageHistory: [{ lang: language, switchedAt: new Date().toISOString() }],
    respondentType,
  };
}

