'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import DashboardPageHeader from '../../components/DashboardPageHeader';
import SearchableSelect from '../../components/SearchableSelect';
import { useDashboard } from '../../components/DashboardContext';
import { usePermissions } from '../../hooks/usePermissions';
import { getHeaders, getUrl } from '../../utils/api';
import { 
  Calendar, 
  RotateCcw, 
  Zap, 
  AlertTriangle, 
  GitBranch, 
  Layers, 
  UserCheck, 
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Clock,
  Sliders,
  CheckCircle2,
  CalendarDays,
  ChevronRight,
  Info,
  Building2
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
  status?: string;
  exit_date?: string;
  joining_date?: string;
  resignation_date?: string;
  department_name?: string;
  designation_name?: string;
  branch_name?: string;
  branch_id?: string;
  department_id?: string;
  basic_salary?: number;
}

export default function GeneratePayrollPage() {
  const router = useRouter();
  const { showToast, companyId: globalCompanyId } = useDashboard();

  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);

  const activeCompanyId = globalCompanyId || companyId;

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
  const [payPeriod, setPayPeriod] = useState<string>(dynamicMonthOptions[0].value);
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

  const { hasPermission } = usePermissions();
  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('superadmin');
  const canView = isSuperAdmin || hasPermission('payroll_runs_view');
  const canCreate = isSuperAdmin || hasPermission('payroll_runs_create');

  useEffect(() => {
    const storedRoles = localStorage.getItem('roles');
    const storedEmail = localStorage.getItem('email');
    const storedPermissions = localStorage.getItem('permissions');
    if (storedRoles) setRoles(JSON.parse(storedRoles));
    if (storedEmail) setEmail(storedEmail);
    if (storedPermissions) setPermissions(JSON.parse(storedPermissions));
  }, []);

  useEffect(() => {
    fetchAuxiliaryData();
  }, [activeCompanyId, isSuperAdmin]);

  const fetchAuxiliaryData = async () => {
    try {
      if (isSuperAdmin) {
        const cRes = await fetch(getUrl('/api/v1/companies'), { headers: getHeaders() });
        const cData = await cRes.json();
        if (cRes.ok) setCompanies(cData.companies || []);
      }

      const cid = activeCompanyId || localStorage.getItem('companyId');
      const targetCid = cid && cid !== 'all' ? cid : null;
      const deptRes = await fetch(getUrl('/api/v1/departments', targetCid), { headers: getHeaders() });
      const deptData = await deptRes.json();
      if (deptRes.ok) setDepartments(deptData.departments || []);

      const branchRes = await fetch(getUrl('/api/v1/branches', targetCid), { headers: getHeaders() });
      const branchData = await branchRes.json();
      if (branchRes.ok) setBranches(branchData.branches || []);

      const empRes = await fetch(getUrl('/api/v1/employees', targetCid), { headers: getHeaders() });
      const empData = await empRes.json();
      if (empRes.ok) setEmployees(empData.employees || []);

      // Fetch Attendance Policy for default cutoff cycle days
      if (targetCid) {
        const polRes = await fetch(getUrl(`/api/v1/attendance/policies?companyId=${targetCid}`), { headers: getHeaders() });
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

  const normalizeDateStr = (raw?: string | null): string | null => {
    if (!raw) return null;
    const str = String(raw).trim();
    if (str.length >= 10 && str.includes('-')) {
      return str.slice(0, 10);
    }
    return null;
  };

  // CASCADING LOGIC: Filter employees dynamically based on Active Status, Mid-Cycle Exit Date, Branch & Department
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      // 1. ACTIVE & MID-CYCLE EXIT DATE ELIGIBILITY RULE:
      const empStatus = String(emp.status || 'ACTIVE').trim().toUpperCase();
      const exitDate = normalizeDateStr(emp.exit_date ?? (emp as any).exitDate ?? (emp as any).resignation_date ?? (emp as any).resignationDate);
      const joiningDate = normalizeDateStr(emp.joining_date ?? (emp as any).joiningDate);

      // Future joiner check: Exclude if joining date is after the attendance cycle end date
      if (joiningDate && attendanceEndDate && joiningDate > attendanceEndDate) {
        return false;
      }

      // Inactive / Exited employee check:
      if (empStatus === 'INACTIVE' || empStatus === 'EXITED' || empStatus === 'TERMINATED' || empStatus === 'RESIGNED' || exitDate !== null) {
        if (exitDate) {
          // Include ONLY if exitDate falls WITHIN the selected attendance cycle window [attendanceStartDate, attendanceEndDate]
          if (attendanceStartDate && attendanceEndDate) {
            if (exitDate < attendanceStartDate || exitDate > attendanceEndDate) {
              return false;
            }
          }
        } else {
          // Inactive without specified exit date -> exclude from current payroll
          return false;
        }
      }

      // 2. BRANCH FILTER:
      if (selectedBranchId !== 'ALL') {
        const bId = String(emp.branch_id ?? (emp as any).branchId ?? '').trim().toLowerCase();
        const bName = String((emp as any).branch_name ?? (emp as any).branchName ?? '').trim().toLowerCase();
        const selBranchIdStr = String(selectedBranchId).trim().toLowerCase();
        const matchedBranch = branches.find(b => String(b.id).trim().toLowerCase() === selBranchIdStr);
        const targetBranchName = matchedBranch ? matchedBranch.name.trim().toLowerCase() : '';

        const isBranchIdMatch = bId && (bId === selBranchIdStr || (matchedBranch && bId === String(matchedBranch.id).trim().toLowerCase()));
        const isBranchNameMatch = bName && (bName === selBranchIdStr || (targetBranchName && bName === targetBranchName));

        if (!isBranchIdMatch && !isBranchNameMatch) return false;
      }

      // 3. DEPARTMENT FILTER:
      if (selectedDepartmentId !== 'ALL') {
        const dId = String(emp.department_id ?? (emp as any).departmentId ?? '').trim().toLowerCase();
        const dName = String((emp as any).department_name ?? (emp as any).departmentName ?? '').trim().toLowerCase();
        const selDeptIdStr = String(selectedDepartmentId).trim().toLowerCase();
        const matchedDept = departments.find(d => String(d.id).trim().toLowerCase() === selDeptIdStr);
        const targetDeptName = matchedDept ? matchedDept.name.trim().toLowerCase() : '';

        const isDeptIdMatch = dId && (dId === selDeptIdStr || (matchedDept && dId === String(matchedDept.id).trim().toLowerCase()));
        const isDeptNameMatch = dName && (dName === selDeptIdStr || (targetDeptName && dName === targetDeptName));

        if (!isDeptIdMatch && !isDeptNameMatch) return false;
      }
      return true;
    });
  }, [employees, branches, departments, selectedBranchId, selectedDepartmentId, attendanceStartDate, attendanceEndDate]);

  // CASCADING BRANCHES: Show only branches that contain employees in selected Department
  const filteredBranches = useMemo(() => {
    if (selectedDepartmentId === 'ALL') return branches;
    const activeEmpsInDept = employees.filter(emp => {
      const dId = String(emp.department_id ?? (emp as any).departmentId ?? '').trim().toLowerCase();
      const dName = String((emp as any).department_name ?? (emp as any).departmentName ?? '').trim().toLowerCase();
      const selDeptIdStr = String(selectedDepartmentId).trim().toLowerCase();
      const matchedDept = departments.find(d => String(d.id).trim().toLowerCase() === selDeptIdStr);
      const targetDeptName = matchedDept ? matchedDept.name.trim().toLowerCase() : '';
      return (dId && (dId === selDeptIdStr || (matchedDept && dId === String(matchedDept.id).trim().toLowerCase()))) ||
             (dName && (dName === selDeptIdStr || (targetDeptName && dName === targetDeptName)));
    });

    const validBranchIdsOrNames = new Set(
      activeEmpsInDept.flatMap(emp => [
        String(emp.branch_id ?? (emp as any).branchId ?? '').trim().toLowerCase(),
        String((emp as any).branch_name ?? (emp as any).branchName ?? '').trim().toLowerCase()
      ]).filter(Boolean)
    );

    return branches.filter(b => 
      validBranchIdsOrNames.has(String(b.id).trim().toLowerCase()) ||
      validBranchIdsOrNames.has(String(b.name).trim().toLowerCase())
    );
  }, [branches, employees, departments, selectedDepartmentId]);

  // CASCADING DEPARTMENTS: Show only departments that contain employees in selected Branch
  const filteredDepartments = useMemo(() => {
    if (selectedBranchId === 'ALL') return departments;
    const activeEmpsInBranch = employees.filter(emp => {
      const bId = String(emp.branch_id ?? (emp as any).branchId ?? '').trim().toLowerCase();
      const bName = String((emp as any).branch_name ?? (emp as any).branchName ?? '').trim().toLowerCase();
      const selBranchIdStr = String(selectedBranchId).trim().toLowerCase();
      const matchedBranch = branches.find(b => String(b.id).trim().toLowerCase() === selBranchIdStr);
      const targetBranchName = matchedBranch ? matchedBranch.name.trim().toLowerCase() : '';
      return (bId && (bId === selBranchIdStr || (matchedBranch && bId === String(matchedBranch.id).trim().toLowerCase()))) ||
             (bName && (bName === selBranchIdStr || (targetBranchName && bName === targetBranchName)));
    });

    const validDeptIdsOrNames = new Set(
      activeEmpsInBranch.flatMap(emp => [
        String(emp.department_id ?? (emp as any).departmentId ?? '').trim().toLowerCase(),
        String((emp as any).department_name ?? (emp as any).departmentName ?? '').trim().toLowerCase()
      ]).filter(Boolean)
    );

    return departments.filter(d => 
      validDeptIdsOrNames.has(String(d.id).trim().toLowerCase()) ||
      validDeptIdsOrNames.has(String(d.name).trim().toLowerCase())
    );
  }, [departments, employees, branches, selectedBranchId]);

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
      const emp = employees.find(e => String(e.id) === String(empId));
      if (emp) {
        if (emp.branch_id) setSelectedBranchId(String(emp.branch_id));
        if (emp.department_id) setSelectedDepartmentId(String(emp.department_id));
      }
    }
  };

  const getDerivedScopeLabel = () => {
    if (selectedEmployeeId !== 'ALL') return 'Single Employee';
    if (selectedDepartmentId !== 'ALL') return 'Department Wise';
    if (selectedBranchId !== 'ALL') return 'Branch Wise';
    return 'Entire Company';
  };

  const getSelectedCompanyName = () => {
    if (!companyId) return null;
    const c = companies.find(comp => comp.id === companyId);
    return c ? c.name : 'Active Tenant Company';
  };

  const getSelectedBranchLabel = () => {
    if (selectedBranchId === 'ALL') return `All Branches (${branches.length})`;
    const b = branches.find(branch => branch.id === selectedBranchId);
    return b ? b.name : selectedBranchId;
  };

  const getSelectedDepartmentLabel = () => {
    if (selectedDepartmentId === 'ALL') return `All Departments (${departments.length})`;
    const d = departments.find(dept => dept.id === selectedDepartmentId);
    return d ? d.name : selectedDepartmentId;
  };

  const getSelectedEmployeeLabel = () => {
    if (selectedEmployeeId === 'ALL') return `All Employees (${filteredEmployees.length})`;
    const emp = employees.find(e => String(e.id) === String(selectedEmployeeId));
    if (!emp) return selectedEmployeeId;
    return `${emp.emp_id_code || emp.emp_id || ''} - ${emp.first_name || ''} ${emp.last_name || ''}`.trim();
  };

  const matchedList = selectedEmployeeId !== 'ALL'
    ? employees.filter(e => String(e.id) === String(selectedEmployeeId))
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
        showToast('🎉 Payroll batch generated successfully! Redirecting to Payroll Hub...', 'success');
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

  const branchOptions = [
    { value: 'ALL', label: `🏢 All Branches (${filteredBranches.length})` },
    ...filteredBranches.map(b => ({ value: b.id, label: `📍 ${b.name}` }))
  ];

  const departmentOptions = [
    { value: 'ALL', label: `📂 All Departments (${filteredDepartments.length})` },
    ...filteredDepartments.map(d => ({ value: d.id, label: `📁 ${d.name}` }))
  ];

  const employeeOptions = [
    { value: 'ALL', label: `👥 All Employees (${filteredEmployees.length})` },
    ...filteredEmployees.map((emp: Employee, idx: number) => ({
      value: emp.id,
      label: `👤 ${emp.emp_id_code || emp.emp_id || (10001 + idx)} - ${emp.first_name || ''} ${emp.last_name || ''}`.trim()
    }))
  ];

  const formatDateWithMonthName = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;
    const day = parseInt(parts[2]);
    const d = new Date(year, month, day);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Helper preset setters
  const applyPresetCutoff = (start: number, end: number) => {
    setCycleStartDay(start);
    setCycleEndDay(end);
  };

  if (roles.length > 0 && !canView) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center p-6 animate-fadeIn">
        <div className="h-16 w-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4 text-3xl">
          🔒
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Access Denied</h3>
        <p className="text-slate-500 dark:text-slate-400 text-xs mt-1.5 max-w-sm">
          You do not have the required permissions to access the Payroll Generation Engine. Please contact your administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 pb-24 text-left animate-fadeIn">
      {/* PAGE HEADER & TOP BREADCRUMB */}
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

      {/* 🚀 MAIN WIZARD CONTAINER */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* LEFT & CENTER COLUMN (2/3): PARAMETERS & SCOPE SELECTION */}
        <div className="lg:col-span-2 space-y-6">

          {/* STEP 1: PAY PERIOD & ATTENDANCE CUTOFF CYCLE */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-7 shadow-xs hover:shadow-md transition-shadow space-y-6">
            
            {/* Step Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-4">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-sm shrink-0">
                  01
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                    Pay Period & Attendance Cycle
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Select the target payroll month and set attendance cutoff days</p>
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50/80 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-semibold border border-indigo-100 dark:border-indigo-900/40">
                <Clock className="w-3.5 h-3.5 text-indigo-500" />
                <span>Monthly Cutoff</span>
              </div>
            </div>

            {/* Main Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              
              {/* Target Pay Period */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-indigo-500" />
                  <span>Target Pay Period <span className="text-rose-500">*</span></span>
                </label>
                <div className="relative">
                  <select
                    value={payPeriod}
                    onChange={(e) => setPayPeriod(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/50 text-xs font-bold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer appearance-none pr-8"
                  >
                    {dynamicMonthOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <ChevronRight className="w-4 h-4 rotate-90" />
                  </div>
                </div>
              </div>

              {/* Payroll Type */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  <span>Payroll Processing Type <span className="text-rose-500">*</span></span>
                </label>
                <div className="relative">
                  <select
                    value={payrollType}
                    onChange={(e) => setPayrollType(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/50 text-xs font-bold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer appearance-none pr-8"
                  >
                    <option value="REGULAR">Regular Monthly Payroll</option>
                    <option value="BONUS">Annual Bonus Disbursement</option>
                    <option value="ARREARS">Salary Arrears Processing</option>
                    <option value="OFF_CYCLE">Off-Cycle Payroll Run</option>
                    <option value="FINAL_SETTLEMENT">Final Settlement (F&F)</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <ChevronRight className="w-4 h-4 rotate-90" />
                  </div>
                </div>
              </div>
            </div>

            {/* INTEGRATED CALCULATED ATTENDANCE WINDOW & EDITABLE CUTOFF DAYS CARD */}
            <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-indigo-50/90 via-purple-50/40 to-indigo-50/90 dark:from-indigo-950/50 dark:via-purple-950/30 dark:to-indigo-950/50 border border-indigo-200/90 dark:border-indigo-800/80 space-y-4 shadow-xs">
              
              {/* Card Header & Presets */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-200/60 dark:border-indigo-800/60 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Clock className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-indigo-950 dark:text-indigo-100 flex items-center gap-1.5">
                      <span>Calculated Attendance Window</span>
                    </h4>
                    <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80 font-medium">
                      Attendance logs will be calculated between these two dates
                    </p>
                  </div>
                </div>

                {/* Presets */}
                <div className="flex items-center gap-1.5 flex-wrap text-[11px] shrink-0">
                  <span className="text-indigo-800/70 dark:text-indigo-300/70 font-bold text-[10px]">Presets:</span>
                  <button
                    type="button"
                    onClick={() => applyPresetCutoff(26, 25)}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all border cursor-pointer ${
                      cycleStartDay === 26 && cycleEndDay === 25
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white/80 dark:bg-slate-900/80 text-indigo-900 dark:text-indigo-200 border-indigo-200/80 dark:border-indigo-800/80 hover:bg-white'
                    }`}
                  >
                    26th – 25th
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPresetCutoff(1, 31)}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all border cursor-pointer ${
                      cycleStartDay === 1 && cycleEndDay === 31
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white/80 dark:bg-slate-900/80 text-indigo-900 dark:text-indigo-200 border-indigo-200/80 dark:border-indigo-800/80 hover:bg-white'
                    }`}
                  >
                    1st – 31st
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPresetCutoff(21, 20)}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all border cursor-pointer ${
                      cycleStartDay === 21 && cycleEndDay === 20
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white/80 dark:bg-slate-900/80 text-indigo-900 dark:text-indigo-200 border-indigo-200/80 dark:border-indigo-800/80 hover:bg-white'
                    }`}
                  >
                    21st – 20th
                  </button>
                </div>
              </div>

              {/* Editable Days & Live Computed Date Range Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 items-center pt-1">
                
                {/* Start Day Edit Input */}
                <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-between shadow-2xs">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Cycle Start Day:</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={cycleStartDay}
                      onChange={(e) => setCycleStartDay(parseInt(e.target.value) || 1)}
                      className="w-14 px-2 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/60 text-xs font-black text-indigo-700 dark:text-indigo-300 outline-none focus:ring-2 focus:ring-indigo-500/30 text-center font-mono"
                    />
                    <span className="text-[11px] text-slate-500 font-medium">of start</span>
                  </div>
                </div>

                {/* End Day Edit Input */}
                <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-between shadow-2xs">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Cycle End Day:</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={cycleEndDay}
                      onChange={(e) => setCycleEndDay(parseInt(e.target.value) || 31)}
                      className="w-14 px-2 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/60 text-xs font-black text-indigo-700 dark:text-indigo-300 outline-none focus:ring-2 focus:ring-indigo-500/30 text-center font-mono"
                    />
                    <span className="text-[11px] text-slate-500 font-medium">of end</span>
                  </div>
                </div>

                {/* Calculated Result Badge */}
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800/90 flex items-center justify-center gap-2 font-mono text-xs font-black text-indigo-700 dark:text-indigo-300 shadow-2xs">
                  <span>{formatDateWithMonthName(attendanceStartDate) || '---'}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span>{formatDateWithMonthName(attendanceEndDate) || '---'}</span>
                </div>
              </div>

              {getCycleValidationError(cycleStartDay, cycleEndDay) && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/80 text-rose-700 dark:text-rose-300 text-xs font-semibold">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{getCycleValidationError(cycleStartDay, cycleEndDay)}</span>
                </div>
              )}
            </div>
          </div>

          {/* STEP 2: TARGET SCOPE & EMPLOYEE SELECTION */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-7 shadow-xs hover:shadow-md transition-shadow space-y-6">
            
            {/* Step Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-4">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-sm shrink-0">
                  02
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                    Target Execution Scope & Filters
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Filter payroll computation by Branch, Department, or Individual Employee</p>
                </div>
              </div>

              {(selectedBranchId !== 'ALL' || selectedDepartmentId !== 'ALL' || selectedEmployeeId !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBranchId('ALL');
                    setSelectedDepartmentId('ALL');
                    setSelectedEmployeeId('ALL');
                  }}
                  className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 bg-rose-50 dark:bg-rose-950/50 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Filters</span>
                </button>
              )}
            </div>

            {/* Scope Filter Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {/* Branch Filter */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <GitBranch className="w-4 h-4 text-indigo-500" />
                  <span>Branch Office</span>
                </label>
                <SearchableSelect
                  options={branchOptions}
                  value={selectedBranchId}
                  onChange={handleBranchSelect}
                  placeholder="Search branch..."
                />
              </div>

              {/* Department Filter */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-500" />
                  <span>Department</span>
                </label>
                <SearchableSelect
                  options={departmentOptions}
                  value={selectedDepartmentId}
                  onChange={handleDepartmentSelect}
                  placeholder="Search department..."
                />
              </div>

              {/* Employee Filter */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-indigo-500" />
                  <span>Specific Employee</span>
                </label>
                <SearchableSelect
                  options={employeeOptions}
                  value={selectedEmployeeId}
                  onChange={handleEmployeeSelect}
                  placeholder="Search employee..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (1/3): EXECUTION SUMMARY & RUN CARD */}
        <div className="space-y-6 sticky top-4">

          {/* PRORATED PAYROLL RULES NOTE CARD */}
          <div className="bg-gradient-to-br from-indigo-50/90 via-purple-50/40 to-indigo-50/90 dark:from-indigo-950/50 dark:via-purple-950/30 dark:to-indigo-950/50 rounded-2xl border border-indigo-200/90 dark:border-indigo-800/80 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-indigo-200/60 dark:border-indigo-800/60 pb-2.5">
              <div className="flex items-center gap-2 text-indigo-950 dark:text-indigo-100 font-extrabold text-xs">
                <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>Note: Prorated Payroll Calculation Rules</span>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-600 text-white shadow-2xs">
                PRORATED RULES
              </span>
            </div>

            <div className="text-xs text-indigo-950 dark:text-indigo-100 leading-relaxed font-medium">
              <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-indigo-100 dark:border-indigo-900/60 shadow-2xs space-y-2">
                <div className="flex items-start gap-2 font-semibold text-slate-800 dark:text-slate-200 text-[11px]">
                  <span className="text-indigo-600 font-bold shrink-0">1. Mid-Month Joining:</span>
                  <span>If an employee joins mid-cycle, weekoffs and holidays prior to Joining Date (DOJ) are excluded.</span>
                </div>
                <div className="flex items-start gap-2 font-semibold text-slate-800 dark:text-slate-200 text-[11px] pt-1.5 border-t border-indigo-100/80 dark:border-indigo-900/40">
                  <span className="text-indigo-600 font-bold shrink-0">2. Mid-Month Exit:</span>
                  <span>If an employee exits mid-cycle, weekoffs and holidays after Relieving Date (DOL) are excluded.</span>
                </div>
              </div>
            </div>
          </div>

          {/* SUMMARY CARD */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-xs space-y-6">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-100 dark:border-slate-800/80 pb-3 font-outfit flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Execution Summary</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">READY</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80">
                <span className="text-slate-500 dark:text-slate-400 font-semibold">Target Scope:</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-lg border border-indigo-200/80 dark:border-indigo-800/80">
                  {getDerivedScopeLabel()}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80">
                <span className="text-slate-500 dark:text-slate-400 font-semibold">Eligible Staff Count:</span>
                <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-200/80 dark:border-emerald-800/80">
                  {matchedList.length} Staff
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80">
                <span className="text-slate-500 dark:text-slate-400 font-semibold">Payroll Type:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {payrollType}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80">
                <span className="text-slate-500 dark:text-slate-400 font-semibold">Cutoff Range:</span>
                <span className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  {cycleStartDay}th to {cycleEndDay}th
                </span>
              </div>
            </div>

            {/* RUN BUTTON */}
            <div className="pt-2">
              {isGenerating ? (
                <div className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white text-xs font-black shadow-lg flex flex-col items-center justify-center gap-2 animate-pulse">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Step {progressStep} of 4: Computing Payroll Engine...</span>
                </div>
              ) : canCreate ? (
                <button
                  type="button"
                  onClick={handleStartGeneration}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-extrabold shadow-md hover:shadow-indigo-500/30 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer flex items-center justify-center gap-2.5 tracking-wide uppercase"
                >
                  <Zap className="w-4 h-4 fill-current stroke-0" />
                  <span>Generate Payroll ({matchedList.length} Staff)</span>
                </button>
              ) : (
                <div className="w-full py-3.5 px-4 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs font-bold text-center">
                  🔒 Create Payroll permission required to generate batch
                </div>
              )}
            </div>
          </div>



        </div>

      </div>
    </div>
  );
}

