'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Building2,
  Plus,
  Crown,
  Users,
  MapPin,
  Boxes,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Search,
} from 'lucide-react';

interface TenantItem {
  id: string;
  name: string;
  createdAt?: string;
  _count?: {
    sites: number;
    assets: number;
    users: number;
  };
}

export default function TenantsPage() {
  const { isSuperAdmin, tenantId, switchTenantContext } = useAuth();

  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal & Form states
  const [showModal, setShowModal] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('admin123');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [msgError, setMsgError] = useState<string | null>(null);
  const [msgSuccess, setMsgSuccess] = useState<string | null>(null);

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
      const res = await fetch(`${apiUrl}/tenants`);
      if (res.ok) {
        const data = await res.json();
        setTenants(data);
      }
    } catch (err) {
      console.error('Failed to fetch tenants:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsgError(null);
    setMsgSuccess(null);

    if (!companyName || !adminName || !adminEmail) {
      setMsgError('Harap lengkapi nama perusahaan, nama admin, dan email admin.');
      return;
    }

    setIsSubmitting(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
      const res = await fetch(`${apiUrl}/tenants/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          adminName,
          adminEmail,
          password: adminPassword,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.message || 'Gagal mendaftarkan tenant.');
      }

      setMsgSuccess(`Tenant "${result.tenant.name}" dan akun Admin "${result.user.name}" berhasil dibuat!`);
      setCompanyName('');
      setAdminName('');
      setAdminEmail('');

      fetchTenants();
      setTimeout(() => {
        setShowModal(false);
        setMsgSuccess(null);
      }, 1500);
    } catch (err: any) {
      setMsgError(err.message || 'Terjadi kesalahan saat membuat tenant.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTenants = tenants.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isSuperAdmin) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="p-4 rounded-full bg-destructive/10 text-destructive w-12 h-12 mx-auto flex items-center justify-center">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-foreground">Akses Terbatas (Superadmin Only)</h2>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          Halaman Pengelolaan Tenant hanya dapat diakses oleh akun Superadmin (`superadmin@geomesh.io`).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-card border border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-400/10 text-amber-400 border border-amber-400/20">
              <Crown className="h-4 w-4" />
            </span>
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              Manajemen Multi-Tenant (Superadmin Panel)
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Kelola seluruh organisasi / tenant terdaftar, buat akun admin baru, dan alihkan konteks tampilan.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchTenants}
            className="px-3.5 py-2 rounded-xl border border-border bg-secondary/50 hover:bg-secondary text-xs font-semibold text-foreground flex items-center gap-2 transition-all cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs shadow-md shadow-primary/20 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Buat Tenant & Admin Baru
          </button>
        </div>
      </div>

      {/* Search Filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama tenant / perusahaan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all placeholder:text-muted-foreground"
          />
        </div>
        <div className="text-xs text-muted-foreground font-mono">
          Total: <span className="text-foreground font-bold">{tenants.length}</span> Tenant
        </div>
      </div>

      {/* Tenants Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredTenants.map((t) => {
          const isCurrent = t.id === tenantId;
          return (
            <div
              key={t.id}
              className={`p-5 rounded-2xl border bg-card transition-all flex flex-col justify-between space-y-4 ${
                isCurrent ? 'border-primary shadow-md shadow-primary/10' : 'border-border hover:border-border/80'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">{t.name}</h3>
                      <p className="text-[10px] font-mono text-muted-foreground">ID: {t.id}</p>
                    </div>
                  </div>

                  {isCurrent && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-bold text-emerald-400">
                      Active
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 py-2 border-y border-border/60">
                  <div className="text-center">
                    <span className="text-[10px] text-muted-foreground font-mono block">Sites</span>
                    <span className="text-xs font-bold text-foreground">{t._count?.sites ?? 1}</span>
                  </div>
                  <div className="text-center border-x border-border/60">
                    <span className="text-[10px] text-muted-foreground font-mono block">Assets</span>
                    <span className="text-xs font-bold text-foreground">{t._count?.assets ?? 2}</span>
                  </div>
                  <div className="text-center">
                    <span className="text-[10px] text-muted-foreground font-mono block">Users</span>
                    <span className="text-xs font-bold text-foreground">{t._count?.users ?? 2}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => switchTenantContext(t.id, t.name)}
                disabled={isCurrent}
                className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  isCurrent
                    ? 'bg-secondary/40 text-muted-foreground border border-border cursor-default'
                    : 'bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30'
                }`}
              >
                <span>{isCurrent ? 'Konteks Tampilan Aktif' : 'Alihkan Tampilan ke Tenant Ini'}</span>
                {!isCurrent && <ArrowRight className="h-3.5 w-3.5" />}
              </button>
            </div>
          );
        })}
      </div>

      {/* CREATE TENANT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 w-full max-w-lg shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Building2 className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-foreground">Buat Tenant & Admin Baru</h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-xs text-muted-foreground hover:text-foreground font-mono p-1"
              >
                ✕
              </button>
            </div>

            {msgError && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{msgError}</span>
              </div>
            )}
            {msgSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{msgSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateTenant} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Nama Perusahaan / Tenant *
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                  placeholder="misal: PT Borneo Mining Logistik"
                  className="w-full bg-secondary/30 border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary placeholder:text-muted-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Nama Administrator *
                </label>
                <input
                  type="text"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  required
                  placeholder="misal: Eko Prasetyo"
                  className="w-full bg-secondary/30 border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary placeholder:text-muted-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Email Admin *
                </label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  required
                  placeholder="eko@borneomining.co.id"
                  className="w-full bg-secondary/30 border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary placeholder:text-muted-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Kata Sandi Admin Default
                </label>
                <input
                  type="text"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  required
                  className="w-full bg-secondary/30 border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs shadow-md shadow-primary/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Memproses...' : 'Simpan & Buat Tenant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
