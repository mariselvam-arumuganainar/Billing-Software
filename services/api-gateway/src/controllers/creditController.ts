import { Response } from 'express';
import { prisma } from 'database';
import { AuthRequest } from '../middleware/auth';

export const manualCharge = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const { customerId, amount, notes } = req.body;
    if (!customerId || !amount || parseFloat(amount) <= 0)
      return res.status(400).json({ error: 'customerId and positive amount are required' });

    const chargeAmount = parseFloat(amount);
    const account = await prisma.creditAccount.findFirst({ where: { tenantId, customerId } });
    if (!account) return res.status(404).json({ error: 'Credit account not found' });

    const updated = await prisma.$transaction(async (tx) => {
      await tx.creditTransaction.create({
        data: { accountId: account.id, amount: chargeAmount, type: 'MANUAL_CHARGE', notes: notes || null },
      });
      return tx.creditAccount.update({
        where: { id: account.id },
        data: { currentDue: { increment: chargeAmount } },
      });
    });

    return res.status(200).json({ message: 'Manual charge recorded', creditAccount: updated });
  } catch (error: any) {
    console.error('Manual charge error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

export const updateCreditLimit = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const { customerId, creditLimit, notes } = req.body;
    if (!customerId || creditLimit === undefined)
      return res.status(400).json({ error: 'customerId and creditLimit are required' });

    const newLimit = parseFloat(creditLimit);
    if (newLimit < 0) return res.status(400).json({ error: 'Credit limit cannot be negative' });

    const account = await prisma.creditAccount.findFirst({ where: { tenantId, customerId } });
    if (!account) return res.status(404).json({ error: 'Credit account not found' });

    const updated = await prisma.$transaction(async (tx) => {
      await tx.creditTransaction.create({
        data: {
          accountId: account.id,
          amount: newLimit - account.creditLimit,
          type: 'LIMIT_CHANGE',
          notes: notes || `Limit changed from ₹${account.creditLimit} to ₹${newLimit}`,
        },
      });
      return tx.creditAccount.update({ where: { id: account.id }, data: { creditLimit: newLimit } });
    });

    return res.status(200).json({ message: 'Credit limit updated', creditAccount: updated });
  } catch (error: any) {
    console.error('Update credit limit error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

export const recordRepayment = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const { customerId, amount } = req.body;

    if (!customerId || amount === undefined || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Customer ID and valid positive amount are required' });
    }

    const payAmount = parseFloat(amount);

    // Retrieve credit account
    const creditAccount = await prisma.creditAccount.findFirst({
      where: { tenantId, customerId }
    });

    if (!creditAccount) {
      return res.status(404).json({ error: 'Credit account not found for this customer' });
    }

    // Update due and write transaction in an atomic Prisma transaction
    const updatedAccount = await prisma.$transaction(async (tx) => {
      // Create transaction record
      await tx.creditTransaction.create({
        data: {
          accountId: creditAccount.id,
          amount: payAmount,
          type: 'REPAYMENT'
        }
      });

      // Update credit account balance
      const account = await tx.creditAccount.update({
        where: { id: creditAccount.id },
        data: {
          currentDue: {
            decrement: payAmount
          }
        }
      });

      return account;
    });

    return res.status(200).json({ message: 'Repayment successfully recorded', creditAccount: updatedAccount });
  } catch (error: any) {
    console.error('Record repayment error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};
