'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  Users,
  UserCheck,
  Umbrella,
  UserX,
  UserPlus,
  Calendar,
  TrendingUp,
  Award,
  Cake,
  DollarSign,
  GraduationCap,
  Clock,
  ArrowUpRight,
  Search,
  Bell,
  Settings,
  Download,
  ChevronDown,
  CheckCircle2,
  Briefcase,
  FileText,
  PieChart,
  Plus,
  ChevronRight,
  Shield,
  Activity,
  Sparkles,
  BarChart3,
  Building2,
  Layers,
  ArrowUp,
  User,
  Star,
  BookOpen,
  FileCheck,
  Globe,
  PartyPopper,
  Heart,
  MessageSquare,
  Send,
  ThumbsUp,
  Smile,
  ChevronLeft,
  Loader2
} from 'lucide-react';
import DashboardPageHeader from '../components/DashboardPageHeader';
import { getHeaders, getUrl } from '../utils/api';
import { useDashboard } from '../components/DashboardContext';
import { usePermissions } from '../hooks/usePermissions';
import { getDeviceIdentifier, getDeviceModel } from '../utils/deviceUtils';

interface Company {
  id: string;
  name: string;
  subdomain: string;
  status: string;
  created_at: string;
}

interface Employee {
  id: string;
  emp_id_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  status: string;
  joining_date: string;
  dob?: string;
  emp_image?: string;
  designation_name?: string;
  department_name?: string;
  branch_name?: string;
  shift_name?: string;
}

interface ActivityLog {
  id: string;
  user_email: string;
  action: string;
  module: string;
  details: any;
  ip_address: string;
  created_at: string;
}

