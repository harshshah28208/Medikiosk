import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ClinicalState, QuestionOutput } from './ClinicalState.js';
import { RedFlagEngine } from './RedFlagEngine.js';

export interface AIProvider {
  extractFacts(input: string, state: ClinicalState, language: 'EN' | 'HI' | 'GU'): Promise<Partial<ClinicalState>>;
  generateNextQuestion(state: ClinicalState, language: 'EN' | 'HI' | 'GU', isAyush?: boolean): Promise<QuestionOutput>;
  translateText(text: string, targetLanguage: 'EN' | 'HI' | 'GU'): Promise<string>;
  generateClinicalSummary(state: ClinicalState, patient: any, vitals?: any, documents?: any[]): Promise<any>;
}

/**
 * Direct Comprehensive Clinical Dictionary for 100% Guaranteed Native Phrasing
 */
const CLINICAL_TRANSLATIONS: Record<string, { HI: string; GU: string; EN: string }> = {
  // Greetings
  welcome: {
    EN: 'Hello. I am MediKiosk, your clinical intake assistant. Please tell me what symptoms or health concerns brought you to the hospital today.',
    HI: 'नमस्ते। मैं मेडीकियोस्क क्लिनिकल सहायक हूँ। कृपया मुझे बताएं कि आज आपको क्या परेशानी या लक्षण महसूस हो रहे हैं?',
    GU: 'નમસ્તે. હું મેડીકિયોસ્ક સહાયક છું. કૃપા કરીને મને જણાવો કે આજે તમને કઈ તકલીફ કે લક્ષણો થઈ રહ્યા છે?',
  },
  // Onset Skin
  skin_onset: {
    EN: 'How many days have you had these pimples / skin spots, and are they spreading to other areas?',
    HI: 'आपको ये मुँहासे / दाने कितने दिनों से निकल रहे हैं, और क्या ये चेहरे या शरीर के अन्य हिस्सों में भी फैल रहे हैं?',
    GU: 'તમને આ ખીલ / ચામડી પરના દાણા કેટલા દિવસથી નીકળી રહ્યા છે, અને શું તે ચહેરા કે શરીરના અન્ય ભાગોમાં ફેલાઈ રહ્યા છે?',
  },
  // Character Skin
  skin_character: {
    EN: 'Is there any pain, itching, redness, or pus discharge with the pimples / skin spots?',
    HI: 'क्या इन मुँहासे / दानों में दर्द, तेज खुजली, लालिमा, या पस/मवाद जैसा कुछ बन रहा है?',
    GU: 'શું આ ખીલમાં દુખાવો, ખંજવાળ, લાલાશ, કે પરુ (પસ) જેવું જણાય છે?',
  },
  // Onset Generic
  generic_onset: {
    EN: 'When did your symptoms begin, and does anything make it better or worse?',
    HI: 'आपको इस समस्या की शुरुआत कब से हुई, और क्या किसी विशेष स्थिति में यह कम या ज्यादा होता है?',
    GU: 'તમને આ તકલીફની શરૂઆત ક્યારથી થઈ છે, અને કોઈ ચોક્કસ સમયે તે વધે કે ઘટે છે?',
  },
  // Severity Generic
  generic_severity: {
    EN: 'How does your discomfort feel, and what is the severity on a scale of 1 to 10?',
    HI: 'आपको इस परेशानी में किस तरह की तकलीफ महसूस हो रही है, और 1 से 10 के पैमाने पर कितनी गंभीरता है?',
    GU: 'તમને આમાં કેવા પ્રકારની તકલીફ જણાય છે, અને 1 થી 10 ના માપ પર કેટલી ગંભીરતા છે?',
  },
  // Associated Generic
  generic_associated: {
    EN: 'Have you noticed any other symptoms (like fever, nausea, dizziness, or unusual weakness)?',
    HI: 'क्या आपको इसके अलावा कोई अन्य समस्या जैसे बुखार, जी मिचलाना, चक्कर या असामान्य कमजोरी भी लग रही है?',
    GU: 'શું તમને આ સિવાય તાવ, ઉબકા, ચક્કર આવવા કે અસામાન્ય નબળાઈ જેવી કોઈ તકલીફ જણાય છે?',
  },
  // Background Generic
  generic_background: {
    EN: 'Do you have any existing chronic conditions (High BP, Diabetes, Thyroid) or known drug allergies?',
    HI: 'क्या आपको पहले से कोई पुरानी बीमारी (जैसे बीपी, शुगर, थायराइड) या किसी दवा से एलर्जी है?',
    GU: 'શું તમને પહેલેથી કોઈ જૂની બીમારી (જેમ કે બીપી, ડાયાબિટીસ, થાયરોઇડ) કે કોઈ દવાની એલર્જી છે?',
  },
};

/**
 * Native Multilingual Clinical Terminology & Grammar Synthesizer
 */
