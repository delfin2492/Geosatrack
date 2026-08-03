'use client';

import React, { useState } from 'react';
import { useSocket } from '../../context/SocketContext';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { 
  Folder, 
  MapPin, 
  Boxes, 
  FileText, 
  Plus, 
  Link2, 
  Unlink, 
  Save, 
  Edit,
  Radio,
  Cpu,
  RefreshCw,
  HardDrive
} from 'lucide-react';

interface AgentItem {
  id: string;
  name: string;
  protocol: string;
  status: string;
  brokerUrl: string;
  activeNodes: string[];
  msgRate: string;
  username: string;
}

export default function AssetsPage() {
  const { assets, setAssets } = useSocket();
  
  // Tab selector state: 'assets' | 'agents'
  const [activeTab, setActiveTab] = useState<'assets' | 'agents'>('assets');

  // ASSETS TAB STATES
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(assets[0]?.id || 'forklift-1');
  const [isEditingAsset, setIsEditingAsset] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editType, setEditType] = useState('FORKLIFT');

  const selectedAsset = assets.find((a) => a.id === selectedAssetId) || assets[0];

  // AGENTS TAB STATES
  const [agents, setAgents] = useState<AgentItem[]>([
    {
      id: 'mqtt-agent',
      name: 'MQTT Gateway Integration',
      protocol: 'MQTT (EMQX)',
      status: 'Connected',
      brokerUrl: 'mqtt://localhost:1883',
      activeNodes: ['node-439201', 'node-439202'],
      msgRate: '4.2 msg/s',
      username: 'admin_geomesh',
    },
    {
      id: 'http-webhook',
      name: 'HTTP Webhook Listener',
      protocol: 'HTTP API',
      status: 'Connected',
      brokerUrl: 'http://localhost:4000/api/webhooks',
      activeNodes: [],
      msgRate: '0.0 msg/s',
      username: 'api_key_geomesh',
    },
    {
      id: 'ble-mesh',
      name: 'BLE EYE Beacon Receiver',
      protocol: 'Bluetooth mesh',
      status: 'Connected',
      brokerUrl: 'hci0 (Bluetooth HCI Host)',
      activeNodes: ['node-eye-9011'],
      msgRate: '1.2 msg/s',
      username: 'system_ble',
    },
    {
      id: 'tcp-stream',
      name: 'TCP Raw Socket Parser',
      protocol: 'TCP Socket',
      status: 'Disconnected',
      brokerUrl: 'tcp://0.0.0.0:9000',
      activeNodes: [],
      msgRate: '0.0 msg/s',
      username: 'tcp_admin',
    }
  ]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('mqtt-agent');
  const [isEditingAgent, setIsEditingAgent] = useState(false);
  const [editAgentUrl, setEditAgentUrl] = useState('mqtt://localhost:1883');
  const [editAgentUser, setEditAgentUser] = useState('admin_geomesh');

  const selectedAgent = agents.find(a => a.id === selectedAgentId) || agents[0];

  // Group assets by Site and Zone
  const sites = {
    'Warehouse Cawang': {
      'Storage Zone Alpha': assets.filter(a => a.zoneId === 'zone-alpha'),
      'Receiving Dock': assets.filter(a => a.zoneId === 'zone-beta')
    }
  };

  const handleSelectAsset = (id: string) => {
    setSelectedAssetId(id);
    const asset = assets.find((a) => a.id === id);
    if (asset) {
      setEditName(asset.name);
      setEditDesc(asset.description || 'Peralatan operasional logistik.');
      setEditType(asset.type);
    }
    setIsEditingAsset(false);
  };

  const handleSaveAsset = () => {
    if (!selectedAssetId) return;
    setAssets((prev) => 
      prev.map((a) => 
        a.id === selectedAssetId 
          ? { ...a, name: editName, type: editType, description: editDesc } 
          : a
      )
    );
    setIsEditingAsset(false);
  };

  const handleSelectAgent = (id: string) => {
    setSelectedAgentId(id);
    const agent = agents.find(a => a.id === id);
    if (agent) {
      setEditAgentUrl(agent.brokerUrl);
      setEditAgentUser(agent.username);
    }
    setIsEditingAgent(false);
  };

  const handleSaveAgent = () => {
    setAgents(prev => prev.map(a => a.id === selectedAgentId ? { ...a, brokerUrl: editAgentUrl, username: editAgentUser } : a));
    setIsEditingAgent(false);
  };

  const toggleAgentConnection = (id: string) => {
    setAgents(prev => prev.map(a => {
      if (a.id === id) {
        const nextStatus = a.status === 'Connected' ? 'Disconnected' : 'Connected';
        return {
          ...a,
          status: nextStatus,
          msgRate: nextStatus === 'Connected' ? '2.5 msg/s' : '0.0 msg/s',
          activeNodes: nextStatus === 'Connected' ? (id === 'mqtt-agent' ? ['node-439201', 'node-439202'] : ['node-eye-9011']) : []
        };
      }
      return a;
    }));
  };

  return (
    <div className="flex h-full w-full gap-6">
      
      {/* LEFT COLUMN: HIERARCHY / PROTOCOL INTEGRATIONS (OpenRemote Panel style) */}
      <Card className="w-80 p-4 flex flex-col shrink-0">
        
        {/* Toggle Switch Tabs (B&W Shadcn Style) */}
        <div className="grid grid-cols-2 p-1 bg-secondary rounded-lg mb-4 border border-border">
          <button
            onClick={() => setActiveTab('assets')}
            className={`py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
              activeTab === 'assets'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Assets Tree
          </button>
          <button
            onClick={() => setActiveTab('agents')}
            className={`py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
              activeTab === 'agents'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Protocol Agents
          </button>
        </div>

        {activeTab === 'assets' ? (
          /* ==================== ASSETS TAB TREE ==================== */
          <>
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Location Node</h3>
              <Button size="icon" className="h-6 w-6">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 text-xs font-semibold">
              <div>
                <div className="flex items-center gap-2 text-foreground/80 py-1.5 px-2 hover:bg-secondary/40 rounded cursor-pointer">
                  <Folder className="h-4 w-4 text-foreground/75 shrink-0" />
                  <span>PT ABC Logistics</span>
                </div>
                
                <div className="pl-4 mt-1.5 space-y-2 border-l border-border/80 ml-3.5">
                  {Object.entries(sites).map(([siteName, zones]) => (
                    <div key={siteName}>
                      <div className="flex items-center gap-2 text-muted-foreground hover:text-foreground py-1 px-2 rounded cursor-pointer">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                        <span>{siteName}</span>
                      </div>
                      
                      <div className="pl-4 mt-1 space-y-1.5 border-l border-border/80 ml-3">
                        {Object.entries(zones).map(([zoneName, zoneAssets]) => (
                          <div key={zoneName}>
                            <div className="flex items-center gap-1.5 text-muted-foreground/70 py-0.5 px-2">
                              <Folder className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                              <span>{zoneName}</span>
                            </div>

                            <div className="pl-3 mt-1 space-y-1">
                              {zoneAssets.map((asset) => {
                                const isSelected = selectedAssetId === asset.id;
                                return (
                                  <div
                                    key={asset.id}
                                    onClick={() => handleSelectAsset(asset.id)}
                                    className={`flex items-center gap-2 py-1 px-3 rounded cursor-pointer transition-all border ${
                                      isSelected 
                                        ? 'bg-secondary border-border text-foreground font-bold' 
                                        : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                                    }`}
                                  >
                                    <Boxes className="h-3.5 w-3.5 shrink-0" />
                                    <span className="truncate">{asset.name}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          /* ==================== AGENTS TAB LIST ==================== */
          <>
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Active Protocols</h3>
              <Button size="icon" className="h-6 w-6">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5">
              {agents.map((agent) => {
                const isSelected = selectedAgentId === agent.id;
                const isConnected = agent.status === 'Connected';
                
                return (
                  <div
                    key={agent.id}
                    onClick={() => handleSelectAgent(agent.id)}
                    className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${
                      isSelected 
                        ? 'bg-secondary border-border text-foreground font-bold' 
                        : 'border-transparent text-muted-foreground hover:bg-secondary/40 hover:text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Radio className={`h-4.5 w-4.5 shrink-0 ${isConnected ? 'text-foreground' : 'text-muted-foreground/45'}`} />
                      <div className="min-w-0">
                        <p className="text-xs truncate font-bold">{agent.name}</p>
                        <p className="text-[10px] font-mono text-muted-foreground">{agent.protocol}</p>
                      </div>
                    </div>
                    <Badge variant={isConnected ? "success" : "secondary"}>
                      {agent.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      {/* RIGHT COLUMN: INSPECTOR PANEL (OpenRemote Style) */}
      <Card className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'assets' ? (
          /* ==================== ASSET DETAILS VIEW ==================== */
          <>
            <CardHeader className="py-4 flex flex-row items-center justify-between border-b">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4.5 w-4.5 text-muted-foreground" />
                Asset Twin Configuration
              </CardTitle>
              {selectedAsset && !isEditingAsset && (
                <Button
                  onClick={() => {
                    setIsEditingAsset(true);
                    setEditName(selectedAsset.name);
                    setEditDesc(selectedAsset.description || '');
                    setEditType(selectedAsset.type);
                  }}
                  variant="outline"
                  className="flex items-center gap-1.5 h-8 text-[11px]"
                >
                  <Edit className="h-3.5 w-3.5" />
                  Edit Asset
                </Button>
              )}
            </CardHeader>

            <CardContent className="p-6 space-y-6 flex-1 overflow-y-auto pt-6">
              {selectedAsset ? (
                <>
                  {isEditingAsset ? (
                    // EDIT ASSET FORM
                    <div className="space-y-4 max-w-xl text-xs font-semibold">
                      <div className="space-y-1.5">
                        <label className="text-muted-foreground">Asset Name</label>
                        <Input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-muted-foreground">Asset Category</label>
                        <select
                          value={editType}
                          onChange={(e) => setEditType(e.target.value)}
                          className="w-full bg-secondary/35 border border-border px-3 py-2 rounded-lg text-foreground focus:outline-none focus:border-primary text-xs font-semibold"
                        >
                          <option value="FORKLIFT">Forklift (Vehicle)</option>
                          <option value="PALLET">Pallet (Inventory)</option>
                          <option value="CONTAINER">Container Box (Cargo)</option>
                          <option value="ENV_SENSOR">Environment Sensor</option>
                          <option value="LIGHT_SWITCH">Smart Light Switch</option>
                          <option value="DOOR_ASSET">Door State Monitor</option>
                          <option value="CITY_BUILDING">City Building node</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-muted-foreground">Description</label>
                        <textarea
                          rows={4}
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          className="w-full bg-secondary/35 border border-border px-3 py-2 rounded-lg text-foreground focus:outline-none focus:border-primary resize-none text-xs font-semibold"
                        />
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button onClick={handleSaveAsset}>
                          <Save className="h-3.5 w-3.5 mr-1" />
                          Save Attributes
                        </Button>
                        <Button onClick={() => setIsEditingAsset(false)} variant="outline">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // ASSET twin details
                    <div className="space-y-6">
                      <div>
                        <h4 className="text-lg font-bold text-foreground">{selectedAsset.name}</h4>
                        <p className="text-xs text-muted-foreground mt-1.5 max-w-2xl leading-relaxed">
                          {selectedAsset.description || 'Peralatan operasional gudang, terhubung ke sensor tag dengan koordinat terpetakan di Floor Plan.'}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4 max-w-2xl text-xs">
                        <div className="bg-secondary/20 border border-border p-4 rounded-xl space-y-1.5">
                          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Asset Category</span>
                          <p className="font-bold text-foreground">{selectedAsset.type}</p>
                        </div>
                        <div className="bg-secondary/20 border border-border p-4 rounded-xl space-y-1.5">
                          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Logical Zone</span>
                          <p className="font-bold text-foreground">{selectedAsset.zone?.name || 'Storage Zone Alpha'}</p>
                        </div>
                      </div>

                      {/* Associated tag */}
                      <div className="border border-border rounded-xl overflow-hidden max-w-2xl bg-secondary/10">
                        <div className="bg-secondary/20 border-b border-border px-4 py-3 flex items-center justify-between text-xs font-semibold">
                          <span className="font-bold text-foreground flex items-center gap-1.5">
                            <Link2 className="h-4 w-4 text-muted-foreground" />
                            Linked Telemetry Tag Binding
                          </span>
                          {selectedAsset.tag ? (
                            <button className="flex items-center gap-1 text-red-500 hover:text-red-400 font-bold">
                              <Unlink className="h-3.5 w-3.5" />
                              Unlink Tag
                            </button>
                          ) : (
                            <button className="flex items-center gap-1 text-foreground hover:text-muted-foreground font-bold">
                              <Link2 className="h-3.5 w-3.5" />
                              Link Tag
                            </button>
                          )}
                        </div>
                        <div className="p-4 text-xs font-semibold space-y-2">
                          {selectedAsset.tag ? (
                            <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-muted-foreground">
                              <div>Hardware MAC / Node ID:</div>
                              <div className="font-mono text-foreground">{selectedAsset.tag.id}</div>
                              <div>Protocol Pathway:</div>
                              <div className="text-foreground font-mono">MQTT Integration Agent</div>
                              <div>Battery Discharge:</div>
                              <div className="text-foreground">{selectedAsset.tag.battery ?? '--'} V</div>
                              <div>Ambient Temperature:</div>
                              <div className="text-foreground">{selectedAsset.tag.temperature ?? '--'} °C</div>
                            </div>
                          ) : (
                            <p className="text-muted-foreground text-center py-4">No sensor tag linked to this asset.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-center text-xs text-muted-foreground py-12">
                  No assets registered. Select an asset from the tree.
                </p>
              )}
            </CardContent>
          </>
        ) : (
          /* ==================== AGENT DETAILS VIEW ==================== */
          <>
            <CardHeader className="py-4 flex flex-row items-center justify-between border-b">
              <CardTitle className="flex items-center gap-2">
                <Radio className="h-4.5 w-4.5 text-muted-foreground" />
                Agent Connection Parameters
              </CardTitle>
              {selectedAgent && (
                <Button
                  onClick={() => toggleAgentConnection(selectedAgent.id)}
                  variant={selectedAgent.status === 'Connected' ? 'outline' : 'default'}
                  className="h-8 text-[11px] font-bold"
                >
                  {selectedAgent.status === 'Connected' ? 'Disconnect' : 'Connect'}
                </Button>
              )}
            </CardHeader>

            <CardContent className="p-6 space-y-6 flex-1 overflow-y-auto pt-6 text-xs font-semibold">
              {selectedAgent ? (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-lg font-bold text-foreground">{selectedAgent.name}</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Handles connection and telemetry decoding for the **{selectedAgent.protocol}** pipeline.
                      </p>
                    </div>
                    <Badge variant={selectedAgent.status === 'Connected' ? 'success' : 'secondary'}>
                      {selectedAgent.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4 max-w-2xl">
                    <div className="bg-secondary/20 border border-border p-4 rounded-xl space-y-1">
                      <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Data Throughput</span>
                      <p className="font-bold text-foreground font-mono text-sm">{selectedAgent.msgRate}</p>
                    </div>
                    <div className="bg-secondary/20 border border-border p-4 rounded-xl space-y-1">
                      <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Protocol Driver</span>
                      <p className="font-bold text-foreground font-mono text-sm">{selectedAgent.protocol}</p>
                    </div>
                  </div>

                  {/* Config settings */}
                  <div className="max-w-2xl border border-border rounded-xl p-5 bg-secondary/10 space-y-4">
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className="font-bold text-foreground flex items-center gap-1.5">
                        <HardDrive className="h-4 w-4 text-muted-foreground" />
                        Driver Settings
                      </span>
                      {!isEditingAgent ? (
                        <button
                          onClick={() => {
                            setEditAgentUrl(selectedAgent.brokerUrl);
                            setEditAgentUser(selectedAgent.username);
                            setIsEditingAgent(true);
                          }}
                          className="text-foreground hover:text-muted-foreground font-bold flex items-center gap-1"
                        >
                          <Edit className="h-3 w-3" /> Edit
                        </button>
                      ) : (
                        <button
                          onClick={() => setIsEditingAgent(false)}
                          className="text-muted-foreground hover:text-foreground font-bold"
                        >
                          Batal
                        </button>
                      )}
                    </div>

                    {isEditingAgent ? (
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-muted-foreground">Host URI / Port</label>
                          <Input
                            value={editAgentUrl}
                            onChange={(e) => setEditAgentUrl(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-muted-foreground">Driver Username / Client Key</label>
                          <Input
                            value={editAgentUser}
                            onChange={(e) => setEditAgentUser(e.target.value)}
                          />
                        </div>
                        <Button onClick={handleSaveAgent} className="h-8.5">
                          <Save className="h-3.5 w-3.5 mr-1" />
                          Apply Driver Config
                        </Button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-y-2 text-muted-foreground">
                        <div>Server Endpoint:</div>
                        <div className="font-mono text-foreground">{selectedAgent.brokerUrl}</div>
                        <div>Client Authorization:</div>
                        <div className="font-mono text-foreground">{selectedAgent.username || '(None)'}</div>
                      </div>
                    )}
                  </div>

                  {/* Active node links */}
                  <div className="max-w-2xl border border-border rounded-xl overflow-hidden bg-secondary/5">
                    <div className="bg-secondary/20 border-b border-border px-4 py-3 flex items-center justify-between font-bold">
                      <span className="flex items-center gap-1.5">
                        <Cpu className="h-4 w-4 text-muted-foreground" />
                        Active Subscribed Telemetry Nodes
                      </span>
                      <Badge variant="secondary" className="font-mono font-bold text-[10px]">
                        {selectedAgent.activeNodes.length} Nodes
                      </Badge>
                    </div>
                    <div className="p-4 space-y-1.5">
                      {selectedAgent.activeNodes.length > 0 ? (
                        selectedAgent.activeNodes.map((node) => (
                          <div key={node} className="flex items-center justify-between p-2 bg-secondary/35 border border-border/60 rounded-lg">
                            <span className="font-mono font-bold text-foreground">{node}</span>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                              <RefreshCw className="h-3 w-3 animate-spin text-emerald-400" />
                              Active telemetry feed
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-muted-foreground text-center py-4">No active node pings flowing through this protocol agent.</p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground text-center py-12">Select an integration agent to configure.</p>
              )}
            </CardContent>
          </>
        )}
      </Card>

    </div>
  );
}
