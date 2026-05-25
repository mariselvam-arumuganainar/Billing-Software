import { prisma } from './index';

async function main() {
  console.log('Seeding database...');

  // Clean existing data to avoid unique constraint violations
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

  // 1. Create a Tenant
  const tenant = await prisma.tenant.create({
    data: {
      name: 'My Store',
      status: 'ACTIVE',
    },
  });

  // 2. Pre-calculated password hash for 'password'
  const passwordHash = '$2b$10$wH.YWNaihhe37VvE/IWKsekbTSpGIsLjgYUefSwOZ3qAhodkxCaDS';
  await prisma.tenantCredential.create({
    data: {
      tenantId: tenant.id,
      mobileNumber: '9876543210',
      passwordHash,
    },
  });

  // 3. Create Store Profile
  await prisma.storeProfile.create({
    data: {
      tenantId: tenant.id,
      name: 'My Store - Bangalore Branch',
      address: '123 Retail Lane, HSR Layout, Bengaluru, Karnataka - 560102',
      gstNumber: '29AAAAA1111A1Z1',
    },
  });

  // 4. Create Tenant Settings
  await prisma.tenantSettings.create({
    data: {
      tenantId: tenant.id,
      rewardConversionRate: 0.1, // 1 point per 10 rupees spent
      invoicePrefix: 'My-',
      thermalPrintEnabled: true,
    },
  });

  // 5. Create Items (Basmati Rice, Sunflower Oil, Salt, etc.)
  await prisma.item.createMany({
    data: [
      {
        tenantId: tenant.id,
        name: 'Premium Basmati Rice',
        sku: 'RICE-BAS-001',
        unit: 'kg',
        price: 120.0,
        gstRateDefault: 5.0,
        hsnSac: '1006',
        stockQty: 150.0,
      },
      {
        tenantId: tenant.id,
        name: 'Sunflower Cooking Oil 1L',
        sku: 'OIL-SUN-002',
        unit: 'liter',
        price: 180.0,
        gstRateDefault: 12.0,
        hsnSac: '1512',
        stockQty: 80.0,
      },
      {
        tenantId: tenant.id,
        name: 'Tata Salt 1kg',
        sku: 'SALT-TAT-003',
        unit: 'piece',
        price: 25.0,
        gstRateDefault: 0.0,
        hsnSac: '2501',
        stockQty: 300.0,
      },
      {
        tenantId: tenant.id,
        name: 'Organic Toor Dal 1kg',
        sku: 'DAL-TOOR-004',
        unit: 'kg',
        price: 160.0,
        gstRateDefault: 5.0,
        hsnSac: '0713',
        stockQty: 90.0,
      },
      {
        tenantId: tenant.id,
        name: 'Britannia Marie Gold 250g',
        sku: 'BIS-MAR-005',
        unit: 'piece',
        price: 30.0,
        gstRateDefault: 18.0,
        hsnSac: '1905',
        stockQty: 200.0,
      },
    ],
  });

  // 6. Create a Customer
  const customer = await prisma.customer.create({
    data: {
      tenantId: tenant.id,
      name: 'John Doe',
      mobileNumber: '9999999999',
      totalRewardPoints: 120.0,
    },
  });

  // 7. Create Credit Account for the Customer
  await prisma.creditAccount.create({
    data: {
      tenantId: tenant.id,
      customerId: customer.id,
      creditLimit: 5000.0,
      currentDue: 0.0,
    },
  });

  console.log('Database seeded successfully!');
  console.log(`My Store Tenant ID: ${tenant.id}`);
  console.log('Use mobile: 9876543210 / password: password to log in.');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