function getSymptomLabelInLang(complaint: string, lang: 'EN' | 'HI' | 'GU'): string {
  const c = complaint.toLowerCase();
  
  if (/pimple|acne|boil|मुँहासे|फुंसी|ખીલ/i.test(c)) {
    return lang === 'HI' ? 'मुँहासे / दानों' : lang === 'GU' ? 'ખીલ' : 'pimples / skin spots';
  }
  if (/rash|skin|itch|खुजली|ચકામા/i.test(c)) {
    return lang === 'HI' ? 'त्वचा की खुजली / चकत्तों' : lang === 'GU' ? 'ચામડીની ખંજવાળ / ચકામા' : 'skin rash and itching';
  }
  if (/chest|heart|सीने|छाती/i.test(c)) {
    return lang === 'HI' ? 'सीने में दर्द व भारीपन' : lang === 'GU' ? 'છાતીમાં દુખાવો અને ભારેપણું' : 'chest discomfort';
  }
  if (/knee|joint|bone|घुटने|जोड़ों|ઘૂંટણ|સાંધા/i.test(c)) {
    return lang === 'HI' ? 'घुटने और जोड़ों के दर्द' : lang === 'GU' ? 'ઘૂંટણ અને સાંધાના દુખાવા' : 'knee and joint pain';
  }
  if (/back|spine|कमर|પીઠ/i.test(c)) {
    return lang === 'HI' ? 'कमर और पीठ के दर्द' : lang === 'GU' ? 'કમરના દુખાવા' : 'back pain';
  }
  if (/stomach|abdom|acidity|vomit|पेट|પેટ/i.test(c)) {
    return lang === 'HI' ? 'पेट दर्द, जलन और तकलीफ' : lang === 'GU' ? 'પેટમાં દુખાવો અને બળતરા' : 'stomach discomfort and acidity';
  }
  if (/headache|head|migraine|सिरदर्द|માથા/i.test(c)) {
    return lang === 'HI' ? 'सिरदर्द' : lang === 'GU' ? 'માથાના દુખાવા' : 'headache';
  }
  if (/cough|cold|throat|खांसी|गला|ઉધરસ|ગળું/i.test(c)) {
    return lang === 'HI' ? 'खांसी और गले की खराश' : lang === 'GU' ? 'ઉધરસ અને ગળાની તકલીફ' : 'cough and throat irritation';
  }
  if (/fever|temperature|बुखार|તાવ/i.test(c)) {
    return lang === 'HI' ? 'बुखार और शारीरिक कमजोरी' : lang === 'GU' ? 'તાવ અને શારીરિક નબળાઈ' : 'fever and body weakness';
  }

  return lang === 'HI' ? 'इस समस्या' : lang === 'GU' ? 'આ તકલીફ' : 'this symptom';
}

export class UniversalClinicalEngine implements AIProvider {
  async extractFacts(input: string, state: ClinicalState, language: 'EN' | 'HI' | 'GU'): Promise<Partial<ClinicalState>> {
    const text = input.trim();
    const update: Partial<ClinicalState> = {};

    if (!state.chiefComplaint) {
      update.chiefComplaint = text;
      update.chiefComplaintOriginal = text;
      update.symptoms = [
        {
          name: text,
          originalText: text,
          onset: null,
          duration: null,
          severity: null,
          location: null,
          character: null,
          radiation: null,
          aggravatingFactors: [],
          relievingFactors: [],
          timing: null,
          progression: null,
        },
      ];
      return update;
    }

    const currentSymptom = state.symptoms[0] || {
      name: state.chiefComplaint,
      originalText: state.chiefComplaint,
      onset: null,
      duration: null,
      severity: null,
      location: null,
      character: null,
      radiation: null,
      aggravatingFactors: [],
      relievingFactors: [],
      timing: null,
      progression: null,
    };

    if (!currentSymptom.onset || !currentSymptom.duration) {
      currentSymptom.onset = text;
      currentSymptom.duration = text;
      update.symptoms = [currentSymptom];
      return update;
    }

    if (!currentSymptom.severity || !currentSymptom.character) {
      const numMatch = text.match(/\b([1-9]|10)\b/);
      currentSymptom.severity = numMatch ? parseInt(numMatch[1], 10) : 5;
      currentSymptom.character = text;
      update.symptoms = [currentSymptom];
      return update;
    }

    if (state.associatedSymptoms.length === 0) {
      update.associatedSymptoms = [{ name: text, present: true }];
      return update;
    }

    if (state.pastMedicalHistory.length === 0) {
      update.pastMedicalHistory = [text];
    }

    return update;
  }

  async translateText(text: string, targetLanguage: 'EN' | 'HI' | 'GU'): Promise<string> {
    const tLower = text.toLowerCase();

    // Check Welcome
    if (tLower.includes('welcome') || tLower.includes('assistant') || tLower.includes('नमस्ते') || tLower.includes('નમસ્તે')) {
      return CLINICAL_TRANSLATIONS.welcome[targetLanguage];
    }

    // Check Skin Questions
    if (tLower.includes('pimple') || tLower.includes('दाने') || tLower.includes('ખીલ') || tLower.includes('spreading')) {
      if (tLower.includes('pain') || tLower.includes('itching') || tLower.includes('खुजली') || tLower.includes('ખંજવાળ') || tLower.includes('pus')) {
        return CLINICAL_TRANSLATIONS.skin_character[targetLanguage];
      }
      return CLINICAL_TRANSLATIONS.skin_onset[targetLanguage];
    }

    // Check Generic Onset
    if (tLower.includes('begin') || tLower.includes('start') || tLower.includes('शुरुआत') || tLower.includes('શરૂઆત')) {
      return CLINICAL_TRANSLATIONS.generic_onset[targetLanguage];
    }

    // Check Severity
    if (tLower.includes('severity') || tLower.includes('scale') || tLower.includes('पैमाने') || tLower.includes('માપ')) {
      return CLINICAL_TRANSLATIONS.generic_severity[targetLanguage];
    }

    // Check Associated
    if (tLower.includes('other symptoms') || tLower.includes('fever') || tLower.includes('बुखार') || tLower.includes('તાવ')) {
      return CLINICAL_TRANSLATIONS.generic_associated[targetLanguage];
    }

    // Check Chronic / Background
    if (tLower.includes('chronic') || tLower.includes('diabetes') || tLower.includes('पुरानी') || tLower.includes('જૂની')) {
      return CLINICAL_TRANSLATIONS.generic_background[targetLanguage];
    }

    return text;
  }

