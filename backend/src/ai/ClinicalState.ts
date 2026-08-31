export type AssessmentDomainStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'SUFFICIENT' | 'NOT_APPLICABLE' | 'UNKNOWN' | 'NOT_ASSESSED';

export interface DomainCompletenessState {
  presentingComplaint: {
    status: AssessmentDomainStatus;
    subDomains: {
      exactComplaint: AssessmentDomainStatus;
      location: AssessmentDomainStatus;
      onset: AssessmentDomainStatus;
      duration: AssessmentDomainStatus;
      progression: AssessmentDomainStatus;
      frequencyTiming: AssessmentDomainStatus;
      severity: AssessmentDomainStatus;
      characterQuality: AssessmentDomainStatus;
      triggersAggravatingRelieving: AssessmentDomainStatus;
      associatedSymptoms: AssessmentDomainStatus;
      pertinentNegatives: AssessmentDomainStatus;
    };
  };
  carePathSpecific: {
    status: AssessmentDomainStatus;
    subDomains: {
      // AYUSH / Ayurveda
      agniDigestiveFire: AssessmentDomainStatus;
      koshthaBowelPatterns: AssessmentDomainStatus;
      aharaDietaryHabits: AssessmentDomainStatus;
      viharaDailyRoutine: AssessmentDomainStatus;
      doshaManifestations: AssessmentDomainStatus;
      prakritiVikritiIndicators: AssessmentDomainStatus;
      dashavidhaDimensions: AssessmentDomainStatus;
      // Homeopathy
      characteristicSensations: AssessmentDomainStatus;
      modalitiesAggravations: AssessmentDomainStatus;
      modalitiesAmeliorations: AssessmentDomainStatus;
      thermalState: AssessmentDomainStatus;
      thirstGenerals: AssessmentDomainStatus;
      mentalEmotionalGenerals: AssessmentDomainStatus;
      concomitantsTimePattern: AssessmentDomainStatus;
      // Allopathy
      specialtyOrganSpecifics: AssessmentDomainStatus;
      anatomicalRadiation: AssessmentDomainStatus;
      functionalImpact: AssessmentDomainStatus;
    };
  };
  lifestyle: {
    status: AssessmentDomainStatus;
    subDomains: {
      occupationWorkRoutine: AssessmentDomainStatus;
      physicalActivityExercise: AssessmentDomainStatus;
      dietMealPattern: AssessmentDomainStatus;
      sleepDurationQuality: AssessmentDomainStatus;
      stressDailyExposures: AssessmentDomainStatus;
      habitsSubstanceUse: AssessmentDomainStatus;
    };
  };
  medicalHistory: {
    status: AssessmentDomainStatus;
    subDomains: {
      chronicConditions: AssessmentDomainStatus;
      pastSurgeriesHospitalizations: AssessmentDomainStatus;
      currentMedicationsDoses: AssessmentDomainStatus;
      drugAllergies: AssessmentDomainStatus;
      relevantFamilyHistory: AssessmentDomainStatus;
    };
  };
  followUpProgression?: {
    status: AssessmentDomainStatus;
    subDomains: {
      conditionEvolution: AssessmentDomainStatus;
      medicationAdherence: AssessmentDomainStatus;
      residualOrNewSymptoms: AssessmentDomainStatus;
      priorTreatmentResponse: AssessmentDomainStatus;
    };
  };
  safetyScreening: {
    status: AssessmentDomainStatus;
    redFlagsEvaluated: boolean;
  };
}

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

  // Daily Routine & Lifestyle (Sub-domain drilled)
  lifestyle: {
    sleep: string | null;              // Sleep quality / duration
    sleepDurationHours?: number | null;// Specific hours
    diet: string | null;               // Dietary habits (veg/non-veg, oily, spicy)
    mealPattern?: string | null;       // Regular vs irregular timing
    appetite?: string | null;          // Normal, reduced, excessive
    hydration?: string | null;         // Water intake
    activity: string | null;           // Physical activity / exercise level
    sedentaryHours?: string | null;    // Sedentary desk time
    occupation: string | null;         // Occupation / work routine
    stress: string | null;             // Stress level & mental load
    smoking: string | null;            // Smoking status
    alcohol: string | null;            // Alcohol use
    habits?: string[];                 // Tobacco / caffeine / other exposures
  };

  // Care Path & Specialty Context
  carePath?: 'ALLOPATHY' | 'AYUSH' | 'HOMEOPATHY';
  specialty?: string; // e.g. 'General Medicine', 'Neurology', 'ENT', 'Cardiology', 'Ayurveda', 'Classical Homeopathy'

  // Confirmed vs Denied Symptoms
  deniedSymptoms: string[]; // Explicitly negated symptoms (e.g., "no vomiting", "no fever")
  historicalFindings: string[]; // Past resolved episodes (e.g., "had fever last month")

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

  // AYUSH Assessment (Ayurveda & Integrative Medicine)
  ayushAssessment?: {
    prakriti?: string;          // Vata, Pitta, Kapha constitutional tendencies
    vikriti?: string;           // Current pathological state
    agni?: string;              // Mandagni (sluggish), Tikshnagni (hyperactive), Vishamagni (irregular), Samagni (balanced)
    koshtha?: string;           // Krura (hard/constipated), Mridu (soft/frequent), Madhyama (normal)
    ahara?: string;             // Diet, tastes (Rasa), heavy/spicy preferences
    vihara?: string;            // Daily routine, Ratri Jagarana (late night sleep), daytime sleep
    mutra?: string;             // Urination pattern & burning
    mala?: string;              // Bowel evacuation pattern
    jihva?: string;             // Tongue coating (Ama signs)
    sara?: string;
    satmya?: string;            // Dietary adaptability
    vyayamaShakti?: string;     // Exercise & physical endurance capacity
    aharaShakti?: string;       // Food intake & digestive capacity
    dashavidhaFindings?: string[];// Patient-friendly Dashavidha interpretations
  };

  // Homeopathy Clinical Assessment
  homeopathyAssessment?: {
    miasm?: string;             // Psora, Sycosis, Syphilis, Tubercular
    thermalState?: string;      // Chilly vs Hot patient (blankets vs open air preference)
    thirst?: string;            // Thirsty (large quantities, frequent sips) vs Thirstless
    modalities?: {
      aggravating?: string[];   // < Sun, < Motion, < Cold air, < 3 PM, < Position, etc.
      relieving?: string[];     // > Hard pressure, > Cold compress, > Dark room, > Rest, etc.
    };
    mentalState?: string;       // Irritable, anxious, desires solitude, restless, weepiness
    concomitants?: string[];    // Symptoms appearing simultaneously with chief complaint
    timeModalities?: string[];  // Specific periodicity / time of day
    sensations?: string[];      // Throbbing, bursting, stitching, tearing, band-like
    laterality?: string;        // Right-sided vs Left-sided predominance
  };

  // Domain Completeness State Tracker
  domainCompleteness: DomainCompletenessState;

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

  // Multilingual & Patient metadata
  currentLanguage: 'EN' | 'HI' | 'GU';
  latestAnswer?: string;
  languageHistory: Array<{ lang: string; switchedAt: string }>;
  respondentType?: 'PATIENT' | 'CAREGIVER' | 'STAFF_ASSISTED';
  isNewPatient?: boolean;
  previousVisitInfo?: {
    lastDoctor?: string;
    lastVisitDate?: string;
    lastComplaint?: string;
    lastDepartment?: string;
    pastPrescriptions?: string[];
  };
}

