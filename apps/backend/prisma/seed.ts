import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Clear existing data (in reverse order of dependencies)
  await prisma.telemetry.deleteMany({});
  await prisma.alert.deleteMany({});
  await prisma.asset.deleteMany({});
  await prisma.tag.deleteMany({});
  await prisma.anchor.deleteMany({});
  await prisma.gateway.deleteMany({});
  await prisma.zone.deleteMany({});
  await prisma.site.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.tenant.deleteMany({});

  console.log('🧹 Cleaned up existing database tables.');

  // 2. Create Tenants
  const tenant1 = await prisma.tenant.create({
    data: {
      name: 'PT ABC Logistics',
      status: 'active',
      agentLimit: 10,
      assetLimit: 150,
    },
  });

  const tenant2 = await prisma.tenant.create({
    data: {
      name: 'PT XYZ Manufacturing',
      status: 'active',
      agentLimit: 5,
      assetLimit: 50,
    },
  });

  console.log(`🏢 Created tenants: ${tenant1.name}, ${tenant2.name}`);

  // 3. Create Users
  const superadmin = await prisma.user.create({
    data: {
      email: 'superadmin@geomesh.io',
      password: 'superadmin123',
      name: 'Super Admin System',
      role: 'superadmin',
      isVerified: true,
      tenantId: tenant1.id,
    },
  });

  const user1 = await prisma.user.create({
    data: {
      email: 'admin@abclogistics.com',
      password: 'admin123',
      name: 'Budi Santoso',
      role: 'tenant_admin',
      isVerified: true,
      tenantId: tenant1.id,
    },
  });

  const user2 = await prisma.user.create({
    data: {
      email: 'operator@abclogistics.com',
      password: 'operator123',
      name: 'Siti Rahma',
      role: 'operator',
      isVerified: true,
      tenantId: tenant1.id,
    },
  });

  console.log(`👤 Created users: ${superadmin.name} (Superadmin), ${user1.name} (Tenant Admin), ${user2.name} (Operator)`);

  // 4. Create Sites
  const site1 = await prisma.site.create({
    data: {
      name: 'Warehouse Cawang',
      address: 'Jl. H. R. Rasuna Said No.X, Jakarta Selatan',
      tenantId: tenant1.id,
    },
  });

  console.log(`📍 Created site: ${site1.name}`);

  // 5. Create Zones
  const zone1 = await prisma.zone.create({
    data: {
      name: 'Storage Zone Alpha',
      floorPlanUrl: '/maps/cawang-storage-alpha.png',
      width: 50.0,  // 50 meters
      height: 30.0, // 30 meters
      siteId: site1.id,
    },
  });

  const zone2 = await prisma.zone.create({
    data: {
      name: 'Receiving Dock',
      floorPlanUrl: '/maps/cawang-receiving.png',
      width: 30.0,
      height: 20.0,
      siteId: site1.id,
    },
  });

  console.log(`🗺️ Created zones: ${zone1.name}, ${zone2.name}`);

  // 6. Create Gateways
  const gateway1 = await prisma.gateway.create({
    data: {
      id: 'gw-7c:2b:e9:11:22:33',
      name: 'Tiny Gateway Main Rack',
      status: 'online',
      tenantId: tenant1.id,
    },
  });

  console.log(`📡 Created gateway: ${gateway1.name} (${gateway1.id})`);

  // 7. Create Anchors
  const anchor1 = await prisma.anchor.create({
    data: {
      id: 'anchor-00:11:22:33:aa:01',
      name: 'Anchor North-East Corner',
      x: 45.5,
      y: 28.2,
      status: 'online',
      tenantId: tenant1.id,
      zoneId: zone1.id,
    },
  });

  const anchor2 = await prisma.anchor.create({
    data: {
      id: 'anchor-00:11:22:33:aa:02',
      name: 'Anchor South-West Column',
      x: 4.2,
      y: 3.5,
      status: 'online',
      tenantId: tenant1.id,
      zoneId: zone1.id,
    },
  });

  console.log(`*️⃣ Created anchors: ${anchor1.name}, ${anchor2.name}`);

  console.log('🎉 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
