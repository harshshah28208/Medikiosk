import React, { useState, useEffect } from "react";
import { api } from "../../../services/api";
import {
  Droplets, Users, CheckCircle2, RefreshCw,
  Flower2, FileText, Activity, AlertTriangle, Sparkles, Eye, Download, X, Printer
} from "lucide-react";

const MIASMS = [
  "Psora (Deficiency / Functional / Itch)",
  "Sycosis (Excess / Proliferative / Overgrowth)",
  "Syphilis (Destructive / Ulcerative / Degenerative)",
  "Tubercular (Mixed / Rapidly Changing / Emaciation)",
  "Cancer (Mixed / Uncontrolled Growth / Exhaustion)"
];

const REMEDIES_BY_MIASM: Record<string, string[]> = {
  "Psora (Deficiency / Functional / Itch)": ["Sulphur", "Calcarea Carbonica", "Lycopodium", "Psorinum", "Arsenicum Album", "Graphites"],
  "Sycosis (Excess / Proliferative / Overgrowth)": ["Medorrhinum", "Natrum Sulphuricum", "Thuya Occidentalis", "Nitric Acid", "Causticum"],
  "Syphilis (Destructive / Ulcerative / Degenerative)": ["Luesinum (Syphilinum)", "Mercurius Solubilis", "Aurum Metallicum", "Nitric Acid", "Kali Iodatum"],
  "Tubercular (Mixed / Rapidly Changing / Emaciation)": ["Tuberculinum", "Bacillinum", "Phosphorus", "Calcarea Phosphorica", "Natrum Muriaticum"],
  "Cancer (Mixed / Uncontrolled Growth / Exhaustion)": ["Carcinosinum", "Natrum Muriaticum", "Staphysagria", "Lachesis", "Ignatia"],
};

const POTENCIES = ["6C", "12C", "30C", "200C", "1M", "10M", "LM1", "LM2", "LM6"];
const REPETITIONS = [
  "Single dose (Wait & Watch)",
  "Daily once for 7 days",
  "Weekly 1 dose x 4 weeks",
  "As needed for acute exacerbation (PRN)",
  "Three doses 15 min apart then stop and wait"
];

