'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { getApiUrl } from '../../lib/api';
import FloorMap, { MapAsset } from '../../components/FloorMap';
import { getAssetMarkerIcon } from '../../lib/icon-utils';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { 
  Play, 
  MapPin, 
  Thermometer, 
  Battery, 
  Activity, 
  AlertTriangle,
  Radio,
  Globe,
  HardDrive,
  Boxes,
  Sliders,
  Folder,
  Car,
  Cpu,
  Zap,
  Shield,
  Crosshair,
  Truck,
  Wrench,
  Tag,
  Tv,
  Navigation,
  Layers,
  Wifi,
  Database,
  Server,
  Anchor,
  Gauge,
  Compass,
  Eye,
  Settings,
  Flame,
  Sun,
  Wind,
  Clock,
  Key,
  Lock,
  Bell,
  Inbox,
  Maximize2,
  Building,
  DoorClosed,
  Lightbulb,
  Monitor,
  ChevronUp,
  ChevronDown,
  Check,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ElementType> = {
  MapPin,
  HardDrive,
  Activity,
  Boxes,
  Sliders,
  Folder,
  Globe,
  Car,
  Cpu,
  Radio,
  Zap,
  Shield,
  Crosshair,
  Truck,
  Wrench,
  Battery,
  Tag,
  Tv,
  Navigation,
  Layers,
  Wifi,
  Database,
  Server,
  Anchor,
  Gauge,
  Compass,
  Eye,
  Settings,
  Flame,
  Sun,
  Wind,
  Thermometer,
  Clock,
  Key,
  Lock,
  Bell,
  Inbox,
  Maximize2,
  Building,
  DoorClosed,
  Lightbulb,
  Monitor,
};

export default function MapPage() {
  const { tenantId, token } = useAuth();
  const { assets, simulationActive, setSimulationActive } = useSocket();
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [dbAnchors, setDbAnchors] = useState<any[]>([]);
  const [dbAssetTypes, setDbAssetTypes] = useState<any[]>([]);
  const [hiddenTypes, setHiddenTypes] = useState<string[]>([]);
  const [legendOpen, setLegendOpen] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    const fetchAssetTypes = async () => {
      try {
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (tenantId) headers['x-tenant-id'] = tenantId;

        const res = await fetch(`${getApiUrl()}/asset-types`, { headers });
        if (res.ok && isMounted) {
          const data = await res.json();
          setDbAssetTypes(data);
        }
      } catch (e) {
        // Ignored during backend restart / temporary network reconnect
      }
    };
    fetchAssetTypes();
    return () => { isMounted = false; };
  }, [token, tenantId]);

  const getSelectedAssetIconComp = (type: string = '', name: string = '') => {
    const t = (type || '').toUpperCase();
    const n = (name || '').toLowerCase();

    let matched = dbAssetTypes.find((x: any) => x.code.toUpperCase() === t);

    if (!matched && dbAssetTypes.length > 0) {
      if (t === 'ANCHOR' || n.includes('anchor')) {
        matched = dbAssetTypes.find((x: any) => x.code.toUpperCase() === 'ANCHOR');
      } else if (t === 'TAG' || n.includes('tag')) {
        matched = dbAssetTypes.find((x: any) => x.code.toUpperCase() === 'TAG');
      } else if (t === 'MESH_EYE_SENSOR' || n.includes('mesh')) {
        matched = dbAssetTypes.find((x: any) => x.code.toUpperCase() === 'MESH_EYE_SENSOR');
      } else if (t === 'FORKLIFT' || n.includes('forklift')) {
        matched = dbAssetTypes.find((x: any) => x.code.toUpperCase() === 'FORKLIFT');
      }
    }

    const iconName = matched?.icon || (t === 'ANCHOR' ? 'Anchor' : t === 'TAG' ? 'HardDrive' : t === 'MESH_EYE_SENSOR' ? 'Activity' : t === 'FORKLIFT' ? 'Boxes' : 'Radio');
    return ICON_MAP[iconName] || Radio;
  };

  const fetchDbAnchors = async () => {
    try {
      const headers: Record<string, string> = { 'x-tenant-id': tenantId || '' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${getApiUrl()}/assets/anchors`, { headers });
      if (res.ok) {
        const data = await res.json();
        setDbAnchors(data);
      }
    } catch (e) {
      // Ignored during backend restart / temporary network reconnect
    }
  };

  useEffect(() => {
    if (tenantId) {
      fetchDbAnchors();
    }
  }, [tenantId, assets]); // Re-fetch or sync when assets change

  const getCombinedAnchors = () => {
    const assetAnchors = assets
      .filter((a) => a.type === 'ANCHOR')
      .map((a) => {
        let anchorId = a.name;
        try {
          if (a.description && a.description.startsWith('{')) {
            const parsed = JSON.parse(a.description);
            anchorId = parsed.attributes?.find((at: any) => at.name === 'anchorId')?.value || a.name;
          }
        } catch (e) {}

        return {
          id: a.id,
          name: a.name,
          x: a.planX !== null && a.planX !== undefined ? Number(a.planX) : 10,
          y: a.planY !== null && a.planY !== undefined ? Number(a.planY) : 10,
          latitude: a.latitude !== null && a.latitude !== undefined ? Number(a.latitude) : null,
          longitude: a.longitude !== null && a.longitude !== undefined ? Number(a.longitude) : null,
          anchorId,
        };
      });

    const tableAnchorsOnly = dbAnchors.filter(
      (da) => !assets.some((a) => a.id === da.id) && !assetAnchors.some((aa) => aa.anchorId === da.anchorId)
    );

    return [...assetAnchors, ...tableAnchorsOnly];
  };

  const currentAnchors = getCombinedAnchors();

  const handleAnchorUpdate = async (id: string, x: number, y: number) => {
    setDbAnchors((prev) => prev.map((a) => (a.id === id ? { ...a, x, y } : a)));
    
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-tenant-id': tenantId || '',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      await fetch(`${getApiUrl()}/floorplans/anchors/position`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          anchorId: id,
          x: Number(x.toFixed(2)),
          y: Number(y.toFixed(2)),
        }),
      });
    } catch (e) {
      console.error('Failed to persist anchor coordinate update:', e);
    }
  };

  const getMapAssets = (): MapAsset[] => {
    if (simulationActive) {
      const mockNodes: MapAsset[] = [
        {
          id: 'node-mesh-1',
          name: 'Sensor Node Alpha',
          meshLabel: 'Mesh 1',
          type: 'Static Tag',
          status: 'static',
          x: 34,
          y: 8,
          lat: -6.1689,
          lon: 106.8995,
          tag: {
            id: 'tag-439201',
            name: 'Teltonika Tag #1',
            temperature: 23.4,
            humidity: 52.0,
            battery: 3.6,
            rssi: -62,
            lastSeen: new Date().toISOString(),
          },
        },
        {
          id: 'node-mesh-3',
          name: 'Pallet Kargo A4',
          meshLabel: 'Mesh 3',
          type: 'Pallet',
          status: 'tilt_warning',
          x: 42,
          y: 10,
          lat: -6.1691,
          lon: 106.8998,
          tag: {
            id: 'tag-439202',
            name: 'Teltonika Tag #3',
            temperature: 28.1,
            humidity: 61.5,
            battery: 3.2,
            rssi: -84,
            lastSeen: new Date().toISOString(),
          },
        },
        {
          id: 'node-mesh-5',
          name: 'Container B2',
          meshLabel: 'Mesh 5',
          type: 'Container',
          status: 'static',
          x: 32,
          y: 22,
          lat: -6.1688,
          lon: 106.8999,
          tag: {
            id: 'tag-439205',
            name: 'Teltonika Tag #5',
            temperature: 24.0,
            humidity: 55.0,
            battery: 3.5,
            rssi: -68,
            lastSeen: new Date().toISOString(),
          },
        },
        {
          id: 'node-mesh-4',
          name: 'Forklift TF-01',
          meshLabel: 'Mesh 4',
          type: 'Vehicle',
          status: 'moving',
          x: 32,
          y: 28,
          lat: -6.1692,
          lon: 106.8994,
          tag: {
            id: 'tag-439204',
            name: 'Teltonika Tag #4',
            temperature: 25.8,
            humidity: 48.0,
            battery: 3.6,
            rssi: -58,
            lastSeen: new Date().toISOString(),
          },
        },
      ];
      const time = Date.now() / 2500;
      const mesh4 = mockNodes.find((m) => m.meshLabel === 'Mesh 4');
      if (mesh4) {
        mesh4.lat = -6.1692 + Math.sin(time) * 0.0003;
        mesh4.lon = 106.8994 + Math.cos(time) * 0.0003;
      }
      return mockNodes;
    }

    const displayableAssets = assets.filter(
      (a) => !a.type.startsWith('AGENT_') && a.type !== 'CITY' && a.type !== 'BUILDING'
    );

    const baseLat = -6.168911;
    const baseLon = 106.899709;

    return displayableAssets.map((a) => {
      let x = 30;
      let y = 20;
      if (a.planX !== null && a.planX !== undefined) x = Number(a.planX);
      if (a.planY !== null && a.planY !== undefined) y = Number(a.planY);

      let tagData: any = a.tag ? {
        id: a.tag.id,
        name: a.tag.name,
        temperature: a.tag.temperature,
        humidity: a.tag.humidity,
        battery: a.tag.battery,
        rssi: a.tag.rssi,
        lastSeen: a.tag.lastSeen,
      } : null;
      let descriptionParsed: any = {};
      
      try {
        if (a.description && a.description.startsWith('{')) {
          descriptionParsed = JSON.parse(a.description);
        }
      } catch (e) {}

      const attrs = descriptionParsed.attributes || [];
      const temp = attrs.find((at: any) => at.name === 'temperature')?.value;
      const hum = attrs.find((at: any) => at.name === 'humidity')?.value;
      const volt = attrs.find((at: any) => at.name === 'voltage')?.value;
      const rssi = attrs.find((at: any) => at.name === 'gateway_rssi' || at.name === 'rssi')?.value;

      if (descriptionParsed.attributes) {
        if (!tagData) {
          tagData = {
            id: a.tagId || a.id,
            name: a.name,
            temperature: null,
            humidity: null,
            battery: null,
            rssi: null,
            lastSeen: null,
          };
        }
        if (temp !== undefined && temp !== '') tagData.temperature = Number(temp);
        if (hum !== undefined && hum !== '') tagData.humidity = Number(hum);
        if (volt !== undefined && volt !== '') tagData.battery = Number(volt);
        if (rssi !== undefined && rssi !== '') tagData.rssi = Number(rssi);
      }

      let rssiList: { x: number; y: number; rssi: number }[] = [];
      attrs.forEach((attr: any) => {
        if (attr.name.startsWith('rssi_') && attr.value !== undefined && attr.value !== null && attr.value !== '') {
          const rssiVal = Number(attr.value);
          if (!isNaN(rssiVal)) {
            let anchorId = '';
            if (attr.name === 'rssi_anchor_1' || attr.name === 'rssi_anchor_2') {
              if (attr.mqttValuePath && attr.mqttValuePath.includes('rssi_')) {
                anchorId = attr.mqttValuePath.split('rssi_')[1];
              }
            } else {
              anchorId = attr.name.replace('rssi_', '');
            }

            if (anchorId) {
              const matchedAnchor = currentAnchors.find((an) => an.anchorId === anchorId);
              if (matchedAnchor) {
                rssiList.push({
                  x: matchedAnchor.x,
                  y: matchedAnchor.y,
                  rssi: rssiVal,
                });
              }
            }
          }
        }
      });

      if (rssiList.length > 0) {
        let totalWeight = 0;
        let weightedX = 0;
        let weightedY = 0;
        
        rssiList.forEach((item) => {
          const weight = Math.pow(item.rssi + 100, 2);
          weightedX += item.x * weight;
          weightedY += item.y * weight;
          totalWeight += weight;
        });
        
        if (totalWeight > 0) {
          x = weightedX / totalWeight;
          y = weightedY / totalWeight;
        }
      }

      let statusVal: 'static' | 'moving' | 'tilt_warning' | 'fall_detected' = 'static';
      const motion = attrs.find((at: any) => at.name === 'motion')?.value;
      const isStatic = attrs.find((at: any) => at.name === 'is_static')?.value;
      const hall = attrs.find((at: any) => at.name === 'hall')?.value;

      if (a.status === 'tilt_warning' || a.status === 'fall_detected') {
        statusVal = a.status;
      } else if (motion === true || motion === 'true' || hall === true || hall === 'true' || isStatic === false || isStatic === 'false') {
        statusVal = 'moving';
      }

      // Determine GPS lat/lon for the global Leaflet map
      let realLat = baseLat;
      let realLon = baseLon;

      // 1. If asset has valid explicitly set GPS coordinates
      const hasExplicitGps = 
        a.latitude !== null && a.latitude !== undefined && 
        a.longitude !== null && a.longitude !== undefined &&
        !isNaN(Number(a.latitude)) && !isNaN(Number(a.longitude)) &&
        (Number(a.latitude) <= 15 && Number(a.latitude) >= -15 && Number(a.longitude) >= 90 && Number(a.longitude) <= 145);

      if (hasExplicitGps) {
        realLat = Number(a.latitude);
        realLon = Number(a.longitude);
      } else {
        // 2. Relative offset from site base GPS using calculated/assigned indoor meter coordinates (x, y)
        // 1 meter in latitude ~ 0.000009 degrees, in longitude ~ 0.000009 degrees
        realLat = baseLat + (y * 0.000009);
        realLon = baseLon + (x * 0.000009);
      }

      return {
        id: a.id,
        name: a.name,
        meshLabel: a.tagId ? `Node ${a.tagId}` : a.name,
        type: a.type,
        status: statusVal,
        x,
        y,
        lat: realLat,
        lon: realLon,
        latitude: a.latitude !== null && a.latitude !== undefined ? Number(a.latitude) : null,
        longitude: a.longitude !== null && a.longitude !== undefined ? Number(a.longitude) : null,
        tag: tagData,
      };
    });
  };

  const mapAssets = getMapAssets();

  const tenantAssetTypeCounts = useMemo(() => {
    const counts: Record<string, { code: string; name: string; icon: string; color: string; count: number }> = {};

    dbAssetTypes.forEach((at) => {
      counts[at.code.toUpperCase()] = {
        code: at.code.toUpperCase(),
        name: at.name,
        icon: at.icon || 'HardDrive',
        color: at.color || '#3b82f6',
        count: 0,
      };
    });

    mapAssets.forEach((a) => {
      const t = (a.type || '').toUpperCase();
      const n = (a.name || '').toLowerCase();

      let matchedCode = Object.keys(counts).find((code) => code.toUpperCase() === t);
      if (!matchedCode) {
        if (t === 'ANCHOR' || n.includes('anchor')) matchedCode = 'ANCHOR';
        else if (t === 'TAG' || n.includes('tag')) matchedCode = 'TAG';
        else if (t === 'MESH_EYE_SENSOR' || n.includes('mesh')) matchedCode = 'MESH_EYE_SENSOR';
        else if (t === 'FORKLIFT' || n.includes('forklift')) matchedCode = 'FORKLIFT';
      }

      if (matchedCode && counts[matchedCode]) {
        counts[matchedCode].count += 1;
      } else {
        counts[t] = {
          code: t,
          name: a.type || 'Other Asset',
          icon: 'Radio',
          color: '#64748b',
          count: (counts[t]?.count || 0) + 1,
        };
      }
    });

    return Object.values(counts)
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [dbAssetTypes, mapAssets]);

  const visibleMapAssets = useMemo(() => {
    return mapAssets.filter((asset) => {
      const typeCode = (asset.type || '').toUpperCase();
      if (hiddenTypes.includes(typeCode)) return false;

      const n = (asset.name || '').toLowerCase();
      if ((typeCode === 'ANCHOR' || n.includes('anchor')) && hiddenTypes.includes('ANCHOR')) return false;
      if ((typeCode === 'TAG' || n.includes('tag')) && hiddenTypes.includes('TAG')) return false;
      if ((typeCode === 'MESH_EYE_SENSOR' || n.includes('mesh')) && hiddenTypes.includes('MESH_EYE_SENSOR')) return false;
      if ((typeCode === 'FORKLIFT' || n.includes('forklift')) && hiddenTypes.includes('FORKLIFT')) return false;

      return true;
    });
  }, [mapAssets, hiddenTypes]);

  const visibleAnchors = useMemo(() => {
    if (hiddenTypes.includes('ANCHOR')) return [];
    return currentAnchors;
  }, [currentAnchors, hiddenTypes]);

  const selectedAsset = visibleMapAssets.find((a) => a.id === selectedAssetId) || null;

  // Calculate online/offline assets count based on visible assets
  const filteredAssetsOnly = visibleMapAssets.filter(
    (a) => !a.type.startsWith('AGENT_') && a.type !== 'ANCHOR' && a.type !== 'CITY' && a.type !== 'BUILDING'
  );
  const onlineAssetsCount = filteredAssetsOnly.filter((a) => {
    if (!a.tag?.lastSeen) return false;
    const lastSeenDate = new Date(a.tag.lastSeen);
    const diffMs = Date.now() - lastSeenDate.getTime();
    return diffMs < 300000; // 5 minutes threshold
  }).length;
  const offlineAssetsCount = filteredAssetsOnly.length - onlineAssetsCount;

  return (
    <div className="h-full w-full relative">
      
      {/* LEFT CONTENT: OPENSTREETMAP CANVAS */}
      <div className="w-full h-full relative">
        {/* Stats Row Banner (Assets online & offline count info) */}
        <div className="flex flex-wrap items-center gap-3 mb-3.5">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-card border border-border shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs text-muted-foreground">
              Assets Online: <strong className="text-foreground ml-1">{onlineAssetsCount}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-card border border-border shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            </span>
            <span className="text-xs text-muted-foreground">
              Assets Offline: <strong className="text-foreground ml-1">{offlineAssetsCount}</strong>
            </span>
          </div>
        </div>

        {/* OpenStreetMap Canvas Area */}
        <div className="w-full h-full relative min-h-[580px]">
          <FloorMap
            assets={visibleMapAssets}
            anchors={visibleAnchors}
            selectedAssetId={selectedAssetId}
            onSelectAsset={(asset) => setSelectedAssetId(asset.id)}
            onAnchorUpdate={handleAnchorUpdate}
          />

          {/* Floating Map Legend & Category Layer Filter Panel (placed top-16 to avoid overlapping map style buttons) */}
          <div className="absolute top-16 left-4 z-20 w-72 transition-all duration-300 pointer-events-auto">
            <div className="bg-card/95 backdrop-blur-md border border-border/80 shadow-2xl rounded-2xl overflow-hidden">
              {/* Card Header with Collapse Toggle */}
              <div 
                className="p-3 bg-secondary/30 flex items-center justify-between cursor-pointer select-none border-b border-border/50 hover:bg-secondary/50 transition-colors"
                onClick={() => setLegendOpen(!legendOpen)}
              >
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold text-foreground tracking-wide">Map Legend & Filter</span>
                  <span className="bg-primary/10 text-primary text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full border border-primary/20">
                    {tenantAssetTypeCounts.length}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground hover:text-foreground p-1 rounded-md">
                  {legendOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </div>
              </div>

              {/* Expandable Content */}
              {legendOpen && (
                <div className="p-3 space-y-2.5 max-h-[320px] overflow-y-auto text-xs">
                  {/* Quick Actions (Select All / Hide All) */}
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground pb-1.5 border-b border-border/40">
                    <span className="font-semibold uppercase tracking-wider text-[9px]">Asset Categories</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setHiddenTypes([])}
                        className="text-primary hover:underline font-bold"
                      >
                        Show All
                      </button>
                      <span>•</span>
                      <button
                        onClick={() => setHiddenTypes(tenantAssetTypeCounts.map((t) => t.code))}
                        className="text-muted-foreground hover:text-foreground hover:underline"
                      >
                        Hide All
                      </button>
                    </div>
                  </div>

                  {/* Asset Types Filter List */}
                  <div className="space-y-1.5">
                    {tenantAssetTypeCounts.map((item) => {
                      const isHidden = hiddenTypes.includes(item.code);
                      const IconComp = ICON_MAP[item.icon] || Radio;

                      return (
                        <div
                          key={item.code}
                          onClick={() => {
                            if (isHidden) {
                              setHiddenTypes(hiddenTypes.filter((c) => c !== item.code));
                            } else {
                              setHiddenTypes([...hiddenTypes, item.code]);
                            }
                          }}
                          className={`flex items-center justify-between p-2 rounded-xl border cursor-pointer transition-all ${
                            isHidden
                              ? 'bg-secondary/10 border-border/40 text-muted-foreground opacity-60'
                              : 'bg-secondary/40 border-border hover:border-primary/40 text-foreground font-medium shadow-sm'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* Checkbox Toggle */}
                            <div
                              className={`w-4 h-4 rounded-md flex items-center justify-center border transition-all ${
                                !isHidden
                                  ? 'bg-primary border-primary text-primary-foreground'
                                  : 'border-muted-foreground/40 bg-transparent'
                              }`}
                            >
                              {!isHidden && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>

                            {/* Icon Badge */}
                            <div
                              className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 shadow-sm"
                              style={{ backgroundColor: `${item.color}20`, color: item.color }}
                            >
                              <IconComp className="w-3.5 h-3.5" />
                            </div>

                            {/* Category Name */}
                            <span className={`text-xs truncate max-w-[120px] ${isHidden ? 'line-through opacity-70' : ''}`}>
                              {item.name}
                            </span>
                          </div>

                          {/* Count Badge */}
                          <span
                            className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full"
                            style={{
                              backgroundColor: isHidden ? 'var(--secondary)' : `${item.color}25`,
                              color: isHidden ? 'currentColor' : item.color,
                            }}
                          >
                            {item.count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Floating Telemetry Inspector Popup Card (over map) */}
          {selectedAsset && (
            <Card className="absolute top-4 right-4 z-20 w-80 flex flex-col overflow-hidden rounded-xl border border-border shadow-2xl bg-card/95 backdrop-blur-md max-h-[500px]">
              {/* Header */}
              <div 
                className="p-3 text-white flex items-center justify-between font-sans"
                style={{
                  background: `linear-gradient(to bottom right, ${getAssetMarkerIcon(selectedAsset.type, selectedAsset.name, dbAssetTypes).color}ee, ${getAssetMarkerIcon(selectedAsset.type, selectedAsset.name, dbAssetTypes).color}99)`
                }}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {React.createElement(getSelectedAssetIconComp(selectedAsset.type, selectedAsset.name), {
                    className: 'h-4 w-4 shrink-0 animate-pulse'
                  })}
                  <div className="min-w-0">
                    <h4 className="text-[9px] font-bold tracking-wider uppercase opacity-90">{selectedAsset.type}</h4>
                    <h3 className="text-xs font-black truncate max-w-[180px]">{selectedAsset.name}</h3>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedAssetId(null)}
                  className="p-1 hover:bg-white/10 rounded transition-all text-white/80 hover:text-white"
                >
                  <span className="text-xs font-mono">✕</span>
                </button>
              </div>

                 {/* Content */}
                <div className="p-4 space-y-4 overflow-y-auto max-h-[380px] text-xs">
                  {/* Clean Info row */}
                  <div className="flex justify-between items-center text-[10px] text-muted-foreground border-b border-border/60 pb-2">
                    <span className="font-bold text-foreground">
                      Device Info
                    </span>
                    <span className="font-mono bg-secondary px-1.5 py-0.5 rounded text-[9px]">
                      {selectedAsset.meshLabel}
                    </span>
                  </div>
  
                  {/* Alerts */}
                  {(selectedAsset.status === 'tilt_warning' || selectedAsset.status === 'fall_detected') && (
                    <div className="p-2 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-[10px] flex gap-1.5 items-start">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Tilt Alert Active</p>
                        <p className="text-[8.5px] opacity-90 mt-0.5">Device pitch/roll exceeded safety threshold.</p>
                      </div>
                    </div>
                  )}
  
                  {/* Dynamic Attributes Grid */}
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider">
                      Device Attributes
                    </div>
  
                    {(() => {
                      const originalAsset = assets.find(as => as.id === selectedAsset.id);
                      let customAttrs: any[] = [];
                      if (originalAsset && originalAsset.description) {
                        try {
                          const parsed = JSON.parse(originalAsset.description);
                          customAttrs = parsed.attributes || [];
                        } catch(e) {}
                      }
  
                      const getUnit = (attrNames: string[], fallback: string = '') => {
                        const attr = customAttrs.find((a: any) => attrNames.includes(a.name));
                        return attr?.unit ? ` ${attr.unit}` : fallback;
                      };

                      const co2Val = customAttrs.find((a: any) => a.name === 'co2')?.value;
                      const coVal = customAttrs.find((a: any) => a.name === 'co')?.value;

                      const itemsToRender = [
                        { label: 'CO2 Level', value: co2Val !== undefined && co2Val !== null ? `${co2Val}${getUnit(['co2'], ' ppm')}` : '--' },
                        { label: 'CO Level', value: coVal !== undefined && coVal !== null ? `${coVal}${getUnit(['co'], ' ppm')}` : '--' },
                        { label: 'Temperature', value: selectedAsset.tag && selectedAsset.tag.temperature !== null ? `${selectedAsset.tag.temperature}${getUnit(['temperature'], ' °C')}` : '--' },
                        { label: 'Humidity', value: selectedAsset.tag && selectedAsset.tag.humidity !== null ? `${selectedAsset.tag.humidity}${getUnit(['humidity'], ' %')}` : '--' },
                        { label: 'Battery/Voltage', value: selectedAsset.tag && selectedAsset.tag.battery !== null ? `${selectedAsset.tag.battery}${getUnit(['battery', 'voltage'], ' V')}` : '--' },
                        { label: 'RSSI', value: selectedAsset.tag && selectedAsset.tag.rssi !== null ? `${selectedAsset.tag.rssi}${getUnit(['rssi', 'gateway_rssi'], ' dBm')}` : '--' },
                        { 
                          label: 'Coordinates (Lat, Lon)', 
                          value: selectedAsset.latitude !== null && selectedAsset.latitude !== undefined && selectedAsset.longitude !== null && selectedAsset.longitude !== undefined
                            ? `${Number(selectedAsset.latitude).toFixed(6)}, ${Number(selectedAsset.longitude).toFixed(6)}`
                            : '--' 
                        },
                      ];

                    customAttrs.forEach((attr: any) => {
                      const isDuplicate = ['temperature', 'humidity', 'voltage', 'battery', 'gateway_rssi', 'rssi', 'co2', 'co'].includes(attr.name);
                      if (!isDuplicate && attr.value !== undefined && attr.value !== null && attr.value !== '') {
                        let displayName = attr.name;
                        displayName = attr.name
                          .replace(/_/g, ' ')
                          .replace(/([A-Z])/g, ' $1')
                          .replace(/^./, (str: string) => str.toUpperCase());
                          
                        itemsToRender.push({
                          label: displayName,
                          value: String(attr.value) + (attr.unit ? ` ${attr.unit}` : '')
                        });
                      }
                    });

                    const filteredItems = itemsToRender.filter(item => item.value !== '--' && item.value !== '');

                    if (filteredItems.length === 0) {
                      return <p className="text-[10px] text-muted-foreground">No attributes found</p>;
                    }

                    return filteredItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center py-1 border-b border-border/30 text-[11px] last:border-0">
                        <span className="text-muted-foreground">{item.label}</span>
                        <span className="font-mono font-bold text-foreground">{item.value}</span>
                      </div>
                    ));
                  })()}
                </div>

                {/* Meta info */}
                <div className="pt-2 border-t border-border/60 flex justify-between items-center text-[9px] text-muted-foreground/80 font-mono">
                  <span>Updated: {selectedAsset.tag?.lastSeen ? new Date(selectedAsset.tag.lastSeen).toLocaleString() : '--:--:--'}</span>
                  <a 
                    href={`/assets?id=${selectedAsset.id}`}
                    className="text-primary hover:underline font-bold text-[10px] tracking-wider transition-all uppercase"
                  >
                    VIEW
                  </a>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
