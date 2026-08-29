import { UniversalClinicalEngine } from './src/ai/AIProvider.js';

const engine = new UniversalClinicalEngine();

async function testFullVomitingIntake() {
  console.log('================================================================');
  console.log('=== FULL MULTI-TURN VOMITING INTAKE VERIFICATION (EN, HI, GU) ===');
  console.log('================================================================');

  const languages = ['EN', 'HI', 'GU'] as const;
  const initialInputs = {
    EN: 'I feel like vomitting',
    HI: 'मुझे उल्टी जैसा लग रहा है',
    GU: 'મને ઉબકા આવે છે અને ઉલટી થાય છે'
  };

  const onsetInputs = {
    EN: 'Since today / past few hours',
    HI: 'आज से / कुछ घंटों से',
    GU: 'આજથી / થોડા કલાકોથી'
  };

  const charInputs = {
    EN: 'Vomited 1-2 times after meals with nausea',
    HI: 'खाने के बाद 1-2 बार उल्टी व जी मिचलाना',
    GU: 'જમ્યા પછી ૧-૨ વાર ઉલટી અને ઉબકા'
  };

  for (const lang of languages) {
    console.log(`\n================== LANGUAGE: ${lang} ==================`);
    let state: any = {
      isNewPatient: true,
      turnsCompleted: 0,
      symptoms: [],
      questionsAsked: []
    };

    // Patient says: "I feel like vomitting"
    const ans0 = initialInputs[lang];
    const facts0 = await engine.extractFacts(ans0, state, lang);
    state = { ...state, ...facts0, latestAnswer: ans0, turnsCompleted: 1, questionsAsked: ['Welcome'] };

    // AI Turn 1 (Onset / Timing of Vomiting)
    const q1 = await engine.generateNextQuestion(state, lang);
    console.log(`\n[Turn 1 - Onset Question]`);
    console.log(`Patient stated: "${ans0}"`);
    console.log(`AI Q1: "${q1.question}"`);
    console.log(`Options:`, q1.touchOptions);

    // Patient answers onset
    const ans1 = onsetInputs[lang];
    const facts1 = await engine.extractFacts(ans1, state, lang);
    state = { ...state, ...facts1, latestAnswer: ans1, turnsCompleted: 2, questionsAsked: [...state.questionsAsked, q1.question] };

    // AI Turn 2 (Vomiting Character, Bile, Frequency, Fluid retention)
    const q2 = await engine.generateNextQuestion(state, lang);
    console.log(`\n[Turn 2 - Specific Vomiting Character Question]`);
    console.log(`Patient stated: "${ans1}"`);
    console.log(`AI Q2: "${q2.question}"`);
    console.log(`Options:`, q2.touchOptions);

    // Patient answers character
    const ans2 = charInputs[lang];
    const facts2 = await engine.extractFacts(ans2, state, lang);
    state = { ...state, ...facts2, latestAnswer: ans2, turnsCompleted: 3, questionsAsked: [...state.questionsAsked, q2.question] };

    // AI Turn 3 (Closing Review)
    const q3 = await engine.generateNextQuestion(state, lang);
    console.log(`\n[Turn 3 - Closing Review Question]`);
    console.log(`Patient stated: "${ans2}"`);
    console.log(`AI Q3: "${q3.question}" [Complete: ${q3.isComplete}]`);
    console.log(`Options:`, q3.touchOptions);
  }
}

testFullVomitingIntake().catch(console.error);
