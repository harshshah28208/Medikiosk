import { Router, Response } from 'express';
import prisma from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireClinicalRole, requireRole } from '../middleware/rbac.js';
import { createAuditLog } from '../middleware/audit.js';
import { AUDIT_ACTIONS } from '../config/constants.js';
import type { AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

/**
 * GET /api/ayush/assessment/:visitId
 * Fetch existing AYUSH assessment for a patient visit.
 */
router.get('/assessment/:visitId', requireClinicalRole(), async (req: AuthRequest, res: Response): Promise<void> => {
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
router.post('/assessment', requireClinicalRole(), async (req: AuthRequest, res: Response): Promise<void> => {
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
    sara,
    samhanana,
    pramana,
    satmya,
    sattva,
    aharaShakti,
    vyayamaShakti,
    vaya,
    homeopathyMiasm,
    homeopathyThermal,
    homeopathyThirst,
    homeopathyModalities,
    homeopathyRepertoryNotes,
    notes,
  } = req.body;

  if (!visitId || !patientId) {
    res.status(400).json({ error: 'visitId and patientId are required.' });
    return;
  }

  const assessment = await prisma.aYUSHAssessment.upsert({
    where: { visitId },
    update: {
      prakriti: typeof prakriti === 'object' ? JSON.stringify(prakriti) : (prakriti || undefined),
      vikriti: typeof vikriti === 'object' ? JSON.stringify(vikriti) : (vikriti || undefined),
      agni: agni || null,
      koshtha: koshtha || null,
      ahara: typeof ahara === 'object' ? JSON.stringify(ahara) : (ahara || undefined),
      vihara: typeof vihara === 'object' ? JSON.stringify(vihara) : (vihara || undefined),
      nadi: nadi || null,
      mutra: mutra || null,
      mala: mala || null,
      jihva: jihva || null,
      shabda: shabda || null,
      sparsha: sparsha || null,
      drik: drik || null,
      akriti: akriti || null,
      sara: sara || null,
      samhanana: samhanana || null,
      pramana: pramana || null,
      satmya: satmya || null,
      sattva: sattva || null,
      aharaShakti: aharaShakti || null,
      vyayamaShakti: vyayamaShakti || null,
      vaya: vaya || null,
      homeopathyMiasm: homeopathyMiasm || null,
      homeopathyThermal: homeopathyThermal || null,
      homeopathyThirst: homeopathyThirst || null,
      homeopathyModalities: homeopathyModalities || null,
      homeopathyRepertoryNotes: homeopathyRepertoryNotes || null,
      notes: notes || null,
    },
    create: {
      visitId,
      patientId,
      prakriti: typeof prakriti === 'object' ? JSON.stringify(prakriti) : (prakriti || null),
      vikriti: typeof vikriti === 'object' ? JSON.stringify(vikriti) : (vikriti || null),
      agni: agni || null,
      koshtha: koshtha || null,
      ahara: typeof ahara === 'object' ? JSON.stringify(ahara) : (ahara || null),
      vihara: typeof vihara === 'object' ? JSON.stringify(vihara) : (vihara || null),
      nadi: nadi || null,
      mutra: mutra || null,
      mala: mala || null,
      jihva: jihva || null,
      shabda: shabda || null,
      sparsha: sparsha || null,
      drik: drik || null,
      akriti: akriti || null,
      sara: sara || null,
      samhanana: samhanana || null,
      pramana: pramana || null,
      satmya: satmya || null,
      sattva: sattva || null,
      aharaShakti: aharaShakti || null,
      vyayamaShakti: vyayamaShakti || null,
      vaya: vaya || null,
      homeopathyMiasm: homeopathyMiasm || null,
      homeopathyThermal: homeopathyThermal || null,
      homeopathyThirst: homeopathyThirst || null,
      homeopathyModalities: homeopathyModalities || null,
      homeopathyRepertoryNotes: homeopathyRepertoryNotes || null,
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
