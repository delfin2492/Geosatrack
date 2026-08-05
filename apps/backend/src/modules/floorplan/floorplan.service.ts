import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FloorplanService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Floor Plan Upload ──────────────────────────────────────────────
  async uploadFloorPlan(
    tenantId: string,
    zoneId: string,
    file: { originalname: string; buffer: Buffer; mimetype: string; size: number },
  ) {
    const zone = await this.prisma.zone.findFirst({
      where: { id: zoneId, site: { tenantId } },
    });
    if (!zone) {
      throw new NotFoundException(`Zone "${zoneId}" not found for this tenant.`);
    }

    // Save file to /uploads/floorplans/<zoneId>_<originalname>
    const uploadsDir = path.join(process.cwd(), 'uploads', 'floorplans');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const safeFilename = `${zoneId}_${Date.now()}_${file.originalname.replace(/\s/g, '_')}`;
    const filePath = path.join(uploadsDir, safeFilename);
    fs.writeFileSync(filePath, file.buffer);

    const fileUrl = `/uploads/floorplans/${safeFilename}`;

    const updated = await this.prisma.zone.update({
      where: { id: zoneId },
      data: { floorPlanUrl: fileUrl },
    });

    return updated;
  }

  // ─── Get Zone with Geofences ────────────────────────────────────────
  async getZoneWithGeofences(tenantId: string, zoneId: string) {
    const zone = await this.prisma.zone.findFirst({
      where: { id: zoneId, site: { tenantId } },
      include: {
        site: true,
        anchors: true,
        assets: { include: { tag: true } },
        geofences: true,
      },
    });
    if (!zone) {
      throw new NotFoundException(`Zone "${zoneId}" not found for this tenant.`);
    }
    return zone;
  }

  // ─── Get All Anchors for Tenant (Asset ANCHORs + Table Anchors) ──────
  async getAllAnchors(tenantId: string) {
    const assetAnchors = await this.prisma.asset.findMany({
      where: { tenantId, type: 'ANCHOR' },
      include: { zone: { select: { id: true, name: true } } },
    });

    const tableAnchors = await this.prisma.anchor.findMany({
      where: { tenantId },
      include: { zone: { select: { id: true, name: true } } },
    });

    const mappedAssetAnchors = assetAnchors.map((a) => ({
      id: a.id,
      name: a.name,
      x: a.latitude !== null ? Number(a.latitude) : 0,
      y: a.longitude !== null ? Number(a.longitude) : 0,
      status: a.status || 'online',
      zoneId: a.zoneId,
      zone: a.zone,
      isAsset: true,
    }));

    const mappedTableAnchors = tableAnchors
      .filter((ta) => !assetAnchors.some((aa) => aa.id === ta.id || aa.name === ta.name))
      .map((a) => ({
        id: a.id,
        name: a.name,
        x: a.x,
        y: a.y,
        status: a.status,
        zoneId: a.zoneId,
        zone: a.zone,
        isAsset: false,
      }));

    return [...mappedAssetAnchors, ...mappedTableAnchors];
  }

  // ─── Assign Anchor to Zone ──────────────────────────────────────────
  async assignAnchorToZone(
    tenantId: string,
    zoneId: string,
    anchorId: string,
    x?: number,
    y?: number,
  ) {
    const zone = await this.prisma.zone.findFirst({
      where: { id: zoneId, site: { tenantId } },
    });
    if (!zone) {
      throw new NotFoundException(`Zone "${zoneId}" not found for this tenant.`);
    }

    const posX = x ?? zone.width / 2;
    const posY = y ?? zone.height / 2;

    // Check if it's an Asset of type ANCHOR first
    const assetAnchor = await this.prisma.asset.findFirst({
      where: { id: anchorId, tenantId, type: 'ANCHOR' },
    });

    if (assetAnchor) {
      return this.prisma.asset.update({
        where: { id: anchorId },
        data: {
          zoneId,
          latitude: posX,
          longitude: posY,
        },
      });
    }

    // Otherwise update Anchor table
    const tableAnchor = await this.prisma.anchor.findFirst({
      where: { id: anchorId, tenantId },
    });
    if (!tableAnchor) {
      throw new NotFoundException(`Anchor "${anchorId}" not found for this tenant.`);
    }

    return this.prisma.anchor.update({
      where: { id: anchorId },
      data: {
        zoneId,
        x: posX,
        y: posY,
      },
    });
  }

  // ─── Unassign Anchor from Zone ──────────────────────────────────────
  async unassignAnchorFromZone(tenantId: string, anchorId: string) {
    const assetAnchor = await this.prisma.asset.findFirst({
      where: { id: anchorId, tenantId, type: 'ANCHOR' },
    });

    if (assetAnchor) {
      return this.prisma.asset.update({
        where: { id: anchorId },
        data: { zoneId: null },
      });
    }

    const tableAnchor = await this.prisma.anchor.findFirst({
      where: { id: anchorId, tenantId },
    });
    if (!tableAnchor) {
      throw new NotFoundException(`Anchor "${anchorId}" not found for this tenant.`);
    }

    return this.prisma.anchor.update({
      where: { id: anchorId },
      data: { zoneId: null },
    });
  }

  // ─── Update Anchor Position on Floor Plan ───────────────────────────
  async updateAnchorPosition(tenantId: string, anchorId: string, x: number, y: number) {
    const assetAnchor = await this.prisma.asset.findFirst({
      where: { id: anchorId, tenantId, type: 'ANCHOR' },
    });

    if (assetAnchor) {
      return this.prisma.asset.update({
        where: { id: anchorId },
        data: {
          latitude: x,
          longitude: y,
        },
      });
    }

    const tableAnchor = await this.prisma.anchor.findFirst({
      where: { id: anchorId, tenantId },
    });
    if (!tableAnchor) {
      throw new NotFoundException(`Anchor "${anchorId}" not found for this tenant.`);
    }

    return this.prisma.anchor.update({
      where: { id: anchorId },
      data: { x, y },
    });
  }

  // ─── Update Zone Dimensions & Anchor GPS Reference ──────────────────
  async updateZoneCalibration(
    tenantId: string,
    zoneId: string,
    data: { width?: number; height?: number; name?: string },
  ) {
    const zone = await this.prisma.zone.findFirst({
      where: { id: zoneId, site: { tenantId } },
    });
    if (!zone) {
      throw new NotFoundException(`Zone "${zoneId}" not found for this tenant.`);
    }

    return this.prisma.zone.update({
      where: { id: zoneId },
      data: {
        width: data.width ?? zone.width,
        height: data.height ?? zone.height,
        name: data.name ?? zone.name,
      },
    });
  }

  // ─── Geofence CRUD ──────────────────────────────────────────────────
  async createGeofence(
    tenantId: string,
    zoneId: string,
    data: { name: string; points: string; color?: string; type?: string },
  ) {
    // Verify zone belongs to tenant
    const zone = await this.prisma.zone.findFirst({
      where: { id: zoneId, site: { tenantId } },
    });
    if (!zone) {
      throw new NotFoundException(`Zone "${zoneId}" not found for this tenant.`);
    }

    return this.prisma.geofence.create({
      data: {
        name: data.name,
        points: data.points, // JSON string of [{x, y}, ...]
        color: data.color || '#ef4444',
        type: data.type || 'RESTRICTED',
        zoneId,
      },
    });
  }

  async getGeofences(tenantId: string, zoneId: string) {
    // Verify zone belongs to tenant
    const zone = await this.prisma.zone.findFirst({
      where: { id: zoneId, site: { tenantId } },
    });
    if (!zone) {
      throw new NotFoundException(`Zone "${zoneId}" not found for this tenant.`);
    }

    return this.prisma.geofence.findMany({
      where: { zoneId },
    });
  }

  async updateGeofence(
    tenantId: string,
    geofenceId: string,
    data: { name?: string; points?: string; color?: string; type?: string },
  ) {
    const geofence = await this.prisma.geofence.findFirst({
      where: { id: geofenceId },
      include: { zone: { include: { site: true } } },
    });
    if (!geofence || geofence.zone.site.tenantId !== tenantId) {
      throw new NotFoundException(`Geofence "${geofenceId}" not found for this tenant.`);
    }

    return this.prisma.geofence.update({
      where: { id: geofenceId },
      data: {
        name: data.name ?? geofence.name,
        points: data.points ?? geofence.points,
        color: data.color ?? geofence.color,
        type: data.type ?? geofence.type,
      },
    });
  }

  async deleteGeofence(tenantId: string, geofenceId: string) {
    const geofence = await this.prisma.geofence.findFirst({
      where: { id: geofenceId },
      include: { zone: { include: { site: true } } },
    });
    if (!geofence || geofence.zone.site.tenantId !== tenantId) {
      throw new NotFoundException(`Geofence "${geofenceId}" not found for this tenant.`);
    }

    return this.prisma.geofence.delete({ where: { id: geofenceId } });
  }

  // ─── Point-in-Polygon Check (Ray-Casting Algorithm) ─────────────────
  isPointInPolygon(
    point: { x: number; y: number },
    polygon: { x: number; y: number }[],
  ): boolean {
    let isInside = false;
    let j = polygon.length - 1;

    for (let i = 0; i < polygon.length; i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;

      const intersect =
        yi > point.y !== yj > point.y &&
        point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;

      if (intersect) isInside = !isInside;
      j = i;
    }

    return isInside;
  }

  // ─── Check Asset Position Against All Geofences ─────────────────────
  async checkGeofenceViolations(
    tenantId: string,
    assetId: string,
    position: { x: number; y: number },
  ) {
    // Get asset and its associated zone
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, tenantId },
    });
    if (!asset || !asset.zoneId) return [];

    const geofences = await this.prisma.geofence.findMany({
      where: { zoneId: asset.zoneId },
    });

    const violations: { geofenceId: string; name: string; type: string }[] = [];

    for (const gf of geofences) {
      try {
        const polygon = JSON.parse(gf.points) as { x: number; y: number }[];
        if (this.isPointInPolygon(position, polygon)) {
          if (gf.type === 'RESTRICTED' || gf.type === 'WARNING') {
            violations.push({
              geofenceId: gf.id,
              name: gf.name,
              type: gf.type,
            });
          }
        }
      } catch (e) {
        // Skip malformed polygon data
      }
    }

    return violations;
  }
}
