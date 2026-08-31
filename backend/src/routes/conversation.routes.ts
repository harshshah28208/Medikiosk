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
  const {
    visitId,
    language = 'EN',
    isAyush = false,
    isHomeopathy = false,
    carePath: requestedCarePath,
    respondentType = 'PATIENT',
    isReturningPatient,
    recentChanges,
    previousPatientInfo,
  } = req.body;

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

  // Check if patient is returning (has prior visit records or flagged as returning)
  const priorVisits = await prisma.visit.findMany({
    where: {
      patientId: visit.patientId,
      id: { not: visit.id },
    },
    orderBy: { createdAt: 'desc' },
    take: 1,
    include: {
      summary: true,
      clinicalHistory: true,
      consultation: true,
      sessions: {
        orderBy: { startedAt: 'desc' },
        take: 1,
      },
      prescriptions: { include: { items: true } },
      department: true,
      doctor: { include: { user: true } },
    },
  });

  const isExistingPatient = Boolean(isReturningPatient || priorVisits.length > 0 || previousPatientInfo?.visits?.length > 0 || recentChanges);
  const isNewPatient = !isExistingPatient;

  let previousVisitInfo: any = undefined;
  if (priorVisits.length > 0 && priorVisits[0]) {
    const pv = priorVisits[0];
    const prevDocName = pv.doctor?.user?.name ? `Dr. ${pv.doctor.user.name}` : undefined;

    // Search all clinical layers for the true clinical complaint
    let extractedComplaint = pv.clinicalHistory?.chiefComplaint || pv.consultation?.diagnosis;
    if (!extractedComplaint && pv.sessions?.[0]?.clinicalState) {
      try {
        const parsedState = JSON.parse(pv.sessions[0].clinicalState);
        extractedComplaint = parsedState.chiefComplaint || parsedState.symptoms?.[0]?.name;
      } catch (e) {}
    }
    if (!extractedComplaint && pv.summary?.summaryJson) {
      try {
        const parsedSum = JSON.parse(pv.summary.summaryJson);
        extractedComplaint = parsedSum.chiefComplaint || parsedSum.overview;
      } catch (e) {}
    }
    if (!extractedComplaint || /follow-?up|consultation|routine|checkup|general/i.test(extractedComplaint)) {
      if (pv.reasonForVisit && !/follow-?up|consultation|routine/i.test(pv.reasonForVisit)) {
        extractedComplaint = pv.reasonForVisit;
      } else if (pv.clinicalHistory?.hpiNarrative) {
        extractedComplaint = pv.clinicalHistory.hpiNarrative;
      } else if (pv.consultation?.impression || pv.consultation?.clinicalNotes) {
        extractedComplaint = pv.consultation.impression || pv.consultation.clinicalNotes;
      } else {
        extractedComplaint = 'Previous health complaint';
      }
    }

    previousVisitInfo = {
      lastVisitDate: pv.createdAt.toLocaleDateString(),
      lastComplaint: extractedComplaint,
      lastDepartment: pv.department?.name || 'General OPD',
      lastDoctor: prevDocName || 'Dr. Vikram',
      pastPrescriptions: pv.prescriptions?.[0]?.items?.map((i: any) => i.medicationName) || [],
    };
  } else if (isExistingPatient) {
    const lastV = previousPatientInfo?.visits?.[0];
    let extractedComplaint = lastV?.clinicalHistory?.chiefComplaint || lastV?.reasonForVisit;
    if (!extractedComplaint || /follow-?up|consultation/i.test(extractedComplaint)) {
      extractedComplaint = previousPatientInfo?.medicalHistory || 'Previous health complaint';
    }
    previousVisitInfo = {
      lastVisitDate: lastV?.createdAt ? new Date(lastV.createdAt).toLocaleDateString() : 'Recent Visit',
      lastComplaint: extractedComplaint,
      lastDepartment: lastV?.department?.name || 'General OPD',
      lastDoctor: 'Dr. Vikram',
      pastPrescriptions: lastV?.prescriptions?.[0]?.items?.map((i: any) => i.medicationName) || ['Multivitamin & Zinc supplement daily'],
    };
  }

  const deptName = visit.department?.name || '';
  const isHomeo = isHomeopathy || requestedCarePath === 'HOMEOPATHY' || deptName.toLowerCase().includes('homeopath');
  const isAyu = isAyush || requestedCarePath === 'AYUSH' || deptName.toLowerCase().includes('ayush') || deptName.toLowerCase().includes('ayurved');
  const carePath: 'ALLOPATHY' | 'AYUSH' | 'HOMEOPATHY' = requestedCarePath || (isHomeo ? 'HOMEOPATHY' : (isAyu ? 'AYUSH' : 'ALLOPATHY'));
  const specialty = req.body.specialty || visit.doctor?.specialization || visit.department?.name || 'General Medicine';

  const initialState = createInitialClinicalState(initialLang, respType, carePath, specialty);
  initialState.isNewPatient = isNewPatient;
  initialState.previousVisitInfo = previousVisitInfo;
  if (recentChanges) {
    initialState.latestAnswer = `Reported change since last visit: ${recentChanges}`;
  }

  // Fetch prior visit's conversation messages and consultation history for complete clinical memory
  let priorVisitChatHistory: Array<{ role: string; content: string }> = [];
  try {
    const priorSession = await prisma.conversationSession.findFirst({
      where: {
        visit: {
          patientId: visit.patientId,
          id: { not: visit.id },
        },
      },
      orderBy: { startedAt: 'desc' },
      include: {
        messages: {
          orderBy: { timestamp: 'asc' },
          select: { role: true, content: true },
        },
      },
    });
    if (priorSession?.messages?.length) {
      priorVisitChatHistory = priorSession.messages.map(m => ({
        role: m.role === 'AI' ? 'Previous Visit Doctor AI' : 'Previous Visit Patient',
        content: m.content,
      }));
    }
  } catch (e) {
    console.warn('Prior chat history fetch notice:', e);
  }

  // Generate dynamic opening question entirely from live Groq AI using stored prior history
  const activeAi = getAIProvider();
  const initialAIOutput = await activeAi.generateNextQuestion(initialState, initialLang, carePath, specialty, priorVisitChatHistory);
  initialState.questionsAsked = [initialAIOutput.question];

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

  const welcomeMsg = await prisma.conversationMessage.create({
    data: {
      sessionId: session.id,
      role: 'AI',
      content: initialAIOutput.question,
      contentLang: initialLang,
      inputMethod: 'TEXT',
      metadata: JSON.stringify({ options: initialAIOutput.touchOptions, category: initialAIOutput.questionCategory }),
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
    touchOptions: initialAIOutput.touchOptions,
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
  });

  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  let state = typeof session.clinicalState === 'string' ? JSON.parse(session.clinicalState) : (session.clinicalState as unknown as ClinicalState);
  state.currentLanguage = lang;

  // Translate all input messages and touch options in parallel for ultra-fast response
  const translatedMessages = await Promise.all(
    messages.map(async (m: any) => {
      const translatedContent = m.content ? await aiProvider.translateText(m.content, lang) : m.content;

      let translatedOpts = m.options;
      if (Array.isArray(m.options) && m.options.length > 0) {
        translatedOpts = await Promise.all(
          m.options.map((opt: string) => (opt ? aiProvider.translateText(opt, lang) : opt))
        );
      }

      return {
        id: m.id,
        role: m.role,
        content: translatedContent,
        timestamp: m.timestamp,
        options: translatedOpts,
      };
    })
  );

  await prisma.conversationSession.update({
    where: { id: sessionId },
    data: {
      language: lang,
      clinicalState: JSON.stringify(state),
    },
  });

  const lastAI = [...translatedMessages].reverse().find((m) => m.role === 'AI');

  res.json({
    language: lang,
    translatedMessages,
    latestQuestion: lastAI?.content || '',
    touchOptions: lastAI?.options || [],
    clinicalState: state,
  });
});

