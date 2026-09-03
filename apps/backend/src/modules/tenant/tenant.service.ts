import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  async create(name: string, status: string = 'active', agentLimit: number = 5, assetLimit: number = 100, isWhiteLabel: boolean = false) {
    const existing = await this.prisma.tenant.findUnique({
      where: { name },
    });
    if (existing) {
      throw new ConflictException(`Tenant with name "${name}" already exists.`);
    }
    return this.prisma.tenant.create({
      data: { name, status, agentLimit, assetLimit, isWhiteLabel },
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

  async update(id: string, data: { name?: string; status?: string; agentLimit?: number; assetLimit?: number; isWhiteLabel?: boolean }) {
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

  // ─── White-Label Settings ───────────────────────────────────────────
  async updateWhiteLabelSettings(
    tenantId: string,
    data: {
      themeColor?: string;
      smtpHost?: string;
      smtpPort?: number;
      smtpUser?: string;
      smtpPass?: string;
      smtpFrom?: string;
      telegramBotToken?: string;
      telegramChatId?: string;
    },
    files?: { logo?: Express.Multer.File[]; favicon?: Express.Multer.File[] },
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException(`Tenant "${tenantId}" not found.`);

    if (!tenant.isWhiteLabel) {
      throw new BadRequestException('Fitur White-Label belum diaktifkan untuk Tenant ini.');
    }

    const fs = await import('fs');
    const path = await import('path');
    const updatePayload: any = {};

    if (files?.logo && files.logo[0]) {
      const logoFile = files.logo[0];
      const uploadDir = path.join(process.cwd(), 'uploads', 'logos');
      fs.mkdirSync(uploadDir, { recursive: true });
      const ext = path.extname(logoFile.originalname) || '.png';
      const filename = `logo-${tenantId}-${Date.now()}${ext}`;
      fs.writeFileSync(path.join(uploadDir, filename), logoFile.buffer);
      updatePayload.logoUrl = `/uploads/logos/${filename}`;
    }

    if (files?.favicon && files.favicon[0]) {
      const faviconFile = files.favicon[0];
      const uploadDir = path.join(process.cwd(), 'uploads', 'favicons');
      fs.mkdirSync(uploadDir, { recursive: true });
      const ext = path.extname(faviconFile.originalname) || '.png';
      const filename = `favicon-${tenantId}-${Date.now()}${ext}`;
      fs.writeFileSync(path.join(uploadDir, filename), faviconFile.buffer);
      updatePayload.faviconUrl = `/uploads/favicons/${filename}`;
    }

    if (data.themeColor !== undefined) updatePayload.themeColor = data.themeColor;
    if (data.smtpHost !== undefined) updatePayload.smtpHost = data.smtpHost;
    if (data.smtpPort !== undefined) updatePayload.smtpPort = data.smtpPort ? Number(data.smtpPort) : null;
    if (data.smtpUser !== undefined) updatePayload.smtpUser = data.smtpUser;
    if (data.smtpPass !== undefined && data.smtpPass !== '') updatePayload.smtpPass = data.smtpPass;
    if (data.smtpFrom !== undefined) updatePayload.smtpFrom = data.smtpFrom;
    if (data.telegramBotToken !== undefined) updatePayload.telegramBotToken = data.telegramBotToken;
    if (data.telegramChatId !== undefined) updatePayload.telegramChatId = data.telegramChatId;

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: updatePayload,
    });

    return {
      message: 'Pengaturan White-Label berhasil disimpan.',
      tenant: updated,
    };
  }

  // ─── Profile Settings ───────────────────────────────────────────────
  async updateProfile(
    tenantId: string,
    data: { name?: string; adminEmail?: string },
    files?: { logo?: Express.Multer.File[]; favicon?: Express.Multer.File[]; avatar?: Express.Multer.File[] },
    userId?: string,
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException(`Tenant "${tenantId}" not found.`);

    const fs = await import('fs');
    const path = await import('path');
    const updatePayload: any = {};

    // Save uploaded logo file
    if (files?.logo && files.logo[0]) {
      const logoFile = files.logo[0];
      const uploadDir = path.join(process.cwd(), 'uploads', 'logos');
      fs.mkdirSync(uploadDir, { recursive: true });
      const ext = path.extname(logoFile.originalname) || '.png';
      const filename = `logo-${tenantId}-${Date.now()}${ext}`;
      fs.writeFileSync(path.join(uploadDir, filename), logoFile.buffer);
      updatePayload.logoUrl = `/uploads/logos/${filename}`;
    }

    // Save uploaded favicon file
    if (files?.favicon && files.favicon[0]) {
      const faviconFile = files.favicon[0];
      const uploadDir = path.join(process.cwd(), 'uploads', 'favicons');
      fs.mkdirSync(uploadDir, { recursive: true });
      const ext = path.extname(faviconFile.originalname) || '.png';
      const filename = `favicon-${tenantId}-${Date.now()}${ext}`;
      fs.writeFileSync(path.join(uploadDir, filename), faviconFile.buffer);
      updatePayload.faviconUrl = `/uploads/favicons/${filename}`;
    }

    if (data.name) updatePayload.name = data.name;
    if (data.adminEmail) updatePayload.adminEmail = data.adminEmail;

    const updatedTenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: updatePayload,
    });

    // Save uploaded avatar file for user
    let userAvatarUrl: string | undefined;
    if (files?.avatar && files.avatar[0]) {
      const avatarFile = files.avatar[0];
      const uploadDir = path.join(process.cwd(), 'uploads', 'avatars');
      fs.mkdirSync(uploadDir, { recursive: true });
      const ext = path.extname(avatarFile.originalname) || '.png';
      const filename = `avatar-${tenantId}-${Date.now()}${ext}`;
      fs.writeFileSync(path.join(uploadDir, filename), avatarFile.buffer);
      userAvatarUrl = `/uploads/avatars/${filename}`;

      // Update user avatar
      let targetUser = userId ? await this.prisma.user.findUnique({ where: { id: userId } }) : null;
      if (!targetUser) {
        targetUser = await this.prisma.user.findFirst({
          where: { tenantId, role: 'tenant_admin' },
        });
      }
      if (targetUser) {
        await this.prisma.user.update({
          where: { id: targetUser.id },
          data: { avatarUrl: userAvatarUrl },
        });
      }
    }

    // Also update admin user email if provided
    if (data.adminEmail) {
      const adminUser = await this.prisma.user.findFirst({
        where: { tenantId, role: 'tenant_admin' },
      });
      if (adminUser && adminUser.email !== data.adminEmail) {
        const existingUser = await this.prisma.user.findUnique({
          where: { email: data.adminEmail },
        });
        if (existingUser && existingUser.id !== adminUser.id) {
          throw new ConflictException(`Email "${data.adminEmail}" sudah terdaftar pada pengguna lain.`);
        }
        await this.prisma.user.update({
          where: { id: adminUser.id },
          data: { email: data.adminEmail },
        });
      }
    }

    return {
      message: 'Profile updated successfully.',
      tenant: updatedTenant,
      userAvatarUrl,
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
