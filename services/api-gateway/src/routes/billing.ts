import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const BILLING_URL = process.env.BILLING_ENGINE_URL || 'http://localhost:8082';
const INTERNAL_KEY = process.env.BILLING_INTERNAL_KEY;
if (!INTERNAL_KEY) {
  console.error('FATAL: BILLING_INTERNAL_KEY environment variable is not set.');
  process.exit(1);
}

router.post('/checkout', async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenantId ?? '';
  if (req.user?.role === 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Super admin cannot perform checkout' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const upstream = await fetch(`${BILLING_URL}/api/v1/billing/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': tenantId,
        'X-Internal-Key': INTERNAL_KEY!,
      },
      body: JSON.stringify(req.body),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (err: any) {
    clearTimeout(timeout);
    if (err?.name === 'AbortError') {
      return res.status(504).json({ error: 'Billing service timed out. Please retry.' });
    }
    return res.status(503).json({ error: 'Billing service unavailable.' });
  }
});

export default router;
