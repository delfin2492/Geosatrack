import { Controller, Get, Post, Delete, Param, Query } from '@nestjs/common';
import { AlertService } from './alert.service';
import { GetTenantId } from '../../common/decorators/get-tenant-id.decorator';

@Controller('alerts')
export class AlertController {
  constructor(private readonly alertService: AlertService) {}

  @Get()
  async findAll(
    @GetTenantId() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('unresolvedOnly') unresolvedOnly?: string
  ) {
    return this.alertService.findAll(tenantId, startDate, endDate, unresolvedOnly === 'true');
  }

  @Post(':id/resolve')
  async resolve(@GetTenantId() tenantId: string, @Param('id') id: string) {
    return this.alertService.resolve(tenantId, id);
  }

  @Delete(':id')
  async remove(@GetTenantId() tenantId: string, @Param('id') id: string) {
    return this.alertService.remove(tenantId, id);
  }

  @Delete()
  async removeAll(@GetTenantId() tenantId: string) {
    return this.alertService.removeAll(tenantId);
  }
}
