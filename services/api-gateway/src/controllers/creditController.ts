import { Response } from 'express';
import { prisma } from 'database';
import { AuthRequest } from '../middleware/auth';

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
