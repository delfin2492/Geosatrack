'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Building2, KeyRound, Camera, Trash2,
  Loader2, CheckCircle2, AlertCircle, Eye, EyeOff, Shield, UserPlus, ChevronDown
} from 'lucide-react';

import { getApiUrl, getBackendUrl } from '../../lib/api';
import ConfirmModal from '../../components/ConfirmModal';

const API_URL = getApiUrl();
const BASE_URL = getBackendUrl();

type TabId = 'profile' | 'users' | 'password';

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('profile');

  const tabs = [
    { id: 'profile' as TabId, label: 'Profile Settings', icon: Building2 },
    { id: 'users' as TabId, label: 'User Management', icon: Shield },
    { id: 'password' as TabId, label: 'Change Password', icon: KeyRound },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your profile, team, and account security.</p>
      </div>

      {/* Tab Nav */}
      <div className="flex gap-1 bg-card border border-border rounded-xl p-1 w-fit">
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

      <div className="bg-card border border-border rounded-xl p-8">
        {activeTab === 'profile' && <ProfileTab tenantId={user?.tenantId!} user={user} />}
        {activeTab === 'users' && <UsersTab tenantId={user?.tenantId!} currentUserId={user?.id} />}
        {activeTab === 'password' && <PasswordTab userEmail={user?.email!} />}
      </div>
    </div>
  );
}

// ─── PROFILE TAB ─────────────────────────────────────────────────────────────
function ProfileTab({ tenantId, user }: { tenantId: string; user: any }) {
  const { updateSession } = useAuth();
  const [tenantName, setTenantName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!tenantId) return;
    fetch(`${API_URL}/tenants/${tenantId}`)
      .then(r => r.json())
      .then(data => {
        setTenantName(data.name || '');
        setAdminEmail(data.adminEmail || user?.email || '');
        if (data.logoUrl) setLogoPreview(`${BASE_URL}${data.logoUrl}`);
      })
      .catch(() => { });
  }, [tenantId]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const formData = new FormData();
      if (tenantName) formData.append('name', tenantName);
      if (adminEmail) formData.append('adminEmail', adminEmail);
      if (logoFile) formData.append('logo', logoFile);

      const res = await fetch(`${API_URL}/tenants/profile`, {
        method: 'PATCH',
        headers: { 'x-tenant-id': tenantId },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal menyimpan.');

      // Update session context LANGSUNG tanpa refresh
      const sessionUpdates: any = {};
      if (tenantName) sessionUpdates.tenantName = tenantName;
      if (adminEmail) sessionUpdates.tenantAdminEmail = adminEmail;
      if (data.tenant?.logoUrl) sessionUpdates.tenantLogoUrl = data.tenant.logoUrl;
      updateSession(sessionUpdates);

      setStatus({ type: 'success', msg: 'Profil berhasil diperbarui!' });
      setLogoFile(null);
    } catch (e: any) {
      setStatus({ type: 'error', msg: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-base font-bold text-foreground">Profile Tenant</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Change the organization name, admin email, and logo.</p>
      </div>

      {/* Logo Upload */}
      <div className="flex flex-col items-center gap-4">
        <div className="relative group cursor-pointer" onClick={() => fileRef.current?.click()}>
          <div className="h-28 w-28 rounded-full border-4 border-primary/30 bg-primary/5 flex items-center justify-center overflow-hidden shadow-lg">
            {logoPreview ? (
              <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <Building2 className="h-12 w-12 text-primary/40" />
            )}
          </div>
          <div className="absolute bottom-1 right-1 h-8 w-8 rounded-full bg-primary flex items-center justify-center shadow-md border-2 border-card group-hover:bg-primary/90 transition-all">
            <Camera className="h-4 w-4 text-primary-foreground" />
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
        <p className="text-xs text-muted-foreground">Click the logo to change the image (PNG, JPG, max 2MB)</p>
      </div>

      {/* Form */}
      <div className="space-y-4 max-w-md mx-auto">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">Tenant Name / Organization</label>
          <input
            type="text"
            value={tenantName}
            onChange={e => setTenantName(e.target.value)}
            placeholder="Organization name..."
            className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">Admin Email</label>
          <input
            type="email"
            value={adminEmail}
            onChange={e => setAdminEmail(e.target.value)}
            placeholder="[EMAIL_ADDRESS]"
            className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
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
            Save Changes
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
