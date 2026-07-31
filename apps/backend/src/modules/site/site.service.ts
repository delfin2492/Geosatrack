import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SiteService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, name: string, address?: string) {
    return this.prisma.site.create({
      data: {
        name,
        address,
        tenantId,
      },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.site.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: {
            zones: true,
          },
        },
      },
    });
  }

  async findOne(tenantId: string, id: string) {
    const site = await this.prisma.site.findFirst({
      where: { id, tenantId },
      include: {
        zones: true,
      },
    });
    if (!site) {
      throw new NotFoundException(`Site with ID "${id}" not found for this tenant.`);
    }
    return site;
  }

  async update(tenantId: string, id: string, name?: string, address?: string) {
    await this.findOne(tenantId, id); // Verify ownership
    return this.prisma.site.update({
      where: { id },
      data: {
        name: name !== undefined ? name : undefined,
        address: address !== undefined ? address : undefined,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id); // Verify ownership
    return this.prisma.site.delete({
      where: { id },
    });
  }
}