export default function OverviewPage() {
  const { companyId: contextCompanyId, setCompanyId: setContextCompanyId } = useDashboard();
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const companyId = contextCompanyId || (typeof window !== 'undefined' ? localStorage.getItem('companyId') : null);

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [myProfile, setMyProfile] = useState<Employee | null>(null);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [rawPunches, setRawPunches] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);

  // Today Events (Birthdays & Anniversaries) State & Carousel
  const [todayEvents, setTodayEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState<boolean>(true);
  const [currentEventIndex, setCurrentEventIndex] = useState<number>(0);
  const [flowerBurstEventId, setFlowerBurstEventId] = useState<string | null>(null);
  const [openWishInputEventId, setOpenWishInputEventId] = useState<string | null>(null);
  const [wishMessages, setWishMessages] = useState<Record<string, string>>({});
  const [submittingWishId, setSubmittingWishId] = useState<string | null>(null);
  const [expandedWishesEventId, setExpandedWishesEventId] = useState<string | null>(null);

  // Auto-advance celebration cards every 5s if > 2 items
  useEffect(() => {
    if (todayEvents.length <= 2) return;
    const timer = setInterval(() => {
      setCurrentEventIndex(prev => (prev + 2 >= todayEvents.length ? 0 : prev + 2));
    }, 5000);
    return () => clearInterval(timer);
  }, [todayEvents.length]);

  useEffect(() => {
    const storedRoles = localStorage.getItem('roles');
    const storedEmail = localStorage.getItem('email');
    const storedCompanyId = localStorage.getItem('companyId');
    const storedProfile = localStorage.getItem('myProfile');
    if (storedRoles) setRoles(JSON.parse(storedRoles));
    if (storedEmail) setEmail(storedEmail);
    if (storedCompanyId) setContextCompanyId(storedCompanyId);
    if (storedProfile) {
      try { setMyProfile(JSON.parse(storedProfile)); } catch(e) {}
    }
  }, []);

  // Fetch real data endpoints
  useEffect(() => {
    const fetchData = async () => {
      const headers = getHeaders();
      
      // 1. Fetch Logs
      try {
        const res = await fetch(getUrl('/api/v1/auth/logs', companyId), { headers });
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          const data = await res.json();
          setLogs(data.logs || []);
        }
      } catch (e) {}

      // 2. Fetch Employees (for Total Employees, Department Headcount, Birthdays, Anniversaries)
      try {
        const res = await fetch(getUrl('/api/v1/employees', companyId), { headers });
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          const data = await res.json();
          setEmployees(data.employees || []);
        }
      } catch (e) {}

      // 3. Fetch My Profile
      try {
        const res = await fetch(getUrl('/api/v1/employees/me'), { headers });
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          const data = await res.json();
          if (data.employee) setMyProfile(data.employee);
        }
      } catch (e) {}

      // 4. Fetch Leave Requests (for On Leave Today calculation)
      try {
        const res = await fetch(getUrl('/api/v1/leave-requests', companyId), { headers });
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          const data = await res.json();
          setLeaveRequests(data.requests || []);
        }
      } catch (e) {}

      // 5. Fetch Raw Punches (for Present Today & Absent Today calculation)
      try {
        const res = await fetch(getUrl('/api/v1/attendance/punches', companyId), { headers });
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          const data = await res.json();
          setRawPunches(data.punches || []);
        }
      } catch (e) {}

      // 6. Fetch Holidays (for Upcoming Company Holidays)
      try {
        const res = await fetch(getUrl('/api/v1/holidays', companyId), { headers });
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          const data = await res.json();
          setHolidays(data.holidays || []);
        }
      } catch (e) {}

      // 7. Fetch Today's Events (Birthdays & Anniversaries)
      try {
        setEventsLoading(true);
        const res = await fetch(getUrl('/api/v1/events/today', companyId), { headers });
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          const data = await res.json();
          setTodayEvents(data.events || []);
        }
      } catch (e) {
      } finally {
        setEventsLoading(false);
      }
    };

    fetchData();
  }, [companyId]);

  // Trigger Flower Burst Animation on Like
  const triggerFlowerBurst = (eventId: string) => {
    setFlowerBurstEventId(eventId);
    setTimeout(() => {
      setFlowerBurstEventId(null);
    }, 1400);
  };

  // Action: Toggle Reaction (LIKE / HEART)
  const handleToggleReaction = async (eventId: string, reactionType = 'LIKE') => {
    if (reactionType === 'LIKE') {
      triggerFlowerBurst(eventId);
    }
    setTodayEvents(prev => prev.map(ev => {
      if (ev.eventId === eventId) {
        const isCurrentlyReacted = ev.userReaction === reactionType;
        return {
          ...ev,
          userReaction: isCurrentlyReacted ? null : reactionType,
          reactionCount: isCurrentlyReacted ? Math.max(0, ev.reactionCount - 1) : ev.reactionCount + (ev.userReaction ? 0 : 1)
        };
      }
      return ev;
    }));

    try {
      const headers = getHeaders();
      const res = await fetch(getUrl(`/api/v1/events/${eventId}/react`), {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reactionType })
      });
      if (res.ok) {
        const data = await res.json();
        setTodayEvents(prev => prev.map(ev => {
          if (ev.eventId === eventId) {
            return { ...ev, reactionCount: data.reactionCount, userReaction: data.userReaction };
          }
          return ev;
        }));
      }
    } catch (e) {
      console.error('Error toggling reaction:', e);
    }
  };

  // Action: Submit Wish Message
  const handleSendWish = async (eventId: string) => {
    const msg = wishMessages[eventId]?.trim();
    if (!msg) return;

    setSubmittingWishId(eventId);
    try {
      const headers = getHeaders();
      const res = await fetch(getUrl(`/api/v1/events/${eventId}/wish`), {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg })
      });
      if (res.ok) {
        const data = await res.json();
        setTodayEvents(prev => prev.map(ev => {
          if (ev.eventId === eventId) {
            return {
              ...ev,
              wishCount: ev.wishCount + 1,
              wishes: [data.wish, ...(ev.wishes || [])]
            };
          }
          return ev;
        }));
        setWishMessages(prev => ({ ...prev, [eventId]: '' }));
        setOpenWishInputEventId(null);
        setExpandedWishesEventId(eventId);
      }
    } catch (e) {
      console.error('Error sending wish:', e);
    } finally {
      setSubmittingWishId(null);
    }
  };

  // Today's Date String Format (YYYY-MM-DD)
  const todayStr = useMemo(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }, []);

  // 1. Dynamic Total Active Employees
  const activeEmployees = useMemo(() => {
    if (employees.length === 0) return [];
    return employees.filter(e => (e.status || 'ACTIVE').toUpperCase() === 'ACTIVE');
  }, [employees]);

  const totalEmpCount = activeEmployees.length > 0 ? activeEmployees.length : employees.length;

  // 2. Dynamic Present Today (Distinct employees with at least 1 raw punch today)
  const presentTodayCount = useMemo(() => {
    if (rawPunches.length === 0) return 0;
    const todayPunches = rawPunches.filter(p => {
      const pDate = String(p.punch_time || p.created_at || '').split('T')[0];
      return pDate === todayStr;
    });
    const uniquePresentEmpIds = new Set(todayPunches.map(p => p.employee_id || p.emp_id).filter(Boolean));
    return uniquePresentEmpIds.size;
  }, [rawPunches, todayStr]);

  // 3. Dynamic On Leave Today (Employees with leave covering current date)
  const onLeaveTodayCount = useMemo(() => {
    if (leaveRequests.length === 0) return 0;
    const todayLeaves = leaveRequests.filter(r => {
      const fromDate = String(r.from_date || '').split('T')[0];
      const toDate = String(r.to_date || '').split('T')[0];
      const status = String(r.status || '').toUpperCase();
      const isApprovedOrPending = status === 'APPROVED' || status === 'PENDING';
      return isApprovedOrPending && fromDate <= todayStr && toDate >= todayStr;
    });
    const uniqueLeaveEmpIds = new Set(todayLeaves.map(r => r.employee_id || r.emp_id).filter(Boolean));
    return uniqueLeaveEmpIds.size;
  }, [leaveRequests, todayStr]);

  // 4. Dynamic Absent Today (Active employees without punch and not on leave)
  const absentTodayCount = useMemo(() => {
    if (totalEmpCount === 0) return 0;
    return Math.max(0, totalEmpCount - presentTodayCount - onLeaveTodayCount);
  }, [totalEmpCount, presentTodayCount, onLeaveTodayCount]);

  // 5. Dynamic New Joiners in Current Month
  const newJoinersCount = useMemo(() => {
    if (employees.length === 0) return 24;
    const currentYearMonth = todayStr.slice(0, 7); // YYYY-MM
    return employees.filter(e => e.joining_date && String(e.joining_date).startsWith(currentYearMonth)).length;
  }, [employees, todayStr]);

  // Percentages for Donut & KPI Cards
  const presentPct = totalEmpCount > 0 ? ((presentTodayCount / totalEmpCount) * 100).toFixed(1) : '84.0';
  const leavePct = totalEmpCount > 0 ? ((onLeaveTodayCount / totalEmpCount) * 100).toFixed(1) : '9.6';
  const absentPct = totalEmpCount > 0 ? ((absentTodayCount / totalEmpCount) * 100).toFixed(1) : '6.4';

  // 5. Dynamic Upcoming Birthdays & Anniversaries from Employees Table
  const upcomingEvents = useMemo(() => {
    const events: Array<{ id: string; type: 'BIRTHDAY' | 'ANNIVERSARY'; name: string; dateStr: string; badge: string }> = [];
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();

    activeEmployees.forEach((emp, i) => {
      const empName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.email;

      // Birthday Check
      if (emp.dob) {
        const dobDate = new Date(emp.dob);
        const dobMonth = dobDate.getMonth() + 1;
        const dobDay = dobDate.getDate();
        if (dobMonth === currentMonth && dobDay >= currentDay) {
          const isToday = dobDay === currentDay;
          const isTomorrow = dobDay === currentDay + 1;
          events.push({
            id: `bday-${emp.id || i}`,
            type: 'BIRTHDAY',
            name: empName,
            dateStr: `${dobDate.getDate()} ${dobDate.toLocaleString('default', { month: 'short' })}`,
            badge: isToday ? 'Today 🎉' : isTomorrow ? 'Tomorrow' : `${dobDay - currentDay} days away`
          });
        }
      }

      // Work Anniversary Check
      if (emp.joining_date) {
        const joinDate = new Date(emp.joining_date);
        const joinMonth = joinDate.getMonth() + 1;
        const joinDay = joinDate.getDate();
        if (joinMonth === currentMonth && joinDay >= currentDay) {
          const isToday = joinDay === currentDay;
          const isTomorrow = joinDay === currentDay + 1;
          events.push({
            id: `anniv-${emp.id || i}`,
            type: 'ANNIVERSARY',
            name: empName,
            dateStr: `${joinDate.getDate()} ${joinDate.toLocaleString('default', { month: 'short' })}`,
            badge: isToday ? 'Today 🏆' : isTomorrow ? 'Tomorrow' : `${joinDay - currentDay} days away`
          });
        }
      }
    });

    if (events.length > 0) return events.slice(0, 4);

    // Fallback events if no birthdays/anniversaries in current data month
    return [
      { id: '1', type: 'BIRTHDAY', name: 'Rahim Uddin', dateStr: 'Today', badge: 'Today 🎉' },
      { id: '2', type: 'ANNIVERSARY', name: 'Sumaiya Akter', dateStr: 'Tomorrow', badge: 'Tomorrow 🏆' },
      { id: '3', type: 'BIRTHDAY', name: 'Ayon Ahmed', dateStr: '25 May', badge: '5 days away' },
      { id: '4', type: 'ANNIVERSARY', name: 'Rajasekhar Papolu', dateStr: '28 May', badge: '8 days away' }
    ];
  }, [activeEmployees]);

  // Dynamic Upcoming Company Holidays
  const upcomingHolidays = useMemo(() => {
    if (holidays.length === 0) return [];
    return holidays
      .filter(h => {
        const hDate = String(h.holiday_date || '').split('T')[0];
        return hDate >= todayStr;
      })
      .sort((a, b) => new Date(a.holiday_date).getTime() - new Date(b.holiday_date).getTime())
      .slice(0, 4);
  }, [holidays, todayStr]);

  // 6. Dynamic Department-wise Headcount grouped from Active Employees
  const departmentHeadcounts = useMemo(() => {
    if (activeEmployees.length === 0) {
      return [
        { dept: 'HR', count: 120, heightPct: '38%' },
        { dept: 'IT', count: 320, heightPct: '95%' },
        { dept: 'Finance', count: 180, heightPct: '58%' },
        { dept: 'Marketing', count: 150, heightPct: '48%' },
        { dept: 'Sales', count: 220, heightPct: '72%' },
        { dept: 'Operations', count: 160, heightPct: '52%' },
        { dept: 'Support', count: 98, heightPct: '32%' },
      ];
    }

    const counts: Record<string, number> = {};
    activeEmployees.forEach(emp => {
      const dept = (emp.department_name || (emp as any).department || 'General').trim();
      counts[dept] = (counts[dept] || 0) + 1;
    });

    const entries = Object.entries(counts);
    const maxCount = Math.max(...entries.map(([, c]) => c), 1);

    return entries.map(([dept, count]) => ({
      dept,
      count,
      heightPct: `${Math.max(18, Math.round((count / maxCount) * 95))}%`
    }));
  }, [activeEmployees]);

  const userDisplayName = myProfile 
    ? `${myProfile.first_name} ${myProfile.last_name}` 
    : email ? email.split('@')[0] : 'Ayon Ahmed';

  // Format activity relative time
  const getRelativeTime = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} min ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } catch {
      return 'Recently';
    }
  };

  // Recent activity stream with TIME, IP, MODULE and INNER SCROLLABLE LIST
  const recentActivitiesList = useMemo(() => {
    if (logs.length > 0) {
      return logs.map((l, index) => {
        const emailPrefix = l.user_email.split('@')[0];
        const actionClean = l.action.replaceAll('_', ' ').toLowerCase();
        let iconType = 'USER';
        let bgClass = 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 border-blue-100';
        
        if (l.action.includes('REGISTER') || l.action.includes('CREATE') || l.action.includes('ADD')) {
          iconType = 'ADD';
          bgClass = 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-100';
        } else if (l.action.includes('LEAVE') || l.action.includes('REQUEST')) {
          iconType = 'LEAVE';
          bgClass = 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 border-amber-100';
        } else if (l.action.includes('PAYROLL') || l.action.includes('SALARY')) {
          iconType = 'PAYROLL';
          bgClass = 'bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400 border-purple-100';
        } else if (l.action.includes('DELETE') || l.action.includes('REMOVE') || l.action.includes('FAIL')) {
          iconType = 'DELETE';
          bgClass = 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border-rose-100';
        }

        const dateObj = new Date(l.created_at);
        const formattedTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

        return {
          id: l.id || String(index),
          text: `User ${emailPrefix} performed ${actionClean}`,
          time: `${formattedTime} • ${getRelativeTime(l.created_at)}`,
          ip: l.ip_address || '127.0.0.1',
          module: l.module || 'SYSTEM',
          bgClass,
          iconType
        };
      });
    }

    return [
      { id: '1', text: 'A new employee Rakib Hasan has been added.', time: '11:28 AM • 2 min ago', ip: '183.82.162.24', module: 'EMPLOYEE', bgClass: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-100', iconType: 'ADD' },
      { id: '2', text: 'Leave request submitted by Sumaiya Akter.', time: '11:15 AM • 15 min ago', ip: '183.82.162.24', module: 'LEAVE', bgClass: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 border-amber-100', iconType: 'LEAVE' },
      { id: '3', text: 'Payroll for April 2025 has been completed.', time: '10:30 AM • 1 hour ago', ip: '183.82.162.24', module: 'PAYROLL', bgClass: 'bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400 border-purple-100', iconType: 'PAYROLL' },
      { id: '4', text: 'New document uploaded in employee folder.', time: '09:30 AM • 2 hours ago', ip: '183.82.162.24', module: 'SMART_HR', bgClass: 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 border-blue-100', iconType: 'DOC' },
      { id: '5', text: 'Performance review updated for Sales team.', time: '08:30 AM • 3 hours ago', ip: '183.82.162.24', module: 'PERFORMANCE', bgClass: 'bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400 border-teal-100', iconType: 'PERF' },
      { id: '6', text: 'System security matrix key rotation verified.', time: '07:15 AM • 4 hours ago', ip: '127.0.0.1', module: 'AUTH', bgClass: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 border-indigo-100', iconType: 'USER' },
    ];
  }, [logs]);

  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('superadmin');

  if (!isSuperAdmin) {
    return (
      <EmployeeDashboard 
        employees={employees} 
        myProfile={myProfile}
        email={email} 
        actionMessage=""
        actionError=""
        companies={[]}
        companyId={companyId}
        handleCompanyChange={() => {}}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-16 font-sans text-slate-800 dark:text-slate-100">
      
      {/* 🚀 1. TOP HEADER & BAR CONTROLS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-200/60 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              Dashboard
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800">
              Smart HRMS
            </span>
          </div>

          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white font-outfit flex items-center gap-2">
            <span>Welcome back, {userDisplayName}</span>
            <span className="inline-block animate-bounce text-2xl">👋</span>
          </h1>
        </div>

        {/* TOP RIGHT CONTROLS: DATE PICKER + DOWNLOAD REPORT */}
        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer hover:border-slate-300 transition-all">
            <Calendar className="w-4 h-4 text-indigo-500" />
            <span>May 20, 2025</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
          </div>

          <button 
            onClick={() => alert('Exporting Smart HRMS Summary Report...')}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>Download Report</span>
          </button>
        </div>
      </div>

      {/* 📊 2. TOP DYNAMIC KPI STATS ROW (5 CARDS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* KPI 1: Dynamic Total Active Employees */}
        <div className="p-4.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-md transition-all duration-200 flex items-start justify-between relative overflow-hidden group">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider block">
              Total Employees
            </span>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white font-outfit tracking-tight">
              {totalEmpCount.toLocaleString()}
            </h3>
            <div className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 mt-1">
              <span className="text-xs">↑</span>
              <span>Active in Directory</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-110 transition-transform">
            <Users className="w-5.5 h-5.5" />
          </div>
        </div>

        {/* KPI 2: Dynamic Present Today (At least 1 Raw Punch) */}
        <div className="p-4.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-md transition-all duration-200 flex items-start justify-between relative overflow-hidden group">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider block">
              Present Today
            </span>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white font-outfit tracking-tight">
              {presentTodayCount.toLocaleString()}
            </h3>
            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              <span>{presentPct}% of active</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-110 transition-transform">
            <UserCheck className="w-5.5 h-5.5" />
          </div>
        </div>

        {/* KPI 3: Dynamic On Leave Today (Leave Request from_date to to_date) */}
        <div className="p-4.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-md transition-all duration-200 flex items-start justify-between relative overflow-hidden group">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider block">
              On Leave Today
            </span>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white font-outfit tracking-tight">
              {onLeaveTodayCount}
            </h3>
            <div className="flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 mt-1">
              <span>{leavePct}% of active</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50 flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-110 transition-transform">
            <Umbrella className="w-5.5 h-5.5" />
          </div>
        </div>

        {/* KPI 4: Dynamic Absent Today (Active employees without raw punches) */}
        <div className="p-4.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-md transition-all duration-200 flex items-start justify-between relative overflow-hidden group">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider block">
              Absent Today
            </span>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white font-outfit tracking-tight">
              {absentTodayCount}
            </h3>
            <div className="flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 mt-1">
              <span>{absentPct}% of active</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/50 flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-110 transition-transform">
            <UserX className="w-5.5 h-5.5" />
          </div>
        </div>

        {/* KPI 5: New Joiners */}
        <div className="p-4.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-md transition-all duration-200 flex items-start justify-between relative overflow-hidden group">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider block">
              New Joiners (Month)
            </span>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white font-outfit tracking-tight">
              {newJoinersCount}
            </h3>
            <div className="flex items-center gap-1 text-[11px] font-bold text-sky-600 dark:text-sky-400 mt-1">
              <span className="text-xs">↑</span>
              <span>Joined this month</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-900/50 flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-110 transition-transform">
            <UserPlus className="w-5.5 h-5.5" />
          </div>
        </div>

      </div>

      {/* 📈 3. MIDDLE SECTION 1: ATTENDANCE DONUT + EMPLOYEE TREND + DYNAMIC UPCOMING EVENTS & HOLIDAYS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* CARD 1: ATTENDANCE OVERVIEW (NEAT & MODERN DESIGN) */}
        <div className="lg:col-span-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between hover:border-indigo-300 dark:hover:border-indigo-800 transition-all duration-200">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                  <PieChart className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white font-outfit">
                  Attendance Overview
                </h3>
              </div>
              <span className="text-[10px] font-extrabold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50 rounded-full px-2.5 py-0.5 flex items-center gap-1.5 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                Live Today
              </span>
            </div>

            <div className="my-4 flex flex-col sm:flex-row items-center justify-between gap-5">
              <div className="relative w-32 h-32 flex items-center justify-center shrink-0">
                <svg className="w-full h-full -rotate-90 filter drop-shadow-xs" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#f1f5f9" strokeWidth="12" className="dark:stroke-slate-800" />
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#10b981" strokeWidth="12" strokeDasharray={`${Math.round(Number(presentPct) * 2.387)} 238.7`} strokeDashoffset="0" strokeLinecap="round" />
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#f59e0b" strokeWidth="12" strokeDasharray={`${Math.round(Number(leavePct) * 2.387)} 238.7`} strokeDashoffset={`-${Math.round(Number(presentPct) * 2.387)}`} strokeLinecap="round" />
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#f43f5e" strokeWidth="12" strokeDasharray={`${Math.round(Number(absentPct) * 2.387)} 238.7`} strokeDashoffset={`-${Math.round((Number(presentPct) + Number(leavePct)) * 2.387)}`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-xl font-black text-slate-900 dark:text-white font-outfit leading-none">
                    {totalEmpCount}
                  </span>
                  <span className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-widest mt-1">
                    TOTAL
                  </span>
                </div>
              </div>

              <div className="space-y-2 w-full text-xs font-semibold">
                <div className="p-2 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs" />
                    <span className="text-slate-700 dark:text-slate-300 font-bold">Present</span>
                  </div>
                  <span className="font-black text-emerald-700 dark:text-emerald-300">{presentTodayCount} ({presentPct}%)</span>
                </div>

                <div className="p-2 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-xs" />
                    <span className="text-slate-700 dark:text-slate-300 font-bold">On Leave</span>
                  </div>
                  <span className="font-black text-amber-700 dark:text-amber-300">{onLeaveTodayCount} ({leavePct}%)</span>
                </div>

                <div className="p-2 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-xs" />
                    <span className="text-slate-700 dark:text-slate-300 font-bold">Absent</span>
                  </div>
                  <span className="font-black text-rose-700 dark:text-rose-300">{absentTodayCount} ({absentPct}%)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
            <Link 
              href="/dashboard/attendance" 
              className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 group"
            >
              <span>View Attendance Report</span>
              <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </div>
        </div>

        {/* CARD 2: DYNAMIC EVENTS & CELEBRATIONS (EXPANDED WITH AVATARS & ANIMATIONS) */}
        <div className="lg:col-span-8 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 animate-spin-slow" />
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white font-outfit flex items-center gap-2">
                  <span>Events & Celebrations</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-pink-100 dark:bg-pink-900/60 text-pink-700 dark:text-pink-300">
                    Live 🎉
                  </span>
                </h3>
              </div>
              <Link href="/dashboard/holidays" className="text-xs font-extrabold text-indigo-600 hover:underline flex items-center gap-1">
                <span>View All Holidays</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Today's Birthdays & Anniversaries (Interactive Carousel + Loader) */}
            <div className="space-y-3 my-3">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <PartyPopper className="w-3.5 h-3.5 text-pink-500 animate-bounce" />
                  Today's Celebrations ({todayEvents.length})
                </span>

                {/* Carousel Controls (when > 2 cards) */}
                {todayEvents.length > 2 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setCurrentEventIndex(prev => (prev - 2 < 0 ? Math.max(0, todayEvents.length - 2) : prev - 2))}
                      className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 text-slate-600 dark:text-slate-300 hover:text-indigo-600 transition-all cursor-pointer"
                      title="Previous Celebrations"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 px-1">
                      {Math.floor(currentEventIndex / 2) + 1} / {Math.ceil(todayEvents.length / 2)}
                    </span>
                    <button
                      onClick={() => setCurrentEventIndex(prev => (prev + 2 >= todayEvents.length ? 0 : prev + 2))}
                      className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 text-slate-600 dark:text-slate-300 hover:text-indigo-600 transition-all cursor-pointer"
                      title="Next Celebrations"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Loader State */}
              {eventsLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[1, 2].map(i => (
                    <div key={i} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700 animate-pulse flex flex-col justify-between space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />
                        <div className="space-y-1.5 flex-1">
                          <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded-md w-3/4" />
                          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-md w-1/2" />
                        </div>
                      </div>
                      <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded-xl w-full" />
                    </div>
                  ))}
                </div>
              ) : todayEvents.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 transition-all duration-500">
                  {todayEvents.slice(currentEventIndex, currentEventIndex + 2).map(event => (
                    <div 
                      key={event.eventId}
                      className={`p-3.5 rounded-2xl border transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 flex flex-col justify-between ${
                        event.eventType === 'BIRTHDAY'
                          ? 'bg-gradient-to-br from-pink-50/90 via-purple-50/50 to-pink-100/60 dark:from-pink-950/40 dark:via-purple-950/20 dark:to-pink-900/30 border-pink-200/90 dark:border-pink-900/60 shadow-pink-100/50 dark:shadow-none'
                          : 'bg-gradient-to-br from-amber-50/90 via-yellow-50/50 to-amber-100/60 dark:from-amber-950/40 dark:via-yellow-950/20 dark:to-amber-900/30 border-amber-200/90 dark:border-amber-900/60 shadow-amber-100/50 dark:shadow-none'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Employee Avatar Image / First Letter Initial */}
                            {event.empImage ? (
                              <img 
                                src={event.empImage} 
                                alt={event.employeeName}
                                className="w-12 h-12 rounded-full object-cover border-2 border-pink-400 dark:border-pink-500 shadow-md ring-2 ring-pink-100 dark:ring-pink-900/50 shrink-0" 
                              />
                            ) : (
                              <div className="relative shrink-0">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-lg text-white shadow-md ${
                                  event.eventType === 'BIRTHDAY'
                                    ? 'bg-gradient-to-tr from-pink-500 via-rose-500 to-purple-600 shadow-pink-200 dark:shadow-none'
                                    : 'bg-gradient-to-tr from-amber-500 via-yellow-500 to-orange-600 shadow-amber-200 dark:shadow-none'
                                }`}>
                                  {event.employeeName ? event.employeeName.trim().charAt(0).toUpperCase() : 'E'}
                                </div>
                                <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white border-2 border-white dark:border-slate-900 shadow-xs ${
                                  event.eventType === 'BIRTHDAY' ? 'bg-pink-600' : 'bg-amber-600'
                                }`}>
                                  {event.eventType === 'BIRTHDAY' ? '🎂' : '🏆'}
                                </div>
                              </div>
                            )}

                            <div className="min-w-0">
                              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white truncate font-outfit">
                                {event.employeeName}
                              </h4>
                              <p className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold truncate mt-0.5">
                                {event.eventType === 'BIRTHDAY' ? 'Birthday Today 🎉' : 'Work Anniversary Today 🏆'}
                              </p>
                              <p className="text-[10px] text-slate-400 dark:text-slate-400 font-medium truncate">
                                {event.designation}
                              </p>
                            </div>
                          </div>

                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black shrink-0 animate-pulse shadow-xs ${
                            event.eventType === 'BIRTHDAY'
                              ? 'bg-pink-500 text-white dark:bg-pink-600'
                              : 'bg-amber-500 text-white dark:bg-amber-600'
                          }`}>
                            Today 🎉
                          </span>
                        </div>
                      </div>

                      {/* Interactive Actions Bar */}
                      <div>
                        <div className="flex items-center justify-between pt-2.5 mt-3 border-t border-slate-200/70 dark:border-slate-800">
                          <div className="flex items-center gap-2">
                            {/* Like Button with Flower Burst */}
                            <div className="relative inline-block">
                              <button
                                onClick={() => handleToggleReaction(event.eventId, 'LIKE')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all duration-200 active:scale-125 flex items-center gap-1.5 cursor-pointer ${
                                  event.userReaction === 'LIKE'
                                    ? 'bg-rose-500 text-white shadow-md shadow-rose-200 dark:shadow-none ring-2 ring-rose-300'
                                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-rose-50 hover:text-rose-600 border border-slate-200 dark:border-slate-700'
                                }`}
                              >
                                <Heart className={`w-3.5 h-3.5 ${event.userReaction === 'LIKE' ? 'fill-current animate-bounce' : ''}`} />
                                <span>{event.reactionCount > 0 ? event.reactionCount : 'Like'}</span>
                              </button>

                              {/* Animated Flower Burst Particle Overlay */}
                              {flowerBurstEventId === event.eventId && (
                                <div className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center overflow-visible">
                                  {[
                                    { emoji: '🌸', style: { '--tx': '-35px', '--ty': '-65px', '--rot': '-25deg', animationDelay: '0ms' } },
                                    { emoji: '🌺', style: { '--tx': '35px', '--ty': '-70px', '--rot': '30deg', animationDelay: '50ms' } },
                                    { emoji: '💐', style: { '--tx': '-55px', '--ty': '-40px', '--rot': '-45deg', animationDelay: '100ms' } },
                                    { emoji: '🌷', style: { '--tx': '55px', '--ty': '-45px', '--rot': '40deg', animationDelay: '80ms' } },
                                    { emoji: '❤️', style: { '--tx': '0px', '--ty': '-80px', '--rot': '0deg', animationDelay: '20ms' } },
                                    { emoji: '✨', style: { '--tx': '-25px', '--ty': '-85px', '--rot': '-15deg', animationDelay: '120ms' } },
                                    { emoji: '🌸', style: { '--tx': '25px', '--ty': '-90px', '--rot': '20deg', animationDelay: '150ms' } },
                                    { emoji: '💖', style: { '--tx': '-45px', '--ty': '-25px', '--rot': '-35deg', animationDelay: '60ms' } }
                                  ].map((p, idx) => (
                                    <span
                                      key={idx}
                                      className="absolute text-xl font-bold pointer-events-none select-none"
                                      style={{
                                        ...p.style,
                                        animation: 'flowerParticleBurst 1.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
                                      } as React.CSSProperties}
                                    >
                                      {p.emoji}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Wish Button */}
                            <button
                              onClick={() => setOpenWishInputEventId(openWishInputEventId === event.eventId ? null : event.eventId)}
                              className="px-3 py-1.5 rounded-xl text-xs font-extrabold bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 border border-slate-200 dark:border-slate-700 transition-all duration-200 active:scale-95 flex items-center gap-1.5"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>Say Congrats</span>
                            </button>
                          </div>

                          {/* Wishes Counter / Toggle */}
                          {event.wishCount > 0 && (
                            <button
                              onClick={() => setExpandedWishesEventId(expandedWishesEventId === event.eventId ? null : event.eventId)}
                              className="text-[11px] font-extrabold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 bg-indigo-50/70 dark:bg-indigo-950/50 px-2 py-1 rounded-lg"
                            >
                              <span>{event.wishCount} {event.wishCount === 1 ? 'Wish' : 'Wishes'}</span>
                            </button>
                          )}
                        </div>

                        {/* Inline Wish Input Form */}
                        {openWishInputEventId === event.eventId && (
                          <div className="mt-2.5 pt-2 flex items-center gap-2 animate-fadeIn">
                            <input
                              type="text"
                              placeholder={event.eventType === 'BIRTHDAY' ? 'Write a happy birthday message...' : 'Write congratulations message...'}
                              value={wishMessages[event.eventId] || ''}
                              onChange={(e) => setWishMessages({ ...wishMessages, [event.eventId]: e.target.value })}
                              onKeyDown={(e) => e.key === 'Enter' && handleSendWish(event.eventId)}
                              className="flex-1 px-3 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                            />
                            <button
                              onClick={() => handleSendWish(event.eventId)}
                              disabled={submittingWishId === event.eventId || !wishMessages[event.eventId]?.trim()}
                              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white transition-all flex items-center gap-1 shadow-xs"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Send</span>
                            </button>
                          </div>
                        )}

                        {/* Expandable Wishes List */}
                        {expandedWishesEventId === event.eventId && event.wishes && event.wishes.length > 0 && (
                          <div className="mt-2.5 pt-2 border-t border-dashed border-slate-200/80 dark:border-slate-800 space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                            {event.wishes.map((w: any) => (
                              <div key={w.id} className="p-2 rounded-xl bg-white/80 dark:bg-slate-800/90 border border-slate-100 dark:border-slate-700/60 text-xs shadow-2xs">
                                <div className="flex items-center justify-between gap-1 text-[10.5px] font-bold text-slate-800 dark:text-slate-200">
                                  <div className="flex items-center gap-1.5">
                                    {w.senderEmpImage ? (
                                      <img src={w.senderEmpImage} alt={w.senderName} className="w-4 h-4 rounded-full object-cover" />
                                    ) : (
                                      <div className="w-4 h-4 rounded-full bg-indigo-500 text-white text-[9px] flex items-center justify-center font-bold">
                                        {w.senderName ? w.senderName.charAt(0) : 'U'}
                                      </div>
                                    )}
                                    <span>{w.senderName}</span>
                                  </div>
                                  <span className="text-[9.5px] text-slate-400 font-normal">
                                    {new Date(w.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <p className="text-[11.5px] text-slate-700 dark:text-slate-300 font-medium mt-1 pl-5">
                                  {w.message}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center bg-slate-50/50 dark:bg-slate-900/50">
                  <Cake className="w-8 h-8 text-pink-400 mx-auto mb-2 opacity-70 animate-bounce" />
                  <p className="text-xs font-extrabold text-slate-700 dark:text-slate-300">No birthdays or anniversaries today</p>
                  <p className="text-[11px] text-slate-400 mt-1">Check back tomorrow for upcoming employee celebrations!</p>
                </div>
              )}
            </div>

            {/* Dynamic Upcoming Company Holidays */}
            <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                  Upcoming Company Holidays ({upcomingHolidays.length})
                </span>
                {upcomingHolidays.length > 1 && (
                  <span className="text-[10px] font-bold text-indigo-500/80">Scroll for more ↓</span>
                )}
              </div>

              {upcomingHolidays.length > 0 ? (
                <div className="max-h-[58px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {upcomingHolidays.map(hol => (
                    <div key={hol.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700 flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <span className="font-extrabold text-slate-800 dark:text-slate-100 truncate block">
                          {hol.name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium block">
                          {new Date(hol.holiday_date).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-md text-[9.5px] font-extrabold shrink-0 border ${
                        hol.is_restricted 
                          ? 'bg-purple-50 text-purple-700 border-purple-200' 
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {hol.is_restricted ? 'Restricted' : 'General'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 text-center">
                  <span className="text-xs font-semibold text-slate-400">No upcoming holidays scheduled</span>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* 💼 4. MIDDLE SECTION 2: LEAVE + PAYROLL + RECRUITMENT + QUICK ACCESS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* CARD 1: LEAVE SUMMARY */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white font-outfit flex items-center gap-1.5">
              <FileCheck className="w-4 h-4 text-indigo-600" />
              Leave Summary
            </h3>
            <select className="text-[11px] font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-0.5 text-slate-700 dark:text-slate-300 outline-none">
              <option>This Month</option>
            </select>
          </div>

          <div className="space-y-3 my-4">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-500">Total Leave</span>
              <span className="font-extrabold text-slate-900 dark:text-white">{leaveRequests.length || 186}</span>
            </div>
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-emerald-600 dark:text-emerald-400">Approved</span>
              <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                {leaveRequests.filter(r => (r.status || '').toUpperCase() === 'APPROVED').length || 126}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-amber-600 dark:text-amber-400">Pending</span>
              <span className="font-extrabold text-amber-600 dark:text-amber-400">
                {leaveRequests.filter(r => (r.status || '').toUpperCase() === 'PENDING').length || 36}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-rose-600 dark:text-rose-400">Rejected</span>
              <span className="font-extrabold text-rose-600 dark:text-rose-400">
                {leaveRequests.filter(r => (r.status || '').toUpperCase() === 'REJECTED').length || 24}
              </span>
            </div>
          </div>

          <div className="pt-3 text-center border-t border-slate-100 dark:border-slate-800">
            <Link href="/dashboard/leaves" className="text-xs font-extrabold text-indigo-600 hover:underline inline-flex items-center gap-1">
              <span>View Leave Report</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* CARD 2: PAYROLL SUMMARY */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white font-outfit flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              Payroll Summary
            </h3>
            <select className="text-[11px] font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-0.5 text-slate-700 dark:text-slate-300 outline-none">
              <option>May 2025</option>
            </select>
          </div>

          <div className="my-3 space-y-3">
            <div className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800 flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-300">
                Payroll Status: Processing
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center pt-1">
              <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Total Employees</span>
                <span className="text-sm font-black text-slate-900 dark:text-white">{totalEmpCount}</span>
              </div>
              <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Total Payroll Cost</span>
                <span className="text-sm font-black text-slate-900 dark:text-white">৳ 28,65,540</span>
              </div>
            </div>
          </div>

          <div className="pt-3 text-center border-t border-slate-100 dark:border-slate-800">
            <Link href="/dashboard/payroll" className="text-xs font-extrabold text-indigo-600 hover:underline inline-flex items-center gap-1">
              <span>View Payroll Dashboard</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* CARD 3: RECRUITMENT SUMMARY */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white font-outfit flex items-center gap-1.5">
              <Briefcase className="w-4 h-4 text-sky-600" />
              Recruitment Summary
            </h3>
            <select className="text-[11px] font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-0.5 text-slate-700 dark:text-slate-300 outline-none">
              <option>This Month</option>
            </select>
          </div>

          <div className="space-y-2.5 my-3 text-xs font-semibold">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Total Openings</span>
              <span className="font-extrabold text-slate-900 dark:text-white">18</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Active Candidates</span>
              <span className="font-extrabold text-slate-900 dark:text-white">156</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Interviews Scheduled</span>
              <span className="font-extrabold text-slate-900 dark:text-white">32</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Offers Sent</span>
              <span className="font-extrabold text-slate-900 dark:text-white">12</span>
            </div>
          </div>

          <div className="pt-3 text-center border-t border-slate-100 dark:border-slate-800">
            <Link href="/dashboard/recruitment" className="text-xs font-extrabold text-indigo-600 hover:underline inline-flex items-center gap-1">
              <span>View Recruitment Dashboard</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* CARD 4: QUICK ACCESS GRID */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white font-outfit flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-purple-600" />
              Quick Access
            </h3>
          </div>

          <div className="grid grid-cols-4 gap-2 my-2">
            <Link href="/dashboard/employees/create" className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-center group">
              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <UserPlus className="w-4.5 h-4.5" />
              </div>
              <span className="text-[10px] font-extrabold text-slate-700 dark:text-slate-300 line-clamp-1">Add Employee</span>
            </Link>

            <Link href="/dashboard/leaves/requests" className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-center group">
              <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Umbrella className="w-4.5 h-4.5" />
              </div>
              <span className="text-[10px] font-extrabold text-slate-700 dark:text-slate-300 line-clamp-1">Apply Leave</span>
            </Link>

            <Link href="/dashboard/attendance" className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-center group">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <UserCheck className="w-4.5 h-4.5" />
              </div>
              <span className="text-[10px] font-extrabold text-slate-700 dark:text-slate-300 line-clamp-1">Attendance</span>
            </Link>

            <Link href="/dashboard/payslip" className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-center group">
              <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <FileText className="w-4.5 h-4.5" />
              </div>
              <span className="text-[10px] font-extrabold text-slate-700 dark:text-slate-300 line-clamp-1">Payslip</span>
            </Link>

            <Link href="/dashboard/recruitment" className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-center group">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Briefcase className="w-4.5 h-4.5" />
              </div>
              <span className="text-[10px] font-extrabold text-slate-700 dark:text-slate-300 line-clamp-1">Recruitment</span>
            </Link>

            <Link href="/dashboard/performance" className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-center group">
              <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Award className="w-4.5 h-4.5" />
              </div>
              <span className="text-[10px] font-extrabold text-slate-700 dark:text-slate-300 line-clamp-1">Performance</span>
            </Link>

            <Link href="/dashboard/smart-hr" className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-center group">
              <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <FileCheck className="w-4.5 h-4.5" />
              </div>
              <span className="text-[10px] font-extrabold text-slate-700 dark:text-slate-300 line-clamp-1">Documents</span>
            </Link>

            <Link href="/dashboard/analytics" className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-center group">
              <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <BarChart3 className="w-4.5 h-4.5" />
              </div>
              <span className="text-[10px] font-extrabold text-slate-700 dark:text-slate-300 line-clamp-1">Reports</span>
            </Link>
          </div>
        </div>

      </div>

      {/* 📊 5. BOTTOM SECTION: DYNAMIC DEPARTMENT HEADCOUNT (SLIM BARS) + RECENT ACTIVITIES (INNER SCROLL + TIME + IP) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* CARD 1: DYNAMIC DEPARTMENT-WISE HEADCOUNT */}
        <div className="lg:col-span-7 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white font-outfit">
                Department-wise Headcount
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {departmentHeadcounts.length > 6 && (
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <span>←</span> Scroll <span>→</span>
                </span>
              )}
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 border border-indigo-200/60">
                {departmentHeadcounts.length} Departments
              </span>
            </div>
          </div>

          {/* DYNAMIC SCROLLABLE BAR CHART CONTAINER */}
          <div className="my-4 relative w-full overflow-x-auto pb-2 pt-6">
            {/* Grid Horizontal Lines */}
            <div className="absolute inset-x-0 bottom-12 top-6 flex flex-col justify-between pointer-events-none opacity-20">
              <div className="border-b border-slate-300 dark:border-slate-700 w-full" />
              <div className="border-b border-slate-300 dark:border-slate-700 w-full" />
              <div className="border-b border-slate-300 dark:border-slate-700 w-full" />
              <div className="border-b border-slate-300 dark:border-slate-700 w-full" />
            </div>

            {/* Scrollable Track */}
            <div className="flex items-end gap-3 sm:gap-4 min-w-full w-max h-56 px-3 z-10 relative">
              {departmentHeadcounts.map(item => (
                <div key={item.dept} className="flex flex-col items-center gap-2 h-full justify-end group shrink-0 min-w-[76px] sm:min-w-[84px] max-w-[100px]">
                  {/* Count Badge */}
                  <span className="text-[11px] font-black text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/80 px-2 py-0.5 rounded-md border border-indigo-200/60 dark:border-indigo-800 shadow-2xs group-hover:scale-110 transition-transform">
                    {item.count}
                  </span>

                  {/* Bar */}
                  <div className="w-full h-full flex items-end justify-center">
                    <div 
                      className="w-5 sm:w-6 bg-gradient-to-t from-indigo-600 to-indigo-400 dark:from-indigo-500 dark:to-indigo-300 rounded-t-lg transition-all duration-300 shadow-xs group-hover:shadow-md group-hover:brightness-110 cursor-pointer"
                      style={{ height: item.heightPct }}
                    />
                  </div>

                  {/* Department Label */}
                  <span 
                    className="text-[11px] font-bold text-slate-700 dark:text-slate-300 text-center truncate max-w-[80px] sm:max-w-[90px] pt-1" 
                    title={item.dept}
                  >
                    {item.dept}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CARD 2: RECENT ACTIVITIES FEED */}
        <div className="lg:col-span-5 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white font-outfit">
                Recent Activities
              </h3>
            </div>
            <span className="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
              {recentActivitiesList.length} Events
            </span>
          </div>

          {/* INNER SCROLLABLE TIMELINE LIST */}
          <div className="space-y-2.5 my-3 max-h-[320px] overflow-y-auto pr-1">
            {recentActivitiesList.map((act) => (
              <div 
                key={act.id} 
                className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3 hover:border-slate-200 dark:hover:border-slate-700 transition-all"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`w-8.5 h-8.5 rounded-xl ${act.bgClass} flex items-center justify-center shrink-0 border border-slate-200/40 dark:border-slate-700/50 shadow-2xs mt-0.5`}>
                    {act.iconType === 'ADD' ? (
                      <UserPlus className="w-4 h-4" />
                    ) : act.iconType === 'LEAVE' ? (
                      <Umbrella className="w-4 h-4" />
                    ) : act.iconType === 'PAYROLL' ? (
                      <DollarSign className="w-4 h-4" />
                    ) : act.iconType === 'DOC' ? (
                      <FileCheck className="w-4 h-4" />
                    ) : (
                      <User className="w-4 h-4" />
                    )}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2">
                      {act.text}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap text-[10.5px] font-semibold text-slate-400">
                      <span className="flex items-center gap-1 font-mono text-slate-500 dark:text-slate-400">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {act.time}
                      </span>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span className="flex items-center gap-1 font-mono text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200/80 dark:border-slate-700 text-[9.5px]">
                        <Globe className="w-2.5 h-2.5 text-slate-400" />
                        {act.ip}
                      </span>
                    </div>
                  </div>
                </div>

                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 mt-2" />
              </div>
            ))}
          </div>

          <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 text-center">
            <span className="text-[11px] font-bold text-slate-400">
              Inner scroll enabled • Real-time audit log sync active
            </span>
          </div>
        </div>

      </div>

    </div>
  );
}


function EmployeeDashboard({
  employees,
  myProfile,
  email,
  actionMessage: _actionMessage,
  actionError: _actionError,
  companies: _companies,
  companyId,
  handleCompanyChange: _handleCompanyChange
}: {
  employees: Employee[];
  myProfile?: Employee | null;
  email: string;
  actionMessage: string;
  actionError: string;
  companies: Company[];
  companyId: string | null;
  handleCompanyChange: (id: string) => void;
}) {
  const { hasPermission } = usePermissions();
  const canViewAttendance = hasPermission('view_attendance');

  const rolesStr = typeof window !== 'undefined' ? localStorage.getItem('roles') : null;
  const roles: string[] = rolesStr ? JSON.parse(rolesStr) : [];
  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('superadmin');

  const [time, setTime] = useState<Date | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState<string | null>(null);

  const [holidays, setHolidays] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [_regularizations, setRegularizations] = useState<any[]>([]);
  const [_permissions, setPermissions] = useState<any[]>([]);
  const [_dataLoading, setDataLoading] = useState(false);

  // Calendar state for My Attendance Calendar
  const [currentDate, setCurrentDate] = useState(new Date(2026, 6, 1)); // Default July 2026

  useEffect(() => {
    const fetchData = async () => {
      setDataLoading(true);
      try {
        const headers = getHeaders();
        const holRes = await fetch(getUrl('/api/v1/holidays', companyId), { headers });
        if (holRes.ok) {
          const d = await holRes.json();
          setHolidays(d.holidays || []);
        }

        const leaveRes = await fetch(getUrl('/api/v1/leave-requests', companyId), { headers });
        if (leaveRes.ok) {
          const d = await leaveRes.json();
          setLeaveRequests(d.requests || []);
        }

        const regRes = await fetch(getUrl('/api/v1/attendance/regularizations', companyId), { headers });
        if (regRes.ok) {
          const d = await regRes.json();
          setRegularizations(d.regularizations || []);
        }

        const permRes = await fetch(getUrl('/api/v1/attendance/permissions', companyId), { headers });
        if (permRes.ok) {
          const d = await permRes.json();
          setPermissions(d.permissions || []);
        }
      } catch (e) {
        console.error('Error fetching employee dashboard stats:', e);
      } finally {
        setDataLoading(false);
      }
    };

    fetchData();
  }, [companyId]);

  useEffect(() => {
    setTime(new Date());
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const [punching, setPunching] = useState(false);
  const [punchMsg, setPunchMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [firstInTimestamp, setFirstInTimestamp] = useState<Date | null>(null);
  const [accumulatedPastSeconds, setAccumulatedPastSeconds] = useState<number>(0);
  const [currentInTimestamp, setCurrentInTimestamp] = useState<Date | null>(null);
  const [elapsedWorkingSeconds, setElapsedWorkingSeconds] = useState<number>(0);
  const [todayLocationName, setTodayLocationName] = useState<string | null>(null);

  // 📸 Mark Attendance Modal State in Overview page
  const [punchModalOpen, setPunchModalOpen] = useState(false);
  const [punchDirection, setPunchDirection] = useState<'IN' | 'OUT'>('IN');
  const [punchLat, setPunchLat] = useState<number | null>(null);
  const [punchLng, setPunchLng] = useState<number | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [capturedSelfie, setCapturedSelfie] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isSubmittingPunch, setIsSubmittingPunch] = useState(false);
  const [modalPunchMsg, setModalPunchMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchAddressName = async (lat: number, lng: number) => {
    try {
      setLocationName('Locating address...');
      const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyCN9htaexjSDWMVybqWtlSl1ygNpZWkobg';
      if (googleApiKey) {
        const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googleApiKey}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.results && data.results.length > 0) {
            setLocationName(data.results[0].formatted_address);
            setTodayLocationName(data.results[0].formatted_address);
            return;
          }
        }
      }
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=en`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.display_name) {
          setLocationName(data.display_name);
          setTodayLocationName(data.display_name);
          return;
        }
      }
    } catch (e) {
      console.warn('Reverse geocode error:', e);
    }
    setLocationName(`Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`);
  };

  const startCamera = async () => {
    try {
      setCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setGpsError('Could not access webcam for selfie verification.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const captureSelfie = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedSelfie(dataUrl);
        stopCamera();
      }
    }
  };

  const fetchIPLocationFallback = async () => {
    try {
      const res = await fetch('https://ipapi.co/json/');
      if (res.ok) {
        const data = await res.json();
        if (data && data.latitude && data.longitude) {
          setPunchLat(data.latitude);
          setPunchLng(data.longitude);
          const cityState = [data.city, data.region, data.country_name].filter(Boolean).join(', ');
          setLocationName(cityState || 'Location Detected (Network)');
          setTodayLocationName(cityState || 'Location Detected (Network)');
          setGpsError(null);
          return true;
        }
      }
    } catch (e) {}
    return false;
  };

  const getGPSLocation = () => {
    setGpsLoading(true);
    setGpsError(null);
    setLocationName('Detecting live location...');

    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPunchLat(pos.coords.latitude);
          setPunchLng(pos.coords.longitude);
          fetchAddressName(pos.coords.latitude, pos.coords.longitude);
          setGpsLoading(false);
        },
        async () => {
          const success = await fetchIPLocationFallback();
          if (!success) {
            setGpsError('Unable to retrieve location. Please allow browser location permissions or click Re-detect GPS.');
          }
          setGpsLoading(false);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      fetchIPLocationFallback().then((success) => {
        if (!success) {
          setGpsError('Geolocation is not supported by your browser.');
        }
        setGpsLoading(false);
      });
    }
  };

  const openMarkAttendanceModal = () => {
    const nextDirection = checkedIn ? 'OUT' : 'IN';
    setPunchDirection(nextDirection);
    setPunchModalOpen(true);
    getGPSLocation();
    startCamera();
  };

  const submitWebPunch = async () => {
    setIsSubmittingPunch(true);
    setModalPunchMsg(null);
    try {
      const targetEmpId = me?.id || localStorage.getItem('employeeId') || '';
      const cid = localStorage.getItem('companyId') || companyId;

      const d = new Date();
      const tzOffset = -d.getTimezoneOffset();
      const diff = tzOffset >= 0 ? '+' : '-';
      const pad = (num: number) => String(Math.floor(Math.abs(num))).padStart(2, '0');
      const localIso = d.getFullYear() +
        '-' + pad(d.getMonth() + 1) +
        '-' + pad(d.getDate()) +
        'T' + pad(d.getHours()) +
        ':' + pad(d.getMinutes()) +
        ':' + pad(d.getSeconds()) +
        diff + pad(tzOffset / 60) + ':' + pad(tzOffset % 60);

      const isMobileDevice = typeof window !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
      const punchSource = isMobileDevice ? 'MOBILE' : 'WEB';

      const body = {
        companyId: cid,
        employee_id: targetEmpId,
        punch_time: localIso,
        direction: punchDirection,
        source: punchSource,
        latitude: punchLat,
        longitude: punchLng,
        image_url: capturedSelfie,
        location_name: locationName,
        device_identifier: getDeviceIdentifier(),
        device_model: getDeviceModel(),
      };

      const res = await fetch('/api/v1/attendance/punches', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (res.ok) {
        setModalPunchMsg({ type: 'success', text: `Punch ${punchDirection} recorded successfully!` });
        const nextState = punchDirection === 'IN';
        setCheckedIn(nextState);
        setTimeout(() => {
          setPunchModalOpen(false);
          stopCamera();
          window.location.reload();
        }, 1000);
      } else {
        setModalPunchMsg({ type: 'error', text: data.error || 'Failed to record punch' });
      }
    } catch (err: any) {
      setModalPunchMsg({ type: 'error', text: err?.message || 'Network error submitting punch' });
    } finally {
      setIsSubmittingPunch(false);
    }
  };

  // Fetch today's actual punch status and calculate interval-based working hours
  useEffect(() => {
    const fetchTodayPunchStatus = async () => {
      try {
        const headers = getHeaders();
        const res = await fetch('/api/v1/attendance/punches', { headers });
        if (res.ok) {
          const data = await res.json();
          const punches = data.punches || [];
          setAllPunches(punches);
          const todayStr = new Date().toISOString().split('T')[0];
          const todayPunches = punches.filter((p: any) => String(p.punch_time).startsWith(todayStr));
          
          if (todayPunches.length > 0) {
            const sortedPunches = [...todayPunches].sort((a: any, b: any) => new Date(a.punch_time).getTime() - new Date(b.punch_time).getTime());
            
            let totalPastSecs = 0;
            let activeInDate: Date | null = null;
            let firstInDate: Date | null = null;

            for (const p of sortedPunches) {
              const pDate = new Date(p.punch_time);
              if (p.direction === 'IN') {
                if (!firstInDate) firstInDate = pDate;
                activeInDate = pDate;
              } else if (p.direction === 'OUT' && activeInDate) {
                const durationSecs = Math.max(0, Math.floor((pDate.getTime() - activeInDate.getTime()) / 1000));
                totalPastSecs += durationSecs;
                activeInDate = null;
              }
            }

            setAccumulatedPastSeconds(totalPastSecs);
            setCurrentInTimestamp(activeInDate);
            setCheckedIn(!!activeInDate);

            if (firstInDate) {
              setFirstInTimestamp(firstInDate);
              setCheckInTime(firstInDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }));
            }

            const lastPunchWithLoc = [...sortedPunches].reverse().find((p: any) => p.location_name || (p.latitude && p.longitude));
            if (lastPunchWithLoc) {
              if (lastPunchWithLoc.location_name) {
                setTodayLocationName(lastPunchWithLoc.location_name);
              } else if (lastPunchWithLoc.latitude && lastPunchWithLoc.longitude) {
                fetchAddressName(lastPunchWithLoc.latitude, lastPunchWithLoc.longitude);
              }
            }
          } else {
            setCheckedIn(false);
            setAccumulatedPastSeconds(0);
            setCurrentInTimestamp(null);
            setFirstInTimestamp(null);
          }
        }
      } catch (e) {}
    };
    fetchTodayPunchStatus();
  }, [companyId]);

  // Live timer tick for working hours (Accumulated past sessions + current session)
  useEffect(() => {
    const updateElapsed = () => {
      let currentSessionSecs = 0;
      if (currentInTimestamp) {
        const now = new Date();
        currentSessionSecs = Math.max(0, Math.floor((now.getTime() - currentInTimestamp.getTime()) / 1000));
      }
      setElapsedWorkingSeconds(accumulatedPastSeconds + currentSessionSecs);
    };

    updateElapsed();

    if (currentInTimestamp) {
      const interval = setInterval(updateElapsed, 1000);
      return () => clearInterval(interval);
    }
  }, [accumulatedPastSeconds, currentInTimestamp]);

  const formatWorkingHours = (totalSecs: number) => {
    if (!totalSecs || totalSecs <= 0) return '00h 00m 00s';
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${String(hrs).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
  };

  const getGreeting = () => {
    if (!time) return 'Good Morning,';
    const hrs = time.getHours();
    if (hrs < 12) return 'Good Morning,';
    if (hrs < 17) return 'Good Afternoon,';
    return 'Good Evening,';
  };

  const me = myProfile || employees.find(emp => emp.email?.toLowerCase() === email.toLowerCase());
  const displayName = me ? `${me.first_name} ${me.last_name}` : email.split('@')[0];

  const getBirthdaysToday = () => {
    const today = new Date();
    const currentMonth = today.getMonth(); // 0-indexed
    const currentDate = today.getDate(); // 1-indexed
    
    return employees
      .filter(emp => {
        if (!emp.dob) return false;
        const parts = emp.dob.split('T')[0].split('-');
        if (parts.length < 3) return false;
        const dobMonth = parseInt(parts[1], 10) - 1;
        const dobDate = parseInt(parts[2], 10);
        return dobMonth === currentMonth && dobDate === currentDate;
      })
      .map(emp => ({
        name: `${emp.first_name} ${emp.last_name}`,
        designation: emp.designation_name || 'Engineering',
        image: emp.emp_image,
      }));
  };

  const getAnniversariesToday = () => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentDate = today.getDate();
    
    return employees
      .filter(emp => {
        if (!emp.joining_date) return false;
        const parts = emp.joining_date.split('T')[0].split('-');
        if (parts.length < 3) return false;
        const joinMonth = parseInt(parts[1], 10) - 1;
        const joinDate = parseInt(parts[2], 10);
        const joinYear = parseInt(parts[0], 10);
        const years = today.getFullYear() - joinYear;
        return joinMonth === currentMonth && joinDate === currentDate && years >= 1;
      })
      .map(emp => {
        const parts = emp.joining_date.split('T')[0].split('-');
        const joinYear = parseInt(parts[0], 10);
        const years = today.getFullYear() - joinYear;
        return {
          name: `${emp.first_name} ${emp.last_name}`,
          years: years > 0 ? years : 1,
          designation: emp.designation_name || 'Sales & Marketing',
          image: emp.emp_image,
        };
      });
  };

  const [allPunches, setAllPunches] = useState<any[]>([]);

  // Month Calendar Days Generator
  const getCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const days = [];

    // Previous month filler
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ day: prevMonthDays - i, isCurrentMonth: false, status: 'none' });
    }

    const today = new Date();

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      const dayOfWeek = dateObj.getDay();
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      
      const dayPunches = allPunches.filter((p: any) => String(p.punch_time).startsWith(dateStr));
      const hasInPunch = dayPunches.some((p: any) => p.direction === 'IN');
      const isLeave = leaveRequests.some((lr: any) => {
        const f = String(lr.start_date || lr.from_date || '').split('T')[0];
        const t = String(lr.end_date || lr.to_date || f).split('T')[0];
        return dateStr >= f && dateStr <= t && (lr.status === 'APPROVED' || lr.status === 'PENDING');
      });

      let status = 'none';

      if (dayOfWeek === 0 || dayOfWeek === 6) {
        status = 'weekend';
      } else if (hasInPunch) {
        status = 'present';
      } else if (isLeave) {
        status = 'leave';
      } else if (dateObj < today) {
        status = 'absent';
      }

      days.push({ day: d, isCurrentMonth: true, status });
    }

    // Next month filler
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      days.push({ day: i, isCurrentMonth: false, status: 'none' });
    }

    return days;
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <div className="space-y-6 animate-fadeIn w-full pb-16 font-sans text-slate-800 dark:text-slate-100">
      
      {/* ── ROW 1: TOP SECTION: GREETING BANNER & TODAY'S ATTENDANCE PUNCH ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
        
        {/* Left 2 Cols: Good Morning Banner (LIGHT THEME FOR NON-SUPERADMIN) */}
        <div className="lg:col-span-2 rounded-3xl border border-indigo-100 dark:border-slate-800 bg-gradient-to-br from-indigo-50/90 via-purple-50/80 to-blue-50/70 dark:bg-slate-900 p-6 md:p-8 relative overflow-hidden flex flex-col justify-between shadow-xs text-slate-800 dark:text-slate-100 group transition-all duration-300">
          
          {/* Background blur rings */}
          <div className="absolute right-0 top-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600" />
          
          <div className="flex justify-between items-start gap-4 z-10">
            <div className="space-y-2 text-left">
              <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-600/10 text-indigo-700 dark:text-indigo-300 text-xs font-black uppercase tracking-widest border border-indigo-200/80 dark:border-indigo-800/50 shadow-2xs">
                {getGreeting()} <span className="animate-float-emoji inline-block text-sm">👋</span>
              </span>
              <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tight font-outfit mt-3">
                {displayName.toUpperCase()}
              </h1>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold leading-relaxed max-w-md pt-1">
                Welcome back to your workspace. Have a highly productive and successful day ahead!
              </p>
            </div>
          </div>

          {/* Bottom Branch, Department & Designation Chips */}
          <div className="flex flex-wrap items-center gap-3 mt-6 pt-2 z-10">
            {/* Branch */}
            <span className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20 shadow-2xs text-xs font-bold">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center text-sm">📍</span>
              <span>
                Branch: <strong className="font-black uppercase text-slate-900 dark:text-white tracking-wider">{me?.branch_name || 'Main Branch'}</strong>
              </span>
            </span>

            {/* Department */}
            <span className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-blue-500/10 text-blue-800 dark:text-blue-300 border border-blue-500/20 shadow-2xs text-xs font-bold">
              <span className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center text-sm">🏢</span>
              <span>
                Department: <strong className="font-black uppercase text-slate-900 dark:text-white tracking-wider">{me?.department_name || 'Pending'}</strong>
              </span>
            </span>

            {/* Designation */}
            <span className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-purple-500/10 text-purple-800 dark:text-purple-300 border border-purple-500/20 shadow-2xs text-xs font-bold">
              <span className="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center text-sm">💼</span>
              <span>
                Designation: <strong className="font-black uppercase text-slate-900 dark:text-white tracking-wider">{me?.designation_name || 'Pending'}</strong>
              </span>
            </span>
          </div>
        </div>

        {/* Right 1 Col: Today's Attendance Punch Card */}
        <div className="rounded-3xl border border-indigo-100 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-6 shadow-lg shadow-indigo-950/5 flex flex-col justify-between text-left transition-all duration-300 hover:shadow-xl hover:border-indigo-200 dark:hover:border-indigo-900/50 group">
          <div>
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                TODAY'S ATTENDANCE
              </span>
              <span className={`text-[10px] font-black px-3 py-1 rounded-full border uppercase tracking-wider flex items-center gap-1.5 shadow-xs ${
                checkedIn
                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-400'
                  : 'bg-amber-500/10 text-amber-600 border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-400'
              }`}>
                <span className={`w-2 h-2 rounded-full ${checkedIn ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                {checkedIn ? 'CHECKED IN' : 'CHECKED OUT'}
              </span>
            </div>

            <div className="flex items-center justify-between my-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                  WORKING HOURS TODAY
                </p>
                <div className="flex items-baseline gap-1 mt-1.5">
                  <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight font-mono" style={{ fontFamily: "'DM Sans', monospace" }}>
                    {checkedIn ? formatWorkingHours(elapsedWorkingSeconds) : '00h 00m 00s'}
                  </span>
                </div>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1">
                  <span>Shift:</span> <strong className="font-extrabold text-slate-800 dark:text-slate-200">{me?.shift_name || 'Standard Day Shift (09:30 AM - 06:30 PM)'}</strong>
                </p>
                {todayLocationName && (
                  <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                    <span>📍 Location:</span> <strong className="font-bold">{todayLocationName}</strong>
                  </p>
                )}
              </div>

              {/* Fingerprint Graphic */}
              <div className="w-15 h-15 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-blue-500/10 dark:from-indigo-500/20 dark:to-blue-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center shadow-md shrink-0 group-hover:scale-105 transition-transform duration-300">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 004 11c0 1.341.17 2.643.49 3.882" />
                </svg>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            {punchMsg && (
              <div className={`p-2.5 rounded-xl text-[11px] font-extrabold flex items-center justify-between border shadow-2xs ${
                punchMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}>
                <span>{punchMsg.text}</span>
                <button onClick={() => setPunchMsg(null)} className="text-xs font-bold px-1 cursor-pointer">&times;</button>
              </div>
            )}
            <div className="flex items-center gap-3">
              {isSuperAdmin ? (
                <div className="flex-1 py-3 px-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-[11px] font-extrabold flex items-center justify-center gap-2">
                  <span>👑</span>
                  <span>SuperAdmin Accounts Are Exempt From Attendance Punching</span>
                </div>
              ) : (
                <button
                  onClick={openMarkAttendanceModal}
                  disabled={punching}
                  className={`flex-1 py-3 px-5 rounded-2xl text-[11px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer active:scale-95 flex items-center justify-center gap-2 shadow-md disabled:opacity-60 ${
                    checkedIn
                      ? 'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white shadow-rose-500/20'
                      : 'bg-gradient-to-r from-indigo-600 via-indigo-650 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-indigo-500/25'
                  }`}
                >
                  {punching ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Punching...
                    </span>
                  ) : (
                    <span>{checkedIn ? 'CHECK-OUT NOW' : 'PUNCH CHECK-IN'}</span>
                  )}
                </button>
              )}

              {canViewAttendance && (
                <Link
                  href="/dashboard/attendance"
                  className="py-3 px-4 rounded-2xl text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all text-center flex items-center justify-center shadow-xs"
                >
                  TIMELINE
                </Link>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* ── ROW 2: 4 METRIC CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Today's Shift */}
        <div className="rounded-3xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-emerald-500/40 group">
          <div className="flex items-center justify-between">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center text-xl shadow-2xs group-hover:scale-110 transition-transform">
              📅
            </div>
            <span className="text-[10px] font-black px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/25 dark:text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
              In Progress
            </span>
          </div>

          <div className="mt-4">
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Today's Shift</p>
            <h4 className="text-lg font-extrabold text-slate-900 dark:text-white mt-1 font-outfit">
              09:00 AM - 06:00 PM
            </h4>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] font-semibold text-slate-500 flex items-center justify-between">
            <span>Shift Type:</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-extrabold bg-emerald-500/10 px-2.5 py-0.5 rounded-lg">{me?.shift_name || 'General Shift'}</span>
          </div>
        </div>

        {/* Card 2: Working Hours Today */}
        <div className="rounded-3xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-blue-500/40 group">
          <div className="flex items-center justify-between">
            <div className="w-11 h-11 rounded-2xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center text-xl shadow-2xs group-hover:scale-110 transition-transform">
              🕒
            </div>
            <span className="text-[10px] font-black px-3 py-1 rounded-full bg-blue-500/15 text-blue-600 dark:bg-blue-500/25 dark:text-blue-400 border border-blue-500/30 uppercase tracking-wider">
              Live Tracker
            </span>
          </div>

          <div className="mt-4">
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Working Hours Today</p>
            <h4 className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white mt-1" style={{ fontFamily: "'DM Sans', monospace" }}>
              {checkedIn && checkInTime ? '03h 42m 10s' : '00h 00m 00s'}
            </h4>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] font-semibold text-slate-500 flex items-center justify-between">
            <span>Break Time:</span>
            <span className="font-mono text-blue-600 dark:text-blue-400 font-extrabold bg-blue-500/10 px-2.5 py-0.5 rounded-lg">00h 00m</span>
          </div>
        </div>

        {/* Card 3: Leave Balance */}
        <div className="rounded-3xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-purple-500/40 group">
          <div className="flex items-center justify-between">
            <div className="w-11 h-11 rounded-2xl bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center text-xl shadow-2xs group-hover:scale-110 transition-transform">
              ☂️
            </div>
            <span className="text-[10px] font-black px-3 py-1 rounded-full bg-purple-500/15 text-purple-600 dark:bg-purple-500/25 dark:text-purple-400 border border-purple-500/30 uppercase tracking-wider">
              Quota
            </span>
          </div>

          <div className="mt-4">
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Leave Balance</p>
            <h4 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1 font-outfit">
              12 <span className="text-xs font-bold text-slate-500">Days</span>
            </h4>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[10.5px] font-bold text-slate-500 flex items-center justify-between gap-1">
            <span className="bg-purple-500/10 text-purple-600 dark:text-purple-300 px-2 py-0.5 rounded-md">Casual: <strong>6</strong></span>
            <span className="bg-purple-500/10 text-purple-600 dark:text-purple-300 px-2 py-0.5 rounded-md">Sick: <strong>4</strong></span>
            <span className="bg-purple-500/10 text-purple-600 dark:text-purple-300 px-2 py-0.5 rounded-md">Annual: <strong>2</strong></span>
          </div>
        </div>

        {/* Card 4: Attendance (This Month) */}
        <div className="rounded-3xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex items-center justify-between text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-amber-500/40 group">
          <div className="flex-1">
            <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">Attendance (This Month)</p>
            <h4 className="text-3xl font-black text-slate-900 dark:text-white mt-1 font-outfit">
              96%
            </h4>
            <p className="text-[11px] font-semibold text-slate-500 mt-2 flex items-center gap-2">
              <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">Present: 21</span>
              <span>•</span>
              <span className="text-rose-600 dark:text-rose-400 font-extrabold">Absent: 1</span>
            </p>
          </div>

          {/* Progress Ring */}
          <div className="relative w-15 h-15 shrink-0 flex items-center justify-center ml-2 group-hover:scale-105 transition-transform">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <path className="text-slate-100 dark:text-slate-800" strokeWidth="4" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <path className="text-amber-500" strokeDasharray="96, 100" strokeWidth="4" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            </svg>
            <span className="absolute text-[11px] font-black text-slate-900 dark:text-white">96%</span>
          </div>
        </div>

      </div>

      {/* ── ROW 3: QUICK ACCESS (Full Single Row Layout) ── */}
      <div className="rounded-3xl border border-slate-200/60 dark:border-slate-800 bg-card p-6 shadow-sm text-left transition-all duration-300 hover:shadow-md">
        <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100 dark:border-slate-800/60">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Quick Access Hub
          </h3>
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Shortcuts
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3.5">
          {[
            { label: 'Leave', icon: '🌴', href: '/dashboard/leaves', bg: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-500/20' },
            { label: 'Payslip', icon: '📄', href: '/dashboard/payslip', bg: 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border-blue-500/20' },
            { label: 'Attendance', icon: '⏱️', href: '/dashboard/attendance', bg: 'bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 border-purple-500/20' },
            { label: 'Reports', icon: '📊', href: '/dashboard/analytics', bg: 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border-amber-500/20' },
            { label: 'Docs', icon: '📂', href: '/dashboard/profile', bg: 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 border-indigo-500/20' },
            { label: 'Notice', icon: '📢', href: '/dashboard/overview', bg: 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 border-rose-500/20' },
            { label: 'Holidays', icon: '🏖️', href: '/dashboard/holidays', bg: 'bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400 border-teal-500/20' },
            { label: 'Help', icon: '🎧', href: '/dashboard/overview', bg: 'bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400 border-cyan-500/20' },
          ].map((item, idx) => (
            <Link
              key={idx}
              href={item.href}
              className="flex flex-col items-center justify-center p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:-translate-y-1 hover:shadow-md hover:border-indigo-500/30 transition-all duration-200 group cursor-pointer"
            >
              <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center text-xl group-hover:scale-110 transition-all duration-200 mb-2.5 shadow-2xs ${item.bg}`}>
                {item.icon}
              </div>
              <span className="text-[11.5px] font-black text-slate-700 dark:text-slate-200 group-hover:text-indigo-650 dark:group-hover:text-indigo-400 text-center truncate w-full tracking-wide">
                {item.label}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* ── ROW 4: MY ATTENDANCE CALENDAR & MY LEAVE STATUS (2 COLUMNS) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        
        {/* Left: My Attendance Calendar (7 cols) */}
        <div className="lg:col-span-7 rounded-3xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm text-left flex flex-col justify-between transition-all duration-300 hover:shadow-md">
          <div>
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5 pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center text-lg font-bold shadow-2xs">
                  📅
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-200 font-outfit">
                    MY ATTENDANCE CALENDAR
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">Track daily status & leave history</p>
                </div>
              </div>

              {/* Single Unified Month & Year Selection Control (Past & Current Months Only) */}
              {(() => {
                const realNow = new Date();
                const currentRealMonth = realNow.getMonth();
                const currentRealYear = realNow.getFullYear();

                const isMaxMonth = currentDate.getFullYear() > currentRealYear || 
                  (currentDate.getFullYear() === currentRealYear && currentDate.getMonth() >= currentRealMonth);

                const monthYearOptions: Array<{ val: string; label: string }> = [];
                for (let yr = 2024; yr <= currentRealYear; yr++) {
                  const maxM = (yr === currentRealYear) ? currentRealMonth : 11;
                  for (let mIdx = 0; mIdx <= maxM; mIdx++) {
                    monthYearOptions.push({
                      val: `${mIdx}-${yr}`,
                      label: `${monthNames[mIdx]} ${yr}`
                    });
                  }
                }

                return (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentDate(new Date())}
                      title="Jump to Current Month"
                      className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase bg-indigo-500/10 text-indigo-650 dark:bg-indigo-500/20 dark:text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all cursor-pointer shadow-2xs"
                    >
                      Today
                    </button>

                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/90 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                      <button
                        onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
                        className="w-7 h-7 flex items-center justify-center text-xs font-black text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:shadow-2xs rounded-lg transition-all cursor-pointer border-0 outline-none"
                        title="Previous Month"
                      >
                        ‹
                      </button>

                      {/* Single Unified Dropdown: Past up to Current Month ONLY */}
                      <select
                        value={`${currentDate.getMonth()}-${currentDate.getFullYear()}`}
                        onChange={(e) => {
                          const [m, y] = e.target.value.split('-').map(Number);
                          setCurrentDate(new Date(y, m, 1));
                        }}
                        className="bg-transparent border-0 text-xs font-black uppercase text-slate-800 dark:text-slate-100 focus:ring-0 focus:outline-none cursor-pointer px-2 py-0.5 tracking-wider font-outfit"
                      >
                        {monthYearOptions.map(opt => (
                          <option key={opt.val} value={opt.val} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-bold uppercase">
                            {opt.label.toUpperCase()}
                          </option>
                        ))}
                      </select>

                      <button
                        disabled={isMaxMonth}
                        onClick={() => {
                          if (!isMaxMonth) {
                            setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
                          }
                        }}
                        className={`w-7 h-7 flex items-center justify-center text-xs font-black rounded-lg transition-all border-0 outline-none ${
                          isMaxMonth
                            ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-40'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:shadow-2xs cursor-pointer'
                        }`}
                        title={isMaxMonth ? "Cannot view future months" : "Next Month"}
                      >
                        ›
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Days of Week Header */}
            <div className="grid grid-cols-7 gap-1.5 text-center mb-2.5 bg-slate-100/60 dark:bg-slate-800/50 p-2 rounded-2xl border border-slate-200/50 dark:border-slate-800">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, idx) => (
                <span key={idx} className={`text-[10.5px] font-black uppercase py-0.5 tracking-wider ${idx === 0 || idx === 6 ? 'text-rose-500 dark:text-rose-400 font-extrabold' : 'text-slate-700 dark:text-slate-300'}`}>
                  {d}
                </span>
              ))}
            </div>

            {/* Calendar Days Grid */}
            <div className="grid grid-cols-7 gap-1.5 text-center mb-5">
              {getCalendarDays().map((cell, idx) => {
                const today = new Date();
                const isToday = cell.isCurrentMonth && cell.day === today.getDate() && currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear();

                let cellBg = 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800';
                let textStyle = 'text-slate-700 dark:text-slate-200 font-bold';
                if (!cell.isCurrentMonth) {
                  textStyle = 'text-slate-300 dark:text-slate-700 font-normal';
                } else if (cell.status === 'present') {
                  cellBg = 'bg-emerald-500/10 border-emerald-500/30 dark:bg-emerald-500/20';
                  textStyle = 'text-emerald-600 dark:text-emerald-400 font-black text-sm';
                } else if (cell.status === 'absent') {
                  cellBg = 'bg-rose-500/10 border-rose-500/30 dark:bg-rose-500/20';
                  textStyle = 'text-rose-600 dark:text-rose-400 font-black text-sm';
                } else if (cell.status === 'late') {
                  cellBg = 'bg-amber-500/10 border-amber-500/30 dark:bg-amber-500/20';
                  textStyle = 'text-amber-600 dark:text-amber-400 font-black text-sm';
                } else if (cell.status === 'leave') {
                  cellBg = 'bg-purple-500/10 border-purple-500/30 dark:bg-purple-500/20';
                  textStyle = 'text-purple-600 dark:text-purple-400 font-black text-sm';
                } else if (cell.status === 'weekend') {
                  cellBg = 'bg-slate-100/60 dark:bg-slate-800/20 border-slate-200/50 dark:border-slate-800';
                  textStyle = 'text-slate-400 dark:text-slate-500 font-bold';
                }

                return (
                  <div
                    key={idx}
                    className={`h-10 flex flex-col items-center justify-center rounded-2xl transition-all relative border hover:scale-105 shadow-2xs ${cellBg} ${
                      isToday ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900 z-10 shadow-md' : ''
                    }`}
                  >
                    <span className={`font-outfit ${textStyle}`}>{cell.day}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Calendar Legend Pill Badges */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-black border-t border-slate-100 dark:border-slate-800 pt-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/30 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Present
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-500/30 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-rose-500" /> Absent
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/30 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> Late
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 border border-purple-500/30 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-purple-500" /> On Leave
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500" /> Weekend
            </span>
          </div>
        </div>

        {/* Right: My Leave Status (5 cols) */}
        <div className="lg:col-span-5 rounded-3xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm text-left flex flex-col justify-between transition-all duration-300 hover:shadow-md">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-200 font-outfit flex items-center gap-2">
                <span className="text-base">☂️</span> My Leave Status
              </h3>
              <Link href="/dashboard/leaves" className="text-[10px] font-black text-indigo-650 dark:text-indigo-400 hover:underline tracking-wider uppercase bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                View All
              </Link>
            </div>

            {/* 3 Metric Pills */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/30 text-center shadow-2xs">
                <p className="text-[9.5px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">APPROVED</p>
                <p className="text-xl font-black text-emerald-700 dark:text-emerald-300 mt-0.5 font-outfit">
                  {leaveRequests.filter((l: any) => String(l.status).toUpperCase() === 'APPROVED').length} <span className="text-xs font-bold">Reqs</span>
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/30 text-center shadow-2xs">
                <p className="text-[9.5px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">PENDING</p>
                <p className="text-xl font-black text-amber-700 dark:text-amber-300 mt-0.5 font-outfit">
                  {leaveRequests.filter((l: any) => String(l.status).toUpperCase() === 'PENDING').length} <span className="text-xs font-bold">Reqs</span>
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-500/30 text-center shadow-2xs">
                <p className="text-[9.5px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">REJECTED</p>
                <p className="text-xl font-black text-rose-700 dark:text-rose-300 mt-0.5 font-outfit">
                  {leaveRequests.filter((l: any) => String(l.status).toUpperCase() === 'REJECTED').length} <span className="text-xs font-bold">Reqs</span>
                </p>
              </div>
            </div>

            {/* Recent Leave Request Items */}
            <div className="space-y-3">
              {leaveRequests.length === 0 ? (
                <div className="p-6 text-center text-slate-400 dark:text-slate-500 text-xs font-bold bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-200/50 dark:border-slate-800">
                  🌴 No leave requests logged yet.
                </div>
              ) : (
                leaveRequests.slice(0, 3).map((item: any, idx: number) => {
                  const statusUpper = String(item.status || '').toUpperCase();
                  const badgeColor = statusUpper === 'APPROVED' ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:bg-emerald-500/25 dark:text-emerald-400' :
                    statusUpper === 'PENDING' ? 'bg-amber-500/15 text-amber-600 border-amber-500/30 dark:bg-amber-500/25 dark:text-amber-400' :
                    'bg-rose-500/15 text-rose-600 border-rose-500/30 dark:bg-rose-500/25 dark:text-rose-400';
                  
                  const startDateStr = String(item.start_date || item.from_date || '').split('T')[0];
                  const endDateStr = String(item.end_date || item.to_date || startDateStr).split('T')[0];

                  return (
                    <div key={idx} className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:border-indigo-500/30 transition-all duration-200 shadow-2xs">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center text-lg shadow-2xs">
                          🌴
                        </div>
                        <div>
                          <h5 className="text-xs font-black text-slate-800 dark:text-slate-100">{item.leave_type || item.leave_type_code || 'Leave'}</h5>
                          <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">{startDateStr} - {endDateStr}</p>
                        </div>
                      </div>
                      <span className={`text-[9.5px] font-black px-3 py-1 rounded-full border uppercase tracking-wider ${badgeColor}`}>
                        {statusUpper}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>

      {/* ── ROW 5: TODAY'S BIRTHDAYS & TODAY'S WORK ANNIVERSARIES (2 CARDS ROW) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
        
        {/* 1. Today's Birthdays */}
        <div className="rounded-3xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 shadow-sm text-left flex flex-col justify-between overflow-hidden min-h-[220px] transition-all duration-300 hover:shadow-md">
          <div>
            <div className="flex items-center gap-3.5 mb-5 pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center text-xl font-bold shadow-2xs">
                🎂
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-200 font-outfit">
                  TODAY'S BIRTHDAYS
                </h4>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">Celebrate team milestones</p>
              </div>
            </div>

            {/* Today's Birthdays List/Marquee */}
            {getBirthdaysToday().length > 0 ? (
              <div className="overflow-hidden w-full py-2">
                <div className="animate-marquee gap-3.5 flex">
                  {[...getBirthdaysToday(), ...getBirthdaysToday(), ...getBirthdaysToday()].map((item, idx) => (
                    <div key={idx} className="w-[270px] shrink-0 flex items-center justify-between gap-3 p-4 rounded-2xl bg-indigo-500/5 dark:bg-slate-800/60 border border-indigo-500/20 dark:border-slate-800 shadow-2xs hover:shadow-xs transition-all">
                      <div className="flex items-center gap-3.5 min-w-0">
                        {item.image ? (
                          <img src={item.image} className="w-11 h-11 rounded-full object-cover shrink-0 ring-2 ring-indigo-500/30 shadow-xs" alt="avatar" />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-indigo-600 to-blue-500 text-white font-extrabold text-sm flex items-center justify-center shrink-0 shadow-xs ring-2 ring-indigo-500/30">
                            {item.name.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">{item.name}</p>
                          <p className="text-[10px] font-semibold text-slate-500 truncate mt-0.5">{item.designation}</p>
                          <span className="inline-block text-[8.5px] font-extrabold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 mt-1">
                            🎂 Today
                          </span>
                        </div>
                      </div>

                      <button className="text-[10px] font-black px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border-0 shadow-md transition-all cursor-pointer shrink-0 active:scale-95">
                        Wish 🎉
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <span className="text-4xl mb-2.5">🎂</span>
                <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200">No birthdays today</p>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-semibold mt-1">Celebrate team milestones when they arrive!</p>
              </div>
            )}
          </div>
        </div>

        {/* 2. Today's Work Anniversaries */}
        <div className="rounded-3xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 shadow-sm text-left flex flex-col justify-between overflow-hidden min-h-[220px] transition-all duration-300 hover:shadow-md">
          <div>
            <div className="flex items-center gap-3.5 mb-5 pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <div className="w-11 h-11 rounded-2xl bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center text-xl font-bold shadow-2xs">
                🎖️
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-200 font-outfit">
                  TODAY'S WORK ANNIVERSARIES
                </h4>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">Recognize dedication & loyalty</p>
              </div>
            </div>

            {/* Today's Anniversaries List/Marquee */}
            {getAnniversariesToday().length > 0 ? (
              <div className="overflow-hidden w-full py-2">
                <div className="animate-marquee gap-3.5 flex">
                  {[...getAnniversariesToday(), ...getAnniversariesToday(), ...getAnniversariesToday()].map((item, idx) => (
                    <div key={idx} className="w-[270px] shrink-0 flex items-center justify-between gap-3 p-4 rounded-2xl bg-purple-500/5 dark:bg-slate-800/60 border border-purple-500/20 dark:border-slate-800 shadow-2xs hover:shadow-xs transition-all">
                      <div className="flex items-center gap-3.5 min-w-0">
                        {item.image ? (
                          <img src={item.image} className="w-11 h-11 rounded-full object-cover shrink-0 ring-2 ring-purple-500/30 shadow-xs" alt="avatar" />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 text-white font-extrabold text-sm flex items-center justify-center shrink-0 shadow-xs ring-2 ring-purple-500/30">
                            {item.name.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">{item.name}</p>
                          <p className="text-[10px] font-semibold text-slate-500 truncate mt-0.5">{item.designation}</p>
                          <span className="inline-block text-[8.5px] font-extrabold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 mt-1">
                            🎖️ {item.years} Yrs Today
                          </span>
                        </div>
                      </div>

                      <button className="text-[10px] font-black px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white border-0 shadow-md transition-all cursor-pointer shrink-0 active:scale-95">
                        Wish 👏
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <span className="text-4xl mb-2.5">🎖️</span>
                <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200">No work anniversaries today</p>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-semibold mt-1">Recognizing team dedication and loyalty!</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── ROW 6: UPCOMING HOLIDAYS, ANNOUNCEMENTS, NEED HELP (3 CARDS ROW) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
        
        {/* 1. Upcoming Holidays */}
        <div className="rounded-3xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm text-left flex flex-col justify-between transition-all duration-300 hover:shadow-md hover:border-teal-500/40">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <h4 className="text-xs font-black uppercase tracking-widest text-teal-600 dark:text-teal-400 flex items-center gap-2 font-outfit">
                <span className="text-base">🌴</span> UPCOMING HOLIDAYS
              </h4>
              <Link href="/dashboard/holidays" className="text-[10px] font-black text-indigo-650 dark:text-indigo-400 hover:underline uppercase tracking-wider bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                View Calendar
              </Link>
            </div>

            <div className="space-y-3">
              {[
                { date: '01 MAY', name: 'Labour Day', day: 'Thursday' },
                { date: '15 AUG', name: 'Independence Day', day: 'Friday' },
                { date: '26 JAN', name: 'Republic Day', day: 'Monday' },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-3.5 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-teal-500/30 transition-all shadow-2xs">
                  <div className="w-11 h-11 rounded-2xl bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400 border border-teal-500/20 flex flex-col items-center justify-center shrink-0 shadow-2xs">
                    <span className="text-[8.5px] font-black uppercase leading-none">{item.date.split(' ')[1]}</span>
                    <span className="text-xs font-black leading-none mt-1 font-outfit">{item.date.split(' ')[0]}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">{item.name}</p>
                    <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">{item.day}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 2. Announcements */}
        <div className="rounded-3xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm text-left flex flex-col justify-between transition-all duration-300 hover:shadow-md hover:border-indigo-500/40">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <h4 className="text-xs font-black uppercase tracking-widest text-indigo-650 dark:text-indigo-400 flex items-center gap-2 font-outfit">
                <span className="text-base">📢</span> ANNOUNCEMENTS
              </h4>
              <button className="text-[10px] font-black text-indigo-650 dark:text-indigo-400 hover:underline uppercase tracking-wider cursor-pointer bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                View All
              </button>
            </div>

            <div className="space-y-3">
              {[
                { title: 'New HR Policy Update', time: '2 days ago', icon: '📢' },
                { title: 'Office Maintenance Scheduled', time: '3 days ago', icon: '📋' },
                { title: 'Annual Team Outing Plan', time: '1 week ago', icon: '🎉' },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-indigo-500/30 transition-all shadow-2xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-base shrink-0">{item.icon}</span>
                    <p className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">{item.title}</p>
                  </div>
                  <span className="text-[9.5px] font-black text-slate-400 dark:text-slate-500 shrink-0 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">{item.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 3. Need Help? (Light Soft Theme) */}
        <div className="rounded-3xl border border-indigo-200/80 dark:border-slate-800 bg-gradient-to-br from-indigo-50/90 via-slate-50 to-blue-50/80 dark:from-slate-900 dark:to-slate-800 p-6 shadow-sm text-left flex flex-col justify-between transition-all duration-300 hover:shadow-md text-slate-800 dark:text-white group">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center text-xl mb-4 backdrop-blur-md shadow-2xs group-hover:scale-110 transition-transform">
              🎧
            </div>
            <h4 className="text-base font-black uppercase tracking-wider text-slate-900 dark:text-white font-outfit">
              Need Help?
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed font-medium">
              Have questions or facing issues? Raise a ticket or connect directly with our support team.
            </p>
          </div>

          <div className="mt-6">
            <button className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 border-0 text-xs font-black text-white shadow-md shadow-indigo-500/20 transition-all text-center cursor-pointer active:scale-98">
              Create Support Ticket
            </button>
          </div>
        </div>
      </div>

      {/* 📸 Mark Attendance Center Dialog Modal */}
      {punchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full border border-slate-200/80 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xl shrink-0">
                  📸
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white font-outfit">
                    MARK ATTENDANCE ({punchDirection === 'IN' ? 'CHECK IN' : 'CHECK OUT'})
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    GPS LOCATION & SELFIE VERIFICATION
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPunchModalOpen(false);
                  stopCamera();
                }}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center text-base font-bold transition-colors cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {modalPunchMsg && (
                <div className={`p-3 rounded-2xl text-xs font-bold flex items-center justify-between border ${
                  modalPunchMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40'
                    : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/40'
                }`}>
                  <span>{modalPunchMsg.text}</span>
                  <button onClick={() => setModalPunchMsg(null)} className="text-xs font-bold px-1">&times;</button>
                </div>
              )}

              {/* GPS Verification Card */}
              <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    🌐 GPS Location Verification
                  </span>
                  <button
                    type="button"
                    onClick={getGPSLocation}
                    disabled={gpsLoading}
                    className="text-[9.5px] font-extrabold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer bg-transparent border-0"
                  >
                    {gpsLoading ? 'Fetching...' : 'Re-detect GPS'}
                  </button>
                </div>

                {punchLat && punchLng ? (
                  <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 leading-snug">
                        📍 {locationName || 'Detecting location address...'}
                      </p>
                      <span className="text-[9px] bg-emerald-600 text-white px-2 py-0.5 rounded font-sans uppercase font-bold shrink-0 shadow-2xs">
                        GPS Verified
                      </span>
                    </div>
                  </div>
                ) : gpsError ? (
                  <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 text-xs font-bold">
                    ⚠️ {gpsError}
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-bold">
                    📍 Click "Re-detect GPS" to verify location permissions.
                  </div>
                )}
              </div>

              {/* Camera / Selfie Capture Card */}
              <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                  📸 Selfie Photo Verification
                </span>

                {capturedSelfie ? (
                  <div className="space-y-2 text-center">
                    <img
                      src={capturedSelfie}
                      alt="Captured Selfie Verification"
                      className="w-48 h-36 object-cover rounded-2xl mx-auto border-2 border-emerald-500 shadow-md"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setCapturedSelfie(null);
                        startCamera();
                      }}
                      className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer bg-transparent border-0"
                    >
                      Retake Selfie Photo
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 text-center">
                    <div className="w-full h-44 rounded-2xl bg-black overflow-hidden relative flex items-center justify-center border border-slate-700 shadow-inner">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{ transform: 'scaleX(-1)' }}
                        className="w-full h-full object-cover"
                      />
                      <canvas ref={canvasRef} className="hidden" />
                      {!cameraActive && (
                        <button
                          type="button"
                          onClick={startCamera}
                          className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors shadow-md cursor-pointer"
                        >
                          📷 Enable Camera
                        </button>
                      )}
                    </div>

                    {cameraActive && (
                      <button
                        type="button"
                        onClick={captureSelfie}
                        className="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md shadow-indigo-500/25 transition-all cursor-pointer hover:scale-105"
                      >
                        📸 Take Selfie Snapshot
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={submitWebPunch}
                  disabled={isSubmittingPunch || !capturedSelfie}
                  className={`w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all duration-200 ${
                    isSubmittingPunch || !capturedSelfie
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 border border-slate-300/40 dark:border-slate-700/40 cursor-not-allowed shadow-none'
                      : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white shadow-lg shadow-blue-500/25 hover:scale-[1.01] cursor-pointer'
                  }`}
                >
                  {isSubmittingPunch
                    ? 'Submitting Punch...'
                    : !capturedSelfie
                    ? '📸 Capture Selfie Photo First to Submit'
                    : `Submit ${punchDirection === 'IN' ? 'Check In' : 'Check Out'} Punch Now`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

