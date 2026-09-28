'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import DashboardPageHeader from '../../components/DashboardPageHeader';
import { getHeaders, API_BASE } from '../../utils/api';
import { usePermissions } from '../../hooks/usePermissions';
import { useDashboard } from '../../components/DashboardContext';
import SlideDrawer from '../../components/SlideDrawer';
import { Upload, Pencil, Trash2, Camera, CameraOff, MapPin, Clock, CheckCircle2, ExternalLink, AlertTriangle, Search } from 'lucide-react';
import ModernPagination from '../../components/ModernPagination';
import { DatePickerSimple } from '@/components/ui/custom-controls';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

export default function RawPunchLogsPage() {
  const { showToast, companyId: globalCompanyId } = useDashboard();
  const { isSuperAdmin, hasPermission, getPermissionScope } = usePermissions();

  // 🛡️ Standardized tablename_action Permissions
  const canView = isSuperAdmin || hasPermission('attendance_raw_punches_view') || hasPermission('view_attendance_raw_punches');
  const canCreate = isSuperAdmin || hasPermission('attendance_raw_punches_create') || hasPermission('create_attendance_raw_punches');
  const canEdit = isSuperAdmin || hasPermission('attendance_raw_punches_edit') || hasPermission('edit_attendance_raw_punches');
  const canDelete = isSuperAdmin || hasPermission('attendance_raw_punches_delete') || hasPermission('delete_attendance_raw_punches');

  // 🌐 Data Scopes
  const viewScope_perm = getPermissionScope('attendance_raw_punches_view') || getPermissionScope('view_attendance_raw_punches') || 'SELF';
  const editScope_perm = getPermissionScope('attendance_raw_punches_edit') || getPermissionScope('edit_attendance_raw_punches') || 'SELF';
  const deleteScope_perm = getPermissionScope('attendance_raw_punches_delete') || getPermissionScope('delete_attendance_raw_punches') || 'SELF';

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
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
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
    if (!selectedMapPunch) {
      setResolvedAddress(null);
      setIsGeocoding(false);
      return;
    }

    const loc = selectedMapPunch.location_name;
    if (loc && loc !== 'IN' && loc !== 'OUT' && loc !== 'AUTO') {
      setResolvedAddress(loc);
      return;
    }

    if (selectedMapPunch.latitude && selectedMapPunch.longitude) {
      setIsGeocoding(true);
      fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${selectedMapPunch.latitude}&lon=${selectedMapPunch.longitude}&zoom=18&addressdetails=1`,
        { headers: { 'User-Agent': 'Brihaspathi-HRMS/1.0' } }
      )
        .then((res) => res.json())
        .then((geoData) => {
          if (geoData && geoData.display_name) {
            setResolvedAddress(geoData.display_name);
          } else {
            setResolvedAddress(`GPS Location (${selectedMapPunch.latitude}, ${selectedMapPunch.longitude})`);
          }
        })
        .catch(() => {
          setResolvedAddress(`GPS Location (${selectedMapPunch.latitude}, ${selectedMapPunch.longitude})`);
        })
        .finally(() => {
          setIsGeocoding(false);
        });
    } else {
      setResolvedAddress('Biometric Terminal Punch (No GPS coordinates)');
    }
  }, [selectedMapPunch]);

  useEffect(() => {
    if (canView) {
      setCurrentPage(1);
      fetchPunches();
    }
  }, [activeCompanyId, startDate, endDate, canView]);

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
      let url = `${API_BASE}/api/v1/attendance/raw-punches?start_date=${startDate}&end_date=${endDate}&scope=${viewScope_perm}`;
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
    let iso = punch.punch_time ? String(punch.punch_time).trim() : '';
    if (iso && !iso.includes('T') && iso.includes(' ')) {
      iso = iso.replace(' ', 'T');
    }
    const d = new Date(iso);
    if (!isNaN(d.getTime())) {
      const localIso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setEditPunchTime(localIso);
    } else {
      setEditPunchTime('');
    }

    setEditDirection(punch.direction || punch.punch_direction || 'IN');
    setEditDeviceId(punch.device_id || '');
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
          punch_time: new Date(editPunchTime).toISOString(),
          direction: editDirection,
          device_id: editDeviceId || null,
          location_name: editLocationName || null
        })
      });

      if (res.ok) {
        showToast('Raw punch record updated successfully!', 'success');
        setEditingPunch(null);
        fetchPunches();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to update punch record', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Connection error while updating punch', 'error');
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
        headers: getHeaders()
      });

      if (res.ok) {
        showToast('Raw punch record deleted successfully!', 'success');
        setDeletingPunch(null);
        fetchPunches();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to delete punch record', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Connection error while deleting punch', 'error');
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  const filteredPunches = punches.filter((punch) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const empName = `${punch.first_name || ''} ${punch.last_name || ''} ${punch.employee_name || ''}`.toLowerCase();
    const empCode = (punch.emp_id_code || punch.employee_id || '').toLowerCase();
    const deviceId = (punch.device_id || '').toLowerCase();
    const loc = (punch.location_name || '').toLowerCase();
    const source = (punch.source || '').toLowerCase();

    return empName.includes(q) || empCode.includes(q) || deviceId.includes(q) || loc.includes(q) || source.includes(q);
  });

  const totalItems = filteredPunches.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedPunches = filteredPunches.slice(startIndex, endIndex);

  // 🛑 Access Restriction Screen if View Permission is missing
  if (!canView) {
    return (
      <div className="space-y-6 animate-fadeIn w-full font-sans text-slate-800 dark:text-slate-100">
        <DashboardPageHeader
          title="Attendance Management"
          companies={companies}
          companyId={companyId}
          handleCompanyChange={handleCompanyChange}
          isSuperAdmin={isSuperAdmin}
          email={email}
          hideCompanySelect={false}
          hideUserBadge={true}
        />
        <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm text-center max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center text-3xl mb-4 border border-rose-200 dark:border-rose-900">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">Access Restricted</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium leading-relaxed">
            You do not have permission (<code className="text-rose-600 bg-rose-50 dark:bg-rose-950 px-1.5 py-0.5 rounded font-mono">attendance_raw_punches_view</code>) to view Biometric & Device Raw Punch Logs. Please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn w-full font-sans">
      <DashboardPageHeader
        title="Attendance Management"
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
            <span>🔌</span> Punch Logs
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Real-time punch logs
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
              className="h-9 px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 w-full outline-none focus:border-indigo-500"
            />
          </div>

          {/* 2. DATES */}
          <div className="flex items-center gap-1.5">
            <div className="w-[175px] sm:w-[180px]">
              <DatePickerSimple
                value={startDate}
                onChange={(val) => {
                  setStartDate(val);
                  if (val && endDate && val > endDate) {
                    setEndDate(val);
                  }
                }}
                maxDate={new Date()}
                placeholder="From date"
                triggerClassName="!min-h-[36px] !h-9 !py-1.5 !px-3"
              />
            </div>
            <span className="text-slate-400 text-xs font-bold">to</span>
            <div className="w-[175px] sm:w-[180px]">
              <DatePickerSimple
                value={endDate}
                onChange={(val) => setEndDate(val)}
                minDate={startDate || undefined}
                maxDate={new Date()}
                placeholder="To date"
                triggerClassName="!min-h-[36px] !h-9 !py-1.5 !px-3"
              />
            </div>
          </div>

          {/* 3. UPLOAD BUTTON */}
          {canCreate && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setPunchUploadOpen(true)}
                  className="h-9 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer border-0"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload CSV</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>Upload Raw Biometric CSV Punch File</TooltipContent>
            </Tooltip>
          )}

          {/* 4. MARK ATTENDANCE BUTTON */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/dashboard/attendance"
                className="h-9 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#07518a] hover:bg-[#064270] text-white text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer no-underline"
              >
                <span>⏱️</span>
                <span>Mark Attendance</span>
              </Link>
            </TooltipTrigger>
            <TooltipContent>Open Live Attendance Marking Page</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* RAW PUNCH LOGS TABLE */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
        <div className="overflow-x-auto max-h-[580px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800/90 backdrop-blur-xs z-10 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-700">
              <tr>
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
                    <div className="p-16 text-center space-y-3">
                      <div className="w-8 h-8 border-4 border-[#07518a] border-t-transparent rounded-full animate-spin mx-auto" />
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Loading Raw Punch Logs...</p>
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
                    <tr key={punch.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 font-medium">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0 border border-indigo-200/50 dark:border-indigo-800/50">
                            {initialLetter}
                          </div>
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-100 block text-xs">
                              {empName}
                            </span>
                            <span className="text-[10.5px] font-semibold text-slate-400 tabular-nums">
                              ID: {punch.emp_id_code || punch.employee_id}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        {(() => {
                          let iso = String(punch.punch_time || punch.created_at || '').trim();
                          if (!iso.includes('T') && iso.includes(' ')) iso = iso.replace(' ', 'T');
                          const d = new Date(iso);
                          if (isNaN(d.getTime())) {
                            return <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{punch.punch_time || '-'}</span>;
                          }
                          const day = String(d.getDate()).padStart(2, '0');
                          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                          const month = monthNames[d.getMonth()];
                          const year = d.getFullYear();
                          const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
                          return (
                            <div className="flex flex-col gap-0.5">
                              <span className="font-bold text-slate-800 dark:text-slate-200 text-xs tracking-tight">{`${day}-${month}-${year}`}</span>
                              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">{timeStr}</span>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                          (punch.direction || punch.punch_direction || 'IN') === 'IN'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300'
                            : 'bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300'
                        }`}>
                          {(punch.direction || punch.punch_direction || 'IN') === 'IN' ? 'IN Punch' : 'OUT Punch'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-700 dark:text-slate-300 text-xs">
                        <div className="flex flex-col items-start gap-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider border ${
                            (punch.source || '').toUpperCase().includes('MOBILE')
                              ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200/60 dark:border-purple-800/60'
                              : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200/60 dark:border-indigo-800/60'
                          }`}>
                            {punch.source || 'BIOMETRIC'}
                          </span>
                          {(punch.device_id || punch.device_model) && (punch.device_id || punch.device_model) !== 'System' && String(punch.device_id || punch.device_model).toUpperCase() !== String(punch.source || '').toUpperCase() ? (
                            <span className="text-[10px] font-mono font-medium text-slate-500 dark:text-slate-400">
                              Machine ID: <strong className="text-slate-700 dark:text-slate-200">{punch.device_id || punch.device_model}</strong>
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-500 dark:text-slate-400 tabular-nums font-medium">
                        {punch.ip_address || '-'}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedMapPunch(punch)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline cursor-pointer border-0 bg-transparent"
                          >
                            <MapPin className="w-3.5 h-3.5 shrink-0 text-blue-500" />
                            <span className="truncate max-w-[130px]">
                              {punch.location_name && punch.location_name !== 'IN' && punch.location_name !== 'OUT'
                                ? punch.location_name
                                : punch.latitude && punch.longitude
                                ? 'View GPS'
                                : 'Terminal'}
                            </span>
                          </button>
                        </div>
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
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={() => openEditModal(punch)}
                                    className="w-7.5 h-7.5 rounded-lg bg-indigo-50/80 hover:bg-indigo-600 text-indigo-600 hover:text-white dark:bg-indigo-950/40 dark:hover:bg-indigo-600 dark:text-indigo-400 dark:hover:text-white transition-all duration-200 flex items-center justify-center border border-indigo-200/60 dark:border-indigo-800/60 shadow-2xs cursor-pointer group"
                                  >
                                    <Pencil className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>Edit Raw Punch Log</TooltipContent>
                              </Tooltip>
                            )}
                            {canDelete && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={() => setDeletingPunch(punch)}
                                    className="w-7.5 h-7.5 rounded-lg bg-rose-50/80 hover:bg-rose-600 text-rose-600 hover:text-white dark:bg-rose-950/40 dark:hover:bg-rose-600 dark:text-rose-400 dark:hover:text-white transition-all duration-200 flex items-center justify-center border border-rose-200/60 dark:border-rose-800/60 shadow-2xs cursor-pointer group"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>Delete Raw Punch Log</TooltipContent>
                              </Tooltip>
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

      {/* EDIT PUNCH OFF-CANVAS SLIDE DRAWER */}
      <SlideDrawer
        isOpen={!!editingPunch}
        onClose={() => setEditingPunch(null)}
        title="Modify Raw Punch Record"
        width="max-w-[520px]"
      >
        {editingPunch && (
          <form onSubmit={handleUpdatePunch} className="space-y-5 text-xs">
            {/* Employee Information Header Card */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-violet-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs ring-2 ring-indigo-500/20">
                {(editingPunch.employee_name || editingPunch.first_name || 'E').trim().charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-black text-slate-850 dark:text-slate-100 truncate font-sans">
                  {editingPunch.first_name ? `${editingPunch.first_name} ${editingPunch.last_name || ''}` : editingPunch.employee_name || 'Employee'}
                </h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    ID: {editingPunch.emp_id_code || editingPunch.employee_id}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                    {editingPunch.source || 'MOBILE'}
                  </span>
                </div>
              </div>
            </div>

            {/* Verification Live Selfie / Photo Preview Card */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Attendance Verification Selfie</span>
                </label>
                {editingPunch.image_url ? (
                  <span className="inline-flex items-center gap-1 text-[9.5px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200/60">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    Verified Photo
                  </span>
                ) : (
                  <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                    No Photo
                  </span>
                )}
              </div>

              {editingPunch.image_url ? (
                <div className="relative rounded-2xl overflow-hidden border border-slate-200/80 dark:border-slate-700 bg-slate-950 shadow-md group">
                  <img
                    src={editingPunch.image_url}
                    alt="Attendance Selfie"
                    className="w-full h-64 object-cover object-center"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-slate-950/90 via-slate-950/60 to-transparent flex items-center justify-between">
                    <div className="text-white">
                      <p className="text-[11px] font-bold">Captured Live Selfie</p>
                      <p className="text-[9.5px] text-slate-300">Recorded on mobile check-in</p>
                    </div>
                    <a
                      href={editingPunch.image_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-[10px] font-bold backdrop-blur-xs transition-colors"
                    >
                      <span>Full View</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl p-6 border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850/30 text-center flex flex-col items-center justify-center gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
                    <CameraOff className="w-5 h-5 text-slate-400" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300">No Image Recorded</h5>
                    <p className="text-[11px] text-slate-400 font-medium max-w-xs mt-0.5">
                      No live selfie was captured for this punch event.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Editable Form Fields */}
            <div className="space-y-4 pt-1">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Punch Timestamp</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                      setEditPunchTime(localIso);
                    }}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 cursor-pointer bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200/60 dark:border-indigo-800/60 transition-colors"
                  >
                    Set to Current Time ⏱️
                  </button>
                </div>
                <div className="relative rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 p-1 shadow-xs focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                  <input
                    type="datetime-local"
                    required
                    value={editPunchTime}
                    onChange={(e) => setEditPunchTime(e.target.value)}
                    className="w-full px-3 py-2 bg-transparent text-xs font-bold text-slate-800 dark:text-slate-100 outline-none tabular-nums font-sans"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1 font-medium">Select exact punch date & local time (IST)</p>
              </div>

              <div>
                <label className="block text-[10.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Direction / Punch Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditDirection('IN')}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      editDirection === 'IN'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Check IN
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditDirection('OUT')}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      editDirection === 'OUT'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Check OUT
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Device ID / Serial Number
                </label>
                <input
                  type="text"
                  value={editDeviceId}
                  onChange={(e) => setEditDeviceId(e.target.value)}
                  placeholder="e.g. BIO-TERMINAL-01"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[10.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Location Name / Address
                </label>
                <input
                  type="text"
                  value={editLocationName}
                  onChange={(e) => setEditLocationName(e.target.value)}
                  placeholder="e.g. Headquarters Reception"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200/80 dark:border-slate-700/80 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setEditingPunch(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingEdit}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSubmittingEdit ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </form>
        )}
      </SlideDrawer>

      {/* DELETE CONFIRMATION MODAL */}
      {mounted && deletingPunch && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-fadeIn font-sans">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mx-auto border border-rose-200/60 dark:border-rose-900/40">
              <Trash2 className="w-6 h-6 text-rose-600 dark:text-rose-400" />
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

              <div className="p-3.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40">
                <span className="text-[9.5px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 block mb-1">
                  Verified Address / Location
                </span>
                {isGeocoding ? (
                  <div className="flex items-center gap-2 text-slate-500 text-xs py-1">
                    <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span>Resolving location address...</span>
                  </div>
                ) : (
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-relaxed font-sans">
                    {resolvedAddress || (selectedMapPunch.latitude && selectedMapPunch.longitude
                      ? `GPS Coordinates (${selectedMapPunch.latitude}, ${selectedMapPunch.longitude})`
                      : 'Physical Biometric Terminal Punch')}
                  </p>
                )}
              </div>

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
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-2xs no-underline"
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
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-[10px] font-black uppercase tracking-wider shadow-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 border-0"
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
