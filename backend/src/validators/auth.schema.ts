import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

export const registerStaffSchema = z.object({
  name: z.string().min(2, 'Full name is required'),
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum([
    'PATIENT',
    'DOCTOR',
    'SPECIALIST_DOCTOR',
    'NURSE',
    'TRIAGE_STAFF',
    'AYUSH_DOCTOR',
    'RECEPTION',
    'HOSPITAL_ADMIN',
    'SUPER_ADMIN',
  ]),
  phone: z.string().optional(),
  departmentId: z.string().optional(),
  specialization: z.string().optional(),
  qualifications: z.string().optional(),
  licenseNumber: z.string().optional(),
  shiftTiming: z.string().optional(),
  age: z.coerce.number().optional(),
  gender: z.string().optional(),
  abhaId: z.string().optional(),
  address: z.string().optional(),
  emergencyContact: z.string().optional(),
  adminSecretKey: z.string().optional(),
});

export const demoLoginSchema = z.object({
  role: z.enum([
    'PATIENT',
    'RECEPTION',
    'TRIAGE_STAFF',
    'NURSE',
    'DOCTOR',
    'SPECIALIST_DOCTOR',
    'AYUSH_DOCTOR',
    'HOSPITAL_ADMIN',
    'SUPER_ADMIN',
  ]),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterStaffInput = z.infer<typeof registerStaffSchema>;
export type DemoLoginInput = z.infer<typeof demoLoginSchema>;
