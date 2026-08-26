import { z } from 'zod';

export const registerPatientSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  dateOfBirth: z.string().optional().nullable(),
  age: z.coerce.number().int().min(0).max(150).optional().nullable(),
  gender: z.string().default('MALE'),
  phone: z.string().min(8, 'Phone number is required').max(20),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  address: z.string().optional().nullable(),
  emergencyContact: z.string().optional().nullable(),
  preferredLang: z.string().default('EN'),
  abhaId: z.string().optional().nullable(),
  departmentId: z.string().min(1, 'Department is required'),
  reasonForVisit: z.string().optional().nullable(),
  pastMedicalHistory: z.string().optional().nullable(),
  currentMedications: z.string().optional().nullable(),
  allergies: z.string().optional().nullable(),
});

export const patientLookupSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  type: z.string().default('PHONE'),
});

export type RegisterPatientInput = z.infer<typeof registerPatientSchema>;
export type PatientLookupInput = z.infer<typeof patientLookupSchema>;
