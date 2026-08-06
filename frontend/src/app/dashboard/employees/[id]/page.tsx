'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import DashboardPageHeader from '../../components/DashboardPageHeader';
import { getHeaders, getUrl } from '../../utils/api';
import { useDashboard } from '../../components/DashboardContext';
import SearchableSelect from '../../components/SearchableSelect';
import Link from 'next/link';

interface Company {
  id: string;
  name: string;
  subdomain: string;
  status: string;
  created_at: string;
}

interface Branch {
  id: string;
  company_id: string;
  name: string;
}

interface Department {
  id: string;
  company_id: string;
  name: string;
}

interface Designation {
  id: string;
  company_id: string;
  name: string;
}

interface Role {
  id: string;
  company_id: string;
  name: string;
}

interface Shift {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
}

interface Employee {
  id: string;
  emp_id_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  personal_email?: string;
  status: string;
  joining_date: string;
  dob?: string;
  gender?: string;
  marital_status?: string;
  blood_group?: string;
  branch_id?: string;
  branch_name?: string;
  department_id?: string;
  department_name?: string;
  designation_id?: string;
  designation_name?: string;
  role_id?: string;
  role_name?: string;
  company_id?: string;
  company_name?: string;
  shift_id?: string;
  shift_name?: string;
  emp_image?: string;
  reporting_to_id?: string;
  employment_type?: string;
  probation_period_months?: number;
  confirmation_date?: string;
  pan_number?: string;
  aadhar_number?: string;
  esi_number?: string;
  uan_number?: string;
  bank_information?: {
    bank_name?: string;
    account_number?: string;
    ifsc_code?: string;
    branch?: string;
    monthly_salary?: number;
    basic_salary?: number;
    hra?: number;
    conveyance?: number;
    medical_allowance?: number;
    special_allowance?: number;
    pf_deduction?: number;
    esi_deduction?: number;
    professional_tax?: number;
    net_salary?: number;
  };
  current_address?: string;
  permanent_address?: string;
  emergency_contacts?: any;
  education?: any;
  experience?: any;
  skills?: any;
  certifications?: string;
  languages_known?: string;
}

