import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import {
  Heart, Calendar, FileText, Activity, ShieldCheck,
  Stethoscope, Clock, ChevronRight, User, Pill
} from 'lucide-react';

export function PatientPortalPage() {
  const [patient, setPatient] = useState<any | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem('medikiosk_active_patient');
    const userRaw = localStorage.getItem('medikiosk_user');
    const storedUser = userRaw ? JSON.parse(userRaw) : null;
    const p = raw ? JSON.parse(raw) : (storedUser?.id ? storedUser : { id: '11111111-1111-1111-1111-111111111111', name: 'Rahul Sharma', mrn: 'MK-0001' });
    setPatient(p);

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

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">
      {/* Patient Header */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center font-bold text-white shadow-inner">
            <User className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">{patient?.name || 'Rahul Sharma'}</h1>
            <p className="text-xs sm:text-sm text-blue-100 mt-1">
              MRN: <span className="font-mono font-bold">{patient?.mrn || 'MK-0001'}</span> • ABHA: 91-8844-3311-2299
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto bg-white/10 px-4 py-2 rounded-2xl border border-white/20 text-xs">
          <ShieldCheck className="w-4 h-4 text-green-300" />
          <span>ABDM Verified Record</span>
        </div>
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
