import React from 'react';
import { Construction } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
  description?: string;
}

/**
 * Generic placeholder for pages not yet implemented.
 * Shows a real "coming soon" state, never fake data.
 */
export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-8">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-800 rounded-2xl mb-4">
          <Construction className="w-8 h-8 text-slate-400" />
        </div>
        <h2 className="text-2xl font-bold text-slate-100 mb-2">{title}</h2>
        <p className="text-slate-400">
          {description || 'This workspace is being built. It will connect to the real backend when ready.'}
        </p>
        <div className="mt-6 text-xs text-slate-600 bg-slate-800/50 rounded-lg p-3 inline-block">
          Phase 2+ • No fake data displayed
        </div>
      </div>
    </div>
  );
}
