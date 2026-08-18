'use client';

import React, { useEffect, useState, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import DashboardPageHeader from '../../components/DashboardPageHeader';
import SearchableSelect from '../../components/SearchableSelect';
import { getHeaders, API_BASE, getUrl } from '../../utils/api';
import { useDashboard } from '../../components/DashboardContext';
import { usePermissions } from '../../hooks/usePermissions';

const STEPPER_STEPS = [
  { id: 1, title: 'Personal Details', subtitle: 'Identity & contact', icon: '👤' },
  { id: 2, title: 'Job & Hierarchy', subtitle: 'Branch, dept & shift', icon: '🏢' },
  { id: 3, title: 'Bank & Financials', subtitle: 'Salary, bank & PAN', icon: '💳' },
  { id: 4, title: 'Address & Contact', subtitle: 'Address & emergency', icon: '📍' },
] as const;

function CreateEmployeeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useDashboard();
  const { isSuperAdmin } = usePermissions();

  const modeParam = searchParams.get('mode');
  const [onboardingMode, setOnboardingMode] = useState<'single' | 'bulk'>('single');

  useEffect(() => {
    if (modeParam === 'bulk') {
      setOnboardingMode('bulk');
    }
  }, [modeParam]);

  const [currentStep, setCurrentStep] = useState<number>(1);

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [tenantRoles, setTenantRoles] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Bulk Upload State
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResults, setBulkResults] = useState<{ row: number; emp_id_code: string; status: string; keycloak_status?: string; message: string }[] | null>(null);

  // Single Form State
  const [empForm, setEmpForm] = useState({
    // Step 1: Personal
    emp_id_code: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    gender: 'MALE',
    dob: '',
    blood_group: 'O_POSITIVE',
    marital_status: 'SINGLE',
    employment_type: 'FULL_TIME',
    status: 'ACTIVE',
    emp_image: '',

    // Step 2: Work & Hierarchy
    companyId: '',
    branch_id: '',
    department_id: '',
    designation_id: '',
    tenant_role_id: '',
    shift_id: '',
    reporting_to_id: '',
    joining_date: new Date().toISOString().split('T')[0],

    // Step 3: Bank & Statutory
    ctc: '600000',
    basic_salary: '35000',
    bank_name: '',
    bank_acc_no: '',
    ifsc_code: '',
    pan_number: '',
    uan_number: '',

    // Step 4: Address & Emergency
    address: '',
    city: '',
    state: '',
    pincode: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_relation: 'SPOUSE',
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

    const savedCompanyId = localStorage.getItem('companyId') || localStorage.getItem('selectedCompanyId');
    if (savedCompanyId) {
      setCompanyId(savedCompanyId);
      setEmpForm(prev => ({ ...prev, companyId: savedCompanyId }));
    }

    fetchMetadata();
  }, []);

  const fetchMetadata = async () => {
    setIsLoading(true);
    try {
      const [compRes, empRes, branchRes, deptRes, desigRes, roleRes, shiftRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/companies`, { headers: getHeaders() }),
        fetch(`${API_BASE}/api/v1/employees`, { headers: getHeaders() }),
        fetch(`${API_BASE}/api/v1/branches`, { headers: getHeaders() }),
        fetch(`${API_BASE}/api/v1/departments`, { headers: getHeaders() }),
        fetch(`${API_BASE}/api/v1/designations`, { headers: getHeaders() }),
        fetch(getUrl('/api/v1/roles'), { headers: getHeaders() }),
        fetch(`${API_BASE}/api/v1/shifts`, { headers: getHeaders() }),
      ]);

      if (compRes.ok) {
        const data = await compRes.json();
        const list = Array.isArray(data) ? data : (data.companies || []);
        setCompanies(list);
        if (!companyId && list.length > 0) {
          setCompanyId(list[0].id);
          setEmpForm(prev => ({ ...prev, companyId: list[0].id }));
        }
      }
      if (empRes.ok) {
        const data = await empRes.json();
        setEmployees(Array.isArray(data) ? data : (data.employees || []));
      }
      if (branchRes.ok) {
        const d = await branchRes.json();
        setBranches(Array.isArray(d) ? d : (d.branches || d.data || []));
      }
      if (deptRes.ok) {
        const d = await deptRes.json();
        setDepartments(Array.isArray(d) ? d : (d.departments || d.data || []));
      }
      if (desigRes.ok) {
        const d = await desigRes.json();
        setDesignations(Array.isArray(d) ? d : (d.designations || d.data || []));
      }
      if (roleRes.ok) {
        const d = await roleRes.json();
        setTenantRoles(Array.isArray(d) ? d : (d.roles || d.tenantRoles || d.data || []));
      }
      if (shiftRes.ok) {
        const d = await shiftRes.json();
        setShifts(Array.isArray(d) ? d : (d.shifts || d.data || []));
      }
    } catch (e) {
      console.error('Error loading metadata:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompanyChange = (newId: string) => {
    setCompanyId(newId);
    setEmpForm(prev => ({
      ...prev,
      companyId: newId,
      branch_id: '',
      department_id: '',
      designation_id: '',
      tenant_role_id: '',
      shift_id: ''
    }));
    if (newId) localStorage.setItem('companyId', newId);
  };

  const deduplicateOptions = (options: { value: string; label: string }[], currentValue?: string) => {
    const seenValues = new Set<string>();
    const seenLabels = new Set<string>();
    const result: { value: string; label: string }[] = [];

    if (currentValue) {
      const currentOpt = options.find(o => o.value === currentValue);
      if (currentOpt && currentOpt.value) {
        seenValues.add(currentOpt.value);
        seenLabels.add(currentOpt.label.trim().toLowerCase());
        result.push(currentOpt);
      }
    }

    for (const opt of options) {
      if (!opt.value) continue;
      const cleanLabel = opt.label.trim().toLowerCase();
      if (!seenValues.has(opt.value) && !seenLabels.has(cleanLabel)) {
        seenValues.add(opt.value);
        seenLabels.add(cleanLabel);
        result.push(opt);
      }
    }

    return result;
  };

  const activeCompanyId = isSuperAdmin ? (empForm.companyId || companyId) : companyId;

  const safeBranches = Array.isArray(branches) ? branches : [];
  const safeDepartments = Array.isArray(departments) ? departments : [];
  const safeDesignations = Array.isArray(designations) ? designations : [];
  const safeRoles = Array.isArray(tenantRoles) ? tenantRoles : [];
  const safeShifts = Array.isArray(shifts) ? shifts : [];
  const safeEmployees = Array.isArray(employees) ? employees : [];

  const filteredBranches = activeCompanyId
    ? safeBranches.filter(b => b?.company_id === activeCompanyId)
    : [];
  const filteredDepartments = empForm.branch_id
    ? safeDepartments.filter(d => d?.branch_id === empForm.branch_id || !d?.branch_id)
    : (activeCompanyId ? safeDepartments.filter(d => d?.company_id === activeCompanyId) : []);
  const filteredDesignations = empForm.department_id
    ? safeDesignations.filter(ds => ds?.department_id === empForm.department_id)
    : (activeCompanyId ? safeDesignations.filter(ds => ds?.company_id === activeCompanyId) : []);
  const filteredRoles = activeCompanyId ? safeRoles.filter(r => r?.company_id === activeCompanyId) : [];
  const filteredShifts = activeCompanyId ? safeShifts.filter(s => s?.company_id === activeCompanyId) : [];
  const filteredEmployees = activeCompanyId ? safeEmployees.filter(e => e?.company_id === activeCompanyId) : safeEmployees;

  // Real-time Duplicate Check
  const duplicateEmp = useMemo(() => {
    if (!empForm.emp_id_code.trim()) return null;
    const targetCompanyId = activeCompanyId;
    return safeEmployees.find(e =>
      e.emp_id_code?.trim().toLowerCase() === empForm.emp_id_code.trim().toLowerCase() &&
      (targetCompanyId ? String(e.company_id) === String(targetCompanyId) : true)
    );
  }, [empForm.emp_id_code, activeCompanyId, safeEmployees]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showToast('⚠️ Image size must be less than 2MB', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setEmpForm(prev => ({ ...prev, emp_image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Step-wise & Overall Percentage Computation
  const stepPercentages = useMemo(() => {
    const step1Fields = ['first_name', 'last_name', 'email', 'phone', 'gender', 'dob', 'blood_group', 'marital_status', 'employment_type', 'status'];
    const s1Filled = step1Fields.filter(k => !!String((empForm as any)[k] || '').trim()).length;
    const s1Pct = Math.round((s1Filled / step1Fields.length) * 100);

    const step2Fields = ['emp_id_code', 'companyId', 'branch_id', 'department_id', 'designation_id', 'shift_id', 'tenant_role_id', 'reporting_to_id', 'joining_date'];
    const s2Filled = step2Fields.filter(k => !!String((empForm as any)[k] || '').trim()).length;
    const s2Pct = Math.round((s2Filled / step2Fields.length) * 100);

    const step3Fields = ['ctc', 'basic_salary', 'bank_name', 'bank_acc_no', 'ifsc_code', 'pan_number'];
    const s3Filled = step3Fields.filter(k => !!String((empForm as any)[k] || '').trim()).length;
    const s3Pct = Math.round((s3Filled / step3Fields.length) * 100);

    const step4Fields = ['address', 'city', 'state', 'emergency_contact_name', 'emergency_contact_phone'];
    const s4Filled = step4Fields.filter(k => !!String((empForm as any)[k] || '').trim()).length;
    const s4Pct = Math.round((s4Filled / step4Fields.length) * 100);

    const overallPct = Math.round((s1Pct + s2Pct + s3Pct + s4Pct) / 4);

    return {
      1: s1Pct,
      2: s2Pct,
      3: s3Pct,
      4: s4Pct,
      overall: overallPct,
    };
  }, [empForm]);

  const validateStep = (stepNumber: number) => {
    if (stepNumber === 1) {
      if (!empForm.first_name.trim()) {
        showToast('⚠️ Please enter First Name', 'error');
        return false;
      }
      if (!empForm.last_name.trim()) {
        showToast('⚠️ Please enter Last Name', 'error');
        return false;
      }
      if (!empForm.email.trim()) {
        showToast('⚠️ Please enter Work / Personal Email', 'error');
        return false;
      }
      if (!empForm.phone.trim()) {
        showToast('⚠️ Please enter Mobile Phone Number', 'error');
        return false;
      }
    } else if (stepNumber === 2) {
      if (!empForm.emp_id_code.trim()) {
        showToast('⚠️ Please enter Employee ID / Code', 'error');
        return false;
      }
      if (duplicateEmp) {
        showToast(`❌ Employee ID is already assigned to ${duplicateEmp.first_name} ${duplicateEmp.last_name}`, 'error');
        return false;
      }
      if (!empForm.branch_id) {
        showToast('⚠️ Please select Branch / Office', 'error');
        return false;
      }
      if (!empForm.department_id) {
        showToast('⚠️ Please select Department', 'error');
        return false;
      }
      if (!empForm.designation_id) {
        showToast('⚠️ Please select Designation', 'error');
        return false;
      }
      if (!empForm.shift_id) {
        showToast('⚠️ Please select Assigned Shift', 'error');
        return false;
      }
      if (!empForm.joining_date) {
        showToast('⚠️ Please select Date of Joining', 'error');
        return false;
      }
    }
    return true;
  };

  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(4, prev + 1));
    }
  };

  const handlePrevStep = () => {
    setCurrentStep(prev => Math.max(1, prev - 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateStep(1) || !validateStep(2)) return;

    const targetCompanyId = activeCompanyId;
    if (!targetCompanyId) {
      showToast('⚠️ Please select a company context first.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        ...empForm,
        email: empForm.email.replace(/\s+/g, ''),
        companyId: targetCompanyId,
      };

      const res = await fetch(`${API_BASE}/api/v1/employees`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        let msg = 'Employee profile registered successfully!';
        if (data.keycloakCreated) {
          msg += ` Keycloak user registered. Temp Password: ${data.keycloakTempPassword}`;
        }
        showToast(msg, 'success', 6000);
        router.push('/dashboard/employees');
      } else {
        showToast(data.error || 'Failed to create employee profile', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('⚠️ Error connecting to server', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // CSV Template Downloader
  const downloadSampleCsv = () => {
    const csvContent = "emp_id_code,first_name,last_name,email\n" +
      "EMP-201,Rahul,Sharma,rahul.s@example.com\n" +
      "EMP-202,Priya,Verma,priya.v@example.com\n" +
      "EMP-203,Suresh,Kumar,suresh.k@example.com";

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'employee_bulk_upload_template.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast('📥 Minimal CSV Template downloaded successfully!', 'info');
  };

  // CSV Bulk Upload Processing Handler
  const handleBulkUpload = async () => {
    if (!bulkFile) {
      showToast('⚠️ Please select a CSV file first.', 'error');
      return;
    }

    const targetCompanyId = activeCompanyId;
    if (!targetCompanyId) {
      showToast('⚠️ Please select a company first.', 'error');
      return;
    }

    setBulkUploading(true);
    setBulkResults(null);

    try {
      const text = await bulkFile.text();
      const lines = text.trim().split('\n').filter(l => l.trim());
      if (lines.length < 2) {
        showToast('⚠️ CSV file is empty or has no data rows.', 'error');
        setBulkUploading(false);
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const parsedEmployees = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => {
          let val = values[i] || '';
          if (h.toLowerCase() === 'email') val = val.replace(/\s+/g, '');
          obj[h] = val;
        });
        return obj;
      });

      const res = await fetch(`${API_BASE}/api/v1/employees/bulk`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ employees: parsedEmployees, companyId: targetCompanyId }),
      });

      const data = await res.json();
      setBulkResults(data.results || []);

      if (data.successCount > 0) {
        const kcFail = data.keycloakFailCount || 0;
        if (kcFail > 0) {
          showToast(`✅ ${data.successCount} DB records saved · ⚠️ ${kcFail} Keycloak accounts failed`, 'error');
        } else {
          showToast(`✅ ${data.successCount} employees fully imported (DB + Keycloak)!`, 'success', 6000);
        }
      }
      if (data.errorCount > 0) {
        showToast(`❌ ${data.errorCount} rows skipped (duplicate/invalid). Check results.`, 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('⚠️ Error processing CSV file. Please check file format.', 'error');
    } finally {
      setBulkUploading(false);
    }
  };

  const stylishInputClass = "w-full px-3.5 py-2.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/40 text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200 outline-none shadow-2xs";

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }} className="space-y-5 max-w-[1600px] mx-auto p-4 sm:p-5 font-sans">
      <DashboardPageHeader
        title="Employee Directory"
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

      {/* EXECUTIVE HEADER WITH SLEEK MODE SWITCHER TABS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3.5">
          <Link
            href="/dashboard/employees"
            className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-all cursor-pointer text-lg font-bold border-0 shadow-2xs"
          >
            ←
          </Link>
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span>👤</span> Employee Onboarding Hub
            </h2>
            <p className="text-xs text-slate-400 font-medium">
              Single profile onboarding wizard or batch CSV spreadsheet import
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-start md:justify-end">
          {/* HIGH-END EXECUTIVE MODE SWITCHER TABS */}
          <div className="inline-flex items-center p-1.5 rounded-2xl bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/80 shadow-2xs gap-1">
            <button
              type="button"
              onClick={() => setOnboardingMode('single')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all duration-200 cursor-pointer border-0 ${
                onboardingMode === 'single'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-700/50'
              }`}
            >
              <span>👤</span> Single Profile Form
            </button>
            <button
              type="button"
              onClick={() => setOnboardingMode('bulk')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all duration-200 cursor-pointer border-0 ${
                onboardingMode === 'bulk'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-700/50'
              }`}
            >
              <span>📁</span> Bulk CSV Upload
            </button>
          </div>

          <Link
            href="/dashboard/employees"
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all border-0"
          >
            Cancel
          </Link>
        </div>
      </div>

      {/* MODE 1: SINGLE EMPLOYEE FORM */}
      {onboardingMode === 'single' && (
        <div className="space-y-5 animate-fadeIn">
          {/* 🌟 UNIFIED SINGLE CONTINUOUS PROGRESS STEPPER HEADER */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
            {/* Top Bar: Step Title + Overall Progress Percentage */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-extrabold text-xs border border-blue-200 dark:border-blue-900">
                  Step {currentStep}/4
                </span>
                <div>
                  <h3 className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <span>{STEPPER_STEPS[currentStep - 1].icon}</span> {STEPPER_STEPS[currentStep - 1].title}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {STEPPER_STEPS[currentStep - 1].subtitle}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:justify-end">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Overall Completion:</span>
                <span className="text-xs font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-900">
                  {stepPercentages.overall}% Filled
                </span>
              </div>
            </div>

            {/* SINGLE UNIFIED CONTINUOUS PROGRESS BAR TRACK */}
            <div className="relative w-full space-y-3">
              <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden shadow-inner">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500 transition-all duration-500 ease-out shadow-xs"
                  style={{ width: `${Math.max(5, ((currentStep - 1) / 3) * 100)}%` }}
                />
              </div>

              {/* 4 Interactive Step Node Badges along the line */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                {STEPPER_STEPS.map((step) => {
                  const isActive = currentStep === step.id;
                  const isCompleted = currentStep > step.id;
                  const stepPct = (stepPercentages as any)[step.id] || 0;

                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => {
                        if (step.id < currentStep || validateStep(currentStep)) {
                          setCurrentStep(step.id);
                        }
                      }}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all duration-200 cursor-pointer text-left ${
                        isActive
                          ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-500/80 dark:border-blue-500 shadow-xs ring-1 ring-blue-500/20 scale-[1.01]'
                          : isCompleted
                          ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300/80 dark:border-emerald-800 hover:bg-emerald-50/70'
                          : 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black transition-all flex-shrink-0 ${
                        isCompleted
                          ? 'bg-emerald-500 text-white shadow-xs'
                          : isActive
                          ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-500/20'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                      }`}>
                        {isCompleted ? '✓' : step.id}
                      </span>
                      <div className="truncate min-w-0 flex-1">
                        <p className={`text-[11px] font-extrabold truncate ${
                          isActive
                            ? 'text-blue-600 dark:text-blue-400'
                            : isCompleted
                            ? 'text-emerald-700 dark:text-emerald-300'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}>
                          {step.title}
                        </p>
                        <span className="text-[10px] font-bold text-slate-400 block">
                          {isCompleted ? '✓ Done' : `${stepPct}%`}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* STEPPER CONTENT FORM */}
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* STEP 1: PERSONAL DETAILS */}
            {currentStep === 1 && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-5 animate-fadeIn">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h3 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                      <span>👤</span> Step 1: Personal Details & Identity
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium">Basic identity, phone, email & photo</p>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-900">
                    {stepPercentages[1]}% Filled
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 items-start">
                  {/* Photo Upload Box */}
                  <div className="w-full flex flex-col items-center justify-between p-3 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/30 text-center space-y-3">
                    <div className="w-full h-56 sm:h-60 rounded-xl bg-slate-900/5 dark:bg-slate-950/60 overflow-hidden flex items-center justify-center relative border border-slate-300/80 dark:border-slate-700/80 shadow-inner p-1">
                      {empForm.emp_image ? (
                        <img src={empForm.emp_image} alt="Profile" className="w-full h-full object-contain rounded-lg transition-all duration-300" />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-slate-400">
                          <span className="text-3xl">📷</span>
                          <span className="text-[10px] font-bold">No Photo Uploaded</span>
                        </div>
                      )}
                    </div>
                    <div className="w-full">
                      <label className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 text-blue-600 dark:text-blue-400 text-xs font-bold cursor-pointer transition-all border border-blue-200 dark:border-blue-900">
                        <span>📤</span> {empForm.emp_image ? 'Change Photo' : 'Upload Full Photo'}
                        <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                      </label>
                    </div>
                  </div>

                  {/* Inputs Grid */}
                  <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        First Name *
                      </label>
                      <input
                        type="text"
                        value={empForm.first_name}
                        onChange={(e) => setEmpForm({ ...empForm, first_name: e.target.value })}
                        placeholder="Rahul"
                        className={stylishInputClass}
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Last Name *
                      </label>
                      <input
                        type="text"
                        value={empForm.last_name}
                        onChange={(e) => setEmpForm({ ...empForm, last_name: e.target.value })}
                        placeholder="Sharma"
                        className={stylishInputClass}
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Work / Personal Email *
                      </label>
                      <input
                        type="email"
                        value={empForm.email}
                        onChange={(e) => setEmpForm({ ...empForm, email: e.target.value.toLowerCase().replace(/\s+/g, '') })}
                        placeholder="rahul@company.com"
                        className={stylishInputClass}
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Mobile Phone *
                      </label>
                      <input
                        type="text"
                        value={empForm.phone}
                        onChange={(e) => setEmpForm({ ...empForm, phone: e.target.value })}
                        placeholder="+91 9876543210"
                        className={stylishInputClass}
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Gender *
                      </label>
                      <select
                        value={empForm.gender}
                        onChange={(e) => setEmpForm({ ...empForm, gender: e.target.value })}
                        className={`${stylishInputClass} cursor-pointer`}
                      >
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Date of Birth
                      </label>
                      <input
                        type="date"
                        value={empForm.dob}
                        onChange={(e) => setEmpForm({ ...empForm, dob: e.target.value })}
                        className={stylishInputClass}
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Blood Group
                      </label>
                      <select
                        value={empForm.blood_group}
                        onChange={(e) => setEmpForm({ ...empForm, blood_group: e.target.value })}
                        className={`${stylishInputClass} cursor-pointer`}
                      >
                        <option value="O_POSITIVE">O +ve</option>
                        <option value="O_NEGATIVE">O -ve</option>
                        <option value="A_POSITIVE">A +ve</option>
                        <option value="A_NEGATIVE">A -ve</option>
                        <option value="B_POSITIVE">B +ve</option>
                        <option value="B_NEGATIVE">B -ve</option>
                        <option value="AB_POSITIVE">AB +ve</option>
                        <option value="AB_NEGATIVE">AB -ve</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Marital Status
                      </label>
                      <select
                        value={empForm.marital_status}
                        onChange={(e) => setEmpForm({ ...empForm, marital_status: e.target.value })}
                        className={`${stylishInputClass} cursor-pointer`}
                      >
                        <option value="SINGLE">Single</option>
                        <option value="MARRIED">Married</option>
                        <option value="DIVORCED">Divorced</option>
                        <option value="WIDOWED">Widowed</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Employment Type *
                      </label>
                      <select
                        value={empForm.employment_type}
                        onChange={(e) => setEmpForm({ ...empForm, employment_type: e.target.value })}
                        className={`${stylishInputClass} cursor-pointer`}
                      >
                        <option value="FULL_TIME">Permanent / Full Time</option>
                        <option value="PROBATION">Probationary</option>
                        <option value="CONTRACT">Contractual</option>
                        <option value="INTERN">Internship</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: JOB & HIERARCHY */}
            {currentStep === 2 && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-5 animate-fadeIn">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h3 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                      <span>🏢</span> Step 2: Organization & Job Hierarchy
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium">Branch, department, shift & role assignment</p>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-900">
                    {stepPercentages[2]}% Filled
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Employee ID / Code *
                    </label>
                    <input
                      type="text"
                      value={empForm.emp_id_code}
                      onChange={(e) => setEmpForm({ ...empForm, emp_id_code: e.target.value })}
                      placeholder="e.g. EMP-101"
                      className={`${stylishInputClass} ${duplicateEmp ? 'border-amber-500 bg-amber-50/50 text-amber-900 font-bold' : ''}`}
                    />
                    {duplicateEmp && (
                      <div className="mt-1 p-1.5 rounded-lg bg-amber-100 text-[10px] font-bold text-amber-800">
                        ⚠️ ID Assigned to {duplicateEmp.first_name} {duplicateEmp.last_name}
                      </div>
                    )}
                  </div>

                  {isSuperAdmin && (
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Company *
                      </label>
                      <SearchableSelect
                        options={companies.map(c => ({ value: c.id, label: c.name }))}
                        value={empForm.companyId}
                        onChange={(val) => handleCompanyChange(val)}
                        placeholder="Select Company"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Branch / Office *
                    </label>
                    <SearchableSelect
                      options={deduplicateOptions(filteredBranches.map(b => ({ value: b.id, label: b.name })), empForm.branch_id)}
                      value={empForm.branch_id}
                      onChange={(val) => setEmpForm({ ...empForm, branch_id: val, department_id: '', designation_id: '' })}
                      placeholder="Select Branch"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Department *
                    </label>
                    <SearchableSelect
                      options={deduplicateOptions(filteredDepartments.map(d => ({ value: d.id, label: d.name })), empForm.department_id)}
                      value={empForm.department_id}
                      onChange={(val) => setEmpForm({ ...empForm, department_id: val, designation_id: '' })}
                      placeholder="Select Department"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Designation *
                    </label>
                    <SearchableSelect
                      options={deduplicateOptions(filteredDesignations.map(ds => ({ value: ds.id, label: ds.name })), empForm.designation_id)}
                      value={empForm.designation_id}
                      onChange={(val) => setEmpForm({ ...empForm, designation_id: val })}
                      placeholder="Select Designation"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Assigned Shift *
                    </label>
                    <SearchableSelect
                      options={deduplicateOptions(filteredShifts.map(s => ({ value: s.id, label: `${s.name} (${s.start_time} - ${s.end_time})` })), empForm.shift_id)}
                      value={empForm.shift_id}
                      onChange={(val) => setEmpForm({ ...empForm, shift_id: val })}
                      placeholder="Select Shift"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Date of Joining *
                    </label>
                    <input
                      type="date"
                      value={empForm.joining_date}
                      onChange={(e) => setEmpForm({ ...empForm, joining_date: e.target.value })}
                      className={stylishInputClass}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: BANK & FINANCIAL DETAILS */}
            {currentStep === 3 && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-5 animate-fadeIn">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h3 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                      <span>💳</span> Step 3: Salary, Bank & Statutory Info
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium">Salary CTC, bank account, IFSC & PAN</p>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-900">
                    {stepPercentages[3]}% Filled
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Annual CTC (₹)
                    </label>
                    <input
                      type="number"
                      value={empForm.ctc}
                      onChange={(e) => {
                        const ctcVal = parseFloat(e.target.value) || 0;
                        const basicVal = Math.round((ctcVal / 12) * 0.5);
                        setEmpForm({ ...empForm, ctc: e.target.value, basic_salary: String(basicVal) });
                      }}
                      placeholder="600000"
                      className={stylishInputClass}
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Monthly Basic (₹)
                    </label>
                    <input
                      type="number"
                      value={empForm.basic_salary}
                      onChange={(e) => setEmpForm({ ...empForm, basic_salary: e.target.value })}
                      placeholder="35000"
                      className={stylishInputClass}
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Bank Name
                    </label>
                    <input
                      type="text"
                      value={empForm.bank_name}
                      onChange={(e) => setEmpForm({ ...empForm, bank_name: e.target.value })}
                      placeholder="HDFC Bank"
                      className={stylishInputClass}
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Account Number
                    </label>
                    <input
                      type="text"
                      value={empForm.bank_acc_no}
                      onChange={(e) => setEmpForm({ ...empForm, bank_acc_no: e.target.value })}
                      placeholder="5010023456789"
                      className={stylishInputClass}
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      IFSC Code
                    </label>
                    <input
                      type="text"
                      value={empForm.ifsc_code}
                      onChange={(e) => setEmpForm({ ...empForm, ifsc_code: e.target.value.toUpperCase() })}
                      placeholder="HDFC0001234"
                      className={`${stylishInputClass} uppercase`}
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      PAN Number
                    </label>
                    <input
                      type="text"
                      value={empForm.pan_number}
                      onChange={(e) => setEmpForm({ ...empForm, pan_number: e.target.value.toUpperCase() })}
                      placeholder="ABCDE1234F"
                      className={`${stylishInputClass} uppercase`}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: ADDRESS & EMERGENCY CONTACT */}
            {currentStep === 4 && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-5 animate-fadeIn">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h3 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                      <span>📍</span> Step 4: Address & Emergency Contact
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium">Residential address & emergency contact</p>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-900">
                    {stepPercentages[4]}% Filled
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Address Line
                    </label>
                    <input
                      type="text"
                      value={empForm.address}
                      onChange={(e) => setEmpForm({ ...empForm, address: e.target.value })}
                      placeholder="Flat No, Building, Street"
                      className={stylishInputClass}
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      value={empForm.city}
                      onChange={(e) => setEmpForm({ ...empForm, city: e.target.value })}
                      placeholder="Hyderabad"
                      className={stylishInputClass}
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      State
                    </label>
                    <input
                      type="text"
                      value={empForm.state}
                      onChange={(e) => setEmpForm({ ...empForm, state: e.target.value })}
                      placeholder="Telangana"
                      className={stylishInputClass}
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Emergency Contact Name
                    </label>
                    <input
                      type="text"
                      value={empForm.emergency_contact_name}
                      onChange={(e) => setEmpForm({ ...empForm, emergency_contact_name: e.target.value })}
                      placeholder="Contact Name"
                      className={stylishInputClass}
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Emergency Contact Phone
                    </label>
                    <input
                      type="text"
                      value={empForm.emergency_contact_phone}
                      onChange={(e) => setEmpForm({ ...empForm, emergency_contact_phone: e.target.value })}
                      placeholder="+91 9876543210"
                      className={stylishInputClass}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* BOTTOM NAV CONTROLS */}
            <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="px-4 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer border-0"
                >
                  ⬅️ Previous
                </button>
              ) : (
                <div />
              )}

              {currentStep < 4 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer border-0 flex items-center gap-1.5"
                >
                  Next ➔
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSaving || !!duplicateEmp}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer border-0 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSaving ? 'Creating...' : '✨ Submit Profile'}
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* MODE 2: STUNNING EXECUTIVE BULK CSV UPLOAD DASHBOARD PANEL */}
      {onboardingMode === 'bulk' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6 animate-fadeIn">
          {/* Executive Header Banner */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 text-[11px] font-extrabold mb-1.5 border border-emerald-200 dark:border-emerald-900">
                <span>✨ BATCH IMPORT ENGINE</span>
              </div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                📁 Bulk Employee Spreadsheet Import (CSV)
              </h3>
              <p className="text-xs text-slate-400 font-medium mt-1">
                Batch register dozens of employees instantly using a single CSV file
              </p>
            </div>

            <button
              type="button"
              onClick={downloadSampleCsv}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-extrabold shadow-md shadow-blue-600/20 transition-all border-0 flex items-center gap-2 cursor-pointer"
            >
              <span>📥</span> Download Sample CSV Template
            </button>
          </div>

          {/* Minimal Required CSV Columns & Automatic Registration Guide */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Required CSV Header Fields
                </span>
                <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-900">
                  4 Minimal Fields Only
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 text-[11px] font-extrabold">
                {['emp_id_code', 'first_name', 'last_name', 'email'].map((col) => (
                  <span key={col} className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-mono shadow-2xs">
                    ✓ {col}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50/80 to-indigo-50/80 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-900 space-y-1.5">
              <span className="text-[11px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300 block">
                ⚡ Automatic Ingestion Settings
              </span>
              <div className="space-y-1 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                <p className="flex items-center gap-1.5">
                  <span>🏢</span> <strong>Company Context:</strong> Auto-binds logged-in Company ID
                </p>
                <p className="flex items-center gap-1.5">
                  <span>🔑</span> <strong>Keycloak User Sync:</strong> Auto-registers with Default Password <code className="px-1.5 py-0.5 rounded bg-blue-200 dark:bg-blue-900 text-blue-900 dark:text-blue-100 font-mono">123</code>
                </p>
              </div>
            </div>
          </div>

          {/* HIGH-END FILE UPLOAD DROP ZONE */}
          <div className="flex flex-col items-center justify-center p-8 sm:p-10 rounded-2xl border-2 border-dashed border-blue-200 dark:border-blue-900/60 bg-blue-50/20 dark:bg-slate-950/40 text-center space-y-4 transition-all hover:bg-blue-50/40">
            <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-3xl shadow-xs">
              📄
            </div>

            {bulkFile ? (
              <div className="space-y-3 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 max-w-md w-full">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 text-left overflow-hidden">
                    <span className="text-2xl">📊</span>
                    <div className="truncate">
                      <p className="text-xs font-extrabold text-emerald-900 dark:text-emerald-200 truncate">
                        {bulkFile.name}
                      </p>
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                        {(bulkFile.size / 1024).toFixed(1)} KB • Ready to Import
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setBulkFile(null); setBulkResults(null); }}
                    className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-700 hover:bg-rose-200 text-[11px] font-extrabold transition-all border-0 cursor-pointer flex-shrink-0"
                  >
                    ✕ Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-200">
                    Drag & Drop your Employee CSV file here, or click to browse
                  </p>
                  <p className="text-[11px] text-slate-400 font-medium mt-1">
                    Upload .csv format file with emp_id_code, first_name, last_name, email
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-extrabold shadow-md shadow-blue-600/20 cursor-pointer transition-all border-0">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <span className="text-white text-xs font-bold tracking-wide">Select CSV File</span>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      setBulkFile(e.target.files?.[0] || null);
                      setBulkResults(null);
                    }}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>

          {/* PROCESS & UPLOAD BUTTON */}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              disabled={!bulkFile || bulkUploading}
              onClick={handleBulkUpload}
              className="px-7 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black shadow-lg shadow-emerald-600/30 transition-all cursor-pointer border-0 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {bulkUploading ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Processing Employees...
                </>
              ) : (
                <>
                  <span>🚀</span> Import & Register Employees
                </>
              )}
            </button>
          </div>

          {/* BULK RESULTS DISPLAY TABLE */}
          {bulkResults && bulkResults.length > 0 && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden space-y-0 shadow-xs">
              <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
                  <span>📊</span> Bulk Import Execution Summary
                </h4>
                <div className="flex items-center gap-3 text-xs font-extrabold">
                  <span className="text-emerald-400">
                    ✅ {bulkResults.filter(r => r.status === 'success' && r.keycloak_status === 'created').length} DB + Keycloak OK
                  </span>
                  <span className="text-amber-400">
                    ⚠️ {bulkResults.filter(r => r.status === 'success' && r.keycloak_status === 'failed').length} Keycloak Failed
                  </span>
                  <span className="text-rose-400">
                    ❌ {bulkResults.filter(r => r.status === 'error').length} Skipped
                  </span>
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                {bulkResults.map((r, idx) => {
                  const isDbError = r.status === 'error';
                  const isKcFailed = r.status === 'success' && r.keycloak_status === 'failed';

                  return (
                    <div
                      key={idx}
                      className={`flex items-center justify-between px-5 py-3 ${
                        isDbError
                          ? 'bg-rose-50/50 dark:bg-rose-950/20'
                          : isKcFailed
                          ? 'bg-amber-50/50 dark:bg-amber-950/20'
                          : 'bg-white dark:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-extrabold text-[11px] flex items-center justify-center border border-slate-200 dark:border-slate-700">
                          #{r.row}
                        </span>
                        <div>
                          <p className="font-extrabold text-slate-800 dark:text-slate-200">
                            {r.emp_id_code || `Row ${r.row}`}
                          </p>
                          <p className="text-[11px] text-slate-400 font-medium">{r.message}</p>
                        </div>
                      </div>

                      <div>
                        {isDbError ? (
                          <span className="px-3 py-1 rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 font-black text-[10px]">
                            ❌ Skipped
                          </span>
                        ) : isKcFailed ? (
                          <span className="px-3 py-1 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 font-black text-[10px]">
                            ⚠️ DB Saved (KC Failed)
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-black text-[10px]">
                            ✅ DB + Keycloak OK
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CreateEmployeePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs font-bold text-slate-400">Loading Onboarding Hub...</div>}>
      <CreateEmployeeContent />
    </Suspense>
  );
}
