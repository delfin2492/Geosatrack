'use client';

import React, { useRef, useEffect, useState } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Move, Save } from 'lucide-react';

interface TagData {
  id: string;
  name: string;
  temperature: number | null;
  humidity: number | null;
  battery: number | null;
  rssi: number | null;
}

interface MapAsset {
  id: string;
  name: string;
  type: string;
  status: string;
  x: number; // in meters on map
  y: number; // in meters on map
  tag: TagData | null;
}

interface MapAnchor {
  id: string;
  name: string;
  x: number; // in meters on map
  y: number; // in meters on map
}

interface FloorMapProps {
  assets: MapAsset[];
  anchors: MapAnchor[];
  onAnchorUpdate?: (id: string, x: number, y: number) => void;
  widthMeters?: number;
  heightMeters?: number;
}

export default function FloorMap({
  assets,
  anchors: initialAnchors,
  onAnchorUpdate,
  widthMeters = 60,
  heightMeters = 40,
}: FloorMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Map state
  const [anchors, setAnchors] = useState<MapAnchor[]>(initialAnchors);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [draggedAnchorId, setDraggedAnchorId] = useState<string | null>(null);
  const [hoveredAsset, setHoveredAsset] = useState<MapAsset | null>(null);
  const [hoveredAnchor, setHoveredAnchor] = useState<MapAnchor | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  
  // Drag start position
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Sync props anchors
  useEffect(() => {
    setAnchors(initialAnchors);
  }, [initialAnchors]);

  // Handle Resize
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: Math.max(entry.contentRect.height, 400),
        });
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Conversion: Meter to Canvas Pixels
  const meterToPixel = (meters: number) => {
    // base scale: 10 pixels per meter at zoom = 1
    const baseScale = Math.min(dimensions.width / widthMeters, dimensions.height / heightMeters) * 0.8;
    return meters * baseScale * zoom;
  };

  // Conversion: Canvas Pixels to Meter
  const pixelToMeter = (pixels: number) => {
    const baseScale = Math.min(dimensions.width / widthMeters, dimensions.height / heightMeters) * 0.8;
    return pixels / (baseScale * zoom);
  };

  // Convert map coords (meters) to screen coords
  const mapToScreen = (xMeters: number, yMeters: number) => {
    const baseScale = Math.min(dimensions.width / widthMeters, dimensions.height / heightMeters) * 0.8;
    const centerX = dimensions.width / 2 + pan.x;
    const centerY = dimensions.height / 2 + pan.y;
    
    const xOffset = (xMeters - widthMeters / 2) * baseScale * zoom;
    const yOffset = (yMeters - heightMeters / 2) * baseScale * zoom;

    return {
      x: centerX + xOffset,
      y: centerY + yOffset
    };
  };

  // Convert screen coords (client canvas px) to map coords (meters)
  const screenToMap = (screenX: number, screenY: number) => {
    const baseScale = Math.min(dimensions.width / widthMeters, dimensions.height / heightMeters) * 0.8;
    const centerX = dimensions.width / 2 + pan.x;
    const centerY = dimensions.height / 2 + pan.y;

    const xMeters = (screenX - centerX) / (baseScale * zoom) + widthMeters / 2;
    const yMeters = (screenY - centerY) / (baseScale * zoom) + heightMeters / 2;

    return { x: xMeters, y: yMeters };
  };

  // Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Detect theme class on <html>
    const isDark = document.documentElement.classList.contains('dark');

    // Clear canvas
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    // 1. Draw Grid Lines
    const gridSpacing = 5; // grid every 5 meters
    ctx.lineWidth = 1;
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(9, 9, 11, 0.05)';
    ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(9, 9, 11, 0.4)';
    ctx.font = '9px monospace';

    // Draw grid bounds in meters
    for (let x = 0; x <= widthMeters; x += gridSpacing) {
      const p1 = mapToScreen(x, 0);
      const p2 = mapToScreen(x, heightMeters);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      
      // Label meters on X axis
      if (p1.y > 0 && p1.y < dimensions.height) {
        ctx.fillText(`${x}m`, p1.x - 6, p1.y - 4);
      }
    }

    for (let y = 0; y <= heightMeters; y += gridSpacing) {
      const p1 = mapToScreen(0, y);
      const p2 = mapToScreen(widthMeters, y);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      
      // Label meters on Y axis
      if (p1.x > 0 && p1.x < dimensions.width) {
        ctx.fillText(`${y}m`, p1.x + 4, p1.y + 3);
      }
    }

    // 2. Draw Floor Borders
    const floorTopLeft = mapToScreen(0, 0);
    const floorWidth = meterToPixel(widthMeters);
    const floorHeight = meterToPixel(heightMeters);

    ctx.lineWidth = 2;
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(9, 9, 11, 0.3)';
    ctx.strokeRect(floorTopLeft.x, floorTopLeft.y, floorWidth, floorHeight);
    
    // Fill warehouse background area slightly
    ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.015)' : 'rgba(9, 9, 11, 0.015)';
    ctx.fillRect(floorTopLeft.x, floorTopLeft.y, floorWidth, floorHeight);

    // 3. Draw Static Anchor Nodes (Mesh routers)
    anchors.forEach((anchor) => {
      const screenPos = mapToScreen(anchor.x, anchor.y);
      const isHovered = hoveredAnchor?.id === anchor.id || draggedAnchorId === anchor.id;

      // Draw anchor outer glow pulse
      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, isHovered ? 16 : 10, 0, Math.PI * 2);
      ctx.fillStyle = isHovered 
        ? (isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(9, 9, 11, 0.15)') 
        : (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(9, 9, 11, 0.05)');
      ctx.fill();

      // Draw anchor border
      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, 6, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = isDark ? '#ffffff' : '#09090b'; 
      ctx.fillStyle = isDark ? '#09090b' : '#ffffff'; 
      ctx.fill();
      ctx.stroke();

      // Label anchor name
      ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(9, 9, 11, 0.6)';
      ctx.font = 'bold 8px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(anchor.name, screenPos.x, screenPos.y - 12);
    });

    // 4. Draw Assets
    assets.forEach((asset) => {
      const screenPos = mapToScreen(asset.x, asset.y);
      const isHovered = hoveredAsset?.id === asset.id;
      
      // Outer ping glow if moving
      if (asset.status === 'moving') {
        const pulseRadius = 15 + Math.sin(Date.now() / 150) * 4;
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, pulseRadius, 0, Math.PI * 2);
        ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(9, 9, 11, 0.08)';
        ctx.fill();
      }

      // Border indicator for alarm state
      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, isHovered ? 12 : 9, 0, Math.PI * 2);
      if (asset.status === 'tilt_warning' || asset.status === 'fall_detected') {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.2)'; // Red warning for anomaly
        ctx.strokeStyle = '#ef4444';
      } else {
        ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(9, 9, 11, 0.1)';
        ctx.strokeStyle = isDark ? '#ffffff' : '#09090b';
      }
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();

      // Draw asset inner dot
      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = isDark ? '#ffffff' : '#09090b';
      ctx.fill();

      // Draw text tags
      ctx.fillStyle = isDark ? '#ffffff' : '#09090b';
      ctx.font = 'bold 9px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(asset.name, screenPos.x, screenPos.y - 14);
    });

    // Request Animation Frame to render continuously (for movement pulses)
    let animationFrameId = requestAnimationFrame(() => {});
    if (assets.some(a => a.status === 'moving')) {
      animationFrameId = requestAnimationFrame(() => {
        // Redraw only triggers another cycle
      });
    }

    return () => cancelAnimationFrame(animationFrameId);

  }, [assets, anchors, zoom, pan, dimensions, hoveredAsset, hoveredAnchor, draggedAnchorId]);

  // Zooming helper
  const handleZoom = (factor: number) => {
    setZoom((prev) => Math.min(Math.max(prev * factor, 0.5), 5));
  };

  // Reset View helper
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Mouse Interactions
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if clicked on an anchor (drag-and-drop support)
    const clickedAnchor = anchors.find((anchor) => {
      const pos = mapToScreen(anchor.x, anchor.y);
      const dist = Math.hypot(pos.x - x, pos.y - y);
      return dist <= 15; // click sensitivity radius
    });

    if (clickedAnchor) {
      setDraggedAnchorId(clickedAnchor.id);
      dragStartRef.current = { x, y };
      return;
    }

    // Otherwise, start panning map
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

    // Handle Anchor Dragging
    if (draggedAnchorId) {
      const currentMapPos = screenToMap(x, y);
      
      // Update local state coordinates (bounded within floor dimension)
      setAnchors((prev) =>
        prev.map((anchor) =>
          anchor.id === draggedAnchorId
            ? {
                ...anchor,
                x: Math.max(0, Math.min(widthMeters, currentMapPos.x)),
                y: Math.max(0, Math.min(heightMeters, currentMapPos.y)),
              }
            : anchor
        )
      );
      return;
    }

    // Handle Panning
    if (isPanning) {
      setPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      });
      return;
    }

    // Handle Hover Checks
    const currentHoveredAsset = assets.find((asset) => {
      const pos = mapToScreen(asset.x, asset.y);
      const dist = Math.hypot(pos.x - x, pos.y - y);
      return dist <= 12;
    });
    setHoveredAsset(currentHoveredAsset || null);

    const currentHoveredAnchor = anchors.find((anchor) => {
      const pos = mapToScreen(anchor.x, anchor.y);
      const dist = Math.hypot(pos.x - x, pos.y - y);
      return dist <= 12;
    });
    setHoveredAnchor(currentHoveredAnchor || null);
  };

  const handleMouseUp = () => {
    if (draggedAnchorId && onAnchorUpdate) {
      const finishedAnchor = anchors.find((a) => a.id === draggedAnchorId);
      if (finishedAnchor) {
        // Save new anchor coordinates to database
        onAnchorUpdate(finishedAnchor.id, +finishedAnchor.x.toFixed(2), +finishedAnchor.y.toFixed(2));
      }
    }
    setDraggedAnchorId(null);
    setIsPanning(false);
  };

  return (
    <div ref={containerRef} className="relative w-full h-full flex flex-col bg-zinc-950/80 rounded-xl overflow-hidden border border-border">
      
      {/* MAP CONTROLS OVERLAY */}
      <div className="absolute bottom-4 left-4 z-20 flex gap-2">
        <button
          onClick={() => handleZoom(1.2)}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-card/90 border border-border text-foreground hover:text-primary transition-all shadow-md"
          title="Zoom In"
        >
          <ZoomIn className="h-4.5 w-4.5" />
        </button>
        <button
          onClick={() => handleZoom(0.8)}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-card/90 border border-border text-foreground hover:text-primary transition-all shadow-md"
          title="Zoom Out"
        >
          <ZoomOut className="h-4.5 w-4.5" />
        </button>
        <button
          onClick={handleReset}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-card/90 border border-border text-foreground hover:text-primary transition-all shadow-md"
          title="Reset View"
        >
          <Maximize2 className="h-4.5 w-4.5" />
        </button>
      </div>

      {/* DRAG ADVICE INDICATOR */}
      <div className="absolute top-4 left-4 z-20 bg-card/95 border border-border px-3 py-1.5 rounded-lg text-[10px] text-muted-foreground flex items-center gap-1.5 shadow-md">
        <Move className="h-3.5 w-3.5 text-primary" />
        <span>Drag & Drop **Anchor nodes** to reposition them. Drag background to pan.</span>
      </div>

      {/* HOVER TOOLTIP OVERLAY */}
      {hoveredAsset && (
        <div 
          className="absolute z-30 bg-card/95 border border-border p-3 rounded-lg shadow-xl text-xs space-y-1.5 pointer-events-none w-56"
          style={{ 
            left: `${Math.min(mousePos.x + 15, dimensions.width - 240)}px`, 
            top: `${Math.min(mousePos.y + 15, dimensions.height - 150)}px` 
          }}
        >
          <div className="flex items-center justify-between border-b pb-1.5">
            <span className="font-bold text-foreground">{hoveredAsset.name}</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
              hoveredAsset.status === 'tilt_warning' || hoveredAsset.status === 'fall_detected' 
                ? 'bg-red-500/20 text-red-400' 
                : 'bg-emerald-500/20 text-emerald-400'
            }`}>
              {hoveredAsset.status}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-[10px] text-muted-foreground">
            <div>Sensor ID:</div>
            <div className="font-mono text-foreground">{hoveredAsset.tag?.id || 'N/A'}</div>
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
        width={dimensions.width}
        height={dimensions.height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`w-full h-full block cursor-grab ${isPanning ? 'cursor-grabbing' : ''}`}
      />
    </div>
  );
}
