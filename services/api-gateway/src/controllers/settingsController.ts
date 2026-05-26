import { Response } from 'express';
import { prisma } from 'database';
import { AuthRequest } from '../middleware/auth';
import fs from 'fs';
import path from 'path';

export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    let profile = await prisma.storeProfile.findUnique({ where: { tenantId } });

    if (!profile) {
      profile = await prisma.storeProfile.create({
        data: { tenantId, name: 'My Store', address: '', gstNumber: '' },
      });
    }

    return res.status(200).json({ profile });
  } catch (error: any) {
    console.error('Get profile error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error?.message });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const b = req.body as Record<string, unknown>;
    const name = typeof b.name === 'string' ? b.name : '';
    if (!name.trim()) return res.status(400).json({ error: 'Store name is required' });

    const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

    const profile = await prisma.storeProfile.upsert({
      where: { tenantId },
      update: {
        name,
        address: str(b.address),
        storeMobile: str(b.storeMobile),
        storeEmail: str(b.storeEmail),
        storeWebsite: str(b.storeWebsite),
        state: str(b.state),
        pincode: str(b.pincode),
        placeOfSupply: str(b.placeOfSupply),
        gstNumber: str(b.gstNumber),
        logoUrl: str(b.logoUrl),
        loginImageUrl: str(b.loginImageUrl),
        invoiceFooterNote: str(b.invoiceFooterNote),
      },
      create: {
        tenantId,
        name,
        address: str(b.address),
        storeMobile: str(b.storeMobile),
        storeEmail: str(b.storeEmail),
        storeWebsite: str(b.storeWebsite),
        state: str(b.state),
        pincode: str(b.pincode),
        placeOfSupply: str(b.placeOfSupply),
        gstNumber: str(b.gstNumber),
        logoUrl: str(b.logoUrl),
        loginImageUrl: str(b.loginImageUrl),
        invoiceFooterNote: str(b.invoiceFooterNote),
      },
    });

    return res.status(200).json({ profile });
  } catch (error: any) {
    console.error('Update profile error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error?.message });
  }
};

export const clearLoginImage = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const profile = await prisma.storeProfile.update({
      where: { tenantId },
      data: { loginImageUrl: null },
    });

    return res.status(200).json({ profile });
  } catch (error: any) {
    console.error('Clear login image error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error?.message });
  }
};

export const getSettings = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    let settings = await prisma.tenantSettings.findUnique({ where: { tenantId } });

    if (!settings) {
      settings = await prisma.tenantSettings.create({
        data: { tenantId, rewardConversionRate: 0.1, invoicePrefix: 'INV-', thermalPrintEnabled: true },
      });
    }

    return res.status(200).json({ settings });
  } catch (error: any) {
    console.error('Get settings error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error?.message });
  }
};

export const updateSettings = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const b = req.body as Record<string, unknown>;

    const bool = (v: unknown, def: boolean): boolean => {
      if (typeof v === 'boolean') return v;
      if (v === 'true') return true;
      if (v === 'false') return false;
      return def;
    };
    const num = (v: unknown, def: number): number => {
      const n = Number(v);
      return isNaN(n) ? def : n;
    };
    const str = (v: unknown, def: string): string => (typeof v === 'string' && v !== '' ? v : def);
    const strN = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

    const data = {
      rewardConversionRate: num(b.rewardConversionRate, 0),
      invoicePrefix: str(b.invoicePrefix, 'INV-'),
      billPrefix: str(b.billPrefix, 'BILL-'),
      gstEnabled: bool(b.gstEnabled, true),
      allowManualGstEdit: bool(b.allowManualGstEdit, false),
      thermalPrintEnabled: bool(b.thermalPrintEnabled, true),
      thermalPaperWidth: str(b.thermalPaperWidth, '80mm'),
      thermalPrinterName: strN(b.thermalPrinterName),
      thermalHeaderText: strN(b.thermalHeaderText),
      autoPrintAfterCheckout: bool(b.autoPrintAfterCheckout, false),
      showLogoOnBill: bool(b.showLogoOnBill, true),
      showLogoOnInvoice: bool(b.showLogoOnInvoice, true),
      compactBillMode: bool(b.compactBillMode, false),
      rewardRedemptionEnabled: bool(b.rewardRedemptionEnabled, true),
      creditLimitDefault: num(b.creditLimitDefault, 5000),
      overdueAlertDays: Math.round(num(b.overdueAlertDays, 30)),
      enableCash: bool(b.enableCash, true),
      enableCard: bool(b.enableCard, true),
      enableUpi: bool(b.enableUpi, true),
      enableCredit: bool(b.enableCredit, true),
      enableSplit: bool(b.enableSplit, true),
      manualQtyEnabled: bool(b.manualQtyEnabled, false),
      discountEnabled: bool(b.discountEnabled, false),
      roundUpEnabled: bool(b.roundUpEnabled, false),
    };

    const settings = await prisma.tenantSettings.upsert({
      where: { tenantId },
      update: data,
      create: { tenantId, ...data },
    });

    return res.status(200).json({ settings });
  } catch (error: any) {
    console.error('Update settings error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error?.message });
  }
};

export const uploadLogo = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const b = req.body as Record<string, unknown>;
    const fieldName = typeof b.fieldName === 'string' ? b.fieldName : 'logo';
    const dataUrl = typeof b.dataUrl === 'string' ? b.dataUrl : '';

    if (!dataUrl || !dataUrl.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Invalid image data' });
    }

    const matches = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: 'Invalid data URL format' });

    const ext = (matches[1] ?? 'png') === 'jpeg' ? 'jpg' : (matches[1] ?? 'png');
    const base64Data = matches[2] ?? '';
    const buffer = Buffer.from(base64Data, 'base64');

    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const filename = `${tenantId}-${fieldName}-${Date.now()}.${ext}`;
    const filepath = path.join(uploadsDir, filename);
    fs.writeFileSync(filepath, buffer);

    const url = `/uploads/${filename}`;
    return res.status(200).json({ url });
  } catch (error: any) {
    console.error('Upload logo error:', error);
    return res.status(500).json({ error: 'Upload failed', details: error?.message });
  }
};
