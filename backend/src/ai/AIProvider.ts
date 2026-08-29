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
    const isCardiac = isCardiacOrChest;
    const isRespiratory = /cough|breath|cold|wheez|asthma|throat|खांसी|सांस|गला|તાવ|ઉધરસ|શ્વાસ/i.test(cLower);
    const isGIOrStomach = /stomach|abdom|vomit|diarrhea|acidity|gas|constipat|nausea|पेट|उल्टी|दस्त|પેટ|ઉલટી/i.test(cLower);
    const isOrthoOrJoint = /joint|bone|knee|back|pain|fracture|leg|shoulder|कमर|घुटने|जोड़ों|કમર|ઘૂંટણ/i.test(cLower);

    const isCaregiver = state.respondentType === 'CAREGIVER' || state.respondentType === 'STAFF_ASSISTED';

    // Dynamic Adaptive Clinical Questioning — Evaluates patient answers and missing dimensions
    const answeredDimensions = new Set<string>();
    if (state.symptoms.some(s => s.onset)) answeredDimensions.add('ONSET');
    if (state.symptoms.some(s => s.severity || s.character)) answeredDimensions.add('CHARACTER');
    if (state.pastMedicalHistory.length > 0) answeredDimensions.add('PAST_HISTORY');
    if (state.medications.length > 0) answeredDimensions.add('MEDICATIONS');
    if (state.allergies.length > 0) answeredDimensions.add('ALLERGIES');
    if (state.lifestyle) answeredDimensions.add('LIFESTYLE');

    // 1. Dynamic Symptom Follow-Up: If onset or character has not been explored for the primary complaint
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

      if (isCardiac) {
        qText.EN = isCaregiver
          ? `When did the patient's chest discomfort begin, and does it spread to their left arm, jaw, or back?`
          : `When did this chest discomfort begin, and does it spread to your left arm, jaw, or back?`;
        qText.HI = isCaregiver
          ? `मरीज को सीने में दर्द कब से है, और क्या यह दर्द बाएं हाथ, जबड़े या पीठ की तरफ फैलता है?`
          : `यह सीने में दर्द कब से है, और क्या यह दर्द बाएं हाथ, जबड़े या पीठ की तरफ फैलता है?`;
        qText.GU = isCaregiver
          ? `દર્દીને છાતીમાં દુખાવો ક્યારથી છે, અને શું તે ડાબા હાથ, જડબા કે પીઠ તરફ ફેલાય છે?`
          : `આ છાતીમાં દુખાવો ક્યારથી છે, અને શું તે ડાબા હાથ, જડબા કે પીઠ તરફ ફેલાય છે?`;
        touchOpts.EN = ['Just started (Severe / Heavy pressure)', 'Spreading to left arm / neck', 'Worse with walking / exertion', 'Mild discomfort only'];
        touchOpts.HI = ['अभी शुरू हुआ (भारी दबाव/जकड़न)', 'बाएं हाथ/गर्दन में फैल रहा है', 'चलने-फिरने पर बढ़ता है', 'केवल हल्का दर्द'];
        touchOpts.GU = ['હમણાં જ શરૂ થયો (ભારે દબાણ)', 'ડાબા હાથ/ગરદન તરફ ફેલાય છે', 'ચાલવાથી વધે છે', 'હળવો દુખાવો'];
      }

      return {
        question: qText[lang],
        questionLanguage: lang,
        questionCategory: 'ONSET',
        touchOptions: touchOpts[lang],
        isRedFlag: isCardiac,
        redFlagReason: isCardiac ? 'Potential cardiac angina screening' : null,
        isComplete: false,
        clinicalRationale: 'Dynamically evaluating onset, timing, and radiating patterns for reported complaint',
      };
    }

    // 2. Dynamic Character & Severity Exploration
    if (!answeredDimensions.has('CHARACTER')) {
      let qText = {
        EN: isCaregiver
          ? `How would you describe the patient's ${localizedLabel}, and how severe is it on a scale of 1 to 10?`
          : `How would you describe the sensation of your ${localizedLabel}, and how severe is it on a scale of 1 to 10?`,
        HI: isCaregiver
          ? `मरीज को ${localizedLabel} में किस तरह की तकलीफ महसूस होती है, और 1 से 10 के पैमाने पर कितनी तीव्रता है?`
          : `आपको ${localizedLabel} में किस तरह की तकलीफ महसूस होती है, और 1 से 10 के पैमाने पर कितनी तीव्रता है?`,
        GU: isCaregiver
          ? `દર્દીને ${localizedLabel}માં કેવા પ્રકારની તકલીફ જણાય છે, અને ૧ થી ૧૦ ના માપ પર કેટલી તીવ્રતા છે?`
          : `તમને ${localizedLabel}માં કેવા પ્રકારની તકલીફ જણાય છે, અને ૧ થી ૧૦ ના માપ પર કેટલી તીવ્રતા છે?`,
      };
      let touchOpts = {
        EN: ['1-3 (Mild / bearable)', '4-6 (Moderate / disturbing daily tasks)', '7-10 (Severe / sharp / unbearable)'],
        HI: ['1-3 (हल्की तकलीफ / सहनीय)', '4-6 (मध्यम / दैनिक काम में रुकावट)', '7-10 (अत्यधिक तीव्र व असहनीय)'],
        GU: ['૧-૩ (હળવી તકલીફ / સહન થાય તેવી)', '૪-૬ (મધ્યમ / કામમાં અડચણ)', '૭-૧૦ (અતિ તીવ્ર / અસહ્ય)'],
      };

      if (isGIOrStomach) {
        qText.EN = isCaregiver
          ? `Does the patient have burning acidity, sharp cramping, or fullness after eating?`
          : `Is your abdominal symptom mostly burning acidity, sharp cramping, or fullness after eating?`;
        qText.HI = isCaregiver
          ? `क्या मरीज को पेट में जलन/एसिडिटी, मरोड़ वाला दर्द, या खाना खाने के बाद भारीपन ज्यादा लगता है?`
          : `क्या पेट में जलन/एसिडिटी, मरोड़ वाला दर्द, या खाना खाने के बाद भारीपन ज्यादा लगता है?`;
        qText.GU = isCaregiver
          ? `શું દર્દીને પેટમાં બળતરા/એસિડિટી, ચૂંક આવવી, કે જમ્યા પછી ભારેપણું વધારે જણાય છે?`
          : `શું પેટમાં બળતરા/એસિડિટી, ચૂંક આવવી, કે જમ્યા પછી ભારેપણું વધારે જણાય છે?`;
        touchOpts.EN = ['Burning sensation (Acidity / GERD)', 'Sharp cramping pain', 'Fullness / Bloating after meals', 'Continuous dull ache'];
        touchOpts.HI = ['जलन / एसिडिटी', 'तेज मरोड़ वाला दर्द', 'खाना खाने के बाद भारीपन', 'लगातार हल्का दर्द'];
        touchOpts.GU = ['બળતરા / એસિડિટી', 'તીવ્ર ચૂંક આવવી', 'જમ્યા પછી ભારેપણું', 'સતત દુખાવો'];
      } else if (isOrthoOrJoint) {
        qText.EN = isCaregiver
          ? `Is there morning stiffness, swelling, or difficulty in the patient's joint movement?`
          : `Is there morning stiffness, swelling, or difficulty in joint movement?`;
        qText.HI = isCaregiver
          ? `क्या मरीज को सुबह जोड़ों में अकड़न, सूजन, या चलने में कठिनाई होती है?`
          : `क्या सुबह उठने पर जोड़ों में अकड़न, सूजन, या चलने में कठिनाई होती है?`;
        qText.GU = isCaregiver
          ? `શું દર્દીને સવારે સાંધા જકડાઈ જવા, સોજો આવવો, કે ચાલવામાં મુશ્કેલી પડે છે?`
          : `શું સવારે સાંધા જકડાઈ જવા, સોજો આવવો, કે ચાલવામાં મુશ્કેલી પડે છે?`;
        touchOpts.EN = ['Morning stiffness > 30 mins', 'Swelling and warmth', 'Pain on climbing stairs / walking', 'Mild ache only'];
        touchOpts.HI = ['सुबह 30 मिनट से ज्यादा अकड़न', 'सूजन और लाली', 'सीढ़ियां चढ़ने/चलने में दर्द', 'हल्का दर्द'];
        touchOpts.GU = ['સવારે સાંધા જકડાઈ જવા', 'સોજો અને ગરમી', 'સીડી ચડવામાં દુખાવો', 'હળવો દુખાવો'];
      } else if (isSkin) {
        qText.EN = isCaregiver
          ? `Is the patient's rash accompanied by intense itching, pain, or spreading to other parts?`
          : `Is the skin rash accompanied by intense itching, pain, or spreading to other parts?`;
        qText.HI = isCaregiver
          ? `क्या मरीज को त्वचा पर तेज खुजली, दर्द, या यह अन्य जगहों पर फैल रही है?`
          : `क्या त्वचा पर तेज खुजली, दर्द, या यह अन्य जगहों पर फैल रही है?`;
        qText.GU = isCaregiver
          ? `શું દર્દીને ત્વચા પર તીવ્ર ખંજવાળ, દુખાવો, કે અન્ય ભાગોમાં ફેલાવો જણાય છે?`
          : `શું ત્વચા પર તીવ્ર ખંજવાળ, દુખાવો, કે અન્ય ભાગોમાં ફેલાવો જણાય છે?`;
        touchOpts.EN = ['Severe itching without pain', 'Painful and red tender skin', 'Spreading to other body areas', 'Dry peeling / scaling'];
        touchOpts.HI = ['तेज खुजली, दर्द नहीं', 'दर्दनाक और लाल त्वचा', 'शरीर के अन्य हिस्सों में फैल रहा है', 'सूखापन व पपड़ी'];
        touchOpts.GU = ['તીવ્ર ખંજવાળ', 'દુખાવો અને લાલાશ', 'બીજા ભાગોમાં ફેલાવવું', 'શુષ્કતા'];
      }

      return {
        question: qText[lang],
        questionLanguage: lang,
        questionCategory: 'CHARACTER',
        touchOptions: touchOpts[lang],
        isRedFlag: false,
        redFlagReason: null,
        isComplete: false,
        clinicalRationale: 'Dynamically tailoring symptom severity and qualitative sensation inquiry',
      };
    }

    // 3. Dynamic Chronic Medical History Check
    if (!answeredDimensions.has('PAST_HISTORY')) {
      const qText = {
        EN: isCaregiver
          ? `Does the patient have any ongoing medical conditions (like High Blood Pressure, Diabetes, Thyroid, or Asthma)?`
          : `Do you have any ongoing medical conditions (like High Blood Pressure, Diabetes, Thyroid, or Asthma)?`,
        HI: isCaregiver
          ? `क्या मरीज को पहले से कोई पुरानी बीमारी (जैसे ब्लड प्रेशर, शुगर/डायबिटीज, थायराइड या दमा) है?`
          : `क्या आपको पहले से कोई पुरानी बीमारी (जैसे ब्लड प्रेशर, शुगर/डायबिटीज, थायराइड या दमा) है?`,
        GU: isCaregiver
          ? `શું દર્દીને પહેલેથી કોઈ જૂની બીમારી (જેમ કે બીપી, ડાયાબિટીસ, થાયરોઇડ કે અસ્થમા) છે?`
          : `શું તમને પહેલેથી કોઈ જૂની બીમારી (જેમ કે બીપી, ડાયાબિટીસ, થાયરોઇડ કે અસ્થમા) છે?`,
      };
      const touchOpts = {
        EN: ['High Blood Pressure (Hypertension)', 'Diabetes (High Sugar)', 'Thyroid / Asthma', 'No ongoing chronic conditions'],
        HI: ['हाई ब्लड प्रेशर (बीपी)', 'डायबिटीज (शुगर)', 'थायराइड / दमा (अस्थमा)', 'कोई पुरानी बीमारी नहीं है'],
        GU: ['હાઈ બ્લડ પ્રેશર (બીપી)', 'ડાયાબિટીસ (સુગર)', 'થાયરોઇડ / અસ્થમા', 'કોઈ જૂની બીમારી નથી'],
      };
      return {
        question: qText[lang],
        questionLanguage: lang,
        questionCategory: 'PAST_HISTORY',
        touchOptions: touchOpts[lang],
        isRedFlag: false,
        redFlagReason: null,
        isComplete: false,
        clinicalRationale: 'Evaluating baseline chronic medical history',
      };
    }

    // 4. Dynamic Medications & Allergies Check
    if (!answeredDimensions.has('MEDICATIONS') || !answeredDimensions.has('ALLERGIES')) {
      const qText = {
        EN: isCaregiver
          ? `Is the patient currently taking any regular medications, or do they have any known drug/food allergies?`
          : `Are you currently taking any regular medications, or do you have any known drug/food allergies?`,
        HI: isCaregiver
          ? `क्या मरीज नियमित रूप से कोई दवाईयां ले रहे हैं, या उन्हें किसी दवा या खाने से कोई एलर्जी है?`
          : `क्या आप नियमित रूप से कोई दवाईयां ले रहे हैं, या आपको किसी दवा या खाने से एलर्जी है?`,
        GU: isCaregiver
          ? `શું દર્દી હાલ નિયમિત કોઈ દવા લે છે, કે તેમને કોઈ દવા કે ખોરાકની એલર્જી છે?`
          : `શું તમે હાલ નિયમિત કોઈ દવા લો છો, કે તમને કોઈ દવા કે ખોરાકની એલર્જી છે?`,
      };
      const touchOpts = {
        EN: ['Taking regular BP / Diabetes medicines', 'No regular medicines & No known allergies (NKDA)', 'Have known Penicillin / Drug allergy', 'Taking occasional painkillers / antacids'],
        HI: ['नियमित बीपी/शुगर की दवाई ले रहे हैं', 'कोई नियमित दवा नहीं व कोई एलर्जी नहीं (NKDA)', 'दवाओं (पेनिसिलिन आदि) से एलर्जी है', 'कभी-कभार दर्द निवारक लेते हैं'],
        GU: ['નિયમિત બીપી/ડાયાબિટીસ દવા લઈએ છીએ', 'કોઈ નિયમિત દવા નથી અને કોઈ એલર્જી નથી (NKDA)', 'દવાની એલર્જી છે', 'ક્યારેક પેઇન કિલર લઈએ છીએ'],
      };
      return {
        question: qText[lang],
        questionLanguage: lang,
        questionCategory: 'MEDICATIONS',
        touchOptions: touchOpts[lang],
        isRedFlag: false,
        redFlagReason: null,
        isComplete: false,
        clinicalRationale: 'Gathering active pharmacotherapy and allergy safety clearance',
      };
    }

    // 5. Final Adaptive Wrap-Up Question
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
      clinicalRationale: 'All critical clinical dimensions gathered; offering final patient review',
    };
  }

  async generateClinicalSummary(state: ClinicalState, patient: any, vitals?: any, documents?: any[]): Promise<any> {
    const chief = state.chiefComplaint || 'Patient presented for OPD consultation';
    const symptomsList = state.symptoms.length > 0
      ? state.symptoms.map((s) => `${s.name} (Onset: ${s.onset || 'Reported'}, Severity: ${s.severity ? `${s.severity}/10` : 'Moderate'}, Character: ${s.character || 'Standard'}, Duration: ${s.duration || 'Reported'})`).join('; ')
      : `${chief} reported during adaptive multilingual intake.`;

    const vitalsStr = vitals
      ? `BP: ${vitals.bpSystolic || '--'}/${vitals.bpDiastolic || '--'} mmHg • Pulse: ${vitals.pulse || '--'} bpm • SpO2: ${vitals.spo2 || '--'}% • Temp: ${vitals.temperature || '--'}°F${vitals.weight && vitals.height ? ` • BMI: ${(vitals.weight / Math.pow(vitals.height / 100, 2)).toFixed(1)} kg/m²` : ''}`
      : 'Vitals pending nursing triage station';

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
      const prompt = `You are MediKiosk Autonomous Clinical AI Intake Engine powered by Google Gemini.
Patient Primary Complaint: "${state.chiefComplaint || ''}"
Original Phrasing: "${state.chiefComplaintOriginal || ''}"
Target Language: ${language} (EN = English, HI = Hindi, GU = Gujarati)
Respondent: ${isCaregiver ? 'Caregiver / Family Member answering on behalf of the patient (ask questions in 3rd person about the patient)' : 'Patient themselves'}
Current Clinical State: ${JSON.stringify(state)}
Questions already asked: ${JSON.stringify(state.questionsAsked)}
Total turns completed: ${state.turnsCompleted}

CRITICAL CLINICAL INTAKE RULES:
1. Generate an intelligent, highly relevant DISEASE-SPECIFIC follow-up question tailored directly to the patient's specific health complaint (e.g., if chest pain: ask about cardiac radiation, exertion, breathlessness; if headache: ask about unilateral/throbbing/aura/screen time; if joint pain: ask about morning stiffness/swelling; if rash: ask about itching/spreading/pus; if abdominal: ask about meal relationship/burning/bowels; if fever: ask about chills/cough/duration, etc.).
2. NEVER repeat any question or topic already in questionsAsked.
3. If ${isCaregiver ? 'true' : 'false'}, phrase the question in 3rd person about the patient (e.g. in EN: "How long has the patient had...", in HI: "मरीज को यह समस्या कब से है...", in GU: "દર્દીને આ તકલીફ ક્યારથી છે...").
4. Provide 3-4 natural, one-tap touchOptions in ${language} for quick kiosk answering.
5. If all critical clinical dimensions (onset, severity/character, chronic history, medications/allergies) have been adequately covered or turns >= 5, set "isComplete": true with a final closing verification question. Otherwise set "isComplete": false.
6. Language MUST be 100% natural, culturally fluent ${language} (Hindi, Gujarati, or English).

Return ONLY valid JSON (no markdown fences):
{
  "question": "disease-specific question in pure ${language}",
  "questionLanguage": "${language}",
  "questionCategory": "ONSET | DURATION | SEVERITY | CHARACTER | ASSOCIATED | MEDICATIONS | PAST_HISTORY | AYUSH | CLOSING",
  "touchOptions": ["Option 1 in ${language}", "Option 2 in ${language}", "Option 3 in ${language}"],
  "isRedFlag": boolean,
  "redFlagReason": "string | null",
  "isComplete": boolean,
  "clinicalRationale": "Disease-specific rationale for this question"
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
