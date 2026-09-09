'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  SlidersHorizontal,
  Thermometer,
  Droplets,
  Battery,
  Wifi,
  Compass,
  CheckSquare,
  Square,
  Filter
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export interface AttributeOption {
  name: string;
  label: string;
  unit?: string;
}

export interface AssetItem {
  id: string;
  name: string;
  type: string;
  parentId?: string | null;
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
  primaryAccentColor?: string;
  className?: string;
}

const DEFAULT_ATTRIBUTES: AttributeOption[] = [
  { name: 'temperature', label: 'Temperature (°C)', unit: '°C' },
  { name: 'humidity', label: 'Humidity (%)', unit: '%' },
  { name: 'battery', label: 'Battery / Voltage (V)', unit: 'V' },
  { name: 'rssi', label: 'Signal RSSI (dBm)', unit: 'dBm' },
  { name: 'accelX', label: 'Accel X (g)', unit: 'g' },
  { name: 'accelY', label: 'Accel Y (g)', unit: 'g' },
  { name: 'accelZ', label: 'Accel Z (g)', unit: 'g' },
];

const typeIconLookup: Record<string, React.ComponentType<any>> = {
  AGENT_MQTT_TELTONIKA: Radio,
  AGENT_MQTT_GENERIC: HardDrive,
  AGENT_HTTP: Globe,
  AGENT_BLE: Activity,
  CITY: Globe,
  BUILDING: Folder,
  LIGHT: SlidersHorizontal,
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
  MACHINE: SlidersHorizontal,
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

const buildAssetTree = (flatAssets: AssetItem[]): AssetItem[] => {
  const map: Record<string, AssetItem> = {};
  const roots: AssetItem[] = [];

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

export default function TreeTargetAssetAttributePicker({
  assets,
  selectedAssetId,
  selectedAttribute,
  onChange,
  primaryAccentColor = '#f43f5e',
  className = '',
}: TreeTargetAssetAttributePickerProps) {
  const { user } = useAuth();
  const accentColor = user?.tenantThemeColor || primaryAccentColor || '#f43f5e';

  const [modalOpen, setModalOpen] = useState(false);
  
  // Temporary Modal Selection State
  const [activeAssetId, setActiveAssetId] = useState<string>(selectedAssetId || 'all');
  const [activeAttribute, setActiveAttribute] = useState<string>(selectedAttribute || 'all');
  
  const [filterText, setFilterText] = useState('');
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (modalOpen) {
      setActiveAssetId(selectedAssetId || 'all');
      setActiveAttribute(selectedAttribute || 'all');
    }
  }, [modalOpen, selectedAssetId, selectedAttribute]);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Extract attributes for a specific asset
  const getAttributesForAsset = (assetId: string): AttributeOption[] => {
    const attrMap = new Map<string, AttributeOption>();
    DEFAULT_ATTRIBUTES.forEach((at) => attrMap.set(at.name.toLowerCase(), at));

    if (assetId !== 'all') {
      const asset = assets.find((a) => a.id === assetId);
      if (asset?.description) {
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
    }

    return Array.from(attrMap.values());
  };

  const currentAssetAttributes = useMemo(() => {
    return getAttributesForAsset(activeAssetId);
  }, [activeAssetId, assets]);

  // Compute Current Selection Display Text for Trigger Button
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

  const handleApplySelection = () => {
    const matchedAsset = assets.find((a) => a.id === activeAssetId);
    onChange(activeAssetId, activeAttribute, matchedAsset?.name);
    setModalOpen(false);
  };

  // Tree View Traversal for Left Assets Panel
  const treeData = useMemo(() => buildAssetTree(assets), [assets]);

  const matchesFilter = (node: AssetItem, text: string): boolean => {
    if (!text.trim()) return true;
    const lower = text.toLowerCase();
    if (node.name.toLowerCase().includes(lower) || node.type.toLowerCase().includes(lower)) {
      return true;
    }
    if (node.children && node.children.length > 0) {
      return node.children.some((child: any) => matchesFilter(child, text));
    }
    return false;
  };

  const renderAssetTreeNode = (node: AssetItem, level = 0) => {
    if (filterText && !matchesFilter(node, filterText)) {
      return null;
    }

    const isSelected = activeAssetId === node.id;
    const hasChildren = node.children && node.children.length > 0;
    const isCollapsed = !!collapsedNodes[node.id] && !filterText;

    const TypeIcon = getTypeIcon(node.type);
    const typeColor = getTypeColor(node.type);

    return (
      <div key={node.id} className="space-y-0.5">
        <div
          onClick={() => {
            setActiveAssetId(node.id);
            // Default to 'all' or keep current attribute
          }}
          style={{
            paddingLeft: `${level * 14 + 10}px`,
            borderLeftColor: isSelected ? accentColor : 'transparent',
            backgroundColor: isSelected ? `${accentColor}18` : undefined,
          }}
          className={`flex items-center gap-1.5 pr-2.5 py-1.5 rounded-md cursor-pointer transition-all border-l-4 text-xs ${
            isSelected
              ? 'font-bold text-foreground shadow-xs'
              : 'border-transparent hover:bg-secondary/60 text-muted-foreground hover:text-foreground'
          }`}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => toggleExpand(node.id, e)}
              className="p-0.5 hover:bg-secondary/80 rounded text-muted-foreground hover:text-foreground shrink-0 transition-transform cursor-pointer"
            >
              {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          ) : (
            <span className="w-3.5 h-3.5 shrink-0" />
          )}

          <TypeIcon className="w-3.5 h-3.5 shrink-0" style={{ color: typeColor }} />
          <span className="truncate flex-1">{node.name}</span>
          <span className="text-[9px] px-1.5 py-0.2 rounded bg-secondary text-muted-foreground font-mono shrink-0 uppercase">
            {node.type}
          </span>
        </div>

        {hasChildren && !isCollapsed && (
          <div className="space-y-0.5">
            {node.children!.map((child: any) => renderAssetTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`w-full ${className}`}>
      <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Target Asset / Attribute</label>

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="w-full min-h-[40px] text-xs font-semibold px-3 py-2 rounded-xl border border-border bg-secondary/20 text-foreground flex items-center justify-between cursor-pointer hover:border-primary/50 transition-all shadow-xs"
      >
        <div className="flex items-center truncate gap-2 min-w-0">
          <Layers className="w-4 h-4 text-primary shrink-0" />
          <span className="truncate">{currentSelectionText}</span>
        </div>
        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />
      </button>

      {/* MODAL DIALOG matching user screenshot */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-2xl bg-card border border-border/80 shadow-2xl rounded-xl overflow-hidden flex flex-col h-[520px] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* MODAL HEADER */}
            <div className="px-5 py-3 border-b border-border bg-card flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">Select attributes</h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* TWO COLUMN CONTENT */}
            <div className="flex-1 flex overflow-hidden">
              {/* LEFT COLUMN: ASSETS TREE PANEL */}
              <div className="w-5/12 border-r border-border bg-secondary/10 flex flex-col">
                {/* Header matching Primary Accent Color */}
                <div
                  style={{ backgroundColor: accentColor }}
                  className="text-white px-3.5 py-2.5 flex items-center justify-between font-bold text-xs shadow-xs"
                >
                  <span>Assets</span>
                  <div className="flex items-center gap-2">
                    <X className="w-3.5 h-3.5 cursor-pointer hover:opacity-80" onClick={() => setFilterText('')} />
                    <Filter className="w-3.5 h-3.5 cursor-pointer hover:opacity-80" />
                  </div>
                </div>

                {/* Filter Search Bar */}
                <div className="p-2.5 border-b border-border bg-card">
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      placeholder="Filter..."
                      value={filterText}
                      onChange={(e) => setFilterText(e.target.value)}
                      className="w-full h-8 text-xs bg-secondary/35 pr-8 pl-2.5 rounded-md border border-border text-foreground focus:outline-none focus:border-primary"
                    />
                    <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 pointer-events-none" />
                  </div>
                </div>

                {/* Asset Tree List */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1 text-xs scrollbar-thin">
                  {/* Root "All Assets" Node */}
                  <div
                    onClick={() => setActiveAssetId('all')}
                    style={{
                      borderLeftColor: activeAssetId === 'all' ? accentColor : 'transparent',
                      backgroundColor: activeAssetId === 'all' ? `${accentColor}18` : undefined,
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md cursor-pointer transition-all border-l-4 text-xs ${
                      activeAssetId === 'all'
                        ? 'font-bold text-foreground shadow-xs'
                        : 'border-transparent hover:bg-secondary/60 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="truncate flex-1 font-bold">Semua Asset (All)</span>
                  </div>

                  <div className="border-t border-border/40 my-1" />

                  {treeData.map((node) => renderAssetTreeNode(node, 0))}
                </div>
              </div>

              {/* RIGHT COLUMN: ATTRIBUTES CHECKBOX LIST PANEL */}
              <div className="w-7/12 bg-card flex flex-col">
                {/* Header Bar */}
                <div className="bg-secondary/35 px-4 py-2.5 border-b border-border font-bold text-xs text-muted-foreground flex justify-between items-center">
                  <span>Attributes</span>
                  <span className="text-[10px] font-mono text-muted-foreground/80">
                    {activeAssetId === 'all' ? 'Semua Asset' : assets.find((a) => a.id === activeAssetId)?.name}
                  </span>
                </div>

                {/* Attributes Checkbox List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-1.5 text-xs scrollbar-thin">
                  {/* Option: All Attributes */}
                  <div
                    onClick={() => setActiveAttribute('all')}
                    style={
                      activeAttribute === 'all'
                        ? {
                            backgroundColor: `${accentColor}18`,
                            color: accentColor,
                            borderColor: `${accentColor}40`,
                          }
                        : undefined
                    }
                    className={`px-3 py-2.5 rounded-lg cursor-pointer transition-all flex items-center justify-between border ${
                      activeAttribute === 'all' ? 'font-bold shadow-xs' : 'border-transparent hover:bg-secondary/60 text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                          activeAttribute === 'all' ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40 bg-transparent'
                        }`}
                        style={activeAttribute === 'all' ? { backgroundColor: accentColor, borderColor: accentColor } : undefined}
                      >
                        {activeAttribute === 'all' && <Check className="w-3 h-3 stroke-[3] text-white" />}
                      </div>
                      <span className="font-bold">Semua Attribute (All Attributes)</span>
                    </div>
                  </div>

                  <div className="border-t border-border/40 my-1" />

                  {/* Individual Attributes */}
                  {currentAssetAttributes.map((attr) => {
                    const isSelected = activeAttribute.toLowerCase() === attr.name.toLowerCase();

                    return (
                      <div
                        key={attr.name}
                        onClick={() => setActiveAttribute(attr.name)}
                        style={
                          isSelected
                            ? {
                                backgroundColor: `${accentColor}18`,
                                color: accentColor,
                                borderColor: `${accentColor}40`,
                              }
                            : undefined
                        }
                        className={`px-3 py-2.5 rounded-lg cursor-pointer transition-all flex items-center justify-between border ${
                          isSelected ? 'font-bold shadow-xs' : 'border-transparent hover:bg-secondary/60 text-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                              isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40 bg-transparent'
                            }`}
                            style={isSelected ? { backgroundColor: accentColor, borderColor: accentColor } : undefined}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3] text-white" />}
                          </div>
                          <span>{attr.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* MODAL FOOTER */}
            <div className="px-5 py-3 border-t border-border bg-card flex items-center justify-end gap-5">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{ color: accentColor }}
                className="text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer hover:opacity-80"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={handleApplySelection}
                style={{ backgroundColor: accentColor }}
                className="px-5 py-1.5 text-xs font-bold text-white rounded-lg shadow-sm transition-all cursor-pointer uppercase tracking-wider hover:opacity-90"
              >
                ADD
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
