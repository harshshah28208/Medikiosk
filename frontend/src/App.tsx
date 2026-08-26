import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './store/AuthContext';
import { LanguageProvider } from './store/LanguageContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { RoleRedirect } from './pages/RoleRedirect';

// Shells
import { KioskShell } from './components/layout/KioskShell';
import { StaffShell } from './components/layout/StaffShell';

// Patient Pages
import { WelcomePage } from './features/patient/pages/WelcomePage';
import { LanguagePage } from './features/patient/pages/LanguagePage';
import { IdentificationPage } from './features/patient/pages/IdentificationPage';
import { RegistrationPage } from './features/patient/pages/RegistrationPage';
import { ConsentPage } from './features/patient/pages/ConsentPage';
import { TokenPage } from './features/patient/pages/TokenPage';
import { IntakePage } from './features/patient/pages/IntakePage';
import { DocumentUploadPage } from './features/patient/pages/DocumentUploadPage';
import { PatientReviewPage } from './features/patient/pages/PatientReviewPage';
import { PatientPortalPage } from './features/patient/pages/PatientPortalPage';

// Clinical Workspaces
import { DoctorDashboard } from './features/doctor/pages/DoctorDashboard';
import { NurseDashboard } from './features/nurse/pages/NurseDashboard';
import { TriageDashboard } from './features/triage/pages/TriageDashboard';
import { AYUSHDashboard } from './features/ayush/pages/AYUSHDashboard';
import { AdminDashboard } from './features/admin/pages/AdminDashboard';
import { PlaceholderPage } from './components/ui/PlaceholderPage';

export function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <BrowserRouter>
          <Routes>
            {/* Public / Auth */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<RoleRedirect />} />

            {/* Patient / Kiosk Flow */}
            <Route element={<ProtectedRoute roles={['PATIENT']} />}>
              <Route path="/kiosk" element={<KioskShell />}>
                <Route index element={<WelcomePage />} />
                <Route path="language" element={<LanguagePage />} />
                <Route path="identify" element={<IdentificationPage />} />
                <Route path="register" element={<RegistrationPage />} />
                <Route path="consent" element={<ConsentPage />} />
                <Route path="token/:visitId" element={<TokenPage />} />
                <Route path="intake/:visitId" element={<IntakePage />} />
                <Route path="documents/:visitId" element={<DocumentUploadPage />} />
                <Route path="review/:visitId" element={<PatientReviewPage />} />
                <Route path="portal" element={<PatientPortalPage />} />
              </Route>
            </Route>

            {/* Reception Flow */}
            <Route element={<ProtectedRoute roles={['RECEPTION', 'HOSPITAL_ADMIN']} />}>
              <Route path="/reception" element={<StaffShell />}>
                <Route index element={<DoctorDashboard />} />
                <Route path="patients" element={<DoctorDashboard />} />
                <Route path="register" element={<RegistrationPage />} />
                <Route path="queue" element={<DoctorDashboard />} />
              </Route>
            </Route>

            {/* Triage Flow */}
            <Route element={<ProtectedRoute roles={['TRIAGE_STAFF', 'DOCTOR', 'HOSPITAL_ADMIN']} />}>
              <Route path="/triage" element={<StaffShell />}>
                <Route index element={<TriageDashboard />} />
                <Route path="alerts" element={<TriageDashboard />} />
              </Route>
            </Route>

            {/* Nurse Flow */}
            <Route element={<ProtectedRoute roles={['NURSE', 'DOCTOR', 'HOSPITAL_ADMIN']} />}>
              <Route path="/nurse" element={<StaffShell />}>
                <Route index element={<NurseDashboard />} />
              </Route>
            </Route>

            {/* Doctor Flow */}
            <Route element={<ProtectedRoute roles={['DOCTOR', 'SPECIALIST_DOCTOR', 'HOSPITAL_ADMIN']} />}>
              <Route path="/doctor" element={<StaffShell />}>
                <Route index element={<DoctorDashboard />} />
                <Route path="patient/:visitId" element={<DoctorDashboard />} />
              </Route>
            </Route>

            {/* AYUSH Doctor Flow */}
            <Route element={<ProtectedRoute roles={['AYUSH_DOCTOR', 'HOSPITAL_ADMIN']} />}>
              <Route path="/ayush" element={<StaffShell />}>
                <Route index element={<AYUSHDashboard />} />
                <Route path="patient/:visitId" element={<AYUSHDashboard />} />
              </Route>
            </Route>

            {/* Admin Flow */}
            <Route element={<ProtectedRoute roles={['HOSPITAL_ADMIN', 'SUPER_ADMIN']} />}>
              <Route path="/admin" element={<StaffShell />}>
                <Route index element={<AdminDashboard />} />
                <Route path="patients" element={<AdminDashboard />} />
                <Route path="staff" element={<AdminDashboard />} />
                <Route path="analytics" element={<AdminDashboard />} />
                <Route path="audit" element={<AdminDashboard />} />
                <Route path="settings" element={<AdminDashboard />} />
              </Route>
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </LanguageProvider>
    </AuthProvider>
  );
}

export default App;
