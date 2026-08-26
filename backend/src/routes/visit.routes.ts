import { Router } from 'express';
import { getVisit, updateVisitStatus, listVisits } from '../controllers/visit.controller.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);

router.get('/', listVisits);
router.get('/:id', getVisit);
router.patch('/:id/status', updateVisitStatus);

export default router;
