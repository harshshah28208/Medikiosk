import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import {
  Users, Stethoscope, AlertCircle, Clock, CheckCircle2,
  FileText, Activity, ChevronRight, RefreshCw, UserCheck, Trash2,
  PlusCircle, Pill, Eye, X, Download, ExternalLink, History, 
  ShieldAlert, ChevronDown, ChevronUp, ClipboardList
} from 'lucide-react';

export function DoctorDashboard() {
  const [patients, setPatients] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVisit, setSelectedVisit] = useState<any | null>(null);
  const [summaryData, setSummaryData] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [expandedSection, setExpandedSection] = useState<string | null>('hpi');
  const [showOriginalAnswers, setShowOriginalAnswers] = useState(false);
  const [summaryStatus, setSummaryStatus] = useState<'DRAFT' | 'CONFIRMED' | 'EDITED'>('DRAFT');

  // Document Modal State
  const [viewingDoc, setViewingDoc] = useState<any | null>(null);

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

  const loadPatients = async () => {
    setIsLoading(true);
    try {
      const res = await api.visits.list();
      if (res?.visits) {
        setPatients(res.visits);
        if (res.visits.length > 0 && !selectedVisit) {
          handleSelectPatient(res.visits[0]);
        }
      }
    } catch (e) {
      console.error('Failed to load patients:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPatients();
  }, []);

  const handleSelectPatient = async (visit: any) => {
    setSelectedVisit(visit);
    setSummaryData(null);
    setTimeline([]);
    setSoapSubjective('');
    setSoapObjective('');
    setSoapAssessment('');
    setSoapPlan('');
    try {
      const res = await api.visits.get(visit.id);
      if (res?.visit) {
        setSelectedVisit(res.visit);
        if (res.visit.summary) {
          const sJson = typeof res.visit.summary.summaryJson === 'string'
            ? JSON.parse(res.visit.summary.summaryJson)
            : res.visit.summary.summaryJson;
          setSummaryData(sJson);
          setImpression(sJson.chiefComplaint || visit.reasonForVisit || '');
          // Pre-fill SOAP from AI summary
          setSoapSubjective(sJson.historyOfPresentIllness || '');
          setSoapAssessment(sJson.chiefComplaint || '');
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
    if (!selectedVisit) return;
    setIsSaving(true);
    try {
      await api.doctor.consultation({
        visitId: selectedVisit.id,
        patientId: selectedVisit.patientId || selectedVisit.patient?.id,
        clinicalNotes: `${soapSubjective ? `S: ${soapSubjective}\n` : ''}${soapObjective ? `O: ${soapObjective}\n` : ''}${clinicalNotes}`.trim(),
        impression: soapAssessment || impression,
        diagnosis: soapAssessment || impression,
        treatmentPlan: soapPlan || treatmentPlan,
        prescriptions: prescriptions.filter((p) => p.medicineName.trim()),
      });
      alert('✅ Consultation & E-Prescription signed and saved successfully! Patient timeline updated.');
      loadPatients();
    } catch (e: any) {
      console.error('Consultation save error:', e);
      alert(`Error saving consultation: ${e.message || 'Please ensure you are logged in as a Doctor.'}`);
    } finally {
      setIsSaving(false);
    }
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
            <h1 className="text-xl font-bold text-white">Physician Clinical Command Center</h1>
            <p className="text-xs text-slate-400">AI-Draft Summary Review • Vitals Inspection • Document PDF Inspection • Digital E-Prescription (Rx)</p>
          </div>
        </div>

        <button
          onClick={loadPatients}
          className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-2 border border-slate-700 transition-colors self-start sm:self-auto touch-target"
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
              {patients.length} Waiting
            </span>
          </div>

          <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
            {patients.map((visit) => {
              const isSelected = selectedVisit?.id === visit.id;
              const hasAlert = visit.emergencyAlerts && visit.emergencyAlerts.length > 0;
              const hasDocs = (visit.documents && visit.documents.length > 0) || (visit.patient?.documents && visit.patient?.documents.length > 0);

              return (
                <button
                  key={visit.id}
                  onClick={() => handleSelectPatient(visit)}
                  className={`
                    w-full p-4 rounded-2xl text-left transition-all border
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

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80 text-[10px] text-slate-500">
                    <span className="truncate max-w-[160px]">Reason: {visit.reasonForVisit || 'General OPD'}</span>
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
                    {summaryData?.pastMedicalHistory || 'None on record'}
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Active Medications</span>
                  <span className="font-semibold text-slate-200 truncate block">
                    {summaryData?.medications || 'None reported'}
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Prior Visits (Timeline)</span>
                  <span className="font-semibold text-indigo-400">
                    {timeline.length} previous visits recorded
                  </span>
                </div>
              </div>

              {/* Contradiction Detection Banner (Item 31) */}
              {selectedVisit.patient?.allergies?.length > 0 && /no known|nkda/i.test(summaryData?.allergies || '') && (
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
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowOriginalAnswers(!showOriginalAnswers)}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl font-medium border border-slate-700 transition-colors flex items-center gap-1.5"
                    >
                      <ClipboardList className="w-3.5 h-3.5 text-blue-400" />
                      <span>{showOriginalAnswers ? 'Hide Raw Answers' : 'View Original Answers'}</span>
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
                    <p className="text-slate-100 font-semibold">{summaryData?.chiefComplaint || selectedVisit.reasonForVisit || 'Under Evaluation'}</p>
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
                      <span className="text-[9px] px-1.5 py-0.5 bg-purple-900/40 text-purple-300 rounded font-mono">Gemini Clinical Engine</span>
                    </div>
                    <p className="text-slate-200 leading-relaxed">
                      {summaryData?.historyOfPresentIllness || 'Patient completed conversational multilingual AI intake at registration kiosk.'}
                    </p>
                  </div>

                  {/* Lifestyle & Routine */}
                  {summaryData?.lifestyle && (
                    <div className="md:col-span-2 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Daily Routine & Lifestyle Factors</span>
                        <span className="text-[9px] px-1.5 py-0.5 bg-amber-900/40 text-amber-300 rounded font-mono">Kiosk Stage 6</span>
                      </div>
                      <p className="text-slate-200 leading-relaxed">{summaryData.lifestyle}</p>
                    </div>
                  )}

                  {/* Past Medical History */}
                  <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Past Medical History</span>
                      <span className="text-[9px] px-1.5 py-0.5 bg-indigo-900/40 text-indigo-300 rounded font-mono">Self-Declared</span>
                    </div>
                    <p className="text-slate-200">{summaryData?.pastMedicalHistory || 'None reported'}</p>
                  </div>

                  {/* Current Medications */}
                  <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Current Medications</span>
                      <span className="text-[9px] px-1.5 py-0.5 bg-indigo-900/40 text-indigo-300 rounded font-mono">Active Rx</span>
                    </div>
                    <p className="text-slate-200">{summaryData?.medications || 'No regular medicines'}</p>
                  </div>

                  {/* Allergies */}
                  <div className="md:col-span-2 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Allergies & Sensitivities</span>
                      <span className="text-[9px] px-1.5 py-0.5 bg-red-900/40 text-red-300 rounded font-mono">Safety Check</span>
                    </div>
                    <p className="text-slate-200">{summaryData?.allergies || 'No known drug allergies (NKDA)'}</p>
                  </div>

                  {/* Uploaded Past PDF Documents / Prescriptions */}
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
                                {doc.title}
                              </span>
                              <span className="text-[10px] text-slate-500">{doc.fileType} • {new Date(doc.uploadedAt || Date.now()).toLocaleDateString()}</span>
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

              {/* Longitudinal Timeline Panel */}
              {timeline.length > 0 && (
                <div className="bg-slate-950 border border-slate-700 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-slate-300 text-xs font-bold uppercase tracking-wider">
                    <History className="w-4 h-4 text-indigo-400" />
                    <span>Longitudinal Patient History ({timeline.length} past visits)</span>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {timeline.map((tl: any, i: number) => (
                      <div key={i} className="flex items-start gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                          V{timeline.length - i}
                        </div>
                        <div className="text-xs text-slate-300">
                          <span className="font-semibold text-slate-100 block">{tl.chiefComplaint || 'OPD Visit'}</span>
                          <span className="text-slate-500">{tl.date ? new Date(tl.date).toLocaleDateString() : 'Past Visit'} • {tl.department || 'General'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Red Flag Inline Alert */}
              {selectedVisit?.emergencyAlerts && selectedVisit.emergencyAlerts.length > 0 && (
                <div className="p-3.5 bg-red-950/40 border border-red-500/40 rounded-2xl flex items-center gap-3">
                  <ShieldAlert className="w-5 h-5 text-red-400 animate-pulse shrink-0" />
                  <div className="text-xs">
                    <span className="font-bold text-red-300 block">🔴 Red Flag Detected by AI Triage</span>
                    <span className="text-red-400/80">{selectedVisit.emergencyAlerts[0].description}</span>
                  </div>
                  <span className="ml-auto text-[10px] font-bold px-2 py-1 bg-red-500/20 text-red-300 rounded-full border border-red-500/30">
                    {selectedVisit.emergencyAlerts[0].severity}
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

              {/* Submission Action */}
              <div className="pt-4 border-t border-slate-800 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveConsultation}
                  disabled={isSaving}
                  className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-2xl shadow-lg shadow-blue-600/30 flex items-center gap-2 transition-all touch-target-lg"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>{isSaving ? 'Finalizing...' : 'Confirm Assessment & Sign Digital Rx'}</span>
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

    </div>
  );
}
