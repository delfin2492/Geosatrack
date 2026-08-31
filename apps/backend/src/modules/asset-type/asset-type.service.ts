import { Injectable, OnModuleInit, BadRequestException, NotFoundException } from '@nestjs/common';
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
      await this.prisma.assetType.upsert({
        where: { code: item.code },
        update: {},
        create: item,
      });
    }
  }

  async findAll() {
    const types = await this.prisma.assetType.findMany({
      orderBy: { name: 'asc' },
    });
    if (types.length === 0) {
      await this.seedDefaultTypes();
      return this.prisma.assetType.findMany({ orderBy: { name: 'asc' } });
    }
    return types;
  }

  async findOne(id: string) {
    const item = await this.prisma.assetType.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Asset type not found.');
    return item;
  }

  async create(data: CreateAssetTypeDto) {
    const codeUpper = data.code.toUpperCase().trim();
    const existing = await this.prisma.assetType.findUnique({
      where: { code: codeUpper },
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
      },
    });
  }

  async update(id: string, data: UpdateAssetTypeDto) {
    const existing = await this.prisma.assetType.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Asset type not found.');

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

  async remove(id: string) {
    const existing = await this.prisma.assetType.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Asset type not found.');

    if (existing.isSystem) {
      throw new BadRequestException('Sistem default asset type tidak dapat dihapus.');
    }

    return this.prisma.assetType.delete({ where: { id } });
  }
}
