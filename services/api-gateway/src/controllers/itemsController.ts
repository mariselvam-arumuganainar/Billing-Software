import { Response } from "express";
import { prisma } from "database";
import { AuthRequest } from "../middleware/auth";

type ItemPayload = {
  name?: string;
  sku?: string;
  barcode?: string;
  unit?: string;
  price?: string | number;
  gstRateDefault?: string | number;
  hsnSac?: string;
  stockQty?: string | number;
  imageUrl?: string;
  isActive?: boolean;
  discountRate?: string | number;
};

const toNumber = (value: string | number | undefined, fallback = 0): number => {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = typeof value === "number" ? value : parseFloat(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const normalizeRequiredString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

const normalizeNullableString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const normalizeItemPayload = (body: ItemPayload) => {
  return {
    name: normalizeRequiredString(body.name) ?? "",
    sku: normalizeNullableString(body.sku),
    barcode: normalizeNullableString(body.barcode),
    unit: normalizeRequiredString(body.unit) ?? "",
    price: toNumber(body.price, 0),
    gstRateDefault: toNumber(body.gstRateDefault, 0),
    hsnSac: normalizeNullableString(body.hsnSac),
    stockQty: toNumber(body.stockQty, 0),
    imageUrl: normalizeNullableString(body.imageUrl),
    discountRate: toNumber(body.discountRate, 0),
  };
};

const isDuplicateBarcodeError = (error: unknown): boolean => {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2002" &&
    "meta" in error &&
    JSON.stringify((error as { meta: unknown }).meta).includes("barcode")
  );
};

const getSingleParam = (value: string | string[] | undefined): string | undefined => {
  if (Array.isArray(value)) return value[0];
  return value;
};

const getValidatedTenantId = async (req: AuthRequest) => {
  const tenantId = req.user?.tenantId;

  if (!tenantId) {
    return { error: { status: 401, message: "Unauthorized: tenant context missing" } };
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, status: true },
  });

  if (!tenant) {
    return { error: { status: 401, message: "Unauthorized: invalid tenant context" } };
  }

  if (tenant.status !== "ACTIVE") {
    return { error: { status: 403, message: "Tenant is not active" } };
  }

  return { tenantId: tenant.id, tenant };
};

