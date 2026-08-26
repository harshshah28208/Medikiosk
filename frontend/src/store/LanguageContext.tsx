import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type LanguageCode = 'en' | 'hi' | 'gu';

interface LanguageOption {
  code: LanguageCode;
  label: string;
  nativeLabel: string;
  speechLocale: string;
  fontFamily: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', nativeLabel: 'English', speechLocale: 'en-IN', fontFamily: 'Inter, sans-serif' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', speechLocale: 'hi-IN', fontFamily: '"Noto Sans Devanagari", sans-serif' },
  { code: 'gu', label: 'Gujarati', nativeLabel: 'ગુજરાતી', speechLocale: 'gu-IN', fontFamily: '"Noto Sans Gujarati", sans-serif' },
];

const DICTIONARY: Record<LanguageCode, Record<string, string>> = {
  en: {
    welcomeTitle: 'Welcome to MediKiosk',
    welcomeSubtitle: 'Your AI-Assisted Patient Intake & Clinical Assistant',
    startNewVisit: 'Start New Visit',
    startNewVisitDesc: 'First time here? Register and begin intake',
    existingPatient: 'Existing Patient',
    existingPatientDesc: 'Look up via Mobile, MRN, or ABHA ID',
    needAssistance: 'Need Staff Assistance',
    needAssistanceDesc: 'Call a reception or clinical attendant',
    selectLanguageTitle: 'Choose Your Preferred Language',
    selectLanguageSubtitle: 'You can talk or type in English, Hindi, or Gujarati at any time',
    continueBtn: 'Continue',
    backBtn: 'Back',
    cancelBtn: 'Cancel',
    phoneLookup: 'Search by Mobile Number',
    mrnLookup: 'Search by MRN Number',
    abhaLookup: 'Search by ABHA Health ID',
    lookupPrompt: 'Enter your details below to fetch your record',
    searchBtn: 'Find Record',
    noRecordFound: 'No existing patient found with these details.',
    registerNewBtn: 'Register as New Patient Instead',
    regTitle: 'Patient Registration',
    regSubtitle: 'Please provide your demographic details',
    fullName: 'Full Name',
    age: 'Age',
    gender: 'Gender',
    phone: 'Mobile Phone',
    email: 'Email Address (Optional)',
    address: 'Residential Address',
    emergencyContact: 'Emergency Contact Phone',
    department: 'Visiting Department',
    reasonForVisit: 'Primary Reason for Visit',
    male: 'Male',
    female: 'Female',
    other: 'Other',
    consentTitle: 'AI-Assisted Clinical History Consent',
    consentExplain1: 'MediKiosk uses Artificial Intelligence to record your symptoms and prepare a structured draft for your doctor.',
    consentExplain2: 'The AI does NOT diagnose disease or prescribe medication.',
    consentExplain3: 'Your licensed physician will thoroughly review, edit, and confirm your clinical details during consultation.',
    consentCheckbox: 'I understand and give consent for AI clinical intake assistance.',
    grantConsentBtn: 'Accept & Start Clinical Intake',
    queueTokenTitle: 'Your OPD Token',
    tokenNumber: 'Token Number',
    queuePosition: 'Estimated Waiting',
    proceedToIntake: 'Proceed to AI Clinical Intake',
    intakeCompletedPrompt: 'Your symptoms have been structured for the clinical team.',
  },
  hi: {
    welcomeTitle: 'मेडीकियोस्क में आपका स्वागत है',
    welcomeSubtitle: 'आपकी एआई-सहायक रोगी पंजीकरण एवं क्लिनिकल प्रणाली',
    startNewVisit: 'नई यात्रा शुरू करें',
    startNewVisitDesc: 'पहली बार आए हैं? पंजीकरण करें और जांच शुरू करें',
    existingPatient: 'पुराने / पंजीकृत रोगी',
    existingPatientDesc: 'मोबाइल नंबर, एमआरएन या आभा आईडी से खोजें',
    needAssistance: 'स्टाफ से सहायता चाहिए',
    needAssistanceDesc: 'अस्पताल सहायक को तुरंत बुलाएं',
    selectLanguageTitle: 'अपनी पसंदीदा भाषा चुनें',
    selectLanguageSubtitle: 'आप पूरी बातचीत के दौरान कभी भी हिंदी, गुजराती या अंग्रेजी में बात कर सकते हैं',
    continueBtn: 'आगे बढ़ें',
    backBtn: 'पीछे जाएं',
    cancelBtn: 'रद्द करें',
    phoneLookup: 'मोबाइल नंबर द्वारा खोजें',
    mrnLookup: 'एमआरएन (MRN) नंबर द्वारा खोजें',
    abhaLookup: 'आभा (ABHA) आईडी द्वारा खोजें',
    lookupPrompt: 'अपना विवरण दर्ज करें',
    searchBtn: 'रिकॉर्ड खोजें',
    noRecordFound: 'इस विवरण के साथ कोई रोगी रिकॉर्ड नहीं मिला।',
    registerNewBtn: 'नया रोगी पंजीकरण करें',
    regTitle: 'रोगी पंजीकरण',
    regSubtitle: 'कृपया अपनी व्यक्तिगत जानकारी भरें',
    fullName: 'पूरा नाम',
    age: 'उम्र',
    gender: 'लिंग',
    phone: 'मोबाइल नंबर',
    email: 'ईमेल (वैकल्पिक)',
    address: 'निवास का पता',
    emergencyContact: 'आपातकालीन संपर्क नंबर',
    department: 'ओपीडी विभाग चुनें',
    reasonForVisit: 'अस्पताल आने का मुख्य कारण / समस्या',
    male: 'पुरुष',
    female: 'महिला',
    other: 'अन्य',
    consentTitle: 'एआई-सहायक क्लिनिकल इतिहास सहमति पत्र',
    consentExplain1: 'मेडीकियोस्क आपके लक्षणों को समझने और डॉक्टर के लिए संरचित सारांश तैयार करने हेतु एआई का उपयोग करता है।',
    consentExplain2: 'एआई कोई बीमारी का अंतिम निर्णय नहीं लेता और न ही दवा लिखता है।',
    consentExplain3: 'परामर्श के दौरान आपके अधिकृत डॉक्टर इन सभी विवरणों की जांच, संपादन और पुष्टि करेंगे।',
    consentCheckbox: 'मैं समझता/समझती हूँ और एआई क्लिनिकल पूछताछ के लिए अपनी सहमति देता/देती हूँ।',
    grantConsentBtn: 'स्वीकार करें और पूछताछ शुरू करें',
    queueTokenTitle: 'आपका ओपीडी टोकन',
    tokenNumber: 'टोकन नंबर',
    queuePosition: 'अनुमानित कतार स्थिति',
    proceedToIntake: 'एआई पूछताछ पर आगे बढ़ें',
    intakeCompletedPrompt: 'आपकी सभी जानकारी क्लिनिकल टीम के लिए सुरक्षित कर ली गई है।',
  },
  gu: {
    welcomeTitle: 'મેડીકિયોસ્કમાં આપનું સ્વાગત છે',
    welcomeSubtitle: 'તમારી AI-સહાયક દર્દી નોંધણી અને ક્લિનિકલ સિસ્ટમ',
    startNewVisit: 'નવી મુલાકાત શરૂ કરો',
    startNewVisitDesc: 'પ્રથમ વખત આવ્યા છો? નોંધણી કરો અને શરૂ કરો',
    existingPatient: 'હાલના દર્દી',
    existingPatientDesc: 'મોબાઇલ નંબર, MRN અથવા ABHA ID દ્વારા શોધો',
    needAssistance: 'સ્ટાફની મદદ જોઈએ છે',
    needAssistanceDesc: 'હોસ્પિટલ સહાયકને બોલાવો',
    selectLanguageTitle: 'તમારી મનપસંદ ભાષા પસંદ કરો',
    selectLanguageSubtitle: 'તમે કોઈપણ સમયે ગુજરાતી, હિન્દી અથવા અંગ્રેજીમાં વાત કરી શકો છો',
    continueBtn: 'આગળ વધો',
    backBtn: 'પાછા જાઓ',
    cancelBtn: 'રદ કરો',
    phoneLookup: 'મોબાઇલ નંબર દ્વારા શોધો',
    mrnLookup: 'MRN નંબર દ્વારા શોધો',
    abhaLookup: 'ABHA હેલ્થ ID દ્વારા શોધો',
    lookupPrompt: 'તમારી વિગતો દાખલ કરો',
    searchBtn: 'રેકોર્ડ શોધો',
    noRecordFound: 'આ વિગતો સાથે કોઈ દર્દીનો રેકોર્ડ મળ્યો નથી.',
    registerNewBtn: 'નવા દર્દી તરીકે નોંધણી કરો',
    regTitle: 'દર્દી નોંધણી',
    regSubtitle: 'કૃપા કરીને તમારી વિગતો ભરો',
    fullName: 'પૂરું નામ',
    age: 'ઉંમર',
    gender: 'જાતિ',
    phone: 'મોબાઇલ નંબર',
    email: 'ઇમેઇલ (વૈકલ્પિક)',
    address: 'રહેઠાણનું સરનામું',
    emergencyContact: 'ઇમરજન્સી સંપર્ક નંબર',
    department: 'ઓપીડી વિભાગ પસંદ કરો',
    reasonForVisit: 'મુલાકાતનું મુખ્ય કારણ / તકલીફ',
    male: 'પુરુષ',
    female: 'સ્ત્રી',
    other: 'અન્ય',
    consentTitle: 'AI-સહાયિત ક્લિનિકલ ઇતિહાસ સંમતિ',
    consentExplain1: 'મેડીકિયોસ્ક તમારા લક્ષણો નોંધવા અને ડૉક્ટર માટે સંક્ષિપ્ત ડ્રાફ્ટ તૈયાર કરવા AI નો ઉપયોગ કરે છે.',
    consentExplain2: 'AI રોગનું નિદાન કરતું નથી કે દવા આપતું નથી.',
    consentExplain3: 'તમારા ડૉક્ટર તપાસ દરમિયાન આ તમામ વિગતોની ચકાસણી અને પુષ્ટિ કરશે.',
    consentCheckbox: 'હું આ શરતો સમજું છું અને AI ક્લિનિકલ પૂછપરછ માટે સંમતિ આપું છું.',
    grantConsentBtn: 'સ્વીકારો અને પૂછપરછ શરૂ કરો',
    queueTokenTitle: 'તમારો OPD ટોકન',
    tokenNumber: 'ટોકન નંબર',
    queuePosition: 'અંદાજિત કતાર સ્થાન',
    proceedToIntake: 'AI ક્લિનિકલ પૂછપરછ પર જાઓ',
    intakeCompletedPrompt: 'તમારી તમામ માહિતી ડૉક્ટરની ટીમ માટે તૈયાર છે.',
  },
};

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: string) => string;
  currentOption: LanguageOption;
  availableLanguages: LanguageOption[];
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLangState] = useState<LanguageCode>(() => {
    const saved = localStorage.getItem('medikiosk_lang') as LanguageCode;
    return saved && ['en', 'hi', 'gu'].includes(saved) ? saved : 'en';
  });

  const setLanguage = useCallback((lang: LanguageCode) => {
    setLangState(lang);
    localStorage.setItem('medikiosk_lang', lang);
  }, []);

  const t = useCallback((key: string): string => {
    return DICTIONARY[language]?.[key] || DICTIONARY.en[key] || key;
  }, [language]);

  const currentOption = SUPPORTED_LANGUAGES.find(l => l.code === language) || SUPPORTED_LANGUAGES[0];

  return (
    <LanguageContext.Provider value={{
      language,
      setLanguage,
      t,
      currentOption,
      availableLanguages: SUPPORTED_LANGUAGES,
    }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextType {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
