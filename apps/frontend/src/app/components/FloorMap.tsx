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
  const t = (type || '').toLowerCase();
  const n = (name || '').toLowerCase();
  const combined = `${t} ${n}`;

  // 1. Vehicle / Car / Mobil / Forklift / Truck / Fleet / Transport
  if (combined.includes('car') || combined.includes('vehicle') || combined.includes('mobil') || combined.includes('forklift') || combined.includes('truck') || combined.includes('truk') || combined.includes('fleet') || combined.includes('transport')) {
    return {
      color: '#0284c7', // Sky Blue
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>`
    };
  }

  // 2. Light / Lampu / Lighting
  if (combined.includes('lamp') || combined.includes('light') || combined.includes('lampu') || combined.includes('lighting')) {
    return {
      color: '#eab308', // Yellow
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>`
    };
  }

  // 3. Door / Pintu / Gate
  if (combined.includes('door') || combined.includes('pintu') || combined.includes('gate')) {
    return {
      color: '#8b5cf6', // Purple
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><path d="M18 20V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v14"/><path d="M2 20h20"/><path d="M14 12v.01"/></svg>`
    };
  }

  // 4. Building / Gedung / Office / Room / City
  if (combined.includes('building') || combined.includes('gedung') || combined.includes('office') || combined.includes('room') || combined.includes('city')) {
    return {
      color: '#6366f1', // Indigo
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>`
    };
  }

  // 5. Container / Pallet / Cargo / Kargo / Box / Package / Storage / Inventory
  if (combined.includes('container') || combined.includes('kontainer') || combined.includes('pallet') || combined.includes('cargo') || combined.includes('kargo') || combined.includes('box') || combined.includes('package') || combined.includes('paket') || combined.includes('storage')) {
    return {
      color: '#d97706', // Amber / Orange Cargo
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>`
    };
  }

  // 6. Camera / CCTV / Video
  if (combined.includes('camera') || combined.includes('cctv') || combined.includes('video')) {
    return {
      color: '#06b6d4', // Cyan
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>`
    };
  }

  // 7. Person / Employee / Worker / Staff / User / Karyawan
  if (combined.includes('person') || combined.includes('people') || combined.includes('worker') || combined.includes('staff') || combined.includes('employee') || combined.includes('user') || combined.includes('karyawan') || combined.includes('orang')) {
    return {
      color: '#ec4899', // Pink
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`
    };
  }

  // 8. Battery / Power / Charger / Energy / Plug
  if (combined.includes('battery') || combined.includes('baterai') || combined.includes('power') || combined.includes('charger') || combined.includes('plug') || combined.includes('electricity')) {
    return {
      color: '#10b981', // Emerald Green
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><rect width="16" height="10" x="2" y="7" rx="2" ry="2"/><line x1="22" x2="22" y1="11" y2="13"/><line x1="6" x2="6" y1="11" y2="13"/><line x1="10" x2="10" y1="11" y2="13"/></svg>`
    };
  }

  // 9. Thermometer / Temperature / Suhu / Weather
  if (combined.includes('temp') || combined.includes('suhu') || combined.includes('thermometer') || combined.includes('air quality') || combined.includes('weather')) {
    return {
      color: '#f43f5e', // Rose Red
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/></svg>`
    };
  }

  // 10. Anchor / Gateway / Router / Mesh / Node
  if (combined.includes('anchor') || combined.includes('gateway') || combined.includes('router') || combined.includes('mesh') || combined.includes('node')) {
    return {
      color: '#f97316', // Orange
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9c3.9 3.9 3.9 10.3 0 14.2"/></svg>`
    };
  }

  // Default: Tag / Radio / Beacon
  return {
    color: '#f97316', // Default Amber Orange
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><circle cx="12" cy="12" r="1" fill="currentColor" /><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49" /></svg>`
  };
};

