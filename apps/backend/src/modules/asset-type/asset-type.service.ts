import { Injectable, OnModuleInit, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export const DEFAULT_ASSET_TYPES = [
  { code: 'ANCHOR', name: 'Anchor Node', icon: 'MapPin', color: '#f43f5e', description: 'Fixed position gateway/anchor', isSystem: true },
  { code: 'TAG', name: 'BLE Tag / Tracker', icon: 'HardDrive', color: '#3b82f6', description: 'Mobile tracking tag device', isSystem: true },
  { code: 'MESH_EYE_SENSOR', name: 'Mesh Eye Sensor', icon: 'Activity', color: '#10b981', description: 'Environmental and motion sensor node', isSystem: true },
  { code: 'FORKLIFT', name: 'Forklift / Cargo', icon: 'Boxes', color: '#d97706', description: 'Heavy machinery and cargo equipment', isSystem: true },
  { code: 'LIGHT', name: 'Light / Machine', icon: 'Sliders', color: '#eab308', description: 'Industrial machines and smart lighting', isSystem: true },
  { code: 'BUILDING', name: 'Building / Room', icon: 'Folder', color: '#8b5cf6', description: 'Infrastructure facilities and rooms', isSystem: true },
  { code: 'CITY', name: 'City / Weather', icon: 'Globe', color: '#06b6d4', description: 'Geographic and weather assets', isSystem: true },
  { code: 'CAR', name: 'Vehicle / Car', icon: 'Car', color: '#0284c7', description: 'Motorized transport vehicles', isSystem: true },
  { code: 'AGENT_MQTT_TELTONIKA', name: 'Teltonika Agent', icon: 'Cpu', color: '#6366f1', description: 'Teltonika gateway agent', isSystem: true },
  { code: 'AGENT_MQTT_GENERIC', name: 'Generic MQTT Agent', icon: 'Radio', color: '#8b5cf6', description: 'Generic MQTT telemetry agent', isSystem: true },
];

export class CreateAssetTypeDto {
  code: string;
  name: string;
  icon?: string;
  color?: string;
  description?: string;
}

export class UpdateAssetTypeDto {
  name?: string;
  icon?: string;
  color?: string;
  description?: string;
}

@Injectable()
export class AssetTypeService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedDefaultTypes();
  }

  async seedDefaultTypes() {
    for (const item of DEFAULT_ASSET_TYPES) {
      const existing = await this.prisma.assetType.findFirst({
        where: { code: item.code, tenantId: null },
      });
      if (!existing) {
        await this.prisma.assetType.create({
          data: { ...item, tenantId: null },
        });
      }
    }
  }

  async findAll(tenantId?: string) {
    let globalTypes = await this.prisma.assetType.findMany({
      where: { tenantId: null },
      orderBy: { name: 'asc' },
    });

    if (globalTypes.length === 0) {
      await this.seedDefaultTypes();
      globalTypes = await this.prisma.assetType.findMany({
        where: { tenantId: null },
        orderBy: { name: 'asc' },
      });
    }

    if (!tenantId) {
      return globalTypes;
    }

    const tenantTypes = await this.prisma.assetType.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });

    const typeMap = new Map<string, any>();
    globalTypes.forEach((gt) => typeMap.set(gt.code, gt));
    tenantTypes.forEach((tt) => typeMap.set(tt.code, tt));

    return Array.from(typeMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  async findOne(id: string) {
    const item = await this.prisma.assetType.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Asset type not found.');
    return item;
  }

  async create(data: CreateAssetTypeDto, tenantId?: string) {
    const codeUpper = data.code.toUpperCase().trim();
    const effectiveTenantId = tenantId || null;

    const existing = await this.prisma.assetType.findFirst({
      where: { code: codeUpper, tenantId: effectiveTenantId },
    });

    if (existing) {
      throw new BadRequestException(`Asset type code '${codeUpper}' already exists.`);
    }

    return this.prisma.assetType.create({
      data: {
        code: codeUpper,
        name: data.name,
        icon: data.icon || 'HardDrive',
        color: data.color || '#3b82f6',
        description: data.description || null,
        isSystem: false,
        tenantId: effectiveTenantId,
      },
    });
  }

  async update(id: string, data: UpdateAssetTypeDto, tenantId?: string) {
    const existing = await this.prisma.assetType.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Asset type not found.');

    if (existing.tenantId === null && tenantId) {
      const existingTenantCopy = await this.prisma.assetType.findFirst({
        where: { code: existing.code, tenantId },
      });

      if (existingTenantCopy) {
        return this.prisma.assetType.update({
          where: { id: existingTenantCopy.id },
          data: {
            name: data.name ?? existingTenantCopy.name,
            icon: data.icon ?? existingTenantCopy.icon,
            color: data.color ?? existingTenantCopy.color,
            description: data.description ?? existingTenantCopy.description,
          },
        });
      }

      return this.prisma.assetType.create({
        data: {
          code: existing.code,
          name: data.name ?? existing.name,
          icon: data.icon ?? existing.icon,
          color: data.color ?? existing.color,
          description: data.description ?? existing.description,
          isSystem: existing.isSystem,
          tenantId: tenantId,
        },
      });
    }

    return this.prisma.assetType.update({
      where: { id },
      data: {
        name: data.name ?? existing.name,
        icon: data.icon ?? existing.icon,
        color: data.color ?? existing.color,
        description: data.description ?? existing.description,
      },
    });
  }

  async remove(id: string, tenantId?: string) {
    const existing = await this.prisma.assetType.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Asset type not found.');

    if (existing.isSystem) {
      throw new BadRequestException('Sistem default asset type tidak dapat dihapus.');
    }

    if (existing.tenantId && tenantId && existing.tenantId !== tenantId) {
      throw new ForbiddenException('Akses ditolak.');
    }

    return this.prisma.assetType.delete({ where: { id } });
  }
}
