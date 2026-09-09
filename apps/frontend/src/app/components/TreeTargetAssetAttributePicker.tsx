'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Folder,
  ChevronRight,
  ChevronDown,
  Layers,
  Tag,
  Search,
  Check,
  Globe,
  Radio,
  HardDrive,
  Activity,
  Boxes,
  MapPin,
  X,
  Thermometer,
  Droplets,
  Battery,
  Wifi,
  Compass
} from 'lucide-react';

export interface AttributeOption {
  name: string;
  label: string;
  icon?: string;
  unit?: string;
}

export interface AssetItem {
  id: string;
  name: string;
  type: string;
  tagId?: string;
  description?: string;
  attributes?: any[];
  [key: string]: any;
}

interface TreeTargetAssetAttributePickerProps {
  assets: AssetItem[];
  selectedAssetId: string;
  selectedAttribute: string;
  onChange: (assetId: string, attribute: string, assetName?: string) => void;
  className?: string;
}

const DEFAULT_ATTRIBUTES: AttributeOption[] = [
  { name: 'temperature', label: 'Temperature (°C)', unit: '°C' },
  { name: 'humidity', label: 'Humidity (%)', unit: '%' },
  { name: 'battery', label: 'Battery / Voltage (V)', unit: 'V' },
  { name: 'rssi', label: 'Signal RSSI (dBm)', unit: 'dBm' },
  { name: 'accelX', label: 'Accel X', unit: 'g' },
  { name: 'accelY', label: 'Accel Y', unit: 'g' },
  { name: 'accelZ', label: 'Accel Z', unit: 'g' },
];

const getAttrIcon = (name: string) => {
  const n = (name || '').toLowerCase();
  if (n.includes('temp')) return Thermometer;
  if (n.includes('hum')) return Droplets;
  if (n.includes('batt') || n.includes('volt')) return Battery;
  if (n.includes('rssi')) return Wifi;
  return Compass;
};

