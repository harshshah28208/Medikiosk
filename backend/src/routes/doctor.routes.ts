import { Router, Response } from 'express';
import prisma from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireClinicalRole, requireDoctorRole } from '../middleware/rbac.js';
import { createAuditLog } from '../middleware/audit.js';
import { AUDIT_ACTIONS, SOCKET_EVENTS } from '../config/constants.js';
import type { AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

/**
 * GET /api/doctor/patients
 * Get list of today's assigned and waiting patients for doctor dashboard.
 */
router.get('/patients', requireClinicalRole(), async (req: AuthRequest, res: Response): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const visits = await prisma.visit.findMany({
    where: {
      createdAt: { gte: today },
    },
    include: {
      patient: {
        select: {
          id: true,
          mrn: true,
          name: true,
          age: true,
          gender: true,
          phone: true,
          preferredLang: true,
          allergies: { where: { status: 'ACTIVE' } },
        },
      },
      department: { select: { id: true, name: true, code: true } },
      queueEntry: true,
      vitals: { orderBy: { recordedAt: 'desc' }, take: 1 },
      emergencyAlerts: { where: { status: { not: 'RESOLVED' } } },
      clinicalHistory: { select: { id: true, chiefComplaint: true, status: true, completionScore: true } },
      summary: { select: { id: true, status: true } },
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
  });

  res.json({ visits, count: visits.length });
});

/**
 * GET /api/doctor/summary/:visitId
 * Get structured AI clinical summary draft for review.
 */
router.get('/summary/:visitId', requireClinicalRole(), async (req: AuthRequest, res: Response): Promise<void> => {
  const visitId = typeof req.params.visitId === 'string' ? req.params.visitId : req.params.visitId[0];

  const summary = await prisma.clinicalSummary.findUnique({
    where: { visitId },
    include: {
      patient: true,
      visit: {
        include: {
          department: true,
          vitals: { orderBy: { recordedAt: 'desc' } },
          emergencyAlerts: true,
          documents: { include: { extractions: true } },
          sessions: {
            include: { messages: { orderBy: { timestamp: 'asc' } } },
            orderBy: { startedAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  });

  if (!summary) {
    res.status(404).json({ error: 'Clinical summary not found for this visit.' });
    return;
  }

  res.json({ summary });
});

/**
 * PATCH /api/doctor/summary/:visitId
 * Doctor edits, confirms, or rejects the AI draft summary.
 */
router.patch('/summary/:visitId', requireDoctorRole(), async (req: AuthRequest, res: Response): Promise<void> => {
  const visitId = typeof req.params.visitId === 'string' ? req.params.visitId : req.params.visitId[0];
  const { summaryJson, status = 'CONFIRMED', reviewNotes } = req.body;

  const existing = await prisma.clinicalSummary.findUnique({ where: { visitId } });
  if (!existing) {
    res.status(404).json({ error: 'Summary not found' });
    return;
  }

  const updated = await prisma.clinicalSummary.update({
    where: { visitId },
    data: {
      status,
      summaryJson: summaryJson || existing.summaryJson,
      reviewedById: req.user?.id,
      reviewedAt: new Date(),
      reviewNotes: reviewNotes || null,
    },
  });

  await createAuditLog({
    userId: req.user?.id,
    role: req.user?.role,
    action: AUDIT_ACTIONS.REVIEW_SUMMARY,
    resourceType: 'CLINICAL_SUMMARY',
    resourceId: updated.id,
    details: { visitId, status, wasEdited: status === 'EDITED' },
  });

  res.json({ summary: updated });
});

/**
 * POST /api/doctor/consultation
 * Doctor records consultation notes, diagnoses, treatment plan, and prescription.
 */
router.post('/consultation', requireDoctorRole(), async (req: AuthRequest, res: Response): Promise<void> => {
  const {
    visitId,
    patientId,
    clinicalNotes,
    impression,
    diagnosis,
    treatmentPlan,
    prescriptions = [],
  } = req.body;

  if (!visitId || !patientId) {
    res.status(400).json({ error: 'visitId and patientId are required' });
    return;
  }

  const doctorProfile = await prisma.doctorProfile.findFirst({
    where: { userId: req.user?.id },
  });

  const docId = doctorProfile?.id || (await prisma.doctorProfile.findFirst())?.id;
  if (!docId) {
    res.status(400).json({ error: 'Doctor profile not found' });
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const diagnosisStr = Array.isArray(diagnosis)
      ? diagnosis.join(', ')
      : (typeof diagnosis === 'string' ? diagnosis : (impression || ''));

    // 1. Create Consultation
    const consultation = await tx.consultation.upsert({
      where: { visitId },
      update: {
        clinicalNotes: clinicalNotes || '',
        impression: impression || '',
        diagnosis: diagnosisStr,
        treatmentPlan: treatmentPlan || '',
        status: 'COMPLETED',
        completedAt: new Date(),
      },
      create: {
        visitId,
        doctorId: docId,
        clinicalNotes: clinicalNotes || '',
        impression: impression || '',
        diagnosis: diagnosisStr,
        treatmentPlan: treatmentPlan || '',
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    // 2. Create Prescription & Items if prescribed
    let prescription = null;
    if (prescriptions && prescriptions.length > 0) {
      prescription = await tx.prescription.create({
        data: {
          visitId,
          patientId,
          doctorId: docId,
          notes: treatmentPlan || null,
          items: {
            create: prescriptions.map((item: any) => ({
              medicineName: item.medicineName,
              dosage: item.dosage || '1 tab',
              route: item.route || 'ORAL',
              frequency: item.frequency || 'Twice daily',
              duration: item.duration || '5 days',
              instructions: item.instructions || 'After meals',
            })),
          },
        },
        include: { items: true },
      });
    }

    // 3. Complete Visit & Queue
    await tx.visit.update({
      where: { id: visitId },
      data: { status: 'COMPLETED' },
    });

    await tx.queueEntry.updateMany({
      where: { visitId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    return { consultation, prescription };
  });

  const io = req.app.get('io');
  if (io) {
    io.emit(SOCKET_EVENTS.PRESCRIPTION_READY, {
      visitId,
      patientId,
      timestamp: new Date().toISOString(),
    });
  }

  await createAuditLog({
    userId: req.user?.id,
    role: req.user?.role,
    action: AUDIT_ACTIONS.CREATE_CONSULTATION,
    resourceType: 'CONSULTATION',
    resourceId: result.consultation.id,
    details: { visitId, prescribedCount: prescriptions.length },
  });

  res.status(201).json({
    message: 'Consultation & prescription saved successfully.',
    consultation: result.consultation,
    prescription: result.prescription,
  });
});

/**
 * GET /api/doctor/timeline/:patientId
 * Get the longitudinal clinical history for a patient (past visits, complaints, summaries).
 */
router.get('/timeline/:patientId', requireClinicalRole(), async (req: AuthRequest, res: Response): Promise<void> => {
  const patientId = typeof req.params.patientId === 'string' ? req.params.patientId : req.params.patientId[0];

  const visits = await prisma.visit.findMany({
    where: { patientId },
    include: {
      clinicalHistory: {
        select: { chiefComplaint: true, status: true, completionScore: true, createdAt: true },
      },
      department: { select: { name: true } },
      vitals: { orderBy: { recordedAt: 'desc' }, take: 1 },
      prescriptions: {
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  const timeline = visits.map((v) => ({
    visitId: v.id,
    date: v.createdAt,
    chiefComplaint: v.clinicalHistory?.chiefComplaint || v.reasonForVisit || 'OPD Visit',
    department: v.department?.name || 'General',
    status: v.status,
    priority: v.priority,
    completionScore: v.clinicalHistory?.completionScore || 0,
    vitals: v.vitals?.[0] || null,
    lastPrescription: v.prescriptions?.[0]?.items?.map((i: any) => i.medicineName).join(', ') || null,
  }));

  res.json({ timeline, count: timeline.length });
});

export default router;
