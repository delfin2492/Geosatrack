'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getApiUrl } from '../../lib/api';
import { Trash2, Filter, Bell, Mail, Send, AlertTriangle, ShieldAlert, Activity, CheckCircle2 } from 'lucide-react';
import ConfirmModal from '../../components/ConfirmModal';

export default function NotificationsPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const { token, tenantId, isAdmin } = useAuth();

  const getHeaders = () => {
    const headers: Record<string, string> = {};
    if (tenantId) headers['x-tenant-id'] = tenantId;
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  useEffect(() => {
    if (tenantId || token) fetchHistory();
  }, [tenantId, token, startDate, endDate]);

  const fetchHistory = async () => {
    if (!tenantId && !token) return;
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (startDate) query.append('startDate', startDate);
      if (endDate) query.append('endDate', endDate);

      const res = await fetch(`${getApiUrl()}/alerts?${query.toString()}`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  const deleteAlert = async (id: string) => {
    if (!tenantId && !token) return;
    try {
      const res = await fetch(`${getApiUrl()}/alerts/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (res.ok) {
        setHistory(prev => prev.filter(a => a.id !== id));
      }
    } catch (err) {}
  };

  const clearAllHistory = async () => {
    if (!tenantId && !token) return;

    try {
      const res = await fetch(`${getApiUrl()}/alerts`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (res.ok) {
        setHistory([]);
      }
    } catch (err) {}
    setShowClearConfirm(false);
  };

  const renderTypeBadge = (type: string) => {
    const t = type?.toLowerCase() || '';

    if (t === 'email') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-500 text-xs font-semibold border border-blue-500/20">
          <Mail className="h-3.5 w-3.5" /> Email
        </span>
      );
    }

    if (t === 'telegram') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/10 text-sky-500 text-xs font-semibold border border-sky-500/20">
          <Send className="h-3.5 w-3.5" /> Telegram
        </span>
      );
    }

    if (t === 'fall_detected') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-500 text-xs font-semibold border border-rose-500/20">
          <ShieldAlert className="h-3.5 w-3.5" /> Fall Detected
        </span>
      );
    }

    if (t === 'tilt_warning') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 text-xs font-semibold border border-amber-500/20">
          <AlertTriangle className="h-3.5 w-3.5" /> Tilt Warning
        </span>
      );
    }

    if (t === 'sensor_critical' || t === 'temperature_critical') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-500 text-xs font-semibold border border-purple-500/20">
          <Activity className="h-3.5 w-3.5" /> Sensor Alert
        </span>
      );
    }

    // Default for alert_alarm, alarm, geofence_violation, etc.
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-500 text-xs font-semibold border border-rose-500/20">
        <Bell className="h-3.5 w-3.5" /> Alert Alarm
      </span>
    );
  };

  const resolveAlert = async (id: string) => {
    if (!tenantId && !token) return;
    try {
      const res = await fetch(`${getApiUrl()}/alerts/${id}/resolve`, {
        method: 'POST',
        headers: getHeaders()
      });
      if (res.ok) {
        setHistory(prev => prev.map(a => a.id === id ? { ...a, isResolved: true, resolvedAt: new Date().toISOString() } : a));
      }
    } catch (err) {}
  };

  const renderStatusBadge = (item: any) => {
    const isResolved = item.isResolved || item.type === 'alert_recovery' || (item.message && item.message.includes('RECOVERED'));

    if (isResolved) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-bold border border-emerald-500/20">
          <CheckCircle2 className="h-3.5 w-3.5" /> RESOLVED / CLEARED
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-500 text-xs font-bold border border-rose-500/20 animate-pulse">
        <AlertTriangle className="h-3.5 w-3.5" /> ACTIVE ALARM
      </span>
    );
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />
            Notifications & Alarm History
          </h2>
          <p className="text-muted-foreground text-sm">Monitor live alarms, active warnings, and auto-recovered statuses</p>
        </div>

        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2 bg-card border border-border p-1.5 rounded-lg">
            <Filter className="h-4 w-4 text-muted-foreground ml-1" />
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="px-2 py-1 text-xs rounded bg-secondary/50 text-foreground border-none outline-none"
            />
            <span className="text-muted-foreground text-xs">-</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="px-2 py-1 text-xs rounded bg-secondary/50 text-foreground border-none outline-none"
            />
          </div>

          {isAdmin && history.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="px-4 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 font-semibold text-xs flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              Clear All Data
            </button>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-auto bg-card rounded-xl border border-border shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm animate-pulse">
            Loading notifications...
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-sm gap-2">
            <Bell className="h-8 w-8 text-muted-foreground/30" />
            <span>No notifications found in this time range.</span>
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-card sticky top-0 z-10 border-b border-border shadow-sm">
              <tr className="bg-card">
                <th className="px-6 py-4 font-semibold text-muted-foreground w-44 bg-card">Timestamp</th>
                <th className="px-6 py-4 font-semibold text-muted-foreground w-40 bg-card">Status Alarm</th>
                <th className="px-6 py-4 font-semibold text-muted-foreground w-36 bg-card">Channel</th>
                <th className="px-6 py-4 font-semibold text-muted-foreground bg-card">Message</th>
                <th className="px-6 py-4 font-semibold text-muted-foreground text-right w-32 bg-card">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {history.map(item => {
                const isResolved = item.isResolved || item.type === 'alert_recovery' || (item.message && item.message.includes('RECOVERED'));

                return (
                  <tr key={item.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(item.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {renderStatusBadge(item)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {renderTypeBadge(item.type)}
                    </td>
                    <td className="px-6 py-4 font-medium text-foreground">
                      {item.message}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {!isResolved && (
                          <button
                            onClick={() => resolveAlert(item.id)}
                            className="px-2 py-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            title="Mark alarm as resolved"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => deleteAlert(item.id)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 transition-colors cursor-pointer"
                            title="Delete notification"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Custom Confirm Modal for Clear All */}
      <ConfirmModal
        isOpen={showClearConfirm}
        title="Clear All Notifications"
        message="Are you sure you want to delete ALL notification history? This action cannot be undone."
        confirmText="Delete All"
        cancelText="Cancel"
        variant="danger"
        onConfirm={clearAllHistory}
        onCancel={() => setShowClearConfirm(false)}
      />
    </div>
  );
}
