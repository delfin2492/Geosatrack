import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { GetTenantId } from '../../common/decorators/get-tenant-id.decorator';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('sections')
  getSections(@GetTenantId() tenantId: string) {
    return this.dashboardService.getSections(tenantId);
  }

  @Post('sections')
  createSection(@GetTenantId() tenantId: string, @Body('name') name: string) {
    return this.dashboardService.createSection(tenantId, name);
  }

  @Put('sections/:id')
  updateSection(@GetTenantId() tenantId: string, @Param('id') id: string, @Body() data: any) {
    return this.dashboardService.updateSection(id, tenantId, data);
  }

  @Delete('sections/:id')
  deleteSection(@GetTenantId() tenantId: string, @Param('id') id: string) {
    return this.dashboardService.deleteSection(id, tenantId);
  }

  @Post('sections/:id/save-layout')
  saveSectionLayout(
    @GetTenantId() tenantId: string, 
    @Param('id') id: string, 
    @Body('layout') layout: string,
    @Body('widgets') widgets: any[]
  ) {
    return this.dashboardService.saveSectionLayout(id, tenantId, layout, widgets || []);
  }
}
