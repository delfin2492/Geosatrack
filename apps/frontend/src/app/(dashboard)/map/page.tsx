'use client';

import React, { useState } from 'react';
import { useSocket } from '../../context/SocketContext';
import FloorMap from '../../components/FloorMap';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { 
  Play, 
  MapPin, 
  Thermometer, 
  Battery, 
  Activity, 
  Info, 
  AlertTriangle 
} from 'lucide-react';

export default function MapPage() {
  const { assets, simulationActive, setSimulationActive } = useSocket();
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  
  // Set default coordinates for visualization
  const [anchors, setAnchors] = useState<any[]>([
    { id: 'anchor-1', name: 'Anchor North-East', x: 48, y: 10 },
    { id: 'anchor-2', name: 'Anchor South-West', x: 12, y: 30 },
  ]);

  const getMapAssets = () => {
    return assets.map((asset, index) => {
      const baseCoords = [
        { x: 22, y: 15 }, // Forklift
        { x: 40, y: 26 }, // Pallet
        { x: 30, y: 10 }, // Container
      ];
      const pos = { ...baseCoords[index % baseCoords.length] };
      
      if (asset.id === 'forklift-1' && simulationActive) {
        const time = Date.now() / 3000;
        pos.x = 22 + Math.sin(time) * 12;
        pos.y = 15 + Math.cos(time) * 6;
      }

      return {
        id: asset.id,
        name: asset.name,
        type: asset.type,
        status: asset.status,
        x: pos.x,
        y: pos.y,
        tag: asset.tag,
      };
    });
  };

  const selectedAsset = assets.find((a) => a.id === selectedAssetId) || assets[0];

  return (
    <div className="flex h-full w-full gap-6 relative">
      
      {/* LEFT CONTENT: THE 2D FLOOR MAP CANVAS */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        {/* Title & Simulator Control Header */}
        <Card className="mb-4">
          <div className="flex items-center justify-between p-4">
            <div>
              <h2 className="text-sm font-bold flex items-center gap-2">
                <MapPin className="h-4.5 w-4.5 text-primary" />
                Floor Plan Visualizer
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Live tracking assets in Storage Zone Alpha. Drag and drop Anchors to test.
              </p>
            </div>
            
            <Button
              onClick={() => setSimulationActive(!simulationActive)}
              variant={simulationActive ? "default" : "outline"}
              className="flex items-center gap-2"
            >
              <Play className={`h-3.5 w-3.5 ${simulationActive ? 'animate-spin' : ''}`} />
              {simulationActive ? 'Simulation Active' : 'Start Simulator'}
            </Button>
          </div>
        </Card>

        {/* FloorMap Canvas Area */}
        <div className="flex-1 min-h-[480px]">
          <FloorMap
            assets={getMapAssets()}
            anchors={anchors}
            onAnchorUpdate={(id, x, y) => {
              console.log(`Saved anchor ${id} position: ${x}m, ${y}m`);
              setAnchors((prev) => prev.map((a) => (a.id === id ? { ...a, x, y } : a)));
            }}
          />
        </div>
      </div>

      {/* RIGHT SIDE PANEL: ASSET INSPECTOR (OpenRemote Style) */}
      <Card className="w-80 flex flex-col shrink-0 overflow-hidden h-full">
        <CardHeader className="py-4">
          <CardTitle className="flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" />
            Asset Details
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col justify-between overflow-y-auto space-y-6 pt-6">
          {selectedAsset ? (
            <>
              {/* Header info */}
              <div>
                <Badge variant="success">
                  {selectedAsset.type}
                </Badge>
                <h4 className="text-base font-bold mt-3 text-foreground">{selectedAsset.name}</h4>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {selectedAsset.zone?.name || 'Storage Zone Alpha'}
                </p>
              </div>

              {/* Status alerts if any */}
              {(selectedAsset.status === 'tilt_warning' || selectedAsset.status === 'fall_detected') && (
                <div className="p-3 bg-red-950/20 border border-red-500/20 text-red-400 rounded-lg text-xs flex gap-2.5 items-start">
                  <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Anomaly Warning</p>
                    <p className="text-[10px] mt-0.5 text-muted-foreground">
                      Asset has exceeded safe operating orientation threshold.
                    </p>
                  </div>
                </div>
              )}

              {/* Attributes List */}
              <div className="space-y-4">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest border-b pb-1.5">
                  Live Attributes
                </div>

                {/* Temperature */}
                <div className="flex items-center justify-between py-1 text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Thermometer className="h-4 w-4 text-cyan-400" />
                    <span>Ambient Temperature</span>
                  </div>
                  <span className="font-bold text-cyan-400">{selectedAsset.tag?.temperature ?? '--'} °C</span>
                </div>

                {/* Battery */}
                <div className="flex items-center justify-between py-1 text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Battery className="h-4 w-4 text-emerald-400" />
                    <span>Battery Voltage</span>
                  </div>
                  <span className="font-bold text-emerald-400">{selectedAsset.tag?.battery ?? '--'} V</span>
                </div>

                {/* RSSI Signal */}
                <div className="flex items-center justify-between py-1 text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Activity className="h-4 w-4 text-amber-400" />
                    <span>Mesh RSSI Strength</span>
                  </div>
                  <span className="font-bold text-amber-400">{selectedAsset.tag?.rssi ?? '--'} dBm</span>
                </div>

                {/* Status */}
                <div className="flex items-center justify-between py-1 text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Activity className="h-4 w-4 text-purple-400" />
                    <span>Device State</span>
                  </div>
                  <span className="font-bold uppercase tracking-wide text-purple-400">{selectedAsset.status}</span>
                </div>
              </div>

              {/* Meta details */}
              <div className="pt-4 border-t border-border/60 text-[10px] text-muted-foreground font-mono space-y-1">
                <div>Asset ID: {selectedAsset.id}</div>
                <div>Sensor Node ID: {selectedAsset.tag?.id || 'None'}</div>
                <div>Last Seen: {new Date().toLocaleTimeString()}</div>
              </div>
            </>
          ) : (
            <p className="text-center text-xs text-muted-foreground py-12">
              No assets selected. Click on a device on the map.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
