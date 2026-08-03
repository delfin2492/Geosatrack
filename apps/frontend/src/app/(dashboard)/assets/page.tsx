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
  Copy,
  Filter,
  Activity,
  X,
  Link2,
  Unlink,
  Globe,
  Loader2
} from 'lucide-react';

interface ZoneItem {
  id: string;
  name: string;
  siteId: string;
  site?: {
    name: string;
  };
}

export default function AssetsPage() {
  const { tenantId, token } = useAuth();
  const { assets, setAssets } = useSocket();

  // Zones for categorization and tree representation
  const [zones, setZones] = useState<ZoneItem[]>([]);
  const [loadingZones, setLoadingZones] = useState(false);

  // Search/Filter state
  const [searchQuery, setSearchQuery] = useState('');

  // Mode states: 'view' | 'edit' | 'create'
  const [mode, setMode] = useState<'view' | 'edit' | 'create'>('view');

  // Selection states
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('FORKLIFT');
  const [zoneId, setZoneId] = useState('');
  const [tagId, setTagId] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');

  // Info/Message states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedHistoryAttr, setSelectedHistoryAttr] = useState('Temperature');

  const selectedAsset = assets.find((a) => a.id === selectedAssetId);

  const fetchZones = async () => {
    if (!tenantId) return;
    setLoadingZones(true);
    try {
      const headers: Record<string, string> = { 'x-tenant-id': tenantId };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`http://localhost:4000/api/zones`, { headers });
      if (res.ok) {
        const data = await res.json();
        setZones(data);
      }
    } catch (e) {
      console.error('Failed to fetch zones:', e);
    } finally {
      setLoadingZones(false);
    }
  };

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
      fetchZones();
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
    setDescription(asset.description || '');
    setType(asset.type || 'FORKLIFT');
    setZoneId(asset.zoneId || '');
    setTagId(asset.tagId || '');
    setLatitude(asset.latitude !== null && asset.latitude !== undefined ? String(asset.latitude) : '');
    setLongitude(asset.longitude !== null && asset.longitude !== undefined ? String(asset.longitude) : '');
    setMode('view');
  };

  const handleOpenCreate = () => {
    setName('');
    setDescription('');
    setType('FORKLIFT');
    setZoneId(zones[0]?.id || '');
    setTagId('');
    setLatitude('');
    setLongitude('');
    setMode('create');
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

      const res = await fetch(`http://localhost:4000/api/assets`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name,
          description,
          type,
          zoneId: zoneId || null,
          tagId: tagId || null,
          latitude: latitude ? parseFloat(latitude) : null,
          longitude: longitude ? parseFloat(longitude) : null
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to create asset.');
      }

      const created = await res.json();
      await refreshAssets();
      setSelectedAssetId(created.id);
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

      const res = await fetch(`http://localhost:4000/api/assets/${selectedAssetId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          name,
          description,
          type,
          zoneId: zoneId || null,
          tagId: tagId || null,
          latitude: latitude ? parseFloat(latitude) : null,
          longitude: longitude ? parseFloat(longitude) : null
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

  // Group assets by zone for the sidebar tree
  const filteredAssets = assets.filter((a) =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-full w-full gap-5">
      
      {/* LEFT COLUMN: ASSETS SIDEBAR TREE (OpenRemote Inspired) */}
      <Card className="w-80 flex flex-col shrink-0 overflow-hidden border border-border">
        {/* White text on B&W/Dark header */}
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
              title="Add Asset"
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
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 text-xs font-semibold select-none">
          {loadingZones ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading structures...
            </div>
          ) : zones.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground font-medium">
              No zones created.
            </div>
          ) : (
            zones.map((zone) => {
              const zoneAssets = filteredAssets.filter((a) => a.zoneId === zone.id);
              
              return (
                <div key={zone.id} className="space-y-1.5">
                  <div className="flex items-center gap-2 text-muted-foreground/90 py-1 px-1.5 rounded cursor-default">
                    <Folder className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                    <span className="truncate">{zone.name}</span>
                    <Badge variant="secondary" className="font-mono text-[9px] ml-auto px-1.5 py-0">
                      {zoneAssets.length}
                    </Badge>
                  </div>

                  <div className="pl-4 border-l border-border/80 ml-3.5 space-y-1">
                    {zoneAssets.length === 0 ? (
                      <div className="text-[10px] text-muted-foreground/60 py-0.5 px-2.5 font-normal">
                        No assets in zone
                      </div>
                    ) : (
                      zoneAssets.map((asset) => {
                        const isSelected = selectedAssetId === asset.id;
                        return (
                          <div
                            key={asset.id}
                            onClick={() => handleSelectAsset(asset)}
                            className={`flex items-center gap-2 py-1 px-2.5 rounded cursor-pointer transition-all border ${
                              isSelected 
                                ? 'bg-primary/10 border-primary/20 text-primary font-bold shadow-sm' 
                                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                            }`}
                          >
                            <Boxes className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                            <span className="truncate">{asset.name}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Uncategorized Assets */}
          {filteredAssets.filter(a => !a.zoneId).length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-border/50">
              <div className="flex items-center gap-2 text-muted-foreground/90 py-1 px-1.5">
                <Folder className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                <span>Unassigned Assets</span>
              </div>
              <div className="pl-4 border-l border-border/80 ml-3.5 space-y-1">
                {filteredAssets.filter(a => !a.zoneId).map((asset) => {
                  const isSelected = selectedAssetId === asset.id;
                  return (
                    <div
                      key={asset.id}
                      onClick={() => handleSelectAsset(asset)}
                      className={`flex items-center gap-2 py-1 px-2.5 rounded cursor-pointer transition-all border ${
                        isSelected 
                          ? 'bg-primary/10 border-primary/20 text-primary font-bold shadow-sm' 
                          : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                      }`}
                    >
                      <Boxes className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                      <span className="truncate">{asset.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* RIGHT COLUMN: INSPECTOR & CONFIG PANEL */}
      <Card className="flex-1 flex flex-col overflow-hidden border border-border shadow-xl">
        {mode === 'create' || mode === 'edit' ? (
          /* ==================== CREATE / EDIT FORM ==================== */
          <form onSubmit={mode === 'create' ? handleCreateAsset : handleUpdateAsset} className="flex-1 flex flex-col justify-between">
            <CardHeader className="py-4 flex flex-row items-center justify-between border-b bg-secondary/15">
              <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                <Sliders className="h-4.5 w-4.5 text-primary" />
                {mode === 'create' ? 'Create New Asset Twin' : `Modify Asset: ${selectedAsset?.name}`}
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
                  <label className="text-muted-foreground">Asset Name *</label>
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="e.g. Air Quality DSP"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-muted-foreground">Asset Category</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full bg-secondary/35 border border-border px-3 py-2 rounded-lg text-foreground focus:outline-none focus:border-primary text-xs font-semibold"
                  >
                    <option value="FORKLIFT">Vehicle / Forklift</option>
                    <option value="PALLET">Inventory Pallet</option>
                    <option value="CONTAINER">Container Box</option>
                    <option value="ENV_SENSOR">Environment Sensor</option>
                    <option value="LIGHT_SWITCH">Smart Light Switch</option>
                    <option value="DOOR_ASSET">Door Monitor</option>
                    <option value="CITY_BUILDING">City Structure</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-muted-foreground">Parent Zone</label>
                  <select
                    value={zoneId}
                    onChange={(e) => setZoneId(e.target.value)}
                    className="w-full bg-secondary/35 border border-border px-3 py-2 rounded-lg text-foreground focus:outline-none focus:border-primary text-xs font-semibold"
                  >
                    <option value="">(None / Unassigned)</option>
                    {zones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-muted-foreground">Linked Sensor Node ID (Optional)</label>
                  <Input
                    type="text"
                    value={tagId}
                    onChange={(e) => setTagId(e.target.value)}
                    placeholder="e.g. node-439201"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-muted-foreground">Position Latitude (Map Placement)</label>
                  <Input
                    type="number"
                    step="0.000001"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    placeholder="e.g. -7.4244"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-muted-foreground">Position Longitude (Map Placement)</label>
                  <Input
                    type="number"
                    step="0.000001"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    placeholder="e.g. 109.2505"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-muted-foreground">Description</label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe operational status and specifications..."
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
                {/* Header bar matching OpenRemote style */}
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
                      setDescription(selectedAsset.description || '');
                      setType(selectedAsset.type || 'FORKLIFT');
                      setZoneId(selectedAsset.zoneId || '');
                      setTagId(selectedAsset.tagId || '');
                      setLatitude(selectedAsset.latitude !== null && selectedAsset.latitude !== undefined ? String(selectedAsset.latitude) : '');
                      setLongitude(selectedAsset.longitude !== null && selectedAsset.longitude !== undefined ? String(selectedAsset.longitude) : '');
                      setMode('edit');
                    }}
                    variant="outline"
                    className="flex items-center gap-1.5 h-8 text-[11px] font-bold"
                  >
                    <Edit className="h-3.5 w-3.5" />
                    Modify
                  </Button>
                </div>

                {/* Content Panel Body split in two columns */}
                <div className="flex-1 overflow-y-auto p-5 flex flex-col lg:flex-row gap-6">
                  {/* Left sub-column: Info & Attributes */}
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
                          <span className="text-muted-foreground">Asset Category:</span>
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {selectedAsset.type}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-border/40">
                          <span className="text-muted-foreground">Active Status:</span>
                          <Badge variant={selectedAsset.status === 'moving' ? 'success' : 'secondary'} className="capitalize">
                            {selectedAsset.status}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between py-1">
                          <span className="text-muted-foreground font-semibold">Device Eui / Linked Tag:</span>
                          <span className="font-mono text-foreground font-bold flex items-center gap-1.5">
                            <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
                            {selectedAsset.tagId || '(None)'}
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                    {/* ATTRIBUTES Card */}
                    <Card className="border border-border/80">
                      <CardHeader className="py-2.5 px-4 bg-secondary/20 border-b border-border/50">
                        <CardTitle className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                          Attributes
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
                            No active telemetry. Link an IoT sensor tag to fetch live attributes.
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Right sub-column: Location, History */}
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
                            {/* Static coordinates indicator */}
                            <div className="flex items-center gap-2 p-2 bg-secondary/35 border border-border/60 rounded-lg">
                              <Globe className="h-4 w-4 text-primary shrink-0" />
                              <div className="min-w-0">
                                <p className="text-[10px] text-muted-foreground">Coordinates</p>
                                <p className="font-mono text-[10px] truncate text-foreground">
                                  {selectedAsset.latitude}, {selectedAsset.longitude}
                                </p>
                              </div>
                            </div>
                            {/* Visual Map Representation */}
                            <div className="h-32 bg-secondary/15 border border-border/60 rounded-xl relative flex items-center justify-center p-2 text-center text-muted-foreground text-[10px]">
                              <div className="space-y-1">
                                <MapPin className="h-5 w-5 text-primary mx-auto animate-bounce" />
                                <p className="font-bold">Coordinates Mapped</p>
                                <p className="text-[9px] opacity-75">Jakarta Cawang Area</p>
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
                        {/* History chart mockup or log listing */}
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
    </div>
  );
}
