'use client';

import React, { useEffect, useState } from 'react';
import DashboardPageHeader from '../../components/DashboardPageHeader';
import { getHeaders } from '../../utils/api';
import SlideDrawer from '../../components/SlideDrawer';
import { useDashboard } from '../../components/DashboardContext';

export default function LeaveRequestsPage() {
  const { showToast } = useDashboard();
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const [viewScope, setViewScope] = useState<'my' | 'team'>('my');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [weekoffPolicy, setWeekoffPolicy] = useState<any>(null);

  const [applyDrawerOpen, setApplyDrawerOpen] = useState(false);
  const [actionModal, setActionModal] = useState<{ open: boolean; req: any | null; type: 'APPROVE' | 'REJECT' }>({
    open: false,
    req: null,
    type: 'APPROVE'
  });
  const [managerRemarks, setManagerRemarks] = useState('');

  const [applyForm, setApplyForm] = useState({
    leave_type_id: '',
    from_date: new Date().toISOString().split('T')[0],
    to_date: new Date().toISOString().split('T')[0],
    total_days: '1',
    reason: ''
  });

  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('superadmin');
  const me = employees.find(emp => emp.email?.toLowerCase() === email.toLowerCase());

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

    const isSuper = parsedRoles.includes('SuperAdmin') || parsedRoles.includes('superadmin');
    const isMgr = parsedRoles.some(r => {
      const lr = r.toLowerCase();
      return lr.includes('manager') || lr.includes('head') || lr.includes('lead') || lr.includes('executive') || lr.includes('director');
    });

    if (isSuper || isMgr) {
      setViewScope('team');
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
    fetchLeaveTypes();
    fetchHolidays();
    fetchWeekoffs();
  }, [companyId]);

  useEffect(() => {
    fetchLeaveRequests(viewScope);
  }, [viewScope, companyId]);

  const fetchEmployees = async () => {
    const cid = companyId || 'all';
    try {
      const res = await fetch(`http://localhost:5000/api/v1/employees?companyId=${cid}`, { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) setEmployees(data.employees || []);
    } catch (e) {
      console.error('Error fetching employees:', e);
    }
  };

  const fetchLeaveTypes = async () => {
    const cid = companyId || 'all';
    try {
      const res = await fetch(`http://localhost:5000/api/v1/leave-types?companyId=${cid}`, { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) setLeaveTypes(data.leaveTypes || []);
    } catch (e) {
      console.error('Error fetching leave types:', e);
    }
  };

  const fetchHolidays = async () => {
    const cid = companyId || 'all';
    try {
      const res = await fetch(`http://localhost:5000/api/v1/holidays?companyId=${cid}`, { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) setHolidays(data.holidays || []);
    } catch (e) {}
  };

  const fetchWeekoffs = async () => {
    const cid = companyId || 'all';
    try {
      const res = await fetch(`http://localhost:5000/api/v1/weekoffs?companyId=${cid}`, { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) setWeekoffPolicy(data.policy || null);
    } catch (e) {}
  };

  const fetchLeaveRequests = async (scope: 'my' | 'team') => {
    setIsLoading(true);
    const cid = companyId || 'all';
    try {
      const res = await fetch(`http://localhost:5000/api/v1/leave-requests?companyId=${cid}&scope=${scope}`, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) setRequests(data.requests || []);
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
      }
    }
  }, [applyForm.from_date, applyForm.to_date, holidays, weekoffPolicy]);

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyForm.leave_type_id || !applyForm.from_date || !applyForm.to_date) {
      showToast('Please fill all required fields', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch('http://localhost:5000/api/v1/leave-requests', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(applyForm)
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Leave request submitted successfully', 'success');
        setApplyDrawerOpen(false);
        fetchLeaveRequests(viewScope);
      } else {
        showToast(data.error || 'Failed to submit leave request', 'error');
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
      const res = await fetch(`http://localhost:5000/api/v1/leave-requests/${actionModal.req.id}/action`, {
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
      } else {
        showToast(data.error || 'Failed to update request', 'error');
      }
    } catch (e) {
      showToast('Server connection failure', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredRequests = requests.filter(req => {
    const matchesStatus = statusFilter === 'ALL' || req.status === statusFilter;
    const empName = req.employee_name || '';
    const matchesSearch = empName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          req.leave_type_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          req.reason?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const pendingCount = requests.filter(r => r.status === 'PENDING').length;
  const approvedCount = requests.filter(r => r.status === 'APPROVED').length;
  const rejectedCount = requests.filter(r => r.status === 'REJECTED').length;

  const isManager = !isSuperAdmin && (
    roles.some(r => {
      const lr = r.toLowerCase();
      return lr.includes('manager') || lr.includes('head') || lr.includes('lead') || lr.includes('executive') || lr.includes('director') || lr.includes('supervisor');
    }) || (me && employees.some(e => e.reporting_to_id === me.id || e.reporting_to_id === me.emp_id_code))
  );

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
        <button
          onClick={() => setApplyDrawerOpen(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>Apply For Leave</span>
        </button>
      </DashboardPageHeader>

      {/* 📊 SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Applications</span>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1 block">{requests.length}</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 flex items-center justify-center font-bold text-xl">
            📝
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-amber-500 uppercase tracking-wider block">Pending Queue</span>
            <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1 block">{pendingCount}</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center font-bold text-xl">
            ⏳
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider block">Approved</span>
            <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 block">{approvedCount}</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center font-bold text-xl">
            ✅
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-rose-500 uppercase tracking-wider block">Rejected</span>
            <span className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-1 block">{rejectedCount}</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center font-bold text-xl">
            ❌
          </div>
        </div>
      </div>

      {/* 🎛️ CONTROLS & FILTER BAR */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* SCOPE SWITCHER / BADGE */}
        {isManager ? (
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setViewScope('my')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                viewScope === 'my'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              My Applications
            </button>
            <button
              onClick={() => setViewScope('team')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                viewScope === 'team'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Team Approvals Queue
            </button>
          </div>
        ) : isSuperAdmin ? (
          <div className="px-3.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center gap-1.5 shrink-0">
            <span>🏢</span> Organization Leave Requests Queue
          </div>
        ) : (
          <div className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 shrink-0">
            <span>👤</span> My Leave Applications
          </div>
        )}

        {/* STATUS TABS & SEARCH */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
            {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  statusFilter === st
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Search employee, leave..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

      </div>

      {/* 📜 LEAVE REQUESTS TABLE */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
            <span className="text-xs font-medium text-slate-400">Loading leave requests...</span>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center">
            <span className="text-4xl block mb-2">🏖️</span>
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">No Leave Applications Found</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              There are no leave requests matching your current filters. Click "Apply For Leave" to submit a new request.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="p-4">Employee</th>
                  <th className="p-4">Leave Type</th>
                  <th className="p-4">Dates & Duration</th>
                  <th className="p-4">Reason</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 font-bold flex items-center justify-center text-xs">
                          {req.employee_name?.slice(0, 2).toUpperCase() || 'EMP'}
                        </div>
                        <div>
                          <span className="font-bold text-slate-800 dark:text-slate-100 block">{req.employee_name || 'Staff Member'}</span>
                          <span className="text-[10px] text-slate-400">{req.department_name || req.emp_id_code || 'Employee'}</span>
                        </div>
                      </div>
                    </td>

                    <td className="p-4 font-semibold text-slate-700 dark:text-slate-200">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[11px]">
                        {req.leave_type_name || 'General Leave'}
                      </span>
                    </td>

                    <td className="p-4">
                      <div className="font-medium text-slate-700 dark:text-slate-200">
                        {req.from_date?.split('T')[0]} to {req.to_date?.split('T')[0]}
                      </div>
                      <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                        {req.total_days} Day(s)
                      </span>
                    </td>

                    <td className="p-4 max-w-xs truncate text-slate-500 dark:text-slate-400">
                      {req.reason || 'No details provided'}
                    </td>

                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                        req.status === 'APPROVED'
                          ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 border border-emerald-300'
                          : req.status === 'REJECTED'
                          ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-600 border border-rose-300'
                          : 'bg-amber-100 dark:bg-amber-950/80 text-amber-600 border border-amber-300 animate-pulse'
                      }`}>
                        {req.status}
                      </span>
                    </td>

                    <td className="p-4 text-right">
                      {req.status === 'PENDING' && viewScope === 'team' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setActionModal({ open: true, req, type: 'APPROVE' })}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-lg shadow-sm transition-all"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setActionModal({ open: true, req, type: 'REJECT' })}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold rounded-lg shadow-sm transition-all"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">No action needed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 🚪 APPLY LEAVE DRAWER */}
      <SlideDrawer
        isOpen={applyDrawerOpen}
        onClose={() => setApplyDrawerOpen(false)}
        title="Apply For Leave"
      >
        <form onSubmit={handleApplyLeave} className="space-y-4 p-4">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Select Leave Type *
            </label>
            <select
              value={applyForm.leave_type_id}
              onChange={e => setApplyForm(prev => ({ ...prev, leave_type_id: e.target.value }))}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none"
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">From Date *</label>
              <input
                type="date"
                value={applyForm.from_date}
                onChange={e => setApplyForm(prev => ({ ...prev, from_date: e.target.value }))}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">To Date *</label>
              <input
                type="date"
                value={applyForm.to_date}
                onChange={e => setApplyForm(prev => ({ ...prev, to_date: e.target.value }))}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none"
                required
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
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Reason / Remarks *
            </label>
            <textarea
              rows={3}
              placeholder="State the reason for leave request..."
              value={applyForm.reason}
              onChange={e => setApplyForm(prev => ({ ...prev, reason: e.target.value }))}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none"
              required
            />
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
            >
              {isSaving ? 'Submitting...' : 'Submit Application'}
            </button>
            <button
              type="button"
              onClick={() => setApplyDrawerOpen(false)}
              className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl"
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
                className={`flex-1 py-2.5 text-white font-bold text-xs rounded-xl shadow-lg ${
                  actionModal.type === 'APPROVE' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'
                }`}
              >
                {isSaving ? 'Processing...' : `Confirm ${actionModal.type === 'APPROVE' ? 'Approval' : 'Rejection'}`}
              </button>
              <button
                onClick={() => setActionModal({ open: false, req: null, type: 'APPROVE' })}
                className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl"
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
