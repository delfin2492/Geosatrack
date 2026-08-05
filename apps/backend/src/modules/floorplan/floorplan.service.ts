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
        assets: {
          // Hanya ambil asset yang benar-benar di-assign ke zone ini
          where: {
            zoneId,
            NOT: [
              { type: { startsWith: 'AGENT_' } },
              { type: 'ANCHOR' },
              { type: 'CITY' },
              { type: 'BUILDING' },
            ],
          },
          include: { tag: true },
        },
        geofences: true,
      },
    });
    if (!zone) {
      throw new NotFoundException(`Zone "${zoneId}" not found for this tenant.`);
    }

    // Fetch Asset-type ANCHORs assigned to this zone
    const assetAnchorsInZone = await this.prisma.asset.findMany({
      where: { tenantId, zoneId, type: 'ANCHOR' },
      include: { zone: { select: { id: true, name: true } } },
    });

    // Map table anchors
    const mappedTableAnchors = (zone.anchors || []).map((a) => ({
      id: a.id,
      name: a.name,
      x: Number(a.x),
      y: Number(a.y),
      status: a.status,
      zoneId: a.zoneId,
      zone: zone,
      isAsset: false,
    }));

    // Map asset anchors
    const mappedAssetAnchors = assetAnchorsInZone.map((a) => {
      // Priority: planX/planY -> latitude/longitude -> default center
      const posX = a.planX !== null && a.planX !== undefined
        ? Number(a.planX)
        : (a.latitude !== null && a.latitude !== undefined ? Number(a.latitude) : zone.width / 2);
      const posY = a.planY !== null && a.planY !== undefined
        ? Number(a.planY)
        : (a.longitude !== null && a.longitude !== undefined ? Number(a.longitude) : zone.height / 2);

      return {
        id: a.id,
        name: a.name,
        x: posX,
        y: posY,
        status: a.status || 'online',
        zoneId: a.zoneId,
        zone: a.zone,
        isAsset: true,
      };
    });

    // Filter out duplicates if any
    const allZoneAnchors = [
      ...mappedAssetAnchors,
      ...mappedTableAnchors.filter((ta) => !mappedAssetAnchors.some((aa) => aa.id === ta.id || aa.name === ta.name)),
    ];

    // Tambah field x/y dari planX/planY untuk rendering asset mesh di denah
    const assetsWithPlanCoords = zone.assets.map((a) => ({
      ...a,
      x: a.planX !== null && a.planX !== undefined ? Number(a.planX) : null,
      y: a.planY !== null && a.planY !== undefined ? Number(a.planY) : null,
      planX: a.planX !== null && a.planX !== undefined ? Number(a.planX) : zone.width / 2,
      planY: a.planY !== null && a.planY !== undefined ? Number(a.planY) : zone.height / 2,
    }));

    return {
      ...zone,
      anchors: allZoneAnchors,
      assets: assetsWithPlanCoords,
    };
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

  // ─── Update Asset Position on Floor Plan ───────────────────────────
  async updateAssetPlanPosition(tenantId: string, assetId: string, planX: number, planY: number) {
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, tenantId },
    });
    if (!asset) throw new NotFoundException(`Asset "${assetId}" not found.`);

    return this.prisma.asset.update({
      where: { id: assetId },
      data: { planX, planY },
    });
  }

  // ─── Assign Asset/Mesh to Zone ──────────────────────────────────────
  async assignAssetToZone(tenantId: string, zoneId: string, assetId: string, planX?: number, planY?: number) {
    const zone = await this.prisma.zone.findFirst({
      where: { id: zoneId, site: { tenantId } },
    });
    if (!zone) throw new NotFoundException(`Zone "${zoneId}" not found for this tenant.`);

    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, tenantId },
    });
    if (!asset) throw new NotFoundException(`Asset "${assetId}" not found.`);

    return this.prisma.asset.update({
      where: { id: assetId },
      data: {
        zoneId,
        planX: planX ?? zone.width / 2,
        planY: planY ?? zone.height / 2,
      },
    });
  }

  // ─── Unassign Asset/Mesh from Zone ─────────────────────────────────
  async unassignAssetFromZone(tenantId: string, assetId: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, tenantId },
    });
    if (!asset) throw new NotFoundException(`Asset "${assetId}" not found.`);

    return this.prisma.asset.update({
      where: { id: assetId },
      data: { zoneId: null, planX: null, planY: null },
    });
  }

  // ─── Update Anchor Position on Floor Plan (Drag & Drop) ───────────────
  async updateAnchorPosition(tenantId: string, anchorId: string, x: number, y: number) {
    // Check Asset-type ANCHOR first
    const assetAnchor = await this.prisma.asset.findFirst({
      where: { id: anchorId, tenantId, type: 'ANCHOR' },
    });
    if (assetAnchor) {
      return this.prisma.asset.update({
        where: { id: anchorId },
        data: { planX: x, planY: y },
      });
    }

    // Otherwise update Anchor table
    const tableAnchor = await this.prisma.anchor.findFirst({
      where: { id: anchorId, tenantId },
    });
    if (!tableAnchor) throw new NotFoundException(`Anchor "${anchorId}" not found.`);

    return this.prisma.anchor.update({
      where: { id: anchorId },
      data: { x, y },
    });
  }

  // ─── Get All Non-Anchor Assets for Tenant (Mesh nodes) ──────────────
  async getAllMeshAssets(tenantId: string) {
    const assets = await this.prisma.asset.findMany({
      where: {
        tenantId,
        NOT: [
          { type: { startsWith: 'AGENT_' } },
          { type: 'ANCHOR' },
          { type: 'CITY' },
          { type: 'BUILDING' },
        ],
      },
      include: {
        zone: { select: { id: true, name: true } },
        tag: { select: { id: true, rssi: true, lastSeen: true } },
      },
      orderBy: { name: 'asc' },
    });

    return assets.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      status: a.status,
      planX: a.planX ?? null,
      planY: a.planY ?? null,
      zoneId: a.zoneId,
      zone: a.zone,
      tag: a.tag,
    }));
  }

  // ─── Update Mesh Position & Zone based on Anchor RSSI Signal Values ────
  async updateMeshRssiPosition(
    tenantId: string,
    assetId: string,
    anchorSignals: { anchorId?: string; anchorName?: string; rssi: number }[],
  ) {
    // 1. Fetch all tenant anchors (Asset-type ANCHOR + Table Anchors)
    const allAnchors = await this.getAllAnchors(tenantId);

    const matchedSignals: { anchorId: string; x: number; y: number; zoneId: string; rssi: number; weight: number; anchorName: string }[] = [];

    for (const sig of anchorSignals) {
      const matched = allAnchors.find(
        (a) =>
          (sig.anchorId && (a.id === sig.anchorId || a.name === sig.anchorId)) ||
          (sig.anchorName && a.name.toLowerCase() === sig.anchorName.toLowerCase()),
      );

      if (matched && matched.zoneId) {
        const normalizedRssi = Math.max(-100, Math.min(-30, sig.rssi));
        const weight = Math.pow(10, (normalizedRssi + 100) / 20); // Exponential RSSI weighting

        matchedSignals.push({
          anchorId: matched.id,
          x: matched.x,
          y: matched.y,
          zoneId: matched.zoneId,
          rssi: sig.rssi,
          weight,
          anchorName: matched.name,
        });
      }
    }

    if (matchedSignals.length === 0) {
      throw new NotFoundException('No registered placed anchors matched from provided signal list.');
    }

    // 2. Zone Auto-Assignment: Pick zoneId of the Anchor with strongest RSSI (highest dBm value)
    matchedSignals.sort((a, b) => b.rssi - a.rssi);
    const targetZoneId = matchedSignals[0].zoneId;
    const strongestAnchorName = matchedSignals[0].anchorName;

    // Filter signals belonging to the target zone
    const zoneSignals = matchedSignals.filter((s) => s.zoneId === targetZoneId);

    let calculatedX = zoneSignals[0].x;
    let calculatedY = zoneSignals[0].y;

    if (zoneSignals.length > 1) {
      let totalWeight = 0;
      let weightedX = 0;
      let weightedY = 0;

      for (const s of zoneSignals) {
        totalWeight += s.weight;
        weightedX += s.x * s.weight;
        weightedY += s.y * s.weight;
      }

      if (totalWeight > 0) {
        calculatedX = Number((weightedX / totalWeight).toFixed(2));
        calculatedY = Number((weightedY / totalWeight).toFixed(2));
      }
    }

    // 3. Update Tag signals data & Asset with new zoneId and planX/planY coordinates
    const dbAsset = await this.prisma.asset.findUnique({
      where: { id: assetId },
      include: { tag: true },
    });

    const signalsJson = JSON.stringify(
      matchedSignals.map((s) => ({
        anchorId: s.anchorId,
        anchorName: s.anchorName,
        rssi: s.rssi,
      }))
    );

    if (dbAsset?.tagId) {
      await this.prisma.tag.update({
        where: { id: dbAsset.tagId },
        data: { signals: signalsJson },
      });
    }

    const updatedAsset = await this.prisma.asset.update({
      where: { id: assetId },
      data: {
        zoneId: targetZoneId,
        planX: calculatedX,
        planY: calculatedY,
      },
      include: { zone: true, tag: true },
    });

    return {
      asset: updatedAsset,
      strongestAnchor: strongestAnchorName,
      targetZoneId,
      calculatedPosition: { x: calculatedX, y: calculatedY },
      matchedAnchorsCount: zoneSignals.length,
    };
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
