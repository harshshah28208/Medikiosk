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
    include: {
      patient: true,
      department: true,
      doctor: { include: { user: true } },
    },
  });

  if (!visit) {
    res.status(404).json({ error: 'Visit not found' });
    return;
  }

  const initialLang = (language.toUpperCase() as 'EN' | 'HI' | 'GU') || 'EN';
  const respType = (respondentType as 'PATIENT' | 'CAREGIVER' | 'STAFF_ASSISTED') || 'PATIENT';
  const isCaregiver = respType === 'CAREGIVER' || respType === 'STAFF_ASSISTED';

  // Check if patient is returning (has prior visit records or flagged as returning)
  const deptName = visit.department?.name || '';
  const isHomeo = isHomeopathy || requestedCarePath === 'HOMEOPATHY' || deptName.toLowerCase().includes('homeopath');
  const isAyu = isAyush || requestedCarePath === 'AYUSH' || deptName.toLowerCase().includes('ayush') || deptName.toLowerCase().includes('ayurved');
  const carePath: 'ALLOPATHY' | 'AYUSH' | 'HOMEOPATHY' = requestedCarePath || (isHomeo ? 'HOMEOPATHY' : (isAyu ? 'AYUSH' : 'ALLOPATHY'));
  const doctorName = req.body.doctorName || (visit as any).doctor?.user?.name || (visit as any).doctor?.name || null;
  const specialty = req.body.specialty || (visit as any).doctor?.specialization || visit.department?.name || 'General Medicine';

  // Check if patient explicitly requested a NEW CASE or is not a follow-up
  const isExplicitNewCase = req.body.isNewCase === true ||
    req.body.visitType === 'NEW_CASE' ||
    req.body.isReturningPatient === false ||
    (!req.body.isReturningPatient && !req.body.followUpVisitId && !req.body.recentChanges) ||
    Boolean(visit.reasonForVisit && /new complaint|new symptom|new problem|नई समस्या|નવી સમસ્યા/i.test(visit.reasonForVisit));

  // Fetch prior completed visits for this patient ONLY if this is a genuine follow-up
  const allPriorVisits = isExplicitNewCase ? [] : await prisma.visit.findMany({
    where: {
      patientId: visit.patientId,
      id: { not: visit.id },
    },
    orderBy: { createdAt: 'desc' },
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

  let previousVisitInfo: any = undefined;
  let matchingPriorSessionId: string | null = null;
  let isNewPatient = true;

  if (!isExplicitNewCase && allPriorVisits.length > 0) {
    // Determine the most relevant prior encounter for this care path and complaint
    let matchedVisit: any = null;

    // 1. If explicit followUpVisitId is provided
    if (req.body.followUpVisitId) {
      matchedVisit = allPriorVisits.find(v => v.id === req.body.followUpVisitId);
    }

    // 2. Otherwise, find prior visits within the SAME Care Path with scoring
    if (!matchedVisit) {
      const scoredVisits = allPriorVisits
        .map(v => {
          let vCarePath = 'ALLOPATHY';
          let vDeptScore = 0;
          let vSummaryCarePath = 'ALLOPATHY';

          // Determine visit care path from session
          if (v.sessions?.[0]?.clinicalState) {
            try {
              const st = JSON.parse(v.sessions[0].clinicalState);
              if (st.carePath) vCarePath = st.carePath;
            } catch (e) {}
          }

          // Determine visit care path from summary
          if (v.summary?.summaryJson) {
            try {
              const sum = JSON.parse(v.summary.summaryJson);
              if (sum.carePath) vSummaryCarePath = sum.carePath;
            } catch (e) {}
          }

          // Determine final care path (prefer session over summary)
          let finalCarePath = vCarePath !== 'ALLOPATHY' ? vCarePath :
                               vSummaryCarePath !== 'ALLOPATHY' ? vSummaryCarePath : 'ALLOPATHY';

          // Adjust for department specialty
          const vDept = v.department?.name?.toLowerCase() || '';
          if (vDept.includes('homeopath')) {
            if (finalCarePath === 'ALLOPATHY') finalCarePath = 'HOMEOPATHY';
          } else if (vDept.includes('ayush') || vDept.includes('ayurved')) {
            if (finalCarePath === 'ALLOPATHY') finalCarePath = 'AYUSH';
          }

          // Calculate match score
          let score = 0;

          // 1. Care path match (40% weight)
          if (finalCarePath === carePath) score += 40;

          // 2. Temporal proximity (30% weight) - more recent = higher score
          const daysDiff = Math.abs(Date.now() - v.createdAt.getTime()) / (1000 * 60 * 60 * 24);
          const temporalScore = Math.max(0, 30 - Math.min(30, daysDiff / 10)); // Decrease over time
          score += temporalScore;

          // 3. Complaint similarity (20% weight)
          const currentComplaintQuery = (req.body.targetComplaint || visit.reasonForVisit || '').toLowerCase();
          const vComp = (v.reasonForVisit || v.clinicalHistory?.chiefComplaint || v.consultation?.diagnosis || '').toLowerCase();
          let complaintScore = 0;
          if (currentComplaintQuery && vComp) {
            // Simple word overlap scoring
            const currentWords = new Set<string>(currentComplaintQuery.split(/\s+/));
            const visitWords = new Set<string>(vComp.split(/\s+/));
            const intersection = [...currentWords].filter((word: string) => visitWords.has(word));
            const union = new Set<string>([...currentWords, ...visitWords]);
            complaintScore = union.size > 0 ? (intersection.length / union.size) * 20 : 0;
          }
          score += complaintScore;

          // 4. Department consistency (10% weight)
          const vDeptName = v.department?.name || '';
          const currDeptName = visit.department?.name || '';
          if (vDeptName && currDeptName &&
              (vDeptName.toLowerCase() === currDeptName.toLowerCase() ||
               vDeptName.toLowerCase().includes(currDeptName.toLowerCase()) ||
               currDeptName.toLowerCase().includes(vDeptName.toLowerCase()))) {
            score += 10;
          }

          return { visit: v, score };
        })
        .filter(item => item.score >= 50) // Minimum threshold
        .sort((a, b) => b.score - a.score); // Descending by score

      if (scoredVisits.length > 0) {
        // Use the highest scoring visit
        matchedVisit = scoredVisits[0].visit;
      } else {
        // Fallback: Use the most recent prior visit in the same care path, or simply the most recent prior visit
        const sameCarePath = allPriorVisits.find(v => {
          let vCare = 'ALLOPATHY';
          if (v.sessions?.[0]?.clinicalState) {
            try {
              const st = JSON.parse(v.sessions[0].clinicalState);
              if (st.carePath) vCare = st.carePath;
            } catch (e) {}
          }
          return vCare === carePath;
        });
        matchedVisit = sameCarePath || allPriorVisits[0];
      }
    }

    // If a matching prior visit was found in this care path, construct previousVisitInfo!
    if (matchedVisit) {
      isNewPatient = false;
      matchingPriorSessionId = matchedVisit.sessions?.[0]?.id || null;
      const prevDocName = matchedVisit.doctor?.user?.name ? `Dr. ${matchedVisit.doctor.user.name}` : undefined;

      let extractedComplaint = '';
      if (matchedVisit.reasonForVisit && !/follow-?up|consultation|routine|checkup|general|intake/i.test(matchedVisit.reasonForVisit)) {
        extractedComplaint = matchedVisit.reasonForVisit;
      }
      if (!extractedComplaint && matchedVisit.consultation?.diagnosis) {
        extractedComplaint = matchedVisit.consultation.diagnosis;
      }
      if (!extractedComplaint && matchedVisit.clinicalHistory?.chiefComplaint && !/opd intake|general/i.test(matchedVisit.clinicalHistory.chiefComplaint)) {
        extractedComplaint = matchedVisit.clinicalHistory.chiefComplaint;
      }
      if (!extractedComplaint && matchedVisit.sessions?.[0]?.clinicalState) {
        try {
          const parsedState = JSON.parse(matchedVisit.sessions[0].clinicalState);
          extractedComplaint = parsedState.chiefComplaint || parsedState.symptoms?.[0]?.name;
        } catch (e) {}
      }
      if (!extractedComplaint && matchedVisit.summary?.summaryJson) {
        try {
          const parsedSum = JSON.parse(matchedVisit.summary.summaryJson);
          extractedComplaint = parsedSum.chiefComplaint || parsedSum.presentingConcern || parsedSum.overview;
        } catch (e) {}
      }
      if (!extractedComplaint) {
        extractedComplaint = matchedVisit.reasonForVisit || `${matchedVisit.department?.name || 'Previous'} health complaint`;
      }

      previousVisitInfo = {
        lastVisitDate: matchedVisit.createdAt.toLocaleDateString(),
        lastComplaint: extractedComplaint,
        lastDepartment: matchedVisit.department?.name || 'OPD Clinic',
        lastDoctor: prevDocName || 'Attending Specialist',
        pastPrescriptions: matchedVisit.prescriptions?.[0]?.items?.map((i: any) => i.medicationName) || [],
      };
    } else {
      // Patient has previous visits, but NONE in this care path -> Fresh NEW CASE in this care path!
      isNewPatient = true;
      previousVisitInfo = undefined;
    }
  }

  const initialState = createInitialClinicalState(initialLang, respType, carePath, specialty, doctorName);
  initialState.isNewPatient = isNewPatient;
  initialState.previousVisitInfo = previousVisitInfo;
  if (recentChanges) {
    initialState.latestAnswer = `Reported change since last visit: ${recentChanges}`;
  }

  // Seamlessly populate known background allergies and chronic diseases from patient record
  if (visit.patient) {
    const patientObj = visit.patient as any;
    if (patientObj.allergies && Array.isArray(patientObj.allergies)) {
      initialState.allergies = patientObj.allergies.map((a: any) => ({
        allergen: a.allergen || a,
        reaction: a.reaction || 'Hypersensitivity',
        severity: a.severity || 'MODERATE',
      }));
    }
    if (patientObj.medicalHistory && typeof patientObj.medicalHistory === 'string') {
      const conditions = patientObj.medicalHistory.split(/[,;\n]+/).map((c: string) => c.trim()).filter(Boolean);
      if (conditions.length > 0) {
        initialState.pastMedicalHistory = conditions;
      }
    }
  }

  // Fetch prior visit's conversation messages and consultation history for complete clinical memory
  let priorVisitChatHistory: Array<{ role: string; content: string }> = [];
  try {
    const priorSession = matchingPriorSessionId
      ? await prisma.conversationSession.findUnique({
          where: { id: matchingPriorSessionId },
          include: {
            messages: {
              orderBy: { timestamp: 'asc' },
              select: { role: true, content: true },
            },
          },
        })
      : null;
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
    aiMessage: welcomeMsg,
    nextQuestion: welcomeMsg.content,
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
    include: {
      messages: { orderBy: { timestamp: 'asc' } },
    },
  });

  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  let state: ClinicalState = createInitialClinicalState(lang);
  if (session.clinicalState) {
    try {
      state = typeof session.clinicalState === 'string' ? JSON.parse(session.clinicalState) : (session.clinicalState as unknown as ClinicalState);
    } catch {}
  }
  state.currentLanguage = lang;

  const activeAi = getAIProvider();

  // Source of messages: either request body or database messages
  let msgsToTranslate = (Array.isArray(messages) && messages.length > 0 ? messages : session.messages).map((m: any) => {
    let opts: string[] = Array.isArray(m.options) && m.options.length > 0 ? m.options : [];
    if (opts.length === 0) {
      const dbMsg = session.messages.find(dm => dm.id === m.id) || session.messages.find(dm => dm.role === 'AI' && dm.metadata);
      if (dbMsg?.metadata) {
        try {
          const meta = JSON.parse(dbMsg.metadata);
          if (Array.isArray(meta?.options) && meta.options.length > 0) opts = meta.options;
        } catch {}
      }
    }
    return { id: m.id, role: m.role, content: m.content, options: opts, timestamp: m.timestamp };
  });

  // Translate messages and touch options in parallel
  const translatedMessages = await Promise.all(
    msgsToTranslate.map(async (m: any) => {
      const translatedContent = m.content ? await activeAi.translateText(m.content, lang) : m.content;
      let translatedOpts = m.options;
      if (Array.isArray(m.options) && m.options.length > 0) {
        translatedOpts = await Promise.all(
          m.options.map((opt: string) => (opt ? activeAi.translateText(opt, lang) : opt))
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

  const lastAI = [...translatedMessages].reverse().find((m) => m.role === 'AI');
  const activeQuestion = lastAI?.content || '';
  const touchOptions = lastAI?.options || [];

  // Update DB session and last message
  await prisma.conversationSession.update({
    where: { id: sessionId },
    data: {
      language: lang,
      clinicalState: JSON.stringify(state),
    },
  });

  if (session.messages.length > 0) {
    const lastDbAi = [...session.messages].reverse().find(m => m.role === 'AI');
    if (lastDbAi) {
      await prisma.conversationMessage.update({
        where: { id: lastDbAi.id },
        data: {
          content: activeQuestion,
          contentLang: lang,
          metadata: JSON.stringify({ options: touchOptions }),
        },
      });
    }
  }

  res.json({
    message: 'Language switched successfully',
    language: lang,
    targetLanguage: lang,
    translatedMessages,
    activeQuestion,
    latestQuestion: activeQuestion,
    nextQuestion: activeQuestion,
    touchOptions,
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
  const specialty = state.specialty || (session.visit as any).doctor?.specialization || session.visit.department?.name || 'General Medicine';

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

  // Query prior visit's conversation messages ONLY IF this is a genuine follow-up session
  let priorVisitChatHistory: Array<{ role: string; content: string }> = [];
  const isGenuineFollowUp = state.isNewPatient === false && Boolean(state.previousVisitInfo);
  if (isGenuineFollowUp) {
    try {
      // Fetch prior sessions for the same patient, excluding current session
      const priorSessions = await prisma.conversationSession.findMany({
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

      // Filter by carePath to ensure we only load prior visits from the same care path
      const matchingSession = priorSessions.find(priorSession => {
        try {
          const priorState = typeof priorSession.clinicalState === 'string'
            ? JSON.parse(priorSession.clinicalState)
            : priorSession.clinicalState;
          return priorState.carePath === state.carePath;
        } catch (e) {
          // If we can't parse the clinicalState, don't match this session
          return false;
        }
      });

      if (matchingSession?.messages?.length) {
        priorVisitChatHistory = matchingSession.messages.map(m => ({
          role: m.role === 'AI' ? 'Previous Visit Doctor AI' : 'Previous Visit Patient',
          content: m.content,
        }));
      }
    } catch (e) {
      console.warn('Prior chat history fetch notice:', e);
    }
  }

  const combinedHistory = isGenuineFollowUp ? [...priorVisitChatHistory, ...pastMessages] : pastMessages;
  const nextQ = await activeAi.generateNextQuestion(state, currentLang, carePath, specialty, combinedHistory);
  
  const isCompletionTriggered = isFinalAnswer || nextQ.isComplete;
  let finalQuestion = nextQ.question;
  let finalOptions = nextQ.touchOptions;

  if (isCompletionTriggered) {
    finalQuestion = currentLang === 'HI'
      ? 'धन्यवाद। आपकी क्लिनिकल पूछताछ पूरी हो गई है और आपका विवरण डॉक्टर के लिए तैयार कर दिया गया है। कृपया अपने परामर्श कक्ष / अपॉइंटमेंट के लिए आगे बढ़ें।'
      : currentLang === 'GU'
      ? 'ધન્યવાદ. આપની ક્લિનિકલ પૂછપરછ પૂર્ણ થઈ ગઈ છે અને આપની વિગતો ડૉક્ટર માટે તૈયાર છે. કૃપા કરીને આપના કન્સલ્ટેશન / તપાસ રૂમ તરફ આગળ વધો.'
      : 'Thank you. Your clinical intake is now complete. Your information has been prepared for the clinical team. Please proceed to your appointment / consultation room.';

    finalOptions = currentLang === 'HI'
      ? ['अपॉइंटमेंट के लिए आगे बढ़ें', 'सारांश देखें', 'एक और जानकारी जोड़ें']
      : currentLang === 'GU'
      ? ['કન્સલ્ટેશન માટે આગળ વધો', 'વિગતો જુઓ', 'વધુ એક વિગત ઉમેરો']
      : ['Proceed to Appointment', 'Review Summary', 'Add One More Detail'];
  }

  state.questionsAsked = [...(state.questionsAsked || []), finalQuestion];

  // 6. Save Updated State back to DB
  await prisma.conversationSession.update({
    where: { id: sessionId },
    data: {
      clinicalState: JSON.stringify(state),
      language: currentLang,
      status: isCompletionTriggered ? 'COMPLETED' : 'ACTIVE',
    },
  });

  // 7. Save AI Question Message
  const aiMessage = await prisma.conversationMessage.create({
    data: {
      sessionId: session.id,
      role: 'AI',
      content: finalQuestion,
      contentLang: currentLang,
      inputMethod: 'TEXT',
      metadata: JSON.stringify({ options: finalOptions, category: isCompletionTriggered ? 'CLOSING' : nextQ.questionCategory }),
    },
  });

  res.json({
    aiMessage,
    nextQuestion: finalQuestion,
    touchOptions: finalOptions,
    isComplete: isCompletionTriggered,
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
  const specialty = state.specialty || (visit as any).doctor?.specialization || visit.department?.name || 'General Medicine';

  const activeAi = getAIProvider();
  const summaryDraft = await activeAi.generateClinicalSummary(
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

/**
 * GET /api/conversation/:sessionId
 * Retrieve a conversation session and its messages by ID.
 */
router.get('/:sessionId', async (req: AuthRequest, res: Response): Promise<void> => {
  const sessionId = typeof req.params.sessionId === 'string' ? req.params.sessionId : req.params.sessionId[0];

  const session = await prisma.conversationSession.findUnique({
    where: { id: sessionId },
    include: {
      messages: {
        orderBy: { timestamp: 'asc' },
        select: {
          id: true,
          role: true,
          content: true,
          timestamp: true,
          contentLang: true,
          inputMethod: true,
          metadata: true,
        },
      },
      visit: {
        include: {
          patient: true,
          department: true,
        },
      },
    },
  });

  if (!session) {
    res.status(404).json({ error: 'Conversation session not found' });
    return;
  }

  // Convert to the format expected by frontend
  const formattedMessages = session.messages.map((msg: any) => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    timestamp: msg.timestamp,
    options: msg.metadata ? (JSON.parse(msg.metadata) as { options?: string[] }).options || [] : undefined,
  }));

  res.json({
    session: {
      id: session.id,
      visitId: session.visitId,
      language: session.language,
      inputMethod: session.inputMethod,
      status: session.status,
      clinicalState: session.clinicalState,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
    },
    messages: formattedMessages,
    visit: session.visit
      ? {
          id: session.visit.id,
          patientId: session.visit.patientId,
          departmentId: session.visit.departmentId,
          status: session.visit.status,
          reasonForVisit: session.visit.reasonForVisit,
          patient: session.visit.patient
            ? {
                id: session.visit.patient.id,
                name: session.visit.patient.name,
                mrn: session.visit.patient.mrn,
              }
            : null,
          department: session.visit.department
            ? {
                id: session.visit.department.id,
                name: session.visit.department.name,
                code: session.visit.department.code,
              }
            : null,
        }
      : null,
  });
});

export default router;
