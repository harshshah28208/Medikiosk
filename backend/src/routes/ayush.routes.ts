import { Router, Response } from 'express';
import prisma from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { createAuditLog } from '../middleware/audit.js';
import { AUDIT_ACTIONS } from '../config/constants.js';
import type { AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

/**
 * GET /api/ayush/assessment/:visitId
 * Fetch existing AYUSH assessment for a patient visit.
 */
router.get('/assessment/:visitId', requireRole('AYUSH_DOCTOR', 'HOSPITAL_ADMIN', 'SUPER_ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  const visitId = typeof req.params.visitId === 'string' ? req.params.visitId : req.params.visitId[0];

  const assessment = await prisma.aYUSHAssessment.findUnique({
    where: { visitId },
    include: {
      visit: {
        include: {
          patient: true,
          clinicalHistory: true,
          vitals: { orderBy: { recordedAt: 'desc' }, take: 1 },
        },
      },
    },
  });

  res.json({ assessment });
});

/**
 * POST /api/ayush/assessment
 * Record full Ashtavidha Pariksha, Prakriti, Vikriti, Agni, and Ayurvedic treatment plan.
 */
router.post('/assessment', requireRole('AYUSH_DOCTOR', 'HOSPITAL_ADMIN', 'SUPER_ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  const {
    visitId,
    patientId,
    prakriti,
    vikriti,
    agni,
    koshtha,
    ahara,
    vihara,
    nadi,
    mutra,
    mala,
    jihva,
    shabda,
    sparsha,
    drik,
    akriti,
    notes,
  } = req.body;

  if (!visitId || !patientId) {
    res.status(400).json({ error: 'visitId and patientId are required.' });
    return;
  }

  const assessment = await prisma.aYUSHAssessment.upsert({
    where: { visitId },
    update: {
      prakriti: prakriti || undefined,
      vikriti: vikriti || undefined,
      agni: agni || null,
      koshtha: koshtha || null,
      ahara: ahara || undefined,
      vihara: vihara || undefined,
      nadi: nadi || null,
      mutra: mutra || null,
      mala: mala || null,
      jihva: jihva || null,
      shabda: shabda || null,
      sparsha: sparsha || null,
      drik: drik || null,
      akriti: akriti || null,
      notes: notes || null,
    },
    create: {
      visitId,
      patientId,
      prakriti: prakriti || undefined,
      vikriti: vikriti || undefined,
      agni: agni || null,
      koshtha: koshtha || null,
      ahara: ahara || undefined,
      vihara: vihara || undefined,
      nadi: nadi || null,
      mutra: mutra || null,
      mala: mala || null,
      jihva: jihva || null,
      shabda: shabda || null,
      sparsha: sparsha || null,
      drik: drik || null,
      akriti: akriti || null,
      notes: notes || null,
    },
  });

  await createAuditLog({
    userId: req.user?.id,
    role: req.user?.role,
    action: 'RECORD_AYUSH_ASSESSMENT',
    resourceType: 'AYUSH_ASSESSMENT',
    resourceId: assessment.id,
    details: { visitId, prakriti: prakriti?.primaryDosha, agni },
  });

  res.status(201).json({
    message: 'AYUSH Ashtavidha Pariksha & Prakriti assessment saved.',
    assessment,
  });
});

export default router;
