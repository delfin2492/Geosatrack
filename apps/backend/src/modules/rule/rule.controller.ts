import { Controller, Get, Post, Body, Param, Patch, Delete } from '@nestjs/common';
import { RuleService } from './rule.service';
import { GetTenantId } from '../../common/decorators/get-tenant-id.decorator';
import { ApiTags, ApiHeader } from '@nestjs/swagger';

@ApiTags('rules')
@ApiHeader({
  name: 'x-tenant-id',
  description: 'Tenant Identifier for multi-tenant isolation',
  required: true,
})
@Controller('rules')
export class RuleController {
  constructor(private readonly ruleService: RuleService) {}

  @Post()
  create(
    @GetTenantId() tenantId: string,
    @Body('name') name: string,
    @Body('ruleType') ruleType: string,
    @Body('flowGraph') flowGraph: string,
    @Body('ruleConfig') ruleConfig: string,
  ) {
    return this.ruleService.create(tenantId, name, ruleType, flowGraph, ruleConfig);
  }

  @Get()
  findAll(@GetTenantId() tenantId: string) {
    return this.ruleService.findAll(tenantId);
  }

  @Get(':id')
  findOne(@GetTenantId() tenantId: string, @Param('id') id: string) {
    return this.ruleService.findOne(tenantId, id);
  }

  @Patch(':id')
  update(
    @GetTenantId() tenantId: string,
    @Param('id') id: string,
    @Body() data: { name?: string; isActive?: boolean; ruleType?: string; flowGraph?: string; ruleConfig?: string },
  ) {
    return this.ruleService.update(tenantId, id, data);
  }

  @Delete(':id')
  remove(@GetTenantId() tenantId: string, @Param('id') id: string) {
    return this.ruleService.remove(tenantId, id);
  }

  @Get(':id/logs')
  getLogs(@GetTenantId() tenantId: string, @Param('id') id: string) {
    return this.ruleService.getLogs(tenantId, id);
  }
}