export interface QuestionOutput {
  question: string;
  questionLanguage: 'EN' | 'HI' | 'GU';
  questionCategory: 'CHIEF_COMPLAINT' | 'ONSET' | 'DURATION' | 'SEVERITY' | 'LOCATION' | 'CHARACTER' | 'RADIATION' | 'ASSOCIATED' | 'PAST_HISTORY' | 'LIFESTYLE' | 'MEDICATIONS' | 'ALLERGIES' | 'AYUSH' | 'HOMEOPATHY' | 'CLOSING';
  touchOptions: string[];
  isRedFlag: boolean;
  redFlagReason: string | null;
  isComplete: boolean;
  clinicalRationale: string;
  domainFocus?: string;
  subDomainFocus?: string;
}

export function createInitialDomainCompleteness(): DomainCompletenessState {
  return {
    presentingComplaint: {
      status: 'NOT_STARTED',
      subDomains: {
        exactComplaint: 'NOT_STARTED',
        location: 'NOT_STARTED',
        onset: 'NOT_STARTED',
        duration: 'NOT_STARTED',
        progression: 'NOT_STARTED',
        frequencyTiming: 'NOT_STARTED',
        severity: 'NOT_STARTED',
        characterQuality: 'NOT_STARTED',
        triggersAggravatingRelieving: 'NOT_STARTED',
        associatedSymptoms: 'NOT_STARTED',
        pertinentNegatives: 'NOT_STARTED',
      },
    },
    carePathSpecific: {
      status: 'NOT_STARTED',
      subDomains: {
        agniDigestiveFire: 'NOT_STARTED',
        koshthaBowelPatterns: 'NOT_STARTED',
        aharaDietaryHabits: 'NOT_STARTED',
        viharaDailyRoutine: 'NOT_STARTED',
        doshaManifestations: 'NOT_STARTED',
        prakritiVikritiIndicators: 'NOT_STARTED',
        dashavidhaDimensions: 'NOT_STARTED',
        characteristicSensations: 'NOT_STARTED',
        modalitiesAggravations: 'NOT_STARTED',
        modalitiesAmeliorations: 'NOT_STARTED',
        thermalState: 'NOT_STARTED',
        thirstGenerals: 'NOT_STARTED',
        mentalEmotionalGenerals: 'NOT_STARTED',
        concomitantsTimePattern: 'NOT_STARTED',
        specialtyOrganSpecifics: 'NOT_STARTED',
        anatomicalRadiation: 'NOT_STARTED',
        functionalImpact: 'NOT_STARTED',
      },
    },
    lifestyle: {
      status: 'NOT_STARTED',
      subDomains: {
        occupationWorkRoutine: 'NOT_STARTED',
        physicalActivityExercise: 'NOT_STARTED',
        dietMealPattern: 'NOT_STARTED',
        sleepDurationQuality: 'NOT_STARTED',
        stressDailyExposures: 'NOT_STARTED',
        habitsSubstanceUse: 'NOT_STARTED',
      },
    },
    medicalHistory: {
      status: 'NOT_STARTED',
      subDomains: {
        chronicConditions: 'NOT_STARTED',
        pastSurgeriesHospitalizations: 'NOT_STARTED',
        currentMedicationsDoses: 'NOT_STARTED',
        drugAllergies: 'NOT_STARTED',
        relevantFamilyHistory: 'NOT_STARTED',
      },
    },
    safetyScreening: {
      status: 'IN_PROGRESS',
      redFlagsEvaluated: true,
    },
  };
}

