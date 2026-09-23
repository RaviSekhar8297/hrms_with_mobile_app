'use client';

import React, { useEffect, useState } from 'react';
import DashboardPageHeader from '../../components/DashboardPageHeader';
import { getHeaders, API_BASE } from '../../utils/api';
import SlideDrawer from '../../components/SlideDrawer';
import { useDashboard } from '../../components/DashboardContext';
import { usePermissions } from '../../hooks/usePermissions';
import ModernPagination from '../../components/ModernPagination';
import { DatePickerSimple } from '@/components/ui/custom-controls';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { 
  AlertTriangle, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Trash2, 
  Edit2, 
  Clock, 
  Award,
  Calendar as CalendarIcon,
  Filter
} from 'lucide-react';

export default function CompOffClaimsPage() {
  const { showToast, companyId: globalCompanyId } = useDashboard();
  const { hasPermission, isSuperAdmin: isSuperAdminPerm, getPermissionScope } = usePermissions();

  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const activeCompanyId = globalCompanyId || companyId;

  const isSuperAdmin = isSuperAdminPerm || roles.includes('SuperAdmin') || roles.includes('superadmin');
  
  // 🛡️ Standardized tablename_action Permissions
  const canView = isSuperAdmin || hasPermission('leaves_compoff_view') || hasPermission('view_comp_off_requests');
  const canCreate = isSuperAdmin || hasPermission('leaves_compoff_create') || hasPermission('create_comp_off_requests');
  const canEdit = isSuperAdmin || hasPermission('leaves_compoff_edit') || hasPermission('edit_comp_off_requests');
  const canDelete = isSuperAdmin || hasPermission('leaves_compoff_delete') || hasPermission('delete_comp_off_requests');

  // 🌐 Data Scopes
  const viewScope_perm = getPermissionScope('leaves_compoff_view') || getPermissionScope('view_comp_off_requests') || 'SELF';
  const editScope_perm = getPermissionScope('leaves_compoff_edit') || getPermissionScope('edit_comp_off_requests') || 'SELF';
  const deleteScope_perm = getPermissionScope('leaves_compoff_delete') || getPermissionScope('delete_comp_off_requests') || 'SELF';

  // Can see the extended All/Team Requests tab
  const canSeeTeamTab = isSuperAdmin || ['TEAM', 'REPORTING', 'DEPARTMENT', 'ALL'].includes(viewScope_perm);

  // Can edit other employees' requests in All/Team tab
  const canEditTeamRequests = isSuperAdmin || (canEdit && ['TEAM', 'REPORTING', 'DEPARTMENT', 'ALL'].includes(editScope_perm));

  // Can delete other employees' requests in All/Team tab
  const canDeleteTeamRequests = isSuperAdmin || (canDelete && ['TEAM', 'REPORTING', 'DEPARTMENT', 'ALL'].includes(deleteScope_perm));

  const [viewScope, setViewScope] = useState<'my' | 'team'>('my');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [fromDateFilter, setFromDateFilter] = useState('');
  const [toDateFilter, setToDateFilter] = useState('');

  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [compOffRequests, setCompOffRequests] = useState<any[]>([]);
  const [eligibleDates, setEligibleDates] = useState<any[]>([]);
  const [isFetchingEligible, setIsFetchingEligible] = useState(false);
  const [compOffDrawerOpen, setCompOffDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [compOffForm, setCompOffForm] = useState({
    worked_date: '',
    comp_off_type: 'FULL_DAY',
    reason: ''
  });

  // Action (Approve / Reject) Modal State
  const [actionModal, setActionModal] = useState<{ open: boolean; req: any | null; type: 'APPROVE' | 'REJECT' }>({
    open: false,
    req: null,
    type: 'APPROVE'
  });
  const [managerRemarks, setManagerRemarks] = useState('');

  // Delete Confirmation Modal State
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    requestId: string | null;
    isDeleting: boolean;
  }>({
    isOpen: false,
    requestId: null,
    isDeleting: false
  });

  useEffect(() => {
    const storedRoles = localStorage.getItem('roles');
    const storedEmail = localStorage.getItem('email');
    const storedCompanyId = localStorage.getItem('companyId');
    let parsedRoles: string[] = [];
    if (storedRoles) {
      try {
        parsedRoles = JSON.parse(storedRoles);
        setRoles(parsedRoles);
      } catch (e) {}
    }
    if (storedEmail) setEmail(storedEmail);
    if (storedCompanyId) setCompanyId(storedCompanyId);

    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/companies`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.companies || []);
        setCompanies(list);
        if (!companyId && list.length > 0) {
          setCompanyId(list[0].id);
        }
      }
    } catch (e) {
      console.error('Error fetching companies:', e);
    }
  };

  const fetchCompOffRequests = async (scope: 'my' | 'team') => {
    setIsLoading(true);
    const cid = activeCompanyId || 'all';
    try {
      let scopeParam = scope === 'my' ? 'my' : 'team';
      if (scope === 'team') {
        if (viewScope_perm === 'DEPARTMENT') scopeParam = 'department';
        else if (viewScope_perm === 'ALL' || isSuperAdmin) scopeParam = 'all';
        else scopeParam = 'team';
      }

      const url = `${API_BASE}/api/v1/comp-off-requests?companyId=${cid}&scope=${scopeParam}`;
      const res = await fetch(url, { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) setCompOffRequests(data.requests || []);
      else setCompOffRequests([]);
    } catch (e) {
      showToast('Error loading comp-off requests', 'error');
      setCompOffRequests([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEligibleDates = async () => {
    setIsFetchingEligible(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/comp-off-requests/eligible-dates`, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) setEligibleDates(data.eligibleDates || []);
    } catch (e) {
      console.error('Error fetching eligible dates:', e);
    } finally {
      setIsFetchingEligible(false);
    }
  };

  useEffect(() => {
    if (canView) {
      fetchCompOffRequests(viewScope);
    }
  }, [viewScope, activeCompanyId, canView]);

  const handleOpenDrawer = () => {
    setEditingId(null);
    setCompOffForm({ worked_date: '', comp_off_type: 'FULL_DAY', reason: '' });
    setCompOffDrawerOpen(true);
    fetchEligibleDates();
  };

  const handleEditOpen = (req: any) => {
    setEditingId(req.id);
    setCompOffForm({
      worked_date: req.worked_date ? req.worked_date.split('T')[0] : '',
      comp_off_type: req.comp_off_type || 'FULL_DAY',
      reason: req.reason || ''
    });
    setCompOffDrawerOpen(true);
  };

  const handleClaimCompOff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compOffForm.worked_date) {
      showToast('Please select a worked weekend/holiday date', 'error');
      return;
    }
    if (!compOffForm.reason || compOffForm.reason.trim().length < 5) {
      showToast('Please provide a reason (minimum 5 characters)', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const url = editingId 
        ? `${API_BASE}/api/v1/comp-off-requests/${editingId}`
        : `${API_BASE}/api/v1/comp-off-requests`;
      
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(compOffForm)
      });
      const data = await res.json();
      if (res.ok) {
        showToast(editingId ? 'Comp-off claim updated successfully' : 'Comp-off claim submitted successfully', 'success');
        setCompOffDrawerOpen(false);
        setEditingId(null);
        setCompOffForm({ worked_date: '', comp_off_type: 'FULL_DAY', reason: '' });
        fetchCompOffRequests(viewScope);
      } else {
        showToast(data.error || 'Failed to submit comp-off claim', 'error');
      }
    } catch (e) {
      showToast('Server connection error', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModal.requestId) return;
    setDeleteModal(prev => ({ ...prev, isDeleting: true }));

    try {
      const res = await fetch(`${API_BASE}/api/v1/comp-off-requests/${deleteModal.requestId}`, {
        method: 'DELETE',
        headers: getHeaders()
      });

      const data = await res.json();
      if (res.ok) {
        showToast('Comp-off request deleted successfully!', 'success');
        setDeleteModal({ isOpen: false, requestId: null, isDeleting: false });
        fetchCompOffRequests(viewScope);
      } else {
        showToast(data.error || 'Failed to delete request.', 'error');
        setDeleteModal(prev => ({ ...prev, isDeleting: false }));
      }
    } catch (e) {
      showToast('Network error while deleting.', 'error');
      setDeleteModal(prev => ({ ...prev, isDeleting: false }));
    }
  };

  const handleProcessCompOff = async () => {
    if (!actionModal.req) return;
    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/comp-off-requests/${actionModal.req.id}/action`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          action: actionModal.type === 'APPROVE' ? 'APPROVED' : 'REJECTED',
          rejection_reason: managerRemarks
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Comp-off request ${actionModal.type === 'APPROVE' ? 'Approved' : 'Rejected'}`, 'success');
        setActionModal({ open: false, req: null, type: 'APPROVE' });
        setManagerRemarks('');
        fetchCompOffRequests(viewScope);
      } else {
        showToast(data.error || 'Failed to process request', 'error');
      }
    } catch (e) {
      showToast('Connection error', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Filter calculations
  const filtered = compOffRequests.filter(req => {
    const matchesStatus = statusFilter === 'ALL' || req.status === statusFilter;
    const name = req.employee_name || '';
    const code = req.emp_id_code || '';
    const q = searchTerm.toLowerCase();
    const matchesSearch = name.toLowerCase().includes(q) ||
                          code.toLowerCase().includes(q) ||
                          req.reason?.toLowerCase().includes(q);
    const reqWorkedDate = req.worked_date ? req.worked_date.split('T')[0] : '';
    const matchesFromDate = !fromDateFilter || reqWorkedDate >= fromDateFilter;
    const matchesToDate = !toDateFilter || reqWorkedDate <= toDateFilter;
    return matchesStatus && matchesSearch && matchesFromDate && matchesToDate;
  });

  // Pagination calculation
  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginated = filtered.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, fromDateFilter, toDateFilter, viewScope, activeCompanyId, pageSize]);

  const pendingCount = compOffRequests.filter(r => r.status === 'PENDING').length;
  const approvedCount = compOffRequests.filter(r => r.status === 'APPROVED').length;
  const rejectedCount = compOffRequests.filter(r => r.status === 'REJECTED').length;

  // 🛑 Access Restriction Screen if View Permission is missing
  if (!canView) {
    return (
      <div className="space-y-6 animate-fadeIn w-full font-sans text-slate-800 dark:text-slate-100">
        <DashboardPageHeader
          title="Comp-Off Claims & Approvals"
          companies={companies}
          companyId={companyId}
          handleCompanyChange={(id) => setCompanyId(id)}
          isSuperAdmin={isSuperAdmin}
          email={email}
          hideCompanySelect={false}
          hideUserBadge={true}
        />
        <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm text-center max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center text-3xl mb-4 border border-rose-200 dark:border-rose-900">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">Access Restricted</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium leading-relaxed">
            You do not have permission (<code className="text-rose-600 bg-rose-50 dark:bg-rose-950 px-1.5 py-0.5 rounded font-mono">leaves_compoff_view</code>) to view Comp-Off Claims. Please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 font-sans text-slate-800 dark:text-slate-100 animate-fadeIn">
      <DashboardPageHeader
        title="Comp-Off Claims & Approvals"
        companies={companies}
        companyId={companyId}
        handleCompanyChange={(id) => setCompanyId(id)}
        isSuperAdmin={isSuperAdmin}
        email={email}
        hideCompanySelect={false}
        hideUserBadge={true}
      />

      {/* 📊 SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Claims */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 shadow-xs hover:shadow-md transition-all duration-200 flex items-center justify-between hover:border-indigo-400">
          <div>
            <p className="text-[10.5px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Claims
            </p>
            <h3 className="text-2xl font-black mt-1 tracking-tight text-indigo-600 dark:text-indigo-400 font-mono">
              {compOffRequests.length}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900 flex items-center justify-center text-lg">
            📝
          </div>
        </div>

        {/* Card 2: Pending Review */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 shadow-xs hover:shadow-md transition-all duration-200 flex items-center justify-between hover:border-amber-400">
          <div>
            <p className="text-[10.5px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Pending Review
            </p>
            <h3 className="text-2xl font-black mt-1 tracking-tight text-amber-600 dark:text-amber-400 font-mono">
              {pendingCount}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900 flex items-center justify-center text-lg">
            ⏳
          </div>
        </div>

        {/* Card 3: Approved Credits */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 shadow-xs hover:shadow-md transition-all duration-200 flex items-center justify-between hover:border-emerald-400">
          <div>
            <p className="text-[10.5px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Approved Credits
            </p>
            <h3 className="text-2xl font-black mt-1 tracking-tight text-emerald-600 dark:text-emerald-400 font-mono">
              {approvedCount}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 flex items-center justify-center text-lg">
            ✅
          </div>
        </div>

        {/* Card 4: Rejected Claims */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 shadow-xs hover:shadow-md transition-all duration-200 flex items-center justify-between hover:border-rose-400">
          <div>
            <p className="text-[10.5px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">
              Rejected Claims
            </p>
            <h3 className="text-2xl font-black mt-1 tracking-tight text-rose-600 dark:text-rose-400 font-mono">
              {rejectedCount}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 flex items-center justify-center text-lg">
            ❌
          </div>
        </div>
      </div>

      {/* 🎛️ CONTROLS & FILTER BAR */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        
        {/* SCOPE SWITCHER / BADGE (LEFT) */}
        {canSeeTeamTab ? (
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setViewScope('my')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                viewScope === 'my'
                  ? 'bg-white dark:bg-slate-900 text-[#07518a] dark:text-[#38bdf8] shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              👤 My Requests
            </button>
            <button
              onClick={() => setViewScope('team')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                viewScope === 'team'
                  ? 'bg-white dark:bg-slate-900 text-[#07518a] dark:text-[#38bdf8] shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              👥 {viewScope_perm === 'ALL' || isSuperAdmin ? 'All Requests' : 'Team Requests'}
            </button>
          </div>
        ) : (
          <div className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 shrink-0">
            <span>👤 My Requests</span>
          </div>
        )}

        {/* RIGHT GROUP: SEARCH -> FROM/TO DATE FILTERS (using DatePickerSimple with maxDate disable future) -> STATUS PILLS -> CLAIM COMP-OFF BUTTON */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto flex-wrap">
          
          {/* 1. SEARCH INPUT */}
          <div className="relative w-full sm:w-44">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search name, ID, reason..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold placeholder:text-slate-400 text-slate-800 dark:text-slate-100 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-[#07518a] transition-all"
            />
          </div>

          {/* 2. FROM DATE PICKER (Future dates disabled) */}
          <div className="w-full sm:w-36">
            <DatePickerSimple
              placeholder="From Date"
              value={fromDateFilter}
              maxDate={new Date()}
              onChange={(val) => setFromDateFilter(val)}
            />
          </div>

          {/* 3. TO DATE PICKER (Future dates disabled) */}
          <div className="w-full sm:w-36">
            <DatePickerSimple
              placeholder="To Date"
              value={toDateFilter}
              maxDate={new Date()}
              onChange={(val) => setToDateFilter(val)}
            />
          </div>

          {/* 4. STATUS FILTER PILLS */}
          <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60 w-full sm:w-auto overflow-x-auto">
            {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                  statusFilter === st
                    ? 'bg-[#07518a] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-semibold'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* 5. CLAIM COMP-OFF BUTTON */}
          {canCreate && (
            <button
              onClick={handleOpenDrawer}
              className="w-full sm:w-auto px-4 py-1.5 bg-[#07518a] hover:bg-[#053d69] text-white text-xs font-extrabold rounded-xl shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
            >
              <span>+</span>
              <span>Claim Comp-Off</span>
            </button>
          )}

        </div>
      </div>

      {/* 📜 COMP-OFF TABLE */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
            <span className="text-xs font-medium text-slate-400">Loading comp-off claims...</span>
          </div>
        ) : paginated.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3 text-slate-300 dark:text-slate-600">📂</div>
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">No Comp-Off Claims Found</h4>
            <p className="text-xs text-slate-400 mt-1">Click "Claim Comp-Off" to request credit for worked weekend/holiday days.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="p-4 w-16 text-center">SL. NO</th>
                  <th className="p-4">Employee</th>
                  <th className="p-4">Worked Date</th>
                  <th className="p-4">Claim Type</th>
                  <th className="p-4">Credited Days</th>
                  <th className="p-4">Reason</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {paginated.map((req, idx) => {
                  const isPending = req.status === 'PENDING';
                  const canEditThis = isPending && (viewScope === 'my' ? canEdit : canEditTeamRequests);
                  const canDeleteThis = isPending && (viewScope === 'my' ? canDelete : canDeleteTeamRequests);
                  const canActionThis = isPending && viewScope === 'team' && canEditTeamRequests;

                  return (
                    <tr key={req.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="p-4 text-center font-bold text-slate-400 dark:text-slate-500 font-mono text-[11px]">
                        {String(startIndex + idx + 1).padStart(2, '0')}
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-slate-800 dark:text-slate-100">
                          {req.employee_name || 'Employee'}
                        </div>
                        {req.emp_id_code && (
                          <div className="text-[10px] font-mono text-slate-400">{req.emp_id_code}</div>
                        )}
                      </td>
                      <td className="p-4 font-semibold text-slate-700 dark:text-slate-200">
                        📅 {req.worked_date?.split('T')[0]}
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-extrabold text-[10.5px] border border-indigo-200/60 dark:border-indigo-800/60">
                          {req.comp_off_type}
                        </span>
                      </td>
                      <td className="p-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                        {req.credited_days || '1.00'} Day(s)
                      </td>
                      <td className="p-4 text-slate-600 dark:text-slate-300 max-w-[220px]">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate block font-medium">
                            {req.reason
                              ? (req.reason.length > 22 ? `${req.reason.substring(0, 22)}...` : req.reason)
                              : 'N/A'}
                          </span>
                          {req.reason && req.reason.length > 22 && (
                            <button
                              onClick={() => setSelectedReason(req.reason)}
                              title="Click to view full reason"
                              className="px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 rounded-md border border-indigo-200/80 dark:border-indigo-800/60 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 dark:hover:text-white transition-all shrink-0 cursor-pointer shadow-2xs"
                            >
                              View
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-[10.5px] font-extrabold uppercase tracking-wide inline-flex items-center gap-1.5 ${
                          req.status === 'APPROVED' ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' :
                          req.status === 'REJECTED' ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800' :
                          'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                        }`}>
                          {req.status === 'APPROVED' ? '✅ Approved' : req.status === 'REJECTED' ? '❌ Rejected' : '⏳ Pending'}
                        </span>
                      </td>
                      
                      {/* ACTION BUTTONS */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Approve / Reject buttons for Manager / Admin in Team tab */}
                          {canActionThis && (
                            <>
                              <button
                                onClick={() => setActionModal({ open: true, req, type: 'APPROVE' })}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow-xs transition-all cursor-pointer flex items-center gap-1"
                                title="Approve Claim"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Approve</span>
                              </button>
                              <button
                                onClick={() => setActionModal({ open: true, req, type: 'REJECT' })}
                                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg shadow-xs transition-all cursor-pointer flex items-center gap-1"
                                title="Reject Claim"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Reject</span>
                              </button>
                            </>
                          )}

                          {/* Edit button */}
                          {canEditThis && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => handleEditOpen(req)}
                                  className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition-colors cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Edit Claim</TooltipContent>
                            </Tooltip>
                          )}

                          {/* Delete button */}
                          {canDeleteThis && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => setDeleteModal({ isOpen: true, requestId: req.id, isDeleting: false })}
                                  className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Delete Claim</TooltipContent>
                            </Tooltip>
                          )}

                          {!canActionThis && !canEditThis && !canDeleteThis && (
                            <span className="text-[11px] text-slate-400 italic">No action</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION */}
        {!isLoading && filtered.length > 0 && (
          <ModernPagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={totalItems}
            startIndex={startIndex}
            endIndex={endIndex}
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
            pageSizeOptions={[10, 20, 50, 100]}
          />
        )}
      </div>

      {/* 🚪 CLAIM COMP-OFF DRAWER */}
      <SlideDrawer
        isOpen={compOffDrawerOpen}
        onClose={() => setCompOffDrawerOpen(false)}
        title={editingId ? 'Edit Comp-Off Claim' : 'Claim Comp-Off Credit'}
      >
        <form onSubmit={handleClaimCompOff} className="space-y-4 p-4">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Select Worked Weekend / Holiday Date *
            </label>
            {isFetchingEligible ? (
              <div className="text-xs text-slate-400 p-3 bg-slate-50 rounded-xl">Fetching eligible dates...</div>
            ) : eligibleDates.length === 0 ? (
              <div>
                <DatePickerSimple
                  placeholder="Select worked date"
                  value={compOffForm.worked_date}
                  maxDate={new Date()}
                  onChange={(val) => setCompOffForm(prev => ({ ...prev, worked_date: val }))}
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Pick a past worked weekend/holiday date (future dates are disabled).</span>
              </div>
            ) : (
              <select
                value={compOffForm.worked_date}
                onChange={e => setCompOffForm(prev => ({ ...prev, worked_date: e.target.value }))}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
                required
              >
                <option value="">-- Choose Auto-Detected Worked Date --</option>
                {eligibleDates.map(d => (
                  <option key={d.date} value={d.date}>
                    📅 {d.date} ({d.reason || 'Weekend/Holiday Punch'})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Claim Duration Type</label>
            <div className="grid grid-cols-2 gap-2">
              {['FULL_DAY', 'HALF_DAY'].map(type => (
                <button
                  type="button"
                  key={type}
                  onClick={() => setCompOffForm(prev => ({ ...prev, comp_off_type: type }))}
                  className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                    compOffForm.comp_off_type === type
                      ? 'border-[#07518a] bg-[#07518a]/10 text-[#07518a] dark:text-[#38bdf8]'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {type === 'FULL_DAY' ? 'Full Day (1.0 Credit)' : 'Half Day (0.5 Credit)'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Reason / Project Notes *</label>
            <textarea
              rows={3}
              placeholder="State reason or project task completed on this day..."
              value={compOffForm.reason}
              onChange={e => setCompOffForm(prev => ({ ...prev, reason: e.target.value }))}
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:border-[#07518a]"
              required
            />
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 bg-[#07518a] hover:bg-[#053d69] text-white font-bold text-xs rounded-xl shadow cursor-pointer transition-colors"
            >
              {isSaving ? 'Submitting...' : editingId ? 'Update Claim' : 'Submit Claim'}
            </button>
            <button
              type="button"
              onClick={() => setCompOffDrawerOpen(false)}
              className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </SlideDrawer>

      {/* 💬 ACTION MODAL */}
      {actionModal.open && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
              {actionModal.type === 'APPROVE' ? 'Approve Comp-Off Claim' : 'Reject Comp-Off Claim'}
            </h4>
            
            <p className="text-xs text-slate-500">
              Confirm {actionModal.type.toLowerCase()} for <strong className="text-slate-800 dark:text-slate-200">{actionModal.req?.employee_name}</strong> on date {actionModal.req?.worked_date?.split('T')[0]}.
            </p>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Remarks</label>
              <textarea
                rows={3}
                placeholder="Manager comments..."
                value={managerRemarks}
                onChange={e => setManagerRemarks(e.target.value)}
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:border-[#07518a]"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleProcessCompOff}
                disabled={isSaving}
                className={`flex-1 py-2.5 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition-colors ${
                  actionModal.type === 'APPROVE' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'
                }`}
              >
                {isSaving ? 'Processing...' : `Confirm ${actionModal.type}`}
              </button>
              <button
                onClick={() => setActionModal({ open: false, req: null, type: 'APPROVE' })}
                className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🗑️ DELETE CONFIRMATION MODAL */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-scaleUp text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-600 flex items-center justify-center mx-auto text-xl">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-black text-slate-900 dark:text-slate-100">Delete Comp-Off Request?</h4>
              <p className="text-xs text-slate-500 mt-1">This action cannot be undone. Are you sure you want to permanently delete this claim?</p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteModal.isDeleting}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition-colors"
              >
                {deleteModal.isDeleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
              <button
                onClick={() => setDeleteModal({ isOpen: false, requestId: null, isDeleting: false })}
                className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📜 FULL REASON MODAL POPOVER */}
      {selectedReason && (
        <div className="fixed inset-0 z-[110] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => setSelectedReason(null)}>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-scaleUp" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
                  📝
                </div>
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-100">
                  Full Comp-Off Reason
                </h4>
              </div>
              <button onClick={() => setSelectedReason(null)} className="text-slate-400 hover:text-rose-500 transition-colors p-1 cursor-pointer">
                ✕
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 font-medium leading-relaxed max-h-60 overflow-y-auto">
              {selectedReason}
            </div>

            <div className="text-right">
              <button
                onClick={() => setSelectedReason(null)}
                className="px-5 py-2 rounded-xl bg-[#07518a] hover:bg-[#053d69] text-white text-xs font-extrabold shadow-xs transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
