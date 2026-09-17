'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { useDashboard } from '../../components/DashboardContext';
import { getHeaders } from '../../utils/api';
import { usePermissions } from '../../hooks/usePermissions';
import {
  MapPin,
  Search,
  Calendar,
  ChevronRight,
  X,
  RefreshCw,
  Eye,
  Clock
} from 'lucide-react';

const LeafletMapComponent = dynamic<any>(
  () => import('./LeafletMapComponent').then((mod) => mod.LeafletMapComponent || mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-80 rounded-2xl bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center text-xs font-bold text-slate-400 gap-2">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span>Loading Interactive Tracking Map...</span>
      </div>
    )
  }
);

interface LocationLog {
  id: string;
  company_id: string;
  employee_id: string;
  latitude: number;
  longitude: number;
  location_name?: string | null;
  recorded_at: string;
  emp_id_code?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  emp_image?: string | null;
  department_name?: string;
}

interface EmployeeGroup {
  employee_id: string;
  name: string;
  code: string;
  email: string;
  department: string;
  empImage?: string | null;
  initialPunchTime: string;
  initialLocation: string;
  lastActiveTime: string;
  lastLocation: string;
  totalPings: number;
  logs: LocationLog[];
}

const getAvatarUrl = (raw?: string | null): string | null => {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('data:image/') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  if (trimmed.startsWith('/9j/') || trimmed.startsWith('/9j4')) {
    return `data:image/jpeg;base64,${trimmed}`;
  }
  if (trimmed.startsWith('iVBORw')) {
    return `data:image/png;base64,${trimmed}`;
  }
  if (trimmed.startsWith('R0lGOD')) {
    return `data:image/gif;base64,${trimmed}`;
  }
  if (trimmed.startsWith('PHN2Zw')) {
    return `data:image/svg+xml;base64,${trimmed}`;
  }
  if (trimmed.startsWith('/uploads/')) {
    return trimmed;
  }
  if (trimmed.startsWith('uploads/')) {
    return `/${trimmed}`;
  }
  if (trimmed.startsWith('/')) {
    return trimmed;
  }
  return `/uploads/${trimmed}`;
};

