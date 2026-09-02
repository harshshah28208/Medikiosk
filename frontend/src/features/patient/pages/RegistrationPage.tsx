import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../../store/LanguageContext';
import { api } from '../../../services/api';
import {
  UserPlus, ArrowRight, ArrowLeft, AlertCircle, Building2,
  Phone, User, Calendar, CreditCard, Sparkles, Pill, Activity
} from 'lucide-react';

export function RegistrationPage() {
  const navigate = useNavigate();
  const { language, t } = useLanguage();

  const [departments, setDepartments] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedSystem, setSelectedSystem] = useState<'ALLOPATHY' | 'AYURVEDA' | 'HOMEOPATHY'>('ALLOPATHY');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const [isEditingDetails, setIsEditingDetails] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    age: '',
    gender: 'MALE',
    email: '',
    address: '',
    emergencyContact: '',
    abhaId: '',
    departmentId: '',
    doctorId: '',
    reasonForVisit: '',
    pastMedicalHistory: '',
    currentMedications: '',
    allergies: '',
  });

  useEffect(() => {
    // Check for existing logged in session or patient
    const visitType = localStorage.getItem('medikiosk_visit_type');
    const isNewCase = visitType === 'NEW_CASE';
    const activePatientRaw = isNewCase ? null : localStorage.getItem('medikiosk_active_patient');
    const userRaw = isNewCase ? null : localStorage.getItem('medikiosk_user');
    const activePatient = activePatientRaw ? JSON.parse(activePatientRaw) : null;
    const storedUser = userRaw ? JSON.parse(userRaw) : null;
    const sessionPatient = activePatient || (storedUser?.patient ? storedUser.patient : (storedUser?.role === 'PATIENT' ? storedUser : null));

    if (!isNewCase && sessionPatient && (sessionPatient.name || sessionPatient.phone)) {
      setHasSession(true);
      setFormData((prev) => ({
        ...prev,
        name: sessionPatient.name || '',
        phone: sessionPatient.phone || '',
        age: sessionPatient.age ? String(sessionPatient.age) : '30',
        gender: sessionPatient.gender || 'MALE',
        email: sessionPatient.email || '',
        address: sessionPatient.address || '',
        emergencyContact: sessionPatient.emergencyContact || '',
        abhaId: sessionPatient.abhaId || '',
      }));
    } else {
      setHasSession(false);
      setIsEditingDetails(true);
    }

    api.admin
      .departments()
      .then((res: any) => {
        if (res?.departments?.length > 0) {
          setDepartments(res.departments);
        }
      })
      .catch((err: any) => {
        console.error('Failed to fetch departments:', err);
      });

    api.doctor
      .roster()
      .then((res: any) => {
        if (res?.doctors?.length > 0) {
          setDoctors(res.doctors);
          const firstAllopathy = res.doctors.find((d: any) => d.system === 'ALLOPATHY') || res.doctors[0];
          if (firstAllopathy) {
            setSelectedDoctorId(firstAllopathy.id);
            setFormData((prev) => ({
              ...prev,
              doctorId: firstAllopathy.id,
              departmentId: firstAllopathy.departmentId,
            }));
          }
        }
      })
      .catch((err: any) => {
        console.error('Failed to fetch doctors:', err);
      });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectDoctor = (doc: any) => {
    setSelectedDoctorId(doc.id);
    setFormData((prev) => ({
      ...prev,
      doctorId: doc.id,
      departmentId: doc.departmentId,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!formData.name.trim() || !formData.phone.trim()) {
      setErrorMsg('Please enter your Name and Phone number to register.');
      return;
    }

    const selectedDoc = doctors.find((d) => d.id === selectedDoctorId);
    const selectedDeptId = selectedDoc?.departmentId || formData.departmentId || departments[0]?.id || 'GEN';
    const effectiveCarePath = selectedSystem === 'AYURVEDA' ? 'AYUSH' : selectedSystem === 'HOMEOPATHY' ? 'HOMEOPATHY' : 'ALLOPATHY';

    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        age: formData.age ? parseInt(formData.age, 10) : undefined,
        gender: formData.gender || 'MALE',
        phone: formData.phone.trim(),
        email: formData.email.trim() || undefined,
        address: formData.address.trim() || undefined,
        emergencyContact: formData.emergencyContact.trim() || undefined,
        preferredLang: (language || 'en').toUpperCase(),
        abhaId: formData.abhaId.trim() || undefined,
        departmentId: selectedDeptId,
        departmentCode: selectedSystem === 'AYURVEDA' || selectedSystem === 'HOMEOPATHY' ? 'AYUSH' : (selectedDoc?.departmentCode || 'GEN'),
        carePath: effectiveCarePath,
        doctorId: selectedDoctorId || undefined,
        reasonForVisit: formData.reasonForVisit.trim() || undefined,
        pastMedicalHistory: formData.pastMedicalHistory.trim() || undefined,
        currentMedications: formData.currentMedications.trim() || undefined,
        allergies: formData.allergies.trim() || undefined,
      };

      const res = await api.patients.register(payload);

      if (res?.patient) {
        localStorage.setItem('medikiosk_care_path', effectiveCarePath);
        localStorage.setItem('medikiosk_selected_system', selectedSystem);
        localStorage.setItem('medikiosk_active_patient', JSON.stringify({ ...res.patient, isNewPatient: true, isReturning: false }));
        localStorage.setItem('medikiosk_active_visit', JSON.stringify(res.visit));
        localStorage.setItem('medikiosk_active_queue', JSON.stringify(res.queueEntry));
        localStorage.removeItem('medikiosk_recent_changes');
        localStorage.removeItem('medikiosk_temp_raw_transcript');
        if (selectedDoc) {
          localStorage.setItem('medikiosk_active_doctor', JSON.stringify(selectedDoc));
        }
        navigate('/kiosk/consent');
      } else if (res?.error) {
        setErrorMsg(res.error);
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      setErrorMsg(err.message || 'Registration failed. Please check your information.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredDoctors = doctors.filter((d) => d.system === selectedSystem);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-blue-50 via-slate-50 to-indigo-50">
      <div className="w-full max-w-4xl bg-white rounded-3xl p-6 sm:p-10 shadow-xl border border-slate-100 flex flex-col">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-6 pb-4 border-b border-slate-100">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center shrink-0">
            <UserPlus className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{t('regTitle')}</h1>
            <p className="text-slate-500 text-xs sm:text-sm">{t('regSubtitle')}</p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm mb-6 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{errorMsg}</p>
          </div>
        )}

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Patient Details: Auto-filled Card if Session Exists, or Full Form if New */}
          {hasSession && !isEditingDetails ? (
            <div className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center font-bold text-lg shadow-sm">
                  {formData.name.charAt(0).toUpperCase() || 'P'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-900 text-base">{formData.name}</span>
                    <span className="text-[11px] px-2.5 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-full flex items-center gap-1">
                      ✓ Profile Auto-Filled
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 flex flex-wrap items-center gap-2">
                    <span>Phone: <strong>{formData.phone}</strong></span>
                    <span>•</span>
                    <span>Age/Gender: <strong>{formData.age || '30'} / {formData.gender}</strong></span>
                    {formData.abhaId && (
                      <>
                        <span>•</span>
                        <span>ABHA: <strong className="font-mono">{formData.abhaId}</strong></span>
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setIsEditingDetails(true)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-bold px-3 py-1.5 bg-white border border-blue-200 rounded-xl shadow-xs"
                >
                  Edit Demographics
                </button>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem('medikiosk_active_patient');
                    localStorage.removeItem('medikiosk_active_visit');
                    localStorage.removeItem('medikiosk_active_queue');
                    setHasSession(false);
                    setIsEditingDetails(true);
                    setFormData({
                      name: '',
                      phone: '',
                      age: '',
                      gender: 'MALE',
                      email: '',
                      address: '',
                      emergencyContact: '',
                      abhaId: '',
                      departmentId: '',
                      doctorId: '',
                      reasonForVisit: '',
                      pastMedicalHistory: '',
                      currentMedications: '',
                      allergies: '',
                    });
                  }}
                  className="text-xs text-rose-600 hover:text-rose-800 font-bold px-3 py-1.5 bg-white border border-rose-200 rounded-xl shadow-xs"
                >
                  Register Different Person
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {hasSession && (
                <div className="flex items-center justify-between pb-1">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Patient Demographics</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsEditingDetails(false)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-semibold underline"
                    >
                      Hide / Use Saved Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        localStorage.removeItem('medikiosk_active_patient');
                        localStorage.removeItem('medikiosk_active_visit');
                        localStorage.removeItem('medikiosk_active_queue');
                        setHasSession(false);
                        setFormData({
                          name: '',
                          phone: '',
                          age: '',
                          gender: 'MALE',
                          email: '',
                          address: '',
                          emergencyContact: '',
                          abhaId: '',
                          departmentId: '',
                          doctorId: '',
                          reasonForVisit: '',
                          pastMedicalHistory: '',
                          currentMedications: '',
                          allergies: '',
                        });
                      }}
                      className="text-xs text-rose-600 hover:text-rose-800 font-semibold underline"
                    >
                      Clear / New Person
                    </button>
                  </div>
                </div>
              )}
              {/* Personal Information Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    {t('fullName')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    placeholder="e.g. Rahul Sharma"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:bg-white text-slate-800 text-sm font-medium"
                  />
                </div>

                {/* Mobile Number */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    {t('phone')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    placeholder="10-digit mobile number"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:bg-white text-slate-800 text-sm font-medium"
                  />
                </div>

                {/* Age & Gender */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      {t('age')}
                    </label>
                    <input
                      type="number"
                      name="age"
                      value={formData.age}
                      onChange={handleChange}
                      placeholder="e.g. 45"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:bg-white text-slate-800 text-sm font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      {t('gender')}
                    </label>
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:bg-white text-slate-800 text-sm font-medium"
                    >
                      <option value="MALE">{t('male')}</option>
                      <option value="FEMALE">{t('female')}</option>
                      <option value="OTHER">{t('other')}</option>
                    </select>
                  </div>
                </div>

                {/* ABHA Health ID */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    ABHA Health ID (Optional)
                  </label>
                  <input
                    type="text"
                    name="abhaId"
                    value={formData.abhaId}
                    onChange={handleChange}
                    placeholder="e.g. 91-8844-3311-2299"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:bg-white text-slate-800 text-sm font-medium"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ─── Step 1: Medical System Selection ─── */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              {language === 'hi' ? '1. चिकित्सा पद्धति / विभाग चुनें' : language === 'gu' ? '1. તબીબી પદ્ધતિ / વિભાગ પસંદ કરો' : '1. Select Medical System / Treatment Approach'} <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  id: 'ALLOPATHY',
                  title: language === 'hi' ? 'एलोपैथी (आधुनिक चिकित्सा)' : language === 'gu' ? 'એલોપેથી (આધુનિક સારવાર)' : 'Modern Medicine (Allopathy)',
                  desc: language === 'hi' ? 'हृदय रोग, बाल रोग, जनरल ओपीडी, हड्डी व ईएनटी' : language === 'gu' ? 'હૃદય રોગ, બાળ રોગ, જનરલ ઓપીડી, હાડકા અને કાન-નાક-ગળું' : 'Cardiology, Pediatrics, General OPD, Orthopedics & ENT',
                  icon: '🩺',
                  activeClass: 'border-blue-600 bg-blue-50/70 text-blue-950 ring-2 ring-blue-500/30',
                },
                {
                  id: 'AYURVEDA',
                  title: language === 'hi' ? 'आयुर्वेद (आयुष)' : language === 'gu' ? 'આયુર્વેદ (આયુષ)' : 'Ayurveda (AYUSH)',
                  desc: language === 'hi' ? 'प्रकृति परीक्षण, पंचकर्म और हर्बल औषधियां' : language === 'gu' ? 'પ્રકૃતિ પરીક્ષણ, પંચકર્મ અને ઔષધિ સારવાર' : 'Prakriti assessment, Panchakarma & herbal formulations',
                  icon: '🌿',
                  activeClass: 'border-amber-600 bg-amber-50/70 text-amber-950 ring-2 ring-amber-500/30',
                },
                {
                  id: 'HOMEOPATHY',
                  title: language === 'hi' ? 'शास्त्रीय होम्योपैथी' : language === 'gu' ? 'શાસ્ત્રીય હોમિયોપેથી' : 'Classical Homeopathy',
                  desc: language === 'hi' ? 'संवैधानिक उपचार, संपूर्ण स्वास्थ्य मूल्यांकन' : language === 'gu' ? 'સર્વાંગી મૂલ્યાંકન અને કુદરતી ઉપચાર' : 'Constitutional remedy, holistic evaluation & repertory',
                  icon: '💧',
                  activeClass: 'border-teal-600 bg-teal-50/70 text-teal-950 ring-2 ring-teal-500/30',
                },
              ].map((sys) => {
                const isSelected = selectedSystem === sys.id;
                return (
                  <button
                    key={sys.id}
                    type="button"
                    onClick={() => {
                      setSelectedSystem(sys.id as any);
                      const matchingDocs = doctors.filter((d) => d.system === sys.id);
                      if (matchingDocs.length > 0) {
                        handleSelectDoctor(matchingDocs[0]);
                      }
                    }}
                    className={`p-4 rounded-2xl border-2 text-left transition-all flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? `${sys.activeClass} shadow-md scale-[1.01]`
                        : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100/80 text-slate-700'
                    }`}
                  >
                    <div>
                      <span className="text-2xl mb-1.5 block">{sys.icon}</span>
                      <span className="text-sm font-bold block">{sys.title}</span>
                      <span className="text-[11px] text-slate-500 mt-1 block leading-snug">{sys.desc}</span>
                    </div>
                    {isSelected && (
                      <span className="text-[11px] font-bold text-blue-700 mt-3 inline-flex items-center gap-1">
                        ✓ {language === 'hi' ? 'चयनित' : language === 'gu' ? 'પસંદ કરેલ' : 'Selected System'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ─── Step 2: Choose Your Doctor & Assigned Nurse ─── */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                {language === 'hi' ? '2. डॉक्टर एवं जांच रूम चुनें' : language === 'gu' ? '2. ડૉક્ટર અને તપાસ રૂમ પસંદ કરો' : '2. Select Doctor & Assigned Nurse Room'} <span className="text-red-500">*</span>
              </label>
              <span className="text-[11px] text-slate-500">
                {filteredDoctors.length} {language === 'hi' ? 'विशेषज्ञ उपलब्ध' : language === 'gu' ? 'સ્પેશિયાલિસ્ટ ઉપલબ્ધ' : 'available specialist(s)'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
              {filteredDoctors.map((doc) => {
                const isSelected = selectedDoctorId === doc.id;
                return (
                  <div
                    key={doc.id}
                    onClick={() => handleSelectDoctor(doc)}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/50 shadow-md ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{doc.name}</span>
                          </h4>
                          <p className="text-xs text-blue-600 font-semibold">{doc.specialization}</p>
                          <p className="text-[10px] text-slate-400 font-medium">{doc.qualifications}</p>
                        </div>
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold shrink-0">
                          {language === 'hi' ? 'उपलब्ध' : language === 'gu' ? 'ઉપલબ્ધ' : 'Available'}
                        </span>
                      </div>

                      <div className="mt-2 pt-2 border-t border-slate-100 space-y-1 text-[11px]">
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="font-medium">🚪 {language === 'hi' ? 'ओपीडी रूम:' : language === 'gu' ? 'ઓપીડી રૂમ:' : 'OPD Room:'}</span>
                          <span className="font-semibold text-slate-800">{doc.roomNumber}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="font-medium">⏰ {language === 'hi' ? 'समय:' : language === 'gu' ? 'સમય:' : 'Timings:'}</span>
                          <span className="text-slate-700">{doc.opdTimings}</span>
                        </div>
                        {doc.assignedNurse && (
                          <div className="flex items-center justify-between text-emerald-700 bg-emerald-50/70 px-2 py-1 rounded-lg mt-1 font-semibold text-[10px]">
                            <span>🩺 {language === 'hi' ? 'नर्स:' : language === 'gu' ? 'નર્સ:' : 'Assigned Nurse:'}</span>
                            <span>{doc.assignedNurse.name}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between pt-1">
                      <span className={`text-[11px] font-bold ${isSelected ? 'text-blue-700' : 'text-slate-400'}`}>
                        {isSelected
                          ? (language === 'hi' ? '✓ चयनित डॉक्टर' : language === 'gu' ? '✓ પસંદ કરેલ ડૉક્ટર' : '✓ Selected Doctor')
                          : (language === 'hi' ? 'चुनने के लिए क्लिक करें' : language === 'gu' ? 'પસંદ કરવા ક્લિક કરો' : 'Click to select')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reason for visit */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              {t('reasonForVisit')}
            </label>
            <textarea
              name="reasonForVisit"
              value={formData.reasonForVisit}
              onChange={handleChange}
              placeholder={
                language === 'hi'
                  ? 'अपनी मुख्य समस्या या बीमारी के बारे में संक्षेप में लिखें...'
                  : language === 'gu'
                  ? 'આપની મુખ્ય તકલીફ અથવા બીમારી વિશે સંક્ષિપ્તમાં જણાવો...'
                  : 'Describe your primary symptoms or health concern...'
              }
              rows={2}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:bg-white text-slate-800 text-sm resize-none"
            />
          </div>

          {/* Optional Pre-Existing Clinical History & Medications */}
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3">
            <div className="flex items-center gap-2">
              <Pill className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-bold uppercase text-slate-700 tracking-wider">
                {language === 'hi' ? 'पुरानी बीमारी व नियमित दवाइयाँ (वैकल्पिक)' : language === 'gu' ? 'જૂની બીમારી અને નિયમિત દવાઓ (મરજિયાત)' : 'Prior Medical History & Regular Medications (Optional)'}
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">
                  {language === 'hi' ? 'पुरानी बीमारियाँ (BP, शुगर, थायराइड)' : language === 'gu' ? 'જૂની બીમારીઓ (BP, ડાયાબિટીસ, થાયરોઇડ)' : 'Existing Medical Conditions'}
                </label>
                <input
                  type="text"
                  name="pastMedicalHistory"
                  value={formData.pastMedicalHistory}
                  onChange={handleChange}
                  placeholder={
                    language === 'hi'
                      ? 'उदा. ब्लड प्रेशर, शुगर, दमा, थायराइड'
                      : language === 'gu'
                      ? 'દા.ત. બ્લડ પ્રેશર, ડાયાબિટીસ, અસ્થમા'
                      : 'e.g. Diabetes, High BP, Asthma, Thyroid'
                  }
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">
                  {language === 'hi' ? 'वर्तमान में चल रही नियमित दवाइयाँ' : language === 'gu' ? 'હાલ ચાલતી નિયમિત દવાઓ' : 'Current Medications / Regular Drugs'}
                </label>
                <input
                  type="text"
                  name="currentMedications"
                  value={formData.currentMedications}
                  onChange={handleChange}
                  placeholder={
                    language === 'hi'
                      ? 'उदा. मेटफॉर्मिन 500mg, टेल्मिसार्टन 40mg'
                      : language === 'gu'
                      ? 'દા.ત. Metformin 500mg, Telmisartan 40mg'
                      : 'e.g. Metformin 500mg, Telmisartan 40mg'
                  }
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-between pt-6 border-t border-slate-100">
            <button
              type="button"
              onClick={() => navigate('/kiosk/identify')}
              className="flex items-center gap-2 px-6 py-3 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 touch-target"
            >
              <ArrowLeft className="w-5 h-5" />
              {t('backBtn')}
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-600/30 transition-all touch-target-lg"
            >
              <span>{isSubmitting ? t('submitting') : t('continueBtn')}</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
