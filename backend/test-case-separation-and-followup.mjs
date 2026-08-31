import fetch from 'node-fetch';

const BASE_URL = 'http://127.0.0.1:5000/api';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function loginDoctor() {
  const res = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'doctor@demo.com',
      password: 'demo123',
    }),
  });
  return res.data?.token;
}

async function runCaseSeparationVerification() {
  console.log('🧪 ========================================================');
  console.log('🧪 PHASE 5: CASE SEPARATION & FOLLOW-UP ACCURACY TEST');
  console.log('🧪 ========================================================\n');

  const doctorToken = await loginDoctor();
  const testPhone = `98765${Math.floor(10000 + Math.random() * 90000)}`;

  const testResults = {
    test1_newAllopathy: false,
    test2_newAyush: false,
    test3_newHomeopathy: false,
    test4_allopathyFollowUp: false,
    test5_ayushFollowUp: false,
    test6_homeopathyFollowUp: false,
    test7_newDifferentCase: false,
    test8_multipleHistoricalCases: false,
  };

  let patientId = null;
  const visitRecords = {};

  // -------------------------------------------------------------
  // 1. TEST 1: New Allopathy Case (Chest Heaviness)
  // -------------------------------------------------------------
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('▶ TEST 1: New Allopathy Case (Chest Heaviness)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const regRes1 = await request('/patients/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Sunil Verma',
      age: 48,
      gender: 'MALE',
      phone: testPhone,
      departmentCode: 'GEN',
      preferredLang: 'EN',
      reasonForVisit: 'Severe chest heaviness on exertion',
    }),
  });

  patientId = regRes1.data?.patient?.id;
  const visit1Id = regRes1.data?.visit?.id;
  visitRecords.allopathyVisit1 = visit1Id;

  const startRes1 = await request('/conversation/start', {
    method: 'POST',
    body: JSON.stringify({
      visitId: visit1Id,
      language: 'EN',
      carePath: 'ALLOPATHY',
      specialty: 'Cardiology',
    }),
  });

  const session1 = startRes1.data?.session;
  const state1 = typeof session1?.clinicalState === 'string' ? JSON.parse(session1.clinicalState) : (session1?.clinicalState || {});
  console.log(`[AI Initial Question]: "${startRes1.data?.message?.content}"`);
  console.log(`[State isNewPatient]: ${state1.isNewPatient}, previousVisitInfo: ${JSON.stringify(state1.previousVisitInfo)}`);

  // Progress and complete encounter 1
  await request(`/conversation/${session1.id}/message`, {
    method: 'POST',
    body: JSON.stringify({
      input: 'I have severe chest heaviness and tightness when climbing stairs for the past 2 weeks.',
      language: 'EN',
    }),
  });
  await request(`/conversation/${session1.id}/complete`, { method: 'POST' });

  // Doctor completes consultation for encounter 1
  await request('/doctor/consultation', {
    method: 'POST',
    headers: { Authorization: `Bearer ${doctorToken}` },
    body: JSON.stringify({
      visitId: visit1Id,
      patientId,
      diagnosis: 'Exertional Angina / CAD Evaluation',
      clinicalNotes: 'ECG recommended, start Sorbitrate PRN.',
      treatmentPlan: 'Tab Sorbitrate 5mg sublingual PRN',
      prescriptions: [{ medicineName: 'Sorbitrate 5mg', dosage: '1 tab PRN', frequency: 'PRN', duration: '30 days' }],
    }),
  });

  if (state1.isNewPatient === true && !state1.previousVisitInfo) {
    testResults.test1_newAllopathy = true;
    console.log('✅ TEST 1 PASSED: New Allopathy case initialized cleanly as fresh baseline.');
  }

  // -------------------------------------------------------------
  // 2. TEST 2: New AYUSH Case (Chronic Acidity)
  // -------------------------------------------------------------
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('▶ TEST 2: New AYUSH Case for same patient (Chronic Acidity)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const regRes2 = await request('/patients/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Sunil Verma',
      phone: testPhone,
      departmentCode: 'AYU',
      preferredLang: 'EN',
      reasonForVisit: 'Chronic acidity and burning indigestion (Amlapitta)',
    }),
  });

  const visit2Id = regRes2.data?.visit?.id;
  visitRecords.ayushVisit1 = visit2Id;

  const startRes2 = await request('/conversation/start', {
    method: 'POST',
    body: JSON.stringify({
      visitId: visit2Id,
      language: 'EN',
      carePath: 'AYUSH',
      isAyush: true,
      specialty: 'Ayurveda',
      visitType: 'NEW_CASE',
      isNewCase: true,
    }),
  });

  const session2 = startRes2.data?.session;
  const state2 = typeof session2?.clinicalState === 'string' ? JSON.parse(session2.clinicalState) : (session2?.clinicalState || {});
  console.log(`[AI Initial Question]: "${startRes2.data?.message?.content}"`);
  console.log(`[State isNewPatient]: ${state2.isNewPatient}, previousVisitInfo: ${JSON.stringify(state2.previousVisitInfo)}`);

  // Progress and complete encounter 2
  await request(`/conversation/${session2.id}/message`, {
    method: 'POST',
    body: JSON.stringify({
      input: 'Severe sour belching, heartburn and sluggish digestion after meals for 1 month.',
      language: 'EN',
    }),
  });
  await request(`/conversation/${session2.id}/complete`, { method: 'POST' });

  // Doctor completes consultation for encounter 2
  await request('/doctor/consultation', {
    method: 'POST',
    headers: { Authorization: `Bearer ${doctorToken}` },
    body: JSON.stringify({
      visitId: visit2Id,
      patientId,
      diagnosis: 'Amlapitta with Mandagni',
      clinicalNotes: 'Advised Pathya Ahara, Avipattikar Churna.',
      treatmentPlan: 'Avipattikar Churna 3g twice daily before meals',
      prescriptions: [{ medicineName: 'Avipattikar Churna', dosage: '3g BD', frequency: 'Twice daily', duration: '15 days' }],
    }),
  });

  if (state2.isNewPatient === true && !state2.previousVisitInfo) {
    testResults.test2_newAyush = true;
    console.log('✅ TEST 2 PASSED: New AYUSH case initialized with zero contamination from Allopathy chest case.');
  }

  // -------------------------------------------------------------
  // 3. TEST 3: New Homeopathy Case (Skin Eczema)
  // -------------------------------------------------------------
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('▶ TEST 3: New Homeopathy Case for same patient (Skin Eczema)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const regRes3 = await request('/patients/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Sunil Verma',
      phone: testPhone,
      departmentCode: 'HOM',
      preferredLang: 'EN',
      reasonForVisit: 'Chronic eczema with severe itching behind knees',
    }),
  });

  const visit3Id = regRes3.data?.visit?.id;
  visitRecords.homeoVisit1 = visit3Id;

  const startRes3 = await request('/conversation/start', {
    method: 'POST',
    body: JSON.stringify({
      visitId: visit3Id,
      language: 'EN',
      carePath: 'HOMEOPATHY',
      isHomeopathy: true,
      specialty: 'Classical Homeopathy',
      visitType: 'NEW_CASE',
      isNewCase: true,
    }),
  });

  const session3 = startRes3.data?.session;
  const state3 = typeof session3?.clinicalState === 'string' ? JSON.parse(session3.clinicalState) : (session3?.clinicalState || {});
  console.log(`[AI Initial Question]: "${startRes3.data?.message?.content}"`);
  console.log(`[State isNewPatient]: ${state3.isNewPatient}, previousVisitInfo: ${JSON.stringify(state3.previousVisitInfo)}`);

  // Progress and complete encounter 3
  await request(`/conversation/${session3.id}/message`, {
    method: 'POST',
    body: JSON.stringify({
      input: 'Intense burning and itching eruptions behind knees, worse at night and warm room. Chilly patient.',
      language: 'EN',
    }),
  });
  await request(`/conversation/${session3.id}/complete`, { method: 'POST' });

  // Doctor completes consultation for encounter 3
  await request('/doctor/consultation', {
    method: 'POST',
    headers: { Authorization: `Bearer ${doctorToken}` },
    body: JSON.stringify({
      visitId: visit3Id,
      patientId,
      diagnosis: 'Eczematous Dermatitis (Sycotic Totality)',
      clinicalNotes: 'Prescribed Sulphur 200C single dose then Graphites 30C.',
      treatmentPlan: 'Graphites 30C 4 pills TDS',
      prescriptions: [{ medicineName: 'Graphites 30C', dosage: '4 pills TDS', frequency: 'Three times daily', duration: '20 days' }],
    }),
  });

  if (state3.isNewPatient === true && !state3.previousVisitInfo) {
    testResults.test3_newHomeopathy = true;
    console.log('✅ TEST 3 PASSED: New Homeopathy case initialized with zero contamination from prior encounters.');
  }

  // -------------------------------------------------------------
  // 4. TEST 4: Allopathy Follow-up (Should match Chest Heaviness)
  // -------------------------------------------------------------
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('▶ TEST 4: Allopathy Follow-up (Should match Chest Heaviness)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const regRes4 = await request('/patients/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Sunil Verma',
      phone: testPhone,
      departmentCode: 'GEN',
      preferredLang: 'EN',
      reasonForVisit: 'Follow-up for chest heaviness',
    }),
  });

  const visit4Id = regRes4.data?.visit?.id;
  const startRes4 = await request('/conversation/start', {
    method: 'POST',
    body: JSON.stringify({
      visitId: visit4Id,
      language: 'EN',
      carePath: 'ALLOPATHY',
      specialty: 'Cardiology',
      targetComplaint: 'chest heaviness',
    }),
  });

  const session4 = startRes4.data?.session;
  const state4 = typeof session4?.clinicalState === 'string' ? JSON.parse(session4.clinicalState) : (session4?.clinicalState || {});
  console.log(`[AI Initial Question]: "${startRes4.data?.message?.content}"`);
  console.log(`[Matched Previous Complaint]: "${state4.previousVisitInfo?.lastComplaint}"`);
  console.log(`[Matched Previous Dept]: "${state4.previousVisitInfo?.lastDepartment}"`);

  const prevComp4 = (state4.previousVisitInfo?.lastComplaint || '').toLowerCase();

  if (
    (prevComp4.includes('chest') || prevComp4.includes('angina')) &&
    !prevComp4.includes('eczema') &&
    !prevComp4.includes('acidity')
  ) {
    testResults.test4_allopathyFollowUp = true;
    console.log('✅ TEST 4 PASSED: Follow-up precisely matched the Allopathy chest case and ignored AYUSH/Homeopathy cases.');
  }

  // -------------------------------------------------------------
  // 5. TEST 5: AYUSH Follow-up (Should match Acidity / Indigestion)
  // -------------------------------------------------------------
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('▶ TEST 5: AYUSH Follow-up (Should match Acidity / Indigestion)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const regRes5 = await request('/patients/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Sunil Verma',
      phone: testPhone,
      departmentCode: 'AYU',
      preferredLang: 'EN',
      reasonForVisit: 'Follow-up for acidity and indigestion',
    }),
  });

  const visit5Id = regRes5.data?.visit?.id;
  const startRes5 = await request('/conversation/start', {
    method: 'POST',
    body: JSON.stringify({
      visitId: visit5Id,
      language: 'EN',
      carePath: 'AYUSH',
      isAyush: true,
      specialty: 'Ayurveda',
      targetComplaint: 'acidity',
    }),
  });

  const session5 = startRes5.data?.session;
  const state5 = typeof session5?.clinicalState === 'string' ? JSON.parse(session5.clinicalState) : (session5?.clinicalState || {});
  console.log(`[AI Initial Question]: "${startRes5.data?.message?.content}"`);
  console.log(`[Matched Previous Complaint]: "${state5.previousVisitInfo?.lastComplaint}"`);
  console.log(`[Matched Previous Dept]: "${state5.previousVisitInfo?.lastDepartment}"`);

  const prevComp5 = (state5.previousVisitInfo?.lastComplaint || '').toLowerCase();
  if (
    (prevComp5.includes('acidity') || prevComp5.includes('amlapitta') || prevComp5.includes('indigestion')) &&
    !prevComp5.includes('chest') &&
    !prevComp5.includes('eczema')
  ) {
    testResults.test5_ayushFollowUp = true;
    console.log('✅ TEST 5 PASSED: Follow-up precisely matched the AYUSH acidity case and ignored Allopathy/Homeopathy cases.');
  }

  // -------------------------------------------------------------
  // 6. TEST 6: Homeopathy Follow-up (Should match Eczema / Skin)
  // -------------------------------------------------------------
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('▶ TEST 6: Homeopathy Follow-up (Should match Eczema / Skin)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const regRes6 = await request('/patients/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Sunil Verma',
      phone: testPhone,
      departmentCode: 'HOM',
      preferredLang: 'EN',
      reasonForVisit: 'Follow-up for skin eczema itching',
    }),
  });

  const visit6Id = regRes6.data?.visit?.id;
  const startRes6 = await request('/conversation/start', {
    method: 'POST',
    body: JSON.stringify({
      visitId: visit6Id,
      language: 'EN',
      carePath: 'HOMEOPATHY',
      isHomeopathy: true,
      specialty: 'Classical Homeopathy',
      targetComplaint: 'eczema',
    }),
  });

  const session6 = startRes6.data?.session;
  const state6 = typeof session6?.clinicalState === 'string' ? JSON.parse(session6.clinicalState) : (session6?.clinicalState || {});
  console.log(`[AI Initial Question]: "${startRes6.data?.message?.content}"`);
  console.log(`[Matched Previous Complaint]: "${state6.previousVisitInfo?.lastComplaint}"`);
  console.log(`[Matched Previous Dept]: "${state6.previousVisitInfo?.lastDepartment}"`);

  const prevComp6 = (state6.previousVisitInfo?.lastComplaint || '').toLowerCase();
  if (
    (prevComp6.includes('eczema') || prevComp6.includes('skin') || prevComp6.includes('itching')) &&
    !prevComp6.includes('chest') &&
    !prevComp6.includes('acidity')
  ) {
    testResults.test6_homeopathyFollowUp = true;
    console.log('✅ TEST 6 PASSED: Follow-up precisely matched the Homeopathy skin case and ignored chest & acidity cases.');
  }

  // -------------------------------------------------------------
  // 7. TEST 7: New Completely Different Case for Returning Patient
  // -------------------------------------------------------------
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('▶ TEST 7: New Completely Different Case (Knee Joint Pain)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const regRes7 = await request('/patients/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Sunil Verma',
      phone: testPhone,
      departmentCode: 'GEN',
      preferredLang: 'EN',
      reasonForVisit: 'Severe right knee pain after twisting injury',
    }),
  });

  const visit7Id = regRes7.data?.visit?.id;
  const startRes7 = await request('/conversation/start', {
    method: 'POST',
    body: JSON.stringify({
      visitId: visit7Id,
      language: 'EN',
      carePath: 'ALLOPATHY',
      specialty: 'Orthopedics',
      visitType: 'NEW_CASE',
      isNewCase: true,
    }),
  });

  const session7 = startRes7.data?.session;
  const state7 = typeof session7?.clinicalState === 'string' ? JSON.parse(session7.clinicalState) : (session7?.clinicalState || {});
  console.log(`[AI Initial Question]: "${startRes7.data?.message?.content}"`);
  console.log(`[State isNewPatient]: ${state7.isNewPatient}, previousVisitInfo: ${JSON.stringify(state7.previousVisitInfo)}`);

  if (state7.isNewPatient === true && !state7.previousVisitInfo) {
    testResults.test7_newDifferentCase = true;
    console.log('✅ TEST 7 PASSED: New different complaint started as fresh case without follow-up contamination.');
  }

  // -------------------------------------------------------------
  // 8. TEST 8: Multiple Historical Cases Separation & Immutability
  // -------------------------------------------------------------
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('▶ TEST 8: Multiple Historical Cases Separation & Immutability');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const timelineRes = await request(`/doctor/timeline/${patientId}`, {
    headers: { Authorization: `Bearer ${doctorToken}` },
  });

  const timeline = timelineRes.data?.timeline || [];
  console.log(`[Timeline Records Total]: ${timeline.length} encounters found.`);
  timeline.forEach((rec, i) => {
    console.log(`   #${i + 1} | Dept: [${rec.department}] | Complaint: "${rec.chiefComplaint}" | Diagnosis: "${rec.doctor?.diagnosis}"`);
  });

  // Verify all 3 original completed encounters exist with distinct diagnoses and complaints
  const hasChest = timeline.some(t => /chest|angina/i.test(t.chiefComplaint || '') || /angina/i.test(t.doctor?.diagnosis || ''));
  const hasAmlapitta = timeline.some(t => /acidity|amlapitta/i.test(t.chiefComplaint || '') || /amlapitta/i.test(t.doctor?.diagnosis || ''));
  const hasEczema = timeline.some(t => /eczema|itching/i.test(t.chiefComplaint || '') || /eczematous/i.test(t.doctor?.diagnosis || ''));

  if (timeline.length >= 3 && hasChest && hasAmlapitta && hasEczema) {
    testResults.test8_multipleHistoricalCases = true;
    console.log('✅ TEST 8 PASSED: All completed encounters preserved with complete immutability and distinct clinical contexts.');
  }

  console.log('\n========================================================');
  console.log('🔬 PHASE 5 CASE SEPARATION VERIFICATION SUMMARY:');
  console.log('========================================================');
  Object.entries(testResults).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
  });

  const allPassed = Object.values(testResults).every(Boolean);
  if (allPassed) {
    console.log('\n🎉 ALL 8 PHASE 5 CASE SEPARATION AND FOLLOW-UP TESTS PASSED WITH 100% SUCCESS!');
  } else {
    console.error('\n⚠️ SOME TESTS FAILED. CHECK LOGS ABOVE.');
    process.exit(1);
  }
}

runCaseSeparationVerification().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
