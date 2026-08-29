import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import {
  Hospital, User, Shield, Stethoscope, Heart, Leaf,
  UserCog, Activity, ClipboardList, LogIn, UserPlus, AlertCircle, Sparkles,
  Key, Award, Clock, MapPin, Phone, Mail, Lock, Droplets
} from 'lucide-react';

const ROLES = [
  { role: 'DOCTOR', label: 'Doctor / Specialist', icon: Stethoscope, color: 'bg-indigo-600', description: 'OPD physician, prescriptions & diagnosis' },
  { role: 'NURSE', label: 'Nurse / Triage', icon: Activity, color: 'bg-green-600', description: 'Vitals recording, triage & nursing desk' },
  { role: 'AYUSH_DOCTOR', label: 'AYUSH / Ayurvedic', icon: Leaf, color: 'bg-amber-600', description: 'Prakriti analysis & Ayurvedic care' },
  { role: 'AYUSH_DOCTOR', label: 'Homeopathic Doctor', icon: Droplets, color: 'bg-teal-600', description: 'Miasm analysis, constitutional remedy & repertory', path: '/homeopathic' },
  { role: 'PATIENT', label: 'Patient Portal', icon: User, color: 'bg-blue-600', description: 'Health timeline, tokens & appointment records' },
  { role: 'HOSPITAL_ADMIN', label: 'Hospital Admin', icon: UserCog, color: 'bg-purple-600', description: 'Analytics, security audit & staff roles' },
];


import api from '../services/api';

