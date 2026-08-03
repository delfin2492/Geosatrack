'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { 
  Folder, 
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
  Cpu
} from 'lucide-react';

// OpenRemote custom attributes mapping based on Agent/Asset type
const attributeFieldsLookup: Record<string, { label: string; key: string; placeholder: string; type?: string; options?: string[] }[]> = {
  AGENT_MQTT: [
    { label: 'MQTT Broker Host', key: 'host', placeholder: 'e.g. localhost' },
    { label: 'MQTT Port', key: 'port', placeholder: 'e.g. 1883', type: 'number' },
    { label: 'Topic Prefix Filter', key: 'topicPrefix', placeholder: 'e.g. wirepas/gateway/#' },
    { label: 'Client ID Prefix', key: 'clientId', placeholder: 'e.g. geomesh-receiver' }
  ],
  AGENT_HTTP: [
    { label: 'Endpoint Webhook URL', key: 'url', placeholder: 'e.g. http://localhost:4000/api/webhooks' },
    { label: 'Authorization Header Bearer', key: 'token', placeholder: 'e.g. secret-token-xyz' },
    { label: 'HTTP Method Pathway', key: 'method', placeholder: 'POST', type: 'select', options: ['POST', 'GET', 'PUT'] }
  ],
  AGENT_BLE: [
    { label: 'Bluetooth HCI Driver Interface', key: 'interface', placeholder: 'e.g. hci0' },
    { label: 'Scan Interval Range (seconds)', key: 'interval', placeholder: 'e.g. 5', type: 'number' }
  ],
  CITY: [
    { label: 'Country Location', key: 'country', placeholder: 'e.g. Indonesia' },
    { label: 'City Region / State', key: 'region', placeholder: 'e.g. DKI Jakarta' }
  ],
  BUILDING: [
    { label: 'Street Address', key: 'address', placeholder: 'e.g. Jl. HR Rasuna Said No.X' },
    { label: 'Total Floor Count', key: 'floors', placeholder: 'e.g. 3', type: 'number' }
  ],
  LIGHT: [
    { label: 'Smart Light Switch MAC', key: 'switchMac', placeholder: 'e.g. sw-00:11:22' },
    { label: 'Initial Power State', key: 'powerState', placeholder: 'OFF', type: 'select', options: ['OFF', 'ON'] },
    { label: 'Target Brightness Level (%)', key: 'brightness', placeholder: '100', type: 'number' }
  ],
  ENVIRONMENT: [
    { label: 'Target Temperature threshold (°C)', key: 'tempThreshold', placeholder: 'e.g. 24.5', type: 'number' },
    { label: 'Target Humidity threshold (%)', key: 'humidityThreshold', placeholder: 'e.g. 50.0', type: 'number' }
  ],
  WEATHER: [
    { label: 'Wind Speed Sensor Identifier', key: 'windSensor', placeholder: 'e.g. ws-01' },
    { label: 'Barometric Target Pressure (hPa)', key: 'barometerTarget', placeholder: 'e.g. 1013.2', type: 'number' }
  ],
  ANCHOR: [
    { label: 'Anchor Hardware Address', key: 'anchorId', placeholder: 'e.g. anchor-00:11:22' },
    { label: 'Signal Transmitter Power (dBm)', key: 'txPower', placeholder: 'e.g. -12', type: 'number' }
  ],
  THINGS: [
    { label: 'Device Manufacturer Vendor', key: 'vendor', placeholder: 'e.g. STMicroelectronics' },
    { label: 'Device Serial Number', key: 'serial', placeholder: 'e.g. SN-09948210' }
  ],
  FORKLIFT: [
    { label: 'Vehicle Code / Fleet ID', key: 'vehicleCode', placeholder: 'e.g. TF-01' },
    { label: 'Assigned Operator Name', key: 'operator', placeholder: 'e.g. Budi Santoso' },
    { label: 'Battery Capacity Limit (V)', key: 'batteryLimit', placeholder: 'e.g. 3.6', type: 'number' }
  ],
  RACK: [
    { label: 'Rack Section Code', key: 'rackCode', placeholder: 'e.g. R-ALPHA-1' },
    { label: 'Total Shelf Levels Count', key: 'shelves', placeholder: 'e.g. 4', type: 'number' },
    { label: 'Maximum Shelf Load Limit (kg)', key: 'maxLoad', placeholder: 'e.g. 1500', type: 'number' }
  ],
  SHIP: [
    { label: 'IMO Registered Number', key: 'imo', placeholder: 'e.g. IMO 9238472' },
    { label: 'Vessel Signal Callsign', key: 'callsign', placeholder: 'e.g. YB-812' },
    { label: 'Primary Cargo Load Type', key: 'cargoType', placeholder: 'e.g. Dry Container / Refrigerator' }
  ],
  DOOR: [
    { label: 'Logical Door Code ID', key: 'doorCode', placeholder: 'e.g. DOOR-W1' },
    { label: 'Contact Sensor Node ID', key: 'sensorNodeId', placeholder: 'e.g. node-439202' },
    { label: 'Initial State', key: 'initialState', placeholder: 'CLOSED', type: 'select', options: ['CLOSED', 'OPEN'] }
  ],
  ROOM: [
    { label: 'Room Code Number', key: 'roomNumber', placeholder: 'e.g. 302' },
    { label: 'Initial Occupancy Status', key: 'occupancy', placeholder: 'EMPTY', type: 'select', options: ['EMPTY', 'OCCUPIED'] }
  ],
  TAG: [
    { label: 'Wirepas Node Identifier', key: 'nodeId', placeholder: 'e.g. node-439201' },
    { label: 'Battery Limit (V)', key: 'batteryV', placeholder: 'e.g. 3.0', type: 'number' }
  ],
  MACHINE: [
    { label: 'Factory Equipment Code', key: 'machineCode', placeholder: 'e.g. CNC-M01' },
    { label: 'Initial Operational State', key: 'machineState', placeholder: 'STOPPED', type: 'select', options: ['STOPPED', 'RUNNING', 'MAINTENANCE'] }
  ]
};

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