export function createInitialClinicalState(
  language: 'EN' | 'HI' | 'GU' = 'EN',
  respondentType: 'PATIENT' | 'CAREGIVER' | 'STAFF_ASSISTED' = 'PATIENT',
  carePath: 'ALLOPATHY' | 'AYUSH' | 'HOMEOPATHY' = 'ALLOPATHY',
  specialty: string = 'General Medicine'
): ClinicalState {
  return {
    carePath,
    specialty,
    chiefComplaint: null,
    chiefComplaintOriginal: null,
    symptoms: [],
    associatedSymptoms: [],
    deniedSymptoms: [],
    historicalFindings: [],
    pastMedicalHistory: [],
    pastSurgicalHistory: [],
    medications: [],
    allergies: [],
    lifestyle: {
      sleep: null,
      diet: null,
      activity: null,
      occupation: null,
      stress: null,
      smoking: null,
      alcohol: null,
      habits: [],
    },
    familyHistory: [],
    socialHistory: {
      smoking: null,
      alcohol: null,
      occupation: null,
      other: [],
    },
    reviewOfSystems: {},
    domainCompleteness: createInitialDomainCompleteness(),
    redFlags: [],
    questionsAsked: [],
    turnsCompleted: 0,
    completenessScore: 0,
    missingFields: ['chiefComplaint', 'onset', 'duration', 'severity', 'character', 'carePathSpecific', 'lifestyle', 'medicalHistory'],
    confidence: 1.0,
    currentLanguage: language,
    languageHistory: [{ lang: language, switchedAt: new Date().toISOString() }],
    respondentType,
  };
}
