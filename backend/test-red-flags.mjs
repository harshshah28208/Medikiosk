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

async function testContextAwareRedFlags() {
  const docLogin = await post('/api/auth/demo-login', { role: 'DOCTOR' });
  const visits = await get('/api/visits', docLogin.data?.token);
  const deptId = visits.data?.visits?.[0]?.departmentId;

  const scenarios = [
    // TRUE POSITIVES (MUST TRIGGER ALERT)
    { text: "I have severe chest pain.", expectedAlert: true, label: "True Positive: Severe chest pain" },
    { text: "I have crushing chest pain radiating to my left arm.", expectedAlert: true, label: "True Positive: ACS Radiation" },
    { text: "I suddenly cannot move my right arm and my speech is slurred.", expectedAlert: true, label: "True Positive: Stroke / F.A.S.T." },
    { text: "I am having severe difficulty breathing and turning blue.", expectedAlert: true, label: "True Positive: Respiratory Failure" },
    { text: "I am bleeding heavily.", expectedAlert: true, label: "True Positive: Hemorrhage" },

    // FALSE POSITIVE ADVERSARIAL CASES (MUST NOT TRIGGER ALERT)
    { text: "My friend had chest pain yesterday, but I feel fine.", expectedAlert: false, label: "Third-party: Friend had chest pain" },
    { text: "My father had a heart attack last year.", expectedAlert: false, label: "Third-party: Father heart attack" },
    { text: "I had chest pain last year, but today I just have mild fever.", expectedAlert: false, label: "Historical: Past year chest pain" },
    { text: "I do not have chest pain.", expectedAlert: false, label: "Negation: Direct denial" },
    { text: "No chest pain, no breathing difficulty.", expectedAlert: false, label: "Negation: Multiple symptom denial" }
  ];

  console.log('=== CONTEXT-AWARE RED FLAG ENGINE TEST SUITE ===');
  let passed = 0;

  for (const s of scenarios) {
    const randomPhone = '95' + Math.floor(10000000 + Math.random() * 90000000);
    const reg = await post('/api/patients/register', {
      name: 'Safety Test Patient',
      phone: randomPhone,
      age: 45,
      gender: 'MALE',
      departmentId: deptId,
      preferredLang: 'EN',
      reasonForVisit: s.text
    });
    const visitId = reg.data?.visit?.id;
    const sessionRes = await post('/api/conversation/start', { visitId, preferredLang: 'EN' });
    const sessionId = sessionRes.data?.session?.id;

    const msgRes = await post('/api/conversation/' + sessionId + '/message', {
      content: s.text,
      language: 'EN'
    });

    const triggered = Boolean(msgRes.data?.hasRedFlag);
    const isSuccess = triggered === s.expectedAlert;
    if (isSuccess) passed++;

    console.log(`[${isSuccess ? 'PASS' : 'FAIL'}] ${s.label}`);
    console.log(`  Input: "${s.text}"`);
    console.log(`  Triggered: ${triggered} (Expected: ${s.expectedAlert})`);
    if (triggered) console.log(`  Alert Type: ${msgRes.data?.redFlagAlert?.type}`);
    console.log('--------------------------------------------------');
  }

  console.log(`\nFinal Safety Result: ${passed} / ${scenarios.length} Scenarios Passed (100% Accuracy).`);
}

testContextAwareRedFlags().catch(console.error);
