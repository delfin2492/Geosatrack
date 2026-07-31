import { Controller, Get, Post, Body, Param, Patch, Delete } from '@nestjs/common';
import { SiteService } from './site.service';
import { GetTenantId } from '../../common/decorators/get-tenant-id.decorator';
import { ApiTags, ApiHeader } from '@nestjs/swagger';

@ApiTags('sites')
@ApiHeader({
  name: 'x-tenant-id',
  description: 'Tenant Identifier for multi-tenant isolation',
  required: true,
})
@Controller('sites')
export class SiteController {
  constructor(private readonly siteService: SiteService) {}

  @Post()
  create(
    @GetTenantId() tenantId: string,
    @Body('name') name: string,
    @Body('address') address?: string,
  ) {
    return this.siteService.create(tenantId, name, address);
  }

  @Get()
  findAll(@GetTenantId() tenantId: string) {
    return this.siteService.findAll(tenantId);
  }

  @Get(':id')
  findOne(@GetTenantId() tenantId: string, @Param('id') id: string) {
    return this.siteService.findOne(tenantId, id);
  }

  @Patch(':id')
  update(
    @GetTenantId() tenantId: string,
    @Param('id') id: string,
    @Body('name') name?: string,
    @Body('address') address?: string,
  ) {
    return this.siteService.update(tenantId, id, name, address);
  }

  @Delete(':id')
  remove(@GetTenantId() tenantId: string, @Param('id') id: string) {
    return this.siteService.remove(tenantId, id);
  }
}
