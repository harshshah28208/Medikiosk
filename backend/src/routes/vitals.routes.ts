import { Router, Response } from 'express';
import prisma from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireClinicalRole, requireRole } from '../middleware/rbac.js';
import { createAuditLog } from '../middleware/audit.js';
import { AUDIT_ACTIONS, SOCKET_EVENTS } from '../config/constants.js';
import { validateBody } from '../middleware/validate.js';
import { recordVitalsSchema } from '../validators/vitals.schema.js';
import { RedFlagEngine } from '../ai/RedFlagEngine.js';
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

    // Evaluate Vitals-Based Red Flags (Hypoxemia, Hypertensive Crisis, Tachycardia, Severe Fever)
    const vitalsAlerts = RedFlagEngine.evaluateVitals(data);
    const io = req.app.get('io');

    if (vitalsAlerts.length > 0) {
      for (const alert of vitalsAlerts) {
        const createdAlert = await prisma.emergencyAlert.create({
          data: {
            visitId: data.visitId,
            patientId: data.patientId,
            alertType: alert.type,
            severity: alert.severity,
            description: `${alert.symptoms} — ${alert.description}`,
            triggerSource: 'VITALS_MONITOR',
            status: 'UNACKNOWLEDGED',
          },
        });

        await prisma.visit.update({
          where: { id: data.visitId },
          data: { priority: alert.severity === 'CRITICAL' ? 'EMERGENCY' : 'URGENT' },
        });

        await prisma.queueEntry.updateMany({
          where: { visitId: data.visitId },
          data: { priority: alert.severity === 'CRITICAL' ? 'EMERGENCY' : 'URGENT' },
        });

        if (io) {
          io.emit(SOCKET_EVENTS.RED_FLAG_ALERT, {
            alertId: createdAlert.id,
            visitId: data.visitId,
            patientName: vital.patient.name,
            mrn: vital.patient.mrn,
            symptoms: alert.symptoms,
            severity: alert.severity,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    // Update visit status to VITALS_RECORDED
    await prisma.visit.update({
      where: { id: data.visitId },
      data: { status: 'VITALS_RECORDED' },
    });

    // Realtime broadcast to doctor dashboard
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
      details: { visitId: data.visitId, bp: `${data.bpSystolic}/${data.bpDiastolic}`, spo2: data.spo2, alertsCount: vitalsAlerts.length },
    });

    res.status(201).json({ vital, alerts: vitalsAlerts });
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
