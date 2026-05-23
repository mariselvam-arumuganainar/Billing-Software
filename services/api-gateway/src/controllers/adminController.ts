import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from 'database'; // Using our local package

export const createTenant = async (req: Request, res: Response) => {
  try {
    const { name, mobileNumber, password } = req.body;

    if (!name || !mobileNumber || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create tenant and credentials in a transaction
    const newTenant = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name,
        }
      });

      await tx.tenantCredential.create({
        data: {
          tenantId: tenant.id,
          mobileNumber,
          passwordHash,
        }
      });

      await tx.tenantSettings.create({
        data: {
          tenantId: tenant.id,
        }
      });

      await tx.storeProfile.create({
        data: {
          tenantId: tenant.id,
          name,
        }
      });

      return tenant;
    });

    return res.status(201).json({ message: 'Tenant created', tenant: newTenant });
  } catch (error: any) {
    console.error('Error creating tenant:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

export const listTenants = async (req: Request, res: Response) => {
  try {
    const tenants = await prisma.tenant.findMany({
      include: {
        profile: true,
        credentials: {
          select: {
            mobileNumber: true
          }
        }
      }
    });
    return res.status(200).json({ tenants });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const toggleTenantStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'ACTIVE' or 'SUSPENDED'

    if (!status || (status !== 'ACTIVE' && status !== 'SUSPENDED')) {
      return res.status(400).json({ error: 'Invalid or missing status parameter' });
    }

    const tenant = await prisma.tenant.update({
      where: { id: id as string },
      data: { status }
    });

    return res.status(200).json({ message: `Tenant status updated to ${status}`, tenant });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    console.error('Error toggling tenant status:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

