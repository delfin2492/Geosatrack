import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AlertService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, startDate?: string, endDate?: string, unresolvedOnly?: boolean) {
    const where: any = { tenantId };

    if (unresolvedOnly) {
      where.isResolved = false;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    return this.prisma.alert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { asset: true }
    });
  }

  async resolve(tenantId: string, alertId: string) {
    const alert = await this.prisma.alert.findFirst({
      where: { id: alertId, tenantId },
    });

    if (!alert) {
      throw new NotFoundException(`Alert "${alertId}" not found for this tenant.`);
    }

    return this.prisma.alert.update({
      where: { id: alertId },
      data: { isResolved: true, resolvedAt: new Date() },
    });
  }

  async remove(tenantId: string, alertId: string) {
    const alert = await this.prisma.alert.findFirst({
      where: { id: alertId, tenantId },
    });

    if (!alert) {
      throw new NotFoundException(`Alert "${alertId}" not found for this tenant.`);
    }

    return this.prisma.alert.delete({
      where: { id: alertId },
    });
  }

  async removeAll(tenantId: string) {
    return this.prisma.alert.deleteMany({
      where: { tenantId },
    });
  }
}
