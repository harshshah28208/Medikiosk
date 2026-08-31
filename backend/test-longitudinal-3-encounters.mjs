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

async function seed3DistinctLongitudinalEncounters() {
  console.log('================================================================');
  console.log('🏥 SEEDING PATIENT WITH 3 COMPLETED DISTINCT CLINICAL ENCOUNTERS');
  console.log('================================================================\n');

  // 1. Authenticate Clinical Staff
  const docLogin = await post('/api/auth/demo-login', { role: 'DOCTOR' });
  const docToken = docLogin.data?.token;

  const nurseLogin = await post('/api/auth/demo-login', { role: 'NURSE' });
  const nurseToken = nurseLogin.data?.token;

  const testPhone = '987654' + Math.floor(1000 + Math.random() * 9000);
  const patientName = 'Devendra R. Patel';

  console.log(`Creating Patient: ${patientName} (${testPhone})...\n`);

  // -------------------------------------------------------------
  // ENCOUNTER 1: ALLOPATHY / CARDIOLOGY
  // -------------------------------------------------------------
  console.log('--- ENCOUNTER 1: Allopathy / Cardiology ---');
  const reg1 = await post('/api/patients/register', {
    name: patientName,
    age: 58,
    gender: 'MALE',
    phone: testPhone,
    abhaId: '91-' + Math.floor(1000 + Math.random() * 9000) + '-5678-9012',
    preferredLang: 'EN',
    reasonForVisit: 'Acute substernal chest pressure with dyspnea on exertion',
    pastMedicalHistory: 'Type 2 Diabetes (7 yrs)',
    currentMedications: 'Metformin 500mg BD',
    allergies: 'Sulfa Drugs',
  });
  const pId = reg1.data?.patient?.id;
  const v1 = reg1.data?.visit;

  await post('/api/vitals', {
    visitId: v1.id,
    patientId: pId,
    bpSystolic: 142,
    bpDiastolic: 90,
    pulse: 88,
    spo2: 97,
    temperature: 98.4,
    notes: 'Cardiac screening protocol',
  }, nurseToken);

  const c1 = await post('/api/doctor/consultation', {
    visitId: v1.id,
    patientId: pId,
    clinicalNotes: 'ECG demonstrates inverted T waves in V4-V6. Cardiac enzymes borderline normal. Troponin I negative.',
    impression: 'Acute Coronary Syndrome (NSTEMI) / Essential Stage-1 HTN',
    diagnosis: 'Acute Coronary Syndrome / Essential Hypertension',
    treatmentPlan: 'Initiate dual antiplatelet therapy, statin load, cardiology follow-up in 1 week',
    prescriptions: [
      { medicineName: 'Aspirin 75mg', dosage: '1 tab', frequency: 'Once daily (OD)', duration: '30 days', instructions: 'After lunch' },
      { medicineName: 'Atorvastatin 40mg', dosage: '1 tab', frequency: 'At bedtime (HS)', duration: '30 days', instructions: 'After dinner' },
      { medicineName: 'Metoprolol Succinate 25mg', dosage: '1 tab', frequency: 'Morning (OD)', duration: '30 days', instructions: 'After breakfast' },
    ],
  }, docToken);
  console.log(`✅ Encounter 1 Completed & Signed: ${c1.data?.digitalSignature?.documentHash?.slice(0, 16)}...\n`);

  // -------------------------------------------------------------
  // ENCOUNTER 2: AYUSH / AYURVEDA
  // -------------------------------------------------------------
  console.log('--- ENCOUNTER 2: AYUSH / Ayurveda ---');
  const reg2 = await post('/api/patients/register', {
    name: patientName,
    age: 58,
    gender: 'MALE',
    phone: testPhone,
    preferredLang: 'EN',
    reasonForVisit: 'Chronic Amlapitta (Hyperacidity) and bilateral knee stiffness (Sandhivata)',
  });
  const v2 = reg2.data?.visit;

  await post('/api/vitals', {
    visitId: v2.id,
    patientId: pId,
    bpSystolic: 130,
    bpDiastolic: 84,
    pulse: 74,
    spo2: 99,
    temperature: 98.6,
    notes: 'Ayush intake vitals',
  }, nurseToken);

  await post('/api/ayush/assessment', {
    visitId: v2.id,
    patientId: pId,
    prakriti: { primaryDosha: 'Pitta-Vata', description: 'Tikshna Agni, Krura Koshtha' },
    agni: 'MANDAGNI',
    koshtha: 'KRURA',
    nadi: 'Pitta-Vata Nadi (Druta Gati)',
    jihva: 'Sama (Mild white coating at root)',
    notes: 'Ashtavidha Pariksha confirms Pitta aggravation with Vata stagnation in Janu Sandhi.',
  }, docToken);

  const c2 = await post('/api/doctor/consultation', {
    visitId: v2.id,
    patientId: pId,
    clinicalNotes: 'Prakriti assessment indicates Pitta-Vata imbalance with Mandagni leading to Ama accumulation.',
    impression: 'Amlapitta & Sandhivata (Ayurvedic Osteoarthritis & Hyperacidity)',
    diagnosis: 'Amlapitta & Janu Sandhivata',
    treatmentPlan: 'Deepana-Pachana therapy, Pathya diet (avoid sour/fermented foods), Janu Basti next week',
    prescriptions: [
      { medicineName: 'Avipattikar Churna', dosage: '3 grams', frequency: 'Twice daily with lukewarm water', duration: '15 days', instructions: 'Before meals' },
      { medicineName: 'Yogaraj Guggulu', dosage: '2 tablets', frequency: 'Twice daily with warm water', duration: '30 days', instructions: 'After meals' },
    ],
  }, docToken);
  console.log(`✅ Encounter 2 Completed & Signed: ${c2.data?.digitalSignature?.documentHash?.slice(0, 16)}...\n`);

  // -------------------------------------------------------------
  // ENCOUNTER 3: HOMEOPATHY / AYUSH
  // -------------------------------------------------------------
  console.log('--- ENCOUNTER 3: Homeopathy / Classical Care ---');
  const reg3 = await post('/api/patients/register', {
    name: patientName,
    age: 58,
    gender: 'MALE',
    phone: testPhone,
    preferredLang: 'EN',
    reasonForVisit: 'Recurrent Throbbing Right-sided Migraine (< sun exposure, > dark quiet room)',
  });
  const v3 = reg3.data?.visit;

  await post('/api/vitals', {
    visitId: v3.id,
    patientId: pId,
    bpSystolic: 124,
    bpDiastolic: 80,
    pulse: 72,
    spo2: 99,
    temperature: 98.4,
    notes: 'Homeopathy intake vitals',
  }, nurseToken);

  await post('/api/ayush/assessment', {
    visitId: v3.id,
    patientId: pId,
    homeopathyMiasm: 'PSORA_SYCOTIC',
    homeopathyThermal: 'HOT_PATIENT',
    homeopathyThirst: 'THIRSTLESS',
    homeopathyModalities: '< Sun heat, < 3 PM, > Cold application, > Dark room',
    homeopathyRepertoryNotes: 'Head; Pain; Right side; Throbbing, pulsating; Aggravated by light and sun.',
  }, docToken);

  const c3 = await post('/api/doctor/consultation', {
    visitId: v3.id,
    patientId: pId,
    clinicalNotes: 'Constitutional repertorisation points to Belladonna for acute throbbing right hemisphere headache.',
    impression: 'Chronic Right-Sided Migraine / Vascular Cephalea',
    diagnosis: 'Hemicrania Dextra (Vascular Migraine)',
    treatmentPlan: 'Single dose dynamic stimulus with constitutional follow-up in 14 days',
    prescriptions: [
      { medicineName: 'Belladonna 200CH', dosage: '4 pills stat', frequency: 'Single dose', duration: '1 day', instructions: 'On clean tongue' },
      { medicineName: 'Natrum Muriaticum 1M', dosage: '4 pills', frequency: 'Once weekly', duration: '4 weeks', instructions: 'Sunday morning empty stomach' },
    ],
  }, docToken);
  console.log(`✅ Encounter 3 Completed & Signed: ${c3.data?.digitalSignature?.documentHash?.slice(0, 16)}...\n`);

  // -------------------------------------------------------------
  // VERIFY LONGITUDINAL HISTORY ENDPOINT
  // -------------------------------------------------------------
  console.log('--- VERIFYING LONGITUDINAL HISTORY API (ALL 3 ENCOUNTERS) ---');
  const timelineRes = await get(`/api/doctor/timeline/${pId}`, docToken);
  const timeline = timelineRes.data?.timeline;

  console.log(`Status: ${timelineRes.status} | Total Encounters Returned: ${timeline?.length}`);
  timeline.forEach((enc, index) => {
    console.log(`\n  [Encounter #${timeline.length - index}]`);
    console.log(`  Visit ID: ${enc.visitId}`);
    console.log(`  Chief Complaint: ${enc.chiefComplaint}`);
    console.log(`  Department: ${enc.department}`);
    console.log(`  Doctor: ${enc.doctor?.name} (${enc.doctor?.specialization})`);
    console.log(`  Diagnosis: ${enc.doctor?.diagnosis}`);
    console.log(`  Digital Signature: ${enc.digitalSignature?.signerName} [Hash: ${enc.digitalSignature?.documentHash?.slice(0, 16)}...]`);
    console.log(`  Prescription: ${enc.lastPrescription}`);
  });

  if (timeline?.length === 3) {
    console.log('\n🎉 VERIFICATION SUCCESS: All 3 distinct historical encounters are preserved, fully intact, and rendered in order!');
  } else {
    console.error(`\n❌ MISMATCH: Expected 3 encounters, got ${timeline?.length}`);
    process.exit(1);
  }
}

seed3DistinctLongitudinalEncounters().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
