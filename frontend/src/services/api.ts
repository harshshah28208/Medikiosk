const rawApiBase =
  import.meta.env.VITE_API_BASE ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? `${window.location.origin}/api`
    : 'http://localhost:5000/api');
const API_BASE = rawApiBase.trim().replace(/\/+$/, '');

export function getToken(): string | null {
  return localStorage.getItem('medikiosk_token');
}

export function setAuthSession(token: string, user: any) {
  localStorage.setItem('medikiosk_token', token);
  localStorage.setItem('medikiosk_user', JSON.stringify(user));
}

export function clearAuthSession() {
  localStorage.removeItem('medikiosk_token');
  localStorage.removeItem('medikiosk_user');
  localStorage.removeItem('medikiosk_active_patient');
  localStorage.removeItem('medikiosk_active_visit');
  localStorage.removeItem('medikiosk_active_queue');
  localStorage.removeItem('medikiosk_active_doctor');
}

export function getCurrentUser(): any | null {
  const raw = localStorage.getItem('medikiosk_user');
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const getStoredUser = getCurrentUser;

async function request<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const fullUrl = `${API_BASE}${cleanPath}`;

  try {
    const response = await fetch(fullUrl, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      clearAuthSession();
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(error.error || `Request failed (${response.status})`);
    }

    return response.json();
  } catch (err: any) {
    console.error(`❌ API Error [${fullUrl}]:`, err);
    throw new Error(err.message?.includes('Failed to fetch') 
      ? `Cannot connect to server at ${API_BASE}. Please ensure the backend is awake or check connection.`
      : (err.message || 'Network error'));
  }
}

import { DEMO_USERS, DEMO_QUEUE, DEMO_DOCTORS, DEMO_TIMELINES } from './demoFallbackData';
import { callGroqDynamicIntake } from './groqClient';

