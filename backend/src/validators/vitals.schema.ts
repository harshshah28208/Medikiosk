import { z } from 'zod';

export const recordVitalsSchema = z.object({
  visitId: z.string().uuid('Invalid visit ID'),
  patientId: z.string().uuid('Invalid patient ID'),
  temperature: z.coerce.number().min(90).max(110).optional(),
  pulse: z.coerce.number().int().min(20).max(250).optional(),
  bpSystolic: z.coerce.number().int().min(50).max(300).optional(),
  bpDiastolic: z.coerce.number().int().min(20).max(200).optional(),
  respRate: z.coerce.number().int().min(5).max(60).optional(),
  spo2: z.coerce.number().int().min(50).max(100).optional(),
  weight: z.coerce.number().min(0.5).max(500).optional(),
  height: z.coerce.number().min(10).max(300).optional(),
  painScore: z.coerce.number().int().min(0).max(10).optional(),
  notes: z.string().optional(),
});

export type RecordVitalsInput = z.infer<typeof recordVitalsSchema>;
