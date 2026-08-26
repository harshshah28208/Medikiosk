import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import {
  Users, Stethoscope, AlertCircle, Clock, CheckCircle2,
  FileText, Activity, ChevronRight, RefreshCw, UserCheck, Trash2,
  PlusCircle, Pill, Eye, X, Download, ExternalLink
} from 'lucide-react';

export function DoctorDashboard() {
  const [patients, setPatients] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVisit, setSelectedVisit] = useState<any | null>(null);
  const [summaryData, setSummaryData] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Document Modal State
  const [viewingDoc, setViewingDoc] = useState<any | null>(null);

  const [clinicalNotes, setClinicalNotes] = useState('');
  const [impression, setImpression] = useState('');
  const [treatmentPlan, setTreatmentPlan] = useState('');
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
      const token = localStorage.getItem('medikiosk_token');
      const response = await fetch('http://localhost:5000/api/doctor/consultation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          visitId: selectedVisit.id,
          patientId: selectedVisit.patientId || selectedVisit.patient?.id,
          clinicalNotes,
          impression,
          treatmentPlan,
          prescriptions: prescriptions.filter((p) => p.medicineName.trim()),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save consultation');
      }

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

              {/* AI Structured Summary Draft Card */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-400" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      AI Clinical Intake Summary Draft
                    </h3>
                  </div>
                  <span className="text-[11px] px-2.5 py-0.5 bg-blue-500/20 text-blue-300 rounded-full font-mono font-bold">
                    Auto-Synthesized
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300">
                  <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Chief Complaint</span>
                    <p className="text-slate-100 font-medium">{summaryData?.chiefComplaint || selectedVisit.reasonForVisit || 'Under Evaluation'}</p>
                  </div>

                  <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Vital Signs Snapshot</span>
                    <p className="text-slate-100 font-medium">
                      {selectedVisit.vitals?.[0]
                        ? `BP: ${selectedVisit.vitals[0].bpSystolic}/${selectedVisit.vitals[0].bpDiastolic} mmHg • Pulse: ${selectedVisit.vitals[0].pulse} bpm • SpO2: ${selectedVisit.vitals[0].spo2}%`
                        : 'Vitals awaiting nurse triage intake'
                      }
                    </p>
                  </div>

                  <div className="md:col-span-2 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">History of Present Illness (HPI)</span>
                    <p className="text-slate-200 leading-relaxed">
                      {summaryData?.historyOfPresentIllness || 'Patient completed conversational multilingual AI intake at registration kiosk.'}
                    </p>
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

              {/* Physician Assessment & Clinical Notes */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                      Clinical Impression / Diagnosis
                    </label>
                    <input
                      type="text"
                      value={impression}
                      onChange={(e) => setImpression(e.target.value)}
                      placeholder="e.g. Acute Viral Upper Respiratory Infection"
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                      Treatment Plan & Advice
                    </label>
                    <input
                      type="text"
                      value={treatmentPlan}
                      onChange={(e) => setTreatmentPlan(e.target.value)}
                      placeholder="e.g. Warm saline gargles, adequate hydration, follow up if fever persists"
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                    Clinical Examination & Progress Notes
                  </label>
                  <textarea
                    value={clinicalNotes}
                    onChange={(e) => setClinicalNotes(e.target.value)}
                    rows={3}
                    placeholder="Enter objective physical examination findings (e.g. Chest: Clear bilaterally, Throat: Mild erythema without exudate)..."
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
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
              {viewingDoc.extractions && viewingDoc.extractions.length > 0 && (
                <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-2">
                  <span className="text-xs font-bold uppercase text-slate-400 block">AI OCR Extracted Entities</span>
                  <pre className="text-xs text-slate-300 bg-slate-950 p-3 rounded-xl font-mono overflow-x-auto border border-slate-800">
                    {viewingDoc.extractions[0].extractedData}
                  </pre>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
