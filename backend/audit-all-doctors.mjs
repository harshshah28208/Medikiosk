import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = 'http://127.0.0.1:5000/api';

async function auditAllDoctors() {
  console.log('🏥 =================================================================');
  console.log('🏥 AUDITING COMPLETE CLINICAL QUESTIONING FOR ALL REGISTERED DOCTORS');
  console.log('🏥 =================================================================\n');

  const doctors = await prisma.doctorProfile.findMany({
    include: { user: true, department: true },
  });

  console.log(`Found ${doctors.length} doctors in database.\n`);

  let patient = await prisma.patient.findFirst();
  if (!patient) {
    patient = await prisma.patient.create({
      data: {
        mrn: `MRN-AUDIT-${Date.now()}`,
        name: 'Honest Audit Patient',
        phone: '9876500001',
        age: 45,
        gender: 'Female',
      },
    });
  }

  const results = [];

  for (let i = 0; i < doctors.length; i++) {
    const doc = doctors[i];
    const docName = doc.user?.name || doc.name || 'Specialist';
    const specialty = doc.specialization || doc.department?.name || 'General Medicine';
    const carePath = doc.system === 'AYURVEDA' ? 'AYUSH' : doc.system === 'HOMEOPATHY' ? 'HOMEOPATHY' : 'ALLOPATHY';

    console.log(`-----------------------------------------------------------------`);
    console.log(`👨‍⚕️ [${i + 1}/${doctors.length}] Doctor: Dr. ${docName} | Specialty: ${specialty} | CarePath: ${carePath}`);
    console.log(`-----------------------------------------------------------------`);

    // Create visit linked to this doctor
    const visit = await prisma.visit.create({
      data: {
        patient: { connect: { id: patient.id } },
        doctor: { connect: { id: doc.id } },
        department: doc.departmentId ? { connect: { id: doc.departmentId } } : undefined,
        token: `T-AUDIT-${i + 1}`,
        status: 'INTAKE_IN_PROGRESS',
      },
    });

    // Step 1: Start Intake Session
    const startRes = await fetch(`${BASE_URL}/conversation/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitId: visit.id,
        language: 'EN',
        carePath,
        specialty,
        doctorName: docName,
      }),
    });

    if (!startRes.ok) {
      console.error(`❌ FAILED to start intake for Dr. ${docName} (${startRes.status})`);
      results.push({ doctor: docName, specialty, status: 'FAILED_START' });
      continue;
    }

    const startData = await startRes.json();
    const sessionId = startData.session?.id;
    const initialQ = startData.nextQuestion || startData.aiMessage?.content;
    const initialOpts = startData.touchOptions || [];

    console.log(`▶ Turn 0 (Initial Opening):`);
    console.log(`   Question: "${initialQ}"`);
    console.log(`   Touch Options:`, initialOpts);

    // Multi-Turn Clinical Dialogue Answers tailored to this specialty
    const answers = [
      `I have been feeling severe discomfort related to ${specialty} for the past 10 days`,
      `It started gradually 10 days ago and gets noticeably worse every evening`,
      `Severity is 6 out of 10 with sharp aching and throbbing discomfort`,
      `I also feel mild nausea, slight fatigue, and general malaise but no high fever`,
      `It worsens with physical work, spicy meals, and lack of rest; warm water gives temporary relief`,
      `I sleep around 5 hours due to work stress, eat irregular office meals, and have 3 coffees daily`,
      `I have had mild High Blood Pressure for 3 years, no diabetes or prior surgeries`,
      `I take Amlodipine 5mg daily in the morning, and have a known allergy to Sulfa drugs`,
    ];

    let turnsCompleted = 0;
    let prematureCompletion = false;
    let errorsFound = [];

    for (let t = 0; t < answers.length; t++) {
      const patientAns = answers[t];
      const msgRes = await fetch(`${BASE_URL}/conversation/${sessionId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: patientAns,
          language: 'EN',
        }),
      });

      if (!msgRes.ok) {
        errorsFound.push(`Turn ${t + 1} HTTP ${msgRes.status}`);
        break;
      }

      const msgData = await msgRes.json();
      turnsCompleted++;
      const qText = msgData.aiMessage?.content || msgData.nextQuestion;
      const opts = msgData.touchOptions || [];

      console.log(`▶ Turn ${t + 1}:`);
      console.log(`   Patient: "${patientAns.slice(0, 55)}..."`);
      console.log(`   AI Question: "${qText}"`);
      console.log(`   Touch Options:`, opts);
      console.log(`   isComplete: ${msgData.isComplete}`);

      if (t < 6 && msgData.isComplete) {
        prematureCompletion = true;
        errorsFound.push(`Premature isComplete=true at Turn ${t + 1}`);
      }

      if (t === answers.length - 1 && !msgData.isComplete) {
        console.log(`   ℹ️ Note: Exhaustive turn 8 completed.`);
      }
    }

    const testPassed = errorsFound.length === 0;
    console.log(`\nDoctor Audit Summary for Dr. ${docName}: ${testPassed ? '✅ PASSED' : '❌ ISSUES DETECTED: ' + errorsFound.join(', ')}\n`);
    results.push({ doctor: docName, specialty, carePath, turnsCompleted, testPassed, errors: errorsFound });
  }

  console.log('=================================================================');
  console.log('🏥 COMPLETE AUDIT REPORT ACROSS ALL DOCTORS');
  console.log('=================================================================');
  console.table(results);

  await prisma.$disconnect();
}

auditAllDoctors().catch(async (e) => {
  console.error('❌ Audit execution failed:', e);
  await prisma.$disconnect();
  process.exit(1);
});
