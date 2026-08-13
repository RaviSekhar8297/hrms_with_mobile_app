'use client';

import React, { useEffect, useState } from 'react';
import DashboardPageHeader from '../../components/DashboardPageHeader';
import AttendanceSubHeader from '../../components/AttendanceSubHeader';
import { getHeaders, API_BASE } from '../../utils/api';
import { useDashboard } from '../../components/DashboardContext';
import { usePermissions } from '../../hooks/usePermissions';

export default function AttendanceRulesPage() {
  const { showToast } = useDashboard();
  const { isSuperAdmin } = usePermissions();

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Policy Form State
  const [policyForm, setPolicyForm] = useState({
    grace_period_mins: '15',
    max_late_entries_allowed: '3',
    late_entry_penalty: 'HALF_DAY',
    half_day_min_hours: '4',
    full_day_min_hours: '8',
    overtime_min_mins: '60',
    cycle_start_day: '26',
    cycle_end_day: '25',
    allow_self_punch: true,
    require_location_gps: false,
    auto_approve_regularization: false,
  });

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
      fetchRules();
    }
  }, [companyId]);

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

  const fetchRules = async () => {
    if (!companyId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/attendance/policies?company_id=${companyId}`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          const p = data[0];
          setPolicyForm({
            grace_period_mins: String(p.grace_period_mins || 15),
            max_late_entries_allowed: String(p.max_late_entries_allowed || 3),
            late_entry_penalty: p.late_entry_penalty || 'HALF_DAY',
            half_day_min_hours: String(p.half_day_min_hours || 4),
            full_day_min_hours: String(p.full_day_min_hours || 8),
            overtime_min_mins: String(p.overtime_min_mins || 60),
            cycle_start_day: String(p.cycle_start_day || 26),
            cycle_end_day: String(p.cycle_end_day || 25),
            allow_self_punch: p.allow_self_punch ?? true,
            require_location_gps: p.require_location_gps ?? false,
            auto_approve_regularization: p.auto_approve_regularization ?? false,
          });
        }
      }
    } catch (e) {
      console.error('Failed to load rules:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompanyChange = (newId: string) => {
    setCompanyId(newId);
    localStorage.setItem('selectedCompanyId', newId);
  };

  const handleSaveRules = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) {
      showToast('Please select a company', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/attendance/policies`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          company_id: companyId,
          ...policyForm,
        }),
      });

      if (res.ok) {
        showToast('Attendance rules updated successfully!', 'success');
        fetchRules();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to save attendance rules', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Connection error while saving rules', 'error');
    } finally {
      setIsSaving(false);
    }
  };

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

      {/* RULES MANAGEMENT CONSOLE */}
      <form onSubmit={handleSaveRules} className="space-y-6">
        <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div>
            <h2 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span>⏰</span> Company Attendance & Timing Rules
            </h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Configure grace periods, late entry penalties, shift hours, and cycle cutoff dates
            </p>
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer border-0 flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving ? 'Saving Rules...' : '💾 Save Policy Rules'}
          </button>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-slate-400 text-xs font-medium bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            Loading attendance policy configurations...
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* CARD 1: LATE ENTRY & GRACE PERIOD RULES */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center text-sm font-bold">
                  ⌛
                </span>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
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
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs font-bold"
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
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs font-bold"
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
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs font-bold cursor-pointer"
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
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
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
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs font-bold"
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
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs font-bold"
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
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs font-bold"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Extra work beyond shift must exceed this duration to qualify for OT.</p>
                </div>
              </div>
            </div>

            {/* CARD 3: PAYROLL ATTENDANCE CYCLE CUTOFF DATES */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center text-sm font-bold">
                  📅
                </span>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
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
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs font-bold"
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
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs font-bold"
                  />
                </div>
              </div>
            </div>

            {/* CARD 4: PERMISSIONS & SYSTEM TOGGLES */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center text-sm font-bold">
                  ⚙️
                </span>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    System Policy Flags
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">Self-service & GPS verification controls</p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 cursor-pointer">
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200">Allow Mobile & Web Self Punching</span>
                    <p className="text-[10px] text-slate-400">Employees can mark IN/OUT directly from employee portal</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={policyForm.allow_self_punch}
                    onChange={(e) => setPolicyForm({ ...policyForm, allow_self_punch: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 cursor-pointer">
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200">Require Mobile Location GPS</span>
                    <p className="text-[10px] text-slate-400">Validate Geofence Coordinates during self attendance</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={policyForm.require_location_gps}
                    onChange={(e) => setPolicyForm({ ...policyForm, require_location_gps: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 cursor-pointer">
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200">Auto-Approve Regularizations</span>
                    <p className="text-[10px] text-slate-400">Automatically accept regularization if manager does not act in 48h</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={policyForm.auto_approve_regularization}
                    onChange={(e) => setPolicyForm({ ...policyForm, auto_approve_regularization: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                  />
                </label>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
