'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useDashboard } from '../components/DashboardContext';
import { getHeaders } from '../utils/api';
import { usePermissions } from '../hooks/usePermissions';
import ModernPagination from '../components/ModernPagination';
import PageLoader from '@/components/ui/PageLoader';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import SlideDrawer from '../components/SlideDrawer';
import { Clock, MapPin, Camera, ExternalLink, CheckCircle2, Smartphone, Building2, Radio, User, Calendar, X } from 'lucide-react';

interface Employee {
  id: string;
  emp_id_code?: string;
  emp_code?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  email?: string;
  department_name?: string;
  department_id?: string;
  department?: string;
  reporting_to_id?: string;
  reporting_to?: string;
  status?: string;
  joining_date?: string;
  date_of_joining?: string;
  exit_date?: string;
  resignation_date?: string;
  relieving_date?: string;
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
  shift_start_time?: string;
  shift_grace_in?: number;
  shift_min_half_day?: number;
  shift_min_full_day?: number;
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
  const { hasPermission, getPermissionScope, isSuperAdmin } = usePermissions();

  const attendanceScope = getPermissionScope('attendance_history_view') || getPermissionScope('attendance_summary_view') || getPermissionScope('attendance_view');
  const isSelfScope = !isSuperAdmin && attendanceScope === 'SELF';
  const isTeamScope = !isSuperAdmin && (attendanceScope === 'TEAM' || attendanceScope === 'REPORTING');
  const isDeptScope = !isSuperAdmin && attendanceScope === 'DEPARTMENT';

