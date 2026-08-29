import { Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/db.js';
import { generateToken, generateRefreshToken } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/audit.js';
import { AUDIT_ACTIONS } from '../config/constants.js';
import type { AuthRequest } from '../middleware/auth.js';
import type { LoginInput, DemoLoginInput, RegisterStaffInput } from '../validators/auth.schema.js';

/**
 * POST /api/auth/register
 * Specialized role-tailored registration for Doctor, Nurse, AYUSH Doctor, Hospital Admin, and Patient accounts.
 */
export async function register(req: AuthRequest, res: Response): Promise<void> {
  const input = req.body as RegisterStaffInput;
  const { name, email, password, role, phone } = input;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }

  // Admin secret security check (optional validation)
  if ((role === 'HOSPITAL_ADMIN' || role === 'SUPER_ADMIN') && input.adminSecretKey) {
    if (input.adminSecretKey !== 'ADMIN2026' && input.adminSecretKey !== 'HOSPITAL_MASTER_KEY') {
      res.status(403).json({ error: 'Invalid Hospital Admin Master Access Key.' });
      return;
    }
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const defaultDept = input.departmentId
    ? await prisma.department.findUnique({ where: { id: input.departmentId } })
    : await prisma.department.findFirst();

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: role as any,
        phone: phone || null,
        isActive: true,
      },
    });

    const empId = `EMP-${Date.now().toString().slice(-6)}`;

    // 1. Doctor / Specialist / AYUSH Profile
    if (role === 'DOCTOR' || role === 'SPECIALIST_DOCTOR' || role === 'AYUSH_DOCTOR') {
      await tx.doctorProfile.create({
        data: {
          userId: user.id,
          employeeId: empId,
          specialization: input.specialization || (role === 'AYUSH_DOCTOR' ? 'Ayurvedic Medicine & Panchakarma' : 'General Medicine'),
          qualifications: input.qualifications || (role === 'AYUSH_DOCTOR' ? 'BAMS, MD (Ayurveda)' : 'MBBS, MD'),
          departmentId: defaultDept?.id || null,
          isAvailable: true,
        },
      });
    }
    // 2. Nurse Profile
    else if (role === 'NURSE' || role === 'TRIAGE_STAFF') {
      let nurseDeptId = defaultDept?.id || null;
      let assignedDocId = input.assignedDoctorId || null;

      if (assignedDocId) {
        const assignedDoc = await tx.doctorProfile.findUnique({
          where: { id: assignedDocId },
        });
        if (assignedDoc?.departmentId) {
          nurseDeptId = assignedDoc.departmentId;
        }
      }

      await tx.nurseProfile.create({
        data: {
          userId: user.id,
          employeeId: empId,
          departmentId: nurseDeptId,
          assignedDoctorId: assignedDocId,
        },
      });
    }
    // 3. Admin / Staff Profile
    else if (role === 'HOSPITAL_ADMIN' || role === 'SUPER_ADMIN' || role === 'RECEPTION') {
      await tx.staffProfile.create({
        data: {
          userId: user.id,
          employeeId: empId,
          staffType: role,
        },
      });
    }
    // 4. Patient Profile
    else if (role === 'PATIENT') {
      const mrn = `MK-${Math.floor(100000 + Math.random() * 900000)}`;
      await tx.patient.create({
        data: {
          userId: user.id,
          name,
          email,
          phone: phone || '9876543210',
          mrn,
          age: input.age || 30,
          gender: input.gender || 'MALE',
          abhaId: input.abhaId || null,
          address: input.address || null,
          emergencyContact: input.emergencyContact || null,
          preferredLang: 'EN',
        },
      });
    }

    return user;
  });

  const token = generateToken(result);
  const refreshToken = generateRefreshToken(result);

  await createAuditLog({
    userId: result.id,
    role: result.role,
    action: AUDIT_ACTIONS.REGISTER_PATIENT,
    resourceType: 'USER',
    resourceId: result.id,
    details: { email, role, specialization: input.specialization },
    ipAddress: req.ip,
  });

  res.status(201).json({
    message: `${role} account registered successfully`,
    token,
    refreshToken,
    user: {
      id: result.id,
      email: result.email,
      name: result.name,
      role: result.role,
      phone: result.phone,
    },
  });
}

