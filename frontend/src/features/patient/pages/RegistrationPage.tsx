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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
    reasonForVisit: '',
    pastMedicalHistory: '',
    currentMedications: '',
    allergies: '',
  });

  useEffect(() => {
    api.admin
      .departments()
      .then((res: any) => {
        if (res?.departments?.length > 0) {
          setDepartments(res.departments);
          setFormData((prev) => ({ ...prev, departmentId: res.departments[0].id }));
        }
      })
      .catch((err: any) => {
        console.error('Failed to fetch departments:', err);
        const fallback = [
          { id: 'a2e79414-0be8-4925-bfa5-b5737cb4f8f8', name: 'General Medicine', code: 'GEN' },
        ];
        setDepartments(fallback);
        setFormData((prev) => ({ ...prev, departmentId: fallback[0].id }));
      });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!formData.name || !formData.phone || !formData.departmentId) {
      setErrorMsg('Please complete all mandatory fields (Name, Phone, Department).');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        age: formData.age ? parseInt(formData.age, 10) : undefined,
        gender: formData.gender,
        phone: formData.phone.trim(),
        email: formData.email.trim() || undefined,
        address: formData.address.trim() || undefined,
        emergencyContact: formData.emergencyContact.trim() || undefined,
        preferredLang: language.toUpperCase(),
        abhaId: formData.abhaId.trim() || undefined,
        departmentId: formData.departmentId,
        reasonForVisit: formData.reasonForVisit.trim() || undefined,
        pastMedicalHistory: formData.pastMedicalHistory.trim() || undefined,
        currentMedications: formData.currentMedications.trim() || undefined,
        allergies: formData.allergies.trim() || undefined,
      };

      const res = await api.patients.register(payload);

      if (res?.patient) {
        localStorage.setItem('medikiosk_active_patient', JSON.stringify(res.patient));
        localStorage.setItem('medikiosk_active_visit', JSON.stringify(res.visit));
        localStorage.setItem('medikiosk_active_queue', JSON.stringify(res.queueEntry));
        navigate('/kiosk/consent');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Registration failed. Please check your information.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-blue-50 via-slate-50 to-indigo-50">
      <div className="w-full max-w-3xl bg-white rounded-3xl p-6 sm:p-10 shadow-xl border border-slate-100 flex flex-col">
        
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
        <form onSubmit={handleSubmit} className="space-y-4">
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
                placeholder="e.g. Ramesh Kumar Patel"
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:bg-white text-slate-800 text-sm"
              />
            </div>

            {/* Mobile Phone */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                {t('phone')} <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="e.g. 9876543210"
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:bg-white text-slate-800 text-sm"
              />
            </div>

            {/* Age */}
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
                min="0"
                max="125"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:bg-white text-slate-800 text-sm"
              />
            </div>

            {/* Gender */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                {t('gender')}
              </label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:bg-white text-slate-800 text-sm"
              >
                <option value="MALE">{t('male')}</option>
                <option value="FEMALE">{t('female')}</option>
                <option value="OTHER">{t('other')}</option>
              </select>
            </div>

            {/* ABHA ID */}
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
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:bg-white text-slate-800 text-sm"
              />
            </div>

            {/* Department */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                {t('department')} <span className="text-red-500">*</span>
              </label>
              <select
                name="departmentId"
                value={formData.departmentId}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:bg-white text-slate-800 text-sm"
              >
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name} ({dept.code})
                  </option>
                ))}
              </select>
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
              placeholder="Describe your primary symptoms or health concern..."
              rows={2}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:bg-white text-slate-800 text-sm resize-none"
            />
          </div>

          {/* Optional Pre-Existing Clinical History & Medications */}
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3">
            <div className="flex items-center gap-2">
              <Pill className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-bold uppercase text-slate-700 tracking-wider">
                Prior Medical History & Regular Medications (Optional)
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">
                  Existing Medical Conditions
                </label>
                <input
                  type="text"
                  name="pastMedicalHistory"
                  value={formData.pastMedicalHistory}
                  onChange={handleChange}
                  placeholder="e.g. Diabetes, High BP, Asthma, Thyroid"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">
                  Current Medications / Regular Drugs
                </label>
                <input
                  type="text"
                  name="currentMedications"
                  value={formData.currentMedications}
                  onChange={handleChange}
                  placeholder="e.g. Metformin 500mg, Telmisartan 40mg"
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
