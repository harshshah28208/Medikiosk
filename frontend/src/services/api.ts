const rawApiBase =
  import.meta.env.VITE_API_BASE ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? `${window.location.origin}/api`
    : 'http://localhost:5000/api');
// Clean up any accidental double slashes or trailing slashes
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
}

export function getCurrentUser(): any | null {
  const userStr = localStorage.getItem('medikiosk_user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
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
        return {
          session: { id: `session-${Date.now()}`, visitId, language, status: 'ACTIVE' },
          message: {
            id: 'msg-start',
            role: 'AI',
            content: isRet
              ? `Welcome back${patientName}. Since your last visit, how have your symptoms been? Have they improved, worsened, or stayed the same?`
              : `Welcome to MediKiosk${patientName}. What main symptom or health concern brought you in today?`,
          },
          touchOptions: isRet
            ? ['My symptoms have improved', 'My symptoms have worsened', 'There is no change', 'I have a new problem']
            : ['Fever / Body Ache', 'Chest Pain / Pressure', 'Severe Abdominal Pain', 'Cough / Breathlessness', 'Headache / Dizziness'],
        };
      }),
    sendMessage: (sessionId: string, data: { content: string; inputMethod?: string; language?: string; rawTranscript?: string; isAyush?: boolean }) =>
      request(`/conversation/${sessionId}/message`, {
        method: 'POST',
        body: JSON.stringify(data),
      }).catch(() => {
        const text = data.content.toLowerCase();
        const isClosing = /covers all symptoms|proceed|complete intake|no further|14 years old|taking them daily/i.test(text);
        return {
          aiMessage: { id: `msg-${Date.now()}`, role: 'AI', content: isClosing ? 'Thank you. Your clinical intake details are complete. Would you like to proceed with your appointment now?' : 'Thank you. Could you share how long you have had this, and if you take any daily medications?' },
          nextQuestion: isClosing ? 'Thank you. Your clinical intake details are complete. Would you like to proceed with your appointment now?' : 'Thank you. Could you share how long you have had this, and if you take any daily medications?',
          touchOptions: isClosing ? ['Proceed with Appointment', 'Add One More Detail'] : ['Started today', '1-3 days ago', 'More than a week ago', 'No medications taken'],
          isComplete: isClosing,
        };
      }),
    switchLanguage: (sessionId: string, targetLanguage: string, messages: any[] = []) =>
      request(`/conversation/${sessionId}/switch-language`, {
        method: 'POST',
        body: JSON.stringify({ targetLanguage, messages }),
      }).catch(() => ({ language: targetLanguage, translatedMessages: messages })),
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