export default function LiveTrackingPage() {
  const { showToast, companyId, companyId: ctxCompanyId } = useDashboard();
  const { isSuperAdmin } = usePermissions();

  const activeCompanyId = companyId || ctxCompanyId || (typeof window !== 'undefined' ? localStorage.getItem('companyId') : null);

  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [logs, setLogs] = useState<LocationLog[]>([]);

  // Modal state for active employee popup
  const [modalEmployee, setModalEmployee] = useState<EmployeeGroup | null>(null);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  // 1. Fetch tracking logs with companyId filter from header dropdown
  const fetchTrackingLogs = async () => {
    setLoading(true);
    try {
      const compParam = activeCompanyId && activeCompanyId !== 'all' ? `&companyId=${activeCompanyId}` : '';
      const res = await fetch(`/api/v1/attendance/live-tracking?startDate=${selectedDate}&endDate=${selectedDate}${compParam}`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      } else {
        showToast('Failed to fetch tracking logs', 'error');
      }
    } catch (err) {
      console.error('Error loading location tracking logs:', err);
      showToast('Error loading location tracking logs', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrackingLogs();
  }, [selectedDate, activeCompanyId]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModalEmployee(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 3. Hide body overflow when popup is open so header & sidebar are covered
  useEffect(() => {
    if (modalEmployee) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [modalEmployee]);

  // Group logs by Employee
  const employeeGroups = useMemo(() => {
    const map = new Map<string, LocationLog[]>();
    logs.forEach((log) => {
      if (!map.has(log.employee_id)) {
        map.set(log.employee_id, []);
      }
      map.get(log.employee_id)!.push(log);
    });

    const groups: EmployeeGroup[] = [];
    map.forEach((empLogs, empId) => {
      empLogs.sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());

      const firstLog = empLogs[0];
      const lastLog = empLogs[empLogs.length - 1];

      const empName = `${firstLog.first_name || ''} ${firstLog.last_name || ''}`.trim() || 'Employee';
      const empCode = firstLog.emp_id_code || empId.slice(0, 6);
      const dept = firstLog.department_name || 'Field Ops';
      const formattedImg = getAvatarUrl(firstLog.emp_image);

      groups.push({
        employee_id: empId,
        name: empName,
        code: empCode,
        email: firstLog.email || '',
        department: dept,
        empImage: formattedImg,
        initialPunchTime: new Date(firstLog.recorded_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
        initialLocation: firstLog.location_name || `${firstLog.latitude.toFixed(4)}, ${firstLog.longitude.toFixed(4)}`,
        lastActiveTime: new Date(lastLog.recorded_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
        lastLocation: lastLog.location_name || `${lastLog.latitude.toFixed(4)}, ${lastLog.longitude.toFixed(4)}`,
        totalPings: empLogs.length,
        logs: empLogs
      });
    });

    return groups;
  }, [logs]);

  const filteredGroups = useMemo(() => {
    return employeeGroups.filter((g) => {
      const q = searchQuery.toLowerCase().trim();
      return !q || g.name.toLowerCase().includes(q) || g.code.toLowerCase().includes(q) || g.department.toLowerCase().includes(q);
    });
  }, [employeeGroups, searchQuery]);

  const handleOpenModal = (group: EmployeeGroup) => {
    setModalEmployee(group);
    if (group.logs && group.logs.length > 0) {
      setSelectedLogId(group.logs[0].id);
    }
  };

  return (
    <div className="space-y-4 animate-fadeIn w-full font-sans">
      {/* 1. Top Header Card */}
      <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 flex items-center justify-center font-black">
            <MapPin className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-base md:text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
            ATTENDANCE LOCATION TRACKING
          </h1>
        </div>

        {/* Search & Date Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search employee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 pl-10 pr-4 py-1.5 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]"
            />
          </div>

          <div className="flex items-center bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl">
            <input
              type="date"
              max={todayStr}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-900 dark:text-slate-100 outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={fetchTrackingLogs}
            title="Refresh tracking data"
            className="p-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white transition-all cursor-pointer shadow-xs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Staff Cards Section */}
      {loading ? (
        <div className="bg-white dark:bg-slate-900 p-16 text-center rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Loading Field Staff Location Logs...
          </p>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 p-16 text-center rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
          <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto text-2xl">
            📍
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Location Tracking Logs Found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            No breadcrumb pings found for date <strong className="text-slate-700 dark:text-slate-300">{selectedDate}</strong>.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Field Staff ({filteredGroups.length})
            </h2>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
              Click to view route
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredGroups.map((group) => {
              const initial = group.name.charAt(0).toUpperCase();

              return (
                <div
                  key={group.employee_id}
                  onClick={() => handleOpenModal(group)}
                  className="group bg-white dark:bg-slate-900 p-4.5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs hover:shadow-md hover:border-blue-500 dark:hover:border-blue-500 transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-3.5"
                >
                  {/* Header Row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {group.empImage ? (
                        <img src={group.empImage} alt={group.name} className="w-10 h-10 rounded-xl object-cover border border-slate-200 shadow-xs shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-black text-sm flex items-center justify-center shadow-xs shrink-0">
                          {initial}
                        </div>
                      )}
                      <div className="truncate">
                        <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {group.name}
                        </h3>
                        <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 truncate flex items-center gap-1 mt-0.5">
                          <span>{group.code}</span>
                          <span>•</span>
                          <span>{group.department}</span>
                        </p>
                      </div>
                    </div>

                    <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/80 shrink-0">
                      {group.totalPings} Pings
                    </span>
                  </div>

                  {/* Punch & Active Times */}
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-700/60 grid grid-cols-2 gap-2 text-[11px] font-bold">
                    <div className="space-y-0.5">
                      <span className="text-[9.5px] text-slate-400 uppercase tracking-wider block">First Punch</span>
                      <span className="text-slate-800 dark:text-slate-200 block text-xs">{group.initialPunchTime}</span>
                    </div>

                    <div className="space-y-0.5 text-right">
                      <span className="text-[9.5px] text-slate-400 uppercase tracking-wider block">Last Active</span>
                      <span className="text-blue-600 dark:text-blue-400 block text-xs">{group.lastActiveTime}</span>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="pt-0.5 flex items-center justify-between text-xs font-bold">
                    <span className="text-emerald-600 dark:text-emerald-400 text-[11px] flex items-center gap-1.5 font-bold">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      Live Route Ready
                    </span>

                    <button
                      type="button"
                      className="px-3.5 py-1.5 rounded-xl bg-blue-600 group-hover:bg-blue-700 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-xs transition-all"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Movement Map</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. POPUP MODAL DIALOG: FULL SCREEN OVERLAY COVERING SIDEBAR AND HEADER VIA REACT PORTAL */}
      {modalEmployee && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-3 sm:p-5 bg-slate-950/95 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto w-screen h-screen">
          <div
            className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[94vh] my-auto animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-3.5 sm:p-4 bg-white dark:bg-slate-900 text-slate-900 dark:text-white flex items-center justify-between border-b border-slate-200 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                {modalEmployee.empImage ? (
                  <img
                    src={modalEmployee.empImage}
                    alt={modalEmployee.name}
                    className="w-10 h-10 rounded-xl object-cover border border-slate-200 shadow-xs shrink-0"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-black text-base flex items-center justify-center shadow-xs shrink-0">
                    {modalEmployee.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="truncate">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black tracking-tight uppercase truncate">
                      {modalEmployee.name}
                    </h3>
                    <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                      Live Active
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {modalEmployee.code} • {modalEmployee.department} • Total Pings: <strong className="text-blue-600 dark:text-blue-400">{modalEmployee.totalPings}</strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalEmployee(null)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all cursor-pointer shrink-0 ml-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-3.5 sm:p-4 overflow-y-auto space-y-3">
              {/* Quick Times Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-bold">
                <div className="bg-slate-50 dark:bg-slate-800/60 py-2 px-3 rounded-xl border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between">
                  <div>
                    <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 block">First Punch Time</span>
                    <p className="text-slate-900 dark:text-slate-100 font-extrabold text-xs mt-0.5">{modalEmployee.initialPunchTime}</p>
                  </div>
                  <Clock className="w-4 h-4 text-emerald-500 shrink-0" />
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 py-2 px-3 rounded-xl border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between">
                  <div>
                    <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 block">Last Active Time</span>
                    <p className="text-blue-600 dark:text-blue-400 font-extrabold text-xs mt-0.5">{modalEmployee.lastActiveTime}</p>
                  </div>
                  <Clock className="w-4 h-4 text-blue-500 shrink-0" />
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 py-2 px-3 rounded-xl border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between">
                  <div>
                    <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 block">Tracking Date</span>
                    <p className="text-slate-900 dark:text-slate-100 font-extrabold text-xs mt-0.5">{selectedDate}</p>
                  </div>
                  <Calendar className="w-4 h-4 text-indigo-500 shrink-0" />
                </div>
              </div>

              {/* 2 & 4. Animated Leaflet Map Container */}
              <div className="rounded-xl overflow-hidden shadow-xs">
                <LeafletMapComponent
                  logs={modalEmployee.logs}
                  employeeName={modalEmployee.name}
                  empImage={modalEmployee.empImage}
                  selectedLogId={selectedLogId}
                  onSelectLog={(id: string) => setSelectedLogId(id)}
                />
              </div>

              {/* Ping History Log Table / Timeline */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span>GPS Breadcrumb Timeline ({modalEmployee.logs.length} Pings)</span>
                  </h4>
                  <span className="text-[10.5px] font-semibold text-slate-400">Click any row to jump on map</span>
                </div>

                <div className="max-h-[160px] overflow-y-auto space-y-1.5 pr-1 no-scrollbar">
                  {modalEmployee.logs.map((log, idx) => {
                    const isSelected = selectedLogId === log.id;
                    const timeStr = new Date(log.recorded_at).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: true
                    });

                    return (
                      <div
                        key={log.id}
                        onClick={() => setSelectedLogId(log.id)}
                        className={`flex items-center justify-between p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-950/70 border-blue-500 ring-1 ring-blue-500 text-blue-950 dark:text-blue-100 font-bold'
                            : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`w-5 h-5 rounded-md text-[10px] font-black flex items-center justify-center shrink-0 ${
                              idx === 0
                                ? 'bg-emerald-500 text-white'
                                : idx === modalEmployee.logs.length - 1
                                ? 'bg-red-500 text-white'
                                : 'bg-blue-600 text-white'
                            }`}
                          >
                            {idx + 1}
                          </span>

                          <div className="truncate">
                            <p className="font-extrabold text-slate-900 dark:text-slate-100 truncate">
                              {log.location_name || `${log.latitude.toFixed(6)}, ${log.longitude.toFixed(6)}`}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0 ml-3">
                          <span className="text-xs font-mono font-black text-blue-600 dark:text-blue-400 block">{timeStr}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs font-bold shrink-0">
              <span className="text-slate-400">Press ESC or click close to exit map</span>
              <button
                type="button"
                onClick={() => setModalEmployee(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-extrabold transition-all cursor-pointer"
              >
                Close Tracking Popup
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
