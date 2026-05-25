import { Response } from 'express';
import { Prisma } from 'database';
import { prisma } from 'database';
import { AuthRequest } from '../middleware/auth';

// Returns a DateTimeFilter with only the keys that are actually present
// so exactOptionalPropertyTypes is satisfied (no `gte: undefined` leaks).
function dateFilter(req: AuthRequest): Prisma.DateTimeFilter | undefined {
  const { startDate, endDate } = req.query as Record<string, string>;
  const f: Prisma.DateTimeFilter = {};
  if (startDate) f.gte = new Date(startDate);
  if (endDate) {
    // Extend to 23:59:59.999 UTC so the full day is included.
    // Without this, new Date("2026-05-25") = midnight UTC, which excludes
    // all records created during that day (IST timestamps start hours after UTC midnight).
    const end = new Date(endDate);
    end.setUTCHours(23, 59, 59, 999);
    f.lte = end;
  }
  return (startDate || endDate) ? f : undefined;
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

export const getDashboardMetrics = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const createdAt = dateFilter(req);

    const invoiceWhere: Prisma.InvoiceWhereInput = { tenantId, status: 'COMPLETED' };
    if (createdAt) invoiceWhere.createdAt = createdAt;

    const expenseWhere: Prisma.ExpenseWhereInput = { tenantId, deletedAt: null };
    if (createdAt) expenseWhere.createdAt = createdAt;

    const [salesAgg, creditAgg, expenseAgg, rewardAgg] = await Promise.all([
      prisma.invoice.aggregate({ where: invoiceWhere, _sum: { grandTotal: true, taxTotal: true, subtotal: true } }),
      prisma.creditAccount.aggregate({ where: { tenantId }, _sum: { currentDue: true } }),
      prisma.expense.aggregate({ where: expenseWhere, _sum: { amount: true } }),
      prisma.customer.aggregate({ where: { tenantId }, _sum: { totalRewardPoints: true } }),
    ]);

    const lines = await prisma.invoiceLine.findMany({
      where: { invoice: invoiceWhere },
      include: { item: { select: { name: true } } },
    });

    const itemCounts: Record<string, { name: string; qty: number; rev: number }> = {};
    for (const line of lines) {
      const entry = itemCounts[line.itemId] ?? { name: line.item?.name ?? 'Unknown', qty: 0, rev: 0 };
      entry.qty += line.qty;
      entry.rev += line.taxableValue;
      itemCounts[line.itemId] = entry;
    }

    return res.status(200).json({
      metrics: {
        sales:        salesAgg._sum?.grandTotal        ?? 0,
        gst:          salesAgg._sum?.taxTotal          ?? 0,
        expenses:     expenseAgg._sum?.amount          ?? 0,
        creditDue:    creditAgg._sum?.currentDue       ?? 0,
        rewardPoints: rewardAgg._sum?.totalRewardPoints ?? 0,
        netRevenue:   (salesAgg._sum?.subtotal ?? 0) - (expenseAgg._sum?.amount ?? 0),
      },
      topItems: Object.values(itemCounts).sort((a, b) => b.qty - a.qty).slice(0, 5),
    });
  } catch (error) {
    console.error('Dashboard metrics error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getDashboardChart = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const now    = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return { year: d.getFullYear(), month: d.getMonth() + 1, label: d.toLocaleString('en-IN', { month: 'short' }) };
    });

    // months always has 6 entries — non-null assertion is safe
    const since = new Date(months[0]!.year, months[0]!.month - 1, 1);

    const [invoices, expenses] = await Promise.all([
      prisma.invoice.findMany({
        where: { tenantId, status: 'COMPLETED', createdAt: { gte: since } },
        select: { grandTotal: true, subtotal: true, createdAt: true },
      }),
      prisma.expense.findMany({
        where: { tenantId, deletedAt: null, createdAt: { gte: since } },
        select: { amount: true, createdAt: true },
      }),
    ]);

    const points = months.map(m => {
      const sales = invoices
        .filter(i => { const d = new Date(i.createdAt); return d.getFullYear() === m.year && d.getMonth() + 1 === m.month; })
        .reduce((s, i) => s + i.grandTotal, 0);
      const exp = expenses
        .filter(e => { const d = new Date(e.createdAt); return d.getFullYear() === m.year && d.getMonth() + 1 === m.month; })
        .reduce((s, e) => s + e.amount, 0);
      return { label: m.label, sales, expenses: exp, net: sales - exp };
    });

    return res.status(200).json({ points });
  } catch (error) {
    console.error('Dashboard chart error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ─── Invoices ───────────────────────────────────────────────────────────────

export const getInvoices = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const createdAt = dateFilter(req);
    const where: Prisma.InvoiceWhereInput = { tenantId };
    if (createdAt) where.createdAt = createdAt;

    const invoices = await prisma.invoice.findMany({
      where,
      include: { customer: true, lines: { include: { item: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({ invoices });
  } catch (error) {
    console.error('Get invoices error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ─── Summary ────────────────────────────────────────────────────────────────

export const getReportsSummary = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const createdAt = dateFilter(req);

    const invoiceWhere: Prisma.InvoiceWhereInput = { tenantId, status: 'COMPLETED' };
    if (createdAt) invoiceWhere.createdAt = createdAt;

    const expenseWhere: Prisma.ExpenseWhereInput = { tenantId, deletedAt: null };
    if (createdAt) expenseWhere.createdAt = createdAt;

    const [invoices, expenses] = await Promise.all([
      prisma.invoice.findMany({ where: invoiceWhere }),
      prisma.expense.findMany({ where: expenseWhere }),
    ]);

    const subtotal    = invoices.reduce((s, i) => s + i.subtotal, 0);
    const taxTotal    = invoices.reduce((s, i) => s + i.taxTotal, 0);
    const grandTotal  = invoices.reduce((s, i) => s + i.grandTotal, 0);
    const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);

    const paymentSplit: Record<string, number> = { CASH: 0, CARD: 0, UPI: 0, CREDIT: 0, SPLIT: 0 };
    for (const inv of invoices) {
      const mode = inv.paymentMode.toUpperCase();
      paymentSplit[mode] = (paymentSplit[mode] ?? 0) + inv.grandTotal;
    }

    return res.status(200).json({
      summary: {
        grossSales:     grandTotal,
        netSales:       subtotal,
        taxCollected:   taxTotal,
        expensesTotal:  totalExpense,
        profitEstimate: subtotal - totalExpense,
        invoiceCount:   invoices.length,
      },
      paymentSplit,
    });
  } catch (error) {
    console.error('Reports summary error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ─── GST Report ─────────────────────────────────────────────────────────────

export const getGstReport = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const createdAt = dateFilter(req);
    const invoiceWhere: Prisma.InvoiceWhereInput = { tenantId, status: 'COMPLETED' };
    if (createdAt) invoiceWhere.createdAt = createdAt;

    const lines = await prisma.invoiceLine.findMany({
      where: { invoice: invoiceWhere },
      include: { item: { select: { gstRateDefault: true } } },
    });

    const gstMap: Record<string, { rate: number; taxable: number; cgst: number; sgst: number; igst: number; total: number }> = {};
    for (const l of lines) {
      const rate  = l.item?.gstRateDefault ?? 0;
      const key   = String(rate);
      const entry = gstMap[key] ?? { rate, taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
      entry.taxable += l.taxableValue;
      entry.cgst    += l.cgst;
      entry.sgst    += l.sgst;
      entry.igst    += l.igst;
      entry.total   += l.cgst + l.sgst + l.igst;
      gstMap[key]    = entry;
    }

    const totalCgst = lines.reduce((s, l) => s + l.cgst, 0);
    const totalSgst = lines.reduce((s, l) => s + l.sgst, 0);
    const totalIgst = lines.reduce((s, l) => s + l.igst, 0);

    return res.status(200).json({
      gst: {
        byRate: Object.values(gstMap).sort((a, b) => a.rate - b.rate),
        totalCgst, totalSgst, totalIgst,
        totalGst: totalCgst + totalSgst + totalIgst,
      },
    });
  } catch (error) {
    console.error('GST report error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ─── Item Report ─────────────────────────────────────────────────────────────

export const getItemReport = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const createdAt = dateFilter(req);
    const invoiceWhere: Prisma.InvoiceWhereInput = { tenantId, status: 'COMPLETED' };
    if (createdAt) invoiceWhere.createdAt = createdAt;

    const lines = await prisma.invoiceLine.findMany({
      where: { invoice: invoiceWhere },
      include: { item: { select: { name: true, unit: true, price: true, purchasePrice: true, stockQty: true } } },
    });

    const itemMap: Record<string, {
      name: string; unit: string; price: number; purchasePrice: number | null;
      stockQty: number; qtySold: number; revenue: number; profit: number;
    }> = {};

    for (const l of lines) {
      if (!l.item) continue;
      const entry = itemMap[l.itemId] ?? {
        name: l.item.name, unit: l.item.unit, price: l.item.price,
        purchasePrice: l.item.purchasePrice, stockQty: l.item.stockQty,
        qtySold: 0, revenue: 0, profit: 0,
      };
      entry.qtySold  += l.qty;
      entry.revenue  += l.taxableValue;
      entry.profit   += l.taxableValue - l.qty * (l.item.purchasePrice ?? l.item.price);
      itemMap[l.itemId] = entry;
    }

    return res.status(200).json({ items: Object.values(itemMap).sort((a, b) => b.qtySold - a.qtySold) });
  } catch (error) {
    console.error('Item report error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ─── Customer Report ──────────────────────────────────────────────────────────

export const getCustomerReport = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const customers = await prisma.customer.findMany({
      where: { tenantId },
      include: {
        creditAccount: true,
        invoices: { select: { grandTotal: true, createdAt: true }, orderBy: { createdAt: 'desc' } },
      },
    });

    const report = customers.map(c => ({
      id: c.id, name: c.name, mobileNumber: c.mobileNumber,
      totalPurchase: c.invoices.reduce((s, i) => s + i.grandTotal, 0),
      invoiceCount:  c.invoices.length,
      lastPurchase:  c.invoices[0]?.createdAt ?? null,
      rewardPoints:  c.totalRewardPoints,
      creditDue:     c.creditAccount?.currentDue  ?? 0,
      creditLimit:   c.creditAccount?.creditLimit ?? 0,
    }));

    return res.status(200).json({ customers: report });
  } catch (error) {
    console.error('Customer report error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ─── Expense Report ───────────────────────────────────────────────────────────

export const getExpenseReport = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const createdAt = dateFilter(req);
    const where: Prisma.ExpenseWhereInput = { tenantId, deletedAt: null };
    if (createdAt) where.createdAt = createdAt;

    const expenses = await prisma.expense.findMany({ where, orderBy: { date: 'desc' } });

    const byCategory: Record<string, number> = {};
    for (const e of expenses) {
      byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
    }

    return res.status(200).json({
      expenses,
      byCategory: Object.entries(byCategory)
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount),
      total: expenses.reduce((s, e) => s + e.amount, 0),
    });
  } catch (error) {
    console.error('Expense report error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ─── Credit Report ────────────────────────────────────────────────────────────

export const getCreditReport = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const accounts = await prisma.creditAccount.findMany({
      where: { tenantId },
      include: {
        customer:     { select: { name: true, mobileNumber: true } },
        transactions: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
      orderBy: { currentDue: 'desc' },
    });

    return res.status(200).json({
      accounts,
      totalDue:     accounts.reduce((s, a) => s + a.currentDue, 0),
      overdueCount: accounts.filter(a => a.currentDue > 0).length,
    });
  } catch (error) {
    console.error('Credit report error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ─── Stock Report ─────────────────────────────────────────────────────────────

export const getStockReport = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const items = await prisma.item.findMany({
      where: { tenantId, isActive: true },
      orderBy: { stockQty: 'asc' },
    });

    return res.status(200).json({
      items,
      stockSummary: {
        total:      items.length,
        outOfStock: items.filter(i => i.stockQty <= 0).length,
        lowStock:   items.filter(i => i.stockQty > 0 && i.stockQty <= 5).length,
        stockValue: items.reduce((s, i) => s + i.stockQty * (i.purchasePrice ?? i.price), 0),
      },
    });
  } catch (error) {
    console.error('Stock report error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
