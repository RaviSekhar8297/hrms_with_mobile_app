'use client';

import React, { useEffect, useState } from 'react';
import DashboardPageHeader from '../../components/DashboardPageHeader';
import { getHeaders, API_BASE } from '../../utils/api';
import SlideDrawer from '../../components/SlideDrawer';
import { useDashboard } from '../../components/DashboardContext';
import { usePermissions } from '../../hooks/usePermissions';
import { Edit2, Trash2, CheckCircle2, XCircle, Clock, FileText, AlertTriangle, ShieldCheck, Search, Filter } from 'lucide-react';
import ModernPagination from '../../components/ModernPagination';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import CustomDatePicker from '../../components/CustomDatePicker';

export default function AttendanceRegularizationPage() {
  const { showToast, companyId: globalCompanyId } = useDashboard();
  const { hasPermission, isSuperAdmin, getPermissionScope } = usePermissions();

  // 🛡️ Standardized tablename_action Permissions
  const canView = isSuperAdmin || hasPermission('attendance_regularizations_view') || hasPermission('view_attendance_regularizations');
  const canCreate = isSuperAdmin || hasPermission('attendance_regularizations_create') || hasPermission('create_attendance_regularizations') || hasPermission('apply_attendance_regularization');
  const canEdit = isSuperAdmin || hasPermission('attendance_regularizations_edit') || hasPermission('edit_attendance_regularizations') || hasPermission('update_attendance_regularizations');
  const canDelete = isSuperAdmin || hasPermission('attendance_regularizations_delete') || hasPermission('delete_attendance_regularizations');

  // 🌐 Data Scopes
  const viewScope_perm = getPermissionScope('attendance_regularizations_view') || getPermissionScope('view_attendance_regularizations') || 'SELF';
  const editScope_perm = getPermissionScope('attendance_regularizations_edit') || getPermissionScope('edit_attendance_regularizations') || 'SELF';
  const deleteScope_perm = getPermissionScope('attendance_regularizations_delete') || getPermissionScope('delete_attendance_regularizations') || 'SELF';

  // Can see the extended All/Team Requests tab
  const canSeeTeamTab = isSuperAdmin || ['TEAM', 'REPORTING', 'DEPARTMENT', 'ALL'].includes(viewScope_perm);

  // Can edit other employees' requests in All/Team tab
  const canEditTeamRequests = isSuperAdmin || (canEdit && ['TEAM', 'REPORTING', 'DEPARTMENT', 'ALL'].includes(editScope_perm));

  // Can delete other employees' requests in All/Team tab
  const canDeleteTeamRequests = isSuperAdmin || (canDelete && ['TEAM', 'REPORTING', 'DEPARTMENT', 'ALL'].includes(deleteScope_perm));

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [viewScope, setViewScope] = useState<'my' | 'team'>('my');
  const [searchQuery, setSearchQuery] = useState('');

  const activeCompanyId = globalCompanyId || companyId;

  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Edit Drawer State
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [editingReq, setEditingReq] = useState<any | null>(null);

  // Delete Confirmation Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingReqId, setDeletingReqId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [form, setForm] = useState({
    employee_id: '',
    attendance_date: new Date().toISOString().split('T')[0],
    punch_type: 'CHECK_IN' as 'CHECK_IN' | 'CHECK_OUT' | 'BOTH',
    requested_in: '09:30',
    requested_out: '18:30',
    reason: '',
  });

  const [editForm, setEditForm] = useState({
    attendance_date: '',
    punch_type: 'CHECK_IN' as 'CHECK_IN' | 'CHECK_OUT' | 'BOTH',
    requested_in: '09:30',
    requested_out: '18:30',
    reason: '',
  });

  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        setEmail(u.email || '');
      } catch (e) {
        console.error(e);
      }
    }
    const storedRoles = localStorage.getItem('roles');
    if (storedRoles) {
      try { setRoles(JSON.parse(storedRoles)); } catch { setRoles([]); }
    }

    const savedCompanyId = localStorage.getItem('companyId');
    if (savedCompanyId) {
      setCompanyId(savedCompanyId);
    }

    fetchCompanies();
  }, []);

  useEffect(() => {
    if (canView) {
      fetchEmployees();
      fetchRequests();
    }
  }, [activeCompanyId, viewScope, canView]);

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

  const fetchEmployees = async () => {
    try {
      const cid = activeCompanyId || localStorage.getItem('companyId');
      const url = cid && cid !== 'all' ? `${API_BASE}/api/v1/employees?company_id=${cid}` : `${API_BASE}/api/v1/employees`;
      const res = await fetch(url, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setEmployees(Array.isArray(data) ? data : (data.employees || data.data || []));
      } else {
        setEmployees([]);
      }
    } catch (e) {
      console.error(e);
      setEmployees([]);
    }
  };

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const cid = activeCompanyId || localStorage.getItem('companyId');
      let scopeParam = viewScope === 'my' ? 'my' : 'team';
      if (viewScope === 'team') {
        if (viewScope_perm === 'DEPARTMENT') scopeParam = 'department';
        else if (viewScope_perm === 'ALL' || isSuperAdmin) scopeParam = 'all';
        else scopeParam = 'team';
      }

      const url = cid && cid !== 'all'
        ? `${API_BASE}/api/v1/attendance/regularizations?company_id=${cid}&scope=${scopeParam}`
        : `${API_BASE}/api/v1/attendance/regularizations?scope=${scopeParam}`;
      const res = await fetch(url, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setRequests(Array.isArray(data) ? data : (data.data || data.regularizations || []));
      } else {
        setRequests([]);
      }
    } catch (e) {
      console.error('Error fetching regularizations:', e);
      setRequests([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompanyChange = (newId: string) => {
    setCompanyId(newId);
    localStorage.setItem('selectedCompanyId', newId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate) {
      showToast('You do not have permission to submit regularizations', 'error');
      return;
    }
    const cid = activeCompanyId || companyId || localStorage.getItem('companyId');
    if (!cid) {
      showToast('Please select a company context', 'error');
      return;
    }
    if (!form.attendance_date) {
      showToast('Please select an attendance date', 'error');
      return;
    }
    if (form.punch_type === 'CHECK_IN' && !form.requested_in) {
      showToast('Please enter requested In-Time', 'error');
      return;
    }
    if (form.punch_type === 'CHECK_OUT' && !form.requested_out) {
      showToast('Please enter requested Out-Time', 'error');
      return;
    }
    if (form.punch_type === 'BOTH' && (!form.requested_in || !form.requested_out)) {
      showToast('Please enter both In-Time and Out-Time', 'error');
      return;
    }
    const trimmedReason = form.reason ? form.reason.trim() : '';
    if (!trimmedReason || trimmedReason.length < 5) {
      showToast('Reason must be at least 5 characters', 'error');
      return;
    }
    if (trimmedReason.length > 100) {
      showToast('Reason cannot exceed 100 characters', 'error');
      return;
    }
    
    // Resolve employee ID
    const currentEmpId = localStorage.getItem('employeeId') || (employees.find(emp => emp.email === email)?.id) || '';
    const targetEmpId = form.employee_id || currentEmpId;

    // Client-side instant overlap check
    const activeReq = requests.find(r => 
      (r.status === 'PENDING' || r.status === 'APPROVED') &&
      r.attendance_date?.split('T')[0] === form.attendance_date &&
      (!targetEmpId || r.employee_id === targetEmpId)
    );
    if (activeReq) {
      const exPunch = activeReq.punch_type || ((activeReq.requested_in && activeReq.requested_out) ? 'BOTH' : (activeReq.requested_out ? 'CHECK_OUT' : 'CHECK_IN'));
      const st = activeReq.status.toLowerCase();
      if (exPunch === 'BOTH') {
        showToast(`A regularization request (Both In & Out) for date ${form.attendance_date} is already ${st}.`, 'error');
        return;
      }
      if (exPunch === 'CHECK_IN') {
        if (form.punch_type === 'CHECK_IN') {
          showToast(`A Check-In request for date ${form.attendance_date} is already ${st}.`, 'error');
          return;
        }
        if (form.punch_type === 'BOTH') {
          showToast(`A Check-In request for date ${form.attendance_date} is already ${st}. You can only apply for Check-Out.`, 'error');
          return;
        }
      }
      if (exPunch === 'CHECK_OUT') {
        if (form.punch_type === 'CHECK_OUT') {
          showToast(`A Check-Out request for date ${form.attendance_date} is already ${st}.`, 'error');
          return;
        }
        if (form.punch_type === 'BOTH') {
          showToast(`A Check-Out request for date ${form.attendance_date} is already ${st}. You can only apply for Check-In.`, 'error');
          return;
        }
      }
    }

    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/attendance/regularizations`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          company_id: cid,
          companyId: cid,
          employee_id: targetEmpId || undefined,
          attendance_date: form.attendance_date,
          punch_type: form.punch_type,
          requested_in: (form.punch_type === 'CHECK_IN' || form.punch_type === 'BOTH') ? form.requested_in : undefined,
          requested_out: (form.punch_type === 'CHECK_OUT' || form.punch_type === 'BOTH') ? form.requested_out : undefined,
          reason: trimmedReason,
        }),
      });

      if (res.ok) {
        showToast('Regularization request submitted successfully!', 'success');
        setDrawerOpen(false);
        setForm({
          employee_id: '',
          attendance_date: todayStr,
          punch_type: 'CHECK_IN',
          requested_in: '09:30',
          requested_out: '18:30',
          reason: '',
        });
        fetchRequests();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to submit regularization request', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Connection error', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const openEditDrawer = (req: any) => {
    setEditingReq(req);
    const dateStr = req.attendance_date ? new Date(req.attendance_date).toISOString().split('T')[0] : '';
    const punchType: 'CHECK_IN' | 'CHECK_OUT' | 'BOTH' = (req.requested_in && req.requested_out) ? 'BOTH' : (req.requested_out ? 'CHECK_OUT' : 'CHECK_IN');
    setEditForm({
      attendance_date: dateStr,
      punch_type: punchType,
      requested_in: req.requested_in || '09:30',
      requested_out: req.requested_out || '18:30',
      reason: req.reason || '',
    });
    setEditDrawerOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReq) return;
    const trimmedReason = editForm.reason ? editForm.reason.trim() : '';
    if (trimmedReason.length < 5 || trimmedReason.length > 100) {
      showToast('Reason must be between 5 and 100 characters', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/attendance/regularizations/${editingReq.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          attendance_date: editForm.attendance_date,
          punch_type: editForm.punch_type,
          requested_in: (editForm.punch_type === 'CHECK_IN' || editForm.punch_type === 'BOTH') ? editForm.requested_in : null,
          requested_out: (editForm.punch_type === 'CHECK_OUT' || editForm.punch_type === 'BOTH') ? editForm.requested_out : null,
          reason: trimmedReason
        }),
      });

      if (res.ok) {
        showToast('Regularization request updated successfully!', 'success');
        setEditDrawerOpen(false);
        setEditingReq(null);
        fetchRequests();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to update regularization request', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Connection error', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const openDeleteModal = (id: string) => {
    setDeletingReqId(id);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingReqId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/attendance/regularizations/${deletingReqId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (res.ok) {
        showToast('Regularization request deleted successfully!', 'success');
        setDeleteModalOpen(false);
        setDeletingReqId(null);
        fetchRequests();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to delete regularization request', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Connection error', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAction = async (id: string, action: 'APPROVED' | 'REJECTED') => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/attendance/regularizations/${id}/action`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        showToast(
          `Regularization request ${action === 'APPROVED' ? 'approved' : 'rejected'} successfully!`,
          action === 'APPROVED' ? 'success' : 'info'
        );
        fetchRequests();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to update request', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Connection error while updating request', 'error');
    }
  };

  const safeRequests = Array.isArray(requests) ? requests : [];
  const filteredRequests = safeRequests.filter((reqItem) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const empName = `${reqItem?.first_name || ''} ${reqItem?.last_name || ''}`.toLowerCase();
    const empCode = (reqItem?.emp_id_code || '').toLowerCase();
    const reason = (reqItem?.reason || '').toLowerCase();
    const status = (reqItem?.status || '').toLowerCase();
    const date = (reqItem?.attendance_date || '').toLowerCase();
    const punchType = (reqItem?.punch_type || '').toLowerCase();

    return empName.includes(q) || empCode.includes(q) || reason.includes(q) || status.includes(q) || date.includes(q) || punchType.includes(q);
  });

  // Pagination calculation
  const totalItems = filteredRequests.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedRequests = filteredRequests.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, viewScope, activeCompanyId, pageSize]);

  const pendingCount = safeRequests.filter(r => r?.status === 'PENDING').length;
  const approvedCount = safeRequests.filter(r => r?.status === 'APPROVED').length;
  const rejectedCount = safeRequests.filter(r => r?.status === 'REJECTED').length;

  // 🛑 Access Restriction Screen if View Permission is missing
  if (!canView) {
    return (
      <div className="space-y-6 animate-fadeIn w-full font-sans">
        <DashboardPageHeader
          title="Attendance Management"
          actionMessage=""
          actionError=""
          companies={companies}
          companyId={companyId}
          handleCompanyChange={handleCompanyChange}
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
            You do not have permission (<code className="text-rose-600 bg-rose-50 dark:bg-rose-950 px-1.5 py-0.5 rounded font-mono">attendance_regularizations_view</code>) to view attendance regularization records. Please contact your system administrator to request access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn w-full font-sans">
      <DashboardPageHeader
        title="Attendance Management"
        actionMessage=""
        actionError=""
        companies={companies}
        companyId={companyId}
        handleCompanyChange={handleCompanyChange}
        isSuperAdmin={isSuperAdmin}
        email={email}
        hideCompanySelect={false}
        hideUserBadge={true}
      />

      {/* SUMMARY STATS CARDS (TOP) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 shadow-xs hover:shadow-md transition-all duration-200 flex items-center justify-between hover:border-indigo-400">
          <div>
            <p className="text-[10.5px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Applications</p>
            <h3 className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono mt-1">{requests.length}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900 flex items-center justify-center text-lg">
            📝
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 shadow-xs hover:shadow-md transition-all duration-200 flex items-center justify-between hover:border-amber-400">
          <div>
            <p className="text-[10.5px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider">Pending Approval</p>
            <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono mt-1">{pendingCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900 flex items-center justify-center text-lg">
            ⏳
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 shadow-xs hover:shadow-md transition-all duration-200 flex items-center justify-between hover:border-emerald-400">
          <div>
            <p className="text-[10.5px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Approved Requests</p>
            <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">{approvedCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 flex items-center justify-center text-lg">
            ☑️
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 shadow-xs hover:shadow-md transition-all duration-200 flex items-center justify-between hover:border-rose-400">
          <div>
            <p className="text-[10.5px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider">Rejected Applications</p>
            <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono mt-1">{rejectedCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 flex items-center justify-center text-lg">
            ❌
          </div>
        </div>
      </div>

      {/* HEADER & FILTER BAR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border-2 border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h2 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span>📝</span> Attendance Regularization Requests
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Submit missed IN/OUT punchs
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap sm:flex-nowrap">
          {/* SEARCH INPUT BAR */}
          <div className="relative min-w-[210px] flex-1 sm:flex-initial">
            <input
              type="text"
              placeholder="Search by name, date, status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-all shadow-2xs"
            />
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold cursor-pointer border-0 bg-transparent"
              >
                ✕
              </button>
            )}
          </div>

          {/* SCOPE TABS */}
          {canSeeTeamTab && (
            <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
              <button
                onClick={() => setViewScope('my')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-0 ${
                  viewScope === 'my'
                    ? 'bg-[#07518a] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-[#07518a] dark:hover:text-[#38bdf8]'
                }`}
              >
                My Requests
              </button>
              <button
                onClick={() => setViewScope('team')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-0 ${
                  viewScope === 'team'
                    ? 'bg-[#07518a] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-[#07518a] dark:hover:text-[#38bdf8]'
                }`}
              >
                {viewScope_perm === 'ALL' || isSuperAdmin ? 'All Requests' : 'Team Requests'}
              </button>
            </div>
          )}

          {/* CREATE BUTTON (No scope needed, just attendance_regularizations_create) */}
          {canCreate && (
            <button
              onClick={() => setDrawerOpen(true)}
              className="px-4 py-2 rounded-xl bg-[#07518a] hover:bg-[#064270] text-white text-xs font-bold shadow-md shadow-[#07518a]/20 transition-all cursor-pointer border-0 flex items-center gap-2 whitespace-nowrap"
            >
              <span>+</span> Apply Regularization
            </button>
          )}
        </div>
      </div>

      {/* REGULARIZATION REQUESTS TABLE */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[580px] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800/90 backdrop-blur-xs z-10 text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Attendance Date</th>
                <th className="py-3 px-4">Punch Type</th>
                <th className="py-3 px-4">Requested Time</th>
                <th className="py-3 px-4">Reason</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs font-medium text-slate-700 dark:text-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-bold">Loading regularization requests...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="text-3xl">📭</span>
                      <span className="text-xs font-bold">
                        {searchQuery ? 'No requests match your search query.' : (viewScope === 'my' ? 'You have not submitted any regularization requests.' : 'No team regularization requests found.')}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRequests.map((req) => {
                  const empName = req.first_name ? `${req.first_name} ${req.last_name || ''}` : (req.employee_name || 'Self');
                  const empCode = req.emp_id_code || '';
                  const punchType = req.punch_type || ((req.requested_in && req.requested_out) ? 'BOTH' : (req.requested_out ? 'CHECK_OUT' : 'CHECK_IN'));
                  const punchTime = punchType === 'BOTH'
                    ? (req.requested_in && req.requested_out ? `In: ${req.requested_in} | Out: ${req.requested_out}` : (req.requested_in || req.requested_out || '--:--'))
                    : (req.requested_in || req.requested_out || req.requested_time || '--:--');
                  const dateStr = req.attendance_date ? new Date(req.attendance_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-';

                  return (
                    <tr key={req.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      {/* Col 1: Employee */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-black shrink-0 border border-indigo-100 dark:border-indigo-900">
                            {empName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 dark:text-slate-100">{empName}</p>
                            {empCode && <p className="text-[10px] text-slate-400 font-mono">{empCode}</p>}
                          </div>
                        </div>
                      </td>

                      {/* Col 2: Date */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                        {dateStr}
                      </td>

                      {/* Col 3: Punch Type */}
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                          punchType === 'CHECK_IN'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300'
                            : punchType === 'CHECK_OUT'
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300'
                              : 'bg-teal-100 text-teal-800 dark:bg-teal-950/70 dark:text-teal-300'
                        }`}>
                          {punchType === 'CHECK_IN' ? 'Check-In Punch' : punchType === 'CHECK_OUT' ? 'Check-Out Punch' : 'Both (In & Out)'}
                        </span>
                      </td>

                      {/* Col 4: Requested Time */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-100">
                        {punchTime}
                      </td>

                      {/* Col 5: Reason */}
                      <td className="py-3 px-4 max-w-[240px]">
                        <p className="text-xs text-slate-600 dark:text-slate-300 truncate" title={req.reason}>
                          {req.reason || 'No reason provided'}
                        </p>
                      </td>

                      {/* Col 6: Status */}
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          req.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : req.status === 'REJECTED'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 animate-pulse'
                        }`}>
                          {req.status}
                        </span>
                      </td>

                      {/* Col 7: Actions */}
                      <td className="py-3 px-4 text-right">
                        {viewScope === 'team' ? (
                          /* Team / All Requests Tab: Action buttons (Approve/Reject) + Edit/Delete if scoped */
                          req.status === 'PENDING' ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => handleAction(req.id, 'APPROVED')}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-2xs transition-all cursor-pointer border-0 flex items-center gap-1"
                                  >
                                    <CheckCircle2 className="w-3 h-3" /> Approve
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>Approve this regularization request</TooltipContent>
                              </Tooltip>

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => handleAction(req.id, 'REJECTED')}
                                    className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold shadow-2xs transition-all cursor-pointer border-0 flex items-center gap-1"
                                  >
                                    <XCircle className="w-3 h-3" /> Reject
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>Reject this regularization request</TooltipContent>
                              </Tooltip>

                              {canEditTeamRequests && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      onClick={() => openEditDrawer(req)}
                                      className="p-1.5 rounded-lg bg-[#07518a]/10 hover:bg-[#07518a] text-[#07518a] hover:text-white dark:text-[#38bdf8] transition-all cursor-pointer border-0"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>Edit request details</TooltipContent>
                                </Tooltip>
                              )}

                              {canDeleteTeamRequests && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      onClick={() => openDeleteModal(req.id)}
                                      className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:hover:bg-rose-900 dark:text-rose-400 transition-all cursor-pointer border-0"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>Delete regularization request</TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">
                              {req.status === 'APPROVED' ? 'Approved' : 'Rejected'}
                            </span>
                          )
                        ) : (
                          /* My Requests Tab: Self approval hidden, show Edit & Delete if Pending */
                          req.status === 'PENDING' ? (
                            <div className="flex items-center justify-end gap-1.5">
                              {canEdit && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      onClick={() => openEditDrawer(req)}
                                      className="p-1.5 rounded-lg bg-[#07518a]/10 hover:bg-[#07518a] text-[#07518a] hover:text-white dark:text-[#38bdf8] transition-all cursor-pointer border-0"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>Edit your pending request</TooltipContent>
                                </Tooltip>
                              )}
                              {canDelete && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      onClick={() => openDeleteModal(req.id)}
                                      className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:hover:bg-rose-900 dark:text-rose-400 transition-all cursor-pointer border-0"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>Delete your pending request</TooltipContent>
                                </Tooltip>
                              )}
                              {!canEdit && !canDelete && (
                                <span className="text-[10px] text-slate-400 italic">Awaiting Review</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">
                              {req.status === 'APPROVED' ? 'Approved' : 'Rejected'}
                            </span>
                          )
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 🚀 MODERN ELEGANT PAGINATION */}
        {!isLoading && filteredRequests.length > 0 && (
          <ModernPagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={totalItems}
            startIndex={startIndex}
            endIndex={endIndex}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[10, 25, 50, 100]}
            itemLabel="requests"
          />
        )}
      </div>

      {/* APPLY REGULARIZATION DRAWER */}
      <SlideDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Apply Punch Regularization"
      >
        <form onSubmit={handleSubmit} noValidate className="space-y-4 text-xs font-sans p-1">
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Attendance Date *
            </label>
            <CustomDatePicker
              value={form.attendance_date}
              onChange={(val) => setForm({ ...form, attendance_date: val })}
              maxDate={todayStr}
              placeholder="Select attendance date..."
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Punch Type *
            </label>
            <select
              value={form.punch_type}
              onChange={(e) => setForm({ ...form, punch_type: e.target.value as any })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-bold cursor-pointer"
            >
              <option value="CHECK_IN">📥 Check-In Punch (In-Time Only)</option>
              <option value="CHECK_OUT">📤 Check-Out Punch (Out-Time Only)</option>
              <option value="BOTH">🌐 Both (In & Out Punch)</option>
            </select>
          </div>

          {form.punch_type === 'BOTH' ? (
            <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-950/60 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Requested In-Time *
                </label>
                <input
                  type="time"
                  value={form.requested_in}
                  onChange={(e) => setForm({ ...form, requested_in: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Requested Out-Time *
                </label>
                <input
                  type="time"
                  value={form.requested_out}
                  onChange={(e) => setForm({ ...form, requested_out: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold"
                />
              </div>
            </div>
          ) : form.punch_type === 'CHECK_IN' ? (
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Requested Check-In Time (HH:MM) *
              </label>
              <input
                type="time"
                value={form.requested_in}
                onChange={(e) => setForm({ ...form, requested_in: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-bold"
              />
            </div>
          ) : (
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Requested Check-Out Time (HH:MM) *
              </label>
              <input
                type="time"
                value={form.requested_out}
                onChange={(e) => setForm({ ...form, requested_out: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-bold"
              />
            </div>
          )}

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block font-bold text-slate-700 dark:text-slate-300">
                Reason / Explanation *
              </label>
              <span className={`text-[10px] font-bold ${form.reason.length < 5 || form.reason.length > 100 ? 'text-amber-500' : 'text-slate-400'}`}>
                {form.reason.length}/100 (min 5)
              </span>
            </div>
            <textarea
              rows={3}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="e.g. Biometric machine offline / Forgot to punch"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-medium"
            />
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-0 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold border-0 shadow-md cursor-pointer disabled:opacity-50"
            >
              {isSaving ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </SlideDrawer>

      {/* EDIT REGULARIZATION DRAWER */}
      <SlideDrawer
        isOpen={editDrawerOpen}
        onClose={() => setEditDrawerOpen(false)}
        title="Edit Regularization Request"
      >
        <form onSubmit={handleEditSubmit} noValidate className="space-y-4 text-xs font-sans p-1">
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Attendance Date *
            </label>
            <CustomDatePicker
              value={editForm.attendance_date}
              onChange={(val) => setEditForm({ ...editForm, attendance_date: val })}
              maxDate={todayStr}
              placeholder="Select attendance date..."
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Punch Type *
            </label>
            <select
              value={editForm.punch_type}
              onChange={(e) => setEditForm({ ...editForm, punch_type: e.target.value as any })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-bold cursor-pointer"
            >
              <option value="CHECK_IN">📥 Check-In Punch (In-Time Only)</option>
              <option value="CHECK_OUT">📤 Check-Out Punch (Out-Time Only)</option>
              <option value="BOTH">🌐 Both (In & Out Punch)</option>
            </select>
          </div>

          {editForm.punch_type === 'BOTH' ? (
            <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-950/60 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Requested In-Time *
                </label>
                <input
                  type="time"
                  value={editForm.requested_in}
                  onChange={(e) => setEditForm({ ...editForm, requested_in: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Requested Out-Time *
                </label>
                <input
                  type="time"
                  value={editForm.requested_out}
                  onChange={(e) => setEditForm({ ...editForm, requested_out: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold"
                />
              </div>
            </div>
          ) : editForm.punch_type === 'CHECK_IN' ? (
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Requested Check-In Time (HH:MM) *
              </label>
              <input
                type="time"
                value={editForm.requested_in}
                onChange={(e) => setEditForm({ ...editForm, requested_in: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-bold"
              />
            </div>
          ) : (
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Requested Check-Out Time (HH:MM) *
              </label>
              <input
                type="time"
                value={editForm.requested_out}
                onChange={(e) => setEditForm({ ...editForm, requested_out: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-bold"
              />
            </div>
          )}

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block font-bold text-slate-700 dark:text-slate-300">
                Reason / Explanation *
              </label>
              <span className={`text-[10px] font-bold ${editForm.reason.length < 5 || editForm.reason.length > 100 ? 'text-amber-500' : 'text-slate-400'}`}>
                {editForm.reason.length}/100 (min 5)
              </span>
            </div>
            <textarea
              rows={3}
              value={editForm.reason}
              onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
              placeholder="e.g. Biometric machine offline / Forgot to punch"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-medium"
            />
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditDrawerOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-0 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-[#07518a] hover:bg-[#064270] text-white font-bold border-0 shadow-md shadow-[#07518a]/20 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? 'Updating...' : 'Update Request'}
            </button>
          </div>
        </form>
      </SlideDrawer>

      {/* DELETE CONFIRMATION MODAL */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border-2 border-slate-200 dark:border-slate-800 max-w-sm w-full shadow-2xl space-y-4 font-sans">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center text-xl">
              🗑️
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                Delete Regularization Request?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed font-medium">
                Are you sure you want to delete this pending regularization request? This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteModalOpen(false);
                  setDeletingReqId(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold border-0 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold border-0 shadow-md cursor-pointer disabled:opacity-50 transition-colors"
              >
                {isDeleting ? 'Deleting...' : 'Delete Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
