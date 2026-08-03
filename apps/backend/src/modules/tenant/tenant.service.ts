import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  async create(name: string, status: string = 'active', agentLimit: number = 5, assetLimit: number = 100) {
    const existing = await this.prisma.tenant.findUnique({
      where: { name },
    });
    if (existing) {
      throw new ConflictException(`Tenant with name "${name}" already exists.`);
    }
    return this.prisma.tenant.create({
      data: { name, status, agentLimit, assetLimit },
    });
  }

  async registerTenant(dto: { 
    companyName: string; 
    adminName: string; 
    adminEmail: string; 
    password?: string;
    agentLimit?: number;
    assetLimit?: number;
  }) {
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { name: dto.companyName },
    });
    if (existingTenant) {
      throw new ConflictException(`Company / Tenant "${dto.companyName}" is already registered.`);
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.adminEmail },
    });
    if (existingUser) {
      throw new ConflictException(`User email "${dto.adminEmail}" is already registered.`);
    }

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.companyName,
          status: 'active',
          agentLimit: dto.agentLimit ?? 5,
          assetLimit: dto.assetLimit ?? 100,
        },
      });

      const site = await tx.site.create({
        data: {
          name: 'Headquarters',
          address: 'Main Facility',
          tenantId: tenant.id,
        },
      });

      const zone = await tx.zone.create({
        data: {
          name: 'Main Storage & Operations',
          width: 50.0,
          height: 30.0,
          siteId: site.id,
        },
      });

      const user = await tx.user.create({
        data: {
          email: dto.adminEmail,
          name: dto.adminName,
          role: 'tenant_admin',
          tenantId: tenant.id,
        },
      });

      return {
        message: 'Tenant and Admin user successfully registered',
        tenant,
        site,
        zone,
        user,
      };
    });
  }

  async findAll() {
    return this.prisma.tenant.findMany({
      include: {
        _count: {
          select: {
            sites: true,
            assets: true,
            users: true,
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        sites: true,
        users: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
      },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant with ID "${id}" not found.`);
    }
    return tenant;
  }

  async update(id: string, data: { name?: string; status?: string; agentLimit?: number; assetLimit?: number }) {
    await this.findOne(id);
    if (data.name) {
      const existing = await this.prisma.tenant.findFirst({
        where: { name: data.name, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException(`Tenant with name "${data.name}" already exists.`);
      }
    }
    return this.prisma.tenant.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.tenant.delete({
      where: { id },
    });
  }
}
