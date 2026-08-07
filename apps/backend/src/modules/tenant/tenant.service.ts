import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
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
          password: dto.password,
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

  // ─── Profile Settings ───────────────────────────────────────────────
  async updateProfile(
    tenantId: string,
    data: { name?: string; adminEmail?: string },
    file?: Express.Multer.File,
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException(`Tenant "${tenantId}" not found.`);

    let logoUrl: string | undefined;

    // Save uploaded logo file to disk
    if (file && file.buffer) {
      const fs = await import('fs');
      const path = await import('path');
      const uploadDir = path.join(process.cwd(), 'uploads', 'logos');
      fs.mkdirSync(uploadDir, { recursive: true });
      const ext = path.extname(file.originalname) || '.png';
      const filename = `logo-${tenantId}-${Date.now()}${ext}`;
      fs.writeFileSync(path.join(uploadDir, filename), file.buffer);
      logoUrl = `/uploads/logos/${filename}`;
    }

    const updatePayload: any = {};
    if (data.name) updatePayload.name = data.name;
    if (logoUrl) updatePayload.logoUrl = logoUrl;
    if (data.adminEmail) updatePayload.adminEmail = data.adminEmail;

    const updatedTenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: updatePayload,
    });

    // Also update admin user email if provided
    if (data.adminEmail) {
      const adminUser = await this.prisma.user.findFirst({
        where: { tenantId, role: 'tenant_admin' },
      });
      if (adminUser) {
        await this.prisma.user.update({
          where: { id: adminUser.id },
          data: { email: data.adminEmail },
        });
      }
    }

    return {
      message: 'Profile updated successfully.',
      tenant: updatedTenant,
    };
  }


  // ─── User Management ────────────────────────────────────────────────
  async getTenantUsers(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId, NOT: { role: 'superadmin' } },
      select: {
        id: true,
        email: true,
        role: true,
        isVerified: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createTenantUser(
    tenantId: string,
    data: { email: string; password?: string; role?: string },
  ) {
    const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      throw new ConflictException(`User email "${data.email}" is already registered.`);
    }

    const allowedRoles = ['tenant_admin', 'staff'];
    const role = allowedRoles.includes(data.role || '') ? data.role! : 'staff';

    return this.prisma.user.create({
      data: {
        name: data.email.split('@')[0],
        email: data.email,
        password: data.password,
        role,
        isVerified: true,
        tenantId,
      },
    });
  }

  async updateUserRole(tenantId: string, userId: string, newRole: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
    });
    if (!user) {
      throw new NotFoundException(`User "${userId}" not found in this tenant.`);
    }

    const allowedRoles = ['tenant_admin', 'staff'];
    if (!allowedRoles.includes(newRole)) {
      throw new BadRequestException(`Invalid role "${newRole}".`);
    }

    // Prevent downgrading the last admin
    if (user.role === 'tenant_admin' && newRole !== 'tenant_admin') {
      const adminCount = await this.prisma.user.count({
        where: { tenantId, role: 'tenant_admin' },
      });
      if (adminCount <= 1) {
        throw new BadRequestException('Cannot downgrade the last admin user of this tenant.');
      }
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
    });
  }

  async deleteTenantUser(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
    });
    if (!user) {
      throw new NotFoundException(`User "${userId}" not found in this tenant.`);
    }

    // Prevent deleting the last admin
    if (user.role === 'tenant_admin') {
      const adminCount = await this.prisma.user.count({
        where: { tenantId, role: 'tenant_admin' },
      });
      if (adminCount <= 1) {
        throw new BadRequestException('Cannot delete the last admin user of this tenant.');
      }
    }

    return this.prisma.user.delete({ where: { id: userId } });
  }
}
