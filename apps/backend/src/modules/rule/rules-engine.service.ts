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
        if (rule.ruleType === 'WHEN_THEN' || (!rule.flowGraph && rule.ruleConfig)) {
          await this.processWhenThenRule(rule, eventType, payload);
          continue;
        }
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
              (nodeType === 'trigger_telemetry' || nodeType === 'input_attribute') &&
              (node.data?.attributeName === 'ANY' || !node.data?.attributeName || node.data?.attributeName === payload.attributeName) &&
              (node.data?.assetId === 'ANY' || !node.data?.assetId || node.data?.assetId === payload.assetId)
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
        const cond = String(conditionType || '').toUpperCase();
        let conditionMet = false;
        if (cond === 'GT' || cond === '>') conditionMet = val > threshold;
        else if (cond === 'LT' || cond === '<') conditionMet = val < threshold;
        else if (cond === 'EQ' || cond === '=' || cond === '==') conditionMet = val === threshold;
        else if (cond === 'GTE' || cond === '>=') conditionMet = val >= threshold;
        else if (cond === 'LTE' || cond === '<=') conditionMet = val <= threshold;

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

  /**
   * Process a simple When-Then rule configuration.
   */
  private async processWhenThenRule(
    rule: any,
    eventType: 'GEOFENCE_ENTER' | 'GEOFENCE_EXIT' | 'TELEMETRY_ALERT',
    payload: any,
  ) {
    if (!rule.ruleConfig) return;
    let config: {
      thenFrequency?: string;
      cooldownMinutes?: number;
      groups?: any[];
      conditions?: any[];
      actions?: any[];
    } = {};

    try {
      config = JSON.parse(rule.ruleConfig);
    } catch (e) {
      return;
    }

    const actions = config.actions || [];
    if (actions.length === 0) return;

    // Backward compatibility for flat conditions array vs new groups array
    const groups: any[] = config.groups && Array.isArray(config.groups)
      ? config.groups
      : (config.conditions ? [{ id: 'group-default', conditions: config.conditions }] : []);

    if (groups.length === 0) return;

    const thenFrequency = config.thenFrequency || 'ALWAYS';
    const cooldownMinutes = Number(config.cooldownMinutes) || 0;

    // 1. Throttle / Frequency & Cooldown Check
    let freqWindowMinutes = 0;
    if (thenFrequency === 'ONCE_PER_MINUTE') freqWindowMinutes = 1;
    else if (thenFrequency === 'ONCE_PER_HOUR') freqWindowMinutes = 60;
    else if (thenFrequency === 'ONCE_PER_DAY') freqWindowMinutes = 1440;
    else if (thenFrequency === 'ONCE_PER_WEEK') freqWindowMinutes = 10080;

    const effectiveCooldown = Math.max(cooldownMinutes, freqWindowMinutes);

    if (thenFrequency === 'ONCE') {
      const existingLog = await this.prisma.ruleLog.findFirst({
        where: { ruleId: rule.id, status: 'SUCCESS' },
      });
      if (existingLog) {
        this.logger.log(`[ONCE_THROTTLE] Rule "${rule.name}" (${rule.id}) already executed once. Skipping.`);
        return;
      }
    } else if (effectiveCooldown > 0) {
      const cutoffTime = new Date(Date.now() - effectiveCooldown * 60 * 1000);
      const recentSuccessLog = await this.prisma.ruleLog.findFirst({
        where: {
          ruleId: rule.id,
          status: 'SUCCESS',
          createdAt: { gte: cutoffTime },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (recentSuccessLog) {
        this.logger.log(`[THROTTLE] Rule "${rule.name}" (${rule.id}) skipped due to active cooldown/frequency (${effectiveCooldown}m).`);
        return;
      }
    }

    // 2. Evaluate Groups (OR between groups, AND inside conditions)
    const logMessages: string[] = [
      `[${new Date().toISOString()}] Executing When-Then Rule: "${rule.name}" (${rule.id}) [Freq: ${thenFrequency}]`,
    ];

    let anyGroupMatched = false;

    for (let gIdx = 0; gIdx < groups.length; gIdx++) {
      const group = groups[gIdx];
      const conditions = group.conditions || [];
      if (conditions.length === 0) continue;

      let groupMatched = true;

      for (const cond of conditions) {
        if (cond.assetId && cond.assetId !== 'ANY' && cond.assetId !== payload.assetId) {
          groupMatched = false;
          logMessages.push(`[GROUP ${gIdx + 1}] Asset mismatch: expected ${cond.assetId}, got ${payload.assetId}`);
          break;
        }

        if (eventType === 'TELEMETRY_ALERT') {
          if (cond.attribute && cond.attribute !== 'ANY' && cond.attribute !== payload.attributeName) {
            groupMatched = false;
            logMessages.push(`[GROUP ${gIdx + 1}] Attribute mismatch: expected ${cond.attribute}, got ${payload.attributeName}`);
            break;
          }

          const val = payload.value;
          const thresh = Number(cond.value);
          if (val === undefined || val === null || isNaN(thresh)) {
            groupMatched = false;
            logMessages.push(`[GROUP ${gIdx + 1}] Missing or invalid numeric telemetry value.`);
            break;
          }

          const operator = String(cond.operator || '>').toUpperCase();
          let match = false;
          if (operator === '>' || operator === 'GT') match = val > thresh;
          else if (operator === '<' || operator === 'LT') match = val < thresh;
          else if (operator === '=' || operator === '==' || operator === 'EQ') match = val === thresh;
          else if (operator === '!=' || operator === 'NEQ') match = val !== thresh;
          else if (operator === '>=' || operator === 'GTE') match = val >= thresh;
          else if (operator === '<=' || operator === 'LTE') match = val <= thresh;

          if (!match) {
            groupMatched = false;
            logMessages.push(`[GROUP ${gIdx + 1}] Condition failed: ${val} is not ${operator} ${thresh}`);
            break;
          }

          // Check Duration if specified (> 0)
          const durationMins = Number(cond.durationMinutes) || 0;
          if (durationMins > 0 && payload.assetId && payload.attributeName) {
            const asset = await this.prisma.asset.findUnique({ where: { id: payload.assetId } });
            const tagId = asset?.tagId;
            if (tagId) {
              const historyCutoff = new Date(Date.now() - durationMins * 60 * 1000);
              const historyRecords = await this.prisma.telemetryLog.findMany({
                where: {
                  tagId: tagId,
                  attrName: payload.attributeName,
                  timestamp: { gte: historyCutoff },
                },
                orderBy: { timestamp: 'asc' },
              });

              if (historyRecords.length > 0) {
                const allHistoryMatched = historyRecords.every(rec => {
                  const recVal = Number(rec.value);
                  if (isNaN(recVal)) return false;
                  if (operator === '>' || operator === 'GT') return recVal > thresh;
                  if (operator === '<' || operator === 'LT') return recVal < thresh;
                  if (operator === '=' || operator === '==' || operator === 'EQ') return recVal === thresh;
                  if (operator === '!=' || operator === 'NEQ') return recVal !== thresh;
                  if (operator === '>=' || operator === 'GTE') return recVal >= thresh;
                  if (operator === '<=' || operator === 'LTE') return recVal <= thresh;
                  return false;
                });

                if (!allHistoryMatched) {
                  groupMatched = false;
                  logMessages.push(`[GROUP ${gIdx + 1}] Duration check failed: Condition was not continuously met over last ${durationMins}m.`);
                  break;
                } else {
                  logMessages.push(`[GROUP ${gIdx + 1}] Duration check passed (${durationMins}m window satisfied).`);
                }
              }
            }
          }

          logMessages.push(`[GROUP ${gIdx + 1}] Condition passed: ${val} ${operator} ${thresh}`);
        }
      }

      if (groupMatched) {
        anyGroupMatched = true;
        logMessages.push(`[MATCH] Group ${gIdx + 1} satisfied (OR logic met).`);
        break; // One matching OR group is sufficient to trigger THEN actions
      }
    }

    if (!anyGroupMatched) {
      return;
    }

    let status: 'SUCCESS' | 'FAILED' = 'SUCCESS';

    for (const action of actions) {
      try {
        const actionType = action.actionType;
        if (actionType === 'alarm' || actionType === 'notification') {
          const msg = action.message || `Alert for ${payload.assetName || 'Asset'}: ${payload.attributeName || 'threshold'} = ${payload.value}`;
          const targetTenantId = payload.tenantId || rule.tenantId || (await this.getTenantFromAsset(payload.assetId));
          const createdAlert = await this.prisma.alert.create({
            data: {
              type: 'alert_alarm',
              message: this.interpolateTemplate(msg, payload),
              tenantId: targetTenantId,
              assetId: payload.assetId,
            },
          });
          this.websocketGateway.sendToTenant(targetTenantId, 'alertNew', createdAlert);
          logMessages.push(`[ACTION] Created Alarm alert.`);
        } else if (actionType === 'email') {
          const toEmail = action.toEmail;
          if (!toEmail) throw new Error('Email action requires recipient (toEmail).');

          const settings = await this.prisma.systemSetting.findMany({
            where: { key: { in: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'] } }
          });
          const smtpHost = settings.find(s => s.key === 'SMTP_HOST')?.value;
          const smtpPort = settings.find(s => s.key === 'SMTP_PORT')?.value;
          const smtpUser = settings.find(s => s.key === 'SMTP_USER')?.value;
          const smtpPass = settings.find(s => s.key === 'SMTP_PASS')?.value;

          if (!smtpHost || !smtpUser || !smtpPass) {
            throw new Error('SMTP credentials not configured in System Settings.');
          }

          const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: Number(smtpPort) || 587,
            secure: Number(smtpPort) === 465,
            auth: { user: smtpUser, pass: smtpPass },
          });

          const rawSubject = action.subjectTemplate || 'Alert Notification';
          const subject = `[GEOMESH ALARM] ${this.interpolateTemplate(rawSubject, payload)}`;
          const body = this.interpolateTemplate(action.bodyTemplate || 'Asset {assetName} triggered alert: {attributeName} = {value}', payload);

          await transporter.sendMail({
            from: `"GeoMesh Platform" <${smtpUser}>`,
            to: toEmail,
            subject,
            text: body,
            html: `<div style="font-family: sans-serif; padding: 20px;"><h3>GeoMesh Alarm</h3><p>${body}</p></div>`,
          });

          const targetTenantId = payload.tenantId || rule.tenantId;
          const createdAlert = await this.prisma.alert.create({
            data: {
              type: 'email',
              message: `Email Sent to ${toEmail}: ${subject}`,
              tenantId: targetTenantId,
              assetId: payload.assetId,
            },
          });
          this.websocketGateway.sendToTenant(targetTenantId, 'alertNew', createdAlert);
          logMessages.push(`[ACTION] Sent email to ${toEmail}`);
        } else if (actionType === 'telegram') {
          const chatId = action.chatId;
          if (!chatId) throw new Error('Telegram action requires chatId.');

          const botTokenSetting = await this.prisma.systemSetting.findUnique({
            where: { key: 'TELEGRAM_BOT_TOKEN' }
          });
          const botToken = botTokenSetting?.value;
          if (!botToken) throw new Error('Telegram Bot Token not configured in System Settings.');

          const text = this.interpolateTemplate(action.messageTemplate || 'Alert for {assetName}: {attributeName} = {value}', payload);
          let res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
          });
          if (!res.ok) {
            const errBody = await res.json();
            if (errBody.description && errBody.description.includes('parse entities')) {
              // Retry without parse_mode if Markdown formatting is invalid
              res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, text }),
              });
            }
          }
          if (!res.ok) {
            const errBody = await res.json();
            throw new Error(errBody.description || `Telegram status ${res.status}`);
          }

          const targetTenantId = payload.tenantId || rule.tenantId;
          const createdAlert = await this.prisma.alert.create({
            data: {
              type: 'telegram',
              message: `Telegram Sent (${chatId}): ${text.replace(/\*/g, '')}`,
              tenantId: targetTenantId,
              assetId: payload.assetId,
            },
          });
          this.websocketGateway.sendToTenant(targetTenantId, 'alertNew', createdAlert);
          logMessages.push(`[ACTION] Sent Telegram message to ${chatId}`);
        }
      } catch (actErr: any) {
        status = 'FAILED';
        logMessages.push(`[ACTION_ERROR] Action failed: ${actErr.message}`);
      }
    }

    const fullLog = logMessages.join('\n');
    await this.ruleService.createLog(rule.id, status, fullLog);
    this.websocketGateway.sendToTenant(rule.tenantId, 'systemLog', {
      level: status === 'SUCCESS' ? 'success' : 'error',
      source: 'RULES_ENGINE',
      deviceName: payload.assetName || rule.name,
      message: status === 'SUCCESS' ? `When-Then rule "${rule.name}" executed` : `When-Then rule "${rule.name}" failed`,
      data: { ruleId: rule.id, payload, executionLogs: logMessages },
      timestamp: new Date().toISOString(),
    });
  }

}
