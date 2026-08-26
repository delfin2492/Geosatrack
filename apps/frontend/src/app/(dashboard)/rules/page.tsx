'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getApiUrl } from '../../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import {
  ShieldAlert, Plus, Trash2, Save, X, ToggleLeft, ToggleRight,
  Settings, ClipboardList, ChevronDown, Search, Copy,
  Building, Map as MapIcon, Monitor, DoorClosed, Car, Battery, Zap, Plug, Box, Activity,
  Download, Filter, Calculator, BellRing, Mail, Send, Clock, Lightbulb, SlidersHorizontal
} from 'lucide-react';
import ConfirmModal from '../../components/ConfirmModal';
import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Node,
  Handle,
  Position,
  NodeChange,
  EdgeChange,
  applyNodeChanges,
  applyEdgeChanges
} from 'reactflow';
import 'reactflow/dist/style.css';

const CustomNode = ({ data, id }: any) => {
  const isProcessor = data.type.startsWith('math_') || data.type.startsWith('logic_') || data.type === 'process_math' || data.type === 'logic_filter';
  const isInput = data.type.startsWith('trigger_') || data.type === 'input_attribute';

  let symbolBadge = '';
  switch (data.type) {
    case 'math_add': symbolBadge = '+'; break;
    case 'math_sub': symbolBadge = '-'; break;
    case 'math_mul': symbolBadge = '×'; break;
    case 'math_div': symbolBadge = '÷'; break;
    case 'math_avg': symbolBadge = 'Avg'; break;
    case 'math_pct': symbolBadge = '%'; break;
    case 'process_math': symbolBadge = '+'; break;
    case 'logic_gt': symbolBadge = '>'; break;
    case 'logic_lt': symbolBadge = '<'; break;
    case 'logic_eq': symbolBadge = '='; break;
    case 'logic_neq': symbolBadge = '!='; break;
    case 'logic_gte': symbolBadge = '>='; break;
    case 'logic_lte': symbolBadge = '<='; break;
    case 'logic_and': symbolBadge = 'AND'; break;
    case 'logic_or': symbolBadge = 'OR'; break;
    case 'logic_filter': symbolBadge = '>'; break;
  }

  // 1. PROCESSOR NODE (Compact Green Square with Symbol & Dual Left Handles + Right Output Handle)
  if (isProcessor) {
    return (
      <div className="w-12 h-12 rounded-xl bg-emerald-600 border-2 border-emerald-500 shadow-xl flex items-center justify-center relative text-white font-black text-base select-none">
        {/* Left Target Handle 1 (Input A) */}
        <Handle
          type="target"
          position={Position.Left}
          id="input_a"
          style={{ top: '30%', left: '-6px', width: '10px', height: '10px', backgroundColor: '#a3e635', borderColor: '#3f6212', borderWidth: '2px' }}
        />
        {/* Left Target Handle 2 (Input B) */}
        <Handle
          type="target"
          position={Position.Left}
          id="input_b"
          style={{ top: '70%', left: '-6px', width: '10px', height: '10px', backgroundColor: '#a3e635', borderColor: '#3f6212', borderWidth: '2px' }}
        />

        <span>{symbolBadge}</span>

        {/* Right Source Handle (Output) */}
        <Handle
          type="source"
          position={Position.Right}
          id="output"
          style={{ right: '-6px', width: '10px', height: '10px', backgroundColor: '#a3e635', borderColor: '#3f6212', borderWidth: '2px' }}
        />
      </div>
    );
  }

  // 2. ATTRIBUTE VALUE NODE (Interactive Button UI matching Select Attributes image)
  if (data.type === 'input_attribute' || data.type === 'trigger_telemetry') {
    const assetObj = (data.assets || []).find((a: any) => a.id === data.assetId);
    const rawAssetName = data.assetName || assetObj?.name || (data.assetId === 'ANY' ? 'Any Asset' : '');
    const assetName = rawAssetName || (data.assetId ? 'Selected Asset' : 'Select Asset');
    const attrName = data.attributeName || 'Select Attribute';
    
    let AssetIcon = Zap;
    const nameLower = assetName.toLowerCase();
    if (nameLower.includes('lampu') || nameLower.includes('light')) AssetIcon = Lightbulb;
    else if (nameLower.includes('mobil') || nameLower.includes('car')) AssetIcon = Car;
    else if (nameLower.includes('door') || nameLower.includes('pintu')) AssetIcon = DoorClosed;
    else if (nameLower.includes('building') || nameLower.includes('gedung')) AssetIcon = Building;

    return (
      <div className="min-w-[190px] bg-card border border-border shadow-xl rounded-lg relative">
        <div className="bg-blue-700 px-3 py-1 text-white font-bold text-[11px] tracking-wide text-center select-none rounded-t-[7px]">
          Attribute value
        </div>
        <div className="p-2.5 bg-secondary/10 flex items-center gap-2 rounded-b-[7px]">
          {/* INTERACTIVE CLICKABLE ASSET SELECTOR BUTTON */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (data.onOpenPicker) {
                data.onOpenPicker(id, data);
              }
            }}
            className="flex-1 bg-white dark:bg-zinc-800 hover:bg-amber-50/70 dark:hover:bg-amber-950/40 border border-gray-300 dark:border-zinc-700 hover:border-amber-500 rounded-md p-1.5 flex items-center gap-2 cursor-pointer shadow-sm hover:shadow-md transition-all active:scale-[0.98] text-left group/btn"
          >
            <div className="w-5 h-5 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-500 flex items-center justify-center shrink-0 group-hover/btn:scale-110 transition-transform">
              <AssetIcon className="w-3 h-3" />
            </div>
            <div className="flex flex-col leading-tight overflow-hidden">
              <span className="text-[10px] font-bold text-gray-800 dark:text-gray-200 truncate max-w-[95px]">{assetName}</span>
              <span className="text-[9px] font-medium text-gray-500 dark:text-gray-400 truncate max-w-[95px]">{attrName}</span>
            </div>
          </button>
          <span className="text-[10px] font-bold text-muted-foreground shrink-0 ml-1">Value</span>
        </div>
        <Handle
          type="source"
          position={Position.Right}
          id="output"
          style={{ right: '-6px', top: '65%', width: '12px', height: '12px', backgroundColor: '#a3e635', borderColor: '#3f6212', borderWidth: '2px', zIndex: 30 }}
        />
      </div>
    );
  }

  // 3. GEOFENCE NODE
  if (data.type === 'trigger_geofence') {
    return (
      <div className="min-w-[180px] bg-card border border-border shadow-xl rounded-lg relative">
        <div className="bg-blue-700 px-3 py-1 text-white font-bold text-[11px] tracking-wide rounded-t-[7px]">
          Geofence Event
        </div>
        <div className="p-2.5 bg-secondary/20 flex items-center gap-2 rounded-b-[7px]">
          <MapIcon className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-bold text-foreground">{data.label}</span>
        </div>
        <Handle
          type="source"
          position={Position.Right}
          id="output"
          style={{ right: '-6px', top: '65%', width: '12px', height: '12px', backgroundColor: '#a3e635', borderColor: '#3f6212', borderWidth: '2px', zIndex: 30 }}
        />
      </div>
    );
  }

  // 4. ACTION / OUTPUT NODES
  let ActionIcon = BellRing;
  if (data.type === 'action_email') ActionIcon = Mail;
  if (data.type === 'action_telegram') ActionIcon = Send;
  if (data.type === 'action_attribute') ActionIcon = Download;

  return (
    <div className="min-w-[180px] bg-card border border-purple-500/50 shadow-xl rounded-lg relative">
      <div className="bg-purple-700 px-3 py-1 text-white font-bold text-[11px] tracking-wide rounded-t-[7px]">
        Action Output
      </div>
      <div className="p-2.5 bg-secondary/20 flex items-center gap-2 rounded-b-[7px]">
        <ActionIcon className="w-4 h-4 text-purple-400" />
        <span className="text-xs font-bold text-foreground">{data.label}</span>
      </div>
      <Handle
        type="target"
        position={Position.Left}
        id="input_a"
        style={{ left: '-6px', top: '65%', width: '12px', height: '12px', backgroundColor: '#a3e635', borderColor: '#3f6212', borderWidth: '2px', zIndex: 30 }}
      />
    </div>
  );
};

const nodeTypes = { customNode: CustomNode };

// Node Types
type NodeType = 'trigger_geofence' | 'trigger_telemetry' | 'input_attribute' | 'math_add' | 'math_sub' | 'math_mul' | 'math_div' | 'math_avg' | 'math_pct' | 'logic_gt' | 'logic_lt' | 'logic_eq' | 'logic_neq' | 'logic_gte' | 'logic_lte' | 'logic_and' | 'logic_or' | 'logic_filter' | 'process_math' | 'action_attribute' | 'action_alarm' | 'action_email' | 'action_telegram';

interface Rule {
  id: string;
  name: string;
  ruleType: 'WHEN_THEN' | 'FLOW';
  isActive: boolean;
  flowGraph?: string;
  ruleConfig?: string;
  createdAt: string;
}

interface RuleExecutionLog {
  id: string;
  status: 'SUCCESS' | 'FAILED';
  message: string;
  createdAt: string;
}

const getAssetIcon = (type: string) => {
  const t = (type || '').toLowerCase();
  if (t.includes('building')) return Building;
  if (t.includes('city')) return MapIcon;
  if (t.includes('console') || t.includes('air quality')) return Monitor;
  if (t.includes('door')) return DoorClosed;
  if (t.includes('vehicle') || t.includes('fleet')) return Car;
  if (t.includes('battery')) return Battery;
  if (t.includes('charger')) return Zap;
  if (t.includes('electricity') || t.includes('consumer')) return Plug;
  if (t.includes('sensor')) return Activity;
  return Box;
};

