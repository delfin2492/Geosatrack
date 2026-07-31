import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  async create(name: string) {
    const existing = await this.prisma.tenant.findUnique({
      where: { name },
    });
    if (existing) {
      throw new ConflictException(`Tenant with name "${name}" already exists.`);
    }
    return this.prisma.tenant.create({
      data: { name },
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

  async update(id: string, name: string) {
    await this.findOne(id);
    const existing = await this.prisma.tenant.findFirst({
      where: { name, NOT: { id } },
    });
    if (existing) {
      throw new ConflictException(`Tenant with name "${name}" already exists.`);
    }
    return this.prisma.tenant.update({
      where: { id },
      data: { name },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.tenant.delete({
      where: { id },
    });
  }
}
