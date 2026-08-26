import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../../store/LanguageContext';
import { Ticket, ArrowRight, Clock, MapPin, User, CheckCircle2 } from 'lucide-react';

export function TokenPage() {
  const { visitId } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [activePatient, setActivePatient] = useState<any>(null);
  const [activeVisit, setActiveVisit] = useState<any>(null);
  const [activeQueue, setActiveQueue] = useState<any>(null);

  useEffect(() => {
    const p = localStorage.getItem('medikiosk_active_patient');
    const v = localStorage.getItem('medikiosk_active_visit');
    const q = localStorage.getItem('medikiosk_active_queue');

    if (p) setActivePatient(JSON.parse(p));
    if (v) setActiveVisit(JSON.parse(v));
    if (q) setActiveQueue(JSON.parse(q));
  }, []);

  const tokenNumber = activeVisit?.token || activeQueue?.tokenNumber || 'G-101';
  const patientName = activePatient?.name || 'Rahul Sharma';
  const mrn = activePatient?.mrn || 'MK-1001';
  const departmentName = activeVisit?.department || 'General Medicine';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-blue-50 via-slate-50 to-indigo-50">
      <div className="w-full max-w-xl bg-white rounded-3xl p-8 sm:p-10 shadow-2xl border border-slate-100 flex flex-col items-center text-center">
        
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-green-50 text-green-700 font-semibold text-xs rounded-full border border-green-200 mb-6">
          <CheckCircle2 className="w-4 h-4" />
          <span>Registration & Check-In Confirmed</span>
        </div>

        {/* Token Card */}
        <div className="w-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-3xl p-8 shadow-xl shadow-blue-600/30 mb-8 relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 opacity-10">
            <Ticket className="w-60 h-60" />
          </div>

          <p className="text-xs uppercase tracking-widest text-blue-200 font-bold mb-2">
            {t('tokenNumber')}
          </p>
          <div className="text-5xl sm:text-6xl font-extrabold tracking-tight mb-4 font-mono">
            {tokenNumber}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 pt-4 border-t border-white/20 text-xs sm:text-sm text-blue-100">
            <div className="flex items-center gap-1.5">
              <User className="w-4 h-4" />
              <span>{patientName} ({mrn})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4" />
              <span>{departmentName}</span>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-slate-700 text-sm text-left w-full mb-8 space-y-2">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <Clock className="w-4 h-4 text-blue-600" />
            <span>Next Step: AI Symptom Intake</span>
          </div>
          <p className="text-xs text-slate-500">
            Speak or type naturally in English, Hindi, or Gujarati. Our intelligent intake assistant will structure your medical narrative directly for the OPD physician.
          </p>
        </div>

        {/* Proceed Button */}
        <button
          onClick={() => navigate(`/kiosk/intake/${visitId || 'active'}`)}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-3 transition-all touch-target-lg text-lg"
        >
          <span>{t('proceedToIntake')}</span>
          <ArrowRight className="w-6 h-6" />
        </button>

      </div>
    </div>
  );
}
