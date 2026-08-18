'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardPageHeader from '../../components/DashboardPageHeader';
import SearchableSelect from '../../components/SearchableSelect';
import { useDashboard } from '../../components/DashboardContext';
import { getHeaders } from '../../utils/api';
import { 
  Calendar, 
  Settings, 
  RotateCcw, 
  Zap, 
  AlertTriangle, 
  Users, 
  Building2, 
  GitBranch, 
  Layers, 
  UserCheck, 
  Sparkles,
  ArrowRight,
  ShieldAlert
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
  emp_id?: string;
  emp_id_code?: string;
  first_name: string;
  last_name: string;
  department_name?: string;
  designation_name?: string;
  branch_name?: string;
  branch_id?: string;
  department_id?: string;
  basic_salary?: number;
}

export default function GeneratePayrollPage() {
  const router = useRouter();
  const { showToast } = useDashboard();

  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);

  // DYNAMIC MONTHS GENERATION (Calculates past 12 months dynamically from system clock)
  const generateDynamicMonths = () => {
    const months = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const monthStr = String(d.getMonth() + 1).padStart(2, '0');
      const monthName = d.toLocaleString('en-US', { month: 'long' });
      months.push({
        value: `${year}-${monthStr}`,
        label: `${monthName} ${year}`
      });
    }
    return months;
  };

  const dynamicMonthOptions = generateDynamicMonths();

  // Wizard Filters
  const [payPeriod, setPayPeriod] = useState(dynamicMonthOptions[0].value);
  const [payrollType, setPayrollType] = useState('REGULAR');
  
  // Cutoff Cycle Days & Calculated Dates
  const [cycleStartDay, setCycleStartDay] = useState<number>(26);
  const [cycleEndDay, setCycleEndDay] = useState<number>(25);
  const [attendanceStartDate, setAttendanceStartDate] = useState('');
  const [attendanceEndDate, setAttendanceEndDate] = useState('');

  const getCycleValidationError = (start: number, end: number): string | null => {
    if (!start || !end) return 'Please enter valid start and end day numbers (1-31).';
    if (start < 1 || start > 31) return 'Cycle start day must be between 1 and 31.';
    if (end < 1 || end > 31) return 'Cycle end day must be between 1 and 31.';

    if (start === 1) {
      if (end < 28) {
        return `When start day is 1, end day must be 28, 29, 30, or 31 (full monthly cycle).`;
      }
    } else {
      if (end >= start) {
        return `When start day is ${start} (cross-month), end day must be ${start - 1} or below (e.g., ${start} to ${start - 1}).`;
      }
    }
    return null;
  };

  // Auto calculate start and end dates whenever payPeriod, cycleStartDay or cycleEndDay changes
  useEffect(() => {
    if (!payPeriod) return;
    const [yearStr, monthStr] = payPeriod.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);

    const startD = Math.max(1, Math.min(31, cycleStartDay || 1));
    const endD = Math.max(1, Math.min(31, cycleEndDay || 31));

    if (startD === 1 && (endD >= 28 || endD === 31)) {
      const start = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDayOfM = new Date(year, month, 0).getDate();
      const actualEndD = Math.min(endD, lastDayOfM);
      const end = `${year}-${String(month).padStart(2, '0')}-${String(actualEndD).padStart(2, '0')}`;
      setAttendanceStartDate(start);
      setAttendanceEndDate(end);
    } else if (startD > endD) {
      const prevDate = new Date(year, month - 2, startD);
      const prevYear = prevDate.getFullYear();
      const prevMonth = prevDate.getMonth() + 1;
      const prevLastDay = new Date(prevYear, prevMonth, 0).getDate();
      const actualStartD = Math.min(startD, prevLastDay);
      const start = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(actualStartD).padStart(2, '0')}`;

      const currLastDay = new Date(year, month, 0).getDate();
      const actualEndD = Math.min(endD, currLastDay);
      const end = `${year}-${String(month).padStart(2, '0')}-${String(actualEndD).padStart(2, '0')}`;
      setAttendanceStartDate(start);
      setAttendanceEndDate(end);
    } else {
      const currLastDay = new Date(year, month, 0).getDate();
      const actualStartD = Math.min(startD, currLastDay);
      const actualEndD = Math.min(endD, currLastDay);
      const start = `${year}-${String(month).padStart(2, '0')}-${String(actualStartD).padStart(2, '0')}`;
      const end = `${year}-${String(month).padStart(2, '0')}-${String(actualEndD).padStart(2, '0')}`;
      setAttendanceStartDate(start);
      setAttendanceEndDate(end);
    }
  }, [payPeriod, cycleStartDay, cycleEndDay]);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Filter selections (Default to 'ALL')
  const [selectedBranchId, setSelectedBranchId] = useState('ALL');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('ALL');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('ALL');

  const [isGenerating, setIsGenerating] = useState(false);
  const [progressStep, setProgressStep] = useState(0);

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
    fetchAuxiliaryData();
  }, [companyId, isSuperAdmin]);

  const fetchAuxiliaryData = async () => {
    try {
      if (isSuperAdmin) {
        const cRes = await fetch('/api/v1/companies', { headers: getHeaders() });
        const cData = await cRes.json();
        if (cRes.ok) setCompanies(cData.companies || []);
      }

      let urlSuffix = companyId ? `?companyId=${companyId}` : '';
      const deptRes = await fetch(`/api/v1/departments${urlSuffix}`, { headers: getHeaders() });
      const deptData = await deptRes.json();
      if (deptRes.ok) setDepartments(deptData.departments || []);

      const branchRes = await fetch(`/api/v1/branches${urlSuffix}`, { headers: getHeaders() });
      const branchData = await branchRes.json();
      if (branchRes.ok) setBranches(branchData.branches || []);

      const empRes = await fetch(`/api/v1/employees${urlSuffix}`, { headers: getHeaders() });
      const empData = await empRes.json();
      if (empRes.ok) setEmployees(empData.employees || []);

      // Fetch Attendance Policy for default cutoff cycle days
      if (companyId) {
        const polRes = await fetch(`/api/v1/attendance/policies?companyId=${companyId}`, { headers: getHeaders() });
        const polData = await polRes.json();
        if (polRes.ok && polData.policy) {
          if (polData.policy.cycle_start_day) setCycleStartDay(polData.policy.cycle_start_day);
          if (polData.policy.cycle_end_day) setCycleEndDay(polData.policy.cycle_end_day);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCompanyChange = (id: string) => {
    const val = id || null;
    setCompanyId(val);
    if (val) localStorage.setItem('companyId', val);
    else localStorage.removeItem('companyId');
    setSelectedBranchId('ALL');
    setSelectedDepartmentId('ALL');
    setSelectedEmployeeId('ALL');
  };

  // CASCADING LOGIC: Filter employees dynamically based on Branch & Department selections
  const filteredEmployees = employees.filter(emp => {
    if (selectedBranchId !== 'ALL' && emp.branch_id && emp.branch_id !== selectedBranchId) return false;
    if (selectedDepartmentId !== 'ALL' && emp.department_id && emp.department_id !== selectedDepartmentId) return false;
    return true;
  });

  const handleBranchSelect = (branchId: string) => {
    setSelectedBranchId(branchId);
    setSelectedEmployeeId('ALL');
  };

  const handleDepartmentSelect = (deptId: string) => {
    setSelectedDepartmentId(deptId);
    setSelectedEmployeeId('ALL');
  };

  const handleEmployeeSelect = (empId: string) => {
    setSelectedEmployeeId(empId);
    if (empId !== 'ALL') {
      const emp = employees.find(e => e.id === empId);
      if (emp) {
        if (emp.branch_id) setSelectedBranchId(emp.branch_id);
        if (emp.department_id) setSelectedDepartmentId(emp.department_id);
      }
    }
  };

  const getDerivedScopeLabel = () => {
    if (selectedEmployeeId !== 'ALL') return 'Single Employee';
    if (selectedDepartmentId !== 'ALL') return 'Department Wise';
    if (selectedBranchId !== 'ALL') return 'Branch Wise';
    return 'Entire Company';
  };

  const matchedList = selectedEmployeeId !== 'ALL'
    ? employees.filter(e => e.id === selectedEmployeeId)
    : filteredEmployees;

  const handleStartGeneration = async () => {
    const cycleErr = getCycleValidationError(cycleStartDay, cycleEndDay);
    if (cycleErr) {
      showToast(cycleErr, 'error');
      return;
    }

    const scope = selectedEmployeeId !== 'ALL' ? 'SINGLE_EMPLOYEE' : selectedDepartmentId !== 'ALL' ? 'DEPARTMENT' : selectedBranchId !== 'ALL' ? 'BRANCH' : 'ALL';

    setIsGenerating(true);
    setProgressStep(1);

    const stepInterval = setInterval(() => {
      setProgressStep((prev) => (prev < 4 ? prev + 1 : prev));
    }, 650);

    try {
      const res = await fetch('/api/v1/payroll/generate', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          pay_period: payPeriod,
          payroll_type: payrollType,
          attendance_start_date: attendanceStartDate,
          attendance_end_date: attendanceEndDate,
          scope,
          branch_id: selectedBranchId !== 'ALL' ? selectedBranchId : null,
          department_id: selectedDepartmentId !== 'ALL' ? selectedDepartmentId : null,
          employee_id: selectedEmployeeId !== 'ALL' ? selectedEmployeeId : null,
          companyId
        })
      });

      clearInterval(stepInterval);
      const data = await res.json();

      if (res.ok) {
        showToast('🎉 Payroll batch generated successfully from Database! Redirecting to Payroll Hub...', 'success');
        setTimeout(() => {
          router.push('/dashboard/payroll');
        }, 1200);
      } else {
        showToast(data.error || 'Failed to generate payroll', 'error');
        setIsGenerating(false);
      }
    } catch (err) {
      clearInterval(stepInterval);
      showToast('Connection error generating payroll', 'error');
      setIsGenerating(false);
    }
  };

  const companyOptions = [
    { value: 'ALL', label: '🌐 All Companies (Global Scope)' },
    ...companies.map(c => ({ value: c.id, label: `🏢 ${c.name}` }))
  ];

  const branchOptions = [
    { value: 'ALL', label: `All Branches (${branches.length})` },
    ...branches.map(b => ({ value: b.id, label: `${b.name}` }))
  ];

  const departmentOptions = [
    { value: 'ALL', label: `All Departments (${departments.length})` },
    ...departments.map(d => ({ value: d.id, label: `${d.name}` }))
  ];

  const employeeOptions = [
    { value: 'ALL', label: `All Employees (${filteredEmployees.length})` },
    ...filteredEmployees.map((emp, idx) => ({
      value: emp.id,
      label: `${emp.emp_id_code || emp.emp_id || (10001 + idx)} - ${emp.first_name || ''} ${emp.last_name || ''}`.trim()
    }))
  ];

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="payroll-generate-container space-y-4 animate-fadeIn w-full pb-20 text-left">
      <DashboardPageHeader
        title="Payroll Generation Engine"
        actionMessage=""
        actionError=""
        companies={companies}
        companyId={companyId}
        handleCompanyChange={handleCompanyChange}
        isSuperAdmin={isSuperAdmin}
        email={email}
        hideCompanySelect={!isSuperAdmin}
        hideUserBadge={true}
      />

      {/* Card 1: Cycle Dates Card */}
      <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shrink-0">
              <Calendar size={16} className="w-4 h-4 shrink-0" />
            </span>
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <span>Cycle Dates & Cutoff Schedule</span>
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">Configure monthly attendance cutoff start and end day numbers</p>
            </div>
          </div>

          <div className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80 text-xs font-bold">
            Calculated Period: <span className="font-extrabold font-mono text-indigo-700 dark:text-indigo-200">{attendanceStartDate || '---'}</span> to <span className="font-extrabold font-mono text-indigo-700 dark:text-indigo-200">{attendanceEndDate || '---'}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
          {/* Payroll Cycle Start Date (Day) */}
          <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40 space-y-1.5 hover:border-indigo-300 transition-colors">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
              <span>Payroll Cycle Start Date (Day)</span>
              <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min={1}
              max={31}
              value={cycleStartDay}
              onChange={(e) => setCycleStartDay(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500 font-mono"
            />
            <p className="text-[10px] text-slate-400 font-medium">Day of month when cycle starts (1-31)</p>
          </div>

          {/* Payroll Cycle End Date (Day) */}
          <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40 space-y-1.5 hover:border-indigo-300 transition-colors">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
              <span>Payroll Cycle End Date (Day)</span>
              <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min={1}
              max={31}
              value={cycleEndDay}
              onChange={(e) => setCycleEndDay(parseInt(e.target.value) || 31)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500 font-mono"
            />
            <p className="text-[10px] text-slate-400 font-medium">
              Day of month when cycle ends (1-31). Cross-month support enabled (e.g. 26 to 25)
            </p>
          </div>
        </div>

        {getCycleValidationError(cycleStartDay, cycleEndDay) && (
          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs font-semibold">
            <AlertTriangle size={14} className="w-3.5 h-3.5 flex-shrink-0 text-amber-500 shrink-0" />
            <span>{getCycleValidationError(cycleStartDay, cycleEndDay)}</span>
          </div>
        )}
      </div>

      {/* Card 2: Main Controls Card */}
      <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-2xs space-y-4">
        
        {/* Header Title with Reset Button */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold border border-indigo-200 dark:border-indigo-800">
                Scope: {getDerivedScopeLabel()}
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold border border-emerald-200 dark:border-emerald-800">
                {matchedList.length} Staff Selected
              </span>
            </div>
            <h2 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight mt-1 flex items-center gap-1.5">
              <Settings size={14} className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>Configure Payroll Parameters</span>
            </h2>
          </div>

          {(selectedBranchId !== 'ALL' || selectedDepartmentId !== 'ALL' || selectedEmployeeId !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSelectedBranchId('ALL');
                setSelectedDepartmentId('ALL');
                setSelectedEmployeeId('ALL');
              }}
              className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 bg-rose-50 dark:bg-rose-950/50 px-3 py-1 rounded-lg border border-rose-200 dark:border-rose-900 transition-all cursor-pointer flex items-center gap-1"
            >
              <RotateCcw size={12} className="w-3 h-3 shrink-0" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        {/* CONTROLS ROW - 5 DYNAMIC CONTROLS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          
          {/* 1. Pay Period */}
          <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40 space-y-1.5 hover:border-indigo-300 transition-colors">
            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Calendar size={12} className="w-3 h-3 text-indigo-500 shrink-0" />
              <span>1. Pay Period</span>
            </label>
            <select
              value={payPeriod}
              onChange={(e) => setPayPeriod(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500 cursor-pointer font-sans"
            >
              {dynamicMonthOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {attendanceStartDate && attendanceEndDate && (
              <div className="pt-0.5 flex items-center justify-between text-[9px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/80 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-200/60 dark:border-indigo-800/40 font-mono">
                <span>From: {attendanceStartDate}</span>
                <span>To: {attendanceEndDate}</span>
              </div>
            )}
          </div>

          {/* 2. Payroll Type */}
          <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40 space-y-1.5 hover:border-indigo-300 transition-colors">
            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Sparkles size={12} className="w-3 h-3 text-indigo-500 shrink-0" />
              <span>2. Payroll Type</span>
            </label>
            <select
              value={payrollType}
              onChange={(e) => setPayrollType(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500 cursor-pointer font-sans"
            >
              <option value="REGULAR">Regular Payroll</option>
              <option value="BONUS">Annual Bonus</option>
              <option value="ARREARS">Arrears</option>
              <option value="OFF_CYCLE">Off-Cycle</option>
              <option value="FINAL_SETTLEMENT">Final Settlement (F&F)</option>
            </select>
          </div>

          {/* 3. Branch Filter */}
          <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40 space-y-1.5 hover:border-indigo-300 transition-colors">
            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <GitBranch size={12} className="w-3 h-3 text-indigo-500 shrink-0" />
              <span>3. Branch</span>
            </label>
            <SearchableSelect
              options={branchOptions}
              value={selectedBranchId}
              onChange={handleBranchSelect}
              placeholder="Search branch..."
            />
          </div>

          {/* 4. Department Filter */}
          <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40 space-y-1.5 hover:border-indigo-300 transition-colors">
            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Layers size={12} className="w-3 h-3 text-indigo-500 shrink-0" />
              <span>4. Department</span>
            </label>
            <SearchableSelect
              options={departmentOptions}
              value={selectedDepartmentId}
              onChange={handleDepartmentSelect}
              placeholder="Search department..."
            />
          </div>

          {/* 5. Employee Filter */}
          <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40 space-y-1.5 hover:border-indigo-300 transition-colors">
            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <UserCheck size={12} className="w-3 h-3 text-indigo-500 shrink-0" />
              <span>5. Employee</span>
            </label>
            <SearchableSelect
              options={employeeOptions}
              value={selectedEmployeeId}
              onChange={handleEmployeeSelect}
              placeholder="Search employee..."
            />
          </div>
        </div>

        {/* Action Button Bar */}
        <div className="pt-1 flex justify-end">
          {isGenerating ? (
            <div className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold shadow-md flex items-center justify-center gap-2.5 animate-pulse">
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Step {progressStep} of 4: Computing Payroll...</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleStartGeneration}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-extrabold shadow-sm hover:shadow-indigo-500/20 hover:-translate-y-0.5 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Zap size={14} className="w-3.5 h-3.5 fill-current stroke-0 shrink-0" />
              <span>Generate Payroll ({matchedList.length} Staff)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
