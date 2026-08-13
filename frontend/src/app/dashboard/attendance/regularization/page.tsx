'use client';

import React, { useEffect, useState } from 'react';
import DashboardPageHeader from '../../components/DashboardPageHeader';
import AttendanceSubHeader from '../../components/AttendanceSubHeader';
import { getHeaders, API_BASE } from '../../utils/api';
import SlideDrawer from '../../components/SlideDrawer';
import { useDashboard } from '../../components/DashboardContext';
import { usePermissions } from '../../hooks/usePermissions';

export default function RegularizationRequestsPage() {
  const { showToast } = useDashboard();
  const { isSuperAdmin } = usePermissions();

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [viewScope, setViewScope] = useState<'my' | 'team'>('my');

  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [form, setForm] = useState({
    attendance_date: new Date().toISOString().split('T')[0],
    punch_type: 'CHECK_IN',
    requested_time: '09:30',
    reason: '',
  });

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

    const savedCompanyId = localStorage.getItem('selectedCompanyId');
    if (savedCompanyId) {
      setCompanyId(savedCompanyId);
    }

    fetchCompanies();
  }, []);

  useEffect(() => {
    if (companyId) {
      fetchEmployees();
      fetchRequests();
    }
  }, [companyId, viewScope]);

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
    if (!companyId) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/employees?company_id=${companyId}`, { headers: getHeaders() });
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
    if (!companyId) return;
    setIsLoading(true);
    try {
      const scopeParam = isSuperAdmin ? 'all' : viewScope;
      const res = await fetch(`${API_BASE}/api/v1/attendance/regularizations?company_id=${companyId}&scope=${scopeParam}`, { headers: getHeaders() });
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

  const safeEmployees = Array.isArray(employees) ? employees : [];
  const me = safeEmployees.find(emp => emp?.email?.toLowerCase() === email.toLowerCase());

  const handleCompanyChange = (newId: string) => {
    setCompanyId(newId);
    localStorage.setItem('selectedCompanyId', newId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/attendance/regularizations`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          company_id: companyId,
          ...form,
        }),
      });

      if (res.ok) {
        showToast('Regularization request submitted successfully!', 'success');
        setDrawerOpen(false);
        setForm({
          attendance_date: new Date().toISOString().split('T')[0],
          punch_type: 'CHECK_IN',
          requested_time: '09:30',
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

  const handleAction = async (id: string, action: 'APPROVED' | 'REJECTED') => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/attendance/regularizations/${id}/action`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        showToast(`Request ${action.toLowerCase()} successfully!`, 'success');
        fetchRequests();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to update request', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Connection error', 'error');
    }
  };

  const safeRequests = Array.isArray(requests) ? requests : [];
  const pendingCount = safeRequests.filter(r => r?.status === 'PENDING').length;
  const approvedCount = safeRequests.filter(r => r?.status === 'APPROVED').length;
  const rejectedCount = safeRequests.filter(r => r?.status === 'REJECTED').length;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto p-4 sm:p-6 font-sans">
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

      {/* HEADER & SCOPE SWITCHER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h2 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span>📝</span> Attendance Punch Regularization Requests
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Submit missed IN/OUT punch correction applications and review team submissions
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {!isSuperAdmin && (
            <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setViewScope('my')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-0 ${
                  viewScope === 'my'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                👤 My Requests
              </button>
              <button
                onClick={() => setViewScope('team')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-0 ${
                  viewScope === 'team'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                👥 Team Approvals
              </button>
            </div>
          )}

          <button
            onClick={() => setDrawerOpen(true)}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer border-0 flex items-center gap-2 whitespace-nowrap"
          >
            <span>➕</span> Apply Regularization
          </button>
        </div>
      </div>

      {/* SUMMARY STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">Total Applications</p>
          <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">{requests.length}</h3>
        </div>
        <div className="p-4 rounded-2xl border border-amber-200/80 dark:border-amber-900/30 bg-amber-50/40 dark:bg-amber-950/20 shadow-xs">
          <p className="text-[10.5px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Pending Approval</p>
          <h3 className="text-2xl font-extrabold text-amber-700 dark:text-amber-300 mt-1">{pendingCount}</h3>
        </div>
        <div className="p-4 rounded-2xl border border-emerald-200/80 dark:border-emerald-900/30 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-xs">
          <p className="text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Approved</p>
          <h3 className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-1">{approvedCount}</h3>
        </div>
        <div className="p-4 rounded-2xl border border-rose-200/80 dark:border-rose-900/30 bg-rose-50/40 dark:bg-rose-950/20 shadow-xs">
          <p className="text-[10.5px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Rejected</p>
          <h3 className="text-2xl font-extrabold text-rose-700 dark:text-rose-300 mt-1">{rejectedCount}</h3>
        </div>
      </div>

      {/* REQUESTS TABLE */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[9.5px]">
                <th className="py-3 px-3">Employee</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Punch Type</th>
                <th className="py-3 px-3">Requested Time</th>
                <th className="py-3 px-3">Reason</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">Loading regularization requests...</td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="py-12 px-4 text-center flex flex-col items-center justify-center space-y-2">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center text-lg">
                        📝
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">No Regularization Requests Found</h4>
                        <p className="text-[11px] text-slate-400 font-medium max-w-xs mt-0.5">
                          {viewScope === 'my' ? 'You have not submitted any regularization requests.' : 'No team regularization requests pending.'}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                requests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200">
                      {req.employee_name || (req.first_name ? `${req.first_name} ${req.last_name || ''}` : 'Employee')}
                      {req.emp_id_code && <span className="block text-[10px] text-slate-400 font-normal">{req.emp_id_code}</span>}
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-700 dark:text-slate-300">
                      {new Date(req.attendance_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${req.punch_type === 'CHECK_IN' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300' : 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300'}`}>
                        {req.punch_type === 'CHECK_IN' ? 'Check In' : 'Check Out'}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                      {req.requested_time}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                      {req.reason || '—'}
                    </td>
                    <td className="py-3 px-3 text-center">
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
                    <td className="py-3 px-3 text-right">
                      {req.status === 'PENDING' && (isSuperAdmin || viewScope === 'team') ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleAction(req.id, 'APPROVED')}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-2xs transition-all cursor-pointer border-0"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleAction(req.id, 'REJECTED')}
                            className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold shadow-2xs transition-all cursor-pointer border-0"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">
                          {req.status === 'APPROVED' ? `Approved` : req.status === 'REJECTED' ? 'Rejected' : 'Awaiting Review'}
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

      {/* APPLY REGULARIZATION DRAWER */}
      <SlideDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Apply Punch Regularization"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans p-1">
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Attendance Date *
            </label>
            <input
              type="date"
              value={form.attendance_date}
              onChange={(e) => setForm({ ...form, attendance_date: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-bold"
              required
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Punch Type *
            </label>
            <select
              value={form.punch_type}
              onChange={(e) => setForm({ ...form, punch_type: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-bold cursor-pointer"
            >
              <option value="CHECK_IN">Check-In Punch</option>
              <option value="CHECK_OUT">Check-Out Punch</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Requested Punch Time (HH:MM) *
            </label>
            <input
              type="time"
              value={form.requested_time}
              onChange={(e) => setForm({ ...form, requested_time: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-bold"
              required
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Reason / Explanation *
            </label>
            <textarea
              rows={3}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="e.g. Biometric machine offline / Forgot to punch"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-medium"
              required
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
    </div>
  );
}
