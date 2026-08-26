'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { getApiUrl, getBackendUrl } from '../../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

import {
  Folder,
  ChevronRight,
  ChevronDown,
  MapPin,
  Boxes,
  FileText,
  Plus,
  Trash2,
  Edit,
  Save,
  Sliders,
  HardDrive,
  Filter,
  Activity,
  X,
  Globe,
  Code,
  Copy
} from 'lucide-react';

const defaultTeltonikaDecodeCode = `//====================================================
// Teltonika EYE Sensor Mesh Decoder
// Endpoint 11 & Endpoint 238
//====================================================

let evt = msg.payload.wirepas.packet_received_event;

let ep = evt.source_endpoint;

function b64ToBytes(b64){
    return Array.from(Buffer.from(b64,'base64'));
}

function u16(b,o){
    return b[o] | (b[o+1]<<8);
}

function s16(b,o){
    let v=u16(b,o);
    return (v & 0x8000)?v-0x10000:v;
}

function u32(b,o){
    return (b[o]) |
           (b[o+1]<<8) |
           (b[o+2]<<16) |
           (b[o+3]<<24 >>>0);
}

function s32(b,o){
    let v=u32(b,o);
    if(v>0x7fffffff) v-=0x100000000;
    return v;
}

let out = {
    gateway : evt.header.gw_id,
    node     : evt.source_address,
    endpoint : ep,
    hop      : evt.hop_count,
    network  : evt.network_address
};

//====================================================
// Endpoint 11
//====================================================
if(ep == 11){

    let bytes = b64ToBytes(evt.payload);

    let i=0;

    while(i<bytes.length){

        let type=bytes[i++];
        let len =bytes[i++];

        switch(type){

            case 0x01:
                out.error_code=u16(bytes,i);
                break;

            case 0x02:
                out.temperature=Number((s32(bytes,i)/100).toFixed(2));
                break;

            case 0x03:
                out.humidity=Number((u32(bytes,i)/1024).toFixed(2));
                break;

            case 0x05:
                out.accel_x=s32(bytes,i);
                break;

            case 0x06:
                out.accel_y=s32(bytes,i);
                break;

            case 0x07:
                out.accel_z=s32(bytes,i);
                break;

            case 0x08:
                out.pitch=s16(bytes,i);
                break;

            case 0x09:
                out.roll=s16(bytes,i);
                break;

            case 0x0A:
                out.hall=(bytes[i]==1);
                break;
        }

        i += len;
    }

}

//====================================================
// Endpoint 238
//====================================================
else if(ep==238){

    let meas = evt.payload_json.measurements;

    meas.forEach(m=>{

        if(m.voltage!==undefined)
            out.voltage=m.voltage;

        if(m.node_info){

            out.update_interval=m.node_info.update_s;
            out.motion=m.node_info.features.motion;
            out.is_static=m.node_info.features.is_static;
            out.node_mode=m.node_info.node_mode;
            out.node_class=m.node_info.node_class;

        }

        if(m.rss_sr_4byte_addr){

            m.rss_sr_4byte_addr.forEach(r=>{

                if(r.addr==248)
                    out.gateway_rssi=r.rssi;
                else
                    out["rssi_"+r.addr]=r.rssi;

            });

        }

    });

}

msg.payload=out;

return msg;`;

const defaultGenericAttributeCode = `//====================================================
// Generic MQTT Payload Parser
//====================================================

let val = msg.payload.val; // extract value from payload
msg.payload = val;
return msg;`;

// Default attributes for each asset type used for auto-initialization
const defaultAttributesLookup: Record<string, { name: string; dataType: string; unit: string }[]> = {
  CITY: [
    { name: 'location', dataType: 'GeoPoint', unit: 'GPS' },
    { name: 'country', dataType: 'String', unit: '' },
    { name: 'region', dataType: 'String', unit: '' }
  ],
  BUILDING: [
    { name: 'location', dataType: 'GeoPoint', unit: 'GPS' },
    { name: 'address', dataType: 'String', unit: '' },
    { name: 'floors', dataType: 'Integer', unit: 'floor(s)' }
  ],
  LIGHT: [
    { name: 'location', dataType: 'GeoPoint', unit: 'GPS' },
    { name: 'switchMac', dataType: 'String', unit: '' },
    { name: 'powerState', dataType: 'Boolean', unit: '' },
    { name: 'brightness', dataType: 'Integer', unit: '%' }
  ],
  ENVIRONMENT: [
    { name: 'location', dataType: 'GeoPoint', unit: 'GPS' },
    { name: 'temperature', dataType: 'Number', unit: '°C' },
    { name: 'humidity', dataType: 'Number', unit: '%' }
  ],
  WEATHER: [
    { name: 'location', dataType: 'GeoPoint', unit: 'GPS' },
    { name: 'windSpeed', dataType: 'Number', unit: 'm/s' },
    { name: 'pressure', dataType: 'Number', unit: 'hPa' }
  ],
  ANCHOR: [
    { name: 'location', dataType: 'GeoPoint', unit: 'GPS' },
    { name: 'anchorId', dataType: 'String', unit: '' },
    { name: 'txPower', dataType: 'Integer', unit: 'dBm' }
  ],
  FORKLIFT: [
    { name: 'location', dataType: 'GeoPoint', unit: 'GPS' },
    { name: 'vehicleCode', dataType: 'String', unit: '' },
    { name: 'operator', dataType: 'String', unit: '' },
    { name: 'temperature', dataType: 'Number', unit: '°C' },
    { name: 'humidity', dataType: 'Number', unit: '%' },
    { name: 'battery', dataType: 'Number', unit: 'V' }
  ],
  MACHINE: [
    { name: 'location', dataType: 'GeoPoint', unit: 'GPS' },
    { name: 'machineCode', dataType: 'String', unit: '' },
    { name: 'temperature', dataType: 'Number', unit: '°C' },
    { name: 'status', dataType: 'String', unit: '' }
  ],
  MESH_EYE_SENSOR: [
    { name: 'location', dataType: 'GeoPoint', unit: 'GPS' },
    { name: 'temperature', dataType: 'Number', unit: '°C' },
    { name: 'humidity', dataType: 'Number', unit: '%' },
    { name: 'voltage', dataType: 'Number', unit: 'V' },
    { name: 'accel_x', dataType: 'Number', unit: 'mg' },
    { name: 'accel_y', dataType: 'Number', unit: 'mg' },
    { name: 'accel_z', dataType: 'Number', unit: 'mg' },
    { name: 'pitch', dataType: 'Number', unit: '°' },
    { name: 'roll', dataType: 'Number', unit: '°' },
    { name: 'hall', dataType: 'Boolean', unit: '' },
    { name: 'motion', dataType: 'Boolean', unit: '' },
    { name: 'is_static', dataType: 'Boolean', unit: '' },
    { name: 'update_interval', dataType: 'Integer', unit: 's' },
    { name: 'gateway_rssi', dataType: 'Integer', unit: 'dBm' },
    { name: 'rssi_anchor_1', dataType: 'Integer', unit: 'dBm' },
    { name: 'rssi_anchor_2', dataType: 'Integer', unit: 'dBm' }
  ]
};

// OpenRemote custom connection credentials mapping based on Agent type
const agentConnectionFieldsLookup: Record<string, { label: string; key: string; placeholder: string; type?: string; options?: string[] }[]> = {
  AGENT_MQTT_TELTONIKA: [
    { label: 'MQTT Broker Host', key: 'host', placeholder: 'e.g. localhost' },
    { label: 'MQTT Port', key: 'port', placeholder: 'e.g. 1883', type: 'number' },
    { label: 'Use TLS (MQTTS)', key: 'useTls', type: 'select', options: ['false', 'true'], placeholder: 'Select SSL/TLS mode...' },
    { label: 'Client ID', key: 'clientId', placeholder: 'e.g. teltonika-mesh-gw' },
    { label: 'Username', key: 'username', placeholder: 'e.g. admin' },
    { label: 'Password', key: 'password', placeholder: 'password', type: 'password' }
  ],
  AGENT_MQTT_GENERIC: [
    { label: 'MQTT Broker Host', key: 'host', placeholder: 'e.g. localhost' },
    { label: 'MQTT Port', key: 'port', placeholder: 'e.g. 1883', type: 'number' },
    { label: 'Use TLS (MQTTS)', key: 'useTls', type: 'select', options: ['false', 'true'], placeholder: 'Select SSL/TLS mode...' },
    { label: 'Client ID', key: 'clientId', placeholder: 'e.g. generic-subscriber' },
    { label: 'Username', key: 'username', placeholder: 'e.g. admin' },
    { label: 'Password', key: 'password', placeholder: 'password', type: 'password' }
  ],
  AGENT_HTTP: [
    { label: 'Endpoint Webhook URL', key: 'url', placeholder: 'e.g. http://localhost:4000/api/webhooks' },
    { label: 'Authorization Header Bearer', key: 'token', placeholder: 'e.g. secret-token-xyz' },
    { label: 'HTTP Method Pathway', key: 'method', placeholder: 'POST', type: 'select', options: ['POST', 'GET', 'PUT'] }
  ],
  AGENT_BLE: [
    { label: 'Bluetooth HCI Driver Interface', key: 'interface', placeholder: 'e.g. hci0' },
    { label: 'Scan Interval Range (seconds)', key: 'interval', placeholder: 'e.g. 5', type: 'number' }
  ]
};

// OpenRemote type icon lookup
const typeIconLookup: Record<string, React.ComponentType<any>> = {
  AGENT_MQTT_TELTONIKA: Sliders,
  AGENT_MQTT_GENERIC: HardDrive,
  AGENT_HTTP: Globe,
  AGENT_BLE: Activity,
  CITY: Globe,
  BUILDING: Folder,
  LIGHT: Sliders,
  ENVIRONMENT: Activity,
  WEATHER: Globe,
  ANCHOR: MapPin,
  THINGS: Boxes,
  FORKLIFT: Boxes,
  RACK: Folder,
  SHIP: Globe,
  DOOR: Folder,
  ROOM: Folder,
  TAG: HardDrive,
  MACHINE: Sliders,
  MESH_EYE_SENSOR: Activity
};

const getTypeIcon = (type: string) => {
  return typeIconLookup[type] || Boxes;
};

