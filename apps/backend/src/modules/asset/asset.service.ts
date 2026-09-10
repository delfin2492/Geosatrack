import { Injectable, NotFoundException, ConflictException, BadRequestException, Optional, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { MqttService } from '../../mqtt/mqtt.service';

@Injectable()
export class AssetService {
  private readonly logger = new Logger(AssetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly websocketGateway: WebsocketGateway,
    @Optional() private readonly mqttService?: MqttService,
  ) {}

  async getQuota(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { agentLimit: true, assetLimit: true },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant with ID "${tenantId}" not found.`);
    }

    const agentCount = await this.prisma.asset.count({
      where: {
        tenantId,
        OR: [
          { type: { startsWith: 'AGENT_' } },
          { type: 'AGENT' },
        ],
      },
    });

    const assetCount = await this.prisma.asset.count({
      where: {
        tenantId,
        NOT: [
          { type: { startsWith: 'AGENT_' } },
          { type: 'AGENT' },
          { type: 'ANCHOR' },
        ],
      },
    });

    return {
      agentLimit: tenant.agentLimit,
      agentCount,
      agentRemaining: Math.max(0, tenant.agentLimit - agentCount),
      isAgentLimitReached: agentCount >= tenant.agentLimit,
      assetLimit: tenant.assetLimit,
      assetCount,
      assetRemaining: Math.max(0, tenant.assetLimit - assetCount),
      isAssetLimitReached: assetCount >= tenant.assetLimit,
    };
  }

  async create(
    tenantId: string,
    data: {
      name: string;
      description?: string;
      status?: string;
      zoneId?: string;
      tagId?: string;
      type?: string;
      latitude?: number;
      longitude?: number;
      parentId?: string;
    },
  ) {
    const { name, description, status, zoneId, tagId, type, latitude, longitude, parentId } = data;

    // 0. Check Tenant Quota Limit
    const quota = await this.getQuota(tenantId);
    const isAgent = (type || '').startsWith('AGENT_') || type === 'AGENT';
    const isAnchor = type === 'ANCHOR';

    if (isAgent && quota.isAgentLimitReached) {
      throw new BadRequestException(
        `Kapasitas kuota Agent telah mencapai batas maksimum (${quota.agentCount}/${quota.agentLimit}). Hubungi administrator untuk upgrade lisensi.`,
      );
    }

    if (!isAgent && !isAnchor && quota.isAssetLimitReached) {
      throw new BadRequestException(
        `Kapasitas kuota Asset telah mencapai batas maksimum (${quota.assetCount}/${quota.assetLimit}). Hubungi administrator untuk upgrade lisensi.`,
      );
    }

    // 1. Verify zone if provided
    if (zoneId) {
      const zone = await this.prisma.zone.findFirst({
        where: { id: zoneId, site: { tenantId } },
      });
      if (!zone) {
        throw new NotFoundException(`Zone with ID "${zoneId}" not found for this tenant.`);
      }
    }

    // 1.5 Verify parent asset if provided
    if (parentId) {
      const parentAsset = await this.prisma.asset.findFirst({
        where: { id: parentId, tenantId },
      });
      if (!parentAsset) {
        throw new NotFoundException(`Parent Asset with ID "${parentId}" not found for this tenant.`);
      }
    }

    // 2. Auto-provision tag if provided, and check if it's already linked to another asset
    if (tagId) {
      await this.prisma.tag.upsert({
        where: { id: tagId },
        update: {},
        create: {
          id: tagId,
          name: `Tag for ${tagId}`,
        },
      });

      const existingLinkedAsset = await this.prisma.asset.findUnique({
        where: { tagId },
      });
      if (existingLinkedAsset) {
        throw new ConflictException(`Device Address "${tagId}" is already linked to another asset.`);
      }
    }

    let finalLat = latitude !== undefined ? latitude : null;
    let finalLon = longitude !== undefined ? longitude : null;

    if ((finalLat === null || finalLon === null) && description) {
      try {
        const parsed = JSON.parse(description);
        const locAttr = parsed.attributes?.find((a: any) => a.dataType === 'GeoPoint' || a.name === 'location' || a.name === 'coordinates');
        if (locAttr && locAttr.value && typeof locAttr.value === 'string' && locAttr.value.includes(',')) {
          const parts = locAttr.value.split(',').map((s: string) => parseFloat(s.trim()));
          if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            finalLat = parts[0];
            finalLon = parts[1];
          }
        }
      } catch (e) {}
    }

    const createdAsset = await this.prisma.asset.create({
      data: {
        name,
        description,
        type: type ?? 'FORKLIFT',
        status: status ?? 'static',
        latitude: finalLat,
        longitude: finalLon,
        tenantId,
        zoneId: zoneId || null,
        tagId: tagId || null,
        parentId: parentId || null,
      },
    });

    this.websocketGateway.sendToTenant(tenantId, 'systemLog', {
      level: 'success',
      source: 'ASSET_MANAGER',
      deviceName: name,
      message: `Asset [${type ?? 'FORKLIFT'}] successfully created`,
      data: createdAsset,
      timestamp: new Date().toISOString()
    });

    return createdAsset;
  }

  async findAll(
    tenantId: string,
    filters: {
      status?: string;
      zoneId?: string;
      siteId?: string;
      search?: string;
    },
  ) {
    const { status, zoneId, siteId, search } = filters;

    return this.prisma.asset.findMany({
      where: {
        tenantId,
        status: status ? status : undefined,
        zoneId: zoneId ? zoneId : undefined,
        zone: siteId
          ? {
              siteId: siteId,
            }
          : undefined,
        OR: search
          ? [
              { name: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              { tagId: { contains: search, mode: 'insensitive' } },
            ]
          : undefined,
      },
      include: {
        zone: {
          select: {
            name: true,
            site: {
              select: {
                name: true,
              },
            },
          },
        },
        tag: true,
      },
    });
  }

  async findOne(tenantId: string, id: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id, tenantId },
      include: {
        zone: {
          include: {
            site: true,
          },
        },
        tag: true,
        alerts: {
          where: { isResolved: false },
        },
      },
    });
    if (!asset) {
      throw new NotFoundException(`Asset with ID "${id}" not found for this tenant.`);
    }
    return asset;
  }

  async update(
    tenantId: string,
    id: string,
    data: {
      name?: string;
      description?: string;
      status?: string;
      zoneId?: string | null;
      tagId?: string | null;
      type?: string;
      latitude?: number | null;
      longitude?: number | null;
      parentId?: string | null;
    },
  ) {
    let asset: any = null;
    try {
      asset = await this.findOne(tenantId, id); // Verify ownership
    } catch (e) {
      const anchor = await this.prisma.anchor.findFirst({
        where: { id, tenantId },
      });
      if (anchor) {
        return this.prisma.anchor.update({
          where: { id },
          data: {
            x: data.latitude !== undefined && data.latitude !== null ? Number(data.latitude) : undefined,
            y: data.longitude !== undefined && data.longitude !== null ? Number(data.longitude) : undefined,
          },
        });
      }
      throw e;
    }

    const { name, description, status, zoneId, tagId, type, latitude, longitude, parentId } = data;

    // Validate Zone
    if (zoneId) {
      const zone = await this.prisma.zone.findFirst({
        where: { id: zoneId, site: { tenantId } },
      });
      if (!zone) {
        throw new NotFoundException(`Zone with ID "${zoneId}" not found for this tenant.`);
      }
    }

    // Validate Parent Asset
    if (parentId) {
      if (parentId === id) {
        throw new ConflictException(`An asset cannot be its own parent.`);
      }
      const parentAsset = await this.prisma.asset.findFirst({
        where: { id: parentId, tenantId },
      });
      if (!parentAsset) {
        throw new NotFoundException(`Parent Asset with ID "${parentId}" not found for this tenant.`);
      }
    }

    // Validate & Auto-provision Tag
    if (tagId && tagId !== asset.tagId) {
      await this.prisma.tag.upsert({
        where: { id: tagId },
        update: {},
        create: {
          id: tagId,
          name: `Tag for ${tagId}`,
        },
      });

      const existingLinkedAsset = await this.prisma.asset.findUnique({
        where: { tagId },
      });
      if (existingLinkedAsset) {
        throw new ConflictException(`Device Address "${tagId}" is already linked to another asset.`);
      }
    }

    let finalLat = latitude;
    let finalLon = longitude;

    if (description && (finalLat === undefined || finalLon === undefined || finalLat === null || finalLon === null)) {
      try {
        const parsed = JSON.parse(description);
        const locAttr = parsed.attributes?.find((a: any) => a.dataType === 'GeoPoint' || a.name === 'location' || a.name === 'coordinates');
        if (locAttr && locAttr.value && typeof locAttr.value === 'string' && locAttr.value.includes(',')) {
          const parts = locAttr.value.split(',').map((s: string) => parseFloat(s.trim()));
          if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            finalLat = parts[0];
            finalLon = parts[1];
          }
        }
      } catch (e) {}
    }

    return this.prisma.asset.update({
      where: { id },
      data: {
        name: name !== undefined ? name : undefined,
        description: description !== undefined ? description : undefined,
        status: status !== undefined ? status : undefined,
        zoneId: zoneId !== undefined ? zoneId : undefined,
        tagId: tagId !== undefined ? tagId : undefined,
        type: type !== undefined ? type : undefined,
        latitude: finalLat !== undefined ? finalLat : undefined,
        longitude: finalLon !== undefined ? finalLon : undefined,
        parentId: parentId !== undefined ? parentId : undefined,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id); // Verify ownership
    return this.prisma.asset.delete({
      where: { id },
    });
  }

  async linkTag(tenantId: string, id: string, tagId: string) {
    return this.update(tenantId, id, { tagId });
  }

  async unlinkTag(tenantId: string, id: string) {
    return this.update(tenantId, id, { tagId: null });
  }

  async duplicateAsset(tenantId: string, id: string) {
    const source = await this.findOne(tenantId, id);

    const quota = await this.getQuota(tenantId);
    const isAgent = (source.type || '').startsWith('AGENT_') || source.type === 'AGENT';
    const isAnchor = source.type === 'ANCHOR';

    if (isAgent && quota.isAgentLimitReached) {
      throw new BadRequestException(
        `Tidak dapat menduplikasi Agent. Kapasitas kuota Agent sudah penuh (${quota.agentCount}/${quota.agentLimit}).`,
      );
    }

    if (!isAgent && !isAnchor && quota.isAssetLimitReached) {
      throw new BadRequestException(
        `Tidak dapat menduplikasi Asset. Kapasitas kuota Asset sudah penuh (${quota.assetCount}/${quota.assetLimit}).`,
      );
    }

    // Parse description to modify name in attributes
    let descriptionJson: any = null;
    try {
      if (source.description) {
        descriptionJson = JSON.parse(source.description);
      }
    } catch (e) {}

    return this.prisma.asset.create({
      data: {
        name: `${source.name} (Copy)`,
        description: source.description || null,
        type: source.type,
        status: 'static',
        tenantId,
        zoneId: source.zoneId || null,
        tagId: null, // tagId tidak diduplikasi (1 tag = 1 asset)
        latitude: source.latitude,
        longitude: source.longitude,
        parentId: source.parentId || null,
      },
    });
  }

  async getTelemetryHistory(
    tenantId: string,
    assetId: string,
    attributeName: string,
    range: string,
    endDateParam?: string,
    startDateParam?: string,
  ) {
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, tenantId },
    });
    if (!asset) {
      throw new NotFoundException(`Asset with ID "${assetId}" not found.`);
    }

    if (!asset.tagId) {
      return [];
    }

    // Determine time range start date
    const endDt = endDateParam ? new Date(endDateParam) : new Date();
    let startDt = new Date(endDt.getTime() - 60 * 60 * 1000); // default 1h

    if (startDateParam) {
      startDt = new Date(startDateParam);
    } else if (range === 'realtime') {
      startDt = new Date(endDt.getTime() - 10 * 60 * 1000); // last 10 mins for realtime
    } else if (range === '1h') {
      startDt = new Date(endDt.getTime() - 60 * 60 * 1000);
    } else if (range === '1d' || range === '24h') {
      startDt = new Date(endDt.getTime() - 24 * 60 * 60 * 1000);
    } else if (range === '1w' || range === '7d') {
      startDt = new Date(endDt.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (range === '1m' || range === '30d') {
      startDt = new Date(endDt.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (range === '1y') {
      startDt = new Date(endDt.getTime() - 365 * 24 * 60 * 60 * 1000);
    }
    
    const timeFilter: any = { gte: startDt, lte: endDt };

    // 1. Try TelemetryLog first (dynamic attributes)
    const dynamicLogs = await (this.prisma as any).telemetryLog.findMany({
      where: {
        tagId: asset.tagId,
        attrName: attributeName,
        timestamp: timeFilter,
      },
      orderBy: { timestamp: 'asc' },
    });

    if (dynamicLogs.length > 0) {
      return dynamicLogs.map((t: any) => ({
        timestamp: t.timestamp.toISOString(),
        value: Number(t.value),
      }));
    }

    // 2. Fallback: query legacy telemetry table via fieldMap
    const attrNameLower = attributeName.toLowerCase();
    const fieldMap: Record<string, string> = {
      temperature: 'temperature',
      humidity: 'humidity',
      voltage: 'battery',
      battery: 'battery',
      rssi: 'rssi',
      gateway_rssi: 'rssi',
      accel_x: 'accelX',
      accel_y: 'accelY',
      accel_z: 'accelZ',
      pitch: 'pitch',
      roll: 'roll',
      hall: 'hall',
    };

    const dbField = fieldMap[attrNameLower];
    if (!dbField) {
      return [];
    }

    const telemetryLogs = (await this.prisma.telemetry.findMany({
      where: {
        tagId: asset.tagId,
        timestamp: timeFilter,
      },
      select: {
        timestamp: true,
        [dbField]: true,
      },
      orderBy: {
        timestamp: 'asc',
      },
    })) as any[];

    return telemetryLogs
      .filter((t) => t[dbField] !== null)
      .map((t) => ({
        timestamp: t.timestamp.toISOString(),
        value: Number(t[dbField]),
      }));
  }


  async getTelemetryExport(
    tenantId: string,
    query: {
      assetId?: string;
      tagId?: string;
      attribute?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
    },
  ) {
    const tenantAssets = await this.prisma.asset.findMany({
      where: { tenantId },
      include: { tag: true },
    });

    const assetByTagMap = new Map<string, { id: string; name: string; type: string; attributes?: any[] }>();
    const assetByIdMap = new Map<string, { id: string; name: string; tagId: string | null }>();

    tenantAssets.forEach((a) => {
      let registeredAttrs: any[] = [];
      if (a.description) {
        try {
          const parsed = JSON.parse(a.description);
          if (Array.isArray(parsed.attributes)) registeredAttrs = parsed.attributes;
        } catch (e) {}
      }
      assetByIdMap.set(a.id, { id: a.id, name: a.name, tagId: a.tagId });
      if (a.tagId) {
        assetByTagMap.set(a.tagId, { id: a.id, name: a.name, type: a.type, attributes: registeredAttrs });
      }
    });

    const whereClause: any = {};
    if (query.tagId) {
      whereClause.tagId = query.tagId;
    } else if (query.assetId && assetByIdMap.has(query.assetId)) {
      const targetTagId = assetByIdMap.get(query.assetId)?.tagId;
      if (targetTagId) whereClause.tagId = targetTagId;
    } else {
      const tenantTagIds = Array.from(assetByTagMap.keys());
      if (tenantTagIds.length > 0) {
        whereClause.tagId = { in: tenantTagIds };
      }
    }

    if (query.startDate || query.endDate) {
      whereClause.timestamp = {};
      if (query.startDate) whereClause.timestamp.gte = new Date(query.startDate);
      if (query.endDate) whereClause.timestamp.lte = new Date(query.endDate);
    }

    const limitNum = Math.min(query.limit ? Number(query.limit) : 5000, 50000);

    const normalizeAttrKey = (name: string): string => {
      if (!name) return '';
      const s = name.toLowerCase().replace(/[\s_()%-]+/g, '').trim();
      if (s === 'battery' || s === 'voltage' || s === 'batteryvoltage') return 'voltage';
      if (s === 'accelx' || s === 'accel_x') return 'accelx';
      if (s === 'accely' || s === 'accel_y') return 'accely';
      if (s === 'accelz' || s === 'accel_z') return 'accelz';
      return s;
    };

    const attrFilters = (query.attribute || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const normFilters = attrFilters.map(normalizeAttrKey);
    const isAllAttr = attrFilters.length === 0 || attrFilters.includes('all');

    const matchesFilter = (attrName: string) => {
      if (isAllAttr) return true;
      const normName = normalizeAttrKey(attrName);
      return (
        normFilters.some((f) => normName === f || normName.includes(f) || f.includes(normName)) ||
        attrFilters.some((f) => attrName.toLowerCase().includes(f.toLowerCase()))
      );
    };

    const getUnitForAttr = (assetAttrs: any[] = [], attrName: string, defaultUnit: string = '') => {
      const norm = normalizeAttrKey(attrName);
      const found = assetAttrs.find((a) => a.name && normalizeAttrKey(a.name) === norm);
      if (found?.unit) return found.unit;
      if (norm === 'temperature') return '°C';
      if (norm === 'humidity') return '%';
      if (norm === 'voltage') return 'mV';
      if (norm === 'battery') return '%';
      if (norm === 'rssi') return 'dBm';
      if (norm.startsWith('accel')) return 'mg';
      if (norm === 'pitch' || norm === 'roll') return '°';
      return defaultUnit;
    };

    const results: any[] = [];
    const recordSet = new Set<string>();

    // 1. Query TelemetryLog (dynamic attributes - numbers, booleans, strings)
    try {
      const dynamicLogs = (await (this.prisma as any).telemetryLog.findMany({
        where: whereClause,
        orderBy: { timestamp: 'desc' },
        take: limitNum,
      })) as any[];

      dynamicLogs.forEach((row: any) => {
        const rawVal = row.strValue !== null && row.strValue !== undefined ? row.strValue : row.value;
        if (rawVal === null || rawVal === undefined) return;
        if (!matchesFilter(row.attrName)) return;

        let displayValue: any = rawVal;
        if (rawVal === 'true' || rawVal === 'false' || typeof rawVal === 'boolean') {
          displayValue = rawVal === 'true' || rawVal === true;
        } else if (!isNaN(Number(rawVal)) && String(rawVal).trim() !== '') {
          displayValue = Number(rawVal);
        }

        const assetInfo = assetByTagMap.get(row.tagId) || { id: '', name: `Tag [${row.tagId}]`, type: 'UNKNOWN', attributes: [] };
        const ts = row.timestamp ? new Date(row.timestamp).toISOString() : new Date().toISOString();
        const key = `${row.tagId}-${new Date(row.timestamp).getTime()}-${normalizeAttrKey(row.attrName)}`;

        if (!recordSet.has(key)) {
          recordSet.add(key);
          results.push({
            id: `${row.tagId}-${new Date(row.timestamp).getTime()}-${row.attrName}`,
            timestamp: ts,
            tagId: row.tagId,
            assetId: assetInfo.id,
            assetName: assetInfo.name,
            assetType: assetInfo.type,
            attribute: row.attrName,
            value: displayValue,
            unit: getUnitForAttr(assetInfo.attributes, row.attrName),
          });
        }
      });
    } catch (e) {}

    // 2. Query Telemetry table (legacy / standard fields)
    const rawLogs = (await this.prisma.telemetry.findMany({
      where: whereClause,
      orderBy: { timestamp: 'desc' },
      take: limitNum,
    })) as any[];

    rawLogs.forEach((row: any) => {
      const assetInfo = assetByTagMap.get(row.tagId) || { id: '', name: `Tag [${row.tagId}]`, type: 'UNKNOWN', attributes: [] };
      const ts = row.timestamp ? new Date(row.timestamp).toISOString() : new Date().toISOString();

      const addAttr = (attrName: string, val: any, defaultUnit: string) => {
        if (val === null || val === undefined) return;
        if (!matchesFilter(attrName)) return;

        let displayValue: any = val;
        if (val === 'true' || val === 'false' || typeof val === 'boolean') {
          displayValue = val === 'true' || val === true;
        } else if (!isNaN(Number(val)) && String(val).trim() !== '') {
          displayValue = Number(val);
        }

        const key = `${row.tagId}-${new Date(row.timestamp).getTime()}-${normalizeAttrKey(attrName)}`;
        if (!recordSet.has(key)) {
          recordSet.add(key);
          results.push({
            id: `${row.tagId}-${new Date(row.timestamp).getTime()}-${attrName}`,
            timestamp: ts,
            tagId: row.tagId,
            assetId: assetInfo.id,
            assetName: assetInfo.name,
            assetType: assetInfo.type,
            attribute: attrName,
            value: displayValue,
            unit: getUnitForAttr(assetInfo.attributes, attrName, defaultUnit),
          });
        }
      };

      addAttr('temperature', row.temperature, '°C');
      addAttr('humidity', row.humidity, '%');

      const hasVoltageAttr = assetInfo.attributes?.some((a) => normalizeAttrKey(a.name || '') === 'voltage');
      if (hasVoltageAttr) {
        addAttr('voltage', row.battery, 'mV');
      } else {
        addAttr('battery', row.battery, '%');
      }

      addAttr('rssi', row.rssi, 'dBm');
      addAttr('accelX', row.accelX, 'mg');
      addAttr('accelY', row.accelY, 'mg');
      addAttr('accelZ', row.accelZ, 'mg');
      addAttr('pitch', row.pitch, '°');
      addAttr('roll', row.roll, '°');
    });

    // 3. Registered static/current attributes from asset.description JSON
    tenantAssets.forEach((a) => {
      if (a.description) {
        try {
          const desc = JSON.parse(a.description);
          if (Array.isArray(desc.attributes)) {
            desc.attributes.forEach((at: any) => {
              if (at.name && at.value !== undefined && at.value !== null) {
                if (!matchesFilter(at.name)) return;
                const tagId = a.tagId || a.id;
                const ts = at.lastUpdated
                  ? new Date(at.lastUpdated).toISOString()
                  : a.updatedAt
                  ? new Date(a.updatedAt).toISOString()
                  : new Date().toISOString();
                const key = `${tagId}-${new Date(ts).getTime()}-${normalizeAttrKey(at.name)}`;
                if (!recordSet.has(key)) {
                  recordSet.add(key);
                  results.push({
                    id: `${tagId}-${new Date(ts).getTime()}-${at.name}`,
                    timestamp: ts,
                    tagId: tagId,
                    assetId: a.id,
                    assetName: a.name,
                    assetType: a.type,
                    attribute: at.name,
                    value: at.value,
                    unit: at.unit || getUnitForAttr(desc.attributes, at.name),
                  });
                }
              }
            });
          }
        } catch (e) {}
      }
    });

    results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return results.slice(0, limitNum);
  }

  async getAnchors(tenantId: string) {
    const assetAnchors = await this.prisma.asset.findMany({
      where: { tenantId, type: 'ANCHOR' },
    });

    const tableAnchors = await this.prisma.anchor.findMany({
      where: { tenantId },
    });

    const mappedAssetAnchors = assetAnchors.map(a => {
      let anchorId = a.name;
      try {
        if (a.description && a.description.startsWith('{')) {
          const parsed = JSON.parse(a.description);
          anchorId = parsed.attributes?.find((at: any) => at.name === 'anchorId')?.value || a.name;
        }
      } catch (e) {}

      return {
        id: a.id,
        name: a.name,
        x: a.latitude !== null ? Number(a.latitude) : 10,
        y: a.longitude !== null ? Number(a.longitude) : 10,
        anchorId,
      };
    });

    const mappedTableAnchors = tableAnchors.map(a => ({
      id: a.id,
      name: a.name,
      x: a.x !== null ? Number(a.x) : 20,
      y: a.y !== null ? Number(a.y) : 20,
      anchorId: a.id,
    }));

    return [...mappedAssetAnchors, ...mappedTableAnchors];
  }

  async sendCommand(
    tenantId: string,
    id: string,
    body: { attributeName?: string; publishTopic?: string; payload: any; agentId?: string },
  ) {
    const asset = await this.findOne(tenantId, id);
    if (!asset) {
      throw new NotFoundException(`Asset with ID "${id}" not found.`);
    }

    let publishTopic = body.publishTopic;
    let agentId = body.agentId;
    let attributeName = body.attributeName;

    let parsedDesc: any = {};
    if (asset.description && asset.description.startsWith('{')) {
      try {
        parsedDesc = JSON.parse(asset.description);
      } catch (e) {}
    }

    if (!agentId && parsedDesc.mqttAgentId) {
      agentId = parsedDesc.mqttAgentId;
    }

    if (!publishTopic && attributeName && parsedDesc.attributes && Array.isArray(parsedDesc.attributes)) {
      const matchedAttr = parsedDesc.attributes.find((a: any) => a.name === attributeName);
      if (matchedAttr && matchedAttr.mqttPublishTopic) {
        publishTopic = matchedAttr.mqttPublishTopic;
      }
    }

    if (!publishTopic && parsedDesc.mqttPublishTopic) {
      publishTopic = parsedDesc.mqttPublishTopic;
    }

    if (!publishTopic) {
      publishTopic = `commands/${asset.name.toLowerCase()}/${attributeName || 'downlink'}`;
    }

    // Update attribute value and lastUpdated timestamp in description
    if (attributeName && parsedDesc.attributes && Array.isArray(parsedDesc.attributes)) {
      const nowIso = new Date().toISOString();
      let updated = false;
      parsedDesc.attributes = parsedDesc.attributes.map((a: any) => {
        if (a.name === attributeName) {
          updated = true;
          return { ...a, value: body.payload, lastUpdated: nowIso };
        }
        return a;
      });
      if (!updated) {
        parsedDesc.attributes.push({
          name: attributeName,
          value: body.payload,
          lastUpdated: nowIso,
        });
      }

      await this.prisma.asset.update({
        where: { id },
        data: { description: JSON.stringify(parsedDesc) },
      });
    }

    // Save to dynamic TelemetryLog if applicable
    if (attributeName && asset.tagId) {
      try {
        const valNum = typeof body.payload === 'number' ? body.payload : parseFloat(String(body.payload));
        await (this.prisma as any).telemetryLog.create({
          data: {
            tenantId,
            tagId: asset.tagId,
            attribute: attributeName,
            value: isNaN(valNum) ? 0 : valNum,
            timestamp: new Date(),
          },
        });
      } catch (e) {
        // Ignore telemetry log insert error for non-numeric commands
      }
    }

    // Publish to MQTT broker via MqttService
    let publishResult: any = { success: false, message: 'MQTT Service not available' };
    if (this.mqttService) {
      try {
        publishResult = await this.mqttService.publishMessage(publishTopic, body.payload, agentId);
      } catch (err: any) {
        this.logger.warn(`MQTT publish error for topic ${publishTopic}: ${err.message}`);
        throw new BadRequestException(`Gagal mempublish command ke MQTT topic "${publishTopic}": ${err.message}`);
      }
    }

    return {
      success: true,
      topic: publishTopic,
      payload: body.payload,
      message: `Successfully published command to MQTT topic "${publishTopic}".`,
    };
  }
}
