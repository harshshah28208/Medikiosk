import { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.js';
import type { RoleName } from '../config/constants.js';

/**
 * Middleware factory: require one of the specified roles.
 * SUPER_ADMIN always passes.
 * Returns 403 if user's role is not in the allowed list.
 */
export function requireRole(...allowedRoles: RoleName[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const userRole = req.user.role as RoleName;

    // SUPER_ADMIN bypasses all role checks
    if (userRole === 'SUPER_ADMIN') {
      return next();
    }

    if (allowedRoles.includes(userRole)) {
      return next();
    }

    res.status(403).json({
      error: `Access denied. Required roles: ${allowedRoles.join(', ')}. Your role: ${userRole}`,
    });
  };
}

/**
 * Middleware: require any clinical staff role.
 */
export function requireClinicalRole() {
  return requireRole('DOCTOR', 'SPECIALIST_DOCTOR', 'AYUSH_DOCTOR', 'NURSE', 'TRIAGE_STAFF');
}

/**
 * Middleware: require any doctor role (can prescribe, consult).
 */
export function requireDoctorRole() {
  return requireRole('DOCTOR', 'SPECIALIST_DOCTOR', 'AYUSH_DOCTOR');
}

/**
 * Middleware: require admin role.
 */
export function requireAdminRole() {
  return requireRole('HOSPITAL_ADMIN', 'SUPER_ADMIN');
}
