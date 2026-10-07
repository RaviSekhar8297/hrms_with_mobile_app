'use client';

import React, { useEffect, useState, useRef } from 'react';
import DashboardPageHeader from '../../components/DashboardPageHeader';
import { getHeaders, API_BASE } from '../../utils/api';
import { useDashboard } from '../../components/DashboardContext';
import { usePermissions } from '../../hooks/usePermissions';
import SlideDrawer from '../../components/SlideDrawer';
import { Eye, EyeOff, Radio, Save } from 'lucide-react';
import PageLoader from '@/components/ui/PageLoader';

export default function AttendanceRulesPage() {
  const { showToast, companyId: globalCompanyId, setCompanyId: setGlobalCompanyId } = useDashboard();
  const { hasPermission, isSuperAdmin } = usePermissions();

  const canView = isSuperAdmin || hasPermission('attendance_policies_view') || hasPermission('attendance_rules_view') || hasPermission('view_attendance_policies');
  const canCreate = isSuperAdmin || hasPermission('attendance_policies_create') || hasPermission('attendance_rules_create') || hasPermission('create_attendance_policies');
  const canEdit = isSuperAdmin || hasPermission('attendance_policies_edit') || hasPermission('attendance_rules_edit') || hasPermission('edit_attendance_policies');
  const canDelete = isSuperAdmin || hasPermission('attendance_policies_delete') || hasPermission('attendance_rules_delete') || hasPermission('delete_attendance_policies');

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Top save button ref and scroll visibility state
  const topSaveRef = useRef<HTMLButtonElement | null>(null);
  const [showFloatingSave, setShowFloatingSave] = useState(false);

  // 🗑️ Delete Policy Confirmation State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const activeCompanyId = globalCompanyId || companyId || (typeof window !== 'undefined' ? localStorage.getItem('companyId') : null);

  const handleDeletePolicy = async () => {
    const targetCid = activeCompanyId || companyId;
    if (!targetCid) {
      showToast('Please select a company context', 'error');
      return;
    }
    setIsDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/attendance/policies?company_id=${targetCid}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('🗑️ Attendance policy deleted successfully!', 'success');
        setDeleteModalOpen(false);
        setPolicyForm(emptyPolicy);
        setInitialPolicyForm(emptyPolicy);
        setHasPolicyConfigured(false);
        await fetchRules();
      } else {
        showToast(data.error || 'Failed to delete attendance policy', 'error');
      }
    } catch (err: any) {
      console.error(err);
      showToast('Connection error while deleting policy', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // 📡 Biometric Sync Drawer State
  const [syncDrawerOpen, setSyncDrawerOpen] = useState(false);
  const [biometricServerUrl, setBiometricServerUrl] = useState('http://183.82.117.36:8086/iclock/webapiservice.asmx');
  const [biometricSerialNumber, setBiometricSerialNumber] = useState('QJT3243900297');
  const [biometricUsername, setBiometricUsername] = useState('Admin');
  const [biometricPassword, setBiometricPassword] = useState('Btpl@123');
  const [showPassword, setShowPassword] = useState(false);
  const [fromDate, setFromDate] = useState('2026-07-26');
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    insertedCount: number;
    totalFetched: number;
    summaryProcessed: number;
    message: string;
  } | null>(null);

  const handleBiometricSync = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSyncing(true);
    setSyncResult(null);

    try {
      const res = await fetch(`${API_BASE}/api/attendance/sync-biometric`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          serverUrl: biometricServerUrl,
          serialNumber: biometricSerialNumber,
          username: biometricUsername,
          password: biometricPassword,
          fromDate,
          toDate
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSyncResult(data);
        showToast(`🎉 Biometric sync finished! ${data.insertedCount} raw punches inserted, ${data.summaryProcessed} attendance summaries updated.`, 'success');
      } else {
        showToast(data.error || 'Failed to sync biometric attendance', 'error');
      }
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || 'Network error during biometric sync', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const emptyPolicy = {
    grace_period_mins: '',
    max_late_entries_allowed: '',
    late_entry_penalty: 'HALF_DAY',
    half_day_min_hours: '',
    full_day_min_hours: '',
    overtime_min_mins: '',
    cycle_start_day: '',
    cycle_end_day: '',
    max_permission_count_per_month: '',
    max_single_permission_minutes: '',
    max_permission_minutes_per_month: '',
    permission_affects_late: false,
    permission_affects_early_exit: false,
    allow_permission_carry_forward: false,
    allow_mobile_punch: true,
    allow_web_punch: true,
    require_selfie: false,
    require_gps: false,
    is_period_locked: false,
    lock_month: String(new Date().getMonth() + 1),
    lock_year: String(new Date().getFullYear()),
    comp_off_display_name: '',
    comp_off_half_day_hours: '',
    comp_off_full_day_hours: '',
    location_tracking_interval_mins: '15',
  };

  const [policyForm, setPolicyForm] = useState(emptyPolicy);
  const [initialPolicyForm, setInitialPolicyForm] = useState(emptyPolicy);
  const [hasPolicyConfigured, setHasPolicyConfigured] = useState<boolean>(true);

  const isModified = JSON.stringify(policyForm) !== JSON.stringify(initialPolicyForm);

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
    const handleScroll = () => {
      const scrollContainer = topSaveRef.current?.closest('main') || document.querySelector('main');
      const scrollTop = scrollContainer ? scrollContainer.scrollTop : window.scrollY;

      if (topSaveRef.current) {
        const rect = topSaveRef.current.getBoundingClientRect();
        // Top save button is near the top of the page.
        // If container scrolled > 80px or rect.bottom <= 130px, top save is out of direct view
        const isOutOfView = scrollTop > 80 || rect.bottom <= 130 || rect.top < 60;
        setShowFloatingSave(isOutOfView);
      } else {
        setShowFloatingSave(scrollTop > 80);
      }
    };

    // Use capture: true so container scroll events on <main> are caught
    document.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });

    // Initial check
    handleScroll();

    return () => {
      document.removeEventListener('scroll', handleScroll, { capture: true } as any);
      window.removeEventListener('scroll', handleScroll, { capture: true } as any);
    };
  }, []);

  useEffect(() => {
    fetchRules();
  }, [activeCompanyId]);

  const fetchCompanies = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/companies`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.companies || []);
        setCompanies(list);
        if (!globalCompanyId && !localStorage.getItem('companyId') && !companyId && list.length > 0) {
          if (setGlobalCompanyId) setGlobalCompanyId(list[0].id);
          setCompanyId(list[0].id);
        }
      }
    } catch (e) {
      console.error('Error fetching companies:', e);
    }
  };

  const handleCompanyChange = (newId: string) => {
    if (setGlobalCompanyId) setGlobalCompanyId(newId);
    setCompanyId(newId);
    localStorage.setItem('selectedCompanyId', newId);
    localStorage.setItem('companyId', newId);
  };

  const fetchRules = async () => {
    setIsLoading(true);
    try {
      const cid = activeCompanyId || localStorage.getItem('companyId') || localStorage.getItem('selectedCompanyId');
      if (!cid || cid === 'all') {
        setPolicyForm(emptyPolicy);
        setInitialPolicyForm(emptyPolicy);
        setHasPolicyConfigured(false);
        setIsLoading(false);
        return;
      }

      const url = `${API_BASE}/api/v1/attendance/policies?company_id=${cid}`;
      const res = await fetch(url, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        const p = data.policy;
        if (p && (p.id || p.company_id) && String(p.company_id).toLowerCase().trim() === String(cid).toLowerCase().trim()) {
          const loadedData = {
            grace_period_mins: String(p.grace_period_mins ?? 15),
            max_late_entries_allowed: String(p.max_late_entries_allowed ?? p.late_allowed_per_month ?? 3),
            late_entry_penalty: p.late_entry_penalty || 'HALF_DAY',
            half_day_min_hours: String(p.half_day_min_hours ?? 4),
            full_day_min_hours: String(p.full_day_min_hours ?? 8),
            overtime_min_mins: String(p.overtime_min_mins ?? 60),
            cycle_start_day: String(p.cycle_start_day ?? 26),
            cycle_end_day: String(p.cycle_end_day ?? 25),
            max_permission_count_per_month: String(p.max_permission_count_per_month ?? 2),
            max_single_permission_minutes: String(p.max_single_permission_minutes ?? 120),
            max_permission_minutes_per_month: String(p.max_permission_minutes_per_month ?? 240),
            permission_affects_late: p.permission_affects_late ?? true,
            permission_affects_early_exit: p.permission_affects_early_exit ?? true,
            allow_permission_carry_forward: p.allow_permission_carry_forward ?? false,
            allow_mobile_punch: p.allow_mobile_punch !== undefined ? p.allow_mobile_punch : true,
            allow_web_punch: p.allow_web_punch !== undefined ? p.allow_web_punch : true,
            require_selfie: p.require_selfie !== undefined ? p.require_selfie : false,
            require_gps: p.require_gps !== undefined ? p.require_gps : false,
            is_period_locked: p.is_period_locked ?? false,
            lock_month: String(p.lock_month || (new Date().getMonth() + 1)),
            lock_year: String(p.lock_year || new Date().getFullYear()),
            comp_off_display_name: p.comp_off_display_name || 'Compensatory Off',
            comp_off_half_day_hours: String(p.comp_off_half_day_hours ?? 4),
            comp_off_full_day_hours: String(p.comp_off_full_day_hours ?? 8),
            location_tracking_interval_mins: String(p.location_tracking_interval_mins ?? 15),
          };
          setPolicyForm(loadedData);
          setInitialPolicyForm(loadedData);
          setHasPolicyConfigured(true);
        } else {
          setPolicyForm(emptyPolicy);
          setInitialPolicyForm(emptyPolicy);
          setHasPolicyConfigured(false);
        }
      } else {
        setPolicyForm(emptyPolicy);
        setInitialPolicyForm(emptyPolicy);
        setHasPolicyConfigured(false);
      }
    } catch (e) {
      console.error('Failed to load rules:', e);
      setPolicyForm(emptyPolicy);
      setInitialPolicyForm(emptyPolicy);
      setHasPolicyConfigured(false);
    } finally {
      setIsLoading(false);
    }
  };


  const handleSaveRules = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isModified) return;
    const targetCid = activeCompanyId || companyId;
    if (!targetCid) {
      showToast('Please select a company context', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/attendance/policies`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          companyId: targetCid,
          company_id: targetCid,
          policy_name: 'Standard Attendance Policy',
          ...policyForm,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast('🎉 Attendance policy rules saved successfully!', 'success');
        setInitialPolicyForm(policyForm);
        setHasPolicyConfigured(true);
      } else {
        showToast(data.error || 'Failed to save attendance rules', 'error');
      }
    } catch (err: any) {
      console.error(err);
      showToast('Connection error while saving rules', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn w-full font-sans">
      <DashboardPageHeader
        title="Attendance Management"
        statusBadge={
          hasPolicyConfigured ? (
            <span className="font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-xs">
              <span>✅</span> Policy Configured
            </span>
          ) : (
            <span className="font-extrabold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-xs animate-pulse">
              <span>⚠️</span> Not Configured
            </span>
          )
        }
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

      {/* ACCESS DENIED STATE */}
      {!canView ? (
        <div className="bg-white dark:bg-slate-900 p-12 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mx-auto text-xl border border-rose-100 dark:border-rose-900">
            🔒
          </div>
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">
            Access Restricted
          </h3>
          <p className="text-xs text-slate-400 font-medium max-w-md mx-auto">
            You do not have permission to view attendance rules and policies. Please contact your system administrator.
          </p>
        </div>
      ) : isLoading ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs my-4">
          <PageLoader message="Loading Attendance Rules & Policy Flags..." />
        </div>
      ) : (
        <form onSubmit={handleSaveRules} className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold text-lg">
                ⏰
              </span>
            <div>
              <h2 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                Company Attendance & Timing Rules
              </h2>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Configure grace periods, late entry penalties, shift hours, cycle cutoff dates, and period locks
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canCreate && (
              <button
                type="button"
                onClick={() => setSyncDrawerOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-[#07518a] hover:bg-[#064270] text-white font-extrabold text-xs uppercase tracking-wider shadow-md shadow-[#07518a]/20 transition-all cursor-pointer flex items-center gap-2"
              >
                <span>📡</span>
                <span>Sync Biometric Data</span>
              </button>
            )}

            {canEdit ? (
              <button
                ref={topSaveRef}
                type="submit"
                disabled={!isModified || isSaving}
                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 flex items-center gap-2 border ${
                  isSaving
                    ? 'bg-[#07518a] text-white border-[#07518a] opacity-80 cursor-wait'
                    : isModified
                    ? 'bg-[#07518a] hover:bg-[#064270] text-white shadow-md shadow-[#07518a]/25 cursor-pointer active:scale-95 border-transparent'
                    : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-60'
                }`}
              >
                {isSaving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Saving Rules...</span>
                  </>
                ) : (
                  <>
                    <span>💾 Save Policy Rules</span>
                    {isModified && <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />}
                  </>
                )}
              </button>
            ) : (
              <div className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-xs">
                <span>🔒</span>
                <span>View Only Mode</span>
              </div>
            )}

            {canDelete && hasPolicyConfigured && (
              <button
                type="button"
                onClick={() => setDeleteModalOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 hover:border-rose-500/50 font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shadow-xs active:scale-95"
                title="Delete Attendance Policy"
              >
                <span>🗑️</span>
                <span>Delete Policy</span>
              </button>
            )}
          </div>
        </div>

        {!hasPolicyConfigured && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4.5 flex items-start gap-3.5 shadow-xs animate-fadeIn">
            <span className="text-xl flex-shrink-0">⚠️</span>
            <div>
              <h4 className="text-xs font-black text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                Attendance Policy Not Configured Yet
              </h4>
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mt-0.5">
                No attendance policy has been configured for this company yet. Please fill in the policy details below and click &quot;Save Policy Rules&quot;.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* CARD 1: LATE ENTRY & GRACE PERIOD RULES */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center text-sm font-bold">
                  ⌛
                </span>
                <div>
                  <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    Late Entry & Grace Period Rules
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">Thresholds for punch delays</p>
                </div>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Grace Period (Minutes) *
                  </label>
                  <input
                    type="number"
                    value={policyForm.grace_period_mins}
                    onChange={(e) => setPolicyForm({ ...policyForm, grace_period_mins: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 transition-all"
                    placeholder="e.g. 15"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Allowed delay after official shift start time without penalty.</p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Max Late Entries Allowed Per Month *
                  </label>
                  <input
                    type="number"
                    value={policyForm.max_late_entries_allowed}
                    onChange={(e) => setPolicyForm({ ...policyForm, max_late_entries_allowed: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 transition-all"
                    placeholder="e.g. 3"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Number of late arrivals tolerated before penalty applies.</p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Late Entry Penalty Type
                  </label>
                  <select
                    value={policyForm.late_entry_penalty}
                    onChange={(e) => setPolicyForm({ ...policyForm, late_entry_penalty: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 transition-all cursor-pointer"
                  >
                    <option value="HALF_DAY">Deduct 0.5 Day Leave / LOP</option>
                    <option value="FULL_DAY">Deduct 1.0 Day Leave / LOP</option>
                    <option value="WARNING_ONLY">Warning Alert Only (No Salary Deduction)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* CARD 2: WORKING HOURS & OVERTIME THRESHOLDS */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center text-sm font-bold">
                  ⏱️
                </span>
                <div>
                  <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    Working Hours & Overtime Cutoffs
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">Minimum hours for Full Day / Half Day classification</p>
                </div>
              </div>

              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Min Half-Day Hours
                    </label>
                    <input
                      type="number"
                      value={policyForm.half_day_min_hours}
                      onChange={(e) => setPolicyForm({ ...policyForm, half_day_min_hours: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Min Full-Day Hours
                    </label>
                    <input
                      type="number"
                      value={policyForm.full_day_min_hours}
                      onChange={(e) => setPolicyForm({ ...policyForm, full_day_min_hours: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Minimum Overtime Threshold (Minutes)
                  </label>
                  <input
                    type="number"
                    value={policyForm.overtime_min_mins}
                    onChange={(e) => setPolicyForm({ ...policyForm, overtime_min_mins: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 transition-all"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Extra work beyond shift must exceed this duration to qualify for OT.</p>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                    <span>📍</span> Live GPS Tracking Ping Interval (Minutes)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={policyForm.location_tracking_interval_mins}
                    onChange={(e) => setPolicyForm({ ...policyForm, location_tracking_interval_mins: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 transition-all"
                    placeholder="e.g. 15"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Silent background GPS location breadcrumb ping interval for field staff (Default: 15 mins).</p>
                </div>
              </div>
            </div>

            {/* CARD 6: COMP-OFF LEAVE CREDIT RULES (PLACED ABOVE PAYROLL CUTOFF) */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4 lg:col-span-2">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center text-sm font-bold">
                  🎁
                </span>
                <div>
                  <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    Compensatory Off (Comp-Off) Rules
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">Configure display title and minimum work hours required to earn half-day / full-day Comp-Off</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Comp-Off Display Name *
                  </label>
                  <input
                    type="text"
                    value={policyForm.comp_off_display_name}
                    onChange={(e) => setPolicyForm({ ...policyForm, comp_off_display_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-emerald-500 transition-all"
                    placeholder="e.g. Comp-Off / C-OFF"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Label shown across leave requests & payslips</p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Min Hours for Half-Day Comp-Off *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={policyForm.comp_off_half_day_hours}
                    onChange={(e) => setPolicyForm({ ...policyForm, comp_off_half_day_hours: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-emerald-500 transition-all"
                    placeholder="e.g. 4.0"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Work duration on weekend/holiday for 0.5 Comp-Off credit</p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Min Hours for Full-Day Comp-Off *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={policyForm.comp_off_full_day_hours}
                    onChange={(e) => setPolicyForm({ ...policyForm, comp_off_full_day_hours: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-emerald-500 transition-all"
                    placeholder="e.g. 8.0"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Work duration on weekend/holiday for 1.0 Comp-Off credit</p>
                </div>
              </div>
            </div>

            {/* CARD 3: PAYROLL ATTENDANCE CYCLE CUTOFF DATES (FULL WIDTH) */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4 lg:col-span-2">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center text-sm font-bold">
                  📅
                </span>
                <div>
                  <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    Payroll Attendance Cycle Cutoff
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">Monthly cutoff date range for salary computation</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Cycle Start Day (Day of Month)
                  </label>
                  <input
                    type="number"
                    value={policyForm.cycle_start_day}
                    onChange={(e) => setPolicyForm({ ...policyForm, cycle_start_day: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Cycle End Day (Day of Month)
                  </label>
                  <input
                    type="number"
                    value={policyForm.cycle_end_day}
                    onChange={(e) => setPolicyForm({ ...policyForm, cycle_end_day: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>

              {/* 📝 CLEAR NOTE & HELPFUL STAR POINTS CALLOUT */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3 text-xs">
                <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-extrabold">
                  <span className="text-sm">📝</span>
                  <span>Active Cutoff Cycle Summary:</span>
                </div>
                <p className="text-slate-700 dark:text-slate-300 font-medium pl-6">
                  With start day <strong>{policyForm.cycle_start_day || 26}</strong> and end day <strong>{policyForm.cycle_end_day || 25}</strong>, payroll will be generated for attendance from the <strong>{policyForm.cycle_start_day || 26}th of the previous month</strong> to the <strong>{policyForm.cycle_end_day || 25}th of the current month</strong>.
                </p>

                <div className="pt-2.5 border-t border-slate-200/70 dark:border-slate-700/70 space-y-2">
                  <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-extrabold text-[11px] uppercase tracking-wider">
                    <span>⭐</span>
                    <span>Pro Tip for Full Calendar Month Payroll:</span>
                  </div>
                  <ul className="space-y-1.5 text-slate-700 dark:text-slate-300 font-medium text-[11.5px] pl-5 list-disc">
                    <li>
                      To generate payroll for the full calendar month (1st to last day of month), set <strong>Cycle Start Day: 1</strong> and <strong>Cycle End Day: 31</strong>.
                    </li>
                    <li>
                      <strong>Automatic Month-End Handling:</strong> For months with 28, 29, or 30 days (such as February or April), the engine automatically adjusts to the exact last day of that month without requiring manual changes.
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* CARD 4: SYSTEM POLICY FLAGS (2x2 GRID OF CONTROLS) */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4 lg:col-span-2">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center text-sm font-bold">
                    ⚙️
                  </span>
                  <div>
                    <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                      System Policy Flags
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium">Punch channels, mandatory live selfie verification, and GPS tracking controls</p>
                  </div>
                </div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                  Database Policy Controls
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* 1. ALLOW MOBILE PUNCH */}
                <div
                  onClick={() => { if (!canEdit) return; setPolicyForm(prev => ({ ...prev, allow_mobile_punch: !prev.allow_mobile_punch })); }}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all select-none ${
                    policyForm.allow_mobile_punch
                      ? 'border-indigo-500/40 bg-indigo-50/20 dark:bg-indigo-950/20'
                      : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40'
                  } ${canEdit ? 'hover:shadow-xs cursor-pointer group' : 'cursor-not-allowed opacity-75'}`}
                >
                  <div className="space-y-1 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base">📱</span>
                      <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors uppercase tracking-wide">
                        ALLOW MOBILE PUNCH
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      Enable employees to clock in / out using the mobile application.
                    </p>
                    <span className="inline-block text-[10px] font-mono text-slate-400 dark:text-slate-500">
                      column: allow_mobile_punch
                    </span>
                  </div>
                  <div className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out flex-shrink-0 ${policyForm.allow_mobile_punch ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${policyForm.allow_mobile_punch ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                </div>

                {/* 2. ALLOW WEB PUNCH */}
                <div
                  onClick={() => { if (!canEdit) return; setPolicyForm(prev => ({ ...prev, allow_web_punch: !prev.allow_web_punch })); }}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all select-none ${
                    policyForm.allow_web_punch
                      ? 'border-indigo-500/40 bg-indigo-50/20 dark:bg-indigo-950/20'
                      : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40'
                  } ${canEdit ? 'hover:shadow-xs cursor-pointer group' : 'cursor-not-allowed opacity-75'}`}
                >
                  <div className="space-y-1 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base">💻</span>
                      <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors uppercase tracking-wide">
                        ALLOW WEB PUNCH
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      Enable employees to clock in / out from their web dashboard.
                    </p>
                    <span className="inline-block text-[10px] font-mono text-slate-400 dark:text-slate-500">
                      column: allow_web_punch
                    </span>
                  </div>
                  <div className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out flex-shrink-0 ${policyForm.allow_web_punch ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${policyForm.allow_web_punch ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                </div>

                {/* 3. REQUIRE SELFIE */}
                <div
                  onClick={() => { if (!canEdit) return; setPolicyForm(prev => ({ ...prev, require_selfie: !prev.require_selfie })); }}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all select-none ${
                    policyForm.require_selfie
                      ? 'border-emerald-500/40 bg-emerald-50/20 dark:bg-emerald-950/20'
                      : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40'
                  } ${canEdit ? 'hover:shadow-xs cursor-pointer group' : 'cursor-not-allowed opacity-75'}`}
                >
                  <div className="space-y-1 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base">📸</span>
                      <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors uppercase tracking-wide">
                        REQUIRE SELFIE
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      Open live selfie camera popup; compressed photo saved in <span className="font-mono font-semibold">image_url</span>.
                    </p>
                    <span className="inline-block text-[10px] font-mono text-slate-400 dark:text-slate-500">
                      column: require_selfie
                    </span>
                  </div>
                  <div className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out flex-shrink-0 ${policyForm.require_selfie ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${policyForm.require_selfie ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                </div>

                {/* 4. REQUIRE GPS */}
                <div
                  onClick={() => { if (!canEdit) return; setPolicyForm(prev => ({ ...prev, require_gps: !prev.require_gps })); }}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all select-none ${
                    policyForm.require_gps
                      ? 'border-[#07518a]/40 bg-[#07518a]/10 dark:bg-[#07518a]/20'
                      : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40'
                  } ${canEdit ? 'hover:shadow-xs cursor-pointer group' : 'cursor-not-allowed opacity-75'}`}
                >
                  <div className="space-y-1 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base">📍</span>
                      <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200 group-hover:text-[#07518a] dark:group-hover:text-[#38bdf8] transition-colors uppercase tracking-wide">
                        REQUIRE GPS
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      Requires GPS location coordinates when marking punch. If disabled, GPS is optional.
                    </p>
                    <span className="inline-block text-[10px] font-mono text-slate-400 dark:text-slate-500">
                      column: require_gps
                    </span>
                  </div>
                  <div className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out flex-shrink-0 ${policyForm.require_gps ? 'bg-[#07518a]' : 'bg-slate-300 dark:bg-slate-700'}`}>
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${policyForm.require_gps ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 5: MONTHLY PERMISSION RULES & QUOTAS (FULL WIDTH) */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4 lg:col-span-2">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center text-sm font-bold">
                  🎫
                </span>
                <div>
                  <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    Permission Rules & Monthly Quotas
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">Monthly permission limits per employee (e.g. 2 times, 2 hours per month)</p>
                </div>
              </div>

              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Max Permissions / Month *
                    </label>
                    <input
                      type="number"
                      disabled={!canEdit}
                      value={policyForm.max_permission_count_per_month}
                      onChange={(e) => setPolicyForm({ ...policyForm, max_permission_count_per_month: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-amber-500 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                      placeholder="e.g. 2"
                      required
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Allowed times per month (e.g. 2 times)</p>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Single Duration (Minutes) *
                    </label>
                    <input
                      type="number"
                      disabled={!canEdit}
                      value={policyForm.max_single_permission_minutes}
                      onChange={(e) => setPolicyForm({ ...policyForm, max_single_permission_minutes: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-amber-500 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                      placeholder="e.g. 120"
                      required
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Single session duration (120 mins = 2 hours)</p>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Total Monthly Duration (Mins)
                    </label>
                    <input
                      type="number"
                      disabled={!canEdit}
                      value={policyForm.max_permission_minutes_per_month}
                      onChange={(e) => setPolicyForm({ ...policyForm, max_permission_minutes_per_month: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-amber-500 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                      placeholder="e.g. 240"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Cumulative cap (240 mins = 4 hours)</p>
                  </div>
                </div>

                <div className="pt-2 space-y-2.5">
                  <div
                    onClick={() => { if (!canEdit) return; setPolicyForm(prev => ({ ...prev, permission_affects_late: !prev.permission_affects_late })); }}
                    className={`flex items-center justify-between p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 transition-all select-none ${canEdit ? 'hover:bg-slate-100/60 dark:hover:bg-slate-800/50 cursor-pointer' : 'cursor-not-allowed opacity-75'}`}
                  >
                    <div>
                      <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200">
                        PERMISSION EXEMPTS LATE ENTRY PENALTY
                      </span>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                        Approved morning permissions will not trigger late entry penalty
                      </p>
                    </div>
                    <div className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out flex-shrink-0 ${policyForm.permission_affects_late ? 'bg-amber-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
                      <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${policyForm.permission_affects_late ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  </div>

                  <div
                    onClick={() => { if (!canEdit) return; setPolicyForm(prev => ({ ...prev, permission_affects_early_exit: !prev.permission_affects_early_exit })); }}
                    className={`flex items-center justify-between p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 transition-all select-none ${canEdit ? 'hover:bg-slate-100/60 dark:hover:bg-slate-800/50 cursor-pointer' : 'cursor-not-allowed opacity-75'}`}
                  >
                    <div>
                      <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200">
                        PERMISSION EXEMPTS EARLY EXIT PENALTY
                      </span>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                        Approved evening permissions will not mark early departure
                      </p>
                    </div>
                    <div className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out flex-shrink-0 ${policyForm.permission_affects_early_exit ? 'bg-amber-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
                      <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${policyForm.permission_affects_early_exit ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  </div>

                  <div
                    onClick={() => { if (!canEdit) return; setPolicyForm(prev => ({ ...prev, allow_permission_carry_forward: !prev.allow_permission_carry_forward })); }}
                    className={`flex items-center justify-between p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-amber-50/40 dark:bg-amber-950/20 transition-all select-none ${canEdit ? 'hover:bg-amber-100/50 dark:hover:bg-amber-950/40 cursor-pointer' : 'cursor-not-allowed opacity-75'}`}
                  >
                    <div>
                      <span className="font-extrabold text-xs text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                        <span>ALLOW PERMISSION CARRY FORWARD TO NEXT MONTH</span>
                        <span className="text-[9px] px-2 py-0.5 rounded-full font-black uppercase bg-amber-200/80 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
                          {policyForm.allow_permission_carry_forward ? 'CARRY FORWARD ON' : 'EXPIRE AT MONTH END'}
                        </span>
                      </span>
                      <p className="text-[10px] text-amber-700/80 dark:text-amber-400/80 font-medium mt-0.5">
                        Unused permission quota will roll over into employee&apos;s next month balance
                      </p>
                    </div>
                    <div className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out flex-shrink-0 ${policyForm.allow_permission_carry_forward ? 'bg-amber-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
                      <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${policyForm.allow_permission_carry_forward ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* 🗑️ DELETE POLICY CONFIRMATION MODAL */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full shadow-2xl space-y-5 animate-scaleUp">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center text-2xl border border-rose-500/20 flex-shrink-0">
                ⚠️
              </div>
              <div>
                <h3 className="text-base font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                  Delete Policy Confirmation
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  Are you sure you want to delete this attendance policy?
                </p>
              </div>
            </div>

            <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-4 text-xs font-semibold text-rose-800 dark:text-rose-300">
              This action will remove all custom grace periods, late entry penalties, and cutoff rules for this company. Standard default rules will be restored.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                disabled={isDeleting}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDeletePolicy}
                disabled={isDeleting}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-rose-600/30 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <span>🗑️ Yes, Delete Policy</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📡 BIOMETRIC ATTENDANCE SYNC SLIDE DRAWER */}
      <SlideDrawer
        isOpen={syncDrawerOpen}
        onClose={() => setSyncDrawerOpen(false)}
        title="📡 Biometric Attendance Sync"
      >
        <form onSubmit={handleBiometricSync} className="space-y-4 text-xs font-semibold">
          {/* Server URL / IP */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Biometric Server Web Service URL / IP *
            </label>
            <input
              type="text"
              required
              value={biometricServerUrl}
              onChange={(e) => setBiometricServerUrl(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500 transition-all"
              placeholder="http://172.30.0.250:8086/iclock/webapiservice.asmx"
            />
            <p className="text-[10px] text-slate-400 mt-1">Specify local IP (e.g. 172.30.0.250:8086) or Public Static IP/Domain.</p>
          </div>

          {/* Device Serial Number */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Device Serial Number
            </label>
            <input
              type="text"
              value={biometricSerialNumber}
              onChange={(e) => setBiometricSerialNumber(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500 transition-all"
              placeholder="e.g. QJT3243900297"
            />
            <p className="text-[10px] text-slate-400 mt-1">Optional biometric machine serial number (Default: QJT3243900297).</p>
          </div>

          {/* Username */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Biometric Server Username *
            </label>
            <input
              type="text"
              required
              value={biometricUsername}
              onChange={(e) => setBiometricUsername(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500 transition-all"
              placeholder="e.g. admin"
            />
          </div>

          {/* Password with Eye toggle */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Biometric Server Password *
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={biometricPassword}
                onChange={(e) => setBiometricPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500 transition-all"
                placeholder="Enter password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all cursor-pointer"
                title={showPassword ? 'Hide Password' : 'Show Password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Date Range: From Date & To Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                From Date *
              </label>
              <input
                type="date"
                required
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500 transition-all"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                To Date *
              </label>
              <input
                type="date"
                required
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500 transition-all"
              />
            </div>
          </div>

          {/* Sync Result Summary Card */}
          {syncResult && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-2 text-xs text-emerald-900 dark:text-emerald-200 animate-fadeIn">
              <div className="flex items-center gap-2 font-extrabold text-sm">
                <span>🎉</span>
                <span>Sync Completed Successfully!</span>
              </div>
              <div className="space-y-1 text-slate-700 dark:text-slate-300 font-medium pl-6">
                <div>• Total Punches Fetched: <strong className="font-bold text-emerald-700 dark:text-emerald-300">{syncResult.totalFetched}</strong></div>
                <div>• Total Raw Punches Inserted: <strong className="font-bold text-emerald-700 dark:text-emerald-300">{syncResult.insertedCount}</strong></div>
                <div>• Attendance Summaries Processed: <strong className="font-bold text-emerald-700 dark:text-emerald-300">{syncResult.summaryProcessed} days</strong></div>
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="pt-3">
            <button
              type="submit"
              disabled={isSyncing}
              className="w-full py-3 rounded-xl bg-[#07518a] hover:bg-[#064270] text-white font-black text-xs uppercase tracking-wider shadow-md shadow-[#07518a]/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSyncing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Syncing Biometric Logs...</span>
                </>
              ) : (
                <>
                  <span>🚀</span>
                  <span>Start Biometric Sync</span>
                </>
              )}
            </button>
          </div>
        </form>
      </SlideDrawer>

      {/* 🚀 Floating Right-Side Save Button (Appears ONLY when changes exist AND top save button is scrolled out of view) */}
      {canEdit && isModified && showFloatingSave && (
        <div className="fixed right-0 top-1/2 -translate-y-1/2 z-40 animate-fadeIn select-none pointer-events-auto">
          <button
            type="button"
            onClick={() => handleSaveRules()}
            disabled={isSaving}
            className="group relative flex items-center gap-2.5 px-4 py-3 rounded-l-2xl shadow-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white ring-2 ring-emerald-400/40 shadow-emerald-700/30 hover:pr-5.5 transition-all duration-300 cursor-pointer"
            title="Unsaved changes detected! Click to save"
          >
            {/* Pulsing indicator */}
            {!isSaving && (
              <span className="absolute -left-1.5 -top-1.5 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-400 border-2 border-white dark:border-slate-900" />
              </span>
            )}

            {isSaving ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin flex-shrink-0" />
            ) : (
              <Save className="w-4 h-4 flex-shrink-0 text-white animate-bounce" />
            )}

            <div className="flex flex-col text-left">
              <span className="text-[12px] font-black uppercase tracking-wider whitespace-nowrap">
                {isSaving ? 'Saving...' : 'Save Changes'}
              </span>
              <span className="text-[9px] font-bold text-emerald-100/90 whitespace-nowrap leading-tight">
                ● Unsaved edits
              </span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
