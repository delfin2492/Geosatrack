'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  Upload,
  PenTool,
  MousePointer,
  Hexagon,
  Trash2,
  Save,
  MapPin,
  Radio,
  Plus,
  X,
  Layers,
  Tag,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────
interface ZoneData {
  id: string;
  name: string;
  floorPlanUrl: string | null;
  width: number;
  height: number;
  siteId: string;
  site?: { name: string };
  anchors?: AnchorData[];
  assets?: any[];
  geofences?: GeofenceData[];
}

interface AnchorData {
  id: string;
  name: string;
  x: number;
  y: number;
  status: string;
  zoneId?: string | null;
  zone?: { id: string; name: string } | null;
}

interface GeofenceData {
  id: string;
  name: string;
  points: string;
  color: string;
  type: string;
}

// ─── Planner Page ─────────────────────────────────────────────────────
export default function PlannerPage() {
  const { tenantId, token } = useAuth();
  const { assets } = useSocket();

  const [zones, setZones] = useState<ZoneData[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<ZoneData | null>(null);
  const [allTenantAnchors, setAllTenantAnchors] = useState<AnchorData[]>([]);
  const [loading, setLoading] = useState(false);

  // Geofence draw state
  const [drawMode, setDrawMode] = useState<'pointer' | 'draw_zone'>('pointer');
  const [drawingPoints, setDrawingPoints] = useState<{ x: number; y: number }[]>([]);
  const [newGeofenceName, setNewGeofenceName] = useState('');
  const [newGeofenceType, setNewGeofenceType] = useState<'RESTRICTED' | 'SAFE' | 'WARNING'>('RESTRICTED');
  const [showNewGeofenceForm, setShowNewGeofenceForm] = useState(false);

  // Map refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const imageOverlayRef = useRef<any>(null);
  const geofenceLayerRef = useRef<any>(null);
  const markerLayerRef = useRef<any>(null);

  const apiHeaders = useCallback(() => {
    const h: Record<string, string> = { 'x-tenant-id': tenantId || '' };
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  }, [tenantId, token]);

  // ─── Fetch Sites & Zones ───────────────────────────────────────────
  const fetchZones = useCallback(async () => {
    if (!tenantId) return;
    try {
      const res = await fetch('http://localhost:4000/api/zones', { headers: apiHeaders() });
      if (res.ok) {
        const data = await res.json();
        setZones(data);
      }
    } catch (e) {
      console.error('Failed to fetch zones:', e);
    }
  }, [tenantId, apiHeaders]);

  // ─── Fetch All Tenant Anchors ──────────────────────────────────────
  const fetchAllAnchors = useCallback(async () => {
    if (!tenantId) return;
    try {
      const res = await fetch('http://localhost:4000/api/floorplan/anchors', { headers: apiHeaders() });
      if (res.ok) {
        const data = await res.json();
        setAllTenantAnchors(data);
      }
    } catch (e) {
      console.error('Failed to fetch anchors:', e);
    }
  }, [tenantId, apiHeaders]);

  useEffect(() => {
    fetchZones();
    fetchAllAnchors();
  }, [fetchZones, fetchAllAnchors]);

  // ─── Fetch Selected Zone Details ───────────────────────────────────
  const fetchZoneDetails = useCallback(async (zoneId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:4000/api/floorplan/zones/${zoneId}`, {
        headers: apiHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedZone(data);
      }
    } catch (e) {
      console.error('Failed to fetch zone details:', e);
    }
    setLoading(false);
  }, [apiHeaders]);

  useEffect(() => {
    if (selectedZoneId) {
      fetchZoneDetails(selectedZoneId);
    } else {
      setSelectedZone(null);
    }
  }, [selectedZoneId, fetchZoneDetails]);

  // ─── Initialize Leaflet Map ────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current) return;
    const L = require('leaflet');

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      crs: L.CRS.Simple,
      minZoom: -2,
      maxZoom: 4,
      zoomControl: false,
    });
    mapRef.current = map;

    // Initialize overlay layers
    geofenceLayerRef.current = L.layerGroup().addTo(map);
    markerLayerRef.current = L.layerGroup().addTo(map);

    // Set default view to center of a 100x100 area
    map.setView([50, 50], 0);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ─── Render Floor Plan Overlay, Anchors & Geofences ───────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const L = require('leaflet');

    // Clear previous overlays
    if (imageOverlayRef.current) {
      map.removeLayer(imageOverlayRef.current);
      imageOverlayRef.current = null;
    }
    geofenceLayerRef.current?.clearLayers();
    markerLayerRef.current?.clearLayers();

    if (!selectedZone) return;

    const w = selectedZone.width || 100;
    const h = selectedZone.height || 100;
    const bounds: [[number, number], [number, number]] = [[0, 0], [h, w]];

    // Render floor plan image if available
    if (selectedZone.floorPlanUrl) {
      const imageUrl = `http://localhost:4000${selectedZone.floorPlanUrl}`;
      imageOverlayRef.current = L.imageOverlay(imageUrl, bounds, {
        opacity: 0.85,
        interactive: false,
      }).addTo(map);
    }

    map.fitBounds(bounds);

    // Draw existing geofence polygons
    if (selectedZone.geofences) {
      selectedZone.geofences.forEach((gf) => {
        try {
          const points = JSON.parse(gf.points) as { x: number; y: number }[];
          const latLngs = points.map((p) => [p.y, p.x] as [number, number]);
          const polygon = L.polygon(latLngs, {
            color: gf.color,
            fillColor: gf.color,
            fillOpacity: 0.15,
            weight: 2,
            dashArray: gf.type === 'WARNING' ? '8 4' : undefined,
          }).addTo(geofenceLayerRef.current);

          polygon.bindTooltip(
            `<strong>${gf.name}</strong><br/><span style="font-size:10px">${gf.type}</span>`,
            { sticky: true, className: 'geofence-tooltip' },
          );
        } catch (e) {}
      });
    }

    // Draw anchor markers (interactive drag & update)
    if (selectedZone.anchors) {
      selectedZone.anchors.forEach((anchor: AnchorData) => {
        const icon = L.divIcon({
          className: 'custom-anchor-icon',
          html: `
            <div style="display:flex;flex-direction:column;align-items:center;">
              <div style="background:#0f172a;color:#38bdf8;border:1px solid #334155;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:bold;white-space:nowrap;margin-bottom:2px;box-shadow:0 2px 4px rgba(0,0,0,0.5);">
                ⚓ ${anchor.name}
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#38bdf8" width="28" height="28" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4));">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" stroke="#ffffff" stroke-width="1"/>
              </svg>
            </div>`,
          iconSize: [60, 48],
          iconAnchor: [30, 44],
        });

        L.marker([anchor.y, anchor.x], { icon, draggable: true })
          .addTo(markerLayerRef.current)
          .on('dragend', async function (e: any) {
            const pos = e.target.getLatLng();
            const newX = Number(pos.lng.toFixed(2));
            const newY = Number(pos.lat.toFixed(2));
            try {
              await fetch(`http://localhost:4000/api/floorplan/anchors/${anchor.id}/position`, {
                method: 'PATCH',
                headers: { ...apiHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ x: newX, y: newY }),
              });
              fetchAllAnchors();
            } catch (err) {
              console.error('Failed to update anchor position:', err);
            }
          });
      });
    }

    // Draw asset/mesh markers
    if (selectedZone.assets) {
      selectedZone.assets.forEach((asset: any) => {
        const x = asset.latitude ?? 50;
        const y = asset.longitude ?? 50;
        const icon = L.divIcon({
          className: 'custom-asset-icon',
          html: `
            <div style="display:flex;flex-direction:column;align-items:center;">
              <div style="background:#0f172a;color:#22c55e;border:1px solid #334155;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:bold;white-space:nowrap;margin-bottom:2px;box-shadow:0 2px 4px rgba(0,0,0,0.5);">
                ${asset.name}
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#22c55e" width="24" height="24" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4));">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" stroke="#ffffff" stroke-width="1"/>
              </svg>
            </div>`,
          iconSize: [50, 40],
          iconAnchor: [25, 40],
        });
        L.marker([y, x], { icon, draggable: true })
          .addTo(markerLayerRef.current)
          .on('dragend', async function (e: any) {
            const pos = e.target.getLatLng();
            try {
              await fetch(`http://localhost:4000/api/assets/${asset.id}`, {
                method: 'PATCH',
                headers: { ...apiHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ latitude: pos.lng, longitude: pos.lat }),
              });
            } catch (err) {
              console.error('Failed to update asset position:', err);
            }
          });
      });
    }
  }, [selectedZone, apiHeaders, fetchAllAnchors]);

  // ─── Assign Anchor to Selected Zone ───────────────────────────────
  const handleAssignAnchor = async (anchorId: string) => {
    if (!selectedZoneId || !selectedZone) return;
    try {
      const res = await fetch(`http://localhost:4000/api/floorplan/zones/${selectedZoneId}/anchors/${anchorId}`, {
        method: 'POST',
        headers: { ...apiHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          x: selectedZone.width / 2,
          y: selectedZone.height / 2,
        }),
      });
      if (res.ok) {
        fetchZoneDetails(selectedZoneId);
        fetchAllAnchors();
      }
    } catch (err) {
      console.error('Failed to assign anchor:', err);
    }
  };

  // ─── Unassign Anchor from Zone ────────────────────────────────────
  const handleUnassignAnchor = async (anchorId: string) => {
    try {
      const res = await fetch(`http://localhost:4000/api/floorplan/anchors/${anchorId}`, {
        method: 'DELETE',
        headers: apiHeaders(),
      });
      if (res.ok) {
        if (selectedZoneId) fetchZoneDetails(selectedZoneId);
        fetchAllAnchors();
      }
    } catch (err) {
      console.error('Failed to unassign anchor:', err);
    }
  };

  // ─── Handle Floor Plan Upload ──────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !selectedZoneId) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`http://localhost:4000/api/floorplan/zones/${selectedZoneId}/upload`, {
        method: 'POST',
        headers: { 'x-tenant-id': tenantId || '', Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        fetchZoneDetails(selectedZoneId);
      }
    } catch (err) {
      console.error('Upload failed:', err);
    }
  };

  // ─── Save Geofence ─────────────────────────────────────────────────
  const handleSaveGeofence = async () => {
    if (!selectedZoneId || drawingPoints.length < 3 || !newGeofenceName.trim()) return;

    const colorMap = { RESTRICTED: '#ef4444', WARNING: '#f59e0b', SAFE: '#22c55e' };

    try {
      const res = await fetch(`http://localhost:4000/api/floorplan/zones/${selectedZoneId}/geofences`, {
        method: 'POST',
        headers: { ...apiHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newGeofenceName,
          points: JSON.stringify(drawingPoints),
          color: colorMap[newGeofenceType],
          type: newGeofenceType,
        }),
      });

      if (res.ok) {
        setDrawingPoints([]);
        setNewGeofenceName('');
        setShowNewGeofenceForm(false);
        setDrawMode('pointer');
        fetchZoneDetails(selectedZoneId);
      }
    } catch (err) {
      console.error('Failed to save geofence:', err);
    }
  };

  // ─── Delete Geofence ───────────────────────────────────────────────
  const handleDeleteGeofence = async (geofenceId: string) => {
    try {
      await fetch(`http://localhost:4000/api/floorplan/geofences/${geofenceId}`, {
        method: 'DELETE',
        headers: apiHeaders(),
      });
      if (selectedZoneId) fetchZoneDetails(selectedZoneId);
    } catch (err) {
      console.error('Failed to delete geofence:', err);
    }
  };

  // ─── Map Click for Drawing Points ──────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onClick = (e: any) => {
      if (drawMode !== 'draw_zone') return;
      setDrawingPoints((prev) => [...prev, { x: Number(e.latlng.lng.toFixed(2)), y: Number(e.latlng.lat.toFixed(2)) }]);
    };

    map.on('click', onClick);
    return () => {
      map.off('click', onClick);
    };
  }, [drawMode]);

  // ─── Draw Preview Polygon ─────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !geofenceLayerRef.current) return;
    const L = require('leaflet');

    // Remove preview polygons
    geofenceLayerRef.current.eachLayer((layer: any) => {
      if (layer.options?.className === 'preview-polygon') {
        geofenceLayerRef.current.removeLayer(layer);
      }
    });

    if (drawingPoints.length >= 2) {
      const colorMap = { RESTRICTED: '#ef4444', WARNING: '#f59e0b', SAFE: '#22c55e' };
      const latLngs = drawingPoints.map((p) => [p.y, p.x] as [number, number]);
      L.polygon(latLngs, {
        color: colorMap[newGeofenceType],
        fillColor: colorMap[newGeofenceType],
        fillOpacity: 0.2,
        weight: 2,
        dashArray: '6 4',
        className: 'preview-polygon',
      }).addTo(geofenceLayerRef.current);
    }

    drawingPoints.forEach((p, i) => {
      L.circleMarker([p.y, p.x], {
        radius: 5,
        color: '#ffffff',
        fillColor: '#3b82f6',
        fillOpacity: 1,
        weight: 2,
        className: 'preview-polygon',
      })
        .addTo(geofenceLayerRef.current)
        .bindTooltip(`P${i + 1}`, { permanent: true, direction: 'top', className: 'point-tooltip' });
    });
  }, [drawingPoints, newGeofenceType]);

  const placedAnchorIds = new Set(selectedZone?.anchors?.map((a) => a.id) || []);

  return (
    <div className="flex h-full gap-4">
      {/* ─── LEFT SIDEBAR PANEL ───────────────────────────────────── */}
      <div className="w-80 flex-shrink-0 flex flex-col gap-3 overflow-y-auto">
        {/* Zone Selector */}
        <Card className="rounded-2xl border-border shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold flex items-center gap-2 text-foreground">
              <Layers className="h-4 w-4 text-primary" />
              Zones / Floor Plans
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {zones.length === 0 && (
              <p className="text-[11px] text-muted-foreground italic">
                No zones found. Create zones via Assets → Sites first.
              </p>
            )}
            {zones.map((z) => (
              <button
                key={z.id}
                onClick={() => setSelectedZoneId(z.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all border cursor-pointer ${
                  selectedZoneId === z.id
                    ? 'bg-primary/10 border-primary text-primary font-bold'
                    : 'bg-secondary/50 border-border text-muted-foreground hover:bg-secondary'
                }`}
              >
                <div className="font-bold">{z.name}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {z.site?.name || 'Unknown Site'} • {z.width}m × {z.height}m
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Floor Plan Upload */}
        {selectedZoneId && (
          <Card className="rounded-2xl border-border shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold flex items-center gap-2 text-foreground">
                <Upload className="h-4 w-4 text-primary" />
                Upload Denah Indoor
              </CardTitle>
            </CardHeader>
            <CardContent>
              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-secondary/30 transition-all">
                <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                <span className="text-[10px] text-muted-foreground">
                  Klik untuk upload PNG/JPG/SVG
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
              {selectedZone?.floorPlanUrl && (
                <p className="text-[10px] text-emerald-500 mt-2 font-mono truncate">
                  ✓ {selectedZone.floorPlanUrl.split('/').pop()}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* ─── ANCHOR PLACEMENT & INVENTORY PANEL ─────────────────── */}
        {selectedZoneId && (
          <Card className="rounded-2xl border-border shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold flex items-center justify-between text-foreground">
                <span className="flex items-center gap-2">
                  <Radio className="h-4 w-4 text-cyan-400" />
                  Penempatan Anchor
                </span>
                <Badge variant="secondary" className="text-[10px]">
                  {selectedZone?.anchors?.length || 0} Placed
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-[10px] text-muted-foreground">
                Pilih Anchor di bawah ini untuk ditempatkan pada denah, atau geser marker di peta.
              </p>

              {/* Anchors List */}
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {allTenantAnchors.map((an) => {
                  const isPlacedOnCurrent = an.zoneId === selectedZoneId;
                  const isPlacedElsewhere = an.zoneId && !isPlacedOnCurrent;

                  return (
                    <div
                      key={an.id}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs ${
                        isPlacedOnCurrent
                          ? 'bg-cyan-950/20 border-cyan-500/30 text-cyan-300'
                          : 'bg-secondary/40 border-border text-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate mr-2">
                        <Radio className={`h-3.5 w-3.5 flex-shrink-0 ${isPlacedOnCurrent ? 'text-cyan-400' : 'text-muted-foreground'}`} />
                        <div className="truncate">
                          <div className="font-bold text-[11px] truncate">{an.name}</div>
                          <div className="text-[9px] text-muted-foreground font-mono">
                            {isPlacedOnCurrent
                              ? `Pos: (${an.x}m, ${an.y}m)`
                              : isPlacedElsewhere
                              ? `On ${an.zone?.name || 'Other Zone'}`
                              : 'Unplaced'}
                          </div>
                        </div>
                      </div>

                      {isPlacedOnCurrent ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-1.5 text-[10px] text-destructive hover:bg-destructive/10 cursor-pointer"
                          onClick={() => handleUnassignAnchor(an.id)}
                          title="Hapus dari denah"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[10px] border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 cursor-pointer flex-shrink-0"
                          onClick={() => handleAssignAnchor(an.id)}
                        >
                          <Plus className="h-3 w-3 mr-1" /> Place
                        </Button>
                      )}
                    </div>
                  );
                })}

                {allTenantAnchors.length === 0 && (
                  <p className="text-[10px] text-muted-foreground italic">
                    Belum ada Anchor terdaftar pada tenant ini.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Geofence Zones List */}
        {selectedZone && (
          <Card className="rounded-2xl border-border shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold flex items-center justify-between text-foreground">
                <span className="flex items-center gap-2">
                  <Hexagon className="h-4 w-4 text-amber-400" />
                  Geofence Zones
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] px-2 cursor-pointer"
                  onClick={() => {
                    setShowNewGeofenceForm(true);
                    setDrawMode('draw_zone');
                    setDrawingPoints([]);
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" /> Add Zone
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {selectedZone.geofences?.map((gf) => (
                <div
                  key={gf.id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/50 border border-border text-xs"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: gf.color }} />
                    <div>
                      <div className="font-bold text-foreground">{gf.name}</div>
                      <div className="text-[10px] text-muted-foreground">{gf.type}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteGeofence(gf.id)}
                    className="text-destructive hover:text-destructive/80 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}

              {selectedZone.geofences?.length === 0 && (
                <p className="text-[10px] text-muted-foreground italic">No geofence zones defined yet.</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* New Geofence Form */}
        {showNewGeofenceForm && (
          <Card className="rounded-2xl border-primary/30 shadow-md bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold flex items-center justify-between text-foreground">
                <span className="flex items-center gap-2">
                  <PenTool className="h-4 w-4 text-primary" />
                  Draw New Geofence
                </span>
                <button
                  onClick={() => {
                    setShowNewGeofenceForm(false);
                    setDrawMode('pointer');
                    setDrawingPoints([]);
                  }}
                  className="cursor-pointer"
                >
                  <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-[10px] text-muted-foreground font-bold uppercase">Name</label>
                <input
                  type="text"
                  className="w-full mt-1 px-3 py-1.5 rounded-lg bg-background border border-border text-xs text-foreground"
                  placeholder="e.g., Loading Dock A"
                  value={newGeofenceName}
                  onChange={(e) => setNewGeofenceName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground font-bold uppercase">Type</label>
                <div className="flex gap-2 mt-1">
                  {(['RESTRICTED', 'WARNING', 'SAFE'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setNewGeofenceType(t)}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border cursor-pointer transition-all ${
                        newGeofenceType === t
                          ? t === 'RESTRICTED'
                            ? 'bg-red-500/10 border-red-500 text-red-400'
                            : t === 'WARNING'
                            ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                            : 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                          : 'bg-secondary/50 border-border text-muted-foreground'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground">
                <span className="font-bold text-foreground">{drawingPoints.length}</span> points drawn.
                Click on the map to add points.
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 h-7 text-[10px] cursor-pointer"
                  disabled={drawingPoints.length < 3 || !newGeofenceName.trim()}
                  onClick={handleSaveGeofence}
                >
                  <Save className="h-3 w-3 mr-1" /> Save Zone
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] cursor-pointer"
                  onClick={() => setDrawingPoints([])}
                >
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ─── RIGHT CANVAS (LEAFLET MAP EDITOR) ────────────────────── */}
      <div className="flex-1 flex flex-col gap-3 min-h-0">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-card border border-border shadow-sm">
          <span className="text-xs font-bold text-foreground flex items-center gap-2">
            <PenTool className="h-4 w-4 text-primary" />
            RTLS Planner
          </span>
          <div className="flex-1" />
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setDrawMode('pointer');
                setDrawingPoints([]);
                setShowNewGeofenceForm(false);
              }}
              className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                drawMode === 'pointer'
                  ? 'bg-primary/10 text-primary border border-primary/30'
                  : 'bg-secondary/50 text-muted-foreground border border-border hover:bg-secondary'
              }`}
              title="Pointer / Move Elements"
            >
              <MousePointer className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setDrawMode('draw_zone');
                setShowNewGeofenceForm(true);
                setDrawingPoints([]);
              }}
              className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                drawMode === 'draw_zone'
                  ? 'bg-primary/10 text-primary border border-primary/30'
                  : 'bg-secondary/50 text-muted-foreground border border-border hover:bg-secondary'
              }`}
              title="Draw Geofence Zone"
            >
              <Hexagon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Map Canvas */}
        <div className="flex-1 rounded-2xl overflow-hidden border border-border shadow-2xl bg-card relative min-h-[500px]">
          {!selectedZoneId && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-card/95 backdrop-blur-sm">
              <Layers className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground font-bold font-sans">Select a Zone</p>
              <p className="text-[11px] text-muted-foreground mt-1 font-sans">
                Choose a zone from the left panel to begin editing floor plan and placing anchors.
              </p>
            </div>
          )}
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/80 backdrop-blur-sm">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <div ref={mapContainerRef} className="w-full h-full min-h-[500px]" />
        </div>
      </div>
    </div>
  );
}
