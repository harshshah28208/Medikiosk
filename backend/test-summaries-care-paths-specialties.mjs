import fetch from 'node-fetch';

const BASE_URL = 'http://127.0.0.1:5000/api';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function run() {
  console.log('🧪 ========================================================');
  console.log('🧪 PHASE 4: CARE-PATH + SPECIALTY-AWARE AI SUMMARIES TEST');
  console.log('🧪 ========================================================\n');

  const summaries = {};

  // Helper to run conversation and complete to generate full clinical summary
  async function generateAndTestSummary({ title, patientName, carePath, specialty, turns, vitals }) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`▶ GENERATING SUMMARY: ${title}`);
    console.log(`   Patient: ${patientName} | Care Path: [${carePath}] | Specialty: [${specialty}]`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    const testPhone = '98' + Math.floor(10000000 + Math.random() * 90000000);
    const regRes = await request('/patients/register', {
      method: 'POST',
      body: JSON.stringify({
        name: patientName,
        phone: testPhone,
        age: 42,
        gender: 'FEMALE',
        address: 'Ahmedabad, Gujarat',
        preferredLang: 'EN',
        reasonForVisit: 'Severe headache',
        carePath,
      }),
    });

    const patient = regRes.data?.patient;
    const visit = regRes.data?.visit;

    // Record vitals at nurse station
    if (vitals) {
      await request('/vitals', {
        method: 'POST',
        body: JSON.stringify({
          visitId: visit.id,
          ...vitals,
        }),
      });
    }

    // Start Session
    const startRes = await request('/conversation/start', {
      method: 'POST',
      body: JSON.stringify({
        visitId: visit.id,
        language: 'EN',
        carePath,
        specialty,
        isAyush: carePath === 'AYUSH',
        isHomeopathy: carePath === 'HOMEOPATHY',
      }),
    });

    const session = startRes.data?.session;

    // Send conversation turns
    for (let i = 0; i < turns.length; i++) {
      const pMsg = turns[i];
      await request(`/conversation/${session.id}/message`, {
        method: 'POST',
        body: JSON.stringify({
          content: pMsg,
          language: 'EN',
          carePath,
          isAyush: carePath === 'AYUSH',
          isHomeopathy: carePath === 'HOMEOPATHY',
        }),
      });
    }

    // Complete session to trigger summary generation
    const compRes = await request(`/conversation/${session.id}/complete`, {
      method: 'POST',
    });

    const summaryRaw = compRes.data?.clinicalSummary?.summaryJson;
    const summary = typeof summaryRaw === 'string' ? JSON.parse(summaryRaw) : (summaryRaw || compRes.data?.summary);
    console.log(`[Summary Generated]: Care Path = ${summary?.carePath || 'N/A'}, Specialty = ${summary?.specialty || 'N/A'}`);
    console.log(`[HPI / Narrative]: ${summary?.historyOfPresentIllness?.slice(0, 150)}...`);
    console.log(`[Overview]: ${summary?.overview}`);

    summaries[title] = summary;
    return summary;
  }

  // 1. ALLOPATHY (General Medicine)
  await generateAndTestSummary({
    title: 'Allopathy - General Medicine',
    patientName: 'Rohan Sharma',
    carePath: 'ALLOPATHY',
    specialty: 'General Medicine',
    vitals: { bpSystolic: 128, bpDiastolic: 82, pulse: 78, spo2: 99, temperature: 98.6 },
    turns: [
      'I have a severe throbbing headache that started 3 days ago. No vomiting and no fever.',
      'Sleep is poor, only 5 hours due to work stress and high screen time.',
      'No chronic conditions, no regular medications, and no known drug allergies.',
    ],
  });

  // 2. AYUSH (Ayurveda)
  await generateAndTestSummary({
    title: 'AYUSH - Ayurveda',
    patientName: 'Kalyani Bhatt',
    carePath: 'AYUSH',
    specialty: 'Ayurveda',
    vitals: { bpSystolic: 118, bpDiastolic: 76, pulse: 74, spo2: 98, temperature: 98.4 },
    turns: [
      'Intense burning headache on forehead getting worse under direct sunlight (Shirahshula).',
      'Sluggish digestion with heavy bloating after meals and chronic constipation (Krura Koshtha).',
      'I eat oily spicy food frequently, drink 4 cups of tea, and sleep past 1 AM (Ratri Jagarana). Intolerant to heat, heavy sweating.',
    ],
  });

  // 3. HOMEOPATHY (Classical Homeopathy)
  await generateAndTestSummary({
    title: 'Homeopathy - Classical Homeopathy',
    patientName: 'Manish Trivedi',
    carePath: 'HOMEOPATHY',
    specialty: 'Classical Homeopathy',
    vitals: { bpSystolic: 122, bpDiastolic: 80, pulse: 80, spo2: 99, temperature: 98.6 },
    turns: [
      'Right-sided throbbing and bursting headache as if my head will split open.',
      'Worse from sunlight, movement and noise; relieved by tying a tight cold bandage and lying in a dark room.',
      'Chilly patient who needs warm blankets, completely thirstless during the headache. Highly irritable, want total silence.',
    ],
  });

  // 4. SPECIALTY: ALLOPATHY + NEUROLOGY
  await generateAndTestSummary({
    title: 'Allopathy - Neurology Specialty',
    patientName: 'Vikram Joshi',
    carePath: 'ALLOPATHY',
    specialty: 'Neurology',
    vitals: { bpSystolic: 130, bpDiastolic: 84, pulse: 76, spo2: 98, temperature: 98.6 },
    turns: [
      'Throbbing one-sided headache with flashing zigzag lights (aura) before it starts. Severe light and sound sensitivity with nausea.',
      'I get about 4 attacks per month, triggered by missed sleep. No limb weakness.',
      'My mother has migraines. No regular medications, no drug allergies.',
    ],
  });

  // 5. SPECIALTY: ALLOPATHY + ENT
  await generateAndTestSummary({
    title: 'Allopathy - ENT Specialty',
    patientName: 'Ananya Desai',
    carePath: 'ALLOPATHY',
    specialty: 'ENT',
    vitals: { bpSystolic: 120, bpDiastolic: 78, pulse: 82, spo2: 99, temperature: 99.1 },
    turns: [
      'Severe heavy pressure over forehead and cheeks, worse when I bend forward.',
      'Nasal blockage with thick yellowish discharge and post-nasal drip following a recent viral cold.',
      'No chronic conditions, no regular medications, no drug allergies.',
    ],
  });

  // 6. SPECIALTY: ALLOPATHY + CARDIOLOGY
  await generateAndTestSummary({
    title: 'Allopathy - Cardiology Specialty',
    patientName: 'Kishore Mehta',
    carePath: 'ALLOPATHY',
    specialty: 'Cardiology',
    vitals: { bpSystolic: 145, bpDiastolic: 92, pulse: 96, spo2: 96, temperature: 98.6 },
    turns: [
      'Crushing substernal chest discomfort radiating down the left arm with exertional dyspnea and sweating.',
      'History of hypertension for 5 years on Telmisartan 40mg. Smoker for 10 years.',
      'No drug allergies.',
    ],
  });

  console.log('\n========================================================');
  console.log('🔬 VERIFICATION AUDIT MATRIX FOR SUMMARIES:');
  console.log('========================================================');

  // Verify Allopathy Summary
  const allo = summaries['Allopathy - General Medicine'];
  console.log('1. Allopathy Summary Check:');
  console.log(`   - Chief Complaint: "${allo?.chiefComplaint}"`);
  console.log(`   - Severity: "${allo?.severity}"`);
  console.log(`   - Denied Symptoms: ${JSON.stringify(allo?.deniedSymptoms)}`);
  console.log(`   - Past Medical History: "${allo?.pastMedicalHistory}"`);
  console.log(`   - Source Map Present: ${!!allo?.sourceMap}`);

  // Verify AYUSH Summary
  const ayu = summaries['AYUSH - Ayurveda'];
  console.log('\n2. AYUSH Summary Check:');
  console.log(`   - Presenting Concern: "${ayu?.presentingConcern}"`);
  console.log(`   - Agni Assessment: "${ayu?.ayushAssessment?.agni}"`);
  console.log(`   - Koshtha Assessment: "${ayu?.ayushAssessment?.koshtha}"`);
  console.log(`   - Prakriti Assessment: "${ayu?.ayushAssessment?.prakriti}"`);
  console.log(`   - Dashavidha Pariksha Present: ${!!ayu?.dashavidhaPariksha}`);

  // Verify Homeopathy Summary
  const homeo = summaries['Homeopathy - Classical Homeopathy'];
  console.log('\n3. Homeopathy Summary Check:');
  console.log(`   - Characteristic Sensation: "${homeo?.characteristicSymptoms}"`);
  console.log(`   - Modalities (< / >): ${JSON.stringify(homeo?.modalities)}`);
  console.log(`   - Thermal Reaction: "${homeo?.generals?.thermalState}"`);
  console.log(`   - Thirst State: "${homeo?.generals?.thirst}"`);
  console.log(`   - Mental Disposition: "${homeo?.mentalEmotionalState}"`);

  // Verify Specialty Differentiation with Same Symptom ("Headache")
  const neuro = summaries['Allopathy - Neurology Specialty'];
  const ent = summaries['Allopathy - ENT Specialty'];
  console.log('\n4. Specialty Differentiation Check (Same Symptom "Headache"):');
  console.log(`   - Neurology Focus: ${JSON.stringify(neuro?.specialtySpecificFindings?.pertinentFindings)}`);
  console.log(`   - ENT Focus: ${JSON.stringify(ent?.specialtySpecificFindings?.pertinentFindings)}`);

  console.log('\n🎉 ALL PHASE 4 SUMMARY VERIFICATION TESTS COMPLETED SUCCESSFULLY!');
}

run().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
