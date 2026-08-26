'use client';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Responsive, Layout } from 'react-grid-layout';
const ResponsiveReactGridLayout = Responsive as any;
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import {
  Activity, LayoutGrid, Settings2, Plus, GripHorizontal, Settings, LineChart, Hash, MapPin, Tablet, Edit2, Trash2, Check, X, RefreshCw, Eye, EyeOff, LayoutTemplate, ExternalLink, Save, Lock, ChevronDown, Search
} from 'lucide-react';
import { getApiUrl, getBackendUrl } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/navigation';
import ConfirmModal from '../../components/ConfirmModal';
import { useSocket } from '../../context/SocketContext';
import { ValueCardWidget } from '../components/widgets/ValueCardWidget';
import { KPIWidget } from '../components/widgets/KPIWidget';
import { GaugeWidget } from '../components/widgets/GaugeWidget';
import { ChartWidget } from '../components/widgets/ChartWidget';
import { MapWidget } from '../components/widgets/MapWidget';



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
  { type: 'valueCard', label: 'Value Card', icon: Hash, w: 2, h: 2, minW: 2, minH: 2 },
  { type: 'kpi', label: 'KPI', icon: Plus, w: 2, h: 2, minW: 2, minH: 2 },
  { type: 'gauge', label: 'Gauge', icon: Activity, w: 3, h: 3, minW: 2, minH: 2 },
  { type: 'chart', label: 'Chart', icon: LineChart, w: 6, h: 4, minW: 4, minH: 3 },
  { type: 'maps', label: 'Maps', icon: MapPin, w: 6, h: 4, minW: 4, minH: 3 },
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
  const { tenantId, token } = useAuth();
  const { socket } = useSocket();
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
  const [backupSectionData, setBackupSectionData] = useState<{ layout: Layout, widgets: WidgetData[] } | null>(null);
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
  const layout = activeSection?.layout || [];
  const widgets = activeSection?.widgets || [];

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
      attributes: w.config?.attributes
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
  }, [widgetsDependency, activeSectionId, widgetRangesDependency]);

  useEffect(() => {
    fetchAllTelemetry();
    const interval = setInterval(fetchAllTelemetry, 10000);
    return () => clearInterval(interval);
  }, [fetchAllTelemetry]);

  // Real-time WebSocket update push for chart widgets in realtime mode
  useEffect(() => {
    if (!socket) return;

    const handleAssetUpdate = (updatedAsset: any) => {
      widgets.forEach(widget => {
        if (widget.type === 'chart') {
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

  const layoutRef = useRef<string>('');

  // Keep layoutRef in sync with current layout (read-only, no state updates)
  useEffect(() => {
    layoutRef.current = JSON.stringify(layout);
  }, [layout]);

  const onLayoutChange = useCallback((newLayout: Layout, allLayouts: any) => {
    if (!activeSectionId || !isEditMode) return;

    const serialized = JSON.stringify(newLayout);
    if (serialized === layoutRef.current) return;
    layoutRef.current = serialized;

    setSections(prev => prev.map(sec =>
      sec.id === activeSectionId ? { ...sec, layout: newLayout } : sec
    ));
    setIsDirty(true);
  }, [activeSectionId, isEditMode]);

  const onDragStop = useCallback((newLayout: Layout) => {
    if (!activeSectionId || !isEditMode) return;
    setIsDirty(true);
    setSections(prev => prev.map(sec =>
      sec.id === activeSectionId ? { ...sec, layout: newLayout } : sec
    ));
    saveLayoutToDb(activeSectionId, newLayout, widgets);
  }, [activeSectionId, isEditMode, widgets]);

  const onResizeStop = useCallback((newLayout: Layout) => {
    if (!activeSectionId || !isEditMode) return;
    setIsDirty(true);
    setSections(prev => prev.map(sec =>
      sec.id === activeSectionId ? { ...sec, layout: newLayout } : sec
    ));
    saveLayoutToDb(activeSectionId, newLayout, widgets);
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

    const hasDataSource = widget.type === 'chart'
      ? (widget.config.assetId || (widget.config.targets && widget.config.targets.length > 0))
      : widget.config.assetId;

    if (!hasDataSource) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
          <Settings2 className="w-8 h-8 text-slate-400 mb-2" />
          <span className="text-xs text-muted-foreground">Select data source in Settings</span>
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
            rangeInfo={rangeInfo}
            setWidgetRange={setWidgetRange}
            updateCustomRange={updateCustomRange}
          />
        );
      }

      case 'gauge': {
        const val = typeof data === 'number' ? data : 0;
        return <GaugeWidget value={val} attribute={widget.config.attribute || ''} widget={widget} />;
      }

      case 'kpi': {
        const val = typeof data === 'number' ? data : null;
        return <KPIWidget data={val} attribute={widget.config.attribute} />;
      }

      case 'valueCard': {
        const val = typeof data === 'number' ? data : null;
        return <ValueCardWidget data={val} attribute={widget.config.attribute} />;
      }

      case 'maps': {
        return <MapWidget data={data} getBackendUrl={getBackendUrl} />;
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
              onClick={fetchAllTelemetry}
              className="p-2 text-muted-foreground hover:text-primary hover:bg-secondary border border-border rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary border border-border rounded-lg transition-colors cursor-not-allowed"
              title="Pause Updates (Coming soon)"
            >
              <EyeOff className="w-4 h-4" />
            </button>
            <button
              className="p-2 text-muted-foreground hover:text-primary hover:bg-secondary border border-border rounded-lg transition-colors"
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
          {(() => {
            const currentCols = containerWidth > 1200 ? 12 : containerWidth > 996 ? 10 : containerWidth > 768 ? 6 : containerWidth > 480 ? 4 : 2;
            const gridX = containerWidth ? ((containerWidth - 32 - ((currentCols - 1) * 16)) / currentCols) + 16 : 80;
            const gridY = 80 + 16; // rowHeight + margin
            return (
              <div
                className="absolute inset-0 pointer-events-none opacity-50 transition-all duration-300"
                style={isEditMode ? {
                  backgroundImage: `
                    linear-gradient(to bottom, rgba(148, 163, 184, 0.35) 1px, transparent 1px),
                    linear-gradient(to right, rgba(148, 163, 184, 0.35) 1px, transparent 1px)
                  `,
                  backgroundSize: `${gridX}px ${gridY}px`,
                  backgroundPosition: '16px 16px' // container padding offset
                } : {
              backgroundImage: 'linear-gradient(rgba(148, 163, 184, 0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.12) 1px, transparent 1px)',
              backgroundSize: '20px 20px'
            }}
          ></div>
          );})()}

          {!activeSectionId ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 relative z-10">
              <p>No sections found. Create a new section to get started.</p>
              <Button onClick={handleAddSection} className="mt-4"><Plus className="w-4 h-4 mr-2" /> Create Section</Button>
            </div>
          ) : (
            <div className="min-h-[800px] w-full relative z-10" key={activeSectionId} ref={containerRef}>
              <ResponsiveReactGridLayout
                width={containerWidth}
                className="layout"
                layouts={{ lg: layout }}
                breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
                rowHeight={80}
                margin={[16, 16]}
                containerPadding={[16, 16]}
                onLayoutChange={(curr: Layout, all: any) => onLayoutChange(curr, all)}
                onDragStop={(layout: Layout) => onDragStop(layout)}
                onResizeStop={(layout: Layout) => onResizeStop(layout)}
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
                      className={`bg-card border rounded-lg shadow-sm overflow-hidden flex flex-col transition-all ${isSelected ? 'ring-2 ring-primary border-transparent shadow-md shadow-primary/10' : 'border-border'
                        } ${!isEditMode ? 'hover:shadow-md' : 'cursor-pointer'}`}
                      onClick={() => { if (isEditMode) { setSelectedWidgetId(widget.id); setActiveTab('settings'); } }}>

                      {/* Unified Widget Header (Title always on top!) */}
                      <div className={`px-3 py-2 flex items-center justify-between border-b border-muted/10 shrink-0 select-none ${isEditMode ? 'bg-muted/10 cursor-move drag-handle group' : ''}`}>
                        <div className="flex items-center gap-1.5 overflow-hidden mr-2">
                          {isEditMode && <GripHorizontal className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />}
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate capitalize">
                            {widget.config.title || (widget.type === 'valueCard' ? 'Value Card' : widget.type)}
                          </span>
                        </div>
                        {isEditMode && (
                          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded shrink-0">
                            {widget.type}
                          </span>
                        )}
                      </div>

                      {/* Widget Content */}
                      <div className="flex-1 p-1 overflow-hidden relative">
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
                      <tmpl.icon className="w-6 h-6 text-slate-600 dark:text-slate-400 mb-2" />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{tmpl.label}</span>
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

                  const isChart = selectedWidget.type === 'chart';
                  const isMultiAttribute = ['maps'].includes(selectedWidget.type);

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
                            onChange={(e) => updateWidgetConfig({ ...selectedWidget.config, title: e.target.value })}
                            className="w-full text-sm p-2 border border-border rounded-md bg-background text-foreground"
                          />
                        </div>

                        {isChart ? (
                          <>
                            {/* Custom Targets list builder for chart widget */}
                            {(() => {
                              const targets = selectedWidget.config.targets || [];
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
                              const activeType = targets.length > 0 ? getAttributeTypeKey(targets[0].attribute) : null;

                              const availableAttrs = getAssetAttributes(newTargetAssetId);
                              const matchingAttrs = availableAttrs.filter(attr => activeType === null || getAttributeTypeKey(attr.value) === activeType);

                              return (
                                <div className="space-y-4 border-t border-border pt-4">
                                  {/* List current targets */}
                                  <div className="space-y-2">
                                    <label className="text-xs font-semibold text-slate-600">Chart Targets</label>
                                    {targets.length === 0 ? (
                                      <p className="text-[11px] text-muted-foreground italic bg-secondary/10 p-2 rounded border border-dashed border-border">
                                        No targets added yet. Use the fields below to add assets/attributes.
                                      </p>
                                    ) : (
                                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                        {targets.map((t: any, idx: number) => {
                                          const assetName = assets.find(a => a.id === t.assetId)?.name || t.assetId;
                                          return (
                                            <div key={idx} className="flex items-center justify-between text-[11px] p-2 bg-secondary/35 border border-border rounded-md">
                                              <div className="font-semibold truncate flex-1 pr-2 text-foreground">
                                                {assetName} <span className="text-muted-foreground font-medium">({t.attribute})</span>
                                              </div>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const updated = targets.filter((_: any, i: number) => i !== idx);
                                                  updateWidgetConfig({
                                                    ...selectedWidget.config,
                                                    targets: updated
                                                  });
                                                }}
                                                className="text-destructive hover:text-red-600 transition-colors p-1"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>

                                  {/* Add Target Section */}
                                  <div className="space-y-3 bg-secondary/10 border border-border/80 rounded-lg p-3">
                                    <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Add Target</h4>

                                    <div className="space-y-1.5">
                                      <label className="text-[10px] font-semibold text-slate-400">Target Asset</label>
                                      <SearchableSelect
                                        value={newTargetAssetId}
                                        placeholder="Select Asset..."
                                        options={assets.map(a => ({ value: a.id, label: a.name }))}
                                        onChange={(val) => {
                                          setNewTargetAssetId(val);
                                          const attrs = getAssetAttributes(val);
                                          const matching = attrs.filter(attr => activeType === null || getAttributeTypeKey(attr.value) === activeType);
                                          setNewTargetAttribute(matching.length > 0 ? matching[0].value : '');
                                        }}
                                      />
                                    </div>

                                    {newTargetAssetId && (
                                      <div className="space-y-1.5">
                                        <label className="text-[10px] font-semibold text-slate-400">Attribute</label>
                                        {matchingAttrs.length > 0 ? (
                                          <div className="flex gap-2">
                                            <div className="flex-1">
                                              <SearchableSelect
                                                value={newTargetAttribute}
                                                placeholder="Select Attribute..."
                                                options={matchingAttrs}
                                                onChange={(val) => setNewTargetAttribute(val)}
                                              />
                                            </div>
                                            <Button
                                              type="button"
                                              className="px-3 text-xs font-bold"
                                              onClick={() => {
                                                if (newTargetAssetId && newTargetAttribute) {
                                                  const updatedTargets = [...targets, { assetId: newTargetAssetId, attribute: newTargetAttribute }];
                                                  updateWidgetConfig({
                                                    ...selectedWidget.config,
                                                    targets: updatedTargets
                                                  });
                                                  setNewTargetAssetId('');
                                                  setNewTargetAttribute('');
                                                }
                                              }}
                                            >
                                              Add
                                            </Button>
                                          </div>
                                        ) : (
                                          <p className="text-[10px] text-amber-500 font-semibold mt-1 bg-amber-500/10 p-1.5 rounded border border-amber-500/20">
                                            {activeType ? `No matching attributes of type "${activeType}" on this asset.` : 'No attributes available.'}
                                          </p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}
                          </>
                        ) : (
                          <>
                            {/* Standard Single Asset Config */}
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
                              ) : (
                                <SearchableSelect
                                  value={selectedWidget.config.attribute || 'temperature'}
                                  placeholder="Select Attribute..."
                                  options={getAssetAttributes(selectedWidget.config.assetId)}
                                  onChange={(val) => updateWidgetConfig({ ...selectedWidget.config, attribute: val })}
                                />
                              )}
                            </div>
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
    </div>
  );
}
