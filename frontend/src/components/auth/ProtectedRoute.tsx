import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { getStoredUser } from '../../services/api';

interface ProtectedRouteProps {
  roles?: string[];
}

/**
 * Route guard: redirects to /login if not authenticated,
 * or to / if user lacks required role.
 */
export function ProtectedRoute({ roles }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const currentUser = user || getStoredUser();
  const isAuth = isAuthenticated || Boolean(localStorage.getItem('medikiosk_token') || currentUser);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuth) {
    return <Navigate to="/login" replace />;
  }

  if (roles && currentUser) {
    const hasRole = roles.includes(currentUser.role) ||
      currentUser.role === 'SUPER_ADMIN' ||
      (roles.includes('NURSE') && (currentUser.role === 'PATIENT' || Boolean(localStorage.getItem('medikiosk_active_nurse_name'))));

    if (!hasRole) {
      return <Navigate to="/" replace />;
    }
  }

  return <Outlet />;
}
