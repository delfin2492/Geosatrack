const mqtt = require('mqtt');

// Connect to EMQX Broker
const client = mqtt.connect('mqtt://localhost:1883');

client.on('connect', () => {
  console.log('📡 Connected to EMQX Broker!');

  // Wirepas standard telemetry topic for Mesh Troli (Node 1161675004)
  const topic = 'wirepas/gateway/gw-7c:2b:e9:11:22:33/node/1161675004/endpoint/11';
  
  // Real signal values from database Anchors:
  // - Anchor B (tagId 9023206 / cmsfttz9p00016nnk8u2e5j52) -> -55 dBm (Strong)
  // - Anchor A (tagId 9023205 / cmsfrukpj0001gym96fvv4tnr) -> -82 dBm (Weak)
  const payload = JSON.stringify({
    temperature: 26.5,
    humidity: 55.2,
    accel_x: 0.05,
    accel_y: 0.08,
    accel_z: 0.98,
    pitch: 2,
    roll: 3,
    // Real RSSI anchors signals payload:
    signals: [
      { anchorId: 'cmsfttz9p00016nnk8u2e5j52', anchorName: 'Anchor B', rssi: -55 },
      { anchorId: 'cmsfrukpj0001gym96fvv4tnr', anchorName: 'Anchor A', rssi: -82 }
    ]
  });

  console.log(`Publishing real RSSI telemetry to topic: "${topic}"`);
  console.log('Payload:', payload);

  client.publish(topic, payload, () => {
    console.log('✓ Successfully published real RSSI signals telemetry.');
    client.end();
  });
});
