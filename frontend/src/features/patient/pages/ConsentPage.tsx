import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../../store/LanguageContext';
import { api } from '../../../services/api';
import { ShieldAlert, CheckCircle2, ArrowLeft, ArrowRight, Stethoscope, AlertTriangle } from 'lucide-react';

export function ConsentPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [hasConsented, setHasConsented] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleGrantConsent = async () => {
    if (!hasConsented) return;

    setIsSubmitting(true);
    try {
      const activePatientRaw = localStorage.getItem('medikiosk_active_patient');
      const activeVisitRaw = localStorage.getItem('medikiosk_active_visit');

      const activePatient = activePatientRaw ? JSON.parse(activePatientRaw) : null;
      const activeVisit = activeVisitRaw ? JSON.parse(activeVisitRaw) : null;

      if (activePatient?.id) {
        await api.consent.grant({
          patientId: activePatient.id,
          visitId: activeVisit?.id || undefined,
          consentType: 'AI_INTAKE',
          purpose: 'Informed consent granted for AI-assisted symptom intake & clinical history structuring',
        });
      }

      // Navigate to Token page / AI conversation page
      const visitId = activeVisit?.id || 'demo-visit';
      navigate(`/kiosk/token/${visitId}`);
    } catch (err) {
      console.error('Consent error:', err);
      // Even if offline, allow forward progression with cached session
      navigate('/kiosk/token/current');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-blue-50 via-slate-50 to-indigo-50">
      <div className="w-full max-w-2xl bg-white rounded-3xl p-8 sm:p-10 shadow-xl border border-slate-100 flex flex-col">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-9 h-9" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-2">
            {t('consentTitle')}
          </h1>
          <p className="text-slate-500 text-sm">Transparency & Clinical Safety Notice</p>
        </div>

        {/* Explain Points */}
        <div className="space-y-4 mb-8">
          <div className="flex items-start gap-4 p-4 rounded-2xl bg-blue-50/60 border border-blue-100 text-slate-800 text-sm">
            <CheckCircle2 className="w-6 h-6 text-blue-600 shrink-0 mt-0.5" />
            <p>{t('consentExplain1')}</p>
          </div>

          <div className="flex items-start gap-4 p-4 rounded-2xl bg-amber-50/60 border border-amber-200 text-slate-800 text-sm">
            <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            <p>{t('consentExplain2')}</p>
          </div>

          <div className="flex items-start gap-4 p-4 rounded-2xl bg-green-50/60 border border-green-200 text-slate-800 text-sm">
            <Stethoscope className="w-6 h-6 text-green-600 shrink-0 mt-0.5" />
            <p>{t('consentExplain3')}</p>
          </div>
        </div>

        {/* Interactive Checkbox */}
        <label className="flex items-center gap-4 p-5 rounded-2xl border-2 border-blue-600/30 bg-blue-50/30 cursor-pointer hover:bg-blue-50/60 transition-colors mb-8 touch-target">
          <input
            type="checkbox"
            checked={hasConsented}
            onChange={(e) => setHasConsented(e.target.checked)}
            className="w-6 h-6 text-blue-600 rounded-lg focus:ring-blue-500"
          />
          <span className="text-sm font-semibold text-slate-800 select-none">
            {t('consentCheckbox')}
          </span>
        </label>

        {/* Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <button
            onClick={() => navigate('/kiosk/identify')}
            className="flex items-center gap-2 px-6 py-3 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 touch-target"
          >
            <ArrowLeft className="w-5 h-5" />
            {t('backBtn')}
          </button>

          <button
            onClick={handleGrantConsent}
            disabled={!hasConsented || isSubmitting}
            className="flex items-center gap-2 px-8 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 transition-all touch-target-lg"
          >
            {isSubmitting ? 'Recording Consent...' : t('grantConsentBtn')}
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

      </div>
    </div>
  );
}
