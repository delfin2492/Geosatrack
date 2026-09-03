'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { getApiUrl, getBackendUrl } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import {
  Palette,
  Boxes,
  Plus,
  Edit,
  Trash2,
  Search,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  ShieldAlert,
  Image as ImageIcon,
  Sliders,
  MapPin,
  HardDrive,
  Activity,
  Folder,
  Globe,
  Car,
  Cpu,
  Radio,
  Zap,
  Shield,
  Crosshair,
  Truck,
  Wrench,
  Battery,
  Tag,
  Tv,
  Navigation,
  Layers,
  Wifi,
  Database,
  Server,
  Anchor,
  Gauge,
  Compass,
  Eye,
  Settings,
  Flame,
  Sun,
  Wind,
  Thermometer,
  Clock,
  Key,
  Lock,
  Bell,
  Inbox,
  Maximize2,
  Sparkles
} from 'lucide-react';

function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  if (hex.length !== 6) return '#ffffff';
  const r = parseInt(hex.substring(0, 2), 16) || 0;
  const g = parseInt(hex.substring(2, 4), 16) || 0;
  const b = parseInt(hex.substring(4, 6), 16) || 0;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? '#09090b' : '#ffffff';
}

// Icon Map Registry for rendering icon strings
const ICON_MAP: Record<string, React.ElementType> = {
  MapPin,
  HardDrive,
  Activity,
  Boxes,
  Sliders,
  Folder,
  Globe,
  Car,
  Cpu,
  Radio,
  Zap,
  Shield,
  Crosshair,
  Truck,
  Wrench,
  Battery,
  Tag,
  Tv,
  Navigation,
  Layers,
  Wifi,
  Database,
  Server,
  Anchor,
  Gauge,
  Compass,
  Eye,
  Settings,
  Flame,
  Sun,
  Wind,
  Thermometer,
  Clock,
  Key,
  Lock,
  Bell,
  Inbox,
  Maximize2
};

const AVAILABLE_ICONS = Object.keys(ICON_MAP);

const PRESET_COLORS = [
  '#f43f5e', // Rose
  '#ef4444', // Red
  '#f97316', // Orange
  '#d97706', // Amber
  '#eab308', // Yellow
  '#10b981', // Emerald
  '#059669', // Green
  '#06b6d4', // Cyan
  '#0284c7', // Sky
  '#3b82f6', // Blue
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#a855f7', // Purple
  '#ec4899', // Pink
  '#64748b', // Slate
];

