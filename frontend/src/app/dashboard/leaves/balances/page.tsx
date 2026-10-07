'use client';

import React, { useEffect, useState } from 'react';
import DashboardPageHeader from '../../components/DashboardPageHeader';
import { getHeaders } from '../../utils/api';
import SlideDrawer from '../../components/SlideDrawer';
import { useDashboard } from '../../components/DashboardContext';
import { usePermissions } from '../../hooks/usePermissions';
import ModernPagination from '../../components/ModernPagination';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

const AVATAR_COLORS = [
  'bg-indigo-500 text-white',
  'bg-rose-500 text-white',
  'bg-emerald-500 text-white',
  'bg-amber-500 text-white',
  'bg-violet-500 text-white',
  'bg-sky-500 text-white',
  'bg-pink-500 text-white',
  'bg-teal-500 text-white',
  'bg-blue-600 text-white',
  'bg-fuchsia-600 text-white',
  'bg-cyan-600 text-white',
  'bg-orange-500 text-white',
];

const getAvatarColor = (name?: string, id?: string) => {
  const str = (name || id || 'EMP').toUpperCase();
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

export default function LeaveBalancesPage() {
  const { showToast, companyId } = useDashboard();
  const { isSuperAdmin: isSuperAdminPerm, hasPermission, getPermissionScope } = usePermissions();

  const isSuperAdmin = isSuperAdminPerm;

  // Permissions
  const canView = isSuperAdmin || hasPermission('leave_balances_view') || hasPermission('leaves_balances_view') || hasPermission('leaves_view');
  const canCreate = isSuperAdmin || hasPermission('leave_balances_create') || hasPermission('leaves_balances_create') || hasPermission('leaves_create') || hasPermission('leave_balances_edit');
  const canEdit = isSuperAdmin || hasPermission('leave_balances_edit') || hasPermission('leaves_balances_edit') || hasPermission('leaves_edit');
  const canDelete = isSuperAdmin || hasPermission('leave_balances_delete') || hasPermission('leaves_balances_delete') || hasPermission('leaves_delete');

  // Scopes
  const viewScopePerm = getPermissionScope('leave_balances_view') || getPermissionScope('leaves_balances_view') || (isSuperAdmin ? 'ALL' : 'SELF');
  const editScopePerm = getPermissionScope('leave_balances_edit') || getPermissionScope('leaves_balances_edit') || (isSuperAdmin ? 'ALL' : 'SELF');
  const deleteScopePerm = getPermissionScope('leave_balances_delete') || getPermissionScope('leaves_balances_delete') || (isSuperAdmin ? 'ALL' : 'SELF');

  const canSeeExtendedTab = isSuperAdmin || ['TEAM', 'REPORTING', 'DEPARTMENT', 'ALL'].includes(viewScopePerm);
  const canEditExtended = isSuperAdmin || ['TEAM', 'REPORTING', 'DEPARTMENT', 'ALL'].includes(editScopePerm);
  const canDeleteExtended = isSuperAdmin || ['TEAM', 'REPORTING', 'DEPARTMENT', 'ALL'].includes(deleteScopePerm);

  const getSecondTabLabel = () => {
    if (isSuperAdmin || viewScopePerm === 'ALL') {
      return 'All Employee Directory';
    }
    if (viewScopePerm === 'DEPARTMENT') {
      return 'Department Directory';
    }
    return 'Team Balances';
  };

  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [balances, setBalances] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  const [activeTab, setActiveTab] = useState<'my' | 'all'>('my');
  const [searchTerm, setSearchTerm] = useState('');
  const [empSearch, setEmpSearch] = useState('');
  const [empDropdownOpen, setEmpDropdownOpen] = useState(false);
  const [balanceDrawerOpen, setBalanceDrawerOpen] = useState(false);
  const [editingBalance, setEditingBalance] = useState<any | null>(null);

  // Pagination State (25 items per page default)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [balanceForm, setBalanceForm] = useState({
    employee_id: '',
    leave_type_id: '',
    balance_year: String(new Date().getFullYear()),
    allotted: '12',
    used: '0',
    remaining: '12'
  });

  const me = employees.find(e => e.email?.toLowerCase() === email.toLowerCase());
  const myBalances = balances.filter(b => 
    (b.employee_email && b.employee_email.toLowerCase() === email.toLowerCase()) ||
    (me?.id && b.employee_id === me.id)
  );

  const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));

  useEffect(() => {
    const storedRoles = localStorage.getItem('roles');
    const storedEmail = localStorage.getItem('email');
    if (storedRoles) {
      try { setRoles(JSON.parse(storedRoles)); } catch (e) {}
    }
    if (storedEmail) setEmail(storedEmail);
  }, []);

  useEffect(() => {
    if (canView) {
      Promise.all([fetchBalances(), fetchLeaveTypes(), fetchEmployees()]);
    }
  }, [companyId, selectedYear, canView]);

  // Reset pagination on search or tab change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeTab, selectedYear, companyId]);

  const fetchBalances = async () => {
    setIsLoading(true);
    const cid = companyId || 'all';
    try {
      const res = await fetch(`/api/v1/leave-balances?companyId=${cid}&year=${selectedYear}`, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) setBalances(data.balances || []);
    } catch (e) {
      showToast('Error loading leave balances', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLeaveTypes = async () => {
    const cid = companyId || 'all';
    try {
      const res = await fetch(`/api/v1/leave-types?companyId=${cid}`, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) setLeaveTypes(data.leaveTypes || []);
    } catch (e) {}
  };

  const fetchEmployees = async () => {
    const cid = companyId || 'all';
    try {
      const res = await fetch(`/api/v1/employees?companyId=${cid}&pageSize=500`, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) setEmployees(data.employees || []);
    } catch (e) {}
  };

  const handleSaveBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const method = editingBalance ? 'PUT' : 'POST';
      const url = editingBalance
        ? `/api/v1/leave-balances/${editingBalance.id}`
        : '/api/v1/leave-balances';

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(balanceForm)
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Leave balance ${editingBalance ? 'updated' : 'added'} successfully`, 'success');
        setBalanceDrawerOpen(false);
        setEditingBalance(null);
        fetchBalances();
      } else {
        showToast(data.error || 'Failed to save balance', 'error');
      }
    } catch (e) {
      showToast('Connection error', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteBalance = async (balanceId: string) => {
    if (!confirm('Are you sure you want to delete this leave balance quota record?')) return;
    try {
      const res = await fetch(`/api/v1/leave-balances/${balanceId}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (res.ok) {
        showToast('Leave balance deleted successfully', 'success');
        fetchBalances();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to delete balance', 'error');
      }
    } catch (e) {
      showToast('Connection error', 'error');
    }
  };

  const openEditBalance = (b: any) => {
    setEditingBalance(b);
    setBalanceForm({
      employee_id: b.employee_id || '',
      leave_type_id: b.leave_type_id || '',
      balance_year: String(b.balance_year || new Date().getFullYear()),
      allotted: String(b.allotted || 0),
      used: String(b.used || 0),
      remaining: String(b.remaining || 0)
    });
    setBalanceDrawerOpen(true);
  };

  const openNewBalance = () => {
    setEditingBalance(null);
    setBalanceForm({
      employee_id: me?.id || (employees[0]?.id || ''),
      leave_type_id: leaveTypes[0]?.id || '',
      balance_year: selectedYear || String(new Date().getFullYear()),
      allotted: '12',
      used: '0',
      remaining: '12'
    });
    setBalanceDrawerOpen(true);
  };

  const filteredBalances = balances.filter(b => {
    const name = b.employee_name || '';
    const code = b.leave_type_code || '';
    const empCode = b.emp_id_code || b.employee_email || '';
    const searchLower = searchTerm.toLowerCase();
    return name.toLowerCase().includes(searchLower) ||
           code.toLowerCase().includes(searchLower) ||
           empCode.toLowerCase().includes(searchLower) ||
           b.leave_type_name?.toLowerCase().includes(searchLower);
  });

  // Pagination Math
  const totalItems = filteredBalances.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedBalances = filteredBalances.slice(startIndex, startIndex + pageSize);

  const selectedEmpObj = employees.find(e => e.id === balanceForm.employee_id);
  const filteredSearchEmployees = employees.filter(e => {
    const fullName = `${e.first_name || ''} ${e.last_name || ''}`.toLowerCase();
    const code = (e.emp_id_code || e.id_code || '').toLowerCase();
    return fullName.includes(empSearch.toLowerCase()) || code.includes(empSearch.toLowerCase());
  });

  // Format numbers to 1 decimal place without "Days" suffix (e.g. 12.0, 5.0, 7.0)
  const formatDaysVal = (val: any) => {
    const num = parseFloat(val);
    if (isNaN(num)) return '0.0';
    return num.toFixed(1);
  };

  if (!canView) {
    return (
      <div className="space-y-6 pb-12">
        <DashboardPageHeader
          title="Leave Balances & Quotas Overview"
          companyId={companyId}
          isSuperAdmin={isSuperAdmin}
          email={email}
          hideCompanySelect={true}
          hideUserBadge={true}
        />
        <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
          <div className="w-14 h-14 bg-rose-50 dark:bg-rose-950/50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-3 text-2xl font-bold">
            🚫
          </div>
          <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100">Access Restricted</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            You do not have permission to view leave balances. Please contact your system administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <DashboardPageHeader
        title="Leave Balances & Quotas Overview"
        companyId={companyId}
        isSuperAdmin={isSuperAdmin}
        email={email}
        hideCompanySelect={true}
        hideUserBadge={true}
      />

      {/* 🎛️ TAB SWITCHER & HEADER CONTROL BAR */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        
        {/* TABS (MY QUOTAS vs EXTENDED DIRECTORY) */}
        {canSeeExtendedTab ? (
          <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('my')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'my'
                  ? 'bg-[#07518a] text-white shadow-md shadow-[#07518a]/25 scale-[1.02]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              <span>My Leave Quotas</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${activeTab === 'my' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                {myBalances.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'all'
                  ? 'bg-[#07518a] text-white shadow-md shadow-[#07518a]/25 scale-[1.02]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.72m12 0a5.971 5.971 0 00-.941-3.197M6 18.72a5.971 5.971 0 01.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 005.058 2.772m-10.116 0A9.094 9.094 0 012.25 15.52a3 3 0 014.682-2.72m0 0c.148.274.321.533.516.776M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
              <span>{getSecondTabLabel()}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                {balances.length}
              </span>
            </button>
          </div>
        ) : (
          <div className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-2 shrink-0">
            <span>👤</span>
            <span>My Leave Quotas ({myBalances.length})</span>
          </div>
        )}

        {/* RIGHT GROUP: SEARCH -> YEAR FILTER -> ADJUST QUOTA BUTTON */}
        <div className="flex items-center gap-3 shrink-0 flex-wrap w-full xl:w-auto">
          
          {/* SEARCH INPUT */}
          <div className="relative w-full sm:w-56">
            <i className="fa-solid fa-magnifying-glass text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 text-xs pointer-events-none"></i>
            <input
              type="text"
              placeholder="Search employee or leave code..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-[#07518a] focus:ring-2 focus:ring-[#07518a]/20 transition-all"
            />
          </div>

          {/* YEAR FILTER DROPDOWN */}
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black text-slate-800 dark:text-slate-100 outline-none cursor-pointer focus:border-[#07518a] transition-all"
          >
            {[2026, 2025, 2024, 2023, 2022].map(yr => (
              <option key={yr} value={yr} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-bold">
                {yr}
              </option>
            ))}
          </select>

          {/* ADJUST QUOTA BUTTON (Available if user has extended edit/create permissions) */}
          {(canCreate || canEdit) && canEditExtended && (
            <button
              onClick={openNewBalance}
              className="px-4 py-2 bg-[#07518a] hover:bg-[#053d69] text-white text-xs font-extrabold rounded-xl shadow-md shadow-[#07518a]/20 hover:shadow-lg hover:scale-[1.02] transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>Adjust / Assign Quota</span>
            </button>
          )}
        </div>
      </div>

      {/* 👤 TAB 1: MY PERSONAL LEAVE QUOTA CARDS */}
      {(!canSeeExtendedTab || activeTab === 'my') && (
        <div className="space-y-4">
          {myBalances.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
              <i className="fa-solid fa-calendar-minus text-4xl text-slate-300 dark:text-slate-600 block mb-3"></i>
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                No personal leave quota records found for the current calendar year.
              </h4>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {myBalances.map(b => {
                const allotted = Number(b.allotted) || 1;
                const remaining = Number(b.remaining) || 0;
                const used = Number(b.used) || 0;
                const pct = Math.min(100, Math.max(0, Math.round((remaining / allotted) * 100)));

                return (
                  <div 
                    key={b.id}
                    className="p-5 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 shadow-xs space-y-3 relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-indigo-400 dark:hover:border-indigo-600"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100 block">
                          {b.leave_type_name || b.leave_type_code}
                        </span>
                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-extrabold uppercase tracking-wider">{b.leave_type_code}</span>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-black flex items-center justify-center text-xs border border-indigo-200/60">
                        {b.leave_type_code?.slice(0, 2) || 'LV'}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-baseline justify-between mb-1.5">
                        <span className="text-3xl font-black text-slate-900 dark:text-white font-mono">
                          {formatDaysVal(remaining)}
                        </span>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                          / {formatDaysVal(allotted)}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-2 rounded-full bg-slate-200/80 dark:bg-slate-800 overflow-hidden">
                        <div 
                          className="h-full rounded-full bg-[#07518a] transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-indigo-100 dark:border-indigo-900/30 font-medium">
                      <span>Used: <strong className="text-slate-800 dark:text-slate-200">{formatDaysVal(used)}</strong></span>
                      <span>Year: <strong className="text-slate-800 dark:text-slate-200">{b.balance_year}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 👥 TAB 2: ALL EMPLOYEE DIRECTORY TABLE */}
      {canSeeExtendedTab && activeTab === 'all' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="p-12 flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
                <span className="text-xs font-medium text-slate-400">Loading leave balances...</span>
              </div>
            ) : filteredBalances.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                No leave balance records found matching your search.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="p-4 w-14 text-center">SL. NO</th>
                        <th className="p-4">Employee</th>
                        <th className="p-4">Leave Category</th>
                        <th className="p-4">Year</th>
                        <th className="p-4">Allotted</th>
                        <th className="p-4">Used</th>
                        <th className="p-4">Remaining</th>
                        <th className="p-4">Quota Usage</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                      {paginatedBalances.map((b, idx) => {
                        const globalIdx = startIndex + idx + 1;
                        const allotted = Number(b.allotted) || 1;
                        const remaining = Number(b.remaining) || 0;
                        const used = Number(b.used) || 0;
                        const pct = Math.min(100, Math.max(0, Math.round((used / allotted) * 100)));

                        return (
                          <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="p-4 text-center font-bold text-slate-400 dark:text-slate-500 font-mono text-[11px]">
                              {String(globalIdx).padStart(2, '0')}
                            </td>
                            <td className="p-4 font-bold text-slate-800 dark:text-slate-100">
                              <div className="flex items-center gap-2.5">
                                <div className={`w-8 h-8 rounded-full font-black text-xs flex items-center justify-center shrink-0 shadow-xs ${getAvatarColor(b.employee_name, b.employee_id || b.id)}`}>
                                  {b.employee_name?.slice(0, 1)?.toUpperCase() || 'E'}
                                </div>
                                <div>
                                  <span className="block font-extrabold text-slate-900 dark:text-slate-100">{b.employee_name || 'Staff Member'}</span>
                                  <span className="text-[10px] font-mono text-slate-400 block">{b.emp_id_code || b.employee_email}</span>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 font-semibold text-slate-700 dark:text-slate-200">
                              <div className="flex items-center gap-1.5">
                                <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-extrabold text-[10.5px] border border-indigo-200/60 dark:border-indigo-800/60">
                                  {b.leave_type_name || b.leave_type_code}
                                </span>
                                {b.is_paid !== undefined && (
                                  <span className={`px-2 py-0.5 rounded text-[9.5px] font-extrabold ${b.is_paid ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                                    {b.is_paid ? 'PAID' : 'UNPAID'}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-4 text-slate-500 font-mono font-bold">{b.balance_year}</td>
                            <td className="p-4 font-bold text-slate-700 dark:text-slate-300 font-mono">{formatDaysVal(b.allotted)}</td>
                            <td className="p-4 font-bold text-amber-600 dark:text-amber-400 font-mono">{formatDaysVal(b.used)}</td>
                            <td className="p-4">
                              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-extrabold text-[11px] border border-emerald-200 dark:border-emerald-800 font-mono">
                                {formatDaysVal(b.remaining)}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="w-28 space-y-1">
                                <div className="flex justify-between text-[10px] font-bold text-slate-500">
                                  <span>{pct}% used</span>
                                  <span>{100 - pct}% left</span>
                                </div>
                                <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                  <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full" style={{ width: `${pct}%` }}></div>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {canEditExtended && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        onClick={() => openEditBalance(b)}
                                        className="h-8 w-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/60 hover:bg-gradient-to-r hover:from-blue-600 hover:to-indigo-600 hover:text-white hover:border-transparent shadow-xs hover:shadow-md hover:shadow-blue-500/25 active:scale-95 transition-all duration-200 cursor-pointer flex items-center justify-center group/edit"
                                      >
                                        <svg className="w-3.5 h-3.5 transition-transform group-hover/edit:scale-110" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.83 20.089a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                        </svg>
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">Edit Quota</TooltipContent>
                                  </Tooltip>
                                )}
                                {canDeleteExtended && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        onClick={() => handleDeleteBalance(b.id)}
                                        className="h-8 w-8 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800/60 hover:bg-gradient-to-r hover:from-rose-600 hover:to-red-600 hover:text-white hover:border-transparent shadow-xs hover:shadow-md hover:shadow-rose-500/25 active:scale-95 transition-all duration-200 cursor-pointer flex items-center justify-center group/del"
                                      >
                                        <svg className="w-3.5 h-3.5 transition-transform group-hover/del:scale-110" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                        </svg>
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">Delete Quota</TooltipContent>
                                  </Tooltip>
                                )}
                                {!canEditExtended && !canDeleteExtended && (
                                  <span className="text-[11px] text-slate-400 italic">View only</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Modern Pagination Control Bar */}
                {totalItems > 0 && (
                  <ModernPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    pageSize={pageSize}
                    totalItems={totalItems}
                    startIndex={startIndex}
                    endIndex={endIndex}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={setPageSize}
                    pageSizeOptions={[10, 25, 50, 100, 200]}
                    itemLabel="leave quotas"
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* 🚪 EDIT / CREATE BALANCE DRAWER */}
      <SlideDrawer
        isOpen={balanceDrawerOpen}
        onClose={() => setBalanceDrawerOpen(false)}
        title={editingBalance ? 'Edit Employee Leave Quota' : 'Assign Leave Quota'}
      >
        <form onSubmit={handleSaveBalance} className="space-y-5 p-5">
          
          {/* 🌟 LIVE PREVIEW SUMMARY CARD */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/90 via-purple-50/70 to-blue-50/90 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-blue-950/40 border border-indigo-200/80 dark:border-indigo-800/50 space-y-2">
            <div className="flex items-center justify-between text-xs font-extrabold text-indigo-600 dark:text-indigo-400">
              <span className="uppercase tracking-wider">Quota Summary Preview</span>
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 font-bold text-[10px]">
                Year {balanceForm.balance_year}
              </span>
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Calculated Remaining Quota:</span>
              <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
                {formatDaysVal(balanceForm.remaining)}
              </span>
            </div>
          </div>

          {/* SEARCHABLE SELECT EMPLOYEE */}
          <div className="relative">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <i className="fa-solid fa-user text-indigo-500 text-xs"></i>
                <span>Select Employee *</span>
              </span>
              {selectedEmpObj && (
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-extrabold font-mono">
                  {selectedEmpObj.emp_id_code || selectedEmpObj.id_code}
                </span>
              )}
            </label>

            {editingBalance ? (
              <div className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200">
                {selectedEmpObj ? `${selectedEmpObj.first_name} ${selectedEmpObj.last_name}` : 'Selected Staff'}
              </div>
            ) : (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setEmpDropdownOpen(!empDropdownOpen)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 flex items-center justify-between transition-all cursor-pointer hover:border-indigo-500 focus:outline-none"
                >
                  <span className="truncate font-semibold">
                    {selectedEmpObj
                      ? `${selectedEmpObj.first_name} ${selectedEmpObj.last_name} ${selectedEmpObj.emp_id_code ? `(${selectedEmpObj.emp_id_code})` : ''}`
                      : '-- Choose Employee --'}
                  </span>
                  <i className={`fa-solid fa-chevron-down text-slate-400 text-xs transition-transform ${empDropdownOpen ? 'rotate-180' : ''}`}></i>
                </button>

                {empDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden p-2 space-y-2 animate-fadeIn">
                    {/* Search Field */}
                    <div className="relative">
                      <i className="fa-solid fa-magnifying-glass text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 text-xs"></i>
                      <input
                        type="text"
                        placeholder="Search by name or employee ID..."
                        value={empSearch}
                        onChange={e => setEmpSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500"
                        autoFocus
                      />
                    </div>

                    {/* Filtered Employees Options List */}
                    <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                      {filteredSearchEmployees.length === 0 ? (
                        <div className="p-3 text-center text-slate-400 text-xs">No matching employee found</div>
                      ) : (
                        filteredSearchEmployees.map(emp => (
                          <div
                            key={emp.id}
                            onClick={() => {
                              setBalanceForm(prev => ({ ...prev, employee_id: emp.id }));
                              setEmpDropdownOpen(false);
                              setEmpSearch('');
                            }}
                            className={`p-2.5 rounded-xl cursor-pointer transition-colors flex items-center justify-between ${
                              balanceForm.employee_id === emp.id
                                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium'
                            }`}
                          >
                            <span className="truncate">
                              {emp.first_name} {emp.last_name}
                            </span>
                            {emp.emp_id_code && (
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-mono text-slate-500 shrink-0">
                                {emp.emp_id_code}
                              </span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SELECT LEAVE CATEGORY DROPDOWN */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <i className="fa-solid fa-calendar-alt text-indigo-500 text-xs"></i>
              <span>Select Leave Category *</span>
            </label>
            <select
              value={balanceForm.leave_type_id}
              onChange={e => setBalanceForm(prev => ({ ...prev, leave_type_id: e.target.value }))}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer truncate"
              required
            >
              <option value="">-- Choose Leave Category --</option>
              {leaveTypes.map(lt => (
                <option key={lt.id} value={lt.id}>
                  {lt.name} ({lt.code})
                </option>
              ))}
            </select>
          </div>

          {/* DAYS BREAKDOWN GRID */}
          <div className="grid grid-cols-3 gap-3 pt-1">
            <div>
              <label className="text-[11px] font-extrabold text-slate-600 dark:text-slate-300 block mb-1">
                Allotted Days
              </label>
              <input
                type="number"
                step="0.5"
                value={balanceForm.allotted}
                onChange={e => {
                  const val = e.target.value;
                  const rem = Number(val) - Number(balanceForm.used);
                  setBalanceForm(prev => ({ ...prev, allotted: val, remaining: String(rem >= 0 ? rem : 0) }));
                }}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500 transition-all"
                required
              />
            </div>
            <div>
              <label className="text-[11px] font-extrabold text-amber-600 dark:text-amber-400 block mb-1">
                Used Days
              </label>
              <input
                type="number"
                step="0.5"
                value={balanceForm.used}
                onChange={e => {
                  const val = e.target.value;
                  const rem = Number(balanceForm.allotted) - Number(val);
                  setBalanceForm(prev => ({ ...prev, used: val, remaining: String(rem >= 0 ? rem : 0) }));
                }}
                className="w-full px-3 py-2 bg-amber-50/60 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs font-bold text-amber-700 dark:text-amber-300 outline-none focus:border-amber-500 transition-all"
                required
              />
            </div>
            <div>
              <label className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 block mb-1">
                Remaining
              </label>
              <input
                type="number"
                step="0.5"
                value={balanceForm.remaining}
                onChange={e => setBalanceForm(prev => ({ ...prev, remaining: e.target.value }))}
                className="w-full px-3 py-2 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs outline-none focus:border-emerald-500 transition-all"
                required
              />
            </div>
          </div>

          {/* ACTION BUTTONS */}
          <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 bg-[#07518a] hover:bg-[#053d69] text-white font-extrabold text-xs rounded-xl shadow-md shadow-[#07518a]/20 hover:shadow-lg hover:scale-[1.02] transition-all cursor-pointer"
            >
              {isSaving ? 'Saving...' : editingBalance ? 'Update Quota' : 'Assign Quota'}
            </button>
            <button
              type="button"
              onClick={() => setBalanceDrawerOpen(false)}
              className="px-5 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </SlideDrawer>
    </div>
  );
}
