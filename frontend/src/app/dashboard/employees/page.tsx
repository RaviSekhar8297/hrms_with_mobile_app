'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardPageHeader from '../components/DashboardPageHeader';
import { getHeaders, getUrl } from '../utils/api';
import SlideDrawer from '../components/SlideDrawer';
import { useDashboard } from '../components/DashboardContext';
import SearchableSelect from '../components/SearchableSelect';
import { usePermissions } from '../hooks/usePermissions';
import ModernPagination from '../components/ModernPagination';

interface Company {
  id: string;
  name: string;
  company_code?: string;
  subdomain: string;
  status: string;
  created_at: string;
}

interface Branch {
  id: string;
  company_id: string;
  name: string;
  address: string;
  status: string;
  created_at: string;
}

interface Department {
  id: string;
  company_id: string;
  branch_id: string;
  branch_name?: string;
  name: string;
  description: string;
  status: string;
}

interface Designation {
  id: string;
  company_id: string;
  branch_id: string;
  branch_name?: string;
  department_id: string;
  department_name?: string;
  name: string;
  description: string;
  status: string;
}

interface Permission {
  id: string;
  name: string;
  description: string;
  module: string;
}

interface Role {
  id: string;
  company_id: string;
  name: string;
  description: string;
  permissions: Permission[];
}

interface Shift {
  id: string;
  company_id: string;
  name: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

interface Employee {
  id: string;
  emp_id_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  status: string;
  joining_date: string;
  branch_id?: string;
  branch_name?: string;
  department_id?: string;
  department_name?: string;
  designation_id?: string;
  designation_name?: string;
  role_id?: string;
  role_name?: string;
  company_id?: string;
  shift_id?: string;
  shift_name?: string;
  emp_image?: string;
  reporting_to_id?: string;
  allow_mobile_punch?: boolean;
  require_punch_approval?: boolean;
}

export default function EmployeesPage() {
  const { showToast, companyId: globalCompanyId, setCompanyId: setGlobalCompanyId } = useDashboard();
  const { hasPermission } = usePermissions();
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);

  // Selected company ID directly bound to global DashboardContext
  const selectedCompanyId = globalCompanyId;

  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [tenantRoles, setTenantRoles] = useState<Role[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  
  // Interactive deletion toast state
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null);

