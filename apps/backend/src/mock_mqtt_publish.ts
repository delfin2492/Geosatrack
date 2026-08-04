import { PrismaClient } from '@prisma/client';
import * as mqtt from 'mqtt';

const prisma = new PrismaClient();

async function run() {
  console.log('🧪 Starting MQTT Verification Script (Sandboxed VM Decoders)...');

  const forklift = await prisma.asset.findFirst({
    where: { name: 'Forklift Teltonika Test' }
  });
  if (!forklift) throw new Error('Forklift Teltonika Test not found');
  console.log(`📦 Found Forklift Asset: ${forklift.name} (ID: ${forklift.id})`);

  const machine = await prisma.asset.findFirst({
    where: { name: 'Machine Generic Test' }
  });
  if (!machine) throw new Error('Machine Generic Test not found');
  console.log(`🏭 Found Machine Asset: ${machine.name} (ID: ${machine.id})`);

  // Connect using internal container hostname 'emqx'
  const client = mqtt.connect('mqtt://emqx:1883');
  client.on('connect', () => {
    console.log('📡 Connected to EMQX Broker. Publishing mock payloads...');

    // A. Teltonika Mesh Gateway payload (Asset-level Ingestion)
    const teltonikaTopic = 'json-gw-event/received_data/BTGW-0000f09e9e1515b8/sink0/12345678/11/11';
    
    // In Teltonika Wirepas mesh packet, payload contains temperature = 2420 (24.2 C) and humidity = 52736 (51.5 %)
    // Byte sequence: 02 04 74 09 00 00 03 04 00 ce 00 00
    // Buffer from base64: 'AgR0CQAAAwQAzgAAAA=='
    
    const teltonikaPayload = JSON.stringify({
      wirepas: {
        packet_received_event: {
          source_endpoint: 11,
          source_address: 439201,
          network_address: 12345678,
          hop_count: 3,
          header: {
            gw_id: 'BTGW-0000f09e9e1515b8'
          },
          payload: 'AgR0CQAAAwQAzgAAAA=='
        }
      }
    });

    client.publish(teltonikaTopic, teltonikaPayload, () => {
      console.log(`Published Teltonika Mesh payload to "${teltonikaTopic}"`);
    });

    // B. Generic MQTT payload (Attribute-level Ingestion)
    const genericTopic = 'factory/temperature';
    const genericPayload = JSON.stringify({
      val: 27.4
    });
    client.publish(genericTopic, genericPayload, () => {
      console.log(`Published Generic MQTT payload to "${genericTopic}"`);
    });

    // Close MQTT client after 2 seconds
    setTimeout(async () => {
      client.end();
      console.log('🔌 Disconnected from MQTT Broker.');

      // Verify outputs in DB
      const updatedForklift = await prisma.asset.findUnique({
        where: { id: forklift.id }
      });
      console.log('\n--- VERIFICATION RESULTS ---');
      console.log('Updated Forklift Description/Attributes (Asset-Level JS parsed):');
      try {
        console.log(JSON.stringify(JSON.parse(updatedForklift?.description || '{}'), null, 2));
      } catch (e) {
        console.log(updatedForklift?.description);
      }

      const updatedMachine = await prisma.asset.findUnique({
        where: { id: machine.id }
      });
      console.log('\nUpdated Machine Description/Attributes (Attribute-Level JS parsed):');
      try {
        console.log(JSON.stringify(JSON.parse(updatedMachine?.description || '{}'), null, 2));
      } catch (e) {
        console.log(updatedMachine?.description);
      }

      await prisma.$disconnect();
      process.exit(0);
    }, 2000);
  });
}

run().catch((e) => {
  console.error('❌ Error during MQTT verification:', e);
  process.exit(1);
});
