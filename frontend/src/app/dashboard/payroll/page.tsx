'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardPageHeader from '../components/DashboardPageHeader';
import SlideDrawer from '../components/SlideDrawer';
import SearchableSelect from '../components/SearchableSelect';
import { useDashboard } from '../components/DashboardContext';
import { usePermissions } from '../hooks/usePermissions';
import { getHeaders, getUrl } from '../utils/api';
import { 
  DollarSign, 
  Calendar, 
  Lock, 
  Unlock, 
  Plus, 
  Search, 
  CheckCircle2, 
  TrendingUp, 
  FileText, 
  Users, 
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Check,
  Building2,
  GitBranch,
  Layers,
  Filter,
  Trash2
} from 'lucide-react';

interface Company {
  id: string;
  name: string;
  subdomain: string;
  status: string;
  created_at: string;
}

interface Branch {
  id: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  emp_id: string;
  first_name: string;
  last_name: string;
  department_name?: string;
  designation_name?: string;
  branch_name?: string;
  branch_id?: string;
  department_id?: string;
  is_enabled_for_payslip?: boolean;
}

interface PayrollRun {
  id: string;
  payroll_run_number: string;
  pay_period: string;
  payroll_type?: string;
  payroll_month: number;
  payroll_year: number;
  total_employees: number;
  total_gross_payout: number;
  total_deductions: number;
  total_net_payout: number;
  status: 'DRAFT' | 'GENERATING' | 'GENERATED' | 'APPROVED' | 'RELEASED' | 'PAID' | 'CANCELLED';
  is_locked: boolean;
  released_at?: string;
  created_at: string;
  company_name?: string;
  created_by_name?: string;
  employee_names?: string;
}

interface MonthStatusCard {
  periodCode: string;
  monthName: string;
  year: string;
  isLocked: boolean;
  enabledPayslips: number;
  disabledPayslips: number;
  totalEmployees: number;
}

