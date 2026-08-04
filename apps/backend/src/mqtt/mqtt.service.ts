import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mqtt from 'mqtt';
import * as vm from 'vm';
import { PrismaService } from '../prisma/prisma.service';
import { DecoderService, TelemetryPayload, StatusPayload } from '../decoders/decoder.service';
import { WebsocketGateway } from '../modules/websocket/websocket.gateway';

// Helper: Match MQTT topic patterns (supporting + and # wildcards)
function mqttTopicMatch(filter: string, topic: string): boolean {
  const filterParts = filter.split('/');
  const topicParts = topic.split('/');
  
  for (let i = 0; i < filterParts.length; i++) {
    if (filterParts[i] === '#') {
      return true;
    }
    if (filterParts[i] === '+') {
      if (i >= topicParts.length) return false;
      continue;
    }
    if (filterParts[i] !== topicParts[i]) {
      return false;
    }
  }
  return filterParts.length === topicParts.length;
}

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);
  private client: mqtt.MqttClient;
  private syncInterval: NodeJS.Timeout;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly decoder: DecoderService,
    private readonly websocketGateway: WebsocketGateway,
  ) {}

  onModuleInit() {
    this.connectBroker();
  }

  onModuleDestroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    if (this.client) {
      this.client.end();
      this.logger.log('Disconnected from MQTT Broker.');
    }
  }

  private connectBroker() {
    const brokerUrl = this.configService.get<string>('MQTT_BROKER_URL') || 'mqtt://localhost:1883';
    const username = this.configService.get<string>('MQTT_USERNAME');
    const password = this.configService.get<string>('MQTT_PASSWORD');

    this.logger.log(`Connecting to MQTT Broker at ${brokerUrl}...`);

    this.client = mqtt.connect(brokerUrl, {
      username,
      password,
      clean: true,
      reconnectPeriod: 5000,
    });

    this.client.on('connect', async () => {
      this.logger.log('Successfully connected to MQTT Broker!');
      
      // 1. Subscribe to standard Wirepas pattern
      const defaultPattern = 'wirepas/gateway/+/node/+/endpoint/+';
      this.client.subscribe(defaultPattern, (err) => {
        if (err) {
          this.logger.error(`Failed to subscribe to default topic: ${defaultPattern}`, err);
        } else {
          this.logger.log(`Subscribed to default topic: ${defaultPattern}`);
        }
      });

      // 2. Load dynamic topics from all assets in the DB and subscribe
      await this.subscribeToDynamicAgentTopics();
    });

    this.client.on('error', (err) => {
      this.logger.error('MQTT Broker connection error:', err);
    });

    this.client.on('message', async (topic, payload) => {
      await this.handleIncomingMessage(topic, payload.toString());
    });

    // Periodically sync topics to catch newly added/updated assets
    this.syncInterval = setInterval(() => {
      this.subscribeToDynamicAgentTopics();
    }, 30000);
  }

  async subscribeToDynamicAgentTopics() {
    if (!this.client || !this.client.connected) return;

    try {
      const assets = await this.prisma.asset.findMany({});

      for (const asset of assets) {
        try {
          if (!asset.description) continue;
          const parsed = JSON.parse(asset.description);

          // A. Subscribe to Asset-level topic
          if (parsed.mqttTopic && parsed.mqttAgentId) {
            this.logger.log(`Subscribing to dynamic Asset MQTT topic: ${parsed.mqttTopic} (Asset: ${asset.name})`);
            this.client.subscribe(parsed.mqttTopic);
          }

          // B. Subscribe to Attribute-level topics
          if (parsed.attributes && Array.isArray(parsed.attributes)) {
            for (const attr of parsed.attributes) {
              if (attr.mqttTopic && attr.mqttAgentId) {
                this.logger.log(
                  `Subscribing to dynamic Asset Attribute MQTT topic: ${attr.mqttTopic} (Asset: ${asset.name}, Attribute: ${attr.name})`,
                );
                this.client.subscribe(attr.mqttTopic);
              }
            }
          }
        } catch (e) {
          // Skip if description is not a valid JSON string
        }
      }
    } catch (e) {
      this.logger.error('Failed to sync dynamic asset MQTT subscriptions:', e);
    }
  }

  private async runSandboxedScript(code: string, topic: string, rawPayload: string): Promise<any> {
    try {
      let payload: any = rawPayload;
      try {
        payload = JSON.parse(rawPayload);
      } catch (e) {
        // Keep raw payload if not JSON
      }

      const sandbox = {
        msg: {
          topic,
          payload
        },
        Buffer: Buffer,
        console: {
          log: (...args: any[]) => this.logger.log(`[JS VM Log]: ${args.join(' ')}`),
          error: (...args: any[]) => this.logger.error(`[JS VM Error]: ${args.join(' ')}`),
        }
      };

      vm.createContext(sandbox);

      // Wrap code in an IIFE so "return" is syntactically correct at top-level
      const wrappedCode = `(function() {
        ${code}
      })()`;

      const script = new vm.Script(wrappedCode);
      const result = script.runInContext(sandbox, { timeout: 1000 });

      return result || sandbox.msg;
    } catch (err) {
      this.logger.error('Failed to execute sandboxed JS function:', err);
      return null;
    }
  }

  private async handleIncomingMessage(topic: string, rawPayload: string) {
    // 1. Check for standard Wirepas topic format
    const standardRegex = /^wirepas\/gateway\/([^/]+)\/node\/([^/]+)\/endpoint\/(\d+)$/;
    const standardMatch = topic.match(standardRegex);

    if (standardMatch) {
      const [, gatewayId, nodeId, endpointStr] = standardMatch;
      const endpointId = parseInt(endpointStr, 10);
      const tagId = `node-${nodeId}`;

      // Ingest standard Wirepas
      await this.ingestWirepasMessage(gatewayId, tagId, endpointId, rawPayload);
      return;
    }

    // 2. Check dynamic assets in the database
    try {
      const assets = await this.prisma.asset.findMany({});

      for (const asset of assets) {
        if (!asset.description) continue;
        const parsed = JSON.parse(asset.description);

        // A. Asset-Level Ingestion
        if (parsed.mqttTopic && parsed.mqttAgentId && mqttTopicMatch(parsed.mqttTopic, topic)) {
          if (parsed.mqttDecodeFunctionCode) {
            const outMsg = await this.runSandboxedScript(parsed.mqttDecodeFunctionCode, topic, rawPayload);

            if (outMsg && outMsg.payload) {
              const decoded = outMsg.payload;
              const sourceNodeId = decoded.node || decoded.source_address;

              if (sourceNodeId) {
                // Multi-node routing: Find target node asset in DB
                const targetTagId = `node-${sourceNodeId}`;
                const targetAsset = assets.find((a) => a.tagId === targetTagId);

                if (targetAsset && targetAsset.description) {
                  const targetParsed = JSON.parse(targetAsset.description);
                  if (targetParsed.attributes && Array.isArray(targetParsed.attributes)) {
                    let targetUpdated = false;
                    const updatedAttrs = targetParsed.attributes.map((attr: any) => {
                      if (decoded[attr.name] !== undefined) {
                        targetUpdated = true;
                        return { ...attr, value: decoded[attr.name] };
                      }
                      return attr;
                    });

                    if (targetUpdated) {
                      await this.prisma.asset.update({
                        where: { id: targetAsset.id },
                        data: {
                          description: JSON.stringify({
                            ...targetParsed,
                            attributes: updatedAttrs,
                          }),
                        },
                      });

                      await this.syncLegacyTag(targetAsset, decoded);

                      const updatedTarget = await this.prisma.asset.findUnique({
                        where: { id: targetAsset.id },
                        include: { tag: true },
                      });
                      if (updatedTarget) {
                        this.websocketGateway.sendToTenant(targetAsset.tenantId, 'assetUpdate', updatedTarget);
                      }
                    }
                  }
                }
              } else {
                // Single-node routing: Update current asset directly
                if (parsed.attributes && Array.isArray(parsed.attributes)) {
                  let assetUpdated = false;
                  const updatedAttrs = parsed.attributes.map((attr: any) => {
                    if (decoded[attr.name] !== undefined) {
                      assetUpdated = true;
                      return { ...attr, value: decoded[attr.name] };
                    }
                    return attr;
                  });

                  if (assetUpdated) {
                    await this.prisma.asset.update({
                      where: { id: asset.id },
                      data: {
                        description: JSON.stringify({
                          ...parsed,
                          attributes: updatedAttrs,
                        }),
                      },
                    });

                    await this.syncLegacyTag(asset, decoded);

                    const updatedCurrent = await this.prisma.asset.findUnique({
                      where: { id: asset.id },
                      include: { tag: true },
                    });
                    if (updatedCurrent) {
                      this.websocketGateway.sendToTenant(asset.tenantId, 'assetUpdate', updatedCurrent);
                    }
                  }
                }
              }
            }
          }
        }

        // B. Attribute-Level Ingestion
        if (parsed.attributes && Array.isArray(parsed.attributes)) {
          let updatedAttributes = [...parsed.attributes];
          let hasUpdates = false;
          const decodedObj: any = {};

          for (let i = 0; i < updatedAttributes.length; i++) {
            const attr = updatedAttributes[i];

            if (attr.mqttTopic && attr.mqttAgentId && mqttTopicMatch(attr.mqttTopic, topic)) {
              if (attr.mqttDecodeFunctionCode) {
                const outMsg = await this.runSandboxedScript(attr.mqttDecodeFunctionCode, topic, rawPayload);
                if (outMsg && outMsg.payload !== undefined) {
                  const formattedValue = this.castValue(outMsg.payload, attr.dataType);
                  updatedAttributes[i] = { ...attr, value: formattedValue };
                  decodedObj[attr.name] = formattedValue;
                  hasUpdates = true;
                }
              }
            }
          }

          if (hasUpdates) {
            await this.prisma.asset.update({
              where: { id: asset.id },
              data: {
                description: JSON.stringify({
                  ...parsed,
                  attributes: updatedAttributes,
                }),
              },
            });

            await this.syncLegacyTag(asset, decodedObj);

            const updatedAsset = await this.prisma.asset.findUnique({
              where: { id: asset.id },
              include: { tag: true },
            });
            if (updatedAsset) {
              this.websocketGateway.sendToTenant(asset.tenantId, 'assetUpdate', updatedAsset);
            }
          }
        }
      }
    } catch (e) {
      this.logger.error(`Failed to process message on topic: ${topic}`, e);
    }
  }

  private async ingestWirepasMessage(gatewayId: string, tagId: string, endpointId: number, rawPayload: string) {
    const gateway = await this.prisma.gateway.findUnique({
      where: { id: gatewayId },
    });

    if (!gateway) {
      this.logger.warn(`Rejected message: Gateway "${gatewayId}" is not registered.`);
      return;
    }

    const tenantId = gateway.tenantId;

    try {
      const parsedJson = JSON.parse(rawPayload);

      if (endpointId === 11) {
        const telemetry = this.decoder.decodeTelemetry(parsedJson);
        await this.processTelemetry(tenantId, tagId, telemetry);
      } else if (endpointId === 238) {
        const status = this.decoder.decodeStatus(parsedJson);
        await this.processStatus(tenantId, tagId, status);
      }
    } catch (err) {
      this.logger.error(`Failed to parse payload for standard Wirepas topic:`, err);
    }
  }

  private castValue(val: any, dataType: string): any {
    if (dataType === 'Number') return parseFloat(String(val));
    if (dataType === 'Integer') return parseInt(String(val), 10);
    if (dataType === 'Boolean') return String(val).toLowerCase() === 'true' || val === true || val === 1;
    if (dataType === 'String' || dataType === 'Text') return String(val);
    if (dataType === 'JSON') {
      try {
        return typeof val === 'string' ? JSON.parse(val) : val;
      } catch (e) {
        return val;
      }
    }
    return val;
  }

  private async syncLegacyTag(asset: any, decoded: any) {
    let tagId = asset.tagId;
    if (!tagId) {
      tagId = `tag-asset-${asset.id}`;
      
      await this.prisma.tag.create({
        data: {
          id: tagId,
          name: `Tag for ${asset.name}`
        }
      });

      await this.prisma.asset.update({
        where: { id: asset.id },
        data: { tagId }
      });
    }

    const updateData: any = { lastSeen: new Date() };
    if (decoded.temperature !== undefined) updateData.temperature = parseFloat(String(decoded.temperature));
    if (decoded.humidity !== undefined) updateData.humidity = parseFloat(String(decoded.humidity));
    if (decoded.voltage !== undefined) updateData.battery = parseFloat(String(decoded.voltage));
    if (decoded.battery !== undefined) updateData.battery = parseFloat(String(decoded.battery));
    if (decoded.rssi !== undefined) updateData.rssi = parseInt(String(decoded.rssi), 10);

    const tag = await this.prisma.tag.upsert({
      where: { id: tagId },
      update: updateData,
      create: {
        id: tagId,
        name: `Tag for ${asset.name}`,
        ...updateData
      }
    });

    this.websocketGateway.sendToTenant(asset.tenantId, 'tagUpdate', tag);

    // Save historical trend to TimescaleDB
    await this.prisma.telemetry.create({
      data: {
        timestamp: new Date(),
        tagId,
        temperature: decoded.temperature !== undefined ? parseFloat(String(decoded.temperature)) : null,
        humidity: decoded.humidity !== undefined ? parseFloat(String(decoded.humidity)) : null,
        battery: decoded.voltage !== undefined ? parseFloat(String(decoded.voltage)) : (decoded.battery !== undefined ? parseFloat(String(decoded.battery)) : null),
        rssi: decoded.rssi !== undefined ? parseInt(String(decoded.rssi), 10) : null,
      }
    });
  }

  private async processTelemetry(tenantId: string, tagId: string, telemetry: TelemetryPayload) {
    const { temperature, humidity, accel_x = 0, accel_y = 0, accel_z = 1, pitch = 0, roll = 0, hall_sensor } = telemetry;

    const tag = await this.prisma.tag.upsert({
      where: { id: tagId },
      update: {
        temperature,
        humidity,
        lastSeen: new Date(),
      },
      create: {
        id: tagId,
        name: `Tag ${tagId}`,
        temperature,
        humidity,
        lastSeen: new Date(),
      },
    });

    this.websocketGateway.sendToTenant(tenantId, 'tagUpdate', tag);

    const asset = await this.prisma.asset.findUnique({
      where: { tagId: tag.id },
    });

    if (asset) {
      const mockStatus: StatusPayload = { motion: Math.abs(accel_x) > 0.1 || Math.abs(accel_y) > 0.1 };
      const newStatus = this.decoder.evaluateAssetStatus(telemetry, mockStatus);

      const updatedAsset = await this.prisma.asset.update({
        where: { id: asset.id },
        data: { status: newStatus },
        include: {
          tag: true,
        },
      });

      this.websocketGateway.sendToTenant(tenantId, 'assetUpdate', updatedAsset);

      if (newStatus === 'fall_detected') {
        await this.createAlert(tenantId, asset.id, 'fall_detected', `Benturan keras (terjatuh) terdeteksi pada aset "${asset.name}"!`);
      } else if (newStatus === 'tilt_warning') {
        await this.createAlert(tenantId, asset.id, 'tilt_warning', `Aset "${asset.name}" mengalami kemiringan berbahaya (Pitch: ${pitch}°, Roll: ${roll}°).`);
      }
    }

    const rawTelemetry = await this.prisma.telemetry.create({
      data: {
        timestamp: new Date(),
        tagId,
        temperature,
        humidity,
        battery: tag.battery,
        rssi: tag.rssi,
        accelX: accel_x,
        accelY: accel_y,
        accelZ: accel_z,
        pitch,
        roll,
        hall: hall_sensor,
      },
    });

    this.websocketGateway.sendToTenant(tenantId, 'telemetryNew', rawTelemetry);
  }

  private async processStatus(tenantId: string, tagId: string, status: StatusPayload) {
    const { battery_voltage, rssi, motion, hop_count } = status;

    const tag = await this.prisma.tag.upsert({
      where: { id: tagId },
      update: {
        battery: battery_voltage,
        rssi,
        lastSeen: new Date(),
      },
      create: {
        id: tagId,
        name: `Tag ${tagId}`,
        battery: battery_voltage,
        rssi,
        lastSeen: new Date(),
      },
    });

    this.websocketGateway.sendToTenant(tenantId, 'tagUpdate', tag);

    const asset = await this.prisma.asset.findUnique({
      where: { tagId: tag.id },
    });

    if (asset) {
      const dummyTelemetry: TelemetryPayload = { accel_z: 1.0, pitch: 0, roll: 0 };
      const newStatus = this.decoder.evaluateAssetStatus(dummyTelemetry, status);

      const updatedAsset = await this.prisma.asset.update({
        where: { id: asset.id },
        data: { status: newStatus },
        include: {
          tag: true,
        },
      });

      this.websocketGateway.sendToTenant(tenantId, 'assetUpdate', updatedAsset);

      if (battery_voltage && battery_voltage < 2.8) {
        await this.createAlert(
          tenantId,
          asset.id,
          'low_battery',
          `Baterai sensor pada aset "${asset.name}" melemah (${battery_voltage}V)!`,
        );
      }
    }
  }

  private async createAlert(tenantId: string, assetId: string, type: string, message: string) {
    const existingAlert = await this.prisma.alert.findFirst({
      where: {
        assetId,
        type,
        isResolved: false,
      },
    });

    if (existingAlert) {
      return;
    }

    const alert = await this.prisma.alert.create({
      data: {
        type,
        message,
        tenantId,
        assetId,
      },
      include: {
        asset: true,
      },
    });

    this.websocketGateway.sendToTenant(tenantId, 'alertNew', alert);
    this.logger.warn(`⚠️ ALERT CREATED [${type}]: ${message} (Alert ID: ${alert.id})`);
  }
}
