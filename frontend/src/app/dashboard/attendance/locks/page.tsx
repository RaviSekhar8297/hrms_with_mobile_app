'use client';

import React, { useEffect, useState } from 'react';
import DashboardPageHeader from '../../components/DashboardPageHeader';
import { getHeaders, API_BASE } from '../../utils/api';
import { useDashboard } from '../../components/DashboardContext';
import { usePermissions } from '../../hooks/usePermissions';
import SlideDrawer from '../../components/SlideDrawer';
import { Lock, Unlock, Plus, Search, ShieldCheck, AlertTriangle, Calendar, Info, RefreshCw, UserCheck } from 'lucide-react';

interface AttendanceLock {
  id: string;
  company_id: string;
  company_name?: string;
  lock_year: number;
  lock_month: number;
  is_locked: boolean;
  locked_by?: string;
  locked_by_name?: string;
  created_at: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function AttendanceLocksPage() {
  const { showToast, companyId: globalCompanyId } = useDashboard();
  const { hasPermission, isSuperAdmin } = usePermissions();

  const canView = isSuperAdmin || hasPermission('view_attendance_locks') || hasPermission('view_attendance_policies') || hasPermission('view_attendance_rules');
  const canCreate = isSuperAdmin || hasPermission('create_attendance_locks') || hasPermission('create_attendance_policies') || hasPermission('create_attendance_rules');
  const canEdit = isSuperAdmin || hasPermission('edit_attendance_locks') || hasPermission('edit_attendance_policies') || hasPermission('edit_attendance_rules');

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [locks, setLocks] = useState<AttendanceLock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Lock Drawer State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lockForm, setLockForm] = useState({
    lock_year: new Date().getFullYear(),
    lock_month: new Date().getMonth() + 1,
    is_locked: true,
  });

  const activeCompanyId = globalCompanyId || companyId;

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

    const savedCompanyId = localStorage.getItem('selectedCompanyId');
    if (savedCompanyId) {
      setCompanyId(savedCompanyId);
    }

