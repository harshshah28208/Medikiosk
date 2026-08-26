import http from 'http';

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

async function runFreshSessionAITests() {
  const docLogin = await post('/api/auth/demo-login', { role: 'DOCTOR' });
  const visits = await get('/api/visits', docLogin.data?.token);
  const deptId = visits.data?.visits?.[0]?.departmentId;

  const testCases = [
    { code: 'TEST A', input: "I have been feeling unusually tired and weak for three weeks.", lang: 'EN' },
    { code: 'TEST B', input: "My ears have been hurting since yesterday.", lang: 'EN' },
    { code: 'TEST C', input: "I feel dizzy whenever I stand up.", lang: 'EN' },
    { code: 'TEST D', input: "I have been having trouble sleeping recently.", lang: 'EN' },
    { code: 'TEST E', input: "મને ત્રણ દિવસથી ગળામાં દુખાવો છે.", lang: 'GU' },
    { code: 'TEST F', input: "मुझे चक्कर आ रहे हैं।", lang: 'HI' }
  ];

  for (const tc of testCases) {
    const randomPhone = '97' + Math.floor(10000000 + Math.random() * 90000000);
    const reg = await post('/api/patients/register', {
      name: 'Patient ' + tc.code,
      phone: randomPhone,
      age: 40,
      gender: 'MALE',
      departmentId: deptId,
      preferredLang: tc.lang,
      reasonForVisit: tc.input
    });
    const visitId = reg.data?.visit?.id;
    const sessionRes = await post('/api/conversation/start', { visitId, preferredLang: tc.lang });
    const sessionId = sessionRes.data?.session?.id;

    const msgRes = await post('/api/conversation/' + sessionId + '/message', {
      content: tc.input,
      language: tc.lang
    });

    console.log('========================================');
    console.log('TEST CODE:', tc.code);
    console.log('Input:', tc.input);
    console.log('Detected Language:', tc.lang);
    console.log('Extracted Chief Complaint:', msgRes.data?.clinicalState?.chiefComplaint);
    console.log('Extracted Symptoms:', JSON.stringify(msgRes.data?.clinicalState?.symptoms));
    console.log('AI Response (Next Question):', msgRes.data?.nextQuestion);
    console.log('Touch Options:', JSON.stringify(msgRes.data?.touchOptions));
    console.log('Session Persisted:', !!msgRes.data?.aiMessage?.id);
  }
}

runFreshSessionAITests().catch(console.error);
