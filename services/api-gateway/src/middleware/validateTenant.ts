import { Response, NextFunction } from 'express';
import { prisma } from 'database';
import { AuthRequest } from './auth';

export const validateTenant = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const tenantId = req.user?.tenantId;
  const role = req.user?.role;

  if (!tenantId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Super admin has no tenant record in DB
  if (role === 'SUPER_ADMIN') {
    return next();
  }

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { status: true },
    });

    if (!tenant) {
      return res.status(401).json({ error: 'Tenant not found. Please log in again.' });
    }

    if (tenant.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Tenant account is suspended.' });
    }

    next();
  } catch (err) {
    console.error('validateTenant error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
