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
    },
  });

  const tenant2 = await prisma.tenant.create({
    data: {
      name: 'PT XYZ Manufacturing',
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

  // 8. Create Tags (IoT Devices)
  const tag1 = await prisma.tag.create({
    data: {
      id: 'node-439201',
      name: 'EYE Sensor Forklift #1',
      battery: 3.6, // Volts
      rssi: -62,    // dBm
      temperature: 24.8,
      humidity: 50.5,
      lastSeen: new Date(),
    },
  });

  const tag2 = await prisma.tag.create({
    data: {
      id: 'node-439202',
      name: 'EYE Sensor Pallet #A4',
      battery: 3.4,
      rssi: -71,
      temperature: 22.1,
      humidity: 54.3,
      lastSeen: new Date(),
    },
  });

  console.log(`🏷️ Created sensor tags: ${tag1.id}, ${tag2.id}`);

  // 9. Create Assets & Link to Tags
  const asset1 = await prisma.asset.create({
    data: {
      name: 'Toyota Forklift TF-01',
      description: 'Forklift area penyimpanan utama Cawang',
      status: 'moving',
      tenantId: tenant1.id,
      zoneId: zone1.id,
      tagId: tag1.id,
    },
  });

  const asset2 = await prisma.asset.create({
    data: {
      name: 'Pallet Kargo Ekspor A4',
      description: 'Kargo berisi suku cadang otomotif',
      status: 'static',
      tenantId: tenant1.id,
      zoneId: zone1.id,
      tagId: tag2.id,
    },
  });

  console.log(`📦 Created assets: ${asset1.name} (linked to ${tag1.id}), ${asset2.name} (linked to ${tag2.id})`);

  // 10. Create Alerts
  const alert1 = await prisma.alert.create({
    data: {
      type: 'tilt_warning',
      message: 'Aset Pallet Kargo Ekspor A4 terdeteksi miring melebihi 15 derajat!',
      isResolved: false,
      tenantId: tenant1.id,
      assetId: asset2.id,
    },
  });

  console.log(`⚠️ Created active alert: ${alert1.message}`);

  // 11. Create Telemetry History (TimescaleDB mock raw telemetry)
  const now = new Date();
  await prisma.telemetry.createMany({
    data: [
      {
        timestamp: new Date(now.getTime() - 60000 * 5),
        tagId: tag1.id,
        temperature: 24.5,
        humidity: 50.1,
        battery: 3.6,
        rssi: -65,
        accelX: 0.12,
        accelY: -0.05,
        accelZ: 0.96,
        pitch: 1.2,
        roll: -0.5,
        hall: 0,
      },
      {
        timestamp: new Date(now.getTime() - 60000 * 3),
        tagId: tag1.id,
        temperature: 24.7,
        humidity: 50.3,
        battery: 3.6,
        rssi: -63,
        accelX: 0.25,
        accelY: 0.12,
        accelZ: 0.88,
        pitch: 3.4,
        roll: -1.1,
        hall: 0,
      },
      {
        timestamp: now,
        tagId: tag1.id,
        temperature: 24.8,
        humidity: 50.5,
        battery: 3.6,
        rssi: -62,
        accelX: 0.05,
        accelY: -0.02,
        accelZ: 0.98,
        pitch: 2.5,
        roll: -1.2,
        hall: 0,
      },
    ],
  });

  console.log('📈 Inserted historical telemetry logs.');
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
