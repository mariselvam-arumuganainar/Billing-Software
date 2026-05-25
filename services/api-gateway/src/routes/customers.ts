import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validateTenant } from '../middleware/validateTenant';
import {
  getCustomers, createCustomer, lookupCustomer,
  updateCustomer, deleteCustomer, getCustomerCredit,
} from '../controllers/customersController';

const router = Router();
router.use(authenticate);
router.use(validateTenant);

router.get('/',                  getCustomers);
router.post('/',                 createCustomer);
router.get('/lookup/:mobile',    lookupCustomer);
router.put('/:id',               updateCustomer);
router.delete('/:id',            deleteCustomer);
router.get('/:id/credit',        getCustomerCredit);

export default router;
