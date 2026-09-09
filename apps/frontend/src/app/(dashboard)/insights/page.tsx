'use client';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Responsive, Layout, cloneLayoutItem, collides } from 'react-grid-layout';
const ResponsiveReactGridLayout = Responsive as any;

// Helper: resolve all collisions in a layout without compacting upward.
// Two-pass: moved items first (keep dropped position), then others top-to-bottom.
function resolveLayoutCollisions(layout: any[], movedItemId?: string): any[] {
  const out: any[] = new Array(layout.length);
  const resolved: any[] = [];

  const pushDown = (item: any) => {
    let hasCollision = true;
    while (hasCollision) {
      hasCollision = false;
      for (const r of resolved) {
        if (collides(item, r)) {
          item.y = r.y + r.h;
          hasCollision = true;
          break;
        }
      }
    }
  };

  // Pass 1: Place static + moved (dragged) items first
  for (let i = 0; i < layout.length; i++) {
    const item = layout[i];
    const isMoved = movedItemId ? item.i === movedItemId : (item.moved || false);
    if (item.static || isMoved) {
      const l = cloneLayoutItem(item);
      if (isMoved) pushDown(l);
      resolved.push(l);
      out[i] = l;
    }
  }

  // Pass 2: Remaining items, sorted top-to-bottom
  const remaining: number[] = [];
  for (let i = 0; i < layout.length; i++) {
    const item = layout[i];
    const isMoved = movedItemId ? item.i === movedItemId : (item.moved || false);
    if (!item.static && !isMoved) remaining.push(i);
  }
  remaining.sort((a, b) => {
    if (layout[a].y !== layout[b].y) return layout[a].y - layout[b].y;
    return layout[a].x - layout[b].x;
  });

  for (const idx of remaining) {
    const l = cloneLayoutItem(layout[idx]);
    pushDown(l);
    resolved.push(l);
    out[idx] = l;
  }

  for (const item of out) { if (item) item.moved = false; }
  return out;
}
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import {
  Activity, LayoutGrid, Settings2, Plus, GripHorizontal, Settings, LineChart, Hash, MapPin, Tablet, Edit2, Trash2, Check, X, RefreshCw, Eye, EyeOff, LayoutTemplate, ExternalLink, Minimize2, Save, Lock, ChevronDown, Search, Filter, SlidersHorizontal, ChevronRight, ArrowLeftRight,
  HardDrive, Building, Boxes, Radio, Truck, Wrench, Battery, Tag, Tv, Navigation, Layers, Wifi, Database, Server, Anchor, Gauge, Compass, DoorClosed, Box, Plug, Monitor, Lightbulb, Zap, Folder, Globe, Car, Cpu
} from 'lucide-react';
import { getApiUrl, getBackendUrl } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import ConfirmModal from '../../components/ConfirmModal';
import { useSocket } from '../../context/SocketContext';
import { getAssetMarkerIcon } from '../../lib/icon-utils';
import { ValueCardWidget } from '../components/widgets/ValueCardWidget';
import { KPIWidget } from '../components/widgets/KPIWidget';
import { GaugeWidget } from '../components/widgets/GaugeWidget';
import { ChartWidget } from '../components/widgets/ChartWidget';
import { MapWidget } from '../components/widgets/MapWidget';

const ICON_MAP: Record<string, React.ElementType> = {
  MapPin,
  HardDrive,
  Activity,
  Boxes,
  Sliders: SlidersHorizontal,
  SlidersHorizontal,
  Folder,
  Globe,
  Car,
  Cpu,
  Radio,
  Zap,
  Truck,
  Wrench,
  Battery,
  Tag,
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
  DoorClosed,
  Building,
  Box,
  Plug,
  Monitor
};

let globalDbAssetTypesCache: any[] = [];

const getAssetIconAndColor = (asset: any, fallbackName = '', dbAssetTypesList: any[] = []) => {
  let IconComp = Zap;
  let color = '#3b82f6';
  const list = dbAssetTypesList.length > 0 ? dbAssetTypesList : globalDbAssetTypesCache;

  if (asset) {
    const t = String(asset.type || asset.code || '').toUpperCase();
    const matched = list.find((x: any) => x.code.toUpperCase() === t);
    if (matched) {
      let iconName = matched.icon;
      if (!iconName || !ICON_MAP[iconName]) {
        if (t === 'ANCHOR') iconName = 'MapPin';
        else if (t === 'TAG' || t.includes('BLE')) iconName = 'HardDrive';
        else if (t === 'MESH_EYE_SENSOR' || t.includes('SENSOR')) iconName = 'Activity';
        else iconName = 'Boxes';
      }
      const comp = ICON_MAP[iconName] || Boxes;
      return { IconComp: comp, color: matched.color || '#3b82f6' };
    }

    if (asset.color) color = asset.color;

    // 1. Check direct asset.icon string (from AssetType DB)
    if (asset.icon && ICON_MAP[asset.icon]) {
      return { IconComp: ICON_MAP[asset.icon], color };
    }

    // 2. Check asset.type or asset.code
    if (t === 'ANCHOR') return { IconComp: MapPin, color: color || '#f43f5e' };
    if (t === 'TAG' || t.includes('BLE')) return { IconComp: HardDrive, color: color || '#3b82f6' };
    if (t === 'MESH_EYE_SENSOR' || t.includes('SENSOR')) return { IconComp: Activity, color: color || '#10b981' };
    if (t === 'FORKLIFT' || t.includes('CARGO') || t.includes('THINGS')) return { IconComp: Boxes, color: color || '#d97706' };
    if (t === 'LIGHT' || t.includes('MACHINE')) return { IconComp: SlidersHorizontal, color: color || '#eab308' };
    if (t === 'BUILDING' || t.includes('ROOM') || t.includes('DOOR')) return { IconComp: Folder, color: color || '#8b5cf6' };
    if (t === 'CITY' || t.includes('WEATHER')) return { IconComp: Globe, color: color || '#06b6d4' };
    if (t === 'CAR' || t.includes('VEHICLE') || t.includes('TRUCK')) return { IconComp: Car, color: color || '#0284c7' };
    if (t.includes('TELTONIKA') || t.includes('CPU')) return { IconComp: Cpu, color: color || '#6366f1' };
    if (t.includes('MQTT') || t.includes('RADIO')) return { IconComp: Radio, color: color || '#8b5cf6' };
  }

  const nameLower = (fallbackName || asset?.name || '').toLowerCase();
  if (nameLower.includes('lampu') || nameLower.includes('light')) return { IconComp: Lightbulb, color: color || '#eab308' };
  if (nameLower.includes('mobil') || nameLower.includes('car')) return { IconComp: Car, color: color || '#0284c7' };
  if (nameLower.includes('door') || nameLower.includes('pintu')) return { IconComp: DoorClosed, color: color || '#8b5cf6' };
  if (nameLower.includes('building') || nameLower.includes('gedung')) return { IconComp: Building, color: color || '#8b5cf6' };
  if (nameLower.includes('forklift') || nameLower.includes('cargo')) return { IconComp: Boxes, color: color || '#d97706' };
  if (nameLower.includes('tag')) return { IconComp: HardDrive, color: color || '#3b82f6' };
  if (nameLower.includes('anchor')) return { IconComp: MapPin, color: color || '#f43f5e' };
  if (nameLower.includes('mesh') || nameLower.includes('sensor')) return { IconComp: Activity, color: color || '#10b981' };

  return { IconComp, color };
};



