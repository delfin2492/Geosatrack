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

  const centerLat = -6.2088;
  const centerLon = 106.8456;

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    
    // Dynamically load Leaflet to avoid Next.js SSR "window is not defined" error
    const L = require('leaflet');

    const map = L.map(mapContainerRef.current, {
      center: [centerLat, centerLon],
      zoom: 16,
      zoomControl: false, // Zoom controls hidden
    });
    mapRef.current = map;

    // Set up default Google Roadmap Layer
    const defaultLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      attribution: '© Google Maps',
      maxZoom: 20,
    }).addTo(map);
    
    (map as any)._tileLayer = defaultLayer;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update Tile Layer based on Map Style Toggle
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
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
    }).addTo(map);

    (map as any)._tileLayer = newLayer;
  }, [mapStyle]);

  // Sync Markers dynamically on the map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const L = require('leaflet');

    const currentAssetIds = new Set(assets.map(a => a.id));

    // Remove deleted assets
    for (const [id, marker] of markersRef.current.entries()) {
      if (!currentAssetIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }

    // Upsert existing/new assets
    assets.forEach((asset) => {
      const lat = asset.lat ?? centerLat;
      const lon = asset.lon ?? centerLon;

      let markerColor = '#94a3b8'; // grey
      let pulseClass = '';

      if (asset.status === 'tilt_warning' || asset.status === 'fall_detected') {
        markerColor = '#ef4444'; // red
        pulseClass = 'animate-ping';
      } else if (asset.status === 'moving') {
        markerColor = '#22c55e'; // green
        pulseClass = 'animate-pulse';
      }

      // Vector Map Pin radio signal icon shape
      const customIcon = L.divIcon({
        className: 'custom-asset-icon',
        html: `
          <div style="display: flex; flex-direction: column; align-items: center; position: relative; width: 60px; height: 60px;">
            <!-- Pin label badge (using actual asset display name) -->
            <div class="bg-slate-900/95 text-white border border-slate-700 px-2 py-0.5 rounded text-[10px] font-bold shadow-md whitespace-nowrap mb-1 z-10">
              ${asset.name}
            </div>
            
            <!-- Radio Signal Icon Area -->
            <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: #0f172a; border-radius: 50%; border: 1.5px solid ${markerColor}; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);">
              <!-- Radio Icon SVG -->
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${markerColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
                <circle cx="12" cy="12" r="1" fill="${markerColor}" />
                <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
              </svg>
              
              <!-- Animasi warna menyala di tengah marker icon -->
              <div class="absolute w-2.5 h-2.5 rounded-full animate-ping" style="background-color: ${markerColor}; opacity: 0.85;"></div>
              <div class="absolute w-2 h-2 rounded-full" style="background-color: ${markerColor}; box-shadow: 0 0 8px ${markerColor};"></div>
            </div>

            <!-- Bayangan marker di bawahnya -->
            <div style="width: 18px; height: 5px; background: rgba(15, 23, 42, 0.35); border-radius: 50%; filter: blur(2px); margin-top: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>
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
  }, [assets, onSelectAsset]);

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
