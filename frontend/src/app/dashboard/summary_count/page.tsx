'use client';

import React, { useEffect, useState } from 'react';
import DashboardPageHeader from '../components/DashboardPageHeader';
import { useDashboard } from '../components/DashboardContext';
import { usePermissions } from '../hooks/usePermissions';
import { getHeaders, API_BASE } from '../utils/api';
import ModernPagination from '../components/ModernPagination';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { 
  Search, 
  RefreshCw, 
  Users, 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  AlertCircle,
  AlertTriangle,
  Clock,
  Filter,
  FileSpreadsheet
} from 'lucide-react';

interface SummaryCountRecord {
  id: string;
  company_id: string;
  employee_id: string;
  first_name?: string;
  last_name?: string;
  emp_id_code?: string;
  email?: string;
  department_name?: string;
  company_name?: string;
  month: number;
  year: number;
  cycle_days: number;
  month_days: number;
  working_days: number;
  present_days: number;
  half_days: number;
  absent_days: number;
  paid_leave_days: number;
  unpaid_leave_days: number;
  lop_days: number;
  weekoff_days: number;
  holiday_days: number;
  late_days: number;
  late_minutes: number;
  early_exit_days: number;
  early_exit_minutes: number;
  worked_minutes: number;
  overtime_minutes: number;
  approved_overtime_minutes: number;
  cycle_payable_days: number;
  final_payable_days: number;
  created_at: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function SummaryCountPage() {
  const { showToast, companyId: globalCompanyId } = useDashboard();
  const { isSuperAdmin, hasPermission, getPermissionScope } = usePermissions();

  // 🛡️ Standardized tablename_action Permissions
  const canView = isSuperAdmin || hasPermission('attendance_summary_count_view') || hasPermission('view_attendance_summary') || hasPermission('attendance_summary_view');

  // 🌐 Data Scopes
  const viewScope_perm = getPermissionScope('attendance_summary_count_view') || getPermissionScope('view_attendance_summary') || 'SELF';
  const canSeeTeamTab = isSuperAdmin || ['TEAM', 'REPORTING', 'DEPARTMENT', 'ALL'].includes(viewScope_perm);

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const activeCompanyId = globalCompanyId || companyId;

  const [viewScope, setViewScope] = useState<'my' | 'team'>('my');
  const [isLoading, setIsLoading] = useState(false);
  const [records, setRecords] = useState<SummaryCountRecord[]>([]);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | 'ALL'>(new Date().getMonth() + 1);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    const storedEmail = localStorage.getItem('email');
    const storedRoles = localStorage.getItem('roles');
    const storedCompanyId = localStorage.getItem('companyId');
    if (storedEmail) setEmail(storedEmail);
    if (storedCompanyId) setCompanyId(storedCompanyId);
    if (storedRoles) {
      try { setRoles(JSON.parse(storedRoles)); } catch (e) {}
    }

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

  const fetchSummaryCounts = async () => {
    setIsLoading(true);
    const cid = activeCompanyId || 'all';
    let scopeParam = viewScope === 'my' ? 'my' : 'team';
    if (viewScope === 'team') {
      if (viewScope_perm === 'DEPARTMENT') scopeParam = 'department';
      else if (viewScope_perm === 'ALL' || isSuperAdmin) scopeParam = 'all';
      else scopeParam = 'team';
    }

    let url = `${API_BASE}/api/v1/attendance/summary-count?companyId=${cid}&year=${selectedYear}&scope=${scopeParam}`;
    if (selectedMonth !== 'ALL') {
      url += `&month=${selectedMonth}`;
    }

    try {
      const res = await fetch(url, { headers: getHeaders() });
      const data = await res.json();
      if (res.ok && data.records) {
        setRecords(data.records);
      } else {
        setRecords([]);
      }
    } catch (err) {
      console.error(err);
      showToast('Error fetching attendance summary counts', 'error');
      setRecords([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (canView) {
      fetchSummaryCounts();
    }
  }, [activeCompanyId, selectedYear, selectedMonth, viewScope, canView]);

  // Derived filter calculations
  const safeRecords = Array.isArray(records) ? records : [];
  const filteredRecords = safeRecords.filter(r => {
    const empName = `${r.first_name || ''} ${r.last_name || ''}`.toLowerCase();
    const code = (r.emp_id_code || '').toLowerCase();
    const dept = (r.department_name || '').toLowerCase();
    const q = searchQuery.toLowerCase().trim();
    return !q || empName.includes(q) || code.includes(q) || dept.includes(q);
  });

  // Pagination calculation
  const totalItems = filteredRecords.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedRecords = filteredRecords.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedYear, selectedMonth, viewScope, activeCompanyId, pageSize]);

  // Stats calculation
  const totalWorkingDaysSum = safeRecords.reduce((acc, r) => acc + (Number(r.working_days) || 0), 0);
  const totalPresentDaysSum = safeRecords.reduce((acc, r) => acc + (Number(r.present_days) || 0), 0);
  const totalAbsentDaysSum = safeRecords.reduce((acc, r) => acc + (Number(r.absent_days) || 0) + (Number(r.lop_days) || 0), 0);
  const totalOvertimeMinsSum = safeRecords.reduce((acc, r) => acc + (Number(r.overtime_minutes) || 0), 0);

  // 🛑 Access Restriction Screen if View Permission is missing
  if (!canView) {
    return (
      <div className="space-y-6 animate-fadeIn w-full font-sans text-slate-800 dark:text-slate-100">
        <DashboardPageHeader
          title="Attendance Summary Count"
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
            You do not have permission (<code className="text-rose-600 bg-rose-50 dark:bg-rose-950 px-1.5 py-0.5 rounded font-mono">attendance_summary_count_view</code>) to view attendance summary count statistics. Please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn w-full font-sans text-slate-800 dark:text-slate-100 pb-16">
      <DashboardPageHeader
        title="Attendance Summary Count"
        companies={companies}
        companyId={companyId}
        handleCompanyChange={(id) => setCompanyId(id)}
        isSuperAdmin={isSuperAdmin}
        email={email}
        hideCompanySelect={false}
        hideUserBadge={true}
      />

      {/* SUMMARY STATS CARDS (TOP) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Records */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 shadow-xs hover:shadow-md transition-all duration-200 flex items-center justify-between hover:border-indigo-400">
          <div>
            <p className="text-[10.5px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Records</p>
            <h3 className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono mt-1">{safeRecords.length}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900 flex items-center justify-center text-lg">
            📊
          </div>
        </div>

        {/* Present Days */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 shadow-xs hover:shadow-md transition-all duration-200 flex items-center justify-between hover:border-emerald-400">
          <div>
            <p className="text-[10.5px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Total Present Days</p>
            <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">{totalPresentDaysSum}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 flex items-center justify-center text-lg">
            ✅
          </div>
        </div>

        {/* Absent / LOP Days */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 shadow-xs hover:shadow-md transition-all duration-200 flex items-center justify-between hover:border-rose-400">
          <div>
            <p className="text-[10.5px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider">Total Absent / LOP</p>
            <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono mt-1">{totalAbsentDaysSum}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 flex items-center justify-center text-lg">
            ❌
          </div>
        </div>

        {/* Overtime Minutes */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 shadow-xs hover:shadow-md transition-all duration-200 flex items-center justify-between hover:border-amber-400">
          <div>
            <p className="text-[10.5px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider">Total Overtime</p>
            <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono mt-1">{Math.floor(totalOvertimeMinsSum / 60)}h {totalOvertimeMinsSum % 60}m</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900 flex items-center justify-center text-lg">
            ⏱️
          </div>
        </div>
      </div>

      {/* CONTROL & FILTER HEADER */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        {/* SCOPE SWITCHER / BADGE */}
        {canSeeTeamTab ? (
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setViewScope('my')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                viewScope === 'my'
                  ? 'bg-white dark:bg-slate-900 text-[#07518a] dark:text-[#38bdf8] shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              👤 My Summary
            </button>
            <button
              onClick={() => setViewScope('team')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                viewScope === 'team'
                  ? 'bg-white dark:bg-slate-900 text-[#07518a] dark:text-[#38bdf8] shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              👥 {viewScope_perm === 'ALL' || isSuperAdmin ? 'All Employees Summary' : 'Team Summary'}
            </button>
          </div>
        ) : (
          <div className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 shrink-0">
            <span>👤 My Summary</span>
          </div>
        )}

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          {/* Search Input */}
          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search employee, ID, department..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-[#07518a] transition-all"
            />
          </div>

          {/* Year Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10.5px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Year:</span>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-black text-slate-800 dark:text-slate-100 outline-none focus:border-[#07518a] cursor-pointer"
            >
              {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Month Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10.5px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Month:</span>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-black text-slate-800 dark:text-slate-100 outline-none focus:border-[#07518a] cursor-pointer"
            >
              <option value="ALL">All Months</option>
              {MONTH_NAMES.map((m, idx) => (
                <option key={idx + 1} value={idx + 1}>{m}</option>
              ))}
            </select>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => fetchSummaryCounts()}
            disabled={isLoading}
            className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 hover:text-[#07518a] hover:border-[#07518a] transition-all cursor-pointer"
            title="Refresh Summary Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#07518a]' : ''}`} />
          </button>
        </div>
      </div>

      {/* 📊 SUMMARY TABLE */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full border-4 border-[#07518a] border-t-transparent animate-spin" />
            <span className="text-xs font-medium text-slate-400">Loading attendance summaries...</span>
          </div>
        ) : paginatedRecords.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3 text-slate-300 dark:text-slate-600">📊</div>
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">No Attendance Summary Records</h4>
            <p className="text-xs text-slate-400 mt-1">No monthly attendance cycle count found for the selected period.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  <th className="p-4 w-12 text-center">SL</th>
                  <th className="p-4">Employee</th>
                  <th className="p-4">Department</th>
                  <th className="p-4 text-center">Period</th>
                  <th className="p-4 text-center">Month Days</th>
                  <th className="p-4 text-center">Working</th>
                  <th className="p-4 text-center text-emerald-600 dark:text-emerald-400">Present</th>
                  <th className="p-4 text-center text-amber-600 dark:text-amber-400">Paid Leave</th>
                  <th className="p-4 text-center text-rose-600 dark:text-rose-400">LOP / Absent</th>
                  <th className="p-4 text-center text-blue-600 dark:text-blue-400">Weekoffs</th>
                  <th className="p-4 text-center text-purple-600 dark:text-purple-400">Holidays</th>
                  <th className="p-4 text-center text-orange-600 dark:text-orange-400">Late (Days/Mins)</th>
                  <th className="p-4 text-center text-teal-600 dark:text-teal-400">Overtime</th>
                  <th className="p-4 text-center font-black text-[#07518a] dark:text-[#38bdf8]">Final Payable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedRecords.map((r, idx) => (
                  <tr key={r.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors whitespace-nowrap">
                    <td className="p-4 text-center font-bold text-slate-400 dark:text-slate-500 font-mono text-[11px]">
                      {String(startIndex + idx + 1).padStart(2, '0')}
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-slate-800 dark:text-slate-100">
                        {r.first_name || ''} {r.last_name || ''}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">{r.emp_id_code || 'N/A'}</div>
                    </td>
                    <td className="p-4 text-slate-600 dark:text-slate-300 font-medium">
                      {r.department_name || '—'}
                    </td>
                    <td className="p-4 text-center font-bold text-slate-700 dark:text-slate-300">
                      {MONTH_NAMES[r.month - 1]?.slice(0, 3)} {r.year}
                    </td>
                    <td className="p-4 text-center font-mono font-bold text-slate-600 dark:text-slate-400">
                      {r.month_days}
                    </td>
                    <td className="p-4 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                      {r.working_days}
                    </td>
                    <td className="p-4 text-center font-mono font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/5">
                      {r.present_days}
                    </td>
                    <td className="p-4 text-center font-mono font-bold text-amber-600 dark:text-amber-400">
                      {r.paid_leave_days || 0}
                    </td>
                    <td className="p-4 text-center font-mono font-black text-rose-600 dark:text-rose-400 bg-rose-500/5">
                      {(Number(r.absent_days) || 0) + (Number(r.lop_days) || 0)}
                    </td>
                    <td className="p-4 text-center font-mono font-bold text-blue-600 dark:text-blue-400">
                      {r.weekoff_days || 0}
                    </td>
                    <td className="p-4 text-center font-mono font-bold text-purple-600 dark:text-purple-400">
                      {r.holiday_days || 0}
                    </td>
                    <td className="p-4 text-center font-mono font-bold text-orange-600 dark:text-orange-400">
                      {r.late_days || 0}d ({r.late_minutes || 0}m)
                    </td>
                    <td className="p-4 text-center font-mono font-bold text-teal-600 dark:text-teal-400">
                      {r.overtime_minutes ? `${Math.floor(r.overtime_minutes / 60)}h ${r.overtime_minutes % 60}m` : '0m'}
                    </td>
                    <td className="p-4 text-center font-mono font-black text-[#07518a] dark:text-[#38bdf8] bg-[#07518a]/5 text-sm">
                      {r.final_payable_days ?? r.working_days}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION */}
        {!isLoading && filteredRecords.length > 0 && (
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
    </div>
  );
}
