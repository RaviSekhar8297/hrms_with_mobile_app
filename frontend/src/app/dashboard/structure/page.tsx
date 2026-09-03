'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import DashboardPageHeader from '../components/DashboardPageHeader';
import { useDashboard } from '../components/DashboardContext';
import { getHeaders, getUrl } from '../utils/api';

interface Company {
  id: string;
  name: string;
  subdomain: string;
  status: string;
  created_at: string;
}

interface SalaryStructureItem {
  id?: string;
  empId: string;
  employeeId?: string;
  empUuid?: string;
  name: string;
  doj: string;
  salaryPerAnnum: number;
  salaryPerMonth: number;
  basic: number;
  hra: number;
  ca: number;
  ma: number;
  sa: number;
  employeePf: number;
  employeeEsi: number;
  professionalTax: number;
  employerPf: number;
  employerEsi: number;
  variablePay: number;
  retentionBonus: number;
  netSalary: number;
  monthlyCtc: number;
  pfCheck: number;
  esiCheck: number;
  ptCheck: boolean;
  isStructureActive: boolean;
  isRetentionBonusApplicable: boolean;
  isVariablePayApplicable: boolean;
  retentionBonusPercentage: number;
  variablePayPercentage: number;
  salaryYear: number;
  otherAllowance: number;
  mealFoodCoupons: number;
  telephoneInternetReimbursement: number;
  effectiveFromDate: string;
  effectiveToDate: string;
  taxRegime: string;
  createdAt?: string;
}

const emptyStructure: SalaryStructureItem = {
  empId: '',
  name: '',
  doj: new Date().toISOString().split('T')[0],
  salaryPerAnnum: 0,
  salaryPerMonth: 0,
  basic: 0,
  hra: 0,
  ca: 0,
  ma: 0,
  sa: 0,
  employeePf: 0,
  employeeEsi: 0,
  professionalTax: 0,
  employerPf: 0,
  employerEsi: 0,
  variablePay: 0,
  retentionBonus: 0,
  netSalary: 0,
  monthlyCtc: 0,
  pfCheck: 1,
  esiCheck: 1,
  ptCheck: true,
  isStructureActive: true,
  isRetentionBonusApplicable: false,
  isVariablePayApplicable: false,
  retentionBonusPercentage: 0,
  variablePayPercentage: 0,
  salaryYear: new Date().getFullYear(),
  otherAllowance: 0,
  mealFoodCoupons: 0,
  telephoneInternetReimbursement: 0,
  effectiveFromDate: new Date().toISOString().split('T')[0],
  effectiveToDate: '',
  taxRegime: 'New',
};

