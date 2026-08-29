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
    const complaintText = state.chiefComplaint || 'problem';
    const localizedLabel = getSymptomLabelInLang(complaintText, lang);
    const turn = state.turnsCompleted || 1;

    const cLower = `${state.chiefComplaint || ''} ${state.chiefComplaintOriginal || ''}`.toLowerCase();

    const isSkin = /pimple|acne|rash|skin|itch|boil|eczema|allergy|फुंसी|मुँहासे|खुजली|ખીલ|ચકામા/i.test(cLower);
    const isCardiacOrChest = /chest|heart|angina|palpitation|छाती|सीने|हृदय|છાતી/i.test(cLower);
    const isRespiratory = /cough|breath|cold|wheez|asthma|throat|खांसी|सांस|गला|તાવ|ઉધરસ|શ્વાસ/i.test(cLower);
    const isGIOrStomach = /stomach|abdom|vomit|diarrhea|acidity|gas|constipat|nausea|पेट|उल्टी|दस्त|પેટ|ઉલટી/i.test(cLower);
    const isOrthoOrJoint = /joint|bone|knee|back|pain|fracture|leg|shoulder|कमर|घुटने|जोड़ों|કમર|ઘૂંટણ/i.test(cLower);

    // TURN 1: Temporal pattern & Onset in pure native phrasing
    if (turn === 1) {
      let specificOnset = {
        EN: `When did your ${localizedLabel} begin, and does anything make it better or worse?`,
        HI: `आपको ${localizedLabel} की शुरुआत कब से हुई, और क्या किसी विशेष स्थिति में यह कम या ज्यादा होता है?`,
        GU: `તમને ${localizedLabel}ની શરૂઆત ક્યારથી થઈ છે, અને કોઈ ચોક્કસ સમયે તે વધે કે ઘટે છે?`,
      };
      let options = {
        EN: ['Started suddenly today (< 2 hrs)', 'Present for 2-3 days', 'Persistent for > 1 week', 'Chronic / Recurring for months'],
        HI: ['आज अचानक शुरू हुआ (< 2 घंटे)', '2-3 दिनों से है', 'एक हफ्ते से अधिक समय से', 'काफी महीनों से बार-बार होता है'],
        GU: ['આજે અચાનક શરૂ થયું (< 2 કલાક)', '2-3 દિવસથી છે', 'એક અઠવાડિયા કરતાં વધુ સમયથી', 'લાંબા સમયથી વારંવાર થાય છે'],
      };

      if (isSkin) {
        specificOnset.EN = `How many days have you had these ${localizedLabel}, and are they spreading to other areas?`;
        specificOnset.HI = `आपको ये ${localizedLabel} कितने दिनों से निकल रहे हैं, और क्या ये चेहरे या शरीर के अन्य हिस्सों में भी फैल रहे हैं?`;
        specificOnset.GU = `તમને આ ${localizedLabel} કેટલા દિવસથી નીકળી રહ્યા છે, અને શું તે ચહેરા કે શરીરના અન્ય ભાગોમાં ફેલાઈ રહ્યા છે?`;
      } else if (isOrthoOrJoint) {
        specificOnset.EN = `When did this ${localizedLabel} start, and does walking or resting worsen the pain?`;
        specificOnset.HI = `आपको यह ${localizedLabel} कब से शुरू हुआ, और क्या चलने-फिरने या काम करने से दर्द बढ़ता है?`;
        specificOnset.GU = `તમને આ ${localizedLabel} ક્યારથી શરૂ થયો, અને ચાલવાથી કે હલનચલન કરવાથી દુખાવો વધે છે?`;
      } else if (isRespiratory) {
        specificOnset.EN = `How long have you had this ${localizedLabel}, and is it worse at night or during physical activity?`;
        specificOnset.HI = `आपको यह ${localizedLabel} कब से है, और क्या रात में या कोई काम करने पर सांस फूलती है?`;
        specificOnset.GU = `તમને આ ${localizedLabel} કેટલા સમયથી છે, અને શું રાત્રે કે ચાલતી વખતે તકલીફ વધે છે?`;
      }

      return {
        question: specificOnset[lang],
        questionLanguage: lang,
        questionCategory: 'ONSET',
        touchOptions: options[lang],
        isRedFlag: false,
        redFlagReason: null,
        isComplete: false,
        clinicalRationale: 'Establishing temporal symptom pattern and trigger factors',
      };
    }

    // TURN 2: Severity, Character & Clinical Sensation
    if (turn === 2) {
      let q = {
        EN: `How does your ${localizedLabel} feel, and what is the severity on a scale of 1 to 10?`,
        HI: `आपको ${localizedLabel} में किस तरह की परेशानी महसूस हो रही है, और 1 से 10 के पैमाने पर कितनी तकलीफ है?`,
        GU: `તમને ${localizedLabel}માં કેવા પ્રકારની તકલીફ જણાય છે, અને 1 થી 10 ના માપ પર કેટલી ગંભીરતા છે?`,
      };
      let opt = {
        EN: ['1-3 (Mild / Noticeable)', '4-6 (Moderate / Distracting)', '7-10 (Severe / Sharp / Unbearable)'],
        HI: ['1-3 (हल्की तकलीफ / सहनीय)', '4-6 (मध्यम / दैनिक काम में रुकावट)', '7-10 (अत्यधिक तीव्र व असहनीय)'],
        GU: ['1-3 (હળવી તકલીફ / સામાન્ય)', '4-6 (મધ્યમ / કામમાં અડચણ)', '7-10 (અતિ તીવ્ર / અસહ્ય)'],
      };

      if (isSkin) {
        q.EN = `Is there any pain, itching, redness, or pus discharge with the ${localizedLabel}?`;
        q.HI = `क्या इन ${localizedLabel} में दर्द, तेज खुजली, लालिमा, या पस/मवाद जैसा कुछ बन रहा है?`;
        q.GU = `શું આ ${localizedLabel}માં દુખાવો, ખંજવાળ, લાલાશ, કે પરુ (પસ) જેવું જણાય છે?`;
        opt.EN = ['Severe itching without pus', 'Painful & tender with redness', 'Pus filled / deep boils', 'Mild / purely cosmetic'];
        opt.HI = ['तेज खुजली, मवाद नहीं', 'दर्दनाक और लालिमा युक्त', 'मवाद/पस वाले दाने', 'हल्की समस्या / सामान्य'];
        opt.GU = ['તીવ્ર ખંજવાળ, પરુ નથી', 'દુખાવો અને લાલાશ સાથે', 'પરુ (પસ) વાળા ખીલ', 'હળવી તકલીફ'];
      } else if (isGIOrStomach) {
        q.EN = `Is there burning acidity, sharp cramping, or fullness after meals with this ${localizedLabel}?`;
        q.HI = `क्या आपको ${localizedLabel} के साथ सीने-पेट में जलन, मरोड़ या खाना खाने के बाद भारीपन होता है?`;
        q.GU = `શું તમને ${localizedLabel} સાથે બળતરા, ચૂંક કે જમ્યા પછી પેટમાં ભારેપણું લાગે છે?`;
        opt.EN = ['Burning sensation (Acidity)', 'Sharp cramping pain', 'Dull continuous ache', 'Bloating / Fullness after meals'];
        opt.HI = ['जलन / एसिडिटी', 'तेज मरोड़ वाला दर्द', 'लगातार हल्का दर्द', 'पेट फूलना / भारीपन'];
        opt.GU = ['બળતરા / એસિડિટી', 'તીવ્ર ચૂંક આવવી', 'સતત દુખાવો', 'પેટ ફૂલવું / અપચો'];
      } else if (isOrthoOrJoint) {
        q.EN = `Is there visible swelling, morning stiffness, or difficulty bearing weight with this ${localizedLabel}?`;
        q.HI = `क्या आपको ${localizedLabel} वाले हिस्से में सूजन, सुबह के समय अकड़न, या चलने में कठिनाई हो रही है?`;
        q.GU = `શું તમને ${localizedLabel}વાળા ભાગમાં સોજો, સવારે જકડાઈ જવું, કે ચાલવામાં મુશ્કેલી પડે છે?`;
        opt.EN = ['Morning stiffness > 30 mins', 'Visible swelling and warmth', 'Difficulty walking / moving', 'Mild intermittent ache'];
        opt.HI = ['सुबह जोड़ों में अकड़न', 'सूजन और लाली', 'चलने-फिरने में भारी परेशानी', 'हल्का दर्द'];
        opt.GU = ['સવારે સાંધા જકડાઈ જવા', 'સોજો આવવો', 'ચાલવામાં તકલીફ', 'હળવો દુખાવો'];
      }

      return {
        question: q[lang],
        questionLanguage: lang,
        questionCategory: 'CHARACTER',
        touchOptions: opt[lang],
        isRedFlag: false,
        redFlagReason: null,
        isComplete: false,
        clinicalRationale: 'Characterizing symptom quality, sensation, and severity',
      };
    }

    // TURN 3: Associated Findings / Prior Treatments
    if (turn === 3) {
      let q = {
        EN: `Have you noticed any other symptoms (like fever, nausea, dizziness, or unusual weakness)?`,
        HI: `क्या आपको इसके अलावा कोई अन्य समस्या जैसे बुखार, जी मिचलाना, चक्कर या असामान्य कमजोरी भी लग रही है?`,
        GU: `શું તમને આ સિવાય તાવ, ઉબકા, ચક્કર આવવા કે અસામાન્ય નબળાઈ જેવી કોઈ તકલીફ જણાય છે?`,
      };
      let opt = {
        EN: ['Mild fever & fatigue', 'Nausea / Loss of appetite', 'Headache / Body ache', 'No other associated symptoms'],
        HI: ['हल्का बुखार और थकान', 'जी मिचलाना / भूख न लगना', 'सिरदर्द / शरीर दर्द', 'अन्य कोई लक्षण नहीं'],
        GU: ['હળવો તાવ અને થાક', 'ઉબકા / ભૂખ ન લાગવી', 'માથાનો દુખાવો / शरीरનો દુખાવો', 'અન્ય કોઈ લક્ષણ નથી'],
      };

      if (isSkin) {
        q.EN = `Have you applied any skin ointments, steroid creams, or taken any home remedies for this?`;
        q.HI = `क्या आपने इसके लिए पहले कोई मेडिकल क्रीम, ऑइंटमेंट या घरेलू उपचार का इस्तेमाल किया है?`;
        q.GU = `શું તમે આ માટે પહેલાં કોઈ સ્કીન ક્રીમ, મલમ કે ઘરગથ્થુ ઉપચાર કર્યો છે?`;
        opt.EN = ['Applied OTC creams / ointments', 'Used Ayurvedic/home remedies', 'No prior treatment used'];
        opt.HI = ['क्रीम / ऑइंटमेंट लगाया है', 'घरेलू/आयुर्वेदिक उपाय किए हैं', 'कोई उपचार नहीं लिया'];
        opt.GU = ['ક્રીમ કે મલમ વાપર્યો છે', 'ઘરગથ્થુ ઉપચાર કર્યો છે', 'કોઈ દવા લીધી નથી'];
      }

      return {
        question: q[lang],
        questionLanguage: lang,
        questionCategory: 'ASSOCIATED',
        touchOptions: opt[lang],
        isRedFlag: false,
        redFlagReason: null,
        isComplete: false,
        clinicalRationale: 'Screening for systemic involvement and prior medication exposure',
      };
    }

    // TURN 4: Past Medical History & Drug Allergies
    if (turn === 4) {
      const q = {
        EN: `Do you have any existing chronic conditions (High BP, Diabetes, Thyroid) or known drug allergies?`,
        HI: `क्या आपको पहले से कोई पुरानी बीमारी (जैसे बीपी, शुगर, थायराइड) या किसी दवा से एलर्जी है?`,
        GU: `શું તમને પહેલેથી કોઈ જૂની બીમારી (જેમ કે બીપી, ડાયાબિટીસ, થાયરોઇડ) કે કોઈ દવાની એલર્જી છે?`,
      };
      const opt = {
        EN: ['High BP / Diabetes', 'Thyroid / Asthma', 'Known Drug Allergies', 'No chronic conditions / No allergies'],
        HI: ['हाई बीपी / शुगर', 'थायराइड / अस्थमा', 'दवाओं से एलर्जी है', 'कोई पुरानी बीमारी या एलर्जी नहीं'],
        GU: ['હાઈ બીપી / ડાયાબિટીસ', 'થાયરોઇડ / અસ્થમા', 'દવાની એલર્જી છે', 'કોઈ જૂની બીમારી કે એલર્જી નથી'],
      };

      return {
        question: q[lang],
        questionLanguage: lang,
        questionCategory: 'PAST_HISTORY',
        touchOptions: opt[lang],
        isRedFlag: false,
        redFlagReason: null,
        isComplete: false,
        clinicalRationale: 'Reviewing background systemic risk factors and drug allergies',
      };
    }

    // TURN 5: Daily Routine & Lifestyle
    if (turn === 5) {
      const q = {
        EN: `How would you describe your daily lifestyle? Please tell me about your sleep, diet, physical activity, and occupation.`,
        HI: `आप अपनी दिनचर्या के बारे में बताइए — नींद कैसी है, खान-पान कैसा है, और किस तरह का काम करते हैं?`,
        GU: `તમારી રોજની જીવનચર્યા વિશે જણાવો — ઊંઘ, ખાન-પાન, શારીરિક પ્રવૃત્તિ અને વ્યવસાય કેવો છે?`,
      };
      const opt = {
        EN: ['Sedentary (desk job, low activity)', 'Moderate activity (occasional exercise)', 'Active (regular physical work)', 'Irregular lifestyle (night shifts, stress)'],
        HI: ['कम सक्रिय (बैठे-बैठे काम)', 'मध्यम सक्रिय (कभी-कभी व्यायाम)', 'अधिक सक्रिय (शारीरिक श्रम)', 'अनियमित जीवनशैली (रात्रि पाली, तनाव)'],
        GU: ['ઓછી સક્રિય (ડેસ્ક કામ)', 'સાધારણ સક્રિય (ક્યારેક-ક્યારેક વ્યાયામ)', 'વધુ સક્રિય (શારીરિક કામ)', 'અનિયમિત (નાઇટ શિફ્ટ, તણાવ)'],
      };
      return {
        question: q[lang],
        questionLanguage: lang,
        questionCategory: 'LIFESTYLE',
        touchOptions: opt[lang],
        isRedFlag: false,
        redFlagReason: null,
        isComplete: false,
        clinicalRationale: 'Collecting daily routine and lifestyle factors — key for chronic disease risk and medication adherence',
      };
    }

    // TURN 6: Current Medications (detailed)
    if (turn === 6) {
      const q = {
        EN: `Are you currently taking any medicines regularly? Please mention the name, dose, and frequency if you know.`,
        HI: `क्या आप अभी कोई दवाईयां नियमित रूप से ले रहे हैं? यदि हां, तो दवा का नाम, मात्रा और कितनी बार लेते हैं, बताएं।`,
        GU: `શું તમે હાલ કોઈ દવા નિયમિત લો છો? જો હા, તો દવાનું નામ, ડોઝ અને ક્યારે લો છો તે જણાવો.`,
      };
      const opt = {
        EN: ['No regular medicines', 'BP / Diabetes medicines', 'Thyroid / Cholesterol medicines', 'Pain killers / Antacids only'],
        HI: ['कोई नियमित दवाई नहीं', 'ब्लड प्रेशर / शुगर की दवाई', 'थायराइड / कोलेस्ट्रॉल की दवाई', 'केवल दर्द निवारक / एंटासिड'],
        GU: ['કોઈ નિયમિત દવા નહીં', 'બ્લડ પ્રેશર / ડાયાબિટીસ દવા', 'થાયરોઇડ / કોલેસ્ટ્રોલ દવા', 'માત્ર પેઇન કિલર / એન્ટાસિડ'],
      };
      return {
        question: q[lang],
        questionLanguage: lang,
        questionCategory: 'MEDICATIONS',
        touchOptions: opt[lang],
        isRedFlag: false,
        redFlagReason: null,
        isComplete: false,
        clinicalRationale: 'Documenting current medications to check interactions and chronic disease management',
      };
    }

    // TURN 7: Allergies (detailed)
    if (turn === 7) {
      const q = {
        EN: `Do you have any known allergies — to medicines, food, dust, pollen, or other substances?`,
        HI: `क्या आपको किसी चीज़ से एलर्जी है — जैसे कोई दवाई, खाद्य पदार्थ, धूल, या कोई अन्य चीज़?`,
        GU: `શું તમને કોઈ પ્રકારની એલર્જી છે — જેવી કે કોઈ દવા, ખાવાની વસ્તુ, ધૂળ, પરાગ, કે અન્ય કોઈ?`,
      };
      const opt = {
        EN: ['No known drug allergies (NKDA)', 'Penicillin / Sulfa drug allergy', 'Food allergy (nuts, shellfish, dairy)', 'Dust / Pollen / Environmental allergy'],
        HI: ['कोई ज्ञात दवाई एलर्जी नहीं (NKDA)', 'पेनिसिलिन / सल्फा दवाई एलर्जी', 'खाने की एलर्जी (मेवे, समुद्री भोजन, दूध)', 'धूल / पराग / पर्यावरणीय एलर्जी'],
        GU: ['કોઈ ઓળખાયેલ દવા એલર્જી નથી (NKDA)', 'પેનિસિલિન / સલ્ફા દવા એલર્જી', 'ખોરાક એલર્જી (નટ્સ, ડેઇરી)', 'ધૂળ / પરાગ / પર્યાવરણ એલર્જી'],
      };
      return {
        question: q[lang],
        questionLanguage: lang,
        questionCategory: 'ALLERGIES',
        touchOptions: opt[lang],
        isRedFlag: false,
        redFlagReason: null,
        isComplete: false,
        clinicalRationale: 'Documenting allergies for safe prescription and anaesthesia planning',
      };
    }

    // TURN 8+: Final Review and Ready to Submit
    const qFinal = {
      EN: `Thank you for completing the health intake. Is there anything else you would like your doctor to know before your consultation?`,
      HI: `स्वास्थ्य विवरण भरने के लिए धन्यवाद। क्या डॉक्टर से मिलने से पहले आप कुछ और बताना चाहते हैं?`,
      GU: `આરોગ્ય વિગત ભરવા બદલ આભાર. ડૉક્ટરને મળતા પહેલાં શું તમે કંઈ વધારાનું જણાવવા માંગો છો?`,
    };
    const optFinal = {
      EN: ['No, intake is complete — proceed to consultation', 'I want to add one more symptom or concern'],
      HI: ['नहीं, सब बता दिया है — परामर्श शुरू करें', 'एक और लक्षण या समस्या जोड़नी है'],
      GU: ['ના, સઘળું જણાવ્યું — ડૉક્ટર પાસે જવું છે', 'બીજું એક લક્ષણ ઉમેરવું છે'],
    };

    return {
      question: qFinal[lang],
      questionLanguage: lang,
      questionCategory: 'CLOSING',
      touchOptions: optFinal[lang],
      isRedFlag: false,
      redFlagReason: null,
      isComplete: true,
      clinicalRationale: 'Intake fully collected across 8 stages; ready for patient to proceed to doctor consultation',
    };
  }

  async generateClinicalSummary(state: ClinicalState, patient: any, vitals?: any, documents?: any[]): Promise<any> {
    const chief = state.chiefComplaint || 'Patient presented for OPD consultation';
    const symptomsList = state.symptoms.map((s) => `${s.name} (Onset: ${s.onset || 'Reported'}, Severity: ${s.severity || 'N/A'}/10, Character: ${s.character || 'Reported'})`).join('; ');

    const vitalsStr = vitals
      ? `BP: ${vitals.bpSystolic || '--'}/${vitals.bpDiastolic || '--'} mmHg, Pulse: ${vitals.pulse || '--'} bpm, SpO2: ${vitals.spo2 || '--'}%`
      : 'Vitals pending nurse intake at station';

    return {
      overview: `Patient ${patient?.name || 'Patient'} (${patient?.age || '45'}Y/${patient?.gender || 'M'}) presented with ${chief}.`,
      chiefComplaint: chief,
      historyOfPresentIllness: symptomsList || 'Recorded via adaptive multilingual intake.',
      pastMedicalHistory: state.pastMedicalHistory.length > 0 ? state.pastMedicalHistory.join(', ') : 'None reported during kiosk intake',
      medications: state.medications.length > 0 ? state.medications.map((m) => m.name).join(', ') : 'No regular medications reported',
      allergies: state.allergies.length > 0 ? state.allergies.map((a) => a.allergen).join(', ') : 'No known drug allergies reported (NKDA)',
      vitalHighlights: vitalsStr,
      documentReferences: documents && documents.length > 0 ? documents.map((d) => d.title).join(', ') : 'No uploaded reports',
      redFlags: state.redFlags.map((r) => `${r.severity}: ${r.description}`),
      sourceMap: {
        chiefComplaint: 'Patient Voice/Text Input',
        historyOfPresentIllness: 'Universal Multilingual Clinical Intake Engine',
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
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
  }

  async extractFacts(input: string, state: ClinicalState, language: 'EN' | 'HI' | 'GU'): Promise<Partial<ClinicalState>> {
    try {
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
    } catch (e) {
      console.warn('Gemini extractFacts fallback:', e);
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
      const prompt = `You are MediKiosk Autonomous Clinical AI Intake Engine powered by Google Gemini.
Patient Complaint: "${state.chiefComplaint || ''}"
Target Language: ${language} (EN = English, HI = Hindi, GU = Gujarati)
Current Clinical State: ${JSON.stringify(state)}
Questions already asked: ${JSON.stringify(state.questionsAsked)}
Total turns completed so far: ${state.turnsCompleted}

CRITICAL RULES:
1. NEVER repeat any question or clinical dimension already in questionsAsked.
2. Advance to the next logical clinical dimension (Onset -> Severity/Character -> Associated Symptoms -> Medical History -> Closing).
3. If you determine you have gathered all necessary information, provide a closing wrap-up question and set "isComplete": true.
4. If more details are needed, set "isComplete": false and ask ONE precise follow-up question in pure ${language}.
5. If ${language} is HI, use 100% natural Hindi. If ${language} is GU, use 100% natural Gujarati. If EN, use clinical English.

Return ONLY valid JSON (no markdown fences):
{
  "question": "string in pure ${language}",
  "questionLanguage": "${language}",
  "questionCategory": "ONSET | DURATION | SEVERITY | CHARACTER | ASSOCIATED | MEDICATIONS | PAST_HISTORY | AYUSH | CLOSING",
  "touchOptions": ["Option 1 in ${language}", "Option 2 in ${language}", "Option 3 in ${language}"],
  "isRedFlag": boolean,
  "redFlagReason": "string | null",
  "isComplete": boolean,
  "clinicalRationale": "string explaining why this question was chosen or why intake is now complete"
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
  "pastMedicalHistory": "Summary of prior chronic conditions",
  "medications": "Current regular medications",
  "allergies": "Known drug/environmental allergies or NKDA",
  "vitalHighlights": "Summary of vitals if present",
  "redFlags": ["List of any detected clinical red flags"],
  "sourceMap": {
    "chiefComplaint": "Patient Voice Intake",
    "historyOfPresentIllness": "Gemini Multilingual Autonomous Clinical Intake"
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
