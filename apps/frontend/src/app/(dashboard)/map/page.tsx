'use client';

import React, { useState } from 'react';
import { useSocket } from '../../context/SocketContext';
import FloorMap, { MapAsset } from '../../components/FloorMap';
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
  Globe
} from 'lucide-react';

export default function MapPage() {
  const { simulationActive, setSimulationActive } = useSocket();
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  const [anchors, setAnchors] = useState<any[]>([
    { id: 'anchor-1', name: 'Anchor North-East', x: 48, y: 10 },
    { id: 'anchor-2', name: 'Anchor South-West', x: 12, y: 30 },
  ]);

  const getMapAssets = (): MapAsset[] => {
    const meshNodes: MapAsset[] = [
      {
        id: 'node-mesh-1',
        name: 'Sensor Node Alpha',
        meshLabel: 'Mesh 1',
        type: 'Static Tag',
        status: 'static',
        x: 34,
        y: 8,
        tag: {
          id: 'tag-439201',
          name: 'Teltonika Tag #1',
          temperature: 23.4,
          humidity: 52.0,
          battery: 3.6,
          rssi: -62,
        },
      },
      {
        id: 'node-mesh-3',
        name: 'Pallet Kargo A4',
        meshLabel: 'Mesh 3',
        type: 'Pallet',
        status: 'tilt_warning', // Anomaly warning (Red ring)
        x: 42,
        y: 10,
        tag: {
          id: 'tag-439202',
          name: 'Teltonika Tag #3',
          temperature: 28.1,
          humidity: 61.5,
          battery: 3.2,
          rssi: -84,
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
        tag: {
          id: 'tag-439205',
          name: 'Teltonika Tag #5',
          temperature: 24.0,
          humidity: 55.0,
          battery: 3.5,
          rssi: -68,
        },
      },
      {
        id: 'node-mesh-4',
        name: 'Forklift TF-01',
        meshLabel: 'Mesh 4',
        type: 'Vehicle',
        status: 'moving', // Moving active (Green ring)
        x: 32,
        y: 28,
        tag: {
          id: 'tag-439204',
          name: 'Teltonika Tag #4',
          temperature: 25.8,
          humidity: 48.0,
          battery: 3.6,
          rssi: -58,
        },
      },
    ];

    if (simulationActive) {
      const time = Date.now() / 2500;
      const mesh4 = meshNodes.find((m) => m.meshLabel === 'Mesh 4');
      if (mesh4) {
        mesh4.x = 32 + Math.sin(time) * 6;
        mesh4.y = 28 + Math.cos(time) * 4;
      }
    }

    return meshNodes;
  };

  const mapAssets = getMapAssets();
  const selectedAsset = mapAssets.find((a) => a.id === selectedAssetId) || mapAssets[1];

  return (
    <div className="flex h-full w-full gap-4 relative">
      
      {/* LEFT CONTENT: OPENSTREETMAP CANVAS */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        {/* Title Header Bar */}
        <div className="flex items-center justify-between p-3.5 mb-3 rounded-2xl bg-card border border-border">
          <div>
            <h2 className="text-xs font-bold flex items-center gap-2 text-foreground">
              <Globe className="h-4 w-4 text-primary" />
              OpenStreetMap Indonesia & Wirepas Mesh Visualizer
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Peta Asli OpenStreetMap Indonesia (Jakarta, Surabaya, Balikpapan/IKN, Medan) & Denah Floor Plan.
            </p>
          </div>
          
          <Button
            onClick={() => setSimulationActive(!simulationActive)}
            variant={simulationActive ? "default" : "outline"}
            className="flex items-center gap-1.5 text-xs py-1.5 px-3 h-8"
          >
            <Play className={`h-3 w-3 ${simulationActive ? 'animate-spin' : ''}`} />
            {simulationActive ? 'Simulasi Active' : 'Start Simulator'}
          </Button>
        </div>

        {/* OpenStreetMap Canvas Area */}
        <div className="flex-1 min-h-[580px]">
          <FloorMap
            assets={mapAssets}
            anchors={anchors}
            onSelectAsset={(asset) => setSelectedAssetId(asset.id)}
            onAnchorUpdate={(id, x, y) => {
              setAnchors((prev) => prev.map((a) => (a.id === id ? { ...a, x, y } : a)));
            }}
          />
        </div>
      </div>

      {/* RIGHT SIDE PANEL: COMPACT TELEMETRY INSPECTOR (w-64) */}
      <Card className="w-64 flex flex-col shrink-0 overflow-hidden h-full rounded-2xl border border-border shadow-xl">
        <CardHeader className="py-3 px-4 border-b border-border bg-card/60">
          <CardTitle className="flex items-center gap-1.5 text-xs">
            <Radio className="h-3.5 w-3.5 text-primary" />
            Telemetry Inspector
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col justify-between overflow-y-auto space-y-4 p-4 text-xs">
          {selectedAsset ? (
            <>
              {/* Header info */}
              <div className="space-y-1.5 border-b border-border pb-3">
                <div className="flex items-center justify-between">
                  <Badge variant={selectedAsset.status === 'tilt_warning' ? 'destructive' : 'default'} className="text-[10px] px-2 py-0.5">
                    {selectedAsset.meshLabel}
                  </Badge>
                  <span className="text-[10px] font-mono text-muted-foreground">{selectedAsset.type}</span>
                </div>
                <h4 className="text-xs font-bold text-foreground truncate">{selectedAsset.name}</h4>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-primary shrink-0" />
                  Site Jakarta (Warehouse Cawang)
                </p>
              </div>

              {/* Status alerts */}
              {(selectedAsset.status === 'tilt_warning' || selectedAsset.status === 'fall_detected') && (
                <div className="p-2.5 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-[11px] flex gap-2 items-start">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Tilt Alert</p>
                    <p className="text-[9px] opacity-90 mt-0.5">Pitch/roll exceeded threshold.</p>
                  </div>
                </div>
              )}

              {/* Compact Attributes List */}
              <div className="space-y-2.5">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Live Measurements
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Thermometer className="h-3.5 w-3.5 text-cyan-400" />
                    Temp
                  </span>
                  <span className="font-bold font-mono text-foreground">{selectedAsset.tag?.temperature ?? '--'} °C</span>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Battery className="h-3.5 w-3.5 text-emerald-400" />
                    Battery
                  </span>
                  <span className="font-bold font-mono text-emerald-400">{selectedAsset.tag?.battery ?? '--'} V</span>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Activity className="h-3.5 w-3.5 text-amber-400" />
                    RSSI
                  </span>
                  <span className="font-bold font-mono text-amber-400">{selectedAsset.tag?.rssi ?? '--'} dBm</span>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    Pos (X,Y)
                  </span>
                  <span className="font-bold font-mono text-foreground">{selectedAsset.x.toFixed(1)}m, {selectedAsset.y.toFixed(1)}m</span>
                </div>
              </div>

              {/* Compact Meta details */}
              <div className="pt-3 border-t border-border text-[9px] text-muted-foreground font-mono space-y-1">
                <div>Node: {selectedAsset.meshLabel}</div>
                <div>Tag: {selectedAsset.tag?.id || 'N/A'}</div>
                <div>Map Engine: OpenStreetMap</div>
                <div>Region: Indonesia (ID)</div>
                <div>Updated: {new Date().toLocaleTimeString()}</div>
              </div>
            </>
          ) : (
            <p className="text-center text-xs text-muted-foreground py-8">
              Pilih Mesh Node pada peta.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
