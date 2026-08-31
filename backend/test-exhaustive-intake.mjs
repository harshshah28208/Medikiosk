import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = 'http://127.0.0.1:5000/api';

async function runExhaustiveTest() {
  console.log('🏥 ========================================================');
  console.log('🏥 TESTING EXHAUSTIVE 8-STAGE CLINICAL INTAKE (NO RUSHING)');
  console.log('🏥 ========================================================\n');

  // 1. Create Patient & Visit
  const testPatient = await prisma.patient.upsert({
    where: { mrn: 'MRN-THOROUGH-TEST' },
    update: { name: 'Thorough Intake Patient' },
    create: {
      mrn: 'MRN-THOROUGH-TEST',
      name: 'Thorough Intake Patient',
      phone: '9898980001',
      age: 38,
      gender: 'Male',
    },
  });

  let dept = await prisma.department.findFirst({ where: { name: { contains: 'General' } } });
  if (!dept) dept = await prisma.department.findFirst();

  const tokenVal = 'T-' + Math.floor(100 + Math.random() * 900);
  const testVisit = await prisma.visit.create({
    data: {
      patient: { connect: { id: testPatient.id } },
      department: { connect: { id: dept.id } },
      token: tokenVal,
      status: 'INTAKE_IN_PROGRESS',
    },
  });

  // 2. Start Intake
  const startRes = await fetch(`${BASE_URL}/conversation/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      visitId: testVisit.id,
      language: 'EN',
      carePath: 'ALLOPATHY',
      specialty: 'General Medicine',
    }),
  });
  const startData = await startRes.json();
  console.log(`▶ Turn 0 (Initial Opening):`);
  console.log(`   AI Question: "${startData.nextQuestion || startData.aiMessage?.content}"`);
  console.log(`   Touch Options:`, startData.touchOptions);
  console.log(`   Session ID: ${startData.session?.id}\n`);

  const answers = [
    { text: 'I have severe acid reflux, burning chest sensation, and stomach cramps', label: 'Turn 1: Chief Complaint Exploration' },
    { text: 'It started 2 weeks ago and has been gradually getting worse every day', label: 'Turn 2: Onset & Duration' },
    { text: 'Pain is 7/10 sharp burning heat radiating up to my throat and behind breastbone', label: 'Turn 3: Sensation, Character & Severity' },
    { text: 'I also have nausea, sour watery belching, and occasional throat clearing but no fever', label: 'Turn 4: Associated Symptoms' },
    { text: 'Worse after eating spicy curries and lying down at night; cold milk gives mild temporary relief', label: 'Turn 5: Triggers & Relieving Factors' },
    { text: 'I sleep barely 4-5 hours due to high work stress and drink 4 cups of tea daily', label: 'Turn 6: Lifestyle, Sleep & Diet' },
    { text: 'I have mild High Blood Pressure (BP) for 2 years, no diabetes, father had acid peptic ulcers', label: 'Turn 7: Past Medical History & Family' },
    { text: 'I take Telmisartan 40mg daily and antacids as needed, allergic to Penicillin', label: 'Turn 8: Prescription Meds & Allergies' },
  ];

  let currentSessionId = startData.session?.id;

  for (let i = 0; i < answers.length; i++) {
    const a = answers[i];
    console.log(`▶ [${a.label}] Patient sends: "${a.text}"`);

    const msgRes = await fetch(`${BASE_URL}/conversation/${currentSessionId}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: a.text,
        language: 'EN',
      }),
    });
    const msgData = await msgRes.json();
    console.log(`   AI Response: "${msgData.aiMessage?.content || msgData.nextQuestion}"`);
    console.log(`   Touch Options:`, msgData.touchOptions);
    console.log(`   isComplete: ${msgData.isComplete}`);
    console.log(`   Turns Completed: ${msgData.clinicalState?.turnsCompleted}\n`);

    if (i < 7) {
      if (msgData.isComplete) {
        throw new Error(` premature isComplete at Turn ${i + 1}! It should take all details.`);
      }
    }
  }

  console.log('========================================================');
  console.log('✅ EXHAUSTIVE 8-STAGE CLINICAL INTAKE FULLY VERIFIED!');
  console.log('========================================================');
  await prisma.$disconnect();
}

runExhaustiveTest().catch(async (e) => {
  console.error('❌ Test failed:', e);
  await prisma.$disconnect();
  process.exit(1);
});
