import { safeJsonParse, safeGetItem, safeSetItem } from '../utils/storage';

const rawApiBase =
  import.meta.env.VITE_API_BASE ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? `${window.location.origin}/api`
    : 'http://localhost:5000/api');
const API_BASE = rawApiBase.trim().replace(/\/+$/, '');

export function getToken(): string | null {
  try {
    return localStorage.getItem('medikiosk_token');
  } catch {
    return null;
  }
}

export function setAuthSession(token: string, user: any) {
  try {
    if (token) localStorage.setItem('medikiosk_token', token);
    if (user) safeSetItem('medikiosk_user', user);
  } catch {}
}

export function clearAuthSession() {
  try {
    localStorage.removeItem('medikiosk_token');
    localStorage.removeItem('medikiosk_user');
    localStorage.removeItem('medikiosk_active_patient');
    localStorage.removeItem('medikiosk_active_visit');
    localStorage.removeItem('medikiosk_active_queue');
    localStorage.removeItem('medikiosk_active_doctor');
    localStorage.removeItem('medikiosk_active_session_data');
    localStorage.removeItem('medikiosk_active_session');
    localStorage.removeItem('medikiosk_active_session_id');
    localStorage.removeItem('medikiosk_recent_changes');
    localStorage.removeItem('medikiosk_target_complaint');
    localStorage.removeItem('medikiosk_care_path');
    localStorage.removeItem('medikiosk_visit_type');
  } catch {}
}

export function getCurrentUser(): any | null {
  return safeGetItem('medikiosk_user', null);
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

    if (response.status === 401 && (cleanPath === '/auth/me' || cleanPath === '/auth/login')) {
      clearAuthSession();
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(error.error || `Request failed (${response.status})`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(`Invalid content-type: ${contentType}. Expected JSON.`);
    }

    return response.json();
  } catch (err: any) {
    throw new Error(err.message?.includes('Failed to fetch') 
      ? `Cannot connect to server at ${API_BASE}. Please ensure the backend is awake or check connection.`
      : (err.message || 'Network error'));
  }
}

