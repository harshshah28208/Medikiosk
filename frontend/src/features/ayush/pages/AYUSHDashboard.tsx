import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import {
  Leaf, Users, CheckCircle2, RefreshCw,
  Sparkles, Stethoscope, FileText, Heart
} from 'lucide-react';

export function AYUSHDashboard() {
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedVisit, setSelectedVisit] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // AYUSH Assessment State (Prakriti, Vikriti, Agni, Koshtha, Ashtavidha Pariksha)
  const [prakriti, setPrakriti] = useState('Vata-Pitta');
  const [vikriti, setVikriti] = useState('Pitta Vriddhi');
  const [agni, setAgni] = useState('Mandagni (Slow / Sluggish Digestion)');
  const [koshtha, setKoshtha] = useState('Madhyama (Moderate Bowel)');
  const [nadi, setNadi] = useState('Manduka Gati (Froglike / Pitta dominant)');
  const [jihva, setJihva] = useState('Saama (Coated / Sluggish metabolism)');
  const [aharaVihara, setAharaVihara] = useState('Late night meals, excessive oily & spicy food consumption');
  const [ayushNotes, setAyushNotes] = useState('Advised Panchakarma Deepana-Pachana therapy, Triphala Churna 3g at bedtime with lukewarm water.');

  const loadPatients = async () => {
    try {
      const res = await api.visits.list();
      if (res?.visits) {
        setPatients(res.visits);
        if (res.visits.length > 0 && !selectedVisit) {
          setSelectedVisit(res.visits[0]);
        }
      }
    } catch (e) {
      console.error('Failed to load AYUSH patients:', e);
    }
  };

  useEffect(() => {
    loadPatients();
  }, []);

  const handleSaveAYUSH = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVisit) return;
    setIsSaving(true);
    try {
      await api.ayush.assessment({
        visitId: selectedVisit.id,
        patientId: selectedVisit.patientId || selectedVisit.patient?.id,
        prakriti: { primaryDosha: prakriti },
        vikriti: { imbalance: vikriti },
        agni,
        koshtha,
        nadi,
        jihva,
        ahara: { habits: aharaVihara },
        notes: ayushNotes,
      });

      alert('🌿 AYUSH Prakriti Assessment & Ashtavidha Pariksha saved to medical record!');
      loadPatients();
    } catch (e: any) {
      console.error('AYUSH save error:', e);
      alert(`Error saving AYUSH assessment: ${e.message || 'Please check your connection.'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-amber-950/40 border border-amber-500/30 p-6 rounded-3xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-600 rounded-2xl flex items-center justify-center text-white font-bold shadow-lg shadow-amber-600/30">
            <Leaf className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-amber-100">AYUSH & Integrative Medicine Command Center</h1>
            <p className="text-xs text-amber-300/70">Prakriti Analysis • Agni & Koshtha Evaluation • Ashtavidha Pariksha</p>
          </div>
        </div>

        <button
          onClick={loadPatients}
          className="px-4 py-2.5 bg-amber-900/50 hover:bg-amber-900 text-amber-200 rounded-xl text-xs font-semibold flex items-center gap-2 border border-amber-700/50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Patient List */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2 pb-2 border-b border-slate-800">
            <Users className="w-4 h-4 text-amber-400" />
            <span>AYUSH OPD Patients</span>
          </h2>

          <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-1">
            {patients.map((visit) => {
              const isSelected = selectedVisit?.id === visit.id;
              return (
                <button
                  key={visit.id}
                  onClick={() => setSelectedVisit(visit)}
                  className={`
                    w-full p-4 rounded-2xl text-left transition-all border
                    ${isSelected
                      ? 'bg-amber-600/20 border-amber-500 shadow-md scale-[1.01]'
                      : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800'
                    }
                  `}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 bg-slate-800 rounded text-amber-300 border border-slate-700">
                      {visit.token || 'A-101'}
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase">{visit.status}</span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-100">{visit.patient?.name}</h3>
                  <p className="text-xs text-slate-400">MRN: {visit.patient?.mrn} • {visit.patient?.age || 45}Y</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: AYUSH Form */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
          {selectedVisit ? (
            <form onSubmit={handleSaveAYUSH} className="space-y-6">
              <div className="pb-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">{selectedVisit.patient?.name}</h2>
                  <p className="text-xs text-slate-400">Token: {selectedVisit.token} • MRN: {selectedVisit.patient?.mrn}</p>
                </div>
              </div>

              {/* Assessment Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-amber-300 mb-1">Prakriti (Body Constitution)</label>
                  <select
                    value={prakriti}
                    onChange={(e) => setPrakriti(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="Vata-Pitta">Vata-Pitta (Irregular hunger & heat sensitive)</option>
                    <option value="Pitta-Kapha">Pitta-Kapha (Sharp appetite & sturdy build)</option>
                    <option value="Vata-Kapha">Vata-Kapha (Cold sensitivity & slow metabolism)</option>
                    <option value="Tridoshaja">Tridoshaja (Balanced equilibrium)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-amber-300 mb-1">Agni (Digestive Fire State)</label>
                  <select
                    value={agni}
                    onChange={(e) => setAgni(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="Mandagni (Slow / Sluggish Digestion)">Mandagni (Sluggish Digestion / Ama prone)</option>
                    <option value="Tikshnagni (Hyperactive / Acidic)">Tikshnagni (Intense hunger / Hyperacidity)</option>
                    <option value="Vishamagni (Irregular / Variable)">Vishamagni (Bloating & irregular appetite)</option>
                    <option value="Samagni (Normal / Balanced)">Samagni (Optimal physiological metabolism)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-amber-300 mb-1">Nadi Pariksha (Pulse Assessment)</label>
                  <input
                    type="text"
                    value={nadi}
                    onChange={(e) => setNadi(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-amber-300 mb-1">Jihva Pariksha (Tongue Assessment)</label>
                  <input
                    type="text"
                    value={jihva}
                    onChange={(e) => setJihva(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-amber-300 mb-1">Ahara & Vihara Assessment (Diet & Lifestyle)</label>
                <textarea
                  rows={2}
                  value={aharaVihara}
                  onChange={(e) => setAharaVihara(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-amber-300 mb-1">Ayurvedic Treatment & Rasayana Prescription</label>
                <textarea
                  rows={3}
                  value={ayushNotes}
                  onChange={(e) => setAyushNotes(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-800">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-8 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-2xl shadow-lg shadow-amber-600/30 flex items-center gap-2 transition-all touch-target-lg"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>{isSaving ? 'Saving...' : 'Save AYUSH Clinical Assessment'}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="p-12 text-center text-slate-500">Select a patient to conduct AYUSH evaluation.</div>
          )}
        </div>
      </div>
    </div>
  );
}
