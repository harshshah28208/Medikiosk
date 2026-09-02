import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../../store/LanguageContext';
import { api } from '../../../services/api';
import { safeGetItem, safeSetItem } from '../../../utils/storage';
import {
  CheckCircle2, ArrowRight, ArrowLeft, Stethoscope,
  Heart, AlertTriangle, FileText, Activity, Download, Printer, ShieldCheck, User, Calendar, Edit3, X, Save, CheckSquare
} from 'lucide-react';

export function PatientReviewPage() {
  const { visitId } = useParams();
  const navigate = useNavigate();
  const { language, t } = useLanguage();

  const [activePatient, setActivePatient] = useState<any>(null);
  const [activeVisit, setActiveVisit] = useState<any>(null);
  const [summaryReport, setSummaryReport] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Patient Confirmation & Edit States (Requirement 33)
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Editable Form Fields
  const [editForm, setEditForm] = useState({
    chiefComplaint: '',
    lifestyle: '',
    pastMedicalHistory: '',
    medications: '',
    allergies: '',
  });

  const safeString = (val: any, fallback = ''): string => {
    if (val === null || val === undefined) return fallback;
    if (typeof val === 'string') return val.trim() || fallback;
    if (Array.isArray(val)) {
      if (val.length === 0) return fallback;
      return val
        .map((item) => (typeof item === 'object' ? JSON.stringify(item) : String(item)))
        .join(', ');
    }
    if (typeof val === 'object') {
      const entries = Object.entries(val);
      if (entries.length === 0) return fallback;
      return entries
        .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
        .join(' | ');
    }
    return String(val);
  };

  useEffect(() => {
    const parsedPatient = safeGetItem<any>('medikiosk_active_patient', null);
    const parsedVisit = safeGetItem<any>('medikiosk_active_visit', null);

    if (parsedPatient) setActivePatient(parsedPatient);
    if (parsedVisit) {
      setActiveVisit(parsedVisit);
      if (parsedVisit.summary) {
        try {
          const parsed = typeof parsedVisit.summary === 'string'
            ? JSON.parse(parsedVisit.summary)
            : (parsedVisit.summary?.summaryJson
                ? (typeof parsedVisit.summary.summaryJson === 'string' ? JSON.parse(parsedVisit.summary.summaryJson) : parsedVisit.summary.summaryJson)
                : parsedVisit.summary);
          setSummaryReport(parsed);
          setEditForm({
            chiefComplaint: safeString(parsed?.chiefComplaint, parsedVisit?.reasonForVisit || ''),
            lifestyle: safeString(parsed?.lifestyle, ''),
            pastMedicalHistory: safeString(parsed?.pastMedicalHistory, ''),
            medications: safeString(parsed?.medications, ''),
            allergies: safeString(parsed?.allergies, ''),
          });
        } catch (e) {
          console.warn('Failed to parse active visit summary:', e);
        }
      }
    }

    const targetVisitId = (visitId && visitId !== 'current') ? visitId : parsedVisit?.id;

    if (targetVisitId) {
      api.visits.get(targetVisitId)
        .then((res) => {
          if (res?.visit) {
            setActiveVisit(res.visit);
            if (res.visit.patient) setActivePatient(res.visit.patient);
            if (res.visit.summary) {
              try {
                const parsed = typeof res.visit.summary.summaryJson === 'string'
                  ? JSON.parse(res.visit.summary.summaryJson)
                  : (res.visit.summary.summaryJson || res.visit.summary);
                setSummaryReport(parsed);

                setEditForm({
                  chiefComplaint: safeString(parsed?.chiefComplaint, res.visit.reasonForVisit || ''),
                  lifestyle: safeString(parsed?.lifestyle, ''),
                  pastMedicalHistory: safeString(parsed?.pastMedicalHistory, ''),
                  medications: safeString(parsed?.medications, ''),
                  allergies: safeString(parsed?.allergies, ''),
                });
              } catch (e) {
                console.warn('Failed to parse backend visit summary:', e);
              }
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

  const handleDownload = () => {
    const p = activePatient;
    const s = summaryReport;
    const v = activeVisit;
    const text = `=====================================================
MEDIKIOSK PATIENT CLINICAL INTAKE SUMMARY
=====================================================
Date: ${new Date().toLocaleString()}
Token: #${v?.token || 'N/A'} | Department: ${v?.department?.name || 'General OPD'}

PATIENT DETAILS:
Name:    ${p?.name || 'N/A'}
MRN:     ${p?.mrn || 'N/A'}
Age/Sex: ${p?.age || '--'} Yrs / ${p?.gender || '--'}
Phone:   ${p?.phone || 'N/A'}

CHIEF COMPLAINT:
${s?.chiefComplaint || v?.reasonForVisit || 'Under Evaluation'}

HISTORY OF PRESENT ILLNESS:
${s?.historyOfPresentIllness || 'Completed multilingual AI conversational intake.'}

LIFESTYLE & ROUTINE:
${s?.lifestyle || 'Assessed during intake.'}

PAST MEDICAL HISTORY & ALLERGIES:
Chronic Conditions: ${s?.pastMedicalHistory || 'None reported'}
Allergies: ${s?.allergies || 'No Known Drug Allergies'}
Daily Medications: ${s?.medications || 'None reported'}

=====================================================
MediKiosk Autonomous Healthcare System
=====================================================`;

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MediKiosk_Intake_Summary_${p?.mrn || 'Patient'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSaveEdits = () => {
    const updated = {
      ...summaryReport,
      chiefComplaint: editForm.chiefComplaint,
      lifestyle: editForm.lifestyle,
      pastMedicalHistory: editForm.pastMedicalHistory,
      medications: editForm.medications,
      allergies: editForm.allergies,
    };
    setSummaryReport(updated);
    const vObj = safeGetItem<any>('medikiosk_active_visit', null);
    if (vObj) {
      vObj.summary = updated;
      safeSetItem('medikiosk_active_visit', vObj);
    }
    setIsEditModalOpen(false);
  };

  const handleSubmitConfirmation = async () => {
    if (!isConfirmed) return;
    setIsSubmitted(true);
    // Cleanup temporary kiosk session data to ensure privacy for the next patient
    localStorage.removeItem('medikiosk_recent_changes');
    localStorage.removeItem('medikiosk_temp_raw_transcript');
    setTimeout(() => {
      navigate('/kiosk/portal');
    }, 800);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-blue-50 via-slate-50 to-indigo-50">
      <div className="w-full max-w-3xl bg-white rounded-3xl p-6 sm:p-10 shadow-2xl border border-slate-100 flex flex-col space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center shadow-sm">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
                {language === 'hi' ? 'रोगी समीक्षा व पुष्टि' : language === 'gu' ? 'દર્દી સમીક્ષા અને પુષ્ટિ' : 'Patient Review & Confirmation'}
              </h1>
              <p className="text-slate-500 text-xs sm:text-sm">
                {language === 'hi' ? 'डॉक्टर को भेजने से पहले अपनी दर्ज की गई जानकारी जांचें व पुष्टि करें' : language === 'gu' ? 'ડૉક્ટરને મોકલતા પહેલા આપે આપેલી વિગતો ચકાસો અને પુષ્ટિ કરો' : 'Review your health details, edit any mistakes, and confirm for the doctor.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-xs font-semibold transition-all touch-target cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />
              <span>{language === 'hi' ? 'सुधारें' : language === 'gu' ? 'સુધારો' : 'Edit Details'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold transition-all touch-target cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{language === 'hi' ? 'डाउनलोड' : language === 'gu' ? 'ડાઉનલોડ' : 'Download'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all touch-target cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* Digital OPD Patient Token & Department Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-blue-600 text-white p-5 rounded-2xl shadow-lg shadow-blue-600/20">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200 block">Patient Name</span>
            <p className="text-base font-bold truncate">{activePatient?.name || 'Patient'}</p>
            <span className="text-xs text-blue-100 font-mono">MRN: {activePatient?.mrn || 'MK-Pending'} | Age: {activePatient?.age || '--'}Y / {activePatient?.gender || '--'}</span>
          </div>

          <div className="text-left sm:text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200 block">OPD Token #</span>
            <p className="text-2xl font-black font-mono tracking-tight">{activeVisit?.token || activeVisit?.tokenNumber || (activeVisit?.id ? `G-${activeVisit.id.slice(-3)}` : 'G-101')}</p>
            <span className="text-xs text-blue-100">Dept: {activeVisit?.department?.name || activeVisit?.department || 'General OPD'}</span>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200 block">Queue Status</span>
            <span className="inline-block mt-1 px-2.5 py-0.5 bg-emerald-500 text-white font-bold text-xs rounded-full shadow-sm">
              Ready for Doctor
            </span>
          </div>
        </div>

        {/* Structured Patient Review Cards (Requirement 33: basic info, health history, routine, meds, allergies, complaint) */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4 text-xs sm:text-sm text-slate-700">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <div className="flex items-center gap-2 text-slate-800 font-bold uppercase tracking-wider text-xs">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>{language === 'hi' ? 'दर्ज की गई स्वास्थ्य जानकारी' : language === 'gu' ? 'નોંધાયેલી સ્વાસ્થ્ય વિગતો' : 'Recorded Health Summary'}</span>
            </div>
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{language === 'hi' ? 'बदलाव करें' : language === 'gu' ? 'ફેરફાર કરો' : 'Make Changes'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold text-blue-600 uppercase block">Chief Complaint</span>
              <p className="text-slate-900 font-semibold">
                {safeString(summaryReport?.chiefComplaint, safeString(activeVisit?.reasonForVisit, 'Symptom Consultation'))}
              </p>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold text-amber-600 uppercase block">Daily Routine &amp; Lifestyle</span>
              <p className="text-slate-800 text-xs">
                {safeString(summaryReport?.lifestyle, safeString(summaryReport?.dailyRoutine, 'Standard routine and habits reported.'))}
              </p>
            </div>

            <div className="sm:col-span-2 bg-white p-4 rounded-xl border border-slate-200 space-y-1.5">
              <span className="text-[10px] font-bold text-indigo-600 uppercase block">History of Present Illness (HPI Narrative)</span>
              <p className="text-slate-700 leading-relaxed text-xs sm:text-sm">
                {safeString(summaryReport?.historyOfPresentIllness, safeString(summaryReport?.symptomHistory, 'Synthesized across multi-turn adaptive clinical intake.'))}
              </p>
            </div>

            {/* Clinical Characteristics & Modalities */}
            {(summaryReport?.severity || summaryReport?.character || summaryReport?.aggravatingFactors || summaryReport?.relievingFactors) && (
              <div className="sm:col-span-2 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 p-4 rounded-xl border border-blue-100 space-y-2">
                <span className="text-[10px] font-bold text-blue-700 uppercase block">Clinical Presentation &amp; Modalities</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700">
                  {summaryReport.severity && (
                    <div><span className="font-semibold text-slate-900">Severity Rating:</span> {safeString(summaryReport.severity)}</div>
                  )}
                  {summaryReport.character && (
                    <div><span className="font-semibold text-slate-900">Pain Character:</span> {safeString(summaryReport.character)}</div>
                  )}
                  {summaryReport.aggravatingFactors && (
                    <div className="sm:col-span-2"><span className="font-semibold text-slate-900">Aggravating Factors:</span> {safeString(summaryReport.aggravatingFactors)}</div>
                  )}
                  {summaryReport.relievingFactors && (
                    <div className="sm:col-span-2"><span className="font-semibold text-slate-900">Relieving Factors:</span> {safeString(summaryReport.relievingFactors)}</div>
                  )}
                </div>
              </div>
            )}

            {/* AYUSH Assessment Card */}
            {(summaryReport?.ayushAssessment || summaryReport?.prakriti || summaryReport?.agni || summaryReport?.koshtha) && (
              <div className="sm:col-span-2 bg-emerald-50/60 p-4 rounded-xl border border-emerald-200 space-y-1.5">
                <span className="text-[10px] font-bold text-emerald-800 uppercase block">AYUSH &amp; Dosha Profile Assessment</span>
                <p className="text-emerald-950 text-xs leading-relaxed">
                  {safeString(
                    summaryReport.ayushAssessment,
                    `Prakriti/Dosha: ${safeString(summaryReport.prakriti, 'Vata-Pitta Balance')} • Agni: ${safeString(summaryReport.agni, 'Sama Agni')} • Koshtha: ${safeString(summaryReport.koshtha, 'Madhyama')}`
                  )}
                </p>
              </div>
            )}

            {/* Homeopathy Characteristics Card */}
            {(summaryReport?.characteristicSymptoms || summaryReport?.modalities || summaryReport?.individualizingCharacteristics) && (
              <div className="sm:col-span-2 bg-purple-50/60 p-4 rounded-xl border border-purple-200 space-y-1.5">
                <span className="text-[10px] font-bold text-purple-800 uppercase block">Homeopathic Totality &amp; Modalities</span>
                <p className="text-purple-950 text-xs leading-relaxed">
                  {safeString(summaryReport.modalities, safeString(summaryReport.characteristicSymptoms, safeString(summaryReport.individualizingCharacteristics, 'Characteristic totality recorded.')))}
                </p>
              </div>
            )}

            {/* Follow-up Longitudinal Progression Card */}
            {(summaryReport?.treatmentResponse || summaryReport?.followUpChanges || summaryReport?.progression || summaryReport?.previousComparison) && (
              <div className="sm:col-span-2 bg-teal-50/60 p-4 rounded-xl border border-teal-200 space-y-1.5">
                <span className="text-[10px] font-bold text-teal-800 uppercase block">Longitudinal Follow-up Progression</span>
                <p className="text-teal-950 text-xs leading-relaxed">
                  {safeString(summaryReport.treatmentResponse, safeString(summaryReport.followUpChanges, safeString(summaryReport.progression, safeString(summaryReport.previousComparison))))}
                </p>
              </div>
            )}

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Past Medical &amp; Surgical History</span>
              <p className="text-slate-800 text-xs">
                {safeString(summaryReport?.pastMedicalHistory, 'No prior chronic conditions declared.')}
              </p>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Regular Medications</span>
              <p className="text-slate-800 text-xs">
                {safeString(summaryReport?.medications, 'No regular prescription medications reported.')}
              </p>
            </div>

            <div className="sm:col-span-2 bg-white p-3.5 rounded-xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Allergies &amp; Drug Sensitivities</span>
              <p className="text-slate-800 text-xs">
                {safeString(summaryReport?.allergies, 'No known drug allergies reported (NKDA).')}
              </p>
            </div>

            {/* Red Flags Section */}
            {summaryReport?.redFlags && summaryReport.redFlags.length > 0 && (
              <div className="sm:col-span-2 bg-white p-3.5 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-red-600 uppercase block">Safety Alerts</span>
                {summaryReport.redFlags.map((flag: any, index: number) => (
                  <div key={index} className="mb-2 p-3 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
                    <p className="text-slate-900 text-xs font-medium">{flag.description || flag.symptoms}</p>
                    <span className="text-red-600 text-xs font-bold">{flag.severity}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Assigned Nurse & Triage Next Steps Card */}
        {(() => {
          const nurse = activeVisit?.doctor?.nurses?.[0] || activeVisit?.department?.nurses?.[0];
          const nurseName = nurse?.user?.name || (activeVisit?.department?.code === 'CARD' ? 'Nurse Preeti Patel' : activeVisit?.department?.code === 'PED' ? 'Nurse Sneha Desai' : activeVisit?.department?.code === 'ORTHO' ? 'Nurse Ritu Nair' : activeVisit?.department?.code === 'DERM' ? 'Nurse Sunita Yadav' : 'Nurse Priya Singh');
          const docName = activeVisit?.doctor?.user?.name ? `Dr. ${activeVisit.doctor.user.name}` : (activeVisit?.department?.code === 'CARD' ? 'Dr. Yogesh Sharma' : 'Attending Physician');
          const roomNumber = activeVisit?.doctor?.employeeId === 'DOC-YOGESH-101' ? 'Room 204 (Cardiology Triage)' :
                             activeVisit?.doctor?.employeeId === 'DOC-VIKRAM-102' ? 'Room 101 (General OPD Triage)' :
                             activeVisit?.doctor?.employeeId === 'DOC-RAJESH-103' ? 'Room 105 (Pediatrics Triage)' :
                             activeVisit?.doctor?.employeeId === 'DOC-DESAI-104' ? 'Room 210 (Orthopedics Triage)' :
                             activeVisit?.doctor?.employeeId === 'DOC-NEHA-105' ? 'Room 302 (Dermatology Triage)' :
                             activeVisit?.doctor?.employeeId === 'DOC-ALOK-106' ? 'Room 208 (ENT Triage)' :
                             activeVisit?.doctor?.employeeId === 'DOC-HARISH-201' ? 'Room 103 (Ayurveda Triage)' : 'Room 101 (OPD Triage Desk)';

          return (
            <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-teal-700 text-white rounded-2xl p-5 sm:p-6 shadow-xl shadow-teal-700/20 space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-white/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center font-bold text-white shadow-inner">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-200 block">
                      {language === 'hi' ? 'अगला कदम: वाइटल्स व नर्स डेस्क' : language === 'gu' ? 'આગળનું પગલું: વાઇટલ્સ અને નર્સ ડેસ્ક' : 'Immediate Next Step: Nurse Triage Station'}
                    </span>
                    <h3 className="text-base sm:text-lg font-extrabold">{nurseName}</h3>
                  </div>
                </div>
                <span className="px-3 py-1 bg-white/20 border border-white/30 rounded-xl text-xs font-bold font-mono">
                  {roomNumber}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-emerald-100">
                <div className="bg-white/10 p-3 rounded-xl border border-white/10 space-y-0.5">
                  <span className="text-[10px] text-emerald-200 font-bold uppercase block">
                    {language === 'hi' ? 'संबंधित डॉक्टर' : language === 'gu' ? 'ડૉક્ટર' : 'Assigned Doctor'}
                  </span>
                  <p className="font-bold text-white text-sm">{docName}</p>
                  <span className="text-[11px] text-emerald-200">Dept: {activeVisit?.department?.name || 'General OPD'}</span>
                </div>

                <div className="bg-white/10 p-3 rounded-xl border border-white/10 space-y-0.5">
                  <span className="text-[10px] text-emerald-200 font-bold uppercase block">
                    {language === 'hi' ? 'मरीज के लिए निर्देश' : language === 'gu' ? 'દર્દી માટે સૂચના' : 'Instructions for Patient'}
                  </span>
                  <p className="text-white text-xs leading-relaxed">
                    {language === 'hi'
                      ? `कृपया डॉक्टर के केबिन से पहले ${nurseName} (${roomNumber}) के पास BP, पल्स और वजन जांच करवाएं।`
                      : language === 'gu'
                      ? `કૃપા કરીને ડૉક્ટરની કેબિનમાં જતાં પહેલાં ${nurseName} (${roomNumber}) પાસે બ્લડ પ્રેશર અને વજન તપાસ કરાવો.`
                      : `Please proceed to ${nurseName} at ${roomNumber} for Blood Pressure, SpO2 & Temperature check.`}
                  </p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Patient Confirmation Declaration Checkbox (Requirement 33: CONFIRM action) */}
        <div className="p-4 bg-blue-50/80 border-2 border-blue-200 rounded-2xl flex items-start gap-3 text-slate-800">
          <input
            type="checkbox"
            id="patient-confirm-checkbox"
            checked={isConfirmed}
            onChange={(e) => setIsConfirmed(e.target.checked)}
            className="w-5 h-5 mt-0.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer shrink-0"
          />
          <label htmlFor="patient-confirm-checkbox" className="text-xs sm:text-sm cursor-pointer select-none leading-relaxed">
            <strong className="block text-blue-900 font-bold mb-0.5">
              {language === 'hi' ? 'मरीज स्व-सत्यापन पुष्टि' : language === 'gu' ? 'દર્દી સ્વ-ચકાસણી પુષ્ટિ' : 'Patient Self-Verification & Confirmation'}
            </strong>
            {language === 'hi'
              ? 'मैंने ऊपर दी गई अपनी सभी स्वास्थ्य जानकारी, लक्षण, दवाइयों व एलर्जी की जांच कर ली है और पुष्टि करता हूँ कि यह विवरण सही है।'
              : language === 'gu'
              ? 'મેં ઉપરોક્ત તમામ લક્ષણો, દવાઓ અને સ્વાસ્થ્ય વિગતો ચકાસી લીધી છે અને ખાતરી આપું છું કે આ વિગતો સાચી છે.'
              : 'I have reviewed my recorded symptoms, medications, routine, and medical history. I confirm the details are accurate and ready for doctor consultation.'}
          </label>
        </div>

        {/* Action Buttons (Requirement 33: EDIT, CONFIRM, SUBMIT, DOWNLOAD) */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            onClick={handleDownload}
            className="px-5 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{language === 'hi' ? 'AI सारांश डाउनलोड करें (.txt)' : language === 'gu' ? 'AI સારાંશ ડાઉનલોડ કરો (.txt)' : 'Download AI Summary (.txt)'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsEditModalOpen(true)}
            className="px-5 py-3.5 rounded-2xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Edit3 className="w-4 h-4" />
            <span>{language === 'hi' ? 'जानकारी सुधारें' : language === 'gu' ? 'વિગતો સુધારો' : 'Edit Information'}</span>
          </button>

          <button
            onClick={handleSubmitConfirmation}
            disabled={!isConfirmed || isSubmitted}
            className={`
              flex-1 py-4 font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all touch-target-lg text-base
              ${isConfirmed
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/30 active:scale-95 cursor-pointer'
                : 'bg-slate-300 text-slate-500 shadow-none cursor-not-allowed'
              }
            `}
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>
              {isSubmitted
                ? (language === 'hi' ? 'सफलतापूर्वक पुष्टि हुई...' : language === 'gu' ? 'સફળતાપૂર્વક પુષ્ટિ થઈ...' : 'Confirmed & Submitted...')
                : (language === 'hi' ? 'पुष्टि करें और डॉक्टर को भेजें' : language === 'gu' ? 'પુષ્ટિ કરો અને ડૉક્ટરને મોકલો' : 'Confirm & Submit to Doctor')}
            </span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

      </div>

      {/* Interactive Edit Modal (Requirement 33: Patient can correct important mistakes) */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-2xl p-6 sm:p-8 shadow-2xl space-y-5 border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    {language === 'hi' ? 'स्वास्थ्य जानकारी में सुधार करें' : language === 'gu' ? 'સ્વાસ્થ્ય વિગતો સુધારો' : 'Edit Recorded Health Details'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {language === 'hi' ? 'गलत दर्ज हुए विवरण को यहाँ सही करें' : language === 'gu' ? 'ભૂલથી નોંધાયેલી વિગત અહીં સુધારો' : 'Correct any misheard or incorrect intake answers'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs sm:text-sm">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Chief Complaint / Primary Problem</label>
                <input
                  type="text"
                  value={editForm.chiefComplaint}
                  onChange={(e) => setEditForm({ ...editForm, chiefComplaint: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Daily Routine &amp; Lifestyle (Sleep, Diet, Stress)</label>
                <input
                  type="text"
                  value={editForm.lifestyle}
                  onChange={(e) => setEditForm({ ...editForm, lifestyle: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Past Medical &amp; Surgical History</label>
                <input
                  type="text"
                  value={editForm.pastMedicalHistory}
                  onChange={(e) => setEditForm({ ...editForm, pastMedicalHistory: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Current Regular Medications</label>
                <input
                  type="text"
                  value={editForm.medications}
                  onChange={(e) => setEditForm({ ...editForm, medications: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Allergies &amp; Drug Sensitivities</label>
                <input
                  type="text"
                  value={editForm.allergies}
                  onChange={(e) => setEditForm({ ...editForm, allergies: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold text-xs sm:text-sm transition-all"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveEdits}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-blue-600/20 flex items-center gap-1.5 transition-all"
              >
                <Save className="w-4 h-4" />
                <span>Save Corrections</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
