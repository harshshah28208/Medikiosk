import { Router, Response } from 'express';
import https from 'https';
import prisma from '../config/db.js';
import { getAIProvider } from '../ai/AIProvider.js';
import { RedFlagEngine } from '../ai/RedFlagEngine.js';
import { createInitialClinicalState, type ClinicalState } from '../ai/ClinicalState.js';
import { createAuditLog } from '../middleware/audit.js';
import { AUDIT_ACTIONS, SOCKET_EVENTS } from '../config/constants.js';
import type { AuthRequest } from '../middleware/auth.js';

const router = Router();
const aiProvider = getAIProvider();

/**
 * GET /api/conversation/tts
 * Generates natural audio for Gujarati, Hindi, and English streams.
 */
router.get('/tts', async (req: AuthRequest, res: Response): Promise<void> => {
  const text = (req.query.text as string || '').trim();
  const lang = (req.query.lang as string || 'en').toLowerCase();

  if (!text) {
    res.status(400).send('Text is required');
    return;
  }

  const targetLang = lang === 'gu' ? 'gu' : lang === 'hi' ? 'hi' : 'en';
  const cleanText = text.replace(/[*_#`]/g, '').slice(0, 300);
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText)}&tl=${targetLang}&client=tw-ob`;

  try {
    const ttsReq = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    }, (ttsRes) => {
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      ttsRes.pipe(res);
    });

    ttsReq.on('error', (err) => {
      console.warn('TTS proxy error:', err);
      res.status(500).send('TTS error');
    });
  } catch (e) {
    res.status(500).send('TTS error');
  }
});

/**
 * POST /api/conversation/start
 * Initialize a new AI conversation session for a visit.
 */
router.post('/start', async (req: AuthRequest, res: Response): Promise<void> => {
  const { visitId, language = 'EN', isAyush = false, respondentType = 'PATIENT' } = req.body;

  if (!visitId) {
    res.status(400).json({ error: 'visitId is required' });
    return;
  }

  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: { patient: true, department: true },
  });

  if (!visit) {
    res.status(404).json({ error: 'Visit not found' });
    return;
  }

  const initialLang = (language.toUpperCase() as 'EN' | 'HI' | 'GU') || 'EN';
  const respType = (respondentType as 'PATIENT' | 'CAREGIVER' | 'STAFF_ASSISTED') || 'PATIENT';
  const isCaregiver = respType === 'CAREGIVER' || respType === 'STAFF_ASSISTED';

  // Check if patient is returning (only if visitType is RETURN/FOLLOW_UP or has past completed visits)
  let priorVisits: any[] = [];
  if (visit.visitType !== 'NEW') {
    priorVisits = await prisma.visit.findMany({
      where: {
        patientId: visit.patientId,
        id: { not: visit.id },
        status: { in: ['COMPLETED', 'DISCHARGED'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
      include: { summary: true, prescriptions: { include: { items: true } }, department: true },
    });
  }

  const isExistingPatient = priorVisits.length > 0;
  const isNewPatient = !isExistingPatient;

  let previousVisitInfo = undefined;
  if (isExistingPatient && priorVisits[0]) {
    const pv = priorVisits[0];
    previousVisitInfo = {
      lastVisitDate: pv.createdAt.toLocaleDateString(),
      lastComplaint: pv.reasonForVisit || (pv.summary?.summaryJson ? JSON.parse(pv.summary.summaryJson)?.chiefComplaint : null) || 'Prior Consultation',
      lastDepartment: pv.department?.name || 'General OPD',
      pastPrescriptions: pv.prescriptions?.[0]?.items?.map((i: any) => i.medicationName) || [],
    };
  }

  const initialState = createInitialClinicalState(initialLang, respType);
  initialState.isNewPatient = isNewPatient;
  initialState.previousVisitInfo = previousVisitInfo;

  const session = await prisma.conversationSession.create({
    data: {
      visitId: visit.id,
      language: initialLang,
      inputMethod: 'VOICE',
      status: 'ACTIVE',
      clinicalState: JSON.stringify(initialState),
    },
  });

  // Update visit status
  await prisma.visit.update({
    where: { id: visit.id },
    data: { status: 'IN_INTAKE' },
  });

  // Tailored greetings for New vs. Returning Patients
  const lastComplaintStr = previousVisitInfo?.lastComplaint ? ` (${previousVisitInfo.lastComplaint})` : '';

  const initialGreetings = {
    EN: isExistingPatient
      ? (isCaregiver
          ? `Welcome back. Compared to the patient's previous visit${lastComplaintStr}, what has changed with their health? Have their symptoms improved, worsened, or are you visiting for a new problem today?`
          : `Welcome back to the hospital! Compared to your previous visit${lastComplaintStr}, what has changed with your health? Have your symptoms improved, worsened, or do you have a new problem today?`)
      : (isCaregiver
          ? `Hello and welcome. I am MediKiosk. Since you are providing health information for the patient today, please tell me what symptoms or health concerns the patient is experiencing.`
          : `Hello and welcome! I am MediKiosk, your clinical intake assistant. Please tell me what symptoms or health concerns brought you to the hospital today.`),
    HI: isExistingPatient
      ? (isCaregiver
          ? `अस्पताल में पुनः स्वागत है। मरीज की पिछली मुलाकात${lastComplaintStr} के बाद से उनकी तबीयत में क्या बदलाव आया है? क्या पहले से सुधार है, तकलीफ बढ़ी है, या कोई नई परेशानी है?`
          : `अस्पताल में आपका पुनः स्वागत है! आपकी पिछली मुलाकात${lastComplaintStr} के बाद से आपकी सेहत में क्या बदलाव आया है? क्या पहले से सुधार है, तकलीफ बढ़ी है, या कोई नई समस्या है?`)
      : (isCaregiver
          ? `नमस्ते और स्वागत है। मैं मेडीकियोस्क सहायक हूँ। चूंकि आप मरीज की ओर से विवरण दे रहे हैं, कृपया बताएं कि मरीज को आज क्या तकलीफ या लक्षण महसूस हो रहे हैं?`
          : `नमस्ते और स्वागत है! मैं मेडीकियोस्क क्लिनिकल सहायक हूँ। कृपया मुझे बताएं कि आज आपको क्या परेशानी या मुख्य लक्षण महसूस हो रहे हैं?`),
    GU: isExistingPatient
      ? (isCaregiver
          ? `હોસ્પિટલમાં ફરી સ્વાગત છે. દર્દીની છેલ્લી મુલાકાત${lastComplaintStr} પછી તેમની સ્થિતિમાં શું બદલાવ આવ્યો છે? શું જૂની તકલીફમાં સુધારો છે, તકલીફ વધી છે, કે નવી સમસ્યા છે?`
          : `હોસ્પિટલમાં આપનું ફરી સ્વાગત છે! આપની છેલ્લી મુલાકાત${lastComplaintStr} પછી આપની તબિયતમાં શું ફેરફાર થયો છે? જૂની તકલીફમાં રાહત છે, તકલીફ વધી છે, કે આજે કોઈ નવી ફરિયાદ છે?`)
      : (isCaregiver
          ? `નમસ્તે અને સ્વાગત છે. હું મેડીકિયોસ્ક સહાયક છું. આપ દર્દી વતી વિગત આપી રહ્યા છો, તો કૃપા કરીને જણાવો કે દર્દીને આજે કઈ તકલીફ થઈ રહી છે?`
          : `નમસ્તે અને સ્વાગત છે! હું મેડીકિયોસ્ક સહાયક છું. કૃપા કરીને મને જણાવો કે આજે તમને કઈ તકલીફ કે મુખ્ય લક્ષણો થઈ રહ્યા છે?`),
  };

  const initialOptions = {
    EN: isExistingPatient
      ? ['Previous symptoms improved / Routine review', 'Symptoms worsened / No significant relief', 'Completely new symptom/problem today', 'Medicines finished / Need refill & checkup']
      : ['Fever & Cough', 'Pimples / Skin rash', 'Stomach / Abdominal discomfort', 'Chest heaviness', 'Unusual tiredness / Weakness', 'Joint or body pain'],
    HI: isExistingPatient
      ? ['पुरानी तकलीफ में काफी सुधार है / फॉलो-अप', 'तकलीफ बढ़ गई है / आराम नहीं मिला', 'आज पूरी तरह नई समस्या है', 'दवाइयां समाप्त / दोबारा जांच']
      : ['बुखार और खांसी', 'मुँहासे / त्वचा में दाने', 'पेट में दर्द या भारीपन', 'सीने में तकलीफ', 'असामान्य कमजोरी व थकान', 'जोड़ों या शरीर में दर्द'],
    GU: isExistingPatient
      ? ['જૂની તકલીફમાં સારો સુધારો છે / ફોલો-અપ', 'તકલીફ વધી ગઈ છે / રાહત નથી', 'આજે સાવ નવી જ સમસ્યા છે', 'દવાઓ પૂર્ણ થઈ / ફરી તપાસ']
      : ['તાવ અને ઉધરસ', 'ખીલ / ચામડી પર ચકામા', 'પેટમાં દુખાવો', 'છાતીમાં ભારેપણું', 'અસામાન્ય થાક અને નબળાઈ', 'સાંધા કે શરીરમાં દુખાવો'],
  };

  const welcomeMsg = await prisma.conversationMessage.create({
    data: {
      sessionId: session.id,
      role: 'AI',
      content: initialGreetings[initialLang],
      contentLang: initialLang,
      inputMethod: 'TEXT',
      metadata: JSON.stringify({ options: initialOptions[initialLang] }),
    },
  });

  await createAuditLog({
    userId: req.user?.id,
    role: req.user?.role,
    action: AUDIT_ACTIONS.START_INTAKE,
    resourceType: 'CONVERSATION_SESSION',
    resourceId: session.id,
    details: { visitId, language: initialLang, isNewPatient },
  });

  res.status(201).json({
    session: {
      id: session.id,
      visitId: session.visitId,
      language: session.language,
      clinicalState: initialState,
    },
    message: welcomeMsg,
    touchOptions: initialOptions[initialLang],
  });
});

