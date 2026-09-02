import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React Error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  private handleGoHome = () => {
    try {
      localStorage.removeItem('medikiosk_active_session_data');
      localStorage.removeItem('medikiosk_active_session');
      localStorage.removeItem('medikiosk_active_patient');
      localStorage.removeItem('medikiosk_active_visit');
      localStorage.removeItem('medikiosk_active_queue');
    } catch {}
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6 shadow-2xl text-center">
            <div className="w-16 h-16 bg-red-500/20 text-red-400 rounded-2xl flex items-center justify-center mx-auto border border-red-500/30">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-bold text-white">
                {this.props.fallbackTitle || 'Workspace Recovered from Unexpected Error'}
              </h1>
              <p className="text-xs text-slate-400 leading-relaxed">
                A rendering issue was intercepted safely. Click reload to refresh the clinical workspace.
              </p>
              {this.state.error && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-left overflow-x-auto">
                  <p className="text-[11px] font-mono text-red-400 truncate">
                    {this.state.error.message || String(this.state.error)}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-blue-600/30"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload Workspace</span>
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer border border-slate-700"
              >
                <Home className="w-4 h-4" />
                <span>Home</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
