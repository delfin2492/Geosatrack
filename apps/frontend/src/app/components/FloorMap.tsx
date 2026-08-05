'use client';

import React, { useRef, useEffect, useState } from 'react';
import {
  ZoomIn,
  ZoomOut,
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

const tileImageCache = new Map<string, HTMLImageElement>();

export default function FloorMap({
  assets,
  anchors: initialAnchors,
  onAnchorUpdate,
  onSelectAsset,
  widthMeters = 60,
  heightMeters = 40,
}: FloorMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [mapStyle, setMapStyle] = useState<'osm_standard' | 'osm_dark'>('osm_standard');
  const [zoom, setZoom] = useState<number>(1.2);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [hoveredAsset, setHoveredAsset] = useState<MapAsset | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [tileLoadedCount, setTileLoadedCount] = useState<number>(0);

  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Canvas Resize Observer
  const [dimensions, setDimensions] = useState({ width: 950, height: 600 });
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: Math.max(entry.contentRect.height, 580),
        });
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Non-passive Wheel Listener for Mouse & Trackpad Scroll Zoom (Cursor-Centered Focus)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      setZoom((prevZoom) => {
        const newZoom = Math.min(Math.max(prevZoom * zoomFactor, 0.4), 5);
        const ratio = newZoom / prevZoom;
        
        setPan((prevPan) => {
          const dx = mouseX - dimensions.width / 2;
          const dy = mouseY - dimensions.height / 2;
          return {
            x: prevPan.x * ratio + dx * (1 - ratio),
            y: prevPan.y * ratio + dy * (1 - ratio),
          };
        });
        
        return newZoom;
      });
    };

    canvas.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleNativeWheel);
  }, [dimensions]);

  const centerLat = -6.2088;
  const centerLon = 106.8456;

  const lonToTileFraction = (lon: number, z: number) => ((lon + 180) / 360) * Math.pow(2, z);
  const latToTileFraction = (lat: number, z: number) =>
    ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
      Math.pow(2, z);

  const latLonToScreen = (lat: number, lon: number) => {
    const zoomLevel = 16;
    const centerTileXFraction = lonToTileFraction(centerLon, zoomLevel);
    const centerTileYFraction = latToTileFraction(centerLat, zoomLevel);

    const targetTileXFraction = lonToTileFraction(lon, zoomLevel);
    const targetTileYFraction = latToTileFraction(lat, zoomLevel);

    const tileSize = 256 * zoom;
    const centerX = dimensions.width / 2 + pan.x;
    const centerY = dimensions.height / 2 + pan.y;

    const x = centerX + (targetTileXFraction - centerTileXFraction) * tileSize;
    const y = centerY + (targetTileYFraction - centerTileYFraction) * tileSize;

    return { x, y };
  };

  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  // Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    // 1. OpenStreetMap Tile Renderer
    const zoomLevel = 16;

    const centerTileX = lon2tile(centerLon, zoomLevel);
    const centerTileY = lat2tile(centerLat, zoomLevel);

    const tileSize = 256 * zoom;
    const centerX = dimensions.width / 2 + pan.x;
    const centerY = dimensions.height / 2 + pan.y;

    const startDx = -Math.ceil(centerX / tileSize) - 1;
    const endDx = Math.ceil((dimensions.width - centerX) / tileSize) + 1;
    const startDy = -Math.ceil(centerY / tileSize) - 1;
    const endDy = Math.ceil((dimensions.height - centerY) / tileSize) + 1;

    function lon2tile(lon: number, z: number) {
      return Math.floor(((lon + 180) / 360) * Math.pow(2, z));
    }
    function lat2tile(lat: number, z: number) {
      return Math.floor(
        ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
          Math.pow(2, z)
      );
    }

    for (let dx = startDx; dx <= endDx; dx++) {
      for (let dy = startDy; dy <= endDy; dy++) {
        const tx = centerTileX + dx;
        const ty = centerTileY + dy;
        const tileKey = `osm_${mapStyle}_${zoomLevel}_${tx}_${ty}`;

        const screenTileX = centerX + dx * tileSize - tileSize / 2;
        const screenTileY = centerY + dy * tileSize - tileSize / 2;

        if (!tileImageCache.has(tileKey)) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          const sub = ['a', 'b', 'c'][Math.abs(tx + ty) % 3];

          if (mapStyle === 'osm_dark') {
            img.src = `https://${sub}.basemaps.cartocdn.com/dark_all/${zoomLevel}/${tx}/${ty}.png`;
          } else {
            img.src = `https://tile.openstreetmap.org/${zoomLevel}/${tx}/${ty}.png`;
          }

          img.onload = () => {
            tileImageCache.set(tileKey, img);
            setTileLoadedCount((prev) => prev + 1);
          };
        } else {
          const cachedImg = tileImageCache.get(tileKey);
          if (cachedImg && cachedImg.complete) {
            ctx.drawImage(cachedImg, screenTileX, screenTileY, tileSize, tileSize);
          }
        }
      }
    }

    // 2. Draw Mesh Nodes & Assets (Geographical Placement based on Database lat/lon)
    assets.forEach((asset) => {
      const lat = asset.lat ?? (centerLat + (asset.y - 20) * 0.00001);
      const lon = asset.lon ?? (centerLon + (asset.x - 30) * 0.00001);
      const screenPos = latLonToScreen(lat, lon);
      const isHovered = hoveredAsset?.id === asset.id;
      const isSelected = selectedAssetId === asset.id;

      let ringColor = '#94a3b8';
      let bgPulseColor = 'rgba(148, 163, 184, 0.2)';
      let isAlert = false;
      let isMoving = false;

      if (asset.status === 'tilt_warning' || asset.status === 'fall_detected') {
        ringColor = '#ef4444';
        bgPulseColor = 'rgba(239, 68, 68, 0.35)';
        isAlert = true;
      } else if (asset.status === 'moving') {
        ringColor = '#22c55e';
        bgPulseColor = 'rgba(34, 197, 94, 0.35)';
        isMoving = true;
      }

      if (isAlert || isMoving) {
        const pulseRadius = (isHovered || isSelected ? 18 : 14) + Math.sin(Date.now() / 180) * 3;
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, pulseRadius, 0, Math.PI * 2);
        ctx.fillStyle = bgPulseColor;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, isHovered || isSelected ? 12 : 9, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = ringColor;
      ctx.fillStyle = '#0f172a';
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = ringColor;
      const sqSize = 5;
      ctx.fillRect(screenPos.x - sqSize / 2, screenPos.y - sqSize / 2, sqSize, sqSize);

      const labelText = asset.meshLabel || asset.name;
      ctx.font = 'bold 11px system-ui';
      const textWidth = ctx.measureText(labelText).width;
      const badgeW = textWidth + 14;
      const badgeH = 20;
      const badgeX = screenPos.x - badgeW / 2;
      const badgeY = screenPos.y - 34;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.strokeStyle = isSelected ? '#38bdf8' : '#334155';
      ctx.lineWidth = isSelected ? 2 : 1;

      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(screenPos.x - 4, badgeY + badgeH);
      ctx.lineTo(screenPos.x + 4, badgeY + badgeH);
      ctx.lineTo(screenPos.x, badgeY + badgeH + 4);
      ctx.closePath();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(labelText, screenPos.x, badgeY + 14);
    });

    ctx.restore();
  }, [assets, zoom, pan, mapStyle, hoveredAsset, selectedAssetId, dimensions, tileLoadedCount, dpr]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if clicked an asset
    const clickedAsset = assets.find((asset) => {
      const lat = asset.lat ?? (centerLat + (asset.y - 20) * 0.00001);
      const lon = asset.lon ?? (centerLon + (asset.x - 30) * 0.00001);
      const pos = latLonToScreen(lat, lon);
      return Math.hypot(pos.x - x, pos.y - y) <= 18;
    });

    if (clickedAsset) {
      setSelectedAssetId(clickedAsset.id);
      if (onSelectAsset) onSelectAsset(clickedAsset);
      return;
    }

    setIsPanning(true);
    panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });

    if (isPanning) {
      setPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      });
      return;
    }

    const hovered = assets.find((asset) => {
      const lat = asset.lat ?? (centerLat + (asset.y - 20) * 0.00001);
      const lon = asset.lon ?? (centerLon + (asset.x - 30) * 0.00001);
      const pos = latLonToScreen(lat, lon);
      return Math.hypot(pos.x - x, pos.y - y) <= 18;
    });
    setHoveredAsset(hovered || null);
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleZoom = (factor: number) => {
    setZoom((prev) => Math.min(Math.max(prev * factor, 0.4), 5));
  };

  const handleReset = () => {
    setZoom(1.2);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[580px] flex flex-col bg-card rounded-2xl overflow-hidden border border-border shadow-2xl">
      
      {/* TOP-LEFT TOOLBAR */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
        {/* Zoom Controls (+ / -) */}
        <div className="flex flex-col bg-card/95 border border-border rounded-xl shadow-lg overflow-hidden backdrop-blur-md">
          <button
            onClick={() => handleZoom(1.2)}
            className="p-2 hover:bg-secondary text-foreground hover:text-primary transition-all border-b border-border cursor-pointer"
            title="Zoom In (+)"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleZoom(0.8)}
            className="p-2 hover:bg-secondary text-foreground hover:text-primary transition-all cursor-pointer"
            title="Zoom Out (-)"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
        </div>

        {/* Clean Tools Bar */}
        <div className="flex items-center gap-1.5 bg-card/95 border border-border px-2.5 py-1 rounded-xl shadow-lg backdrop-blur-md">
          {/* OSM Style Switcher */}
          <button
            onClick={() => setMapStyle(mapStyle === 'osm_standard' ? 'osm_dark' : 'osm_standard')}
            className="p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 bg-secondary text-foreground border border-border cursor-pointer hover:bg-secondary/80"
            title="Ganti Tampilan OpenStreetMap (Standar / Dark)"
          >
            <Globe className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-mono">{mapStyle === 'osm_standard' ? 'OSM Standard' : 'OSM Dark'}</span>
          </button>

          <button
            onClick={handleReset}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all cursor-pointer"
            title="Fit Bounds / Center View"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* BOTTOM-LEFT SCALE BAR */}
      <div className="absolute bottom-4 left-4 z-20 bg-card/95 border border-border px-3 py-1.5 rounded-lg shadow-md text-xs font-mono text-muted-foreground flex items-center gap-2 backdrop-blur-md">
        <div className="w-12 h-1.5 bg-foreground/40 border-x border-foreground/60" />
        <span>{Math.round(10 / zoom)} m</span>
      </div>

      {/* BOTTOM-RIGHT OPENSTREETMAP ATTRIBUTION */}
      <div className="absolute bottom-3 right-4 z-20 text-[10px] font-mono text-muted-foreground/90 bg-card/90 border border-border px-2.5 py-1 rounded-md backdrop-blur-md pointer-events-none flex items-center gap-1.5">
        <span>© OpenStreetMap contributors</span>
      </div>

      {/* HOVER TOOLTIP */}
      {hoveredAsset && (
        <div
          className="absolute z-30 bg-card/95 border border-border p-3 rounded-xl shadow-2xl text-xs space-y-1.5 pointer-events-none w-56 backdrop-blur-md"
          style={{
            left: `${Math.min(mousePos.x + 15, dimensions.width - 240)}px`,
            top: `${Math.min(mousePos.y + 15, dimensions.height - 150)}px`,
          }}
        >
          <div className="flex items-center justify-between border-b border-border pb-1.5">
            <span className="font-bold text-foreground">{hoveredAsset.meshLabel} ({hoveredAsset.name})</span>
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                hoveredAsset.status === 'tilt_warning' || hoveredAsset.status === 'fall_detected'
                  ? 'bg-destructive/10 text-destructive'
                  : hoveredAsset.status === 'moving'
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-secondary text-muted-foreground'
              }`}
            >
              {hoveredAsset.status}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-[10px] text-muted-foreground font-mono">
            <div>Sensor ID:</div>
            <div className="text-foreground">{hoveredAsset.tag?.id || 'N/A'}</div>
            <div>Temp:</div>
            <div className="text-foreground">{hoveredAsset.tag?.temperature ?? '--'} °C</div>
            <div>Battery:</div>
            <div className="text-foreground">{hoveredAsset.tag?.battery ?? '--'} V</div>
            <div>RSSI:</div>
            <div className="text-foreground">{hoveredAsset.tag?.rssi ?? '--'} dBm</div>
          </div>
        </div>
      )}

      {/* CANVAS VIEWPORT */}
      <canvas
        ref={canvasRef}
        width={dimensions.width * dpr}
        height={dimensions.height * dpr}
        style={{
          width: `${dimensions.width}px`,
          height: `${dimensions.height}px`,
          display: 'block'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`w-full h-full block cursor-grab ${isPanning ? 'cursor-grabbing' : ''}`}
      />
    </div>
  );
}
