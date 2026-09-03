'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Folder,
  ChevronRight,
  ChevronDown,
  MapPin,
  Boxes,
  Sliders,
  HardDrive,
  Activity,
  X,
  Search,
  Globe,
  SlidersHorizontal,
  Target,
  Truck,
  Wrench,
  Battery,
  Zap,
  Plug,
  Box,
  Building,
  DoorClosed,
  Car,
  Tv,
  Navigation,
  Layers,
  Wifi,
  Database,
  Server,
  Anchor,
  Gauge,
  Compass,
  Eye,
  Settings,
  Lightbulb,
  Monitor,
  Cpu,
  Radio,
  Tag,
  Code
} from 'lucide-react';

const typeIconLookup: Record<string, React.ComponentType<any>> = {
  AGENT_MQTT_TELTONIKA: Radio,
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
  const t = (type || '').toUpperCase();
  if (typeIconLookup[t]) return typeIconLookup[t];
  if (t.startsWith('AGENT_')) return Radio;
  return Boxes;
};

const getTypeColor = (type: string) => {
  const t = (type || '').toUpperCase();
  if (t.startsWith('AGENT_')) return '#f43f5e';
  if (t === 'ANCHOR') return '#3b82f6';
  if (t === 'MESH_EYE_SENSOR') return '#10b981';
  if (t === 'FORKLIFT' || t === 'THINGS') return '#f59e0b';
  if (t === 'CITY' || t === 'BUILDING') return '#8b5cf6';
  return '#6366f1';
};

export interface AttributeItem {
  name: string;
  dataType?: string;
  unit?: string;
  value?: any;
  [key: string]: any;
}

export interface TreeAttributeAssetItem {
  id: string;
  name: string;
  type: string;
  parentId?: string | null;
  attributes?: AttributeItem[];
  children?: TreeAttributeAssetItem[];
  [key: string]: any;
}

interface TreeAttributePickerProps {
  assets: TreeAttributeAssetItem[];
  selectedAssetId?: string;
  selectedAttributeName?: string;
  onChange: (assetId: string, attributeName: string, asset?: TreeAttributeAssetItem, attribute?: AttributeItem) => void;
  placeholder?: string;
  title?: string;
  disabled?: boolean;
  className?: string;
}

const buildAssetTree = (flatAssets: TreeAttributeAssetItem[]): TreeAttributeAssetItem[] => {
  const map: Record<string, TreeAttributeAssetItem> = {};
  const roots: TreeAttributeAssetItem[] = [];

  flatAssets.forEach((asset) => {
    map[asset.id] = { ...asset, children: [] };
  });

  flatAssets.forEach((asset) => {
    const mapped = map[asset.id];
    if (asset.parentId && map[asset.parentId]) {
      map[asset.parentId].children!.push(mapped);
    } else {
      roots.push(mapped);
    }
  });

  return roots;
};

