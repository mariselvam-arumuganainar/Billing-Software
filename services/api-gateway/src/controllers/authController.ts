import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from 'database';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) { console.error('FATAL: JWT_SECRET not set'); process.exit(1); }

const SA_USERNAME = process.env.SUPER_ADMIN_USERNAME;
const SA_PASSWORD = process.env.SUPER_ADMIN_PASSWORD;
if (!SA_USERNAME || !SA_PASSWORD) {
  console.error('FATAL: SUPER_ADMIN_USERNAME and SUPER_ADMIN_PASSWORD must be set');
  process.exit(1);
}

// Optional second super admin account
const SA_USERNAME_2 = process.env.SUPER_ADMIN_USERNAME_2;
const SA_PASSWORD_2 = process.env.SUPER_ADMIN_PASSWORD_2;

const isSuperAdmin = (username: string, password: string): boolean => {
  if (username === SA_USERNAME && password === SA_PASSWORD) return true;
  if (SA_USERNAME_2 && SA_PASSWORD_2 && username === SA_USERNAME_2 && password === SA_PASSWORD_2) return true;
  return false;
};

export const login = async (req: Request, res: Response) => {
  try {
    const { mobileNumber, password } = req.body;
    if (!mobileNumber || !password) {
      return res.status(400).json({ error: 'Missing credentials' });
    }

    if (isSuperAdmin(mobileNumber, password)) {
      const token = jwt.sign(
        { tenantId: 'super-admin', role: 'SUPER_ADMIN' },
        JWT_SECRET!,
        { expiresIn: '8h' }
      );
      return res.status(200).json({ token, tenantId: 'super-admin', tenantName: 'Super Admin System', role: 'SUPER_ADMIN' });
    }

    const credential = await prisma.tenantCredential.findUnique({
      where: { mobileNumber },
      include: { tenant: true },
    });

    if (!credential) return res.status(401).json({ error: 'Invalid credentials' });
    if (credential.tenant.status !== 'ACTIVE') return res.status(403).json({ error: 'Tenant account is not active' });

    const validPassword = await bcrypt.compare(password, credential.passwordHash);
    if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { tenantId: credential.tenantId, role: 'CLIENT_OWNER' },
      JWT_SECRET!,
      { expiresIn: '8h' }
    );
    return res.status(200).json({ token, tenantId: credential.tenantId, tenantName: credential.tenant.name, role: 'CLIENT_OWNER' });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getLoginConfig = async (req: Request, res: Response) => {
  try {
    const { query } = req.query;
    if (!query || typeof query !== 'string') return res.status(200).json({ loginImageUrl: null });
    if (query === SA_USERNAME || query === SA_USERNAME_2) return res.status(200).json({ loginImageUrl: null });

    const credential = await prisma.tenantCredential.findUnique({
      where: { mobileNumber: query },
      include: { tenant: { include: { profile: true } } },
    });
    return res.status(200).json({ loginImageUrl: credential?.tenant?.profile?.loginImageUrl ?? null });
  } catch (error) {
    console.error('getLoginConfig error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
