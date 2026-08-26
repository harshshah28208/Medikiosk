import { Router } from 'express';
import { login, demoLogin, getMe, register } from '../controllers/auth.controller.js';
import { validateBody } from '../middleware/validate.js';
import { authenticateToken } from '../middleware/auth.js';
import { loginSchema, demoLoginSchema, registerStaffSchema } from '../validators/auth.schema.js';

const router = Router();

// Public endpoints
router.post('/login', validateBody(loginSchema), login);
router.post('/register', validateBody(registerStaffSchema), register);
router.post('/demo-login', validateBody(demoLoginSchema), demoLogin);

// Protected endpoints
router.get('/me', authenticateToken, getMe);

export default router;
