import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';

/** 
 * Root redirect — sends authenticated users to their role-appropriate workspace.
 */
export function RoleRedirect() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const roleRoutes: Record<string, string> = {
    PATIENT: '/kiosk',
    RECEPTION: '/reception',
    TRIAGE_STAFF: '/triage',
    NURSE: '/nurse',
    DOCTOR: '/doctor',
    SPECIALIST_DOCTOR: '/doctor',
    AYUSH_DOCTOR: '/ayush',
    HOSPITAL_ADMIN: '/admin',
    SUPER_ADMIN: '/admin',
  };

  const target = roleRoutes[user.role] || '/login';
  return <Navigate to={target} replace />;
}
