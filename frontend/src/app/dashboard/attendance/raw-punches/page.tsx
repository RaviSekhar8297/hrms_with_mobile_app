'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import DashboardPageHeader from '../../components/DashboardPageHeader';
import AttendanceSubHeader from '../../components/AttendanceSubHeader';
import { getHeaders, API_BASE } from '../../utils/api';
import { usePermissions, DataScope } from '../../hooks/usePermissions';
import { useDashboard } from '../../components/DashboardContext';
import SlideDrawer from '../../components/SlideDrawer';
import { Upload } from 'lucide-react';
import ModernPagination from '../../components/ModernPagination';

export default function RawPunchLogsPage() {
  const { showToast, companyId: globalCompanyId } = useDashboard();
  const { isSuperAdmin, hasPermission, getPermissionScope } = usePermissions();

  const canCreate = isSuperAdmin || hasPermission('create_attendance_raw_punches');
  const canEdit = isSuperAdmin || hasPermission('edit_attendance_raw_punches');
  const canDelete = isSuperAdmin || hasPermission('delete_attendance_raw_punches');
  const maxScope = getPermissionScope('view_attendance_raw_punches');

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
  const [editingPunch, setEditingPunch] = useState<any | null>(null);
  const [deletingPunch, setDeletingPunch] = useState<any | null>(null);

  // Edit form state
  const [editPunchTime, setEditPunchTime] = useState('');
  const [editDirection, setEditDirection] = useState('IN');
  const [editDeviceId, setEditDeviceId] = useState('');
  const [editLocationName, setEditLocationName] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);

  // CSV Upload state
  const [punchUploadOpen, setPunchUploadOpen] = useState(false);
  const [punchCsvFile, setPunchCsvFile] = useState<File | null>(null);
  const [isUploadingPunches, setIsUploadingPunches] = useState(false);

  const downloadSamplePunchCsv = () => {
    const csvContent = 'empid,punchdate\nEMP001,2026-09-11T09:00:00\nEMP002,2026-09-11T09:15:00';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_punch_upload.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePunchUpload = async () => {
    if (!punchCsvFile) {
      showToast('Please select a CSV file first', 'error');
      return;
    }
    setIsUploadingPunches(true);
    
    try {
      const text = await punchCsvFile.text();
      const rows = text.split('\n').map(r => r.trim()).filter(r => r);
      if (rows.length < 2) {
        showToast('CSV must contain header and at least one data row', 'error');
        setIsUploadingPunches(false);
        return;
      }
      const headers = rows[0].toLowerCase().split(',');
      const empIdx = headers.indexOf('empid');
      const timeIdx = headers.indexOf('punchdate');
      
      if (empIdx === -1 || timeIdx === -1) {
        showToast('CSV must contain "empid" and "punchdate" columns', 'error');
        setIsUploadingPunches(false);
        return;
      }
      
      const punchesToUpload = [];
      for (let i = 1; i < rows.length; i++) {
        const cols = rows[i].split(',');
        if (cols.length > Math.max(empIdx, timeIdx)) {
          punchesToUpload.push({
            empCode: cols[empIdx].trim(),
            punchTime: cols[timeIdx].trim()
          });
        }
      }
      
      const payload: any = { punches: punchesToUpload };
      if (activeCompanyId) {
        payload.companyId = activeCompanyId;
      }
      
      const res = await fetch(`${API_BASE}/api/v1/attendance/punches/bulk`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`${data.successCount} punches uploaded. ${data.errorCount} skipped.`, 'success');
        setPunchUploadOpen(false);
        setPunchCsvFile(null);
        fetchPunches();
      } else {
        showToast(data.error || 'Failed to upload punches', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Error uploading punches', 'error');
    }
    setIsUploadingPunches(false);
  };

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
      let url = `${API_BASE}/api/v1/attendance/raw-punches?start_date=${startDate}&end_date=${endDate}`;
      if (cid && cid !== 'all') {
        url += `&company_id=${cid}`;
      }

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

  const openEditModal = (punch: any) => {
    setEditingPunch(punch);
    let iso = String(punch.punch_time || '').trim();
    if (!iso.includes('T') && iso.includes(' ')) iso = iso.replace(' ', 'T');
    if (iso.length > 16) iso = iso.substring(0, 16);
    setEditPunchTime(iso);
    setEditDirection(punch.punch_direction || punch.direction || 'IN');
    setEditDeviceId(punch.device_id || punch.source || '');
    setEditLocationName(punch.location_name || '');
  };

  const handleUpdatePunch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPunch) return;

    setIsSubmittingEdit(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/attendance/raw-punches/${editingPunch.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          punch_time: editPunchTime,
          direction: editDirection,
          device_id: editDeviceId,
          location_name: editLocationName,
        }),
      });

      if (res.ok) {
        showToast('Raw punch record updated successfully', 'success');
        setEditingPunch(null);
        fetchPunches();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to update punch record', 'error');
      }
    } catch (e) {
      console.error('Error updating raw punch:', e);
      showToast('Server error while updating punch', 'error');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleDeletePunch = async () => {
    if (!deletingPunch) return;

    setIsSubmittingDelete(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/attendance/raw-punches/${deletingPunch.id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });

      if (res.ok) {
        showToast('Raw punch record deleted successfully', 'success');
        setDeletingPunch(null);
        fetchPunches();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to delete punch record', 'error');
      }
    } catch (e) {
      console.error('Error deleting raw punch:', e);
      showToast('Server error while deleting punch', 'error');
    } finally {
      setIsSubmittingDelete(false);
    }
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
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3.5 bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h2 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span>🔌</span> Biometric & Device Raw Punch Logs
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Real-time inspection of raw punch events from biometric terminals and mobile GPS
          </p>
        </div>

        {/* CONTROLS: 1. Search Box -> 2. Dates -> 3. Upload -> 4. Mark */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* 1. SEARCH BOX */}
          <div className="relative w-full sm:w-52">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search employee or device..."
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 w-full outline-none focus:border-indigo-500"
            />
          </div>

          {/* 2. DATES */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500"
            />
            <span className="text-slate-400 text-xs font-bold">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500"
            />
          </div>

          {/* 3. UPLOAD BUTTON */}
          {canCreate && (
            <button
              type="button"
              onClick={() => setPunchUploadOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload</span>
            </button>
          )}

          {/* 4. MARK BUTTON */}
          {canCreate && (
            <Link
              href="/dashboard/attendance"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer"
            >
              <span>⏱️</span>
              <span>Mark</span>
            </Link>
          )}
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
                {(canEdit || canDelete) && (
                  <th className="py-3 px-3 text-right">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={(canEdit || canDelete) ? 8 : 7} className="py-16 text-center">
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
                  <td colSpan={(canEdit || canDelete) ? 8 : 7}>
                    <div className="py-12 px-4 text-center flex flex-col items-center justify-center space-y-2">
                      <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center text-lg">
                        🔌
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">No Raw Punch Logs Recorded</h4>
                        <p className="text-[11px] text-slate-400 font-medium max-w-xs mt-0.5">
                          No biometric device or mobile GPS punches recorded for the selected scope & date range.
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
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${punch.punch_direction === 'IN' || punch.direction === 'IN' || punch.punch_type === 'CHECK_IN' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200/60' : 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200/60'}`}>
                          {punch.punch_direction || punch.direction || punch.punch_type || 'IN'}
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
                      {(canEdit || canDelete) && (
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => openEditModal(punch)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-slate-200 hover:text-indigo-600 transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
                                title="Edit Raw Punch"
                              >
                                ✏️
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => setDeletingPunch(punch)}
                                className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 transition-all cursor-pointer border border-rose-200/60 dark:border-rose-900/40"
                                title="Delete Raw Punch"
                              >
                                🗑️
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 🚀 MODERN ELEGANT PAGINATION */}
        {totalItems > 0 && (
          <ModernPagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={totalItems}
            startIndex={startIndex}
            endIndex={endIndex}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[25, 50, 100, 200, 500]}
            itemLabel="entries"
          />
        )}
      </div>

      {/* EDIT PUNCH MODAL */}
      {mounted && editingPunch && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-fadeIn font-sans">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/30">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">✏️</span>
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                  Edit Raw Punch Log
                </h3>
              </div>
              <button
                onClick={() => setEditingPunch(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center cursor-pointer hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdatePunch} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Employee
                </label>
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-200">
                  {editingPunch.first_name ? `${editingPunch.first_name} ${editingPunch.last_name || ''}` : editingPunch.employee_name || 'Employee'} ({editingPunch.emp_id_code || editingPunch.employee_id})
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Punch Timestamp
                </label>
                <input
                  type="datetime-local"
                  value={editPunchTime}
                  onChange={(e) => setEditPunchTime(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono font-bold outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Punch Direction
                </label>
                <select
                  value={editDirection}
                  onChange={(e) => setEditDirection(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="IN">IN (Check In)</option>
                  <option value="OUT">OUT (Check Out)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Terminal / Device ID
                </label>
                <input
                  type="text"
                  value={editDeviceId}
                  onChange={(e) => setEditDeviceId(e.target.value)}
                  placeholder="e.g. Terminal #1 or Mobile App"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Location Name / Notes
                </label>
                <input
                  type="text"
                  value={editLocationName}
                  onChange={(e) => setEditLocationName(e.target.value)}
                  placeholder="Optional location notes"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingPunch(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {mounted && deletingPunch && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-fadeIn font-sans">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center text-xl mx-auto">
              🗑️
            </div>
            <div>
              <h3 className="text-base font-black text-slate-850 dark:text-slate-100">
                Delete Raw Punch Record?
              </h3>
              <p className="text-xs text-slate-400 font-medium mt-1">
                Are you sure you want to delete this punch log for{' '}
                <strong className="text-slate-700 dark:text-slate-200">
                  {deletingPunch.first_name ? `${deletingPunch.first_name} ${deletingPunch.last_name || ''}` : deletingPunch.employee_name || 'Employee'}
                </strong>
                ? This action cannot be undone.
              </p>
            </div>

            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingPunch(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeletePunch}
                disabled={isSubmittingDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer disabled:opacity-50"
              >
                {isSubmittingDelete ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

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
      {/* Punch Upload Slideout Drawer */}
      <SlideDrawer
        isOpen={punchUploadOpen}
        onClose={() => setPunchUploadOpen(false)}
        title="Upload Punches (CSV)"
      >
        <div className="flex flex-col h-full">
          <div className="flex-1 overflow-y-auto premium-scrollbar p-6 space-y-6">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Upload raw punch data using a CSV file. The file must contain exactly the following two columns:
              <br/><br/>
              <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono text-[10px] text-blue-600 dark:text-blue-400 font-bold">empid</code> - The unique employee ID code<br/>
              <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono text-[10px] text-blue-600 dark:text-blue-400 font-bold mt-1 inline-block">punchdate</code> - Valid Datetime string (e.g. 2023-10-25T09:00:00)
            </p>

            <button
              onClick={downloadSamplePunchCsv}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-300 text-[10px] font-black uppercase tracking-wider rounded-xl transition-colors w-full border border-slate-200 dark:border-slate-700 cursor-pointer"
            >
              Download Sample CSV
            </button>

            <div>
              <label className="block text-[9.5px] font-black text-slate-500 dark:text-slate-450 uppercase tracking-widest mb-1.5">Select CSV File</label>
              <input
                type="file"
                accept=".csv"
                onChange={e => {
                  if (e.target.files && e.target.files.length > 0) {
                    setPunchCsvFile(e.target.files[0]);
                  }
                }}
                className="form-input text-xs w-full cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:uppercase file:tracking-wider file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-900/30 dark:file:text-blue-400 hover:file:bg-blue-100 dark:hover:file:bg-blue-900/50"
              />
              {punchCsvFile && (
                <p className="mt-2 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  Selected: {punchCsvFile.name}
                </p>
              )}
            </div>
          </div>
          <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-900/30">
            <button
              onClick={() => setPunchUploadOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handlePunchUpload}
              disabled={isUploadingPunches || !punchCsvFile}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-[10px] font-black uppercase tracking-wider shadow-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isUploadingPunches ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Uploading...
                </>
              ) : (
                'Upload Punches'
              )}
            </button>
          </div>
        </div>
      </SlideDrawer>
    </div>
  );
}
