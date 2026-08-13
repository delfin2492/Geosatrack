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

      let pinColor = '#f97316'; // default orange amber (like user screenshot)
      if (asset.status === 'tilt_warning' || asset.status === 'fall_detected') {
        pinColor = '#ef4444'; // red for alert/danger status
      }

      // Vector Map Pin teardrop icon shape with radio signal inside & status badge dot
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

              <!-- White Radio Icon inside Pin -->
              <div style="position: absolute; top: 6px; left: 50%; transform: translateX(-50%); color: white; display: flex; align-items: center; justify-content: center; z-index: 5;">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
                  <circle cx="12" cy="12" r="1" fill="currentColor" />
                  <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49" />
                </svg>
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
