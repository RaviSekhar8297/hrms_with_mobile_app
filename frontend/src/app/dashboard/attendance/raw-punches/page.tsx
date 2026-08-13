'use client';

import React, { useEffect, useState } from 'react';
import DashboardPageHeader from '../../components/DashboardPageHeader';
import AttendanceSubHeader from '../../components/AttendanceSubHeader';
import { getHeaders, API_BASE } from '../../utils/api';
import { usePermissions } from '../../hooks/usePermissions';

export default function RawPunchLogsPage() {
  const { isSuperAdmin } = usePermissions();

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [email, setEmail] = useState('');

  const [punches, setPunches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

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
    if (companyId) {
      fetchPunches();
    }
  }, [companyId, startDate, endDate]);

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

  const fetchPunches = async () => {
    if (!companyId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/attendance/raw-punches?company_id=${companyId}&start_date=${startDate}&end_date=${endDate}`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setPunches(Array.isArray(data) ? data : (data.data || data.punches || []));
      } else {
        setPunches([]);
      }
    } catch (e) {
      console.error('Error fetching raw punches:', e);
      setPunches([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompanyChange = (newId: string) => {
    setCompanyId(newId);
    localStorage.setItem('selectedCompanyId', newId);
  };

  const safePunches = Array.isArray(punches) ? punches : [];
  const filteredPunches = safePunches.filter(p => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const empName = `${p?.first_name || ''} ${p?.last_name || ''} ${p?.employee_name || ''}`.toLowerCase();
    const code = (p?.emp_id_code || '').toLowerCase();
    const device = (p?.device_name || p?.device_id || '').toLowerCase();
    return empName.includes(q) || code.includes(q) || device.includes(q);
  });

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto p-4 sm:p-6 font-sans">
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

      {/* HEADER & SEARCH CONTROLS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h2 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span>🔌</span> Biometric & Device Raw Punch Logs
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Real-time inspection of raw punch events from biometric terminals and mobile GPS
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200"
            />
            <span className="text-slate-400 text-xs font-bold">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200"
            />
          </div>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search employee or device..."
            className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 w-full md:w-56"
          />
        </div>
      </div>

      {/* RAW PUNCH LOGS TABLE */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[9.5px]">
                <th className="py-3 px-3">Employee</th>
                <th className="py-3 px-3">Punch Timestamp</th>
                <th className="py-3 px-3">Punch Direction</th>
                <th className="py-3 px-3">Terminal / Device</th>
                <th className="py-3 px-3">Verification Mode</th>
                <th className="py-3 px-3">Location / IP</th>
                <th className="py-3 px-3 text-center">Sync Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">Loading raw punch logs...</td>
                </tr>
              ) : filteredPunches.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="py-12 px-4 text-center flex flex-col items-center justify-center space-y-2">
                      <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center text-lg">
                        🔌
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">No Raw Punch Logs Recorded</h4>
                        <p className="text-[11px] text-slate-400 font-medium max-w-xs mt-0.5">
                          No biometric device or mobile GPS punches recorded for the selected date range.
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPunches.map((punch) => (
                  <tr key={punch.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200">
                      {punch.employee_name || (punch.first_name ? `${punch.first_name} ${punch.last_name || ''}` : 'Employee')}
                      {punch.emp_id_code && <span className="block text-[10px] text-slate-400 font-normal">{punch.emp_id_code}</span>}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                      {new Date(punch.punch_time).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${punch.punch_direction === 'IN' || punch.punch_type === 'CHECK_IN' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'}`}>
                        {punch.punch_direction || punch.punch_type || 'IN'}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-700 dark:text-slate-300">
                      {punch.device_name || punch.device_id || 'Biometric Terminal #1'}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                      {punch.verification_mode || 'Fingerprint / Face Recognition'}
                    </td>
                    <td className="py-3 px-3 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                      {punch.ip_address || punch.location || '192.168.1.104'}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        SYNCED
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
