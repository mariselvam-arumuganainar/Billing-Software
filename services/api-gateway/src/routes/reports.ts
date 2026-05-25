import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validateTenant } from '../middleware/validateTenant';
import {
  getDashboardMetrics, getDashboardChart, getInvoices, getReportsSummary,
  getGstReport, getItemReport, getCustomerReport, getExpenseReport,
  getCreditReport, getStockReport,
} from '../controllers/reportsController';

const router = Router();
router.use(authenticate);
router.use(validateTenant);

router.get('/dashboard',  getDashboardMetrics);
router.get('/chart',      getDashboardChart);
router.get('/invoices',   getInvoices);
router.get('/summary',    getReportsSummary);
router.get('/gst',        getGstReport);
router.get('/items',      getItemReport);
router.get('/customers',  getCustomerReport);
router.get('/expenses',   getExpenseReport);
router.get('/credit',     getCreditReport);
router.get('/stock',      getStockReport);

export default router;
