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

      // 2. Load dynamic topics from database
      await this.subscribeToDynamicAgentTopics();
    });

    this.client.on('error', (err) => {
      this.logger.error('MQTT Broker connection error:', err);
    });

    this.client.on('message', async (topic, payload) => {
      await this.handleIncomingMessage(topic, payload.toString());
    });

    // Periodically sync topics to catch newly added dynamic agents
    this.syncInterval = setInterval(() => {
      this.subscribeToDynamicAgentTopics();
    }, 30000);
  }

  async subscribeToDynamicAgentTopics() {
    if (!this.client || !this.client.connected) return;

    try {
      const agents = await this.prisma.asset.findMany({
        where: {
          type: {
            in: ['AGENT_MQTT_TELTONIKA', 'AGENT_MQTT_GENERIC']
          }
        }
      });

      for (const agent of agents) {
        try {
          if (!agent.description) continue;
          const config = JSON.parse(agent.description);

          if (agent.type === 'AGENT_MQTT_TELTONIKA' && config.topicPrefix) {
            this.logger.log(`Subscribing to dynamic Teltonika topic: ${config.topicPrefix}`);
            this.client.subscribe(config.topicPrefix);
          } else if (agent.type === 'AGENT_MQTT_GENERIC' && config.topic) {
            this.logger.log(`Subscribing to dynamic Generic topic: ${config.topic}`);
            this.client.subscribe(config.topic);
          }
        } catch (e) {
          this.logger.error(`Failed to parse config for agent ID: ${agent.id}`, e);
        }
      }
    } catch (e) {
      this.logger.error('Failed to sync dynamic agent subscriptions:', e);
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

    // 2. Check dynamic agents in the database
    try {
      const agents = await this.prisma.asset.findMany({
        where: {
          type: {
            in: ['AGENT_MQTT_TELTONIKA', 'AGENT_MQTT_GENERIC']
          }
        }
      });

      for (const agent of agents) {
        if (!agent.description) continue;
        const config = JSON.parse(agent.description);

        if (agent.type === 'AGENT_MQTT_TELTONIKA' && config.topicPrefix) {
          if (mqttTopicMatch(config.topicPrefix, topic)) {
            await this.handleTeltonikaMessage(agent, config, topic, rawPayload);
            return;
          }
        } else if (agent.type === 'AGENT_MQTT_GENERIC' && config.topic) {
          if (mqttTopicMatch(config.topic, topic)) {
            await this.handleGenericMessage(agent, config, rawPayload);
            return;
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

  private async handleTeltonikaMessage(agent: any, config: any, topic: string, rawPayload: string) {
    try {
      const parsedJson = JSON.parse(rawPayload);
      
      // Extract Node ID using nodeIdPath
      const nodeId = getValueByJsonPath(parsedJson, config.nodeIdPath || '$.source_address') || parsedJson.source_address;
      if (!nodeId) {
        this.logger.warn(`Rejected Teltonika message: Node ID not found at path "${config.nodeIdPath || '$.source_address'}"`);
        return;
      }

      const tagId = `node-${nodeId}`;
      const topicParts = topic.split('/');
      const endpointStr = topicParts[topicParts.length - 2] || '11';
      const endpointId = parseInt(endpointStr, 10) || 11;

      if (endpointId === 11) {
        const telemetry = this.decoder.decodeTelemetry(parsedJson);
        await this.processTelemetry(agent.tenantId, tagId, telemetry);
      } else if (endpointId === 238) {
        const status = this.decoder.decodeStatus(parsedJson);
        await this.processStatus(agent.tenantId, tagId, status);
      }
    } catch (err) {
      this.logger.error('Failed to parse Teltonika payload:', err);
    }
  }

  private async handleGenericMessage(agent: any, config: any, rawPayload: string) {
    try {
      const parsedJson = JSON.parse(rawPayload);
      const val = getValueByJsonPath(parsedJson, config.valuePath || '$.val') ?? parsedJson.val;

      if (val === undefined || val === null) {
        this.logger.warn(`Rejected Generic MQTT message: Value not found at path "${config.valuePath || '$.val'}"`);
        return;
      }

      const targetAssetId = config.targetAssetId;
      const attributeKey = config.attributeKey || 'temperature';

      if (!targetAssetId) return;

      const targetAsset = await this.prisma.asset.findUnique({
        where: { id: targetAssetId },
        include: { tag: true }
      });

      if (!targetAsset) return;

      // Ensure target asset has a linked tag record
      let tagId = targetAsset.tagId;
      if (!tagId) {
        tagId = `tag-asset-${targetAsset.id}`;
        // Create the tag record first to satisfy foreign key constraints
        await this.prisma.tag.create({
          data: {
            id: tagId,
            name: `Tag for ${targetAsset.name}`
          }
        });

        await this.prisma.asset.update({
          where: { id: targetAsset.id },
          data: { tagId }
        });
      }

      const updateData: any = { lastSeen: new Date() };
      const valNum = parseFloat(String(val));
      
      if (attributeKey === 'temperature') updateData.temperature = valNum;
      else if (attributeKey === 'humidity') updateData.humidity = valNum;
      else if (attributeKey === 'battery') updateData.battery = valNum;
      else if (attributeKey === 'rssi') updateData.rssi = parseInt(String(val), 10);

      // Save live attributes
      const tag = await this.prisma.tag.upsert({
        where: { id: tagId },
        update: updateData,
        create: {
          id: tagId,
          name: `Tag for ${targetAsset.name}`,
          ...updateData
        }
      });

      this.websocketGateway.sendToTenant(agent.tenantId, 'tagUpdate', tag);

      const updatedAsset = await this.prisma.asset.findUnique({
        where: { id: targetAsset.id },
        include: { tag: true }
      });

      if (updatedAsset) {
        this.websocketGateway.sendToTenant(agent.tenantId, 'assetUpdate', updatedAsset);
      }

      // Write historical trend to TimescaleDB
      const rawTelemetry = await this.prisma.telemetry.create({
        data: {
          timestamp: new Date(),
          tagId,
          temperature: attributeKey === 'temperature' ? valNum : null,
          humidity: attributeKey === 'humidity' ? valNum : null,
          battery: attributeKey === 'battery' ? valNum : null,
          rssi: attributeKey === 'rssi' ? parseInt(String(val), 10) : null,
        }
      });

      this.websocketGateway.sendToTenant(agent.tenantId, 'telemetryNew', rawTelemetry);

    } catch (e) {
      this.logger.error('Failed to parse Generic MQTT message payload:', e);
    }
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