interface AssetAttribute {
  name: string;
  dataType: string; // 'Number' | 'String' | 'JSON' | 'Text' | 'Integer' | 'Boolean'
  unit: string;
  value?: any;
  lastUpdated?: string;
  mqttAgentId?: string;
  mqttTopic?: string;
  mqttPublishTopic?: string;
  mqttValuePath?: string;
  mqttDecodeFunctionCode?: string;
}

interface TreeAsset {
  id: string;
  name: string;
  description?: string | null;
  type: string;
  status: string;
  tenantId: string;
  parentId?: string | null;
  tagId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  latitude?: number | null;
  longitude?: number | null;
  tag: any;
  zone: any;
  children: TreeAsset[];
}

const buildAssetTree = (flatAssets: any[]): TreeAsset[] => {
  const map: Record<string, TreeAsset> = {};
  const roots: TreeAsset[] = [];

  // Initialize mapping
  flatAssets.forEach((asset) => {
    map[asset.id] = { ...asset, children: [] };
  });

  // Nest children under parents
  flatAssets.forEach((asset) => {
    const mapped = map[asset.id];
    if (asset.parentId && map[asset.parentId]) {
      map[asset.parentId].children.push(mapped);
    } else {
      roots.push(mapped);
    }
  });

  return roots;
};

interface TenantQuota {
  agentLimit: number;
  agentCount: number;
  agentRemaining: number;
  isAgentLimitReached: boolean;
  assetLimit: number;
  assetCount: number;
  assetRemaining: number;
  isAssetLimitReached: boolean;
}

