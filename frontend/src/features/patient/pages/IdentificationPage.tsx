import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../../store/LanguageContext';
import { api } from '../../../services/api';
import { Search, UserCheck, ArrowLeft, ArrowRight, UserPlus, Phone, CreditCard, ShieldCheck } from 'lucide-react';

export function IdentificationPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [lookupType, setLookupType] = useState<'PHONE' | 'MRN' | 'ABHA'>('PHONE');
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [foundPatient, setFoundPatient] = useState<any | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setErrorMsg(null);
    setFoundPatient(null);

    try {
      const res = await api.patients.lookup(query.trim(), lookupType);
      if (res?.patient) {
        setFoundPatient(res.patient);
      }
    } catch (err: any) {
      setErrorMsg(err.message || t('noRecordFound'));
    } finally {
      setIsSearching(false);
    }
  };

  const handleProceedWithPatient = () => {
    if (!foundPatient) return;
    // Store active patient id & visit info into localStorage with explicit isReturning flag
    localStorage.setItem('medikiosk_active_patient', JSON.stringify({ ...foundPatient, isReturning: true, isNewPatient: false }));
    navigate('/kiosk/consent');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-blue-50 via-slate-50 to-indigo-50">
      <div className="w-full max-w-2xl bg-white rounded-3xl p-8 shadow-xl border border-slate-100 flex flex-col">
        
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Search className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">{t('existingPatient')}</h1>
          <p className="text-slate-500 text-sm">{t('lookupPrompt')}</p>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-6">
          {[
            { type: 'PHONE' as const, label: t('phoneLookup'), icon: Phone },
            { type: 'MRN' as const, label: t('mrnLookup'), icon: CreditCard },
            { type: 'ABHA' as const, label: t('abhaLookup'), icon: ShieldCheck },
          ].map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                setLookupType(type);
                setQuery('');
                setFoundPatient(null);
                setErrorMsg(null);
              }}
              className={`
                flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all
                ${lookupType === type
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
                }
              `}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{type}</span>
            </button>
          ))}
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="space-y-4 mb-6">
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                lookupType === 'PHONE' ? 'e.g. 9876543210' :
                lookupType === 'MRN' ? 'e.g. MK-0001' : 'e.g. 91-8844-3311-2299'
              }
              className="w-full text-lg px-5 py-4 bg-slate-50 border border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all text-slate-800"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSearching || !query.trim()}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-2xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 touch-target-lg"
          >
            <Search className="w-5 h-5" />
            {isSearching ? 'Searching Database...' : t('searchBtn')}
          </button>
        </form>

        {/* Error notification */}
        {errorMsg && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm mb-6 text-center">
            <p className="font-semibold mb-2">{errorMsg}</p>
            <button
              onClick={() => navigate('/kiosk/register')}
              className="inline-flex items-center gap-2 text-blue-600 font-bold hover:underline"
            >
              <UserPlus className="w-4 h-4" />
              {t('registerNewBtn')}
            </button>
          </div>
        )}

        {/* Found Returning Patient Card (Item 20 — Returning Patient Flow) */}
        {foundPatient && (
          <div className="p-6 bg-green-50/70 border-2 border-green-500/50 rounded-2xl mb-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-green-600 text-white rounded-full flex items-center justify-center font-bold shadow-md">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900">{foundPatient.name}</h3>
                    <span className="text-[10px] px-2 py-0.5 bg-green-600 text-white font-bold rounded-full uppercase">Returning Patient</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    MRN: <span className="font-semibold text-slate-800">{foundPatient.mrn}</span> • {foundPatient.age || 40}Y / {foundPatient.gender}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">Phone: {foundPatient.phone}</p>
                </div>
              </div>
            </div>

            {/* Changes Since Last Visit Questionnaire */}
            <div className="bg-white p-4 rounded-xl border border-green-200 space-y-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                What has changed since your last visit?
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {[
                  'No major changes (Routine Follow-up)',
                  'New symptoms started recently',
                  'Existing symptoms worsened',
                  'Started new medications',
                  'Stopped prior medications',
                  'Brought new lab test / scan report',
                ].map((changeOpt, cIdx) => (
                  <button
                    key={cIdx}
                    type="button"
                    onClick={() => {
                      localStorage.setItem('medikiosk_recent_changes', changeOpt);
                      handleProceedWithPatient();
                    }}
                    className="p-2.5 text-left rounded-lg border border-slate-200 hover:border-green-500 hover:bg-green-50 font-medium text-slate-700 transition-all flex items-center justify-between"
                  >
                    <span>{changeOpt}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-green-600 shrink-0 ml-1" />
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleProceedWithPatient}
              className="w-full py-3.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-md transition-all touch-target"
            >
              <span>Confirm &amp; Proceed to Intake</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Bottom Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-auto">
          <button
            onClick={() => navigate('/kiosk/language')}
            className="flex items-center gap-2 px-6 py-3 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 touch-target"
          >
            <ArrowLeft className="w-5 h-5" />
            {t('backBtn')}
          </button>

          <button
            onClick={() => navigate('/kiosk/register')}
            className="flex items-center gap-2 text-blue-600 font-semibold hover:text-blue-700 px-4 py-2 touch-target"
          >
            <UserPlus className="w-4 h-4" />
            {t('registerNewBtn')}
          </button>
        </div>

      </div>
    </div>
  );
}
