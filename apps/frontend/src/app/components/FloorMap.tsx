'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Maximize2, Globe } from 'lucide-react';
import { getApiUrl } from '../lib/api';
import { getLucideSvg, getAssetMarkerIcon } from '../lib/icon-utils';
import { useAuth } from '../context/AuthContext';

export interface TagData {
  id: string;
  name: string;
  temperature: number | null;
  humidity: number | null;
  battery: number | null;
  rssi: number | null;
  lastSeen?: string | Date | null;
}

export interface MapAsset {
  id: string;
  name: string;
  meshLabel: string;
  type: string;
  status: 'static' | 'moving' | 'tilt_warning' | 'fall_detected';
  x: number;
  y: number;
  locationName?: string;
  lat?: number;
  lon?: number;
  latitude?: number | null;
  longitude?: number | null;
  tag: TagData | null;
}

export interface MapAnchor {
  id: string;
  name: string;
  x: number;
  y: number;
  lat?: number;
  lon?: number;
}

interface FloorMapProps {
  assets: MapAsset[];
  anchors?: MapAnchor[];
  onAnchorUpdate?: (id: string, x: number, y: number) => void;
  onSelectAsset?: (asset: MapAsset) => void;
  selectedAssetId?: string | null;
  widthMeters?: number;
  heightMeters?: number;
  disableClustering?: boolean;
  readOnly?: boolean;
  hideMarkerOutline?: boolean;
  primaryAccentColor?: string;
  thresholds?: any[];
  targetAttribute?: string;
  showUnits?: boolean;
}



