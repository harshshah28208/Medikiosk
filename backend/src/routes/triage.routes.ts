import { Router, Response } from 'express';
import prisma from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireClinicalRole, requireRole } from '../middleware/rbac.js';
import { createAuditLog } from '../middleware/audit.js';
import { AUDIT_ACTIONS, SOCKET_EVENTS } from '../config/constants.js';
import type { AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

/**
 * GET /api/triage/alerts
 * List all active emergency alerts prioritized by severity.
 */
router.get('/alerts', requireClinicalRole(), async (req: AuthRequest, res: Response): Promise<void> => {
  const { status } = req.query;

  const where: any = {};
  if (status && typeof status === 'string') {
    where.status = status;
  } else {
    where.status = { in: ['UNACKNOWLEDGED', 'ACKNOWLEDGED', 'ESCALATED'] };
  }

  const alerts = await prisma.emergencyAlert.findMany({
    where,
    include: {
      patient: {
        select: { id: true, mrn: true, name: true, age: true, gender: true, phone: true },
      },
      visit: {
        include: {
          department: { select: { name: true, code: true } },
          vitals: { orderBy: { recordedAt: 'desc' }, take: 1 },
        },
      },
    },
    orderBy: [
      { severity: 'desc' }, // CRITICAL first
      { triggeredAt: 'desc' },
    ],
  });

  res.json({ alerts, count: alerts.length });
});

/**
 * PATCH /api/triage/alerts/:id
 * Acknowledge, escalate, or resolve an alert.
 */
router.patch(
  '/alerts/:id',
  requireRole('TRIAGE_STAFF', 'DOCTOR', 'SPECIALIST_DOCTOR', 'HOSPITAL_ADMIN'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
    const { status, notes } = req.body;

    const alert = await prisma.emergencyAlert.findUnique({ where: { id } });
    if (!alert) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }

    const updateData: any = {
      status,
      notes: notes || alert.notes,
    };

    if (status === 'ACKNOWLEDGED' && !alert.acknowledgedAt) {
      updateData.acknowledgedAt = new Date();
      updateData.acknowledgedBy = req.user?.id;
    }

    if (status === 'RESOLVED') {
      updateData.resolvedAt = new Date();
    }

    const updated = await prisma.emergencyAlert.update({
      where: { id },
      data: updateData,
      include: {
        patient: { select: { name: true, mrn: true } },
        visit: { select: { token: true } },
      },
    });

    await createAuditLog({
      userId: req.user?.id,
      role: req.user?.role,
      action: AUDIT_ACTIONS.TRIAGE_ACTION,
      resourceType: 'EMERGENCY_ALERT',
      resourceId: id,
      details: { from: alert.status, to: status, severity: alert.severity },
    });

    res.json({ alert: updated });
  }
);

export default router;
