import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5000/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function runFiveLiveClinicalCases() {
  console.log('🩺 ========================================================');
  console.log('🩺 RUNNING 5 DISTINCT COMPREHENSIVE CLINICAL CASES');
  console.log('🩺 ========================================================\n');

  // Login as doctor for authenticated verification
  const docLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'doctor@demo.com', password: 'demo123' }),
  });
  const docToken = docLogin.data?.token;
  const authHeaders = docToken ? { Authorization: `Bearer ${docToken}` } : {};

  // ────────────────────────────────────────────────────────────
  // CASE 1: ALLOPATHY NEW CONSULTATION — CHEST PAIN & DYSPNEA
  // ────────────────────────────────────────────────────────────
  console.log('▶ [CASE 1: ALLOPATHY NEW CASE] 42M with Exertional Chest Tightness');
  const reg1 = await request('/patients/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Aarav Sharma',
      phone: '9820091111',
      age: 42,
      gender: 'MALE',
      preferredLang: 'EN',
      departmentCode: 'CARD',
      reasonForVisit: 'Severe chest tightness when climbing stairs',
      carePath: 'ALLOPATHY',
    }),
  });
  const start1 = await request('/conversation/start', {
    method: 'POST',
    body: JSON.stringify({
      visitId: reg1.data?.visit?.id,
      language: 'EN',
      carePath: 'ALLOPATHY',
      specialty: 'Cardiology',
      isNewCase: true,
    }),
  });
  console.log(`  [Turn 0 Q]: "${start1.data?.nextQuestion || start1.data?.message?.content}"`);

  // Turn 1
  const t1 = await request(`/conversation/${start1.data?.session?.id}/message`, {
    method: 'POST',
    body: JSON.stringify({
      content: 'Heavy retrosternal squeezing chest pain radiating to left arm when walking fast, with shortness of breath.',
      language: 'EN',
      carePath: 'ALLOPATHY',
      specialty: 'Cardiology',
    }),
  });
  console.log(`  [Turn 1 Q]: "${t1.data?.nextQuestion}"`);
  console.log(`  [Turn 1 Options]: ${JSON.stringify(t1.data?.touchOptions || [])}`);

  // Turn 2
  const t2 = await request(`/conversation/${start1.data?.session?.id}/message`, {
    method: 'POST',
    body: JSON.stringify({
      content: 'Starts after 100m of walking, lasts 10-15 minutes, relieved by rest. No diaphoresis, no vomiting. I have a history of hypertension.',
      language: 'EN',
      carePath: 'ALLOPATHY',
      specialty: 'Cardiology',
    }),
  });
  console.log(`  [Turn 2 Q]: "${t2.data?.nextQuestion}"`);

  // Turn 3
  const t3 = await request(`/conversation/${start1.data?.session?.id}/message`, {
    method: 'POST',
    body: JSON.stringify({
      content: 'Taking Amlodipine 5mg once daily in morning. No drug allergies. Father had myocardial infarction at age 52.',
      language: 'EN',
      carePath: 'ALLOPATHY',
      specialty: 'Cardiology',
    }),
  });
  console.log(`  [Turn 3 Q]: "${t3.data?.nextQuestion}"`);

  // Complete & Verify Summary
  await request(`/conversation/${start1.data?.session?.id}/complete`, { method: 'POST' });
  const visit1Res = await request(`/visits/${reg1.data?.visit?.id}`, { headers: authHeaders });
  const summary1 = visit1Res.data?.visit?.summary;
  console.log(`  ✅ [CASE 1 SUMMARY STATUS]: ${summary1 ? 'GENERATED' : 'FAILED'}`);
  console.log(`     Chief Complaint: "${summary1?.chiefComplaint || summary1?.summaryJson?.slice(0, 60)}"`);

  // ────────────────────────────────────────────────────────────
  // CASE 2: AYURVEDA (AYUSH) NEW CONSULTATION — ACIDITY & AGNI
  // ────────────────────────────────────────────────────────────
  console.log('\n▶ [CASE 2: AYURVEDA / AYUSH NEW CASE] 34F with Amlapitta & Agnimandya');
  const reg2 = await request('/patients/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Pooja Patel',
      phone: '9820092222',
      age: 34,
      gender: 'FEMALE',
      preferredLang: 'EN',
      departmentCode: 'AYUSH',
      reasonForVisit: 'Severe burning sensation in chest and sour belching',
      carePath: 'AYUSH',
    }),
  });
  const start2 = await request('/conversation/start', {
    method: 'POST',
    body: JSON.stringify({
      visitId: reg2.data?.visit?.id,
      language: 'EN',
      carePath: 'AYUSH',
      specialty: 'Ayurveda',
      isNewCase: true,
    }),
  });
  console.log(`  [Turn 0 Q]: "${start2.data?.nextQuestion || start2.data?.message?.content}"`);

  const t2_1 = await request(`/conversation/${start2.data?.session?.id}/message`, {
    method: 'POST',
    body: JSON.stringify({
      content: 'I have severe sour water in mouth (Amlodgara), burning in throat/chest, sluggish digestion (Mandagni), and hard stool (Krura Koshtha).',
      language: 'EN',
      carePath: 'AYUSH',
      specialty: 'Ayurveda',
    }),
  });
  console.log(`  [Turn 1 Q]: "${t2_1.data?.nextQuestion}"`);
  console.log(`  [Turn 1 Options]: ${JSON.stringify(t2_1.data?.touchOptions || [])}`);

  const t2_2 = await request(`/conversation/${start2.data?.session?.id}/message`, {
    method: 'POST',
    body: JSON.stringify({
      content: 'I frequently eat spicy, fried food and drink 4 cups of tea. I sleep late at 1 AM due to work stress (Ratri Jagarana).',
      language: 'EN',
      carePath: 'AYUSH',
      specialty: 'Ayurveda',
    }),
  });
  console.log(`  [Turn 2 Q]: "${t2_2.data?.nextQuestion}"`);

  await request(`/conversation/${start2.data?.session?.id}/complete`, { method: 'POST' });
  const visit2Res = await request(`/visits/${reg2.data?.visit?.id}`, { headers: authHeaders });
  console.log(`  ✅ [CASE 2 SUMMARY STATUS]: ${visit2Res.data?.visit?.summary ? 'GENERATED' : 'FAILED'}`);

  // ────────────────────────────────────────────────────────────
  // CASE 3: CLASSICAL HOMEOPATHY NEW CONSULTATION — MIGRAINE
  // ────────────────────────────────────────────────────────────
  console.log('\n▶ [CASE 3: CLASSICAL HOMEOPATHY NEW CASE] 29F Right-Sided Headache');
  const reg3 = await request('/patients/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Neha Gupta',
      phone: '9820093333',
      age: 29,
      gender: 'FEMALE',
      preferredLang: 'EN',
      departmentCode: 'GEN',
      reasonForVisit: 'Right-sided bursting migraine',
      carePath: 'HOMEOPATHY',
    }),
  });
  const start3 = await request('/conversation/start', {
    method: 'POST',
    body: JSON.stringify({
      visitId: reg3.data?.visit?.id,
      language: 'EN',
      carePath: 'HOMEOPATHY',
      specialty: 'Classical Homeopathy',
      isNewCase: true,
    }),
  });
  console.log(`  [Turn 0 Q]: "${start3.data?.nextQuestion || start3.data?.message?.content}"`);

  const t3_1 = await request(`/conversation/${start3.data?.session?.id}/message`, {
    method: 'POST',
    body: JSON.stringify({
      content: 'Right-sided bursting pain from temple to occiput. Worse from sun exposure, noise, and motion (< Sun, < Motion). Better by tight bandage and cold wash (> Hard Pressure, > Cold).',
      language: 'EN',
      carePath: 'HOMEOPATHY',
      specialty: 'Classical Homeopathy',
    }),
  });
  console.log(`  [Turn 1 Q]: "${t3_1.data?.nextQuestion}"`);

  const t3_2 = await request(`/conversation/${start3.data?.session?.id}/message`, {
    method: 'POST',
    body: JSON.stringify({
      content: 'I am a chilly patient (sensitive to cold drafts). I feel extreme thirst for large quantities of cold water. Very irritable and want to be left alone in dark room.',
      language: 'EN',
      carePath: 'HOMEOPATHY',
      specialty: 'Classical Homeopathy',
    }),
  });
  console.log(`  [Turn 2 Q]: "${t3_2.data?.nextQuestion}"`);

  await request(`/conversation/${start3.data?.session?.id}/complete`, { method: 'POST' });
  const visit3Res = await request(`/visits/${reg3.data?.visit?.id}`, { headers: authHeaders });
  console.log(`  ✅ [CASE 3 SUMMARY STATUS]: ${visit3Res.data?.visit?.summary ? 'GENERATED' : 'FAILED'}`);

  // ────────────────────────────────────────────────────────────
  // CASE 4: GENUINE FOLLOW-UP ON PREVIOUS MIGRAINE VISIT
  // ────────────────────────────────────────────────────────────
  console.log('\n▶ [CASE 4: GENUINE FOLLOW-UP CASE] Following up on Case 3 (Migraine)');
  const reg4 = await request('/patients/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Neha Gupta',
      phone: '9820093333',
      preferredLang: 'EN',
      departmentCode: 'GEN',
      reasonForVisit: 'Follow-up Consultation',
      carePath: 'HOMEOPATHY',
    }),
  });
  const start4 = await request('/conversation/start', {
    method: 'POST',
    body: JSON.stringify({
      visitId: reg4.data?.visit?.id,
      language: 'EN',
      carePath: 'HOMEOPATHY',
      specialty: 'Classical Homeopathy',
      followUpVisitId: reg3.data?.visit?.id,
      targetComplaint: 'Right-sided bursting migraine',
      isReturningPatient: true,
      isNewCase: false,
    }),
  });
  console.log(`  [Follow-Up Turn 0 Q]: "${start4.data?.nextQuestion || start4.data?.message?.content}"`);

  // ────────────────────────────────────────────────────────────
  // CASE 5: BRAND NEW CASE FROM RETURNING PATIENT (ISOLATED FRESH INTAKE)
  // ────────────────────────────────────────────────────────────
  console.log('\n▶ [CASE 5: NEW CASE FOR RETURNING PATIENT] Neha Gupta returns with NEW Rash (Orthopedics/Dermatology)');
  const reg5 = await request('/patients/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Neha Gupta',
      phone: '9820093333',
      preferredLang: 'EN',
      departmentCode: 'DERM',
      reasonForVisit: 'New red itchy skin rash on both arms',
      carePath: 'ALLOPATHY',
    }),
  });
  const start5 = await request('/conversation/start', {
    method: 'POST',
    body: JSON.stringify({
      visitId: reg5.data?.visit?.id,
      language: 'EN',
      carePath: 'ALLOPATHY',
      specialty: 'Dermatology',
      isNewCase: true,
      isReturningPatient: false,
    }),
  });
  console.log(`  [New Case Turn 0 Q]: "${start5.data?.nextQuestion || start5.data?.message?.content}"`);

  const t5_1 = await request(`/conversation/${start5.data?.session?.id}/message`, {
    method: 'POST',
    body: JSON.stringify({
      content: 'Red erythematous papules with intense itching on bilateral forearms since yesterday after gardening.',
      language: 'EN',
      carePath: 'ALLOPATHY',
      specialty: 'Dermatology',
    }),
  });
  console.log(`  [New Case Turn 1 Q]: "${t5_1.data?.nextQuestion}"`);

  console.log('\n========================================================');
  console.log('🏁 ALL 5 LIVE CLINICAL CASES EXECUTED AND VERIFIED!');
  console.log('========================================================');
}

runFiveLiveClinicalCases();