export default function PayrollStructurePage() {
  const router = useRouter();
  const { showToast, companyId, setCompanyId } = useDashboard();
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);

  const [structures, setStructures] = useState<SalaryStructureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Off-Canvas Drawer states for Create / Edit
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [activeForm, setActiveForm] = useState<SalaryStructureItem>(emptyStructure);

  // Employee selection and formula calculation states
  const [employeesList, setEmployeesList] = useState<any[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [selectedEmpType, setSelectedEmpType] = useState<string>('None');
  const [slabsEngine, setSlabsEngine] = useState<any[]>([]);
  const [configsEngine, setConfigsEngine] = useState<any[]>([]);
  const [salaryInputMode, setSalaryInputMode] = useState<'annum' | 'month'>('annum');

  // Searchable Employee Dropdown states
  const [empSearchQuery, setEmpSearchQuery] = useState<string>('');
  const [empDropdownOpen, setEmpDropdownOpen] = useState<boolean>(false);
  const empDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (empDropdownRef.current && !empDropdownRef.current.contains(event.target as Node)) {
        setEmpDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredEmpList = useMemo(() => {
    if (!empSearchQuery.trim()) return employeesList;
    const q = empSearchQuery.toLowerCase();
    return employeesList.filter((emp: any) => {
      const code = (emp.emp_id_code || '').toLowerCase();
      const fname = (emp.first_name || '').toLowerCase();
      const lname = (emp.last_name || '').toLowerCase();
      const name = `${fname} ${lname}`;
      const dept = (emp.department_name || emp.department || '').toLowerCase();
      const desig = (emp.designation || '').toLowerCase();
      return code.includes(q) || name.includes(q) || dept.includes(q) || desig.includes(q);
    });
  }, [employeesList, empSearchQuery]);

  // Dynamic salary years (2 years prior to 2 years future)
  const currentYear = new Date().getFullYear();
  const dynamicYears = useMemo(() => [
    currentYear - 2,
    currentYear - 1,
    currentYear,
    currentYear + 1,
    currentYear + 2
  ], [currentYear]);

  // Check if salary structure already exists for the selected employee ID and year
  const isDuplicateStructure = useMemo(() => {
    if ((!activeForm.empId && !activeForm.employeeId) || !activeForm.salaryYear) return false;
    const targetEmpId = String(activeForm.empId || '').trim().toLowerCase();
    const targetEmpUuid = String(activeForm.employeeId || activeForm.empUuid || '').trim().toLowerCase();

    return structures.some(st => {
      const stEmpId = String(st.empId || '').trim().toLowerCase();
      const stEmpUuid = String(st.employeeId || st.empUuid || '').trim().toLowerCase();

      const sameEmp = (targetEmpUuid && stEmpUuid && targetEmpUuid === stEmpUuid) || (targetEmpId && stEmpId && targetEmpId === stEmpId);
      const sameYear = Number(st.salaryYear) === Number(activeForm.salaryYear);
      const isDifferentRecord = formMode === 'create' || (formMode === 'edit' && st.id !== activeForm.id);
      return sameEmp && sameYear && isDifferentRecord;
    });
  }, [structures, activeForm.empId, activeForm.employeeId, activeForm.empUuid, activeForm.salaryYear, activeForm.id, formMode]);

  // Delete Toast Confirmation state
  const [deleteTarget, setDeleteTarget] = useState<SalaryStructureItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('superadmin');

  const fetchEmployeesAndFormulaData = async () => {
    try {
      const cid = companyId;
      const [empRes, sandboxRes] = await Promise.all([
        fetch(getUrl('/api/v1/employees', cid), { headers: getHeaders() }),
        fetch(getUrl('/api/v1/payroll/sandbox-data', cid), { headers: getHeaders() })
      ]);
      if (empRes.ok) {
        const empData = await empRes.json();
        setEmployeesList(empData.employees || []);
      }
      if (sandboxRes.ok) {
        const sandboxData = await sandboxRes.json();
        setSlabsEngine(sandboxData.slabs || []);
        setConfigsEngine(sandboxData.configurations || []);
      }
    } catch (err) {
      console.error('Error fetching employees or formula engine data:', err);
    }
  };

  const fetchSalaryStructures = async () => {
    setLoading(true);
    try {
      const cid = companyId;
      const res = await fetch(getUrl('/api/v1/payroll/structures', cid), {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        const mapped: SalaryStructureItem[] = (data.structures || []).map((row: any) => ({
          id: row.id,
          empId: row.emp_id || 'N/A',
          employeeId: row.employee_id || row.emp_uuid || '',
          empUuid: row.emp_uuid || row.employee_id || '',
          name: row.full_name || row.name || 'Employee',
          doj: row.doj ? String(row.doj).split('T')[0] : '',
          salaryPerAnnum: Number(row.salary_per_annum || 0),
          salaryPerMonth: Number(row.salary_per_month || 0),
          basic: Number(row.basic || 0),
          hra: Number(row.hra || 0),
          ca: Number(row.ca || 0),
          ma: Number(row.ma || 0),
          sa: Number(row.sa || 0),
          employeePf: Number(row.employee_pf || 0),
          employeeEsi: Number(row.employee_esi || 0),
          professionalTax: Number(row.professional_tax || 0),
          employerPf: Number(row.employer_pf || 0),
          employerEsi: Number(row.employer_esi || 0),
          variablePay: Number(row.variable_pay || 0),
          retentionBonus: Number(row.retention_bonus || 0),
          netSalary: Number(row.net_salary || 0),
          monthlyCtc: Number(row.monthly_ctc || 0),
          pfCheck: Number(row.pf_check ?? 1),
          esiCheck: Number(row.esi_check ?? 1),
          ptCheck: Boolean(row.pt_check ?? true),
          isStructureActive: Boolean(row.is_structure_active ?? true),
          isRetentionBonusApplicable: Boolean(row.is_retention_bonus_applicable ?? false),
          isVariablePayApplicable: Boolean(row.is_variable_pay_applicable ?? false),
          retentionBonusPercentage: Number(row.retention_bonus_percentage || 0),
          variablePayPercentage: Number(row.variable_pay_percentage || 0),
          salaryYear: Number(row.salary_year || new Date().getFullYear()),
          otherAllowance: Number(row.other_allowance || 0),
          mealFoodCoupons: Number(row.meal_food_coupons || 0),
          telephoneInternetReimbursement: Number(row.telephone_internet_reimbursement || 0),
          effectiveFromDate: row.effective_from_date ? String(row.effective_from_date).split('T')[0] : '',
          effectiveToDate: row.effective_to_date ? String(row.effective_to_date).split('T')[0] : '',
          taxRegime: row.tax_regime || 'New',
          createdAt: row.created_at,
        }));
        setStructures(mapped);
      } else {
        setStructures([]);
      }
    } catch (err) {
      console.error('Error fetching salary structures:', err);
      showToast('Failed to load salary structures.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const res = await fetch(getUrl('/api/v1/companies'), { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) setCompanies(data.companies || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const storedRoles = localStorage.getItem('roles');
    const storedPermissions = localStorage.getItem('permissions');
    const storedEmail = localStorage.getItem('email');
    if (storedRoles) setRoles(JSON.parse(storedRoles));
    if (storedPermissions) setUserPermissions(JSON.parse(storedPermissions));
    if (storedEmail) setEmail(storedEmail);

    fetchSalaryStructures();
    fetchEmployeesAndFormulaData();
  }, [companyId]);

  useEffect(() => {
    if (isSuperAdmin) {
      fetchCompanies();
    }
  }, [companyId, isSuperAdmin]);

  const calculateComponentsFromFormula = (
    annualSalary: number,
    empType: string,
    pfCheck: number,
    esiCheck: number,
    ptCheck: boolean,
    isVarApplicable: boolean,
    varPct: number,
    isRetApplicable: boolean,
    retPct: number
  ) => {
    const monthlyGross = Math.round((annualSalary || 0) / 12);
    if (monthlyGross <= 0) {
      return {
        salaryPerMonth: 0,
        basic: 0,
        hra: 0,
        ca: 0,
        ma: 0,
        sa: 0,
        employeePf: 0,
        employeeEsi: 0,
        professionalTax: 0,
        employerPf: 0,
        employerEsi: 0,
        variablePay: 0,
        retentionBonus: 0,
        netSalary: 0,
        monthlyCtc: 0
      };
    }

    const matchedSlab = slabsEngine.find(
      s => s.is_active && monthlyGross >= Number(s.min_gross) && monthlyGross <= Number(s.max_gross)
    );

    let basic = 0;
    let hra = 0;
    let ca = 0;
    let ma = 0;
    let sa = 0;

    if (matchedSlab && configsEngine.length > 0) {
      const activeConfigs = configsEngine
        .filter(c => c.is_active && c.slab_id === matchedSlab.id)
        .sort((a, b) => a.display_order - b.display_order);

      const resolved: { [code: string]: number } = {};
      const isTempOrStipend = empType === 'Temporary' || empType === 'Stipend';

      for (const config of activeConfigs) {
        const code = config.component_code.toUpperCase();
        if (code === 'SA') continue;

        let baseValue = 0;
        const type = config.calculation_type_name;
        const val = Number(config.calculation_value || 0);

        if (isTempOrStipend) {
          if (code === 'BASIC') baseValue = monthlyGross;
        } else {
          if (type === 'FixedAmount') {
            baseValue = val;
          } else if (type === 'PercentageOfGross') {
            baseValue = monthlyGross * (val / 100);
          } else if (type === 'PercentageOfComponent') {
            const parentCode = (config.depends_on_component || '').toUpperCase();
            const parentEarned = resolved[parentCode] || 0;
            baseValue = parentEarned * (val / 100);
          }
        }

        const minCap = Number(config.min_cap || 0);
        const maxCap = config.max_cap ? Number(config.max_cap) : null;
        if (baseValue < minCap) baseValue = minCap;
        if (maxCap !== null && baseValue > maxCap) baseValue = maxCap;

        resolved[code] = Math.round(baseValue);
      }

      basic = resolved['BASIC'] || Math.round(monthlyGross * 0.5);
      hra = resolved['HRA'] || Math.round(basic * 0.4);
      ca = resolved['CA'] || 0;
      ma = resolved['MA'] || 0;

      let otherSum = basic + hra + ca + ma;
      Object.keys(resolved).forEach(k => {
        if (!['BASIC', 'HRA', 'CA', 'MA', 'SA'].includes(k)) {
          otherSum += resolved[k];
        }
      });
      sa = Math.max(0, monthlyGross - otherSum);
    } else {
      basic = Math.round(monthlyGross * 0.5);
      hra = Math.round(basic * 0.4);
      ca = 1600;
      ma = 1250;
      sa = Math.max(0, monthlyGross - (basic + hra + ca + ma));
    }

    let employeePf = 0;
    let employerPf = 0;
    if (pfCheck === 1) {
      employeePf = basic >= 15000 ? 1800 : Math.round(basic * 0.12);
      employerPf = employeePf;
    }

    let employeeEsi = 0;
    let employerEsi = 0;
    if (esiCheck === 1 && monthlyGross <= 21000) {
      employeeEsi = Math.round(monthlyGross * 0.0075);
      employerEsi = Math.round(monthlyGross * 0.0325);
    }

    let professionalTax = 0;
    if (ptCheck) {
      professionalTax = monthlyGross >= 20001 ? 200 : (monthlyGross >= 15001 ? 150 : 0);
    }

    let variablePay = 0;
    if (isVarApplicable && varPct > 0) {
      variablePay = Math.round((annualSalary * (varPct / 100)) / 12);
    }

    let retentionBonus = 0;
    if (isRetApplicable && retPct > 0) {
      retentionBonus = Math.round((annualSalary * (retPct / 100)) / 12);
    }

    const netSalary = Math.max(0, monthlyGross - (employeePf + employeeEsi + professionalTax));
    const monthlyCtc = monthlyGross + employerPf + employerEsi + variablePay + retentionBonus;

    return {
      salaryPerMonth: monthlyGross,
      basic,
      hra,
      ca,
      ma,
      sa,
      employeePf,
      employeeEsi,
      professionalTax,
      employerPf,
      employerEsi,
      variablePay,
      retentionBonus,
      netSalary,
      monthlyCtc
    };
  };

  const handleSelectEmployee = (empDbId: string) => {
    setSelectedEmpId(empDbId);
    if (!empDbId) {
      setSelectedEmpType('None');
      setActiveForm(prev => ({
        ...prev,
        empId: '',
        name: '',
        doj: ''
      }));
      return;
    }

    const emp = employeesList.find(e => String(e.id) === String(empDbId) || String(e.emp_id_code) === String(empDbId));
    if (emp) {
      const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.name || 'Employee';
      const dojVal = emp.joining_date ? String(emp.joining_date).split('T')[0] : '';
      const empTypeVal = emp.employment_type || 'Permanent';
      setSelectedEmpType(empTypeVal);

      const updatedForm = {
        ...activeForm,
        empId: emp.emp_id_code || String(emp.id) || '',
        name: fullName,
        doj: dojVal
      };

      if (activeForm.salaryPerAnnum > 0) {
        const calcs = calculateComponentsFromFormula(
          activeForm.salaryPerAnnum,
          empTypeVal,
          activeForm.pfCheck,
          activeForm.esiCheck,
          activeForm.ptCheck,
          activeForm.isVariablePayApplicable,
          activeForm.variablePayPercentage,
          activeForm.isRetentionBonusApplicable,
          activeForm.retentionBonusPercentage
        );
        Object.assign(updatedForm, calcs);
      }

      setActiveForm(updatedForm);
    }
  };

  const handleSalaryValueChange = (val: number, mode: 'annum' | 'month' = salaryInputMode) => {
    const annualVal = mode === 'annum' ? val : val * 12;
    const calcs = calculateComponentsFromFormula(
      annualVal,
      selectedEmpType,
      activeForm.pfCheck,
      activeForm.esiCheck,
      activeForm.ptCheck,
      activeForm.isVariablePayApplicable,
      activeForm.variablePayPercentage,
      activeForm.isRetentionBonusApplicable,
      activeForm.retentionBonusPercentage
    );
    setActiveForm({
      ...activeForm,
      salaryPerAnnum: annualVal,
      ...calcs
    });
  };

  const handleSalaryModeChange = (newMode: 'annum' | 'month') => {
    setSalaryInputMode(newMode);
    const currentInputValue = newMode === 'annum' ? activeForm.salaryPerAnnum : activeForm.salaryPerMonth;
    handleSalaryValueChange(currentInputValue || 0, newMode);
  };

  const handleToggleCompliance = (type: 'pf' | 'esi' | 'pt' | 'var' | 'ret', extraValue?: any) => {
    let newPf = activeForm.pfCheck;
    let newEsi = activeForm.esiCheck;
    let newPt = activeForm.ptCheck;
    let newIsVar = activeForm.isVariablePayApplicable;
    let newVarPct = activeForm.variablePayPercentage;
    let newIsRet = activeForm.isRetentionBonusApplicable;
    let newRetPct = activeForm.retentionBonusPercentage;

    if (type === 'pf') newPf = newPf === 1 ? 0 : 1;
    if (type === 'esi') newEsi = newEsi === 1 ? 0 : 1;
    if (type === 'pt') newPt = !newPt;
    if (type === 'var') {
      if (typeof extraValue === 'boolean') newIsVar = extraValue;
      else if (typeof extraValue === 'number') newVarPct = extraValue;
      else newIsVar = !newIsVar;
    }
    if (type === 'ret') {
      if (typeof extraValue === 'boolean') newIsRet = extraValue;
      else if (typeof extraValue === 'number') newRetPct = extraValue;
      else newIsRet = !newIsRet;
    }

    const calcs = calculateComponentsFromFormula(
      activeForm.salaryPerAnnum,
      selectedEmpType,
      newPf,
      newEsi,
      newPt,
      newIsVar,
      newVarPct,
      newIsRet,
      newRetPct
    );

    setActiveForm({
      ...activeForm,
      pfCheck: newPf,
      esiCheck: newEsi,
      ptCheck: newPt,
      isVariablePayApplicable: newIsVar,
      variablePayPercentage: newVarPct,
      isRetentionBonusApplicable: newIsRet,
      retentionBonusPercentage: newRetPct,
      ...calcs
    });
  };

  const handleCompanyChange = (id: string) => {
    const val = id || null;
    setCompanyId(val);
    if (val) {
      localStorage.setItem('companyId', val);
    } else {
      localStorage.removeItem('companyId');
    }
    fetchSalaryStructures();
    fetchEmployeesAndFormulaData();
  };

  const handleOpenCreate = () => {
    setFormMode('create');
    setSelectedEmpId('');
    setSelectedEmpType('None');
    setSalaryInputMode('annum');
    setEmpSearchQuery('');
    setEmpDropdownOpen(false);
    setActiveForm({
      ...emptyStructure,
      salaryYear: 2026
    });
    fetchEmployeesAndFormulaData();
    setDrawerOpen(true);
  };

  const handleOpenEdit = (item: SalaryStructureItem) => {
    const targetId = item.id || item.empId;
    router.push(`/dashboard/structure/${targetId}`);
  };

  const handleSaveDrawerForm = async () => {
    if (!activeForm.empId || !activeForm.name) {
      showToast('Please provide Emp ID and Employee Name', 'error');
      return;
    }

    if (isDuplicateStructure) {
      showToast(`Salary structure already exists for ${activeForm.name} in year ${activeForm.salaryYear}`, 'error');
      return;
    }

    // Recalculate CTC and Net Salary
    const calculatedMonthly = activeForm.basic + activeForm.hra + activeForm.ca + activeForm.ma + activeForm.sa + activeForm.otherAllowance + activeForm.employerPf + activeForm.employerEsi;
    const calculatedAnnual = calculatedMonthly * 12;
    const calculatedDeductions = activeForm.employeePf + activeForm.employeeEsi + activeForm.professionalTax;
    const calculatedNet = Math.max(0, (activeForm.basic + activeForm.hra + activeForm.ca + activeForm.ma + activeForm.sa + activeForm.otherAllowance) - calculatedDeductions);

    const payload = {
      ...activeForm,
      salaryPerMonth: calculatedMonthly,
      salaryPerAnnum: calculatedAnnual,
      monthlyCtc: calculatedMonthly,
      netSalary: calculatedNet
    };

    setSaving(true);
    try {
      const res = await fetch(getUrl('/api/v1/payroll/structures', companyId), {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify([payload])
      });

      if (res.ok) {
        showToast(formMode === 'create' ? 'Salary structure created successfully!' : 'Salary structure updated successfully!', 'success');
        setDrawerOpen(false);
        fetchSalaryStructures();
      } else {
        showToast('Failed to save salary structure', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Server error while saving', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRecord = async () => {
    if (!deleteTarget) return;
    const targetId = deleteTarget.id || deleteTarget.empId;
    setDeleting(true);
    try {
      const res = await fetch(getUrl(`/api/v1/payroll/structures/${targetId}`), {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (res.ok) {
        showToast(`Deleted salary structure for ${deleteTarget.name}`, 'success');
        setDeleteTarget(null);
        fetchSalaryStructures();
      } else {
        showToast('Error deleting record', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Server connection error during deletion', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleTogglePF = async (empId: string) => {
    const target = structures.find(s => s.empId === empId);
    if (!target) return;
    const newVal = target.pfCheck === 1 ? 0 : 1;
    setStructures(prev => prev.map(s => s.empId === empId ? { ...s, pfCheck: newVal } : s));
    try {
      const updated = { ...target, pfCheck: newVal };
      await fetch(getUrl('/api/v1/payroll/structures', companyId), {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify([updated])
      });
      showToast(`PF Check set to ${newVal === 1 ? 'True (1)' : 'False (0)'} for ${target.name}`, 'info');
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleESI = async (empId: string) => {
    const target = structures.find(s => s.empId === empId);
    if (!target) return;
    const newVal = target.esiCheck === 1 ? 0 : 1;
    setStructures(prev => prev.map(s => s.empId === empId ? { ...s, esiCheck: newVal } : s));
    try {
      const updated = { ...target, esiCheck: newVal };
      await fetch(getUrl('/api/v1/payroll/structures', companyId), {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify([updated])
      });
      showToast(`ESI Check set to ${newVal === 1 ? 'True (1)' : 'False (0)'} for ${target.name}`, 'info');
    } catch (e) {
      console.error(e);
    }
  };

  const handleTogglePT = async (empId: string) => {
    const target = structures.find(s => s.empId === empId);
    if (!target) return;
    const newVal = !target.ptCheck;
    setStructures(prev => prev.map(s => s.empId === empId ? { ...s, ptCheck: newVal } : s));
    try {
      const updated = { ...target, ptCheck: newVal };
      await fetch(getUrl('/api/v1/payroll/structures', companyId), {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify([updated])
      });
      showToast(`PT Check set to ${newVal ? 'True' : 'False'} for ${target.name}`, 'info');
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleRetentionBonus = async (empId: string) => {
    const target = structures.find(s => s.empId === empId);
    if (!target) return;
    const newVal = !target.isRetentionBonusApplicable;
    setStructures(prev => prev.map(s => s.empId === empId ? { ...s, isRetentionBonusApplicable: newVal } : s));
    try {
      const updated = { ...target, isRetentionBonusApplicable: newVal };
      await fetch(getUrl('/api/v1/payroll/structures', companyId), {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify([updated])
      });
      showToast(`Retention Bonus set to ${newVal ? 'Yes' : 'No'} for ${target.name}`, 'info');
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleVariablePay = async (empId: string) => {
    const target = structures.find(s => s.empId === empId);
    if (!target) return;
    const newVal = !target.isVariablePayApplicable;
    setStructures(prev => prev.map(s => s.empId === empId ? { ...s, isVariablePayApplicable: newVal } : s));
    try {
      const updated = { ...target, isVariablePayApplicable: newVal };
      await fetch(getUrl('/api/v1/payroll/structures', companyId), {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify([updated])
      });
      showToast(`Variable Pay set to ${newVal ? 'Yes' : 'No'} for ${target.name}`, 'info');
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleStatus = async (empId: string) => {
    const target = structures.find(s => s.empId === empId);
    if (!target) return;
    const newVal = !target.isStructureActive;
    setStructures(prev => prev.map(s => s.empId === empId ? { ...s, isStructureActive: newVal } : s));
    try {
      const updated = { ...target, isStructureActive: newVal };
      await fetch(getUrl('/api/v1/payroll/structures', companyId), {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify([updated])
      });
      showToast(`Status set to ${newVal ? 'Active' : 'Inactive'} for ${target.name}`, 'info');
    } catch (e) {
      console.error(e);
    }
  };

  // Year filter options (current year only)
  const currentYearNum = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<string>(String(currentYearNum));
  const yearOptions = useMemo(() => [currentYearNum], [currentYearNum]);

  const filteredStructures = useMemo(() => {
    return structures.filter((s: SalaryStructureItem) => {
      const matchesSearch =
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.empId.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesYear = selectedYear === 'ALL' || String(s.salaryYear) === String(selectedYear);
      return matchesSearch && matchesYear;
    });
  }, [structures, searchQuery, selectedYear]);

  // Export to Excel / CSV
  const handleExportCSV = () => {
    if (filteredStructures.length === 0) {
      showToast('No salary structures available to export', 'error');
      return;
    }
    const headers = [
      'EmpId', 'Name', 'DOJ', 'SalaryPerAnnum', 'SalaryPerMonth', 'BASIC', 'HRA', 'CA', 'MA', 'SA',
      'OtherAllowance', 'MealFoodCoupons', 'TelephoneInternetReimbursement', 'EmployeePF', 'EmployeeESI',
      'ProfessionalTax', 'EmployerPF', 'EmployerESI', 'VariablePay', 'RetentionBonus', 'NetSalary',
      'MonthlyCTC', 'PFCheck', 'ESICheck', 'PTCheck', 'IsStructureActive', 'IsRetentionBonusApplicable',
      'IsVariablePayApplicable', 'RetentionBonusPercentage', 'VariablePayPercentage', 'SalaryYear',
      'EffectiveFromDate', 'EffectiveToDate', 'TaxRegime', 'CreatedAt'
    ];

    const rows = filteredStructures.map((s: SalaryStructureItem) => [
      `"${s.empId}"`,
      `"${s.name}"`,
      `"${s.doj || ''}"`,
      s.salaryPerAnnum,
      s.salaryPerMonth,
      s.basic,
      s.hra,
      s.ca,
      s.ma,
      s.sa,
      s.otherAllowance,
      s.mealFoodCoupons,
      s.telephoneInternetReimbursement,
      s.employeePf,
      s.employeeEsi,
      s.professionalTax,
      s.employerPf,
      s.employerEsi,
      s.variablePay,
      s.retentionBonus,
      s.netSalary,
      s.monthlyCtc,
      s.pfCheck,
      s.esiCheck,
      s.ptCheck ? 'True' : 'False',
      s.isStructureActive ? 'Active' : 'Inactive',
      s.isRetentionBonusApplicable ? 'Yes' : 'No',
      s.isVariablePayApplicable ? 'Yes' : 'No',
      s.retentionBonusPercentage,
      s.variablePayPercentage,
      s.salaryYear,
      `"${s.effectiveFromDate || ''}"`,
      `"${s.effectiveToDate || ''}"`,
      `"${s.taxRegime}"`,
      `"${s.createdAt || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r: (string | number)[]) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Salary_Structures_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Salary structures exported to CSV successfully!', 'success');
  };

  // Pagination calculation
  const totalItems = filteredStructures.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedStructures = filteredStructures.slice(startIndex, endIndex);

  const canView = isSuperAdmin || userPermissions.includes('view_salary_structures');
  const canCreate = isSuperAdmin || userPermissions.includes('create_salary_structures');
  const canEdit = isSuperAdmin || userPermissions.includes('edit_salary_structures');
  const canDelete = isSuperAdmin || userPermissions.includes('delete_salary_structures');
  const canPerformActions = canEdit || canDelete;

  if (roles.length > 0 && !canView) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center p-6 animate-fadeIn">
        <div className="h-16 w-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4 text-3xl">
          🔒
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Access Denied</h3>
        <p className="text-slate-500 dark:text-slate-400 text-xs mt-1.5 max-w-sm">
          You do not have the required permissions to access the Salary Structure module. Please contact your HR administrator.
        </p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }} className="structure-page-container font-['DM_Sans',sans-serif] space-y-6 animate-fadeIn w-full text-left">
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap" rel="stylesheet" />
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap');
        .structure-page-container,
        .structure-page-container td,
        .structure-page-container th,
        .structure-page-container button,
        .structure-page-container input,
        .structure-page-container select,
        .structure-page-container label,
        .structure-page-container span,
        .structure-page-container div,
        .structure-page-container p {
          font-family: 'DM Sans', sans-serif !important;
        }
      `}} />

      <DashboardPageHeader
        title="Salary Structure Database"
        actionMessage=""
        actionError=""
        companies={companies}
        companyId={companyId}
        handleCompanyChange={handleCompanyChange}
        isSuperAdmin={isSuperAdmin}
        hideCompanySelect={false}
        hideUserBadge={true}
      />

      {/* Action Header bar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="h-10 w-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/40 shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div>
            <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider font-outfit">
              Master Salary Structure Records ({structures.length})
            </h3>
            <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">
              Comprehensive compensation parameter matrix with 35 compliance fields
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto">
          {/* Search Input */}
          <div className="relative flex items-center w-full sm:w-60">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              autoComplete="off"
              placeholder="Search Emp ID or Name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="!pl-10 pr-4 py-2 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
            />
          </div>

          {/* 📅 YEAR FILTER DROPDOWN (Current Year Only) */}
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 text-xs font-extrabold text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500 cursor-pointer shrink-0"
            title="Filter by Salary Year"
          >
            {yearOptions.map(yr => (
              <option key={yr} value={yr}>{yr}</option>
            ))}
          </select>

          {/* 📊 GREEN EXCEL ICON BUTTON */}
          <button
            onClick={handleExportCSV}
            title="Export to Excel / CSV"
            className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 hover:bg-emerald-600 text-emerald-600 dark:text-emerald-400 hover:text-white border border-emerald-200 dark:border-emerald-900/50 transition-all cursor-pointer flex items-center justify-center shadow-2xs flex-shrink-0 group"
          >
            <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400 group-hover:text-white transition-colors" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM13 3.5L18.5 9H13V3.5zM8.8 17.5l1.7-3-1.6-3h1.8l.8 1.8.8-1.8h1.7l-1.6 3 1.7 3h-1.8l-.9-1.9-.9 1.9H8.8z"/>
            </svg>
          </button>

          {/* ➕ ICON-ONLY ADD NEW BUTTON */}
          {canCreate && (
            <button
              onClick={() => router.push('/dashboard/structure/new')}
              title="Add New Salary Structure"
              className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all cursor-pointer flex items-center justify-center shadow-md shadow-indigo-500/20 flex-shrink-0"
            >
              <svg className="w-4 h-4 stroke-[3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Table Container displaying ALL COLUMNS */}
      <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-8 h-8 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-500">Loading master salary structure records...</p>
          </div>
        ) : filteredStructures.length === 0 ? (
          /* NO RECORDS FOUND EMPTY STATE */
          <div className="py-16 text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800/60 text-slate-400 flex items-center justify-center mx-auto shadow-inner">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                No Salary Structures Found
              </h4>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 max-w-sm mx-auto">
                No matching employee salary records match your current search query "{searchQuery}" and year "{selectedYear}".
              </p>
            </div>
            {(searchQuery || selectedYear !== 'ALL') && (
              <button
                onClick={() => { setSearchQuery(''); setSelectedYear('ALL'); }}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 cursor-pointer"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto max-h-[62vh] premium-scrollbar border border-slate-100 dark:border-slate-800/80 rounded-xl">
            <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-extrabold uppercase tracking-wider text-[9.5px] bg-slate-100 dark:bg-slate-900 sticky top-0 z-20">
                  {/* STICKY ACTIONS COLUMN */}
                  {canPerformActions && (
                    <th className="py-3.5 px-3.5 sticky left-0 z-30 bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 w-[95px] min-w-[95px]">Actions</th>
                  )}
                  {/* STICKY EMPLOYEE COLUMN (Name on top, Emp ID underneath) */}
                  <th className={`py-3.5 px-3.5 sticky z-30 bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 min-w-[180px] ${canPerformActions ? 'left-[95px]' : 'left-0'}`}>Employee</th>
                  <th className="py-3.5 px-3.5">DOJ</th>
                  <th className="py-3.5 px-3.5 text-right">Annual Salary (₹)</th>
                  <th className="py-3.5 px-3.5 text-right">Monthly Salary (₹)</th>
                  <th className="py-3.5 px-3.5 text-right">Basic (₹)</th>
                  <th className="py-3.5 px-3.5 text-right">HRA (₹)</th>
                  <th className="py-3.5 px-3.5 text-right">CA (₹)</th>
                  <th className="py-3.5 px-3.5 text-right">MA (₹)</th>
                  <th className="py-3.5 px-3.5 text-right">SA (₹)</th>
                  <th className="py-3.5 px-3.5 text-right">Other Allowance (₹)</th>
                  <th className="py-3.5 px-3.5 text-right">Meal Coupons (₹)</th>
                  <th className="py-3.5 px-3.5 text-right">Reimbursements (₹)</th>
                  <th className="py-3.5 px-3.5 text-right">Employee PF (₹)</th>
                  <th className="py-3.5 px-3.5 text-right">Employee ESI (₹)</th>
                  <th className="py-3.5 px-3.5 text-right">Prof. Tax (₹)</th>
                  <th className="py-3.5 px-3.5 text-right">Employer PF (₹)</th>
                  <th className="py-3.5 px-3.5 text-right">Employer ESI (₹)</th>
                  <th className="py-3.5 px-3.5 text-right">Variable Pay (₹)</th>
                  <th className="py-3.5 px-3.5 text-right">Retention Bonus (₹)</th>
                  <th className="py-3.5 px-3.5 text-right">Net Salary (₹)</th>
                  <th className="py-3.5 px-3.5 text-right">Monthly CTC (₹)</th>
                  <th className="py-3.5 px-3.5 text-center">PF Check</th>
                  <th className="py-3.5 px-3.5 text-center">ESI Check</th>
                  <th className="py-3.5 px-3.5 text-center">PT Check</th>
                  <th className="py-3.5 px-3.5 text-center">Retention Bonus</th>
                  <th className="py-3.5 px-3.5 text-center">Variable Pay</th>
                  <th className="py-3.5 px-3.5 text-right">Retention %</th>
                  <th className="py-3.5 px-3.5 text-right">Variable %</th>
                  <th className="py-3.5 px-3.5 text-center">Year</th>
                  <th className="py-3.5 px-3.5">Effective From</th>
                  <th className="py-3.5 px-3.5">Effective To</th>
                  <th className="py-3.5 px-3.5">Tax Regime</th>
                  <th className="py-3.5 px-3.5">Created At</th>
                  <th className="py-3.5 px-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs font-medium">
                {paginatedStructures.map((s) => {
                  const empRecord = employeesList.find((emp: any) => {
                    const code = String(emp.emp_id_code || emp.emp_id || emp.empId || '').trim().toLowerCase();
                    const idStr = String(emp.id || '').trim().toLowerCase();
                    const targetCode = String(s.empId || '').trim().toLowerCase();
                    const targetUuid = String(s.employeeId || s.empUuid || '').trim().toLowerCase();
                    return (code && code === targetCode) || (idStr && idStr === targetUuid);
                  });

                  const isEmpInactive = empRecord ? (
                    String(empRecord.status || '').toUpperCase() === 'INACTIVE' ||
                    String(empRecord.status || '').toUpperCase() === 'TERMINATED' ||
                    String(empRecord.status || '').toUpperCase() === 'RESIGNED' ||
                    empRecord.is_active === false ||
                    empRecord.is_active === 0
                  ) : false;

                  const isInactive = !s.isStructureActive || isEmpInactive;
                  const displayStatus = isEmpInactive ? 'Inactive' : (s.isStructureActive ? 'Active' : 'Inactive');

                  return (
                  <tr key={s.id || s.empId} className={`transition-colors ${isInactive ? 'bg-slate-50/60 dark:bg-slate-900/40 opacity-75' : 'hover:bg-indigo-50/30 dark:hover:bg-slate-800/50'}`}>
                    {/* STICKY ACTIONS COLUMN */}
                    {canPerformActions && (
                      <td className="py-2.5 px-3.5 sticky left-0 z-10 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 w-[95px] min-w-[95px]">
                        <div className="flex items-center gap-2">
                          {/* Edit button — Disabled if employee is inactive */}
                          {canEdit && (
                            <button
                              onClick={() => !isInactive && handleOpenEdit(s)}
                              disabled={isInactive}
                              className={`p-2 rounded-xl border transition-all duration-200 flex items-center justify-center group ${
                                isInactive
                                  ? 'bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-400 dark:text-indigo-500 border-indigo-200/60 dark:border-indigo-900/40 cursor-not-allowed'
                                  : 'bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-600 text-indigo-600 dark:text-indigo-400 hover:text-white border-indigo-200/80 dark:border-indigo-900/50 cursor-pointer shadow-2xs'
                              }`}
                              title={isInactive ? "Inactive Employee — Editing Disabled" : `Edit structure for ${s.name}`}
                            >
                              <svg className={`w-4 h-4 transform ${!isInactive ? 'group-hover:scale-110' : ''} transition-transform`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                              </svg>
                            </button>
                          )}

                          {/* Delete button — Disabled if employee is inactive */}
                          {canDelete && (
                            <button
                              onClick={() => !isInactive && setDeleteTarget(s)}
                              disabled={isInactive}
                              className={`p-2 rounded-xl border transition-all duration-200 flex items-center justify-center group ${
                                isInactive
                                  ? 'bg-rose-50/70 dark:bg-rose-950/40 text-rose-400 dark:text-rose-500 border-rose-200/60 dark:border-rose-900/40 cursor-not-allowed'
                                  : 'bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-600 text-rose-600 dark:text-rose-400 hover:text-white border-rose-200/80 dark:border-rose-900/50 cursor-pointer shadow-2xs'
                              }`}
                              title={isInactive ? "Inactive Employee — Deletion Disabled" : `Delete structure for ${s.name}`}
                            >
                              <svg className={`w-4 h-4 transform ${!isInactive ? 'group-hover:scale-110' : ''} transition-transform`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    )}

                    {/* STICKY EMPLOYEE COLUMN (Name on Top, Emp ID Underneath) */}
                    <td className={`py-2.5 px-3.5 sticky z-10 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 min-w-[180px] ${canPerformActions ? 'left-[95px]' : 'left-0'}`}>
                      <div className="flex flex-col text-left">
                        <span className={`font-bold uppercase tracking-tight text-xs ${isInactive ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'}`}>
                          {s.name}
                        </span>
                        <span className={`font-mono text-[10.5px] font-extrabold ${isInactive ? 'text-rose-600 dark:text-rose-400 font-black' : 'text-indigo-600 dark:text-indigo-400'}`}>
                          {s.empId}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3.5 font-medium text-slate-500 dark:text-slate-400">{s.doj || '-'}</td>
                    <td className="py-2.5 px-3.5 text-right font-semibold text-slate-800 dark:text-slate-200">₹{s.salaryPerAnnum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2.5 px-3.5 text-right font-bold text-emerald-600 dark:text-emerald-400">₹{s.salaryPerMonth.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2.5 px-3.5 text-right font-semibold text-slate-700 dark:text-slate-300">₹{s.basic.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2.5 px-3.5 text-right font-semibold text-slate-700 dark:text-slate-300">₹{s.hra.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2.5 px-3.5 text-right font-semibold text-slate-700 dark:text-slate-300">₹{s.ca.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2.5 px-3.5 text-right font-semibold text-slate-700 dark:text-slate-300">₹{s.ma.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2.5 px-3.5 text-right font-semibold text-slate-700 dark:text-slate-300">₹{s.sa.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2.5 px-3.5 text-right font-semibold text-slate-700 dark:text-slate-300">₹{s.otherAllowance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2.5 px-3.5 text-right font-semibold text-slate-700 dark:text-slate-300">₹{s.mealFoodCoupons.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2.5 px-3.5 text-right font-semibold text-slate-700 dark:text-slate-300">₹{s.telephoneInternetReimbursement.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2.5 px-3.5 text-right font-semibold text-rose-600 dark:text-rose-400">₹{s.employeePf.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2.5 px-3.5 text-right font-semibold text-rose-600 dark:text-rose-400">₹{s.employeeEsi.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2.5 px-3.5 text-right font-semibold text-rose-600 dark:text-rose-400">₹{s.professionalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2.5 px-3.5 text-right font-semibold text-slate-700 dark:text-slate-300">₹{s.employerPf.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2.5 px-3.5 text-right font-semibold text-slate-700 dark:text-slate-300">₹{s.employerEsi.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2.5 px-3.5 text-right font-semibold text-slate-700 dark:text-slate-300">₹{s.variablePay.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2.5 px-3.5 text-right font-semibold text-slate-700 dark:text-slate-300">₹{s.retentionBonus.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2.5 px-3.5 text-right font-bold text-indigo-600 dark:text-indigo-400">₹{s.netSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2.5 px-3.5 text-right font-bold text-emerald-600 dark:text-emerald-400">₹{s.monthlyCtc.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>

                    
                    {/* PFCheck Toggle */}
                    <td className="py-2.5 px-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleTogglePF(s.empId)}
                        title={`PFCheck: ${s.pfCheck === 1 ? 'Enabled (1)' : 'Disabled (0)'}`}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          s.pfCheck === 1 ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            s.pfCheck === 1 ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </td>

                    {/* ESICheck Toggle */}
                    <td className="py-2.5 px-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleESI(s.empId)}
                        title={`ESICheck: ${s.esiCheck === 1 ? 'Enabled (1)' : 'Disabled (0)'}`}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          s.esiCheck === 1 ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            s.esiCheck === 1 ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </td>

                    {/* PTCheck Toggle */}
                    <td className="py-2.5 px-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleTogglePT(s.empId)}
                        title={`PTCheck: ${s.ptCheck ? 'Enabled (1)' : 'Disabled (0)'}`}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          s.ptCheck ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            s.ptCheck ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </td>

                    {/* Retention Bonus Toggle */}
                    <td className="py-2.5 px-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleRetentionBonus(s.empId)}
                        title={`Retention Bonus: ${s.isRetentionBonusApplicable ? 'Yes' : 'No'}`}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          s.isRetentionBonusApplicable ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            s.isRetentionBonusApplicable ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </td>

                    {/* Variable Pay Toggle */}
                    <td className="py-2.5 px-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleVariablePay(s.empId)}
                        title={`Variable Pay: ${s.isVariablePayApplicable ? 'Yes' : 'No'}`}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          s.isVariablePayApplicable ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            s.isVariablePayApplicable ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </td>

                    <td className="py-2.5 px-3.5 text-right font-semibold text-slate-700 dark:text-slate-300">{s.retentionBonusPercentage}%</td>
                    <td className="py-2.5 px-3.5 text-right font-semibold text-slate-700 dark:text-slate-300">{s.variablePayPercentage}%</td>
                    <td className="py-2.5 px-3.5 text-center font-semibold text-slate-700 dark:text-slate-300">{s.salaryYear}</td>
                    <td className="py-2.5 px-3.5 font-medium text-slate-600 dark:text-slate-400">{s.effectiveFromDate || '-'}</td>
                    <td className="py-2.5 px-3.5 font-medium text-slate-600 dark:text-slate-400">{s.effectiveToDate || 'NULL (Ongoing)'}</td>
                    <td className="py-2.5 px-3.5">
                      <span className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 text-[10px] font-extrabold">
                        {s.taxRegime}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 font-medium text-slate-500 dark:text-slate-400 text-[11px] whitespace-nowrap">
                      {s.createdAt ? (() => {
                        try {
                          const d = new Date(s.createdAt);
                          return isNaN(d.getTime()) ? String(s.createdAt) : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                        } catch {
                          return String(s.createdAt);
                        }
                      })() : '-'}
                    </td>

                    {/* Status Column (Synchronized with Employee Status) */}
                    <td className="py-2.5 px-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => !isEmpInactive && handleToggleStatus(s.empId)}
                        disabled={isEmpInactive}
                        title={isEmpInactive ? `Employee is Inactive in Employees Table` : `Click to toggle Status: ${s.isStructureActive ? 'Active' : 'Inactive'}`}
                        className={`px-2.5 py-1 rounded-xl text-[9.5px] font-extrabold uppercase transition-all border ${
                          displayStatus === 'Active' 
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 cursor-pointer' 
                            : 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border-rose-200 dark:border-rose-800 cursor-not-allowed opacity-90'
                        }`}
                      >
                        {displayStatus}
                      </button>
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        )}

        {/* 🚀 MODERN ELEGANT PAGINATION CONTROLS */}
        {!loading && filteredStructures.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 mt-2 border-t border-slate-200/80 dark:border-slate-800 text-xs font-['DM_Sans',sans-serif]">
            {/* Left: Rows Per Page Selector & Summary info */}
            <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-xs font-semibold">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Rows per page:</span>
              <select
                value={pageSize}
                onChange={e => setPageSize(Number(e.target.value))}
                className="bg-slate-100 dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 rounded-xl px-3 py-1.5 font-extrabold text-xs text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500 transition-all cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>

              <span className="text-slate-500 dark:text-slate-400 text-xs font-medium ml-1">
                Showing <strong className="text-slate-900 dark:text-slate-100 font-extrabold">{startIndex + 1}</strong> to{' '}
                <strong className="text-slate-900 dark:text-slate-100 font-extrabold">{endIndex}</strong> of{' '}
                <strong className="text-slate-900 dark:text-slate-100 font-extrabold">{totalItems}</strong> entries
              </span>
            </div>

            {/* Right: Page Pills & Jumpers */}
            <div className="flex items-center gap-1.5">
              {/* First Page Button */}
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="h-8 w-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 font-black hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer flex items-center justify-center text-xs shrink-0"
                title="First Page"
              >
                «
              </button>

              {/* Previous Button */}
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer text-xs"
              >
                Previous
              </button>

              {/* Page Number Pills */}
              <div className="flex items-center gap-1">
                {(() => {
                  const pages = [];
                  const maxButtons = 5;
                  let startPage = Math.max(1, currentPage - 2);
                  let endPage = Math.min(totalPages, startPage + maxButtons - 1);
                  
                  if (endPage - startPage + 1 < maxButtons) {
                    startPage = Math.max(1, endPage - maxButtons + 1);
                  }

                  for (let p = startPage; p <= endPage; p++) {
                    pages.push(
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p)}
                        className={`h-8 min-w-[32px] px-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center ${
                          currentPage === p
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25 ring-2 ring-indigo-400/40'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {p}
                      </button>
                    );
                  }
                  return pages;
                })()}
              </div>

              {/* Next Button */}
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer text-xs"
              >
                Next
              </button>

              {/* Last Page Button */}
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="h-8 w-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 font-black hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer flex items-center justify-center text-xs shrink-0"
                title="Last Page"
              >
                »
              </button>
            </div>
          </div>
        )}
      </div>

      {/* FLOATING TOAST CONFIRMATION FOR DELETE */}
      {deleteTarget && (
        <div className="fixed bottom-6 right-6 z-50 w-full max-w-md bg-slate-900 dark:bg-slate-950 text-white rounded-2xl p-4 shadow-2xl border border-slate-800 flex items-center justify-between gap-4 animate-slideIn font-sans">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </span>
            <div>
              <p className="text-xs font-bold">Delete salary structure?</p>
              <span className="text-[10px] text-slate-400 font-medium">Emp: {deleteTarget.name} ({deleteTarget.empId})</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setDeleteTarget(null)}
              className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteRecord}
              disabled={deleting}
              className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
