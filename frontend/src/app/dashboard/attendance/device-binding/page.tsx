'use client';

import React, { useEffect, useState } from 'react';
import DashboardPageHeader from '../../components/DashboardPageHeader';
import { getHeaders, API_BASE } from '../../utils/api';
import { useDashboard } from '../../components/DashboardContext';
import { usePermissions } from '../../hooks/usePermissions';
import { getDeviceModel } from '../../utils/deviceUtils';
import ModernPagination from '../../components/ModernPagination';

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

interface ApiKeyItem {
  id: string;
  company_id: string;
  device_name: string;
  api_key: string;
  allowed_ip: string | null;
  timezone: string;
  is_active: boolean;
  created_at: string;
}

interface AccessBindingItem {
  employee_id: string;
  emp_id_code: string;
  first_name: string;
  last_name: string;
  email: string;
  employee_status: string;
  department_name: string;
  designation_name: string;
  login_mode: 'NONE' | 'WEB_ONLY' | 'MOBILE_ONLY' | 'BOTH';
  allow_web_punch: boolean;
  allow_mobile_punch: boolean;
  require_punch_approval: boolean;
  is_active: boolean;
  updated_at: string | null;
}

export default function DeviceBindingPage() {
  const { showToast, companyId: globalCompanyId } = useDashboard();
  const { isSuperAdmin, hasPermission } = usePermissions();
  const canEdit = isSuperAdmin || hasPermission('edit_employee_devices') || hasPermission('edit_attendance');

  const [activeTab, setActiveTab] = useState<'ACCESS_BINDING' | 'MOBILE_BINDING' | 'API_KEYS'>('ACCESS_BINDING');

  // Access Binding state
  const [accessBindings, setAccessBindings] = useState<AccessBindingItem[]>([]);
  const [loadingAccess, setLoadingAccess] = useState(true);
  const [updatingAccessEmpId, setUpdatingAccessEmpId] = useState<string | null>(null);
  const [accessSearchQuery, setAccessSearchQuery] = useState('');
  const [accessCurrentPage, setAccessCurrentPage] = useState(1);
  const [accessPageSize, setAccessPageSize] = useState(25);

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState<DeviceItem[]>([]);

  // API Key State
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newAllowedIp, setNewAllowedIp] = useState('');
  const [newTimezone, setNewTimezone] = useState('Asia/Kolkata');
  const [generatingKey, setGeneratingKey] = useState(false);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  const activeCompanyId = globalCompanyId || companyId;

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PENDING'>('ALL');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

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
    fetchApiKeys();
    fetchAccessBindings();
  }, [activeCompanyId]);

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

  const fetchAccessBindings = async () => {
    setLoadingAccess(true);
    try {
      const url = activeCompanyId ? `${API_BASE}/api/v1/attendance/access-bindings?companyId=${activeCompanyId}` : `${API_BASE}/api/v1/attendance/access-bindings`;
      const res = await fetch(url, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setAccessBindings(data.bindings || []);
      }
    } catch (err) {
      console.error('Error fetching access bindings:', err);
    } finally {
      setLoadingAccess(false);
    }
  };

  const handleUpdateAccess = async (employeeId: string, patch: Partial<AccessBindingItem>) => {
    setUpdatingAccessEmpId(employeeId);
    setAccessBindings(prev => prev.map(b => b.employee_id === employeeId ? { ...b, ...patch } : b));
    try {
      const current = accessBindings.find(b => b.employee_id === employeeId);
      const body = {
        login_mode: patch.login_mode !== undefined ? patch.login_mode : current?.login_mode,
        allow_web_punch: patch.allow_web_punch !== undefined ? patch.allow_web_punch : current?.allow_web_punch,
        allow_mobile_punch: patch.allow_mobile_punch !== undefined ? patch.allow_mobile_punch : current?.allow_mobile_punch,
        require_punch_approval: patch.require_punch_approval !== undefined ? patch.require_punch_approval : current?.require_punch_approval,
        is_active: patch.is_active !== undefined ? patch.is_active : current?.is_active
      };
      const res = await fetch(`${API_BASE}/api/v1/attendance/access-bindings/${employeeId}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(body)
      });
      if (res.ok) {
        showToast('Access settings updated successfully', 'success');
      } else {
        showToast('Failed to update access settings', 'error');
        fetchAccessBindings();
      }
    } catch (err) {
      showToast('Network error updating settings', 'error');
      fetchAccessBindings();
    } finally {
      setUpdatingAccessEmpId(null);
    }
  };

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const cid = activeCompanyId || localStorage.getItem('companyId');
      const url = cid && cid !== 'all'
        ? `${API_BASE}/api/v1/attendance/device-bindings?companyId=${cid}`
        : `${API_BASE}/api/v1/attendance/device-bindings`;

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

  const fetchApiKeys = async () => {
    setLoadingKeys(true);
    try {
      const cid = activeCompanyId || localStorage.getItem('companyId');
      const url = cid && cid !== 'all'
        ? `${API_BASE}/api/v1/attendance/device-api-keys?companyId=${cid}`
        : `${API_BASE}/api/v1/attendance/device-api-keys`;

      const res = await fetch(url, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setApiKeys(data.keys || []);
      }
    } catch (e) {
      console.error('Error fetching API keys:', e);
    } finally {
      setLoadingKeys(false);
    }
  };

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompanyId) {
      showToast('Please select a company first.', 'error');
      return;
    }
    setGeneratingKey(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/attendance/device-api-keys`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          companyId: activeCompanyId,
          device_name: newDeviceName || 'Main Biometric Machine',
          allowed_ip: newAllowedIp.trim() || null,
          timezone: newTimezone
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Device API Key generated successfully!', 'success');
        setNewDeviceName('');
        setNewAllowedIp('');
        fetchApiKeys();
      } else {
        showToast(data.error || 'Failed to generate API key', 'error');
      }
    } catch (err) {
      showToast('Error generating API key', 'error');
    } finally {
      setGeneratingKey(false);
    }
  };

  const handleRevokeKey = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this API Key? Any biometric machine using it will lose sync access.')) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/attendance/device-api-keys/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (res.ok) {
        showToast('API Key revoked successfully', 'success');
        fetchApiKeys();
      } else {
        showToast('Failed to revoke API key', 'error');
      }
    } catch (err) {
      showToast('Error revoking API key', 'error');
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKeyId(id);
    showToast('Copied to clipboard!', 'success');
    setTimeout(() => setCopiedKeyId(null), 2000);
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

  const publicWebhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/v1/attendance/public/device-punch` : '/api/v1/attendance/public/device-punch';

  return (
    <div className="space-y-6 animate-fadeIn w-full font-sans">
      <DashboardPageHeader
        title="Attendance Device Integration"
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

      {/* TOP NAVIGATION TABS */}
      <div className="p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-1 font-sans overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('ACCESS_BINDING')}
          className={`py-2 px-4 rounded-lg text-xs transition-all duration-200 cursor-pointer flex items-center gap-2 whitespace-nowrap border-0 ${
            activeTab === 'ACCESS_BINDING'
              ? 'bg-[#07518a] text-white font-bold shadow-xs'
              : 'text-slate-600 dark:text-slate-400 font-bold hover:text-[#07518a] dark:hover:text-[#38bdf8] hover:bg-white/60 dark:hover:bg-slate-700/60'
          }`}
        >
          <span>🛡️ Access Binding</span>
          {accessBindings.length > 0 && (
            <span className={`px-2 py-0.5 text-xs rounded-full font-bold ${
              activeTab === 'ACCESS_BINDING' ? 'bg-white/20 text-white' : 'bg-[#07518a]/15 text-[#07518a] dark:bg-[#07518a]/30 dark:text-[#38bdf8]'
            }`}>
              {accessBindings.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('MOBILE_BINDING')}
          className={`py-2 px-4 rounded-lg text-xs transition-all duration-200 cursor-pointer flex items-center gap-2 whitespace-nowrap border-0 ${
            activeTab === 'MOBILE_BINDING'
              ? 'bg-[#07518a] text-white font-bold shadow-xs'
              : 'text-slate-600 dark:text-slate-400 font-bold hover:text-[#07518a] dark:hover:text-[#38bdf8] hover:bg-white/60 dark:hover:bg-slate-700/60'
          }`}
        >
          <span>📱 Employee Mobile Bindings</span>
        </button>
        <button
          onClick={() => setActiveTab('API_KEYS')}
          className={`py-2 px-4 rounded-lg text-xs transition-all duration-200 cursor-pointer flex items-center gap-2 whitespace-nowrap border-0 ${
            activeTab === 'API_KEYS'
              ? 'bg-[#07518a] text-white font-bold shadow-xs'
              : 'text-slate-600 dark:text-slate-400 font-bold hover:text-[#07518a] dark:hover:text-[#38bdf8] hover:bg-white/60 dark:hover:bg-slate-700/60'
          }`}
        >
          <span>🔑 Biometric API Keys & Webhook Sync</span>
          {apiKeys.length > 0 && (
            <span className={`px-2 py-0.5 text-xs rounded-full font-bold ${
              activeTab === 'API_KEYS' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
            }`}>
              {apiKeys.length} Active Keys
            </span>
          )}
        </button>
      </div>

      {activeTab === 'ACCESS_BINDING' ? (
        <div className="space-y-4">
          {/* Access Binding Filter Console */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:max-w-md">
              <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                placeholder="Search employee by name, ID code, or email..."
                value={accessSearchQuery}
                onChange={(e) => {
                  setAccessSearchQuery(e.target.value);
                  setAccessCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 transition-all placeholder-slate-400"
              />
            </div>
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2 shrink-0">
              <span>Total Records: <strong className="text-slate-800 dark:text-slate-200">{accessBindings.length}</strong></span>
              <button
                onClick={fetchAccessBindings}
                title="Refresh Access Bindings"
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                🔄
              </button>
            </div>
          </div>

          {/* Access Binding Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-xs">
            {loadingAccess ? (
              <div className="p-16 text-center space-y-3">
                <div className="w-8 h-8 border-4 border-[#07518a] border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Loading Access Settings...</p>
              </div>
            ) : (
              (() => {
                const filtered = accessBindings.filter(b => {
                  const query = accessSearchQuery.toLowerCase().trim();
                  if (!query) return true;
                  const fullName = `${b.first_name || ''} ${b.last_name || ''}`.toLowerCase();
                  return (
                    fullName.includes(query) ||
                    (b.emp_id_code || '').toLowerCase().includes(query) ||
                    (b.email || '').toLowerCase().includes(query) ||
                    (b.department_name || '').toLowerCase().includes(query) ||
                    (b.designation_name || '').toLowerCase().includes(query)
                  );
                });

                const totalPages = Math.ceil(filtered.length / accessPageSize) || 1;
                const startIndex = (accessCurrentPage - 1) * accessPageSize;
                const paginatedItems = filtered.slice(startIndex, startIndex + accessPageSize);

                return (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50/80 dark:bg-slate-950/60 border-b border-slate-200/80 dark:border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            <th className="px-4 py-3">Employee</th>
                            <th className="px-4 py-3">Department</th>
                            <th className="px-4 py-3">Login Mode</th>
                            <th className="px-4 py-3 text-center">Web Punch</th>
                            <th className="px-4 py-3 text-center">Mobile Punch</th>
                            <th className="px-4 py-3 text-center">Punch Approval</th>
                            <th className="px-4 py-3 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                          {paginatedItems.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-12 text-center text-slate-400 font-bold">
                                No employees found matching your search.
                              </td>
                            </tr>
                          ) : (
                            paginatedItems.map((b) => {
                              const isBusy = updatingAccessEmpId === b.employee_id;
                              return (
                                <tr key={b.employee_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                                  {/* Employee */}
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-2xs">
                                        {(b.first_name || 'E')[0].toUpperCase()}
                                      </div>
                                      <div>
                                        <p className="font-extrabold text-slate-900 dark:text-white leading-tight">
                                          {b.first_name} {b.last_name || ''}
                                        </p>
                                        <p className="text-[10px] font-mono text-slate-400 font-semibold">
                                          {b.emp_id_code || 'No Code'} • {b.email}
                                        </p>
                                      </div>
                                    </div>
                                  </td>

                                  {/* Department */}
                                  <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                                    <p className="font-bold text-slate-800 dark:text-slate-200">{b.department_name || 'General'}</p>
                                    <p className="text-[10px] text-slate-400">{b.designation_name || 'Staff'}</p>
                                  </td>

                                  {/* Login Mode Dropdown */}
                                  <td className="px-4 py-3">
                                    <select
                                      value={b.login_mode || 'BOTH'}
                                      disabled={!canEdit || isBusy}
                                      onChange={(e) => handleUpdateAccess(b.employee_id, { login_mode: e.target.value as any })}
                                      className="px-2.5 py-1 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
                                    >
                                      <option value="BOTH">🌐 Both (Web & Mobile)</option>
                                      <option value="WEB_ONLY">💻 Web Only</option>
                                      <option value="MOBILE_ONLY">📱 Mobile Only</option>
                                      <option value="NONE">🚫 None (Biometric Only)</option>
                                    </select>
                                  </td>

                                  {/* Web Punch Toggle */}
                                  <td className="px-4 py-3 text-center">
                                    <button
                                      type="button"
                                      disabled={!canEdit || isBusy}
                                      onClick={() => handleUpdateAccess(b.employee_id, { allow_web_punch: !b.allow_web_punch })}
                                      className={`inline-flex items-center w-10 h-5.5 rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${
                                        b.allow_web_punch ? 'bg-[#07518a]' : 'bg-slate-300 dark:bg-slate-700'
                                      } ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
                                      title={b.allow_web_punch ? 'Web punch allowed' : 'Web punch disabled'}
                                    >
                                      <span className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-transform duration-200 ${
                                        b.allow_web_punch ? 'translate-x-4.5' : 'translate-x-0'
                                      }`} />
                                    </button>
                                  </td>

                                  {/* Mobile Punch Toggle */}
                                  <td className="px-4 py-3 text-center">
                                    <button
                                      type="button"
                                      disabled={!canEdit || isBusy}
                                      onClick={() => handleUpdateAccess(b.employee_id, { allow_mobile_punch: !b.allow_mobile_punch })}
                                      className={`inline-flex items-center w-10 h-5.5 rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${
                                        b.allow_mobile_punch ? 'bg-[#07518a]' : 'bg-slate-300 dark:bg-slate-700'
                                      } ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
                                      title={b.allow_mobile_punch ? 'Mobile punch allowed' : 'Mobile punch disabled'}
                                    >
                                      <span className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-transform duration-200 ${
                                        b.allow_mobile_punch ? 'translate-x-4.5' : 'translate-x-0'
                                      }`} />
                                    </button>
                                  </td>

                                  {/* Punch Approval Toggle */}
                                  <td className="px-4 py-3 text-center">
                                    <button
                                      type="button"
                                      disabled={!canEdit || isBusy}
                                      onClick={() => handleUpdateAccess(b.employee_id, { require_punch_approval: !b.require_punch_approval })}
                                      className={`inline-flex items-center w-10 h-5.5 rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${
                                        b.require_punch_approval ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
                                      } ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
                                      title={b.require_punch_approval ? 'Approval required for punches' : 'Auto-approved punches'}
                                    >
                                      <span className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-transform duration-200 ${
                                        b.require_punch_approval ? 'translate-x-4.5' : 'translate-x-0'
                                      }`} />
                                    </button>
                                  </td>

                                  {/* Status Active Toggle */}
                                  <td className="px-4 py-3 text-center">
                                    <button
                                      type="button"
                                      disabled={!canEdit || isBusy}
                                      onClick={() => handleUpdateAccess(b.employee_id, { is_active: !b.is_active })}
                                      className={`inline-flex items-center w-10 h-5.5 rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${
                                        b.is_active ? 'bg-emerald-500' : 'bg-rose-400'
                                      } ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
                                      title={b.is_active ? 'Security active' : 'Security disabled'}
                                    >
                                      <span className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-transform duration-200 ${
                                        b.is_active ? 'translate-x-4.5' : 'translate-x-0'
                                      }`} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {filtered.length > 0 && (
                      <div className="p-3 border-t border-slate-100 dark:border-slate-800">
                        <ModernPagination
                          currentPage={accessCurrentPage}
                          totalPages={totalPages}
                          pageSize={accessPageSize}
                          totalItems={filtered.length}
                          startIndex={startIndex}
                          endIndex={Math.min(startIndex + accessPageSize, filtered.length)}
                          onPageChange={setAccessCurrentPage}
                          onPageSizeChange={(sz) => {
                            setAccessPageSize(sz);
                            setAccessCurrentPage(1);
                          }}
                          pageSizeOptions={[10, 25, 50, 100]}
                          itemLabel="employees"
                        />
                      </div>
                    )}
                  </>
                );
              })()
            )}
          </div>
        </div>
      ) : activeTab === 'MOBILE_BINDING' ? (
        <>
          {/* 📱 CURRENT MOBILE DEVICE INFO BANNER & FILTER CONSOLE */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
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

            {/* Filter & Control Row - Single Row */}
            <div className="flex flex-row items-center justify-between gap-3 w-full">
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
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0 overflow-x-auto">
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
          </div>

          {/* TABLE DATA */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-xs">
            {loading ? (
              <div className="p-12 text-center text-xs text-slate-500 font-semibold animate-pulse">
                Loading mobile device bindings...
              </div>
            ) : paginatedDevices.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500 font-semibold">
                No matching employee device bindings found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-50/75 dark:bg-slate-800/50 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-5 py-3.5">Employee</th>
                      <th className="px-5 py-3.5">Department</th>
                      <th className="px-5 py-3.5">Bound Device Model</th>
                      <th className="px-5 py-3.5">Device Identifier</th>
                      <th className="px-5 py-3.5 text-center">Status</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {paginatedDevices.map((dev) => {
                      const isBound = dev.binding_status === 'ACTIVE' || dev.binding_status === 'COMPLETED';
                      return (
                        <tr key={dev.employee_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="font-bold text-slate-900 dark:text-slate-100">
                              {dev.first_name} {dev.last_name}
                            </div>
                            <div className="text-[11px] font-mono text-slate-400">{dev.emp_id_code || dev.email}</div>
                          </td>
                          <td className="px-5 py-3.5 font-semibold text-slate-700 dark:text-slate-300">
                            {dev.department_name || '-'}
                          </td>
                          <td className="px-5 py-3.5 font-bold text-indigo-600 dark:text-indigo-400">
                            {dev.device_model || 'Not Registered'}
                          </td>
                          <td className="px-5 py-3.5 font-mono text-[11px] text-slate-500">
                            {dev.device_identifier || '-'}
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 ${
                                isBound
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
                                  : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-900'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${isBound ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                              {isBound ? 'COMPLETED' : 'PENDING'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            {isBound && canEdit && (
                              <button
                                onClick={() => setConfirmResetItem({ id: dev.employee_id, name: `${dev.first_name} ${dev.last_name}` })}
                                disabled={resettingId === dev.employee_id}
                                className="px-3 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg border border-rose-200 dark:border-rose-900 transition-all cursor-pointer disabled:opacity-50"
                              >
                                {resettingId === dev.employee_id ? 'Resetting...' : 'Reset Device'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* 🚀 MODERN ELEGANT PAGINATION */}
            {!loading && filteredDevices.length > 0 && (
              <div className="p-4 border-t border-slate-100 dark:border-slate-800">
                <ModernPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  totalItems={totalItems}
                  startIndex={startIndex}
                  endIndex={Math.min(startIndex + pageSize, totalItems)}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={setPageSize}
                  pageSizeOptions={[10, 25, 50, 100]}
                  itemLabel="device bindings"
                />
              </div>
            )}
          </div>
        </>
      ) : (
        /* 🔑 BIOMETRIC API KEYS & WEBHOOK INTEGRATION TAB */
        <div className="space-y-6">
          {/* WEBHOOK API ENDPOINT INFOCARD */}
          <div className="p-5 rounded-2xl bg-slate-900 text-white border border-slate-800 shadow-md space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-400 text-xs font-black tracking-wider uppercase border border-emerald-500/30">
                  Public Device Punch API Endpoint
                </span>
                <h3 className="text-lg font-black text-white mt-1.5">Biometric Machine Webhook URL</h3>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                  Configure your biometric hardware (ZKTeco, Matrix, Essl, etc.) or external cron script to send HTTP POST requests to this URL using your Secret API Key.
                </p>
              </div>
              <button
                onClick={() => copyToClipboard(publicWebhookUrl, 'webhook-url')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer"
              >
                {copiedKeyId === 'webhook-url' ? '✓ Copied Endpoint' : '📋 Copy Webhook URL'}
              </button>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-emerald-400 font-bold break-all flex items-center justify-between">
              <span>POST {publicWebhookUrl}</span>
            </div>

            {/* PAYLOAD FORMAT EXAMPLE */}
            <div className="p-4 bg-slate-950/70 rounded-xl border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
                <span>Sample Request Payload (JSON)</span>
                <span>Headers: <code className="text-amber-400">x-api-key: YOUR_SECRET_API_KEY</code></span>
              </div>
              <pre className="text-xs font-mono text-indigo-300 overflow-x-auto p-2 bg-slate-900 rounded-lg">
{`{
  "emp_code": "EMP001",
  "punch_time": "2026-09-10 09:30:00",
  "device_id": "MAIN_GATE_BIO_01",
  "punch_type": "IN"
}`}
              </pre>
            </div>
          </div>

          {/* GENERATE NEW API KEY FORM */}
          {canEdit && (
            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>➕ Generate New Device API Key</span>
              </h3>

              <form onSubmit={handleGenerateKey} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Device / Location Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Main Entrance ZK Machine"
                    value={newDeviceName}
                    onChange={(e) => setNewDeviceName(e.target.value)}
                    required
                    className="w-full px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    IP Whitelist (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 183.82.10.45 (Leave empty for any IP)"
                    value={newAllowedIp}
                    onChange={(e) => setNewAllowedIp(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Device Timezone
                  </label>
                  <select
                    value={newTimezone}
                    onChange={(e) => setNewTimezone(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (IST +05:30)</option>
                    <option value="America/New_York">America/New_York (EDT -04:00)</option>
                    <option value="Europe/London">Europe/London (BST +01:00)</option>
                    <option value="Asia/Dubai">Asia/Dubai (GST +04:00)</option>
                    <option value="UTC">UTC (+00:00)</option>
                  </select>
                </div>

                <div className="md:col-span-3 flex justify-end">
                  <button
                    type="submit"
                    disabled={generatingKey}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {generatingKey ? 'Generating...' : '⚡ Generate Secret API Key'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ACTIVE API KEYS TABLE */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Active Tenant API Keys ({apiKeys.length})
              </h3>
            </div>

            {loadingKeys ? (
              <div className="p-12 text-center text-xs text-slate-500 font-semibold animate-pulse">
                Loading tenant API keys...
              </div>
            ) : apiKeys.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500 font-semibold">
                No active device API keys generated yet. Click "Generate New Device API Key" above to create one.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-50/75 dark:bg-slate-800/50 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-5 py-3.5">Device Name</th>
                      <th className="px-5 py-3.5">Secret API Key</th>
                      <th className="px-5 py-3.5">IP Whitelist</th>
                      <th className="px-5 py-3.5">Timezone</th>
                      <th className="px-5 py-3.5">Created At</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {apiKeys.map((k) => (
                      <tr key={k.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-slate-100">
                          {k.device_name}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-900">
                              {k.api_key}
                            </span>
                            <button
                              onClick={() => copyToClipboard(k.api_key, k.id)}
                              className="text-[11px] font-bold text-slate-500 hover:text-indigo-600 cursor-pointer"
                            >
                              {copiedKeyId === k.id ? '✓ Copied' : 'Copy'}
                            </button>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-[11px]">
                          {k.allowed_ip ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-bold">
                              {k.allowed_ip}
                            </span>
                          ) : (
                            <span className="text-slate-400">Any IP (Unrestricted)</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-slate-700 dark:text-slate-300">
                          {k.timezone || 'Asia/Kolkata'}
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 text-[11px]">
                          {new Date(k.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {canEdit && (
                            <button
                              onClick={() => handleRevokeKey(k.id)}
                              className="px-3 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg border border-rose-200 dark:border-rose-900 transition-all cursor-pointer"
                            >
                              Revoke Key
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONFIRMATION RESET MODAL */}
      {confirmResetItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">Confirm Reset Device</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Are you sure you want to reset the bound device for <strong className="text-slate-900 dark:text-slate-100">{confirmResetItem.name}</strong>?
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmResetItem(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const item = confirmResetItem;
                  setConfirmResetItem(null);
                  executeResetDevice(item.id, item.name);
                }}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl cursor-pointer shadow-xs"
              >
                Reset Binding
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
