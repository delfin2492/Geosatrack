'use client';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { GridLayout, Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import {
  Activity, LayoutGrid, Settings2, Plus, GripHorizontal, Settings, LineChart, Hash, MapPin, Tablet, Edit2, Trash2, Check, X, RefreshCw, Eye, EyeOff, LayoutTemplate, ExternalLink, Save, Lock, ChevronDown, Search
} from 'lucide-react';
import { getApiUrl } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/navigation';
import ConfirmModal from '../../components/ConfirmModal';

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


const WIDGET_TEMPLATES = [
  { type: 'valueCard', label: 'Value Card', icon: Hash, w: 2, h: 3 },
  { type: 'kpi', label: 'KPI', icon: Plus, w: 2, h: 3 },
  { type: 'gauge', label: 'Gauge', icon: Activity, w: 3, h: 4 },
  { type: 'chart', label: 'Chart', icon: LineChart, w: 6, h: 6 },
  { type: 'maps', label: 'Maps', icon: MapPin, w: 6, h: 6 },
];

type WidgetData = { id: string, type: string, config: any };
type SectionData = { id: string, name: string, layout: Layout[], widgets: WidgetData[] };

const ATTRIBUTES = [
  { value: 'temperature', label: 'Temperature (°C)' },
  { value: 'humidity', label: 'Humidity (%)' },
  { value: 'battery', label: 'Battery (V)' },
  { value: 'rssi', label: 'RSSI (dBm)' }
];

export default function InsightsPage() {
  const { tenantId, token } = useAuth();
  const router = useRouter();
  
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
  const [backupSectionData, setBackupSectionData] = useState<{ layout: Layout[], widgets: WidgetData[] } | null>(null);
  const [editSectionName, setEditSectionName] = useState('');

  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('widgets');

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
      } catch (e) {}
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

    // 3. Fallback to basic list if absolutely empty
    if (list.length === 0) {
      return [
        { value: 'temperature', label: 'Temperature (°C)' },
        { value: 'humidity', label: 'Humidity (%)' },
        { value: 'battery', label: 'Battery (V)' },
        { value: 'rssi', label: 'RSSI (dBm)' }
      ];
    }

    return list;
  };

  // Asset and telemetry state
  const [assets, setAssets] = useState<any[]>([]);
  const [telemetryData, setTelemetryData] = useState<Record<string, any>>({});

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
    }
  }, [tenantId]);

  const fetchSections = async () => {
    try {
      setIsLoading(true);
      const res = await apiClient.get('/dashboard/sections');
      const loadedSections = res.data.map((sec: any) => ({
        id: sec.id,
        name: sec.name,
        layout: sec.layout ? JSON.parse(sec.layout) : [],
        widgets: sec.widgets.map((w: any) => ({
          id: w.id,
          type: w.type,
          config: w.config ? JSON.parse(w.config) : { title: '', assetId: '', attribute: 'temperature', attributes: ['temperature'] }
        }))
      }));
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
  const layout = activeSection?.layout || [];
  const widgets = activeSection?.widgets || [];

  // Update input name whenever active section changes
  useEffect(() => {
    if (activeSection) {
      setEditSectionName(activeSection.name);
    }
  }, [activeSectionId, sections]);

  // Polling telemetry data for active widgets
  const widgetsDependency = JSON.stringify(
    widgets.map(w => ({
      id: w.id,
      assetId: w.config?.assetId,
      attribute: w.config?.attribute,
      attributes: w.config?.attributes
    }))
  );

  const fetchAllTelemetry = useCallback(async () => {
    if (!activeSectionId || widgets.length === 0) return;
    const newData: Record<string, any> = {};

    await Promise.all(
      widgets.map(async (widget) => {
        const { assetId, attributes, attribute } = widget.config || {};
        if (!assetId) return;

        if (widget.type === 'chart') {
          const attrs = attributes || ['temperature'];
          const results = await Promise.all(
            attrs.map(async (attr: string) => {
              try {
                const res = await apiClient.get(`/assets/${assetId}/telemetry?attribute=${attr}&range=24h`);
                return { attr, data: res.data };
              } catch (e) {
                return { attr, data: [] };
              }
            })
          );
          newData[widget.id] = results;
        } else if (widget.type === 'maps') {
          try {
            const res = await apiClient.get(`/assets/${assetId}`);
            const assetDetails = res.data;
            const attrs = attributes || ['temperature'];
            const attrValues = await Promise.all(
              attrs.map(async (attr: string) => {
                try {
                  const r = await apiClient.get(`/assets/${assetId}/telemetry?attribute=${attr}&range=1h`);
                  const lastVal = r.data.length > 0 ? r.data[r.data.length - 1].value : null;
                  return { attr, value: lastVal };
                } catch (e) {
                  return { attr, value: null };
                }
              })
            );
            newData[widget.id] = { asset: assetDetails, attributes: attrValues };
          } catch (e) {
            console.error(e);
          }
        } else {
          const attr = attribute || 'temperature';
          try {
            const res = await apiClient.get(`/assets/${assetId}/telemetry?attribute=${attr}&range=1h`);
            if (res.data && res.data.length > 0) {
              newData[widget.id] = res.data[res.data.length - 1].value;
            } else {
              newData[widget.id] = null;
            }
          } catch (e) {
            newData[widget.id] = null;
          }
        }
      })
    );

    setTelemetryData(newData);
  }, [widgetsDependency, activeSectionId]);

  useEffect(() => {
    fetchAllTelemetry();
    const interval = setInterval(fetchAllTelemetry, 10000);
    return () => clearInterval(interval);
  }, [fetchAllTelemetry]);

  const saveLayoutToDb = async (sectionId: string, layout: Layout[], widgets: WidgetData[]) => {
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
      title: 'Hapus Section',
      message: 'Apakah Anda yakin ingin menghapus Section ini secara permanen? Semua widget di dalamnya akan ikut terhapus.',
      confirmText: 'Hapus Permanen',
      cancelText: 'Batal',
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

  const onDrop = (newLayout: Layout[], layoutItem: Layout, e: Event) => {
    try {
      const widgetType = draggingWidgetRef.current;
      if (!widgetType || !activeSectionId) return;

      const template = WIDGET_TEMPLATES.find(t => t.type === widgetType);
      if (!template) return;

      const newId = `widget_${Date.now()}`;
      
      const newItem: Layout = {
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
            assetId: assets[0]?.id || '', 
            attribute: 'temperature', 
            attributes: ['temperature'] 
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

  const onLayoutChange = useCallback((newLayout: Layout[]) => {
    if (!activeSectionId || !isEditMode) return;
    
    const layoutDiff = JSON.stringify(newLayout) !== JSON.stringify(layout);
    if (!layoutDiff) return;

    setSections(prev => prev.map(sec => 
      sec.id === activeSectionId ? { ...sec, layout: newLayout } : sec
    ));
    setIsDirty(true);
  }, [activeSectionId, isEditMode, layout]);

  const onDragStop = useCallback(() => {
    setIsDirty(true);
  }, []);

  const onResizeStop = useCallback(() => {
    setIsDirty(true);
  }, []);

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

  // SVG Chart component
  const renderSVGChart = (results: any[]) => {
    if (!results || results.length === 0) return <div className="text-xs text-muted-foreground">No chart data</div>;

    const width = 450;
    const height = 180;
    const padding = 30;

    let allPoints: any[] = [];
    results.forEach(r => {
      if (Array.isArray(r.data)) {
        allPoints = [...allPoints, ...r.data];
      }
    });

    if (allPoints.length === 0) {
      return (
        <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground bg-slate-950/20 rounded">
          Waiting for telemetry log entries...
        </div>
      );
    }

    const minVal = Math.min(...allPoints.map(p => p.value));
    const maxVal = Math.max(...allPoints.map(p => p.value));
    const valRange = maxVal - minVal || 1;

    const timestamps = allPoints.map(p => new Date(p.timestamp).getTime());
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    const timeRange = maxTime - minTime || 1;

    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

    return (
      <div className="w-full h-full flex flex-col p-2 justify-between bg-slate-900/40 rounded-lg">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-36">
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
            const y = padding + (1 - ratio) * (height - 2 * padding);
            return (
              <line
                key={idx}
                x1={padding}
                y1={y}
                x2={width - padding}
                y2={y}
                stroke="#334155"
                strokeWidth="0.5"
                strokeDasharray="4 4"
              />
            );
          })}
          
          {results.map((r, sIdx) => {
            if (!Array.isArray(r.data) || r.data.length < 2) return null;
            const pts = r.data.map((p: any) => {
              const t = new Date(p.timestamp).getTime();
              const x = padding + ((t - minTime) / timeRange) * (width - 2 * padding);
              const y = padding + (1 - (p.value - minVal) / valRange) * (height - 2 * padding);
              return `${x},${y}`;
            });

            return (
              <polyline
                key={sIdx}
                fill="none"
                stroke={colors[sIdx % colors.length]}
                strokeWidth="2.5"
                points={pts.join(' ')}
              />
            );
          })}
        </svg>

        <div className="flex gap-4 justify-center items-center flex-wrap pt-1 border-t border-slate-800">
          {results.map((r, sIdx) => (
            <div key={sIdx} className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 capitalize">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors[sIdx % colors.length] }} />
              {r.attr}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderWidgetContent = (widget: WidgetData) => {
    const title = widget.config.title || widget.type;
    const data = telemetryData[widget.id];

    if (!widget.config.assetId) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
          <Settings2 className="w-8 h-8 text-slate-400 mb-2" />
          <span className="text-xs text-muted-foreground">Select data source in Settings</span>
        </div>
      );
    }

    switch (widget.type) {
      case 'chart':
        return renderSVGChart(data);

      case 'gauge': {
        const val = typeof data === 'number' ? data : 0;
        const pct = Math.min(Math.max((val / 100) * 100, 0), 100);
        return (
          <div className="w-full h-full flex flex-col items-center justify-center p-2">
            <div className="relative w-20 h-20 flex items-center justify-center">
              <svg className="absolute w-full h-full transform -rotate-90">
                <circle cx="40" cy="40" r="32" stroke="#1e293b" strokeWidth="6" fill="transparent" />
                <circle
                  cx="40"
                  cy="40"
                  r="32"
                  stroke="#10b981"
                  strokeWidth="6"
                  fill="transparent"
                  strokeDasharray="201"
                  strokeDashoffset={201 - (201 * pct) / 100}
                  className="transition-all duration-500 ease-out"
                />
              </svg>
              <div className="flex flex-col items-center">
                <span className="text-lg font-bold text-slate-800">{val.toFixed(1)}</span>
                <span className="text-[9px] uppercase font-bold text-slate-400">{widget.config.attribute}</span>
              </div>
            </div>
            <span className="text-[10px] font-semibold text-slate-500 mt-2 truncate w-full text-center">{title}</span>
          </div>
        );
      }

      case 'kpi':
      case 'valueCard': {
        const val = typeof data === 'number' ? data : null;
        const attrLabel = ATTRIBUTES.find(a => a.value === widget.config.attribute)?.label || widget.config.attribute;
        return (
          <div className="w-full h-full flex flex-col items-center justify-center p-2 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
            {widget.type === 'kpi' ? (
              <span className="text-4xl font-extrabold tracking-tight text-primary drop-shadow-sm">
                {val !== null ? val.toFixed(1) : '--'}
              </span>
            ) : (
              <span className="text-3xl font-bold text-slate-700">
                {val !== null ? val.toFixed(1) : '--'}
              </span>
            )}
            <span className="text-[10px] font-bold text-slate-400 capitalize mt-1 text-center">{attrLabel}</span>
            <span className="text-[9px] font-medium text-slate-400 mt-1 max-w-[120px] truncate text-center">{title}</span>
          </div>
        );
      }

      case 'maps': {
        const mapData = data || {};
        const asset = mapData.asset || {};
        const zone = asset.zone || {};
        const attrs = mapData.attributes || [];

        if (!asset.planX || !asset.planY || !zone.floorPlanUrl) {
          return (
            <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-slate-900/5 rounded">
              <MapPin className="w-8 h-8 text-slate-400 mb-2" />
              <span className="text-xs text-muted-foreground">Asset position or Floorplan unavailable</span>
            </div>
          );
        }

        const posX = (asset.planX / zone.width) * 100;
        const posY = (asset.planY / zone.height) * 100;

        return (
          <div className="w-full h-full flex flex-col justify-between p-2 relative overflow-hidden bg-slate-100 rounded-lg">
            <div className="flex-1 w-full relative overflow-hidden bg-white border rounded border-slate-200">
              <img
                src={zone.floorPlanUrl}
                alt="Floorplan"
                className="w-full h-full object-contain opacity-80"
              />
              <div
                className="absolute w-3.5 h-3.5 bg-blue-600 rounded-full border-2 border-white shadow -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
                style={{ left: `${posX}%`, top: `${posY}%` }}
              >
                <div className="absolute w-6 h-6 bg-blue-500 rounded-full animate-ping opacity-30" />
              </div>
            </div>

            {attrs.length > 0 && (
              <div className="absolute bottom-4 left-4 bg-slate-900/90 text-white rounded p-1.5 flex flex-col gap-0.5 text-[9px] max-w-[100px] shadow z-10 backdrop-blur-sm">
                <span className="font-bold border-b border-slate-700 pb-0.5 mb-0.5 truncate">{asset.name}</span>
                {attrs.map((at: any, idx: number) => (
                  <div key={idx} className="flex justify-between gap-2">
                    <span className="capitalize text-slate-400">{at.attr}:</span>
                    <span className="font-mono font-bold text-blue-400">{at.value !== null ? at.value.toFixed(1) : '--'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }

      default:
        return <div className="w-full h-full flex items-center justify-center text-muted-foreground">{widget.type}</div>;
    }
  };

  if (isLoading) return <div className="p-8 text-center text-slate-500 font-medium">Loading Dashboard...</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] w-full overflow-hidden bg-background">
      
      {/* TABS SELECTOR (Top Navigation) */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 pt-2 shadow-sm z-10">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {sections.map(sec => (
            <div key={sec.id} className={`flex items-center border-b-2 transition-all ${activeSectionId === sec.id ? 'border-primary bg-primary/5' : 'border-transparent hover:border-slate-300'}`}>
              {editingSectionId === sec.id ? (
                <div className="flex items-center gap-1 px-2 py-1">
                  <input autoFocus value={editingName} onChange={e => setEditingName(e.target.value)} className="w-24 text-sm px-2 py-1 border rounded" />
                  <button onClick={() => handleRenameSubmit(sec.id)} className="text-green-600 hover:text-green-800"><Check className="w-4 h-4"/></button>
                  <button onClick={() => setEditingSectionId(null)} className="text-red-500 hover:text-red-700"><X className="w-4 h-4"/></button>
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
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-100 shadow-sm transition-all duration-300">
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
                    className="text-base font-bold text-slate-800 border-b border-primary/50 focus:border-primary focus:outline-none bg-transparent py-0.5 px-1"
                    placeholder="Enter dashboard name..."
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-6 bg-primary rounded-full" />
                <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">
                  {activeSection?.name || 'Untitled Section'}
                </h1>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={fetchAllTelemetry}
              className="p-2 text-slate-500 hover:text-primary hover:bg-slate-50 border rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button 
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 border rounded-lg transition-colors cursor-not-allowed"
              title="Pause Updates (Coming soon)"
            >
              <EyeOff className="w-4 h-4" />
            </button>
            <button 
              className="p-2 text-slate-500 hover:text-primary hover:bg-slate-50 border rounded-lg transition-colors"
              title="Open full view"
            >
              <ExternalLink className="w-4 h-4" />
            </button>

            <div className="w-[1px] h-6 bg-slate-200 mx-1" />

            {isEditMode ? (
              <div className="flex items-center gap-2">
                <Button 
                  onClick={handleSaveSectionDetails}
                  variant="outline" 
                  className="h-9 px-4 text-xs font-bold gap-1.5 text-slate-600 bg-slate-50 border-slate-200 hover:bg-slate-100 hover:text-slate-800"
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
        <div className="flex-1 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-slate-50 overflow-y-scroll p-4 border-r border-border relative">
          <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: 'linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

          {!activeSectionId ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 relative z-10">
              <p>No sections found. Create a new section to get started.</p>
              <Button onClick={handleAddSection} className="mt-4"><Plus className="w-4 h-4 mr-2"/> Create Section</Button>
            </div>
          ) : (
            <div className="min-h-[800px] w-full relative z-10" key={activeSectionId} ref={containerRef}>
              <GridLayout
                width={containerWidth}
                className="layout"
                layout={layout}
                cols={12}
                rowHeight={30}
                onLayoutChange={onLayoutChange}
                onDragStop={onDragStop}
                onResizeStop={onResizeStop}
                dropConfig={{ enabled: isEditMode }}
                dragConfig={{ enabled: isEditMode, handle: '.drag-handle' }}
                resizeConfig={{ enabled: isEditMode }}
                onDrop={onDrop}
                onDropDragOver={onDropDragOver}
                useCSSTransforms={true}
                style={{ minHeight: '800px' }}
              >
                {widgets.map((widget) => {
                  const l = layout.find(x => x.i === widget.id);
                  if (!l) return null;
                  const isSelected = selectedWidgetId === widget.id && isEditMode;
                  
                  return (
                    <div key={widget.id} data-grid={l} 
                        className={`bg-card border rounded-lg shadow-sm overflow-hidden flex flex-col transition-all ${
                          isSelected ? 'ring-2 ring-primary border-transparent shadow-md shadow-primary/10' : 'border-border'
                        } ${!isEditMode ? 'hover:shadow-md' : 'cursor-pointer'}`}
                        onClick={() => { if (isEditMode) { setSelectedWidgetId(widget.id); setActiveTab('settings'); } }}>
                      
                      {/* Widget Header / Drag Handle (Only visible in Modify/Edit Mode - NO DELETE BUTTON HERE) */}
                      {isEditMode ? (
                        <div className="h-8 bg-muted/30 border-b border-border flex items-center justify-between px-3 cursor-move drag-handle group">
                          <div className="flex items-center gap-2">
                            <GripHorizontal className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{widget.type}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="h-2 bg-transparent w-full" />
                      )}
                      
                      {/* Widget Content */}
                      <div className="flex-1 p-3 overflow-hidden relative">
                        {renderWidgetContent(widget)}
                      </div>
                    </div>
                  );
                })}
              </GridLayout>
              
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
          <div className="w-80 bg-card flex flex-col shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-20 transition-all duration-300 animate-in slide-in-from-right">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col">
              <TabsList className="w-full grid grid-cols-2 rounded-none h-12 bg-muted/30 border-b border-border p-0">
                <TabsTrigger value="widgets" className="rounded-none data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary h-full">
                  WIDGETS
                </TabsTrigger>
                <TabsTrigger value="settings" className="rounded-none data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary h-full">
                  SETTINGS
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="widgets" className="flex-1 p-4 overflow-y-auto m-0">
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
                      <tmpl.icon className="w-6 h-6 text-slate-600 mb-2" />
                      <span className="text-xs font-semibold text-slate-700">{tmpl.label}</span>
                    </div>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="settings" className="flex-1 p-4 m-0 overflow-y-auto flex flex-col justify-between">
                {(() => {
                  const selectedWidget = widgets.find(w => w.id === selectedWidgetId);
                  if (!selectedWidget) {
                    return (
                      <div className="flex flex-col items-center justify-center flex-1 text-center p-4">
                        <Settings className="w-10 h-10 text-slate-300 mb-3" />
                        <p className="text-sm text-slate-500 font-medium">Select a widget on the canvas to configure it.</p>
                      </div>
                    );
                  }

                  const isMultiAttribute = ['chart', 'maps'].includes(selectedWidget.type);

                  return (
                    <div className="flex flex-col flex-1 justify-between h-full space-y-6">
                      <div className="space-y-4">
                        <div className="p-3 bg-secondary/30 border border-border rounded-lg flex items-center gap-3">
                          <Settings2 className="w-5 h-5 text-primary" />
                          <div>
                            <h3 className="text-sm font-bold capitalize">{selectedWidget.type} Config</h3>
                            <p className="text-[10px] text-muted-foreground font-mono truncate w-48 font-bold">ID: {selectedWidget.id}</p>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-slate-600">Widget Title</label>
                          <input 
                            type="text" 
                            value={selectedWidget.config.title || ''}
                            onChange={(e) => updateWidgetConfig({...selectedWidget.config, title: e.target.value})}
                            className="w-full text-sm p-2 border border-border rounded-md bg-background" 
                          />
                        </div>

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
                          <label className="text-xs font-semibold text-slate-600">
                            {isMultiAttribute ? 'Telemetry Attributes' : 'Telemetry Attribute'}
                          </label>
                          
                          {isMultiAttribute ? (
                            <div className="space-y-1 bg-background border border-border rounded-md p-2">
                              {(() => {
                                const availableAttributes = getAssetAttributes(selectedWidget.config.assetId);
                                return availableAttributes.map(attr => {
                                  const isChecked = (selectedWidget.config.attributes || []).includes(attr.value);
                                  return (
                                    <label key={attr.value} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer p-1 rounded hover:bg-slate-50">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={(e) => {
                                          const currentList = selectedWidget.config.attributes || [];
                                          const newList = e.target.checked
                                            ? [...currentList, attr.value]
                                            : currentList.filter((x: string) => x !== attr.value);
                                          updateWidgetConfig({...selectedWidget.config, attributes: newList});
                                        }}
                                        className="rounded text-primary focus:ring-primary border-slate-300"
                                      />
                                      {attr.label}
                                    </label>
                                  );
                                });
                              })()}
                            </div>
                          ) : (
                            <SearchableSelect
                              value={selectedWidget.config.attribute || 'temperature'}
                              placeholder="Select Attribute..."
                              options={getAssetAttributes(selectedWidget.config.assetId)}
                              onChange={(val) => updateWidgetConfig({...selectedWidget.config, attribute: val})}
                            />
                          )}
                        </div>
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
                              confirmText: 'Hapus',
                              cancelText: 'Batal',
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
        cancelText={confirmModal?.cancelText || 'Batal'}
        variant={confirmModal?.variant || 'danger'}
        onConfirm={() => confirmModal?.onConfirm()}
        onCancel={() => setConfirmModal(null)}
      />
    </div>
  );
}