export const getItems = async (req: AuthRequest, res: Response) => {
  try {
    const tenantResult = await getValidatedTenantId(req);

    if ("error" in tenantResult) {
      return res.status(tenantResult.error.status).json({ error: tenantResult.error.message });
    }

    const items = await prisma.item.findMany({
      where: { tenantId: tenantResult.tenantId },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({ items });
  } catch (error: any) {
    console.error("getItems error", error);
    return res.status(500).json({
      error: "Internal server error",
      details: error?.message,
    });
  }
};

export const getItemById = async (req: AuthRequest, res: Response) => {
  try {
    const tenantResult = await getValidatedTenantId(req);
    const itemId = getSingleParam(req.params.itemId);

    if ("error" in tenantResult) {
      return res.status(tenantResult.error.status).json({ error: tenantResult.error.message });
    }

    if (!itemId) {
      return res.status(400).json({ error: "Item id is required" });
    }

    const item = await prisma.item.findFirst({
      where: {
        id: itemId,
        tenantId: tenantResult.tenantId,
      },
    });

    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    return res.status(200).json({ item });
  } catch (error: any) {
    console.error("getItemById error", error);
    return res.status(500).json({
      error: "Internal server error",
      details: error?.message,
    });
  }
};

export const createItem = async (req: AuthRequest, res: Response) => {
  try {
    const tenantResult = await getValidatedTenantId(req);

    if ("error" in tenantResult) {
      return res.status(tenantResult.error.status).json({ error: tenantResult.error.message });
    }

    const payload = normalizeItemPayload(req.body);

    if (!payload.name || !payload.unit) {
      return res.status(400).json({
        error: "Item name and unit are required",
      });
    }

    if (payload.price < 0) {
      return res.status(400).json({ error: "Price cannot be negative" });
    }

    if (payload.gstRateDefault < 0) {
      return res.status(400).json({ error: "GST rate cannot be negative" });
    }

    if (payload.stockQty < 0) {
      return res.status(400).json({ error: "Stock quantity cannot be negative" });
    }

    const item = await prisma.item.create({
      data: {
        tenantId: tenantResult.tenantId,
        name: payload.name,
        sku: payload.sku,
        barcode: payload.barcode,
        unit: payload.unit,
        price: payload.price,
        gstRateDefault: payload.gstRateDefault,
        hsnSac: payload.hsnSac,
        stockQty: payload.stockQty,
        imageUrl: payload.imageUrl,
        discountRate: payload.discountRate,
      },
    });

    return res.status(201).json({ item });
  } catch (error: any) {
    if (isDuplicateBarcodeError(error)) {
      return res.status(409).json({
        error: "Barcode already registered to another item. Please use a unique barcode.",
      });
    }
    console.error("createItem error", error);
    return res.status(500).json({
      error: "Internal server error",
      details: error?.message,
    });
  }
};

export const updateItem = async (req: AuthRequest, res: Response) => {
  try {
    const tenantResult = await getValidatedTenantId(req);
    const itemId = getSingleParam(req.params.itemId);

    if ("error" in tenantResult) {
      return res.status(tenantResult.error.status).json({ error: tenantResult.error.message });
    }

    if (!itemId) {
      return res.status(400).json({ error: "Item id is required" });
    }

    const existing = await prisma.item.findFirst({
      where: {
        id: itemId,
        tenantId: tenantResult.tenantId,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: "Item not found" });
    }

    const payload = normalizeItemPayload(req.body);

    if (!payload.name || !payload.unit) {
      return res.status(400).json({
        error: "Item name and unit are required",
      });
    }

    if (payload.price < 0) {
      return res.status(400).json({ error: "Price cannot be negative" });
    }

    if (payload.gstRateDefault < 0) {
      return res.status(400).json({ error: "GST rate cannot be negative" });
    }

    if (payload.stockQty < 0) {
      return res.status(400).json({ error: "Stock quantity cannot be negative" });
    }

    const item = await prisma.item.update({
      where: { id: itemId },
      data: {
        name: payload.name,
        sku: payload.sku,
        barcode: payload.barcode,
        unit: payload.unit,
        price: payload.price,
        gstRateDefault: payload.gstRateDefault,
        hsnSac: payload.hsnSac,
        stockQty: payload.stockQty,
        imageUrl: payload.imageUrl,
        discountRate: payload.discountRate,
      },
    });

    return res.status(200).json({ item });
  } catch (error: any) {
    if (isDuplicateBarcodeError(error)) {
      return res.status(409).json({
        error: "Barcode already registered to another item. Please use a unique barcode.",
      });
    }
    console.error("updateItem error", error);
    return res.status(500).json({
      error: "Internal server error",
      details: error?.message,
    });
  }
};

export const updateItemStatus = async (req: AuthRequest, res: Response) => {
  try {
    const tenantResult = await getValidatedTenantId(req);
    const itemId = getSingleParam(req.params.itemId);
    const { isActive } = req.body as { isActive?: boolean };

    if ("error" in tenantResult) {
      return res.status(tenantResult.error.status).json({ error: tenantResult.error.message });
    }

    if (!itemId) {
      return res.status(400).json({ error: "Item id is required" });
    }

    if (typeof isActive !== "boolean") {
      return res.status(400).json({ error: "isActive must be a boolean" });
    }

    const existing = await prisma.item.findFirst({
      where: {
        id: itemId,
        tenantId: tenantResult.tenantId,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: "Item not found" });
    }

    const item = await prisma.item.update({
      where: { id: itemId },
      data: { isActive },
    });

    return res.status(200).json({ item });
  } catch (error: any) {
    console.error("updateItemStatus error", error);
    return res.status(500).json({
      error: "Internal server error",
      details: error?.message,
    });
  }
};

export const deleteItem = async (req: AuthRequest, res: Response) => {
  try {
    const tenantResult = await getValidatedTenantId(req);
    const itemId = getSingleParam(req.params.itemId);

    if ("error" in tenantResult) {
      return res.status(tenantResult.error.status).json({ error: tenantResult.error.message });
    }

    if (!itemId) {
      return res.status(400).json({ error: "Item id is required" });
    }

    const existing = await prisma.item.findFirst({
      where: {
        id: itemId,
        tenantId: tenantResult.tenantId,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: "Item not found" });
    }

    await prisma.item.delete({
      where: { id: itemId },
    });

    return res.status(200).json({
      message: "Item deleted successfully",
    });
  } catch (error: any) {
    console.error("deleteItem error", error);
    return res.status(500).json({
      error: "Internal server error",
      details: error?.message,
    });
  }
};

export const getItemByBarcode = async (req: AuthRequest, res: Response) => {
  try {
    const tenantResult = await getValidatedTenantId(req);

    if ("error" in tenantResult) {
      return res.status(tenantResult.error.status).json({ error: tenantResult.error.message });
    }

    const barcode = getSingleParam(req.params.barcode);

    if (!barcode || !barcode.trim()) {
      return res.status(400).json({ error: "Barcode is required" });
    }

    const item = await prisma.item.findFirst({
      where: {
        tenantId: tenantResult.tenantId,
        barcode: barcode.trim(),
        isActive: true,
      },
    });

    if (!item) {
      return res.status(404).json({ error: "No active item found for this barcode" });
    }

    return res.status(200).json({ item });
  } catch (error: any) {
    console.error("getItemByBarcode error", error);
    return res.status(500).json({
      error: "Internal server error",
      details: error?.message,
    });
  }
};