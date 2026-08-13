'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardPageHeader from '../../components/DashboardPageHeader';
import SearchableSelect from '../../components/SearchableSelect';
import { useDashboard } from '../../components/DashboardContext';
import { getHeaders } from '../../utils/api';

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
        const cRes = await fetch('http://localhost:5000/api/v1/companies', { headers: getHeaders() });
        const cData = await cRes.json();
        if (cRes.ok) setCompanies(cData.companies || []);
      }

      let urlSuffix = companyId ? `?companyId=${companyId}` : '';
      const deptRes = await fetch(`http://localhost:5000/api/v1/departments${urlSuffix}`, { headers: getHeaders() });
      const deptData = await deptRes.json();
      if (deptRes.ok) setDepartments(deptData.departments || []);

      const branchRes = await fetch(`http://localhost:5000/api/v1/branches${urlSuffix}`, { headers: getHeaders() });
      const branchData = await branchRes.json();
      if (branchRes.ok) setBranches(branchData.branches || []);

      const empRes = await fetch(`http://localhost:5000/api/v1/employees${urlSuffix}`, { headers: getHeaders() });
      const empData = await empRes.json();
      if (empRes.ok) setEmployees(empData.employees || []);

      // Fetch Attendance Policy for default cutoff cycle days
      if (companyId) {
        const polRes = await fetch(`http://localhost:5000/api/v1/attendance/policies?companyId=${companyId}`, { headers: getHeaders() });
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
      const res = await fetch('http://localhost:5000/api/v1/payroll/generate', {
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
    <div style={{ fontFamily: "'DM Sans', sans-serif" }} className="payroll-generate-container font-sans space-y-6 animate-fadeIn w-full pb-24 text-left">
      <style dangerouslySetInnerHTML={{__html: `
        .payroll-generate-container,
        .payroll-generate-container button,
        .payroll-generate-container input,
        .payroll-generate-container select,
        .payroll-generate-container label,
        .payroll-generate-container span,
        .payroll-generate-container div,
        .payroll-generate-container p,
        .payroll-generate-container th,
        .payroll-generate-container td {
          font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        }
      `}} />

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

      {/* Card 1: Cycle Dates Card (Matching Screenshot Design) */}
      <div className="bg-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-4 font-sans">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight">Cycle Dates</h3>
              <p className="text-[11px] text-slate-400 font-medium">Configure monthly attendance cutoff start and end day numbers</p>
            </div>
          </div>
          <div className="px-3.5 py-1.5 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-xs font-bold font-sans">
            Calculated Period: <span className="font-extrabold">{attendanceStartDate || '---'}</span> to <span className="font-extrabold">{attendanceEndDate || '---'}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          {/* Payroll Cycle Start Date (Day) */}
          <div className="p-3.5 rounded-xl border border-blue-500/40 dark:border-blue-500/40 bg-blue-50/10 dark:bg-blue-950/10 shadow-sm space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Payroll Cycle Start Date (Day) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min={1}
              max={31}
              value={cycleStartDay}
              onChange={(e) => setCycleStartDay(parseInt(e.target.value) || 1)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 transition-all font-sans"
            />
            <p className="text-[10px] text-slate-400 font-medium">Day of month when cycle starts (1-31)</p>
          </div>

          {/* Payroll Cycle End Date (Day) */}
          <div className="p-3.5 rounded-xl border border-blue-500/40 dark:border-blue-500/40 bg-blue-50/10 dark:bg-blue-950/10 shadow-sm space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Payroll Cycle End Date (Day) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min={1}
              max={31}
              value={cycleEndDay}
              onChange={(e) => setCycleEndDay(parseInt(e.target.value) || 31)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 transition-all font-sans"
            />
            <p className="text-[10px] text-slate-400 font-medium">
              Day of month when cycle ends (1-31). Use cross-month cycle (e.g., 26-25 means Nov 26 to Dec 25)
            </p>
          </div>
        </div>

        {getCycleValidationError(cycleStartDay, cycleEndDay) && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-semibold">
            <svg className="w-4 h-4 flex-shrink-0 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <span>{getCycleValidationError(cycleStartDay, cycleEndDay)}</span>
          </div>
        )}
      </div>

      {/* Card 2: Main Single Row Controls Card */}
      <div className="bg-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-6">
        
        {/* Header Title with Reset Button */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-[10.5px] font-bold border border-indigo-200 dark:border-indigo-800">
                Scope: {getDerivedScopeLabel()}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 text-[10.5px] font-bold border border-emerald-200 dark:border-emerald-800">
                {matchedList.length} Staff Selected
              </span>
            </div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 tracking-tight mt-1">
              Configure Payroll Parameters
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
              className="text-xs font-semibold text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900 transition-all cursor-pointer"
            >
              ✕ Reset Filters
            </button>
          )}
        </div>

        {/* CONTROLS ROW - 5 DYNAMIC CONTROLS (WITHOUT COMPANY) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          
          {/* 1. Pay Period */}
          <div className="p-3.5 rounded-xl border border-blue-500/40 dark:border-blue-500/40 bg-blue-50/10 dark:bg-blue-950/10 shadow-sm space-y-1.5">
            <label className="block text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
              1. Pay Period
            </label>
            <select
              value={payPeriod}
              onChange={(e) => setPayPeriod(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 transition-all cursor-pointer font-sans"
            >
              {dynamicMonthOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {attendanceStartDate && attendanceEndDate && (
              <div className="pt-1 flex items-center justify-between text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/40 px-2 py-1 rounded-lg border border-indigo-200/60 dark:border-indigo-800/40">
                <span>From: <strong className="font-extrabold">{attendanceStartDate}</strong></span>
                <span>To: <strong className="font-extrabold">{attendanceEndDate}</strong></span>
              </div>
            )}
          </div>

          {/* 2. Payroll Type */}
          <div className="p-3.5 rounded-xl border border-blue-500/40 dark:border-blue-500/40 bg-blue-50/10 dark:bg-blue-950/10 shadow-sm space-y-1.5">
            <label className="block text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
              2. Payroll Type
            </label>
            <select
              value={payrollType}
              onChange={(e) => setPayrollType(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 transition-all cursor-pointer font-sans"
            >
              <option value="REGULAR">Regular Payroll</option>
              <option value="BONUS">Annual Bonus</option>
              <option value="ARREARS">Arrears</option>
              <option value="OFF_CYCLE">Off-Cycle</option>
              <option value="FINAL_SETTLEMENT">Final Settlement (F&F)</option>
            </select>
          </div>

          {/* 3. Branch Filter */}
          <div className="p-3.5 rounded-xl border border-blue-500/40 dark:border-blue-500/40 bg-blue-50/10 dark:bg-blue-950/10 shadow-sm space-y-1.5">
            <label className="block text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
              3. Branch
            </label>
            <SearchableSelect
              options={branchOptions}
              value={selectedBranchId}
              onChange={handleBranchSelect}
              placeholder="Search branch..."
            />
          </div>

          {/* 4. Department Filter */}
          <div className="p-3.5 rounded-xl border border-blue-500/40 dark:border-blue-500/40 bg-blue-50/10 dark:bg-blue-950/10 shadow-sm space-y-1.5">
            <label className="block text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
              4. Department
            </label>
            <SearchableSelect
              options={departmentOptions}
              value={selectedDepartmentId}
              onChange={handleDepartmentSelect}
              placeholder="Search department..."
            />
          </div>

          {/* 5. Employee Filter */}
          <div className="p-3.5 rounded-xl border border-blue-500/40 dark:border-blue-500/40 bg-blue-50/10 dark:bg-blue-950/10 shadow-sm space-y-1.5">
            <label className="block text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
              5. Employee
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
        <div className="pt-2 flex justify-end">
          {isGenerating ? (
            <div className="px-8 py-3 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-lg flex items-center justify-center gap-3 animate-pulse">
              <span className="h-2.5 w-2.5 rounded-full bg-white animate-spin" />
              <span>Step {progressStep} of 4: Computing Payroll from Database...</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleStartGeneration}
              className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Generate Payroll ({matchedList.length} Staff)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
