import { Controller, Get, Post, Body, Param, Patch, Delete, Query } from '@nestjs/common';
import { AssetService } from './asset.service';
import { GetTenantId } from '../../common/decorators/get-tenant-id.decorator';
import { ApiTags, ApiHeader } from '@nestjs/swagger';

@ApiTags('assets')
@ApiHeader({
  name: 'x-tenant-id',
  description: 'Tenant Identifier for multi-tenant isolation',
  required: true,
})
@Controller('assets')
export class AssetController {
  constructor(private readonly assetService: AssetService) {}

  @Post()
  create(
    @GetTenantId() tenantId: string,
    @Body()
    body: {
      name: string;
      description?: string;
      status?: string;
      zoneId?: string;
      tagId?: string;
    },
  ) {
    return this.assetService.create(tenantId, body);
  }

  @Get()
  findAll(
    @GetTenantId() tenantId: string,
    @Query('status') status?: string,
    @Query('zoneId') zoneId?: string,
    @Query('siteId') siteId?: string,
    @Query('search') search?: string,
  ) {
    return this.assetService.findAll(tenantId, { status, zoneId, siteId, search });
  }

  @Get(':id')
  findOne(@GetTenantId() tenantId: string, @Param('id') id: string) {
    return this.assetService.findOne(tenantId, id);
  }

  @Patch(':id')
  update(
    @GetTenantId() tenantId: string,
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      description?: string;
      status?: string;
      zoneId?: string | null;
      tagId?: string | null;
    },
  ) {
    return this.assetService.update(tenantId, id, body);
  }

  @Delete(':id')
  remove(@GetTenantId() tenantId: string, @Param('id') id: string) {
    return this.assetService.remove(tenantId, id);
  }

  @Post(':id/link-tag')
  linkTag(
    @GetTenantId() tenantId: string,
    @Param('id') id: string,
    @Body('tagId') tagId: string,
  ) {
    return this.assetService.linkTag(tenantId, id, tagId);
  }

  @Post(':id/unlink-tag')
  unlinkTag(@GetTenantId() tenantId: string, @Param('id') id: string) {
    return this.assetService.unlinkTag(tenantId, id);
  }
}
