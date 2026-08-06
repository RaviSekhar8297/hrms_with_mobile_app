'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardPageHeader from '../components/DashboardPageHeader';
import SlideDrawer from '../components/SlideDrawer';
import { useDashboard } from '../components/DashboardContext';
import { getHeaders } from '../utils/api';
import { usePermissions } from '../hooks/usePermissions';

interface Company {
  id: string;
  name: string;
  subdomain: string;
  status: string;
  created_at: string;
}

interface Slab {
  id: string;
  slab_name: string;
  min_gross: number;
  max_gross: number;
  description: string;
  is_active: boolean;
}

interface Component {
  id: string;
  component_code: string;
  component_name: string;
  component_type: 'EARNINGS' | 'DEDUCTION' | 'REIMBURSEMENT';
  is_statutory: boolean;
  is_taxable: boolean;
  display_order: number;
  is_active: boolean;
}

interface CalculationType {
  id: string;
  type_name: string;
  description: string;
}

interface Configuration {
  id: string;
  slab_id: string;
  slab_name?: string;
  component_code: string;
  component_name?: string;
  calculation_type_id: string;
  calculation_type_name?: string;
  calculation_value: number;
  depends_on_component: string | null;
  formula_expression: string;
  employee_type: string;
  is_prorata: boolean;
  min_cap: number;
  max_cap: number | null;
  display_order: number;
  is_active: boolean;
}

// Tab definitions with permission keys
const FORMULA_TABS = [
  { id: 'slabs',      label: '1. Salary Slabs',                   permission: 'view_salary_slabs' },
  { id: 'components', label: '2. Salary Components',              permission: 'view_salary_components' },
  { id: 'calctypes',  label: '3. Calculation Type Master',        permission: 'view_calculation_types' },
  { id: 'configs',    label: '4. Salary Component Configuration', permission: 'view_salary_component_configurations' },
] as const;

type FormulaTabId = typeof FORMULA_TABS[number]['id'];

