'use client';

import React, { useEffect, useState, useMemo } from 'react';
import DashboardPageHeader from '../../components/DashboardPageHeader';
import { getHeaders, API_BASE } from '../../utils/api';
import SlideDrawer from '../../components/SlideDrawer';
import { useDashboard } from '../../components/DashboardContext';
import { usePermissions } from '../../hooks/usePermissions';
import ModernPagination from '../../components/ModernPagination';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { AlertTriangle, Search, CheckCircle2, XCircle, Trash2, Edit2, Clock } from 'lucide-react';
import CustomDatePicker from '../../components/CustomDatePicker';
import SearchableSelect from '../../components/SearchableSelect';
import PageLoader from '@/components/ui/PageLoader';

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
  const { hasPermission, isSuperAdmin, getPermissionScope } = usePermissions();

  // 🛡️ Standardized tablename_action Permissions
  const canView = isSuperAdmin || hasPermission('permission_requests_view') || hasPermission('attendance_permissions_view') || hasPermission('view_permission_requests') || hasPermission('view_attendance_permissions');
  const canCreate = isSuperAdmin || hasPermission('permission_requests_create') || hasPermission('attendance_permissions_create') || hasPermission('create_permission_requests') || hasPermission('create_attendance_permissions');
  const canEdit = isSuperAdmin || hasPermission('permission_requests_edit') || hasPermission('attendance_permissions_edit') || hasPermission('edit_permission_requests') || hasPermission('edit_attendance_permissions');
  const canDelete = isSuperAdmin || hasPermission('permission_requests_delete') || hasPermission('attendance_permissions_delete') || hasPermission('delete_permission_requests') || hasPermission('delete_attendance_permissions');
  const canApprove = isSuperAdmin || hasPermission('permission_requests_edit') || hasPermission('attendance_permissions_edit') || hasPermission('approve_attendance_permissions') || hasPermission('approve_permission_requests');

  // 🌐 Data Scopes
  const viewScope_perm = getPermissionScope('permission_requests_view') || getPermissionScope('attendance_permissions_view') || getPermissionScope('view_permission_requests') || 'SELF';
  const editScope_perm = getPermissionScope('permission_requests_edit') || getPermissionScope('attendance_permissions_edit') || getPermissionScope('edit_permission_requests') || 'SELF';
  const deleteScope_perm = getPermissionScope('permission_requests_delete') || getPermissionScope('attendance_permissions_delete') || getPermissionScope('delete_permission_requests') || 'SELF';

  // Can see the extended All/Team Requests tab
  const canSeeTeamTab = isSuperAdmin || ['TEAM', 'REPORTING', 'DEPARTMENT', 'ALL'].includes(viewScope_perm);

  // Can edit other employees' requests in All/Team tab
  const canEditTeamRequests = isSuperAdmin || (canEdit && ['TEAM', 'REPORTING', 'DEPARTMENT', 'ALL'].includes(editScope_perm));

  // Can delete other employees' requests in All/Team tab
  const canDeleteTeamRequests = isSuperAdmin || (canDelete && ['TEAM', 'REPORTING', 'DEPARTMENT', 'ALL'].includes(deleteScope_perm));

  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const activeCompanyId = globalCompanyId || companyId;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [requests, setRequests] = useState<PermissionRequest[]>([]);
  const [viewScope, setViewScope] = useState<'my' | 'team'>('my');
  const [searchQuery, setSearchQuery] = useState('');
  const [policy, setPolicy] = useState<any>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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
    employee_id: '',
    permission_type: '',
    permission_date: '',
    from_time: '',
    to_time: '',
    reason: ''
  });

  useEffect(() => {
    const storedRoles = localStorage.getItem('roles');
    const storedEmail = localStorage.getItem('email');
    const storedCompanyId = localStorage.getItem('companyId');
    if (storedRoles) {
      try { setRoles(JSON.parse(storedRoles)); } catch (e) { setRoles([]); }
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

  const me = employees.find(emp => emp.email?.toLowerCase() === email.toLowerCase());

  const fetchEmployees = async () => {
    const cid = activeCompanyId;
    if (!cid) return;
    try {
      const url = cid && cid !== 'all' ? `${API_BASE}/api/v1/employees?company_id=${cid}&pageSize=500` : `${API_BASE}/api/v1/employees?pageSize=500`;
      const res = await fetch(url, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        const empList: Employee[] = Array.isArray(data) ? data : (data.employees || data.data || []);
        setEmployees(empList);
        const self = empList.find(e => e.email?.toLowerCase() === email.toLowerCase());
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
      let scopeParam = scope === 'my' ? 'my' : 'team';
      if (scope === 'team') {
        if (viewScope_perm === 'DEPARTMENT') scopeParam = 'department';
        else if (viewScope_perm === 'ALL' || isSuperAdmin) scopeParam = 'all';
        else scopeParam = 'team';
      }

      const url = cid && cid !== 'all'
        ? `${API_BASE}/api/v1/attendance/permissions?companyId=${cid}&scope=${scopeParam}`
        : `${API_BASE}/api/v1/attendance/permissions?scope=${scopeParam}`;
      const res = await fetch(url, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setRequests(data.permissions || []);
      } else {
        setRequests([]);
      }
    } catch (e) {
      console.error(e);
      setRequests([]);
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
    if (canView && activeCompanyId) {
      Promise.all([fetchEmployees(), fetchPolicy()]);
    }
  }, [activeCompanyId, email, canView]);

  useEffect(() => {
    if (canView && activeCompanyId) {
      fetchRequests(viewScope);
    }
  }, [activeCompanyId, viewScope, canView]);

  const handleScopeChange = (newScope: 'my' | 'team') => {
    setViewScope(newScope);
  };

  const handleCompanyChange = (newId: string) => {
    setCompanyId(newId);
    localStorage.setItem('selectedCompanyId', newId);
  };

  const handleEditOpen = (reqItem: PermissionRequest) => {
    setEditingId(reqItem.id);
    setForm({
      employee_id: reqItem.employee_id || currentEmployee?.id || me?.id || '',
      permission_type: reqItem.permission_type || 'MID_DAY',
      permission_date: reqItem.permission_date || new Date().toISOString().split('T')[0],
      from_time: reqItem.from_time || '14:00',
      to_time: reqItem.to_time || '16:00',
      reason: reqItem.reason || ''
    });
    setIsSubmitOpen(true);
  };

  const calculateToTime = (fromTime: string, durationMinutes: number) => {
    if (!fromTime) return '';
    const parts = fromTime.split(':');
    if (parts.length < 2) return '';
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (isNaN(hours) || isNaN(minutes)) return '';
    
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const newHours = Math.floor(totalMinutes / 60) % 24;
    const newMinutes = totalMinutes % 60;
    return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
  };

  const handleFromTimeChange = (newFromTime: string) => {
    const allowedMinutes = Number(policy?.max_single_permission_minutes) || 120;
    const autoToTime = calculateToTime(newFromTime, allowedMinutes);
    setForm(prev => ({
      ...prev,
      from_time: newFromTime,
      to_time: autoToTime || prev.to_time
    }));
  };

  const handleApplyOpen = () => {
    setEditingId(null);
    setForm({
      employee_id: '',
      permission_type: '',
      permission_date: '',
      from_time: '',
      to_time: '',
      reason: ''
    });
    setIsSubmitOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate && !editingId) {
      showToast('You do not have permission to submit permissions', 'error');
      return;
    }
    if (!activeCompanyId) {
      showToast('Please select a company.', 'error');
      return;
    }

    const targetEmployeeId = form.employee_id || currentEmployee?.id || me?.id || (typeof window !== 'undefined' ? localStorage.getItem('employeeId') : null);

    if (!form.permission_type) {
      showToast('Please select a permission type.', 'error');
      return;
    }
    if (!form.permission_date) {
      showToast('Please select a permission date.', 'error');
      return;
    }
    if (!form.from_time || !form.to_time) {
      showToast('Please set both From Time and To Time.', 'error');
      return;
    }
    const trimmedReason = form.reason ? form.reason.trim() : '';
    if (!trimmedReason || trimmedReason.length < 5) {
      showToast('Please provide a reason (minimum 5 characters).', 'error');
      return;
    }
    if (trimmedReason.length > 100) {
      showToast('Reason must not exceed 100 characters.', 'error');
      return;
    }

    // Client-side instant overlap check against active permissions
    const activeConflict = requests.find(r => 
      r.id !== editingId &&
      (r.status === 'PENDING' || r.status === 'APPROVED') &&
      r.permission_date === form.permission_date &&
      (form.from_time < r.to_time && form.to_time > r.from_time)
    );
    if (activeConflict) {
      showToast(`A permission request for date ${form.permission_date} and time slot (${activeConflict.from_time} - ${activeConflict.to_time}) is already ${activeConflict.status.toLowerCase()}.`, 'error');
      return;
    }

    // Calculate duration in minutes
    let durationMins = Number(policy?.max_single_permission_minutes) || 120;
    if (form.from_time && form.to_time) {
      const fParts = form.from_time.split(':').map(Number);
      const tParts = form.to_time.split(':').map(Number);
      if (!isNaN(fParts[0]) && !isNaN(tParts[0])) {
        let diff = (tParts[0] * 60 + (tParts[1] || 0)) - (fParts[0] * 60 + (fParts[1] || 0));
        if (diff <= 0) diff += 24 * 60;
        durationMins = diff;
      }
    }

    setIsSubmitting(true);
    try {
      const url = editingId 
        ? `${API_BASE}/api/v1/attendance/permissions/${editingId}`
        : `${API_BASE}/api/v1/attendance/permissions`;
      
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify({
          ...form,
          company_id: activeCompanyId,
          companyId: activeCompanyId,
          employee_id: targetEmployeeId,
          duration_minutes: durationMins,
        })
      });

      const data = await res.json();
      if (res.ok) {
        showToast(
          editingId ? 'Permission request updated successfully!' : 'Permission request submitted successfully!',
          'success'
        );
        setIsSubmitOpen(false);
        setEditingId(null);
        fetchRequests(viewScope);
      } else {
        showToast(data.error || 'Failed to save permission request.', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('An unexpected error occurred.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModal.requestId) return;
    setDeleteModal(prev => ({ ...prev, isDeleting: true }));

    try {
      const res = await fetch(`${API_BASE}/api/v1/attendance/permissions/${deleteModal.requestId}`, {
        method: 'DELETE',
        headers: getHeaders()
      });

      const data = await res.json();
      if (res.ok) {
        showToast('Permission request deleted successfully!', 'success');
        setDeleteModal({ isOpen: false, requestId: null, isDeleting: false });
        fetchRequests(viewScope);
      } else {
        showToast(data.error || 'Failed to delete request.', 'error');
        setDeleteModal(prev => ({ ...prev, isDeleting: false }));
      }
    } catch (e) {
      console.error(e);
      showToast('Network error while deleting.', 'error');
      setDeleteModal(prev => ({ ...prev, isDeleting: false }));
    }
  };

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionModal.requestId || !actionModal.action) return;

    setActionModal(prev => ({ ...prev, isProcessing: true }));

    try {
      const res = await fetch(`${API_BASE}/api/v1/attendance/permissions/${actionModal.requestId}/action`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          action: actionModal.action,
          remarks: actionModal.remarks
        })
      });

      const data = await res.json();
      if (res.ok) {
        showToast(
          `Permission request ${actionModal.action === 'APPROVED' ? 'approved' : 'rejected'} successfully!`,
          actionModal.action === 'APPROVED' ? 'success' : 'info'
        );
        setActionModal({ isOpen: false, requestId: null, action: null, remarks: '', isProcessing: false });
        fetchRequests(viewScope);
      } else {
        showToast(data.error || 'Failed to update request status.', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Network error while processing action.', 'error');
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
      default: return type || 'Permission';
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
    const date = (reqItem?.permission_date || '').toLowerCase();
    const permType = (reqItem?.permission_type || '').toLowerCase();

    return empName.includes(q) || empCode.includes(q) || reason.includes(q) || status.includes(q) || date.includes(q) || permType.includes(q);
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

  const employeeSelectOptions = useMemo(() => {
    return employees.map(emp => {
      const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim();
      const code = emp.emp_id_code ? ` [${emp.emp_id_code}]` : '';
      return {
        value: emp.id,
        label: `${fullName}${code}`
      };
    });
  }, [employees]);

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
            You do not have permission (<code className="text-rose-600 bg-rose-50 dark:bg-rose-950 px-1.5 py-0.5 rounded font-mono">attendance_permissions_view</code>) to view attendance permission requests. Please contact your administrator for access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn w-full text-slate-800 dark:text-slate-100 font-sans">
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
      >
        {/* POLICY QUOTA BADGE / NOTE INSIDE TOP CARD RIGHT SIDE */}
        <div className="px-3.5 py-2 rounded-xl bg-amber-500/10 dark:bg-amber-950/40 border border-amber-500/20 text-xs flex items-center gap-2 max-w-xl">
          <span className="text-sm shrink-0">📌</span>
          <p className="text-[11px] font-medium text-slate-700 dark:text-slate-300 leading-tight">
            <strong className="font-bold text-amber-800 dark:text-amber-300">Policy Note: </strong>
            Allowed <strong>{policy?.max_permission_count_per_month || 3} permissions/month</strong> (max <strong>{policy?.max_single_permission_minutes || 120} mins</strong> each). 
            Unused balance {policy?.allow_permission_carry_forward ? <span className="font-bold text-emerald-600 dark:text-emerald-400">will carry forward 🟢</span> : <span className="font-bold text-rose-600 dark:text-rose-400">expires at month end 🔴</span>}.
          </p>
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
              className="w-full pl-9 pr-8 py-1.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#07518a] transition-all shadow-2xs"
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

          {canSeeTeamTab && (
            <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
              <button
                onClick={() => handleScopeChange('my')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-0 ${
                  viewScope === 'my'
                    ? 'bg-[#07518a] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-[#07518a] dark:hover:text-[#38bdf8]'
                }`}
              >
                My Requests
              </button>
              <button
                onClick={() => handleScopeChange('team')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-0 ${
                  viewScope === 'team'
                    ? 'bg-[#07518a] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-[#07518a] dark:hover:text-[#38bdf8]'
                }`}
              >
                {viewScope_perm === 'ALL' || isSuperAdmin ? 'All Requests' : 'Team Requests'}
                {pendingCount > 0 && viewScope === 'team' && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-bold">
                    {pendingCount}
                  </span>
                )}
              </button>
            </div>
          )}

          {canCreate && (
            <button
              onClick={handleApplyOpen}
              className="px-4 py-2 rounded-xl bg-[#07518a] hover:bg-[#064270] text-white text-xs font-bold shadow-md shadow-[#07518a]/20 transition-all cursor-pointer border-0 flex items-center gap-2 whitespace-nowrap"
            >
              <span>+</span> Apply Permission
            </button>
          )}
        </div>
      </div>

      {/* STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Requests</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{safeRequests.length}</p>
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
        <div className="overflow-x-auto max-h-[580px] overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800/90 backdrop-blur-xs z-10 text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
              <tr>
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
                  <td colSpan={10} className="py-8 text-center">
                    <PageLoader message="Loading Permission Requests..." />
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 font-semibold text-xs">
                    {searchQuery ? 'No permission requests match your search query.' : 'No short-time permission requests found for this view.'}
                  </td>
                </tr>
              ) : (
                paginatedRequests.map((reqItem) => {
                  const isPending = reqItem?.status === 'PENDING';
                  const isManagerView = viewScope === 'team';
                  const isSelfRequest = (currentEmployee && reqItem?.employee_id === currentEmployee.id) || (me && reqItem?.employee_id === me.id);
                  const canTakeAction = isPending && isManagerView && !isSelfRequest && canApprove;

                  const createdDate = reqItem?.created_at ? new Date(reqItem.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '-';

                  return (
                    <tr key={reqItem.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        <div>
                          <span>{reqItem?.first_name ? `${reqItem.first_name} ${reqItem.last_name || ''}` : (currentEmployee ? `${currentEmployee.first_name} ${currentEmployee.last_name}` : 'Self')}</span>
                          <span className="text-[10px] font-mono text-slate-400 block font-normal">{reqItem?.emp_id_code || ''}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                        {createdDate}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200 font-mono">
                        {reqItem?.permission_date || '-'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                          {formatPermissionType(reqItem?.permission_type)}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        {reqItem?.from_time || '--:--'} - {reqItem?.to_time || '--:--'}
                      </td>
                      <td className="py-3 px-4 font-bold text-[#07518a] dark:text-[#38bdf8]">
                        {reqItem?.duration_minutes || 0} mins
                      </td>
                      <td className="py-3 px-4 max-w-[180px]">
                        <p className="text-slate-600 dark:text-slate-400 truncate" title={reqItem?.reason}>
                          {reqItem?.reason || '-'}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${getStatusClass(reqItem?.status)}`}>
                          {reqItem?.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[11px] text-slate-500 font-medium">
                        {reqItem?.approved_by_first_name ? `${reqItem.approved_by_first_name} ${reqItem.approved_by_last_name || ''}` : (reqItem?.approved_by ? 'Manager' : '-')}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isManagerView ? (
                          isSelfRequest && isPending ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                                Self Request
                              </span>
                              {canEdit && (
                                <button
                                  onClick={() => handleEditOpen(reqItem)}
                                  className="p-1.5 rounded-lg bg-[#07518a]/10 hover:bg-[#07518a] text-[#07518a] hover:text-white dark:text-[#38bdf8] transition-all cursor-pointer border-0"
                                  title="Edit Request"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  onClick={() => setDeleteModal({ isOpen: true, requestId: reqItem.id, isDeleting: false })}
                                  className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:hover:bg-rose-900 dark:text-rose-400 transition-all cursor-pointer border-0"
                                  title="Delete Request"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ) : isPending ? (
                            <div className="flex items-center justify-end gap-1.5">
                              {canTakeAction && (
                                <>
                                  <button
                                    onClick={() => setActionModal({ isOpen: true, requestId: reqItem.id, action: 'APPROVED', remarks: '', isProcessing: false })}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-all cursor-pointer shadow-2xs border-0 flex items-center gap-1"
                                    title="Approve permission request"
                                  >
                                    <CheckCircle2 className="w-3 h-3" /> Approve
                                  </button>

                                  <button
                                    onClick={() => setActionModal({ isOpen: true, requestId: reqItem.id, action: 'REJECTED', remarks: '', isProcessing: false })}
                                    className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold transition-all cursor-pointer shadow-2xs border-0 flex items-center gap-1"
                                    title="Reject permission request"
                                  >
                                    <XCircle className="w-3 h-3" /> Reject
                                  </button>
                                </>
                              )}

                              {canEditTeamRequests && (
                                <button
                                  onClick={() => handleEditOpen(reqItem)}
                                  className="p-1.5 rounded-lg bg-[#07518a]/10 hover:bg-[#07518a] text-[#07518a] hover:text-white dark:text-[#38bdf8] transition-all cursor-pointer border-0"
                                  title="Edit request details"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {canDeleteTeamRequests && (
                                <button
                                  onClick={() => setDeleteModal({ isOpen: true, requestId: reqItem.id, isDeleting: false })}
                                  className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:hover:bg-rose-900 dark:text-rose-400 transition-all cursor-pointer border-0"
                                  title="Delete permission request"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic font-medium">
                              {reqItem?.remarks ? `"${reqItem.remarks}"` : (reqItem?.status === 'APPROVED' ? 'Approved' : 'Rejected')}
                            </span>
                          )
                        ) : (
                          // Personal View Actions: Edit and Delete for PENDING requests
                          isPending ? (
                            <div className="flex items-center justify-end gap-1.5">
                              {canEdit && (
                                <button
                                  onClick={() => handleEditOpen(reqItem)}
                                  className="p-1.5 rounded-lg bg-[#07518a]/10 hover:bg-[#07518a] text-[#07518a] hover:text-white dark:text-[#38bdf8] transition-all cursor-pointer border-0"
                                  title="Edit your pending request"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  onClick={() => setDeleteModal({ isOpen: true, requestId: reqItem.id, isDeleting: false })}
                                  className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:hover:bg-rose-900 dark:text-rose-400 transition-all cursor-pointer border-0"
                                  title="Delete your pending request"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic font-medium">
                              {reqItem?.remarks ? `"${reqItem.remarks}"` : (reqItem?.status === 'APPROVED' ? 'Approved' : 'Rejected')}
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

      {/* APPLY / EDIT SLIDE DRAWER */}
      <SlideDrawer
        isOpen={isSubmitOpen}
        onClose={() => {
          setIsSubmitOpen(false);
          setEditingId(null);
        }}
        title={editingId ? 'Edit Permission Request' : 'Apply Short-Time Permission'}
      >
        <form onSubmit={handleSubmit} noValidate className="space-y-4 text-xs font-semibold p-1">
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Permission Type *
            </label>
            <select
              value={form.permission_type}
              onChange={e => setForm({ ...form, permission_type: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-[#07518a]"
            >
              <option value="">-- Select Permission Type --</option>
              <option value="MID_DAY">Mid-Day Break Permission</option>
              <option value="LATE_ARRIVALS">Late Arrival Permission</option>
              <option value="EARLY_EXIT">Early Exit Permission</option>
              <option value="ON_DUTY">On-Duty Outdoor Permission</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Permission Date *
            </label>
            <CustomDatePicker
              value={form.permission_date}
              onChange={(val) => setForm({ ...form, permission_date: val })}
              maxDate={new Date().toISOString().split('T')[0]}
              placeholder="Select permission date"
            />
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  From Time *
                </label>
                <input
                  type="time"
                  value={form.from_time}
                  onChange={e => handleFromTimeChange(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-[#07518a]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  To Time (Auto)
                </label>
                <input
                  type="time"
                  readOnly
                  disabled
                  tabIndex={-1}
                  value={form.to_time}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/90 dark:bg-slate-800/80 text-xs font-bold text-slate-500 dark:text-slate-400 outline-none cursor-not-allowed select-none pointer-events-none"
                />
              </div>
            </div>
            {form.from_time && (
              <p className="text-[10.5px] text-[#07518a] dark:text-[#38bdf8] font-bold mt-1.5 flex items-center gap-1">
                <span>⏱️</span>
                <span>To Time auto-calculated ({policy?.max_single_permission_minutes || 120} mins allowed)</span>
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block font-bold text-slate-700 dark:text-slate-300">
                Reason for Request *
              </label>
              <span className={`text-[10px] font-bold ${form.reason.length >= 100 ? 'text-rose-500' : 'text-slate-400'}`}>
                {form.reason.length}/100 (min 5)
              </span>
            </div>
            <textarea
              rows={3}
              placeholder="Provide a clear, brief reason (max 100 characters)..."
              value={form.reason}
              onChange={e => setForm({ ...form, reason: e.target.value.slice(0, 100) })}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-[#07518a]"
            />
          </div>

          <div className="pt-4 flex gap-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 rounded-xl bg-[#07518a] hover:bg-[#064270] text-white font-extrabold text-xs shadow-md shadow-[#07518a]/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 border-0"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Submit</span>
              )}
            </button>
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
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 border-0"
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
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-[#07518a]"
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
                  className={`flex-1 py-2 rounded-xl text-white font-bold transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5 border-0 ${
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
