'use client';

import React, { useEffect, useState } from 'react';
import DashboardPageHeader from '../components/DashboardPageHeader';
import { getHeaders } from '../utils/api';
import { useDashboard } from '../components/DashboardContext';
import { 
  Calendar, 
  Search, 
  Download, 
  Users, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle,
  FileSpreadsheet,
  Filter
} from 'lucide-react';

interface Company {
  id: string;
  name: string;
  subdomain: string;
  status: string;
  created_at: string;
}

interface SummaryRecord {
  id: string;
  employee_id: string;
  emp_id?: string;
  emp_id_code?: string;
  first_name?: string;
  last_name?: string;
  employee_name?: string;
  department_name?: string;
  date: string;
  attendance_date?: string;
  shift_name?: string;
  shift_start_time?: string;
  shift_end_time?: string;
  shift_grace_in?: number;
  first_in?: string;
  last_out?: string;
  status: string;
  worked_minutes?: number;
  late_minutes?: number;
  overtime_minutes?: number;
  company_name?: string;
}

const MONTH_NAMES = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

export default function AttendanceSummaryPage() {
  const { showToast } = useDashboard();
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('superadmin');

  // Month and Year Filters
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Data
  const [records, setRecords] = useState<SummaryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Sync Month & Year selection with startDate and endDate
  useEffect(() => {
    const startStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
    const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
    const endStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    setStartDate(startStr);
    setEndDate(endStr);
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    const storedRoles = JSON.parse(localStorage.getItem('roles') || '[]');
    const storedEmail = localStorage.getItem('email');
    const storedCompanyId = localStorage.getItem('companyId');
    if (storedRoles) setRoles(storedRoles);
    if (storedEmail) setEmail(storedEmail);
    if (storedCompanyId) setCompanyId(storedCompanyId);
  }, []);

  const fetchCompanies = async () => {
    try {
      const res = await fetch('/api/v1/companies', { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.companies || []);
        setCompanies(list);
      }
    } catch (err) {
      console.error('Error fetching companies:', err);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      fetchCompanies();
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (startDate && endDate) {
      fetchSummaryData();
    }
  }, [companyId, startDate, endDate]);

  const fetchSummaryData = async () => {
    setLoading(true);
    try {
      let url = `/api/v1/attendance/summary?startDate=${startDate}&endDate=${endDate}`;
      if (companyId && companyId !== 'all') url += `&companyId=${companyId}`;

      const res = await fetch(url, { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) {
        const list = data.attendanceSummary || data.records || data.summary || data.data || (Array.isArray(data) ? data : []);
        setRecords(list);
      } else {
        setRecords([]);
      }
    } catch (err) {
      console.error('Error fetching attendance summary:', err);
      showToast('Error loading attendance summary records', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Pagination state (options: 50, 100, 200, 500)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const formatTimeOnly = (timeStr?: string) => {
    if (!timeStr) return '--:--';
    const str = String(timeStr).replace('T', ' ').replace(/\.000Z$/, '').replace(/Z$/, '');
    const parts = str.split(' ');
    if (parts.length >= 2) {
      const timePieces = parts[1].split(':');
      if (timePieces.length >= 2) {
        let hour = parseInt(timePieces[0], 10);
        const minute = timePieces[1];
        const ampm = hour >= 12 ? 'PM' : 'AM';
        hour = hour % 12 || 12;
        return `${String(hour).padStart(2, '0')}:${minute} ${ampm}`;
      }
    }
    const d = new Date(timeStr);
    if (isNaN(d.getTime())) return String(timeStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatDateDisplay = (dateStr?: string) => {
    if (!dateStr) return '-';
    const cleanStr = String(dateStr).split('T')[0];
    const parts = cleanStr.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts;
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const mIdx = parseInt(m, 10) - 1;
      if (mIdx >= 0 && mIdx < 12) {
        return `${d.padStart(2, '0')}-${monthNames[mIdx]}-${y}`;
      }
    }
    return cleanStr;
  };

  const getDerivedStatus = (r: SummaryRecord) => {
    const hasOutTime = r.last_out && r.last_out !== '--:--' && r.last_out !== 'null';
    const workedMins = r.worked_minutes || 0;
    if (!hasOutTime || workedMins < 240) {
      return 'ABSENT';
    }
    if (workedMins >= 420) {
      return 'PRESENT';
    }
    if (workedMins >= 240) {
      return 'HALF_DAY';
    }
    return (r.status || 'ABSENT').toUpperCase();
  };

  const getDerivedLateMins = (r: SummaryRecord) => {
    const startTime = r.shift_start_time || '09:30:00';
    const graceIn = typeof r.shift_grace_in === 'number' ? r.shift_grace_in : 15;
    
    if (!r.first_in) return 0;
    
    let ph = -1;
    let pm = -1;
    const str = String(r.first_in).replace('T', ' ').replace(/\.000Z$/, '').replace(/Z$/, '');
    const parts = str.split(' ');
    const timePart = parts.length >= 2 ? parts[1] : parts[0];
    if (timePart && timePart.includes(':')) {
      const pieces = timePart.split(':');
      ph = parseInt(pieces[0], 10);
      pm = parseInt(pieces[1], 10);
    }

    if (ph >= 0 && pm >= 0) {
      const [sh, sm] = startTime.split(':').map((v: string) => parseInt(v, 10));
      const punchMins = ph * 60 + pm;
      const shiftStartMins = sh * 60 + sm;
      const graceDeadlineMins = shiftStartMins + graceIn;

      if (punchMins > graceDeadlineMins) {
        return punchMins - shiftStartMins;
      }
      return 0;
    }

    return typeof r.late_minutes === 'number' ? r.late_minutes : 0;
  };

  const handleCompanyChange = (id: string) => {
    const val = id || null;
    setCompanyId(val);
    if (val) localStorage.setItem('companyId', val);
    else localStorage.removeItem('companyId');
  };

  const filteredRecords = records.filter(r => {
    const status = getDerivedStatus(r);
    if (statusFilter !== 'ALL' && status !== statusFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const empName = `${r.first_name || ''} ${r.last_name || ''} ${r.employee_name || ''}`.toLowerCase();
    const code = (r.emp_id_code || r.emp_id || '').toLowerCase();
    return empName.includes(q) || code.includes(q);
  });

  // Calculate totals
  const totalRecords = filteredRecords.length;
  const presentCount = filteredRecords.filter(r => getDerivedStatus(r) === 'PRESENT').length;
  const absentCount = filteredRecords.filter(r => getDerivedStatus(r) === 'ABSENT').length;
  const lateCount = filteredRecords.filter(r => (r.late_minutes || 0) > 0).length;
  const leaveCount = filteredRecords.filter(r => getDerivedStatus(r).includes('LEAVE')).length;

  // Pagination calculation
  const totalItems = filteredRecords.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedRecords = filteredRecords.slice(startIndex, endIndex);

  const exportToCSV = () => {
    if (filteredRecords.length === 0) {
      showToast('No records available to export', 'error');
      return;
    }

    const headers = ['Employee Code', 'Employee Name', 'Department', 'Date', 'Shift', 'First In', 'Last Out', 'Status', 'Worked Hours', 'Late Mins'];
    const rows = filteredRecords.map(r => [
      `"${r.emp_id_code || r.emp_id || ''}"`,
      `"${r.first_name || ''} ${r.last_name || ''}"`.trim() || `"${r.employee_name || ''}"`,
      `"${r.department_name || ''}"`,
      `"${r.date || r.attendance_date || ''}"`,
      `"${r.shift_name || 'General'}"`,
      `"${r.first_in || '-'}"`,
      `"${r.last_out || '-'}"`,
      `"${r.status || 'PRESENT'}"`,
      `"${r.worked_minutes ? (r.worked_minutes / 60).toFixed(2) : '0'}"`,
      `"${r.late_minutes || 0}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance_summary_${selectedYear}_${selectedMonth}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Attendance summary exported successfully!', 'success');
  };

  const yearOptions = [2024, 2025, 2026, 2027];

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="space-y-4 animate-fadeIn w-full pb-16 text-left">
      <DashboardPageHeader
        title="Attendance Summary"
        actionMessage=""
        actionError=""
        companies={companies}
        companyId={companyId}
        handleCompanyChange={handleCompanyChange}
        isSuperAdmin={isSuperAdmin}
        email={email}
        hideCompanySelect={!isSuperAdmin}
        hideUserBadge={true}
      />

      {/* Inline Keyframes for Smooth Inner Slide Wave Animation */}
      <style>{`
        @keyframes innerSlideGlow {
          0% { transform: translateX(-120%); }
          40% { transform: translateX(120%); }
          100% { transform: translateX(120%); }
        }
      `}</style>

      {/* Summary KPI Cards with Inner Sliding Wave Animations */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Logs Card */}
        <div className="group relative rounded-xl bg-gradient-to-br from-indigo-50/95 via-sky-50/30 to-white dark:from-indigo-950/40 dark:via-slate-900 dark:to-slate-900 border border-indigo-200/70 dark:border-indigo-800/60 p-4 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 cursor-pointer overflow-hidden backdrop-blur-xs">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 dark:via-indigo-400/10 to-transparent -translate-x-full pointer-events-none z-0" style={{ animation: 'innerSlideGlow 3.5s ease-in-out infinite' }} />
          <div className="absolute -top-6 -right-6 w-20 h-20 bg-indigo-500/10 rounded-full blur-md group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
          <div className="flex items-center justify-between relative z-10">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Logs</span>
            <div className="h-8 w-8 rounded-xl bg-indigo-100/80 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 flex items-center justify-center border border-indigo-200/80 dark:border-indigo-700/80 group-hover:scale-115 group-hover:rotate-6 transition-all duration-300 shadow-xs">
              <Users size={16} />
            </div>
          </div>
          <div className="mt-2 font-mono text-2xl font-black text-slate-900 dark:text-white tracking-tight relative z-10">{totalRecords}</div>
        </div>

        {/* Present Card */}
        <div className="group relative rounded-xl bg-gradient-to-br from-emerald-50/95 via-teal-50/30 to-white dark:from-emerald-950/40 dark:via-slate-900 dark:to-slate-900 border border-emerald-200/70 dark:border-emerald-800/60 p-4 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 cursor-pointer overflow-hidden backdrop-blur-xs">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 dark:via-emerald-400/10 to-transparent -translate-x-full pointer-events-none z-0" style={{ animation: 'innerSlideGlow 3.5s ease-in-out infinite', animationDelay: '0.8s' }} />
          <div className="absolute -top-6 -right-6 w-20 h-20 bg-emerald-500/10 rounded-full blur-md group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
          <div className="flex items-center justify-between relative z-10">
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Present</span>
            <div className="h-8 w-8 rounded-xl bg-emerald-100/80 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 flex items-center justify-center border border-emerald-200/80 dark:border-emerald-700/80 group-hover:scale-115 group-hover:rotate-6 transition-all duration-300 shadow-xs">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="mt-2 font-mono text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight relative z-10">{presentCount}</div>
        </div>

        {/* Absent Card */}
        <div className="group relative rounded-xl bg-gradient-to-br from-rose-50/95 via-pink-50/30 to-white dark:from-rose-950/40 dark:via-slate-900 dark:to-slate-900 border border-rose-200/70 dark:border-rose-800/60 p-4 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 cursor-pointer overflow-hidden backdrop-blur-xs">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 dark:via-rose-400/10 to-transparent -translate-x-full pointer-events-none z-0" style={{ animation: 'innerSlideGlow 3.5s ease-in-out infinite', animationDelay: '1.6s' }} />
          <div className="absolute -top-6 -right-6 w-20 h-20 bg-rose-500/10 rounded-full blur-md group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
          <div className="flex items-center justify-between relative z-10">
            <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Absent</span>
            <div className="h-8 w-8 rounded-xl bg-rose-100/80 dark:bg-rose-900/60 text-rose-600 dark:text-rose-300 flex items-center justify-center border border-rose-200/80 dark:border-rose-700/80 group-hover:scale-115 group-hover:rotate-6 transition-all duration-300 shadow-xs">
              <XCircle size={16} />
            </div>
          </div>
          <div className="mt-2 font-mono text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tight relative z-10">{absentCount}</div>
        </div>

        {/* Late Arrivals Card */}
        <div className="group relative rounded-xl bg-gradient-to-br from-amber-50/95 via-orange-50/30 to-white dark:from-amber-950/40 dark:via-slate-900 dark:to-slate-900 border border-amber-200/70 dark:border-amber-800/60 p-4 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 cursor-pointer overflow-hidden backdrop-blur-xs">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 dark:via-amber-400/10 to-transparent -translate-x-full pointer-events-none z-0" style={{ animation: 'innerSlideGlow 3.5s ease-in-out infinite', animationDelay: '2.4s' }} />
          <div className="absolute -top-6 -right-6 w-20 h-20 bg-amber-500/10 rounded-full blur-md group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
          <div className="flex items-center justify-between relative z-10">
            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Late Arrivals</span>
            <div className="h-8 w-8 rounded-xl bg-amber-100/80 dark:bg-amber-900/60 text-amber-600 dark:text-amber-300 flex items-center justify-center border border-amber-200/80 dark:border-amber-700/80 group-hover:scale-115 group-hover:rotate-6 transition-all duration-300 shadow-xs">
              <Clock size={16} />
            </div>
          </div>
          <div className="mt-2 font-mono text-2xl font-black text-amber-600 dark:text-amber-400 tracking-tight relative z-10">{lateCount}</div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-2xs space-y-4">
        
        {/* Controls Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <FileSpreadsheet size={16} className="text-indigo-500" />
              <span>Attendance Summary Audit Table</span>
            </h3>
            <p className="text-[11px] text-slate-400">Detailed overview of employee attendance logs and timesheets</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            {/* Month Selector */}
            <div className="flex items-center gap-1">
              <Calendar size={14} className="text-slate-400" />
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(parseInt(e.target.value))}
                className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 cursor-pointer"
              >
                {MONTH_NAMES.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* Year Selector */}
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(parseInt(e.target.value))}
              className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 cursor-pointer"
            >
              {yearOptions.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="ALL">All Status</option>
              <option value="PRESENT">Present</option>
              <option value="ABSENT">Absent</option>
              <option value="HALF_DAY">Half Day</option>
              <option value="LATE">Late</option>
            </select>

            {/* Search Input */}
            <div className="relative flex-1 sm:w-48">
              <Search size={14} className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search staff, code..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs outline-none focus:border-indigo-500 font-medium"
              />
            </div>

            {/* Export CSV Icon Button */}
            <button
              onClick={exportToCSV}
              title="Export CSV"
              className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-xs cursor-pointer flex items-center justify-center"
            >
              <Download size={16} />
            </button>
          </div>
        </div>

        {/* Table Container with Inner Scroll */}
        <div className="overflow-x-auto overflow-y-auto max-h-[550px] rounded-lg border border-slate-200/70 dark:border-slate-800 shadow-inner scrollbar-thin">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-slate-100/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider text-[10px] z-10 shadow-xs">
              <tr>
                <th className="py-2.5 px-3">Employee Name</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Shift</th>
                <th className="py-2.5 px-3 text-center">Shift Start</th>
                <th className="py-2.5 px-3 text-center">Shift End</th>
                <th className="py-2.5 px-3 text-center">Grace Time</th>
                <th className="py-2.5 px-3 text-center">First In</th>
                <th className="py-2.5 px-3 text-center">Last Out</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Worked Hrs</th>
                <th className="py-2.5 px-3 text-right">Late Mins</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white/50 dark:bg-slate-900/50">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-400 font-medium">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                      <span>Loading summary records...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-400 font-medium">
                    No attendance summary records found for selected month ({MONTH_NAMES.find(m => m.value === selectedMonth)?.label} {selectedYear}).
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((r, idx) => {
                  const derivedStatus = getDerivedStatus(r);
                  const isPresent = derivedStatus === 'PRESENT';
                  const isAbsent = derivedStatus === 'ABSENT';
                  const isHalfDay = derivedStatus === 'HALF_DAY';
                  const empCode = r.emp_id_code || r.emp_id || '';
                  const shiftStartFormatted = formatTimeOnly(r.shift_start_time || '09:30:00');
                  const shiftEndFormatted = formatTimeOnly(r.shift_end_time || '18:30:00');
                  const graceInFormatted = `${r.shift_grace_in ?? 15} mins`;

                  return (
                    <tr key={r.id || idx} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100">
                        {`${r.first_name || ''} ${r.last_name || ''}`.trim() || r.employee_name || 'Employee'}
                        {empCode && (
                          <span className="block text-[10px] text-slate-400 font-mono font-normal">
                            {empCode}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {formatDateDisplay(r.attendance_date || r.date)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 font-medium whitespace-nowrap">
                        {r.shift_name || 'General Shift'}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">
                        {shiftStartFormatted}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">
                        {shiftEndFormatted}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-600 dark:text-slate-400 text-[11px] whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 font-semibold">
                          {graceInFormatted}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">
                        {formatTimeOnly(r.first_in)}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">
                        {formatTimeOnly(r.last_out)}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                          isPresent
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300'
                            : isAbsent
                            ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950 dark:text-rose-300'
                            : isHalfDay
                            ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300'
                        }`}>
                          {derivedStatus}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {r.worked_minutes ? (r.worked_minutes / 60).toFixed(1) + ' hrs' : '0.0 hrs'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                        {getDerivedLateMins(r)} mins
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION FOOTER */}
        {totalItems > 0 && (
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 font-medium">
              <span>Showing <strong className="text-slate-800 dark:text-slate-200 font-mono">{startIndex + 1}</strong> to <strong className="text-slate-800 dark:text-slate-200 font-mono">{endIndex}</strong> of <strong className="text-slate-800 dark:text-slate-200 font-mono">{totalItems}</strong> entries</span>
              
              <div className="flex items-center gap-1.5 ml-2">
                <span className="text-[11px] font-semibold text-slate-400">Rows:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 font-mono font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={500}>500</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                Previous
              </button>

              <span className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 text-indigo-600 dark:text-indigo-400 font-mono font-bold">
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