const getAttributeUnit = (attrName: string, customUnit?: string) => {
  if (customUnit) return customUnit;
  const nameLower = (attrName || '').toLowerCase();
  
  if (nameLower === 'temperature' || nameLower.includes('temp')) return '°C';
  if (nameLower === 'humidity' || nameLower.includes('humid')) return '%';
  if (nameLower === 'voltage' || nameLower.includes('volt')) return 'V';
  if (nameLower === 'current' || nameLower.includes('amp')) return 'A';
  if (nameLower.includes('power') || nameLower === 'watt') return 'W';
  if (nameLower.includes('brightness')) return '%';
  if (nameLower.includes('battery') || nameLower === 'batt') return '%';
  if (nameLower.includes('rssi')) return 'dBm';
  if (nameLower.includes('accel') || nameLower.includes('acceleration')) return 'm/s²';
  if (nameLower === 'pitch' || nameLower === 'roll' || nameLower === 'yaw') return '°';
  if (nameLower.includes('speed') || nameLower.includes('velocity')) return 'km/h';
  if (nameLower.includes('pressure')) return 'hPa';
  if (nameLower.includes('distance')) return 'm';
  if (nameLower.includes('lux') || nameLower.includes('luminance')) return 'lx';
  if (nameLower.includes('co2')) return 'ppm';
  
  return '';
};

const getAssetAttributes = (asset: any) => {
  let attrs: { name: string; type: string; unit?: string }[] = [{ name: 'status', type: 'string' }]; // 'status' is a native Prisma field

  if (asset && asset.description) {
    try {
      const parsed = JSON.parse(asset.description);
      if (parsed.attributes && Array.isArray(parsed.attributes)) {
        parsed.attributes.forEach((a: any) => {
          if (a.name) {
            let type = 'string';
            const dt = (a.dataType || '').toLowerCase();
            if (dt.includes('int') || dt.includes('double') || dt.includes('float') || dt.includes('number')) type = 'number';
            if (dt.includes('bool')) type = 'boolean';

            // Prevent duplicates
            if (!attrs.find(x => x.name === a.name)) {
              attrs.push({ name: a.name, type });
            }
          }
        });
      }
    } catch (e) {
      console.warn("Failed to parse asset description JSON for attributes", e);
    }
  }

  // Inject RTLS Virtual Attributes for Mesh Eye Sensors
  if (asset && asset.type === 'MESH_EYE_SENSOR') {
    if (!attrs.find(x => x.name === 'position_x')) attrs.push({ name: 'position_x', type: 'number' });
    if (!attrs.find(x => x.name === 'position_y')) attrs.push({ name: 'position_y', type: 'number' });
  }

  return attrs;
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
        className="w-full h-8 bg-secondary/35 border border-border px-2.5 py-1.5 rounded-lg text-xs cursor-pointer flex justify-between items-center transition-colors hover:border-primary/50"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center truncate">
          {SelectedIcon && <SelectedIcon className="w-3.5 h-3.5 mr-2 text-primary shrink-0" />}
          <span className="truncate pr-2">{selectedOption ? selectedOption.label : placeholder}</span>
        </div>
        <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
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
                className="w-full bg-transparent border-none outline-none text-[11px] font-medium"
                autoFocus
              />
            </div>
          )}
          <div className="max-h-56 overflow-y-auto p-1">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-[10px] text-muted-foreground text-center">No results found</div>
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
                    <span className="font-medium">{o.label}</span>
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

