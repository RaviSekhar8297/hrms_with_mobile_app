'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardPageHeader from '../components/DashboardPageHeader';
import SlideDrawer from '../components/SlideDrawer';
import SearchableSelect from '../components/SearchableSelect';
import { useDashboard } from '../components/DashboardContext';
import { getHeaders } from '../utils/api';

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
  const { showToast } = useDashboard();

  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
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

  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('superadmin');

  useEffect(() => {
    const storedRoles = localStorage.getItem('roles');
    const storedEmail = localStorage.getItem('email');
    const storedCompanyId = localStorage.getItem('companyId');
    if (storedRoles) setRoles(JSON.parse(storedRoles));
    if (storedEmail) setEmail(storedEmail);
    if (storedCompanyId) setCompanyId(storedCompanyId);
  }, []);

  useEffect(() => {
    fetchPayrollRuns();
    fetchAuxiliaryData();
  }, [companyId, isSuperAdmin]);

  const fetchCompanies = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/v1/companies', { headers: getHeaders() });
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
        fetch(`http://localhost:5000/api/v1/departments${urlSuffix}`, { headers: getHeaders() }),
        fetch(`http://localhost:5000/api/v1/branches${urlSuffix}`, { headers: getHeaders() }),
        fetch(`http://localhost:5000/api/v1/employees${urlSuffix}`, { headers: getHeaders() })
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
      let url = 'http://localhost:5000/api/v1/payroll/runs';
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
    setSelectedPeriod(periodCode);
    setReleaseDrawerOpen(true);
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
        await fetch(`http://localhost:5000/api/v1/payroll/runs/${match.id}/action`, {
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

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }} className="font-sans space-y-6 animate-fadeIn w-full pb-20 relative text-left">
      <style dangerouslySetInnerHTML={{__html: `
        .font-sans, button, input, select, label, span, div, p, h1, h2, h3, h4, th, td {
          font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
          letter-spacing: normal !important;
        }
        @keyframes subtle-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.04); }
        }
        .animate-subtle-pulse {
          animation: subtle-pulse 2.5s infinite ease-in-out;
        }
      `}} />

      {/* Confetti Celebration Overlay */}
      {showConfetti && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center overflow-hidden">
          <div className="text-center animate-bounce">
            <span className="text-6xl">🎉 🎊 💸 🔒 🎊 🎉</span>
            <h2 className="text-xl font-bold text-white bg-indigo-600 px-6 py-2 rounded-full shadow-2xl mt-4">
              Payroll Released Successfully!
            </h2>
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

      {/* 12-Month Dynamic Horizon Cards Grid */}
      <div className="bg-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-3">
          {dynamicHorizonMonths.map((m) => {
            const isRed = m.isLocked;

            return (
              <div
                key={m.periodCode}
                onClick={() => handleOpenReleaseDrawer(m.periodCode)}
                className={`p-3.5 rounded-xl border text-center space-y-2 cursor-pointer transition-all duration-300 transform hover:-translate-y-1 hover:shadow-md ${
                  isRed
                    ? 'border-rose-200 bg-rose-50/50 dark:border-rose-900/60 dark:bg-rose-950/20 hover:border-rose-300'
                    : 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/60 dark:bg-emerald-950/20 hover:border-emerald-300'
                }`}
              >
                {/* Month & Year */}
                <div>
                  <span className={`text-sm font-bold block ${isRed ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                    {m.monthName}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium block">{m.year}</span>
                </div>

                {/* Animated Lock / Unlock Status Badge */}
                <div className="py-1 flex justify-center">
                  {isRed ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 animate-subtle-pulse">
                      🔒 Locked
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition-all hover:scale-105">
                      🔓 Unlocked
                    </span>
                  )}
                </div>

                {/* Dynamic Ratio Display */}
                <div className="pt-1.5 border-t border-slate-200/60 dark:border-slate-800">
                  <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 block">
                    {m.enabledPayslips} - {m.disabledPayslips}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium block">Enabled - Pending</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Payroll Runs Table Container */}
      <div className="bg-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-4">
        {/* Table Header Row with Search Input & Generate Payroll Button side by side */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Payroll Disbursement Batches</h3>
            <p className="text-xs text-slate-400 font-normal mt-0.5">Chronological audit log of payroll disbursement runs</p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Search pay period..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 font-medium"
              />
            </div>

            {/* Generate Payroll Button */}
            <button
              type="button"
              onClick={() => router.push('/dashboard/payroll/generate')}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-2 flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>+ Generate Payroll</span>
            </button>
          </div>
        </div>

        {/* Runs Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold text-xs">
                <th className="py-3 px-3">Run Number</th>
                <th className="py-3 px-3">Pay Period</th>
                <th className="py-3 px-3 text-center">Payroll Type</th>
                <th className="py-3 px-3 text-center">Employees Paid</th>
                <th className="py-3 px-3 text-right">Gross Salary</th>
                <th className="py-3 px-3 text-right">Deductions</th>
                <th className="py-3 px-3 text-right">Net Pay</th>
                <th className="py-3 px-3 text-center">Release Status</th>
                <th className="py-3 px-3 text-center">Lock Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400 font-medium">
                    Loading payroll runs from database...
                  </td>
                </tr>
              ) : runs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400 font-medium">
                    No payroll runs found. Click Generate Payroll to create a batch.
                  </td>
                </tr>
              ) : (
                runs.map((run) => (
                  <tr key={run.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">{run.payroll_run_number}</td>
                    <td className="py-3.5 px-3 font-bold text-slate-800 dark:text-slate-100">{run.pay_period}</td>
                    <td className="py-3.5 px-3 text-center">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/80 uppercase tracking-wider">
                        {run.payroll_type || 'REGULAR'}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono font-semibold text-slate-700 dark:text-slate-300">{run.total_employees}</td>
                    <td className="py-3.5 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                      ₹{(parseFloat(String(run.total_gross_payout)) || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono text-rose-500">
                      ₹{(parseFloat(String(run.total_deductions)) || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      ₹{(parseFloat(String(run.total_net_payout)) || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className={`px-2.5 py-0.5 rounded text-xs font-semibold ${
                        run.status === 'RELEASED'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                      }`}>
                        {run.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      {run.is_locked ? (
                        <span className="text-xs font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950 px-2 py-0.5 rounded">
                          🔒 Locked
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded">
                          🔓 Unlocked
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <button
                        onClick={() => handleOpenReleaseDrawer(run.pay_period)}
                        className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
                      >
                        Release & Enable →
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right SlideDrawer Matching Reference Image */}
      <SlideDrawer
        isOpen={releaseDrawerOpen}
        onClose={() => setReleaseDrawerOpen(false)}
        title={`Release Payroll - ${selectedPeriod}`}
      >
        <div className="space-y-5 text-left font-sans">
          
          {/* Company Filter */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Company</label>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectAllCompany}
                  onChange={(e) => setSelectAllCompany(e.target.checked)}
                  className="rounded text-indigo-600"
                />
                <span>Select All Company</span>
              </label>
            </div>
            <SearchableSelect
              options={[{ value: 'ALL', label: 'ALL Companies' }, ...companies.map(c => ({ value: c.id, label: c.name }))]}
              value={drawerCompanyId}
              onChange={setDrawerCompanyId}
              placeholder="Select company..."
            />
          </div>

          {/* Branch Filter */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Branch</label>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectAllBranch}
                  onChange={(e) => setSelectAllBranch(e.target.checked)}
                  className="rounded text-indigo-600"
                />
                <span>Select All Branch</span>
              </label>
            </div>
            <SearchableSelect
              options={[{ value: 'ALL', label: 'ALL Branches' }, ...branches.map(b => ({ value: b.id, label: b.name }))]}
              value={drawerBranchId}
              onChange={setDrawerBranchId}
              placeholder="Select branch..."
            />
          </div>

          {/* Department Filter */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Department</label>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectAllDept}
                  onChange={(e) => setSelectAllDept(e.target.checked)}
                  className="rounded text-indigo-600"
                />
                <span>Select All Dept</span>
              </label>
            </div>
            <SearchableSelect
              options={[{ value: 'ALL', label: 'ALL Departments' }, ...departments.map(d => ({ value: d.id, label: d.name }))]}
              value={drawerDeptId}
              onChange={setDrawerDeptId}
              placeholder="Select department..."
            />
          </div>

          {/* Employees Checklist */}
          <div className="space-y-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Employees ({enabledCountTotal} / {drawerEmployees.length} Enabled)
              </label>
            </div>

            <input
              type="text"
              placeholder="Search employee..."
              value={employeeSearchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs outline-none focus:border-indigo-500 font-medium"
            />

            {/* Employee Cards List */}
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {drawerEmployees.map(emp => {
                const isSelected = !!selectedEmployeesState[emp.id];

                return (
                  <div
                    key={emp.id}
                    onClick={() => toggleEmployeeSelection(emp.id)}
                    className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'border-indigo-200 bg-indigo-50/60 dark:border-indigo-900 dark:bg-indigo-950/40'
                        : 'border-slate-200 bg-slate-50/40 dark:border-slate-800 dark:bg-slate-900/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="h-8 w-8 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                        {(emp.first_name || 'E')[0]}
                      </span>
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">
                          {emp.first_name} {emp.last_name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono block">
                          ID: {emp.emp_id || '10001'} • {emp.department_name || 'Department'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center">
                      {isSelected ? (
                        <span className="h-6 w-6 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs">
                          ✓
                        </span>
                      ) : (
                        <span className="h-6 w-6 rounded-full border-2 border-slate-300 dark:border-slate-700" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setReleaseDrawerOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveReleasePayroll}
              disabled={actionLoading === 'save_release'}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md cursor-pointer"
            >
              <span>{actionLoading === 'save_release' ? 'Saving...' : 'Save / Update'}</span>
            </button>
          </div>
        </div>
      </SlideDrawer>
    </div>
  );
}
