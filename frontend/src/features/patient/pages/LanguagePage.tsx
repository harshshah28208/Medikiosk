import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../../store/LanguageContext';
import { speechProvider } from '../../../services/speech';
import { safeGetItem } from '../../../utils/storage';
import { Globe, ArrowRight, ArrowLeft, Volume2 } from 'lucide-react';

export function LanguagePage() {
  const navigate = useNavigate();
  const { language, setLanguage, availableLanguages, t } = useLanguage();

  const greetingByLang: Record<string, string> = {
    en: 'Welcome to MediKiosk. Please choose your language to continue.',
    hi: 'मेडीकियोस्क में आपका स्वागत है। आगे बढ़ने के लिए कृपया अपनी भाषा चुनें।',
    gu: 'મેડીકિયોસ્ક માં આપનું સ્વાગત છે. આગળ વધવા માટે કૃપા કરીને આપની ભાષા પસંદ કરો.',
  };

  const handleSelectLanguage = (langCode: 'en' | 'hi' | 'gu') => {
    setLanguage(langCode);
    const greeting = greetingByLang[langCode] || greetingByLang['en'];
    speechProvider.speak(greeting, langCode);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-blue-50 via-slate-50 to-indigo-50">
      <div className="w-full max-w-2xl bg-white rounded-3xl p-8 shadow-xl border border-slate-100 flex flex-col items-center text-center">
        
        {/* Icon & Title */}
        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
          <Globe className="w-9 h-9" />
        </div>

        <h1 className="text-3xl font-bold text-slate-800 mb-2">
          {t('selectLanguageTitle')}
        </h1>
        <p className="text-slate-500 mb-8 max-w-md">
          {t('selectLanguageSubtitle')}
        </p>

        {/* Big Touch Cards for Languages with Instant Audio Feedback */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full mb-8">
          {availableLanguages.map((lang) => {
            const isSelected = language === lang.code;
            return (
              <button
                key={lang.code}
                onClick={() => handleSelectLanguage(lang.code as any)}
                className={`
                  flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all duration-200
                  touch-target-lg relative group
                  ${isSelected
                    ? 'border-blue-600 bg-blue-50/70 shadow-lg scale-[1.03] ring-4 ring-blue-100'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-white hover:border-blue-300'
                  }
                `}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl font-bold text-slate-800">{lang.nativeLabel}</span>
                  {isSelected && <Volume2 className="w-5 h-5 text-blue-600 animate-pulse" />}
                </div>
                <span className="text-sm font-medium text-slate-500">{lang.label}</span>
              </button>
            );
          })}
        </div>

        {/* Quick Route Cards: Follow-up continuation vs New Patient vs Existing Patient */}
        {localStorage.getItem('medikiosk_visit_type') === 'FOLLOW_UP' && (
          <button
            onClick={() => {
              speechProvider.stopSpeaking();
              const parsed = safeGetItem<any>('medikiosk_active_visit', null);
              navigate(`/kiosk/intake/${parsed?.id || 'follow-up'}`);
            }}
            className="w-full mb-4 p-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl shadow-xl shadow-emerald-600/30 flex items-center justify-between transition-all touch-target text-left"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                <ArrowRight className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold">Continue to Follow-Up AI Intake</h2>
                <p className="text-xs text-emerald-100">
                  {localStorage.getItem('medikiosk_target_complaint') ? `For: ${localStorage.getItem('medikiosk_target_complaint')}` : 'Continue follow-up questionnaire'}
                </p>
              </div>
            </div>
            <span className="text-xs font-bold bg-white text-emerald-800 px-3 py-1.5 rounded-xl shadow-sm">Proceed →</span>
          </button>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full mb-8">
          <button
            onClick={() => {
              speechProvider.stopSpeaking();
              localStorage.removeItem('medikiosk_active_patient');
              localStorage.removeItem('medikiosk_active_visit');
              localStorage.removeItem('medikiosk_active_queue');
              localStorage.removeItem('medikiosk_active_session_data');
              localStorage.removeItem('medikiosk_active_session_id');
              localStorage.removeItem('medikiosk_active_doctor');
              localStorage.removeItem('medikiosk_recent_changes');
              localStorage.removeItem('medikiosk_temp_raw_transcript');
              localStorage.removeItem('medikiosk_target_complaint');
              localStorage.setItem('medikiosk_visit_type', 'NEW_CASE');
              navigate('/kiosk/register');
            }}
            className="flex items-center gap-4 p-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-lg shadow-blue-600/30 transition-all touch-target text-left"
          >
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
              <ArrowRight className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold">{t('startNewVisit') || 'New Patient Registration'}</h2>
              <p className="text-xs text-blue-100">First time visiting this hospital</p>
            </div>
          </button>

          <button
            onClick={() => {
              speechProvider.stopSpeaking();
              navigate('/kiosk/identify');
            }}
            className="flex items-center gap-4 p-5 bg-white hover:bg-slate-50 text-slate-800 border-2 border-slate-200 hover:border-slate-300 rounded-2xl shadow-sm transition-all touch-target text-left"
          >
            <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center shrink-0">
              <Globe className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-base font-bold">{t('existingPatient') || 'Returning Patient'}</h2>
              <p className="text-xs text-slate-500">Search by Phone, MRN, or ABHA</p>
            </div>
          </button>
        </div>

        {/* Footer Back */}
        <div className="flex items-center justify-start w-full pt-4 border-t border-slate-100">
          <button
            onClick={() => {
              speechProvider.stopSpeaking();
              navigate('/kiosk');
            }}
            className="flex items-center gap-2 px-6 py-3 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 touch-target"
          >
            <ArrowLeft className="w-5 h-5" />
            {t('backBtn')}
          </button>
        </div>
      </div>
    </div>
  );
}
