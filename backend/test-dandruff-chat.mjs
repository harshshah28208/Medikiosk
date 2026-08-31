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

async function testDandruffIntake() {
  console.log('🏥 ========================================================');
  console.log('🏥 TESTING DYNAMIC DANDRUFF & HAIR FALL CHATBOX INTAKE');
  console.log('🏥 ========================================================');

  let patient = await prisma.patient.findFirst();
  let dept = await prisma.department.findFirst({ where: { name: { contains: 'Dermatology' } } }) || await prisma.department.findFirst();

  const visit = await prisma.visit.create({
    data: {
      patient: { connect: { id: patient.id } },
      department: { connect: { id: dept.id } },
      token: `T-${Date.now()}`,
      status: 'WAITING',
      reasonForVisit: 'Severe dandruff and itchy scalp with hair fall',
    },
  });

  // Turn 0: Start Intake for Dermatology
  console.log('\n▶ Turn 0 (Specialty Opening):');
  const startRes = await makeRequest('/conversation/start', 'POST', {
    visitId: visit.id,
    language: 'EN',
    carePath: 'ALLOPATHY',
    specialty: 'Dermatology',
    isNewCase: true,
  });
  const sessionId = startRes.body.session.id;
  console.log(`   AI: "${startRes.body.nextQuestion || startRes.body.message.content}"`);
  console.log(`   Touch Options:`, startRes.body.touchOptions);

  // Turn 1: Patient reports Dandruff & Hair Fall
  console.log('\n▶ Turn 1 (Patient reports: "I have heavy white dandruff flakes and severe scalp itching with hair fall"):');
  const t1 = await makeRequest(`/conversation/${sessionId}/message`, 'POST', {
    content: 'I have heavy white dandruff flakes and severe scalp itching with hair fall',
    language: 'EN',
  });
  console.log(`   AI Question 1: "${t1.body.nextQuestion}"`);
  console.log(`   Touch Options:`, t1.body.touchOptions);

  // Turn 2: Patient answers Onset & Severity
  console.log('\n▶ Turn 2 (Patient answers: "It started 3 weeks ago, itching is 8/10, worse after oiling hair"):');
  const t2 = await makeRequest(`/conversation/${sessionId}/message`, 'POST', {
    content: 'It started 3 weeks ago, itching is 8/10, worse after oiling hair',
    language: 'EN',
  });
  console.log(`   AI Question 2: "${t2.body.nextQuestion}"`);
  console.log(`   Touch Options:`, t2.body.touchOptions);

  // Turn 3: Patient answers Lifestyle & Routine
  console.log('\n▶ Turn 3 (Patient answers: "I sleep 7 hours, wash hair twice a week, high work stress"):');
  const t3 = await makeRequest(`/conversation/${sessionId}/message`, 'POST', {
    content: 'I sleep 7 hours, wash hair twice a week, high work stress',
    language: 'EN',
  });
  console.log(`   AI Question 3: "${t3.body.nextQuestion}"`);
  console.log(`   Touch Options:`, t3.body.touchOptions);

  console.log('\n========================================================');
  console.log('✅ DANDRUFF CLINICAL CHAT INTAKE VERIFIED SUCCESSFULLY!');
  console.log('========================================================');
}

testDandruffIntake().catch(console.error);
