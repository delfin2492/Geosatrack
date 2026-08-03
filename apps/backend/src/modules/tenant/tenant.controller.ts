import { Controller, Get, Post, Body, Param, Patch, Delete } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { ApiTags } from '@nestjs/swagger';
import { RegisterTenantDto } from './dto/tenant-register.dto';

@ApiTags('tenants')
@Controller('tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Post()
  create(
    @Body('name') name: string,
    @Body('status') status?: string,
    @Body('agentLimit') agentLimit?: number,
    @Body('assetLimit') assetLimit?: number,
  ) {
    return this.tenantService.create(name, status, agentLimit, assetLimit);
  }

  @Post('register')
  register(
    @Body() dto: RegisterTenantDto,
  ) {
    return this.tenantService.registerTenant(dto);
  }

  @Get()
  findAll() {
    return this.tenantService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tenantService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: { name?: string; status?: string; agentLimit?: number; assetLimit?: number },
  ) {
    return this.tenantService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tenantService.remove(id);
  }
}
