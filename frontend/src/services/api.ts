const rawApiBase = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';
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

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
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

export const api = {
  health: () => request('/health'),

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
    me: () => request('/auth/me'),
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
      }),
    lookup: (query: string, type: string = 'PHONE') =>
      request('/patients/lookup', {
        method: 'POST',
        body: JSON.stringify({ query, type }),
      }),
    get: (id: string) => request(`/patients/${id}`),
    me: () => request('/patients/me'),
  },

  visits: {
    get: (id: string) => request(`/visits/${id}`),
    list: (filters?: Record<string, string>) => {
      const params = new URLSearchParams(filters || {});
      return request(`/visits?${params}`);
    },
    updateStatus: (id: string, status: string, doctorId?: string) =>
      request(`/visits/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, doctorId }),
      }),
  },

  queue: {
    list: (filters?: Record<string, string>) => {
      const params = new URLSearchParams(filters || {});
      return request(`/queue?${params}`);
    },
    update: (id: string, data: any) =>
      request(`/queue/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },

  consent: {
    grant: (data: any) =>
      request('/consent', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getForPatient: (patientId: string) =>
      request(`/consent/${patientId}`),
  },

  conversation: {
    start: (visitId: string, language: string = 'EN', isAyush = false) =>
      request('/conversation/start', {
        method: 'POST',
        body: JSON.stringify({ visitId, language, isAyush }),
      }),
    sendMessage: (sessionId: string, data: { content: string; inputMethod?: string; language?: string; rawTranscript?: string; isAyush?: boolean }) =>
      request(`/conversation/${sessionId}/message`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    switchLanguage: (sessionId: string, targetLanguage: string, messages: any[] = []) =>
      request(`/conversation/${sessionId}/switch-language`, {
        method: 'POST',
        body: JSON.stringify({ targetLanguage, messages }),
      }),
    complete: (sessionId: string) =>
      request(`/conversation/${sessionId}/complete`, {
        method: 'POST',
      }),
  },

  admin: {
    dashboard: () => request('/admin/dashboard'),
    auditLogs: (page: number = 1, limit: number = 50) =>
      request(`/admin/audit-logs?page=${page}&limit=${limit}`),
    users: () => request('/admin/users'),
    departments: () => request('/admin/departments'),
  },
};

export default api;
