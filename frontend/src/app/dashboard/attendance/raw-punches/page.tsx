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

  // Pagination state (options: 50, 100, 200, 500)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

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
      setCurrentPage(1);
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

  // Pagination calculation
  const totalItems = filteredPunches.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedPunches = filteredPunches.slice(startIndex, endIndex);

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
                <th className="py-3 px-3">Punch Type</th>
                <th className="py-3 px-3">Terminal / Device</th>
                <th className="py-3 px-3">Verification Mode</th>
                <th className="py-3 px-3">IP Address</th>
                <th className="py-3 px-3">Location</th>
                <th className="py-3 px-3 text-center">Sync Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 font-medium">Loading raw punch logs...</td>
                </tr>
              ) : filteredPunches.length === 0 ? (
                <tr>
                  <td colSpan={8}>
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
                paginatedPunches.map((punch) => {
                  const mode = punch.verification_mode || punch.source || 'FINGERPRINT';
                  const isWeb = mode.toUpperCase().includes('WEB') || (punch.source || '').toUpperCase() === 'WEB';
                  const isMobile = mode.toUpperCase().includes('MOBILE') || (punch.source || '').toUpperCase() === 'MOBILE';
                  const isFace = mode.toUpperCase().includes('FACE');
                  
                  return (
                    <tr key={punch.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200">
                        {punch.employee_name || (punch.first_name ? `${punch.first_name} ${punch.last_name || ''}` : 'Employee')}
                        {punch.emp_id_code && <span className="block text-[10px] text-slate-400 font-normal">{punch.emp_id_code}</span>}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                        {new Date(punch.punch_time).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${punch.punch_direction === 'IN' || punch.punch_type === 'CHECK_IN' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200/60' : 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200/60'}`}>
                          {punch.punch_direction || punch.punch_type || 'IN'}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-700 dark:text-slate-300">
                        <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px] font-bold">
                          💻 {punch.device_name || punch.device_id || 'Biometric Terminal #1'}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50">
                          {isWeb ? (
                            <>🌐 Web GPS / Selfie</>
                          ) : isMobile ? (
                            <>📱 Mobile GPS App</>
                          ) : isFace ? (
                            <>👤 Face Recognition</>
                          ) : (
                            <>🖐️ Fingerprint / Biometric</>
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                        {punch.ip_address || '-'}
                      </td>
                      <td className="py-3 px-3">
                        {punch.latitude && punch.longitude ? (
                          <div>
                            <span className="font-mono text-[10.5px] font-bold text-slate-800 dark:text-slate-200 block">
                              Lat: {Number(punch.latitude).toFixed(4)}, Lng: {Number(punch.longitude).toFixed(4)}
                            </span>
                            {punch.location_name && (
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block truncate max-w-[200px]">
                                📍 {punch.location_name}
                              </span>
                            )}
                          </div>
                        ) : punch.location_name ? (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block truncate max-w-[200px]">
                            📍 {punch.location_name}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          SYNCED
                        </span>
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
