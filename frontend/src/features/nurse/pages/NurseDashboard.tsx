import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import { useAuth } from '../../../store/AuthContext';
import {
  Activity, Users, AlertTriangle, Clock, Heart,
  Flame, CheckCircle2, ChevronRight, RefreshCw, FileText,
  Eye, X, ExternalLink, Search, Stethoscope
} from 'lucide-react';

export function NurseDashboard() {
  const { user } = useAuth();
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedVisit, setSelectedVisit] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showAllHospitalPatients, setShowAllHospitalPatients] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Document Modal State
  const [viewingDoc, setViewingDoc] = useState<any | null>(null);

  const [vitals, setVitals] = useState({
    temperature: '',
    pulse: '',
    bpSystolic: '',
    bpDiastolic: '',
    respRate: '',
    spo2: '',
    weight: '',
    height: '',
    bloodGlucose: '',
    painScore: '0',
    notes: '',
  });

  const calculateBMI = () => {
    const w = parseFloat(vitals.weight);
    const h = parseFloat(vitals.height) / 100; // in meters
    if (w > 0 && h > 0) {
      const bmi = w / (h * h);
      return bmi.toFixed(1);
    }
    return null;
  };

  const getBMICategory = (bmiVal: number) => {
    if (bmiVal < 18.5) return { label: 'Underweight', color: 'text-amber-400' };
    if (bmiVal < 25) return { label: 'Normal Weight', color: 'text-emerald-400' };
    if (bmiVal < 30) return { label: 'Overweight', color: 'text-amber-400' };
    return { label: 'Obese', color: 'text-red-400' };
  };

  const activeNurseName = localStorage.getItem('medikiosk_active_nurse_name') || user?.name || 'Nursing Station & Vitals Intake';
  const activeNurseRoom = localStorage.getItem('medikiosk_active_nurse_room') || 'Room 103';

  const loadPatients = async (showAll = showAllHospitalPatients) => {
    setIsLoading(true);
    try {
      let visitList: any[] = [];
      const res = await api.doctor.patients(showAll);
      if (res?.visits && Array.isArray(res.visits)) {
        visitList = res.visits;
      } else {
        const vRes = await api.visits.list().catch(() => null);
        if (vRes?.visits && Array.isArray(vRes.visits)) {
          visitList = vRes.visits;
        }
      }

      // Check localStorage for the active visit so newly queued patient is selected
      const localActiveVisit = localStorage.getItem('medikiosk_active_visit');
      const localActivePatient = localStorage.getItem('medikiosk_active_patient');
      if (localActiveVisit) {
        try {
          const parsedV = JSON.parse(localActiveVisit);
          if (localActivePatient) {
            parsedV.patient = JSON.parse(localActivePatient);
          }
          if (!visitList.some((v) => v.id === parsedV.id)) {
            visitList.unshift(parsedV);
          }
        } catch {}
      }

      setPatients(visitList);
      if (visitList.length > 0) {
        let targetToSelect = null;
        if (localActiveVisit) {
          try {
            const localActive = JSON.parse(localActiveVisit);
            targetToSelect = visitList.find((v: any) => v.id === localActive.id);
          } catch {}
        }

        if (targetToSelect) {
          handleSelectPatient(targetToSelect);
        } else if (selectedVisit) {
          const stillThere = visitList.find((v: any) => v.id === selectedVisit.id);
          if (stillThere) {
            handleSelectPatient(stillThere);
          } else {
            handleSelectPatient(visitList[0]);
          }
        } else {
          handleSelectPatient(visitList[0]);
        }
      } else {
        setSelectedVisit(null);
      }
    } catch (e) {
      console.error('Failed to load queue:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPatients(showAllHospitalPatients);
  }, [showAllHospitalPatients]);

  const handleSelectPatient = async (visit: any) => {
    setSelectedVisit(visit);
    setSuccessMessage(null);
    try {
      const res = await api.visits.get(visit.id);
      if (res?.visit) {
        setSelectedVisit(res.visit);
        if (res.visit.vitals && res.visit.vitals.length > 0) {
          const v = res.visit.vitals[0];
          setVitals({
            temperature: v.temperature?.toString() || '',
            pulse: v.pulse?.toString() || '',
            bpSystolic: v.bpSystolic?.toString() || '',
            bpDiastolic: v.bpDiastolic?.toString() || '',
            respRate: v.respRate?.toString() || '',
            spo2: v.spo2?.toString() || '',
            weight: v.weight?.toString() || '',
            height: v.height?.toString() || '',
            bloodGlucose: v.bloodGlucose?.toString() || '',
            painScore: v.painScore?.toString() || '0',
            notes: v.notes || '',
          });
        } else {
          setVitals({
            temperature: '',
            pulse: '',
            bpSystolic: '',
            bpDiastolic: '',
            respRate: '',
            spo2: '',
            weight: '',
            height: '',
            bloodGlucose: '',
            painScore: '0',
            notes: '',
          });
        }
      }
    } catch (e) {
      console.error('Failed to fetch patient vitals:', e);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setVitals({
      ...vitals,
      [e.target.name]: e.target.value,
    });
  };

  const handleRecordVitals = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVisit) return;

    setIsSubmitting(true);
    setSuccessMessage(null);

    const vitalPayload = {
      visitId: selectedVisit.id,
      patientId: selectedVisit.patientId || selectedVisit.patient?.id,
      temperature: vitals.temperature ? parseFloat(vitals.temperature) : undefined,
      pulse: vitals.pulse ? parseInt(vitals.pulse, 10) : undefined,
      bpSystolic: vitals.bpSystolic ? parseInt(vitals.bpSystolic, 10) : undefined,
      bpDiastolic: vitals.bpDiastolic ? parseInt(vitals.bpDiastolic, 10) : undefined,
      respRate: vitals.respRate ? parseInt(vitals.respRate, 10) : undefined,
      spo2: vitals.spo2 ? parseInt(vitals.spo2, 10) : undefined,
      weight: vitals.weight ? parseFloat(vitals.weight) : undefined,
      height: vitals.height ? parseFloat(vitals.height) : undefined,
      bmi: calculateBMI() ? parseFloat(calculateBMI()!) : undefined,
      painScore: vitals.painScore ? parseInt(vitals.painScore, 10) : 0,
      notes: `${vitals.bloodGlucose ? `Blood Glucose: ${vitals.bloodGlucose} mg/dL. ` : ''}${vitals.notes || ''}`.trim(),
      recordedAt: new Date().toISOString(),
    };

    try {
      await api.vitals.record(vitalPayload);

      // Instant live sync to local storage for patient portal & doctor session
      try {
        const activeV = localStorage.getItem('medikiosk_active_visit');
        if (activeV) {
          const parsed = JSON.parse(activeV);
          if (parsed.id === selectedVisit.id || !parsed.id) {
            parsed.vitals = [vitalPayload, ...(parsed.vitals || [])];
            parsed.status = 'VITALS_RECORDED';
            localStorage.setItem('medikiosk_active_visit', JSON.stringify(parsed));
          }
        }
        localStorage.setItem(`medikiosk_vitals_${selectedVisit.id}`, JSON.stringify(vitalPayload));
      } catch {}

      setSuccessMessage('✅ Vitals recorded successfully. Synced to Physician & Patient portal.');
      loadPatients();
    } catch (err: any) {
      console.error('Error submitting vitals:', err);
      alert(`Error submitting vitals: ${err.message || 'Please check staff login.'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredPatients = patients.filter((visit: any) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const name = (visit.patient?.name || '').toLowerCase();
    const mrn = (visit.patient?.mrn || '').toLowerCase();
    const token = String(visit.token || '').toLowerCase();
    const phone = (visit.patient?.phone || '').toLowerCase();
    const reason = (visit.reasonForVisit || '').toLowerCase();
    const doc = (visit.doctor?.user?.name || visit.doctor?.name || '').toLowerCase();
    return name.includes(q) || mrn.includes(q) || token.includes(q) || phone.includes(q) || reason.includes(q) || doc.includes(q);
  });

  const attachedDocs = selectedVisit?.documents || selectedVisit?.patient?.documents || [];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-green-600 rounded-2xl flex items-center justify-center text-white font-bold shadow-lg shadow-green-600/30">
            <Activity className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white">
                {activeNurseName}
              </h1>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-green-500/20 text-green-300 border border-green-500/30 font-mono">
                {activeNurseRoom}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Record Patient Biometrics • View Attached PDF Records • Live Synced to Doctor & Patient Portal
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
        {/* Left: Patient Queue */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-green-400" />
              <span>Assigned Patients</span>
            </h2>
            <span className="text-xs font-mono font-bold px-2 py-0.5 bg-green-500/20 text-green-300 rounded-full">
              {filteredPatients.length} Waiting
            </span>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Name, MRN, Token #..."
              className="w-full pl-9 pr-8 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:ring-1 focus:ring-green-500 transition-all"
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

          {/* Filter Toggle: Paired Doctor's OPD vs All Hospital */}
          <div className="flex items-center p-1 bg-slate-950/60 rounded-xl border border-slate-800/80 text-[11px]">
            <button
              onClick={() => setShowAllHospitalPatients(false)}
              className={`flex-1 py-1 px-2 rounded-lg font-semibold transition-all cursor-pointer truncate ${
                !showAllHospitalPatients
                  ? 'bg-slate-800 text-slate-100 shadow-sm'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              👤 Paired Doctor's OPD
            </button>
            <button
              onClick={() => setShowAllHospitalPatients(true)}
              className={`flex-1 py-1 px-2 rounded-lg font-semibold transition-all cursor-pointer truncate ${
                showAllHospitalPatients
                  ? 'bg-slate-800 text-slate-100 shadow-sm'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              🏥 All Hospital OPD
            </button>
          </div>

          <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-1">
            {filteredPatients.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs bg-slate-950 rounded-2xl border border-slate-800/60">
                {searchQuery ? `No patients matching "${searchQuery}".` : 'No patients currently waiting for vitals intake.'}
              </div>
            ) : filteredPatients.map((visit) => {
              const isSelected = selectedVisit?.id === visit.id;
              const hasDocs = (visit.documents && visit.documents.length > 0) || (visit.patient?.documents && visit.patient?.documents.length > 0);
              const hasVitalsRecorded = visit.vitals && visit.vitals.length > 0;
              const docName = visit.doctor?.user?.name || visit.doctor?.name;

              return (
                <button
                  key={visit.id}
                  onClick={() => handleSelectPatient(visit)}
                  className={`
                    w-full p-4 rounded-2xl text-left transition-all border cursor-pointer
                    ${isSelected
                      ? 'bg-green-600/20 border-green-500 shadow-md scale-[1.01]'
                      : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800'
                    }
                  `}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 bg-slate-800 rounded text-green-300 border border-slate-700">
                      Token #{visit.token || 'G-101'}
                    </span>
                    <div className="flex items-center gap-1">
                      {hasDocs && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded font-bold">
                          PDF
                        </span>
                      )}
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${hasVitalsRecorded ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                        {hasVitalsRecorded ? '✓ Vitals Done' : 'Pending'}
                      </span>
                    </div>
                  </div>
                  <h3 className="text-sm font-bold text-slate-100">{visit.patient?.name}</h3>
                  <p className="text-xs text-slate-400">MRN: {visit.patient?.mrn} • {visit.patient?.age || 45}Y • {visit.patient?.gender}</p>
                  
                  {docName && (
                    <p className="text-[10px] text-green-400/90 font-medium mt-1 truncate flex items-center gap-1">
                      <Stethoscope className="w-3 h-3 shrink-0" />
                      <span>Doctor: {docName}</span>
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Vitals Entry Form & Attached Records */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          {selectedVisit ? (
            <form onSubmit={handleRecordVitals} className="space-y-6">
              <div className="pb-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">{selectedVisit.patient?.name}</h2>
                  <p className="text-xs text-slate-400">Token: #{selectedVisit.token} • MRN: {selectedVisit.patient?.mrn}</p>
                </div>
                {attachedDocs.length > 0 && (
                  <span className="text-xs px-3 py-1 bg-blue-500/20 text-blue-300 font-bold rounded-xl border border-blue-500/30">
                    📎 {attachedDocs.length} Attached PDF / Records
                  </span>
                )}
              </div>

              {/* Uploaded PDF Records Inspection Card */}
              {attachedDocs.length > 0 && (
                <div className="p-4 bg-blue-950/20 border border-blue-500/30 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-300 uppercase tracking-wider flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-400" />
                      <span>Uploaded Patient Records (PDF & Prescriptions)</span>
                    </span>
                    <span className="text-[10px] text-blue-400 font-medium">Click to inspect</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {attachedDocs.map((doc: any, dIdx: number) => (
                      <div
                        key={dIdx}
                        onClick={() => setViewingDoc(doc)}
                        className="bg-slate-950 p-3 rounded-xl border border-slate-800 hover:border-blue-500 cursor-pointer transition-all flex items-center justify-between text-xs group"
                      >
                        <div className="truncate mr-2">
                          <span className="font-semibold text-slate-100 block truncate group-hover:text-blue-400 transition-colors">
                            {doc.title}
                          </span>
                          <span className="text-[10px] text-slate-500">{doc.fileType}</span>
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

              {successMessage && (
                <div className="p-4 bg-green-900/40 border border-green-500/50 rounded-2xl flex items-center gap-2 text-green-300 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Blood Pressure Systolic (mmHg)</label>
                  <input
                    type="number"
                    name="bpSystolic"
                    value={vitals.bpSystolic}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Blood Pressure Diastolic (mmHg)</label>
                  <input
                    type="number"
                    name="bpDiastolic"
                    value={vitals.bpDiastolic}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Pulse / Heart Rate (bpm)</label>
                  <input
                    type="number"
                    name="pulse"
                    value={vitals.pulse}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">SpO2 Blood Oxygen (%)</label>
                  <input
                    type="number"
                    name="spo2"
                    value={vitals.spo2}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Body Temperature (°F)</label>
                  <input
                    type="number"
                    step="0.1"
                    name="temperature"
                    value={vitals.temperature}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Respiratory Rate (breaths/min)</label>
                  <input
                    type="number"
                    name="respRate"
                    value={vitals.respRate}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    name="weight"
                    value={vitals.weight}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Height (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    name="height"
                    value={vitals.height}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Random Blood Glucose (mg/dL)</label>
                  <input
                    type="number"
                    name="bloodGlucose"
                    value={vitals.bloodGlucose}
                    onChange={handleChange}
                    placeholder="e.g. 110"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Pain Scale (0-10)</label>
                  <select
                    name="painScore"
                    value={vitals.painScore}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-green-500"
                  >
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                      <option key={n} value={n}>
                        {n} {n === 0 ? '- No Pain' : n >= 8 ? '- Severe' : '- Moderate'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Auto-computed BMI Card */}
                {calculateBMI() && (
                  <div className="p-3 bg-slate-950 border border-slate-700 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Calculated BMI</span>
                      <span className="text-base font-mono font-bold text-white">{calculateBMI()} kg/m²</span>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 ${getBMICategory(parseFloat(calculateBMI()!)).color}`}>
                      {getBMICategory(parseFloat(calculateBMI()!)).label}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Nursing Triage Notes</label>
                <textarea
                  name="notes"
                  rows={2}
                  value={vitals.notes}
                  onChange={handleChange}
                  placeholder="Enter observation notes (e.g. Patient appears comfortable, no acute distress)..."
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-green-500"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold rounded-2xl shadow-lg shadow-green-600/30 transition-all text-base touch-target-lg"
              >
                {isSubmitting ? 'Recording Vitals...' : 'Submit Vitals & Update Patient Queue'}
              </button>
            </form>
          ) : (
            <div className="text-center py-12 text-slate-500">
              Select a patient from the queue to record vitals.
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
                <div className="w-10 h-10 bg-green-600/20 text-green-400 rounded-xl flex items-center justify-center font-bold">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{viewingDoc.title}</h3>
                  <p className="text-xs text-slate-400">Category: {viewingDoc.fileType}</p>
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
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
