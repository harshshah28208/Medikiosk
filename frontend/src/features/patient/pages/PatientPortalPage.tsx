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

    api.doctor.timeline(p.id)
      .then((data: any) => {
        if (data?.timeline && Array.isArray(data.timeline)) {
          setTimeline(data.timeline);
        }
      })
      .catch((e: any) => console.error('Timeline error:', e))
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

  
  const handleDownloadPatientTimeline = () => {
    if (timeline.length === 0) return;
    const p = patient;
    const report = `=====================================================
MEDIKIOSK PATIENT LONGITUDINAL MEDICAL RECORDS
Generated: ${new Date().toLocaleString()}
=====================================================

PATIENT: ${p?.name || 'Patient'} (MRN: ${p?.mrn || 'N/A'}, Phone: ${p?.phone || 'N/A'})
Blood Group: ${p?.bloodGroup || 'N/A'} | ABHA: ${p?.abhaId || 'N/A'}

TOTAL MEDICAL ENCOUNTERS: ${timeline.length}
=====================================================

${timeline.map((item: any, idx: number) => `
-----------------------------------------------------
RECORD #${timeline.length - idx}: ${item.chiefComplaint || item.title || 'OPD Consultation'}
Date: ${item.date ? new Date(item.date).toLocaleDateString() : 'Past Visit'}
Department: ${item.department || 'General Medicine'}
Treating Doctor: ${item.doctor?.name || 'Dr. Yogesh Sharma'} (${item.doctor?.specialization || item.department || 'General Medicine'})
Diagnosis: ${item.doctor?.diagnosis || item.chiefComplaint || 'Consultation Completed'}
AI Intake Findings: ${item.aiSummary?.historyOfPresentIllness || item.aiSummary?.chiefComplaint || item.description || 'Intake summary recorded.'}
Vitals: ${item.vitals ? `BP: ${item.vitals.bpSystolic}/${item.vitals.bpDiastolic} | Pulse: ${item.vitals.pulse}` : 'Normal'}
Prescription: ${item.lastPrescription || (item.prescriptions?.length ? item.prescriptions.map((px: any) => `${px.medicineName} (${px.dosage})`).join(', ') : 'None')}
`).join('\n')}

=====================================================
MediKiosk Digital Health Records
=====================================================`;

    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `My_Medical_Records_${p?.mrn || 'Patient'}_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
          <div className="p-6 bg-gradient-to-br from-emerald-900 to-teal-950 text-white border border-emerald-500/40 rounded-3xl space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Active OPD Token</span>
              </div>
              <span className="text-xs px-3 py-1 bg-emerald-500/20 text-emerald-300 font-mono font-bold rounded-full border border-emerald-500/30">
                {activeVisit.token || 'TOKEN-ACTIVE'}
              </span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                {activeVisit.department?.name || 'Assigned OPD Department'}
              </h3>
              <p className="text-xs text-emerald-200 mt-0.5">
                Doctor: <strong>{activeVisit.doctor?.user?.name ? `Dr. ${activeVisit.doctor.user.name}` : 'Assigned OPD Specialist'}</strong>
              </p>
            </div>

            {/* Nurse Triage Guidance */}
            <div className="p-3 bg-white/10 rounded-2xl border border-white/10 text-xs space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-emerald-300">
                <span>👩‍⚕️ Assigned Nurse Station:</span>
                <span className="font-mono bg-emerald-500/20 px-2 py-0.5 rounded text-white">
                  {activeVisit.doctor?.employeeId === 'DOC-YOGESH-101' ? 'Room 204' :
                   activeVisit.doctor?.employeeId === 'DOC-VIKRAM-102' ? 'Room 101' :
                   activeVisit.doctor?.employeeId === 'DOC-RAJESH-103' ? 'Room 105' :
                   activeVisit.doctor?.employeeId === 'DOC-DESAI-104' ? 'Room 210' :
                   activeVisit.doctor?.employeeId === 'DOC-NEHA-105' ? 'Room 302' :
                   activeVisit.doctor?.employeeId === 'DOC-ALOK-106' ? 'Room 208' :
                   activeVisit.doctor?.employeeId === 'DOC-HARISH-201' ? 'Room 103' : 'Room 101'}
                </span>
              </div>
              <p className="text-slate-200 text-[11px] leading-relaxed">
                {activeVisit.doctor?.nurses?.[0]?.user?.name || 'Nurse Preeti Patel'} • Please complete BP &amp; Vitals check before consultation.
              </p>
            </div>

            <button
              onClick={() => navigate(`/kiosk/intake/${activeVisit.id}`)}
              className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow"
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
              Upload prescription PDFs and lab reports. Groq AI will analyze and index your history.
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
            timeline.map((item: any, idx: number) => {
              const docName = item.doctor?.name || 'Dr. Yogesh Sharma';
              const docSpec = item.doctor?.specialization || item.department || 'General Medicine';
              const diagnosis = item.doctor?.diagnosis || item.chiefComplaint || 'Consultation Completed';
              const aiSummary = item.aiSummary?.historyOfPresentIllness || item.aiSummary?.chiefComplaint || item.description || 'Intake summary recorded at MediKiosk.';
              const rx = item.lastPrescription || (item.prescriptions?.length ? item.prescriptions.map((p: any) => `${p.medicineName} (${p.dosage})`).join(', ') : null);

              return (
                <div key={idx} className="relative flex items-start gap-6 pl-2">
                  {/* Node Dot */}
                  <div className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center shrink-0 z-10 shadow-md">
                    <Stethoscope className="w-3.5 h-3.5" />
                  </div>

                  {/* Content Box */}
                  <div className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl p-5 hover:shadow-md transition-all space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-200/80">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{item.chiefComplaint || item.title || 'OPD Consultation'}</h3>
                        <span className="text-[11px] text-blue-600 font-semibold">{item.department || 'General Medicine'}</span>
                      </div>
                      <span className="text-xs text-slate-400 font-mono">
                        {item.date ? new Date(item.date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Past Visit'}
                      </span>
                    </div>

                    {/* Doctor Details */}
                    <div className="p-3 bg-white rounded-xl border border-slate-200/80 space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-700 flex items-center gap-1.5">
                          <Stethoscope className="w-3.5 h-3.5 text-blue-600" /> {docName}
                        </span>
                        <span className="text-[10px] text-slate-500">{docSpec}</span>
                      </div>
                      <p className="text-slate-600">
                        <strong className="text-slate-700">Diagnosis: </strong>
                        <span className="text-emerald-600 font-semibold">{diagnosis}</span>
                      </p>
                    </div>

                    {/* AI Summary */}
                    <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs space-y-1">
                      <span className="font-bold text-blue-900 flex items-center gap-1.5 text-[11px] uppercase">
                        <FileText className="w-3.5 h-3.5 text-blue-600" /> AI Clinical Intake Findings
                      </span>
                      <p className="text-slate-700 text-[11px] leading-relaxed">{aiSummary}</p>
                    </div>

                    {/* Vitals & Prescription */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-500">
                      {item.vitals && (
                        <span className="font-mono text-[10px] bg-slate-200/70 px-2 py-0.5 rounded text-slate-700">
                          BP: {item.vitals.bpSystolic}/{item.vitals.bpDiastolic} • Pulse: {item.vitals.pulse}
                        </span>
                      )}
                      {rx && (
                        <span className="text-slate-700 font-medium ml-auto">
                          💊 <strong>Rx:</strong> {rx}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
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