export default function FloorMap({
  assets,
  onSelectAsset,
  selectedAssetId,
  disableClustering = false,
  readOnly = false,
  hideMarkerOutline = false,
  primaryAccentColor = '#10b981',
  thresholds = [],
  targetAttribute = 'humidity',
  showUnits = true,
}: FloorMapProps) {
  const { token, tenantId, user } = useAuth();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const clusterGroupRef = useRef<any>(null);
  const hasInitializedBoundsRef = useRef<boolean>(false);
  const [mapStyle, setMapStyle] = useState<'google_roadmap' | 'osm_standard'>('google_roadmap');
  const [mapReady, setMapReady] = useState(false);
  const [clusterModalAssets, setClusterModalAssets] = useState<MapAsset[] | null>(null);
  const [dbAssetTypes, setDbAssetTypes] = useState<any[]>([]);

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

  const centerLat = -6.168911;
  const centerLon = 106.899709;
  const indonesiaBounds: [[number, number], [number, number]] = [
    [-11.5, 94.5], // Batas Barat Daya Indonesia
    [6.5, 141.5],  // Batas Timur Laut Indonesia
  ];

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    
    // Dynamically load Leaflet to avoid Next.js SSR "window is not defined" error
    const L = require('leaflet');

    const map = L.map(mapContainerRef.current, {
      center: [centerLat, centerLon],
      zoom: 16,
      minZoom: 5,
      maxZoom: 20,
      maxBounds: indonesiaBounds,
      maxBoundsViscosity: 1.0,
      zoomControl: false, // Zoom controls hidden
      worldCopyJump: false,
    });
    mapRef.current = map;

    // Set up default Layer
    const defaultLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      attribution: '© Google Maps',
      maxZoom: 20,
      minZoom: 3,
      noWrap: true,
    }).addTo(map);
    
    (map as any)._tileLayer = defaultLayer;

    // Initialize Leaflet MarkerCluster Group with Donut Ring Icon
    require('leaflet.markercluster');
    
    const clusterOptions: any = {
      maxClusterRadius: disableClustering ? 0 : 50,
      spiderfyOnMaxZoom: !disableClustering,
      spiderLegPolylineOptions: { weight: 0, opacity: 0 },
      showCoverageOnHover: false,
      polygonOptions: { weight: 0, opacity: 0, fillOpacity: 0 },
      zoomToBoundsOnClick: true,
      animate: true,
      iconCreateFunction: (cluster: any) => {
        const childMarkers = cluster.getAllChildMarkers();
        const count = childMarkers.length;

        // Tally category colors for conic-gradient outer ring
        const colorCounts: Record<string, number> = {};
        childMarkers.forEach((m: any) => {
          const color = m.options.assetColor || '#6366f1';
          colorCounts[color] = (colorCounts[color] || 0) + 1;
        });

        let gradientStops: string[] = [];
        let currentPercent = 0;
        const colors = Object.keys(colorCounts);

        if (colors.length === 1) {
          gradientStops.push(`${colors[0]} 0% 100%`);
        } else {
          colors.forEach((color) => {
            const pct = (colorCounts[color] / count) * 100;
            gradientStops.push(`${color} ${currentPercent}% ${currentPercent + pct}%`);
            currentPercent += pct;
          });
        }

        const conicGradient = `conic-gradient(${gradientStops.join(', ')})`;

        return L.divIcon({
          html: `
            <div style="
              position: relative;
              width: 44px;
              height: 44px;
              border-radius: 50%;
              background: ${conicGradient};
              padding: 4px;
              box-shadow: 0 4px 14px rgba(0,0,0,0.35);
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <div style="
                width: 36px;
                height: 36px;
                border-radius: 50%;
                background: #ffffff;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #0f172a;
                font-weight: 800;
                font-size: 13px;
                font-family: system-ui, -apple-system, sans-serif;
                box-shadow: inset 0 1px 3px rgba(0,0,0,0.15);
              ">
                ${count}
              </div>
            </div>
          `,
          className: 'custom-donut-cluster-icon',
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        });
      },
    };

    // maxClusterRadius is sufficient to disable clustering if set to 0.

    const clusterGroup = L.markerClusterGroup(clusterOptions);

    map.addLayer(clusterGroup);
    clusterGroupRef.current = clusterGroup;

    setMapReady(true);

    const timer = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      setMapReady(false);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update Tile Layer based on Map Style Toggle
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const L = require('leaflet');

    if ((map as any)._tileLayer) {
      map.removeLayer((map as any)._tileLayer);
    }

    const isOsm = mapStyle === 'osm_standard';
    const url = isOsm
      ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
      : 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';

    const newLayer = L.tileLayer(url, {
      attribution: isOsm ? '© OpenStreetMap contributors' : '© Google Maps',
      maxZoom: 20,
      minZoom: 3,
      subdomains: isOsm ? ['a', 'b', 'c'] : [],
      noWrap: true,
    }).addTo(map);

    (map as any)._tileLayer = newLayer;

    setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    }, 50);
  }, [mapStyle, mapReady]);

    // Sync Markers dynamically on the map using Leaflet MarkerCluster (Incremental Updates)
  useEffect(() => {
    const map = mapRef.current;
    const clusterGroup = clusterGroupRef.current;
    if (!map || !mapReady || !clusterGroup) return;
    const L = require('leaflet');

    const currentAssetIds = new Set(assets.map((a) => a.id));

    // 1. Remove markers for assets that no longer exist
    for (const [id, marker] of markersRef.current.entries()) {
      if (!currentAssetIds.has(id)) {
        clusterGroup.removeLayer(marker);
        markersRef.current.delete(id);
      }
    }

    const validCoords: [number, number][] = [];

    // 2. Add new markers or update existing markers in place without resetting cluster state
    assets.forEach((asset) => {
      let lat = asset.lat ?? centerLat;
      let lon = asset.lon ?? centerLon;

      if (isNaN(lat) || isNaN(lon) || lat < -11.5 || lat > 6.5 || lon < 94.5 || lon > 141.5) {
        lat = centerLat;
        lon = centerLon;
      }
      validCoords.push([lat, lon]);

      const lastSeenDate = asset.tag?.lastSeen ? new Date(asset.tag.lastSeen) : null;
      const isOnline = lastSeenDate ? Date.now() - lastSeenDate.getTime() < 300000 : false;
      const statusColor = isOnline ? '#10b981' : '#ef4444';

      const markerIconInfo = getAssetMarkerIcon(asset.type, asset.name, dbAssetTypes);
      let pinColor = (asset as any).color || (asset as any).pinColor || markerIconInfo.color;

      const isSelected = selectedAssetId === asset.id;
      const highlightColor = primaryAccentColor || user?.tenantThemeColor || '#10b981';

      // Evaluate Threshold Exceeded status for Popup
      const val = (asset as any).attributeVal !== undefined ? (asset as any).attributeVal : null;
      let thresholdStatusText = 'Normal';
      let thresholdStatusColor = '#10b981';
      let isThresholdExceeded = false;

      if (val !== null && val !== undefined && typeof val === 'number' && thresholds && thresholds.length > 0) {
        const sortedThresholds = [...thresholds].sort((a: any, b: any) => b.value - a.value);
        const highest = sortedThresholds[0];
        if (highest && val >= highest.value) {
          isThresholdExceeded = true;
          thresholdStatusText = `Melebihi Threshold (≥ ${highest.value})`;
          thresholdStatusColor = highest.color || '#ef4444';
        } else {
          const matched = sortedThresholds.find((t: any) => val >= t.value);
          if (matched) {
            if (matched.value > 0) {
              isThresholdExceeded = true;
              thresholdStatusText = `Melebihi Threshold (≥ ${matched.value})`;
            }
            thresholdStatusColor = matched.color || '#10b981';
          }
        }
      }

      // Format last update date & time
      const dateForUpdate = asset.tag?.lastSeen ? new Date(asset.tag.lastSeen) : new Date();
      const formattedDateStr = dateForUpdate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
      const formattedTimeStr = dateForUpdate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      const labelBgColor = isSelected ? highlightColor : '#ffffff';
      const labelTextColor = isSelected ? '#ffffff' : '#1e293b';
      const labelBorderColor = isSelected ? highlightColor : '#cbd5e1';
      const activePinColor = isSelected ? highlightColor : pinColor;

      const popupContent = `
        <div style="padding: 4px 6px; font-family: system-ui, -apple-system, sans-serif; font-size: 11px; color: #0f172a; min-width: 170px;">
          <div style="font-weight: 800; font-size: 12px; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; display: flex; justify-content: space-between; align-items: center;">
            <span>${asset.name.split(':')[0]}</span>
            <span style="font-size: 9px; padding: 1px 6px; border-radius: 4px; background-color: ${thresholdStatusColor}22; color: ${thresholdStatusColor}; font-weight: 700;">
              ${isThresholdExceeded ? '⚠️ Warning' : '✓ Normal'}
            </span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; color: #64748b;">
            <span>Last Update:</span>
            <span style="font-family: monospace; font-weight: 700; color: #1e293b;">${formattedDateStr} ${formattedTimeStr}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 4px; border-top: 1px solid #f1f5f9; color: #64748b;">
            <span>Threshold:</span>
            <span style="font-weight: 700; color: ${thresholdStatusColor};">${thresholdStatusText}</span>
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-asset-icon',
        html: `
          <div style="display: flex; flex-direction: column; align-items: center; position: relative; width: 60px; height: 60px;">
            ${isSelected ? `
              <div style="position: absolute; bottom: 100%; margin-bottom: 6px; left: 50%; transform: translateX(-50%); background-color: rgba(15, 23, 42, 0.95); color: #ffffff; border-radius: 12px; padding: 10px; display: flex; flex-direction: column; gap: 6px; font-size: 10px; min-width: 170px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); z-index: 9999; backdrop-filter: blur(8px); border: 1px solid rgba(51, 65, 85, 0.8); white-space: nowrap; pointer-events: none;">
                <div style="font-weight: 800; font-size: 12px; border-bottom: 1px solid #334155; padding-bottom: 4px; display: flex; justify-content: space-between; align-items: center; gap: 8px; color: #f8fafc;">
                  <span>${asset.name.split(':')[0]}</span>
                  <span style="font-size: 9px; padding: 1px 6px; border-radius: 4px; font-family: monospace; font-weight: 700; background-color: ${thresholdStatusColor}33; color: ${thresholdStatusColor};">
                    ${isThresholdExceeded ? '⚠️ Warning' : '✓ Normal'}
                  </span>
                </div>
                <div style="display: flex; flex-direction: column; gap: 4px; color: #cbd5e1;">
                  <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                    <span style="color: #94a3b8;">Last Update:</span>
                    <span style="font-family: monospace; font-weight: 600; color: #ffffff;">${formattedDateStr} ${formattedTimeStr}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; padding-top: 4px; border-top: 1px solid rgba(30, 41, 59, 0.8);">
                    <span style="color: #94a3b8;">Threshold:</span>
                    <span style="font-weight: 700; color: ${thresholdStatusColor};">${thresholdStatusText}</span>
                  </div>
                </div>
              </div>
            ` : ''}

            <div class="border px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-md whitespace-nowrap mb-1 z-10 transition-all ${isSelected ? 'scale-110 shadow-lg' : ''}" style="background-color: ${labelBgColor}; color: ${labelTextColor}; border-color: ${labelBorderColor}; ${isSelected ? 'box-shadow: 0 0 12px ' + highlightColor + '66;' : ''}">
              ${asset.name}
            </div>
            <div style="position: relative; width: 34px; height: 34px;">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${activePinColor}" width="34" height="34" style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.15));">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="#ffffff" stroke-width="1.5"/>
              </svg>
              <div style="position: absolute; top: 6px; left: 50%; transform: translateX(-50%); color: white; display: flex; align-items: center; justify-content: center; z-index: 5;">
                ${markerIconInfo.svg}
              </div>
              <div style="position: absolute; top: -1px; right: -1px; width: 10px; height: 10px; border-radius: 50%; background-color: ${statusColor}; border: 1.5px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3); z-index: 10;">
                ${isOnline ? `<div class="absolute inset-0 rounded-full animate-ping bg-emerald-400 opacity-60"></div>` : ''}
              </div>
            </div>
          </div>
        `,
        iconSize: [60, 60],
        iconAnchor: [30, 48],
      });

      const existingMarker = markersRef.current.get(asset.id);
      if (existingMarker) {
        existingMarker.setLatLng([lat, lon]);
        existingMarker.setIcon(customIcon);
        existingMarker.setZIndexOffset(isSelected ? 1000 : 0);
        existingMarker.options.assetColor = pinColor;
      } else {
        const marker = L.marker([lat, lon], {
          icon: customIcon,
          assetColor: pinColor,
          interactive: true,
          zIndexOffset: isSelected ? 1000 : 0
        });

        marker.on('click', () => {
          map.panTo([lat, lon]);
          if (onSelectAsset) {
            onSelectAsset(asset);
          }
        });

        clusterGroup.addLayer(marker);
        markersRef.current.set(asset.id, marker);
      }
    });

    // 3. Only fit map bounds ONCE on initial load
    if (!hasInitializedBoundsRef.current && validCoords.length > 0) {
      if (validCoords.length === 1) {
        map.setView(validCoords[0], 17);
      } else {
        const bounds = L.latLngBounds(validCoords);
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [60, 60], maxZoom: 18 });
        }
      }
      hasInitializedBoundsRef.current = true;
    }
  }, [assets, mapReady, onSelectAsset, selectedAssetId, dbAssetTypes]);

  // Handle selected asset zoomToShowLayer when selectedAssetId changes
  useEffect(() => {
    const clusterGroup = clusterGroupRef.current;
    if (!clusterGroup || !selectedAssetId) return;

    const selectedMarker = markersRef.current.get(selectedAssetId);
    if (selectedMarker) {
      // Automatically zoom/uncluster if necessary so the selected asset marker is revealed
      clusterGroup.zoomToShowLayer(selectedMarker, () => {
        if (mapRef.current) {
          mapRef.current.panTo(selectedMarker.getLatLng());
        }
      });
    }
  }, [selectedAssetId]);

    const handleReset = () => {
    if (mapRef.current) {
      hasInitializedBoundsRef.current = false;
      mapRef.current.setView([centerLat, centerLon], 16);
    }
  };

  return (
    <div className="relative w-full h-full min-h-[580px] flex flex-col bg-card rounded-2xl overflow-hidden border border-border shadow-2xl">
      {/* LEAFLET MAP ELEMENT CONTAINER */}
      <div ref={mapContainerRef} className="w-full h-full min-h-[580px] block z-0 bg-secondary/15" />
      

      {/* CLUSTER GROUP INSPECTOR MODAL */}
      {clusterModalAssets && (
        <div className="absolute bottom-4 left-4 z-[1000] w-80 bg-card/95 border border-border rounded-2xl p-3 shadow-2xl backdrop-blur-md space-y-2.5 max-h-[350px] flex flex-col">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <div className="flex items-center gap-2">
              <span className="bg-amber-500 text-slate-950 text-xs font-black px-2 py-0.5 rounded-full">
                {clusterModalAssets.length}
              </span>
              <span className="text-xs font-bold text-foreground">Assets in Location</span>
            </div>
            <button
              onClick={() => setClusterModalAssets(null)}
              className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-secondary cursor-pointer transition-colors"
            >
              ✕
            </button>
          </div>

          <div className="overflow-y-auto space-y-1.5 pr-1 flex-1">
            {clusterModalAssets.map((asset) => {
              const iconInfo = getAssetMarkerIcon(asset.type, asset.name, dbAssetTypes);
              const lastSeenDate = asset.tag?.lastSeen ? new Date(asset.tag.lastSeen) : null;
              const isOnline = lastSeenDate ? Date.now() - lastSeenDate.getTime() < 300000 : false;

              return (
                <div
                  key={asset.id}
                  onClick={() => {
                    if (onSelectAsset) onSelectAsset(asset);
                  }}
                  className="flex items-center justify-between p-2 rounded-xl border border-border/50 bg-secondary/20 hover:bg-secondary/60 cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-white shadow-sm"
                      style={{ backgroundColor: iconInfo.color }}
                      dangerouslySetInnerHTML={{ __html: iconInfo.svg }}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-foreground truncate">{asset.name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono uppercase">{asset.type}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    <span className="text-[10px] font-bold text-muted-foreground">
                      {isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

            {/* TOP-LEFT TOOLBAR (overlaying map) */}
      <div className="absolute top-4 left-4 z-[1000] flex items-center gap-2">
        {/* Clean Tools Bar */}
        <div className="flex items-center gap-1.5 bg-card/95 border border-border px-2.5 py-1 rounded-xl shadow-lg backdrop-blur-md">
          {/* Switcher */}
          <button
            onClick={() => setMapStyle(mapStyle === 'google_roadmap' ? 'osm_standard' : 'google_roadmap')}
            className="p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 bg-secondary text-foreground border border-border cursor-pointer hover:bg-secondary/80"
            title="Ganti Tampilan Peta (Google Maps / OpenStreetMap)"
          >
            <Globe className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-mono">{mapStyle === 'google_roadmap' ? 'Google Roadmap' : 'Leaflet OSM'}</span>
          </button>
          
          <button
            onClick={handleReset}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all cursor-pointer"
            title="Reset View"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
