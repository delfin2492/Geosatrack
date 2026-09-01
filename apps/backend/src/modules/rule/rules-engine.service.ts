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
  sourceHandle?: string;
  targetHandle?: string;
}

interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

@Injectable()
export class RulesEngineService {
  private readonly logger = new Logger(RulesEngineService.name);
  private static ruleAssetStates = new Map<string, boolean>();

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
            await this.executeNode(triggerNode, graph, { ...payload, ruleId: rule.id, tenantId: rule.tenantId }, logMessages, new Set());
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
   * Recursively traverse and execute the rule graph with cycle detection.
   */
  private async executeNode(
    currentNode: FlowNode,
    graph: FlowGraph,
    payload: any,
    logMessages: string[],
    visitedNodeIds: Set<string> = new Set(),
  ): Promise<void> {
    if (visitedNodeIds.has(currentNode.id)) {
      return;
    }
    visitedNodeIds.add(currentNode.id);

    const nodeType = currentNode.data?.type || currentNode.type;
    logMessages.push(`Executing Node: ${nodeType} (${currentNode.id})`);

    if (!payload.nodeOutputs) payload.nodeOutputs = {};
    if (payload.nodeOutputs[currentNode.id] === undefined && payload.value !== undefined) {
      payload.nodeOutputs[currentNode.id] = payload.value;
    }

    // 1. Execute logic of current node
    let proceed = true;

    // Input Value Nodes (Constant Number, Boolean, String, Text)
    if (
      nodeType === 'input_number' ||
      nodeType === 'input_boolean' ||
      nodeType === 'input_string' ||
      nodeType === 'input_text'
    ) {
      let val: any = currentNode.data?.value;
      if (nodeType === 'input_number') val = Number(val || 0);
      if (nodeType === 'input_boolean') val = Boolean(val);
      if (nodeType === 'input_string' || nodeType === 'input_text') val = String(val || '');

      payload.nodeOutputs[currentNode.id] = val;
      payload.value = val;
      logMessages.push(`[INPUT VALUE] ${nodeType} (${currentNode.id}) value: ${val}`);
    }

    // Processors: Math
    else if (
      nodeType === 'math_add' ||
      nodeType === 'math_sub' ||
      nodeType === 'math_mul' ||
      nodeType === 'math_div' ||
      nodeType === 'math_avg' ||
      nodeType === 'math_pct' ||
      nodeType === 'process_math'
    ) {
      const inboundEdges = graph.edges.filter(e => e.target === currentNode.id);
      let valA = Number(payload.value || 0);
      let valB = Number(currentNode.data?.valueB || 0);

      const edgeA = inboundEdges.find(e => e.targetHandle === 'input_a' || (!e.targetHandle && e === inboundEdges[0]));
      const edgeB = inboundEdges.find(e => e.targetHandle === 'input_b' || (!e.targetHandle && e === inboundEdges[1]));

      if (edgeA) {
        let srcVal = payload.nodeOutputs?.[edgeA.source];
        if (srcVal === undefined) {
          const srcNode = graph.nodes.find(n => n.id === edgeA.source);
          if (srcNode && !visitedNodeIds.has(srcNode.id)) {
            await this.executeNode(srcNode, graph, payload, logMessages, visitedNodeIds);
            srcVal = payload.nodeOutputs?.[edgeA.source];
          }
        }
        if (srcVal !== undefined) valA = Number(srcVal);
      }

      if (edgeB) {
        let srcVal = payload.nodeOutputs?.[edgeB.source];
        if (srcVal === undefined) {
          const srcNode = graph.nodes.find(n => n.id === edgeB.source);
          if (srcNode && !visitedNodeIds.has(srcNode.id)) {
            await this.executeNode(srcNode, graph, payload, logMessages, visitedNodeIds);
            srcVal = payload.nodeOutputs?.[edgeB.source];
          }
        }
        if (srcVal !== undefined) valB = Number(srcVal);
      }

      let res = valA;
      let op = currentNode.data?.operation;
      if (nodeType === 'math_add') op = 'ADD';
      else if (nodeType === 'math_sub') op = 'SUB';
      else if (nodeType === 'math_mul') op = 'MUL';
      else if (nodeType === 'math_div') op = 'DIV';
      else if (nodeType === 'math_avg') op = 'AVG';
      else if (nodeType === 'math_pct') op = 'PCT';

      if (op === 'ADD') res = valA + valB;
      else if (op === 'SUB') res = valA - valB;
      else if (op === 'MUL') res = valA * valB;
      else if (op === 'DIV') res = valB !== 0 ? valA / valB : valA;
      else if (op === 'AVG') res = (valA + valB) / 2;
      else if (op === 'PCT') res = (valA * valB) / 100;

      payload.value = res;
      payload.nodeOutputs[currentNode.id] = res;

      logMessages.push(`[MATH ${op}] Calculation: ${valA} ${op} ${valB} = ${res}`);
    }

    // Processors: Logic
    else if (
      nodeType === 'logic_gt' ||
      nodeType === 'logic_lt' ||
      nodeType === 'logic_eq' ||
      nodeType === 'logic_neq' ||
      nodeType === 'logic_gte' ||
      nodeType === 'logic_lte' ||
      nodeType === 'logic_and' ||
      nodeType === 'logic_or' ||
      nodeType === 'logic_filter'
    ) {
      const inboundEdges = graph.edges.filter(e => e.target === currentNode.id);
      let valA = Number(payload.value || 0);
      let valB = Number(currentNode.data?.thresholdValue ?? currentNode.data?.value ?? 0);

      const edgeA = inboundEdges.find(e => e.targetHandle === 'input_a' || (!e.targetHandle && e === inboundEdges[0]));
      const edgeB = inboundEdges.find(e => e.targetHandle === 'input_b' || (!e.targetHandle && e === inboundEdges[1]));

      if (edgeA) {
        let srcVal = payload.nodeOutputs?.[edgeA.source];
        if (srcVal === undefined) {
          const srcNode = graph.nodes.find(n => n.id === edgeA.source);
          if (srcNode && !visitedNodeIds.has(srcNode.id)) {
            await this.executeNode(srcNode, graph, payload, logMessages, visitedNodeIds);
            srcVal = payload.nodeOutputs?.[edgeA.source];
          }
        }
        if (srcVal !== undefined) valA = Number(srcVal);
      }

      if (edgeB) {
        let srcVal = payload.nodeOutputs?.[edgeB.source];
        if (srcVal === undefined) {
          const srcNode = graph.nodes.find(n => n.id === edgeB.source);
          if (srcNode && !visitedNodeIds.has(srcNode.id)) {
            await this.executeNode(srcNode, graph, payload, logMessages, visitedNodeIds);
            srcVal = payload.nodeOutputs?.[edgeB.source];
          }
        }
        if (srcVal !== undefined) valB = Number(srcVal);
      }

      const val = valA;
      const thresh = valB;

      let condType = (currentNode.data?.conditionType || currentNode.data?.operator || currentNode.data?.condition || '').toUpperCase().trim();
      if (nodeType === 'logic_gt') condType = 'GT';
      else if (nodeType === 'logic_lt') condType = 'LT';
      else if (nodeType === 'logic_eq') condType = 'EQ';
      else if (nodeType === 'logic_neq') condType = 'NEQ';
      else if (nodeType === 'logic_gte') condType = 'GTE';
      else if (nodeType === 'logic_lte') condType = 'LTE';
      else if (nodeType === 'logic_and') condType = 'AND';
      else if (nodeType === 'logic_or') condType = 'OR';
      if (!condType) condType = 'GT';

      let conditionMet = false;
      if (condType === 'GT' || condType === '>') conditionMet = val > thresh;
      else if (condType === 'LT' || condType === '<') conditionMet = val < thresh;
      else if (condType === 'EQ' || condType === '=' || condType === '==') conditionMet = val === thresh;
      else if (condType === 'NEQ' || condType === '!=') conditionMet = val !== thresh;
      else if (condType === 'GTE' || condType === '>=') conditionMet = val >= thresh;
      else if (condType === 'LTE' || condType === '<=') conditionMet = val <= thresh;
      else if (condType === 'AND' || condType === 'OR') conditionMet = true;

      payload.nodeOutputs[currentNode.id] = conditionMet;

      if (!conditionMet) {
        proceed = false;
        logMessages.push(`[LOGIC ${condType}] Condition failed: ${val} is not ${condType} ${thresh}. Stopping flow path.`);

        // Flow Auto-Recovery Logic when telemetry returns to normal
        const flowRuleId = payload.ruleId || 'GLOBAL';
        const flowStateKey = `flow_rule:${flowRuleId}:${payload.assetId || 'GLOBAL'}`;
        let wasFlowTriggered = RulesEngineService.ruleAssetStates.get(flowStateKey) || false;

        if (!wasFlowTriggered && payload.assetId) {
          const activeAlert = await this.prisma.alert.findFirst({
            where: { assetId: payload.assetId, isResolved: false, type: 'alert_alarm' },
          });
          if (activeAlert) wasFlowTriggered = true;
        }

        if (wasFlowTriggered && payload.assetId) {
          RulesEngineService.ruleAssetStates.set(flowStateKey, false);
          logMessages.push(`[FLOW_RECOVERY] Telemetry returned to normal for "${payload.assetName || 'Asset'}". Triggering flow recovery...`);

          // Reset all node-level ONCE states for this asset
          for (const node of graph.nodes) {
            const nodeStateKey = `flow_node:${node.id}:${payload.assetId}`;
            RulesEngineService.ruleAssetStates.set(nodeStateKey, false);
          }

          // Check if there are explicit recovery nodes in the graph (alarmState === 'RECOVERY' or 'CLEAR')
          const recoveryNodes = graph.nodes.filter((n: any) => {
            const nType = n.data?.type || n.type;
            const aState = n.data?.alarmState;
            return (nType === 'action_notification' || nType === 'action_alarm' || nType === 'action_email' || nType === 'action_telegram') && (aState === 'RECOVERY' || aState === 'CLEAR');
          });

          if (recoveryNodes.length > 0) {
            for (const recNode of recoveryNodes) {
              try {
                await this.executeNode(recNode, graph, { ...payload, isRecoveryPhase: true }, logMessages, visitedNodeIds);
              } catch (e: any) {
                logMessages.push(`[RECOVERY_NODE_ERROR] ${e.message}`);
              }
            }
          } else {
            // Default Auto Recovery if no explicit recovery node was placed in flow graph
            const targetTenantId = payload.tenantId || (await this.getTenantFromAsset(payload.assetId));
            await this.prisma.alert.updateMany({
              where: { tenantId: targetTenantId, assetId: payload.assetId, isResolved: false },
              data: { isResolved: true, resolvedAt: new Date() },
            });

            const attrLabel = payload.attributeName ? `${payload.attributeName}` : 'Parameter telemetri';
            const valLabel = payload.value !== undefined ? ` (Nilai: ${payload.value})` : '';
            const recoveryMsg = `✅ RECOVERED: ${payload.assetName || 'Asset'} - ${attrLabel} kembali normal${valLabel}`;

            const createdAlert = await this.prisma.alert.create({
              data: {
                type: 'alert_recovery',
                message: recoveryMsg,
                tenantId: targetTenantId,
                assetId: payload.assetId,
                isResolved: true,
                resolvedAt: new Date(),
              },
            });
            this.websocketGateway.sendToTenant(targetTenantId, 'alertNew', createdAlert);
          }
        }
      } else {
        const flowRuleId = payload.ruleId || 'GLOBAL';
        const flowStateKey = `flow_rule:${flowRuleId}:${payload.assetId || 'GLOBAL'}`;
        RulesEngineService.ruleAssetStates.set(flowStateKey, true);
        logMessages.push(`[LOGIC ${condType}] Condition passed: ${val} ${condType} ${thresh}`);
      }
    }

    // Actions: Set Attribute Value
    else if (nodeType === 'action_attribute') {
      try {
        const targetAssetId = currentNode.data?.targetAssetId;
        const targetAttribute = currentNode.data?.targetAttribute;
        const commandValue = currentNode.data?.commandValue || String(payload.value);

        if (targetAssetId && targetAttribute) {
          const targetAsset = await this.prisma.asset.findUnique({ where: { id: targetAssetId } });
          if (targetAsset) {
            let descObj: any = {};
            try {
              descObj = JSON.parse(targetAsset.description || '{}');
            } catch (e) {}

            if (!descObj.attributes || !Array.isArray(descObj.attributes)) {
              descObj.attributes = [];
            }

            const existingAttr = descObj.attributes.find((a: any) => a.name === targetAttribute);
            if (existingAttr) {
              existingAttr.value = commandValue;
            } else {
              descObj.attributes.push({ name: targetAttribute, value: commandValue, dataType: 'string' });
            }

            await this.prisma.asset.update({
              where: { id: targetAssetId },
              data: { description: JSON.stringify(descObj) },
            });

            logMessages.push(`[ACTION] Updated target asset "${targetAsset.name}" attribute "${targetAttribute}" to "${commandValue}".`);
          }
        }
      } catch (err: any) {
        logMessages.push(`[ACTION_ERROR] Failed to set attribute value: ${err.message}`);
      }
    } else if (nodeType === 'action_notification' || nodeType === 'action_alarm') {
      const channel = currentNode.data?.channel || (nodeType === 'action_email' ? 'EMAIL' : nodeType === 'action_telegram' ? 'TELEGRAM' : 'SYSTEM');
      const alarmState = currentNode.data?.alarmState || 'TRIGGER';
      const frequency = currentNode.data?.frequency || currentNode.data?.thenFrequency || 'ALWAYS';
      const isRecoveryNode = alarmState === 'RECOVERY' || alarmState === 'CLEAR';
      const isRecoveryPhase = !!payload.isRecoveryPhase;

      // Phase Guard: RECOVERY nodes must ONLY run during RECOVERY phase, and TRIGGER nodes must ONLY run during TRIGGER phase!
      if (isRecoveryNode && !isRecoveryPhase) {
        logMessages.push(`[NODE_SKIP] Skipping recovery node "${currentNode.data?.label || currentNode.id}" during TRIGGER phase.`);
        return;
      }
      if (!isRecoveryNode && isRecoveryPhase) {
        logMessages.push(`[NODE_SKIP] Skipping trigger node "${currentNode.data?.label || currentNode.id}" during RECOVERY phase.`);
        return;
      }

      if (frequency === 'ONCE' && !isRecoveryNode && payload.assetId) {
        const nodeStateKey = `flow_node:${currentNode.id}:${payload.assetId}`;
        const wasNodeTriggered = RulesEngineService.ruleAssetStates.get(nodeStateKey) || false;
        if (wasNodeTriggered) {
          logMessages.push(`[ONCE_THROTTLE] Node "${currentNode.data?.label || currentNode.id}" already triggered once for asset ${payload.assetId}. Skipping duplicate action.`);
          return;
        }
        RulesEngineService.ruleAssetStates.set(nodeStateKey, true);
      } else if (isRecoveryNode && payload.assetId) {
        const nodeStateKey = `flow_node:${currentNode.id}:${payload.assetId}`;
        RulesEngineService.ruleAssetStates.set(nodeStateKey, false);
      }

      if (channel === 'EMAIL') {
        await this.executeNode({ ...currentNode, data: { ...currentNode.data, type: 'action_email', alarmState } }, graph, payload, logMessages);
      } else if (channel === 'TELEGRAM') {
        await this.executeNode({ ...currentNode, data: { ...currentNode.data, type: 'action_telegram', alarmState } }, graph, payload, logMessages);
      } else {
        try {
          const isRecovery = alarmState === 'RECOVERY' || alarmState === 'CLEAR';
          const defaultMsg = isRecovery
            ? `✅ RECOVERED: Asset ${payload.assetName || 'Device'} - ${payload.attributeName || 'Attribute'} kembali normal (Nilai: ${payload.value ?? 'normal'})`
            : `Critical alert: Asset ${payload.assetName || 'Device'} ${payload.geofenceName ? `triggered ${payload.geofenceName}` : (payload.attributeName || 'threshold triggered')}`;

          const rawMessage = currentNode.data.messageTemplate || defaultMsg;
          const message = this.interpolateTemplate(rawMessage, payload);
          const targetTenantId = payload.tenantId || (await this.getTenantFromAsset(payload.assetId));

          if (isRecovery && payload.assetId) {
            await this.prisma.alert.updateMany({
              where: { tenantId: targetTenantId, assetId: payload.assetId, isResolved: false },
              data: { isResolved: true, resolvedAt: new Date() },
            });
          }

          const createdAlert = await this.prisma.alert.create({
            data: {
              type: isRecovery ? 'alert_recovery' : 'alert_alarm',
              message,
              tenantId: targetTenantId,
              assetId: payload.assetId,
              isResolved: isRecovery,
              resolvedAt: isRecovery ? new Date() : null,
            },
          });

          // Broadcast the alert via WebSockets to notify frontend dashboard in real-time!
          this.websocketGateway.sendToTenant(targetTenantId, 'alertNew', createdAlert);
          logMessages.push(`[ACTION ${alarmState}] Successfully created system ${isRecovery ? 'recovery' : 'alarm'} alert.`);
        } catch (err: any) {
          logMessages.push(`[ACTION_ERROR] Failed to create alarm alert: ${err.message}`);
          throw err;
        }
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
        const isEmailRecovery = currentNode.data?.alarmState === 'RECOVERY';
        const createdAlert = await this.prisma.alert.create({
          data: {
            type: 'email',
            message: `Email Sent to ${toEmail}: ${subject}`,
            tenantId: targetTenantId,
            assetId: payload.assetId,
            isResolved: isEmailRecovery,
            resolvedAt: isEmailRecovery ? new Date() : null,
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

        // Convert common markdown asterisks to HTML b tags if user typed markdown in template
        let formattedTemplate = messageTemplate;
        if (formattedTemplate && !formattedTemplate.includes('<b>')) {
          formattedTemplate = formattedTemplate.replace(/\*(.*?)\*/g, '<b>$1</b>');
        }

        const htmlMessageText = this.interpolateTemplate(
          formattedTemplate || `⚠️ <b>GeoMesh Alert</b>\nAsset: <b>${payload.assetName || 'Device'}</b>\nEvent: <b>${payload.geofenceName || payload.attributeName || 'Alert'}</b>\nValue: <b>${payload.value !== undefined ? payload.value : ''}</b>`,
          payload,
        );

        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        
        // 1. Try sending with HTML parse_mode
        let res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: htmlMessageText,
            parse_mode: 'HTML',
          }),
        });

        // 2. Fallback to Plain Text if entity parsing fails (e.g. invalid HTML tags or unescaped characters)
        if (!res.ok) {
          const errBody = await res.json();
          const errDesc = errBody.description || '';
          this.logger.warn(`Telegram HTML parse failed (${errDesc}). Retrying with Plain Text fallback.`);

          const plainMessageText = htmlMessageText.replace(/<[^>]*>/g, '');
          res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: plainMessageText,
            }),
          });

          if (!res.ok) {
            const finalErr = await res.json();
            throw new Error(finalErr.description || `Telegram API returned status ${res.status}`);
          }
        }

        const targetTenantId = payload.tenantId || (await this.getTenantFromAsset(payload.assetId));
        const isTgRecovery = currentNode.data?.alarmState === 'RECOVERY';
        const createdAlert = await this.prisma.alert.create({
          data: {
            type: 'telegram',
            message: `Telegram Sent (${chatId}): ${htmlMessageText.replace(/<[^>]*>/g, '')}`,
            tenantId: targetTenantId,
            assetId: payload.assetId,
            isResolved: isTgRecovery,
            resolvedAt: isTgRecovery ? new Date() : null,
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
        await this.executeNode(childNode, graph, payload, logMessages, visitedNodeIds);
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
      activeMode?: 'ALWAYS' | 'SPECIFIC_PERIOD' | 'DAILY_PERIOD';
      specificPeriod?: { allDays?: boolean; startDate?: string; endDate?: string };
      dailyPeriod?: { startTime?: string; endTime?: string; activeDays?: string[]; repetitionEnds?: string; repetitionEndDate?: string };
      thenFrequency?: string;
      autoRecoveryNotification?: boolean;
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

    // Filter out irrelevant telemetry events that do not match any attribute condition in this rule
    if (eventType === 'TELEMETRY_ALERT' && payload.attributeName) {
      const allConditions = groups.flatMap((g: any) => g.conditions || []);
      const isAttributeRelevant = allConditions.some((c: any) => {
        if (!c.attribute || c.attribute === 'ANY') return true;
        return c.attribute === payload.attributeName;
      });

      if (!isAttributeRelevant) {
        return;
      }
    }

    const activeMode = config.activeMode || 'ALWAYS';
    const thenFrequency = config.thenFrequency || 'ALWAYS';
    const cooldownMinutes = Number(config.cooldownMinutes) || 0;

    // 1. Active Schedule / Period Validation
    const now = new Date();

    if (activeMode === 'SPECIFIC_PERIOD') {
      const allDays = !!config.specificPeriod?.allDays;
      const rawStart = config.specificPeriod?.startDate;
      const rawEnd = config.specificPeriod?.endDate;

      if (rawStart) {
        const startDate = new Date(allDays && !rawStart.includes('T') ? `${rawStart}T00:00:00` : rawStart);
        if (!isNaN(startDate.getTime()) && now < startDate) {
          this.logger.log(`[SCHEDULE] Rule "${rule.name}" (${rule.id}) skipped: specific start date/time not reached.`);
          return;
        }
      }
      if (rawEnd) {
        const endDate = new Date(allDays && !rawEnd.includes('T') ? `${rawEnd}T23:59:59` : rawEnd);
        if (!isNaN(endDate.getTime()) && now > endDate) {
          this.logger.log(`[SCHEDULE] Rule "${rule.name}" (${rule.id}) skipped: specific end date/time passed.`);
          return;
        }
      }
    } else if (activeMode === 'DAILY_PERIOD') {
      // 1. Check repetition end date if ON_DATE
      if (config.dailyPeriod?.repetitionEnds === 'ON_DATE' && config.dailyPeriod?.repetitionEndDate) {
        const repEnd = new Date(`${config.dailyPeriod.repetitionEndDate}T23:59:59`);
        if (!isNaN(repEnd.getTime()) && now > repEnd) {
          this.logger.log(`[SCHEDULE] Rule "${rule.name}" (${rule.id}) skipped: daily repetition ended on ${config.dailyPeriod.repetitionEndDate}.`);
          return;
        }
      }

      // 2. Check active days of week
      const dayCodes = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const todayCode = dayCodes[now.getDay()];
      const activeDays = config.dailyPeriod?.activeDays || ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

      if (!activeDays.includes(todayCode)) {
        this.logger.log(`[SCHEDULE] Rule "${rule.name}" (${rule.id}) skipped: today (${todayCode}) is not an active day.`);
        return;
      }

      // 3. Check daily start/end time
      const startTimeStr = config.dailyPeriod?.startTime;
      const endTimeStr = config.dailyPeriod?.endTime;

      if (startTimeStr && endTimeStr) {
        const currentHours = now.getHours();
        const currentMins = now.getMinutes();
        const currentTotalMins = currentHours * 60 + currentMins;

        const [sH, sM] = startTimeStr.split(':').map(Number);
        const [eH, eM] = endTimeStr.split(':').map(Number);
        const startTotalMins = (sH || 0) * 60 + (sM || 0);
        const endTotalMins = (eH || 0) * 60 + (eM || 0);

        let isWithinDailyPeriod = false;
        if (startTotalMins <= endTotalMins) {
          isWithinDailyPeriod = currentTotalMins >= startTotalMins && currentTotalMins <= endTotalMins;
        } else {
          isWithinDailyPeriod = currentTotalMins >= startTotalMins || currentTotalMins <= endTotalMins;
        }

        if (!isWithinDailyPeriod) {
          this.logger.log(`[SCHEDULE] Rule "${rule.name}" (${rule.id}) skipped: outside daily active window (${startTimeStr}-${endTimeStr}).`);
          return;
        }
      }
    }

    // 2. Throttle / Frequency & Cooldown Check
    let freqWindowMinutes = 0;
    if (thenFrequency === 'ONCE_PER_MINUTE') freqWindowMinutes = 1;
    else if (thenFrequency === 'ONCE_PER_HOUR') freqWindowMinutes = 60;
    else if (thenFrequency === 'ONCE_PER_DAY') freqWindowMinutes = 1440;
    else if (thenFrequency === 'ONCE_PER_WEEK') freqWindowMinutes = 10080;

    const effectiveCooldown = Math.max(cooldownMinutes, freqWindowMinutes);

    if (effectiveCooldown > 0) {
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
          if (cond.attribute && cond.attribute.startsWith('GEOFENCE_')) {
            groupMatched = false;
            logMessages.push(`[GROUP ${gIdx + 1}] Event type mismatch: condition requires geofence but event is TELEMETRY_ALERT`);
            break;
          }
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
        } else if (eventType === 'GEOFENCE_ENTER' || eventType === 'GEOFENCE_EXIT') {
          if (!cond.attribute || !cond.attribute.startsWith('GEOFENCE_')) {
            groupMatched = false;
            logMessages.push(`[GROUP ${gIdx + 1}] Event type mismatch: condition requires telemetry but event is ${eventType}`);
            break;
          }
          
          if (cond.attribute !== 'GEOFENCE_ANY' && cond.attribute !== eventType) {
            groupMatched = false;
            logMessages.push(`[GROUP ${gIdx + 1}] Event type mismatch: expected ${cond.attribute}, got ${eventType}`);
            break;
          }

          if (cond.value && cond.value !== 'ANY' && cond.value !== payload.geofenceId) {
            groupMatched = false;
            logMessages.push(`[GROUP ${gIdx + 1}] Geofence ID mismatch: expected ${cond.value}, got ${payload.geofenceId}`);
            break;
          }
          logMessages.push(`[GROUP ${gIdx + 1}] Geofence condition passed for ${payload.geofenceId}`);
        }
      }

      if (groupMatched) {
        anyGroupMatched = true;
        logMessages.push(`[MATCH] Group ${gIdx + 1} satisfied (OR logic met).`);
        break; // One matching OR group is sufficient to trigger THEN actions
      }
    }

    const stateKey = `${rule.id}:${payload.assetId || 'GLOBAL'}`;
    let wasTriggered = RulesEngineService.ruleAssetStates.get(stateKey) || false;

    if (!wasTriggered && payload.assetId) {
      const activeAlert = await this.prisma.alert.findFirst({
        where: { assetId: payload.assetId, isResolved: false, type: 'alert_alarm' },
      });
      if (activeAlert) {
        wasTriggered = true;
      }
    }

    if (!anyGroupMatched) {
      const autoRecovery = config.autoRecoveryNotification !== false;
      if (wasTriggered && autoRecovery && payload.assetId) {
        RulesEngineService.ruleAssetStates.set(stateKey, false);
        logMessages.push(`[RECOVERY] Telemetry returned to normal for "${payload.assetName || 'Asset'}". Triggering auto recovery notification...`);

        const targetTenantId = payload.tenantId || rule.tenantId || (await this.getTenantFromAsset(payload.assetId));

        // 1. Resolve active alerts for asset
        await this.prisma.alert.updateMany({
          where: { tenantId: targetTenantId, assetId: payload.assetId, isResolved: false },
          data: { isResolved: true, resolvedAt: new Date() },
        });

        // 2. Create Recovery Alert
        const attrLabel = payload.attributeName ? `${payload.attributeName}` : 'Parameter telemetri';
        const valLabel = payload.value !== undefined ? ` (Nilai: ${payload.value})` : '';
        const recoveryMsg = `✅ RECOVERED: ${payload.assetName || 'Asset'} - ${attrLabel} kembali normal${valLabel}`;

        const createdAlert = await this.prisma.alert.create({
          data: {
            type: 'alert_recovery',
            message: recoveryMsg,
            tenantId: targetTenantId,
            assetId: payload.assetId,
            isResolved: true,
            resolvedAt: new Date(),
          },
        });
        this.websocketGateway.sendToTenant(targetTenantId, 'alertNew', createdAlert);

        // 3. Dispatch recovery notifications to Telegram/Email if configured on rule
        for (const action of actions) {
          if (action.actionType === 'email' && action.toEmail) {
            try {
              await this.executeNode({
                id: 'recovery_email',
                type: 'action_email',
                data: {
                  type: 'action_email',
                  alarmState: 'RECOVERY',
                  toEmail: action.toEmail,
                  subjectTemplate: `✅ RECOVERED: ${payload.assetName || 'Asset'} ${attrLabel} Normal`,
                  bodyTemplate: recoveryMsg,
                }
              }, { nodes: [], edges: [] }, payload, logMessages);
            } catch (e: any) {
              logMessages.push(`[RECOVERY_EMAIL_ERROR] ${e.message}`);
            }
          } else if (action.actionType === 'telegram' && action.chatId) {
            try {
              await this.executeNode({
                id: 'recovery_telegram',
                type: 'action_telegram',
                data: {
                  type: 'action_telegram',
                  alarmState: 'RECOVERY',
                  chatId: action.chatId,
                  messageTemplate: `✅ *RECOVERED*: *${payload.assetName || 'Asset'}* - *${attrLabel}* kembali normal${valLabel}`,
                }
              }, { nodes: [], edges: [] }, payload, logMessages);
            } catch (e: any) {
              logMessages.push(`[RECOVERY_TELEGRAM_ERROR] ${e.message}`);
            }
          }
        }

        const fullLog = logMessages.join('\n');
        await this.ruleService.createLog(rule.id, 'RECOVERED', fullLog);
        this.websocketGateway.sendToTenant(rule.tenantId, 'systemLog', {
          level: 'success',
          source: 'RULES_ENGINE',
          deviceName: payload.assetName || rule.name,
          message: `When-Then rule "${rule.name}" auto-recovered`,
          data: { ruleId: rule.id, payload, executionLogs: logMessages },
          timestamp: new Date().toISOString(),
        });
      }
      return;
    }

    const wasAlreadyTriggered = RulesEngineService.ruleAssetStates.get(stateKey) || false;
    RulesEngineService.ruleAssetStates.set(stateKey, true);

    if (thenFrequency === 'ONCE' && wasAlreadyTriggered) {
      this.logger.log(`[ONCE_THROTTLE] Rule "${rule.name}" (${rule.id}) already triggered once for asset ${payload.assetId || 'GLOBAL'}. Skipping duplicate alarm actions.`);
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
