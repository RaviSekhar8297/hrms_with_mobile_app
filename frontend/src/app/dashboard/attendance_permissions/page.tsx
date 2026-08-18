'use client';

import React, { useEffect, useState } from 'react';
import DashboardPageHeader from '../components/DashboardPageHeader';
import { getHeaders, getUrl } from '../utils/api';
import SlideDrawer from '../components/SlideDrawer';
import { useDashboard } from '../components/DashboardContext';

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
  const { showToast } = useDashboard();
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [requests, setRequests] = useState<PermissionRequest[]>([]);
  const [viewScope, setViewScope] = useState<'my' | 'team'>('my');

  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('superadmin');
  const me = employees.find(emp => emp.email?.toLowerCase() === email.toLowerCase());
  const hasSubordinates = isSuperAdmin || roles.includes('Manager') || roles.includes('manager') || (me && employees.some(e => e.reporting_to_id === me.id));

  const fetchEmployees = async () => {
    if (!companyId) return;
    try {
      const url = getUrl('/api/v1/employees', companyId);
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

  const fetchRequests = async (scope: 'my' | 'team') => {
    if (!companyId) return;
    try {
      const url = `/api/v1/attendance/permissions?companyId=${companyId}&scope=${scope}`;
      const res = await fetch(url, { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) {
        setRequests(data.permissions || []);
      }
    } catch (e) {
      console.error(e);
      showToast('Failed to load permission history.', 'error');
    }
  };

  useEffect(() => {
    if (companyId && email) {
      fetchEmployees();
    }
  }, [companyId, email]);

  useEffect(() => {
    if (companyId) {
      fetchRequests(viewScope);
    }
  }, [companyId, viewScope]);

  const handleScopeChange = (newScope: 'my' | 'team') => {
    setViewScope(newScope);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEmployee || !companyId) return;
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
      const res = await fetch('/api/v1/attendance/permissions', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          companyId,
          employee_id: currentEmployee.id,
          permission_type: form.permission_type,
          permission_date: form.permission_date,
          from_time: form.from_time,
          to_time: form.to_time,
          duration_minutes: duration,
          reason: form.reason
        })
      });

      if (res.ok) {
        showToast('Short-time permission request submitted!', 'success');
        setIsSubmitOpen(false);
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
        showToast(err.error || 'Failed to submit permission request.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Connection to server failed', 'error');
    } finally {
      setIsSubmitting(false);
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
          companyId
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

  const pendingCount = requests.filter(r => r.status === 'PENDING').length;
  const approvedCount = requests.filter(r => r.status === 'APPROVED').length;
  const rejectedCount = requests.filter(r => r.status === 'REJECTED').length;

  return (
    <div className="space-y-6 animate-fadeIn w-full text-slate-800 dark:text-slate-100">

      <DashboardPageHeader
        title="Permission Requests"
        actionMessage=""
        actionError=""
        companies={[]}
        companyId={companyId}
        handleCompanyChange={() => {}}
        isSuperAdmin={false}
        email={email}
        hideCompanySelect={true}
        hideUserBadge={true}
      />

      {/* 🌟 UNIFIED HEADER & TOGGLE BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center text-lg font-bold border border-purple-100 dark:border-purple-900/30 flex-shrink-0">
            🎟️
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">Short-time Permission Console</h2>
              <span className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 text-[10px] font-bold uppercase tracking-wider border border-purple-100 dark:border-purple-900/30">
                {isSuperAdmin ? 'Admin Console' : (viewScope === 'my' ? 'Personal View' : 'Manager Console')}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              {isSuperAdmin
                ? 'Review and manage all short-time permission requests across the company.'
                : (viewScope === 'my'
                    ? 'Apply and manage gatepass & short-duration permissions.'
                    : 'Review and approve short-time permission requests from your direct reports.')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto flex-wrap sm:flex-nowrap">
          {/* My vs Team Segmented Switcher (Visible only if user has direct reports or manager permissions) */}
          {hasSubordinates && !isSuperAdmin && (
            <div className="p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 flex items-center gap-1">
              <button
                onClick={() => handleScopeChange('my')}
                className={`py-1.5 px-3.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                  viewScope === 'my'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
                My View
              </button>
              <button
                onClick={() => handleScopeChange('team')}
                className={`py-1.5 px-3.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                  viewScope === 'team'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197M12 12.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" />
                </svg>
                Team View
                {pendingCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[9px] font-bold">
                    {pendingCount}
                  </span>
                )}
              </button>
            </div>
          )}

          {/* Primary Action Button */}
          {viewScope === 'my' && (
            <button
              onClick={() => setIsSubmitOpen(true)}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all duration-200 shadow-xs cursor-pointer border-0 flex items-center gap-1.5"
            >
              <span>➕</span> Apply for Permission
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
          <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center font-bold text-xs">⏳</div>
        </div>
        <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Approved</p>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{approvedCount}</p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center font-bold text-xs">✅</div>
        </div>
        <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">Rejected</p>
            <p className="text-xl font-bold text-red-600 dark:text-red-400 mt-0.5">{rejectedCount}</p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-950/50 text-red-600 flex items-center justify-center font-bold text-xs">❌</div>
        </div>
      </div>

      {/* Permission Requests History */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xs text-left">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                {viewScope === 'team' && <th className="py-3.5 px-3">Employee</th>}
                <th className="py-3.5 px-3">Submitted On</th>
                <th className="py-3.5 px-3">Target Date</th>
                <th className="py-3.5 px-3">Type</th>
                <th className="py-3.5 px-3">Time Window</th>
                <th className="py-3.5 px-3">Duration</th>
                <th className="py-3.5 px-3 max-w-xs">Reason</th>
                <th className="py-3.5 px-3">Status</th>
                <th className="py-3.5 px-3">Approver</th>
                <th className="py-3.5 px-3 text-right">Actions / Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={viewScope === 'team' ? 10 : 9} className="py-8 text-center text-slate-400 dark:text-slate-500 font-medium">
                    No short-time permission requests found for this view.
                  </td>
                </tr>
              ) : (
                requests.map(req => (
                  <tr key={req.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    {viewScope === 'team' && (
                      <td className="py-4 px-3">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {req.first_name ? `${req.first_name} ${req.last_name || ''}` : req.employee_id}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">{req.emp_id_code || ''}</div>
                      </td>
                    )}
                    <td className="py-4 px-3 font-semibold text-slate-500 font-mono">{new Date(req.created_at).toLocaleDateString()}</td>
                    <td className="py-4 px-3 font-bold text-slate-800 dark:text-slate-200 font-mono">{new Date(req.permission_date).toLocaleDateString()}</td>
                    <td className="py-4 px-3 font-bold text-slate-700 dark:text-slate-300">{formatPermissionType(req.permission_type)}</td>
                    <td className="py-4 px-3 font-semibold text-slate-600 dark:text-slate-350 font-mono">{req.from_time} - {req.to_time}</td>
                    <td className="py-4 px-3 font-bold text-purple-600 dark:text-purple-400 font-mono">{req.duration_minutes} mins</td>
                    <td className="py-4 px-3 text-slate-600 dark:text-slate-400 font-medium max-w-xs truncate" title={req.reason}>
                      {req.reason}
                    </td>
                    <td className="py-4 px-3">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${getStatusClass(req.status)}`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="py-4 px-3 font-semibold text-slate-700 dark:text-slate-300">
                      {req.approved_by_first_name ? `${req.approved_by_first_name} ${req.approved_by_last_name || ''}` : '-'}
                    </td>
                    <td className="py-4 px-3 text-right">
                      {viewScope === 'team' && req.status === 'PENDING' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setActionModal({ isOpen: true, requestId: req.id, action: 'APPROVED', remarks: '', isProcessing: false })}
                            className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-all cursor-pointer border-0 shadow-xs"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setActionModal({ isOpen: true, requestId: req.id, action: 'REJECTED', remarks: '', isProcessing: false })}
                            className="px-2.5 py-1 rounded-md bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold transition-all cursor-pointer border-0 shadow-xs"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-500 dark:text-slate-400 italic text-[11px] font-medium">
                          {req.remarks || 'No notes'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Permission Drawer */}
      <SlideDrawer
        isOpen={isSubmitOpen}
        onClose={() => setIsSubmitOpen(false)}
        title="Apply for Short-time Permission"
      >
        <form onSubmit={handleSubmit} className="space-y-5 text-left p-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              Permission Category
            </label>
            <select
              value={form.permission_type}
              onChange={e => setForm(prev => ({ ...prev, permission_type: e.target.value }))}
              className="w-full bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-semibold outline-none focus:border-purple-500 transition-colors"
            >
              <option value="MID_DAY">🍔 Mid-Day Break</option>
              <option value="LATE_ARRIVALS">🕒 Late Arrival / Late Entry</option>
              <option value="EARLY_EXIT">🚪 Early Exit / Early Departure</option>
              <option value="ON_DUTY">💼 Outdoor On-Duty Task</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              Date
            </label>
            <input
              type="date"
              value={form.permission_date}
              onChange={e => setForm(prev => ({ ...prev, permission_date: e.target.value }))}
              className="w-full bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-semibold outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                From Time
              </label>
              <input
                type="time"
                value={form.from_time}
                onChange={e => setForm(prev => ({ ...prev, from_time: e.target.value }))}
                className="w-full bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-semibold outline-none focus:border-purple-500 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                To Time
              </label>
              <input
                type="time"
                value={form.to_time}
                onChange={e => setForm(prev => ({ ...prev, to_time: e.target.value }))}
                className="w-full bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-semibold outline-none focus:border-purple-500 transition-colors"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              Reason for Permission
            </label>
            <textarea
              rows={4}
              value={form.reason}
              placeholder="State your reasons for requesting short permission..."
              onChange={e => setForm(prev => ({ ...prev, reason: e.target.value }))}
              className="w-full bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-semibold outline-none focus:border-purple-500 transition-colors resize-none"
            />
          </div>

          <div className="flex items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold py-3 rounded-xl transition-all duration-200 shadow-xs cursor-pointer border-0 disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting Application...' : 'Apply Now'}
            </button>
            <button
              type="button"
              onClick={() => setIsSubmitOpen(false)}
              className="px-4 py-3 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50/10 rounded-xl cursor-pointer bg-transparent"
            >
              Cancel
            </button>
          </div>
        </form>
      </SlideDrawer>

      {/* Action Approval/Rejection Modal */}
      {actionModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full shadow-2xl text-left">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {actionModal.action === 'APPROVED' ? 'Approve Permission Request' : 'Reject Permission Request'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Add any optional comments or remarks for the employee before proceeding.
            </p>
            <form onSubmit={handleActionSubmit} className="mt-4 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Manager Remarks (Optional)
                </label>
                <textarea
                  rows={3}
                  value={actionModal.remarks}
                  onChange={e => setActionModal(prev => ({ ...prev, remarks: e.target.value }))}
                  placeholder="Reason for decision..."
                  className="w-full bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs outline-none focus:border-purple-500 transition-colors resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActionModal({ isOpen: false, requestId: null, action: null, remarks: '', isProcessing: false })}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionModal.isProcessing}
                  className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer ${
                    actionModal.action === 'APPROVED' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {actionModal.isProcessing ? 'Saving...' : actionModal.action === 'APPROVED' ? 'Confirm Approval' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
