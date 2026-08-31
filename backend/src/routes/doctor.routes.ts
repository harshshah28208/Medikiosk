import { Router, Response } from 'express';
import { createHash } from 'crypto';
import prisma from '../config/db.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { requireClinicalRole, requireDoctorRole } from '../middleware/rbac.js';
import { createAuditLog } from '../middleware/audit.js';
import { AUDIT_ACTIONS, SOCKET_EVENTS } from '../config/constants.js';
import type { AuthRequest } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/doctor/roster
 * Public/Kiosk Roster of all doctors grouped with their assigned nurse and room details.
 */
router.get('/roster', optionalAuth, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const doctors = await prisma.doctorProfile.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        department: { select: { id: true, name: true, code: true } },
      },
      orderBy: { employeeId: 'asc' },
    });

    const nurses = await prisma.nurseProfile.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        department: true,
      },
    });

    const roster = doctors.map((doc) => {
      const assignedNurse = nurses.find((n) => n.departmentId === doc.departmentId);

      let system = 'ALLOPATHY';
      if (doc.department?.code === 'AYUSH') {
        if (doc.specialization?.toLowerCase().includes('homeopathy')) {
          system = 'HOMEOPATHY';
        } else {
          system = 'AYURVEDA';
        }
      }

      return {
        id: doc.id,
        userId: doc.userId,
        name: doc.user.name,
        email: doc.user.email,
        specialization: doc.specialization,
        qualifications: doc.qualifications || 'MBBS, MD',
        departmentId: doc.departmentId,
        departmentName: doc.department?.name || 'General Medicine',
        departmentCode: doc.department?.code || 'GEN',
        system,
        isAvailable: doc.isAvailable,
        roomNumber: doc.employeeId === 'DOC-YOGESH-101' ? 'Room 204 (Cardiology)' :
                    doc.employeeId === 'DOC-VIKRAM-102' ? 'Room 101 (General OPD)' :
                    doc.employeeId === 'DOC-RAJESH-103' ? 'Room 105 (Pediatrics)' :
                    doc.employeeId === 'DOC-DESAI-104' ? 'Room 210 (Orthopedics)' :
                    doc.employeeId === 'DOC-NEHA-105' ? 'Room 302 (Dermatology)' :
                    doc.employeeId === 'DOC-ALOK-106' ? 'Room 208 (ENT)' :
                    doc.employeeId === 'DOC-HARISH-201' ? 'Room 103 (Ayurveda OPD)' :
                    doc.employeeId === 'DOC-SNEHAL-202' ? 'Room 104 (Homeopathy OPD)' : 'Room 101',
        opdTimings: '09:00 AM - 02:00 PM',
        assignedNurse: assignedNurse ? {
          id: assignedNurse.id,
          name: assignedNurse.user.name,
          email: assignedNurse.user.email,
        } : null,
      };
    });

    res.json({ doctors: roster });
  } catch (err: any) {
    console.error('Error fetching doctor roster:', err);
    res.status(500).json({ error: 'Failed to fetch doctor roster' });
  }
});

router.use(authenticateToken);

/**
 * GET /api/doctor/patients
 * Get list of today's assigned and waiting patients for doctor dashboard.
 * Doctors see their assigned patients, Nurses see their paired doctor's patients.
 */
