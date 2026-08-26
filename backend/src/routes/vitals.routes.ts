import { Router, Response } from 'express';
import prisma from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireClinicalRole, requireRole } from '../middleware/rbac.js';
import { createAuditLog } from '../middleware/audit.js';
import { AUDIT_ACTIONS, SOCKET_EVENTS } from '../config/constants.js';
import { validateBody } from '../middleware/validate.js';
import { recordVitalsSchema } from '../validators/vitals.schema.js';
import type { AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

/**
 * POST /api/vitals
 * Nurse / Clinical staff records patient vitals.
 */
router.post(
  '/',
  requireClinicalRole(),
  validateBody(recordVitalsSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const data = req.body;

    // Calculate BMI if height and weight provided
    let bmi = undefined;
    if (data.height && data.weight) {
      const heightInMeters = data.height / 100;
      bmi = parseFloat((data.weight / (heightInMeters * heightInMeters)).toFixed(1));
    }

    const vital = await prisma.vital.create({
      data: {
        visitId: data.visitId,
        patientId: data.patientId,
        temperature: data.temperature || null,
        pulse: data.pulse || null,
        bpSystolic: data.bpSystolic || null,
        bpDiastolic: data.bpDiastolic || null,
        respRate: data.respRate || null,
        spo2: data.spo2 || null,
        weight: data.weight || null,
        height: data.height || null,
        bmi: bmi || null,
        painScore: data.painScore || null,
        notes: data.notes || null,
        recordedBy: req.user?.id || '00000000-0000-0000-0000-000000000000',
      },
      include: {
        patient: { select: { name: true, mrn: true } },
      },
    });

    // Update visit status to VITALS_RECORDED
    await prisma.visit.update({
      where: { id: data.visitId },
      data: { status: 'VITALS_RECORDED' },
    });

    // Realtime broadcast to doctor dashboard
    const io = req.app.get('io');
    if (io) {
      io.emit(SOCKET_EVENTS.VITALS_RECORDED, {
        vitalId: vital.id,
        visitId: data.visitId,
        patientName: vital.patient.name,
        bp: `${data.bpSystolic || '--'}/${data.bpDiastolic || '--'}`,
        spo2: data.spo2,
        pulse: data.pulse,
        timestamp: new Date().toISOString(),
      });
    }

    await createAuditLog({
      userId: req.user?.id,
      role: req.user?.role,
      action: AUDIT_ACTIONS.RECORD_VITALS,
      resourceType: 'VITAL',
      resourceId: vital.id,
      details: { visitId: data.visitId, bp: `${data.bpSystolic}/${data.bpDiastolic}`, spo2: data.spo2 },
    });

    res.status(201).json({ vital });
  }
);

/**
 * GET /api/vitals/:visitId
 * Get vitals history for a visit.
 */
router.get('/:visitId', requireClinicalRole(), async (req: AuthRequest, res: Response): Promise<void> => {
  const visitId = typeof req.params.visitId === 'string' ? req.params.visitId : req.params.visitId[0];

  const vitals = await prisma.vital.findMany({
    where: { visitId },
    orderBy: { recordedAt: 'desc' },
  });

  res.json({ vitals });
});

export default router;
