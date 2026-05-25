import { Response } from 'express';
import { prisma } from 'database';
import { AuthRequest } from '../middleware/auth';

export const getStockDashboard = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const items = await prisma.item.findMany({
      where: { tenantId, isActive: true },
      select: { stockQty: true, price: true, purchasePrice: true },
    });

    const totalItems  = items.length;
    const outOfStock  = items.filter(i => i.stockQty <= 0).length;
    const lowStock    = items.filter(i => i.stockQty > 0 && i.stockQty <= 5).length;
    const stockValue  = items.reduce((s, i) => s + i.stockQty * (i.purchasePrice ?? i.price), 0);
    const retailValue = items.reduce((s, i) => s + i.stockQty * i.price, 0);

    return res.status(200).json({ dashboard: { totalItems, outOfStock, lowStock, stockValue, retailValue } });
  } catch (error) {
    console.error('Stock dashboard error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getStockList = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const { filter } = req.query;
    let where: Record<string, unknown> = { tenantId, isActive: true };
    if (filter === 'low') where = { ...where, stockQty: { gt: 0, lte: 5 } };
    if (filter === 'out') where = { ...where, stockQty: { lte: 0 } };

    const items = await prisma.item.findMany({ where, orderBy: { name: 'asc' } });
    return res.status(200).json({ items });
  } catch (error) {
    console.error('Get stock list error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getStockHistory = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const { itemId, startDate, endDate } = req.query;
    const where: Record<string, unknown> = { tenantId };
    if (itemId) where.itemId = itemId as string;
    if (startDate || endDate) {
      where.entryDate = {
        ...(startDate ? { gte: new Date(startDate as string) } : {}),
        ...(endDate   ? { lte: new Date(endDate as string)   } : {}),
      };
    }

    const entries = await prisma.stockEntry.findMany({
      where,
      include: {
        item:     { select: { name: true, unit: true } },
        supplier: { select: { name: true } },
      },
      orderBy: { entryDate: 'desc' },
      take: 200,
    });

    return res.status(200).json({ entries });
  } catch (error) {
    console.error('Stock history error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const createStockEntry = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const { itemId, supplierId, qty, purchasePrice, movementType, entryDate, notes } = req.body;
    if (!itemId || qty === undefined) {
      return res.status(400).json({ error: 'itemId and qty are required' });
    }

    const parsedQty = parseFloat(qty);
    const mType     = (movementType as string) || 'ADD';

    const item = await prisma.item.findFirst({ where: { id: itemId as string, tenantId } });
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const qtyDelta = (mType === 'DAMAGE' || mType === 'SALE')
      ? -Math.abs(parsedQty)
      :  Math.abs(parsedQty);

    const [entry] = await prisma.$transaction([
      prisma.stockEntry.create({
        data: {
          tenantId,
          itemId:        itemId as string,
          supplierId:    supplierId || null,
          qty:           parsedQty,
          purchasePrice: purchasePrice ? parseFloat(purchasePrice) : null,
          movementType:  mType,
          entryDate:     entryDate ? new Date(entryDate as string) : new Date(),
          notes:         notes || null,
        },
        include: { item: { select: { name: true, unit: true } } },
      }),
      prisma.item.update({
        where: { id: itemId as string },
        data:  { stockQty: { increment: qtyDelta } },
      }),
    ]);

    return res.status(201).json({ entry });
  } catch (error) {
    console.error('Create stock entry error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteStockEntry = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const id = req.params.id as string;
    const existing = await prisma.stockEntry.findFirst({ where: { id, tenantId } });
    if (!existing) return res.status(404).json({ error: 'Stock entry not found' });

    const qtyDelta = (existing.movementType === 'DAMAGE' || existing.movementType === 'SALE')
      ?  Math.abs(existing.qty)
      : -Math.abs(existing.qty);

    await prisma.$transaction([
      prisma.stockEntry.delete({ where: { id } }),
      prisma.item.update({
        where: { id: existing.itemId },
        data:  { stockQty: { increment: qtyDelta } },
      }),
    ]);

    return res.status(200).json({ message: 'Stock entry deleted' });
  } catch (error) {
    console.error('Delete stock entry error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getSuppliers = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const suppliers = await prisma.supplier.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });

    return res.status(200).json({ suppliers });
  } catch (error) {
    console.error('Get suppliers error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const createSupplier = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const { name, mobile, address } = req.body;
    if (!name) return res.status(400).json({ error: 'Supplier name is required' });

    const supplier = await prisma.supplier.create({
      data: { tenantId, name, mobile: mobile || null, address: address || null },
    });

    return res.status(201).json({ supplier });
  } catch (error) {
    console.error('Create supplier error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
