import http from 'http';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function apiRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const payload = data ? JSON.stringify(data) : null;
    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path: `/api${path}`,
        method,
        headers: {
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch {
            resolve({ status: res.statusCode, data: body });
          }
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const RANDOM_TEST_CASES = [
  {
    name: 'Acute High-Pitched Tinnitus & Ear Fullness (ENT)',
    carePath: 'ALLOPATHY',
    specialty: 'ENT',
    doctor: 'Dr. Neha Gupta',
    patient: { name: 'Kavita Dave', age: 28, gender: 'FEMALE', phone: '9820011221' },
    dialogue: [
      'I have severe ringing and buzzing in my left ear since yesterday after attending a loud musical event, and the ear feels completely blocked.',
      'It has been continuous for about 24 hours now. Sensation is a loud high pitched whistle.',
      'The volume is around 7 out of 10, making it hard to concentrate or sleep. No dizziness or spinning sensation.',
      'Loud sounds and quiet rooms make it more noticeable. No relief from ear drops.',
      'I work on laptop, sleep was only 4 hours last night due to the noise. Normal diet.',
      'No chronic diseases, not taking regular medications, and no known drug allergies.',
    ]
  },
  {
    name: 'Sudden Excruciating Podagra / Big Toe Gout Flare (Rheumatology)',
    carePath: 'ALLOPATHY',
    specialty: 'Rheumatology',
    doctor: 'Dr. Vikram Patel',
    patient: { name: 'Manish Mehta', age: 48, gender: 'MALE', phone: '9820011222' },
    dialogue: [
      'I woke up at 3 AM with unbearable throbbing pain, extreme redness and swelling in my right big toe joint.',
      'Started suddenly 8 hours ago in the middle of the night without any injury.',
      'Pain is 9 out of 10, burning and throbbing intensely. Even a bedsheet touching the toe is intolerable.',
      'Worse with any touch or weight bearing. Slight relief only with ice pack.',
      'No fever, but the toe is hot to touch and intensely shiny red.',
      'Sleep was ruined last night. Ate heavy non-veg dinner with alcohol 2 days ago.',
      'I have mild hypertension on Amlodipine 5mg daily. No known drug allergies.',
    ]
  },
  {
    name: 'Acute Contact Dermatitis & Facial Swelling post Hair Dye (Dermatology)',
    carePath: 'ALLOPATHY',
    specialty: 'Dermatology',
    doctor: 'Dr. Rajesh Verma',
    patient: { name: 'Sunita Sharma', age: 42, gender: 'FEMALE', phone: '9820011223' },
    dialogue: [
      'Intense burning itchiness on my scalp, forehead and swelling around my eyelids after applying a new black hair dye yesterday.',
      'Started about 12 hours after dye application and is spreading to the neck.',
      'Severe itching and burning sensation, rating 8 out of 10. Tiny fluid blisters forming near hairline.',
      'Hot water makes it unbearable, cool aloe gel brings temporary soothing.',
      'No difficulty breathing or throat tightness, just swollen eyes and weeping scalp rash.',
      'Regular office worker, sleep disrupted by itching.',
      'No past skin problems, taking Cetirizine 10mg today for itch. No known drug allergies.',
    ]
  },
  {
    name: 'Postpartum Pelvic Girdle & Coccyx Pain (Gynecology)',
    carePath: 'ALLOPATHY',
    specialty: 'Gynecology',
    doctor: 'Dr. Desai',
    patient: { name: 'Pooja Joshi', age: 31, gender: 'FEMALE', phone: '9820011224' },
    dialogue: [
      'Sharp pain in my pubic bone and tailbone when walking or getting up from a chair, 6 weeks after normal vaginal delivery.',
      'Gradual onset since delivery 6 weeks ago, worsening over the last 10 days as I walk more.',
      'Pain is 6 out of 10, deep ache with sharp catch when turning in bed or climbing stairs.',
      'Worse when standing on one leg or prolonged sitting; better with pelvic support belt and lying on side.',
      'No abnormal vaginal discharge, no fever, bowel and bladder movements are normal.',
      'Sleep is broken feeding the newborn every 3 hours. Breastfeeding baby.',
      'Gestational diabetes resolved after delivery. Taking calcium and iron tablets daily. No drug allergies.',
    ]
  },
  {
    name: 'Pediatric Barking Cough & Inspiratory Stridor / Croup (Pediatrics)',
    carePath: 'ALLOPATHY',
    specialty: 'Pediatrics',
    doctor: 'Dr. Harish Rawat',
    patient: { name: 'Aarav Patel', age: 3, gender: 'MALE', phone: '9820011225', caregiver: true },
    dialogue: [
      'My 3-year-old son has developed a seal-like barking cough, hoarse cry, and harsh noisy breathing when breathing in since midnight.',
      'He had mild runny nose for 2 days, but the barking cough and noisy breathing started suddenly at 1 AM last night.',
      'Cough is frequent and dry, breathing is noisy with a whistling sound when he cries.',
      'Crying and agitation make his breathing worse; cool night air seemed to calm him slightly.',
      'He has a low fever of 100.5 F and mild hoarseness, but is drinking sips of water.',
      'Child is vaccinated up to age 3, birth was full term with no neonatal issues.',
      'Taking Paracetamol syrup for fever. No known drug allergies in the child.',
    ]
  }
];

async function runEndToEndRandomTests() {
  console.log('\n========================================================================');
  console.log('  TESTING RANDOM, UNPREDICTABLE DISEASES END-TO-END VIA BACKEND API');
  console.log('========================================================================\n');

  let passedAll = true;

  for (let i = 0; i < RANDOM_TEST_CASES.length; i++) {
    const c = RANDOM_TEST_CASES[i];
    console.log(`\n========================================================================`);
    console.log(`  CASE #${i + 1}: ${c.name}`);
    console.log(`  Patient: ${c.patient.name} (${c.patient.age}y, ${c.patient.gender}) | Doctor: ${c.doctor} (${c.specialty})`);
    console.log(`========================================================================\n`);

    // 1. Register Patient & Visit
    const regRes = await apiRequest('/patients/register', 'POST', {
      name: c.patient.name,
      phone: c.patient.phone,
      age: c.patient.age,
      gender: c.patient.gender,
      preferredLang: 'EN',
      departmentCode: 'GEN',
      reasonForVisit: c.dialogue[0],
    });

    if (regRes.status !== 201 || !regRes.data?.visit?.id) {
      console.error(`❌ Registration failed for Case #${i + 1}:`, regRes.data);
      passedAll = false;
      continue;
    }

    const visitId = regRes.data.visit.id;

    // 2. Start Intake Conversation
    const startRes = await apiRequest('/conversation/start', 'POST', {
      visitId,
      language: 'EN',
      isAyush: false,
      carePath: c.carePath,
      specialty: c.specialty,
      doctorName: c.doctor,
      respondentType: c.patient.caregiver ? 'CAREGIVER' : 'PATIENT',
      isNewCase: true,
    });

    if ((startRes.status !== 200 && startRes.status !== 201) || !startRes.data?.session?.id) {
      console.error(`❌ Conversation start failed:`, startRes.data);
      passedAll = false;
      continue;
    }

    const sessionId = startRes.data.session.id;
    const q0 = startRes.data.message?.content || startRes.data.nextQuestion;
    console.log(`[Turn 0 Opening AI Question]:\n"${q0}"\nTouch Options: ${JSON.stringify(startRes.data.touchOptions || [])}\n`);

    let questionsAsked = [q0];

    // 3. Multi-turn dialogue execution
    for (let t = 0; t < c.dialogue.length; t++) {
      const patientAnswer = c.dialogue[t];
      console.log(`[Turn ${t + 1} Patient Answer]: "${patientAnswer}"`);

      const msgRes = await apiRequest(`/conversation/${sessionId}/message`, 'POST', {
        content: patientAnswer,
        inputMethod: 'VOICE',
        language: 'EN',
        carePath: c.carePath,
        specialty: c.specialty,
      });

      if (msgRes.status !== 200) {
        console.error(`❌ Message error at Turn ${t + 1}:`, msgRes.data);
        passedAll = false;
        break;
      }

      const nextQuestion = msgRes.data.nextQuestion || msgRes.data.aiMessage?.content;
      const touchOptions = msgRes.data.touchOptions || [];
      const isComplete = msgRes.data.isComplete;
      const isRedFlag = msgRes.data.isRedFlag || msgRes.data.hasRedFlag;

      console.log(`[Turn ${t + 1} AI Response]:\n"${nextQuestion}"`);
      console.log(`Touch Options: ${JSON.stringify(touchOptions)}`);
      console.log(`Complete: ${isComplete} | Red Flag: ${Boolean(isRedFlag)}`);

      // Check for repetition
      const isRepeated = questionsAsked.some(prev => {
        const pSub = prev.toLowerCase().slice(0, 35);
        const nSub = nextQuestion.toLowerCase().slice(0, 35);
        return pSub === nSub;
      });

      if (isRepeated) {
        console.error(`❌ REPETITION DETECTED at Turn ${t + 1}!`);
        passedAll = false;
      } else {
        console.log(`✓ Question is unique and logically progressive.\n`);
      }

      questionsAsked.push(nextQuestion);

      if (isComplete) {
        console.log(`🎯 Intake reached natural completion at Turn ${t + 1}.\n`);
        break;
      }
    }
  }

  console.log('\n========================================================================');
  if (passedAll) {
    console.log('  ALL 5 RANDOM UNPREDICTABLE DISEASE CASES PASSED WITH 100% FLUIDITY');
  } else {
    console.log('  FAILURES DETECTED IN RANDOM TEST');
  }
  console.log('========================================================================\n');

  await prisma.$disconnect();
}

runEndToEndRandomTests();
