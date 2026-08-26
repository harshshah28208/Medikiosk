import http from 'http';

function post(path, payload, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
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

async function testSinglePatientTrace() {
  console.log('=== MULTI-STAGE SINGLE PATIENT TRACE (PATIENT ALPHA) ===');

  const docLogin = await post('/api/auth/demo-login', { role: 'DOCTOR' });
  const nurseLogin = await post('/api/auth/demo-login', { role: 'NURSE' });
  const triageLogin = await post('/api/auth/demo-login', { role: 'TRIAGE_STAFF' });
  const adminLogin = await post('/api/auth/demo-login', { role: 'HOSPITAL_ADMIN' });

  const docToken = docLogin.data?.token;
  const nurseToken = nurseLogin.data?.token;
  const triageToken = triageLogin.data?.token;
  const adminToken = adminLogin.data?.token;

  const visits = await get('/api/visits', docToken);
  const deptId = visits.data?.visits?.[0]?.departmentId;

  // 1. Register Patient
  const randomPhone = '93' + Math.floor(10000000 + Math.random() * 90000000);
  const reg = await post('/api/patients/register', {
    name: 'Kavita Dave (Full Trace)',
    phone: randomPhone,
    age: 39,
    gender: 'FEMALE',
    departmentId: deptId,
    preferredLang: 'GU',
    reasonForVisit: 'Severe migraine headache with visual blurriness'
  });
  const patientId = reg.data?.patient?.id;
  const visitId = reg.data?.visit?.id;
  const tokenNum = reg.data?.visit?.token;

  console.log('1. Registration -> Patient ID:', patientId, '| Visit ID:', visitId, '| Token:', tokenNum);

  // 2. Consent
  const consent = await post('/api/consent', {
    patientId,
    visitId,
    consented: true,
    type: 'GENERAL_TREATMENT',
    method: 'TOUCH_SCREEN'
  });
  console.log('2. Consent -> ID:', consent.data?.consent?.id, '| Linked Patient:', consent.data?.consent?.patientId === patientId);

  // 3. AI Intake Session
  const sessionRes = await post('/api/conversation/start', { visitId, preferredLang: 'GU' });
  const sessionId = sessionRes.data?.session?.id;
  
  // Turn 1: Gujarati
  const t1 = await post('/api/conversation/' + sessionId + '/message', {
    content: 'મને સવારથી માથામાં અતિશય દુખાવો છે અને આંખે ઝાંખપ આવે છે.',
    language: 'GU'
  });
  // Turn 2: Switch to Hindi mid-session
  const t2 = await post('/api/conversation/' + sessionId + '/message', {
    content: 'उल्टी जैसा भी लग रहा है और रोशनी सहन नहीं हो रही।',
    language: 'HI'
  });
  // Turn 3: Switch to English mid-session
  const t3 = await post('/api/conversation/' + sessionId + '/message', {
    content: 'No fever or neck stiffness, just severe throbbing headache.',
    language: 'EN'
  });

  const compRes = await post('/api/conversation/' + sessionId + '/complete', {});
  console.log('3. AI Intake -> Session ID:', sessionId, '| Multilingual Turns:', t3.data?.clinicalState?.turnsCompleted, '| Finalized:', compRes.status === 200);

  // 4. Nurse Vitals
  const vitalsRes = await post('/api/vitals', {
    visitId,
    patientId,
    bpSystolic: 130,
    bpDiastolic: 86,
    pulse: 82,
    spo2: 99,
    temperature: 98.2,
    weight: 62,
    height: 162,
    painScore: 7,
    notes: 'Photophobia noted, quiet room recommended'
  }, nurseToken);
  console.log('4. Nurse Vitals -> ID:', vitalsRes.data?.vital?.id, '| Matched Visit:', vitalsRes.data?.vital?.visitId === visitId);

  // 5. Doctor Signs
  const docCons = await post('/api/doctor/consultation', {
    visitId,
    patientId,
    clinicalNotes: 'Cranial nerves intact. Pupils equal & reactive. Fundoscopy normal.',
    impression: 'Acute Migraine with Aura',
    diagnosis: 'Migraine with visual aura',
    treatmentPlan: 'Dark quiet room, oral triptan, NSAID, adequate hydration',
    prescriptions: [
      { medicineName: 'Sumatriptan 50mg', dosage: '1 tab', frequency: 'Stat at onset of headache', duration: '3 days', instructions: 'Take with water' },
      { medicineName: 'Naproxen 500mg', dosage: '1 tab', frequency: 'Twice daily with food', duration: '3 days', instructions: 'After meals' },
      { medicineName: 'Domperidone 10mg', dosage: '1 tab', frequency: 'Before food', duration: '3 days', instructions: '30 mins before meals' }
    ]
  }, docToken);
  console.log('5. Doctor -> Consultation ID:', docCons.data?.consultation?.id, '| Prescriptions Signed:', docCons.data?.prescription?.items?.length);

  // 6. Longitudinal Timeline
  const patLogin = await post('/api/auth/demo-login', { role: 'PATIENT' });
  const timeline = await get('/api/documents/timeline/' + patientId, patLogin.data?.token);
  console.log('6. Patient Timeline -> Total Aggregated Events:', timeline.data?.totalEvents);

  // 7. Audit Log
  const auditLogs = await get('/api/admin/audit-logs?page=1&limit=50', adminToken);
  const patientAudits = auditLogs.data?.logs?.filter(l => l.details?.includes(patientId) || l.details?.includes(visitId));
  console.log('7. Audit Trail -> Events Recorded for this patient:', patientAudits?.length);

  // 8. Admin Analytics
  const adminDash = await get('/api/admin/dashboard', adminToken);
  console.log('8. Admin Analytics -> Patients Today:', adminDash.data?.metrics?.totalPatientsToday, '| Active Visits:', adminDash.data?.metrics?.activeVisitsCount);
}

testSinglePatientTrace().catch(console.error);
