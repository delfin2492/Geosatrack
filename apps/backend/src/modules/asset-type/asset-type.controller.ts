import {
  Controller, Get, Post, Patch, Delete, Body, Param, Headers, ForbiddenException, BadRequestException
} from '@nestjs/common';
import { AssetTypeService, CreateAssetTypeDto, UpdateAssetTypeDto } from './asset-type.service';

@Controller('asset-types')
export class AssetTypeController {
  constructor(private readonly assetTypeService: AssetTypeService) {}

  private checkSuperAdmin(userRole?: string) {
    if (userRole && userRole.toLowerCase() !== 'superadmin') {
      throw new ForbiddenException('Hanya Superadmin yang dapat mengelola konfigurasi tipe asset.');
    }
  }

  @Get()
  findAll() {
    return this.assetTypeService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.assetTypeService.findOne(id);
  }

  @Post()
  create(
    @Headers('x-user-role') userRole: string,
    @Body() body: CreateAssetTypeDto,
  ) {
    this.checkSuperAdmin(userRole);
    if (!body.code || !body.name) {
      throw new BadRequestException('Code dan name wajib diisi.');
    }
    return this.assetTypeService.create(body);
  }

  @Patch(':id')
  update(
    @Headers('x-user-role') userRole: string,
    @Param('id') id: string,
    @Body() body: UpdateAssetTypeDto,
  ) {
    this.checkSuperAdmin(userRole);
    return this.assetTypeService.update(id, body);
  }

  @Delete(':id')
  remove(
    @Headers('x-user-role') userRole: string,
    @Param('id') id: string,
  ) {
    this.checkSuperAdmin(userRole);
    return this.assetTypeService.remove(id);
  }
}
