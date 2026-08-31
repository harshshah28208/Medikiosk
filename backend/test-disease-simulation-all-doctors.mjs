import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = 'http://127.0.0.1:5000/api';

// Helper to compute string similarity / repetition
function isQuestionRepeated(newQ, previousQuestions) {
  if (!newQ) return true;
  const cleanNew = newQ.toLowerCase().replace(/[^\w\s\u0900-\u097F\u0A80-\u0AFF]/g, '').trim();
  for (const prev of previousQuestions) {
    const cleanPrev = prev.toLowerCase().replace(/[^\w\s\u0900-\u097F\u0A80-\u0AFF]/g, '').trim();
    if (cleanNew === cleanPrev) return true;
    // Word overlap Jaccard check
    const wordsNew = new Set(cleanNew.split(/\s+/).filter(w => w.length > 2));
    const wordsPrev = new Set(cleanPrev.split(/\s+/).filter(w => w.length > 2));
    if (wordsNew.size > 0 && wordsPrev.size > 0) {
      let intersection = 0;
      for (const w of wordsNew) {
        if (wordsPrev.has(w)) intersection++;
      }
      const union = new Set([...wordsNew, ...wordsPrev]).size;
      const jaccard = intersection / union;
      if (jaccard > 0.85) return true; // over 85% word overlap = repeated
    }
  }
  return false;
}

// Check script/translation fidelity
function checkLanguageFidelity(text, lang) {
  if (!text) return false;
  if (lang === 'HI') {
    // Should have Devanagari characters
    return /[\u0900-\u097F]/.test(text);
  }
  if (lang === 'GU') {
    // Should have Gujarati characters
    return /[\u0A80-\u0AFF]/.test(text);
  }
  if (lang === 'EN') {
    return /[a-zA-Z]/.test(text);
  }
  return true;
}

