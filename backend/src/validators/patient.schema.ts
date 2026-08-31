import { z } from 'zod';

export const registerPatientSchema = z.object({
  name: z.string().min(1, 'Name is required').max(150),
  dateOfBirth: z.string().optional().nullable(),
  age: z.union([z.number(), z.string(), z.null(), z.undefined()]).optional(),
  gender: z.string().optional().default('MALE'),
  phone: z.string().min(5, 'Phone number is required').max(25),
  email: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  emergencyContact: z.string().optional().nullable(),
  preferredLang: z.string().optional().default('EN'),
  abhaId: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  departmentCode: z.string().optional().nullable(),
  doctorId: z.string().optional().nullable(),
  reasonForVisit: z.string().optional().nullable(),
  pastMedicalHistory: z.string().optional().nullable(),
  currentMedications: z.string().optional().nullable(),
  allergies: z.string().optional().nullable(),
}).passthrough();

export const patientLookupSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  type: z.string().default('PHONE'),
});

export type RegisterPatientInput = z.infer<typeof registerPatientSchema>;
export type PatientLookupInput = z.infer<typeof patientLookupSchema>;