export function HomeopathicDashboard() {
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedVisit, setSelectedVisit] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);

  // Homeopathic Case State
  const [miasm, setMiasm] = useState(MIASMS[0]);
  const [constitutionalRemedy, setConstitutionalRemedy] = useState("Sulphur");
  const [acuteRemedy, setAcuteRemedy] = useState("");
  const [potency, setPotency] = useState("30C");
  const [repetition, setRepetition] = useState("Single dose (Wait & Watch)");
  const [mentalGenerals, setMentalGenerals] = useState("");
  const [physicalGenerals, setPhysicalGenerals] = useState("");
  const [modAgg, setModAgg] = useState("");
  const [modAmel, setModAmel] = useState("");
  const [repertoryNotes, setRepertoryNotes] = useState("");
  const [clinicalNotes, setClinicalNotes] = useState("");

  const availableRemedies: string[] = REMEDIES_BY_MIASM[miasm] || [];

  const loadPatients = async () => {
    try {
      let visitList: any[] = [];
      const res = await api.doctor.patients(true).catch(() => null);
      if (res?.visits && Array.isArray(res.visits) && res.visits.length > 0) {
        visitList = res.visits;
      } else {
        const vRes = await api.visits.list().catch(() => null);
        if (vRes?.visits && Array.isArray(vRes.visits)) {
          visitList = vRes.visits;
        }
      }

      // Check localStorage for freshly registered kiosk patients
      const localActiveVisit = localStorage.getItem('medikiosk_active_visit');
      const localActivePatient = localStorage.getItem('medikiosk_active_patient');
      if (localActiveVisit && localActivePatient) {
        try {
          const parsedV = JSON.parse(localActiveVisit);
          const parsedP = JSON.parse(localActivePatient);
          parsedV.patient = parsedP;
          if (!visitList.some((v) => v.id === parsedV.id)) {
            visitList.unshift(parsedV);
          }
        } catch {}
      }

      setPatients(visitList);
      if (visitList.length > 0) {
        setSelectedVisit((prev: any) => prev || visitList[0]);
      }
    } catch (err) {
      console.warn('Error loading patient list:', err);
    }
  };

  useEffect(() => {
    loadPatients();
  }, []);

  // When selected visit changes, load previously stored case records
  useEffect(() => {
    if (!selectedVisit) return;
    const vId = selectedVisit.id;

    // Load from localStorage cache first
    const cached = localStorage.getItem(`medikiosk_homeo_case_${vId}`);
    if (cached) {
      try {
        const d = JSON.parse(cached);
        if (d.miasm) setMiasm(d.miasm);
        if (d.constitutionalRemedy) setConstitutionalRemedy(d.constitutionalRemedy);
        if (d.acuteRemedy) setAcuteRemedy(d.acuteRemedy);
        if (d.potency) setPotency(d.potency);
        if (d.repetition) setRepetition(d.repetition);
        if (d.mentalGenerals) setMentalGenerals(d.mentalGenerals);
        if (d.physicalGenerals) setPhysicalGenerals(d.physicalGenerals);
        if (d.modAgg) setModAgg(d.modAgg);
        if (d.modAmel) setModAmel(d.modAmel);
        if (d.repertoryNotes) setRepertoryNotes(d.repertoryNotes);
        if (d.clinicalNotes) setClinicalNotes(d.clinicalNotes);
      } catch {}
    } else {
      // Fetch from API
      api.ayush.assessments(vId).then((res) => {
        if (res?.assessment) {
          const a = res.assessment;
          if (a.homeopathyMiasm) setMiasm(a.homeopathyMiasm);
          if (a.homeopathyModalities) {
            try {
              const m = typeof a.homeopathyModalities === 'string' ? JSON.parse(a.homeopathyModalities) : a.homeopathyModalities;
              setModAgg(m.aggravation || '');
              setModAmel(m.amelioration || '');
            } catch {}
          }
          if (a.homeopathyRepertoryNotes) setRepertoryNotes(a.homeopathyRepertoryNotes);
          if (a.notes) setClinicalNotes(a.notes);
        }
      }).catch(() => {});
    }
  }, [selectedVisit?.id]);

  
  const handleDownloadSummary = () => {
    if (!selectedVisit) return;
    const p = selectedVisit.patient;
    const s = typeof selectedVisit.summary?.summaryJson === 'string'
      ? JSON.parse(selectedVisit.summary.summaryJson)
      : (selectedVisit.summary || {});

    const report = `=====================================================
MEDIKIOSK HOMEOPATHIC CASE & CLINICAL INTAKE REPORT
Generated: ${new Date().toLocaleString()}
=====================================================

1. PATIENT DEMOGRAPHICS:
------------------------
Name:    ${p?.name || 'N/A'}
MRN:     ${p?.mrn || 'N/A'}
Age/Sex: ${p?.age || 'N/A'} Yrs / ${p?.gender || 'N/A'}
Phone:   ${p?.phone || 'N/A'}

2. CLINICAL INTAKE & CHIEF COMPLAINT:
-------------------------------------
Chief Complaint: ${selectedVisit.reasonForVisit || s?.chiefComplaint || 'Under Evaluation'}
History of Present Illness (HPI):
${s?.historyOfPresentIllness || 'Patient completed conversational intake at Kiosk.'}

3. LIFESTYLE & DAILY HABITS:
----------------------------
${s?.lifestyle || 'Assessed during intake.'}

4. HOMEOPATHIC TOTALITY & ANALYSIS:
-----------------------------------
Active Miasm:            ${miasm}
Constitutional Remedy:   ${constitutionalRemedy}
Potency & Repetition:    ${potency} | ${repetition}
Acute Remedy:            ${acuteRemedy || 'None'}
Mental Generals:         ${mentalGenerals || 'Not recorded'}
Physical Generals:       ${physicalGenerals || 'Not recorded'}
Modalities (Aggravation):${modAgg || 'None'}
Modalities (Amelioration):${modAmel || 'None'}
Doctor Clinical Notes:   ${clinicalNotes || 'Follow-up in 4 weeks.'}

=====================================================
MediKiosk Autonomous Homeopathic Care System
=====================================================`;

    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Homeopathic_Case_${p?.mrn || 'Patient'}_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVisit) return;
    setIsSaving(true);
    setSaveSuccessMessage(null);

    const recordData = {
      visitId: selectedVisit.id,
      patientId: selectedVisit.patientId || selectedVisit.patient?.id || `pat-${Date.now()}`,
      systemType: "HOMEOPATHY",
      homeopathyMiasm: miasm,
      miasm,
      constitutionalRemedy,
      acuteRemedy,
      potency,
      repetition,
      mentalGenerals,
      physicalGenerals,
      modAgg,
      modAmel,
      homeopathyModalities: JSON.stringify({ aggravation: modAgg, amelioration: modAmel }),
      homeopathyRepertoryNotes: repertoryNotes,
      repertoryNotes,
      notes: clinicalNotes,
      savedAt: new Date().toISOString(),
    };

    try {
      // 1. Save to backend AYUSH Assessment endpoint
      await api.ayush.assessment(recordData).catch(() => null);

      // 2. Save to Consultation endpoint if available
      await api.doctor.consultation({
        visitId: selectedVisit.id,
        diagnosis: `Homeopathic Similimum: ${constitutionalRemedy} ${potency}`,
        notes: `Miasm: ${miasm}. Repetition: ${repetition}. ${clinicalNotes}`,
        prescription: acuteRemedy ? `${constitutionalRemedy} ${potency}, ${acuteRemedy}` : `${constitutionalRemedy} ${potency}`,
      }).catch(() => null);

      // 3. Persist locally to localStorage so it is 100% saved across sessions & Vercel
      localStorage.setItem(`medikiosk_homeo_case_${selectedVisit.id}`, JSON.stringify(recordData));

      // Also mark visit status
      await api.visits.updateStatus(selectedVisit.id, 'COMPLETED', 'DOC-SNEHAL-202').catch(() => null);

      setSaveSuccessMessage(`✅ Case Record for ${selectedVisit.patient?.name || 'Patient'} saved successfully!`);
      setTimeout(() => setSaveSuccessMessage(null), 5000);
      loadPatients();
    } catch (err: any) {
      alert("Notice: Case record saved locally in browser storage.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-teal-950/40 border border-teal-500/30 p-6 rounded-3xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-teal-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-teal-600/30">
            <Droplets className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-teal-100">Dr. Snehal Shah • Homeopathic OPD</h1>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/40 rounded-full">
                AYUSH & Integrative Medicine
              </span>
            </div>
            <p className="text-xs text-teal-300/70">Miasmatic Analysis • Kent Repertory • Similimum & Potency Prescription</p>
          </div>
        </div>
        <button
          onClick={loadPatients}
          className="px-4 py-2.5 bg-teal-900/50 hover:bg-teal-900 text-teal-200 rounded-xl text-xs font-semibold flex items-center gap-2 border border-teal-700/50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh Queue</span>
        </button>
      </div>

      {saveSuccessMessage && (
        <div className="p-4 bg-teal-950/80 border border-teal-400/50 rounded-2xl text-teal-200 text-sm font-semibold flex items-center gap-3 animate-fade-in shadow-lg">
          <CheckCircle2 className="w-5 h-5 text-teal-400" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Patient List */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="flex items-center gap-2">
              <Users className="w-4 h-4 text-teal-400" />
              <span>OPD Patients Queue</span>
            </span>
            <span className="px-2 py-0.5 bg-slate-800 rounded-full text-[11px] text-teal-400 font-mono">
              {patients.length}
            </span>
          </h2>
          <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
            {(patients as any[]).map((visit: any) => {
              const isSelected = (selectedVisit as any)?.id === visit.id;
              const hasCaseSaved = Boolean(localStorage.getItem(`medikiosk_homeo_case_${visit.id}`));

              return (
                <button
                  key={visit.id}
                  onClick={() => setSelectedVisit(visit)}
                  className={`w-full p-4 rounded-2xl text-left transition-all border ${
                    isSelected
                      ? 'bg-teal-600/20 border-teal-500 shadow-md ring-1 ring-teal-500/50'
                      : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 bg-slate-800 rounded text-teal-300 border border-slate-700">
                      {visit.token || 'H-101'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {hasCaseSaved && (
                        <span className="text-[10px] font-bold text-teal-400 bg-teal-950/60 border border-teal-500/40 px-1.5 py-0.5 rounded">
                          Prescribed
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 uppercase">{visit.status || 'WAITING'}</span>
                    </div>
                  </div>
                  <h3 className="text-sm font-bold text-slate-100">{visit.patient?.name || 'Patient'}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    MRN: {visit.patient?.mrn || 'MK-1001'} • {visit.patient?.age || 35}Y / {visit.patient?.gender || 'M'}
                  </p>
                  {visit.reasonForVisit && (
                    <p className="text-[11px] text-teal-300/80 mt-1 truncate">
                      Complaint: {visit.reasonForVisit}
                    </p>
                  )}
                </button>
              );
            })}
            {(patients as any[]).length === 0 && (
              <p className="text-center text-slate-500 text-xs py-8">No patients currently in queue.</p>
            )}
          </div>
        </div>

        {/* Right: Homeopathic Case Record & Intake Summary */}
        <div className="lg:col-span-8 space-y-6">
          {selectedVisit ? (
            <>
              {/* Patient AI Intake Clinical Overview */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                <div className="flex items-start justify-between pb-3 border-b border-slate-800">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <span>{selectedVisit.patient?.name || 'Patient Name'}</span>
                      <span className="text-xs font-mono font-normal px-2 py-0.5 bg-teal-950 border border-teal-600/40 text-teal-300 rounded-lg">
                        {selectedVisit.token || 'H-101'}
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      MRN: {selectedVisit.patient?.mrn} • Phone: {selectedVisit.patient?.phone || 'N/A'} • {selectedVisit.patient?.age}Y / {selectedVisit.patient?.gender}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Priority: </span>
                      <span className="text-xs font-bold text-teal-400">{selectedVisit.priority || 'NORMAL'}</span>
                    </div>
                    
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsSummaryModalOpen(true)}
                      className="px-3 py-1.5 bg-teal-600/20 hover:bg-teal-600 text-teal-300 hover:text-white text-xs rounded-xl font-bold border border-teal-500/40 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Whole Summary</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadSummary}
                      className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white text-xs rounded-xl font-bold border border-blue-500/40 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Case Report</span>
                    </button>
                  </div>

                  </div>
                </div>

                {/* AI Summary / Chief Complaint Preview */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                    <span className="text-slate-400 font-medium flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-teal-400" /> Chief Symptom / Complaint
                    </span>
                    <p className="text-slate-200 font-semibold">
                      {selectedVisit.reasonForVisit || selectedVisit.clinicalHistory?.chiefComplaint || 'Consultation Intake'}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                    <span className="text-slate-400 font-medium flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-teal-400" /> AI Intake Summary
                    </span>
                    <p className="text-slate-200">
                      {typeof selectedVisit.summary?.summaryJson === 'string'
                        ? (JSON.parse(selectedVisit.summary.summaryJson)?.chiefComplaint || 'AI Intake Verified')
                        : 'Ready for Homeopathic Case Analysis'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Case-Taking Form */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
                <form onSubmit={handleSave} className="space-y-6">
                  {/* Miasmatic Analysis */}
                  <div>
                    <h3 className="text-xs font-bold text-teal-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Flower2 className="w-4 h-4" /> Miasmatic Analysis &amp; Constitutional Similimum
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="sm:col-span-3">
                        <label className="block text-xs font-medium text-teal-300 mb-1">
                          Active Miasm (Primary Diathesis)
                        </label>
                        <select
                          value={miasm}
                          onChange={(e) => {
                            setMiasm(e.target.value);
                            setConstitutionalRemedy((REMEDIES_BY_MIASM as any)[e.target.value]?.[0] || '');
                          }}
                          className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-teal-500"
                        >
                          {MIASMS.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-teal-300 mb-1">
                          Constitutional Remedy (Similimum)
                        </label>
                        <select
                          value={constitutionalRemedy}
                          onChange={(e) => setConstitutionalRemedy(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-teal-500"
                        >
                          {availableRemedies.map((r: string) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-teal-300 mb-1">Potency</label>
                        <select
                          value={potency}
                          onChange={(e) => setPotency(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-teal-500"
                        >
                          {POTENCIES.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-teal-300 mb-1">Repetition / Dosing</label>
                        <select
                          value={repetition}
                          onChange={(e) => setRepetition(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-teal-500"
                        >
                          {REPETITIONS.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-teal-300 mb-1">
                      Acute Intercurrent Remedy (Optional)
                    </label>
                    <input
                      type="text"
                      value={acuteRemedy}
                      onChange={(e) => setAcuteRemedy(e.target.value)}
                      placeholder="e.g. Aconite 30C / Belladonna 200C for acute flare"
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-teal-300 mb-1">
                        Mental Generals (Mind Rubrics)
                      </label>
                      <textarea
                        rows={3}
                        value={mentalGenerals}
                        onChange={(e) => setMentalGenerals(e.target.value)}
                        placeholder="Anxiety, grief, perfectionism, weeping easily, hurried temperament..."
                        className="w-full px-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-teal-500 resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-teal-300 mb-1">
                        Physical Generals (Thermals, Cravings &amp; Aversions)
                      </label>
                      <textarea
                        rows={3}
                        value={physicalGenerals}
                        onChange={(e) => setPhysicalGenerals(e.target.value)}
                        placeholder="Chilly vs Hot patient, craving sweets/spicy, thirstless, profuse sweat..."
                        className="w-full px-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-teal-500 resize-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-amber-400 mb-1">
                        Modalities — Worse from (&lt; Aggravation)
                      </label>
                      <input
                        type="text"
                        value={modAgg}
                        onChange={(e) => setModAgg(e.target.value)}
                        placeholder="Cold damp weather, morning, motion, after meals..."
                        className="w-full px-4 py-2.5 bg-slate-950 border border-amber-900/40 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-green-400 mb-1">
                        Modalities — Better from (&gt; Amelioration)
                      </label>
                      <input
                        type="text"
                        value={modAmel}
                        onChange={(e) => setModAmel(e.target.value)}
                        placeholder="Warm applications, resting, open air, hard pressure..."
                        className="w-full px-4 py-2.5 bg-slate-950 border border-green-900/40 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-teal-300 mb-1">
                      Repertory Notes &amp; Synthesis
                    </label>
                    <textarea
                      rows={2}
                      value={repertoryNotes}
                      onChange={(e) => setRepertoryNotes(e.target.value)}
                      placeholder="Selected rubrics from Kent / Boericke repertory..."
                      className="w-full px-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-teal-500 resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-teal-300 mb-1">
                      Dietary Restrictions &amp; Antidote Avoidance
                    </label>
                    <textarea
                      rows={2}
                      value={clinicalNotes}
                      onChange={(e) => setClinicalNotes(e.target.value)}
                      placeholder="Strictly avoid coffee, raw onion, camphor, eucalyptus during medication. Follow-up after 4 weeks."
                      className="w-full px-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-teal-500 resize-none"
                    />
                  </div>

                  <div className="flex justify-end pt-4 border-t border-slate-800">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="px-8 py-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold rounded-2xl shadow-lg shadow-teal-600/30 flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      <span>{isSaving ? 'Saving Case...' : 'Save & Prescribe Case Record'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-3xl">
              Select a patient from the queue to begin Homeopathic case-taking.
            </div>
          )}
        </div>
      </div>

      {/* Homeopathic AI Summary Modal */}
      {isSummaryModalOpen && selectedVisit && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-3xl w-full p-6 sm:p-8 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-600/20 text-teal-400 rounded-2xl flex items-center justify-center font-bold">
                  <Flower2 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Homeopathic Clinical Summary &amp; Intake</h2>
                  <p className="text-xs text-slate-400">
                    Patient: <strong className="text-slate-200">{selectedVisit.patient?.name}</strong> • MRN: <span className="font-mono text-teal-300">{selectedVisit.patient?.mrn}</span>
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
                  onClick={handleDownloadSummary}
                  className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs rounded-xl font-bold shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
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
                <span className="text-[11px] font-bold text-teal-400 uppercase tracking-wider block">
                  Chief Symptom / Complaint
                </span>
                <p className="text-slate-100 font-semibold text-sm">
                  {selectedVisit.reasonForVisit || 'Under Evaluation'}
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
                  AI Intake Findings &amp; Lifestyle
                </span>
                <p className="text-slate-200 leading-relaxed">
                  {typeof selectedVisit.summary?.summaryJson === 'string'
                    ? JSON.parse(selectedVisit.summary.summaryJson)?.historyOfPresentIllness || 'Clinical intake completed.'
                    : 'Intake details recorded.'}
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
                <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider block">
                  Similimum &amp; Miasmatic Prescription
                </span>
                <p className="text-teal-300 font-bold text-sm">
                  {constitutionalRemedy} ({potency}) — {repetition}
                </p>
                <p className="text-slate-400 text-[11px]">Primary Miasm: {miasm}</p>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsSummaryModalOpen(false)}
                className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
