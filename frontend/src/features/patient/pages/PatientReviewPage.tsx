import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../../store/LanguageContext';
import { api } from '../../../services/api';
import {
  CheckCircle2, ArrowRight, ArrowLeft, Stethoscope,
  Heart, AlertTriangle, FileText, Activity, Download, Printer, ShieldCheck, User, Calendar
} from 'lucide-react';

export function PatientReviewPage() {
  const { visitId } = useParams();
  const navigate = useNavigate();
  const { language, t } = useLanguage();

  const [activePatient, setActivePatient] = useState<any>(null);
  const [activeVisit, setActiveVisit] = useState<any>(null);
  const [summaryReport, setSummaryReport] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const p = localStorage.getItem('medikiosk_active_patient');
    const v = localStorage.getItem('medikiosk_active_visit');
    const parsedPatient = p ? JSON.parse(p) : null;
    const parsedVisit = v ? JSON.parse(v) : null;

    if (parsedPatient) setActivePatient(parsedPatient);
    if (parsedVisit) setActiveVisit(parsedVisit);

    const targetVisitId = (visitId && visitId !== 'current') ? visitId : parsedVisit?.id;

    if (targetVisitId) {
      api.visits.get(targetVisitId)
        .then((res) => {
          if (res?.visit) {
            setActiveVisit(res.visit);
            if (res.visit.patient) setActivePatient(res.visit.patient);
            if (res.visit.summary) {
              const parsed = typeof res.visit.summary.summaryJson === 'string'
                ? JSON.parse(res.visit.summary.summaryJson)
                : res.visit.summary.summaryJson;
              setSummaryReport(parsed);
            }
          }
        })
        .catch((err) => console.warn('Could not fetch visit summary:', err))
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [visitId]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-blue-50 via-slate-50 to-indigo-50">
      <div className="w-full max-w-3xl bg-white rounded-3xl p-6 sm:p-10 shadow-2xl border border-slate-100 flex flex-col space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center shadow-sm">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
                {language === 'hi' ? 'क्लिनिकल AI इन्टेक रिपोर्ट तैयार है' : language === 'gu' ? 'ક્લિનિકલ AI ઇન્ટેક રિપોર્ટ તૈયાર છે' : 'AI Clinical Intake Report Generated'}
              </h1>
              <p className="text-slate-500 text-xs sm:text-sm">
                {language === 'hi' ? 'आपकी केस हिस्ट्री डॉक्टर के पास पहुँच चुकी है' : language === 'gu' ? 'આપની કેસ હિસ્ટ્રી ડૉક્ટરને મોકલી દેવાઈ છે' : 'Pre-consultation intake finalized for physician review'}
              </p>
            </div>
          </div>

          <button
            onClick={handlePrint}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all touch-target"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>
        </div>

        {/* Digital OPD Patient Token & Department Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-blue-600 text-white p-5 rounded-2xl shadow-lg shadow-blue-600/20">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200 block">Patient Name</span>
            <p className="text-base font-bold truncate">{activePatient?.name || 'Patient'}</p>
            <span className="text-xs text-blue-100 font-mono">MRN: {activePatient?.mrn || 'MK-1001'}</span>
          </div>

          <div className="text-left sm:text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200 block">OPD Token #</span>
            <p className="text-2xl font-black font-mono tracking-tight">{activeVisit?.token || 'G-101'}</p>
            <span className="text-xs text-blue-100">Dept: {activeVisit?.department?.name || 'General OPD'}</span>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200 block">Queue Status</span>
            <span className="inline-block mt-1 px-2.5 py-0.5 bg-emerald-500 text-white font-bold text-xs rounded-full shadow-sm">
              Waiting for Doctor
            </span>
          </div>
        </div>

        {/* Structured AI Report Generated Card */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4 text-xs sm:text-sm text-slate-700">
          <div className="flex items-center gap-2 text-slate-800 font-bold uppercase tracking-wider text-xs pb-2 border-b border-slate-200">
            <FileText className="w-4 h-4 text-blue-600" />
            <span>Physician Clinical Summary Draft</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Chief Complaint</span>
              <p className="text-slate-900 font-semibold">
                {summaryReport?.chiefComplaint || activeVisit?.reasonForVisit || 'Symptom Consultation'}
              </p>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Vital Signs Snapshot</span>
              <p className="text-slate-900 font-semibold">
                {summaryReport?.vitalHighlights || 'Awaiting nurse triage intake'}
              </p>
            </div>

            <div className="sm:col-span-2 bg-white p-3.5 rounded-xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">History of Present Illness (HPI)</span>
              <p className="text-slate-700 leading-relaxed text-xs sm:text-sm">
                {summaryReport?.historyOfPresentIllness || 'Synthesized across multi-turn adaptive clinical intake.'}
              </p>
            </div>

            {summaryReport?.pastMedicalHistory && (
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Past Medical History</span>
                <p className="text-slate-800 text-xs">{summaryReport.pastMedicalHistory}</p>
              </div>
            )}

            {summaryReport?.medications && (
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Current Regular Medications</span>
                <p className="text-slate-800 text-xs">{summaryReport.medications}</p>
              </div>
            )}
          </div>
        </div>

        {/* Direction Notice */}
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-xs sm:text-sm">
          <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-600" />
          <p>
            {language === 'hi'
              ? 'कृपया OPD प्रतीक्षालय या नर्स डेस्क पर पहुँचें। डिस्प्ले स्क्रीन पर आपका टोकન नंबर बुलाया जाएगा।'
              : language === 'gu'
              ? 'કૃપા કરીને OPD પ્રતીક્ષાલય અથવા નર્સ ડેસ્ક પર જાઓ. ડિસ્પ્લે સ્ક્રીન પર આપનો ટોકન નંબર બોલાવવામાં આવશે.'
              : 'Please proceed to the OPD waiting area or nursing station. Your token number will be called on the queue display.'}
          </p>
        </div>

        {/* Action Button */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={() => navigate('/kiosk/portal')}
            className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all touch-target-lg text-base"
          >
            <span>Open Patient Health Portal</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

      </div>
    </div>
  );
}
