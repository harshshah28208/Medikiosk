import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import { useAuth } from '../../../store/AuthContext';
import { safeJsonParse, safeGetItem } from '../../../utils/storage';
import {
  Users, Stethoscope, AlertCircle, Clock, CheckCircle2,
  FileText, Activity, ChevronRight, RefreshCw, UserCheck, Trash2,
  PlusCircle, Pill, Eye, X, Download, ExternalLink, History, 
  ShieldAlert, ChevronDown, ChevronUp, ClipboardList, Printer, Search, User
} from 'lucide-react';

export function DoctorDashboard() {
  const { user } = useAuth();
  const [patients, setPatients] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVisit, setSelectedVisit] = useState<any | null>(null);
  const [summaryData, setSummaryData] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [expandedSection, setExpandedSection] = useState<string | null>('hpi');
  const [showOriginalAnswers, setShowOriginalAnswers] = useState(false);
  const [summaryStatus, setSummaryStatus] = useState<'DRAFT' | 'CONFIRMED' | 'EDITED'>('DRAFT');

  // Document & Summary Modal State
  const [viewingDoc, setViewingDoc] = useState<any | null>(null);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);

  const [isCompleted, setIsCompleted] = useState(false);
  const [signatureData, setSignatureData] = useState<any | null>(null);

  const [clinicalNotes, setClinicalNotes] = useState('');
  const [impression, setImpression] = useState('');
  const [treatmentPlan, setTreatmentPlan] = useState('');
  const [soapSubjective, setSoapSubjective] = useState('');
  const [soapObjective, setSoapObjective] = useState('');
  const [soapAssessment, setSoapAssessment] = useState('');
  const [soapPlan, setSoapPlan] = useState('');
  const [prescriptions, setPrescriptions] = useState<any[]>([
    { medicineName: 'Paracetamol', dosage: '650 mg', frequency: 'Thrice daily (TID)', duration: '3 days', instructions: 'After meals' },
  ]);

  const [showAllHospitalPatients, setShowAllHospitalPatients] = useState(false);
  const [queueTab, setQueueTab] = useState<'ACTIVE' | 'COMPLETED'>('ACTIVE');
  const [searchQuery, setSearchQuery] = useState('');

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

  // Extract and normalize vitals regardless of property names (systolic vs bpSystolic, etc.)
  const getNormalizedVitals = (visit: any) => {
    if (!visit) return null;
    let rawVital = null;

    if (Array.isArray(visit.vitals) && visit.vitals.length > 0) {
      rawVital = visit.vitals[0];
    } else if (visit.vitals && typeof visit.vitals === 'object') {
      rawVital = visit.vitals;
    } else if (Array.isArray(visit.patient?.vitals) && visit.patient.vitals.length > 0) {
      rawVital = visit.patient.vitals[0];
    } else if (visit.patient?.vitals && typeof visit.patient.vitals === 'object') {
      rawVital = visit.patient.vitals;
    }

    if (!rawVital && visit.id) {
      const localVitals = localStorage.getItem(`medikiosk_vitals_${visit.id}`);
      if (localVitals) {
        try {
          const parsed = JSON.parse(localVitals);
          rawVital = Array.isArray(parsed) ? parsed[0] : parsed;
        } catch {}
      }
    }

    if (!rawVital) return null;

    const bpSys = rawVital.bpSystolic ?? rawVital.systolic ?? rawVital.bloodPressureSystolic ?? null;
    const bpDia = rawVital.bpDiastolic ?? rawVital.diastolic ?? rawVital.bloodPressureDiastolic ?? null;
    const pulse = rawVital.pulse ?? rawVital.heartRate ?? rawVital.pulseRate ?? null;
    const spo2 = rawVital.spo2 ?? rawVital.oxygenSaturation ?? rawVital.spO2 ?? null;
    const temp = rawVital.temperature ?? rawVital.temp ?? null;
    const weight = rawVital.weight ?? null;
    const height = rawVital.height ?? null;
    const bmi = rawVital.bmi ?? (weight && height ? (parseFloat(weight) / Math.pow(parseFloat(height) / 100, 2)).toFixed(1) : null);
    const painScore = rawVital.painScore ?? null;
    const notes = rawVital.notes ?? '';
    const recordedAt = rawVital.recordedAt ?? rawVital.createdAt ?? null;

    // Only return if at least one real biometric vital was recorded
    if (!bpSys && !bpDia && !pulse && !spo2 && !temp && !weight && !height) return null;

    return {
      bpSystolic: bpSys,
      bpDiastolic: bpDia,
      pulse,
      spo2,
      temperature: temp,
      weight,
      height,
      bmi,
      painScore,
      notes,
      recordedAt,
    };
  };

  // Filter patients by chosen doctor when in "My Patients" mode
  const isAssignedToCurrentDoctor = (visit: any) => {
    if (showAllHospitalPatients) return true;
    if (!user) return true;

    const userDocId = user.doctorProfile?.id;
    const userDocName = (user.name || '').toLowerCase().trim();
    const userDeptId = user.doctorProfile?.departmentId || user.doctorProfile?.department?.id;
    const userDeptCode = (user.doctorProfile?.department?.code || '').toLowerCase().trim();

    const visitDocId = visit.doctorId || visit.doctor?.id;
    const visitDocName = (visit.doctor?.user?.name || visit.doctor?.name || '').toLowerCase().trim();
    const visitDeptId = visit.departmentId || visit.department?.id;
    const visitDeptCode = (visit.department?.code || '').toLowerCase().trim();

    // 1. Explicit match by doctorId
    if (visitDocId && userDocId && visitDocId === userDocId) return true;

    // 2. Explicit match by doctor's full or partial name
    if (visitDocName && userDocName && (visitDocName.includes(userDocName) || userDocName.includes(visitDocName))) return true;

    // 3. If visit was explicitly assigned to another named doctor, do NOT match
    if (visitDocId && userDocId && visitDocId !== userDocId) return false;
    if (visitDocName && userDocName && !visitDocName.includes(userDocName) && !userDocName.includes(visitDocName) && visitDocName !== 'general opd') {
      return false;
    }

    // 4. Unassigned visit matching doctor's department
    if (visitDeptId && userDeptId && visitDeptId === userDeptId) return true;
    if (visitDeptCode && userDeptCode && visitDeptCode === userDeptCode) return true;

    // Default fallback
    return !visitDocId;
  };

  const myOrAllPatients = patients.filter(isAssignedToCurrentDoctor);
  const activePatients = myOrAllPatients.filter((v: any) => v.status !== 'COMPLETED');
  const completedPatients = myOrAllPatients.filter((v: any) => v.status === 'COMPLETED');
  const displayedPatients = queueTab === 'ACTIVE' ? activePatients : completedPatients;

  const filteredPatients = displayedPatients.filter((v: any) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const name = (v.patient?.name || '').toLowerCase();
    const mrn = (v.patient?.mrn || '').toLowerCase();
    const token = String(v.token || '').toLowerCase();
    const phone = (v.patient?.phone || '').toLowerCase();
    const reason = (v.reasonForVisit || '').toLowerCase();
    const dept = (v.department?.name || '').toLowerCase();
    const doc = (v.doctor?.user?.name || v.doctor?.name || '').toLowerCase();
    return name.includes(q) || mrn.includes(q) || token.includes(q) || phone.includes(q) || reason.includes(q) || dept.includes(q) || doc.includes(q);
  });

  const loadPatients = async (showAll = showAllHospitalPatients) => {
    setIsLoading(true);
    try {
      const res = await api.doctor.patients(showAll);
      if (res?.visits) {
        let visitsList: any[] = [...res.visits];
        const localActive = safeGetItem<any>('medikiosk_active_visit', null);
        const localPatient = safeGetItem<any>('medikiosk_active_patient', null);
        const localDoc = safeGetItem<any>('medikiosk_active_doctor', null);
        if (localActive) {
          if (localPatient && !localActive.patient) localActive.patient = localPatient;
          if (localDoc && !localActive.doctor) localActive.doctor = localDoc;
          const idx = visitsList.findIndex((v: any) => v.id === localActive.id);
          if (idx !== -1) {
            visitsList[idx] = {
              ...visitsList[idx],
              summary: visitsList[idx].summary || localActive.summary,
              vitals: (visitsList[idx].vitals && visitsList[idx].vitals.length > 0) ? visitsList[idx].vitals : localActive.vitals,
              doctor: visitsList[idx].doctor || localActive.doctor,
            };
          } else {
            visitsList.unshift(localActive);
          }
        }
        setPatients(visitsList);
        const nonComp = visitsList.filter((v: any) => v.status !== 'COMPLETED');
        const listToSelect = queueTab === 'ACTIVE' ? (nonComp.length > 0 ? nonComp : visitsList) : visitsList;
        if (listToSelect.length > 0) {
          const currentSelectedStillInList = selectedVisit && listToSelect.find((v: any) => v.id === selectedVisit.id);
          if (currentSelectedStillInList) {
            handleSelectPatient(currentSelectedStillInList);
          } else {
            handleSelectPatient(listToSelect[0]);
          }
        } else {
          setSelectedVisit(null);
          setSummaryData(null);
        }
      }
    } catch (e) {
      console.error('Failed to load patients:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPatients(showAllHospitalPatients);
  }, [showAllHospitalPatients]);

  const handleSelectPatient = async (visit: any) => {
    const localActive = safeGetItem<any>('medikiosk_active_visit', null);
    const effectiveSummary = visit.summary || (localActive?.id === visit.id || !visit.id ? localActive?.summary : null);

    setSelectedVisit(visit);
    if (effectiveSummary) {
      const sJson = typeof effectiveSummary === 'string'
        ? safeJsonParse(effectiveSummary, null)
        : (effectiveSummary.summaryJson ? (typeof effectiveSummary.summaryJson === 'string' ? safeJsonParse(effectiveSummary.summaryJson, null) : effectiveSummary.summaryJson) : effectiveSummary);
      setSummaryData(sJson);
      setImpression(safeString(sJson?.chiefComplaint, safeString(visit.reasonForVisit, '')));
      setSoapSubjective(safeString(sJson?.historyOfPresentIllness, ''));
      setSoapAssessment(safeString(sJson?.chiefComplaint, ''));
    } else {
      setSummaryData(null);
      setImpression(safeString(visit.reasonForVisit, ''));
    }
    setTimeline([]);
    setClinicalNotes('');
    setTreatmentPlan('');
    setSoapObjective('');
    setSoapPlan('');
    setIsCompleted(visit.status === 'COMPLETED' || visit.consultation?.status === 'COMPLETED');
    setSignatureData(visit.consultation?.digitalSignature || null);
    setPrescriptions([
      { medicineName: '', dosage: '', frequency: 'Once daily (OD)', duration: '5 days', instructions: 'After food' },
    ]);
    try {
      const res = await api.visits.get(visit.id);
      if (res?.visit) {
        let visitObj = res.visit;
        // If visit has no vitals attached, check api.vitals.getForVisit
        if (!visitObj.vitals || visitObj.vitals.length === 0) {
          try {
            const vRes = await api.vitals.getForVisit(visit.id);
            if (vRes?.vitals && vRes.vitals.length > 0) {
              visitObj = { ...visitObj, vitals: vRes.vitals };
            }
          } catch {}
        }
        // Fallback to local storage vitals
        if (!visitObj.vitals || visitObj.vitals.length === 0) {
          const parsed = safeGetItem<any>(`medikiosk_vitals_${visit.id}`, null);
          if (parsed) {
            visitObj = { ...visitObj, vitals: Array.isArray(parsed) ? parsed : [parsed] };
          }
        }
        
        // Preserve doctor and summary if backend object lacks them
        if (!visitObj.doctor && (visit.doctor || localActive?.doctor)) {
          visitObj.doctor = visit.doctor || localActive?.doctor;
        }

        const fullSummary = visitObj.summary || effectiveSummary;
        if (fullSummary) {
          visitObj.summary = fullSummary;
          const sJson = typeof fullSummary.summaryJson === 'string'
            ? safeJsonParse(fullSummary.summaryJson, null)
            : (fullSummary.summaryJson || fullSummary);
          if (sJson) {
            setSummaryData(sJson);
            setImpression(safeString(sJson?.chiefComplaint, safeString(visit.reasonForVisit, '')));
            setSoapSubjective(safeString(sJson?.historyOfPresentIllness, ''));
            setSoapAssessment(safeString(sJson?.chiefComplaint, ''));
          }
        }

        setSelectedVisit(visitObj);
        setIsCompleted(visitObj.status === 'COMPLETED' || visitObj.consultation?.status === 'COMPLETED');
        if (visitObj.consultation?.digitalSignature) {
          setSignatureData(visitObj.consultation.digitalSignature);
        }
        if (visitObj.consultation) {
          setClinicalNotes(safeString(visitObj.consultation.clinicalNotes, ''));
          setImpression(safeString(visitObj.consultation.impression || visitObj.consultation.diagnosis, ''));
          setTreatmentPlan(safeString(visitObj.consultation.treatmentPlan, ''));
        }
        if (visitObj.prescriptions && visitObj.prescriptions.length > 0 && visitObj.prescriptions[0].items?.length > 0) {
          setPrescriptions(visitObj.prescriptions[0].items.map((item: any) => ({
            medicineName: safeString(item.medicineName, ''),
            dosage: safeString(item.dosage, ''),
            frequency: safeString(item.frequency, 'Once daily (OD)'),
            duration: safeString(item.duration, '5 days'),
            instructions: safeString(item.instructions, 'After meals')
          })));
        }
        // Load longitudinal timeline
        const patientId = res.visit.patientId || visit.patient?.id;
        if (patientId) {
          try {
            const tlRes = await api.doctor.timeline(patientId);
            if (tlRes?.timeline) setTimeline(tlRes.timeline);
          } catch {}
        }
      }
    } catch (e) {
      console.error('Failed to fetch visit details:', e);
    }
  };

  const handleAddPrescription = () => {
    setPrescriptions([
      ...prescriptions,
      { medicineName: '', dosage: '', frequency: 'Once daily (OD)', duration: '5 days', instructions: 'After food' },
    ]);
  };

  const handleRemovePrescription = (index: number) => {
    setPrescriptions(prescriptions.filter((_, i) => i !== index));
  };

  const handlePrescriptionChange = (index: number, field: string, value: string) => {
    const updated = [...prescriptions];
    updated[index][field] = value;
    setPrescriptions(updated);
  };

  const handleSaveConsultation = async () => {
    if (!selectedVisit || isSaving || isCompleted) return;
    setIsSaving(true);
    try {
      const res = await api.doctor.consultation({
        visitId: selectedVisit.id,
        patientId: selectedVisit.patientId || selectedVisit.patient?.id,
        clinicalNotes: `${soapSubjective ? `S: ${soapSubjective}\n` : ''}${soapObjective ? `O: ${soapObjective}\n` : ''}${clinicalNotes}`.trim(),
        impression: soapAssessment || impression,
        diagnosis: soapAssessment || impression,
        treatmentPlan: soapPlan || treatmentPlan,
        prescriptions: prescriptions.filter((p) => p.medicineName?.trim()),
      });

      if (res?.digitalSignature) {
        setSignatureData(res.digitalSignature);
      }
      setIsCompleted(true);

      // Auto-trigger HIS / EMR synchronization in background
      api.integrations.exportToHIS(selectedVisit.id).catch(() => {});

      alert('✅ Consultation digitally signed, sealed, and completed! Patient marked COMPLETED and timeline updated.');
      loadPatients();
    } catch (e: any) {
      console.error('Consultation save error:', e);
      alert(`Error saving consultation: ${e.message || 'Please ensure you are logged in as a Doctor.'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadFHIRBundle = async () => {
    if (!selectedVisit) return;
    try {
      const bundle = await api.integrations.getFHIRBundle(selectedVisit.id);
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `FHIR_R4_Bundle_${selectedVisit.patient?.mrn || 'Patient'}_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`FHIR Bundle Error: ${e.message}`);
    }
  };

  const handleDownloadTimeline = () => {
    if (!selectedVisit || timeline.length === 0) return;
    const p = selectedVisit.patient;
    const report = `=====================================================
MEDIKIOSK LONGITUDINAL PATIENT MEDICAL HISTORY (360°)
Generated: ${new Date().toLocaleString()}
=====================================================

PATIENT IDENTIFICATION:
-----------------------
Name:    ${p?.name || 'N/A'}
MRN:     ${p?.mrn || 'N/A'}
Age/Sex: ${p?.age || 'N/A'} Yrs / ${p?.gender || 'N/A'}
Phone:   ${p?.phone || 'N/A'}
ABHA ID: ${p?.abhaId || 'N/A'}

TOTAL RECORDED ENCOUNTERS: ${timeline.length}
=====================================================

${timeline.map((tl, idx) => `
-----------------------------------------------------
ENCOUNTER #${timeline.length - idx}: ${tl.chiefComplaint || tl.title || 'OPD Consultation'}
Date: ${tl.date ? new Date(tl.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Past Visit'}
Department: ${tl.department || 'General Medicine'}

1. Treating Physician:
   Doctor:              ${tl.doctor?.name || 'Dr. Yogesh Sharma'} (${tl.doctor?.specialization || tl.department || 'General Medicine'})
   Confirmed Diagnosis: ${tl.doctor?.diagnosis || tl.chiefComplaint || 'Clinical Review Completed'}
   Clinical Notes:      ${tl.doctor?.clinicalNotes || 'Intake conducted at hospital OPD.'}

2. AI Intake Summary:
   HPI:                 ${tl.aiSummary?.historyOfPresentIllness || tl.aiSummary?.chiefComplaint || tl.description || 'Intake verified.'}
   Lifestyle:           ${tl.aiSummary?.lifestyle || 'Assessed during kiosk registration.'}

3. Vitals at Encounter:
   ${tl.vitals ? `BP: ${tl.vitals.bpSystolic}/${tl.vitals.bpDiastolic} mmHg | Pulse: ${tl.vitals.pulse} bpm | SpO2: ${tl.vitals.spo2}%` : 'Standard vitals recorded.'}

4. Prescriptions Dispensed:
   ${tl.lastPrescription || (tl.prescriptions?.length ? tl.prescriptions.map((px: any) => `${px.medicineName} (${px.dosage})`).join(', ') : 'None prescribed.')}
`).join('\n')}

=====================================================
End of Longitudinal Medical Record
MediKiosk Autonomous Clinical Intake System
=====================================================`;

    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Longitudinal_History_${p?.mrn || 'Patient'}_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadSingleVisit = (tl: any, visitNum: number) => {
    const p = selectedVisit?.patient;
    const report = `=====================================================
MEDIKIOSK CLINICAL ENCOUNTER SUMMARY — VISIT #${visitNum}
Date: ${tl.date ? new Date(tl.date).toLocaleDateString() : 'N/A'}
Department: ${tl.department || 'General Medicine'}
=====================================================

PATIENT: ${p?.name || 'Patient'} (MRN: ${p?.mrn || 'N/A'}, Age: ${p?.age || '--'} / ${p?.gender || '--'})

CHIEF COMPLAINT:
${tl.chiefComplaint || 'Consultation Intake'}

TREATING PHYSICIAN:
${tl.doctor?.name || 'Treating Doctor'} (${tl.doctor?.specialization || tl.department || 'General Medicine'})
Diagnosis: ${tl.doctor?.diagnosis || 'N/A'}
Notes: ${tl.doctor?.clinicalNotes || 'None'}

AI CLINICAL INTAKE FINDINGS:
${tl.aiSummary?.historyOfPresentIllness || tl.aiSummary?.chiefComplaint || 'N/A'}
Lifestyle: ${tl.aiSummary?.lifestyle || 'N/A'}

VITALS:
${tl.vitals ? `BP: ${tl.vitals.bpSystolic}/${tl.vitals.bpDiastolic} mmHg | Pulse: ${tl.vitals.pulse} bpm | SpO2: ${tl.vitals.spo2}%` : 'Recorded at triage.'}

PRESCRIPTION:
${tl.lastPrescription || 'None'}

=====================================================`;

    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Visit_Summary_${p?.mrn || 'Patient'}_Visit_${visitNum}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadSummary = () => {
    if (!selectedVisit) return;
    const p = selectedVisit.patient;
    const s = summaryData;
    const report = `=====================================================
MEDIKIOSK CLINICAL INTAKE & OPD CONSULTATION REPORT
Generated: ${new Date().toLocaleString()}
=====================================================

1. PATIENT DEMOGRAPHICS:
------------------------
Name:    ${p?.name || 'N/A'}
MRN:     ${p?.mrn || 'N/A'}
Age/Sex: ${p?.age || 'N/A'} Yrs / ${p?.gender || 'N/A'}
Phone:   ${p?.phone || 'N/A'}
ABHA ID: ${p?.abhaId || 'N/A'}

2. CLINICAL INTAKE & COMPLAINTS:
--------------------------------
Chief Complaint: ${s?.chiefComplaint || selectedVisit.reasonForVisit || 'N/A'}
Onset / Duration: ${s?.onset || 'N/A'}
History of Present Illness (HPI):
${s?.historyOfPresentIllness || 'Patient completed conversational multilingual intake at Kiosk.'}

3. LIFESTYLE & DAILY ROUTINE:
-----------------------------
${s?.lifestyle || 'Assessed during intake.'}

4. PAST MEDICAL HISTORY & ALLERGIES:
------------------------------------
Chronic Conditions: ${s?.pastMedicalHistory || 'None reported'}
Known Allergies:    ${p?.allergies?.length ? p.allergies.map((a: any) => a.allergen).join(', ') : (s?.allergies || 'No known drug allergies (NKDA)')}
Current Medications: ${s?.medications || 'None reported'}

5. TRIAGE VITAL SIGNS:
----------------------
${selectedVisit.vitals?.[0]
  ? `Blood Pressure: ${selectedVisit.vitals[0].bpSystolic}/${selectedVisit.vitals[0].bpDiastolic} mmHg
Pulse:          ${selectedVisit.vitals[0].pulse} bpm
SpO2:           ${selectedVisit.vitals[0].spo2}%
Temperature:    ${selectedVisit.vitals[0].temperature || 98.6} °F`
  : 'Vitals awaiting triage recording.'}

6. DOCTOR CONSULTATION & DIAGNOSIS:
-----------------------------------
Doctor:         ${selectedVisit.doctor?.user?.name || 'Dr. Yogesh Sharma'}
Department:     ${selectedVisit.department?.name || 'General Medicine'}
Diagnosis:      ${soapAssessment || impression || 'Under Evaluation'}
Treatment Plan: ${soapPlan || treatmentPlan || 'As prescribed below'}

7. E-PRESCRIPTION:
------------------
${prescriptions.length > 0
  ? prescriptions.map((pr, idx) => `${idx + 1}. ${pr.medicineName} - ${pr.dosage} | ${pr.frequency} | Duration: ${pr.duration} (${pr.instructions})`).join('\n')
  : 'No active medications prescribed yet.'}

=====================================================
MediKiosk Autonomous Clinical Intake System
=====================================================`;

    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Clinical_Summary_${p?.mrn || 'Patient'}_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-bold shadow-lg shadow-blue-600/30">
            <Stethoscope className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white">
                {user?.name ? `${user.name}` : 'Physician Clinical Command Center'}
              </h1>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {user?.doctorProfile?.specialization || 'Clinical Doctor'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {!showAllHospitalPatients
                ? `Showing patients specifically assigned to / chosen for ${user?.name || 'you'}`
                : 'Showing all hospital OPD patients across departments'}
            </p>
          </div>
        </div>

        <button
          onClick={() => loadPatients()}
          className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-2 border border-slate-700 transition-colors self-start sm:self-auto touch-target cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh Queue</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: OPD Patient Queue */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              <span>OPD Patient Queue</span>
            </h2>
            <span className="text-xs font-mono font-bold px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-full">
              {activePatients.length} Active
            </span>
          </div>

          {/* Sub-Tabs: Active OPD Queue vs Completed Cases */}
          <div className="flex items-center p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setQueueTab('ACTIVE')}
              className={`flex-1 py-1.5 px-2 rounded-lg font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                queueTab === 'ACTIVE'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>⚡ Active Queue</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-white/20 rounded-full">{activePatients.length}</span>
            </button>
            <button
              onClick={() => setQueueTab('COMPLETED')}
              className={`flex-1 py-1.5 px-2 rounded-lg font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                queueTab === 'COMPLETED'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>✅ Completed</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-white/20 rounded-full">{completedPatients.length}</span>
            </button>
          </div>

          {/* Patient Search Input & Search Button (Instant Patient Lookup) */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Name, MRN, Token #..."
                className="w-full pl-9 pr-8 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded-full"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                if (filteredPatients.length > 0) {
                  handleSelectPatient(filteredPatients[0]);
                }
              }}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1 shrink-0 cursor-pointer shadow-sm shadow-blue-600/30"
              title="Search and select matching patient"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search</span>
            </button>
          </div>

          {/* Filter Toggle: My Patients vs All Hospital OPD */}
          <div className="flex items-center p-1 bg-slate-950/60 rounded-xl border border-slate-800/80 text-[11px]">
            <button
              onClick={() => setShowAllHospitalPatients(false)}
              className={`flex-1 py-1 px-2 rounded-lg font-semibold transition-all cursor-pointer truncate ${
                !showAllHospitalPatients
                  ? 'bg-slate-800 text-slate-100 shadow-sm'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
              title="Only show patients assigned to this doctor"
            >
              👤 My Assigned Patients
            </button>
            <button
              onClick={() => setShowAllHospitalPatients(true)}
              className={`flex-1 py-1 px-2 rounded-lg font-semibold transition-all cursor-pointer truncate ${
                showAllHospitalPatients
                  ? 'bg-slate-800 text-slate-100 shadow-sm'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
              title="Show all hospital OPD patients"
            >
              🏥 All Hospital OPD
            </button>
          </div>

          <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
            {filteredPatients.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs bg-slate-950 rounded-2xl border border-slate-800/60 space-y-1">
                <p>
                  {searchQuery
                    ? `No matching patients found for "${searchQuery}".`
                    : (queueTab === 'ACTIVE' ? 'No patients currently waiting in queue.' : 'No completed patient consultations yet.')}
                </p>
                {!showAllHospitalPatients && (
                  <p className="text-[10px] text-slate-600">
                    Switch to "All Hospital OPD" to view visits across other doctors.
                  </p>
                )}
              </div>
            ) : filteredPatients.map((visit: any) => {
              const isSelected = selectedVisit?.id === visit.id;
              const hasAlert = visit.emergencyAlerts && visit.emergencyAlerts.length > 0;
              const hasDocs = (visit.documents && visit.documents.length > 0) || (visit.patient?.documents && visit.patient?.documents.length > 0);
              const assignedDoctorName = visit.doctor?.user?.name || visit.doctor?.name;

              return (
                <button
                  key={visit.id}
                  onClick={() => handleSelectPatient(visit)}
                  className={`
                    w-full p-4 rounded-2xl text-left transition-all border cursor-pointer
                    ${isSelected
                      ? 'bg-blue-600/20 border-blue-500 shadow-md scale-[1.01]'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }
                  `}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 bg-slate-800 text-blue-300 rounded border border-slate-700">
                      Token #{visit.token}
                    </span>
                    <div className="flex items-center gap-1">
                      {hasDocs && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 rounded font-bold">
                          PDF
                        </span>
                      )}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        visit.priority === 'CRITICAL' ? 'bg-red-500/20 text-red-400' :
                        visit.priority === 'URGENT' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-slate-800 text-slate-400'
                      }`}>
                        {visit.priority || 'NORMAL'}
                      </span>
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-slate-100 truncate">{visit.patient?.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    MRN: {visit.patient?.mrn} • {visit.patient?.age || 40}Y • {visit.patient?.gender}
                  </p>

                  {assignedDoctorName && (
                    <div className="text-[10px] text-blue-300 font-medium truncate mt-1 flex items-center gap-1">
                      <Stethoscope className="w-3 h-3 text-blue-400 shrink-0" />
                      <span>Doctor: {assignedDoctorName}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80 text-[10px] text-slate-500">
                    <span className="truncate max-w-[150px]">Reason: {visit.reasonForVisit || 'General OPD'}</span>
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3" />
                      {new Date(visit.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </button>
              );
            })}

            {patients.length === 0 && !isLoading && (
              <div className="text-center py-8 text-slate-500 text-xs">
                No active patients waiting in OPD queue.
              </div>
            )}
          </div>
        </div>

        {/* Right: Clinical Review & E-Prescription Center */}
        <div className="lg:col-span-8 space-y-6">
          {selectedVisit ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
              {/* Selected Patient Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-white">{selectedVisit.patient?.name}</h2>
                    <span className="text-xs font-mono px-2.5 py-0.5 bg-slate-800 text-slate-300 rounded-full border border-slate-700">
                      MRN: {selectedVisit.patient?.mrn}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {selectedVisit.patient?.age} Yrs • {selectedVisit.patient?.gender} • Lang: {selectedVisit.language || selectedVisit.patient?.preferredLang} • Dept: {selectedVisit.department?.name}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs px-3 py-1 bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30 rounded-xl">
                    Token #{selectedVisit.token}
                  </span>
                </div>
              </div>

              {/* Patient Snapshot Bar (Phase 10 — Doctor Snapshot) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Allergy Profile</span>
                  <span className={`font-semibold ${selectedVisit.patient?.allergies?.length ? 'text-red-400' : 'text-emerald-400'}`}>
                    {selectedVisit.patient?.allergies?.length ? selectedVisit.patient.allergies.map((a: any) => a.allergen).join(', ') : 'NKDA (No Known Allergies)'}
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Known Conditions</span>
                  <span className="font-semibold text-slate-200 truncate block">
                    {safeString(summaryData?.pastMedicalHistory, 'None on record')}
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Active Medications</span>
                  <span className="font-semibold text-slate-200 truncate block">
                    {safeString(summaryData?.medications, 'None reported')}
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Prior Visits (Timeline)</span>
                  <span className="font-semibold text-indigo-400">
                    {timeline.length > 0 ? `${timeline.length} previous visits recorded` : 'First-time Patient (0 Prior Visits)'}
                  </span>
                </div>
              </div>

              {/* Live Vitals Recorded by Nursing Station */}
              {(() => {
                const normalizedVitals = getNormalizedVitals(selectedVisit);
                if (normalizedVitals) {
                  return (
                    <div className="bg-slate-950 border border-emerald-500/40 rounded-2xl p-4.5 space-y-3 shadow-lg">
                      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                            <Activity className="w-4 h-4" />
                          </div>
                          <div>
                            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                              Patient Vitals (Nursing Station Intake)
                            </h3>
                            <p className="text-[10px] text-slate-400">Entered by Nurse • Live Synced to Doctor & Patient Portal</p>
                          </div>
                        </div>
                        <span className="text-[10px] px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 font-mono font-bold rounded-full border border-emerald-500/30">
                          Recorded: {normalizedVitals.recordedAt ? new Date(normalizedVitals.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 text-xs">
                        {/* BP */}
                        <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                          <span className="text-[10px] text-slate-400 font-bold block uppercase">Blood Pressure</span>
                          <span className="text-sm font-bold text-emerald-400 font-mono">
                            {normalizedVitals.bpSystolic && normalizedVitals.bpDiastolic ? `${normalizedVitals.bpSystolic}/${normalizedVitals.bpDiastolic}` : (normalizedVitals.bpSystolic || '--')} <span className="text-[10px] text-slate-400">mmHg</span>
                          </span>
                        </div>

                        {/* Pulse */}
                        <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                          <span className="text-[10px] text-slate-400 font-bold block uppercase">Pulse Rate</span>
                          <span className="text-sm font-bold text-slate-100 font-mono">
                            {normalizedVitals.pulse ? `${normalizedVitals.pulse}` : '--'} <span className="text-[10px] text-slate-400">bpm</span>
                          </span>
                        </div>

                        {/* SpO2 */}
                        <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                          <span className="text-[10px] text-slate-400 font-bold block uppercase">Oxygen (SpO2)</span>
                          <span className="text-sm font-bold text-blue-400 font-mono">
                            {normalizedVitals.spo2 ? `${normalizedVitals.spo2}%` : '--'}
                          </span>
                        </div>

                        {/* Temp */}
                        <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                          <span className="text-[10px] text-slate-400 font-bold block uppercase">Temperature</span>
                          <span className="text-sm font-bold text-slate-100 font-mono">
                            {normalizedVitals.temperature ? `${normalizedVitals.temperature}°F` : '--'}
                          </span>
                        </div>

                        {/* BMI / Weight */}
                        <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                          <span className="text-[10px] text-slate-400 font-bold block uppercase">BMI / Weight</span>
                          <span className="text-sm font-bold text-slate-100 font-mono">
                            {normalizedVitals.bmi ? `${normalizedVitals.bmi}` : (normalizedVitals.weight ? `${normalizedVitals.weight}kg` : '--')} <span className="text-[10px] text-slate-400">BMI</span>
                          </span>
                        </div>

                        {/* Pain Score */}
                        <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                          <span className="text-[10px] text-slate-400 font-bold block uppercase">Pain Score</span>
                          <span className={`text-sm font-bold font-mono ${normalizedVitals.painScore && normalizedVitals.painScore > 5 ? 'text-red-400' : 'text-slate-100'}`}>
                            {normalizedVitals.painScore !== null && normalizedVitals.painScore !== undefined ? `${normalizedVitals.painScore}` : '--'} <span className="text-[10px] text-slate-400">/ 10</span>
                          </span>
                        </div>
                      </div>

                      {normalizedVitals.notes && (
                        <div className="text-[11px] text-slate-300 bg-slate-900/80 p-2 rounded-lg border border-slate-800 flex items-center gap-2">
                          <span className="text-emerald-400 font-bold">Nurse Intake Notes:</span>
                          <span>{normalizedVitals.notes}</span>
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-amber-400" />
                      <span>⚠️ <strong>Nursing Station Vitals:</strong> Awaiting nurse check-in. Vitals not yet recorded for this encounter.</span>
                    </div>
                  </div>
                );
              })()}

              {/* Contradiction Detection Banner (Item 31) */}
              {selectedVisit.patient?.allergies?.length > 0 && /no known|nkda/i.test(safeString(summaryData?.allergies)) && (
                <div className="p-3.5 bg-amber-950/40 border border-amber-500/50 rounded-2xl flex items-center gap-3 text-amber-200 text-xs">
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <span className="font-bold block">⚠️ Information Requires Verification (Contradiction Detected)</span>
                    <span>Patient profile records: <strong>{selectedVisit.patient.allergies.map((a: any) => a.allergen).join(', ')}</strong>, but kiosk intake reported No Known Allergies. Clinician verification required before prescribing.</span>
                  </div>
                </div>
              )}

              {/* AI Structured Summary Draft Card */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-400" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      AI Clinical Intake Summary Draft
                    </h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      summaryStatus === 'CONFIRMED' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-blue-500/20 text-blue-300'
                    }`}>
                      {summaryStatus === 'CONFIRMED' ? '✓ Clinician Confirmed' : 'AI Draft'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsSummaryModalOpen(true)}
                      className="px-3 py-1 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white text-xs rounded-xl font-bold border border-indigo-500/40 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Whole Summary</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadSummary}
                      className="px-3 py-1 bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white text-xs rounded-xl font-bold border border-blue-500/40 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Report</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowOriginalAnswers(!showOriginalAnswers)}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl font-medium border border-slate-700 transition-colors flex items-center gap-1.5"
                    >
                      <ClipboardList className="w-3.5 h-3.5 text-blue-400" />
                      <span>{showOriginalAnswers ? 'Hide Raw Answers' : 'View Verbatim Dialog'}</span>
                    </button>
                    {summaryStatus !== 'CONFIRMED' && (
                      <button
                        type="button"
                        onClick={() => setSummaryStatus('CONFIRMED')}
                        className="px-3 py-1 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white text-xs rounded-xl font-bold border border-emerald-500/30 transition-colors"
                      >
                        ✓ Confirm Summary
                      </button>
                    )}
                  </div>
                </div>

                {/* Original Patient Answers Drawer (Item 29 — AI Transparency) */}
                {showOriginalAnswers && (
                  <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-2.5 max-h-60 overflow-y-auto">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-300 pb-1 border-b border-slate-800">
                      <span>Original Patient Dialogue &amp; Verbatim Transcripts</span>
                      <span className="text-[10px] text-slate-500">Unfiltered Kiosk Session</span>
                    </div>
                    {selectedVisit.sessions?.[0]?.messages?.length ? (
                      selectedVisit.sessions[0].messages.map((m: any, mIdx: number) => (
                        <div key={mIdx} className={`p-2.5 rounded-lg text-xs ${m.role === 'AI' ? 'bg-slate-950 text-slate-400' : 'bg-blue-950/40 text-blue-200 border border-blue-900/30'}`}>
                          <span className="font-bold text-[10px] uppercase block text-slate-500 mb-0.5">{m.role === 'AI' ? 'MediKiosk AI' : 'Patient Response'}:</span>
                          <p>{m.content}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500 italic">No direct raw chat logs stored for this legacy visit.</p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300">
                  {/* Chief Complaint */}
                  <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Chief Complaint</span>
                      <span className="text-[9px] px-1.5 py-0.5 bg-blue-900/40 text-blue-300 rounded font-mono">Voice NLU</span>
                    </div>
                    <p className="text-slate-100 font-semibold">{safeString(summaryData?.chiefComplaint, safeString(selectedVisit.reasonForVisit, 'Under Evaluation'))}</p>
                  </div>

                  {/* Vitals Snapshot */}
                  <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Vital Signs Snapshot</span>
                      <span className="text-[9px] px-1.5 py-0.5 bg-green-900/40 text-green-300 rounded font-mono">Nurse Station</span>
                    </div>
                    <p className="text-slate-100 font-medium">
                      {selectedVisit.vitals?.[0]
                        ? `BP: ${selectedVisit.vitals[0].bpSystolic}/${selectedVisit.vitals[0].bpDiastolic} mmHg • Pulse: ${selectedVisit.vitals[0].pulse} bpm • SpO2: ${selectedVisit.vitals[0].spo2}% • Temp: ${selectedVisit.vitals[0].temperature || 98.6}°F`
                        : 'Vitals awaiting nurse triage station'
                      }
                    </p>
                  </div>

                  {/* History of Present Illness */}
                  <div className="md:col-span-2 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">History of Present Illness (HPI)</span>
                      <span className="text-[9px] px-1.5 py-0.5 bg-purple-900/40 text-purple-300 rounded font-mono">Groq Clinical Engine</span>
                    </div>
                    <p className="text-slate-200 leading-relaxed">
                      {safeString(summaryData?.historyOfPresentIllness, 'Patient completed conversational multilingual AI intake at registration kiosk.')}
                    </p>
                  </div>

                  {/* Lifestyle & Routine */}
                  {summaryData?.lifestyle && (
                    <div className="md:col-span-2 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Daily Routine & Lifestyle Factors</span>
                        <span className="text-[9px] px-1.5 py-0.5 bg-amber-900/40 text-amber-300 rounded font-mono">Patient Reported</span>
                      </div>
                      <p className="text-slate-200 leading-relaxed">{safeString(summaryData.lifestyle)}</p>
                    </div>
                  )}

                  {/* Changes Since Previous Visit (Returning Patient Intelligence) */}
                  {summaryData?.changesSincePreviousVisit && (
                    <div className="md:col-span-2 bg-indigo-950/30 border border-indigo-500/40 p-3.5 rounded-xl space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase text-indigo-300 block">🔄 Changes Since Previous Consultation</span>
                        <span className="text-[9px] px-1.5 py-0.5 bg-indigo-500/20 text-indigo-200 rounded font-mono">Longitudinal Delta</span>
                      </div>
                      <p className="text-slate-100 font-medium leading-relaxed">{safeString(summaryData.changesSincePreviousVisit)}</p>
                    </div>
                  )}

                  {/* Past Medical History */}
                  <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Past Medical History</span>
                      <span className="text-[9px] px-1.5 py-0.5 bg-indigo-900/40 text-indigo-300 rounded font-mono">Self-Declared</span>
                    </div>
                    <p className="text-slate-200">{safeString(summaryData?.pastMedicalHistory, 'None reported')}</p>
                  </div>

                  {/* Past Surgical History */}
                  <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Past Surgical History</span>
                      <span className="text-[9px] px-1.5 py-0.5 bg-indigo-900/40 text-indigo-300 rounded font-mono">Self-Declared</span>
                    </div>
                    <p className="text-slate-200">{safeString(summaryData?.pastSurgicalHistory, 'No prior surgeries reported')}</p>
                  </div>

                  {/* Current Medications */}
                  <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Current Medications</span>
                      <span className="text-[9px] px-1.5 py-0.5 bg-indigo-900/40 text-indigo-300 rounded font-mono">Active Rx</span>
                    </div>
                    <p className="text-slate-200">{safeString(summaryData?.medications, 'No regular medicines')}</p>
                  </div>

                  {/* Allergies */}
                  <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Allergies & Sensitivities</span>
                      <span className="text-[9px] px-1.5 py-0.5 bg-red-900/40 text-red-300 rounded font-mono">Safety Check</span>
                    </div>
                    <p className="text-slate-200">{safeString(summaryData?.allergies, 'No known drug allergies (NKDA)')}</p>
                  </div>

                  {/* Family & Social History */}
                  {(summaryData?.familyHistory || summaryData?.socialHistory) && (
                    <div className="md:col-span-2 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Family & Social History</span>
                        <span className="text-[9px] px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded font-mono">Background</span>
                      </div>
                      <p className="text-slate-200">
                        {summaryData.familyHistory ? `Family: ${safeString(summaryData.familyHistory)}` : ''}
                        {summaryData.familyHistory && summaryData.socialHistory ? ' • ' : ''}
                        {summaryData.socialHistory ? `Social: ${safeString(summaryData.socialHistory)}` : ''}
                      </p>
                    </div>
                  )}

                  {/* Medication Reconciliation Card */}
                  {summaryData?.medicationReconciliation && (
                    <div className="md:col-span-2 bg-slate-900/80 border border-slate-700 p-3.5 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase text-blue-300 block">💊 Medication Reconciliation</span>
                        <span className="text-[9px] px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded font-mono">Reconciliation</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                        <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                          <span className="text-slate-400 font-bold block mb-1">Patient Reported:</span>
                          <span className="text-slate-200">{safeString(summaryData.medicationReconciliation.patientReported, 'None')}</span>
                        </div>
                        <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                          <span className="text-slate-400 font-bold block mb-1">Past Prescribed:</span>
                          <span className="text-slate-200">{safeString(summaryData.medicationReconciliation.previouslyPrescribed, 'None')}</span>
                        </div>
                        <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                          <span className="text-slate-400 font-bold block mb-1">Document Extracted:</span>
                          <span className="text-slate-200">{safeString(summaryData.medicationReconciliation.documentExtracted, 'None')}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Uploaded Past PDF Documents & Extracted Findings */}
                  {((selectedVisit.documents && selectedVisit.documents.length > 0) || (selectedVisit.patient?.documents && selectedVisit.patient.documents.length > 0)) && (
                    <div className="md:col-span-2 bg-blue-950/20 border border-blue-500/30 p-3.5 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-blue-300 font-bold text-xs uppercase tracking-wider">
                          <FileText className="w-4 h-4 text-blue-400" />
                          <span>Uploaded Patient Records (PDF & Prescriptions)</span>
                        </div>
                        <span className="text-[10px] text-blue-400 font-medium">Click card to view details</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {(selectedVisit.documents || selectedVisit.patient?.documents || []).map((doc: any, dIdx: number) => (
                          <div
                            key={dIdx}
                            onClick={() => setViewingDoc(doc)}
                            className="bg-slate-950 p-3 rounded-xl border border-slate-800 hover:border-blue-500 cursor-pointer transition-all flex items-center justify-between text-xs group"
                          >
                            <div className="truncate mr-2">
                              <span className="font-semibold text-slate-100 block truncate group-hover:text-blue-400 transition-colors">
                                {safeString(doc.title, 'Document')}
                              </span>
                              <span className="text-[10px] text-slate-500">{safeString(doc.fileType, 'PDF')} • {new Date(doc.uploadedAt || Date.now()).toLocaleDateString()}</span>
                            </div>
                            <button
                              type="button"
                              className="px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white rounded-lg font-bold flex items-center gap-1 shrink-0 transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View PDF</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

                {/* Longitudinal Timeline Panel — Full Details with AI Summary & Doctor Profiles */}
                <div className="bg-slate-950 border border-indigo-900/40 rounded-2xl p-5 space-y-4 shadow-xl">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2.5 text-indigo-300 text-xs font-bold uppercase tracking-wider">
                      <History className="w-4 h-4 text-indigo-400" />
                      <span>Longitudinal Medical History ({timeline.length} Prior Visit{timeline.length !== 1 ? 's' : ''})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {timeline.length > 0 && (
                        <button
                          type="button"
                          onClick={handleDownloadTimeline}
                          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/30"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download Longitudinal History (.txt)</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleDownloadFHIRBundle}
                        className="px-3 py-1.5 bg-blue-600/30 hover:bg-blue-600 text-blue-200 hover:text-white text-xs rounded-xl font-semibold border border-blue-500/40 transition-colors flex items-center gap-1.5 cursor-pointer"
                        title="Download HL7 FHIR R4 Bundle JSON"
                      >
                        <FileText className="w-3.5 h-3.5 text-blue-300" />
                        <span>FHIR R4 Bundle</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-xl font-medium border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print PDF</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {timeline.length === 0 ? (
                      <div className="p-6 bg-slate-900/40 rounded-xl border border-slate-800/80 text-center space-y-2">
                        <History className="w-8 h-8 text-slate-600 mx-auto" />
                        <p className="text-xs font-semibold text-slate-300">No Previous Consultation History</p>
                        <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                          This is a brand new patient registration with no prior OPD encounters on file. Prior encounter timelines will populate here automatically upon completion of future visits.
                        </p>
                      </div>
                    ) : (
                      timeline.map((tl: any, i: number) => {
                        const totalCount = timeline.length;
                        const docName = safeString(tl.doctor?.name || tl.doctor?.user?.name, 'Attending Doctor');
                        const docSpec = safeString(tl.doctor?.specialization || tl.department, 'Internal Medicine');
                        const diagnosis = safeString(tl.doctor?.diagnosis || tl.chiefComplaint, 'Clinical Review Completed');
                        const aiSummaryText = safeString(tl.aiSummary?.historyOfPresentIllness || tl.aiSummary?.chiefComplaint || tl.description, 'AI Intake summary verified at Kiosk.');
                        const lifestyleText = safeString(tl.aiSummary?.lifestyle);
                        const rxText = safeString(tl.lastPrescription || (Array.isArray(tl.prescriptions) ? tl.prescriptions.map((p: any) => `${p.medicineName} (${p.dosage})`).join(', ') : null));

                      return (
                        <div key={i} className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 hover:border-indigo-500/50 transition-all space-y-3">
                          {/* Top Header: Visit #, Date, Department */}
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-lg bg-indigo-600/20 text-indigo-300 text-[11px] font-bold font-mono border border-indigo-500/30">
                                Visit #{totalCount - i}
                              </span>
                              <span className="text-xs font-bold text-slate-100">{safeString(tl.chiefComplaint, 'General OPD Consultation')}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400">
                              <span>{tl.date ? new Date(tl.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Today'}</span>
                              <span>•</span>
                              <span className="text-indigo-400 font-semibold">{safeString(tl.department, 'General Medicine')}</span>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleDownloadSingleVisit(tl, totalCount - i); }}
                                className="ml-2 px-2 py-0.5 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-md text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer border border-slate-700"
                                title="Download this visit summary"
                              >
                                <Download className="w-3 h-3" />
                                <span>Download</span>
                              </button>
                            </div>
                          </div>

                          {/* Grid of Doctor Details & AI Clinical Summary */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            {/* Doctor Details & Diagnosis */}
                            <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800/80 space-y-1.5">
                              <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase">
                                <span className="flex items-center gap-1.5 text-indigo-300">
                                  <Stethoscope className="w-3.5 h-3.5 text-indigo-400" /> Treating Physician
                                </span>
                                <span className="text-slate-500">{docSpec}</span>
                              </div>
                              <p className="text-slate-100 font-bold">{docName}</p>
                              <div className="text-[11px] text-slate-300">
                                <span className="text-slate-500 font-medium">Doctor Diagnosis: </span>
                                <span className="text-emerald-400 font-semibold">{diagnosis}</span>
                              </div>
                              {tl.doctor?.clinicalNotes && (
                                <p className="text-[11px] text-slate-400 italic">"{safeString(tl.doctor.clinicalNotes)}"</p>
                              )}
                            </div>

                            {/* AI Summary & Lifestyle Findings */}
                            <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800/80 space-y-1.5">
                              <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase">
                                <span className="flex items-center gap-1.5 text-blue-300">
                                  <FileText className="w-3.5 h-3.5 text-blue-400" /> AI Intake Summary
                                </span>
                                <span className="text-blue-400 font-mono">Groq NLU</span>
                              </div>
                              <p className="text-slate-200 text-[11px] leading-relaxed line-clamp-2">{aiSummaryText}</p>
                              {lifestyleText && (
                                <div className="text-[10px] text-amber-300/80 pt-1 border-t border-slate-900">
                                  <span className="font-bold text-slate-400">Lifestyle/Habits: </span>
                                  <span>{lifestyleText}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Vitals & Prescriptions Bar */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60 text-[11px] text-slate-400">
                            {tl.vitals ? (
                              <div className="flex items-center gap-2 font-mono text-[10px]">
                                <span className="text-green-400">BP: {tl.vitals.bpSystolic}/{tl.vitals.bpDiastolic}</span>
                                <span>•</span>
                                <span>Pulse: {tl.vitals.pulse} bpm</span>
                                <span>•</span>
                                <span>SpO2: {tl.vitals.spo2}%</span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-500">Vitals Recorded</span>
                            )}

                            {rxText && (
                              <div className="text-right text-[11px] text-indigo-300">
                                <span className="text-slate-500">Prescription: </span>
                                <span className="font-semibold text-slate-200">{rxText}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }))}
                  </div>
                </div>

              {/* Red Flag Inline Alert */}
              {selectedVisit?.emergencyAlerts && selectedVisit.emergencyAlerts.length > 0 && (
                <div className="p-3.5 bg-red-950/40 border border-red-500/40 rounded-2xl flex items-center gap-3">
                  <ShieldAlert className="w-5 h-5 text-red-400 animate-pulse shrink-0" />
                  <div className="text-xs">
                    <span className="font-bold text-red-300 block">🔴 Red Flag Detected by AI Triage</span>
                    <span className="text-red-400/80">{safeString(selectedVisit.emergencyAlerts[0].description)}</span>
                  </div>
                  <span className="ml-auto text-[10px] font-bold px-2 py-1 bg-red-500/20 text-red-300 rounded-full border border-red-500/30">
                    {safeString(selectedVisit.emergencyAlerts[0].severity, 'URGENT')}
                  </span>
                </div>
              )}

              {/* SOAP Note Composer */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 pb-1">
                  <ClipboardList className="w-5 h-5 text-blue-400" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">SOAP Clinical Note</h3>
                  <span className="text-[10px] text-slate-500 ml-auto">AI pre-filled from intake summary</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block flex items-center gap-1">
                      <span className="w-5 h-5 bg-blue-600 text-white rounded font-black flex items-center justify-center text-[10px]">S</span>
                      Subjective — Patient History & Complaints
                    </label>
                    <textarea
                      value={soapSubjective}
                      onChange={(e) => setSoapSubjective(e.target.value)}
                      rows={3}
                      placeholder="What the patient reports: symptoms, onset, duration, severity..."
                      className="w-full px-3 py-2.5 bg-slate-950 border border-blue-900/50 rounded-xl text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-green-400 uppercase tracking-wider block flex items-center gap-1">
                      <span className="w-5 h-5 bg-green-600 text-white rounded font-black flex items-center justify-center text-[10px]">O</span>
                      Objective — Examination Findings & Vitals
                    </label>
                    <textarea
                      value={soapObjective}
                      onChange={(e) => setSoapObjective(e.target.value)}
                      rows={3}
                      placeholder="Vital signs, physical exam findings, lab results..."
                      className="w-full px-3 py-2.5 bg-slate-950 border border-green-900/50 rounded-xl text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block flex items-center gap-1">
                      <span className="w-5 h-5 bg-amber-600 text-white rounded font-black flex items-center justify-center text-[10px]">A</span>
                      Assessment — Clinical Impression / Diagnosis
                    </label>
                    <textarea
                      value={soapAssessment}
                      onChange={(e) => setSoapAssessment(e.target.value)}
                      rows={3}
                      placeholder="Diagnosis, differential diagnoses, clinical reasoning..."
                      className="w-full px-3 py-2.5 bg-slate-950 border border-amber-900/50 rounded-xl text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block flex items-center gap-1">
                      <span className="w-5 h-5 bg-purple-600 text-white rounded font-black flex items-center justify-center text-[10px]">P</span>
                      Plan — Treatment, Prescriptions & Follow-up
                    </label>
                    <textarea
                      value={soapPlan}
                      onChange={(e) => setSoapPlan(e.target.value)}
                      rows={3}
                      placeholder="Treatment plan, prescriptions, investigations, follow-up date..."
                      className="w-full px-3 py-2.5 bg-slate-950 border border-purple-900/50 rounded-xl text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>

              {/* Digital E-Prescription (Rx) Module */}
              <div className="space-y-3 pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Pill className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      Digital E-Prescription (Rx)
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddPrescription}
                    className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border border-indigo-500/30"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Add Medication</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {prescriptions.map((p, idx) => (
                    <div key={idx} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-400 font-mono">Rx #{idx + 1}</span>
                        {prescriptions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemovePrescription(idx)}
                            className="text-slate-500 hover:text-red-400 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div className="sm:col-span-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Medicine Name</label>
                          <input
                            type="text"
                            value={p.medicineName}
                            onChange={(e) => handlePrescriptionChange(idx, 'medicineName', e.target.value)}
                            placeholder="e.g. Amoxicillin"
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Dosage / Strength</label>
                          <input
                            type="text"
                            value={p.dosage}
                            onChange={(e) => handlePrescriptionChange(idx, 'dosage', e.target.value)}
                            placeholder="e.g. 650 mg"
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Frequency</label>
                          <input
                            type="text"
                            value={p.frequency}
                            onChange={(e) => handlePrescriptionChange(idx, 'frequency', e.target.value)}
                            placeholder="e.g. Thrice daily (TID)"
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Duration & Timing</label>
                          <input
                            type="text"
                            value={p.duration}
                            onChange={(e) => handlePrescriptionChange(idx, 'duration', e.target.value)}
                            placeholder="e.g. 5 days after food"
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Digital Signature Audit Seal Banner */}
              {(isCompleted || signatureData) && (
                <div className="p-4 bg-emerald-950/50 border border-emerald-500/50 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-inner">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center font-bold shrink-0">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-300 text-sm">Consultation Digitally Signed &amp; Sealed</span>
                        <span className="px-2 py-0.5 bg-emerald-500/30 text-emerald-200 rounded font-mono text-[10px]">ENCOUNTER COMPLETED</span>
                      </div>
                      <p className="text-slate-300 text-[11px] mt-0.5">
                        Signer: <strong>{signatureData?.signerName || selectedVisit?.doctor?.user?.name || 'Treating Physician'}</strong> • Signed at: {new Date(signatureData?.signedAt || Date.now()).toLocaleString()}
                      </p>
                      {signatureData?.documentHash && (
                        <p className="text-slate-400 font-mono text-[10px] truncate max-w-md mt-0.5">
                          SHA-256 Seal: {signatureData.documentHash}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={handleDownloadFHIRBundle}
                      className="px-3 py-1.5 bg-emerald-600/30 hover:bg-emerald-600 text-emerald-200 hover:text-white rounded-xl font-bold flex items-center gap-1.5 border border-emerald-500/40 transition-colors cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Export FHIR R4</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Submission Action */}
              <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div className="text-xs text-slate-400">
                  {isCompleted ? (
                    <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      Encounter is finalized. Record is locked in patient longitudinal timeline.
                    </span>
                  ) : (
                    <span>Clicking Complete &amp; Sign will seal clinical notes, finalize e-prescription, and update patient history.</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleSaveConsultation}
                  disabled={isSaving || isCompleted}
                  className={`px-8 py-3.5 font-bold rounded-2xl shadow-lg flex items-center gap-2 transition-all touch-target-lg cursor-pointer ${
                    isCompleted
                      ? 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/30 hover:scale-[1.02]'
                  }`}
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>
                    {isSaving
                      ? 'Signing & Finalizing...'
                      : isCompleted
                      ? 'Consultation Digitally Signed & Locked'
                      : 'Complete & Sign Digitally'}
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-500">
              Select a patient from the queue to open their clinical workspace.
            </div>
          )}
        </div>
      </div>

      {/* Interactive Document / PDF Viewer Modal */}
      {viewingDoc && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600/20 text-blue-400 rounded-xl flex items-center justify-center font-bold">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{viewingDoc.title}</h3>
                  <p className="text-xs text-slate-400">Category: {viewingDoc.fileType} • Uploaded: {new Date(viewingDoc.uploadedAt || Date.now()).toLocaleString()}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={viewingDoc.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Full PDF</span>
                </a>
                <button
                  onClick={() => setViewingDoc(null)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Embedded PDF or Preview Container */}
            <div className="flex-1 p-6 overflow-y-auto bg-slate-950 space-y-4">
              {viewingDoc.fileUrl?.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={viewingDoc.fileUrl}
                  className="w-full h-[60vh] rounded-2xl border border-slate-800 bg-white"
                  title="PDF Viewer"
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-8 bg-slate-900 rounded-2xl border border-slate-800 space-y-4">
                  <img
                    src={viewingDoc.fileUrl}
                    alt="Document"
                    className="max-h-[50vh] max-w-full rounded-xl object-contain shadow-lg"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <p className="text-xs text-slate-400 font-mono">File: {viewingDoc.fileUrl}</p>
                </div>
              )}

              {/* Extracted Entities Inspection */}
              {viewingDoc.extractions && viewingDoc.extractions.length > 0 && (() => {
                let parsed: any = null;
                try {
                  parsed = typeof viewingDoc.extractions[0].extractedData === 'string'
                    ? JSON.parse(viewingDoc.extractions[0].extractedData)
                    : viewingDoc.extractions[0].extractedData;
                } catch (e) {
                  parsed = null;
                }

                return (
                  <div className="p-5 bg-slate-900 rounded-2xl border border-slate-800 space-y-4 text-xs">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                        <FileText className="w-4 h-4" />
                        AI Verified Document Content
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Confidence: {((viewingDoc.extractions[0].confidence || 0.95) * 100).toFixed(0)}%
                      </span>
                    </div>

                    {parsed?.summary && (
                      <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Document Summary</span>
                        <p className="text-slate-200 text-sm leading-relaxed">{parsed.summary}</p>
                      </div>
                    )}

                    {parsed?.medications && parsed.medications.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">Extracted Prescribed Medications</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {parsed.medications.map((m: any, idx: number) => (
                            <div key={idx} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                              <span className="font-bold text-emerald-300 block">{m.name}</span>
                              <span className="text-slate-400 text-[11px]">{m.dosage || m.instructions || m.frequency || 'Prescribed'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {parsed?.labResults && parsed.labResults.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">Extracted Laboratory Values</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {parsed.labResults.map((t: any, idx: number) => (
                            <div key={idx} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
                              <div>
                                <span className="font-bold text-slate-200 block">{t.testName}</span>
                                <span className="text-slate-500 text-[10px]">Ref: {t.referenceRange || 'Normal'}</span>
                              </div>
                              <span className={`px-2 py-0.5 rounded font-mono font-bold text-xs ${
                                t.flag === 'HIGH' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                                t.flag === 'LOW' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                'bg-slate-800 text-slate-300'
                              }`}>
                                {t.result} {t.unit || ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {parsed?.transcribedText && (
                      <details className="text-slate-400 cursor-pointer">
                        <summary className="text-[11px] font-semibold text-slate-400 hover:text-slate-200">
                          View Raw Transcribed Document Text
                        </summary>
                        <pre className="text-[11px] text-slate-300 bg-slate-950 p-3 rounded-xl font-mono overflow-x-auto border border-slate-800 mt-2 whitespace-pre-wrap">
                          {parsed.transcribedText}
                        </pre>
                      </details>
                    )}
                  </div>
                );
              })()}
            </div>

          </div>
        </div>
      )}

      {/* Complete AI Clinical Intake Summary Modal */}
      {isSummaryModalOpen && selectedVisit && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-4xl w-full p-6 sm:p-8 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600/20 text-indigo-400 rounded-2xl flex items-center justify-center font-bold">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Complete Clinical Intake Summary Report</h2>
                  <p className="text-xs text-slate-400">
                    Patient: <strong className="text-slate-200">{selectedVisit.patient?.name}</strong> • MRN: <span className="font-mono text-indigo-300">{selectedVisit.patient?.mrn}</span> • Token: <span className="text-emerald-400 font-mono">#{selectedVisit.token}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-xl font-bold border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Print / PDF</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadSummary}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-xl font-bold shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download (.txt)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsSummaryModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body Sections */}
            <div className="space-y-4 text-xs text-slate-300">
              {/* Section 1: Demographics */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Age / Gender</span>
                  <span className="text-slate-100 font-semibold">{selectedVisit.patient?.age} Yrs / {selectedVisit.patient?.gender}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Contact Phone</span>
                  <span className="text-slate-100 font-semibold">{selectedVisit.patient?.phone || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Assigned Clinic</span>
                  <span className="text-slate-100 font-semibold">{selectedVisit.department?.name || 'General Medicine'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Language</span>
                  <span className="text-slate-100 font-semibold uppercase">{selectedVisit.language || 'EN'}</span>
                </div>
              </div>

              {/* Section 2: Chief Complaint & HPI */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider block">
                  1. Chief Complaint &amp; History of Present Illness (HPI)
                </span>
                <p className="text-slate-100 font-semibold text-sm">
                  {safeString(summaryData?.chiefComplaint, safeString(selectedVisit.reasonForVisit, 'Under Evaluation'))}
                </p>
                <p className="text-slate-300 leading-relaxed">
                  {safeString(summaryData?.historyOfPresentIllness, 'Patient completed structured conversational multilingual AI clinical intake at registration kiosk.')}
                </p>
              </div>

              {/* Section 3: Lifestyle & Daily Habits */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
                  2. Lifestyle, Daily Habits &amp; Routine Assessment
                </span>
                <p className="text-slate-200 leading-relaxed">
                  {safeString(summaryData?.lifestyle, 'Daily routine, sleep hours, physical activity, and stress factors evaluated during intake.')}
                </p>
              </div>

              {/* Section 4: Medical History, Medications & Allergies */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Chronic History</span>
                  <span className="text-slate-200">{safeString(summaryData?.pastMedicalHistory, 'None reported')}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Allergy Profile</span>
                  <span className={selectedVisit.patient?.allergies?.length ? 'text-red-400 font-bold' : 'text-emerald-400'}>
                    {selectedVisit.patient?.allergies?.length ? selectedVisit.patient.allergies.map((a: any) => a.allergen).join(', ') : (safeString(summaryData?.allergies, 'No Known Drug Allergies'))}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Daily Medications</span>
                  <span className="text-slate-200">{safeString(summaryData?.medications, 'None reported')}</span>
                </div>
              </div>

              {/* Section 5: Triage Vitals */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
                <span className="text-[11px] font-bold text-green-400 uppercase tracking-wider block">
                  3. Triage Vital Signs
                </span>
                <p className="text-slate-100 font-mono">
                  {selectedVisit.vitals?.[0]
                    ? `BP: ${selectedVisit.vitals[0].bpSystolic}/${selectedVisit.vitals[0].bpDiastolic} mmHg • Pulse: ${selectedVisit.vitals[0].pulse} bpm • SpO2: ${selectedVisit.vitals[0].spo2}% • Temp: ${selectedVisit.vitals[0].temperature || 98.6}°F`
                    : 'Vitals awaiting triage measurement.'}
                </p>
              </div>

              {/* Section 6: Consultation & E-Prescription */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider block">
                  4. Doctor Consultation Impression &amp; Prescriptions
                </span>
                <p className="text-slate-200">
                  <strong className="text-slate-400">Diagnosis: </strong>
                  <span className="text-emerald-400 font-semibold">{soapAssessment || impression || 'Clinical Evaluation in Progress'}</span>
                </p>
                {prescriptions.length > 0 && (
                  <div className="pt-2 border-t border-slate-900 space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Prescribed Medicines:</span>
                    {prescriptions.map((pr, pIdx) => (
                      <div key={pIdx} className="text-slate-300 font-mono text-[11px]">
                        • {pr.medicineName} — {pr.dosage} | {pr.frequency} | {pr.duration} ({pr.instructions})
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
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
