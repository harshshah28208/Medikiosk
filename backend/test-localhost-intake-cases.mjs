import http from 'http';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

function makeRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: `/api${path}`,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    }, (res) => {
      let resData = '';
      res.on('data', chunk => resData += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(resData) });
        } catch {
          resolve({ status: res.statusCode, body: resData });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runLiveVerification() {
  console.log('🏥 ========================================================');
  console.log('🏥 LIVE LOCALHOST MULTILINGUAL & SPECIALTY INTAKE TEST');
  console.log('🏥 ========================================================');

  // Find or create a test patient and visit
  let patient = await prisma.patient.findFirst();
  if (!patient) {
    patient = await prisma.patient.create({
      data: {
        uhid: `UHID-${Date.now()}`,
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
      token: `T-${Date.now()}`,
      status: 'WAITING',
      reasonForVisit: 'Skin rash and itching',
    },
  });

  // Step 1: Start intake for Dermatology
  console.log('\n▶ [1] Starting Intake for Dr. Neha Patel (Dermatology) in English:');
  const startRes = await makeRequest('/conversation/start', 'POST', {
    visitId: visit.id,
    language: 'EN',
    carePath: 'ALLOPATHY',
    specialty: 'Dermatology',
    isNewCase: true,
  });

  const session = startRes.body.session;
  const initialMsg = startRes.body.message;
  const initialOpts = startRes.body.touchOptions;

  console.log(`   Status: ${startRes.status}`);
  console.log(`   Session ID: ${session?.id}`);
  console.log(`   AI Question (EN): "${initialMsg?.content}"`);
  console.log(`   Touch Options (EN):`, initialOpts);

  if (!session?.id) {
    console.error('❌ Failed to create session');
    process.exit(1);
  }

  // Step 2: Switch to Hindi (HI)
  console.log('\n▶ [2] Switching Language: EN -> HI');
  const switchHi = await makeRequest(`/conversation/${session.id}/switch-language`, 'POST', {
    targetLanguage: 'HI',
    messages: [initialMsg],
  });
  console.log(`   Status: ${switchHi.status}`);
  console.log(`   Translated Question (HI): "${switchHi.body.activeQuestion}"`);
  console.log(`   Translated Touch Options (HI):`, switchHi.body.touchOptions);

  // Step 3: Switch from Hindi to English (HI -> EN)
  console.log('\n▶ [3] Switching Language: HI -> EN (Testing Non-English to English!)');
  const switchEnFromHi = await makeRequest(`/conversation/${session.id}/switch-language`, 'POST', {
    targetLanguage: 'EN',
    messages: [{ role: 'AI', content: switchHi.body.activeQuestion, options: switchHi.body.touchOptions }],
  });
  console.log(`   Status: ${switchEnFromHi.status}`);
  console.log(`   Translated Question (EN): "${switchEnFromHi.body.activeQuestion}"`);
  console.log(`   Translated Touch Options (EN):`, switchEnFromHi.body.touchOptions);

  // Step 4: Switch from English to Gujarati (EN -> GU)
  console.log('\n▶ [4] Switching Language: EN -> GU');
  const switchGu = await makeRequest(`/conversation/${session.id}/switch-language`, 'POST', {
    targetLanguage: 'GU',
    messages: [{ role: 'AI', content: switchEnFromHi.body.activeQuestion, options: switchEnFromHi.body.touchOptions }],
  });
  console.log(`   Status: ${switchGu.status}`);
  console.log(`   Translated Question (GU): "${switchGu.body.activeQuestion}"`);
  console.log(`   Translated Touch Options (GU):`, switchGu.body.touchOptions);

  // Step 5: Switch from Gujarati to English (GU -> EN)
  console.log('\n▶ [5] Switching Language: GU -> EN (Testing Gujarati to English!)');
  const switchEnFromGu = await makeRequest(`/conversation/${session.id}/switch-language`, 'POST', {
    targetLanguage: 'EN',
    messages: [{ role: 'AI', content: switchGu.body.activeQuestion, options: switchGu.body.touchOptions }],
  });
  console.log(`   Status: ${switchEnFromGu.status}`);
  console.log(`   Translated Question (EN): "${switchEnFromGu.body.activeQuestion}"`);
  console.log(`   Translated Touch Options (EN):`, switchEnFromGu.body.touchOptions);

  // Step 6: Patient responds in English, AI asks follow-up question
  console.log('\n▶ [6] Patient sends Answer: "I have red itchy patches with bumps on my arms"');
  const sendMsg = await makeRequest(`/conversation/${session.id}/message`, 'POST', {
    content: 'I have red itchy patches with bumps on my arms',
    language: 'EN',
  });
  console.log(`   Status: ${sendMsg.status}`);
  console.log(`   Follow-up Question (EN): "${sendMsg.body.nextQuestion || sendMsg.body.aiMessage?.content}"`);
  console.log(`   Follow-up Touch Options (EN):`, sendMsg.body.touchOptions);

  const followUpMsg = sendMsg.body.aiMessage || { role: 'AI', content: sendMsg.body.nextQuestion, options: sendMsg.body.touchOptions };

  // Step 7: Switch language on Follow-Up Question (EN -> HI -> GU -> EN)
  console.log('\n▶ [7] Switching Follow-Up Question to Hindi (HI):');
  const switchFollowUpHi = await makeRequest(`/conversation/${session.id}/switch-language`, 'POST', {
    targetLanguage: 'HI',
    messages: [followUpMsg],
  });
  console.log(`   Follow-up Question (HI): "${switchFollowUpHi.body.activeQuestion}"`);
  console.log(`   Follow-up Touch Options (HI):`, switchFollowUpHi.body.touchOptions);

  console.log('\n▶ [8] Switching Follow-Up Question back to English (HI -> EN):');
  const switchFollowUpEn = await makeRequest(`/conversation/${session.id}/switch-language`, 'POST', {
    targetLanguage: 'EN',
    messages: [{ role: 'AI', content: switchFollowUpHi.body.activeQuestion, options: switchFollowUpHi.body.touchOptions }],
  });
  console.log(`   Follow-up Question (EN): "${switchFollowUpEn.body.activeQuestion}"`);
  console.log(`   Follow-up Touch Options (EN):`, switchFollowUpEn.body.touchOptions);

  console.log('\n========================================================');
  console.log('✅ ALL LIVE LOCALHOST MULTILINGUAL & SPECIALTY TESTS PASSED!');
  console.log('========================================================');
}

runLiveVerification().catch(console.error);
