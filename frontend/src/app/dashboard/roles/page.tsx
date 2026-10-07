'use client';

import React, { useEffect, useState } from 'react';
import DashboardPageHeader from '../components/DashboardPageHeader';
import { getHeaders, getUrl } from '../utils/api';
import SlideDrawer from '../components/SlideDrawer';
import { useDashboard } from '../components/DashboardContext';
import SearchableSelect from '../components/SearchableSelect';
import { Pencil, Trash2 } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '../../../components/ui/tooltip';
import PageLoader from '@/components/ui/PageLoader';

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

  const [loading, setLoading] = useState(true);
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
  const [isCreatingRole, setIsCreatingRole] = useState(false);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [editRoleForm, setEditRoleForm] = useState({ name: '', description: '' });

  // View Switcher (Matrix Table vs Card Accordion)
  const [viewMode, setViewMode] = useState<'matrix' | 'card'>('card');

  // Map roleId -> Array of checked permissionIds
  const [rolePermissionsState, setRolePermissionsState] = useState<Record<string, string[]>>({});
  // Map roleId -> { [permId]: 'SELF' | 'REPORTING' | 'DEPARTMENT' | 'ALL' }
  const [roleScopesState, setRoleScopesState] = useState<Record<string, Record<string, string>>>({});
  // Scope popover state: `${roleId}_${moduleName}`
  const [openScopeMenu, setOpenScopeMenu] = useState<string | null>(null);

  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('superadmin');
  const isAdminOrSuperAdmin = isSuperAdmin || roles.some(r => r.toLowerCase().includes('admin'));

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
    const cleanName = roleForm.name.trim();
    if (!cleanName) {
      showToast('Role Name Identifier is required', 'error');
      return;
    }
    if (!roleForm.description?.trim()) {
      showToast('Role description is required', 'error');
      return;
    }

    // Duplicate check within currently active company
    const isDuplicate = tenantRoles.some(r => r.name.trim().toLowerCase() === cleanName.toLowerCase());
    if (isDuplicate) {
      showToast(`A role with the name "${cleanName}" already exists in this company`, 'error');
      return;
    }

    setIsCreatingRole(true);
    try {
      const res = await fetch('/api/v1/roles', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ ...roleForm, name: cleanName, companyId })
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
    } finally {
      setIsCreatingRole(false);
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
    const cleanName = editRoleForm.name.trim();
    if (!cleanName) {
      showToast('Role Name is required', 'error');
      return;
    }

    // Duplicate check on update within currently active company
    const isDuplicate = tenantRoles.some(
      r => r.id !== editingRole.id && r.name.trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (isDuplicate) {
      showToast(`A role with the name "${cleanName}" already exists in this company`, 'error');
      return;
    }

    setIsUpdatingRole(true);
    try {
      const res = await fetch(`/api/v1/roles/${editingRole.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ ...editRoleForm, name: cleanName })
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
    } finally {
      setIsUpdatingRole(false);
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
    const currentScopes = { ...(roleScopesState[roleId] || {}) };
    let newList: string[];

    const targetPerm = permissions.find(p => p.id === permId);
    const isViewAction = targetPerm?.name.endsWith('_view') || getActionType(targetPerm?.name || '') === 'VIEW';

    if (currentList.includes(permId)) {
      if (isViewAction && targetPerm) {
        // If revoking view, automatically revoke all actions (create, edit, delete, etc.) for this module
        const modulePermIds = permissions.filter(p => p.module === targetPerm.module).map(p => p.id);
        newList = currentList.filter(id => !modulePermIds.includes(id));
      } else {
        newList = currentList.filter(id => id !== permId);
      }
    } else {
      // If granting action, ensure view is also granted
      if (!isViewAction && targetPerm) {
        const viewPerm = permissions.find(p => p.module === targetPerm.module && (p.name.endsWith('_view') || getActionType(p.name) === 'VIEW'));
        if (viewPerm && !currentList.includes(viewPerm.id)) {
          newList = [...currentList, viewPerm.id, permId];
          if (!currentScopes[viewPerm.id]) currentScopes[viewPerm.id] = 'SELF';
        } else {
          newList = [...currentList, permId];
        }
      } else {
        newList = [...currentList, permId];
      }
      if (!currentScopes[permId]) {
        currentScopes[permId] = 'SELF';
      }
    }

    // Optimistic UI Update
    setRolePermissionsState(prev => ({
      ...prev,
      [roleId]: newList
    }));
    setRoleScopesState(prev => ({
      ...prev,
      [roleId]: currentScopes
    }));

    try {
      setSavingRoleId(roleId);
      const res = await fetch(`/api/v1/roles/${roleId}/permissions`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ permissionIds: newList, permissionScopes: currentScopes, companyId })
      });
      if (res.ok) {
        showToast('Permission settings saved successfully!', 'success');
        const refreshRes = await fetch(getUrl('/api/v1/roles', companyId), { headers: getHeaders() });
        const refreshData = await refreshRes.json();
        if (refreshRes.ok) {
          setTenantRoles(refreshData.roles || []);
        }
      } else {
        showToast('Failed to synchronize permission changes', 'error');
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

    const currentPermIds = rolePermissionsState[roleId] || [];
    const newScopes = { ...currentScopes };
    idsToUpdate.forEach(id => {
      newScopes[id] = scope;
    });

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
        const refreshRes = await fetch(getUrl('/api/v1/roles', companyId), { headers: getHeaders() });
        const refreshData = await refreshRes.json();
        if (refreshRes.ok) {
          setTenantRoles(refreshData.roles || []);
        }
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
    if (name.endsWith('_view')) return 1;
    if (name.endsWith('_create')) return 2;
    if (name.endsWith('_edit') || name.endsWith('_update')) return 3;
    if (name.endsWith('_delete')) return 4;
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

  const SCOPE_CYCLE = ['SELF', 'REPORTING', 'DEPARTMENT', 'ALL'];
  const getNextScope = (currentScope: string) => {
    const idx = SCOPE_CYCLE.indexOf(currentScope);
    return idx === -1 || idx === SCOPE_CYCLE.length - 1 ? SCOPE_CYCLE[0] : SCOPE_CYCLE[idx + 1];
  };

  const getScopeBadge = (scope: string, isGranted: boolean = true) => {
    if (!isGranted) {
      return { letter: '-', color: 'bg-slate-200/60 text-slate-400 dark:bg-slate-800 dark:text-slate-600', label: 'Revoked — No access' };
    }
    switch (scope) {
      case 'SELF': return { letter: 'S', color: 'bg-amber-500 text-white dark:bg-amber-500 dark:text-white', label: 'Self — Own records only' };
      case 'REPORTING': return { letter: 'T', color: 'bg-emerald-500 text-white dark:bg-emerald-500 dark:text-white', label: 'Team — Reporting team' };
      case 'DEPARTMENT': return { letter: 'D', color: 'bg-purple-500 text-white dark:bg-purple-500 dark:text-white', label: 'Dept — Department records' };
      case 'ALL':
      default:
        return { letter: 'A', color: 'bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white', label: 'All — Company-wide' };
    }
  };

  const getActionType = (name: string) => {
    if (name.endsWith('_view')) return 'VIEW';
    if (name.endsWith('_create')) return 'CREATE';
    if (name.endsWith('_edit') || name.endsWith('_update')) return 'EDIT';
    if (name.endsWith('_delete')) return 'DELETE';
    if (name.endsWith('_manage')) return 'MANAGE';
    if (name.endsWith('_calculate')) return 'CALCULATE';
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

  const inputStyle = "w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40 px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-purple-500 focus:bg-card focus:ring-4 focus:ring-purple-500/10 transition-all duration-200 placeholder-slate-400 font-dmsans";

  if (roles.length > 0 && !isAdminOrSuperAdmin) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center p-6 animate-fadeIn font-dmsans">
        <div className="h-16 w-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4 text-3xl">
          🔒
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Access Restricted</h3>
        <p className="text-slate-500 dark:text-slate-400 text-xs mt-1.5 max-w-sm">
          The Roles & Access Policies console is restricted exclusively to Company Administrators and Super Administrators.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn w-full pb-32 font-dmsans">

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
            {/* Legend for Action & Data Scope */}
            <div className="hidden lg:flex flex-col items-end gap-1.5">
              <div className="flex items-center gap-1.5 text-[9px] font-black tracking-wider uppercase bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-800 font-sans">
                <Tooltip>
                  <TooltipTrigger>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold cursor-help">V = View</span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">V = View: Read-only</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger>
                    <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold cursor-help">C = Create</span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">C = Create: Add records</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger>
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold cursor-help">E = Edit</span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">E = Edit: Update records</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger>
                    <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold cursor-help">D = Delete</span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">D = Delete: Remove records</TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center gap-1.5 text-[9px] font-black tracking-wider uppercase bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-800 font-sans">
                <Tooltip>
                  <TooltipTrigger>
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold cursor-help">S = Self</span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">S = Self: Own records only</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold cursor-help">T = Team</span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">T = Team: Direct team records</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger>
                    <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-600 dark:text-purple-400 font-bold cursor-help">D = Dept</span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">D = Dept: Department records</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger>
                    <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold cursor-help">A = All</span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">A = All: Company-wide access</TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* View Mode Switcher */}
            <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-800 font-sans">
              <Tooltip>
                <TooltipTrigger>
                  <button
                    type="button"
                    onClick={() => setViewMode('card')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      viewMode === 'card'
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                    </svg>
                    <span>Granular</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Granular Policies View</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger>
                  <button
                    type="button"
                    onClick={() => setViewMode('matrix')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      viewMode === 'matrix'
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                    </svg>
                    <span>Matrix</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Matrix Grid View</TooltipContent>
              </Tooltip>
            </div>

            <button
              onClick={() => setDrawerOpen(true)}
              className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-[#07518a] hover:bg-[#064270] text-white text-xs font-black shadow-md shadow-[#07518a]/30 hover:shadow-lg hover:shadow-[#07518a]/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer group flex-shrink-0"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-white/20 group-hover:bg-white/30 transition-all">
                <svg className="w-3.5 h-3.5 stroke-[3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </span>
              <span className="tracking-wider uppercase text-[10px]">Create Role</span>
            </button>
          </div>
        </DashboardPageHeader>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 p-8 shadow-xs">
          <PageLoader message="Loading Role Access Policies..." />
        </div>
      ) : viewMode === 'matrix' ? (
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
                        <Tooltip>
                          <TooltipTrigger>
                            <button
                              onClick={(e) => handleOpenEditRole(role, e)}
                              className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors p-0.5 cursor-pointer flex items-center justify-center"
                            >
                              <Pencil className="w-3.5 h-3.5 stroke-[2]" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">Edit Role</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger>
                            <button
                              onClick={(e) => handleDeleteRole(role, e)}
                              className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors p-0.5 cursor-pointer flex items-center justify-center"
                            >
                              <Trash2 className="w-3.5 h-3.5 stroke-[2]" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">Delete Role</TooltipContent>
                        </Tooltip>
                      </div>
                      <span className="text-[9.5px] font-bold text-indigo-600 dark:text-indigo-400 block uppercase tracking-wider">
                        {rolePermissionsState[role.id]?.length || 0} PERMISSIONS
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

                    const viewPerm = modulePerms.find(p => p.name.endsWith('_view'));
                    const createPerm = modulePerms.find(p => p.name.endsWith('_create'));
                    const editPerm = modulePerms.find(p => p.name.endsWith('_edit') || p.name.endsWith('_update') || p.name.endsWith('_calculate'));
                    const deletePerm = modulePerms.find(p => p.name.endsWith('_delete'));

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
                              <div className="inline-flex flex-col items-center gap-1.5 p-2 rounded-2xl bg-slate-100/60 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 min-w-[130px]">
                                {/* Action Badges (V C E D) */}
                                <div className="inline-flex items-center gap-1">
                                  {/* V (View) */}
                                  {viewPerm ? (
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <button
                                          type="button"
                                          onClick={() => togglePermissionAutoSave(role.id, viewPerm.id)}
                                          className={`w-6.5 h-6.5 rounded-lg text-[10px] font-black font-sans transition-all flex items-center justify-center cursor-pointer ${rolePermIds.includes(viewPerm.id)
                                            ? 'bg-emerald-500 text-white dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-500 dark:border-emerald-700 shadow-xs'
                                            : 'bg-slate-200/60 text-slate-400 dark:bg-slate-850 dark:text-slate-600 border border-transparent hover:text-slate-600 dark:hover:text-slate-300'
                                            }`}
                                        >
                                          V
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="text-left whitespace-normal max-w-[180px] p-2 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xl border border-slate-800 dark:border-slate-200">
                                        <div className="font-bold text-[11px]">V — View: {moduleName}</div>
                                        <div className="text-[10px] opacity-80 mt-0.5">
                                          {rolePermIds.includes(viewPerm.id) ? 'Granted — click to revoke' : 'Revoked — click to grant'}
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    <span className="w-6.5 h-6.5 rounded-lg text-[10px] font-sans font-bold text-slate-300 dark:text-slate-700 flex items-center justify-center opacity-40">-</span>
                                  )}

                                  {/* C (Create) */}
                                  {createPerm ? (
                                    createPerm.name === 'companies_create' ? (
                                      <Tooltip>
                                        <TooltipTrigger>
                                          <span className="w-6.5 h-6.5 rounded-lg text-[10px] font-sans font-bold text-slate-300 dark:text-slate-700 flex items-center justify-center opacity-30 cursor-not-allowed">
                                            C
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="text-left whitespace-normal max-w-[210px] p-2 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xl border border-slate-800 dark:border-slate-200">
                                          <div className="font-bold text-[11px] text-rose-400 dark:text-rose-600">⛔ Restricted</div>
                                          <div className="text-[10px] opacity-80 mt-0.5">Only SuperAdmin can create companies</div>
                                        </TooltipContent>
                                      </Tooltip>
                                    ) : (
                                      <Tooltip>
                                        <TooltipTrigger>
                                          <button
                                            type="button"
                                            onClick={() => togglePermissionAutoSave(role.id, createPerm.id)}
                                            className={`w-6.5 h-6.5 rounded-lg text-[10px] font-black font-sans transition-all flex items-center justify-center cursor-pointer ${rolePermIds.includes(createPerm.id)
                                              ? 'bg-emerald-500 text-white dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-500 dark:border-emerald-700 shadow-xs'
                                              : 'bg-slate-200/60 text-slate-400 dark:bg-slate-850 dark:text-slate-600 border border-transparent hover:text-slate-600 dark:hover:text-slate-300'
                                              }`}
                                          >
                                            C
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="text-left whitespace-normal max-w-[180px] p-2 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xl border border-slate-800 dark:border-slate-200">
                                          <div className="font-bold text-[11px]">C — Create: {moduleName}</div>
                                          <div className="text-[10px] opacity-80 mt-0.5">
                                            {rolePermIds.includes(createPerm.id) ? 'Granted — click to revoke' : 'Revoked — click to grant'}
                                          </div>
                                        </TooltipContent>
                                      </Tooltip>
                                    )
                                  ) : (
                                    <span className="w-6.5 h-6.5 rounded-lg text-[10px] font-sans font-bold text-slate-300 dark:text-slate-700 flex items-center justify-center opacity-40">-</span>
                                  )}

                                  {/* E (Edit) */}
                                  {editPerm ? (
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <button
                                          type="button"
                                          onClick={() => togglePermissionAutoSave(role.id, editPerm.id)}
                                          className={`w-6.5 h-6.5 rounded-lg text-[10px] font-black font-sans transition-all flex items-center justify-center cursor-pointer ${rolePermIds.includes(editPerm.id)
                                            ? 'bg-emerald-500 text-white dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-500 dark:border-emerald-700 shadow-xs'
                                            : 'bg-slate-200/60 text-slate-400 dark:bg-slate-850 dark:text-slate-600 border border-transparent hover:text-slate-600 dark:hover:text-slate-300'
                                            }`}
                                        >
                                          E
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="text-left whitespace-normal max-w-[180px] p-2 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xl border border-slate-800 dark:border-slate-200">
                                        <div className="font-bold text-[11px]">E — Edit: {moduleName}</div>
                                        <div className="text-[10px] opacity-80 mt-0.5">
                                          {rolePermIds.includes(editPerm.id) ? 'Granted — click to revoke' : 'Revoked — click to grant'}
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    <span className="w-6.5 h-6.5 rounded-lg text-[10px] font-sans font-bold text-slate-300 dark:text-slate-700 flex items-center justify-center opacity-40">-</span>
                                  )}

                                  {/* D (Delete) */}
                                  {deletePerm ? (
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <button
                                          type="button"
                                          onClick={() => togglePermissionAutoSave(role.id, deletePerm.id)}
                                          className={`w-6.5 h-6.5 rounded-lg text-[10px] font-black font-sans transition-all flex items-center justify-center cursor-pointer ${rolePermIds.includes(deletePerm.id)
                                            ? 'bg-rose-500 text-white dark:bg-rose-950/60 dark:text-rose-400 border border-rose-500 dark:border-rose-700 shadow-xs'
                                            : 'bg-slate-200/60 text-slate-400 dark:bg-slate-850 dark:text-slate-600 border border-transparent hover:text-slate-600 dark:hover:text-slate-300'
                                            }`}
                                        >
                                          D
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="text-left whitespace-normal max-w-[180px] p-2 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xl border border-slate-800 dark:border-slate-200">
                                        <div className="font-bold text-[11px]">D — Delete: {moduleName}</div>
                                        <div className="text-[10px] opacity-80 mt-0.5">
                                          {rolePermIds.includes(deletePerm.id) ? 'Granted — click to revoke' : 'Revoked — click to grant'}
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    <span className="w-6.5 h-6.5 rounded-lg text-[10px] font-sans font-bold text-slate-300 dark:text-slate-700 flex items-center justify-center opacity-40">-</span>
                                  )}
                                </div>

                                {/* Individual Data Scope Badges Row: 1 Scope Pill per Action */}
                                <div className="inline-flex items-center gap-1 pt-1.5 mt-0.5 border-t border-slate-200/50 dark:border-slate-800/60 w-full justify-center font-sans">
                                  {[
                                    { perm: viewPerm, action: 'View' },
                                    { perm: createPerm, action: 'Create' },
                                    { perm: editPerm, action: 'Edit' },
                                    { perm: deletePerm, action: 'Delete' }
                                  ].map((item, i) => {
                                    if (!item.perm) {
                                      return (
                                        <span key={i} className="w-6.5 h-6.5 rounded-lg text-[10px] font-sans font-bold text-slate-300 dark:text-slate-700 flex items-center justify-center opacity-20">-</span>
                                      );
                                    }
                                    const isPermActive = rolePermIds.includes(item.perm.id);
                                    const permScope = roleScopesState[role.id]?.[item.perm.id] || 'SELF';
                                    const badge = getScopeBadge(permScope, isPermActive);
                                    const nextScope = getNextScope(permScope);
                                    const nextBadge = getScopeBadge(nextScope, true);

                                    return (
                                      <Tooltip key={i}>
                                        <TooltipTrigger>
                                          <button
                                            type="button"
                                            disabled={savingRoleId !== null || !isPermActive}
                                            onClick={() => isPermActive && handleScopeChange(role.id, item.perm!.id, nextScope)}
                                            className={`w-6.5 h-6.5 rounded-lg text-[10px] font-black font-sans transition-all flex items-center justify-center shadow-2xs ${badge.color} ${!isPermActive ? 'opacity-35 cursor-not-allowed' : 'cursor-pointer hover:scale-110 active:scale-95'}`}
                                          >
                                            {badge.letter}
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" className="text-left whitespace-normal max-w-[180px] p-2 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xl border border-slate-800 dark:border-slate-200">
                                          <div className="font-bold text-[11px]">
                                            {item.action} Scope — {moduleName}
                                          </div>
                                          {isPermActive ? (
                                            <>
                                              <div className="text-[10px] opacity-80 mt-0.5">
                                                Current: {badge.letter} ({badge.label.split('—')[0].trim()})
                                              </div>
                                              <div className="text-[10px] text-indigo-300 dark:text-indigo-600 mt-0.5">
                                                Next: {nextBadge.letter} ({nextBadge.label.split('—')[0].trim()})
                                              </div>
                                            </>
                                          ) : (
                                            <div className="text-[10px] text-slate-400 mt-0.5">
                                              Permission inactive. Enable {item.action} to configure scope.
                                            </div>
                                          )}
                                        </TooltipContent>
                                      </Tooltip>
                                    );
                                  })}
                                </div>
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

                    const roleNameLower = role.name.toLowerCase();
                    let roleTheme = {
                      avatar: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/70 border-indigo-200 dark:border-indigo-800/80',
                      activeBorder: 'border-[#07518a] dark:border-[#07518a] ring-2 ring-[#07518a]/25 bg-gradient-to-b from-[#07518a]/10 via-[#07518a]/5 to-white dark:from-[#07518a]/25 dark:via-slate-900 dark:to-slate-900 shadow-lg shadow-[#07518a]/15',
                      keyText: 'text-[#07518a] dark:text-sky-400',
                      badge: 'bg-[#07518a] text-white border-[#07518a] shadow-xs'
                    };
                    if (roleNameLower.includes('admin')) {
                      roleTheme = {
                        avatar: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/70 border-purple-200 dark:border-purple-800/80',
                        activeBorder: 'border-purple-600 dark:border-purple-500 ring-2 ring-purple-500/25 bg-gradient-to-b from-purple-500/10 via-purple-500/5 to-white dark:from-purple-950/60 dark:via-slate-900 dark:to-slate-900 shadow-lg shadow-purple-500/15',
                        keyText: 'text-purple-700 dark:text-purple-400',
                        badge: 'bg-purple-600 text-white border-purple-600 shadow-xs'
                      };
                    } else if (roleNameLower.includes('hr')) {
                      roleTheme = {
                        avatar: 'text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/70 border-pink-200 dark:border-pink-800/80',
                        activeBorder: 'border-pink-600 dark:border-pink-500 ring-2 ring-pink-500/25 bg-gradient-to-b from-pink-500/10 via-pink-500/5 to-white dark:from-pink-950/60 dark:via-slate-900 dark:to-slate-900 shadow-lg shadow-pink-500/15',
                        keyText: 'text-pink-700 dark:text-pink-400',
                        badge: 'bg-pink-600 text-white border-pink-600 shadow-xs'
                      };
                    } else if (roleNameLower.includes('manager')) {
                      roleTheme = {
                        avatar: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/70 border-amber-200 dark:border-amber-800/80',
                        activeBorder: 'border-amber-600 dark:border-amber-500 ring-2 ring-amber-500/25 bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-white dark:from-amber-950/60 dark:via-slate-900 dark:to-slate-900 shadow-lg shadow-amber-500/15',
                        keyText: 'text-amber-700 dark:text-amber-400',
                        badge: 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      };
                    } else if (roleNameLower.includes('employee')) {
                      roleTheme = {
                        avatar: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/70 border-blue-200 dark:border-blue-800/80',
                        activeBorder: 'border-blue-600 dark:border-blue-500 ring-2 ring-blue-500/25 bg-gradient-to-b from-blue-500/10 via-blue-500/5 to-white dark:from-blue-950/60 dark:via-slate-900 dark:to-slate-900 shadow-lg shadow-blue-500/15',
                        keyText: 'text-blue-700 dark:text-blue-400',
                        badge: 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      };
                    }

                    return (
                      <div
                        key={role.id}
                        onClick={() => setSelectedRoleId(role.id)}
                        className={`group rounded-2xl p-4 cursor-pointer transition-all duration-300 flex-shrink-0 min-w-[250px] flex flex-col justify-between border ${isActive
                          ? `${roleTheme.activeBorder} scale-[1.02]`
                          : 'bg-white/95 dark:bg-slate-900/70 border-slate-200/90 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700 hover:bg-slate-50/90 dark:hover:bg-slate-850/60 hover:shadow-md'
                          }`}
                      >
                        {/* Top Row: Avatar Initial + Role Title + Active Badge + Edit/Delete Actions */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm border ${roleTheme.avatar} flex-shrink-0 shadow-xs transition-transform group-hover:scale-105`}>
                              {role.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex flex-col">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h5 className={`text-[13.5px] font-black uppercase tracking-wider truncate ${isActive ? roleTheme.keyText : 'text-slate-800 dark:text-slate-100'}`}>
                                  {role.name}
                                </h5>
                              </div>
                              {isActive ? (
                                <div className="inline-flex items-center gap-1 mt-0.5">
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-widest bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700/80 shadow-2xs">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Active
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Click to manage</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
                            <Tooltip>
                              <TooltipTrigger>
                                <button
                                  type="button"
                                  onClick={(e) => handleOpenEditRole(role, e)}
                                  className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-lg p-1.5 transition-colors cursor-pointer"
                                >
                                  <Pencil className="w-3.5 h-3.5 stroke-[2.2]" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" align="end">Edit role name</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger>
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteRole(role, e)}
                                  className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-lg p-1.5 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5 stroke-[2.2]" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" align="end">Delete role</TooltipContent>
                            </Tooltip>
                          </div>
                        </div>

                        {/* Bottom Row: Key & Permissions Badge */}
                        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px]">
                          <span className={`font-mono text-[10px] font-bold tracking-wider ${isActive ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}`}>
                            KEY: <span className="font-semibold">{role.name.toLowerCase().replace(/\s+/g, '_')}</span>
                          </span>

                          <span className={`px-2.5 py-0.5 rounded-full font-black text-[9.5px] tracking-wide border transition-all ${isActive
                            ? roleTheme.badge
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200/80 dark:border-slate-800'
                            }`}>
                            {keyCount} {keyCount === 1 ? 'perm' : 'perms'}
                          </span>
                        </div>
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
                    <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Granular Permissions</h4>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-0.5">Click a module to expand its granular permissions</p>
                  </div>
                </div>

                {/* Search */}
                <div className="relative w-full sm:max-w-xs">
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

              {/* Accordion Rows container */}
              <div className="space-y-4">
                {filteredModules.map((moduleName, moduleIdx) => {
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
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                            {moduleIdx + 1}
                          </span>
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
                              const viewPermission = modulePermissions.find(p => p.name.endsWith('_view'));
                              const isViewChecked = viewPermission ? activeRolePermissions.includes(viewPermission.id) : true;

                              return modulePermissions.map(p => {
                                const isChecked = activeRolePermissions.includes(p.id);
                                const action = getActionType(p.name);
                                const isViewAction = p.name.endsWith('_view');
                                const isToggleDisabled = savingRoleId !== null || (!isViewAction && !isViewChecked);

                                let actionCardTheme = {
                                  border: 'border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/40 hover:border-slate-350 dark:hover:border-slate-700',
                                  badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200/60',
                                  activeSwitch: 'bg-indigo-600 shadow shadow-indigo-600/30'
                                };
                                if (action === "VIEW") {
                                  actionCardTheme = {
                                    border: 'border-emerald-200/90 dark:border-emerald-800/60 bg-gradient-to-b from-emerald-500/[0.09] via-emerald-500/[0.02] to-white dark:from-emerald-950/40 dark:via-slate-900/70 dark:to-slate-900/80 hover:border-emerald-350 dark:hover:border-emerald-700 hover:shadow-md hover:shadow-emerald-500/5',
                                    badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shadow-2xs',
                                    activeSwitch: 'bg-emerald-600 shadow shadow-emerald-600/30'
                                  };
                                } else if (action === "CREATE") {
                                  actionCardTheme = {
                                    border: 'border-blue-200/90 dark:border-blue-800/60 bg-gradient-to-b from-blue-500/[0.09] via-blue-500/[0.02] to-white dark:from-blue-950/40 dark:via-slate-900/70 dark:to-slate-900/80 hover:border-blue-350 dark:hover:border-blue-700 hover:shadow-md hover:shadow-blue-500/5',
                                    badge: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 shadow-2xs',
                                    activeSwitch: 'bg-blue-600 shadow shadow-blue-600/30'
                                  };
                                } else if (action === "EDIT" || action === "CALCULATE") {
                                  actionCardTheme = {
                                    border: 'border-amber-200/90 dark:border-amber-800/60 bg-gradient-to-b from-amber-500/[0.09] via-amber-500/[0.02] to-white dark:from-amber-950/40 dark:via-slate-900/70 dark:to-slate-900/80 hover:border-amber-350 dark:hover:border-amber-700 hover:shadow-md hover:shadow-amber-500/5',
                                    badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 shadow-2xs',
                                    activeSwitch: 'bg-amber-600 shadow shadow-amber-600/30'
                                  };
                                } else if (action === "DELETE") {
                                  actionCardTheme = {
                                    border: 'border-rose-200/90 dark:border-rose-800/60 bg-gradient-to-b from-rose-500/[0.09] via-rose-500/[0.02] to-white dark:from-rose-950/40 dark:via-slate-900/70 dark:to-slate-900/80 hover:border-rose-350 dark:hover:border-rose-700 hover:shadow-md hover:shadow-rose-500/5',
                                    badge: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 shadow-2xs',
                                    activeSwitch: 'bg-rose-600 shadow shadow-rose-600/30'
                                  };
                                }

                                return (
                                  <div
                                    key={p.id}
                                    className={`rounded-2xl p-4 relative flex flex-col justify-between min-h-[170px] transition-all duration-200 border ${actionCardTheme.border} ${!isViewAction && !isViewChecked ? 'opacity-40 select-none' : ''
                                      }`}
                                  >
                                    <div className="flex items-center justify-between w-full">
                                      <Tooltip>
                                        <TooltipTrigger>
                                          <span className={`text-[8.5px] px-2.5 py-0.5 rounded-md font-black tracking-widest uppercase cursor-help ${actionCardTheme.badge}`}>
                                            {action}
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="text-left whitespace-normal max-w-[160px] p-2 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xl border border-slate-800 dark:border-slate-200">
                                          <div className="font-bold text-[11px]">{action} — {moduleName}</div>
                                        </TooltipContent>
                                      </Tooltip>

                                      {p.name === 'companies_create' ? (
                                        <Tooltip>
                                          <TooltipTrigger>
                                            <span className="relative inline-flex h-5 w-9 flex-shrink-0 cursor-not-allowed rounded-full border border-transparent bg-slate-200 dark:bg-slate-855 opacity-40">
                                              <span className="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 translate-x-0" />
                                            </span>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="text-left whitespace-normal max-w-[180px] p-2 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xl border border-slate-800 dark:border-slate-200">
                                            <div className="font-bold text-[11px] text-rose-400 dark:text-rose-600">Restricted</div>
                                            <div className="text-[10px] opacity-80 mt-0.5">Only SuperAdmin can create companies</div>
                                          </TooltipContent>
                                        </Tooltip>
                                      ) : (
                                        <Tooltip>
                                          <TooltipTrigger>
                                            <button
                                              type="button"
                                              disabled={isToggleDisabled}
                                              onClick={() => !isToggleDisabled && selectedRoleId && togglePermissionAutoSave(selectedRoleId, p.id)}
                                              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-250 ease-in-out outline-none focus:outline-none ${isChecked
                                                ? actionCardTheme.activeSwitch
                                                : 'bg-slate-200 dark:bg-slate-850'
                                                } ${isToggleDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                                            >
                                              <span
                                                aria-hidden="true"
                                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-250 ease-in-out ${isChecked ? 'translate-x-4' : 'translate-x-0'
                                                  }`}
                                              />
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="text-left whitespace-normal max-w-[160px] p-2 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xl border border-slate-800 dark:border-slate-200">
                                            <div className="font-bold text-[11px]">{isChecked ? 'Granted' : 'Revoked'}</div>
                                            <div className="text-[10px] opacity-80 mt-0.5">Click to {isChecked ? 'revoke' : 'grant'}</div>
                                          </TooltipContent>
                                        </Tooltip>
                                      )}
                                    </div>

                                    <div className="mt-3 flex-1">
                                      <div className="font-mono font-bold text-slate-800 dark:text-slate-100 text-[11.5px] truncate">
                                        {p.name}
                                      </div>
                                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed mt-1 line-clamp-2">
                                        {p.description || 'Allow performing this module action.'}
                                      </p>
                                    </div>

                                    {/* Granular Individual Permission Scope Row */}
                                    <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between">
                                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                        Data Scope:
                                      </span>
                                      <div className="inline-flex items-center gap-1">
                                        {[
                                          { key: 'SELF', letter: 'S', color: 'bg-amber-500 text-white', label: 'Self — Own records only' },
                                          { key: 'REPORTING', letter: 'T', color: 'bg-emerald-500 text-white', label: 'Team — Reporting team records' },
                                          { key: 'DEPARTMENT', letter: 'D', color: 'bg-purple-500 text-white', label: 'Dept — Department records' },
                                          { key: 'ALL', letter: 'A', color: 'bg-indigo-600 text-white', label: 'All — Company-wide access' }
                                        ].map(sc => {
                                          const currentScope = (selectedRoleId && roleScopesState[selectedRoleId]?.[p.id]) || 'SELF';
                                          const isSelected = isChecked && currentScope === sc.key;
                                          return (
                                            <Tooltip key={sc.key}>
                                              <TooltipTrigger>
                                                <button
                                                  type="button"
                                                  disabled={savingRoleId !== null || !isChecked || (p.name === 'companies_create')}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (selectedRoleId && isChecked) {
                                                      handleScopeChange(selectedRoleId, p.id, sc.key);
                                                    }
                                                  }}
                                                  className={`w-6 h-6 rounded-md text-[10px] font-black transition-all flex items-center justify-center ${isSelected
                                                    ? `${sc.color} shadow-xs scale-105 ring-1 ring-white/20`
                                                    : 'bg-slate-200/70 text-slate-500 dark:bg-slate-850 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'
                                                    } ${(savingRoleId !== null || !isChecked || (p.name === 'companies_create')) ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                                                >
                                                  {sc.letter}
                                                </button>
                                              </TooltipTrigger>
                                              <TooltipContent side="top" className="text-left whitespace-normal max-w-[160px] p-1.5 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xl border border-slate-800 dark:border-slate-200">
                                                <div className="text-[10px] font-bold">{sc.label}</div>
                                              </TooltipContent>
                                            </Tooltip>
                                          );
                                        })}
                                      </div>
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
        <form onSubmit={handleCreateRole} className="space-y-5 text-left font-dmsans" autoComplete="off">
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
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
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
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={roleForm.description}
              onChange={e => setRoleForm({ ...roleForm, description: e.target.value })}
              className={inputStyle}
            />
          </div>

          <button
            type="submit"
            disabled={isCreatingRole}
            className="w-full py-3 rounded-2xl bg-[#07518a] hover:bg-[#064270] text-xs font-black uppercase tracking-wider text-white shadow-md shadow-[#07518a]/35 transition-all duration-200 cursor-pointer mt-4 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isCreatingRole && (
              <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
            )}
            {isCreatingRole ? 'Creating Access Role...' : 'Create Access Role'}
          </button>
        </form>
      </SlideDrawer>

      {/* Slide Drawer to Edit Role */}
      <SlideDrawer isOpen={editRoleDrawerOpen} onClose={() => setEditRoleDrawerOpen(false)} title="Edit Access Role">
        <form onSubmit={handleUpdateRole} className="space-y-5 text-left font-dmsans" autoComplete="off">
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-555 dark:text-slate-400 uppercase tracking-widest">
              Role Name Identifier *
            </label>
            <input
              type="text" placeholder="e.g. Management"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
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
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={editRoleForm.description}
              onChange={e => setEditRoleForm({ ...editRoleForm, description: e.target.value })}
              className={inputStyle}
            />
          </div>

          <button 
            type="submit" 
            disabled={isUpdatingRole}
            className="w-full py-3 rounded-2xl bg-[#07518a] hover:bg-[#064270] text-white text-xs font-black shadow-md shadow-[#07518a]/30 transition-all duration-200 cursor-pointer uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isUpdatingRole && (
              <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
            )}
            {isUpdatingRole ? 'Saving Role Changes...' : 'Save Role Changes'}
          </button>
        </form>
      </SlideDrawer>
    </div>
  );
}
