import { Router, Response } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireClinicalRole } from '../middleware/rbac.js';
import { abdmAdapter } from '../integrations/abdm/ABDMAdapter.js';
import { hisAdapter } from '../integrations/his/HISAdapter.js';
import { FHIRMapper } from '../integrations/fhir/FHIRMapper.js';
import prisma from '../config/db.js';
import type { AuthRequest } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/integrations/status
 * Public / Authenticated check of ABDM sandbox, FHIR R4 mapper, and HIS adapter readiness
 */
router.get('/status', async (_req, res: Response): Promise<void> => {
  const abdmStatus = abdmAdapter.getStatus();
  const hisStatus = hisAdapter.getStatus();

  res.json({
    timestamp: new Date().toISOString(),
    abdm: abdmStatus,
    his: hisStatus,
    fhir: {
      standard: 'HL7 FHIR R4',
      profile: 'NRCES ABDM FHIR Profile v1.0',
      supportedResources: [
        'Patient',
        'Encounter',
        'Observation (Vitals & Labs)',
        'Condition (Diagnoses & Complaints)',
        'AllergyIntolerance',
        'MedicationRequest',
        'DocumentReference',
        'Bundle (Document Type)'
      ],
      validatorActive: true
    }
  });
});

/**
 * POST /api/integrations/abdm/verify-format
 * Validate format of ABHA Number / PHR Address
 */
router.post('/abdm/verify-format', async (req, res: Response): Promise<void> => {
  const { abhaId } = req.body;
  if (!abhaId) {
    res.status(400).json({ error: 'abhaId is required.' });
    return;
  }
  const result = abdmAdapter.verifyAbhaFormat(abhaId);
  res.json(result);
});

/**
 * POST /api/integrations/abdm/request-otp
 * Sandbox-ready ABHA OTP request
 */
router.post('/abdm/request-otp', async (req, res: Response): Promise<void> => {
  const { authMethod, value } = req.body;
  if (!authMethod || !value) {
    res.status(400).json({ error: 'authMethod and value (mobile/aadhaar) are required.' });
    return;
  }
  const result = await abdmAdapter.requestAbhaOtp(authMethod, value);
  res.json(result);
});

/**
 * GET /api/integrations/fhir/bundle/:visitId
 * Generates an official HL7 FHIR R4 Bundle for an active or completed visit
 */
router.get('/fhir/bundle/:visitId', authenticateToken, requireClinicalRole(), async (req: AuthRequest, res: Response): Promise<void> => {
  const visitId = typeof req.params.visitId === 'string' ? req.params.visitId : req.params.visitId[0];

  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: {
      patient: {
        include: {
          allergies: true,
          medications: true,
        }
      },
      doctor: {
        include: {
          user: true
        }
      },
      clinicalHistory: true,
      summary: true,
      vitals: { orderBy: { recordedAt: 'desc' } },
      labResults: true,
      prescriptions: {
        include: {
          items: true
        }
      },
      ayushAssessment: true,
    }
  });

  if (!visit) {
    res.status(404).json({ error: `Visit with ID ${visitId} not found.` });
    return;
  }

  const fhirBundle = FHIRMapper.buildFHIRBundle(visit);
  res.json(fhirBundle);
});

/**
 * POST /api/integrations/his/export/:visitId
 * Export structured encounter and FHIR bundle to hospital HIS/EMR
 */
router.post('/his/export/:visitId', authenticateToken, requireClinicalRole(), async (req: AuthRequest, res: Response): Promise<void> => {
  const visitId = typeof req.params.visitId === 'string' ? req.params.visitId : req.params.visitId[0];

  try {
    const result = await hisAdapter.exportVisitToHIS(visitId);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
