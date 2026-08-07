import {
  Controller, Get, Post, Body, Param, Patch, Delete,
  UseInterceptors, UploadedFile, Headers, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TenantService } from './tenant.service';
import { ApiTags, ApiConsumes, ApiBody } from '@nestjs/swagger';
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

  // ─── Profile Settings ───────────────────────────────────────────────
  @Patch('profile')
  @UseInterceptors(FileInterceptor('logo'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        adminEmail: { type: 'string' },
        logo: { type: 'string', format: 'binary' },
      },
    },
  })
  updateProfile(
    @Headers('x-tenant-id') tenantId: string,
    @Body('name') name?: string,
    @Body('adminEmail') adminEmail?: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!tenantId) throw new BadRequestException('x-tenant-id header is required.');
    return this.tenantService.updateProfile(tenantId, { name, adminEmail }, file);
  }

  // ─── User Management ────────────────────────────────────────────────
  @Get('users')
  getTenantUsers(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) throw new BadRequestException('x-tenant-id header is required.');
    return this.tenantService.getTenantUsers(tenantId);
  }

  @Post('users')
  createTenantUser(
    @Headers('x-tenant-id') tenantId: string,
    @Body() body: { email: string; password?: string; role?: string },
  ) {
    if (!tenantId) throw new BadRequestException('x-tenant-id header is required.');
    return this.tenantService.createTenantUser(tenantId, body);
  }

  @Patch('users/:userId')
  updateUserRole(
    @Headers('x-tenant-id') tenantId: string,
    @Param('userId') userId: string,
    @Body('role') role: string,
  ) {
    if (!tenantId) throw new BadRequestException('x-tenant-id header is required.');
    return this.tenantService.updateUserRole(tenantId, userId, role);
  }

  @Delete('users/:userId')
  deleteTenantUser(
    @Headers('x-tenant-id') tenantId: string,
    @Param('userId') userId: string,
  ) {
    if (!tenantId) throw new BadRequestException('x-tenant-id header is required.');
    return this.tenantService.deleteTenantUser(tenantId, userId);
  }

  // ─── Standard CRUD ──────────────────────────────────────────────────
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
