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

async function testFullDoctorConsultationFlow() {
  console.log('=== DOCTOR CONSULTATION & E-PRESCRIPTION CHAIN TEST ===');

  const docLogin = await post('/api/auth/demo-login', { role: 'DOCTOR' });
  const docToken = docLogin.data?.token;

  const visits = await get('/api/visits', docToken);
  const deptId = visits.data?.visits?.[0]?.departmentId;

  // 1. Create fresh patient
  const randomPhone = '94' + Math.floor(10000000 + Math.random() * 90000000);
  const reg = await post('/api/patients/register', {
    name: 'Ramesh Patel (Consultation Test)',
    phone: randomPhone,
    age: 48,
    gender: 'MALE',
    departmentId: deptId,
    preferredLang: 'GU',
    reasonForVisit: 'Persistent dry cough and throat irritation for 5 days'
  });
  const patientId = reg.data?.patient?.id;
  const visitId = reg.data?.visit?.id;

  // 2. Record Consent
  const consentRes = await post('/api/consent', {
    patientId,
    visitId,
    consented: true,
    type: 'GENERAL_TREATMENT',
    method: 'TOUCH_SCREEN'
  });
  console.log('1. Consent Saved:', consentRes.status === 201, consentRes.data?.consent?.consentType);

  // 3. Nurse Vitals
  const nurseLogin = await post('/api/auth/demo-login', { role: 'NURSE' });
  const vitalsRes = await post('/api/vitals', {
    visitId,
    patientId,
    bpSystolic: 124,
    bpDiastolic: 82,
    pulse: 78,
    spo2: 98,
    temperature: 98.4,
    weight: 70,
    height: 170,
    painScore: 2,
    notes: 'Throat slightly red, chest clear'
  }, nurseLogin.data?.token);
  console.log('2. Vitals Saved:', vitalsRes.status === 201);

  // 4. Doctor signs consultation with diagnosis array and multiple medications
  const consultRes = await post('/api/doctor/consultation', {
    visitId,
    patientId,
    clinicalNotes: 'Pharynx mildly erythematous. Lungs clear to auscultation bilaterally.',
    impression: 'Acute Viral Pharyngitis & Upper Respiratory Tract Infection',
    diagnosis: ['Acute Pharyngitis', 'Viral URI'],
    treatmentPlan: 'Warm saline gargles thrice daily, steam inhalation, throat lozenges',
    prescriptions: [
      {
        medicineName: 'Amoxicillin + Clavulanic Acid 625mg',
        dosage: '1 tab',
        frequency: 'Twice daily',
        duration: '5 days',
        instructions: 'After meals'
      },
      {
        medicineName: 'Levocetirizine 5mg',
        dosage: '1 tab',
        frequency: 'Once daily at bedtime',
        duration: '5 days',
        instructions: 'At night'
      },
      {
        medicineName: 'Paracetamol 650mg (SOS)',
        dosage: '1 tab',
        frequency: 'As needed for fever/bodyache',
        duration: '3 days',
        instructions: 'After meals'
      }
    ]
  }, docToken);

  console.log('3. Consultation & Prescription API Status:', consultRes.status);
  console.log('   Consultation ID:', consultRes.data?.consultation?.id);
  console.log('   Diagnosis in DB:', consultRes.data?.consultation?.diagnosis);
  console.log('   Prescription Items Count:', consultRes.data?.prescription?.items?.length);

  // 5. Patient logs in and verifies final prescription
  const patLogin = await post('/api/auth/demo-login', { role: 'PATIENT' });
  const timeline = await get('/api/documents/timeline/' + patientId, patLogin.data?.token);
  console.log('4. Patient Timeline Total Records:', timeline.data?.totalEvents);
  console.log('   Prescription Event in Timeline:', timeline.data?.timeline?.find(e => e.type === 'PRESCRIPTION')?.description);
}

testFullDoctorConsultationFlow().catch(console.error);
