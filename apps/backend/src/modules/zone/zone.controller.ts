import { Controller, Get, Post, Body, Param, Patch, Delete, Query } from '@nestjs/common';
import { ZoneService } from './zone.service';
import { GetTenantId } from '../../common/decorators/get-tenant-id.decorator';
import { ApiTags, ApiHeader } from '@nestjs/swagger';

@ApiTags('zones')
@ApiHeader({
  name: 'x-tenant-id',
  description: 'Tenant Identifier for multi-tenant isolation',
  required: true,
})
@Controller('zones')
export class ZoneController {
  constructor(private readonly zoneService: ZoneService) {}

  @Post()
  create(
    @GetTenantId() tenantId: string,
    @Body('siteId') siteId: string,
    @Body('name') name: string,
    @Body('floorPlanUrl') floorPlanUrl?: string,
    @Body('width') width?: number,
    @Body('height') height?: number,
  ) {
    return this.zoneService.create(tenantId, siteId, name, floorPlanUrl, width, height);
  }

  @Get()
  findAll(
    @GetTenantId() tenantId: string,
    @Query('siteId') siteId?: string,
  ) {
    return this.zoneService.findAll(tenantId, siteId);
  }

  @Get(':id')
  findOne(@GetTenantId() tenantId: string, @Param('id') id: string) {
    return this.zoneService.findOne(tenantId, id);
  }

  @Patch(':id')
  update(
    @GetTenantId() tenantId: string,
    @Param('id') id: string,
    @Body('name') name?: string,
    @Body('floorPlanUrl') floorPlanUrl?: string,
    @Body('width') width?: number,
    @Body('height') height?: number,
  ) {
    return this.zoneService.update(tenantId, id, name, floorPlanUrl, width, height);
  }

  @Delete(':id')
  remove(@GetTenantId() tenantId: string, @Param('id') id: string) {
    return this.zoneService.remove(tenantId, id);
  }
}
