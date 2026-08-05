import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AssetService {
  constructor(private readonly prisma: PrismaService) {}

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

    return this.prisma.asset.create({
      data: {
        name,
        description,
        type: type ?? 'FORKLIFT',
        status: status ?? 'static',
        latitude: latitude !== undefined ? latitude : null,
        longitude: longitude !== undefined ? longitude : null,
        tenantId,
        zoneId: zoneId || null,
        tagId: tagId || null,
        parentId: parentId || null,
      },
    });
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
    const asset = await this.findOne(tenantId, id); // Verify ownership

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

    return this.prisma.asset.update({
      where: { id },
      data: {
        name: name !== undefined ? name : undefined,
        description: description !== undefined ? description : undefined,
        status: status !== undefined ? status : undefined,
        zoneId: zoneId !== undefined ? zoneId : undefined,
        tagId: tagId !== undefined ? tagId : undefined,
        type: type !== undefined ? type : undefined,
        latitude: latitude !== undefined ? latitude : undefined,
        longitude: longitude !== undefined ? longitude : undefined,
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

  async getTelemetryHistory(
    tenantId: string,
    assetId: string,
    attributeName: string,
    range: string,
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
    const now = new Date();
    let startDate = new Date(now.getTime() - 60 * 60 * 1000); // default last 1 hour
    if (range === '6h') {
      startDate = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    } else if (range === '24h') {
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    } else if (range === '7d') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (range === '30d') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Map attribute name to schema field name
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
        timestamp: {
          gte: startDate,
        },
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
}
