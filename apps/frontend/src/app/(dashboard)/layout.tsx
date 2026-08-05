'use client';

import React, { useEffect, useState } from 'react';
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
  PenTool,
  ChevronRight,
  X,
  Loader2
} from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { 
    authenticated, 
    initialized, 
    username, 
    role, 
    isSuperAdmin, 
    tenantId, 
    tenantName, 
    isImpersonating, 
    switchTenantContext,
    exitImpersonation, 
    logout 
  } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Impersonation modal popup states
  const [showTenantPopup, setShowTenantPopup] = useState(false);
  const [tenantList, setTenantList] = useState<any[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(false);

  useEffect(() => {
    if (initialized && !authenticated) {
      router.replace('/login');
    }
  }, [initialized, authenticated, router]);

  useEffect(() => {
    if (showTenantPopup) {
      setLoadingTenants(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
      fetch(`${apiUrl}/tenants`)
        .then((res) => res.json())
        .then((data) => {
          setTenantList(data);
          setLoadingTenants(false);
        })
        .catch((err) => {
          console.error('Failed to fetch tenants:', err);
          setLoadingTenants(false);
        });
    }
  }, [showTenantPopup]);

  if (!initialized || !authenticated) {
    return (
      <div className="h-screen w-screen bg-background flex flex-col items-center justify-center space-y-3 font-sans text-foreground">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono text-muted-foreground">Checking authentication session...</span>
      </div>
    );
  }

  const baseNavigation = [
    { name: 'Map View', href: '/map', icon: Map },
    { name: 'Assets', href: '/assets', icon: Boxes },
    { name: 'RTLS Planner', href: '/planner', icon: PenTool },
    { name: 'Automation Rules', href: '/rules', icon: ShieldAlert },
    { name: 'Insights', href: '/insights', icon: Activity },
  ];

  // Dynamic Navigation based on Superadmin status and Impersonation status
  const navigation = isSuperAdmin
    ? (isImpersonating 
        ? [...baseNavigation, { name: 'Tenants Manager', href: '/tenants', icon: Building2 }]
        : [{ name: 'Tenants Manager', href: '/tenants', icon: Building2 }])
    : baseNavigation;

  const handleExitImpersonation = () => {
    exitImpersonation();
    router.push('/tenants');
  };

  const handleSelectTenant = (id: string, name: string) => {
    switchTenantContext(id, name);
    setShowTenantPopup(false);
    router.push('/map');
  };

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
          
          <div className="space-y-3">
            {/* Active Tenant / Impersonation trigger */}
            {isSuperAdmin && !isImpersonating ? (
              // If Superadmin and NOT impersonating, show the view switch button instead of the tenant card
              <button
                onClick={() => setShowTenantPopup(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all cursor-pointer shadow-sm"
              >
                <Building2 className="h-4 w-4" />
                View Tenant Workspace
              </button>
            ) : (
              // Show normal active tenant card for tenant users or active impersonating superadmin
              <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 space-y-2">
                <div className="flex items-center justify-between text-[10px] text-primary font-bold uppercase tracking-wider">
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    Active Tenant
                  </span>
                  {isSuperAdmin && (
                    <button
                      onClick={() => setShowTenantPopup(true)}
                      className="hover:underline flex items-center gap-0.5 text-muted-foreground hover:text-foreground font-semibold cursor-pointer"
                    >
                      Switch
                    </button>
                  )}
                </div>
                <div className="text-xs font-bold truncate text-foreground">
                  {tenantName || tenantId || 'PT ABC Logistics'}
                </div>
                {isSuperAdmin && isImpersonating && (
                  <button
                    onClick={handleExitImpersonation}
                    className="w-full mt-1.5 py-1 px-2 rounded bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-500 border border-yellow-500/30 text-[10px] font-bold uppercase tracking-wide transition-all cursor-pointer text-center"
                  >
                    Exit View
                  </button>
                )}
              </div>
            )}

            {/* User Account */}
            <div className="flex items-center gap-3 px-2 py-1.5 bg-secondary/35 rounded-lg border border-border/50">
              <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0 relative">
                {username?.charAt(0).toUpperCase() || 'U'}
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
            {/* Theme Toggle Button positioned at top-right corner */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-border bg-secondary hover:bg-secondary/80 text-foreground transition-all cursor-pointer flex items-center justify-center"
              title="Toggle Light/Dark Mode"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </header>

        {/* PAGE CONTENT CONTAINER */}
        <main className="flex-1 overflow-y-auto p-8 bg-background">
          {children}
        </main>
      </div>

      {/* TENANT SELECTION POPUP MODAL (Superadmin workspace selection) */}
      {showTenantPopup && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl p-5 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-primary" />
                Select Tenant Workspace
              </span>
              <button
                onClick={() => setShowTenantPopup(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer p-0.5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              {loadingTenants ? (
                <div className="flex items-center justify-center py-6 text-xs text-muted-foreground gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading tenants...
                </div>
              ) : tenantList.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground">
                  No tenants registered.
                </div>
              ) : (
                tenantList.map((t) => {
                  const isCurrent = t.id === tenantId;
                  return (
                    <button
                      key={t.id}
                      onClick={() => handleSelectTenant(t.id, t.name)}
                      className={`w-full text-left px-3 py-2 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                        isCurrent 
                          ? 'bg-primary/10 border-primary/20 text-primary font-bold' 
                          : 'border-border/60 hover:bg-secondary/80 text-foreground'
                      }`}
                    >
                      <div className="truncate">{t.name}</div>
                      <div className="text-[9px] text-muted-foreground font-mono mt-0.5">ID: {t.id}</div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