/**
 * POST /api/conversation/:sessionId/switch-language
 * Translates all messages in the active conversation stream to the target language.
 */
router.post('/:sessionId/switch-language', async (req: AuthRequest, res: Response): Promise<void> => {
  const sessionId = typeof req.params.sessionId === 'string' ? req.params.sessionId : req.params.sessionId[0];
  const { targetLanguage = 'GU', messages = [] } = req.body;
  const lang = (targetLanguage.toUpperCase() as 'EN' | 'HI' | 'GU') || 'EN';

  const session = await prisma.conversationSession.findUnique({
    where: { id: sessionId },
    include: {
      messages: { orderBy: { timestamp: 'asc' } },
    },
  });

  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  let state = typeof session.clinicalState === 'string' ? JSON.parse(session.clinicalState) : session.clinicalState as unknown as ClinicalState;
  state.currentLanguage = lang;

  // Translate all input messages provided from the client
  const translatedMessages: Array<{ id: string; role: string; content: string; timestamp: string; options?: string[] }> = [];

  for (const m of messages) {
    let translated = m.content;
    if (m.content) {
      translated = await aiProvider.translateText(m.content, lang);
    }
    translatedMessages.push({
      id: m.id,
      role: m.role,
      content: translated,
      timestamp: m.timestamp,
      options: m.options,
    });
  }

  // Generate appropriate touch options in target language for current state
  const nextQ = await aiProvider.generateNextQuestion(state, lang);

  await prisma.conversationSession.update({
    where: { id: sessionId },
    data: {
      language: lang,
      clinicalState: JSON.stringify(state),
    },
  });

  const lastAI = [...translatedMessages].reverse().find(m => m.role === 'AI');

  res.json({
    language: lang,
    translatedMessages,
    latestQuestion: lastAI?.content || nextQ.question,
    touchOptions: nextQ.touchOptions,
    clinicalState: state,
  });
});

