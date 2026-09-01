import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RuleService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, name: string, ruleType: string, flowGraph?: string, ruleConfig?: string) {
    return this.prisma.ruleFlow.create({
      data: {
        name,
        ruleType: ruleType || 'FLOW',
        flowGraph,
        ruleConfig,
        tenantId,
      },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.ruleFlow.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const rule = await this.prisma.ruleFlow.findFirst({
      where: { id, tenantId },
    });
    if (!rule) {
      throw new NotFoundException(`Rule with ID "${id}" not found.`);
    }
    return rule;
  }

  async update(
    tenantId: string,
    id: string,
    data: { name?: string; isActive?: boolean; ruleType?: string; flowGraph?: string; ruleConfig?: string },
  ) {
    const rule = await this.findOne(tenantId, id);
    return this.prisma.ruleFlow.update({
      where: { id: rule.id },
      data: {
        name: data.name ?? undefined,
        isActive: data.isActive ?? undefined,
        ruleType: data.ruleType ?? undefined,
        flowGraph: data.flowGraph ?? undefined,
        ruleConfig: data.ruleConfig ?? undefined,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    const rule = await this.findOne(tenantId, id);
    return this.prisma.ruleFlow.delete({
      where: { id: rule.id },
    });
  }

  async getLogs(tenantId: string, ruleId: string) {
    const rule = await this.findOne(tenantId, ruleId);
    return this.prisma.ruleLog.findMany({
      where: { ruleId: rule.id },
      orderBy: { createdAt: 'desc' },
      take: 50, // limit to last 50 logs
    });
  }

  async createLog(ruleId: string, status: 'SUCCESS' | 'FAILED' | 'RECOVERED' | string, message: string) {
    return this.prisma.ruleLog.create({
      data: {
        ruleId,
        status,
        message,
      },
    });
  }
}
