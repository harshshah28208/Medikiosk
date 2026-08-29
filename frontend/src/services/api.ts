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

import { DEMO_USERS, DEMO_QUEUE, DEMO_DOCTORS } from './demoFallbackData';

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
      }).catch(() => ({
        patient: {
          id: `pat-${Date.now()}`,
          name: data.name,
          mrn: `MK-${Math.floor(1000 + Math.random() * 9000)}`,
          phone: data.phone,
          age: data.age,
          gender: data.gender,
        },
      })),
    lookup: (query: string, type: string = 'PHONE') =>
      request('/patients/lookup', {
        method: 'POST',
        body: JSON.stringify({ query, type }),
      }).catch(() => ({
        patient: DEMO_USERS['patient@demo.com'].patient,
      })),
    get: (id: string) =>
      request(`/patients/${id}`).catch(() => ({
        patient: DEMO_USERS['patient@demo.com'].patient,
      })),
    me: () => request('/patients/me').catch(() => ({ patient: DEMO_USERS['patient@demo.com'].patient })),
  },

  visits: {
    get: (id: string) =>
      request(`/visits/${id}`).catch(() => ({
        visit: DEMO_QUEUE[0].visit,
      })),
    list: (filters?: Record<string, string>) => {
      const params = new URLSearchParams(filters || {});
      return request(`/visits?${params}`).catch(() => ({
        visits: DEMO_QUEUE.map((q) => q.visit),
      }));
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
      }).catch(() => ({ success: true, vital: data })),
    getForVisit: (visitId: string) =>
      request(`/vitals/visit/${visitId}`).catch(() => ({
        vitals: DEMO_QUEUE[0].visit.vitals,
      })),
  },

  queue: {
    list: (filters?: Record<string, string>) => {
      const params = new URLSearchParams(filters || {});
      return request(`/queue?${params}`).catch(() => ({
        queue: DEMO_QUEUE,
      }));
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
      options?: { isReturningPatient?: boolean; recentChanges?: string; previousPatientInfo?: any }
    ) =>
      request('/conversation/start', {
        method: 'POST',
        body: JSON.stringify({
          visitId,
          language,
          isAyush,
          respondentType,
          isReturningPatient: options?.isReturningPatient,
          recentChanges: options?.recentChanges,
          previousPatientInfo: options?.previousPatientInfo,
        }),
      }).catch(() => {
        const isRet = Boolean(options?.isReturningPatient && !options?.previousPatientInfo?.isNewPatient);
        const patientName = options?.previousPatientInfo?.name ? ` ${options.previousPatientInfo.name}` : '';
        const langLower = (language || 'en').toLowerCase();

        let content = `Welcome to MediKiosk${patientName}. What main symptom or health concern brought you in today?`;
        let touchOptions = ['Fever / Body Ache', 'Chest Pain / Pressure', 'Severe Abdominal Pain', 'Cough / Breathlessness', 'Headache / Dizziness'];

        if (langLower === 'hi') {
          content = isRet
            ? `मेडीकियोस्क में आपका स्वागत है${patientName}। पिछली मुलाकात के बाद से आपके लक्षणों में क्या बदलाव आया है? क्या वे सुधरे हैं, बिगड़े हैं या वैसे ही हैं?`
            : `मेडीकियोस्क में आपका स्वागत है${patientName}। आज आपको क्या मुख्य स्वास्थ्य समस्या या लक्षण महसूस हो रहे हैं?`;
          touchOptions = isRet
            ? ['लक्षणों में सुधार हुआ है', 'लक्षण और बिगड़ गए हैं', 'कोई बदलाव नहीं हुआ', 'नई समस्या शुरू हुई है']
            : ['बुखार / शरीर दर्द', 'सीने में दर्द / दबाव', 'पेट में तेज़ दर्द', 'खांसी / सांस में तकलीफ', 'सिरदर्द / चक्कर आना'];
        } else if (langLower === 'gu') {
          content = isRet
            ? `મેડીકિયોસ્ક માં આપનું સ્વાગત છે${patientName}। અગાઉની મુલાકાત પછી તમારા લક્ષણોમાં શું ફેરફાર થયો છે? સુધારો થયો છે, વધ્યા છે કે એવા જ છે?`
            : `મેડીકિયોસ્ક માં આપનું સ્વાગત છે${patientName}। આજે તમને કઈ મુખ્ય શારીરિક તકલીફ અથવા લક્ષણો જણાય છે?`;
          touchOptions = isRet
            ? ['લક્ષણોમાં સુધારો થયો છે', 'લક્ષણો વધ્યા છે', 'કોઈ ફેરફાર નથી', 'નવી તકલીફ શરૂ થઈ છે']
            : ['તાવ / શરીરનો દુખાવો', 'છાતીમાં દુખાવો / દબાણ', 'પેટમાં તીવ્ર દુખાવો', 'ખાંસી / શ્વાસ લેવામાં તકલીફ', 'માથાનો દુખાવો / ચક્કર'];
        } else if (isRet) {
          content = `Welcome back${patientName}. Since your last visit, how have your symptoms been? Have they improved, worsened, or stayed the same?`;
          touchOptions = ['My symptoms have improved', 'My symptoms have worsened', 'There is no change', 'I have a new problem'];
        }

        return {
          session: { id: `session-${Date.now()}`, visitId, language, status: 'ACTIVE' },
          message: {
            id: 'msg-start',
            role: 'AI',
            content,
          },
          touchOptions,
        };
      }),
    sendMessage: (sessionId: string, data: { content: string; inputMethod?: string; language?: string; rawTranscript?: string; isAyush?: boolean }) =>
      request(`/conversation/${sessionId}/message`, {
        method: 'POST',
        body: JSON.stringify(data),
      }).catch(() => {
        const text = (data.content || '').toLowerCase();
        const langLower = (data.language || 'en').toLowerCase();

        const isClosing = /covers all symptoms|proceed|complete intake|no further|taking them daily|आगे बढ़ें|આગળ વધો|done|bp|diabetes|sugar|chronic|medication|allergy|एलर्जी|દવા|બીપી|સુગર|no medications/i.test(text);
        const isLifestyleAnswer = /sleep|diet|stress|active|routine|hours|नींद|ઊંઘ|તણાવ|તંદુરસ્ત|ભોજન|आहार|sedentary/i.test(text);

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
      }),
    switchLanguage: (sessionId: string, targetLanguage: string, messages: any[] = []) =>
      request(`/conversation/${sessionId}/switch-language`, {
        method: 'POST',
        body: JSON.stringify({ targetLanguage, messages }),
      }).catch(() => {
        const langLower = (targetLanguage || 'en').toLowerCase();
        let latestQuestion = 'Welcome to MediKiosk. What main symptom or health concern brought you in today?';
        let touchOptions = ['Fever / Body Ache', 'Chest Pain / Pressure', 'Severe Abdominal Pain', 'Cough / Breathlessness', 'Headache / Dizziness'];

        if (langLower === 'hi') {
          latestQuestion = 'मेडीकियोस्क में आपका स्वागत है। आज आपको क्या मुख्य स्वास्थ्य समस्या या लक्षण महसूस हो रहे हैं?';
          touchOptions = ['बुखार / शरीर दर्द', 'सीने में दर्द / दबाव', 'पेट में तेज़ दर्द', 'खांसी / सांस में तकलीफ', 'सिरदर्द / चक्कर आना'];
        } else if (langLower === 'gu') {
          latestQuestion = 'મેડીકિયોસ્ક માં આપનું સ્વાગત છે। આજે તમને કઈ મુખ્ય શારીરિક તકલીફ અથવા લક્ષણો જણાય છે?';
          touchOptions = ['તાવ / શરીરનો દુખાવો', 'છાતીમાં દુખાવો / દબાણ', 'પેટમાં તીવ્ર દુખાવો', 'ખાંસી / શ્વાસ લેવામાં તકલીફ', 'માથાનો દુખાવો / ચક્કર'];
        }

        const translatedMessages = messages.map((m: any, idx: number) => {
          if (m.role === 'AI' && idx === messages.length - 1) {
            return { ...m, content: latestQuestion };
          }
          return m;
        });

        return {
          language: targetLanguage,
          latestQuestion,
          touchOptions,
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
      }).catch(() => ({ success: true, consultationId: `cons-${Date.now()}` })),
    prescription: (data: any) =>
      request('/doctor/prescription', {
        method: 'POST',
        body: JSON.stringify(data),
      }).catch(() => ({ success: true, prescriptionId: `rx-${Date.now()}` })),
    getPatient360: (patientId: string) =>
      request(`/doctor/patient-360/${patientId}`).catch(() => ({
        patient: DEMO_USERS['patient@demo.com'].patient,
        timeline: [
          { type: 'VISIT', date: new Date().toISOString(), title: 'General Medicine OPD', description: 'Hypertension Follow-Up' },
          { type: 'VITALS', date: new Date().toISOString(), title: 'BP 138/88 mmHg', description: 'Recorded at Triage' },
        ],
      })),
    summary: (visitId: string) => request(`/doctor/summary/${visitId}`),
    timeline: (patientId: string) => request(`/doctor/timeline/${patientId}`),
    patients: (all = false) => request(`/doctor/patients${all ? '?all=true' : ''}`),
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
  },
};

export default api;