/**
 * POST /api/conversation/:sessionId/message
 * Process a patient response (Voice transcript, text, or touch).
 */
router.post('/:sessionId/message', async (req: AuthRequest, res: Response): Promise<void> => {
  const sessionId = typeof req.params.sessionId === 'string' ? req.params.sessionId : req.params.sessionId[0];
  const { content, inputMethod = 'VOICE', language = 'EN', rawTranscript, isAyush = false } = req.body;

  if (!content || !content.trim()) {
    res.status(400).json({ error: 'Message content is required' });
    return;
  }

  const session = await prisma.conversationSession.findUnique({
    where: { id: sessionId },
    include: {
      visit: {
        include: { patient: true, department: true },
      },
    },
  });

  if (!session) {
    res.status(404).json({ error: 'Conversation session not found' });
    return;
  }

  const currentLang = (language.toUpperCase() as 'EN' | 'HI' | 'GU') || (session.language as 'EN' | 'HI' | 'GU');
  let state = typeof session.clinicalState === 'string' ? JSON.parse(session.clinicalState) : session.clinicalState as unknown as ClinicalState;

  // 1. Save Patient Message
  await prisma.conversationMessage.create({
    data: {
      sessionId: session.id,
      role: 'PATIENT',
      content: content.trim(),
      contentLang: currentLang,
      inputMethod,
      rawTranscript: rawTranscript || content,
    },
  });

  // 2. Fact Extraction via General Clinical Engine
  const extractedFacts = await aiProvider.extractFacts(content, state, currentLang);

  // Check if patient selected completion option or completed intake
  const isFinalAnswer =
    /intake is complete|proceed to consultation|covers all symptoms|complete intake|सब लक्षण बता दिए|सब बता दिया|ઇન્ટેક પૂર્ણ|ડૉક્ટર પાસે જવું|no further/i.test(content) ||
    state.turnsCompleted >= 8;

  // 3. Update Clinical State & Increment Turn
  state = {
    ...state,
    ...extractedFacts,
    turnsCompleted: (state.turnsCompleted || 0) + 1,
    currentLanguage: currentLang,
  };

  // 4. Deterministic Red Flag Safety Evaluation
  const detectedAlerts = RedFlagEngine.evaluate(state, content);
  const io = req.app.get('io');

  if (detectedAlerts.length > 0) {
    for (const alert of detectedAlerts) {
      const createdAlert = await prisma.emergencyAlert.create({
        data: {
          visitId: session.visitId,
          patientId: session.visit.patientId,
          alertType: alert.type,
          severity: alert.severity,
          description: `${alert.symptoms} — ${alert.description}`,
          triggerSource: 'RED_FLAG_ENGINE',
          status: 'UNACKNOWLEDGED',
        },
      });

      await prisma.visit.update({
        where: { id: session.visitId },
        data: { priority: alert.severity === 'CRITICAL' ? 'EMERGENCY' : 'URGENT' },
      });

      await prisma.queueEntry.updateMany({
        where: { visitId: session.visitId },
        data: { priority: alert.severity === 'CRITICAL' ? 'EMERGENCY' : 'URGENT' },
      });

      if (io) {
        io.emit(SOCKET_EVENTS.RED_FLAG_ALERT, {
          alertId: createdAlert.id,
          visitId: session.visitId,
          patientName: session.visit.patient.name,
          mrn: session.visit.patient.mrn,
          token: session.visit.token,
          department: session.visit.department.name,
          symptoms: alert.symptoms,
          severity: alert.severity,
          timestamp: new Date().toISOString(),
        });
      }

      state.redFlags.push({
        type: alert.type,
        severity: alert.severity,
        description: alert.description,
        detectedAt: new Date().toISOString(),
        source: 'RULE',
      });
    }
  }

  // 5. Generate Next Dynamic Context-Specific Question
  const nextQ = await aiProvider.generateNextQuestion(state, currentLang, isAyush);
  state.questionsAsked = [...(state.questionsAsked || []), nextQ.question];

  // 6. Save Updated State back to DB
  await prisma.conversationSession.update({
    where: { id: sessionId },
    data: {
      clinicalState: JSON.stringify(state),
      language: currentLang,
    },
  });

  // 7. Save AI Question Message
  const aiMessage = await prisma.conversationMessage.create({
    data: {
      sessionId: session.id,
      role: 'AI',
      content: nextQ.question,
      contentLang: currentLang,
      inputMethod: 'TEXT',
      metadata: JSON.stringify({ options: nextQ.touchOptions, category: nextQ.questionCategory }),
    },
  });

  res.json({
    aiMessage,
    nextQuestion: nextQ.question,
    touchOptions: nextQ.touchOptions,
    isComplete: nextQ.isComplete || isFinalAnswer,
    hasRedFlag: detectedAlerts.length > 0,
    redFlagAlert: detectedAlerts[0] || null,
    clinicalState: state,
  });
});

