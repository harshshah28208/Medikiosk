import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../services/api';
import { useAuth } from '../../../store/AuthContext';
import {
  Heart, Calendar, FileText, Activity, ShieldCheck,
  Stethoscope, Clock, ChevronRight, User, Pill, Sparkles,
  ArrowRight, Upload, Phone, LogOut, CheckCircle2
} from 'lucide-react';

export function PatientPortalPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [patient, setPatient] = useState<any | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [activeVisit, setActiveVisit] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem('medikiosk_active_patient');
    const userRaw = localStorage.getItem('medikiosk_user');
    const storedUser = userRaw ? JSON.parse(userRaw) : null;
    const p = raw ? JSON.parse(raw) : (storedUser?.patient || storedUser || { id: '11111111-1111-1111-1111-111111111111', name: 'Rudra Patel', mrn: 'MK-0001' });
    setPatient(p);

    const activeVisitRaw = localStorage.getItem('medikiosk_active_visit');
    if (activeVisitRaw) {
      setActiveVisit(JSON.parse(activeVisitRaw));
    } else if (p.visits?.[0]) {
      setActiveVisit(p.visits[0]);
    }

    const rawApiBase = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';
    const cleanApiBase = rawApiBase.trim().replace(/\/+$/, '');

    fetch(`${cleanApiBase}/documents/timeline/${p.id}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('medikiosk_token')}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.timeline) {
          setTimeline(data.timeline);
        }
      })
      .catch((e) => console.error('Timeline error:', e))
      .finally(() => setIsLoading(false));
  }, []);

  const handleStartNewConsultation = () => {
    if (patient) {
      localStorage.setItem('medikiosk_active_patient', JSON.stringify(patient));
    }
    navigate('/kiosk/register');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">
      {/* Patient Profile Header */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-800 text-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center font-bold text-white shadow-inner">
            <User className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold">{patient?.name || 'Rudra Patel'}</h1>
              <span className="px-2.5 py-0.5 bg-blue-500/30 border border-blue-400/40 rounded-full text-xs font-semibold">
                Patient
              </span>
            </div>
            <p className="text-xs sm:text-sm text-blue-100 mt-1 flex flex-wrap items-center gap-3">
              <span>MRN: <strong className="font-mono">{patient?.mrn || 'MK-0001'}</strong></span>
              <span>•</span>
              <span>Phone: <strong>{patient?.phone || '9876543210'}</strong></span>
              {patient?.abhaId && (
                <>
                  <span>•</span>
                  <span>ABHA: <strong className="font-mono">{patient.abhaId}</strong></span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <div className="flex items-center gap-1.5 bg-white/10 px-3.5 py-2 rounded-2xl border border-white/20 text-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-300" />
            <span>ABDM Verified</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 rounded-2xl text-xs text-red-200 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Quick Action Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-6 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-3xl text-white shadow-lg space-y-3">
          <div className="flex items-center gap-2 text-blue-200 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>OPD Care &amp; AI Consultation</span>
          </div>
          <h2 className="text-xl font-bold">Start OPD Visit &amp; Select Doctor</h2>
          <p className="text-xs text-blue-100 leading-relaxed">
            Choose your preferred Medical System (Allopathy, Ayurveda, Homeopathy) and consult your assigned specialist doctor.
          </p>
          <button
            onClick={handleStartNewConsultation}
            className="w-full py-3 px-4 bg-white text-blue-700 font-bold rounded-2xl flex items-center justify-center gap-2 shadow hover:bg-blue-50 transition-all text-sm"
          >
            <span>Proceed to Doctor Selection &amp; Intake</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {activeVisit ? (
          <div className="p-6 bg-emerald-950/30 border border-emerald-500/30 rounded-3xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4" />
                <span>Active OPD Token</span>
              </div>
              <span className="text-xs px-2.5 py-1 bg-emerald-500/20 text-emerald-300 font-mono font-bold rounded-full">
                {activeVisit.token || 'TOKEN-ACTIVE'}
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-800">
              {activeVisit.department?.name || 'Assigned OPD Department'}
            </h3>
            <p className="text-xs text-slate-600">
              Status: <span className="font-semibold text-emerald-600">{activeVisit.status || 'IN_QUEUE'}</span>
            </p>
            <button
              onClick={() => navigate(`/kiosk/intake/${activeVisit.id}`)}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow"
            >
              <span>Continue AI Clinical Intake</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="p-6 bg-slate-50 border border-slate-200 rounded-3xl space-y-3">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-wider">
              <Upload className="w-4 h-4" />
              <span>Document Repository</span>
            </div>
            <h3 className="text-lg font-bold text-slate-800">Upload Past Medical Records</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Upload prescription PDFs and lab reports. Gemini multimodal AI will analyze and index your history.
            </p>
            <button
              onClick={handleStartNewConsultation}
              className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all"
            >
              <span>Upload Document</span>
              <Upload className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Timeline Section */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-100 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-800">Longitudinal Medical History Timeline</h2>
          </div>
          <span className="text-xs px-3 py-1 bg-blue-50 text-blue-700 font-bold rounded-full">
            {timeline.length} Medical Records
          </span>
        </div>

        <div className="space-y-6 relative before:absolute before:inset-0 before:left-5 before:w-0.5 before:bg-slate-200">
          {timeline.length > 0 ? (
            timeline.map((item, idx) => (
              <div key={idx} className="relative flex items-start gap-6 pl-2">
                {/* Node Dot */}
                <div className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center shrink-0 z-10 shadow-md">
                  {item.type === 'VISIT' ? (
                    <Stethoscope className="w-3.5 h-3.5" />
                  ) : item.type === 'PRESCRIPTION' ? (
                    <Pill className="w-3.5 h-3.5" />
                  ) : (
                    <FileText className="w-3.5 h-3.5" />
                  )}
                </div>

                {/* Content Box */}
                <div className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl p-5 hover:shadow-md transition-all">
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                    <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                    <span className="text-xs text-slate-400 font-mono">
                      {new Date(item.date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 font-sans leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-slate-400 text-sm">
              Your recent clinical visits and prescriptions will populate your health record automatically.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
