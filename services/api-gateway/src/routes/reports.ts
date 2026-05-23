import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validateTenant } from '../middleware/validateTenant';
import { getDashboardMetrics, getInvoices, getReportsSummary } from '../controllers/reportsController';

const router = Router();

router.use(authenticate);
router.use(validateTenant);

router.get('/dashboard', getDashboardMetrics);
router.get('/invoices', getInvoices);
router.get('/summary', getReportsSummary);

export default router;
