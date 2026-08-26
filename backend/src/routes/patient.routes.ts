import { Router } from 'express';
import {
  registerPatient,
  lookupPatient,
  getPatient,
  getMyPatientRecord,
} from '../controllers/patient.controller.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireClinicalRole } from '../middleware/rbac.js';
import { validateBody } from '../middleware/validate.js';
import { registerPatientSchema, patientLookupSchema } from '../validators/patient.schema.js';

const router = Router();

// Public / Kiosk Registration (allows new patients to self-register without pre-login)
router.post(
  '/register',
  validateBody(registerPatientSchema),
  registerPatient
);

// Public / Kiosk Lookup (allows patients to identify themselves via phone/MRN/ABHA)
router.post('/lookup', validateBody(patientLookupSchema), lookupPatient);

// Authenticated Routes
router.use(authenticateToken);
router.get('/me', getMyPatientRecord);
router.get('/:id', requireClinicalRole(), getPatient);

export default router;
