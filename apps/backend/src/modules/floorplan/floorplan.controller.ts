import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FloorplanService } from './floorplan.service';
import { GetTenantId } from '../../common/decorators/get-tenant-id.decorator';
import { ApiTags, ApiHeader, ApiConsumes, ApiBody } from '@nestjs/swagger';

@ApiTags('floorplan')
@ApiHeader({
  name: 'x-tenant-id',
  description: 'Tenant Identifier for multi-tenant isolation',
  required: true,
})
@Controller('floorplan')
export class FloorplanController {
  constructor(private readonly floorplanService: FloorplanService) {}

  // ─── Upload Floor Plan Image ────────────────────────────────────────
  @Post('zones/:zoneId/upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  uploadFloorPlan(
    @GetTenantId() tenantId: string,
    @Param('zoneId') zoneId: string,
    @UploadedFile() file: any,
  ) {
    return this.floorplanService.uploadFloorPlan(tenantId, zoneId, file);
  }

  // ─── Get Zone Details with Geofences ────────────────────────────────
  @Get('zones/:zoneId')
  getZoneWithGeofences(
    @GetTenantId() tenantId: string,
    @Param('zoneId') zoneId: string,
  ) {
    return this.floorplanService.getZoneWithGeofences(tenantId, zoneId);
  }

  // ─── Update Zone Calibration (Dimensions) ──────────────────────────
  @Patch('zones/:zoneId/calibrate')
  updateZoneCalibration(
    @GetTenantId() tenantId: string,
    @Param('zoneId') zoneId: string,
    @Body() data: { width?: number; height?: number; name?: string },
  ) {
    return this.floorplanService.updateZoneCalibration(tenantId, zoneId, data);
  }

  // ─── Create Geofence Zone ──────────────────────────────────────────
  @Post('zones/:zoneId/geofences')
  createGeofence(
    @GetTenantId() tenantId: string,
    @Param('zoneId') zoneId: string,
    @Body() data: { name: string; points: string; color?: string; type?: string },
  ) {
    return this.floorplanService.createGeofence(tenantId, zoneId, data);
  }

  // ─── Get All Geofences for a Zone ──────────────────────────────────
  @Get('zones/:zoneId/geofences')
  getGeofences(
    @GetTenantId() tenantId: string,
    @Param('zoneId') zoneId: string,
  ) {
    return this.floorplanService.getGeofences(tenantId, zoneId);
  }

  // ─── Update a Geofence ─────────────────────────────────────────────
  @Patch('geofences/:geofenceId')
  updateGeofence(
    @GetTenantId() tenantId: string,
    @Param('geofenceId') geofenceId: string,
    @Body() data: { name?: string; points?: string; color?: string; type?: string },
  ) {
    return this.floorplanService.updateGeofence(tenantId, geofenceId, data);
  }

  // ─── Delete a Geofence ─────────────────────────────────────────────
  @Delete('geofences/:geofenceId')
  deleteGeofence(
    @GetTenantId() tenantId: string,
    @Param('geofenceId') geofenceId: string,
  ) {
    return this.floorplanService.deleteGeofence(tenantId, geofenceId);
  }
}
