import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage, type LanguageCode } from '../../../store/LanguageContext';
import { api } from '../../../services/api';
import { speechProvider } from '../../../services/speech';
import {
  Mic, MicOff, Send, Volume2, VolumeX, ShieldAlert,
  Sparkles, CheckCircle2, User, Bot, RefreshCw, ArrowRight, CheckSquare
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'AI' | 'PATIENT';
  content: string;
  timestamp: string;
  options?: string[];
}

export function IntakePage() {
  const { visitId } = useParams();
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();

  const [session, setSession] = useState<any>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [touchOptions, setTouchOptions] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [redFlagAlert, setRedFlagAlert] = useState<any | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const activeLangRef = useRef<LanguageCode>(language);
  useEffect(() => {
    activeLangRef.current = language;
  }, [language]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, touchOptions]);

  // Start AI intake session on mount
  useEffect(() => {
    let isMounted = true;

    const initSession = async () => {
      setIsProcessing(true);
      try {
        const storedVisit = localStorage.getItem('medikiosk_active_visit');
        const storedPatient = localStorage.getItem('medikiosk_active_patient');
        const storedDoctor = localStorage.getItem('medikiosk_active_doctor');
        const storedCarePath = localStorage.getItem('medikiosk_care_path');
        const storedTargetComplaint = localStorage.getItem('medikiosk_target_complaint');
        const storedVisitType = localStorage.getItem('medikiosk_visit_type');
        const recentChanges = localStorage.getItem('medikiosk_recent_changes') || undefined;

        const parsedVisit = storedVisit ? JSON.parse(storedVisit) : null;
        const parsedPatient = storedPatient ? JSON.parse(storedPatient) : null;
        const parsedDoctor = storedDoctor ? JSON.parse(storedDoctor) : null;
        const vId = visitId && visitId !== 'active' ? visitId : (parsedVisit?.id || 'active');

        const currentLang = activeLangRef.current;
        const respondentType = localStorage.getItem('medikiosk_respondent_type') || 'PATIENT';
        const isNewCase = storedVisitType === 'NEW_CASE';
        const isReturning = storedVisitType === 'FOLLOW_UP' || Boolean(
          !isNewCase && !parsedPatient?.isNewPatient &&
          (recentChanges || parsedPatient?.isReturning || (parsedPatient?.visits && parsedPatient.visits.length > 1))
        );

        let carePath: 'ALLOPATHY' | 'AYUSH' | 'HOMEOPATHY' = 'ALLOPATHY';
        if (storedCarePath === 'AYUSH' || storedCarePath === 'AYURVEDA' || parsedDoctor?.system === 'AYURVEDA') {
          carePath = 'AYUSH';
        } else if (storedCarePath === 'HOMEOPATHY' || parsedDoctor?.system === 'HOMEOPATHY') {
          carePath = 'HOMEOPATHY';
        } else if (parsedVisit?.department?.code === 'AYUSH' || parsedVisit?.department?.name?.toLowerCase().includes('ayush')) {
          carePath = 'AYUSH';
        }

        const specialty = parsedDoctor?.specialization || parsedVisit?.department?.name || (carePath === 'AYUSH' ? 'Ayurveda' : carePath === 'HOMEOPATHY' ? 'Classical Homeopathy' : 'General Medicine');
        const doctorName = parsedDoctor?.name || parsedDoctor?.user?.name || undefined;

        const res = await api.conversation.start(vId, currentLang.toUpperCase(), carePath === 'AYUSH', respondentType, {
          carePath,
          specialty,
          doctorName,
          targetComplaint: storedTargetComplaint || parsedVisit?.reasonForVisit,
          isNewCase,
          isReturningPatient: isReturning,
          recentChanges,
          previousPatientInfo: parsedPatient,
        });

        if (isMounted && res?.session) {
          setSession(res.session);
          const initialMsg: ChatMessage = {
            id: res.message?.id || 'welcome',
            role: 'AI',
            content: res.message?.content || res.nextQuestion || 'Welcome to MediKiosk.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            options: res.touchOptions || [],
          };
          setMessages([initialMsg]);
          setTouchOptions(res.touchOptions || []);

          if (audioEnabled) {
            speechProvider.speak(res.message?.content || res.nextQuestion || 'Welcome to MediKiosk.', currentLang);
          }
        }
      } catch (err) {
        console.error('Conversation init error:', err);
      } finally {
        if (isMounted) setIsProcessing(false);
      }
    };

    initSession();

    return () => {
      isMounted = false;
      speechProvider.stopListening();
      speechProvider.stopSpeaking();
    };
  }, []);

  const handleSendMessage = async (textToSend: string, method: 'VOICE' | 'TEXT' | 'TOUCH' = 'TEXT') => {
    if (!textToSend.trim() || isProcessing) return;

    speechProvider.stopSpeaking();
    speechProvider.stopListening();
    setIsListening(false);

    // Phase B Handoff Navigation
    if (/proceed|appointment|consultation|review summary|अपॉइंटमेंट के लिए आगे बढ़ें|सारांश देखें|કન્સલ્ટેશન માટે આગળ વધો|વિગતો જુઓ|ok go to appointment|go to appointment/i.test(textToSend.trim())) {
      const userMsg: ChatMessage = {
        id: `patient-${Date.now()}`,
        role: 'PATIENT',
        content: textToSend.trim(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, userMsg]);
      handleCompleteIntake();
      return;
    }

    if (/add one more detail|एक और जानकारी जोड़ें|વધુ એક વિગત ઉમેરો/i.test(textToSend.trim())) {
      setIsComplete(false);
      const userMsg: ChatMessage = {
        id: `patient-${Date.now()}`,
        role: 'PATIENT',
        content: textToSend.trim(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      const aiPrompt: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'AI',
        content: language === 'hi'
          ? 'कृपया बताएं कि आप अपने स्वास्थ्य या लक्षणों के बारे में क्या अतिरिक्त जानकारी जोड़ना चाहते हैं:'
          : language === 'gu'
          ? 'કૃપા કરીને જણાવો કે આપ આપની તબિયત કે લક્ષણો વિશે કઈ વધારાની વિગત ઉમેરવા માંગો છો:'
          : 'Please tell me what other detail or symptom regarding your condition you would like to share with the doctor:',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        options: language === 'hi'
          ? ['दवाओं से संबंधित अन्य जानकारी', 'कोई पुराना दर्द या एलर्जी', 'खान-पान व दिनचर्या का अन्य प्रभाव']
          : language === 'gu'
          ? ['દવાઓ સંબંધિત અન્ય વિગત', 'કોઈ જૂનો દુખાવો કે એલર્જી', 'ખોરાક અને દિનચર્યાની અન્ય વિગત']
          : ['Additional detail about medications', 'Past chronic aches or allergies', 'Daily routine & diet factors'],
      };
      setMessages((prev) => [...prev, userMsg, aiPrompt]);
      setTouchOptions(aiPrompt.options || []);
      return;
    }

    const userMsg: ChatMessage = {
      id: `patient-${Date.now()}`,
      role: 'PATIENT',
      content: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setTouchOptions([]);
    setIsProcessing(true);

    try {
      const storedDoctor = localStorage.getItem('medikiosk_active_doctor');
      const storedCarePath = localStorage.getItem('medikiosk_care_path');
      const parsedDoctor = storedDoctor ? JSON.parse(storedDoctor) : null;
      let carePath: 'ALLOPATHY' | 'AYUSH' | 'HOMEOPATHY' = 'ALLOPATHY';
      if (storedCarePath === 'AYUSH' || storedCarePath === 'AYURVEDA' || parsedDoctor?.system === 'AYURVEDA') {
        carePath = 'AYUSH';
      } else if (storedCarePath === 'HOMEOPATHY' || parsedDoctor?.system === 'HOMEOPATHY') {
        carePath = 'HOMEOPATHY';
      }

      const currentLang = activeLangRef.current;
      const sessionId = session?.id || 'demo-session';
      const res = await api.conversation.sendMessage(sessionId, {
        content: textToSend.trim(),
        inputMethod: method,
        language: currentLang.toUpperCase(),
        carePath,
        specialty: parsedDoctor?.specialization || (carePath === 'AYUSH' ? 'Ayurveda' : carePath === 'HOMEOPATHY' ? 'Classical Homeopathy' : 'General Medicine'),
        isAyush: carePath === 'AYUSH',
        isHomeopathy: carePath === 'HOMEOPATHY',
      });

      if (res?.nextQuestion) {
        const aiMsg: ChatMessage = {
          id: res.aiMessage?.id || `ai-${Date.now()}`,
          role: 'AI',
          content: res.nextQuestion,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          options: res.touchOptions || [],
        };
        setMessages((prev) => [...prev, aiMsg]);
        setTouchOptions(res.touchOptions || []);

        if (res.hasRedFlag && res.redFlagAlert) {
          setRedFlagAlert(res.redFlagAlert);
        }

        if (res.isComplete) {
          setIsComplete(true);
        }

        if (audioEnabled) {
          speechProvider.speak(res.nextQuestion, currentLang);
        }
      }
    } catch (err: any) {
      console.error('Send message error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const [voiceConfirmation, setVoiceConfirmation] = useState<{ transcript: string } | null>(null);

  const handleVoiceToggle = () => {
    if (isListening) {
      speechProvider.stopListening();
      setIsListening(false);
    } else {
      speechProvider.stopSpeaking();
      setVoiceConfirmation(null);
      setVoiceError(null);
      setIsListening(true);
      speechProvider.startListening(
        activeLangRef.current,
        (transcript, isFinal) => {
          setInputText(transcript);
          if (isFinal) {
            setIsListening(false);
            speechProvider.stopListening();
            setVoiceConfirmation({ transcript });
          }
        },
        (error) => {
          console.warn('Voice error:', error);
          setVoiceError(error);
          setIsListening(false);
        },
        () => {
          setIsListening(false);
        }
      );
    }
  };

  const handleCompleteIntake = async () => {
    setIsProcessing(true);
    try {
      // Build a summary from the conversation messages
      const allPatientAnswers = messages
        .filter((m) => m.role === 'PATIENT')
        .map((m) => m.content)
        .join(' | ');

      const firstAiQ = messages.find((m) => m.role === 'AI')?.content || '';
      const allAiQs = messages
        .filter((m) => m.role === 'AI')
        .map((m) => m.content)
        .join('\n');

      // Extract key clinical fields from conversation
      const chiefComplaint = messages[1]?.content || messages.find((m) => m.role === 'PATIENT')?.content || 'Clinical intake completed';

      const summaryFromConversation = {
        chiefComplaint,
        historyOfPresentIllness: allPatientAnswers,
        lifestyle: messages.filter((m) => m.role === 'PATIENT').slice(1, 3).map((m) => m.content).join('. '),
        pastMedicalHistory: messages.filter((m) => m.role === 'PATIENT').slice(3, 5).map((m) => m.content).join('. ') || 'None reported',
        medications: 'As discussed during intake',
        allergies: 'As reported during intake',
        fullConversation: messages.map((m) => `${m.role === 'AI' ? 'MediKiosk AI' : 'Patient'}: ${m.content}`).join('\n'),
        generatedAt: new Date().toISOString(),
      };

      // Save summary to active visit in localStorage
      const storedVisitRaw = localStorage.getItem('medikiosk_active_visit');
      if (storedVisitRaw) {
        try {
          const storedVisit = JSON.parse(storedVisitRaw);
          storedVisit.summary = summaryFromConversation;
          localStorage.setItem('medikiosk_active_visit', JSON.stringify(storedVisit));
        } catch {/* ignore */}
      }

      if (session?.id) {
        await api.conversation.complete(session.id);
      }
      navigate(`/kiosk/review/${visitId || 'current'}`);
    } catch (err) {
      navigate(`/kiosk/review/${visitId || 'current'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const isSwitchingLangRef = useRef(false);

  const handleLanguageSwitch = async (newLang: LanguageCode) => {
    if (newLang === language || isSwitchingLangRef.current) return;
    isSwitchingLangRef.current = true;
    setLanguage(newLang);
    activeLangRef.current = newLang;
    speechProvider.stopSpeaking();

    const fallbackOptions: Record<LanguageCode, string[]> = {
      en: ['Fever / Body Ache', 'Chest Pain / Pressure', 'Severe Abdominal Pain', 'Cough / Breathlessness', 'Headache / Dizziness'],
      hi: ['बुखार / शरीर दर्द', 'सीने में दर्द / दबाव', 'पेट में तेज़ दर्द', 'खांसी / सांस में तकलीफ', 'सिरदर्द / चक्कर आना'],
      gu: ['તાવ / શરીરનો દુખાવો', 'છાતીમાં દુખાવો / દબાણ', 'પેટમાં તીવ્ર દુખાવો', 'ખાંસી / શ્વાસ લેવામાં તકલીફ', 'માથાનો દુખાવો / ચક્કર'],
    };

    // 1. Instant optimistic local translation pass for messages & touch options
    const optionDict = [
      { en: 'Fever / Body Ache', hi: 'बुखार / शरीर दर्द', gu: 'તાવ / શરીરનો દુખાવો' },
      { en: 'Chest Pain / Pressure', hi: 'सीने में दर्द / दबाव', gu: 'છાતીમાં દુખાવો / દબાણ' },
      { en: 'Severe Abdominal Pain', hi: 'पेट में तेज़ दर्द', gu: 'પેટમાં તીવ્ર દુખાવો' },
      { en: 'Cough / Breathlessness', hi: 'खांसी / सांस में तकलीफ', gu: 'ખાંસી / શ્વાસ લેવામાં તકલીફ' },
      { en: 'Headache / Dizziness', hi: 'सिरदर्द / चक्कर आना', gu: 'માથાનો દુખાવો / ચક્કર' },
      { en: 'Proceed to Appointment', hi: 'अपॉइंटमेंट के लिए आगे बढ़ें', gu: 'કન્સલ્ટેશન માટે આગળ વધો' },
      { en: 'Review Summary', hi: 'सारांश देखें', gu: 'વિગતો જુઓ' },
      { en: 'Add One More Detail', hi: 'एक और जानकारी जोड़ें', gu: 'વધુ એક વિગત ઉમેરો' },
      { en: 'Since today / past few hours', hi: 'आज से / कुछ घंटों से', gu: 'આજથી / થોડા કલાકોથી' },
      { en: '2 to 3 days', hi: '2-3 दिनों से', gu: '૨-૩ દિવસથી' },
      { en: '1 to 2 weeks', hi: '1-2 सप्ताह से', gu: '૧-૨ અઠવાડિયાથી' },
      { en: 'More than a month (chronic)', hi: 'एक महीने से अधिक समय से', gu: 'એક મહિનાથી વધુ સમયથી' },
      { en: 'Mild discomfort / Manageable daily routine', hi: 'हल्की तकलीफ / सामान्य दिनचर्या चल रही है', gu: 'હળવી તકલીફ / સામાન્ય દિનચર્યા ચાલુ છે' },
      { en: 'Moderate discomfort limiting work & physical activity', hi: 'मध्यम परेशानी जिससे काम में रुकावट है', gu: 'મધ્યમ તકલીફ જેનાથી કામમાં મુશ્કેલી છે' },
      { en: 'Severe continuous pain / discomfort disturbing sleep', hi: 'लगातार तेज तकलीफ जिससे नींद नहीं आ रही', gu: 'સતત તીવ્ર તકલીફ જેથી ઊંઘ આવતી નથી' },
      { en: 'Fever / Chills & Body aches', hi: 'बुखार / कंपकंपी और बदन दर्द', gu: 'તાવ / ધ્રુજારી અને કળતર' },
      { en: 'Nausea, vomiting or stomach discomfort', hi: 'जी मिचलाना, उल्टी या पेट में तकलीफ', gu: 'ઉબકા, ઉલટી કે પેટમાં તકલીફ' },
      { en: 'Dizziness, lightheadedness or fatigue', hi: 'चक्कर आना, कमजोरी या भारीपन', gu: 'ચક્કર આવવા, અશક્તિ કે થાક' },
      { en: 'No other associated symptoms noticed', hi: 'कोई अन्य संबंधित लक्षण नहीं है', gu: 'કોઈ અન્ય સંબંધિત લક્ષણો નથી' },
      { en: 'Worse with movement / physical exertion; better with rest', hi: 'काम करने/हिलने पर बढ़ता है; आराम से ठीक होता है', gu: 'શ્રમ/હલનચલનથી વધે છે; આરામ કરવાથી રાહત મળે છે' },
      { en: 'Normal 7-8 hrs sleep & balanced home-cooked food', hi: 'सामान्य 7-8 घंटे गहरी नींद और घर का सादा भोजन', gu: 'સામાન્ય ૭-૮ કલાક ઊંઘ અને સાદો ઘરનો ખોરાક' },
      { en: 'No chronic conditions & no prior surgeries', hi: 'कोई पुरानी बीमारी नहीं व कोई सर्जरी नहीं हुई', gu: 'કોઈ જૂની બીમારી નથી અને કોઈ સર્જરી નથી થઈ' },
      { en: 'Taking daily BP / Diabetes / Thyroid tablets', hi: 'रोज बीपी / शुगर / थायराइड की दवा लेते हैं', gu: 'રોજ બીપી / ડાયાબિટીસ / થાયરોઇડની દવા લઈએ છીએ' },
      { en: 'No regular medicines & No known drug allergies (NKDA)', hi: 'कोई नियमित दवा नहीं व कोई दवा एलर्जी नहीं (NKDA)', gu: 'કોઈ નિયમિત દવા નથી અને કોઈ દવાની એલર્જી નથી (NKDA)' },
    ];

    const translateOptLocal = (optStr: string) => {
      const match = optionDict.find(d => d.en.toLowerCase() === optStr.toLowerCase() || d.hi.trim() === optStr.trim() || d.gu.trim() === optStr.trim());
      return match ? match[newLang] : optStr;
    };

    const translateQLocal = (raw: string) => {
      if (/lifestyle|sleep|routine|diet|दिनचर्या|દિનચર્યા|नींद|ઊંઘ|खान-पान|ખોરાક/i.test(raw)) {
        return newLang === 'hi'
          ? 'आपकी दिनचर्या कैसी है—रात में कितने घंटे गहरी नींद आती है, खान-पान की आदतें और तनाव का स्तर कैसा है?'
          : newLang === 'gu'
          ? 'આપની દિનચર્યા કેવી છે—રાત્રે કેટલા કલાક ઊંઘ આવે છે, ખોરાકની આદતો અને દૈનિક તણાવ કેવો રહે છે?'
          : 'How is your daily routine—including exact hours of sleep per night, sleep quality, dietary habits, and daily stress level?';
      }
      if (/medical history|chronic health|surgeries|पुरानी बीमारी|सर्जरी|બીમારી|સર્જરી/i.test(raw)) {
        return newLang === 'hi'
          ? 'क्या आपको या आपके परिवार में किसी को पुरानी बीमारी (बीपी, शुगर, थायराइड, अस्थमा, दिल की बीमारी) या कोई सर्जरी का इतिहास है?'
          : newLang === 'gu'
          ? 'શું આપને કે આપના પરિવારમાં કોઈને જૂની બીમારી (બીપી, ડાયાબિટીસ, થાયરોઇડ, અસ્થમા, હૃદય રોગ) કે સર્જરીનો ઇતિહાસ છે?'
          : 'Do you or your close family have a history of chronic health conditions (BP, Diabetes, Thyroid, Asthma, Heart disease), or prior surgeries?';
      }
      if (/prescription medicines|drug allergies|penicillin|दवाइयां|दवा से एलर्जी|દવાઓ|દવાની એલર્જી/i.test(raw)) {
        return newLang === 'hi'
          ? 'आप रोज कौन सी नियमित दवाइयां लेते हैं, और क्या आपको किसी दवा से एलर्जी (जैसे पेनिसिलिन, सल्फा या दर्द की दवा) है?'
          : newLang === 'gu'
          ? 'આપ રોજ કઈ નિયમિત દવાઓ લો છો, અને શું આપને કોઈ દવાની એલર્જી (જેમ કે પેનિસિલિન, સલ્ફા કે પેઈનકિલર) છે?'
          : 'What regular prescription medicines do you take daily, and do you have any known drug allergies (such as Penicillin, Sulfa, or pain medicines)?';
      }
      if (/clinical intake is complete|clinical questioning.*complete|क्लिनिकल पूछताछ पूरी|પૂછપરછ પૂર્ણ/i.test(raw)) {
        return newLang === 'hi'
          ? 'धन्यवाद। आपकी क्लिनिकल पूछताछ पूरी हो गई है और आपका विवरण डॉक्टर के लिए तैयार कर दिया गया है। कृपया अपने परामर्श कक्ष / अपॉइंटमेंट के लिए आगे बढ़ें।'
          : newLang === 'gu'
          ? 'ધન્યવાદ. આપની ક્લિનિકલ પૂછપરછ પૂર્ણ થઈ ગઈ છે અને આપની વિગતો ડૉક્ટર માટે તૈયાર છે. કૃપા કરીને આપના કન્સલ્ટેશન / તપાસ રૂમ તરફ આગળ વધો.'
          : 'Thank you. Your clinical intake is complete and your information has been prepared for the clinical team. Please proceed to your appointment / consultation room.';
      }
      if (/how long|begin suddenly|कितने समय|अचानक शुरू|કેટલા સમય|અચાનક શરૂ/i.test(raw)) {
        return newLang === 'hi'
          ? 'आपको यह तकलीफ कब से हो रही है, और क्या यह अचानक शुरू हुई या धीरे-धीरे बढ़ी?'
          : newLang === 'gu'
          ? 'તમને આ તકલીફ કેટલા સમયથી જણાય છે, અને શું તે અચાનક શરૂ થઈ કે ધીમે-ધીમે વધી?'
          : 'How long have you been experiencing this symptom, and did it begin suddenly or gradually?';
      }
      if (/welcome|symptom|health concern|स्वागत|સ્વાગત/i.test(raw)) {
        return newLang === 'hi'
          ? 'अस्पताल में आपका स्वागत है। कृपया बताएं कि आज आपको क्या मुख्य परेशानी या लक्षण महसूस हो रहे हैं?'
          : newLang === 'gu'
          ? 'હોસ્પિટલમાં આપનું સ્વાગત છે. કૃપા કરીને જણાવો કે આજે આપને કઈ મુખ્ય તકલીફ કે લક્ષણો જણાય છે?'
          : 'Welcome to the clinic. Please describe what primary symptoms or health concerns brought you in today?';
      }
      return raw;
    };

    // Optimistically translate local state
    setMessages(prev => prev.map(m => ({
      ...m,
      content: m.role === 'AI' ? translateQLocal(m.content) : m.content,
      options: m.options ? m.options.map(translateOptLocal) : undefined,
    })));

    setTouchOptions(prev => {
      if (!prev || prev.length === 0) return fallbackOptions[newLang];
      return prev.map(translateOptLocal);
    });

    // 2. Sync with backend API translation service
    if (session?.id) {
      try {
        const res = await api.conversation.switchLanguage(session.id, newLang.toUpperCase(), messages);
        const latestQ = res?.activeQuestion || res?.latestQuestion;
        const translatedMsgs = res?.translatedMessages;
        
        let activeOpts = (res?.touchOptions && res.touchOptions.length > 0) ? res.touchOptions : undefined;
        if (!activeOpts && translatedMsgs && translatedMsgs.length > 0) {
          const lastAiInTranslated = translatedMsgs.slice().reverse().find((m: any) => m.role === 'AI');
          if (lastAiInTranslated?.options && lastAiInTranslated.options.length > 0) {
            activeOpts = lastAiInTranslated.options;
          }
        }

        if (translatedMsgs && translatedMsgs.length > 0) {
          setMessages(translatedMsgs);
        } else if (latestQ) {
          setMessages(prev => {
            if (prev.length === 0) return prev;
            const updated = [...prev];
            const lastAiIdx = updated.map(m => m.role).lastIndexOf('AI');
            if (lastAiIdx !== -1) {
              updated[lastAiIdx] = {
                ...updated[lastAiIdx],
                content: latestQ,
                options: activeOpts || updated[lastAiIdx].options,
              };
            }
            return updated;
          });
        }

        if (activeOpts && activeOpts.length > 0) {
          setTouchOptions(activeOpts);
        }

        if (latestQ && audioEnabled) {
          speechProvider.speak(latestQ, newLang).catch(() => {});
        }
      } catch (err) {
        console.warn('Language switch background sync notice:', err);
      } finally {
        isSwitchingLangRef.current = false;
      }
    } else {
      isSwitchingLangRef.current = false;
    }
  };

  const replayMessage = (content: string) => {
    speechProvider.speak(content, activeLangRef.current);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-between p-2 sm:p-6">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col h-[92vh] overflow-hidden">
        
        {/* Top Control Bar */}
        <header className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-bold shadow-md shadow-blue-500/20">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold flex items-center gap-2">
                <span>MediKiosk Clinical AI</span>
                <span className="text-[10px] px-2 py-0.5 bg-emerald-500/30 text-emerald-300 rounded-full font-mono flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Groq Ultra-Fast AI (Qwen 27B)
                </span>
              </h1>
              <p className="text-xs text-slate-400">Autonomous Clinical Intake • Multi-Turn Medical Interview</p>
            </div>
          </div>

          {/* Right Action Controls: Language Switcher & Mute toggle */}
          <div className="flex items-center gap-2">

            <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
              {(['en', 'hi', 'gu'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => handleLanguageSwitch(l)}
                  className={`
                    px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                    ${language === l
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                    }
                  `}
                >
                  {l === 'en' ? 'EN' : l === 'hi' ? 'हिन्दी' : 'ગુજરાતી'}
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                setAudioEnabled(!audioEnabled);
                if (audioEnabled) speechProvider.stopSpeaking();
              }}
              className={`p-2.5 rounded-xl transition-all ${
                audioEnabled
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'bg-slate-800 text-red-400'
              }`}
              title={audioEnabled ? 'Voice Enabled (Tap to Mute)' : 'Voice Muted (Tap to Enable)'}
            >
              {audioEnabled ? <Volume2 className="w-5 h-5 animate-pulse" /> : <VolumeX className="w-5 h-5" />}
            </button>
          </div>
        </header>

        {/* Visual 4-Stage Clinical Intake Progress Stepper */}
        {(() => {
          const aiCount = messages.filter(m => m.role === 'AI').length;
          const currentStage = isComplete || aiCount >= 6 ? 4 : aiCount >= 4 ? 3 : aiCount >= 2 ? 2 : 1;
          const stages = [
            { num: 1, label: language === 'hi' ? 'मुख्य समस्या' : language === 'gu' ? 'મુખ્ય સમસ્યા' : 'Chief Concern' },
            { num: 2, label: language === 'hi' ? 'लक्षण विस्तार' : language === 'gu' ? 'લક્ષણ વિગત' : 'Symptom Details' },
            { num: 3, label: language === 'hi' ? 'स्वास्थ्य इतिहास' : language === 'gu' ? 'ઇતિહાસ' : 'Medical History' },
            { num: 4, label: language === 'hi' ? 'समीक्षा व डॉक्टर' : language === 'gu' ? 'ડૉક્ટર સમીક્ષા' : 'Doctor Review' },
          ];

          return (
            <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 shrink-0">
              <div className="flex items-center justify-between gap-1 max-w-2xl mx-auto">
                {stages.map((st, sIdx) => {
                  const isActive = currentStage === st.num;
                  const isDone = currentStage > st.num || isComplete;

                  return (
                    <React.Fragment key={st.num}>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                            isDone
                              ? 'bg-emerald-500 text-white shadow-sm'
                              : isActive
                              ? 'bg-blue-600 text-white ring-2 ring-blue-400 ring-offset-1 ring-offset-slate-900'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {isDone ? '✓' : st.num}
                        </div>
                        <span
                          className={`text-[11px] font-semibold hidden sm:inline ${
                            isActive
                              ? 'text-blue-300'
                              : isDone
                              ? 'text-emerald-300'
                              : 'text-slate-500'
                          }`}
                        >
                          {st.label}
                        </span>
                      </div>
                      {sIdx < stages.length - 1 && (
                        <div
                          className={`flex-1 h-0.5 mx-1 transition-all ${
                            currentStage > st.num ? 'bg-emerald-500/60' : 'bg-slate-800'
                          }`}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Emergency Red Flag Notice Banner */}
        {redFlagAlert && (
          <div className="p-4 bg-red-600 text-white flex items-center justify-between shadow-inner shrink-0">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-6 h-6 animate-pulse shrink-0" />
              <p className="text-xs sm:text-sm font-semibold">
                {redFlagAlert.patientNotice?.[language.toUpperCase() as 'EN' | 'HI' | 'GU'] || redFlagAlert.description}
              </p>
            </div>
            <span className="text-xs font-bold bg-white text-red-700 px-3 py-1 rounded-full uppercase tracking-wider shrink-0">
              Triage Alerted
            </span>
          </div>
        )}

        {/* Chat Conversation Scroll Area */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 bg-slate-50/50">
          {messages.map((msg) => {
            const isAI = msg.role === 'AI';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isAI ? 'justify-start' : 'justify-end'}`}
              >
                {isAI && (
                  <div className="w-9 h-9 bg-blue-600 text-white rounded-full flex items-center justify-center shrink-0 shadow-sm mt-1">
                    <Bot className="w-5 h-5" />
                  </div>
                )}

                <div
                  className={`
                    max-w-[82%] sm:max-w-[70%] p-4 rounded-3xl text-sm sm:text-base leading-relaxed shadow-sm relative group
                    ${isAI
                      ? 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-sm'
                      : 'bg-blue-600 text-white rounded-tr-sm shadow-blue-600/20'
                    }
                  `}
                >
                  <p>{msg.content}</p>
                  
                  <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100/60">
                    <span
                      className={`block text-[10px] font-mono ${
                        isAI ? 'text-slate-400' : 'text-blue-200'
                      }`}
                    >
                      {msg.timestamp}
                    </span>

                    {isAI && (
                      <button
                        onClick={() => replayMessage(msg.content)}
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium pl-2 touch-target"
                        title="Replay Voice"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold">Play Audio</span>
                      </button>
                    )}
                  </div>
                </div>

                {!isAI && (
                  <div className="w-9 h-9 bg-slate-800 text-white rounded-full flex items-center justify-center shrink-0 shadow-sm mt-1">
                    <User className="w-5 h-5" />
                  </div>
                )}
              </div>
            );
          })}

          {/* AI Thinking Indicator */}
          {isProcessing && (
            <div className="flex items-center gap-3 text-slate-500 text-sm">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center animate-pulse">
                <Sparkles className="w-4 h-4 text-blue-600" />
              </div>
              <span className="animate-pulse font-medium">
                {language === 'hi' ? 'क्लिनिकल AI विश्लेषण कर रहा है...' : language === 'gu' ? 'ક્લિનિકલ AI વિચારણા કરી રહ્યું છે...' : 'Clinical AI is evaluating...'}
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </main>

        {/* Prominent Intake Completion Card — Only shown when all clinical questions are completed */}
        {isComplete && (
          <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-t-2 border-emerald-500 shadow-md shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-600 text-white rounded-full flex items-center justify-center shrink-0 shadow-md">
                <CheckSquare className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-emerald-950">
                  {language === 'hi' ? 'क्लिनिकल इनटेक सफलतापूर्वक पूर्ण हुआ!' : language === 'gu' ? 'ક્લિનિકલ ઇન્ટેક સફળતાપૂર્વક પૂર્ણ થયું!' : 'Clinical Intake Successfully Completed!'}
                </h3>
                <p className="text-xs text-emerald-800">
                  {language === 'hi' ? 'सभी आवश्यक लक्षण व क्लिनिकल विवरण रिकॉर्ड हो चुके हैं।' : language === 'gu' ? 'તમામ જરૂરી લક્ષણો અને વિગતો ડૉક્ટર માટે નોંધાઈ ચૂકી છે.' : 'All necessary clinical dimensions recorded. Proceed to report & prescription review.'}
                </p>
              </div>
            </div>
            <button
              onClick={handleCompleteIntake}
              disabled={isProcessing}
              className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-2xl font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 shrink-0 touch-target"
            >
              <span>{language === 'hi' ? 'रिपोर्ट व दस्तावेज़ देखें' : language === 'gu' ? 'રિપોર્ટ અને દસ્તાવેજ જુઓ' : 'Go to Report & Documents'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Quick Touch Options */}
        {!isComplete && (touchOptions.length > 0 || (messages.length > 0 && messages[messages.length - 1]?.role === 'AI' && messages[messages.length - 1]?.options && (messages[messages.length - 1]?.options?.length || 0) > 0)) && !isProcessing && (
          <div className="p-3 bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-slate-50 border-t border-slate-200 shrink-0">
            <p className="text-[11px] font-bold text-blue-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
              {language === 'hi' ? 'त्वरित उत्तर विकल्प (दबाकर चुनें):' : language === 'gu' ? 'ઝડપી ઉત્તર વિકલ્પો (દબાવીને પસંદ કરો):' : 'Quick One-Tap Answer Options:'}
            </p>
            <div className="flex flex-wrap gap-2">
              {(touchOptions.length > 0 ? touchOptions : (messages[messages.length - 1]?.options || [])).map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(option, 'TOUCH')}
                  className="px-4 py-2.5 bg-white hover:bg-blue-600 hover:text-white border border-blue-200/80 hover:border-blue-600 text-slate-800 font-semibold text-xs sm:text-sm rounded-xl shadow-sm transition-all touch-target active:scale-95 flex items-center gap-2 group"
                >
                  <span className="w-2 h-2 rounded-full bg-blue-500 group-hover:bg-white shrink-0 transition-colors" />
                  <span>{option}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Voice Transcription Confirmation Banner (Requirement 32: Voice -> Transcription -> Patient Confirmation -> Edit / Retry / Confirm) */}
        {voiceConfirmation && !isProcessing && (
          <div className="p-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white border-t-2 border-blue-400 shrink-0 shadow-2xl animate-fade-in flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs font-bold uppercase tracking-wider text-blue-200">
                  {language === 'hi' ? 'आवाज़ रिकॉर्ड हुई — पुष्टि करें' : language === 'gu' ? 'અવાજ રેકોર્ડ થયો — પુષ્ટિ કરો' : 'Voice Transcription Captured — Please Confirm'}
                </span>
              </div>
              <span className="text-[10px] text-slate-300 bg-white/10 px-2 py-0.5 rounded-full">
                {language === 'hi' ? 'भेजने से पहले समीक्षा करें' : language === 'gu' ? 'મોકલતા પહેલા તપાસો' : 'Review before sending'}
              </span>
            </div>

            <div className="p-3 bg-white/10 border border-white/20 rounded-xl text-sm font-medium text-white shadow-inner">
              "{voiceConfirmation.transcript}"
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  const textToSend = voiceConfirmation.transcript;
                  setVoiceConfirmation(null);
                  setInputText('');
                  handleSendMessage(textToSend, 'VOICE');
                }}
                className="flex-1 py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 transition-all touch-target"
              >
                <CheckSquare className="w-4 h-4" />
                <span>{language === 'hi' ? 'पुष्टि करें और भेजें' : language === 'gu' ? 'પુષ્ટિ કરો અને મોકલો' : 'Confirm & Send Response'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setInputText(voiceConfirmation.transcript);
                  setVoiceConfirmation(null);
                }}
                className="py-2.5 px-3 bg-white/20 hover:bg-white/30 text-white font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 touch-target"
              >
                <span>✏️</span>
                <span>{language === 'hi' ? 'टेक्स्ट बदलें / सुधारें' : language === 'gu' ? 'ટેક્સ્ટ સુધારો' : 'Edit Text'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setVoiceConfirmation(null);
                  handleVoiceToggle();
                }}
                className="py-2.5 px-3 bg-red-500/30 hover:bg-red-500/50 text-red-200 font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 touch-target"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>{language === 'hi' ? 'फिर से बोलें' : language === 'gu' ? 'ફરીથી બોલો' : 'Retry Voice'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Bottom Input / Phase B Handoff Bar */}
        <footer className="p-4 bg-white border-t border-slate-200 shrink-0 flex flex-col gap-2.5">
          {!isComplete ? (
            <>
              <div className="flex items-center justify-between px-1">
                <span className="text-xs text-gray-500">ASR: Browser (Web Speech API)</span>
              </div>

              {voiceError && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center justify-between animate-fade-in">
                  <span>{voiceError}</span>
                  <button type="button" onClick={() => setVoiceError(null)} className="text-amber-600 hover:text-amber-800 font-bold ml-2">✕</button>
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setVoiceConfirmation(null);
                  setVoiceError(null);
                  handleSendMessage(inputText, 'TEXT');
                }}
                className="flex items-center gap-2"
              >
                {/* Voice Input Button */}
                <button
                  type="button"
                  onClick={handleVoiceToggle}
                  className={`
                    p-3.5 rounded-2xl font-bold flex items-center justify-center transition-all shadow-md touch-target
                    ${isListening
                      ? 'bg-red-600 text-white animate-bounce shadow-red-600/30'
                      : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/20'
                    }
                  `}
                  title={isListening ? 'Stop Listening' : 'Speak Your Symptoms'}
                >
                  {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </button>

                {/* Text Input */}
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={
                    language === 'hi'
                      ? 'यहाँ अपनी समस्या टाइप करें या माइक दबाकर बोलें...'
                      : language === 'gu'
                      ? 'અહીં આપની તકલીફ લખો અથવા માઇક દબાવીને બોલો...'
                      : 'Type your symptoms or tap the microphone to speak...'
                  }
                  disabled={isProcessing}
                  className="flex-1 px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
                />

                {/* Send Button */}
                <button
                  type="submit"
                  disabled={!inputText.trim() || isProcessing}
                  className="p-3.5 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all touch-target"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </>
          ) : (
            /* Phase B Complete Handoff CTA (Hide input/mic & show primary handoff button) */
            <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-gradient-to-r from-emerald-900 to-teal-950 text-white border border-emerald-500/40 rounded-2xl animate-fade-in shadow-xl gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/20 border border-emerald-400/40 rounded-xl flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    {language === 'hi'
                      ? 'क्लिनिकल पूछताछ पूर्ण हुई'
                      : language === 'gu'
                      ? 'ક્લિનિકલ પૂછપરછ પૂર્ણ થઈ'
                      : 'Clinical Questioning Complete'}
                  </h4>
                  <p className="text-xs text-emerald-200">
                    {language === 'hi'
                      ? 'आपका संपूर्ण विवरण डॉक्टर व क्लिनिकल टीम के लिए तैयार कर दिया गया है।'
                      : language === 'gu'
                      ? 'આપની તમામ વિગતો ડૉક્ટર અને તપાસ ટીમ માટે તૈયાર છે.'
                      : 'Your information has been compiled for physician review.'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => {
                    handleSendMessage(language === 'hi' ? 'एक और जानकारी जोड़ें' : language === 'gu' ? 'વધુ એક વિગત ઉમેરો' : 'Add One More Detail', 'TOUCH');
                  }}
                  className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs rounded-xl border border-white/20 transition-all touch-target cursor-pointer"
                >
                  {language === 'hi' ? '+ एक और जानकारी जोड़ें' : language === 'gu' ? '+ વધુ એક વિગત ઉમેરો' : '+ Add One More Detail'}
                </button>

                <button
                  type="button"
                  onClick={handleCompleteIntake}
                  disabled={isProcessing}
                  className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-500/30 transition-all flex items-center justify-center gap-2 touch-target cursor-pointer"
                >
                  <span>{language === 'hi' ? 'अपॉइंटमेंट के लिए आगे बढ़ें' : language === 'gu' ? 'કન્સલ્ટેશન માટે આગળ વધો' : 'Proceed to Appointment'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}
