import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

import { WebsocketGateway } from '../websocket/websocket.gateway';

@Injectable()
export class AssetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly websocketGateway: WebsocketGateway,
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
}
