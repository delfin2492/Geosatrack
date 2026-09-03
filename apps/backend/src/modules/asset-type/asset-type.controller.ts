import {
  Controller, Get, Post, Patch, Delete, Body, Param, Headers, ForbiddenException, BadRequestException
} from '@nestjs/common';
import { AssetTypeService, CreateAssetTypeDto, UpdateAssetTypeDto } from './asset-type.service';

@Controller('asset-types')
export class AssetTypeController {
  constructor(private readonly assetTypeService: AssetTypeService) {}

  private checkAccess(userRole?: string) {
    if (userRole && !['superadmin', 'tenant_admin', 'admin'].includes(userRole.toLowerCase())) {
      throw new ForbiddenException('Akses ditolak untuk mengelola konfigurasi tipe asset.');
    }
  }

  @Get()
  findAll(@Headers('x-tenant-id') tenantId?: string) {
    return this.assetTypeService.findAll(tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.assetTypeService.findOne(id);
  }

  @Post()
  create(
    @Headers('x-user-role') userRole: string,
    @Headers('x-tenant-id') tenantId: string,
    @Body() body: CreateAssetTypeDto,
  ) {
    this.checkAccess(userRole);
    if (!body.code || !body.name) {
      throw new BadRequestException('Code dan name wajib diisi.');
    }
    const effectiveTenantId = userRole === 'superadmin' ? undefined : tenantId;
    return this.assetTypeService.create(body, effectiveTenantId);
  }

  @Patch(':id')
  update(
    @Headers('x-user-role') userRole: string,
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() body: UpdateAssetTypeDto,
  ) {
    this.checkAccess(userRole);
    const effectiveTenantId = userRole === 'superadmin' ? undefined : tenantId;
    return this.assetTypeService.update(id, body, effectiveTenantId);
  }

  @Delete(':id')
  remove(
    @Headers('x-user-role') userRole: string,
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    this.checkAccess(userRole);
    const effectiveTenantId = userRole === 'superadmin' ? undefined : tenantId;
    return this.assetTypeService.remove(id, effectiveTenantId);
  }
}
