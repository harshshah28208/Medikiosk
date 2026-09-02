import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import {
  Leaf, Users, CheckCircle2, RefreshCw,
  Sparkles, Stethoscope, FileText, Heart, Search, X
} from 'lucide-react';

export function AYUSHDashboard() {
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedVisit, setSelectedVisit] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const safeString = (val: any, fallback = ''): string => {
    if (val === null || val === undefined) return fallback;
    if (typeof val === 'string') return val.trim() || fallback;
    if (Array.isArray(val)) {
      if (val.length === 0) return fallback;
      return val.map((item) => (typeof item === 'object' ? JSON.stringify(item) : String(item))).join(', ');
    }
    if (typeof val === 'object') {
      const entries = Object.entries(val);
      if (entries.length === 0) return fallback;
      return entries.map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' | ');
    }
    return String(val);
  };

  // AYUSH Assessment State (Prakriti, Vikriti, Agni, Koshtha, Ashtavidha Pariksha)
  const [prakriti, setPrakriti] = useState('Vata-Pitta');
  const [vikriti, setVikriti] = useState('Pitta Vriddhi');
  const [agni, setAgni] = useState('Mandagni (Slow / Sluggish Digestion)');
  const [koshtha, setKoshtha] = useState('Madhyama (Moderate Bowel)');
  const [nadi, setNadi] = useState('Manduka Gati (Froglike / Pitta dominant)');
  const [jihva, setJihva] = useState('Saama (Coated / Sluggish metabolism)');
  const [aharaVihara, setAharaVihara] = useState('Late night meals, excessive oily & spicy food consumption');
  const [ayushNotes, setAyushNotes] = useState('Advised Panchakarma Deepana-Pachana therapy, Triphala Churna 3g at bedtime with lukewarm water.');

  const isAyushVisit = (v: any) => {
    const deptCode = (v.department?.code || '').toUpperCase();
    const deptName = (v.department?.name || '').toLowerCase();
    const carePath = (v.carePath || '').toUpperCase();
    const docSpec = (v.doctor?.specialization || '').toLowerCase();
    const docName = (v.doctor?.user?.name || v.doctor?.name || '').toLowerCase();
    return (
      deptCode === 'AYUSH' ||
      deptName.includes('ayush') ||
      deptName.includes('ayurveda') ||
      carePath === 'AYUSH' ||
      docSpec.includes('ayurveda') ||
      docSpec.includes('ayush') ||
      docName.includes('harish') ||
      docName.includes('aarav')
    );
  };

  const loadPatients = async () => {
    try {
      let visitList: any[] = [];
      const res = await api.doctor.patients(true).catch(() => null);
      if (res?.visits && Array.isArray(res.visits) && res.visits.length > 0) {
        visitList = res.visits.filter(isAyushVisit);
      } else {
        const vRes = await api.visits.list().catch(() => null);
        if (vRes?.visits && Array.isArray(vRes.visits)) {
          visitList = vRes.visits.filter(isAyushVisit);
        }
      }

      setPatients(visitList);
      if (visitList.length > 0) {
        setSelectedVisit((prev: any) => {
          if (prev && visitList.find((v: any) => v.id === prev.id)) return prev;
          return visitList[0];
        });
      } else {
        setSelectedVisit(null);
      }
    } catch (e) {
      console.error('Failed to load AYUSH patients:', e);
    }
  };

  useEffect(() => {
    loadPatients();
  }, []);

  const filteredPatients = patients.filter((visit: any) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const name = (visit.patient?.name || '').toLowerCase();
    const mrn = (visit.patient?.mrn || '').toLowerCase();
    const token = String(visit.token || '').toLowerCase();
    const phone = (visit.patient?.phone || '').toLowerCase();
    const reason = (visit.reasonForVisit || '').toLowerCase();
    return name.includes(q) || mrn.includes(q) || token.includes(q) || phone.includes(q) || reason.includes(q);
  });

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
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" />
              <span>AYUSH OPD Patients</span>
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded-full">
              {patients.length}
            </span>
          </h2>

          {/* Search Input & Search Button */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Name, MRN, Token #..."
                className="w-full pl-9 pr-8 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all"
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
                  setSelectedVisit(filteredPatients[0]);
                }
              }}
              className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1 shrink-0 cursor-pointer shadow-sm shadow-amber-600/30"
              title="Search and select matching patient"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search</span>
            </button>
          </div>

          <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-1">
            {filteredPatients.length === 0 ? (
              <p className="text-center text-slate-500 text-xs py-8">
                {searchQuery ? `No matching patients for "${searchQuery}".` : 'No patients currently in queue.'}
              </p>
            ) : filteredPatients.map((visit) => {
              const isSelected = selectedVisit?.id === visit.id;
              return (
                <button
                  key={visit.id}
                  onClick={() => setSelectedVisit(visit)}
                  className={`
                    w-full p-4 rounded-2xl text-left transition-all border cursor-pointer
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
