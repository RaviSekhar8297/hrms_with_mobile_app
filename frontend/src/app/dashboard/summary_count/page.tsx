'use client';

import React, { useEffect, useState } from 'react';
import DashboardPageHeader from '../components/DashboardPageHeader';
import { useDashboard } from '../components/DashboardContext';
import { usePermissions } from '../hooks/usePermissions';
import { getHeaders } from '../utils/api';
import ModernPagination from '../components/ModernPagination';
import { 
  Search, 
  RefreshCw, 
  Users, 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  Filter
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
  const { isSuperAdmin: isSuperAdminPerm } = usePermissions();

  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('superadmin') || isSuperAdminPerm;

  const [isLoading, setIsLoading] = useState(false);
  const [records, setRecords] = useState<SummaryCountRecord[]>([]);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | 'ALL'>(new Date().getMonth() + 1);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    const storedEmail = localStorage.getItem('email');
    const storedRoles = localStorage.getItem('roles');
    if (storedEmail) setEmail(storedEmail);
    if (storedRoles) {
      try { setRoles(JSON.parse(storedRoles)); } catch (e) {}
    }
  }, []);

  useEffect(() => {
    fetchSummaryCounts();
  }, [globalCompanyId, selectedYear, selectedMonth]);

  const fetchSummaryCounts = async () => {
    setIsLoading(true);
    const cid = globalCompanyId || 'all';
    let url = `/api/v1/attendance/summary-count?companyId=${cid}&year=${selectedYear}`;
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
    } finally {
      setIsLoading(false);
    }
  };

  const filteredRecords = records.filter(r => {
    const empName = `${r.first_name || ''} ${r.last_name || ''}`.toLowerCase();
    const code = (r.emp_id_code || '').toLowerCase();
    const dept = (r.department_name || '').toLowerCase();
    const q = searchQuery.toLowerCase();
    return empName.includes(q) || code.includes(q) || dept.includes(q);
  });

  const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;
  const paginatedRecords = filteredRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6 animate-fadeIn w-full font-sans text-slate-800 dark:text-slate-100 pb-16">
      <DashboardPageHeader
        title="Attendance Summary Count"
        companyId={globalCompanyId}
        isSuperAdmin={isSuperAdmin}
        email={email}
        hideCompanySelect={false}
        hideUserBadge={true}
      />


      {/* Control & Filter Header */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        {/* Filters Row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search employee, ID, department..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-[#07518a] transition-all"
              />
            </div>

            {/* Year Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Year:</span>
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
              <span className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Month:</span>
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
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Total Records: <strong className="text-slate-900 dark:text-white font-mono">{filteredRecords.length}</strong>
            </div>

            <button
              onClick={fetchSummaryCounts}
              title="Refresh"
              aria-label="Refresh"
              className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center justify-center cursor-pointer shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#07518a]' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Summary Count Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-8 h-8 border-4 border-[#07518a] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Loading Attendance Summary Count...</p>
          </div>
        ) : paginatedRecords.length === 0 ? (
          <div className="p-12 text-center space-y-1">
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">No Data Found</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No summary counts available for the selected period.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-sans">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/80 text-[10.5px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4 w-12 text-center">#</th>
                  <th className="py-3.5 px-4">Employee</th>
                  <th className="py-3.5 px-4">Department</th>
                  <th className="py-3.5 px-4">Period</th>
                  <th className="py-3.5 px-4 text-center">Month Days</th>
                  <th className="py-3.5 px-4 text-center">Present</th>
                  <th className="py-3.5 px-4 text-center">Half Days</th>
                  <th className="py-3.5 px-4 text-center">Absent</th>
                  <th className="py-3.5 px-4 text-center">Paid Leave</th>
                  <th className="py-3.5 px-4 text-center">LOP</th>
                  <th className="py-3.5 px-4 text-center">Weekoff/Holidays</th>
                  <th className="py-3.5 px-4 text-center">Payable Days</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                {paginatedRecords.map((r, idx) => {
                  const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                  const monthName = MONTH_NAMES[r.month - 1] || `M${r.month}`;

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 text-center font-bold text-slate-400">{globalIdx}</td>
                      <td className="py-3.5 px-4">
                        <div>
                          <span className="font-bold text-slate-900 dark:text-slate-100 block">
                            {r.first_name} {r.last_name}
                          </span>
                          {r.emp_id_code && (
                            <span className="text-[10px] font-mono text-slate-400">{r.emp_id_code}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 font-medium">
                        {r.department_name || '-'}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-[#07518a] dark:text-[#38bdf8]">
                        {monthName} {r.year}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-700 dark:text-slate-300">
                        {r.month_days || 0}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-emerald-600 dark:text-emerald-400">
                        {r.present_days || 0}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-amber-600 dark:text-amber-400">
                        {r.half_days || 0}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-rose-600 dark:text-rose-400">
                        {r.absent_days || 0}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-blue-600 dark:text-blue-400">
                        {r.paid_leave_days || 0}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-rose-700 dark:text-rose-300">
                        {r.lop_days || 0}
                      </td>
                      <td className="py-3.5 px-4 text-center font-medium text-slate-500">
                        {(Number(r.weekoff_days) || 0) + (Number(r.holiday_days) || 0)}
                      </td>
                      <td className="py-3.5 px-4 text-center font-black text-indigo-600 dark:text-indigo-400">
                        {r.final_payable_days || r.cycle_payable_days || 0}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {filteredRecords.length > pageSize && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800">
            <ModernPagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={filteredRecords.length}
              startIndex={(currentPage - 1) * pageSize + 1}
              endIndex={Math.min(currentPage * pageSize, filteredRecords.length)}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
