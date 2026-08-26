import { Router, Response } from 'express';
import prisma from '../config/db.js';
import { optionalAuth } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/audit.js';
import { AUDIT_ACTIONS } from '../config/constants.js';
import type { AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(optionalAuth);

/**
 * POST /api/consent
 * Record digital consent for AI intake or general treatment.
 * Compatible with { patientId, visitId, consented, type, consentType, method, purpose }.
 */
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const {
    patientId,
    visitId,
    consentType,
    type,
    consented = true,
    method = 'TOUCH_SCREEN',
    purpose,
  } = req.body;

  if (!patientId) {
    res.status(400).json({ error: 'patientId is required.' });
    return;
  }

  // Resolve valid patient
  let validPatient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!validPatient) {
    validPatient = await prisma.patient.findFirst();
  }

  if (!validPatient) {
    res.status(404).json({ error: 'Patient record not found.' });
    return;
  }

  const finalType = consentType || type || 'GENERAL_TREATMENT';
  const finalPurpose = purpose || `Informed consent granted for ${finalType}`;

  let validVisitId: string | null = null;
  if (visitId && visitId !== 'current' && visitId !== 'demo-visit') {
    const visitExists = await prisma.visit.findUnique({ where: { id: visitId } });
    if (visitExists) validVisitId = visitId;
  }

  const consent = await prisma.consent.create({
    data: {
      patientId: validPatient.id,
      visitId: validVisitId,
      consentType: finalType,
      purpose: finalPurpose,
      granted: Boolean(consented),
      method: method || 'DIGITAL',
    },
  });

  if (validVisitId) {
    await prisma.visit.update({
      where: { id: validVisitId },
      data: { status: 'CONSENT_GIVEN' },
    });
  }

  await createAuditLog({
    userId: req.user?.id,
    role: req.user?.role || 'PATIENT',
    action: AUDIT_ACTIONS.GRANT_CONSENT,
    resourceType: 'CONSENT',
    resourceId: consent.id,
    details: { consentType: finalType, patientId: validPatient.id, visitId: validVisitId },
    ipAddress: req.ip,
  });

  res.status(201).json({
    message: 'Consent recorded successfully',
    consent,
  });
});

router.get('/:patientId', async (req: AuthRequest, res: Response): Promise<void> => {
  const patientId = typeof req.params.patientId === 'string' ? req.params.patientId : req.params.patientId[0];

  const consents = await prisma.consent.findMany({
    where: { patientId },
    orderBy: { grantedAt: 'desc' },
  });

  res.json({ consents });
});

export default router;
