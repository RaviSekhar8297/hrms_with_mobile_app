'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import DashboardPageHeader from '../../components/DashboardPageHeader';
import { useDashboard } from '../../components/DashboardContext';
import { getHeaders, getUrl } from '../../utils/api';

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
  const { showToast } = useDashboard();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  
  const [activeForm, setActiveForm] = useState<SalaryStructureItem>(emptyStructure);
  const [salaryInputMode, setSalaryInputMode] = useState<'annum' | 'month'>('annum');
  const [slabsEngine, setSlabsEngine] = useState<any[]>([]);
  const [configsEngine, setConfigsEngine] = useState<any[]>([]);

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

  // Fetch Sandbox Data & Target Structure
  useEffect(() => {
    if (!structureId) return;

    const loadData = async () => {
      setLoading(true);
      try {
        // Fetch formula sandbox data
        const sandboxRes = await fetch(getUrl('/api/v1/payroll/sandbox-data', companyId), { headers: getHeaders() });
        if (sandboxRes.ok) {
          const sandboxData = await sandboxRes.json();
          setSlabsEngine(sandboxData.slabs || []);
          setConfigsEngine(sandboxData.configurations || []);
        }

        // Fetch target structure
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

  // Recalculation Engine
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

    let bPct = 0.40;
    let hPct = 0.40;
    let caAmt = 1600;
    let maAmt = 1250;

    if (slabsEngine.length > 0) {
      const activeSlab = slabsEngine.find((s: any) =>
        monthlyVal >= Number(s.min_salary || 0) &&
        (s.max_salary === null || monthlyVal <= Number(s.max_salary))
      ) || slabsEngine[0];

      if (activeSlab) {
        bPct = Number(activeSlab.basic_percentage || 40) / 100;
        hPct = Number(activeSlab.hra_percentage || 40) / 100;
        caAmt = Number(activeSlab.conveyance_allowance || 1600);
        maAmt = Number(activeSlab.medical_allowance || 1250);
      }
    }

    const basic = Math.round(monthlyVal * bPct);
    const hra = Math.round(basic * hPct);
    const ca = caAmt;
    const ma = maAmt;
    const sumFixed = basic + hra + ca + ma;
    const sa = Math.max(0, monthlyVal - sumFixed);

    // DEDUCTIONS & COMPLIANCE
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
        showToast(`Salary structure for ${activeForm.name} updated successfully!`, 'success');
        router.push('/dashboard/structure');
      } else {
        const errJson = await res.json();
        showToast(errJson.error || 'Failed to update salary structure', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Network error updating salary structure', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }} className="font-['DM_Sans',sans-serif] space-y-6 animate-fadeIn w-full text-left pb-16">
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap" rel="stylesheet" />
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap');
        .font-sans, .font-mono, td, th, button, input, select, label, span, div, p, h3, h4, h5, h6 {
          font-family: 'DM Sans', sans-serif !important;
        }
      `}} />

      <DashboardPageHeader
        title={`Edit Salary Structure — ${activeForm.empId}`}
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

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shadow-md shadow-indigo-500/25 disabled:opacity-50"
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
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center space-y-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800">
          <div className="w-10 h-10 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500">Loading salary structure configuration...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT 8 COLUMNS: FORM CARDS */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* HERO EMPLOYEE CARD */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-black text-lg flex items-center justify-center shadow-md shadow-indigo-500/25">
                    {activeForm.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                      {activeForm.name}
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

                {/* Salary Input Mode Switcher */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setSalaryInputMode('annum');
                      handleSalaryValueChange(activeForm.salaryPerAnnum, 'annum');
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      salaryInputMode === 'annum'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    Annual (CTC)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSalaryInputMode('month');
                      handleSalaryValueChange(activeForm.salaryPerMonth, 'month');
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      salaryInputMode === 'month'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    Monthly (Gross)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-extrabold uppercase text-slate-500 dark:text-slate-400 block mb-1.5">
                    Annual Salary (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-extrabold text-xs">₹</span>
                    <input
                      type="number"
                      value={activeForm.salaryPerAnnum || ''}
                      onChange={e => handleSalaryValueChange(Number(e.target.value), 'annum')}
                      placeholder="e.g. 600000"
                      className="w-full !pl-8 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-extrabold text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-extrabold uppercase text-slate-500 dark:text-slate-400 block mb-1.5">
                    Monthly Salary (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-extrabold text-xs">₹</span>
                    <input
                      type="number"
                      value={activeForm.salaryPerMonth || ''}
                      onChange={e => handleSalaryValueChange(Number(e.target.value), 'month')}
                      placeholder="e.g. 50000"
                      className="w-full !pl-8 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-extrabold text-emerald-600 dark:text-emerald-400 outline-none focus:border-indigo-500 transition-all"
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
                  <span>Annual CTC</span>
                  <strong className="text-slate-900 dark:text-slate-100 font-extrabold">
                    ₹{activeForm.salaryPerAnnum.toLocaleString('en-IN')}
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
                  <span>Conveyance + Medical</span>
                  <strong className="text-slate-900 dark:text-slate-100 font-bold">
                    ₹{(activeForm.ca + activeForm.ma).toLocaleString('en-IN')}
                  </strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                  <span>Special Allowance</span>
                  <strong className="text-slate-900 dark:text-slate-100 font-bold">
                    ₹{activeForm.sa.toLocaleString('en-IN')}
                  </strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                  <span>Employee PF + ESI + PT</span>
                  <strong className="text-rose-600 dark:text-rose-400 font-bold">
                    -₹{(activeForm.employeePf + activeForm.employeeEsi + activeForm.professionalTax).toLocaleString('en-IN')}
                  </strong>
                </div>
              </div>

              {/* SAVE / CANCEL BUTTONS */}
              <div className="pt-4 space-y-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-indigo-500/25 disabled:opacity-50"
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