  // ⏱️ Auto-dismiss deletion toast after 5 seconds
  useEffect(() => {
    if (!deletingEmployee) return;
    const timer = setTimeout(() => {
      setDeletingEmployee(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [deletingEmployee]);

  // Bulk Upload state
  const [bulkDrawerOpen, setBulkDrawerOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResults, setBulkResults] = useState<{ row: number; emp_id_code: string; status: string; keycloak_status?: string; message: string }[] | null>(null);

  // View toggle state (Table vs. Cards)
  const [viewType, setViewType] = useState<'table' | 'card'>('card');

  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [branchFilter, setBranchFilter] = useState('ALL');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, branchFilter, pageSize]);

  // Sorting states
  const [sortField, setSortField] = useState<string>('emp_id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Custom Searchable Dropdown States
  const [activeSearchDropdownId, setActiveSearchDropdownId] = useState<string | null>(null);
  const [dropdownSearchQuery, setDropdownSearchQuery] = useState('');

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleUpdateStatus = async (emp: Employee, newStatus: string) => {
    try {
      const res = await fetch(getUrl(`/api/v1/employees/${emp.id}`), {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          ...emp,
          companyId: emp.company_id,
          status: newStatus
        })
      });
      if (res.ok) {
        showToast(`Employee status updated to ${newStatus}`, 'success');
        fetchEmployees();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to update status', 'error');
      }
    } catch (err) {
      showToast('Error updating status', 'error');
    }
  };

  const handleUpdateReportingTo = async (emp: Employee, newReportingToId: string) => {
    try {
      const res = await fetch(getUrl(`/api/v1/employees/${emp.id}`), {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          ...emp,
          companyId: emp.company_id,
          reporting_to_id: newReportingToId || null
        })
      });
      if (res.ok) {
        showToast('Reporting Manager updated successfully', 'success');
        fetchEmployees();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to update reporting manager', 'error');
      }
    } catch (err) {
      showToast('Error updating reporting manager', 'error');
    }
  };

  const handleQuickStatusChange = async (emp: Employee, newStatus: string) => {
    const targetCompanyId = isSuperAdmin ? (emp.company_id || selectedCompanyId) : selectedCompanyId;
    try {
      const payload = {
        ...emp,
        status: newStatus,
        companyId: targetCompanyId
      };
      const res = await fetch(getUrl(`/api/v1/employees/${emp.id}`), {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Employee status updated to ${newStatus}`, 'success');
        fetchEmployees();
      } else {
        showToast(data.error || 'Failed to update status', 'error');
      }
    } catch (err) {
      showToast('Error updating employee status', 'error');
    }
  };

  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('superadmin');

  // Form State
  const [empForm, setEmpForm] = useState({
    emp_id_code: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    status: 'ACTIVE',
    joining_date: '',
    branch_id: '',
    department_id: '',
    designation_id: '',
    role_id: '',
    companyId: '',
    shift_id: '',
    reporting_to_id: '',
    emp_image: '',
    password: '',
    allow_mobile_punch: true,
    require_punch_approval: false
  });

  const activeCompIdForCheck = empForm.companyId || selectedCompanyId;
  const fullInputCode = (empForm.emp_id_code || '').trim();

  const duplicateEmp = React.useMemo(() => {
    if (!fullInputCode || editMode) return null;
    const cleanInput = fullInputCode.toLowerCase();

    return employees.find(emp => {
      const sameCompany = !activeCompIdForCheck || activeCompIdForCheck === 'all' || emp.company_id === activeCompIdForCheck;
      if (!sameCompany) return false;

      const empCode = (emp.emp_id_code || '').toLowerCase();
      if (!empCode) return false;

      const rawCode = empCode.replace(/^[a-z0-9]+-/i, '');
      const rawInput = cleanInput.replace(/^[a-z0-9]+-/i, '');

      return (
        empCode === cleanInput ||
        rawCode === rawInput ||
        empCode.endsWith(`-${rawInput}`) ||
        cleanInput.endsWith(`-${empCode}`)
      );
    });
  }, [fullInputCode, employees, activeCompIdForCheck, editMode]);

  const [isRotational, setIsRotational] = useState(false);
  const [daysInterval, setDaysInterval] = useState(7);
  const [rotationShifts, setRotationShifts] = useState<string[]>([]);
  const [selectedShiftForSeq, setSelectedShiftForSeq] = useState('');
  const [rotationEndDate, setRotationEndDate] = useState('');

  useEffect(() => {
    const storedRoles = localStorage.getItem('roles');
    const storedEmail = localStorage.getItem('email');
    const storedCompanyId = localStorage.getItem('companyId');
    if (storedRoles) setRoles(JSON.parse(storedRoles));
    if (storedEmail) setEmail(storedEmail);
    if (storedCompanyId) {
      setGlobalCompanyId(storedCompanyId);
    }
  }, []);

  const fetchCompanies = async () => {
    try {
      const res = await fetch(getUrl('/api/v1/companies'), { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) setCompanies(data.companies || []);
    } catch (e) { console.error(e); }
  };

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const cid = selectedCompanyId;
      const res = await fetch(getUrl('/api/v1/employees', cid && cid !== 'all' ? cid : null), { 
        headers: getHeaders(),
        cache: 'no-store'
      });
      const data = await res.json();
      if (res.ok) setEmployees(data.employees || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => {
    if (isSuperAdmin) {
      fetchCompanies();
    }
    fetchEmployees();
  }, [selectedCompanyId, isSuperAdmin]);

  // Fetch contextual branches, departments, designations, and roles cascadingly
  useEffect(() => {
    const activeId = isSuperAdmin
      ? (drawerOpen ? (empForm.companyId || selectedCompanyId) : selectedCompanyId)
      : selectedCompanyId;
    if (!activeId && !isSuperAdmin) return;
    setBranchFilter('ALL');

    const fetchDropdownOptions = async () => {
      try {
        const targetId = activeId && activeId !== 'all' ? activeId : null;
        const resB = await fetch(getUrl('/api/v1/branches', targetId), { headers: getHeaders() });
        const dataB = await resB.json();
        if (resB.ok) setBranches(dataB.branches || []);

        const resD = await fetch(getUrl('/api/v1/departments', targetId), { headers: getHeaders() });
        const dataD = await resD.json();
        if (resD.ok) setDepartments(dataD.departments || []);

        const resDe = await fetch(getUrl('/api/v1/designations', targetId), { headers: getHeaders() });
        const dataDe = await resDe.json();
        if (resDe.ok) setDesignations(dataDe.designations || []);

        const resR = await fetch(getUrl('/api/v1/roles', targetId), { headers: getHeaders() });
        const dataR = await resR.json();
        if (resR.ok) setTenantRoles(dataR.roles || []);

        const resS = await fetch(getUrl('/api/v1/shifts', targetId), { headers: getHeaders() });
        const dataS = await resS.json();
        if (resS.ok) setShifts(dataS.shifts || []);
      } catch (err) {
        console.error('Error fetching dropdown options:', err);
      }
    };
    fetchDropdownOptions();
  }, [selectedCompanyId, drawerOpen, empForm.companyId, isSuperAdmin]);

  const openAddDrawer = () => {
    setEditMode(false);
    setSelectedEmployeeId(null);
    setEmpForm({
      emp_id_code: '',
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      branch_id: '',
      department_id: '',
      designation_id: '',
      role_id: '',
      shift_id: '',
      joining_date: '',
      status: 'ACTIVE',
      companyId: selectedCompanyId || '',
      emp_image: '',
      reporting_to_id: '',
      password: '',
      allow_mobile_punch: true,
      require_punch_approval: true
    });
    setIsRotational(false);
    setDaysInterval(7);
    setRotationShifts([]);
    setSelectedShiftForSeq('');
    setRotationEndDate('');
    setDrawerOpen(true);
  };

  const router = useRouter();

  const openEditDrawer = (emp: Employee) => {
    router.push(`/dashboard/employees/${emp.id}`);
  };

  const handleShiftChange = (val: string) => {
    setEmpForm(prev => ({ ...prev, shift_id: val }));
    const selectedShift = shifts.find(s => String(s.id) === String(val));
    if (selectedShift) {
      const nameLower = selectedShift.name.toLowerCase();
      const isRot = nameLower.includes('rotational') || nameLower.includes('rotation');
      if (isRot) {
        setIsRotational(true);
        setRotationShifts([val]);
      } else {
        setIsRotational(false);
        setRotationShifts([]);
      }
    }
  };

  const getRotationalPreview = () => {
    if (!empForm.joining_date || !daysInterval || daysInterval <= 0 || rotationShifts.length === 0) {
      return [];
    }
    const start = new Date(empForm.joining_date);
    const end = rotationEndDate ? new Date(rotationEndDate) : new Date(start.getTime() + 365 * 24 * 60 * 60 * 1000);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      return [];
    }

    const previewList: any[] = [];
    let currentDate = new Date(start);
    let shiftIndex = 0;
    
    for (let i = 0; i < 2; i++) {
      if (currentDate > end) break;
      const currentShiftId = rotationShifts[shiftIndex];
      const shiftDetail = shifts.find(s => String(s.id) === String(currentShiftId));
      if (!shiftDetail) break;

      const blockStart = new Date(currentDate);
      const blockEnd = new Date(currentDate);
      blockEnd.setDate(blockEnd.getDate() + daysInterval - 1);
      const finalBlockEnd = blockEnd > end ? end : blockEnd;

      previewList.push({
        shiftName: shiftDetail.name,
        startTime: shiftDetail.start_time,
        endTime: shiftDetail.end_time,
        startStr: blockStart.toLocaleDateString(undefined, {month:'short', day:'numeric'}),
        endStr: finalBlockEnd.toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'}),
      });

      currentDate.setDate(currentDate.getDate() + daysInterval);
      shiftIndex = (shiftIndex + 1) % rotationShifts.length;
    }
    return previewList;
  };

  const getMinRotationDate = () => {
    if (!empForm.joining_date) return '';
    return empForm.joining_date;
  };

  const getMaxRotationDate = () => {
    if (!empForm.joining_date) return '';
    const date = new Date(empForm.joining_date);
    date.setFullYear(date.getFullYear() + 2);
    return date.toISOString().split('T')[0];
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast('Image file size must be less than 5MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const img = new Image();
      img.src = base64;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 600;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          const format = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          const resizedBase64 = canvas.toDataURL(format, 0.85);
          setEmpForm(prev => ({ ...prev, emp_image: resizedBase64 }));
        } else {
          setEmpForm(prev => ({ ...prev, emp_image: base64 }));
        }
      };
    };
    reader.readAsDataURL(file);
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const targetCompanyId = isSuperAdmin ? (empForm.companyId || selectedCompanyId) : selectedCompanyId;
    if (!targetCompanyId) {
      showToast('Please select a company context first.', 'error');
      return;
    }

    if (!empForm.emp_id_code || !empForm.first_name || !empForm.last_name || !empForm.email || !empForm.joining_date || !empForm.shift_id) {
      showToast('Please fill in all required fields (including Shift).', 'error');
      return;
    }

    if (!editMode && duplicateEmp) {
      showToast(`❌ This ID is already assigned to ${duplicateEmp.first_name} ${duplicateEmp.last_name} (${duplicateEmp.emp_id_code})`, 'error');
      return;
    }

    const endpoint = editMode
      ? getUrl(`/api/v1/employees/${selectedEmployeeId}`)
      : getUrl('/api/v1/employees');
    const method = editMode ? 'PUT' : 'POST';

    try {
      const payload = {
        ...empForm,
        email: empForm.email.replace(/\s+/g, ''),
        companyId: targetCompanyId
      };
      const res = await fetch(endpoint, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        let msg = editMode ? 'Employee profile updated successfully!' : 'Employee profile registered successfully!';
        if (!editMode && data.keycloakCreated) {
          msg += ` Keycloak user registered. Temp Password: ${data.keycloakTempPassword}`;
        } else if (!editMode && !data.keycloakCreated && data.keycloakError) {
          msg += ` Warning: Keycloak account skipped/failed: ${data.keycloakError}`;
        }

        if (isRotational && rotationShifts.length > 0) {
          const empId = editMode ? selectedEmployeeId : data.employee.id;
          const endD = rotationEndDate || new Date(new Date(empForm.joining_date).getTime() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          try {
            const rotRes = await fetch(getUrl('/api/v1/employee-shifts/rotate'), {
              method: 'POST',
              headers: getHeaders(),
              body: JSON.stringify({
                companyId: targetCompanyId,
                employee_ids: [empId],
                shift_ids: rotationShifts,
                days_interval: daysInterval,
                start_date: empForm.joining_date,
                end_date: endD
              })
            });
            if (!rotRes.ok) {
              const rotData = await rotRes.json();
              msg += ` (Note: Shift rotation scheduling failed: ${rotData.error || 'Unknown error'})`;
            } else {
              msg += ` Shift rotation scheduled successfully!`;
            }
          } catch (rotErr) {
            console.error('Error scheduling rotation:', rotErr);
            msg += ` (Note: Connection error scheduling shift rotation)`;
          }
        }

        showToast(msg, 'success');
        setDrawerOpen(false);
        fetchEmployees();
      } else {
        showToast(data.error || 'Failed to save employee profile', 'error');
      }
    } catch (err) { 
      showToast('Connection error saving employee profile', 'error');
    }
  };

  const executeDeleteEmployee = async (id: string) => {
    try {
      const res = await fetch(getUrl(`/api/v1/employees/${id}`), {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Employee profile successfully removed', 'success', 5000);
        fetchEmployees();
      } else {
        showToast(data.error || 'Failed to delete employee profile', 'error', 5000);
      }
    } catch (err) {
      showToast('Error deleting employee profile', 'error', 5000);
    }
  };

  const handleCompanyChange = (id: string) => {
    const val = (id === 'all' || !id) ? null : id;
    setGlobalCompanyId(val);
    setEmpForm(prev => ({ ...prev, companyId: val || '', branch_id: '', department_id: '', designation_id: '', role_id: '' }));
    setBranchFilter('ALL');
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

  // Helper variables for cascade filtering in SlideDrawer & Header Filters
  const activeCompanyId = isSuperAdmin 
    ? (drawerOpen ? (empForm.companyId || selectedCompanyId) : selectedCompanyId) 
    : selectedCompanyId;
  const filteredBranches = (activeCompanyId && activeCompanyId !== 'all') 
    ? branches.filter(b => b.company_id === activeCompanyId) 
    : branches;
  const filteredDepartments = empForm.branch_id 
    ? departments.filter(d => d.branch_id === empForm.branch_id) 
    : ((activeCompanyId && activeCompanyId !== 'all') ? departments.filter(d => d.company_id === activeCompanyId) : departments);
  const filteredDesignations = empForm.department_id 
    ? designations.filter(ds => ds.department_id === empForm.department_id) 
    : ((activeCompanyId && activeCompanyId !== 'all') ? designations.filter(ds => ds.company_id === activeCompanyId) : designations);
  const filteredRoles = (activeCompanyId && activeCompanyId !== 'all') ? tenantRoles.filter(r => r.company_id === activeCompanyId) : tenantRoles;
  const filteredShifts = (activeCompanyId && activeCompanyId !== 'all') ? shifts.filter(s => s.company_id === activeCompanyId) : shifts;

  // Search & Filter computation
  const filteredEmployees = employees.filter(emp => {
    const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
    const matchesSearch = 
      fullName.includes(searchQuery.toLowerCase()) ||
      emp.emp_id_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (emp.designation_name && emp.designation_name.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = statusFilter === 'ALL' 
      ? true 
      : (statusFilter === 'INACTIVE' 
          ? (emp.status === 'INACTIVE' || emp.status === 'TERMINATED' || emp.status === 'EXITED' || emp.status === 'RESIGNED')
          : emp.status === statusFilter);
    const matchesBranch = branchFilter === 'ALL' || emp.branch_id === branchFilter;
    return matchesSearch && matchesStatus && matchesBranch;
  });

  // Sorting computation
  const sortedEmployees = [...filteredEmployees].sort((a, b) => {
    let fieldA: any = '';
    let fieldB: any = '';

    if (sortField === 'emp_id') {
      const numA = parseInt((a.emp_id_code || '').replace(/\D/g, ''), 10);
      const numB = parseInt((b.emp_id_code || '').replace(/\D/g, ''), 10);
      if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
        return sortOrder === 'asc' ? numA - numB : numB - numA;
      }
      fieldA = (a.emp_id_code || '').toLowerCase();
      fieldB = (b.emp_id_code || '').toLowerCase();
    } else if (sortField === 'name') {
      fieldA = `${a.first_name} ${a.last_name}`.toLowerCase();
      fieldB = `${b.first_name} ${b.last_name}`.toLowerCase();
    } else if (sortField === 'manager') {
      const managerA = employees.find(e => e.id === a.reporting_to_id);
      const managerB = employees.find(e => e.id === b.reporting_to_id);
      fieldA = managerA ? `${managerA.first_name} ${managerA.last_name}`.toLowerCase() : '';
      fieldB = managerB ? `${managerB.first_name} ${managerB.last_name}`.toLowerCase() : '';
    } else if (sortField === 'office') {
      fieldA = (a.branch_name || '').toLowerCase();
      fieldB = (b.branch_name || '').toLowerCase();
    } else if (sortField === 'position') {
      fieldA = (a.designation_name || '').toLowerCase();
      fieldB = (b.designation_name || '').toLowerCase();
    } else if (sortField === 'team') {
      fieldA = (a.department_name || '').toLowerCase();
      fieldB = (b.department_name || '').toLowerCase();
    } else if (sortField === 'status') {
      fieldA = (a.status || 'ACTIVE').toLowerCase();
      fieldB = (b.status || 'ACTIVE').toLowerCase();
    }

    if (fieldA < fieldB) return sortOrder === 'asc' ? -1 : 1;
    if (fieldA > fieldB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // Pagination calculation
  const totalItems = sortedEmployees.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedEmployees = sortedEmployees.slice(startIndex, endIndex);

  // Calculate statistics metrics
  const totalEmployeesCount = employees.length;
  const activeEmployeesCount = employees.filter(e => e.status === 'ACTIVE' || !e.status).length;
  const suspendedEmployeesCount = employees.filter(e => e.status === 'SUSPENDED').length;

  const getTempPasswordPreview = () => {
    const fName = empForm.first_name || '';
    const cleanFirstName = fName.charAt(0).toUpperCase() + fName.slice(1).toLowerCase().replace(/[^a-zA-Z]/g, '');
    let year = '2026';
    if (empForm.joining_date) {
      year = new Date(empForm.joining_date).getFullYear().toString();
    }
    return `${cleanFirstName || 'Welcome'}@${year}`;
  };

  const inputStyle = "w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40 px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 focus:bg-card focus:ring-4 focus:ring-blue-500/10 transition-all duration-200 placeholder-slate-400";

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }} className="font-dmsans space-y-6 animate-fadeIn w-full relative">
      
      {/* Header Panel */}
      <div className="w-full">
        <DashboardPageHeader
          title="Employee Directory"
          actionMessage=""
          actionError=""
          companies={companies}
          companyId={selectedCompanyId}
          handleCompanyChange={handleCompanyChange}
          isSuperAdmin={isSuperAdmin}
          email={email}
          hideUserBadge={true}
        >
          {hasPermission('create_employees') && (
            <div className="flex items-center gap-2">
              {/* Bulk Upload Button - Navigates to Onboarding Hub in Bulk Mode */}
              <Link
                href="/dashboard/employees/create?mode=bulk"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 hover:shadow-lg hover:shadow-emerald-600/25 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer group flex-shrink-0"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white/20 group-hover:bg-white/30 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                </span>
                <span className="tracking-wide">Bulk Upload</span>
              </Link>
              {/* Add Employee Button */}
              <Link
                href="/dashboard/employees/create"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-blue-600/20 hover:shadow-lg hover:shadow-blue-600/25 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer group flex-shrink-0"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white/20 group-hover:bg-white/30 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </span>
                <span className="tracking-wide">Add Employee</span>
              </Link>
            </div>
          )}
        </DashboardPageHeader>
      </div>

      {/* Executive Summary Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        
        {/* Card 1: Total Employees & Active Count */}
        <div className="group relative rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-4.5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer overflow-hidden">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Total Employees
              </p>
              <div className="flex items-center gap-2.5 mt-1.5">
                <h2 className="text-3xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight font-mono">
                  {filteredEmployees.length}
                </h2>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/70 inline-flex items-center gap-1 shadow-2xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {filteredEmployees.filter(e => e.status === 'ACTIVE' || !e.status || e.status === 'active').length} Active
                  </span>
                </div>
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/60 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Card 2: Total Branches */}
        <div className="group relative rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-4.5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer overflow-hidden">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-teal-600 dark:text-teal-400">
                Total Branches
              </p>
              <div className="flex items-baseline gap-2 mt-1.5">
                <h2 className="text-3xl font-black text-teal-600 dark:text-teal-400 tracking-tight font-mono">
                  {branches.length || new Set(filteredEmployees.map(e => e.branch_name).filter(Boolean)).size || 1}
                </h2>
                <span className="text-[10px] font-extrabold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 px-2.5 py-0.5 rounded-full border border-teal-200 dark:border-teal-800/60">
                  Offices
                </span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-900/60 text-teal-600 dark:text-teal-300 border border-teal-100 dark:border-teal-800/60 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m-6-13.5h3m-3 3h3m-3 3h3m3-6h3m-3 3h3m-3 3h3M6.75 21v-3a1.5 1.5 0 011.5-1.5h3a1.5 1.5 0 011.5 1.5v3" />
              </svg>
            </div>
          </div>
        </div>

        {/* Card 3: Total Departments */}
        <div className="group relative rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-4.5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer overflow-hidden">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Total Departments
              </p>
              <div className="flex items-baseline gap-2 mt-1.5">
                <h2 className="text-3xl font-black text-amber-600 dark:text-amber-400 tracking-tight font-mono">
                  {departments.length || new Set(filteredEmployees.map(e => e.department_name).filter(Boolean)).size || 1}
                </h2>
                <span className="text-[10px] font-extrabold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/60">
                  Depts
                </span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-900/60 text-amber-600 dark:text-amber-300 border border-amber-100 dark:border-amber-800/60 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6h1.5m-1.5 3h1.5m-1.5 3h1.5" />
              </svg>
            </div>
          </div>
        </div>

        {/* Card 4: Total Designations */}
        <div className="group relative rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-4.5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer overflow-hidden">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">
                Total Designations
              </p>
              <div className="flex items-baseline gap-2 mt-1.5">
                <h2 className="text-3xl font-black text-rose-600 dark:text-rose-400 tracking-tight font-mono">
                  {designations.length || new Set(filteredEmployees.map(e => e.designation_name).filter(Boolean)).size || 1}
                </h2>
                <span className="text-[10px] font-extrabold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 px-2.5 py-0.5 rounded-full border border-rose-200 dark:border-rose-800/60">
                  Roles
                </span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-900/60 text-rose-600 dark:text-rose-300 border border-rose-100 dark:border-rose-800/60 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.504-1.125-1.125-1.125h-6.75a1.125 1.125 0 00-1.125 1.125v3.375m9 0h3m-15 0h-3m15 0a3 3 0 003-3V6.75A3 3 0 0018 3.75H6A3 3 0 003 6.75v9a3 3 0 003 3h12z" />
              </svg>
            </div>
          </div>
        </div>

      </div>

      {/* Main Listing Panel with Filter and Switcher */}
      <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-card p-6 shadow-sm space-y-6">
        
        {/* Search, Filter & View Toggle Bar */}
        {/* Search & Filter Bar */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-5">
          
          {/* Left Search Filter */}
          <div className="relative w-full md:flex-1 md:max-w-xl">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-blue-600 dark:text-blue-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                autoComplete="off"
                placeholder="Search by name, email, employee code..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full !pl-10 !pr-9 py-2 rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-extrabold text-slate-900 dark:text-slate-100 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-500/20 placeholder:text-slate-600 dark:placeholder:text-slate-300 placeholder:font-bold transition-all duration-200 shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  title="Clear search"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

          {/* Right filters */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end flex-shrink-0">
            
            {/* Branch filter */}
            <div className="w-44 md:w-52 text-left">
              <SearchableSelect
                placeholder="All Branches"
                options={[
                  { value: 'ALL', label: 'All Branches' },
                  ...filteredBranches.map(b => ({ value: b.id, label: b.name }))
                ]}
                value={branchFilter}
                onChange={val => setBranchFilter(val)}
              />
            </div>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3.5 py-2 rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-black text-slate-900 dark:text-slate-100 outline-none cursor-pointer focus:border-blue-600 focus:ring-4 focus:ring-blue-500/20 transition-all duration-200 shadow-2xs"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="PENDING">PENDING ONBOARDING</option>
              <option value="SUSPENDED">SUSPENDED</option>
              <option value="INACTIVE">INACTIVE / TERMINATED</option>
            </select>
          </div>
        </div>

        {/* Dynamic Layout Rendering */}
        {loading ? (
          <div className="py-24 text-center text-slate-450 dark:text-slate-500 font-bold uppercase tracking-wider">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent mr-2.5 vertical-middle" />
            Syncing Employees...
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="py-20 text-center text-slate-450 dark:text-slate-500 font-bold uppercase tracking-wider select-none border border-dashed border-slate-200/80 dark:border-slate-800 rounded-2xl bg-slate-50/20 dark:bg-slate-950/25">
            No employee profiles found matching the filter criteria.
          </div>
        ) : (
          /* 🎴 CARDS VIEW (Clean Employee Cards Grid) */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            {paginatedEmployees.map(emp => {
              const fullName = `${emp.first_name} ${emp.last_name}`;
              const initials = `${emp.first_name?.[0] || ''}${emp.last_name?.[0] || ''}`.toUpperCase();
              const status = emp.status || 'ACTIVE';

              return (
                <div 
                  key={emp.id} 
                  className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group overflow-hidden"
                >
                  <div>
                    {/* Top Image / Avatar Box */}
                    <div className="relative w-full aspect-4/3 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 mb-4 border border-slate-100 dark:border-slate-800">
                      {emp.emp_image ? (
                        <img 
                          src={emp.emp_image} 
                          alt={fullName} 
                          className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105" 
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-tr from-slate-200 via-slate-100 to-indigo-100 dark:from-slate-800 dark:to-indigo-950/60 flex items-center justify-center text-2xl font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest transition-transform duration-500 group-hover:scale-105">
                          {initials || 'EM'}
                        </div>
                      )}
                    </div>

                    {/* Name & Designation (Directly below image) */}
                    <div className="text-left px-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <h4 className="text-base font-extrabold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors tracking-tight truncate uppercase" title={fullName}>
                          {fullName}
                        </h4>
                        <span 
                          className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                            status === 'ACTIVE' 
                              ? 'bg-emerald-500 ring-4 ring-emerald-100 dark:ring-emerald-950/60 animate-pulse' 
                              : status === 'SUSPENDED' 
                              ? 'bg-amber-500 ring-4 ring-amber-100 dark:ring-amber-950/60' 
                              : 'bg-rose-500 ring-4 ring-rose-100 dark:ring-rose-950/60'
                          }`} 
                          title={`Status: ${status}`}
                        />
                      </div>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5 mb-3 truncate">
                        {emp.designation_name || 'Designation N/A'}
                      </p>

                      {/* Sub-info Role / Dept / ID Pills (Replacing Properties / Sold / Rating) */}
                      <div className="space-y-1.5 mb-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 text-[11px] font-bold">
                            ID: <span className="font-mono text-indigo-600 dark:text-indigo-400">{emp.emp_id_code}</span>
                          </span>
                          {emp.role_name && (
                            <span className="px-2.5 py-1 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-300 text-[11px] font-bold border border-purple-200/50 dark:border-purple-800/50">
                              Role: {emp.role_name}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 text-[11px] font-bold truncate max-w-full">
                            Dept: <span className="text-slate-900 dark:text-slate-200">{emp.department_name || 'General'}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Action Buttons (Side-by-side Edit & Delete Buttons) */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    {hasPermission('edit_employees') && (
                      <button
                        onClick={() => openEditDrawer(emp)}
                        className="flex-1 py-2 rounded-xl border border-teal-500/60 dark:border-teal-500/40 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                        title="Edit Employee Profile"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.83 20.089a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                        </svg>
                        <span>Edit</span>
                      </button>
                    )}
                    {hasPermission('delete_employees') && (
                      <button
                        onClick={() => setDeletingEmployee(emp)}
                        className="flex-1 py-2 rounded-xl border border-rose-400/60 dark:border-rose-500/40 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                        title="Delete Employee Profile"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modern Pagination Control Bar */}
        {totalItems > 0 && (
          <ModernPagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={totalItems}
            startIndex={startIndex}
            endIndex={endIndex}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[10, 25, 50, 100, 200, 500]}
            itemLabel="employees"
          />
        )}

      </div>

      {/* Slide Drawer for Onboarding & Modifying Details */}
      <SlideDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} title={editMode ? "Modify Employee profile" : "Onboard New Employee"}>
        <form onSubmit={handleSaveEmployee} className="space-y-4 text-left">
          
          {isSuperAdmin && (
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Target Company Context *</label>
              <SearchableSelect
                required
                placeholder="Select Company Context"
                options={companies.map(c => ({ value: c.id, label: c.name }))}
                value={empForm.companyId}
                onChange={val => setEmpForm({ ...empForm, companyId: val, branch_id: '', department_id: '', designation_id: '', role_id: '' })}
              />
            </div>
          )}

          {/* Profile Photo Upload Widget */}
          <div className="p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 space-y-3">
            <div className="flex items-center gap-4">
              
              {/* Left: Avatar Preview Container */}
              <div className="relative flex-shrink-0">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-amber-500/20 via-orange-500/20 to-yellow-500/20 border-2 border-amber-500/40 text-amber-500 font-black text-xl flex items-center justify-center relative overflow-hidden shadow-sm">
                  {empForm.emp_image ? (
                    <img src={empForm.emp_image} alt="Profile preview" className="h-full w-full object-cover" />
                  ) : (
                    <span>
                      {empForm.first_name ? empForm.first_name[0].toUpperCase() : 'H'}
                    </span>
                  )}
                </div>

                {/* Camera Badge Icon */}
                <label className="absolute -bottom-1 -right-1 h-6 w-6 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center shadow-md cursor-pointer transition-colors" title="Upload Photo">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0c-.693.047-1.32.434-1.736 1.039l-.822 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                  </svg>
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    className="hidden"
                    onChange={handleImageFileChange}
                  />
                </label>
              </div>

              {/* Right: Text & Upload Button */}
              <div className="space-y-1 text-left min-w-0 flex-1">
                <h5 className="text-xs font-black text-slate-800 dark:text-slate-100">Profile Photo</h5>
                <p className="text-[10px] text-slate-400 font-medium">Upload employee image (PNG, JPG, WebP)</p>

                <div className="flex items-center gap-2 pt-1">
                  <label className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors inline-flex items-center gap-1.5 shadow-2xs cursor-pointer">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    <span>Choose Image File</span>
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/webp"
                      className="hidden"
                      onChange={handleImageFileChange}
                    />
                  </label>

                  {empForm.emp_image && (
                    <button
                      type="button"
                      onClick={() => setEmpForm(prev => ({ ...prev, emp_image: '' }))}
                      className="px-2.5 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition-colors"
                      title="Remove image"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

            </div>
          </div>

          {(() => {
            const activeCompObj = companies.find(c => c.id === (empForm.companyId || selectedCompanyId)) || companies[0];
            const activeCode = activeCompObj ? (activeCompObj.company_code || activeCompObj.subdomain?.toUpperCase() || 'EMP') : 'EMP';
            return (
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Employee ID / Code *</label>
                <div className={`relative flex items-center w-full rounded-xl border bg-slate-50/50 dark:bg-slate-950/20 overflow-hidden focus-within:ring-2 transition-all duration-200 ${
                  duplicateEmp
                    ? 'border-amber-400 dark:border-amber-600 focus-within:ring-amber-200 dark:focus:ring-amber-900/40'
                    : 'border-slate-200 dark:border-slate-800 focus-within:border-blue-500 focus-within:ring-blue-100 dark:focus:ring-blue-900/30'
                }`}>
                  <span className="px-3 py-2.5 bg-slate-200/80 dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 font-mono font-extrabold text-xs border-r border-slate-300 dark:border-slate-700 select-none flex-shrink-0 uppercase tracking-wider">
                    {activeCode}-
                  </span>
                  <input
                    type="text" required placeholder="1001"
                    value={empForm.emp_id_code}
                    onChange={e => setEmpForm({ ...empForm, emp_id_code: e.target.value })}
                    className="w-full bg-transparent px-3 py-2.5 text-xs text-slate-800 dark:text-slate-200 font-mono font-bold placeholder-slate-400 outline-none border-none"
                  />
                </div>

                {duplicateEmp && (
                  <div className="mt-2.5 p-3 rounded-2xl border border-amber-300 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 flex items-start gap-2.5 shadow-2xs text-amber-800 dark:text-amber-300 animate-fadeIn">
                    <span className="text-base shrink-0">⚠️</span>
                    <div className="text-xs font-semibold leading-relaxed">
                      <p className="font-extrabold uppercase tracking-wide text-[10.5px] text-amber-700 dark:text-amber-400">
                        Employee ID Already Assigned!
                      </p>
                      <p className="mt-0.5">
                        This ID is already assigned to <strong className="font-black text-amber-900 dark:text-amber-200">{duplicateEmp.first_name} {duplicateEmp.last_name}</strong> (Code: <span className="font-mono font-black">{duplicateEmp.emp_id_code}</span>).
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">First Name *</label>
              <input
                type="text" required placeholder="Ravi"
                value={empForm.first_name}
                onChange={e => setEmpForm({ ...empForm, first_name: e.target.value })}
                className={inputStyle}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Last Name *</label>
              <input
                type="text" required placeholder="Kumar"
                value={empForm.last_name}
                onChange={e => setEmpForm({ ...empForm, last_name: e.target.value })}
                className={inputStyle}
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Email Address *</label>
            <input
              type="email" required placeholder="employee@company.com"
              value={empForm.email}
              onChange={e => setEmpForm({ ...empForm, email: e.target.value })}
              className={inputStyle}
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Contact Number</label>
            <input
              type="text" placeholder="+91 9876543210"
              value={empForm.phone}
              onChange={e => setEmpForm({ ...empForm, phone: e.target.value })}
              className={inputStyle}
            />
          </div>

          {editMode && (
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">New Password (Optional)</label>
              <input
                type="text" placeholder="Leave blank to keep current password"
                value={empForm.password}
                onChange={e => setEmpForm({ ...empForm, password: e.target.value })}
                className={inputStyle}
              />
              <p className="mt-1 text-[10px] text-slate-400">Must be at least 6 characters if provided. Updates Keycloak credentials.</p>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Joining Date *</label>
            <input
              type="date" required
              value={empForm.joining_date}
              onChange={e => setEmpForm({ ...empForm, joining_date: e.target.value })}
              className={inputStyle}
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Employment Status *</label>
            <select
              value={empForm.status || 'ACTIVE'}
              onChange={e => setEmpForm({ ...empForm, status: e.target.value })}
              className={inputStyle}
            >
              <option value="ACTIVE">🟢 ACTIVE</option>
              <option value="INACTIVE">🔴 INACTIVE</option>
              <option value="SUSPENDED">🟠 SUSPENDED</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Office Branch</label>
            <SearchableSelect
              placeholder={activeCompanyId ? "Select Branch" : "Choose Company Context first"}
              options={deduplicateOptions(filteredBranches.map(b => ({ value: b.id, label: b.name })), empForm.branch_id)}
              value={empForm.branch_id}
              onChange={val => setEmpForm({ ...empForm, branch_id: val, department_id: '', designation_id: '' })}
              disabled={!activeCompanyId}
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Department</label>
            <SearchableSelect
              placeholder={empForm.branch_id ? "Select Department" : "Choose Office Branch first"}
              options={deduplicateOptions(filteredDepartments.map(d => ({ value: d.id, label: d.name })), empForm.department_id)}
              value={empForm.department_id}
              onChange={val => setEmpForm({ ...empForm, department_id: val, designation_id: '' })}
              disabled={!empForm.branch_id}
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Job Designation</label>
            <SearchableSelect
              placeholder={empForm.department_id ? "Select Designation" : "Choose Department first"}
              options={deduplicateOptions(filteredDesignations.map(ds => ({ value: ds.id, label: ds.name })), empForm.designation_id)}
              value={empForm.designation_id}
              onChange={val => setEmpForm({ ...empForm, designation_id: val })}
              disabled={!empForm.department_id}
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Access Role</label>
            <SearchableSelect
              placeholder={activeCompanyId ? "Select Role" : "Choose Company Context first"}
              options={deduplicateOptions(filteredRoles.map(r => ({ value: r.id, label: r.name })), empForm.role_id)}
              value={empForm.role_id}
              onChange={val => setEmpForm({ ...empForm, role_id: val })}
              disabled={!activeCompanyId}
            />
            {!editMode && (
              <div className="mt-2.5 p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100/50 dark:border-blue-900/30 text-[11px] text-blue-755 dark:text-blue-400 leading-relaxed font-semibold">
                <div className="flex gap-2 items-center">
                  <svg className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                  <div className="flex items-center gap-1.5">
                    <span>Your login password:</span>
                    <span className="font-mono bg-blue-100/60 dark:bg-blue-900/50 px-2 py-0.5 rounded text-blue-900 dark:text-blue-200 font-extrabold">{getTempPasswordPreview()}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-2">
            <label className="block text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest flex items-center justify-between">
              <span>Reporting Head / Manager</span>
              <span className="text-[9px] text-blue-600 dark:text-blue-400 font-bold">Hierarchy Node</span>
            </label>
            <SearchableSelect
              placeholder={activeCompanyId ? "Select Reporting Head / Manager" : "Choose Company Context first"}
              options={[
                { value: '', label: '👔 None (Top Level / Direct Report)' },
                ...employees
                  .filter(e => {
                    const matchCompany = activeCompanyId ? e.company_id === activeCompanyId : true;
                    const notSelf = selectedEmployeeId ? e.id !== selectedEmployeeId : true;
                    return matchCompany && notSelf;
                  })
                  .map(e => ({
                    value: e.id,
                    label: `👤 ${e.first_name} ${e.last_name} · ${e.designation_name || 'Staff'} (${e.emp_id_code})`
                  }))
              ]}
              value={empForm.reporting_to_id}
              onChange={val => setEmpForm({ ...empForm, reporting_to_id: val })}
              disabled={!activeCompanyId}
            />
            <p className="text-[9.5px] text-slate-400 font-medium">
              Assign or change who this employee reports to in the corporate hierarchy.
            </p>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Work Shift *</label>
            <SearchableSelect
              required
              placeholder={activeCompanyId ? "Select Shift" : "Choose Company Context first"}
              options={filteredShifts.map(s => ({ value: s.id, label: `${s.name} (${s.start_time} - ${s.end_time})` }))}
              value={empForm.shift_id}
              onChange={handleShiftChange}
              disabled={!activeCompanyId}
            />
          </div>

          {/* Rotational Shift settings */}
          {empForm.shift_id && (
            <div className="p-4 rounded-xl border border-slate-200/60 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Enable Shift Rotation?</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRotational}
                    onChange={e => setIsRotational(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {isRotational && (
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Interval (Days)</label>
                      <input
                        type="number"
                        min="1"
                        value={daysInterval}
                        onChange={e => setDaysInterval(parseInt(e.target.value) || 1)}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wider mb-1">Rotation End Date</label>
                      <input
                        type="date"
                        min={getMinRotationDate()}
                        max={getMaxRotationDate()}
                        value={rotationEndDate}
                        onChange={e => setRotationEndDate(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none font-bold focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Sequence Builder inside drawer */}
                  <div className="space-y-2">
                    <label className="block text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Rotation Sequence Chain</label>
                    <div className="flex gap-2">
                      <select
                        value={selectedShiftForSeq}
                        onChange={e => setSelectedShiftForSeq(e.target.value)}
                        className="flex-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none font-bold"
                      >
                        <option value="">-- Add Shift --</option>
                        {filteredShifts.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          if (!selectedShiftForSeq) return;
                          if (rotationShifts.includes(selectedShiftForSeq)) {
                            showToast('This shift is already in the sequence chain.', 'error');
                            return;
                          }
                          setRotationShifts(prev => [...prev, selectedShiftForSeq]);
                          setSelectedShiftForSeq('');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold cursor-pointer transition-colors"
                      >
                        Add
                      </button>
                    </div>

                    {/* Sequence List */}
                    {rotationShifts.length > 0 && (
                      <div className="space-y-1.5 max-h-32 overflow-y-auto mt-2">
                        {rotationShifts.map((shiftId, idx) => {
                          const shiftDetail = shifts.find(s => String(s.id) === String(shiftId));
                          return (
                            <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-[11px]">
                              <div className="flex items-center gap-1.5">
                                <span className="h-4 w-4 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[9px] font-black">{idx + 1}</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200">{shiftDetail?.name || 'Unknown Shift'}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setRotationShifts(prev => prev.filter((_, i) => i !== idx))}
                                className="text-slate-400 hover:text-red-500 cursor-pointer p-0.5"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Live note showing the next 2 shift dates & times */}
                  {getRotationalPreview().length > 0 && (
                    <div className="mt-3.5 p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100/50 dark:border-blue-900/30 text-[11px] text-blue-755 dark:text-blue-400 leading-relaxed font-semibold">
                      <div className="font-bold uppercase tracking-wider text-[9px] mb-1.5 text-blue-600 dark:text-blue-400 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 111.086 1.086L12 12.75l-.04.02a.75.75 0 11-1.087-1.086l.041-.02zM12 21a9 9 0 100-18 9 9 0 000 18z" stroke="currentColor" />
                        </svg>
                        Upcoming Shift Preview (Next 2 Shifts)
                      </div>
                      <ul className="space-y-1.5">
                        {getRotationalPreview().map((item, idx) => (
                          <li key={idx} className="flex justify-between items-center bg-white/40 dark:bg-slate-900/30 p-1.5 rounded-lg border border-slate-100 dark:border-slate-800/40">
                            <span className="flex flex-col text-left">
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-extrabold uppercase">Shift {idx + 1}</span>
                              <strong className="text-slate-855 dark:text-slate-200">{item.shiftName}</strong>
                              <span className="text-[9.5px] font-mono text-slate-400 dark:text-slate-550 font-bold">{item.startTime} - {item.endTime}</span>
                            </span>
                            <span className="font-mono text-slate-700 dark:text-slate-400 text-[10px] font-bold text-right">
                              {item.startStr} - {item.endStr}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {editMode && (
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Activation Status</label>
              <select
                value={empForm.status}
                onChange={e => setEmpForm({ ...empForm, status: e.target.value })}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 focus:bg-card focus:ring-2 focus:ring-blue-100 font-bold transition-all duration-200"
              >
                <option value="ACTIVE" className="bg-card text-emerald-600 font-bold">ACTIVE</option>
                <option value="SUSPENDED" className="bg-card text-amber-600 font-bold">SUSPENDED</option>
                <option value="INACTIVE" className="bg-card text-slate-500 font-bold">INACTIVE</option>
              </select>
            </div>
          )}

          <button type="submit" className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-xs font-bold text-white shadow-sm transition-all duration-200 cursor-pointer mt-2">
            {editMode ? "Save Changes" : "Onboard Employee Profile"}
          </button>
        </form>
      </SlideDrawer>

      {/* 🗑️ DELETION CONFIRMATION INTERACTIVE TOAST OVERLAY */}
      {deletingEmployee && (
        <>
          {/* Backdrop overlay — clicking outside/beside closes the confirm toast */}
          <div 
            className="fixed inset-0 z-50 bg-slate-950/20 backdrop-blur-2xs cursor-pointer animate-fadeIn" 
            onClick={() => setDeletingEmployee(null)} 
          />

          <div className="fixed bottom-6 right-6 z-55 max-w-sm w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-white p-5 rounded-2xl shadow-2xl animate-slideIn">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1 text-left space-y-1.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">Confirm Deletion</h4>
                  <span className="text-[9.5px] font-bold text-slate-400 dark:text-slate-500 animate-pulse">Auto-closes (5s)</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold leading-normal">
                  Are you sure you want to delete the employee profile for <span className="text-rose-600 dark:text-rose-400 font-black">"{deletingEmployee.first_name} {deletingEmployee.last_name}"</span>? Access will be terminated.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => {
                      executeDeleteEmployee(deletingEmployee.id);
                      setDeletingEmployee(null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-black cursor-pointer shadow-xs transition-colors"
                  >
                    Yes, Delete
                  </button>
                  <button
                    onClick={() => setDeletingEmployee(null)}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-650 dark:text-slate-350 text-[10px] font-black cursor-pointer border border-slate-200 dark:border-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ===================== BULK UPLOAD DRAWER ===================== */}
      <SlideDrawer
        isOpen={bulkDrawerOpen}
        onClose={() => setBulkDrawerOpen(false)}
        title="Bulk Upload Employees"
      >
        <div className="space-y-5 p-1">

          {/* Step 1: Download Template */}
          <div className="rounded-2xl border border-emerald-200/60 dark:border-emerald-800/40 bg-emerald-50/40 dark:bg-emerald-950/15 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-8 w-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">Step 1: Download Template</p>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5">Download the sample CSV, fill employee details, and upload below.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const headers = ['emp_id_code', 'first_name', 'last_name', 'email', 'phone', 'joining_date', 'dob', 'gender', 'status', 'branch_name', 'department_name', 'designation_name', 'role_name', 'shift_name'];
                const sampleRows = [
                  ['EMP001', 'Ravi', 'Kumar', 'ravi@brihaspathi.com', '9876543210', '2024-01-15', '1995-06-20', 'Male', 'ACTIVE', 'Hyderabad', 'Engineering', 'Software Engineer', 'Employee', 'General Shift'],
                  ['EMP002', 'Priya', 'Sharma', 'priya@brihaspathi.com', '9876543211', '2024-02-01', '1998-03-12', 'Female', 'ACTIVE', 'Hyderabad', 'HR', 'HR Executive', 'Employee', 'General Shift'],
                ];
                const csvContent = [headers, ...sampleRows].map(r => r.join(',')).join('\n');
                const blob = new Blob([csvContent], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'employee_bulk_upload_template.csv';
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="w-full py-2.5 rounded-xl border border-emerald-300/60 dark:border-emerald-700/40 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-sm"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Download Sample CSV Template
            </button>
          </div>

          {/* CSV Columns Guide */}
          <div className="rounded-xl border border-slate-200/60 dark:border-slate-800/50 bg-slate-50/40 dark:bg-slate-950/20 p-3.5">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Required Columns</p>
            <div className="flex flex-wrap gap-1.5">
              {['emp_id_code *', 'first_name *', 'last_name *', 'email *', 'joining_date *'].map(col => (
                <span key={col} className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-[10px] font-bold border border-rose-200/40 dark:border-rose-900/30">{col}</span>
              ))}
            </div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mt-2.5 mb-2">Optional Columns</p>
            <div className="flex flex-wrap gap-1.5">
              {['phone', 'dob', 'gender', 'status', 'branch_name', 'department_name', 'designation_name', 'role_name', 'shift_name'].map(col => (
                <span key={col} className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-900/40 text-slate-500 dark:text-slate-400 text-[10px] font-bold border border-slate-200/40 dark:border-slate-800/40">{col}</span>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2.5">
              💡 Use <strong>exact names</strong> for branch, department, designation, role, and shift (as configured in your company settings).
            </p>
          </div>

          {/* Step 2: Upload CSV */}
          <div>
            <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Step 2: Upload CSV File</p>
            <label
              htmlFor="bulk-csv-upload"
              className={`flex flex-col items-center justify-center gap-3 w-full h-32 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200 ${
                bulkFile
                  ? 'border-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/15'
                  : 'border-slate-300 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-950/20 hover:border-blue-400 hover:bg-blue-50/20 dark:hover:border-blue-600'
              }`}
            >
              {bulkFile ? (
                <>
                  <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-center">
                    <p className="text-xs font-black text-emerald-600 dark:text-emerald-400">{bulkFile.name}</p>
                    <p className="text-[10px] text-slate-400">{(bulkFile.size / 1024).toFixed(1)} KB — Click to change</p>
                  </div>
                </>
              ) : (
                <>
                  <svg className="w-8 h-8 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <div className="text-center">
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Drag & drop or click to browse</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">CSV files only · Max 500 rows</p>
                  </div>
                </>
              )}
              <input
                id="bulk-csv-upload"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={e => { setBulkFile(e.target.files?.[0] || null); setBulkResults(null); }}
              />
            </label>
          </div>

          {/* Import Button */}
          <button
            type="button"
            disabled={!bulkFile || bulkUploading}
            onClick={async () => {
              if (!bulkFile) return;
              setBulkUploading(true);
              setBulkResults(null);
              try {
                const text = await bulkFile.text();
                const lines = text.trim().split('\n').filter(l => l.trim());
                if (lines.length < 2) {
                  showToast('CSV file is empty or has no data rows.', 'error');
                  setBulkUploading(false);
                  return;
                }
                const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
                const employees = lines.slice(1).map(line => {
                  const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
                  const obj: Record<string, string> = {};
                  headers.forEach((h, i) => {
                    let val = values[i] || '';
                    if (h.toLowerCase() === 'email') val = val.replace(/\s+/g, '');
                    obj[h] = val;
                  });
                  return obj;
                });

                const targetCompanyId = isSuperAdmin ? (empForm.companyId || selectedCompanyId) : selectedCompanyId;
                if (!targetCompanyId) {
                  showToast('Please select a company first.', 'error');
                  setBulkUploading(false);
                  return;
                }

                const res = await fetch(getUrl('/api/v1/employees/bulk'), {
                  method: 'POST',
                  headers: getHeaders(),
                  body: JSON.stringify({ employees, companyId: targetCompanyId }),
                });
                const data = await res.json();
                setBulkResults(data.results || []);
                if (data.successCount > 0) {
                  const kcFail = data.keycloakFailCount || 0;
                  if (kcFail > 0) {
                    showToast(`✅ ${data.successCount} DB records saved · ⚠️ ${kcFail} Keycloak accounts failed`, 'error');
                  } else {
                    showToast(`✅ ${data.successCount} employees fully imported (DB + Keycloak)!`, 'success');
                  }
                  fetchEmployees();
                }
                if (data.errorCount > 0) {
                  showToast(`❌ ${data.errorCount} rows skipped (duplicate/invalid). Check results.`, 'error');
                }
              } catch (err) {
                showToast('Error processing CSV file. Please check the format.', 'error');
              }
              setBulkUploading(false);
            }}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md"
          >
            {bulkUploading ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Importing...
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                Import Employees
              </>
            )}
          </button>

          {/* Results Table */}
          {bulkResults && bulkResults.length > 0 && (
            <div className="rounded-xl border border-slate-200/60 dark:border-slate-800/50 overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50/60 dark:bg-slate-900/40 border-b border-slate-200/50 dark:border-slate-800/40 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Import Results</span>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">{bulkResults!.filter(r => r.status === 'success' && r.keycloak_status === 'created').length} Fully OK</span>
                  <span className="text-[10px] font-bold text-amber-500 dark:text-amber-400">{bulkResults!.filter(r => r.status === 'success' && r.keycloak_status === 'failed').length} KC Failed</span>
                  <span className="text-[10px] font-bold text-rose-500 dark:text-rose-400">{bulkResults!.filter(r => r.status === 'error').length} Skipped</span>
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {bulkResults!.map((r, idx) => {
                  const isDbError = r.status === 'error';
                  const isKcFailed = r.status === 'success' && r.keycloak_status === 'failed';
                  const isFullOk = r.status === 'success' && r.keycloak_status === 'created';
                  return (
                    <div key={idx} className={`flex items-center gap-3 px-4 py-2.5 border-b border-slate-100/50 dark:border-slate-800/30 last:border-0 ${
                      isDbError ? 'bg-rose-50/30 dark:bg-rose-950/10' : isKcFailed ? 'bg-amber-50/30 dark:bg-amber-950/10' : ''
                    }`}>
                      {/* Status icon */}
                      <span className={`h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isFullOk ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600' :
                        isKcFailed ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-500' :
                        'bg-rose-100 dark:bg-rose-900/40 text-rose-500'
                      }`}>
                        {isFullOk ? (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                        ) : isKcFailed ? (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" /></svg>
                        ) : (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        )}
                      </span>
                      <span className="text-[10px] text-slate-400 w-8 flex-shrink-0">R{r.row}</span>
                      <span className="text-[10.5px] font-black text-slate-700 dark:text-slate-300 w-20 flex-shrink-0 truncate">{r.emp_id_code}</span>
                      <span className={`text-[10px] font-semibold flex-1 leading-tight ${
                        isFullOk ? 'text-emerald-600 dark:text-emerald-400' :
                        isKcFailed ? 'text-amber-600 dark:text-amber-400' :
                        'text-rose-500 dark:text-rose-400'
                      }`}>{r.message}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </SlideDrawer>

    </div>
  );
}
