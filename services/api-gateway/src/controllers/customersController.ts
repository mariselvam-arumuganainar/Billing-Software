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

    const { name, mobileNumber, creditLimit, startingRewardPoints, startingDue, notes } = req.body;
    if (!mobileNumber) return res.status(400).json({ error: 'Mobile number is required' });

    const existing = await prisma.customer.findFirst({ where: { tenantId, mobileNumber } });
    if (existing) return res.status(400).json({ error: 'Customer already registered' });

    const customer = await prisma.$transaction(async (tx) => {
      const c = await tx.customer.create({
        data: {
          tenantId,
          name,
          mobileNumber,
          notes: notes || null,
          totalRewardPoints: parseFloat(startingRewardPoints || 0),
        },
      });
      await tx.creditAccount.create({
        data: {
          tenantId,
          customerId: c.id,
          creditLimit: parseFloat(creditLimit || 5000),
          currentDue:  parseFloat(startingDue || 0),
        },
      });
      return c;
    });

    const fullCustomer = await prisma.customer.findUnique({
      where: { id: customer.id },
      include: { creditAccount: true },
    });
    return res.status(201).json({ customer: fullCustomer });
  } catch (error: any) {
    console.error('Create customer error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

export const updateCustomer = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const id = req.params.id as string;
    const { name, notes } = req.body;

    const existing = await prisma.customer.findFirst({ where: { id, tenantId } });
    if (!existing) return res.status(404).json({ error: 'Customer not found' });

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        ...(name  !== undefined && { name }),
        ...(notes !== undefined && { notes }),
      },
      include: { creditAccount: true },
    });
    return res.status(200).json({ customer });
  } catch (error: any) {
    console.error('Update customer error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

export const deleteCustomer = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const id = req.params.id as string;
    const existing = await prisma.customer.findFirst({ where: { id, tenantId } });
    if (!existing) return res.status(404).json({ error: 'Customer not found' });

    await prisma.customer.delete({ where: { id } });
    return res.status(200).json({ message: 'Customer deleted' });
  } catch (error: any) {
    console.error('Delete customer error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

export const getCustomerCredit = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const id = req.params.id as string;
    const account = await prisma.creditAccount.findFirst({
      where: { tenantId, customerId: id },
      include: { transactions: { orderBy: { createdAt: 'desc' }, take: 50 } },
    });

    if (!account) return res.status(404).json({ error: 'Credit account not found' });
    return res.status(200).json({ account });
  } catch (error) {
    console.error('Get customer credit error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