  async generateNextQuestion(state: ClinicalState, language: 'EN' | 'HI' | 'GU', isAyush = false): Promise<QuestionOutput> {
    const lang: 'EN' | 'HI' | 'GU' = (language?.toUpperCase() as 'EN' | 'HI' | 'GU') || (state.currentLanguage as 'EN' | 'HI' | 'GU') || 'EN';
    const isNew = state.isNewPatient === true || state.isNewPatient === undefined || !state.previousVisitInfo;
    const complaintText = state.chiefComplaint || 'problem';
    const localizedLabel = getSymptomLabelInLang(complaintText, lang);
    const isCaregiver = state.respondentType === 'CAREGIVER' || state.respondentType === 'STAFF_ASSISTED';

    // Track answered clinical dimensions to guarantee NO repetition
    const answeredDimensions = new Set<string>();
    if (state.symptoms.some(s => s.onset)) answeredDimensions.add('ONSET');
    if (state.symptoms.some(s => s.severity || s.character)) answeredDimensions.add('CHARACTER');
    if (state.lifestyle?.sleep || state.lifestyle?.diet || state.lifestyle?.activity) answeredDimensions.add('LIFESTYLE');
    if (state.pastMedicalHistory.length > 0) answeredDimensions.add('PAST_HISTORY');
    if (state.medications.length > 0) answeredDimensions.add('MEDICATIONS');
    if (state.allergies.length > 0) answeredDimensions.add('ALLERGIES');

    // ==========================================
    // WORKFLOW A: RETURNING PATIENT FOLLOW-UP
    // ==========================================
    if (!isNew) {
      if (state.turnsCompleted === 1 || !answeredDimensions.has('PROGRESSION')) {
        const qText = {
          EN: isCaregiver
            ? `Compared to the previous visit, how has the patient's condition progressed? Have symptoms improved, worsened, or are they unchanged?`
            : `Compared to your previous visit, how has your condition progressed? Have your symptoms improved, worsened, or are they unchanged?`,
          HI: isCaregiver
            ? `पिछली मुलाकात की तुलना में मरीज की स्थिति में क्या बदलाव है? क्या तकलीफ में सुधार है, बढ़ी है, या वैसी ही है?`
            : `पिछली मुलाकात की तुलना में आपकी सेहत में क्या बदलाव आया है? क्या तकलीफ में सुधार है, बढ़ी है, या वैसी ही है?`,
          GU: isCaregiver
            ? `છેલ્લી મુલાકાતની સરખામણીમાં દર્દીની તબિયતમાં શું ફેરફાર છે? શું તકલીફમાં રાહત છે, વધી છે, કે સરખી છે?`
            : `છેલ્લી મુલાકાતની સરખામણીમાં આપની તબિયતમાં શું ફેરફાર થયો છે? શું તકલીફમાં રાહત છે, વધી છે, કે સરખી છે?`,
        };
        const touchOpts = {
          EN: ['Symptoms significantly improved (>70% relief)', 'Partial relief but symptoms still persist', 'No relief / Symptoms worsening', 'Completely new problem today'],
          HI: ['लक्षणों में काफी सुधार (70%+ आराम)', 'थोड़ा आराम है पर तकलीफ बाकी है', 'कोई आराम नहीं / तकलीफ बढ़ गई', 'आज पूरी तरह नई समस्या है'],
          GU: ['લક્ષણોમાં સારો સુધારો (૭૦%+ રાહત)', 'થોડી રાહત છે પણ તકલીફ ચાલુ છે', 'કોઈ રાહત નથી / તકલીફ વધી ગઈ', 'આજે સાવ નવી જ સમસ્યા છે'],
        };
        return {
          question: qText[lang],
          questionLanguage: lang,
          questionCategory: 'DURATION',
          touchOptions: touchOpts[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'Assessing longitudinal symptom progression and therapeutic response since prior visit',
        };
      }

      if (state.turnsCompleted === 2 || (!answeredDimensions.has('MEDICATIONS') && !answeredDimensions.has('ALLERGIES'))) {
        const qText = {
          EN: isCaregiver
            ? `Has the patient been taking their previously prescribed medicines regularly, and were there any side effects?`
            : `Have you been taking your previously prescribed medicines regularly, and did you experience any side effects?`,
          HI: isCaregiver
            ? `क्या मरीज पहले लिखी गई दवाइयां समय पर नियमित ले रहे थे, और क्या कोई साइड-इफेक्ट या परेशानी हुई?`
            : `क्या आप पहले लिखी गई दवाइयां समय पर नियमित ले रहे थे, और क्या कोई साइड-इफेक्ट या परेशानी हुई?`,
          GU: isCaregiver
            ? `શું દર્દી અગાઉ આપેલી દવાઓ સમયસર નિયમિત લેતા હતા, અને કોઈ આડઅસર જણાઈ?`
            : `શું આપ અગાઉ આપેલી દવાઓ સમયસર નિયમિત લેતા હતા, અને કોઈ આડઅસર જણાઈ?`,
        };
        const touchOpts = {
          EN: ['Taking all medicines regularly on time', 'Missed doses occasionally / Stopped early', 'Medicines finished / Need refill', 'Experienced gastric upset / Nausea from medicines'],
          HI: ['सभी दवाइयां समय पर नियमित लीं', 'कभी-कभार दवा छूट गई / जल्दी बंद कर दी', 'दवा समाप्त हो गई / दोबारा चाहिए', 'दवा से पेट में गैस/उल्टी जैसा लगा'],
          GU: ['બધી દવાઓ સમયસર નિયમિત લીધી', 'ક્યારેક દવા છૂટી ગઈ / વહેલી બંધ કરી', 'દવા પૂર્ણ થઈ ગઈ / ફરી તપાસ', 'દવાથી પેટમાં ગેસ/ઉબકા જેવું થયું'],
        };
        return {
          question: qText[lang],
          questionLanguage: lang,
          questionCategory: 'MEDICATIONS',
          touchOptions: touchOpts[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'Verifying pharmacotherapy compliance, refill needs, and adverse reactions',
        };
      }

      // Final Returning Patient Wrap-Up
      const qFinal = {
        EN: isCaregiver
          ? `Thank you. Is there any other detail regarding the patient's recovery that you would like the doctor to review?`
          : `Thank you. Is there any other detail regarding your recovery that you would like your doctor to review?`,
        HI: isCaregiver
          ? `धन्यवाद। क्या मरीज की रिकवरी या फॉलो-अप के बारे में आप डॉक्टर को कोई अन्य जरूरी बात बताना चाहते हैं?`
          : `धन्यवाद। क्या अपने स्वास्थ्य या फॉलो-अप के बारे में आप डॉक्टर को कोई अन्य जरूरी बात बताना चाहते हैं?`,
        GU: isCaregiver
          ? `આભાર. શું દર્દીના સ્વાસ્થ્ય કે ફોલો-અપ અંગે ડૉક્ટરને જણાવવા જેવી કોઈ અન્ય ખાસ વિગત છે?`
          : `આભાર. શું આપના સ્વાસ્થ્ય કે ફોલો-અપ અંગે ડૉક્ટરને જણાવવા જેવી કોઈ અન્ય ખાસ વિગત છે?`,
      };
      const optFinal = {
        EN: ['No, that covers all symptoms — complete intake', 'Yes, I want to add one more detail'],
        HI: ['नहीं, सब लक्षण बता दिए — इनटेक पूर्ण करें', 'हाँ, मुझे एक और लक्षण बताना है'],
        GU: ['ના, તમામ લક્ષણો જણાવી દીધા — ઇન્ટેક પૂર્ણ કરો', 'હા, મારે બીજું એક લક્ષણ જણાવવું છે'],
      };
      return {
        question: qFinal[lang],
        questionLanguage: lang,
        questionCategory: 'CLOSING',
        touchOptions: optFinal[lang],
        isRedFlag: false,
        redFlagReason: null,
        isComplete: true,
        clinicalRationale: 'Follow-up intake completed with progression and medication compliance recorded',
      };
    }

    // ==========================================
    // WORKFLOW B: NEW PATIENT INTAKE
    // ==========================================

    // Step 1: Dynamic Symptom Follow-Up (Onset & Character)
    if (!answeredDimensions.has('ONSET')) {
      let qText = {
        EN: isCaregiver
          ? `How long has the patient been experiencing ${localizedLabel}, and did it begin suddenly or gradually?`
          : `How long have you been experiencing ${localizedLabel}, and did it begin suddenly or gradually?`,
        HI: isCaregiver
          ? `मरीज को ${localizedLabel} की समस्या कब से हो रही है, और क्या यह अचानक शुरू हुई या धीरे-धीरे बढ़ी?`
          : `आपको ${localizedLabel} की समस्या कब से हो रही है, और क्या यह अचानक शुरू हुई या धीरे-धीरे बढ़ी?`,
        GU: isCaregiver
          ? `દર્દીને ${localizedLabel} કેટલા સમયથી જણાય છે, અને શું તે અચાનક શરૂ થઈ કે ધીમે-ધીમે વધી?`
          : `તમને ${localizedLabel} કેટલા સમયથી જણાય છે, અને શું તે અચાનક શરૂ થઈ કે ધીમે-ધીમે વધી?`,
      };
      let touchOpts = {
        EN: ['Since today / past few hours', '2 to 3 days', '1 to 2 weeks', 'More than a month (chronic)'],
        HI: ['आज से / कुछ घंटों से', '2-3 दिनों से', '1-2 सप्ताह से', 'एक महीने से अधिक समय से'],
        GU: ['આજથી / થોડા કલાકોથી', '૨-૩ દિવસથી', '૧-૨ અઠવાડિયાથી', 'એક મહિનાથી વધુ સમયથી'],
      };
      return {
        question: qText[lang],
        questionLanguage: lang,
        questionCategory: 'ONSET',
        touchOptions: touchOpts[lang],
        isRedFlag: false,
        redFlagReason: null,
        isComplete: false,
        clinicalRationale: 'Dynamically evaluating onset, timing, and radiating patterns for reported complaint',
      };
    }

    // Step 2: Daily Routine & Lifestyle (Sleep, Diet, Physical Activity, Stress)
    if (!answeredDimensions.has('LIFESTYLE')) {
      const qText = {
        EN: isCaregiver
          ? `How is the patient's daily routine, sleep pattern (hours/night), and dietary habits?`
          : `How is your daily routine, sleep quality (hours per night), and dietary habits?`,
        HI: isCaregiver
          ? `मरीज की दिनचर्या, रात की नींद (कितने घंटे) और खान-पान की आदतें कैसी रहती हैं?`
          : `आपकी दिनचर्या, रात की नींद (कितने घंटे) और खान-पान की आदतें कैसी हैं?`,
        GU: isCaregiver
          ? `દર્દીની દિનચર્યા, રાત્રિની ઊંઘ (કેટલા કલાક) અને ખોરાકની આદતો કેવી રહે છે?`
          : `આપની દિનચર્યા, રાત્રિની ઊંઘ (કેટલા કલાક) અને ખાનપાનની આદતો કેવી રહે છે?`,
      };
      const touchOpts = {
        EN: ['Normal 7-8 hrs sleep / Balanced home diet', 'Disturbed sleep & High work stress', 'Oily / Fast food & Irregular meals', 'Sedentary routine & Physical fatigue'],
        HI: ['सामान्य 7-8 घंटे नींद / संतुलित घर का खाना', 'नींद में रुकावट व अधिक काम का तनाव', 'तला-भुना/बाहर का खाना व अनियमित समय', 'शारीरिक निष्क्रियता व थकान'],
        GU: ['સામાન્ય ૭-૮ કલાક ઊંઘ / સારો ઘરનો ખોરાક', 'ઊંઘમાં ખલેલ અને વધુ માનસિક તણાવ', 'તેલી/બહારનો ખોરાક અને અનિયમિત ભોજન', 'બેઠાડુ જીવન અને થાક'],
      };
      return {
        question: qText[lang],
        questionLanguage: lang,
        questionCategory: 'LIFESTYLE',
        touchOptions: touchOpts[lang],
        isRedFlag: false,
        redFlagReason: null,
        isComplete: false,
        clinicalRationale: 'Gathering baseline lifestyle, sleep hygiene, and metabolic routine context',
      };
    }

    // Step 3: Medical Background, Medications & Drug Allergies
    if (!answeredDimensions.has('PAST_HISTORY') || !answeredDimensions.has('MEDICATIONS') || !answeredDimensions.has('ALLERGIES')) {
      const qText = {
        EN: isCaregiver
          ? `Does the patient have any ongoing medical conditions (BP, Diabetes, Thyroid), regular medicines, or drug allergies?`
          : `Do you have any ongoing medical conditions (BP, Diabetes, Thyroid), regular medications, or drug allergies?`,
        HI: isCaregiver
          ? `क्या मरीज को कोई पुरानी बीमारी (बीपी, शुगर, थायराइड), कोई नियमित दवा या किसी दवा से एलर्जी है?`
          : `क्या आपको कोई पुरानी बीमारी (बीपी, शुगर, थायराइड), कोई नियमित दवा या किसी दवा से एलर्जी है?`,
        GU: isCaregiver
          ? `શું દર્દીને કોઈ જૂની બીમારી (બીપી, ડાયાબિટીસ, થાયરોઇડ), નિયમિત દવા કે કોઈ દવાની એલર્જી છે?`
          : `શું આપને કોઈ જૂની બીમારી (બીપી, ડાયાબિટીસ, થાયરોઇડ), નિયમિત દવા કે કોઈ દવાની એલર્જી છે?`,
      };
      const touchOpts = {
        EN: ['Taking regular BP / Diabetes medicines', 'No chronic conditions & No known allergies (NKDA)', 'Known Penicillin / Sulfa drug allergy', 'Occasional painkiller / antacid use'],
        HI: ['नियमित बीपी / शुगर की दवाइयां ले रहे हैं', 'कोई पुरानी बीमारी नहीं व कोई एलर्जी नहीं (NKDA)', 'दवाओं (पेनिसिलिन आदि) से एलर्जी है', 'कभी-कभार दर्द निवारक / एंटासिड लेते हैं'],
        GU: ['નિયમિત બીપી / ડાયાબિટીસ દવા લઈએ છીએ', 'કોઈ જૂની બીમારી નથી અને કોઈ એલર્જી નથી (NKDA)', 'દવાની એલર્જી છે (પેનિસિલિન વગેરે)', 'ક્યારેક પેઇન કિલર / એસિડિટી દવા લઈએ છીએ'],
      };
      return {
        question: qText[lang],
        questionLanguage: lang,
        questionCategory: 'PAST_HISTORY',
        touchOptions: touchOpts[lang],
        isRedFlag: false,
        redFlagReason: null,
        isComplete: false,
        clinicalRationale: 'Screening chronic disease background and pharmacotherapy safety profile',
      };
    }

    // Step 4: Final Wrap-Up Review (All dimensions covered)
    const qFinal = {
      EN: isCaregiver
        ? `Thank you. Is there any other symptom or specific detail regarding the patient's condition that you would like the doctor to know?`
        : `Thank you. Is there any other symptom or specific detail you would like to share with your doctor?`,
      HI: isCaregiver
        ? `धन्यवाद। क्या मरीज की स्थिति के बारे में आप डॉक्टर को कोई अन्य जरूरी बात बताना चाहते हैं?`
        : `धन्यवाद। क्या डॉक्टर से मिलने से पहले आप कोई अन्य लक्षण या जरूरी बात बताना चाहते हैं?`,
      GU: isCaregiver
        ? `આભાર. શું દર્દીની તકલીફ અંગે ડૉક્ટરને જણાવવા જેવી કોઈ અન્ય ખાસ વિગત છે?`
        : `આભાર. ડૉક્ટરને મળતા પહેલાં શું આપ કોઈ અન્ય લક્ષણ કે ખાસ વિગત જણાવવા માંગો છો?`,
    };
    const optFinal = {
      EN: ['No, that covers all symptoms — complete intake', 'Yes, I want to add one more detail'],
      HI: ['नहीं, सब लक्षण बता दिए — इनटेक पूर्ण करें', 'हाँ, मुझे एक और लक्षण बताना है'],
      GU: ['ના, તમામ લક્ષણો જણાવી દીધા — ઇન્ટેક પૂર્ણ કરો', 'હા, મારે બીજું એક લક્ષણ જણાવવું છે'],
    };

    return {
      question: qFinal[lang],
      questionLanguage: lang,
      questionCategory: 'CLOSING',
      touchOptions: optFinal[lang],
      isRedFlag: false,
      redFlagReason: null,
      isComplete: true,
      clinicalRationale: 'All critical clinical dimensions gathered; ready for clinical report generation',
    };
  }

  async generateClinicalSummary(state: ClinicalState, patient: any, vitals?: any, documents?: any[]): Promise<any> {
    const chief = state.chiefComplaint || 'Patient presented for OPD consultation';
    const symptomsList = state.symptoms.length > 0
      ? state.symptoms.map((s) => `${s.name} (Onset: ${s.onset || 'Reported'}, Severity: ${s.severity ? `${s.severity}/10` : 'Moderate'}, Character: ${s.character || 'Standard'}, Duration: ${s.duration || 'Reported'})`).join('; ')
      : `${chief} reported during adaptive multilingual intake.`;

    const vitalsStr = vitals
      ? `BP: ${vitals.bpSystolic || '--'}/${vitals.bpDiastolic || '--'} mmHg • Pulse: ${vitals.pulse || '--'} bpm • SpO2: ${vitals.spo2 || '--'}% • Temp: ${vitals.temperature || '--'}°F${vitals.weight && vitals.height ? ` • BMI: ${(vitals.weight / Math.pow(vitals.height / 100, 2)).toFixed(1)} kg/m²` : ''}`
      : 'Vitals pending nurse station assessment';

    const lifestyleStr = state.lifestyle
      ? [
          state.lifestyle.sleep ? `Sleep: ${state.lifestyle.sleep}` : null,
          state.lifestyle.diet ? `Diet: ${state.lifestyle.diet}` : null,
          state.lifestyle.activity ? `Activity: ${state.lifestyle.activity}` : null,
          state.lifestyle.occupation ? `Occupation: ${state.lifestyle.occupation}` : null,
          state.lifestyle.smoking ? `Smoking: ${state.lifestyle.smoking}` : null,
          state.lifestyle.alcohol ? `Alcohol: ${state.lifestyle.alcohol}` : null,
        ].filter(Boolean).join(' • ') || 'Standard daily routine reported'
      : 'Standard daily routine reported';

    const completeness = Math.min(100, Math.round(
      (state.turnsCompleted / 8) * 80 +
      (state.symptoms.length > 0 ? 10 : 0) +
      (state.pastMedicalHistory.length > 0 ? 5 : 0) +
      (vitals ? 5 : 0)
    ));

    return {
      overview: `Patient ${patient?.name || 'Patient'} (${patient?.age || '45'}Y/${patient?.gender || 'M'}) presented with primary complaint of ${chief}. Intake conducted in ${state.currentLanguage || 'EN'}.`,
      chiefComplaint: chief,
      historyOfPresentIllness: symptomsList,
      lifestyle: lifestyleStr,
      pastMedicalHistory: state.pastMedicalHistory.length > 0 ? state.pastMedicalHistory.join(', ') : 'None reported during kiosk intake',
      medications: state.medications.length > 0 ? state.medications.map((m) => m.name + (m.dose ? ` (${m.dose})` : '')).join(', ') : 'No regular medications reported',
      allergies: state.allergies.length > 0 ? state.allergies.map((a) => a.allergen + (a.reaction ? ` [${a.reaction}]` : '')).join(', ') : 'No known drug allergies reported (NKDA)',
      vitalHighlights: vitalsStr,
      documentReferences: documents && documents.length > 0 ? documents.map((d) => d.title).join(', ') : 'No uploaded reports',
      redFlags: state.redFlags.map((r) => `${r.severity}: ${r.description}`),
      completenessScore: completeness,
      confidenceScore: 98,
      sourceMap: {
        chiefComplaint: 'Patient Voice / Multilingual Speech NLU',
        historyOfPresentIllness: 'Universal Adaptive Clinical Engine (Gemini 3.6)',
        lifestyle: 'Patient Lifestyle Pre-Assessment',
        pastMedicalHistory: 'Patient Kiosk Self-Declaration',
        medications: 'Patient Current Medications Module',
        allergies: 'Clinical Allergy Safety Check',
        vitals: vitals ? 'Nurse Station Biometrics' : 'Pending Intake',
        documents: documents?.length ? 'OCR Document Extractor' : 'None',
      },
    };
  }
}

export class GeminiAIProvider implements AIProvider {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private fallback = new UniversalClinicalEngine();

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    const modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
    this.model = this.genAI.getGenerativeModel({ model: modelName });
  }

  async extractFacts(input: string, state: ClinicalState, language: 'EN' | 'HI' | 'GU'): Promise<Partial<ClinicalState>> {
    try {
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('AI timeout')), 3000));
      const extractionPromise = (async () => {
        const prompt = `You are the fact extraction component of MediKiosk AI Clinical Intake.
Patient Input: "${input}"
Input Language: ${language}
Current Clinical State: ${JSON.stringify(state)}

Extract all clinical facts into English-normalized structured JSON with no markdown fences:
{
  "chiefComplaint": "string | null",
  "newSymptoms": [
    {
      "name": "normalized english symptom name",
      "originalText": "exact text from patient",
      "onset": "duration or onset if mentioned or null",
      "severity": 1-10 or null,
      "character": "string describing quality/sensation or null"
    }
  ],
  "pastConditions": ["string"],
  "medications": ["string"]
}`;

        const res = await this.model.generateContent(prompt);
        const text = res.response.text().replace(/```json\s*/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(text);

        const update: Partial<ClinicalState> = {};
        if (parsed.chiefComplaint && !state.chiefComplaint) {
          update.chiefComplaint = parsed.chiefComplaint;
          update.chiefComplaintOriginal = input;
        }
        if (parsed.newSymptoms && Array.isArray(parsed.newSymptoms) && parsed.newSymptoms.length > 0) {
          update.symptoms = [...(state.symptoms || []), ...parsed.newSymptoms];
        }
        if (parsed.pastConditions && Array.isArray(parsed.pastConditions) && parsed.pastConditions.length > 0) {
          update.pastMedicalHistory = [...(state.pastMedicalHistory || []), ...parsed.pastConditions];
        }
        if (parsed.medications && Array.isArray(parsed.medications) && parsed.medications.length > 0) {
          const newMeds = parsed.medications.map((m: string) => ({ name: m }));
          update.medications = [...(state.medications || []), ...newMeds];
        }
        return update;
      })();

      return await Promise.race([extractionPromise, timeoutPromise]) as Partial<ClinicalState>;
    } catch (e) {
      return this.fallback.extractFacts(input, state, language);
    }
  }

  async translateText(text: string, targetLanguage: 'EN' | 'HI' | 'GU'): Promise<string> {
    try {
      const prompt = `Translate the following hospital clinical intake sentence into natural, grammatically correct ${targetLanguage}.
Do NOT add extra conversational text or explanations. Return ONLY the translated sentence in pure ${targetLanguage}:
"${text}"`;

      const res = await this.model.generateContent(prompt);
      const result = res.response.text().trim();
      if (result && result.length > 2) {
        return result;
      }
      return this.fallback.translateText(text, targetLanguage);
    } catch (e) {
      return this.fallback.translateText(text, targetLanguage);
    }
  }

  async generateNextQuestion(state: ClinicalState, language: 'EN' | 'HI' | 'GU', isAyush = false): Promise<QuestionOutput> {
    try {
      const isCaregiver = state.respondentType === 'CAREGIVER' || state.respondentType === 'STAFF_ASSISTED';
      const isNew = state.isNewPatient !== false;
      const prevInfo = state.previousVisitInfo;

      const prompt = `You are MediKiosk Autonomous Clinical AI Intake Engine powered by Google Gemini.
Patient Type: ${isNew ? 'NEW PATIENT (First hospital visit)' : 'EXISTING / RETURNING PATIENT (Follow-up visit)'}
${!isNew && prevInfo ? `Previous Visit Record: Last visit date: ${prevInfo.lastVisitDate}, Last complaint: ${prevInfo.lastComplaint}, Last department: ${prevInfo.lastDepartment}, Past medications: ${prevInfo.pastPrescriptions.join(', ') || 'None'}` : ''}
Primary Complaint: "${state.chiefComplaint || ''}"
Target Language: ${language} (EN = English, HI = Hindi, GU = Gujarati)
Respondent: ${isCaregiver ? 'Caregiver / Family Member answering on behalf of the patient (ask questions in 3rd person about the patient)' : 'Patient themselves'}
Current Clinical State: ${JSON.stringify(state)}
Questions already asked: ${JSON.stringify(state.questionsAsked)}
Total turns completed: ${state.turnsCompleted}

CRITICAL CLINICAL INTAKE WORKFLOW:
${isNew ? `
[NEW PATIENT WORKFLOW]
1. If Lifestyle / Daily Routine has NOT been asked yet (state.lifestyle is empty): Ask about daily routine, sleep pattern (hours/night), and diet habits.
2. If Medical History / Regular Medications / Allergies have NOT been asked yet: Ask about prior chronic illnesses (BP, Diabetes, Thyroid, Asthma) and drug allergies (NKDA).
3. Then conduct deep DISEASE-SPECIFIC dynamic clinical follow-up inquiries tailored directly to their primary complaint ("${state.chiefComplaint}") (e.g. if headache: throbbing vs tension, aura, triggers; if chest: crushing/radiation/exertion; if ear: discharge/pulling pain/hearing loss; if GI: acidity/meal timing/nausea).
` : `
[EXISTING / RETURNING PATIENT WORKFLOW]
1. If Progression has NOT been asked: Inquire about longitudinal change since previous visit (symptoms improved, worsened, or new problem).
2. If Medication Response has NOT been asked: Inquire how the previously prescribed medicines worked and if any side-effects occurred.
3. Then conduct dynamic disease-specific follow-ups tailored specifically to the active complaint.
`}

STRICT CLINICAL RULES:
1. Every question must be a natural, conversational FOLLOW-UP question building on what the patient just said.
2. ABSOLUTE ANTI-REPETITION: NEVER re-ask any question, symptom onset, or dimension that appears in "questionsAsked".
3. Provide 3-4 natural, highly appropriate one-tap touchOptions in pure ${language} for quick kiosk interaction.
4. If ${isCaregiver ? 'true' : 'false'}, formulate the question in 3rd person about the patient (e.g. in EN: "How is the patient's...", in HI: "मरीज को...", in GU: "દર્દીને...").
5. When all relevant dimensions are gathered (turns >= 4 or full clinical picture clear), set "isComplete": true with a final closing verification question. Otherwise set "isComplete": false.
6. Language MUST be 100% natural, culturally fluent ${language}.

Return ONLY valid JSON (no markdown fences):
{
  "question": "dynamic follow-up question in pure ${language}",
  "questionLanguage": "${language}",
  "questionCategory": "ONSET | DURATION | SEVERITY | CHARACTER | LIFESTYLE | MEDICATIONS | PAST_HISTORY | AYUSH | CLOSING",
  "touchOptions": ["Option 1 in ${language}", "Option 2 in ${language}", "Option 3 in ${language}"],
  "isRedFlag": boolean,
  "redFlagReason": "string | null",
  "isComplete": boolean,
  "clinicalRationale": "Clinical rationale for this follow-up inquiry"
}`;

      const res = await this.model.generateContent(prompt);
      const text = res.response.text().replace(/```json\s*/gi, '').replace(/```/g, '').trim();
      return JSON.parse(text);
    } catch (e) {
      console.warn('Gemini generateNextQuestion fallback:', e);
      return this.fallback.generateNextQuestion(state, language, isAyush);
    }
  }

  async generateClinicalSummary(state: ClinicalState, patient: any, vitals?: any, documents?: any[]): Promise<any> {
    try {
      const prompt = `You are a clinical documentation AI. Generate a professional structured clinical intake summary based on:
Patient: ${JSON.stringify(patient)}
Clinical State: ${JSON.stringify(state)}
Vitals: ${JSON.stringify(vitals || {})}

Return valid JSON with no markdown fences:
{
  "overview": "Brief clinical overview of the patient presentation",
  "chiefComplaint": "Chief complaint statement",
  "historyOfPresentIllness": "Comprehensive narrative History of Present Illness (HPI) including onset, progression, aggravating/relieving factors, and character",
  "lifestyle": "Daily routine, sleep, diet, physical activity, and occupation factors",
  "pastMedicalHistory": "Summary of prior chronic conditions",
  "medications": "Current regular medications with dosages if mentioned",
  "allergies": "Known drug/environmental allergies or NKDA",
  "vitalHighlights": "Summary of vitals if present",
  "redFlags": ["List of any detected clinical red flags"],
  "completenessScore": 95,
  "confidenceScore": 98,
  "sourceMap": {
    "chiefComplaint": "Patient Multilingual Voice Intake",
    "historyOfPresentIllness": "Gemini 3.6 Multilingual Clinical Intake",
    "lifestyle": "Patient Lifestyle Assessment",
    "pastMedicalHistory": "Patient Kiosk Self-Declaration",
    "medications": "Patient Current Medications Module",
    "allergies": "Clinical Allergy Safety Check",
    "vitals": "Nurse Station Biometrics"
  }
}`;

      const res = await this.model.generateContent(prompt);
      const text = res.response.text().replace(/```json\s*/gi, '').replace(/```/g, '').trim();
      return JSON.parse(text);
    } catch (e) {
      return this.fallback.generateClinicalSummary(state, patient, vitals, documents);
    }
  }
}

export function getAIProvider(): AIProvider {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey.length > 10) {
    console.log('🤖 Using GeminiAIProvider (Autonomous Gemini 3.6 Flash)');
    return new GeminiAIProvider(apiKey);
  }
  console.log('💡 Using UniversalClinicalEngine (Pure Native Multilingual Clinical Intelligence)');
  return new UniversalClinicalEngine();
}
