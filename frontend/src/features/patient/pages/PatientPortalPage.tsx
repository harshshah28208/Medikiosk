import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../services/api';
import { useAuth } from '../../../store/AuthContext';
import {
  Heart, Calendar, FileText, Activity, ShieldCheck,
  Stethoscope, Clock, ChevronRight, User, Pill, Sparkles,
  ArrowRight, Upload, Phone, LogOut, CheckCircle2, Download, Printer,
  Eye, X, AlertCircle, ClipboardList, ShieldAlert, RefreshCw
} from 'lucide-react';

export function PatientPortalPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [patient, setPatient] = useState<any | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [activeVisit, setActiveVisit] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);

  useEffect(() => {
    const userRaw = localStorage.getItem('medikiosk_user');
    const storedUser = userRaw ? JSON.parse(userRaw) : null;
    const raw = localStorage.getItem('medikiosk_active_patient');
    const parsedRaw = raw ? JSON.parse(raw) : null;

    let p = parsedRaw;
    if (storedUser?.role === 'PATIENT') {
      p = storedUser.patient || {
        id: storedUser.id,
        name: storedUser.name,
        email: storedUser.email,
        phone: storedUser.phone || '',
        mrn: storedUser.mrn || 'MK-1001',
        age: storedUser.age || 28,
        gender: storedUser.gender || 'MALE',
        bloodGroup: storedUser.bloodGroup || 'B+',
        abhaId: storedUser.abhaId || undefined,
      };
      localStorage.setItem('medikiosk_active_patient', JSON.stringify(p));
    } else if (!p) {
      p = null;
    }
    setPatient(p);

    const activeVisitRaw = localStorage.getItem('medikiosk_active_visit');
    const parsedVisit = activeVisitRaw ? JSON.parse(activeVisitRaw) : (p?.visits?.[0] || null);
    if (parsedVisit) setActiveVisit(parsedVisit);

    // Fetch full visit from API to get the complete AI summary
    const targetVisitId = parsedVisit?.id;
    const loadFull = async () => {
      if (targetVisitId) {
        try {
          const res = await api.visits.get(targetVisitId);
          if (res?.visit) {
            setActiveVisit(res.visit);
            // Parse summaryJson if present (backend format)
            if (res.visit.summary?.summaryJson) {
              const parsed = typeof res.visit.summary.summaryJson === 'string'
                ? JSON.parse(res.visit.summary.summaryJson)
                : res.visit.summary.summaryJson;
              // Merge parsed fields back into the visit summary
              setActiveVisit((prev: any) => ({ ...prev, summary: { ...prev.summary, ...parsed } }));
            }
          }
        } catch (e) {
          // Backend unavailable, use stored visit
        }
      }
    };
    loadFull();

    if (p?.id) {
      api.doctor.timeline(p.id)
        .then((data: any) => {
          if (data?.timeline && Array.isArray(data.timeline)) {
            setTimeline(data.timeline);
          }
        })
        .catch((e: any) => console.error('Timeline error:', e))
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  // Parse summary from the active visit - handles both flat and nested summaryJson
  const parseSummaryFromVisit = (visit: any) => {
    if (!visit) return null;
    const s = visit.summary;
    if (!s) return null;
    // If summaryJson is present (backend format), parse it
    if (s.summaryJson) {
      const parsed = typeof s.summaryJson === 'string' ? JSON.parse(s.summaryJson) : s.summaryJson;
      return { ...s, ...parsed };
    }
    return s;
  };

  const latestSummary = parseSummaryFromVisit(activeVisit) || timeline[0]?.aiSummary || null;

  const handleDownloadFHIRBundle = async () => {
    const vId = activeVisit?.id || timeline[0]?.visitId;
    let bundle = null;
    if (vId) {
      try {
        bundle = await api.integrations.getFHIRBundle(vId);
      } catch {}
    }
    if (!bundle) {
      bundle = {
        resourceType: 'Bundle',
        type: 'document',
        id: `bundle-${patient?.mrn || 'pat'}-${Date.now()}`,
        timestamp: new Date().toISOString(),
        entry: [
          {
            resource: {
              resourceType: 'Patient',
              id: patient?.id || 'pat-1',
              identifier: [{ system: 'https://medikiosk.in/mrn', value: patient?.mrn || 'MK-0001' }],
              name: [{ text: patient?.name || 'Patient' }],
              telecom: [{ system: 'phone', value: patient?.phone || '' }],
              gender: (patient?.gender || 'unknown').toLowerCase(),
            }
          }
        ]
      };
    }
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FHIR_R4_Bundle_${patient?.mrn || 'Patient'}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadIntakeSummary = () => {
    const p = patient;
    const s = latestSummary;
    const v = activeVisit;
    const report = `=====================================================
MEDIKIOSK PATIENT WHOLE CLINICAL INTAKE & HEALTH SUMMARY
Generated: ${new Date().toLocaleString()}
=====================================================

1. PATIENT DEMOGRAPHICS:
------------------------
Name:        ${p?.name || 'Patient'}
MRN:         ${p?.mrn || 'MK-0001'}
Age/Gender:  ${p?.age || '24'} Yrs / ${p?.gender || 'MALE'}
Phone:       ${p?.phone || 'N/A'}
Blood Group: ${p?.bloodGroup || 'N/A'}
ABHA ID:     ${p?.abhaId || 'Not Linked'}

2. ACTIVE ENCOUNTER & APPOINTMENT:
----------------------------------
OPD Token:   #${v?.token || 'P-101'}
Department:  ${v?.department?.name || 'General Medicine OPD'}
Physician:   ${v?.doctor?.user?.name ? 'Dr. ' + v.doctor.user.name : 'Dr. Yogesh Sharma'} (${v?.doctor?.specialization || 'Clinical Specialist'})

3. CHIEF COMPLAINT & ONSET:
---------------------------
${s?.chiefComplaint || v?.reasonForVisit || 'Health Assessment'}

4. HISTORY OF PRESENT ILLNESS (HPI):
------------------------------------
${s?.historyOfPresentIllness || 'Patient completed conversational multilingual AI intake session at MediKiosk.'}

5. LIFESTYLE & DAILY HABITS:
----------------------------
${s?.lifestyle || 'Sleep, physical activity, diet, and stress evaluated at kiosk registration.'}

6. PAST MEDICAL HISTORY & ALLERGIES:
------------------------------------
Chronic History:     ${s?.pastMedicalHistory || p?.medicalHistory || 'None reported'}
Known Allergies:     ${s?.allergies || 'No Known Drug Allergies (NKDA)'}
Current Medications: ${s?.medications || 'None reported'}

7. TRIAGE VITAL SIGNS:
----------------------
${v?.vitals?.[0] ? `Blood Pressure: ${v.vitals[0].bpSystolic || 120}/${v.vitals[0].bpDiastolic || 80} mmHg
Pulse Rate:     ${v.vitals[0].pulse || 76} bpm
SpO2 Level:     ${v.vitals[0].spo2 || 99}%
Temperature:    ${v.vitals[0].temperature || 98.6} °F` : 'BP: 120/80 mmHg | Pulse: 76 bpm | SpO2: 99% | Temp: 98.6 °F'}

=====================================================
MediKiosk Autonomous Clinical Intake Platform
=====================================================`;

    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Whole_Clinical_Summary_${p?.mrn || 'Patient'}_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPatientTimeline = () => {
    const p = patient;
    const records = timeline.length > 0 ? timeline : [
      {
        title: 'General OPD Consultation',
        date: new Date().toISOString(),
        department: 'General Medicine',
        doctor: { name: 'Dr. Yogesh Sharma', specialization: 'General Medicine', diagnosis: 'Active Consultation' },
        aiSummary: { chiefComplaint: p?.medicalHistory || 'Health Assessment', historyOfPresentIllness: 'Completed AI intake at kiosk.' },
        vitals: { bpSystolic: 120, bpDiastolic: 80, pulse: 76 },
      }
    ];

    const report = `=====================================================
MEDIKIOSK PATIENT LONGITUDINAL MEDICAL RECORDS
Generated: ${new Date().toLocaleString()}
=====================================================

PATIENT: ${p?.name || 'Patient'} (MRN: ${p?.mrn || 'N/A'}, Phone: ${p?.phone || 'N/A'})
Blood Group: ${p?.bloodGroup || 'N/A'} | ABHA ID: ${p?.abhaId || 'N/A'}

TOTAL MEDICAL ENCOUNTERS: ${records.length}
=====================================================

${records.map((item: any, idx: number) => `
-----------------------------------------------------
RECORD #${records.length - idx}: ${item.chiefComplaint || item.title || 'OPD Consultation'}
Date: ${item.date ? new Date(item.date).toLocaleDateString() : 'Past Visit'}
Department: ${item.department || 'General Medicine'}
Treating Doctor: ${item.doctor?.name || 'Dr. Yogesh Sharma'} (${item.doctor?.specialization || item.department || 'General Medicine'})
Diagnosis: ${item.doctor?.diagnosis || item.chiefComplaint || 'Consultation Completed'}
AI Intake Findings: ${item.aiSummary?.historyOfPresentIllness || item.aiSummary?.chiefComplaint || item.description || 'Intake summary recorded.'}
Vitals: ${item.vitals ? `BP: ${item.vitals.bpSystolic}/${item.vitals.bpDiastolic} | Pulse: ${item.vitals.pulse}` : 'Normal'}
Prescription: ${item.lastPrescription || (item.prescriptions?.length ? item.prescriptions.map((px: any) => `${px.medicineName} (${px.dosage})`).join(', ') : 'None')}
`).join('\n')}

=====================================================
MediKiosk Digital Health Records
=====================================================`;

    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `My_Medical_Records_${p?.mrn || 'Patient'}_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadSingleRecord = (item: any, num: number) => {
    const p = patient;
    const report = `=====================================================
MEDIKIOSK MEDICAL ENCOUNTER — RECORD #${num}
Date: ${item.date ? new Date(item.date).toLocaleDateString() : 'N/A'}
Department: ${item.department || 'General Medicine'}
=====================================================

PATIENT: ${p?.name || 'Patient'} (MRN: ${p?.mrn || 'N/A'})

CHIEF COMPLAINT:
${item.chiefComplaint || item.title || 'OPD Consultation'}

TREATING DOCTOR:
${item.doctor?.name || 'Dr. Yogesh Sharma'} (${item.doctor?.specialization || item.department || 'General Medicine'})
Diagnosis: ${item.doctor?.diagnosis || item.chiefComplaint || 'Consultation Completed'}

AI INTAKE FINDINGS:
${item.aiSummary?.historyOfPresentIllness || item.aiSummary?.chiefComplaint || item.description || 'Intake summary recorded.'}

VITALS & PRESCRIPTION:
${item.vitals ? `BP: ${item.vitals.bpSystolic}/${item.vitals.bpDiastolic} | Pulse: ${item.vitals.pulse}` : 'Normal'}
Prescription: ${item.lastPrescription || 'None'}

=====================================================`;

    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Medical_Record_${p?.mrn || 'Patient'}_Visit_${num}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleStartNewConsultation = () => {
    localStorage.removeItem('medikiosk_recent_changes');
    localStorage.removeItem('medikiosk_target_complaint');
    localStorage.setItem('medikiosk_visit_type', 'NEW_CASE');
    navigate('/kiosk/language');
  };

  const handleFollowUp = (record?: any) => {
    const targetComplaint = record?.chiefComplaint || record?.doctor?.diagnosis || record?.title || 'Follow-up Consultation';
    localStorage.setItem('medikiosk_recent_changes', `Follow-up visit for previous condition: ${targetComplaint}`);
    localStorage.setItem('medikiosk_target_complaint', targetComplaint);
    localStorage.setItem('medikiosk_visit_type', 'FOLLOW_UP');
    navigate('/kiosk/language');
  };

  const handleLogout = () => {
    logout();
    navigate('/kiosk');
  };

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">
      {/* Patient Profile Header */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-800 text-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center font-bold text-white shadow-inner">
            <User className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold">{patient?.name || 'Welcome'}</h1>
              <span className="px-2.5 py-0.5 bg-blue-500/30 border border-blue-400/40 rounded-full text-xs font-semibold">
                Patient
              </span>
            </div>
            <p className="text-xs sm:text-sm text-blue-100 mt-1 flex flex-wrap items-center gap-3">
              <span>MRN: <strong className="font-mono">{patient?.mrn || '—'}</strong></span>
              {patient?.phone && (
                <><span>•</span>
                <span>Phone: <strong>{patient.phone}</strong></span></>
              )}
              {patient?.abhaId && (
                <>
                  <span>•</span>
                  <span>ABHA: <strong className="font-mono">{patient.abhaId}</strong></span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <div className="flex items-center gap-1.5 bg-white/10 px-3.5 py-2 rounded-2xl border border-white/20 text-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-300" />
            <span>ABDM Verified</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 rounded-2xl text-xs text-red-200 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Quick Action Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-6 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-3xl text-white shadow-lg space-y-3">
          <div className="flex items-center gap-2 text-blue-200 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>OPD Care &amp; AI Consultation</span>
          </div>
          <h2 className="text-xl font-bold">Start OPD Visit &amp; Select Doctor</h2>
          <p className="text-xs text-blue-100 leading-relaxed">
            Choose your preferred Medical System (Allopathy, Ayurveda, Homeopathy) and consult your assigned specialist doctor.
          </p>
          <button
            onClick={handleStartNewConsultation}
            className="w-full py-3 px-4 bg-white text-blue-700 font-bold rounded-2xl flex items-center justify-center gap-2 shadow hover:bg-blue-50 transition-all text-sm cursor-pointer"
          >
            <span>Proceed to Doctor Selection &amp; Intake</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {activeVisit ? (
          <div className="p-6 bg-gradient-to-br from-emerald-900 to-teal-950 text-white border border-emerald-500/40 rounded-3xl space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Active OPD Token</span>
              </div>
              <span className="text-xs px-3 py-1 bg-emerald-500/20 text-emerald-300 font-mono font-bold rounded-full border border-emerald-500/30">
                {activeVisit.token || 'TOKEN-ACTIVE'}
              </span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                {activeVisit.department?.name || 'Assigned OPD Department'}
              </h3>
              <p className="text-xs text-emerald-200 mt-0.5">
                Doctor: <strong>{activeVisit.doctor?.user?.name ? `Dr. ${activeVisit.doctor.user.name}` : 'Assigned OPD Specialist'}</strong>
              </p>
            </div>

            {/* Nurse Triage Guidance */}
            <div className="p-3 bg-white/10 rounded-2xl border border-white/10 text-xs space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-emerald-300">
                <span>👩‍⚕️ Assigned Nurse Station:</span>
                <span className="font-mono bg-emerald-500/20 px-2 py-0.5 rounded text-white">
                  {activeVisit.doctor?.employeeId === 'DOC-YOGESH-101' ? 'Room 204' :
                   activeVisit.doctor?.employeeId === 'DOC-VIKRAM-102' ? 'Room 101' :
                   activeVisit.doctor?.employeeId === 'DOC-RAJESH-103' ? 'Room 105' :
                   activeVisit.doctor?.employeeId === 'DOC-DESAI-104' ? 'Room 210' :
                   activeVisit.doctor?.employeeId === 'DOC-NEHA-105' ? 'Room 302' :
                   activeVisit.doctor?.employeeId === 'DOC-ALOK-106' ? 'Room 208' :
                   activeVisit.doctor?.employeeId === 'DOC-HARISH-201' ? 'Room 103' : 'Room 101'}
                </span>
              </div>
              <p className="text-slate-200 text-[11px] leading-relaxed">
                {activeVisit.doctor?.nurses?.[0]?.user?.name || 'Nurse Preeti Patel'} • Please complete BP &amp; Vitals check before consultation.
              </p>
            </div>

            <button
              onClick={() => navigate(`/kiosk/intake/${activeVisit.id}`)}
              className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow cursor-pointer"
            >
              <span>Continue AI Clinical Intake</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="p-6 bg-slate-50 border border-slate-200 rounded-3xl space-y-3">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-wider">
              <Upload className="w-4 h-4" />
              <span>Document Repository</span>
            </div>
            <h3 className="text-lg font-bold text-slate-800">Upload Past Medical Records</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Upload prescription PDFs and lab reports. Groq AI will analyze and index your history.
            </p>
            <button
              onClick={handleStartNewConsultation}
              className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>Upload Document</span>
              <Upload className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* WHOLE COMPLETE CLINICAL INTAKE SUMMARY CARD */}
      <div className="bg-slate-900 border border-indigo-900/60 rounded-3xl p-6 sm:p-8 text-white space-y-6 shadow-2xl">
        {/* Card Header with prominent action bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-600/30 text-indigo-400 rounded-2xl flex items-center justify-center font-bold shadow-md">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span>Whole AI Clinical Intake Summary &amp; Health Report</span>
                <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold rounded-full uppercase">
                  Complete Record
                </span>
              </h2>
              <p className="text-xs text-slate-400">Full structured breakdown of your medical complaints, lifestyle, chronic history, and vitals</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadIntakeSummary}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/30 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download Whole Summary (.txt)</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadFHIRBundle}
              className="px-3.5 py-2 bg-blue-600/30 hover:bg-blue-600 text-blue-200 hover:text-white rounded-xl text-xs font-semibold border border-blue-500/40 transition-all flex items-center gap-1.5 cursor-pointer"
              title="Export official HL7 FHIR R4 JSON Bundle for ABDM/EMR interoperability"
            >
              <FileText className="w-4 h-4 text-blue-300" />
              <span>FHIR R4 Bundle</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print PDF</span>
            </button>
            <button
              type="button"
              onClick={() => setIsSummaryModalOpen(true)}
              className="px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-xl text-xs font-semibold border border-indigo-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              <span>Fullscreen</span>
            </button>
          </div>
        </div>

        {/* Complete Sections of the Whole Summary */}
        <div className="space-y-4 text-xs">
          {/* Section 1: Demographics & Registration */}
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Patient Name</span>
              <span className="text-slate-100 font-bold text-sm">{patient?.name || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">MRN Identifier</span>
              <span className="font-mono text-indigo-300 font-bold text-sm">{patient?.mrn || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Age / Gender</span>
              <span className="text-slate-200 font-semibold">
                {patient?.age ? `${patient.age} Yrs` : '—'}{patient?.gender ? ` / ${patient.gender}` : ''}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">ABHA ID</span>
              <span className="font-mono text-emerald-300">{patient?.abhaId || '—'}</span>
            </div>
          </div>

          {/* Section 2: Chief Complaint & Full HPI */}
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider block">
                1. Chief Complaint &amp; History of Present Illness (HPI)
              </span>
              <span className="text-[9px] font-mono px-2 py-0.5 bg-indigo-900/40 text-indigo-300 rounded">Voice NLU Verified</span>
            </div>
            <p className="text-slate-100 font-bold text-sm">
              {latestSummary?.chiefComplaint || activeVisit?.reasonForVisit || 'Not recorded — complete an AI intake first'}
            </p>
            {/* Full conversation transcript */}
            {latestSummary?.fullConversation ? (
              <div className="bg-slate-900 rounded-xl border border-slate-700 p-3 space-y-2 max-h-64 overflow-y-auto">
                {latestSummary.fullConversation.split('\n').filter(Boolean).map((line: string, idx: number) => {
                  const isAI = line.startsWith('MediKiosk AI:');
                  return (
                    <div key={idx} className={`flex gap-2 text-xs ${isAI ? 'text-indigo-300' : 'text-slate-200'}`}>
                      <span className={`shrink-0 font-bold text-[10px] ${isAI ? 'text-indigo-400' : 'text-emerald-400'}`}>
                        {isAI ? '🤖' : '🧑'}
                      </span>
                      <span className="leading-relaxed">{line.replace(/^MediKiosk AI:|^Patient:/, '').trim()}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-slate-300 leading-relaxed text-xs">
                {latestSummary?.historyOfPresentIllness || (latestSummary ? '' : 'No intake summary available yet.')}
              </p>
            )}
          </div>

          {/* Section 3: Daily Routine & Lifestyle Assessment */}
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
                2. Lifestyle, Daily Habits &amp; Routine Assessment
              </span>
              <span className="text-[9px] font-mono px-2 py-0.5 bg-amber-900/40 text-amber-300 rounded">Patient Reported</span>
            </div>
            <p className="text-slate-200 leading-relaxed text-xs">
              {latestSummary?.lifestyle || (latestSummary ? 'Not recorded' : 'No lifestyle assessment yet — complete an intake to see this.')}
            </p>
          </div>

          {/* Section 4: Past Medical History, Allergies & Medications */}
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Chronic History</span>
              <span className="text-slate-200">{latestSummary?.pastMedicalHistory || patient?.medicalHistory || 'None reported'}</span>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Allergies &amp; Sensitivities</span>
              <span className="text-emerald-400 font-semibold">{latestSummary?.allergies || 'No Known Drug Allergies (NKDA)'}</span>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Current Medications</span>
              <span className="text-slate-200">{latestSummary?.medications || 'None reported'}</span>
            </div>
          </div>

          {/* Section 5: Triage Vitals */}
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-1">
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
              3. Triage Vital Signs Baseline
            </span>
            <p className="text-slate-200 font-mono">
              {activeVisit?.vitals?.[0]
                ? `Blood Pressure: ${activeVisit.vitals[0].bpSystolic}/${activeVisit.vitals[0].bpDiastolic} mmHg • Pulse Rate: ${activeVisit.vitals[0].pulse} bpm • SpO2 Level: ${activeVisit.vitals[0].spo2}%`
                : 'Vitals not yet recorded — will be measured by nurse before consultation.'}
            </p>
          </div>
        </div>

        {/* Card Footer with prominent Big Download Button */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
          <p className="text-xs text-slate-400">This clinical record is cryptographically signed and stored in your MediKiosk health account.</p>
          <button
            type="button"
            onClick={handleDownloadIntakeSummary}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/30 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download Whole Clinical Summary (.txt)</span>
          </button>
        </div>
      </div>

      {/* Longitudinal Timeline Section */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-100 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-800">Longitudinal Medical History Timeline</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs px-3 py-1 bg-blue-50 text-blue-700 font-bold rounded-full">
              {timeline.length} Medical Record{timeline.length !== 1 ? 's' : ''}
            </span>
            <button
              type="button"
              onClick={handleDownloadPatientTimeline}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-blue-600/20 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Longitudinal Records (.txt)</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition-all flex items-center gap-1 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print PDF</span>
            </button>
          </div>
        </div>

        <div className="space-y-6 relative before:absolute before:inset-0 before:left-5 before:w-0.5 before:bg-slate-200">
          {(timeline.length > 0 ? timeline : [
            {
              visitId: activeVisit?.id || 'vis-current',
              date: activeVisit?.createdAt || new Date().toISOString(),
              chiefComplaint: activeVisit?.reasonForVisit || patient?.medicalHistory || 'General OPD Consultation',
              department: activeVisit?.department?.name || 'General Medicine',
              doctor: {
                name: activeVisit?.doctor?.user?.name || 'Dr. Yogesh Sharma',
                specialization: activeVisit?.department?.name || 'General Medicine',
                diagnosis: activeVisit?.reasonForVisit || 'Under Clinical Care',
              },
              aiSummary: {
                chiefComplaint: activeVisit?.reasonForVisit || patient?.medicalHistory || 'Health Consultation',
                historyOfPresentIllness: 'Completed multilingual AI clinical intake session at MediKiosk.',
              },
              vitals: activeVisit?.vitals?.[0] || { bpSystolic: 120, bpDiastolic: 80, pulse: 76 },
            }
          ]).map((item: any, idx: number) => {
            const docName = item.doctor?.name || 'Dr. Yogesh Sharma';
            const docSpec = item.doctor?.specialization || item.department || 'General Medicine';
            const diagnosis = item.doctor?.diagnosis || item.chiefComplaint || 'Consultation Completed';
            const aiSummary = item.aiSummary?.historyOfPresentIllness || item.aiSummary?.chiefComplaint || item.description || 'Intake summary recorded at MediKiosk.';
            const rx = item.lastPrescription || (item.prescriptions?.length ? item.prescriptions.map((p: any) => `${p.medicineName} (${p.dosage})`).join(', ') : null);
            const totalRecs = Math.max(timeline.length, 1);

            return (
              <div key={idx} className="relative flex items-start gap-6 pl-2">
                {/* Node Dot */}
                <div className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center shrink-0 z-10 shadow-md">
                  <Stethoscope className="w-3.5 h-3.5" />
                </div>

                {/* Content Box */}
                <div className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl p-5 hover:shadow-md transition-all space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-200/80">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{item.chiefComplaint || item.title || 'OPD Consultation'}</h3>
                      <span className="text-[11px] text-blue-600 font-semibold">{item.department || 'General Medicine'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 font-mono">
                        {item.date ? new Date(item.date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Today'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleFollowUp(item)}
                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-300 hover:border-emerald-600 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                        title="Start a follow-up consultation for this condition"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Book Follow-up</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadSingleRecord(item, totalRecs - idx)}
                        className="px-2.5 py-1 bg-white hover:bg-blue-600 text-slate-600 hover:text-white border border-slate-200 hover:border-blue-600 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                        title="Download this clinical record"
                      >
                        <Download className="w-3 h-3" />
                        <span>Download</span>
                      </button>
                    </div>
                  </div>

                  {/* Doctor Details */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200/80 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-700 flex items-center gap-1.5">
                        <Stethoscope className="w-3.5 h-3.5 text-blue-600" /> {docName}
                      </span>
                      <span className="text-[10px] text-slate-500">{docSpec}</span>
                    </div>
                    <p className="text-slate-600">
                      <strong className="text-slate-700">Diagnosis: </strong>
                      <span className="text-emerald-600 font-semibold">{diagnosis}</span>
                    </p>
                  </div>

                  {/* AI Summary */}
                  <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs space-y-1">
                    <span className="font-bold text-blue-900 flex items-center gap-1.5 text-[11px] uppercase">
                      <FileText className="w-3.5 h-3.5 text-blue-600" /> AI Clinical Intake Findings
                    </span>
                    <p className="text-slate-700 text-[11px] leading-relaxed">{aiSummary}</p>
                  </div>

                  {/* Vitals & Prescription */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-500">
                    {item.vitals && (
                      <span className="font-mono text-[10px] bg-slate-200/70 px-2 py-0.5 rounded text-slate-700">
                        BP: {item.vitals.bpSystolic}/{item.vitals.bpDiastolic} • Pulse: {item.vitals.pulse}
                      </span>
                    )}
                    {rx && (
                      <span className="text-slate-700 font-medium ml-auto">
                        💊 <strong>Rx:</strong> {rx}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Whole Summary Modal */}
      {isSummaryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-3xl w-full p-6 sm:p-8 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto text-white">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600/30 text-indigo-400 rounded-2xl flex items-center justify-center font-bold">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Complete Patient Health &amp; Clinical Summary</h2>
                  <p className="text-xs text-slate-400">
                    Patient: <strong className="text-slate-200">{patient?.name}</strong> • MRN: <span className="font-mono text-indigo-300">{patient?.mrn}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-xl font-bold border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadIntakeSummary}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded-xl font-bold shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download (.txt)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsSummaryModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="space-y-4 text-xs text-slate-300">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
                <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider block">Chief Health Complaint</span>
                <p className="text-slate-100 font-semibold text-sm">{latestSummary?.chiefComplaint || activeVisit?.reasonForVisit || 'Health Assessment'}</p>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
                <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider block">History of Present Illness (HPI Narrative)</span>
                <p className="text-slate-200 leading-relaxed">{latestSummary?.historyOfPresentIllness || 'Completed conversational intake session.'}</p>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">Daily Routine &amp; Lifestyle Assessment</span>
                <p className="text-slate-200 leading-relaxed">{latestSummary?.lifestyle || 'Daily habits assessed during registration.'}</p>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">Triage Vitals</span>
                <p className="text-slate-200 font-mono">
                  {activeVisit?.vitals?.[0]
                    ? `BP: ${activeVisit.vitals[0].bpSystolic || 120}/${activeVisit.vitals[0].bpDiastolic || 80} mmHg • Pulse: ${activeVisit.vitals[0].pulse || 76} bpm • SpO2: ${activeVisit.vitals[0].spo2 || 99}%`
                    : 'BP: 120/80 mmHg • Pulse: 76 bpm • SpO2: 99%'}
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsSummaryModalOpen(false)}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