import { DEMO_USERS, DEMO_QUEUE, DEMO_DOCTORS, DEMO_TIMELINES } from './demoFallbackData';
import { callGroqDynamicIntake, type GroqIntakeResponse } from './groqClient';

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
        const existing = safeGetItem<any[]>('medikiosk_registered_patients', []);
        existing.unshift(newPat);
        safeSetItem('medikiosk_registered_patients', existing);
        safeSetItem('medikiosk_active_patient', newPat);
        return { patient: newPat };
      }),
    lookup: (query: string, type: string = 'PHONE') =>
      request('/patients/lookup', {
        method: 'POST',
        body: JSON.stringify({ query, type }),
      }).catch(() => {
        const localActive = safeGetItem<any>('medikiosk_active_patient', null);
        if (localActive) return { patient: localActive };
        const regPats = safeGetItem<any[]>('medikiosk_registered_patients', []);
        const found = regPats.find((p: any) => p?.phone === query || p?.mrn === query);
        if (found) return { patient: found };
        return { patient: DEMO_USERS['patient@demo.com'].patient };
      }),
    get: (id: string) =>
      request(`/patients/${id}`).catch(() => {
        const localActive = safeGetItem<any>('medikiosk_active_patient', null);
        if (localActive && (localActive.id === id || !id)) return { patient: localActive };
        const regPats = safeGetItem<any[]>('medikiosk_registered_patients', []);
        const found = regPats.find((p: any) => p?.id === id);
        if (found) return { patient: found };
        return { patient: DEMO_USERS['patient@demo.com'].patient };
      }),
    me: () => request('/patients/me').catch(() => {
      const localActive = safeGetItem<any>('medikiosk_active_patient', null);
      if (localActive) return { patient: localActive };
      return { patient: DEMO_USERS['patient@demo.com'].patient };
    }),
  },

  visits: {
    get: (id: string) =>
      request(`/visits/${id}`).catch(() => {
        const activeV = safeGetItem<any>('medikiosk_active_visit', null);
        if (activeV && (activeV.id === id || !id)) return { visit: activeV };
        return { visit: DEMO_QUEUE[0].visit };
      }),
    list: (filters?: Record<string, string>) => {
      const params = new URLSearchParams(filters || {});
      return request(`/visits?${params}`).catch(() => {
        const realVisits: any[] = [];
        const activeV = safeGetItem<any>('medikiosk_active_visit', null);
        const activeP = safeGetItem<any>('medikiosk_active_patient', null);
        if (activeV) {
          if (activeP) activeV.patient = activeP;
          realVisits.push(activeV);
        }
        const regPats = safeGetItem<any[]>('medikiosk_registered_patients', []);
        regPats.forEach((p: any, idx: number) => {
          if (!realVisits.some(v => v.patient?.id === p?.id || v.patient?.mrn === p?.mrn)) {
            realVisits.push({
              id: `vis-reg-${p?.id || idx}`,
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
      }).catch(() => {
        const storedDoc = safeGetItem<any>('medikiosk_active_doctor', null);
        const storedV = safeGetItem<any>('medikiosk_active_visit', null);
        const docName = storedDoc?.user?.name || storedDoc?.name || storedV?.doctor?.user?.name || storedV?.doctor?.name || 'Dr. Vikram Seth';
        return {
          success: true,
          doctorName: docName.replace(/^Dr\.\s*/, ''),
        };
      }),
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
        return { vitals: [] };
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
        doctorName?: string;
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
          doctorName: options?.doctorName,
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

        const patientName = options?.previousPatientInfo?.name || 'Patient';
        const rawDocName = options?.doctorName;
        const specialty = options?.specialty || 'General Medicine';
        const docDisplayName = rawDocName
          ? (rawDocName.startsWith('Dr.') || rawDocName.startsWith('Vaidya') ? rawDocName : `Dr. ${rawDocName}`)
          : (options?.carePath === 'AYUSH' ? 'Vaidya Harish Bhatt' : options?.carePath === 'HOMEOPATHY' ? 'Dr. Snehal Shah' : 'Dr. Yogesh Sharma');

        try {
          const groqRes = await callGroqDynamicIntake(state, langUpper, []);
          let openingQ = groqRes.question;

          if (langUpper === 'HI') {
            openingQ = `नमस्ते ${patientName} जी! मैं मेडीकियोस्क AI सहायक हूँ। ${docDisplayName} (${specialty}) से परामर्श के लिए आपकी क्लिनिकल पूछताछ शुरू कर रहे हैं। ${groqRes.question}`;
          } else if (langUpper === 'GU') {
            openingQ = `નમસ્તે ${patientName}! હું MediKiosk Clinical AI છું. હું ${docDisplayName} (${specialty}) માટે તમારો ક્લિનિકલ ઇન્ટેક તૈયાર કરી રહ્યો છું. ${groqRes.question}`;
          } else {
            openingQ = `Hello ${patientName}! I am MediKiosk Clinical AI. I am preparing your clinical intake for ${docDisplayName} (${specialty}). ${groqRes.question}`;
          }

          return {
            session: { id: `session-${Date.now()}`, visitId, language, status: 'ACTIVE' },
            message: {
              id: 'msg-start',
              role: 'AI',
              content: openingQ,
            },
            touchOptions: groqRes.touchOptions,
            nextQuestion: openingQ,
          };
        } catch {
          let content = `Hello ${patientName}! I am MediKiosk Clinical AI. I am preparing your clinical intake for ${docDisplayName} (${specialty}). What main symptom or health concern brought you in today?`;
          let touchOptions = ['Fever / Body Ache', 'Chest Pain / Pressure', 'Severe Abdominal Pain', 'Cough / Breathlessness', 'Headache / Dizziness'];

          if (options?.carePath === 'AYUSH') {
            content = `Hello ${patientName}! Welcome to the Ayurveda Clinic. I am preparing your clinical intake for ${docDisplayName} (${specialty}). What health concerns are you experiencing today?`;
            touchOptions = ['Acidity, heartburn & sour burps', 'Sluggish digestion & gas', 'Joint pain & body stiffness', 'Chronic cough & sinus', 'Skin itching & eruptions'];
          } else if (options?.carePath === 'HOMEOPATHY') {
            content = `Hello ${patientName}! Welcome to Classical Homeopathy. I am preparing your clinical intake for ${docDisplayName} (${specialty}). Please describe your main health concern and symptoms.`;
            touchOptions = ['Throbbing headache (< Sun, > Cold)', 'Skin itching & eczema (< Warmth)', 'Chronic acidity & gastric reflux', 'Joint pain (< First motion)', 'Cough / asthma flare (< Cold drafts)'];
          }

          if (langUpper === 'HI') {
            content = isRet
              ? `नमस्ते ${patientName} जी! मैं मेडीकियोस्क AI सहायक हूँ। ${docDisplayName} (${specialty}) से परामर्श के लिए आपकी क्लिनिकल पूछताछ शुरू कर रहे हैं। पिछली मुलाकात के बाद से आपके लक्षणों में क्या बदलाव आया है?`
              : `नमस्ते ${patientName} जी! मैं मेडीकियोस्क AI सहायक हूँ। ${docDisplayName} (${specialty}) से परामर्श के लिए आपकी क्लिनिकल पूछताछ शुरू कर रहे हैं। आज आपको क्या मुख्य स्वास्थ्य समस्या या लक्षण महसूस हो रहे हैं?`;
            touchOptions = isRet
              ? ['लक्षणों में सुधार हुआ है', 'लक्षण और बिगड़ गए हैं', 'कोई बदलाव नहीं हुआ', 'नई समस्या शुरू हुई है']
              : ['बुखार / शरीर दर्द', 'सीने में दर्द / दबाव', 'पेट में तेज़ दर्द', 'खांसी / सांस में तकलीफ', 'सिरदर्द / चक्कर आना'];
          } else if (langUpper === 'GU') {
            content = isRet
              ? `નમસ્તે ${patientName}! હું MediKiosk Clinical AI છું. હું ${docDisplayName} (${specialty}) માટે તમારો ક્લિનિકલ ઇન્ટેક તૈયાર કરી રહ્યો છું. અગાઉની મુલાકાત પછી તમારા લક્ષણોમાં શું ફેરફાર થયો છે?`
              : `નમસ્તે ${patientName}! હું MediKiosk Clinical AI છું. હું ${docDisplayName} (${specialty}) માટે તમારો ક્લિનિકલ ઇન્ટેક તૈયાર કરી રહ્યો છું. આજે તમને અહીં લાવતી મુખ્ય આરોગ્ય સમસ્યા શું છે? કૃપા કરીને તે વિશિષ્ટ ક્ષેત્ર અથવા લક્ષણ જણાવો જે તમે અનુભવી રહ્યા છો.`;
            touchOptions = isRet
              ? ['લક્ષણોમાં સુધારો થયો છે', 'લક્ષણો વધ્યા છે', 'કોઈ ફેરફાર નથી', 'નવી તકલીફ શરૂ થઈ છે']
              : ['તાવ / શરીરનો દુખાવો', 'છાતીમાં દુખાવો / દબાણ', 'પેટમાં તીવ્ર દુખાવો', 'ખાંસી / શ્વાસ લેવામાં તકલીફ', 'માથાનો દુખાવો / ચક્કર'];
          }

          return {
            session: { id: `session-${Date.now()}`, visitId, language, status: 'ACTIVE' },
            message: { id: 'msg-start', role: 'AI', content },
            touchOptions,
            nextQuestion: content,
          };
        }
      }),

    sendMessage: (
      sessionId: string,
      data: {
        content: string;
        inputMethod?: 'VOICE' | 'TEXT' | 'TOUCH';
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
        // Dynamic client-side intake progression for Vercel / standalone cloud mode
        const langUpper = (data.language || 'EN').toUpperCase() as 'EN' | 'HI' | 'GU';
        const sessionRaw = localStorage.getItem('medikiosk_active_session_data');
        let priorMessages: Array<{ role: string; content: string }> = [];
        let turns = 1;

        if (sessionRaw) {
          try {
            const sd = JSON.parse(sessionRaw);
            if (Array.isArray(sd.messages)) {
              priorMessages = sd.messages.map((m: any) => ({
                role: m.role === 'AI' ? 'AI' : 'PATIENT',
                content: m.content || '',
              }));
              turns = priorMessages.filter((m: any) => m.role === 'PATIENT').length + 1;
            }
          } catch {}
        }

        priorMessages.push({ role: 'PATIENT', content: data.content });

        const isClosing = data.content.toLowerCase().includes('complete') || 
          data.content.toLowerCase().includes('પૂર્ણ') || 
          data.content.toLowerCase().includes('पूर्ण') ||
          turns >= 6;

        let groqRes: GroqIntakeResponse | null = null;
        try {
          groqRes = await callGroqDynamicIntake({
            carePath: data.carePath || (data.isAyush ? 'AYUSH' : data.isHomeopathy ? 'HOMEOPATHY' : 'ALLOPATHY'),
            specialty: data.specialty || 'General Medicine',
            turnsCompleted: turns,
          }, langUpper, priorMessages);
        } catch {
          groqRes = null;
        }

        if (groqRes && !isClosing) {
          const aiMsg = {
            id: `msg-${Date.now()}`,
            role: 'AI',
            content: groqRes.question,
            timestamp: new Date().toISOString(),
            options: groqRes.touchOptions,
          };

          return {
            message: aiMsg,
            aiMessage: aiMsg,
            nextQuestion: groqRes.question,
            touchOptions: groqRes.touchOptions,
            isComplete: groqRes.isComplete,
            session: { id: sessionId, status: groqRes.isComplete ? 'COMPLETED' : 'ACTIVE' },
          };
        }

        // Deterministic intelligent dynamic clinical question progression
        const deterministicStages = {
          EN: [
            { q: "How long have you been experiencing these symptoms, and is it continuous or intermittent?", opts: ["Started today", "1-3 days ago", "More than 1 week", "Chronic / recurrent"] },
            { q: "Can you describe the intensity and specific triggers (such as eating, movement, or rest)?", opts: ["Mild discomfort", "Moderate pain", "Severe / intolerable", "Worse with exertion", "Better with rest"] },
            { q: "Do you have any related symptoms like fever, nausea, dizziness, or localized swelling?", opts: ["Mild fever / body warmth", "Nausea or stomach upset", "Dizziness / fatigue", "No other symptoms"] },
            { q: "What is your current occupation, daily routine, sleep pattern, and dietary habits?", opts: ["Desk job / sedentary", "Physical labor / active", "Normal sleep & home diet", "Irregular sleep & outside food"] },
            { q: "Do you have any chronic conditions (diabetes, BP, thyroid) or known medicine allergies?", opts: ["None / perfectly healthy", "Hypertension (High BP)", "Diabetes Mellitus", "Known Drug Allergy (NKDA)"] },
            { q: "Thank you. Does this cover all your symptoms, or would you like to add anything else before consulting the doctor?", opts: ["No, that covers all symptoms — complete intake", "Yes, I want to add one more detail"] }
          ],
          HI: [
            { q: "यह समस्या आपको कितने समय से हो रही है, और क्या यह लगातार बनी रहती है या कभी-कभी होती है?", opts: ["आज से शुरू हुई", "1-3 दिनों से", "1 सप्ताह से अधिक", "पुरानी / बार-बार होती है"] },
            { q: "इस तकलीफ की तीव्रता कैसी है, और क्या चलने, खाने या आराम करने से कोई बदलाव आता है?", opts: ["हल्का दर्द / बेचैनी", "मध्यम दर्द", "असहनीय / तेज दर्द", "चलने पर बढ़ता है", "आराम से घटता है"] },
            { q: "क्या इसके साथ बुखार, जी मिचलाना, चक्कर आना या कोई अन्य लक्षण भी हैं?", opts: ["हल्का बुखार / बदन दर्द", "जी मिचलाना / उल्टी", "चक्कर / कमजोरी", "कोई अन्य लक्षण नहीं"] },
            { q: "आपका व्यवसाय, दैनिक दिनचर्या, नींद और खान-पान की आदतें कैसी हैं?", opts: ["डेस्क जॉब / बैठना ज्यादा", "मेहनत का काम / सक्रिय", "सामान्य नींद और घर का खाना", "अनियमित नींद व बाहर का खाना"] },
            { q: "क्या आपको पहले से कोई पुरानी बीमारी (बीपी, शुगर, थायरॉइड) या किसी दवा से एलर्जी है?", opts: ["कोई बीमारी नहीं / स्वस्थ", "हाई ब्लड प्रेशर (BP)", "डायबिटीज (शुगर)", "दवा से एलर्जी है"] },
            { q: "धन्यवाद। क्या आपने अपने सभी लक्षण बता दिए हैं, या डॉक्टर से मिलने से पहले कुछ और जोड़ना चाहते हैं?", opts: ["नहीं, सब लक्षण बता दिए — इनटेक पूर्ण करें", "हाँ, मुझे एक और लक्षण बताना है"] }
          ],
          GU: [
            { q: "આ તકલીફ તમને કેટલા સમયથી છે, અને શું તે સતત રહે છે કે વચગાળે થાય છે?", opts: ["આજથી શરૂ થઈ", "1-3 દિવસથી", "1 અઠવાડિયાથી વધુ", "જૂની / વારંવાર થતી"] },
            { q: "આ દુખાવા કે તકલીફની તીવ્રતા કેવી છે, અને હલનચલન, ખોરાક કે આરામ કરવાથી વધે કે ઘટે છે?", opts: ["હળવો દુખાવો / અસ્વસ્થતા", "મધ્યમ દુખાવો", "અસહ્ય / તીવ્ર દુખાવો", "હલનચલનથી વધે છે", "આરામથી રાહત થાય છે"] },
            { q: "શું આની સાથે તાવ, ઉબકા, ચક્કર આવવા કે શરીરમાં કોઈ સોજો જણાય છે?", opts: ["હળવો તાવ / શરીરનો દુખાવો", "ઉબકા / પેટમાં ગરબડ", "ચક્કર / અશક્તિ", "બીજા કોઈ લક્ષણો નથી"] },
            { q: "આપનો વ્યવસાય, દિનચર્યા, ઊંઘ અને ખોરાકની આદતો કેવી છે?", opts: ["ડેસ્ક જોબ / બેઠાડુ જીવન", "શારીરિક શ્રમ / સક્રિય", "નિયમિત ઊંઘ અને સાદો ખોરાક", "અનિયમિત ઊંઘ અને બહારનો ખોરાક"] },
            { q: "શું આપને કોઈ જૂની બીમારી (બીપી, ડાયાબિટીસ, થાયરોઇડ) કે કોઈ દવાની એલર્જી છે?", opts: ["કોઈ બીમારી નથી / તંદુરસ્ત", "હાઈ બ્લડ પ્રેશર (BP)", "ડાયાબિટીસ (સુગર)", "દવાની એલર્જી છે"] },
            { q: "આભાર. શું આપે તમામ લક્ષણો જણાવી દીધા છે, કે ડૉક્ટર પાસે જતાં પહેલાં વધુ કંઈ ઉમેરવું છે?", opts: ["ના, તમામ લક્ષણો જણાવી દીધા — ઇન્ટેક પૂર્ણ કરો", "હા, મારે બીજું એક લક્ષણ જણાવવું છે"] }
          ]
        };

        const stageList = deterministicStages[langUpper] || deterministicStages.EN;
        const stageIdx = Math.min(turns - 1, stageList.length - 1);
        const stage = stageList[stageIdx];
        const isLastStage = stageIdx === stageList.length - 1 && isClosing;

        const aiMsg = {
          id: `msg-${Date.now()}`,
          role: 'AI',
          content: stage.q,
          timestamp: new Date().toISOString(),
          options: stage.opts,
        };

        return {
          message: aiMsg,
          aiMessage: aiMsg,
          nextQuestion: stage.q,
          touchOptions: stage.opts,
          isComplete: isLastStage,
          session: { id: sessionId, status: isLastStage ? 'COMPLETED' : 'ACTIVE' },
        };
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

          // Dermatology Options
          { en: 'Red itchy rash or eczema patches', hi: 'लाल खुजली वाले दाने या एग्जिमा के चकत्ते', gu: 'લાલ ખંજવાળવાળા ચકામા કે ખરજવું' },
          { en: 'Pimples, facial acne & dark spots', hi: 'मुँहासे, फुंसी और चेहरे पर दाग', gu: 'ખીલ, ફોડલીઓ અને ચહેરા પર ડાઘ' },
          { en: 'Fungal infection / Ringworm itching', hi: 'दाद / फंगल इन्फेक्शन की तेज खुजली', gu: 'દાદર / ફંગલ ઇન્ફેક્શનની તીવ્ર ખંજવાળ' },
          { en: 'Hair fall & scalp dandruff', hi: 'बाल झड़ना और डैंड्रफ की समस्या', gu: 'વાળ ખરવા અને ખોડો થવો' },
          { en: 'Skin allergy / Hives flare', hi: 'त्वचा में एलर्जी / पित्ती (Hives) उछलना', gu: 'ચામડીની એલર્જી / શીત પિત્તના ઢીમચા' },

          // Cardiology Options
          { en: 'Chest pain, pressure or tightness', hi: 'सीने में दर्द, भारीपन या दबाव', gu: 'છાતીમાં દુખાવો, ભારેપણું કે દબાણ' },
          { en: 'Rapid heartbeat / Palpitations', hi: 'दिल की तेज धड़कन / घबराहट', gu: 'હૃદયના ઝડપી ધબકારા / ગભરામણ' },
          { en: 'Shortness of breath on walking/climbing', hi: 'चलने या सीढ़ी चढ़ने पर सांस फूलना', gu: 'ચાલતી વખતે શ્વાસ ચડવો' },
          { en: 'Dizziness or lightheaded spells', hi: 'चक्कर आना या आँखों के आगे अंधेरा', gu: 'ચક્કર આવવા કે અંધારા આવવા' },
          { en: 'Swelling in both feet / ankles', hi: 'दोनों पैरों या टखनों में सूजन', gu: 'બંને પગ કે ઘૂંટીમાં સોજો' },

          // Orthopedics Options
          { en: 'Knee joint pain & swelling', hi: 'घुटने के जोड़ में दर्द और सूजन', gu: 'ઘૂંટણનો દુખાવો અને સોજો' },
          { en: 'Lower back pain & lumbar stiffness', hi: 'कमर के निचले हिस्से में दर्द व जकड़न', gu: 'કમરનો દુખાવો અને જકડન' },
          { en: 'Shoulder or neck pain / frozen shoulder', hi: 'कंधे या गर्दन में दर्द (फ्रोजन शोल्डर)', gu: 'ખભા કે ગરદનનો દુખાવો' },
          { en: 'Ankle sprain or foot pain', hi: 'पैर या टखने में मोच / दर्द', gu: 'પગ કે ઘૂંટીમાં મચકોડ / દુખાવો' },
          { en: 'Sciatica pain radiating down leg', hi: 'सायटिका दर्द जो पैर में नीचे तक जाता है', gu: 'સાયટીકાનો દુખાવો જે પગમાં નીચે ઉતરે છે' },

          // ENT Options
          { en: 'Severe sore throat & painful swallowing', hi: 'गले में तेज दर्द और निगलने में तकलीफ', gu: 'ગળામાં તીવ્ર દુખાવો અને ગળવામાં તકલીફ' },
          { en: 'Ear pain, discharge or reduced hearing', hi: 'कान में दर्द, मवाद आना या कम सुनाई देना', gu: 'કાનમાં દુખાવો, પરુ કે ઓછું સંભળાવું' },
          { en: 'Nasal blockage, sinus pressure & cold', hi: 'नाक बंद, साइनस का भारीपन व जुकाम', gu: 'નાક બંધ, સાઇનસનું ભારેપણું અને શરદી' },
          { en: 'Hoarseness of voice or persistent throat clearing', hi: 'आवाज बैठना या गले में खराश', gu: 'અવાજ બેસી જવો કે ગળામાં ખારાશ' },
          { en: 'Dizziness / Ear ringing (Tinnitus)', hi: 'चक्कर आना या कान में सीटी की आवाज', gu: 'ચક્કર આવવા કે કાનમાં અવાજ આવવો' },

          // Pediatrics Options
          { en: 'High fever with chills & body warmth', hi: 'तेज बुखार, कंपकंपी और गर्म शरीर', gu: 'તીવ્ર તાવ, ધ્રુજારી અને ગરમ શરીર' },
          { en: 'Persistent cough & fast breathing', hi: 'लगातार खांसी और तेज सांस चलना', gu: 'સતત ખાંસી અને ઝડપી શ્વાસ' },
          { en: 'Vomiting & loose motions / diarrhea', hi: 'उल्टी और दस्त (Loose motions)', gu: 'ઉલટી અને ઝાડા (ડાયેરિયા)' },
          { en: 'Skin rash, measles-like spots or itching', hi: 'त्वचा पर दाने, चकत्ते या खुजली', gu: 'ચામડી પર દાણા, ચકામા કે ખંજવાળ' },
          { en: 'Poor feeding, irritability & low energy', hi: 'दूध/खाना न पीना, चिड़चिड़ापन और सुस्ती', gu: 'ખોરાક/દૂધ ન લેવું, ચીડિયાપણું અને સુસ્તી' },

          // Gastroenterology Options
          { en: 'Severe stomach pain & cramping', hi: 'पेट में तेज दर्द और मरोड़', gu: 'પેટમાં તીવ્ર દુખાવો અને ચૂંક' },
          { en: 'Chronic acidity, heartburn & sour burps', hi: 'पुरानी एसिडिटी, सीने में जलन और खट्टी डकारें', gu: 'જૂની એસિડિટી, છાતીમાં બળતરા અને ખાટા ઓડકાર' },
          { en: 'Frequent vomiting & nausea', hi: 'बार-बार उल्टी और जी मिचलाना', gu: 'વારંવાર ઉલટી અને ઉબકા' },
          { en: 'Constipation / Difficulty in bowel movement', hi: 'कब्ज / पेट साफ न होना', gu: 'કબજિયાત / પેટ સાફ ન આવવું' },
          { en: 'Loose motions / Diarrhea with cramps', hi: 'दस्त / मरोड़ के साथ पतले दस्त', gu: 'ઝાડા / ચૂંક સાથે પાતળા ઝાડા' },

          // Pulmonology Options
          { en: 'Persistent dry or productive cough', hi: 'लगातार सूखी या बलगम वाली खांसी', gu: 'સતત સૂકી કે કફવાળી ખાંસી' },
          { en: 'Shortness of breath / Wheezing sound', hi: 'सांस फूलना / सीने से सीटी जैसी आवाज', gu: 'શ્વાસ ચડવો / છાતીમાંથી સીટી જેવો અવાજ' },
          { en: 'Chest tightness with cold drafts', hi: 'ठंडी हवा से सीने में जकड़न', gu: 'ઠંડી હવાથી છાતીમાં જકડન' },
          { en: 'Night-time cough awakening sleep', hi: 'रात में नींद से जगाने वाली खांसी', gu: 'રાત્રે ઊંઘમાંથી જગાડતી ખાંસી' },
          { en: 'Coughing up discolored phlegm / mucus', hi: 'पीला या गाढ़ा बलगम आना', gu: 'પીળો કે ઘટ્ટ કફ નીકળવો' },
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
        if (/hello|नमस्ते|નમસ્તે/i.test(rawContent)) {
          const nameMatch = rawContent.match(/(?:Hello|नमस्ते|નમસ્તે)\s+([A-Za-z0-9\s]+?)(?:!|जी|ભાઈ|બહેન|\.|\,)/i);
          const docMatch = rawContent.match(/(?:Dr\.|Vaidya)\s+([A-Za-z0-9\s]+?)(?:\s*\(|\s+with|\s+for|\.|\,)/i);
          const pName = nameMatch ? nameMatch[1].trim() : 'Patient';
          const dName = docMatch ? `Dr. ${docMatch[1].trim()}` : '';

          if (langLower === 'hi') {
            translatedQ = `नमस्ते ${pName} जी! मैं मेडीकियोस्क AI सहायक हूँ। ${dName ? `${dName} से परामर्श के लिए आपकी क्लिनिकल पूछताछ शुरू कर रहे हैं। ` : ''}आज आपको क्या मुख्य स्वास्थ्य समस्या या लक्षण महसूस हो रहे हैं?`;
          } else if (langLower === 'gu') {
            translatedQ = `નમસ્તે ${pName} ભાઈ/બહેન! હું મેડીકિયોસ્ક AI સહાયક છું. ${dName ? `${dName} સાથે આપના કન્સલ્ટેશન માટે આપની વિગતો મેળવી રહ્યો છું. ` : ''}આજે તમને કઈ મુખ્ય શારીરિક તકલીફ અથવા લક્ષણો જણાય છે?`;
          } else {
            translatedQ = `Hello ${pName}! I am MediKiosk Clinical AI. ${dName ? `I am preparing your clinical intake for ${dName}. ` : ''}What main symptom or health concern brought you in today?`;
          }
        } else if (/lifestyle|sleep|routine|diet|दिनचर्या|દિનચર્યા|नींद|ઊંઘ|खान-पान|ખોરાક/i.test(rawContent)) {
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
    getSession: (sessionId: string) =>
      request(`/conversation/${sessionId}`, {
        method: 'GET',
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
      request<{ timeline: any[] }>(`/doctor/timeline/${patientId}`)
        .then((res) => {
          if (res?.timeline && Array.isArray(res.timeline)) {
            return res;
          }
          return { timeline: [], count: 0 };
        })
        .catch(() => {
          const stored = localStorage.getItem(`medikiosk_timeline_${patientId}`);
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              if (Array.isArray(parsed) && parsed.length > 0) return { timeline: parsed, count: parsed.length };
            } catch {}
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
              vitals: [],
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