router.get('/patients', requireClinicalRole(), async (req: AuthRequest, res: Response): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const user = req.user;
  const showAll = req.query.all === 'true' || user?.role === 'SUPER_ADMIN' || user?.role === 'HOSPITAL_ADMIN';

  let whereClause: any = {};

  if (!showAll && user) {
    if (user.role === 'DOCTOR' || user.role === 'SPECIALIST_DOCTOR' || user.role === 'AYUSH_DOCTOR') {
      const doc = await prisma.doctorProfile.findUnique({ where: { userId: user.id } });
      if (doc) {
        whereClause = {
          OR: [
            { doctorId: doc.id },
            { departmentId: doc.departmentId || undefined },
            { doctorId: null },
          ],
        };
      }
    } else if (user.role === 'NURSE') {
      const nurse = await prisma.nurseProfile.findUnique({ where: { userId: user.id } });
      if (nurse && nurse.departmentId) {
        whereClause = {
          OR: [
            { departmentId: nurse.departmentId },
            { doctorId: nurse.assignedDoctorId || undefined },
            { doctorId: null },
          ],
        };
      }
    }
  }

  const visits = await prisma.visit.findMany({
    where: whereClause,
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
      doctor: {
        select: {
          id: true,
          specialization: true,
          user: { select: { name: true } },
        },
      },
      queueEntry: true,
      vitals: { orderBy: { recordedAt: 'desc' }, take: 1 },
      emergencyAlerts: { where: { status: { not: 'RESOLVED' } } },
      clinicalHistory: { select: { id: true, chiefComplaint: true, status: true, completionScore: true } },
      summary: { select: { id: true, status: true, summaryJson: true } },
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
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

  // Signature Failure Simulation / HSM Hardware Error verification
  if (req.body.forceSignatureError === true || req.headers['x-simulate-signature-failure'] === 'true') {
    res.status(500).json({
      error: 'CRYPTOGRAPHIC_SIGNATURE_FAILED',
      message: 'HSM Cryptographic Key Seal failed to generate digital signature. Encounter remains in active queue and is NOT completed.',
      retryable: true,
    });
    return;
  }

  const doctorProfile = await prisma.doctorProfile.findFirst({
    where: { userId: req.user?.id },
    include: { user: true },
  });

  const docId = doctorProfile?.id || (await prisma.doctorProfile.findFirst())?.id;
  if (!docId) {
    res.status(400).json({ error: 'Doctor profile not found' });
    return;
  }

  const signerName = doctorProfile?.user?.name || req.user?.name || 'Treating Physician';

  const diagnosisStr = Array.isArray(diagnosis)
    ? diagnosis.join(', ')
    : (typeof diagnosis === 'string' ? diagnosis : (impression || ''));

  // Document hash for electronic signature sealing
  const documentHash = createHash('sha256')
    .update(JSON.stringify({ visitId, patientId, docId, diagnosis: diagnosisStr, clinicalNotes, prescriptions }))
    .digest('hex');

  const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || req.ip || '127.0.0.1';

  const result = await prisma.$transaction(async (tx) => {
    // 1. Create / Update Consultation
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

    // 2. Prevent duplicate prescriptions by clearing prior ones for this visit
    await tx.prescriptionItem.deleteMany({
      where: {
        prescription: {
          visitId,
        },
      },
    });
    await tx.prescription.deleteMany({
      where: { visitId },
    });

    // 3. Create fresh Prescription & Items if prescribed
    let prescription = null;
    if (prescriptions && prescriptions.length > 0) {
      prescription = await tx.prescription.create({
        data: {
          visitId,
          patientId,
          doctorId: docId,
          notes: treatmentPlan || null,
          items: {
            create: prescriptions.filter((item: any) => item.medicineName?.trim()).map((item: any) => ({
              medicineName: item.medicineName.trim(),
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

    // 4. Create / Update Digital Signature audit record
    const digitalSignature = await tx.digitalSignature.upsert({
      where: { consultationId: consultation.id },
      update: {
        documentHash,
        signedAt: new Date(),
        signerName,
        ipAddress,
      },
      create: {
        consultationId: consultation.id,
        visitId,
        doctorId: docId,
        signerName,
        signerRole: req.user?.role || 'DOCTOR',
        signatureMethod: 'ELECTRONIC_SYSTEM_STAMP',
        documentHash,
        signedAt: new Date(),
        ipAddress,
      },
    });

    // 5. Complete Visit & Queue
    await tx.visit.update({
      where: { id: visitId },
      data: { status: 'COMPLETED' },
    });

    await tx.queueEntry.updateMany({
      where: { visitId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    return { consultation, prescription, digitalSignature };
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
    details: {
      visitId,
      prescribedCount: prescriptions.length,
      digitalSignatureId: result.digitalSignature.id,
      documentHash: result.digitalSignature.documentHash,
    },
  });

  res.status(201).json({
    message: 'Consultation & prescription digitally signed and saved successfully.',
    consultation: result.consultation,
    prescription: result.prescription,
    digitalSignature: result.digitalSignature,
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
      clinicalHistory: true,
      department: { select: { name: true, code: true } },
      doctor: {
        include: {
          user: { select: { name: true, email: true } },
        },
      },
      consultation: {
        include: {
          doctor: { include: { user: { select: { name: true } } } },
          digitalSignature: true,
        },
      },
      summary: { select: { summaryJson: true, status: true } },
      ayushAssessment: true,
      vitals: { orderBy: { recordedAt: 'desc' }, take: 1 },
      prescriptions: {
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 15,
  });

  const timeline = visits.map((v) => {
    let aiSummaryParsed = null;
    if (v.summary?.summaryJson) {
      try {
        aiSummaryParsed = typeof v.summary.summaryJson === 'string' ? JSON.parse(v.summary.summaryJson) : v.summary.summaryJson;
      } catch {}
    }

    const consult = v.consultation;
    const doctorName = v.doctor?.user?.name || consult?.doctor?.user?.name || (v.department?.name?.includes('AYUSH') ? 'Dr. Snehal Shah' : 'Dr. Yogesh Sharma');
    const doctorSpecialization = v.doctor?.specialization || (v.department?.name?.includes('AYUSH') ? 'Classical Homeopathy & AYUSH' : 'Internal Medicine & Cardiology');

    return {
      visitId: v.id,
      date: v.createdAt,
      chiefComplaint: v.clinicalHistory?.chiefComplaint || v.reasonForVisit || 'General OPD Consultation',
      department: v.department?.name || 'General Medicine',
      departmentCode: v.department?.code || 'GEN',
      status: v.status,
      priority: v.priority,
      completionScore: v.clinicalHistory?.completionScore || 100,
      doctor: {
        name: doctorName,
        specialization: doctorSpecialization,
        diagnosis: consult?.diagnosis || consult?.impression || 'Clinical Assessment Completed',
        clinicalNotes: consult?.clinicalNotes || null,
        treatmentPlan: consult?.treatmentPlan || null,
      },
      digitalSignature: consult?.digitalSignature ? {
        signerName: consult.digitalSignature.signerName,
        signedAt: consult.digitalSignature.signedAt,
        signatureMethod: consult.digitalSignature.signatureMethod,
        documentHash: consult.digitalSignature.documentHash,
      } : null,
      aiSummary: aiSummaryParsed || {
        chiefComplaint: v.clinicalHistory?.chiefComplaint || v.reasonForVisit || 'OPD Intake Completed',
        historyOfPresentIllness: 'Completed multi-turn AI clinical intake at Kiosk.',
        lifestyle: 'Evaluated during intake.',
      },
      vitals: v.vitals?.[0] || null,
      prescriptions: v.prescriptions?.[0]?.items?.map((i: any) => ({
        medicineName: i.medicineName,
        dosage: i.dosage,
        frequency: i.frequency,
        duration: i.duration,
      })) || [],
      lastPrescription: v.prescriptions?.[0]?.items?.map((i: any) => `${i.medicineName} (${i.dosage})`).join(', ') || null,
      ayushAssessment: v.ayushAssessment ? {
        systemType: v.ayushAssessment.homeopathyMiasm ? 'HOMEOPATHY' : 'AYURVEDA',
        miasm: v.ayushAssessment.homeopathyMiasm,
        modalities: v.ayushAssessment.homeopathyModalities,
        repertoryNotes: v.ayushAssessment.homeopathyRepertoryNotes,
      } : null,
    };
  });

  res.json({ timeline, count: timeline.length });
});

export default router;