export default function TreeAttributePicker({
  assets,
  selectedAssetId = "",
  selectedAttributeName = "",
  onChange,
  placeholder = "Select attribute...",
  title = "Select attribute",
  disabled = false,
  className = ""
}: TreeAttributePickerProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [tempAssetId, setTempAssetId] = useState<string>(selectedAssetId);
  const [tempAttrKey, setTempAttrKey] = useState<string>(selectedAttributeName);
  const [filterText, setFilterText] = useState("");
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setTempAssetId(selectedAssetId);
    setTempAttrKey(selectedAttributeName);
  }, [selectedAssetId, selectedAttributeName, modalOpen]);

  const treeData = useMemo(() => buildAssetTree(assets), [assets]);
  const selectedAsset = useMemo(() => assets.find(a => a.id === selectedAssetId), [assets, selectedAssetId]);
  const selectedAttr = useMemo(() => {
    if (!selectedAsset || !selectedAsset.attributes) return undefined;
    return selectedAsset.attributes.find(att => att.name === selectedAttributeName);
  }, [selectedAsset, selectedAttributeName]);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleConfirm = () => {
    const foundAsset = assets.find(a => a.id === tempAssetId);
    const foundAttr = foundAsset?.attributes?.find(att => att.name === tempAttrKey);
    onChange(tempAssetId, tempAttrKey, foundAsset, foundAttr);
    setModalOpen(false);
  };

  const handleClear = () => {
    setTempAssetId("");
    setTempAttrKey("");
    onChange("", "", undefined, undefined);
    setModalOpen(false);
  };

  // Filter check
  const matchesFilter = (node: TreeAttributeAssetItem, text: string): boolean => {
    if (!text.trim()) return true;
    const lower = text.toLowerCase();
    if (node.name.toLowerCase().includes(lower) || node.type.toLowerCase().includes(lower)) {
      return true;
    }
    if (node.attributes && node.attributes.some(att => att.name.toLowerCase().includes(lower))) {
      return true;
    }
    if (node.children && node.children.length > 0) {
      return node.children.some(child => matchesFilter(child, text));
    }
    return false;
  };

  const renderTreeNode = (node: TreeAttributeAssetItem, level = 0) => {
    if (filterText && !matchesFilter(node, filterText)) {
      return null;
    }

    const hasChildren = node.children && node.children.length > 0;
    const hasAttributes = node.attributes && node.attributes.length > 0;
    const isCollapsed = !!collapsedNodes[node.id] && !filterText;

    const TypeIcon = getTypeIcon(node.type);
    const typeColor = getTypeColor(node.type);

    return (
      <div key={node.id} className="space-y-0.5">
        {/* Asset Node Header */}
        <div
          onClick={(e) => {
            if (hasChildren || hasAttributes) {
              toggleExpand(node.id, e);
            }
          }}
          style={{ paddingLeft: `${level * 16 + 10}px` }}
          className="flex items-center gap-2 py-1.5 pr-3 rounded-lg transition-all text-xs border border-transparent text-muted-foreground hover:bg-secondary/40 cursor-pointer font-semibold"
        >
          {hasChildren || hasAttributes ? (
            <button
              type="button"
              onClick={(e) => toggleExpand(node.id, e)}
              className="w-5 h-5 flex items-center justify-center hover:bg-secondary rounded text-muted-foreground hover:text-foreground shrink-0 transition-transform cursor-pointer"
            >
              {isCollapsed ? (
                <ChevronRight className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          ) : (
            <span className="w-5 h-5 shrink-0" />
          )}

          <TypeIcon className="h-4 w-4 shrink-0" style={{ color: typeColor }} />
          <span className="truncate flex-1 font-bold text-foreground">{node.name}</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-mono shrink-0 uppercase">
            {node.type}
          </span>
        </div>

        {/* Attributes & Children when Expanded */}
        {!isCollapsed && (
          <div className="space-y-0.5">
            {/* Attribute Leaf Items */}
            {hasAttributes && node.attributes!.map((att) => {
              const isAttrSelected = tempAssetId === node.id && tempAttrKey === att.name;
              return (
                <div
                  key={att.name}
                  onClick={() => {
                    setTempAssetId(node.id);
                    setTempAttrKey(att.name);
                  }}
                  style={{ paddingLeft: `${(level + 1) * 16 + 16}px` }}
                  className={`flex items-center justify-between py-1.5 pr-3 rounded-lg transition-all text-xs border cursor-pointer ${
                    isAttrSelected
                      ? 'bg-primary/10 border-primary/40 text-primary font-bold shadow-sm'
                      : 'border-transparent text-foreground hover:bg-secondary/60 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Tag className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="truncate">{att.name}</span>
                    {att.unit && (
                      <span className="text-[10px] text-muted-foreground font-mono">({att.unit})</span>
                    )}
                  </div>
                  {att.dataType && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono font-bold shrink-0">
                      {att.dataType}
                    </span>
                  )}
                </div>
              );
            })}

            {/* Sub-Assets */}
            {hasChildren && node.children!.map(child => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setModalOpen(true)}
        className={`w-full min-h-[38px] bg-secondary/35 border border-border px-3 py-2 rounded-lg text-xs font-semibold text-foreground flex justify-between items-center transition-all hover:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/40 ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        <div className="flex items-center truncate gap-2">
          <Tag className="w-4 h-4 text-primary shrink-0" />
          <span className="truncate">
            {selectedAsset && selectedAttributeName ? `${selectedAsset.name} → ${selectedAttributeName}` : placeholder}
          </span>
        </div>
        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />
      </button>

      {/* Modal Dialog Overlay */}
      {modalOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-card border border-border/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
            {/* Header Bar */}
            <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between shadow-sm shrink-0">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Tag className="h-4.5 w-4.5" />
                <span>{title}</span>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 hover:bg-black/20 rounded-lg transition-colors text-primary-foreground/80 hover:text-primary-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Filter Search Bar */}
            <div className="p-3 border-b border-border bg-secondary/20 flex items-center gap-2 shrink-0">
              <div className="relative flex-1 flex items-center">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter attributes or assets..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="w-full bg-background border border-border px-9 py-1.5 rounded-lg text-xs font-medium text-foreground focus:outline-none focus:border-primary placeholder:text-muted-foreground"
                  autoFocus
                />
                {filterText && (
                  <button
                    type="button"
                    onClick={() => setFilterText('')}
                    className="absolute right-2.5 p-0.5 hover:bg-secondary rounded text-muted-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Tree View Container */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1 min-h-[250px] max-h-[420px] scrollbar-thin">
              {treeData.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground italic">
                  No attributes available
                </div>
              ) : (
                treeData.map(node => renderTreeNode(node, 0))
              )}
            </div>

            {/* Action Footer Buttons (CLEAR, OK, CANCEL) */}
            <div className="p-3 bg-secondary/20 border-t border-border flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={handleClear}
                className="px-3.5 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer uppercase tracking-wider"
              >
                CLEAR
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-secondary/80 rounded-lg transition-colors cursor-pointer uppercase tracking-wider"
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!tempAssetId || !tempAttrKey}
                  className={`px-5 py-1.5 text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer uppercase tracking-wider ${
                    !tempAssetId || !tempAttrKey
                      ? 'bg-primary/40 text-primary-foreground/50 cursor-not-allowed'
                      : 'text-primary-foreground bg-primary hover:bg-primary/90'
                  }`}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