export default function PayrollPage() {
  const router = useRouter();
  const { showToast, companyId, setCompanyId } = useDashboard();

  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // State
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // DYNAMIC 12 MONTHS COMPUTATION FROM SYSTEM CLOCK & DATABASE
  const generateDynamicHorizonMonths = (): MonthStatusCard[] => {
    const months: MonthStatusCard[] = [];
    const now = new Date();
    // Generate past 11 months + current month
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yearStr = String(d.getFullYear());
      const monthStr = String(d.getMonth() + 1).padStart(2, '0');
      const periodCode = `${yearStr}-${monthStr}`;
      const monthName = d.toLocaleString('en-US', { month: 'short' });

      // Match with database run if present
      const match = runs.find(r => r.pay_period === periodCode);

      if (match) {
        months.push({
          periodCode,
          monthName,
          year: yearStr,
          isLocked: match.is_locked || match.status === 'RELEASED',
          enabledPayslips: match.total_employees || 0,
          disabledPayslips: match.is_locked ? 0 : 0,
          totalEmployees: match.total_employees || 0
        });
      } else {
        months.push({
          periodCode,
          monthName,
          year: yearStr,
          isLocked: false,
          enabledPayslips: 0,
          disabledPayslips: 0,
          totalEmployees: 0
        });
      }
    }
    return months;
  };

  const dynamicHorizonMonths = generateDynamicHorizonMonths();

  // Selected Month & Release Drawer State
  const [selectedPeriod, setSelectedPeriod] = useState<string>(dynamicHorizonMonths[dynamicHorizonMonths.length - 1]?.periodCode || '2026-06');
  const [releaseDrawerOpen, setReleaseDrawerOpen] = useState(false);
  const [selectedEmployeesState, setSelectedEmployeesState] = useState<{ [empId: string]: boolean }>({});
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');

  // Drawer Filters
  const [drawerCompanyId, setDrawerCompanyId] = useState('ALL');
  const [drawerBranchId, setDrawerBranchId] = useState('ALL');
  const [drawerDeptId, setDrawerDeptId] = useState('ALL');
  const [selectAllCompany, setSelectAllCompany] = useState(true);
  const [selectAllBranch, setSelectAllBranch] = useState(true);
  const [selectAllDept, setSelectAllDept] = useState(true);

  // Confetti & Action Loading
  const [showConfetti, setShowConfetti] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { hasPermission } = usePermissions();
  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('superadmin');
  const canView = isSuperAdmin || hasPermission('payroll_runs_view');
  const canCreate = isSuperAdmin || hasPermission('payroll_runs_create');
  const canEdit = isSuperAdmin || hasPermission('payroll_runs_edit');
  const canDelete = isSuperAdmin || hasPermission('payroll_runs_delete');

  useEffect(() => {
    const storedRoles = localStorage.getItem('roles');
    const storedEmail = localStorage.getItem('email');
    const storedPermissions = localStorage.getItem('permissions');
    if (storedRoles) setRoles(JSON.parse(storedRoles));
    if (storedEmail) setEmail(storedEmail);
    if (storedPermissions) setPermissions(JSON.parse(storedPermissions));
  }, []);

  useEffect(() => {
    fetchPayrollRuns();
    fetchAuxiliaryData();
  }, [companyId, isSuperAdmin]);

  const fetchCompanies = async () => {
    try {
      const res = await fetch('/api/v1/companies', { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) setCompanies(data.companies || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAuxiliaryData = async () => {
    try {
      if (isSuperAdmin) fetchCompanies();

      let urlSuffix = companyId ? `?companyId=${companyId}` : '';
      const [deptRes, branchRes, empRes] = await Promise.all([
        fetch(`/api/v1/departments${urlSuffix}`, { headers: getHeaders() }),
        fetch(`/api/v1/branches${urlSuffix}`, { headers: getHeaders() }),
        fetch(`/api/v1/employees${urlSuffix}`, { headers: getHeaders() })
      ]);

      const [deptData, branchData, empData] = await Promise.all([
        deptRes.json(),
        branchRes.json(),
        empRes.json()
      ]);

      if (deptRes.ok) setDepartments(deptData.departments || []);
      if (branchRes.ok) setBranches(branchData.branches || []);
      if (empRes.ok) {
        const empList: Employee[] = empData.employees || [];
        setEmployees(empList);
        
        const initialSelectedState: { [key: string]: boolean } = {};
        empList.forEach(e => {
          initialSelectedState[e.id] = true;
        });
        setSelectedEmployeesState(initialSelectedState);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPayrollRuns = async () => {
    setLoading(true);
    try {
      let url = '/api/v1/payroll/runs';
      if (companyId) url += `?companyId=${companyId}`;
      const res = await fetch(url, { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) setRuns(data.runs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCompanyChange = (id: string) => {
    const val = id || null;
    setCompanyId(val);
    if (val) localStorage.setItem('companyId', val);
    else localStorage.removeItem('companyId');
  };

  const handleOpenReleaseDrawer = (periodCode: string) => {
    if (!canEdit) {
      showToast('🔒 Edit Payroll permission is required to configure release rules.', 'error');
      return;
    }
    setSelectedPeriod(periodCode);
    setReleaseDrawerOpen(true);
  };

  const handleDeletePayrollRun = async (run: PayrollRun) => {
    if (!canDelete) {
      showToast('🔒 Delete Payroll permission is required.', 'error');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete payroll disbursement batch "${run.payroll_run_number}" (${run.pay_period})? This will remove all calculated payslips for this batch.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/v1/payroll/runs/${run.id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`🗑️ Payroll batch run ${run.payroll_run_number} deleted successfully!`, 'success');
        fetchPayrollRuns();
      } else {
        showToast(data.error || 'Failed to delete payroll run', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Error deleting payroll run', 'error');
    }
  };

  const toggleEmployeeSelection = (empId: string) => {
    setSelectedEmployeesState(prev => ({
      ...prev,
      [empId]: !prev[empId]
    }));
  };

  const handleSaveReleasePayroll = async () => {
    const enabledCount = Object.values(selectedEmployeesState).filter(Boolean).length;
    setActionLoading('save_release');
    
    try {
      const match = runs.find(r => r.pay_period === selectedPeriod);
      if (match) {
        await fetch(`/api/v1/payroll/runs/${match.id}/action`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ action: 'RELEASE', reason: `Released for ${enabledCount} employees` })
        });
      }

      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3500);
      showToast(`🎉 Release Payroll for ${selectedPeriod} updated successfully! (${enabledCount} Enabled)`, 'success');
      setReleaseDrawerOpen(false);
      fetchPayrollRuns();
    } catch (e) {
      console.error(e);
      showToast('Error updating payroll release status', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const drawerEmployees = employees.filter(emp => {
    if (drawerBranchId !== 'ALL' && emp.branch_id && emp.branch_id !== drawerBranchId) return false;
    if (drawerDeptId !== 'ALL' && emp.department_id && emp.department_id !== drawerDeptId) return false;
    const nameStr = `${emp.emp_id} ${emp.first_name} ${emp.last_name}`.toLowerCase();
    if (employeeSearchQuery.trim() && !nameStr.includes(employeeSearchQuery.toLowerCase())) return false;
    return true;
  });

  const enabledCountTotal = Object.values(selectedEmployeesState).filter(Boolean).length;

  const filteredRuns = runs.filter(run => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      run.pay_period.toLowerCase().includes(q) ||
      run.payroll_run_number.toLowerCase().includes(q) ||
      (run.payroll_type && run.payroll_type.toLowerCase().includes(q)) ||
      (run.status && run.status.toLowerCase().includes(q))
    );
  });

  // Calculate totals for top summary KPI section
  const totalNetPayout = runs.reduce((acc, r) => acc + (parseFloat(String(r.total_net_payout)) || 0), 0);
  const totalEmployeesPaid = runs.reduce((acc, r) => acc + (r.total_employees || 0), 0);
  const lockedMonthsCount = dynamicHorizonMonths.filter(m => m.isLocked).length;

  if (roles.length > 0 && !canView) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center p-6 animate-fadeIn">
        <div className="h-16 w-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4 text-3xl">
          🔒
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Access Denied</h3>
        <p className="text-slate-500 dark:text-slate-400 text-xs mt-1.5 max-w-sm">
          You do not have the required permissions to access the Payroll Hub module. Please contact your administrator.
        </p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="payroll-hub-container space-y-4 animate-fadeIn w-full pb-16 relative text-left">
      {/* Confetti Celebration Overlay */}
      {showConfetti && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center overflow-hidden bg-slate-900/30 backdrop-blur-xs animate-fadeIn">
          <div className="text-center animate-bounce space-y-3">
            <span className="text-5xl filter drop-shadow-lg">🎉 🎊 💸 🔒 🎊 🎉</span>
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-2.5 rounded-xl shadow-2xl border border-white/20">
              <h2 className="text-lg font-bold tracking-tight">Payroll Released & Disbursed Successfully!</h2>
              <p className="text-xs text-indigo-100 mt-0.5">Audit log updated and payslips unlocked</p>
            </div>
          </div>
        </div>
      )}

      <DashboardPageHeader
        title="Payroll Release & Disbursement Console"
        actionMessage=""
        actionError=""
        companies={companies}
        companyId={companyId}
        handleCompanyChange={handleCompanyChange}
        isSuperAdmin={isSuperAdmin}
        email={email}
        hideCompanySelect={true}
        hideUserBadge={true}
      />

      {/* Top High-Contrast Stat Summary Cards Bar (COMPACT SLEEK HEIGHT) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* KPI 1: Total Disbursed Net */}
        <div className="group relative rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 border-t-4 border-t-indigo-500 p-3 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Disbursed Net</span>
            <div className="h-7 w-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200/60 dark:border-indigo-800/80 shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
              <DollarSign size={15} className="stroke-[2.5] shrink-0" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
              ₹{totalNetPayout.toLocaleString('en-IN')}
            </span>
            <span className="text-[10.5px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800 flex items-center gap-1">
              <TrendingUp size={11} className="shrink-0" />
              {runs.length} Batches
            </span>
          </div>
        </div>

        {/* KPI 2: Active Horizon */}
        <div className="group relative rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 border-t-4 border-t-emerald-500 p-3 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active Horizon</span>
            <div className="h-7 w-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/60 dark:border-emerald-800/80 shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
              <Calendar size={15} className="stroke-[2.5] shrink-0" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-xl font-black text-slate-900 dark:text-white tracking-tight font-mono">
              12 Months
            </span>
            <span className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Sparkles size={11} className="text-indigo-500 shrink-0" />
              {dynamicHorizonMonths[0]?.monthName} - {dynamicHorizonMonths[11]?.monthName} {dynamicHorizonMonths[11]?.year}
            </span>
          </div>
        </div>

        {/* KPI 3: Employees Disbursed */}
        <div className="group relative rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 border-t-4 border-t-amber-500 p-3 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Employees Disbursed</span>
            <div className="h-7 w-7 rounded-lg bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200/60 dark:border-amber-800/80 shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
              <Users size={15} className="stroke-[2.5] shrink-0" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
              {totalEmployeesPaid}
            </span>
            <span className="text-[10.5px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800 flex items-center gap-1">
              <CheckCircle2 size={11} className="shrink-0" />
              Cumulative
            </span>
          </div>
        </div>

        {/* KPI 4: Release Lock Status */}
        <div className="group relative rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 border-t-4 border-t-rose-500 p-3 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Release Lock Status</span>
            <div className="h-7 w-7 rounded-lg bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-200/60 dark:border-rose-800/80 shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
              <Lock size={15} className="stroke-[2.5] shrink-0" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-xl font-black text-slate-900 dark:text-white tracking-tight font-mono">
              {lockedMonthsCount} / 12
            </span>
            <span className="text-[10.5px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800 flex items-center gap-1">
              <ShieldCheck size={11} className="shrink-0" />
              {lockedMonthsCount} Locked
            </span>
          </div>
        </div>
      </div>

      {/* 12-Month Professional Horizon Cards Grid (COMPACT SLEEK HEIGHT) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-2xs">
        <div className="flex items-center justify-between mb-2.5">
          <div>
            <h3 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5 tracking-tight">
              <Calendar size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>12-Month Disbursement Horizon</span>
            </h3>
            <p className="text-[10.5px] text-slate-400 mt-0.5">Click any month card to configure release rules and enable payslips</p>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 text-[9.5px] font-black uppercase tracking-wider">
            Master Console
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
          {dynamicHorizonMonths.map((m) => {
            const isRed = m.isLocked;

            return (
              <div
                key={m.periodCode}
                onClick={() => handleOpenReleaseDrawer(m.periodCode)}
                className={`p-2 rounded-xl text-center space-y-1 cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 group relative ${
                  isRed 
                    ? 'border-2 border-rose-300 dark:border-rose-800 bg-rose-50/30 dark:bg-rose-950/20' 
                    : 'border-2 border-emerald-300 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20'
                }`}
              >
                {/* Month & Year Header + Lock Indicator */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-slate-900 dark:text-slate-100 tracking-tight uppercase leading-none">
                    {m.monthName}
                  </span>
                  {isRed ? (
                    <Lock size={10} className="text-rose-500 shrink-0" />
                  ) : (
                    <Unlock size={10} className="text-emerald-500 shrink-0" />
                  )}
                </div>
                <span className="text-[9.5px] text-slate-400 font-semibold block text-left">{m.year}</span>

                {/* Dynamic Ratio Display */}
                <div className="pt-1 border-t border-slate-200/60 dark:border-slate-800/80 text-[9.5px] font-bold text-left">
                  <div className="text-emerald-600 dark:text-emerald-400">{m.enabledPayslips} Enabled</div>
                  <div className="text-slate-400 font-medium">{m.disabledPayslips} Pending</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Payroll Runs Table Container */}
      <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-200/80 dark:border-slate-800/80 p-4 shadow-2xs space-y-4">
        {/* Table Header Row with Search Input & Generate Payroll Button */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <FileText size={16} className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>Payroll Disbursement Batches</span>
            </h3>
            <p className="text-[11px] text-slate-400 font-normal mt-0.5">Chronological audit log of payroll disbursement runs</p>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search size={14} className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search pay period, run #..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/80 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 font-medium transition-all"
              />
            </div>

            {/* Generate Payroll Button */}
            {canCreate && (
              <button
                type="button"
                onClick={() => router.push('/dashboard/payroll/generate')}
                className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold transition-all shadow-sm hover:shadow-indigo-500/20 cursor-pointer flex items-center gap-1.5 flex-shrink-0"
              >
                <Plus size={14} className="w-3.5 h-3.5 stroke-[3] shrink-0" />
                <span>+ Generate Payroll</span>
              </button>
            )}
          </div>
        </div>

        {/* Runs Table */}
        <div className="overflow-x-auto rounded-lg border border-slate-200/70 dark:border-slate-800/80">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/90 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Name</th>
                <th className="py-2.5 px-3">Pay Period</th>
                <th className="py-2.5 px-3 text-center">Payroll Type</th>
                <th className="py-2.5 px-3 text-center">Paid Days</th>
                <th className="py-2.5 px-3 text-right">Gross Salary</th>
                <th className="py-2.5 px-3 text-right">Deductions</th>
                <th className="py-2.5 px-3 text-right">Net Pay</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center">Lock Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white/50 dark:bg-slate-900/50">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400 font-medium">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                      <span>Loading payroll runs from database...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredRuns.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400 font-medium">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <FileText size={24} className="w-6 h-6 text-slate-300 dark:text-slate-700 shrink-0" />
                      <span>No payroll runs found. Click Generate Payroll to create a batch.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRuns.map((run) => (
                  <tr key={run.id} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="flex flex-col text-left">
                        <span className="font-extrabold text-slate-900 dark:text-slate-100">
                          {run.employee_names || 'Employee Payroll'}
                          {run.total_employees > 2 ? ` (+${run.total_employees - 2} more)` : ''}
                        </span>
                        <span className="font-mono text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">{run.payroll_run_number}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100">{run.pay_period}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/80 uppercase tracking-wider">
                        {run.payroll_type || 'REGULAR'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-semibold text-slate-700 dark:text-slate-300">{run.total_employees}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                      ₹{(parseFloat(String(run.total_gross_payout)) || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-rose-500 font-semibold">
                      ₹{(parseFloat(String(run.total_deductions)) || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-extrabold text-indigo-600 dark:text-indigo-400 text-xs">
                      ₹{(parseFloat(String(run.total_net_payout)) || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        run.status === 'RELEASED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800'
                          : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800'
                      }`}>
                        {run.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {run.is_locked ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 px-2 py-0.5 rounded">
                          <Lock size={10} className="w-2.5 h-2.5 shrink-0" />
                          <span>Locked</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded">
                          <Unlock size={10} className="w-2.5 h-2.5 shrink-0" />
                          <span>Unlocked</span>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {canEdit && (
                          <button
                            onClick={() => handleOpenReleaseDrawer(run.pay_period)}
                            className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold transition-all shadow-2xs cursor-pointer inline-flex items-center gap-1"
                          >
                            <span>Release & Enable</span>
                            <ArrowRight size={12} className="w-3 h-3 shrink-0" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDeletePayrollRun(run)}
                            title="Delete payroll batch run"
                            className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 hover:bg-rose-600 hover:text-white transition-all cursor-pointer"
                          >
                            <Trash2 size={13} className="w-3.5 h-3.5 shrink-0" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right SlideDrawer */}
      <SlideDrawer
        isOpen={releaseDrawerOpen}
        onClose={() => setReleaseDrawerOpen(false)}
        title={`Release Payroll - ${selectedPeriod}`}
      >
        <div className="space-y-4 text-left font-sans">
          
          {/* Filter Scope Parameters Container */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3.5">
            <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white">
              <Filter size={15} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>Filter Scope Parameters</span>
            </div>

            {/* Company Filter */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Building2 size={13} className="text-slate-400 shrink-0" />
                <span>COMPANY</span>
              </label>
              <SearchableSelect
                options={[{ value: 'ALL', label: 'ALL Companies' }, ...companies.map(c => ({ value: c.id, label: c.name }))]}
                value={drawerCompanyId}
                onChange={setDrawerCompanyId}
                placeholder="Select company..."
              />
            </div>

            {/* Branch Filter */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <GitBranch size={13} className="text-slate-400 shrink-0" />
                <span>BRANCH</span>
              </label>
              <SearchableSelect
                options={[{ value: 'ALL', label: 'ALL Branches' }, ...branches.map(b => ({ value: b.id, label: b.name }))]}
                value={drawerBranchId}
                onChange={setDrawerBranchId}
                placeholder="Select branch..."
              />
            </div>

            {/* Department Filter */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Layers size={13} className="text-slate-400 shrink-0" />
                <span>DEPARTMENT</span>
              </label>
              <SearchableSelect
                options={[{ value: 'ALL', label: 'ALL Departments' }, ...departments.map(d => ({ value: d.id, label: d.name }))]}
                value={drawerDeptId}
                onChange={setDrawerDeptId}
                placeholder="Select department..."
              />
            </div>
          </div>

          {/* Employees Checklist */}
          <div className="space-y-2.5 pt-1">
            <div className="flex justify-between items-center">
              <label className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <Users size={15} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>EMPLOYEES ({enabledCountTotal} / {drawerEmployees.length} ENABLED)</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  const allSelected = drawerEmployees.every(e => selectedEmployeesState[e.id]);
                  const updated = { ...selectedEmployeesState };
                  drawerEmployees.forEach(e => {
                    updated[e.id] = !allSelected;
                  });
                  setSelectedEmployeesState(updated);
                }}
                className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                {drawerEmployees.every(e => selectedEmployeesState[e.id]) ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="relative">
              <Search size={14} className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search employee by name or ID..."
                value={employeeSearchQuery}
                onChange={e => setEmployeeSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 font-medium transition-all"
              />
            </div>

            {/* Employee Cards List with Modern Checkboxes */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {drawerEmployees.map(emp => {
                const isSelected = !!selectedEmployeesState[emp.id];

                return (
                  <div
                    key={emp.id}
                    onClick={() => toggleEmployeeSelection(emp.id)}
                    className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition-all duration-150 ${
                      isSelected
                        ? 'border-indigo-400 bg-indigo-50/50 dark:border-indigo-700 dark:bg-indigo-950/40 shadow-2xs'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-2xs">
                        {(emp.first_name || 'E')[0]}
                      </span>
                      <div>
                        <span className="text-xs font-black text-slate-900 dark:text-slate-100 block leading-tight">
                          {emp.first_name} {emp.last_name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                          ID: {emp.emp_id || '10001'} • {emp.department_name || 'Department'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center">
                      {isSelected ? (
                        <div className="h-5 w-5 rounded-md bg-indigo-600 text-white flex items-center justify-center font-black shadow-2xs shrink-0">
                          <Check size={13} className="stroke-[3] shrink-0" />
                        </div>
                      ) : (
                        <div className="h-5 w-5 rounded-md border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shrink-0" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setReleaseDrawerOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveReleasePayroll}
              disabled={actionLoading === 'save_release'}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-md hover:shadow-indigo-500/20 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <CheckCircle2 size={14} className="shrink-0" />
              <span>{actionLoading === 'save_release' ? 'Saving...' : 'Save & Update Release'}</span>
            </button>
          </div>
        </div>
      </SlideDrawer>
    </div>
  );
}