export default function AssetsPage() {
  const { tenantId, token } = useAuth();
  const { assets, setAssets } = useSocket();

  // Search/Filter state
  const [searchQuery, setSearchQuery] = useState('');

  // Mode states: 'view' | 'edit'
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  // Selection states
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('FORKLIFT');
  const [parentId, setParentId] = useState('');
  const [tagId, setTagId] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [customFields, setCustomFields] = useState<Record<string, string>>({});

  // Add Asset Popup modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalTab, setAddModalTab] = useState<'AGENT' | 'ASSET'>('AGENT');
  const [addModalSelectedType, setAddModalSelectedType] = useState('AGENT_MQTT');

  // Info/Message states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedHistoryAttr, setSelectedHistoryAttr] = useState('Temperature');

  const selectedAsset = assets.find((a) => a.id === selectedAssetId);

  const refreshAssets = async () => {
    if (!tenantId) return;
    try {
      const headers: Record<string, string> = { 'x-tenant-id': tenantId };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`http://localhost:4000/api/assets`, { headers });
      if (res.ok) {
        const data = await res.json();
        setAssets(data);
      }
    } catch (e) {
      console.error('Failed to refresh assets:', e);
    }
  };

  useEffect(() => {
    if (tenantId) {
      refreshAssets();
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
    setTagId(asset.tagId || '');
    setLatitude(asset.latitude !== null && asset.latitude !== undefined ? String(asset.latitude) : '');
    setLongitude(asset.longitude !== null && asset.longitude !== undefined ? String(asset.longitude) : '');
    
    // Parse custom fields from description JSON
    try {
      if (asset.description && asset.description.startsWith('{')) {
        const parsed = JSON.parse(asset.description);
        setCustomFields(parsed);
        setDescription(parsed.notes || '');
      } else {
        setCustomFields({});
        setDescription(asset.description || '');
      }
    } catch (e) {
      setCustomFields({});
      setDescription(asset.description || '');
    }
    setMode('view');
  };

  const handleOpenCreate = () => {
    setName('');
    setDescription('');
    setParentId('');
    setTagId('');
    setLatitude('');
    setLongitude('');
    setCustomFields({});
    setAddModalSelectedType('AGENT_MQTT');
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

      // Package custom attributes with notes
      const serializedDescription = JSON.stringify({
        ...customFields,
        notes: description
      });

      const res = await fetch(`http://localhost:4000/api/assets`, {
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
    } catch (err: any) {
      alert(err.message || 'Error creating asset.');
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

      // Package custom attributes with notes
      const serializedDescription = JSON.stringify({
        ...customFields,
        notes: description
      });

      const res = await fetch(`http://localhost:4000/api/assets/${selectedAssetId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          name,
          type,
          parentId: parentId || null,
          tagId: tagId || null,
          latitude: latitude ? parseFloat(latitude) : null,
          longitude: longitude ? parseFloat(longitude) : null,
          description: serializedDescription
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to update asset.');
      }

      await refreshAssets();
      setMode('view');
    } catch (err: any) {
      alert(err.message || 'Error updating asset.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAsset = async () => {
    if (!selectedAssetId || !tenantId || !selectedAsset) return;
    if (!window.confirm(`Are you sure you want to delete asset "${selectedAsset.name}"?`)) return;

    try {
      const headers: Record<string, string> = { 'x-tenant-id': tenantId };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`http://localhost:4000/api/assets/${selectedAssetId}`, {
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
    } catch (err: any) {
      alert(err.message || 'Error deleting asset.');
    }
  };

  const handleCustomFieldChange = (key: string, value: string) => {
    setCustomFields((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  // Filter based on search query
  const filteredAssets = assets.filter((a) =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group list of agents vs assets in the popup modal
  const agentTypes = [
    { key: 'AGENT_MQTT', label: 'MQTT Gateway', icon: Sliders },
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
    { key: 'MACHINE', label: 'Machine', icon: Sliders }
  ];

  const currentAddModalTypes = addModalTab === 'AGENT' ? agentTypes : assetTypes;
  const currentFieldsConfig = attributeFieldsLookup[addModalSelectedType] || [];
  const currentEditFieldsConfig = attributeFieldsLookup[type] || [];

  // Recursive render function for the tree
  const renderAssetNode = (node: TreeAsset, level = 0) => {
    const isSelected = selectedAssetId === node.id;
    const isAgent = node.type.startsWith('AGENT_');
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.id} className="space-y-1">
        <div
          onClick={() => handleSelectAsset(node)}
          style={{ paddingLeft: `${level * 14 + 10}px` }}
          className={`flex items-center gap-2 py-1.5 pr-2.5 rounded cursor-pointer transition-all border ${
            isSelected 
              ? 'bg-primary/10 border-primary/20 text-primary font-bold shadow-sm' 
              : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/40'
          }`}
        >
          {isAgent ? (
            <Cpu className="h-3.5 w-3.5 shrink-0 text-muted-foreground/75" />
          ) : (
            <Boxes className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
          )}
          <span className="truncate">{node.name}</span>
          {hasChildren && (
            <Badge variant="secondary" className="font-mono text-[9px] ml-auto px-1 py-0">
              {node.children.length}
            </Badge>
          )}
        </div>
        {hasChildren && (
          <div className="space-y-1">
            {node.children.map((child) => renderAssetNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full w-full gap-5">
      
      {/* LEFT COLUMN: ASSETS SIDEBAR TREE (OpenRemote Inspired) */}
      <Card className="w-80 flex flex-col shrink-0 overflow-hidden border border-border">
        <div className="bg-secondary/40 border-b border-border p-3 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
            <Boxes className="h-4.5 w-4.5 text-primary" />
            Assets
          </span>
          <div className="flex items-center gap-1">
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
              onClick={handleOpenCreate}
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
              title="Add Agent or Asset"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

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
          <form onSubmit={handleUpdateAsset} className="flex-1 flex flex-col justify-between">
            <CardHeader className="py-4 flex flex-row items-center justify-between border-b bg-secondary/15">
              <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                <Sliders className="h-4.5 w-4.5 text-primary" />
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
              <div className="grid grid-cols-2 gap-4">
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-muted-foreground">Position Latitude</label>
                  <Input
                    type="number"
                    step="0.000001"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-muted-foreground">Position Longitude</label>
                  <Input
                    type="number"
                    step="0.000001"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <label className="text-muted-foreground">Linked Sensor Node ID (Optional)</label>
                  <Input
                    type="text"
                    value={tagId}
                    onChange={(e) => setTagId(e.target.value)}
                    placeholder="e.g. node-439201"
                  />
                </div>
              </div>

              {/* Dynamic Custom Attributes Forms */}
              {currentEditFieldsConfig.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-border/60">
                  <span className="text-[10px] text-primary uppercase font-bold tracking-wider">Required Type Attributes</span>
                  <div className="grid grid-cols-2 gap-4">
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

            <div className="p-4 border-t border-border flex items-center justify-end gap-3 bg-secondary/10">
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
              <div className="flex-1 flex flex-col">
                <div className="border-b border-border p-4 flex items-center justify-between bg-secondary/15 shrink-0">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <FileText className="h-4.5 w-4.5 text-muted-foreground" />
                      {selectedAsset.name}
                    </h3>
                    <p className="text-[10px] text-muted-foreground">
                      Created: {selectedAsset.createdAt ? new Date(selectedAsset.createdAt).toLocaleString() : '--'}
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      setName(selectedAsset.name);
                      setType(selectedAsset.type || 'FORKLIFT');
                      setParentId(selectedAsset.parentId || '');
                      setTagId(selectedAsset.tagId || '');
                      setLatitude(selectedAsset.latitude !== null && selectedAsset.latitude !== undefined ? String(selectedAsset.latitude) : '');
                      setLongitude(selectedAsset.longitude !== null && selectedAsset.longitude !== undefined ? String(selectedAsset.longitude) : '');
                      
                      try {
                        if (selectedAsset.description && selectedAsset.description.startsWith('{')) {
                          const parsed = JSON.parse(selectedAsset.description);
                          setCustomFields(parsed);
                          setDescription(parsed.notes || '');
                        } else {
                          setCustomFields({});
                          setDescription(selectedAsset.description || '');
                        }
                      } catch (e) {
                        setCustomFields({});
                        setDescription(selectedAsset.description || '');
                      }
                      setMode('edit');
                    }}
                    variant="outline"
                    className="flex items-center gap-1.5 h-8 text-[11px] font-bold"
                  >
                    <Edit className="h-3.5 w-3.5" />
                    Modify
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 flex flex-col lg:flex-row gap-6">
                  {/* Left Column: Info, Config & Custom Attributes */}
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
                        <div className="flex items-center justify-between py-2 border-b border-border/40">
                          <span className="text-muted-foreground">Active Status:</span>
                          <Badge variant={selectedAsset.status === 'moving' ? 'success' : 'secondary'} className="capitalize">
                            {selectedAsset.status}
                          </Badge>
                        </div>
                        {selectedAsset.tagId && (
                          <div className="flex items-center justify-between py-1">
                            <span className="text-muted-foreground font-semibold">Device Eui / Linked Tag:</span>
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

                    {/* CUSTOM ATTRIBUTES (From serialized JSON description) */}
                    {Object.keys(customFields).filter((k) => k !== 'notes').length > 0 && (
                      <Card className="border border-border/80">
                        <CardHeader className="py-2.5 px-4 bg-secondary/20 border-b border-border/50">
                          <CardTitle className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                            Configuration Attributes
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
                                <span className="font-mono text-foreground text-right">{String(value)}</span>
                              </div>
                            ))}
                        </CardContent>
                      </Card>
                    )}

                    {/* LIVE TELEMETRY ATTRIBUTES Card (Only if tag is linked) */}
                    <Card className="border border-border/80">
                      <CardHeader className="py-2.5 px-4 bg-secondary/20 border-b border-border/50">
                        <CardTitle className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                          Live Attributes
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0 text-xs font-semibold divide-y divide-border/45">
                        {selectedAsset.tag ? (
                          <>
                            <div className="p-3.5 flex items-center justify-between hover:bg-secondary/15 transition-all">
                              <div>
                                <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Temperature</p>
                                <p className="text-sm font-bold text-foreground mt-0.5">{selectedAsset.tag.temperature ?? '--'} °C</p>
                              </div>
                              <div className="text-[10px] text-muted-foreground font-mono">
                                Updated: {selectedAsset.tag.lastSeen ? new Date(selectedAsset.tag.lastSeen).toLocaleTimeString() : 'Now'}
                              </div>
                            </div>
                            <div className="p-3.5 flex items-center justify-between hover:bg-secondary/15 transition-all">
                              <div>
                                <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Humidity</p>
                                <p className="text-sm font-bold text-foreground mt-0.5">{selectedAsset.tag.humidity ?? '--'} %</p>
                              </div>
                              <div className="text-[10px] text-muted-foreground font-mono">
                                Updated: {selectedAsset.tag.lastSeen ? new Date(selectedAsset.tag.lastSeen).toLocaleTimeString() : 'Now'}
                              </div>
                            </div>
                            <div className="p-3.5 flex items-center justify-between hover:bg-secondary/15 transition-all">
                              <div>
                                <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Battery Voltage</p>
                                <p className="text-sm font-bold text-foreground mt-0.5">{selectedAsset.tag.battery ?? '--'} V</p>
                              </div>
                              <div className="text-[10px] text-muted-foreground font-mono">
                                Updated: {selectedAsset.tag.lastSeen ? new Date(selectedAsset.tag.lastSeen).toLocaleTimeString() : 'Now'}
                              </div>
                            </div>
                            <div className="p-3.5 flex items-center justify-between hover:bg-secondary/15 transition-all">
                              <div>
                                <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Link Signal RSSI</p>
                                <p className="text-sm font-bold text-foreground mt-0.5">{selectedAsset.tag.rssi ?? '--'} dBm</p>
                              </div>
                              <div className="text-[10px] text-muted-foreground font-mono">
                                Updated: {selectedAsset.tag.lastSeen ? new Date(selectedAsset.tag.lastSeen).toLocaleTimeString() : 'Now'}
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="p-8 text-center text-muted-foreground font-medium">
                            No active telemetry feed. Link an IoT sensor tag to fetch live attributes.
                          </div>
                        )}
                      </CardContent>
                    </Card>
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
                            <div className="h-32 bg-secondary/15 border border-border/60 rounded-xl relative flex items-center justify-center p-2 text-center text-muted-foreground text-[10px]">
                              <div className="space-y-1">
                                <MapPin className="h-5 w-5 text-primary mx-auto animate-bounce" />
                                <p className="font-bold">Coordinates Mapped</p>
                                <p className="text-[9px] opacity-75">Geographical Placement</p>
                              </div>
                            </div>
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
                    <Card className="border border-border/80">
                      <CardHeader className="py-2.5 px-4 bg-secondary/20 border-b border-border/50 flex flex-row items-center justify-between">
                        <CardTitle className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                          History
                        </CardTitle>
                        <select
                          value={selectedHistoryAttr}
                          onChange={(e) => setSelectedHistoryAttr(e.target.value)}
                          className="bg-transparent text-foreground focus:outline-none text-[10px] font-bold text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          <option value="Temperature">Temperature</option>
                          <option value="Battery">Battery</option>
                          <option value="RSSI">RSSI</option>
                        </select>
                      </CardHeader>
                      <CardContent className="p-4 text-xs font-semibold">
                        <div className="h-28 w-full bg-black/40 rounded-lg p-2 border border-border/30 relative flex flex-col justify-between">
                          <svg className="w-full h-16" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <path
                              d="M 0 80 Q 20 40 40 70 T 80 50 T 100 60"
                              fill="none"
                              stroke="rgba(var(--primary), 0.8)"
                              strokeWidth="2.5"
                            />
                          </svg>
                          <div className="flex justify-between text-[8px] text-muted-foreground font-mono pt-1.5 border-t border-border/30">
                            <span>10m ago</span>
                            <span>5m ago</span>
                            <span>Now</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
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
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-3xl h-[550px] flex flex-col overflow-hidden border border-border shadow-2xl">
            
            {/* Modal Title bar */}
            <div className="bg-secondary/40 border-b border-border px-4 py-3 flex items-center justify-between shrink-0">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Plus className="h-4.5 w-4.5 text-primary" />
                Add Asset
              </span>
              <button
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
                    onClick={() => {
                      setAddModalTab('AGENT');
                      setAddModalSelectedType('AGENT_MQTT');
                      setCustomFields({});
                    }}
                    className={`py-1.5 text-[10px] uppercase tracking-wider font-bold rounded border transition-all cursor-pointer ${
                      addModalTab === 'AGENT'
                        ? 'bg-primary/10 border-primary/20 text-primary font-bold shadow-sm'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Agents
                  </button>
                  <button
                    onClick={() => {
                      setAddModalTab('ASSET');
                      setAddModalSelectedType('CITY');
                      setCustomFields({});
                    }}
                    className={`py-1.5 text-[10px] uppercase tracking-wider font-bold rounded border transition-all cursor-pointer ${
                      addModalTab === 'ASSET'
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
                        key={item.key}
                        onClick={() => {
                          setAddModalSelectedType(item.key);
                          setCustomFields({});
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all border ${
                          isSelected
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

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-muted-foreground">Position Latitude</label>
                      <Input
                        type="number"
                        step="0.000001"
                        value={latitude}
                        onChange={(e) => setLatitude(e.target.value)}
                        placeholder="e.g. -7.4244"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-muted-foreground">Position Longitude</label>
                      <Input
                        type="number"
                        step="0.000001"
                        value={longitude}
                        onChange={(e) => setLongitude(e.target.value)}
                        placeholder="e.g. 109.2505"
                      />
                    </div>
                  </div>

                  {addModalTab === 'ASSET' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5 col-span-2">
                        <label className="text-muted-foreground">Linked Sensor Node ID (Optional)</label>
                        <Input
                          type="text"
                          value={tagId}
                          onChange={(e) => setTagId(e.target.value)}
                          placeholder="e.g. node-439201"
                        />
                      </div>
                    </div>
                  )}

                  {/* Required Type Attributes Fields */}
                  {currentFieldsConfig.length > 0 && (
                    <div className="space-y-3 pt-3 border-t border-border/60">
                      <span className="text-[10px] text-primary uppercase font-bold tracking-wider">Required Minimum Attributes</span>
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

                  <div className="space-y-1.5 pt-2">
                    <label className="text-muted-foreground">Notes / General Description</label>
                    <textarea
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Enter asset description or configuration notes..."
                      className="w-full bg-secondary/35 border border-border px-3 py-2 rounded-lg text-foreground focus:outline-none focus:border-primary resize-none text-xs font-semibold"
                    />
                  </div>
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
                    disabled={isSubmitting}
                    className="h-8.5 font-bold uppercase tracking-wider text-[10px]"
                  >
                    Add
                  </Button>
                </div>
              </form>
            </div>

          </Card>
        </div>
      )}

    </div>
  );
}
