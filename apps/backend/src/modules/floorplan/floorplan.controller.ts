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

  // ─── Anchor Management on Floor Plan ──────────────────────────────
  @Get('anchors')
  getAllAnchors(@GetTenantId() tenantId: string) {
    return this.floorplanService.getAllAnchors(tenantId);
  }

  @Post('zones/:zoneId/anchors/:anchorId')
  assignAnchorToZone(
    @GetTenantId() tenantId: string,
    @Param('zoneId') zoneId: string,
    @Param('anchorId') anchorId: string,
    @Body() body: { x?: number; y?: number },
  ) {
    return this.floorplanService.assignAnchorToZone(tenantId, zoneId, anchorId, body?.x, body?.y);
  }

  @Delete('anchors/:anchorId')
  unassignAnchorFromZone(
    @GetTenantId() tenantId: string,
    @Param('anchorId') anchorId: string,
  ) {
    return this.floorplanService.unassignAnchorFromZone(tenantId, anchorId);
  }

  @Patch('anchors/:anchorId/position')
  updateAnchorPosition(
    @GetTenantId() tenantId: string,
    @Param('anchorId') anchorId: string,
    @Body() body: { x: number; y: number },
  ) {
    return this.floorplanService.updateAnchorPosition(tenantId, anchorId, body.x, body.y);
  }

  // ─── Mesh / Asset Management on Floor Plan ─────────────────────────
  @Get('mesh')
  getAllMeshAssets(@GetTenantId() tenantId: string) {
    return this.floorplanService.getAllMeshAssets(tenantId);
  }

  @Post('zones/:zoneId/mesh/:assetId')
  assignAssetToZone(
    @GetTenantId() tenantId: string,
    @Param('zoneId') zoneId: string,
    @Param('assetId') assetId: string,
    @Body() body: { planX?: number; planY?: number },
  ) {
    return this.floorplanService.assignAssetToZone(tenantId, zoneId, assetId, body?.planX, body?.planY);
  }

  @Delete('mesh/:assetId')
  unassignAssetFromZone(
    @GetTenantId() tenantId: string,
    @Param('assetId') assetId: string,
  ) {
    return this.floorplanService.unassignAssetFromZone(tenantId, assetId);
  }

  @Patch('mesh/:assetId/position')
  updateAssetPlanPosition(
    @GetTenantId() tenantId: string,
    @Param('assetId') assetId: string,
    @Body() body: { planX: number; planY: number },
  ) {
    return this.floorplanService.updateAssetPlanPosition(tenantId, assetId, body.planX, body.planY);
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
