import {
  Controller, Get, Post, Body, Param, Patch, Delete,
  UseInterceptors, UploadedFile, UploadedFiles, Headers, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';
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
    @Body('isWhiteLabel') isWhiteLabel?: boolean,
  ) {
    return this.tenantService.create(name, status, agentLimit, assetLimit, isWhiteLabel);
  }

  @Post('register')
  register(
    @Body() dto: RegisterTenantDto,
  ) {
    return this.tenantService.registerTenant(dto);
  }

  // ─── Profile Settings ───────────────────────────────────────────────
  @Patch('profile')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'logo', maxCount: 1 },
      { name: 'favicon', maxCount: 1 },
      { name: 'avatar', maxCount: 1 },
    ]),
  )
  updateProfile(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-user-id') userId: string,
    @Body('name') name?: string,
    @Body('adminEmail') adminEmail?: string,
    @UploadedFiles()
    files?: { logo?: Express.Multer.File[]; favicon?: Express.Multer.File[]; avatar?: Express.Multer.File[] },
  ) {
    if (!tenantId) throw new BadRequestException('x-tenant-id header is required.');
    return this.tenantService.updateProfile(tenantId, { name, adminEmail }, files, userId);
  }

  // ─── White-Label Settings ───────────────────────────────────────────
  @Patch('whitelabel')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'logo', maxCount: 1 },
      { name: 'favicon', maxCount: 1 },
    ]),
  )
  updateWhiteLabel(
    @Headers('x-tenant-id') tenantId: string,
    @Body() body: any,
    @UploadedFiles()
    files?: { logo?: Express.Multer.File[]; favicon?: Express.Multer.File[] },
  ) {
    if (!tenantId) throw new BadRequestException('x-tenant-id header is required.');
    return this.tenantService.updateWhiteLabelSettings(tenantId, body, files);
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
    @Body() dto: { name?: string; status?: string; agentLimit?: number; assetLimit?: number; isWhiteLabel?: boolean },
  ) {
    return this.tenantService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tenantService.remove(id);
  }
}
