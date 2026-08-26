import React, { useState, useEffect } from 'react';
import {
  AlertCircle, ShieldAlert, CheckCircle2,
  RefreshCw, Clock, ArrowUpRight, Check
} from 'lucide-react';

export function TriageDashboard() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadAlerts = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/triage/alerts', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('medikiosk_token')}`,
        },
      });
      const data = await res.json();
      if (data?.alerts) {
        setAlerts(data.alerts);
      }
    } catch (e) {
      console.error('Triage alerts fetch error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  const handleUpdateStatus = async (alertId: string, status: string) => {
    try {
      await fetch(`http://localhost:5000/api/triage/alerts/${alertId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('medikiosk_token')}`,
        },
        body: JSON.stringify({ status }),
      });
      loadAlerts();
    } catch (e) {
      console.error('Update alert error:', e);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center text-white font-bold shadow-lg shadow-red-600/30">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Triage Emergency Center</h1>
            <p className="text-xs text-slate-400">High-priority red flag alerts & rapid physician escalation</p>
          </div>
        </div>

        <button
          onClick={loadAlerts}
          className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-2 border border-slate-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh Alerts</span>
        </button>
      </div>

      <div className="space-y-4">
        {alerts.length > 0 ? (
          alerts.map((alert) => {
            const isCritical = alert.severity === 'CRITICAL';
            return (
              <div
                key={alert.id}
                className={`
                  p-6 rounded-3xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl
                  ${isCritical
                    ? 'bg-red-950/40 border-red-500/50 shadow-red-950/20'
                    : 'bg-amber-950/30 border-amber-500/40'
                  }
                `}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0 mt-0.5 ${
                      isCritical ? 'bg-red-600 animate-pulse' : 'bg-amber-600'
                    }`}
                  >
                    <AlertCircle className="w-6 h-6" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                          isCritical
                            ? 'bg-red-500/20 text-red-300 border-red-500/40'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        }`}
                      >
                        {alert.severity} • {alert.alertType}
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-300">
                        Token: {alert.visit?.token}
                      </span>
                      <span className="text-xs text-slate-400">
                        Dept: {alert.visit?.department?.name || 'General OPD'}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-100">
                      {alert.patient?.name} ({alert.patient?.age || 45}Y / {alert.patient?.gender})
                    </h3>
                    <p className="text-xs text-slate-300 max-w-2xl leading-relaxed font-sans">
                      {alert.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  {alert.status === 'UNACKNOWLEDGED' && (
                    <button
                      onClick={() => handleUpdateStatus(alert.id, 'ACKNOWLEDGED')}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 touch-target"
                    >
                      <Check className="w-4 h-4" />
                      <span>Acknowledge</span>
                    </button>
                  )}

                  {alert.status !== 'RESOLVED' && (
                    <button
                      onClick={() => handleUpdateStatus(alert.id, 'RESOLVED')}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 touch-target"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Mark Resolved</span>
                    </button>
                  )}

                  {alert.status === 'RESOLVED' && (
                    <span className="text-xs text-green-400 font-bold px-3 py-1 bg-green-900/30 rounded-lg border border-green-700/50">
                      Resolved
                    </span>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-500">
            <CheckCircle2 className="w-10 h-10 text-green-500/50 mx-auto mb-2" />
            <p>No active red-flag emergency alerts in triage queue.</p>
          </div>
        )}
      </div>
    </div>
  );
}
