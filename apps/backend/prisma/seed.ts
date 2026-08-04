import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const defaultTeltonikaDecodeCode = `//====================================================
// Teltonika EYE Sensor Mesh Decoder
// Endpoint 11 & Endpoint 238
//====================================================

let evt = msg.payload.wirepas.packet_received_event;
let ep = evt.source_endpoint;

function b64ToBytes(b64){
    return Array.from(Buffer.from(b64,'base64'));
}

function u16(b,o){
    return b[o] | (b[o+1]<<8);
}

function s16(b,o){
    let v=u16(b,o);
    return (v & 0x8000)?v-0x10000:v;
}

function u32(b,o){
    return (b[o]) |
           (b[o+1]<<8) |
           (b[o+2]<<16) |
           (b[o+3]<<24 >>>0);
}

function s32(b,o){
    let v=u32(b,o);
    if(v>0x7fffffff) v-=0x100000000;
    return v;
}

let out = {
    gateway : evt.header.gw_id,
    node     : evt.source_address,
    endpoint : ep,
    hop      : evt.hop_count,
    network  : evt.network_address
};

if(ep == 11){
    let bytes = b64ToBytes(evt.payload);
    let i=0;
    while(i<bytes.length){
        let type=bytes[i++];
        let len =bytes[i++];
        switch(type){
            case 0x01:
                out.error_code=u16(bytes,i);
                break;
            case 0x02:
                out.temperature=Number((s32(bytes,i)/100).toFixed(2));
                break;
            case 0x03:
                out.humidity=Number((u32(bytes,i)/1024).toFixed(2));
                break;
            case 0x05:
                out.accel_x=s32(bytes,i);
                break;
            case 0x06:
                out.accel_y=s32(bytes,i);
                break;
            case 0x07:
                out.accel_z=s32(bytes,i);
                break;
            case 0x08:
                out.pitch=s16(bytes,i);
                break;
            case 0x09:
                out.roll=s16(bytes,i);
                break;
            case 0x0A:
                out.hall=(bytes[i]==1);
                break;
        }
        i += len;
    }
}
else if(ep==238){
    let meas = evt.payload_json.measurements;
    meas.forEach(m=>{
        if(m.voltage!==undefined)
            out.voltage=m.voltage;
        if(m.node_info){
            out.update_interval=m.node_info.update_s;
            out.motion=m.node_info.features.motion;
            out.is_static=m.node_info.features.is_static;
            out.node_mode=m.node_info.node_mode;
            out.node_class=m.node_info.node_class;
        }
        if(m.rss_sr_4byte_addr){
            m.rss_sr_4byte_addr.forEach(r=>{
                if(r.addr==248)
                    out.gateway_rssi=r.rssi;
                else
                    out["rssi_"+r.addr]=r.rssi;
            });
        }
    });
}

msg.payload=out;
return msg;`;

const defaultGenericAttributeCode = `//====================================================
// Generic MQTT Payload Parser
//====================================================

let val = msg.payload.val; // extract value from payload
msg.payload = val;
return msg;`;

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Clear existing data
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

  console.log(`👤 Created users: ${superadmin.name}, ${user1.name}`);

  // 4. Create Sites
  const site1 = await prisma.site.create({
    data: {
      name: 'Warehouse Cawang',
      address: 'Jl. H. R. Rasuna Said No.X, Jakarta Selatan',
      tenantId: tenant1.id,
    },
  });

  // 5. Create Zones
  const zone1 = await prisma.zone.create({
    data: {
      name: 'Storage Zone Alpha',
      floorPlanUrl: '/maps/cawang-storage-alpha.png',
      width: 50.0,
      height: 30.0,
      siteId: site1.id,
    },
  });

  // 6. Create Gateways
  const gateway1 = await prisma.gateway.create({
    data: {
      id: 'gw-7c:2b:e9:11:22:33',
      name: 'Tiny Gateway Main Rack',
      status: 'online',
      tenantId: tenant1.id,
    },
  });

  // 7. Create Anchors
  await prisma.anchor.create({
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

  // 8. Create Default Agents
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
        mqttAgentId: teltonikaAgent.id,
        mqttTopic: 'json-gw-event/received_data/#',
        mqttPublishTopic: '',
        mqttDecodeFunctionCode: defaultTeltonikaDecodeCode,
        attributes: [
          { name: 'vehicleCode', dataType: 'String', unit: '', value: 'TF-01' },
          { name: 'operator', dataType: 'String', unit: '', value: 'Budi Santoso' },
          { name: 'temperature', dataType: 'Number', unit: '°C', value: '' },
          { name: 'humidity', dataType: 'Number', unit: '%', value: '' },
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
            mqttDecodeFunctionCode: defaultGenericAttributeCode
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
