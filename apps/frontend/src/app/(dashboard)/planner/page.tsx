'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { getApiUrl, getBackendUrl } from '../../lib/api';
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
  Building2,
  Pencil,
  ArrowLeft,
  Palette,
  Move,
  Check,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Box,
} from 'lucide-react';
import ConfirmModal from '../../components/ConfirmModal';

// ─── Types ────────────────────────────────────────────────────────────
interface ZoneData {
  id: string;
  name: string;
  floorPlanUrl: string | null;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
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
  updatedAt?: string | null;
  voltage?: number | null;
  lastSeen?: string | null;
}

interface GeofenceData {
  id: string;
  name: string;
  points: string;
  color: string;
  type: string;
}

interface SiteData {
  id: string;
  name: string;
}

// ─── Planner Page ─────────────────────────────────────────────────────
export default function PlannerPage() {
  const { tenantId, token, isAdmin } = useAuth();
  const { assets } = useSocket();

  const [zones, setZones] = useState<ZoneData[]>([]);
  const [sites, setSites] = useState<SiteData[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<ZoneData | null>(null);
  const [allTenantAnchors, setAllTenantAnchors] = useState<AnchorData[]>([]);
  const [allTenantMesh, setAllTenantMesh] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [simulateToggle, setSimulateToggle] = useState(false);

  // Custom Legend Visibility State
  const [showLegend, setShowLegend] = useState(true);
  const [layerVisibility, setLayerVisibility] = useState({
    geofence: true,
    anchor: true,
    mesh: true,
    threads: true,
  });
  const [plannerConfirm, setPlannerConfirm] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    variant?: 'danger' | 'warning' | 'info';
    confirmText?: string;
  } | null>(null);

  // New Zone Form state
  const [showNewZoneForm, setShowNewZoneForm] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneSiteId, setNewZoneSiteId] = useState('');
  const [newZoneWidth, setNewZoneWidth] = useState(50);
  const [newZoneHeight, setNewZoneHeight] = useState(30);

  // Edit Zone Form state
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [editZoneName, setEditZoneName] = useState('');
  const [editZoneSiteId, setEditZoneSiteId] = useState('');
  const [editZoneWidth, setEditZoneWidth] = useState(50);
  const [editZoneHeight, setEditZoneHeight] = useState(30);
  const [editZoneOffsetX, setEditZoneOffsetX] = useState(0);
  const [editZoneOffsetY, setEditZoneOffsetY] = useState(0);

  // New Anchor Form state
  const [showNewAnchorForm, setShowNewAnchorForm] = useState(false);
  const [newAnchorName, setNewAnchorName] = useState('');
  const [newAnchorHardwareId, setNewAnchorHardwareId] = useState('');

  // Geofence draw state & color picker
  const PRESET_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#38bdf8', '#a855f7', '#ec4899'];
  const [drawMode, setDrawMode] = useState<'pointer' | 'draw_zone'>('pointer');
  const [drawingPoints, setDrawingPoints] = useState<{ x: number; y: number }[]>([]);
  const [newGeofenceName, setNewGeofenceName] = useState('');
  const [newGeofenceColor, setNewGeofenceColor] = useState<string>('#38bdf8');
  const [showNewGeofenceForm, setShowNewGeofenceForm] = useState(false);
  // Edit Geofence metadata state
  const [editingGeofenceId, setEditingGeofenceId] = useState<string | null>(null);
  const [editGeofenceName, setEditGeofenceName] = useState('');
  const [editGeofenceColor, setEditGeofenceColor] = useState<string>('#38bdf8');
  // Edit Geofence POINTS state (vertex drag editing on canvas)
  const [editingGeofencePointsId, setEditingGeofencePointsId] = useState<string | null>(null);
  const [editingGeofencePoints, setEditingGeofencePoints] = useState<{ x: number; y: number }[]>([]);

  // Map refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const imageOverlayRef = useRef<any>(null);
  const geofenceLayerRef = useRef<any>(null);
  const markerLayerRef = useRef<any>(null);
  // Zone rectangles layer (all zones as draggable rectangles on CRS.Simple canvas)
  const zoneLayerRef = useRef<any>(null);
  const zoneRectanglesRef = useRef<Map<string, any>>(new Map());
  // Separate layer specifically for mesh/asset markers so they can update independently
  const meshLayerRef = useRef<any>(null);
  const meshLineLayerRef = useRef<any>(null);
  // Track individual mesh Leaflet marker instances for smooth position updates
  const meshMarkersRef = useRef<Map<string, any>>(new Map());
  const meshLinesRef = useRef<Map<string, any[]>>(new Map());
  // Geofence vertex editing layer
  const editPointsLayerRef = useRef<any>(null);
  const editPointsPolygonRef = useRef<any>(null);

  // ─── RSSI-Weighted Centroid Position Calculator ──────────────────────
  // Given anchor positions (plan-meter coords) and RSSI readings from asset description/signals,
  // compute weighted centroid. Returns null if insufficient data.
  const computeRssiPosition = useCallback(
    (asset: any, zoneAnchors: AnchorData[]): { x: number; y: number } | null => {
      let rssiList: { x: number; y: number; rssi: number; anchorName: string }[] = [];

      // --- Try asset.description attributes (dynamic telemetry from MQTT) ---
      try {
        if (asset.description && asset.description.startsWith('{')) {
          const desc = JSON.parse(asset.description);
          const attrs: any[] = desc.attributes || [];
          attrs.forEach((attr: any) => {
            if (attr.name.startsWith('rssi_') && attr.value !== undefined && attr.value !== null && attr.value !== '') {
              const rssiVal = Number(attr.value);
              if (!isNaN(rssiVal)) {
                // anchorId = everything after 'rssi_'
                const anchorId = attr.name.replace('rssi_', '');
                // Match by anchorId or partial name match
                const matchedAnchor = zoneAnchors.find(
                  (an) =>
                    an.id === anchorId ||
                    an.name.toLowerCase().replace(/\s+/g, '_') === anchorId.toLowerCase() ||
                    an.name.toLowerCase().includes(anchorId.toLowerCase())
                );
                if (matchedAnchor) {
                  rssiList.push({ x: matchedAnchor.x, y: matchedAnchor.y, rssi: rssiVal, anchorName: matchedAnchor.name });
                }
              }
            }
          });
        }
      } catch (e) { }

      // --- Try asset.tag.signals (stored signals JSON) ---
      if (rssiList.length === 0 && asset.tag?.signals) {
        try {
          const sigs = JSON.parse(asset.tag.signals);
          if (Array.isArray(sigs)) {
            sigs.forEach((s: any) => {
              if (s.rssi !== undefined && s.rssi !== null) {
                const matchedAnchor = zoneAnchors.find(
                  (an) =>
                    an.id === s.anchorId ||
                    an.name === s.anchorName ||
                    an.name.toLowerCase().includes((s.anchorName || '').toLowerCase())
                );
                if (matchedAnchor) {
                  rssiList.push({ x: matchedAnchor.x, y: matchedAnchor.y, rssi: Number(s.rssi), anchorName: matchedAnchor.name });
                }
              }
            });
          }
        } catch (e) { }
      }

      if (rssiList.length === 0) return null;

      // Sort by strongest signal - use top 3 for centroid
      rssiList.sort((a, b) => b.rssi - a.rssi);
      const top = rssiList.slice(0, 3);

      // --- APPLY OPTIMIZED DYNAMIC EXPONENT WEIGHTING ---
      let exponent = 2.0;
      if (top.length > 1) {
        const delta = top[0].rssi - top[1].rssi;
        if (delta <= 3) {
          exponent = 2.0; // In the middle: use smooth quadratic average
        } else if (delta >= 15) {
          exponent = 6.0; // Very close to one anchor: snap aggressively
        } else {
          exponent = 2.0 + ((delta - 3) / 12) * 4.0; // Smooth transition
        }
      } else if (top.length === 1) {
        exponent = 6.0;
      }

      // Weighted centroid: weight = (rssi + 100)^exponent (linear distance proxy)
      let totalWeight = 0;
      let weightedX = 0;
      let weightedY = 0;
      top.forEach((item) => {
        const normalizedRssi = Math.max(-100, Math.min(-30, item.rssi));
        const weight = Math.pow(normalizedRssi + 100, exponent);
        weightedX += item.x * weight;
        weightedY += item.y * weight;
        totalWeight += weight;
      });
      if (totalWeight === 0) return null;

      return {
        x: Math.round((weightedX / totalWeight) * 100) / 100,
        y: Math.round((weightedY / totalWeight) * 100) / 100,
      };
    },
    []
  );

  const apiHeaders = useCallback(() => {
    const h: Record<string, string> = { 'x-tenant-id': tenantId || '' };
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  }, [tenantId, token]);

  // ─── Fetch Sites & Zones ───────────────────────────────────────────
  const fetchSitesAndZones = useCallback(async () => {
    if (!tenantId) return;
    try {
      const [zonesRes, sitesRes] = await Promise.all([
        fetch(`${getApiUrl()}/zones`, { headers: apiHeaders() }),
        fetch(`${getApiUrl()}/sites`, { headers: apiHeaders() }),
      ]);
      if (zonesRes.ok) {
        const data = await zonesRes.json();
        setZones(data);
      }
      if (sitesRes.ok) {
        const data = await sitesRes.json();
        setSites(data);
        if (data.length > 0 && !newZoneSiteId) {
          setNewZoneSiteId(data[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to fetch sites/zones:', e);
    }
  }, [tenantId, apiHeaders, newZoneSiteId]);

  // ─── Fetch All Tenant Anchors ──────────────────────────────────────
  const fetchAllAnchors = useCallback(async () => {
    if (!tenantId) return;
    try {
      const res = await fetch(`${getApiUrl()}/floorplan/anchors`, { headers: apiHeaders() });
      if (res.ok) {
        const data = await res.json();
        setAllTenantAnchors(data);
      }
    } catch (e) {
      console.error('Failed to fetch anchors:', e);
    }
  }, [tenantId, apiHeaders]);

  // ─── Fetch All Tenant Mesh/Assets ─────────────────────────────────
  const fetchAllMesh = useCallback(async () => {
    if (!tenantId) return;
    try {
      const res = await fetch(`${getApiUrl()}/floorplan/mesh`, { headers: apiHeaders() });
      if (res.ok) {
        const data = await res.json();
        setAllTenantMesh(data);
      }
    } catch (e) {
      console.error('Failed to fetch mesh assets:', e);
    }
  }, [tenantId, apiHeaders]);

  useEffect(() => {
    fetchSitesAndZones();
    fetchAllAnchors();
    fetchAllMesh();
  }, [fetchSitesAndZones, fetchAllAnchors, fetchAllMesh]);

  // ─── Fetch Selected Zone Details ───────────────────────────────────
  const fetchZoneDetails = useCallback(async (zoneId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/floorplan/zones/${zoneId}`, {
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
      if (meshLayerRef.current) meshLayerRef.current.clearLayers();
      if (meshLineLayerRef.current) meshLineLayerRef.current.clearLayers();
      if (meshMarkersRef.current) meshMarkersRef.current.clear();
      if (meshLinesRef.current) meshLinesRef.current.clear();
    }
  }, [selectedZoneId, fetchZoneDetails]);

  // Synchronize layer visibility with map
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    if (geofenceLayerRef.current) {
      if (layerVisibility.geofence) map.addLayer(geofenceLayerRef.current);
      else map.removeLayer(geofenceLayerRef.current);
    }
    if (markerLayerRef.current) {
      if (layerVisibility.anchor) map.addLayer(markerLayerRef.current);
      else map.removeLayer(markerLayerRef.current);
    }
    if (meshLayerRef.current) {
      if (layerVisibility.mesh) map.addLayer(meshLayerRef.current);
      else map.removeLayer(meshLayerRef.current);
    }
    if (meshLineLayerRef.current) {
      if (layerVisibility.threads) map.addLayer(meshLineLayerRef.current);
      else map.removeLayer(meshLineLayerRef.current);
    }
  }, [layerVisibility, selectedZoneId]); // Trigger also on zone load

  //  Initialize Leaflet Map ────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current) return;
    const L = require('leaflet');

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      crs: L.CRS.Simple,
      minZoom: -4,
      maxZoom: 10,
      zoomControl: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      dragging: true,
    });
    mapRef.current = map;

    // Initialize overlay layers
    geofenceLayerRef.current = L.layerGroup().addTo(map);
    markerLayerRef.current = L.layerGroup().addTo(map);
    // Zone rectangles layer (bottom)
    zoneLayerRef.current = L.layerGroup().addTo(map);
    // Mesh layer is on top so it renders above anchors
    meshLayerRef.current = L.layerGroup().addTo(map);
    // Geofence vertex editing layer (topmost so handles are always clickable)
    editPointsLayerRef.current = L.layerGroup().addTo(map);
    // Mesh Line layer
    meshLineLayerRef.current = L.layerGroup().addTo(map);



    // Set default view to center of a 100x100 area
    map.setView([50, 50], 0);

    return () => {
      meshMarkersRef.current.clear();
      zoneRectanglesRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ─── Zone Layer Management ─────────────────────────────────────────
  // Clear all overlay markers when no zone is selected (overview mode)
  useEffect(() => {
    const zoneLayer = zoneLayerRef.current;
    if (zoneLayer) {
      zoneLayer.clearLayers();
    }
  }, [zones, selectedZoneId]);


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
    meshLineLayerRef.current?.clearLayers();

    if (!selectedZone) return;

    const w = selectedZone.width || 100;
    const h = selectedZone.height || 100;
    const bounds: [[number, number], [number, number]] = [[0, 0], [h, w]];

    // Render floor plan image if available
    if (selectedZone.floorPlanUrl) {
      const imageUrl = `${getBackendUrl()}${selectedZone.floorPlanUrl}`;
      imageOverlayRef.current = L.imageOverlay(imageUrl, bounds, {
        opacity: 0.85,
        interactive: false,
      }).addTo(map);
    }

    map.fitBounds(bounds);
    map.setMaxBounds(bounds);
    setTimeout(() => {
      if (mapRef.current) {
        const minZ = mapRef.current.getBoundsZoom(bounds, false);
        mapRef.current.setMinZoom(minZ);
      }
    }, 50);

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
        } catch (e) { }
      });
    }

    // Draw anchor markers (interactive drag & update)
    if (selectedZone.anchors) {
      selectedZone.anchors.forEach((anchor: AnchorData) => {
        const icon = L.divIcon({
          className: 'custom-anchor-icon',
          html: `
            <div style="position: absolute; transform: translate(-50%, -100%); display:flex;flex-direction:column;align-items:center; pointer-events: auto;">
              <div style="background:#0f172a;color:#38bdf8;border:1px solid #334155;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:bold;white-space:nowrap;margin-bottom:2px;box-shadow:0 2px 4px rgba(0,0,0,0.5);">
                ⚓ ${anchor.name}
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#38bdf8" width="28" height="28" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4));">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" stroke="#ffffff" stroke-width="1"/>
              </svg>
              </div>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });

        const anchorStatus = anchor.status || 'offline';
        const anchorIsOnline = anchorStatus === 'online' || anchorStatus === 'active';
        const anchorStatusColor = anchorIsOnline ? '#22c55e' : '#64748b';
        const anchorVoltage = (anchor as any).voltage;
        const anchorLastSeen = (anchor as any).lastSeen || (anchor as any).updatedAt;
        const anchorLastUpdate = anchorLastSeen
          ? (() => {
              const diff = Date.now() - new Date(anchorLastSeen).getTime();
              const mins = Math.floor(diff / 60000);
              const hrs = Math.floor(mins / 60);
              if (hrs > 0) return hrs + 'h ' + (mins % 60) + 'm ago';
              if (mins > 0) return mins + 'm ago';
              return 'Just now';
            })()
          : 'N/A';

        const anchorTooltipHtml = [
          '<div style="font-family:sans-serif;padding:6px 8px;min-width:160px;background:#0f172a;border:1px solid #334155;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.5);">',
            '<div style="font-weight:bold;color:#38bdf8;font-size:11px;margin-bottom:6px;border-bottom:1px solid #1e293b;padding-bottom:4px;">&#9875; ' + anchor.name + '</div>',
            '<div style="display:flex;flex-direction:column;gap:3px;">',
              '<div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;">',
                '<span style="color:#94a3b8;">Status</span>',
                '<span style="color:' + anchorStatusColor + ';font-weight:bold;font-size:10px;">' + (anchorIsOnline ? '&#128994; Online' : '&#9898; ' + anchorStatus.charAt(0).toUpperCase() + anchorStatus.slice(1)) + '</span>',
              '</div>',
              '<div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;">',
                '<span style="color:#94a3b8;">Voltage</span>',
                '<span style="color:#fbbf24;font-weight:bold;font-family:monospace;font-size:10px;">' + (anchorVoltage !== null && anchorVoltage !== undefined ? anchorVoltage.toFixed(2) + ' V' : 'N/A') + '</span>',
              '</div>',
              '<div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;">',
                '<span style="color:#94a3b8;">Last Update</span>',
                '<span style="color:#94a3b8;font-family:monospace;font-size:9px;">' + anchorLastUpdate + '</span>',
              '</div>',
              '<div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;margin-top:2px;border-top:1px solid #1e293b;padding-top:3px;">',
                '<span style="color:#475569;font-size:9px;">Position</span>',
                '<span style="color:#475569;font-family:monospace;font-size:9px;">(' + anchor.x + 'm, ' + anchor.y + 'm)</span>',
              '</div>',
            '</div>',
          '</div>',
        ].join('');

        L.marker([anchor.y, anchor.x], { icon, draggable: true })
          .addTo(markerLayerRef.current)
          .bindTooltip(anchorTooltipHtml, { sticky: true, className: 'anchor-info-tooltip', opacity: 1 })
          .on('dragend', async function (e: any) {
            const pos = e.target.getLatLng();
            const newX = Number(pos.lng.toFixed(2));
            const newY = Number(pos.lat.toFixed(2));
            try {
              await fetch(`${getApiUrl()}/floorplan/anchors/${anchor.id}/position`, {
                method: 'PATCH',
                headers: { ...apiHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ x: newX, y: newY }),
              });
              fetchAllAnchors();
              if (selectedZoneId) {
                fetchZoneDetails(selectedZoneId);
              }
            } catch (err) {
              console.error('Failed to update anchor position:', err);
            }
          });
      });
    }

    // NOTE: Mesh/asset markers are rendered by a SEPARATE real-time useEffect below
    // so that RSSI position updates don't trigger a full layer clear/re-render.
  }, [selectedZone, apiHeaders, fetchAllAnchors, fetchZoneDetails, selectedZoneId]);

  // ─── Real-Time Mesh Marker Rendering (RSSI-based positioning) ────────
  // This effect runs whenever `assets` changes (via WebSocket assetUpdate events)
  // and updates only the mesh markers WITHOUT touching anchor/geofence layers.
  useEffect(() => {
    const map = mapRef.current;
    const meshLayer = meshLayerRef.current;
    if (!map || !meshLayer || !selectedZone) return;
    const L = require('leaflet');

    const zoneAnchors: AnchorData[] = selectedZone.anchors || [];
    const zoneW = selectedZone.width || 100;
    const zoneH = selectedZone.height || 100;

    // Filter to assets that belong to this zone and are not anchors
    const zoneAssets = assets.filter(
      (a) =>
        (a.zoneId === selectedZone.id || selectedZone.assets?.some((za: any) => za.id === a.id)) &&
        a.type !== 'ANCHOR' &&
        !a.type.startsWith('AGENT_')
    );

    // Fallback: also show assets already in selectedZone.assets that might not be in socket yet
    const socketIds = new Set(zoneAssets.map((a) => a.id));
    const fallbackAssets = (selectedZone.assets || []).filter((za: any) => !socketIds.has(za.id));

    const allDisplayAssets = [
      ...zoneAssets,
      ...fallbackAssets,
    ].filter(
      (a: any) =>
        a.type?.toUpperCase() !== 'ANCHOR' &&
        !a.type?.toUpperCase().startsWith('AGENT_') &&
        !a.name?.toUpperCase().includes('ANCHOR')
    );

    const currentIds = new Set(allDisplayAssets.map((a: any) => a.id));

    // Remove markers for assets no longer in zone
    for (const [id, marker] of meshMarkersRef.current.entries()) {
      if (!currentIds.has(id)) {
        meshLayer.removeLayer(marker);
        meshMarkersRef.current.delete(id);
      }
    }

    allDisplayAssets.forEach((asset: any) => {
      // 1. Try RSSI-weighted centroid from anchor signals
      const rssiPos = computeRssiPosition(asset, zoneAnchors);

      // 2. Fallback: use planX/planY stored on asset
      let x = asset.planX !== null && asset.planX !== undefined ? Number(asset.planX) : zoneW / 2;
      let y = asset.planY !== null && asset.planY !== undefined ? Number(asset.planY) : zoneH / 2;

      if (rssiPos) {
        x = rssiPos.x;
        y = rssiPos.y;
      }

      // Build RSSI signal tooltip
      let signalLines = '';
      try {
        if (asset.description && asset.description.startsWith('{')) {
          const desc = JSON.parse(asset.description);
          const attrs: any[] = desc.attributes || [];
          const rssiAttrs = attrs.filter((a: any) => a.name.startsWith('rssi_') && a.value !== '' && a.value !== null && a.value !== undefined);
          if (rssiAttrs.length > 0) {
            signalLines = rssiAttrs
              .sort((a: any, b: any) => Number(b.value) - Number(a.value))
              .map((a: any) => `• ${a.name.replace('rssi_', '').replace(/_/g, ' ')}: <strong>${a.value} dBm</strong>`)
              .join('<br/>');
          }
        }
        if (!signalLines && asset.tag?.signals) {
          const sigs = JSON.parse(asset.tag.signals);
          if (Array.isArray(sigs) && sigs.length > 0) {
            signalLines = sigs
              .sort((a: any, b: any) => Number(b.rssi) - Number(a.rssi))
              .map((s: any) => `• ${s.anchorName}: <strong>${s.rssi} dBm</strong>`)
              .join('<br/>');
          }
        }
      } catch (e) { }

      const isOnline = (() => {
        if (asset.tag?.lastSeen) {
          const diffMs = Date.now() - new Date(asset.tag.lastSeen).getTime();
          return diffMs < 300000;
        }
        return asset.status === 'moving' || asset.status === 'static';
      })();

      const dotColor = isOnline ? '#22c55e' : '#64748b';
      const positionMethod = '';

      const iconHtml = `
        <div style="position: absolute; transform: translate(-50%, -100%); display:flex;flex-direction:column;align-items:center; pointer-events: auto;">
          <div style="background:#0f172a;color:${dotColor};border:1px solid #334155;padding:2px 7px;border-radius:5px;font-size:9px;font-weight:bold;white-space:nowrap;margin-bottom:2px;box-shadow:0 2px 6px rgba(0,0,0,0.5);display:flex;align-items:center;gap:3px;">
            <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${dotColor};${isOnline ? 'animation:pulse 1.5s infinite;box-shadow:0 0 0 0 ' + dotColor + '66;' : ''}"></span>
            ${asset.name}
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${dotColor}" width="26" height="26" style="filter:drop-shadow(0 2px 5px rgba(0,0,0,0.5));">
            <path d="M17.707 3.293a1 1 0 0 0-1.414 0L12 7.586 7.707 3.293a1 1 0 0 0-1.414 1.414L10.586 9l-4.293 4.293a1 1 0 1 0 1.414 1.414L12 10.414l4.293 4.293a1 1 0 0 0 1.414-1.414L13.414 9l4.293-4.293a1 1 0 0 0 0-1.414z" style="display:none"/>
            <circle cx="12" cy="12" r="5" stroke="white" stroke-width="1.5"/>
            <path d="M8.5 5.5 Q12 2 15.5 5.5" stroke="${dotColor}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
            <path d="M6 3.5 Q12 -1 18 3.5" stroke="${dotColor}" stroke-width="1.2" fill="none" stroke-linecap="round" opacity="0.6"/>
          </svg>
          </div>`;

      const icon = L.divIcon({
        className: 'custom-mesh-icon',
        html: iconHtml,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const meshBattery = asset.tag?.battery;
      const meshTemp = asset.tag?.temperature;
      const meshHumidity = asset.tag?.humidity;
      const meshLastSeen = asset.tag?.lastSeen;
      const meshLastUpdate = meshLastSeen
        ? (() => {
            const diff = Date.now() - new Date(meshLastSeen).getTime();
            const mins = Math.floor(diff / 60000);
            const hrs = Math.floor(mins / 60);
            if (hrs > 0) return `${hrs}h ${mins % 60}m ago`;
            if (mins > 0) return `${mins}m ago`;
            return 'Just now';
          })()
        : null;

      const sensorLines = [
        meshBattery !== null && meshBattery !== undefined ? `&#128267; Battery: <strong>${meshBattery.toFixed(0)}%</strong>` : null,
        meshTemp !== null && meshTemp !== undefined ? `&#127777; Temp: <strong>${meshTemp.toFixed(1)}&deg;C</strong>` : null,
        meshHumidity !== null && meshHumidity !== undefined ? `&#128167; Humidity: <strong>${meshHumidity.toFixed(1)}%</strong>` : null,
      ].filter(Boolean).join('<br/>');

      const tooltipHtml = `
        <div style="font-family:sans-serif;padding:3px;min-width:160px">
          <strong style="color:${dotColor}">${asset.name}</strong><br/>
          <span style="font-size:10px;color:#64748b">Status: ${isOnline ? '&#128994; Online' : '&#9898; Offline'}</span><br/>
          <span style="font-size:10px;color:#64748b">Position: (${x}m, ${y}m)</span>
          ${sensorLines ? `<div style="margin-top:4px;border-top:1px solid #334155;padding-top:4px;font-size:9px;color:#94a3b8;">${sensorLines}</div>` : ''}
          ${meshLastUpdate ? `<div style="font-size:9px;color:#475569;margin-top:2px;">&#128336; ${meshLastUpdate}</div>` : ''}
          ${signalLines ? `<div style="margin-top:4px;border-top:1px solid #334155;padding-top:4px;font-size:9px;color:#94a3b8;"><strong>Anchor RSSI:</strong><br/>${signalLines}</div>` : ''}
        </div>`;

      const existingMarker = meshMarkersRef.current.get(asset.id);
      if (existingMarker) {
        // Smoothly move marker to new position
        existingMarker.setLatLng([y, x]);
        existingMarker.setIcon(icon);
        existingMarker.setTooltipContent(tooltipHtml);
      } else {
        const marker = L.marker([y, x], { icon, draggable: isOnline ? false : true }).addTo(meshLayerRef.current);
        marker.bindTooltip(tooltipHtml, { sticky: true, className: 'mesh-tooltip' });
        marker.on('dragend', async function (e: any) {
          const pos = e.target.getLatLng();
          const newPlanX = Number(pos.lng.toFixed(2));
          const newPlanY = Number(pos.lat.toFixed(2));
          try {
            await fetch(`${getApiUrl()}/floorplan/mesh/${asset.id}/position`, {
              method: 'PATCH',
              headers: { ...apiHeaders(), 'Content-Type': 'application/json' },
              body: JSON.stringify({ planX: newPlanX, planY: newPlanY }),
            });
          } catch (err) {
            console.error('Failed to update asset position:', err);
          }
        });
        meshMarkersRef.current.set(asset.id, marker);
      }

      // --- NEW: Draw Pulling Threads (Polylines) ---
      // 1. Clear old lines for this asset
      const oldLines = meshLinesRef.current.get(asset.id);
      if (oldLines) {
        oldLines.forEach((l: any) => l.remove());
      }
      const newLines: any[] = [];

      // 2. Parse signals and draw new lines
      try {
        if (asset.tag?.signals) {
          const sigs = JSON.parse(asset.tag.signals);
          if (Array.isArray(sigs)) {
            // Calculate total weight for percentages
            const totalWeight = sigs.reduce((sum: number, s: any) => sum + (Number(s.weight) || 0), 0);

            sigs.forEach((s: any) => {
              const matchedAnchor = zoneAnchors.find((an: any) =>
                an.id === s.anchorId ||
                an.name === s.anchorName ||
                (an.tagId && String(an.tagId) === String(s.anchorId)) ||
                (an.name && an.name.includes(String(s.anchorId)))
              );
              if (matchedAnchor && s.weight && totalWeight > 0) {
                const percentage = ((Number(s.weight) / totalWeight) * 100).toFixed(1);
                // Calculate opacity: base 0.15 + up to 0.7 based on weight
                const opacity = 0.15 + (Number(s.weight) / totalWeight) * 0.7;

                const lineColor = isOnline ? '#22c55e' : '#f97316'; // Green for online, Orange for offline
                const line = L.polyline([[Number(y), Number(x)], [Number(matchedAnchor.y), Number(matchedAnchor.x)]], {
                  color: lineColor,
                  weight: 1.5,
                  opacity: opacity,
                  dashArray: '4, 6'
                }).addTo(meshLineLayerRef.current);

                // Add percentage tooltip
                line.bindTooltip(`${percentage}%`, {
                  permanent: true,
                  direction: 'center',
                  className: 'font-mono font-bold text-[9px] bg-transparent border-0 shadow-none text-muted-foreground'
                });

                newLines.push(line);
              }
            });
          }
        }
      } catch (e) { }

      meshLinesRef.current.set(asset.id, newLines);
    });
  }, [assets, selectedZone, apiHeaders]);

  // ─── Sync selectedZone.assets list when socket updates bring zone changes ─
  // This only updates the zone's asset list (for mesh layer), NOT the Leaflet markers directly.
  useEffect(() => {
    if (!selectedZone || !assets || !selectedZoneId) return;

    let hasChanges = false;

    // 1. Merge socket updates into zone assets
    const updatedAssets = selectedZone.assets?.map((za) => {
      const match = assets.find((sa) => sa.id === za.id);
      if (match && (match.status !== za.status || match.zoneId !== za.zoneId || match.tag?.signals !== za.tag?.signals || match.description !== za.description)) {
        hasChanges = true;
        return { ...za, ...match };
      }
      return za;
    });

    // 2. Add newly assigned assets
    const newAssets = assets
      .filter((sa) => sa.zoneId === selectedZoneId && sa.type !== 'ANCHOR' && !selectedZone.assets?.some((za) => za.id === sa.id))
      .map((sa) => ({ ...sa }));

    if (newAssets.length > 0) hasChanges = true;

    if (hasChanges) {
      setSelectedZone((prev) => {
        if (!prev) return null;
        return { ...prev, assets: [...(updatedAssets || []), ...newAssets] };
      });
    }
  }, [assets, selectedZoneId]);

  // ─── Create New Zone ──────────────────────────────────────────────
  const handleCreateZone = async () => {
    const targetSiteId = newZoneSiteId || sites[0]?.id;
    if (!newZoneName.trim() || !targetSiteId) return;
    try {
      const res = await fetch(`${getApiUrl()}/zones`, {
        method: 'POST',
        headers: { ...apiHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId: targetSiteId,
          name: newZoneName,
          width: Number(newZoneWidth),
          height: Number(newZoneHeight),
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setNewZoneName('');
        setShowNewZoneForm(false);
        fetchSitesAndZones();
        setSelectedZoneId(created.id);
      }
    } catch (err) {
      console.error('Failed to create zone:', err);
    }
  };

  // ─── Edit Existing Zone ───────────────────────────────────────────
  const startEditZone = (z: ZoneData) => {
    setEditingZoneId(z.id);
    setEditZoneName(z.name);
    setEditZoneSiteId(z.siteId);
    setEditZoneWidth(z.width || 50);
    setEditZoneHeight(z.height || 30);
    setEditZoneOffsetX(z.offsetX ?? 0);
    setEditZoneOffsetY(z.offsetY ?? 0);
  };

  const handleUpdateZone = async () => {
    if (!editingZoneId || !editZoneName.trim()) return;
    try {
      const res = await fetch(`${getApiUrl()}/zones/${editingZoneId}`, {
        method: 'PATCH',
        headers: { ...apiHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editZoneName,
          siteId: editZoneSiteId,
          width: Number(editZoneWidth),
          height: Number(editZoneHeight),
          offsetX: Number(editZoneOffsetX),
          offsetY: Number(editZoneOffsetY),
        }),
      });
      if (res.ok) {
        setEditingZoneId(null);
        fetchSitesAndZones();
        if (selectedZoneId === editingZoneId) {
          fetchZoneDetails(editingZoneId);
        }
      }
    } catch (err) {
      console.error('Failed to update zone:', err);
    }
  };

  // ─── Delete Zone ──────────────────────────────────────────────────
  const handleDeleteZone = (zoneId: string, zoneName: string) => {
    setPlannerConfirm({
      title: 'Delete Floor Plan',
      message: `Apakah Anda yakin ingin menghapus denah "${zoneName}"? Semua data anchor dan geofence pada denah ini akan dihapus.`,
      variant: 'danger',
      confirmText: 'Delete Floor Plan',
      onConfirm: async () => {
        try {
          const res = await fetch(`${getApiUrl()}/zones/${zoneId}`, {
            method: 'DELETE',
            headers: apiHeaders(),
          });
          if (res.ok) {
            if (selectedZoneId === zoneId) {
              setSelectedZoneId(null);
              setSelectedZone(null);
            }
            fetchSitesAndZones();
          }
        } catch (err) {
          console.error('Failed to delete zone:', err);
        } finally {
          setPlannerConfirm(null);
        }
      }
    });
  };

  // ─── Save zone position from drag ────────────────────────────────
  const handleSaveZoneOffset = async (zoneId: string, offsetX: number, offsetY: number) => {
    try {
      await fetch(`${getApiUrl()}/zones/${zoneId}`, {
        method: 'PATCH',
        headers: { ...apiHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ offsetX, offsetY }),
      });
      // Update local zones state
      setZones((prev) =>
        prev.map((z) => (z.id === zoneId ? { ...z, offsetX, offsetY } : z))
      );
    } catch (err) {
      console.error('Failed to save zone position:', err);
    }
  };

  // ─── Create New Anchor Asset ──────────────────────────────────────
  const handleCreateAnchor = async () => {
    if (!newAnchorName.trim() || !selectedZoneId || !selectedZone) return;
    try {
      const descObj = newAnchorHardwareId
        ? { attributes: [{ name: 'anchorId', value: newAnchorHardwareId }] }
        : {};

      const res = await fetch(`${getApiUrl()}/assets`, {
        method: 'POST',
        headers: { ...apiHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newAnchorName,
          type: 'ANCHOR',
          status: 'online',
          description: JSON.stringify(descObj),
          latitude: selectedZone.width / 2,
          longitude: selectedZone.height / 2,
          zoneId: selectedZoneId,
          tagId: newAnchorHardwareId || undefined,
        }),
      });

      if (res.ok) {
        setNewAnchorName('');
        setNewAnchorHardwareId('');
        setShowNewAnchorForm(false);
        fetchZoneDetails(selectedZoneId);
        fetchAllAnchors();
      }
    } catch (err) {
      console.error('Failed to create anchor:', err);
    }
  };

  // ─── Assign Anchor to Selected Zone ───────────────────────────────
  const handleAssignAnchor = async (anchorId: string) => {
    if (!selectedZoneId || !selectedZone) return;
    try {
      const res = await fetch(`${getApiUrl()}/floorplan/zones/${selectedZoneId}/anchors/${anchorId}`, {
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
      const res = await fetch(`${getApiUrl()}/floorplan/anchors/${anchorId}`, {
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

  // ─── Delete Anchor Permanently from Database ──────────────────────
  const handleDeleteAnchor = (anchorId: string) => {
    setPlannerConfirm({
      title: 'Delete Anchor Permanently',
      message: 'Apakah Anda yakin ingin menghapus Anchor ini secara permanen dari database?',
      variant: 'danger',
      confirmText: 'Delete Permanently',
      onConfirm: async () => {
        try {
          // Since anchors are registered as assets (type: ANCHOR)
          const res = await fetch(`${getApiUrl()}/assets/${anchorId}`, {
            method: 'DELETE',
            headers: apiHeaders(),
          });
          if (res.ok) {
            fetchAllAnchors();
            if (selectedZoneId) fetchZoneDetails(selectedZoneId);
          } else {
            // Fallback for table anchors
            const res2 = await fetch(`${getApiUrl()}/floorplan/anchors/${anchorId}`, {
              method: 'DELETE',
              headers: apiHeaders(),
            });
            if (res2.ok) {
              fetchAllAnchors();
              if (selectedZoneId) fetchZoneDetails(selectedZoneId);
            }
          }
        } catch (err) {
          console.error('Failed to delete anchor:', err);
        } finally {
          setPlannerConfirm(null);
        }
      }
    });
  };

  // ─── Assign Mesh/Asset to Selected Zone ───────────────────────────
  const handleAssignMesh = async (assetId: string) => {
    if (!selectedZoneId || !selectedZone) return;
    try {
      const res = await fetch(
        `${getApiUrl()}/floorplan/zones/${selectedZoneId}/mesh/${assetId}`,
        {
          method: 'POST',
          headers: { ...apiHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            planX: selectedZone.width / 2,
            planY: selectedZone.height / 2,
          }),
        },
      );
      if (res.ok) {
        fetchZoneDetails(selectedZoneId);
        fetchAllMesh();
      }
    } catch (err) {
      console.error('Failed to assign mesh:', err);
    }
  };

  // ─── Unassign Mesh/Asset from Zone ───────────────────────────────
  const handleUnassignMesh = async (assetId: string) => {
    try {
      const res = await fetch(`${getApiUrl()}/floorplan/mesh/${assetId}`, {
        method: 'DELETE',
        headers: apiHeaders(),
      });
      if (res.ok) {
        if (selectedZoneId) fetchZoneDetails(selectedZoneId);
        fetchAllMesh();
      }
    } catch (err) {
      console.error('Failed to unassign mesh:', err);
    }
  };

  // ─── Recalculate Mesh Position from Real Anchor RSSI Signals ─────
  const handleSimulateRssi = async (assetId: string) => {
    try {
      const res = await fetch(`${getApiUrl()}/floorplan/mesh/${assetId}/rssi-position`, {
        method: 'POST',
        headers: { ...apiHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // Send empty body to trigger recalculation based on real database signals!
      });

      if (res.ok) {
        const data = await res.json();
        if (data.targetZoneId) {
          setSelectedZoneId(data.targetZoneId);
          fetchZoneDetails(data.targetZoneId);
        }
        fetchAllMesh();
      } else {
        const errData = await res.json();
        setPlannerConfirm({
          title: 'Informasi Kalibrasi',
          message: errData.message || 'Belum ada data nilai RSSI Anchor asli yang masuk ke Mesh ini.',
          variant: 'warning',
          confirmText: 'Tutup',
          onConfirm: () => setPlannerConfirm(null),
        });
      }
    } catch (err) {
      console.error('Failed to recalculate RSSI:', err);
    }
  };

  // ─── Handle Floor Plan Upload ──────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !selectedZoneId) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${getApiUrl()}/floorplan/zones/${selectedZoneId}/upload`, {
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

    try {
      const res = await fetch(`${getApiUrl()}/floorplan/zones/${selectedZoneId}/geofences`, {
        method: 'POST',
        headers: { ...apiHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newGeofenceName,
          points: JSON.stringify(drawingPoints),
          color: newGeofenceColor,
          type: 'GEOFENCE',
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
      await fetch(`${getApiUrl()}/floorplan/geofences/${geofenceId}`, {
        method: 'DELETE',
        headers: apiHeaders(),
      });
      if (selectedZoneId) fetchZoneDetails(selectedZoneId);
    } catch (err) {
      console.error('Failed to delete geofence:', err);
    }
  };

  // ─── Update Geofence Name/Color ───────────────────────────────────────
  const handleUpdateGeofence = async () => {
    if (!editingGeofenceId || !editGeofenceName.trim() || !selectedZoneId) return;
    try {
      const res = await fetch(`${getApiUrl()}/floorplan/geofences/${editingGeofenceId}`, {
        method: 'PATCH',
        headers: { ...apiHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editGeofenceName,
          color: editGeofenceColor,
          type: 'GEOFENCE',
        }),
      });
      if (res.ok) {
        setEditingGeofenceId(null);
        fetchZoneDetails(selectedZoneId);
      }
    } catch (err) {
      console.error('Failed to update geofence:', err);
    }
  };

  // ─── Update Geofence Vertex Points ─────────────────────────────────
  const handleSaveGeofencePoints = async () => {
    if (!editingGeofencePointsId || editingGeofencePoints.length < 3 || !selectedZoneId) return;
    try {
      const res = await fetch(`${getApiUrl()}/floorplan/geofences/${editingGeofencePointsId}`, {
        method: 'PATCH',
        headers: { ...apiHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          points: JSON.stringify(editingGeofencePoints),
        }),
      });
      if (res.ok) {
        setEditingGeofencePointsId(null);
        setEditingGeofencePoints([]);
        fetchZoneDetails(selectedZoneId);
      }
    } catch (err) {
      console.error('Failed to save geofence points:', err);
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
      const latLngs = drawingPoints.map((p) => [p.y, p.x] as [number, number]);
      L.polygon(latLngs, {
        color: newGeofenceColor,
        fillColor: newGeofenceColor,
        fillOpacity: 0.25,
        weight: 2.5,
        dashArray: '6 4',
        className: 'preview-polygon',
      }).addTo(geofenceLayerRef.current);
    }

    drawingPoints.forEach((p, i) => {
      L.circleMarker([p.y, p.x], {
        radius: 6,
        color: '#ffffff',
        fillColor: newGeofenceColor,
        fillOpacity: 1,
        weight: 2,
        className: 'preview-polygon',
      })
        .addTo(geofenceLayerRef.current)
        .bindTooltip(`P${i + 1}`, { permanent: true, direction: 'top', className: 'point-tooltip' });
    });
  }, [drawingPoints, newGeofenceColor]);

  // ─── Render Vertex Drag Markers when Editing Points ────────────────
  useEffect(() => {
    const editLayer = editPointsLayerRef.current;
    if (!editLayer) return;
    const L = require('leaflet');

    editLayer.clearLayers();

    if (!editingGeofencePointsId || editingGeofencePoints.length === 0) return;

    // Draw active editable polygon
    const latLngs = editingGeofencePoints.map((p) => [p.y, p.x] as [number, number]);
    L.polygon(latLngs, {
      color: '#f59e0b',
      fillColor: '#f59e0b',
      fillOpacity: 0.2,
      weight: 3,
      dashArray: '4 4',
    }).addTo(editLayer);

    // Vertex Markers (Draggable)
    editingGeofencePoints.forEach((p, idx) => {
      const icon = L.divIcon({
        className: '',
        html: `
          <div style="
            width:16px;height:16px;border-radius:50%;
            background:#f59e0b;border:2px solid #ffffff;
            box-shadow:0 2px 6px rgba(0,0,0,0.6);
            display:flex;align-items:center;justify-content:center;
            color:#000000;font-size:9px;font-weight:bold;cursor:move;
          ">
            ${idx + 1}
          </div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      const marker = L.marker([p.y, p.x], { icon, draggable: true }).addTo(editLayer);
      marker.bindTooltip(`Drag to move point ${idx + 1} (${p.x}m, ${p.y}m)`, { sticky: true });

      marker.on('dragend', (e: any) => {
        const pos = e.target.getLatLng();
        const newX = Math.round(Number(pos.lng) * 100) / 100;
        const newY = Math.round(Number(pos.lat) * 100) / 100;
        setEditingGeofencePoints((prev) =>
          prev.map((pt, i) => (i === idx ? { x: newX, y: newY } : pt))
        );
      });
    });

    // Midpoint Insert Handles (+ button between vertices)
    for (let i = 0; i < editingGeofencePoints.length; i++) {
      const p1 = editingGeofencePoints[i];
      const p2 = editingGeofencePoints[(i + 1) % editingGeofencePoints.length];
      const midX = Math.round(((p1.x + p2.x) / 2) * 100) / 100;
      const midY = Math.round(((p1.y + p2.y) / 2) * 100) / 100;

      const midIcon = L.divIcon({
        className: '',
        html: `
          <div style="
            width:14px;height:14px;border-radius:50%;
            background:#0f172a;border:1.5px solid #f59e0b;
            color:#f59e0b;box-shadow:0 2px 4px rgba(0,0,0,0.5);
            display:flex;align-items:center;justify-content:center;
            font-size:11px;font-weight:bold;cursor:pointer;
          " title="Click to insert point here">+</div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      const midMarker = L.marker([midY, midX], { icon: midIcon }).addTo(editLayer);
      const insertIndex = i + 1;
      midMarker.on('click', () => {
        setEditingGeofencePoints((prev) => {
          const next = [...prev];
          next.splice(insertIndex, 0, { x: midX, y: midY });
          return next;
        });
      });
    }
  }, [editingGeofencePointsId, editingGeofencePoints]);

  return (
    <div className="flex h-full gap-4">
      {/* ─── LEFT SIDEBAR PANEL ───────────────────────────────────── */}
      <div className="w-80 flex-shrink-0 flex flex-col gap-3 overflow-y-auto">
        {/* Zone Selector */}
        <Card className="rounded-2xl border-border shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold flex items-center justify-between text-foreground">
              <span className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                Zones / Floor Plans
              </span>
              {isAdmin && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] px-2.5 cursor-pointer border-primary/50 text-primary hover:bg-primary/10 font-bold"
                  onClick={() => setShowNewZoneForm(!showNewZoneForm)}
                >
                  <Plus className="h-3 w-3 mr-1" /> Add Zones
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {showNewZoneForm && (
              <div className="p-3 rounded-xl bg-secondary/50 border border-border space-y-2 mb-2">
                <div className="text-[11px] font-bold text-foreground">Tambah Zone Baru</div>
                <div>
                  <label className="text-[9px] text-muted-foreground uppercase font-bold">Nama Zone</label>
                  <input
                    type="text"
                    placeholder="e.g. Storage Zone Alpha"
                    className="w-full mt-0.5 px-2.5 py-1 rounded bg-background border border-border text-xs text-foreground"
                    value={newZoneName}
                    onChange={(e) => setNewZoneName(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] text-muted-foreground uppercase font-bold">Lebar (m)</label>
                    <input
                      type="number"
                      className="w-full mt-0.5 px-2 py-1 rounded bg-background border border-border text-xs text-foreground"
                      value={newZoneWidth}
                      onChange={(e) => setNewZoneWidth(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground uppercase font-bold">Tinggi (m)</label>
                    <input
                      type="number"
                      className="w-full mt-0.5 px-2 py-1 rounded bg-background border border-border text-xs text-foreground"
                      value={newZoneHeight}
                      onChange={(e) => setNewZoneHeight(Number(e.target.value))}
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" className="flex-1 h-6 text-[10px] cursor-pointer" onClick={handleCreateZone}>
                    Save Zone
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 text-[10px] cursor-pointer" onClick={() => setShowNewZoneForm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {zones.length === 0 && (
              <p className="text-[11px] text-muted-foreground italic">
                No zones found. Create a zone to begin.
              </p>
            )}
            {zones.map((z) => (
              <div key={z.id} className="space-y-1">
                {editingZoneId === z.id ? (
                  <div className="p-3 rounded-xl bg-primary/10 border border-primary/40 space-y-2">
                    <div className="text-[11px] font-bold text-foreground flex justify-between items-center">
                      <span>Edit Zone & Denah</span>
                      <button onClick={() => setEditingZoneId(null)} className="text-muted-foreground hover:text-foreground">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div>
                      <label className="text-[9px] text-muted-foreground uppercase font-bold">Nama Zone</label>
                      <input
                        type="text"
                        className="w-full mt-0.5 px-2.5 py-1 rounded bg-background border border-border text-xs text-foreground"
                        value={editZoneName}
                        onChange={(e) => setEditZoneName(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] text-muted-foreground uppercase font-bold">Lebar (m)</label>
                        <input
                          type="number"
                          className="w-full mt-0.5 px-2 py-1 rounded bg-background border border-border text-xs text-foreground"
                          value={editZoneWidth}
                          onChange={(e) => setEditZoneWidth(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-muted-foreground uppercase font-bold">Tinggi (m)</label>
                        <input
                          type="number"
                          className="w-full mt-0.5 px-2 py-1 rounded bg-background border border-border text-xs text-foreground"
                          value={editZoneHeight}
                          onChange={(e) => setEditZoneHeight(Number(e.target.value))}
                        />
                      </div>
                    </div>
                    {/* Offset position inputs */}
                    <div className="border-t border-border/60 pt-2">
                      <label className="text-[9px] text-muted-foreground uppercase font-bold flex items-center gap-1">
                        📍 Posisi pada Denah
                      </label>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <div>
                          <label className="text-[8px] text-muted-foreground">Offset X (m)</label>
                          <input
                            type="number"
                            step="0.5"
                            className="w-full mt-0.5 px-2 py-1 rounded bg-background border border-border text-xs text-foreground"
                            value={editZoneOffsetX}
                            onChange={(e) => setEditZoneOffsetX(Number(e.target.value))}
                          />
                        </div>
                        <div>
                          <label className="text-[8px] text-muted-foreground">Offset Y (m)</label>
                          <input
                            type="number"
                            step="0.5"
                            className="w-full mt-0.5 px-2 py-1 rounded bg-background border border-border text-xs text-foreground"
                            value={editZoneOffsetY}
                            onChange={(e) => setEditZoneOffsetY(Number(e.target.value))}
                          />
                        </div>
                      </div>
                      <p className="text-[8px] text-muted-foreground mt-1 italic">
                        💡 Atau drag label zona pada peta untuk memindahkan posisinya
                      </p>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" className="flex-1 h-6 text-[10px] cursor-pointer" onClick={handleUpdateZone}>
                        Update Zone
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 text-[10px] cursor-pointer" onClick={() => setEditingZoneId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => setSelectedZoneId(z.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all border cursor-pointer ${selectedZoneId === z.id
                      ? 'bg-primary/10 border-primary text-primary font-bold'
                      : 'bg-secondary/50 border-border text-muted-foreground hover:bg-secondary'
                      }`}
                  >
                    <div className="truncate mr-2">
                      <div className="font-bold truncate">{z.name}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                        {z.width}×{z.height}m
                        {(z.offsetX || z.offsetY) ? ` · ↔${z.offsetX ?? 0}m ↕${z.offsetY ?? 0}m` : ''}
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 hover:bg-primary/20 text-muted-foreground hover:text-primary cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditZone(z);
                          }}
                          title="Edit Nama & Ukuran Denah"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 hover:bg-destructive/20 text-muted-foreground hover:text-destructive cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteZone(z.id, z.name);
                          }}
                          title="Delete Floor Plan"
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Floor Plan Upload */}
        {isAdmin && selectedZoneId && (
          <Card className="rounded-2xl border-border shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold flex items-center gap-2 text-foreground">
                <Upload className="h-4 w-4 text-primary" />
                Upload Zones Indoor
              </CardTitle>
            </CardHeader>
            <CardContent>
              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-secondary/30 transition-all">
                <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                <span className="text-[10px] text-muted-foreground text-center px-2">
                  Click to upload a 2D image (PNG, JPG, SVG) or 3D model (GLB, GLTF)
                </span>
                <input
                  type="file"
                  accept="image/*,.glb,.gltf"
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
                  Anchor Placement
                </span>
                <div className="flex items-center gap-1.5">
                  <Badge variant="secondary" className="text-[10px]">
                    {selectedZone?.anchors?.length || 0} Placed
                  </Badge>
                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] px-2 cursor-pointer"
                      onClick={() => setShowNewAnchorForm(!showNewAnchorForm)}
                    >
                      <Plus className="h-3 w-3 mr-0.5" /> Anchor
                    </Button>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {showNewAnchorForm && (
                <div className="p-3 rounded-xl bg-secondary/50 border border-border space-y-2 mb-2">
                  <div className="text-[11px] font-bold text-foreground">Add New Asset Anchor</div>
                  <div>
                    <label className="text-[9px] text-muted-foreground uppercase font-bold">Anchor Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Anchor North-East Corner"
                      className="w-full mt-0.5 px-2.5 py-1 rounded bg-background border border-border text-xs text-foreground"
                      value={newAnchorName}
                      onChange={(e) => setNewAnchorName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground uppercase font-bold">Hardware ID / Node Address</label>
                    <input
                      type="text"
                      placeholder="e.g. 9023206"
                      className="w-full mt-0.5 px-2.5 py-1 rounded bg-background border border-border text-xs text-foreground font-mono"
                      value={newAnchorHardwareId}
                      onChange={(e) => setNewAnchorHardwareId(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" className="flex-1 h-6 text-[10px] cursor-pointer" onClick={handleCreateAnchor}>
                      Save & Placed
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 text-[10px] cursor-pointer" onClick={() => setShowNewAnchorForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              <p className="text-[10px] text-muted-foreground">
                Select an anchor below to place it on the floor plan, or drag a marker on the map.
              </p>

              {/* Anchors List */}
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {(() => {
                  const filteredAnchors = allTenantAnchors.filter((an) => !an.zoneId || an.zoneId === selectedZoneId);

                  if (filteredAnchors.length === 0) {
                    return (
                      <p className="text-[10px] text-muted-foreground italic py-2 text-center">
                        No anchors are available (all anchors have already been placed on another floor plan).
                      </p>
                    );
                  }

                  return filteredAnchors.map((an) => {
                    const isPlacedOnCurrent = an.zoneId === selectedZoneId;

                    return (
                      <div
                        key={an.id}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs ${isPlacedOnCurrent
                          ? 'bg-cyan-950/20 border-cyan-500/30 text-cyan-300'
                          : 'bg-secondary/40 border-border text-foreground'
                          }`}
                      >
                        <div className="flex items-center gap-2 truncate mr-2">
                          <Radio className={`h-3.5 w-3.5 flex-shrink-0 ${isPlacedOnCurrent ? 'text-cyan-400' : 'text-muted-foreground'}`} />
                          <div className="truncate">
                            <div className="font-bold text-[11px] truncate">{an.name}</div>
                            <div className="text-[9px] text-muted-foreground font-mono">
                              {isPlacedOnCurrent ? `Pos: (${an.x}m, ${an.y}m)` : 'Unplaced'}
                            </div>
                          </div>
                        </div>

                        {isAdmin && (
                          isPlacedOnCurrent ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-1.5 text-[10px] text-destructive hover:bg-destructive/10 cursor-pointer"
                              onClick={() => handleUnassignAnchor(an.id)}
                              title="Remove this placement from the floor plan"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-1.5 text-[10px] text-destructive hover:bg-destructive/10 cursor-pointer"
                                onClick={() => handleDeleteAnchor(an.id)}
                                title="Delete Anchor Permanently"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-[10px] border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 cursor-pointer flex-shrink-0"
                                onClick={() => handleAssignAnchor(an.id)}
                              >
                                <Plus className="h-3 w-3 mr-1" /> Place
                              </Button>
                            </div>
                          )
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── MESH / ASSET PLACEMENT PANEL ─────────────────────── */}
        {selectedZoneId && (
          <Card className="rounded-2xl border-border shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold flex items-center justify-between text-foreground">
                <span className="flex items-center gap-2">
                  <Radio className="h-4 w-4 text-emerald-400" />
                  Mesh / Asset Placement
                </span>
                <Badge variant="secondary" className="text-[10px]">
                  {selectedZone?.assets?.length || 0} Placed
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-[10px] text-muted-foreground">
                Select a Mesh/Asset to place on the floor plan. Drag the marker on the map to update the position.
              </p>
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {(() => {
                  const filteredMesh = allTenantMesh.filter((ms) => !ms.zoneId || ms.zoneId === selectedZoneId);

                  if (filteredMesh.length === 0) {
                    return (
                      <p className="text-[10px] text-muted-foreground italic py-2 text-center">
                        No mesh assets are available (all assets have already been placed on another floor plan).
                      </p>
                    );
                  }

                  return filteredMesh.map((ms) => {
                    const isPlacedOnCurrent = ms.zoneId === selectedZoneId;

                    return (
                      <div
                        key={ms.id}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs ${isPlacedOnCurrent
                          ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                          : 'bg-secondary/40 border-border text-foreground'
                          }`}
                      >
                        <div className="flex items-center gap-2 truncate mr-2">
                          <Tag className={`h-3.5 w-3.5 flex-shrink-0 ${isPlacedOnCurrent ? 'text-emerald-400' : 'text-muted-foreground'}`} />
                          <div className="truncate">
                            <div className="font-bold text-[11px] truncate">{ms.name}</div>
                            <div className="text-[9px] text-muted-foreground font-mono">
                              {isPlacedOnCurrent
                                ? `Pos: (${ms.planX?.toFixed(1) ?? '?'}m, ${ms.planY?.toFixed(1) ?? '?'}m)`
                                : ms.type || 'MESH'}
                            </div>
                            {isPlacedOnCurrent && (ms.tag?.battery !== null && ms.tag?.battery !== undefined || ms.tag?.temperature !== null && ms.tag?.temperature !== undefined || ms.tag?.humidity !== null && ms.tag?.humidity !== undefined) && (
                              <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[8px] bg-slate-900/50 p-1 rounded border border-slate-700/50">
                                {ms.tag?.battery !== null && ms.tag?.battery !== undefined && (
                                  <span className="flex items-center gap-0.5 text-yellow-400">
                                    {'\U0001f50b'} <span className="font-bold">{ms.tag.battery.toFixed(0)}%</span>
                                  </span>
                                )}
                                {ms.tag?.temperature !== null && ms.tag?.temperature !== undefined && (
                                  <span className="flex items-center gap-0.5 text-orange-400">
                                    {'\U0001f321\ufe0f'} <span className="font-bold">{ms.tag.temperature.toFixed(1)}°C</span>
                                  </span>
                                )}
                                {ms.tag?.humidity !== null && ms.tag?.humidity !== undefined && (
                                  <span className="flex items-center gap-0.5 text-sky-400">
                                    {'\U0001f4a7'} <span className="font-bold">{ms.tag.humidity.toFixed(1)}%</span>
                                  </span>
                                )}
                              </div>
                            )}
                            {isPlacedOnCurrent && ms.tag?.signals && (() => {
                              try {
                                const sigs = JSON.parse(ms.tag.signals);
                                if (Array.isArray(sigs) && sigs.length > 0) {
                                  return (
                                    <div className="mt-1 space-y-0.5 text-[8px] bg-emerald-950/40 p-1 rounded border border-emerald-500/20 text-left">
                                      <span className="font-bold text-[8px] text-emerald-400">Anchor Signals:</span>
                                      {sigs.map((s: any) => (
                                        <div key={s.anchorId} className="flex justify-between gap-1 text-[8px]">
                                          <span className="truncate max-w-[80px]">{s.anchorName}</span>
                                          <span className="font-bold text-emerald-300">{s.rssi} dBm</span>
                                        </div>
                                      ))}
                                    </div>
                                  );
                                }
                              } catch (e) { }
                              return null;
                            })()}
                          </div>
                        </div>

                        {isAdmin && (
                          isPlacedOnCurrent ? (
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-1.5 text-[10px] text-destructive hover:bg-destructive/10 cursor-pointer"
                                onClick={() => handleUnassignMesh(ms.id)}
                                title="Remove this placement from the floor plan"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-[10px] border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 cursor-pointer flex-shrink-0"
                                onClick={() => handleAssignMesh(ms.id)}
                              >
                                <Plus className="h-3 w-3 mr-1" /> Place
                              </Button>
                            </div>
                          )
                        )}
                      </div>
                    );
                  });
                })()}
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
                {isAdmin && (
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
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {selectedZone.geofences?.map((gf) => (
                <div key={gf.id} className="space-y-1">
                  {editingGeofenceId === gf.id ? (
                    <div className="p-3 rounded-xl bg-primary/10 border border-primary/40 space-y-2">
                      <div className="text-[10px] font-bold text-foreground flex justify-between items-center">
                        <span>Edit Geofence Name & Color</span>
                        <button onClick={() => setEditingGeofenceId(null)} className="text-muted-foreground hover:text-foreground">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      <div>
                        <label className="text-[8px] text-muted-foreground uppercase font-bold">Nama</label>
                        <input
                          type="text"
                          className="w-full mt-0.5 px-2.5 py-1 rounded bg-background border border-border text-xs text-foreground"
                          value={editGeofenceName}
                          onChange={(e) => setEditGeofenceName(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-[8px] text-muted-foreground uppercase font-bold flex items-center gap-1">
                          <Palette className="h-3 w-3" /> Geofence Color
                        </label>
                        <div className="flex items-center gap-1.5 mt-1">
                          {PRESET_COLORS.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setEditGeofenceColor(c)}
                              className={`w-5 h-5 rounded-full border transition-all cursor-pointer ${editGeofenceColor === c ? 'scale-110 border-white ring-2 ring-primary' : 'border-transparent opacity-80 hover:opacity-100'
                                }`}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                          <input
                            type="color"
                            className="w-6 h-6 p-0 rounded-full border-0 cursor-pointer bg-transparent"
                            value={editGeofenceColor}
                            onChange={(e) => setEditGeofenceColor(e.target.value)}
                            title="Custom Color"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" className="flex-1 h-6 text-[10px] cursor-pointer" onClick={handleUpdateGeofence}>
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 text-[10px] cursor-pointer" onClick={() => setEditingGeofenceId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/50 border border-border text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-3.5 h-3.5 rounded-full flex-shrink-0 border border-white/20 shadow-sm" style={{ backgroundColor: gf.color }} />
                        <div>
                          <div className="font-bold text-foreground">{gf.name}</div>
                          <div className="text-[9px] text-muted-foreground flex items-center gap-1">
                            <span>{(() => {
                              try {
                                return JSON.parse(gf.points).length;
                              } catch (e) {
                                return 0;
                              }
                            })()} point</span>
                          </div>
                        </div>
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingGeofencePointsId(gf.id);
                              try {
                                setEditingGeofencePoints(JSON.parse(gf.points));
                              } catch (e) {
                                setEditingGeofencePoints([]);
                              }
                            }}
                            className="text-muted-foreground hover:text-amber-400 cursor-pointer p-1 rounded hover:bg-amber-400/10 transition-colors flex items-center gap-0.5 text-[10px]"
                            title="Edit Point Zones on the Map"
                          >
                            <Move className="h-3.5 w-3.5 text-amber-400" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingGeofenceId(gf.id);
                              setEditGeofenceName(gf.name);
                              setEditGeofenceColor(gf.color || '#38bdf8');
                            }}
                            className="text-muted-foreground hover:text-primary cursor-pointer p-1 rounded hover:bg-primary/10 transition-colors"
                            title="Edit Name & Color"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteGeofence(gf.id)}
                            className="text-destructive hover:text-destructive/80 cursor-pointer p-1 rounded hover:bg-destructive/10 transition-colors"
                            title="Delete Geofence"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {selectedZone.geofences?.length === 0 && (
                <p className="text-[10px] text-muted-foreground italic">No geofence zones defined yet.</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Edit Geofence Points Panel */}
        {editingGeofencePointsId && (
          <Card className="rounded-2xl border-amber-500/40 shadow-md bg-amber-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold flex items-center justify-between text-foreground">
                <span className="flex items-center gap-2 text-amber-400">
                  <Move className="h-4 w-4" />
                  Edit Point Zone
                </span>
                <button
                  onClick={() => {
                    setEditingGeofencePointsId(null);
                    setEditingGeofencePoints([]);
                  }}
                  className="cursor-pointer"
                >
                  <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-[10px] text-muted-foreground">
                💡 Drag the yellow circle <strong>(1, 2, 3...)</strong> on the map to pan. Click the icon <strong>(+)</strong> between two points to add a new point.
              </p>

              {/* Point coordinates list */}
              <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                {editingGeofencePoints.map((pt, idx) => (
                  <div key={idx} className="flex items-center justify-between px-2 py-1 rounded bg-background/80 border border-border text-[10px]">
                    <span className="font-bold text-amber-400">P{idx + 1}</span>
                    <span className="text-muted-foreground">X: {pt.x}m, Y: {pt.y}m</span>
                    {editingGeofencePoints.length > 3 && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingGeofencePoints((prev) => prev.filter((_, i) => i !== idx));
                        }}
                        className="text-destructive hover:text-destructive/80 cursor-pointer"
                        title="Delete this point"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  className="flex-1 h-7 text-[10px] bg-amber-500 hover:bg-amber-600 text-black font-bold cursor-pointer"
                  onClick={handleSaveGeofencePoints}
                >
                  <Check className="h-3 w-3 mr-1" /> Save Point
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] cursor-pointer"
                  onClick={() => {
                    setEditingGeofencePointsId(null);
                    setEditingGeofencePoints([]);
                  }}
                >
                  Cancel
                </Button>
              </div>
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
                  placeholder="e.g., Production Area / Loading Dock"
                  value={newGeofenceName}
                  onChange={(e) => setNewGeofenceName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground font-bold uppercase flex items-center gap-1">
                  <Palette className="h-3 w-3 text-primary" /> Zone Color
                </label>
                <div className="flex items-center gap-2 mt-1.5">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewGeofenceColor(c)}
                      className={`w-6 h-6 rounded-full border transition-all cursor-pointer ${newGeofenceColor === c ? 'scale-110 border-white ring-2 ring-primary' : 'border-transparent opacity-80 hover:opacity-100'
                        }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <input
                    type="color"
                    className="w-7 h-7 p-0 rounded-full border-0 cursor-pointer bg-transparent"
                    value={newGeofenceColor}
                    onChange={(e) => setNewGeofenceColor(e.target.value)}
                    title="Custom Color"
                  />
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
          {selectedZoneId ? (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs px-2.5 gap-1.5 border-border hover:bg-secondary cursor-pointer font-bold"
              onClick={() => {
                setSelectedZoneId(null);
                setSelectedZone(null);
                setEditingGeofencePointsId(null);
              }}
              title="Back to RTLS Planner Main Summary"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-primary" />
              Back
            </Button>
          ) : null}
          <span className="text-xs font-bold text-foreground flex items-center gap-2 ml-1">
            <PenTool className="h-4 w-4 text-primary" />
            RTLS Planner {selectedZone ? ' · ' + selectedZone.name : ''}
          </span>
          <div className="flex-1" />
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setDrawMode('pointer');
                setDrawingPoints([]);
                setShowNewGeofenceForm(false);
              }}
              className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${drawMode === 'pointer'
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
              className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${drawMode === 'draw_zone'
                ? 'bg-primary/10 text-primary border border-primary/30'
                : 'bg-secondary/50 text-muted-foreground border border-border hover:bg-secondary'
                }`}
              title="Draw Geofence Zone"
            >
              <Hexagon className="h-4 w-4" />
            </button>
            {selectedZone && (
              <>
                <div className="h-4 w-[1px] bg-border mx-0.5" />
                <button
                  onClick={() => mapRef.current?.zoomIn()}
                  className="p-1.5 rounded-lg text-xs bg-secondary/50 text-muted-foreground border border-border hover:bg-secondary hover:text-foreground transition-all cursor-pointer"
                  title="Zoom In (+)"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button
                  onClick={() => mapRef.current?.zoomOut()}
                  className="p-1.5 rounded-lg text-xs bg-secondary/50 text-muted-foreground border border-border hover:bg-secondary hover:text-foreground transition-all cursor-pointer"
                  title="Zoom Out (-)"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    if (selectedZone && mapRef.current) {
                      const w = selectedZone.width || 100;
                      const h = selectedZone.height || 100;
                      mapRef.current.fitBounds([[0, 0], [h, w]], { padding: [20, 20] });
                    }
                  }}
                  className="p-1.5 rounded-lg text-xs bg-secondary/50 text-muted-foreground border border-border hover:bg-secondary hover:text-foreground transition-all cursor-pointer"
                  title="Fit Full Image (Reset Zoom)"
                >
                  <Maximize2 className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Map Canvas */}
        <div className="flex-1 rounded-2xl overflow-hidden border border-border shadow-2xl bg-card relative min-h-[500px]">
          {!selectedZoneId && (
            <div className="absolute inset-0 z-[2000] flex flex-col items-center justify-center p-6 bg-card/95 backdrop-blur-md overflow-y-auto">
              <div className="max-w-2xl w-full text-center space-y-6">
                <div className="flex flex-col items-center">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center mb-3">
                    <Layers className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-base font-bold text-foreground">Select Floor Plan / RTLS Zone</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-md">
                    Each floor plan is independent. Select one of the floor plans below to open the floor plan editor, place an anchor, and create a geofence.
                  </p>
                </div>

                {zones.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                    {zones.map((z) => {
                      const anchorCount = allTenantAnchors.filter(
                        (a) => a.zoneId === z.id || a.zone?.id === z.id || (z.anchors && z.anchors.some((za) => za.id === a.id))
                      ).length;
                      const geofenceCount = z.geofences?.length ?? (z as any)._count?.geofences ?? 0;
                      const meshCount = allTenantMesh.filter(
                        (m) => m.zoneId === z.id || m.zone?.id === z.id || (z.assets && z.assets.some((za: any) => za.id === m.id))
                      ).length;

                      return (
                        <div
                          key={z.id}
                          onClick={() => setSelectedZoneId(z.id)}
                          className="group relative p-4 rounded-2xl bg-secondary/40 hover:bg-secondary border border-border hover:border-primary/50 transition-all cursor-pointer shadow-md flex flex-col justify-between"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Floor Plan</span>
                              <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{z.name}</h4>
                            </div>
                            <div className="px-2 py-0.5 rounded text-[10px] bg-background border border-border text-muted-foreground font-mono">
                              {z.width}m × {z.height}m
                            </div>
                          </div>

                          <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5 text-sky-400" />
                              {anchorCount} Anchor · {geofenceCount} Geofence · {meshCount} Mesh
                            </span>
                            <span className="text-xs font-bold text-primary flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                              Open Floor Plan →
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 rounded-2xl border border-dashed border-border bg-secondary/20 flex flex-col items-center">
                    <p className="text-xs text-muted-foreground italic mb-3">No floor plan has been drawn up yet.</p>
                    <Button
                      size="sm"
                      className="text-xs font-bold cursor-pointer"
                      onClick={() => setShowNewZoneForm(true)}
                    >
                      <Plus className="h-4 w-4 mr-1.5" /> Add a New Floor Plan
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/80 backdrop-blur-sm">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <div ref={mapContainerRef} className="w-full h-full min-h-[500px]" />

          {selectedZone && (
            <div className="absolute top-4 right-4 z-[1000]">
              {showLegend ? (
                <Card className="w-64 shadow-xl border-slate-200">
                  <CardHeader className="p-3 border-b border-slate-100 flex flex-row items-center justify-between bg-slate-50/50 space-y-0">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Layers className="w-4 h-4 text-slate-500" /> Layer Legend
                    </CardTitle>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowLegend(false)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </CardHeader>
                  <CardContent className="p-3 space-y-3">
                    <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 p-1 rounded transition-colors">
                      <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        checked={layerVisibility.geofence}
                        onChange={(e) => setLayerVisibility(prev => ({ ...prev, geofence: e.target.checked }))}
                      />
                      <Hexagon className="w-4 h-4 text-sky-500" /> Geofences
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 p-1 rounded transition-colors">
                      <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        checked={layerVisibility.anchor}
                        onChange={(e) => setLayerVisibility(prev => ({ ...prev, anchor: e.target.checked }))}
                      />
                      <MapPin className="w-4 h-4 text-blue-700" /> Anchors
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 p-1 rounded transition-colors">
                      <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        checked={layerVisibility.mesh}
                        onChange={(e) => setLayerVisibility(prev => ({ ...prev, mesh: e.target.checked }))}
                      />
                      <Radio className="w-4 h-4 text-slate-700" /> Mesh
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 p-1 rounded transition-colors">
                      <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        checked={layerVisibility.threads}
                        onChange={(e) => setLayerVisibility(prev => ({ ...prev, threads: e.target.checked }))}
                      />
                      <div className="w-4 h-0 border-b-2 border-dashed border-orange-500 ml-1" /> Threads
                    </label>
                  </CardContent>
                </Card>
              ) : (
                <Button variant="secondary" className="shadow-md shadow-slate-200/50 bg-white" onClick={() => setShowLegend(true)}>
                  <Layers className="w-4 h-4 mr-2" /> Legend
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Custom Confirm Modal for Planner */}
      <ConfirmModal
        isOpen={!!plannerConfirm}
        title={plannerConfirm?.title || 'Konfirmasi'}
        message={plannerConfirm?.message || ''}
        confirmText={plannerConfirm?.confirmText || 'OK'}
        cancelText="Cancel"
        variant={plannerConfirm?.variant || 'danger'}
        onConfirm={() => plannerConfirm?.onConfirm()}
        onCancel={() => setPlannerConfirm(null)}
      />
    </div>
  );
}
