import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import {
  Hospital, LogOut, Menu, X,
  LayoutDashboard, Users, Stethoscope, Activity, Shield,
  FileText, Bell, Settings, ClipboardList, AlertCircle, Leaf,
  UserCog, BarChart3, ScrollText
} from 'lucide-react';

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
}

const ROLE_NAV: Record<string, NavItem[]> = {
  RECEPTION: [
    { label: 'Dashboard', path: '/reception', icon: LayoutDashboard },
    { label: 'Patients', path: '/reception/patients', icon: Users },
    { label: 'Register', path: '/reception/register', icon: ClipboardList },
    { label: 'Queue', path: '/reception/queue', icon: Activity },
  ],
  TRIAGE_STAFF: [
    { label: 'Dashboard', path: '/triage', icon: LayoutDashboard },
    { label: 'Alerts', path: '/triage/alerts', icon: AlertCircle },
  ],
  NURSE: [
    { label: 'Dashboard', path: '/nurse', icon: LayoutDashboard },
  ],
  DOCTOR: [
    { label: 'Dashboard', path: '/doctor', icon: LayoutDashboard },
  ],
  SPECIALIST_DOCTOR: [
    { label: 'Dashboard', path: '/doctor', icon: LayoutDashboard },
  ],
  AYUSH_DOCTOR: [
    { label: 'Dashboard', path: '/ayush', icon: LayoutDashboard },
  ],
  HOSPITAL_ADMIN: [
    { label: 'Overview', path: '/admin', icon: LayoutDashboard },
    { label: 'Patients', path: '/admin/patients', icon: Users },
    { label: 'Staff', path: '/admin/staff', icon: UserCog },
    { label: 'Analytics', path: '/admin/analytics', icon: BarChart3 },
    { label: 'Audit Log', path: '/admin/audit', icon: ScrollText },
    { label: 'Settings', path: '/admin/settings', icon: Settings },
  ],
  SUPER_ADMIN: [
    { label: 'Overview', path: '/admin', icon: LayoutDashboard },
    { label: 'Patients', path: '/admin/patients', icon: Users },
    { label: 'Staff', path: '/admin/staff', icon: UserCog },
    { label: 'Analytics', path: '/admin/analytics', icon: BarChart3 },
    { label: 'Audit Log', path: '/admin/audit', icon: ScrollText },
    { label: 'Settings', path: '/admin/settings', icon: Settings },
  ],
};

const ROLE_THEME: Record<string, { bg: string; accent: string; label: string }> = {
  RECEPTION: { bg: 'bg-slate-900', accent: 'text-teal-400', label: 'Reception' },
  TRIAGE_STAFF: { bg: 'bg-slate-900', accent: 'text-red-400', label: 'Triage' },
  NURSE: { bg: 'bg-slate-900', accent: 'text-green-400', label: 'Nursing Station' },
  DOCTOR: { bg: 'bg-slate-950', accent: 'text-blue-400', label: 'Doctor Workspace' },
  SPECIALIST_DOCTOR: { bg: 'bg-slate-950', accent: 'text-indigo-400', label: 'Specialist Workspace' },
  AYUSH_DOCTOR: { bg: 'bg-slate-900', accent: 'text-amber-400', label: 'AYUSH Workspace' },
  HOSPITAL_ADMIN: { bg: 'bg-slate-900', accent: 'text-purple-400', label: 'Administration' },
  SUPER_ADMIN: { bg: 'bg-slate-900', accent: 'text-purple-400', label: 'System Administration' },
};

/**
 * Staff workspace shell — sidebar navigation, dark theme.
 * Adapts navigation and styling based on user role.
 */
export function StaffShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const role = user?.role || 'DOCTOR';
  const navItems = ROLE_NAV[role] || ROLE_NAV.DOCTOR;
  const theme = ROLE_THEME[role] || ROLE_THEME.DOCTOR;

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className={`min-h-screen ${theme.bg} text-slate-100 flex`}>
      {/* Sidebar */}
      <aside className={`
        ${sidebarOpen ? 'w-60' : 'w-16'} 
        bg-slate-800/50 border-r border-slate-700/50
        flex flex-col transition-all duration-200 shrink-0
      `}>
        {/* Logo */}
        <div className="p-4 border-b border-slate-700/50 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <Hospital className="w-4 h-4 text-white" />
          </div>
          {sidebarOpen && (
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-white truncate">MediKiosk</h1>
              <p className={`text-xs ${theme.accent} truncate`}>{theme.label}</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map(({ label, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === `/${role.toLowerCase().replace('_', '-')}`}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                transition-colors touch-target
                ${isActive
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                }
              `}
            >
              <Icon className="w-4.5 h-4.5 shrink-0" />
              {sidebarOpen && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User info + Logout */}
        <div className="p-3 border-t border-slate-700/50">
          {sidebarOpen && (
            <div className="mb-2 px-2">
              <p className="text-sm font-medium text-slate-200 truncate">{user?.name}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 w-full text-sm text-slate-400
              hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors touch-target"
          >
            <LogOut className="w-4 h-4" />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>

        {/* Toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 border-t border-slate-700/50 text-slate-500 hover:text-slate-300
            flex items-center justify-center"
        >
          {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
