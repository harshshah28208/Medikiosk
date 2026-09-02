// ============================================================================
// MediKiosk — Client-Side Groq Ultra-Fast Dynamic Clinical Engine
// Model: qwen/qwen3.8-27b (or llama-3.3-70b-versatile)
// Provides instant 200ms autonomous medical intake reasoning in English,
// Hindi, and Gujarati with dynamic lifestyle assessment & closing verification.
// ============================================================================

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || '';

const GROQ_MODEL =
  import.meta.env.VITE_GROQ_MODEL ||
  'qwen/qwen3.8-27b';

export interface GroqIntakeResponse {
  question: string;
  questionLanguage: string;
  questionCategory: string;
  touchOptions: string[];
  isRedFlag: boolean;
  redFlagReason?: string | null;
  isComplete: boolean;
  clinicalRationale?: string;
}

export async function callGroqDynamicIntake(
  clinicalState: any,
  language: 'EN' | 'HI' | 'GU' = 'EN',
  conversationHistory: Array<{ role: string; content: string }> = []
): Promise<GroqIntakeResponse> {
  const isNew = !clinicalState.isReturning && !clinicalState.previousVisitInfo;
  const prevInfo = clinicalState.previousVisitInfo;

  const historyFormatted = conversationHistory
    .map((m) => `${m.role === 'AI' ? 'Doctor AI' : 'Patient'}: "${m.content}"`)
    .join('\n');

const prompt = `You are MediKiosk Autonomous Clinical AI Intake Doctor.
Conduct an empathetic, comprehensive, multi-turn clinical intake interview with the patient in pure ${language === 'GU' ? 'Gujarati (શુદ્ધ ગુજરાતી ભાષા અને લિપિ)' : language === 'HI' ? 'Hindi (शुद्ध हिन्दी भाषा और देवनागरी लिपि)' : 'English'}.

CONVERSATION TRANSCRIPT SO FAR:
${historyFormatted || 'Turn 0 - Intake Just Started'}

PATIENT CONTEXT:
Patient Type: ${isNew ? 'NEW PATIENT (First hospital visit)' : 'EXISTING / RETURNING PATIENT (Follow-up visit)'}
Doctor Specialty: ${clinicalState.specialty || clinicalState.department || 'General Medicine'}
Care Path: ${clinicalState.carePath || 'ALLOPATHY'}
${!isNew && prevInfo ? `Prior Chief Complaint to Follow-up: "${prevInfo.lastComplaint || 'Previous health condition'}"
Prior Department: ${prevInfo.lastDepartment || 'General Medicine'}
Prior Meds: ${prevInfo.pastPrescriptions?.join(', ') || 'None'}` : ''}
Chief Complaint: "${clinicalState.chiefComplaint || ''}"
Latest Answer: "${clinicalState.latestAnswer || ''}"
Target Language: ${language} (EN = English, HI = Hindi, GU = Gujarati)

DYNAMIC CLINICAL REASONING RULES (100% TAILORED TO THE SPECIFIC DISEASE/COMPLAINT):
1. DYNAMIC DISEASE-SPECIFIC QUESTIONING:
   - Formulate every single question to investigate the EXACT disease, anatomy, and symptoms mentioned by the patient.
   - For Neurological/Headache: Dynamically explore throbbing vs dull, visual aura (zigzag/flashes), nausea, light/sound sensitivity, neck stiffness.
   - For Cardiovascular/Chest: Dynamically explore chest tightness/heaviness, radiation to left arm/shoulder/jaw, cold sweats, breathlessness upon exertion.
   - For Respiratory/Cough/Asthma: Dynamically explore dry vs productive cough, sputum color/thickness, wheezing/whistling sounds, night-time breathlessness.
   - For Gastrointestinal/Abdomen/Acidity: Dynamically explore exact location (upper abdomen, right/left side), burning vs cramping, relation to meals, vomiting, bowel habits.
   - For Orthopedic/Joint/Back: Dynamically explore morning stiffness duration, pain on walking/stairs, swelling, sciatica radiation down the leg.
   - For Dermatology/Skin: Dynamically explore rash location, intense itching, redness, blisters/pus, weeping or scaling, cosmetic triggers.
   - For Pediatric/ENT/Fever: Dynamically explore fever grade/chills, ear discharge, throat pain/swallowing difficulty, appetite, fluid intake.
   - For AYUSH (Ayurveda): Dynamically explore Doshic imbalance (Pitta burning/sour burps, Kapha heaviness/congestion, Vata dryness/acute ache), Agni (digestive strength), Koshtha (bowel movement), Ahara-Vihara (diet, routine).
   - For HOMEOPATHY: Dynamically explore characteristic sensation, thermal state (chilly vs hot), thirst, mental state, and modalities (< Aggravations vs > Ameliorations).

2. MANDATORY INTAKE DIMENSIONS (EVERY SINGLE ONE MUST BE SYSTEMATICALLY COVERED ACROSS TURNS):
   - Domain 1: Chief Complaint & Exact Anatomical Location (investigate presenting problem in detail)
   - Domain 2: Onset, Duration & Chronology (how many days/hours, sudden vs gradual, continuous vs episodic)
   - Domain 3: Severity (1-10 rating) & Detailed Character / Sensation (exact feeling, radiation, functional restriction)
   - Domain 4: Aggravating Triggers & Relieving Modalities (what worsens it with motion/food/weather/stress; what brings relief)
   - Domain 5: Associated Symptoms & Pertinent Negatives (systemic signs, fever, nausea, dizziness, weakness)
   - Domain 6: Occupation, Daily Work Profile & Ergonomics (desk work, prolonged sitting/standing, heavy physical lifting, field work, screen time, occupational hazards)
   - Domain 7: Daily Lifestyle, Sleep Hygiene (exact hours/night), Dietary Routine (veg/non-veg, meal times, hydration) & Personal Habits (smoking, tobacco, alcohol, exercise)
   - Domain 8: Past Medical History, Surgical History & Family Health Background (BP, Diabetes, Thyroid, Asthma, Heart conditions, family illnesses)
   - Domain 9: Ongoing Prescription Medications (with dosage/frequency) & Known Drug Allergies (Penicillin, Sulfa, NSAIDs, etc.)

3. RIGOROUS PROTOCOL:
   - Do NOT ask generic or repetitive questions. Every question must be dynamic, insightful, and clinically rich.
   - Do NOT conclude with "isComplete": true until questions covering Chief Complaint, Modalities, Occupation & Work Ergonomics, Lifestyle (Sleep/Diet/Habits), Medical & Family History, and Medications/Allergies have ALL been asked.
   - NEVER leave Occupation or Habits as "Unknown" — actively ask the patient directly.
   - For GU (Gujarati): Use pure, respectful Gujarati script and natural grammar.
   - For HI (Hindi): Use pure, respectful Devanagari Hindi script and natural grammar.
   - When all mandatory domains are fully answered, set "isComplete": true and output the polite closing:
     * EN: "Thank you. Your clinical intake is complete and your information has been prepared for the clinical team. Please proceed to your appointment / consultation room." (touchOptions: ["Proceed to Appointment", "Review Summary", "Add One More Detail"])
     * HI: "धन्यवाद। आपकी क्लिनिकल पूछताछ पूरी हो गई है और आपका विवरण डॉक्टर के लिए तैयार कर दिया गया है। कृपया अपने परामर्श कक्ष / अपॉइंटमेंट के लिए आगे बढ़ें।" (touchOptions: ["अपॉइंटमेंट के लिए आगे बढ़ें", "सारांश देखें", "एक और जानकारी जोड़ें"])
     * GU: "ધન્યવાદ. આપની ક્લિનિકલ પૂછપરછ પૂર્ણ થઈ ગઈ છે અને આપની વિગતો ડૉક્ટર માટે તૈયાર છે. કૃપા કરીને આપના કન્સલ્ટેશન / તપાસ રૂમ તરફ આગળ વધો." (touchOptions: ["કન્સલ્ટેશન માટે આગળ વધો", "વિગતો જુઓ", "વધુ એક વિગત ઉમેરો"])

Return ONLY valid JSON (no markdown):
{
  "question": "Dynamic question in pure ${language} tailored to this exact disease/complaint",
  "questionLanguage": "${language}",
  "questionCategory": "ONSET | DURATION | SEVERITY | CHARACTER | OCCUPATION | LIFESTYLE | MEDICATIONS | PAST_HISTORY | AYUSH | CLOSING",
  "touchOptions": ["Option 1 in pure ${language}", "Option 2 in pure ${language}", "Option 3 in pure ${language}"],
  "isRedFlag": false,
  "redFlagReason": null,
  "isComplete": false,
  "clinicalRationale": "Diagnostic reasoning for this step"
}`;

  const candidateModels = [
    GROQ_MODEL,
    'openai/gpt-oss-20b',
    'qwen/qwen3.6-27b',
    'qwen/qwen3.8-27b',
    'allam-2-7b',
    'openai/gpt-oss-120b',
  ];
  const uniqueModels = [...new Set(candidateModels.filter(Boolean))];

  for (const m of uniqueModels) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: m,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: 'You are MediKiosk Autonomous Clinical AI Intake Doctor. Return ONLY valid JSON.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      });

      if (!response.ok) continue;

      const data = await response.json();
      const parsedText = data.choices?.[0]?.message?.content || '{}';
      const parsed = JSON.parse(parsedText);

      if (!Array.isArray(parsed.touchOptions) || parsed.touchOptions.length < 2) {
        parsed.touchOptions = language === 'HI'
          ? ['हाँ, ठीक है', 'नहीं, कोई बदलाव नहीं', 'एक और जानकारी जोड़ें']
          : language === 'GU'
          ? ['હા, બરાબર છે', 'ના, કોઈ ફેરફાર નથી', 'વધુ એક વિગત ઉમેરો']
          : ['Yes, that is correct', 'No changes', 'Add more details'];
      }

      return {
        question: parsed.question || 'Please describe your main symptom in detail.',
        questionLanguage: language,
        questionCategory: parsed.questionCategory || 'ONSET',
        touchOptions: parsed.touchOptions,
        isRedFlag: Boolean(parsed.isRedFlag),
        redFlagReason: parsed.redFlagReason || null,
        isComplete: Boolean(parsed.isComplete),
        clinicalRationale: parsed.clinicalRationale,
      };
    } catch {
      // Continue to next model
    }
  }

  throw new Error('All client Groq candidate models exhausted');
}
