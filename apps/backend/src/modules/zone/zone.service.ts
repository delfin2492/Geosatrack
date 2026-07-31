import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ZoneService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    tenantId: string,
    siteId: string,
    name: string,
    floorPlanUrl?: string,
    width?: number,
    height?: number,
  ) {
    // 1. Verify Site belongs to Tenant
    const site = await this.prisma.site.findFirst({
      where: { id: siteId, tenantId },
    });
    if (!site) {
      throw new NotFoundException(`Site with ID "${siteId}" not found for this tenant.`);
    }

    return this.prisma.zone.create({
      data: {
        name,
        floorPlanUrl,
        width: width ?? 100.0,
        height: height ?? 100.0,
        siteId,
      },
    });
  }

  async findAll(tenantId: string, siteId?: string) {
    return this.prisma.zone.findMany({
      where: {
        site: {
          tenantId,
          id: siteId ? siteId : undefined,
        },
      },
      include: {
        site: {
          select: {
            name: true,
          },
        },
        _count: {
          select: {
            anchors: true,
            assets: true,
          },
        },
      },
    });
  }

  async findOne(tenantId: string, id: string) {
    const zone = await this.prisma.zone.findFirst({
      where: {
        id,
        site: { tenantId },
      },
      include: {
        site: true,
        anchors: true,
        assets: {
          include: {
            tag: true,
          },
        },
      },
    });
    if (!zone) {
      throw new NotFoundException(`Zone with ID "${id}" not found for this tenant.`);
    }
    return zone;
  }

  async update(
    tenantId: string,
    id: string,
    name?: string,
    floorPlanUrl?: string,
    width?: number,
    height?: number,
  ) {
    await this.findOne(tenantId, id); // Verify ownership

    return this.prisma.zone.update({
      where: { id },
      data: {
        name: name !== undefined ? name : undefined,
        floorPlanUrl: floorPlanUrl !== undefined ? floorPlanUrl : undefined,
        width: width !== undefined ? width : undefined,
        height: height !== undefined ? height : undefined,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id); // Verify ownership
    return this.prisma.zone.delete({
      where: { id },
    });
  }
}
