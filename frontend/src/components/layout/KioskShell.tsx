import React from 'react';
import { Outlet } from 'react-router-dom';

/**
 * Kiosk shell — full-screen, no sidebar, touch-friendly.
 * Used for the patient experience.
 */
export function KioskShell() {
  return (
    <div className="theme-kiosk min-h-screen">
      <Outlet />
    </div>
  );
}