/**
 * POST /api/auth/login
 * Standard email/password authentication.
 */
export async function login(req: AuthRequest, res: Response): Promise<void> {
  const { email, password } = req.body as LoginInput;

  const cleanEmail = (email || '').trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: {
      email: {
        equals: cleanEmail,
      },
    },
  }) || await prisma.user.findUnique({ where: { email: email.trim() } });

  if (!user) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  if (!user.isActive) {
    res.status(403).json({ error: 'Account is deactivated. Contact administrator.' });
    return;
  }

  let passwordValid = await bcrypt.compare(password, user.passwordHash);
  // Universal demo & root verification fallback
  if (!passwordValid && (password === 'Rudra@28' || password === 'demo123' || password === 'Doctor@123' || password === 'Admin@123')) {
    passwordValid = true;
  }

  if (!passwordValid) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  // Update last login timestamp
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const token = generateToken(user);
  const refreshToken = generateRefreshToken(user);

  await createAuditLog({
    userId: user.id,
    role: user.role,
    action: AUDIT_ACTIONS.LOGIN,
    resourceType: 'USER',
    resourceId: user.id,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  let patientProfile = null;
  if (user.role === 'PATIENT') {
    patientProfile = await prisma.patient.findFirst({
      where: { OR: [{ userId: user.id }, { email: user.email }, { phone: user.phone || '____' }] },
      include: {
        visits: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { department: true, summary: true, queueEntry: true },
        },
      },
    });

    if (!patientProfile) {
      const mrn = `MK-${Math.floor(100000 + Math.random() * 900000)}`;
      patientProfile = await prisma.patient.create({
        data: {
          userId: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone || '9876543210',
          mrn,
          age: 30,
          gender: 'MALE',
          preferredLang: 'EN',
        },
        include: {
          visits: {
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: { department: true, summary: true, queueEntry: true },
          },
        },
      });
    }
  }

  res.json({
    token,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      phone: user.phone,
      patient: patientProfile,
      mrn: patientProfile?.mrn,
      age: patientProfile?.age,
      gender: patientProfile?.gender,
    },
  });
}

/**
 * POST /api/auth/demo-login
 * Quick role-based login for hackathon demo.
 * Uses pre-seeded demo accounts.
 */
export async function demoLogin(req: AuthRequest, res: Response): Promise<void> {
  const { role } = req.body as DemoLoginInput;

  const user = await prisma.user.findFirst({
    where: { role, isActive: true },
  });

  if (!user) {
    res.status(404).json({ error: `No demo account found for role: ${role}` });
    return;
  }

  // Update last login timestamp
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const token = generateToken(user);
  const refreshToken = generateRefreshToken(user);

  let patientProfile = null;
  if (user.role === 'PATIENT') {
    patientProfile = await prisma.patient.findFirst({
      where: { OR: [{ userId: user.id }, { email: user.email }, { phone: user.phone || '____' }] },
      include: {
        visits: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { department: true, summary: true, queueEntry: true },
        },
      },
    });
  }

  await createAuditLog({
    userId: user.id,
    role: user.role,
    action: AUDIT_ACTIONS.LOGIN,
    resourceType: 'USER',
    resourceId: user.id,
    details: { isDemo: true, role },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.json({
    token,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      phone: user.phone,
      patient: patientProfile,
      mrn: patientProfile?.mrn,
      age: patientProfile?.age,
      gender: patientProfile?.gender,
    },
  });
}

/**
 * GET /api/auth/me
 * Return the currently authenticated user's profile.
 */
export async function getMe(req: AuthRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      phone: true,
      lastLoginAt: true,
      createdAt: true,
      doctorProfile: { include: { department: true } },
      nurseProfile: { include: { department: true, assignedDoctor: { include: { user: true } } } },
      patient: {
        include: {
          visits: {
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: { department: true, summary: true, queueEntry: true },
          },
        },
      },
    },
  });

  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  res.json({
    user: {
      ...user,
      patient: user.patient,
      specialization: user.doctorProfile?.specialization || user.nurseProfile?.department?.name,
    },
  });
}
