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
    },
  ) {
    const { name, description, status, zoneId, tagId, type, latitude, longitude } = data;

    // 1. Verify zone if provided
    if (zoneId) {
      const zone = await this.prisma.zone.findFirst({
        where: { id: zoneId, site: { tenantId } },
      });
      if (!zone) {
        throw new NotFoundException(`Zone with ID "${zoneId}" not found for this tenant.`);
      }
    }

    // 2. Verify tag if provided, and check if it's already linked to another asset
    if (tagId) {
      const tag = await this.prisma.tag.findUnique({
        where: { id: tagId },
      });
      if (!tag) {
        throw new NotFoundException(`Tag with ID "${tagId}" not found.`);
      }

      const existingLinkedAsset = await this.prisma.asset.findUnique({
        where: { tagId },
      });
      if (existingLinkedAsset) {
        throw new ConflictException(`Tag "${tagId}" is already linked to another asset.`);
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
    },
  ) {
    const asset = await this.findOne(tenantId, id); // Verify ownership

    const { name, description, status, zoneId, tagId, type, latitude, longitude } = data;

    // Validate Zone
    if (zoneId) {
      const zone = await this.prisma.zone.findFirst({
        where: { id: zoneId, site: { tenantId } },
      });
      if (!zone) {
        throw new NotFoundException(`Zone with ID "${zoneId}" not found for this tenant.`);
      }
    }

    // Validate Tag
    if (tagId && tagId !== asset.tagId) {
      const tag = await this.prisma.tag.findUnique({
        where: { id: tagId },
      });
      if (!tag) {
        throw new NotFoundException(`Tag with ID "${tagId}" not found.`);
      }

      const existingLinkedAsset = await this.prisma.asset.findUnique({
        where: { tagId },
      });
      if (existingLinkedAsset) {
        throw new ConflictException(`Tag "${tagId}" is already linked to another asset.`);
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
}
