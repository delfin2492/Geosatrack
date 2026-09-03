'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Bell, X, Trash2, Mail, Send, AlertTriangle, ShieldAlert, Activity, ExternalLink, Check } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { getApiUrl } from '../lib/api';
import Link from 'next/link';
import ConfirmModal from './ConfirmModal';

export default function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Keep track of dismissed notifications locally so they disappear from dropdown but stay in DB
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('geomesh_dismissed_notifications');
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  const { socket } = useSocket();
  const { token, tenantId, isAdmin } = useAuth();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch 10 latest notifications when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchLatestNotifications();
    }
  }, [isOpen, tenantId]);

  // Listen to new incoming alerts via WebSockets to automatically prepend
  useEffect(() => {
    if (!socket) return;
    const handleNewAlert = (newAlert: any) => {
      setHistory(prev => {
        if (dismissedIds.includes(newAlert.id)) return prev;
        return [newAlert, ...prev.filter(a => a.id !== newAlert.id)].slice(0, 10);
      });
    };
    socket.on('alertNew', handleNewAlert);
    return () => {
      socket.off('alertNew', handleNewAlert);
    };
  }, [socket, dismissedIds]);

  const getHeaders = () => {
    const headers: Record<string, string> = {};
    if (tenantId) headers['x-tenant-id'] = tenantId;
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const fetchLatestNotifications = async () => {
    if (!tenantId && !token) return;
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/alerts`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        const activeData = Array.isArray(data) ? data.filter(item => !dismissedIds.includes(item.id)) : [];
        setHistory(activeData.slice(0, 10));
      }
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  // Dismiss notification from dropdown ONLY (does NOT delete from Full History in database)
  const handleDismissItem = (id: string) => {
    setDismissedIds(prev => {
      const next = [...new Set([...prev, id])];
      if (typeof window !== 'undefined') {
        localStorage.setItem('geomesh_dismissed_notifications', JSON.stringify(next));
      }
      return next;
    });
    setHistory(prev => prev.filter(a => a.id !== id));
  };

  // Dismiss ALL current items from dropdown ONLY (does NOT delete from Full History in database)
  const handleDismissAll = () => {
    const currentIds = history.map(item => item.id);
    setDismissedIds(prev => {
      const next = [...new Set([...prev, ...currentIds])];
      if (typeof window !== 'undefined') {
        localStorage.setItem('geomesh_dismissed_notifications', JSON.stringify(next));
      }
      return next;
    });
    setHistory([]);
    setShowClearConfirm(false);
  };

  const renderTypeIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'email':
        return <Mail className="h-3.5 w-3.5 text-blue-500" />;
      case 'telegram':
        return <Send className="h-3.5 w-3.5 text-sky-500" />;
      case 'fall_detected':
        return <ShieldAlert className="h-3.5 w-3.5 text-rose-500" />;
      case 'tilt_warning':
        return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />;
      case 'sensor_critical':
      case 'temperature_critical':
        return <Activity className="h-3.5 w-3.5 text-purple-500" />;
      case 'alert_alarm':
      case 'alarm':
      case 'geofence_violation':
      default:
        return <Bell className="h-3.5 w-3.5 text-rose-500" />;
    }
  };

  const getTypeName = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'email': return 'Email';
      case 'telegram': return 'Telegram';
      case 'fall_detected': return 'Fall Detected';
      case 'tilt_warning': return 'Tilt Warning';
      case 'low_battery': return 'Low Battery';
      case 'sensor_critical':
      case 'temperature_critical': return 'Sensor Alert';
      case 'alert_alarm':
      case 'alarm':
      case 'geofence_violation':
      default: return 'Alert Alarm';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg border border-border bg-secondary hover:bg-secondary/80 text-foreground transition-all cursor-pointer flex items-center justify-center relative"
        title="Notifications"
      >
        <Bell className="h-4 w-4" />
        {history.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-bold h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center border-2 border-card">
            {history.length > 99 ? '99+' : history.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-84 sm:w-96 max-h-[80vh] bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden z-[99999] animate-in slide-in-from-top-2 fade-in duration-200">
          {/* Header */}
          <div className="p-3.5 border-b border-border flex items-center justify-between bg-secondary/30 shrink-0">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold tracking-tight">Notifications</h3>
              <span className="text-[11px] text-muted-foreground">({history.length})</span>
            </div>
            {history.length > 0 && (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="text-xs text-rose-500 hover:text-rose-400 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                title="Clear notifications from dropdown"
              >
                <Trash2 className="h-3 w-3" />
                Clear All
              </button>
            )}
          </div>

          {/* List - 10 Latest */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 max-h-[380px] scrollbar-thin">
            {loading ? (
              <div className="p-6 text-center text-xs text-muted-foreground animate-pulse">Loading notifications...</div>
            ) : history.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                <Bell className="h-6 w-6 text-muted-foreground/40" />
                <span>No new notifications</span>
              </div>
            ) : (
              history.map(item => (
                <div
                  key={item.id}
                  className="p-3 rounded-lg border border-border bg-secondary/20 hover:bg-secondary/40 transition-colors flex gap-2.5 items-start group"
                >
                  <div className="p-1.5 rounded-md bg-card border border-border shrink-0 mt-0.5">
                    {renderTypeIcon(item.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {getTypeName(item.type)}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-xs font-medium text-foreground leading-snug break-words">
                      {item.message}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDismissItem(item.id)}
                    className="p-1 rounded text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors shrink-0 opacity-80 group-hover:opacity-100 cursor-pointer"
                    title="Dismiss notification"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer Link to Full Page */}
          <div className="p-2.5 border-t border-border bg-secondary/20 flex items-center justify-center shrink-0">
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1.5 py-0.5"
            >
              <span>View Full History</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}

      {/* Custom Confirm Modal for Clear All */}
      <ConfirmModal
        isOpen={showClearConfirm}
        title="Clear Dropdown Notifications"
        message="Are you sure you want to clear all notifications from this dropdown? The full history will still be preserved in the Notifications History page."
        confirmText="Clear Dropdown"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleDismissAll}
        onCancel={() => setShowClearConfirm(false)}
      />
    </div>
  );
}