export function LoginPage() {
  const { demoLogin, login, register, error, isLoading, clearError } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'LOGIN' | 'REGISTER' | 'DEMO'>('LOGIN');

  // Selected Role for Registration
  const [selectedRole, setSelectedRole] = useState('DOCTOR');

  // Common form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  // Doctor / Specialist Specific Fields
  const [specialization, setSpecialization] = useState('General Medicine');
  const [qualifications, setQualifications] = useState('MBBS, MD');
  const [licenseNumber, setLicenseNumber] = useState('');

  // Nurse Specific Fields
  const [shiftTiming, setShiftTiming] = useState('Morning (8 AM - 4 PM)');
  const [nursingWard, setNursingWard] = useState('OPD Triage Station');
  const [doctorsList, setDoctorsList] = useState<any[]>([]);
  const [assignedDoctorId, setAssignedDoctorId] = useState('');

  // Patient Specific Fields
  const [age, setAge] = useState('30');
  const [gender, setGender] = useState('MALE');
  const [abhaId, setAbhaId] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');

  // Admin Specific Fields
  const [adminSecretKey, setAdminSecretKey] = useState('');

  React.useEffect(() => {
    api.doctor
      .roster()
      .then((res: any) => {
        if (res?.doctors?.length > 0) {
          setDoctorsList(res.doctors);
          setAssignedDoctorId(res.doctors[0].id);
        }
      })
      .catch(() => {});
  }, []);

  const getTargetWorkspace = (role: string, spec?: string) => {
    switch (role) {
      case 'PATIENT':
        return '/kiosk';
      case 'DOCTOR':
      case 'SPECIALIST_DOCTOR':
        return '/doctor';
      case 'AYUSH_DOCTOR':
        return spec?.toLowerCase().includes('homeopath') ? '/homeopathic' : '/ayush';
      case 'NURSE':
        return '/nurse';
      case 'TRIAGE_STAFF':
        return '/triage';
      case 'RECEPTION':
        return '/reception';
      case 'HOSPITAL_ADMIN':
      case 'SUPER_ADMIN':
        return '/admin';
      default:
        return '/kiosk';
    }
  };

  const handleDemoLogin = async (role: string, path: string) => {
    try {
      await demoLogin(role);
      navigate(path, { replace: true });
    } catch {
      // Handled by context
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      const userStr = localStorage.getItem('medikiosk_user');
      const userObj = userStr ? JSON.parse(userStr) : null;
      const target = getTargetWorkspace(userObj?.role || 'PATIENT', userObj?.specialization);
      navigate(target, { replace: true });
    } catch {
      // Handled by context
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        name: name.trim(),
        email: email.trim(),
        password,
        role: selectedRole,
        phone: phone.trim() || undefined,
      };

      if (selectedRole === 'DOCTOR' || selectedRole === 'AYUSH_DOCTOR') {
        payload.specialization = specialization;
        payload.qualifications = qualifications;
        payload.licenseNumber = licenseNumber;
      } else if (selectedRole === 'NURSE') {
        payload.shiftTiming = shiftTiming;
        payload.specialization = nursingWard;
        payload.assignedDoctorId = assignedDoctorId || undefined;
      } else if (selectedRole === 'PATIENT') {
        payload.age = age ? parseInt(age, 10) : 30;
        payload.gender = gender;
        payload.abhaId = abhaId.trim() || undefined;
        payload.emergencyContact = emergencyContact.trim() || undefined;
      } else if (selectedRole === 'HOSPITAL_ADMIN') {
        payload.adminSecretKey = adminSecretKey;
      }

      await register(payload);
      const userStr = localStorage.getItem('medikiosk_user');
      const userObj = userStr ? JSON.parse(userStr) : null;
      const target = getTargetWorkspace(userObj?.role || selectedRole, specialization);
      navigate(target, { replace: true });
    } catch {
      // Handled by context
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-4xl">
        
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/30">
              <Hospital className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              MediKiosk <span className="text-blue-500 text-2xl font-mono">v2.0</span>
            </h1>
          </div>
          <p className="text-slate-400 text-sm sm:text-base">
            Autonomous Multilingual Clinical Intake & Hospital Command Center
          </p>
        </div>

        {/* Global Error Alert */}
        {error && (
          <div className="mb-6 bg-red-950/80 border border-red-500/50 rounded-2xl p-4 text-red-200 text-sm text-center flex items-center justify-center gap-3 shadow-lg">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <span>{error}</span>
            <button onClick={clearError} className="underline text-xs text-red-300 ml-2">Dismiss</button>
          </div>
        )}

        {/* Main Mode Toggle Buttons */}
        <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 max-w-md mx-auto mb-8 shadow-md">
          <button
            onClick={() => { setMode('LOGIN'); clearError(); }}
            className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
              mode === 'LOGIN' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>Email Sign In</span>
          </button>

          <button
            onClick={() => { setMode('REGISTER'); clearError(); }}
            className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
              mode === 'REGISTER' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>New Registration</span>
          </button>

          <button
            onClick={() => { setMode('DEMO'); clearError(); }}
            className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
              mode === 'DEMO' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>1-Click Demo</span>
          </button>
        </div>

        {/* ========================================================= */}
        {/* VIEW 1: EMAIL & PASSWORD LOGIN                            */}
        {/* ========================================================= */}
        {mode === 'LOGIN' && (
          <div className="max-w-md mx-auto bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-bold text-white mb-1">Sign In to Your Workspace</h2>
              <p className="text-xs text-slate-400">Doctor, Nurse, Admin, or Patient Portal</p>
            </div>

            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="doctor@hospital.org"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 touch-target"
              >
                <LogIn className="w-5 h-5" />
                <span>{isLoading ? 'Signing In...' : 'Sign In'}</span>
              </button>
            </form>
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 2: ROLE-SPECIFIC CUSTOM REGISTRATION                 */}
        {/* ========================================================= */}
        {mode === 'REGISTER' && (
          <div className="max-w-2xl mx-auto bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            
            <div className="text-center">
              <h2 className="text-xl font-bold text-white mb-1">Create Account — Select Your Role</h2>
              <p className="text-xs text-slate-400">Registration fields adapt specifically to your clinical profession</p>
            </div>

            {/* Role Select Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {ROLES.map(({ role, label, icon: Icon, color }) => (
                <button
                  type="button"
                  key={role}
                  onClick={() => setSelectedRole(role)}
                  className={`
                    p-3 rounded-2xl border text-center flex flex-col items-center gap-1.5 transition-all
                    ${selectedRole === role
                      ? 'bg-blue-600/20 border-blue-500 text-white shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }
                  `}
                >
                  <div className={`w-8 h-8 ${color} rounded-xl flex items-center justify-center text-white shadow-sm`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] font-bold leading-tight">{label}</span>
                </button>
              ))}
            </div>

            {/* Tailored Form */}
            <form onSubmit={handleRegister} className="space-y-4 pt-2 border-t border-slate-800">
              
              {/* Common Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    {selectedRole === 'PATIENT' ? 'Full Patient Name' : 'Full Professional Name'}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder={selectedRole === 'PATIENT' ? 'Rahul Sharma' : 'Dr. Alok Verma'}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="9876543210"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Work / Official Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="user@hospital.org"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="At least 6 characters"
                    minLength={6}
                    required
                  />
                </div>
              </div>

              {/* ──────────────────────────────────────────────── */}
              {/* SPECIFIC FIELDS: DOCTOR & AYUSH DOCTOR           */}
              {/* ──────────────────────────────────────────────── */}
              {(selectedRole === 'DOCTOR' || selectedRole === 'AYUSH_DOCTOR') && (
                <div className="p-4 bg-indigo-950/20 border border-indigo-500/30 rounded-2xl space-y-4 animate-fade-in">
                  <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider">
                    <Stethoscope className="w-4 h-4" />
                    <span>Clinical Physician Credentials</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Specialization / Department</label>
                      <input
                        type="text"
                        value={specialization}
                        onChange={(e) => setSpecialization(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
                        placeholder="General Medicine / Cardiology"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Medical Qualifications</label>
                      <input
                        type="text"
                        value={qualifications}
                        onChange={(e) => setQualifications(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
                        placeholder="MBBS, MD, DNB"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Medical Council License # (NMC / State Board)</label>
                    <input
                      type="text"
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm font-mono"
                      placeholder="MCI-2024-88991"
                    />
                  </div>
                </div>
              )}

              {/* ──────────────────────────────────────────────── */}
              {/* SPECIFIC FIELDS: NURSE / TRIAGE                  */}
              {/* ──────────────────────────────────────────────── */}
              {selectedRole === 'NURSE' && (
                <div className="p-4 bg-green-950/20 border border-green-500/30 rounded-2xl space-y-4 animate-fade-in">
                  <div className="flex items-center gap-2 text-green-300 text-xs font-bold uppercase tracking-wider">
                    <Activity className="w-4 h-4" />
                    <span>Nursing Desk &amp; Doctor Assignment</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Assigned Doctor (Doctor You Work With / Assist) <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={assignedDoctorId}
                      onChange={(e) => setAssignedDoctorId(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500"
                    >
                      {doctorsList.map((doc) => (
                        <option key={doc.id} value={doc.id}>
                          {doc.name} — {doc.specialization} ({doc.roomNumber})
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Your nurse station will automatically sync with this doctor&apos;s assigned patient queue and OPD room.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Assigned Triage Ward / Station</label>
                      <input
                        type="text"
                        value={nursingWard}
                        onChange={(e) => setNursingWard(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
                        placeholder="OPD Triage / Doctor Room Station"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Shift Timing</label>
                      <select
                        value={shiftTiming}
                        onChange={(e) => setShiftTiming(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
                      >
                        <option value="Morning (8 AM - 4 PM)">Morning (8 AM - 4 PM)</option>
                        <option value="Evening (4 PM - 12 AM)">Evening (4 PM - 12 AM)</option>
                        <option value="Night (12 AM - 8 AM)">Night (12 AM - 8 AM)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* ──────────────────────────────────────────────── */}
              {/* SPECIFIC FIELDS: PATIENT                         */}
              {/* ──────────────────────────────────────────────── */}
              {selectedRole === 'PATIENT' && (
                <div className="p-4 bg-blue-950/20 border border-blue-500/30 rounded-2xl space-y-4 animate-fade-in">
                  <div className="flex items-center gap-2 text-blue-300 text-xs font-bold uppercase tracking-wider">
                    <User className="w-4 h-4" />
                    <span>Patient Demographics & ABHA</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Age</label>
                      <input
                        type="number"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Gender</label>
                      <select
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
                      >
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">ABHA Health ID (Optional)</label>
                      <input
                        type="text"
                        value={abhaId}
                        onChange={(e) => setAbhaId(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm font-mono"
                        placeholder="91-8844-3311-2299"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ──────────────────────────────────────────────── */}
              {/* SPECIFIC FIELDS: HOSPITAL ADMIN                  */}
              {/* ──────────────────────────────────────────────── */}
              {selectedRole === 'HOSPITAL_ADMIN' && (
                <div className="p-4 bg-purple-950/20 border border-purple-500/30 rounded-2xl space-y-4 animate-fade-in">
                  <div className="flex items-center gap-2 text-purple-300 text-xs font-bold uppercase tracking-wider">
                    <Key className="w-4 h-4" />
                    <span>Hospital Governance Key</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Hospital Admin Master Passkey (Enter <span className="font-mono text-purple-400">ADMIN2026</span>)
                    </label>
                    <input
                      type="password"
                      value={adminSecretKey}
                      onChange={(e) => setAdminSecretKey(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm font-mono"
                      placeholder="ADMIN2026"
                      required
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-2xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 touch-target text-base"
              >
                <UserPlus className="w-5 h-5" />
                <span>{isLoading ? 'Registering...' : `Register & Create ${selectedRole} Account`}</span>
              </button>
            </form>
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 3: 1-CLICK DEMO ACCESS                               */}
        {/* ========================================================= */}
        {mode === 'DEMO' && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-white mb-1">1-Click Role Access</h2>
              <p className="text-xs text-slate-400">Instant test access into each clinical workspace</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { role: 'PATIENT', label: 'Patient / Kiosk', icon: User, color: 'bg-blue-600', path: '/kiosk' },
                { role: 'DOCTOR', label: 'OPD Doctor', icon: Stethoscope, color: 'bg-indigo-600', path: '/doctor' },
                { role: 'NURSE', label: 'Nurse / Triage', icon: Activity, color: 'bg-green-600', path: '/nurse' },
                { role: 'TRIAGE_STAFF', label: 'Triage Center', icon: AlertCircle, color: 'bg-red-600', path: '/triage' },
                { role: 'AYUSH_DOCTOR', label: 'AYUSH Doctor', icon: Leaf, color: 'bg-amber-700', path: '/ayush' },
                { role: 'AYUSH_DOCTOR', label: 'Homeopathic Doctor', icon: Droplets, color: 'bg-teal-600', path: '/homeopathic' },
                { role: 'HOSPITAL_ADMIN', label: 'Hospital Admin', icon: UserCog, color: 'bg-purple-600', path: '/admin' },
              ].map(({ role, label, icon: Icon, color, path }) => (
                <button
                  key={`${role}-${path}`}
                  onClick={() => handleDemoLogin(role, path)}
                  disabled={isLoading}
                  className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 transition-all flex items-center gap-4 shadow-md touch-target"
                >
                  <div className={`w-12 h-12 ${color} rounded-2xl flex items-center justify-center text-white shrink-0 shadow-md`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <span className="text-sm font-bold text-slate-100 block">{label}</span>
                    <span className="text-[10px] text-slate-400">Click to enter workspace →</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-slate-600 text-xs mt-10">
          MediKiosk v2.0 • ABDM & HIPAA Architecture • AI assists clinicians, not replaces them.
        </p>

      </div>
    </div>
  );
}
