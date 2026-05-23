import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validateTenant } from '../middleware/validateTenant';
import { getProfile, updateProfile, clearLoginImage, getSettings, updateSettings } from '../controllers/settingsController';

const router = Router();

router.use(authenticate);
router.use(validateTenant);

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.delete('/login-image', clearLoginImage);
router.get('/rules', getSettings);
router.put('/rules', updateSettings);

export default router;
