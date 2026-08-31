import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
  console.log('--- TEST 1: VERIFYING RETURNING PATIENT FOLLOW-UP & COMPLETION ---');
  const patient = await prisma.patient.findFirst({
    where: { visits: { some: {} } },
    include: { visits: { orderBy: { createdAt: 'desc' } } }
  });

  const doc = await prisma.doctorProfile.findFirst({ include: { department: true } });
  
  // Create a new follow-up visit for this patient
  const followUpVisit = await prisma.visit.create({
    data: {
      patient: { connect: { id: patient.id } },
      doctor: { connect: { id: doc.id } },
      department: doc.departmentId ? { connect: { id: doc.departmentId } } : undefined,
      token: 'T-FU-TEST',
      reasonForVisit: 'Follow-up for chest discomfort',
      status: 'INTAKE_IN_PROGRESS'
    }
  });

  // Start intake session
  const startRes = await fetch('http://127.0.0.1:5000/api/conversation/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      visitId: followUpVisit.id,
      language: 'EN',
      targetComplaint: 'Chest discomfort follow-up',
      isNewCase: false,
    })
  }).then(r => r.json());

  console.log('Follow-up Intake Started:');
  console.log('Session ID:', startRes.session?.id);
  console.log('Question 1:', startRes.nextQuestion);
  console.log('Touch Options:', startRes.touchOptions);

  // Send follow-up answer: "Symptoms are much better with the medicines"
  const msg1 = await fetch(`http://127.0.0.1:5000/api/conversation/${startRes.session.id}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: 'Symptoms are much better after the medication', language: 'EN' })
  }).then(r => r.json());

  console.log('\nAI Follow-up Response 2:');
  console.log('Next Question:', msg1.nextQuestion);
  console.log('Touch Options:', msg1.touchOptions);

  // Complete intake
  const completeMsg = await fetch(`http://127.0.0.1:5000/api/conversation/${startRes.session.id}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: 'No, that covers all symptoms — complete intake', language: 'EN' })
  }).then(r => r.json());

  console.log('\nFinal AI Closing Response:');
  console.log('Is Complete:', completeMsg.isComplete);
  console.log('Closing Question:', completeMsg.nextQuestion);
  console.log('Closing Options:', completeMsg.touchOptions);

  console.log('\n--- TEST 2: VERIFYING PATIENT LONGITUDINAL TIMELINE ---');
  // Login as demo doctor to get token
  const authRes = await fetch('http://127.0.0.1:5000/api/auth/demo-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'DOCTOR' })
  }).then(r => r.json());

  const tlRes = await fetch(`http://127.0.0.1:5000/api/doctor/timeline/${patient.id}`, {
    headers: { 'Authorization': `Bearer ${authRes.token}` }
  }).then(r => r.json());
  console.log('Total Encounters in Timeline:', tlRes.count);
  console.log('Encounters:', tlRes.timeline?.map(t => ({ visitId: t.visitId, date: t.date, chiefComplaint: t.chiefComplaint })));

  await prisma.$disconnect();
}

test().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
});
