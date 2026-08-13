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
        const { toEmail, subjectTemplate, bodyTemplate } = currentNode.data;
        if (!toEmail) {
          throw new Error('Email configuration is missing recipient email (toEmail).');
        }

        const settings = await this.prisma.systemSetting.findMany({
          where: {
            key: { in: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'] }
          }
        });
        const smtpHost = settings.find(s => s.key === 'SMTP_HOST')?.value;
        const smtpPort = settings.find(s => s.key === 'SMTP_PORT')?.value;
        const smtpUser = settings.find(s => s.key === 'SMTP_USER')?.value;
        const smtpPass = settings.find(s => s.key === 'SMTP_PASS')?.value;

        if (!smtpHost || !smtpUser || !smtpPass) {
          throw new Error('Global SMTP credentials are not configured in System Settings.');
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

        const rawSubject = this.interpolateTemplate(subjectTemplate || 'Alert Notification', payload);
        const subject = `[GEOMESH ALARM] Alert: ${rawSubject}`;
        
        const rawBody = this.interpolateTemplate(bodyTemplate || 'Alert triggered.', payload);
        const formattedBody = rawBody
          .split('\n')
          .map(line => {
            const colonIndex = line.indexOf(':');
            if (colonIndex !== -1) {
              const key = line.substring(0, colonIndex);
              const value = line.substring(colonIndex + 1);
              return `<strong>${key}</strong>:${value}`;
            }
            return line;
          })
          .join('<br/>');

        const htmlContent = `
<div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; padding: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
  <h2 style="color: #d32f2f; margin-top: 0; display: flex; align-items: center; font-size: 18px;">
    🚨 GeoMesh Alarm Alert
  </h2>
  <p style="font-size: 14px; margin-bottom: 20px;">
    Alarm <strong>"${rawSubject}"</strong> has been triggered.
  </p>
  <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
  <div style="font-size: 14px; line-height: 1.8;">
    ${formattedBody}
  </div>
</div>
        `;

        await transporter.sendMail({
          from: `"GeoMesh Platform" <${smtpUser}>`,
          to: toEmail,
          subject: subject,
          text: rawBody,
          html: htmlContent,
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
        const { chatId, messageTemplate } = currentNode.data;
        if (!chatId) {
          throw new Error('Telegram Chat ID is missing.');
        }

        const botTokenSetting = await this.prisma.systemSetting.findUnique({
          where: { key: 'TELEGRAM_BOT_TOKEN' }
        });
        const botToken = botTokenSetting?.value;

        if (!botToken) {
          throw new Error('Global Telegram Bot Token is not configured in System Settings.');
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
