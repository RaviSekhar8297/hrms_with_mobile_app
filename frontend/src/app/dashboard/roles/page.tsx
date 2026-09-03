'use client';

import React, { useEffect, useState } from 'react';
import DashboardPageHeader from '../components/DashboardPageHeader';
import { getHeaders, getUrl } from '../utils/api';
import SlideDrawer from '../components/SlideDrawer';
import { useDashboard } from '../components/DashboardContext';
import SearchableSelect from '../components/SearchableSelect';

interface Company {
  id: string;
  name: string;
  subdomain: string;
  status: string;
  created_at: string;
}

interface Permission {
  id: string;
  name: string;
  description: string;
  module: string;
  data_scope?: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
  company_name?: string;
  company_id?: string;
  permissions: Permission[];
}

export default function RolesPage() {
  const { showToast, companyId, setCompanyId } = useDashboard();
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [tenantRoles, setTenantRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);

  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [savingRoleId, setSavingRoleId] = useState<string | null>(null);

  // Selected State
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [hasInitializedExpanded, setHasInitializedExpanded] = useState(false);

  // Search Filters
  const [searchRoleQuery, setSearchRoleQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // New Role Form & Edit Role Form
  const [roleForm, setRoleForm] = useState({ name: '', description: '' });
  const [editRoleDrawerOpen, setEditRoleDrawerOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [editRoleForm, setEditRoleForm] = useState({ name: '', description: '' });

  // View Switcher (Matrix Table vs Card Accordion)
  const [viewMode, setViewMode] = useState<'matrix' | 'card'>('matrix');

  // Map roleId -> Array of checked permissionIds
  const [rolePermissionsState, setRolePermissionsState] = useState<Record<string, string[]>>({});
  // Map roleId -> { [permId]: 'SELF' | 'REPORTING' | 'DEPARTMENT' | 'ALL' }
  const [roleScopesState, setRoleScopesState] = useState<Record<string, Record<string, string>>>({});
  // Scope popover state: `${roleId}_${moduleName}`
  const [openScopeMenu, setOpenScopeMenu] = useState<string | null>(null);

  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('superadmin');

  const getModuleCategory = (moduleName: string) => {
    const name = moduleName.toLowerCase();
    if (['employees', 'departments', 'branches', 'designations', 'company'].some(m => name.includes(m))) return 'Core HR';
    if (['attendance', 'leave', 'shift', 'payroll', 'claims', 'timesheet'].some(m => name.includes(m))) return 'Workforce';
    if (['recruitment', 'job', 'applicant', 'candidate', 'interview'].some(m => name.includes(m))) return 'Talent Acq';
    if (['role', 'permission', 'system', 'audit', 'setting', 'security'].some(m => name.includes(m))) return 'System Admin';
    return 'General';
  };

  // Filtered Roles
  const filteredRoles = tenantRoles.filter(role => {
    const matchesSearch = role.name.toLowerCase().includes(searchRoleQuery.toLowerCase());
    return matchesSearch;
  });

  useEffect(() => {
    const storedRoles = localStorage.getItem('roles');
    const storedEmail = localStorage.getItem('email');
    if (storedRoles) setRoles(JSON.parse(storedRoles));
    if (storedEmail) setEmail(storedEmail);
  }, []);

  const fetchCompanies = async () => {
    try {
      const res = await fetch('/api/v1/companies', { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) setCompanies(data.companies || []);
    } catch (e) { console.error(e); }
  };

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const res = await fetch(getUrl('/api/v1/roles', companyId), { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) {
        const fetchedRoles = data.roles || [];
        setTenantRoles(fetchedRoles);

        // Initialize checked state and scope dictionaries
        const initialState: Record<string, string[]> = {};
        const initialScopes: Record<string, Record<string, string>> = {};
        fetchedRoles.forEach((role: Role) => {
          initialState[role.id] = role.permissions.map(p => p.id);
          initialScopes[role.id] = {};
          role.permissions.forEach(p => {
            initialScopes[role.id][p.id] = p.data_scope || 'ALL';
          });
        });
        setRolePermissionsState(initialState);
        setRoleScopesState(initialScopes);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const fetchPermissions = async () => {
    try {
      const res = await fetch(getUrl('/api/v1/permissions', companyId), { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) setPermissions(data.permissions || []);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      fetchCompanies();
    }
    fetchPermissions();
  }, [isSuperAdmin, companyId]);

  useEffect(() => {
    fetchRoles();
  }, [companyId, isSuperAdmin]);

  // Auto-select first role and module on load or filter change
  useEffect(() => {
    const isCurrentRoleInFiltered = filteredRoles.some(r => r.id === selectedRoleId);
    if (!isCurrentRoleInFiltered && filteredRoles.length > 0) {
      setSelectedRoleId(filteredRoles[0].id);
    } else if (filteredRoles.length === 0) {
      setSelectedRoleId(null);
    }
  }, [filteredRoles, selectedRoleId]);

  const uniqueModules = Array.from(new Set(permissions.map(p => p.module)));
  useEffect(() => {
    if (uniqueModules.length > 0 && !selectedModule) {
      setSelectedModule(uniqueModules[0]);
    }
    if (uniqueModules.length > 0 && !hasInitializedExpanded) {
      setExpandedModule(uniqueModules[0]);
      setHasInitializedExpanded(true);
    }
  }, [uniqueModules, selectedModule, hasInitializedExpanded]);

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSuperAdmin && !companyId) {
      showToast('Corporate context selection is required', 'error');
      return;
    }
    if (!roleForm.name) {
      showToast('Role Name Identifier is required', 'error');
      return;
    }
    if (!roleForm.description) {
      showToast('Role description is required', 'error');
      return;
    }
    try {
      const res = await fetch('/api/v1/roles', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ ...roleForm, companyId })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Access role registered successfully!', 'success');
        setRoleForm({ name: '', description: '' });
        setDrawerOpen(false);
        fetchRoles();
      } else {
        showToast(data.error || 'Failed to create role', 'error');
      }
    } catch (err) {
      showToast('Failed to save role context', 'error');
    }
  };

  const handleOpenEditRole = (role: Role, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingRole(role);
    setEditRoleForm({ name: role.name, description: role.description || '' });
    setEditRoleDrawerOpen(true);
  };

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRole) return;
    if (!editRoleForm.name) {
      showToast('Role Name is required', 'error');
      return;
    }
    try {
      const res = await fetch(`/api/v1/roles/${editingRole.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(editRoleForm)
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Role details updated successfully!', 'success');
        setEditRoleDrawerOpen(false);
        setEditingRole(null);
        fetchRoles();
      } else {
        showToast(data.error || 'Failed to update role', 'error');
      }
    } catch (err) {
      showToast('Failed to update role', 'error');
    }
  };

  const handleDeleteRole = async (role: Role, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete role "${role.name}"?`)) return;

    try {
      const res = await fetch(`/api/v1/roles/${role.id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Role deleted successfully!', 'success');
        fetchRoles();
      } else {
        showToast(data.error || 'Failed to delete role', 'error');
      }
    } catch (err) {
      showToast('Failed to delete role', 'error');
    }
  };

  const togglePermissionAutoSave = async (roleId: string, permId: string) => {
    if (savingRoleId !== null) return;
    const currentList = rolePermissionsState[roleId] || [];
    let newList;

    const targetPerm = permissions.find(p => p.id === permId);
    const isViewAction = targetPerm?.name.startsWith('view_');

    if (currentList.includes(permId)) {
      if (isViewAction && targetPerm) {
        const modulePermIds = permissions.filter(p => p.module === targetPerm.module).map(p => p.id);
        newList = currentList.filter(id => !modulePermIds.includes(id));
      } else {
        newList = currentList.filter(id => id !== permId);
      }
    } else {
      newList = [...currentList, permId];
    }

    // Optimistic UI Update
    setRolePermissionsState(prev => ({
      ...prev,
      [roleId]: newList
    }));

    try {
      setSavingRoleId(roleId);
      const currentScopes = roleScopesState[roleId] || {};
      const res = await fetch(`/api/v1/roles/${roleId}/permissions`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ permissionIds: newList, permissionScopes: currentScopes, companyId })
      });
      if (res.ok) {
        showToast('Permission settings saved successfully!', 'success');
        // Silent update to fetch latest roles permission count
        const refreshRes = await fetch(getUrl('/api/v1/roles', companyId), { headers: getHeaders() });
        const refreshData = await refreshRes.json();
        if (refreshRes.ok) {
          setTenantRoles(refreshData.roles || []);
        }
      } else {
        showToast('Failed to synchronize permission changes', 'error');
        // Rollback on API error
        setRolePermissionsState(prev => ({ ...prev, [roleId]: currentList }));
      }
    } catch (err) {
      showToast('Connection error updating permission settings', 'error');
      setRolePermissionsState(prev => ({ ...prev, [roleId]: currentList }));
    } finally {
      setSavingRoleId(null);
    }
  };

  const handleScopeChange = async (roleId: string, targetPermIds: string | string[], scope: string) => {
    if (savingRoleId !== null) return;
    const currentScopes = roleScopesState[roleId] || {};
    const idsToUpdate = Array.isArray(targetPermIds) ? targetPermIds : [targetPermIds];
    if (idsToUpdate.length === 0) return;

    const newScopes = { ...currentScopes };
    idsToUpdate.forEach(id => {
      newScopes[id] = scope;
    });

    const currentPermIds = rolePermissionsState[roleId] || [];

    setRoleScopesState(prev => ({
      ...prev,
      [roleId]: newScopes
    }));

    try {
      setSavingRoleId(roleId);
      const res = await fetch(`/api/v1/roles/${roleId}/permissions`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ permissionIds: currentPermIds, permissionScopes: newScopes, companyId })
      });
      if (res.ok) {
        showToast(`Data Scope set to ${scope}`, 'success');
      } else {
        showToast('Failed to update data scope', 'error');
        setRoleScopesState(prev => ({ ...prev, [roleId]: currentScopes }));
      }
    } catch (err) {
      showToast('Connection error updating scope', 'error');
      setRoleScopesState(prev => ({ ...prev, [roleId]: currentScopes }));
    } finally {
      setSavingRoleId(null);
    }
  };

  const getActionWeight = (name: string) => {
    if (name.startsWith('view_')) return 1;
    if (name.startsWith('create_')) return 2;
    if (name.startsWith('edit_')) return 3;
    if (name.startsWith('delete_')) return 4;
    return 5;
  };

  const activeRole = tenantRoles.find(r => r.id === selectedRoleId);
  const activeModulePermissions = permissions
    .filter(p => p.module === selectedModule)
    .sort((a, b) => getActionWeight(a.name) - getActionWeight(b.name));
  const activeRolePermissions = selectedRoleId ? rolePermissionsState[selectedRoleId] || [] : [];

  const handleSelectAllForModule = async (moduleName: string) => {
    if (!selectedRoleId || savingRoleId) return;
    const modulePermissions = permissions.filter(p => p.module === moduleName);
    const modulePermIds = modulePermissions.map(p => p.id);
    const newList = Array.from(new Set([...(rolePermissionsState[selectedRoleId] || []), ...modulePermIds]));

    setRolePermissionsState(prev => ({ ...prev, [selectedRoleId]: newList }));
    await savePermissionsBulk(selectedRoleId, newList);
  };

  const handleDeselectAllForModule = async (moduleName: string) => {
    if (!selectedRoleId || savingRoleId) return;
    const modulePermissions = permissions.filter(p => p.module === moduleName);
    const modulePermIds = modulePermissions.map(p => p.id);
    const newList = (rolePermissionsState[selectedRoleId] || []).filter(id => !modulePermIds.includes(id));

    setRolePermissionsState(prev => ({ ...prev, [selectedRoleId]: newList }));
    await savePermissionsBulk(selectedRoleId, newList);
  };

  const savePermissionsBulk = async (roleId: string, newList: string[]) => {
    try {
      setSavingRoleId(roleId);
      const res = await fetch(`/api/v1/roles/${roleId}/permissions`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ permissionIds: newList, companyId })
      });
      if (res.ok) {
        showToast('Matrix permissions synchronized successfully!', 'success');
        const refreshRes = await fetch(getUrl('/api/v1/roles', companyId), { headers: getHeaders() });
        const refreshData = await refreshRes.json();
        if (refreshRes.ok) {
          setTenantRoles(refreshData.roles || []);
        }
      } else {
        showToast('Failed to save bulk permission settings', 'error');
      }
    } catch (err) {
      showToast('Connection error executing bulk save', 'error');
    } finally {
      setSavingRoleId(null);
    }
  };

  const handleCompanyChange = (id: string) => {
    const val = id || null;
    setCompanyId(val);
    if (val) {
      localStorage.setItem('companyId', val);
    } else {
      localStorage.removeItem('companyId');
    }
  };

  const getActionType = (name: string) => {
    if (name.startsWith('view_')) return 'VIEW';
    if (name.startsWith('create_')) return 'CREATE';
    if (name.startsWith('edit_')) return 'EDIT';
    if (name.startsWith('delete_')) return 'DELETE';
    if (name.startsWith('manage_')) return 'MANAGE';
    if (name.startsWith('calculate_')) return 'CALCULATE';
    return 'ACCESS';
  };

  const filteredModules = uniqueModules.filter(moduleName =>
    moduleName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    permissions.some(p => p.module === moduleName && (
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase())
    ))
  );

  const companyOptions = [
    { value: 'ALL', label: 'All Companies' },
    ...companies.map(c => ({ value: c.id, label: c.name }))
  ];

  const inputStyle = "w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40 px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-purple-500 focus:bg-card focus:ring-4 focus:ring-purple-500/10 transition-all duration-200 placeholder-slate-400";

  return (
    <div className="space-y-8 animate-fadeIn w-full pb-32 font-['DM_Sans',sans-serif]" style={{ fontFamily: "'DM Sans', sans-serif" }}>

      {/* Header Panel */}
      <div className="w-full">
        <DashboardPageHeader
          title="Role Access Policies"
          actionMessage=""
          actionError=""
          companies={companies}
          companyId={companyId}
          handleCompanyChange={handleCompanyChange}
          isSuperAdmin={isSuperAdmin}
          email={email}
          hideCompanySelect={true}
          hideUserBadge={true}
        >
          <div className="flex items-center gap-3 flex-wrap justify-end">

            <button
              onClick={() => setDrawerOpen(true)}
              className="inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-black shadow-lg shadow-indigo-600/30 hover:shadow-xl hover:shadow-indigo-600/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer group flex-shrink-0"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-white/20 group-hover:bg-white/30 transition-all">
                <svg className="w-3.5 h-3.5 stroke-[3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </span>
              <span className="tracking-wider uppercase text-[10px]">Add Access Role</span>
            </button>
          </div>
        </DashboardPageHeader>
      </div>

      {/* Main Content Area */}
      {viewMode === 'matrix' ? (
        /* ⚡ SUPABASE-STYLE ROLE PERMISSION MATRIX TABLE */
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-card shadow-xl overflow-hidden text-left w-full">
          {/* Header Controls inside Matrix */}
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/40">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
              </span>
              <div>
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">
                  System Permission Matrix
                </h4>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-0.5">
                  Click any <span className="text-emerald-500 font-black">V C E</span> or <span className="text-rose-500 font-black">D</span> badge to toggle policy permissions in realtime
                </p>
              </div>
            </div>

            {/* Legend & Filter Controls */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Module Filter Search */}
              <div className="relative min-w-[210px]">
                <svg className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search 54+ tables/modules..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '2.5rem' }}
                  className="w-full pl-search pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-amber-500 transition-all placeholder-slate-400 font-sans"
                />
              </div>

              <div className="flex items-center gap-1.5 text-[9.5px] font-black tracking-wider uppercase bg-slate-100 dark:bg-slate-850 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 font-sans">
                <span className="text-slate-400"></span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold">V = View</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold">C = Create</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold">E = Edit</span>
                <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold">D = Delete</span>
              </div>
              <div className="flex items-center gap-1.5 text-[9.5px] font-black tracking-wider uppercase bg-slate-100 dark:bg-slate-850 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 font-sans">
                <span className="text-slate-400"></span>
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold">S = Self</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold">T = Team</span>
                <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-600 dark:text-purple-400 font-bold">D = Dept</span>
                <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold">A = All</span>
              </div>

              </div>
            </div>

          {/* Matrix Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead>
                <tr className="bg-slate-100/70 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-extrabold uppercase tracking-widest text-[9.5px]">
                  <th className="py-4 px-4 text-center w-12 min-w-[50px] text-slate-400">S.NO</th>
                  <th className="py-4 px-5 min-w-[200px]">RESOURCE TABLE</th>
                  <th className="py-4 px-4 min-w-[120px]">CATEGORY</th>
                  {filteredRoles.map(role => (
                    <th key={role.id} className="py-4 px-4 text-center min-w-[170px] relative group/col">
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <div className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-[11px] truncate max-w-[120px]" title={role.name}>
                          {role.name}
                        </div>
                        <button
                          onClick={(e) => handleOpenEditRole(role, e)}
                          title="Edit role name"
                          className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors p-0.5"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.83 20.089a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => handleDeleteRole(role, e)}
                          title="Delete role"
                          className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors p-0.5"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                      <span className="text-[9.5px] font-bold text-indigo-600 dark:text-indigo-400 block uppercase tracking-wider">
                        {rolePermissionsState[role.id]?.length || 0} permissions active
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850 font-sans">
                {filteredModules.length === 0 ? (
                  <tr>
                    <td colSpan={3 + filteredRoles.length} className="py-12 text-center text-slate-400 font-bold uppercase tracking-wider">
                      No matching system resources found.
                    </td>
                  </tr>
                ) : (
                  filteredModules.map((moduleName, index) => {
                    const modulePerms = permissions.filter(p => p.module === moduleName);
                    const category = getModuleCategory(moduleName);

                    const viewPerm = modulePerms.find(p => p.name.startsWith('view_'));
                    const createPerm = modulePerms.find(p => p.name.startsWith('create_'));
                    const editPerm = modulePerms.find(p => p.name.startsWith('edit_') || p.name.startsWith('update_') || p.name.startsWith('calculate_'));
                    const deletePerm = modulePerms.find(p => p.name.startsWith('delete_'));

                    return (
                      <tr key={moduleName} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/60 transition-colors">
                        {/* Serial Number */}
                        <td className="py-4 px-4 text-center text-xs font-black text-slate-400 dark:text-slate-500 font-sans">
                          {index + 1}
                        </td>

                        {/* Module Table Identifier */}
                        <td className="py-4 px-5">
                          <span className="inline-block px-3 py-1 rounded-xl bg-amber-500/10 text-amber-900 dark:text-amber-300 border border-amber-500/20 text-xs font-black uppercase tracking-wider shadow-2xs font-sans">
                            {moduleName.toLowerCase().replace(/\s+/g, '_')}
                          </span>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-1 font-sans">
                            ({modulePerms.length} actions configured)
                          </p>
                        </td>

                        {/* Category Pill */}
                        <td className="py-4 px-4">
                          <span className="inline-block px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 text-[9.5px] font-extrabold tracking-wide">
                            {category}
                          </span>
                        </td>

                        {/* Role Columns */}
                        {filteredRoles.map(role => {
                          const rolePermIds = rolePermissionsState[role.id] || [];
                          const primaryPerm = viewPerm || createPerm || editPerm || deletePerm;
                          const activeScope = primaryPerm ? (roleScopesState[role.id]?.[primaryPerm.id] || 'ALL') : 'ALL';

                          return (
                            <td key={role.id} className="py-4 px-4 text-center">
                              <div className="inline-flex flex-col items-center gap-1 p-2 rounded-2xl bg-slate-100/60 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 min-w-[130px]">
                                {/* Action Badges (V C E D) */}
                                <div className="inline-flex items-center gap-1">
                                  {/* V (View) */}
                                  {viewPerm ? (
                                    <button
                                      type="button"
                                      onClick={() => togglePermissionAutoSave(role.id, viewPerm.id)}
                                      title={`View ${moduleName}`}
                                      className={`w-6.5 h-6.5 rounded-lg text-[10px] font-black font-sans transition-all flex items-center justify-center cursor-pointer ${rolePermIds.includes(viewPerm.id)
                                        ? 'bg-emerald-500 text-white dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-500 dark:border-emerald-700 shadow-xs'
                                        : 'bg-slate-200/60 text-slate-400 dark:bg-slate-850 dark:text-slate-600 border border-transparent hover:text-slate-600 dark:hover:text-slate-300'
                                        }`}
                                    >
                                      V
                                    </button>
                                  ) : (
                                    <span className="w-6.5 h-6.5 rounded-lg text-[10px] font-sans font-bold text-slate-300 dark:text-slate-700 flex items-center justify-center opacity-40">v</span>
                                  )}

                                  {/* C (Create) */}
                                  {createPerm ? (
                                    <button
                                      type="button"
                                      onClick={() => togglePermissionAutoSave(role.id, createPerm.id)}
                                      title={`Create ${moduleName}`}
                                      className={`w-6.5 h-6.5 rounded-lg text-[10px] font-black font-sans transition-all flex items-center justify-center cursor-pointer ${rolePermIds.includes(createPerm.id)
                                        ? 'bg-emerald-500 text-white dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-500 dark:border-emerald-700 shadow-xs'
                                        : 'bg-slate-200/60 text-slate-400 dark:bg-slate-850 dark:text-slate-600 border border-transparent hover:text-slate-600 dark:hover:text-slate-300'
                                        }`}
                                    >
                                      C
                                    </button>
                                  ) : (
                                    <span className="w-6.5 h-6.5 rounded-lg text-[10px] font-sans font-bold text-slate-300 dark:text-slate-700 flex items-center justify-center opacity-40">c</span>
                                  )}

                                  {/* E (Edit) */}
                                  {editPerm ? (
                                    <button
                                      type="button"
                                      onClick={() => togglePermissionAutoSave(role.id, editPerm.id)}
                                      title={`Edit ${moduleName}`}
                                      className={`w-6.5 h-6.5 rounded-lg text-[10px] font-black font-sans transition-all flex items-center justify-center cursor-pointer ${rolePermIds.includes(editPerm.id)
                                        ? 'bg-emerald-500 text-white dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-500 dark:border-emerald-700 shadow-xs'
                                        : 'bg-slate-200/60 text-slate-400 dark:bg-slate-850 dark:text-slate-600 border border-transparent hover:text-slate-600 dark:hover:text-slate-300'
                                        }`}
                                    >
                                      E
                                    </button>
                                  ) : (
                                    <span className="w-6.5 h-6.5 rounded-lg text-[10px] font-sans font-bold text-slate-300 dark:text-slate-700 flex items-center justify-center opacity-40">e</span>
                                  )}

                                  {/* D (Delete) */}
                                  {deletePerm ? (
                                    <button
                                      type="button"
                                      onClick={() => togglePermissionAutoSave(role.id, deletePerm.id)}
                                      title={`Delete ${moduleName}`}
                                      className={`w-6.5 h-6.5 rounded-lg text-[10px] font-black font-sans transition-all flex items-center justify-center cursor-pointer ${rolePermIds.includes(deletePerm.id)
                                        ? 'bg-rose-500 text-white dark:bg-rose-950/60 dark:text-rose-400 border border-rose-500 dark:border-rose-700 shadow-xs'
                                        : 'bg-slate-200/60 text-slate-400 dark:bg-slate-850 dark:text-slate-600 border border-transparent hover:text-slate-600 dark:hover:text-slate-300'
                                        }`}
                                    >
                                      D
                                    </button>
                                  ) : (
                                    <span className="w-6.5 h-6.5 rounded-lg text-[10px] font-sans font-bold text-slate-300 dark:text-slate-700 flex items-center justify-center opacity-40">d</span>
                                  )}
                                </div>

                                {/* Data Scope Badges Row (S T D A) */}
                                {primaryPerm && rolePermIds.some(id => modulePerms.map(p => p.id).includes(id)) && (
                                  <div className="inline-flex items-center gap-1 pt-1.5 mt-0.5 border-t border-slate-200/50 dark:border-slate-800/60 w-full justify-center font-sans">
                                    {[
                                      { key: 'SELF', letter: 'S', title: 'Self Only (🔒 S)' },
                                      { key: 'REPORTING', letter: 'T', title: 'Team / Subordinates (👥 T)' },
                                      { key: 'DEPARTMENT', letter: 'D', title: 'Department (🏢 D)' },
                                      { key: 'ALL', letter: 'A', title: 'All Company (🌐 A)' }
                                    ].map(sc => {
                                      const isSelected = activeScope === sc.key;
                                      return (
                                        <button
                                          key={sc.key}
                                          type="button"
                                          onClick={() => {
                                            const activeIds = modulePerms.filter(p => rolePermIds.includes(p.id)).map(p => p.id);
                                            handleScopeChange(role.id, activeIds, sc.key);
                                          }}
                                          title={sc.title}
                                          className={`w-6.5 h-6.5 rounded-lg text-[10px] font-black font-sans transition-all flex items-center justify-center cursor-pointer ${isSelected
                                            ? 'bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white border border-indigo-600 shadow-xs scale-105'
                                            : 'bg-slate-200/60 text-slate-400 dark:bg-slate-850 dark:text-slate-600 border border-transparent hover:text-slate-700 dark:hover:text-slate-300'
                                            }`}
                                        >
                                          {sc.letter}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Modern 2-Tier Layout: Roles in Top Row, Modules and Matrix Below */
        <div className="space-y-6 w-full">
          {/* Tier 1: App Roles List (Horizontal Scrollable Row) */}
          <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-card p-6 shadow-sm relative overflow-hidden group hover:border-slate-350 dark:hover:border-slate-700/80 hover:shadow-md transition-all duration-300 w-full text-left">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-indigo-500" />
            <div className="space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/60 pb-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.97 5.97 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94-3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                    </svg>
                  </span>
                  <div>
                    <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">App Roles</h4>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-0.5">Select a system access profile to configure policy matrix</p>
                  </div>
                </div>

                {/* Filtering & Quick Search Control Panel */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 w-full lg:max-w-2xl justify-end">

                  {/* Quick Search Roles */}
                  <div className="relative w-full sm:max-w-xs">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </span>
                    <input
                      type="text"
                      placeholder="Search roles..."
                      value={searchRoleQuery}
                      onChange={e => setSearchRoleQuery(e.target.value)}
                      className="w-full pr-10 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all duration-200 placeholder-slate-400 pl-search"
                    />
                    <span className="absolute right-3 top-2 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[9px] text-slate-500 dark:text-slate-400 uppercase font-black tracking-widest">
                      {filteredRoles.length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Horizontal Scrollable Row list */}
              <div
                className="flex gap-4 overflow-x-auto pb-3 pt-1 scroll-smooth"
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'rgba(99, 102, 241, 0.3) transparent'
                }}
              >
                {filteredRoles.length === 0 ? (
                  <div className="py-4 text-center text-slate-400 dark:text-slate-500 font-bold text-xs select-none w-full">
                    No roles match search query filter.
                  </div>
                ) : (
                  filteredRoles.map(role => {
                    const isActive = role.id === selectedRoleId;
                    const keyCount = rolePermissionsState[role.id]?.length || 0;
                    return (
                      <div
                        key={role.id}
                        onClick={() => setSelectedRoleId(role.id)}
                        className={`relative group rounded-2xl border p-4 cursor-pointer transition-all duration-300 flex items-center justify-between hover:scale-[1.02] flex-shrink-0 min-w-[200px] ${isActive
                          ? 'bg-indigo-50/70 dark:bg-indigo-950/20 border-indigo-500 dark:border-indigo-500/80 shadow-md shadow-indigo-550/10 text-indigo-600 dark:text-indigo-400 font-black scale-[1.02]'
                          : 'bg-white dark:bg-slate-900/15 border-slate-200 dark:border-slate-850 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 text-slate-800 dark:text-slate-200'
                          }`}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-3 bottom-3 w-1 bg-indigo-500 rounded-r-full animate-pulse" />
                        )}
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1.5 truncate">
                              <h5 className={`text-[12px] font-black uppercase tracking-wider truncate ${isActive ? 'text-indigo-600 dark:text-indigo-400 font-black' : 'text-slate-800 dark:text-slate-200'}`}>
                                {role.name}
                              </h5>
                              {role.company_name && (
                                <span className={`text-[8px] px-1.5 py-0.5 rounded font-extrabold max-w-[80px] truncate ${isActive ? 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-400/10 dark:text-indigo-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`} title={role.company_name}>
                                  {role.company_name}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => handleOpenEditRole(role, e)}
                                title="Edit role name"
                                className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors p-1"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.83 20.089a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                </svg>
                              </button>
                              <button
                                onClick={(e) => handleDeleteRole(role, e)}
                                title="Delete role"
                                className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors p-1"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          <span className={`text-[9px] font-semibold tracking-wider block mt-1 ${isActive ? 'text-indigo-550 dark:text-indigo-400/80' : 'text-slate-400 dark:text-slate-500'}`}>
                            KEY: {role.name.toLowerCase().replace(/\s+/g, '_')}
                          </span>
                        </div>
                        <span className={`text-[10px] h-6 px-2.5 rounded-full font-black flex items-center justify-center border ${isActive ? 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' : 'bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-slate-200/50 dark:border-slate-800'
                          }`}>
                          {keyCount}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Tier 2: Accordion Resource Modules Matrix */}
          <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-card p-6 shadow-sm relative overflow-hidden group hover:border-slate-350 dark:hover:border-slate-700/80 hover:shadow-md transition-all duration-300 w-full text-left">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-purple-500" />
            <div className="space-y-6">

              {/* Header: Title on Left, Searches on Right */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/60 pb-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                    </svg>
                  </span>
                  <div>
                    <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Resource Modules Matrix</h4>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-0.5">Click a module to expand its granular permissions policy</p>
                  </div>
                </div>

                {/* Search fields */}
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:max-w-md justify-end">
                  <div className="relative w-full">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </span>
                    <input
                      type="text"
                      placeholder="Search modules or permissions..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/60 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all duration-200 placeholder-slate-400/80 pl-search"
                    />
                  </div>
                </div>
              </div>

              {/* Accordion Rows container */}
              <div className="space-y-4">
                {filteredModules.map(moduleName => {
                  const modulePermissions = permissions
                    .filter(p => p.module === moduleName)
                    .filter(p => {
                      if (moduleName.toLowerCase().includes(searchQuery.toLowerCase())) return true;
                      return (
                        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        p.description.toLowerCase().includes(searchQuery.toLowerCase())
                      );
                    })
                    .sort((a, b) => getActionWeight(a.name) - getActionWeight(b.name));

                  if (searchQuery && modulePermissions.length === 0) return null;

                  const isExpanded = expandedModule === moduleName;
                  const activeRolePermissions = selectedRoleId ? rolePermissionsState[selectedRoleId] || [] : [];

                  return (
                    <div
                      key={moduleName}
                      className={`rounded-2xl border transition-all duration-300 overflow-hidden ${isExpanded
                        ? 'border-purple-500/40 dark:border-purple-500/30 bg-white dark:bg-slate-900/20 shadow-md shadow-purple-500/5 ring-1 ring-purple-500/10'
                        : 'border-slate-200/70 dark:border-slate-850/80 bg-white dark:bg-slate-900/10 hover:border-slate-350 dark:hover:border-slate-750 hover:shadow-xs'
                        }`}
                    >
                      {/* Accordion Trigger Header */}
                      <div
                        onClick={() => setExpandedModule(isExpanded ? null : moduleName)}
                        className="px-6 py-4 flex items-center justify-between cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-3.5">
                          <span className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${isExpanded
                            ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                            }`}>
                            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </span>
                          <span className="text-xs font-black uppercase tracking-wider text-slate-850 dark:text-slate-200">
                            {moduleName}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className={`text-[10px] h-6 px-2.5 rounded-full font-black flex items-center justify-center border ${isExpanded
                            ? 'bg-purple-600 text-white border-purple-600'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-650 dark:text-slate-400 border-slate-200/50 dark:border-slate-800'
                            }`}>
                            {modulePermissions.length}
                          </span>

                          <svg
                            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isExpanded ? 'transform rotate-180 text-purple-500' : ''
                              }`}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                          </svg>
                        </div>
                      </div>

                      {/* Accordion Expandable panel */}
                      {isExpanded && (
                        <div className="px-6 pb-6 pt-2 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50/10 dark:bg-slate-900/5 animate-slideDown">
                          <div className="flex items-center justify-between pb-3 border-b border-slate-100/80 dark:border-slate-800/40">
                            <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                              Granular Permissions Matrix
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleSelectAllForModule(moduleName)}
                                disabled={savingRoleId !== null}
                                className="px-3 py-1.5 rounded-xl border border-indigo-500/20 hover:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-black tracking-wide uppercase transition-all cursor-pointer disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]"
                              >
                                Allow All
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeselectAllForModule(moduleName)}
                                disabled={savingRoleId !== null}
                                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-400 bg-slate-50 dark:bg-slate-950/30 text-slate-600 dark:text-slate-400 text-[10px] font-black tracking-wide uppercase transition-all cursor-pointer disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]"
                              >
                                Revoke All
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
                            {(() => {
                              const viewPermission = modulePermissions.find(p => p.name.startsWith('view_'));
                              const isViewChecked = viewPermission ? activeRolePermissions.includes(viewPermission.id) : true;

                              return modulePermissions.map(p => {
                                const isChecked = activeRolePermissions.includes(p.id);
                                const action = getActionType(p.name);
                                const isViewAction = p.name.startsWith('view_');
                                const isToggleDisabled = savingRoleId !== null || (!isViewAction && !isViewChecked);

                                let actionBadgeColor = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-350";
                                if (action === "VIEW") actionBadgeColor = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20";
                                else if (action === "CREATE") actionBadgeColor = "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20";
                                else if (action === "EDIT" || action === "CALCULATE") actionBadgeColor = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20";
                                else if (action === "DELETE") actionBadgeColor = "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20";

                                return (
                                  <div
                                    key={p.id}
                                    className={`rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/10 p-4 relative flex flex-col justify-between min-h-[135px] hover:border-slate-350 dark:hover:border-slate-700/80 transition-all duration-200 ${!isViewAction && !isViewChecked ? 'opacity-40 select-none' : ''
                                      }`}
                                  >
                                    <div className="flex items-center justify-between w-full">
                                      <span className={`text-[8.5px] px-2 py-0.5 rounded font-black tracking-widest uppercase ${actionBadgeColor}`}>
                                        {action}
                                      </span>

                                      <button
                                        type="button"
                                        disabled={isToggleDisabled}
                                        onClick={() => !isToggleDisabled && selectedRoleId && togglePermissionAutoSave(selectedRoleId, p.id)}
                                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-250 ease-in-out outline-none focus:outline-none ${isChecked
                                          ? 'bg-indigo-600 shadow shadow-indigo-600/30'
                                          : 'bg-slate-200 dark:bg-slate-850'
                                          } ${isToggleDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                                      >
                                        <span
                                          aria-hidden="true"
                                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-250 ease-in-out ${isChecked ? 'translate-x-4' : 'translate-x-0'
                                            }`}
                                        />
                                      </button>
                                    </div>

                                    <div className="mt-4 flex-1">
                                      <div className="font-mono font-bold text-slate-800 dark:text-slate-100 text-[11.5px] truncate" title={p.name}>
                                        {p.name}
                                      </div>
                                      <p className="text-[10px] text-slate-450 dark:text-slate-500 font-semibold leading-relaxed mt-1.5 line-clamp-2" title={p.description}>
                                        {p.description || 'Allow performing this module action.'}
                                      </p>
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                          </div>

                          {savingRoleId && (
                            <div className="pt-4 mt-4 flex items-center justify-center gap-2 text-indigo-600 dark:text-indigo-400 animate-pulse text-[10px] font-black uppercase tracking-wider border-t border-slate-100 dark:border-slate-800/60">
                              <div className="h-3 w-3 rounded-full border-2 border-indigo-600 dark:border-indigo-400 border-t-transparent animate-spin" />
                              <span>Realtime Sync Active...</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Slide Drawer to Create a Role */}
      <SlideDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} title="Create System Role">
        <form onSubmit={handleCreateRole} className="space-y-5 text-left">
          {isSuperAdmin && (
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-550 dark:text-slate-400 uppercase tracking-widest mb-1.5">Target Company Context *</label>
              <SearchableSelect
                placeholder="Select Company Context"
                options={companies.map(c => ({ value: c.id, label: c.name }))}
                value={companyId || ''}
                onChange={val => handleCompanyChange(val)}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-555 dark:text-slate-400 uppercase tracking-widest">
              Role Name Identifier *
            </label>
            <input
              type="text" placeholder="e.g. HRManager"
              value={roleForm.name}
              onChange={e => setRoleForm({ ...roleForm, name: e.target.value })}
              className={inputStyle}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-555 dark:text-slate-400 uppercase tracking-widest">
              Description *
            </label>
            <input
              type="text" placeholder="e.g. Manages departments & approvals"
              value={roleForm.description}
              onChange={e => setRoleForm({ ...roleForm, description: e.target.value })}
              className={inputStyle}
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-indigo-600/35 transition-all duration-200 cursor-pointer mt-4 active:scale-[0.98]"
          >
            Create Access Role
          </button>
        </form>
      </SlideDrawer>

      {/* Slide Drawer to Edit Role */}
      <SlideDrawer isOpen={editRoleDrawerOpen} onClose={() => setEditRoleDrawerOpen(false)} title="Edit Access Role">
        <form onSubmit={handleUpdateRole} className="space-y-5 text-left">
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-555 dark:text-slate-400 uppercase tracking-widest">
              Role Name Identifier *
            </label>
            <input
              type="text" placeholder="e.g. Management"
              value={editRoleForm.name}
              onChange={e => setEditRoleForm({ ...editRoleForm, name: e.target.value })}
              className={inputStyle}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-555 dark:text-slate-400 uppercase tracking-widest">
              Description *
            </label>
            <input
              type="text" placeholder="e.g. Manages organization operations"
              value={editRoleForm.description}
              onChange={e => setEditRoleForm({ ...editRoleForm, description: e.target.value })}
              className={inputStyle}
            />
          </div>

          <button type="submit" className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-black shadow-lg shadow-indigo-600/30 transition-all duration-200 cursor-pointer uppercase tracking-wider">
            Save Role Changes
          </button>
        </form>
      </SlideDrawer>
    </div>
  );
}
