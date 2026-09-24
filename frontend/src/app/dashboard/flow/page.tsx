'use client';

import React, { useEffect, useState, useMemo } from 'react';
import DashboardPageHeader from '../components/DashboardPageHeader';
import { getHeaders, getUrl } from '../utils/api';
import { useDashboard } from '../components/DashboardContext';

interface Company {
  id: string;
  name: string;
  subdomain: string;
  branding_logo?: string;
  status: string;
  created_at: string;
}

interface Permission {
  id: string;
  name: string;
  description?: string;
  module: string;
  data_scope?: string;
}

interface Role {
  id: string;
  name: string;
  description?: string;
  company_name?: string;
  company_id?: string;
  permissions?: Permission[];
}

// Professional English Human Explanation Generator
function getPermissionEnglishExplanation(moduleName: string, permName: string, scope: string = 'ALL'): string {
  const s = scope.toUpperCase();
  const mod = (moduleName || permName || '').toLowerCase();

  if (mod.includes('attendance_locks') || mod.includes('lock')) {
    if (s === 'SELF') return 'Allows user to view personal attendance lock status and period cutoffs.';
    if (s === 'TEAM' || s === 'REPORTING') return 'Allows manager to review team attendance lock periods and freeze timesheets for reportees.';
    return 'Full access to configure, lock, and unlock company-wide monthly attendance calculation cycles.';
  }

  if (mod.includes('attendance') || mod.includes('punch') || mod.includes('regularization')) {
    if (s === 'SELF') return 'Allows user to submit personal web/mobile punch logs and miss-punch regularization requests.';
    if (s === 'TEAM' || s === 'REPORTING') return 'Allows manager to audit team punch logs, late entries, and approve attendance regularizations.';
    if (s === 'DEPARTMENT') return 'Allows department heads to monitor staff attendance compliance and shift timings.';
    return 'Full administrative access to manage company attendance policies, biometric logs, timing rules, and monthly summaries.';
  }

  if (mod.includes('leave') || mod.includes('permission')) {
    if (s === 'SELF') return 'Allows user to apply for annual leaves and short permission passes (1-2 hours).';
    if (s === 'TEAM' || s === 'REPORTING') return 'Allows manager to review, approve, or reject leave applications and permission passes for team members.';
    if (s === 'DEPARTMENT') return 'Allows department heads to manage leave quotas and approvals for department staff.';
    return 'Full access to credit annual leave balances, configure holiday calendars, and manage company-wide leave requests.';
  }

  if (mod.includes('employee_devices') || mod.includes('device')) {
    if (s === 'SELF') return 'Allows user to view and register personal smartphone for GPS selfie attendance punching.';
    return 'Full administrative authority to approve, bind, and reset employee smartphone UUIDs and office biometric devices.';
  }

  if (mod.includes('employee') || mod.includes('onboarding') || mod.includes('profile')) {
    if (s === 'SELF') return 'Allows user to view personal profile, emergency contact, and bank account details.';
    if (s === 'TEAM' || s === 'REPORTING') return 'Allows manager to view reporting team member profiles, designations, and shifts.';
    return 'Full authority to onboard new employees, generate EMP codes, edit master data, and manage offboarding.';
  }

  if (mod.includes('payroll') || mod.includes('structure') || mod.includes('formula') || mod.includes('payslip')) {
    if (s === 'SELF') return 'Allows user to view and download monthly itemized A4 PDF payslips.';
    return 'Full authority to define salary structures, simulate gross-to-net formulas, run monthly bulk payroll, and email payslips.';
  }

  if (mod.includes('role') || mod.includes('company') || mod.includes('branch') || mod.includes('tenant')) {
    return 'Unrestricted administrative authority to configure corporate entities, branches, departments, and RBAC permission matrices.';
  }

  if (s === 'SELF') return `Grants view and submit access restricted strictly to user's personal records (Scope: SELF).`;
  if (s === 'TEAM' || s === 'REPORTING') return `Grants approval and review access for direct reportees and team members (Scope: ${s}).`;
  if (s === 'DEPARTMENT') return `Grants oversight and administrative access for department staff members (Scope: DEPARTMENT).`;
  return `Grants full unrestricted view, create, edit, and management access across the entire company (Scope: ALL).`;
}

