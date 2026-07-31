'use client';

import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Plus, 
  ToggleLeft, 
  ToggleRight, 
  Play, 
  Trash, 
  Mail, 
  Bell, 
  Server 
} from 'lucide-react';

interface Rule {
  id: string;
  name: string;
  triggerType: string;
  condition: string;
  action: string;
  isActive: boolean;
}

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([
    {
      id: 'rule-1',
      name: 'Forklift Collision Detection',
      triggerType: 'ACCELERATION_HARD_COLLISION',
      condition: 'Z-Axis deceleration > 12m/s²',
      action: 'Raise Critical Fall Alert & Log to DB',
      isActive: true,
    },
    {
      id: 'rule-2',
      name: 'Critical Freezer Temp Check',
      triggerType: 'TEMPERATURE_THRESHOLD',
      condition: 'Ambient temperature > 8 °C for 5 min',
      action: 'Send Email warning & trigger SMS broadcast',
      isActive: true,
    },
    {
      id: 'rule-3',
      name: 'Asset Tag Low Battery Warnings',
      triggerType: 'BATTERY_LOW',
      condition: 'Battery voltage < 2.8 V',
      action: 'Raise Warning Alert and mark for Maintenance',
      isActive: false,
    }
  ]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [trigger, setTrigger] = useState('TEMPERATURE');
  const [condition, setCondition] = useState('');
  const [action, setAction] = useState('ALERT');

  const handleToggle = (id: string) => {
    setRules((prev) => 
      prev.map((r) => (r.id === id ? { ...r, isActive: !r.isActive } : r))
    );
  };

  const handleAddRule = () => {
    if (!ruleName) return;
    const newRule: Rule = {
      id: `rule-${Date.now()}`,
      name: ruleName,
      triggerType: trigger,
      condition: condition || 'Default criteria',
      action: action === 'ALERT' ? 'Raise System Alert' : 'Send Webhook/Email notify',
      isActive: true,
    };
    setRules((prev) => [...prev, newRule]);
    setRuleName('');
    setCondition('');
    setShowAddModal(false);
  };

  const handleDelete = (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER CONTROLS */}
      <div className="flex items-center justify-between bg-card border border-border p-4 rounded-xl shadow-sm">
        <div>
          <h2 className="text-base font-bold flex items-center gap-2">
            <ShieldAlert className="h-4.5 w-4.5 text-primary" />
            Mesh Automation Rules
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure automatic alert triggers and actions when sensor thresholds are breached.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/95 transition-all shadow-md shadow-primary/20"
        >
          <Plus className="h-4 w-4" />
          Create Flow Rule
        </button>
      </div>

      {/* RULE EDITOR MODAL / FORM */}
      {showAddModal && (
        <div className="glass-panel p-5 rounded-xl border max-w-xl text-xs font-semibold space-y-4">
          <h3 className="text-sm font-bold border-b border-border pb-2 text-primary">New Flow Rule</h3>
          
          <div className="space-y-1.5">
            <label className="text-muted-foreground">Rule Name</label>
            <input
              type="text"
              placeholder="e.g. Freezer Thermal Warning"
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              className="w-full bg-secondary/40 border border-border px-3 py-2 rounded-lg text-foreground focus:outline-none focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-muted-foreground">Trigger Event</label>
              <select
                value={trigger}
                onChange={(e) => setTrigger(e.target.value)}
                className="w-full bg-secondary/40 border border-border px-3 py-2 rounded-lg text-foreground focus:outline-none"
              >
                <option value="TEMPERATURE">Temperature threshold</option>
                <option value="BATTERY">Low Battery limit</option>
                <option value="TILT">Orientation angle warning</option>
                <option value="FALL">Collision/Impact event</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-muted-foreground">Target Action</label>
              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
                className="w-full bg-secondary/40 border border-border px-3 py-2 rounded-lg text-foreground focus:outline-none"
              >
                <option value="ALERT">System Alert Banner</option>
                <option value="EMAIL">Send Email / Webhook</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-muted-foreground">Threshold Condition</label>
            <input
              type="text"
              placeholder="e.g. value > 30 for 10s"
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className="w-full bg-secondary/40 border border-border px-3 py-2 rounded-lg text-foreground focus:outline-none focus:border-primary"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleAddRule}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/95 transition-all"
            >
              Add Rule
            </button>
            <button
              onClick={() => setShowAddModal(false)}
              className="rounded-lg border border-border bg-card px-4 py-2 text-muted-foreground hover:bg-secondary/50 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* RULES LIST TABLE */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-border bg-secondary/20 text-muted-foreground font-semibold">
                <th className="px-6 py-3.5">Rule Name</th>
                <th className="px-6 py-3.5">Trigger Class</th>
                <th className="px-6 py-3.5">Threshold Logic</th>
                <th className="px-6 py-3.5">Action Handler</th>
                <th className="px-6 py-3.5 text-center">Status</th>
                <th className="px-6 py-3.5 text-right">Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-semibold">
              {rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-secondary/15">
                  <td className="px-6 py-4 font-bold text-foreground">{rule.name}</td>
                  <td className="px-6 py-4 text-muted-foreground">
                    <span className="bg-secondary/50 border border-border px-2 py-0.5 rounded font-mono text-[10px]">
                      {rule.triggerType}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-cyan-400">{rule.condition}</td>
                  <td className="px-6 py-4 text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    {rule.action.includes('Email') ? (
                      <Mail className="h-3.5 w-3.5 text-amber-400" />
                    ) : (
                      <Bell className="h-3.5 w-3.5 text-primary" />
                    )}
                    {rule.action}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button onClick={() => handleToggle(rule.id)} className="transition-all">
                      {rule.isActive ? (
                        <ToggleRight className="h-6 w-6 text-primary" />
                      ) : (
                        <ToggleLeft className="h-6 w-6 text-muted-foreground" />
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDelete(rule.id)}
                      className="text-muted-foreground hover:text-red-400 transition-all p-1"
                    >
                      <Trash className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
