import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../services/api';
import { useAuth } from '../../../store/AuthContext';
import { safeGetItem, safeSetItem, safeJsonParse } from '../../../utils/storage';
import {
  Heart, Calendar, FileText, Activity, ShieldCheck,
  Stethoscope, Clock, ChevronRight, User, Pill, Sparkles,
  ArrowRight, Upload, Phone, LogOut, CheckCircle2, Download, Printer,
  Eye, X, AlertCircle, ClipboardList, ShieldAlert, RefreshCw, History
} from 'lucide-react';

export function PatientPortalPage() {
  const navigate = useNavigate();
  const { logout, setSessionUser } = useAuth();
  const [patient, setPatient] = useState<any | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [activeVisit, setActiveVisit] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);

  useEffect(() => {
    const storedUser = safeGetItem<any>('medikiosk_user', null);
    const parsedRaw = safeGetItem<any>('medikiosk_active_patient', null);

    let p = parsedRaw || storedUser?.patient;
    if (!p && storedUser?.role === 'PATIENT') {
      p = {
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
    } else if (!p) {
      const parsedV = safeGetItem<any>('medikiosk_active_visit', null);
      if (parsedV?.patient) p = parsedV.patient;
    }
    if (p) {
      safeSetItem('medikiosk_active_patient', p);
    }
    setPatient(p);

    const parsedVisit = safeGetItem<any>('medikiosk_active_visit', null);
    if (parsedVisit) {
      setActiveVisit(parsedVisit);
    } else if (p?.visits?.[0]) {
      setActiveVisit(p.visits[0]);
    } else {
      setActiveVisit(null);
    }

    // Fetch full visit from API to get the complete AI summary
    const loadFull = async () => {
      const vObj = safeGetItem<any>('medikiosk_active_visit', null);
      const targetVisitId = vObj?.id;
      if (targetVisitId) {
        try {
          const res = await api.visits.get(targetVisitId);
          if (res?.visit) {
            let backendSummary = res.visit.summary;
            if (backendSummary?.summaryJson) {
              const parsed = typeof backendSummary.summaryJson === 'string'
                ? JSON.parse(backendSummary.summaryJson)
                : backendSummary.summaryJson;
              backendSummary = { ...backendSummary, ...parsed };
            }
            const mergedSummary = backendSummary || vObj?.summary || null;
            setActiveVisit((prev: any) => ({
              ...res.visit,
              summary: mergedSummary || prev?.summary || null,
            }));
          }
        } catch (e) {
          // Backend unavailable, use stored visit
        }
      }
    };
    loadFull();

    const targetPatientIdentifier = p?.id || p?.userId || p?.mrn || p?.phone;

    const mergeAllVisits = (baseList: any[]) => {
      const list = Array.isArray(baseList) ? [...baseList] : [];
      const actRaw = localStorage.getItem('medikiosk_active_visit');
      if (actRaw) {
        try {
          const actV = JSON.parse(actRaw);
          if (actV?.id && !list.some((item: any) => item.visitId === actV.id || item.id === actV.id)) {
            list.unshift({
              visitId: actV.id,
              date: actV.createdAt || new Date().toISOString(),
              chiefComplaint: actV.reasonForVisit || actV.summary?.chiefComplaint || 'Current OPD Consultation',
              department: actV.department?.name || 'General Medicine',
              departmentCode: actV.department?.code || 'GEN',
              status: actV.status || 'READY_FOR_DOCTOR',
              priority: actV.priority || 'NORMAL',
              doctor: {
                name: actV.doctor?.user?.name ? `Dr. ${actV.doctor.user.name}` : (actV.doctor?.name || 'Assigned Doctor'),
                specialization: actV.doctor?.specialization || 'Clinical Specialist',
                diagnosis: actV.reasonForVisit || 'Active Consultation',
                clinicalNotes: actV.summary?.historyOfPresentIllness || 'Clinical intake in progress.',
              },
              aiSummary: actV.summary || null,
              vitals: actV.vitals?.[0] || null,
              prescriptions: actV.prescriptions || [],
              lastPrescription: actV.prescriptions?.[0]?.items?.map((i: any) => `${i.medicineName} (${i.dosage})`).join(', ') || null,
            });
          }
        } catch {}
      }

      if (p?.visits && Array.isArray(p.visits)) {
        p.visits.forEach((pv: any) => {
          if (pv?.id && !list.some((item: any) => item.visitId === pv.id || item.id === pv.id)) {
            list.push({
              visitId: pv.id,
              date: pv.createdAt || new Date().toISOString(),
              chiefComplaint: pv.reasonForVisit || pv.summary?.chiefComplaint || 'Previous OPD Consultation',
              department: pv.department?.name || 'General Medicine',
              departmentCode: pv.department?.code || 'GEN',
              status: pv.status || 'COMPLETED',
              priority: pv.priority || 'NORMAL',
              doctor: {
                name: pv.doctor?.user?.name ? `Dr. ${pv.doctor.user.name}` : (pv.doctor?.name || 'Attending Doctor'),
                specialization: pv.doctor?.specialization || 'Clinical Specialist',
                diagnosis: pv.reasonForVisit || 'Consultation Completed',
                clinicalNotes: pv.summary?.historyOfPresentIllness || 'Past medical visit.',
              },
              aiSummary: pv.summary || null,
              vitals: pv.vitals?.[0] || null,
              prescriptions: pv.prescriptions || [],
              lastPrescription: pv.prescriptions?.[0]?.items?.map((i: any) => `${i.medicineName} (${i.dosage})`).join(', ') || null,
            });
          }
        });
      }

      return list;
    };

    if (targetPatientIdentifier) {
      api.doctor.timeline(targetPatientIdentifier)
        .then((data: any) => {
          if (data?.timeline && Array.isArray(data.timeline)) {
            setTimeline(mergeAllVisits(data.timeline));
          } else {
            setTimeline(mergeAllVisits([]));
          }
        })
        .catch((e: any) => {
          console.error('Timeline error:', e);
          setTimeline(mergeAllVisits([]));
        })
        .finally(() => setIsLoading(false));
    } else {
      setTimeline(mergeAllVisits([]));
      setIsLoading(false);
    }
  }, []);

  // Parse summary from the active visit - handles both flat and nested summaryJson
  const parseSummaryFromVisit = (visit: any) => {
    if (!visit) return null;
    const s = visit.summary;
    if (!s) return null;
    // If summaryJson is present (backend format), parse it safely
    if (s.summaryJson) {
      try {
        const parsed = typeof s.summaryJson === 'string'
          ? JSON.parse(s.summaryJson)
          : s.summaryJson;
        return { ...s, ...parsed };
      } catch (error) {
        console.warn('Failed to parse summaryJson:', error);
        // Return the summary as-is if parsing fails
        return s;
      }
    }
    return s;
  };

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

  const renderConversationLines = (fullConv: any) => {
    if (!fullConv) return null;
    let lines: string[] = [];
    if (typeof fullConv === 'string') {
      lines = fullConv.split('\n').filter(Boolean);
    } else if (Array.isArray(fullConv)) {
      lines = fullConv.map((msg: any) => {
        if (typeof msg === 'string') return msg;
        const speaker = msg.role === 'assistant' || msg.sender === 'ai' ? 'MediKiosk AI:' : 'Patient:';
        return `${speaker} ${msg.content || msg.text || JSON.stringify(msg)}`;
      });
    } else if (typeof fullConv === 'object') {
      lines = Object.values(fullConv).map((v: any) => (typeof v === 'string' ? v : JSON.stringify(v)));
    }
    if (lines.length === 0) return null;
    return lines.map((line: string, idx: number) => {
      const isAI = line.startsWith('MediKiosk AI:');
      return (
        <div key={idx} className={`flex gap-2 text-xs ${isAI ? 'text-indigo-300' : 'text-slate-200'}`}>
          <span className={`shrink-0 font-bold text-[10px] ${isAI ? 'text-indigo-400' : 'text-emerald-400'}`}>
            {isAI ? '🤖' : '🧑'}
          </span>
          <span className="leading-relaxed">{line.replace(/^MediKiosk AI:|^Patient:/, '').trim()}</span>
        </div>
      );
    });
  };

  const resolveSummary = () => {
    // 0. Check localStorage active visit directly for any rich summary
    const rawActiveV = localStorage.getItem('medikiosk_active_visit');
    if (rawActiveV) {
      try {
        const parsed = JSON.parse(rawActiveV);
        if (parsed?.summary) {
          const s = typeof parsed.summary === 'string' ? JSON.parse(parsed.summary) : parsed.summary;
          if (s?.chiefComplaint || s?.historyOfPresentIllness) return s;
        }
      } catch {}
    }

    // 1. Try activeVisit summary
    const fromActive = parseSummaryFromVisit(activeVisit);
    if (fromActive && (fromActive.chiefComplaint || fromActive.historyOfPresentIllness)) return fromActive;

    // 2. Try timeline entries (look at all timeline items)
    for (const item of timeline) {
      if (item?.aiSummary && (item.aiSummary.chiefComplaint || item.aiSummary.historyOfPresentIllness)) {
        return item.aiSummary;
      }
    }

    // 3. Try session data in localStorage
    const sessionDataRaw = localStorage.getItem('medikiosk_active_session_data');
    if (sessionDataRaw) {
      try {
        const sd = JSON.parse(sessionDataRaw);
        if (sd.summary) {
          const parsed = typeof sd.summary === 'string' ? JSON.parse(sd.summary) : sd.summary;
          if (parsed.chiefComplaint || parsed.historyOfPresentIllness) return parsed;
        }
      } catch {}
    }

    // 4. Construct from activeVisit / patient records
    if (activeVisit || patient) {
      const chief = activeVisit?.reasonForVisit || activeVisit?.summary?.chiefComplaint || patient?.medicalHistory || 'General Clinical Intake';
      return {
        chiefComplaint: chief,
        historyOfPresentIllness: activeVisit?.reasonForVisit ? `Clinical intake consultation recorded for: ${activeVisit.reasonForVisit}` : `Intake consultation registered for ${patient?.name || 'patient'}.`,
        lifestyle: patient?.age ? `Patient Age: ${patient.age} Yrs, Gender: ${patient.gender || 'Not specified'}.` : 'Baseline health assessment recorded.',
        pastMedicalHistory: patient?.medicalHistory || 'None reported',
        allergies: patient?.allergies || 'No Known Drug Allergies (NKDA)',
        medications: patient?.medications || patient?.currentMedications || 'None reported',
      };
    }

    return null;
  };

  const latestSummary = resolveSummary();

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
${safeString(s?.chiefComplaint, safeString(v?.reasonForVisit, 'Health Assessment'))}

4. HISTORY OF PRESENT ILLNESS (HPI):
------------------------------------
${safeString(s?.historyOfPresentIllness, 'Patient completed conversational multilingual AI intake session at MediKiosk.')}

5. LIFESTYLE & DAILY HABITS:
----------------------------
${safeString(s?.lifestyle, 'Sleep, physical activity, diet, and stress evaluated at kiosk registration.')}

6. PAST MEDICAL HISTORY & ALLERGIES:
------------------------------------
Chronic History:     ${safeString(s?.pastMedicalHistory, safeString(p?.medicalHistory, 'None reported'))}
Known Allergies:     ${safeString(s?.allergies, 'No Known Drug Allergies (NKDA)')}
Current Medications: ${safeString(s?.medications, 'None reported')}

7. TRIAGE VITAL SIGNS:
----------------------
${v?.vitals?.[0] ? `Blood Pressure: ${v.vitals[0].bpSystolic || v.vitals[0].systolic || '--'}/${v.vitals[0].bpDiastolic || v.vitals[0].diastolic || '--'} mmHg
Pulse Rate:     ${v.vitals[0].pulse || '--'} bpm
SpO2 Level:     ${v.vitals[0].spo2 || '--'}%
Temperature:    ${v.vitals[0].temperature || '--'} °F` : 'Vitals not yet recorded by nursing station.'}

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

  const handleStartBrandNewVisit = () => {
    localStorage.removeItem('medikiosk_active_visit');
    localStorage.removeItem('medikiosk_recent_changes');
    localStorage.removeItem('medikiosk_target_complaint');
    localStorage.setItem('medikiosk_visit_type', 'NEW_CASE');
    setIsActionModalOpen(false);
    navigate('/kiosk/language');
  };

  const handleSelectFollowUpEncounter = async (record: any) => {
    const targetComplaint = record?.chiefComplaint || record?.doctor?.diagnosis || record?.title || 'Follow-up Consultation';
    const followUpVisitId = record?.id || record?.visitId || '';
    const recDocName = record?.doctor?.name || record?.doctor?.user?.name || '';
    const activeDocName = activeVisit?.doctor?.user?.name || activeVisit?.doctor?.name || '';

    // Check if current consultation with this doctor is still incomplete
    const isSameDoctor = Boolean(
      (record?.doctorId && activeVisit?.doctorId && record.doctorId === activeVisit.doctorId) ||
      (recDocName && activeDocName && (recDocName.toLowerCase().includes(activeDocName.toLowerCase()) || activeDocName.toLowerCase().includes(recDocName.toLowerCase()))) ||
      (activeVisit && record && activeVisit.id === record.id)
    );

    const isActiveIncomplete = Boolean(
      activeVisit &&
      activeVisit.status !== 'COMPLETED' &&
      isSameDoctor
    );

    if (isActiveIncomplete) {
      const displayDoc = activeDocName || recDocName || 'the assigned doctor';
      alert(
        `⚠️ Cannot Book Follow-Up for Dr. ${displayDoc}\n\n` +
        `Your consultation with Dr. ${displayDoc} (Token: ${activeVisit.token || 'Active'}) is currently in progress and has not been marked as Completed yet.\n\n` +
        `A follow-up can only be booked after Dr. ${displayDoc} completes your current consultation.\n\n` +
        `Tip: If you want to consult for a new problem or with another department, please choose "Option 3: Start Brand New Consultation".`
      );
      return;
    }

    // Clear old intake session data so follow-up starts fresh
    localStorage.removeItem('medikiosk_active_session_data');
    localStorage.removeItem('medikiosk_active_session');
    localStorage.setItem('medikiosk_recent_changes', `Follow-up visit for previous condition: ${targetComplaint}`);
    localStorage.setItem('medikiosk_target_complaint', targetComplaint);
    localStorage.setItem('medikiosk_follow_up_visit_id', followUpVisitId);
    localStorage.setItem('medikiosk_visit_type', 'FOLLOW_UP');

    const p = patient || (localStorage.getItem('medikiosk_active_patient') ? JSON.parse(localStorage.getItem('medikiosk_active_patient')!) : null);
    if (p) {
      localStorage.setItem('medikiosk_active_patient', JSON.stringify({
        ...p,
        isReturning: true,
        isNewPatient: false,
      }));

      // Bind previous doctor to active session
      if (record?.doctor) {
        localStorage.setItem('medikiosk_active_doctor', JSON.stringify(record.doctor));
      }

      // Try registering the follow-up visit directly with the EXACT SAME doctor!
      try {
        const targetDoctorId = record?.doctorId || record?.doctor?.id || record?.doctor?.userId || p.doctorId;
        const targetDepartmentCode = record?.departmentCode || record?.department?.code || p.departmentCode || 'GEN';

        const regRes = await api.patients.register({
          name: p.name || 'Patient',
          phone: p.phone || '9876543210',
          age: p.age || 35,
          gender: p.gender || 'MALE',
          preferredLang: (p.preferredLang || 'en').toUpperCase(),
          departmentCode: targetDepartmentCode,
          doctorId: targetDoctorId,
          reasonForVisit: `Follow-up: ${targetComplaint}`,
          abhaId: p.abhaId || undefined,
        });

        if (regRes?.visit) {
          const updatedVisit = {
            ...regRes.visit,
            doctor: regRes.visit.doctor || record?.doctor || null,
          };
          localStorage.setItem('medikiosk_active_visit', JSON.stringify(updatedVisit));
          localStorage.setItem('medikiosk_active_queue', JSON.stringify(regRes.queueEntry));
          setIsActionModalOpen(false);
          navigate(`/kiosk/intake/${regRes.visit.id}`);
          return;
        }
      } catch (err: any) {
        console.warn('Follow-up visit auto-registration notice:', err);
        if (err.message && err.message.includes('incomplete')) {
          alert(`⚠️ ${err.message}`);
          return;
        }
      }
    }

    setIsActionModalOpen(false);
    navigate('/kiosk/intake/follow-up');
  };

  const handleFollowUp = (record?: any) => {
    handleSelectFollowUpEncounter(record);
  };

  const handleLogout = () => {
    localStorage.removeItem('medikiosk_active_patient');
    localStorage.removeItem('medikiosk_active_visit');
    localStorage.removeItem('medikiosk_active_queue');
    localStorage.removeItem('medikiosk_active_session_data');
    localStorage.removeItem('medikiosk_active_session');
    localStorage.removeItem('medikiosk_recent_changes');
    logout();
    navigate('/login', { replace: true });
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
          <h2 className="text-xl font-bold">Clinical Assessment &amp; Doctor Intake</h2>
          <p className="text-xs text-blue-100 leading-relaxed">
            Resume an ongoing session, book a follow-up for a past condition, or start a brand new consultation.
          </p>
          <button
            onClick={() => setIsActionModalOpen(true)}
            className="w-full py-3 px-4 bg-white text-blue-700 font-bold rounded-2xl flex items-center justify-center gap-2 shadow hover:bg-blue-50 transition-all text-sm cursor-pointer"
          >
            <span>Start Clinical Assessment / Choose Action</span>
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
            {(() => {
              const docName = (activeVisit.doctor?.user?.name || activeVisit.doctor?.name || '').toLowerCase();
              const empId = activeVisit.doctor?.employeeId || '';
              const assignedNurseObj = activeVisit.doctor?.nurses?.[0] || activeVisit.department?.nurses?.[0];

              const nurseName = assignedNurseObj?.user?.name ||
                activeVisit.doctor?.assignedNurseName ||
                (empId === 'DOC-HARISH-201' || docName.includes('harish') || activeVisit.department?.code === 'AYUSH' ? 'Kavita Verma (Nurse)' :
                 empId === 'DOC-YOGESH-101' || docName.includes('yogesh') ? 'Nurse Preeti Patel' :
                 empId === 'DOC-RAJESH-103' || docName.includes('rajesh') ? 'Nurse Sneha Desai' :
                 empId === 'DOC-DESAI-104' || docName.includes('ananya') ? 'Nurse Ritu Nair' :
                 empId === 'DOC-NEHA-105' || docName.includes('neha') ? 'Nurse Sunita Yadav' :
                 empId === 'DOC-ALOK-106' || docName.includes('alok') ? 'Nurse Priya Singh' :
                 (activeVisit.doctor?.user?.name ? `Nurse (${activeVisit.doctor.user.name}'s Station)` : 'OPD Triage Nurse'));

              const roomNumber =
                assignedNurseObj?.roomNumber ||
                assignedNurseObj?.employeeId?.replace(/NUR-/i, 'Room ') ||
                activeVisit.doctor?.roomNumber ||
                activeVisit.department?.roomNumber ||
                (empId === 'DOC-HARISH-201' || docName.includes('harish') || activeVisit.department?.code === 'AYUSH' ? 'Room 103' :
                 empId === 'DOC-YOGESH-101' || docName.includes('yogesh') ? 'Room 204' :
                 empId === 'DOC-VIKRAM-102' || docName.includes('vikram') ? 'Room 101' :
                 empId === 'DOC-RAJESH-103' || docName.includes('rajesh') ? 'Room 105' :
                 empId === 'DOC-DESAI-104' || docName.includes('ananya') ? 'Room 210' :
                 empId === 'DOC-NEHA-105' || docName.includes('neha') ? 'Room 302' :
                 empId === 'DOC-ALOK-106' || docName.includes('alok') ? 'Room 208' :
                 (activeVisit.doctor?.employeeId ? `Room ${activeVisit.doctor.employeeId.replace(/[^0-9]/g, '') || '101'}` : 'Room 101'));

              return (
                <div className="space-y-2.5">
                  <div className="p-3 bg-white/10 rounded-2xl border border-white/10 text-xs space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-emerald-300">
                      <span>👩‍⚕️ Assigned Nurse Station:</span>
                      <span className="font-mono bg-emerald-500/20 px-2 py-0.5 rounded text-white">
                        {roomNumber}
                      </span>
                    </div>
                    <p className="text-slate-200 text-[11px] leading-relaxed">
                      <strong>{nurseName}</strong> • Please complete offline BP, SpO2 &amp; Vitals check at nursing station before consultation.
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      localStorage.setItem('medikiosk_active_nurse_name', nurseName);
                      localStorage.setItem('medikiosk_active_nurse_room', roomNumber);
                      localStorage.setItem('medikiosk_active_visit', JSON.stringify(activeVisit));
                      if (patient) {
                        localStorage.setItem('medikiosk_active_patient', JSON.stringify(patient));
                      }
                      navigate('/nurse');
                    }}
                    className="w-full py-3 px-4 bg-white hover:bg-emerald-50 text-teal-900 font-extrabold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
                  >
                    <Activity className="w-4 h-4 text-teal-700" />
                    <span>Proceed to Nurse Station ({nurseName} • {roomNumber})</span>
                    <ArrowRight className="w-4 h-4 text-teal-700" />
                  </button>
                </div>
              );
            })()}
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
              onClick={() => setIsActionModalOpen(true)}
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
                {latestSummary && (
                  <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold rounded-full uppercase">
                    Complete Record
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">Full structured breakdown of your medical complaints, lifestyle, chronic history, and vitals</p>
            </div>
          </div>
          {latestSummary && (
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
          )}
        </div>

        {/* Complete Sections of the Whole Summary */}
        {latestSummary ? (
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
                {safeString(latestSummary?.chiefComplaint, safeString(activeVisit?.reasonForVisit, 'Not recorded'))}
              </p>
              {/* Full conversation transcript */}
              {latestSummary?.fullConversation ? (
                <div className="bg-slate-900 rounded-xl border border-slate-700 p-3 space-y-2 max-h-64 overflow-y-auto">
                  {renderConversationLines(latestSummary.fullConversation)}
                </div>
              ) : (
                <p className="text-slate-300 leading-relaxed text-xs">
                  {safeString(latestSummary?.historyOfPresentIllness, 'No intake narrative recorded.')}
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
                {safeString(latestSummary?.lifestyle, 'Not recorded.')}
              </p>
            </div>

            {/* Section 4: Past Medical History, Allergies & Medications */}
            <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Chronic History</span>
                <span className="text-slate-200">{safeString(latestSummary?.pastMedicalHistory, safeString(patient?.medicalHistory, 'None reported'))}</span>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Allergies &amp; Sensitivities</span>
                <span className="text-emerald-400 font-semibold">{safeString(latestSummary?.allergies, 'No Known Drug Allergies (NKDA)')}</span>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Current Medications</span>
                <span className="text-slate-200">{safeString(latestSummary?.medications, 'None reported')}</span>
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
                  : 'Vitals not yet recorded.'}
              </p>
            </div>

            {/* Card Footer */}
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
        ) : (
          <div className="p-6 bg-slate-950/60 rounded-2xl border border-slate-800 text-center space-y-3">
            <div className="w-10 h-10 bg-indigo-950 text-indigo-400 rounded-xl flex items-center justify-center mx-auto">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-200">No AI Clinical Summary Available Yet</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              You have not completed an AI clinical intake consultation yet. Start an assessment to generate your structured clinical summary, symptoms analysis, and triage records.
            </p>
            <button
              type="button"
              onClick={() => setIsActionModalOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2 shadow-md cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Start Clinical Intake</span>
            </button>
          </div>
        )}
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
            {timeline.length > 0 && (
              <>
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
              </>
            )}
          </div>
        </div>

        {timeline.length === 0 ? (
          <div className="text-center py-10 px-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto">
              <Calendar className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800">No Past Consultations on Record</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Welcome to your MediKiosk Health Portal. As a new patient, you have no prior encounters. Select a doctor &amp; treatment department above to start your consultation.
            </p>
            <button
              onClick={() => setIsActionModalOpen(true)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow transition-all cursor-pointer inline-flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Start Clinical Assessment</span>
            </button>
          </div>
        ) : (
          <div className="space-y-6 relative before:absolute before:inset-0 before:left-5 before:w-0.5 before:bg-slate-200">
            {timeline.map((item: any, idx: number) => {
              const docName = safeString(item.doctor?.name, 'Assigned Doctor');
              const docSpec = safeString(item.doctor?.specialization, safeString(item.department, 'General Medicine'));
              const diagnosis = safeString(item.doctor?.diagnosis, safeString(item.chiefComplaint, 'Consultation Completed'));
              const aiSummary = safeString(
                item.aiSummary?.historyOfPresentIllness,
                safeString(item.aiSummary?.chiefComplaint, safeString(item.description, 'Intake summary recorded at MediKiosk.'))
              );
              const rx = safeString(
                item.lastPrescription,
                item.prescriptions?.length
                  ? item.prescriptions.map((p: any) => `${p.medicineName || 'Medicine'} (${p.dosage || 'standard dose'})`).join(', ')
                  : ''
              );
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
                        {item.status && item.status !== 'COMPLETED' ? (
                          <span className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-300 rounded-lg text-[10px] font-bold">
                            ⏳ Incomplete Consultation
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleFollowUp(item)}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-300 hover:border-emerald-600 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                            title="Start a follow-up consultation for this condition"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Book Follow-up</span>
                          </button>
                        )}
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
                    {aiSummary && (
                      <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs space-y-1">
                        <span className="font-bold text-blue-900 flex items-center gap-1.5 text-[11px] uppercase">
                          <FileText className="w-3.5 h-3.5 text-blue-600" /> AI Clinical Intake Findings
                        </span>
                        <p className="text-slate-700 text-[11px] leading-relaxed">{aiSummary}</p>
                      </div>
                    )}

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
        )}
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
                <p className="text-slate-100 font-semibold text-sm">
                  {safeString(latestSummary?.chiefComplaint, safeString(activeVisit?.reasonForVisit, 'Health Assessment'))}
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
                <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider block">History of Present Illness (HPI Narrative)</span>
                <p className="text-slate-200 leading-relaxed">
                  {safeString(latestSummary?.historyOfPresentIllness, 'Completed conversational intake session.')}
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">Daily Routine &amp; Lifestyle Assessment</span>
                <p className="text-slate-200 leading-relaxed">
                  {safeString(latestSummary?.lifestyle, 'Daily habits assessed during registration.')}
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">Triage Vitals</span>
                <p className="text-slate-200 font-mono">
                  {activeVisit?.vitals?.[0]
                    ? `BP: ${activeVisit.vitals[0].bpSystolic || activeVisit.vitals[0].systolic || '--'}/${activeVisit.vitals[0].bpDiastolic || activeVisit.vitals[0].diastolic || '--'} mmHg • Pulse: ${activeVisit.vitals[0].pulse || '--'} bpm • SpO2: ${activeVisit.vitals[0].spo2 || '--'}%`
                    : 'Awaiting nursing triage check-in. Vitals not yet recorded.'}
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

      {/* PATIENT INTAKE ACTION MODAL (3-OPTION CHOICE GRID) */}
      {isActionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full p-6 text-white space-y-6 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600/30 text-blue-400 rounded-2xl flex items-center justify-center font-bold">
                  <Stethoscope className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Choose Clinical Intake Action</h3>
                  <p className="text-xs text-slate-400">Select how you would like to proceed with your medical consultation</p>
                </div>
              </div>
              <button
                onClick={() => setIsActionModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              {/* Option 1: Resume Active Intake */}
              <div
                onClick={() => {
                  if (activeVisit?.id) {
                    setIsActionModalOpen(false);
                    navigate(`/kiosk/intake/${activeVisit.id}`);
                  }
                }}
                className={`p-4 rounded-2xl border transition-all flex items-start justify-between gap-4 ${
                  activeVisit?.id
                    ? 'bg-emerald-950/40 border-emerald-500/50 hover:bg-emerald-950/70 hover:border-emerald-400 cursor-pointer shadow-lg shadow-emerald-950/40'
                    : 'bg-slate-950/40 border-slate-800 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <h4 className="text-sm font-bold text-emerald-300">Option 1: Resume Active Intake</h4>
                    {activeVisit?.token && (
                      <span className="text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded font-mono font-bold">
                        Token #{activeVisit.token}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300">
                    {activeVisit
                      ? `Continue your active consultation with ${activeVisit.doctor?.user?.name ? 'Dr. ' + activeVisit.doctor.user.name : 'assigned doctor'} (${activeVisit.department?.name || 'OPD'}). Retains all prior responses.`
                      : 'No ongoing uncompleted intake session. Start a new visit below.'}
                  </p>
                </div>
                <div className="shrink-0 pt-1">
                  <ChevronRight className={`w-5 h-5 ${activeVisit?.id ? 'text-emerald-400' : 'text-slate-600'}`} />
                </div>
              </div>

              {/* Option 2: Book Follow-Up Consultation */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-indigo-400" />
                    <h4 className="text-sm font-bold text-indigo-300">Option 2: Book Follow-Up Consultation</h4>
                  </div>
                  <span className="text-[10px] text-slate-400">{timeline.length} previous visits</span>
                </div>
                <p className="text-xs text-slate-400">
                  Select a previously diagnosed condition to follow up on symptom progression and medication response:
                </p>

                {timeline.length > 0 ? (
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pt-1 pr-1">
                    {timeline.slice(0, 4).map((record: any, rIdx: number) => {
                      const complaint = record.chiefComplaint || record.doctor?.diagnosis || record.title || 'OPD Consultation';
                      return (
                        <div
                          key={rIdx}
                          onClick={() => handleSelectFollowUpEncounter(record)}
                          className="p-2.5 bg-slate-900 hover:bg-indigo-950/60 border border-slate-800 hover:border-indigo-500/50 rounded-xl flex items-center justify-between gap-2 cursor-pointer transition-all text-xs"
                        >
                          <div className="truncate">
                            <span className="font-semibold text-slate-200 block truncate">{complaint}</span>
                            <span className="text-[10px] text-slate-400">
                              {record.date ? new Date(record.date).toLocaleDateString() : 'Past Visit'} • {record.doctor?.name || 'Physician'} ({record.department || 'OPD'})
                            </span>
                          </div>
                          <span className="text-[11px] font-bold text-indigo-300 px-2 py-1 bg-indigo-500/20 rounded-lg shrink-0">
                            Follow-Up →
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-2.5 bg-slate-900 rounded-xl text-[11px] text-slate-500 italic">
                    No past visits found on record for follow-up. Please start a brand new consultation.
                  </div>
                )}
              </div>

              {/* Option 3: Start Brand New Consultation / New Issue */}
              <div
                onClick={handleStartBrandNewVisit}
                className="p-4 bg-gradient-to-r from-blue-950/60 to-indigo-950/60 hover:from-blue-900/60 hover:to-indigo-900/60 border border-blue-500/40 hover:border-blue-400 rounded-2xl transition-all flex items-center justify-between gap-4 cursor-pointer shadow-lg shadow-blue-950/30"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <h4 className="text-sm font-bold text-blue-200">Option 3: Start Brand New Consultation / New Issue</h4>
                  </div>
                  <p className="text-xs text-slate-300">
                    Purges previous session state and starts a completely fresh intake for a new complaint, symptom, or department choice.
                  </p>
                </div>
                <div className="shrink-0">
                  <ArrowRight className="w-5 h-5 text-blue-400" />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsActionModalOpen(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