export default function FloorMap({
  assets,
  onSelectAsset,
}: FloorMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const [mapStyle, setMapStyle] = useState<'google_roadmap' | 'osm_standard'>('google_roadmap');
  const [mapReady, setMapReady] = useState(false);

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

  // Sync Markers dynamically on the map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const L = require('leaflet');

    const currentAssetIds = new Set(assets.map(a => a.id));

    // Remove deleted assets
    for (const [id, marker] of markersRef.current.entries()) {
      if (!currentAssetIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }

    const validCoords: [number, number][] = [];

    // Upsert existing/new assets
    assets.forEach((asset) => {
      let lat = asset.lat ?? centerLat;
      let lon = asset.lon ?? centerLon;

      // Filter out invalid GPS coordinates outside Indonesia region
      if (isNaN(lat) || isNaN(lon) || lat < -11.5 || lat > 6.5 || lon < 94.5 || lon > 141.5) {
        lat = centerLat;
        lon = centerLon;
      }
      validCoords.push([lat, lon]);

      // Determine online/offline status based on lastSeen (threshold 5 minutes = 300,000 ms)
      const lastSeenDate = asset.tag?.lastSeen ? new Date(asset.tag.lastSeen) : null;
      const isOnline = lastSeenDate ? (Date.now() - lastSeenDate.getTime() < 300000) : false;
      const statusColor = isOnline ? '#10b981' : '#ef4444'; // green vs red

      const markerIconInfo = getAssetMarkerIcon(asset.type, asset.name);

      let pinColor = markerIconInfo.color;
      if (asset.status === 'tilt_warning' || asset.status === 'fall_detected') {
        pinColor = '#ef4444'; // red for alert/danger status
      }

      // Vector Map Pin teardrop icon shape with asset-specific icon inside & status badge dot
      const customIcon = L.divIcon({
        className: 'custom-asset-icon',
        html: `
          <div style="display: flex; flex-direction: column; align-items: center; position: relative; width: 60px; height: 60px;">
            <!-- Pin label badge (using actual asset display name with white background) -->
            <div class="bg-white text-slate-800 border border-slate-200/80 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-md whitespace-nowrap mb-1 z-10">
              ${asset.name}
            </div>

            <!-- Pin Container -->
            <div style="position: relative; width: 34px; height: 34px;">
              <!-- Classic Map Pin Teardrop SVG -->
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${pinColor}" width="34" height="34" style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.2));">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="#ffffff" stroke-width="1.5"/>
              </svg>

              <!-- Asset-specific Icon inside Pin -->
              <div style="position: absolute; top: 6px; left: 50%; transform: translateX(-50%); color: white; display: flex; align-items: center; justify-content: center; z-index: 5;">
                ${markerIconInfo.svg}
              </div>

              <!-- Status Dot (Red/Green) in the top-right corner of the Pin shoulder -->
              <div style="position: absolute; top: -1px; right: -1px; width: 10px; height: 10px; border-radius: 50%; background-color: ${statusColor}; border: 1.5px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3); z-index: 10;">
                <!-- Subtle pulsing effect if online -->
                ${isOnline ? `<div class="absolute inset-0 rounded-full animate-ping bg-emerald-400 opacity-60"></div>` : ''}
              </div>
            </div>

            <!-- Bayangan marker di bawahnya -->
            <div style="width: 18px; height: 5px; background: rgba(0,0,0,0.25); border-radius: 50%; filter: blur(2px); margin-top: 1px;"></div>
          </div>
        `,
        iconSize: [60, 60],
        iconAnchor: [30, 48],
      });

      const existingMarker = markersRef.current.get(asset.id);
      if (existingMarker) {
        existingMarker.setLatLng([lat, lon]);
        existingMarker.setIcon(customIcon);
      } else {
        const marker = L.marker([lat, lon], { icon: customIcon }).addTo(map);
        marker.on('click', () => {
          // Smooth flyTo zoom animation when clicked
          map.flyTo([lat, lon], 18, { duration: 1.2 });
          if (onSelectAsset) onSelectAsset(asset);
        });
        markersRef.current.set(asset.id, marker);
      }
    });

    // Auto fit map bounds if valid coordinates exist
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
