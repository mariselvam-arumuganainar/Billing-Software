import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validateTenant } from '../middleware/validateTenant';
import {
  getReminders, getDueReminders, createReminder,
  updateReminder, markDone, snoozeReminder, deleteReminder,
} from '../controllers/remindersController';

const router = Router();
router.use(authenticate);
router.use(validateTenant);

router.get('/',               getReminders);
router.get('/due',            getDueReminders);
router.post('/',              createReminder);
router.put('/:id',            updateReminder);
router.patch('/:id/done',     markDone);
router.patch('/:id/snooze',   snoozeReminder);
router.delete('/:id',         deleteReminder);

export default router;
