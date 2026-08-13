'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useAuth } from './AuthContext';
import { io, Socket } from 'socket.io-client';
import { getApiUrl, getBackendUrl } from '../lib/api';

interface Asset {
  id: string;
  name: string;
  description?: string | null;
  type: string;
  status: string;
  tenantId: string;
  zoneId: string | null;
  parentId?: string | null;
  tagId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  latitude?: number | null;
  longitude?: number | null;
  planX?: number | null;
  planY?: number | null;
  tag: {
    id: string;
    name: string;
    temperature: number | null;
    humidity: number | null;
    battery: number | null;
    rssi: number | null;
    signals?: string | null;
    lastSeen?: string | Date | null;
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
  socketStatus: 'connected' | 'disconnected' | 'connecting' | 'error';
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
  const [socketStatus, setSocketStatus] = useState<'connected' | 'disconnected' | 'connecting' | 'error'>('disconnected');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [telemetryLogs, setTelemetryLogs] = useState<any[]>([]);
  const [simulationActive, setSimulationActive] = useState<boolean>(false);

  // Default Mock Data for initialization or fallback (Emptied per user request)
  const mockAssets: Asset[] = [];
  const mockAlerts: Alert[] = [];

  const fetchInitialData = async () => {
    if (!tenantId) return;
    try {
      const headers: Record<string, string> = { 'x-tenant-id': tenantId };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const apiUrl = getApiUrl();
      const assetsRes = await fetch(`${apiUrl}/assets`, { headers });
      if (assetsRes.ok) {
        const assetsData = await assetsRes.json();
        setAssets(assetsData);
      } else {
        setAssets([]);
      }

      const alertsRes = await fetch(`${apiUrl}/alerts?unresolvedOnly=true`, { headers });
      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        setAlerts(alertsData);
      } else {
        setAlerts([]);
      }
    } catch (e) {
      setAssets([]);
      setAlerts([]);
    }
  };

  useEffect(() => {
    if (!initialized || !tenantId) return;

    setSocketStatus('connecting');
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || getBackendUrl();
    
    const socketIo = io(wsUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      auth: token ? { token } : undefined,
      query: { tenantId }
    });

    socketIo.on('connect', () => {
      setSocketStatus('connected');
      socketIo.emit('joinTenant', { tenantId });
      fetchInitialData();
    });

    socketIo.on('disconnect', () => {
      setSocketStatus('disconnected');
    });

    socketIo.on('connect_error', (err) => {
      setSocketStatus('error');
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
      setSocket(null);
    };
  }, [initialized, tenantId, token]);

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
