'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { 
  Boxes, 
  Map, 
  Settings, 
  Activity, 
  ShieldAlert, 
  LogOut, 
  User, 
  Shield 
} from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { authenticated, username, tenantId, login, logout } = useAuth();
  const { socketStatus } = useSocket();

  const navigation = [
    { name: 'Map View', href: '/map', icon: Map },
    { name: 'Assets', href: '/assets', icon: Boxes },
    { name: 'Automation Rules', href: '/rules', icon: ShieldAlert },
    { name: 'Insights', href: '/insights', icon: Activity },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground font-sans">
      
      {/* SIDEBAR (OpenRemote Inspired) */}
      <aside className="w-64 bg-card border-r border-border flex flex-col justify-between shrink-0">
        <div>
          {/* Logo Brand */}
          <div className="h-16 flex items-center gap-3 px-6 border-b border-border">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/30">
              <Boxes className="h-5 w-5 text-primary glow-text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">
                Geomesh
              </h2>
              <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">
                Manager Console
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3.5 px-4 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all border ${
                    isActive 
                      ? 'bg-primary/10 border-primary/20 text-primary glow-text-primary shadow-sm' 
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                  }`}
                >
                  <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Info & Footer */}
        <div className="p-4 border-t border-border bg-card/45">
          {authenticated ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 px-2 py-1.5 bg-secondary/35 rounded-lg border border-border/50">
                <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                  {username?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="text-xs font-bold truncate text-foreground flex items-center gap-1">
                    <User className="h-3 w-3 text-muted-foreground" />
                    {username}
                  </span>
                  <span className="text-[9px] font-mono text-muted-foreground truncate">
                    Tenant: {tenantId}
                  </span>
                </div>
              </div>
              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-border bg-card hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 text-xs font-semibold text-muted-foreground transition-all"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={login}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary hover:bg-primary/90 text-xs font-bold text-primary-foreground transition-all shadow-md shadow-primary/25"
            >
              <Shield className="h-4 w-4" />
              Sign In Portal
            </button>
          )}
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* HEADER BAR */}
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-sm font-bold tracking-wider uppercase text-muted-foreground">
              {navigation.find((item) => item.href === pathname)?.name || 'Console'}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Real-time Connection status */}
            <div className="flex items-center gap-2 rounded-full bg-secondary/55 px-3 py-1 text-xs border border-border">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  socketStatus === 'connected' ? 'bg-emerald-400' : socketStatus === 'connecting' ? 'bg-amber-400' : 'bg-red-400'
                }`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${
                  socketStatus === 'connected' ? 'bg-emerald-500' : socketStatus === 'connecting' ? 'bg-amber-500' : 'bg-red-500'
                }`}></span>
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                Socket: {socketStatus}
              </span>
            </div>
          </div>
        </header>

        {/* PAGE CONTENT CONTAINER */}
        <main className="flex-1 overflow-y-auto p-8 bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