async function runDiseaseSimulation() {
  console.log('🏥 =================================================================');
  console.log('🏥 DISEASE-SPECIFIC CLINICAL SIMULATION ACROSS ALL DOCTORS (EN/HI/GU)');
  console.log('🏥 =================================================================\n');

  const doctors = await prisma.doctorProfile.findMany({
    include: { user: true, department: true },
  });

  const diseaseScenarios = [
    {
      specialtyPattern: /cardio/i,
      disease: 'Angina Pectoris / Suspected Ischemia',
      lang: 'EN',
      answers: [
        'I am experiencing squeezing chest tightness and heaviness that spreads to my left shoulder and arm for the past 2 weeks.',
        'It started 2 weeks ago gradually, and attacks usually occur whenever I walk briskly or climb 2 flights of stairs.',
        'Severity is 7 out of 10 during the episode, feels like a heavy weight pressing right in the center of my chest.',
        'I get shortness of breath, cold sweating, and mild lightheadedness during the chest tightness, but no fever.',
        'Brisk walking, climbing stairs, and heavy meals make it worse; resting seated for 5 minutes brings relief.',
        'I sleep 5-6 hours with disturbed quality, work high-stress office hours, and drink 3 black coffees daily.',
        'I have a history of Hypertension for 4 years and high cholesterol; my father had a heart attack at age 55.',
        'I take Telmisartan 40mg and Atorvastatin 20mg daily; I have a known allergy to Penicillin.',
      ],
    },
    {
      specialtyPattern: /general|medicine/i,
      disease: 'Type 2 Diabetes with Peripheral Neuropathy',
      lang: 'HI',
      answers: [
        'मुझे पिछले 1 महीने से बहुत अधिक प्यास लग रही है, बार-बार पेशाब जाना पड़ता है और पैरों के तलवों में तेज जलन और झुनझुनी हो रही है।',
        'यह समस्या लगभग 1 महीने पहले धीरे-धीरे शुरू हुई और अब पिछले 10 दिनों से बहुत ज्यादा बढ़ गई है।',
        'दिन भर में 7-8 बार पेशाब जाना पड़ता है, रात में 3 बार उठना पड़ता है और पैरों में चुभन व भारी कमजोरी महसूस होती है।',
        'साथ में आँखों में हल्का धुंधलापन, अत्यधिक थकान और बिना किसी कारण के 3 किलो वजन कम हुआ है।',
        'मीठा खाने और अधिक चलने के बाद पैरों में जलन बढ़ती है; ठंडे पानी से पैर धोने पर थोड़ा आराम मिलता है।',
        'रात में 4-5 घंटे ही नींद आती है क्योंकि बार-बार पेशाब जाना पड़ता है, खान-पान में अनियमितता और तनाव रहता है।',
        'पहले कोई गंभीर बीमारी नहीं थी, पर माताजी को 15 साल से डायबिटीज और बीपी की बीमारी है।',
        'अभी कोई नियमित दवा नहीं ले रहा हूँ, कभी-कभी गैस की गोली लेता हूँ; मुझे सल्फा दवाओं से एलर्जी है।',
      ],
    },
    {
      specialtyPattern: /pediatric/i,
      disease: 'Acute Pediatric Wheezing / Bronchiolitis',
      lang: 'EN',
      answers: [
        'My 3-year-old child has had rapid breathing, chest wheezing whistles, and high fever for the last 3 days.',
        'It started with a runny nose and mild cough 4 days ago, but the wheezing and fast breathing worsened yesterday.',
        'The child is breathing very fast with visible chest rib retractions and continuous dry coughing.',
        'Child has low appetite, refused milk this morning, and vomited once after continuous coughing.',
        'Cold night air, dust, and lying flat on back worsen the cough; sitting upright in mother\'s lap gives slight relief.',
        'Child sleeps fitfully for 2-3 hours, waking up coughing; attends nursery daycare 4 days a week.',
        'No prior hospital admissions; elder sibling has mild childhood asthma and dust allergy.',
        'Giving Paracetamol drops for fever 5ml every 6 hours; No known drug allergies in the child.',
      ],
    },
    {
      specialtyPattern: /ortho/i,
      disease: 'Lumbar Spondylosis with Sciatica Nerve Radiation',
      lang: 'GU',
      answers: [
        'મને છેલ્લા ૨ અઠવાડિયાથી કમરના નીચેના ભાગમાં તીવ્ર દુખાવો છે જે જમણા પગના પંજા સુધી વીજળીના કરંટ જેવો ખેંચાય છે.',
        'આ દુખાવો ૨ અઠવાડિયા પહેલાં વજન ઉપાડ્યા પછી અચાનક શરૂ થયો હતો અને ધીમે-ધીમે પગમાં વધતો ગયો.',
        'દુખાવાની તીવ્રતા ૧૦ માંથી ૮ છે, સવારે પથારીમાંથી ઊઠતી વખતે કમર એકદમ જકડાઈ જાય છે અને પગમાં ખાલી ચડી જાય છે.',
        'જમણા પગના અંગૂઠામાં ઝણઝણાટી અને કળતર રહે છે, પણ પેશાબ રોકવામાં કોઈ તકલીફ નથી.',
        'આગળ વાંકા વળવાથી, લાંબો સમય બેસી રહેવાથી અને ચાલવાથી દુખાવો વધે છે; સીધા સૂઈ રહેવાથી અને ગરમ શેક કરવાથી રાહત મળે છે.',
        'રાત્રે દુખાવાને કારણે માત્ર ૫ કલાક ઊંઘ આવે છે, દુકાન પર આખો દિવસ બેસી રહેવાનું કામ છે.',
        '૫ વર્ષથી બ્લડ પ્રેશરની તકલીફ છે, કોઈ ઓપરેશન કરાવેલ નથી.',
        'હું રોજ સવારે એમ્લોડિપિન ૫ એમજી લઉં છું; મને પેઇનકિલર (ડાઇક્લોફેનેક) ગોળીથી એસિડિટી અને એલર્જી થાય છે.',
      ],
    },
    {
      specialtyPattern: /derma/i,
      disease: 'Chronic Plaque Psoriasis & Scalp Dandruff',
      lang: 'EN',
      answers: [
        'I have thick red scaly patches with silvery white flakes on both my elbows, knees, and intense itching on my scalp for 3 months.',
        'It started 3 months ago with small red spots on knees and has now expanded into thick itchy plaques.',
        'Itching is 7 out of 10, especially severe at night, with frequent bleeding when the silvery scales are scratched off.',
        'Also noticing joint stiffness in my finger joints in the morning and pitting on my fingernails.',
        'Cold winter weather, mental stress, and hot water baths aggravate the itching; applying thick coconut oil gives temporary relief.',
        'I work in rotational night shifts, sleep irregularly around 5 hours, and smoke 4-5 cigarettes daily.',
        'No major chronic illnesses; maternal uncle has chronic skin psoriasis.',
        'Applying over-the-counter moisturizers; No known drug allergies (NKDA).',
      ],
    },
    {
      specialtyPattern: /ent/i,
      disease: 'Chronic Suppurative Rhinosinusitis',
      lang: 'HI',
      answers: [
        'मुझे पिछले 3 हफ्तों से माथे और दोनों गालों पर भारी दबाव, नाक पूरी तरह बंद रहना और गले में लगातार गाढ़ा पीला बलगम गिरने की शिकायत है।',
        'यह 3 हफ्ते पहले सामान्य सर्दी-जुकाम के बाद शुरू हुआ था और ठीक होने की बजाय बढ़ता चला गया।',
        'माथे में 10 में से 7 की तीव्रता का भारी दर्द है, विशेष रूप से आगे झुकने पर सिर फटने जैसा लगता है।',
        'सूंघने की शक्ति (smell) कम हो गई है, कानों में भारीपन और हल्का बुखार जैसा महसूस होता है।',
        'एसी की ठंडी हवा, धूल और आगे झुकने से भारीपन बढ़ जाता है; गर्म पानी की भाप (steam) लेने से थोड़ी राहत मिलती है।',
        'नाक बंद होने के कारण मुंह से सांस लेनी पड़ती है जिससे रात में बार-बार नींद टूटती है और सुबह मुंह सूख जाता है।',
        'बचपन से धूल और मौसम बदलने पर छींकों की एलर्जी रही है; पहले कोई नाक की सर्जरी नहीं हुई है।',
        'अभी कभी-कभार सेट्रिज़िन और पैरासिटामोल लेता हूँ; मुझे एस्पिरिन दवा से एलर्जी है।',
      ],
    },
    {
      specialtyPattern: /ayur/i,
      disease: 'Amlapitta & Agnimandya (Chronic Hyperacidity)',
      lang: 'GU',
      answers: [
        'મને છેલ્લા ૧ મહિનાથી પેટમાં અને છાતીમાં તીવ્ર બળતરા, ખાટા અને કડવા ઓડકાર, અને જમ્યા પછી ભારેપણું રહે છે.',
        'આ તકલીફ ૧ મહિના પહેલાં શરૂ થઈ અને હવે રોજ બપોરે તથા રાત્રે જમ્યાના ૨ કલાક પછી ખૂબ વધે છે.',
        'છાતીમાં અગ્નિ જેવી બળતરા થાય છે, મોઢામાં ખાટું પાણી આવી જાય છે અને પેટમાં ગેસ ભરાય છે.',
        'સાથે માથામાં ભારેપણું, ચક્કર અને સવારે ઉબકા જેવું લાગે છે, ભૂખ એકદમ ઓછી થઈ ગઈ છે.',
        'તીખું, તળેલું, ચા-કોફી અને મોડું જમવાથી બળતરા વધે છે; ઠંડુ દૂધ પીવાથી કે વરિયાળીનું પાણી લેવાથી થોડી શાંતિ થાય છે.',
        'રાત્રે ૧ વાગ્યા સુધી જાગવાની આદત છે અને સવારે ૬ વાગ્યે ઊઠી જવાય છે, બહારનું જમવાનું વધુ થાય છે.',
        'અગાઉ કોઈ મોટી બીમારી નથી, ઘરના અન્ય સભ્યોને પણ વાયુ-પિત્તની તકલીફ રહે છે.',
        'હું કોઈ એલોપેથી દવા નિયમિત લેતો નથી, ક્યારેક હિંગ્વાષ્ટક ચૂર્ણ લઉં છું; કોઈ દવાની એલર્જી નથી.',
      ],
    },
    {
      specialtyPattern: /homeo/i,
      disease: 'Migraine Cephalea with Visual Aura',
      lang: 'EN',
      answers: [
        'I suffer from severe right-sided throbbing and hammering head pain with visual aura flashing lights for the past 6 months.',
        'Attacks occur 2-3 times per week, typically starting around 10 AM and lasting until late evening.',
        'Severity is 8 out of 10, throbbing sensation feels like a hammer pounding inside the right temple and behind right eye.',
        'Severe nausea, vomiting of sour fluid, extreme sensitivity to bright sunlight and loud sounds during the headache.',
        'Sun exposure, mental stress, skipped breakfast, and motion worsen the pain; lying motionless in a completely dark, quiet room with cold compress gives relief.',
        'I am a chilly person who feels cold easily, but desire fresh cool air during headache attacks; thirst is low.',
        'I become extremely irritable and weep easily from pain, wanting total silence without anyone speaking.',
        'Taking occasional pain tablets but they only give 1-2 hours relief; No known drug allergies (NKDA).',
      ],
    },
  ];

  const auditSummary = [];

  for (let i = 0; i < doctors.length; i++) {
    const doc = doctors[i];
    const docName = doc.user?.name || doc.name || 'Specialist';
    const specialty = doc.specialization || doc.department?.name || 'General Medicine';
    const carePath = doc.system === 'AYURVEDA' ? 'AYUSH' : doc.system === 'HOMEOPATHY' ? 'HOMEOPATHY' : 'ALLOPATHY';

    // Find matching disease scenario
    const scenario = diseaseScenarios.find(s => 
      s.specialtyPattern.test(specialty) || 
      s.specialtyPattern.test(doc.department?.name || '') ||
      s.specialtyPattern.test(doc.system || '')
    ) || diseaseScenarios[1];

    console.log(`=================================================================`);
    console.log(`👨‍⚕️ DOCTOR [${i + 1}/${doctors.length}]: Dr. ${docName}`);
    console.log(`   Specialty: ${specialty} | CarePath: ${carePath} | Language: ${scenario.lang}`);
    console.log(`   Simulated Disease: "${scenario.disease}"`);
    console.log(`=================================================================`);

    let patient = await prisma.patient.findFirst();
    const visit = await prisma.visit.create({
      data: {
        patient: { connect: { id: patient.id } },
        doctor: { connect: { id: doc.id } },
        department: doc.departmentId ? { connect: { id: doc.departmentId } } : undefined,
        token: `T-DIS-${i + 1}`,
        status: 'INTAKE_IN_PROGRESS',
      },
    });

    // Start Conversation
    const startRes = await fetch(`${BASE_URL}/conversation/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitId: visit.id,
        language: scenario.lang,
        carePath,
        specialty,
        doctorName: docName,
      }),
    });

    const startData = await startRes.json();
    const sessionId = startData.session?.id;
    const initialQ = startData.nextQuestion || startData.aiMessage?.content;
    const initialOpts = startData.touchOptions || [];

    const questionsAsked = [initialQ];
    let repeatedQuestionsCount = 0;
    let translationFailures = 0;
    let prematureCompletion = false;
    let endedWithAppointment = false;

    // Check Lang Fidelity of initial question & touch options
    if (!checkLanguageFidelity(initialQ, scenario.lang)) {
      translationFailures++;
      console.warn(`   ⚠️ Initial question language mismatch for ${scenario.lang}: "${initialQ}"`);
    }
    for (const opt of initialOpts) {
      if (!checkLanguageFidelity(opt, scenario.lang)) {
        translationFailures++;
        console.warn(`   ⚠️ Initial option language mismatch for ${scenario.lang}: "${opt}"`);
      }
    }

    console.log(`▶ Turn 0 (Doctor Opening):`);
    console.log(`   AI: "${initialQ}"`);
    console.log(`   Touch Options:`, initialOpts);

    for (let t = 0; t < scenario.answers.length; t++) {
      const patientAns = scenario.answers[t];
      const msgRes = await fetch(`${BASE_URL}/conversation/${sessionId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: patientAns,
          language: scenario.lang,
        }),
      });

      const msgData = await msgRes.json();
      const aiQ = msgData.aiMessage?.content || msgData.nextQuestion;
      const opts = msgData.touchOptions || [];
      const isComplete = msgData.isComplete;

      // 1. Check repetition
      if (isQuestionRepeated(aiQ, questionsAsked)) {
        console.error(`   ❌ REPEATED QUESTION at Turn ${t + 1}: "${aiQ}"`);
        repeatedQuestionsCount++;
      }
      questionsAsked.push(aiQ);

      // 2. Check translation fidelity
      if (!checkLanguageFidelity(aiQ, scenario.lang)) {
        translationFailures++;
        console.warn(`   ⚠️ AI Question language mismatch at Turn ${t + 1}: "${aiQ}"`);
      }
      for (const opt of opts) {
        if (!checkLanguageFidelity(opt, scenario.lang)) {
          translationFailures++;
          console.warn(`   ⚠️ Touch option language mismatch at Turn ${t + 1}: "${opt}"`);
        }
      }

      // 3. Premature completion check (must not complete before at least 6 turns)
      if (t < 5 && isComplete) {
        prematureCompletion = true;
        console.error(`   ❌ PREMATURE COMPLETION at Turn ${t + 1}`);
      }

      // 4. Check if final turn offers appointment / completion handoff
      if (t === scenario.answers.length - 1 && isComplete) {
        endedWithAppointment = true;
      }

      console.log(`▶ Turn ${t + 1} [Category: ${msgData.category || 'CLINICAL'}]:`);
      console.log(`   Patient [${scenario.lang}]: "${patientAns.slice(0, 60)}..."`);
      console.log(`   AI [${scenario.lang}]: "${aiQ}"`);
      console.log(`   Touch Options (${opts.length}):`, opts);
      console.log(`   isComplete: ${isComplete}`);
    }

    const testPassed = repeatedQuestionsCount === 0 && translationFailures === 0 && !prematureCompletion && endedWithAppointment;

    console.log(`\nDoctor Audit Result for Dr. ${docName}: ${testPassed ? '✅ 100% PASSED' : '❌ FAILED'}`);
    console.log(`   Repeated Questions: ${repeatedQuestionsCount}`);
    console.log(`   Translation Failures: ${translationFailures}`);
    console.log(`   Premature Complete: ${prematureCompletion}`);
    console.log(`   Ended with Appointment Handoff: ${endedWithAppointment}\n`);

    auditSummary.push({
      doctor: docName,
      specialty,
      disease: scenario.disease,
      lang: scenario.lang,
      totalTurns: scenario.answers.length,
      repeatedQuestions: repeatedQuestionsCount,
      translationFailures,
      endedWithAppointment,
      status: testPassed ? 'PASSED' : 'FAILED',
    });
  }

  console.log('=================================================================');
  console.log('🏥 DISEASE SIMULATION & TRANSLATION COMPREHENSIVE REPORT');
  console.log('=================================================================');
  console.table(auditSummary);

  await prisma.$disconnect();
}

runDiseaseSimulation().catch(async (e) => {
  console.error('❌ Disease simulation failed:', e);
  await prisma.$disconnect();
  process.exit(1);
});
