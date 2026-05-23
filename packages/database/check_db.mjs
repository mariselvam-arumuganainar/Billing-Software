import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
try {
  const tenantCount = await prisma.tenant.count();
  console.log('Tenant count:', tenantCount);
  const creds = await prisma.tenantCredential.findMany({ select: { mobileNumber: true } });
  console.log('Credentials:', JSON.stringify(creds));
} catch (e) {
  console.error('Error:', e.message);
} finally {
  await prisma.$disconnect();
}