// Reusable Searchable Select Component with Portal-like floating style
const SearchableSelect = ({ options, value, onChange, placeholder = "Select...", alwaysSearchable = false }: { options: { label: string, value: string, icon?: React.ElementType }[], value: string, onChange: (val: string) => void, placeholder?: string, alwaysSearchable?: boolean }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as globalThis.Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value);
  const SelectedIcon = selectedOption?.icon;

  const filteredOptions = alwaysSearchable || options.length > 5
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const showSearch = alwaysSearchable || options.length > 5;

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        className="w-full h-9 bg-background border border-border px-2.5 py-1.5 rounded-lg text-sm cursor-pointer flex justify-between items-center transition-colors hover:border-primary/50"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center truncate">
          {SelectedIcon && <SelectedIcon className="w-3.5 h-3.5 mr-2 text-primary shrink-0" />}
          <span className="text-xs font-semibold text-slate-700 truncate pr-2">{selectedOption ? selectedOption.label : placeholder}</span>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      </div>

      {open && (
        <div className="absolute z-[999] top-full mt-1 w-full left-0 bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {showSearch && (
            <div className="p-2 border-b border-border bg-secondary/20 flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent border-none outline-none text-xs font-medium"
                autoFocus
              />
            </div>
          )}
          <div className="max-h-56 overflow-y-auto p-1">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-xs text-muted-foreground text-center">No results found</div>
            ) : (
              filteredOptions.map(o => {
                const Icon = o.icon;
                return (
                  <div
                    key={o.value}
                    className="flex items-center px-3 py-2 text-xs hover:bg-secondary cursor-pointer rounded-lg truncate transition-colors"
                    onClick={() => { onChange(o.value); setOpen(false); setSearch(""); }}
                  >
                    {Icon && <Icon className="w-3.5 h-3.5 mr-2.5 text-muted-foreground" />}
                    <span className="font-semibold text-slate-700">{o.label}</span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};


const CustomSidebarSelect = ({
  value,
  onChange,
  options,
  primaryAccentColor
}: {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string; icon?: React.ReactNode | string }[];
  primaryAccentColor?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const selectedOpt = options.find(o => o.value === value) || options[0];

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-xs font-bold p-2.5 border border-border rounded-xl bg-card text-foreground flex items-center justify-between shadow-xs transition-all hover:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer"
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          {selectedOpt?.icon && (
            <span className="w-4 h-4 shrink-0 flex items-center justify-center text-primary" style={primaryAccentColor ? { color: primaryAccentColor } : undefined}>
              {typeof selectedOpt.icon === 'string' ? (
                <span dangerouslySetInnerHTML={{ __html: selectedOpt.icon }} className="w-4 h-4 flex items-center justify-center [&>svg]:w-4 [&>svg]:h-4" />
              ) : (
                selectedOpt.icon
              )}
            </span>
          )}
          <span className="truncate">{selectedOpt?.label}</span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-xl max-h-48 overflow-y-auto backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 z-50 p-1 custom-scrollbar">
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'
                  }`}
                style={isSelected && primaryAccentColor ? { color: primaryAccentColor } : undefined}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {opt.icon && (
                    <span className="w-4 h-4 shrink-0 flex items-center justify-center" style={primaryAccentColor ? { color: primaryAccentColor } : undefined}>
                      {typeof opt.icon === 'string' ? (
                        <span dangerouslySetInnerHTML={{ __html: opt.icon }} className="w-4 h-4 flex items-center justify-center [&>svg]:w-4 [&>svg]:h-4" />
                      ) : (
                        opt.icon
                      )}
                    </span>
                  )}
                  <span className="truncate">{opt.label}</span>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5" style={primaryAccentColor ? { color: primaryAccentColor } : undefined} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const WIDGET_TEMPLATES = [
  { type: 'valueCard', label: 'Value Card', icon: Hash, w: 3, h: 2, minW: 2, minH: 2 },
  { type: 'kpi', label: 'KPI', icon: Plus, w: 3, h: 2, minW: 2, minH: 2 },
  { type: 'gauge', label: 'Gauge', icon: Activity, w: 3, h: 3, minW: 2, minH: 2 },
  { type: 'chart', label: 'Chart', icon: LineChart, w: 8, h: 5, minW: 4, minH: 3 },
  { type: 'rtls_map', label: 'Denah RTLS', icon: Layers, w: 8, h: 5, minW: 4, minH: 3 },
  { type: 'gis_map', label: 'Map View GIS', icon: Globe, w: 8, h: 5, minW: 4, minH: 3 },
];

type WidgetData = { id: string, type: string, config: any };
type SectionData = { id: string, name: string, layout: Layout, widgets: WidgetData[] };

const ATTRIBUTES = [
  { value: 'temperature', label: 'Temperature (°C)' },
  { value: 'humidity', label: 'Humidity (%)' },
  { value: 'battery', label: 'Battery (V)' },
  { value: 'rssi', label: 'RSSI (dBm)' }
];

export default function InsightsPage() {
  const { tenantId, token, user, isSuperAdmin } = useAuth();
  const { socket, assets: socketAssets } = useSocket();
  const router = useRouter();

  const searchParams = useSearchParams();
  const isFullView = searchParams.get('fullscreen') === 'true' || searchParams.get('fullview') === 'true';

  const handleOpenFullView = () => {
    if (isFullView) {
      router.push('/insights');
    } else {
      router.push('/insights?fullview=true');
    }
  };

  // Branding & Theme state (White Label Tenant vs Global System Branding)
  const [platformThemeColor, setPlatformThemeColor] = useState<string | null>(null);
  const [dbAssetTypes, setDbAssetTypes] = useState<any[]>([]);

  const isWhiteLabelTenant = !isSuperAdmin && Boolean(user?.isWhiteLabel);
  const primaryAccentColor = (isWhiteLabelTenant && user?.tenantThemeColor) ? user.tenantThemeColor : (platformThemeColor || '#10b981');

  useEffect(() => {
    let isMounted = true;
    const fetchBrandingAndAssetTypes = async () => {
      try {
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (tenantId) headers['x-tenant-id'] = tenantId;

        const [resSettings, resTypes] = await Promise.all([
          fetch(`${getApiUrl()}/system-settings`, { headers }),
          fetch(`${getApiUrl()}/asset-types`, { headers })
        ]);

        if (resSettings.ok && isMounted) {
          const data = await resSettings.json();
          if (data.platform_theme_color) setPlatformThemeColor(data.platform_theme_color);
        }
        if (resTypes.ok && isMounted) {
          const data = await resTypes.json();
          setDbAssetTypes(data);
          globalDbAssetTypesCache = data;
        }
      } catch (e) { }
    };
    fetchBrandingAndAssetTypes();
    return () => { isMounted = false; };
  }, [token, tenantId]);

  const apiClient = {
    get: async (path: string) => {
      const res = await fetch(`${getApiUrl()}${path}`, { headers: { 'Authorization': `Bearer ${token}`, 'x-tenant-id': tenantId || '', 'Content-Type': 'application/json' } });
      if (!res.ok) throw new Error('API Error');
      return { data: await res.json() };
    },
    post: async (path: string, body: any = {}) => {
      const res = await fetch(`${getApiUrl()}${path}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'x-tenant-id': tenantId || '', 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error('API Error');
      return { data: await res.json() };
    },
    put: async (path: string, body: any) => {
      const res = await fetch(`${getApiUrl()}${path}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'x-tenant-id': tenantId || '', 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error('API Error');
      return { data: await res.json() };
    },
    delete: async (path: string) => {
      const res = await fetch(`${getApiUrl()}${path}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}`, 'x-tenant-id': tenantId || '', 'Content-Type': 'application/json' }
      });
      if (!res.ok) throw new Error('API Error');
      return { data: await res.json() };
    }
  };

  const [sections, setSections] = useState<SectionData[]>([]);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Edit / Modify Toggle & Dirty States
  const [isEditMode, setIsEditMode] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [backupSectionData, setBackupSectionData] = useState<{ layout: Layout, widgets: WidgetData[] } | null>(null);
  const [editSectionName, setEditSectionName] = useState('');

  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('widgets');
  const [isValuesOpen, setIsValuesOpen] = useState(true);
  const [isThresholdsOpen, setIsThresholdsOpen] = useState(true);
  const [isDisplayOpen, setIsDisplayOpen] = useState(true);

  const ToggleSwitch: React.FC<{
    checked: boolean;
    onChange: (checked: boolean) => void;
    primaryColor?: string;
  }> = ({ checked, onChange, primaryColor = '#10b981' }) => {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={(e) => {
          e.stopPropagation();
          onChange(!checked);
        }}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${checked ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'
          }`}
        style={checked ? { backgroundColor: primaryColor } : undefined}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'
            }`}
        />
      </button>
    );
  };

  // Select Attributes Modal Popup State (Matching Target Images)
  const [isAttrPickerOpen, setIsAttrPickerOpen] = useState(false);
  const [pickerSelectedAssetId, setPickerSelectedAssetId] = useState('');
  const [pickerSelectedAttribute, setPickerSelectedAttribute] = useState('');
  const [assetSearchFilter, setAssetSearchFilter] = useState('');
  const [collapsedAssetIds, setCollapsedAssetIds] = useState<Record<string, boolean>>({});
  const [isAttributesSectionOpen, setIsAttributesSectionOpen] = useState(true);

  // Linked Assets Modal Popup State for Map Widgets
  const [isLinkedAssetsOpen, setIsLinkedAssetsOpen] = useState(false);
  const [linkedAssetsSelectedIds, setLinkedAssetsSelectedIds] = useState<Set<string>>(new Set());
  const [linkedAssetsFilter, setLinkedAssetsFilter] = useState('');
  const [collapsedLinkedAssetIds, setCollapsedLinkedAssetIds] = useState<Record<string, boolean>>({});
  const [isAxisConfigOpen, setIsAxisConfigOpen] = useState(true);

  const toggleExpandAsset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedAssetIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Custom Confirm Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText?: string;
    variant: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);

  const draggingWidgetRef = useRef<string | null>(null);

  // Drag state refs for dynamic preview collision resolution
  const isDraggingGridRef = useRef(false);
  const draggedItemIdRef = useRef<string | null>(null);
  const dragStartLayoutRef = useRef<any[] | null>(null);
  const skipNextLayoutChangeRef = useRef(false);

  // Compactor: during drag → compute preview based on initial layout before drag started
  const gridCompactor = useMemo(() => ({
    type: null,
    allowOverlap: false,
    preventCollision: false,
    compact(layout: any[], _cols: number) {
      if (isDraggingGridRef.current && dragStartLayoutRef.current) {
        const movedId = draggedItemIdRef.current;
        const movedItemInCurrent = layout.find((l: any) => l.i === movedId);

        if (movedItemInCurrent && movedId) {
          const candidate = dragStartLayoutRef.current.map((startItem: any) => {
            if (startItem.i === movedId) {
              const l = cloneLayoutItem(startItem);
              l.x = movedItemInCurrent.x;
              l.y = movedItemInCurrent.y;
              l.w = movedItemInCurrent.w;
              l.h = movedItemInCurrent.h;
              l.moved = true;
              return l;
            }
            return cloneLayoutItem(startItem);
          });
          return resolveLayoutCollisions(candidate, movedId);
        }
      }
      return resolveLayoutCollisions(layout);
    }
  }), []);

  // Helper to extract attributes registered on the asset (JSON description or Tag model standard fields)
  const getAssetAttributes = (assetId: string) => {
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return [];

    const list: { value: string; label: string }[] = [];

    // 1. Try to read from JSON description (registeredAttributes)
    let parsedDesc: any = {};
    if (asset.description) {
      try {
        parsedDesc = JSON.parse(asset.description);
      } catch (e) { }
    }
    const registered: any[] = parsedDesc.attributes || [];
    registered.forEach((attr: any) => {
      if (attr.name) {
        list.push({
          value: attr.name,
          label: attr.label || attr.name.charAt(0).toUpperCase() + attr.name.slice(1)
        });
      }
    });

    // 2. If tag exists, ensure standard attributes are included if they have values or as fallbacks
    if (asset.tag) {
      const standard = [
        { value: 'temperature', label: 'Temperature (°C)' },
        { value: 'humidity', label: 'Humidity (%)' },
        { value: 'battery', label: 'Battery (V)' },
        { value: 'rssi', label: 'RSSI (dBm)' }
      ];
      standard.forEach(std => {
        if (!list.some(x => x.value === std.value)) {
          if (asset.tag[std.value] !== null && asset.tag[std.value] !== undefined) {
            list.push(std);
          }
        }
      });
    }

    return list;
  };

  // Asset and telemetry state
  const [assets, setAssets] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [telemetryData, setTelemetryData] = useState<Record<string, any>>({});

  useEffect(() => {
    if (socketAssets && socketAssets.length > 0) {
      setAssets(socketAssets);
    }
  }, [socketAssets]);

  // Unified asset-attribute options list for single attribute selectors
  const allAssetAttributeOptions = useMemo(() => {
    const list: { label: string; value: string; assetId: string; attribute: string }[] = [];
    assets.forEach(asset => {
      const attrs = getAssetAttributes(asset.id);
      attrs.forEach(attr => {
        list.push({
          value: `${asset.id}::${attr.value}`,
          label: `${asset.name} - ${attr.label}`,
          assetId: asset.id,
          attribute: attr.value
        });
      });
    });
    return list;
  }, [assets]);

  // Time range filters state for chart widgets
  const [widgetRanges, setWidgetRanges] = useState<Record<string, { range: string, startDate?: string, endDate?: string }>>({});

  // Add Target states for chart widget editor
  const [newTargetAssetId, setNewTargetAssetId] = useState('');
  const [newTargetAttribute, setNewTargetAttribute] = useState('');

  useEffect(() => {
    setNewTargetAssetId('');
    setNewTargetAttribute('');
  }, [selectedWidgetId]);

  const setWidgetRange = (widgetId: string, range: string) => {
    setWidgetRanges(prev => {
      const existing = prev[widgetId] || {};
      return {
        ...prev,
        [widgetId]: {
          range,
          startDate: range === 'custom' ? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0] : existing.startDate,
          endDate: range === 'custom' ? new Date().toISOString().split('T')[0] : existing.endDate
        }
      };
    });
    // Trigger immediate refetch
    setTimeout(() => {
      fetchAllTelemetry();
    }, 50);
  };

  const updateCustomRange = (widgetId: string, field: 'startDate' | 'endDate', val: string) => {
    setWidgetRanges(prev => {
      const existing = prev[widgetId] || { range: 'custom' };
      return {
        ...prev,
        [widgetId]: {
          ...existing,
          [field]: val
        }
      };
    });
    // Trigger immediate refetch
    setTimeout(() => {
      fetchAllTelemetry();
    }, 50);
  };

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.getBoundingClientRect().width);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isLoading]);

  // Global Navigation & Reload Guard for Unsaved Changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = 'Dashboard has been edited, do you want to discard the changes?';
        return e.returnValue;
      }
    };

    const handleAnchorClick = (e: MouseEvent) => {
      if (!isDirty) return;

      let target = e.target as HTMLElement | null;
      while (target && target.tagName !== 'A') {
        target = target.parentElement;
      }

      if (target && target.getAttribute('href')) {
        const href = target.getAttribute('href');
        if (href && !href.startsWith('#') && !href.includes('insights')) {
          // Block navigation synchronously
          e.preventDefault();
          e.stopPropagation();

          // Open custom confirmation modal
          setConfirmModal({
            isOpen: true,
            title: 'Discard Changes',
            message: 'Dashboard has been edited, do you want to discard the changes?',
            confirmText: 'Discard',
            cancelText: 'Keep Editing',
            variant: 'warning',
            onConfirm: () => {
              setIsDirty(false);
              setConfirmModal(null);
              router.push(href);
            }
          });
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleAnchorClick, true);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleAnchorClick, true);
    };
  }, [isDirty, router]);

  // Fetch sections
  useEffect(() => {
    if (tenantId) {
      fetchSections();
      apiClient.get('/assets')
        .then(res => setAssets(res.data))
        .catch(err => console.error('Failed to fetch assets', err));
      apiClient.get('/zones')
        .then(res => setZones(res.data))
        .catch(err => console.error('Failed to fetch zones', err));
    }
  }, [tenantId]);

  const fetchSections = async () => {
    try {
      setIsLoading(true);
      const res = await apiClient.get('/dashboard/sections');
      const loadedSections = res.data.map((sec: any) => {
        let rawLayout = sec.layout ? JSON.parse(sec.layout) : [];
        const widgetsList = sec.widgets || [];
        // Strip saved minW/minH from DB to allow free resizing
        rawLayout = rawLayout.map((l: any) => {
          const { minW, minH, ...rest } = l;
          return rest;
        });
        // Layout stored as-is (12-column system, no migration needed)
        return {
          id: sec.id,
          name: sec.name,
          layout: rawLayout,
          widgets: sec.widgets.map((w: any) => ({
            id: w.id,
            type: w.type,
            config: w.config ? JSON.parse(w.config) : { title: '', assetId: '', attribute: 'temperature', attributes: ['temperature'] }
          }))
        };
      });
      setSections(loadedSections);
      if (loadedSections.length > 0 && !activeSectionId) {
        setActiveSectionId(loadedSections[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch sections', err);
    } finally {
      setIsLoading(false);
    }
  };

  const activeSection = sections.find(s => s.id === activeSectionId);
  const rawLayout = activeSection?.layout || [];
  const layout = useMemo(() => {
    return rawLayout.map((item: any) => ({
      ...item,
      resizeHandles: isEditMode ? ['s', 'w', 'e', 'n', 'sw', 'nw', 'se', 'ne'] : []
    }));
  }, [rawLayout, isEditMode]);
  const widgets = activeSection?.widgets || [];

  // Compute maximum row index of current widgets
  const maxRow = useMemo(() => {
    if (!layout || layout.length === 0) return 10;
    return Math.max(...layout.map((item: any) => (Number(item.y) || 0) + (Number(item.h) || 1)));
  }, [layout]);

  // Compute dynamic canvas height (extends with extra buffer rows in edit mode)
  const dynamicCanvasHeight = useMemo(() => {
    const totalRows = isEditMode ? Math.max(24, maxRow + 15) : Math.max(12, maxRow + 2);
    return totalRows * 48 + 24; // 40px rowHeight + 8px margin + 24px padding
  }, [maxRow, isEditMode]);

  // Update input name whenever active section changes
  const activeSectionName = activeSection?.name;
  useEffect(() => {
    if (activeSectionName) {
      setEditSectionName(activeSectionName);
    }
  }, [activeSectionId, activeSectionName]);

  // Polling telemetry data for active widgets
  const widgetsDependency = JSON.stringify(
    widgets.map(w => ({
      id: w.id,
      assetId: w.config?.assetId,
      attribute: w.config?.attribute,
      attributes: w.config?.attributes,
      timeframe: w.config?.timeframe
    }))
  );


  const widgetRangesDependency = JSON.stringify(widgetRanges);

  const fetchAllTelemetry = useCallback(async () => {
    if (!activeSectionId || widgets.length === 0) return;
    const newData: Record<string, any> = {};

    await Promise.all(
      widgets.map(async (widget) => {
        const { assetId, attributes, attribute } = widget.config || {};
        if (!assetId) return;

        if (widget.type === 'chart') {
          const rangeInfo = widgetRanges[widget.id] || { range: '24h' };
          let targets = widget.config.targets || [];
          if (targets.length === 0 && assetId) {
            const attrs = attributes || ['temperature'];
            targets = attrs.map((attr: string) => ({ assetId, attribute: attr }));
          }

          let queryParams = `range=${rangeInfo.range}`;
          if (rangeInfo.range === 'custom' && rangeInfo.startDate) {
            queryParams = `startDate=${encodeURIComponent(new Date(rangeInfo.startDate).toISOString())}`;
            if (rangeInfo.endDate) {
              queryParams += `&endDate=${encodeURIComponent(new Date(rangeInfo.endDate).toISOString())}`;
            }
          }

          const results = await Promise.all(
            targets.map(async (t: { assetId: string, attribute: string }) => {
              const assetName = assets.find(a => a.id === t.assetId)?.name || t.assetId;
              try {
                const res = await apiClient.get(`/assets/${t.assetId}/telemetry?attribute=${t.attribute}&${queryParams}`);
                return { attr: `${assetName} - ${t.attribute}`, data: res.data };
              } catch (e) {
                return { attr: `${assetName} - ${t.attribute}`, data: [] };
              }
            })
          );
          newData[widget.id] = results;
        } else if (widget.type === 'maps' || widget.type === 'gis_map' || widget.type === 'rtls_map') {
          try {
            const targetAttribute = widget.config?.attribute || 'humidity';
            const normAttr = targetAttribute.toLowerCase();
            const assetType = widget.config?.assetType || '';
            const allAssetsOfType = widget.config?.allAssetsOfType ?? true;
            const selectedAssetIds: string[] = widget.config?.selectedAssetIds || (widget.config?.assetId ? [widget.config?.assetId] : []);

            let targetAssets = assets;
            if (assetType) {
              targetAssets = assets.filter(a => String(a.type || '').toUpperCase() === String(assetType).toUpperCase());
            }
            if (!allAssetsOfType && selectedAssetIds.length > 0) {
              targetAssets = assets.filter(a => selectedAssetIds.includes(a.id));
            }

            const telemetryByAsset: Record<string, Record<string, any>> = {};

            await Promise.all(
              targetAssets.map(async (a: any) => {
                try {
                  const r = await apiClient.get(`/assets/${a.id}/telemetry?attribute=${targetAttribute}&range=1h`);
                  if (r.data && Array.isArray(r.data) && r.data.length > 0) {
                    const lastVal = r.data[r.data.length - 1].value;
                    if (!telemetryByAsset[a.id]) telemetryByAsset[a.id] = {};
                    telemetryByAsset[a.id][normAttr] = lastVal;
                  }
                } catch (e) {
                  // Ignore telemetry fetch failure for individual asset
                }
              })
            );

            newData[widget.id] = { telemetryByAsset };
          } catch (e) {
            console.error(e);
          }
        } else {
          const attr = attribute || 'temperature';
          const targetAsset = assets.find(a => a.id === assetId);

          if (widget.type === 'kpi') {
            const timeframe = widget.config?.timeframe || 'Hour';
            const rangeMap: Record<string, string> = {
              Hour: '1h',
              Day: '1d',
              Week: '1w',
              Month: '1m'
            };
            const range = rangeMap[timeframe] || '1h';

            try {
              const res = await apiClient.get(`/assets/${assetId}/telemetry?attribute=${attr}&range=${range}`);
              let series: { timestamp: string, value: number }[] = [];
              let latestVal: number | null = null;
              let latestTimestamp: string | undefined = undefined;

              if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                series = res.data.map((p: any) => ({
                  timestamp: p.timestamp || p.createdAt,
                  value: typeof p.value === 'number' ? p.value : Number(p.value)
                }));
                const latestPoint = res.data[res.data.length - 1];
                latestVal = typeof latestPoint.value === 'number' ? latestPoint.value : Number(latestPoint.value);
                latestTimestamp = latestPoint.timestamp || latestPoint.createdAt;
              } else if (targetAsset && targetAsset.description && targetAsset.description.startsWith('{')) {
                try {
                  const desc = JSON.parse(targetAsset.description);
                  const matched = (desc.attributes || []).find((a: any) => a.name === attr);
                  if (matched && matched.value !== undefined && matched.value !== null && matched.value !== '') {
                    latestVal = Number(matched.value);
                  }
                } catch (e) { }
              }

              newData[widget.id] = {
                value: latestVal,
                timestamp: latestTimestamp,
                series,
                asset: targetAsset
              };
            } catch (e) {
              newData[widget.id] = { value: null, series: [], asset: targetAsset };
            }
          } else if (widget.type === 'valueCard') {
            try {
              const res = await apiClient.get(`/assets/${assetId}/telemetry?attribute=${attr}&range=24h`);
              let latestVal: any = null;
              let latestTimestamp: string | undefined = undefined;

              if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                const latestPoint = res.data[res.data.length - 1];
                latestVal = latestPoint.value !== undefined && latestPoint.value !== null ? latestPoint.value : null;
                latestTimestamp = latestPoint.timestamp || latestPoint.createdAt;
              } else if (targetAsset && targetAsset.description && targetAsset.description.startsWith('{')) {
                try {
                  const desc = JSON.parse(targetAsset.description);
                  const matched = (desc.attributes || []).find((a: any) => a.name === attr);
                  if (matched && matched.value !== undefined && matched.value !== null && matched.value !== '') {
                    latestVal = matched.value;
                  }
                } catch (e) { }
                if (targetAsset) {
                  latestTimestamp = targetAsset.updatedAt || targetAsset.createdAt;
                }
              }

              newData[widget.id] = {
                value: latestVal,
                timestamp: latestTimestamp,
                asset: targetAsset
              };
            } catch (e) {
              newData[widget.id] = { value: null, timestamp: undefined, asset: targetAsset };
            }

          } else {
            // Gauge widget
            try {
              const res = await apiClient.get(`/assets/${assetId}/telemetry?attribute=${attr}&range=24h`);
              if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                const latestPoint = res.data[res.data.length - 1];
                newData[widget.id] = typeof latestPoint.value === 'number' ? latestPoint.value : Number(latestPoint.value);
              } else if (targetAsset && targetAsset.description && targetAsset.description.startsWith('{')) {
                try {
                  const desc = JSON.parse(targetAsset.description);
                  const matched = (desc.attributes || []).find((a: any) => a.name === attr);
                  if (matched && matched.value !== undefined && matched.value !== null && matched.value !== '') {
                    newData[widget.id] = Number(matched.value);
                  } else {
                    newData[widget.id] = null;
                  }
                } catch (e) {
                  newData[widget.id] = null;
                }
              } else {
                newData[widget.id] = null;
              }
            } catch (e) {
              newData[widget.id] = null;
            }
          }
        }
      })
    );

    setTelemetryData(newData);
  }, [widgetsDependency, activeSectionId, widgetRangesDependency, assets]);

  useEffect(() => {
    fetchAllTelemetry();
    const interval = setInterval(fetchAllTelemetry, 10000);
    return () => clearInterval(interval);
  }, [fetchAllTelemetry]);

  // Real-time WebSocket update push for single-attribute widgets & chart widgets
  useEffect(() => {
    if (!socket) return;

    const handleAssetUpdate = (updatedAsset: any) => {
      widgets.forEach(widget => {
        if (widget.type === 'gauge' || widget.type === 'kpi' || widget.type === 'valueCard') {
          if (widget.config?.assetId === updatedAsset.id) {
            const attrName = widget.config?.attribute || 'temperature';
            if (updatedAsset.description && updatedAsset.description.startsWith('{')) {
              try {
                const desc = JSON.parse(updatedAsset.description);
                const descAttrs = desc.attributes || [];
                const matched = descAttrs.find((a: any) => a.name === attrName);
                if (matched && matched.value !== undefined && matched.value !== null && matched.value !== '') {
                  const rawVal = matched.value;
                  const numericVal = typeof rawVal === 'number' ? rawVal : Number(rawVal);
                  setTelemetryData(prev => ({
                    ...prev,
                    [widget.id]: widget.type === 'valueCard'
                      ? { value: rawVal, timestamp: updatedAsset.updatedAt || new Date().toISOString(), asset: updatedAsset }
                      : (isNaN(numericVal) ? rawVal : numericVal)
                  }));
                }
              } catch (e) { }
            }
          }
        } else if (widget.type === 'chart') {

          const rangeInfo = widgetRanges[widget.id] || { range: '24h' };
          if (rangeInfo.range === 'realtime') {
            let targets = widget.config.targets || [];
            if (targets.length === 0 && widget.config?.assetId) {
              const attrs = widget.config.attributes || ['temperature'];
              targets = attrs.map((attr: string) => ({ assetId: widget.config.assetId, attribute: attr }));
            }

            const matchingTargets = targets.filter((t: any) => t.assetId === updatedAsset.id);
            if (matchingTargets.length === 0) return;

            try {
              if (updatedAsset.description && updatedAsset.description.startsWith('{')) {
                const desc = JSON.parse(updatedAsset.description);
                const descAttrs = desc.attributes || [];

                setTelemetryData(prev => {
                  const currentWidgetData = prev[widget.id];
                  if (!Array.isArray(currentWidgetData)) return prev;

                  const updatedWidgetData = currentWidgetData.map(r => {
                    const targetMatch = matchingTargets.find((t: any) => {
                      const assetName = assets.find(a => a.id === t.assetId)?.name || t.assetId;
                      return r.attr === `${assetName} - ${t.attribute}`;
                    });

                    if (targetMatch) {
                      const attrMatch = descAttrs.find((a: any) => a.name === targetMatch.attribute);
                      if (attrMatch && attrMatch.value !== undefined && attrMatch.value !== null && attrMatch.value !== '') {
                        const newValue = Number(attrMatch.value);
                        const newPoint = {
                          timestamp: new Date().toISOString(),
                          value: newValue
                        };

                        let cleanPoints = [...(r.data || []), newPoint];
                        const tenMinsAgo = Date.now() - 10 * 60 * 1000;
                        cleanPoints = cleanPoints.filter(p => new Date(p.timestamp).getTime() >= tenMinsAgo);

                        return {
                          ...r,
                          data: cleanPoints
                        };
                      }
                    }
                    return r;
                  });

                  return {
                    ...prev,
                    [widget.id]: updatedWidgetData
                  };
                });
              }
            } catch (e) {
              console.error('Failed to handle realtime websocket update:', e);
            }
          }
        }
      });
    };

    socket.on('assetUpdate', handleAssetUpdate);
    return () => {
      socket.off('assetUpdate', handleAssetUpdate);
    };
  }, [socket, widgets, widgetRanges, assets]);

  const saveLayoutToDb = async (sectionId: string, layout: Layout, widgets: WidgetData[]) => {
    try {
      await apiClient.post(`/dashboard/sections/${sectionId}/save-layout`, {
        layout: JSON.stringify(layout),
        widgets
      });
    } catch (err) {
      console.error('Failed to save layout', err);
    }
  };

  const handleAddSection = async () => {
    try {
      const name = `Section ${sections.length + 1}`;
      const res = await apiClient.post('/dashboard/sections', { name });
      const newSec = { id: res.data.id, name: res.data.name, layout: [], widgets: [] };
      setSections([...sections, newSec]);
      setActiveSectionId(res.data.id);

      // Setup backup and enter edit mode immediately
      setBackupSectionData({ layout: [], widgets: [] });
      setIsEditMode(true);
      setIsDirty(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSection = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    setConfirmModal({
      isOpen: true,
      title: 'Delete Section',
      message: 'Apakah Anda yakin ingin menghapus Section ini secara permanen? Semua widget di dalamnya akan ikut terhapus.',
      confirmText: 'Delete Permanently',
      cancelText: 'Cancel',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await apiClient.delete(`/dashboard/sections/${id}`);
          const newSections = sections.filter(s => s.id !== id);
          setSections(newSections);
          if (activeSectionId === id) {
            setActiveSectionId(newSections.length > 0 ? newSections[0].id : null);
          }
        } catch (err) {
          console.error(err);
        }
        setConfirmModal(null);
      }
    });
  };

  const handleRenameSubmit = async (id: string) => {
    try {
      await apiClient.put(`/dashboard/sections/${id}`, { name: editingName });
      setSections(sections.map(s => s.id === id ? { ...s, name: editingName } : s));
      setEditingSectionId(null);
    } catch (err) {
      console.error(err);
    }
  };

  // Modify Mode Entry
  const handleModifyClick = () => {
    setBackupSectionData({
      layout: JSON.parse(JSON.stringify(layout)),
      widgets: JSON.parse(JSON.stringify(widgets))
    });
    setIsEditMode(true);
    setIsDirty(false);
  };

  // Save changes
  const handleSaveSectionDetails = async () => {
    if (!activeSectionId) return;
    try {
      await apiClient.put(`/dashboard/sections/${activeSectionId}`, { name: editSectionName });
      setSections(sections.map(s => s.id === activeSectionId ? { ...s, name: editSectionName } : s));
      await saveLayoutToDb(activeSectionId, layout, widgets);
      setIsDirty(false);
      setIsEditMode(false);
    } catch (err) {
      console.error(err);
    }
  };

  // Discard/Cancel Edit Mode changes
  const handleDiscardChanges = () => {
    if (isDirty) {
      setConfirmModal({
        isOpen: true,
        title: 'Discard Changes',
        message: 'Dashboard has been edited, do you want to discard the changes?',
        confirmText: 'Discard',
        cancelText: 'Keep Editing',
        variant: 'warning',
        onConfirm: () => {
          if (backupSectionData && activeSectionId) {
            setSections(prev => prev.map(sec =>
              sec.id === activeSectionId
                ? { ...sec, layout: backupSectionData.layout, widgets: backupSectionData.widgets }
                : sec
            ));
          }
          setIsDirty(false);
          setIsEditMode(false);
          setConfirmModal(null);
        }
      });
    } else {
      setIsEditMode(false);
    }
  };

  // Intercept section tab switching
  const handleSectionTabClick = (sectionId: string) => {
    if (isDirty) {
      setConfirmModal({
        isOpen: true,
        title: 'Discard Changes',
        message: 'Dashboard has been edited, do you want to discard the changes?',
        confirmText: 'Discard',
        cancelText: 'Keep Editing',
        variant: 'warning',
        onConfirm: () => {
          if (isEditMode && backupSectionData && activeSectionId) {
            setSections(prev => prev.map(sec =>
              sec.id === activeSectionId
                ? { ...sec, layout: backupSectionData.layout, widgets: backupSectionData.widgets }
                : sec
            ));
          }
          setActiveSectionId(sectionId);
          setIsEditMode(false);
          setIsDirty(false);
          setConfirmModal(null);
        }
      });
    } else {
      setActiveSectionId(sectionId);
      setIsEditMode(false);
      setIsDirty(false);
    }
  };

  const onDrop = (newLayout: Layout, layoutItem: any, e: Event) => {
    try {
      const widgetType = draggingWidgetRef.current;
      if (!widgetType || !activeSectionId) return;

      const template = WIDGET_TEMPLATES.find(t => t.type === widgetType);
      if (!template) return;

      const newId = `widget_${Date.now()}`;

      const newItem: any = {
        i: newId,
        x: layoutItem.x,
        y: layoutItem.y,
        w: template.w,
        h: template.h,
      };

      const newLayoutState = [...layout, newItem];
      const newWidgetsState = [
        ...widgets,
        {
          id: newId,
          type: widgetType,
          config: {
            title: template.label,
            assetId: '',
            attribute: '',
            attributes: [],
            ...(widgetType === 'rtls_map' && zones.length > 0 ? { zoneId: zones[0].id } : {})
          }
        }
      ];

      setSections(prev => prev.map(sec =>
        sec.id === activeSectionId ? { ...sec, layout: newLayoutState, widgets: newWidgetsState } : sec
      ));

      setIsDirty(true);
      draggingWidgetRef.current = null;
    } catch (err) {
      console.error('Drop error', err);
    }
  };

  const onDropDragOver = (e: any) => {
    const template = WIDGET_TEMPLATES.find(t => t.type === draggingWidgetRef.current);
    if (!template) return false;
    return { w: template.w, h: template.h };
  };

  // Remove Widget from state (called from Sidebar now)
  const removeWidget = (id: string) => {
    if (!activeSectionId) return;

    const newLayoutState = layout.filter(l => l.i !== id);
    const newWidgetsState = widgets.filter(w => w.id !== id);

    setSections(prev => prev.map(sec =>
      sec.id === activeSectionId ? { ...sec, layout: newLayoutState, widgets: newWidgetsState } : sec
    ));

    setIsDirty(true);
    if (selectedWidgetId === id) setSelectedWidgetId(null);
  };

  const layoutRef = useRef<string>('');

  // Keep layoutRef in sync with current layout (read-only, no state updates)
  useEffect(() => {
    layoutRef.current = JSON.stringify(layout);
  }, [layout]);

  const onLayoutChange = useCallback((newLayout: Layout, allLayouts: any) => {
    if (!activeSectionId || !isEditMode) return;

    // Skip the onLayoutChange that fires right after our manual onDragStop resolution
    if (skipNextLayoutChangeRef.current) {
      skipNextLayoutChangeRef.current = false;
      return;
    }

    const serialized = JSON.stringify(newLayout);
    if (serialized === layoutRef.current) return;
    layoutRef.current = serialized;

    setSections(prev => prev.map(sec =>
      sec.id === activeSectionId ? { ...sec, layout: newLayout } : sec
    ));
    setIsDirty(true);
  }, [activeSectionId, isEditMode]);

  // Grid drag/resize start: capture initial layout before drag begins
  const onGridDragStart = useCallback((layout: any, _oldItem: any, newItem: any) => {
    isDraggingGridRef.current = true;
    draggedItemIdRef.current = newItem?.i || null;
    dragStartLayoutRef.current = layout.map((l: any) => cloneLayoutItem(l));
  }, []);

  const onGridResizeStart = useCallback((layout: any, _oldItem: any, newItem: any) => {
    isDraggingGridRef.current = true;
    draggedItemIdRef.current = newItem?.i || null;
    dragStartLayoutRef.current = layout.map((l: any) => cloneLayoutItem(l));
  }, []);

  // Grid drag stop: resolve collisions on final layout and reset drag refs
  const onDragStop = useCallback((newLayout: Layout, _oldItem: any, newItem: any) => {
    if (!activeSectionId || !isEditMode) return;
    isDraggingGridRef.current = false;

    const movedId = newItem?.i || draggedItemIdRef.current;
    let candidate = newLayout;

    if (dragStartLayoutRef.current && movedId) {
      const movedItemInNew = newLayout.find((l: any) => l.i === movedId);
      if (movedItemInNew) {
        candidate = dragStartLayoutRef.current.map((startItem: any) => {
          if (startItem.i === movedId) {
            const l = cloneLayoutItem(startItem);
            l.x = movedItemInNew.x;
            l.y = movedItemInNew.y;
            l.w = movedItemInNew.w;
            l.h = movedItemInNew.h;
            l.moved = true;
            return l;
          }
          return cloneLayoutItem(startItem);
        });
      }
    }

    const resolvedLayout = resolveLayoutCollisions(candidate as any[], movedId);

    dragStartLayoutRef.current = null;
    draggedItemIdRef.current = null;

    skipNextLayoutChangeRef.current = true;
    layoutRef.current = JSON.stringify(resolvedLayout);

    setIsDirty(true);
    setSections(prev => prev.map(sec =>
      sec.id === activeSectionId ? { ...sec, layout: resolvedLayout } : sec
    ));
    saveLayoutToDb(activeSectionId, resolvedLayout, widgets);
  }, [activeSectionId, isEditMode, widgets]);

  const onResizeStop = useCallback((newLayout: Layout, _oldItem: any, newItem: any) => {
    if (!activeSectionId || !isEditMode) return;
    isDraggingGridRef.current = false;

    const resizedId = newItem?.i || draggedItemIdRef.current;
    let candidate = newLayout;

    if (dragStartLayoutRef.current && resizedId) {
      const itemInNew = newLayout.find((l: any) => l.i === resizedId);
      if (itemInNew) {
        candidate = dragStartLayoutRef.current.map((startItem: any) => {
          if (startItem.i === resizedId) {
            const l = cloneLayoutItem(startItem);
            l.x = itemInNew.x;
            l.y = itemInNew.y;
            l.w = itemInNew.w;
            l.h = itemInNew.h;
            l.moved = true;
            return l;
          }
          return cloneLayoutItem(startItem);
        });
      }
    }

    const resolvedLayout = resolveLayoutCollisions(candidate as any[], resizedId);

    dragStartLayoutRef.current = null;
    draggedItemIdRef.current = null;

    skipNextLayoutChangeRef.current = true;
    layoutRef.current = JSON.stringify(resolvedLayout);

    setIsDirty(true);
    setSections(prev => prev.map(sec =>
      sec.id === activeSectionId ? { ...sec, layout: resolvedLayout } : sec
    ));
    saveLayoutToDb(activeSectionId, resolvedLayout, widgets);
  }, [activeSectionId, isEditMode, widgets]);

  const handleDragStart = (e: React.DragEvent, type: string) => {
    e.dataTransfer.setData('text/plain', type);
    e.dataTransfer.effectAllowed = 'copy';
    draggingWidgetRef.current = type;
  };

  const updateWidgetConfig = (config: any) => {
    if (!activeSectionId || !selectedWidgetId) return;
    const newWidgetsState = widgets.map(w => w.id === selectedWidgetId ? { ...w, config } : w);
    setSections(prev => prev.map(sec =>
      sec.id === activeSectionId ? { ...sec, widgets: newWidgetsState } : sec
    ));
    setIsDirty(true);
  };

  const renderWidgetContent = (widget: WidgetData) => {
    const title = widget.config.title || widget.type;
    const data = telemetryData[widget.id];

    const isMapWidget = widget.type === 'rtls_map' || widget.type === 'gis_map' || widget.type === 'maps' || widget.type === 'map';
    const hasDataSource = isMapWidget
      ? true
      : (widget.type === 'chart'
        ? (widget.config.assetId || (widget.config.targets && widget.config.targets.length > 0))
        : widget.config.assetId);

    if (!hasDataSource) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center select-none">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-tight">
            No attribute<br />connected
          </span>
        </div>
      );
    }

    switch (widget.type) {
      case 'chart': {
        const rangeInfo = widgetRanges[widget.id] || { range: '24h' };
        return (
          <ChartWidget
            widgetId={widget.id}
            data={data || []}
            widgetConfig={widget.config}
            rangeInfo={rangeInfo}
            setWidgetRange={setWidgetRange}
            updateCustomRange={updateCustomRange}
          />
        );
      }

      case 'gauge': {
        const val = typeof data === 'number' ? data : (data && typeof data === 'object' && typeof data.value === 'number' ? data.value : 0);
        const targetAsset = assets.find(a => a.id === widget.config.assetId);
        return <GaugeWidget value={val} attribute={widget.config.attribute || ''} widget={widget} targetAsset={targetAsset} />;
      }

      case 'kpi': {
        const targetAsset = assets.find(a => a.id === widget.config.assetId);
        const resolvedData = (data && typeof data === 'object')
          ? { ...data, asset: data.asset || targetAsset }
          : { value: typeof data === 'number' ? data : null, asset: targetAsset };

        return (
          <KPIWidget
            data={resolvedData}
            attribute={widget.config.attribute || ''}
            widget={widget}
            dbAssetTypes={dbAssetTypes}
            primaryAccentColor={primaryAccentColor}
            onUpdateTimeframe={(newTf) => {
              setSections(prevSections => prevSections.map(sec => {
                if (sec.id !== activeSectionId) return sec;
                return {
                  ...sec,
                  widgets: sec.widgets.map(w => {
                    if (w.id !== widget.id) return w;
                    return {
                      ...w,
                      config: { ...w.config, timeframe: newTf }
                    };
                  })
                };
              }));
              setIsDirty(true);
              setTimeout(() => {
                fetchAllTelemetry();
              }, 50);
            }}

          />
        );
      }


      case 'valueCard': {
        return (
          <ValueCardWidget
            data={data}
            attribute={widget.config.attribute || ''}
            widget={widget}
            primaryAccentColor={primaryAccentColor}
          />
        );
      }

      case 'rtls_map':
      case 'gis_map':
      case 'maps':
      case 'map': {
        const targetAsset = assets.find(a => a.id === widget.config.assetId);
        const resolvedData = (data && typeof data === 'object')
          ? { ...data, asset: data.asset || targetAsset }
          : { asset: targetAsset };

        const mapType = widget.type === 'gis_map' ? 'gis' : (widget.type === 'rtls_map' ? 'rtls' : (widget.config.mapType || 'rtls'));
        const effectiveWidget = {
          ...widget,
          config: {
            ...widget.config,
            mapType
          }
        };

        return (
          <MapWidget
            data={resolvedData}
            widget={effectiveWidget}
            allAssets={assets}
            dbAssetTypes={dbAssetTypes}
            primaryAccentColor={primaryAccentColor}
            getBackendUrl={getBackendUrl}
            zones={zones}
          />
        );
      }

      default:
        return <div className="w-full h-full flex items-center justify-center text-muted-foreground">{widget.type}</div>;
    }
  };

  if (isLoading) return <div className="p-8 text-center text-slate-500 font-medium">Loading Dashboard...</div>;

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-background">

      {/* TABS SELECTOR (Top Navigation) */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 pt-2 shadow-sm z-10">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {sections.map(sec => (
            <div key={sec.id} className={`flex items-center border-b-2 transition-all ${activeSectionId === sec.id ? 'border-primary bg-primary/5' : 'border-transparent hover:border-slate-300'}`}>
              {editingSectionId === sec.id ? (
                <div className="flex items-center gap-1 px-2 py-1">
                  <input autoFocus value={editingName} onChange={e => setEditingName(e.target.value)} className="w-24 text-sm px-2 py-1 border rounded" />
                  <button onClick={() => handleRenameSubmit(sec.id)} className="text-green-600 hover:text-green-800"><Check className="w-4 h-4" /></button>
                  <button onClick={() => setEditingSectionId(null)} className="text-red-500 hover:text-red-700"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <button
                  onClick={() => handleSectionTabClick(sec.id)}
                  className={`px-4 py-2.5 text-sm font-bold whitespace-nowrap flex items-center gap-2 ${activeSectionId === sec.id ? 'text-primary' : 'text-slate-500'}`}
                >
                  {sec.name}
                  {activeSectionId === sec.id && (
                    <div className="flex items-center gap-1 ml-2">
                      <Edit2 onClick={(e) => { e.stopPropagation(); setEditingSectionId(sec.id); setEditingName(sec.name); }} className="w-3 h-3 text-slate-400 hover:text-primary" />
                      <Trash2 onClick={(e) => handleDeleteSection(sec.id, e)} className="w-3 h-3 text-slate-400 hover:text-red-500" />
                    </div>
                  )}
                </button>
              )}
            </div>
          ))}
          <button
            onClick={handleAddSection}
            className="px-4 py-2.5 text-slate-400 hover:text-primary transition-colors flex items-center gap-1 text-sm font-semibold border-b-2 border-transparent"
          >
            <Plus className="w-4 h-4" /> Add Section
          </button>
        </div>
      </div>

      {/* HEADER ACTION CONTROL BAR (VIEW / MODIFY MODE) */}
      {activeSectionId && (
        <div className="flex items-center justify-between px-6 py-4 bg-card border-b border-border shadow-sm transition-all duration-300">
          <div className="flex items-center gap-3">
            {isEditMode ? (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded bg-slate-100 flex items-center justify-center text-slate-500 border">
                  <LayoutTemplate className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Name *</span>
                  <input
                    value={editSectionName}
                    onChange={(e) => { setEditSectionName(e.target.value); setIsDirty(true); }}
                    className="text-base font-bold text-foreground border-b border-primary/50 focus:border-primary focus:outline-none bg-transparent py-0.5 px-1"
                    placeholder="Enter dashboard name..."
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-6 bg-primary rounded-full" />
                <h1 className="text-xl font-extrabold text-foreground tracking-tight">
                  {activeSection?.name || 'Untitled Section'}
                </h1>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenFullView}
              className="p-2 text-muted-foreground hover:text-primary hover:bg-secondary border border-border rounded-lg transition-colors cursor-pointer"
              title={isFullView ? "Exit full view" : "Open full view"}
            >
              {isFullView ? <Minimize2 className="w-4 h-4" /> : <ExternalLink className="w-4 h-4" />}
            </button>

            <div className="w-[1px] h-6 bg-slate-200 mx-1" />

            {isEditMode ? (
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleSaveSectionDetails}
                  variant="outline"
                  className="h-9 px-4 text-xs font-bold gap-1.5 text-muted-foreground bg-secondary/80 border border-border hover:bg-secondary hover:text-foreground"
                >
                  <Save className="w-3.5 h-3.5" /> SAVE
                </Button>
                <Button
                  onClick={handleDiscardChanges}
                  className="h-9 px-4 text-xs font-extrabold gap-1.5 border border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 hover:border-primary/50"
                >
                  <Eye className="w-3.5 h-3.5" /> VIEW
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleModifyClick}
                className="h-9 px-4 text-xs font-extrabold gap-1.5 border border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 hover:border-primary/50"
              >
                <Edit2 className="w-3.5 h-3.5" /> MODIFY
              </Button>
            )}
          </div>
        </div>
      )}

      {/* CORE WORKSPACE */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT: MAIN CANVAS (Grid Layout) */}
        <div className="flex-1 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-slate-50 dark:bg-slate-950/20 overflow-y-scroll p-0 border-r border-border relative">
          {!activeSectionId ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 relative z-10">
              <p>No sections found. Create a new section to get started.</p>
              <Button onClick={handleAddSection} className="mt-4"><Plus className="w-4 h-4 mr-2" /> Create Section</Button>
            </div>
          ) : (
            <div style={{ minHeight: `${dynamicCanvasHeight}px` }} className="w-full relative z-10 transition-all duration-300" key={activeSectionId} ref={containerRef}>
              {/* Grid Background Pattern */}
              {(() => {
                const currentCols = containerWidth > 1200 ? 24 : containerWidth > 996 ? 18 : containerWidth > 768 ? 12 : containerWidth > 480 ? 8 : 4;
                const gridX = containerWidth ? ((containerWidth - 24 - ((currentCols - 1) * 8)) / currentCols) + 8 : 48;
                const gridY = 40 + 8; // rowHeight (40) + margin (8)
                return (
                  <div
                    className="absolute top-0 left-0 right-0 w-full pointer-events-none opacity-50 transition-all duration-300 z-0"
                    style={{
                      height: `${dynamicCanvasHeight}px`,
                      ...(isEditMode ? {
                        backgroundImage: `
                          linear-gradient(to bottom, rgba(148, 163, 184, 0.35) 1px, transparent 1px),
                          linear-gradient(to right, rgba(148, 163, 184, 0.35) 1px, transparent 1px)
                        `,
                        backgroundSize: `${gridX}px ${gridY}px`,
                        backgroundPosition: '12px 12px'
                      } : {
                        backgroundImage: 'linear-gradient(rgba(148, 163, 184, 0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.12) 1px, transparent 1px)',
                        backgroundSize: '20px 20px'
                      })
                    }}
                  />
                );
              })()}

              <ResponsiveReactGridLayout
                width={containerWidth}
                className="layout relative z-10"
                layouts={{ lg: layout }}
                breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                cols={{ lg: 24, md: 18, sm: 12, xs: 8, xxs: 4 }}
                rowHeight={40}
                margin={[8, 8]}
                containerPadding={[12, 12]}
                onLayoutChange={(curr: Layout, all: any) => onLayoutChange(curr, all)}
                onDragStart={(layout: Layout, oldItem: any, newItem: any) => onGridDragStart(layout, oldItem, newItem)}
                onDragStop={(layout: Layout, oldItem: any, newItem: any) => onDragStop(layout, oldItem, newItem)}
                onResizeStart={(layout: Layout, oldItem: any, newItem: any) => onGridResizeStart(layout, oldItem, newItem)}
                onResizeStop={(layout: Layout, oldItem: any, newItem: any) => onResizeStop(layout, oldItem, newItem)}
                compactor={gridCompactor}
                dropConfig={{ enabled: isEditMode }}
                dragConfig={{ enabled: isEditMode, handle: '.drag-handle' }}
                resizeConfig={{ enabled: isEditMode }}
                resizeHandles={isEditMode ? ['s', 'w', 'e', 'n', 'sw', 'nw', 'se', 'ne'] : []}
                onDrop={onDrop}
                onDropDragOver={onDropDragOver}
                useCSSTransforms={true}
                style={{ minHeight: `${dynamicCanvasHeight}px` }}
              >
                {widgets.map((widget) => {
                  const l = layout.find(x => x.i === widget.id);
                  if (!l) return null;
                  const isSelected = selectedWidgetId === widget.id && isEditMode;

                  return (
                    <div key={widget.id} data-grid={l}
                      className={`bg-card border rounded-lg shadow-xs overflow-hidden flex flex-col transition-all ${isSelected ? 'ring-2 ring-primary border-transparent shadow-md shadow-primary/10' : 'border-border'
                        } ${!isEditMode ? 'hover:shadow-sm' : 'cursor-pointer'}`}
                      onClick={() => { if (isEditMode) { setSelectedWidgetId(widget.id); setActiveTab('settings'); } }}>

                      {/* Unified Widget Header (Compact & Space Efficient) */}
                      <div className={`px-2 py-1 flex items-center justify-between border-b border-muted/10 shrink-0 select-none ${isEditMode ? 'bg-muted/10 cursor-move drag-handle group' : ''}`}>
                        <div className="flex items-center gap-1 overflow-hidden mr-1">
                          {isEditMode && <GripHorizontal className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />}
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate capitalize">
                            {widget.config.title || (widget.type === 'valueCard' ? 'Value Card' : widget.type)}
                          </span>
                        </div>
                        {isEditMode && (
                          <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1 py-0.2 rounded shrink-0">
                            {widget.type}
                          </span>
                        )}
                      </div>

                      {/* Widget Content */}
                      <div className="flex-1 p-0.5 overflow-hidden relative flex flex-col justify-center">
                        {renderWidgetContent(widget)}
                      </div>
                    </div>
                  );
                })}
              </ResponsiveReactGridLayout>

              {widgets.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-primary/40 flex items-center justify-center mb-4 bg-primary/5">
                    <Plus className="w-8 h-8 text-primary/60" />
                  </div>
                  <p className="text-sm font-semibold text-slate-500">
                    {isEditMode ? `Drag & Drop widgets here for ${activeSection?.name}` : 'Dashboard is empty. Click MODIFY to customize.'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: SIDEBAR (Widgets & Settings) - ONLY VISIBLE IN EDIT/MODIFY MODE */}
        {isEditMode && (
          <div className="w-80 bg-card flex flex-col shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-20 transition-all duration-300 animate-in slide-in-from-right h-full overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col min-h-0 overflow-hidden">
              <TabsList className="w-full grid grid-cols-2 rounded-none h-12 bg-muted/30 border-b border-border p-0 shrink-0">
                <TabsTrigger value="widgets" className="rounded-none data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary h-full">
                  WIDGETS
                </TabsTrigger>
                <TabsTrigger value="settings" className="rounded-none data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary h-full">
                  SETTINGS
                </TabsTrigger>
              </TabsList>

              <TabsContent value="widgets" className="flex-1 p-4 overflow-y-auto m-0 min-h-0">
                <div className="grid grid-cols-2 gap-3">
                  {WIDGET_TEMPLATES.map((tmpl) => (
                    <div
                      key={tmpl.type}
                      draggable
                      unselectable="on"
                      className="droppable-element flex flex-col items-center justify-center p-4 border border-border rounded-xl bg-background hover:border-primary hover:bg-primary/5 cursor-grab active:cursor-grabbing transition-all shadow-sm"
                      onDragStart={(e) => handleDragStart(e, tmpl.type)}
                      onDragEnd={() => { draggingWidgetRef.current = null; }}
                    >
                      <tmpl.icon className="w-6 h-6 text-slate-600 dark:text-slate-400 mb-2" />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{tmpl.label}</span>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="settings" className="flex-1 p-4 m-0 overflow-y-auto min-h-0">
                {(() => {
                  const selectedWidget = widgets.find(w => w.id === selectedWidgetId);
                  if (!selectedWidget) {
                    return (
                      <div className="flex flex-col items-center justify-center flex-1 h-full text-center p-4">
                        <Settings className="w-10 h-10 text-slate-300 mb-3" />
                        <p className="text-sm text-slate-500 font-medium">Select a widget on the canvas to configure it.</p>
                      </div>
                    );
                  }

                  const isChart = selectedWidget.type === 'chart';
                  const isMapWidget = ['maps', 'map', 'rtls_map', 'gis_map'].includes(selectedWidget.type);
                  const isMultiAttribute = ['maps', 'map'].includes(selectedWidget.type);

                  const widgetTitleLabel = selectedWidget.type === 'rtls_map'
                    ? 'Denah RTLS Config'
                    : (selectedWidget.type === 'gis_map' ? 'Map View GIS Config' : `${selectedWidget.type} Config`);

                  return (
                    <div className="flex flex-col min-h-full justify-between space-y-6">
                      <div className="space-y-4">
                        <div className="p-3 bg-secondary/30 border border-border rounded-lg flex items-center gap-3">
                          <Settings2 className="w-5 h-5 text-primary" />
                          <div>
                            <h3 className="text-sm font-bold capitalize">{widgetTitleLabel}</h3>
                            <p className="text-[10px] text-muted-foreground font-mono truncate w-48 font-bold">ID: {selectedWidget.id}</p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-slate-600">Widget Title</label>
                          <input
                            type="text"
                            value={selectedWidget.config.title || ''}
                            onChange={(e) => updateWidgetConfig({ ...selectedWidget.config, title: e.target.value })}
                            className="w-full text-sm p-2 border border-border rounded-md bg-background text-foreground"
                          />
                        </div>

                        {isMapWidget ? (() => {
                          // Only include asset types present on registered assets for this tenant
                          const tenantTypesSet = new Set(assets.map(a => String(a.type || '').toUpperCase()).filter(Boolean));
                          const matchedDbTypes = dbAssetTypes.filter((t: any) => tenantTypesSet.has(String(t.code || '').toUpperCase()));

                          const mapAssetTypeOption = (code: string, label: string) => {
                            const iconInfo = getAssetMarkerIcon(code, label, dbAssetTypes);
                            return {
                              value: code,
                              label,
                              icon: iconInfo.svg
                            };
                          };

                          let availableAssetTypes: { value: string; label: string; icon?: any }[] = [];
                          if (matchedDbTypes.length > 0) {
                            availableAssetTypes = matchedDbTypes.map((t: any) => mapAssetTypeOption(t.code, t.name || t.code));
                          } else if (tenantTypesSet.size > 0) {
                            availableAssetTypes = Array.from(tenantTypesSet).map(code => mapAssetTypeOption(
                              code,
                              code.charAt(0).toUpperCase() + code.slice(1).toLowerCase().replace(/_/g, ' ')
                            ));
                          } else {
                            availableAssetTypes = dbAssetTypes.map((t: any) => mapAssetTypeOption(t.code, t.name || t.code));
                          }

                          const currentAssetType = selectedWidget.config.assetType || (availableAssetTypes[0]?.value || '');

                          // Dynamically derive available attributes for selected assets or assets of selected type
                          const isAllAssets = selectedWidget.config.allAssetsOfType ?? true;
                          const selectedAssetIds: string[] = selectedWidget.config.selectedAssetIds || (selectedWidget.config.assetId ? [selectedWidget.config.assetId] : []);

                          const assetsOfSelectedType = assets.filter(a => String(a.type || '').toUpperCase() === String(currentAssetType).toUpperCase());

                          let targetAssetsForAttributes = assetsOfSelectedType;
                          if (!isAllAssets && selectedAssetIds.length > 0) {
                            targetAssetsForAttributes = assets.filter(a => selectedAssetIds.includes(a.id));
                          }

                          const attrMap = new Map<string, string>();
                          (targetAssetsForAttributes.length > 0 ? targetAssetsForAttributes : assetsOfSelectedType).forEach(a => {
                            const attrs = getAssetAttributes(a.id);
                            attrs.forEach(at => attrMap.set(at.value, at.label));
                          });

                          let availableAttributes: { value: string; label: string }[] = [];
                          if (attrMap.size > 0) {
                            availableAttributes = Array.from(attrMap.entries()).map(([value, label]) => ({ value, label }));
                          } else {
                            availableAttributes = [
                              { value: 'humidity', label: 'Humidity' },
                              { value: 'temperature', label: 'Temperature' },
                              { value: 'battery', label: 'Battery' },
                              { value: 'rssi', label: 'RSSI' }
                            ];
                          }

                          return (
                            <div className="space-y-4 pt-1">
                              {/* 0. Denah/Zone (Only for RTLS) */}
                              {selectedWidget.type === 'rtls_map' && (
                                <div className="space-y-1.5 pb-3 border-b border-border">
                                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 block">Denah / Zone</label>
                                  <CustomSidebarSelect
                                    value={selectedWidget.config.zoneId || ''}
                                    onChange={(val) => updateWidgetConfig({ ...selectedWidget.config, zoneId: val })}
                                    options={[
                                      { value: '', label: 'Auto (from Asset)' },
                                      ...zones.map((z: any) => ({ value: z.id, label: z.name, icon: <Layers className="w-4 h-4"/> }))
                                    ]}
                                    primaryAccentColor={primaryAccentColor}
                                  />
                                </div>
                              )}
                                  {/* 1. Asset type */}
                                  <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">Asset type</label>
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: primaryAccentColor }} />
                                </div>
                                <CustomSidebarSelect
                                  value={currentAssetType}
                                  onChange={(val) => updateWidgetConfig({ ...selectedWidget.config, assetType: val })}
                                  options={availableAssetTypes}
                                  primaryAccentColor={primaryAccentColor}
                                />
                              </div>

                              {/* 2. All assets of this type */}
                              <div className="flex items-center justify-between pt-1">
                                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">All assets of this type</span>
                                <button
                                  type="button"
                                  onClick={() => updateWidgetConfig({
                                    ...selectedWidget.config,
                                    allAssetsOfType: !(selectedWidget.config.allAssetsOfType ?? true)
                                  })}
                                  className={`w-9 h-5 rounded-full p-0.5 transition-colors relative cursor-pointer ${(selectedWidget.config.allAssetsOfType ?? true) ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'}`}
                                  style={{ backgroundColor: (selectedWidget.config.allAssetsOfType ?? true) ? primaryAccentColor : undefined }}
                                >
                                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${(selectedWidget.config.allAssetsOfType ?? true) ? 'translate-x-4' : 'translate-x-0'}`} />
                                </button>
                              </div>

                              {/* 3. All assets / Specific Asset Select */}
                              <div className="space-y-1">
                                {(selectedWidget.config.allAssetsOfType ?? true) ? (
                                  <div className="w-full text-xs font-semibold p-2.5 border border-border rounded-xl bg-secondary/30 text-muted-foreground flex items-center justify-center select-none cursor-not-allowed">
                                    All assets
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const currentSelected = selectedWidget.config.selectedAssetIds || (selectedWidget.config.assetId ? [selectedWidget.config.assetId] : []);
                                      setLinkedAssetsSelectedIds(new Set(currentSelected));
                                      setLinkedAssetsFilter('');
                                      setIsLinkedAssetsOpen(true);
                                    }}
                                    style={{ color: primaryAccentColor }}
                                    className="w-full py-2.5 px-3 border border-border rounded-xl bg-secondary/20 hover:bg-secondary/50 font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-2xs cursor-pointer"
                                  >
                                    <span>
                                      {(() => {
                                        const ids = selectedWidget.config.selectedAssetIds || (selectedWidget.config.assetId ? [selectedWidget.config.assetId] : []);
                                        return `${ids.length} Assets`;
                                      })()}
                                    </span>
                                  </button>
                                )}
                              </div>

                              {/* 4. Attribute */}
                              <div className="space-y-1.5 pt-1">
                                <label className="text-xs font-bold block" style={{ color: primaryAccentColor }}>
                                  Attribute
                                </label>
                                <CustomSidebarSelect
                                  value={selectedWidget.config.attribute || (availableAttributes[0]?.value || 'humidity')}
                                  onChange={(val) => updateWidgetConfig({ ...selectedWidget.config, attribute: val })}
                                  options={availableAttributes}
                                  primaryAccentColor={primaryAccentColor}
                                />
                              </div>

                            {/* 5. Show labels */}
                            <div className="flex items-center justify-between pt-1">
                              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Show labels</span>
                              <button
                                type="button"
                                onClick={() => updateWidgetConfig({
                                  ...selectedWidget.config,
                                  showLabels: !(selectedWidget.config.showLabels ?? true)
                                })}
                                className={`w-9 h-5 rounded-full p-0.5 transition-colors relative cursor-pointer ${(selectedWidget.config.showLabels ?? true) ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'}`}
                                style={{ backgroundColor: (selectedWidget.config.showLabels ?? true) ? primaryAccentColor : undefined }}
                              >
                                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${(selectedWidget.config.showLabels ?? true) ? 'translate-x-4' : 'translate-x-0'}`} />
                              </button>
                            </div>

                            {/* 6. Show units */}
                            <div className="flex items-center justify-between pt-1">
                              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Show units</span>
                              <button
                                type="button"
                                onClick={() => updateWidgetConfig({
                                  ...selectedWidget.config,
                                  showUnits: !(selectedWidget.config.showUnits ?? true)
                                })}
                                className={`w-9 h-5 rounded-full p-0.5 transition-colors relative cursor-pointer ${(selectedWidget.config.showUnits ?? true) ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'}`}
                                style={{ backgroundColor: (selectedWidget.config.showUnits ?? true) ? primaryAccentColor : undefined }}
                              >
                                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${(selectedWidget.config.showUnits ?? true) ? 'translate-x-4' : 'translate-x-0'}`} />
                              </button>
                            </div>

                            {/* 7. Thresholds (Collapsible) */}
                            <div className="space-y-2 pt-3 border-t border-border">
                              <button
                                type="button"
                                onClick={() => setIsThresholdsOpen(!isThresholdsOpen)}
                                className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-primary transition-colors w-full text-left"
                              >
                                <ChevronDown className={`w-4 h-4 transition-transform ${isThresholdsOpen ? '' : '-rotate-90'}`} />
                                <span>Thresholds</span>
                              </button>

                              {isThresholdsOpen && (
                                <div className="space-y-2.5 pl-2 animate-in fade-in duration-150">
                                  {(() => {
                                    const thresholds: { color: string; value: number }[] = selectedWidget.config.thresholds || [
                                      { color: '#22c55e', value: 0 },
                                      { color: '#f97316', value: 75 },
                                      { color: '#ef4444', value: 90 }
                                    ];

                                    return (
                                      <>
                                        <div className="space-y-2">
                                          {thresholds.map((t, idx) => (
                                            <div key={idx} className="flex items-center gap-2">
                                              <div className="w-8 h-8 rounded-lg border border-border overflow-hidden relative shrink-0 cursor-pointer shadow-xs">
                                                <input
                                                  type="color"
                                                  value={t.color || '#10b981'}
                                                  onChange={(e) => {
                                                    const updated = [...thresholds];
                                                    updated[idx] = { ...updated[idx], color: e.target.value };
                                                    updateWidgetConfig({ ...selectedWidget.config, thresholds: updated });
                                                  }}
                                                  className="absolute -inset-2 w-12 h-12 opacity-0 cursor-pointer"
                                                />
                                                <div className="w-full h-full" style={{ backgroundColor: t.color || '#10b981' }} />
                                              </div>

                                              <input
                                                type="number"
                                                value={t.value !== undefined ? t.value : ''}
                                                onChange={(e) => {
                                                  const updated = [...thresholds];
                                                  updated[idx] = { ...updated[idx], value: e.target.value === '' ? 0 : Number(e.target.value) };
                                                  updateWidgetConfig({ ...selectedWidget.config, thresholds: updated });
                                                }}
                                                className="flex-1 text-xs font-semibold p-2 border border-border rounded-lg bg-secondary/20 text-foreground"
                                              />

                                              {thresholds.length > 1 && (
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    const updated = thresholds.filter((_, i) => i !== idx);
                                                    updateWidgetConfig({ ...selectedWidget.config, thresholds: updated });
                                                  }}
                                                  className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded-md"
                                                >
                                                  <Trash2 className="w-4 h-4" />
                                                </button>
                                              )}
                                            </div>
                                          ))}
                                        </div>

                                        <button
                                          type="button"
                                          onClick={() => {
                                            const lastVal = thresholds.length > 0 ? thresholds[thresholds.length - 1].value + 15 : 0;
                                            const defaultColors = ['#22c55e', '#f97316', '#ef4444', '#3b82f6', '#8b5cf6'];
                                            const nextColor = defaultColors[thresholds.length % defaultColors.length];
                                            const updated = [...thresholds, { color: nextColor, value: lastVal }];
                                            updateWidgetConfig({ ...selectedWidget.config, thresholds: updated });
                                          }}
                                          style={{ color: primaryAccentColor }}
                                          className="w-full py-2 px-3 border border-border rounded-xl bg-secondary/30 hover:bg-secondary/60 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                                        >
                                          <Plus className="w-4 h-4" style={{ color: primaryAccentColor }} /> Threshold
                                        </button>
                                      </>
                                    );
                                  })()}
                               </div>
                             )}
                             </div>
                           </div>
                       );
                       })() : isChart ? (
                          <>
                            {/* Attributes Section for Chart Widget (Using Tree Select Attribute Picker) */}
                            <div className="space-y-2 pt-2 border-t border-border">
                              <button
                                type="button"
                                onClick={() => setIsAttributesSectionOpen(!isAttributesSectionOpen)}
                                className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-primary transition-colors w-full text-left"
                              >
                                <ChevronDown className={`w-4 h-4 transition-transform ${isAttributesSectionOpen ? '' : '-rotate-90'}`} />
                                <span>Attributes</span>
                              </button>

                              {isAttributesSectionOpen && (
                                <div className="space-y-3 pl-2 animate-in fade-in duration-150">
                                  {(() => {
                                    const targets = selectedWidget.config.targets || [];
                                    return (
                                      <div className="space-y-2.5">
                                        {targets.length > 0 ? (
                                          <div className="space-y-2">
                                            {targets.map((t: any, idx: number) => {
                                              const targetAsset = assets.find(a => a.id === t.assetId);
                                              const assetName = targetAsset?.name || t.assetId;
                                              const attrs = targetAsset ? getAssetAttributes(targetAsset.id) : [];
                                              const attrObj = attrs.find(a => a.value === t.attribute);
                                              const attrLabel = attrObj ? attrObj.label : (t.attribute.charAt(0).toUpperCase() + t.attribute.slice(1));
                                              const { IconComp, color: iconColor } = getAssetIconAndColor(targetAsset, assetName, dbAssetTypes);

                                              return (
                                                <div
                                                  key={idx}
                                                  className="flex items-center gap-3 p-2.5 bg-card border border-border hover:border-primary/60 rounded-2xl transition-all shadow-2xs group relative"
                                                >
                                                  <div
                                                    className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0"
                                                    style={{
                                                      backgroundColor: `${iconColor}18`,
                                                      color: iconColor,
                                                      border: `1px solid ${iconColor}35`,
                                                    }}
                                                  >
                                                    <IconComp className="w-4 h-4" />
                                                  </div>
                                                  <div className="flex flex-col leading-tight min-w-0 flex-1">
                                                    <span className="text-xs font-bold text-foreground truncate">
                                                      {assetName}
                                                    </span>
                                                    <span className="text-[11px] font-medium text-muted-foreground truncate">
                                                      {attrLabel}
                                                    </span>
                                                  </div>
                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      const updated = targets.filter((_: any, i: number) => i !== idx);
                                                      updateWidgetConfig({
                                                        ...selectedWidget.config,
                                                        targets: updated
                                                      });
                                                    }}
                                                    className="text-destructive hover:text-red-600 transition-colors p-1"
                                                    title="Remove attribute"
                                                  >
                                                    <Trash2 className="w-4 h-4" />
                                                  </button>
                                                </div>
                                              );
                                            })}

                                            <button
                                              type="button"
                                              onClick={() => {
                                                setPickerSelectedAssetId(assets[0]?.id || '');
                                                setPickerSelectedAttribute('temperature');
                                                setIsAttrPickerOpen(true);
                                              }}
                                              style={{
                                                backgroundColor: `${primaryAccentColor}18`,
                                                borderColor: `${primaryAccentColor}35`,
                                                color: primaryAccentColor
                                              }}
                                              className="px-3.5 py-1.5 rounded-xl border font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs hover:opacity-90 w-fit"
                                            >
                                              <Plus className="w-4 h-4" style={{ color: primaryAccentColor }} />
                                              <span>Attribute</span>
                                            </button>
                                          </div>
                                        ) : (
                                          <div className="space-y-3 pt-1">
                                            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                                              No attributes connected
                                            </p>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setPickerSelectedAssetId(assets[0]?.id || '');
                                                setPickerSelectedAttribute('temperature');
                                                setIsAttrPickerOpen(true);
                                              }}
                                              style={{
                                                backgroundColor: `${primaryAccentColor}18`,
                                                borderColor: `${primaryAccentColor}35`,
                                                color: primaryAccentColor
                                              }}
                                              className="px-3.5 py-1.5 rounded-xl border font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs hover:opacity-90"
                                            >
                                              <Plus className="w-4 h-4" style={{ color: primaryAccentColor }} />
                                              <span>Attribute</span>
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}
                            </div>

                            {/* AXIS CONFIGURATION SECTION (Matching target UI) */}
                            <div className="space-y-3 pt-3 border-t border-border">
                              <button
                                type="button"
                                onClick={() => setIsAxisConfigOpen(!isAxisConfigOpen)}
                                className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-primary transition-colors w-full text-left"
                              >
                                <ChevronDown className={`w-4 h-4 transition-transform ${isAxisConfigOpen ? '' : '-rotate-90'}`} />
                                <span>Axis Configuration</span>
                              </button>

                              {isAxisConfigOpen && (
                                <div className="space-y-3 pl-2 animate-in fade-in duration-150">
                                  {/* Y-AXIS MAX */}
                                  <div className="flex items-center justify-between gap-3 p-2.5 bg-secondary/20 border border-border rounded-xl">
                                    <div className="flex-1 space-y-1">
                                      <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Y-axis Max</label>
                                      <input
                                        type="text"
                                        disabled={selectedWidget.config.yAxisAutoMax !== false}
                                        value={selectedWidget.config.yAxisAutoMax !== false ? 'auto' : (selectedWidget.config.yAxisMax ?? 100)}
                                        onChange={(e) => updateWidgetConfig({ ...selectedWidget.config, yAxisMax: e.target.value })}
                                        className={`w-full text-xs font-semibold p-1.5 border rounded-lg outline-none transition-all ${selectedWidget.config.yAxisAutoMax !== false
                                            ? 'bg-transparent border-transparent text-slate-400 dark:text-slate-500 font-mono'
                                            : 'bg-background border-border text-foreground'
                                          }`}
                                      />
                                    </div>
                                    <ToggleSwitch
                                      checked={selectedWidget.config.yAxisAutoMax === false}
                                      onChange={(isCustom) => updateWidgetConfig({ ...selectedWidget.config, yAxisAutoMax: !isCustom })}
                                      primaryColor={primaryAccentColor}
                                    />
                                  </div>

                                  {/* Y-AXIS MIN */}
                                  <div className="flex items-center justify-between gap-3 p-2.5 bg-secondary/20 border border-border rounded-xl">
                                    <div className="flex-1 space-y-1">
                                      <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Y-axis Min</label>
                                      <input
                                        type="text"
                                        disabled={selectedWidget.config.yAxisAutoMin !== false}
                                        value={selectedWidget.config.yAxisAutoMin !== false ? 'auto' : (selectedWidget.config.yAxisMin ?? 0)}
                                        onChange={(e) => updateWidgetConfig({ ...selectedWidget.config, yAxisMin: e.target.value })}
                                        className={`w-full text-xs font-semibold p-1.5 border rounded-lg outline-none transition-all ${selectedWidget.config.yAxisAutoMin !== false
                                            ? 'bg-transparent border-transparent text-slate-400 dark:text-slate-500 font-mono'
                                            : 'bg-background border-border text-foreground'
                                          }`}
                                      />
                                    </div>
                                    <ToggleSwitch
                                      checked={selectedWidget.config.yAxisAutoMin === false}
                                      onChange={(isCustom) => updateWidgetConfig({ ...selectedWidget.config, yAxisAutoMin: !isCustom })}
                                      primaryColor={primaryAccentColor}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* SHOW LEGEND TOGGLE */}
                            <div className="flex items-center justify-between pt-3 border-t border-border">
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Show Legend</span>
                              <ToggleSwitch
                                checked={selectedWidget.config.showLegend !== false}
                                onChange={(show) => updateWidgetConfig({ ...selectedWidget.config, showLegend: show })}
                                primaryColor={primaryAccentColor}
                              />
                            </div>
                          </>
                        ) : (
                          <>
                            {/* Single Unified Target Attribute Config or Multi-Attribute Config */}
                            {isMultiAttribute ? (
                              <>
                                <div className="space-y-2">
                                  <label className="text-xs font-semibold text-slate-600">Target Asset</label>
                                  <SearchableSelect
                                    value={selectedWidget.config.assetId || ''}
                                    placeholder="Select Asset..."
                                    options={assets.map(a => ({ value: a.id, label: a.name }))}
                                    onChange={(newAssetId) => {
                                      const attrs = getAssetAttributes(newAssetId);
                                      const defaultAttr = attrs.length > 0 ? attrs[0].value : 'temperature';
                                      const defaultAttrs = attrs.length > 0 ? [attrs[0].value] : ['temperature'];
                                      updateWidgetConfig({
                                        ...selectedWidget.config,
                                        assetId: newAssetId,
                                        attribute: defaultAttr,
                                        attributes: defaultAttrs
                                      });
                                    }}
                                  />
                                </div>

                                <div className="space-y-2 pt-2 border-t border-border">
                                  <label className="text-xs font-semibold text-slate-600">Telemetry Attributes</label>
                                  <div className="space-y-1 bg-background border border-border rounded-md p-2">
                                    {(() => {
                                      const availableAttributes = getAssetAttributes(selectedWidget.config.assetId);
                                      const currentList = selectedWidget.config.attributes || [];
                                      const getAttributeTypeKey = (name: string) => {
                                        const n = name.toLowerCase();
                                        if (n.startsWith('rssi')) return 'rssi';
                                        if (n.includes('temperature') || n.includes('temp')) return 'temperature';
                                        if (n.includes('humidity') || n.includes('hum')) return 'humidity';
                                        if (n.includes('battery') || n.includes('voltage') || n.includes('volt')) return 'battery';
                                        if (n.includes('co2')) return 'co2';
                                        if (n.includes('co')) return 'co';
                                        return n;
                                      };
                                      const activeType = currentList.length > 0 ? getAttributeTypeKey(currentList[0]) : null;

                                      return availableAttributes.map(attr => {
                                        const isChecked = currentList.includes(attr.value);
                                        const attrType = getAttributeTypeKey(attr.value);
                                        const isDisabled = activeType !== null && !isChecked && attrType !== activeType;

                                        return (
                                          <label key={attr.value} className={`flex items-center gap-2 text-xs text-slate-700 cursor-pointer p-1 rounded hover:bg-slate-50 ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              disabled={isDisabled}
                                              onChange={(e) => {
                                                const newList = e.target.checked
                                                  ? [...currentList, attr.value]
                                                  : currentList.filter((x: string) => x !== attr.value);
                                                updateWidgetConfig({ ...selectedWidget.config, attributes: newList });
                                              }}
                                              className="rounded text-primary focus:ring-primary border-slate-300 disabled:opacity-50"
                                            />
                                            {attr.label}
                                            {isDisabled && <span className="text-[8px] text-muted-foreground ml-auto">(mismatched type)</span>}
                                          </label>
                                        );
                                      });
                                    })()}
                                  </div>
                                </div>
                              </>
                            ) : (
                              /* ATTRIBUTES SECTION (Collapsible with Clickable Asset Card or Standalone Attribute Button) */
                              <div className="space-y-2 pt-2 border-t border-border">
                                <button
                                  type="button"
                                  onClick={() => setIsAttributesSectionOpen(!isAttributesSectionOpen)}
                                  className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-primary transition-colors w-full text-left"
                                >
                                  <ChevronDown className={`w-4 h-4 transition-transform ${isAttributesSectionOpen ? '' : '-rotate-90'}`} />
                                  <span>Attributes</span>
                                </button>

                                {isAttributesSectionOpen && (
                                  <div className="space-y-3 pl-2 animate-in fade-in duration-150">
                                    {(() => {
                                      const targetAsset = assets.find(a => a.id === selectedWidget.config.assetId);
                                      const currentAttr = selectedWidget.config.attribute || 'temperature';
                                      const assetName = targetAsset?.name || 'Weather Station';

                                      const attrs = targetAsset ? getAssetAttributes(targetAsset.id) : [];
                                      const attrObj = attrs.find(a => a.value === currentAttr);
                                      const attrLabel = attrObj ? attrObj.label : (currentAttr.charAt(0).toUpperCase() + currentAttr.slice(1));

                                      const { IconComp, color: iconColor } = getAssetIconAndColor(targetAsset, assetName, dbAssetTypes);

                                      return (
                                        <div className="space-y-2.5">
                                          {targetAsset && currentAttr ? (
                                            /* CLICKABLE ASSET CARD (Directly opens tree select attributes modal) */
                                            <div
                                              onClick={() => {
                                                setPickerSelectedAssetId(selectedWidget.config.assetId || (assets[0]?.id || ''));
                                                setPickerSelectedAttribute(selectedWidget.config.attribute || 'temperature');
                                                setIsAttrPickerOpen(true);
                                              }}
                                              className="flex items-center gap-3 p-3 bg-card border border-border hover:border-primary/60 rounded-2xl cursor-pointer transition-all shadow-2xs hover:shadow-md group active:scale-[0.99]"
                                            >
                                              <div
                                                className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
                                                style={{
                                                  backgroundColor: `${iconColor}18`,
                                                  color: iconColor,
                                                  border: `1px solid ${iconColor}35`,
                                                }}
                                              >
                                                <IconComp className="w-5 h-5" />
                                              </div>
                                              <div className="flex flex-col leading-tight min-w-0 flex-1">
                                                <span className="text-xs font-bold text-foreground truncate transition-colors" style={{ color: undefined }}>
                                                  {assetName}
                                                </span>
                                                <span className="text-[11px] font-medium text-muted-foreground truncate">
                                                  {attrLabel}
                                                </span>
                                              </div>
                                            </div>
                                          ) : (
                                            /* UNCONNECTED STATE MATCHING TARGET SCREENSHOT */
                                            <div className="space-y-3 pt-1">
                                              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                                                No attributes connected
                                              </p>

                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setPickerSelectedAssetId(assets[0]?.id || '');
                                                  setPickerSelectedAttribute('temperature');
                                                  setIsAttrPickerOpen(true);
                                                }}
                                                style={{
                                                  backgroundColor: `${primaryAccentColor}18`,
                                                  borderColor: `${primaryAccentColor}35`,
                                                  color: primaryAccentColor
                                                }}
                                                className="px-3.5 py-1.5 rounded-xl border font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs hover:opacity-90"
                                              >
                                                <Plus className="w-4 h-4" style={{ color: primaryAccentColor }} />
                                                <span>Attribute</span>
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Gauge Specific Settings: Values Range & Thresholds */}
                            {selectedWidget.type === 'gauge' && (
                              <div className="space-y-4 pt-3 border-t border-border">
                                {/* VALUES SECTION (Collapsible) */}
                                <div className="space-y-2">
                                  <button
                                    type="button"
                                    className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-primary transition-colors w-full text-left"
                                  >
                                    <ChevronDown className={`w-4 h-4 transition-transform ${isValuesOpen ? '' : '-rotate-90'}`} />
                                    <span>Values</span>
                                  </button>

                                  {isValuesOpen && (
                                    <div className="space-y-3 pl-2 animate-in fade-in duration-150">
                                      <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Min</label>
                                          <input
                                            type="number"
                                            value={selectedWidget.config.min !== undefined ? selectedWidget.config.min : 0}
                                            onChange={(e) => updateWidgetConfig({ ...selectedWidget.config, min: e.target.value === '' ? '' : Number(e.target.value) })}
                                            className="w-full text-xs font-semibold p-2 border border-border rounded-lg bg-secondary/20 text-foreground"
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Max</label>
                                          <input
                                            type="number"
                                            value={selectedWidget.config.max !== undefined ? selectedWidget.config.max : 100}
                                            onChange={(e) => updateWidgetConfig({ ...selectedWidget.config, max: e.target.value === '' ? '' : Number(e.target.value) })}
                                            className="w-full text-xs font-semibold p-2 border border-border rounded-lg bg-secondary/20 text-foreground"
                                          />
                                        </div>
                                      </div>

                                      <div className="space-y-1">
                                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Decimals</label>
                                        <input
                                          type="number"
                                          min="0"
                                          max="5"
                                          value={selectedWidget.config.decimals !== undefined ? selectedWidget.config.decimals : 0}
                                          onChange={(e) => updateWidgetConfig({ ...selectedWidget.config, decimals: e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)) })}
                                          className="w-full text-xs font-semibold p-2 border border-border rounded-lg bg-secondary/20 text-foreground"
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* THRESHOLDS SECTION (Collapsible) */}
                                <div className="space-y-2 pt-2 border-t border-border">
                                  <button
                                    type="button"
                                    onClick={() => setIsThresholdsOpen(!isThresholdsOpen)}
                                    className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-primary transition-colors w-full text-left"
                                  >
                                    <ChevronDown className={`w-4 h-4 transition-transform ${isThresholdsOpen ? '' : '-rotate-90'}`} />
                                    <span>Thresholds</span>
                                  </button>

                                  {isThresholdsOpen && (
                                    <div className="space-y-2.5 pl-2 animate-in fade-in duration-150">
                                      {(() => {
                                        const thresholds: { color: string, value: number }[] = selectedWidget.config.thresholds || [
                                          { color: '#22c55e', value: 0 },
                                          { color: '#f97316', value: 25 },
                                          { color: '#ef4444', value: 75 }
                                        ];

                                        return (
                                          <>
                                            <div className="space-y-2">
                                              {thresholds.map((t, idx) => (
                                                <div key={idx} className="flex items-center gap-2">
                                                  <div className="w-8 h-8 rounded-lg border border-border overflow-hidden relative shrink-0 cursor-pointer shadow-xs">
                                                    <input
                                                      type="color"
                                                      value={t.color || '#10b981'}
                                                      onChange={(e) => {
                                                        const updated = [...thresholds];
                                                        updated[idx] = { ...updated[idx], color: e.target.value };
                                                        updateWidgetConfig({ ...selectedWidget.config, thresholds: updated });
                                                      }}
                                                      className="absolute -inset-2 w-12 h-12 opacity-0 cursor-pointer"
                                                    />
                                                    <div className="w-full h-full" style={{ backgroundColor: t.color || '#10b981' }} />
                                                  </div>

                                                  <input
                                                    type="number"
                                                    value={t.value !== undefined ? t.value : ''}
                                                    onChange={(e) => {
                                                      const updated = [...thresholds];
                                                      updated[idx] = { ...updated[idx], value: e.target.value === '' ? 0 : Number(e.target.value) };
                                                      updateWidgetConfig({ ...selectedWidget.config, thresholds: updated });
                                                    }}
                                                    className="flex-1 text-xs font-semibold p-2 border border-border rounded-lg bg-secondary/20 text-foreground"
                                                  />

                                                  {thresholds.length > 1 && (
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        const updated = thresholds.filter((_, i) => i !== idx);
                                                        updateWidgetConfig({ ...selectedWidget.config, thresholds: updated });
                                                      }}
                                                      className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded-md"
                                                    >
                                                      <Trash2 className="w-4 h-4" />
                                                    </button>
                                                  )}
                                                </div>
                                              ))}
                                            </div>

                                            <button
                                              type="button"
                                              onClick={() => {
                                                const lastVal = thresholds.length > 0 ? thresholds[thresholds.length - 1].value + 20 : 0;
                                                const defaultColors = ['#22c55e', '#f97316', '#ef4444', '#3b82f6', '#8b5cf6'];
                                                const nextColor = defaultColors[thresholds.length % defaultColors.length];
                                                const updated = [...thresholds, { color: nextColor, value: lastVal }];
                                                updateWidgetConfig({ ...selectedWidget.config, thresholds: updated });
                                              }}
                                              style={{ color: primaryAccentColor }}
                                              className="w-full py-2 px-3 border border-border rounded-xl bg-secondary/30 hover:bg-secondary/60 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                                            >
                                              <Plus className="w-4 h-4" style={{ color: primaryAccentColor }} /> Threshold
                                            </button>
                                          </>
                                        );
                                      })()}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* KPI Widget Specific Settings: Display (Timeframe & Allow time range) & Values (Show value as & Decimals) */}
                            {selectedWidget.type === 'kpi' && (
                              <div className="space-y-4 pt-3 border-t border-border">
                                {/* DISPLAY SECTION (Collapsible) */}
                                <div className="space-y-2">
                                  <button
                                    type="button"
                                    onClick={() => setIsDisplayOpen(!isDisplayOpen)}
                                    className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-primary transition-colors w-full text-left"
                                  >
                                    <ChevronDown className={`w-4 h-4 transition-transform ${isDisplayOpen ? '' : '-rotate-90'}`} />
                                    <span>Display</span>
                                  </button>

                                  {isDisplayOpen && (
                                    <div className="space-y-3 pl-2 animate-in fade-in duration-150">
                                      <div className="space-y-1">
                                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Timeframe</label>
                                        <CustomSidebarSelect
                                          value={selectedWidget.config.timeframe || 'Hour'}
                                          onChange={(val) => updateWidgetConfig({ ...selectedWidget.config, timeframe: val })}
                                          options={[
                                            { value: 'Hour', label: 'Hour' },
                                            { value: 'Day', label: 'Day' },
                                            { value: 'Week', label: 'Week' },
                                            { value: 'Month', label: 'Month' }
                                          ]}
                                          primaryAccentColor={primaryAccentColor}
                                        />
                                      </div>

                                      <div className="flex items-center justify-between pt-1">
                                        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Allow time range selection</span>
                                        <button
                                          type="button"
                                          onClick={() => updateWidgetConfig({ ...selectedWidget.config, allowTimeRange: !(selectedWidget.config.allowTimeRange ?? true) })}
                                          className={`w-9 h-5 rounded-full p-0.5 transition-colors relative cursor-pointer ${(selectedWidget.config.allowTimeRange ?? true) ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'
                                            }`}
                                          style={{ backgroundColor: (selectedWidget.config.allowTimeRange ?? true) ? primaryAccentColor : undefined }}
                                        >
                                          <div
                                            className={`w-4 h-4 rounded-full bg-white transition-transform ${(selectedWidget.config.allowTimeRange ?? true) ? 'translate-x-4' : 'translate-x-0'
                                              }`}
                                          />
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* VALUES SECTION (Collapsible) */}
                                <div className="space-y-2 pt-2 border-t border-border">
                                  <button
                                    type="button"
                                    onClick={() => setIsValuesOpen(!isValuesOpen)}
                                    className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-primary transition-colors w-full text-left"
                                  >
                                    <ChevronDown className={`w-4 h-4 transition-transform ${isValuesOpen ? '' : '-rotate-90'}`} />
                                    <span>Values</span>
                                  </button>

                                  {isValuesOpen && (
                                    <div className="space-y-3 pl-2 animate-in fade-in duration-150">
                                      <div className="space-y-1">
                                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Show value as</label>
                                        <CustomSidebarSelect
                                          value={selectedWidget.config.showValueAs || 'Absolute'}
                                          onChange={(val) => updateWidgetConfig({ ...selectedWidget.config, showValueAs: val })}
                                          options={[
                                            { value: 'Absolute', label: 'Absolute' },
                                            { value: 'Delta', label: 'Delta' },
                                            { value: 'Percentage', label: 'Percentage' }
                                          ]}
                                          primaryAccentColor={primaryAccentColor}
                                        />
                                      </div>

                                      <div className="space-y-1">
                                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Decimals</label>
                                        <input
                                          type="number"
                                          min="0"
                                          max="5"
                                          value={selectedWidget.config.decimals !== undefined ? selectedWidget.config.decimals : 0}
                                          onChange={(e) => updateWidgetConfig({ ...selectedWidget.config, decimals: e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)) })}
                                          className="w-full text-xs font-semibold p-2 border border-border rounded-lg bg-secondary/20 text-foreground"
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            </>
                          )}
                        </div>

                      {/* Delete Widget Button inside Sidebar Settings */}
                      <div className="pt-4 border-t border-border mt-auto">
                        <Button
                          type="button"
                          variant="destructive"
                          className="w-full text-xs font-extrabold gap-1.5 h-9"
                          onClick={() => {
                            setConfirmModal({
                              isOpen: true,
                              title: 'Delete Widget',
                              message: 'Apakah Anda yakin ingin menghapus widget ini dari kanvas?',
                              confirmText: 'Delete',
                              cancelText: 'Cancel',
                              variant: 'danger',
                              onConfirm: () => {
                                removeWidget(selectedWidget.id);
                                setConfirmModal(null);
                              }
                            });
                          }}
                        >
                          <Trash2 className="w-4 h-4" /> DELETE WIDGET
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      {/* STYLED CONFIRMATION POPUP MODAL (matches the theme modal on other pages) */}
      <ConfirmModal
        isOpen={!!confirmModal}
        title={confirmModal?.title || 'Konfirmasi'}
        message={confirmModal?.message || ''}
        confirmText={confirmModal?.confirmText || 'OK'}
        cancelText={confirmModal?.cancelText || 'Cancel'}
        variant={confirmModal?.variant || 'danger'}
        onConfirm={() => confirmModal?.onConfirm()}
        onCancel={() => setConfirmModal(null)}
      />

      {/* SELECT ATTRIBUTES MODAL (MATCHING IMAGE 1 WITH TREE HIERARCHY & ATTRIBUTES LIST) */}
      {isAttrPickerOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setIsAttrPickerOpen(false)}>
          <div className="w-full max-w-2xl bg-card border border-border shadow-2xl rounded-lg overflow-hidden flex flex-col h-[530px] animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>

            {/* HEADER */}
            <div className="px-5 py-3 border-b border-border bg-card flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">Select attributes</h3>
              <button onClick={() => setIsAttrPickerOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* TWO COLUMN CONTENT */}
            <div className="flex-1 flex overflow-hidden">

              {/* LEFT COLUMN: ASSETS HIERARCHICAL TREE SELECTION */}
              <div className="w-5/12 border-r border-border bg-secondary/10 flex flex-col">
                {/* Assets Header matching Primary Accent */}
                <div style={{ backgroundColor: primaryAccentColor }} className="text-white px-3.5 py-2.5 flex items-center justify-between font-bold text-xs shadow-sm">
                  <span>Assets</span>
                  <div className="flex items-center gap-2.5">
                    <X className="w-3.5 h-3.5 cursor-pointer hover:opacity-80" onClick={() => setAssetSearchFilter('')} />
                    <Filter className="w-3.5 h-3.5 cursor-pointer hover:opacity-80" />
                  </div>
                </div>

                {/* Filter Search Input */}
                <div className="p-2.5 border-b border-border bg-card">
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      placeholder="Filter..."
                      value={assetSearchFilter}
                      onChange={(e) => setAssetSearchFilter(e.target.value)}
                      className="w-full h-8 text-xs bg-secondary/35 pr-8 pl-2.5 rounded-md border border-border text-foreground focus:outline-none"
                    />
                    <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 pointer-events-none" />
                  </div>
                </div>

                {/* Asset Hierarchical Tree List */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1 text-xs">
                  {(() => {
                    const assetMap = new Map();
                    assets.forEach(a => assetMap.set(a.id, { ...a, children: [] }));

                    const roots: any[] = [];
                    assets.forEach(a => {
                      const item = assetMap.get(a.id);
                      if (a.parentId && assetMap.has(a.parentId)) {
                        assetMap.get(a.parentId).children.push(item);
                      } else {
                        roots.push(item);
                      }
                    });

                    const flattened: { asset: any; depth: number; hasChildren: boolean; isCollapsed: boolean }[] = [];
                    const traverse = (list: any[], depth: number) => {
                      list.forEach(node => {
                        const isCollapsed = !!collapsedAssetIds[node.id];
                        const matches = !assetSearchFilter || node.name.toLowerCase().includes(assetSearchFilter.toLowerCase()) || (node.children && node.children.some((c: any) => c.name.toLowerCase().includes(assetSearchFilter.toLowerCase())));
                        if (matches) {
                          flattened.push({ asset: node, depth, hasChildren: node.children.length > 0, isCollapsed });
                          if (!isCollapsed || assetSearchFilter) {
                            traverse(node.children, depth + 1);
                          }
                        }
                      });
                    };
                    traverse(roots, 0);

                    return flattened.map(({ asset, depth, hasChildren, isCollapsed }) => {
                      const isSelected = pickerSelectedAssetId === asset.id;
                      const { IconComp, color: iconColor } = getAssetIconAndColor(asset, asset.name, dbAssetTypes);
                      const indentPadding = Math.min(depth * 14 + 10, 48);

                      return (
                        <div
                          key={asset.id}
                          style={{
                            paddingLeft: `${indentPadding}px`,
                            borderLeftColor: isSelected ? primaryAccentColor : 'transparent',
                            backgroundColor: isSelected ? `${primaryAccentColor}18` : undefined
                          }}
                          onClick={() => {
                            setPickerSelectedAssetId(asset.id);
                            const attrs = getAssetAttributes(asset.id);
                            if (!attrs.find(x => x.value === pickerSelectedAttribute)) {
                              setPickerSelectedAttribute(attrs[0]?.value || 'temperature');
                            }
                          }}
                          className={`flex items-center gap-1.5 pr-2.5 py-1.5 rounded-md cursor-pointer transition-all border-l-4 ${isSelected
                            ? 'font-bold text-foreground shadow-sm'
                            : 'border-transparent hover:bg-secondary/60 text-muted-foreground hover:text-foreground'
                            }`}
                        >
                          {hasChildren ? (
                            <button
                              type="button"
                              onClick={(e) => toggleExpandAsset(asset.id, e)}
                              className="p-0.5 hover:bg-secondary/80 rounded text-muted-foreground hover:text-foreground shrink-0 transition-transform"
                              title={isCollapsed ? "Expand" : "Collapse"}
                            >
                              {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          ) : (
                            <span className="w-3.5 h-3.5 shrink-0" />
                          )}
                          <IconComp
                            className="w-3.5 h-3.5 shrink-0"
                            style={{ color: iconColor }}
                          />
                          <span className="truncate text-xs flex-1">{asset.name}</span>
                          {hasChildren && (
                            <span
                              onClick={(e) => toggleExpandAsset(asset.id, e)}
                              className="font-mono text-[9px] px-1.5 py-0.5 rounded-full bg-secondary/60 text-muted-foreground hover:bg-secondary cursor-pointer ml-auto"
                            >
                              {asset.children.length}
                            </span>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* RIGHT COLUMN: ATTRIBUTES LIST WITH UNITS */}
              <div className="w-7/12 bg-card flex flex-col">
                {/* Header Bar */}
                <div className="bg-secondary/35 px-4 py-2.5 border-b border-border font-bold text-xs text-muted-foreground">
                  Attributes
                </div>

                {/* Attributes List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-1 text-xs">
                  {(() => {
                    const selectedAsset = assets.find(a => a.id === pickerSelectedAssetId);
                    let attributes = selectedAsset ? getAssetAttributes(selectedAsset.id) : [];

                    if (attributes.length === 0) {
                      return (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12 select-none">
                          <p className="text-xs font-semibold text-muted-foreground">No attributes found</p>
                        </div>
                      );
                    }

                    return attributes.map(attr => {
                      const isSelected = pickerSelectedAttribute === attr.value;

                      return (
                        <div
                          key={attr.value}
                          onClick={() => setPickerSelectedAttribute(attr.value)}
                          style={isSelected ? {
                            backgroundColor: `${primaryAccentColor}18`,
                            color: primaryAccentColor,
                            borderColor: `${primaryAccentColor}40`
                          } : undefined}
                          className={`px-3 py-2.5 rounded-md cursor-pointer transition-all flex items-center justify-between border ${isSelected
                            ? 'font-bold'
                            : 'border-transparent hover:bg-secondary/60 text-foreground'
                            }`}
                        >
                          <span>{attr.label}</span>
                          {isSelected && <span style={{ color: primaryAccentColor }} className="text-xs font-bold">✓</span>}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

            </div>

            {/* FOOTER */}
            <div className="px-5 py-3 border-t border-border bg-card flex items-center justify-end gap-5">
              <button
                type="button"
                onClick={() => setIsAttrPickerOpen(false)}
                style={{ color: primaryAccentColor }}
                className="text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer hover:opacity-80"
              >
                CANCEL
              </button>
              <button
                type="button"
                disabled={!pickerSelectedAssetId || !pickerSelectedAttribute}
                onClick={() => {
                  const selectedWidget = widgets.find(w => w.id === selectedWidgetId);
                  if (!selectedWidget) return;

                  const asset = assets.find(a => a.id === pickerSelectedAssetId);
                  const assetName = asset?.name || 'Weather Station';

                  if (selectedWidget.type === 'chart') {
                    const currentTargets = selectedWidget.config.targets || [];
                    const exists = currentTargets.some(
                      (t: any) => t.assetId === pickerSelectedAssetId && t.attribute === pickerSelectedAttribute
                    );
                    const updatedTargets = exists
                      ? currentTargets
                      : [...currentTargets, { assetId: pickerSelectedAssetId, attribute: pickerSelectedAttribute }];

                    updateWidgetConfig({
                      ...selectedWidget.config,
                      assetId: pickerSelectedAssetId,
                      attribute: pickerSelectedAttribute,
                      attributes: [pickerSelectedAttribute],
                      targets: updatedTargets,
                      title: selectedWidget.config.title || `${assetName} - ${pickerSelectedAttribute}`
                    });
                  } else {
                    updateWidgetConfig({
                      ...selectedWidget.config,
                      assetId: pickerSelectedAssetId,
                      attribute: pickerSelectedAttribute,
                      attributes: [pickerSelectedAttribute],
                      title: `${assetName} - ${pickerSelectedAttribute}`
                    });
                  }

                  setIsAttrPickerOpen(false);
                }}
                style={{ color: primaryAccentColor }}
                className="text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ADD
              </button>
            </div>

          </div>
        </div>
      )}

      {/* LINKED ASSETS TREE SELECT MODAL */}
      {isLinkedAssetsOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
            {/* Modal Title Bar */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-card">
              <h3 className="text-sm font-bold text-foreground">Linked assets</h3>
              <button
                type="button"
                onClick={() => setIsLinkedAssetsOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sub Header (Green Bar) */}
            <div
              className="px-4 py-2.5 flex items-center justify-between text-white font-bold text-xs shadow-inner"
              style={{ backgroundColor: primaryAccentColor }}
            >
              <span>Assets</span>
              <SlidersHorizontal className="w-4 h-4 opacity-90" />
            </div>

            {/* Filter Input Bar */}
            <div className="p-3 border-b border-border bg-secondary/20">
              <input
                type="text"
                placeholder="Filter..."
                value={linkedAssetsFilter}
                onChange={(e) => setLinkedAssetsFilter(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-border bg-background text-foreground outline-none focus:ring-1 focus:ring-primary font-medium"
              />
            </div>

            {/* Hierarchical Tree List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1 text-xs min-h-[220px]">
              {(() => {
                const selectedWidget = widgets.find(w => w.id === selectedWidgetId);
                const currentAssetType = selectedWidget?.config?.assetType || '';

                const assetMap = new Map();
                assets.forEach(a => assetMap.set(a.id, { ...a, children: [] }));

                const roots: any[] = [];
                assets.forEach(a => {
                  const item = assetMap.get(a.id);
                  if (a.parentId && assetMap.has(a.parentId)) {
                    assetMap.get(a.parentId).children.push(item);
                  } else {
                    roots.push(item);
                  }
                });

                const flattened: { asset: any; depth: number; hasChildren: boolean; isCollapsed: boolean }[] = [];
                const traverse = (list: any[], depth: number) => {
                  list.forEach(node => {
                    const isCollapsed = !!collapsedLinkedAssetIds[node.id];
                    const matches = !linkedAssetsFilter || node.name.toLowerCase().includes(linkedAssetsFilter.toLowerCase()) || (node.children && node.children.some((c: any) => c.name.toLowerCase().includes(linkedAssetsFilter.toLowerCase())));
                    if (matches) {
                      flattened.push({ asset: node, depth, hasChildren: node.children.length > 0, isCollapsed });
                      if (!isCollapsed || linkedAssetsFilter) {
                        traverse(node.children, depth + 1);
                      }
                    }
                  });
                };
                traverse(roots, 0);

                if (flattened.length === 0) {
                  return <div className="text-center py-8 text-xs text-muted-foreground">No assets found</div>;
                }

                return flattened.map(({ asset, depth, hasChildren, isCollapsed }) => {
                  const isMatchingType = !currentAssetType || String(asset.type || '').toUpperCase() === String(currentAssetType).toUpperCase();
                  const isChecked = linkedAssetsSelectedIds.has(asset.id);
                  const { IconComp, color: iconColor } = getAssetIconAndColor(asset, asset.name, dbAssetTypes);
                  const indentPadding = Math.min(depth * 14 + 10, 48);

                  return (
                    <div
                      key={asset.id}
                      style={{ paddingLeft: `${indentPadding}px` }}
                      className={`flex items-center gap-2 pr-3 py-1.5 rounded-lg transition-all ${
                        isMatchingType
                          ? 'hover:bg-secondary/60 cursor-pointer text-foreground'
                          : 'opacity-40 cursor-not-allowed text-muted-foreground'
                      }`}
                      onClick={() => {
                        if (!isMatchingType) return;
                        setLinkedAssetsSelectedIds(prev => {
                          const next = new Set(prev);
                          if (next.has(asset.id)) {
                            next.delete(asset.id);
                          } else {
                            next.add(asset.id);
                          }
                          return next;
                        });
                      }}
                    >
                      {hasChildren ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCollapsedLinkedAssetIds(prev => ({ ...prev, [asset.id]: !prev[asset.id] }));
                          }}
                          className="p-0.5 hover:bg-secondary rounded text-muted-foreground hover:text-foreground shrink-0 transition-transform"
                        >
                          {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      ) : (
                        <span className="w-3.5 h-3.5 shrink-0" />
                      )}

                      <IconComp className="w-3.5 h-3.5 shrink-0" style={{ color: iconColor }} />
                      <span className="truncate text-xs font-semibold flex-1">{asset.name}</span>

                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        disabled={!isMatchingType}
                        checked={isChecked}
                        onChange={() => {}}
                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:cursor-not-allowed shrink-0"
                      />
                    </div>
                  );
                });
              })()}
            </div>

            {/* Footer Controls */}
            <div className="px-5 py-3 border-t border-border bg-card flex items-center justify-end gap-4">
              <button
                type="button"
                onClick={() => setIsLinkedAssetsOpen(false)}
                style={{ color: primaryAccentColor }}
                className="text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer hover:opacity-80"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={() => {
                  const selectedWidget = widgets.find(w => w.id === selectedWidgetId);
                  if (!selectedWidget) return;

                  const selectedArray = Array.from(linkedAssetsSelectedIds);
                  updateWidgetConfig({
                    ...selectedWidget.config,
                    selectedAssetIds: selectedArray,
                    assetId: selectedArray[0] || selectedWidget.config.assetId || ''
                  });
                  setIsLinkedAssetsOpen(false);
                }}
                style={{ color: primaryAccentColor }}
                className="text-xs font-extrabold uppercase tracking-wider transition-colors cursor-pointer hover:opacity-80"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
