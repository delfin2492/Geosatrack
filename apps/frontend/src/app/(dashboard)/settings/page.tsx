'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Building2, KeyRound, Camera, Trash2,
  Loader2, CheckCircle2, AlertCircle, Eye, EyeOff, Shield, UserPlus, ChevronDown, Mail, Send, Palette
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';

import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';

import { getApiUrl, getBackendUrl } from '../../lib/api';
import ConfirmModal from '../../components/ConfirmModal';
import AppearancePage from '../appearance/page';

const API_URL = getApiUrl();
const BASE_URL = getBackendUrl();

type TabId = 'profile' | 'appearance' | 'users' | 'integrations' | 'password';

export default function SettingsPage() {
  const { user, isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('profile');

  const isTenantAdmin = isSuperAdmin || user?.role === 'tenant_admin' || user?.role === 'admin';

  const allTabs = [
    { id: 'profile' as TabId, label: 'Profile Settings', icon: Building2, show: true },
    { id: 'password' as TabId, label: 'Change Password', icon: KeyRound, show: true },
    { id: 'users' as TabId, label: 'User Management', icon: Shield, show: isTenantAdmin },
    { id: 'appearance' as TabId, label: 'Appearance & Styling', icon: Palette, show: isTenantAdmin },
    { id: 'integrations' as TabId, label: 'White-Label Integrations', icon: Mail, show: isTenantAdmin },
  ];

  const tabs = allTabs.filter(t => t.show);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your profile, account security, and workspace preferences.</p>
      </div>

      {/* Tab Nav */}
      <div className="flex flex-wrap gap-1 bg-card border border-border rounded-xl p-1 w-fit">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${activeTab === id
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl p-6 sm:p-8">
        {activeTab === 'profile' && <ProfileTab tenantId={user?.tenantId!} user={user} />}
        {activeTab === 'appearance' && isTenantAdmin && <AppearancePage />}
        {activeTab === 'users' && isTenantAdmin && <UsersTab tenantId={user?.tenantId!} currentUserId={user?.id} />}
        {activeTab === 'password' && <PasswordTab userEmail={user?.email!} />}
        {activeTab === 'integrations' && isTenantAdmin && <IntegrationsTab user={user} />}
      </div>
    </div>
  );
}

// ─── PROFILE TAB ─────────────────────────────────────────────────────────────
function ProfileTab({ tenantId, user }: { tenantId: string; user: any }) {
  const { updateSession, isSuperAdmin } = useAuth();
  const isTenantAdmin = isSuperAdmin || user?.role === 'tenant_admin' || user?.role === 'admin';

  const [tenantName, setTenantName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');

  // Avatar Akun State
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const avatarRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    fetch(`${API_URL}/tenants/${tenantId}`)
      .then(r => r.json())
      .then(data => {
        setTenantName(data.name || '');
        setAdminEmail(isTenantAdmin ? (data.adminEmail || user?.email || '') : (user?.email || ''));
        if (user?.avatarUrl) setAvatarPreview(`${BASE_URL}${user.avatarUrl}`);
      })
      .catch(() => { });
  }, [tenantId, user, isTenantAdmin]);

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const formData = new FormData();
      if (isTenantAdmin && tenantName) formData.append('name', tenantName);
      if (isTenantAdmin && adminEmail) formData.append('adminEmail', adminEmail);
      if (avatarFile) formData.append('avatar', avatarFile);

      const res = await fetch(`${API_URL}/tenants/profile`, {
        method: 'PATCH',
        headers: {
          'x-tenant-id': tenantId,
          'x-user-id': user?.id || '',
        },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal menyimpan profil.');

      // Update session context LANGSUNG
      const sessionUpdates: any = {};
      if (isTenantAdmin && tenantName) sessionUpdates.tenantName = tenantName;
      if (isTenantAdmin && adminEmail) sessionUpdates.tenantAdminEmail = adminEmail;
      if (data.userAvatarUrl) sessionUpdates.avatarUrl = data.userAvatarUrl;
      updateSession(sessionUpdates);

      setStatus({ type: 'success', msg: 'Profil & foto akun berhasil diperbarui!' });
      setAvatarFile(null);
    } catch (e: any) {
      setStatus({ type: 'error', msg: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-base font-bold text-foreground">Profile Tenant & Akun</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {isTenantAdmin
            ? 'Manage your organization name, administrator email, and account profile photo.'
            : 'Manage your profile photo and account information.'}
        </p>
      </div>

      {/* Foto Profil Akun Upload */}
      <div className="flex flex-col items-center gap-4">
        <div className="relative group cursor-pointer" onClick={() => avatarRef.current?.click()}>
          <div className="h-28 w-28 rounded-full border-4 border-primary/30 bg-primary/5 flex items-center justify-center overflow-hidden shadow-lg">
            {avatarPreview ? (
              <img src={avatarPreview} alt="Avatar Akun" className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl font-bold text-primary/60">{user?.name?.charAt(0).toUpperCase() || 'U'}</span>
            )}
          </div>
          <div className="absolute bottom-1 right-1 h-8 w-8 rounded-full bg-primary flex items-center justify-center shadow-md border-2 border-card group-hover:bg-primary/90 transition-all">
            <Camera className="h-4 w-4 text-primary-foreground" />
          </div>
        </div>
        <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) { setAvatarFile(f); setAvatarPreview(URL.createObjectURL(f)); }
        }} />
        <p className="text-xs text-muted-foreground">Click the photo to change your account's profile picture (PNG, JPG, max 1MB)</p>
      </div>

      {/* Form */}
      <div className="space-y-4 max-w-md mx-auto pt-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">Tenant Name / Organization</label>
          <input
            type="text"
            value={tenantName}
            onChange={e => setTenantName(e.target.value)}
            disabled={!isTenantAdmin}
            placeholder="Organization name..."
            className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">
            {isTenantAdmin ? 'Admin Email' : 'Staf Email'}
          </label>
          <input
            type="email"
            value={isTenantAdmin ? adminEmail : (user?.email || '')}
            onChange={e => isTenantAdmin && setAdminEmail(e.target.value)}
            disabled={!isTenantAdmin}
            placeholder="email@perusahaan.com"
            className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          />
        </div>

        {status && (
          <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold border ${status.type === 'success'
            ? 'bg-green-500/10 border-green-500/20 text-green-400'
            : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}>
            {status.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {status.msg}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-foreground text-background text-xs font-bold transition-all hover:bg-foreground/80 disabled:opacity-50 cursor-pointer"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            SIMPAN PROFIL & FOTO
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── USERS TAB ───────────────────────────────────────────────────────────────
const ROLES = [
  { value: 'tenant_admin', label: 'Admin Tenant', color: 'bg-primary/10 text-primary border-primary/20' },
  { value: 'staff', label: 'Staff Tenant', color: 'bg-secondary text-muted-foreground border-border' },
];

function getRoleColor(role: string) {
  return ROLES.find(r => r.value === role)?.color || 'bg-secondary text-muted-foreground border-border';
}

function UsersTab({ tenantId, currentUserId }: { tenantId: string; currentUserId?: string }) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', role: 'operator' });
  const [saving, setSaving] = useState(false);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; email: string } | null>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/tenants/users`, {
        headers: { 'x-tenant-id': tenantId },
      });
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, [tenantId]);

  const handleCreate = async () => {
    if (!form.email) return;
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch(`${API_URL}/tenants/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal membuat user.');
      setStatus({ type: 'success', msg: `User "${form.email}" berhasil dibuat.` });
      setForm({ email: '', password: '', role: 'operator' });
      setShowForm(false);
      fetchUsers();
    } catch (e: any) {
      setStatus({ type: 'error', msg: e.message });
    } finally { setSaving(false); }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingRole(userId);
    try {
      const res = await fetch(`${API_URL}/tenants/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal mengubah role.');
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (e: any) {
      setStatus({ type: 'error', msg: e.message });
    } finally { setUpdatingRole(null); }
  };

  const handleDelete = async (userId: string) => {
    setDeleting(userId);
    try {
      const res = await fetch(`${API_URL}/tenants/users/${userId}`, {
        method: 'DELETE',
        headers: { 'x-tenant-id': tenantId },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal menghapus.');
      fetchUsers();
    } catch (e: any) {
      setStatus({ type: 'error', msg: e.message });
    } finally {
      setDeleting(null);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground">User Management</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Manage team members in this tenant.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all cursor-pointer"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Add User
        </button>
      </div>

      {/* Create User Form */}
      {showForm && (
        <div className="p-5 rounded-xl bg-secondary/30 border border-border space-y-4">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">User Baru</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5 col-span-1">
              <label className="text-xs font-semibold text-foreground">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="email@example.com"
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Password (optional)</label>
              <input
                type="text"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Initial password"
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Role</label>
              <select
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>

          {status && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border ${status.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}>
              {status.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              {status.msg}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary/50 cursor-pointer">
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={saving || !form.email}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
              Create User
            </button>
          </div>
        </div>
      )}

      {/* Status outside form */}
      {!showForm && status && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border ${status.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
          {status.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {status.msg}
        </div>
      )}

      {/* User List */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2 text-xs">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading users...
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-xs">No users found.</div>
      ) : (
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id} className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-background/50 hover:bg-secondary/20 transition-all group">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-sm font-bold text-primary select-none">
                  {u.email?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                    {u.email}
                    {u.id === currentUserId && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold border border-primary/20">Anda</span>
                    )}
                  </div>
                  <div className="text-[9px] text-muted-foreground/60 font-mono mt-0.5">
                    Joined: {new Date(u.createdAt).toLocaleDateString('id-ID')}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Role selector — disabled for current user */}
                {u.id === currentUserId ? (
                  <span className={`text-[10px] px-2.5 py-1 rounded-full border font-bold capitalize ${getRoleColor(u.role)}`}>
                    {ROLES.find(r => r.value === u.role)?.label || u.role}
                  </span>
                ) : (
                  <div className="relative">
                    <select
                      value={u.role}
                      onChange={e => handleRoleChange(u.id, e.target.value)}
                      disabled={updatingRole === u.id}
                      className={`appearance-none text-[10px] pl-2.5 pr-6 py-1 rounded-full border font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all ${getRoleColor(u.role)} bg-transparent`}
                    >
                      {ROLES.map(r => <option key={r.value} value={r.value} className="bg-background text-foreground">{r.label}</option>)}
                    </select>
                    {updatingRole === u.id ? (
                      <Loader2 className="h-3 w-3 animate-spin absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-3 w-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
                    )}
                  </div>
                )}

                {u.id !== currentUserId && (
                  <button
                    onClick={() => setDeleteTarget({ id: u.id, email: u.email })}
                    disabled={deleting === u.id}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer disabled:opacity-50 opacity-0 group-hover:opacity-100"
                  >
                    {deleting === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Custom Confirm Modal */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete User"
        message={`Are you sure you want to delete user "${deleteTarget?.email}"? This action cannot be undone.`}
        confirmText="Delete User"
        cancelText="Cancel"
        variant="danger"
        onConfirm={() => deleteTarget && handleDelete(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

// ─── CHANGE PASSWORD TAB ─────────────────────────────────────────────────────
function PasswordTab({ userEmail }: { userEmail: string }) {
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const handleChange = async () => {
    if (newPass.length < 6) {
      setStatus({ type: 'error', msg: 'The new password must be at least 6 characters long.' });
      return;
    }
    if (newPass !== confirmPass) {
      setStatus({ type: 'error', msg: 'Confirmation password does not match.' });
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch(`${API_URL}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, newPassword: newPass }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to change password.');
      setStatus({ type: 'success', msg: 'Password successfully changed!' });
      setNewPass(''); setConfirmPass('');
    } catch (e: any) {
      setStatus({ type: 'error', msg: e.message });
    } finally { setSaving(false); }
  };

  const strength = newPass.length === 0 ? 0 : newPass.length < 6 ? 1 : newPass.length < 10 ? 2 : 3;
  const strengthLabel = ['', 'Weak', 'Medium', 'Strong'];
  const strengthColor = ['', 'bg-red-500', 'bg-yellow-500', 'bg-green-500'];

  return (
    <div className="space-y-6 max-w-md">
      <div>
        <h2 className="text-base font-bold text-foreground">Change Password</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Update the password for the account <span className="font-mono text-foreground">{userEmail}</span></p>
      </div>

      <div className="space-y-4">
        {/* New Password */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">New Password</label>
          <div className="relative">
            <input
              type={showNew ? 'text' : 'password'}
              value={newPass}
              onChange={e => setNewPass(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full px-3 py-2.5 pr-10 rounded-lg bg-background border border-border text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            />
            <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer">
              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {newPass.length > 0 && (
            <div className="space-y-1">
              <div className="flex gap-1">
                {[1, 2, 3].map(i => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= strength ? strengthColor[strength] : 'bg-border'}`} />
                ))}
              </div>
              <p className={`text-[10px] font-semibold ${strength === 1 ? 'text-red-400' : strength === 2 ? 'text-yellow-400' : 'text-green-400'}`}>
                Password strength: {strengthLabel[strength]}
              </p>
            </div>
          )}
        </div>

        {/* Confirm Password */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">Confirm New Password</label>
          <input
            type="password"
            value={confirmPass}
            onChange={e => setConfirmPass(e.target.value)}
            placeholder="Repeat new password"
            className={`w-full px-3 py-2.5 rounded-lg bg-background border text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all ${confirmPass && confirmPass !== newPass ? 'border-red-500/50' : 'border-border'
              }`}
          />
          {confirmPass && confirmPass !== newPass && (
            <p className="text-[10px] text-red-400 font-semibold">Password does not match.</p>
          )}
        </div>

        {status && (
          <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold border ${status.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}>
            {status.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {status.msg}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            onClick={handleChange}
            disabled={saving || !newPass || newPass !== confirmPass}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-foreground text-background text-xs font-bold hover:bg-foreground/80 disabled:opacity-50 cursor-pointer transition-all"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            CHANGE PASSWORD
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── INTEGRATIONS TAB (WHITE-LABEL DEDICATED SMTP & TELEGRAM) ────────────────
function IntegrationsTab({ user }: { user: any }) {
  const { isSuperAdmin } = useAuth();
  const [smtpHost, setSmtpHost] = useState(user?.smtpHost || '');
  const [smtpPort, setSmtpPort] = useState(user?.smtpPort ? String(user.smtpPort) : '');
  const [smtpUser, setSmtpUser] = useState(user?.smtpUser || '');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFrom, setSmtpFrom] = useState(user?.smtpFrom || '');
  const [telegramToken, setTelegramToken] = useState(user?.telegramBotToken || '');
  const [telegramChatId, setTelegramChatId] = useState(user?.telegramChatId || '');

  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const hasAccess = isSuperAdmin || Boolean(user?.isWhiteLabel);

  if (!hasAccess) {
    return (
      <div className="p-8 text-center space-y-4 max-w-lg mx-auto">
        <div className="p-4 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 w-14 h-14 mx-auto flex items-center justify-center">
          <Mail className="h-7 w-7" />
        </div>
        <div className="space-y-2">
          <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30 text-xs font-mono">
            White-Label Subscription Required
          </Badge>
          <h2 className="text-base font-bold text-foreground">Dedicated Integrations Terkunci</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Pengaturan Dedicated SMTP Server dan Telegram Bot Notifikasi khusus hanya tersedia untuk Tenant yang berlangganan Paket White-Label.
          </p>
        </div>
      </div>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus(null);

    try {
      const formData = new FormData();
      if (smtpHost) formData.append('smtpHost', smtpHost);
      if (smtpPort) formData.append('smtpPort', smtpPort);
      if (smtpUser) formData.append('smtpUser', smtpUser);
      if (smtpPass) formData.append('smtpPass', smtpPass);
      if (smtpFrom) formData.append('smtpFrom', smtpFrom);
      if (telegramToken) formData.append('telegramBotToken', telegramToken);
      if (telegramChatId) formData.append('telegramChatId', telegramChatId);

      const res = await fetch(`${API_URL}/tenants/whitelabel`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${user?.token}`,
          'x-tenant-id': user?.tenantId || '',
        },
        body: formData,
      });

      if (!res.ok) throw new Error('Gagal menyimpan pengaturan integrasi White-Label.');

      setStatus({ type: 'success', msg: 'Pengaturan SMTP & Telegram khusus berhasil disimpan!' });
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.message || 'Terjadi kesalahan.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            Dedicated SMTP & Telegram Bot Integration
          </h2>
          <p className="text-xs text-muted-foreground">Configure your tenant's dedicated notification email server and Telegram bot.</p>
        </div>
        <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30 text-[10px]">
          White-Label Active
        </Badge>
      </div>

      {status && (
        <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold border ${status.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
          {status.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {status.msg}
        </div>
      )}

      {/* SMTP SECTION */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">1. Dedicated SMTP Email Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">SMTP Host Server</label>
            <input
              type="text"
              placeholder="smtp.example.com"
              value={smtpHost}
              onChange={(e) => setSmtpHost(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:border-primary"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">SMTP Port</label>
            <input
              type="number"
              placeholder="587 / 465"
              value={smtpPort}
              onChange={(e) => setSmtpPort(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:border-primary"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">SMTP Username / Email</label>
            <input
              type="text"
              placeholder="noreply@example.com"
              value={smtpUser}
              onChange={(e) => setSmtpUser(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:border-primary"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">SMTP Password</label>
            <input
              type="password"
              placeholder="••••••••••••"
              value={smtpPass}
              onChange={(e) => setSmtpPass(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:border-primary"
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-semibold text-muted-foreground">Sender Email Address (From)</label>
            <input
              type="email"
              placeholder="GeoMesh Notifications <alerts@example.com>"
              value={smtpFrom}
              onChange={(e) => setSmtpFrom(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:border-primary"
            />
          </div>
        </div>
      </div>

      {/* TELEGRAM SECTION */}
      <div className="space-y-4 pt-4 border-t border-border">
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">2. Dedicated Telegram Bot Notification</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">Telegram Bot Token</label>
            <input
              type="text"
              placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
              value={telegramToken}
              onChange={(e) => setTelegramToken(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs font-mono text-foreground focus:outline-none focus:border-primary"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">Target Chat ID / Group ID</label>
            <input
              type="text"
              placeholder="-100123456789"
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs font-mono text-foreground focus:outline-none focus:border-primary"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-border">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-50 cursor-pointer transition-all shadow-sm"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          SIMPAN PENGATURAN INTEGRASI
        </button>
      </div>
    </form>
  );
}
