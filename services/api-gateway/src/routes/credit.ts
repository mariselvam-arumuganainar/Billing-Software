import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validateTenant } from '../middleware/validateTenant';
import { recordRepayment, manualCharge, updateCreditLimit } from '../controllers/creditController';

const router = Router();
router.use(authenticate);
router.use(validateTenant);

router.post('/repay',  recordRepayment);
router.post('/charge', manualCharge);
router.put('/limit',   updateCreditLimit);

export default router;
