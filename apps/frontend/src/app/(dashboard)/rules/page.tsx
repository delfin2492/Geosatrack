'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableRow, 
  TableHead, 
  TableCell 
} from '../../components/ui/table';
import { 
  ShieldAlert, 
  Plus, 
  ToggleLeft, 
  ToggleRight, 
  Trash, 
  Mail, 
  Bell 
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
      <Card>
        <div className="flex items-center justify-between p-4">
          <div>
            <h2 className="text-sm font-bold flex items-center gap-2">
              <ShieldAlert className="h-4.5 w-4.5 text-primary" />
              Mesh Automation Rules
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Configure automatic alert triggers and actions when sensor thresholds are breached.
            </p>
          </div>
          <Button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Create Flow Rule
          </Button>
        </div>
      </Card>

      {/* RULE EDITOR FORM */}
      {showAddModal && (
        <Card className="max-w-xl">
          <CardHeader className="py-4">
            <CardTitle className="text-primary">New Flow Rule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6 text-xs font-semibold">
            <div className="space-y-1.5">
              <label className="text-muted-foreground">Rule Name</label>
              <Input
                type="text"
                placeholder="e.g. Freezer Thermal Warning"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-muted-foreground">Trigger Event</label>
                <select
                  value={trigger}
                  onChange={(e) => setTrigger(e.target.value)}
                  className="w-full bg-secondary/35 border border-border px-3 py-2 rounded-lg text-foreground focus:outline-none focus:border-primary text-xs font-semibold"
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
                  className="w-full bg-secondary/35 border border-border px-3 py-2 rounded-lg text-foreground focus:outline-none focus:border-primary text-xs font-semibold"
                >
                  <option value="ALERT">System Alert Banner</option>
                  <option value="EMAIL">Send Email / Webhook</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-muted-foreground">Threshold Condition</label>
              <Input
                type="text"
                placeholder="e.g. value > 30 for 10s"
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleAddRule}>
                Add Rule
              </Button>
              <Button
                onClick={() => setShowAddModal(false)}
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* RULES LIST TABLE */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rule Name</TableHead>
              <TableHead>Trigger Class</TableHead>
              <TableHead>Threshold Logic</TableHead>
              <TableHead>Action Handler</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Delete</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell className="font-bold text-foreground">{rule.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {rule.triggerType}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-cyan-400">{rule.condition}</TableCell>
                <TableCell className="text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    {rule.action.includes('Email') ? (
                      <Mail className="h-3.5 w-3.5 text-amber-400" />
                    ) : (
                      <Bell className="h-3.5 w-3.5 text-primary" />
                    )}
                    {rule.action}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <button onClick={() => handleToggle(rule.id)} className="transition-all cursor-pointer">
                    {rule.isActive ? (
                      <ToggleRight className="h-6 w-6 text-primary" />
                    ) : (
                      <ToggleLeft className="h-6 w-6 text-muted-foreground" />
                    )}
                  </button>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    onClick={() => handleDelete(rule.id)}
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-red-400"
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
