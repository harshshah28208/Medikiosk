import React, { useState, useEffect } from "react";
import { api } from "../../../services/api";
import {
  Droplets, Users, CheckCircle2, RefreshCw,
  Flower2
} from "lucide-react";

const MIASMS = ["Psora (Deficiency / Itch)", "Sycosis (Excess / Gonorrhoeal)", "Syphilis (Destructive / Luetic)", "Tubercular (Mixed)", "Cancer (Mixed)"];

const REMEDIES_BY_MIASM: Record<string, string[]> = {
  "Psora (Deficiency / Itch)": ["Sulphur", "Calcarea Carbonica", "Lycopodium", "Psorinum", "Arsenicum Album", "Graphites"],
  "Sycosis (Excess / Gonorrhoeal)": ["Medorrhinum", "Natrum Sulphuricum", "Thuya Occidentalis", "Nitric Acid", "Causticum"],
  "Syphilis (Destructive / Luetic)": ["Luesinum (Syphilinum)", "Mercurius Solubilis", "Aurum Metallicum", "Nitric Acid", "Kali Iodatum"],
  "Tubercular (Mixed)": ["Tuberculinum", "Bacillinum", "Phosphorus", "Calcarea Phosphorica", "Natrum Muriaticum"],
  "Cancer (Mixed)": ["Carcinosinum", "Natrum Muriaticum", "Staphysagria", "Lachesis", "Ignatia"],
};

const POTENCIES = ["6C", "12C", "30C", "200C", "1M", "10M", "LM1", "LM6"];
const REPETITIONS = ["Single dose", "Daily for 7 days", "Weekly x4 weeks", "As needed (PRN)", "Three doses 15 min apart then wait"];