/**
 * POST /api/conversation/:sessionId/message
 * Process a patient response (Voice transcript, text, or touch).
 */
router.post('/:sessionId/message', async (req: AuthRequest, res: Response): Promise<void> => {
  const sessionId = typeof req.params.sessionId === 'string' ? req.params.sessionId : req.params.sessionId[0];
  const { content, inputMethod = 'VOICE', language = 'EN', rawTranscript, isAyush = false, isHomeopathy = false, carePath: requestedCarePath } = req.body;

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

  const deptName = session.visit.department?.name || '';
  const isHomeo = isHomeopathy || requestedCarePath === 'HOMEOPATHY' || deptName.toLowerCase().includes('homeopath') || state.carePath === 'HOMEOPATHY';
  const isAyu = isAyush || requestedCarePath === 'AYUSH' || deptName.toLowerCase().includes('ayush') || deptName.toLowerCase().includes('ayurved') || state.carePath === 'AYUSH';
  const carePath: 'ALLOPATHY' | 'AYUSH' | 'HOMEOPATHY' = requestedCarePath || (isHomeo ? 'HOMEOPATHY' : (isAyu ? 'AYUSH' : (state.carePath || 'ALLOPATHY')));
  const specialty = state.specialty || session.visit.doctor?.specialization || session.visit.department?.name || 'General Medicine';

  // 2. Fact Extraction via Live Autonomous Clinical AI
  const activeAi = getAIProvider();
  const extractedFacts = await activeAi.extractFacts(content, state, currentLang, carePath, specialty);

  // Check if patient selected completion option or completed intake
  const isFinalAnswer =
    /intake is complete|proceed to consultation|covers all symptoms|complete intake|सब लक्षण बता दिए|सब बता दिया|ઇન્ટેક પૂર્ણ|ડૉક્ટર પાસે જવું|no further/i.test(content) ||
    state.turnsCompleted >= 8;

  // 3. Update Clinical State & Increment Turn
  state = {
    ...state,
    ...extractedFacts,
    carePath,
    specialty,
    latestAnswer: content.trim(),
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

  // 5. Generate Next Dynamic Context-Specific Question with full transcript history
  const pastMessages = await prisma.conversationMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { timestamp: 'asc' },
    select: { role: true, content: true },
  });

  // Query prior visit's conversation messages for complete historical context
  let priorVisitChatHistory: Array<{ role: string; content: string }> = [];
  try {
    const priorSession = await prisma.conversationSession.findFirst({
      where: {
        visit: {
          patientId: session.visit.patientId,
          id: { not: session.visitId },
        },
      },
      orderBy: { startedAt: 'desc' },
      include: {
        messages: {
          orderBy: { timestamp: 'asc' },
          select: { role: true, content: true },
        },
      },
    });
    if (priorSession?.messages?.length) {
      priorVisitChatHistory = priorSession.messages.map(m => ({
        role: m.role === 'AI' ? 'Previous Visit Doctor AI' : 'Previous Visit Patient',
        content: m.content,
      }));
    }
  } catch (e) {
    console.warn('Prior chat history fetch notice:', e);
  }

  const combinedHistory = [...priorVisitChatHistory, ...pastMessages];
  const nextQ = await activeAi.generateNextQuestion(state, currentLang, carePath, specialty, combinedHistory);
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
        include: {
          patient: true,
          vitals: { orderBy: { recordedAt: 'desc' } },
          documents: { include: { extractions: true } },
          department: true,
        },
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

  const deptName = visit.department?.name || '';
  const isHomeo = deptName.toLowerCase().includes('homeopath') || state.carePath === 'HOMEOPATHY';
  const isAyu = deptName.toLowerCase().includes('ayush') || deptName.toLowerCase().includes('ayurved') || state.carePath === 'AYUSH';
  const carePath: 'ALLOPATHY' | 'AYUSH' | 'HOMEOPATHY' = isHomeo ? 'HOMEOPATHY' : (isAyu ? 'AYUSH' : (state.carePath || 'ALLOPATHY'));
  const specialty = state.specialty || visit.doctor?.specialization || visit.department?.name || 'General Medicine';

  const summaryDraft = await aiProvider.generateClinicalSummary(
    state,
    visit.patient,
    visit.vitals?.[0],
    visit.documents,
    carePath,
    specialty
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
