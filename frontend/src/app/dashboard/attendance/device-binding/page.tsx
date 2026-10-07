'use client';

import React, { useEffect, useState } from 'react';
import DashboardPageHeader from '../../components/DashboardPageHeader';
import { getHeaders, API_BASE } from '../../utils/api';
import { useDashboard } from '../../components/DashboardContext';
import { usePermissions } from '../../hooks/usePermissions';
import { getDeviceModel } from '../../utils/deviceUtils';
import ModernPagination from '../../components/ModernPagination';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import PageLoader from '@/components/ui/PageLoader';

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

const getAvatarGradient = (name: string) => {
  const gradients = [
    'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-blue-500/20',
    'bg-gradient-to-tr from-emerald-500 to-teal-600 text-white shadow-emerald-500/20',
    'bg-gradient-to-tr from-purple-600 to-pink-600 text-white shadow-purple-500/20',
    'bg-gradient-to-tr from-amber-500 to-orange-600 text-white shadow-amber-500/20',
    'bg-gradient-to-tr from-rose-500 to-red-600 text-white shadow-rose-500/20',
    'bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-cyan-500/20',
    'bg-gradient-to-tr from-violet-600 to-purple-600 text-white shadow-violet-500/20',
    'bg-gradient-to-tr from-teal-500 to-emerald-600 text-white shadow-teal-500/20',
  ];
  let hash = 0;
  const str = name || 'E';
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
};

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
    Promise.all([fetchDevices(), fetchApiKeys(), fetchAccessBindings()]);
  }, [activeCompanyId]);

  const fetchCompanies = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/companies`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setCompanies(data.companies || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCompanyChange = (val: string) => {
    setCompanyId(val);
    localStorage.setItem('companyId', val);
  };

  const fetchAccessBindings = async () => {
    setLoadingAccess(true);
    try {
      const cid = activeCompanyId || '';
      const res = await fetch(`${API_BASE}/api/v1/attendance/access-bindings?company_id=${cid}`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setAccessBindings(data.bindings || []);
      } else {
        showToast('Failed to load employee access binding rules', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Error connecting to access binding API', 'error');
    } finally {
      setLoadingAccess(false);
    }
  };

  const handleUpdateAccess = async (employeeId: string, updates: Partial<AccessBindingItem>) => {
    if (!canEdit) {
      showToast('You do not have permission to modify employee security settings', 'error');
      return;
    }
    setUpdatingAccessEmpId(employeeId);
    try {
      const res = await fetch(`${API_BASE}/api/v1/attendance/access-bindings/${employeeId}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        setAccessBindings((prev) =>
          prev.map((item) => (item.employee_id === employeeId ? { ...item, ...updates } : item))
        );
        showToast('Employee punch security access updated successfully', 'success');
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.error || 'Failed to update access setting', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Error saving access rule update', 'error');
    } finally {
      setUpdatingAccessEmpId(null);
    }
  };

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const cid = activeCompanyId || '';
      const res = await fetch(`${API_BASE}/api/v1/attendance/device-bindings?company_id=${cid}`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setDevices(data.devices || []);
      } else {
        showToast('Failed to load device bindings', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Error fetching device bindings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchApiKeys = async () => {
    setLoadingKeys(true);
    try {
      const cid = activeCompanyId || '';
      const res = await fetch(`${API_BASE}/api/v1/attendance/device-api-keys?company_id=${cid}`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setApiKeys(data.keys || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingKeys(false);
    }
  };

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeviceName.trim()) {
      showToast('Please provide a name for this biometric device/machine', 'error');
      return;
    }
    setGeneratingKey(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/attendance/device-api-keys`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          companyId: activeCompanyId,
          company_id: activeCompanyId,
          device_name: newDeviceName.trim(),
          allowed_ip: newAllowedIp.trim() || null,
          timezone: newTimezone || 'Asia/Kolkata'
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Biometric Device Secret API Key generated!', 'success');
        setNewDeviceName('');
        setNewAllowedIp('');
        fetchApiKeys();
      } else {
        showToast(data.error || 'Failed to generate device key', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Error generating key', 'error');
    } finally {
      setGeneratingKey(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this device API Key? Hardware connected with this key will no longer be able to submit biometric punches.')) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/v1/attendance/device-api-keys/${keyId}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (res.ok) {
        showToast('API Key revoked successfully', 'info');
        fetchApiKeys();
      } else {
        showToast('Failed to revoke API key', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Error revoking API key', 'error');
    }
  };

  const executeResetDevice = async (employeeId: string, empName: string) => {
    setResettingId(employeeId);
    try {
      const res = await fetch(`${API_BASE}/api/v1/attendance/device-bindings/reset`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ employeeId })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Device binding reset for ${empName}!`, 'success');
        fetchDevices();
      } else {
        showToast(data.error || 'Failed to reset device', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Error connecting to server', 'error');
    } finally {
      setResettingId(null);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKeyId(id);
    showToast('Copied to clipboard!', 'info');
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  // Filtered List for Mobile Binding
  const filteredDevices = devices.filter((d) => {
    const matchesQuery =
      searchQuery === '' ||
      `${d.first_name} ${d.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.emp_id_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.department_name?.toLowerCase().includes(searchQuery.toLowerCase());

    const isBound = d.binding_status === 'COMPLETED' || d.binding_status === 'ACTIVE';
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && isBound) ||
      (statusFilter === 'PENDING' && !isBound);

    return matchesQuery && matchesStatus;
  });

  const totalItems = filteredDevices.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
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
      <div className="p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center gap-1 font-sans overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('ACCESS_BINDING')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-2 whitespace-nowrap border-0 ${
            activeTab === 'ACCESS_BINDING'
              ? 'bg-[#07518a] text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 font-semibold hover:text-[#07518a] dark:hover:text-[#38bdf8] hover:bg-white/60 dark:hover:bg-slate-700/60'
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
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-2 whitespace-nowrap border-0 ${
            activeTab === 'MOBILE_BINDING'
              ? 'bg-[#07518a] text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 font-semibold hover:text-[#07518a] dark:hover:text-[#38bdf8] hover:bg-white/60 dark:hover:bg-slate-700/60'
          }`}
        >
          <span>📱 Employee Mobile Bindings</span>
        </button>
        <button
          onClick={() => setActiveTab('API_KEYS')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-2 whitespace-nowrap border-0 ${
            activeTab === 'API_KEYS'
              ? 'bg-[#07518a] text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 font-semibold hover:text-[#07518a] dark:hover:text-[#38bdf8] hover:bg-white/60 dark:hover:bg-slate-700/60'
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
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-[#07518a] transition-all placeholder-slate-400"
              />
            </div>
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2 shrink-0">
              <span>Total Records: <strong className="text-slate-800 dark:text-slate-200">{accessBindings.length}</strong></span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={fetchAccessBindings}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-xs"
                  >
                    🔄
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Refresh Access Bindings
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Access Binding Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-xs">
            {loadingAccess ? (
              <PageLoader message="Loading Access Settings..." />
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
                    {/* Inner Scroll Container with Sticky Header */}
                    <div className="overflow-x-auto max-h-[580px] overflow-y-auto no-scrollbar">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="sticky top-0 z-10 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-xs border-b border-slate-200/80 dark:border-slate-800 shadow-2xs">
                          <tr className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
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
                              const fullName = `${b.first_name || ''} ${b.last_name || ''}`.trim() || 'Employee';
                              return (
                                <tr key={b.employee_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                                  {/* Employee */}
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2.5">
                                      <div className={`w-8 h-8 rounded-full ${getAvatarGradient(fullName)} font-black text-xs flex items-center justify-center shrink-0 shadow-2xs`}>
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
                                      className="px-2.5 py-1 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-[#07518a] cursor-pointer shadow-2xs"
                                    >
                                      <option value="BOTH">🌐 Both (Web & Mobile)</option>
                                      <option value="WEB_ONLY">💻 Web Only</option>
                                      <option value="MOBILE_ONLY">📱 Mobile Only</option>
                                      <option value="NONE">🚫 None (Biometric Only)</option>
                                    </select>
                                  </td>

                                  {/* Web Punch Toggle */}
                                  <td className="px-4 py-3 text-center">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          type="button"
                                          disabled={!canEdit || isBusy}
                                          onClick={() => handleUpdateAccess(b.employee_id, { allow_web_punch: !b.allow_web_punch })}
                                          className={`inline-flex items-center w-10 h-5.5 rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${
                                            b.allow_web_punch ? 'bg-[#07518a]' : 'bg-slate-300 dark:bg-slate-700'
                                          } ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
                                        >
                                          <span className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-transform duration-200 ${
                                            b.allow_web_punch ? 'translate-x-4.5' : 'translate-x-0'
                                          }`} />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top">
                                        {b.allow_web_punch ? 'Web punch allowed' : 'Web punch disabled'}
                                      </TooltipContent>
                                    </Tooltip>
                                  </td>

                                  {/* Mobile Punch Toggle */}
                                  <td className="px-4 py-3 text-center">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          type="button"
                                          disabled={!canEdit || isBusy}
                                          onClick={() => handleUpdateAccess(b.employee_id, { allow_mobile_punch: !b.allow_mobile_punch })}
                                          className={`inline-flex items-center w-10 h-5.5 rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${
                                            b.allow_mobile_punch ? 'bg-[#07518a]' : 'bg-slate-300 dark:bg-slate-700'
                                          } ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
                                        >
                                          <span className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-transform duration-200 ${
                                            b.allow_mobile_punch ? 'translate-x-4.5' : 'translate-x-0'
                                          }`} />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top">
                                        {b.allow_mobile_punch ? 'Mobile punch allowed' : 'Mobile punch disabled'}
                                      </TooltipContent>
                                    </Tooltip>
                                  </td>

                                  {/* Punch Approval Toggle */}
                                  <td className="px-4 py-3 text-center">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          type="button"
                                          disabled={!canEdit || isBusy}
                                          onClick={() => handleUpdateAccess(b.employee_id, { require_punch_approval: !b.require_punch_approval })}
                                          className={`inline-flex items-center w-10 h-5.5 rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${
                                            b.require_punch_approval ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
                                          } ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
                                        >
                                          <span className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-transform duration-200 ${
                                            b.require_punch_approval ? 'translate-x-4.5' : 'translate-x-0'
                                          }`} />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top">
                                        {b.require_punch_approval ? 'Approval required for punches' : 'Auto-approved punches'}
                                      </TooltipContent>
                                    </Tooltip>
                                  </td>

                                  {/* Status Active Toggle */}
                                  <td className="px-4 py-3 text-center">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          type="button"
                                          disabled={!canEdit || isBusy}
                                          onClick={() => handleUpdateAccess(b.employee_id, { is_active: !b.is_active })}
                                          className={`inline-flex items-center w-10 h-5.5 rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${
                                            b.is_active ? 'bg-emerald-500' : 'bg-rose-400'
                                          } ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
                                        >
                                          <span className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-transform duration-200 ${
                                            b.is_active ? 'translate-x-4.5' : 'translate-x-0'
                                          }`} />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top">
                                        {b.is_active ? 'Security active' : 'Security disabled'}
                                      </TooltipContent>
                                    </Tooltip>
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
                <div className="w-10 h-10 rounded-xl bg-[#07518a]/10 dark:bg-[#07518a]/20 text-[#07518a] dark:text-[#38bdf8] border border-[#07518a]/20 flex items-center justify-center text-xl shrink-0">
                  📱
                </div>
                <div>
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-[#07518a] dark:text-[#38bdf8]">Your Current Device Details</h4>
                  <p className="text-xs font-bold font-mono text-slate-800 dark:text-slate-200 mt-0.5 break-all">
                    Device ID: <span className="text-amber-600 dark:text-amber-400 font-black">{typeof window !== 'undefined' ? (localStorage.getItem('hrms_device_uuid') || 'Not Generated Yet') : ''}</span>
                  </p>
                </div>
              </div>
              <div className="px-3.5 py-1.5 rounded-xl bg-[#07518a]/10 dark:bg-[#07518a]/20 text-xs font-bold text-[#07518a] dark:text-[#38bdf8] border border-[#07518a]/20 whitespace-nowrap">
                Hardware Model: <strong>{getDeviceModel()}</strong>
              </div>
            </div>

            {/* Filter Row */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:max-w-md">
                <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search bound employee, email, code or department..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-[#07518a] transition-all placeholder-slate-400"
                />
              </div>

              {/* Status Tabs */}
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full sm:w-auto">
                <button
                  onClick={() => {
                    setStatusFilter('ALL');
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                    statusFilter === 'ALL'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-extrabold shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 font-semibold'
                  }`}
                >
                  All ({devices.length})
                </button>
                <button
                  onClick={() => {
                    setStatusFilter('ACTIVE');
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                    statusFilter === 'ACTIVE'
                      ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 font-extrabold shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 font-semibold'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Active ({completedCount})
                </button>
                <button
                  onClick={() => {
                    setStatusFilter('PENDING');
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                    statusFilter === 'PENDING'
                      ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 font-extrabold shadow-2xs'
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
              <PageLoader message="Loading Mobile Device Bindings..." />
            ) : paginatedDevices.length === 0 ? (
              <div className="p-16 text-center text-xs text-slate-400 font-bold uppercase tracking-wider">
                No matching employee device bindings found.
              </div>
            ) : (
              /* Inner Scroll Container with Sticky Header */
              <div className="overflow-x-auto max-h-[580px] overflow-y-auto no-scrollbar">
                <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                  <thead className="sticky top-0 z-10 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 shadow-2xs">
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
                      const fullName = `${dev.first_name || ''} ${dev.last_name || ''}`.trim() || 'Employee';
                      return (
                        <tr key={dev.employee_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-8 h-8 rounded-full ${getAvatarGradient(fullName)} font-black text-xs flex items-center justify-center shrink-0 shadow-2xs`}>
                                {(dev.first_name || 'E')[0].toUpperCase()}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 dark:text-slate-100">
                                  {dev.first_name} {dev.last_name}
                                </div>
                                <div className="text-[11px] font-mono text-slate-400">{dev.emp_id_code || dev.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 font-semibold text-slate-700 dark:text-slate-300">
                            {dev.department_name || '-'}
                          </td>
                          <td className="px-5 py-3.5 font-bold text-[#07518a] dark:text-[#38bdf8]">
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
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => setConfirmResetItem({ id: dev.employee_id, name: `${dev.first_name} ${dev.last_name}` })}
                                    disabled={resettingId === dev.employee_id}
                                    className="px-3 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg border border-rose-200 dark:border-rose-900 transition-all cursor-pointer disabled:opacity-50"
                                  >
                                    {resettingId === dev.employee_id ? 'Resetting...' : 'Reset Device'}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="left">
                                  Clear hardware binding and allow re-registration
                                </TooltipContent>
                              </Tooltip>
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => copyToClipboard(publicWebhookUrl, 'webhook-url')}
                    className="px-4 py-2 bg-[#07518a] hover:bg-[#064270] text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer shadow-md shadow-[#07518a]/25"
                  >
                    {copiedKeyId === 'webhook-url' ? '✓ Copied Endpoint' : '📋 Copy Webhook URL'}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Copy API endpoint URL for machine integration
                </TooltipContent>
              </Tooltip>
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
              <pre className="text-xs font-mono text-sky-300 overflow-x-auto p-2 bg-slate-900 rounded-lg">
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
                    className="w-full px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 outline-none focus:border-[#07518a]"
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
                    className="w-full px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 outline-none focus:border-[#07518a]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Device Timezone
                  </label>
                  <select
                    value={newTimezone}
                    onChange={(e) => setNewTimezone(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 outline-none focus:border-[#07518a]"
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
                    className="px-5 py-2.5 bg-[#07518a] hover:bg-[#064270] text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md shadow-[#07518a]/20 disabled:opacity-50"
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
              <PageLoader message="Loading Tenant API Keys..." />
            ) : apiKeys.length === 0 ? (
              <div className="p-16 text-center text-xs text-slate-400 font-bold uppercase tracking-wider">
                No active device API keys generated yet. Click "Generate New Device API Key" above to create one.
              </div>
            ) : (
              /* Inner Scroll Container with Sticky Header */
              <div className="overflow-x-auto max-h-[480px] overflow-y-auto no-scrollbar">
                <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                  <thead className="sticky top-0 z-10 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 shadow-2xs">
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
                            <span className="font-mono text-xs font-bold text-[#07518a] dark:text-[#38bdf8] bg-[#07518a]/10 dark:bg-[#07518a]/20 px-2.5 py-1 rounded-lg border border-[#07518a]/20">
                              {k.api_key}
                            </span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => copyToClipboard(k.api_key, k.id)}
                                  className="text-[11px] font-bold text-slate-500 hover:text-[#07518a] cursor-pointer"
                                >
                                  {copiedKeyId === k.id ? '✓ Copied' : 'Copy'}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                Copy secret key
                              </TooltipContent>
                            </Tooltip>
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
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => handleRevokeKey(k.id)}
                                  className="px-3 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg border border-rose-200 dark:border-rose-900 transition-all cursor-pointer"
                                >
                                  Revoke Key
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="left">
                                Permanently invalidate this machine's key
                              </TooltipContent>
                            </Tooltip>
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
