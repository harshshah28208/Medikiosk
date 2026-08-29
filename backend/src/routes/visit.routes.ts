import { Router } from 'express';
import { getVisit, updateVisitStatus, listVisits, assignDoctor } from '../controllers/visit.controller.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);

router.get('/', listVisits);
router.get('/:id', getVisit);
router.patch('/:id/status', updateVisitStatus);
router.post('/:id/assign-doctor', assignDoctor);

export default router;
