import { Router, Response } from 'express';
import prisma from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import type { AuthRequest } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { departmentId, status } = req.query;

  const where: any = {};
  if (departmentId && typeof departmentId === 'string') where.departmentId = departmentId;
  if (status && typeof status === 'string') where.status = status;

  if (!status) {
    where.status = { in: ['WAITING', 'CALLED', 'IN_PROGRESS'] };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    where.arrivedAt = { gte: today };
  }

  const entries = await prisma.queueEntry.findMany({
    where,
    include: {
      visit: {
        include: {
          patient: { select: { id: true, mrn: true, name: true, age: true, gender: true } },
          department: { select: { name: true, code: true } },
          emergencyAlerts: { where: { status: { not: 'RESOLVED' } }, select: { severity: true, alertType: true } },
        },
      },
    },
    orderBy: [
      { priority: 'desc' },
      { arrivedAt: 'asc' },
    ],
  });

  res.json({ queue: entries, count: entries.length });
});

router.patch('/:id',
  requireRole('RECEPTION', 'TRIAGE_STAFF', 'DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
    const { status, priority } = req.body;

    const entry = await prisma.queueEntry.findUnique({ where: { id } });
    if (!entry) {
      res.status(404).json({ error: 'Queue entry not found.' });
      return;
    }

    const updateData: any = {};
    if (status) {
      updateData.status = status;
      if (status === 'CALLED') updateData.calledAt = new Date();
      if (status === 'COMPLETED') updateData.completedAt = new Date();
    }
    if (priority) updateData.priority = priority;

    const updated = await prisma.queueEntry.update({
      where: { id },
      data: updateData,
      include: {
        visit: {
          include: {
            patient: { select: { name: true, mrn: true } },
          },
        },
      },
    });

    res.json({ queueEntry: updated });
  }
);

export default router;