export default function AssetsPage() {
  const { tenantId, token, isAdmin } = useAuth();
  const { assets, setAssets } = useSocket();

  // Tenant Quota state
  const [quota, setQuota] = useState<TenantQuota | null>(null);

  // Search/Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedAssetIds, setCollapsedAssetIds] = useState<Record<string, boolean>>({});

  const toggleExpandAsset = (assetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedAssetIds((prev) => ({
      ...prev,
      [assetId]: !prev[assetId]
    }));
  };

  // Mode states: 'view' | 'edit'
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  // Selection states
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const queryId = params.get('id');
      if (queryId && assets.some(a => a.id === queryId)) {
        setSelectedAssetId(queryId);
      }
    }
  }, [assets]);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('FORKLIFT');
  const [parentId, setParentId] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [tagId, setTagId] = useState('');

  // Custom Toasts and Confirm Dialog States
  const [toasts, setToasts] = useState<{ id: string; type: 'success' | 'error' | 'info'; message: string }[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Dynamic parameters
  const [attributes, setAttributes] = useState<AssetAttribute[]>([]);
  const [customFields, setCustomFields] = useState<Record<string, string>>({});

  // Map Picker Modal state
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [mapPickerTargetIndex, setMapPickerTargetIndex] = useState<number | null>(null);
  const [mapPickerCoords, setMapPickerCoords] = useState<{ lat: number; lng: number }>({ lat: -6.168911, lng: 106.899709 });
  const mapPickerContainerRef = useRef<HTMLDivElement | null>(null);
  const mapPickerInstanceRef = useRef<any>(null);
  const mapPickerMarkerRef = useRef<any>(null);

  // Asset-level Ingestion parameters
  const [mqttAgentId, setMqttAgentId] = useState('');
  const [mqttTopic, setMqttTopic] = useState('');
  const [mqttPublishTopic, setMqttPublishTopic] = useState('');
  const [mqttDecodeFunctionCode, setMqttDecodeFunctionCode] = useState('');

  // Add Asset Popup modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalTab, setAddModalTab] = useState<'AGENT' | 'ASSET'>('AGENT');
  const [addModalSelectedType, setAddModalSelectedType] = useState('AGENT_MQTT_TELTONIKA');

  // Info/Message states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedHistoryAttr, setSelectedHistoryAttr] = useState('temperature');
  const [selectedHistoryTimeframe, setSelectedHistoryTimeframe] = useState('1h');
  const [selectedHistoryEndDate, setSelectedHistoryEndDate] = useState(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [historyData, setHistoryData] = useState<{ timestamp: string; value: number }[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const selectedAsset = assets.find((a) => a.id === selectedAssetId);

  const activeAttributes = (() => {
    let attrs: any[] = [];
    if (selectedAsset && selectedAsset.description && selectedAsset.description.startsWith('{')) {
      try {
        const parsed = JSON.parse(selectedAsset.description);
        if (parsed.attributes && Array.isArray(parsed.attributes)) {
          attrs = [...parsed.attributes];
        }
      } catch (e) {
        // ignore
      }
    }
    
    // Inject RTLS Virtual Attributes
    if (selectedAsset && selectedAsset.type === 'MESH_EYE_SENSOR') {
      const planX = selectedAsset.planX ?? 0;
      const planY = selectedAsset.planY ?? 0;
      
      const pxIndex = attrs.findIndex((a: any) => a.name === 'position_x');
      if (pxIndex >= 0) {
        attrs[pxIndex].value = planX;
        attrs[pxIndex].lastUpdated = selectedAsset.updatedAt;
      }
      else attrs.push({ name: 'position_x', dataType: 'float', unit: 'm', value: planX, lastUpdated: selectedAsset.updatedAt });
      
      const pyIndex = attrs.findIndex((a: any) => a.name === 'position_y');
      if (pyIndex >= 0) {
        attrs[pyIndex].value = planY;
        attrs[pyIndex].lastUpdated = selectedAsset.updatedAt;
      }
      else attrs.push({ name: 'position_y', dataType: 'float', unit: 'm', value: planY, lastUpdated: selectedAsset.updatedAt });
    }
    
    return attrs;
  })();

  useEffect(() => {
    if (!selectedAssetId || selectedAsset?.type?.startsWith('AGENT_') || !selectedHistoryAttr) {
      setHistoryData([]);
      return;
    }

    const fetchHistory = async () => {
      setIsLoadingHistory(true);
      try {
        const headers: Record<string, string> = { 'x-tenant-id': tenantId || '' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch(
          `${getApiUrl()}/assets/${selectedAssetId}/telemetry?attribute=${selectedHistoryAttr}&range=${selectedHistoryTimeframe}&endDate=${new Date(selectedHistoryEndDate).toISOString()}`,
          { headers }
        );
        if (res.ok) {
          const data = await res.json();
          setHistoryData(data);
        } else {
          setHistoryData([]);
        }
      } catch (e) {
        console.error('Failed to fetch telemetry history:', e);
        setHistoryData([]);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    fetchHistory();
  }, [selectedAssetId, selectedHistoryAttr, selectedHistoryTimeframe, selectedHistoryEndDate, token, selectedAsset?.type, tenantId]);

  // SVG dynamic path builder for history chart
  const generateSvgPath = (data: { timestamp: string; value: number }[]) => {
    if (data.length === 0) return { linePath: '', areaPath: '', minVal: 0, maxVal: 0, latestVal: 0 };

    const values = data.map(d => d.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const latestVal = values[values.length - 1];
    const valRange = maxVal - minVal || 1;

    if (data.length === 1) {
      // Only 1 point
      return {
        linePath: 'M 0 50 L 100 50',
        areaPath: 'M 0 50 L 100 50 L 100 100 L 0 100 Z',
        minVal,
        maxVal,
        latestVal
      };
    }

    const points = data.map((d, index) => {
      const x = (index / (data.length - 1)) * 100;
      // Scale y from 15 (maxVal) to 85 (minVal) for safety padding
      const y = 85 - ((d.value - minVal) / valRange) * 70;
      return { x, y };
    });

    let linePath = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
    for (let i = 1; i < points.length; i++) {
      linePath += ` L ${points[i].x.toFixed(2)} ${points[i].y.toFixed(2)}`;
    }

    const areaPath = `${linePath} L 100 100 L 0 100 Z`;

    return { linePath, areaPath, minVal, maxVal, latestVal };
  };

  // Leaflet view-only map ref
  const viewMapRef = useRef<HTMLDivElement | null>(null);

  const fetchQuota = async () => {
    if (!tenantId) return;
    try {
      const headers: Record<string, string> = { 'x-tenant-id': tenantId };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${getApiUrl()}/assets/quota`, { headers });
      if (res.ok) {
        const data = await res.json();
        setQuota(data);
      }
    } catch (e) {
      console.error('Failed to fetch tenant quota:', e);
    }
  };

  const refreshAssets = async () => {
    if (!tenantId) return;
    try {
      const headers: Record<string, string> = { 'x-tenant-id': tenantId };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${getApiUrl()}/assets`, { headers });
      if (res.ok) {
        const data = await res.json();
        setAssets(data);
      }
      fetchQuota();
    } catch (e) {
      console.error('Failed to refresh assets:', e);
    }
  };

  useEffect(() => {
    if (tenantId) {
      refreshAssets();
      fetchQuota();
      setSelectedAssetId(null);
      setMode('view');
    }
  }, [tenantId]);

  // Set default selection when assets load
  useEffect(() => {
    if (assets.length > 0 && !selectedAssetId) {
      setSelectedAssetId(assets[0].id);
      handleSelectAsset(assets[0]);
    }
  }, [assets]);

  const handleSelectAsset = (asset: any) => {
    setSelectedAssetId(asset.id);
    setName(asset.name);
    setType(asset.type || 'FORKLIFT');
    setParentId(asset.parentId || '');
    setLatitude(asset.latitude !== null && asset.latitude !== undefined ? String(asset.latitude) : '');
    setLongitude(asset.longitude !== null && asset.longitude !== undefined ? String(asset.longitude) : '');
    setTagId(asset.tagId || '');

    // Parse custom configurations
    try {
      if (asset.description && asset.description.startsWith('{')) {
        const parsed = JSON.parse(asset.description);
        setDescription(parsed.notes || '');
        setMqttAgentId(parsed.mqttAgentId || '');
        setMqttTopic(parsed.mqttTopic || '');
        setMqttPublishTopic(parsed.mqttPublishTopic || '');
        setMqttDecodeFunctionCode(parsed.mqttDecodeFunctionCode || '');

        if (asset.type.startsWith('AGENT_')) {
          setCustomFields(parsed);
          setAttributes([]);
        } else {
          setCustomFields({});
          let loadedAttrs: AssetAttribute[] = [];
          if (parsed.attributes && Array.isArray(parsed.attributes)) {
            loadedAttrs = [...parsed.attributes];
          } else {
            const defaults = defaultAttributesLookup[asset.type] || [];
            loadedAttrs = defaults.map(d => ({ ...d, value: '' }));
          }

          // Ensure location attribute exists and is populated with asset's latitude & longitude if available
          const hasLocation = loadedAttrs.some(a => a.dataType === 'GeoPoint' || a.name === 'location' || a.name === 'coordinates');
          if (!hasLocation) {
            const locVal = asset.latitude && asset.longitude ? `${asset.latitude}, ${asset.longitude}` : '';
            loadedAttrs.unshift({ name: 'location', dataType: 'GeoPoint', unit: 'GPS', value: locVal });
          } else {
            loadedAttrs = loadedAttrs.map(a => {
              if ((a.dataType === 'GeoPoint' || a.name === 'location' || a.name === 'coordinates') && (!a.value || a.value === '')) {
                if (asset.latitude && asset.longitude) {
                  return { ...a, value: `${asset.latitude}, ${asset.longitude}` };
                }
              }
              return a;
            });
          }

          setAttributes(loadedAttrs);
          if (loadedAttrs.length > 0) {
            setSelectedHistoryAttr(loadedAttrs[0].name);
          }
        }
      } else {
        setDescription(asset.description || '');
        setCustomFields({});
        setMqttAgentId('');
        setMqttTopic('');
        setMqttPublishTopic('');
        setMqttDecodeFunctionCode('');
        const defaults = defaultAttributesLookup[asset.type] || [];
        let loadedAttrs = defaults.map(d => ({ ...d, value: '' }));
        if (asset.latitude && asset.longitude) {
          loadedAttrs = loadedAttrs.map(a => (a.dataType === 'GeoPoint' || a.name === 'location' || a.name === 'coordinates') ? { ...a, value: `${asset.latitude}, ${asset.longitude}` } : a);
        }
        setAttributes(loadedAttrs);
        if (loadedAttrs.length > 0) {
          setSelectedHistoryAttr(loadedAttrs[0].name);
        }
      }
    } catch (e) {
      setDescription(asset.description || '');
      setCustomFields({});
      setMqttAgentId('');
      setMqttTopic('');
      setMqttPublishTopic('');
      setMqttDecodeFunctionCode('');
      const defaults = defaultAttributesLookup[asset.type] || [];
      const mapped = defaults.map(d => ({ ...d, value: '' }));
      setAttributes(mapped);
      if (mapped.length > 0) {
        setSelectedHistoryAttr(mapped[0].name);
      }
    }
    setMode('view');
  };

  const handleOpenCreate = () => {
    setName('');
    setDescription('');
    setParentId('');
    setLatitude('');
    setLongitude('');
    setTagId('');
    setCustomFields({});
    setAttributes([]);
    setMqttAgentId('');
    setMqttTopic('');
    setMqttPublishTopic('');
    setMqttDecodeFunctionCode('');
    setAddModalSelectedType('AGENT_MQTT_TELTONIKA');
    setAddModalTab('AGENT');
    setShowAddModal(true);
  };

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !tenantId) return;

    setIsSubmitting(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-tenant-id': tenantId
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let serializedDescription = '';
      if (addModalTab === 'AGENT') {
        serializedDescription = JSON.stringify({
          ...customFields,
          notes: description
        });
      } else {
        // Pre-populate with default attributes upon creation
        const defaults = defaultAttributesLookup[addModalSelectedType] || [];
        const initialAttributes = defaults.map(d => ({ ...d, value: '' }));
        serializedDescription = JSON.stringify({
          attributes: initialAttributes,
          notes: description
        });
      }

      const res = await fetch(`${getApiUrl()}/assets`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name,
          type: addModalSelectedType,
          parentId: parentId || null,
          tagId: tagId || null,
          latitude: latitude ? parseFloat(latitude) : null,
          longitude: longitude ? parseFloat(longitude) : null,
          description: serializedDescription
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to create asset.');
      }

      const created = await res.json();
      await refreshAssets();
      setSelectedAssetId(created.id);
      setShowAddModal(false);
      setMode('view');
      showToast('success', 'Asset successfully created.');
    } catch (err: any) {
      showToast('error', err.message || 'Error creating asset.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetId || !tenantId) return;

    setIsSubmitting(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-tenant-id': tenantId
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let serializedDescription = '';
      if (type.startsWith('AGENT_')) {
        serializedDescription = JSON.stringify({
          ...customFields,
          notes: description
        });
      } else {
        serializedDescription = JSON.stringify({
          attributes,
          mqttAgentId: mqttAgentId || null,
          mqttTopic: mqttTopic || null,
          mqttPublishTopic: mqttPublishTopic || null,
          mqttDecodeFunctionCode: mqttDecodeFunctionCode || null,
          notes: description
        });
      }

      // Extract GPS coordinates from GeoPoint / location attribute if present
      let extractedLat = latitude ? parseFloat(latitude) : null;
      let extractedLon = longitude ? parseFloat(longitude) : null;

      const locAttr = attributes.find(a => a.dataType === 'GeoPoint' || a.name === 'location' || a.name === 'coordinates');
      if (locAttr && locAttr.value && typeof locAttr.value === 'string' && locAttr.value.includes(',')) {
        const parts = locAttr.value.split(',').map(s => parseFloat(s.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          extractedLat = parts[0];
          extractedLon = parts[1];
        }
      }

      const res = await fetch(`${getApiUrl()}/assets/${selectedAssetId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          name,
          type,
          parentId: parentId || null,
          tagId: tagId || null,
          latitude: extractedLat,
          longitude: extractedLon,
          description: serializedDescription
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to update asset.');
      }

      await refreshAssets();
      setMode('view');
      showToast('success', 'Configuration successfully saved.');
    } catch (err: any) {
      showToast('error', err.message || 'Error updating asset.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAsset = () => {
    if (!selectedAssetId || !tenantId || !selectedAsset) return;
    setShowDeleteConfirm(true);
  };

  const executeDeleteAsset = async () => {
    if (!selectedAssetId || !tenantId || !selectedAsset) return;
    setShowDeleteConfirm(false);

    try {
      const headers: Record<string, string> = { 'x-tenant-id': tenantId };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${getApiUrl()}/assets/${selectedAssetId}`, {
        method: 'DELETE',
        headers
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to delete asset.');
      }

      await refreshAssets();
      setSelectedAssetId(null);
      setMode('view');
      showToast('success', 'Asset successfully deleted.');
    } catch (err: any) {
      showToast('error', err.message || 'Error deleting asset.');
    }
  };

  const handleDuplicateAsset = async () => {
    if (!selectedAssetId || !tenantId || !selectedAsset) return;
    try {
      const headers: Record<string, string> = { 'x-tenant-id': tenantId };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${getApiUrl()}/assets/${selectedAssetId}/duplicate`, {
        method: 'POST',
        headers,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to duplicate asset.');
      }

      const newAsset = await res.json();
      await refreshAssets();
      setSelectedAssetId(newAsset.id);
      showToast('success', `Asset "${selectedAsset.name}" berhasil diduplikat.`);
    } catch (err: any) {
      showToast('error', err.message || 'Error duplicating asset.');
    }
  };

  const handleCustomFieldChange = (key: string, value: string) => {
    setCustomFields((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  // Leaflet Map Picker Modal initialization
  useEffect(() => {
    if (!mapPickerOpen || typeof window === 'undefined') return;

    const timer = setTimeout(() => {
      const container = mapPickerContainerRef.current;
      if (!container) return;

      const L = require('leaflet');

      if ((container as any)._leaflet_id) {
        (container as any)._leaflet_id = null;
      }

      const map = L.map(container, {
        center: [mapPickerCoords.lat, mapPickerCoords.lng],
        zoom: 15,
      });
      mapPickerInstanceRef.current = map;

      L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        attribution: '© Google Maps',
        maxZoom: 20,
      }).addTo(map);

      const customIcon = L.icon({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });

      const marker = L.marker([mapPickerCoords.lat, mapPickerCoords.lng], {
        icon: customIcon,
        draggable: true,
      }).addTo(map);
      mapPickerMarkerRef.current = marker;

      marker.on('dragend', (e: any) => {
        const { lat, lng } = e.target.getLatLng();
        setMapPickerCoords({ lat: parseFloat(lat.toFixed(6)), lng: parseFloat(lng.toFixed(6)) });
      });

      map.on('click', (e: any) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng(e.latlng);
        setMapPickerCoords({ lat: parseFloat(lat.toFixed(6)), lng: parseFloat(lng.toFixed(6)) });
      });

      map.invalidateSize();
    }, 150);

    return () => {
      clearTimeout(timer);
      if (mapPickerInstanceRef.current) {
        try {
          mapPickerInstanceRef.current.remove();
        } catch (e) {}
        mapPickerInstanceRef.current = null;
      }
    };
  }, [mapPickerOpen]);

  // Leaflet view-only map initialization inside inspector panel
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (mode !== 'view' || !selectedAsset || !selectedAsset.latitude || !selectedAsset.longitude) return;

    const mapContainer = viewMapRef.current;
    if (!mapContainer) return;

    const L = require('leaflet');

    if ((mapContainer as any)._leaflet_id) {
      (mapContainer as any)._leaflet_id = null;
    }

    const lat = parseFloat(String(selectedAsset.latitude));
    const lng = parseFloat(String(selectedAsset.longitude));

    const customIcon = L.icon({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    const map = L.map(mapContainer, {
      zoomControl: true,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      dragging: true
    }).setView([lat, lng], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    L.marker([lat, lng], { icon: customIcon }).addTo(map);

    return () => {
      try {
        map.remove();
      } catch (e) {
        console.warn('View map cleanup warning:', e);
      }
      if (mapContainer) {
        (mapContainer as any)._leaflet_id = null;
      }
    };
  }, [selectedAssetId, mode]);

  // Filter based on search query
  const filteredAssets = assets.filter((a) =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group list of agents vs assets in the popup modal
  const agentTypes = [
    { key: 'AGENT_MQTT_TELTONIKA', label: 'Teltonika Mesh Gateway', icon: Sliders },
    { key: 'AGENT_MQTT_GENERIC', label: 'Generic MQTT Agent', icon: HardDrive },
    { key: 'AGENT_HTTP', label: 'HTTP Gateway', icon: Globe },
    { key: 'AGENT_BLE', label: 'Bluetooth Gateway', icon: Activity }
  ];

  const assetTypes = [
    { key: 'CITY', label: 'City', icon: Globe },
    { key: 'BUILDING', label: 'Building', icon: Folder },
    { key: 'LIGHT', label: 'Light', icon: Sliders },
    { key: 'ENVIRONMENT', label: 'Environment', icon: Activity },
    { key: 'WEATHER', label: 'Weather Station', icon: Globe },
    { key: 'ANCHOR', label: 'Anchor', icon: MapPin },
    { key: 'THINGS', label: 'Things Assets', icon: Boxes },
    { key: 'FORKLIFT', label: 'Forklift', icon: Boxes },
    { key: 'RACK', label: 'Rack', icon: Folder },
    { key: 'SHIP', label: 'Ship', icon: Globe },
    { key: 'DOOR', label: 'Door', icon: Folder },
    { key: 'ROOM', label: 'Room Asset', icon: Folder },
    { key: 'TAG', label: 'Tag Card', icon: HardDrive },
    { key: 'MACHINE', label: 'Machine', icon: Sliders },
    { key: 'MESH_EYE_SENSOR', label: 'Mesh Eye Sensor', icon: Activity }
  ];

  const currentAddModalTypes = addModalTab === 'AGENT' ? agentTypes : assetTypes;
  const currentFieldsConfig = agentConnectionFieldsLookup[addModalSelectedType] || [];
  const currentEditFieldsConfig = agentConnectionFieldsLookup[type] || [];

  // Recursive render function for the tree with expand/collapse
  const renderAssetNode = (node: TreeAsset, level = 0) => {
    const isSelected = selectedAssetId === node.id;
    const hasChildren = node.children && node.children.length > 0;
    const isCollapsed = !!collapsedAssetIds[node.id];
    const TypeIcon = getTypeIcon(node.type);

    return (
      <div key={node.id} className="space-y-1">
        <div
          onClick={() => handleSelectAsset(node)}
          style={{ paddingLeft: `${level * 14 + 8}px` }}
          className={`flex items-center gap-1.5 py-1.5 pr-2.5 rounded cursor-pointer transition-all border ${isSelected
            ? 'bg-primary/10 border-primary/20 text-primary font-bold shadow-sm'
            : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/40'
            }`}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => toggleExpandAsset(node.id, e)}
              className="p-0.5 hover:bg-secondary/80 rounded text-muted-foreground hover:text-foreground shrink-0 transition-transform"
              title={isCollapsed ? "Expand" : "Collapse"}
            >
              {isCollapsed ? (
                <ChevronRight className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          ) : (
            <span className="w-3.5 h-3.5 shrink-0" />
          )}
          <TypeIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/75" />
          <span className="truncate text-xs flex-1">{node.name}</span>
          {hasChildren && (
            <Badge
              variant="secondary"
              onClick={(e) => toggleExpandAsset(node.id, e)}
              className="font-mono text-[9px] px-1.5 py-0.5 rounded-full cursor-pointer hover:bg-secondary/80 bg-secondary/60 text-muted-foreground ml-auto"
            >
              {node.children.length}
            </Badge>
          )}
        </div>
        {hasChildren && !isCollapsed && (
          <div className="space-y-1">
            {node.children.map((child) => renderAssetNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-[calc(100vh-128px)] w-full gap-5 overflow-hidden">

      {/* LEFT COLUMN: ASSETS SIDEBAR TREE */}
      <Card className="w-80 flex flex-col shrink-0 overflow-hidden border border-border">
        <div className="bg-secondary/40 border-b border-border p-3 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
            <Boxes className="h-4.5 w-4.5 text-primary" />
            Assets
          </span>
          {isAdmin && (
            <>
              <Button
                onClick={handleDeleteAsset}
                disabled={!selectedAssetId}
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-red-400 disabled:opacity-35 cursor-pointer"
                title="Delete Selected Asset"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                onClick={handleDuplicateAsset}
                disabled={!selectedAssetId}
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-blue-400 disabled:opacity-35 cursor-pointer"
                title="Duplicate Selected Asset"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button
                onClick={handleOpenCreate}
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
                title="Add Agent or Asset"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>

        {/* Quota Usage Summary */}
        {quota && (
          <div className="p-3 border-b border-border bg-secondary/20 space-y-2">
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              {/* Agent Quota Badge */}
              <div className={`p-2 rounded-lg border ${quota.isAgentLimitReached ? 'bg-red-950/30 border-red-500/40' : 'bg-secondary/40 border-border text-foreground'}`}>
                <div className="flex justify-between items-center font-bold">
                  <span>Agent Usage</span>
                  <Badge variant={quota.isAgentLimitReached ? 'destructive' : 'secondary'} className="text-[8px] px-1 py-0 font-mono">
                    {quota.isAgentLimitReached ? 'FULL' : 'OK'}
                  </Badge>
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-xs font-mono font-bold">{quota.agentCount} / {quota.agentLimit}</span>
                  <span className="text-[9px] text-muted-foreground">{quota.agentRemaining} left</span>
                </div>
                <div className="w-full bg-secondary/80 h-1 rounded-full mt-1 overflow-hidden">
                  <div
                    className={`h-full transition-all ${quota.isAgentLimitReached ? 'bg-red-500' : 'bg-primary'}`}
                    style={{ width: `${Math.min(100, (quota.agentCount / quota.agentLimit) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Asset Quota Badge */}
              <div className={`p-2 rounded-lg border ${quota.isAssetLimitReached ? 'bg-amber-950/30 border-amber-500/40 text-amber-300' : 'bg-secondary/40 border-border text-foreground'}`}>
                <div className="flex justify-between items-center font-bold">
                  <span>Asset Usage</span>
                  <Badge variant={quota.isAssetLimitReached ? 'destructive' : 'secondary'} className="text-[8px] px-1 py-0 font-mono">
                    {quota.isAssetLimitReached ? 'FULL' : 'OK'}
                  </Badge>
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-xs font-mono font-bold">{quota.assetCount} / {quota.assetLimit}</span>
                  <span className="text-[9px] text-muted-foreground">{quota.assetRemaining} left</span>
                </div>
                <div className="w-full bg-secondary/80 h-1 rounded-full mt-1 overflow-hidden">
                  <div
                    className={`h-full transition-all ${quota.isAssetLimitReached ? 'bg-amber-500' : 'bg-cyan-500'}`}
                    style={{ width: `${Math.min(100, (quota.assetCount / quota.assetLimit) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filter Input */}
        <div className="p-3 border-b border-border/60">
          <div className="relative">
            <Filter className="h-3.5 w-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              placeholder="Filter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs h-8"
            />
          </div>
        </div>

        {/* Assets Hierarchical Tree */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-1 text-xs font-semibold select-none">
          {assets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground font-medium">
              No assets or agents registered.
            </div>
          ) : (
            buildAssetTree(filteredAssets).map((rootNode) => renderAssetNode(rootNode, 0))
          )}
        </div>
      </Card>

      {/* RIGHT COLUMN: INSPECTOR & CONFIG PANEL */}
      <Card className="flex-1 flex flex-col overflow-hidden border border-border shadow-xl">
        {mode === 'edit' ? (
          /* ==================== EDIT FORM ==================== */
          <form onSubmit={handleUpdateAsset} className="flex-1 flex flex-col justify-between overflow-hidden">
            <CardHeader className="py-4 flex flex-row items-center justify-between border-b bg-secondary/15">
              <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                {(() => {
                  const TypeIcon = getTypeIcon(selectedAsset?.type || 'FORKLIFT');
                  return <TypeIcon className="h-4.5 w-4.5 text-primary shrink-0 animate-pulse" />;
                })()}
                Modify: {selectedAsset?.name} ({selectedAsset?.type})
              </CardTitle>
              <Button
                type="button"
                onClick={() => setMode('view')}
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>

            <CardContent className="p-6 space-y-4 flex-1 overflow-y-auto pt-6 text-xs font-semibold">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-muted-foreground">Name *</label>
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-muted-foreground">Parent Asset</label>
                  <select
                    value={parentId}
                    onChange={(e) => setParentId(e.target.value)}
                    className="w-full bg-secondary/35 border border-border px-3 py-2 rounded-lg text-foreground focus:outline-none focus:border-primary text-xs font-semibold"
                  >
                    <option value="">(None / Root Asset)</option>
                    {assets
                      .filter((a) => a.id !== selectedAssetId)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.type})
                        </option>
                      ))
                    }
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-muted-foreground">Device Address / Serial Number (Optional)</label>
                  <Input
                    type="text"
                    value={tagId}
                    onChange={(e) => setTagId(e.target.value)}
                    placeholder="e.g. node-439201 or 439201"
                  />
                </div>
              </div>

              {/* Dynamic Connection Credentials Form (For Agents) */}
              {type.startsWith('AGENT_') && currentEditFieldsConfig.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-border/60">
                  <span className="text-[10px] text-primary uppercase font-bold tracking-wider">Required Connection Credentials</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {currentEditFieldsConfig.map((field) => (
                      <div key={field.key} className="space-y-1.5">
                        <label className="text-muted-foreground">{field.label}</label>
                        {field.type === 'select' ? (
                          <select
                            value={customFields[field.key] || ''}
                            onChange={(e) => handleCustomFieldChange(field.key, e.target.value)}
                            className="w-full bg-secondary/35 border border-border px-3 py-2 rounded-lg text-foreground focus:outline-none focus:border-primary text-xs font-semibold"
                          >
                            <option value="">Select option...</option>
                            {field.options?.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Input
                            type={field.type || 'text'}
                            value={customFields[field.key] || ''}
                            onChange={(e) => handleCustomFieldChange(field.key, e.target.value)}
                            placeholder={field.placeholder}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Asset-Level MQTT Ingestion Configuration (For physical assets) */}
              {!type.startsWith('AGENT_') && (
                <div className="space-y-3.5 pt-4 border-t border-border/60">
                  <span className="text-[10px] text-primary uppercase font-bold tracking-wider">Asset-Level Ingestion Configuration (Optional)</span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1">
                      <label className="text-muted-foreground">MQTT Agent Link</label>
                      <select
                        value={mqttAgentId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setMqttAgentId(val);
                          const linked = assets.find(a => a.id === val);
                          if (linked?.type === 'AGENT_MQTT_TELTONIKA') {
                            setMqttTopic('json-gw-event/received_data/#');
                            setMqttDecodeFunctionCode(defaultTeltonikaDecodeCode);
                          } else {
                            setMqttTopic('');
                            setMqttDecodeFunctionCode('');
                          }
                        }}
                        className="w-full bg-secondary/35 border border-border px-3 py-2 rounded-lg text-foreground focus:outline-none focus:border-primary text-xs font-semibold"
                      >
                        <option value="">(None / Static Asset)</option>
                        {assets
                          .filter(a => a.type === 'AGENT_MQTT_TELTONIKA' || a.type === 'AGENT_MQTT_GENERIC')
                          .map(a => (
                            <option key={a.id} value={a.id}>
                              {a.name} ({a.type === 'AGENT_MQTT_TELTONIKA' ? 'Teltonika' : 'Generic'})
                            </option>
                          ))
                        }
                      </select>
                    </div>

                    {mqttAgentId && (
                      <div className="space-y-1">
                        <label className="text-muted-foreground">Subscribe Topic</label>
                        <Input
                          type="text"
                          value={mqttTopic}
                          onChange={(e) => setMqttTopic(e.target.value)}
                          placeholder="e.g. json-gw-event/received_data/#"
                        />
                      </div>
                    )}
                  </div>

                  {mqttAgentId && (
                    <div className="space-y-3.5 pt-1">
                      <div className="grid grid-cols-1 gap-3.5">
                        <div className="space-y-1">
                          <label className="text-muted-foreground">Publish Topic</label>
                          <Input
                            type="text"
                            value={mqttPublishTopic}
                            onChange={(e) => setMqttPublishTopic(e.target.value)}
                            placeholder="e.g. gateway/publish/topic"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-muted-foreground flex items-center gap-1.5">
                            <Code className="h-3.5 w-3.5 text-primary" />
                            JavaScript Payload Decoder Function (Node-RED format)
                          </label>
                          <Badge variant="outline" className="text-[9px]">vm sandbox (1s timeout)</Badge>
                        </div>
                        <textarea
                          rows={12}
                          value={mqttDecodeFunctionCode}
                          onChange={(e) => setMqttDecodeFunctionCode(e.target.value)}
                          className="w-full font-mono text-[11px] p-3.5 bg-black/75 text-emerald-400 border border-border/80 rounded-xl focus:outline-none focus:border-primary resize-none leading-relaxed"
                          placeholder="// Write custom JS code..."
                        />
                        <p className="text-[9.5px] text-muted-foreground leading-normal">
                          Write a function that manipulates the <code>msg</code> object and returns it. Context exposes <code>msg.payload</code>, <code>msg.topic</code>, and global <code>Buffer</code>.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Dynamic Metadata Attributes Editor (For physical assets) */}
              {!type.startsWith('AGENT_') && (
                <div className="space-y-4 pt-4 border-t border-border/60">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-primary uppercase font-bold tracking-wider">Dynamic Asset Attributes</span>
                    <Button
                      type="button"
                      onClick={() => {
                        setAttributes(prev => [
                          ...prev,
                          { name: 'new_attribute', dataType: 'Number', unit: '', value: '' }
                        ]);
                      }}
                      variant="outline"
                      className="h-7 text-[10px] uppercase font-bold px-2 flex items-center gap-1.5"
                    >
                      <Plus className="h-3 w-3" />
                      Add Attribute
                    </Button>
                  </div>

                  {attributes.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4 font-semibold text-xs italic">No attributes configured.</p>
                  ) : (
                    <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                      {attributes.map((attr, idx) => {
                        return (
                          <div key={idx} className="bg-secondary/15 border border-border p-4 rounded-xl space-y-3.5 relative">
                            <button
                              type="button"
                              onClick={() => {
                                setAttributes(prev => prev.filter((_, i) => i !== idx));
                              }}
                              className="absolute right-3 top-3 text-muted-foreground hover:text-red-400 transition-colors cursor-pointer"
                              title="Remove Attribute"
                            >
                              <X className="h-4 w-4" />
                            </button>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div className="space-y-1">
                                <label className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Attribute Name</label>
                                <Input
                                  type="text"
                                  value={attr.name}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setAttributes(prev => prev.map((a, i) => i === idx ? { ...a, name: val } : a));
                                  }}
                                  placeholder="e.g. temperature"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Data Type</label>
                                <select
                                  value={attr.dataType}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setAttributes(prev => prev.map((a, i) => i === idx ? { ...a, dataType: val } : a));
                                  }}
                                  className="w-full bg-secondary/35 border border-border px-3 py-2 rounded-lg text-foreground focus:outline-none focus:border-primary text-xs font-semibold"
                                >
                                  <option value="Number">Number</option>
                                  <option value="String">String</option>
                                  <option value="GeoPoint">GeoPoint (GPS)</option>
                                  <option value="JSON">JSON</option>
                                  <option value="Text">Text</option>
                                  <option value="Integer">Integer</option>
                                  <option value="Boolean">Boolean</option>
                                </select>
                              </div>

                              <div className="space-y-1">
                                <label className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Unit</label>
                                <Input
                                  type="text"
                                  value={attr.unit}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setAttributes(prev => prev.map((a, i) => i === idx ? { ...a, unit: val } : a));
                                  }}
                                  placeholder="e.g. °C"
                                />
                              </div>
                            </div>

                            {/* Value / GPS Coordinates Picker Input */}
                            <div className="pt-2 border-t border-border/30">
                              {attr.dataType === 'GeoPoint' || attr.name === 'location' || attr.name === 'coordinates' || attr.name === 'maps' ? (
                                <div className="space-y-2 bg-primary/5 border border-primary/20 p-3 rounded-lg">
                                  <div className="flex items-center justify-between">
                                    <label className="text-primary text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5">
                                      <MapPin className="h-3.5 w-3.5" />
                                      <span>GPS Coordinates (WGS84)</span>
                                    </label>
                                    <span className="text-[10px] text-muted-foreground italic font-normal">Format: Latitude, Longitude</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="text"
                                      value={typeof attr.value === 'object' && attr.value !== null ? `${attr.value.lat ?? ''}, ${attr.value.lng ?? ''}` : (attr.value ?? '')}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setAttributes(prev => prev.map((a, i) => i === idx ? { ...a, value: val } : a));
                                      }}
                                      placeholder="e.g. -6.168911, 106.899709"
                                      className="font-mono text-xs bg-background/80"
                                    />
                                    <Button
                                      type="button"
                                      onClick={() => {
                                        setMapPickerTargetIndex(idx);
                                        let initialLat = -6.168911;
                                        let initialLng = 106.899709;
                                        const rawVal = typeof attr.value === 'object' && attr.value !== null 
                                          ? `${attr.value.lat ?? ''}, ${attr.value.lng ?? ''}` 
                                          : (attr.value ?? '');
                                        if (rawVal && typeof rawVal === 'string' && rawVal.includes(',')) {
                                          const parts = rawVal.split(',').map((s: string) => parseFloat(s.trim()));
                                          if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                                            initialLat = parts[0];
                                            initialLng = parts[1];
                                          }
                                        }
                                        setMapPickerCoords({ lat: initialLat, lng: initialLng });
                                        setMapPickerOpen(true);
                                      }}
                                      className="shrink-0 h-9 px-3.5 text-xs font-bold text-white bg-primary hover:bg-primary/90 flex items-center gap-1.5 shadow-sm cursor-pointer"
                                    >
                                      <MapPin className="h-4 w-4" />
                                      Pilih di Peta
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <label className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Initial / Fallback Value</label>
                                  <Input
                                    type="text"
                                    value={attr.value ?? ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setAttributes(prev => prev.map((a, i) => i === idx ? { ...a, value: val } : a));
                                    }}
                                    placeholder="Initial or fallback value"
                                  />
                                </div>
                              )}
                            </div>

                            {/* Agent Link selection */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/30">
                              <div className="space-y-1">
                                <label className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Agent Link</label>
                                <select
                                  value={attr.mqttAgentId || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setAttributes(prev => prev.map((a, i) => {
                                      if (i === idx) {
                                        const agent = assets.find(as => as.id === val);
                                        const defaultCode = agent?.type === 'AGENT_MQTT_TELTONIKA' ? defaultTeltonikaDecodeCode : defaultGenericAttributeCode;
                                        return {
                                          ...a,
                                          mqttAgentId: val || undefined,
                                          mqttTopic: val ? (agent?.type === 'AGENT_MQTT_TELTONIKA' ? 'json-gw-event/received_data/#' : '') : '',
                                          mqttValuePath: val ? (agent?.type === 'AGENT_MQTT_TELTONIKA' ? `$.${a.name}` : '') : '',
                                          mqttDecodeFunctionCode: val ? defaultCode : undefined
                                        };
                                      }
                                      return a;
                                    }));
                                  }}
                                  className="w-full bg-secondary/35 border border-border px-3 py-2 rounded-lg text-foreground focus:outline-none focus:border-primary text-xs font-semibold"
                                >
                                  <option value="">(None / Static Attribute)</option>
                                  {assets
                                    .filter(a => a.type === 'AGENT_MQTT_TELTONIKA' || a.type === 'AGENT_MQTT_GENERIC')
                                    .map(a => (
                                      <option key={a.id} value={a.id}>
                                        {a.name} ({a.type === 'AGENT_MQTT_TELTONIKA' ? 'Teltonika' : 'Generic'})
                                      </option>
                                    ))
                                  }
                                </select>
                              </div>

                              {attr.mqttAgentId && (
                                <div className="space-y-1">
                                  <label className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Subscribe Topic</label>
                                  <Input
                                    type="text"
                                    value={attr.mqttTopic || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setAttributes(prev => prev.map((a, i) => i === idx ? { ...a, mqttTopic: val } : a));
                                    }}
                                    placeholder="e.g. factory/temp/1 or json-gw-event/received_data/#"
                                  />
                                </div>
                              )}
                            </div>
                            {/* Sub-parameters for Agent Ingestions */}
                            {attr.mqttAgentId && (
                              <div className="space-y-3.5 pt-2">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                  <div className="space-y-1">
                                    <label className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Publish Topic</label>
                                    <Input
                                      type="text"
                                      value={attr.mqttPublishTopic || ''}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setAttributes(prev => prev.map((a, i) => i === idx ? { ...a, mqttPublishTopic: val } : a));
                                      }}
                                      placeholder="e.g. cmd/temp/1"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <label className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Value Path</label>
                                    <Input
                                      type="text"
                                      value={attr.mqttValuePath || ''}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setAttributes(prev => prev.map((a, i) => i === idx ? { ...a, mqttValuePath: val } : a));
                                      }}
                                      placeholder="e.g. $.source_address or $.val"
                                    />
                                  </div>
                                </div>

                                <div className="space-y-1.5">
                                  <label className="text-muted-foreground flex items-center gap-1">
                                    <Code className="h-3 w-3 text-primary" />
                                    Attribute JS Ingestion Decoder Function
                                  </label>
                                  <textarea
                                    rows={8}
                                    value={attr.mqttDecodeFunctionCode || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setAttributes(prev => prev.map((a, i) => i === idx ? { ...a, mqttDecodeFunctionCode: val } : a));
                                    }}
                                    className="w-full font-mono text-[10.5px] p-2.5 bg-black/75 text-emerald-400 border border-border/85 rounded-xl focus:outline-none focus:border-primary resize-none leading-relaxed"
                                    placeholder="// Custom attribute JS code..."
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1.5 pt-3">
                <label className="text-muted-foreground">Notes / General Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-secondary/35 border border-border px-3 py-2 rounded-lg text-foreground focus:outline-none focus:border-primary resize-none text-xs font-semibold"
                />
              </div>
            </CardContent>

            <div className="p-4 border-t border-border flex items-center justify-end gap-3 bg-secondary/10 shrink-0">
              <Button type="button" onClick={() => setMode('view')} variant="outline">
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                <Save className="h-3.5 w-3.5 mr-1.5" />
                {isSubmitting ? 'Saving...' : 'Save Configuration'}
              </Button>
            </div>
          </form>
        ) : (
          /* ==================== VIEW MODE ==================== */
          <>
            {selectedAsset ? (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="border-b border-border p-4 flex items-center justify-between bg-secondary/15 shrink-0">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      {(() => {
                        const TypeIcon = getTypeIcon(selectedAsset.type);
                        return <TypeIcon className="h-4.5 w-4.5 text-muted-foreground shrink-0" />;
                      })()}
                      {selectedAsset.name}
                    </h3>
                    <p className="text-[10px] text-muted-foreground">
                      Created: {selectedAsset.createdAt ? new Date(selectedAsset.createdAt).toLocaleString() : '--'}
                    </p>
                  </div>
                  {isAdmin && (
                    <Button
                      onClick={() => {
                        setName(selectedAsset.name);
                        setType(selectedAsset.type || 'FORKLIFT');
                        setParentId(selectedAsset.parentId || '');
                        setLatitude(selectedAsset.latitude !== null && selectedAsset.latitude !== undefined ? String(selectedAsset.latitude) : '');
                        setLongitude(selectedAsset.longitude !== null && selectedAsset.longitude !== undefined ? String(selectedAsset.longitude) : '');

                        try {
                          if (selectedAsset.description && selectedAsset.description.startsWith('{')) {
                            const parsed = JSON.parse(selectedAsset.description);
                            setCustomFields(parsed);
                            setDescription(parsed.notes || '');
                            setMqttAgentId(parsed.mqttAgentId || '');
                            setMqttTopic(parsed.mqttTopic || '');
                            setMqttPublishTopic(parsed.mqttPublishTopic || '');
                            setMqttDecodeFunctionCode(parsed.mqttDecodeFunctionCode || '');

                            if (!selectedAsset.type.startsWith('AGENT_')) {
                              if (parsed.attributes && Array.isArray(parsed.attributes)) {
                                setAttributes(parsed.attributes);
                              } else {
                                const defaults = defaultAttributesLookup[selectedAsset.type] || [];
                                setAttributes(defaults.map(d => ({ ...d, value: '' })));
                              }
                            }
                          } else {
                            setCustomFields({});
                            setDescription(selectedAsset.description || '');
                            setMqttAgentId('');
                            setMqttTopic('');
                            setMqttPublishTopic('');
                            setMqttDecodeFunctionCode('');
                            const defaults = defaultAttributesLookup[selectedAsset.type] || [];
                            setAttributes(defaults.map(d => ({ ...d, value: '' })));
                          }
                        } catch (e) {
                          setCustomFields({});
                          setDescription(selectedAsset.description || '');
                          setMqttAgentId('');
                          setMqttTopic('');
                          setMqttPublishTopic('');
                          setMqttDecodeFunctionCode('');
                          const defaults = defaultAttributesLookup[selectedAsset.type] || [];
                          setAttributes(defaults.map(d => ({ ...d, value: '' })));
                        }
                        setMode('edit');
                      }}
                      variant="outline"
                      className="flex items-center gap-1.5 h-8 text-[11px] font-bold"
                    >
                      <Edit className="h-3.5 w-3.5" />
                      Modify
                    </Button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-5 flex flex-col lg:flex-row gap-6 min-h-0">
                  {/* Left Column: Info, Connection Parameters & Dynamic Attributes */}
                  <div className="flex-1 space-y-5">

                    {/* INFO Card */}
                    <Card className="border border-border/80">
                      <CardHeader className="py-2.5 px-4 bg-secondary/20 border-b border-border/50">
                        <CardTitle className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                          Info
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 text-xs font-semibold space-y-3">
                        <div className="flex items-center justify-between py-2 border-b border-border/40">
                          <span className="text-muted-foreground">Type Category:</span>
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {selectedAsset.type}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-border/40">
                          <span className="text-muted-foreground">Parent Asset:</span>
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {selectedAsset.parentId
                              ? assets.find((a) => a.id === selectedAsset.parentId)?.name || 'Linked'
                              : 'None (Root)'
                            }
                          </Badge>
                        </div>
                        {selectedAsset.type.startsWith('AGENT_') ? (
                          <div className="flex items-center justify-between py-2 border-b border-border/40">
                            <span className="text-muted-foreground">Active Status:</span>
                            {(() => {
                              const s = String(selectedAsset.status).toLowerCase();
                              if (s === 'online' || s === 'connected' || s === 'active') {
                                return <Badge variant="success">Connected</Badge>;
                              }
                              if (s === 'error') {
                                return <Badge variant="destructive">Error</Badge>;
                              }
                              return <Badge variant="secondary">Disconnected</Badge>;
                            })()}
                          </div>
                        ) : (
                          <div className="flex items-center justify-between py-2 border-b border-border/40">
                            <span className="text-muted-foreground">Last Update:</span>
                            <span className="text-foreground font-bold">
                              {selectedAsset.tag?.lastSeen
                                ? new Date(selectedAsset.tag.lastSeen).toLocaleString()
                                : (selectedAsset.updatedAt ? new Date(selectedAsset.updatedAt).toLocaleString() : '--')
                              }
                            </span>
                          </div>
                        )}
                        {!selectedAsset.type.startsWith('AGENT_') && selectedAsset.tagId && (
                          <div className="flex items-center justify-between py-1">
                            <span className="text-muted-foreground font-semibold">Device Address:</span>
                            <span className="font-mono text-foreground font-bold flex items-center gap-1.5">
                              <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
                              {selectedAsset.tagId}
                            </span>
                          </div>
                        )}
                        {description && (
                          <div className="pt-2">
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Description / Notes</p>
                            <p className="text-foreground mt-1 text-[11px] font-medium leading-relaxed bg-secondary/20 p-2.5 rounded-lg border border-border/40">
                              {description}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* AGENT CONNECTION ATTRIBUTES (For Agents only) */}
                    {selectedAsset.type.startsWith('AGENT_') && Object.keys(customFields).filter((k) => k !== 'notes').length > 0 && (
                      <Card className="border border-border/80">
                        <CardHeader className="py-2.5 px-4 bg-secondary/20 border-b border-border/50">
                          <CardTitle className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                            Connection Parameters
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 text-xs font-semibold space-y-3">
                          {Object.entries(customFields)
                            .filter(([key]) => key !== 'notes')
                            .map(([key, value]) => (
                              <div key={key} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0 last:pb-0">
                                <span className="text-muted-foreground capitalize font-bold">
                                  {key.replace(/([A-Z])/g, ' $1').trim()}
                                </span>
                                <span className="font-mono text-foreground text-right">
                                  {key === 'password' ? '••••••••' : String(value)}
                                </span>
                              </div>
                            ))}
                        </CardContent>
                      </Card>
                    )}

                    {/* ASSET-LEVEL INGESTION CARD */}
                    {!selectedAsset.type.startsWith('AGENT_') && mqttAgentId && (
                      <Card className="border border-border/80">
                        <CardHeader className="py-2.5 px-4 bg-secondary/20 border-b border-border/50">
                          <CardTitle className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                            Asset-Level Ingestion Settings
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 text-xs font-semibold space-y-3">
                          <div className="flex items-center justify-between py-2 border-b border-border/40">
                            <span className="text-muted-foreground">Linked Agent:</span>
                            <span className="font-mono text-foreground">
                              {assets.find(a => a.id === mqttAgentId)?.name || 'Linked'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between py-2 border-b border-border/40">
                            <span className="text-muted-foreground">Topic:</span>
                            <span className="font-mono text-foreground">{mqttTopic || '--'}</span>
                          </div>
                          {mqttDecodeFunctionCode && (
                            <div className="pt-2">
                              <span className="text-muted-foreground block font-bold text-[10px] uppercase tracking-wider mb-1">Payload JS Decoder Script</span>
                              <pre className="text-[10px] bg-black/60 p-3 rounded-lg overflow-x-auto text-emerald-400 font-mono max-h-36 max-w-full">
                                {mqttDecodeFunctionCode}
                              </pre>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* ATTRIBUTES VIEW CARD (For physical assets) */}
                    {!selectedAsset.type.startsWith('AGENT_') && (
                      <Card className="border border-border/80">
                        <CardHeader className="py-2.5 px-4 bg-secondary/20 border-b border-border/50">
                          <CardTitle className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                            Attributes
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 text-xs font-semibold divide-y divide-border/45 max-h-[500px] overflow-y-auto pr-1 select-text scrollbar-thin pb-4">
                          {activeAttributes.length === 0 ? (
                            <div className="p-6 text-center text-muted-foreground/65 italic font-normal">
                              No attributes registered for this asset.
                            </div>
                          ) : (
                            <>
                              {activeAttributes.map((attr: any, idx: number) => {
                                const linkedAgent = assets.find(a => a.id === attr.mqttAgentId);
                                return (
                                  <div key={idx} className="p-3.5 flex items-center justify-between hover:bg-secondary/15 transition-all">
                                    <div>
                                      <div className="flex items-center gap-1.5">
                                        <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">{attr.name}</p>
                                        <Badge variant="outline" className="text-[8px] px-1 py-0 font-normal border-border/50 text-muted-foreground/75">
                                          {attr.dataType}
                                        </Badge>
                                        {linkedAgent && (
                                          <Badge variant="outline" className="text-[8px] px-1 py-0 font-bold border-primary/20 text-primary bg-primary/5">
                                            MQTT Link
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-sm font-bold text-foreground mt-0.5">
                                        {attr.value !== undefined && attr.value !== null && attr.value !== '' ? String(attr.value) : '--'}{' '}
                                        {attr.unit && <span className="text-[10.5px] text-muted-foreground/80 font-normal">{attr.unit}</span>}
                                      </p>
                                      <p className="text-[9px] text-muted-foreground/75 mt-0.5 font-normal">
                                        Last Update: {attr.lastUpdated ? new Date(attr.lastUpdated).toLocaleString() : '--'}
                                      </p>
                                    </div>
                                    {linkedAgent && (
                                      <div className="text-[9px] text-muted-foreground font-mono text-right space-y-0.5">
                                        <p className="max-w-[140px] truncate" title={attr.mqttTopic}>Topic: {attr.mqttTopic}</p>
                                        {attr.mqttDecodeFunctionCode && <p className="text-primary flex items-center justify-end gap-1"><Code className="h-3 w-3" /> JS Decoder Active</p>}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                              {/* Spacing element at the bottom to prevent list element cutoff */}
                              <div className="h-10 bg-transparent w-full" />
                            </>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  {/* Right Column: Location, History */}
                  <div className="w-full lg:w-80 shrink-0 space-y-5">

                    {/* LOCATION Card */}
                    <Card className="border border-border/80 overflow-hidden">
                      <CardHeader className="py-2.5 px-4 bg-secondary/20 border-b border-border/50">
                        <CardTitle className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center justify-between">
                          <span>Location</span>
                          <span className="font-mono font-normal tracking-normal text-[9px] text-muted-foreground">
                            {selectedAsset.latitude ? `${parseFloat(String(selectedAsset.latitude)).toFixed(4)}, ${parseFloat(String(selectedAsset.longitude)).toFixed(4)}` : 'No coordinates'}
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 space-y-4 text-xs font-semibold">
                        {selectedAsset.latitude && selectedAsset.longitude ? (
                          <>
                            <div className="flex items-center gap-2 p-2 bg-secondary/35 border border-border/60 rounded-lg">
                              <Globe className="h-4 w-4 text-primary shrink-0" />
                              <div className="min-w-0">
                                <p className="text-[10px] text-muted-foreground">Coordinates</p>
                                <p className="font-mono text-[10px] truncate text-foreground">
                                  {selectedAsset.latitude}, {selectedAsset.longitude}
                                </p>
                              </div>
                            </div>
                            <div ref={viewMapRef} className="h-44 w-full bg-secondary/15 rounded-xl border border-border overflow-hidden z-10"></div>
                          </>
                        ) : (
                          <div className="py-8 text-center text-muted-foreground font-medium space-y-2">
                            <MapPin className="h-5 w-5 text-muted-foreground/45 mx-auto" />
                            <p>No map coordinates mapped to this asset.</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* HISTORY Card */}
                    {!selectedAsset.type.startsWith('AGENT_') && selectedAsset.type !== 'CITY' && selectedAsset.type !== 'BUILDING' && (
                      <Card className="border border-border/80">
                        <CardHeader className="py-3 px-4 bg-secondary/20 border-b border-border/50 flex flex-col items-start gap-3 w-full overflow-hidden">
                          <CardTitle className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground w-full">
                            History
                          </CardTitle>
                          <div className="flex flex-wrap items-end gap-2 w-full">
                            <div className="flex flex-col gap-1.5 flex-1 min-w-[130px]">
                              <label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Attribute</label>
                              <select
                                value={selectedHistoryAttr}
                                onChange={(e) => setSelectedHistoryAttr(e.target.value)}
                                className="bg-secondary/20 text-foreground border border-border/40 px-3 py-2 rounded-md text-sm font-semibold focus:outline-none capitalize w-full"
                              >
                                {activeAttributes.map((a: any) => (
                                  <option key={a.name} value={a.name}>{a.name} {a.unit ? `(${a.unit})` : ''}</option>
                                ))}
                              </select>
                            </div>
                            
                            <div className="flex flex-col gap-1.5 flex-1 min-w-[90px]">
                              <label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Timeframe</label>
                              <select
                                value={selectedHistoryTimeframe}
                                onChange={(e) => setSelectedHistoryTimeframe(e.target.value)}
                                className="bg-secondary/20 text-foreground border border-border/40 px-3 py-2 rounded-md text-sm font-semibold focus:outline-none w-full"
                              >
                                <option value="1h">Hour</option>
                                <option value="1d">Day</option>
                                <option value="1w">Week</option>
                                <option value="1m">Month</option>
                              </select>
                            </div>
                            
                            <div className="flex flex-col gap-1.5 w-full mt-1">
                              <label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Ending</label>
                              <div className="flex items-center gap-1 bg-secondary/20 border border-border/40 rounded-md px-2 py-0.5 focus-within:ring-1 focus-within:ring-primary/50 w-full overflow-hidden">
                                <Input 
                                  type="datetime-local" 
                                  value={selectedHistoryEndDate}
                                  onChange={(e) => setSelectedHistoryEndDate(e.target.value)}
                                  className="bg-transparent border-0 focus-visible:ring-0 text-sm font-semibold h-8 p-0 flex-1 min-w-0"
                                />
                                <div className="flex items-center ml-1 border border-border/50 rounded bg-background overflow-hidden h-7 shrink-0">
                                  <button onClick={() => {
                                    const d = new Date(selectedHistoryEndDate);
                                    if(selectedHistoryTimeframe === '1h') d.setHours(d.getHours() - 1);
                                    else if(selectedHistoryTimeframe === '1d') d.setDate(d.getDate() - 1);
                                    else if(selectedHistoryTimeframe === '1w') d.setDate(d.getDate() - 7);
                                    else if(selectedHistoryTimeframe === '1m') d.setMonth(d.getMonth() - 1);
                                    d.setMinutes(0,0,0);
                                    setSelectedHistoryEndDate(d.toISOString().slice(0, 16));
                                  }} className="px-2 hover:bg-secondary/50 text-muted-foreground font-bold text-xs h-full border-r border-border/50 flex items-center justify-center">&lt;</button>
                                  <button onClick={() => {
                                    const d = new Date(selectedHistoryEndDate);
                                    if(selectedHistoryTimeframe === '1h') d.setHours(d.getHours() + 1);
                                    else if(selectedHistoryTimeframe === '1d') d.setDate(d.getDate() + 1);
                                    else if(selectedHistoryTimeframe === '1w') d.setDate(d.getDate() + 7);
                                    else if(selectedHistoryTimeframe === '1m') d.setMonth(d.getMonth() + 1);
                                    d.setMinutes(0,0,0);
                                    setSelectedHistoryEndDate(d.toISOString().slice(0, 16));
                                  }} className="px-2 hover:bg-secondary/50 text-muted-foreground font-bold text-xs h-full border-r border-border/50 flex items-center justify-center">&gt;</button>
                                  <button onClick={() => {
                                    const d = new Date();
                                    d.setMinutes(0,0,0);
                                    setSelectedHistoryEndDate(d.toISOString().slice(0, 16));
                                  }} className="px-2 hover:bg-secondary/50 text-muted-foreground font-bold text-xs h-full flex items-center justify-center">&gt;&gt;</button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="p-4 text-xs font-semibold">
                          {isLoadingHistory ? (
                            <div className="h-32 w-full flex items-center justify-center bg-black/20 rounded-lg border border-border/30 text-muted-foreground/60 text-[10px] italic">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2" />
                              Loading trends...
                            </div>
                          ) : historyData.length === 0 ? (
                            <div className="h-32 w-full flex flex-col items-center justify-center bg-black/5 rounded-lg border border-border/30 text-muted-foreground/60 text-[10px] italic p-4 text-center">
                              No history data found for this period.
                            </div>
                          ) : (
                            <div className="h-[250px] w-full mt-4 -ml-4 pr-4">
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={historyData.map(d => ({ 
                                  time: new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
                                  fullTime: new Date(d.timestamp).toLocaleString(),
                                  value: d.value 
                                }))} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                  <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#eab308" stopOpacity={0.8}/>
                                      <stop offset="95%" stopColor="#eab308" stopOpacity={0}/>
                                    </linearGradient>
                                  </defs>
                                  <XAxis 
                                    dataKey="time" 
                                    tickLine={false} 
                                    axisLine={{ stroke: '#e5e7eb' }}
                                    tick={{ fontSize: 10, fill: '#6b7280' }} 
                                    minTickGap={30}
                                  />
                                  <YAxis 
                                    tickLine={false} 
                                    axisLine={{ stroke: '#e5e7eb' }}
                                    tick={{ fontSize: 10, fill: '#6b7280' }}
                                  />
                                  <RechartsTooltip 
                                    content={({ active, payload }) => {
                                      if (active && payload && payload.length) {
                                        return (
                                          <div className="bg-[#2d2d2d] text-white p-2 rounded shadow-lg text-xs font-semibold flex flex-col gap-1 border-0">
                                            <p className="text-[#a1a1aa]">{payload[0].payload.fullTime}</p>
                                            <p className="text-sm">{payload[0].value} {activeAttributes.find((a: any) => a.name === selectedHistoryAttr)?.unit || ''}</p>
                                          </div>
                                        );
                                      }
                                      return null;
                                    }}
                                  />
                                  <Area 
                                    type="monotone" 
                                    dataKey="value" 
                                    stroke="#eab308" 
                                    strokeWidth={2}
                                    fillOpacity={1} 
                                    fill="url(#colorValue)" 
                                    dot={{ r: 3, fill: "#eab308", strokeWidth: 0 }}
                                    activeDot={{ r: 5, fill: "#eab308", stroke: "#fff", strokeWidth: 2 }}
                                  />
                                </AreaChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-xs text-muted-foreground gap-3">
                <FileText className="h-8 w-8 text-muted-foreground/35" />
                <div>
                  <p className="font-bold">No Asset Selected</p>
                  <p className="text-[11px] opacity-75 mt-0.5">Select an asset from the tree or click '+' to register a new one.</p>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* ==================== ADD ASSET & AGENT POPUP MODAL ==================== */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/35 flex items-center justify-center p-4">
          <Card className="w-full max-w-3xl h-[550px] flex flex-col overflow-hidden border border-border shadow-2xl">

            {/* Modal Title bar */}
            <div className="bg-secondary/40 border-b border-border px-4 py-3 flex items-center justify-between shrink-0">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Plus className="h-4.5 w-4.5 text-primary" />
                Add Asset
              </span>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Split panel layout */}
            <div className="flex-1 flex overflow-hidden">

              {/* Left sidebar selector inside modal */}
              <div className="w-64 border-r border-border bg-card flex flex-col overflow-y-auto shrink-0 select-none">

                {/* Category togglers */}
                <div className="grid grid-cols-2 p-2 gap-1.5 border-b border-border bg-secondary/15">
                  <button
                    type="button"
                    onClick={() => {
                      setAddModalTab('AGENT');
                      setAddModalSelectedType('AGENT_MQTT_TELTONIKA');
                      setCustomFields({});
                    }}
                    className={`py-1.5 text-[10px] uppercase tracking-wider font-bold rounded border transition-all cursor-pointer ${addModalTab === 'AGENT'
                      ? 'bg-primary/10 border-primary/20 text-primary font-bold shadow-sm'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    Agents
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddModalTab('ASSET');
                      setAddModalSelectedType('CITY');
                      setCustomFields({});
                    }}
                    className={`py-1.5 text-[10px] uppercase tracking-wider font-bold rounded border transition-all cursor-pointer ${addModalTab === 'ASSET'
                      ? 'bg-primary/10 border-primary/20 text-primary font-bold shadow-sm'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    Assets
                  </button>
                </div>

                {/* Sub-type list */}
                <div className="p-2 space-y-1">
                  {currentAddModalTypes.map((item) => {
                    const isSelected = addModalSelectedType === item.key;
                    const Icon = item.icon;
                    return (
                      <button
                        type="button"
                        key={item.key}
                        onClick={() => {
                          setAddModalSelectedType(item.key);
                          setCustomFields({});
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all border ${isSelected
                          ? 'bg-secondary border-border text-foreground font-bold'
                          : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                          }`}
                      >
                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right creation form editor */}
              <form onSubmit={handleCreateAsset} className="flex-1 flex flex-col justify-between overflow-hidden">
                <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs font-semibold">
                  <div className="flex items-center gap-2 text-foreground font-bold border-b pb-2">
                    <span className="uppercase tracking-wider">
                      {addModalTab === 'AGENT' ? 'Agent Protocol' : 'Asset Type'}:{' '}
                    </span>
                    <Badge variant="outline" className="font-mono text-[10px] px-2 py-0.5">
                      {currentAddModalTypes.find((t) => t.key === addModalSelectedType)?.label || addModalSelectedType}
                    </Badge>
                  </div>

                  {(addModalTab === 'AGENT' ? quota?.isAgentLimitReached : quota?.isAssetLimitReached) && (
                    <div className="p-3 rounded-xl bg-destructive/15 border border-destructive/40 text-destructive text-xs font-bold flex items-center gap-2">
                      <span className="text-sm">⚠️</span>
                      <span>
                        Quota capacity {addModalTab === 'AGENT' ? 'Agent' : 'Asset'} has reached the maximum limit ({addModalTab === 'AGENT' ? `${quota?.agentCount}/${quota?.agentLimit}` : `${quota?.assetCount}/${quota?.assetLimit}`}). Contact the administrator to upgrade your license.
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-muted-foreground">Name *</label>
                      <Input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="New Asset"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-muted-foreground">Parent Asset</label>
                      <select
                        value={parentId}
                        onChange={(e) => setParentId(e.target.value)}
                        className="w-full bg-secondary/35 border border-border px-3 py-2 rounded-lg text-foreground focus:outline-none focus:border-primary text-xs font-semibold"
                      >
                        <option value="">(None / Root Asset)</option>
                        {assets.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({a.type})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {addModalTab === 'ASSET' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-muted-foreground">Device Address (tagId / Node ID)</label>
                        <Input
                          type="text"
                          value={tagId}
                          onChange={(e) => setTagId(e.target.value)}
                          placeholder="e.g. node-439201 or 9023206"
                        />
                      </div>
                    </div>
                  )}

                  {/* Dynamic Connection Credentials Form (For Agents inside creation modal) */}
                  {addModalTab === 'AGENT' && currentFieldsConfig.length > 0 && (
                    <div className="space-y-3 pt-3 border-t border-border/60">
                      <span className="text-[10px] text-primary uppercase font-bold tracking-wider">Required Connection Credentials</span>
                      <div className="grid grid-cols-2 gap-3.5">
                        {currentFieldsConfig.map((field) => (
                          <div key={field.key} className="space-y-1">
                            <label className="text-muted-foreground">{field.label}</label>
                            {field.type === 'select' ? (
                              <select
                                value={customFields[field.key] || ''}
                                onChange={(e) => handleCustomFieldChange(field.key, e.target.value)}
                                className="w-full bg-secondary/35 border border-border px-3 py-2 rounded-lg text-foreground focus:outline-none focus:border-primary text-xs font-semibold"
                              >
                                <option value="">Select option...</option>
                                {field.options?.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <Input
                                type={field.type || 'text'}
                                value={customFields[field.key] || ''}
                                onChange={(e) => handleCustomFieldChange(field.key, e.target.value)}
                                placeholder={field.placeholder}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>

                {/* Footer buttons */}
                <div className="p-3 bg-secondary/10 border-t border-border flex items-center justify-end gap-2.5 shrink-0">
                  <Button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    variant="outline"
                    className="h-8.5 font-bold uppercase tracking-wider text-[10px]"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting || (addModalTab === 'AGENT' ? !!quota?.isAgentLimitReached : !!quota?.isAssetLimitReached)}
                    className="h-8.5 font-bold uppercase tracking-wider text-[10px]"
                  >
                    {(addModalTab === 'AGENT' ? quota?.isAgentLimitReached : quota?.isAssetLimitReached)
                      ? 'Quota Limit Reached'
                      : isSubmitting
                        ? 'Adding...'
                        : 'Add'}
                  </Button>
                </div>
              </form>
            </div>

          </Card>
        </div>
      )}

      {/* FLOATING TOAST NOTIFICATIONS */}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2.5 max-w-sm w-full">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`p-3.5 rounded-xl border shadow-xl flex items-center justify-between text-xs font-semibold animate-in slide-in-from-bottom duration-300 ${t.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : t.type === 'error'
                ? 'bg-red-500/10 border-red-500/30 text-red-400'
                : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
              }`}
          >
            <span>{t.message}</span>
            <button
              onClick={() => setToasts((prev) => prev.filter((toast) => toast.id !== t.id))}
              className="ml-3 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* DELETE CONFIRMATION DIALOG MODAL */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl p-5 w-full max-w-sm shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 text-xs font-semibold">
            <div className="text-sm font-bold text-foreground">Delete Asset</div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to delete asset <span className="font-bold text-foreground">"{selectedAsset?.name}"</span>? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={executeDeleteAsset}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* LEAFLET MAP PICKER MODAL */}
      {mapPickerOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-secondary/20">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Pilih Titik Koordinat GPS (WGS84)</h3>
                  <p className="text-[10.5px] text-muted-foreground">Klik pada peta atau geser pin untuk menentukan lokasi aset</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMapPickerOpen(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body / Leaflet Map */}
            <div className="p-4 space-y-3">
              <div
                ref={mapPickerContainerRef}
                className="w-full h-80 bg-secondary/20 rounded-xl border border-border overflow-hidden relative z-10"
              />

              {/* Selected Coords info bar */}
              <div className="grid grid-cols-2 gap-3 bg-secondary/30 border border-border/80 p-3 rounded-xl">
                <div>
                  <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block">Latitude</span>
                  <span className="font-mono text-xs font-bold text-foreground">{mapPickerCoords.lat.toFixed(6)}</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block">Longitude</span>
                  <span className="font-mono text-xs font-bold text-foreground">{mapPickerCoords.lng.toFixed(6)}</span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 bg-secondary/15 border-t border-border flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setMapPickerOpen(false)}
                className="h-8.5 text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (mapPickerTargetIndex !== null) {
                    const coordString = `${mapPickerCoords.lat.toFixed(6)}, ${mapPickerCoords.lng.toFixed(6)}`;
                    setAttributes((prev) =>
                      prev.map((a, i) => (i === mapPickerTargetIndex ? { ...a, value: coordString } : a))
                    );
                    setLatitude(mapPickerCoords.lat.toFixed(6));
                    setLongitude(mapPickerCoords.lng.toFixed(6));
                  }
                  setMapPickerOpen(false);
                }}
                className="h-8.5 text-xs font-bold gap-1.5"
              >
                <MapPin className="h-3.5 w-3.5" />
                Gunakan Titik Koordinat Ini
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
