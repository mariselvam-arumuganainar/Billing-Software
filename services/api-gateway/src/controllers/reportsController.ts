import { Response } from 'express';
import { prisma } from 'database';
import { AuthRequest } from '../middleware/auth';

export const getDashboardMetrics = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    // 1. Total Sales & GST from completed invoices
    const salesAggregate = await prisma.invoice.aggregate({
      where: { tenantId, status: 'COMPLETED' },
      _sum: {
        grandTotal: true,
        taxTotal: true,
        subtotal: true
      }
    });

    // 2. Credit Due outstanding from credit accounts
    const creditAggregate = await prisma.creditAccount.aggregate({
      where: { tenantId },
      _sum: {
        currentDue: true
      }
    });

    // 3. Expenses total (exclude soft-deleted)
    const expenseAggregate = await prisma.expense.aggregate({
      where: { tenantId, deletedAt: null },
      _sum: {
        amount: true
      }
    });

    // 4. Rewards outstanding
    const rewardAggregate = await prisma.customer.aggregate({
      where: { tenantId },
      _sum: {
        totalRewardPoints: true
      }
    });

    // 5. Top selling items (agg from InvoiceLines)
    const lines = await prisma.invoiceLine.findMany({
      where: {
        invoice: {
          tenantId,
          status: 'COMPLETED'
        }
      },
      include: {
        item: true
      }
    });

    const itemCounts: Record<string, { name: string; qty: number; rev: number }> = {};
    lines.forEach(line => {
      const name = line.item?.name || 'Unknown';
      const existing = itemCounts[line.itemId];
      const entry = existing || { name, qty: 0, rev: 0 };
      entry.qty += line.qty;
      entry.rev += line.taxableValue;
      itemCounts[line.itemId] = entry;
    });

    const topItems = Object.values(itemCounts)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    return res.status(200).json({
      metrics: {
        sales: salesAggregate._sum.grandTotal || 0,
        gst: salesAggregate._sum.taxTotal || 0,
        expenses: expenseAggregate._sum.amount || 0,
        creditDue: creditAggregate._sum.currentDue || 0,
        rewardPoints: rewardAggregate._sum.totalRewardPoints || 0
      },
      topItems
    });
  } catch (error) {
    console.error('Dashboard metrics error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getInvoices = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const invoices = await prisma.invoice.findMany({
      where: { tenantId },
      include: {
        customer: true,
        lines: {
          include: {
            item: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json({ invoices });
  } catch (error) {
    console.error('Get invoices error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getReportsSummary = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    // Fetch invoices and expenses to build full report
    const invoices = await prisma.invoice.findMany({
      where: { tenantId, status: 'COMPLETED' }
    });

    const expenses = await prisma.expense.findMany({
      where: { tenantId, deletedAt: null }
    });

    const subtotal = invoices.reduce((sum, inv) => sum + inv.subtotal, 0);
    const taxTotal = invoices.reduce((sum, inv) => sum + inv.taxTotal, 0);
    const grandTotal = invoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

    // Calculate Payment Mode split
    const paymentSplit: Record<string, number> = { CASH: 0, CARD: 0, UPI: 0, CREDIT: 0 };
    invoices.forEach(inv => {
      const mode = inv.paymentMode.toUpperCase();
      paymentSplit[mode] = (paymentSplit[mode] || 0) + inv.grandTotal;
    });

    // Profit Estimate (Grand Total - GST Collected - Expenses)
    // Note: This is a simple estimation of net margins
    const profitEstimate = subtotal - totalExpenses;

    return res.status(200).json({
      summary: {
        grossSales: grandTotal,
        netSales: subtotal,
        taxCollected: taxTotal,
        expensesTotal: totalExpenses,
        profitEstimate
      },
      paymentSplit
    });
  } catch (error) {
    console.error('Reports summary error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
