import http from 'http';

function post(path, payload, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload || {});
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
    };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path,
      method: 'POST',
      headers,
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch(e) { resolve({ status: res.statusCode, data: body }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(path, token) {
  return new Promise((resolve, reject) => {
    const headers = token ? { 'Authorization': 'Bearer ' + token } : {};
    http.get({ hostname: 'localhost', port: 5000, path, headers }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch(e) { resolve({ status: res.statusCode, data: body }); }
      });
    }).on('error', reject);
  });
}

async function runVerificationSuite() {
  console.log('================================================================');
  console.log('🏥 MEDIKIOSK COMPLETE FORENSIC & END-TO-END DEMO VERIFICATION');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(name, condition, details = '') {
    if (condition) {
      console.log(`  ✅ [PASS] ${name} ${details}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${name} ${details}`);
      failed++;
    }
  }

  // 1. Auth Tokens
  console.log('--- 1. Authenticating Roles ---');
  const docAuth = await post('/api/auth/demo-login', { role: 'DOCTOR' });
  const docToken = docAuth.data?.token;
  assert('Doctor Authentication', docAuth.status === 200 && Boolean(docToken), `(Doctor: ${docAuth.data?.user?.name})`);

  const nurseAuth = await post('/api/auth/demo-login', { role: 'NURSE' });
  const nurseToken = nurseAuth.data?.token;
  assert('Nurse Authentication', nurseAuth.status === 200 && Boolean(nurseToken));

  const deptList = await get('/api/visits', docToken);
  const deptId = deptList.data?.visits?.[0]?.departmentId;

  // 2. ABDM ABHA Verification
  console.log('\n--- 2. Testing ABDM / ABHA Format Adapter ---');
  const abhaValid = await post('/api/integrations/abdm/verify-format', { abhaId: '91-1234-5678-9012' });
  assert('ABHA 14-Digit Format Validation', abhaValid.data?.isValid === true && abhaValid.data?.type === 'ABHA_NUMBER');

  const abhaAddress = await post('/api/integrations/abdm/verify-format', { abhaId: 'rahul.sharma@abdm' });
  assert('ABHA PHR Address Validation', abhaAddress.data?.isValid === true && abhaAddress.data?.type === 'ABHA_ADDRESS');

  const abhaInvalid = await post('/api/integrations/abdm/verify-format', { abhaId: 'invalid-id-xyz' });
  assert('ABHA Invalid Format Flagging', abhaInvalid.data?.isValid === false);

  // 3. Patient Registration with ABHA
  console.log('\n--- 3. Patient Registration (Visit 1) ---');
  const testPhone = '98' + Math.floor(10000000 + Math.random() * 90000000);
  const regRes = await post('/api/patients/register', {
    name: 'Vikramaditya Mehta',
    age: 52,
    gender: 'MALE',
    phone: testPhone,
    abhaId: '91-1234-5678-9012',
    departmentId: deptId,
    preferredLang: 'EN',
    reasonForVisit: 'Severe chest tightness radiating to left arm and shortness of breath',
    pastMedicalHistory: 'Type 2 Diabetes (5 yrs), Hypertension',
    currentMedications: 'Metformin 500mg, Amlodipine 5mg',
    allergies: 'Penicillin (Skin Rash)',
  });

  assert('Patient Registration & Token Creation', regRes.status === 201 && Boolean(regRes.data?.patient?.id));
  const patient = regRes.data?.patient;
  const visit = regRes.data?.visit;
  console.log(`     Patient: ${patient?.name} (MRN: ${patient?.mrn}, Token: ${visit?.token})`);

  // 4. Consent
  console.log('\n--- 4. Patient Consent ---');
  const consentRes = await post('/api/consent', {
    patientId: patient?.id,
    visitId: visit?.id,
    consented: true,
    type: 'GENERAL_TREATMENT',
    method: 'TOUCH_SCREEN',
  });
  assert('Consent Capture', consentRes.status === 201 && consentRes.data?.consent?.granted === true);

  // 5. AI Conversation & Red Flag Engine
  console.log('\n--- 5. AI Clinical Intake & Red Flag Evaluation ---');
  const startSession = await post('/api/conversation/start', {
    visitId: visit?.id,
    language: 'EN',
    respondentType: 'PATIENT',
  });
  assert('Conversation Session Start', startSession.status === 201 && Boolean(startSession.data?.session?.id));
  const sessionId = startSession.data?.session?.id;

  const userMsg = await post(`/api/conversation/${sessionId}/message`, {
    content: 'I have severe pressure in my chest since this morning and I am feeling dizzy.',
    language: 'EN',
  });
  assert('AI Dynamic Question & Intake Progress', userMsg.status === 200 && Boolean(userMsg.data?.nextQuestion));
  console.log(`     AI Next Question: ${userMsg.data?.nextQuestion?.slice(0, 70)}...`);
  console.log(`     Red Flag Status: ${userMsg.data?.hasRedFlag ? 'TRIGGERED (' + (userMsg.data?.redFlagAlert?.alertType || 'ALERT') + ')' : 'NORMAL'}`);

  const completeIntake = await post(`/api/conversation/${sessionId}/complete`, {});
  assert('Clinical Intake Completion', completeIntake.status === 200 && Boolean(completeIntake.data?.clinicalSummary?.id));

  // 6. Nurse Vitals
  console.log('\n--- 6. Nurse Vitals Recording ---');
  const vitalsRes = await post('/api/vitals', {
    visitId: visit?.id,
    patientId: patient?.id,
    bpSystolic: 142,
    bpDiastolic: 92,
    pulse: 88,
    spo2: 96,
    temperature: 98.6,
    weight: 78,
    height: 175,
    painScore: 7,
    notes: 'Patient looks anxious, mild sweating',
  }, nurseToken);
  assert('Nurse Vitals Record', vitalsRes.status === 201 && vitalsRes.data?.vital?.bpSystolic === 142);

  // 7. Doctor Longitudinal Timeline (Testing Fix for singular relation)
  console.log('\n--- 7. Doctor Longitudinal Timeline & Patient 360 ---');
  const timelineRes = await get(`/api/doctor/timeline/${patient?.id}`, docToken);
  assert('Doctor Timeline (Singular Consultation Query Fix)', timelineRes.status === 200 && Array.isArray(timelineRes.data?.timeline));
  console.log(`     Retrieved Timeline Records: ${timelineRes.data?.count}`);

  // 8. Doctor Consultation, Digital Signature & Prescription
  console.log('\n--- 8. Doctor Consultation, E-Prescription & Digital Signature Sealing ---');
  const consultRes = await post('/api/doctor/consultation', {
    visitId: visit?.id,
    patientId: patient?.id,
    clinicalNotes: 'ECG shows sinus tachycardia with T-wave inversions in V4-V6. Cardiac enzymes sent.',
    impression: 'Acute Coronary Syndrome (ACS) - Non-ST Elevation Myocardial Infarction',
    diagnosis: ['Acute Coronary Syndrome', 'Essential Hypertension'],
    treatmentPlan: 'Immediate Cardiology transfer, load antiplatelets, sublingual nitrates',
    prescriptions: [
      { medicineName: 'Aspirin 300mg (Dispersible)', dosage: '1 tab stat', frequency: 'Immediate', duration: '1 day', instructions: 'Chew immediately' },
      { medicineName: 'Clopidogrel 300mg', dosage: '4 tabs stat', frequency: 'Immediate', duration: '1 day', instructions: 'With water' },
      { medicineName: 'Atorvastatin 80mg', dosage: '1 tab', frequency: 'At bedtime', duration: '30 days', instructions: 'After food' },
    ],
  }, docToken);

  assert('Consultation Saved', consultRes.status === 201);
  assert('Prescription Items Created', consultRes.data?.prescription?.items?.length === 3);
  assert('Digital Signature Created with SHA-256 Hash', Boolean(consultRes.data?.digitalSignature?.documentHash && consultRes.data?.digitalSignature?.signerName));
  console.log(`     Signer: ${consultRes.data?.digitalSignature?.signerName}`);
  console.log(`     Document Hash (SHA-256): ${consultRes.data?.digitalSignature?.documentHash}`);

  // 9. Prescription Deduplication Verification
  console.log('\n--- 9. Verifying Prescription Deduplication on Re-save ---');
  const resaveConsult = await post('/api/doctor/consultation', {
    visitId: visit?.id,
    patientId: patient?.id,
    clinicalNotes: 'ECG re-evaluated, transferring to CCU.',
    diagnosis: 'Acute Coronary Syndrome (NSTEMI)',
    treatmentPlan: 'Transferred to CCU',
    prescriptions: [
      { medicineName: 'Aspirin 75mg', dosage: '1 tab', frequency: 'Once daily', duration: '30 days', instructions: 'After food' },
      { medicineName: 'Atorvastatin 80mg', dosage: '1 tab', frequency: 'At bedtime', duration: '30 days', instructions: 'After food' },
    ],
  }, docToken);
  assert('Prescription Deduplication on Re-save', resaveConsult.data?.prescription?.items?.length === 2, `(Expected 2 items, got ${resaveConsult.data?.prescription?.items?.length})`);

  // 10. FHIR R4 Bundle Generation
  console.log('\n--- 10. Official HL7 FHIR R4 Bundle Generation ---');
  const fhirRes = await get(`/api/integrations/fhir/bundle/${visit?.id}`, docToken);
  assert('HL7 FHIR R4 Bundle Generation', fhirRes.status === 200 && fhirRes.data?.resourceType === 'Bundle');
  const resourceTypes = fhirRes.data?.entry?.map(e => e.resource?.resourceType) || [];
  assert('FHIR Contains Core Clinical Resources', resourceTypes.includes('Patient') && resourceTypes.includes('Encounter') && resourceTypes.includes('Observation'));
  console.log(`     FHIR Resource Types in Bundle: ${[...new Set(resourceTypes)].join(', ')}`);

  // 11. HIS / EMR Integration Export
  console.log('\n--- 11. HIS / EMR Hospital Adapter Export ---');
  const hisRes = await post(`/api/integrations/his/export/${visit?.id}`, {}, docToken);
  assert('HIS Export Dispatch', hisRes.status === 200 && hisRes.data?.success === true);
  console.log(`     HIS Status: ${hisRes.data?.hisStatus}`);

  // 12. Returning Patient Follow-up Encounter (Visit 2)
  console.log('\n--- 12. Returning Patient Workflow (Follow-up Visit 2) ---');
  const lookupRes = await post('/api/patients/lookup', { query: patient?.phone, type: 'PHONE' });
  assert('Returning Patient Lookup', lookupRes.status === 200 && lookupRes.data?.patient?.mrn === patient?.mrn);

  const visit2Reg = await post('/api/patients/register', {
    name: patient?.name,
    age: 52,
    gender: 'MALE',
    phone: patient?.phone,
    departmentId: deptId,
    preferredLang: 'EN',
    reasonForVisit: 'Follow-up on chest symptoms, feeling much better after medication',
  });
  assert('Second Encounter Created', visit2Reg.status === 201 && Boolean(visit2Reg.data?.visit?.id));
  const visit2 = visit2Reg.data?.visit;

  const visit2Session = await post('/api/conversation/start', {
    visitId: visit2?.id,
    language: 'EN',
    isReturningPatient: true,
  });
  assert('Returning Patient Intake with Prior Memory', visit2Session.status === 201 && visit2Session.data?.session?.clinicalState?.isNewPatient === false);

  // Check that timeline now contains BOTH encounters
  const updatedTimeline = await get(`/api/doctor/timeline/${patient?.id}`, docToken);
  assert('Longitudinal Timeline Contains Both Encounters Separately', updatedTimeline.data?.count >= 2, `(Total visits in history: ${updatedTimeline.data?.count})`);

  console.log('\n================================================================');
  console.log(`🏁 VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runVerificationSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