/**
 * POST /api/conversation/:sessionId/complete
 * Finalize conversation, store structured ClinicalHistory & ClinicalSummary draft,
 * update longitudinal Patient Medication and Allergy profiles, and generate FollowUp appointment.
 */
router.post('/:sessionId/complete', async (req: AuthRequest, res: Response): Promise<void> => {
  const sessionId = typeof req.params.sessionId === 'string' ? req.params.sessionId : req.params.sessionId[0];

  const session = await prisma.conversationSession.findUnique({
    where: { id: sessionId },
    include: {
      visit: {
        include: { patient: true, vitals: true, documents: true, department: true },
      },
      messages: { orderBy: { timestamp: 'asc' } },
    },
  });

  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const state = typeof session.clinicalState === 'string' ? JSON.parse(session.clinicalState) : session.clinicalState as unknown as ClinicalState;
  const visit = session.visit;
  const patient = visit.patient;

  const summaryDraft = await aiProvider.generateClinicalSummary(
    state,
    visit.patient,
    visit.vitals?.[0],
    visit.documents
  );

  const clinicalHistory = await prisma.clinicalHistory.upsert({
    where: { visitId: visit.id },
    update: {
      status: 'COMPLETED',
      chiefComplaint: state.chiefComplaint || 'OPD Intake',
      hpiNarrative: summaryDraft.historyOfPresentIllness,
      hpiStructured: JSON.stringify(state.symptoms),
      pastMedicalHistory: JSON.stringify(state.pastMedicalHistory),
      medications: JSON.stringify(state.medications),
      allergies: JSON.stringify(state.allergies),
      redFlagsIdentified: JSON.stringify(state.redFlags),
      completionScore: 100,
    },
    create: {
      visitId: visit.id,
      patientId: visit.patientId,
      status: 'COMPLETED',
      chiefComplaint: state.chiefComplaint || 'OPD Intake',
      hpiNarrative: summaryDraft.historyOfPresentIllness,
      hpiStructured: JSON.stringify(state.symptoms),
      pastMedicalHistory: JSON.stringify(state.pastMedicalHistory),
      medications: JSON.stringify(state.medications),
      allergies: JSON.stringify(state.allergies),
      redFlagsIdentified: JSON.stringify(state.redFlags),
      completionScore: 100,
    },
  });

  const clinicalSummary = await prisma.clinicalSummary.upsert({
    where: { visitId: visit.id },
    update: {
      status: 'DRAFT',
      summaryJson: JSON.stringify(summaryDraft),
      sourceMapping: JSON.stringify(summaryDraft.sourceMap || {}),
      originalDraft: JSON.stringify(summaryDraft),
    },
    create: {
      visitId: visit.id,
      patientId: visit.patientId,
      status: 'DRAFT',
      summaryJson: JSON.stringify(summaryDraft),
      sourceMapping: JSON.stringify(summaryDraft.sourceMap || {}),
      originalDraft: JSON.stringify(summaryDraft),
    },
  });

  // Longitudinal Records Update: Store any reported regular medications into Patient Medication table
  if (state.medications && state.medications.length > 0) {
    for (const med of state.medications) {
      if (med.name && med.name.trim()) {
        const existingMed = await prisma.medication.findFirst({
          where: { patientId: patient.id, name: med.name.trim() },
        });
        if (!existingMed) {
          await prisma.medication.create({
            data: {
              patientId: patient.id,
              name: med.name.trim(),
              dosage: med.dose || 'As reported',
              frequency: med.frequency || 'Regular',
              status: 'ACTIVE',
              source: 'PATIENT_REPORTED_KIOSK',
            },
          });
        }
      }
    }
  }

  // Longitudinal Records Update: Store any reported drug/food allergies into Patient Allergy table
  if (state.allergies && state.allergies.length > 0) {
    for (const alg of state.allergies) {
      if (alg.allergen && alg.allergen.trim()) {
        const existingAlg = await prisma.allergy.findFirst({
          where: { patientId: patient.id, allergen: alg.allergen.trim() },
        });
        if (!existingAlg) {
          await prisma.allergy.create({
            data: {
              patientId: patient.id,
              allergen: alg.allergen.trim(),
              reaction: alg.reaction || 'Hypersensitivity',
              severity: (alg.severity as string) || 'MODERATE',
              status: 'ACTIVE',
            },
          });
        }
      }
    }
  }

  // Appointment Generation: Create OPD appointment / handover slot
  const appointmentDate = new Date();
  appointmentDate.setMinutes(appointmentDate.getMinutes() + 15);

  const followUpAppointment = await prisma.followUp.create({
    data: {
      visitId: visit.id,
      patientId: patient.id,
      departmentId: visit.departmentId,
      scheduledAt: appointmentDate,
      reason: `OPD Consultation for ${state.chiefComplaint || 'Reported Symptoms'}`,
      status: 'SCHEDULED',
    },
  });

  await prisma.visit.update({
    where: { id: visit.id },
    data: { status: 'INTAKE_COMPLETE' },
  });

  await prisma.conversationSession.update({
    where: { id: sessionId },
    data: { status: 'COMPLETED', completedAt: new Date() },
  });

  await createAuditLog({
    userId: req.user?.id,
    role: req.user?.role,
    action: AUDIT_ACTIONS.COMPLETE_INTAKE,
    resourceType: 'CLINICAL_HISTORY',
    resourceId: clinicalHistory.id,
    details: { visitId: visit.id, chiefComplaint: state.chiefComplaint },
  });

  res.json({
    message: 'Clinical intake completed successfully',
    clinicalHistory,
    clinicalSummary,
    appointment: followUpAppointment,
  });
});

export default router;
