'use client';

import React, { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { X, BellRing } from 'lucide-react';

export default function GlobalAlerts() {
  const { alerts } = useSocket();
  const [activeToasts, setActiveToasts] = useState<any[]>([]);

  useEffect(() => {
    if (alerts.length > 0) {
      const latestAlert = alerts[0]; // SocketContext prepends new alerts to the front (index 0)
      
      // Check if we already showed this alert
      if (!activeToasts.find(t => t.id === latestAlert.id)) {
        const newToast = {
          ...latestAlert,
          showTime: Date.now()
        };
        setActiveToasts(prev => [newToast, ...prev].slice(0, 5)); // Keep max 5 toasts

        // Auto-dismiss after 10 seconds
        setTimeout(() => {
          setActiveToasts(current => current.filter(t => t.id !== latestAlert.id));
        }, 10000);
      }
    }
  }, [alerts]);

  const dismissToast = (id: string) => {
    setActiveToasts(prev => prev.filter(t => t.id !== id));
  };

  if (activeToasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col-reverse gap-3 pointer-events-none">
      {activeToasts.map(toast => (
        <div 
          key={toast.id}
          className="pointer-events-auto w-80 bg-red-500/10 border-2 border-red-500/30 rounded-xl p-4 shadow-2xl backdrop-blur-md flex items-start gap-3 animate-in slide-in-from-right-8 fade-in duration-300"
        >
          <div className="h-8 w-8 shrink-0 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/50 mt-0.5">
            <BellRing className="h-4 w-4 text-red-500 animate-pulse" />
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-start justify-between">
              <h4 className="text-xs font-bold text-red-500 uppercase tracking-wider">System Alarm</h4>
              <button 
                onClick={() => dismissToast(toast.id)}
                className="text-red-400 hover:text-red-300 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-foreground/90 font-medium leading-relaxed">
              {toast.message}
            </p>
            <div className="text-[9px] text-red-500/70 font-mono pt-1">
              {new Date(toast.createdAt || Date.now()).toLocaleTimeString()}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
