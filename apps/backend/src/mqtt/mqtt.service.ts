import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mqtt from 'mqtt';
import { PrismaService } from '../prisma/prisma.service';
import { DecoderService, TelemetryPayload, StatusPayload } from '../decoders/decoder.service';

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);
  private client: mqtt.MqttClient;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly decoder: DecoderService,
  ) {}

  onModuleInit() {
    this.connectBroker();
  }

  onModuleDestroy() {
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
      reconnectPeriod: 5000, // reconnect every 5s on failure
    });

    this.client.on('connect', () => {
      this.logger.log('Successfully connected to MQTT Broker!');
      // Subscribe to Wirepas topics
      // Format: wirepas/gateway/<gateway_id>/node/<node_id>/endpoint/<endpoint_id>
      const topicPattern = 'wirepas/gateway/+/node/+/endpoint/+';
      this.client.subscribe(topicPattern, (err) => {
        if (err) {
          this.logger.error(`Failed to subscribe to topic pattern: ${topicPattern}`, err);
        } else {
          this.logger.log(`Subscribed to topic pattern: ${topicPattern}`);
        }
      });
    });

    this.client.on('error', (err) => {
      this.logger.error('MQTT Broker connection error:', err);
    });

    this.client.on('message', async (topic, payload) => {
      await this.handleIncomingMessage(topic, payload.toString());
    });
  }

  private async handleIncomingMessage(topic: string, rawPayload: string) {
    // Regex to match: wirepas/gateway/<gateway_id>/node/<node_id>/endpoint/<endpoint_id>
    const topicRegex = /^wirepas\/gateway\/([^/]+)\/node\/([^/]+)\/endpoint\/(\d+)$/;
    const match = topic.match(topicRegex);

    if (!match) {
      this.logger.warn(`Received message on unsupported topic structure: ${topic}`);
      return;
    }

    const [, gatewayId, nodeId, endpointStr] = match;
    const endpointId = parseInt(endpointStr, 10);
    const tagId = `node-${nodeId}`;

    // 1. Verify Gateway & Get Tenant (Multi-Tenant Isolation)
    const gateway = await this.prisma.gateway.findUnique({
      where: { id: gatewayId },
    });

    if (!gateway) {
      this.logger.warn(
        `Rejected message: Gateway "${gatewayId}" is not registered. Ingestion blocked.`,
      );
      return;
    }

    const tenantId = gateway.tenantId;

    try {
      const parsedJson = JSON.parse(rawPayload);

      if (endpointId === 11) {
        // --- ENDPOINT 11: TELEMETRY SENSOR ---
        const telemetry = this.decoder.decodeTelemetry(parsedJson);
        await this.processTelemetry(tenantId, tagId, telemetry);
      } else if (endpointId === 238) {
        // --- ENDPOINT 238: NODE STATUS ---
        const status = this.decoder.decodeStatus(parsedJson);
        await this.processStatus(tenantId, tagId, status);
      } else {
        this.logger.warn(`Received message for unsupported endpoint ID: ${endpointId}`);
      }
    } catch (err) {
      this.logger.error(`Failed to parse payload for topic "${topic}":`, err);
    }
  }

  private async processTelemetry(tenantId: string, tagId: string, telemetry: TelemetryPayload) {
    const { temperature, humidity, accel_x = 0, accel_y = 0, accel_z = 1, pitch = 0, roll = 0, hall_sensor } = telemetry;

    // 1. Check or Upsert the Tag
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

    // 2. Fetch the Asset linked to this Tag
    const asset = await this.prisma.asset.findUnique({
      where: { tagId: tag.id },
    });

    if (asset) {
      // Create mock status info to evaluate state
      const mockStatus: StatusPayload = { motion: Math.abs(accel_x) > 0.1 || Math.abs(accel_y) > 0.1 };
      const newStatus = this.decoder.evaluateAssetStatus(telemetry, mockStatus);

      // Update Asset Status
      await this.prisma.asset.update({
        where: { id: asset.id },
        data: { status: newStatus },
      });

      // Handle Alerting if anomaly is detected
      if (newStatus === 'fall_detected') {
        await this.createAlert(tenantId, asset.id, 'fall_detected', `Benturan keras (terjatuh) terdeteksi pada aset "${asset.name}"!`);
      } else if (newStatus === 'tilt_warning') {
        await this.createAlert(tenantId, asset.id, 'tilt_warning', `Aset "${asset.name}" mengalami kemiringan berbahaya (Pitch: ${pitch}°, Roll: ${roll}°).`);
      }
    }

    // 3. Write raw telemetry to TimescaleDB
    await this.prisma.telemetry.create({
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
  }

  private async processStatus(tenantId: string, tagId: string, status: StatusPayload) {
    const { battery_voltage, rssi, motion, hop_count } = status;

    // 1. Check or Upsert the Tag
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

    // 2. Fetch the Asset linked to this Tag
    const asset = await this.prisma.asset.findUnique({
      where: { tagId: tag.id },
    });

    if (asset) {
      // Evaluate asset state using default gravity telemetry
      const dummyTelemetry: TelemetryPayload = { accel_z: 1.0, pitch: 0, roll: 0 };
      const newStatus = this.decoder.evaluateAssetStatus(dummyTelemetry, status);

      await this.prisma.asset.update({
        where: { id: asset.id },
        data: { status: newStatus },
      });

      // Trigger low battery alert if voltage is under 2.8V
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
    // Avoid duplicate unresolved alerts of the same type for the same asset
    const existingAlert = await this.prisma.alert.findFirst({
      where: {
        assetId,
        type,
        isResolved: false,
      },
    });

    if (existingAlert) {
      return; // Alert is already active
    }

    const alert = await this.prisma.alert.create({
      data: {
        type,
        message,
        tenantId,
        assetId,
      },
    });

    this.logger.warn(`⚠️ ALERT CREATED [${type}]: ${message} (Alert ID: ${alert.id})`);
  }
}
