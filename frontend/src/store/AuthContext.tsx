import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, setAuthSession, clearAuthSession, getStoredUser } from '../services/api';
import { DEMO_USERS } from '../services/demoFallbackData';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  phone?: string;
  patient?: any;
  doctorProfile?: any;
  nurseProfile?: any;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  demoLogin: (role: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Restore session on mount
  useEffect(() => {
    const stored = getStoredUser();
    if (stored) {
      setUser(stored);
      // Verify token is still valid
      api.auth.me()
        .then((res) => setUser(res.user))
        .catch(() => {
          // Keep local fallback session if backend is offline on Vercel
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const res = await api.auth.login(email, password);
      setAuthSession(res.token, res.user);
      if (res.user?.patient) {
        localStorage.setItem('medikiosk_active_patient', JSON.stringify(res.user.patient));
        if (res.user.patient.visits?.[0]) {
          localStorage.setItem('medikiosk_active_visit', JSON.stringify(res.user.patient.visits[0]));
          if (res.user.patient.visits[0].queueEntry) {
            localStorage.setItem('medikiosk_active_queue', JSON.stringify(res.user.patient.visits[0].queueEntry));
          }
        }
      }
      setUser(res.user);
    } catch (err: any) {
      // Instant standalone fallback for Vercel deployment & registered local users
      const cleanEmail = email.trim().toLowerCase();
      const localUsers = JSON.parse(localStorage.getItem('medikiosk_registered_users') || '[]');
      const registeredUser = localUsers.find((u: any) => u.email?.toLowerCase() === cleanEmail);

      const fallbackUser = registeredUser || DEMO_USERS[cleanEmail] || Object.values(DEMO_USERS).find((u: any) => u.email?.toLowerCase() === cleanEmail);
      if (fallbackUser) {
        const dummyToken = `demo-token-${Date.now()}`;
        const userWithRole = { ...fallbackUser };

        if (userWithRole.role === 'PATIENT' || fallbackUser.patient) {
          const patientObj = fallbackUser.patient || {
            id: fallbackUser.id || `pat-${Date.now()}`,
            mrn: fallbackUser.mrn || `MK-${Math.floor(1000 + Math.random() * 9000)}`,
            name: fallbackUser.name || 'Patient',
            age: fallbackUser.age || 28,
            gender: fallbackUser.gender || 'MALE',
            phone: fallbackUser.phone || '9876543210',
            bloodGroup: fallbackUser.bloodGroup || 'B+',
            abhaId: fallbackUser.abhaId || '91-8822-1923-0019',
          };
          userWithRole.patient = patientObj;
          localStorage.setItem('medikiosk_active_patient', JSON.stringify(patientObj));

          // Ensure in registered patients list for doctor queue
          const regPatients = JSON.parse(localStorage.getItem('medikiosk_registered_patients') || '[]');
          if (!regPatients.some((p: any) => p.id === patientObj.id || p.mrn === patientObj.mrn)) {
            regPatients.unshift(patientObj);
            localStorage.setItem('medikiosk_registered_patients', JSON.stringify(regPatients));
          }

          if (fallbackUser.patient?.visits?.[0]) {
            localStorage.setItem('medikiosk_active_visit', JSON.stringify(fallbackUser.patient.visits[0]));
          } else {
            const activeV = {
              id: `vis-${Date.now()}`,
              patientId: patientObj.id,
              token: 'P-101',
              status: 'READY_FOR_DOCTOR',
              createdAt: new Date().toISOString(),
              department: { name: 'General Medicine', code: 'GEN' },
              doctor: { user: { name: 'Dr. Yogesh Sharma' }, specialization: 'General Medicine' },
              patient: patientObj,
              reasonForVisit: 'General OPD Consultation',
              vitals: [{ bpSystolic: 120, bpDiastolic: 80, pulse: 76, spo2: 99, recordedAt: new Date().toISOString() }],
              summary: {
                chiefComplaint: 'General OPD Consultation',
                historyOfPresentIllness: 'Logged in patient ready for consultation.',
                lifestyle: 'Regular daily habits.',
              }
            };
            localStorage.setItem('medikiosk_active_visit', JSON.stringify(activeV));
          }
        }

        setAuthSession(dummyToken, userWithRole);
        setUser(userWithRole);
        return;
      }
      setError(err.message || 'Invalid email or password');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (data: any) => {
    setError(null);
    setIsLoading(true);
    try {
      const res = await api.auth.register(data);
      setAuthSession(res.token, res.user);
      if (res.user?.patient) {
        localStorage.setItem('medikiosk_active_patient', JSON.stringify(res.user.patient));
      }
      setUser(res.user);
    } catch (err: any) {
      // Standalone registration fallback
      const newId = `user-${Date.now()}`;
      const dummyUser: any = {
        id: newId,
        email: data.email || 'user@medikiosk.com',
        name: data.name || 'MediKiosk User',
        role: data.role || 'PATIENT',
        phone: data.phone || '9876543210',
        age: data.age || 28,
        gender: data.gender || 'MALE',
        abhaId: data.abhaId || '91-8822-1923-0019',
      };

      if (dummyUser.role === 'PATIENT') {
        const patientObj = {
          id: `pat-${newId}`,
          mrn: `MK-${Math.floor(1000 + Math.random() * 9000)}`,
          name: dummyUser.name,
          age: dummyUser.age,
          gender: dummyUser.gender,
          phone: dummyUser.phone,
          bloodGroup: data.bloodGroup || 'B+',
          abhaId: dummyUser.abhaId,
        };
        dummyUser.patient = patientObj;
        localStorage.setItem('medikiosk_active_patient', JSON.stringify(patientObj));

        // Add to registered patients for Doctor Dashboard queue
        const regPats = JSON.parse(localStorage.getItem('medikiosk_registered_patients') || '[]');
        regPats.unshift(patientObj);
        localStorage.setItem('medikiosk_registered_patients', JSON.stringify(regPats));

        const activeV = {
          id: `vis-${Date.now()}`,
          patientId: patientObj.id,
          token: 'P-101',
          status: 'READY_FOR_DOCTOR',
          createdAt: new Date().toISOString(),
          department: { name: 'General Medicine', code: 'GEN' },
          doctor: { user: { name: 'Dr. Yogesh Sharma' }, specialization: 'General Medicine' },
          patient: patientObj,
          reasonForVisit: 'General OPD Consultation',
          vitals: [{ bpSystolic: 120, bpDiastolic: 80, pulse: 76, spo2: 99, recordedAt: new Date().toISOString() }],
          summary: {
            chiefComplaint: 'General OPD Consultation',
            historyOfPresentIllness: 'Registered new patient.',
            lifestyle: 'Baseline recorded.',
          }
        };
        localStorage.setItem('medikiosk_active_visit', JSON.stringify(activeV));
      }

      // Store in registered users list
      const localUsers = JSON.parse(localStorage.getItem('medikiosk_registered_users') || '[]');
      localUsers.push(dummyUser);
      localStorage.setItem('medikiosk_registered_users', JSON.stringify(localUsers));

      setAuthSession(`demo-token-${Date.now()}`, dummyUser);
      setUser(dummyUser);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const demoLogin = useCallback(async (role: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const res = await api.auth.demoLogin(role);
      setAuthSession(res.token, res.user);
      if (res.user?.patient) {
        localStorage.setItem('medikiosk_active_patient', JSON.stringify(res.user.patient));
        if (res.user.patient.visits?.[0]) {
          localStorage.setItem('medikiosk_active_visit', JSON.stringify(res.user.patient.visits[0]));
        }
      }
      setUser(res.user);
    } catch (err: any) {
      // Instant standalone fallback matching the selected role
      const fallbackUser = Object.values(DEMO_USERS).find((u: any) => u.role === role) || DEMO_USERS['patient@demo.com'];
      const dummyToken = `demo-token-${Date.now()}`;
      setAuthSession(dummyToken, fallbackUser);
      if (fallbackUser.patient) {
        localStorage.setItem('medikiosk_active_patient', JSON.stringify(fallbackUser.patient));
        if (fallbackUser.patient.visits?.[0]) {
          localStorage.setItem('medikiosk_active_visit', JSON.stringify(fallbackUser.patient.visits[0]));
        }
      }
      setUser(fallbackUser);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    clearAuthSession();
    setUser(null);
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      error,
      login,
      register,
      demoLogin,
      logout,
      clearError,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
