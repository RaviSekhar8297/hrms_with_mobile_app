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
  Clock,
  Download,
  Loader2
} from 'lucide-react';
import CustomDatePicker from '../../components/CustomDatePicker';
import { generateRouteVideoClip } from './routeVideoGenerator';
import PageLoader from '@/components/ui/PageLoader';

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
  const [isDownloadingClip, setIsDownloadingClip] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);

  const handleDownloadClip = async () => {
    if (!modalEmployee || !modalEmployee.logs || modalEmployee.logs.length === 0) {
      showToast('No tracking logs available to download clip', 'info');
      return;
    }
    setIsDownloadingClip(true);
    setDownloadProgress(0);
    showToast('Generating tracking video clip...', 'info');

    try {
      let roadRouteCoords: [number, number][] = [];
      try {
        const coordString = modalEmployee.logs.map((l) => `${l.longitude},${l.latitude}`).join(';');
        const osrmRes = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`
        );
        if (osrmRes.ok) {
          const osrmData = await osrmRes.json();
          if (osrmData.code === 'Ok' && osrmData.routes && osrmData.routes.length > 0) {
            roadRouteCoords = osrmData.routes[0].geometry.coordinates.map(
              (c: [number, number]) => [c[1], c[0]]
            );
          }
        }
      } catch (_) {}

      await generateRouteVideoClip({
        employeeName: modalEmployee.name,
        date: selectedDate,
        logs: modalEmployee.logs,
        roadRouteCoords,
        empImage: modalEmployee.empImage,
        onProgress: (p) => setDownloadProgress(p)
      });

      showToast('Tracking video clip downloaded successfully!', 'success');
    } catch (err: any) {
      console.error('Failed to download tracking clip:', err);
      showToast(err?.message || 'Failed to download tracking clip', 'error');
    } finally {
      setIsDownloadingClip(false);
      setDownloadProgress(0);
    }
  };

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

  // Scroll active log into view in timeline when selectedLogId changes
  useEffect(() => {
    if (selectedLogId) {
      const el = document.getElementById(`ping-card-${selectedLogId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedLogId]);

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
      <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 border-l-4 border-l-[#07518a] shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#07518a]/10 text-[#07518a] dark:text-[#38bdf8] border border-[#07518a]/20 flex items-center justify-center font-black">
            <MapPin className="w-4.5 h-4.5 text-[#07518a] dark:text-[#38bdf8]" />
          </div>
          <h1 className="text-base md:text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
            ATTENDANCE LOCATION TRACKING
          </h1>
        </div>

        {/* Search & Date Controls - Side-by-side on mobile */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 w-full sm:w-auto">
          {/* Search Bar - Width decreased on mobile to fit side-by-side */}
          <div className="relative flex-1 sm:flex-none min-w-0 sm:min-w-[190px]">
            <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 pl-8 sm:pl-9 pr-2.5 sm:pr-4 py-2 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-[#07518a]"
            />
          </div>

          {/* Date Picker using CustomDatePicker with maxDate today */}
          <div className="w-[130px] sm:w-[155px] shrink-0">
            <CustomDatePicker
              value={selectedDate}
              onChange={(val) => val && setSelectedDate(val)}
              maxDate={todayStr}
              placeholder="Select date"
              align="right"
            />
          </div>

          {/* Refresh button */}
          <button
            onClick={fetchTrackingLogs}
            title="Refresh tracking data"
            className="p-2.5 rounded-xl bg-[#07518a] hover:bg-[#064270] active:scale-95 text-white transition-all cursor-pointer shadow-xs border-0 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Staff Cards Section */}
      {loading ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <PageLoader message="Loading Field Staff Location Logs..." />
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
            <span className="text-xs font-bold text-[#07518a] dark:text-[#38bdf8]">
              Click to view live route
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredGroups.map((group) => {
              const initial = group.name.charAt(0).toUpperCase();

              return (
                <div
                  key={group.employee_id}
                  onClick={() => handleOpenModal(group)}
                  className="group bg-white dark:bg-slate-900 p-4.5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs hover:shadow-md hover:border-[#07518a] dark:hover:border-[#07518a] transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-3.5"
                >
                  {/* Header Row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {group.empImage ? (
                        <img src={group.empImage} alt={group.name} className="w-10 h-10 rounded-xl object-cover border border-slate-200 shadow-xs shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-[#07518a] text-white font-black text-sm flex items-center justify-center shadow-xs shrink-0">
                          {initial}
                        </div>
                      )}
                      <div className="truncate">
                        <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight truncate group-hover:text-[#07518a] dark:group-hover:text-[#38bdf8] transition-colors">
                          {group.name}
                        </h3>
                        <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 truncate flex items-center gap-1 mt-0.5">
                          <span>{group.code}</span>
                          <span>•</span>
                          <span>{group.department}</span>
                        </p>
                      </div>
                    </div>

                    <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-[#07518a]/10 text-[#07518a] dark:text-[#38bdf8] border border-[#07518a]/20 shrink-0">
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
                      <span className="text-[#07518a] dark:text-[#38bdf8] block text-xs">{group.lastActiveTime}</span>
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
                      className="px-3.5 py-1.5 rounded-xl bg-[#07518a] hover:bg-[#064270] text-white font-extrabold text-xs flex items-center gap-1.5 shadow-sm shadow-[#07518a]/25 transition-all border-0 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Map</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. OFF-CANVAS SLIDE-OVER DRAWER WITH LEFT TIMELINE & RIGHT MAP */}
      {modalEmployee && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[999999] flex justify-end font-sans overflow-hidden">
          {/* Backdrop Dim & Blur Layer */}
          <div
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs transition-opacity duration-300 animate-fadeIn cursor-pointer"
            onClick={() => setModalEmployee(null)}
          />

          {/* Off-Canvas Drawer Panel */}
          <aside
            className="relative w-full lg:w-[94vw] xl:w-[90vw] 2xl:w-[86vw] max-w-[1600px] h-full bg-white dark:bg-slate-900 border-l border-slate-200/90 dark:border-slate-800 shadow-2xl z-[1000000] flex flex-col animate-slideIn overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Decorative Top Accent Gradient Bar */}
            <div className="h-1 bg-gradient-to-r from-[#07518a] via-[#0c63a5] to-[#38bdf8] shrink-0" />

            {/* Off-Canvas Header */}
            <div className="px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
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
                  <div className="w-10 h-10 rounded-xl bg-[#07518a] text-white font-black text-base flex items-center justify-center shadow-xs shrink-0">
                    {modalEmployee.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="truncate">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm md:text-base font-black tracking-tight uppercase truncate text-slate-900 dark:text-slate-100">
                      {modalEmployee.name}
                    </h3>

                    {/* 4. Desktop: Live Active Badge */}
                    <span className="hidden md:inline-flex text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shrink-0">
                      Live Active
                    </span>

                    {/* 4. Mobile: Circular Download Icon in place of Live Active */}
                    <button
                      type="button"
                      onClick={handleDownloadClip}
                      disabled={isDownloadingClip}
                      className="flex md:hidden group relative items-center justify-center w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-[#07518a] dark:text-[#38bdf8] border border-slate-200 dark:border-slate-700 shadow-xs shrink-0 cursor-pointer active:scale-95 transition-all"
                      aria-label="Download clip"
                    >
                      {isDownloadingClip ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#07518a]" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      <span className="pointer-events-none absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-50">
                        Download clip
                      </span>
                    </button>
                  </div>
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {modalEmployee.code} • {modalEmployee.department} • Total Pings: <strong className="text-[#07518a] dark:text-[#38bdf8] font-bold">{modalEmployee.totalPings}</strong>
                  </p>
                </div>
              </div>

              {/* Header Right Actions */}
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <div className="hidden sm:flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs font-bold">
                  <Calendar className="w-3.5 h-3.5 text-[#07518a] dark:text-[#38bdf8]" />
                  <span className="text-slate-700 dark:text-slate-300">{selectedDate}</span>
                </div>

                {/* 1 & 2: Desktop Circular Download Icon with Tooltip between Date and Close */}
                <button
                  type="button"
                  onClick={handleDownloadClip}
                  disabled={isDownloadingClip}
                  className="hidden md:flex group relative items-center justify-center w-8 h-8 rounded-full bg-slate-100 hover:bg-[#07518a] hover:text-white dark:bg-slate-800 dark:hover:bg-[#07518a] text-slate-700 dark:text-slate-200 dark:hover:text-white transition-all cursor-pointer border border-slate-200 dark:border-slate-700 shadow-xs shrink-0 active:scale-95"
                  aria-label="Download clip"
                >
                  {isDownloadingClip ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#07518a] group-hover:text-white" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  {/* Tooltip on Hover */}
                  <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-bold text-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-50">
                    Download clip
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setModalEmployee(null)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-extrabold text-xs transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
                >
                  <X className="w-4 h-4" />
                  <span className="hidden sm:inline">Close</span>
                </button>
              </div>
            </div>

            {/* Off-Canvas Body: Responsive Layout (Mobile: Map on Top, Logs below; Desktop: Logs on Left, Map on Right) */}
            <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
              {/* Timeline: Desktop Left Sidebar / Mobile Bottom Half */}
              <div className="order-2 md:order-1 w-full md:w-76 lg:w-84 xl:w-92 flex-1 md:flex-none flex flex-col h-[52vh] md:h-full border-t md:border-t-0 md:border-r border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 overflow-hidden">
                {/* Timeline Header & Mini Summary */}
                <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#07518a]" />
                      <span>GPS Breadcrumb Timeline</span>
                    </h4>
                    <span className="px-2 py-0.5 rounded-full bg-[#07518a] text-white text-[10px] font-black shadow-xs">
                      {modalEmployee.logs.length} Pings
                    </span>
                  </div>

                  {/* 3. Punch & Active Mini Indicators - Hidden on Mobile View */}
                  <div className="hidden md:grid grid-cols-2 gap-2 text-[11px] font-bold">
                    <div className="bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between">
                      <div>
                        <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 block">First Punch</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-xs mt-0.5 block">{modalEmployee.initialPunchTime}</span>
                      </div>
                      <Clock className="w-4 h-4 text-emerald-500 shrink-0" />
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between">
                      <div>
                        <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 block">Last Active</span>
                        <span className="text-[#07518a] dark:text-[#38bdf8] font-extrabold text-xs mt-0.5 block">{modalEmployee.lastActiveTime}</span>
                      </div>
                      <Clock className="w-4 h-4 text-[#07518a] shrink-0" />
                    </div>
                  </div>

                  <p className="text-[10.5px] font-semibold text-slate-400">
                    Click any ping to jump on map:
                  </p>
                </div>

                {/* Timeline Content Area with Fixed Top & Bottom and Inner Scroll for Middle Pings */}
                <div className="flex-1 min-h-0 flex flex-col p-3 overflow-hidden">
                  {(() => {
                    const logs = modalEmployee.logs;
                    if (!logs || logs.length === 0) return null;

                    const firstLog = logs[0];
                    const lastLog = logs.length > 1 ? logs[logs.length - 1] : null;
                    const middleLogs = logs.length > 2 ? logs.slice(1, -1) : [];

                    const renderLogCard = (log: LocationLog, idx: number, isFirst: boolean, isLast: boolean) => {
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
                          id={`ping-card-${log.id}`}
                          onClick={() => setSelectedLogId(log.id)}
                          className={`rounded-xl p-2.5 transition-all cursor-pointer border ${
                            isSelected
                              ? 'bg-blue-50/90 dark:bg-blue-950/60 border-[#07518a] ring-2 ring-[#07518a]/30 shadow-xs'
                              : 'bg-white dark:bg-slate-900/90 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/80 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          {/* Header Row: Badge & Time */}
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 ${
                                  isFirst
                                    ? 'bg-emerald-600 text-white'
                                    : isLast
                                    ? 'bg-rose-600 text-white'
                                    : 'bg-[#07518a] text-white'
                                }`}
                              >
                                {idx + 1}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide ${
                                  isFirst
                                    ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                    : isLast
                                    ? 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                }`}
                              >
                                {isFirst ? 'Punch In (Start)' : isLast ? 'Last Punch (End)' : `Ping #${idx + 1}`}
                              </span>
                            </div>

                            <span className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100 shrink-0">
                              {timeStr}
                            </span>
                          </div>

                          {/* Location Details */}
                          <div className="flex items-start gap-1.5 pl-0.5 text-slate-700 dark:text-slate-300">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                            <p className="font-semibold text-xs leading-snug line-clamp-2">
                              {log.location_name || `${log.latitude.toFixed(6)}, ${log.longitude.toFixed(6)}`}
                            </p>
                          </div>
                        </div>
                      );
                    };

                    return (
                      <div className="flex-1 min-h-0 flex flex-col h-full gap-2">
                        {/* 1. FIXED TOP: First Record (Punch In / Start) */}
                        <div className="shrink-0">
                          {renderLogCard(firstLog, 0, true, logs.length === 1)}
                        </div>

                        {/* 2. INNER SCROLL: Middle Records (#2 to #N-1) */}
                        {middleLogs.length > 0 ? (
                          <div className="flex-1 min-h-0 flex flex-col pt-0.5">
                            <div className="flex items-center justify-between px-1 pb-1 shrink-0 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              <span>Intermediate Route ({middleLogs.length})</span>
                              <span className="text-[9px] font-normal lowercase italic text-slate-400">↕ scroll</span>
                            </div>
                            <div className="flex-1 overflow-y-auto space-y-2 pr-1 no-scrollbar">
                              {middleLogs.map((log, mIdx) => renderLogCard(log, mIdx + 1, false, false))}
                            </div>
                          </div>
                        ) : null}

                        {/* 3. FIXED BOTTOM: Last Record (Last Punch / End) */}
                        {lastLog && (
                          <div className="shrink-0 pt-1.5 border-t border-slate-200/80 dark:border-slate-800">
                            {renderLogCard(lastLog, logs.length - 1, false, true)}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Interactive Map: Mobile Top Half / Desktop Right Pane */}
              <div className="order-1 md:order-2 w-full md:w-auto flex-none md:flex-1 h-[48vh] md:h-full min-h-[260px] md:min-h-0 flex flex-col relative bg-slate-100 dark:bg-slate-950 overflow-hidden">
                <LeafletMapComponent
                  logs={modalEmployee.logs}
                  employeeName={modalEmployee.name}
                  empImage={modalEmployee.empImage}
                  selectedLogId={selectedLogId}
                  onSelectLog={(id: string) => setSelectedLogId(id)}
                />
              </div>
            </div>
          </aside>
        </div>,
        document.body
      )}
    </div>
  );
}
