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
  Tag
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

export interface TreeAssetItem {
  id: string;
  name: string;
  type: string;
  parentId?: string | null;
  children?: TreeAssetItem[];
  [key: string]: any;
}

interface TreeAssetPickerProps {
  assets: TreeAssetItem[];
  value: string;
  onChange: (selectedId: string, selectedAsset?: TreeAssetItem) => void;
  disabledAssetId?: string;
  placeholder?: string;
  title?: string;
  disabled?: boolean;
  className?: string;
}

const buildAssetTree = (flatAssets: TreeAssetItem[]): TreeAssetItem[] => {
  const map: Record<string, TreeAssetItem> = {};
  const roots: TreeAssetItem[] = [];

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

// Checks if nodeId IS disabledId or is a child/descendant of disabledId (to prevent circular parent loops)
const isSelfOrDescendantOfTarget = (nodeId: string, flatAssets: TreeAssetItem[], disabledId?: string): boolean => {
  if (!disabledId) return false;
  if (nodeId === disabledId) return true;

  let current = flatAssets.find(a => a.id === nodeId);
  while (current && current.parentId) {
    const pId = current.parentId;
    if (pId === disabledId) {
      return true;
    }
    current = flatAssets.find(a => a.id === pId);
  }
  return false;
};

export default function TreeAssetPicker({
  assets,
  value,
  onChange,
  disabledAssetId,
  placeholder = "(None / Root Asset)",
  title = "Select parent asset",
  disabled = false,
  className = ""
}: TreeAssetPickerProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [tempSelectedId, setTempSelectedId] = useState<string>(value);
  const [filterText, setFilterText] = useState("");
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setTempSelectedId(value);
  }, [value, modalOpen]);

  const treeData = useMemo(() => buildAssetTree(assets), [assets]);
  const selectedAsset = useMemo(() => assets.find(a => a.id === value), [assets, value]);
  const tempSelectedAsset = useMemo(() => assets.find(a => a.id === tempSelectedId), [assets, tempSelectedId]);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleConfirm = () => {
    onChange(tempSelectedId, tempSelectedAsset);
    setModalOpen(false);
  };

  const handleSelectNone = () => {
    setTempSelectedId("");
    onChange("", undefined);
    setModalOpen(false);
  };

  // Filter & check if node or any child matches filter
  const matchesFilter = (node: TreeAssetItem, text: string): boolean => {
    if (!text.trim()) return true;
    const lower = text.toLowerCase();
    if (node.name.toLowerCase().includes(lower) || node.type.toLowerCase().includes(lower)) {
      return true;
    }
    if (node.children && node.children.length > 0) {
      return node.children.some(child => matchesFilter(child, text));
    }
    return false;
  };

  const renderTreeNode = (node: TreeAssetItem, level = 0) => {
    if (filterText && !matchesFilter(node, filterText)) {
      return null;
    }

    const isSelected = tempSelectedId === node.id;
    const hasChildren = node.children && node.children.length > 0;
    const isCollapsed = !!collapsedNodes[node.id] && !filterText;
    const isDisabled = disabledAssetId ? isSelfOrDescendantOfTarget(node.id, assets, disabledAssetId) : false;

    const TypeIcon = getTypeIcon(node.type);
    const typeColor = getTypeColor(node.type);

    return (
      <div key={node.id} className="space-y-0.5">
        <div
          onClick={() => {
            if (!isDisabled) {
              setTempSelectedId(node.id);
            }
          }}
          style={{ paddingLeft: `${level * 16 + 10}px` }}
          className={`flex items-center gap-2 py-2 pr-3 rounded-lg transition-all text-xs border ${
            isDisabled
              ? 'opacity-40 cursor-not-allowed border-transparent bg-secondary/10'
              : isSelected
              ? 'bg-primary/10 border-primary/40 text-primary font-bold shadow-sm'
              : 'border-transparent text-foreground hover:bg-secondary/60 cursor-pointer font-medium'
          }`}
        >
          {hasChildren ? (
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
          <span className="truncate flex-1">{node.name}</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-mono shrink-0 uppercase">
            {node.type}
          </span>
        </div>

        {hasChildren && !isCollapsed && (
          <div className="space-y-0.5">
            {node.children!.map(child => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const SelectedTypeIcon = selectedAsset ? getTypeIcon(selectedAsset.type) : null;
  const selectedTypeColor = selectedAsset ? getTypeColor(selectedAsset.type) : null;

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
          {SelectedTypeIcon ? (
            <SelectedTypeIcon className="w-4 h-4 shrink-0" style={{ color: selectedTypeColor || undefined }} />
          ) : (
            <Folder className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
          <span className="truncate">
            {selectedAsset ? `${selectedAsset.name} (${selectedAsset.type})` : placeholder}
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
                <Folder className="h-4.5 w-4.5" />
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
                  placeholder="Filter..."
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
              {/* Root Asset Option */}
              <div
                onClick={() => setTempSelectedId("")}
                className={`flex items-center gap-2 py-2 px-3 rounded-lg transition-all text-xs border cursor-pointer font-semibold ${
                  tempSelectedId === ""
                    ? 'bg-primary/10 border-primary/40 text-primary font-bold shadow-sm'
                    : 'border-transparent text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                }`}
              >
                <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>(None / Root Asset)</span>
              </div>

              <div className="border-t border-border/40 my-1.5" />

              {treeData.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground italic">
                  No assets available
                </div>
              ) : (
                treeData.map(node => renderTreeNode(node, 0))
              )}
            </div>

            {/* Action Footer Buttons (NONE, OK, CANCEL) */}
            <div className="p-3 bg-secondary/20 border-t border-border flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={handleSelectNone}
                className="px-3.5 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer uppercase tracking-wider"
              >
                NONE
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
                  className="px-5 py-1.5 text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg shadow-sm transition-colors cursor-pointer uppercase tracking-wider"
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
