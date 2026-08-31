'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { getApiUrl } from '../../lib/api';
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
  Maximize2
} from 'lucide-react';

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
  const { isSuperAdmin, token, user } = useAuth();

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

  const fetchAssetTypes = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/asset-types`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
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
    if (isSuperAdmin) {
      fetchAssetTypes();
    }
  }, [isSuperAdmin]);

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
        const res = await fetch(`${getApiUrl()}/asset-types/${editingType.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'x-user-role': userRoleHeader,
          },
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
        const res = await fetch(`${getApiUrl()}/asset-types`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'x-user-role': userRoleHeader,
          },
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
      const res = await fetch(`${getApiUrl()}/asset-types/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-user-role': userRoleHeader,
        },
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

  if (!isSuperAdmin) {
    return (
      <div className="p-8 text-center space-y-4 max-w-lg mx-auto mt-12">
        <div className="p-4 rounded-full bg-destructive/10 text-destructive w-12 h-12 mx-auto flex items-center justify-center">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h2 className="text-sm font-bold text-foreground">Akses Ditolak (Superadmin Only)</h2>
        <p className="text-xs text-muted-foreground">
          Halaman Pengaturan Tampilan & Ikon Asset hanya dapat diakses oleh akun Superadmin.
        </p>
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
                  <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                    Superadmin Console
                  </Badge>
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Kelola tampilan visual platform, ikon & warna tipe asset, serta konfigurasi tema branding.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border bg-card px-6">
          <button
            onClick={() => setActiveTab('assetTypes')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'assetTypes'
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Boxes className="h-4 w-4" />
            Tab 1: Asset Icons & Colors (Active)
          </button>
          <button
            onClick={() => setActiveTab('branding')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'branding'
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <ImageIcon className="h-4 w-4" />
            Tab 2: Logo & Favicon
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">Future</span>
          </button>
          <button
            onClick={() => setActiveTab('theme')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'theme'
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sliders className="h-4 w-4" />
            Tab 3: Element & Theme Colors
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">Future</span>
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

      {/* TAB 2 & TAB 3: PLACEHOLDERS */}
      {activeTab === 'branding' && (
        <Card className="p-12 text-center border-dashed border-border space-y-4">
          <div className="p-4 rounded-full bg-blue-500/10 text-blue-500 w-12 h-12 mx-auto flex items-center justify-center">
            <ImageIcon className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-foreground">Tab 2: Platform Branding (Logo & Favicon)</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Halaman ini disiapkan untuk kustomisasi logo platform, favicon browser, dan header branding di masa mendatang.
          </p>
        </Card>
      )}

      {activeTab === 'theme' && (
        <Card className="p-12 text-center border-dashed border-border space-y-4">
          <div className="p-4 rounded-full bg-purple-500/10 text-purple-500 w-12 h-12 mx-auto flex items-center justify-center">
            <Sliders className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-foreground">Tab 3: Element & Theme Colors</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Halaman ini disiapkan untuk kustomisasi palette warna UI, warna tombol, dan aksen tema platform.
          </p>
        </Card>
      )}

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-8">
            <div className="p-5 border-b border-border flex items-center justify-between bg-muted/20">
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

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
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
                        className={`h-8 w-8 rounded-lg flex items-center justify-center border transition-all cursor-pointer ${
                          isSelected
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
                      className={`h-6 w-6 rounded-full border border-black/20 transition-all cursor-pointer ${
                        formData.color.toLowerCase() === hex.toLowerCase() ? 'ring-2 ring-primary ring-offset-2 scale-110' : 'hover:scale-105'
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
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
