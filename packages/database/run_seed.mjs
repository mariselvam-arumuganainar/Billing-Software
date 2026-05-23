import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres:postgres@localhost:5434/billing_saas?schema=public' } }
});

async function main() {
  console.log('Seeding database...');

  await prisma.tenantCredential.deleteMany({});
  await prisma.tenantSettings.deleteMany({});
  await prisma.storeProfile.deleteMany({});
  await prisma.invoiceLine.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.item.deleteMany({});
  await prisma.rewardLedger.deleteMany({});
  await prisma.creditTransaction.deleteMany({});
  await prisma.creditAccount.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.expense.deleteMany({});
  await prisma.tenant.deleteMany({});

  const tenant = await prisma.tenant.create({
    data: { name: 'PSS Store', status: 'ACTIVE' }
  });

  // bcrypt hash for 'password' (cost 10)
  const passwordHash = '$2b$10$wH.YWNaihhe37VvE/IWKsekbTSpGIsLjgYUefSwOZ3qAhodkxCaDS';

  await prisma.tenantCredential.create({
    data: { tenantId: tenant.id, mobileNumber: '9876543210', passwordHash }
  });

  await prisma.storeProfile.create({
    data: {
      tenantId: tenant.id,
      name: 'PSS Store - Bangalore Branch',
      address: '123 Retail Lane, HSR Layout, Bengaluru, Karnataka - 560102',
      gstNumber: '29AAAAA1111A1Z1'
    }
  });

  await prisma.tenantSettings.create({
    data: {
      tenantId: tenant.id,
      rewardConversionRate: 0.1,
      invoicePrefix: 'PSS-',
      thermalPrintEnabled: true
    }
  });

  await prisma.item.createMany({
    data: [
      { tenantId: tenant.id, name: 'Premium Basmati Rice', sku: 'RICE-BAS-001', unit: 'kg', price: 120.0, gstRateDefault: 5.0, hsnSac: '1006', stockQty: 150.0 },
      { tenantId: tenant.id, name: 'Sunflower Cooking Oil 1L', sku: 'OIL-SUN-002', unit: 'liter', price: 180.0, gstRateDefault: 12.0, hsnSac: '1512', stockQty: 80.0 },
      { tenantId: tenant.id, name: 'Tata Salt 1kg', sku: 'SALT-TAT-003', unit: 'piece', price: 25.0, gstRateDefault: 0.0, hsnSac: '2501', stockQty: 300.0 },
      { tenantId: tenant.id, name: 'Organic Toor Dal 1kg', sku: 'DAL-TOOR-004', unit: 'kg', price: 160.0, gstRateDefault: 5.0, hsnSac: '0713', stockQty: 90.0 },
      { tenantId: tenant.id, name: 'Britannia Marie Gold 250g', sku: 'BIS-MAR-005', unit: 'piece', price: 30.0, gstRateDefault: 18.0, hsnSac: '1905', stockQty: 200.0 }
    ]
  });

  const customer = await prisma.customer.create({
    data: { tenantId: tenant.id, name: 'John Doe', mobileNumber: '9999999999', totalRewardPoints: 120.0 }
  });

  await prisma.creditAccount.create({
    data: { tenantId: tenant.id, customerId: customer.id, creditLimit: 5000.0, currentDue: 0.0 }
  });

  console.log('\n✅ Database seeded successfully!');
  console.log(`   Tenant ID : ${tenant.id}`);
  console.log('   Login     : mobile 9876543210 / password: password');
}

main()
  .catch(e => { console.error('Seed error:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