export default function PayrollFormulaPage() {
  const router = useRouter();
  const { showToast } = useDashboard();
  const { hasPermission } = usePermissions();
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);

  // Engine cache states
  const [slabs, setSlabs] = useState<Slab[]>([]);
  const [components, setComponents] = useState<Component[]>([]);
  const [calculationTypes, setCalculationTypes] = useState<CalculationType[]>([]);
  const [configurations, setConfigurations] = useState<Configuration[]>([]);
  const [loading, setLoading] = useState(true);

  // Active sub-tab under engine
  const [activeTab, setActiveTab] = useState<FormulaTabId>('slabs');

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination for configs
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Drawer status
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);

  // Form inputs
  const [slabForm, setSlabForm] = useState({
    slab_name: '',
    min_gross: '',
    max_gross: '',
    description: '',
    is_active: true
  });

  const [componentForm, setComponentForm] = useState({
    component_code: '',
    component_name: '',
    component_type: 'EARNINGS' as any,
    is_statutory: false,
    is_taxable: true,
    display_order: '1',
    is_active: true
  });

  const [configForm, setConfigForm] = useState({
    slab_id: '',
    component_code: '',
    calculation_type_id: '',
    calculation_value: '',
    depends_on_component: '',
    formula_expression: '',
    employee_type: 'ALL',
    is_prorata: true,
    min_cap: '0',
    max_cap: '',
    display_order: '1',
    is_active: true
  });

  // Sandbox simulation states
  const [sbGross, setSbGross] = useState('');
  const [sbTotalDays, setSbTotalDays] = useState('30');
  const [sbPayableDays, setSbPayableDays] = useState('');
  const [sbEmployeeType, setSbEmployeeType] = useState('Permanent');
  const [sbResults, setSbResults] = useState<any[]>([]);
  const [sbMatchedSlab, setSbMatchedSlab] = useState<Slab | null>(null);
  const [sbSummary, setSbSummary] = useState({
    gross: 0,
    earnedGross: 0,
    tds: 0,
    pf: 0,
    esi: 0,
    pt: 0,
    net: 0
  });

  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('superadmin');

  // Filter tabs based on permissions
  const visibleTabs = FORMULA_TABS.filter(t => hasPermission(t.permission));

  // Auto-correct activeTab if it's not visible
  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.find(t => t.id === activeTab)) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [visibleTabs.map(t => t.id).join(',')]);

  // Load context credentials
  useEffect(() => {
    const storedRoles = localStorage.getItem('roles');
    const storedEmail = localStorage.getItem('email');
    const storedCompanyId = localStorage.getItem('companyId');
    if (storedRoles) setRoles(JSON.parse(storedRoles));
    if (storedEmail) setEmail(storedEmail);
    if (storedCompanyId) setCompanyId(storedCompanyId);
  }, []);

  // Fetch sandbox engines data
  const loadEngineData = async () => {
    setLoading(true);
    try {
      const url = `http://localhost:5000/api/v1/payroll/sandbox-data${companyId ? `?companyId=${companyId}` : ''}`;
      const res = await fetch(url, { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) {
        setSlabs(data.slabs || []);
        setComponents(data.components || []);
        setCalculationTypes(data.calculationTypes || []);
        setConfigurations(data.configurations || []);
      } else {
        showToast(data.error || 'Failed to load salary engine configuration.', 'error');
      }
    } catch (e: any) {
      showToast('Connection error loading engine configs: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEngineData();
  }, [companyId]);

  const fetchCompanies = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/v1/companies', { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) setCompanies(data.companies || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      fetchCompanies();
    }
  }, [companyId, isSuperAdmin]);

  const handleCompanyChange = (id: string) => {
    const val = id || null;
    setCompanyId(val);
    if (val) {
      localStorage.setItem('companyId', val);
    } else {
      localStorage.removeItem('companyId');
    }
  };

  // Live sandbox simulator math
  useEffect(() => {
    runSandboxMath();
  }, [sbGross, sbTotalDays, sbPayableDays, sbEmployeeType, slabs, configurations]);

  const runSandboxMath = () => {
    const gross = parseFloat(sbGross);
    const totalDays = parseInt(sbTotalDays);
    let payableDays = parseFloat(sbPayableDays);

    if (isNaN(gross) || gross <= 0 || isNaN(totalDays) || totalDays <= 0 || isNaN(payableDays) || payableDays < 0) {
      setSbMatchedSlab(null);
      setSbResults([]);
      setSbSummary({ gross: 0, earnedGross: 0, tds: 0, pf: 0, esi: 0, pt: 0, net: 0 });
      return;
    }

    if (payableDays > totalDays) payableDays = totalDays;

    // 1. Slab Matching
    const matched = slabs.find(s => s.is_active && gross >= parseFloat(s.min_gross as any) && gross <= parseFloat(s.max_gross as any));
    if (!matched) {
      setSbMatchedSlab(null);
      setSbResults([]);
      setSbSummary({ gross, earnedGross: 0, tds: 0, pf: 0, esi: 0, pt: 0, net: 0 });
      return;
    }
    setSbMatchedSlab(matched);

    const attFactor = payableDays / totalDays;
    const earnedGross = gross * attFactor;

    // Filter configurations for this slab, sorted by display_order
    const activeConfigs = configurations
      .filter(c => c.is_active && c.slab_id === matched.id)
      .sort((a, b) => a.display_order - b.display_order);

    const resolved: { [code: string]: { base: number; earned: number; config: Configuration } } = {};
    const isTempOrStipend = (sbEmployeeType === 'Temporary' || sbEmployeeType === 'Stipend');

    // Run primary components (excluding SA balancing remainder)
    for (const config of activeConfigs) {
      const code = config.component_code.toUpperCase();
      if (code === 'SA') continue;

      let baseValue = 0;
      const type = config.calculation_type_name;
      const val = parseFloat(config.calculation_value as any);

      if (isTempOrStipend) {
        if (code === 'BASIC') {
          baseValue = gross;
        } else {
          baseValue = 0;
        }
      } else {
        if (type === 'FixedAmount') {
          baseValue = val;
        } else if (type === 'PercentageOfGross') {
          baseValue = gross * (val / 100);
        } else if (type === 'PercentageOfComponent') {
          const parentCode = (config.depends_on_component || '').toUpperCase();
          const parent = resolved[parentCode];
          const parentEarned = parent ? parent.earned : 0;
          baseValue = parentEarned * (val / 100);
        }
      }

      // Check min/max capping
      const minCap = parseFloat(config.min_cap as any) || 0;
      const maxCap = config.max_cap ? parseFloat(config.max_cap as any) : null;
      if (baseValue < minCap) baseValue = minCap;
      if (maxCap !== null && baseValue > maxCap) baseValue = maxCap;

      // Apply proration
      let earnedValue = baseValue;
      if (isTempOrStipend) {
        if (code === 'BASIC') {
          earnedValue = baseValue * attFactor;
        } else {
          earnedValue = 0;
        }
      } else if (config.is_prorata) {
        earnedValue = baseValue * attFactor;
      }

      resolved[code] = {
        base: baseValue,
        earned: earnedValue,
        config
      };
    }

    // SA balancing remainder
    let saConfig = activeConfigs.find(c => c.component_code.toUpperCase() === 'SA');
    if (!saConfig) {
      saConfig = {
        id: 'sa-virtual',
        slab_id: matched.id,
        component_code: 'SA',
        calculation_type_id: '',
        calculation_type_name: 'FixedAmount',
        calculation_value: 0,
        depends_on_component: null,
        formula_expression: '',
        employee_type: 'ALL',
        is_prorata: true,
        min_cap: 0,
        max_cap: null,
        display_order: 999,
        is_active: true
      };
    }

    let otherBaseTotal = 0;
    let otherEarnedTotal = 0;
    Object.keys(resolved).forEach(k => {
      otherBaseTotal += resolved[k].base;
      otherEarnedTotal += resolved[k].earned;
    });

    let saBase = isTempOrStipend ? 0 : (gross - otherBaseTotal);
    let saEarned = isTempOrStipend ? 0 : (earnedGross - otherEarnedTotal);
    if (saBase < 0) saBase = 0;
    if (saEarned < 0) saEarned = 0;

    resolved['SA'] = {
      base: saBase,
      earned: saEarned,
      config: saConfig
    };

    // Build calculation results list
    const resultsList: any[] = [];
    activeConfigs.forEach(c => {
      const code = c.component_code.toUpperCase();
      if (code === 'SA') return;
      const item = resolved[code];
      if (item) {
        resultsList.push({
          code,
          name: components.find(comp => comp.component_code === code)?.component_name || code,
          type: c.calculation_type_name,
          val: c.calculation_value,
          depends: c.depends_on_component,
          base: item.base,
          earned: item.earned,
          prorata: c.is_prorata
        });
      }
    });

    // Add SA as the last item
    const saItem = resolved['SA'];
    if (saItem) {
      resultsList.push({
        code: 'SA',
        name: components.find(comp => comp.component_code === 'SA')?.component_name || 'Special Allowance',
        type: 'Balancing Remainder',
        val: 0,
        depends: null,
        base: saItem.base,
        earned: saItem.earned,
        prorata: true
      });
    }

    setSbResults(resultsList);

    // DEDUCTIONS
    // 1. TDS (New Tax Regime slabs)
    const calculateTDSValue = (monthlyGross: number) => {
      const annualGross = monthlyGross * 12;
      if (annualGross <= 1275000) return 0;
      const nti = annualGross - 75000;
      let annualTax = 0;
      if (nti <= 400000) {
        annualTax = 0;
      } else if (nti <= 800000) {
        annualTax = (nti - 400000) * 0.05;
      } else if (nti <= 1200000) {
        annualTax = 20000 + (nti - 800000) * 0.10;
      } else if (nti <= 1600000) {
        annualTax = 60000 + (nti - 1200000) * 0.15;
      } else if (nti <= 2000000) {
        annualTax = 120000 + (nti - 1600000) * 0.20;
      } else if (nti <= 2400000) {
        annualTax = 200000 + (nti - 2000000) * 0.25;
      } else {
        annualTax = 280000 + (nti - 2400000) * 0.30;
      }
      return Math.round((annualTax * 1.04) / 12);
    };

    const earnedTDS = calculateTDSValue(earnedGross);

    // 2. PF: 12% of Basic up to 15,000 max (cap 1800)
    const basicEarned = resolved['BASIC']?.earned || 0;
    const earnedPF = Math.round(basicEarned >= 15000 ? 1800 : basicEarned * 0.12);

    // 3. ESI: 0.75% of Gross if Gross < 21000
    const earnedESI = Math.round(gross < 21000 ? earnedGross * 0.0075 : 0);

    // 4. PT: Professional Tax based on earned gross slabs
    const earnedPT = earnedGross >= 20001 ? 200 : (earnedGross >= 15001 ? 150 : 0);

    const netSalary = Math.round(earnedGross - (earnedTDS + earnedPF + earnedESI + earnedPT));

    setSbSummary({
      gross,
      earnedGross,
      tds: earnedTDS,
      pf: earnedPF,
      esi: earnedESI,
      pt: earnedPT,
      net: netSalary
    });
  };

  // Open Drawer configurations
  const handleOpenDrawer = (item: any = null) => {
    setEditingItem(item);
    if (activeTab === 'slabs') {
      setSlabForm({
        slab_name: item ? item.slab_name : '',
        min_gross: item ? String(item.min_gross) : '',
        max_gross: item ? String(item.max_gross) : '',
        description: item ? item.description : '',
        is_active: item ? item.is_active : true
      });
    } else if (activeTab === 'components') {
      setComponentForm({
        component_code: item ? item.component_code : '',
        component_name: item ? item.component_name : '',
        component_type: item ? item.component_type : 'EARNINGS',
        is_statutory: item ? item.is_statutory : false,
        is_taxable: item ? item.is_taxable : true,
        display_order: item ? String(item.display_order) : '1',
        is_active: item ? item.is_active : true
      });
    } else if (activeTab === 'configs') {
      setConfigForm({
        slab_id: item ? item.slab_id : (slabs[0]?.id || ''),
        component_code: item ? item.component_code : (components[0]?.component_code || ''),
        calculation_type_id: item ? item.calculation_type_id : (calculationTypes[0]?.id || ''),
        calculation_value: item ? String(item.calculation_value) : '',
        depends_on_component: item ? (item.depends_on_component || '') : '',
        formula_expression: item ? item.formula_expression : '',
        employee_type: item ? item.employee_type : 'ALL',
        is_prorata: item ? item.is_prorata : true,
        min_cap: item ? String(item.min_cap) : '0',
        max_cap: item ? (item.max_cap ? String(item.max_cap) : '') : '',
        display_order: item ? String(item.display_order) : '1',
        is_active: item ? item.is_active : true
      });
    }
    setDrawerOpen(true);
  };

  // CRUD submit logic
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let url = '';
    let method = 'POST';
    let payload: any = {};

    if (activeTab === 'slabs') {
      if (!slabForm.slab_name || !slabForm.min_gross || !slabForm.max_gross) {
        showToast('Please enter all slab required fields.', 'error');
        return;
      }
      url = 'http://localhost:5000/api/v1/payroll/slabs';
      payload = {
        slab_name: slabForm.slab_name,
        min_gross: parseFloat(slabForm.min_gross),
        max_gross: parseFloat(slabForm.max_gross),
        description: slabForm.description,
        is_active: slabForm.is_active,
        companyId
      };
    } else if (activeTab === 'components') {
      if (!componentForm.component_code || !componentForm.component_name) {
        showToast('Please enter component details.', 'error');
        return;
      }
      url = 'http://localhost:5000/api/v1/payroll/components';
      payload = {
        component_code: componentForm.component_code.trim().toUpperCase(),
        component_name: componentForm.component_name,
        component_type: componentForm.component_type,
        is_statutory: componentForm.is_statutory,
        is_taxable: componentForm.is_taxable,
        display_order: parseInt(componentForm.display_order) || 1,
        is_active: componentForm.is_active,
        companyId
      };
    } else if (activeTab === 'configs') {
      if (!configForm.slab_id || !configForm.component_code || !configForm.calculation_type_id || !configForm.calculation_value) {
        showToast('Please specify all component configuration parameters.', 'error');
        return;
      }
      url = 'http://localhost:5000/api/v1/payroll/configurations';
      payload = {
        slab_id: configForm.slab_id,
        component_code: configForm.component_code,
        calculation_type_id: configForm.calculation_type_id,
        calculation_value: parseFloat(configForm.calculation_value),
        depends_on_component: configForm.depends_on_component || null,
        formula_expression: configForm.formula_expression,
        employee_type: configForm.employee_type,
        is_prorata: configForm.is_prorata,
        min_cap: parseFloat(configForm.min_cap) || 0,
        max_cap: configForm.max_cap ? parseFloat(configForm.max_cap) : null,
        display_order: parseInt(configForm.display_order) || 1,
        is_active: configForm.is_active,
        companyId
      };
    }

    if (editingItem) {
      url += `/${editingItem.id}`;
      method = 'PUT';
    }

    try {
      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        showToast(editingItem ? 'Saved changes successfully!' : 'Record created successfully!', 'success');
        setDrawerOpen(false);
        loadEngineData();
      } else {
        showToast(data.error || 'Operation failed.', 'error');
      }
    } catch (err: any) {
      showToast('Network error: ' + err.message, 'error');
    }
  };

  // Delete handler
  const handleDeleteItem = async (id: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this configuration? This cannot be undone.')) {
      return;
    }

    let url = '';
    if (activeTab === 'slabs') url = `http://localhost:5000/api/v1/payroll/slabs/${id}`;
    else if (activeTab === 'components') url = `http://localhost:5000/api/v1/payroll/components/${id}`;
    else if (activeTab === 'configs') url = `http://localhost:5000/api/v1/payroll/configurations/${id}`;

    try {
      const res = await fetch(url, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Record deleted successfully.', 'success');
        loadEngineData();
      } else {
        showToast(data.error || 'Failed to delete record.', 'error');
      }
    } catch (err: any) {
      showToast('Network error: ' + err.message, 'error');
    }
  };

  // Filtering data for grids
  const getFilteredData = () => {
    const q = searchQuery.toLowerCase().trim();
    if (activeTab === 'slabs') {
      return slabs.filter(s => s.slab_name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q));
    } else if (activeTab === 'components') {
      return components.filter(c => c.component_code.toLowerCase().includes(q) || c.component_name.toLowerCase().includes(q));
    } else if (activeTab === 'calctypes') {
      return calculationTypes.filter(t => t.type_name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
    } else {
      return configurations.filter(c =>
        c.component_code.toLowerCase().includes(q) ||
        (c.slab_name || '').toLowerCase().includes(q) ||
        (c.calculation_type_name || '').toLowerCase().includes(q)
      );
    }
  };

  const filteredList = getFilteredData();
  const activeList = activeTab === 'slabs' ? slabs : activeTab === 'components' ? components : activeTab === 'calctypes' ? calculationTypes : configurations;
  const paginatedConfigs = activeTab === 'configs'
    ? filteredList.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : filteredList;
  const totalPages = Math.ceil(filteredList.length / pageSize) || 1;

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }} className="font-['DM_Sans',sans-serif] space-y-6 animate-fadeIn w-full">
      <style dangerouslySetInnerHTML={{__html: `
        .font-sans, .font-mono, td, th, button, input, select, label, span, div, p, h3, h4, h5, h6 {
          font-family: 'DM Sans', sans-serif !important;
        }
      `}} />

      <DashboardPageHeader
        title="Gross-to-Net Payroll Hub"
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

      {/* Salary Structure Engine Panel */}
      <div className="p-6 rounded-2xl border border-slate-200/50 dark:border-slate-800/60 bg-card text-left space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-black text-slate-850 dark:text-slate-100 uppercase tracking-wider">Salary Structure Engine</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">Define gross ranges, master component codes, calculation configurations, and engine mappings.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadEngineData}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-650 dark:text-slate-350 text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              Sync Data
            </button>
            {activeTab !== 'calctypes' && (
              <button
                onClick={() => handleOpenDrawer()}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-550 text-white text-xs font-bold shadow-md shadow-blue-500/10 transition-all duration-200 cursor-pointer flex items-center gap-1.5 flex-shrink-0 border-0"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add New
              </button>
            )}
          </div>
        </div>

        {/* Engine Sub tabs */}
        {visibleTabs.length === 0 ? (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 text-xs font-bold">
            <span>⚠️</span> You don't have permission to access any Formula modules.
          </div>
        ) : (
          <div className="border-b border-slate-200/60 dark:border-slate-800/80 pb-px">
            <nav className="flex gap-2 overflow-x-auto no-scrollbar pt-1">
              {visibleTabs.map(tab => {
                const isSelected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setSearchQuery('');
                      setCurrentPage(1);
                    }}
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                    className={`py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer flex-shrink-0 border-0 ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        )}

        {/* Search Bar */}
        <div className="flex justify-between items-center gap-4">
          <div className="relative w-full max-w-xs">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-450 dark:text-slate-500">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              autoComplete="off"
              placeholder={`Search ${activeTab === 'slabs' ? 'slabs' : activeTab === 'components' ? 'components' : activeTab === 'calctypes' ? 'calculation types' : 'configurations'}...`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="!pl-11 pr-4 py-2 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 text-xs outline-none focus:border-blue-500 focus:bg-card focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-slate-800 dark:text-slate-255"
            />
          </div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
            Showing {filteredList.length} of {activeList.length} entries
          </span>
        </div>

        {/* Grid data tables */}
        <div className="border border-slate-100 dark:border-slate-800/80 rounded-2xl overflow-hidden bg-slate-50/30 dark:bg-slate-900/10">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-150 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/40 text-[9.5px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  {activeTab === 'slabs' && (
                    <>
                      <th className="p-4">Slab Name</th>
                      <th className="p-4">Min Gross</th>
                      <th className="p-4">Max Gross</th>
                      <th className="p-4">Description</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </>
                  )}
                  {activeTab === 'components' && (
                    <>
                      <th className="p-4">Component Code</th>
                      <th className="p-4">Component Name</th>
                      <th className="p-4">Type</th>
                      <th className="p-4">Statutory?</th>
                      <th className="p-4">Taxable?</th>
                      <th className="p-4">Order</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </>
                  )}
                  {activeTab === 'calctypes' && (
                    <>
                      <th className="p-4">Type Name</th>
                      <th className="p-4">Description</th>
                    </>
                  )}
                  {activeTab === 'configs' && (
                    <>
                      <th className="p-4">Salary Slab</th>
                      <th className="p-4">Component</th>
                      <th className="p-4">Calculation Type</th>
                      <th className="p-4">Value</th>
                      <th className="p-4">Depends On</th>
                      <th className="p-4">Prorata?</th>
                      <th className="p-4">Order</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400 font-bold uppercase tracking-wider">
                      Loading data from engine...
                    </td>
                  </tr>
                ) : paginatedConfigs.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400 font-bold uppercase tracking-wider">
                      No matching records found.
                    </td>
                  </tr>
                ) : (
                  paginatedConfigs.map((item: any) => (
                    <tr key={item.id} className="hover:bg-slate-100/20 dark:hover:bg-slate-800/10 transition-colors">
                      {activeTab === 'slabs' && (
                        <>
                          <td className="p-4 font-bold text-slate-850 dark:text-slate-200">{item.slab_name}</td>
                          <td className="p-4">₹{parseFloat(item.min_gross).toLocaleString('en-IN')}</td>
                          <td className="p-4">₹{parseFloat(item.max_gross).toLocaleString('en-IN')}</td>
                          <td className="p-4 text-[11px] text-slate-450">{item.description || '-'}</td>
                          <td className="p-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                              item.is_active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                            }`}>
                              <span className={`w-1 h-1 rounded-full ${item.is_active ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-slate-400'}`}></span>
                              {item.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="p-4 text-right space-x-1.5">
                            <button
                              onClick={() => handleOpenDrawer(item)}
                              className="px-2.5 py-1 rounded-lg border border-blue-100 dark:border-blue-900/50 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white text-[10px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="px-2.5 py-1 rounded-lg border border-red-100 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-650 hover:text-white text-[10px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer"
                            >
                              Delete
                            </button>
                          </td>
                        </>
                      )}
                      {activeTab === 'components' && (
                        <>
                          <td className="p-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">{item.component_code}</td>
                          <td className="p-4 font-bold text-slate-850 dark:text-slate-200">{item.component_name}</td>
                          <td className="p-4 text-[10.5px] font-bold text-slate-450">{item.component_type}</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded text-[8.5px] font-black ${item.is_statutory ? 'bg-red-500/10 text-red-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                              {item.is_statutory ? 'STATUTORY' : 'STANDARD'}
                            </span>
                          </td>
                          <td className="p-4">{item.is_taxable ? 'Yes' : 'No'}</td>
                          <td className="p-4">{item.display_order}</td>
                          <td className="p-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                              item.is_active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                            }`}>
                              <span className={`w-1 h-1 rounded-full ${item.is_active ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-slate-400'}`}></span>
                              {item.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="p-4 text-right space-x-1.5">
                            <button
                              onClick={() => handleOpenDrawer(item)}
                              className="px-2.5 py-1 rounded-lg border border-blue-100 dark:border-blue-900/50 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white text-[10px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="px-2.5 py-1 rounded-lg border border-red-100 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-650 hover:text-white text-[10px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer"
                            >
                              Delete
                            </button>
                          </td>
                        </>
                      )}
                      {activeTab === 'calctypes' && (
                        <>
                          <td className="p-4 font-bold text-slate-850 dark:text-slate-200">{item.type_name}</td>
                          <td className="p-4 text-slate-500">{item.description}</td>
                        </>
                      )}
                      {activeTab === 'configs' && (
                        <>
                          <td className="p-4 font-bold text-slate-855 dark:text-slate-250">{item.slab_name || 'Global'}</td>
                          <td className="p-4 font-bold text-indigo-650 dark:text-indigo-400">{item.component_code}</td>
                          <td className="p-4 text-[10.5px] font-medium text-slate-500">{item.calculation_type_name}</td>
                          <td className="p-4 font-bold">
                            {item.calculation_type_name === 'FixedAmount' ? `₹${parseFloat(item.calculation_value).toLocaleString('en-IN')}` : `${parseFloat(item.calculation_value)}%`}
                          </td>
                          <td className="p-4 font-mono">{item.depends_on_component || '-'}</td>
                          <td className="p-4">{item.is_prorata ? 'Yes' : 'No'}</td>
                          <td className="p-4">{item.display_order}</td>
                          <td className="p-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                              item.is_active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                            }`}>
                              <span className={`w-1 h-1 rounded-full ${item.is_active ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-slate-400'}`}></span>
                              {item.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="p-4 text-right space-x-1.5">
                            <button
                              onClick={() => handleOpenDrawer(item)}
                              className="px-2.5 py-1 rounded-lg border border-blue-100 dark:border-blue-900/50 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white text-[10px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="px-2.5 py-1 rounded-lg border border-red-100 dark:border-red-900/50 text-red-650 dark:text-red-455 hover:bg-red-600 hover:text-white text-[10px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer"
                            >
                              Delete
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Configurations Table Pagination */}
        {activeTab === 'configs' && totalPages > 1 && (
          <div className="flex justify-between items-center flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-black uppercase tracking-wider disabled:opacity-40 cursor-pointer"
            >
              Prev
            </button>
            <span className="text-xs font-bold text-slate-450">
              Page {currentPage} of {totalPages}
            </span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-black uppercase tracking-wider disabled:opacity-40 cursor-pointer"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Salary Sandbox Panel */}
      <div className="p-6 rounded-2xl border border-slate-200/50 dark:border-slate-800/60 bg-card text-left space-y-6 overflow-hidden">
        <div>
          <h3 className="text-sm font-black text-slate-850 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            Salary Calculation Sandbox
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">Simulate gross salary component splits instantly based on active slab configurations and attendance.</p>
        </div>

        {/* Sandbox Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/20">
          <div>
            <label className="block text-[9.5px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1.5">Enter Gross Amount (₹)</label>
            <input
              type="number"
              value={sbGross}
              onChange={e => setSbGross(e.target.value)}
              placeholder="e.g. 40000"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-card focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-slate-800 dark:text-slate-200"
            />
          </div>
          <div>
            <label className="block text-[9.5px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1.5">Total Days in Month</label>
            <select
              value={sbTotalDays}
              onChange={e => setSbTotalDays(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-card focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-slate-800 dark:text-slate-200 cursor-pointer"
            >
              <option value="28">28</option>
              <option value="29">29</option>
              <option value="30">30</option>
              <option value="31">31</option>
            </select>
          </div>
          <div>
            <label className="block text-[9.5px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1.5">Payable Days (Attendance)</label>
            <input
              type="number"
              value={sbPayableDays}
              onChange={e => setSbPayableDays(e.target.value)}
              placeholder="e.g. 22"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-card focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-slate-800 dark:text-slate-200"
            />
          </div>
          <div>
            <label className="block text-[9.5px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1.5">Employee Type</label>
            <select
              value={sbEmployeeType}
              onChange={e => setSbEmployeeType(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-card focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-slate-800 dark:text-slate-200 cursor-pointer"
            >
              <option value="Permanent">Permanent</option>
              <option value="Temporary">Temporary</option>
              <option value="Stipend">Stipend</option>
            </select>
          </div>
        </div>

        {/* Matched Slab alert */}
        {sbMatchedSlab ? (
          <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400 text-xs font-semibold flex items-center justify-between flex-wrap gap-2">
            <span>
              <strong>Matched Slab:</strong> {sbMatchedSlab.slab_name} (Range: ₹{parseFloat(sbMatchedSlab.min_gross as any).toLocaleString('en-IN')} - ₹{parseFloat(sbMatchedSlab.max_gross as any).toLocaleString('en-IN')})
            </span>
            <span>
              Attendance Factor: {sbPayableDays} / {sbTotalDays} days ({((parseInt(sbPayableDays) / parseInt(sbTotalDays)) * 100).toFixed(1)}%)
            </span>
          </div>
        ) : sbGross && parseFloat(sbGross) > 0 ? (
          <div className="p-3.5 rounded-xl border border-red-500/20 bg-red-500/5 text-red-700 dark:text-red-400 text-xs font-semibold">
            ⚠️ No active salary slab matches a Gross Amount of ₹{(parseFloat(sbGross) || 0).toLocaleString('en-IN')}. Verify active slab ranges.
          </div>
        ) : (
          <div className="p-3.5 rounded-xl border border-blue-500/10 bg-blue-500/5 text-blue-700 dark:text-blue-400 text-xs font-semibold flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Enter a gross amount and payable days above to run the live sandbox simulator.</span>
          </div>
        )}

        {/* Simulator outputs grid */}
        <div className="border border-slate-100 dark:border-slate-800/80 rounded-2xl overflow-hidden bg-slate-50/30 dark:bg-slate-900/10">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-150 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/40 text-[9.5px] font-black uppercase tracking-widest text-slate-455 dark:text-slate-400">
                  <th className="p-4">Component</th>
                  <th className="p-4">Calculation Formula</th>
                  <th className="p-4">Base Monthly Value</th>
                  <th className="p-4">Prorata?</th>
                  <th className="p-4 text-right">Calculated Earned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-350">
                {sbResults.map(item => (
                  <tr key={item.code} className="hover:bg-slate-100/25 dark:hover:bg-slate-800/15">
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 font-bold font-mono text-[9px] mr-2">
                        {item.code}
                      </span>
                      <strong>{item.name}</strong>
                    </td>
                    <td className="p-4 text-slate-500">
                      {(sbEmployeeType === 'Temporary' || sbEmployeeType === 'Stipend') ? (
                        item.code === 'BASIC' ? 'Consolidated Salary (100% of Gross)' : 'Not Applicable'
                      ) : (
                        item.type === 'FixedAmount' ? 'Fixed Amount' :
                        item.type === 'PercentageOfGross' ? `${item.val}% of Gross` :
                        item.type === 'PercentageOfComponent' ? `${item.val}% of ${item.depends}` :
                        item.type
                      )}
                    </td>
                    <td className="p-4 font-bold text-slate-850 dark:text-slate-200">
                      ₹{Math.round(item.base).toLocaleString('en-IN')}
                    </td>
                    <td className="p-4">{item.prorata ? 'Yes' : 'No'}</td>
                    <td className="p-4 text-right font-bold text-blue-650 dark:text-blue-400">
                      ₹{Math.round(item.earned).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
                
                {/* Total Remuneration Gross row */}
                <tr className="bg-slate-100/40 dark:bg-slate-900/30 border-t border-slate-200 dark:border-slate-800 font-bold">
                  <td className="p-4 text-indigo-650 dark:text-indigo-400">TOTAL REMUNERATION (GROSS)</td>
                  <td className="p-4 text-slate-450 text-[10.5px]">EG = Earned Gross</td>
                  <td className="p-4">₹{Math.round(sbSummary.gross).toLocaleString('en-IN')}</td>
                  <td className="p-4">-</td>
                  <td className="p-4 text-right text-blue-650 dark:text-blue-400">
                    ₹{Math.round(sbSummary.earnedGross).toLocaleString('en-IN')}
                  </td>
                </tr>

                {/* Deductions breakdown */}
                {sbMatchedSlab && (
                  <>
                    <tr className="hover:bg-slate-100/25 dark:hover:bg-slate-800/15">
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-600 font-bold font-mono text-[9px] mr-2">TDS</span>
                        <strong>Tax Deducted at Source (TDS)</strong>
                      </td>
                      <td className="p-4 text-slate-450 text-[10px]">New Tax Regime slabs (standard u/s 115BAC)</td>
                      <td className="p-4">-</td>
                      <td className="p-4">No</td>
                      <td className="p-4 text-right font-bold text-red-650 dark:text-red-400">
                        ₹{sbSummary.tds.toLocaleString('en-IN')}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-100/25 dark:hover:bg-slate-800/15">
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-600 font-bold font-mono text-[9px] mr-2">PF</span>
                        <strong>Provident Fund (Employee PF)</strong>
                      </td>
                      <td className="p-4 text-slate-450 text-[10px]">12% of Basic (capped at ₹1,800)</td>
                      <td className="p-4">-</td>
                      <td className="p-4">No</td>
                      <td className="p-4 text-right font-bold text-red-650 dark:text-red-400">
                        ₹{sbSummary.pf.toLocaleString('en-IN')}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-100/25 dark:hover:bg-slate-800/15">
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-600 font-bold font-mono text-[9px] mr-2">ESI</span>
                        <strong>Employee State Insurance (ESI)</strong>
                      </td>
                      <td className="p-4 text-slate-450 text-[10px]">0.75% of Gross (only if Gross &lt; 21,000)</td>
                      <td className="p-4">-</td>
                      <td className="p-4">No</td>
                      <td className="p-4 text-right font-bold text-red-650 dark:text-red-400">
                        ₹{sbSummary.esi.toLocaleString('en-IN')}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-100/25 dark:hover:bg-slate-800/15">
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-600 font-bold font-mono text-[9px] mr-2">PT</span>
                        <strong>Professional Tax (PT)</strong>
                      </td>
                      <td className="p-4 text-slate-450 text-[10px]">₹200 (EG &ge; 20,001) / ₹150 (EG &ge; 15,001)</td>
                      <td className="p-4">-</td>
                      <td className="p-4">No</td>
                      <td className="p-4 text-right font-bold text-red-650 dark:text-red-400">
                        ₹{sbSummary.pt.toLocaleString('en-IN')}
                      </td>
                    </tr>

                    {/* Net Salary Row */}
                    <tr className="bg-slate-100/40 dark:bg-slate-900/30 border-t border-slate-200 dark:border-slate-800 font-bold">
                      <td className="p-4 text-emerald-600 dark:text-emerald-400">NET SALARY (TAKE HOME)</td>
                      <td className="p-4 text-slate-450 text-[10.5px]">EG Gross - Total Deductions</td>
                      <td className="p-4">-</td>
                      <td className="p-4">-</td>
                      <td className="p-4 text-right text-emerald-650 dark:text-emerald-400 text-sm font-black">
                        ₹{sbSummary.net.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Slide drawer container for CRUD form inputs */}
      <SlideDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingItem ? `Edit ${activeTab.substring(0, activeTab.length - 1)}` : `Add New ${activeTab.substring(0, activeTab.length - 1)}`}
      >
        <form onSubmit={handleFormSubmit} className="space-y-4 text-left">
          {activeTab === 'slabs' && (
            <>
              <div>
                <label className="block text-[9.5px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1.5">Slab Name</label>
                <input
                  type="text"
                  value={slabForm.slab_name}
                  onChange={e => setSlabForm({ ...slabForm, slab_name: e.target.value })}
                  placeholder="e.g. Semi-Skilled Slab"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-card focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-slate-800 dark:text-slate-200"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9.5px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1.5">Min Gross (₹)</label>
                  <input
                    type="number"
                    value={slabForm.min_gross}
                    onChange={e => setSlabForm({ ...slabForm, min_gross: e.target.value })}
                    placeholder="e.g. 15000"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-card focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-[9.5px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1.5">Max Gross (₹)</label>
                  <input
                    type="number"
                    value={slabForm.max_gross}
                    onChange={e => setSlabForm({ ...slabForm, max_gross: e.target.value })}
                    placeholder="e.g. 25000"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-card focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[9.5px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1.5">Description</label>
                <textarea
                  value={slabForm.description}
                  onChange={e => setSlabForm({ ...slabForm, description: e.target.value })}
                  placeholder="Notes about the slab range or qualifications..."
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-card focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-slate-800 dark:text-slate-200 resize-none"
                />
              </div>
              <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-900/20 rounded-xl">
                <span className="text-[10px] font-black text-slate-450 uppercase tracking-wider">Is Slab Active</span>
                <input
                  type="checkbox"
                  checked={slabForm.is_active}
                  onChange={e => setSlabForm({ ...slabForm, is_active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
              </div>
            </>
          )}

          {activeTab === 'components' && (
            <>
              <div>
                <label className="block text-[9.5px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1.5">Component Code</label>
                <input
                  type="text"
                  value={componentForm.component_code}
                  onChange={e => setComponentForm({ ...componentForm, component_code: e.target.value })}
                  placeholder="e.g. BASIC"
                  disabled={!!editingItem}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-card focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-slate-800 dark:text-slate-200 disabled:opacity-50"
                />
                <small className="text-[9px] text-slate-450 font-bold mt-1 block">Unique uppercase code without spaces.</small>
              </div>
              <div>
                <label className="block text-[9.5px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1.5">Component Name</label>
                <input
                  type="text"
                  value={componentForm.component_name}
                  onChange={e => setComponentForm({ ...componentForm, component_name: e.target.value })}
                  placeholder="e.g. Basic Salary"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-card focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-slate-800 dark:text-slate-200"
                />
              </div>
              <div>
                <label className="block text-[9.5px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1.5">Component Type</label>
                <select
                  value={componentForm.component_type}
                  onChange={e => setComponentForm({ ...componentForm, component_type: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-card focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  <option value="EARNINGS">Earnings</option>
                  <option value="DEDUCTION">Deduction</option>
                  <option value="REIMBURSEMENT">Reimbursement</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-900/20 rounded-xl">
                  <span className="text-[9.5px] font-black text-slate-450 uppercase tracking-widest">Statutory?</span>
                  <input
                    type="checkbox"
                    checked={componentForm.is_statutory}
                    onChange={e => setComponentForm({ ...componentForm, is_statutory: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 cursor-pointer"
                  />
                </div>
                <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-900/20 rounded-xl">
                  <span className="text-[9.5px] font-black text-slate-450 uppercase tracking-widest">Taxable?</span>
                  <input
                    type="checkbox"
                    checked={componentForm.is_taxable}
                    onChange={e => setComponentForm({ ...componentForm, is_taxable: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 cursor-pointer"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[9.5px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1.5">Display Order</label>
                <input
                  type="number"
                  value={componentForm.display_order}
                  onChange={e => setComponentForm({ ...componentForm, display_order: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-card focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-slate-800 dark:text-slate-200"
                />
              </div>
              <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-900/20 rounded-xl">
                <span className="text-[9.5px] font-black text-slate-450 uppercase tracking-widest">Is Active</span>
                <input
                  type="checkbox"
                  checked={componentForm.is_active}
                  onChange={e => setComponentForm({ ...componentForm, is_active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 cursor-pointer"
                />
              </div>
            </>
          )}

          {activeTab === 'configs' && (
            <>
              <div>
                <label className="block text-[9.5px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1.5">Salary Slab Mapping</label>
                <select
                  value={configForm.slab_id}
                  onChange={e => setConfigForm({ ...configForm, slab_id: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-card focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  {slabs.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.slab_name} (₹{parseFloat(s.min_gross as any).toLocaleString()} - ₹{parseFloat(s.max_gross as any).toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9.5px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1.5">Salary Component</label>
                  <select
                    value={configForm.component_code}
                    onChange={e => setConfigForm({ ...configForm, component_code: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-card focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-slate-800 dark:text-slate-200 cursor-pointer"
                  >
                    {components.map(c => (
                      <option key={c.id} value={c.component_code}>
                        {c.component_name} ({c.component_code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[9.5px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1.5">Calculation Type</label>
                  <select
                    value={configForm.calculation_type_id}
                    onChange={e => setConfigForm({ ...configForm, calculation_type_id: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-card focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-slate-800 dark:text-slate-200 cursor-pointer"
                  >
                    {calculationTypes.map(t => (
                      <option key={t.id} value={t.id}>{t.type_name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[9.5px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1.5">Calculation Value (Rate / Fixed)</label>
                <input
                  type="number"
                  step="any"
                  value={configForm.calculation_value}
                  onChange={e => setConfigForm({ ...configForm, calculation_value: e.target.value })}
                  placeholder="e.g. 40 or 1200"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-card focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-slate-800 dark:text-slate-200"
                />
                <small className="text-[9.5px] text-slate-450 font-bold block mt-1">Value is % (e.g. 50 for 50%) or fixed currency amount.</small>
              </div>
              <div>
                <label className="block text-[9.5px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1.5">Depends On Component</label>
                <select
                  value={configForm.depends_on_component}
                  onChange={e => setConfigForm({ ...configForm, depends_on_component: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-card focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  <option value="">-- None (Independent) --</option>
                  {components.map(c => (
                    <option key={c.id} value={c.component_code}>
                      {c.component_name} ({c.component_code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9.5px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1.5">Min Cap Limit (₹)</label>
                  <input
                    type="number"
                    value={configForm.min_cap}
                    onChange={e => setConfigForm({ ...configForm, min_cap: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-card focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-[9.5px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1.5">Max Cap Limit (₹)</label>
                  <input
                    type="number"
                    value={configForm.max_cap}
                    onChange={e => setConfigForm({ ...configForm, max_cap: e.target.value })}
                    placeholder="None"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-card focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[9.5px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1.5">Employee Type Applicability</label>
                <select
                  value={configForm.employee_type}
                  onChange={e => setConfigForm({ ...configForm, employee_type: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-card focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  <option value="ALL">ALL Employees</option>
                  <option value="Permanent">Permanent</option>
                  <option value="Temporary">Temporary</option>
                  <option value="Stipend">Stipend</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-900/20 rounded-xl">
                  <span className="text-[9.5px] font-black text-slate-450 uppercase tracking-widest">Prorata?</span>
                  <input
                    type="checkbox"
                    checked={configForm.is_prorata}
                    onChange={e => setConfigForm({ ...configForm, is_prorata: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 cursor-pointer"
                  />
                </div>
                <div>
                  <input
                    type="number"
                    value={configForm.display_order}
                    onChange={e => setConfigForm({ ...configForm, display_order: e.target.value })}
                    placeholder="Order"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-900/30 px-2 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500/20 Transition-all font-medium text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-900/20 rounded-xl">
                <span className="text-[9.5px] font-black text-slate-450 uppercase tracking-widest">Is Config Active</span>
                <input
                  type="checkbox"
                  checked={configForm.is_active}
                  onChange={e => setConfigForm({ ...configForm, is_active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 cursor-pointer"
                />
              </div>
            </>
          )}

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-850 text-slate-650 dark:text-slate-350 hover:bg-slate-105 dark:hover:bg-slate-800/40 text-xs font-black uppercase tracking-wider transition-colors cursor-pointer text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-500 hover:to-indigo-550 text-white text-xs font-black uppercase tracking-wider transition-all cursor-pointer text-center"
            >
              {editingItem ? 'Save Changes' : 'Create Record'}
            </button>
          </div>
        </form>
      </SlideDrawer>
    </div>
  );
}
