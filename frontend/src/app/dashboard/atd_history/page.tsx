'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useDashboard } from '../components/DashboardContext';
import { getHeaders } from '../utils/api';
import { usePermissions } from '../hooks/usePermissions';
import ModernPagination from '../components/ModernPagination';

interface Employee {
  id: string;
  emp_id_code?: string;
  emp_code?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  email?: string;
  profile_picture_url?: string;
  department_name?: string;
  department_id?: string;
  department?: string;
  reporting_to_id?: string;
  reporting_to?: string;
}

interface SummaryRecord {
  id?: string;
  employee_id: string;
  attendance_date: string;
  status?: string;
  worked_minutes?: number;
  late_minutes?: number;
  first_in?: string;
  last_out?: string;
}

interface RawPunch {
  id?: string;
  employee_id: string;
  punch_time: string;
}

interface Holiday {
  id?: string;
  holiday_date?: string;
  date?: string;
  title?: string;
  name?: string;
}

interface LeaveRequest {
  id?: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  status: string;
  leave_type_code?: string;
  leave_type?: string;
}

const MONTHS = [
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

const YEARS = Array.from({ length: 11 }, (_, i) => 2020 + i);

export default function AttendanceHistoryPage() {
  const { showToast, companyId: globalCompanyId } = useDashboard();
  const { getPermissionScope, isSuperAdmin } = usePermissions();
  const attendanceScope = getPermissionScope('view_attendance_summary');
  const isSelfScope = !isSuperAdmin && attendanceScope === 'SELF';
  const isTeamScope = !isSuperAdmin && (attendanceScope === 'TEAM' || attendanceScope === 'REPORTING');
  const isDeptScope = !isSuperAdmin && attendanceScope === 'DEPARTMENT';
  
  // Date State Initialization (Default to current month & year)
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());

  // View Controls State
  const [viewMode, setViewMode] = useState<'icon' | 'name'>('icon');
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Data State
  const [loading, setLoading] = useState<boolean>(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendanceSummaries, setAttendanceSummaries] = useState<SummaryRecord[]>([]);
  const [rawPunches, setRawPunches] = useState<RawPunch[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [weekoffPolicy, setWeekoffPolicy] = useState<any>(null);

  const currentUserEmail = (typeof window !== 'undefined' ? localStorage.getItem('email') : '') || '';
  const currentEmp = useMemo(() => {
    return employees.find(e => (e as any).email?.toLowerCase() === currentUserEmail.toLowerCase());
  }, [employees, currentUserEmail]);

  // Compute scoped employees list for Attendance History
  const scopedEmployees = useMemo(() => {
    if (isSuperAdmin || attendanceScope === 'ALL') {
      return employees;
    }
    if (!currentEmp) {
      return employees;
    }
    if (isSelfScope) {
      return [currentEmp];
    }
    if (isTeamScope) {
      return employees.filter(e =>
        e.id === currentEmp.id ||
        (e as any).reporting_to_id === currentEmp.id ||
        (e as any).reporting_to === currentEmp.id
      );
    }
    if (isDeptScope) {
      return employees.filter(e =>
        e.id === currentEmp.id ||
        ((e as any).department_id && (currentEmp as any).department_id && (e as any).department_id === (currentEmp as any).department_id) ||
        (e.department_name && currentEmp.department_name && e.department_name.toLowerCase() === currentEmp.department_name.toLowerCase()) ||
        ((e as any).department && (currentEmp as any).department && (e as any).department.toLowerCase() === (currentEmp as any).department.toLowerCase())
      );
    }
    return employees;
  }, [employees, isSuperAdmin, attendanceScope, isSelfScope, isTeamScope, isDeptScope, currentEmp]);

  const isDynamicWeekoff = (dateObj: Date) => {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayIndex = dateObj.getDay();
    const dayName = dayNames[dayIndex];
    const dayNum = dateObj.getDate();
    const weekIndex = Math.ceil(dayNum / 7);

    if (!weekoffPolicy) {
      if (dayIndex === 0) return true;
      if (dayIndex === 6 && (weekIndex === 2 || weekIndex === 4)) return true;
      return false;
    }

    const rawOffDays = weekoffPolicy.off_days || [];
    const offDays: string[] = typeof rawOffDays === 'string'
      ? JSON.parse(rawOffDays)
      : (Array.isArray(rawOffDays) ? rawOffDays : []);

    const rawAltRules = weekoffPolicy.alternate_rules || {};
    const altRules = typeof rawAltRules === 'string'
      ? JSON.parse(rawAltRules)
      : (rawAltRules || {});

    const isOffConfigured = offDays.some((d: any) => {
      if (typeof d === 'string') return d.toLowerCase() === dayName.toLowerCase();
      if (typeof d === 'number') return d === dayIndex;
      return false;
    });

    if (!isOffConfigured) return false;

    const activeWeeks = altRules[dayName] || altRules[dayName.toLowerCase()] || altRules[dayIndex];
    if (Array.isArray(activeWeeks) && activeWeeks.length > 0) {
      return activeWeeks.includes(weekIndex);
    }

    return true;
  };

  // Step 2: loadAllAttendanceHistoryData (Concurrent 6 API calls)
  const loadAllAttendanceHistoryData = async () => {
    setLoading(true);
    try {
      const cid = globalCompanyId || localStorage.getItem('companyId');
      const companyParam = cid && cid !== 'all' ? `&companyId=${cid}&company_id=${cid}` : '';

      const startDayStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
      const daysCount = new Date(selectedYear, selectedMonth, 0).getDate();
      const endDayStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(daysCount).padStart(2, '0')}`;

      const headers = getHeaders();

      const [empRes, summaryRes, punchesRes, holidayRes, leaveRes, weekoffRes] = await Promise.allSettled([
        fetch(`/api/v1/employees?limit=500${companyParam}`, { headers }),
        fetch(`/api/v1/attendance/summary?startDate=${startDayStr}&endDate=${endDayStr}${companyParam}`, { headers }),
        fetch(`/api/v1/attendance/raw-punches?startDate=${startDayStr}&endDate=${endDayStr}${companyParam}`, { headers }),
        fetch(`/api/v1/holidays?year=${selectedYear}${companyParam}`, { headers }),
        fetch(`/api/v1/leave-requests?startDate=${startDayStr}&endDate=${endDayStr}${companyParam}`, { headers }),
        fetch(`/api/v1/weekoffs?${companyParam.replace(/^&/, '')}`, { headers }),
      ]);

      // Parse Employees
      if (empRes.status === 'fulfilled' && empRes.value.ok) {
        const empData = await empRes.value.json();
        const list = empData.employees || empData.records || empData.data || (Array.isArray(empData) ? empData : []);
        setEmployees(list);
      }

      // Parse Summary Records
      if (summaryRes.status === 'fulfilled' && summaryRes.value.ok) {
        const sumData = await summaryRes.value.json();
        const list = sumData.attendanceSummary || sumData.records || sumData.summary || sumData.data || (Array.isArray(sumData) ? sumData : []);
        setAttendanceSummaries(list);
      }

      // Parse Raw Punches
      if (punchesRes.status === 'fulfilled' && punchesRes.value.ok) {
        const pData = await punchesRes.value.json();
        const list = pData.punches || pData.records || pData.data || (Array.isArray(pData) ? pData : []);
        setRawPunches(list);
      }

      // Parse Holidays
      if (holidayRes.status === 'fulfilled' && holidayRes.value.ok) {
        const hData = await holidayRes.value.json();
        const list = hData.holidays || hData.records || hData.data || (Array.isArray(hData) ? hData : []);
        setHolidays(list);
      }

      // Parse Leave Requests
      if (leaveRes.status === 'fulfilled' && leaveRes.value.ok) {
        const lData = await leaveRes.value.json();
        const list = lData.leaveRequests || lData.requests || lData.data || (Array.isArray(lData) ? lData : []);
        setLeaveRequests(list);
      }

      // Parse Week-off Policy
      if (weekoffRes.status === 'fulfilled' && weekoffRes.value.ok) {
        const wData = await weekoffRes.value.json();
        const policyObj = wData.weekoff || wData.policy || (Array.isArray(wData.weekoffs) ? wData.weekoffs[0] : null);
        setWeekoffPolicy(policyObj || null);
      }
    } catch (err) {
      console.error('Error loading attendance history data:', err);
      showToast('Failed to load attendance history data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllAttendanceHistoryData();
  }, [selectedMonth, selectedYear, globalCompanyId]);

  // Days list in selected month
  const daysInMonth = useMemo(() => {
    const count = new Date(selectedYear, selectedMonth, 0).getDate();
    return Array.from({ length: count }, (_, i) => {
      const dayNum = i + 1;
      const dateObj = new Date(selectedYear, selectedMonth - 1, dayNum);
      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
      const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const dayOfWeek = dateObj.getDay(); // 0 = Sun, 6 = Sat
      return { dayNum, dayName, dateStr, dayOfWeek, dateObj };
    });
  }, [selectedMonth, selectedYear]);

  // Check 2nd and 4th Saturday helper
  const isSecondOrFourthSaturday = (dateObj: Date) => {
    if (dateObj.getDay() !== 6) return false;
    const dayOfMonth = dateObj.getDate();
    const weekIndex = Math.ceil(dayOfMonth / 7);
    return weekIndex === 2 || weekIndex === 4;
  };

  // Maps for efficient O(1) lookup per employee & date
  const summariesMap = useMemo(() => {
    const map = new Map<string, SummaryRecord>();
    attendanceSummaries.forEach((s) => {
      const cleanDate = String(s.attendance_date).split('T')[0];
      map.set(`${s.employee_id}_${cleanDate}`, s);
    });
    return map;
  }, [attendanceSummaries]);

  const rawPunchesSet = useMemo(() => {
    const set = new Set<string>();
    rawPunches.forEach((p) => {
      const cleanDate = String(p.punch_time).split('T')[0];
      set.add(`${p.employee_id}_${cleanDate}`);
    });
    return set;
  }, [rawPunches]);

  const holidaySet = useMemo(() => {
    const map = new Map<string, string>();
    holidays.forEach((h) => {
      const d = (h.holiday_date || h.date || '').split('T')[0];
      if (d) map.set(d, h.title || h.name || 'Holiday');
    });
    return map;
  }, [holidays]);

  const leavesMap = useMemo(() => {
    const map = new Map<string, string>();
    leaveRequests.forEach((l) => {
      if (String(l.status).toUpperCase() === 'APPROVED') {
        const start = new Date(l.start_date);
        const end = new Date(l.end_date);
        const typeCode = (l.leave_type_code || l.leave_type || 'L').toUpperCase();
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          map.set(`${l.employee_id}_${dStr}`, typeCode);
        }
      }
    });
    return map;
  }, [leaveRequests]);

  // Step 3: Matrix Calculation per Employee per Day
  const getDayStatus = (empId: string, day: { dayNum: number; dayName: string; dateStr: string; dayOfWeek: number; dateObj: Date }) => {
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const isFuture = day.dateStr > todayStr;

    // 1. Holiday Check
    if (holidaySet.has(day.dateStr)) {
      return { code: 'H', label: holidaySet.get(day.dateStr) || 'Holiday', type: 'HOLIDAY' };
    }

    // 2. Week Off Check (100% Dynamic from DB Policy)
    if (isDynamicWeekoff(day.dateObj)) {
      return { code: 'WO', label: 'Week Off', type: 'WEEKOFF' };
    }

    // 3. Leave Check
    const leaveCode = leavesMap.get(`${empId}_${day.dateStr}`);
    if (leaveCode) {
      return { code: leaveCode, label: `Leave (${leaveCode})`, type: 'LEAVE' };
    }

    // 4. Attendance Summary Check
    const summary = summariesMap.get(`${empId}_${day.dateStr}`);
    const hasPunch = rawPunchesSet.has(`${empId}_${day.dateStr}`);

    if (summary) {
      const statusUpper = (summary.status || '').toUpperCase();
      const workedMins = summary.worked_minutes || 0;
      const lateMins = summary.late_minutes || 0;

      if (statusUpper === 'PRESENT' || workedMins >= 420 || (summary.first_in && summary.first_in !== '--:--')) {
        if (lateMins > 0) {
          return { code: 'L', label: `Late (${lateMins}m)`, type: 'LATE', summary };
        }
        if (workedMins >= 240 && workedMins < 420) {
          return { code: 'Hd', label: 'Half Day', type: 'HALFDAY', summary };
        }
        return { code: 'P', label: 'Present', type: 'PRESENT', summary };
      }

      if (statusUpper === 'LEAVE') {
        return { code: 'L', label: 'Leave', type: 'LEAVE', summary };
      }

      if (statusUpper === 'HALF_DAY' || statusUpper === 'HALF DAY') {
        return { code: 'Hd', label: 'Half Day', type: 'HALFDAY', summary };
      }
    }

    if (hasPunch) {
      return { code: 'P', label: 'Present (Punched)', type: 'PRESENT' };
    }

    // Future date
    if (isFuture) {
      return { code: '·', label: 'Upcoming', type: 'FUTURE' };
    }

    // Past working day without punch = Absent
    return { code: 'A', label: 'Absent', type: 'ABSENT' };
  };

  // Step 4: Filtering & Pagination
  const filteredEmployees = useMemo(() => {
    return scopedEmployees.filter((emp) => {
      const fullName = `${emp.first_name || ''} ${emp.last_name || ''} ${emp.name || ''}`.toLowerCase();
      const code = (emp.emp_id_code || emp.emp_code || '').toLowerCase();
      const dept = (emp.department_name || emp.department || '').toLowerCase();
      const query = searchQuery.toLowerCase().trim();
      return !query || fullName.includes(query) || code.includes(query) || dept.includes(query);
    });
  }, [scopedEmployees, searchQuery]);

  const totalEntries = filteredEmployees.length;
  const totalPages = Math.ceil(totalEntries / pageSize) || 1;
  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEmployees.slice(start, start + pageSize);
  }, [filteredEmployees, currentPage, pageSize]);

  // Handle page change reset when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, pageSize, selectedMonth, selectedYear]);

  // Step 5: Export CSV / Excel
  const handleExportCSV = () => {
    if (scopedEmployees.length === 0) {
      showToast('No employee data available to export', 'error');
      return;
    }

    const monthLabel = MONTHS.find((m) => m.value === selectedMonth)?.label || 'Month';
    const dayHeaders = daysInMonth.map((d) => `"${d.dayNum} ${d.dayName}"`).join(',');

    let csvContent = `EMPLOYEE CODE,EMPLOYEE NAME,DEPARTMENT,${dayHeaders},TOTAL PRESENT,TOTAL ABSENT,TOTAL LEAVES,TOTAL WO,TOTAL HOLIDAYS\n`;

    scopedEmployees.forEach((emp) => {
      const code = emp.emp_id_code || emp.emp_code || '';
      const name = `${emp.first_name || ''} ${emp.last_name || ''} ${emp.name || ''}`.trim();
      const dept = emp.department_name || emp.department || '';

      let countP = 0, countA = 0, countL = 0, countWO = 0, countH = 0;

      const dayStatuses = daysInMonth.map((day) => {
        const st = getDayStatus(emp.id, day);
        if (st.type === 'PRESENT' || st.type === 'LATE' || st.type === 'HALFDAY') countP++;
        else if (st.type === 'ABSENT') countA++;
        else if (st.type === 'LEAVE') countL++;
        else if (st.type === 'WEEKOFF') countWO++;
        else if (st.type === 'HOLIDAY') countH++;
        return `"${st.code}"`;
      });

      csvContent += `"${code}","${name}","${dept}",${dayStatuses.join(',')},${countP},${countA},${countL},${countWO},${countH}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Attendance_History_${monthLabel}_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported Attendance History successfully!', 'success');
  };

  // Avatar Initial Color Generator
  const getAvatarGradient = (str: string) => {
    const gradients = [
      'from-purple-600 to-indigo-600',
      'from-blue-600 to-cyan-600',
      'from-pink-600 to-rose-600',
      'from-amber-500 to-orange-600',
      'from-emerald-600 to-teal-600',
      'from-violet-600 to-purple-600',
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    const index = Math.abs(hash) % gradients.length;
    return gradients[index];
  };

  return (
    <div className="space-y-4 animate-fadeIn w-full font-sans">
      {/* Main Page Title Banner */}
      <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
        <h1 className="text-lg md:text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
          ATTENDANCE ENGINE – HISTORY
        </h1>
        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
          Monthly day-by-day attendance status grid for all employees
        </p>
      </div>

      {/* Legend Note Bar */}
      <div className="bg-white dark:bg-slate-900 px-3.5 py-2 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
        <span className="text-slate-900 dark:text-white font-black tracking-wider uppercase text-[10.5px] mr-0.5">
          NOTE:
        </span>
        
        {/* Holiday (H) */}
        <div className="flex items-center gap-1.5">
          <span className="text-purple-600 text-sm">★</span>
          <span>➜ Holiday (H)</span>
        </div>

        <span className="text-slate-300 dark:text-slate-700">|</span>

        {/* Day Off (WO) */}
        <div className="flex items-center gap-1.5">
          <span className="text-emerald-500 text-sm">🗓️</span>
          <span>➜ Day Off (WO)</span>
        </div>

        <span className="text-slate-300 dark:text-slate-700">|</span>

        {/* Present (P) */}
        <div className="flex items-center gap-1.5">
          <span className="text-emerald-600 font-bold">✓</span>
          <span>➜ Present (≥9h) (P)</span>
        </div>

        <span className="text-slate-300 dark:text-slate-700">|</span>

        {/* Half Day (Hd) */}
        <div className="flex items-center gap-1.5">
          <span className="text-sky-600 font-bold">✓ / ✕</span>
          <span>➜ Half Day (4.5h–9h) (Hd)</span>
        </div>

        <span className="text-slate-300 dark:text-slate-700">|</span>

        {/* Late (L) */}
        <div className="flex items-center gap-1.5">
          <span className="bg-amber-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black">!</span>
          <span>➜ Late (L)</span>
        </div>

        <span className="text-slate-300 dark:text-slate-700">|</span>

        {/* Absent (Ab) */}
        <div className="flex items-center gap-1.5">
          <span className="text-rose-600 font-bold">✕</span>
          <span>➜ Absent (&lt;4.5h) (Ab)</span>
        </div>

        <span className="text-slate-300 dark:text-slate-700">|</span>

        {/* Leave Types */}
        <div className="flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-[10px] font-black rounded-md border border-purple-200 dark:border-purple-800">
            CL/SL
          </span>
          <span>➜ Leave Types</span>
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-3 sm:p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Left Controls: Page size, Month, Year */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <span className="text-slate-600 dark:text-slate-400">Show</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-slate-600 dark:text-slate-400">entries</span>
          </div>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />

          {/* Month Selector */}
          <div className="flex items-center gap-2">
            <span className="text-slate-600 dark:text-slate-400">Month:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Year Selector */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {/* Right Controls: Search, Export, View Toggle */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
          {/* Search Box */}
          <div className="relative min-w-[220px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search employee..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 pl-9 pr-3 py-1.5 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <svg
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Export Excel Button */}
          <button
            onClick={handleExportCSV}
            className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Export Excel</span>
          </button>

          {/* Icon / Name View Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setViewMode('icon')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'icon'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Icon
            </button>
            <button
              onClick={() => setViewMode('name')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'name'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Name
            </button>
          </div>
        </div>
      </div>

      {/* Grid Matrix Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Loading Attendance Matrix History...
            </p>
          </div>
        ) : paginatedEmployees.length === 0 ? (
          <div className="p-16 text-center space-y-2">
            <span className="text-4xl">📂</span>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No Employees Found</p>
            <p className="text-xs text-slate-500">Try adjusting your search criteria or month filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-w-full">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                  {/* Sticky Employee Column Header */}
                  <th className="p-3.5 sticky left-0 z-20 bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 min-w-[200px] shadow-xs">
                    EMPLOYEE
                  </th>

                  {/* Day Headers (1 to 30/31) */}
                  {daysInMonth.map((day) => {
                    const isWeekend = day.dayOfWeek === 0 || isSecondOrFourthSaturday(day.dateObj);
                    return (
                      <th
                        key={day.dayNum}
                        className={`p-2 text-center border-r border-slate-200/60 dark:border-slate-800 min-w-[38px] ${
                          isWeekend ? 'bg-orange-50/50 dark:bg-orange-950/20' : ''
                        }`}
                      >
                        <div className="text-xs font-black text-slate-800 dark:text-slate-200">{day.dayNum}</div>
                        <div className={`text-[9px] font-extrabold ${isWeekend ? 'text-orange-500 dark:text-orange-400' : 'text-slate-400 dark:text-slate-500'}`}>
                          {day.dayName}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {paginatedEmployees.map((emp) => {
                  const empName = `${emp.first_name || ''} ${emp.last_name || ''} ${emp.name || ''}`.trim() || 'Employee';
                  const empCode = emp.emp_id_code || emp.emp_code || emp.id.slice(0, 6);
                  const initial = empName.charAt(0).toUpperCase();

                  return (
                    <tr
                      key={emp.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Sticky Employee Column */}
                      <td className="p-3 sticky left-0 z-10 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 min-w-[200px] shadow-xs">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-full bg-gradient-to-tr ${getAvatarGradient(
                              emp.id
                            )} text-white font-black flex items-center justify-center text-xs shadow-xs shrink-0`}
                          >
                            {initial}
                          </div>
                          <div className="truncate">
                            <div className="font-extrabold text-slate-900 dark:text-white uppercase tracking-tight truncate text-[11px]">
                              {empName}
                            </div>
                            <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                              {empCode}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Day Matrix Cells */}
                      {daysInMonth.map((day) => {
                        const status = getDayStatus(emp.id, day);
                        const isWeekend = day.dayOfWeek === 0 || isSecondOrFourthSaturday(day.dateObj);

                        return (
                          <td
                            key={day.dayNum}
                            title={`${day.dateStr} (${day.dayName}): ${status.label}`}
                            className={`p-2 text-center border-r border-slate-100 dark:border-slate-800/60 transition-colors ${
                              isWeekend ? 'bg-orange-50/20 dark:bg-orange-950/10' : ''
                            }`}
                          >
                            <div className="flex items-center justify-center">
                              {viewMode === 'icon' ? (
                                // Icon View Mode
                                <>
                                  {status.type === 'HOLIDAY' && (
                                    <span className="text-purple-600 text-sm animate-pulse">★</span>
                                  )}
                                  {status.type === 'WEEKOFF' && (
                                    <span className="text-emerald-500 text-sm">🗓️</span>
                                  )}
                                  {status.type === 'PRESENT' && (
                                    <span className="text-emerald-600 font-black text-sm">✓</span>
                                  )}
                                  {status.type === 'HALFDAY' && (
                                    <span className="text-sky-600 font-bold text-xs">✓/✕</span>
                                  )}
                                  {status.type === 'LATE' && (
                                    <span className="bg-amber-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black shadow-2xs">
                                      !
                                    </span>
                                  )}
                                  {status.type === 'ABSENT' && (
                                    <span className="text-rose-600 font-bold text-xs">✕</span>
                                  )}
                                  {status.type === 'LEAVE' && (
                                    <span className="px-1 py-0.5 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-[9px] font-black rounded border border-purple-200 dark:border-purple-800">
                                      {status.code}
                                    </span>
                                  )}
                                  {status.type === 'FUTURE' && (
                                    <span className="text-slate-300 dark:text-slate-700 font-bold">·</span>
                                  )}
                                </>
                              ) : (
                                // Text/Name View Mode
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-black tracking-tighter ${
                                    status.type === 'PRESENT'
                                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                      : status.type === 'ABSENT'
                                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                                      : status.type === 'WEEKOFF'
                                      ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                      : status.type === 'HOLIDAY'
                                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                                      : status.type === 'LEAVE'
                                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300'
                                      : status.type === 'LATE'
                                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                      : status.type === 'HALFDAY'
                                      ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300'
                                      : 'text-slate-300 dark:text-slate-700 font-semibold'
                                  }`}
                                >
                                  {status.code}
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 🚀 MODERN ELEGANT PAGINATION */}
        {!loading && paginatedEmployees.length > 0 && (
          <div className="p-4 bg-slate-50/80 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800">
            <ModernPagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={totalEntries}
              startIndex={(currentPage - 1) * pageSize}
              endIndex={Math.min(currentPage * pageSize, totalEntries)}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[10, 25, 50, 100]}
              itemLabel="entries"
            />
          </div>
        )}
      </div>
    </div>
  );
}