function getScopeBadgeStyle(scope: string = 'ALL') {
  const s = scope.toUpperCase();
  if (s === 'ALL') {
    return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30';
  }
  if (s === 'TEAM' || s === 'REPORTING') {
    return 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30';
  }
  if (s === 'DEPARTMENT') {
    return 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30';
  }
  return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
}

export default function WorkFlowGuidePage() {
  const { showToast, companyId: globalCompanyId } = useDashboard();
  const [email, setEmail] = useState('');
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [dbRoles, setDbRoles] = useState<Role[]>([]);

  const [loading, setLoading] = useState(true);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  const activeCompanyId = globalCompanyId || selectedCompanyId || companyId;
  
  // Selected Role ID
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const isSuperAdmin = userRoles.includes('SuperAdmin') || userRoles.includes('superadmin');

  useEffect(() => {
    const storedRoles = localStorage.getItem('roles');
    const storedEmail = localStorage.getItem('email');
    const storedCompanyId = localStorage.getItem('selectedCompanyId') || localStorage.getItem('companyId');
    if (storedRoles) {
      try { setUserRoles(JSON.parse(storedRoles)); } catch { setUserRoles([]); }
    }
    if (storedEmail) setEmail(storedEmail);
    if (storedCompanyId) {
      setCompanyId(storedCompanyId);
      setSelectedCompanyId(storedCompanyId);
    }
  }, []);

  const fetchCompanies = async () => {
    try {
      const res = await fetch('/api/v1/companies', { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) {
        const compList = Array.isArray(data) ? data : (data.companies || []);
        setCompanies(compList);
        if (!selectedCompanyId && compList.length > 0) {
          setSelectedCompanyId(compList[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchDatabaseRoles = async () => {
    setLoading(true);
    try {
      const cid = activeCompanyId || localStorage.getItem('companyId');
      const url = cid && cid !== 'all' ? `/api/v1/roles?companyId=${cid}` : '/api/v1/roles';
      const res = await fetch(getUrl(url), { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) {
        const fetchedRoles: Role[] = data.roles || [];
        setDbRoles(fetchedRoles);
        if (fetchedRoles.length > 0) {
          setSelectedRoleId(fetchedRoles[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching database roles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  useEffect(() => {
    fetchDatabaseRoles();
  }, [activeCompanyId, isSuperAdmin]);

  const handleCompanyChange = (newCompanyId: string) => {
    setSelectedCompanyId(newCompanyId);
    localStorage.setItem('selectedCompanyId', newCompanyId);
    setSelectedRoleId(null);
  };

  // Currently selected role object from database
  const activeRole = useMemo(() => {
    if (!selectedRoleId && dbRoles.length > 0) return dbRoles[0];
    return dbRoles.find(r => r.id === selectedRoleId) || dbRoles[0] || null;
  }, [selectedRoleId, dbRoles]);

  // Unique Deduplicated Permissions List for the Active Role
  const uniquePermissions = useMemo(() => {
    if (!activeRole || !activeRole.permissions) return [];
    const map = new Map<string, Permission>();
    activeRole.permissions.forEach(p => {
      const key = (p.module || p.name).toUpperCase();
      if (!map.has(key)) {
        map.set(key, p);
      }
    });
    return Array.from(map.values());
  }, [activeRole]);

  // Filter unique permissions by search query
  const filteredPermissions = useMemo(() => {
    if (!searchQuery.trim()) return uniquePermissions;
    const q = searchQuery.toLowerCase();
    return uniquePermissions.filter(p => 
      p.name.toLowerCase().includes(q) || 
      (p.module || '').toLowerCase().includes(q) ||
      (p.data_scope || '').toLowerCase().includes(q)
    );
  }, [uniquePermissions, searchQuery]);

  const selectedCompanyName = useMemo(() => {
    const matched = companies.find(c => c.id === selectedCompanyId);
    return matched ? matched.name : 'Selected Company';
  }, [companies, selectedCompanyId]);

  return (
    <div className="space-y-6 animate-fadeIn select-none relative pb-24 font-sans text-slate-800 dark:text-slate-100">
      
      {/* 🚀 Page Header with SuperAdmin Company Dropdown */}
      <DashboardPageHeader
        title="Role Access & Permission Matrix"
        actionMessage=""
        actionError=""
        companies={companies as any}
        companyId={selectedCompanyId}
        handleCompanyChange={handleCompanyChange}
        isSuperAdmin={isSuperAdmin}
        email={email}
        hideCompanySelect={!isSuperAdmin}
        hideUserBadge={true}
      />

      {/* 👑 Dynamic Company Roles Selector Panel */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="text-xl text-amber-500 animate-pulse">⚡</span>
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
              CONFIGURED ROLES FOR {selectedCompanyName.toUpperCase()} ({dbRoles.length} ACTIVE ROLES)
            </h2>
          </div>
          <span className="text-[10.5px] text-slate-400 font-mono font-semibold">
            {isSuperAdmin ? 'Filter company above to view tenant roles' : 'Locked to your company context'}
          </span>
        </div>

        {/* Dynamic Database Roles Grid */}
        {loading ? (
          <div className="p-16 text-center space-y-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="w-8 h-8 border-4 border-[#07518a] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Loading Roles...</p>
          </div>
        ) : dbRoles.length === 0 ? (
          <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-xs font-bold text-slate-400 shadow-sm">
            No dynamic roles configured for this company.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {dbRoles.map(role => {
              const isSelected = activeRole && activeRole.id === role.id;
              const permCount = (role.permissions || []).length;

              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setSelectedRoleId(role.id)}
                  className={`p-4 rounded-2xl border text-left transition-all duration-300 cursor-pointer flex flex-col justify-between relative overflow-hidden group ${
                    isSelected
                      ? 'bg-gradient-to-br from-[#07518a]/15 via-blue-50/40 to-slate-50 dark:from-[#07518a]/30 dark:via-[#07518a]/15 dark:to-slate-900 border-2 border-[#07518a] shadow-xl shadow-[#07518a]/15 scale-[1.04]'
                      : 'bg-white/90 dark:bg-slate-900/90 border-slate-200/90 dark:border-slate-800 hover:border-[#07518a] dark:hover:border-[#07518a] shadow-xs hover:shadow-md hover:scale-[1.01]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl transition-transform duration-300 group-hover:scale-110">
                      {role.name.toLowerCase().includes('admin') ? '👑' :
                       role.name.toLowerCase().includes('hr') ? '👔' :
                       role.name.toLowerCase().includes('manager') ? '💼' :
                       role.name.toLowerCase().includes('payroll') ? '💰' : '👤'}
                    </span>
                    {isSelected && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-[#07518a] text-white shadow-2xs">
                        ACTIVE ROLE
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className={`text-xs font-black uppercase tracking-wider truncate ${isSelected ? 'text-[#07518a] dark:text-[#38bdf8]' : 'text-slate-800 dark:text-slate-200'}`}>
                        {role.name}
                      </h3>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5" title={role.description || role.name}>
                      {role.description || `${permCount} Permissions Active`}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 🛡️ Live Access Matrix Grid with Table Scope Header & Footer Permissions */}
      {activeRole && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-7 shadow-md shadow-slate-200/50 dark:shadow-slate-950/50 space-y-5">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xl font-bold">
                {activeRole.name.toLowerCase().includes('admin') ? '👑' :
                 activeRole.name.toLowerCase().includes('hr') ? '👔' :
                 activeRole.name.toLowerCase().includes('manager') ? '💼' :
                 activeRole.name.toLowerCase().includes('payroll') ? '💰' : '👤'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                    {activeRole.name} Access Matrix ({filteredPermissions.length} Active Modules)
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800">
                    Live DB Rights
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                  Granular module scope badges and footer action permissions (View, Create, Edit, Delete)
                </p>
              </div>
            </div>

            {/* Search Filter Bar */}
            <div className="relative w-full md:w-64">
              <input
                type="text"
                placeholder="Search permission module..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold outline-none focus:border-indigo-500 transition-all placeholder:text-slate-400 shadow-2xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {filteredPermissions.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-center text-xs font-bold text-slate-400">
              No matching permission modules found for "{searchQuery}".
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredPermissions.map((perm) => {
                const scope = (perm.data_scope || 'ALL').toUpperCase();
                const explanation = getPermissionEnglishExplanation(perm.module || perm.name, perm.name, scope);

                const isSuper = activeRole.name.toLowerCase().includes('admin');
                const isManager = activeRole.name.toLowerCase().includes('manager') || activeRole.name.toLowerCase().includes('hr');
                
                const hasView = true;
                const hasCreate = isSuper || isManager || perm.name.toLowerCase().includes('create') || perm.name.toLowerCase().includes('apply');
                const hasEdit = isSuper || isManager || perm.name.toLowerCase().includes('edit') || perm.name.toLowerCase().includes('update');
                const hasDelete = isSuper;

                return (
                  <div
                    key={perm.id || perm.name}
                    className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-md shadow-slate-200/60 dark:shadow-slate-950/60 hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between space-y-3.5 group relative overflow-hidden"
                  >
                    {/* Header Row: Table Name + Scope Badge */}
                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-sm font-black shrink-0 shadow-2xs">
                          📑
                        </span>
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {perm.module || perm.name}
                          </h4>
                          <span className="text-[9.5px] text-slate-400 font-mono font-medium block mt-0.5">RESOURCE TABLE</span>
                        </div>
                      </div>

                      {/* Scope Badge beside Table Name */}
                      <span className={`px-2.5 py-1 rounded-full text-[9.5px] font-mono font-black uppercase tracking-wider border shadow-2xs ${getScopeBadgeStyle(scope)}`}>
                        SCOPE: {scope}
                      </span>
                    </div>

                    {/* Operational English Explanation Description */}
                    <div className="flex items-start gap-2.5 py-0.5">
                      <span className="w-5 h-5 rounded-lg text-[10px] font-black flex items-center justify-center shrink-0 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 mt-0.5 shadow-2xs">
                        ✓
                      </span>
                      <p className="text-[11.5px] font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                        {explanation}
                      </p>
                    </div>

                    {/* Footer Row: Active Action Permissions (View, Create, Edit, Delete) */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10.5px]">
                      <span className="font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[9.5px]">
                        PERMISSIONS:
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* View */}
                        <span className={`px-2 py-0.5 rounded-md text-[9.5px] font-mono font-bold transition-all ${
                          hasView 
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-2xs' 
                            : 'bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 border border-slate-200/50 dark:border-slate-700/50 line-through opacity-50'
                        }`}>
                          View
                        </span>

                        {/* Create */}
                        <span className={`px-2 py-0.5 rounded-md text-[9.5px] font-mono font-bold transition-all ${
                          hasCreate 
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-2xs' 
                            : 'bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 border border-slate-200/50 dark:border-slate-700/50 line-through opacity-50'
                        }`}>
                          Create
                        </span>

                        {/* Edit */}
                        <span className={`px-2 py-0.5 rounded-md text-[9.5px] font-mono font-bold transition-all ${
                          hasEdit 
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-2xs' 
                            : 'bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 border border-slate-200/50 dark:border-slate-700/50 line-through opacity-50'
                        }`}>
                          Edit
                        </span>

                        {/* Delete */}
                        <span className={`px-2 py-0.5 rounded-md text-[9.5px] font-mono font-bold transition-all ${
                          hasDelete 
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shadow-2xs' 
                            : 'bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 border border-slate-200/50 dark:border-slate-700/50 line-through opacity-50'
                        }`}>
                          Delete
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
