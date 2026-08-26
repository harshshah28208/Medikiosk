import { Router, Response } from 'express';
import prisma from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdminRole } from '../middleware/rbac.js';
import type { AuthRequest } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/admin/departments (Public / Registration Access)
 * List all active hospital departments.
 */
router.get('/departments', async (_req, res: Response): Promise<void> => {
  try {
    const departments = await prisma.department.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
      },
      orderBy: { code: 'asc' },
    });
    res.json({ departments });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

// All subsequent admin management routes require authentication & Admin role
router.use(authenticateToken);
router.use(requireAdminRole());

/**
 * GET /api/admin/dashboard
 * Real-time operational metrics from database.
 */
router.get('/dashboard', async (_req: AuthRequest, res: Response): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    patientsToday,
    totalPatients,
    visitsToday,
    activeAlerts,
    departmentStats,
    visitStatusCounts,
    priorityCounts,
  ] = await Promise.all([
    prisma.patient.count({ where: { createdAt: { gte: today } } }),
    prisma.patient.count(),
    prisma.visit.count({ where: { createdAt: { gte: today } } }),
    prisma.emergencyAlert.count({ where: { status: { in: ['UNACKNOWLEDGED', 'ACKNOWLEDGED'] } } }),
    prisma.visit.groupBy({
      by: ['departmentId'],
      where: { createdAt: { gte: today } },
      _count: { id: true },
    }),
    prisma.visit.groupBy({
      by: ['status'],
      where: { createdAt: { gte: today } },
      _count: { id: true },
    }),
    prisma.visit.groupBy({
      by: ['priority'],
      where: { createdAt: { gte: today } },
      _count: { id: true },
    }),
  ]);

  const departments = await prisma.department.findMany({
    select: { id: true, name: true, code: true },
  });

  const deptMap = new Map(departments.map(d => [d.id, d]));

  res.json({
    metrics: {
      patientsToday,
      totalPatients,
      visitsToday,
      activeAlerts,
      departmentWorkload: departmentStats.map(d => ({
        department: deptMap.get(d.departmentId),
        count: d._count.id,
      })),
      visitsByStatus: Object.fromEntries(
        visitStatusCounts.map(v => [v.status, v._count.id])
      ),
      visitsByPriority: Object.fromEntries(
        priorityCounts.map(v => [v.priority, v._count.id])
      ),
    },
  });
});

/**
 * GET /api/admin/audit-logs
 * Paginated audit log viewer.
 */
router.get('/audit-logs', async (req: AuthRequest, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      include: { user: { select: { name: true, email: true, role: true } } },
      orderBy: { timestamp: 'desc' },
      skip,
      take: limit,
    }),
    prisma.auditLog.count(),
  ]);

  res.json({
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

/**
 * GET /api/admin/users
 * List all users with their profiles.
 */
router.get('/users', async (_req: AuthRequest, res: Response): Promise<void> => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      phone: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ users });
});

export default router;
