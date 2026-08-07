'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getApiUrl } from '../../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { 
  ShieldAlert, Plus, Trash2, Mail, Play, Save, X, ToggleLeft, ToggleRight,
  HelpCircle, Settings, ClipboardList, Database, Bot, Clock
} from 'lucide-react';
import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
} from 'reactflow';
import 'reactflow/dist/style.css';

// Node Types and Configurations supported by the rules engine
type NodeType = 'trigger_geofence' | 'trigger_telemetry' | 'logic_filter' | 'action_alarm' | 'action_email' | 'action_telegram';

interface Rule {
  id: string;
  name: string;
  isActive: boolean;
  flowGraph: string;
  createdAt: string;
}

interface RuleExecutionLog {
  id: string;
  status: 'SUCCESS' | 'FAILED';
  message: string;
  createdAt: string;
}

export default function RulesPage() {
  const { tenantId, token, isAdmin } = useAuth();
  
  // Rules list state
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'editor'>('list');
  
  // Editor state
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [ruleName, setRuleName] = useState('');
  
  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  // Lists for dropdown configurations
  const [assets, setAssets] = useState<any[]>([]);
  const [geofences, setGeofences] = useState<any[]>([]);

  // Log Viewer State
  const [selectedLogRule, setSelectedLogRule] = useState<Rule | null>(null);
  const [logs, setLogs] = useState<RuleExecutionLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const apiHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-tenant-id': tenantId || '',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }, [tenantId, token]);

  // Fetch Rules & Options
  const fetchRules = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/rules`, { headers: apiHeaders() });
      if (res.ok) {
        const data = await res.json();
        setRules(data);
      }
    } catch (err) {
      console.error('Failed to fetch rules:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId, apiHeaders]);

  const fetchLogs = async (ruleId: string) => {
    setLoadingLogs(true);
    try {
      const res = await fetch(`${getApiUrl()}/rules/${ruleId}/logs`, { headers: apiHeaders() });
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const fetchDropdownOptions = useCallback(async () => {
    if (!tenantId) return;
    try {
      // 1. Fetch Assets
      const assetsRes = await fetch(`${getApiUrl()}/assets`, { headers: apiHeaders() });
      if (assetsRes.ok) {
        const data = await assetsRes.json();
        setAssets(data);
      }

      // 2. Fetch Geofences across all Zones
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
      console.error('Failed to load rule builder options:', err);
    }
  }, [tenantId, apiHeaders]);

  useEffect(() => {
    if (tenantId) {
      fetchRules();
      fetchDropdownOptions();
    }
  }, [tenantId, fetchRules, fetchDropdownOptions]);

  // Connect Nodes
  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  // Toggle Rule Status (Active/Inactive)
  const handleToggleActive = async (rule: Rule) => {
    try {
      const res = await fetch(`${getApiUrl()}/rules/${rule.id}`, {
        method: 'PATCH',
        headers: apiHeaders(),
        body: JSON.stringify({ isActive: !rule.isActive }),
      });
      if (res.ok) {
        fetchRules();
      }
    } catch (err) {
      console.error('Failed to toggle rule active state:', err);
    }
  };

  // Delete Rule Flow
  const handleDeleteRule = async (ruleId: string, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus flow rule "${name}"?`)) return;
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
      console.error('Failed to delete rule:', err);
    }
  };

  // Start Editor: Create New
  const handleCreateNew = () => {
    setEditingRule(null);
    setRuleName('');
    setNodes([
      {
        id: '1',
        type: 'input',
        data: { label: 'Start Trigger' },
        position: { x: 250, y: 5 },
      },
    ]);
    setEdges([]);
    setSelectedNode(null);
    setActiveTab('editor');
  };

  // Start Editor: Edit Existing
  const handleEditRule = (rule: Rule) => {
    try {
      const graph = JSON.parse(rule.flowGraph);
      setEditingRule(rule);
      setRuleName(rule.name);
      setNodes(graph.nodes || []);
      setEdges(graph.edges || []);
      setSelectedNode(null);
      setActiveTab('editor');
    } catch (e) {
      alert('Gagal memuat visual flow rule.');
    }
  };

  // Drag and drop Node insertion
  const addNodeToFlow = (type: NodeType) => {
    const id = `node-${Date.now()}`;
    let label = '';
    let initialData: Record<string, any> = {};

    switch (type) {
      case 'trigger_geofence':
        label = '🚪 Geofence Event';
        initialData = { eventType: 'ANY', geofenceId: 'ANY', assetId: 'ANY' };
        break;
      case 'trigger_telemetry':
        label = '📈 Telemetry Event';
        initialData = { attributeName: 'temperature', assetId: 'ANY' };
        break;
      case 'logic_filter':
        label = '🔀 Filter Logic';
        initialData = { conditionType: 'GT', thresholdValue: '40' };
        break;
      case 'action_alarm':
        label = '🚨 Create Alarm';
        initialData = { messageTemplate: 'Critical alert: Asset {assetName} left {geofenceName}' };
        break;
      case 'action_email':
        label = '📧 SMTP Email';
        initialData = {
          smtpHost: 'smtp.gmail.com',
          smtpPort: '587',
          smtpUser: 'my-email@gmail.com',
          smtpPass: '',
          toEmail: '',
          subjectTemplate: 'GeoMesh Alert: {assetName}',
          bodyTemplate: 'GeoMesh Alert Triggered:\nAsset: {assetName}\nTrigger: {geofenceName}\nTime: {time}'
        };
        break;
      case 'action_telegram':
        label = '🤖 Telegram Bot';
        initialData = {
          botToken: '',
          chatId: '',
          messageTemplate: '⚠️ *GeoMesh Alert*\nAsset: *{assetName}*\nEvent: *{geofenceName}*'
        };
        break;
    }

    const newNode: Node = {
      id,
      position: { x: 100 + Math.random() * 150, y: 150 + Math.random() * 150 },
      data: { label, type, ...initialData },
    };

    setNodes((prev) => [...prev, newNode]);
  };

  // Node Properties update
  const updateNodeData = (nodeId: string, key: string, value: any) => {
    setNodes((prev) =>
      prev.map((node) => {
        if (node.id === nodeId) {
          const updatedData = { ...node.data, [key]: value };
          if (selectedNode?.id === nodeId) {
            setSelectedNode((sNode) => sNode ? { ...sNode, data: updatedData } : null);
          }
          return { ...node, data: updatedData };
        }
        return node;
      })
    );
  };

  // Delete Selected Node
  const deleteSelectedNode = () => {
    if (!selectedNode) return;
    setNodes((prev) => prev.filter((n) => n.id !== selectedNode.id));
    setEdges((prev) => prev.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
    setSelectedNode(null);
  };

  // Save Flow
  const handleSaveFlow = async () => {
    if (!ruleName.trim()) {
      alert('Nama rule tidak boleh kosong.');
      return;
    }

    const flowGraph = JSON.stringify({ nodes, edges });
    const method = editingRule ? 'PATCH' : 'POST';
    const endpoint = editingRule ? `${getApiUrl()}/rules/${editingRule.id}` : `${getApiUrl()}/rules`;

    try {
      const res = await fetch(endpoint, {
        method,
        headers: apiHeaders(),
        body: JSON.stringify({ name: ruleName, flowGraph }),
      });

      if (res.ok) {
        setActiveTab('list');
        fetchRules();
      } else {
        const err = await res.json();
        alert(err.message || 'Gagal menyimpan flow rule.');
      }
    } catch (err) {
      console.error('Failed to save rule:', err);
    }
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* HEADER SECTION */}
      <div className="flex items-center justify-between p-4 bg-card border border-border rounded-2xl shadow-sm">
        <div>
          <h2 className="text-sm font-bold flex items-center gap-2 text-foreground">
            <ShieldAlert className="h-4.5 w-4.5 text-primary" />
            Mesh Automation Rules
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Buat aturan peringatan dan notifikasi berbasis visual flow mirip Node-RED untuk pergerakan Mesh & Telemetry.
          </p>
        </div>
        
        {activeTab === 'list' ? (
          isAdmin && (
            <Button onClick={handleCreateNew} className="text-xs font-bold cursor-pointer h-8 rounded-xl">
              <Plus className="h-4 w-4 mr-1.5" /> Create New Flow
            </Button>
          )
        ) : (
          <div className="flex gap-2">
            <Button onClick={() => setActiveTab('list')} variant="outline" className="text-xs font-bold cursor-pointer h-8 rounded-xl">
              <X className="h-4 w-4 mr-1" /> Batal
            </Button>
            {isAdmin && (
              <Button onClick={handleSaveFlow} className="text-xs font-bold cursor-pointer h-8 rounded-xl bg-primary">
                <Save className="h-4 w-4 mr-1.5" /> Simpan Rule Flow
              </Button>
            )}
          </div>
        )}
      </div>

      {activeTab === 'list' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
          {/* LEFT: RULES LIST */}
          <Card className="lg:col-span-2 border-border shadow-md rounded-2xl flex flex-col min-h-0">
            <CardHeader className="py-3.5 border-b border-border">
              <CardTitle className="text-xs font-bold text-foreground">Daftar Automation Rules</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-y-auto flex-1">
              {rules.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground italic">
                  Belum ada automation flow rule yang dibuat.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {rules.map((rule) => (
                    <div 
                      key={rule.id}
                      onClick={() => {
                        setSelectedLogRule(rule);
                        fetchLogs(rule.id);
                      }}
                      className={`p-4 flex items-center justify-between hover:bg-secondary/20 transition-all cursor-pointer ${selectedLogRule?.id === rule.id ? 'bg-secondary/40 border-l-2 border-primary' : ''}`}
                    >
                      <div className="space-y-1">
                        <div className="text-xs font-bold text-foreground">{rule.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          Dibuat pada: {new Date(rule.createdAt).toLocaleString()}
                        </div>
                      </div>
                      
                      {isAdmin && (
                        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                          <button 
                            onClick={() => handleToggleActive(rule)}
                            className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            title={rule.isActive ? 'Nonaktifkan Rule' : 'Aktifkan Rule'}
                          >
                            {rule.isActive ? (
                              <ToggleRight className="h-6 w-6 text-green-500" />
                            ) : (
                              <ToggleLeft className="h-6 w-6 text-muted-foreground" />
                            )}
                          </button>
                          
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-7 text-[10px] cursor-pointer rounded-lg border-border"
                            onClick={() => handleEditRule(rule)}
                          >
                            <Settings className="h-3 w-3 mr-1" /> Edit Flow
                          </Button>

                          <button 
                            onClick={() => handleDeleteRule(rule.id, rule.name)}
                            className="p-1.5 rounded-lg border border-border bg-destructive/10 text-destructive hover:bg-destructive/25 transition-all cursor-pointer"
                            title="Hapus Rule"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* RIGHT: RUN LOGS AUDITING */}
          <Card className="border-border shadow-md rounded-2xl flex flex-col min-h-0">
            <CardHeader className="py-3.5 border-b border-border flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <ClipboardList className="h-4 w-4 text-sky-400" />
                Audit Logs {selectedLogRule ? `· ${selectedLogRule.name}` : ''}
              </CardTitle>
              {selectedLogRule && (
                <Button size="sm" variant="ghost" className="h-6 text-[10px] p-1 font-bold" onClick={() => fetchLogs(selectedLogRule.id)}>
                  Refresh
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-4 overflow-y-auto flex-1 space-y-3">
              {!selectedLogRule ? (
                <div className="text-center text-xs text-muted-foreground italic py-8">
                  Pilih salah satu rule di samping untuk memantau log eksekusi pemicu dan notifikasi secara real-time.
                </div>
              ) : loadingLogs ? (
                <div className="text-center py-8 text-xs text-muted-foreground">Memuat data log audit...</div>
              ) : logs.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground italic py-8">
                  Rule ini belum pernah dipicu oleh pemicu event apa pun.
                </div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="p-3 rounded-xl border border-border bg-secondary/20 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Badge className={log.status === 'SUCCESS' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-destructive/10 text-destructive border border-destructive/20'}>
                        {log.status}
                      </Badge>
                      <span className="text-[9px] text-muted-foreground font-mono">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <pre className="text-[9px] font-mono text-foreground overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-40 bg-background/50 p-2 rounded-lg border border-border/50">
                      {log.message}
                    </pre>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        /* FLOW BUILDER WORKSPACE EDITOR */
        <div className="flex flex-1 gap-4 min-h-0">
          {/* FLOW BUILDER CANVAS (React Flow) */}
          <div className="flex-1 border border-border rounded-2xl overflow-hidden shadow-2xl relative bg-secondary/15 min-h-[500px]">
            {/* Visual Node palette sidebar (absolute overlay floating list) */}
            <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 p-3 bg-card/95 backdrop-blur border border-border rounded-2xl shadow-lg w-44">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Tambah Node</div>
              
              <div className="space-y-1">
                <div className="text-[9px] font-bold text-amber-500">1. TRIGGERS</div>
                <Button size="sm" variant="outline" className="w-full text-[10px] h-7 justify-start rounded-lg border-border cursor-pointer" onClick={() => addNodeToFlow('trigger_geofence')}>
                  <HelpCircle className="h-3 w-3 mr-1 text-amber-400" /> Geofence Trigger
                </Button>
                <Button size="sm" variant="outline" className="w-full text-[10px] h-7 justify-start rounded-lg border-border cursor-pointer" onClick={() => addNodeToFlow('trigger_telemetry')}>
                  <Clock className="h-3 w-3 mr-1 text-amber-400" /> Telemetry Trigger
                </Button>
              </div>

              <div className="space-y-1 pt-1.5">
                <div className="text-[9px] font-bold text-sky-500">2. LOGIC</div>
                <Button size="sm" variant="outline" className="w-full text-[10px] h-7 justify-start rounded-lg border-border cursor-pointer" onClick={() => addNodeToFlow('logic_filter')}>
                  <Settings className="h-3 w-3 mr-1 text-sky-400" /> Filter Condition
                </Button>
              </div>

              <div className="space-y-1 pt-1.5">
                <div className="text-[9px] font-bold text-green-500">3. ACTIONS</div>
                <Button size="sm" variant="outline" className="w-full text-[10px] h-7 justify-start rounded-lg border-border cursor-pointer" onClick={() => addNodeToFlow('action_alarm')}>
                  <ShieldAlert className="h-3 w-3 mr-1 text-green-400" /> System Alarm
                </Button>
                <Button size="sm" variant="outline" className="w-full text-[10px] h-7 justify-start rounded-lg border-border cursor-pointer" onClick={() => addNodeToFlow('action_email')}>
                  <Mail className="h-3 w-3 mr-1 text-green-400" /> SMTP Email
                </Button>
                <Button size="sm" variant="outline" className="w-full text-[10px] h-7 justify-start rounded-lg border-border cursor-pointer" onClick={() => addNodeToFlow('action_telegram')}>
                  <Bot className="h-3 w-3 mr-1 text-green-400" /> Telegram Bot
                </Button>
              </div>
            </div>

            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={(_, node) => setSelectedNode(node)}
              fitView
              className="w-full h-full"
            >
              <Background color="#334155" gap={16} />
              <Controls />
            </ReactFlow>
          </div>

          {/* PROPERTIES PANEL SIDEBAR */}
          <Card className="w-80 border-border shadow-md rounded-2xl flex flex-col min-h-0 shrink-0">
            <CardHeader className="py-3 border-b border-border">
              <CardTitle className="text-xs font-bold text-foreground">Rule & Node Properties</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4 overflow-y-auto flex-1 text-xs">
              <div className="space-y-1.5">
                <label className="text-muted-foreground font-bold">Rule Flow Name</label>
                <Input
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="e.g. Forklift Geofence Alarm"
                  className="text-xs font-semibold h-8 rounded-lg"
                />
              </div>

              <div className="border-t border-border/50 my-2 pt-2">
                {selectedNode ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground uppercase tracking-wider text-[10px]">Config Node</span>
                      <Button size="sm" variant="ghost" className="h-6 text-red-500 hover:text-red-600 font-bold p-1" onClick={deleteSelectedNode}>
                        Hapus Node
                      </Button>
                    </div>

                    <div className="p-2.5 rounded-xl bg-secondary/35 border border-border font-bold">
                      {selectedNode.data.label || selectedNode.id}
                    </div>

                    {/* GEOFENCE TRIGGER CONFIGURATION */}
                    {selectedNode.data.type === 'trigger_geofence' && (
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-muted-foreground font-semibold">Event Type</label>
                          <select
                            value={selectedNode.data.eventType}
                            onChange={(e) => updateNodeData(selectedNode.id, 'eventType', e.target.value)}
                            className="w-full bg-secondary/35 border border-border px-2.5 py-1.5 rounded-lg text-foreground focus:outline-none focus:border-primary text-xs font-semibold"
                          >
                            <option value="ANY">Any Event (Enter / Exit)</option>
                            <option value="GEOFENCE_ENTER">Asset Enter Geofence</option>
                            <option value="GEOFENCE_EXIT">Asset Exit Geofence</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-muted-foreground font-semibold">Select Geofence Zone</label>
                          <select
                            value={selectedNode.data.geofenceId}
                            onChange={(e) => updateNodeData(selectedNode.id, 'geofenceId', e.target.value)}
                            className="w-full bg-secondary/35 border border-border px-2.5 py-1.5 rounded-lg text-foreground focus:outline-none focus:border-primary text-xs font-semibold"
                          >
                            <option value="ANY">Any Geofence</option>
                            {geofences.map((gf) => (
                              <option key={gf.id} value={gf.id}>
                                {gf.name} ({gf.zoneName})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-muted-foreground font-semibold">Select Asset (Filter)</label>
                          <select
                            value={selectedNode.data.assetId}
                            onChange={(e) => updateNodeData(selectedNode.id, 'assetId', e.target.value)}
                            className="w-full bg-secondary/35 border border-border px-2.5 py-1.5 rounded-lg text-foreground focus:outline-none focus:border-primary text-xs font-semibold"
                          >
                            <option value="ANY">Any Assets</option>
                            {assets.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name} ({a.type})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {/* TELEMETRY TRIGGER CONFIGURATION */}
                    {selectedNode.data.type === 'trigger_telemetry' && (
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-muted-foreground font-semibold">Sensor Attribute Name</label>
                          <select
                            value={selectedNode.data.attributeName}
                            onChange={(e) => updateNodeData(selectedNode.id, 'attributeName', e.target.value)}
                            className="w-full bg-secondary/35 border border-border px-2.5 py-1.5 rounded-lg text-foreground focus:outline-none focus:border-primary text-xs font-semibold"
                          >
                            <option value="temperature">Temperature (°C)</option>
                            <option value="humidity">Humidity (%)</option>
                            <option value="battery">Battery Voltage (V)</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-muted-foreground font-semibold">Select Asset (Filter)</label>
                          <select
                            value={selectedNode.data.assetId}
                            onChange={(e) => updateNodeData(selectedNode.id, 'assetId', e.target.value)}
                            className="w-full bg-secondary/35 border border-border px-2.5 py-1.5 rounded-lg text-foreground focus:outline-none focus:border-primary text-xs font-semibold"
                          >
                            <option value="ANY">Any Assets</option>
                            {assets.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name} ({a.type})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {/* LOGIC FILTER CONFIGURATION */}
                    {selectedNode.data.type === 'logic_filter' && (
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-muted-foreground font-semibold">Condition Type</label>
                          <select
                            value={selectedNode.data.conditionType}
                            onChange={(e) => updateNodeData(selectedNode.id, 'conditionType', e.target.value)}
                            className="w-full bg-secondary/35 border border-border px-2.5 py-1.5 rounded-lg text-foreground focus:outline-none focus:border-primary text-xs font-semibold"
                          >
                            <option value="GT">Greater Than (&gt;)</option>
                            <option value="LT">Less Than (&lt;)</option>
                            <option value="EQ">Equal To (==)</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-muted-foreground font-semibold">Threshold Value</label>
                          <Input
                            type="number"
                            value={selectedNode.data.thresholdValue}
                            onChange={(e) => updateNodeData(selectedNode.id, 'thresholdValue', e.target.value)}
                            className="h-8 rounded-lg text-xs"
                          />
                        </div>
                      </div>
                    )}

                    {/* ACTION ALARM CONFIGURATION */}
                    {selectedNode.data.type === 'action_alarm' && (
                      <div className="space-y-1.5">
                        <label className="text-muted-foreground font-semibold">Alarm Message Template</label>
                        <textarea
                          value={selectedNode.data.messageTemplate}
                          onChange={(e) => updateNodeData(selectedNode.id, 'messageTemplate', e.target.value)}
                          rows={4}
                          className="w-full bg-secondary/35 border border-border px-2.5 py-1.5 rounded-lg text-foreground focus:outline-none focus:border-primary text-xs font-semibold"
                        />
                        <div className="text-[9px] text-muted-foreground leading-normal mt-1">
                          Variabel yang didukung: <br/>
                          <code>{"{assetName}"}</code>, <code>{"{geofenceName}"}</code>, <code>{"{value}"}</code>, <code>{"{time}"}</code>
                        </div>
                      </div>
                    )}

                    {/* ACTION EMAIL CONFIGURATION */}
                    {selectedNode.data.type === 'action_email' && (
                      <div className="space-y-2.5">
                        <div className="space-y-1">
                          <label className="text-muted-foreground font-semibold">SMTP Host</label>
                          <Input value={selectedNode.data.smtpHost} onChange={(e) => updateNodeData(selectedNode.id, 'smtpHost', e.target.value)} className="h-7 rounded-lg text-xs" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-muted-foreground font-semibold">SMTP Port</label>
                          <Input value={selectedNode.data.smtpPort} onChange={(e) => updateNodeData(selectedNode.id, 'smtpPort', e.target.value)} className="h-7 rounded-lg text-xs" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-muted-foreground font-semibold">SMTP Email User</label>
                          <Input value={selectedNode.data.smtpUser} onChange={(e) => updateNodeData(selectedNode.id, 'smtpUser', e.target.value)} className="h-7 rounded-lg text-xs" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-muted-foreground font-semibold">SMTP App Password</label>
                          <Input type="password" value={selectedNode.data.smtpPass} onChange={(e) => updateNodeData(selectedNode.id, 'smtpPass', e.target.value)} className="h-7 rounded-lg text-xs" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-muted-foreground font-semibold">To Address</label>
                          <Input value={selectedNode.data.toEmail} onChange={(e) => updateNodeData(selectedNode.id, 'toEmail', e.target.value)} className="h-7 rounded-lg text-xs" placeholder="e.g. admin@company.com" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-muted-foreground font-semibold">Subject Template</label>
                          <Input value={selectedNode.data.subjectTemplate} onChange={(e) => updateNodeData(selectedNode.id, 'subjectTemplate', e.target.value)} className="h-7 rounded-lg text-xs" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-muted-foreground font-semibold">Body Template</label>
                          <textarea value={selectedNode.data.bodyTemplate} onChange={(e) => updateNodeData(selectedNode.id, 'bodyTemplate', e.target.value)} rows={3} className="w-full bg-secondary/35 border border-border px-2 py-1.5 rounded-lg text-[10px] text-foreground font-semibold" />
                        </div>
                      </div>
                    )}

                    {/* ACTION TELEGRAM CONFIGURATION */}
                    {selectedNode.data.type === 'action_telegram' && (
                      <div className="space-y-2.5">
                        <div className="space-y-1">
                          <label className="text-muted-foreground font-semibold">Telegram Bot Token</label>
                          <Input value={selectedNode.data.botToken} onChange={(e) => updateNodeData(selectedNode.id, 'botToken', e.target.value)} className="h-7 rounded-lg text-xs" placeholder="Dari BotFather" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-muted-foreground font-semibold">Target Chat ID</label>
                          <Input value={selectedNode.data.chatId} onChange={(e) => updateNodeData(selectedNode.id, 'chatId', e.target.value)} className="h-7 rounded-lg text-xs" placeholder="e.g. -1001234567" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-muted-foreground font-semibold">Message Template (Markdown)</label>
                          <textarea value={selectedNode.data.messageTemplate} onChange={(e) => updateNodeData(selectedNode.id, 'messageTemplate', e.target.value)} rows={4} className="w-full bg-secondary/35 border border-border px-2 py-1.5 rounded-lg text-[10px] text-foreground font-semibold" />
                        </div>
                      </div>
                    )}

                  </div>
                ) : (
                  <div className="text-center text-xs text-muted-foreground italic py-8 leading-normal">
                    Pilih salah satu node pada canvas untuk mengkonfigurasi parameter atau pemicu aturannya.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
