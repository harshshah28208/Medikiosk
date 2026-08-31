import { Router } from 'express';
import { getVisit, updateVisitStatus, listVisits, assignDoctor } from '../controllers/visit.controller.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireClinicalRole } from '../middleware/rbac.js';

const router = Router();

router.use(authenticateToken);

router.get('/', listVisits);
router.get('/:id', getVisit);
router.patch('/:id/status', requireClinicalRole(), updateVisitStatus);
router.post('/:id/assign-doctor', requireClinicalRole(), assignDoctor);

export default router;
