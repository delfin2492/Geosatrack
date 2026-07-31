'use client';

import React, { useState } from 'react';
import { useSocket } from '../../context/SocketContext';
import { 
  Folder, 
  MapPin, 
  Boxes, 
  FileText, 
  Plus, 
  Link2, 
  Unlink, 
  Save, 
  Edit, 
  Trash 
} from 'lucide-react';

export default function AssetsPage() {
  const { assets, setAssets } = useSocket();
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(assets[0]?.id || 'forklift-1');
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editType, setEditType] = useState('FORKLIFT');

  const selectedAsset = assets.find((a) => a.id === selectedAssetId);

  // Group assets by Site and Zone
  const sites = {
    'Warehouse Cawang': {
      'Storage Zone Alpha': assets.filter(a => a.zoneId === 'zone-alpha'),
      'Receiving Dock': assets.filter(a => a.zoneId === 'zone-beta')
    }
  };

  const handleSelectAsset = (id: string) => {
    setSelectedAssetId(id);
    const asset = assets.find((a) => a.id === id);
    if (asset) {
      setEditName(asset.name);
      setEditDesc(asset.description || 'Peralatan operasional logistik.');
      setEditType(asset.type);
    }
    setIsEditing(false);
  };

  const handleSave = () => {
    if (!selectedAssetId) return;
    setAssets((prev) => 
      prev.map((a) => 
        a.id === selectedAssetId 
          ? { ...a, name: editName, type: editType, description: editDesc } 
          : a
      )
    );
    setIsEditing(false);
  };

  return (
    <div className="flex h-full w-full gap-6">
      
      {/* LEFT COLUMN: HIERARCHICAL ASSET TREE (OpenRemote Inspired) */}
      <div className="w-80 bg-card border border-border rounded-xl p-4 flex flex-col shrink-0">
        <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
          <h3 className="text-sm font-bold tracking-wide">Asset Tree</h3>
          <button className="h-6 w-6 rounded bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-all border border-primary/20">
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Tree Content */}
        <div className="flex-1 overflow-y-auto space-y-4 text-xs font-semibold">
          {/* Tenant Root */}
          <div>
            <div className="flex items-center gap-2 text-foreground/80 py-1.5 px-2 hover:bg-secondary/40 rounded cursor-pointer">
              <Folder className="h-4 w-4 text-primary shrink-0" />
              <span>PT ABC Logistics</span>
            </div>
            
            {/* Sites */}
            <div className="pl-4 mt-1.5 space-y-2 border-l border-border/80 ml-3.5">
              {Object.entries(sites).map(([siteName, zones]) => (
                <div key={siteName}>
                  <div className="flex items-center gap-2 text-muted-foreground hover:text-foreground py-1 px-2 rounded cursor-pointer">
                    <MapPin className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <span>{siteName}</span>
                  </div>
                  
                  {/* Zones */}
                  <div className="pl-4 mt-1 space-y-1.5 border-l border-border/80 ml-3">
                    {Object.entries(zones).map(([zoneName, zoneAssets]) => (
                      <div key={zoneName}>
                        <div className="flex items-center gap-1.5 text-muted-foreground/80 py-0.5 px-2">
                          <Folder className="h-3.5 w-3.5 text-amber-500/80 shrink-0" />
                          <span>{zoneName}</span>
                        </div>

                        {/* Assets */}
                        <div className="pl-3 mt-1 space-y-1">
                          {zoneAssets.map((asset) => {
                            const isSelected = selectedAssetId === asset.id;
                            return (
                              <div
                                key={asset.id}
                                onClick={() => handleSelectAsset(asset.id)}
                                className={`flex items-center gap-2 py-1 px-3 rounded cursor-pointer transition-all border ${
                                  isSelected 
                                    ? 'bg-primary/10 border-primary/20 text-primary' 
                                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                                }`}
                              >
                                <Boxes className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{asset.name}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: ASSET CONFIGURATION & DETAILS */}
      <div className="flex-1 bg-card border border-border rounded-xl overflow-hidden flex flex-col">
        <div className="border-b border-border px-6 py-4 bg-secondary/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4.5 w-4.5 text-primary" />
            <h3 className="text-sm font-bold tracking-wide">Asset Configuration</h3>
          </div>
          {selectedAsset && !isEditing && (
            <button
              onClick={() => {
                setIsEditing(true);
                setEditName(selectedAsset.name);
                setEditDesc(selectedAsset.description || '');
                setEditType(selectedAsset.type);
              }}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs hover:text-primary transition-all"
            >
              <Edit className="h-3.5 w-3.5" />
              Edit Attributes
            </button>
          )}
        </div>

        {selectedAsset ? (
          <div className="p-6 space-y-6 flex-1 overflow-y-auto">
            {isEditing ? (
              // EDITING FORM
              <div className="space-y-4 max-w-xl text-xs font-semibold">
                <div className="space-y-1.5">
                  <label className="text-muted-foreground">Asset Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-secondary/40 border border-border px-3 py-2 rounded-lg text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-muted-foreground">Asset Type</label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value)}
                    className="w-full bg-secondary/40 border border-border px-3 py-2 rounded-lg text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="FORKLIFT">Forklift</option>
                    <option value="PALLET">Pallet</option>
                    <option value="CONTAINER">Container Box</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-muted-foreground">Description</label>
                  <textarea
                    rows={4}
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="w-full bg-secondary/40 border border-border px-3 py-2 rounded-lg text-foreground focus:outline-none focus:border-primary resize-none"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleSave}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/95 transition-all shadow-md"
                  >
                    <Save className="h-3.5 w-3.5" />
                    Save Changes
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="rounded-lg border border-border bg-card px-4 py-2 text-muted-foreground hover:bg-secondary/50 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              // READ-ONLY DISPLAY
              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-bold text-foreground">{selectedAsset.name}</h4>
                  <p className="text-xs text-muted-foreground mt-1.5 max-w-2xl leading-relaxed">
                    {selectedAsset.description || 'Peralatan logistik operasional PT ABC Logistics. Terhubung dengan jaringan Wirepas Mesh.'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 max-w-2xl text-xs">
                  <div className="bg-secondary/30 border border-border/50 p-4 rounded-xl space-y-1.5">
                    <span className="text-muted-foreground uppercase font-bold text-[9px] tracking-wider">Device Model</span>
                    <p className="font-bold text-foreground">{selectedAsset.type}</p>
                  </div>
                  <div className="bg-secondary/30 border border-border/50 p-4 rounded-xl space-y-1.5">
                    <span className="text-muted-foreground uppercase font-bold text-[9px] tracking-wider">Current Zone</span>
                    <p className="font-bold text-foreground">{selectedAsset.zone?.name || 'Storage Zone Alpha'}</p>
                  </div>
                </div>

                {/* Tag Binding Attributes */}
                <div className="border border-border rounded-xl overflow-hidden max-w-2xl bg-secondary/15">
                  <div className="bg-secondary/35 border-b border-border px-4 py-3 flex items-center justify-between text-xs">
                    <span className="font-bold text-foreground flex items-center gap-1.5">
                      <Link2 className="h-4 w-4 text-primary" />
                      Associated IoT Tag
                    </span>
                    {selectedAsset.tag ? (
                      <button className="flex items-center gap-1 text-red-400 hover:text-red-300 font-bold">
                        <Unlink className="h-3.5 w-3.5" />
                        Unlink Tag
                      </button>
                    ) : (
                      <button className="flex items-center gap-1 text-primary hover:text-primary/80 font-bold">
                        <Link2 className="h-3.5 w-3.5" />
                        Link Tag
                      </button>
                    )}
                  </div>
                  <div className="p-4 text-xs font-semibold space-y-2">
                    {selectedAsset.tag ? (
                      <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                        <div>Tag Hardware ID:</div>
                        <div className="font-mono text-foreground">{selectedAsset.tag.id}</div>
                        <div>Last Telemetry Seen:</div>
                        <div className="text-foreground">{new Date().toLocaleTimeString()}</div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-4">No sensor tag linked to this asset.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-muted-foreground py-12">
            No assets registered. Select an asset from the tree.
          </div>
        )}
      </div>
    </div>
  );
}
