import { Response } from 'express';
import { prisma } from 'database';
import { AuthRequest } from '../middleware/auth';

export const getCustomers = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const customers = await prisma.customer.findMany({
      where: { tenantId },
      include: { creditAccount: true }
    });

    return res.status(200).json({ customers });
  } catch (error) {
    console.error('Get customers error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const lookupCustomer = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const { mobile } = req.params;
    if (!mobile) return res.status(400).json({ error: 'Mobile number is required' });

    const customer = await prisma.customer.findFirst({
      where: { tenantId, mobileNumber: mobile as string },
      include: { creditAccount: true }
    });


    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    return res.status(200).json({ customer });
  } catch (error) {
    console.error('Lookup customer error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const createCustomer = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const { name, mobileNumber, creditLimit } = req.body;

    if (!mobileNumber) {
      return res.status(400).json({ error: 'Mobile number is required' });
    }

    // Check if customer already exists for this tenant
    const existing = await prisma.customer.findFirst({
      where: { tenantId, mobileNumber }
    });

    if (existing) {
      return res.status(400).json({ error: 'Customer already registered' });
    }

    // Create customer and credit account in a transaction
    const customer = await prisma.$transaction(async (tx) => {
      const c = await tx.customer.create({
        data: {
          tenantId,
          name,
          mobileNumber,
          totalRewardPoints: 0
        }
      });

      await tx.creditAccount.create({
        data: {
          tenantId,
          customerId: c.id,
          creditLimit: parseFloat(creditLimit || 5000),
          currentDue: 0
        }
      });

      return c;
    });

    const fullCustomer = await prisma.customer.findUnique({
      where: { id: customer.id },
      include: { creditAccount: true }
    });

    return res.status(201).json({ customer: fullCustomer });
  } catch (error: any) {
    console.error('Create customer error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};
