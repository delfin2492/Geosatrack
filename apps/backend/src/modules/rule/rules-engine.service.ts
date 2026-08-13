import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RuleService } from './rule.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import * as nodemailer from 'nodemailer';

interface FlowNode {
  id: string;
  type: string;
  data: Record<string, any>;
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
}

interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

@Injectable()
export class RulesEngineService {
  private readonly logger = new Logger(RulesEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ruleService: RuleService,
    private readonly websocketGateway: WebsocketGateway,
  ) {}

  /**
   * Process a live event and execute matching automation rules.
   * @param tenantId The tenant context
   * @param eventType "GEOFENCE_ENTER" | "GEOFENCE_EXIT" | "TELEMETRY_ALERT"
   * @param payload Dynamic data (asset, geofence, telemetry value, etc.)
   */
  async processEvent(
    tenantId: string,
    eventType: 'GEOFENCE_ENTER' | 'GEOFENCE_EXIT' | 'TELEMETRY_ALERT',
    payload: {
      assetId: string;
      assetName: string;
      geofenceId?: string;
      geofenceName?: string;
      attributeName?: string;
      value?: number;
      threshold?: number;
    },
  ) {
    this.logger.log(`Processing event: ${eventType} for Tenant: ${tenantId}`);

    // 1. Fetch all active rule flows for this tenant
    const activeRules = await this.prisma.ruleFlow.findMany({
      where: { tenantId, isActive: true },
    });

    for (const rule of activeRules) {
      try {
        if (!rule.flowGraph) continue;
        const graph: FlowGraph = JSON.parse(rule.flowGraph);
        if (!graph.nodes || !graph.edges) continue;

        // 2. Find matching trigger nodes
        const triggerNodes = graph.nodes.filter((node) => {
          const nodeType = node.data?.type || node.type;
          if (eventType === 'GEOFENCE_ENTER' || eventType === 'GEOFENCE_EXIT') {
            return (
              nodeType === 'trigger_geofence' &&
              (node.data.eventType === 'ANY' || node.data.eventType === eventType) &&
              (node.data.geofenceId === 'ANY' || node.data.geofenceId === payload.geofenceId) &&
              (node.data.assetId === 'ANY' || node.data.assetId === payload.assetId)
            );
          }
          if (eventType === 'TELEMETRY_ALERT') {
            return (
              nodeType === 'trigger_telemetry' &&
              node.data.attributeName === payload.attributeName &&
              (node.data.assetId === 'ANY' || node.data.assetId === payload.assetId)
            );
          }
          return false;
        });

        // 3. Traverse flow from each matching trigger node
        for (const triggerNode of triggerNodes) {
          const nodeType = triggerNode.data?.type || triggerNode.type;
          const logMessages: string[] = [
            `[${new Date().toISOString()}] Started flow execution triggered by: ${nodeType} (${triggerNode.id})`,
          ];
          let status: 'SUCCESS' | 'FAILED' = 'SUCCESS';

          try {
            await this.executeNode(triggerNode, graph, payload, logMessages);
          } catch (executionErr: any) {
            status = 'FAILED';
            logMessages.push(`[ERROR] Flow execution stopped: ${executionErr.message}`);
          } finally {
            // Write rule execution audit log to database
            const fullLog = logMessages.join('\n');
            await this.ruleService.createLog(rule.id, status, fullLog);

            // Broadcast to live terminal
            this.websocketGateway.sendToTenant(tenantId, 'systemLog', {
              level: status === 'SUCCESS' ? 'success' : 'error',
              source: `RULES_ENGINE`,
              deviceName: payload.assetName || rule.name,
              message: status === 'SUCCESS' ? `Flow execution completed for rule "${rule.name}"` : `Flow execution stopped: ${logMessages[logMessages.length - 1] || 'Error'}`,
              data: {
                ruleId: rule.id,
                payload,
                executionLogs: logMessages
              },
              timestamp: new Date().toISOString()
            });
          }
        }
      } catch (err: any) {
        this.logger.error(`Error executing rule "${rule.name}" (${rule.id}):`, err);
      }
    }
  }

