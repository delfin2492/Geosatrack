'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from './context/AuthContext';
import { io, Socket } from 'socket.io-client';
import { 
  Boxes, 
  Wifi, 
  AlertTriangle, 
  MapPin, 
  LogOut, 
  User, 
  RefreshCw, 
  Shield, 
  TrendingUp, 
  Battery, 
  Thermometer, 
  Activity, 
  Play, 
  Settings,
  Bell
} from 'lucide-react';

interface Asset {
  id: string;
  name: string;
  type: string;
  status: string;
  tenantId: string;
  zoneId: string | null;
  tag: {
    id: string;
    name: string;
    temperature: number | null;
    humidity: number | null;
    battery: number | null;
    rssi: number | null;
  } | null;
  zone?: {
    name: string;
    site?: {
      name: string;
    }
  }
}

interface Alert {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  isResolved: boolean;
  asset?: {
    name: string;
  }
}

export default function Dashboard() {
  const { authenticated, username, email, tenantId, token, login, logout, initialized } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [socketStatus, setSocketStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [telemetryLogs, setTelemetryLogs] = useState<any[]>([]);
  const [simulationActive, setSimulationActive] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Default Mock Data for rich visualization
  const mockAssets: Asset[] = [
    {
      id: 'forklift-1',
      name: 'Toyota Forklift TF-01',
      type: 'FORKLIFT',
      status: 'moving',
      tenantId: 'pt-abc-logistics',
      zoneId: 'zone-alpha',
      tag: {
        id: 'node-439201',
        name: 'Sensor Tag A',
        temperature: 24.5,
        humidity: 55,
        battery: 3.12,
        rssi: -62,
      },
      zone: { name: 'Storage Zone Alpha', site: { name: 'Warehouse Cawang' } }
    },
    {
      id: 'pallet-2',
      name: 'Pallet Kargo Ekspor A4',
      type: 'PALLET',
      status: 'tilt_warning',
      tenantId: 'pt-abc-logistics',
      zoneId: 'zone-beta',
      tag: {
        id: 'node-439202',
        name: 'Sensor Tag B',
        temperature: 22.1,
        humidity: 60,
        battery: 2.72,
        rssi: -71,
      },
      zone: { name: 'Receiving Dock', site: { name: 'Warehouse Cawang' } }
    },
    {
      id: 'container-3',
      name: 'Container Box Refrigerator C1',
      type: 'CONTAINER',
      status: 'static',
      tenantId: 'pt-abc-logistics',
      zoneId: 'zone-alpha',
      tag: {
        id: 'node-439203',
        name: 'Sensor Tag C',
        temperature: 4.2,
        humidity: 85,
        battery: 3.25,
        rssi: -58,
      },
      zone: { name: 'Storage Zone Alpha', site: { name: 'Warehouse Cawang' } }
    }
  ];

  const mockAlerts: Alert[] = [
    {
      id: 'alert-1',
      type: 'tilt_warning',
      message: 'Aset "Pallet Kargo Ekspor A4" terdeteksi miring melebihi 15 derajat!',
      createdAt: new Date().toISOString(),
      isResolved: false,
      asset: { name: 'Pallet Kargo Ekspor A4' }
    },
    {
      id: 'alert-2',
      type: 'low_battery',
      message: 'Baterai sensor "node-439202" pada aset "Pallet Kargo Ekspor A4" melemah (2.72V)!',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      isResolved: false,
      asset: { name: 'Pallet Kargo Ekspor A4' }
    }
  ];

  // 1. Fetch initial data from REST API (with x-tenant-id header)
  const fetchInitialData = async () => {
    if (!tenantId) return;
    try {
      const headers: Record<string, string> = {
        'x-tenant-id': tenantId,
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Fetch assets
      const assetsRes = await fetch(`http://localhost:4000/api/assets`, { headers });
      if (assetsRes.ok) {
        const assetsData = await assetsRes.json();
        if (assetsData.length > 0) setAssets(assetsData);
      } else {
        setAssets(mockAssets);
      }

      // Fetch alerts
      const alertsRes = await fetch(`http://localhost:4000/api/assets/alerts?unresolvedOnly=true`, { headers });
      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        setAlerts(alertsData.length > 0 ? alertsData : mockAlerts);
      } else {
        setAlerts(mockAlerts);
      }
    } catch (e) {
      console.warn('Backend server offline. Utilizing mockup dashboard simulation.');
      setAssets(mockAssets);
      setAlerts(mockAlerts);
    }
  };

  useEffect(() => {
    if (initialized && tenantId) {
      fetchInitialData();
    }
  }, [initialized, tenantId, token]);

  // 2. Setup Socket.io Real-Time Connection
  useEffect(() => {
    if (!initialized || !tenantId) return;

    setSocketStatus('connecting');
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';
    
    const socketIo = io(wsUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    socketIo.on('connect', () => {
      setSocketStatus('connected');
      console.log('⚡ WebSockets connected to backend gateway');
      // Join tenant room
      socketIo.emit('joinTenant', { tenantId });
    });

    socketIo.on('disconnect', () => {
      setSocketStatus('disconnected');
    });

    socketIo.on('joined', (data) => {
      console.log(`Joined real-time room for tenant: ${data.room}`);
    });

    // Real-Time Listeners
    socketIo.on('assetUpdate', (updatedAsset: Asset) => {
      console.log('Received asset update:', updatedAsset);
      setAssets((prev) => 
        prev.map((a) => (a.id === updatedAsset.id ? { ...a, ...updatedAsset } : a))
      );
    });

    socketIo.on('alertNew', (newAlert: Alert) => {
      console.log('New alert received:', newAlert);
      setAlerts((prev) => [newAlert, ...prev.filter(a => a.id !== newAlert.id)]);
    });

    socketIo.on('telemetryNew', (rawTelemetry: any) => {
      setTelemetryLogs((prev) => [rawTelemetry, ...prev].slice(0, 15));
    });

    setSocket(socketIo);

    return () => {
      socketIo.disconnect();
    };
  }, [initialized, tenantId]);

  // 3. Local Dashboard Simulator
  useEffect(() => {
    if (!simulationActive) return;

    const interval = setInterval(() => {
      // Simulate forklift moving and vibrating
      setAssets((prev) => 
        prev.map((a) => {
          if (a.id === 'forklift-1' && a.tag) {
            const nextTemp = +(24 + Math.random() * 2).toFixed(1);
            const nextRssi = Math.floor(-55 - Math.random() * 15);
            return {
              ...a,
              status: 'moving',
              tag: {
                ...a.tag,
                temperature: nextTemp,
                rssi: nextRssi,
              }
            };
          }
          if (a.id === 'pallet-2' && a.tag) {
            // Keep tilted state
            return a;
          }
          return a;
        })
      );

      // Add dummy raw telemetry log
      const dummyLog = {
        id: `log-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        tagId: 'node-439201',
        temperature: +(24 + Math.random() * 2).toFixed(1),
        humidity: Math.floor(52 + Math.random() * 6),
        battery: 3.12,
        rssi: Math.floor(-55 - Math.random() * 15),
      };
      setTelemetryLogs((prev) => [dummyLog, ...prev].slice(0, 10));
    }, 2000);

    return () => clearInterval(interval);
  }, [simulationActive]);

  if (!initialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm font-medium tracking-wide">
            Initializing Geomesh Environment...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans">
      {/* HEADER BANNER */}
      <header className="glass-panel sticky top-0 z-40 flex h-16 items-center justify-between px-6 border-b">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 border border-primary/30">
            <Boxes className="h-6 w-6 text-primary glow-text-primary animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">
              Geomesh
            </h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
              Mesh Asset Tracking System
            </p>
          </div>
        </div>

        {/* Real-time Socket status indicator */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 rounded-full bg-secondary/50 px-3 py-1 text-xs border border-border">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                socketStatus === 'connected' ? 'bg-emerald-400' : socketStatus === 'connecting' ? 'bg-amber-400' : 'bg-red-400'
              }`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                socketStatus === 'connected' ? 'bg-emerald-500' : socketStatus === 'connecting' ? 'bg-amber-500' : 'bg-red-500'
              }`}></span>
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              WS: {socketStatus}
            </span>
          </div>

          {/* Keycloak user section */}
          {authenticated ? (
            <div className="flex items-center gap-3 border-l pl-6 border-border">
              <div className="flex flex-col text-right">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5 justify-end">
                  <User className="h-3 w-3 text-muted-foreground" />
                  {username}
                </span>
                <span className="text-[10px] text-muted-foreground tracking-wide font-mono">
                  Tenant: {tenantId}
                </span>
              </div>
              <button
                onClick={logout}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-all"
                title="Sign Out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={login}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/95 transition-all shadow-md shadow-primary/20"
            >
              <Shield className="h-4 w-4" />
              Login Portal
            </button>
          )}
        </div>
      </header>

      {/* DASHBOARD BODY */}
      <main className="flex-1 p-6 space-y-6 max-w-7xl w-full mx-auto">
        
        {/* TOP STATUS CARDS (KPIs) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="glass-panel p-4 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Assets</p>
              <h3 className="text-2xl font-bold tracking-tight mt-1">{assets.length}</h3>
              <p className="text-[10px] text-primary mt-1 font-semibold flex items-center gap-1">
                <Activity className="h-3 w-3 animate-pulse" /> Active monitoring
              </p>
            </div>
            <div className="h-12 w-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Boxes className="h-6 w-6 text-primary" />
            </div>
          </div>

          <div className="glass-panel p-4 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Online Tags</p>
              <h3 className="text-2xl font-bold tracking-tight mt-1">
                {assets.filter(a => a.tag !== null).length}
              </h3>
              <p className="text-[10px] text-emerald-400 mt-1 font-semibold">
                Wirepas mesh status OK
              </p>
            </div>
            <div className="h-12 w-12 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Wifi className="h-6 w-6 text-emerald-400" />
            </div>
          </div>

          <div className="glass-panel p-4 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Alerts</p>
              <h3 className="text-2xl font-bold tracking-tight mt-1 text-red-500 glow-text-destructive">
                {alerts.filter(a => !a.isResolved).length}
              </h3>
              <p className="text-[10px] text-red-400 mt-1 font-semibold">
                Requires operator attention
              </p>
            </div>
            <div className="h-12 w-12 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-red-400 animate-bounce" />
            </div>
          </div>

          <div className="glass-panel p-4 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Simulator</p>
              <button
                onClick={() => setSimulationActive(!simulationActive)}
                className={`mt-1.5 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  simulationActive 
                    ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20' 
                    : 'bg-secondary text-foreground hover:bg-secondary/80 border border-border'
                }`}
              >
                <Play className={`h-3 w-3 ${simulationActive ? 'animate-spin' : ''}`} />
                {simulationActive ? 'Simulation ON' : 'Start Simulation'}
              </button>
            </div>
            <div className="h-12 w-12 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-amber-400" />
            </div>
          </div>
        </div>

        {/* MAP & DETAIL LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT: 2D FLOOR MAP CANVAS MOCKUP (Col span 2) */}
          <div className="lg:col-span-2 glass-panel rounded-xl overflow-hidden flex flex-col border">
            <div className="border-b px-4 py-3 flex items-center justify-between bg-card/50">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold tracking-wide">Floor Plan Visualizer (Storage Zone Alpha)</h3>
              </div>
              <div className="flex gap-2">
                <span className="text-[10px] bg-secondary px-2.5 py-1 rounded border border-border font-bold">Lantai 1</span>
                <span className="text-[10px] bg-secondary px-2.5 py-1 rounded border border-border font-bold text-muted-foreground">Lantai 2</span>
              </div>
            </div>

            {/* Map Canvas Background Container */}
            <div 
              ref={mapContainerRef}
              className="relative h-[360px] bg-zinc-950 flex items-center justify-center overflow-hidden"
              style={{
                backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 0)',
                backgroundSize: '24px 24px'
              }}
            >
              {/* Floor layout outlines */}
              <div className="absolute inset-10 border border-dashed border-border/40 rounded-lg flex items-center justify-center bg-card/10">
                <span className="text-xs text-muted-foreground/30 font-semibold tracking-wider uppercase">Storage Racks Area</span>
              </div>

              {/* Dynamic tag visualization */}
              {assets.map((asset, index) => {
                // Fixed coordinates for demonstration
                const coords = [
                  { x: '35%', y: '40%' }, // Forklift
                  { x: '65%', y: '65%' }, // Pallet
                  { x: '50%', y: '25%' }  // Container
                ];
                const pos = coords[index % coords.length];

                return (
                  <div
                    key={asset.id}
                    onClick={() => setSelectedAsset(asset)}
                    className="absolute cursor-pointer transform -translate-x-1/2 -translate-y-1/2 group z-10"
                    style={{ left: pos.x, top: pos.y }}
                  >
                    {/* Ring Pulse for activity */}
                    {asset.status === 'moving' && (
                      <div className="absolute -inset-2 bg-primary/20 rounded-full animate-signal-ring pointer-events-none" />
                    )}

                    {/* Tag Signal Dot */}
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center border-2 transition-all ${
                      asset.status === 'tilt_warning' || asset.status === 'fall_detected'
                        ? 'bg-red-500/80 border-red-300 animate-pulse'
                        : 'bg-primary/80 border-primary-foreground'
                    }`}>
                      <Boxes className="h-3 w-3 text-white" />
                    </div>

                    {/* Text Label on Hover */}
                    <div className="absolute top-7 left-1/2 transform -translate-x-1/2 bg-card border border-border px-2 py-0.5 rounded text-[9px] font-bold text-foreground opacity-90 group-hover:opacity-100 whitespace-nowrap shadow-lg">
                      {asset.name}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="border-t px-4 py-2.5 bg-card/30 flex items-center justify-between text-xs text-muted-foreground">
              <p>💡 Tip: Click on any dot to inspect asset telemetries.</p>
              <p>Coord: EPSG:3857 (Warehouse System)</p>
            </div>
          </div>

          {/* RIGHT: SELECTED ASSET TELEMETRY & ALERTS */}
          <div className="space-y-6">
            
            {/* INSPECTOR CARD */}
            <div className="glass-panel rounded-xl overflow-hidden flex flex-col border">
              <div className="border-b px-4 py-3 flex items-center gap-2 bg-card/50">
                <Settings className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold tracking-wide">Asset Inspector</h3>
              </div>

              <div className="p-4 flex-1 space-y-4">
                {selectedAsset || assets[0] ? (
                  <>
                    {/* Title */}
                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-primary px-2 py-0.5 bg-primary/10 rounded">
                        {(selectedAsset || assets[0]).type}
                      </span>
                      <h4 className="text-base font-bold mt-1">{(selectedAsset || assets[0]).name}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {(selectedAsset || assets[0]).zone?.name || 'Not localized'}
                      </p>
                    </div>

                    {/* Telemetry specs grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-secondary/40 p-2.5 rounded-lg border border-border/50">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Thermometer className="h-3.5 w-3.5 text-cyan-400" />
                          <span>Temperature</span>
                        </div>
                        <p className="text-sm font-bold mt-1 text-cyan-400">
                          {(selectedAsset || assets[0]).tag?.temperature ?? '--'} °C
                        </p>
                      </div>

                      <div className="bg-secondary/40 p-2.5 rounded-lg border border-border/50">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Battery className="h-3.5 w-3.5 text-emerald-400" />
                          <span>Battery status</span>
                        </div>
                        <p className="text-sm font-bold mt-1 text-emerald-400">
                          {(selectedAsset || assets[0]).tag?.battery ?? '--'} V
                        </p>
                      </div>

                      <div className="bg-secondary/40 p-2.5 rounded-lg border border-border/50">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Activity className="h-3.5 w-3.5 text-amber-400" />
                          <span>RSSI Signal</span>
                        </div>
                        <p className="text-sm font-bold mt-1 text-amber-400">
                          {(selectedAsset || assets[0]).tag?.rssi ?? '--'} dBm
                        </p>
                      </div>

                      <div className="bg-secondary/40 p-2.5 rounded-lg border border-border/50">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Settings className="h-3.5 w-3.5 text-purple-400" />
                          <span>Asset Status</span>
                        </div>
                        <p className="text-sm font-bold mt-1 uppercase tracking-wider text-purple-400">
                          {(selectedAsset || assets[0]).status}
                        </p>
                      </div>
                    </div>

                    <div className="text-[10px] text-muted-foreground/80 font-semibold font-mono bg-black/40 p-2 rounded">
                      Linked tag: {(selectedAsset || assets[0]).tag?.id || 'None'}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-6">No assets registered yet.</p>
                )}
              </div>
            </div>

            {/* ALERTS MODULE */}
            <div className="glass-panel rounded-xl overflow-hidden flex flex-col border">
              <div className="border-b px-4 py-3 flex items-center justify-between bg-card/50">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-red-500" />
                  <h3 className="text-sm font-bold tracking-wide">Live Alarms</h3>
                </div>
                <span className="text-[9px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded border border-red-500/30 font-bold">
                  {alerts.length} Warnings
                </span>
              </div>

              <div className="p-4 space-y-3 max-h-[220px] overflow-y-auto">
                {alerts.map((alert) => (
                  <div key={alert.id} className="p-3 bg-red-950/20 border border-red-500/20 rounded-lg flex gap-3 text-xs">
                    <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-red-300">{alert.asset?.name || 'Asset anomaly'}</p>
                      <p className="text-muted-foreground text-[11px] mt-0.5">{alert.message}</p>
                      <span className="text-[9px] text-muted-foreground/60 font-mono mt-1 block">
                        {new Date(alert.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* BOTTOM: TELEMETRY STREAM LOGS */}
        <div className="glass-panel rounded-xl overflow-hidden border">
          <div className="border-b px-4 py-3 bg-card/50 flex items-center justify-between">
            <h3 className="text-sm font-bold tracking-wide">TimescaleDB Telemetry Logger Stream</h3>
            <span className="text-[10px] text-muted-foreground font-mono">Dynamic update frequency: 2s</span>
          </div>
          <div className="p-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-border text-muted-foreground font-semibold">
                    <th className="pb-2">Timestamp</th>
                    <th className="pb-2">Tag ID</th>
                    <th className="pb-2">Temp</th>
                    <th className="pb-2">Humidity</th>
                    <th className="pb-2">Battery</th>
                    <th className="pb-2">RSSI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {telemetryLogs.length > 0 ? (
                    telemetryLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-secondary/20">
                        <td className="py-2 text-muted-foreground">{log.timestamp}</td>
                        <td className="py-2 text-primary font-bold">{log.tagId}</td>
                        <td className="py-2">{log.temperature} °C</td>
                        <td className="py-2">{log.humidity} %</td>
                        <td className="py-2 text-emerald-400">{log.battery} V</td>
                        <td className="py-2 text-amber-400">{log.rssi} dBm</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-muted-foreground">
                        Waiting for sensor telemetry flow... (Start Simulator to stream data)
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </main>

      {/* FOOTER */}
      <footer className="border-t border-border mt-12 py-6 text-center text-xs text-muted-foreground bg-card/10">
        <p>© 2026 Geomesh Systems. Built on Wirepas Mesh and Next.js 15 Monorepo.</p>
      </footer>
    </div>
  );
}
