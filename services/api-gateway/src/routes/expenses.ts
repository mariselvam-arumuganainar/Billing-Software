import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validateTenant } from '../middleware/validateTenant';
import {
  getExpenses,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense,
} from '../controllers/expensesController';

const router = Router();

router.use(authenticate);
router.use(validateTenant);

router.get('/',     getExpenses);
router.get('/:id',  getExpenseById);
router.post('/',    createExpense);
router.put('/:id',  updateExpense);
router.delete('/:id', deleteExpense);

export default router;