  /**
   * Recursively traverse and execute the rule graph.
   */
  private async executeNode(
    currentNode: FlowNode,
    graph: FlowGraph,
    payload: any,
    logMessages: string[],
  ): Promise<void> {
    const nodeType = currentNode.data?.type || currentNode.type;
    logMessages.push(`Executing Node: ${nodeType} (${currentNode.id})`);

    // 1. Execute logic of current node
    let proceed = true;

    if (nodeType === 'logic_filter') {
      const { conditionType, thresholdValue } = currentNode.data;
      const val = payload.value;
      if (val === undefined) {
        proceed = false;
        logMessages.push(`[LOGIC] Filter failed: Payload is missing numeric telemetry value.`);
      } else {
        const threshold = Number(thresholdValue);
        let conditionMet = false;
        if (conditionType === 'GT') conditionMet = val > threshold;
        else if (conditionType === 'LT') conditionMet = val < threshold;
        else if (conditionType === 'EQ') conditionMet = val === threshold;

        if (conditionMet) {
          logMessages.push(`[LOGIC] Filter passed: ${val} is ${conditionType} than/equal to ${threshold}`);
        } else {
          proceed = false;
          logMessages.push(`[LOGIC] Filter stopped path: ${val} is not ${conditionType} than/equal to ${threshold}`);
        }
      }
    } else if (nodeType === 'action_alarm') {
      try {
        const message =
          currentNode.data.messageTemplate ||
          `Critical alert: Asset ${payload.assetName || 'Device'} ${payload.geofenceName ? `triggered ${payload.geofenceName}` : (payload.attributeName || 'threshold triggered')}`;
        
        const targetTenantId = payload.tenantId || (await this.getTenantFromAsset(payload.assetId));
        const createdAlert = await this.prisma.alert.create({
          data: {
            type: payload.geofenceId ? 'alert_alarm' : 'alert_alarm',
            message: this.interpolateTemplate(message, payload),
            tenantId: targetTenantId,
            assetId: payload.assetId,
          },
        });
        
        // Broadcast the alert via WebSockets to notify frontend dashboard in real-time!
        this.websocketGateway.sendToTenant(targetTenantId, 'alertNew', createdAlert);
        logMessages.push(`[ACTION] Successfully created and broadcasted system alarm alert.`);
      } catch (err: any) {
        logMessages.push(`[ACTION_ERROR] Failed to create alarm alert: ${err.message}`);
        throw err;
      }
    } else if (nodeType === 'action_email') {
      try {
        const { smtpHost, smtpPort, smtpUser, smtpPass, toEmail, subjectTemplate, bodyTemplate } = currentNode.data;
        if (!smtpHost || !smtpUser || !smtpPass || !toEmail) {
          throw new Error('Email configuration is missing required SMTP credentials.');
        }

        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: Number(smtpPort) || 587,
          secure: Number(smtpPort) === 465, // True for port 465, false for other ports
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        });

        const subject = this.interpolateTemplate(subjectTemplate || 'Alert Notification', payload);
        const body = this.interpolateTemplate(bodyTemplate || 'Alert triggered.', payload);

        await transporter.sendMail({
          from: `"GeoMesh RTLS" <${smtpUser}>`,
          to: toEmail,
          subject: subject,
          text: body,
          html: `<p>${body.replace(/\n/g, '<br/>')}</p>`,
        });

        const targetTenantId = payload.tenantId || (await this.getTenantFromAsset(payload.assetId));
        const createdAlert = await this.prisma.alert.create({
          data: {
            type: 'email',
            message: `Email Sent to ${toEmail}: ${subject}`,
            tenantId: targetTenantId,
            assetId: payload.assetId,
          },
        });
        this.websocketGateway.sendToTenant(targetTenantId, 'alertNew', createdAlert);

        logMessages.push(`[ACTION] Successfully sent alert email to ${toEmail}`);
      } catch (err: any) {
        logMessages.push(`[ACTION_ERROR] Failed to send SMTP email: ${err.message}`);
        throw err;
      }
    } else if (nodeType === 'action_telegram') {
      try {
        const { botToken, chatId, messageTemplate } = currentNode.data;
        if (!botToken || !chatId) {
          throw new Error('Telegram Bot Token or Chat ID is missing.');
        }

        const messageText = this.interpolateTemplate(
          messageTemplate || `⚠️ *GeoMesh Alert*\nAsset: *${payload.assetName}*\nEvent: *${payload.geofenceName || payload.attributeName}*`,
          payload,
        );

        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: messageText,
            parse_mode: 'Markdown',
          }),
        });

        if (!res.ok) {
          const errBody = await res.json();
          throw new Error(errBody.description || `Telegram API returned status ${res.status}`);
        }

        const targetTenantId = payload.tenantId || (await this.getTenantFromAsset(payload.assetId));
        const createdAlert = await this.prisma.alert.create({
          data: {
            type: 'telegram',
            message: `Telegram Sent (${chatId}): ${messageText.replace(/\*/g, '')}`,
            tenantId: targetTenantId,
            assetId: payload.assetId,
          },
        });
        this.websocketGateway.sendToTenant(targetTenantId, 'alertNew', createdAlert);

        logMessages.push(`[ACTION] Successfully sent Telegram notification message to chat ${chatId}`);
      } catch (err: any) {
        logMessages.push(`[ACTION_ERROR] Failed to send Telegram message: ${err.message}`);
        throw err;
      }
    }

    if (!proceed) return;

    // 2. Traversal: find all children nodes
    const outboundEdges = graph.edges.filter((edge) => edge.source === currentNode.id);
    for (const edge of outboundEdges) {
      const childNode = graph.nodes.find((n) => n.id === edge.target);
      if (childNode) {
        await this.executeNode(childNode, graph, payload, logMessages);
      }
    }
  }

  /**
   * Helper function to replace templates with variables like {assetName}, {geofenceName}, etc.
   */
  private interpolateTemplate(template: string, payload: any): string {
    if (!template) return '';
    return template
      .replace(/{assetId}/g, payload.assetId || '')
      .replace(/{assetName}/g, payload.assetName || '')
      .replace(/{geofenceId}/g, payload.geofenceId || '')
      .replace(/{geofenceName}/g, payload.geofenceName || '')
      .replace(/{attributeName}/g, payload.attributeName || '')
      .replace(/{value}/g, payload.value !== undefined ? String(payload.value) : '')
      .replace(/{time}/g, new Date().toLocaleString());
  }

  private async getTenantFromAsset(assetId: string): Promise<string> {
    const asset = await this.prisma.asset.findUnique({ where: { id: assetId } });
    return asset?.tenantId || '';
  }
}
