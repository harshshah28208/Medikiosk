import { Response, NextFunction } from 'express';
import prisma from '../config/db.js';
import type { AuthRequest, Role } from './auth.js';

export async function createAuditLog(params: {
  userId?: string;
  role?: Role | string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, any> | string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  try {
    const detailsStr =
      typeof params.details === 'object'
        ? JSON.stringify(params.details)
        : params.details || null;

    await prisma.auditLog.create({
      data: {
        userId: params.userId || null,
        role: params.role || null,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId || null,
        details: detailsStr,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
      },
    });
  } catch (err) {
    console.error('[AUDIT] Failed to create audit log:', err);
  }
}

export function auditMiddleware(action: string, resourceType: string) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const originalJson = res.json.bind(res);

    res.json = function (body: any) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        createAuditLog({
          userId: req.user?.id,
          role: req.user?.role,
          action,
          resourceType,
          resourceId: body?.id || (typeof req.params?.id === 'string' ? req.params.id : undefined),
          details: { method: req.method, path: req.path },
          ipAddress: req.ip,
          userAgent: Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'],
        });
      }
      return originalJson(body);
    };

    next();
  };
}
