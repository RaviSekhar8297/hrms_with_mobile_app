'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import DashboardPageHeader from '../../components/DashboardPageHeader';
import { useDashboard } from '../../components/DashboardContext';
import { getHeaders, getUrl } from '../../utils/api';
import PageLoader from '@/components/ui/PageLoader';

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

export default function EditSalaryStructurePage() {
  const router = useRouter();
  const params = useParams();
  const structureId = params.id as string;
  const isCreateMode = structureId === 'new' || structureId === 'create';
  const { showToast } = useDashboard();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [employeesList, setEmployeesList] = useState<any[]>([]);
  const [empDropdownOpen, setEmpDropdownOpen] = useState(false);
  const [empSearchQuery, setEmpSearchQuery] = useState('');
  const [selectedEmpId, setSelectedEmpId] = useState('');
  
  const [activeForm, setActiveForm] = useState<SalaryStructureItem>(emptyStructure);
  const [salaryInputMode, setSalaryInputMode] = useState<'annum' | 'month'>('annum');
  const [slabsEngine, setSlabsEngine] = useState<any[]>([]);
  const [configsEngine, setConfigsEngine] = useState<any[]>([]);
  const [entryTab, setEntryTab] = useState<'single' | 'bulk'>('single');
  const [bulkParsedRows, setBulkParsedRows] = useState<any[]>([]);

  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('superadmin');

  // Initialize Company & Roles
  useEffect(() => {
    try {
      const storedCompanyId = localStorage.getItem('companyId');
      if (storedCompanyId) setCompanyId(storedCompanyId);

      const userStr = localStorage.getItem('user');
      if (userStr) {
        const u = JSON.parse(userStr);
        if (u.roles) setRoles(u.roles);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Fetch Companies
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const res = await fetch(getUrl('/api/v1/companies', companyId), { headers: getHeaders() });
        if (res.ok) {
          const data = await res.json();
          setCompanies(data.companies || []);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchCompanies();
  }, [companyId]);

  // Fetch Sandbox Data & Target Structure / Employee List
  useEffect(() => {
    if (!structureId) return;

    const loadData = async () => {
      setLoading(true);
      try {
        // Fetch formula sandbox data & employee list
        const [sandboxRes, empRes] = await Promise.all([
          fetch(getUrl('/api/v1/payroll/sandbox-data', companyId), { headers: getHeaders() }),
          fetch(getUrl('/api/v1/employees', companyId), { headers: getHeaders() })
        ]);

        if (sandboxRes.ok) {
          const sandboxData = await sandboxRes.json();
          setSlabsEngine(sandboxData.slabs || []);
          setConfigsEngine(sandboxData.configurations || []);
        }

        if (empRes.ok) {
          const empData = await empRes.json();
          setEmployeesList(empData.employees || []);
        }

        if (isCreateMode) {
          setActiveForm({
            ...emptyStructure,
            salaryYear: 2026
          });
          setLoading(false);
          return;
        }

        // Fetch target structure for Edit mode
        const structRes = await fetch(getUrl('/api/v1/payroll/structures', companyId), { headers: getHeaders() });
        if (structRes.ok) {
          const structData = await structRes.json();
          const target = (structData.structures || []).find(
            (s: any) => String(s.id) === String(structureId) || String(s.emp_id) === String(structureId)
          );

          if (target) {
            setActiveForm({
              id: target.id,
              empId: target.emp_id || 'N/A',
              employeeId: target.employee_id || target.emp_uuid || '',
              empUuid: target.emp_uuid || target.employee_id || '',
              name: target.full_name || target.name || 'Employee',
              doj: target.doj ? String(target.doj).split('T')[0] : '',
              salaryPerAnnum: Number(target.salary_per_annum || 0),
              salaryPerMonth: Number(target.salary_per_month || 0),
              basic: Number(target.basic || 0),
              hra: Number(target.hra || 0),
              ca: Number(target.ca || 0),
              ma: Number(target.ma || 0),
              sa: Number(target.sa || 0),
              employeePf: Number(target.employee_pf || 0),
              employeeEsi: Number(target.employee_esi || 0),
              professionalTax: Number(target.professional_tax || 0),
              employerPf: Number(target.employer_pf || 0),
              employerEsi: Number(target.employer_esi || 0),
              variablePay: Number(target.variable_pay || 0),
              retentionBonus: Number(target.retention_bonus || 0),
              netSalary: Number(target.net_salary || 0),
              monthlyCtc: Number(target.monthly_ctc || target.salary_per_month || 0),
              pfCheck: Number(target.pf_check ?? 1),
              esiCheck: Number(target.esi_check ?? 1),
              ptCheck: Boolean(target.pt_check ?? true),
              isStructureActive: Boolean(target.is_structure_active ?? true),
              isRetentionBonusApplicable: Boolean(target.is_retention_bonus_applicable ?? false),
              isVariablePayApplicable: Boolean(target.is_variable_pay_applicable ?? false),
              retentionBonusPercentage: Number(target.retention_bonus_percentage || 0),
              variablePayPercentage: Number(target.variable_pay_percentage || 0),
              salaryYear: Number(target.salary_year || new Date().getFullYear()),
              otherAllowance: Number(target.other_allowance || 0),
              mealFoodCoupons: Number(target.meal_food_coupons || 0),
              telephoneInternetReimbursement: Number(target.telephone_internet_reimbursement || 0),
              effectiveFromDate: target.effective_from_date ? String(target.effective_from_date).split('T')[0] : '',
              effectiveToDate: target.effective_to_date ? String(target.effective_to_date).split('T')[0] : '',
              taxRegime: target.tax_regime || 'New',
              createdAt: target.created_at ? String(target.created_at).split('T')[0] : ''
            });
          } else {
            showToast('Salary structure record not found', 'error');
            router.push('/dashboard/structure');
          }
        }
      } catch (err) {
        console.error('Error loading structure details:', err);
        showToast('Failed to load salary structure details', 'error');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [structureId, companyId]);

  // Recalculation Engine matching Formula Master Engine
  const calculateFormulas = (
    monthlyVal: number,
    pfOpt: number,
    esiOpt: number,
    ptOpt: boolean,
    isVar: boolean,
    varPct: number,
    isRet: boolean,
    retPct: number
  ) => {
    if (!monthlyVal || monthlyVal <= 0) {
      return {
        basic: 0, hra: 0, ca: 0, ma: 0, sa: 0,
        employeePf: 0, employeeEsi: 0, professionalTax: 0,
        employerPf: 0, employerEsi: 0,
        variablePay: 0, retentionBonus: 0,
        netSalary: 0, monthlyCtc: 0
      };
    }

    let basic = 0;
    let hra = 0;
    let ca = 0;
    let ma = 0;

    // 1. Slab Matching from slabsEngine
    const matchedSlab = slabsEngine.find((s: any) => {
      const minG = parseFloat(String(s.min_gross || 0));
      const maxG = parseFloat(String(s.max_gross || 999999999));
      return s.is_active !== false && monthlyVal >= minG && monthlyVal <= maxG;
    });

    // 2. Extract configurations for matched slab
    const activeConfigs = matchedSlab
      ? configsEngine
          .filter((c: any) => c.is_active !== false && String(c.slab_id) === String(matchedSlab.id))
          .sort((a: any, b: any) => Number(a.display_order || 0) - Number(b.display_order || 0))
      : [];

    if (activeConfigs.length > 0) {
      const resolved: Record<string, number> = {};

      for (const config of activeConfigs) {
        const code = String(config.component_code || '').toUpperCase();
        if (code === 'SA') continue;

        let baseValue = 0;
        const type = config.calculation_type_name;
        const val = parseFloat(String(config.calculation_value || 0));

        if (type === 'FixedAmount') {
          baseValue = val;
        } else if (type === 'PercentageOfGross') {
          baseValue = monthlyVal * (val / 100);
        } else if (type === 'PercentageOfComponent') {
          const parentCode = String(config.depends_on_component || '').toUpperCase();
          const parentVal = resolved[parentCode] || 0;
          baseValue = parentVal * (val / 100);
        }

        const minCap = parseFloat(String(config.min_cap || 0));
        const maxCap = config.max_cap ? parseFloat(String(config.max_cap)) : null;
        if (baseValue < minCap) baseValue = minCap;
        if (maxCap !== null && baseValue > maxCap) baseValue = maxCap;

        baseValue = Math.round(baseValue);
        resolved[code] = baseValue;
      }

      basic = Math.min(resolved['BASIC'] || 0, monthlyVal);
      hra = Math.min(resolved['HRA'] || 0, Math.max(0, monthlyVal - basic));
      ca = Math.min(resolved['CA'] !== undefined ? resolved['CA'] : 0, Math.max(0, monthlyVal - basic - hra));
      ma = Math.min(resolved['MA'] !== undefined ? resolved['MA'] : 0, Math.max(0, monthlyVal - basic - hra - ca));
    } else {
      // Fallback 50% basic, 50% hra of basic
      basic = Math.round(monthlyVal * 0.50);
      hra = Math.round(basic * 0.50);
      ca = Math.min(1600, Math.max(0, monthlyVal - basic - hra));
      ma = Math.min(1250, Math.max(0, monthlyVal - basic - hra - ca));
    }

    const sumFixed = basic + hra + ca + ma;
    const sa = Math.max(0, monthlyVal - sumFixed);

    // 3. Statutory Deductions
    let empPf = 0;
    let emprPf = 0;
    if (pfOpt === 1) {
      const pfBase = Math.min(basic, 15000);
      empPf = Math.round(pfBase * 0.12);
      emprPf = Math.round(pfBase * 0.12);
    }

    let empEsi = 0;
    let emprEsi = 0;
    if (esiOpt === 1 && monthlyVal <= 21000) {
      empEsi = Math.round(monthlyVal * 0.0075);
      emprEsi = Math.round(monthlyVal * 0.0325);
    }

    let pt = 0;
    if (ptOpt) {
      if (monthlyVal >= 20000) pt = 200;
      else if (monthlyVal >= 15000) pt = 150;
    }

    // BONUS
    const varPay = isVar ? Math.round((monthlyVal * varPct) / 100) : 0;
    const retBonus = isRet ? Math.round((monthlyVal * retPct) / 100) : 0;

    const netSal = monthlyVal - (empPf + empEsi + pt);
    const mCtc = monthlyVal + emprPf + emprEsi + varPay + retBonus;

    return {
      basic, hra, ca, ma, sa,
      employeePf: empPf,
      employeeEsi: empEsi,
      professionalTax: pt,
      employerPf: emprPf,
      employerEsi: emprEsi,
      variablePay: varPay,
      retentionBonus: retBonus,
      netSalary: netSal,
      monthlyCtc: mCtc
    };
  };

  const handleSalaryValueChange = (val: number, mode: 'annum' | 'month') => {
    let monthlyVal = 0;
    let annualVal = 0;

    if (mode === 'annum') {
      annualVal = val;
      monthlyVal = Math.round(val / 12);
    } else {
      monthlyVal = val;
      annualVal = val * 12;
    }

    const calcs = calculateFormulas(
      monthlyVal,
      activeForm.pfCheck,
      activeForm.esiCheck,
      activeForm.ptCheck,
      activeForm.isVariablePayApplicable,
      activeForm.variablePayPercentage,
      activeForm.isRetentionBonusApplicable,
      activeForm.retentionBonusPercentage
    );

    setActiveForm(prev => ({
      ...prev,
      salaryPerAnnum: annualVal,
      salaryPerMonth: monthlyVal,
      ...calcs
    }));
  };

  const handleToggleCompliance = (type: 'pf' | 'esi' | 'pt' | 'var' | 'ret' | 'status', extraValue?: any) => {
    let newPf = activeForm.pfCheck;
    let newEsi = activeForm.esiCheck;
    let newPt = activeForm.ptCheck;
    let newIsVar = activeForm.isVariablePayApplicable;
    let newVarPct = activeForm.variablePayPercentage;
    let newIsRet = activeForm.isRetentionBonusApplicable;
    let newRetPct = activeForm.retentionBonusPercentage;
    let newStatus = activeForm.isStructureActive;

    if (type === 'pf') newPf = newPf === 1 ? 0 : 1;
    if (type === 'esi') newEsi = newEsi === 1 ? 0 : 1;
    if (type === 'pt') newPt = !newPt;
    if (type === 'status') newStatus = !newStatus;
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

    const calcs = calculateFormulas(
      activeForm.salaryPerMonth,
      newPf, newEsi, newPt,
      newIsVar, newVarPct,
      newIsRet, newRetPct
    );

    setActiveForm(prev => ({
      ...prev,
      pfCheck: newPf,
      esiCheck: newEsi,
      ptCheck: newPt,
      isVariablePayApplicable: newIsVar,
      variablePayPercentage: newVarPct,
      isRetentionBonusApplicable: newIsRet,
      retentionBonusPercentage: newRetPct,
      isStructureActive: newStatus,
      ...calcs
    }));
  };

  const handleSelectEmployee = (empIdStr: string) => {
    setSelectedEmpId(empIdStr);
    const emp = employeesList.find((e: any) => String(e.id) === String(empIdStr));
    if (emp) {
      const code = emp.emp_id_code || emp.emp_id || emp.empId || '';
      const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim();
      const dojStr = emp.joining_date ? String(emp.joining_date).split('T')[0] : '';
      setActiveForm(prev => ({
        ...prev,
        empId: code,
        employeeId: emp.id,
        empUuid: emp.id,
        name: fullName,
        doj: dojStr
      }));
    }
  };

  const handleSave = async () => {
    if (!activeForm.empId || !activeForm.salaryPerAnnum) {
      showToast('Please specify valid employee and salary amounts', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = [{
        ...activeForm,
        id: activeForm.id
      }];

      const res = await fetch(getUrl('/api/v1/payroll/structures', companyId), {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast(`Salary structure for ${activeForm.name} saved successfully!`, 'success');
        router.push('/dashboard/structure');
      } else {
        const errJson = await res.json();
        showToast(errJson.error || 'Failed to save salary structure', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Network error saving salary structure', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadSampleCSV = () => {
    const headers = ['emp_id', 'annual_gross_salary', 'salary_year'];
    const sampleRows = [
      ['EMP101', '600000', '2026'],
      ['EMP102', '480000', '2026']
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...sampleRows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'Sample_Salary_Structures_Upload.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Sample CSV template downloaded successfully!', 'success');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r\n|\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) {
        showToast('CSV file must contain a header and at least 1 data row', 'error');
        return;
      }

      const headerCols = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
      const empIdIdx = headerCols.findIndex(h => h.includes('emp') || h.includes('code') || h.includes('id'));
      const grossIdx = headerCols.findIndex(h => h.includes('gross') || h.includes('salary') || h.includes('annum') || h.includes('amount') || h.includes('pay') || h.includes('ctc'));
      const yearIdx = headerCols.findIndex(h => h.includes('year') || h.includes('yr'));
      const pfIdx = headerCols.findIndex(h => h.includes('pf'));
      const esiIdx = headerCols.findIndex(h => h.includes('esi'));
      const ptIdx = headerCols.findIndex(h => h.includes('pt'));

      const parsed: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim().replace(/['"]/g, ''));
        if (cols.length === 0 || !cols.some(Boolean)) continue;

        const rawEmpId = empIdIdx !== -1 ? cols[empIdIdx] : cols[0];
        const rawGross = grossIdx !== -1 ? parseFloat(cols[grossIdx] || '0') : parseFloat(cols[1] || '0');
        const parsedYear = cols[2] && !isNaN(parseInt(cols[2])) ? parseInt(cols[2]) : new Date().getFullYear();
        const year = yearIdx !== -1 ? (parseInt(cols[yearIdx]) || parsedYear) : parsedYear;
        const pfCheck = pfIdx !== -1 ? (cols[pfIdx] === '0' ? 0 : 1) : 1;
        const esiCheck = esiIdx !== -1 ? (cols[esiIdx] === '0' ? 0 : 1) : 1;
        const ptCheck = ptIdx !== -1 ? (cols[ptIdx] === '0' || cols[ptIdx].toLowerCase() === 'false' ? false : true) : true;

        // Match employee in employeesList
        const emp = employeesList.find((e: any) => {
          const code = String(e.emp_id_code || e.emp_id || e.empId || '').trim().toLowerCase();
          const idStr = String(e.id || '').trim().toLowerCase();
          const target = String(rawEmpId || '').trim().toLowerCase();
          return code === target || idStr === target;
        });

        const monthlyVal = Math.round(rawGross / 12);
        const calcs = calculateFormulas(monthlyVal, pfCheck, esiCheck, ptCheck, false, 0, false, 0);

        const isValidEmp = Boolean(emp);
        const isValidGross = rawGross > 0;

        parsed.push({
          id: emp ? emp.id : undefined,
          empId: emp ? (emp.emp_id_code || emp.emp_id || rawEmpId) : rawEmpId,
          employeeId: emp ? emp.id : undefined,
          empUuid: emp ? emp.id : undefined,
          name: emp ? `${emp.first_name || ''} ${emp.last_name || ''}`.trim() : 'Unknown Employee',
          doj: emp?.joining_date ? String(emp.joining_date).split('T')[0] : '',
          salaryPerAnnum: rawGross,
          salaryPerMonth: monthlyVal,
          ...calcs,
          pfCheck,
          esiCheck,
          ptCheck,
          salaryYear: year,
          isStructureActive: true,
          status: !isValidEmp ? 'UNKNOWN_EMP' : (!isValidGross ? 'INVALID_GROSS' : 'VALID')
        });
      }

      setBulkParsedRows(parsed);
      showToast(`Parsed ${parsed.length} employee rows from CSV successfully`, 'success');
    };

    reader.readAsText(file);
  };

  const handleBulkSave = async () => {
    const validRows = bulkParsedRows.filter(r => r.status === 'VALID');
    if (validRows.length === 0) {
      showToast('No valid salary structure rows to save', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = validRows.map(r => ({
        empId: r.empId,
        employeeId: r.employeeId,
        empUuid: r.empUuid,
        fullName: r.name,
        salaryPerAnnum: r.salaryPerAnnum,
        salaryPerMonth: r.salaryPerMonth,
        basic: r.basic,
        hra: r.hra,
        ca: r.ca,
        ma: r.ma,
        sa: r.sa,
        employeePf: r.employeePf,
        employeeEsi: r.employeeEsi,
        professionalTax: r.professionalTax,
        employerPf: r.employerPf,
        employerEsi: r.employerEsi,
        variablePay: r.variablePay,
        retentionBonus: r.retentionBonus,
        netSalary: r.netSalary,
        monthlyCtc: r.monthlyCtc,
        pfCheck: r.pfCheck,
        esiCheck: r.esiCheck,
        ptCheck: r.ptCheck,
        salaryYear: r.salaryYear
      }));

      const res = await fetch(getUrl('/api/v1/payroll/structures', companyId), {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast(`Successfully uploaded ${validRows.length} salary structures!`, 'success');
        router.push('/dashboard/structure');
      } else {
        const errJson = await res.json();
        showToast(errJson.error || 'Failed bulk upload', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Network error during bulk upload', 'error');
    } finally {
      setSaving(false);
    }
  };

  const filteredEmpList = employeesList.filter((emp: any) => {
    const q = empSearchQuery.toLowerCase();
    const name = `${emp.first_name || ''} ${emp.last_name || ''}`.toLowerCase();
    const code = String(emp.emp_id_code || emp.emp_id || emp.empId || '').toLowerCase();
    return name.includes(q) || code.includes(q);
  });

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }} className="structure-detail-container font-['DM_Sans',sans-serif] space-y-4 animate-fadeIn w-full text-left">
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap" rel="stylesheet" />
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap');
        .structure-detail-container,
        .structure-detail-container td,
        .structure-detail-container th,
        .structure-detail-container button,
        .structure-detail-container input,
        .structure-detail-container select,
        .structure-detail-container label,
        .structure-detail-container span,
        .structure-detail-container div,
        .structure-detail-container p {
          font-family: 'DM Sans', sans-serif !important;
        }
      `}} />

      <DashboardPageHeader
        title={isCreateMode ? "Add New Salary Structure" : `Edit Structure - ${activeForm.name || 'Employee'}`}
        actionMessage=""
        actionError=""
        companies={companies}
        companyId={companyId}
        handleCompanyChange={(id) => setCompanyId(id)}
        isSuperAdmin={isSuperAdmin}
        hideCompanySelect={false}
        hideUserBadge={true}
      />

      {/* Navigation Top Bar */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => router.push('/dashboard/structure')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-2xs"
        >
          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to Salary Structure Database
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard/structure')}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 text-xs font-extrabold hover:bg-slate-100 transition-all cursor-pointer"
          >
            Cancel
          </button>

          {entryTab === 'single' ? (
            <button
              onClick={handleSave}
              disabled={saving || (!activeForm.empId && isCreateMode)}
              className="px-6 py-2 rounded-xl bg-[#07518a] hover:bg-[#064270] text-white text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shadow-md shadow-[#07518a]/25 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  {isCreateMode ? 'Create Structure' : 'Save Changes'}
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleBulkSave}
              disabled={saving || bulkParsedRows.filter(r => r.status === 'VALID').length === 0}
              className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shadow-md shadow-emerald-500/25 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  Upload & Save ({bulkParsedRows.filter(r => r.status === 'VALID').length} Records)
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* DUAL MODE SELECTION TABS */}
      {isCreateMode && (
        <div className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 w-fit">
          <button
            type="button"
            onClick={() => setEntryTab('single')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
              entryTab === 'single'
                ? 'bg-[#07518a] text-white shadow-md shadow-[#07518a]/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            Single Structure Entry
          </button>
          <button
            type="button"
            onClick={() => setEntryTab('bulk')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
              entryTab === 'bulk'
                ? 'bg-[#07518a] text-white shadow-md shadow-[#07518a]/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            Bulk CSV / Excel Upload
          </button>
        </div>
      )}

      {loading ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800">
          <PageLoader message="Loading salary structure configuration..." />
        </div>
      ) : entryTab === 'bulk' ? (
        /* BULK UPLOAD TAB VIEW */
        <div className="space-y-4">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-sm font-black uppercase text-slate-900 dark:text-slate-100 tracking-wider">
                  Bulk Salary Structures CSV Upload
                </h3>
                <p className="text-xs font-medium text-slate-500 mt-1">
                  Upload employee salary structures in bulk. Salary breakdowns will be calculated using the active Formula Engine.
                </p>
              </div>

              <button
                type="button"
                onClick={handleDownloadSampleCSV}
                className="px-4 py-2.5 rounded-xl border border-[#07518a]/30 dark:border-[#07518a]/40 bg-[#07518a]/10 dark:bg-[#07518a]/20 text-[#07518a] dark:text-[#38bdf8] text-xs font-extrabold hover:bg-[#07518a] hover:text-white transition-all cursor-pointer flex items-center gap-2 shrink-0 shadow-2xs"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M7.5 12L12 16.5m0 0l4.5-4.5M12 16.5V3" />
                </svg>
                Download Sample CSV
              </button>
            </div>

            {/* DRAG AND DROP ZONE */}
            <div className="border-2 border-dashed border-indigo-200 dark:border-indigo-900/60 rounded-3xl p-8 text-center bg-indigo-50/30 dark:bg-indigo-950/20 hover:bg-indigo-50/60 transition-all relative">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="space-y-3 pointer-events-none">
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-sm">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-black text-slate-800 dark:text-slate-200">
                    Click to browse or drag & drop CSV file here
                  </p>
                  <p className="text-[11px] font-bold text-slate-400 mt-1">
                    Required Columns: <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-indigo-600">emp_id</code>, <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-indigo-600">annual_gross_salary</code>, <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-indigo-600">salary_year</code> <span className="text-slate-400 font-semibold">(PF/ESI/PT default to Active)</span>
                  </p>
                </div>
              </div>
            </div>

            {/* PREVIEW TABLE */}
            {bulkParsedRows.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Parsed Preview ({bulkParsedRows.length} Rows)
                  </h4>
                  <div className="flex items-center gap-3 text-xs font-bold">
                    <span className="text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">
                      Valid: {bulkParsedRows.filter(r => r.status === 'VALID').length}
                    </span>
                    {bulkParsedRows.filter(r => r.status !== 'VALID').length > 0 && (
                      <span className="text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg">
                        Errors: {bulkParsedRows.filter(r => r.status !== 'VALID').length}
                      </span>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-extrabold uppercase text-[10px]">
                      <tr>
                        <th className="p-3">Emp ID</th>
                        <th className="p-3">Employee Name</th>
                        <th className="p-3">Annual Gross</th>
                        <th className="p-3">Monthly Gross</th>
                        <th className="p-3">Basic</th>
                        <th className="p-3">HRA</th>
                        <th className="p-3">CA + MA</th>
                        <th className="p-3">SA</th>
                        <th className="p-3">Deductions (PF+ESI+PT)</th>
                        <th className="p-3">Take-Home</th>
                        <th className="p-3">Monthly CTC</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                      {bulkParsedRows.map((row, idx) => (
                        <tr key={idx} className={row.status !== 'VALID' ? 'bg-rose-50/40 dark:bg-rose-950/20' : ''}>
                          <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{row.empId}</td>
                          <td className="p-3 font-semibold">{row.name}</td>
                          <td className="p-3 font-extrabold text-slate-900 dark:text-slate-100">₹{row.salaryPerAnnum?.toLocaleString('en-IN')}</td>
                          <td className="p-3 font-extrabold">₹{row.salaryPerMonth?.toLocaleString('en-IN')}</td>
                          <td className="p-3">₹{row.basic?.toLocaleString('en-IN')}</td>
                          <td className="p-3">₹{row.hra?.toLocaleString('en-IN')}</td>
                          <td className="p-3">₹{(row.ca + row.ma)?.toLocaleString('en-IN')}</td>
                          <td className="p-3">₹{row.sa?.toLocaleString('en-IN')}</td>
                          <td className="p-3 text-rose-600 font-semibold">-₹{(row.employeePf + row.employeeEsi + row.professionalTax)?.toLocaleString('en-IN')}</td>
                          <td className="p-3 font-black text-indigo-600 dark:text-indigo-400">₹{row.netSalary?.toLocaleString('en-IN')}</td>
                          <td className="p-3 font-black text-emerald-600 dark:text-emerald-400">₹{row.monthlyCtc?.toLocaleString('en-IN')}</td>
                          <td className="p-3">
                            {row.status === 'VALID' ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-700">Valid</span>
                            ) : row.status === 'UNKNOWN_EMP' ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-rose-100 text-rose-700">Emp Not Found</span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-700">Invalid Gross</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT 8 COLUMNS: FORM CARDS */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* HERO EMPLOYEE CARD */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-4">
              {isCreateMode ? (
                /* EMPLOYEE SELECTOR FOR CREATE MODE */
                <div className="space-y-3">
                  <label className="text-xs font-extrabold uppercase text-slate-700 dark:text-slate-300 tracking-wider">
                    Select Employee <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setEmpDropdownOpen(!empDropdownOpen)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center justify-between cursor-pointer"
                    >
                      <span>
                        {activeForm.name && activeForm.empId
                          ? `${activeForm.empId} - ${activeForm.name}`
                          : '-- Select Employee --'}
                      </span>
                      <svg className={`w-4 h-4 text-slate-400 transition-transform ${empDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>

                    {empDropdownOpen && (
                      <div className="absolute z-50 mt-2 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-3 max-h-64 flex flex-col">
                        <input
                          type="text"
                          placeholder="Search employee by name or ID..."
                          value={empSearchQuery}
                          onChange={e => setEmpSearchQuery(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold mb-2 outline-none"
                        />
                        <div className="overflow-y-auto flex-1 divide-y divide-slate-100 dark:divide-slate-800">
                          {filteredEmpList.map((emp: any) => (
                            <button
                              key={emp.id}
                              type="button"
                              onClick={() => {
                                handleSelectEmployee(String(emp.id));
                                setEmpDropdownOpen(false);
                              }}
                              className="w-full px-3 py-2.5 text-left text-xs font-semibold hover:bg-indigo-50 dark:hover:bg-slate-800 flex items-center justify-between rounded-xl transition-colors"
                            >
                              <span>{emp.emp_id_code ? `${emp.emp_id_code} - ` : ''}{emp.first_name || ''} {emp.last_name || ''}</span>
                              <span className="text-[10px] text-slate-400">{emp.department_name || emp.designation_name || ''}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-black text-lg flex items-center justify-center shadow-md shadow-indigo-500/25">
                      {(activeForm.name || 'E').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-base font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                        {activeForm.name || 'Employee'}
                      </h2>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-mono text-[11px] font-bold border border-indigo-100 dark:border-indigo-900/40">
                          {activeForm.empId}
                        </span>
                        <span className="text-xs font-medium text-slate-400">
                          DOJ: {activeForm.doj || 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Tax Regime Selector */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold uppercase text-slate-400 block">Tax Regime</label>
                      <select
                        value={activeForm.taxRegime}
                        onChange={e => setActiveForm({ ...activeForm, taxRegime: e.target.value })}
                        className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 font-bold text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 cursor-pointer"
                      >
                        <option value="New">New Tax Regime</option>
                        <option value="Old">Old Tax Regime</option>
                      </select>
                    </div>

                    {/* Status Toggle */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold uppercase text-slate-400 block">Structure Status</label>
                      <button
                        type="button"
                        onClick={() => handleToggleCompliance('status')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold uppercase transition-all cursor-pointer border ${
                          activeForm.isStructureActive 
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' 
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {activeForm.isStructureActive ? 'Active' : 'Inactive'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* BASE SALARY INPUT CARD */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-6h6" />
                    </svg>
                  </div>
                  <h3 className="text-xs font-black uppercase text-slate-900 dark:text-slate-100 tracking-wider">
                    Base Salary Specification
                  </h3>
                </div>

                {/* Salary Year Dropdown & Input Mode Switcher */}
                <div className="flex items-center gap-3">
                  {/* SALARY YEAR DROPDOWN */}
                  <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Year:</span>
                    <select
                      value={activeForm.salaryYear || new Date().getFullYear()}
                      onChange={e => setActiveForm(prev => ({ ...prev, salaryYear: Number(e.target.value) }))}
                      className="bg-transparent text-xs font-extrabold text-indigo-600 dark:text-indigo-400 outline-none cursor-pointer"
                      title="Select Salary Structure Year"
                    >
                      {(() => {
                        const cy = new Date().getFullYear();
                        return [cy, cy - 1, cy - 2].map(yr => (
                          <option key={yr} value={yr} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-bold">
                            {yr}
                          </option>
                        ));
                      })()}
                    </select>
                  </div>

                  {/* Mode Switcher */}
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setSalaryInputMode('annum');
                        handleSalaryValueChange(activeForm.salaryPerAnnum, 'annum');
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        salaryInputMode === 'annum'
                          ? 'bg-[#07518a] text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      Annual (Gross)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSalaryInputMode('month');
                        handleSalaryValueChange(activeForm.salaryPerMonth, 'month');
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        salaryInputMode === 'month'
                          ? 'bg-[#07518a] text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      Monthly (Gross)
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-extrabold uppercase text-slate-500 dark:text-slate-400 block mb-1.5">
                    Annual Gross Salary (₹)
                  </label>
                  <div className="flex items-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden focus-within:border-indigo-500 transition-all shadow-2xs">
                    <span className="px-3 py-2.5 bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-black text-xs select-none">
                      ₹
                    </span>
                    <input
                      type="number"
                      placeholder="e.g. 600000"
                      value={activeForm.salaryPerAnnum || ''}
                      onChange={e => handleSalaryValueChange(Number(e.target.value), 'annum')}
                      className="w-full bg-transparent border-none px-3.5 py-2.5 font-extrabold text-xs text-slate-800 dark:text-slate-100 outline-none focus:ring-0"
                      style={{ outline: 'none', border: 'none' }}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-extrabold uppercase text-slate-500 dark:text-slate-400 block mb-1.5">
                    Monthly Gross Salary (₹)
                  </label>
                  <div className="flex items-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden focus-within:border-indigo-500 transition-all shadow-2xs">
                    <span className="px-3 py-2.5 bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-black text-xs select-none">
                      ₹
                    </span>
                    <input
                      type="number"
                      placeholder="e.g. 50000"
                      value={activeForm.salaryPerMonth || ''}
                      onChange={e => handleSalaryValueChange(Number(e.target.value), 'month')}
                      className="w-full bg-transparent border-none px-3.5 py-2.5 font-extrabold text-xs text-slate-800 dark:text-slate-100 outline-none focus:ring-0"
                      style={{ outline: 'none', border: 'none' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* EARNINGS COMPONENTS CARD */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-6h6" />
                  </svg>
                </div>
                <h3 className="text-xs font-black uppercase text-slate-900 dark:text-slate-100 tracking-wider">
                  Monthly Earnings Breakdown
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">Basic Salary (₹)</label>
                  <input
                    type="number"
                    value={activeForm.basic}
                    onChange={e => setActiveForm({ ...activeForm, basic: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">HRA (₹)</label>
                  <input
                    type="number"
                    value={activeForm.hra}
                    onChange={e => setActiveForm({ ...activeForm, hra: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">Conveyance (CA ₹)</label>
                  <input
                    type="number"
                    value={activeForm.ca}
                    onChange={e => setActiveForm({ ...activeForm, ca: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">Medical (MA ₹)</label>
                  <input
                    type="number"
                    value={activeForm.ma}
                    onChange={e => setActiveForm({ ...activeForm, ma: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">Special Allowance (SA ₹)</label>
                  <input
                    type="number"
                    value={activeForm.sa}
                    onChange={e => setActiveForm({ ...activeForm, sa: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">Other Allowance (₹)</label>
                  <input
                    type="number"
                    value={activeForm.otherAllowance}
                    onChange={e => setActiveForm({ ...activeForm, otherAllowance: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* STATUTORY & COMPLIANCE TOGGLES CARD */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                </div>
                <h3 className="text-xs font-black uppercase text-slate-900 dark:text-slate-100 tracking-wider">
                  Statutory Compliance Controls
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* PF Toggle Box */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">PF Check</span>
                    <button
                      type="button"
                      onClick={() => handleToggleCompliance('pf')}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                        activeForm.pfCheck === 1 ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${activeForm.pfCheck === 1 ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  <p className="text-[10.5px] font-semibold text-slate-400">Employee PF: ₹{activeForm.employeePf}</p>
                </div>

                {/* ESI Toggle Box */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">ESI Check</span>
                    <button
                      type="button"
                      onClick={() => handleToggleCompliance('esi')}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                        activeForm.esiCheck === 1 ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${activeForm.esiCheck === 1 ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  <p className="text-[10.5px] font-semibold text-slate-400">Employee ESI: ₹{activeForm.employeeEsi}</p>
                </div>

                {/* PT Toggle Box */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">PT Check</span>
                    <button
                      type="button"
                      onClick={() => handleToggleCompliance('pt')}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                        activeForm.ptCheck ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${activeForm.ptCheck ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  <p className="text-[10.5px] font-semibold text-slate-400">Prof. Tax: ₹{activeForm.professionalTax}</p>
                </div>
              </div>
            </div>

            {/* VARIABLE PAY & RETENTION BONUS CARD */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H4.5a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12" />
                  </svg>
                </div>
                <h3 className="text-xs font-black uppercase text-slate-900 dark:text-slate-100 tracking-wider">
                  Variable & Retention Incentive Parameters
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Retention Bonus Controls */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">Retention Bonus</span>
                    <button
                      type="button"
                      onClick={() => handleToggleCompliance('ret')}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                        activeForm.isRetentionBonusApplicable ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${activeForm.isRetentionBonusApplicable ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">Retention Bonus Percentage (%)</label>
                    <input
                      type="number"
                      disabled={!activeForm.isRetentionBonusApplicable}
                      value={activeForm.retentionBonusPercentage}
                      onChange={e => handleToggleCompliance('ret', Number(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none disabled:opacity-40"
                    />
                  </div>
                </div>

                {/* Variable Pay Controls */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">Variable Pay</span>
                    <button
                      type="button"
                      onClick={() => handleToggleCompliance('var')}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                        activeForm.isVariablePayApplicable ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${activeForm.isVariablePayApplicable ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">Variable Pay Percentage (%)</label>
                    <input
                      type="number"
                      disabled={!activeForm.isVariablePayApplicable}
                      value={activeForm.variablePayPercentage}
                      onChange={e => handleToggleCompliance('var', Number(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none disabled:opacity-40"
                    />
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT 4 COLUMNS: LIVE SUMMARY CARD */}
          <div className="lg:col-span-4 space-y-6">
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xl sticky top-6 space-y-5">
              <h3 className="text-xs font-black uppercase text-slate-900 dark:text-slate-100 tracking-wider border-b border-slate-100 dark:border-slate-800 pb-3">
                Live Salary Computation Matrix
              </h3>

              {/* NET SALARY HIGHLIGHT */}
              <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 space-y-1">
                <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">
                  Net Monthly Take-Home
                </span>
                <div className="text-2xl font-black text-indigo-700 dark:text-indigo-300">
                  ₹{activeForm.netSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>

              {/* MONTHLY CTC HIGHLIGHT */}
              <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 space-y-1">
                <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                  Monthly Total CTC
                </span>
                <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
                  ₹{activeForm.monthlyCtc.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>

              {/* DETAILED STATS */}
              <div className="space-y-2.5 pt-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                  <span>Annual Gross</span>
                  <strong className="text-slate-900 dark:text-slate-100 font-extrabold">
                    ₹{activeForm.salaryPerAnnum.toLocaleString('en-IN')}
                  </strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                  <span>Annual CTC</span>
                  <strong className="text-slate-900 dark:text-slate-100 font-extrabold">
                    ₹{(activeForm.monthlyCtc * 12).toLocaleString('en-IN')}
                  </strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                  <span>Basic Salary</span>
                  <strong className="text-slate-900 dark:text-slate-100 font-bold">
                    ₹{activeForm.basic.toLocaleString('en-IN')}
                  </strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                  <span>HRA</span>
                  <strong className="text-slate-900 dark:text-slate-100 font-bold">
                    ₹{activeForm.hra.toLocaleString('en-IN')}
                  </strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                  <span>Conveyance (CA)</span>
                  <strong className="text-slate-900 dark:text-slate-100 font-bold">
                    ₹{activeForm.ca.toLocaleString('en-IN')}
                  </strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                  <span>Medical (MA)</span>
                  <strong className="text-slate-900 dark:text-slate-100 font-bold">
                    ₹{activeForm.ma.toLocaleString('en-IN')}
                  </strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                  <span>Special Allowance (SA)</span>
                  <strong className="text-slate-900 dark:text-slate-100 font-bold">
                    ₹{activeForm.sa.toLocaleString('en-IN')}
                  </strong>
                </div>
                {activeForm.pfCheck === 1 && (
                  <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                    <span>Employee PF</span>
                    <strong className="text-rose-600 dark:text-rose-400 font-bold">
                      -₹{activeForm.employeePf.toLocaleString('en-IN')}
                    </strong>
                  </div>
                )}
                {activeForm.esiCheck === 1 && (
                  <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                    <span>Employee ESI</span>
                    <strong className="text-rose-600 dark:text-rose-400 font-bold">
                      -₹{activeForm.employeeEsi.toLocaleString('en-IN')}
                    </strong>
                  </div>
                )}
                {activeForm.ptCheck && (
                  <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                    <span>Professional Tax (PT)</span>
                    <strong className="text-rose-600 dark:text-rose-400 font-bold">
                      -₹{activeForm.professionalTax.toLocaleString('en-IN')}
                    </strong>
                  </div>
                )}
              </div>

              {/* SAVE / CANCEL BUTTONS */}
              <div className="pt-4 space-y-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full py-3 rounded-xl bg-[#07518a] hover:bg-[#064270] text-white text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-[#07518a]/25 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Salary Structure'}
                </button>
                <button
                  onClick={() => router.push('/dashboard/structure')}
                  className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 text-xs font-bold hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Cancel & Go Back
                </button>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
