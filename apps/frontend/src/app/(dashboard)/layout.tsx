'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';
import { 
  Boxes, 
  Map, 
  Activity, 
  ShieldAlert, 
  LogOut, 
  User, 
  Shield,
  Sun,
  Moon,
  Building2,
  ChevronRight,
  Crown
} from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { authenticated, initialized, username, role, isSuperAdmin, tenantId, tenantName, logout } = useAuth();
  const { socketStatus } = useSocket();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    if (initialized && !authenticated) {
      router.replace('/login');
    }
  }, [initialized, authenticated, router]);

  if (!initialized || !authenticated) {
    return (
      <div className="h-screen w-screen bg-background flex flex-col items-center justify-center space-y-3 font-sans text-foreground">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono text-muted-foreground">Memeriksa Sesi Autentikasi...</span>
      </div>
    );
  }

  const baseNavigation = [
    { name: 'Map View', href: '/map', icon: Map },
    { name: 'Assets', href: '/assets', icon: Boxes },
    { name: 'Automation Rules', href: '/rules', icon: ShieldAlert },
    { name: 'Insights', href: '/insights', icon: Activity },
  ];

  // Include Tenants page for Superadmin
  const navigation = isSuperAdmin
    ? [...baseNavigation, { name: 'Tenants Manager', href: '/tenants', icon: Building2 }]
    : baseNavigation;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground font-sans">
      
      {/* SIDEBAR (OpenRemote Inspired) */}
      <aside className="w-64 bg-card border-r border-border flex flex-col justify-between shrink-0">
        <div>
          {/* Logo Brand */}
          <div className="h-16 flex items-center gap-3 px-6 border-b border-border">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/30">
              <Boxes className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
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
                      ? 'bg-primary/10 border-primary/20 text-primary shadow-sm' 
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
        <div className="p-4 border-t border-border bg-card/45 space-y-3">
          {/* Theme Toggler Button */}
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-card hover:bg-secondary text-xs font-semibold text-muted-foreground hover:text-foreground transition-all cursor-pointer"
          >
            <span className="flex items-center gap-2">
              {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">Switch</span>
          </button>

          <div className="space-y-3">
            {/* Tenant Badge */}
            <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 space-y-1">
              <div className="flex items-center justify-between text-[10px] text-primary font-bold uppercase tracking-wider">
                <span className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  Active Tenant
                </span>
                <Link href="/login" className="hover:underline flex items-center gap-0.5 text-muted-foreground hover:text-foreground">
                  Switch <ChevronRight className="h-2.5 w-2.5" />
                </Link>
              </div>
              <div className="text-xs font-bold truncate text-foreground">
                {tenantName || tenantId || 'PT ABC Logistics'}
              </div>
            </div>

            {/* User Account */}
            <div className="flex items-center gap-3 px-2 py-1.5 bg-secondary/35 rounded-lg border border-border/50">
              <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0 relative">
                {username?.charAt(0).toUpperCase() || 'U'}
                {isSuperAdmin && (
                  <Crown className="h-3 w-3 text-amber-400 absolute -top-1 -right-1" />
                )}
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-xs font-bold truncate text-foreground flex items-center gap-1">
                  <User className="h-3 w-3 text-muted-foreground" />
                  {username}
                </span>
                <span className="text-[9px] font-mono text-muted-foreground capitalize truncate">
                  Role: {role || 'operator'}
                </span>
              </div>
            </div>

            <button
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-border bg-card hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 text-xs font-semibold text-muted-foreground transition-all cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
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
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-zinc-400`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${
                  socketStatus === 'connected' ? 'bg-foreground' : 'bg-muted-foreground'
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
