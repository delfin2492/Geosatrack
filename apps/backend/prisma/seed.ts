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

  // 2. Create Tenants with static, persistent IDs to prevent session invalidations during re-seeding
  const tenant1 = await prisma.tenant.create({
    data: {
      id: 'tenant_cmsdg43ah0000linokqkv0k9b',
      name: 'PT ABC Logistics',
      status: 'active',
      agentLimit: 10,
      assetLimit: 150,
    },
  });

  const tenant2 = await prisma.tenant.create({
    data: {
      id: 'tenant_xyz_manufacturing',
      name: 'PT XYZ Manufacturing',
      status: 'active',
      agentLimit: 5,
      assetLimit: 50,
    },
  });

  console.log(`🏢 Created tenants: ${tenant1.name} (ID: ${tenant1.id}), ${tenant2.name} (ID: ${tenant2.id})`);

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

  // 8. Create Default MQTT Agents (Simplified connection-only parameters)
  const teltonikaAgent = await prisma.asset.create({
    data: {
      name: 'Teltonika Mesh Gateway 1',
      type: 'AGENT_MQTT_TELTONIKA',
      status: 'static',
      tenantId: tenant1.id,
      description: JSON.stringify({
        host: 'emqx',
        port: 1883,
        clientId: 'default-teltonika-mesh-gw',
        username: '',
        password: '',
        notes: 'Default Teltonika Wirepas Gateway Broker connection'
      })
    }
  });

  const genericAgent = await prisma.asset.create({
    data: {
      name: 'Generic Temperature Agent',
      type: 'AGENT_MQTT_GENERIC',
      status: 'static',
      tenantId: tenant1.id,
      description: JSON.stringify({
        host: 'emqx',
        port: 1883,
        clientId: 'default-generic-subscriber',
        username: '',
        password: '',
        notes: 'Generic MQTT Broker connection'
      })
    }
  });

  console.log(`🤖 Created default agents: ${teltonikaAgent.name}, ${genericAgent.name}`);

  // 9. Create Default Tags
  await prisma.tag.create({
    data: {
      id: 'node-439201',
      name: 'Mock Tag node-439201'
    }
  });

  // 10. Create Default Assets pre-configured with dynamic attributes
  const forklift = await prisma.asset.create({
    data: {
      name: 'Forklift Teltonika Test',
      type: 'FORKLIFT',
      status: 'static',
      tagId: 'node-439201',
      tenantId: tenant1.id,
      description: JSON.stringify({
        attributes: [
          { name: 'vehicleCode', dataType: 'String', unit: '', value: 'TF-01' },
          { name: 'operator', dataType: 'String', unit: '', value: 'Budi Santoso' },
          { 
            name: 'temperature', 
            dataType: 'Number', 
            unit: '°C', 
            value: '', 
            mqttAgentId: teltonikaAgent.id,
            mqttTopic: 'json-gw-event/received_data/#',
            mqttValuePath: '$.source_address',
            mqttDecodeFunction: 'decodeTelemetry'
          },
          { 
            name: 'humidity', 
            dataType: 'Number', 
            unit: '%', 
            value: '',
            mqttAgentId: teltonikaAgent.id,
            mqttTopic: 'json-gw-event/received_data/#',
            mqttValuePath: '$.source_address',
            mqttDecodeFunction: 'decodeTelemetry'
          },
          { name: 'battery', dataType: 'Number', unit: 'V', value: '' }
        ],
        notes: 'Mock Forklift Asset configured with dynamic Teltonika Mesh attributes'
      })
    }
  });

  const machine = await prisma.asset.create({
    data: {
      name: 'Machine Generic Test',
      type: 'MACHINE',
      status: 'static',
      tenantId: tenant1.id,
      description: JSON.stringify({
        attributes: [
          { name: 'machineCode', dataType: 'String', unit: '', value: 'CNC-M01' },
          { 
            name: 'temperature', 
            dataType: 'Number', 
            unit: '°C', 
            value: '',
            mqttAgentId: genericAgent.id,
            mqttTopic: 'factory/temperature',
            mqttValuePath: '$.val'
          },
          { name: 'status', dataType: 'String', unit: '', value: 'RUNNING' }
        ],
        notes: 'Mock Machine Asset configured with direct MQTT value mapping'
      })
    }
  });

  console.log(`📦 Created pre-configured ingestion assets: ${forklift.name}, ${machine.name}`);
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
