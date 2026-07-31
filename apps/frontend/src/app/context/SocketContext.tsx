'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useAuth } from './AuthContext';
import { io, Socket } from 'socket.io-client';

interface Asset {
  id: string;
  name: string;
  description?: string | null;
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

interface SocketContextType {
  socket: Socket | null;
  socketStatus: 'connected' | 'disconnected' | 'connecting';
  assets: Asset[];
  alerts: Alert[];
  telemetryLogs: any[];
  setAssets: React.Dispatch<React.SetStateAction<Asset[]>>;
  setAlerts: React.Dispatch<React.SetStateAction<Alert[]>>;
  simulationActive: boolean;
  setSimulationActive: (active: boolean) => void;
  triggerLocalUpdate: (updatedAsset: Asset) => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  socketStatus: 'disconnected',
  assets: [],
  alerts: [],
  telemetryLogs: [],
  setAssets: () => {},
  setAlerts: () => {},
  simulationActive: false,
  setSimulationActive: () => {},
  triggerLocalUpdate: () => {},
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { initialized, tenantId, token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [socketStatus, setSocketStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [telemetryLogs, setTelemetryLogs] = useState<any[]>([]);
  const [simulationActive, setSimulationActive] = useState<boolean>(false);

  // Default Mock Data for initialization or fallback
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

  const fetchInitialData = async () => {
    if (!tenantId) return;
    try {
      const headers: Record<string, string> = { 'x-tenant-id': tenantId };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const assetsRes = await fetch(`http://localhost:4000/api/assets`, { headers });
      if (assetsRes.ok) {
        const assetsData = await assetsRes.json();
        if (assetsData.length > 0) setAssets(assetsData);
      } else {
        setAssets(mockAssets);
      }

      const alertsRes = await fetch(`http://localhost:4000/api/assets/alerts?unresolvedOnly=true`, { headers });
      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        setAlerts(alertsData.length > 0 ? alertsData : mockAlerts);
      } else {
        setAlerts(mockAlerts);
      }
    } catch (e) {
      setAssets(mockAssets);
      setAlerts(mockAlerts);
    }
  };

  useEffect(() => {
    if (initialized && tenantId) {
      fetchInitialData();
    }
  }, [initialized, tenantId, token]);

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
      socketIo.emit('joinTenant', { tenantId });
    });

    socketIo.on('disconnect', () => {
      setSocketStatus('disconnected');
    });

    socketIo.on('assetUpdate', (updatedAsset: Asset) => {
      setAssets((prev) => 
        prev.map((a) => (a.id === updatedAsset.id ? { ...a, ...updatedAsset } : a))
      );
    });

    socketIo.on('alertNew', (newAlert: Alert) => {
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

  // Simulator hook
  useEffect(() => {
    if (!simulationActive) return;

    const interval = setInterval(() => {
      setAssets((prev) => 
        prev.map((a) => {
          if (a.id === 'forklift-1' && a.tag) {
            return {
              ...a,
              status: 'moving',
              tag: {
                ...a.tag,
                temperature: +(24 + Math.random() * 2).toFixed(1),
                rssi: Math.floor(-55 - Math.random() * 15),
              }
            };
          }
          return a;
        })
      );

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

  const triggerLocalUpdate = (updatedAsset: Asset) => {
    setAssets((prev) => 
      prev.map((a) => (a.id === updatedAsset.id ? { ...a, ...updatedAsset } : a))
    );
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        socketStatus,
        assets,
        alerts,
        telemetryLogs,
        setAssets,
        setAlerts,
        simulationActive,
        setSimulationActive,
        triggerLocalUpdate,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};
