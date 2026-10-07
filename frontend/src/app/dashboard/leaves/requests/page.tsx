'use client';

import React, { useEffect, useState } from 'react';
import DashboardPageHeader from '../../components/DashboardPageHeader';
import { getHeaders } from '../../utils/api';
import SlideDrawer from '../../components/SlideDrawer';
import { useDashboard } from '../../components/DashboardContext';
import { usePermissions } from '../../hooks/usePermissions';
import CustomDatePicker from '../../components/CustomDatePicker';
import PageLoader from '@/components/ui/PageLoader';

export default function LeaveRequestsPage() {
  const { showToast, companyId } = useDashboard();
  const { hasPermission, isSuperAdmin: isSuperAdminPerm, getPermissionScope } = usePermissions();

  const isSuperAdmin = isSuperAdminPerm;

  // Permissions (Standard VCED: View, Create, Edit, Delete)
  const canView = isSuperAdmin || hasPermission('leave_requests_view') || hasPermission('leaves_requests_view') || hasPermission('leaves_view');
  const canCreate = isSuperAdmin || hasPermission('leave_requests_create') || hasPermission('leaves_requests_create') || hasPermission('leaves_create');
  const canEdit = isSuperAdmin || hasPermission('leave_requests_edit') || hasPermission('leaves_requests_edit') || hasPermission('leaves_edit');
  const canDelete = isSuperAdmin || hasPermission('leave_requests_delete') || hasPermission('leaves_requests_delete') || hasPermission('leaves_delete');
  const canApprove = canEdit;
  const canReject = canEdit;

  // Scopes
  const viewScopePerm = getPermissionScope('leaves_requests_view') || getPermissionScope('view_leave_requests') || (isSuperAdmin ? 'ALL' : 'SELF');
  const editScopePerm = getPermissionScope('leaves_requests_edit') || getPermissionScope('edit_leave_requests') || (isSuperAdmin ? 'ALL' : 'SELF');
  const deleteScopePerm = getPermissionScope('leaves_requests_delete') || getPermissionScope('delete_leave_requests') || (isSuperAdmin ? 'ALL' : 'SELF');

  const canSeeExtendedTab = isSuperAdmin || ['TEAM', 'REPORTING', 'DEPARTMENT', 'ALL'].includes(viewScopePerm);
  const canEditExtended = isSuperAdmin || ['TEAM', 'REPORTING', 'DEPARTMENT', 'ALL'].includes(editScopePerm) || canEdit;
  const canDeleteExtended = isSuperAdmin || ['TEAM', 'REPORTING', 'DEPARTMENT', 'ALL'].includes(deleteScopePerm) || canDelete;
  const canApproveExtended = canEditExtended;
  const canRejectExtended = canEditExtended;

  const getSecondTabLabel = () => {
    if (isSuperAdmin || viewScopePerm === 'ALL') {
      return 'All Employee Leave Requests';
    }
    if (viewScopePerm === 'DEPARTMENT') {
      return 'Department Leave Requests';
    }
    return 'Team Leave Requests';
  };

  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);

  const [viewScope, setViewScope] = useState<'my' | 'team'>('my');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [weekoffPolicy, setWeekoffPolicy] = useState<any>(null);

  const [applyDrawerOpen, setApplyDrawerOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<any | null>(null);

  const [actionModal, setActionModal] = useState<{ open: boolean; req: any | null; type: 'APPROVE' | 'REJECT' }>({
    open: false,
    req: null,
    type: 'APPROVE'
  });
  const [managerRemarks, setManagerRemarks] = useState('');

  const [applyForm, setApplyForm] = useState({
    leave_type_id: '',
    from_date: '',
    to_date: '',
    total_days: '0',
    reason: ''
  });

  const me = employees.find(emp => emp.email?.toLowerCase() === email.toLowerCase());

  useEffect(() => {
    const storedRoles = localStorage.getItem('roles');
    const storedEmail = localStorage.getItem('email');
    let parsedRoles: string[] = [];
    if (storedRoles) {
      try {
        parsedRoles = JSON.parse(storedRoles);
        setRoles(parsedRoles);
      } catch (e) { }
    }
    if (storedEmail) setEmail(storedEmail);
  }, []);

  useEffect(() => {
    if (canView) {
      Promise.all([
        fetchEmployees(),
        fetchLeaveTypes(),
        fetchHolidays(),
        fetchWeekoffs(),
        fetchBalances(),
        fetchMyRequests()
      ]);
    }
  }, [companyId, canView]);

  useEffect(() => {
    if (canView) {
      fetchLeaveRequests(viewScope);
    }
  }, [viewScope, companyId, canView]);

  const fetchBalances = async () => {
    const cid = companyId || 'all';
    const yr = new Date().getFullYear();
    try {
      const res = await fetch(`/api/v1/leave-balances?companyId=${cid}&year=${yr}`, { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) setBalances(data.balances || []);
    } catch (e) { }
  };

  const fetchMyRequests = async () => {
    const cid = companyId || 'all';
    try {
      const res = await fetch(`/api/v1/leave-requests?companyId=${cid}&scope=my`, { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) setMyRequests(data.requests || []);
    } catch (e) { }
  };

  const fetchEmployees = async () => {
    const cid = companyId || 'all';
    try {
      const res = await fetch(`/api/v1/employees?companyId=${cid}&pageSize=500`, { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) setEmployees(data.employees || []);
    } catch (e) {
      console.error('Error fetching employees:', e);
    }
  };

  const fetchLeaveTypes = async () => {
    const cid = companyId || 'all';
    try {
      const res = await fetch(`/api/v1/leave-types?companyId=${cid}`, { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) setLeaveTypes(data.leaveTypes || []);
    } catch (e) {
      console.error('Error fetching leave types:', e);
    }
  };

  const fetchHolidays = async () => {
    const cid = companyId || 'all';
    try {
      const res = await fetch(`/api/v1/holidays?companyId=${cid}`, { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) setHolidays(data.holidays || []);
    } catch (e) { }
  };

  const fetchWeekoffs = async () => {
    const cid = companyId || 'all';
    try {
      const res = await fetch(`/api/v1/weekoffs?companyId=${cid}`, { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) setWeekoffPolicy(data.policy || null);
    } catch (e) { }
  };

  const fetchLeaveRequests = async (scope: 'my' | 'team') => {
    setIsLoading(true);
    const cid = companyId || 'all';
    try {
      const res = await fetch(`/api/v1/leave-requests?companyId=${cid}&scope=${scope}`, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        setRequests(data.requests || []);
        if (scope === 'my') setMyRequests(data.requests || []);
      }
    } catch (e) {
      showToast('Error loading leave requests', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Smart calculate duration
  useEffect(() => {
    if (applyForm.from_date && applyForm.to_date) {
      const start = new Date(applyForm.from_date);
      const end = new Date(applyForm.to_date);
      if (end >= start) {
        let count = 0;
        const cur = new Date(start);
        const holidayDates = new Set(holidays.map(h => h.holiday_date?.split('T')[0]));
        const offDays: number[] = [];
        if (weekoffPolicy) {
          if (weekoffPolicy.sunday_off) offDays.push(0);
          if (weekoffPolicy.saturday_off) offDays.push(6);
        }

        while (cur <= end) {
          const dateStr = cur.toISOString().split('T')[0];
          const day = cur.getDay();
          const isHoliday = holidayDates.has(dateStr);
          const isWeekoff = offDays.includes(day);

          if (!isHoliday && !isWeekoff) {
            count++;
          }
          cur.setDate(cur.getDate() + 1);
        }
        setApplyForm(prev => ({ ...prev, total_days: String(count > 0 ? count : 1) }));
      } else {
        setApplyForm(prev => ({ ...prev, total_days: '0' }));
      }
    } else {
      setApplyForm(prev => ({ ...prev, total_days: '0' }));
    }
  }, [applyForm.from_date, applyForm.to_date, holidays, weekoffPolicy]);

  const handleOpenApplyDrawer = () => {
    setEditingRequest(null);
    setApplyForm({
      leave_type_id: '',
      from_date: '',
      to_date: '',
      total_days: '0',
      reason: ''
    });
    setApplyDrawerOpen(true);
  };

  const handleOpenEditDrawer = (req: any) => {
    setEditingRequest(req);
    setApplyForm({
      leave_type_id: String(req.leave_type_id || ''),
      from_date: req.from_date?.split('T')[0] || new Date().toISOString().split('T')[0],
      to_date: req.to_date?.split('T')[0] || new Date().toISOString().split('T')[0],
      total_days: String(req.total_days || '1'),
      reason: req.reason || ''
    });
    setApplyDrawerOpen(true);
  };

  const handleApplyOrEditLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyForm.leave_type_id) {
      showToast('Please select a leave category.', 'error');
      return;
    }
    if (!applyForm.from_date) {
      showToast('Please select From Date.', 'error');
      return;
    }
    if (!applyForm.to_date) {
      showToast('Please select To Date.', 'error');
      return;
    }
    if (applyForm.to_date < applyForm.from_date) {
      showToast('To Date cannot be earlier than From Date.', 'error');
      return;
    }
    const currentBal = getLeaveTypeBalance(applyForm.leave_type_id);
    const existingDaysHeld = editingRequest && String(editingRequest.leave_type_id) === String(applyForm.leave_type_id)
      ? Number(editingRequest.total_days || 0)
      : 0;
    const effectiveRemaining = currentBal.remaining + existingDaysHeld;

    if (effectiveRemaining <= 0) {
      showToast('Insufficient leave balance. You have 0 available days for this category.', 'error');
      return;
    }
    if (Number(applyForm.total_days) > effectiveRemaining) {
      showToast(`Insufficient leave balance. You have ${effectiveRemaining} day(s) available, but requested ${applyForm.total_days} day(s).`, 'error');
      return;
    }
    const trimmedReason = applyForm.reason ? applyForm.reason.trim() : '';
    if (!trimmedReason) {
      showToast('Please provide a reason for the leave request.', 'error');
      return;
    }
    if (trimmedReason.length < 5) {
      showToast('Reason must be at least 5 characters.', 'error');
      return;
    }
    if (trimmedReason.length > 100) {
      showToast('Reason must not exceed 100 characters.', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const url = editingRequest ? `/api/v1/leave-requests/${editingRequest.id}` : '/api/v1/leave-requests';
      const method = editingRequest ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify({ ...applyForm, reason: trimmedReason })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Leave request ${editingRequest ? 'updated' : 'submitted'} successfully`, 'success');
        setApplyDrawerOpen(false);
        setEditingRequest(null);
        fetchLeaveRequests(viewScope);
        fetchMyRequests();
        fetchBalances();
      } else {
        showToast(data.error || `Failed to ${editingRequest ? 'update' : 'submit'} leave request`, 'error');
      }
    } catch (err) {
      showToast('Connection error', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleProcessRequest = async () => {
    if (!actionModal.req) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/v1/leave-requests/${actionModal.req.id}/action`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          action: actionModal.type === 'APPROVE' ? 'APPROVED' : 'REJECTED',
          remarks: managerRemarks
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Leave request ${actionModal.type === 'APPROVE' ? 'Approved' : 'Rejected'} successfully`, 'success');
        setActionModal({ open: false, req: null, type: 'APPROVE' });
        setManagerRemarks('');
        fetchLeaveRequests(viewScope);
        fetchBalances();
      } else {
        showToast(data.error || 'Failed to update request', 'error');
      }
    } catch (e) {
      showToast('Server connection failure', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRequest = async (reqId: string) => {
    if (!confirm('Are you sure you want to cancel / delete this leave application?')) return;
    try {
      const res = await fetch(`/api/v1/leave-requests/${reqId}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (res.ok) {
        showToast('Leave application canceled successfully', 'success');
        fetchLeaveRequests(viewScope);
        fetchMyRequests();
        fetchBalances();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to cancel request', 'error');
      }
    } catch (e) {
      showToast('Connection error', 'error');
    }
  };

  const filteredRequests = requests.filter(req => {
    const matchesStatus = statusFilter === 'ALL' || req.status === statusFilter;
    const emp = employees.find(e => e.id === req.employee_id || e.emp_id_code === req.emp_id_code);
    const empName = req.employee_name || '';
    const empCode = req.emp_id_code || emp?.emp_id_code || '';
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = empName.toLowerCase().includes(searchLower) ||
      empCode.toLowerCase().includes(searchLower) ||
      req.leave_type_name?.toLowerCase().includes(searchLower) ||
      req.leave_type_code?.toLowerCase().includes(searchLower) ||
      req.reason?.toLowerCase().includes(searchLower);
    return matchesStatus && matchesSearch;
  });

  const pendingCount = requests.filter(r => r.status === 'PENDING').length;
  const approvedCount = requests.filter(r => r.status === 'APPROVED').length;
  const rejectedCount = requests.filter(r => r.status === 'REJECTED').length;

  // -------------------------------------------------------------
  // LEAVE DRAWER CALCULATION & DISABLED DATES HELPERS
  // -------------------------------------------------------------
  const myBalances = balances.filter(b =>
    (b.employee_email && b.employee_email.toLowerCase() === email.toLowerCase()) ||
    (me?.id && b.employee_id === me.id)
  );

  const getLeaveTypeBalance = (ltId: string) => {
    const lt = leaveTypes.find(t => String(t.id) === String(ltId));
    const balRecord = myBalances.find(b => String(b.leave_type_id) === String(ltId));

    const allotted = Number(
      balRecord?.allotted ?? balRecord?.allotted_days ?? balRecord?.granted_days ?? lt?.allotted_per_year ?? 0
    );
    const used = Number(balRecord?.used ?? balRecord?.used_days ?? 0);
    const rawRemaining = Number(balRecord?.remaining ?? balRecord?.remaining_days ?? (allotted - used));

    const annualAllotted = allotted > 0 ? allotted : (lt?.allotted_per_year ? Number(lt.allotted_per_year) : 12);
    const currentMonth = new Date().getMonth() + 1; // 1–12
    const currentYear = new Date().getFullYear();

    // Monthly carry forward check
    const isMonthlyCarryForward =
      lt?.monthly_carry_forward !== false &&
      lt?.carry_forward_type !== 'LAPSE' &&
      lt?.carry_forward_type !== 'NO_CARRY_FORWARD';

    // Monthly accrual rate
    const monthlyRate = Number(lt?.monthly_accrual) > 0 ? Number(lt.monthly_accrual) : (annualAllotted / 12);

    let available: number;

    if (isMonthlyCarryForward) {
      const accruedTillCurrentMonth = Math.round(monthlyRate * currentMonth * 10) / 10;
      available = Math.max(0, Math.min(rawRemaining, accruedTillCurrentMonth - used));
    } else {
      const currentMonthUsed = myRequests.filter(r => {
        if (String(r.leave_type_id) !== String(ltId)) return false;
        if (r.status === 'REJECTED') return false;
        if (!r.from_date) return false;
        const d = new Date(r.from_date);
        return d.getFullYear() === currentYear && (d.getMonth() + 1) === currentMonth;
      }).reduce((sum, r) => sum + (Number(r.total_days) || 0), 0);

      const monthlyQuota = Math.round(monthlyRate * 10) / 10;
      available = Math.max(0, Math.min(rawRemaining, monthlyQuota - currentMonthUsed));
    }

    return {
      remaining: Math.max(0, available),
      used,
      allotted: annualAllotted,
      isMonthlyCarryForward,
      monthlyRate: Math.round(monthlyRate * 10) / 10,
      currentMonthAccrued: Math.round(monthlyRate * currentMonth * 10) / 10
    };
  };

  // Build disabled dates array & reason map for CustomDatePicker
  const disabledDates: string[] = [];
  const disabledReasonMap: Record<string, string> = {};

  // 1. Holidays
  holidays.forEach(h => {
    if (h.holiday_date) {
      const dStr = h.holiday_date.split('T')[0];
      if (!disabledDates.includes(dStr)) {
        disabledDates.push(dStr);
        disabledReasonMap[dStr] = `Holiday: ${h.name || 'Company Holiday'}`;
      }
    }
  });

  // 2. Already Applied Dates (Pending & Approved only; Ignore current editing request)
  myRequests.forEach(req => {
    if (editingRequest && String(req.id) === String(editingRequest.id)) {
      return;
    }
    if (req.status === 'PENDING' || req.status === 'APPROVED') {
      if (req.from_date && req.to_date) {
        let cur = new Date(req.from_date);
        const end = new Date(req.to_date);
        while (cur <= end) {
          const dStr = cur.toISOString().split('T')[0];
          if (!disabledDates.includes(dStr)) {
            disabledDates.push(dStr);
            disabledReasonMap[dStr] = `Already Applied (${req.status === 'APPROVED' ? 'Approved Leave' : 'Pending Request'})`;
          }
          cur.setDate(cur.getDate() + 1);
        }
      }
    }
  });

  // 3. Weekoff check function
  const isDateDisabledFn = (date: Date, dateStr: string) => {
    const day = date.getDay();
    if (weekoffPolicy) {
      if (weekoffPolicy.sunday_off && day === 0) {
        disabledReasonMap[dateStr] = 'Sunday Week Off';
        return true;
      }
      if (weekoffPolicy.saturday_off && day === 6) {
        disabledReasonMap[dateStr] = 'Saturday Week Off';
        return true;
      }
    }
    return false;
  };

  if (!canView) {
    return (
      <div className="space-y-6 pb-12">
        <DashboardPageHeader
          title="Leave Requests & Approvals"
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
            You do not have permission to view leave requests. Please contact your system administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <DashboardPageHeader
        title="Leave Requests & Approvals"
        companyId={companyId}
        isSuperAdmin={isSuperAdmin}
        email={email}
        hideCompanySelect={true}
        hideUserBadge={true}
      >
        {canCreate && (
          <button
            onClick={handleOpenApplyDrawer}
            className="px-4 py-2 bg-[#07518a] hover:bg-[#053d69] text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            <span>Apply For Leave</span>
          </button>
        )}
      </DashboardPageHeader>

      {/* 📊 SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Total Applications</span>
            <span className="text-2xl font-black text-[#07518a] dark:text-[#38bdf8] font-mono mt-1 block">{requests.length}</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#07518a]/10 text-[#07518a] dark:text-[#38bdf8] border border-[#07518a]/20 flex items-center justify-center font-bold text-xl">
            📝
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">Pending Queue</span>
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono mt-1 block">{pendingCount}</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900 flex items-center justify-center font-bold text-xl">
            ⏳
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">Approved</span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1 block">{approvedCount}</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900 flex items-center justify-center font-bold text-xl">
            ✅
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-extrabold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">Rejected</span>
            <span className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono mt-1 block">{rejectedCount}</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900 flex items-center justify-center font-bold text-xl">
            ❌
          </div>
        </div>
      </div>

      {/* 🎛️ CONTROLS & FILTER BAR */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">

        {/* SCOPE SWITCHER / BADGE */}
        {canSeeExtendedTab ? (
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setViewScope('my')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${viewScope === 'my'
                  ? 'bg-white dark:bg-slate-900 text-[#07518a] dark:text-[#38bdf8] shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
            >
              👤 My Requests
            </button>
            <button
              onClick={() => setViewScope('team')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${viewScope === 'team'
                  ? 'bg-white dark:bg-slate-900 text-[#07518a] dark:text-[#38bdf8] shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
            >
              👥 {getSecondTabLabel()}
            </button>
          </div>
        ) : (
          <div className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 shrink-0">
            <span>👤</span> My Requests
          </div>
        )}

        {/* SEARCH FIRST, THEN STATUS TABS */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          {/* 🔍 SEARCH FIELD FIRST */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Search employee, ID, leave..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#07518a] font-medium"
            />
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* STATUS PILLS AFTER SEARCH */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
            {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${statusFilter === st
                    ? 'bg-white dark:bg-slate-900 text-[#07518a] dark:text-[#38bdf8] shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* 📜 LEAVE REQUESTS TABLE */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {isLoading ? (
          <PageLoader message="Loading Leave Requests..." className="py-16" />
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center">
            <span className="text-4xl block mb-2">🏖️</span>
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">No Leave Applications Found</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              There are no leave requests matching your current filters. {canCreate ? 'Click "Apply For Leave" to submit a new request.' : ''}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="p-4">Employee</th>
                  <th className="p-4">Leave Type</th>
                  <th className="p-4">From Date</th>
                  <th className="p-4">To Date</th>
                  <th className="p-4">Duration</th>
                  <th className="p-4">Reason</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {filteredRequests.map((req) => {
                  const emp = employees.find(e => e.id === req.employee_id || e.emp_id_code === req.emp_id_code);
                  const empCode = req.emp_id_code || emp?.emp_id_code || '';
                  const fullReason = req.reason || 'No details provided';
                  const truncatedReason = fullReason.length > 25 ? `${fullReason.slice(0, 25)}...` : fullReason;

                  return (
                    <tr key={req.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 font-bold flex items-center justify-center text-xs">
                            {req.employee_name?.slice(0, 2).toUpperCase() || 'EMP'}
                          </div>
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-100 block">{req.employee_name || 'Staff Member'}</span>
                            {empCode && (
                              <span className="text-[10px] font-semibold text-slate-400 block font-mono">{empCode}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="p-4 font-semibold text-slate-700 dark:text-slate-200">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[11px]">
                          {req.leave_type_name || 'General Leave'}
                        </span>
                      </td>

                      <td className="p-4 text-slate-700 dark:text-slate-200 font-semibold text-xs whitespace-nowrap">
                        {req.from_date?.split('T')[0]}
                      </td>

                      <td className="p-4 text-slate-700 dark:text-slate-200 font-semibold text-xs whitespace-nowrap">
                        {req.to_date?.split('T')[0]}
                      </td>

                      <td className="p-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-extrabold text-[11px] border border-indigo-100 dark:border-indigo-900">
                          {parseFloat(String(req.total_days || 0)).toFixed(1)} Day(s)
                        </span>
                      </td>

                      <td className="p-4 text-slate-500 dark:text-slate-400">
                        <div className="relative group/reason inline-block max-w-[220px]">
                          <span className="truncate block font-medium text-slate-700 dark:text-slate-300 cursor-help hover:text-[#07518a] dark:hover:text-sky-400 transition-colors">
                            {truncatedReason}
                          </span>
                          {fullReason && fullReason !== 'No details provided' && (
                            <div className="pointer-events-none absolute bottom-full left-0 mb-2 hidden group-hover/reason:flex flex-col z-50 min-w-[200px] max-w-[320px] p-2.5 bg-slate-900/95 dark:bg-slate-950/95 text-white text-[11px] rounded-xl shadow-2xl border border-slate-700/60 backdrop-blur-md transition-all whitespace-normal">
                              <span className="font-bold text-[10px] text-slate-400 uppercase tracking-wider mb-1">Reason for leave</span>
                              <span className="leading-relaxed font-normal text-slate-100">{fullReason}</span>
                              <div className="absolute top-full left-4 -mt-1 border-4 border-transparent border-t-slate-900 dark:border-t-slate-950" />
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${req.status === 'APPROVED'
                            ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 border border-emerald-300'
                            : req.status === 'REJECTED'
                              ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-600 border border-rose-300'
                              : 'bg-amber-100 dark:bg-amber-950/80 text-amber-600 border border-amber-300 animate-pulse'
                          }`}>
                          {req.status}
                        </span>
                      </td>

                      <td className="p-4 text-right">
                        {/* EXTENDED (TEAM/ALL) VIEW ACTIONS */}
                        {viewScope === 'team' ? (
                          req.status === 'PENDING' ? (
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {/* 1. EDIT */}
                              {canEditExtended && (
                                <button
                                  onClick={() => handleOpenEditDrawer(req)}
                                  className="px-2.5 py-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 text-[11px] font-bold rounded-lg hover:bg-blue-100 transition-all cursor-pointer"
                                  title="Edit Leave Request"
                                >
                                  <span>Edit</span>
                                </button>
                              )}
                              {/* 2. DELETE */}
                              {canDeleteExtended && (
                                <button
                                  onClick={() => handleDeleteRequest(req.id)}
                                  className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950 dark:hover:bg-rose-900 border border-rose-200 dark:border-rose-800 text-[11px] font-bold rounded-lg transition-all cursor-pointer"
                                  title="Delete Leave Request"
                                >
                                  <span>Delete</span>
                                </button>
                              )}
                              {/* 3. APPROVE */}
                              {canApproveExtended && (
                                <button
                                  onClick={() => setActionModal({ open: true, req, type: 'APPROVE' })}
                                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-1"
                                  title="Approve Leave"
                                >
                                  <span>Approve</span>
                                </button>
                              )}
                              {/* 4. REJECT */}
                              {canRejectExtended && (
                                <button
                                  onClick={() => setActionModal({ open: true, req, type: 'REJECT' })}
                                  className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-1"
                                  title="Reject Leave"
                                >
                                  <span>Reject</span>
                                </button>
                              )}
                              {!canEditExtended && !canDeleteExtended && !canApproveExtended && !canRejectExtended && (
                                <span className="text-[11px] text-slate-400 italic">No action permission</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">-</span>
                          )
                        ) : (
                          /* BASE (MY REQUESTS) VIEW ACTIONS */
                          req.status === 'PENDING' ? (
                            <div className="flex items-center justify-end gap-1.5">
                              {/* 1. EDIT */}
                              {canEdit && (
                                <button
                                  onClick={() => handleOpenEditDrawer(req)}
                                  className="px-2.5 py-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 text-[11px] font-bold rounded-lg hover:bg-blue-100 transition-all cursor-pointer flex items-center gap-1"
                                  title="Edit My Pending Request"
                                >
                                  <span>Edit</span>
                                </button>
                              )}
                              {/* 2. DELETE */}
                              {canDelete && (
                                <button
                                  onClick={() => handleDeleteRequest(req.id)}
                                  className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950 dark:hover:bg-rose-900 border border-rose-200 dark:border-rose-800 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1"
                                  title="Cancel / Delete My Request"
                                >
                                  <span>Delete</span>
                                </button>
                              )}
                              {!canEdit && !canDelete && (
                                <span className="text-[11px] text-slate-400 italic">Pending approval</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">-</span>
                          )
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 🚪 APPLY / EDIT LEAVE DRAWER */}
      <SlideDrawer
        isOpen={applyDrawerOpen}
        onClose={() => {
          setApplyDrawerOpen(false);
          setEditingRequest(null);
        }}
        title={editingRequest ? "Edit Leave Request" : "Apply For Leave"}
      >
        <form noValidate onSubmit={handleApplyOrEditLeave} className="space-y-4 p-4">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Select Leave Type *
            </label>
            <select
              value={applyForm.leave_type_id}
              onChange={e => setApplyForm(prev => ({ ...prev, leave_type_id: e.target.value }))}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="">-- Choose Leave Category --</option>
              {leaveTypes.map(lt => (
                <option key={lt.id} value={lt.id}>
                  {lt.name} ({lt.code})
                </option>
              ))}
            </select>

            {applyForm.leave_type_id && (() => {
              const bal = getLeaveTypeBalance(applyForm.leave_type_id);
              const existingHeld = editingRequest && String(editingRequest.leave_type_id) === String(applyForm.leave_type_id) ? Number(editingRequest.total_days || 0) : 0;
              const effBal = bal.remaining + existingHeld;
              const selectedLt = leaveTypes.find(t => String(t.id) === String(applyForm.leave_type_id));
              const isInsufficient = effBal <= 0;
              const currentMonth = new Date().getMonth() + 1;
              return (
                <div className={`mt-2.5 p-3 rounded-xl border ${
                  isInsufficient
                    ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900'
                    : 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-100 dark:border-indigo-900'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{isInsufficient ? '⚠️' : '📊'}</span>
                      <div>
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 block">
                          {selectedLt?.name} Balance
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          Annual Allotted: {bal.allotted} | Total Used: {bal.used}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] font-extrabold uppercase block ${isInsufficient ? 'text-rose-500' : 'text-indigo-500'}`}>
                        {isInsufficient ? 'No Balance' : 'Available Now'}
                      </span>
                      <span className={`text-sm font-black font-mono ${isInsufficient ? 'text-rose-600 dark:text-rose-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
                        {effBal} Day(s)
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-1.5 font-semibold">
                    {bal.isMonthlyCarryForward
                      ? `🗓 Accrued till Month ${currentMonth}: ${bal.currentMonthAccrued} days | Used: ${bal.used} | Available: ${effBal} day(s)`
                      : `⏱ Monthly quota: ${bal.monthlyRate} day(s)/month (No carry-forward)`}
                  </p>
                </div>
              );
            })()}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">From Date *</label>
              <CustomDatePicker
                value={applyForm.from_date}
                onChange={val => {
                  setApplyForm(prev => {
                    const newToDate = prev.to_date < val ? val : prev.to_date;
                    return { ...prev, from_date: val, to_date: newToDate };
                  });
                }}
                disabledDates={disabledDates}
                disabledReasonMap={disabledReasonMap}
                isDateDisabledFn={isDateDisabledFn}
                placeholder="From Date"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">To Date *</label>
              <CustomDatePicker
                value={applyForm.to_date}
                onChange={val => setApplyForm(prev => ({ ...prev, to_date: val }))}
                minDate={applyForm.from_date}
                disabledDates={disabledDates}
                disabledReasonMap={disabledReasonMap}
                isDateDisabledFn={isDateDisabledFn}
                placeholder="To Date"
                align="right"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Total Calculated Working Days
            </label>
            <input
              type="text"
              value={`${applyForm.total_days} Day(s)`}
              readOnly
              className="w-full px-3.5 py-2.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 font-bold text-indigo-600 dark:text-indigo-400 rounded-xl text-xs read-only:cursor-not-allowed"
            />
            <span className="text-[10px] text-slate-400 mt-0.5 block">Calculates automatically excluding holidays & weekend policies</span>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Reason / Remarks *
              </label>
              <span className={`text-[10px] font-bold ${applyForm.reason.length < 5 || applyForm.reason.length > 100 ? 'text-amber-500' : 'text-slate-400'}`}>
                {applyForm.reason.length}/100 (min 5)
              </span>
            </div>
            <textarea
              rows={3}
              placeholder="State the reason for leave request..."
              value={applyForm.reason}
              onChange={e => setApplyForm(prev => ({ ...prev, reason: e.target.value }))}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none"
              minLength={5}
              maxLength={100}
              required
            />
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 bg-[#07518a] hover:bg-[#053d69] text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  {editingRequest ? 'Updating...' : 'Submitting...'}
                </>
              ) : (editingRequest ? 'Update Request' : 'Submit')}
            </button>
            <button
              type="button"
              onClick={() => {
                setApplyDrawerOpen(false);
                setEditingRequest(null);
              }}
              className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </SlideDrawer>

      {/* 💬 ACTION APPROVAL / REJECTION MODAL */}
      {actionModal.open && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h4 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <span>{actionModal.type === 'APPROVE' ? '✅' : '❌'}</span>
              {actionModal.type === 'APPROVE' ? 'Approve Leave Request' : 'Reject Leave Request'}
            </h4>

            <p className="text-xs text-slate-500">
              You are about to {actionModal.type === 'APPROVE' ? 'approve' : 'reject'} leave for{' '}
              <strong className="text-slate-800 dark:text-slate-200">{actionModal.req?.employee_name}</strong> ({actionModal.req?.total_days} days).
            </p>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Manager Remarks (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="Add comments or approval note..."
                value={managerRemarks}
                onChange={e => setManagerRemarks(e.target.value)}
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleProcessRequest}
                disabled={isSaving}
                className={`flex-1 py-2.5 text-white font-bold text-xs rounded-xl shadow-lg cursor-pointer flex items-center justify-center gap-2 ${
                  actionModal.type === 'APPROVE' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'
                }`}
              >
                {isSaving ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Processing...</span>
                  </>
                ) : (
                  `Confirm ${actionModal.type === 'APPROVE' ? 'Approval' : 'Rejection'}`
                )}
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
    </div>
  );
}
