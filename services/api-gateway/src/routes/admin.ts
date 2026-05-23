import { Router } from 'express';
import { authenticate, authorizeSuperAdmin } from '../middleware/auth';
import { createTenant, listTenants, toggleTenantStatus } from '../controllers/adminController';

const router = Router();

// Apply auth middlewares for super admin routes
router.use(authenticate);
router.use(authorizeSuperAdmin);

router.post('/tenants', createTenant);
router.get('/tenants', listTenants);
router.patch('/tenants/:id/status', toggleTenantStatus);

export default router;

