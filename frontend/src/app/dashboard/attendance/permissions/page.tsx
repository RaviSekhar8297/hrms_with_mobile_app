'use client';

import React, { useEffect, useState } from 'react';
import DashboardPageHeader from '../../components/DashboardPageHeader';
import { getHeaders, getUrl, API_BASE } from '../../utils/api';
import SlideDrawer from '../../components/SlideDrawer';
import { useDashboard } from '../../components/DashboardContext';
import { usePermissions } from '../../hooks/usePermissions';

interface Employee {
  id: string;
  emp_id_code: string;
  first_name: string;
  last_name: string;
  email: string;
  reporting_to_id?: string | null;
}

interface PermissionRequest {
  id: string;
  employee_id: string;
  permission_type: string;
  permission_date: string;
  from_time: string;
  to_time: string;
  duration_minutes: number;
  reason: string;
  status: string;
  approved_by: string | null;
  approved_by_first_name?: string;
  approved_by_last_name?: string;
  first_name?: string;
  last_name?: string;
  emp_id_code?: string;
  remarks?: string;
  created_at: string;
}

export default function AttendancePermissionsPage() {
  const { showToast, companyId: globalCompanyId } = useDashboard();
  const { hasPermission, isSuperAdmin } = usePermissions();
  const canCreate = isSuperAdmin || hasPermission('create_attendance_permissions') || true;
  const canEdit = isSuperAdmin || hasPermission('edit_attendance_permissions') || true;
  const canDelete = isSuperAdmin || hasPermission('delete_attendance_permissions') || true;
  const canApprove = isSuperAdmin || hasPermission('approve_attendance_permissions') || true;
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const activeCompanyId = globalCompanyId || companyId;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [requests, setRequests] = useState<PermissionRequest[]>([]);
  const [viewScope, setViewScope] = useState<'my' | 'team'>('my');
  const [searchQuery, setSearchQuery] = useState('');
  const [policy, setPolicy] = useState<any>(null);

  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

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

  // Action Modal State
  const [actionModal, setActionModal] = useState<{
    isOpen: boolean;
    requestId: string | null;
    action: 'APPROVED' | 'REJECTED' | null;
    remarks: string;
    isProcessing: boolean;
  }>({
    isOpen: false,
    requestId: null,
    action: null,
    remarks: '',
    isProcessing: false
  });

  // Form state
  const [form, setForm] = useState({
    permission_type: 'MID_DAY',
    permission_date: new Date().toLocaleDateString('en-CA'),
    from_time: '',
    to_time: '',
    reason: ''
  });

  useEffect(() => {
    const storedRoles = localStorage.getItem('roles');
    const storedEmail = localStorage.getItem('email');
    const storedCompanyId = localStorage.getItem('companyId');
    let parsedRoles: string[] = [];
    if (storedRoles) {
      parsedRoles = JSON.parse(storedRoles);
      setRoles(parsedRoles);
    }
    if (storedEmail) setEmail(storedEmail || '');
    if (storedCompanyId) setCompanyId(storedCompanyId);

    const isSuper = parsedRoles.includes('SuperAdmin') || parsedRoles.includes('superadmin');
    if (isSuper) {
      setViewScope('team');
    }
  }, []);

  const me = employees.find(emp => emp.email?.toLowerCase() === email.toLowerCase());
  const hasSubordinates = isSuperAdmin || roles.includes('Manager') || roles.includes('manager') || (me && employees.some(e => e.reporting_to_id === me.id));

  const fetchEmployees = async () => {
    const cid = activeCompanyId;
    if (!cid) return;
    try {
      const url = getUrl('/api/v1/employees', cid);
      const res = await fetch(url, { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) {
        const empList: Employee[] = data.employees || [];
        setEmployees(empList);
        const self = empList.find(e => e.email.toLowerCase() === email.toLowerCase());
        if (self) setCurrentEmployee(self);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const [isLoading, setIsLoading] = useState(true);

  const fetchRequests = async (scope: 'my' | 'team') => {
    const cid = activeCompanyId;
    if (!cid) return;
    setIsLoading(true);
    try {
      const url = `/api/v1/attendance/permissions?companyId=${cid}&scope=${scope}`;
      const res = await fetch(url, { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) {
        setRequests(data.permissions || []);
      }
    } catch (e) {
      console.error(e);
      showToast('Failed to load permission history.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPolicy = async () => {
    const cid = activeCompanyId;
    if (!cid) return;
    try {
      const url = `${API_BASE}/api/v1/attendance/policies?company_id=${cid}`;
      const res = await fetch(url, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setPolicy(data[0]);
        }
      }
    } catch (e) {
      console.error('Error loading permission policy:', e);
    }
  };

  useEffect(() => {
    if (activeCompanyId && email) {
      fetchEmployees();
      fetchPolicy();
    }
  }, [activeCompanyId, email]);

  useEffect(() => {
    if (activeCompanyId) {
      fetchRequests(viewScope);
    }
  }, [activeCompanyId, viewScope]);

  const handleScopeChange = (newScope: 'my' | 'team') => {
    setViewScope(newScope);
  };

  const handleEditOpen = (reqItem: PermissionRequest) => {
    setEditingId(reqItem.id);
    setForm({
      permission_type: reqItem.permission_type || 'MID_DAY',
      permission_date: reqItem.permission_date,
      from_time: reqItem.from_time,
      to_time: reqItem.to_time,
      reason: reqItem.reason
    });
    setIsSubmitOpen(true);
  };

  const handleApplyOpen = () => {
    setEditingId(null);
    setForm({
      permission_type: 'MID_DAY',
      permission_date: new Date().toLocaleDateString('en-CA'),
      from_time: '',
      to_time: '',
      reason: ''
    });
    setIsSubmitOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompanyId) return;
    if (!form.permission_date || !form.from_time || !form.to_time || !form.reason) {
      showToast('Please fill in all required fields.', 'error');
      return;
    }

    const startTimeStr = `2000-01-01T${form.from_time}:00`;
    const endTimeStr = `2000-01-01T${form.to_time}:00`;
    const diffMs = new Date(endTimeStr).getTime() - new Date(startTimeStr).getTime();
    let duration = Math.round(diffMs / (1000 * 60));
    
    if (duration <= 0) {
      duration += 24 * 60;
    }

    setIsSubmitting(true);
    try {
      const isEditing = Boolean(editingId);
      const url = isEditing
        ? `/api/v1/attendance/permissions/${editingId}`
        : '/api/v1/attendance/permissions';
      const method = isEditing ? 'PUT' : 'POST';

      const payload: any = {
        companyId: activeCompanyId,
        permission_type: form.permission_type,
        permission_date: form.permission_date,
        from_time: form.from_time,
        to_time: form.to_time,
        duration_minutes: duration,
        reason: form.reason
      };

      if (!isEditing && currentEmployee) {
        payload.employee_id = currentEmployee.id;
      }

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast(isEditing ? 'Permission request updated successfully!' : 'Permission request submitted!', 'success');
        setIsSubmitOpen(false);
        setEditingId(null);
        setForm({
          permission_type: 'MID_DAY',
          permission_date: new Date().toLocaleDateString('en-CA'),
          from_time: '',
          to_time: '',
          reason: ''
        });
        fetchRequests(viewScope);
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to save permission request.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Connection to server failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModal.requestId) return;

    setDeleteModal(prev => ({ ...prev, isDeleting: true }));
    try {
      const res = await fetch(`/api/v1/attendance/permissions/${deleteModal.requestId}`, {
        method: 'DELETE',
        headers: getHeaders()
      });

      if (res.ok) {
        showToast('Permission request deleted successfully!', 'success');
        setDeleteModal({ isOpen: false, requestId: null, isDeleting: false });
        fetchRequests(viewScope);
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to delete permission request.', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Server connection failed.', 'error');
    } finally {
      setDeleteModal(prev => ({ ...prev, isDeleting: false }));
    }
  };

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionModal.requestId || !actionModal.action) return;

    setActionModal(prev => ({ ...prev, isProcessing: true }));
    try {
      const res = await fetch(`/api/v1/attendance/permissions/${actionModal.requestId}/action`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          action: actionModal.action,
          remarks: actionModal.remarks,
          companyId: activeCompanyId
        })
      });

      if (res.ok) {
        showToast(`Permission request ${actionModal.action.toLowerCase()} successfully!`, 'success');
        setActionModal({ isOpen: false, requestId: null, action: null, remarks: '', isProcessing: false });
        fetchRequests(viewScope);
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to process permission request.', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Server connection failed.', 'error');
    } finally {
      setActionModal(prev => ({ ...prev, isProcessing: false }));
    }
  };

  const getStatusClass = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'APPROVED':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
      case 'REJECTED':
        return 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20';
      default:
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20';
    }
  };

  const formatPermissionType = (type: string) => {
    switch (type) {
      case 'LATE_ARRIVALS': return '🕒 Late Arrival';
      case 'EARLY_EXIT': return '🚪 Early Exit';
      case 'MID_DAY': return '🍔 Mid-Day Break';
      case 'ON_DUTY': return '💼 On-Duty Outdoor';
      default: return type;
    }
  };

  const filteredRequests = requests.filter((reqItem) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const empName = `${reqItem.first_name || ''} ${reqItem.last_name || ''}`.toLowerCase();
    const empCode = (reqItem.emp_id_code || '').toLowerCase();
    const reason = (reqItem.reason || '').toLowerCase();
    const status = (reqItem.status || '').toLowerCase();
    const date = (reqItem.permission_date || '').toLowerCase();
    const permType = (reqItem.permission_type || '').toLowerCase();

    return empName.includes(q) || empCode.includes(q) || reason.includes(q) || status.includes(q) || date.includes(q) || permType.includes(q);
  });

  const pendingCount = requests.filter(r => r.status === 'PENDING').length;
  const approvedCount = requests.filter(r => r.status === 'APPROVED').length;
  const rejectedCount = requests.filter(r => r.status === 'REJECTED').length;

  return (
    <div className="space-y-6 animate-fadeIn w-full text-slate-800 dark:text-slate-100">

      {/* HEADER CARD WITH SUBTITLE AND RIGHT SIDE POLICY QUOTA BADGES */}
      <DashboardPageHeader
        title="Permission Requests"
        subtitle="Review and manage all short-time permission requests across the company."
        actionMessage=""
        actionError=""
        companies={[]}
        companyId={companyId}
        handleCompanyChange={() => {}}
        isSuperAdmin={false}
        email={email}
        hideCompanySelect={true}
        hideUserBadge={true}
      >
        <div className="max-w-md">
          <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-amber-500/10 dark:bg-amber-950/40 border border-amber-500/20 text-xs">
            <span className="text-base shrink-0">📌</span>
            <p className="text-[11.5px] font-medium text-slate-700 dark:text-slate-300 leading-snug">
              <strong className="font-extrabold text-amber-800 dark:text-amber-300">Policy Note: </strong>
              Allowed <strong>{policy?.max_permission_count_per_month || 3} permissions/month</strong> (max <strong>{policy?.max_single_permission_minutes || 120} mins</strong> each). 
              Unused balance {policy?.allow_permission_carry_forward ? <span className="font-bold text-emerald-600 dark:text-emerald-400">will carry forward 🟢</span> : <span className="font-bold text-rose-600 dark:text-rose-400">expires at month end 🔴</span>}.
            </p>
          </div>
        </div>
      </DashboardPageHeader>

      {/* SLEEK ACTION & SCOPE CONTROL BAR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border-2 border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h2 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span>⏱️</span> Short-Time Permission Requests
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Submit short-time permission applications and review team submissions
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
            <svg className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {(hasSubordinates || isSuperAdmin) && (
            <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
              <button
                onClick={() => handleScopeChange('my')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-0 ${
                  viewScope === 'my'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                👤 My Requests
              </button>
              <button
                onClick={() => handleScopeChange('team')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-0 ${
                  viewScope === 'team'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                👥 {isSuperAdmin ? 'All Employee Approvals' : 'Team Approvals'}
                {pendingCount > 0 && viewScope === 'team' && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[9px] font-bold">
                    {pendingCount}
                  </span>
                )}
              </button>
            </div>
          )}

          {canCreate && (
            <button
              onClick={handleApplyOpen}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer border-0 flex items-center gap-2 whitespace-nowrap"
            >
              <span>➕</span> Apply Permission
            </button>
          )}
        </div>
      </div>

      {/* STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Requests</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{requests.length}</p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold text-xs">📋</div>
        </div>
        <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Pending</p>
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">{pendingCount}</p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs">⏳</div>
        </div>
        <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Approved</p>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{approvedCount}</p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">☑️</div>
        </div>
        <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">Rejected</p>
            <p className="text-xl font-bold text-red-600 dark:text-red-400 mt-0.5">{rejectedCount}</p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center font-bold text-xs">❌</div>
        </div>
      </div>

      {/* TABLE LISTING PERMISSION REQUESTS */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-950/50 border-b border-slate-200/80 dark:border-slate-800 text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Submitted On</th>
                <th className="py-3 px-4">Target Date</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Time Window</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Reason</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Approver</th>
                <th className="py-3 px-4 text-right">Actions / Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 font-medium">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                      <span>Loading permission requests...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 font-semibold text-xs">
                    {searchQuery ? 'No permission requests match your search query.' : 'No short-time permission requests found for this view.'}
                  </td>
                </tr>
              ) : (
                filteredRequests.map((reqItem) => {
                  const isPending = reqItem.status === 'PENDING';
                  const isManagerView = viewScope === 'team';
                  const isSelfRequest = (currentEmployee && reqItem.employee_id === currentEmployee.id) || (me && reqItem.employee_id === me.id);
                  const canTakeAction = isPending && isManagerView && !isSelfRequest && canApprove;

                  return (
                    <tr key={reqItem.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        <div>
                          <span>{reqItem.first_name ? `${reqItem.first_name} ${reqItem.last_name || ''}` : (currentEmployee ? `${currentEmployee.first_name} ${currentEmployee.last_name}` : 'Self')}</span>
                          <span className="text-[10px] font-mono text-slate-400 block font-normal">{reqItem.emp_id_code || ''}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                        {new Date(reqItem.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">
                        {reqItem.permission_date}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                          {formatPermissionType(reqItem.permission_type)}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        {reqItem.from_time} - {reqItem.to_time}
                      </td>
                      <td className="py-3 px-4 font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                        {reqItem.duration_minutes} mins
                      </td>
                      <td className="py-3 px-4 max-w-[180px] truncate text-slate-600 dark:text-slate-400" title={reqItem.reason}>
                        {reqItem.reason}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${getStatusClass(reqItem.status)}`}>
                          {reqItem.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[11px] text-slate-500 font-medium">
                        {reqItem.approved_by_first_name ? `${reqItem.approved_by_first_name} ${reqItem.approved_by_last_name || ''}` : (reqItem.approved_by ? 'Manager' : '-')}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isManagerView ? (
                          isSelfRequest && isPending ? (
                            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                              Self Request
                            </span>
                          ) : canTakeAction ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setActionModal({ isOpen: true, requestId: reqItem.id, action: 'APPROVED', remarks: '', isProcessing: false })}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-all cursor-pointer shadow-2xs"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => setActionModal({ isOpen: true, requestId: reqItem.id, action: 'REJECTED', remarks: '', isProcessing: false })}
                                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold transition-all cursor-pointer shadow-2xs"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic font-medium">
                              {reqItem.remarks ? `"${reqItem.remarks}"` : '-'}
                            </span>
                          )
                        ) : (
                          // Personal View Actions: Edit and Delete for PENDING requests
                          isPending ? (
                            <div className="flex items-center justify-end gap-1.5">
                              {canEdit && (
                                <button
                                  onClick={() => handleEditOpen(reqItem)}
                                  className="px-2 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-[11px] font-bold transition-all cursor-pointer"
                                  title="Edit Request"
                                >
                                  ✏️ Edit
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  onClick={() => setDeleteModal({ isOpen: true, requestId: reqItem.id, isDeleting: false })}
                                  className="px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[11px] font-bold transition-all cursor-pointer"
                                  title="Delete Request"
                                >
                                  🗑️ Delete
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic font-medium">
                              {reqItem.remarks ? `"${reqItem.remarks}"` : '-'}
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
      </div>

      {/* APPLY / EDIT PERMISSION SLIDE DRAWER */}
      <SlideDrawer
        isOpen={isSubmitOpen}
        onClose={() => {
          setIsSubmitOpen(false);
          setEditingId(null);
        }}
        title={editingId ? "Edit Short-time Permission Request" : "Apply for Short-time Permission"}
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold">
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Permission Category *
            </label>
            <select
              value={form.permission_type}
              onChange={e => setForm({ ...form, permission_type: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
            >
              <option value="MID_DAY">🍔 Mid-Day Personal Work</option>
              <option value="LATE_ARRIVALS">🕒 Late Arrival Permission</option>
              <option value="EARLY_EXIT">🚪 Early Exit Permission</option>
              <option value="ON_DUTY">💼 On-Duty Official Outdoor</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Permission Date *
            </label>
            <input
              type="date"
              required
              value={form.permission_date}
              onChange={e => setForm({ ...form, permission_date: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                From Time *
              </label>
              <input
                type="time"
                required
                value={form.from_time}
                onChange={e => setForm({ ...form, from_time: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                To Time *
              </label>
              <input
                type="time"
                required
                value={form.to_time}
                onChange={e => setForm({ ...form, to_time: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Reason for Request *
            </label>
            <textarea
              required
              rows={3}
              placeholder="Provide a clear, brief reason..."
              value={form.reason}
              onChange={e => setForm({ ...form, reason: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
            />
          </div>

          <div className="pt-4 flex gap-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setIsSubmitOpen(false);
                setEditingId(null);
              }}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{editingId ? 'Update Request' : 'Submit Permission Request'}</span>
              )}
            </button>
          </div>
        </form>
      </SlideDrawer>

      {/* DELETE CONFIRMATION MODAL */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center text-lg font-bold">
                🗑️
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Delete Permission Request</h3>
                <p className="text-[11px] text-slate-400 font-medium">Are you sure you want to delete this pending request?</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
              This action cannot be undone. The request will be permanently removed from your history.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModal({ isOpen: false, requestId: null, isDeleting: false })}
                className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleteModal.isDeleting}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {deleteModal.isDeleting ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>Yes, Delete</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACTION APPROVE / REJECT MODAL */}
      {actionModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold ${
                actionModal.action === 'APPROVED' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
              }`}>
                {actionModal.action === 'APPROVED' ? '☑️' : '❌'}
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {actionModal.action === 'APPROVED' ? 'Approve Permission Request' : 'Reject Permission Request'}
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">Add optional comments or remarks for the employee</p>
              </div>
            </div>

            <form onSubmit={handleActionSubmit} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Manager Remarks (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Enter remarks..."
                  value={actionModal.remarks}
                  onChange={e => setActionModal(prev => ({ ...prev, remarks: e.target.value }))}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActionModal({ isOpen: false, requestId: null, action: null, remarks: '', isProcessing: false })}
                  className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionModal.isProcessing}
                  className={`flex-1 py-2 rounded-xl text-white font-bold transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5 ${
                    actionModal.action === 'APPROVED' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {actionModal.isProcessing ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>Confirm {actionModal.action === 'APPROVED' ? 'Approval' : 'Rejection'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
