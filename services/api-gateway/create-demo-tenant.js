// One-time script to create a demo tenant account.
// Run inside the api-gateway container:
//   docker compose exec api-gateway node /app/services/api-gateway/create-demo-tenant.js

const bcrypt = require('bcrypt');
const { PrismaClient } = require('/app/packages/database/node_modules/@prisma/client');

const prisma = new PrismaClient();

const MOBILE   = '9876543210';
const PASSWORD = 'password';
const NAME     = 'Demo Store';

async function main() {
  const existing = await prisma.tenantCredential.findUnique({
    where: { mobileNumber: MOBILE },
  });

  if (existing) {
    console.log('A tenant with mobile ' + MOBILE + ' already exists. Nothing created.');
    return;
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const tenant = await prisma.$transaction(async (tx) => {
    const t = await tx.tenant.create({
      data: { name: NAME, status: 'ACTIVE' },
    });
    await tx.tenantCredential.create({
      data: { tenantId: t.id, mobileNumber: MOBILE, passwordHash },
    });
    await tx.tenantSettings.create({
      data: { tenantId: t.id },
    });
    await tx.storeProfile.create({
      data: { tenantId: t.id, name: NAME },
    });
    return t;
  });

  console.log('');
  console.log('Demo tenant created successfully!');
  console.log('   Store Name : ' + NAME);
  console.log('   Mobile     : ' + MOBILE);
  console.log('   Password   : ' + PASSWORD);
  console.log('   Tenant ID  : ' + tenant.id);
  console.log('');
  console.log('Login at http://localhost:3000');
}

main()
  .catch((e) => { console.error('Error:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
