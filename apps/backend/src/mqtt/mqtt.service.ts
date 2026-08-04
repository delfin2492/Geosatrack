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
  private defaultClient: mqtt.MqttClient;
  private clients = new Map<string, mqtt.MqttClient>();
  private syncInterval: NodeJS.Timeout;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly decoder: DecoderService,
    private readonly websocketGateway: WebsocketGateway,
  ) {}

  onModuleInit() {
    this.connectDefaultBroker();
    this.syncAgentConnections();
    
    // Periodically sync connections to catch newly created/updated agents
    this.syncInterval = setInterval(() => {
      this.syncAgentConnections();
    }, 15000);
  }

  onModuleDestroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    if (this.defaultClient) {
      this.defaultClient.end();
    }
    for (const client of this.clients.values()) {
      client.end();
    }
    this.logger.log('Disconnected all MQTT clients.');
  }

  private connectDefaultBroker() {
    const brokerUrl = this.configService.get<string>('MQTT_BROKER_URL') || 'mqtt://localhost:1883';
    const username = this.configService.get<string>('MQTT_USERNAME');
    const password = this.configService.get<string>('MQTT_PASSWORD');

    this.logger.log(`Connecting default Wirepas MQTT Client to ${brokerUrl}...`);

    this.defaultClient = mqtt.connect(brokerUrl, {
      username,
      password,
      clean: true,
      reconnectPeriod: 5000,
    });

    this.defaultClient.on('connect', () => {
      this.logger.log('Default Wirepas MQTT Client successfully connected!');
      const defaultPattern = 'wirepas/gateway/+/node/+/endpoint/+';
      this.defaultClient.subscribe(defaultPattern, (err) => {
        if (err) {
          this.logger.error(`Failed to subscribe default topic: ${defaultPattern}`, err);
        } else {
          this.logger.log(`Subscribed default topic: ${defaultPattern}`);
        }
      });
    });

    this.defaultClient.on('message', async (topic, payload) => {
      // Ingest standard Wirepas
      const standardRegex = /^wirepas\/gateway\/([^/]+)\/node\/([^/]+)\/endpoint\/(\d+)$/;
      const standardMatch = topic.match(standardRegex);
      if (standardMatch) {
        const [, gatewayId, nodeId, endpointStr] = standardMatch;
        const endpointId = parseInt(endpointStr, 10);
        const tagId = `node-${nodeId}`;
        await this.ingestWirepasMessage(gatewayId, tagId, endpointId, payload.toString());
      }
    });

    this.defaultClient.on('error', (err) => {
      this.logger.error('Default Wirepas MQTT Client connection error:', err);
    });
  }

  async syncAgentConnections() {
    try {
      const assets = await this.prisma.asset.findMany({});
      const agents = assets.filter((a) => a.type.startsWith('AGENT_'));
      const currentAgentIds = new Set<string>();

      for (const agent of agents) {
        currentAgentIds.add(agent.id);
        if (!agent.description) continue;

        let parsed: any;
        try {
          parsed = JSON.parse(agent.description);
        } catch (e) {
          continue;
        }

        const { host, port, username, password, clientId } = parsed;
        if (!host || !port) continue;

        const brokerUrl = `mqtt://${host}:${port}`;
        const connectionKey = `${agent.id}::${brokerUrl}::${username || ''}::${clientId || ''}`;

        const existing = this.clients.get(agent.id);
        if (existing) {
          if ((existing as any).connectionKey !== connectionKey) {
            this.logger.log(`Connection parameters changed for Agent "${agent.name}". Reconnecting...`);
            existing.end();
            this.clients.delete(agent.id);
          } else {
            // Re-subscribe to topics in case new assets were linked
            if (existing.connected) {
              await this.subscribeToAgentTopics(agent.id, existing);
            }
            continue;
          }
        }

        this.logger.log(`Connecting Agent "${agent.name}" to broker: ${brokerUrl}...`);

        const client = mqtt.connect(brokerUrl, {
          username: username || undefined,
          password: password || undefined,
          clientId: clientId || undefined,
          clean: true,
          reconnectPeriod: 5000,
        });
        (client as any).connectionKey = connectionKey;

        client.on('connect', async () => {
          this.logger.log(`Agent "${agent.name}" (${agent.id}) successfully connected to ${brokerUrl}!`);
          await this.updateAgentStatus(agent.id, 'connected');
          await this.subscribeToAgentTopics(agent.id, client);
        });

        client.on('message', async (topic, payload) => {
          await this.handleAgentIncomingMessage(agent.id, topic, payload.toString());
        });

        client.on('error', async (err) => {
          this.logger.error(`Agent "${agent.name}" connection error:`, err);
          await this.updateAgentStatus(agent.id, 'error');
        });

        client.on('close', async () => {
          await this.updateAgentStatus(agent.id, 'disconnected');
        });

        this.clients.set(agent.id, client);
      }

      // Close clients for deleted agents
      for (const [agentId, client] of this.clients.entries()) {
        if (!currentAgentIds.has(agentId)) {
          this.logger.log(`Agent ${agentId} was deleted. Closing connection...`);
          client.end();
          this.clients.delete(agentId);
        }
      }
    } catch (e) {
      this.logger.error('Failed to sync dynamic agent connections:', e);
    }
  }

  private async updateAgentStatus(agentId: string, status: string) {
    try {
      const agent = await this.prisma.asset.findUnique({
        where: { id: agentId },
      });
      if (agent && agent.status !== status) {
        const updated = await this.prisma.asset.update({
          where: { id: agentId },
          data: { status },
        });
        this.websocketGateway.sendToTenant(agent.tenantId, 'assetUpdate', updated);
      }
    } catch (e) {
      this.logger.error(`Failed to update status for agent ${agentId}:`, e);
    }
  }

  private async subscribeToAgentTopics(agentId: string, client: mqtt.MqttClient) {
    try {
      const assets = await this.prisma.asset.findMany({});
      for (const asset of assets) {
        if (!asset.description) continue;
        let parsed: any;
        try {
          parsed = JSON.parse(asset.description);
        } catch (e) {
          continue;
        }

        // A. Asset-level subscriptions
        if (parsed.mqttTopic && parsed.mqttAgentId === agentId) {
          client.subscribe(parsed.mqttTopic);
        }

        // B. Attribute-level subscriptions
        if (parsed.attributes && Array.isArray(parsed.attributes)) {
          for (const attr of parsed.attributes) {
            if (attr.mqttTopic && attr.mqttAgentId === agentId) {
              client.subscribe(attr.mqttTopic);
            }
          }
        }
      }
    } catch (e) {
      this.logger.error(`Failed to subscribe topics for agent ${agentId}:`, e);
    }
  }

  private async handleAgentIncomingMessage(agentId: string, topic: string, rawPayload: string) {
    this.logger.log(`[Agent ${agentId}] Received message on topic: "${topic}", payload: ${rawPayload.substring(0, 150)}`);
    
    try {
      const assets = await this.prisma.asset.findMany({});

      for (const asset of assets) {
        if (!asset.description) continue;
        const parsed = JSON.parse(asset.description);

        // A. Asset-Level Ingestion
        if (parsed.mqttTopic && parsed.mqttAgentId === agentId && mqttTopicMatch(parsed.mqttTopic, topic)) {
          if (parsed.mqttDecodeFunctionCode) {
            const outMsg = await this.runSandboxedScript(parsed.mqttDecodeFunctionCode, topic, rawPayload);
            if (outMsg && outMsg.payload) {
              const decoded = outMsg.payload;
              const sourceNodeId = decoded.node || decoded.source_address;

              if (sourceNodeId) {
                const targetTagId = `node-${sourceNodeId}`;
                const targetAsset = assets.find((a) => a.tagId === targetTagId || (a.tagId && a.tagId === String(sourceNodeId)));

                if (targetAsset && targetAsset.description) {
                  const targetParsed = JSON.parse(targetAsset.description);
                  if (targetParsed.attributes && Array.isArray(targetParsed.attributes)) {
                    let targetUpdated = false;
                    const updatedAttrs = targetParsed.attributes.map((attr: any) => {
                      if (decoded[attr.name] !== undefined) {
                        targetUpdated = true;
                        return { 
                          ...attr, 
                          value: decoded[attr.name],
                          lastUpdated: new Date().toISOString()
                        };
                      }
                      return attr;
                    });

                    if (targetUpdated) {
                      await this.prisma.asset.update({
                        where: { id: targetAsset.id },
                        data: {
                          description: JSON.stringify({ ...targetParsed, attributes: updatedAttrs }),
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

            if (attr.mqttTopic && attr.mqttAgentId === agentId && mqttTopicMatch(attr.mqttTopic, topic)) {
              if (attr.mqttDecodeFunctionCode) {
                const outMsg = await this.runSandboxedScript(attr.mqttDecodeFunctionCode, topic, rawPayload);
                if (outMsg && outMsg.payload !== undefined) {
                  
                  const decodedNode = outMsg.payload.node || outMsg.payload.source_address;
                  if (decodedNode && asset.tagId) {
                    const matchNormal = asset.tagId === `node-${decodedNode}`;
                    const matchRaw = asset.tagId === String(decodedNode);
                    if (!matchNormal && !matchRaw) {
                      continue;
                    }
                  }

                  let extractedVal = outMsg.payload;
                  if (attr.mqttValuePath && typeof extractedVal === 'object' && extractedVal !== null) {
                    if (attr.mqttValuePath.startsWith('$.')) {
                      const prop = attr.mqttValuePath.slice(2);
                      extractedVal = extractedVal[prop];
                    }
                  }

                  if (extractedVal === undefined) {
                    continue;
                  }

                  const formattedValue = this.castValue(extractedVal, attr.dataType);
                  updatedAttributes[i] = { 
                    ...attr, 
                    value: formattedValue,
                    lastUpdated: new Date().toISOString()
                  };
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
                description: JSON.stringify({ ...parsed, attributes: updatedAttributes }),
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
      this.logger.error('Failed to process message on agent:', e);
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

      // Safe Wrapper Guard: Ensure msg.payload.wirepas always exists if the root object has packet_received_event
      let vmPayload = payload;
      if (vmPayload && typeof vmPayload === 'object') {
        if (!vmPayload.wirepas && vmPayload.packet_received_event) {
          vmPayload = { wirepas: vmPayload };
        }
      }

      const sandbox = {
        msg: {
          topic,
          payload: vmPayload
        },
        Buffer: Buffer,
        console: {
          log: (...args: any[]) => this.logger.log(`[JS VM Log]: ${args.join(' ')}`),
          error: (...args: any[]) => this.logger.error(`[JS VM Error]: ${args.join(' ')}`),
        }
      };

      vm.createContext(sandbox);

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
