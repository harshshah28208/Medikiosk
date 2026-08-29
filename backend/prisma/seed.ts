// ============================================
// MediKiosk — Database Seed Script
// Creates demo accounts, departments, patients
// ============================================

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('');
  console.log('🌱 Seeding MediKiosk Database...');
  console.log('');

  const passwordHash = await bcrypt.hash('demo123', 10);

  // ─── 1. Hospital ───────────────────────────
  const hospital = await prisma.hospital.upsert({
    where: { code: 'HOSP-01' },
    update: {},
    create: {
      name: 'MediKiosk Smart Hospital & OPD Center',
      code: 'HOSP-01',
      address: 'Civil Hospital Campus, Ahmedabad, Gujarat 380016',
      phone: '+91-79-2268-0000',
      email: 'admin@medikiosk.health',
    },
  });
  console.log('  ✅ Hospital created');

  // ─── 2. Departments ────────────────────────
  const departmentsData = [
    { code: 'GEN', name: 'General Medicine', description: 'Primary healthcare, systemic evaluations, and general OPD' },
    { code: 'CARD', name: 'Cardiology', description: 'Cardiovascular care, ECG, chest pain triage' },
    { code: 'PED', name: 'Pediatrics', description: 'Child healthcare, growth, and developmental assessments' },
    { code: 'ORTHO', name: 'Orthopedics', description: 'Musculoskeletal care, joint pain, fracture management' },
    { code: 'DERM', name: 'Dermatology', description: 'Skin conditions, allergic evaluations, cosmetic concerns' },
    { code: 'AYUSH', name: 'AYUSH & Integrative Medicine', description: 'Ayurveda, Yoga, Unani, Siddha, Homeopathy' },
    { code: 'ENT', name: 'ENT', description: 'Ear, Nose, and Throat disorders' },
    { code: 'NEURO', name: 'Neurology', description: 'Neurological conditions, headache, seizure disorders' },
  ];

  const deptMap: Record<string, string> = {};
  for (const dept of departmentsData) {
    const d = await prisma.department.upsert({
      where: { code: dept.code },
      update: {},
      create: { ...dept, hospitalId: hospital.id },
    });
    deptMap[dept.code] = d.id;
  }
  console.log(`  ✅ ${departmentsData.length} departments created`);

  // ─── 3. Users (all roles, doctors, and nurses) ───
  const usersData = [
    { email: 'patient@demo.com', name: 'Rahul Sharma', role: 'PATIENT', phone: '9876543210' },
    { email: 'patient2@demo.com', name: 'Meera Patel', role: 'PATIENT', phone: '9876541122' },
    { email: 'reception@demo.com', name: 'Suman Gupta', role: 'RECEPTION', phone: '9876543215' },
    { email: 'triage@demo.com', name: 'Rajesh Kumar', role: 'TRIAGE_STAFF', phone: '9876543214' },
    { email: 'admin@demo.com', name: 'Amit Verma', role: 'HOSPITAL_ADMIN', phone: '9876543216' },
    { email: 'superadmin@demo.com', name: 'System Administrator', role: 'SUPER_ADMIN', phone: '9876543217' },

    // Doctors
    { email: 'doctor@demo.com', name: 'Dr. Yogesh Sharma', role: 'DOCTOR', phone: '9876543211' },
    { email: 'yogesh.sharma@demo.com', name: 'Dr. Yogesh Sharma', role: 'DOCTOR', phone: '9876543211' },
    { email: 'vikram.seth@demo.com', name: 'Dr. Vikram Seth', role: 'DOCTOR', phone: '9876543220' },
    { email: 'rajesh.joshi@demo.com', name: 'Dr. Rajesh Joshi', role: 'DOCTOR', phone: '9876543221' },
    { email: 'vikram.desai@demo.com', name: 'Dr. Vikram Desai', role: 'DOCTOR', phone: '9876543222' },
    { email: 'specialist@demo.com', name: 'Dr. Neha Kapoor', role: 'SPECIALIST_DOCTOR', phone: '9876543218' },
    { email: 'alok.verma@demo.com', name: 'Dr. Alok Verma', role: 'SPECIALIST_DOCTOR', phone: '9876543223' },
    { email: 'ayush@demo.com', name: 'Vaidya Harish Bhatt', role: 'AYUSH_DOCTOR', phone: '9876543212' },
    { email: 'snehal.shah@demo.com', name: 'Dr. Snehal Shah', role: 'AYUSH_DOCTOR', phone: '9876543224' },

    // Nurses
    { email: 'nurse@demo.com', name: 'Preeti Patel (Nurse)', role: 'NURSE', phone: '9876543213' },
    { email: 'preeti.patel@demo.com', name: 'Preeti Patel (Nurse)', role: 'NURSE', phone: '9876543213' },
    { email: 'priya.singh@demo.com', name: 'Priya Singh (Nurse)', role: 'NURSE', phone: '9876543230' },
    { email: 'sneha.desai@demo.com', name: 'Sneha Desai (Nurse)', role: 'NURSE', phone: '9876543231' },
    { email: 'ritu.nair@demo.com', name: 'Ritu Nair (Nurse)', role: 'NURSE', phone: '9876543232' },
    { email: 'sunita.yadav@demo.com', name: 'Sunita Yadav (Nurse)', role: 'NURSE', phone: '9876543233' },
    { email: 'kavita.verma@demo.com', name: 'Kavita Verma (Nurse)', role: 'NURSE', phone: '9876543234' },
    { email: 'meena.rathod@demo.com', name: 'Meena Rathod (Nurse)', role: 'NURSE', phone: '9876543235' },
  ];

  const userMap: Record<string, any> = {};
  for (const u of usersData) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { role: u.role, name: u.name },
      create: {
        email: u.email,
        name: u.name,
        passwordHash,
        role: u.role,
        phone: u.phone,
      },
    });
    userMap[u.email] = user;
  }
  console.log(`  ✅ ${usersData.length} users created (password: demo123)`);

  // ─── 4. Staff Profiles ─────────────────────
  // Dr. Yogesh Sharma (Cardiology) & Nurse Preeti Patel
  await prisma.doctorProfile.upsert({
    where: { userId: userMap['doctor@demo.com'].id },
    update: { specialization: 'Cardiology', qualifications: 'MBBS, MD (Cardiology)', departmentId: deptMap['CARD'] },
    create: {
      userId: userMap['doctor@demo.com'].id,
      employeeId: 'DOC-YOGESH-101',
      specialization: 'Cardiology',
      qualifications: 'MBBS, MD (Cardiology)',
      departmentId: deptMap['CARD'],
      isAvailable: true,
    },
  });

  await prisma.nurseProfile.upsert({
    where: { userId: userMap['nurse@demo.com'].id },
    update: { departmentId: deptMap['CARD'] },
    create: {
      userId: userMap['nurse@demo.com'].id,
      employeeId: 'NURSE-PREETI-101',
      departmentId: deptMap['CARD'],
    },
  });

  // Dr. Vikram Seth (General Medicine) & Nurse Priya Singh
  await prisma.doctorProfile.upsert({
    where: { userId: userMap['vikram.seth@demo.com'].id },
    update: { specialization: 'General Medicine', departmentId: deptMap['GEN'] },
    create: {
      userId: userMap['vikram.seth@demo.com'].id,
      employeeId: 'DOC-VIKRAM-102',
      specialization: 'General Medicine',
      qualifications: 'MBBS, MD (Internal Medicine)',
      departmentId: deptMap['GEN'],
      isAvailable: true,
    },
  });

  await prisma.nurseProfile.upsert({
    where: { userId: userMap['priya.singh@demo.com'].id },
    update: { departmentId: deptMap['GEN'] },
    create: {
      userId: userMap['priya.singh@demo.com'].id,
      employeeId: 'NURSE-PRIYA-102',
      departmentId: deptMap['GEN'],
    },
  });

  // Dr. Rajesh Joshi (Pediatrics) & Nurse Sneha Desai
  await prisma.doctorProfile.upsert({
    where: { userId: userMap['rajesh.joshi@demo.com'].id },
    update: { specialization: 'Pediatrics', departmentId: deptMap['PED'] },
    create: {
      userId: userMap['rajesh.joshi@demo.com'].id,
      employeeId: 'DOC-RAJESH-103',
      specialization: 'Pediatrics',
      qualifications: 'MBBS, DCH, MD (Pediatrics)',
      departmentId: deptMap['PED'],
      isAvailable: true,
    },
  });

  await prisma.nurseProfile.upsert({
    where: { userId: userMap['sneha.desai@demo.com'].id },
    update: { departmentId: deptMap['PED'] },
    create: {
      userId: userMap['sneha.desai@demo.com'].id,
      employeeId: 'NURSE-SNEHA-103',
      departmentId: deptMap['PED'],
    },
  });

  // Dr. Vikram Desai (Orthopedics) & Nurse Ritu Nair
  await prisma.doctorProfile.upsert({
    where: { userId: userMap['vikram.desai@demo.com'].id },
    update: { specialization: 'Orthopedics & Joint Care', departmentId: deptMap['ORTHO'] },
    create: {
      userId: userMap['vikram.desai@demo.com'].id,
      employeeId: 'DOC-DESAI-104',
      specialization: 'Orthopedics & Joint Care',
      qualifications: 'MBBS, MS (Orthopedics)',
      departmentId: deptMap['ORTHO'],
      isAvailable: true,
    },
  });

  await prisma.nurseProfile.upsert({
    where: { userId: userMap['ritu.nair@demo.com'].id },
    update: { departmentId: deptMap['ORTHO'] },
    create: {
      userId: userMap['ritu.nair@demo.com'].id,
      employeeId: 'NURSE-RITU-104',
      departmentId: deptMap['ORTHO'],
    },
  });

  // Dr. Neha Kapoor (Dermatology) & Nurse Sunita Yadav
  await prisma.doctorProfile.upsert({
    where: { userId: userMap['specialist@demo.com'].id },
    update: { specialization: 'Dermatology & Cosmetology', departmentId: deptMap['DERM'] },
    create: {
      userId: userMap['specialist@demo.com'].id,
      employeeId: 'DOC-NEHA-105',
      specialization: 'Dermatology & Cosmetology',
      qualifications: 'MBBS, MD (Dermatology)',
      departmentId: deptMap['DERM'],
      isAvailable: true,
    },
  });

  await prisma.nurseProfile.upsert({
    where: { userId: userMap['sunita.yadav@demo.com'].id },
    update: { departmentId: deptMap['DERM'] },
    create: {
      userId: userMap['sunita.yadav@demo.com'].id,
      employeeId: 'NURSE-SUNITA-105',
      departmentId: deptMap['DERM'],
    },
  });

  // Dr. Alok Verma (ENT) & Nurse Anjali Gupta
  await prisma.doctorProfile.upsert({
    where: { userId: userMap['alok.verma@demo.com'].id },
    update: { specialization: 'ENT & Head-Neck Surgery', departmentId: deptMap['ENT'] },
    create: {
      userId: userMap['alok.verma@demo.com'].id,
      employeeId: 'DOC-ALOK-106',
      specialization: 'ENT & Head-Neck Surgery',
      qualifications: 'MBBS, MS (ENT)',
      departmentId: deptMap['ENT'],
      isAvailable: true,
    },
  });

  // Vaidya Harish Bhatt (Ayurveda) & Nurse Kavita Verma
  await prisma.doctorProfile.upsert({
    where: { userId: userMap['ayush@demo.com'].id },
    update: { specialization: 'Ayurveda & Panchakarma', departmentId: deptMap['AYUSH'] },
    create: {
      userId: userMap['ayush@demo.com'].id,
      employeeId: 'DOC-HARISH-201',
      specialization: 'Ayurveda & Panchakarma',
      qualifications: 'BAMS, MD (Ayurveda)',
      departmentId: deptMap['AYUSH'],
      isAvailable: true,
    },
  });

  await prisma.nurseProfile.upsert({
    where: { userId: userMap['kavita.verma@demo.com'].id },
    update: { departmentId: deptMap['AYUSH'] },
    create: {
      userId: userMap['kavita.verma@demo.com'].id,
      employeeId: 'NURSE-KAVITA-201',
      departmentId: deptMap['AYUSH'],
    },
  });

  // Dr. Snehal Shah (Classical Homeopathy) & Nurse Meena Rathod
  await prisma.doctorProfile.upsert({
    where: { userId: userMap['snehal.shah@demo.com'].id },
    update: { specialization: 'Classical Homeopathy & Repertory', departmentId: deptMap['AYUSH'] },
    create: {
      userId: userMap['snehal.shah@demo.com'].id,
      employeeId: 'DOC-SNEHAL-202',
      specialization: 'Classical Homeopathy & Repertory',
      qualifications: 'BHMS, MD (Homeopathy)',
      departmentId: deptMap['AYUSH'],
      isAvailable: true,
    },
  });

  await prisma.nurseProfile.upsert({
    where: { userId: userMap['meena.rathod@demo.com'].id },
    update: { departmentId: deptMap['AYUSH'] },
    create: {
      userId: userMap['meena.rathod@demo.com'].id,
      employeeId: 'NURSE-MEENA-202',
      departmentId: deptMap['AYUSH'],
    },
  });


  await prisma.staffProfile.upsert({
    where: { userId: userMap['reception@demo.com'].id },
    update: {},
    create: {
      userId: userMap['reception@demo.com'].id,
      employeeId: 'STF-401',
      staffType: 'RECEPTION',
    },
  });

  await prisma.staffProfile.upsert({
    where: { userId: userMap['triage@demo.com'].id },
    update: {},
    create: {
      userId: userMap['triage@demo.com'].id,
      employeeId: 'STF-402',
      staffType: 'TRIAGE',
    },
  });

  console.log('  ✅ Staff profiles and Doctor-Nurse pairings created');

  // ─── 5. Demo Patients ──────────────────────
  const patient1 = await prisma.patient.upsert({
    where: { mrn: 'MK-0001' },
    update: {},
    create: {
      userId: userMap['patient@demo.com'].id,
      mrn: 'MK-0001',
      name: 'Rahul Sharma',
      age: 45,
      dateOfBirth: new Date('1981-05-14'),
      gender: 'MALE',
      phone: '9876543210',
      email: 'patient@demo.com',
      address: 'B-14 Green Park, New Delhi',
      emergencyContact: '+91-9811223344',
      preferredLang: 'HI',
      abhaId: '91-8844-3311-2299',
    },
  });

  const patient2 = await prisma.patient.upsert({
    where: { mrn: 'MK-0002' },
    update: {},
    create: {
      userId: userMap['patient2@demo.com'].id,
      mrn: 'MK-0002',
      name: 'Meera Patel',
      age: 31,
      dateOfBirth: new Date('1995-09-22'),
      gender: 'FEMALE',
      phone: '9876541122',
      email: 'meera.p@example.com',
      address: 'Navrangpura, Ahmedabad',
      emergencyContact: '+91-9822334455',
      preferredLang: 'GU',
      abhaId: '91-7711-2233-4455',
    },
  });

  console.log('  ✅ Demo patients created');

  // ─── 6. Seed Demo Visits & Queue Entries ───
  const visit1 = await prisma.visit.create({
    data: {
      patientId: patient1.id,
      departmentId: deptMap['CARD'],
      token: 'C-101',
      visitType: 'NEW',
      status: 'IN_INTAKE',
      priority: 'NORMAL',
      reasonForVisit: 'Chest discomfort on exertion and breathlessness',
      language: 'HI',
    },
  });

  await prisma.queueEntry.create({
    data: {
      visitId: visit1.id,
      patientId: patient1.id,
      departmentId: deptMap['CARD'],
      tokenNumber: 'C-101',
      priority: 'NORMAL',
      status: 'WAITING',
    },
  });

  const visit2 = await prisma.visit.create({
    data: {
      patientId: patient2.id,
      departmentId: deptMap['AYUSH'],
      token: 'A-102',
      visitType: 'NEW',
      status: 'REGISTERED',
      priority: 'NORMAL',
      reasonForVisit: 'Chronic digestive heaviness & acidity',
      language: 'GU',
    },
  });

  await prisma.queueEntry.create({
    data: {
      visitId: visit2.id,
      patientId: patient2.id,
      departmentId: deptMap['AYUSH'],
      tokenNumber: 'A-102',
      priority: 'NORMAL',
      status: 'WAITING',
    },
  });

  console.log('  ✅ Active OPD Visits & Queue Entries created');

  // ─── 7. Seed Audit Logs ────────────────────
  await prisma.auditLog.create({
    data: {
      role: 'SUPER_ADMIN',
      action: 'SYSTEM_SEED',
      resourceType: 'HOSPITAL',
      resourceId: hospital.id,
      details: JSON.stringify({ description: 'Database seeded with demo users and active OPD visits' }),
    },
  });

  console.log('  ✅ Audit log seeded');

  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('  ✅ MediKiosk Database Seeding Complete!');
  console.log('═══════════════════════════════════════════════');
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
