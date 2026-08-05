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
  const [mapStyle, setMapStyle] = useState<'google_roadmap' | 'google_satellite'>('google_roadmap');

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
      zoomControl: false,
    });
    mapRef.current = map;

    // Add default Leaflet Zoom Control
    L.control.zoom({ position: 'topleft' }).addTo(map);

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

    const url = mapStyle === 'google_satellite'
      ? 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}' // Google Satellite
      : 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'; // Google Roadmap

    const newLayer = L.tileLayer(url, {
      attribution: '© Google Maps',
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

      const customIcon = L.divIcon({
        className: 'custom-asset-icon',
        html: `
          <div style="display: flex; flex-direction: column; align-items: center; position: relative;">
            <!-- Pulsing outer ring -->
            ${(asset.status === 'moving' || asset.status === 'tilt_warning' || asset.status === 'fall_detected') ? `
              <div class="absolute -top-1 w-8 h-8 rounded-full ${pulseClass}" style="background-color: ${markerColor}44;"></div>
            ` : ''}
            
            <!-- Pin label badge -->
            <div class="bg-slate-900/95 text-white border border-slate-700 px-2 py-0.5 rounded text-[10px] font-bold shadow-md whitespace-nowrap mb-1">
              ${asset.meshLabel || asset.name}
            </div>
            
            <!-- Inner marker circle -->
            <div class="w-5 h-5 rounded-full bg-slate-950 flex items-center justify-center shadow-lg" style="border: 2px solid ${markerColor};">
              <div class="w-1.5 h-1.5 rounded-full" style="background-color: ${markerColor};"></div>
            </div>
          </div>
        `,
        iconSize: [60, 50],
        iconAnchor: [30, 45],
      });

      const existingMarker = markersRef.current.get(asset.id);
      if (existingMarker) {
        existingMarker.setLatLng([lat, lon]);
        existingMarker.setIcon(customIcon);
      } else {
        const marker = L.marker([lat, lon], { icon: customIcon }).addTo(map);
        marker.on('click', () => {
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
            onClick={() => setMapStyle(mapStyle === 'google_roadmap' ? 'google_satellite' : 'google_roadmap')}
            className="p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 bg-secondary text-foreground border border-border cursor-pointer hover:bg-secondary/80"
            title="Ganti Tampilan Google Maps (Roadmap / Satelit)"
          >
            <Globe className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-mono">{mapStyle === 'google_roadmap' ? 'Google Roadmap' : 'Google Satellite'}</span>
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
