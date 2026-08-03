'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../components/ui/table';
import {
  Building2,
  Plus,
  AlertCircle,
  RefreshCw,
  Search,
  Edit,
  Trash2,
  CheckCircle2,
} from 'lucide-react';

interface TenantItem {
  id: string;
  name: string;
  status: string;
  agentLimit: number;
  assetLimit: number;
  createdAt: string;
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
  
  // Create Modal & Form states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('admin123');
  const [agentLimit, setAgentLimit] = useState(5);
  const [assetLimit, setAssetLimit] = useState(100);

  // Edit Modal & Form states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTenantId, setEditingTenantId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editStatus, setEditStatus] = useState('active');
  const [editAgentLimit, setEditAgentLimit] = useState(5);
  const [editAssetLimit, setEditAssetLimit] = useState(100);

  // General states
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
      setMsgError('Please enter company name, admin name, and admin email.');
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
          agentLimit: Number(agentLimit),
          assetLimit: Number(assetLimit),
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.message || 'Failed to register tenant.');
      }

      setMsgSuccess(`Tenant "${result.tenant.name}" successfully created!`);
      setCompanyName('');
      setAdminName('');
      setAdminEmail('');
      setAgentLimit(5);
      setAssetLimit(100);

      fetchTenants();
      setTimeout(() => {
        setShowCreateModal(false);
        setMsgSuccess(null);
      }, 1500);
    } catch (err: any) {
      setMsgError(err.message || 'An error occurred during tenant creation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEdit = (tenant: TenantItem) => {
    setEditingTenantId(tenant.id);
    setEditName(tenant.name);
    setEditStatus(tenant.status || 'active');
    setEditAgentLimit(tenant.agentLimit || 5);
    setEditAssetLimit(tenant.assetLimit || 100);
    setMsgError(null);
    setMsgSuccess(null);
    setShowEditModal(true);
  };

  const handleEditTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenantId) return;

    setMsgError(null);
    setMsgSuccess(null);
    setIsSubmitting(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
      const res = await fetch(`${apiUrl}/tenants/${editingTenantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          status: editStatus,
          agentLimit: Number(editAgentLimit),
          assetLimit: Number(editAssetLimit),
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.message || 'Failed to update tenant.');
      }

      setMsgSuccess(`Tenant "${result.name}" successfully updated.`);
      fetchTenants();
      setTimeout(() => {
        setShowEditModal(false);
        setMsgSuccess(null);
      }, 1500);
    } catch (err: any) {
      setMsgError(err.message || 'An error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTenant = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete tenant "${name}"? All associated assets and users will be permanently deleted.`)) {
      return;
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
      const res = await fetch(`${apiUrl}/tenants/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.message || 'Failed to delete tenant.');
      }

      alert(`Tenant "${name}" successfully deleted.`);
      fetchTenants();
    } catch (err: any) {
      alert(err.message || 'An error occurred during deletion.');
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
        <h2 className="text-sm font-bold text-foreground">Access Denied (Superadmin Only)</h2>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          The Tenant Management page can only be accessed by the Superadmin account (`superadmin@geomesh.io`).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Top Banner Header */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-secondary border text-foreground">
                <Building2 className="h-4 w-4" />
              </span>
              <h2 className="text-sm font-bold tracking-tight text-foreground">
                Multi-Tenant Management
              </h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Manage all registered organizations and tenants, create admin accounts, and configure license limits.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={fetchTenants}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>

            <Button
              onClick={() => {
                setMsgError(null);
                setMsgSuccess(null);
                setShowCreateModal(true);
              }}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Create New Tenant
            </Button>
          </div>
        </div>
      </Card>

      {/* Search Filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            type="text"
            placeholder="Search tenant or company name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="text-xs text-muted-foreground font-mono">
          Total: <span className="text-foreground font-bold">{tenants.length}</span> Tenants
        </div>
      </div>

      {/* Tenants Table */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tenant Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Limit Agents</TableHead>
              <TableHead>Limit Assets</TableHead>
              <TableHead>Registration Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Loading tenants...
                </TableCell>
              </TableRow>
            ) : filteredTenants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No tenants found matching your search.
                </TableCell>
              </TableRow>
            ) : (
              filteredTenants.map((t) => {
                const isCurrent = t.id === tenantId;
                const regDate = t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '--';
                
                return (
                  <TableRow key={t.id} className={isCurrent ? 'bg-secondary/10' : ''}>
                    <TableCell className="font-bold text-foreground">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span>{t.name}</span>
                          <span className="block text-[9px] text-muted-foreground font-mono font-normal">ID: {t.id}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.status === 'active' ? 'success' : 'destructive'}>
                        {t.status || 'active'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-foreground font-bold">
                      {t.agentLimit || 5}
                    </TableCell>
                    <TableCell className="font-mono text-foreground font-bold">
                      {t.assetLimit || 100}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono">{regDate}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          onClick={() => switchTenantContext(t.id, t.name)}
                          disabled={isCurrent}
                          variant={isCurrent ? "ghost" : "outline"}
                          size="sm"
                          className="text-[10px] font-bold h-7.5 px-3 flex items-center gap-1"
                        >
                          {isCurrent ? (
                            <span className="text-muted-foreground flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                              Active View
                            </span>
                          ) : (
                            <span>View Dashboard</span>
                          )}
                        </Button>

                        <Button
                          onClick={() => handleOpenEdit(t)}
                          variant="outline"
                          size="icon"
                          className="h-7.5 w-7.5"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                          onClick={() => handleDeleteTenant(t.id, t.name)}
                          variant="ghost"
                          size="icon"
                          className="h-7.5 w-7.5 text-muted-foreground hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* CREATE TENANT MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-lg shadow-2xl space-y-4">
            <CardHeader className="py-4 flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-4.5 w-4.5 text-primary" />
                Register New Tenant
              </CardTitle>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-xs text-muted-foreground hover:text-foreground font-mono p-1 cursor-pointer"
              >
                ✕
              </button>
            </CardHeader>

            <CardContent className="space-y-4 pt-6 text-xs font-semibold">
              {msgError && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{msgError}</span>
                </div>
              )}
              {msgSuccess && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{msgSuccess}</span>
                </div>
              )}

              <form onSubmit={handleCreateTenant} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="text-muted-foreground">Company Name / Tenant *</label>
                    <Input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      required
                      placeholder="e.g. PT Borneo Mining Logistik"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-muted-foreground">Admin Name *</label>
                    <Input
                      type="text"
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      required
                      placeholder="e.g. Eko Prasetyo"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="text-muted-foreground">Admin Email *</label>
                    <Input
                      type="email"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      required
                      placeholder="eko@borneomining.co.id"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-muted-foreground">Default Admin Password</label>
                    <Input
                      type="text"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="text-muted-foreground">Agent Limit</label>
                    <Input
                      type="number"
                      value={agentLimit}
                      onChange={(e) => setAgentLimit(Number(e.target.value))}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-muted-foreground">Asset Limit</label>
                    <Input
                      type="number"
                      value={assetLimit}
                      onChange={(e) => setAssetLimit(Number(e.target.value))}
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/40">
                  <Button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Processing...' : 'Save & Register'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* EDIT TENANT MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-2xl space-y-4">
            <CardHeader className="py-4 flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-4.5 w-4.5 text-primary" />
                Edit Tenant Configuration
              </CardTitle>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-xs text-muted-foreground hover:text-foreground font-mono p-1 cursor-pointer"
              >
                ✕
              </button>
            </CardHeader>

            <CardContent className="space-y-4 pt-6 text-xs font-semibold">
              {msgError && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{msgError}</span>
                </div>
              )}
              {msgSuccess && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{msgSuccess}</span>
                </div>
              )}

              <form onSubmit={handleEditTenant} className="space-y-3.5">
                <div className="space-y-1.5">
                  <label className="text-muted-foreground">Company / Tenant Name</label>
                  <Input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-muted-foreground">License Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full bg-secondary/35 border border-border px-3 py-2 rounded-lg text-foreground focus:outline-none focus:border-primary text-xs font-semibold"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-muted-foreground">Agent Limit</label>
                    <Input
                      type="number"
                      value={editAgentLimit}
                      onChange={(e) => setEditAgentLimit(Number(e.target.value))}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-muted-foreground">Asset Limit</label>
                    <Input
                      type="number"
                      value={editAssetLimit}
                      onChange={(e) => setEditAssetLimit(Number(e.target.value))}
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/40">
                  <Button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
