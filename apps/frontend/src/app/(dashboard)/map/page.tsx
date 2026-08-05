'use client';

import React, { useState, useEffect } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
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
  const { tenantId, token } = useAuth();
  const { assets, simulationActive, setSimulationActive } = useSocket();
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [dbAnchors, setDbAnchors] = useState<any[]>([]);

  const fetchDbAnchors = async () => {
    try {
      const headers: Record<string, string> = { 'x-tenant-id': tenantId || '' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`http://localhost:4000/api/assets/anchors`, { headers });
      if (res.ok) {
        const data = await res.json();
        setDbAnchors(data);
      }
    } catch (e) {
      console.error('Failed to fetch anchors:', e);
    }
  };

  useEffect(() => {
    if (tenantId) {
      fetchDbAnchors();
    }
  }, [tenantId, assets]); // Re-fetch or sync when assets change

  const getCombinedAnchors = () => {
    const assetAnchors = assets
      .filter((a) => a.type === 'ANCHOR')
      .map((a) => {
        let anchorId = a.name;
        try {
          if (a.description && a.description.startsWith('{')) {
            const parsed = JSON.parse(a.description);
            anchorId = parsed.attributes?.find((at: any) => at.name === 'anchorId')?.value || a.name;
          }
        } catch (e) {}

        return {
          id: a.id,
          name: a.name,
          x: a.latitude !== null ? Number(a.latitude) : 10,
          y: a.longitude !== null ? Number(a.longitude) : 10,
          anchorId,
        };
      });

    const tableAnchorsOnly = dbAnchors.filter(
      (da) => !assets.some((a) => a.id === da.id) && !assetAnchors.some((aa) => aa.anchorId === da.anchorId)
    );

    return [...assetAnchors, ...tableAnchorsOnly];
  };

  const currentAnchors = getCombinedAnchors();

  const handleAnchorUpdate = async (id: string, x: number, y: number) => {
    setDbAnchors((prev) => prev.map((a) => (a.id === id ? { ...a, x, y } : a)));
    
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-tenant-id': tenantId || '',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      await fetch(`http://localhost:4000/api/assets/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          latitude: Number(x.toFixed(2)),
          longitude: Number(y.toFixed(2)),
        }),
      });
    } catch (e) {
      console.error('Failed to persist anchor coordinate update:', e);
    }
  };

  const getMapAssets = (): MapAsset[] => {
    if (simulationActive) {
      const mockNodes: MapAsset[] = [
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
          status: 'tilt_warning',
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
          status: 'moving',
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
      const time = Date.now() / 2500;
      const mesh4 = mockNodes.find((m) => m.meshLabel === 'Mesh 4');
      if (mesh4) {
        mesh4.x = 32 + Math.sin(time) * 6;
        mesh4.y = 28 + Math.cos(time) * 4;
      }
      return mockNodes;
    }

    const physicalAssets = assets.filter(
      (a) => !a.type.startsWith('AGENT_') && a.type !== 'ANCHOR' && a.type !== 'CITY' && a.type !== 'BUILDING'
    );

    return physicalAssets.map((a) => {
      let x = 30;
      let y = 20;
      if (a.latitude !== null && a.latitude !== undefined) x = Number(a.latitude);
      if (a.longitude !== null && a.longitude !== undefined) y = Number(a.longitude);

      let tagData: any = null;
      let descriptionParsed: any = {};
      
      try {
        if (a.description && a.description.startsWith('{')) {
          descriptionParsed = JSON.parse(a.description);
        }
      } catch (e) {}

      const attrs = descriptionParsed.attributes || [];
      const temp = attrs.find((at: any) => at.name === 'temperature')?.value;
      const hum = attrs.find((at: any) => at.name === 'humidity')?.value;
      const volt = attrs.find((at: any) => at.name === 'voltage')?.value;
      const rssi = attrs.find((at: any) => at.name === 'gateway_rssi' || at.name === 'rssi')?.value;

      if (descriptionParsed.attributes) {
        tagData = {
          id: a.tagId || a.id,
          name: a.name,
          temperature: temp !== undefined && temp !== '' ? Number(temp) : null,
          humidity: hum !== undefined && hum !== '' ? Number(hum) : null,
          battery: volt !== undefined && volt !== '' ? Number(volt) : null,
          rssi: rssi !== undefined && rssi !== '' ? Number(rssi) : null,
        };
      }

      let rssiList: { x: number; y: number; rssi: number }[] = [];
      attrs.forEach((attr: any) => {
        if (attr.name.startsWith('rssi_') && attr.value !== undefined && attr.value !== null && attr.value !== '') {
          const rssiVal = Number(attr.value);
          if (!isNaN(rssiVal)) {
            let anchorId = '';
            if (attr.name === 'rssi_anchor_1' || attr.name === 'rssi_anchor_2') {
              if (attr.mqttValuePath && attr.mqttValuePath.includes('rssi_')) {
                anchorId = attr.mqttValuePath.split('rssi_')[1];
              }
            } else {
              anchorId = attr.name.replace('rssi_', '');
            }

            if (anchorId) {
              const matchedAnchor = currentAnchors.find((an) => an.anchorId === anchorId);
              if (matchedAnchor) {
                rssiList.push({
                  x: matchedAnchor.x,
                  y: matchedAnchor.y,
                  rssi: rssiVal,
                });
              }
            }
          }
        }
      });

      if (rssiList.length > 0) {
        let totalWeight = 0;
        let weightedX = 0;
        let weightedY = 0;
        
        rssiList.forEach((item) => {
          const weight = Math.pow(item.rssi + 100, 2);
          weightedX += item.x * weight;
          weightedY += item.y * weight;
          totalWeight += weight;
        });
        
        if (totalWeight > 0) {
          x = weightedX / totalWeight;
          y = weightedY / totalWeight;
        }
      }

      let statusVal: 'static' | 'moving' | 'tilt_warning' | 'fall_detected' = 'static';
      const motion = attrs.find((at: any) => at.name === 'motion')?.value;
      const isStatic = attrs.find((at: any) => at.name === 'is_static')?.value;
      const hall = attrs.find((at: any) => at.name === 'hall')?.value;

      if (a.status === 'tilt_warning' || a.status === 'fall_detected') {
        statusVal = a.status;
      } else if (motion === true || motion === 'true' || hall === true || hall === 'true' || isStatic === false || isStatic === 'false') {
        statusVal = 'moving';
      }

      return {
        id: a.id,
        name: a.name,
        meshLabel: a.tagId ? `Node ${a.tagId}` : a.name,
        type: a.type,
        status: statusVal,
        x,
        y,
        tag: tagData,
      };
    });
  };

  const mapAssets = getMapAssets();
  const selectedAsset = mapAssets.find((a) => a.id === selectedAssetId) || (mapAssets.length > 0 ? mapAssets[0] : null);

  return (
    <div className="h-full w-full relative">
      
      {/* LEFT CONTENT: OPENSTREETMAP CANVAS */}
      <div className="w-full h-full relative">
        {/* Title Header Bar */}
        <div className="flex items-center justify-between p-3.5 mb-3 rounded-2xl bg-card border border-border">
          <div>
            <h2 className="text-xs font-bold flex items-center gap-2 text-foreground">
              <Globe className="h-4 w-4 text-primary" />
              OpenStreetMap Indonesia & Wirepas Mesh Visualizer
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Original OpenStreetMap Indonesia (Jakarta, Surabaya, Balikpapan/IKN, Medan) & Indoor Floor Plan layout.
            </p>
          </div>
        </div>

        {/* OpenStreetMap Canvas Area */}
        <div className="w-full h-full relative min-h-[580px]">
          <FloorMap
            assets={mapAssets}
            anchors={currentAnchors}
            onSelectAsset={(asset) => setSelectedAssetId(asset.id)}
            onAnchorUpdate={handleAnchorUpdate}
          />

          {/* Floating Telemetry Inspector Popup Card (over map) */}
          {selectedAsset && (
            <Card className="absolute top-4 right-4 z-20 w-80 flex flex-col overflow-hidden rounded-xl border border-border shadow-2xl bg-card/95 backdrop-blur-md max-h-[500px]">
              {/* Header */}
              <div className={`p-3 text-white flex items-center justify-between font-sans ${
                selectedAsset.status === 'tilt_warning' || selectedAsset.status === 'fall_detected'
                  ? 'bg-gradient-to-r from-orange-500 to-red-600'
                  : selectedAsset.status === 'moving'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600'
                  : 'bg-gradient-to-r from-slate-700 to-slate-900'
              }`}>
                <div className="flex items-center gap-1.5 min-w-0">
                  <Radio className="h-4 w-4 animate-pulse shrink-0" />
                  <div className="min-w-0">
                    <h4 className="text-[9px] font-bold tracking-wider uppercase opacity-90">{selectedAsset.type}</h4>
                    <h3 className="text-xs font-black truncate max-w-[180px]">{selectedAsset.name}</h3>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedAssetId(null)}
                  className="p-1 hover:bg-white/10 rounded transition-all text-white/80 hover:text-white"
                >
                  <span className="text-xs font-mono">✕</span>
                </button>
              </div>

              {/* Content */}
              <div className="p-4 space-y-4 overflow-y-auto max-h-[380px] text-xs">
                {/* Location name and node ID info */}
                <div className="flex justify-between items-center text-[10px] text-muted-foreground border-b border-border/60 pb-2">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-primary shrink-0" />
                    Site Jakarta (Warehouse)
                  </span>
                  <span className="font-mono bg-secondary px-1.5 py-0.5 rounded text-[9px]">
                    {selectedAsset.meshLabel}
                  </span>
                </div>

                {/* Alerts */}
                {(selectedAsset.status === 'tilt_warning' || selectedAsset.status === 'fall_detected') && (
                  <div className="p-2 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-[10px] flex gap-1.5 items-start">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Tilt Alert Active</p>
                      <p className="text-[8.5px] opacity-90 mt-0.5">Device pitch/roll exceeded safety threshold.</p>
                    </div>
                  </div>
                )}

                {/* Dynamic Attributes Grid */}
                <div className="space-y-2">
                  <div className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider">
                    Device Attributes
                  </div>

                  {(() => {
                    const originalAsset = assets.find(as => as.id === selectedAsset.id);
                    let customAttrs: any[] = [];
                    if (originalAsset && originalAsset.description) {
                      try {
                        const parsed = JSON.parse(originalAsset.description);
                        customAttrs = parsed.attributes || [];
                      } catch(e) {}
                    }

                    const itemsToRender = [
                      { label: 'CO2 Level (ppm)', value: customAttrs.find((a: any) => a.name === 'co2')?.value || '--' },
                      { label: 'CO Level (ppm)', value: customAttrs.find((a: any) => a.name === 'co')?.value || '--' },
                      { label: 'Temperature', value: selectedAsset.tag && selectedAsset.tag.temperature !== null ? `${selectedAsset.tag.temperature} °C` : '--' },
                      { label: 'Humidity', value: selectedAsset.tag && selectedAsset.tag.humidity !== null ? `${selectedAsset.tag.humidity} %` : '--' },
                      { label: 'Battery/Voltage', value: selectedAsset.tag && selectedAsset.tag.battery !== null ? `${selectedAsset.tag.battery} V` : '--' },
                      { label: 'RSSI', value: selectedAsset.tag && selectedAsset.tag.rssi !== null ? `${selectedAsset.tag.rssi} dBm` : '--' },
                      { label: 'Position (X, Y)', value: `${selectedAsset.x.toFixed(1)}m, ${selectedAsset.y.toFixed(1)}m` },
                    ];

                    customAttrs.forEach((attr: any) => {
                      const isDuplicate = ['temperature', 'humidity', 'voltage', 'battery', 'gateway_rssi', 'rssi', 'co2', 'co'].includes(attr.name);
                      if (!isDuplicate && attr.value !== undefined && attr.value !== null && attr.value !== '') {
                        let displayName = attr.name;
                        displayName = attr.name
                          .replace(/_/g, ' ')
                          .replace(/([A-Z])/g, ' $1')
                          .replace(/^./, (str: string) => str.toUpperCase());
                          
                        itemsToRender.push({
                          label: displayName,
                          value: String(attr.value) + (attr.unit ? ` ${attr.unit}` : '')
                        });
                      }
                    });

                    const filteredItems = itemsToRender.filter(item => item.value !== '--' && item.value !== '');

                    if (filteredItems.length === 0) {
                      return <p className="text-[10px] text-muted-foreground">No attributes found</p>;
                    }

                    return filteredItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center py-1 border-b border-border/30 text-[11px] last:border-0">
                        <span className="text-muted-foreground">{item.label}</span>
                        <span className="font-mono font-bold text-foreground">{item.value}</span>
                      </div>
                    ));
                  })()}
                </div>

                {/* Meta info */}
                <div className="pt-2 border-t border-border/60 flex justify-between items-center text-[9px] text-muted-foreground/80 font-mono">
                  <span>Updated: {new Date().toLocaleTimeString()}</span>
                  <a 
                    href={`/assets?id=${selectedAsset.id}`}
                    className="text-primary hover:underline font-bold text-[10px] tracking-wider transition-all uppercase"
                  >
                    VIEW
                  </a>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