    fetchCompanies();
  }, []);

  useEffect(() => {
    fetchLocks();
  }, [activeCompanyId]);

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

  const fetchLocks = async () => {
    setIsLoading(true);
    try {
      const cid = activeCompanyId || localStorage.getItem('companyId');
      const url = cid && cid !== 'all'
        ? `${API_BASE}/api/v1/attendance/locks?company_id=${cid}`
        : `${API_BASE}/api/v1/attendance/locks`;
      
      const res = await fetch(url, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setLocks(data.locks || []);
      } else {
        showToast('Failed to load attendance lock records', 'error');
      }
    } catch (e) {
      console.error('Failed to load locks:', e);
      showToast('Connection error loading attendance locks', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompanyChange = (newId: string) => {
    setCompanyId(newId);
    localStorage.setItem('selectedCompanyId', newId);
  };

  const handleSaveLock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate && !canEdit) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/attendance/locks`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          company_id: activeCompanyId,
          lock_year: Number(lockForm.lock_year),
          lock_month: Number(lockForm.lock_month),
          is_locked: lockForm.is_locked,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'Attendance month lock saved successfully!', 'success');
        setIsDrawerOpen(false);
        fetchLocks();
      } else {
        showToast(data.error || 'Failed to save attendance lock', 'error');
      }
    } catch (e: any) {
      console.error(e);
      showToast(e.message || 'Error saving lock', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleLockStatus = async (lock: AttendanceLock) => {
    if (!canEdit) {
      showToast('You do not have permission to edit lock status', 'error');
      return;
    }

    try {
      const newStatus = !lock.is_locked;
      const res = await fetch(`${API_BASE}/api/v1/attendance/locks/${lock.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ is_locked: newStatus }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(`Month ${MONTH_NAMES[lock.lock_month - 1]} ${lock.lock_year} is now ${newStatus ? 'LOCKED 🔒' : 'UNLOCKED 🔓'}`, 'success');
        fetchLocks();
      } else {
        showToast(data.error || 'Failed to update status', 'error');
      }
    } catch (e: any) {
      console.error(e);
      showToast('Network error updating lock', 'error');
    }
  };

  const filteredLocks = locks.filter(l => {
    const monthName = MONTH_NAMES[l.lock_month - 1] || '';
    const q = searchQuery.toLowerCase();
    return (
      monthName.toLowerCase().includes(q) ||
      String(l.lock_year).includes(q) ||
      (l.locked_by_name && l.locked_by_name.toLowerCase().includes(q))
    );
  });

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

      {/* ACCESS DENIED STATE */}
      {!canView ? (
        <div className="bg-white dark:bg-slate-900 p-12 rounded-3xl border border-slate-200 dark:border-slate-800 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mx-auto text-xl border border-rose-100 dark:border-rose-900">
            🔒
          </div>
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">
            Access Restricted
          </h3>
          <p className="text-xs text-slate-400 font-medium max-w-md mx-auto">
            You do not have permission to view attendance locks. Please contact your system administrator.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* EXPLANATORY HEADER BANNER (LIGHT SLEEK AESTHETIC STYLE) */}
          <div className="bg-gradient-to-r from-indigo-50/90 via-purple-50/70 to-blue-50/90 dark:from-slate-900 dark:via-indigo-950/60 dark:to-slate-900 rounded-3xl p-6 shadow-2xs border border-indigo-100/90 dark:border-indigo-900/50 relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
              <div className="space-y-2 max-w-3xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100/80 dark:bg-indigo-950/80 border border-indigo-200/80 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-[10.5px] font-extrabold uppercase tracking-wider">
                  <ShieldCheck size={13} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span>PERIOD FREEZE & PAYROLL INTEGRITY</span>
                </div>
                <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Attendance Month Locks Console</span>
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                  Freezing a payroll period prevents employees from modifying attendance records, submitting backdated regularizations, or requesting permissions for locked months. Ensures 100% payroll compliance and data protection.
                </p>
              </div>

              {canCreate && (
                <button
                  type="button"
                  onClick={() => {
                    setLockForm({
                      lock_year: new Date().getFullYear(),
                      lock_month: new Date().getMonth() + 1,
                      is_locked: true,
                    });
                    setIsDrawerOpen(true);
                  }}
                  className="px-5 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-black uppercase tracking-wider shadow-md shadow-indigo-600/20 transition-all duration-200 hover:-translate-y-0.5 cursor-pointer flex items-center gap-2 shrink-0 self-start md:self-auto"
                >
                  <Plus size={15} className="stroke-[3]" />
                  <span>+ Lock New Month</span>
                </button>
              )}
            </div>
          </div>

          {/* CONTROLS HEADER */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div>
              <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Lock size={15} className="text-rose-500 shrink-0" />
                <span>Attendance Period Lock Cards</span>
              </h3>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                Audit view of locked & unlocked months across fiscal periods
              </p>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search month, year, admin..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 font-medium transition-all"
                />
              </div>

              <button
                type="button"
                onClick={fetchLocks}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                title="Refresh Locks"
              >
                <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* CARD GRID LAYOUT (REPLACING TABLE AS REQUESTED) */}
          {isLoading ? (
            <div className="bg-white dark:bg-slate-900 p-16 rounded-3xl border border-slate-200 dark:border-slate-800 text-center space-y-3">
              <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Loading Attendance Month Locks...</p>
            </div>
          ) : filteredLocks.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 p-12 rounded-3xl border border-slate-200 dark:border-slate-800 text-center space-y-4 shadow-2xs">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center mx-auto border border-amber-100 dark:border-amber-900">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">No Month Locks Found</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto font-medium">
                  No attendance lock rules configured yet. Click Lock New Month to freeze a period.
                </p>
              </div>
              {canCreate && (
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(true)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                >
                  + Lock New Month
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredLocks.map((lock) => {
                const monthName = MONTH_NAMES[lock.lock_month - 1] || `Month ${lock.lock_month}`;
                const isLocked = lock.is_locked;

                return (
                  <div
                    key={lock.id}
                    className={`group rounded-3xl p-5 border transition-all duration-200 hover:-translate-y-1 hover:shadow-lg relative overflow-hidden flex flex-col justify-between space-y-4 ${
                      isLocked
                        ? 'bg-gradient-to-b from-rose-50/40 via-white to-rose-50/20 dark:from-rose-950/30 dark:via-slate-900 dark:to-rose-950/10 border-rose-300 dark:border-rose-800/80 shadow-rose-500/5'
                        : 'bg-gradient-to-b from-emerald-50/40 via-white to-emerald-50/20 dark:from-emerald-950/30 dark:via-slate-900 dark:to-emerald-950/10 border-emerald-300 dark:border-emerald-800/80 shadow-emerald-500/5'
                    }`}
                  >
                    {/* Top Row: Month Name & Lock Status Badge */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-xl border ${
                          isLocked 
                            ? 'bg-rose-100/80 dark:bg-rose-950/80 text-rose-600 border-rose-200 dark:border-rose-800' 
                            : 'bg-emerald-100/80 dark:bg-emerald-950/80 text-emerald-600 border-emerald-200 dark:border-emerald-800'
                        }`}>
                          <Calendar size={18} className="shrink-0" />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none">
                            {monthName}
                          </h4>
                          <span className="text-[11px] font-mono font-bold text-slate-400 block mt-0.5">
                            {lock.lock_year}
                          </span>
                        </div>
                      </div>

                      {/* Status Badge */}
                      {isLocked ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9.5px] font-black bg-rose-50 text-rose-700 dark:bg-rose-950/90 dark:text-rose-300 border border-rose-200 dark:border-rose-800 shrink-0">
                          <Lock size={10} className="text-rose-500 shrink-0" />
                          <span>LOCKED</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9.5px] font-black bg-emerald-50 text-emerald-700 dark:bg-emerald-950/90 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                          <Unlock size={10} className="text-emerald-500 shrink-0" />
                          <span>UNLOCKED</span>
                        </span>
                      )}
                    </div>

                    {/* Middle Info: Locked By Admin & Date */}
                    <div className="p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800/80 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 font-semibold flex items-center gap-1">
                          <UserCheck size={12} className="text-indigo-500 shrink-0" />
                          Action By:
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[120px]">
                          {lock.locked_by_name || 'System Admin'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 font-semibold">Date:</span>
                        <span className="font-mono text-slate-500 dark:text-slate-400 font-semibold">
                          {new Date(lock.created_at).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Action Button */}
                    <div>
                      {canEdit ? (
                        <button
                          type="button"
                          onClick={() => handleToggleLockStatus(lock)}
                          className={`w-full py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer shadow-sm flex items-center justify-center gap-2 border ${
                            isLocked
                              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border-emerald-500/30 shadow-emerald-600/20'
                              : 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white border-rose-500/30 shadow-rose-600/20'
                          }`}
                        >
                          {isLocked ? (
                            <>
                              <Unlock size={14} />
                              <span>Unlock Month</span>
                            </>
                          ) : (
                            <>
                              <Lock size={14} />
                              <span>Lock Month</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <div className="text-center py-1 text-[11px] font-bold text-slate-400 italic">
                          Read-only View
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT LOCK DRAWER */}
      <SlideDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="Configure Attendance Period Lock"
      >
        <form onSubmit={handleSaveLock} className="space-y-5">
          <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 space-y-2">
            <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-bold text-xs">
              <Info size={15} className="shrink-0" />
              <span>Period Lock Rules</span>
            </div>
            <p className="text-xs text-indigo-900/80 dark:text-indigo-200/80 leading-relaxed font-normal">
              Locking a period freezes all attendance records. Employees will be prevented from submitting backdated regularizations or permissions for this month.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Select Lock Year
              </label>
              <select
                value={lockForm.lock_year}
                onChange={e => setLockForm({ ...lockForm, lock_year: Number(e.target.value) })}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500"
              >
                {[2025, 2026, 2027, 2028].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Select Lock Month
              </label>
              <select
                value={lockForm.lock_month}
                onChange={e => setLockForm({ ...lockForm, lock_month: Number(e.target.value) })}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500"
              >
                {MONTH_NAMES.map((name, index) => (
                  <option key={index + 1} value={index + 1}>
                    {name} ({index + 1})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Lock Status
              </label>
              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-rose-600 dark:text-rose-400">
                  <input
                    type="radio"
                    name="is_locked"
                    checked={lockForm.is_locked === true}
                    onChange={() => setLockForm({ ...lockForm, is_locked: true })}
                    className="w-4 h-4 text-rose-600 focus:ring-rose-500"
                  />
                  <span>Lock Period (🔒 Freeze Data)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <input
                    type="radio"
                    name="is_locked"
                    checked={lockForm.is_locked === false}
                    onChange={() => setLockForm({ ...lockForm, is_locked: false })}
                    className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Unlock Period (🔓 Allow Edits)</span>
                </label>
              </div>
            </div>
          </div>

          <div className="pt-4 flex gap-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsDrawerOpen(false)}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving Lock...</span>
                </>
              ) : (
                <span>Save Period Lock</span>
              )}
            </button>
          </div>
        </form>
      </SlideDrawer>
    </div>
  );
}