export default function TreeTargetAssetAttributePicker({
  assets,
  selectedAssetId,
  selectedAttribute,
  onChange,
  className = '',
}: TreeTargetAssetAttributePickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Helper to extract custom attributes from asset.description JSON
  const getAssetAttributes = (asset: AssetItem): AttributeOption[] => {
    const attrMap = new Map<string, AttributeOption>();
    DEFAULT_ATTRIBUTES.forEach((at) => attrMap.set(at.name.toLowerCase(), at));

    if (asset.description) {
      try {
        const desc = JSON.parse(asset.description);
        const registered = desc.attributes || [];
        registered.forEach((at: any) => {
          if (at.name && !attrMap.has(at.name.toLowerCase())) {
            let labelName = at.name
              .replace(/_/g, ' ')
              .replace(/([A-Z])/g, ' $1')
              .replace(/^./, (str: string) => str.toUpperCase());

            attrMap.set(at.name.toLowerCase(), {
              name: at.name,
              label: labelName + (at.unit ? ` (${at.unit})` : ''),
              unit: at.unit || ''
            });
          }
        });
      } catch (e) {}
    }

    return Array.from(attrMap.values());
  };

  // Compute Current Selection Display Text
  const currentSelectionText = useMemo(() => {
    if (selectedAssetId === 'all' && selectedAttribute === 'all') {
      return 'Semua Asset & Attribute (All)';
    }

    if (selectedAssetId === 'all' && selectedAttribute !== 'all') {
      const foundAttr = DEFAULT_ATTRIBUTES.find((a) => a.name.toLowerCase() === selectedAttribute.toLowerCase());
      return `Semua Asset ➔ ${foundAttr ? foundAttr.label : selectedAttribute}`;
    }

    const matchedAsset = assets.find((a) => a.id === selectedAssetId);
    const assetLabel = matchedAsset ? `${matchedAsset.name}` : `Asset [${selectedAssetId}]`;

    if (selectedAttribute === 'all') {
      return `${assetLabel} (Semua Attribute)`;
    }

    const foundAttr = DEFAULT_ATTRIBUTES.find((a) => a.name.toLowerCase() === selectedAttribute.toLowerCase());
    return `${assetLabel} ➔ ${foundAttr ? foundAttr.label : selectedAttribute}`;
  }, [selectedAssetId, selectedAttribute, assets]);

  // Filter Matching
  const matchesSearch = (text: string) => {
    if (!search.trim()) return true;
    return text.toLowerCase().includes(search.toLowerCase());
  };

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Target Asset / Attribute</label>

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full min-h-[40px] text-xs font-semibold px-3 py-2 rounded-xl border border-border bg-secondary/20 text-foreground flex items-center justify-between cursor-pointer hover:border-primary/50 transition-all shadow-xs"
      >
        <div className="flex items-center truncate gap-2 min-w-0">
          <Layers className="w-4 h-4 text-primary shrink-0" />
          <span className="truncate">{currentSelectionText}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 ml-2 transition-transform duration-200 ${open ? 'rotate-180 text-primary' : ''}`} />
      </button>

      {/* Tree Select Dropdown Popup */}
      {open && (
        <div className="absolute z-[9999] top-full mt-1.5 w-full left-0 bg-card/95 backdrop-blur-md border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 p-2 space-y-2 min-w-[320px]">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Cari Asset / Attribute..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs font-semibold pl-9 pr-7 py-1.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary"
              autoFocus
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Tree Scroll Area */}
          <div className="max-h-72 overflow-y-auto space-y-1 scrollbar-thin pr-1 text-xs">
            {/* 1. All Assets & Attributes Node */}
            {matchesSearch('Semua Asset & Attribute (All)') && (
              <div
                onClick={() => {
                  onChange('all', 'all');
                  setOpen(false);
                }}
                className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all border ${
                  selectedAssetId === 'all' && selectedAttribute === 'all'
                    ? 'bg-primary/10 border-primary/40 text-primary font-bold shadow-sm'
                    : 'border-transparent text-foreground hover:bg-secondary/60 font-semibold'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Globe className="w-4 h-4 text-primary shrink-0" />
                  <span>Semua Asset & Attribute (All)</span>
                </div>
                {selectedAssetId === 'all' && selectedAttribute === 'all' && <Check className="w-3.5 h-3.5 text-primary stroke-[3]" />}
              </div>
            )}

            {/* 2. Global Attributes Folder Node */}
            <div className="space-y-0.5 pt-1 border-t border-border/40">
              <div
                onClick={(e) => toggleExpand('global_attrs', e)}
                className="flex items-center justify-between px-2 py-1.5 rounded-lg text-muted-foreground hover:bg-secondary/40 cursor-pointer font-bold select-none"
              >
                <div className="flex items-center gap-1.5">
                  <button type="button" className="w-4 h-4 flex items-center justify-center">
                    {collapsedNodes['global_attrs'] ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  <Tag className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-foreground">Global Attributes (Semua Asset)</span>
                </div>
              </div>

              {!collapsedNodes['global_attrs'] && (
                <div className="pl-6 space-y-0.5">
                  {DEFAULT_ATTRIBUTES.map((attr) => {
                    if (!matchesSearch(attr.label)) return null;
                    const isSelected = selectedAssetId === 'all' && selectedAttribute.toLowerCase() === attr.name.toLowerCase();
                    const AttrIcon = getAttrIcon(attr.name);

                    return (
                      <div
                        key={`global-${attr.name}`}
                        onClick={() => {
                          onChange('all', attr.name);
                          setOpen(false);
                        }}
                        className={`flex items-center justify-between px-3 py-1.5 rounded-lg cursor-pointer transition-all border ${
                          isSelected
                            ? 'bg-primary/10 border-primary/40 text-primary font-bold shadow-sm'
                            : 'border-transparent text-foreground hover:bg-secondary/60 font-medium'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <AttrIcon className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span>{attr.label}</span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-primary stroke-[3]" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. Asset Tree Nodes */}
            <div className="space-y-1 pt-1 border-t border-border/40">
              <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Daftar Asset ({assets.length})</div>

              {assets.map((asset) => {
                const assetAttrs = getAssetAttributes(asset);
                const isAssetCollapsed = !!collapsedNodes[asset.id] && !search;
                const isAssetSelected = selectedAssetId === asset.id && selectedAttribute === 'all';

                const matchesAssetOrChild =
                  matchesSearch(asset.name) || matchesSearch(asset.type) || assetAttrs.some((at) => matchesSearch(at.label));

                if (!matchesAssetOrChild) return null;

                return (
                  <div key={asset.id} className="space-y-0.5">
                    {/* Asset Folder Header */}
                    <div
                      onClick={() => {
                        onChange(asset.id, 'all', asset.name);
                        setOpen(false);
                      }}
                      className={`flex items-center justify-between px-2 py-1.5 rounded-lg transition-all border cursor-pointer ${
                        isAssetSelected
                          ? 'bg-primary/10 border-primary/40 text-primary font-bold shadow-sm'
                          : 'border-transparent text-foreground hover:bg-secondary/60 font-semibold'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <button
                          type="button"
                          onClick={(e) => toggleExpand(asset.id, e)}
                          className="w-4 h-4 flex items-center justify-center text-muted-foreground hover:text-foreground"
                        >
                          {isAssetCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                        <Boxes className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span className="truncate">{asset.name}</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-secondary text-muted-foreground font-mono uppercase shrink-0">
                          {asset.type}
                        </span>
                      </div>
                      {isAssetSelected && <Check className="w-3.5 h-3.5 text-primary stroke-[3]" />}
                    </div>

                    {/* Child Attributes */}
                    {!isAssetCollapsed && (
                      <div className="pl-6 space-y-0.5">
                        {/* All Attributes of this asset option */}
                        <div
                          onClick={() => {
                            onChange(asset.id, 'all', asset.name);
                            setOpen(false);
                          }}
                          className={`flex items-center justify-between px-3 py-1.5 rounded-lg cursor-pointer transition-all border ${
                            selectedAssetId === asset.id && selectedAttribute === 'all'
                              ? 'bg-primary/10 border-primary/40 text-primary font-bold'
                              : 'border-transparent text-muted-foreground hover:bg-secondary/60 hover:text-foreground font-medium'
                          }`}
                        >
                          <span className="italic">Semua Attribute Asset Ini</span>
                          {selectedAssetId === asset.id && selectedAttribute === 'all' && <Check className="w-3.5 h-3.5 text-primary stroke-[3]" />}
                        </div>

                        {assetAttrs.map((attr) => {
                          if (!matchesSearch(attr.label) && !matchesSearch(asset.name)) return null;
                          const isAttrSelected = selectedAssetId === asset.id && selectedAttribute.toLowerCase() === attr.name.toLowerCase();
                          const AttrIcon = getAttrIcon(attr.name);

                          return (
                            <div
                              key={`${asset.id}-${attr.name}`}
                              onClick={() => {
                                onChange(asset.id, attr.name, asset.name);
                                setOpen(false);
                              }}
                              className={`flex items-center justify-between px-3 py-1.5 rounded-lg cursor-pointer transition-all border ${
                                isAttrSelected
                                  ? 'bg-primary/10 border-primary/40 text-primary font-bold shadow-sm'
                                  : 'border-transparent text-foreground hover:bg-secondary/60 font-medium'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <AttrIcon className="w-3.5 h-3.5 text-primary shrink-0" />
                                <span>{attr.label}</span>
                              </div>
                              {isAttrSelected && <Check className="w-3.5 h-3.5 text-primary stroke-[3]" />}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
