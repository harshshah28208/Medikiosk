import http from 'http';

function post(path: string, data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch(e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function verifyLanguageConversion() {
  const randomPhone = '98' + Math.floor(10000000 + Math.random() * 90000000);
  console.log('1. Registering unique patient with phone:', randomPhone);
  const reg = await post('/api/patients/register', {
    name: 'Ramesh Patel',
    phone: randomPhone,
    age: 28,
    gender: 'MALE',
    preferredLang: 'EN',
    departmentId: 'a2e79414-0be8-4925-bfa5-b5737cb4f8f8',
    reasonForVisit: 'Severe acne and pimples on face'
  });
  console.log('Registration status:', reg.status);
  const visitId = reg.body?.visit?.id;
  console.log('Created visitId:', visitId);

  console.log('\n2. Starting Conversation in EN...');
  const conv = await post('/api/conversation/start', { visitId, language: 'EN' });
  const sessionId = conv.body?.session?.id;
  const q0 = conv.body?.message?.content;
  console.log('Session ID:', sessionId);
  console.log('AI Greeting (EN):', q0);

  console.log('\n3. Patient Responds: "I have red pimples with pus and itching for 4 days"');
  const msg1 = await post('/api/conversation/' + sessionId + '/message', {
    content: 'I have red pimples with pus and itching for 4 days',
    language: 'EN'
  });
  const q1 = msg1.body?.nextQuestion;
  console.log('AI Follow-up Question (EN):', q1);
  console.log('Touch Options (EN):', msg1.body?.touchOptions);

  console.log('\n=========================================');
  console.log('4. TEST LIVE TRANSLATION TO GUJARATI (GU)');
  console.log('=========================================');
  const switchGu = await post('/api/conversation/' + sessionId + '/switch-language', {
    targetLanguage: 'GU',
    messages: [
      { id: '1', role: 'AI', content: q0, timestamp: '12:00' },
      { id: '2', role: 'PATIENT', content: 'I have red pimples with pus and itching for 4 days', timestamp: '12:01' },
      { id: '3', role: 'AI', content: q1, timestamp: '12:01' }
    ]
  });
  console.log('Translated Chat History in GUJARATI:');
  switchGu.body?.translatedMessages?.forEach((m: any, idx: number) => console.log('  [' + m.role + ' ' + idx + ']:', m.content));
  console.log('Touch Options (GU):', switchGu.body?.touchOptions);

  console.log('\n=====================================');
  console.log('5. TEST LIVE TRANSLATION TO HINDI (HI)');
  console.log('=====================================');
  const switchHi = await post('/api/conversation/' + sessionId + '/switch-language', {
    targetLanguage: 'HI',
    messages: switchGu.body?.translatedMessages
  });
  console.log('Translated Chat History in HINDI:');
  switchHi.body?.translatedMessages?.forEach((m: any, idx: number) => console.log('  [' + m.role + ' ' + idx + ']:', m.content));
  console.log('Touch Options (HI):', switchHi.body?.touchOptions);
}

verifyLanguageConversion().catch(console.error);