interface AssetType {
  id: string;
  code: string;
  name: string;
  icon: string;
  color: string;
  description?: string | null;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function AppearancePage() {
  const { isSuperAdmin, token, user, role, updateSession, tenantId } = useAuth();

  const [activeTab, setActiveTab] = useState<'assetTypes' | 'branding' | 'theme'>('assetTypes');

  const [assetTypes, setAssetTypes] = useState<AssetType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Notifications
  const [msgSuccess, setMsgSuccess] = useState<string | null>(null);
  const [msgError, setMsgError] = useState<string | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<AssetType | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<AssetType | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    icon: 'HardDrive',
    color: '#3b82f6',
    description: '',
  });

  // Branding States
  const [platformLogo, setPlatformLogo] = useState<string | null>(null);
  const [platformFavicon, setPlatformFavicon] = useState<string | null>(null);
  const [themeColor, setThemeColor] = useState<string>('#3b82f6');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingFavicon, setIsUploadingFavicon] = useState(false);
  const [isSavingTheme, setIsSavingTheme] = useState(false);

  const fetchSystemSettings = async () => {
    if (isSuperAdmin) {
      try {
        const res = await fetch(`${getApiUrl()}/system-setting`);
        if (res.ok) {
          const data = await res.json();
          setPlatformLogo(data.platform_logo_url || null);
          setPlatformFavicon(data.platform_favicon_url || null);
          if (data.platform_theme_color) setThemeColor(data.platform_theme_color);
        }
      } catch (e) {
        console.error('Failed to fetch system settings', e);
      }
    } else if (user?.isWhiteLabel) {
      setPlatformLogo(user.tenantLogoUrl || null);
      setPlatformFavicon(user.tenantFaviconUrl || null);
      if (user.tenantThemeColor) setThemeColor(user.tenantThemeColor);
    }
  };

  const fetchAssetTypes = async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`,
      };
      if (tenantId) headers['x-tenant-id'] = tenantId;

      const res = await fetch(`${getApiUrl()}/asset-types`, { headers });
      if (res.ok) {
        const data = await res.json();
        setAssetTypes(data);
      } else {
        throw new Error('Gagal mengambil daftar tipe asset.');
      }
    } catch (err: any) {
      setMsgError(err.message || 'Terjadi kesalahan saat memuat data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin || user?.isWhiteLabel) {
      fetchAssetTypes();
      fetchSystemSettings();
    }
  }, [isSuperAdmin, user?.isWhiteLabel, token]);

  const showNotification = (msg: string, isErr = false) => {
    if (isErr) {
      setMsgError(msg);
      setTimeout(() => setMsgError(null), 4000);
    } else {
      setMsgSuccess(msg);
      setTimeout(() => setMsgSuccess(null), 3000);
    }
  };

  const handleOpenAddModal = () => {
    setEditingType(null);
    setFormData({
      code: '',
      name: '',
      icon: 'HardDrive',
      color: '#3b82f6',
      description: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: AssetType) => {
    setEditingType(item);
    setFormData({
      code: item.code,
      name: item.name,
      icon: item.icon || 'HardDrive',
      color: item.color || '#3b82f6',
      description: item.description || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsgError(null);

    const userRoleHeader = user?.role || 'superadmin';

    try {
      if (editingType) {
        // PATCH
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-user-role': userRoleHeader,
        };
        if (tenantId) headers['x-tenant-id'] = tenantId;

        const res = await fetch(`${getApiUrl()}/asset-types/${editingType.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            name: formData.name,
            icon: formData.icon,
            color: formData.color,
            description: formData.description,
          }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.message || 'Gagal mengupdate tipe asset.');
        }

        showNotification(`Tipe Asset '${formData.name}' berhasil diperbarui!`);
      } else {
        // POST
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-user-role': userRoleHeader,
        };
        if (tenantId) headers['x-tenant-id'] = tenantId;

        const res = await fetch(`${getApiUrl()}/asset-types`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            code: formData.code.toUpperCase().trim(),
            name: formData.name,
            icon: formData.icon,
            color: formData.color,
            description: formData.description,
          }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.message || 'Gagal menambahkan tipe asset baru.');
        }

        showNotification(`Tipe Asset '${formData.name}' berhasil ditambahkan!`);
      }

      setIsModalOpen(false);
      fetchAssetTypes();
    } catch (err: any) {
      showNotification(err.message || 'Terjadi kesalahan saat menyimpan.', true);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const userRoleHeader = user?.role || 'superadmin';

    try {
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`,
        'x-user-role': userRoleHeader,
      };
      if (tenantId) headers['x-tenant-id'] = tenantId;

      const res = await fetch(`${getApiUrl()}/asset-types/${deleteTarget.id}`, {
        method: 'DELETE',
        headers,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Gagal menghapus tipe asset.');
      }

      showNotification(`Tipe Asset '${deleteTarget.name}' telah dihapus.`);
      setDeleteTarget(null);
      fetchAssetTypes();
    } catch (err: any) {
      showNotification(err.message || 'Gagal menghapus.', true);
    } finally {
      setDeleting(false);
    }
  };

  const filteredAssetTypes = useMemo(() => {
    if (!searchQuery.trim()) return assetTypes;
    const q = searchQuery.toLowerCase();
    return assetTypes.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q))
    );
  }, [assetTypes, searchQuery]);
  const renderIcon = (iconName: string, color?: string, className = 'h-4 w-4') => {
    const IconComp = ICON_MAP[iconName] || HardDrive;
    return <IconComp className={className} style={{ color: color || 'inherit' }} />;
  };

  const handleSaveThemeColor = async (colorHex: string) => {
    setThemeColor(colorHex);
    setIsSavingTheme(true);
    try {
      if (isSuperAdmin) {
        const res = await fetch(`${getApiUrl()}/system-settings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ platform_theme_color: colorHex }),
        });
        if (!res.ok) throw new Error('Gagal menyimpan warna tema global.');
        showNotification('Berhasil memperbarui Warna Tema Platform Global!', false);
      } else {
        const formData = new FormData();
        formData.append('themeColor', colorHex);
        const res = await fetch(`${getApiUrl()}/tenants/whitelabel`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-tenant-id': user?.tenantId || '',
          },
          body: formData,
        });
        if (!res.ok) throw new Error('Gagal menyimpan warna tema tenant.');
        updateSession({ tenantThemeColor: colorHex });
        showNotification('Berhasil memperbarui Warna Tema Tenant Anda!', false);
      }
      setTimeout(() => window.location.reload(), 1200);
    } catch (e: any) {
      showNotification(e.message, true);
    } finally {
      setIsSavingTheme(false);
    }
  };

  const handleUploadBranding = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'favicon') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (type === 'logo') setIsUploadingLogo(true);
    else setIsUploadingFavicon(true);

    try {
      if (isSuperAdmin) {
        const formData = new FormData();
        formData.append('file', file);

        const uploadRes = await fetch(`${getApiUrl()}/system-settings/upload`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData,
        });

        if (!uploadRes.ok) throw new Error('Gagal mengunggah file.');
        const uploadData = await uploadRes.json();
        const fileUrl = uploadData.url;

        const key = type === 'logo' ? 'platform_logo_url' : 'platform_favicon_url';
        const settingsPayload = { [key]: fileUrl };

        const settingRes = await fetch(`${getApiUrl()}/system-settings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(settingsPayload),
        });

        if (!settingRes.ok) throw new Error('Gagal menyimpan URL ke pengaturan sistem.');

        showNotification(`Berhasil memperbarui ${type} platform global!`, false);
        if (type === 'logo') setPlatformLogo(fileUrl);
        else setPlatformFavicon(fileUrl);
      } else {
        const formData = new FormData();
        formData.append(type, file);

        const res = await fetch(`${getApiUrl()}/tenants/whitelabel`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-tenant-id': user?.tenantId || '',
          },
          body: formData,
        });

        if (!res.ok) throw new Error('Gagal mengunggah branding tenant.');
        const data = await res.json();
        showNotification(`Berhasil memperbarui ${type} tenant Anda!`, false);
        if (type === 'logo') {
          const newLogo = data.tenant?.logoUrl || null;
          setPlatformLogo(newLogo);
          updateSession({ tenantLogoUrl: newLogo });
        } else {
          const newFavicon = data.tenant?.faviconUrl || null;
          setPlatformFavicon(newFavicon);
          updateSession({ tenantFaviconUrl: newFavicon });
        }
      }

      setTimeout(() => window.location.reload(), 1500);

    } catch (err: any) {
      showNotification(err.message, true);
    } finally {
      if (type === 'logo') setIsUploadingLogo(false);
      else setIsUploadingFavicon(false);
    }
  };

  const hasAccess = isSuperAdmin || Boolean(user?.isWhiteLabel);

  if (!hasAccess) {
    return (
      <div className="p-8 text-center space-y-5 max-w-xl mx-auto mt-12">
        <div className="p-5 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20 w-16 h-16 mx-auto flex items-center justify-center shadow-lg">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30 font-mono text-xs px-3 py-1">
            White-Label Subscription Required
          </Badge>
          <h2 className="text-lg font-bold text-foreground">Halaman Appearance Terkunci</h2>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-md mx-auto">
            Kustomisasi visual platform, pembuatan tipe asset kustom, serta pengaturan Logo & Favicon khusus hanya tersedia untuk Tenant yang berlangganan **Paket Lisensi White-Label**.
          </p>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border text-left space-y-2 text-xs">
          <span className="font-bold text-foreground block">Keuntungan Lisensi White-Label:</span>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li>Kustomisasi Logo & Favicon workspace sendiri</li>
            <li>Membuat & mewarnai Ikon Tipe Asset kustom</li>
            <li>Pengaturan Server Email SMTP Khusus per-Tenant</li>
            <li>Integrasi Telegram Bot Notifikasi khusus</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6">
      {/* Header Banner */}
      <Card className="border-border bg-card shadow-sm overflow-hidden">
        <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border bg-muted/20">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                <Palette className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                  Appearance & Asset Styling
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Manage the platform's visual appearance, asset type icons and colors, and branding theme configurations.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border bg-card px-6">
          <button
            onClick={() => setActiveTab('assetTypes')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-colors ${activeTab === 'assetTypes'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
          >
            <Boxes className="h-4 w-4" />
            Tab 1: Asset Icons & Colors
          </button>
          <button
            onClick={() => setActiveTab('branding')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-colors ${activeTab === 'branding'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
          >
            <ImageIcon className="h-4 w-4" />
            Tab 2: Logo & Favicon
          </button>
          <button
            onClick={() => setActiveTab('theme')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-colors ${activeTab === 'theme'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
          >
            <Sliders className="h-4 w-4" />
            Tab 3: Element & Theme Colors
          </button>
        </div>
      </Card>

      {/* Notifications */}
      {msgError && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{msgError}</span>
          </div>
          <button onClick={() => setMsgError(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {msgSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{msgSuccess}</span>
          </div>
          <button onClick={() => setMsgSuccess(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* TAB 1: ASSET ICONS & COLORS */}
      {activeTab === 'assetTypes' && (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4 bg-card border-border flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
                <Boxes className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Tipe Asset</p>
                <h3 className="text-xl font-extrabold text-foreground">{assetTypes.length}</h3>
              </div>
            </Card>
            <Card className="p-4 bg-card border-border flex items-center gap-4">
              <div className="p-3 rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">System Preset</p>
                <h3 className="text-xl font-extrabold text-foreground">
                  {assetTypes.filter((t) => t.isSystem).length}
                </h3>
              </div>
            </Card>
            <Card className="p-4 bg-card border-border flex items-center gap-4">
              <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Custom Types</p>
                <h3 className="text-xl font-extrabold text-foreground">
                  {assetTypes.filter((t) => !t.isSystem).length}
                </h3>
              </div>
            </Card>
          </div>

          {/* Action Header & Search */}
          <Card className="p-5 border-border bg-card space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Cari tipe asset, kode, atau deskripsi..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>
              <Button
                onClick={handleOpenAddModal}
                className="w-full sm:w-auto text-xs font-bold h-9 px-4 rounded-lg bg-primary hover:bg-primary/90 flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Tambah Tipe Asset Baru
              </Button>
            </div>

            {/* Table */}
            {loading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground gap-2 text-xs font-semibold">
                <Loader2 className="h-5 w-5 animate-spin" /> Memuat data tipe asset...
              </div>
            ) : filteredAssetTypes.length === 0 ? (
              <div className="text-center py-12 border border-dashed rounded-xl border-border text-muted-foreground text-xs">
                Tidak ada tipe asset ditemukan.
              </div>
            ) : (
              <div className="overflow-x-auto border border-border rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-muted-foreground font-semibold">
                      <th className="p-3 pl-4">Preview & Icon</th>
                      <th className="p-3">Kode Unik</th>
                      <th className="p-3">Nama Tipe</th>
                      <th className="p-3">Kode Warna</th>
                      <th className="p-3">Deskripsi</th>
                      <th className="p-3">Kategori</th>
                      <th className="p-3 pr-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredAssetTypes.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                        <td className="p-3 pl-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="h-8 w-8 rounded-lg flex items-center justify-center border shadow-xs"
                              style={{
                                backgroundColor: `${item.color}15`,
                                borderColor: `${item.color}40`,
                              }}
                            >
                              {renderIcon(item.icon, item.color, 'h-4 w-4')}
                            </div>
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {item.icon}
                            </span>
                          </div>
                        </td>
                        <td className="p-3 font-mono font-bold text-foreground">
                          {item.code}
                        </td>
                        <td className="p-3 font-bold text-foreground">
                          {item.name}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-3.5 w-3.5 rounded-full border border-black/20"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {item.color}
                            </span>
                          </div>
                        </td>
                        <td className="p-3 text-muted-foreground max-w-xs truncate">
                          {item.description || '-'}
                        </td>
                        <td className="p-3">
                          {item.isSystem ? (
                            <Badge variant="secondary" className="text-[10px] bg-purple-500/10 text-purple-400 border-purple-500/20">
                              System Preset
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                              Custom User
                            </Badge>
                          )}
                        </td>
                        <td className="p-3 pr-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEditModal(item)}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                              title="Edit Tipe Asset"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            {!item.isSystem && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteTarget(item)}
                                className="h-7 w-7 p-0 text-destructive/80 hover:text-destructive hover:bg-destructive/10"
                                title="Hapus Tipe Asset"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 2: BRANDING */}
      {activeTab === 'branding' && (
        <Card className="p-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-primary" />
              Platform Branding (Logo & Favicon)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Logo Upload */}
              <div className="space-y-4 border border-border p-6 rounded-xl relative">
                <h3 className="text-sm font-bold text-foreground">Platform Logo</h3>
                <p className="text-xs text-muted-foreground">Digunakan pada halaman Login Utama dan Navigasi Dashboard.</p>

                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 bg-muted/20 border border-border rounded-lg flex items-center justify-center overflow-hidden">
                    {platformLogo ? (
                      <img src={`${getBackendUrl()}${platformLogo}`} alt="Platform Logo" className="object-contain w-full h-full p-2" />
                    ) : (
                      <Boxes className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="block">
                      <span className="sr-only">Pilih File Logo</span>
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/svg+xml"
                        className="block w-full text-sm text-foreground
                          file:mr-4 file:py-2 file:px-4
                          file:rounded-full file:border-0
                          file:text-sm file:font-semibold
                          file:bg-primary file:text-primary-foreground
                          hover:file:bg-primary/90 cursor-pointer"
                        onChange={(e) => handleUploadBranding(e, 'logo')}
                        disabled={isUploadingLogo}
                      />
                    </label>
                  </div>
                </div>
                {isUploadingLogo && (
                  <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center rounded-xl z-10">
                    <Loader2 className="h-6 w-6 text-primary animate-spin" />
                  </div>
                )}
              </div>

              {/* Favicon Upload */}
              <div className="space-y-4 border border-border p-6 rounded-xl relative">
                <h3 className="text-sm font-bold text-foreground">Favicon Browser</h3>
                <p className="text-xs text-muted-foreground">Ikon kecil yang muncul di tab browser pengguna.</p>

                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 bg-muted/20 border border-border rounded-lg flex items-center justify-center overflow-hidden">
                    {platformFavicon ? (
                      <img src={`${getBackendUrl()}${platformFavicon}`} alt="Platform Favicon" className="object-contain w-full h-full p-3" />
                    ) : (
                      <Globe className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="block">
                      <span className="sr-only">Pilih File Favicon</span>
                      <input
                        type="file"
                        accept="image/png, image/x-icon"
                        className="block w-full text-sm text-foreground
                          file:mr-4 file:py-2 file:px-4
                          file:rounded-full file:border-0
                          file:text-sm file:font-semibold
                          file:bg-primary file:text-primary-foreground
                          hover:file:bg-primary/90 cursor-pointer"
                        onChange={(e) => handleUploadBranding(e, 'favicon')}
                        disabled={isUploadingFavicon}
                      />
                    </label>
                  </div>
                </div>
                {isUploadingFavicon && (
                  <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center rounded-xl z-10">
                    <Loader2 className="h-6 w-6 text-primary animate-spin" />
                  </div>
                )}
              </div>

            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'theme' && (
        <Card className="p-8 space-y-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sliders className="h-5 w-5 text-primary" />
              Tab 3: Element & Theme Colors (Primary Accent)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="border border-border p-6 rounded-xl space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-foreground">Warna Utama Platform (Primary UI Accent)</h3>
                <p className="text-xs text-muted-foreground">Pilih warna aksen utama yang akan diterapkan pada tombol, badge, dan highlight antarmuka.</p>
              </div>

              <div className="flex flex-wrap items-center gap-3 py-2">
                {PRESET_COLORS.map((hex) => (
                  <button
                    type="button"
                    key={hex}
                    onClick={() => handleSaveThemeColor(hex)}
                    disabled={isSavingTheme}
                    className={`h-9 w-9 rounded-full border-2 transition-all cursor-pointer shadow-sm ${
                      themeColor.toLowerCase() === hex.toLowerCase() ? 'ring-2 ring-primary ring-offset-2 scale-110 border-white' : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: hex }}
                    title={hex}
                  />
                ))}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <label className="text-xs font-semibold text-muted-foreground">Custom Color Hex:</label>
                <input
                  type="color"
                  value={themeColor}
                  onChange={(e) => setThemeColor(e.target.value)}
                  className="h-8 w-10 rounded cursor-pointer border-0 bg-transparent"
                />
                <Input
                  type="text"
                  value={themeColor}
                  onChange={(e) => setThemeColor(e.target.value)}
                  className="h-9 w-32 font-mono text-xs"
                />
                <Button
                  onClick={() => handleSaveThemeColor(themeColor)}
                  disabled={isSavingTheme}
                  className="h-9 text-xs font-bold bg-primary"
                >
                  {isSavingTheme ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Terapkan Warna Tema
                </Button>
              </div>
            </div>

            {/* Live Interactive Component Preview Box */}
            <div className="border border-border p-6 rounded-xl space-y-4 bg-muted/20">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Pratinjau Komponen UI (Live Interactive Preview)
                </h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Berikut adalah simulasi visual bagaimana warna aksen utama diterapkan pada tombol, menu navigasi, badge status, dan marker peta:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                {/* 1. Primary Action Button */}
                <div className="p-4 rounded-xl border border-border bg-card space-y-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Primary Button</span>
                  <div>
                    <button
                      type="button"
                      style={{ backgroundColor: themeColor, color: getContrastColor(themeColor) }}
                      className="w-full py-2 px-3 rounded-lg text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Simpan Perubahan
                    </button>
                  </div>
                </div>

                {/* 2. Active Sidebar Link */}
                <div className="p-4 rounded-xl border border-border bg-card space-y-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Sidebar Active Item</span>
                  <div
                    style={{ backgroundColor: `${themeColor}15`, color: themeColor, borderColor: `${themeColor}40` }}
                    className="p-2.5 rounded-lg border flex items-center gap-2 text-xs font-bold"
                  >
                    <Sliders className="h-4 w-4" />
                    <span>Appearance & Styling</span>
                  </div>
                </div>

                {/* 3. Status Badge & Ring */}
                <div className="p-4 rounded-xl border border-border bg-card space-y-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Badge & Active Indicator</span>
                  <div className="flex items-center gap-2 pt-1">
                    <span
                      style={{ backgroundColor: `${themeColor}20`, color: themeColor, borderColor: `${themeColor}50` }}
                      className="px-2.5 py-1 rounded-full text-[10px] font-extrabold border"
                    >
                      White-Label Active
                    </span>
                  </div>
                </div>

                {/* 4. Map Marker Pin */}
                <div className="p-4 rounded-xl border border-border bg-card space-y-2 flex flex-col items-center justify-center">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase self-start">Map Selection Pin</span>
                  <div className="flex flex-col items-center pt-1">
                    <div style={{ position: 'relative', width: '32px', height: '32px' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={themeColor} width="32" height="32">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="#ffffff" strokeWidth="1.5"/>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col my-auto">
            <div className="p-5 border-b border-border flex items-center justify-between bg-muted/20 shrink-0">
              <div className="flex items-center gap-2">
                <Boxes className="h-4.5 w-4.5 text-primary" />
                <h3 className="text-sm font-bold text-foreground">
                  {editingType ? `Edit Tipe Asset: ${editingType.code}` : 'Tambah Tipe Asset Baru'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
              {!editingType && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">
                    Kode Unik (UPPERCASE) <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="text"
                    required
                    placeholder="Contoh: FORKLIFT, SENSOR_TEMP, GATEWAY"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="h-9 text-xs font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Kode ini digunakan oleh sistem API & MQTT sebagai identifier unik.
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">
                  Nama Tipe Asset <span className="text-destructive">*</span>
                </label>
                <Input
                  type="text"
                  required
                  placeholder="Contoh: Forklift / Heavy Cargo"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              {/* ICON PICKER */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground flex items-center justify-between">
                  <span>Pilih Ikon (Lucide Icons)</span>
                  <span className="font-mono text-[10px] text-primary">{formData.icon}</span>
                </label>
                <div className="grid grid-cols-8 sm:grid-cols-10 gap-1.5 max-h-40 overflow-y-auto p-2 border border-border rounded-xl bg-muted/20">
                  {AVAILABLE_ICONS.map((iconKey) => {
                    const isSelected = formData.icon === iconKey;
                    return (
                      <button
                        type="button"
                        key={iconKey}
                        onClick={() => setFormData({ ...formData, icon: iconKey })}
                        className={`h-8 w-8 rounded-lg flex items-center justify-center border transition-all cursor-pointer ${isSelected
                          ? 'bg-primary text-primary-foreground border-primary shadow-xs scale-105'
                          : 'bg-card border-border hover:bg-muted text-muted-foreground hover:text-foreground'
                          }`}
                        title={iconKey}
                      >
                        {renderIcon(iconKey, isSelected ? '#ffffff' : formData.color, 'h-4 w-4')}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* COLOR PICKER */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground flex items-center justify-between">
                  <span>Pilih Warna Branding & Marker</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{formData.color}</span>
                </label>

                {/* Preset Swatches */}
                <div className="flex flex-wrap items-center gap-2">
                  {PRESET_COLORS.map((hex) => (
                    <button
                      type="button"
                      key={hex}
                      onClick={() => setFormData({ ...formData, color: hex })}
                      className={`h-6 w-6 rounded-full border border-black/20 transition-all cursor-pointer ${formData.color.toLowerCase() === hex.toLowerCase() ? 'ring-2 ring-primary ring-offset-2 scale-110' : 'hover:scale-105'
                        }`}
                      style={{ backgroundColor: hex }}
                      title={hex}
                    />
                  ))}

                  {/* Custom HTML Color Picker */}
                  <div className="relative flex items-center gap-2 ml-auto">
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="h-7 w-8 rounded cursor-pointer border-0 bg-transparent p-0"
                    />
                    <Input
                      type="text"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="h-7 w-24 text-[11px] font-mono"
                      placeholder="#3b82f6"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Deskripsi (Opsional)</label>
                <Input
                  type="text"
                  placeholder="Keterangan singkat mengenai tipe asset..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  className="text-xs h-9 px-4"
                >
                  Batal
                </Button>
                <Button type="submit" disabled={saving} className="text-xs font-bold h-9 px-5 bg-primary">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {editingType ? 'Simpan Perubahan' : 'Tambah Tipe Asset'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-destructive">
              <div className="p-2.5 rounded-full bg-destructive/10 border border-destructive/20">
                <Trash2 className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold">Hapus Tipe Asset Custom</h3>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Apakah Anda yakin ingin menghapus tipe asset <strong className="text-foreground">{deleteTarget.name}</strong> ({deleteTarget.code})? Clean up ini tidak dapat dibatalkan.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                className="text-xs h-9 px-4"
                disabled={deleting}
              >
                Batal
              </Button>
              <Button
                onClick={handleDelete}
                disabled={deleting}
                className="text-xs font-bold h-9 px-5 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Hapus Permanen
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