export default function RulesPage() {
  const { tenantId, token, isAdmin } = useAuth();
  

  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteTargetRule, setDeleteTargetRule] = useState<{ id: string; name: string } | null>(null);
  const [alertModal, setAlertModal] = useState<{ title?: string; message: string; variant?: 'danger' | 'warning' | 'info' } | null>(null);

  // State for Image-matching "Select attributes" Modal
  const [attrPickerNode, setAttrPickerNode] = useState<{ id: string; data: any } | null>(null);
  const [pickerSelectedAssetId, setPickerSelectedAssetId] = useState<string>('');
  const [pickerSelectedAttribute, setPickerSelectedAttribute] = useState<string>('');
  const [assetSearchFilter, setAssetSearchFilter] = useState<string>('');

  const [initialAssetId, setInitialAssetId] = useState<string>('');
  const [initialAttribute, setInitialAttribute] = useState<string>('');

  const handleOpenAttributePicker = (nodeId: string, nodeData: any) => {
    setAttrPickerNode({ id: nodeId, data: nodeData });
    const initAssetId = nodeData.assetId && nodeData.assetId !== 'ANY' ? nodeData.assetId : (assets[0]?.id || '');
    const initAttr = nodeData.attributeName || '';
    setPickerSelectedAssetId(initAssetId);
    setPickerSelectedAttribute(initAttr);
    setInitialAssetId(initAssetId);
    setInitialAttribute(initAttr);
  };
  const [activeTab, setActiveTab] = useState<'list' | 'editor_flow' | 'editor_whenthen'>('list');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [ruleName, setRuleName] = useState('');

  // Flow State
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  // When-Then State
  const [wtGroups, setWtGroups] = useState<any[]>([]);
  const [wtActions, setWtActions] = useState<any[]>([]);
  const [wtThenFrequency, setWtThenFrequency] = useState<string>('ALWAYS');
  const [wtActiveMode, setWtActiveMode] = useState<'ALWAYS' | 'SPECIFIC_PERIOD' | 'DAILY_PERIOD'>('ALWAYS');
  const [wtSpecificStartDate, setWtSpecificStartDate] = useState<string>('');
  const [wtSpecificEndDate, setWtSpecificEndDate] = useState<string>('');
  const [wtDailyStartTime, setWtDailyStartTime] = useState<string>('08:00');
  const [wtDailyEndTime, setWtDailyEndTime] = useState<string>('17:00');
  const [wtSpecificAllDays, setWtSpecificAllDays] = useState<boolean>(false);
  const [wtDailyActiveDays, setWtDailyActiveDays] = useState<string[]>(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
  const [wtDailyRepetitionEnds, setWtDailyRepetitionEnds] = useState<'NEVER' | 'ON_DATE'>('NEVER');
  const [wtDailyRepetitionEndDate, setWtDailyRepetitionEndDate] = useState<string>('');

  const [assets, setAssets] = useState<any[]>([]);
  const [geofences, setGeofences] = useState<any[]>([]);

  const [selectedLogRule, setSelectedLogRule] = useState<Rule | null>(null);
  const [logs, setLogs] = useState<RuleExecutionLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const apiHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-tenant-id': tenantId || '',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }, [tenantId, token]);

  const fetchRules = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/rules`, { headers: apiHeaders() });
      if (res.ok) setRules(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [tenantId, apiHeaders]);

  const fetchLogs = async (ruleId: string) => {
    setLoadingLogs(true);
    try {
      const res = await fetch(`${getApiUrl()}/rules/${ruleId}/logs`, { headers: apiHeaders() });
      if (res.ok) setLogs(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const fetchDropdownOptions = useCallback(async () => {
    if (!tenantId) return;
    try {
      const assetsRes = await fetch(`${getApiUrl()}/assets`, { headers: apiHeaders() });
      if (assetsRes.ok) setAssets(await assetsRes.json());

      const zonesRes = await fetch(`${getApiUrl()}/zones`, { headers: apiHeaders() });
      if (zonesRes.ok) {
        const zones = await zonesRes.json();
        const allGeofences: any[] = [];
        for (const zone of zones) {
          const detailRes = await fetch(`${getApiUrl()}/floorplan/zones/${zone.id}`, { headers: apiHeaders() });
          if (detailRes.ok) {
            const detail = await detailRes.json();
            if (detail.geofences) {
              allGeofences.push(...detail.geofences.map((gf: any) => ({ ...gf, zoneName: zone.name })));
            }
          }
        }
        setGeofences(allGeofences);
      }
    } catch (err) {
      console.error(err);
    }
  }, [tenantId, apiHeaders]);

  useEffect(() => {
    if (tenantId) {
      fetchRules();
      fetchDropdownOptions();
    }
  }, [tenantId, fetchRules, fetchDropdownOptions]);

  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const handleToggleActive = async (rule: Rule) => {
    try {
      const res = await fetch(`${getApiUrl()}/rules/${rule.id}`, {
        method: 'PATCH',
        headers: apiHeaders(),
        body: JSON.stringify({ isActive: !rule.isActive }),
      });
      if (res.ok) fetchRules();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      const res = await fetch(`${getApiUrl()}/rules/${ruleId}`, {
        method: 'DELETE',
        headers: apiHeaders(),
      });
      if (res.ok) {
        fetchRules();
        if (selectedLogRule?.id === ruleId) {
          setSelectedLogRule(null);
          setLogs([]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDeleteTargetRule(null);
    }
  };

  const handleDuplicateRule = async (rule: Rule) => {
    try {
      const res = await fetch(`${getApiUrl()}/rules`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({
          name: `${rule.name} (Copy)`,
          ruleType: rule.ruleType,
          flowGraph: rule.flowGraph,
          ruleConfig: rule.ruleConfig
        }),
      });
      if (res.ok) {
        fetchRules();
      } else {
        const err = await res.json();
        setAlertModal({ title: 'Gagal Duplikat', message: err.message || 'Gagal menduplikasi rule.', variant: 'danger' });
      }
    } catch (err: any) {
      setAlertModal({ title: 'Terjadi Kesalahan', message: err.message || 'Gagal menduplikasi rule.', variant: 'danger' });
    }
  };

  const handleCreateNewFlow = () => {
    setEditingRule(null);
    setRuleName('New Flow Rule');
    setNodes([]);
    setEdges([]);
    setSelectedNode(null);
    setActiveTab('editor_flow');
  };

  const handleCreateNewWhenThen = () => {
    setEditingRule(null);
    setRuleName('New When-Then Rule');
    setWtGroups([
      {
        id: Date.now().toString(),
        conditions: [{ id: (Date.now() + 1).toString(), assetId: '', attribute: '', operator: '>', value: '', durationMinutes: 0 }]
      }
    ]);
    setWtActions([{ id: (Date.now() + 2).toString(), actionType: 'trigger_asset', assetId: '', attribute: '', command: '' }]);
    setWtThenFrequency('ALWAYS');
    setWtActiveMode('ALWAYS');
    setWtSpecificStartDate('');
    setWtSpecificEndDate('');
    setWtDailyStartTime('08:00');
    setWtDailyEndTime('17:00');
    setWtSpecificAllDays(false);
    setWtDailyActiveDays(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
    setWtDailyRepetitionEnds('NEVER');
    setWtDailyRepetitionEndDate('');
    setActiveTab('editor_whenthen');
  };

  const handleEditRule = (rule: Rule) => {
    setEditingRule(rule);
    setRuleName(rule.name);
    if (rule.ruleType === 'WHEN_THEN') {
      try {
        const config = JSON.parse(rule.ruleConfig || '{}');
        const normalizeGroups = (groupsList: any[]) => groupsList.map((g: any) => ({
          ...g,
          conditions: (g.conditions || []).map((c: any) => ({
            ...c,
            enableDuration: c.enableDuration !== undefined ? c.enableDuration : (Number(c.durationMinutes) > 0)
          }))
        }));
        if (config.groups && Array.isArray(config.groups)) {
          setWtGroups(normalizeGroups(config.groups));
        } else if (config.conditions && Array.isArray(config.conditions)) {
          setWtGroups(normalizeGroups([{ id: 'group-default', conditions: config.conditions }]));
        } else {
          setWtGroups([{ id: Date.now().toString(), conditions: [{ id: Date.now().toString(), assetId: '', attribute: '', operator: '>', value: '', durationMinutes: 0 }] }]);
        }
        setWtActions(config.actions || []);
        setWtThenFrequency(config.thenFrequency || 'ALWAYS');
        setWtActiveMode(config.activeMode || 'ALWAYS');
        setWtSpecificStartDate(config.specificPeriod?.startDate || '');
        setWtSpecificEndDate(config.specificPeriod?.endDate || '');
        setWtDailyStartTime(config.dailyPeriod?.startTime || '08:00');
        setWtDailyEndTime(config.dailyPeriod?.endTime || '17:00');
        setWtSpecificAllDays(!!config.specificPeriod?.allDays);
        setWtDailyActiveDays(config.dailyPeriod?.activeDays || ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
        setWtDailyRepetitionEnds(config.dailyPeriod?.repetitionEnds || 'NEVER');
        setWtDailyRepetitionEndDate(config.dailyPeriod?.repetitionEndDate || '');
      } catch (e) {
        setWtGroups([]);
        setWtActions([]);
      }
      setActiveTab('editor_whenthen');
    } else {
      try {
        const graph = JSON.parse(rule.flowGraph || '{}');
        const loadedNodes = graph.nodes || [];
        setNodes(loadedNodes.map((n: any) => ({ ...n, type: 'customNode' })));
        setEdges(graph.edges || []);
      } catch (e) {
        setNodes([]);
        setEdges([]);
      }
      setSelectedNode(null);
      setActiveTab('editor_flow');
    }
  };

  const handleSaveRule = async () => {
    if (!ruleName.trim()) {
      setAlertModal({ title: 'Validation Error', message: 'Nama rule tidak boleh kosong.', variant: 'warning' });
      return;
    }

    const isWhenThen = activeTab === 'editor_whenthen';
    const ruleType = isWhenThen ? 'WHEN_THEN' : 'FLOW';
    const flowGraph = isWhenThen ? null : JSON.stringify({ nodes, edges });
    const ruleConfig = isWhenThen ? JSON.stringify({ 
      thenFrequency: wtThenFrequency,
      activeMode: wtActiveMode,
      specificPeriod: { allDays: wtSpecificAllDays, startDate: wtSpecificStartDate, endDate: wtSpecificEndDate },
      dailyPeriod: { 
        startTime: wtDailyStartTime, 
        endTime: wtDailyEndTime, 
        activeDays: wtDailyActiveDays, 
        repetitionEnds: wtDailyRepetitionEnds, 
        repetitionEndDate: wtDailyRepetitionEndDate 
      },
      groups: wtGroups, 
      actions: wtActions 
    }) : null;

    const method = editingRule ? 'PATCH' : 'POST';
    const endpoint = editingRule ? `${getApiUrl()}/rules/${editingRule.id}` : `${getApiUrl()}/rules`;

    try {
      const res = await fetch(endpoint, {
        method,
        headers: apiHeaders(),
        body: JSON.stringify({ name: ruleName, ruleType, flowGraph, ruleConfig }),
      });

      if (res.ok) {
        setActiveTab('list');
        fetchRules();
      } else {
        const err = await res.json();
        setAlertModal({ title: 'Gagal Menyimpan', message: err.message || 'Gagal menyimpan rule.', variant: 'danger' });
      }
    } catch (err: any) {
      setAlertModal({ title: 'Terjadi Kesalahan', message: err.message || 'Gagal menyimpan rule.', variant: 'danger' });
    }
  };

  const onDragStart = (event: React.DragEvent, nodeType: NodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const addNodeToFlow = useCallback((type: NodeType, position?: { x: number; y: number }) => {
    const id = `node-${Date.now()}`;
    let label = '';
    let initialData: Record<string, any> = {};

        switch (type) {
      case 'trigger_geofence': label = 'Geofence Event'; initialData = { eventType: 'ANY', geofenceId: 'ANY', assetId: 'ANY' }; break;
      case 'input_attribute': label = 'Attribute Value'; initialData = { assetId: 'ANY', attributeName: '' }; break;
      case 'trigger_telemetry': label = 'Attribute Value'; initialData = { assetId: 'ANY', attributeName: '' }; break;

      // Math Processors
      case 'math_add': label = 'Math (+)'; initialData = { operation: 'ADD', valueB: '0' }; break;
      case 'math_sub': label = 'Math (-)'; initialData = { operation: 'SUB', valueB: '0' }; break;
      case 'math_mul': label = 'Math (×)'; initialData = { operation: 'MUL', valueB: '1' }; break;
      case 'math_div': label = 'Math (÷)'; initialData = { operation: 'DIV', valueB: '1' }; break;
      case 'math_avg': label = 'Math (AVG)'; initialData = { operation: 'AVG' }; break;
      case 'math_pct': label = 'Math (%)'; initialData = { operation: 'PCT' }; break;
      case 'process_math': label = 'Math Operation'; initialData = { operation: 'ADD', valueB: '0' }; break;

      // Logic Processors
      case 'logic_gt': label = 'Greater Than (>)'; initialData = { conditionType: 'GT', thresholdValue: '0' }; break;
      case 'logic_lt': label = 'Less Than (<)'; initialData = { conditionType: 'LT', thresholdValue: '0' }; break;
      case 'logic_eq': label = 'Equal To (=)'; initialData = { conditionType: 'EQ', thresholdValue: '0' }; break;
      case 'logic_neq': label = 'Not Equal (!=)'; initialData = { conditionType: 'NEQ', thresholdValue: '0' }; break;
      case 'logic_gte': label = 'Greater/Equal (>=)'; initialData = { conditionType: 'GTE', thresholdValue: '0' }; break;
      case 'logic_lte': label = 'Less/Equal (<=)'; initialData = { conditionType: 'LTE', thresholdValue: '0' }; break;
      case 'logic_and': label = 'Logic AND'; initialData = { conditionType: 'AND' }; break;
      case 'logic_or': label = 'Logic OR'; initialData = { conditionType: 'OR' }; break;
      case 'logic_filter': label = 'Filter Logic'; initialData = { conditionType: 'GT', thresholdValue: '0' }; break;

      // Actions / Outputs
      case 'action_attribute': label = 'Set Attribute Value'; initialData = { targetAssetId: '', targetAttribute: '', commandValue: '' }; break;
      case 'action_alarm': label = 'Create Alarm'; initialData = { messageTemplate: 'Critical alert: Asset {assetName}' }; break;
      case 'action_email': label = 'SMTP Email'; initialData = { toEmail: '', subjectTemplate: 'Alert Notification', bodyTemplate: 'Asset {assetName} triggered an alert.' }; break;
      case 'action_telegram': label = 'Telegram Bot'; initialData = { chatId: '', messageTemplate: 'Alert triggered for {assetName}' }; break;
    }

    const nodePosition = position || { x: 100 + Math.random() * 150, y: 150 + Math.random() * 150 };
    setNodes((prev) => [...prev, { id, type: 'customNode', position: nodePosition, data: { label, type, ...initialData } }]);
  }, [setNodes]);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/reactflow') as NodeType;
    if (typeof type === 'undefined' || !type || !reactFlowInstance) return;

    const position = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    addNodeToFlow(type, position);
  }, [reactFlowInstance, addNodeToFlow]);

  const updateNodeData = (nodeId: string, key: string, value: any) => {
    setNodes((prev) => prev.map((node) => {
      if (node.id === nodeId) {
        const updatedData = { ...node.data, [key]: value };
        if (selectedNode?.id === nodeId) setSelectedNode({ ...node, data: updatedData });
        return { ...node, data: updatedData };
      }
      return node;
    }));
  };

  const deleteSelectedNode = () => {
    if (!selectedNode) return;
    setNodes((prev) => prev.filter((n) => n.id !== selectedNode.id));
    setEdges((prev) => prev.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
    setSelectedNode(null);
  };

  const assetOptions = assets.map(a => ({ label: a.name, value: a.id, icon: getAssetIcon(a.type) }));
  const geofenceOptions = geofences.map(gf => ({ label: `${gf.name} (${gf.zoneName})`, value: gf.id }));

  return (
    <div className="flex flex-col gap-4 pb-12">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-card border border-border rounded-2xl shadow-sm gap-3">
        <div>
          <h2 className="text-sm font-bold flex items-center gap-2 text-foreground">
            <ShieldAlert className="h-4.5 w-4.5 text-primary" /> Automation Rules
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">Create rules for automated alerts.</p>
        </div>

        {activeTab === 'list' ? (
          isAdmin && (
            <div className="relative">
              <Button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="w-full md:w-auto text-xs font-bold cursor-pointer h-8 rounded-xl bg-primary">
                <Plus className="h-4 w-4 mr-1.5" /> Create New Rule <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-full md:w-48 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden animate-in fade-in zoom-in-95">
                  <div
                    onClick={() => { setIsDropdownOpen(false); handleCreateNewWhenThen(); }}
                    className="cursor-pointer text-xs py-2.5 px-4 hover:bg-secondary flex items-center"
                  >
                    <span className="flex-1 font-bold">When-Then Rule</span>
                    <span className="text-[9px] text-muted-foreground ml-2">Simple</span>
                  </div>
                  <div
                    onClick={() => { setIsDropdownOpen(false); handleCreateNewFlow(); }}
                    className="cursor-pointer text-xs py-2.5 px-4 hover:bg-secondary flex items-center"
                  >
                    <span className="flex-1 font-bold">Flow Graph</span>
                    <span className="text-[9px] text-muted-foreground ml-2">Advanced</span>
                  </div>
                </div>
              )}
            </div>
          )
        ) : (
          <div className="flex gap-2 w-full md:w-auto">
            <Button onClick={() => setActiveTab('list')} variant="outline" className="flex-1 md:flex-none text-xs font-bold cursor-pointer h-8 rounded-xl">
              <X className="h-4 w-4 mr-1" /> Cancel
            </Button>
            {isAdmin && (
              <Button onClick={handleSaveRule} className="flex-1 md:flex-none text-xs font-bold cursor-pointer h-8 rounded-xl bg-primary">
                <Save className="h-4 w-4 mr-1.5" /> Save Rule
              </Button>
            )}
          </div>
        )}
      </div>

      {activeTab === 'list' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2 border-border shadow-md rounded-2xl flex flex-col">
            <CardHeader className="py-3.5 border-b border-border">
              <CardTitle className="text-xs font-bold text-foreground">List of Automation Rules</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {rules.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground italic">No automation flow rules have been created yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-secondary/50 text-muted-foreground border-b border-border">
                      <tr>
                        <th className="px-4 py-3 font-semibold w-[25%] whitespace-nowrap">Rules Name</th>
                        <th className="px-4 py-3 font-semibold w-[15%] whitespace-nowrap">Type Rules</th>
                        <th className="px-4 py-3 font-semibold w-[25%] whitespace-nowrap">Timestamp Update</th>
                        <th className="px-4 py-3 font-semibold w-[10%] whitespace-nowrap text-center">Status</th>
                        {isAdmin && <th className="px-4 py-3 font-semibold w-[25%] whitespace-nowrap text-right">Manage</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rules.map((rule) => (
                        <tr
                          key={rule.id}
                          onClick={() => { setSelectedLogRule(rule); fetchLogs(rule.id); }}
                          className={`hover:bg-secondary/20 transition-all cursor-pointer ${selectedLogRule?.id === rule.id ? 'bg-secondary/40 border-l-2 border-primary' : 'border-l-2 border-transparent'}`}
                        >
                          <td className="px-4 py-3 font-bold text-foreground">{rule.name}</td>
                          <td className="px-4 py-3"><Badge variant="outline" className="text-[9px] py-0">{rule.ruleType === 'WHEN_THEN' ? 'WHEN-THEN' : 'FLOW'}</Badge></td>
                          <td className="px-4 py-3 text-[10px] text-muted-foreground">{new Date((rule as any).updatedAt || rule.createdAt).toLocaleString()}</td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleToggleActive(rule); }}
                              className={`w-9 h-4.5 rounded-full relative transition-colors duration-300 ease-in-out cursor-pointer inline-block align-middle ${rule.isActive ? 'bg-green-500' : 'bg-secondary border border-border'}`}
                              title={rule.isActive ? 'Deactivate' : 'Activate'}
                            >
                              <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-[1px] transition-transform duration-300 ease-in-out shadow-sm ${rule.isActive ? 'translate-x-5' : 'translate-x-[1px]'}`} />
                            </button>
                          </td>
                          {isAdmin && (
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                <button onClick={() => handleEditRule(rule)} className="p-1.5 rounded-lg border border-border bg-secondary/30 text-foreground hover:bg-secondary transition-all cursor-pointer" title="Edit">
                                  <Settings className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={() => handleDuplicateRule(rule)} className="p-1.5 rounded-lg border border-border bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-all cursor-pointer" title="Duplicate">
                                  <Copy className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={() => setDeleteTargetRule({ id: rule.id, name: rule.name })} className="p-1.5 rounded-lg border border-border bg-destructive/10 text-destructive hover:bg-destructive/25 transition-all cursor-pointer" title="Delete">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border shadow-md rounded-2xl flex flex-col min-h-[400px]">
            <CardHeader className="py-3.5 border-b border-border flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <ClipboardList className="h-4 w-4 text-sky-400" /> Audit Logs {selectedLogRule ? ` - ${selectedLogRule.name}` : ''}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 max-h-[480px] overflow-y-auto pr-2">
              {!selectedLogRule ? <div className="text-center text-xs text-muted-foreground italic py-8">Select a rule to view logs.</div>
                : loadingLogs ? <div className="text-center py-8 text-xs">Loading...</div>
                  : logs.length === 0 ? <div className="text-center text-xs text-muted-foreground italic py-8">No logs yet.</div>
                    : logs.map((log) => (
                      <div key={log.id} className="p-3 rounded-xl border border-border bg-secondary/20 space-y-1.5">
                        <div className="flex justify-between">
                          <Badge className={log.status === 'SUCCESS' ? 'bg-green-500/10 text-green-500' : 'bg-destructive/10 text-destructive'}>{log.status}</Badge>
                          <span className="text-[9px] text-muted-foreground font-mono">{new Date(log.createdAt).toLocaleString()}</span>
                        </div>
                        <pre className="text-[9px] font-mono text-foreground whitespace-pre-wrap">{log.message}</pre>
                      </div>
                    ))
              }
            </CardContent>
          </Card>
        </div>
      ) : activeTab === 'editor_whenthen' ? (
        // WHEN-THEN EDITOR (FLATTENED DESIGN & FULLY VISIBLE OVERFLOW)
        <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto p-2">
          <div className="space-y-1.5 bg-card border border-border p-4 rounded-2xl shadow-sm">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Rule Name</label>
            <Input value={ruleName} onChange={(e) => setRuleName(e.target.value)} className="h-10 rounded-lg font-bold text-sm bg-background border-border w-full" placeholder="Enter rule name..." />
          </div>

          {/* Top Bar: Rule Active Schedule */}
          <div className="bg-card border border-border p-4 rounded-2xl shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">Active Rule Schedule</span>
              </div>
              <div className="w-64">
                <SearchableSelect
                  options={[
                    { label: "Always Active (24/7)", value: "ALWAYS" },
                    { label: "Specific Time Period", value: "SPECIFIC_PERIOD" },
                    { label: "Daily Time Period", value: "DAILY_PERIOD" }
                  ]}
                  value={wtActiveMode}
                  onChange={(val) => setWtActiveMode(val as any)}
                  placeholder="Select Active Schedule..."
                />
              </div>
            </div>

            {wtActiveMode === 'SPECIFIC_PERIOD' && (
              <div className="space-y-3 pt-2 border-t border-border/60">
                <div
                  onClick={() => {
                    const newAllDays = !wtSpecificAllDays;
                    setWtSpecificAllDays(newAllDays);
                    if (newAllDays) {
                      if (wtSpecificStartDate && wtSpecificStartDate.includes('T')) {
                        setWtSpecificStartDate(wtSpecificStartDate.split('T')[0]);
                      }
                      if (wtSpecificEndDate && wtSpecificEndDate.includes('T')) {
                        setWtSpecificEndDate(wtSpecificEndDate.split('T')[0]);
                      }
                    } else {
                      if (wtSpecificStartDate && !wtSpecificStartDate.includes('T')) {
                        setWtSpecificStartDate(`${wtSpecificStartDate}T08:00`);
                      }
                      if (wtSpecificEndDate && !wtSpecificEndDate.includes('T')) {
                        setWtSpecificEndDate(`${wtSpecificEndDate}T17:00`);
                      }
                    }
                  }}
                  className="flex items-center gap-2.5 bg-secondary/30 px-3 py-1.5 rounded-lg border border-border/50 w-fit cursor-pointer hover:bg-secondary/50 transition-colors"
                >
                  <button
                    type="button"
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${wtSpecificAllDays ? 'bg-amber-500' : 'bg-secondary'}`}
                  >
                    <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out ${wtSpecificAllDays ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                  <span className="text-[11px] font-bold text-foreground select-none">All Days</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground mb-1 block">
                      {wtSpecificAllDays ? "Start Date" : "Start Date & Time"}
                    </label>
                    <Input
                      type={wtSpecificAllDays ? "date" : "datetime-local"}
                      className="h-8 text-xs bg-background"
                      value={wtSpecificStartDate}
                      onChange={(e) => setWtSpecificStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground mb-1 block">
                      {wtSpecificAllDays ? "End Date" : "End Date & Time"}
                    </label>
                    <Input
                      type={wtSpecificAllDays ? "date" : "datetime-local"}
                      className="h-8 text-xs bg-background"
                      value={wtSpecificEndDate}
                      onChange={(e) => setWtSpecificEndDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {wtActiveMode === 'DAILY_PERIOD' && (
              <div className="space-y-4 pt-2 border-t border-border/60">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground mb-1 block">Daily Start Time</label>
                    <Input
                      type="time"
                      className="h-8 text-xs bg-background"
                      value={wtDailyStartTime}
                      onChange={(e) => setWtDailyStartTime(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground mb-1 block">Daily End Time</label>
                    <Input
                      type="time"
                      className="h-8 text-xs bg-background"
                      value={wtDailyEndTime}
                      onChange={(e) => setWtDailyEndTime(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-muted-foreground mb-1.5 block">Active Days</label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { code: 'mon', label: 'Mon' },
                      { code: 'tue', label: 'Tue' },
                      { code: 'wed', label: 'Wed' },
                      { code: 'thu', label: 'Thu' },
                      { code: 'fri', label: 'Fri' },
                      { code: 'sat', label: 'Sat' },
                      { code: 'sun', label: 'Sun' }
                    ].map((d) => {
                      const isActive = wtDailyActiveDays.includes(d.code);
                      return (
                        <button
                          key={d.code}
                          type="button"
                          onClick={() => {
                            if (isActive) {
                              if (wtDailyActiveDays.length > 1) {
                                setWtDailyActiveDays(wtDailyActiveDays.filter(x => x !== d.code));
                              }
                            } else {
                              setWtDailyActiveDays([...wtDailyActiveDays, d.code]);
                            }
                          }}
                          className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all ${isActive ? 'bg-amber-500 text-black border-amber-500 shadow-sm' : 'bg-background text-muted-foreground border-border hover:border-amber-500/50'}`}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end pt-1">
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground mb-1 block">Repetition Ends</label>
                    <SearchableSelect
                      options={[
                        { label: "Never", value: "NEVER" },
                        { label: "On Date", value: "ON_DATE" }
                      ]}
                      value={wtDailyRepetitionEnds}
                      onChange={(val) => setWtDailyRepetitionEnds(val as any)}
                      placeholder="Select..."
                    />
                  </div>
                  {wtDailyRepetitionEnds === 'ON_DATE' && (
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground mb-1 block">End Date</label>
                      <Input
                        type="date"
                        className="h-8 text-xs bg-background"
                        value={wtDailyRepetitionEndDate}
                        onChange={(e) => setWtDailyRepetitionEndDate(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* WHEN Panel */}
            <div className="relative space-y-6">
              {wtGroups.map((group, groupIdx) => (
                <div key={group.id} className="bg-card border border-border p-5 rounded-2xl shadow-sm space-y-4 relative">
                  <div className="flex items-center justify-between border-b border-border/60 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-1.5 bg-amber-500 rounded-full"></div>
                      <h3 className="text-base font-black text-foreground">{groupIdx === 0 ? "When..." : "Or when..."}</h3>
                    </div>
                    {groupIdx > 0 && (
                      <button
                        type="button"
                        onClick={() => setWtGroups(g => g.filter(x => x.id !== group.id))}
                        className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 font-semibold"
                      >
                        <X className="h-3.5 w-3.5" /> Remove Group
                      </button>
                    )}
                  </div>

                  <div className="space-y-4">
                    {group.conditions.map((cond: any, condIdx: number) => {
                      const selectedAsset = assets.find(a => a.id === cond.assetId);
                      const attrOptions = [
                              ...getAssetAttributes(selectedAsset).map(a => ({ label: `Telemetry: ${a.name}`, value: a.name })),
                              { label: 'Geofence Event: Enter', value: 'GEOFENCE_ENTER' },
                              { label: 'Geofence Event: Exit', value: 'GEOFENCE_EXIT' },
                              { label: 'Geofence Event: Any', value: 'GEOFENCE_ANY' }
                            ];
                            const isGeofence = cond.attribute?.startsWith('GEOFENCE_');
                      const selectedAttrInfo = getAssetAttributes(selectedAsset).find(a => a.name === cond.attribute);

                      return (
                        <div key={cond.id} className="border-l-2 border-border pl-4 ml-1 relative group">
                          {condIdx > 0 && (
                            <div className="absolute -top-3.5 left-[-11px] bg-background text-amber-500 border border-border text-[9px] font-black px-1.5 py-0.5 rounded-full z-10">
                              AND
                            </div>
                          )}
                          {group.conditions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const ng = [...wtGroups];
                                ng[groupIdx].conditions = ng[groupIdx].conditions.filter((x: any) => x.id !== cond.id);
                                setWtGroups(ng);
                              }}
                              className="absolute top-0 right-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pr-6">
                            <div>
                              <label className="text-[10px] font-bold text-muted-foreground mb-1 block">Asset</label>
                              <SearchableSelect
                                options={assetOptions}
                                value={cond.assetId}
                                onChange={(val) => {
                                  const ng = [...wtGroups];
                                  ng[groupIdx].conditions[condIdx].assetId = val;
                                  ng[groupIdx].conditions[condIdx].attribute = '';
                                  setWtGroups(ng);
                                }}
                                placeholder="Select Asset..."
                                alwaysSearchable={true}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-muted-foreground mb-1 block">Attribute</label>
                              <SearchableSelect
                                options={attrOptions}
                                value={cond.attribute}
                                onChange={(val) => {
                                  const ng = [...wtGroups];
                                  ng[groupIdx].conditions[condIdx].attribute = val;
                                  setWtGroups(ng);
                                }}
                                placeholder="Select Attribute..."
                              />
                            </div>
                            {isGeofence ? (
                              <div className="sm:col-span-2">
                                <label className="text-[10px] font-bold text-muted-foreground mb-1 block">Select Geofence</label>
                                <SearchableSelect
                                  options={[{ label: 'Any Geofence', value: 'ANY' }, ...geofenceOptions]}
                                  value={cond.value || 'ANY'}
                                  onChange={(val) => {
                                    const ng = [...wtGroups];
                                    ng[groupIdx].conditions[condIdx].value = val;
                                    ng[groupIdx].conditions[condIdx].operator = '==';
                                    setWtGroups(ng);
                                  }}
                                  placeholder="Select Geofence..."
                                />
                              </div>
                            ) : (
                              <>
                                <div>
                                  <label className="text-[10px] font-bold text-muted-foreground mb-1 block">Operator</label>
                                  <SearchableSelect
                                    options={[
                                      { label: "Greater than", value: ">" },
                                      { label: "Less than", value: "<" },
                                      { label: "Equal to", value: "==" },
                                      { label: "Not equal to", value: "!=" }
                                    ]}
                                    value={cond.operator}
                                    onChange={(val) => {
                                      const ng = [...wtGroups];
                                      ng[groupIdx].conditions[condIdx].operator = val;
                                      setWtGroups(ng);
                                    }}
                                    placeholder="Select Operator..."
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-muted-foreground mb-1 block">Value</label>
                                  <Input
                                    type={selectedAttrInfo?.type === 'number' ? 'number' : 'text'}
                                    className="h-8 text-xs bg-background"
                                    placeholder="Enter value..."
                                    value={cond.value}
                                    onChange={(e) => {
                                      const ng = [...wtGroups];
                                      ng[groupIdx].conditions[condIdx].value = e.target.value;
                                      setWtGroups(ng);
                                    }}
                                  />
                                </div>
                              </>
                            )}
                            <div className="sm:col-span-2 pt-1 border-t border-border/40 mt-1">
                              <label className="text-[10px] font-bold text-muted-foreground flex items-center gap-1.5 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={cond.enableDuration ?? (Number(cond.durationMinutes) > 0)}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    const ng = [...wtGroups];
                                    ng[groupIdx].conditions[condIdx].enableDuration = checked;
                                    if (!checked) {
                                      ng[groupIdx].conditions[condIdx].durationMinutes = 0;
                                    }
                                    setWtGroups(ng);
                                  }}
                                  className="rounded border-gray-300 text-amber-500 focus:ring-amber-500 h-3.5 w-3.5 cursor-pointer"
                                />
                                <span>Set Duration Filter (min)</span>
                              </label>
                              {(cond.enableDuration ?? (Number(cond.durationMinutes) > 0)) && (
                                <div className="mt-1.5">
                                  <Input
                                    type="number"
                                    min="0"
                                    className="h-8 text-xs bg-background"
                                    placeholder="Duration in minutes (e.g. 5)..."
                                    value={cond.durationMinutes || ''}
                                    onChange={(e) => {
                                      const ng = [...wtGroups];
                                      ng[groupIdx].conditions[condIdx].durationMinutes = Math.max(0, parseInt(e.target.value) || 0);
                                      setWtGroups(ng);
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <Button
                    type="button"
                    onClick={() => {
                      const ng = [...wtGroups];
                      ng[groupIdx].conditions.push({ id: Date.now().toString(), assetId: '', attribute: '', operator: '>', value: '', durationMinutes: 0 });
                      setWtGroups(ng);
                    }}
                    variant="ghost"
                    className="mt-2 text-xs font-bold text-amber-500 hover:text-amber-600 hover:bg-amber-500/10"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> ADD ATTRIBUTE
                  </Button>
                </div>
              ))}

              <div className="pt-1">
                <Button
                  type="button"
                  onClick={() => {
                    setWtGroups([
                      ...wtGroups,
                      {
                        id: Date.now().toString(),
                        conditions: [{ id: Date.now().toString(), assetId: '', attribute: '', operator: '>', value: '', durationMinutes: 0 }]
                      }
                    ]);
                  }}
                  variant="outline"
                  className="w-full border-dashed border-border text-xs font-bold text-muted-foreground hover:text-amber-500 hover:border-amber-500/50 py-3"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> ADD CONDITION (OR WHEN)
                </Button>
              </div>


            </div>

            {/* THEN Panel */}
            <div className="relative">
              <div className="flex items-center gap-2 mb-4 justify-between bg-card border border-border p-3 rounded-xl">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-1.5 bg-blue-500 rounded-full"></div>
                  <h3 className="text-lg font-black text-foreground">Then...</h3>
                </div>
                <div className="w-44">
                  <SearchableSelect
                    options={[
                      { label: "ALWAYS", value: "ALWAYS" },
                      { label: "ONCE", value: "ONCE" },
                      { label: "ONCE PER MINUTE", value: "ONCE_PER_MINUTE" },
                      { label: "ONCE PER HOUR", value: "ONCE_PER_HOUR" },
                      { label: "ONCE PER DAY", value: "ONCE_PER_DAY" },
                      { label: "ONCE PER WEEK", value: "ONCE_PER_WEEK" }
                    ]}
                    value={wtThenFrequency}
                    onChange={(val) => setWtThenFrequency(val)}
                    placeholder="Frequency..."
                  />
                </div>
              </div>
              <div className="space-y-4">
                {wtActions.map((act, i) => {
                  const targetAsset = assets.find(a => a.id === act.assetId);
                  const targetAttrOptions = getAssetAttributes(targetAsset).map(a => ({ label: a.name, value: a.name }));
                  const selectedAttrInfo = getAssetAttributes(targetAsset).find(a => a.name === act.attribute);

                  return (
                    <div key={act.id} className="border-l-2 border-border pl-4 ml-2 relative group">
                      {i > 0 && <div className="absolute -top-4 left-[-11px] bg-background text-blue-500 border border-border text-[9px] font-black px-1.5 py-0.5 rounded-full z-10">AND</div>}
                      <button onClick={() => setWtActions(a => a.filter(x => x.id !== act.id))} className="absolute top-0 right-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"><X className="h-4 w-4" /></button>

                      <div className="mb-4 pr-6">
                        <label className="text-[10px] font-bold text-muted-foreground mb-1.5 block">Action Type</label>
                        <SearchableSelect
                          options={[
                            { label: "Trigger Asset Attribute", value: "trigger_asset" },
                            { label: "Dashboard Alarm", value: "alarm" },
                            { label: "SMTP Email", value: "email" },
                            { label: "Telegram Bot", value: "telegram" }
                          ]}
                          value={act.actionType}
                          onChange={(val) => { const n = [...wtActions]; n[i].actionType = val; setWtActions(n); }}
                          placeholder="Select Action Type..."
                        />
                      </div>

                      {act.actionType === 'trigger_asset' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pr-6">
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground mb-1.5 block">Target Asset</label>
                            <SearchableSelect
                              options={assetOptions}
                              value={act.assetId}
                              onChange={(val) => { const n = [...wtActions]; n[i].assetId = val; n[i].attribute = ''; setWtActions(n); }}
                              placeholder="Select Target Asset..."
                              alwaysSearchable={true}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground mb-1.5 block">Target Attribute</label>
                            <SearchableSelect
                              options={targetAttrOptions}
                              value={act.attribute}
                              onChange={(val) => { const n = [...wtActions]; n[i].attribute = val; setWtActions(n); }}
                              placeholder="Select Attribute..."
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="text-[10px] font-bold text-muted-foreground mb-1.5 block">Command Value</label>
                            {selectedAttrInfo?.type === 'boolean' ? (
                              <SearchableSelect
                                options={[
                                  { label: "True / ON", value: "true" },
                                  { label: "False / OFF", value: "false" }
                                ]}
                                value={act.command}
                                onChange={(val) => { const n = [...wtActions]; n[i].command = val; setWtActions(n); }}
                                placeholder="Select Boolean..."
                              />
                            ) : (
                              <Input
                                type={selectedAttrInfo?.type === 'number' ? 'number' : 'text'}
                                className="h-8 text-xs"
                                placeholder={`e.g. ${selectedAttrInfo?.type === 'number' ? '50' : 'ON'}`}
                                value={act.command}
                                onChange={(e) => { const n = [...wtActions]; n[i].command = e.target.value; setWtActions(n); }}
                              />
                            )}
                          </div>
                        </div>
                      )}

                      {act.actionType === 'alarm' && (
                        <div className="pr-6">
                          <label className="text-[10px] font-bold text-muted-foreground mb-1.5 block">Alarm Message</label>
                          <Input className="h-8 text-xs" placeholder="e.g. Critical alert: Asset {assetName}" value={act.message || ''} onChange={(e) => { const n = [...wtActions]; n[i].message = e.target.value; setWtActions(n); }} />
                        </div>
                      )}

                      {act.actionType === 'email' && (
                        <div className="space-y-3 pr-6">
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground mb-1.5 block">Recipient Email (toEmail)</label>
                            <Input className="h-8 text-xs" placeholder="e.g. admin@example.com" value={act.toEmail || ''} onChange={(e) => { const n = [...wtActions]; n[i].toEmail = e.target.value; setWtActions(n); }} />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground mb-1.5 block">Subject Template</label>
                            <Input className="h-8 text-xs" placeholder="e.g. Temperature Alert: {assetName}" value={act.subjectTemplate || ''} onChange={(e) => { const n = [...wtActions]; n[i].subjectTemplate = e.target.value; setWtActions(n); }} />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground mb-1.5 block">Body Template</label>
                            <Input className="h-8 text-xs" placeholder="e.g. Asset {assetName} attribute {attributeName} = {value}" value={act.bodyTemplate || ''} onChange={(e) => { const n = [...wtActions]; n[i].bodyTemplate = e.target.value; setWtActions(n); }} />
                          </div>
                        </div>
                      )}

                      {act.actionType === 'telegram' && (
                        <div className="space-y-3 pr-6">
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground mb-1.5 block">Telegram Chat ID</label>
                            <Input className="h-8 text-xs" placeholder="e.g. 123456789" value={act.chatId || ''} onChange={(e) => { const n = [...wtActions]; n[i].chatId = e.target.value; setWtActions(n); }} />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground mb-1.5 block">Message Template</label>
                            <Input className="h-8 text-xs" placeholder="e.g. GeoMesh Alert: {assetName} attribute {attributeName} = {value}" value={act.messageTemplate || ''} onChange={(e) => { const n = [...wtActions]; n[i].messageTemplate = e.target.value; setWtActions(n); }} />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <Button onClick={() => setWtActions([...wtActions, { id: Date.now().toString(), actionType: 'trigger_asset', assetId: '', attribute: '', command: '' }])} variant="ghost" className="mt-6 text-xs font-bold text-blue-500 hover:text-blue-600 hover:bg-blue-500/10 ml-2">
                <Plus className="h-3.5 w-3.5 mr-1" /> ADD ACTION
              </Button>
            </div>
          </div>
        </div>
      ) : (
        // FLOW EDITOR
        <div className="flex flex-col lg:flex-row gap-4 h-[700px] relative">
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-card border border-border p-2 px-4 shadow-lg rounded-xl flex flex-col md:flex-row items-center gap-3">
            <span className="text-xs font-bold text-muted-foreground whitespace-nowrap hidden md:inline">Flow Name:</span>
            <Input value={ruleName} onChange={(e) => setRuleName(e.target.value)} className="h-8 rounded-lg font-bold text-sm bg-secondary/30 min-w-[200px] md:min-w-[250px]" placeholder="Flow Name" />
          </div>

          {/* SIDEBAR NODE PALETTE */}
          <div className="w-full lg:w-56 border border-border shadow-md rounded-2xl flex lg:flex-col lg:shrink-0 bg-card overflow-x-auto lg:overflow-y-auto p-3 gap-4 lg:gap-0 lg:space-y-4">
            <div className="shrink-0 min-w-[120px]">
              <div className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-2">Triggers / Inputs</div>
              <div className="flex lg:flex-col gap-1.5">
                <div draggable onDragStart={(e) => onDragStart(e, 'input_attribute')} className="flex items-center w-full text-[10px] h-7 px-2 border border-border cursor-pointer rounded-md font-medium bg-blue-500/10 text-blue-500 hover:bg-blue-500/20">Attribute Value</div>
                <div draggable onDragStart={(e) => onDragStart(e, 'trigger_geofence')} className="flex items-center w-full text-[10px] h-7 px-2 border border-border cursor-pointer rounded-md font-medium bg-blue-500/10 text-blue-500 hover:bg-blue-500/20">Geofence Event</div>
              </div>
            </div>

            <div className="shrink-0 min-w-[140px]">
              <div className="text-[10px] font-bold text-green-500 uppercase tracking-wider mb-1.5">Math Processors</div>
              <div className="grid grid-cols-2 gap-1.5">
                <div draggable onDragStart={(e) => onDragStart(e, 'math_add')} className="flex items-center justify-center text-[10px] h-6 px-1 border border-border cursor-pointer rounded font-bold bg-green-500/10 text-green-500 hover:bg-green-500/20">+ Add</div>
                <div draggable onDragStart={(e) => onDragStart(e, 'math_sub')} className="flex items-center justify-center text-[10px] h-6 px-1 border border-border cursor-pointer rounded font-bold bg-green-500/10 text-green-500 hover:bg-green-500/20">- Sub</div>
                <div draggable onDragStart={(e) => onDragStart(e, 'math_mul')} className="flex items-center justify-center text-[10px] h-6 px-1 border border-border cursor-pointer rounded font-bold bg-green-500/10 text-green-500 hover:bg-green-500/20">× Mul</div>
                <div draggable onDragStart={(e) => onDragStart(e, 'math_div')} className="flex items-center justify-center text-[10px] h-6 px-1 border border-border cursor-pointer rounded font-bold bg-green-500/10 text-green-500 hover:bg-green-500/20">÷ Div</div>
                <div draggable onDragStart={(e) => onDragStart(e, 'math_avg')} className="flex items-center justify-center text-[10px] h-6 px-1 border border-border cursor-pointer rounded font-bold bg-green-500/10 text-green-500 hover:bg-green-500/20">AVG</div>
                <div draggable onDragStart={(e) => onDragStart(e, 'math_pct')} className="flex items-center justify-center text-[10px] h-6 px-1 border border-border cursor-pointer rounded font-bold bg-green-500/10 text-green-500 hover:bg-green-500/20">% Pct</div>
              </div>
            </div>

            <div className="shrink-0 min-w-[140px]">
              <div className="text-[10px] font-bold text-green-500 uppercase tracking-wider mb-1.5">Logic Processors</div>
              <div className="grid grid-cols-2 gap-1.5">
                <div draggable onDragStart={(e) => onDragStart(e, 'logic_gt')} className="flex items-center justify-center text-[10px] h-6 px-1 border border-border cursor-pointer rounded font-bold bg-green-500/10 text-green-500 hover:bg-green-500/20">&gt; GT</div>
                <div draggable onDragStart={(e) => onDragStart(e, 'logic_lt')} className="flex items-center justify-center text-[10px] h-6 px-1 border border-border cursor-pointer rounded font-bold bg-green-500/10 text-green-500 hover:bg-green-500/20">&lt; LT</div>
                <div draggable onDragStart={(e) => onDragStart(e, 'logic_eq')} className="flex items-center justify-center text-[10px] h-6 px-1 border border-border cursor-pointer rounded font-bold bg-green-500/10 text-green-500 hover:bg-green-500/20">= EQ</div>
                <div draggable onDragStart={(e) => onDragStart(e, 'logic_neq')} className="flex items-center justify-center text-[10px] h-6 px-1 border border-border cursor-pointer rounded font-bold bg-green-500/10 text-green-500 hover:bg-green-500/20">!= NEQ</div>
                <div draggable onDragStart={(e) => onDragStart(e, 'logic_gte')} className="flex items-center justify-center text-[10px] h-6 px-1 border border-border cursor-pointer rounded font-bold bg-green-500/10 text-green-500 hover:bg-green-500/20">&gt;= GTE</div>
                <div draggable onDragStart={(e) => onDragStart(e, 'logic_lte')} className="flex items-center justify-center text-[10px] h-6 px-1 border border-border cursor-pointer rounded font-bold bg-green-500/10 text-green-500 hover:bg-green-500/20">&lt;= LTE</div>
                <div draggable onDragStart={(e) => onDragStart(e, 'logic_and')} className="flex items-center justify-center text-[10px] h-6 px-1 border border-border cursor-pointer rounded font-bold bg-green-500/10 text-green-500 hover:bg-green-500/20">AND</div>
                <div draggable onDragStart={(e) => onDragStart(e, 'logic_or')} className="flex items-center justify-center text-[10px] h-6 px-1 border border-border cursor-pointer rounded font-bold bg-green-500/10 text-green-500 hover:bg-green-500/20">OR</div>
              </div>
            </div>

            <div className="shrink-0 min-w-[140px]">
              <div className="text-[10px] font-bold text-purple-500 uppercase tracking-wider mb-2">Outputs / Actions</div>
              <div className="flex lg:flex-col gap-1.5">
                <div draggable onDragStart={(e) => onDragStart(e, 'action_attribute')} className="flex items-center w-full text-[10px] h-7 px-2 border border-border cursor-pointer rounded-md font-medium bg-purple-500/10 text-purple-500 hover:bg-purple-500/20">Set Attribute Value</div>
                <div draggable onDragStart={(e) => onDragStart(e, 'action_alarm')} className="flex items-center w-full text-[10px] h-7 px-2 border border-border cursor-pointer rounded-md font-medium bg-purple-500/10 text-purple-500 hover:bg-purple-500/20">System Alarm</div>
                <div draggable onDragStart={(e) => onDragStart(e, 'action_email')} className="flex items-center w-full text-[10px] h-7 px-2 border border-border cursor-pointer rounded-md font-medium bg-purple-500/10 text-purple-500 hover:bg-purple-500/20">Send Email</div>
                <div draggable onDragStart={(e) => onDragStart(e, 'action_telegram')} className="flex items-center w-full text-[10px] h-7 px-2 border border-border cursor-pointer rounded-md font-medium bg-purple-500/10 text-purple-500 hover:bg-purple-500/20">Telegram Bot</div>
              </div>
            </div>
          </div>

          <div className="flex-1 border border-border rounded-2xl overflow-hidden shadow-2xl relative bg-background">
            <ReactFlow
              nodes={nodes.map(n => ({
                ...n,
                data: {
                  ...n.data,
                  assets,
                  onOpenPicker: (id: string, data: any) => handleOpenAttributePicker(id, data)
                }
              }))}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={(_, node) => { if (node.data?.type !== 'input_attribute' && node.data?.type !== 'trigger_telemetry') setSelectedNode(node); }}
              onInit={setReactFlowInstance}
              onDrop={onDrop}
              onDragOver={onDragOver}
              fitView
              className="w-full h-full"
            >
              <Background color="#64748b" gap={16} />
              <Controls />
            </ReactFlow>
          </div>

          {/* NODE CONFIG POPUP MODAL */}
          {selectedNode && selectedNode.data?.type !== 'input_attribute' && selectedNode.data?.type !== 'trigger_telemetry' && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setSelectedNode(null)}>
              <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                <Card className="w-full border border-border shadow-2xl rounded-2xl flex flex-col bg-card overflow-hidden animate-in zoom-in-95 duration-200">
                  <CardHeader className="py-3.5 px-5 border-b border-border flex flex-row items-center justify-between bg-card z-10">
                    <CardTitle className="text-sm font-bold text-foreground">Node Configuration</CardTitle>
                    <div className="flex items-center gap-1.5">
                      <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10 font-bold rounded-lg transition-colors" onClick={deleteSelectedNode}>
                        Delete
                      </Button>
                      <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/80" onClick={() => setSelectedNode(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-5 pb-7 space-y-4 text-xs bg-card max-h-[80vh] overflow-y-auto">
                <div className="space-y-3">
                  <div className="p-2.5 rounded-xl bg-secondary/35 border border-border font-bold text-[10px] uppercase text-center text-foreground">
                    {selectedNode.data.label || selectedNode.id}
                  </div>

                  {/* GEOFENCE TRIGGER CONFIGURATION */}
                  {selectedNode.data.type === 'trigger_geofence' && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-muted-foreground font-semibold">Select Asset</label>
                        <SearchableSelect
                          options={[{ label: "Any Assets", value: "ANY" }, ...assetOptions]}
                          value={selectedNode.data.assetId || 'ANY'}
                          onChange={(val) => {
                            updateNodeData(selectedNode.id, 'assetId', val);
                            const asset = assets.find(a => a.id === val);
                            updateNodeData(selectedNode.id, 'assetName', asset?.name || (val === 'ANY' ? 'Any Asset' : 'Select Asset'));
                          }}
                          alwaysSearchable={true}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-muted-foreground font-semibold">Event Type</label>
                        <SearchableSelect
                          options={[
                            { label: "Any Event (Enter / Exit)", value: "ANY" },
                            { label: "Asset Enter Geofence", value: "GEOFENCE_ENTER" },
                            { label: "Asset Exit Geofence", value: "GEOFENCE_EXIT" }
                          ]}
                          value={selectedNode.data.eventType}
                          onChange={(val) => updateNodeData(selectedNode.id, 'eventType', val)}
                          placeholder="Select Event Type..."
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-muted-foreground font-semibold">Select Geofence Zone</label>
                        <SearchableSelect
                          options={[{ label: "Any Geofence", value: "ANY" }, ...geofenceOptions]}
                          value={selectedNode.data.geofenceId}
                          onChange={(val) => updateNodeData(selectedNode.id, 'geofenceId', val)}
                          alwaysSearchable={true}
                        />
                      </div>
                    </div>
                  )}



                  {/* ACTION ALARM CONFIGURATION */}
                  {selectedNode.data.type === 'action_alarm' && (
                    <div className="space-y-1.5">
                      <label className="text-muted-foreground font-semibold">Alarm Message</label>
                      <textarea
                        value={selectedNode.data.messageTemplate}
                        onChange={(e) => updateNodeData(selectedNode.id, 'messageTemplate', e.target.value)}
                        rows={4}
                        className="w-full bg-secondary/35 border border-border px-2.5 py-1.5 rounded-lg text-foreground text-xs font-semibold"
                      />
                    </div>
                  )}

                  {/* SET ATTRIBUTE ACTION CONFIGURATION */}
                  {selectedNode.data.type === 'action_attribute' && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-muted-foreground font-semibold">Target Asset</label>
                        <SearchableSelect
                          options={assetOptions}
                          value={selectedNode.data.targetAssetId}
                          onChange={(val) => {
                            updateNodeData(selectedNode.id, 'targetAssetId', val);
                            updateNodeData(selectedNode.id, 'targetAttribute', '');
                          }}
                          placeholder="Select Target Asset..."
                          alwaysSearchable={true}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-muted-foreground font-semibold">Target Attribute</label>
                        <SearchableSelect
                          options={(() => {
                            const targetAsset = assets.find(a => a.id === selectedNode.data.targetAssetId);
                            return getAssetAttributes(targetAsset).map(a => ({ label: a.name, value: a.name }));
                          })()}
                          value={selectedNode.data.targetAttribute}
                          onChange={(val) => updateNodeData(selectedNode.id, 'targetAttribute', val)}
                          placeholder="Select Target Attribute..."
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-muted-foreground font-semibold">Command / Set Value</label>
                        <Input
                          type="text"
                          value={selectedNode.data.commandValue}
                          onChange={(e) => updateNodeData(selectedNode.id, 'commandValue', e.target.value)}
                          className="h-8 rounded-lg text-xs"
                          placeholder="e.g. ON, 100, true"
                        />
                      </div>
                    </div>
                  )}

                  {/* LOGIC PROCESSORS CONFIGURATION */}
                  {(selectedNode.data.type.startsWith('logic_')) && (
                    <div className="space-y-3">
                      {!['logic_and', 'logic_or'].includes(selectedNode.data.type) && (
                        <div className="space-y-1">
                          <label className="text-muted-foreground font-semibold">Threshold Value</label>
                          <Input type="number" value={selectedNode.data.thresholdValue || 0} onChange={(e) => updateNodeData(selectedNode.id, 'thresholdValue', e.target.value)} className="h-8 rounded-lg text-xs" />
                        </div>
                      )}
                    </div>
                  )}

                  {/* MATH PROCESSORS CONFIGURATION */}
                  {(selectedNode.data.type.startsWith('math_') || selectedNode.data.type === 'process_math') && (
                    <div className="space-y-3">
                      {['math_add', 'math_sub', 'math_mul', 'math_div'].includes(selectedNode.data.type) && (
                        <div className="space-y-1">
                          <label className="text-muted-foreground font-semibold">Value B / Operand</label>
                          <Input type="number" value={selectedNode.data.valueB || 0} onChange={(e) => updateNodeData(selectedNode.id, 'valueB', e.target.value)} className="h-8 rounded-lg text-xs" />
                        </div>
                      )}
                    </div>
                  )}

                  {/* ACTION EMAIL CONFIGURATION */}
                  {selectedNode.data.type === 'action_email' && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-muted-foreground font-semibold">Recipient Email (To)</label>
                        <Input value={selectedNode.data.toEmail || ''} onChange={(e) => updateNodeData(selectedNode.id, 'toEmail', e.target.value)} placeholder="e.g. manager@company.com" className="h-8 rounded-lg text-xs" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-muted-foreground font-semibold">Subject Template</label>
                        <Input value={selectedNode.data.subjectTemplate || ''} onChange={(e) => updateNodeData(selectedNode.id, 'subjectTemplate', e.target.value)} placeholder="e.g. Alert: {assetName}" className="h-8 rounded-lg text-xs" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-muted-foreground font-semibold">Message Body</label>
                        <textarea
                          value={selectedNode.data.bodyTemplate || ''}
                          onChange={(e) => updateNodeData(selectedNode.id, 'bodyTemplate', e.target.value)}
                          rows={6}
                          className="w-full bg-secondary/35 border border-border px-2.5 py-1.5 rounded-lg text-foreground text-xs font-semibold"
                          placeholder="e.g. Alert: Asset {assetName} triggered event {attributeName} with value {value} at {time}."
                        />
                        <div className="mt-1.5 p-2 bg-blue-500/10 border border-blue-500/20 rounded-md text-[10px] text-blue-500/90 leading-tight space-y-1">
                          <div><strong className="font-bold">Available variables:</strong> <code>{'{assetName}'}</code>, <code>{'{geofenceName}'}</code>, <code>{'{attributeName}'}</code>, <code>{'{value}'}</code>, <code>{'{time}'}</code></div>
                          <div className="opacity-90 italic">
                            <strong>Example:</strong> "Alert: Asset {'{assetName}'} triggered event {'{attributeName}'} with value {'{value}'} at {'{time}'}."
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ACTION TELEGRAM CONFIGURATION */}
                  {selectedNode.data.type === 'action_telegram' && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-muted-foreground font-semibold">Chat ID</label>
                        <Input value={selectedNode.data.chatId || ''} onChange={(e) => updateNodeData(selectedNode.id, 'chatId', e.target.value)} placeholder="e.g. -100123456789" className="h-8 rounded-lg text-xs" />
                        <div className="mt-1 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-md text-[10px] text-yellow-600 dark:text-yellow-500 leading-tight">
                          To get Chat ID, send a message to bot <a href="https://t.me/userinfobot?start=start" target="_blank" rel="noopener noreferrer" className="text-yellow-600 font-bold">@userinfobot</a> on Telegram.<br />
                          Click the following link <a href="https://t.me/GeoMeshBot?start=start" target="_blank" rel="noopener noreferrer" className="text-yellow-600 font-bold">@GeoMeshBot</a> to allow GeoMesh bot to send notifications.
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-muted-foreground font-semibold">Message Template</label>
                        <textarea
                          value={selectedNode.data.messageTemplate || ''}
                          onChange={(e) => updateNodeData(selectedNode.id, 'messageTemplate', e.target.value)}
                          rows={6}
                          className="w-full bg-secondary/35 border border-border px-2.5 py-1.5 rounded-lg text-foreground text-xs font-semibold"
                          placeholder={'e.g. 🚨 *GeoMesh Alert*\\nAsset: *{assetName}*\\nEvent: *{attributeName}* triggered with value {value}.'}
                        />
                        <div className="mt-1.5 p-2 bg-blue-500/10 border border-blue-500/20 rounded-md text-[10px] text-blue-500/90 leading-tight space-y-1">
                          <div><strong className="font-bold">Available variables:</strong> <code>{'{assetName}'}</code>, <code>{'{geofenceName}'}</code>, <code>{'{attributeName}'}</code>, <code>{'{value}'}</code>, <code>{'{time}'}</code></div>
                          <div className="opacity-90 italic">
                            <strong>Formatting:</strong> You can use Telegram Markdown formatting, e.g. *bold* or _italic_.
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Rule Confirm Modal */}
      <ConfirmModal
        isOpen={!!deleteTargetRule}
        title="Delete Rule"
        message={`Are you sure you want to delete rule "${deleteTargetRule?.name}"?`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={() => deleteTargetRule && handleDeleteRule(deleteTargetRule.id)}
        onCancel={() => setDeleteTargetRule(null)}
      />

      {/* Generic Alert Modal */}
      <ConfirmModal
        isOpen={!!alertModal}
        title={alertModal?.title || 'Notice'}
        message={alertModal?.message || ''}
        confirmText="OK"
        cancelText="Close"
        variant={alertModal?.variant || 'info'}
        onConfirm={() => setAlertModal(null)}
        onCancel={() => setAlertModal(null)}
      />

      {/* SELECT ATTRIBUTES MODAL (MATCHING IMAGE WITH TREE HIERARCHY, UNITS & CHANGE CHECK) */}
      {attrPickerNode && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setAttrPickerNode(null)}>
          <div className="w-full max-w-2xl bg-card border border-border shadow-2xl rounded-lg overflow-hidden flex flex-col h-[530px] animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            
            {/* HEADER */}
            <div className="px-5 py-3 border-b border-border bg-card flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">Select attributes</h3>
              <button onClick={() => setAttrPickerNode(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* TWO COLUMN CONTENT */}
            <div className="flex-1 flex overflow-hidden">
              
              {/* LEFT COLUMN: ASSETS HIERARCHICAL TREE SELECTION */}
              <div className="w-5/12 border-r border-border bg-secondary/10 flex flex-col">
                {/* Yellow Amber Header */}
                <div className="bg-amber-500 text-white px-3.5 py-2.5 flex items-center justify-between font-bold text-xs shadow-sm">
                  <span>Assets</span>
                  <div className="flex items-center gap-2.5">
                    <X className="w-3.5 h-3.5 cursor-pointer hover:opacity-80" onClick={() => setAssetSearchFilter('')} />
                    <Filter className="w-3.5 h-3.5 cursor-pointer hover:opacity-80" />
                  </div>
                </div>

                {/* Filter Search Input */}
                <div className="p-2.5 border-b border-border bg-card">
                  <div className="relative flex items-center">
                    <Input
                      type="text"
                      placeholder="Filter..."
                      value={assetSearchFilter}
                      onChange={(e) => setAssetSearchFilter(e.target.value)}
                      className="h-8 text-xs bg-secondary/35 pr-8 rounded-md border-border"
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

                    const flattened: { asset: any; depth: number; hasChildren: boolean }[] = [];
                    const traverse = (list: any[], depth: number) => {
                      list.forEach(node => {
                        const matches = !assetSearchFilter || node.name.toLowerCase().includes(assetSearchFilter.toLowerCase()) || node.children.some((c: any) => c.name.toLowerCase().includes(assetSearchFilter.toLowerCase()));
                        if (matches) {
                          flattened.push({ asset: node, depth, hasChildren: node.children.length > 0 });
                          traverse(node.children, depth + 1);
                        }
                      });
                    };
                    traverse(roots, 0);

                    return flattened.map(({ asset, depth, hasChildren }) => {
                      const isSelected = pickerSelectedAssetId === asset.id;
                      const IconComp = getAssetIcon(asset.type);
                      const indentPadding = Math.min(depth * 14 + 10, 48);

                      return (
                        <div
                          key={asset.id}
                          style={{ paddingLeft: `${indentPadding}px` }}
                          onClick={() => {
                            setPickerSelectedAssetId(asset.id);
                            const attrs = getAssetAttributes(asset);
                            if (!attrs.find(x => x.name === pickerSelectedAttribute)) {
                              setPickerSelectedAttribute(attrs[0]?.name || '');
                            }
                          }}
                          className={`flex items-center gap-2 pr-3 py-2 rounded-md cursor-pointer transition-all border-l-4 ${
                            isSelected
                              ? 'bg-secondary border-amber-500 font-bold text-foreground shadow-sm'
                              : 'border-transparent hover:bg-secondary/60 text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {hasChildren ? (
                            <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
                          ) : depth > 0 ? (
                            <span className="text-muted-foreground/60 text-[10px] shrink-0">└</span>
                          ) : null}
                          <IconComp className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-amber-500' : 'text-muted-foreground'}`} />
                          <span className="truncate">{asset.name}</span>
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
                    let attributes: { name: string; type: string; unit?: string }[] = getAssetAttributes(selectedAsset);
                    
                    // Standard telemetry attributes list matching user image
                    const standardAttrs = [
                      { name: 'temperature', unit: '°C' },
                      { name: 'humidity', unit: '%' },
                      { name: 'voltage', unit: 'V' },
                      { name: 'accel_x', unit: 'm/s²' },
                      { name: 'accel_y', unit: 'm/s²' },
                      { name: 'accel_z', unit: 'm/s²' },
                      { name: 'pitch', unit: '°' },
                      { name: 'roll', unit: '°' },
                      { name: 'yaw', unit: '°' }
                    ];

                    standardAttrs.forEach(sa => {
                      if (!attributes.find(a => a.name.toLowerCase() === sa.name.toLowerCase())) {
                        attributes.push({ name: sa.name, type: 'number', unit: sa.unit });
                      }
                    });

                    return attributes.map(attr => {
                      const isSelected = pickerSelectedAttribute === attr.name;
                      const unit = getAttributeUnit(attr.name, attr.unit);
                      const labelWithUnit = unit ? `${attr.name} (${unit})` : attr.name;

                      return (
                        <div
                          key={attr.name}
                          onClick={() => setPickerSelectedAttribute(attr.name)}
                          className={`px-3 py-2.5 rounded-md cursor-pointer transition-all flex items-center justify-between ${
                            isSelected
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/30'
                              : 'hover:bg-secondary/60 text-foreground'
                          }`}
                        >
                          <span>{labelWithUnit}</span>
                          {isSelected && <span className="text-amber-500 text-xs font-bold">✓</span>}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

            </div>

            {/* FOOTER WITH DISABLED UNCHANGED LOGIC */}
            <div className="px-5 py-3 border-t border-border bg-card flex items-center justify-end gap-5">
              <button
                type="button"
                onClick={() => setAttrPickerNode(null)}
                className="text-xs font-bold text-amber-500 hover:text-amber-600 uppercase tracking-wider transition-colors cursor-pointer"
              >
                CANCEL
              </button>
              <button
                type="button"
                disabled={
                  !pickerSelectedAssetId ||
                  !pickerSelectedAttribute ||
                  (pickerSelectedAssetId === initialAssetId && pickerSelectedAttribute === initialAttribute)
                }
                onClick={() => {
                  if (!attrPickerNode) return;
                  const asset = assets.find(a => a.id === pickerSelectedAssetId);
                  const assetName = asset?.name || 'Selected Asset';
                  
                  setNodes((prev) => prev.map((n) => {
                    if (n.id === attrPickerNode.id) {
                      const newData = {
                        ...n.data,
                        assetId: pickerSelectedAssetId,
                        assetName: assetName,
                        attributeName: pickerSelectedAttribute
                      };
                      return { ...n, data: newData };
                    }
                    return n;
                  }));
                  
                  setAttrPickerNode(null);
                }}
                className="text-xs font-bold text-amber-500 hover:text-amber-600 disabled:opacity-40 disabled:cursor-not-allowed uppercase tracking-wider transition-colors cursor-pointer"
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
