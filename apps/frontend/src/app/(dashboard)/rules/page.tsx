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
  Download, Filter, Calculator, BellRing, Mail, Send
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

const CustomNode = ({ data }: any) => {
  const isInput = data.type.startsWith('trigger_') || data.type.startsWith('input_');
  const isOutput = data.type.startsWith('action_');

  let Icon = Box;
  switch (data.type) {
    case 'trigger_geofence': Icon = MapIcon; break;
    case 'trigger_telemetry': Icon = Activity; break;
    case 'input_attribute': Icon = Download; break;
    case 'logic_filter': Icon = Filter; break;
    case 'process_math': Icon = Calculator; break;
    case 'action_alarm': Icon = BellRing; break;
    case 'action_email': Icon = Mail; break;
    case 'action_telegram': Icon = Send; break;
  }

  return (
    <div className={`px-4 py-3 shadow-md rounded-xl bg-card border-2 ${isInput ? 'border-blue-500/50' : isOutput ? 'border-purple-500/50' : 'border-green-500/50'} flex flex-col items-center justify-center min-w-[150px] relative`}>
      {!isInput && (
        <Handle type="target" position={Position.Top} className="w-3 h-3 bg-muted-foreground border-2 border-background" />
      )}
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${isInput ? 'text-blue-500' : isOutput ? 'text-purple-500' : 'text-green-500'}`} />
        <span className="font-bold text-xs text-foreground">{data.label}</span>
      </div>
      {!isOutput && (
        <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-muted-foreground border-2 border-background" />
      )}
    </div>
  );
};

const nodeTypes = { customNode: CustomNode };

// Node Types
type NodeType = 'trigger_geofence' | 'trigger_telemetry' | 'logic_filter' | 'action_alarm' | 'action_email' | 'action_telegram' | 'input_attribute' | 'process_math';

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

const getAssetAttributes = (asset: any) => {
  let attrs = [{ name: 'status', type: 'string' }]; // 'status' is a native Prisma field

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
  const [wtGlobalCooldown, setWtGlobalCooldown] = useState<number>(0);

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
    setWtGlobalCooldown(0);
    setActiveTab('editor_whenthen');
  };

  const handleEditRule = (rule: Rule) => {
    setEditingRule(rule);
    setRuleName(rule.name);
    if (rule.ruleType === 'WHEN_THEN') {
      try {
        const config = JSON.parse(rule.ruleConfig || '{}');
        if (config.groups && Array.isArray(config.groups)) {
          setWtGroups(config.groups);
        } else if (config.conditions && Array.isArray(config.conditions)) {
          setWtGroups([{ id: 'group-default', conditions: config.conditions }]);
        } else {
          setWtGroups([{ id: Date.now().toString(), conditions: [{ id: Date.now().toString(), assetId: '', attribute: '', operator: '>', value: '', durationMinutes: 0 }] }]);
        }
        setWtActions(config.actions || []);
        setWtThenFrequency(config.thenFrequency || 'ALWAYS');
        setWtGlobalCooldown(Number(config.cooldownMinutes) || 0);
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
      cooldownMinutes: wtGlobalCooldown,
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
      case 'trigger_telemetry': label = 'Telemetry Event'; initialData = { attributeName: '', assetId: 'ANY' }; break;
      case 'input_attribute': label = 'Attribute Value'; initialData = { assetId: 'ANY', attributeName: '' }; break;
      case 'logic_filter': label = 'Filter Logic'; initialData = { conditionType: 'GT', thresholdValue: '40' }; break;
      case 'process_math': label = 'Math Operation'; initialData = { operation: 'ADD' }; break;
      case 'action_alarm': label = 'Create Alarm'; initialData = { messageTemplate: 'Critical alert: Asset {assetName}' }; break;
      case 'action_email': label = 'SMTP Email'; initialData = { toEmail: '', subjectTemplate: 'Alert Notification', bodyTemplate: 'Asset {assetName} triggered an alert.' }; break;
      case 'action_telegram': label = 'Telegram Bot'; initialData = { chatId: '', messageTemplate: '⚠️ *GeoMesh Alert*\\nAsset: *{assetName}*\\nEvent: *{attributeName}* triggered with value {value}.' }; break;
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
                              title={rule.isActive ? 'Nonaktifkan' : 'Aktifkan'}
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
                <ClipboardList className="h-4 w-4 text-sky-400" /> Audit Logs {selectedLogRule ? `· ${selectedLogRule.name}` : ''}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
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
                      const attrOptions = getAssetAttributes(selectedAsset).map(a => ({ label: a.name, value: a.name }));
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
                                className="h-8 text-xs"
                                placeholder="Enter value..."
                                value={cond.value}
                                onChange={(e) => {
                                  const ng = [...wtGroups];
                                  ng[groupIdx].conditions[condIdx].value = e.target.value;
                                  setWtGroups(ng);
                                }}
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="text-[10px] font-bold text-muted-foreground mb-1 block">Duration (min)</label>
                              <Input
                                type="number"
                                min="0"
                                className="h-8 text-xs bg-background"
                                placeholder="Duration (min)..."
                                value={cond.durationMinutes || ''}
                                onChange={(e) => {
                                  const ng = [...wtGroups];
                                  ng[groupIdx].conditions[condIdx].durationMinutes = Math.max(0, parseInt(e.target.value) || 0);
                                  setWtGroups(ng);
                                }}
                              />
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

              <div className="flex items-center gap-2 bg-secondary/40 p-3 rounded-xl border border-border/80">
                <span className="text-[10px] font-bold text-muted-foreground whitespace-nowrap">Global Rule Cooldown:</span>
                <Input
                  type="number"
                  min="0"
                  max="1440"
                  value={wtGlobalCooldown}
                  onChange={(e) => setWtGlobalCooldown(Math.max(0, parseInt(e.target.value) || 0))}
                  className="h-7 w-16 text-xs font-bold text-center bg-background border-border"
                />
                <span className="text-[10px] font-medium text-muted-foreground">minutes</span>
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
          <div className="w-full lg:w-52 border border-border shadow-md rounded-2xl flex lg:flex-col lg:shrink-0 bg-card overflow-x-auto lg:overflow-y-auto p-3 gap-4 lg:gap-0 lg:space-y-4">
            <div className="shrink-0 min-w-[120px]">
              <div className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-2">Input</div>
              <div className="flex lg:flex-col gap-1.5">
                <div draggable onDragStart={(e) => onDragStart(e, 'input_attribute')} className="flex items-center w-full text-[10px] h-7 px-2 border border-border cursor-pointer rounded-md font-medium bg-blue-500/10 text-blue-500 hover:bg-blue-500/20">Attribute value</div>
                <div draggable onDragStart={(e) => onDragStart(e, 'trigger_telemetry')} className="flex items-center w-full text-[10px] h-7 px-2 border border-border cursor-pointer rounded-md font-medium bg-blue-500/10 text-blue-500 hover:bg-blue-500/20">Telemetry Event</div>
                <div draggable onDragStart={(e) => onDragStart(e, 'trigger_geofence')} className="flex items-center w-full text-[10px] h-7 px-2 border border-border cursor-pointer rounded-md font-medium bg-blue-500/10 text-blue-500 hover:bg-blue-500/20">Geofence Event</div>
              </div>
            </div>

            <div className="shrink-0 min-w-[100px]">
              <div className="text-[10px] font-bold text-green-500 uppercase tracking-wider mb-2">Processors</div>
              <div className="flex lg:grid lg:grid-cols-2 gap-1.5">
                <div draggable onDragStart={(e) => onDragStart(e, 'process_math')} className="flex items-center justify-center w-full text-[10px] h-7 px-2 border border-border cursor-pointer rounded-md font-medium bg-green-500/10 text-green-500 hover:bg-green-500/20">Math</div>
                <div draggable onDragStart={(e) => onDragStart(e, 'logic_filter')} className="flex items-center justify-center w-full text-[10px] h-7 px-2 border border-border cursor-pointer rounded-md font-medium bg-green-500/10 text-green-500 hover:bg-green-500/20">Logic</div>
              </div>
            </div>

            <div className="shrink-0 min-w-[120px]">
              <div className="text-[10px] font-bold text-purple-500 uppercase tracking-wider mb-2">Output / Actions</div>
              <div className="flex lg:flex-col gap-1.5">
                <div draggable onDragStart={(e) => onDragStart(e, 'action_alarm')} className="flex items-center w-full text-[10px] h-7 px-2 border border-border cursor-pointer rounded-md font-medium bg-purple-500/10 text-purple-500 hover:bg-purple-500/20">System Alarm</div>
                <div draggable onDragStart={(e) => onDragStart(e, 'action_email')} className="flex items-center w-full text-[10px] h-7 px-2 border border-border cursor-pointer rounded-md font-medium bg-purple-500/10 text-purple-500 hover:bg-purple-500/20">Send Email</div>
                <div draggable onDragStart={(e) => onDragStart(e, 'action_telegram')} className="flex items-center w-full text-[10px] h-7 px-2 border border-border cursor-pointer rounded-md font-medium bg-purple-500/10 text-purple-500 hover:bg-purple-500/20">Telegram Bot</div>
              </div>
            </div>
          </div>

          <div className="flex-1 border border-border rounded-2xl overflow-hidden shadow-2xl relative bg-background">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={(_, node) => setSelectedNode(node)}
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

          {/* FLOW PROPERTIES PANEL */}
          {selectedNode && (
            <Card className="w-full lg:w-80 border-border shadow-md rounded-2xl flex flex-col lg:shrink-0 absolute lg:relative z-30 bottom-0 lg:bottom-auto max-h-[50%] lg:max-h-full">
              <CardHeader className="py-3 border-b border-border flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-bold text-foreground">Node Config</CardTitle>
                <Button size="sm" variant="ghost" className="h-6 text-red-500 hover:text-red-600 font-bold p-1" onClick={deleteSelectedNode}>
                  Hapus Node
                </Button>
              </CardHeader>
              <CardContent className="p-4 space-y-4 overflow-y-auto flex-1 text-xs bg-card">
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
                          onChange={(val) => updateNodeData(selectedNode.id, 'assetId', val)}
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

                  {/* TELEMETRY / INPUT CONFIGURATION */}
                  {(selectedNode.data.type === 'trigger_telemetry' || selectedNode.data.type === 'input_attribute') && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-muted-foreground font-semibold">Select Asset</label>
                        <SearchableSelect
                          options={[{ label: "Any Assets", value: "ANY" }, ...assetOptions]}
                          value={selectedNode.data.assetId}
                          onChange={(val) => updateNodeData(selectedNode.id, 'assetId', val)}
                          alwaysSearchable={true}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-muted-foreground font-semibold">Attribute Name</label>
                        {selectedNode.data.assetId === 'ANY' ? (
                          <Input value={selectedNode.data.attributeName} onChange={(e) => updateNodeData(selectedNode.id, 'attributeName', e.target.value)} className="h-8 rounded-lg text-xs" placeholder="Type attribute manually..." />
                        ) : (
                          <SearchableSelect
                            options={(() => {
                              const asset = assets.find(a => a.id === selectedNode.data.assetId);
                              return getAssetAttributes(asset).map(a => ({ label: a.name, value: a.name }));
                            })()}
                            value={selectedNode.data.attributeName}
                            onChange={(val) => updateNodeData(selectedNode.id, 'attributeName', val)}
                            placeholder="Select Attribute..."
                          />
                        )}
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

                  {/* FILTER LOGIC CONFIGURATION */}
                  {selectedNode.data.type === 'logic_filter' && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-muted-foreground font-semibold">Condition Type</label>
                        <SearchableSelect
                          options={[
                            { label: "Greater Than (>)", value: "GT" },
                            { label: "Less Than (<)", value: "LT" },
                            { label: "Equal To (==)", value: "EQ" }
                          ]}
                          value={selectedNode.data.conditionType}
                          onChange={(val) => updateNodeData(selectedNode.id, 'conditionType', val)}
                          placeholder="Condition..."
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-muted-foreground font-semibold">Threshold Value</label>
                        <Input type="number" value={selectedNode.data.thresholdValue} onChange={(e) => updateNodeData(selectedNode.id, 'thresholdValue', e.target.value)} className="h-8 rounded-lg text-xs" />
                      </div>
                    </div>
                  )}

                  {/* PROCESS MATH CONFIGURATION */}
                  {selectedNode.data.type === 'process_math' && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-muted-foreground font-semibold">Operation</label>
                        <SearchableSelect
                          options={[
                            { label: "Add (+)", value: "ADD" },
                            { label: "Subtract (-)", value: "SUB" },
                            { label: "Multiply (*)", value: "MUL" },
                            { label: "Divide (/)", value: "DIV" }
                          ]}
                          value={selectedNode.data.operation}
                          onChange={(val) => updateNodeData(selectedNode.id, 'operation', val)}
                          placeholder="Select Operation..."
                        />
                      </div>
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
    </div>
  );
}
