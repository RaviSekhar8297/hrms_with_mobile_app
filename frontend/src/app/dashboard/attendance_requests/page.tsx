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

interface RegularizationRequest {
  id: string;
  employee_id: string;
  attendance_date: string;
  requested_in: string | null;
  requested_out: string | null;
  reason: string;
  status: string;
  approved_by: string | null;
  approved_by_first_name?: string;
  approved_by_last_name?: string;
  first_name?: string;
  last_name?: string;
  emp_id_code?: string;
  remarks: string | null;
  created_at: string;
}

interface CompOffRequest {
  id: string;
  company_id: string;
  employee_id: string;
  emp_id_code?: string;
  employee_name?: string;
  approved_by_name?: string;
  worked_date: string;
  comp_off_type: 'FULL_DAY' | 'HALF_DAY';
  credited_days: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approved_by?: string | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
}

export default function AttendanceRequestsPage() {
  const { showToast } = useDashboard();
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [requests, setRequests] = useState<RegularizationRequest[]>([]);
  const [compOffRequests, setCompOffRequests] = useState<CompOffRequest[]>([]);
  const [eligibleCompOffDates, setEligibleCompOffDates] = useState<any[]>([]);
  const [isFetchingEligible, setIsFetchingEligible] = useState(false);
  const [claimingDate, setClaimingDate] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'regularizations' | 'compoffs'>('regularizations');
  const [viewScope, setViewScope] = useState<'my' | 'team'>('my');

  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Action Modal State for Regularization
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

  // Regularization Form state
  const [form, setForm] = useState({
    attendance_date: new Date().toLocaleDateString('en-CA'),
    requested_in: '',
    requested_out: '',
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
      const url = `/api/v1/attendance/regularizations?companyId=${companyId}&scope=${scope}`;
      const res = await fetch(url, { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) {
        setRequests(data.regularizations || []);
      }
    } catch (e) {
      console.error(e);
      showToast('Failed to load regularization history.', 'error');
    }
  };

  const fetchCompOffRequests = async () => {
    try {
      const url = isSuperAdmin
        ? `/api/v1/comp-off-requests?companyId=${companyId}`
        : '/api/v1/comp-off-requests';
      const res = await fetch(url, { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) {
        setCompOffRequests(data.requests || []);
      }
    } catch (err) {
      console.error('Failed to fetch comp-off requests:', err);
    }
  };

  const fetchEligibleCompOffDates = async (targetEmpId?: string) => {
    setIsFetchingEligible(true);
    try {
      const empId = targetEmpId || currentEmployee?.id || '';
      const empIdParam = empId ? `?employeeId=${empId}` : '';
      const res = await fetch(`/api/v1/comp-off-requests/eligible-dates${empIdParam}`, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        setEligibleCompOffDates(data.eligibleDates || []);
      }
    } catch (err) {
      console.error('Failed to fetch eligible comp-off dates:', err);
    } finally {
      setIsFetchingEligible(false);
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
      fetchCompOffRequests();
    }
  }, [companyId, viewScope]);

  useEffect(() => {
    if (activeTab === 'compoffs') {
      fetchEligibleCompOffDates();
    }
  }, [currentEmployee, activeTab]);

  const handleScopeChange = (newScope: 'my' | 'team') => {
    setViewScope(newScope);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEmployee || !companyId) return;
    if (!form.attendance_date || !form.reason) {
      showToast('Please fill in Date and Reason.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/attendance/regularizations', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          companyId,
          employee_id: currentEmployee.id,
          attendance_date: form.attendance_date,
          requested_in: form.requested_in || null,
          requested_out: form.requested_out || null,
          reason: form.reason
        })
      });

      if (res.ok) {
        showToast('Regularization request submitted successfully!', 'success');
        setIsSubmitOpen(false);
        setForm({
          attendance_date: new Date().toLocaleDateString('en-CA'),
          requested_in: '',
          requested_out: '',
          reason: ''
        });
        fetchRequests(viewScope);
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to submit regularization.', 'error');
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
      const res = await fetch(`/api/v1/attendance/regularizations/${actionModal.requestId}/action`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          action: actionModal.action,
          remarks: actionModal.remarks,
          companyId
        })
      });

      if (res.ok) {
        showToast(`Request ${actionModal.action.toLowerCase()} successfully!`, 'success');
        setActionModal({ isOpen: false, requestId: null, action: null, remarks: '', isProcessing: false });
        fetchRequests(viewScope);
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to process request.', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Server connection failed.', 'error');
    } finally {
      setActionModal(prev => ({ ...prev, isProcessing: false }));
    }
  };

  // 1-Click Direct Claim for Auto-Detected Date
  const handleDirectClaimCompOff = async (item: any) => {
    setClaimingDate(item.worked_date);
    try {
      const res = await fetch('/api/v1/comp-off-requests', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          worked_date: item.worked_date,
          comp_off_type: item.comp_off_type,
          reason: item.reason_suggested || `Worked on ${item.day_label} (${item.first_in} - ${item.last_out})`
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || `Comp-Off credit request for ${item.worked_date} submitted successfully!`, 'success');
        fetchEligibleCompOffDates(currentEmployee?.id);
        fetchCompOffRequests();
      } else {
        showToast(data.error || 'Failed to submit comp-off request', 'error');
      }
    } catch (err) {
      showToast('Error submitting comp-off request', 'error');
    } finally {
      setClaimingDate(null);
    }
  };

  const handleActionCompOff = async (id: string, action: 'APPROVED' | 'REJECTED') => {
    try {
      const res = await fetch(`/api/v1/comp-off-requests/${id}/action`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || `Comp-off request ${action.toLowerCase()} successfully!`, 'success');
        fetchEligibleCompOffDates(currentEmployee?.id);
        fetchCompOffRequests();
      } else {
        showToast(data.error || 'Failed to process comp-off request', 'error');
      }
    } catch (err) {
      showToast('Error processing comp-off request', 'error');
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

  const pendingCount = requests.filter(r => r.status === 'PENDING').length;
  const approvedCount = requests.filter(r => r.status === 'APPROVED').length;
  const rejectedCount = requests.filter(r => r.status === 'REJECTED').length;

  // Filter Comp-Offs for current year (2026)
  const currentYear = new Date().getFullYear();
  const currentYearCompOffs = compOffRequests.filter(req => {
    const yr = new Date(req.worked_date || req.created_at).getFullYear();
    return yr === currentYear;
  });

  const compOffPendingCount = currentYearCompOffs.filter(r => r.status === 'PENDING').length;
  const compOffApprovedCount = currentYearCompOffs.filter(r => r.status === 'APPROVED').length;
  const compOffRejectedCount = currentYearCompOffs.filter(r => r.status === 'REJECTED').length;

  const weekendOrHolidayDates = eligibleCompOffDates.filter(item =>
    item.is_weekend_or_holiday === true ||
    item.day_label?.includes('Sunday') ||
    item.day_label?.includes('Saturday') ||
    item.day_label?.includes('Holiday') ||
    item.day_label?.includes('Week-off')
  );

  return (
    <div className="space-y-6 animate-fadeIn w-full text-slate-800 dark:text-slate-100 font-['Plus_Jakarta_Sans',-apple-system,BlinkMacSystemFont,sans-serif]">

      <DashboardPageHeader
        title="Attendance & Comp-Off Requests"
        actionMessage=""
        actionError=""
        companies={[]}
        companyId={companyId}
        handleCompanyChange={() => { }}
        isSuperAdmin={false}
        email={email}
        hideCompanySelect={true}
        hideUserBadge={true}
      />

      {/* 🌟 PAGE TITLE & SCOPE SWITCHER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-left">

        {hasSubordinates && !isSuperAdmin && (
          <div className="p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 flex items-center gap-1 self-start md:self-auto">
            <button
              onClick={() => handleScopeChange('my')}
              className={`py-1.5 px-3.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${viewScope === 'my'
                  ? 'bg-indigo-600 text-white shadow-xs'
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
              className={`py-1.5 px-3.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${viewScope === 'team'
                  ? 'bg-indigo-600 text-white shadow-xs'
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
      </div>

      {/* 🌸 PASTEL SUB-NAVIGATION TABS */}
      <div className="p-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('regularizations')}
          className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all duration-200 cursor-pointer flex items-center gap-2 border ${activeTab === 'regularizations'
              ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/60 dark:border-indigo-800 dark:text-indigo-300 shadow-2xs'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40'
            }`}
        >
          <span>⏰</span>
          Attendance Regularizations
          <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 text-[10px]">
            {requests.length}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab('compoffs');
            fetchEligibleCompOffDates();
          }}
          className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all duration-200 cursor-pointer flex items-center gap-2 border ${activeTab === 'compoffs'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300 shadow-2xs'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40'
            }`}
        >
          <span>🎁</span>
          Compensatory Offs (Comp-Offs)
          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 text-[10px]">
            Year {currentYear}
          </span>
          {compOffPendingCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ATTENDANCE REGULARIZATIONS */}
      {/* ========================================================================= */}
      {activeTab === 'regularizations' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest text-left">
                {viewScope === 'my' ? 'My Regularization Applications' : 'Team Regularization Applications'}
              </h3>
              <p className="text-[10.5px] text-slate-400 dark:text-slate-500 font-medium mt-0.5 text-left">
                Track punch correction requests and review administrative actions
              </p>
            </div>
            {viewScope === 'my' && (
              <button
                onClick={() => setIsSubmitOpen(true)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all duration-200 shadow-xs cursor-pointer border-0 flex items-center gap-1.5"
              >
                <span>➕</span> Request Correction
              </button>
            )}
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

          {/* Requests History List Table */}
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xs text-left">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    {viewScope === 'team' && <th className="py-3.5 px-3">Employee</th>}
                    <th className="py-3.5 px-3">Submitted On</th>
                    <th className="py-3.5 px-3">Attendance Date</th>
                    <th className="py-3.5 px-3">Req In</th>
                    <th className="py-3.5 px-3">Req Out</th>
                    <th className="py-3.5 px-3 max-w-xs">Reason</th>
                    <th className="py-3.5 px-3">Status</th>
                    <th className="py-3.5 px-3">Approver</th>
                    <th className="py-3.5 px-3 text-right">Actions / Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {requests.length === 0 ? (
                    <tr>
                      <td colSpan={viewScope === 'team' ? 9 : 8} className="py-8 text-center text-slate-400 dark:text-slate-500 font-medium">
                        No attendance regularization requests found for this view.
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
                        <td className="py-4 px-3 font-bold text-slate-800 dark:text-slate-200 font-mono">{new Date(req.attendance_date).toLocaleDateString()}</td>
                        <td className="py-4 px-3 font-semibold text-slate-700 dark:text-slate-300 font-mono">{req.requested_in || '-'}</td>
                        <td className="py-4 px-3 font-semibold text-slate-700 dark:text-slate-300 font-mono">{req.requested_out || '-'}</td>
                        <td className="py-4 px-3 text-slate-600 dark:text-slate-400 font-medium max-w-xs truncate" title={req.reason}>
                          {req.reason}
                        </td>
                        <td className="py-4 px-3">
                          <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${getStatusClass(req.status)}`}>
                            {req.status}
                          </span>
                        </td>
                        <td className="py-4 px-3 text-slate-700 dark:text-slate-300 font-medium">
                          {req.approved_by_first_name ? `${req.approved_by_first_name} ${req.approved_by_last_name || ''}` : '-'}
                        </td>
                        <td className="py-4 px-3 text-right">
                          {req.status === 'PENDING' && (isSuperAdmin || viewScope === 'team') ? (
                            <div className="flex gap-1.5 justify-end">
                              <button
                                onClick={() => setActionModal({ isOpen: true, requestId: req.id, action: 'APPROVED', remarks: '', isProcessing: false })}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-2xs cursor-pointer border-0"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => setActionModal({ isOpen: true, requestId: req.id, action: 'REJECTED', remarks: '', isProcessing: false })}
                                className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold shadow-2xs cursor-pointer border-0"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 text-[11px] italic">
                              {req.remarks ? `"${req.remarks}"` : '-'}
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: COMPENSATORY OFFS (COMP-OFFS) CREDITS */}
      {/* ========================================================================= */}
      {activeTab === 'compoffs' && (
        <div className="space-y-5">
          {/* STATS OVERVIEW CARDS FOR CURRENT YEAR */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Worked</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{weekendOrHolidayDates.length}</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold text-sm">📅</div>
            </div>
            <div className="p-4 rounded-2xl border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Applied / Pending</p>
                <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5">{compOffPendingCount}</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-300 flex items-center justify-center font-bold text-sm">⏳</div>
            </div>
            <div className="p-4 rounded-2xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Approved Credits</p>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{compOffApprovedCount}</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300 flex items-center justify-center font-bold text-sm">✅</div>
            </div>
            <div className="p-4 rounded-2xl border border-rose-200/80 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Rejected</p>
                <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-0.5">{compOffRejectedCount}</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-300 flex items-center justify-center font-bold text-sm">❌</div>
            </div>
          </div>

          {/* ⚡ DIRECT AUTO-DETECTED WORKED DATES LIST CARDS WITH 1-CLICK CLAIM BUTTON */}
          <div className="space-y-4 text-left pt-2">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm border border-emerald-100 dark:border-emerald-900/30">
                  ⚡
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Auto-Detected Worked Weekends & Holidays
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    Available for 1-click Comp-Off credit claim
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => fetchEligibleCompOffDates()}
                className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 text-xs font-semibold border border-slate-200/80 dark:border-slate-700 transition-all cursor-pointer flex items-center gap-1.5"
              >
                🔄 Refresh Logs
              </button>
            </div>

            {isFetchingEligible ? (
              <div className="p-8 text-center text-xs text-slate-400 font-medium bg-slate-50/50 dark:bg-slate-900/60 rounded-xl border border-slate-200/60 dark:border-slate-800">
                Scanning attendance punch logs for worked weekends & holidays...
              </div>
            ) : weekendOrHolidayDates.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
                {weekendOrHolidayDates.map((item, idx) => {
                  const isClaiming = claimingDate === item.worked_date;
                  const canClaim = item.can_claim !== false && item.worked_hours >= 4.0;

                  // Format Date as 09-Aug-2026
                  const parts = String(item.worked_date).split(' ')[0].split('T')[0].split('-');
                  let formattedCardDate = item.worked_date;
                  if (parts.length === 3) {
                    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    const day = String(parseInt(parts[2], 10)).padStart(2, '0');
                    const monthIdx = parseInt(parts[1], 10) - 1;
                    formattedCardDate = `${day}-${months[monthIdx] || 'Jan'}-${parts[0]}`;
                  }

                  return (
                    <div
                      key={idx}
                      className={`p-4 rounded-2xl border transition-all duration-300 flex flex-col justify-between space-y-3.5 ${canClaim
                          ? 'border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs hover:shadow-md hover:border-emerald-400/80'
                          : 'border-amber-200/80 dark:border-amber-900/40 bg-amber-50/20 dark:bg-amber-950/20'
                        }`}
                    >
                      {/* Card Top: Date & Badges */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-extrabold text-slate-900 dark:text-white text-xs tracking-tight flex items-center gap-1.5">
                            <span className="text-slate-400 text-xs">📅</span>
                            {formattedCardDate}
                          </span>

                          <span className={`inline-block px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold ${!canClaim
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200'
                              : (item.comp_off_type === 'FULL_DAY'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200/60'
                                : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200/60')
                            }`}>
                            {canClaim ? `+${item.credited_days} Day` : 'Ineligible (< 4 hrs)'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-lg bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200/60">
                            {item.day_label}
                          </span>
                        </div>
                      </div>

                      {/* Card Middle: Timings & Worked Hours */}
                      <div className="p-2.5 rounded-xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80 text-[11px] font-medium text-slate-600 dark:text-slate-350 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-mono text-[10.5px]">
                          <span>In: <b className="text-slate-900 dark:text-slate-100 font-bold">{item.first_in}</b></span>
                          <span className="text-slate-300 dark:text-slate-600">➔</span>
                          <span>Out: <b className="text-slate-900 dark:text-slate-100 font-bold">{item.last_out}</b></span>
                        </div>
                        <span className="font-extrabold px-2 py-0.5 rounded-md text-[10px] bg-emerald-100/70 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          ⚡ {item.worked_hours} hrs
                        </span>
                      </div>

                      {/* Card Bottom: Direct Action / Live Status & Approver Info */}
                      {!isSuperAdmin && viewScope === 'my' && (
                        <div className="pt-0.5 flex items-center justify-between gap-2 flex-wrap">
                          {item.claim_info && (
                            <div className="text-[10.5px] text-slate-400 font-medium">
                              Approved By: <span className="font-bold text-slate-700 dark:text-slate-300">{item.claim_info.approved_by_name || 'Pending'}</span>
                            </div>
                          )}
                          <div className="ml-auto">
                            {!item.claim_info ? (
                              canClaim ? (
                                <button
                                  type="button"
                                  disabled={isClaiming}
                                  onClick={() => handleDirectClaimCompOff(item)}
                                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-97 text-white text-[11px] font-bold shadow-xs hover:shadow-emerald-500/20 transition-all cursor-pointer border-0 flex items-center gap-1.5"
                                >
                                  {isClaiming ? 'Claiming...' : '➕ Claim Credit'}
                                </button>
                              ) : (
                                <div className="flex items-center gap-1.5 py-0.5">
                                  <span
                                    className="w-4.5 h-4.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-[9.5px] cursor-help border border-amber-300 dark:border-amber-800 shadow-2xs"
                                    title={item.ineligible_reason || "Minimum 4 hours of work required for Comp-Off credit claim. Worked duration is less than 4.0 hours."}
                                  >
                                    ⚠️
                                  </span>
                                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                                    Min 4 hrs required
                                  </span>
                                </div>
                              )
                            ) : item.claim_info.status === 'PENDING' ? (
                              <div className="px-3.5 py-1.5 rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60 text-[11px] font-extrabold flex items-center gap-1.5 shadow-2xs">
                                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                                ⏳ Applied
                              </div>
                            ) : item.claim_info.status === 'APPROVED' ? (
                              <div className="px-3.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 text-[11px] font-extrabold flex items-center gap-1.5 shadow-2xs">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                ✅ Approved (+{item.credited_days} Day)
                              </div>
                            ) : (
                              <div className="px-3.5 py-1.5 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/60 text-[11px] font-extrabold flex items-center gap-1.5 shadow-2xs">
                                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                                ❌ Rejected
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {(isSuperAdmin || viewScope === 'team') && (
                        <div className="pt-1 flex items-center justify-end">
                          {item.claim_info?.status === 'PENDING' ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleActionCompOff(item.claim_info.id, 'APPROVED')}
                                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs transition-all cursor-pointer border-0"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => handleActionCompOff(item.claim_info.id, 'REJECTED')}
                                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-2xs transition-all cursor-pointer border-0"
                              >
                                Reject
                              </button>
                            </div>
                          ) : item.claim_info?.status === 'APPROVED' ? (
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              ✅ Approved
                            </span>
                          ) : item.claim_info?.status === 'REJECTED' ? (
                            <span className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                              ❌ Rejected
                            </span>
                          ) : (
                            <span className="text-xs font-medium text-slate-400 italic">
                              Unclaimed by employee
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 rounded-xl bg-slate-50/60 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 text-center font-medium">
                ℹ️ No un-claimed worked weekend/holiday punch records found in your attendance logs.
              </div>
            )}
          </div>
        </div>
      )}

      {/* REGULARIZATION SUBMIT DRAWER */}
      <SlideDrawer
        isOpen={isSubmitOpen}
        onClose={() => setIsSubmitOpen(false)}
        title="Request Attendance Regularization"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-left font-['Outfit',sans-serif]">
          <div>
            <label className="block text-[9.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Attendance Date *</label>
            <input
              type="date"
              required
              value={form.attendance_date}
              onChange={e => setForm({ ...form, attendance_date: e.target.value })}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 transition-all shadow-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[9.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Requested In Time</label>
              <input
                type="time"
                value={form.requested_in}
                onChange={e => setForm({ ...form, requested_in: e.target.value })}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 font-mono transition-all shadow-xs"
              />
            </div>
            <div>
              <label className="block text-[9.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Requested Out Time</label>
              <input
                type="time"
                value={form.requested_out}
                onChange={e => setForm({ ...form, requested_out: e.target.value })}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 font-mono transition-all shadow-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-[9.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Reason for Regularization *</label>
            <textarea
              required
              rows={3}
              placeholder="Explain why punch correction is required..."
              value={form.reason}
              onChange={e => setForm({ ...form, reason: e.target.value })}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 transition-all shadow-xs"
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsSubmitOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 text-xs font-bold text-slate-500 dark:text-slate-400 transition-all cursor-pointer bg-transparent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white shadow-xs transition-all cursor-pointer border-0"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </SlideDrawer>

      {/* REGULARIZATION ACTION MODAL */}
      {actionModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-['Outfit',sans-serif]">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-md w-full p-6 text-left animate-scaleUp">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {actionModal.action === 'APPROVED' ? 'Approve Regularization' : 'Reject Regularization'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Add optional remarks before processing this request.
            </p>

            <form onSubmit={handleActionSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-[9.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Remarks / Reason</label>
                <textarea
                  rows={3}
                  placeholder="Enter remarks..."
                  value={actionModal.remarks}
                  onChange={e => setActionModal({ ...actionModal, remarks: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 transition-all shadow-xs"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setActionModal({ isOpen: false, requestId: null, action: null, remarks: '', isProcessing: false })}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500 dark:text-slate-400 transition-all cursor-pointer bg-transparent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionModal.isProcessing}
                  className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow-xs transition-all cursor-pointer border-0 ${actionModal.action === 'APPROVED' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                    }`}
                >
                  {actionModal.isProcessing ? 'Processing...' : `Confirm ${actionModal.action}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
