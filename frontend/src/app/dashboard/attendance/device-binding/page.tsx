'use client';

import React, { useEffect, useState } from 'react';
import DashboardPageHeader from '../../components/DashboardPageHeader';
import { getHeaders, API_BASE } from '../../utils/api';
import { useDashboard } from '../../components/DashboardContext';
import { usePermissions } from '../../hooks/usePermissions';
import { getDeviceModel, getDeviceIdentifier } from '../../utils/deviceUtils';

interface DeviceItem {
  employee_id: string;
  emp_id_code: string;
  first_name: string;
  last_name: string;
  email: string;
  department_name: string;
  designation_name: string;
  device_id: string | null;
  device_identifier: string | null;
  device_model: string | null;
  binding_status: 'ACTIVE' | 'COMPLETED' | 'PENDING';
  registered_at: string | null;
}

export default function DeviceBindingPage() {
  const { showToast, companyId: globalCompanyId } = useDashboard();
  const { isSuperAdmin, getPermissionScope } = usePermissions();
  const deviceScope = getPermissionScope('view_employee_devices');
  const isSelfScope = !isSuperAdmin && deviceScope === 'SELF';

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState<DeviceItem[]>([]);

  const activeCompanyId = globalCompanyId || companyId;

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PENDING'>('ALL');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Action Loading State & Confirmation Modal State
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [confirmResetItem, setConfirmResetItem] = useState<{ id: string; name: string } | null>(null);

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
    fetchDevices();
  }, [activeCompanyId, isSelfScope]);

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

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const scopeQuery = isSelfScope ? '&scope=my' : '&scope=all';
      const cid = activeCompanyId || localStorage.getItem('companyId');
      const url = cid && cid !== 'all'
        ? `${API_BASE}/api/v1/attendance/device-bindings?companyId=${cid}${scopeQuery}`
        : `${API_BASE}/api/v1/attendance/device-bindings?scope=${isSelfScope ? 'my' : 'all'}`;

      const res = await fetch(url, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setDevices(data.devices || []);
      }
    } catch (e) {
      console.error('Error loading device bindings:', e);
      showToast('Failed to load device bindings data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCompanyChange = (newId: string) => {
    setCompanyId(newId);
    localStorage.setItem('selectedCompanyId', newId);
  };

  const executeResetDevice = async (employeeId: string, empName: string) => {
    setResettingId(employeeId);
    try {
      const res = await fetch(`${API_BASE}/api/v1/attendance/device-bindings/reset`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ employeeId }),
      });
      if (res.ok) {
        showToast(`Device binding reset successfully for ${empName}`, 'success');
        fetchDevices();
      } else {
        showToast('Failed to reset device binding', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Connection error resetting device', 'error');
    } finally {
      setResettingId(null);
    }
  };

  // Filtered List
  const filteredDevices = devices.filter((d) => {
    const fullName = `${d.first_name || ''} ${d.last_name || ''}`.toLowerCase();
    const matchesSearch =
      fullName.includes(searchQuery.toLowerCase()) ||
      (d.emp_id_code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.device_model || '').toLowerCase().includes(searchQuery.toLowerCase());

    const isBound = d.binding_status === 'ACTIVE' || d.binding_status === 'COMPLETED';
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && isBound) ||
      (statusFilter === 'PENDING' && !isBound);

    return matchesSearch && matchesStatus;
  });

  // Reset pagination on search filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  // Pagination Math
  const totalItems = filteredDevices.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedDevices = filteredDevices.slice(startIndex, startIndex + pageSize);

  // Stats Counters
  const completedCount = devices.filter((d) => d.binding_status === 'COMPLETED' || d.binding_status === 'ACTIVE').length;
  const pendingCount = devices.filter((d) => d.binding_status === 'PENDING' || !d.device_id).length;

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

      {/* 📱 CURRENT MOBILE DEVICE INFO BANNER */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900 flex items-center justify-center text-xl shrink-0">
            📱
          </div>
          <div>
            <h4 className="text-[11px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Your Current Device Details</h4>
            <p className="text-xs font-bold font-mono text-slate-800 dark:text-slate-200 mt-0.5 break-all">
              Device ID: <span className="text-amber-600 dark:text-amber-400 font-black">{typeof window !== 'undefined' ? (localStorage.getItem('hrms_device_uuid') || 'Not Generated Yet') : ''}</span>
            </p>
          </div>
        </div>
        <div className="px-3.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-xs font-bold text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900 whitespace-nowrap">
          Model: <span className="font-extrabold text-indigo-800 dark:text-indigo-200">{typeof window !== 'undefined' ? getDeviceModel() : ''}</span>
        </div>
      </div>



      {/* FILTER & CONTROL CONSOLE */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <div className="relative w-full">
            <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder="Search employee name, ID code, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 transition-all placeholder-slate-400"
            />
          </div>
        </div>

        {/* Status Filter Segmented Tabs */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full sm:w-auto overflow-x-auto shrink-0">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs font-black'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 font-semibold'
            }`}
          >
            All ({devices.length})
          </button>
          <button
            onClick={() => setStatusFilter('ACTIVE')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'ACTIVE'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-xs font-black'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 font-semibold'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Completed ({completedCount})
          </button>
          <button
            onClick={() => setStatusFilter('PENDING')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'PENDING'
                ? 'bg-white dark:bg-slate-900 text-amber-600 shadow-xs font-black'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 font-semibold'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Pending ({pendingCount})
          </button>
        </div>
      </div>

      {/* DEVICE BINDINGS DATA TABLE */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-sans">
            <thead>
              <tr className="bg-slate-100/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-black uppercase tracking-wider text-[9.5px]">
                <th className="py-4 px-4 text-center w-12">S.NO</th>
                <th className="py-4 px-5">EMPLOYEE</th>
                <th className="py-4 px-4">EMP ID</th>
                <th className="py-4 px-4">DEPARTMENT / DESIGNATION</th>
                <th className="py-4 px-4">DEVICE MODEL / ID</th>
                <th className="py-4 px-4 text-center">BINDING STATUS</th>
                <th className="py-4 px-4 text-center">REGISTERED DATE</th>
                <th className="py-4 px-4 text-center">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="relative flex items-center justify-center">
                        <div className="w-10 h-10 border-4 border-indigo-200 dark:border-indigo-950 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin" />
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                          Loading Device Bindings...
                        </p>
                        <p className="text-[11px] text-slate-400 font-medium mt-0.5">Fetching employee mobile & biometric device registrations</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : paginatedDevices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400 font-bold uppercase tracking-wider text-xs">
                    No employee device records found matching filters.
                  </td>
                </tr>
              ) : (
                paginatedDevices.map((item, idx) => {
                  const sNo = startIndex + idx + 1;
                  const isBound = item.binding_status === 'ACTIVE' || item.binding_status === 'COMPLETED';
                  const empName = `${item.first_name || ''} ${item.last_name || ''}`.trim() || 'Employee';

                  return (
                    <tr key={item.employee_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-850/50 transition-colors">
                      <td className="py-4 px-4 text-center font-black text-slate-400 text-xs">
                        {sNo}
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-black text-xs flex items-center justify-center uppercase shadow-xs">
                            {empName.charAt(0)}
                          </span>
                          <div>
                            <span className="font-extrabold text-slate-800 dark:text-slate-100 block text-xs">
                              {empName}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium block">
                              {item.email}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black text-[10.5px]">
                          {item.emp_id_code || 'N/A'}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs">
                          {item.department_name || 'General'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium block">
                          {item.designation_name || 'Staff Member'}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        {isBound ? (
                          <div>
                            <span className="font-black text-indigo-600 dark:text-indigo-400 block text-xs">
                              📱 {(item.device_model || 'Mobile Device').replace(/iQOO Phone \(I2301\)|iQOO Z9x 5G|I2301/gi, 'iQOO Z7 Pro 5G')}
                            </span>
                            <span className="text-[9.5px] text-slate-400 font-bold block truncate max-w-[180px]" title={item.device_identifier || ''}>
                              ID: {item.device_identifier || 'Registered'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic font-medium">
                            No device registered
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-center">
                        {isBound ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-black uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-black uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-center font-bold text-slate-600 dark:text-slate-400 text-[11px]">
                        {item.registered_at
                          ? new Date(item.registered_at).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td className="py-4 px-4 text-center">
                        {isBound ? (
                          <button
                            type="button"
                            onClick={() => setConfirmResetItem({ id: item.employee_id, name: empName })}
                            disabled={resettingId === item.employee_id}
                            className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50"
                          >
                            {resettingId === item.employee_id ? 'Resetting...' : '🔓 Reset Device'}
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                            Awaiting Login
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION FOOTER */}
        {!loading && filteredDevices.length > 0 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-bold text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <span>Showing</span>
              <span className="text-slate-800 dark:text-slate-200 font-black">
                {startIndex + 1} - {Math.min(startIndex + pageSize, totalItems)}
              </span>
              <span>of</span>
              <span className="text-slate-800 dark:text-slate-200 font-black">{totalItems}</span>
              <span>employees</span>

              {/* Page Size Selector */}
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="ml-3 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold outline-none cursor-pointer"
              >
                <option value={10}>10 per page</option>
                <option value={20}>20 per page</option>
                <option value={50}>50 per page</option>
              </select>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-xs font-black transition-all"
              >
                ← Previous
              </button>

              <div className="flex items-center gap-1 px-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .map((page, idx, arr) => (
                    <React.Fragment key={page}>
                      {idx > 0 && arr[idx - 1] !== page - 1 && <span className="px-1 text-slate-400">...</span>}
                      <button
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        className={`w-7 h-7 rounded-lg text-xs font-black transition-all cursor-pointer ${
                          currentPage === page
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-750'
                        }`}
                      >
                        {page}
                      </button>
                    </React.Fragment>
                  ))}
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-xs font-black transition-all"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 🔓 SLEEK CONFIRMATION MODAL FOR DEVICE RESET */}
      {confirmResetItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center text-2xl mb-4">
              🔓
            </div>
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">Reset Device Binding</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 font-medium leading-relaxed">
              Are you sure you want to unbind/reset device for <strong className="text-slate-800 dark:text-slate-200 font-bold">{confirmResetItem.name}</strong>? This will allow them to bind a new device on their next punch login.
            </p>

            <div className="flex items-center justify-end gap-2.5 mt-6">
              <button
                type="button"
                onClick={() => setConfirmResetItem(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = confirmResetItem;
                  setConfirmResetItem(null);
                  executeResetDevice(target.id, target.name);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-md shadow-rose-600/20 transition-all cursor-pointer"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