  const canView = isSuperAdmin || hasPermission('attendance_history_view') || hasPermission('attendance_summary_view') || hasPermission('attendance_view');

  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());

  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Offcanvas Punch Drawer State
  interface SelectedPunchDay {
    employeeId: string;
    empCode: string;
    employeeName: string;
    dateStr: string;
    inTime: string;
    outTime: string;
    duration: string;
    status: string;
    isLate: boolean;
  }
  const [selectedPunchDay, setSelectedPunchDay] = useState<SelectedPunchDay | null>(null);
  const [dayPunches, setDayPunches] = useState<any[]>([]);
  const [loadingPunches, setLoadingPunches] = useState(false);
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);

  // Data State
  const [loading, setLoading] = useState<boolean>(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendanceSummaries, setAttendanceSummaries] = useState<SummaryRecord[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [weekoffPolicy, setWeekoffPolicy] = useState<any>(null);
  const [attendancePolicy, setAttendancePolicy] = useState<any>(null);

  // Time Formatter helper: converts UTC timestamps / 24h strings to clean 24h "HH:MM" (e.g. 09:43, 18:49, 00:00)
  const format24hTime = (val: string | null | undefined): string => {
    if (!val || val === '--:--' || val === '-' || val === 'null' || val === 'undefined') return '00:00';
    const str = String(val).trim();
    if (!str) return '00:00';

    if (str.includes('T') || str.includes('Z')) {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        const h = String(d.getHours()).padStart(2, '0');
        const m = String(d.getMinutes()).padStart(2, '0');
        return `${h}:${m}`;
      }
    }

    const parts = str.split(' ');
    const timePart = parts.length >= 2 ? parts[1] : parts[0];
    if (timePart && timePart.includes(':')) {
      const pieces = timePart.split(':');
      const h = String(parseInt(pieces[0], 10) || 0).padStart(2, '0');
      const m = String(parseInt(pieces[1], 10) || 0).padStart(2, '0');
      return `${h}:${m}`;
    }
    return '00:00';
  };

  // Helper to format worked duration cleanly into "HH:MM" (e.g. 09:06, 09:46, 00:00)
  const formatDuration = (mins: number): string => {
    const safeMins = Math.max(0, Math.round(mins || 0));
    const h = Math.floor(safeMins / 60);
    const m = safeMins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const currentUserEmail = (typeof window !== 'undefined' ? localStorage.getItem('email') : '') || '';
  const currentEmp = useMemo(() => {
    return employees.find(e => (e as any).email?.toLowerCase() === currentUserEmail.toLowerCase());
  }, [employees, currentUserEmail]);

  // Compute scoped employees list + Filter for Active timeline (Joining Date & Exit Date)
  const scopedEmployees = useMemo(() => {
    let list = employees;
    if (!isSuperAdmin && attendanceScope !== 'ALL') {
      if (isSelfScope) {
        list = currentEmp ? [currentEmp] : [];
      } else if (isTeamScope && currentEmp) {
        list = employees.filter(e =>
          e.id === currentEmp.id ||
          (e as any).reporting_to_id === currentEmp.id ||
          (e as any).reporting_to === currentEmp.id
        );
      } else if (isDeptScope && currentEmp) {
        list = employees.filter(e =>
          e.id === currentEmp.id ||
          ((e as any).department_id && (currentEmp as any).department_id && (e as any).department_id === (currentEmp as any).department_id) ||
          (e.department_name && currentEmp.department_name && e.department_name.toLowerCase() === currentEmp.department_name.toLowerCase()) ||
          ((e as any).department && (currentEmp as any).department && (e as any).department.toLowerCase() === (currentEmp as any).department.toLowerCase())
        );
      }
    }

    const daysCount = new Date(selectedYear, selectedMonth, 0).getDate();
    const startOfMonthStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
    const endOfMonthStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(daysCount).padStart(2, '0')}`;

    return list.filter((emp) => {
      // 1. Joining Date check: Employee must have joined on or before the end of selected month
      const joining = emp.joining_date || emp.date_of_joining || (emp as any).created_at;
      if (joining) {
        const joiningDateStr = String(joining).split('T')[0];
        if (joiningDateStr > endOfMonthStr) return false;
      }

      const statusUpper = String(emp.status || 'ACTIVE').toUpperCase().trim();
      const exit = emp.exit_date || emp.resignation_date || emp.relieving_date;

      // 2. Active Employee: Include (unless they had an exit date before the start of this month)
      if (statusUpper === 'ACTIVE' || statusUpper === 'PROBATION' || statusUpper === 'CONFIRMED' || statusUpper === 'EMPLOYED') {
        if (exit) {
          const exitDateStr = String(exit).split('T')[0];
          if (exitDateStr < startOfMonthStr) return false;
        }
        return true;
      }

      // 3. Inactive Employee: Include ONLY if their exit date falls in or after the current selected month
      if (exit) {
        const exitDateStr = String(exit).split('T')[0];
        if (exitDateStr >= startOfMonthStr) {
          return true;
        }
      }

      // Inactive employee without an exit date in current/future months -> exclude
      return false;
    });
  }, [employees, isSuperAdmin, attendanceScope, isSelfScope, isTeamScope, isDeptScope, currentEmp, selectedMonth, selectedYear]);

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

  // Fast optimized data loader (Runs 6 essential queries in parallel)
  const loadAllAttendanceHistoryData = async () => {
    setLoading(true);
    try {
      const cid = globalCompanyId || localStorage.getItem('companyId');
      const companyParam = cid && cid !== 'all' ? `&companyId=${cid}&company_id=${cid}` : '';

      const startDayStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
      const daysCount = new Date(selectedYear, selectedMonth, 0).getDate();
      const endDayStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(daysCount).padStart(2, '0')}`;

      const headers = getHeaders();

      const [empRes, summaryRes, holidayRes, leaveRes, weekoffRes, policyRes] = await Promise.allSettled([
        fetch(`/api/v1/employees?pageSize=500${companyParam}`, { headers }),
        fetch(`/api/v1/attendance/summary?startDate=${startDayStr}&endDate=${endDayStr}${companyParam}`, { headers }),
        fetch(`/api/v1/holidays?year=${selectedYear}${companyParam}`, { headers }),
        fetch(`/api/v1/leave-requests?startDate=${startDayStr}&endDate=${endDayStr}${companyParam}`, { headers }),
        fetch(`/api/v1/weekoffs?${companyParam.replace(/^&/, '')}`, { headers }),
        fetch(`/api/v1/attendance/policies?${companyParam.replace(/^&/, '')}`, { headers }),
      ]);

      if (empRes.status === 'fulfilled' && empRes.value.ok) {
        const empData = await empRes.value.json();
        const list = empData.employees || empData.records || empData.data || (Array.isArray(empData) ? empData : []);
        setEmployees(list);
      }

      if (summaryRes.status === 'fulfilled' && summaryRes.value.ok) {
        const sumData = await summaryRes.value.json();
        const list = sumData.attendanceSummary || sumData.records || sumData.summary || sumData.data || (Array.isArray(sumData) ? sumData : []);
        setAttendanceSummaries(list);
      }

      if (holidayRes.status === 'fulfilled' && holidayRes.value.ok) {
        const hData = await holidayRes.value.json();
        const list = hData.holidays || hData.records || hData.data || (Array.isArray(hData) ? hData : []);
        setHolidays(list);
      }

      if (leaveRes.status === 'fulfilled' && leaveRes.value.ok) {
        const lData = await leaveRes.value.json();
        const list = lData.leaveRequests || lData.requests || lData.data || (Array.isArray(lData) ? lData : []);
        setLeaveRequests(list);
      }

      if (weekoffRes.status === 'fulfilled' && weekoffRes.value.ok) {
        const wData = await weekoffRes.value.json();
        const policyObj = wData.weekoff || wData.policy || (Array.isArray(wData.weekoffs) ? wData.weekoffs[0] : null);
        setWeekoffPolicy(policyObj || null);
      }

      if (policyRes.status === 'fulfilled' && policyRes.value.ok) {
        const polData = await policyRes.value.json();
        const polObj = polData.policy || (Array.isArray(polData.policies) ? polData.policies[0] : null) || (Array.isArray(polData) ? polData[0] : null);
        setAttendancePolicy(polObj || null);
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

  // Load Day Raw Punches for Offcanvas Drawer
  useEffect(() => {
    if (!selectedPunchDay) {
      setDayPunches([]);
      return;
    }

    const fetchDayPunches = async () => {
      setLoadingPunches(true);
      try {
        const cid = globalCompanyId || localStorage.getItem('companyId');
        let url = `/api/v1/attendance/raw-punches?employee_id=${encodeURIComponent(selectedPunchDay.employeeId)}&start_date=${selectedPunchDay.dateStr}&end_date=${selectedPunchDay.dateStr}`;
        if (cid && cid !== 'all') {
          url += `&company_id=${cid}`;
        }

        const res = await fetch(url, { headers: getHeaders() });
        if (res.ok) {
          const data = await res.json();
          const rawList = Array.isArray(data) ? data : (data.punches || data.data || []);
          
          // Strict client-side filter to guarantee ONLY this employee and this date
          const targetEmpId = String(selectedPunchDay.employeeId || '').toLowerCase().trim();
          const targetEmpCode = String(selectedPunchDay.empCode || '').toLowerCase().trim();
          const targetDate = String(selectedPunchDay.dateStr || '').trim();

          const list = rawList.filter((p: any) => {
            const pEmpId = String(p.employee_id || '').toLowerCase().trim();
            const pEmpCode = String(p.emp_id_code || '').toLowerCase().trim();
            const matchesEmp = (pEmpId && (pEmpId === targetEmpId || pEmpId === targetEmpCode)) ||
                              (pEmpCode && (pEmpCode === targetEmpCode || pEmpCode === targetEmpId)) ||
                              (!pEmpId && !pEmpCode);
            
            // Check date match
            let pDate = '';
            if (p.punch_time) {
              pDate = String(p.punch_time).split('T')[0].split(' ')[0];
            } else if (p.created_at) {
              pDate = String(p.created_at).split('T')[0].split(' ')[0];
            }

            const matchesDate = !pDate || pDate === targetDate;
            return matchesEmp && matchesDate;
          });

          list.sort((a: any, b: any) => {
            const tA = new Date(a.punch_time || a.created_at || '').getTime() || 0;
            const tB = new Date(b.punch_time || b.created_at || '').getTime() || 0;
            return tA - tB;
          });
          setDayPunches(list);
        } else {
          setDayPunches([]);
        }
      } catch (e) {
        console.error('Error fetching day raw punches:', e);
        setDayPunches([]);
      } finally {
        setLoadingPunches(false);
      }
    };

    fetchDayPunches();
  }, [selectedPunchDay, globalCompanyId]);

  // Days list in selected month
  const daysInMonth = useMemo(() => {
    const count = new Date(selectedYear, selectedMonth, 0).getDate();
    return Array.from({ length: count }, (_, i) => {
      const dayNum = i + 1;
      const dateObj = new Date(selectedYear, selectedMonth - 1, dayNum);
      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
      const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const dayOfWeek = dateObj.getDay();
      return { dayNum, dayName, dateStr, dayOfWeek, dateObj };
    });
  }, [selectedMonth, selectedYear]);

  // Maps for efficient O(1) lookup per employee & date
  const summariesMap = useMemo(() => {
    const map = new Map<string, SummaryRecord>();
    attendanceSummaries.forEach((s) => {
      const cleanDate = String(s.attendance_date).split('T')[0];
      map.set(`${s.employee_id}_${cleanDate}`, s);
    });
    return map;
  }, [attendanceSummaries]);

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
        const typeCode = (l.leave_type_code || l.leave_type || 'CL').toUpperCase();
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          map.set(`${l.employee_id}_${dStr}`, typeCode);
        }
      }
    });
    return map;
  }, [leaveRequests]);

  // Core Matrix Calculation per Employee per Day (Provides exact IN-TIME, OUT-TIME, DURATION, STATUS matching image)
  const getDayAttendanceRecord = (empId: string, day: { dayNum: number; dayName: string; dateStr: string; dayOfWeek: number; dateObj: Date }) => {
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const isFuture = day.dateStr > todayStr;

    // 1. Holiday Check
    if (holidaySet.has(day.dateStr)) {
      return {
        inTime: '00:00',
        outTime: '00:00',
        duration: '00:00',
        status: 'Holiday',
        type: 'HOLIDAY',
        isHoliday: true,
        isLate: false
      };
    }

    // 2. Week Off Check
    if (isDynamicWeekoff(day.dateObj)) {
      return {
        inTime: '00:00',
        outTime: '00:00',
        duration: '00:00',
        status: 'WO',
        type: 'WEEKOFF',
        isWeekoff: true,
        isLate: false
      };
    }

    // 3. Leave Check
    const leaveCode = leavesMap.get(`${empId}_${day.dateStr}`);
    if (leaveCode) {
      return {
        inTime: '00:00',
        outTime: '00:00',
        duration: '00:00',
        status: `${leaveCode}*`,
        type: 'LEAVE',
        isLeave: true,
        isLate: false
      };
    }

    // 4. Future Date Check
    if (isFuture) {
      return {
        inTime: '00:00',
        outTime: '00:00',
        duration: '00:00',
        status: '-',
        type: 'FUTURE',
        isLate: false
      };
    }

    // 5. Attendance Summary Check
    const summary = summariesMap.get(`${empId}_${day.dateStr}`);
    const fullDayHours = attendancePolicy?.full_day_min_hours ? Number(attendancePolicy.full_day_min_hours) : 8;
    const halfDayHours = attendancePolicy?.half_day_min_hours ? Number(attendancePolicy.half_day_min_hours) : 4;
    const minFullDayMins = fullDayHours * 60;
    const minHalfDayMins = halfDayHours * 60;

    if (summary) {
      const statusUpper = (summary.status || '').toUpperCase();
      let workedMins = summary.worked_minutes || 0;
      let lateMins = summary.late_minutes || 0;

      if (!workedMins && summary.first_in && summary.last_out && summary.first_in !== '--:--' && summary.last_out !== '--:--' && summary.first_in !== summary.last_out) {
        const inD = new Date(summary.first_in.includes('T') ? summary.first_in : `2000-01-01T${summary.first_in}`);
        const outD = new Date(summary.last_out.includes('T') ? summary.last_out : `2000-01-01T${summary.last_out}`);
        if (!isNaN(inD.getTime()) && !isNaN(outD.getTime()) && outD > inD) {
          workedMins = Math.round((outD.getTime() - inD.getTime()) / 60000);
        }
      }

      const isLate = lateMins > 0;
      const inTimeStr = format24hTime(summary.first_in);
      const outTimeStr = format24hTime(summary.last_out);
      const durationStr = formatDuration(workedMins);

      if (statusUpper === 'LEAVE') {
        return { inTime: '00:00', outTime: '00:00', duration: '00:00', status: 'CL*', type: 'LEAVE', isLeave: true, isLate: false };
      }

      if (workedMins >= minFullDayMins) {
        return {
          inTime: inTimeStr,
          isLate,
          outTime: outTimeStr,
          duration: durationStr,
          status: 'P',
          type: 'PRESENT'
        };
      }

      if (workedMins >= minHalfDayMins) {
        return {
          inTime: inTimeStr,
          isLate,
          outTime: outTimeStr,
          duration: durationStr,
          status: 'H/D',
          type: 'HALFDAY'
        };
      }

      if (summary.first_in && summary.first_in !== '--:--') {
        return {
          inTime: inTimeStr,
          isLate,
          outTime: outTimeStr,
          duration: durationStr,
          status: day.dateStr === todayStr ? 'P' : 'LOP',
          type: day.dateStr === todayStr ? 'PRESENT' : 'LOP'
        };
      }
    }

    return {
      inTime: '00:00',
      outTime: '00:00',
      duration: '00:00',
      status: 'LOP',
      type: 'LOP',
      isLate: false
    };
  };

  // Filtering & Pagination
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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, pageSize, selectedMonth, selectedYear]);

  // Export Excel (.xls with True ColSpan & RowSpan)
  const handleExportCSV = () => {
    if (scopedEmployees.length === 0) {
      showToast('No employee data available to export', 'error');
      return;
    }

    const monthLabel = MONTHS.find((m) => m.value === selectedMonth)?.label || 'Month';
    
    // HTML / XML Table for True Excel format with ColSpan and RowSpan
    let tableHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Attendance History</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
        <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
        <style>
          table { border-collapse: collapse; font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
          th { background-color: #07518A; color: #FFFFFF; font-weight: bold; text-align: center; border: 1px solid #002B49; padding: 6px 8px; }
          .subth { background-color: #064270; color: #FFFFFF; font-weight: bold; text-align: center; border: 1px solid #002B49; padding: 4px 6px; font-size: 10pt; }
          td { border: 1px solid #D1D5DB; text-align: center; padding: 4px 6px; }
          .name-col { text-align: left; font-weight: bold; padding: 6px 10px; background-color: #F8FAFC; }
        </style>
      </head>
      <body>
        <table>
          <thead>
            <tr>
              <th rowspan="2" class="name-col" style="background-color: #07518A; color: #FFFFFF; text-align: left;">EMPLOYEE NAME & ID</th>
    `;

    daysInMonth.forEach((day) => {
      tableHtml += `<th colspan="4" style="background-color: #07518A; color: #FFFFFF; text-align: center;">${day.dateStr}</th>`;
    });

    tableHtml += `</tr><tr>`;

    daysInMonth.forEach(() => {
      tableHtml += `
        <th class="subth">IN</th>
        <th class="subth">OUT</th>
        <th class="subth">DURATION</th>
        <th class="subth">STATUS</th>
      `;
    });

    tableHtml += `</tr></thead><tbody>`;

    scopedEmployees.forEach((emp) => {
      const code = emp.emp_id_code || emp.emp_code || emp.id.slice(0, 7);
      const name = `${emp.first_name || ''} ${emp.last_name || ''} ${emp.name || ''}`.trim().toUpperCase();

      tableHtml += `<tr><td class="name-col">${name} (${code})</td>`;
      daysInMonth.forEach((day) => {
        const rec = getDayAttendanceRecord(emp.id, day);
        tableHtml += `
          <td>${rec.inTime}${rec.isLate ? '*' : ''}</td>
          <td>${rec.outTime}</td>
          <td>${rec.duration}</td>
          <td style="font-weight: bold;">${rec.status}</td>
        `;
      });
      tableHtml += `</tr>`;
    });

    tableHtml += `</tbody></table></body></html>`;

    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Attendance_History_${monthLabel}_${selectedYear}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported Attendance History successfully!', 'success');
  };

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs mt-6 font-sans">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center text-2xl font-black mb-3 border border-rose-200/60 dark:border-rose-900/60">
          🔒
        </div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Access Denied</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
          You do not have permission to view attendance history records. Please contact your system administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fadeIn w-full font-sans">
      {/* Main Page Title Banner */}
      <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 border-l-4 border-l-[#07518a] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg md:text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
            ATTENDANCE ENGINE – HISTORY
          </h1>
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
            Monthly day-by-day attendance history grid for {scopedEmployees.length} active employee{scopedEmployees.length === 1 ? '' : 's'}
          </p>
        </div>

        {attendanceScope && attendanceScope !== 'ALL' && (
          <span className="self-start sm:self-auto px-2.5 py-1 rounded-lg text-[10.5px] font-black uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/60">
            Scope: {attendanceScope}
          </span>
        )}
      </div>

      {/* Controls & Filter Bar: Search first, Month, Year, then Export */}
      <div className="bg-white dark:bg-slate-900 p-3 sm:p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Left Controls: Search Box FIRST, then Month, Year */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* 🔍 Search Box (At the Starting) */}
          <div className="relative min-w-[220px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search employee..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 pl-9 pr-3 py-1.5 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#07518a]/20 focus:border-[#07518a]"
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

          {/* Month Selector */}
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="text-slate-600 dark:text-slate-400">Month:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#07518a]/20 focus:border-[#07518a] cursor-pointer"
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
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#07518a]/20 focus:border-[#07518a] cursor-pointer"
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {/* Right Controls: Export Excel Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* Detailed Grid Matrix Table with Double Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden">
        {loading ? (
          <PageLoader message="Loading Attendance Matrix History..." />
        ) : paginatedEmployees.length === 0 ? (
          <div className="p-16 text-center space-y-2">
            <span className="text-4xl">📂</span>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No Employees Found</p>
            <p className="text-xs text-slate-500">Try adjusting your search criteria, month, or employment timeline filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto max-h-[640px] max-w-full relative scrollbar-thin">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 z-30 shadow-xs">
                {/* Top Row: NAME and Day Date (YYYY-MM-DD) */}
                <tr className="bg-[#07518a] text-white text-xs font-black uppercase tracking-wider" style={{ color: '#ffffff' }}>
                  <th rowSpan={2} style={{ color: '#ffffff' }} className="p-3 sticky left-0 top-0 z-50 bg-[#07518a] !text-white text-white min-w-[210px] max-w-[210px] shadow-xs text-left pl-4 border-r border-b border-blue-900/80 font-black text-xs tracking-wider">
                    EMPLOYEE NAME & ID
                  </th>
                  {daysInMonth.map((day) => (
                    <th
                      key={day.dayNum}
                      colSpan={4}
                      style={{ color: '#ffffff' }}
                      className="py-2.5 px-3 sticky top-0 z-30 bg-[#07518a] !text-white text-white text-center border-r border-b border-blue-900/80 font-black tracking-wide text-xs md:text-[13px]"
                    >
                      {day.dateStr}
                    </th>
                  ))}
                </tr>

                {/* Sub Row: IN, OUT, DURATION, STATUS with larger font size */}
                <tr className="bg-[#064270] text-white text-[11px] font-black uppercase tracking-wider" style={{ color: '#ffffff' }}>
                  {daysInMonth.map((day) => (
                    <React.Fragment key={`sub-${day.dayNum}`}>
                      <th style={{ color: '#ffffff' }} className="py-2.5 px-1.5 sticky top-[38px] z-30 bg-[#064270] !text-white text-white text-center min-w-[55px] border-r border-b border-blue-900/80 font-black text-[11px]">IN</th>
                      <th style={{ color: '#ffffff' }} className="py-2.5 px-1.5 sticky top-[38px] z-30 bg-[#064270] !text-white text-white text-center min-w-[55px] border-r border-b border-blue-900/80 font-black text-[11px]">OUT</th>
                      <th style={{ color: '#ffffff' }} className="py-2.5 px-1.5 sticky top-[38px] z-30 bg-[#064270] !text-white text-white text-center min-w-[65px] border-r border-b border-blue-900/80 font-black text-[11px]">DURATION</th>
                      <th style={{ color: '#ffffff' }} className="py-2.5 px-1.5 sticky top-[38px] z-30 bg-[#064270] !text-white text-white text-center min-w-[60px] border-r border-b border-blue-900/80 font-black text-[11px]">STATUS</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80 text-xs">
                {paginatedEmployees.map((emp) => {
                  const cleanFirstName = (emp.first_name || '').trim();
                  const cleanLastName = (emp.last_name || '').trim();
                  const rawCombined = [cleanFirstName, cleanLastName].filter(Boolean).join(' ');
                  const fullEmpName = rawCombined || (emp.name || '').trim() || 'Employee';
                  const empCode = emp.emp_id_code || emp.emp_code || emp.id.slice(0, 7);
                  const displayName = fullEmpName.length > 20 ? `${fullEmpName.slice(0, 20)}...` : fullEmpName;

                  return (
                    <tr
                      key={emp.id}
                      className="hover:bg-blue-50/20 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Sticky Employee Name with ID underneath & Tooltip */}
                      <td className="p-2.5 sticky left-0 z-20 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 min-w-[210px] max-w-[210px] shadow-xs text-left">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-help text-left">
                              <div className="font-extrabold text-slate-900 dark:text-white uppercase tracking-tight text-[11.5px] leading-snug">
                                {displayName}
                              </div>
                              <div className="text-[10px] font-bold text-[#07518a] dark:text-sky-400 mt-0.5 tracking-wide">
                                ID: {empCode}
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs p-2 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xl rounded-xl z-50 max-w-xs text-left font-bold">
                            <p>{fullEmpName}</p>
                          </TooltipContent>
                        </Tooltip>
                      </td>

                      {/* Day Matrix 4 Columns per Day */}
                      {daysInMonth.map((day) => {
                        const rec = getDayAttendanceRecord(emp.id, day);
                        const isGreenTime = rec.isHoliday || rec.isLeave;
                        const isGreenStatus = rec.isHoliday || rec.isLeave || rec.isWeekoff;

                        const handleOpenDrawer = () => {
                          setSelectedPunchDay({
                            employeeId: emp.id,
                            empCode,
                            employeeName: fullEmpName,
                            dateStr: day.dateStr,
                            inTime: rec.inTime,
                            outTime: rec.outTime,
                            duration: rec.duration,
                            status: rec.status,
                            isLate: rec.isLate
                          });
                        };

                        return (
                          <React.Fragment key={day.dayNum}>
                            {/* IN */}
                            <td className="p-0 text-center text-[11px] border-r border-slate-100 dark:border-slate-800/60">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={handleOpenDrawer}
                                    className={`w-full h-full py-2 px-1.5 text-center cursor-pointer hover:bg-blue-100/70 dark:hover:bg-blue-900/50 hover:font-bold transition-all border-0 bg-transparent flex items-center justify-center gap-0.5 ${
                                      isGreenTime ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-800 dark:text-slate-200 font-medium'
                                    }`}
                                  >
                                    <span>{rec.inTime}</span>
                                    {rec.isLate && <span className="text-red-600 font-bold ml-0.5">*</span>}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-[10px] font-bold py-1 px-2.5 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xl rounded-xl z-50">
                                  Click to view all raw punches
                                </TooltipContent>
                              </Tooltip>
                            </td>

                            {/* OUT */}
                            <td className="p-0 text-center text-[11px] border-r border-slate-100 dark:border-slate-800/60">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={handleOpenDrawer}
                                    className={`w-full h-full py-2 px-1.5 text-center cursor-pointer hover:bg-blue-100/70 dark:hover:bg-blue-900/50 hover:font-bold transition-all border-0 bg-transparent flex items-center justify-center gap-0.5 ${
                                      isGreenTime ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-800 dark:text-slate-200 font-medium'
                                    }`}
                                  >
                                    <span>{rec.outTime}</span>
                                    {rec.outTime !== '00:00' && rec.isLate && <span className="text-red-600 font-bold ml-0.5">*</span>}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-[10px] font-bold py-1 px-2.5 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xl rounded-xl z-50">
                                  Click to view all raw punches
                                </TooltipContent>
                              </Tooltip>
                            </td>

                            {/* DURATION */}
                            <td className="p-0 text-center text-[11px] border-r border-slate-100 dark:border-slate-800/60">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={handleOpenDrawer}
                                    className={`w-full h-full py-2 px-1.5 text-center cursor-pointer hover:bg-blue-100/70 dark:hover:bg-blue-900/50 hover:font-bold transition-all border-0 bg-transparent flex items-center justify-center ${
                                      isGreenTime ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-800 dark:text-slate-200 font-medium'
                                    }`}
                                  >
                                    <span>{rec.duration}</span>
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-[10px] font-bold py-1 px-2.5 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xl rounded-xl z-50">
                                  Click to view all raw punches
                                </TooltipContent>
                              </Tooltip>
                            </td>

                            {/* STATUS */}
                            <td className={`py-2 px-1.5 text-center font-bold text-[11px] border-r border-slate-200/80 dark:border-slate-800 ${
                              isGreenStatus
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : rec.status === 'LOP'
                                ? 'text-slate-800 dark:text-slate-200'
                                : 'text-slate-800 dark:text-slate-200'
                            }`}>
                              {rec.status}
                            </td>
                          </React.Fragment>
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

      {/* 🚀 OFFCANVAS SLIDE DRAWER FOR DAILY PUNCH LOGS */}
      <SlideDrawer
        isOpen={!!selectedPunchDay}
        onClose={() => setSelectedPunchDay(null)}
        title={selectedPunchDay ? `Punch Logs: ${selectedPunchDay.dateStr}` : 'Punch Logs'}
        width="max-w-[560px]"
      >
        {selectedPunchDay && (
          <div className="space-y-4 font-sans text-xs">
            {/* Employee & Date Summary Banner */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#07518a]/10 dark:bg-[#07518a]/30 text-[#07518a] dark:text-blue-400 flex items-center justify-center font-black text-sm">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-900 dark:text-white">
                      {selectedPunchDay.employeeName}
                    </h4>
                    <p className="text-[10.5px] font-bold text-slate-400">
                      ID: {selectedPunchDay.empCode}
                    </p>
                  </div>
                </div>

                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                  selectedPunchDay.status === 'P' || selectedPunchDay.status === 'Present'
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200/70'
                    : selectedPunchDay.status === 'Holiday' || selectedPunchDay.status === 'WO'
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200/70'
                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200/70'
                }`}>
                  {selectedPunchDay.status}
                </span>
              </div>

              {/* Day Metrics Quick Bar */}
              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-slate-700 text-center">
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">IN Time</span>
                  <span className="text-[11px] font-black text-slate-800 dark:text-slate-200">
                    {selectedPunchDay.inTime}
                    {selectedPunchDay.isLate && <span className="text-red-500 ml-0.5">*</span>}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">OUT Time</span>
                  <span className="text-[11px] font-black text-slate-800 dark:text-slate-200">
                    {selectedPunchDay.outTime}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">Duration</span>
                  <span className="text-[11px] font-black text-slate-800 dark:text-slate-200">
                    {selectedPunchDay.duration}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">Punches</span>
                  <span className="text-[11px] font-black text-[#07518a] dark:text-sky-400">
                    {dayPunches.length} Logs
                  </span>
                </div>
              </div>
            </div>

            {/* List of Raw Punches Recorded for the Day */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Punch Timeline ({dayPunches.length})
                </span>
                <span className="text-[10px] text-slate-400 font-semibold">
                  {selectedPunchDay.dateStr}
                </span>
              </div>

              {loadingPunches ? (
                <div className="p-8">
                  <PageLoader message="Fetching day punch records..." />
                </div>
              ) : dayPunches.length === 0 ? (
                <div className="p-8 text-center bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-2">
                  <span className="text-3xl block">📋</span>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No Raw Punches Recorded</p>
                  <p className="text-[10.5px] text-slate-400 max-w-xs mx-auto">
                    No biometric device or mobile GPS punches found for this employee on {selectedPunchDay.dateStr}.
                  </p>
                </div>
              ) : (
                dayPunches.map((punch, idx) => {
                  const direction = (punch.direction || punch.punch_direction || 'IN').toUpperCase();
                  const isMobile = (punch.source || '').toUpperCase().includes('MOBILE') || (punch.image_url && String(punch.image_url).trim() !== '') || (punch.latitude && punch.longitude);
                  
                  let formattedPunchTime = punch.punch_time || punch.created_at || '-';
                  try {
                    let iso = String(punch.punch_time || punch.created_at || '').trim();
                    if (!iso.includes('T') && iso.includes(' ')) iso = iso.replace(' ', 'T');
                    const d = new Date(iso);
                    if (!isNaN(d.getTime())) {
                      formattedPunchTime = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
                    }
                  } catch (e) {
                    // ignore
                  }

                  return (
                    <div
                      key={punch.id || idx}
                      className="p-3.5 bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-2xs space-y-2.5 transition-all hover:border-[#07518a]/40"
                    >
                      {/* Top Bar: Punch #, Direction badge, Time */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center text-[10px] font-black">
                            #{idx + 1}
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                            direction === 'IN'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300'
                              : 'bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300'
                          }`}>
                            {direction} Punch
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200 text-xs">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formattedPunchTime}</span>
                        </div>
                      </div>

                      {/* Middle Details: Device Punch vs Mobile Punch with Location & Image */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-700/80 text-xs space-y-2">
                        {isMobile ? (
                          /* Mobile / GPS Punch */
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-bold uppercase bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60">
                                <Smartphone className="w-3 h-3" />
                                <span>Mobile App Punch</span>
                              </span>
                              {punch.device_model && (
                                <span className="text-[10.5px] text-slate-500 font-medium">
                                  {punch.device_model}
                                </span>
                              )}
                            </div>

                            {/* Location / GPS info */}
                            {(punch.location_name || (punch.latitude && punch.longitude)) && (
                              <div className="flex items-start gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800">
                                <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                                <div className="flex-1 text-[11px]">
                                  {punch.location_name && punch.location_name !== 'IN' && punch.location_name !== 'OUT' && (
                                    <p className="font-bold text-slate-800 dark:text-slate-200">
                                      {punch.location_name}
                                    </p>
                                  )}
                                  {punch.latitude && punch.longitude && (
                                    <div className="flex items-center justify-between gap-2 mt-0.5">
                                      <span className="text-[10px] text-slate-400 font-mono">
                                        GPS: {punch.latitude}, {punch.longitude}
                                      </span>
                                      <a
                                        href={`https://www.google.com/maps?q=${punch.latitude},${punch.longitude}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 underline"
                                      >
                                        <span>View Map</span>
                                        <ExternalLink className="w-2.5 h-2.5" />
                                      </a>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Verification Selfie Image Preview */}
                            {punch.image_url && (
                              <div className="pt-1">
                                <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                  Captured Punch Selfie
                                </span>
                                <div
                                  onClick={() => setSelectedImagePreview(punch.image_url)}
                                  className="relative w-28 h-28 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-950 cursor-pointer group shadow-2xs"
                                  title="Click to zoom selfie"
                                >
                                  <img
                                    src={punch.image_url}
                                    alt="Punch Selfie"
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                  />
                                  <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] font-bold">
                                    <Camera className="w-4 h-4 mr-1" /> Zoom
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          /* Biometric Device Punch */
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-bold uppercase bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                                <Radio className="w-3 h-3" />
                                <span>Biometric Device Punch</span>
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                                <span className="text-[9px] font-bold text-slate-400 uppercase block">Machine ID / Terminal</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200">
                                  {punch.device_id || punch.device_model || 'Biometric Machine'}
                                </span>
                              </div>
                              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                                <span className="text-[9px] font-bold text-slate-400 uppercase block">IP Address</span>
                                <span className="font-medium text-slate-600 dark:text-slate-400 font-mono text-[10.5px]">
                                  {punch.ip_address || '-'}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </SlideDrawer>

      {/* 📸 FULL SIZE SELFIE PREVIEW MODAL */}
      {selectedImagePreview && createPortal(
        <div
          className="fixed inset-0 z-[1000001] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn"
          onClick={() => setSelectedImagePreview(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-w-md w-full relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h4 className="text-xs font-black uppercase text-slate-850 dark:text-white">
                  Punch Selfie Verification
                </h4>
              </div>
              <button
                onClick={() => setSelectedImagePreview(null)}
                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 bg-slate-950 flex items-center justify-center">
              <img
                src={selectedImagePreview}
                alt="Punch Verification Selfie"
                className="w-full max-h-[70vh] object-contain rounded-2xl"
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
