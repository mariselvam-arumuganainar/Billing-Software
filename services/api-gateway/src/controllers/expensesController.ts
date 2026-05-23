import { Response } from 'express';
import { prisma } from 'database';
import { AuthRequest } from '../middleware/auth';

export const getExpenses = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const expenses = await prisma.expense.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { date: 'desc' },
    });

    return res.status(200).json({ expenses });
  } catch (error) {
    console.error('Get expenses error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getExpenseById = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const id = req.params.id as string;
    const expense = await prisma.expense.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    return res.status(200).json({ expense });
  } catch (error) {
    console.error('Get expense by id error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const createExpense = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const {
      category, amount, date, notes,
      paymentMode, vendorName, referenceNumber,
      attachmentUrl, attachmentFileName, attachmentMimeType,
    } = req.body;

    if (!category || amount === undefined || !date) {
      return res.status(400).json({ error: 'Category, amount, and date are required' });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    const expense = await prisma.expense.create({
      data: {
        tenantId,
        category,
        amount: parsedAmount,
        date: new Date(date),
        notes: notes || null,
        paymentMode: paymentMode || null,
        vendorName: vendorName || null,
        referenceNumber: referenceNumber || null,
        attachmentUrl: attachmentUrl || null,
        attachmentFileName: attachmentFileName || null,
        attachmentMimeType: attachmentMimeType || null,
        status: 'ACTIVE',
      },
    });

    return res.status(201).json({ expense });
  } catch (error: any) {
    console.error('Create expense error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

export const updateExpense = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const id = req.params.id as string;
    const existing = await prisma.expense.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) return res.status(404).json({ error: 'Expense not found' });

    const {
      category, amount, date, notes,
      paymentMode, vendorName, referenceNumber,
      attachmentUrl, attachmentFileName, attachmentMimeType,
    } = req.body;

    if (amount !== undefined) {
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: 'Amount must be a positive number' });
      }
    }

    const expense = await prisma.expense.update({
      where: { id },
      data: {
        category:            category            !== undefined ? category                     : existing.category,
        amount:              amount              !== undefined ? parseFloat(amount)            : existing.amount,
        date:                date                !== undefined ? new Date(date)                : existing.date,
        notes:               notes               !== undefined ? (notes || null)               : existing.notes,
        paymentMode:         paymentMode         !== undefined ? (paymentMode || null)         : existing.paymentMode,
        vendorName:          vendorName          !== undefined ? (vendorName || null)          : existing.vendorName,
        referenceNumber:     referenceNumber     !== undefined ? (referenceNumber || null)     : existing.referenceNumber,
        attachmentUrl:       attachmentUrl       !== undefined ? (attachmentUrl || null)       : existing.attachmentUrl,
        attachmentFileName:  attachmentFileName  !== undefined ? (attachmentFileName || null)  : existing.attachmentFileName,
        attachmentMimeType:  attachmentMimeType  !== undefined ? (attachmentMimeType || null)  : existing.attachmentMimeType,
      },
    });

    return res.status(200).json({ expense });
  } catch (error: any) {
    console.error('Update expense error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

export const deleteExpense = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const id = req.params.id as string;
    const existing = await prisma.expense.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) return res.status(404).json({ error: 'Expense not found' });

    await prisma.expense.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'ARCHIVED' },
    });

    return res.status(200).json({ message: 'Expense archived successfully' });
  } catch (error: any) {
    console.error('Delete expense error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};
