'use client';

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useDashboard } from '../../components/DashboardContext';
import AttendanceSubHeader from '../../components/AttendanceSubHeader';
import { getHeaders } from '../../utils/api';
import { usePermissions } from '../../hooks/usePermissions';

// Dynamically import Leaflet map to prevent Next.js SSR window undefined errors
const LeafletMap = dynamic(() => import('./LeafletMapComponent'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-80 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400">
      Loading Leaflet Interactive Map...
    </div>
  )
});

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
  department_name?: string;
}

interface EmployeeGroup {
  employee_id: string;
  name: string;
  code: string;
  email: string;
  department: string;
  initialPunchTime: string;
  initialLocation: string;
  lastActiveTime: string;
  lastLocation: string;
  totalPings: number;
  logs: LocationLog[];
}

export default function LiveTrackingPage() {
  const { showToast } = useDashboard();
  const { isSuperAdmin } = usePermissions();

  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [logs, setLogs] = useState<LocationLog[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  const fetchTrackingLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/attendance/live-tracking?startDate=${selectedDate}&endDate=${selectedDate}`, {
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
  }, [selectedDate]);

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
      // Sort chronologically
      empLogs.sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());

      const firstLog = empLogs[0];
      const lastLog = empLogs[empLogs.length - 1];

      const empName = `${firstLog.first_name || ''} ${firstLog.last_name || ''}`.trim() || 'Employee';
      const empCode = firstLog.emp_id_code || empId.slice(0, 6);
      const dept = firstLog.department_name || 'General';

      groups.push({
        employee_id: empId,
        name: empName,
        code: empCode,
        email: firstLog.email || '',
        department: dept,
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

  // Filter groups by search query
  const filteredGroups = useMemo(() => {
    return employeeGroups.filter((g) => {
      const q = searchQuery.toLowerCase().trim();
      return !q || g.name.toLowerCase().includes(q) || g.code.toLowerCase().includes(q) || g.department.toLowerCase().includes(q);
    });
  }, [employeeGroups, searchQuery]);

  const activeGroup = useMemo(() => {
    if (!selectedEmployeeId) return filteredGroups[0] || null;
    return employeeGroups.find((g) => g.employee_id === selectedEmployeeId) || filteredGroups[0] || null;
  }, [employeeGroups, filteredGroups, selectedEmployeeId]);

  return (
    <div className="p-3 space-y-3.5 max-w-[100vw] overflow-x-hidden font-sans">
      {/* SubHeader Navigation */}
      <AttendanceSubHeader activeTab="tracking" />

      {/* Main Banner & Date Filter */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg md:text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
            <span>📍</span> ATTENDANCE LOCATION TRACKING
          </h1>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
            Automatic 10-minute silent GPS breadcrumb tracking & route timeline for field staff
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-xs font-bold text-slate-500">Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-900 dark:text-slate-100 outline-none cursor-pointer"
            />
          </div>

          <input
            type="text"
            placeholder="Search employee..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 px-3 py-1.5 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]"
          />
        </div>
      </div>

      {loading ? (
        <div className="bg-white dark:bg-slate-900 p-16 text-center rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Loading Field Staff Location Logs...
          </p>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 p-16 text-center rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
          <span className="text-4xl">📍</span>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No Location Logs Found for {selectedDate}</p>
          <p className="text-xs text-slate-500">Location logs will automatically register every 10 minutes when field staff punch attendance.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column: Summary Cards List (1 card per employee) */}
          <div className="lg:col-span-5 space-y-2.5 max-h-[720px] overflow-y-auto pr-1 no-scrollbar">
            <div className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1 flex items-center justify-between">
              <span>Field Staff ({filteredGroups.length})</span>
              <span className="text-[10px] text-blue-500">Select to View Route</span>
            </div>

            {filteredGroups.map((group) => {
              const isSelected = activeGroup?.employee_id === group.employee_id;
              const initial = group.name.charAt(0).toUpperCase();

              return (
                <div
                  key={group.employee_id}
                  onClick={() => setSelectedEmployeeId(group.employee_id)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-2.5 ${
                    isSelected
                      ? 'bg-gradient-to-r from-blue-50/90 to-indigo-50/80 dark:from-blue-950/60 dark:to-indigo-950/40 border-blue-500 ring-2 ring-blue-500/20 shadow-md'
                      : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-xs shrink-0">
                        {initial}
                      </div>
                      <div className="truncate">
                        <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight truncate">
                          {group.name}
                        </h4>
                        <p className="text-[10.5px] font-semibold text-slate-400 dark:text-slate-500 truncate">
                          {group.code} • {group.department}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 shrink-0">
                      {group.totalPings} Pings
                    </span>
                  </div>

                  {/* Initial Punch Info & Last Active */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-bold pt-2 border-t border-slate-100 dark:border-slate-800/60">
                    <div className="space-y-0.5">
                      <span className="text-[9.5px] text-slate-400 uppercase tracking-wider block">First Punch</span>
                      <span className="text-slate-800 dark:text-slate-200 block">{group.initialPunchTime}</span>
                      <span className="text-[10px] font-medium text-slate-500 truncate block">{group.initialLocation}</span>
                    </div>
                    <div className="space-y-0.5 text-right">
                      <span className="text-[9.5px] text-slate-400 uppercase tracking-wider block">Last Ping</span>
                      <span className="text-emerald-600 dark:text-emerald-400 block">{group.lastActiveTime}</span>
                      <span className="text-[10px] font-medium text-slate-500 truncate block">{group.lastLocation}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Interactive Leaflet Map & Timeline */}
          <div className="lg:col-span-7 space-y-3">
            {activeGroup && (
              <>
                {/* Active Employee Banner Header */}
                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-black text-sm flex items-center justify-center shadow-xs shrink-0">
                      {activeGroup.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                        {activeGroup.name}
                      </h3>
                      <p className="text-xs font-semibold text-slate-500">
                        {activeGroup.code} • Route Timeline ({activeGroup.totalPings} GPS Points)
                      </p>
                    </div>
                  </div>

                  <span className="px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-200 dark:border-emerald-800/60">
                    Live Active
                  </span>
                </div>

                {/* Leaflet Interactive Map */}
                <div className="bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
                  <LeafletMap logs={activeGroup.logs} employeeName={activeGroup.name} />
                </div>

                {/* Chronological Timeline Log List */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                  <h4 className="text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                    Detailed 10-Minute Ping History ({activeGroup.logs.length} Entries)
                  </h4>
                  <div className="max-h-[220px] overflow-y-auto space-y-2 no-scrollbar pr-1">
                    {activeGroup.logs.map((log, idx) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs font-bold text-slate-700 dark:text-slate-300"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-5 h-5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-black flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div>
                            <p className="font-extrabold text-slate-900 dark:text-slate-100">
                              {log.location_name || `${log.latitude.toFixed(6)}, ${log.longitude.toFixed(6)}`}
                            </p>
                            <p className="text-[10px] font-mono text-slate-400">
                              Lat: {log.latitude.toFixed(6)}, Lon: {log.longitude.toFixed(6)}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10.5px] font-mono font-black text-slate-500 shrink-0">
                          {new Date(log.recorded_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
