// ============================================
// Application Constants & Type Definitions
// ============================================

/** All user roles in the system */
export const ROLES = {
  PATIENT: 'PATIENT',
  RECEPTION: 'RECEPTION',
  TRIAGE_STAFF: 'TRIAGE_STAFF',
  NURSE: 'NURSE',
  DOCTOR: 'DOCTOR',
  SPECIALIST_DOCTOR: 'SPECIALIST_DOCTOR',
  AYUSH_DOCTOR: 'AYUSH_DOCTOR',
  HOSPITAL_ADMIN: 'HOSPITAL_ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

/** Clinical staff roles (can view patient clinical data) */
export const CLINICAL_ROLES: RoleName[] = [
  'DOCTOR',
  'SPECIALIST_DOCTOR',
  'AYUSH_DOCTOR',
  'NURSE',
  'TRIAGE_STAFF',
];

/** Roles that can prescribe */
export const PRESCRIBING_ROLES: RoleName[] = [
  'DOCTOR',
  'SPECIALIST_DOCTOR',
  'AYUSH_DOCTOR',
];

/** Admin roles */
export const ADMIN_ROLES: RoleName[] = [
  'HOSPITAL_ADMIN',
  'SUPER_ADMIN',
];

/** All doctor-type roles */
export const DOCTOR_ROLES: RoleName[] = [
  'DOCTOR',
  'SPECIALIST_DOCTOR',
  'AYUSH_DOCTOR',
];

/** Visit status transitions (valid next states) */
export const VISIT_TRANSITIONS: Record<string, string[]> = {
  REGISTERED: ['CONSENT_GIVEN', 'CANCELLED'],
  CONSENT_GIVEN: ['IN_INTAKE', 'CANCELLED'],
  IN_INTAKE: ['INTAKE_COMPLETE', 'CANCELLED'],
  INTAKE_COMPLETE: ['IN_TRIAGE', 'WAITING_NURSE', 'WAITING_DOCTOR'],
  IN_TRIAGE: ['WAITING_NURSE', 'WAITING_DOCTOR'],
  WAITING_NURSE: ['VITALS_RECORDED'],
  VITALS_RECORDED: ['WAITING_DOCTOR'],
  WAITING_DOCTOR: ['IN_CONSULTATION'],
  IN_CONSULTATION: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

/** Socket.io event names */
export const SOCKET_EVENTS = {
  RED_FLAG_ALERT: 'RED_FLAG_ALERT',
  QUEUE_UPDATE: 'QUEUE_UPDATE',
  PATIENT_CALLED: 'PATIENT_CALLED',
  VITALS_RECORDED: 'VITALS_RECORDED',
  STAFF_ASSISTANCE: 'STAFF_ASSISTANCE',
  PRESCRIPTION_READY: 'PRESCRIPTION_READY',
  NOTIFICATION: 'NOTIFICATION',
} as const;

/** Audit action names */
export const AUDIT_ACTIONS = {
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  REGISTER_PATIENT: 'REGISTER_PATIENT',
  CREATE_VISIT: 'CREATE_VISIT',
  GRANT_CONSENT: 'GRANT_CONSENT',
  START_INTAKE: 'START_INTAKE',
  COMPLETE_INTAKE: 'COMPLETE_INTAKE',
  RECORD_VITALS: 'RECORD_VITALS',
  UPLOAD_DOCUMENT: 'UPLOAD_DOCUMENT',
  PROCESS_OCR: 'PROCESS_OCR',
  RED_FLAG_DETECTED: 'RED_FLAG_DETECTED',
  TRIAGE_ACTION: 'TRIAGE_ACTION',
  REVIEW_SUMMARY: 'REVIEW_SUMMARY',
  CREATE_CONSULTATION: 'CREATE_CONSULTATION',
  CREATE_PRESCRIPTION: 'CREATE_PRESCRIPTION',
  STAFF_ASSISTANCE_REQUEST: 'STAFF_ASSISTANCE_REQUEST',
  ADMIN_ACTION: 'ADMIN_ACTION',
} as const;

/** MRN prefix and starting number for live registrations */
export const MRN_CONFIG = {
  PREFIX: 'MK',
  SEED_RANGE_START: 1,
  SEED_RANGE_END: 99,
  LIVE_START: 1001,
};

/** Token prefix per department */
export const TOKEN_PREFIXES: Record<string, string> = {
  GEN: 'G',
  CARD: 'C',
  PED: 'P',
  ORTHO: 'O',
  DERM: 'D',
  AYUSH: 'A',
  ENT: 'E',
  DEFAULT: 'T',
};
