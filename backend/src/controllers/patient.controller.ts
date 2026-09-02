import { Response } from 'express';
import prisma from '../config/db.js';
import { generateMRN, generateToken } from '../utils/generators.js';
import { createAuditLog } from '../middleware/audit.js';
import { AUDIT_ACTIONS } from '../config/constants.js';
import type { AuthRequest } from '../middleware/auth.js';
import type { RegisterPatientInput, PatientLookupInput } from '../validators/patient.schema.js';

export async function registerPatient(req: AuthRequest, res: Response): Promise<void> {
  const input = req.body as RegisterPatientInput;

  let existing = await prisma.patient.findFirst({
    where: { phone: input.phone },
  });

  if (!existing && input.abhaId) {
    existing = await prisma.patient.findUnique({
      where: { abhaId: input.abhaId },
    });
  }

  let doctor = null;
  if (input.doctorId) {
    doctor = await prisma.doctorProfile.findUnique({
      where: { id: input.doctorId },
      include: { department: true, user: true },
    });
  }

  let department = null;
  if (doctor?.department) {
    department = doctor.department;
  } else if (input.departmentId || (input as any).departmentCode || (input as any).department) {
    const query = String(input.departmentId || (input as any).departmentCode || (input as any).department).trim();
    department = await prisma.department.findFirst({
      where: {
        OR: [
          { id: query },
          { code: query },
          { code: query.toUpperCase() },
          { name: { contains: query } },
        ],
      },
      select: { id: true, code: true, name: true },
    });
  }

  if (!department) {
    // Try to find a department with code 'GEN' (General) as default
    department = await prisma.department.findFirst({ where: { code: 'GEN' } });
    // If not found, fall back to any department (but warn in logs)
    if (!department) {
      department = await prisma.department.findFirst();
      console.warn('No department with code GEN found. Using arbitrary department as default.');
    }
    // If still no department, the code below will try to create one under a hospital
  }

  if (!department) {
    const hospital = await prisma.hospital.findFirst();
    if (hospital) {
      department = await prisma.department.create({
        data: {
          hospitalId: hospital.id,
          code: 'GEN',
          name: 'General Medicine',
          description: 'General OPD',
        },
        select: { id: true, code: true, name: true },
      });
    }
  }

  if (!department) {
    res.status(400).json({ error: 'Hospital department database is not initialized.' });
    return;
  }

  const parsedAge = input.age !== undefined && input.age !== null && input.age !== '' ? parseInt(String(input.age), 10) : null;
  const preferredLanguage = (input.preferredLang || 'EN').toUpperCase();

  const token = await generateToken(department.code);

  // If patient already exists, check follow-up rules or attach a new Visit
  if (existing) {
    const isFollowUp = Boolean(
      (input.reasonForVisit && /follow-up|followup|पुनः परामर्श|ફોલો-અપ/i.test(input.reasonForVisit)) ||
      (input as any).visitType === 'FOLLOW_UP'
    );

    // If follow-up is requested for the same doctor, ensure previous consultation is COMPLETED
    if (isFollowUp && doctor?.id) {
      const activeIncompleteVisit = await prisma.visit.findFirst({
        where: {
          patientId: existing.id,
          doctorId: doctor.id,
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
        include: {
          doctor: { include: { user: { select: { name: true } } } },
        },
      });

      if (activeIncompleteVisit) {
        const docName = activeIncompleteVisit.doctor?.user?.name ? `Dr. ${activeIncompleteVisit.doctor.user.name}` : 'the assigned doctor';
        res.status(400).json({
          error: `Cannot book follow-up with ${docName}. Your previous consultation (Token: ${activeIncompleteVisit.token || 'Active'}) is still in progress and has not been completed by the doctor yet. You can book a brand new consultation instead.`,
          code: 'CONSULTATION_INCOMPLETE',
          activeVisitId: activeIncompleteVisit.id,
          doctorId: doctor.id,
        });
        return;
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const visit = await tx.visit.create({
        data: {
          patientId: existing.id,
          departmentId: department.id,
          doctorId: doctor?.id || null,
          token,
          reasonForVisit: input.reasonForVisit || 'Follow-up Consultation',
          priority: 'NORMAL',
          status: 'REGISTERED',
          language: input.preferredLang,
        },
      });

      const queueEntry = await tx.queueEntry.create({
        data: {
          visitId: visit.id,
          patientId: existing.id,
          departmentId: department.id,
          doctorId: doctor?.id || null,
          tokenNumber: token,
          priority: 'NORMAL',
          status: 'WAITING',
        },
      });

      return { patient: existing, visit, queueEntry };
    });

    await createAuditLog({
      userId: req.user?.id,
      role: req.user?.role,
      action: AUDIT_ACTIONS.REGISTER_PATIENT,
      resourceType: 'PATIENT',
      resourceId: existing.id,
      details: { mrn: existing.mrn, visitId: result.visit.id, department: department.name, isReturning: true, doctorId: doctor?.id },
      ipAddress: req.ip,
    });

    res.status(201).json({
      message: 'Returning patient visit created successfully.',
      isReturning: true,
      patient: {
        id: existing.id,
        mrn: existing.mrn,
        name: existing.name,
        phone: existing.phone,
        age: existing.age,
        gender: existing.gender,
      },
      visit: {
        id: result.visit.id,
        token: result.visit.token,
        status: result.visit.status,
        department: department.name,
        departmentId: department.id,
        reasonForVisit: result.visit.reasonForVisit,
        doctorId: doctor?.id || null,
        doctor: doctor ? {
          id: doctor.id,
          specialization: doctor.specialization,
          user: { name: doctor.user.name, email: doctor.user.email },
        } : null,
      },
      queueEntry: {
        id: result.queueEntry.id,
        tokenNumber: result.queueEntry.tokenNumber,
        status: result.queueEntry.status,
      },
    });
    return;
  }

  const mrn = await generateMRN();

  const result = await prisma.$transaction(async (tx) => {
    const patient = await tx.patient.create({
      data: {
        mrn,
        name: input.name.trim(),
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
        age: parsedAge,
        gender: input.gender || 'MALE',
        phone: input.phone.trim(),
        email: input.email || null,
        address: input.address || null,
        emergencyContact: input.emergencyContact || null,
        preferredLang: preferredLanguage,
        abhaId: input.abhaId || null,
      },
    });

    const visit = await tx.visit.create({
      data: {
        patientId: patient.id,
        departmentId: department.id,
        doctorId: doctor?.id || null,
        token,
        visitType: 'NEW',
        status: 'REGISTERED',
        priority: 'NORMAL',
        reasonForVisit: input.reasonForVisit || null,
        language: input.preferredLang,
      },
    });

    const queueEntry = await tx.queueEntry.create({
      data: {
        visitId: visit.id,
        patientId: patient.id,
        departmentId: department.id,
        doctorId: doctor?.id || null,
        tokenNumber: token,
        priority: 'NORMAL',
        status: 'WAITING',
      },
    });

    // Store optional longitudinal medical history
    if (input.currentMedications && input.currentMedications.trim()) {
      const medList = input.currentMedications.split(/[,;\n]/).map(m => m.trim()).filter(Boolean);
      for (const med of medList) {
        await tx.medication.create({
          data: {
            patientId: patient.id,
            name: med,
            dosage: 'Regular',
            status: 'ACTIVE',
            source: 'PATIENT_REPORTED_REGISTRATION',
          },
        });
      }
    }

    if (input.allergies && input.allergies.trim()) {
      const algList = input.allergies.split(/[,;\n]/).map(a => a.trim()).filter(Boolean);
      for (const alg of algList) {
        await tx.allergy.create({
          data: {
            patientId: patient.id,
            allergen: alg,
            reaction: 'Reported during registration',
            severity: 'MODERATE',
            status: 'ACTIVE',
          },
        });
      }
    }

    if (input.pastMedicalHistory && input.pastMedicalHistory.trim()) {
      await tx.clinicalHistory.create({
        data: {
          visitId: visit.id,
          patientId: patient.id,
          status: 'INITIAL',
          chiefComplaint: input.reasonForVisit || 'OPD Intake',
          pastMedicalHistory: JSON.stringify([input.pastMedicalHistory.trim()]),
          medications: input.currentMedications ? JSON.stringify([{ name: input.currentMedications.trim() }]) : '[]',
          allergies: input.allergies ? JSON.stringify([{ allergen: input.allergies.trim() }]) : '[]',
          completionScore: 30,
        },
      });
    }

    return { patient, visit, queueEntry };
  });

  await createAuditLog({
    userId: req.user?.id,
    role: req.user?.role,
    action: AUDIT_ACTIONS.REGISTER_PATIENT,
    resourceType: 'PATIENT',
    resourceId: result.patient.id,
    details: { mrn, visitId: result.visit.id, department: department.name },
    ipAddress: req.ip,
  });

  res.status(201).json({
    message: 'Patient registered successfully.',
    patient: {
      id: result.patient.id,
      mrn: result.patient.mrn,
      name: result.patient.name,
      phone: result.patient.phone,
      age: result.patient.age,
      gender: result.patient.gender,
    },
    visit: {
      id: result.visit.id,
      token: result.visit.token,
      status: result.visit.status,
      department: department.name,
      departmentId: department.id,
      reasonForVisit: result.visit.reasonForVisit,
      doctorId: doctor?.id || null,
      doctor: doctor ? {
        id: doctor.id,
        specialization: doctor.specialization,
        user: { name: doctor.user.name, email: doctor.user.email },
      } : null,
      patient: {
        id: result.patient.id,
        mrn: result.patient.mrn,
        name: result.patient.name,
        phone: result.patient.phone,
        age: result.patient.age,
        gender: result.patient.gender,
      },
    },
    queueEntry: {
      id: result.queueEntry.id,
      tokenNumber: result.queueEntry.tokenNumber,
      status: result.queueEntry.status,
    },
  });
}

export async function lookupPatient(req: AuthRequest, res: Response): Promise<void> {
  const { query, type } = req.body as PatientLookupInput;

  let patient;

  switch (type) {
    case 'PHONE':
      patient = await prisma.patient.findFirst({
        where: { phone: query },
        include: {
          allergies: { where: { status: 'ACTIVE' } },
          medications: { where: { status: 'ACTIVE' } },
          visits: {
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: {
              department: true,
              summary: true,
              vitals: { orderBy: { recordedAt: 'desc' }, take: 5 },
              doctor: { include: { user: { select: { name: true } } } },
            },
          },
        },
      });
      break;

    case 'MRN':
      patient = await prisma.patient.findUnique({
        where: { mrn: query },
        include: {
          allergies: { where: { status: 'ACTIVE' } },
          medications: { where: { status: 'ACTIVE' } },
          visits: {
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: {
              department: true,
              summary: true,
              vitals: { orderBy: { recordedAt: 'desc' }, take: 5 },
              doctor: { include: { user: { select: { name: true } } } },
            },
          },
        },
      });
      break;

    case 'ABHA':
      patient = await prisma.patient.findUnique({
        where: { abhaId: query },
        include: {
          allergies: { where: { status: 'ACTIVE' } },
          medications: { where: { status: 'ACTIVE' } },
          visits: {
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: {
              department: true,
              summary: true,
              vitals: { orderBy: { recordedAt: 'desc' }, take: 5 },
              doctor: { include: { user: { select: { name: true } } } },
            },
          },
        },
      });
      break;

    default:
      res.status(400).json({ error: 'Invalid lookup type.' });
      return;
  }

  if (!patient) {
    res.status(404).json({ error: 'Patient not found.' });
    return;
  }

  res.json({ patient });
}

export async function getPatient(req: AuthRequest, res: Response): Promise<void> {
  const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];

  const patient = await prisma.patient.findUnique({
    where: { id },
    include: {
      allergies: { where: { status: 'ACTIVE' } },
      medications: { where: { status: 'ACTIVE' } },
      visits: {
        orderBy: { createdAt: 'desc' },
        include: {
          department: true,
          clinicalHistory: true,
          summary: true,
          prescriptions: { include: { items: true } },
          vitals: true,
        },
      },
      documents: true,
      labResults: true,
    },
  });

  if (!patient) {
    res.status(404).json({ error: 'Patient not found.' });
    return;
  }

  res.json({ patient });
}

export async function getMyPatientRecord(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const patient = await prisma.patient.findFirst({
    where: { userId },
    include: {
      allergies: { where: { status: 'ACTIVE' } },
      medications: { where: { status: 'ACTIVE' } },
      visits: {
        orderBy: { createdAt: 'desc' },
        include: {
          department: true,
          clinicalHistory: true,
          summary: true,
          prescriptions: { include: { items: true } },
          vitals: true,
        },
      },
      documents: true,
      labResults: true,
    },
  });

  if (!patient) {
    res.status(404).json({ error: 'Patient record not found' });
    return;
  }

  res.json({ patient });
}