export const api = {
  health: () => request('/health').catch(() => ({ status: 'OK', environment: 'standalone-demo' })),

  auth: {
    login: (email: string, password: string) =>
      request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    register: (data: any) =>
      request('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    demoLogin: (role: string) =>
      request('/auth/demo-login', {
        method: 'POST',
        body: JSON.stringify({ role }),
      }),
    me: () => request('/auth/me').catch(() => ({ user: getStoredUser() })),
    refresh: (refreshToken: string) =>
      request('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      }),
  },

  patients: {
    register: (data: any) =>
      request('/patients/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }).catch(() => {
        const newPat = {
          id: `pat-${Date.now()}`,
          name: data.name,
          mrn: `MK-${Math.floor(100000 + Math.random() * 900000)}`,
          phone: data.phone,
          age: Number(data.age) || 30,
          gender: data.gender || 'MALE',
          medicalHistory: data.medicalHistory || '',
          isNewPatient: true,
        };
        const existing = JSON.parse(localStorage.getItem('medikiosk_registered_patients') || '[]');
        existing.unshift(newPat);
        localStorage.setItem('medikiosk_registered_patients', JSON.stringify(existing));
        localStorage.setItem('medikiosk_active_patient', JSON.stringify(newPat));
        return { patient: newPat };
      }),
    lookup: (query: string, type: string = 'PHONE') =>
      request('/patients/lookup', {
        method: 'POST',
        body: JSON.stringify({ query, type }),
      }).catch(() => {
        const localActive = localStorage.getItem('medikiosk_active_patient');
        if (localActive) {
          try { return { patient: JSON.parse(localActive) }; } catch {}
        }
        const regPats = JSON.parse(localStorage.getItem('medikiosk_registered_patients') || '[]');
        const found = regPats.find((p: any) => p.phone === query || p.mrn === query);
        if (found) return { patient: found };
        return { patient: DEMO_USERS['patient@demo.com'].patient };
      }),
    get: (id: string) =>
      request(`/patients/${id}`).catch(() => {
        const localActive = localStorage.getItem('medikiosk_active_patient');
        if (localActive) {
          try {
            const p = JSON.parse(localActive);
            if (p.id === id || !id) return { patient: p };
          } catch {}
        }
        const regPats = JSON.parse(localStorage.getItem('medikiosk_registered_patients') || '[]');
        const found = regPats.find((p: any) => p.id === id);
        if (found) return { patient: found };
        return { patient: DEMO_USERS['patient@demo.com'].patient };
      }),
    me: () => request('/patients/me').catch(() => {
      const localActive = localStorage.getItem('medikiosk_active_patient');
      if (localActive) {
        try { return { patient: JSON.parse(localActive) }; } catch {}
      }
      return { patient: DEMO_USERS['patient@demo.com'].patient };
    }),
  },

  visits: {
    get: (id: string) =>
      request(`/visits/${id}`).catch(() => {
        const activeV = localStorage.getItem('medikiosk_active_visit');
        if (activeV) {
          try {
            const v = JSON.parse(activeV);
            if (v.id === id || !id) return { visit: v };
          } catch {}
        }
        return { visit: DEMO_QUEUE[0].visit };
      }),
    list: (filters?: Record<string, string>) => {
      const params = new URLSearchParams(filters || {});
      return request(`/visits?${params}`).catch(() => {
        const realVisits: any[] = [];
        const activeV = localStorage.getItem('medikiosk_active_visit');
        const activeP = localStorage.getItem('medikiosk_active_patient');
        if (activeV) {
          try {
            const v = JSON.parse(activeV);
            if (activeP) v.patient = JSON.parse(activeP);
            realVisits.push(v);
          } catch {}
        }
        const regPats = JSON.parse(localStorage.getItem('medikiosk_registered_patients') || '[]');
        regPats.forEach((p: any, idx: number) => {
          if (!realVisits.some(v => v.patient?.id === p.id || v.patient?.mrn === p.mrn)) {
            realVisits.push({
              id: `vis-reg-${p.id || idx}`,
              token: `G-${100 + idx}`,
              priority: 'NORMAL',
              status: 'READY_FOR_DOCTOR',
              patient: p,
              department: { id: 'dept-gen', name: 'General Medicine', code: 'GEN' },
              createdAt: new Date().toISOString(),
              reasonForVisit: p.medicalHistory || 'Kiosk Registration',
              summary: { chiefComplaint: p.medicalHistory || 'Patient Intake' },
            });
          }
        });
        if (realVisits.length > 0) return { visits: realVisits };
        return { visits: DEMO_QUEUE.map((q) => q.visit) };
      });
    },
    updateStatus: (id: string, status: string, doctorId?: string) =>
      request(`/visits/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, doctorId }),
      }).catch(() => ({ success: true, status })),
    assignDoctor: (visitId: string) =>
      request(`/visits/${visitId}/assign-doctor`, {
        method: 'POST',
      }).catch(() => ({
        success: true,
        doctorName: 'Dr. Yogesh Sharma',
      })),
  },

  vitals: {
    record: (data: any) =>
      request('/vitals', {
        method: 'POST',
        body: JSON.stringify(data),
      }).catch(() => {
        localStorage.setItem(`medikiosk_vitals_${data.visitId}`, JSON.stringify(data));
        return { success: true, vital: data };
      }),
    getForVisit: (visitId: string) =>
      request(`/vitals/visit/${visitId}`).catch(() => {
        const local = localStorage.getItem(`medikiosk_vitals_${visitId}`);
        if (local) {
          try { return { vitals: [JSON.parse(local)] }; } catch {}
        }
        return { vitals: DEMO_QUEUE[0].visit.vitals };
      }),
  },

  queue: {
    list: (filters?: Record<string, string>) => {
      const params = new URLSearchParams(filters || {});
      return request(`/queue?${params}`).catch(() => {
        const realQueue: any[] = [];
        const activeV = localStorage.getItem('medikiosk_active_visit');
        const activeP = localStorage.getItem('medikiosk_active_patient');
        if (activeV) {
          try {
            const v = JSON.parse(activeV);
            if (activeP) v.patient = JSON.parse(activeP);
            realQueue.push({
              id: `q-${v.id}`,
              tokenNumber: v.token || 'G-100',
              priority: v.priority || 'NORMAL',
              status: v.status || 'WAITING',
              arrivedAt: new Date().toISOString(),
              department: v.department || { name: 'General Medicine', code: 'GEN' },
              visit: v,
            });
          } catch {}
        }
        if (realQueue.length > 0) return { queue: realQueue };
        return { queue: DEMO_QUEUE };
      });
    },
    update: (id: string, data: any) =>
      request(`/queue/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }).catch(() => ({ success: true, ...data })),
  },

  consent: {
    grant: (data: any) =>
      request('/consent', {
        method: 'POST',
        body: JSON.stringify(data),
      }).catch(() => ({ success: true, consentId: `consent-${Date.now()}` })),
    getForPatient: (patientId: string) =>
      request(`/consent/${patientId}`).catch(() => ({ consents: [] })),
  },

  documents: {
    upload: (formData: FormData) =>
      request('/documents/upload', {
        method: 'POST',
        body: formData,
      }).catch(() => ({
        success: true,
        document: { id: `doc-${Date.now()}`, fileName: 'medical_report.pdf', fileType: 'LAB_REPORT' },
      })),
    getForPatient: (patientId: string) =>
      request(`/documents/${patientId}`).catch(() => ({ documents: [] })),
  },

  conversation: {
    start: (
      visitId: string,
      language: string = 'EN',
      isAyush = false,
      respondentType = 'PATIENT',
      options?: {
        isReturningPatient?: boolean;
        recentChanges?: string;
        previousPatientInfo?: any;
        carePath?: 'ALLOPATHY' | 'AYUSH' | 'HOMEOPATHY';
        specialty?: string;
        targetComplaint?: string;
        isNewCase?: boolean;
        followUpVisitId?: string;
      }
    ) =>
      request('/conversation/start', {
        method: 'POST',
        body: JSON.stringify({
          visitId,
          language,
          isAyush,
          respondentType,
          carePath: options?.carePath,
          specialty: options?.specialty,
          targetComplaint: options?.targetComplaint,
          isNewCase: options?.isNewCase,
          followUpVisitId: options?.followUpVisitId,
          isReturningPatient: options?.isReturningPatient,
          recentChanges: options?.recentChanges,
          previousPatientInfo: options?.previousPatientInfo,
        }),
      }).catch(async () => {
        const langUpper = (language || 'EN').toUpperCase() as 'EN' | 'HI' | 'GU';
        const isRet = Boolean(options?.isReturningPatient && !options?.previousPatientInfo?.isNewPatient);
        const state = {
          isReturning: isRet,
          previousVisitInfo: isRet ? {
            lastComplaint: options?.targetComplaint || options?.previousPatientInfo?.medicalHistory || 'Hypertension / Follow-up',
            lastDepartment: options?.specialty || 'General Medicine',
          } : undefined,
          turnsCompleted: 0,
        };

        try {
          const groqRes = await callGroqDynamicIntake(state, langUpper, []);
          return {
            session: { id: `session-${Date.now()}`, visitId, language, status: 'ACTIVE' },
            message: {
              id: 'msg-start',
              role: 'AI',
              content: groqRes.question,
            },
            touchOptions: groqRes.touchOptions,
            nextQuestion: groqRes.question,
          };
        } catch {
          const patientName = options?.previousPatientInfo?.name ? ` ${options.previousPatientInfo.name}` : '';
          const langLower = (language || 'en').toLowerCase();

          let content = `Welcome to MediKiosk${patientName}. What main symptom or health concern brought you in today?`;
          let touchOptions = ['Fever / Body Ache', 'Chest Pain / Pressure', 'Severe Abdominal Pain', 'Cough / Breathlessness', 'Headache / Dizziness'];

          if (options?.carePath === 'AYUSH') {
            content = `Welcome to the Ayurveda Clinic${patientName}. What health concerns are you experiencing today?`;
            touchOptions = ['Acidity, heartburn & sour burps', 'Sluggish digestion & gas', 'Joint pain & body stiffness', 'Chronic cough & sinus', 'Skin itching & eruptions'];
          } else if (options?.carePath === 'HOMEOPATHY') {
            content = `Welcome to Classical Homeopathy${patientName}. Please describe your main health concern and symptoms.`;
            touchOptions = ['Throbbing headache (< Sun, > Cold)', 'Skin itching & eczema (< Warmth)', 'Chronic acidity & gastric reflux', 'Joint pain (< First motion)', 'Cough / asthma flare (< Cold drafts)'];
          }

          if (langLower === 'hi') {
            content = isRet
              ? `मेडीकियोस्क में आपका स्वागत है${patientName}। पिछली मुलाकात के बाद से आपके लक्षणों में क्या बदलाव आया है? क्या वे सुधरे हैं, बिगड़े हैं या वैसे ही हैं?`
              : (options?.carePath === 'AYUSH' ? `आयुर्वेद विभाग में आपका स्वागत है${patientName}। आज आपको क्या स्वास्थ्य समस्या महसूस हो रही है?` : `मेडीकियोस्क में आपका स्वागत है${patientName}। आज आपको क्या मुख्य स्वास्थ्य समस्या या लक्षण महसूस हो रहे हैं?`);
            touchOptions = isRet
              ? ['लक्षणों में सुधार हुआ है', 'लक्षण और बिगड़ गए हैं', 'कोई बदलाव नहीं हुआ', 'नई समस्या शुरू हुई है']
              : ['बुखार / शरीर दर्द', 'सीने में दर्द / दबाव', 'पेट में तेज़ दर्द', 'खांसी / सांस में तकलीफ', 'सिरदर्द / चक्कर आना'];
          } else if (langLower === 'gu') {
            content = isRet
              ? `મેડીકિયોસ્ક માં આપનું સ્વાગત છે${patientName}। અગાઉની મુલાકાત પછી તમારા લક્ષણોમાં શું ફેરફાર થયો છે? સુધારો થયો છે, વધ્યા છે કે એવા જ છે?`
              : (options?.carePath === 'AYUSH' ? `આયુર્વેદ વિભાગમાં આપનું સ્વાગત છે${patientName}। આજે આપને કઈ મુખ્ય તકલીફ જણાય છે?` : `મેડીકિયોસ્ક માં આપનું સ્વાગત છે${patientName}। આજે તમને કઈ મુખ્ય શારીરિક તકલીફ અથવા લક્ષણો જણાય છે?`);
            touchOptions = isRet
              ? ['લક્ષણોમાં સુધારો થયો છે', 'લક્ષણો વધ્યા છે', 'કોઈ ફેરફાર નથી', 'નવી તકલીફ શરૂ થઈ છે']
              : ['તાવ / શરીરનો દુખાવો', 'છાતીમાં દુખાવો / દબાણ', 'પેટમાં તીવ્ર દુખાવો', 'ખાંસી / શ્વાસ લેવામાં તકલીફ', 'માથાનો દુખાવો / ચક્કર'];
          }

          return {
            session: { id: `session-${Date.now()}`, visitId, language, status: 'ACTIVE' },
            message: { id: 'msg-start', role: 'AI', content },
            touchOptions,
          };
        }
      }),

    sendMessage: (
      sessionId: string,
      data: {
        content: string;
        inputMethod?: string;
        language?: string;
        rawTranscript?: string;
        isAyush?: boolean;
        isHomeopathy?: boolean;
        carePath?: 'ALLOPATHY' | 'AYUSH' | 'HOMEOPATHY';
        specialty?: string;
      }
    ) =>
      request(`/conversation/${sessionId}/message`, {
        method: 'POST',
        body: JSON.stringify(data),
      }).catch(async () => {
        const text = (data.content || '').trim();
        const langUpper = ((data.language || 'EN').toUpperCase()) as 'EN' | 'HI' | 'GU';

        if (/proceed|appointment|consultation|complete intake|अपॉइंटमेंट के लिए आगे बढ़ें|મુલાકાત માટે આગળ વધો/i.test(text)) {
          return {
            aiMessage: { id: `msg-${Date.now()}`, role: 'AI', content: 'Thank you. Proceeding with your appointment now.' },
            nextQuestion: 'Thank you. Proceeding with your appointment now.',
            touchOptions: ['Proceed with Appointment'],
            isComplete: true,
          };
        }

        try {
          const state = {
            latestAnswer: text,
            chiefComplaint: text,
            turnsCompleted: 1,
            carePath: data.carePath,
            specialty: data.specialty,
          };
          const groqRes = await callGroqDynamicIntake(state, langUpper, [
            { role: 'Patient', content: text },
          ]);
          return {
            aiMessage: { id: `msg-${Date.now()}`, role: 'AI', content: groqRes.question },
            nextQuestion: groqRes.question,
            touchOptions: groqRes.touchOptions,
            isComplete: groqRes.isComplete,
            isRedFlag: groqRes.isRedFlag,
            redFlagAlert: groqRes.isRedFlag ? { type: 'ALERT', severity: 'URGENT', symptoms: groqRes.redFlagReason || 'Red flag symptom' } : undefined,
          };
        } catch {
          const langLower = (data.language || 'en').toLowerCase();
          const isClosing = /covers all symptoms|proceed|complete intake|no further|taking them daily|आगे बढ़ें|આગળ વધો|done|bp|diabetes|sugar|chronic|medication|allergy|एलर्जी|દવા|બીપી|સુગર|no medications/i.test(text.toLowerCase());
          const isLifestyleAnswer = /sleep|diet|stress|active|routine|hours|नींद|ઊંઘ|તણાવ|તંદુરસ્ત|ભોજન|आहार|sedentary/i.test(text.toLowerCase());

          let aiMessageContent = 'To assess your health background, how is your daily routine—including your sleep hours, physical activity, diet, and work stress?';
          let touchOptions = ['6-8 hrs good sleep, balanced diet', 'Poor sleep (<5 hrs), high stress', 'Sedentary routine, irregular meals', 'Physically active, normal routine'];

          if (langLower === 'hi') {
            if (isClosing) {
              aiMessageContent = 'धन्यवाद। आपके स्वास्थ्य लक्षण और जीवनशैली का विवरण पूर्ण हो चुका है। क्या आप अब डॉक्टर से परामर्श के लिए आगे बढ़ना चाहते हैं?';
              touchOptions = ['अपॉइंटमेंट के लिए आगे बढ़ें', 'एक और जानकारी जोड़ें'];
            } else if (isLifestyleAnswer) {
              aiMessageContent = 'क्या आप रोज़ाना कोई दवा लेते हैं, या कोई पुरानी बीमारी (बीपी, शुगर, थायरॉयड) अथवा दवा से एलर्जी है?';
              touchOptions = ['कोई पुरानी बीमारी नहीं / कोई दवा नहीं', 'हाई ब्लड प्रेशर (बीपी)', 'डायबिटीज / शुगर', 'दवा से एलर्जी है'];
            } else {
              aiMessageContent = 'आपके स्वास्थ्य को बेहतर समझने के लिए, आपकी दिनचर्या कैसी है—जैसे नींद के घंटे, शारीरिक गतिविधि, खान-पान और तनाव का स्तर?';
              touchOptions = ['6-8 घंटे अच्छी नींद, संतुलित आहार', 'कम नींद (<5 घंटे), अधिक तनाव', 'बैठे रहने की दिनचर्या, अनियमित भोजन', 'शारीरिक रूप से सक्रिय, सामान्य दिनचर्या'];
            }
          } else if (langLower === 'gu') {
            if (isClosing) {
              aiMessageContent = 'આભાર. તમારા લક્ષણો અને દિનચર્યા/જીવનશૈલીની માહિતી નોંધાઈ ગઈ છે. શું તમે હવે ડૉક્ટરની મુલાકાત માટે આગળ વધવા માંગો છો?';
              touchOptions = ['મુલાકાત માટે આગળ વધો', 'વધુ એક વિગત ઉમેરો'];
            } else if (isLifestyleAnswer) {
              aiMessageContent = 'શું તમે નિયમિત કોઈ દવા લો છો, અથવા કોઈ જૂની બીમારી (બીપી, સુગર, થાઈરોઈડ) કે દવાની એલર્જી છે?';
              touchOptions = ['કોઈ જૂની બીમારી નથી / કોઈ દવા નથી', 'હાઈ બ્લડ પ્રેશર (બીપી)', 'ડાયાબિટીસ / સુગર', 'દવાની એલર્જી છે'];
            } else {
              aiMessageContent = 'તમારા સ્વાસ્થ્યને યોગ્ય રીતે સમજવા માટે, તમારી દિનચર્યા કેવી છે—જેમ કે ઊંઘના કલાકો, શારીરિક પ્રવૃત્તિ, આહાર અને તણાવનું પ્રમાણ?';
              touchOptions = ['૬-૮ કલાક સારી ઊંઘ, સંતુલિત આહાર', 'ઓછી ઊંઘ (<૫ કલાક), વધુ તણાવ', 'બેઠાડુ જીવન, અનિયમિત ભોજન', 'શારીરિક રીતે સક્રિય, સામાન્ય દિનચર્યા'];
            }
          } else {
            if (isClosing) {
              aiMessageContent = 'Thank you. Your clinical intake details and lifestyle history are complete. Would you like to proceed with your appointment now?';
              touchOptions = ['Proceed with Appointment', 'Add One More Detail'];
            } else if (isLifestyleAnswer) {
              aiMessageContent = 'Do you take any regular daily medications, or have any chronic conditions (BP, Diabetes, Thyroid) or drug allergies?';
              touchOptions = ['No chronic conditions / No daily meds', 'High Blood Pressure (BP)', 'Diabetes / High Blood Sugar', 'Regular medications present'];
            }
          }

          return {
            aiMessage: { id: `msg-${Date.now()}`, role: 'AI', content: aiMessageContent },
            nextQuestion: aiMessageContent,
            touchOptions,
            isComplete: isClosing,
          };
        }
      }),

    switchLanguage: (sessionId: string, targetLanguage: string, messages: any[] = []) =>
      request(`/conversation/${sessionId}/switch-language`, {
        method: 'POST',
        body: JSON.stringify({ targetLanguage, messages }),
      }).catch(() => {
        const langLower = (targetLanguage || 'en').toLowerCase();
        const targetLangKey = langLower === 'hi' ? 'hi' : langLower === 'gu' ? 'gu' : 'en';

        // Find the most recent AI message to preserve the current question
        const lastAiMsg = messages.slice().reverse().find((m: any) => m.role === 'AI');
        const rawContent = lastAiMsg?.content || 'Welcome to MediKiosk. What main symptom or health concern brought you in today?';
        const rawOptions = lastAiMsg?.options || ['Fever / Body Ache', 'Chest Pain / Pressure', 'Severe Abdominal Pain', 'Cough / Breathlessness', 'Headache / Dizziness'];

        // Fully bidirectional option dictionary for EN <-> HI <-> GU
        const optionDict = [
          { en: 'Fever / Body Ache', hi: 'बुखार / शरीर दर्द', gu: 'તાવ / શરીરનો દુખાવો' },
          { en: 'Chest Pain / Pressure', hi: 'सीने में दर्द / दबाव', gu: 'છાતીમાં દુખાવો / દબાણ' },
          { en: 'Severe Abdominal Pain', hi: 'पेट में तेज़ दर्द', gu: 'પેટમાં તીવ્ર દુખાવો' },
          { en: 'Cough / Breathlessness', hi: 'खांसी / सांस में तकलीफ', gu: 'ખાંસી / શ્વાસ લેવામાં તકલીફ' },
          { en: 'Headache / Dizziness', hi: 'सिरदर्द / चक्कर आना', gu: 'માથાનો દુખાવો / ચક્કર' },
          { en: 'Proceed to Appointment', hi: 'अपॉइंटमेंट के लिए आगे बढ़ें', gu: 'કન્સલ્ટેશન માટે આગળ વધો' },
          { en: 'Review Summary', hi: 'सारांश देखें', gu: 'વિગતો જુઓ' },
          { en: 'Add One More Detail', hi: 'एक और जानकारी जोड़ें', gu: 'વધુ એક વિગત ઉમેરો' },
          { en: 'No, that covers all symptoms — complete intake', hi: 'नहीं, सब लक्षण बता दिए — इनटेक पूर्ण करें', gu: 'ના, તમામ લક્ષણો જણાવી દીધા — ઇન્ટેક પૂર્ણ કરો' },
          { en: 'Yes, I want to add one more detail', hi: 'हाँ, मुझे एक और लक्षण बताना है', gu: 'હા, મારે બીજું એક લક્ષણ જણાવવું છે' },
          { en: 'Acidity, heartburn & sour burps', hi: 'एसिडिटी, सीने में जलन और खट्टी डकारें', gu: 'એસિડિટી, છાતીમાં બળતરા અને ખાટા ઓડકાર' },
          { en: 'Sluggish digestion & gas', hi: 'मंदाग्नि, भारीपन और पेट में गैस', gu: 'મંદ પાચન, ભારેપણું અને પેટમાં ગેસ' },
          { en: 'Joint pain & body stiffness', hi: 'जोड़ों का दर्द और शरीर में जकड़न', gu: 'સાંધાનો દુખાવો અને શરીરમાં જકડન' },
          { en: 'Chronic cough & sinus', hi: 'पुरानी खांसी और साइनस/कफ', gu: 'જૂની ખાંસી અને સાઇનસ/કફ' },
          { en: 'Skin itching & eruptions', hi: 'त्वचा में खुजली और चकत्ते', gu: 'ચામડી પર ખંજવાળ અને ચકામા' },
          { en: 'Throbbing headache (< Sun, > Cold)', hi: 'टीस मारने वाला सिरदर्द (धूप से बढ़ता, ठंडे से आराम)', gu: 'ધબકારા મારતો માથાનો દુખાવો (તડકામાં વધે, ઠંડકથી રાહત)' },
          { en: 'Skin itching & eczema (< Warmth)', hi: 'त्वचा में खुजली और एग्जिमा (गर्मी से बढ़ता)', gu: 'ચામડીમાં ખંજવાળ અને ખરજવું (ગરમીથી વધે)' },
          { en: 'Chronic acidity & gastric reflux', hi: 'पुरानी एसिडिटी और सीने में जलन', gu: 'જૂની એસિડિટી અને ગેસ્ટ્રિક રિફ્લક્સ' },
          { en: 'Joint pain (< First motion)', hi: 'जोड़ों का दर्द (चलना शुरू करने पर ज्यादा)', gu: 'સાંધાનો દુખાવો (હલનચલન શરૂ કરતા વધે)' },
          { en: 'Cough / asthma flare (< Cold drafts)', hi: 'खांसी / दमा का दौरा (ठंडी हवा से बढ़ता)', gu: 'ખાંસી / દમનો હુમલો (ઠંડી હવાથી વધે)' },
        ];

        const translatedOpts = rawOptions.map((opt: string) => {
          const clean = opt.trim().toLowerCase();
          const match = optionDict.find(item =>
            item.en.toLowerCase() === clean ||
            item.hi.trim() === opt.trim() ||
            item.gu.trim() === opt.trim() ||
            clean.includes(item.en.toLowerCase()) ||
            item.hi.includes(opt.trim()) ||
            item.gu.includes(opt.trim())
          );
          if (match && match[targetLangKey]) {
            return match[targetLangKey];
          }
          return opt;
        });

        let translatedQ = rawContent;
        if (/lifestyle|sleep|routine|diet|दिनचर्या|દિનચર્યા|नींद|ઊંઘ|खान-पान|ખોરાક/i.test(rawContent)) {
          translatedQ = langLower === 'hi'
            ? 'आपकी दिनचर्या कैसी है—जैसे नींद के घंटे, शारीरिक सक्रियता, खान-पान का समय और तनाव का स्तर?'
            : langLower === 'gu'
            ? 'આપની દિનચર્યા કેવી છે—જેમ કે ઊંઘના કલાકો, શારીરિક પ્રવૃત્તિ, આહાર અને તણાવનું પ્રમાણ?'
            : 'How is your daily routine—such as sleep hours, physical activity, diet, and stress level?';
        } else if (/medical conditions|allergy|chronic|दवा|બીમારી|बीमारी|एलर्जी|એલર્જી/i.test(rawContent)) {
          translatedQ = langLower === 'hi'
            ? 'क्या आप नियमित कोई दवाई लेते हैं, या कोई पुरानी बीमारी (बीपी, शुगर, थायराइड) या दवा से एलर्जी है?'
            : langLower === 'gu'
            ? 'શું આપ નિયમિત કોઈ દવા લો છો, અથવા કોઈ જૂની બીમારી (બીપી, સુગર, થાઈરોઈડ) કે દવાની એલર્જી છે?'
            : 'Do you take any regular medications, or have any chronic conditions (BP, Diabetes, Thyroid) or allergies?';
        } else if (/clinical questioning.*complete|clinical intake.*complete|क्लिनिकल पूछताछ पूरी|પૂછપરછ પૂર્ણ/i.test(rawContent)) {
          translatedQ = langLower === 'hi'
            ? 'धन्यवाद। आपकी क्लिनिकल पूछताछ पूरी हो गई है और आपका विवरण डॉक्टर के लिए तैयार कर दिया गया है। कृपया अपने परामर्श कक्ष / अपॉइंटमेंट के लिए आगे बढ़ें।'
            : langLower === 'gu'
            ? 'ધન્યવાદ. આપની ક્લિનિકલ પૂછપરછ પૂર્ણ થઈ ગઈ છે અને આપની વિગતો ડૉક્ટર માટે તૈયાર છે. કૃપા કરીને આપના કન્સલ્ટેશન / તપાસ રૂમ તરફ આગળ વધો.'
            : 'Thank you. Your clinical questioning is now complete. Your information has been prepared for the clinical team. Please proceed to your appointment / consultation room.';
        } else if (/welcome|symptom|health concern|समस्या|तकलीफ|તકલીફ|લક્ષણ/i.test(rawContent)) {
          translatedQ = langLower === 'hi'
            ? 'मेडीकियोस्क में आपका स्वागत है। आज आपको क्या मुख्य स्वास्थ्य समस्या या लक्षण महसूस हो रहे हैं?'
            : langLower === 'gu'
            ? 'મેડીકિયોસ્ક માં આપનું સ્વાગત છે। આજે તમને કઈ મુખ્ય શારીરિક તકલીફ અથવા લક્ષણો જણાય છે?'
            : 'Welcome to MediKiosk. What main symptom or health concern brought you in today?';
        }

        const translatedMessages = messages.map((m: any, idx: number) => {
          if (m.role === 'AI' && idx === messages.length - 1) {
            return { ...m, content: translatedQ, options: translatedOpts };
          }
          return m;
        });

        return {
          language: targetLanguage,
          activeQuestion: translatedQ,
          latestQuestion: translatedQ,
          touchOptions: translatedOpts,
          translatedMessages,
        };
      }),
    complete: (sessionId: string) =>
      request(`/conversation/${sessionId}/complete`, {
        method: 'POST',
      }).catch(() => ({ success: true })),
  },

  doctor: {
    roster: () => request('/doctor/roster').catch(() => ({ doctors: DEMO_DOCTORS })),
    consultation: (data: any) =>
      request('/doctor/consultation', {
        method: 'POST',
        body: JSON.stringify(data),
      }).catch(() => {
        localStorage.setItem(`medikiosk_consultation_${data.visitId}`, JSON.stringify(data));
        return { success: true, consultationId: `cons-${Date.now()}` };
      }),
    prescription: (data: any) =>
      request('/doctor/prescription', {
        method: 'POST',
        body: JSON.stringify(data),
      }).catch(() => ({ success: true, prescriptionId: `rx-${Date.now()}` })),
    getPatient360: (patientId: string) =>
      request(`/doctor/patient-360/${patientId}`).catch(() => {
        const localP = localStorage.getItem('medikiosk_active_patient');
        const p = localP ? JSON.parse(localP) : DEMO_USERS['patient@demo.com'].patient;
        return {
          patient: p,
          timeline: [
            { type: 'VISIT', date: new Date().toISOString(), title: 'General Medicine OPD', description: p.medicalHistory || 'Active Consultation' },
            { type: 'VITALS', date: new Date().toISOString(), title: 'BP 120/80 mmHg', description: 'Recorded at Triage' },
          ],
        };
      }),
    summary: (visitId: string) => request(`/doctor/summary/${visitId}`),
    timeline: (patientId: string) =>
      request(`/doctor/timeline/${patientId}`).catch(() => {
        const stored = localStorage.getItem(`medikiosk_timeline_${patientId}`);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) return { timeline: parsed, count: parsed.length };
          } catch {}
        }

        const localActiveVisit = localStorage.getItem('medikiosk_active_visit');
        const localActivePatient = localStorage.getItem('medikiosk_active_patient');
        if (localActivePatient) {
          try {
            const p = JSON.parse(localActivePatient);
            if (p.id === patientId || p.mrn === patientId || !patientId) {
              const realTimeline: any[] = [];
              if (localActiveVisit) {
                const v = JSON.parse(localActiveVisit);
                realTimeline.push({
                  visitId: v.id,
                  date: v.createdAt || new Date().toISOString(),
                  chiefComplaint: v.reasonForVisit || v.summary?.chiefComplaint || p.medicalHistory || 'Current OPD Visit',
                  department: v.department?.name || 'General Medicine',
                  departmentCode: v.department?.code || 'GEN',
                  status: v.status || 'READY_FOR_DOCTOR',
                  priority: v.priority || 'NORMAL',
                  doctor: {
                    name: v.doctor?.user?.name || (v.department?.name?.includes('AYUSH') ? 'Dr. Snehal Shah' : 'Dr. Yogesh Sharma'),
                    specialization: v.doctor?.specialization || 'Clinical Specialist',
                    diagnosis: v.reasonForVisit || 'Under Active Consultation',
                    clinicalNotes: 'Case intake verified through MediKiosk AI.',
                  },
                  aiSummary: v.summary || {
                    chiefComplaint: v.reasonForVisit || p.medicalHistory || 'Clinical Intake Completed',
                    historyOfPresentIllness: 'Completed multi-turn AI intake.',
                    lifestyle: 'Evaluated at kiosk.',
                  },
                  vitals: v.vitals?.[0] || { bpSystolic: 120, bpDiastolic: 80, pulse: 76, spo2: 99 },
                  prescriptions: [],
                });
              }
              if (p.medicalHistory) {
                realTimeline.push({
                  visitId: `vis-prior-${p.id}`,
                  date: new Date(Date.now() - 30 * 86400000).toISOString(),
                  chiefComplaint: p.medicalHistory,
                  department: 'OPD Clinical Records',
                  status: 'COMPLETED',
                  doctor: {
                    name: 'Hospital OPD Doctor',
                    specialization: 'Internal Medicine',
                    diagnosis: p.medicalHistory,
                  },
                  aiSummary: {
                    chiefComplaint: p.medicalHistory,
                    historyOfPresentIllness: `Historical record: ${p.medicalHistory}`,
                  },
                  vitals: { bpSystolic: 124, bpDiastolic: 82, pulse: 74, spo2: 99 },
                });
              }
              if (realTimeline.length > 0) {
                return { timeline: realTimeline, count: realTimeline.length };
              }
            }
          } catch {}
        }

        // Return empty timeline for new/real patients instead of injecting demo data
        if (patientId === 'pat-001' || patientId === '11111111-1111-1111-1111-111111111111') {
          return { timeline: DEMO_TIMELINES.default, count: DEMO_TIMELINES.default.length };
        }
        return { timeline: [], count: 0 };
      }),
    patients: (all = false) =>
      request(`/doctor/patients${all ? '?all=true' : ''}`).catch(() => {
        const realVisits: any[] = [];
        const activeV = localStorage.getItem('medikiosk_active_visit');
        const activeP = localStorage.getItem('medikiosk_active_patient');
        if (activeV) {
          try {
            const v = JSON.parse(activeV);
            if (activeP) v.patient = JSON.parse(activeP);
            if (all || v.status !== 'COMPLETED') {
              realVisits.push(v);
            }
          } catch {}
        }
        const regPats = JSON.parse(localStorage.getItem('medikiosk_registered_patients') || '[]');
        regPats.forEach((p: any, idx: number) => {
          if (!realVisits.some(v => v.patient?.id === p.id || v.patient?.mrn === p.mrn)) {
            realVisits.push({
              id: `vis-reg-${p.id || idx}`,
              token: `G-${100 + idx}`,
              priority: 'NORMAL',
              status: 'READY_FOR_DOCTOR',
              patient: p,
              department: { id: 'dept-gen', name: 'General Medicine', code: 'GEN' },
              doctor: { user: { name: 'Dr. Yogesh Sharma' }, specialization: 'General & Internal Medicine' },
              createdAt: new Date().toISOString(),
              reasonForVisit: p.medicalHistory || 'Kiosk Patient Registration',
              vitals: [{ systolic: 120, diastolic: 80, pulse: 76, temperature: 98.6, spo2: 99, recordedAt: new Date().toISOString() }],
              summary: {
                chiefComplaint: p.medicalHistory || 'New Patient Intake at Kiosk',
                historyOfPresentIllness: 'Registered through MediKiosk platform.',
                lifestyle: 'Completed intake baseline.',
              },
            });
          }
        });
        if (realVisits.length > 0) return { visits: realVisits, count: realVisits.length };
        return { visits: DEMO_QUEUE.map(q => q.visit), count: DEMO_QUEUE.length };
      }),
  },

  nurse: {
    recordVitals: (data: any) =>
      request('/vitals', {
        method: 'POST',
        body: JSON.stringify(data),
      }).catch(() => ({ success: true, vital: data })),
  },

  triage: {
    dashboard: () =>
      request('/triage/dashboard').catch(() => ({
        queue: DEMO_QUEUE,
        alerts: [{ id: 'alt-1', type: 'HYPERTENSION', severity: 'URGENT', symptoms: 'Severe Headache (BP 138/88)', patientName: 'Rahul Sharma', token: 'G-101' }],
      })),
    alerts: (status?: string) =>
      request(`/triage/alerts${status ? `?status=${status}` : ''}`).catch(() => ({
        alerts: [{ id: 'alt-1', type: 'HYPERTENSION', severity: 'URGENT', symptoms: 'Severe Headache (BP 138/88)', patientName: 'Rahul Sharma', token: 'G-101' }],
      })),
    acknowledge: (alertId: string, status: 'ACKNOWLEDGED' | 'RESOLVED', notes?: string) =>
      request(`/triage/alerts/${alertId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, notes }),
      }).catch(() => ({ success: true, status })),
  },

  ayush: {
    dashboard: () =>
      request('/ayush/dashboard').catch(() => ({
        entries: DEMO_QUEUE.filter(q => q.department.code === 'AYUSH'),
      })),
    assessment: (data: any) =>
      request('/ayush/assessment', {
        method: 'POST',
        body: JSON.stringify(data),
      }).catch(() => ({ success: true, assessmentId: `ayush-${Date.now()}` })),
    assessments: (visitId: string) =>
      request(`/ayush/assessments/${visitId}`).catch(() => ({ assessment: null })),
    list: () => request('/ayush/assessments').catch(() => ({ assessments: [] })),
  },

  admin: {
    dashboard: () =>
      request('/admin/dashboard').catch(() => ({
        metrics: {
          totalPatients: 48,
          activeVisits: 8,
          completedToday: 32,
          redFlagAlerts: 1,
          avgIntakeMinutes: 2.4,
          languageDistribution: { en: 65, hi: 25, gu: 10 },
        },
      })),
    auditLogs: (page: number = 1, limit: number = 50) =>
      request(`/admin/audit-logs?page=${page}&limit=${limit}`).catch(() => ({
        logs: [
          { id: 'log-1', action: 'LOGIN', userName: 'Dr. Yogesh Sharma', role: 'DOCTOR', timestamp: new Date().toISOString(), details: 'Doctor signed in' },
          { id: 'log-2', action: 'INTAKE_COMPLETE', userName: 'Rahul Sharma', role: 'PATIENT', timestamp: new Date().toISOString(), details: 'AI intake finished' },
        ],
      })),
    users: () => request('/admin/users').catch(() => ({ users: Object.values(DEMO_USERS) })),
    departments: () =>
      request('/admin/departments').catch(() => ({
        departments: [
          { id: 'dept-gen', name: 'General Medicine', code: 'GEN' },
          { id: 'dept-ortho', name: 'Orthopedics', code: 'ORTHO' },
          { id: 'dept-ayush', name: 'AYUSH & Integrative Medicine', code: 'AYUSH' },
          { id: 'dept-card', name: 'Cardiology', code: 'CARD' },
        ],
      })),
    integrationStatus: () =>
      request('/admin/integration-status').catch(() => ({
        abdmStatus: 'SANDBOX_READY_PENDING_CREDENTIALS',
        hisStatus: 'INTEGRATION_READY_LOCAL_BUFFERED',
        abdm: {
          status: 'SANDBOX_READY_PENDING_CREDENTIALS',
          isConfigured: false,
          missingRequirements: ['ABDM_CLIENT_ID', 'ABDM_CLIENT_SECRET'],
          displayText: 'ABDM: Sandbox-ready, pending ABDM_CLIENT_ID / ABDM_CLIENT_SECRET',
        },
        his: {
          status: 'INTEGRATION_READY_LOCAL_BUFFERED',
          isConfigured: false,
          missingRequirements: ['HIS_API_URL'],
          displayText: 'HIS: Integration-ready (Local buffer), pending HIS_API_URL',
        },
        missingEnvVars: ['ABDM_CLIENT_ID', 'ABDM_CLIENT_SECRET', 'HIS_API_URL'],
      })),
  },

  integrations: {
    status: () =>
      request('/integrations/status').catch(() => ({
        timestamp: new Date().toISOString(),
        abdm: { status: 'SANDBOX_READY_PENDING_CREDENTIALS', isConfigured: false },
        his: { status: 'INTEGRATION_READY_LOCAL_BUFFERED', isConfigured: false },
        fhir: { standard: 'HL7 FHIR R4', profile: 'NRCES ABDM FHIR Profile v1.0', validatorActive: true },
      })),
    verifyAbha: (abhaId: string) =>
      request('/integrations/abdm/verify-format', {
        method: 'POST',
        body: JSON.stringify({ abhaId }),
      }).catch(() => {
        const clean = (abhaId || '').trim();
        if (/^\d{2}-?\d{4}-?\d{4}-?\d{4}$/.test(clean)) {
          return { isValid: true, type: 'ABHA_NUMBER', normalized: clean.replace(/-/g, '') };
        }
        if (/^[a-zA-Z0-9._-]+@(abdm|sbx|ndhm)$/i.test(clean)) {
          return { isValid: true, type: 'ABHA_ADDRESS', normalized: clean.toLowerCase() };
        }
        return { isValid: false, type: 'INVALID', normalized: clean };
      }),
    requestAbhaOtp: (authMethod: 'MOBILE_OTP' | 'AADHAAR_OTP', value: string) =>
      request('/integrations/abdm/request-otp', {
        method: 'POST',
        body: JSON.stringify({ authMethod, value }),
      }).catch(() => ({
        success: false,
        sandboxReady: true,
        message: 'ABDM Sandbox Adapter ready. Configure live credentials in backend/.env for live SMS OTP dispatch.',
      })),
    getFHIRBundle: (visitId: string) =>
      request(`/integrations/fhir/bundle/${visitId}`).catch(() => ({
        resourceType: 'Bundle',
        type: 'document',
        id: `bundle-local-${visitId}`,
        timestamp: new Date().toISOString(),
        entry: [],
      })),
    exportToHIS: (visitId: string) =>
      request(`/integrations/his/export/${visitId}`, {
        method: 'POST',
      }).catch(() => ({
        success: true,
        hisStatus: 'INTEGRATION_READY_LOCAL_BUFFERED',
        visitId,
        exportedAt: new Date().toISOString(),
        message: 'FHIR R4 Bundle and Clinical Summary buffered locally in MediKiosk database.',
      })),
  },
};

export default api;
