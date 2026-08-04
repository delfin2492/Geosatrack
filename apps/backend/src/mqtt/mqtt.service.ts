import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mqtt from 'mqtt';
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

// Helper: Extract JSON value by dotted path (e.g. "$.source_address" or "battery.voltage")
function getValueByJsonPath(obj: any, path: string): any {
  if (!path || path === '$') return obj;
  const cleanedPath = path.replace(/^\$\./, '').split('.');
  let current = obj;
  for (const key of cleanedPath) {
    if (current === null || current === undefined) return undefined;
    current = current[key];
  }
  return current;
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

    // 2. Check dynamic assets in the database to see which ones subscribe to this topic
    try {
      const assets = await this.prisma.asset.findMany({});

      for (const asset of assets) {
        if (!asset.description) continue;
        const parsed = JSON.parse(asset.description);

        if (parsed.attributes && Array.isArray(parsed.attributes)) {
          let updatedAttributes = [...parsed.attributes];
          let hasUpdates = false;

          for (let i = 0; i < updatedAttributes.length; i++) {
            const attr = updatedAttributes[i];

            if (attr.mqttTopic && attr.mqttAgentId && mqttTopicMatch(attr.mqttTopic, topic)) {
              const agent = assets.find((a) => a.id === attr.mqttAgentId);
              const isTeltonika = agent?.type === 'AGENT_MQTT_TELTONIKA';

              if (isTeltonika) {
                const value = await this.processTeltonikaAttributeMessage(asset, attr, topic, rawPayload);
                if (value !== undefined) {
                  updatedAttributes[i] = { ...attr, value };
                  hasUpdates = true;
                }
              } else {
                const value = await this.processDirectAttributeMessage(asset, attr, rawPayload);
                if (value !== undefined) {
                  updatedAttributes[i] = { ...attr, value };
                  hasUpdates = true;
                }
              }
            }
          }

          if (hasUpdates) {
            const updatedDescription = JSON.stringify({
              ...parsed,
              attributes: updatedAttributes
            });

            await this.prisma.asset.update({
              where: { id: asset.id },
              data: { description: updatedDescription }
            });

            const updatedAsset = await this.prisma.asset.findUnique({
              where: { id: asset.id },
              include: { tag: true }
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

  private async processTeltonikaAttributeMessage(asset: any, attr: any, topic: string, rawPayload: string): Promise<any> {
    try {
      const parsedJson = JSON.parse(rawPayload);
      
      const nodeId = getValueByJsonPath(parsedJson, attr.mqttValuePath || '$.source_address') || parsedJson.source_address;
      if (!nodeId) {
        this.logger.warn(`Rejected Teltonika message: Node ID not found at path "${attr.mqttValuePath || '$.source_address'}"`);
        return undefined;
      }

      const tagId = `node-${nodeId}`;
      const topicParts = topic.split('/');
      const endpointStr = topicParts[topicParts.length - 2] || '11';
      const endpointId = parseInt(endpointStr, 10) || 11;

      if (endpointId === 11) {
        const telemetry = this.decoder.decodeTelemetry(parsedJson);
        await this.processTelemetry(asset.tenantId, tagId, telemetry);

        if (asset.tagId === tagId) {
          if (attr.name === 'temperature' || attr.name === 'temp') return telemetry.temperature;
          if (attr.name === 'humidity' || attr.name === 'hum') return telemetry.humidity;
        }
      } else if (endpointId === 238) {
        const status = this.decoder.decodeStatus(parsedJson);
        await this.processStatus(asset.tenantId, tagId, status);

        if (asset.tagId === tagId) {
          if (attr.name === 'battery') return status.battery_voltage;
          if (attr.name === 'rssi') return status.rssi;
        }
      }
    } catch (err) {
      this.logger.error('Failed to parse Teltonika payload:', err);
    }
    return undefined;
  }

  private async processDirectAttributeMessage(asset: any, attr: any, rawPayload: string): Promise<any> {
    try {
      const parsedJson = JSON.parse(rawPayload);
      const val = getValueByJsonPath(parsedJson, attr.mqttValuePath || '$.val') ?? parsedJson.val;

      if (val === undefined || val === null) {
        this.logger.warn(`Rejected Generic MQTT message: Value not found at path "${attr.mqttValuePath || '$.val'}"`);
        return undefined;
      }

      // Convert value according to dataType
      let formattedValue: any = val;
      if (attr.dataType === 'Number') formattedValue = parseFloat(String(val));
      else if (attr.dataType === 'Integer') formattedValue = parseInt(String(val), 10);
      else if (attr.dataType === 'Boolean') formattedValue = String(val).toLowerCase() === 'true' || val === true || val === 1;
      else if (attr.dataType === 'String' || attr.dataType === 'Text') formattedValue = String(val);
      else if (attr.dataType === 'JSON') {
        try {
          formattedValue = typeof val === 'string' ? JSON.parse(val) : val;
        } catch (e) {
          formattedValue = val;
        }
      }

      // Ensure asset has a linked tag record to preserve UI backwards-compatibility
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
      const valNum = parseFloat(String(formattedValue));
      
      if (attr.name === 'temperature') updateData.temperature = valNum;
      else if (attr.name === 'humidity') updateData.humidity = valNum;
      else if (attr.name === 'battery') updateData.battery = valNum;
      else if (attr.name === 'rssi') updateData.rssi = parseInt(String(formattedValue), 10);

      // Save live attributes
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

      // Write historical trend to TimescaleDB
      await this.prisma.telemetry.create({
        data: {
          timestamp: new Date(),
          tagId,
          temperature: attr.name === 'temperature' ? valNum : null,
          humidity: attr.name === 'humidity' ? valNum : null,
          battery: attr.name === 'battery' ? valNum : null,
          rssi: attr.name === 'rssi' ? parseInt(String(formattedValue), 10) : null,
        }
      });

      return formattedValue;
    } catch (e) {
      this.logger.error('Failed to parse Generic MQTT message payload:', e);
    }
    return undefined;
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
