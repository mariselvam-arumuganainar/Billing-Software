import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validateTenant } from '../middleware/validateTenant';
import {
  getStockDashboard, getStockList, getStockHistory,
  createStockEntry, deleteStockEntry,
  getSuppliers, createSupplier,
} from '../controllers/stockController';

const router = Router();
router.use(authenticate);
router.use(validateTenant);

router.get('/dashboard',      getStockDashboard);
router.get('/items',          getStockList);
router.get('/history',        getStockHistory);
router.post('/entries',       createStockEntry);
router.delete('/entries/:id', deleteStockEntry);
router.get('/suppliers',      getSuppliers);
router.post('/suppliers',     createSupplier);

export default router;