export default function DedicatedEmployeeEditPage() {
  const router = useRouter();
  const params = useParams();
  const employeeId = params?.id as string;
  const { showToast } = useDashboard();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<'PERSONAL' | 'WORK' | 'STATUTORY' | 'BANK' | 'SALARY' | 'EMERGENCY' | 'EDUCATION' | 'EXPERIENCE' | 'SKILLS'>('PERSONAL');

  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [tenantRoles, setTenantRoles] = useState<Role[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);

  // All Structures for this employee sorted by year
  const [allEmployeeStructures, setAllEmployeeStructures] = useState<any[]>([]);
  const [selectedSalaryYear, setSelectedSalaryYear] = useState<number>(new Date().getFullYear());

  // Database Salary Engine Slabs & Component Configurations
  const [engineSlabs, setEngineSlabs] = useState<any[]>([]);
  const [engineConfigs, setEngineConfigs] = useState<any[]>([]);

  // Form State
  const [formData, setFormData] = useState({
    emp_id_code: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    personal_email: '',
    joining_date: '',
    dob: '',
    gender: 'MALE',
    marital_status: 'SINGLE',
    blood_group: 'A+',
    status: 'ACTIVE',
    branch_id: '',
    department_id: '',
    designation_id: '',
    role_id: '',
    shift_id: '',
    reporting_to_id: '',
    employment_type: 'FULL_TIME',
    probation_period_months: 6,
    companyId: '',
    emp_image: '',
    pan_number: '',
    aadhar_number: '',
    esi_number: '',
    uan_number: '',
    bank_name: '',
    account_number: '',
    ifsc_code: '',
    bank_branch: '',
    current_address: '',
    permanent_address: '',
    password: '',
    // SALARY STRUCTURE BREAKUPS
    monthly_salary: 0,
    basic_salary: 0,
    hra: 0,
    conveyance: 0,
    medical_allowance: 0,
    special_allowance: 0,
    employer_pf: 0,
    employer_esi: 0,
    gratuity: 0,
    pf_deduction: 0,
    esi_deduction: 0,
    professional_tax: 0,
    net_salary: 0,
    // STATUTORY TOGGLES, RETENTION & VARIABLE PAY
    pf_check: true,
    esi_check: true,
    pt_check: true,
    is_retention_bonus_applicable: false,
    retention_bonus: 0,
    is_variable_pay_applicable: false,
    variable_pay: 0,
    // ADDITIONAL PROFILE SECTIONS
    emergency_contacts: [
      { name: '', relationship: 'Spouse', phone: '', alt_phone: '', address: '' }
    ],
    education: [
      { degree: '', institution: '', field_of_study: '', passing_year: '', percentage: '' }
    ],
    experience: [
      { company_name: '', designation: '', start_date: '', end_date: '', responsibilities: '' }
    ],
    skills: '',
    certifications: '',
    languages_known: ''
  });

  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('superadmin');

  // Fetch Engine Slabs & Configurations from Database
  useEffect(() => {
    const fetchEngineData = async () => {
      try {
        const url = getUrl('/api/v1/payroll/sandbox-data', companyId);
        const res = await fetch(url, { headers: getHeaders() });
        if (res.ok) {
          const data = await res.json();
          const loadedSlabs = data.slabs || [];
          const loadedConfigs = data.configurations || [];
          setEngineSlabs(loadedSlabs);
          setEngineConfigs(loadedConfigs);
        }
      } catch (err) {
        console.warn('Error fetching payroll sandbox engine configs:', err);
      }
    };
    fetchEngineData();
  }, [companyId]);

  // Automated Salary Breakup Formula matching Database /dashboard/formula Engine
  const computeSalaryBreakups = (
    grossMonthly: number,
    pfCheck: boolean = formData.pf_check,
    esiCheck: boolean = formData.esi_check,
    ptCheck: boolean = formData.pt_check,
    slabsData: any[] = engineSlabs,
    configsData: any[] = engineConfigs
  ) => {
    if (!grossMonthly || isNaN(grossMonthly) || grossMonthly <= 0) {
      return {
        monthly_salary: 0,
        basic_salary: 0,
        hra: 0,
        conveyance: 0,
        medical_allowance: 0,
        special_allowance: 0,
        employer_pf: 0,
        employer_esi: 0,
        gratuity: 0,
        pf_deduction: 0,
        esi_deduction: 0,
        professional_tax: 0,
        net_salary: 0,
        pf_check: pfCheck,
        esi_check: esiCheck,
        pt_check: ptCheck,
        is_retention_bonus_applicable: formData.is_retention_bonus_applicable,
        retention_bonus: formData.retention_bonus,
        is_variable_pay_applicable: formData.is_variable_pay_applicable,
        variable_pay: formData.variable_pay
      };
    }

    const gross = Math.round(grossMonthly);

    // 1. Slab Matching from Database Configurations (same as /dashboard/formula)
    const matchedSlab = slabsData.find(
      s => s.is_active && gross >= Number(s.min_gross) && gross <= Number(s.max_gross)
    );

    let basic = 0;
    let hra = 0;
    let conveyance = 0;
    let medical = 0;
    let special = 0;

    if (matchedSlab) {
      const activeConfigs = configsData
        .filter(c => c.is_active && String(c.slab_id) === String(matchedSlab.id))
        .sort((a, b) => Number(a.display_order) - Number(b.display_order));

      const resolved: { [code: string]: number } = {};

      for (const config of activeConfigs) {
        const code = config.component_code.toUpperCase();
        if (code === 'SA') continue;

        let val = Number(config.calculation_value) || 0;
        const type = config.calculation_type_name;
        let compValue = 0;

        if (type === 'FixedAmount') {
          compValue = val;
        } else if (type === 'PercentageOfGross') {
          compValue = gross * (val / 100);
        } else if (type === 'PercentageOfComponent') {
          const parentCode = (config.depends_on_component || '').toUpperCase();
          const parentVal = resolved[parentCode] || 0;
          compValue = parentVal * (val / 100);
        }

        const minCap = Number(config.min_cap) || 0;
        const maxCap = config.max_cap ? Number(config.max_cap) : null;
        if (compValue < minCap) compValue = minCap;
        if (maxCap !== null && compValue > maxCap) compValue = maxCap;

        resolved[code] = Math.round(compValue);
      }

      basic = resolved['BASIC'] !== undefined ? resolved['BASIC'] : Math.round(gross * 0.50);
      hra = resolved['HRA'] !== undefined ? resolved['HRA'] : Math.round(basic * 0.50);
      conveyance = resolved['CA'] !== undefined ? resolved['CA'] : (resolved['CONVEYANCE'] !== undefined ? resolved['CONVEYANCE'] : (gross > 10000 ? 1600 : Math.round(gross * 0.05)));
      medical = resolved['MA'] !== undefined ? resolved['MA'] : (resolved['MEDICAL'] !== undefined ? resolved['MEDICAL'] : (gross > 10000 ? 1250 : Math.round(gross * 0.05)));

      let otherTotal = 0;
      Object.keys(resolved).forEach(k => {
        otherTotal += resolved[k];
      });

      special = gross > otherTotal ? gross - otherTotal : 0;
    } else {
      // Fallback default formula if gross does not match configured slabs
      basic = Math.round(gross * 0.50);
      hra = Math.round(basic * 0.50);
      conveyance = gross > 10000 ? 1600 : Math.round(gross * 0.05);
      medical = gross > 10000 ? 1250 : Math.round(gross * 0.05);

      const totalFixed = basic + hra + conveyance + medical;
      special = totalFixed < gross ? gross - totalFixed : 0;
    }

    // Employer Contributions
    const empPf = pfCheck ? (basic >= 15000 ? 1800 : Math.round(basic * 0.12)) : 0;
    const empEsi = (esiCheck && gross <= 21000) ? Math.round(gross * 0.0325) : 0;
    const grat = Math.round(basic * 0.0481);

    // Employee Deductions (PF capped at 1800)
    const pf = pfCheck ? (basic >= 15000 ? 1800 : Math.min(1800, Math.round(basic * 0.12))) : 0;
    const esi = (esiCheck && gross <= 21000) ? Math.round(gross * 0.0075) : 0;
    const pt = ptCheck ? (gross >= 20001 ? 200 : (gross >= 15001 ? 150 : (gross >= 10000 ? 100 : 0))) : 0;

    const totalDeductions = pf + esi + pt;
    const netSalary = gross - totalDeductions;

    return {
      monthly_salary: gross,
      basic_salary: basic,
      hra: hra,
      conveyance: conveyance,
      medical_allowance: medical,
      special_allowance: special,
      employer_pf: empPf,
      employer_esi: empEsi,
      gratuity: grat,
      pf_deduction: pf,
      esi_deduction: esi,
      professional_tax: pt,
      net_salary: netSalary,
      pf_check: pfCheck,
      esi_check: esiCheck,
      pt_check: ptCheck,
      is_retention_bonus_applicable: formData.is_retention_bonus_applicable,
      retention_bonus: formData.retention_bonus,
      is_variable_pay_applicable: formData.is_variable_pay_applicable,
      variable_pay: formData.variable_pay
    };
  };

  const handleMonthlySalaryChange = (val: string) => {
    const numericVal = Number(val) || 0;
    const breakups = computeSalaryBreakups(numericVal, formData.pf_check, formData.esi_check, formData.pt_check);
    setFormData(prev => ({
      ...prev,
      ...breakups
    }));
  };

  const handleToggleChange = (field: 'pf_check' | 'esi_check' | 'pt_check', val: boolean) => {
    const updatedForm = { ...formData, [field]: val };
    const breakups = computeSalaryBreakups(
      updatedForm.monthly_salary,
      updatedForm.pf_check,
      updatedForm.esi_check,
      updatedForm.pt_check
    );
    setFormData({
      ...updatedForm,
      ...breakups
    });
  };

  const populateStructureByYear = (targetYear: number, structures: any[]) => {
    setSelectedSalaryYear(targetYear);
    const row = structures.find(s => Number(s.salary_year) === Number(targetYear));
    if (row) {
      const savedSalary = Number(row.salary_per_month) || 0;
      setFormData(prev => ({
        ...prev,
        monthly_salary: savedSalary,
        basic_salary: Number(row.basic) || Math.round(savedSalary * 0.50),
        hra: Number(row.hra) || Math.round(savedSalary * 0.25),
        conveyance: Number(row.ca) || (savedSalary > 10000 ? 1600 : 0),
        medical_allowance: Number(row.ma) || (savedSalary > 10000 ? 1250 : 0),
        special_allowance: Number(row.sa) || 0,
        employer_pf: Number(row.employer_pf) || 0,
        employer_esi: Number(row.employer_esi) || 0,
        gratuity: Number(row.gratuity) || Math.round((Number(row.basic) || 0) * 0.0481),
        pf_deduction: Number(row.employee_pf) || 0,
        esi_deduction: Number(row.employee_esi) || 0,
        professional_tax: Number(row.professional_tax) || 0,
        net_salary: Number(row.net_salary) || 0,
        pf_check: row.pf_check !== undefined ? (Number(row.pf_check) === 1 || row.pf_check === true) : true,
        esi_check: row.esi_check !== undefined ? (Number(row.esi_check) === 1 || row.esi_check === true) : true,
        pt_check: row.pt_check !== undefined ? Boolean(row.pt_check) : true,
        is_retention_bonus_applicable: Boolean(row.is_retention_bonus_applicable),
        retention_bonus: Number(row.retention_bonus) || 0,
        is_variable_pay_applicable: Boolean(row.is_variable_pay_applicable),
        variable_pay: Number(row.variable_pay) || 0
      }));
    } else {
      // New Year structure reset to compute from current monthly_salary
      const breakups = computeSalaryBreakups(formData.monthly_salary);
      setFormData(prev => ({
        ...prev,
        ...breakups
      }));
    }
  };

  useEffect(() => {
    const storedRoles = localStorage.getItem('roles');
    const storedEmail = localStorage.getItem('email');
    const storedCompanyId = localStorage.getItem('companyId');
    if (storedRoles) setRoles(JSON.parse(storedRoles));
    if (storedEmail) setEmail(storedEmail);
    if (storedCompanyId) setCompanyId(storedCompanyId);
  }, []);

  // Fetch Employee Data & Existing Salary Structures
  useEffect(() => {
    if (!employeeId) return;
    fetchEmployeeDetails();
  }, [employeeId, companyId]);

  const fetchEmployeeDetails = async () => {
    if (!employeeId) return;
    setLoading(true);
    try {
      let targetEmp: Employee | null = null;

      try {
        const res = await fetch(getUrl(`/api/v1/employees/${employeeId}`, companyId), {
          headers: getHeaders()
        });
        if (res.ok) {
          const data = await res.json();
          if (data.employee) targetEmp = data.employee;
        }
      } catch (e) {
        console.warn('Single employee fetch warning:', e);
      }

      if (!targetEmp) {
        const resList = await fetch(getUrl('/api/v1/employees', companyId), {
          headers: getHeaders()
        });
        if (resList.ok) {
          const dataList = await resList.json();
          const list: Employee[] = dataList.employees || [];
          targetEmp = list.find(e => e.id === employeeId || e.emp_id_code === employeeId) || null;
        }
      }

      if (targetEmp) {
        const emp = targetEmp;
        const bankInfo = emp.bank_information || {};

        // Fetch existing salary structures from hrms.salary_structures
        let empStructRows: any[] = [];
        try {
          const structRes = await fetch(getUrl('/api/v1/payroll/structures', companyId), {
            headers: getHeaders()
          });
          if (structRes.ok) {
            const structData = await structRes.json();
            const structList = Array.isArray(structData) ? structData : (structData.structures || []);
            empStructRows = structList.filter((s: any) =>
              String(s.emp_id) === String(emp.emp_id_code) ||
              String(s.employee_id) === String(emp.id) ||
              String(s.emp_uuid) === String(emp.id)
            );
            // Sort by salary_year DESC so the TOP / latest structure appears first
            empStructRows.sort((a, b) => Number(b.salary_year || 0) - Number(a.salary_year || 0));
          }
        } catch (err) {
          console.warn('Error fetching salary structure from table:', err);
        }

        setAllEmployeeStructures(empStructRows);
        const topRow = empStructRows[0] || null;
        const currentYear = topRow ? Number(topRow.salary_year) : new Date().getFullYear();
        setSelectedSalaryYear(currentYear);

        const savedSalary = Number(topRow?.salary_per_month || bankInfo.monthly_salary) || 0;
        
        const salaryCalc = savedSalary > 0 ? {
          monthly_salary: savedSalary,
          basic_salary: Number(topRow?.basic || bankInfo.basic_salary) || Math.round(savedSalary * 0.50),
          hra: Number(topRow?.hra || bankInfo.hra) || Math.round(savedSalary * 0.25),
          conveyance: Number(topRow?.ca || bankInfo.conveyance) || (savedSalary > 10000 ? 1600 : 0),
          medical_allowance: Number(topRow?.ma || bankInfo.medical_allowance) || (savedSalary > 10000 ? 1250 : 0),
          special_allowance: Number(topRow?.sa || bankInfo.special_allowance) || 0,
          employer_pf: Number(topRow?.employer_pf) || 0,
          employer_esi: Number(topRow?.employer_esi) || 0,
          gratuity: Number(topRow?.gratuity) || Math.round((Number(topRow?.basic) || 0) * 0.0481),
          pf_deduction: Number(topRow?.employee_pf || bankInfo.pf_deduction) || 0,
          esi_deduction: Number(topRow?.employee_esi || bankInfo.esi_deduction) || 0,
          professional_tax: Number(topRow?.professional_tax || bankInfo.professional_tax) || 0,
          net_salary: Number(topRow?.net_salary || bankInfo.net_salary) || 0,
          pf_check: topRow?.pf_check !== undefined ? (Number(topRow.pf_check) === 1 || topRow.pf_check === true) : true,
          esi_check: topRow?.esi_check !== undefined ? (Number(topRow.esi_check) === 1 || topRow.esi_check === true) : true,
          pt_check: topRow?.pt_check !== undefined ? Boolean(topRow.pt_check) : true,
          is_retention_bonus_applicable: Boolean(topRow?.is_retention_bonus_applicable),
          retention_bonus: Number(topRow?.retention_bonus) || 0,
          is_variable_pay_applicable: Boolean(topRow?.is_variable_pay_applicable),
          variable_pay: Number(topRow?.variable_pay) || 0
        } : computeSalaryBreakups(0);

        setFormData({
          emp_id_code: emp.emp_id_code || '',
          first_name: emp.first_name || '',
          last_name: emp.last_name || '',
          email: emp.email || '',
          phone: emp.phone || '',
          personal_email: emp.personal_email || '',
          joining_date: emp.joining_date ? new Date(emp.joining_date).toISOString().split('T')[0] : '',
          dob: emp.dob ? new Date(emp.dob).toISOString().split('T')[0] : '',
          gender: emp.gender || 'MALE',
          marital_status: emp.marital_status || 'SINGLE',
          blood_group: emp.blood_group || 'A+',
          status: emp.status || 'ACTIVE',
          branch_id: emp.branch_id || '',
          department_id: emp.department_id || '',
          designation_id: emp.designation_id || '',
          role_id: emp.role_id || '',
          shift_id: emp.shift_id || '',
          reporting_to_id: emp.reporting_to_id || '',
          employment_type: emp.employment_type || 'FULL_TIME',
          probation_period_months: emp.probation_period_months || 6,
          companyId: emp.company_id || companyId || '',
          emp_image: emp.emp_image || '',
          pan_number: emp.pan_number || '',
          aadhar_number: emp.aadhar_number || '',
          esi_number: emp.esi_number || '',
          uan_number: emp.uan_number || '',
          bank_name: bankInfo.bank_name || '',
          account_number: bankInfo.account_number || '',
          ifsc_code: bankInfo.ifsc_code || '',
          bank_branch: bankInfo.branch || '',
          current_address: emp.current_address || '',
          permanent_address: emp.permanent_address || '',
          password: '',
          emergency_contacts: typeof emp.emergency_contacts === 'string' ? (emp.emergency_contacts ? JSON.parse(emp.emergency_contacts) : []) : (Array.isArray(emp.emergency_contacts) ? emp.emergency_contacts : []),
          education: typeof emp.education === 'string' ? (emp.education ? JSON.parse(emp.education) : []) : (Array.isArray(emp.education) ? emp.education : []),
          experience: typeof emp.experience === 'string' ? (emp.experience ? JSON.parse(emp.experience) : []) : (Array.isArray(emp.experience) ? emp.experience : []),
          skills: typeof emp.skills === 'string' ? emp.skills : (Array.isArray(emp.skills) ? emp.skills.join(', ') : ''),
          certifications: (emp as any).certifications || '',
          languages_known: (emp as any).languages_known || '',
          ...salaryCalc
        });
      } else {
        showToast('Employee profile not found in system', 'error');
        router.push('/dashboard/employees');
      }
    } catch (err) {
      console.error(err);
      showToast('Error loading employee profile', 'error');
    }
    setLoading(false);
  };

  // Fetch Dropdown options cascadingly
  useEffect(() => {
    const activeCompId = formData.companyId || companyId;
    if (!activeCompId && !isSuperAdmin) return;

    const fetchOptions = async () => {
      try {
        if (isSuperAdmin) {
          const cRes = await fetch('http://localhost:5000/api/v1/companies', { headers: getHeaders() });
          const cData = await cRes.json();
          if (cRes.ok) setCompanies(cData.companies || []);
        }

        const bRes = await fetch(getUrl('/api/v1/branches', activeCompId), { headers: getHeaders() });
        const bData = await bRes.json();
        if (bRes.ok) setBranches(bData.branches || []);

        const dRes = await fetch(getUrl('/api/v1/departments', activeCompId), { headers: getHeaders() });
        const dData = await dRes.json();
        if (dRes.ok) setDepartments(dData.departments || []);

        const desRes = await fetch(getUrl('/api/v1/designations', activeCompId), { headers: getHeaders() });
        const desData = await desRes.json();
        if (desRes.ok) setDesignations(desData.designations || []);

        const rRes = await fetch(getUrl('/api/v1/roles', activeCompId), { headers: getHeaders() });
        const rData = await rRes.json();
        if (rRes.ok) setTenantRoles(rData.roles || []);

        const sRes = await fetch(getUrl('/api/v1/shifts', activeCompId), { headers: getHeaders() });
        const sData = await sRes.json();
        if (sRes.ok) setShifts(sData.shifts || []);

        const empRes = await fetch(getUrl('/api/v1/employees', activeCompId), { headers: getHeaders() });
        const empData = await empRes.json();
        if (empRes.ok) setAllEmployees((empData.employees || []).filter((e: Employee) => e.id !== employeeId));
      } catch (err) {
        console.error('Error fetching dropdown options:', err);
      }
    };
    fetchOptions();
  }, [formData.companyId, companyId, isSuperAdmin, employeeId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password && formData.password.trim() !== '') {
      if (formData.password !== confirmPassword) {
        showToast('New Password and Confirm Password do not match!', 'error');
        return;
      }
    }
    setSaving(true);
    try {
      const activeComp = formData.companyId || companyId;
      const payload = {
        ...formData,
        companyId: activeComp,
        bank_information: {
          bank_name: formData.bank_name,
          account_number: formData.account_number,
          ifsc_code: formData.ifsc_code,
          branch: formData.bank_branch,
          monthly_salary: formData.monthly_salary,
          basic_salary: formData.basic_salary,
          hra: formData.hra,
          conveyance: formData.conveyance,
          medical_allowance: formData.medical_allowance,
          special_allowance: formData.special_allowance,
          pf_deduction: formData.pf_deduction,
          esi_deduction: formData.esi_deduction,
          professional_tax: formData.professional_tax,
          net_salary: formData.net_salary
        }
      };

      // 1. Update Employee Main Record
      const res = await fetch(`http://localhost:5000/api/v1/employees/${employeeId}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });

      // 2. Also Sync & Save into hrms.salary_structures Table for Selected Year
      try {
        const structPayload = {
          emp_id: formData.emp_id_code,
          employee_id: employeeId,
          emp_uuid: employeeId,
          full_name: `${formData.first_name} ${formData.last_name}`,
          salary_year: selectedSalaryYear,
          salary_per_month: formData.monthly_salary,
          salary_per_annum: (formData.monthly_salary || 0) * 12,
          basic: formData.basic_salary,
          hra: formData.hra,
          ca: formData.conveyance,
          ma: formData.medical_allowance,
          sa: formData.special_allowance,
          employee_pf: formData.pf_deduction,
          employee_esi: formData.esi_deduction,
          professional_tax: formData.professional_tax,
          employer_pf: formData.employer_pf || formData.pf_deduction,
          employer_esi: formData.employer_esi || formData.esi_deduction,
          gratuity: formData.gratuity,
          retention_bonus: formData.retention_bonus,
          is_retention_bonus_applicable: formData.is_retention_bonus_applicable,
          variable_pay: formData.variable_pay,
          is_variable_pay_applicable: formData.is_variable_pay_applicable,
          pf_check: formData.pf_check ? 1 : 0,
          esi_check: formData.esi_check ? 1 : 0,
          pt_check: formData.pt_check
        };

        await fetch(getUrl('/api/v1/payroll/structures', activeComp), {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify(structPayload)
        });
      } catch (err) {
        console.warn('Warning syncing salary_structures table:', err);
      }

      if (res.ok) {
        showToast('🎉 Employee profile & Salary Structure updated successfully!', 'success');
        // Stay on the same page and re-fetch details
        fetchEmployeeDetails();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to update employee profile', 'error');
      }
    } catch (err) {
      showToast('Error updating employee profile', 'error');
    }
    setSaving(false);
  };

  const getInitials = () => {
    return `${formData.first_name?.[0] || ''}${formData.last_name?.[0] || ''}`.toUpperCase() || 'EM';
  };

  const inputStyle = "w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 transition-all font-sans";

  // SEARCHABLE DROPDOWN OPTION LISTS
  const genderOptions = [
    { value: 'MALE', label: 'Male' },
    { value: 'FEMALE', label: 'Female' },
    { value: 'OTHER', label: 'Other' }
  ];

  const maritalStatusOptions = [
    { value: 'SINGLE', label: 'Single' },
    { value: 'MARRIED', label: 'Married' },
    { value: 'DIVORCED', label: 'Divorced' },
    { value: 'WIDOWED', label: 'Widowed' }
  ];

  const bloodGroupOptions = [
    { value: 'A+', label: 'A+' },
    { value: 'A-', label: 'A-' },
    { value: 'B+', label: 'B+' },
    { value: 'B-', label: 'B-' },
    { value: 'O+', label: 'O+' },
    { value: 'O-', label: 'O-' },
    { value: 'AB+', label: 'AB+' },
    { value: 'AB-', label: 'AB-' }
  ];

  const statusOptions = [
    { value: 'ACTIVE', label: 'ACTIVE' },
    { value: 'SUSPENDED', label: 'SUSPENDED' },
    { value: 'INACTIVE', label: 'INACTIVE' }
  ];

  const employmentTypeOptions = [
    { value: 'FULL_TIME', label: 'Full Time' },
    { value: 'PART_TIME', label: 'Part Time' },
    { value: 'CONTRACT', label: 'Contract' },
    { value: 'INTERN', label: 'Internship' }
  ];

  const companyOptions = companies.map(c => ({ value: c.id, label: c.name }));
  const branchOptions = branches.map(b => ({ value: b.id, label: b.name }));
  const departmentOptions = departments.map(d => ({ value: d.id, label: d.name }));
  const designationOptions = designations.map(des => ({ value: des.id, label: des.name }));
  const roleOptions = tenantRoles.map(r => ({ value: r.id, label: r.name }));
  const shiftOptions = shifts.map(s => ({ value: s.id, label: `${s.name} (${s.start_time} - ${s.end_time})` }));
  const managerOptions = [
    { value: '', label: 'Direct / Top Level (No Manager)' },
    ...allEmployees.map(mgr => ({
      value: mgr.id,
      label: `${mgr.emp_id_code || ''} - ${mgr.first_name} ${mgr.last_name}`
    }))
  ];

  // Financial Years Dropdown Options for Salary Structure
  const yearDropdownOptions = [
    ...Array.from(new Set([
      new Date().getFullYear(),
      new Date().getFullYear() - 1,
      ...allEmployeeStructures.map(s => Number(s.salary_year)).filter(Boolean)
    ])).sort((a, b) => b - a).map(y => ({
      value: String(y),
      label: `FY ${y}-${y + 1} ${y === new Date().getFullYear() ? '(Current Active)' : '(Historical)'}`
    }))
  ];

  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amt || 0);
  };

  const totalDeductions = (formData.pf_deduction || 0) + (formData.esi_deduction || 0) + (formData.professional_tax || 0);
  const calculatedNet = (formData.monthly_salary || 0) - totalDeductions;

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }} className="font-sans space-y-6 animate-fadeIn w-full pb-24 text-left">
      
      {/* Header Bar */}
      <DashboardPageHeader
        title="Employee Profile Management"
        actionMessage=""
        actionError=""
        companies={companies as any}
        companyId={companyId}
        handleCompanyChange={(val) => setCompanyId(val)}
        isSuperAdmin={isSuperAdmin}
        email={email}
        hideCompanySelect={true}
        hideUserBadge={true}
      >
        <Link
          href="/dashboard/employees"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer shadow-xs"
        >
          ← Back to Employee Directory
        </Link>
      </DashboardPageHeader>

      {loading ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-8 shadow-sm space-y-6 animate-pulse">
          {/* Header Card Skeleton */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-5 w-full md:w-auto">
              <div className="w-20 h-20 rounded-2xl bg-slate-200 dark:bg-slate-800 shrink-0" />
              <div className="space-y-2.5 w-48">
                <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded-lg w-full" />
                <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded-md w-3/4" />
                <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded-md w-1/2" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-28 bg-slate-200 dark:bg-slate-800 rounded-xl" />
              <div className="h-10 w-28 bg-slate-200 dark:bg-slate-800 rounded-xl" />
            </div>
          </div>

          {/* Central Spinner & Status Indicator */}
          <div className="py-8 flex flex-col items-center justify-center gap-3 text-center">
            <div className="relative flex items-center justify-center">
              <div className="w-12 h-12 rounded-full border-3 border-blue-500/20 border-t-blue-600 dark:border-t-blue-400 animate-spin" />
              <div className="absolute w-6 h-6 rounded-full bg-blue-500/10 dark:bg-blue-500/20 animate-ping" />
            </div>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 tracking-wide mt-2">
              Loading Employee Profile Data...
            </p>
            <p className="text-[11px] text-slate-400 font-medium">
              Please wait while we fetch and populate employee details
            </p>
          </div>

          {/* Tabs Skeleton */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 overflow-x-auto">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-9 w-28 bg-slate-200 dark:bg-slate-800 rounded-xl shrink-0" />
            ))}
          </div>

          {/* Form Fields Grid Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded-md w-1/3" />
                <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-xl w-full" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          
          {/* Executive Overview Header Card */}
          <div className="bg-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
              
              {/* Profile Avatar Image with Upload Overlay */}
              <div className="relative group">
                {formData.emp_image ? (
                  <img src={formData.emp_image} alt="Profile" className="w-20 h-20 rounded-2xl object-cover border-2 border-blue-500 shadow-md transition-all group-hover:opacity-80" />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white flex items-center justify-center text-xl font-black shadow-md transition-all group-hover:opacity-80">
                    {getInitials()}
                  </div>
                )}

                {/* Upload Camera Overlay Button */}
                <label className="absolute inset-0 bg-slate-950/60 rounded-2xl opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-[10px] font-bold transition-all cursor-pointer shadow-lg backdrop-blur-xs">
                  <svg className="w-5 h-5 text-white mb-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                  </svg>
                  <span>Change Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setFormData(prev => ({ ...prev, emp_image: reader.result as string }));
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>

                <span className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white dark:border-slate-900 pointer-events-none ${
                  formData.status === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`} />
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                  <h1 className="text-xl font-black text-slate-900 dark:text-slate-100">
                    {formData.first_name} {formData.last_name}
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-black bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 uppercase tracking-wider">
                    {formData.emp_id_code || 'EMP-NEW'}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-black uppercase tracking-wider ${
                    formData.status === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200'
                      : 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200'
                  }`}>
                    {formData.status}
                  </span>
                </div>
                
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                  📧 {formData.email || 'No email provided'} • 📱 {formData.phone || 'No phone'}
                </p>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  <span>🏢 Dept: <strong>{departments.find(d => d.id === formData.department_id)?.name || 'General'}</strong></span>
                  <span>•</span>
                  <span>📍 Branch: <strong>{branches.find(b => b.id === formData.branch_id)?.name || 'Main Office'}</strong></span>
                  <span>•</span>
                  <span>📅 Joined: <strong>{formData.joining_date || 'N/A'}</strong></span>
                </div>
              </div>
            </div>

            {/* Save Action Button */}
            <div className="flex items-center gap-3 w-full md:w-auto">
              <button
                type="submit"
                disabled={saving}
                className="w-full md:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2.5 disabled:opacity-75 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    <span>Save Profile Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 🌟 NEAT SEGMENTED PILL TABS BAR */}
          <div className="p-1.5 rounded-2xl bg-slate-100/80 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center gap-2 font-sans overflow-x-auto shadow-inner">
            <button
              type="button"
              onClick={() => setActiveTab('PERSONAL')}
              className={`py-2.5 px-4 rounded-xl text-xs transition-all cursor-pointer flex items-center gap-2 font-bold whitespace-nowrap ${
                activeTab === 'PERSONAL'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-md border border-blue-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/50 dark:hover:bg-slate-800/50'
              }`}
            >
              <span>👤 Personal & Contact</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('WORK')}
              className={`py-2.5 px-4 rounded-xl text-xs transition-all cursor-pointer flex items-center gap-2 font-bold whitespace-nowrap ${
                activeTab === 'WORK'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-md border border-blue-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/50 dark:hover:bg-slate-800/50'
              }`}
            >
              <span>🏢 Organization & Duty</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('STATUTORY')}
              className={`py-2.5 px-4 rounded-xl text-xs transition-all cursor-pointer flex items-center gap-2 font-bold whitespace-nowrap ${
                activeTab === 'STATUTORY'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-md border border-blue-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/50 dark:hover:bg-slate-800/50'
              }`}
            >
              <span>📜 Statutory & Identity</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('BANK')}
              className={`py-2.5 px-4 rounded-xl text-xs transition-all cursor-pointer flex items-center gap-2 font-bold whitespace-nowrap ${
                activeTab === 'BANK'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-md border border-blue-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/50 dark:hover:bg-slate-800/50'
              }`}
            >
              <span>🏦 Bank Account & Payout</span>
            </button>

            {/* 💵 TAB: SALARY BREAKUPS */}
            <button
              type="button"
              onClick={() => setActiveTab('SALARY')}
              className={`py-2.5 px-4 rounded-xl text-xs transition-all cursor-pointer flex items-center gap-2 font-bold whitespace-nowrap ${
                activeTab === 'SALARY'
                  ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-md border border-emerald-500/30 ring-2 ring-emerald-500/10'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/50 dark:hover:bg-slate-800/50'
              }`}
            >
              <span>💵 Salary Breakups & CTC</span>
            </button>

            {/* 🚨 TAB: EMERGENCY CONTACTS */}
            <button
              type="button"
              onClick={() => setActiveTab('EMERGENCY')}
              className={`py-2.5 px-4 rounded-xl text-xs transition-all cursor-pointer flex items-center gap-2 font-bold whitespace-nowrap ${
                activeTab === 'EMERGENCY'
                  ? 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-md border border-rose-500/30'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/50 dark:hover:bg-slate-800/50'
              }`}
            >
              <span>🚨 Emergency Contacts</span>
            </button>

            {/* 🎓 TAB: EDUCATION & QUALIFICATIONS */}
            <button
              type="button"
              onClick={() => setActiveTab('EDUCATION')}
              className={`py-2.5 px-4 rounded-xl text-xs transition-all cursor-pointer flex items-center gap-2 font-bold whitespace-nowrap ${
                activeTab === 'EDUCATION'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-md border border-indigo-500/30'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/50 dark:hover:bg-slate-800/50'
              }`}
            >
              <span>🎓 Education</span>
            </button>

            {/* 💼 TAB: WORK EXPERIENCE */}
            <button
              type="button"
              onClick={() => setActiveTab('EXPERIENCE')}
              className={`py-2.5 px-4 rounded-xl text-xs transition-all cursor-pointer flex items-center gap-2 font-bold whitespace-nowrap ${
                activeTab === 'EXPERIENCE'
                  ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-md border border-amber-500/30'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/50 dark:hover:bg-slate-800/50'
              }`}
            >
              <span>💼 Experience</span>
            </button>

            {/* ⚡ TAB: SKILLS & CERTIFICATIONS */}
            <button
              type="button"
              onClick={() => setActiveTab('SKILLS')}
              className={`py-2.5 px-4 rounded-xl text-xs transition-all cursor-pointer flex items-center gap-2 font-bold whitespace-nowrap ${
                activeTab === 'SKILLS'
                  ? 'bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-md border border-purple-500/30'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/50 dark:hover:bg-slate-800/50'
              }`}
            >
              <span>⚡ Skills & Expertise</span>
            </button>
          </div>

          {/* TAB 1: PERSONAL INFORMATION */}
          {activeTab === 'PERSONAL' && (
            <div className="bg-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-6 font-sans">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-3">
                Personal Profile & Contact Details
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3.5 rounded-xl border border-blue-500/40 dark:border-blue-500/40 bg-blue-50/10 dark:bg-blue-950/10 shadow-sm space-y-1.5">
                  <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                    Employee ID Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.emp_id_code}
                    onChange={e => setFormData({ ...formData, emp_id_code: e.target.value })}
                    className={inputStyle}
                  />
                </div>

                <div className="p-3.5 rounded-xl border border-blue-500/40 dark:border-blue-500/40 bg-blue-50/10 dark:bg-blue-950/10 shadow-sm space-y-1.5">
                  <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                    First Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                    className={inputStyle}
                  />
                </div>

                <div className="p-3.5 rounded-xl border border-blue-500/40 dark:border-blue-500/40 bg-blue-50/10 dark:bg-blue-950/10 shadow-sm space-y-1.5">
                  <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                    Last Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                    className={inputStyle}
                  />
                </div>

                <div className="p-3.5 rounded-xl border border-blue-500/40 dark:border-blue-500/40 bg-blue-50/10 dark:bg-blue-950/10 shadow-sm space-y-1.5">
                  <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                    Official Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className={inputStyle}
                  />
                </div>

                <div className="p-3.5 rounded-xl border border-blue-500/40 dark:border-blue-500/40 bg-blue-50/10 dark:bg-blue-950/10 shadow-sm space-y-1.5">
                  <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className={inputStyle}
                  />
                </div>

                <div className="p-3.5 rounded-xl border border-blue-500/40 dark:border-blue-500/40 bg-blue-50/10 dark:bg-blue-950/10 shadow-sm space-y-1.5">
                  <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                    Personal Email
                  </label>
                  <input
                    type="email"
                    value={formData.personal_email}
                    onChange={e => setFormData({ ...formData, personal_email: e.target.value })}
                    className={inputStyle}
                  />
                </div>

                <div className="p-3.5 rounded-xl border border-blue-500/40 dark:border-blue-500/40 bg-blue-50/10 dark:bg-blue-950/10 shadow-sm space-y-1.5">
                  <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                    Joining Date
                  </label>
                  <input
                    type="date"
                    value={formData.joining_date}
                    onChange={e => setFormData({ ...formData, joining_date: e.target.value })}
                    className={inputStyle}
                  />
                </div>

                <div className="p-3.5 rounded-xl border border-blue-500/40 dark:border-blue-500/40 bg-blue-50/10 dark:bg-blue-950/10 shadow-sm space-y-1.5">
                  <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={formData.dob}
                    onChange={e => setFormData({ ...formData, dob: e.target.value })}
                    className={inputStyle}
                  />
                </div>

                <div className="p-3.5 rounded-xl border border-blue-500/40 dark:border-blue-500/40 bg-blue-50/10 dark:bg-blue-950/10 shadow-sm space-y-1.5">
                  <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                    Employment Status
                  </label>
                  <SearchableSelect
                    options={statusOptions}
                    value={formData.status}
                    onChange={val => setFormData({ ...formData, status: val })}
                    placeholder="Search status..."
                  />
                </div>

                <div className="p-3.5 rounded-xl border border-blue-500/40 dark:border-blue-500/40 bg-blue-50/10 dark:bg-blue-950/10 shadow-sm space-y-1.5">
                  <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                    Gender
                  </label>
                  <SearchableSelect
                    options={genderOptions}
                    value={formData.gender}
                    onChange={val => setFormData({ ...formData, gender: val })}
                    placeholder="Search gender..."
                  />
                </div>

                <div className="p-3.5 rounded-xl border border-blue-500/40 dark:border-blue-500/40 bg-blue-50/10 dark:bg-blue-950/10 shadow-sm space-y-1.5">
                  <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                    Marital Status
                  </label>
                  <SearchableSelect
                    options={maritalStatusOptions}
                    value={formData.marital_status}
                    onChange={val => setFormData({ ...formData, marital_status: val })}
                    placeholder="Search marital status..."
                  />
                </div>

                <div className="p-3.5 rounded-xl border border-blue-500/40 dark:border-blue-500/40 bg-blue-50/10 dark:bg-blue-950/10 shadow-sm space-y-1.5">
                  <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                    Blood Group
                  </label>
                  <SearchableSelect
                    options={bloodGroupOptions}
                    value={formData.blood_group}
                    onChange={val => setFormData({ ...formData, blood_group: val })}
                    placeholder="Search blood group..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-3.5 rounded-xl border border-blue-500/40 dark:border-blue-500/40 bg-blue-50/10 dark:bg-blue-950/10 shadow-sm space-y-1.5">
                  <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                    Current Address
                  </label>
                  <textarea
                    rows={3}
                    value={formData.current_address}
                    onChange={e => setFormData({ ...formData, current_address: e.target.value })}
                    className={inputStyle}
                    placeholder="Enter current residential address..."
                  />
                </div>

                <div className="p-3.5 rounded-xl border border-blue-500/40 dark:border-blue-500/40 bg-blue-50/10 dark:bg-blue-950/10 shadow-sm space-y-1.5">
                  <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                    Permanent Address
                  </label>
                  <textarea
                    rows={3}
                    value={formData.permanent_address}
                    onChange={e => setFormData({ ...formData, permanent_address: e.target.value })}
                    className={inputStyle}
                    placeholder="Enter permanent address..."
                  />
                </div>
              </div>

              {/* 🔐 SECURITY CREDENTIALS & PASSWORD RESET CARD */}
              <div className="p-4 rounded-xl border-2 border-indigo-500/40 dark:border-indigo-500/40 bg-gradient-to-r from-indigo-50/40 via-purple-50/20 to-blue-50/40 dark:from-indigo-950/20 dark:via-purple-950/20 dark:to-blue-950/20 shadow-sm space-y-3 mt-4">
                <div className="flex items-center justify-between border-b border-indigo-100 dark:border-indigo-900/40 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">🔐</span>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-indigo-950 dark:text-indigo-200 font-outfit">
                        Account Password Reset & Login Credentials
                      </h4>
                      <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mt-0.5">
                        Leave blank to keep existing password intact. Type a new password here to reset Keycloak authentication credentials for this employee.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div className="space-y-1.5">
                    <label className="block text-[9.5px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                      New Password
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                        className={`${inputStyle} pr-10`}
                        placeholder="Type new password to reset..."
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors text-xs font-extrabold cursor-pointer"
                        title={showPassword ? 'Hide Password' : 'Show Password'}
                      >
                        {showPassword ? '👁️ Hide' : '🙈 Show'}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[9.5px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                      Confirm Password
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        className={`${inputStyle} pr-10 ${
                          confirmPassword && formData.password !== confirmPassword ? 'border-red-500 focus:ring-red-500' : ''
                        }`}
                        placeholder="Confirm new password..."
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors text-xs font-extrabold cursor-pointer"
                        title={showConfirmPassword ? 'Hide Password' : 'Show Password'}
                      >
                        {showConfirmPassword ? '👁️ Hide' : '🙈 Show'}
                      </button>
                    </div>
                    {confirmPassword && formData.password !== confirmPassword && (
                      <p className="text-[10px] font-bold text-red-500">Passwords do not match</p>
                    )}
                  </div>
                </div>

                <div className="pt-1">
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold bg-white/60 dark:bg-slate-900/60 p-2.5 rounded-lg border border-indigo-100 dark:border-indigo-900/30">
                    🔑 <strong>Note:</strong> Password updates will take effect immediately in Keycloak authentication upon clicking <strong>"Save Profile Changes"</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ORGANIZATION & WORK */}
          {activeTab === 'WORK' && (
            <div className="bg-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-6 font-sans">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-3">
                Organization Hierarchy & Duty Schedule
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {isSuperAdmin && (
                  <div className="p-3.5 rounded-xl border border-blue-500/40 dark:border-blue-500/40 bg-blue-50/10 dark:bg-blue-950/10 shadow-sm space-y-1.5">
                    <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                      Company
                    </label>
                    <SearchableSelect
                      options={companyOptions}
                      value={formData.companyId}
                      onChange={val => setFormData({ ...formData, companyId: val })}
                      placeholder="Search company..."
                    />
                  </div>
                )}

                <div className="p-3.5 rounded-xl border border-blue-500/40 dark:border-blue-500/40 bg-blue-50/10 dark:bg-blue-950/10 shadow-sm space-y-1.5">
                  <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                    Branch Office
                  </label>
                  <SearchableSelect
                    options={branchOptions}
                    value={formData.branch_id}
                    onChange={val => setFormData({ ...formData, branch_id: val })}
                    placeholder="Search branch..."
                  />
                </div>

                <div className="p-3.5 rounded-xl border border-blue-500/40 dark:border-blue-500/40 bg-blue-50/10 dark:bg-blue-950/10 shadow-sm space-y-1.5">
                  <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                    Department
                  </label>
                  <SearchableSelect
                    options={departmentOptions}
                    value={formData.department_id}
                    onChange={val => setFormData({ ...formData, department_id: val })}
                    placeholder="Search department..."
                  />
                </div>

                <div className="p-3.5 rounded-xl border border-blue-500/40 dark:border-blue-500/40 bg-blue-50/10 dark:bg-blue-950/10 shadow-sm space-y-1.5">
                  <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                    Designation / Title
                  </label>
                  <SearchableSelect
                    options={designationOptions}
                    value={formData.designation_id}
                    onChange={val => setFormData({ ...formData, designation_id: val })}
                    placeholder="Search designation..."
                  />
                </div>

                <div className="p-3.5 rounded-xl border border-blue-500/40 dark:border-blue-500/40 bg-blue-50/10 dark:bg-blue-950/10 shadow-sm space-y-1.5">
                  <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                    Access Role
                  </label>
                  <SearchableSelect
                    options={roleOptions}
                    value={formData.role_id}
                    onChange={val => setFormData({ ...formData, role_id: val })}
                    placeholder="Search role..."
                  />
                </div>

                <div className="p-3.5 rounded-xl border border-blue-500/40 dark:border-blue-500/40 bg-blue-50/10 dark:bg-blue-950/10 shadow-sm space-y-1.5">
                  <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                    Reporting Manager
                  </label>
                  <SearchableSelect
                    options={managerOptions}
                    value={formData.reporting_to_id}
                    onChange={val => setFormData({ ...formData, reporting_to_id: val })}
                    placeholder="Search manager..."
                  />
                </div>

                <div className="p-3.5 rounded-xl border border-blue-500/40 dark:border-blue-500/40 bg-blue-50/10 dark:bg-blue-950/10 shadow-sm space-y-1.5">
                  <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                    Work Shift Schedule
                  </label>
                  <SearchableSelect
                    options={shiftOptions}
                    value={formData.shift_id}
                    onChange={val => setFormData({ ...formData, shift_id: val })}
                    placeholder="Search shift..."
                  />
                </div>

                <div className="p-3.5 rounded-xl border border-blue-500/40 dark:border-blue-500/40 bg-blue-50/10 dark:bg-blue-950/10 shadow-sm space-y-1.5">
                  <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                    Employment Type
                  </label>
                  <SearchableSelect
                    options={employmentTypeOptions}
                    value={formData.employment_type}
                    onChange={val => setFormData({ ...formData, employment_type: val })}
                    placeholder="Search employment type..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: STATUTORY & IDENTITY */}
          {activeTab === 'STATUTORY' && (
            <div className="bg-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-6 font-sans">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-3">
                Government Identity & Compliance Documents
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl border border-blue-500/40 dark:border-blue-500/40 bg-blue-50/10 dark:bg-blue-950/10 shadow-sm space-y-1.5">
                  <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                    PAN Card Number
                  </label>
                  <input
                    type="text"
                    value={formData.pan_number}
                    onChange={e => setFormData({ ...formData, pan_number: e.target.value.toUpperCase() })}
                    placeholder="ABCDE1234F"
                    className={inputStyle}
                  />
                </div>

                <div className="p-3.5 rounded-xl border border-blue-500/40 dark:border-blue-500/40 bg-blue-50/10 dark:bg-blue-950/10 shadow-sm space-y-1.5">
                  <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                    Aadhar Card Number
                  </label>
                  <input
                    type="text"
                    value={formData.aadhar_number}
                    onChange={e => setFormData({ ...formData, aadhar_number: e.target.value })}
                    placeholder="1234 5678 9012"
                    className={inputStyle}
                  />
                </div>

                <div className="p-3.5 rounded-xl border border-blue-500/40 dark:border-blue-500/40 bg-blue-50/10 dark:bg-blue-950/10 shadow-sm space-y-1.5">
                  <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                    UAN (Provident Fund) Number
                  </label>
                  <input
                    type="text"
                    value={formData.uan_number}
                    onChange={e => setFormData({ ...formData, uan_number: e.target.value })}
                    placeholder="100123456789"
                    className={inputStyle}
                  />
                </div>

                <div className="p-3.5 rounded-xl border border-blue-500/40 dark:border-blue-500/40 bg-blue-50/10 dark:bg-blue-950/10 shadow-sm space-y-1.5">
                  <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                    ESI Insurance Number
                  </label>
                  <input
                    type="text"
                    value={formData.esi_number}
                    onChange={e => setFormData({ ...formData, esi_number: e.target.value })}
                    placeholder="310012345678"
                    className={inputStyle}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: BANK ACCOUNT */}
          {activeTab === 'BANK' && (
            <div className="bg-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-6 font-sans">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-3">
                Bank Account & Salary Disbursement Details
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl border border-blue-500/40 dark:border-blue-500/40 bg-blue-50/10 dark:bg-blue-950/10 shadow-sm space-y-1.5">
                  <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    value={formData.bank_name}
                    onChange={e => setFormData({ ...formData, bank_name: e.target.value })}
                    placeholder="e.g. HDFC Bank, SBI, ICICI"
                    className={inputStyle}
                  />
                </div>

                <div className="p-3.5 rounded-xl border border-blue-500/40 dark:border-blue-500/40 bg-blue-50/10 dark:bg-blue-950/10 shadow-sm space-y-1.5">
                  <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                    Account Number
                  </label>
                  <input
                    type="text"
                    value={formData.account_number}
                    onChange={e => setFormData({ ...formData, account_number: e.target.value })}
                    placeholder="Enter bank account number..."
                    className={inputStyle}
                  />
                </div>

                <div className="p-3.5 rounded-xl border border-blue-500/40 dark:border-blue-500/40 bg-blue-50/10 dark:bg-blue-950/10 shadow-sm space-y-1.5">
                  <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                    IFSC Code
                  </label>
                  <input
                    type="text"
                    value={formData.ifsc_code}
                    onChange={e => setFormData({ ...formData, ifsc_code: e.target.value.toUpperCase() })}
                    placeholder="HDFC0001234"
                    className={inputStyle}
                  />
                </div>

                <div className="p-3.5 rounded-xl border border-blue-500/40 dark:border-blue-500/40 bg-blue-50/10 dark:bg-blue-950/10 shadow-sm space-y-1.5">
                  <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                    Bank Branch Name
                  </label>
                  <input
                    type="text"
                    value={formData.bank_branch}
                    onChange={e => setFormData({ ...formData, bank_branch: e.target.value })}
                    placeholder="e.g. Jubilee Hills, Hyderabad"
                    className={inputStyle}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 💵 TAB 5: SALARY BREAKUPS & CTC (MULTI-YEAR STRUCTURE SELECTION & FULL COMPONENTS) */}
          {activeTab === 'SALARY' && (
            <div className="bg-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-6 font-sans animate-fadeIn">
              
              {/* Header Box & Financial Year Selection Dropdown */}
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>💵 Salary Structure & Auto Breakups</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                    Select financial year to view or update structure. Latest year displays on top by default.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                  {/* Financial Structure Year Selector Dropdown */}
                  <div className="w-56">
                    <SearchableSelect
                      options={yearDropdownOptions}
                      value={String(selectedSalaryYear)}
                      onChange={val => populateStructureByYear(Number(val), allEmployeeStructures)}
                      placeholder="Select Year Structure..."
                    />
                  </div>

                  {/* Annual Projection Badge */}
                  <div className="px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-black">
                    Annual CTC: <span className="font-mono text-sm ml-1">{formatCurrency((formData.monthly_salary || 0) * 12)} / year</span>
                  </div>
                </div>
              </div>

              {/* 🎯 MAIN MONTHLY SALARY AUTO-CALCULATOR INPUT - COMPACT EXECUTIVE HERO BOX */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-purple-600/10 border border-blue-500/30 shadow-xs">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <label className="block text-xs font-black text-blue-700 dark:text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                      TOTAL BASE MONTHLY GROSS CTC (FY {selectedSalaryYear}-{selectedSalaryYear + 1})
                    </label>
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5 block">
                      Type base monthly gross to auto-calculate all breakdown components below
                    </span>
                  </div>

                  {/* Compact Integrated Input Box */}
                  <div className="flex items-center w-full md:w-80 shadow-sm rounded-xl overflow-hidden border-2 border-blue-500/80 bg-white dark:bg-slate-900 focus-within:ring-4 focus-within:ring-blue-500/20 transition-all">
                    <div className="px-3.5 py-2.5 bg-blue-600 text-white font-black text-base select-none flex items-center justify-center">
                      ₹
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="500"
                      placeholder="e.g. 50000"
                      value={formData.monthly_salary || ''}
                      onChange={e => handleMonthlySalaryChange(e.target.value)}
                      className="w-full px-3 py-2 text-base font-black text-slate-900 dark:text-slate-100 bg-transparent outline-none font-mono"
                    />
                    <div className="px-3 py-2 text-[11px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800/80 border-l border-slate-200 dark:border-slate-700 select-none whitespace-nowrap">
                      / Month
                    </div>
                  </div>
                </div>
              </div>

              {/* 🛡️ STATUTORY DEDUCTION TOGGLES & RETENTION / VARIABLE PAY CONTROLS */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 pb-2">
                  ⚙️ Statutory Deductions Eligibility & Retention / Variable Pay Controls
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* PF Check Toggle */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">PF Deduction</span>
                      <span className="text-[10px] font-semibold text-slate-400">{formData.pf_check ? 'Enabled (12%)' : 'Exempted'}</span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={formData.pf_check}
                      onClick={() => handleToggleChange('pf_check', !formData.pf_check)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        formData.pf_check ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          formData.pf_check ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* ESI Check Toggle */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">ESI Deduction</span>
                      <span className="text-[10px] font-semibold text-slate-400">{formData.esi_check ? 'Enabled (0.75%)' : 'Exempted'}</span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={formData.esi_check}
                      onClick={() => handleToggleChange('esi_check', !formData.esi_check)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        formData.esi_check ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          formData.esi_check ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* PT Check Toggle */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Professional Tax (PT)</span>
                      <span className="text-[10px] font-semibold text-slate-400">{formData.pt_check ? 'Enabled (₹200)' : 'Exempted'}</span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={formData.pt_check}
                      onClick={() => handleToggleChange('pt_check', !formData.pt_check)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        formData.pt_check ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          formData.pt_check ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Retention Bonus Toggle */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Retention Bonus</span>
                      <span className="text-[10px] font-semibold text-slate-400">{formData.is_retention_bonus_applicable ? 'Applicable' : 'Not Applicable'}</span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={formData.is_retention_bonus_applicable}
                      onClick={() => setFormData({ ...formData, is_retention_bonus_applicable: !formData.is_retention_bonus_applicable })}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        formData.is_retention_bonus_applicable ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          formData.is_retention_bonus_applicable ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Variable Pay Toggle */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Variable Pay</span>
                      <span className="text-[10px] font-semibold text-slate-400">{formData.is_variable_pay_applicable ? 'Applicable' : 'Not Applicable'}</span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={formData.is_variable_pay_applicable}
                      onClick={() => setFormData({ ...formData, is_variable_pay_applicable: !formData.is_variable_pay_applicable })}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        formData.is_variable_pay_applicable ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          formData.is_variable_pay_applicable ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Retention Bonus & Variable Pay Value Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  {formData.is_retention_bonus_applicable && (
                    <div className="p-3.5 rounded-xl border border-indigo-500/40 bg-indigo-50/20 dark:bg-indigo-950/20 space-y-1.5">
                      <label className="block text-[10px] font-black text-indigo-700 dark:text-indigo-300 uppercase tracking-widest">
                        🎁 Retention Bonus Amount (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.retention_bonus}
                        onChange={e => setFormData({ ...formData, retention_bonus: Number(e.target.value) || 0 })}
                        className={inputStyle}
                        placeholder="Enter retention bonus amount..."
                      />
                    </div>
                  )}

                  {formData.is_variable_pay_applicable && (
                    <div className="p-3.5 rounded-xl border border-purple-500/40 bg-purple-50/20 dark:bg-purple-950/20 space-y-1.5">
                      <label className="block text-[10px] font-black text-purple-700 dark:text-purple-300 uppercase tracking-widest">
                        📊 Variable Pay / Performance Bonus (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.variable_pay}
                        onChange={e => setFormData({ ...formData, variable_pay: Number(e.target.value) || 0 })}
                        className={inputStyle}
                        placeholder="Enter variable pay amount..."
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* THREE COLUMN BREAKDOWN CARDS: EARNINGS, EMPLOYER CONTRIBUTIONS & STATUTORY DEDUCTIONS */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
                
                {/* 🟢 COLUMN 1: EARNINGS BREAKDOWN */}
                <div className="p-5 rounded-2xl border border-emerald-500/30 bg-emerald-50/10 dark:bg-emerald-950/10 shadow-xs flex flex-col justify-between gap-4">
                  <div>
                    <div className="flex items-center justify-between border-b border-emerald-200 dark:border-emerald-800/60 pb-2.5 mb-3">
                      <h4 className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        1. Monthly Gross Earnings
                      </h4>
                      <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">
                        {formatCurrency(formData.monthly_salary || 0)}
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-300 transition-colors">
                        <div>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Basic Pay</span>
                          <span className="text-[10px] font-semibold text-slate-400">50% of Monthly Gross</span>
                        </div>
                        <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500/30">
                          <div className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 font-black text-slate-400 text-xs select-none">
                            ₹
                          </div>
                          <input
                            type="number"
                            value={formData.basic_salary || 0}
                            onChange={e => setFormData({ ...formData, basic_salary: Number(e.target.value) || 0 })}
                            className="w-24 px-2 py-1.5 text-right font-mono text-xs font-extrabold text-slate-800 dark:text-slate-200 bg-transparent outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-300 transition-colors">
                        <div>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">HRA</span>
                          <span className="text-[10px] font-semibold text-slate-400">50% of Basic Pay</span>
                        </div>
                        <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500/30">
                          <div className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 font-black text-slate-400 text-xs select-none">
                            ₹
                          </div>
                          <input
                            type="number"
                            value={formData.hra || 0}
                            onChange={e => setFormData({ ...formData, hra: Number(e.target.value) || 0 })}
                            className="w-24 px-2 py-1.5 text-right font-mono text-xs font-extrabold text-slate-800 dark:text-slate-200 bg-transparent outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-300 transition-colors">
                        <div>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Conveyance (CA)</span>
                          <span className="text-[10px] font-semibold text-slate-400">Fixed Allowance</span>
                        </div>
                        <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500/30">
                          <div className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 font-black text-slate-400 text-xs select-none">
                            ₹
                          </div>
                          <input
                            type="number"
                            value={formData.conveyance || 0}
                            onChange={e => setFormData({ ...formData, conveyance: Number(e.target.value) || 0 })}
                            className="w-24 px-2 py-1.5 text-right font-mono text-xs font-extrabold text-slate-800 dark:text-slate-200 bg-transparent outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-300 transition-colors">
                        <div>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Medical Allowance</span>
                          <span className="text-[10px] font-semibold text-slate-400">Fixed Component</span>
                        </div>
                        <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500/30">
                          <div className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 font-black text-slate-400 text-xs select-none">
                            ₹
                          </div>
                          <input
                            type="number"
                            value={formData.medical_allowance || 0}
                            onChange={e => setFormData({ ...formData, medical_allowance: Number(e.target.value) || 0 })}
                            className="w-24 px-2 py-1.5 text-right font-mono text-xs font-extrabold text-slate-800 dark:text-slate-200 bg-transparent outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-300 transition-colors">
                        <div>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Special Allowance</span>
                          <span className="text-[10px] font-semibold text-slate-400">Flexi Balance</span>
                        </div>
                        <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500/30">
                          <div className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 font-black text-slate-400 text-xs select-none">
                            ₹
                          </div>
                          <input
                            type="number"
                            value={formData.special_allowance || 0}
                            onChange={e => setFormData({ ...formData, special_allowance: Number(e.target.value) || 0 })}
                            className="w-24 px-2 py-1.5 text-right font-mono text-xs font-extrabold text-slate-800 dark:text-slate-200 bg-transparent outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800/40 flex items-center justify-between text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    <span>Total Gross Salary:</span>
                    <span className="font-mono text-sm font-black">{formatCurrency(formData.monthly_salary || 0)}</span>
                  </div>
                </div>

                {/* 🔷 COLUMN 2: EMPLOYER STATUTORY & RETIREMENT BENEFITS */}
                <div className="p-5 rounded-2xl border border-blue-500/30 bg-blue-50/10 dark:bg-blue-950/10 shadow-xs flex flex-col justify-between gap-4">
                  <div>
                    <div className="flex items-center justify-between border-b border-blue-200 dark:border-blue-800/60 pb-2.5 mb-3">
                      <h4 className="text-xs font-black text-blue-700 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-blue-500" />
                        2. Employer Benefits
                      </h4>
                      <span className="text-xs font-black text-blue-600 dark:text-blue-400 font-mono">
                        {formatCurrency((formData.employer_pf || 0) + (formData.employer_esi || 0) + (formData.gratuity || 0))}
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-300 transition-colors">
                        <div>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Employer PF</span>
                          <span className="text-[10px] font-semibold text-slate-400">12% of Basic Pay</span>
                        </div>
                        <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/30">
                          <div className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 font-black text-slate-400 text-xs select-none">
                            ₹
                          </div>
                          <input
                            type="number"
                            value={formData.employer_pf || 0}
                            onChange={e => setFormData({ ...formData, employer_pf: Number(e.target.value) || 0 })}
                            className="w-24 px-2 py-1.5 text-right font-mono text-xs font-extrabold text-blue-600 dark:text-blue-400 bg-transparent outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-300 transition-colors">
                        <div>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Employer ESI</span>
                          <span className="text-[10px] font-semibold text-slate-400">3.25% of Gross</span>
                        </div>
                        <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/30">
                          <div className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 font-black text-slate-400 text-xs select-none">
                            ₹
                          </div>
                          <input
                            type="number"
                            value={formData.employer_esi || 0}
                            onChange={e => setFormData({ ...formData, employer_esi: Number(e.target.value) || 0 })}
                            className="w-24 px-2 py-1.5 text-right font-mono text-xs font-extrabold text-blue-600 dark:text-blue-400 bg-transparent outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-300 transition-colors">
                        <div>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Gratuity Provision</span>
                          <span className="text-[10px] font-semibold text-slate-400">~4.81% of Basic Pay</span>
                        </div>
                        <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/30">
                          <div className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 font-black text-slate-400 text-xs select-none">
                            ₹
                          </div>
                          <input
                            type="number"
                            value={formData.gratuity || 0}
                            onChange={e => setFormData({ ...formData, gratuity: Number(e.target.value) || 0 })}
                            className="w-24 px-2 py-1.5 text-right font-mono text-xs font-extrabold text-blue-600 dark:text-blue-400 bg-transparent outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-blue-200 dark:border-blue-800/40 flex items-center justify-between text-xs font-bold text-blue-800 dark:text-blue-300">
                    <span>Total Employer Contribution:</span>
                    <span className="font-mono text-sm font-black">{formatCurrency((formData.employer_pf || 0) + (formData.employer_esi || 0) + (formData.gratuity || 0))}</span>
                  </div>
                </div>

                {/* 🔴 COLUMN 3: EMPLOYEE DEDUCTIONS */}
                <div className="p-5 rounded-2xl border border-rose-500/30 bg-rose-50/10 dark:bg-rose-950/10 shadow-xs flex flex-col justify-between gap-4">
                  <div>
                    <div className="flex items-center justify-between border-b border-rose-200 dark:border-rose-800/60 pb-2.5 mb-3">
                      <h4 className="text-xs font-black text-rose-700 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-rose-500" />
                        3. Statutory Deductions
                      </h4>
                      <span className="text-xs font-black text-rose-600 dark:text-rose-400 font-mono">
                        -{formatCurrency(totalDeductions)}
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-rose-300 transition-colors">
                        <div>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Employee PF</span>
                          <span className="text-[10px] font-semibold text-slate-400">12% Capped ₹1,800</span>
                        </div>
                        <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 overflow-hidden focus-within:ring-2 focus-within:ring-rose-500/30">
                          <div className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 font-black text-slate-400 text-xs select-none">
                            ₹
                          </div>
                          <input
                            type="number"
                            value={formData.pf_deduction || 0}
                            onChange={e => setFormData({ ...formData, pf_deduction: Number(e.target.value) || 0 })}
                            className="w-24 px-2 py-1.5 text-right font-mono text-xs font-extrabold text-rose-600 dark:text-rose-400 bg-transparent outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-rose-300 transition-colors">
                        <div>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Employee ESI</span>
                          <span className="text-[10px] font-semibold text-slate-400">0.75% of Gross</span>
                        </div>
                        <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 overflow-hidden focus-within:ring-2 focus-within:ring-rose-500/30">
                          <div className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 font-black text-slate-400 text-xs select-none">
                            ₹
                          </div>
                          <input
                            type="number"
                            value={formData.esi_deduction || 0}
                            onChange={e => setFormData({ ...formData, esi_deduction: Number(e.target.value) || 0 })}
                            className="w-24 px-2 py-1.5 text-right font-mono text-xs font-extrabold text-rose-600 dark:text-rose-400 bg-transparent outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-rose-300 transition-colors">
                        <div>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Professional Tax (PT)</span>
                          <span className="text-[10px] font-semibold text-slate-400">State Tax</span>
                        </div>
                        <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 overflow-hidden focus-within:ring-2 focus-within:ring-rose-500/30">
                          <div className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 font-black text-slate-400 text-xs select-none">
                            ₹
                          </div>
                          <input
                            type="number"
                            value={formData.professional_tax || 0}
                            onChange={e => setFormData({ ...formData, professional_tax: Number(e.target.value) || 0 })}
                            className="w-24 px-2 py-1.5 text-right font-mono text-xs font-extrabold text-rose-600 dark:text-rose-400 bg-transparent outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-rose-200 dark:border-rose-800/40 flex items-center justify-between text-xs font-bold text-rose-800 dark:text-rose-300">
                    <span>Total Deductions:</span>
                    <span className="font-mono text-sm font-black">-{formatCurrency(totalDeductions)}</span>
                  </div>
                </div>

              </div>

              {/* 🏆 FULL-WIDTH HERO TAKE-HOME & TOTAL CTC BANNER AT THE BOTTOM */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-lg border border-emerald-500/30 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-white/20 backdrop-blur-md text-white">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5h16.5m-16.5 3.75h16.5m-16.5 3.75h16.5m-16.5 3.75h16.5" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-xs font-black uppercase tracking-widest text-emerald-100 block">
                      ESTIMATED NET TAKE-HOME SALARY
                    </span>
                    <div className="text-2xl font-black font-mono mt-0.5">
                      {formatCurrency(calculatedNet)} <span className="text-xs font-bold text-emerald-100">/ month</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-6 border-t md:border-t-0 md:border-l border-white/20 pt-3 md:pt-0 md:pl-6">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-100 block">
                      Annual Net Take-Home
                    </span>
                    <span className="font-mono text-base font-black text-white">
                      {formatCurrency(calculatedNet * 12)} <span className="text-[10px]">/ yr</span>
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-100 block">
                      Total Monthly Employer CTC
                    </span>
                    <span className="font-mono text-base font-black text-white">
                      {formatCurrency((formData.monthly_salary || 0) + (formData.employer_pf || 0) + (formData.employer_esi || 0) + (formData.gratuity || 0))} <span className="text-[10px]">/ mo</span>
                    </span>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 6: EMERGENCY CONTACTS */}
          {activeTab === 'EMERGENCY' && (
            <div className="bg-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-6 font-sans">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Emergency Contacts Information
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    const updated = [...(formData.emergency_contacts || [])];
                    updated.push({ name: '', relationship: 'Spouse', phone: '', alt_phone: '', address: '' });
                    setFormData({ ...formData, emergency_contacts: updated });
                  }}
                  className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40 text-xs font-bold hover:bg-rose-100 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span>+ Add Emergency Contact</span>
                </button>
              </div>

              {(formData.emergency_contacts || []).map((contact: any, index: number) => (
                <div key={index} className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-2">
                      🚨 Contact #{index + 1}
                    </span>
                    {(formData.emergency_contacts || []).length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const updated = (formData.emergency_contacts || []).filter((_: any, i: number) => i !== index);
                          setFormData({ ...formData, emergency_contacts: updated });
                        }}
                        className="text-xs font-bold text-rose-500 hover:text-rose-700 cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                        Contact Person Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Ramesh Kumar"
                        value={contact.name || ''}
                        onChange={e => {
                          const updated = [...(formData.emergency_contacts || [])];
                          updated[index] = { ...updated[index], name: e.target.value };
                          setFormData({ ...formData, emergency_contacts: updated });
                        }}
                        className={inputStyle}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                        Relationship
                      </label>
                      <select
                        value={contact.relationship || 'Spouse'}
                        onChange={e => {
                          const updated = [...(formData.emergency_contacts || [])];
                          updated[index] = { ...updated[index], relationship: e.target.value };
                          setFormData({ ...formData, emergency_contacts: updated });
                        }}
                        className={inputStyle}
                      >
                        <option value="Spouse">Spouse</option>
                        <option value="Father">Father</option>
                        <option value="Mother">Mother</option>
                        <option value="Brother">Brother</option>
                        <option value="Sister">Sister</option>
                        <option value="Friend">Friend</option>
                        <option value="Guardian">Guardian</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                        Primary Phone Number
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. +91 9876543210"
                        value={contact.phone || ''}
                        onChange={e => {
                          const updated = [...(formData.emergency_contacts || [])];
                          updated[index] = { ...updated[index], phone: e.target.value };
                          setFormData({ ...formData, emergency_contacts: updated });
                        }}
                        className={inputStyle}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                        Alternate Phone
                      </label>
                      <input
                        type="text"
                        placeholder="Optional alternate phone"
                        value={contact.alt_phone || ''}
                        onChange={e => {
                          const updated = [...(formData.emergency_contacts || [])];
                          updated[index] = { ...updated[index], alt_phone: e.target.value };
                          setFormData({ ...formData, emergency_contacts: updated });
                        }}
                        className={inputStyle}
                      />
                    </div>

                    <div className="md:col-span-2 space-y-1.5">
                      <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                        Contact Address / City
                      </label>
                      <input
                        type="text"
                        placeholder="Residential address of emergency contact"
                        value={contact.address || ''}
                        onChange={e => {
                          const updated = [...(formData.emergency_contacts || [])];
                          updated[index] = { ...updated[index], address: e.target.value };
                          setFormData({ ...formData, emergency_contacts: updated });
                        }}
                        className={inputStyle}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 7: EDUCATION & QUALIFICATIONS */}
          {activeTab === 'EDUCATION' && (
            <div className="bg-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-6 font-sans">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Academic & Professional Qualifications
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    const updated = [...(formData.education || [])];
                    updated.push({ degree: '', institution: '', field_of_study: '', passing_year: '', percentage: '' });
                    setFormData({ ...formData, education: updated });
                  }}
                  className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-900/40 text-xs font-bold hover:bg-indigo-100 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span>+ Add Qualification</span>
                </button>
              </div>

              {(formData.education || []).map((edu: any, index: number) => (
                <div key={index} className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                      🎓 Qualification #{index + 1}
                    </span>
                    {(formData.education || []).length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const updated = (formData.education || []).filter((_: any, i: number) => i !== index);
                          setFormData({ ...formData, education: updated });
                        }}
                        className="text-xs font-bold text-rose-500 hover:text-rose-700 cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                        Degree / Certificate Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. B.Tech / MBA / B.Sc / Class XII"
                        value={edu.degree || ''}
                        onChange={e => {
                          const updated = [...(formData.education || [])];
                          updated[index] = { ...updated[index], degree: e.target.value };
                          setFormData({ ...formData, education: updated });
                        }}
                        className={inputStyle}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                        Field of Study / Specialization
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Computer Science / HR / Finance"
                        value={edu.field_of_study || ''}
                        onChange={e => {
                          const updated = [...(formData.education || [])];
                          updated[index] = { ...updated[index], field_of_study: e.target.value };
                          setFormData({ ...formData, education: updated });
                        }}
                        className={inputStyle}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                        College / Institution / University
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. JNTU Hyderabad / Osmania University"
                        value={edu.institution || ''}
                        onChange={e => {
                          const updated = [...(formData.education || [])];
                          updated[index] = { ...updated[index], institution: e.target.value };
                          setFormData({ ...formData, education: updated });
                        }}
                        className={inputStyle}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                        Year of Passing
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 2022"
                        value={edu.passing_year || ''}
                        onChange={e => {
                          const updated = [...(formData.education || [])];
                          updated[index] = { ...updated[index], passing_year: e.target.value };
                          setFormData({ ...formData, education: updated });
                        }}
                        className={inputStyle}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                        Percentage / CGPA
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 82.5% or 8.5 CGPA"
                        value={edu.percentage || ''}
                        onChange={e => {
                          const updated = [...(formData.education || [])];
                          updated[index] = { ...updated[index], percentage: e.target.value };
                          setFormData({ ...formData, education: updated });
                        }}
                        className={inputStyle}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 8: WORK EXPERIENCE */}
          {activeTab === 'EXPERIENCE' && (
            <div className="bg-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-6 font-sans">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Prior Work Experience History
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    const updated = [...(formData.experience || [])];
                    updated.push({ company_name: '', designation: '', start_date: '', end_date: '', responsibilities: '' });
                    setFormData({ ...formData, experience: updated });
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/40 text-xs font-bold hover:bg-amber-100 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span>+ Add Experience</span>
                </button>
              </div>

              {(formData.experience || []).map((exp: any, index: number) => (
                <div key={index} className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-2">
                      💼 Experience #{index + 1}
                    </span>
                    {(formData.experience || []).length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const updated = (formData.experience || []).filter((_: any, i: number) => i !== index);
                          setFormData({ ...formData, experience: updated });
                        }}
                        className="text-xs font-bold text-rose-500 hover:text-rose-700 cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                        Previous Company Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Infosys Ltd"
                        value={exp.company_name || ''}
                        onChange={e => {
                          const updated = [...(formData.experience || [])];
                          updated[index] = { ...updated[index], company_name: e.target.value };
                          setFormData({ ...formData, experience: updated });
                        }}
                        className={inputStyle}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                        Designation / Role Held
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Senior Software Engineer"
                        value={exp.designation || ''}
                        onChange={e => {
                          const updated = [...(formData.experience || [])];
                          updated[index] = { ...updated[index], designation: e.target.value };
                          setFormData({ ...formData, experience: updated });
                        }}
                        className={inputStyle}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={exp.start_date ? exp.start_date.split('T')[0] : ''}
                        onChange={e => {
                          const updated = [...(formData.experience || [])];
                          updated[index] = { ...updated[index], start_date: e.target.value };
                          setFormData({ ...formData, experience: updated });
                        }}
                        className={inputStyle}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                        End Date / Relieving Date
                      </label>
                      <input
                        type="date"
                        value={exp.end_date ? exp.end_date.split('T')[0] : ''}
                        onChange={e => {
                          const updated = [...(formData.experience || [])];
                          updated[index] = { ...updated[index], end_date: e.target.value };
                          setFormData({ ...formData, experience: updated });
                        }}
                        className={inputStyle}
                      />
                    </div>

                    <div className="md:col-span-2 space-y-1.5">
                      <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                        Key Responsibilities / Achievements
                      </label>
                      <input
                        type="text"
                        placeholder="Brief summary of duties and responsibilities"
                        value={exp.responsibilities || ''}
                        onChange={e => {
                          const updated = [...(formData.experience || [])];
                          updated[index] = { ...updated[index], responsibilities: e.target.value };
                          setFormData({ ...formData, experience: updated });
                        }}
                        className={inputStyle}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 9: SKILLS & CERTIFICATIONS */}
          {activeTab === 'SKILLS' && (
            <div className="bg-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-6 font-sans">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-3">
                Professional Skills, Certifications & Languages
              </h3>

              <div className="space-y-5">
                <div className="p-4 rounded-xl border border-purple-500/30 dark:border-purple-500/30 bg-purple-50/10 dark:bg-purple-950/10 space-y-2">
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                    ⚡ Core & Technical Skills (Comma-separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. JavaScript, React, Node.js, PostgreSQL, Project Management, HR Analytics"
                    value={formData.skills || ''}
                    onChange={e => setFormData({ ...formData, skills: e.target.value })}
                    className={inputStyle}
                  />
                  <p className="text-[10.5px] text-slate-400 font-medium">
                    Separate each skill with a comma to store and manage them cleanly.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
                    <label className="block text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                      📜 Professional Certifications
                    </label>
                    <textarea
                      rows={3}
                      placeholder="e.g. AWS Certified Solutions Architect, PMP Certification, Scrum Master (2023)"
                      value={formData.certifications || ''}
                      onChange={e => setFormData({ ...formData, certifications: e.target.value })}
                      className={`${inputStyle} resize-none`}
                    />
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
                    <label className="block text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                      🗣️ Languages Known
                    </label>
                    <textarea
                      rows={3}
                      placeholder="e.g. English (Fluent), Telugu (Native), Hindi (Professional)"
                      value={formData.languages_known || ''}
                      onChange={e => setFormData({ ...formData, languages_known: e.target.value })}
                      className={`${inputStyle} resize-none`}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer Save Action Bar */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <Link
              href="/dashboard/employees"
              className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-xs"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={saving}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-2.5 disabled:opacity-75 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <span>Save Profile Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
