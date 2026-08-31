import fetch from 'node-fetch';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5000/api';

async function testMultiTurnIntake() {
  console.log('--- STARTING FULL 5-STAGE CLINICAL INTAKE VERIFICATION ---');

  let patient = await prisma.patient.findFirst();
  if (!patient) {
    patient = await prisma.patient.create({
      data: {
        uhid: `UHID-TEST-${Date.now()}`,
        name: 'Aarav Mehta',
        age: 32,
        gender: 'MALE',
        phone: '9876543210',
      },
    });
  }

  let dept = await prisma.department.findFirst({ where: { name: { contains: 'Dermatology' } } });
  if (!dept) dept = await prisma.department.findFirst();

  const visit = await prisma.visit.create({
    data: {
      patient: { connect: { id: patient.id } },
      department: { connect: { id: dept.id } },
      token: `T-${Date.now().toString().slice(-4)}`,
      status: 'IN_PROGRESS',
      reasonForVisit: 'Scalp itching and dandruff flaking',
    },
  });

  // Step 1: Start Session
  const startRes = await fetch(`${BASE_URL}/conversation/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      visitId: visit.id,
      language: 'EN',
      specialty: 'Dermatology',
      targetComplaint: 'Dandruff and scalp itching',
    }),
  });
  const startData = await startRes.json();
  const sessionId = startData.session?.id || startData.sessionId;
  console.log(`\n[Stage 1: Chief Complaint Initialization] (Session: ${sessionId})`);
  console.log(`Question: ${startData.nextQuestion || startData.message?.content}`);
  console.log(`Touch Options (${startData.touchOptions?.length}):`, startData.touchOptions);

  if (!sessionId) {
    throw new Error('Failed to obtain session ID');
  }

  // Step 2: Answer Onset & Duration
  console.log('\n[Stage 2: Patient answers Onset & Duration]');
  const t1Res = await fetch(`${BASE_URL}/conversation/${sessionId}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: 'I have been having this dandruff and scalp itching for 2 weeks',
      language: 'EN',
      specialty: 'Dermatology',
    }),
  });
  const t1Data = await t1Res.json();
  console.log(`Question: ${t1Data.nextQuestion}`);
  console.log(`Touch Options:`, t1Data.touchOptions);
  console.log(`isComplete: ${t1Data.isComplete}`);

  // Step 3: Answer Severity & Character
  console.log('\n[Stage 3: Patient answers Severity & Character]');
  const t2Res = await fetch(`${BASE_URL}/conversation/${sessionId}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: 'Severity is 6/10, dry white flaking with persistent scalp redness and itchiness',
      language: 'EN',
      specialty: 'Dermatology',
    }),
  });
  const t2Data = await t2Res.json();
  console.log(`Question: ${t2Data.nextQuestion}`);
  console.log(`Touch Options:`, t2Data.touchOptions);
  console.log(`isComplete: ${t2Data.isComplete}`);

  // Step 4: Language Switch Mid-Conversation to Hindi
  console.log('\n[Stage 3.5: Switch Language to HINDI mid-intake]');
  const switchHiRes = await fetch(`${BASE_URL}/conversation/${sessionId}/switch-language`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetLanguage: 'HI' }),
  });
  const switchHiData = await switchHiRes.json();
  console.log(`Hindi Active Question: ${switchHiData.activeQuestion}`);
  console.log(`Hindi Touch Options:`, switchHiData.touchOptions);

  // Step 5: Answer Lifestyle & Routine in Hindi
  console.log('\n[Stage 4: Patient answers Lifestyle & Sleep in Hindi]');
  const t3Res = await fetch(`${BASE_URL}/conversation/${sessionId}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: 'मैं 6-7 घंटे सोता हूँ, संतुलित घर का खाना खाता हूँ और हल्का काम का तनाव है',
      language: 'HI',
      specialty: 'Dermatology',
    }),
  });
  const t3Data = await t3Res.json();
  console.log(`Question: ${t3Data.nextQuestion}`);
  console.log(`Touch Options:`, t3Data.touchOptions);
  console.log(`isComplete: ${t3Data.isComplete}`);

  // Step 6: Language Switch Mid-Conversation to Gujarati
  console.log('\n[Stage 4.5: Switch Language to GUJARATI mid-intake]');
  const switchGuRes = await fetch(`${BASE_URL}/conversation/${sessionId}/switch-language`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetLanguage: 'GU' }),
  });
  const switchGuData = await switchGuRes.json();
  console.log(`Gujarati Active Question: ${switchGuData.activeQuestion}`);
  console.log(`Gujarati Touch Options:`, switchGuData.touchOptions);

  // Step 7: Answer Medical History in Gujarati
  console.log('\n[Stage 5: Patient answers Medical History & Allergies in Gujarati]');
  const t4Res = await fetch(`${BASE_URL}/conversation/${sessionId}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: 'કોઈ જૂની બીમારી (બીપી, ડાયાબિટીસ) નથી, કોઈ નિયમિત દવા નથી અને કોઈ એલર્જી નથી',
      language: 'GU',
      specialty: 'Dermatology',
    }),
  });
  const t4Data = await t4Res.json();
  console.log(`Question: ${t4Data.nextQuestion}`);
  console.log(`Touch Options:`, t4Data.touchOptions);
  console.log(`isComplete: ${t4Data.isComplete}`);

  console.log('\n========================================');
  console.log('SUMMARY OF VERIFICATION:');
  console.log(`Total turns completed: 5 stages`);
  console.log(`Final isComplete state: ${t4Data.isComplete}`);
  console.log(`Final Handoff Options:`, t4Data.touchOptions);
  console.log('========================================');

  await prisma.$disconnect();
}

testMultiTurnIntake().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
