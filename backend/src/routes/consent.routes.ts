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

/**
 * POST /api/consent/granular
 * Record multiple granular consent items for a patient (clinical intake, OCR, hospital sharing, ABHA exchange)
 */
router.post('/granular', async (req: AuthRequest, res: Response): Promise<void> => {
  const {
    patientId,
    visitId,
    purposes = [],
    consentVersion = '2.0',
    method = 'TOUCH_SCREEN',
  } = req.body;

  if (!patientId) {
    res.status(400).json({ error: 'patientId is required.' });
    return;
  }

  let validPatient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!validPatient) {
    validPatient = await prisma.patient.findFirst();
  }

  if (!validPatient) {
    res.status(404).json({ error: 'Patient record not found.' });
    return;
  }

  let validVisitId: string | null = null;
  if (visitId && visitId !== 'current' && visitId !== 'demo-visit') {
    const visitExists = await prisma.visit.findUnique({ where: { id: visitId } });
    if (visitExists) validVisitId = visitId;
  }

  const createdConsents = [];
  for (const p of (purposes.length > 0 ? purposes : [{ type: 'GENERAL_TREATMENT', purpose: 'General clinical care', granted: true }])) {
    const c = await prisma.consent.create({
      data: {
        patientId: validPatient.id,
        visitId: validVisitId,
        consentType: p.type || 'GENERAL_TREATMENT',
        purpose: p.purpose || 'Informed consent',
        granted: p.granted !== false,
        consentVersion,
        method: method || 'DIGITAL',
      }
    });
    createdConsents.push(c);
  }

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
    resourceType: 'GRANULAR_CONSENT',
    resourceId: validPatient.id,
    details: { totalPurposes: createdConsents.length, patientId: validPatient.id },
    ipAddress: req.ip,
  });

  res.status(201).json({
    message: 'Granular consent recorded successfully',
    consents: createdConsents,
  });
});

/**
 * POST /api/consent/revoke
 * Revoke specific consent without deleting permanent clinical record
 */
router.post('/revoke', async (req: AuthRequest, res: Response): Promise<void> => {
  const { consentId, reason } = req.body;
  if (!consentId) {
    res.status(400).json({ error: 'consentId is required.' });
    return;
  }

  const updated = await prisma.consent.update({
    where: { id: consentId },
    data: {
      granted: false,
      revokedAt: new Date(),
    }
  });

  await createAuditLog({
    userId: req.user?.id,
    role: req.user?.role || 'PATIENT',
    action: 'REVOKE_CONSENT',
    resourceType: 'CONSENT',
    resourceId: consentId,
    details: { reason: reason || 'Patient requested revocation' },
    ipAddress: req.ip,
  });

  res.json({
    message: 'Consent revoked successfully. Permanent medical records retained per healthcare retention regulations.',
    consent: updated,
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
