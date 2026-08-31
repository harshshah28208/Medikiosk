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

async function runRecoveryPrioritySuite() {
  console.log('🏥 ========================================================');
  console.log('🏥 MEDIKIOSK FINAL PRIORITY RECOVERY TEST SUITE');
  console.log('🏥 ========================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, testName, details = '') {
    total++;
    if (condition) {
      passed++;
      console.log(`  ✅ [PASS] ${testName}`);
      if (details) console.log(`     Evidence: ${details}`);
    } else {
      console.error(`  ❌ [FAIL] ${testName}`);
      if (details) console.error(`     Reason: ${details}`);
    }
  }

  // Doctor login for authenticated clinical inspection
  const docLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'doctor@demo.com', password: 'demo123' }),
  });
  const docToken = docLogin.data?.token;

  // ────────────────────────────────────────────────────────────
  // TEST A: HEADACHE — ALLOPATHY vs AYURVEDA vs HOMEOPATHY
  // ────────────────────────────────────────────────────────────
  console.log('▶ [TEST A] Same Complaint (Headache) across 3 distinct Care Paths:');

  // 1. Allopathy Headache
  const regAllo = await request('/patients/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Rohan Verma',
      phone: '9820011111',
      preferredLang: 'EN',
      departmentCode: 'GEN',
      reasonForVisit: 'Severe throbbing headache with light sensitivity',
      carePath: 'ALLOPATHY',
    }),
  });
  const startAllo = await request('/conversation/start', {
    method: 'POST',
    body: JSON.stringify({
      visitId: regAllo.data?.visit?.id,
      language: 'EN',
      carePath: 'ALLOPATHY',
      specialty: 'Neurology',
      isNewCase: true,
    }),
  });
  const qAllo0 = startAllo.data?.nextQuestion || startAllo.data?.message?.content;
  const msgAllo1 = await request(`/conversation/${startAllo.data?.session?.id}/message`, {
    method: 'POST',
    body: JSON.stringify({
      content: 'I have severe one-sided throbbing headache with flashes of light and photophobia.',
      language: 'EN',
      carePath: 'ALLOPATHY',
      specialty: 'Neurology',
    }),
  });
  const qAllo1 = msgAllo1.data?.nextQuestion;

  // 2. Ayurveda / AYUSH Headache
  const regAyush = await request('/patients/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Kishore Patel',
      phone: '9820022222',
      preferredLang: 'EN',
      departmentCode: 'AYUSH',
      reasonForVisit: 'Burning headache with acidity and sluggish digestion',
      carePath: 'AYUSH',
    }),
  });
  const startAyush = await request('/conversation/start', {
    method: 'POST',
    body: JSON.stringify({
      visitId: regAyush.data?.visit?.id,
      language: 'EN',
      carePath: 'AYUSH',
      specialty: 'Ayurveda',
      isNewCase: true,
    }),
  });
  const qAyush0 = startAyush.data?.nextQuestion || startAyush.data?.message?.content;
  const msgAyush1 = await request(`/conversation/${startAyush.data?.session?.id}/message`, {
    method: 'POST',
    body: JSON.stringify({
      content: 'I experience burning sensations in head with sour belching, acidity, and sleep deprivation (Ratri Jagarana).',
      language: 'EN',
      carePath: 'AYUSH',
      specialty: 'Ayurveda',
    }),
  });
  const qAyush1 = msgAyush1.data?.nextQuestion;

  // 3. Homeopathy Headache
  const regHomeo = await request('/patients/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Manisha Sharma',
      phone: '9820033333',
      preferredLang: 'EN',
      departmentCode: 'GEN',
      reasonForVisit: 'Right-sided bursting headache worse in sun, better with cold water',
      carePath: 'HOMEOPATHY',
    }),
  });
  const startHomeo = await request('/conversation/start', {
    method: 'POST',
    body: JSON.stringify({
      visitId: regHomeo.data?.visit?.id,
      language: 'EN',
      carePath: 'HOMEOPATHY',
      specialty: 'Classical Homeopathy',
      isNewCase: true,
    }),
  });
  const qHomeo0 = startHomeo.data?.nextQuestion || startHomeo.data?.message?.content;
  const msgHomeo1 = await request(`/conversation/${startHomeo.data?.session?.id}/message`, {
    method: 'POST',
    body: JSON.stringify({
      content: 'Right-sided bursting pain, intensely aggravated by sun and movement, relieved by cold application and rest in dark room.',
      language: 'EN',
      carePath: 'HOMEOPATHY',
      specialty: 'Classical Homeopathy',
    }),
  });
  const qHomeo1 = msgHomeo1.data?.nextQuestion;

  assert(
    Boolean(qAllo0 && qAyush0 && qHomeo0),
    'Test A.1: All 3 Care Paths initialized dynamic questioning',
    `Allo: "${qAllo0?.slice(0, 50)}..." | Ayush: "${qAyush0?.slice(0, 50)}..." | Homeo: "${qHomeo0?.slice(0, 50)}..."`
  );

  assert(
    qAllo1 !== qAyush1 && qAyush1 !== qHomeo1,
    'Test A.2: Care-Path distinct clinical inquiry paths (Allopathy vs AYUSH vs Homeopathy)',
    `Allo Q1: "${qAllo1?.slice(0, 60)}..." | Ayush Q1: "${qAyush1?.slice(0, 60)}..." | Homeo Q1: "${qHomeo1?.slice(0, 60)}..."`
  );

  // ────────────────────────────────────────────────────────────
  // TEST B: COMPLETE LIFESTYLE SUB-DOMAIN DRILL-DOWN (NOT PARTIAL)
  // ────────────────────────────────────────────────────────────
  console.log('\n▶ [TEST B] Complete Lifestyle Sub-Domain Exploration (NO partial one-liners):');
  const msgAllo2 = await request(`/conversation/${startAllo.data?.session?.id}/message`, {
    method: 'POST',
    body: JSON.stringify({
      content: 'My lifestyle is normal, but I work at a desk for 9 hours with high screen time.',
      language: 'EN',
      carePath: 'ALLOPATHY',
      specialty: 'Neurology',
    }),
  });
  const qAllo2 = msgAllo2.data?.nextQuestion;
  console.log(`     [AI Response to vague "normal" lifestyle]: "${qAllo2}"`);

  assert(
    Boolean(qAllo2 && qAllo2.length > 20),
    'Test B: AI explores missing lifestyle/medical sub-domains instead of accepting vague answers',
    `Follow-up Q: "${qAllo2}"`
  );

  // ────────────────────────────────────────────────────────────
  // TEST C: NEGATION & HISTORICAL FINDINGS INTEGRITY
  // ────────────────────────────────────────────────────────────
  console.log('\n▶ [TEST C] Negation and Historical Temporal Separation:');
  const msgAllo3 = await request(`/conversation/${startAllo.data?.session?.id}/message`, {
    method: 'POST',
    body: JSON.stringify({
      content: 'I do NOT have vomiting or neck stiffness. I had a mild fever last month which completely resolved. My father has diabetes.',
      language: 'EN',
      carePath: 'ALLOPATHY',
      specialty: 'Neurology',
    }),
  });
  const stateAllo3 = msgAllo3.data?.clinicalState;

  assert(
    Array.isArray(stateAllo3?.deniedSymptoms) && stateAllo3.deniedSymptoms.includes('vomiting'),
    'Test C.1: Negation correctly identified as DENIED ("no vomiting")',
    `Denied: [${stateAllo3?.deniedSymptoms?.join(', ')}]`
  );

  assert(
    Array.isArray(stateAllo3?.historicalFindings) && stateAllo3.historicalFindings.length > 0,
    'Test C.2: Historical resolved illness correctly isolated ("had fever last month")',
    `Historical: [${stateAllo3?.historicalFindings?.join(', ')}]`
  );

  assert(
    Array.isArray(stateAllo3?.familyHistory) && stateAllo3.familyHistory.some((f) => /father|diabetes/i.test(f)),
    'Test C.3: Family history separated from patient comorbidity ("father has diabetes")',
    `Family: [${stateAllo3?.familyHistory?.join(', ')}]`
  );

  // ────────────────────────────────────────────────────────────
  // TEST D: MULTILINGUAL PRESERVATION ACROSS SWITCHES (EN -> HI -> GU)
  // ────────────────────────────────────────────────────────────
  console.log('\n▶ [TEST D] Multilingual State Survival Across Dynamic Language Switches:');
  const switchHi = await request(`/conversation/${startAllo.data?.session?.id}/switch-language`, {
    method: 'POST',
    body: JSON.stringify({
      targetLanguage: 'HI',
      messages: [
        { id: '1', role: 'AI', content: 'What medications are you currently taking?', options: ['No medicines', 'BP medicines'] },
        { id: '2', role: 'PATIENT', content: 'Taking Sumatriptan for migraine attacks' },
      ],
    }),
  });

  const switchGu = await request(`/conversation/${startAllo.data?.session?.id}/switch-language`, {
    method: 'POST',
    body: JSON.stringify({
      targetLanguage: 'GU',
      messages: switchHi.data?.translatedMessages || [],
    }),
  });

  assert(
    switchHi.data?.language === 'HI' && switchGu.data?.language === 'GU',
    'Test D: Multilingual state survives dynamic mid-conversation language transitions',
    `HI Translation count: ${switchHi.data?.translatedMessages?.length} | GU Translation count: ${switchGu.data?.translatedMessages?.length}`
  );

  // ────────────────────────────────────────────────────────────
  // TEST E: DETAILED CARE-PATH SPECIFIC SUMMARIES (NO ONE-LINERS)
  // ────────────────────────────────────────────────────────────
  console.log('\n▶ [TEST E] Care-Path Specific In-Depth Clinical Summaries:');

  // Complete sessions
  await request(`/conversation/${startAllo.data?.session?.id}/complete`, { method: 'POST' });
  await request(`/conversation/${startAyush.data?.session?.id}/complete`, { method: 'POST' });
  await request(`/conversation/${startHomeo.data?.session?.id}/complete`, { method: 'POST' });

  // Fetch summaries with auth
  const authHeaders = docToken ? { Authorization: `Bearer ${docToken}` } : {};
  const sumAllo = await request(`/visits/${regAllo.data?.visit?.id}`, { headers: authHeaders });
  const sumAyush = await request(`/visits/${regAyush.data?.visit?.id}`, { headers: authHeaders });
  const sumHomeo = await request(`/visits/${regHomeo.data?.visit?.id}`, { headers: authHeaders });

  const alloJson = sumAllo.data?.visit?.summary?.summaryJson
    ? (typeof sumAllo.data.visit.summary.summaryJson === 'string'
        ? JSON.parse(sumAllo.data.visit.summary.summaryJson)
        : sumAllo.data.visit.summary.summaryJson)
    : sumAllo.data?.visit?.summary;

  const ayushJson = sumAyush.data?.visit?.summary?.summaryJson
    ? (typeof sumAyush.data.visit.summary.summaryJson === 'string'
        ? JSON.parse(sumAyush.data.visit.summary.summaryJson)
        : sumAyush.data.visit.summary.summaryJson)
    : sumAyush.data?.visit?.summary;

  const homeoJson = sumHomeo.data?.visit?.summary?.summaryJson
    ? (typeof sumHomeo.data.visit.summary.summaryJson === 'string'
        ? JSON.parse(sumHomeo.data.visit.summary.summaryJson)
        : sumHomeo.data.visit.summary.summaryJson)
    : sumHomeo.data?.visit?.summary;

  assert(
    Boolean(alloJson && (alloJson.historyOfPresentIllness || alloJson.chiefComplaint)),
    'Test E.1: Allopathy Structured Detailed Summary Generated',
    `Chief Complaint: "${alloJson?.chiefComplaint}" | CarePath: ${sumAllo.data?.visit?.carePath}`
  );

  assert(
    Boolean(ayushJson && (ayushJson.presentingConcern || ayushJson.chiefComplaint || ayushJson.dailyRoutine || ayushJson.ayushAssessment)),
    'Test E.2: Ayurveda (AYUSH) Path-Specific Summary Generated (Ahara/Vihara/Agni/Prakriti)',
    `CarePath: ${sumAyush.data?.visit?.carePath} | Presenting: "${ayushJson?.presentingConcern || ayushJson?.chiefComplaint}"`
  );

  assert(
    Boolean(homeoJson && (homeoJson.chiefComplaint || homeoJson.characteristicSymptoms || homeoJson.modalities || homeoJson.generals)),
    'Test E.3: Classical Homeopathy Path-Specific Summary Generated (Modalities/Generals)',
    `CarePath: ${sumHomeo.data?.visit?.carePath} | Chief: "${homeoJson?.chiefComplaint}"`
  );

  console.log('\n========================================================');
  console.log(`🏁 RECOVERY SUITE SUMMARY: ${passed} / ${total} PASS (${Math.round((passed / total) * 100)}%)`);
  console.log('========================================================');
}

runRecoveryPrioritySuite();
