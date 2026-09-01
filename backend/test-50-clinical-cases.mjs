import http from 'http';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function request(path, method = 'GET', data = null, token = null) {
  return new Promise((resolve, reject) => {
    const payload = data ? JSON.stringify(data) : null;
    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path,
        method,
        headers: {
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

// 50 Clinical Case Definitions
const TEST_CASES = [
  // --- CARDIOLOGY (NEW & FOLLOW-UP) ---
  { id: 1, name: 'Cardiology - Acute Anginal Chest Pain (New)', dept: 'GEN', spec: 'Cardiology', doctor: 'Dr. Yogesh Sharma', carePath: 'ALLOPATHY', lang: 'EN', type: 'NEW', complaint: 'Substernal squeezing chest pain with left arm radiation', answer: 'Started 2 hours ago during morning brisk walk, rated 8/10 tightness' },
  { id: 2, name: 'Cardiology - Hypertension Follow-up (Improved)', dept: 'GEN', spec: 'Cardiology', doctor: 'Dr. Yogesh Sharma', carePath: 'ALLOPATHY', lang: 'EN', type: 'FOLLOW_UP', complaint: 'Essential Hypertension Follow-up', answer: 'Symptoms significantly improved (>70% relief), taking Amlodipine 5mg regularly' },
  { id: 3, name: 'Cardiology - Palpitations & Dizziness (New, Hindi)', dept: 'GEN', spec: 'Cardiology', doctor: 'Dr. Yogesh Sharma', carePath: 'ALLOPATHY', lang: 'HI', type: 'NEW', complaint: 'अचानक दिल की धड़कन तेज होना और चक्कर आना', answer: 'पिछले 3 दिनों से लगातार घबराहट और तेज धड़कन महसूस हो रही है' },
  { id: 4, name: 'Cardiology - Post-MI Follow-up Worsening (Gujarati)', dept: 'GEN', spec: 'Cardiology', doctor: 'Dr. Yogesh Sharma', carePath: 'ALLOPATHY', lang: 'GU', type: 'FOLLOW_UP', complaint: 'હૃદયરોગ ફોલો-અપ અને શ્વાસ લેવામાં તકલીફ', answer: 'છેલ્લા ૨ દિવસથી તકલીફ વધી ગઈ છે, રાત્રે સૂતી વખતે શ્વાસ ચડે છે' },

  // --- ORTHOPEDICS (NEW & FOLLOW-UP) ---
  { id: 5, name: 'Orthopedics - Lumbar Sciatica & Disc Herniation (New)', dept: 'ORTHO', spec: 'Orthopedics & Joint Surgery', doctor: 'Dr. Vikram Seth', carePath: 'ALLOPATHY', lang: 'EN', type: 'NEW', complaint: 'Severe low back pain radiating down right leg to foot with numbness', answer: 'Started 5 days ago after lifting heavy luggage, pain rated 7/10 sharp electric' },
  { id: 6, name: 'Orthopedics - Knee Osteoarthritis Follow-up (Partial Relief)', dept: 'ORTHO', spec: 'Orthopedics & Joint Surgery', doctor: 'Dr. Vikram Seth', carePath: 'ALLOPATHY', lang: 'EN', type: 'FOLLOW_UP', complaint: 'Bilateral Knee Osteoarthritis Follow-up', answer: 'Partial relief with physiotherapy, but morning stiffness still lasts 30 minutes' },
  { id: 7, name: 'Orthopedics - Frozen Shoulder (New, Hindi)', dept: 'ORTHO', spec: 'Orthopedics & Joint Surgery', doctor: 'Dr. Vikram Seth', carePath: 'ALLOPATHY', lang: 'HI', type: 'NEW', complaint: 'दाहिने कंधे में तेज जकड़न और हाथ उठाने में दर्द', answer: 'लगभग 2 हफ्तों से हाथ ऊपर उठाने या पीठ पीछे ले जाने पर असहनीय दर्द होता है' },
  { id: 8, name: 'Orthopedics - Cervical Spondylosis Follow-up (Gujarati)', dept: 'ORTHO', spec: 'Orthopedics & Joint Surgery', doctor: 'Dr. Vikram Seth', carePath: 'ALLOPATHY', lang: 'GU', type: 'FOLLOW_UP', complaint: 'ગરદનનો દુખાવો અને હાથમાં ખાલી ચડવી', answer: 'દવાઓથી સારો સુધારો છે (૭૦%+ રાહત), કસરત નિયમિત ચાલુ છે' },

  // --- AYURVEDA & INTEGRATIVE MEDICINE (NEW & FOLLOW-UP) ---
  { id: 9, name: 'Ayurveda - Amlapitta (Hyperacidity & GERD) (New)', dept: 'AYUSH', spec: 'Ayurveda & Integrative Medicine', doctor: 'Vaidya Harish Bhatt', carePath: 'AYUSH', lang: 'EN', type: 'NEW', complaint: 'Severe epigastric burning, sour belching and morning nausea', answer: 'Aggravated after spicy food and late night dinner, burning sensation in chest' },
  { id: 10, name: 'Ayurveda - Sandhivata (Osteoarthritis) Follow-up', dept: 'AYUSH', spec: 'Ayurveda & Integrative Medicine', doctor: 'Vaidya Harish Bhatt', carePath: 'AYUSH', lang: 'EN', type: 'FOLLOW_UP', complaint: 'Sandhivata & Vata imbalance', answer: 'Symptoms improved after Janu Basti and Guggulu formulation' },
  { id: 11, name: 'Ayurveda - Grahani / IBS (New, Hindi)', dept: 'AYUSH', spec: 'Ayurveda & Integrative Medicine', doctor: 'Vaidya Harish Bhatt', carePath: 'AYUSH', lang: 'HI', type: 'NEW', complaint: 'पेट में मरोड़, अपच और अनियमित मल त्याग (ग्रहणी)', answer: 'खाना खाने के तुरंत बाद पेट भारी हो जाता है और अग्नि मंद रहती है' },
  { id: 12, name: 'Ayurveda - Vata Vyadhi Follow-up (Gujarati)', dept: 'AYUSH', spec: 'Ayurveda & Integrative Medicine', doctor: 'Vaidya Harish Bhatt', carePath: 'AYUSH', lang: 'GU', type: 'FOLLOW_UP', complaint: 'વાત વ્યાધિ અને સાંધાની જકડન ફોલો-અપ', answer: 'ઔષધિઓથી ઘણો સારો સુધારો છે, સવારે તેલ માલિશ કરવાથી રાહત રહે છે' },

  // --- CLASSICAL HOMEOPATHY (NEW & FOLLOW-UP) ---
  { id: 13, name: 'Homeopathy - Chronic Migraine with Right-sided Modalities (New)', dept: 'AYUSH', spec: 'Classical Homeopathy', doctor: 'Dr. Snehal Shah', carePath: 'HOMEOPATHY', lang: 'EN', type: 'NEW', complaint: 'Throbbing right-sided temporal headache with eye pain and photophobia', answer: 'Worse from bright sunlight and heat; better by lying in dark room with tight bandaging' },
  { id: 14, name: 'Homeopathy - Eczema & Atopic Dermatitis Follow-up', dept: 'AYUSH', spec: 'Classical Homeopathy', doctor: 'Dr. Snehal Shah', carePath: 'HOMEOPATHY', lang: 'EN', type: 'FOLLOW_UP', complaint: 'Chronic Flexural Eczema Follow-up', answer: 'Itching reduced significantly after Graphites, but mild dry scaling remains' },
  { id: 15, name: 'Homeopathy - Allergic Rhinitis (New, Hindi)', dept: 'AYUSH', spec: 'Classical Homeopathy', doctor: 'Dr. Snehal Shah', carePath: 'HOMEOPATHY', lang: 'HI', type: 'NEW', complaint: 'सुबह उठते ही लगातार 20-25 छींकें, नाक से पानी और आंखों में खुजली', answer: 'सुबह की ठंडी हवा और धूल से तकलीफ बहुत बढ़ जाती है, गर्म चाय से आराम मिलता है' },
  { id: 16, name: 'Homeopathy - Anxiety & Sleep Interruption Follow-up (Gujarati)', dept: 'AYUSH', spec: 'Classical Homeopathy', doctor: 'Dr. Snehal Shah', carePath: 'HOMEOPATHY', lang: 'GU', type: 'FOLLOW_UP', complaint: 'માનસિક તણાવ અને ઊંઘમાં ખલેલ ફોલો-અપ', answer: 'દવા લીધા પછી મન શાંત છે અને ઊંઘ ૭ કલાક સારી આવે છે' },

  // --- NEUROLOGY ---
  { id: 17, name: 'Neurology - Acute Vertigo & BPPV (New)', dept: 'GEN', spec: 'Neurology', doctor: 'Dr. Yogesh Sharma', carePath: 'ALLOPATHY', lang: 'EN', type: 'NEW', complaint: 'Rotational spinning sensation when turning head in bed, with nausea', answer: 'Started 2 days ago, episodes last 30-60 seconds on positional change' },
  { id: 18, name: 'Neurology - Peripheral Neuropathy Follow-up', dept: 'GEN', spec: 'Neurology', doctor: 'Dr. Yogesh Sharma', carePath: 'ALLOPATHY', lang: 'EN', type: 'FOLLOW_UP', complaint: 'Diabetic Peripheral Neuropathy Follow-up', answer: 'Burning in feet has reduced with Pregabalin, glycemic control maintained' },

  // --- DERMATOLOGY ---
  { id: 19, name: 'Dermatology - Acute Urticaria & Angioedema (New)', dept: 'GEN', spec: 'Dermatology', doctor: 'Dr. Yogesh Sharma', carePath: 'ALLOPATHY', lang: 'EN', type: 'NEW', complaint: 'Severe itchy red wheals spreading over torso and limbs with lip swelling', answer: 'Appeared acutely 3 hours after eating seafood, itching rated 9/10 severe' },
  { id: 20, name: 'Dermatology - Psoriasis Vulgaris Follow-up (Hindi)', dept: 'GEN', spec: 'Dermatology', doctor: 'Dr. Yogesh Sharma', carePath: 'ALLOPATHY', lang: 'HI', type: 'FOLLOW_UP', complaint: 'सोरायसिस के धब्बे और खुजली फॉलो-अप', answer: 'मलहम लगाने से पपड़ी काफी कम हुई है, खुजली में 80% सुधार है' },

  // --- PULMONOLOGY & RESPIRATORY ---
  { id: 21, name: 'Pulmonology - Bronchial Asthma Exacerbation (New)', dept: 'GEN', spec: 'Pulmonology', doctor: 'Dr. Yogesh Sharma', carePath: 'ALLOPATHY', lang: 'EN', type: 'NEW', complaint: 'Wheezing, nocturnal breathlessness and dry spasmodic cough', answer: 'Worse at 3 AM and in cold air drafts; requires Salbutamol inhaler twice daily' },
  { id: 22, name: 'Pulmonology - Post-Pneumonia Recovery Follow-up (Gujarati)', dept: 'GEN', spec: 'Pulmonology', doctor: 'Dr. Yogesh Sharma', carePath: 'ALLOPATHY', lang: 'GU', type: 'FOLLOW_UP', complaint: 'ફેફસામાં કફ અને શ્વાસની તકલીફ ફોલો-અપ', answer: 'તાવ મટી ગયો છે, કફ ઘણો ઓછો છે અને શ્વાસ લેવામાં સરળતા છે' },

  // --- GASTROENTEROLOGY ---
  { id: 23, name: 'Gastroenterology - Acute Gastritis with Epigastric Burning (New)', dept: 'GEN', spec: 'Gastroenterology', doctor: 'Dr. Yogesh Sharma', carePath: 'ALLOPATHY', lang: 'EN', type: 'NEW', complaint: 'Gnawing mid-epigastric abdominal pain relieved temporarily by milk', answer: 'Pain rated 6/10 dull aching, present for 10 days, accompanied by bloating' },
  { id: 24, name: 'Gastroenterology - Fatty Liver Disease Follow-up (Hindi)', dept: 'GEN', spec: 'Gastroenterology', doctor: 'Dr. Yogesh Sharma', carePath: 'ALLOPATHY', lang: 'HI', type: 'FOLLOW_UP', complaint: 'फैटी लिवर और पेट भारीपन फॉलो-अप', answer: 'खान-पान में परहेज और रोज 45 मिनट टहलने से वजन 2 किलो कम हुआ है' },

  // --- PEDIATRICS (CAREGIVER-ASSISTED) ---
  { id: 25, name: 'Pediatrics - Acute Otitis Media in Child (New, Caregiver)', dept: 'GEN', spec: 'Pediatrics', doctor: 'Dr. Yogesh Sharma', carePath: 'ALLOPATHY', lang: 'EN', type: 'NEW', complaint: '4-year-old child crying with severe right ear tugging and fever 101F', answer: 'Child woke up crying at night holding right ear after 3 days of common cold' },
  { id: 26, name: 'Pediatrics - Viral Gastroenteritis Follow-up (Hindi, Caregiver)', dept: 'GEN', spec: 'Pediatrics', doctor: 'Dr. Yogesh Sharma', carePath: 'ALLOPATHY', lang: 'HI', type: 'FOLLOW_UP', complaint: 'बच्चे की उल्टी और दस्त का फॉलो-अप', answer: 'ओआरएस और जिंक सिरप के बाद उल्टियां पूरी तरह बंद हैं, बच्चा खेल रहा है' },

  // --- ENT (EAR, NOSE, THROAT) ---
  { id: 27, name: 'ENT - Acute Bacterial Sinusitis (New)', dept: 'GEN', spec: 'ENT', doctor: 'Dr. Yogesh Sharma', carePath: 'ALLOPATHY', lang: 'EN', type: 'NEW', complaint: 'Severe facial pressure over maxilla, green nasal discharge and frontal headache', answer: 'Persistent for 8 days, worsens upon bending forward, nasal blockage on left' },
  { id: 28, name: 'ENT - Chronic Suppurative Otitis Media Follow-up (Gujarati)', dept: 'GEN', spec: 'ENT', doctor: 'Dr. Yogesh Sharma', carePath: 'ALLOPATHY', lang: 'GU', type: 'FOLLOW_UP', complaint: 'કાનમાંથી રસી અને દુખાવો ફોલો-અપ', answer: 'કાનના ટીપાં નાખ્યા પછી રસી આવવી બંધ થઈ ગઈ છે, દુખાવો નથી' },

  // --- OPHTHALMOLOGY ---
  { id: 29, name: 'Ophthalmology - Acute Conjunctivitis (New)', dept: 'GEN', spec: 'Ophthalmology', doctor: 'Dr. Yogesh Sharma', carePath: 'ALLOPATHY', lang: 'EN', type: 'NEW', complaint: 'Bilateral red eyes with gritty sensation, sticky yellow crusting in morning', answer: 'Started yesterday morning, eyes feel irritated and sensitive to room light' },
  { id: 30, name: 'Ophthalmology - Dry Eye Syndrome Follow-up (Hindi)', dept: 'GEN', spec: 'Ophthalmology', doctor: 'Dr. Yogesh Sharma', carePath: 'ALLOPATHY', lang: 'HI', type: 'FOLLOW_UP', complaint: 'आंखों में सूखापन और जलन फॉलो-अप', answer: 'आई ड्रॉप्स डालने से कंप्यूटर पर काम करते समय जलन में बहुत आराम है' },

  // --- ENDOCRINOLOGY / DIABETOLOGY ---
  { id: 31, name: 'Endocrinology - Type 2 Diabetes Mellitus with Polyuria (New)', dept: 'GEN', spec: 'Endocrinology', doctor: 'Dr. Yogesh Sharma', carePath: 'ALLOPATHY', lang: 'EN', type: 'NEW', complaint: 'Excessive thirst, frequent urination at night, unexplainable 4kg weight loss', answer: 'Symptoms increasing over last 3 weeks, feeling fatigued after meals' },
  { id: 32, name: 'Endocrinology - Hypothyroidism Follow-up (Gujarati)', dept: 'GEN', spec: 'Endocrinology', doctor: 'Dr. Yogesh Sharma', carePath: 'ALLOPATHY', lang: 'GU', type: 'FOLLOW_UP', complaint: 'થાયરોઇડ અને સુસ્તી/થાક ફોલો-અપ', answer: 'રોજ સવારે ભૂખ્યા પેટે દવા લેવાથી થાક ઓછો લાગે છે અને વજન સ્થિર છે' },

  // --- NEPHROLOGY / UROLOGY ---
  { id: 33, name: 'Urology - Renal Colic & Nephrolithiasis (New)', dept: 'GEN', spec: 'Urology', doctor: 'Dr. Yogesh Sharma', carePath: 'ALLOPATHY', lang: 'EN', type: 'NEW', complaint: 'Excruciating spasmodic left flank pain radiating to groin with pink urine', answer: 'Sudden onset 4 hours ago, rated 9/10 severe sharp colicky pain' },
  { id: 34, name: 'Urology - UTI Follow-up (Hindi)', dept: 'GEN', spec: 'Urology', doctor: 'Dr. Yogesh Sharma', carePath: 'ALLOPATHY', lang: 'HI', type: 'FOLLOW_UP', complaint: 'पेशाब में जलन और बार-बार पेशाब का फॉलो-अप', answer: 'एंटीबायोटिक का 5 दिन का कोर्स पूरा करने के बाद जलन पूरी तरह ठीक है' },

  // --- OBSTETRICS & GYNECOLOGY ---
  { id: 35, name: 'Gynecology - Dysmenorrhea & Menorrhagia (New)', dept: 'GEN', spec: 'Obstetrics & Gynecology', doctor: 'Dr. Yogesh Sharma', carePath: 'ALLOPATHY', lang: 'EN', type: 'NEW', complaint: 'Severe lower abdominal menstrual cramps with heavy flow and fatigue', answer: 'Pain rated 8/10 on day 1-2 of cycle, disturbing daily office work' },
  { id: 36, name: 'Gynecology - Antenatal 2nd Trimester Follow-up (Gujarati)', dept: 'GEN', spec: 'Obstetrics & Gynecology', doctor: 'Dr. Yogesh Sharma', carePath: 'ALLOPATHY', lang: 'GU', type: 'FOLLOW_UP', complaint: 'ગર્ભાવસ્થા નિયમિત તપાસ ફોલો-અપ', answer: 'બાળકની હલચલ બરાબર જણાય છે, આયર્ન-કેલ્શિયમની ગોળીઓ ચાલુ છે' },

  // --- PSYCHIATRY & BEHAVIORAL HEALTH ---
  { id: 37, name: 'Psychiatry - Panic Disorder with Somatic Anxiety (New)', dept: 'GEN', spec: 'Psychiatry', doctor: 'Dr. Yogesh Sharma', carePath: 'ALLOPATHY', lang: 'EN', type: 'NEW', complaint: 'Sudden episodes of terror, choking sensation, chest heaviness and tremulousness', answer: 'Episodes occur 2-3 times a week, lasting 20 minutes without apparent trigger' },
  { id: 38, name: 'Psychiatry - Generalized Anxiety Follow-up (Hindi)', dept: 'GEN', spec: 'Psychiatry', doctor: 'Dr. Yogesh Sharma', carePath: 'ALLOPATHY', lang: 'HI', type: 'FOLLOW_UP', complaint: 'बेचैनी, घबराहट और अनिद्रा फॉलो-अप', answer: 'काउंसलिंग और हल्की दवा से मन की घबराहट में 70% कमी आई है' },

  // --- RHEUMATOLOGY ---
  { id: 39, name: 'Rheumatology - Early Rheumatoid Arthritis (New)', dept: 'ORTHO', spec: 'Rheumatology', doctor: 'Dr. Vikram Seth', carePath: 'ALLOPATHY', lang: 'EN', type: 'NEW', complaint: 'Symmetrical morning stiffness in MCP and wrist joints lasting >1 hour', answer: 'Present for 6 weeks, difficulty opening jar lids and gripping toothbrush' },
  { id: 40, name: 'Rheumatology - Gouty Arthritis Follow-up (Gujarati)', dept: 'ORTHO', spec: 'Rheumatology', doctor: 'Dr. Vikram Seth', carePath: 'ALLOPATHY', lang: 'GU', type: 'FOLLOW_UP', complaint: 'પગના અંગૂઠામાં સોજો અને ગાઉટ ફોલો-અપ', answer: 'દવા લીધા પછી સોજો અને લાલિમા ઉતરી ગઈ છે, ચાલવામાં કોઈ દર્દ નથી' },

  // --- GERIATRICS & MULTIMORBIDITY ---
  { id: 41, name: 'Geriatrics - Multimorbid Fall Risk & Polypharmacy (New)', dept: 'GEN', spec: 'Geriatric Medicine', doctor: 'Dr. Yogesh Sharma', carePath: 'ALLOPATHY', lang: 'EN', type: 'NEW', complaint: '78-year-old with unsteadiness while walking, dizziness upon standing, and mild confusion', answer: 'Taking 8 regular medications, had a near-fall incident in bathroom 2 days ago' },
  { id: 42, name: 'Geriatrics - Chronic Hypertension & OA Follow-up (Hindi)', dept: 'GEN', spec: 'Geriatric Medicine', doctor: 'Dr. Yogesh Sharma', carePath: 'ALLOPATHY', lang: 'HI', type: 'FOLLOW_UP', complaint: 'बुजुर्ग मरीज बीपी और घुटनों का दर्द फॉलो-अप', answer: 'बीपी नियंत्रित (130/80) है और घुटने के सपोर्ट से घर में आसानी से चलते हैं' },

  // --- EMERGENCY RED FLAG CRITICAL SCENARIOS ---
  { id: 43, name: 'Emergency - Acute Stroke / Hemiparesis (Red Flag)', dept: 'GEN', spec: 'Emergency Medicine', doctor: 'Dr. Yogesh Sharma', carePath: 'ALLOPATHY', lang: 'EN', type: 'NEW', complaint: 'Sudden right facial drooping, arm weakness and slurred speech (FAST positive)', answer: 'Began suddenly 45 minutes ago while speaking on phone' },
  { id: 44, name: 'Emergency - Severe Anaphylactic Shock (Red Flag, Hindi)', dept: 'GEN', spec: 'Emergency Medicine', doctor: 'Dr. Yogesh Sharma', carePath: 'ALLOPATHY', lang: 'HI', type: 'NEW', complaint: 'गले में घुटन, सांस लेने में भारी घरघराहट और शरीर पर तेजी से फैलते लाल दाने', answer: 'दवा खाने के 15 मिनट बाद अचानक गला बंद होने लगा और सांस फूल गई' },
  { id: 45, name: 'Emergency - Acute Coronary Syndrome (Red Flag, Gujarati)', dept: 'GEN', spec: 'Emergency Medicine', doctor: 'Dr. Yogesh Sharma', carePath: 'ALLOPATHY', lang: 'GU', type: 'NEW', complaint: 'છાતીમાં ભારે વજન, ડાબા હાથમાં અસહ્ય દુખાવો અને ઠંડો પરસેવો', answer: '૩૦ મિનિટથી છાતી ભીંસાતી હોય એવો તીવ્ર દુખાવો અને ગભરામણ થાય છે' },

  // --- INTEGRATIVE COMBINATIONS & EXTENDED PROTOCOLS ---
  { id: 46, name: 'Ayurveda - Vatashonita / Gouty Diathesis (New)', dept: 'AYUSH', spec: 'Ayurveda & Integrative Medicine', doctor: 'Vaidya Harish Bhatt', carePath: 'AYUSH', lang: 'EN', type: 'NEW', complaint: 'Burning throbbing pain in first metatarsophalangeal joint with Pitta aggravation', answer: 'Intense nocturnal pain, aggravated after fermented foods and lentils' },
  { id: 47, name: 'Homeopathy - Bronchial Asthma with Arsenicum Modalities (New)', dept: 'AYUSH', spec: 'Classical Homeopathy', doctor: 'Dr. Snehal Shah', carePath: 'HOMEOPATHY', lang: 'EN', type: 'NEW', complaint: 'Nocturnal suffocation at midnight to 2 AM with intense restlessness and thirst for sips', answer: 'Relieved by sitting upright and warm drinks, aggravated by cold exposure' },
  { id: 48, name: 'General Medicine - Chronic Fatigue & Post-Viral Malaise (New, Hindi)', dept: 'GEN', spec: 'General Medicine', doctor: 'Dr. Yogesh Sharma', carePath: 'ALLOPATHY', lang: 'HI', type: 'NEW', complaint: 'वायरल बुखार के 3 हफ्ते बाद भी लगातार थकान, बदन दर्द और कमजोरी', answer: 'थोड़ा सा काम करने पर भी अत्यधिक थकावट महसूस होती है' },
  { id: 49, name: 'General Medicine - Dyspepsia & Acid Peptic Follow-up (Gujarati)', dept: 'GEN', spec: 'General Medicine', doctor: 'Dr. Yogesh Sharma', carePath: 'ALLOPATHY', lang: 'GU', type: 'FOLLOW_UP', complaint: 'એસિડિટી અને ગેસની તકલીફ ફોલો-અપ', answer: 'ખોરાકમાં ફેરફાર અને પેન્ટોપ્રાઝોલથી એસિડિટીમાં ઘણો આરામ છે' },
  { id: 50, name: 'Cardiology - Post-Stenting 6-Month Review Follow-up', dept: 'GEN', spec: 'Cardiology', doctor: 'Dr. Yogesh Sharma', carePath: 'ALLOPATHY', lang: 'EN', type: 'FOLLOW_UP', complaint: 'Post-PCI Stenting 6-Month Review', answer: 'No chest pain on walking 4 km daily, adhering to Dual Antiplatelet Therapy (DAPT)' },
];

async function run50Cases() {
  console.log(`\n========================================================================`);
  console.log(`  MEDIKIOSK CLINICAL ENGINE: 50-CASE AUTOMATED VERIFICATION SUITE`);
  console.log(`========================================================================\n`);

  // 1. Authenticate demo doctor
  const loginRes = await request('/api/auth/demo-login', 'POST', { role: 'DOCTOR' });
  const docToken = loginRes.data?.token;
  if (!docToken) {
    throw new Error('Failed to obtain doctor auth token');
  }

  // Get active doctor profile from DB
  const docProfile = await prisma.doctorProfile.findFirst({
    include: { user: true, department: true }
  });

  let passCount = 0;
  let failCount = 0;
  const results = [];

  for (const tc of TEST_CASES) {
    const startTime = Date.now();
    try {
      const runTag = Date.now().toString(36);
      const patMrn = `MK-T50-${runTag}-${tc.id}`;
      const patient = await prisma.patient.create({
        data: {
          name: `Patient Case #${tc.id} (${tc.name.split(' - ')[0]})`,
          phone: `98${Math.floor(10000000 + Math.random() * 89999999)}`,
          mrn: patMrn,
          age: 20 + (tc.id % 60),
          gender: tc.id % 2 === 0 ? 'FEMALE' : 'MALE',
          preferredLang: tc.lang,
        }
      });

      // 2. If follow-up, create prior visit
      let priorVisitId = null;
      if (tc.type === 'FOLLOW_UP') {
        const priorVisit = await prisma.visit.create({
          data: {
            patientId: patient.id,
            doctorId: docProfile.id,
            departmentId: docProfile.departmentId,
            token: `P-${tc.id}-0`,
            status: 'COMPLETED',
            reasonForVisit: tc.complaint,
            createdAt: new Date(Date.now() - 30 * 86400000),
          }
        });
        priorVisitId = priorVisit.id;

        // Create prior consultation
        await prisma.consultation.create({
          data: {
            visitId: priorVisit.id,
            doctorId: docProfile.id,
            diagnosis: tc.complaint,
            treatmentPlan: 'Initial therapy initiated. Follow-up advised.',
            status: 'COMPLETED',
          }
        });
      }

      // 3. Create active visit
      const activeVisit = await prisma.visit.create({
        data: {
          patientId: patient.id,
          doctorId: docProfile.id,
          departmentId: docProfile.departmentId,
          token: `T-${String(tc.id).padStart(3, '0')}`,
          status: 'INTAKE_IN_PROGRESS',
          reasonForVisit: tc.complaint,
        }
      });

      // 4. Start AI Intake Session
      const startRes = await request('/api/conversation/start', 'POST', {
        visitId: activeVisit.id,
        language: tc.lang,
        carePath: tc.carePath,
        specialty: tc.spec,
        doctorName: tc.doctor,
        targetComplaint: tc.complaint,
        isNewCase: tc.type === 'NEW',
        followUpVisitId: priorVisitId,
        isReturningPatient: tc.type === 'FOLLOW_UP',
      });

      if (!startRes.data?.session?.id) {
        throw new Error(`Failed to start intake session: ${JSON.stringify(startRes.data)}`);
      }
      const sessionId = startRes.data.session.id;
      const q1 = startRes.data.nextQuestion;
      const opts1 = startRes.data.touchOptions || [];

      // Validate Question 1
      if (!q1 || q1.length < 10) throw new Error('Question 1 empty or too short');
      if (!Array.isArray(opts1) || opts1.length < 2) throw new Error(`Invalid touch options on Turn 1: ${JSON.stringify(opts1)}`);

      // 5. Send Turn 1 Answer
      const msg1Res = await request(`/api/conversation/${sessionId}/message`, 'POST', {
        content: tc.answer,
        language: tc.lang,
        carePath: tc.carePath,
      });

      const q2 = msg1Res.data?.nextQuestion;
      const opts2 = msg1Res.data?.touchOptions || [];
      if (!q2 || q2.length < 10) throw new Error('Question 2 empty or too short');

      // 6. Complete Intake Session
      const completeRes = await request(`/api/conversation/${sessionId}/message`, 'POST', {
        content: tc.lang === 'HI' ? 'धन्यवाद, सब लक्षण बता दिए — पूरा करें' : tc.lang === 'GU' ? 'ધન્યવાદ, તમામ લક્ષણો જણાવી દીધા — પૂર્ણ કરો' : 'Thank you, that covers all symptoms — complete intake',
        language: tc.lang,
        carePath: tc.carePath,
      });

      const closingQ = completeRes.data?.nextQuestion;
      const closingOpts = completeRes.data?.touchOptions || [];
      const isComplete = completeRes.data?.isComplete;

      if (!isComplete) throw new Error('isComplete flag expected to be true on completion turn');
      if (!closingQ || !closingQ.includes('धन्यवाद') && !closingQ.includes('ધન્યવાદ') && !closingQ.includes('Thank you')) {
        throw new Error(`Closing question did not contain thank-you handoff: "${closingQ}"`);
      }

      // 7. Verify Timeline Retrieval for this patient
      const tlRes = await request(`/api/doctor/timeline/${patient.id}`, 'GET', null, docToken);
      const encounterCount = tlRes.data?.timeline?.length || 0;
      const expectedEncounters = tc.type === 'FOLLOW_UP' ? 2 : 1;
      if (encounterCount < expectedEncounters) {
        throw new Error(`Expected at least ${expectedEncounters} encounters in timeline, got ${encounterCount}`);
      }

      const durationMs = Date.now() - startTime;
      passCount++;
      results.push({ id: tc.id, name: tc.name, status: 'PASS', durationMs, q1Preview: q1.slice(0, 50) + '...' });
      console.log(`[PASS] Case #${String(tc.id).padStart(2, '0')}: ${tc.name} (${tc.carePath} | ${tc.lang} | ${tc.type}) [${durationMs}ms]`);
    } catch (err) {
      failCount++;
      const durationMs = Date.now() - startTime;
      results.push({ id: tc.id, name: tc.name, status: 'FAIL', error: err.message, durationMs });
      console.error(`[FAIL] Case #${String(tc.id).padStart(2, '0')}: ${tc.name} -> Error: ${err.message}`);
    }
  }

  console.log(`\n========================================================================`);
  console.log(`  FINAL RESULTS: ${passCount} PASSED / ${failCount} FAILED out of ${TEST_CASES.length} Cases`);
  console.log(`========================================================================\n`);

  await prisma.$disconnect();
  return { passCount, failCount, total: TEST_CASES.length };
}

run50Cases().catch(async (e) => {
  console.error('Fatal Test Suite Error:', e);
  await prisma.$disconnect();
});
