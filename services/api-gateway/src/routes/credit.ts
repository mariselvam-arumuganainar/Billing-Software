import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validateTenant } from '../middleware/validateTenant';
import { recordRepayment } from '../controllers/creditController';

const router = Router();

router.use(authenticate);
router.use(validateTenant);

router.post('/repay', recordRepayment);

export default router;
