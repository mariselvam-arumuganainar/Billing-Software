import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validateTenant } from '../middleware/validateTenant';
import {
  getStockDashboard, getStockList, getStockHistory,
  createStockEntry, deleteStockEntry,
  getSuppliers, createSupplier,
  adjustStock, getStockPurchases, createStockPurchase,
  getItemStockHistory, getStockStats,
} from '../controllers/stockController';

const router = Router();
router.use(authenticate);
router.use(validateTenant);

router.get('/dashboard',        getStockDashboard);
router.get('/stats',            getStockStats);
router.get('/items',            getStockList);
router.get('/history',          getStockHistory);
router.post('/adjust',          adjustStock);
router.post('/entries',         createStockEntry);
router.delete('/entries/:id',   deleteStockEntry);
router.get('/suppliers',        getSuppliers);
router.post('/suppliers',       createSupplier);
router.get('/purchases',        getStockPurchases);
router.post('/purchases',       createStockPurchase);
router.get('/:itemId/history',  getItemStockHistory);

export default router;
