'use client';

import React, { useRef, useEffect, useState } from 'react';
import {
  Maximize2,
  Globe,
} from 'lucide-react';

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
  anchors: MapAnchor[];
  onAnchorUpdate?: (id: string, x: number, y: number) => void;
  onSelectAsset?: (asset: MapAsset) => void;
  widthMeters?: number;
  heightMeters?: number;
}


const getAssetMarkerIcon = (type: string = '', name: string = '') => {
  const t = (type || '').toUpperCase();
  const n = (name || '').toLowerCase();
  const combined = `${type} ${name}`.toLowerCase();

  // 1. ANCHOR -> MapPin (Rose Red)
  if (t === 'ANCHOR' || n.startsWith('anchor_') || (n.includes('anchor') && !n.includes('tag'))) {
    return {
      color: '#f43f5e', // Rose Red
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`
    };
  }

  // 2. TAG -> HardDrive (Sky Blue)
  if (t === 'TAG' || n.includes('tag') || n.includes('teltonika tag')) {
    return {
      color: '#3b82f6', // Sky Blue
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><line x1="22" x2="2" y1="12" y2="12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" x2="6.01" y1="16" y2="16"/><line x1="10" x2="10.01" y1="16" y2="16"/></svg>`
    };
  }

  // 3. MESH_EYE_SENSOR / ENVIRONMENT -> Activity Pulse (Emerald Green)
  if (t === 'MESH_EYE_SENSOR' || t === 'ENVIRONMENT' || n.startsWith('mesh_') || combined.includes('eye sensor')) {
    return {
      color: '#10b981', // Emerald Green
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`
    };
  }

  // 4. FORKLIFT / THINGS -> Boxes (Amber Cargo)
  if (t === 'FORKLIFT' || t === 'THINGS' || combined.includes('forklift') || combined.includes('pallet') || combined.includes('container') || combined.includes('cargo') || combined.includes('kargo')) {
    return {
      color: '#d97706', // Amber Cargo
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>`
    };
  }

  // 5. LIGHT / MACHINE -> Sliders (Yellow)
  if (t === 'LIGHT' || t === 'MACHINE' || combined.includes('light') || combined.includes('lampu') || combined.includes('machine')) {
    return {
      color: '#eab308', // Yellow
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="1" x2="7" y1="14" y2="14"/><line x1="9" x2="15" y1="8" y2="8"/><line x1="17" x2="23" y1="16" y2="16"/></svg>`
    };
  }

  // 6. BUILDING / DOOR / ROOM / RACK -> Folder (Purple)
  if (t === 'BUILDING' || t === 'DOOR' || t === 'ROOM' || t === 'RACK' || combined.includes('building') || combined.includes('gedung') || combined.includes('door') || combined.includes('pintu') || combined.includes('room') || combined.includes('rack')) {
    return {
      color: '#8b5cf6', // Purple
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L8.6 3.3A2 2 0 0 0 6.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>`
    };
  }

  // 7. CITY / WEATHER / SHIP -> Globe (Cyan)
  if (t === 'CITY' || t === 'WEATHER' || t === 'SHIP' || combined.includes('city') || combined.includes('weather') || combined.includes('ship')) {
    return {
      color: '#06b6d4', // Cyan
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`
    };
  }

  // 8. VEHICLE / CAR -> Car (Sky Blue)
  if (combined.includes('car') || combined.includes('vehicle') || combined.includes('mobil') || combined.includes('truk') || combined.includes('truck')) {
    return {
      color: '#0284c7', // Sky Blue
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>`
    };
  }

  // Default: HardDrive / Tag Card Icon (Indigo Blue)
  return {
    color: '#6366f1', // Indigo
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><line x1="22" x2="2" y1="12" y2="12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" x2="6.01" y1="16" y2="16"/><line x1="10" x2="10.01" y1="16" y2="16"/></svg>`
  };
};

export default function FloorMap({
  assets,
  onSelectAsset,
}: FloorMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const clusterGroupRef = useRef<any>(null);
  const [mapStyle, setMapStyle] = useState<'google_roadmap' | 'osm_standard'>('google_roadmap');
  const [mapReady, setMapReady] = useState(false);
  const [clusterModalAssets, setClusterModalAssets] = useState<MapAsset[] | null>(null);

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

    // Set up default Google Roadmap Layer
    const defaultLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      attribution: '© Google Maps',
      maxZoom: 20,
      minZoom: 5,
      bounds: indonesiaBounds,
      noWrap: true,
    }).addTo(map);
    
    (map as any)._tileLayer = defaultLayer;

    // Initialize Leaflet MarkerCluster Group with Donut Ring Icon
    require('leaflet.markercluster');
    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
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
    });

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

    const url = mapStyle === 'osm_standard'
      ? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' // OSM Standard (Leaflet default)
      : 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'; // Google Roadmap

    const newLayer = L.tileLayer(url, {
      attribution: mapStyle === 'osm_standard' ? '© OpenStreetMap contributors' : '© Google Maps',
      maxZoom: 20,
      minZoom: 5,
      bounds: indonesiaBounds,
      noWrap: true,
    }).addTo(map);

    (map as any)._tileLayer = newLayer;
  }, [mapStyle, mapReady]);

    // Sync Markers dynamically on the map using Leaflet MarkerCluster
  useEffect(() => {
    const map = mapRef.current;
    const clusterGroup = clusterGroupRef.current;
    if (!map || !mapReady || !clusterGroup) return;
    const L = require('leaflet');

    clusterGroup.clearLayers();
    markersRef.current.clear();

    const validCoords: [number, number][] = [];

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

      const markerIconInfo = getAssetMarkerIcon(asset.type, asset.name);
      let pinColor = markerIconInfo.color;
      if (asset.status === 'tilt_warning' || asset.status === 'fall_detected') {
        pinColor = '#ef4444';
      }

      const customIcon = L.divIcon({
        className: 'custom-asset-icon',
        html: `
          <div style="display: flex; flex-direction: column; align-items: center; position: relative; width: 60px; height: 60px;">
            <div class="bg-white text-slate-800 border border-slate-200/80 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-md whitespace-nowrap mb-1 z-10">
              ${asset.name}
            </div>
            <div style="position: relative; width: 34px; height: 34px;">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${pinColor}" width="34" height="34" style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.2));">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="#ffffff" stroke-width="1.5"/>
              </svg>
              <div style="position: absolute; top: 6px; left: 50%; transform: translateX(-50%); color: white; display: flex; align-items: center; justify-content: center; z-index: 5;">
                ${markerIconInfo.svg}
              </div>
              <div style="position: absolute; top: -1px; right: -1px; width: 10px; height: 10px; border-radius: 50%; background-color: ${statusColor}; border: 1.5px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3); z-index: 10;">
                ${isOnline ? `<div class="absolute inset-0 rounded-full animate-ping bg-emerald-400 opacity-60"></div>` : ''}
              </div>
            </div>
            <div style="width: 18px; height: 5px; background: rgba(0,0,0,0.25); border-radius: 50%; filter: blur(2px); margin-top: 1px;"></div>
          </div>
        `,
        iconSize: [60, 60],
        iconAnchor: [30, 48],
      });

      const marker = L.marker([lat, lon], {
        icon: customIcon,
        assetColor: pinColor,
      });

      marker.on('click', () => {
        if (onSelectAsset) onSelectAsset(asset);
      });

      clusterGroup.addLayer(marker);
      markersRef.current.set(asset.id, marker);
    });

    if (validCoords.length > 0) {
      if (validCoords.length === 1) {
        map.setView(validCoords[0], 17);
      } else {
        const bounds = L.latLngBounds(validCoords);
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [60, 60], maxZoom: 18 });
        }
      }
    } else {
      map.setView([centerLat, centerLon], 16);
    }
  }, [assets, mapReady, onSelectAsset]);

    const handleReset = () => {
    if (mapRef.current) {
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
              const iconInfo = getAssetMarkerIcon(asset.type, asset.name);
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
