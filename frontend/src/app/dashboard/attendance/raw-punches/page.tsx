'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import DashboardPageHeader from '../../components/DashboardPageHeader';
import AttendanceSubHeader from '../../components/AttendanceSubHeader';
import { getHeaders, API_BASE } from '../../utils/api';
import { usePermissions } from '../../hooks/usePermissions';
import { useDashboard } from '../../components/DashboardContext';

export default function RawPunchLogsPage() {
  const { showToast, companyId: globalCompanyId } = useDashboard();
  const { isSuperAdmin } = usePermissions();

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [email, setEmail] = useState('');

  const activeCompanyId = globalCompanyId || companyId;

  const [punches, setPunches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  // Pagination state (options: 50, 100, 200, 500)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [selectedMapPunch, setSelectedMapPunch] = useState<any | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

    const savedCompanyId = localStorage.getItem('companyId');
    if (savedCompanyId) {
      setCompanyId(savedCompanyId);
    }

    fetchCompanies();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    fetchPunches();
  }, [activeCompanyId, startDate, endDate]);

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
    setIsLoading(true);
    try {
      const cid = activeCompanyId || localStorage.getItem('companyId');
      const url = cid && cid !== 'all'
        ? `${API_BASE}/api/v1/attendance/raw-punches?company_id=${cid}&start_date=${startDate}&end_date=${endDate}`
        : `${API_BASE}/api/v1/attendance/raw-punches?start_date=${startDate}&end_date=${endDate}`;
      const res = await fetch(url, { headers: getHeaders() });
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
    <div className="space-y-6 animate-fadeIn w-full font-sans">
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
                <th className="py-3 px-3">IP Address</th>
                <th className="py-3 px-3">Location</th>
                <th className="py-3 px-3 text-center">Sync Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="relative flex items-center justify-center">
                        <div className="w-10 h-10 border-4 border-indigo-200 dark:border-indigo-950 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin" />
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                          Loading Raw Punch Logs...
                        </p>
                        <p className="text-[11px] text-slate-400 font-medium mt-0.5">Fetching latest biometric & GPS device punches</p>
                      </div>
                    </div>
                  </td>
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
                paginatedPunches.map((punch) => {
                  const empName = punch.employee_name || (punch.first_name ? `${punch.first_name} ${punch.last_name || ''}` : 'Employee');
                  const initialLetter = empName.trim().charAt(0).toUpperCase();

                  return (
                    <tr key={punch.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200">
                        <div className="flex items-center gap-3">
                          {punch.image_url ? (
                            <img
                              src={punch.image_url}
                              alt="Selfie"
                              className="w-8 h-8 rounded-full object-cover shrink-0 ring-2 ring-indigo-500/20 border border-slate-200 dark:border-slate-800 shadow-2xs"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-blue-500 text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-2xs ring-2 ring-indigo-500/20">
                              {initialLetter}
                            </div>
                          )}
                          <div>
                            <span className="font-black text-slate-850 dark:text-slate-100 text-xs block font-sans">{empName}</span>
                            {punch.emp_id_code && <span className="block text-[10px] text-slate-400 font-semibold font-mono mt-0.5">{punch.emp_id_code}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-sans">
                        {(() => {
                          let iso = String(punch.punch_time || punch.created_at || '').trim();
                          if (!iso.includes('T') && iso.includes(' ')) iso = iso.replace(' ', 'T');
                          const d = new Date(iso);
                          if (isNaN(d.getTime())) return punch.punch_time;
                          const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
                          const dateStr = d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
                          return (
                            <div>
                              <span className="block font-mono font-black text-slate-800 dark:text-slate-100 text-xs">{timeStr}</span>
                              <span className="block text-[10px] text-slate-400 font-semibold font-sans mt-0.5">{dateStr}</span>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${punch.punch_direction === 'IN' || punch.punch_type === 'CHECK_IN' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200/60' : 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200/60'}`}>
                          {punch.punch_direction || punch.punch_type || 'IN'}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-sans">
                        {(() => {
                          const isMobile = (punch.source || '').toUpperCase() === 'MOBILE' || (punch.verification_mode || '').toUpperCase().includes('MOBILE');
                          const isWeb = (punch.source || '').toUpperCase() === 'WEB' || (punch.verification_mode || '').toUpperCase().includes('WEB');
                          
                          let deviceIdText = punch.device_id || punch.device_identifier || (isMobile ? 'Mobile App' : isWeb ? 'Web Portal' : 'Biometric Terminal #1');
                          let deviceModelText = punch.device_model || (isMobile ? 'Android / iOS Device' : isWeb ? 'Web Browser' : 'Biometric Device');

                          return (
                            <div>
                              <span className="block font-mono font-black text-slate-800 dark:text-slate-100 text-xs">
                                {isMobile ? '📱 ' : isWeb ? '💻 ' : '📟 '}{deviceIdText}
                              </span>
                              {deviceModelText && (
                                <span className="block text-[10px] text-slate-400 font-semibold font-sans mt-0.5">
                                  {deviceModelText}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                        {punch.ip_address || '-'}
                      </td>
                      <td className="py-3 px-3 font-sans">
                        {punch.latitude && punch.longitude ? (
                          <button
                            type="button"
                            onClick={() => setSelectedMapPunch(punch)}
                            className="inline-flex items-center gap-1.5 p-1.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 text-blue-650 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-[10px] font-bold transition-all cursor-pointer shadow-2xs group select-none"
                          >
                            <span className="text-xs group-hover:scale-125 transition-transform">📍</span>
                            <span className="font-mono text-[10px] font-black text-slate-800 dark:text-slate-200">
                              {punch.location_name
                                ? (punch.location_name.length > 20 ? punch.location_name.substring(0, 20) + '...' : punch.location_name)
                                : `${Number(punch.latitude).toFixed(3)}, ${Number(punch.longitude).toFixed(3)}`}
                            </span>
                          </button>
                        ) : punch.location_name ? (
                          <button
                            type="button"
                            onClick={() => setSelectedMapPunch(punch)}
                            className="inline-flex items-center gap-1.5 p-1.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-900/40 hover:bg-indigo-100 text-[10px] font-bold transition-all cursor-pointer shadow-2xs group select-none"
                          >
                            <span className="text-xs group-hover:scale-125 transition-transform">📍</span>
                            <span className="font-sans text-[10px] font-black text-slate-800 dark:text-slate-200">
                              {punch.location_name.length > 20 ? punch.location_name.substring(0, 20) + '...' : punch.location_name}
                            </span>
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60 text-[9.5px] font-extrabold uppercase tracking-wider select-none">
                            <span>📟</span> Bio-Metric Punch
                          </span>
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
      {/* Location Map Preview Modal */}
      {mounted && selectedMapPunch && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-fadeIn font-sans">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-[0_0_80px_rgba(0,0,0,0.5)] overflow-hidden text-left flex flex-col max-h-[90vh] z-[10000]">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center text-lg shadow-2xs">
                  📍
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-850 dark:text-slate-100 uppercase tracking-wider font-sans">
                    Punch Location Details
                  </h3>
                  <p className="text-[10.5px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5 font-sans">
                    {selectedMapPunch.emp_id_code || selectedMapPunch.employee_id} - {selectedMapPunch.first_name || selectedMapPunch.employee_name} {selectedMapPunch.last_name || ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedMapPunch(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-all cursor-pointer border-0 outline-none"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto">
              {/* Punch info banner */}
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800 text-xs">
                <div>
                  <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 block">Punch Time</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                    {(() => {
                      let iso = String(selectedMapPunch.punch_time || selectedMapPunch.created_at || '').trim();
                      if (!iso.includes('T') && iso.includes(' ')) iso = iso.replace(' ', 'T');
                      const d = new Date(iso);
                      return isNaN(d.getTime()) ? selectedMapPunch.punch_time : d.toLocaleString([], { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
                    })()}
                  </span>
                </div>
                <div>
                  <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 block">Source / Direction</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 font-sans">{selectedMapPunch.source || selectedMapPunch.verification_mode || 'WEB'} ({selectedMapPunch.punch_direction || selectedMapPunch.direction || 'IN'})</span>
                </div>
              </div>

              {/* Location Address string */}
              {selectedMapPunch.location_name && (
                <div className="p-3.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40">
                  <span className="text-[9.5px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 block mb-1">
                    Verified Address
                  </span>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-relaxed font-sans">
                    {selectedMapPunch.location_name}
                  </p>
                </div>
              )}

              {/* Map iFrame or Coordinates */}
              {selectedMapPunch.latitude && selectedMapPunch.longitude ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono px-1">
                    <span>Lat: <strong>{selectedMapPunch.latitude}</strong></span>
                    <span>Long: <strong>{selectedMapPunch.longitude}</strong></span>
                  </div>
                  <div className="w-full h-64 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-inner bg-slate-100 dark:bg-slate-900 relative">
                    <iframe
                      title="Punch Location Map"
                      width="100%"
                      height="100%"
                      frameBorder="0"
                      scrolling="no"
                      marginHeight={0}
                      marginWidth={0}
                      src={`https://maps.google.com/maps?q=${selectedMapPunch.latitude},${selectedMapPunch.longitude}&z=15&output=embed`}
                      className="w-full h-full"
                    />
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/30 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                  <span className="text-3xl block mb-2">📟</span>
                  <p className="text-xs font-black text-slate-700 dark:text-slate-300">Bio-Metric Punch</p>
                  <p className="text-[10.5px] text-slate-400 dark:text-slate-500 font-medium mt-1">
                    GPS Coordinates not captured for physical biometric terminal punch.
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between">
              {selectedMapPunch.latitude && selectedMapPunch.longitude ? (
                <a
                  href={`https://www.google.com/maps?q=${selectedMapPunch.latitude},${selectedMapPunch.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-2xs"
                >
                  <span>🌐</span> Open in Google Maps
                </a>
              ) : <div />}

              <button
                onClick={() => setSelectedMapPunch(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-650 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/40 transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
