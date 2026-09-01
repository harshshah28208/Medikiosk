import { Response } from 'express';
import prisma from '../config/db.js';
import { VISIT_TRANSITIONS } from '../config/constants.js';
import { createAuditLog } from '../middleware/audit.js';
import type { AuthRequest } from '../middleware/auth.js';

export async function getVisit(req: AuthRequest, res: Response): Promise<void> {
  const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];

  const visit = await prisma.visit.findUnique({
    where: { id },
    include: {
      patient: {
        select: {
          id: true, mrn: true, name: true, age: true, gender: true,
          phone: true, preferredLang: true, abhaId: true,
          allergies: { where: { status: 'ACTIVE' } },
          medications: { where: { status: 'ACTIVE' } },
          documents: {
            orderBy: { uploadedAt: 'desc' },
            include: { extractions: true },
          },
        },
      },
      department: {
        select: {
          id: true,
          name: true,
          code: true,
          nurses: {
            select: {
              id: true,
              employeeId: true,
              user: { select: { name: true, phone: true } },
            },
          },
        },
      },
      doctor: {
        select: {
          id: true,
          specialization: true,
          employeeId: true,
          user: { select: { name: true, phone: true } },
          nurses: {
            select: {
              id: true,
              employeeId: true,
              user: { select: { name: true, phone: true } },
            },
          },
        },
      },
      queueEntry: true,
      vitals: { orderBy: { recordedAt: 'desc' }, take: 10 },
      emergencyAlerts: { where: { status: { not: 'RESOLVED' } } },
      clinicalHistory: {
        include: { answers: { orderBy: { timestamp: 'asc' } } },
      },
      summary: true,
      consultation: true,
      prescriptions: { include: { items: true } },
      documents: {
        orderBy: { uploadedAt: 'desc' },
        include: { extractions: true },
      },
      followUps: { orderBy: { scheduledAt: 'desc' }, take: 10 },
      sessions: {
        include: { messages: { orderBy: { timestamp: 'asc' } } },
        orderBy: { startedAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!visit) {
    res.status(404).json({ error: 'Visit not found.' });
    return;
  }

  // IDOR Protection: If authenticated as PATIENT, enforce ownership
  if (req.user?.role === 'PATIENT') {
    const userPatient = await prisma.patient.findFirst({
      where: {
        OR: [
          { userId: req.user.id },
          { id: req.user.id },
          { phone: req.user.email },
        ],
      },
    });

    const isOwner = visit.patientId === req.user.id || (userPatient && visit.patientId === userPatient.id);
    if (!isOwner) {
      res.status(403).json({ error: 'Access denied. You can only view your own visits.' });
      return;
    }
  }

  res.json({ visit });
}

export async function updateVisitStatus(req: AuthRequest, res: Response): Promise<void> {
  const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
  const { status, doctorId } = req.body;

  const visit = await prisma.visit.findUnique({ where: { id } });

  if (!visit) {
    res.status(404).json({ error: 'Visit not found.' });
    return;
  }

  const allowedTransitions = VISIT_TRANSITIONS[visit.status] || [];
  if (!allowedTransitions.includes(status)) {
    res.status(400).json({
      error: `Cannot transition visit from ${visit.status} to ${status}.`,
    });
    return;
  }

  const updateData: any = { status };
  if (doctorId) updateData.doctorId = doctorId;

  const updatedVisit = await prisma.visit.update({
    where: { id },
    data: updateData,
  });

  if (status === 'IN_CONSULTATION' && doctorId) {
    await prisma.consultation.upsert({
      where: { visitId: id },
      update: { doctorId, startedAt: new Date() },
      create: { visitId: id, doctorId },
    });
  }

  await createAuditLog({
    userId: req.user?.id,
    role: req.user?.role,
    action: `VISIT_STATUS_${status}`,
    resourceType: 'VISIT',
    resourceId: id,
    details: { from: visit.status, to: status },
    ipAddress: req.ip,
  });

  res.json({ visit: updatedVisit });
}

export async function listVisits(req: AuthRequest, res: Response): Promise<void> {
  const { departmentId, status, date } = req.query;

  const where: any = {};
  if (departmentId) where.departmentId = departmentId as string;
  if (status) where.status = status as string;
  if (date) {
    const startOfDay = new Date(date as string);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date as string);
    endOfDay.setHours(23, 59, 59, 999);
    where.createdAt = { gte: startOfDay, lte: endOfDay };
  }

  // IDOR Protection: If authenticated as PATIENT, restrict list to own visits only
  if (req.user?.role === 'PATIENT') {
    const userPatient = await prisma.patient.findFirst({
      where: {
        OR: [
          { userId: req.user.id },
          { id: req.user.id },
          { phone: req.user.email },
        ],
      },
    });
    where.patientId = userPatient?.id || req.user.id;
  }

  const visits = await prisma.visit.findMany({
    where,
    include: {
      patient: {
        select: {
          id: true, mrn: true, name: true, age: true, gender: true,
          documents: { take: 3, orderBy: { uploadedAt: 'desc' } },
        },
      },
      department: { select: { id: true, name: true, code: true } },
      queueEntry: true,
      emergencyAlerts: { where: { status: { not: 'RESOLVED' } } },
      summary: true,
      documents: { take: 3, orderBy: { uploadedAt: 'desc' } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ visits });
}

/**
 * Smart Doctor Auto-Assignment
 * Finds an available doctor in the visit's department and assigns them.
 * Falls back to any available doctor if no department-specific doctor is found.
 */
export async function assignDoctor(req: AuthRequest, res: Response): Promise<void> {
  const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];

  const visit = await prisma.visit.findUnique({
    where: { id },
    include: { department: true, patient: true },
  });

  if (!visit) {
    res.status(404).json({ error: 'Visit not found.' });
    return;
  }

  // Already has a doctor assigned
  if (visit.doctorId) {
    const currentDoctor = await prisma.doctorProfile.findUnique({
      where: { id: visit.doctorId },
      include: { user: { select: { name: true } } },
    });
    res.json({
      message: 'Doctor already assigned',
      doctorId: visit.doctorId,
      doctorName: currentDoctor?.user?.name || 'Assigned Doctor',
      isNew: false,
    });
    return;
  }

  // Find available doctor in same department
  let doctor = await prisma.doctorProfile.findFirst({
    where: {
      departmentId: visit.departmentId,
      isAvailable: true,
    },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { id: 'asc' }, // Round-robin by creation order
  });

  // Fallback: Any available doctor
  if (!doctor) {
    doctor = await prisma.doctorProfile.findFirst({
      where: { isAvailable: true },
      include: { user: { select: { name: true, email: true } } },
    });
  }

  if (!doctor) {
    res.status(200).json({
      message: 'No available doctor found. Patient added to waiting queue.',
      doctorId: null,
      doctorName: null,
      isNew: false,
    });
    return;
  }

  // Assign the doctor to the visit
  await prisma.visit.update({
    where: { id },
    data: { doctorId: doctor.id },
  });

  // Update queue entry
  await prisma.queueEntry.updateMany({
    where: { visitId: id },
    data: { doctorId: doctor.id },
  });

  await createAuditLog({
    userId: req.user?.id,
    role: req.user?.role,
    action: 'DOCTOR_ASSIGNED',
    resourceType: 'VISIT',
    resourceId: id,
    details: { doctorId: doctor.id, doctorName: doctor.user?.name, departmentId: visit.departmentId },
    ipAddress: req.ip,
  });

  res.json({
    message: `Dr. ${doctor.user?.name} assigned successfully`,
    doctorId: doctor.id,
    doctorName: doctor.user?.name,
    specialization: doctor.specialization,
    isNew: true,
  });
}
