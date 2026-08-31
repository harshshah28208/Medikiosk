import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
  const patient = await prisma.patient.findFirst();
  const doc = await prisma.doctorProfile.findFirst({ include: { department: true } });
  const visit = await prisma.visit.create({
    data: { 
      patient: { connect: { id: patient.id } },
      doctor: { connect: { id: doc.id } },
      department: doc.departmentId ? { connect: { id: doc.departmentId } } : undefined,
      token: 'T-LANG-TEST',
      status: 'INTAKE_IN_PROGRESS' 
    }
  });

  const start = await fetch('http://127.0.0.1:5000/api/conversation/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitId: visit.id, language: 'HI' })
  }).then(r => r.json());
  console.log('1. Started in HI:', start.session?.id, 'Lang:', start.session?.language);
  console.log('   Question:', start.nextQuestion);
  console.log('   Options:', start.touchOptions);

  // Switch to GU
  const swGu = await fetch('http://127.0.0.1:5000/api/conversation/' + start.session.id + '/switch-language', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetLanguage: 'GU', messages: [{ role: 'AI', content: start.nextQuestion, options: start.touchOptions }] })
  }).then(r => r.json());
  console.log('2. Switched to GU:', swGu.language);
  console.log('   Question:', swGu.activeQuestion);
  console.log('   Options:', swGu.touchOptions);

  // Switch back to EN
  const swEn = await fetch('http://127.0.0.1:5000/api/conversation/' + start.session.id + '/switch-language', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetLanguage: 'EN', messages: swGu.translatedMessages })
  }).then(r => r.json());
  console.log('3. Switched back to EN:', swEn.language);
  console.log('   Question:', swEn.activeQuestion);
  console.log('   Options:', swEn.touchOptions);

  // Now send a patient message in EN
  const msgRes = await fetch('http://127.0.0.1:5000/api/conversation/' + start.session.id + '/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: 'I have severe chest discomfort for 3 days', language: 'EN' })
  }).then(r => r.json());
  console.log('4. Sent message in EN after switch:');
  console.log('   Next AI Question:', msgRes.nextQuestion);
  console.log('   Options:', msgRes.touchOptions);

  await prisma.$disconnect();
}

test().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
});
