'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { getApiUrl, getBackendUrl } from '../../lib/api';
import { getAssetMarkerIcon } from '../../lib/icon-utils';
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
  Activity,
  Wifi,
  Anchor,
  Eye,
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

interface BuildingFloor {
  zoneId: string;
  floorName: string;
  floorOrder: number;
}

interface BuildingGroup {
  id: string;
  name: string;
  description?: string;
  floors: BuildingFloor[];
}

// ─── Planner Page ─────────────────────────────────────────────────────
export default function PlannerPage() {
  const { tenantId, token, isAdmin, user } = useAuth();
  const { assets } = useSocket();

  const [zones, setZones] = useState<ZoneData[]>([]);
  const [sites, setSites] = useState<SiteData[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<ZoneData | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
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
    showTelemetry: true,
    showSignals: false,
  });
  const [plannerConfirm, setPlannerConfirm] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    variant?: 'danger' | 'warning' | 'info';
    confirmText?: string;
  } | null>(null);

  // Building Groups State (Gedung Bertingkat)
  const [buildingGroups, setBuildingGroups] = useState<BuildingGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'single_2d' | 'split_grid'>('single_2d');

  // Building Group Manager Modal States
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupModalName, setGroupModalName] = useState('');
  const [groupModalDesc, setGroupModalDesc] = useState('');
  const [groupModalFloors, setGroupModalFloors] = useState<BuildingFloor[]>([]);

  // New Zone Form state
  const [showNewZoneForm, setShowNewZoneForm] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneSiteId, setNewZoneSiteId] = useState('');
  const [newZoneWidth, setNewZoneWidth] = useState(50);
  const [newZoneHeight, setNewZoneHeight] = useState(30);
  const [newZoneGroupId, setNewZoneGroupId] = useState('');

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
  const [dbAssetTypes, setDbAssetTypes] = useState<any[]>([]);

  useEffect(() => {
    let isMounted = true;
    const fetchDbAssetTypes = async () => {
      try {
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (tenantId) headers['x-tenant-id'] = tenantId;

        const res = await fetch(`${getApiUrl()}/asset-types`, { headers });
        if (res.ok && isMounted) {
          const data = await res.json();
          setDbAssetTypes(data);
        }
      } catch (e) { }
    };
    fetchDbAssetTypes();
    return () => { isMounted = false; };
  }, [token, tenantId]);

  // Load Building Groups from localStorage & auto-sync default group if empty
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storageKey = `geomesh_building_groups_${tenantId || 'default'}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed: BuildingGroup[] = JSON.parse(saved);
          setBuildingGroups(parsed);
          if (parsed.length > 0 && !selectedGroupId) {
            setSelectedGroupId(parsed[0].id);
          }
        } catch (e) { }
      }
    }
  }, [tenantId]);

  // Generate default Building Group if zones exist but no groups saved
  useEffect(() => {
    if (zones.length > 0 && buildingGroups.length === 0) {
      const defaultGroup: BuildingGroup = {
        id: 'bg-default-1',
        name: 'Gedung Utama (Multi-Floor)',
        description: 'Gedung bertingkat otomatis dari denah zona',
        floors: zones.map((z, idx) => ({
          zoneId: z.id,
          floorName: z.name,
          floorOrder: idx + 1
        }))
      };
      setBuildingGroups([defaultGroup]);
      setSelectedGroupId(defaultGroup.id);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`geomesh_building_groups_${tenantId || 'default'}`, JSON.stringify([defaultGroup]));
      }
    }
  }, [zones, buildingGroups.length, tenantId]);

  const saveBuildingGroupsState = (groups: BuildingGroup[]) => {
    setBuildingGroups(groups);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`geomesh_building_groups_${tenantId || 'default'}`, JSON.stringify(groups));
    }
  };

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
      const localMatch = zones.find((z) => z.id === selectedZoneId);
      if (localMatch) {
        setSelectedZone((prev) => (prev?.id === selectedZoneId ? prev : localMatch));
      }
      fetchZoneDetails(selectedZoneId);
    } else {
      setSelectedZone(null);
      if (meshLayerRef.current) meshLayerRef.current.clearLayers();
      if (meshLineLayerRef.current) meshLineLayerRef.current.clearLayers();
      if (meshMarkersRef.current) meshMarkersRef.current.clear();
      if (meshLinesRef.current) meshLinesRef.current.clear();
    }
  }, [selectedZoneId, zones, fetchZoneDetails]);

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

  // Trigger map resize when switching back to single_2d view
  useEffect(() => {
    if (viewMode === 'single_2d' && mapRef.current) {
      setTimeout(() => {
        mapRef.current?.invalidateSize();
        if (selectedZone) {
          const w = selectedZone.width || 100;
          const h = selectedZone.height || 100;
          mapRef.current?.fitBounds([[0, 0], [h, w]]);
        }
      }, 50);
    }
  }, [viewMode, selectedZone]);

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
      zoomControl: false,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      dragging: true,
    });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
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
    zoneLayerRef.current?.clearLayers();
    geofenceLayerRef.current?.clearLayers();
    markerLayerRef.current?.clearLayers();
    meshLineLayerRef.current?.clearLayers();

    if (!selectedZone) return;

    const w = selectedZone.width || 100;
    const h = selectedZone.height || 100;
    const bounds: [[number, number], [number, number]] = [[0, 0], [h, w]];

    // 1. Clear zone layer (no blue overlay covering the floor plan)
    zoneLayerRef.current?.clearLayers();

    // 2. Render floor plan image if available
    if (selectedZone.floorPlanUrl) {
      const imageUrl = `${getBackendUrl()}${selectedZone.floorPlanUrl}`;
      imageOverlayRef.current = L.imageOverlay(imageUrl, bounds, {
        opacity: 0.85,
        interactive: false,
      }).addTo(map);
    }

    // 3. Recalculate Leaflet size & bounds
    map.invalidateSize();
    map.fitBounds(bounds);
    map.setMaxBounds(bounds);

    setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
        const minZ = mapRef.current.getBoundsZoom(bounds, false);
        mapRef.current.setMinZoom(minZ);
        mapRef.current.fitBounds(bounds);
      }
    }, 100);

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
        const markerIconInfo = getAssetMarkerIcon('ANCHOR', anchor.name, dbAssetTypes);
        const anchorStatus = anchor.status || 'offline';
        const anchorIsOnline = anchorStatus === 'online' || anchorStatus === 'active';
        const anchorStatusColor = anchorIsOnline ? '#10b981' : '#ef4444';
        const pinColor = markerIconInfo.color;

        const icon = L.divIcon({
          className: 'custom-anchor-icon',
          html: `
            <div style="display: flex; flex-direction: column; align-items: center; position: relative; width: 60px; height: 60px; pointer-events: auto;">
              <div class="bg-white text-slate-800 border-slate-200/80 border px-2 py-0.5 rounded-full text-[10px] font-bold shadow-md whitespace-nowrap mb-1 z-10 transition-all">
                ${anchor.name}
              </div>
              <div style="position: relative; width: 34px; height: 34px;">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${pinColor}" width="34" height="34" style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.2));">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="#ffffff" stroke-width="1.5"/>
                </svg>
                <div style="position: absolute; top: 6px; left: 50%; transform: translateX(-50%); color: white; display: flex; align-items: center; justify-content: center; z-index: 5;">
                  ${markerIconInfo.svg}
                </div>
                <div style="position: absolute; top: -1px; right: -1px; width: 10px; height: 10px; border-radius: 50%; background-color: ${anchorStatusColor}; border: 1.5px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3); z-index: 10;">
                  ${anchorIsOnline ? `<div class="absolute inset-0 rounded-full animate-ping bg-emerald-400 opacity-60"></div>` : ''}
                </div>
              </div>
              <div style="width: 18px; height: 5px; background: rgba(0,0,0,0.25); border-radius: 50%; filter: blur(2px); margin-top: 1px;"></div>
            </div>`,
          iconSize: [60, 60],
          iconAnchor: [30, 48],
        });

        let rawVoltage = (anchor as any).voltage;
        if (rawVoltage === undefined || rawVoltage === null) {
          const anyAnchor = anchor as any;
          if (anyAnchor.tag && anyAnchor.tag.battery !== undefined && anyAnchor.tag.battery !== null) {
            rawVoltage = anyAnchor.tag.battery;
          } else {
            try {
              if (anyAnchor.description) {
                const desc = JSON.parse(anyAnchor.description);
                const attrs: any[] = desc.attributes || [];
                const voltAttr = attrs.find((a) =>
                  a.name && (a.name.toLowerCase() === 'voltage' || a.name.toLowerCase() === 'battery')
                );
                if (voltAttr && voltAttr.value !== undefined && voltAttr.value !== '') {
                  const parsed = Number(voltAttr.value);
                  if (!isNaN(parsed)) rawVoltage = parsed;
                }
              }
            } catch (e) { }
          }
        }

        const anchorVoltage = rawVoltage !== null && rawVoltage !== undefined
          ? (rawVoltage > 100 ? rawVoltage / 1000 : rawVoltage)
          : null;
        const anchorLastSeen = (anchor as any).lastSeen || (anchor as any).updatedAt;
        const anchorLastUpdate = anchorLastSeen
          ? new Date(anchorLastSeen).toLocaleString('id-ID', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
          })
          : 'N/A';

        const anchorTooltipHtml = [
          '<div style="font-family:sans-serif;padding:8px 10px;min-width:220px;background:#0f172a;border:1px solid #334155;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.5);">',
          '<div style="font-weight:bold;color:#38bdf8;font-size:11px;margin-bottom:6px;border-bottom:1px solid #1e293b;padding-bottom:4px;">&#9875; ' + anchor.name + '</div>',
          '<div style="display:flex;flex-direction:column;gap:4px;">',
          '<div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;gap:12px;">',
          '<span style="color:#94a3b8;">Position</span>',
          '<span style="color:#94a3b8;font-family:monospace;font-size:9px;">(' + anchor.x + 'm, ' + anchor.y + 'm)</span>',
          '</div>',
          '<div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;gap:12px;">',
          '<span style="color:#94a3b8;">Voltage</span>',
          '<span style="color:#fbbf24;font-weight:bold;font-family:monospace;font-size:10px;">' + (anchorVoltage !== null && anchorVoltage !== undefined ? anchorVoltage.toFixed(2) + ' V' : 'N/A') + '</span>',
          '</div>',
          '<div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;gap:12px;">',
          '<span style="color:#94a3b8;">Last Update</span>',
          '<span style="color:#94a3b8;font-family:monospace;font-size:9px;">' + anchorLastUpdate + '</span>',
          '</div>',
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
  }, [selectedZone, apiHeaders, fetchAllAnchors, fetchZoneDetails, selectedZoneId, dbAssetTypes]);

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
      let signalHtml = '';
      let rssiList: { name: string; rssi: number }[] = [];
      try {
        if (asset.description && asset.description.startsWith('{')) {
          const desc = JSON.parse(asset.description);
          const attrs: any[] = desc.attributes || [];
          const rssiAttrs = attrs.filter((a: any) => a.name.startsWith('rssi_') && a.value !== '' && a.value !== null && a.value !== undefined);
          if (rssiAttrs.length > 0) {
            rssiList = rssiAttrs.map((a: any) => ({ name: a.name.replace('rssi_', '').replace(/_/g, ' '), rssi: Number(a.value) }));
          }
        }
        if (rssiList.length === 0 && asset.tag?.signals) {
          const sigs = JSON.parse(asset.tag.signals);
          if (Array.isArray(sigs) && sigs.length > 0) {
            rssiList = sigs.map((s: any) => ({ name: s.anchorName || s.mac, rssi: Number(s.rssi) }));
          }
        }

        if (rssiList.length > 0) {
          signalHtml = rssiList
            .sort((a, b) => b.rssi - a.rssi)
            .map(s => {
              const strengthPct = Math.max(0, Math.min(100, 100 - (Math.abs(s.rssi) - 40) * 1.5));
              let barColor = '#ef4444';
              if (s.rssi > -70) barColor = '#22c55e';
              else if (s.rssi > -85) barColor = '#eab308';
              return `
                <div style="display: flex; align-items: center; justify-content: space-between; font-size: 10px; color: #334155;">
                  <span style="font-weight: 600; max-width: 90px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${s.name}">${s.name}</span>
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="font-family: monospace; font-size: 9px; color: #64748b;">${s.rssi} dBm</span>
                    <div style="width: 40px; height: 4px; background: #e2e8f0; border-radius: 2px; overflow: hidden;">
                      <div style="width: ${strengthPct}%; height: 100%; background: ${barColor};"></div>
                    </div>
                  </div>
                </div>`;
            }).join('');
        }
      } catch (e) { }

      const isOnline = (() => {
        if (asset.tag?.lastSeen) {
          const diffMs = Date.now() - new Date(asset.tag.lastSeen).getTime();
          return diffMs < 300000;
        }
        return asset.status === 'moving' || asset.status === 'static';
      })();

      const statusColor = isOnline ? '#10b981' : '#ef4444';
      const markerIconInfo = getAssetMarkerIcon(asset.type || 'MESH_EYE_SENSOR', asset.name, dbAssetTypes);
      let pinColor = markerIconInfo.color;

      const isSelected = selectedAssetId === asset.id;
      const highlightColor = user?.tenantThemeColor || '#f59e0b'; // Primary Accent or fallback

      const iconHtml = `
        <div style="display: flex; flex-direction: column; align-items: center; position: relative; width: 60px; height: 60px; pointer-events: auto;">
          <div class="${isSelected ? `text-slate-950 font-black scale-110 shadow-lg` : 'bg-white text-slate-800 border-slate-200/80'} border px-2 py-0.5 rounded-full text-[10px] font-bold shadow-md whitespace-nowrap mb-1 z-10 transition-all" style="${isSelected ? `background-color: ${highlightColor}; border-color: ${highlightColor};` : ''}">
            ${asset.name}
          </div>
          <div style="position: relative; width: 34px; height: 34px;">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${pinColor}" width="34" height="34" style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.2));">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="${isSelected ? highlightColor : '#ffffff'}" stroke-width="${isSelected ? '2.5' : '1.5'}"/>
            </svg>
            <div style="position: absolute; top: 6px; left: 50%; transform: translateX(-50%); color: white; display: flex; align-items: center; justify-content: center; z-index: 5;">
              ${markerIconInfo.svg}
            </div>
            <div style="position: absolute; top: -1px; right: -1px; width: 10px; height: 10px; border-radius: 50%; background-color: ${statusColor}; border: 1.5px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3); z-index: 10;">
              ${isOnline ? `<div class="absolute inset-0 rounded-full animate-ping bg-emerald-400 opacity-60"></div>` : ''}
            </div>
          </div>
          <div style="width: 18px; height: 5px; background: rgba(0,0,0,0.25); border-radius: 50%; filter: blur(2px); margin-top: 1px;"></div>
        </div>`;

      const icon = L.divIcon({
        className: 'custom-mesh-icon',
        html: iconHtml,
        iconSize: [60, 60],
        iconAnchor: [30, 48],
      });

      const meshLastSeen = asset.tag?.lastSeen;

      const meshLastUpdate = meshLastSeen
        ? new Date(meshLastSeen).toLocaleString('id-ID', {
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        })
        : null;

      let telemetryHtml = '';
      if (asset.tag) {
        const allowedKeys = ['battery', 'temperature', 'humidity'];
        const tagKeys = Object.keys(asset.tag).filter(k => allowedKeys.includes(k) && asset.tag[k] !== null && asset.tag[k] !== undefined);

        if (tagKeys.length > 0) {
          const cards = tagKeys.map(key => {
            const val = asset.tag[key];
            let label = key.replace(/_/g, ' ').toUpperCase();
            let displayVal = String(val);
            let bgColor = '#f8fafc';
            let borderColor = '#e2e8f0';
            let iconColor = '#64748b';
            let svgIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`; // default icon (info)

            if (key === 'battery') {
              const numVal = Number(val);
              displayVal = (numVal > 100 ? numVal / 1000 : numVal).toFixed(2) + ' V';
              bgColor = '#f1f5f9'; borderColor = '#e2e8f0'; iconColor = '#0ea5e9';
              svgIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"></path><path d="M2 14h20"></path><path d="M6 10v4"></path></svg>`;
            } else if (key === 'temperature') {
              label = 'TEMP';
              displayVal = Number(val).toFixed(1) + ' &deg;C';
              bgColor = '#fef2f2'; borderColor = '#fee2e2'; iconColor = '#ef4444';
              svgIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"></path></svg>`;
            } else if (key === 'humidity') {
              displayVal = Number(val).toFixed(1) + '%';
              bgColor = '#f0fdf4'; borderColor = '#dcfce7'; iconColor = '#22c55e';
              svgIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>`;
            }

            return `
              <div style="background: ${bgColor}; padding: 6px; border-radius: 6px; display: flex; align-items: center; gap: 6px; border: 1px solid ${borderColor};">
                <div style="color: ${iconColor};">${svgIcon}</div>
                <div style="display: flex; flex-direction: column;">
                  <span style="font-size: 8px; color: #64748b; font-weight: 700; text-transform: uppercase;">${label}</span>
                  <span style="font-size: 11px; font-weight: 800; color: #0f172a;">${displayVal}</span>
                </div>
              </div>`;
          });

          telemetryHtml = `<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px;">${cards.join('')}</div>`;
        }
      }

      const tooltipHtml = `
        <div style="font-family: 'Inter', sans-serif; min-width: 230px; color: #1e293b; overflow: hidden;">
          <!-- Header Section -->
          <div style="background: #f8fafc; padding: 10px 12px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: flex-start; justify-content: space-between; border-radius: 8px 8px 0 0;">
            <div style="display: flex; flex-direction: column;">
              <span style="font-weight: 800; font-size: 13px; color: #0f172a;">${asset.name}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 4px; background: ${isOnline ? '#dcfce7' : '#f1f5f9'}; padding: 3px 6px; border-radius: 4px; border: 1px solid ${isOnline ? '#bbf7d0' : '#e2e8f0'};">
              <span style="display: block; width: 6px; height: 6px; border-radius: 50%; background: ${isOnline ? '#22c55e' : '#94a3b8'}; ${isOnline ? 'animation: pulse 2s infinite;' : ''}"></span>
              <span style="font-size: 8px; font-weight: 700; color: ${isOnline ? '#166534' : '#475569'};">${isOnline ? 'ONLINE' : 'OFFLINE'}</span>
            </div>
          </div>

          <div style="padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; background: white; border-radius: 0 0 8px 8px;">
            <!-- Location & Time -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
              <div style="display: flex; align-items: center; gap: 4px; font-size: 10px; color: #475569;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                <span style="font-family: monospace; font-weight: 600;">(${x.toFixed(1)}m, ${y.toFixed(1)}m)</span>
              </div>
              <div style="display: flex; align-items: center; gap: 4px; font-size: 9px; color: #64748b; font-weight: 600;">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                <span>${meshLastUpdate || 'Unknown'}</span>
              </div>
            </div>

            <!-- Telemetry Grid -->
            ${telemetryHtml}

            <!-- Anchor Signals -->
            ${signalHtml ? `
            <div style="margin-top: 4px;">
              <div style="font-size: 9px; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 6px; display: flex; align-items: center; gap: 4px; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0;">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M2 20h.01"></path><path d="M7 20v-4"></path><path d="M12 20v-8"></path><path d="M17 20V8"></path><path d="M22 4v16"></path></svg>
                Connected Anchors
              </div>
              <div style="display: flex; flex-direction: column; gap: 5px;">
                ${signalHtml}
              </div>
            </div>
            ` : ''}

          </div>
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
        marker.on('click', () => {
          setSelectedAssetId(asset.id);
        });
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
  }, [assets, selectedZone, apiHeaders, layerVisibility, selectedAssetId, dbAssetTypes]);

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

        // Auto assign to building group if selected
        if (newZoneGroupId) {
          const targetGroup = buildingGroups.find((g) => g.id === newZoneGroupId);
          if (targetGroup) {
            const newFloors = [
              ...targetGroup.floors,
              { zoneId: created.id, floorName: created.name, floorOrder: targetGroup.floors.length + 1 }
            ];
            const updatedGroups = buildingGroups.map((g) =>
              g.id === newZoneGroupId ? { ...g, floors: newFloors } : g
            );
            saveBuildingGroupsState(updatedGroups);
            setSelectedGroupId(newZoneGroupId);
          }
        }

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
        {/* Unified Zones & Building Groups Tree Card */}
        <Card className="rounded-2xl border-border shadow-md bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold flex items-center justify-between text-foreground">
              <span className="flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-primary" />
                Zones & Building Groups
              </span>
              {isAdmin && (
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px] px-2 cursor-pointer border-primary/50 text-primary hover:bg-primary/10 font-bold"
                    onClick={() => {
                      setEditingGroupId(null);
                      setGroupModalName('');
                      setGroupModalDesc('');
                      setGroupModalFloors(zones.map((z, i) => ({ zoneId: z.id, floorName: z.name, floorOrder: i + 1 })));
                      setShowGroupModal(true);
                    }}
                  >
                    <Plus className="h-3 w-3 mr-0.5" /> + Group
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px] px-2 cursor-pointer border-primary/50 text-primary hover:bg-primary/10 font-bold"
                    onClick={() => setShowNewZoneForm(!showNewZoneForm)}
                  >
                    <Plus className="h-3 w-3 mr-0.5" /> + Zone
                  </Button>
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Form to Add New Zone */}
            {showNewZoneForm && (
              <div className="p-3 rounded-xl bg-secondary/50 border border-border space-y-2 mb-2">
                <div className="text-[11px] font-bold text-foreground">Tambah Zone / Denah Baru</div>
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
                <div>
                  <label className="text-[9px] text-muted-foreground uppercase font-bold">Building Group (Parent)</label>
                  <select
                    className="w-full mt-0.5 px-2 py-1 rounded bg-background border border-border text-xs text-foreground"
                    value={newZoneGroupId}
                    onChange={(e) => setNewZoneGroupId(e.target.value)}
                  >
                    <option value="">-- Standalone (Tanpa Group) --</option>
                    {buildingGroups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
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

            {/* Parent-Child Tree View of Building Groups & Zones */}
            {buildingGroups.length === 0 && zones.length === 0 ? (
              <p className="text-[11px] text-muted-foreground italic">
                Belum ada data gedung atau zona denah.
              </p>
            ) : (
              <div className="space-y-3">
                {/* 1. Building Groups (Parents) */}
                {buildingGroups.map((bg) => {
                  const isGroupSelected = selectedGroupId === bg.id;
                  const groupMeshCount = allTenantMesh.filter((m) =>
                    bg.floors.some((fl) => m.zoneId === fl.zoneId || m.zone?.id === fl.zoneId)
                  ).length;

                  return (
                    <div key={bg.id} className="space-y-1.5">
                      {/* Parent Group Header */}
                      <div
                        onClick={() => setSelectedGroupId(bg.id)}
                        className={`p-2 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${isGroupSelected
                          ? 'bg-primary/10 border-primary/50 shadow-sm'
                          : 'bg-secondary/40 border-border hover:bg-secondary'
                          }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Building2 className={`h-4 w-4 shrink-0 ${isGroupSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                          <div className="truncate">
                            <span className="font-bold text-foreground block truncate">{bg.name}</span>
                            <span className="text-[9px] text-muted-foreground font-mono">
                              {bg.floors.length} Lantai · {groupMeshCount} Active Mesh
                            </span>
                          </div>
                        </div>
                        {isAdmin && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingGroupId(bg.id);
                                setGroupModalName(bg.name);
                                setGroupModalDesc(bg.description || '');
                                setGroupModalFloors([...bg.floors]);
                                setShowGroupModal(true);
                              }}
                              className="p-1 text-muted-foreground hover:text-primary rounded hover:bg-primary/10"
                              title="Edit Building Group"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const filtered = buildingGroups.filter((g) => g.id !== bg.id);
                                saveBuildingGroupsState(filtered);
                                if (selectedGroupId === bg.id) {
                                  setSelectedGroupId(filtered.length > 0 ? filtered[0].id : null);
                                }
                              }}
                              className="p-1 text-muted-foreground hover:text-red-400 rounded hover:bg-red-400/10"
                              title="Hapus Building Group"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Child Floor Plans / Zones (Indented Tree) */}
                      {bg.floors.length > 0 && (
                        <div className="ml-3 pl-2.5 border-l-2 border-primary/30 space-y-1">
                          {bg.floors
                            .sort((a, b) => b.floorOrder - a.floorOrder)
                            .map((fl) => {
                              const z = zones.find((item) => item.id === fl.zoneId);
                              const isThisZoneActive = selectedZoneId === fl.zoneId;
                              const floorMeshCount = allTenantMesh.filter((m) => m.zoneId === fl.zoneId || m.zone?.id === fl.zoneId).length;

                              if (!z) {
                                return (
                                  <div key={fl.zoneId} className="p-1.5 rounded-lg border border-border bg-background text-[11px] flex items-center justify-between text-muted-foreground">
                                    <span>↳ {fl.floorName}</span>
                                  </div>
                                );
                              }

                              return (
                                <div key={z.id} className="space-y-1">
                                  {editingZoneId === z.id ? (
                                    <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/40 space-y-2">
                                      <div className="text-[10px] font-bold text-foreground flex justify-between items-center">
                                        <span>Edit Zone & Denah</span>
                                        <button onClick={() => setEditingZoneId(null)} className="text-muted-foreground hover:text-foreground">
                                          <X className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                      <div>
                                        <label className="text-[8px] text-muted-foreground uppercase font-bold">Nama Zone</label>
                                        <input
                                          type="text"
                                          className="w-full mt-0.5 px-2 py-1 rounded bg-background border border-border text-xs text-foreground"
                                          value={editZoneName}
                                          onChange={(e) => setEditZoneName(e.target.value)}
                                        />
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <label className="text-[8px] text-muted-foreground uppercase font-bold">Lebar (m)</label>
                                          <input
                                            type="number"
                                            className="w-full mt-0.5 px-2 py-0.5 rounded bg-background border border-border text-xs text-foreground"
                                            value={editZoneWidth}
                                            onChange={(e) => setEditZoneWidth(Number(e.target.value))}
                                          />
                                        </div>
                                        <div>
                                          <label className="text-[8px] text-muted-foreground uppercase font-bold">Tinggi (m)</label>
                                          <input
                                            type="number"
                                            className="w-full mt-0.5 px-2 py-0.5 rounded bg-background border border-border text-xs text-foreground"
                                            value={editZoneHeight}
                                            onChange={(e) => setEditZoneHeight(Number(e.target.value))}
                                          />
                                        </div>
                                      </div>
                                      <div className="flex gap-2 pt-1">
                                        <Button size="sm" className="flex-1 h-6 text-[10px] cursor-pointer" onClick={handleUpdateZone}>
                                          Save
                                        </Button>
                                        <Button size="sm" variant="ghost" className="h-6 text-[10px] cursor-pointer" onClick={() => setEditingZoneId(null)}>
                                          Cancel
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div
                                      onClick={() => {
                                        setSelectedGroupId(bg.id);
                                        setSelectedZoneId(z.id);
                                      }}
                                      className={`p-1.5 rounded-lg border text-[11px] cursor-pointer transition-all flex items-center justify-between ${isThisZoneActive
                                        ? 'bg-primary/10 border-primary text-foreground font-bold shadow-xs'
                                        : 'bg-background border-border text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                                        }`}
                                    >
                                      <div className="flex items-center gap-1.5 truncate">
                                        <span className="text-muted-foreground font-mono text-[10px]">↳</span>
                                        <div className="truncate">
                                          <span className="block truncate font-semibold text-foreground">{z.name}</span>
                                          <span className="text-[8.5px] text-muted-foreground font-mono">
                                            {z.width}m × {z.height}m
                                          </span>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1 shrink-0">
                                        {floorMeshCount > 0 && (
                                          <span className="px-1.5 py-0.2 rounded-full text-[8px] bg-emerald-500 text-white font-bold">
                                            {floorMeshCount} Mesh
                                          </span>
                                        )}
                                        {isAdmin && (
                                          <>
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                startEditZone(z);
                                              }}
                                              className="p-1 text-muted-foreground hover:text-primary rounded hover:bg-primary/10"
                                              title="Edit Zone"
                                            >
                                              <Pencil className="h-3 w-3" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteZone(z.id, z.name);
                                              }}
                                              className="p-1 text-muted-foreground hover:text-destructive rounded hover:bg-destructive/10"
                                              title="Delete Zone"
                                            >
                                              <Trash2 className="h-3 w-3" />
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* 2. Standalone / Unassigned Zones (Zones not in any group) */}
                {(() => {
                  const assignedZoneIds = new Set(
                    buildingGroups.flatMap((g) => g.floors.map((f) => f.zoneId))
                  );
                  const standaloneZones = zones.filter((z) => !assignedZoneIds.has(z.id));

                  if (standaloneZones.length === 0) return null;

                  return (
                    <div className="pt-2 border-t border-border/50 space-y-1.5">
                      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">
                        Denah Standalone ({standaloneZones.length})
                      </div>
                      <div className="space-y-1">
                        {standaloneZones.map((z) => {
                          const isThisZoneActive = selectedZoneId === z.id;
                          const meshCount = allTenantMesh.filter((m) => m.zoneId === z.id || m.zone?.id === z.id).length;

                          return (
                            <div key={z.id} className="space-y-1">
                              {editingZoneId === z.id ? (
                                <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/40 space-y-2">
                                  <div className="text-[10px] font-bold text-foreground flex justify-between items-center">
                                    <span>Edit Zone & Denah</span>
                                    <button onClick={() => setEditingZoneId(null)} className="text-muted-foreground hover:text-foreground">
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                  <div>
                                    <label className="text-[8px] text-muted-foreground uppercase font-bold">Nama Zone</label>
                                    <input
                                      type="text"
                                      className="w-full mt-0.5 px-2 py-1 rounded bg-background border border-border text-xs text-foreground"
                                      value={editZoneName}
                                      onChange={(e) => setEditZoneName(e.target.value)}
                                    />
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="text-[8px] text-muted-foreground uppercase font-bold">Lebar (m)</label>
                                      <input
                                        type="number"
                                        className="w-full mt-0.5 px-2 py-0.5 rounded bg-background border border-border text-xs text-foreground"
                                        value={editZoneWidth}
                                        onChange={(e) => setEditZoneWidth(Number(e.target.value))}
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[8px] text-muted-foreground uppercase font-bold">Tinggi (m)</label>
                                      <input
                                        type="number"
                                        className="w-full mt-0.5 px-2 py-0.5 rounded bg-background border border-border text-xs text-foreground"
                                        value={editZoneHeight}
                                        onChange={(e) => setEditZoneHeight(Number(e.target.value))}
                                      />
                                    </div>
                                  </div>
                                  <div className="flex gap-2 pt-1">
                                    <Button size="sm" className="flex-1 h-6 text-[10px] cursor-pointer" onClick={handleUpdateZone}>
                                      Save
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-6 text-[10px] cursor-pointer" onClick={() => setEditingZoneId(null)}>
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div
                                  onClick={() => {
                                    setSelectedGroupId(null);
                                    setSelectedZoneId(z.id);
                                  }}
                                  className={`p-1.5 rounded-lg border text-[11px] cursor-pointer transition-all flex items-center justify-between ${isThisZoneActive
                                    ? 'bg-primary/10 border-primary text-foreground font-bold shadow-xs'
                                    : 'bg-background border-border text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                                    }`}
                                >
                                  <div className="flex items-center gap-1.5 truncate">
                                    <Layers className="h-3.5 w-3.5 text-primary shrink-0" />
                                    <div className="truncate">
                                      <span className="block truncate font-semibold text-foreground">{z.name}</span>
                                      <span className="text-[8.5px] text-muted-foreground font-mono">
                                        {z.width}m × {z.height}m
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    {meshCount > 0 && (
                                      <span className="px-1.5 py-0.2 rounded-full text-[8px] bg-emerald-500 text-white font-bold">
                                        {meshCount} Mesh
                                      </span>
                                    )}
                                    {isAdmin && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            startEditZone(z);
                                          }}
                                          className="p-1 text-muted-foreground hover:text-primary rounded hover:bg-primary/10"
                                          title="Edit Zone"
                                        >
                                          <Pencil className="h-3 w-3" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteZone(z.id, z.name);
                                          }}
                                          className="p-1 text-muted-foreground hover:text-destructive rounded hover:bg-destructive/10"
                                          title="Delete Zone"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
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
                  <Anchor className="h-4 w-4 text-cyan-400" />
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
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs transition-all ${isPlacedOnCurrent
                          ? 'bg-cyan-500/10 border-cyan-500/30 shadow-xs'
                          : 'bg-secondary/40 border-border text-foreground'
                          }`}
                      >
                        <div className="flex items-center gap-2 truncate mr-2">
                          <Anchor className={`h-3.5 w-3.5 flex-shrink-0 ${isPlacedOnCurrent ? 'text-cyan-500' : 'text-muted-foreground'}`} />
                          <div className="truncate">
                            <div className="font-bold text-[11px] truncate text-foreground">{an.name}</div>
                            <div className="text-[9px] font-mono text-muted-foreground">
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
                  <Eye className="h-4 w-4 text-emerald-400" />
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
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs transition-all ${isPlacedOnCurrent
                          ? 'bg-emerald-500/10 border-emerald-500/30 shadow-xs'
                          : 'bg-secondary/40 border-border text-foreground'
                          }`}
                      >
                        <div className="flex items-center gap-2 truncate mr-2">
                          <Eye className={`h-3.5 w-3.5 flex-shrink-0 ${isPlacedOnCurrent ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                          <div className="truncate">
                            <div className="font-bold text-[11px] truncate text-foreground">{ms.name}</div>
                            <div className="text-[9px] font-mono text-muted-foreground">
                              {isPlacedOnCurrent
                                ? `Pos: (${ms.planX?.toFixed(1) ?? '?'}m, ${ms.planY?.toFixed(1) ?? '?'}m)`
                                : ms.type || 'MESH'}
                            </div>
                            {isPlacedOnCurrent && (ms.tag?.battery !== null && ms.tag?.battery !== undefined || ms.tag?.temperature !== null && ms.tag?.temperature !== undefined || ms.tag?.humidity !== null && ms.tag?.humidity !== undefined) && (
                              <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[8px] bg-background/80 p-1 rounded border border-border">
                                {ms.tag?.battery !== null && ms.tag?.battery !== undefined && (
                                  <span className="flex items-center gap-0.5 text-amber-600 dark:text-yellow-400 font-medium">
                                    {'\U0001f50b'} <span className="font-bold">{ms.tag.battery.toFixed(0)}%</span>
                                  </span>
                                )}
                                {ms.tag?.temperature !== null && ms.tag?.temperature !== undefined && (
                                  <span className="flex items-center gap-0.5 text-orange-600 dark:text-orange-400 font-medium">
                                    {'\U0001f321\ufe0f'} <span className="font-bold">{ms.tag.temperature.toFixed(1)}°C</span>
                                  </span>
                                )}
                                {ms.tag?.humidity !== null && ms.tag?.humidity !== undefined && (
                                  <span className="flex items-center gap-0.5 text-sky-600 dark:text-sky-400 font-medium">
                                    {'\U0001f4a7'} <span className="font-bold">{ms.tag.humidity.toFixed(1)}%</span>
                                  </span>
                                )}
                              </div>
                            )}

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
            {/* View Mode Switchers */}
            <div className="flex items-center p-0.5 bg-secondary/60 border border-border rounded-xl">
              <button
                type="button"
                onClick={() => setViewMode('single_2d')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${viewMode === 'single_2d'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
                  }`}
                title="Single Floor 2D Canvas"
              >
                <Layers className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">2D Canvas</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('split_grid')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${viewMode === 'split_grid'
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
                  }`}
                title="Split Grid Multi-Floor View"
              >
                <Building2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Split Grid (2D)</span>
              </button>
            </div>

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

        {/* Map Canvas & Multi-Floor Views */}
        <div className="flex-1 rounded-2xl overflow-hidden border border-border shadow-2xl bg-card relative min-h-[500px] isolate">


          {/* VIEW MODE: SPLIT GRID MULTI-FLOOR VIEW */}
          {viewMode === 'split_grid' && (
            <div className="absolute inset-0 z-[1000] bg-background p-4 overflow-y-auto animate-in fade-in duration-200">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-emerald-500" />
                  <h3 className="text-sm font-bold text-foreground">
                    Split Screen Floor Grid — {buildingGroups.find(g => g.id === selectedGroupId)?.name || 'Building Floors'}
                  </h3>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => setViewMode('single_2d')}
                >
                  <X className="h-3.5 w-3.5 mr-1" /> Close Grid
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(() => {
                  const currentGroup = buildingGroups.find(g => g.id === selectedGroupId) || buildingGroups[0];
                  if (!currentGroup || currentGroup.floors.length === 0) {
                    return (
                      <div className="col-span-2 text-center py-12 text-muted-foreground text-xs italic">
                        Belum ada lantai di dalam grup gedung ini.
                      </div>
                    );
                  }

                  return currentGroup.floors.map((fl) => {
                    const zone = zones.find(z => z.id === fl.zoneId);
                    const floorMesh = allTenantMesh.filter(m => m.zoneId === fl.zoneId || m.zone?.id === fl.zoneId);

                    return (
                      <div
                        key={fl.zoneId}
                        onClick={() => {
                          setSelectedZoneId(fl.zoneId);
                          setViewMode('single_2d');
                        }}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer ${selectedZoneId === fl.zoneId
                          ? 'bg-primary/5 border-primary shadow-md'
                          : 'bg-card border-border hover:bg-secondary/40'
                          }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="font-mono text-xs">
                              Lantai {fl.floorOrder}
                            </Badge>
                            <span className="font-bold text-xs text-foreground">{fl.floorName}</span>
                          </div>
                          <Badge className="bg-emerald-500 text-white text-[10px]">
                            {floorMesh.length} Mesh Active
                          </Badge>
                        </div>

                        <div className="w-full h-56 bg-secondary/30 rounded-xl border border-border relative overflow-hidden flex items-center justify-center">
                          {zone?.floorPlanUrl ? (
                            <img
                              src={`${getBackendUrl()}${zone.floorPlanUrl}`}
                              alt={fl.floorName}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground font-mono">No floorplan image</span>
                          )}

                          {floorMesh.map((m) => {
                            const posX = zone?.width ? Math.min(95, Math.max(5, ((m.planX || zone.width / 2) / zone.width) * 100)) : 50;
                            const posY = zone?.height ? Math.min(95, Math.max(5, ((m.planY || zone.height / 2) / zone.height) * 100)) : 50;
                            return (
                              <div
                                key={m.id}
                                className="absolute transform -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 bg-background/90 p-1 rounded border border-border shadow-sm text-[9px] font-bold"
                                style={{ left: `${posX}%`, top: `${posY}%` }}
                              >
                                <Tag className="h-3 w-3 text-emerald-500" />
                                <span>{m.name}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {/* ELEVATOR SWITCHER WIDGET (Left floating bar in Single 2D Canvas) */}
          {selectedGroupId && viewMode === 'single_2d' && (() => {
            const currentGroup = buildingGroups.find(g => g.id === selectedGroupId);
            if (!currentGroup || currentGroup.floors.length <= 1) return null;

            // Only show elevator widget if the currently selected zone belongs to this building group
            const isSelectedZoneInThisGroup = currentGroup.floors.some(f => f.zoneId === selectedZoneId);
            if (!isSelectedZoneInThisGroup) return null;

            const sortedFloors = [...currentGroup.floors].sort((a, b) => b.floorOrder - a.floorOrder);

            return (
              <div className="absolute top-4 left-4 z-[800] bg-card/90 backdrop-blur-md border border-border rounded-xl p-1.5 shadow-xl flex flex-col gap-1 space-y-0.5">
                <div className="text-[9px] font-bold uppercase text-muted-foreground text-center px-1 border-b border-border/50 pb-1 mb-0.5">
                  Elevator
                </div>
                {sortedFloors.map((fl) => {
                  const isActive = selectedZoneId === fl.zoneId;
                  const count = allTenantMesh.filter(m => m.zoneId === fl.zoneId || m.zone?.id === fl.zoneId).length;

                  return (
                    <button
                      key={fl.zoneId}
                      type="button"
                      onClick={() => setSelectedZoneId(fl.zoneId)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-between gap-2 border ${isActive
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-secondary/50 border-border text-muted-foreground hover:text-foreground hover:bg-secondary'
                        }`}
                      title={`Switch to ${fl.floorName}`}
                    >
                      <span className="font-mono">L{fl.floorOrder}</span>
                      <span className="text-[10px] truncate max-w-[70px] font-normal">{fl.floorName}</span>
                      {count > 0 && (
                        <span className={`px-1 py-0.2 rounded-full text-[8px] font-bold ${isActive ? 'bg-primary-foreground text-primary' : 'bg-emerald-500 text-white'}`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })()}

          {!selectedZoneId && viewMode === 'single_2d' && (
            <div className="absolute inset-0 z-[1000] flex flex-col items-center justify-center p-6 bg-card/95 backdrop-blur-md overflow-y-auto">
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
                          onClick={() => {
                            const parentGroup = buildingGroups.find(g => g.floors.some(f => f.zoneId === z.id));
                            setSelectedGroupId(parentGroup ? parentGroup.id : null);
                            setSelectedZoneId(z.id);
                          }}
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
                              <MapPin className="h-3.5 w-3.5 text-primary" />
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
            <div className="absolute top-4 right-4 z-[800]">
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
                      <Hexagon className="w-4 h-4 text-primary" /> Geofences
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 p-1 rounded transition-colors">
                      <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        checked={layerVisibility.anchor}
                        onChange={(e) => setLayerVisibility(prev => ({ ...prev, anchor: e.target.checked }))}
                      />
                      <div dangerouslySetInnerHTML={{ __html: getAssetMarkerIcon('ANCHOR', '', dbAssetTypes).svg }} style={{ color: getAssetMarkerIcon('ANCHOR', '', dbAssetTypes).color }} className="w-4 h-4 flex items-center justify-center" /> Anchors
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 p-1 rounded transition-colors">
                      <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        checked={layerVisibility.mesh}
                        onChange={(e) => setLayerVisibility(prev => ({ ...prev, mesh: e.target.checked }))}
                      />
                      <div dangerouslySetInnerHTML={{ __html: getAssetMarkerIcon('MESH_EYE_SENSOR', '', dbAssetTypes).svg }} style={{ color: getAssetMarkerIcon('MESH_EYE_SENSOR', '', dbAssetTypes).color }} className="w-4 h-4 flex items-center justify-center" /> Mesh
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

      {/* BUILDING GROUP MANAGER MODAL */}
      {showGroupModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between shadow-sm shrink-0">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Building2 className="h-4.5 w-4.5" />
                <span>{editingGroupId ? 'Edit Building Group' : 'Tambah Building Group Baru'}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowGroupModal(false)}
                className="p-1 hover:bg-black/20 rounded-lg text-primary-foreground/80 hover:text-primary-foreground cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 overflow-y-auto space-y-4 flex-1">
              <div className="space-y-1">
                <label className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Nama Gedung *</label>
                <input
                  type="text"
                  value={groupModalName}
                  onChange={(e) => setGroupModalName(e.target.value)}
                  placeholder="e.g. Gedung Utama Tower A"
                  className="w-full px-3 py-1.5 bg-background border border-border rounded-xl text-xs font-semibold text-foreground focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Deskripsi (Opsional)</label>
                <input
                  type="text"
                  value={groupModalDesc}
                  onChange={(e) => setGroupModalDesc(e.target.value)}
                  placeholder="e.g. Gedung administrasi & operasional 4 lantai"
                  className="w-full px-3 py-1.5 bg-background border border-border rounded-xl text-xs font-medium text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-primary uppercase font-bold tracking-wider">Lantai / Floor Plans ({groupModalFloors.length})</span>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {zones.map((z) => {
                    const isAdded = groupModalFloors.some((f) => f.zoneId === z.id);
                    const currentFloorObj = groupModalFloors.find((f) => f.zoneId === z.id);

                    return (
                      <div
                        key={z.id}
                        className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all ${isAdded ? 'bg-primary/10 border-primary/40' : 'bg-secondary/20 border-border opacity-75'
                          }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <input
                            type="checkbox"
                            checked={isAdded}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setGroupModalFloors((prev) => [
                                  ...prev,
                                  { zoneId: z.id, floorName: z.name, floorOrder: prev.length + 1 }
                                ]);
                              } else {
                                setGroupModalFloors((prev) => prev.filter((f) => f.zoneId !== z.id));
                              }
                            }}
                            className="rounded border-border text-primary focus:ring-primary cursor-pointer"
                          />
                          <span className="font-bold text-foreground truncate">{z.name}</span>
                        </div>

                        {isAdded && (
                          <div className="flex items-center gap-2 shrink-0">
                            <input
                              type="text"
                              value={currentFloorObj?.floorName || z.name}
                              onChange={(e) => {
                                const val = e.target.value;
                                setGroupModalFloors((prev) =>
                                  prev.map((f) => (f.zoneId === z.id ? { ...f, floorName: val } : f))
                                );
                              }}
                              placeholder="Nama Lantai"
                              className="w-24 px-2 py-0.5 bg-background border border-border rounded text-[10px] font-medium"
                            />
                            <div className="flex items-center gap-1 text-[10px]">
                              <span className="text-muted-foreground font-mono">Order:</span>
                              <input
                                type="number"
                                value={currentFloorObj?.floorOrder || 1}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setGroupModalFloors((prev) =>
                                    prev.map((f) => (f.zoneId === z.id ? { ...f, floorOrder: val } : f))
                                  );
                                }}
                                className="w-12 px-1.5 py-0.5 bg-background border border-border rounded text-[10px] font-mono text-center"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 bg-secondary/20 border-t border-border flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowGroupModal(false)}
                className="px-4 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-secondary/80 rounded-lg transition-colors cursor-pointer uppercase tracking-wider"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={() => {
                  const nameTrim = groupModalName.trim() || 'Gedung Tanpa Nama';
                  if (editingGroupId) {
                    const updated = buildingGroups.map((g) =>
                      g.id === editingGroupId
                        ? { ...g, name: nameTrim, description: groupModalDesc, floors: groupModalFloors }
                        : g
                    );
                    saveBuildingGroupsState(updated);
                  } else {
                    const newGroup: BuildingGroup = {
                      id: `bg-${Date.now()}`,
                      name: nameTrim,
                      description: groupModalDesc,
                      floors: groupModalFloors
                    };
                    const updated = [...buildingGroups, newGroup];
                    saveBuildingGroupsState(updated);
                    setSelectedGroupId(newGroup.id);
                  }
                  setShowGroupModal(false);
                }}
                className="px-5 py-1.5 text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg shadow-sm transition-colors cursor-pointer uppercase tracking-wider"
              >
                SAVE BUILDING GROUP
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