export function HomeopathicDashboard() {
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedVisit, setSelectedVisit] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [miasm, setMiasm] = useState(MIASMS[0]);
  const [constitutionalRemedy, setConstitutionalRemedy] = useState("Sulphur");
  const [acuteRemedy, setAcuteRemedy] = useState("");
  const [potency, setPotency] = useState("30C");
  const [repetition, setRepetition] = useState("Single dose");
  const [mentalGenerals, setMentalGenerals] = useState("");
  const [physicalGenerals, setPhysicalGenerals] = useState("");
  const [modAgg, setModAgg] = useState("");
  const [modAmel, setModAmel] = useState("");
  const [repertoryNotes, setRepertoryNotes] = useState("");
  const [clinicalNotes, setClinicalNotes] = useState("");

  const availableRemedies: string[] = REMEDIES_BY_MIASM[miasm] || [];

  const loadPatients = async () => {
    try {
      const res = await api.visits.list();
      if (res?.visits) {
        setPatients(res.visits);
        if (res.visits.length > 0 && !selectedVisit) setSelectedVisit(res.visits[0]);
      }
    } catch {}
  };

  useEffect(() => { loadPatients(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVisit) return;
    setIsSaving(true);
    try {
      await api.ayush.assessment({
        visitId: selectedVisit.id,
        patientId: selectedVisit.patientId || selectedVisit.patient?.id,
        systemType: "HOMEOPATHY",
        miasm, constitutionalRemedy, acuteRemedy, potency, repetition,
        mentalGenerals, physicalGenerals,
        modalities: { aggravation: modAgg, amelioration: modAmel },
        repertoryNotes, notes: clinicalNotes,
      });
      alert("Homeopathic case record saved!");
      loadPatients();
    } catch (err: any) {
      alert("Error: " + (err.message || "Check connection"));
    } finally { setIsSaving(false); }
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
            <h1 className="text-xl font-bold text-teal-100">Homeopathic Clinical Workspace</h1>
            <p className="text-xs text-teal-300/70">Miasm Analysis • Constitutional Remedy • Repertory Case-Taking • Potency Selection</p>
          </div>
        </div>
        <button
          onClick={loadPatients}
          className="px-4 py-2.5 bg-teal-900/50 hover:bg-teal-900 text-teal-200 rounded-xl text-xs font-semibold flex items-center gap-2 border border-teal-700/50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Patient List */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2 pb-2 border-b border-slate-800">
            <Users className="w-4 h-4 text-teal-400" />
            <span>Homeopathy OPD Patients</span>
          </h2>
          <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-1">
            {(patients as any[]).map((visit: any) => {
              const isSelected = (selectedVisit as any)?.id === visit.id;
              return (
                <button key={visit.id} onClick={() => setSelectedVisit(visit)}
                  className={`w-full p-4 rounded-2xl text-left transition-all border ${
                    isSelected ? 'bg-teal-600/20 border-teal-500 shadow-md' : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 bg-slate-800 rounded text-teal-300 border border-slate-700">{visit.token || 'H-101'}</span>
                    <span className="text-[10px] text-slate-400 uppercase">{visit.status}</span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-100">{visit.patient?.name}</h3>
                  <p className="text-xs text-slate-400">MRN: {visit.patient?.mrn} • {visit.patient?.age || 35}Y</p>
                </button>
              );
            })}
            {(patients as any[]).length === 0 && <p className="text-center text-slate-500 text-xs py-8">No patients in queue.</p>}
          </div>
        </div>

        {/* Right: Homeopathic Case Record */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
          {selectedVisit ? (
            <form onSubmit={handleSave} className="space-y-6">
              <div className="pb-4 border-b border-slate-800">
                <h2 className="text-xl font-bold text-white">{(selectedVisit as any).patient?.name}</h2>
                <p className="text-xs text-slate-400">Token: {(selectedVisit as any).token} • MRN: {(selectedVisit as any).patient?.mrn}</p>
              </div>

              {/* Miasmatic Analysis */}
              <div>
                <h3 className="text-xs font-bold text-teal-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Flower2 className="w-4 h-4" /> Miasmatic Analysis &amp; Constitutional Similimum
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-medium text-teal-300 mb-1">Active Miasm (Primary Diathesis)</label>
                    <select value={miasm} onChange={(e) => { setMiasm(e.target.value); setConstitutionalRemedy((REMEDIES_BY_MIASM as any)[e.target.value]?.[0] || ''); }}
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-teal-500">
                      {MIASMS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-teal-300 mb-1">Constitutional Remedy (Similimum)</label>
                    <select value={constitutionalRemedy} onChange={(e) => setConstitutionalRemedy(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-teal-500">
                      {availableRemedies.map((r: string) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-teal-300 mb-1">Potency</label>
                    <select value={potency} onChange={(e) => setPotency(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-teal-500">
                      {POTENCIES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-teal-300 mb-1">Repetition / Dosing</label>
                    <select value={repetition} onChange={(e) => setRepetition(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-teal-500">
                      {REPETITIONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-teal-300 mb-1">Acute Intercurrent Remedy (if any)</label>
                <input type="text" value={acuteRemedy} onChange={(e) => setAcuteRemedy(e.target.value)}
                  placeholder="e.g. Belladonna 30C for fever spike"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-teal-500" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-teal-300 mb-1">Mental Generals (Key Rubrics)</label>
                  <textarea rows={3} value={mentalGenerals} onChange={(e) => setMentalGenerals(e.target.value)}
                    placeholder="Fear, grief, perfectionism, weeping, hurried..."
                    className="w-full px-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-teal-500 resize-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-teal-300 mb-1">Physical Generals (Thermals, Desires, Aversions)</label>
                  <textarea rows={3} value={physicalGenerals} onChange={(e) => setPhysicalGenerals(e.target.value)}
                    placeholder="Chilly patient, craves sweets, aversion to milk..."
                    className="w-full px-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-teal-500 resize-none" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-amber-400 mb-1">Modalities — Worse from (Aggravation)</label>
                  <input type="text" value={modAgg} onChange={(e) => setModAgg(e.target.value)}
                    placeholder="Cold air, morning, motion..."
                    className="w-full px-4 py-2.5 bg-slate-950 border border-amber-900/40 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-amber-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-green-400 mb-1">Modalities — Better from (Amelioration)</label>
                  <input type="text" value={modAmel} onChange={(e) => setModAmel(e.target.value)}
                    placeholder="Warmth, pressure, open air..."
                    className="w-full px-4 py-2.5 bg-slate-950 border border-green-900/40 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-green-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-teal-300 mb-1">Repertory Notes &amp; Rubric Analysis</label>
                <textarea rows={2} value={repertoryNotes} onChange={(e) => setRepertoryNotes(e.target.value)}
                  placeholder="Selected repertory rubrics, totality analysis..."
                  className="w-full px-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-teal-500 resize-none" />
              </div>

              <div>
                <label className="block text-xs font-medium text-teal-300 mb-1">Follow-up Instructions &amp; Antidote Avoidance</label>
                <textarea rows={2} value={clinicalNotes} onChange={(e) => setClinicalNotes(e.target.value)}
                  placeholder="Avoid coffee, camphor, mint. Follow-up after 4 weeks..."
                  className="w-full px-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-teal-500 resize-none" />
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-800">
                <button type="submit" disabled={isSaving}
                  className="px-8 py-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold rounded-2xl shadow-lg shadow-teal-600/30 flex items-center gap-2 transition-all">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>{isSaving ? 'Saving...' : 'Save Homeopathic Case Record'}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="p-12 text-center text-slate-500">Select a patient to begin Homeopathic case-taking.</div>
          )}
        </div>
      </div>
    </div>
  );
}
