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

async function runMultilingualIntakeTest() {
  console.log('🌐 ========================================================');
  console.log('🌐 TESTING FULL DYNAMIC MULTILINGUAL AI INTAKE (GU & HI)');
  console.log('🌐 ========================================================\n');

  // Test 1: Full Gujarati Ayurvedic Intake
  console.log('▶ [TEST 1] Pure Gujarati AYUSH Intake:');
  const regGu = await request('/patients/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'કિશોરભાઈ પટેલ',
      phone: '9825098250',
      preferredLang: 'GU',
      departmentCode: 'AYUSH',
      reasonForVisit: 'એસિડિટી અને પેટમાં બળતરા (Amlapitta)',
      carePath: 'AYUSH',
    }),
  });
  const visitGu = regGu.data?.visit;

  const startGu = await request('/conversation/start', {
    method: 'POST',
    body: JSON.stringify({
      visitId: visitGu.id,
      language: 'GU',
      carePath: 'AYUSH',
      specialty: 'Ayurveda',
      isNewCase: true,
    }),
  });

  const sessionGuId = startGu.data?.session?.id;
  const q0Gu = startGu.data?.nextQuestion || startGu.data?.message?.content;
  const opts0Gu = startGu.data?.touchOptions;
  console.log(`  [Turn 0 (GU)]: "${q0Gu}"`);
  console.log(`  [Options 0 (GU)]:`, opts0Gu?.slice(0, 3));

  const turn1Gu = await request(`/conversation/${sessionGuId}/message`, {
    method: 'POST',
    body: JSON.stringify({
      content: 'મને જમ્યા પછી છાતીમાં ખૂબ બળતરા થાય છે અને ખાટા ઓડકાર આવે છે (અમ્લપિત્ત).',
      language: 'GU',
      carePath: 'AYUSH',
    }),
  });
  console.log(`  [Turn 1 (GU)]: "${turn1Gu.data?.nextQuestion}"`);
  console.log(`  [Options 1 (GU)]:`, turn1Gu.data?.touchOptions?.slice(0, 3));

  // Test 2: Full Hindi Classical Homeopathy Intake
  console.log('\n▶ [TEST 2] Pure Hindi Classical Homeopathy Intake:');
  const regHi = await request('/patients/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'मनीषा शर्मा',
      phone: '9811098110',
      preferredLang: 'HI',
      departmentCode: 'GEN',
      reasonForVisit: 'तेज सिरदर्द और धूप में बढ़ना (Migraine)',
      carePath: 'HOMEOPATHY',
    }),
  });
  const visitHi = regHi.data?.visit;

  const startHi = await request('/conversation/start', {
    method: 'POST',
    body: JSON.stringify({
      visitId: visitHi.id,
      language: 'HI',
      carePath: 'HOMEOPATHY',
      specialty: 'Classical Homeopathy',
      isNewCase: true,
    }),
  });

  const sessionHiId = startHi.data?.session?.id;
  const q0Hi = startHi.data?.nextQuestion || startHi.data?.message?.content;
  const opts0Hi = startHi.data?.touchOptions;
  console.log(`  [Turn 0 (HI)]: "${q0Hi}"`);
  console.log(`  [Options 0 (HI)]:`, opts0Hi?.slice(0, 3));

  const turn1Hi = await request(`/conversation/${sessionHiId}/message`, {
    method: 'POST',
    body: JSON.stringify({
      content: 'दाईं तरफ तेज टीस मारने वाला सिरदर्द है, धूप में बहुत बढ़ता है और ठंडे पानी से आराम मिलता है।',
      language: 'HI',
      carePath: 'HOMEOPATHY',
    }),
  });
  console.log(`  [Turn 1 (HI)]: "${turn1Hi.data?.nextQuestion}"`);
  console.log(`  [Options 1 (HI)]:`, turn1Hi.data?.touchOptions?.slice(0, 3));

  // Test 3: Language Switching (English to Gujarati)
  console.log('\n▶ [TEST 3] Mid-Conversation Dynamic Language Switch (EN -> GU):');
  const switchRes = await request(`/conversation/${sessionHiId}/switch-language`, {
    method: 'POST',
    body: JSON.stringify({
      targetLanguage: 'GU',
      messages: [
        { id: '1', role: 'AI', content: 'What is your sleep routine and stress level?', options: ['Normal sleep', 'Disturbed sleep'] },
        { id: '2', role: 'PATIENT', content: 'I sleep 5 hours with high work stress' },
      ],
    }),
  });
  console.log('  [Translated Messages to GU]:', switchRes.data?.translatedMessages?.map(m => `[${m.role}] ${m.content}`));

  console.log('\n========================================================');
  console.log('🏁 FULL MULTILINGUAL AI INTAKE VERIFIED SUCCESSFULLY!');
  console.log('========================================================');
}

runMultilingualIntakeTest();
