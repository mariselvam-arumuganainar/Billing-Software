import { Router } from 'express';
import { login, getLoginConfig } from '../controllers/authController';

const router = Router();

router.post('/login', login);
router.get('/login-config', getLoginConfig);

export default router;
