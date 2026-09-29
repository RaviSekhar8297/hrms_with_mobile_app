'use client';

import React, { useEffect, useState, useMemo, Suspense } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import DashboardPageHeader from '../../components/DashboardPageHeader';
import SearchableSelect from '../../components/SearchableSelect';
import { getHeaders, API_BASE, getUrl } from '../../utils/api';
import { useDashboard } from '../../components/DashboardContext';
import { usePermissions } from '../../hooks/usePermissions';
import { DatePickerSimple } from '@/components/ui/custom-controls';
import { CheckCircle2, Sparkles, ArrowRight, UserPlus, Clock } from 'lucide-react';

const STEPPER_STEPS = [
  { id: 1, title: 'Personal Details', subtitle: 'Identity & contact', icon: '' },
  { id: 2, title: 'Job & Hierarchy', subtitle: 'Branch, dept & shift', icon: '' },
  { id: 3, title: 'Bank & Financials', subtitle: 'Salary, bank & PAN', icon: '' },
  { id: 4, title: 'Address & Contact', subtitle: 'Address & emergency', icon: '' },
] as const;

const INITIAL_EMP_FORM = {
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
  role_id: '',
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
};

function CreateEmployeeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast, companyId: contextCompanyId, companies: contextCompanies } = useDashboard();
  const { isSuperAdmin, hasPermission } = usePermissions();
  const canCreateBranch = isSuperAdmin || hasPermission('create_branches');
  const canCreateDepartment = isSuperAdmin || hasPermission('create_departments');
  const canCreateDesignation = isSuperAdmin || hasPermission('create_designations');
  const canCreateShift = isSuperAdmin || hasPermission('create_shifts') || hasPermission('shifts_create');

  const modeParam = searchParams.get('mode');
  const [onboardingMode, setOnboardingMode] = useState<'single' | 'bulk'>('single');

  useEffect(() => {
    if (modeParam === 'bulk') {
      setOnboardingMode('bulk');
    }
  }, [modeParam]);

  const [currentStep, setCurrentStep] = useState<number>(1);

  // Registration Success Celebration Modal State (5-second auto-close)
  const [successModal, setSuccessModal] = useState<{
    isOpen: boolean;
    empName: string;
    empCode: string;
    email: string;
    tempPass?: string;
    countdown: number;
  } | null>(null);

  // Auto-close countdown timer effect
  useEffect(() => {
    if (!successModal?.isOpen) return;
    if (successModal.countdown <= 0) {
      router.push('/dashboard/employees');
      return;
    }
    const timer = setInterval(() => {
      setSuccessModal(prev => {
        if (!prev) return null;
        if (prev.countdown <= 1) {
          clearInterval(timer);
          router.push('/dashboard/employees');
          return { ...prev, countdown: 0 };
        }
        return { ...prev, countdown: prev.countdown - 1 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [successModal?.isOpen, successModal?.countdown, router]);

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
  const [empForm, setEmpForm] = useState(INITIAL_EMP_FORM);

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

    const activeCid = contextCompanyId || (typeof window !== 'undefined' ? (localStorage.getItem('companyId') || localStorage.getItem('selectedCompanyId')) : null);
    if (activeCid) {
      setEmpForm(prev => ({ ...prev, companyId: activeCid }));
    }

    fetchMetadata(activeCid || undefined);
  }, []);

  // Synchronize whenever context company changes from global Header
  useEffect(() => {
    if (contextCompanyId) {
      setEmpForm(prev => ({
        ...prev,
        companyId: contextCompanyId,
        branch_id: '',
        department_id: '',
        designation_id: '',
        role_id: '',
        tenant_role_id: '',
        shift_id: ''
      }));
      fetchMetadata(contextCompanyId);
      fetchEmployeesList(contextCompanyId);
      fetchRolesForCompany(contextCompanyId);
    }
  }, [contextCompanyId]);

  const activeCompanyId = contextCompanyId || (typeof window !== 'undefined' ? (localStorage.getItem('companyId') || localStorage.getItem('selectedCompanyId')) : null);

  const fetchEmployeesList = async (targetCid?: string) => {
    try {
      const cid = targetCid || activeCompanyId;
      const url = getUrl('/api/v1/employees', cid && cid !== 'all' ? cid : null);
      const res = await fetch(url, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.employees || []);
        setEmployees(list);
      }
    } catch (e) {
      console.error('Error fetching employees list:', e);
    }
  };

  const fetchMetadata = async (targetCid?: string | null) => {
    setIsLoading(true);
    try {
      const cid = targetCid || activeCompanyId;
      const [compRes, empRes, branchRes, deptRes, desigRes, roleRes, shiftRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/companies`, { headers: getHeaders() }),
        fetch(getUrl('/api/v1/employees', cid && cid !== 'all' ? cid : null), { headers: getHeaders() }),
        fetch(getUrl('/api/v1/branches', cid && cid !== 'all' ? cid : null), { headers: getHeaders() }),
        fetch(getUrl('/api/v1/departments', cid && cid !== 'all' ? cid : null), { headers: getHeaders() }),
        fetch(getUrl('/api/v1/designations', cid && cid !== 'all' ? cid : null), { headers: getHeaders() }),
        fetch(getUrl('/api/v1/roles', cid && cid !== 'all' ? cid : null), { headers: getHeaders() }),
        fetch(getUrl('/api/v1/shifts', cid && cid !== 'all' ? cid : null), { headers: getHeaders() }),
      ]);

      if (compRes.ok) {
        const data = await compRes.json();
        const list = Array.isArray(data) ? data : (data.companies || []);
        setCompanies(list);
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

  const fetchRolesForCompany = async (targetCid?: string | null) => {
    try {
      const cid = targetCid || activeCompanyId;
      const url = getUrl('/api/v1/roles', cid && cid !== 'all' ? cid : null);
      const res = await fetch(url, { headers: getHeaders() });
      if (res.ok) {
        const d = await res.json();
        setTenantRoles(Array.isArray(d) ? d : (d.roles || d.tenantRoles || d.data || []));
      }
    } catch (e) {
      console.error('Error fetching roles for company:', e);
    }
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

  // Whenever activeCompanyId becomes valid and employees are empty or changed, ensure list and roles are fetched
  useEffect(() => {
    if (activeCompanyId && activeCompanyId !== 'all') {
      fetchEmployeesList(activeCompanyId);
      fetchRolesForCompany(activeCompanyId);
    }
  }, [activeCompanyId]);

  const safeBranches = Array.isArray(branches) ? branches : [];
  const safeDepartments = Array.isArray(departments) ? departments : [];
  const safeDesignations = Array.isArray(designations) ? designations : [];
  const safeRoles = Array.isArray(tenantRoles) ? tenantRoles : [];
  const safeShifts = Array.isArray(shifts) ? shifts : [];
  const safeEmployees = Array.isArray(employees) ? employees : [];

  const filteredBranches = (activeCompanyId && activeCompanyId !== 'all')
    ? safeBranches.filter(b => b?.company_id === activeCompanyId)
    : safeBranches;
  const filteredDepartments = empForm.branch_id
    ? safeDepartments.filter(d => d?.branch_id === empForm.branch_id)
    : [];
  const filteredDesignations = empForm.department_id
    ? safeDesignations.filter(ds => ds?.department_id === empForm.department_id)
    : [];
  const filteredRoles = (activeCompanyId && activeCompanyId !== 'all') ? safeRoles.filter(r => r?.company_id === activeCompanyId) : safeRoles;
  const filteredShifts = (activeCompanyId && activeCompanyId !== 'all') ? safeShifts.filter(s => s?.company_id === activeCompanyId) : safeShifts;
  const filteredEmployees = (activeCompanyId && activeCompanyId !== 'all') ? safeEmployees.filter(e => e?.company_id === activeCompanyId) : safeEmployees;

  // Real-time server duplicate check states
  const [serverDuplicateEmail, setServerDuplicateEmail] = useState<any>(null);
  const [serverDuplicateEmpId, setServerDuplicateEmpId] = useState<any>(null);

  // Debounced API check against /api/v1/employees/check-duplicate
  useEffect(() => {
    const timer = setTimeout(async () => {
      const email = empForm.email.trim();
      const empId = empForm.emp_id_code.trim();
      if (!email && !empId) {
        setServerDuplicateEmail(null);
        setServerDuplicateEmpId(null);
        return;
      }
      try {
        const params = new URLSearchParams();
        if (email) params.set('email', email);
        if (empId) params.set('emp_id_code', empId);
        if (activeCompanyId && activeCompanyId !== 'all') params.set('companyId', activeCompanyId);
        
        const res = await fetch(`${API_BASE}/api/v1/employees/check-duplicate?${params.toString()}`, {
          headers: getHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          setServerDuplicateEmail(data.duplicateEmail || null);
          setServerDuplicateEmpId(data.duplicateEmpId || null);
        }
      } catch (err) {
        console.error('Check duplicate error:', err);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [empForm.email, empForm.emp_id_code, activeCompanyId]);

  // Real-time Duplicate Check for Employee ID Code (Server + Local)
  const duplicateEmp = useMemo(() => {
    if (!empForm.emp_id_code.trim()) return null;
    if (serverDuplicateEmpId) return serverDuplicateEmpId;
    const cleanId = empForm.emp_id_code.trim().toLowerCase();
    const targetCompanyId = activeCompanyId;
    return safeEmployees.find(e => {
      if (!e.emp_id_code) return false;
      const eCode = String(e.emp_id_code).trim().toLowerCase();
      const match = eCode === cleanId || eCode.replace(/[^a-z0-9]/gi, '') === cleanId.replace(/[^a-z0-9]/gi, '');
      const companyMatch = targetCompanyId && targetCompanyId !== 'all' ? String(e.company_id) === String(targetCompanyId) : true;
      return match && companyMatch;
    }) || null;
  }, [empForm.emp_id_code, serverDuplicateEmpId, activeCompanyId, safeEmployees]);

  // Real-time Duplicate Check for Email (Server + Local)
  const duplicateEmailEmp = useMemo(() => {
    if (!empForm.email.trim()) return null;
    if (serverDuplicateEmail) return serverDuplicateEmail;
    const cleanEmail = empForm.email.trim().toLowerCase();
    return safeEmployees.find(e => {
      const empEmail = String(e.email || '').trim().toLowerCase();
      const personalEmail = String(e.personal_email || '').trim().toLowerCase();
      return empEmail === cleanEmail || personalEmail === cleanEmail;
    }) || null;
  }, [empForm.email, serverDuplicateEmail, safeEmployees]);

  // Searchable Reporting Head Options (All Employees in Company)
  const reportingHeadOptions = useMemo(() => {
    return [
      { value: '', label: '-- None (Direct to Company / Top Level) --' },
      ...safeEmployees
        .filter(e => e.status === 'ACTIVE' || !e.status)
        .map(emp => ({
          value: emp.id,
          label: `${emp.first_name || ''} ${emp.last_name || ''} ${emp.emp_id_code ? `[${emp.emp_id_code}]` : ''}`.trim()
        }))
    ];
  }, [safeEmployees]);

  // Quick Add modal states for Branch, Department, Designation, Shift
  const [quickAddModal, setQuickAddModal] = useState<'branch' | 'department' | 'designation' | 'shift' | null>(null);
  const [quickAddForm, setQuickAddForm] = useState({
    name: '',
    address: '',
    description: '',
    start_time: '09:00',
    end_time: '18:00',
  });
  const [quickAddLoading, setQuickAddLoading] = useState(false);

  // Prevent background scrolling when quick add modal is open
  useEffect(() => {
    if (quickAddModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [quickAddModal]);

  const handleOpenQuickAddBranch = () => {
    if (!canCreateBranch) {
      showToast('⚠️ You do not have permission to create branches.', 'error');
      return;
    }
    if (!activeCompanyId || activeCompanyId === 'all') {
      showToast('⚠️ Please select a company first.', 'error');
      return;
    }
    setQuickAddForm({ name: '', address: '', description: '', start_time: '09:00', end_time: '18:00' });
    setQuickAddModal('branch');
  };

  const handleOpenQuickAddDepartment = () => {
    if (!canCreateDepartment) {
      showToast('⚠️ You do not have permission to create departments.', 'error');
      return;
    }
    if (!activeCompanyId || activeCompanyId === 'all') {
      showToast('⚠️ Please select a company first.', 'error');
      return;
    }
    if (!empForm.branch_id) {
      showToast('⚠️ Please select or create a Branch first before adding a Department.', 'error');
      return;
    }
    setQuickAddForm({ name: '', address: '', description: '', start_time: '09:00', end_time: '18:00' });
    setQuickAddModal('department');
  };

  const handleOpenQuickAddDesignation = () => {
    if (!canCreateDesignation) {
      showToast('⚠️ You do not have permission to create designations.', 'error');
      return;
    }
    if (!activeCompanyId || activeCompanyId === 'all') {
      showToast('⚠️ Please select a company first.', 'error');
      return;
    }
    if (!empForm.branch_id) {
      showToast('⚠️ Please select a Branch first before adding a Designation.', 'error');
      return;
    }
    if (!empForm.department_id) {
      showToast('⚠️ Please select or create a Department first before adding a Designation.', 'error');
      return;
    }
    setQuickAddForm({ name: '', address: '', description: '', start_time: '09:00', end_time: '18:00' });
    setQuickAddModal('designation');
  };

  const handleOpenQuickAddShift = () => {
    if (!canCreateShift) {
      showToast('⚠️ You do not have permission to create shifts.', 'error');
      return;
    }
    if (!activeCompanyId || activeCompanyId === 'all') {
      showToast('⚠️ Please select a company first.', 'error');
      return;
    }
    setQuickAddForm({ name: '', address: '', description: '', start_time: '09:00', end_time: '18:00' });
    setQuickAddModal('shift');
  };

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddForm.name.trim()) {
      showToast('⚠️ Please enter a name.', 'error');
      return;
    }
    setQuickAddLoading(true);
    try {
      if (quickAddModal === 'branch') {
        const res = await fetch(`${API_BASE}/api/v1/branches`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            companyId: activeCompanyId,
            name: quickAddForm.name.trim(),
            address: quickAddForm.address.trim()
          })
        });
        const data = await res.json();
        if (res.ok && data.branch) {
          showToast(`✅ Branch "${data.branch.name}" created successfully!`, 'success');
          setBranches(prev => [...prev, data.branch]);
          setEmpForm(prev => ({ ...prev, branch_id: data.branch.id }));
          setQuickAddModal(null);
        } else {
          showToast(data.error || 'Failed to create branch.', 'error');
        }
      } else if (quickAddModal === 'department') {
        const res = await fetch(`${API_BASE}/api/v1/departments`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            companyId: activeCompanyId,
            branch_id: empForm.branch_id,
            name: quickAddForm.name.trim(),
            description: quickAddForm.description.trim()
          })
        });
        const data = await res.json();
        if (res.ok && data.department) {
          showToast(`✅ Department "${data.department.name}" created successfully!`, 'success');
          setDepartments(prev => [...prev, data.department]);
          setEmpForm(prev => ({ ...prev, department_id: data.department.id }));
          setQuickAddModal(null);
        } else {
          showToast(data.error || 'Failed to create department.', 'error');
        }
      } else if (quickAddModal === 'designation') {
        const res = await fetch(`${API_BASE}/api/v1/designations`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            companyId: activeCompanyId,
            branch_id: empForm.branch_id,
            department_id: empForm.department_id,
            name: quickAddForm.name.trim(),
            description: quickAddForm.description.trim()
          })
        });
        const data = await res.json();
        if (res.ok && data.designation) {
          showToast(`✅ Designation "${data.designation.name}" created successfully!`, 'success');
          setDesignations(prev => [...prev, data.designation]);
          setEmpForm(prev => ({ ...prev, designation_id: data.designation.id }));
          setQuickAddModal(null);
        } else {
          showToast(data.error || 'Failed to create designation.', 'error');
        }
      } else if (quickAddModal === 'shift') {
        const res = await fetch(`${API_BASE}/api/v1/shifts`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            companyId: activeCompanyId,
            name: quickAddForm.name.trim(),
            start_time: quickAddForm.start_time || '09:00',
            end_time: quickAddForm.end_time || '18:00',
          })
        });
        const data = await res.json();
        if (res.ok && data.shift) {
          showToast(`✅ Shift "${data.shift.name}" created successfully!`, 'success');
          setShifts(prev => [...prev, data.shift]);
          setEmpForm(prev => ({ ...prev, shift_id: data.shift.id }));
          setQuickAddModal(null);
        } else {
          showToast(data.error || 'Failed to create shift.', 'error');
        }
      }
    } catch (err: any) {
      console.error(err);
      showToast('⚠️ Error connecting to server: ' + err.message, 'error');
    } finally {
      setQuickAddLoading(false);
    }
  };

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

    const step2Fields = ['emp_id_code', 'shift_id', 'joining_date', 'branch_id', 'department_id', 'designation_id', 'role_id'];
    const s2Filled = step2Fields.filter(k => {
      if (k === 'role_id') return !!(empForm.role_id || empForm.tenant_role_id);
      return !!String((empForm as any)[k] || '').trim();
    }).length;
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
      if (duplicateEmailEmp) {
        showToast(`❌ Email is already assigned to ${duplicateEmailEmp.first_name} ${duplicateEmailEmp.last_name || ''} (ID: ${duplicateEmailEmp.emp_id_code || 'N/A'})`, 'error');
        return false;
      }
      if (!empForm.phone.trim()) {
        showToast('⚠️ Please enter Mobile Phone Number', 'error');
        return false;
      }
      if (empForm.phone.trim().length !== 10) {
        showToast('⚠️ Mobile phone number must be exactly 10 digits', 'error');
        return false;
      }
    } else if (stepNumber === 2) {
      if (!empForm.emp_id_code.trim()) {
        showToast('⚠️ Please enter Employee ID / Code', 'error');
        return false;
      }
      if (empForm.emp_id_code.trim().length > 15) {
        showToast('⚠️ Employee ID / Code cannot exceed 15 characters', 'error');
        return false;
      }
      if (duplicateEmp) {
        showToast(`❌ Employee ID "${empForm.emp_id_code}" is already assigned to ${duplicateEmp.first_name} ${duplicateEmp.last_name || ''}`, 'error');
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
      if (!empForm.role_id && !empForm.tenant_role_id) {
        showToast('⚠️ Please select an Access Role', 'error');
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
        role_id: empForm.role_id || empForm.tenant_role_id || null,
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
        const registeredName = `${empForm.first_name} ${empForm.last_name}`.trim();
        const registeredCode = empForm.emp_id_code || data.employee?.emp_id_code || '';
        const registeredEmail = empForm.email || '';
        const tempPass = data.keycloakTempPassword || '';

        setSuccessModal({
          isOpen: true,
          empName: registeredName,
          empCode: registeredCode,
          email: registeredEmail,
          tempPass: tempPass,
          countdown: 5,
        });
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
    const csvContent = "emp_id_code,first_name,last_name,email,phone,joining_date,branch_name,department_name,designation_name,role_name\n" +
      "EMP-201,Rahul,Sharma,rahul.s@example.com,9876543210,2026-01-15,Head Office,Engineering,Senior Software Engineer,Developer\n" +
      "EMP-202,Priya,Verma,priya.v@example.com,9876543211,2026-02-01,Regional Office,Human Resources,HR Manager,HR\n" +
      "EMP-203,Suresh,Kumar,suresh.k@example.com,9876543212,2026-02-15,Head Office,Finance,Accounts Executive,Finance Staff";

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'employee_bulk_upload_template.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast('📥 Employee CSV Template downloaded successfully!', 'info');
  };

  // CSV Bulk Upload Processing Handler (Positional 2nd row parser with keyword fallback)
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
      
      // Parse data starting from 2nd row (index 1) with positional fallback
      const parsedEmployees = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        if (values.length === 0 || values.every(v => !v)) return null;

        const getColValue = (posIndex: number, keywords: string[]) => {
          let matchedIndex = -1;
          headers.forEach((h, idx) => {
            const lowerH = h.toLowerCase();
            if (keywords.some(k => lowerH.includes(k))) {
              matchedIndex = idx;
            }
          });
          if (matchedIndex !== -1 && values[matchedIndex] !== undefined) {
            return values[matchedIndex];
          }
          return values[posIndex] || '';
        };

        const empIdCode = getColValue(0, ['code', 'emp', 'id']) || `EMP-${Math.floor(1000 + Math.random() * 9000)}`;
        const firstName = getColValue(1, ['first', 'fname', 'name']);
        const lastName = getColValue(2, ['last', 'lname', 'surname']);
        const email = (getColValue(3, ['email', 'mail']) || '').replace(/\s+/g, '');
        const phone = getColValue(4, ['phone', 'mobile', 'contact']);
        const joiningDate = getColValue(5, ['join', 'doj', 'date']);
        const branchName = getColValue(6, ['branch', 'office', 'location']);
        const deptName = getColValue(7, ['dept', 'department']);
        const desigName = getColValue(8, ['desig', 'designation', 'title']);
        const roleName = getColValue(9, ['role', 'role_name', 'access']);

        return {
          emp_id_code: empIdCode,
          first_name: firstName,
          last_name: lastName,
          email: email,
          phone: phone,
          joining_date: joiningDate,
          branch_name: branchName,
          department_name: deptName,
          designation_name: desigName,
          role_name: roleName,
        };
      }).filter(Boolean);

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

  const stylishInputClass = "stylish-input w-full px-3.5 py-2.5 rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:border-[#07518a] focus:ring-4 focus:ring-[#07518a]/15 hover:border-slate-400 dark:hover:border-slate-600 transition-all duration-200 outline-none shadow-xs";

  return (
    <div className="space-y-6 animate-fadeIn w-full font-sans">
      <DashboardPageHeader
        title="Employee Directory"
        actionMessage=""
        actionError=""
        companies={companies}
        companyId={activeCompanyId}
        handleCompanyChange={() => {}}
        isSuperAdmin={isSuperAdmin}
        email={email}
        hideCompanySelect={true}
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
              className={`inline-flex items-center px-4 py-2 rounded-xl text-xs font-black transition-all duration-200 cursor-pointer border-0 ${
                onboardingMode === 'single'
                  ? 'bg-[#07518a] text-white shadow-md shadow-[#07518a]/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-700/50'
              }`}
            >
              Single Profile
            </button>
            <button
              type="button"
              onClick={() => setOnboardingMode('bulk')}
              className={`inline-flex items-center px-4 py-2 rounded-xl text-xs font-black transition-all duration-200 cursor-pointer border-0 ${
                onboardingMode === 'bulk'
                  ? 'bg-[#07518a] text-white shadow-md shadow-[#07518a]/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-700/50'
              }`}
            >
              Bulk CSV Upload
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
                <span className="px-3 py-1.5 rounded-xl bg-[#07518a]/10 dark:bg-[#07518a]/20 text-[#07518a] dark:text-[#38bdf8] font-extrabold text-xs border border-[#07518a]/20 dark:border-[#07518a]/30 inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap shadow-2xs">
                  Step {currentStep} of 4
                </span>
                <div>
                  <h3 className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    {STEPPER_STEPS[currentStep - 1].icon ? <span>{STEPPER_STEPS[currentStep - 1].icon}</span> : null} Step {currentStep}: {STEPPER_STEPS[currentStep - 1].title}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {STEPPER_STEPS[currentStep - 1].subtitle}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:justify-end">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Complete Percentage:</span>
                <span className="text-xs font-black text-[#07518a] dark:text-[#38bdf8] bg-[#07518a]/10 dark:bg-[#07518a]/20 px-2.5 py-1 rounded-lg border border-[#07518a]/20 dark:border-[#07518a]/30">
                  {stepPercentages.overall}% Filled
                </span>
              </div>
            </div>

            {/* SINGLE UNIFIED CONTINUOUS PROGRESS BAR TRACK */}
            <div className="relative w-full space-y-3">
              <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden shadow-inner">
                <div
                  className="h-full rounded-full bg-[#07518a] transition-all duration-500 ease-out shadow-xs"
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
                          ? 'bg-[#07518a]/10 dark:bg-[#07518a]/20 border-[#07518a] shadow-xs ring-1 ring-[#07518a]/20 scale-[1.01]'
                          : isCompleted
                          ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300/80 dark:border-emerald-800 hover:bg-emerald-50/70'
                          : 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black transition-all flex-shrink-0 ${
                        isCompleted
                          ? 'bg-emerald-500 text-white shadow-xs'
                          : isActive
                          ? 'bg-[#07518a] text-white shadow-xs ring-2 ring-[#07518a]/20'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                      }`}>
                        {isCompleted ? '✓' : step.id}
                      </span>
                      <div className="truncate min-w-0 flex-1">
                        <p className={`text-[11px] font-extrabold truncate ${
                          isActive
                            ? 'text-[#07518a] dark:text-[#38bdf8]'
                            : isCompleted
                            ? 'text-emerald-700 dark:text-emerald-300'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}>
                          Step {step.id}: {step.title}
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
                      Step 1: Personal Details & Identity
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium">Basic identity, phone, email & photo</p>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-900">
                    {stepPercentages[1]}% Filled
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 items-start">
                  {/* Photo Upload Box - Clickable inside & button */}
                  <div className="w-full flex flex-col items-center justify-between p-3 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-950/30 text-center space-y-3">
                    <label
                      htmlFor="emp_photo_input"
                      className="w-full h-56 sm:h-60 rounded-xl bg-slate-900/5 dark:bg-slate-950/60 overflow-hidden flex flex-col items-center justify-center relative border-2 border-slate-300/90 dark:border-slate-700/90 shadow-inner p-1 cursor-pointer group hover:border-blue-500 hover:bg-blue-50/20 transition-all duration-200"
                    >
                      <input
                        id="emp_photo_input"
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                      {empForm.emp_image ? (
                        <div className="w-full h-full relative group">
                          <img
                            src={empForm.emp_image}
                            alt="Profile"
                            className="w-full h-full object-contain rounded-lg transition-all duration-300 group-hover:opacity-75"
                          />
                          <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex flex-col items-center justify-center text-white">
                            <span className="text-xl mb-1">📸</span>
                            <span className="text-[11px] font-black bg-blue-600 px-2.5 py-1 rounded-md shadow-md">Click inside to change</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1.5 text-slate-400 group-hover:text-blue-600 transition-colors p-3">
                          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center text-2xl shadow-2xs group-hover:scale-110 transition-transform">
                            📷
                          </div>
                          <span className="text-xs font-black text-slate-700 dark:text-slate-200">Click inside to upload</span>
                          <span className="text-[10px] font-semibold text-slate-400">JPG, PNG or WEBP (Max 5MB)</span>
                        </div>
                      )}
                    </label>
                    <div className="w-full">
                      <label
                        htmlFor="emp_photo_input"
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 text-blue-600 dark:text-blue-400 text-xs font-bold cursor-pointer transition-all border border-blue-200 dark:border-blue-900"
                      >
                        <span>📤</span> {empForm.emp_image ? 'Change Photo' : 'Upload Full Photo'}
                      </label>
                    </div>
                  </div>

                  {/* Inputs Grid */}
                  <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        First Name <span className="text-rose-500 font-bold ml-0.5">*</span>
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
                        Last Name <span className="text-rose-500 font-bold ml-0.5">*</span>
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
                        Work / Personal Email <span className="text-rose-500 font-bold ml-0.5">*</span>
                      </label>
                      <input
                        type="email"
                        value={empForm.email}
                        onChange={(e) => setEmpForm({ ...empForm, email: e.target.value.toLowerCase().replace(/\s+/g, '') })}
                        placeholder="rahul@company.com"
                        className={`${stylishInputClass} ${duplicateEmailEmp ? 'border-rose-500 bg-rose-50/20 dark:bg-rose-950/20 text-rose-900 dark:text-rose-100 ring-2 ring-rose-500/20' : ''}`}
                      />
                      {duplicateEmailEmp && (
                        <div className="mt-1.5 p-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-[11px] font-bold flex items-start gap-1.5 animate-fadeIn">
                          <span className="shrink-0">⚠️</span>
                          <span>
                            This email is already assigned to <span className="underline font-black">{duplicateEmailEmp.first_name} {duplicateEmailEmp.last_name}</span> {duplicateEmailEmp.emp_id_code ? `(ID: ${duplicateEmailEmp.emp_id_code})` : ''}
                          </span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Mobile Phone <span className="text-rose-500 font-bold ml-0.5">*</span>
                      </label>
                      <input
                        type="tel"
                        value={empForm.phone}
                        onChange={(e) => setEmpForm({ ...empForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                        placeholder="9876543210"
                        maxLength={10}
                        className={stylishInputClass}
                      />
                      {empForm.phone && empForm.phone.length > 0 && empForm.phone.length < 10 && (
                        <p className="mt-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                          ⚠️ 10-digit mobile number required ({empForm.phone.length}/10 digits entered)
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Gender <span className="text-rose-500 font-bold ml-0.5">*</span>
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

                    <DatePickerSimple
                      label="Date of Birth"
                      placeholder="Select Date of Birth"
                      maxDate={new Date().toISOString().split('T')[0]}
                      value={empForm.dob}
                      onChange={(val) => setEmpForm((prev) => ({ ...prev, dob: val }))}
                    />

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
                        Employment Type <span className="text-rose-500 font-bold ml-0.5">*</span>
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

                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                        <span>Reporting Head / Manager</span>
                        <span className="text-[10px] font-medium text-slate-400">Optional</span>
                      </label>
                      <SearchableSelect
                        options={reportingHeadOptions}
                        value={empForm.reporting_to_id}
                        onChange={(val) => setEmpForm({ ...empForm, reporting_to_id: val })}
                        placeholder="-- Search & Select Reporting Head --"
                      />
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
                      Step 2: Organization & Job Hierarchy
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium">Branch, department, shift & role assignment</p>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-900">
                    {stepPercentages[2]}% Filled
                  </span>
                </div>

                {/* ROW 1: Employee ID / Code, Assigned Shift, Date of Joining */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Employee ID / Code <span className="text-rose-500 font-bold ml-0.5">*</span>
                    </label>
                    <input
                      type="text"
                      maxLength={15}
                      value={empForm.emp_id_code}
                      onChange={(e) => setEmpForm({ ...empForm, emp_id_code: e.target.value.slice(0, 15) })}
                      placeholder="e.g. VS-1001 or 1027"
                      className={`${stylishInputClass} ${duplicateEmp ? 'border-rose-500 bg-rose-50/30 dark:bg-rose-950/20 text-rose-900 dark:text-rose-100 font-bold ring-2 ring-rose-500/20' : ''}`}
                    />
                    {duplicateEmp && (
                      <div className="mt-1.5 p-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-[11px] font-bold flex items-start gap-1.5 animate-fadeIn">
                        <span className="shrink-0">⚠️</span>
                        <span>
                          Employee ID &ldquo;<span className="underline font-black">{empForm.emp_id_code}</span>&rdquo; is already assigned to <span className="underline font-black">{duplicateEmp.first_name} {duplicateEmp.last_name}</span> {duplicateEmp.email ? `(${duplicateEmp.email})` : ''}
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Assigned Shift <span className="text-rose-500 font-bold ml-0.5">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <SearchableSelect
                          options={deduplicateOptions(filteredShifts.map(s => ({ value: s.id, label: `${s.name} (${s.start_time} - ${s.end_time})` })), empForm.shift_id)}
                          value={empForm.shift_id}
                          onChange={(val) => setEmpForm({ ...empForm, shift_id: val })}
                          placeholder="Select Shift"
                        />
                      </div>
                      {canCreateShift && (
                        <div className="relative group">
                          <button
                            type="button"
                            onClick={handleOpenQuickAddShift}
                            title="Add Shift"
                            className="h-[42px] w-[42px] shrink-0 flex items-center justify-center rounded-xl bg-[#07518a] hover:bg-[#064270] text-white border border-[#07518a] shadow-xs transition-all duration-200 text-lg font-bold cursor-pointer active:scale-95"
                          >
                            +
                          </button>
                          <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow transition-opacity group-hover:opacity-100 z-30">
                            Add Shift
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <DatePickerSimple
                    label={
                      <span>
                        Date of Joining <span className="text-rose-500 font-bold ml-0.5">*</span>
                      </span>
                    }
                    placeholder="Select Date of Joining"
                    value={empForm.joining_date}
                    onChange={(val) => setEmpForm((prev) => ({ ...prev, joining_date: val }))}
                  />
                </div>

                {/* ROW 2: Branch, Department */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Branch / Office <span className="text-rose-500 font-bold ml-0.5">*</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 min-w-0">
                        <SearchableSelect
                          options={deduplicateOptions(filteredBranches.map(b => ({ value: b.id, label: b.name })), empForm.branch_id)}
                          value={empForm.branch_id}
                          onChange={(val) => setEmpForm({ ...empForm, branch_id: val, department_id: '', designation_id: '' })}
                          placeholder="Select Branch"
                        />
                      </div>
                      {canCreateBranch && (
                        <div className="relative group">
                          <button
                            type="button"
                            onClick={handleOpenQuickAddBranch}
                            title="Add Branch"
                            className="h-[42px] w-[42px] shrink-0 flex items-center justify-center rounded-xl bg-[#07518a] hover:bg-[#064270] text-white border border-[#07518a] shadow-xs transition-all duration-200 text-lg font-bold cursor-pointer active:scale-95"
                          >
                            +
                          </button>
                          <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow transition-opacity group-hover:opacity-100 z-30">
                            Add Branch
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Department <span className="text-rose-500 font-bold ml-0.5">*</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 min-w-0">
                        <SearchableSelect
                          options={deduplicateOptions(filteredDepartments.map(d => ({ value: d.id, label: d.name })), empForm.department_id)}
                          value={empForm.department_id}
                          onChange={(val) => setEmpForm({ ...empForm, department_id: val, designation_id: '' })}
                          placeholder={empForm.branch_id ? "Select Department" : "Select Branch first"}
                          disabled={!empForm.branch_id}
                        />
                      </div>
                      {canCreateDepartment && (!empForm.branch_id ? (
                        <div className="relative group">
                          <button
                            type="button"
                            onClick={handleOpenQuickAddDepartment}
                            title="Select Branch first to add Department"
                            className="h-[42px] w-[42px] shrink-0 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 text-lg font-bold cursor-pointer active:scale-95 opacity-60"
                          >
                            +
                          </button>
                          <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow transition-opacity group-hover:opacity-100 z-30">
                            Select Branch first
                          </span>
                        </div>
                      ) : (
                        <div className="relative group">
                          <button
                            type="button"
                            onClick={handleOpenQuickAddDepartment}
                            title="Add Department"
                            className="h-[42px] w-[42px] shrink-0 flex items-center justify-center rounded-xl bg-[#07518a] hover:bg-[#064270] text-white border border-[#07518a] shadow-xs transition-all duration-200 text-lg font-bold cursor-pointer active:scale-95"
                          >
                            +
                          </button>
                          <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow transition-opacity group-hover:opacity-100 z-30">
                            Add Department
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ROW 3: Designation, Role */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Designation <span className="text-rose-500 font-bold ml-0.5">*</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 min-w-0">
                        <SearchableSelect
                          options={deduplicateOptions(filteredDesignations.map(ds => ({ value: ds.id, label: ds.name })), empForm.designation_id)}
                          value={empForm.designation_id}
                          onChange={(val) => setEmpForm({ ...empForm, designation_id: val })}
                          placeholder={
                            !empForm.branch_id
                              ? "Select Branch & Dept first"
                              : !empForm.department_id
                              ? "Select Department first"
                              : "Select Designation"
                          }
                          disabled={!empForm.department_id}
                        />
                      </div>
                      {canCreateDesignation && (!empForm.branch_id || !empForm.department_id ? (
                        <div className="relative group">
                          <button
                            type="button"
                            onClick={handleOpenQuickAddDesignation}
                            title="Select Branch & Department first to add Designation"
                            className="h-[42px] w-[42px] shrink-0 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 text-lg font-bold cursor-pointer active:scale-95 opacity-60"
                          >
                            +
                          </button>
                          <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow transition-opacity group-hover:opacity-100 z-30">
                            Select Branch &amp; Dept first
                          </span>
                        </div>
                      ) : (
                        <div className="relative group">
                          <button
                            type="button"
                            onClick={handleOpenQuickAddDesignation}
                            title="Add Designation"
                            className="h-[42px] w-[42px] shrink-0 flex items-center justify-center rounded-xl bg-[#07518a] hover:bg-[#064270] text-white border border-[#07518a] shadow-xs transition-all duration-200 text-lg font-bold cursor-pointer active:scale-95"
                          >
                            +
                          </button>
                          <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow transition-opacity group-hover:opacity-100 z-30">
                            Add Designation
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Role <span className="text-rose-500 font-bold ml-0.5">*</span>
                    </label>
                    <SearchableSelect
                      options={deduplicateOptions(filteredRoles.map(r => ({ value: r.id, label: r.name })), empForm.role_id || empForm.tenant_role_id)}
                      value={empForm.role_id || empForm.tenant_role_id}
                      onChange={(val) => setEmpForm({ ...empForm, role_id: val, tenant_role_id: val })}
                      placeholder="Select Access Role"
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
                      Step 3: Salary, Bank & Statutory Info
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
                      Step 4: Address & Emergency Contact
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
                  className="px-5 py-2 rounded-xl bg-[#07518a] hover:bg-[#064270] text-white text-xs font-bold shadow-md shadow-[#07518a]/20 cursor-pointer border-0 flex items-center gap-1.5 transition-all"
                >
                  Next ➔
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSaving || !!duplicateEmp || !!duplicateEmailEmp}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/40 cursor-pointer border-0 disabled:opacity-50 flex items-center gap-2 transition-all duration-200 hover:scale-[1.02] active:scale-95"
                >
                  {isSaving ? (
                    <>
                      <span className="animate-spin text-sm">⏳</span>
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <span>🚀</span>
                      <span>Submit</span>
                    </>
                  )}
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

      {/* QUICK ADD MODAL RENDERED VIA PORTAL TO COVER ENTIRE VIEWPORT (SIDEBAR + HEADER) */}
      {quickAddModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn font-sans">
          {/* Backdrop Click Dismiss */}
          <div className="fixed inset-0 bg-transparent cursor-pointer" onClick={() => setQuickAddModal(null)} />

          <div className="relative z-10 w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center text-base font-bold">
                  {quickAddModal === 'branch'
                    ? '🏢'
                    : quickAddModal === 'department'
                    ? '🏬'
                    : quickAddModal === 'designation'
                    ? '💼'
                    : '⏰'}
                </span>
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                    {quickAddModal === 'branch'
                      ? 'Quick Add Branch'
                      : quickAddModal === 'department'
                      ? 'Quick Add Department'
                      : quickAddModal === 'designation'
                      ? 'Quick Add Designation'
                      : 'Quick Add Shift'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Add immediately into currently active company context
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickAddModal(null)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-sm font-bold cursor-pointer transition-colors border-0"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleQuickAddSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {quickAddModal === 'branch'
                    ? 'Branch Name'
                    : quickAddModal === 'department'
                    ? 'Department Name'
                    : quickAddModal === 'designation'
                    ? 'Designation Title'
                    : 'Shift Name'}{' '}
                  <span className="text-rose-500 font-bold ml-0.5">*</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  value={quickAddForm.name}
                  onChange={(e) => setQuickAddForm({ ...quickAddForm, name: e.target.value })}
                  placeholder={
                    quickAddModal === 'branch'
                      ? 'e.g. Hyderabad Hitech City'
                      : quickAddModal === 'department'
                      ? 'e.g. Product Engineering'
                      : quickAddModal === 'designation'
                      ? 'e.g. Senior Full Stack Engineer'
                      : 'e.g. Morning Regular (9 AM - 6 PM)'
                  }
                  className={stylishInputClass}
                />
              </div>

              {quickAddModal === 'shift' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Start Time <span className="text-rose-500 font-bold ml-0.5">*</span>
                    </label>
                    <input
                      type="time"
                      required
                      value={quickAddForm.start_time}
                      onChange={(e) => setQuickAddForm({ ...quickAddForm, start_time: e.target.value })}
                      className={stylishInputClass}
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      End Time <span className="text-rose-500 font-bold ml-0.5">*</span>
                    </label>
                    <input
                      type="time"
                      required
                      value={quickAddForm.end_time}
                      onChange={(e) => setQuickAddForm({ ...quickAddForm, end_time: e.target.value })}
                      className={stylishInputClass}
                    />
                  </div>
                </div>
              )}

              {quickAddModal === 'branch' && (
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Branch Address / Location
                  </label>
                  <input
                    type="text"
                    value={quickAddForm.address}
                    onChange={(e) => setQuickAddForm({ ...quickAddForm, address: e.target.value })}
                    placeholder="e.g. 4th Floor, Tech Park, Madhapur"
                    className={stylishInputClass}
                  />
                </div>
              )}

              {(quickAddModal === 'department' || quickAddModal === 'designation') && (
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Description (Optional)
                  </label>
                  <input
                    type="text"
                    value={quickAddForm.description}
                    onChange={(e) => setQuickAddForm({ ...quickAddForm, description: e.target.value })}
                    placeholder="e.g. Core development and system engineering"
                    className={stylishInputClass}
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setQuickAddModal(null)}
                  disabled={quickAddLoading}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 transition-colors border-0 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={quickAddLoading || !quickAddForm.name.trim()}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md shadow-blue-600/20 transition-all border-0 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {quickAddLoading ? (
                    <>
                      <span className="animate-spin text-xs">⏳</span>
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <span>✨</span>
                      <span>Save &amp; Select</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* 🌟 CELEBRATORY EMPLOYEE REGISTRATION SUCCESS MODAL POPUP */}
      {typeof document !== 'undefined' && successModal?.isOpen && createPortal(
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-emerald-500/40 shadow-2xl max-w-lg w-full p-6 sm:p-8 text-center space-y-5 relative overflow-hidden animate-scaleUp">
            {/* Top decorative gradient glow */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-400 via-teal-500 to-indigo-500" />

            {/* Floating Celebration Badges */}
            <div className="flex justify-center items-center relative pt-2">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white flex items-center justify-center text-4xl shadow-xl shadow-emerald-500/30 ring-8 ring-emerald-50 dark:ring-emerald-950/40 animate-bounce">
                🎉
              </div>
              <span className="absolute -top-1 -right-2 text-2xl animate-spin">✨</span>
              <span className="absolute -bottom-1 -left-2 text-2xl">🌟</span>
            </div>

            {/* Personalized Salutation & Success Message */}
            <div className="space-y-2">
              <span className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-extrabold text-[11px] uppercase tracking-wider border border-emerald-300 dark:border-emerald-800 inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Registration Successful
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                Dear <span className="text-emerald-600 dark:text-emerald-400 underline decoration-wavy">{successModal.empName}</span>,
              </h2>
              <p className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 leading-relaxed">
                You are registered successfully in our HRMS ecosystem!
              </p>
            </div>

            {/* Profile Credentials Quick Summary Card */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 text-left space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Employee Code:</span>
                <span className="font-mono font-black text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-800">
                  {successModal.empCode || 'Auto-generated'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Email:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-100 truncate max-w-[220px]">
                  {successModal.email}
                </span>
              </div>
              {successModal.tempPass && (
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60 dark:border-slate-800">
                  <span className="text-amber-600 dark:text-amber-400 font-bold">Temp Password:</span>
                  <span className="font-mono font-black text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-900">
                    {successModal.tempPass}
                  </span>
                </div>
              )}
            </div>

            {/* 5-Second Countdown Timer Progress Bar */}
            <div className="space-y-1.5 pt-1">
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-200/50 dark:border-slate-700/50 shadow-inner">
                <div 
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full transition-all duration-1000 ease-linear rounded-full shadow-sm"
                  style={{ width: `${(successModal.countdown / 5) * 100}%` }}
                />
              </div>
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                <Clock className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                <span>Redirecting in <strong className="text-emerald-600 dark:text-emerald-400 font-mono text-xs">{successModal.countdown}</strong> seconds...</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSuccessModal(null);
                  router.push('/dashboard/employees');
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-lg shadow-emerald-600/25 transition-all cursor-pointer border-0 flex items-center justify-center gap-2"
              >
                <span>View Employees</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setSuccessModal(null);
                  setCurrentStep(1);
                  setEmpForm(INITIAL_EMP_FORM);
                }}
                className="py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer border-0 flex items-center justify-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Register Another</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
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
