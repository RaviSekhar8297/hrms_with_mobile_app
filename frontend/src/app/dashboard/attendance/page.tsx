'use client';

import React, { useEffect, useState } from 'react';
import DashboardPageHeader from '../components/DashboardPageHeader';
import { getHeaders, API_BASE } from '../utils/api';
import SlideDrawer from '../components/SlideDrawer';
import { useDashboard } from '../components/DashboardContext';
import SearchableSelect from '../components/SearchableSelect';
import CustomDatePicker from '../components/CustomDatePicker';
import { usePermissions } from '../hooks/usePermissions';

interface Company {
  id: string;
  name: string;
  subdomain: string;
  status: string;
  created_at: string;
}

interface Employee {
  id: string;
  emp_id_code: string;
  first_name: string;
  last_name: string;
  company_id?: string;
}

// Tab definitions with permission keys
const ATTENDANCE_TABS = [
  { id: 'policies',        label: 'Attendance Rules',         permission: 'view_attendance_policies' },
  { id: 'punches',         label: 'Raw Punch Logs',            permission: 'view_punch_records' },
  { id: 'logs',            label: 'Attendance Logs',           permission: 'view_attendance_summary' },
  { id: 'regularizations', label: 'Regularization Requests',  permission: 'view_attendance_regularizations' },
  { id: 'permissions',     label: 'Permission Requests',       permission: 'view_permission_requests' },
] as const;

type AttendanceTabId = typeof ATTENDANCE_TABS[number]['id'];

export default function AttendancePage() {
  const { showToast } = useDashboard();
  const { hasPermission, isSuperAdmin: _isSuperAdminPerm } = usePermissions();
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Tab state — default to first visible tab
  const [activeTab, setActiveTab] = useState<AttendanceTabId>('policies');

  // Shifts (for selection in forms)
  const [shifts, setShifts] = useState<any[]>([]);

  const [isExporting, setIsExporting] = useState(false);
  const todayStr = new Date().toLocaleDateString('en-CA');

  // Logs state
  const [logs, setLogs] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const today = new Date().toLocaleDateString('en-CA');
  const [filterDateStart, setFilterDateStart] = useState(today);
  const [filterDateEnd, setFilterDateEnd] = useState(today);
  const [filterEmployee, setFilterEmployee] = useState('');
  const [logEditDrawerOpen, setLogEditDrawerOpen] = useState(false);
  const [logForm, setLogForm] = useState({
    id: '',
    employee_id: '',
    attendance_date: '',
    shift_id: '',
    first_in: '',
    last_out: '',
    status: 'PRESENT',
    worked_minutes: '480',
    late_minutes: '0'
  });

  // Punches state
  const [punches, setPunches] = useState<any[]>([]);
  const [punchSearchName, setPunchSearchName] = useState('');
  const [punchFilterDate, setPunchFilterDate] = useState(today);
  const [punchCurrentPage, setPunchCurrentPage] = useState(1);
  const [punchPageSize, setPunchPageSize] = useState(100);
  const [selectedMapPunch, setSelectedMapPunch] = useState<any>(null);
  const [punchSimulatorOpen, setPunchSimulatorOpen] = useState(false);
  const [punchUploadOpen, setPunchUploadOpen] = useState(false);
  const [punchCsvFile, setPunchCsvFile] = useState<File | null>(null);
  const [isUploadingPunches, setIsUploadingPunches] = useState(false);
  const [punchForm, setPunchForm] = useState({
    employee_id: '',
    simDate: '',
    simTime: '',
    direction: 'IN',
    source: 'WEB'
  });
  const [isSimulating, setIsSimulating] = useState(false);

  // Policy state
  const [policy, setPolicy] = useState<any>(null);
  const [policies, setPolicies] = useState<any[]>([]);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [selectedFormCompanyId, setSelectedFormCompanyId] = useState('');
  const [policyForm, setPolicyForm] = useState({
    policy_name: 'Default Attendance Policy',
    late_allowed_per_month: '3',
    late_marks_deduction_rule: '3_LATES_1_HALF_DAY',
    sandwich_rule: false,
    max_permission_count_per_month: '3',
    max_permission_minutes_per_month: '360',
    max_single_permission_minutes: '120',
    permission_affects_late: true,
    permission_affects_early_exit: true,
    allow_mobile_punch: true,
    allow_web_punch: true,
    require_selfie: false,
    require_gps: false,
    enforce_device_binding: false,
    cycle_start_day: '26',
    cycle_end_day: '25'
  });

  // Regularizations state
  const [regularizations, setRegularizations] = useState<any[]>([]);
  const [regularizationActionDrawerOpen, setRegularizationActionDrawerOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState<any>(null);
  const [actionForm, setActionForm] = useState({
    action: 'APPROVED',
    remarks: ''
  });

  // Permissions state
  const [permissionsList, setPermissionsList] = useState<any[]>([]);
  const [permissionActionDrawerOpen, setPermissionActionDrawerOpen] = useState(false);
  const [selectedPerm, setSelectedPerm] = useState<any>(null);
  const [permActionForm, setPermActionForm] = useState({
    action: 'APPROVED',
    remarks: ''
  });

  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('superadmin');

  // Filter tabs based on user permissions
  const visibleTabs = ATTENDANCE_TABS.filter(t => hasPermission(t.permission));

  // Auto-correct activeTab if it's no longer visible
  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.find(t => t.id === activeTab)) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [visibleTabs.map(t => t.id).join(',')]);

  useEffect(() => {
    const storedRoles = localStorage.getItem('roles');
    const storedEmail = localStorage.getItem('email');
    const storedCompanyId = localStorage.getItem('companyId');
    if (storedRoles) setRoles(JSON.parse(storedRoles));
    if (storedEmail) setEmail(storedEmail);
    if (storedCompanyId) setCompanyId(storedCompanyId);
  }, []);

  const downloadSamplePunchCsv = () => {
    const csvContent = "empid,punchdate\nEMP001,2023-10-25T09:00:00\nEMP002,2023-10-25T09:05:00";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_punch_upload.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePunchUpload = async () => {
    if (!punchCsvFile) {
      showToast('Please select a CSV file first', 'error');
      return;
    }
    setIsUploadingPunches(true);
    
    try {
      const text = await punchCsvFile.text();
      const rows = text.split('\n').map(r => r.trim()).filter(r => r);
      if (rows.length < 2) {
        showToast('CSV must contain header and at least one data row', 'error');
        setIsUploadingPunches(false);
        return;
      }
      const headers = rows[0].toLowerCase().split(',');
      const empIdx = headers.indexOf('empid');
      const timeIdx = headers.indexOf('punchdate');
      
      if (empIdx === -1 || timeIdx === -1) {
        showToast('CSV must contain "empid" and "punchdate" columns', 'error');
        setIsUploadingPunches(false);
        return;
      }
      
      const punchesToUpload = [];
      for (let i = 1; i < rows.length; i++) {
        const cols = rows[i].split(',');
        if (cols.length > Math.max(empIdx, timeIdx)) {
          punchesToUpload.push({
            empCode: cols[empIdx].trim(),
            punchTime: cols[timeIdx].trim()
          });
        }
      }
      
      const payload: any = { punches: punchesToUpload };
      if (isSuperAdmin && companyId) {
        payload.companyId = companyId;
      }
      
      const res = await fetch(`${API_BASE}/api/v1/attendance/punches/bulk`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`${data.successCount} punches uploaded. ${data.errorCount} skipped.`, 'success');
        setPunchUploadOpen(false);
        setPunchCsvFile(null);
        fetchPunches();
      } else {
        showToast(data.error || 'Failed to upload punches', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Error uploading punches', 'error');
    }
    setIsUploadingPunches(false);
  };

  const fetchShifts = async () => {
    if (!companyId && !isSuperAdmin) return;
    try {
      const url = companyId
        ? `http://localhost:5000/api/v1/shifts?companyId=${companyId}`
        : 'http://localhost:5000/api/v1/shifts';
      const res = await fetch(url, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) setShifts(data.shifts || []);
    } catch (e) { console.error(e); }
  };

  const fetchEmployees = async () => {
    if (!companyId && !isSuperAdmin) return;
    try {
      const url = companyId
        ? `http://localhost:5000/api/v1/employees?companyId=${companyId}`
        : 'http://localhost:5000/api/v1/employees';
      const res = await fetch(url, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) setEmployees(data.employees || []);
    } catch (e) { console.error(e); }
  };

  const fetchLogs = async () => {
    if (!companyId && !isSuperAdmin) return;
    try {
      let url = companyId
        ? `http://localhost:5000/api/v1/attendance/summary?companyId=${companyId}`
        : 'http://localhost:5000/api/v1/attendance/summary';
      const separator = url.includes('?') ? '&' : '?';
      let queryParams = '';
      if (filterDateStart) queryParams += `${queryParams ? '&' : ''}startDate=${filterDateStart}`;
      if (filterDateEnd) queryParams += `${queryParams ? '&' : ''}endDate=${filterDateEnd}`;
      if (filterEmployee) queryParams += `${queryParams ? '&' : ''}employeeId=${filterEmployee}`;
      if (queryParams) {
        url += separator + queryParams;
      }
      const res = await fetch(url, { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) {
        setLogs(data.attendanceSummary || []);
        setCurrentPage(1);
      }
    } catch (e) {
      console.error(e);
      showToast('Failed to fetch attendance logs.', 'error');
    }
  };

  const fetchPunches = async () => {
    if (!companyId && !isSuperAdmin) return;
    try {
      const url = companyId
        ? `http://localhost:5000/api/v1/attendance/punches?companyId=${companyId}`
        : 'http://localhost:5000/api/v1/attendance/punches';
      const res = await fetch(url, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        setPunches(data.punches || []);
        setPunchCurrentPage(1);
      }
    } catch (e) {
      console.error(e);
      showToast('Failed to fetch raw punch logs.', 'error');
    }
  };

  const fetchPolicy = async () => {
    if (!companyId) {
      setPolicy(null);
      if (isSuperAdmin) {
        try {
          const res = await fetch('http://localhost:5000/api/v1/attendance/policies', {
            headers: getHeaders()
          });
          const data = await res.json();
          if (res.ok) {
            setPolicies(data.policies || []);
          }
        } catch (e) {
          console.error(e);
        }
      }
      return;
    }
    try {
      const res = await fetch(`http://localhost:5000/api/v1/attendance/policies?companyId=${companyId}`, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok && data.policy) {
        setPolicy(data.policy);
        setPolicyForm({
          policy_name: data.policy.policy_name || 'Default Attendance Policy',
          late_allowed_per_month: String(data.policy.late_allowed_per_month || 0),
          late_marks_deduction_rule: data.policy.late_marks_deduction_rule || '3_LATES_1_HALF_DAY',
          sandwich_rule: !!data.policy.sandwich_rule,
          max_permission_count_per_month: String(data.policy.max_permission_count_per_month || 3),
          max_permission_minutes_per_month: String(data.policy.max_permission_minutes_per_month || 360),
          max_single_permission_minutes: String(data.policy.max_single_permission_minutes || 120),
          permission_affects_late: !!data.policy.permission_affects_late,
          permission_affects_early_exit: !!data.policy.permission_affects_early_exit,
          allow_mobile_punch: !!data.policy.allow_mobile_punch,
          allow_web_punch: !!data.policy.allow_web_punch,
          require_selfie: !!data.policy.require_selfie,
          require_gps: !!data.policy.require_gps,
          enforce_device_binding: !!data.policy.enforce_device_binding,
          cycle_start_day: String(data.policy.cycle_start_day || 26),
          cycle_end_day: String(data.policy.cycle_end_day || 25)
        });
      } else {
        setPolicy(null);
        // Set default values for empty state
        setPolicyForm({
          policy_name: 'Default Attendance Policy',
          late_allowed_per_month: '3',
          late_marks_deduction_rule: '3_LATES_1_HALF_DAY',
          sandwich_rule: false,
          max_permission_count_per_month: '3',
          max_permission_minutes_per_month: '360',
          max_single_permission_minutes: '120',
          permission_affects_late: true,
          permission_affects_early_exit: true,
          allow_mobile_punch: true,
          allow_web_punch: true,
          require_selfie: false,
          require_gps: false,
          enforce_device_binding: false,
          cycle_start_day: '26',
          cycle_end_day: '25'
        });
      }
    } catch (e) {
      console.error(e);
      showToast('Failed to fetch attendance policy.', 'error');
    }
  };

  const fetchRegularizations = async () => {
    if (!companyId && !isSuperAdmin) return;
    try {
      const url = companyId
        ? `http://localhost:5000/api/v1/attendance/regularizations?companyId=${companyId}`
        : 'http://localhost:5000/api/v1/attendance/regularizations';
      const res = await fetch(url, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) setRegularizations(data.regularizations || []);
    } catch (e) {
      console.error(e);
      showToast('Failed to fetch regularization requests.', 'error');
    }
  };

  const fetchPermissions = async () => {
    if (!companyId && !isSuperAdmin) return;
    try {
      const url = companyId
        ? `http://localhost:5000/api/v1/attendance/permissions?companyId=${companyId}`
        : 'http://localhost:5000/api/v1/attendance/permissions';
      const res = await fetch(url, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) setPermissionsList(data.permissions || []);
    } catch (e) {
      console.error(e);
      showToast('Failed to fetch permission requests.', 'error');
    }
  };

  const fetchCompanies = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/v1/companies', { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) setCompanies(data.companies || []);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (isSuperAdmin) fetchCompanies();
  }, [companyId, isSuperAdmin]);

  useEffect(() => {
    if (companyId || isSuperAdmin) {
      fetchShifts();
      fetchEmployees();
      if (activeTab === 'logs') fetchLogs();
      if (activeTab === 'punches') fetchPunches();
      if (activeTab === 'policies') fetchPolicy();
      if (activeTab === 'regularizations') fetchRegularizations();
      if (activeTab === 'permissions') fetchPermissions();
    }
  }, [companyId, activeTab, isSuperAdmin]);

  const handleCompanyChange = (id: string) => {
    const val = id || null;
    setCompanyId(val);
    if (val) {
      localStorage.setItem('companyId', val);
    } else {
      localStorage.removeItem('companyId');
    }
  };

  const handleSaveLogOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logForm.employee_id || !logForm.attendance_date || !logForm.status) {
      showToast('Please fill in Employee, Date and Status.', 'error');
      return;
    }
    try {
      const selectedEmployeeObj = employees.find(emp => emp.id === logForm.employee_id);
      const targetCompanyId = companyId || (selectedEmployeeObj ? selectedEmployeeObj.company_id : null);
      if (!targetCompanyId) {
        showToast('Please select a company.', 'error');
        return;
      }
      const method = logForm.id ? 'PUT' : 'POST';
      const url = logForm.id 
        ? `http://localhost:5000/api/v1/attendance/summary/${logForm.id}`
        : 'http://localhost:5000/api/v1/attendance/summary';

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify({
          companyId: targetCompanyId,
          ...logForm
        })
      });

      if (res.ok) {
        showToast(`Attendance record ${logForm.id ? 'updated' : 'created'} successfully!`, 'success');
        setLogEditDrawerOpen(false);
        fetchLogs();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to save attendance record.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Connection to server failed', 'error');
    }
  };

  const handleDeleteLog = async (id: string) => {
    if (!confirm('Are you sure you want to delete this daily attendance summary?')) return;
    try {
      const selectedLog = logs.find(l => String(l.id) === String(id));
      const targetCompanyId = companyId || (selectedLog ? selectedLog.company_id : null);
      const res = await fetch(`http://localhost:5000/api/v1/attendance/summary/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
        body: JSON.stringify({ companyId: targetCompanyId })
      });
      if (res.ok) {
        showToast('Record deleted successfully', 'success');
        fetchLogs();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to delete record', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Connection to server failed', 'error');
    }
  };

  const handleSimulatePunch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!punchForm.employee_id || !punchForm.simDate || !punchForm.simTime || !punchForm.direction) {
      showToast('Please select employee, date, time and direction.', 'error');
      return;
    }

    const selectedDateTime = new Date(`${punchForm.simDate}T${punchForm.simTime}`);
    if (selectedDateTime > new Date()) {
      showToast('Future dates and times cannot be selected for punch simulation.', 'error');
      return;
    }
    setIsSimulating(true);
    try {
      const selectedEmployeeObj = employees.find(emp => emp.id === punchForm.employee_id);
      const targetCompanyId = companyId || (selectedEmployeeObj ? selectedEmployeeObj.company_id : null);
      if (!targetCompanyId) {
        showToast('Please select a company.', 'error');
        setIsSimulating(false);
        return;
      }
      let latitude: number | null = null;
      let longitude: number | null = null;

      if (navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { 
              enableHighAccuracy: false,
              timeout: 10000 
            });
          });
          latitude = position.coords.latitude;
          longitude = position.coords.longitude;
        } catch (geoError) {
          console.warn("Geolocation could not be retrieved, proceeding without location:", geoError);
        }
      }

      const res = await fetch('http://localhost:5000/api/v1/attendance/punches', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          companyId: targetCompanyId,
          employee_id: punchForm.employee_id,
          direction: punchForm.direction,
          source: punchForm.source,
          punch_time: new Date(`${punchForm.simDate}T${punchForm.simTime}`).toISOString(),
          latitude,
          longitude
        })
      });

      if (res.ok) {
        showToast('Simulated punch logged and attendance compiled successfully!', 'success');
        setPunchSimulatorOpen(false);
        fetchPunches();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to log simulated punch.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Connection to server failed', 'error');
    } finally {
      setIsSimulating(false);
    }
  };

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

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetCompanyId = companyId || selectedFormCompanyId;
    if (!targetCompanyId) {
      showToast('Please select a company first.', 'error');
      return;
    }

    const startD = parseInt(policyForm.cycle_start_day);
    const endD = parseInt(policyForm.cycle_end_day);
    const cycleErr = getCycleValidationError(startD, endD);
    if (cycleErr) {
      showToast(cycleErr, 'error');
      return;
    }
    try {
      const res = await fetch('http://localhost:5000/api/v1/attendance/policies', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          companyId: targetCompanyId,
          ...policyForm
        })
      });

      if (res.ok) {
        showToast('Attendance rules and policies saved successfully!', 'success');
        setIsPolicyModalOpen(false);
        fetchPolicy();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to save attendance policy.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Connection to server failed', 'error');
    }
  };

  const handleActionRegularization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReq) return;
    try {
      const targetCompanyId = companyId || selectedReq.company_id;
      const res = await fetch(`http://localhost:5000/api/v1/attendance/regularizations/${selectedReq.id}/action`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          companyId: targetCompanyId,
          action: actionForm.action,
          remarks: actionForm.remarks
        })
      });

      if (res.ok) {
        showToast(`Request ${actionForm.action.toLowerCase()} successfully!`, 'success');
        setRegularizationActionDrawerOpen(false);
        fetchRegularizations();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to update regularization.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Connection to server failed', 'error');
    }
  };

  const handleActionPermission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPerm) return;
    try {
      const targetCompanyId = companyId || selectedPerm.company_id;
      const res = await fetch(`http://localhost:5000/api/v1/attendance/permissions/${selectedPerm.id}/action`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          companyId: targetCompanyId,
          action: permActionForm.action,
          remarks: permActionForm.remarks
        })
      });

      if (res.ok) {
        showToast(`Permission request ${permActionForm.action.toLowerCase()} successfully!`, 'success');
        setPermissionActionDrawerOpen(false);
        fetchPermissions();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to update permission request.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Connection to server failed', 'error');
    }
  };

  const handleExportExcel = () => {
    if (logs.length === 0) {
      showToast('No logs available to export.', 'error');
      return;
    }

    setIsExporting(true);

    setTimeout(() => {
      const headers = [
        'Date',
        'Employee Code',
        'Employee Name',
        'Shift',
        'In Punch',
        'Out Punch',
        'Worked Time',
        'Late Minutes',
        'Status',
        'Regularized'
      ];

      const rows = logs.map(log => [
        new Date(log.attendance_date).toLocaleDateString(),
        log.emp_id_code,
        `${log.first_name} ${log.last_name}`,
        log.shift_name || 'N/A',
        log.first_in ? new Date(log.first_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
        log.last_out ? new Date(log.last_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
        log.worked_minutes ? `${Math.floor(log.worked_minutes / 60)}h ${log.worked_minutes % 60}m` : '0h 0m',
        log.late_minutes || 0,
        log.status,
        log.is_regularized ? 'Yes' : 'No'
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `attendance_logs_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setIsExporting(false);
      showToast('Attendance logs exported successfully!', 'success');
    }, 1200);
  };

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PRESENT': return 'bg-green-500/10 text-green-600 dark:text-green-400';
      case 'ABSENT': return 'bg-red-500/10 text-red-600 dark:text-red-400';
      case 'HALF_DAY': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
      case 'HOLIDAY': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
      case 'ON_LEAVE': return 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400';
      default: return 'bg-slate-100 dark:bg-slate-800 text-slate-500';
    }
  };

  // Pagination calculations
  const totalLogs = logs.length;
  const totalPages = Math.max(1, Math.ceil(totalLogs / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalLogs);
  const paginatedLogs = logs.slice(startIndex, endIndex);

  // Filtered raw punches
  const filteredPunches = punches.filter(p => {
    if (punchSearchName.trim()) {
      const searchLower = punchSearchName.toLowerCase().trim();
      const fullName = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase();
      const code = (p.emp_id_code || '').toLowerCase();
      if (!fullName.includes(searchLower) && !code.includes(searchLower)) {
        return false;
      }
    }
    if (punchFilterDate) {
      const punchDateStr = new Date(p.punch_time).toLocaleDateString('en-CA');
      if (punchDateStr !== punchFilterDate) {
        return false;
      }
    }
    return true;
  });

  // Punch Pagination calculations
  const totalPunches = filteredPunches.length;
  const totalPunchPages = Math.max(1, Math.ceil(totalPunches / punchPageSize));
  const punchStartIndex = (punchCurrentPage - 1) * punchPageSize;
  const punchEndIndex = Math.min(punchStartIndex + punchPageSize, totalPunches);
  const paginatedPunches = filteredPunches.slice(punchStartIndex, punchEndIndex);

  const formatPunchTime = (timeStr: string) => {
    if (!timeStr) return '-';
    const cleanStr = String(timeStr).replace(/Z$|\+00:?00$/, '');
    const d = new Date(cleanStr);
    if (isNaN(d.getTime())) return timeStr;
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }} className="font-['DM_Sans',sans-serif] space-y-6 animate-fadeIn w-full">
      <style dangerouslySetInnerHTML={{__html: `
        .font-sans, .font-mono, td, th, button, input, select, label, span, div, p, h3, h4, h5, h6 {
          font-family: 'DM Sans', sans-serif !important;
        }
      `}} />
      <DashboardPageHeader
        title="Attendance Management"
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

      {/* Tab Navigation */}
      {visibleTabs.length === 0 ? (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 text-xs font-bold">
          <span>⚠️</span> You don't have permission to access any Attendance modules. Contact your administrator.
        </div>
      ) : (
        <div className="flex gap-2 p-1.5 bg-slate-100/70 dark:bg-slate-900/40 rounded-2xl border border-slate-200/50 dark:border-slate-800/80 max-w-fit flex-wrap">
          {visibleTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4.5 py-2.5 rounded-xl text-[10.5px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-850 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/40 dark:hover:bg-slate-800/40'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Tab Contents */}
      {activeTab === 'logs' && (
        <div className="space-y-6">
          {/* Filters Area */}
          <div className="flex flex-wrap gap-4 items-end bg-card/60 p-4 rounded-xl border border-slate-200/50 dark:border-slate-800/80">
            <div className="w-48">
              <label className="block text-[9px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1.5 font-sans">Start Date</label>
              <CustomDatePicker
                value={filterDateStart}
                onChange={setFilterDateStart}
                placeholder="Select start date..."
                maxDate={todayStr}
              />
            </div>
            <div className="w-48">
              <label className="block text-[9px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1.5 font-sans">End Date</label>
              <CustomDatePicker
                value={filterDateEnd}
                onChange={setFilterDateEnd}
                placeholder="Select end date..."
                maxDate={todayStr}
              />
            </div>
            <div className="w-64">
              <label className="block text-[9px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1.5 font-sans">Filter Employee</label>
              <SearchableSelect
                options={employees.map(emp => ({
                  value: emp.id,
                  label: `${emp.emp_id_code} - ${emp.first_name} ${emp.last_name}`
                }))}
                value={filterEmployee}
                onChange={val => setFilterEmployee(val)}
                placeholder="-- All Employees --"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={fetchLogs}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Search
              </button>
              <button
                onClick={() => {
                  setFilterDateStart(today);
                  setFilterDateEnd(today);
                  setFilterEmployee('');
                  setTimeout(fetchLogs, 100);
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-550 dark:text-slate-400 text-xs font-semibold hover:bg-slate-50/10 cursor-pointer bg-transparent"
              >
                Reset
              </button>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={handleExportExcel}
                disabled={isExporting}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-wider shadow-sm transition-all duration-200 cursor-pointer flex items-center gap-1.5 flex-shrink-0 border-0 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Export logs"
              >
                {isExporting ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Exporting...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    Export
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  setLogForm({
                    id: '',
                    employee_id: employees.length > 0 ? employees[0].id : '',
                    attendance_date: new Date().toISOString().split('T')[0],
                    shift_id: shifts.length > 0 ? shifts[0].id : '',
                    first_in: '',
                    last_out: '',
                    status: 'PRESENT',
                    worked_minutes: '480',
                    late_minutes: '0'
                  });
                  setLogEditDrawerOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-wider shadow-sm transition-colors cursor-pointer flex items-center gap-1 flex-shrink-0 border-0"
              >
                Manual Entry
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-card p-6 shadow-sm text-left">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-550 dark:text-slate-400 font-black uppercase tracking-widest text-[9.5px]">
                    {!companyId && <th className="py-3.5 px-3">Company</th>}
                    <th className="py-3.5 px-3">Date</th>
                    <th className="py-3.5 px-3">Emp Code</th>
                    <th className="py-3.5 px-3">Name</th>
                    <th className="py-3.5 px-3">Shift</th>
                    <th className="py-3.5 px-3">In Punch</th>
                    <th className="py-3.5 px-3">Out Punch</th>
                    <th className="py-3.5 px-3">Worked Time</th>
                    <th className="py-3.5 px-3">Late Min</th>
                    <th className="py-3.5 px-3">Status</th>
                    <th className="py-3.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={!companyId ? 11 : 10} className="py-8 text-center text-slate-450 dark:text-slate-550 font-bold">
                        No attendance summaries found for this period.
                      </td>
                    </tr>
                  ) : (
                    paginatedLogs.map(log => (
                      <tr key={log.id} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-550/5 transition-all">
                        {!companyId && <td className="py-4 px-3 text-slate-550 dark:text-slate-400 font-bold">{log.company_name || 'Global'}</td>}
                        <td className="py-4 px-3 font-semibold text-slate-600 dark:text-slate-400 font-mono">{new Date(log.attendance_date).toLocaleDateString()}</td>
                        <td className="py-4 px-3 font-semibold text-slate-600 dark:text-slate-450 font-mono">{log.emp_id_code}</td>
                        <td className="py-4 px-3 font-black text-slate-800 dark:text-slate-200">{log.first_name} {log.last_name}</td>
                        <td className="py-4 px-3 text-slate-500 dark:text-slate-400">{log.shift_name || 'N/A'}</td>
                        <td className="py-4 px-3 font-mono text-slate-600 dark:text-slate-350">{log.first_in ? new Date(log.first_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                        <td className="py-4 px-3 font-mono text-slate-600 dark:text-slate-350">{log.last_out ? new Date(log.last_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                        <td className="py-4 px-3 font-semibold font-mono text-slate-700 dark:text-slate-300">
                          {log.worked_minutes ? `${Math.floor(log.worked_minutes / 60)}h ${log.worked_minutes % 60}m` : '-'}
                        </td>
                        <td className="py-4 px-3 text-red-500 font-mono font-bold">{log.late_minutes || 0}m</td>
                        <td className="py-4 px-3">
                          <span className={`px-2 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider ${getStatusColor(log.status)}`}>
                            {log.status}
                          </span>
                          {log.is_regularized && (
                            <span className="ml-1.5 text-[8.5px] font-bold text-blue-500 border border-blue-500/20 px-1 py-0.2 rounded bg-blue-500/5">REGULARIZED</span>
                          )}
                        </td>
                        <td className="py-4 px-3 text-right space-x-2">
                          <button
                            onClick={() => {
                              setLogForm({
                                id: String(log.id),
                                employee_id: log.employee_id,
                                attendance_date: new Date(log.attendance_date).toISOString().split('T')[0],
                                shift_id: log.shift_id || '',
                                first_in: log.first_in ? new Date(log.first_in).toISOString().substring(0, 16) : '',
                                last_out: log.last_out ? new Date(log.last_out).toISOString().substring(0, 16) : '',
                                status: log.status,
                                worked_minutes: String(log.worked_minutes || 0),
                                late_minutes: String(log.late_minutes || 0)
                              });
                              setLogEditDrawerOpen(true);
                            }}
                            className="px-2.5 py-1 rounded bg-blue-500/10 hover:bg-blue-500 text-blue-600 hover:text-white text-[9.5px] font-black uppercase tracking-wider transition-colors cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteLog(log.id)}
                            className="px-2.5 py-1 rounded bg-red-500/10 hover:bg-red-600 text-red-600 hover:text-white text-[9.5px] font-black uppercase tracking-wider transition-colors cursor-pointer"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {logs.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/60 text-xs">
                <div className="text-slate-500 dark:text-slate-400 font-medium">
                  Showing <span className="font-semibold text-slate-850 dark:text-slate-200">{startIndex + 1}</span> to{' '}
                  <span className="font-semibold text-slate-850 dark:text-slate-200">{endIndex}</span> of{' '}
                  <span className="font-semibold text-slate-850 dark:text-slate-200">{totalLogs}</span> entries
                </div>

                <div className="flex items-center gap-6">
                  {/* Page Size Select */}
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 dark:text-slate-400 text-[11px] font-bold">Show:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="rounded-lg border border-slate-200 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-900/30 px-2 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 transition-all cursor-pointer"
                    >
                      {[100, 200, 500, 1000].map(sz => (
                        <option key={sz} value={sz} className="bg-card text-slate-800 dark:text-slate-200">
                          {sz}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Navigation Buttons */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      title="First Page"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
                      </svg>
                    </button>

                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      title="Previous Page"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                      </svg>
                    </button>

                    <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-350 px-2 select-none">
                      Page {currentPage} of {totalPages}
                    </span>

                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      title="Next Page"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </button>

                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      title="Last Page"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.25l7.5 7.5-7.5 7.5m6-15l7.5 7.5-7.5 7.5" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'punches' && (
        <div className="space-y-6">
          {/* Filters Area for Raw Punch Logs */}
          <div className="flex flex-wrap gap-4 items-end bg-card/60 p-4 rounded-xl border border-slate-200/50 dark:border-slate-800/80">
            <div className="w-64">
              <label className="block text-[9px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1.5 font-sans">Search Employee</label>
              <input
                type="text"
                value={punchSearchName}
                onChange={(e) => setPunchSearchName(e.target.value)}
                placeholder="Enter name or employee code..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40 px-3.5 py-2.5 text-xs outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-slate-800 dark:text-slate-200"
              />
            </div>
            <div className="w-48">
              <label className="block text-[9px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1.5 font-sans">Punch Date</label>
              <CustomDatePicker
                value={punchFilterDate}
                onChange={setPunchFilterDate}
                placeholder="Filter punch date..."
                maxDate={todayStr}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setPunchSearchName('');
                  setPunchFilterDate(today);
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800/40 text-xs font-black uppercase tracking-wider transition-colors cursor-pointer"
              >
                Reset
              </button>
            </div>

            <div className="ml-auto flex gap-2">
              <button
                onClick={() => setPunchUploadOpen(true)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/40 text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 flex-shrink-0"
              >
                Upload
              </button>
              <button
                onClick={() => {
                  const localNow = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString();
                  setPunchForm({
                    employee_id: employees.length > 0 ? employees[0].id : '',
                    simDate: localNow.substring(0, 10),
                    simTime: localNow.substring(11, 16),
                    direction: 'IN',
                    source: 'WEB'
                  });
                  setPunchSimulatorOpen(true);
                }}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-[10px] font-black uppercase tracking-wider shadow-sm transition-colors cursor-pointer flex items-center gap-1.5 flex-shrink-0"
              >
                Punch Simulator
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-card p-6 shadow-sm text-left">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-550 dark:text-slate-400 font-black uppercase tracking-widest text-[9.5px]">
                    {!companyId && <th className="py-3.5 px-3">Company</th>}
                    <th className="py-3.5 px-3">Punch Date & Time</th>
                    <th className="py-3.5 px-3">Emp Code</th>
                    <th className="py-3.5 px-3">Employee Name</th>
                    <th className="py-3.5 px-3">Direction</th>
                    <th className="py-3.5 px-3">Location / Map</th>
                    <th className="py-3.5 px-3">Source</th>
                    <th className="py-3.5 px-3">IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPunches.length === 0 ? (
                    <tr>
                      <td colSpan={!companyId ? 8 : 7} className="py-8 text-center text-slate-450 dark:text-slate-550 font-bold">
                        No raw punch logs match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    paginatedPunches.map(p => (
                      <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-550/5 transition-all font-mono">
                        {!companyId && <td className="py-4 px-3 text-slate-550 dark:text-slate-400 font-bold font-sans">{p.company_name || 'Global'}</td>}
                        <td className="py-4 px-3 text-slate-800 dark:text-slate-200 font-bold">{formatPunchTime(p.punch_time)}</td>
                        <td className="py-4 px-3 text-slate-500">{p.emp_id_code}</td>
                        <td className="py-4 px-3 font-black font-sans text-slate-750 dark:text-slate-250">{p.first_name} {p.last_name}</td>
                        <td className="py-4 px-3">
                          <span className={`px-2 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider ${p.direction === 'IN' ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>
                            {p.direction}
                          </span>
                        </td>
                        <td className="py-4 px-3 font-sans">
                          {p.latitude && p.longitude ? (
                            <button
                              onClick={() => setSelectedMapPunch(p)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-650 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-[10px] font-bold transition-all cursor-pointer shadow-2xs group"
                              title="Click to view interactive map"
                            >
                              <span className="text-xs group-hover:scale-125 transition-transform">📍</span>
                              <span className="truncate max-w-[150px] text-left">
                                {p.location_name || `${p.latitude}, ${p.longitude}`}
                              </span>
                            </button>
                          ) : p.location_name ? (
                            <button
                              onClick={() => setSelectedMapPunch(p)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-900/40 text-[10px] font-bold transition-all cursor-pointer shadow-2xs"
                              title="Click to view location details"
                            >
                              <span>📍</span>
                              <span className="truncate max-w-[150px]">{p.location_name}</span>
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60 text-[9.5px] font-extrabold uppercase tracking-wider">
                              <span>📟</span> Bio-Metric Punch
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-3 font-semibold text-[10px] text-slate-650 dark:text-slate-400 font-sans">{p.source}</td>
                        <td className="py-4 px-3 text-slate-400">{p.ip_address || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Raw Punch Logs Pagination Controls */}
            {filteredPunches.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/60 text-xs">
                <div className="text-slate-500 dark:text-slate-400 font-medium">
                  Showing <span className="font-semibold text-slate-850 dark:text-slate-200">{punchStartIndex + 1}</span> to{' '}
                  <span className="font-semibold text-slate-850 dark:text-slate-200">{punchEndIndex}</span> of{' '}
                  <span className="font-semibold text-slate-850 dark:text-slate-200">{totalPunches}</span> entries
                </div>

                <div className="flex items-center gap-6">
                  {/* Page Size Select */}
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 dark:text-slate-400 text-[11px] font-bold">Show:</span>
                    <select
                      value={punchPageSize}
                      onChange={(e) => {
                        setPunchPageSize(Number(e.target.value));
                        setPunchCurrentPage(1);
                      }}
                      className="rounded-lg border border-slate-200 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-900/30 px-2 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 transition-all cursor-pointer"
                    >
                      {[100, 200, 500, 1000, 2000].map(sz => (
                        <option key={sz} value={sz} className="bg-card text-slate-800 dark:text-slate-200">
                          {sz}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Navigation Buttons */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setPunchCurrentPage(1)}
                      disabled={punchCurrentPage === 1}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      title="First Page"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
                      </svg>
                    </button>

                    <button
                      onClick={() => setPunchCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={punchCurrentPage === 1}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      title="Previous Page"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                      </svg>
                    </button>

                    <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-350 px-2 select-none">
                      Page {punchCurrentPage} of {totalPunchPages}
                    </span>

                    <button
                      onClick={() => setPunchCurrentPage(prev => Math.min(totalPunchPages, prev + 1))}
                      disabled={punchCurrentPage === totalPunchPages}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      title="Next Page"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </button>

                    <button
                      onClick={() => setPunchCurrentPage(totalPunchPages)}
                      disabled={punchCurrentPage === totalPunchPages}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      title="Last Page"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.25l7.5 7.5-7.5 7.5m6-15l7.5 7.5-7.5 7.5" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'policies' && (
        <div className="space-y-6 w-full text-left">
          {!companyId ? (
            <>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest font-sans">Attendance Rules System</h3>
                  <p className="text-[10px] text-slate-400 dark:text-slate-550 font-bold mt-0.5 font-sans">Global policy controls for check-in mechanisms, sandwich rules, and late mark thresholds</p>
                </div>
                {isSuperAdmin && (
                  <button
                    onClick={() => {
                      setPolicyForm({
                        policy_name: 'Default Attendance Policy',
                        late_allowed_per_month: '3',
                        late_marks_deduction_rule: '3_LATES_1_HALF_DAY',
                        sandwich_rule: false,
                        max_permission_count_per_month: '3',
                        max_permission_minutes_per_month: '360',
                        max_single_permission_minutes: '120',
                        permission_affects_late: true,
                        permission_affects_early_exit: true,
                        allow_mobile_punch: true,
                        allow_web_punch: true,
                        require_selfie: false,
                        require_gps: false,
                        enforce_device_binding: false,
                        cycle_start_day: '26',
                        cycle_end_day: '25'
                      });
                      setSelectedFormCompanyId('');
                      setIsPolicyModalOpen(true);
                    }}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-[10px] font-black uppercase tracking-wider shadow-sm transition-all cursor-pointer active:scale-95"
                  >
                    Configure New Policy
                  </button>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-card p-6 shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-550 dark:text-slate-400 font-black uppercase tracking-widest text-[9.5px]">
                        <th className="py-3.5 px-3">Company</th>
                        <th className="py-3.5 px-3">Policy Title</th>
                        <th className="py-3.5 px-3">Rules</th>
                        <th className="py-3.5 px-3 text-center">Channels</th>
                        <th className="py-3.5 px-3 text-center">Security</th>
                        <th className="py-3.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {policies.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-450 dark:text-slate-555 font-bold">
                            No attendance policies configured yet. Click "Configure New Policy" to add one.
                          </td>
                        </tr>
                      ) : (
                        policies.map(p => (
                          <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-550/5 transition-all">
                            <td className="py-4 px-3 font-black text-slate-750 dark:text-slate-250 font-sans">{p.company_name}</td>
                            <td className="py-4 px-3 text-slate-850 dark:text-slate-200 font-semibold">{p.policy_name}</td>
                            <td className="py-4 px-3 text-slate-650 dark:text-slate-400 font-mono text-[10px]">
                              <div>Grace: <span className="font-bold text-amber-500">{p.late_allowed_per_month} lates</span></div>
                              <div className="mt-0.5">Deduction: <span className="font-bold">{p.late_marks_deduction_rule === 'NO_DEDUCTION' ? 'None' : p.late_marks_deduction_rule.replace(/_/g, ' ')}</span></div>
                              {p.sandwich_rule && <div className="mt-0.5"><span className="px-1.5 py-0.5 rounded text-[8px] bg-red-500/10 text-red-500 font-bold font-sans">SANDWICH ENFORCED</span></div>}
                            </td>
                            <td className="py-4 px-3 text-center">
                              <div className="flex justify-center gap-1.5">
                                {p.allow_web_punch ? (
                                  <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-blue-500/10 text-blue-600 dark:text-blue-400 uppercase">Web</span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 uppercase">Web Off</span>
                                )}
                                {p.allow_mobile_punch ? (
                                  <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 uppercase">Mobile</span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 uppercase">Mob Off</span>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-3 text-center">
                              <div className="flex justify-center gap-1">
                                {p.require_selfie && (
                                  <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-purple-500/10 text-purple-600 dark:text-purple-400" title="Selfie Required">SELFIE</span>
                                )}
                                {p.require_gps && (
                                  <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-teal-500/10 text-teal-600 dark:text-teal-400" title="GPS Verification Active">GPS</span>
                                )}
                                {p.enforce_device_binding && (
                                  <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-rose-500/10 text-rose-600 dark:text-rose-400" title="Device Binding Enforced">DEVICE</span>
                                )}
                                {!p.require_selfie && !p.require_gps && !p.enforce_device_binding && (
                                  <span className="text-slate-400 text-[10px] font-bold font-sans">None</span>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-3 text-right">
                              <button
                                onClick={() => {
                                  setSelectedFormCompanyId(p.company_id);
                                  setPolicyForm({
                                    policy_name: p.policy_name || '',
                                    late_allowed_per_month: String(p.late_allowed_per_month || 0),
                                    late_marks_deduction_rule: p.late_marks_deduction_rule || '3_LATES_1_HALF_DAY',
                                    sandwich_rule: !!p.sandwich_rule,
                                    max_permission_count_per_month: String(p.max_permission_count_per_month || 3),
                                    max_permission_minutes_per_month: String(p.max_permission_minutes_per_month || 360),
                                    max_single_permission_minutes: String(p.max_single_permission_minutes || 120),
                                    permission_affects_late: !!p.permission_affects_late,
                                    permission_affects_early_exit: !!p.permission_affects_early_exit,
                                    allow_mobile_punch: !!p.allow_mobile_punch,
                                    allow_web_punch: !!p.allow_web_punch,
                                    require_selfie: !!p.require_selfie,
                                    require_gps: !!p.require_gps,
                                    enforce_device_binding: !!p.enforce_device_binding,
                                    cycle_start_day: String(p.cycle_start_day || 26),
                                    cycle_end_day: String(p.cycle_end_day || 25)
                                  });
                                  setIsPolicyModalOpen(true);
                                }}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-55 dark:bg-slate-900/50 text-[10px] font-bold text-slate-650 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              >
                                Edit Rules
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest font-sans">Attendance Rules System</h3>
                    {policy ? (
                      <span className="px-2 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">
                        Policy Configured
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse">
                        Showing Defaults (Not Saved)
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-550 font-bold mt-0.5 font-sans">Global policy controls for check-in mechanisms, sandwich rules, and late mark thresholds</p>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-card p-6 shadow-sm">
                <form onSubmit={handleSavePolicy} className="space-y-6">
                  {/* Section 1: General Policy Configuration */}
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-555 border-b border-slate-100 dark:border-slate-800 pb-2 mb-3">General Settings</h4>
                      
                      {/* Row 1: Policy Title & Allowed Late Marks */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-3.5 rounded-xl border border-blue-500/40 dark:border-blue-500/40 bg-blue-50/10 dark:bg-blue-950/10 shadow-sm">
                          <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest mb-1.5 font-sans">Policy Title</label>
                          <input
                            type="text"
                            required
                            value={policyForm.policy_name}
                            onChange={e => setPolicyForm({ ...policyForm, policy_name: e.target.value })}
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 transition-all font-sans"
                          />
                        </div>

                        <div className="p-3.5 rounded-xl border border-blue-500/40 dark:border-blue-500/40 bg-blue-50/10 dark:bg-blue-950/10 shadow-sm">
                          <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest mb-1.5 font-sans">Allowed Late Marks Per Month</label>
                          <div className="relative">
                            <input
                              type="number"
                              value={policyForm.late_allowed_per_month}
                              onChange={e => setPolicyForm({ ...policyForm, late_allowed_per_month: e.target.value })}
                              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-3.5 pr-10 py-2.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 font-mono transition-all"
                            />
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center group cursor-pointer">
                              <svg className="w-4 h-4 text-amber-500 hover:text-amber-600 transition-colors" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                              </svg>
                              <div className="absolute bottom-full right-0 mb-2.5 w-76 p-4 bg-slate-900/98 dark:bg-slate-950/98 backdrop-blur-md text-white text-[10.5px] rounded-xl shadow-xl border border-slate-800/80 dark:border-slate-700/50 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 z-50 leading-relaxed font-sans normal-case">
                                <span className="font-black text-amber-400 block mb-1">💡 Grace Limit Explanation:</span>
                                Monthly grace limit. For example, if set to 5, the first 5 late marks are completely excused. The deduction rule below will only apply starting from the 6th late mark onwards. If set to 0, penalty counts from the first late mark.
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Row 2: Late Mark Deduction Rule & Enforce Sandwich Rule */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-3.5 rounded-xl border border-blue-500/40 dark:border-blue-500/40 bg-blue-50/10 dark:bg-blue-950/10 shadow-sm">
                          <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest mb-1.5 font-sans">Late Mark Deduction Rule</label>
                          <select
                            value={policyForm.late_marks_deduction_rule}
                            onChange={e => setPolicyForm({ ...policyForm, late_marks_deduction_rule: e.target.value })}
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 transition-all cursor-pointer font-sans"
                          >
                            <option value="3_LATES_1_HALF_DAY">3 Late Marks = 1 Half Day Deduct</option>
                            <option value="4_LATES_1_HALF_DAY">4 Late Marks = 1 Half Day Deduct</option>
                            <option value="NO_DEDUCTION">Informal / No auto deductions</option>
                          </select>
                        </div>

                        <div 
                          onClick={() => setPolicyForm({ ...policyForm, sandwich_rule: !policyForm.sandwich_rule })}
                          className="flex items-center justify-between p-3.5 rounded-xl border border-blue-500/40 dark:border-blue-500/40 bg-blue-50/10 dark:bg-blue-950/10 shadow-sm cursor-pointer transition-all duration-200 hover:border-blue-500"
                        >
                          <div className="flex items-center gap-3">
                            <span className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                              policyForm.sandwich_rule
                                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-550'
                            }`}>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                            </span>
                            <div>
                              <span className="text-[11px] font-black uppercase tracking-wider text-slate-850 dark:text-slate-200">Enforce Sandwich Rule</span>
                              <p className="text-[9.5px] text-slate-400 dark:text-slate-500 font-bold mt-0.5">Holidays bounded by absent days are counted as absent</p>
                            </div>
                          </div>
                          
                          <button
                            type="button"
                            className={`relative inline-flex h-4.5 w-8 flex-shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out outline-none focus:outline-none ${
                              policyForm.sandwich_rule
                                ? 'bg-blue-600 shadow shadow-blue-600/30'
                                : 'bg-slate-200 dark:bg-slate-800'
                            }`}
                          >
                            <span
                              aria-hidden="true"
                              className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                                policyForm.sandwich_rule ? 'translate-x-3.5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Row 3 (Bottom): Payroll Cycle Start & End Dates */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-3.5 rounded-xl border border-blue-500/40 dark:border-blue-500/40 bg-blue-50/10 dark:bg-blue-950/10 shadow-sm">
                          <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest mb-1.5 font-sans">
                            Payroll Cycle Start Date (Day) <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={31}
                            value={policyForm.cycle_start_day || '26'}
                            onChange={e => setPolicyForm({ ...policyForm, cycle_start_day: e.target.value })}
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 font-mono transition-all font-sans"
                          />
                          <p className="text-[9.5px] text-slate-400 font-medium mt-1 font-sans">Day of month when cycle starts (1-31)</p>
                        </div>

                        <div className="p-3.5 rounded-xl border border-blue-500/40 dark:border-blue-500/40 bg-blue-50/10 dark:bg-blue-950/10 shadow-sm">
                          <label className="block text-[9.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest mb-1.5 font-sans">
                            Payroll Cycle End Date (Day) <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={31}
                            value={policyForm.cycle_end_day || '25'}
                            onChange={e => setPolicyForm({ ...policyForm, cycle_end_day: e.target.value })}
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 font-mono transition-all font-sans"
                          />
                          <p className="text-[9.5px] text-slate-400 font-medium mt-1 font-sans">Day of month when cycle ends (1-31). Use cross-month cycle (e.g., 26-25 means Nov 26 to Dec 25)</p>
                        </div>
                      </div>

                      {getCycleValidationError(parseInt(policyForm.cycle_start_day), parseInt(policyForm.cycle_end_day)) && (
                        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-semibold">
                          <svg className="w-4 h-4 flex-shrink-0 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                          </svg>
                        </div>
                      )}
                    </div>

                  {/* Section 2: Allowed Check-In Channels */}
                  <div className="space-y-4 pt-2">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800 pb-2 mb-3">Allowed Check-In Channels</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div 
                        onClick={() => setPolicyForm({ ...policyForm, allow_web_punch: !policyForm.allow_web_punch })}
                        className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                          policyForm.allow_web_punch
                            ? 'bg-blue-50/40 dark:bg-blue-950/10 border-blue-500 dark:border-blue-500/50 shadow-sm'
                            : 'bg-slate-50/40 dark:bg-slate-900/20 border-slate-200 dark:border-slate-800/80 hover:border-slate-350 dark:hover:border-slate-700/80'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                            policyForm.allow_web_punch
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                          }`}>
                            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
                            </svg>
                          </span>
                          <div>
                            <span className="text-xs font-black uppercase tracking-wider text-slate-850 dark:text-slate-200">Browser / Web Check-In</span>
                            <p className="text-[9.5px] text-slate-400 dark:text-slate-500 font-bold mt-0.5">Let employees check in using dashboard portal</p>
                          </div>
                        </div>
                        
                        <button
                          type="button"
                          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out outline-none focus:outline-none ${
                            policyForm.allow_web_punch
                              ? 'bg-blue-600 shadow shadow-blue-600/30'
                              : 'bg-slate-200 dark:bg-slate-800'
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                              policyForm.allow_web_punch ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      <div 
                        onClick={() => setPolicyForm({ ...policyForm, allow_mobile_punch: !policyForm.allow_mobile_punch })}
                        className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                          policyForm.allow_mobile_punch
                            ? 'bg-blue-50/40 dark:bg-blue-950/10 border-blue-500 dark:border-blue-500/50 shadow-sm'
                            : 'bg-slate-50/40 dark:bg-slate-900/20 border-slate-200 dark:border-slate-800/80 hover:border-slate-350 dark:hover:border-slate-700/80'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                            policyForm.allow_mobile_punch
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                          }`}>
                            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                            </svg>
                          </span>
                          <div>
                            <span className="text-xs font-black uppercase tracking-wider text-slate-850 dark:text-slate-200">Mobile App Check-In</span>
                            <p className="text-[9.5px] text-slate-400 dark:text-slate-500 font-bold mt-0.5">Let employees check in via iOS/Android app</p>
                          </div>
                        </div>
                        
                        <button
                          type="button"
                          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out outline-none focus:outline-none ${
                            policyForm.allow_mobile_punch
                              ? 'bg-blue-600 shadow shadow-blue-600/30'
                              : 'bg-slate-200 dark:bg-slate-800'
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                              policyForm.allow_mobile_punch ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Verification Security Controls */}
                  <div className="space-y-4 pt-2">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800 pb-2 mb-3">Verification Security Controls</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div 
                        onClick={() => setPolicyForm({ ...policyForm, require_selfie: !policyForm.require_selfie })}
                        className={`flex flex-col justify-between p-4.5 rounded-xl border cursor-pointer transition-all duration-200 min-h-[120px] ${
                          policyForm.require_selfie
                            ? 'bg-blue-50/40 dark:bg-blue-950/10 border-blue-500 dark:border-blue-500/50 shadow-sm'
                            : 'bg-slate-50/40 dark:bg-slate-900/20 border-slate-200 dark:border-slate-800/80 hover:border-slate-350 dark:hover:border-slate-700/80'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                            policyForm.require_selfie
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                          }`}>
                            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                            </svg>
                          </span>
                          
                          <button
                            type="button"
                            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out outline-none focus:outline-none ${
                              policyForm.require_selfie
                                ? 'bg-blue-600 shadow shadow-blue-600/30'
                                : 'bg-slate-200 dark:bg-slate-800'
                            }`}
                          >
                            <span
                              aria-hidden="true"
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                                policyForm.require_selfie ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                        
                        <div className="mt-4">
                          <span className="text-xs font-black uppercase tracking-wider text-slate-850 dark:text-slate-200">Selfie Punch</span>
                          <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold mt-0.5">Require photo during clock-in</p>
                        </div>
                      </div>

                      <div 
                        onClick={() => setPolicyForm({ ...policyForm, require_gps: !policyForm.require_gps })}
                        className={`flex flex-col justify-between p-4.5 rounded-xl border cursor-pointer transition-all duration-200 min-h-[120px] ${
                          policyForm.require_gps
                            ? 'bg-blue-50/40 dark:bg-blue-950/10 border-blue-500 dark:border-blue-500/50 shadow-sm'
                            : 'bg-slate-50/40 dark:bg-slate-900/20 border-slate-200 dark:border-slate-800/80 hover:border-slate-350 dark:hover:border-slate-700/80'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                            policyForm.require_gps
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-550'
                          }`}>
                            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                            </svg>
                          </span>
                          
                          <button
                            type="button"
                            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out outline-none focus:outline-none ${
                              policyForm.require_gps
                                ? 'bg-blue-600 shadow shadow-blue-600/30'
                                : 'bg-slate-200 dark:bg-slate-800'
                            }`}
                          >
                            <span
                              aria-hidden="true"
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                                policyForm.require_gps ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                        
                        <div className="mt-4">
                          <span className="text-xs font-black uppercase tracking-wider text-slate-850 dark:text-slate-200">GPS Geolocation</span>
                          <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold mt-0.5">Enforce location range check</p>
                        </div>
                      </div>

                      <div 
                        onClick={() => setPolicyForm({ ...policyForm, enforce_device_binding: !policyForm.enforce_device_binding })}
                        className={`flex flex-col justify-between p-4.5 rounded-xl border cursor-pointer transition-all duration-200 min-h-[120px] ${
                          policyForm.enforce_device_binding
                            ? 'bg-blue-50/40 dark:bg-blue-950/10 border-blue-500 dark:border-blue-500/50 shadow-sm'
                            : 'bg-slate-50/40 dark:bg-slate-900/20 border-slate-200 dark:border-slate-800/80 hover:border-slate-350 dark:hover:border-slate-700/80'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                            policyForm.enforce_device_binding
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                          }`}>
                            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                            </svg>
                          </span>
                          
                          <button
                            type="button"
                            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out outline-none focus:outline-none ${
                              policyForm.enforce_device_binding
                                ? 'bg-blue-600 shadow shadow-blue-600/30'
                                : 'bg-slate-200 dark:bg-slate-800'
                            }`}
                          >
                            <span
                              aria-hidden="true"
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                                policyForm.enforce_device_binding ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                        
                        <div className="mt-4">
                          <span className="text-xs font-black uppercase tracking-wider text-slate-850 dark:text-slate-200">Device Binding</span>
                          <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold mt-0.5">Restrict punches to registered device</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Submit button */}
                  <div className="flex justify-end pt-5 border-t border-slate-100 dark:border-slate-800/60">
                    <button
                      type="submit"
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-black uppercase tracking-wider shadow-md shadow-blue-600/20 hover:shadow-lg transition-all cursor-pointer active:scale-[0.98]"
                    >
                      Save Policy Rules
                    </button>
                  </div>
                </form>
              </div>
            </>
          )}

          {/* Configure Policy Modal Overlay */}
          {isPolicyModalOpen && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-card border border-slate-200 dark:border-slate-850 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col animate-scaleIn">
                {/* Header */}
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/10">
                  <div>
                    <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">
                      {selectedFormCompanyId ? 'Modify Attendance Policy' : 'Configure New Attendance Policy'}
                    </h3>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-0.5">Set late rules, channels and verification constraints for the company</p>
                  </div>
                  <button
                    onClick={() => setIsPolicyModalOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-650 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Body Form */}
                <form onSubmit={handleSavePolicy} className="p-6 space-y-6 text-left">
                  {/* Company Selection (Only visible when adding a brand new policy) */}
                  {!policy && !selectedFormCompanyId ? (
                    <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 space-y-2">
                      <label className="block text-[9.5px] font-black text-slate-450 dark:text-slate-555 uppercase tracking-widest">Select Target Company</label>
                      <select
                        required
                        value={selectedFormCompanyId}
                        onChange={e => setSelectedFormCompanyId(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-850 bg-slate-55/50 dark:bg-slate-900/30 px-3.5 py-2.5 text-xs text-slate-850 dark:text-slate-200 outline-none focus:border-blue-500 focus:bg-card focus:ring-4 focus:ring-blue-500/10 transition-all duration-200"
                      >
                        <option value="" className="text-slate-400">-- Choose a Company --</option>
                        {companies.map(c => (
                          <option key={c.id} value={c.id} className="text-slate-850 dark:text-slate-200">{c.name}</option>
                        ))}
                      </select>
                      <p className="text-[9px] text-slate-400 dark:text-slate-550 font-bold">Apply this custom policy profile to the selected company tenant.</p>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800">
                      <span className="text-[9.5px] font-black text-slate-400 dark:text-slate-555 uppercase tracking-widest block">Configuring Rules For</span>
                      <span className="text-xs font-black text-slate-850 dark:text-slate-100 mt-1 block">
                        {companies.find(c => c.id === (companyId || selectedFormCompanyId))?.name || 'Selected Tenant'}
                      </span>
                    </div>
                  )}

                  {/* Section 1: General Policy Configuration */}
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-555 border-b border-slate-100 dark:border-slate-800 pb-2 mb-3">General Settings</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-[9.5px] font-black text-slate-450 dark:text-slate-555 uppercase tracking-widest mb-1.5">Policy Title</label>
                        <input
                          type="text"
                          required
                          value={policyForm.policy_name}
                          onChange={e => setPolicyForm({ ...policyForm, policy_name: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-55/50 dark:bg-slate-900/30 px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 focus:bg-card focus:ring-4 focus:ring-blue-500/10 transition-all duration-200"
                        />
                      </div>
                      <div>
                        <label className="block text-[9.5px] font-black text-slate-450 dark:text-slate-555 uppercase tracking-widest mb-1.5">Allowed Late Marks Per Month</label>
                        <div className="relative">
                          <input
                            type="number"
                            value={policyForm.late_allowed_per_month}
                            onChange={e => setPolicyForm({ ...policyForm, late_allowed_per_month: e.target.value })}
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-55/50 dark:bg-slate-900/30 pl-3.5 pr-10 py-2.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 font-mono focus:bg-card focus:ring-4 focus:ring-blue-500/10 transition-all duration-200"
                          />
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center group cursor-pointer">
                            <svg className="w-4 h-4 text-amber-500 hover:text-amber-600 transition-colors" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                            </svg>
                            <div className="absolute bottom-full right-0 mb-2.5 w-72 p-4 bg-slate-900/98 dark:bg-slate-950/98 backdrop-blur-md text-white text-[10.5px] rounded-xl shadow-xl border border-slate-800/80 dark:border-slate-700/50 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 z-50 leading-relaxed font-sans normal-case">
                              <span className="font-black text-amber-400 block mb-1">💡 Grace Limit Explanation:</span>
                              Monthly grace limit. For example, if set to 5, the first 5 late marks are completely excused. The deduction rule below will only apply starting from the 6th late mark onwards. If set to 0, penalty counts from the first late mark.
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-[9.5px] font-black text-slate-450 dark:text-slate-555 uppercase tracking-widest mb-1.5">Late Mark Deduction Rule</label>
                        <select
                          value={policyForm.late_marks_deduction_rule}
                          onChange={e => setPolicyForm({ ...policyForm, late_marks_deduction_rule: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-55/50 dark:bg-slate-900/30 px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 focus:bg-card focus:ring-4 focus:ring-blue-500/10 transition-all duration-200"
                        >
                          <option value="3_LATES_1_HALF_DAY">3 Late Marks = 1 Half Day Deduct</option>
                          <option value="4_LATES_1_HALF_DAY">4 Late Marks = 1 Half Day Deduct</option>
                          <option value="NO_DEDUCTION">Informal / No auto deductions</option>
                        </select>
                      </div>

                      <div className="flex flex-col justify-end">
                        <div 
                          onClick={() => setPolicyForm({ ...policyForm, sandwich_rule: !policyForm.sandwich_rule })}
                          className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all duration-200 ${
                            policyForm.sandwich_rule
                              ? 'bg-blue-50/40 dark:bg-blue-950/10 border-blue-500 dark:border-blue-500/50 shadow-sm'
                              : 'bg-slate-50/40 dark:bg-slate-900/20 border-slate-200 dark:border-slate-800/80 hover:border-slate-350 dark:hover:border-slate-700/80'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                              policyForm.sandwich_rule
                                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-550'
                            }`}>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                            </span>
                            <div>
                              <span className="text-[11px] font-black uppercase tracking-wider text-slate-850 dark:text-slate-200">Enforce Sandwich Rule</span>
                              <p className="text-[9.5px] text-slate-400 dark:text-slate-500 font-bold mt-0.5">Holidays bounded by absent days are counted as absent</p>
                            </div>
                          </div>
                          
                          <button
                            type="button"
                            className={`relative inline-flex h-4.5 w-8 flex-shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out outline-none focus:outline-none ${
                              policyForm.sandwich_rule
                                ? 'bg-blue-600 shadow shadow-blue-600/30'
                                : 'bg-slate-200 dark:bg-slate-800'
                            }`}
                          >
                            <span
                              aria-hidden="true"
                              className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                                policyForm.sandwich_rule ? 'translate-x-3.5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Allowed Check-In Channels */}
                  <div className="space-y-4 pt-2">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-555 border-b border-slate-100 dark:border-slate-800 pb-2 mb-3">Allowed Check-In Channels</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div 
                        onClick={() => setPolicyForm({ ...policyForm, allow_web_punch: !policyForm.allow_web_punch })}
                        className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                          policyForm.allow_web_punch
                            ? 'bg-blue-50/40 dark:bg-blue-950/10 border-blue-500 dark:border-blue-500/50 shadow-sm'
                            : 'bg-slate-50/40 dark:bg-slate-900/20 border-slate-200 dark:border-slate-800/80 hover:border-slate-350 dark:hover:border-slate-700/80'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                            policyForm.allow_web_punch
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                          }`}>
                            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
                            </svg>
                          </span>
                          <div>
                            <span className="text-xs font-black uppercase tracking-wider text-slate-850 dark:text-slate-200">Browser / Web Check-In</span>
                            <p className="text-[9.5px] text-slate-400 dark:text-slate-500 font-bold mt-0.5">Let employees check in using dashboard portal</p>
                          </div>
                        </div>
                        
                        <button
                          type="button"
                          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out outline-none focus:outline-none ${
                            policyForm.allow_web_punch
                              ? 'bg-blue-600 shadow shadow-blue-600/30'
                              : 'bg-slate-200 dark:bg-slate-800'
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                              policyForm.allow_web_punch ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      <div 
                        onClick={() => setPolicyForm({ ...policyForm, allow_mobile_punch: !policyForm.allow_mobile_punch })}
                        className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                          policyForm.allow_mobile_punch
                            ? 'bg-blue-50/40 dark:bg-blue-950/10 border-blue-500 dark:border-blue-500/50 shadow-sm'
                            : 'bg-slate-50/40 dark:bg-slate-900/20 border-slate-200 dark:border-slate-800/80 hover:border-slate-350 dark:hover:border-slate-700/80'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                            policyForm.allow_mobile_punch
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                          }`}>
                            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                            </svg>
                          </span>
                          <div>
                            <span className="text-xs font-black uppercase tracking-wider text-slate-850 dark:text-slate-200">Mobile App Check-In</span>
                            <p className="text-[9.5px] text-slate-400 dark:text-slate-500 font-bold mt-0.5">Let employees check in via iOS/Android app</p>
                          </div>
                        </div>
                        
                        <button
                          type="button"
                          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out outline-none focus:outline-none ${
                            policyForm.allow_mobile_punch
                              ? 'bg-blue-600 shadow shadow-blue-600/30'
                              : 'bg-slate-200 dark:bg-slate-800'
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                              policyForm.allow_mobile_punch ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Verification Security Controls */}
                  <div className="space-y-4 pt-2">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800 pb-2 mb-3">Verification Security Controls</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div 
                        onClick={() => setPolicyForm({ ...policyForm, require_selfie: !policyForm.require_selfie })}
                        className={`flex flex-col justify-between p-4.5 rounded-xl border cursor-pointer transition-all duration-200 min-h-[120px] ${
                          policyForm.require_selfie
                            ? 'bg-blue-50/40 dark:bg-blue-950/10 border-blue-500 dark:border-blue-500/50 shadow-sm'
                            : 'bg-slate-50/40 dark:bg-slate-900/20 border-slate-200 dark:border-slate-800/80 hover:border-slate-350 dark:hover:border-slate-700/80'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                            policyForm.require_selfie
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                          }`}>
                            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                            </svg>
                          </span>
                          
                          <button
                            type="button"
                            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out outline-none focus:outline-none ${
                              policyForm.require_selfie
                                ? 'bg-blue-600 shadow shadow-blue-600/30'
                                : 'bg-slate-200 dark:bg-slate-800'
                            }`}
                          >
                            <span
                              aria-hidden="true"
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                                policyForm.require_selfie ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                        
                        <div className="mt-4">
                          <span className="text-xs font-black uppercase tracking-wider text-slate-850 dark:text-slate-200">Selfie Punch</span>
                          <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold mt-0.5">Require photo during clock-in</p>
                        </div>
                      </div>

                      <div 
                        onClick={() => setPolicyForm({ ...policyForm, require_gps: !policyForm.require_gps })}
                        className={`flex flex-col justify-between p-4.5 rounded-xl border cursor-pointer transition-all duration-200 min-h-[120px] ${
                          policyForm.require_gps
                            ? 'bg-blue-50/40 dark:bg-blue-950/10 border-blue-500 dark:border-blue-500/50 shadow-sm'
                            : 'bg-slate-50/40 dark:bg-slate-900/20 border-slate-200 dark:border-slate-800/80 hover:border-slate-350 dark:hover:border-slate-700/80'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                            policyForm.require_gps
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-550'
                          }`}>
                            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                            </svg>
                          </span>
                          
                          <button
                            type="button"
                            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out outline-none focus:outline-none ${
                              policyForm.require_gps
                                ? 'bg-blue-600 shadow shadow-blue-600/30'
                                : 'bg-slate-200 dark:bg-slate-800'
                            }`}
                          >
                            <span
                              aria-hidden="true"
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                                policyForm.require_gps ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                        
                        <div className="mt-4">
                          <span className="text-xs font-black uppercase tracking-wider text-slate-850 dark:text-slate-200">GPS Geolocation</span>
                          <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold mt-0.5">Enforce location range check</p>
                        </div>
                      </div>

                      <div 
                        onClick={() => setPolicyForm({ ...policyForm, enforce_device_binding: !policyForm.enforce_device_binding })}
                        className={`flex flex-col justify-between p-4.5 rounded-xl border cursor-pointer transition-all duration-200 min-h-[120px] ${
                          policyForm.enforce_device_binding
                            ? 'bg-blue-50/40 dark:bg-blue-950/10 border-blue-500 dark:border-blue-500/50 shadow-sm'
                            : 'bg-slate-50/40 dark:bg-slate-900/20 border-slate-200 dark:border-slate-800/80 hover:border-slate-350 dark:hover:border-slate-700/80'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                            policyForm.enforce_device_binding
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                          }`}>
                            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                            </svg>
                          </span>
                          
                          <button
                            type="button"
                            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out outline-none focus:outline-none ${
                              policyForm.enforce_device_binding
                                ? 'bg-blue-600 shadow shadow-blue-600/30'
                                : 'bg-slate-200 dark:bg-slate-800'
                            }`}
                          >
                            <span
                              aria-hidden="true"
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                                policyForm.enforce_device_binding ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                        
                        <div className="mt-4">
                          <span className="text-xs font-black uppercase tracking-wider text-slate-850 dark:text-slate-200">Device Binding</span>
                          <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold mt-0.5">Restrict punches to registered device</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Submit button */}
                  <div className="flex justify-end gap-3 pt-5 border-t border-slate-100 dark:border-slate-800/60">
                    <button
                      type="button"
                      onClick={() => setIsPolicyModalOpen(false)}
                      className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-250 text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-black uppercase tracking-wider shadow-md shadow-blue-600/20 hover:shadow-lg transition-all cursor-pointer active:scale-[0.98]"
                    >
                      Save Policy Rules
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'regularizations' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest text-left font-sans">Attendance Regularizations</h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-0.5 text-left font-sans">Review corrections and punch adjustment requests filed by employees</p>
          </div>

          <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-card p-6 shadow-sm text-left">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-550 dark:text-slate-400 font-black uppercase tracking-widest text-[9.5px]">
                    {!companyId && <th className="py-3.5 px-3">Company</th>}
                    <th className="py-3.5 px-3">Date</th>
                    <th className="py-3.5 px-3">Emp Code</th>
                    <th className="py-3.5 px-3">Employee</th>
                    <th className="py-3.5 px-3">Requested In</th>
                    <th className="py-3.5 px-3">Requested Out</th>
                    <th className="py-3.5 px-3">Reason</th>
                    <th className="py-3.5 px-3">Status</th>
                    <th className="py-3.5 px-3">Approver Remarks</th>
                    <th className="py-3.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {regularizations.length === 0 ? (
                    <tr>
                      <td colSpan={!companyId ? 10 : 9} className="py-8 text-center text-slate-450 dark:text-slate-550 font-bold">
                        No regularization requests logged.
                      </td>
                    </tr>
                  ) : (
                    regularizations.map(req => (
                      <tr key={req.id} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-550/5 transition-all">
                        {!companyId && <td className="py-4 px-3 text-slate-550 dark:text-slate-400 font-bold">{req.company_name || 'Global'}</td>}
                        <td className="py-4 px-3 font-semibold text-slate-655 dark:text-slate-400 font-mono">{new Date(req.attendance_date).toLocaleDateString()}</td>
                        <td className="py-4 px-3 text-slate-500 font-mono font-semibold">{req.emp_id_code}</td>
                        <td className="py-4 px-3 font-black text-slate-800 dark:text-slate-200">{req.first_name} {req.last_name}</td>
                        <td className="py-4 px-3 font-mono text-slate-700 dark:text-slate-350">{req.requested_in || '-'}</td>
                        <td className="py-4 px-3 font-mono text-slate-700 dark:text-slate-350">{req.requested_out || '-'}</td>
                        <td className="py-4 px-3 text-slate-500 max-w-[200px] truncate">{req.reason}</td>
                        <td className="py-4 px-3">
                          <span className={`px-2 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider ${
                            req.status === 'PENDING'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              : req.status === 'APPROVED'
                              ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                              : 'bg-red-500/10 text-red-600 dark:text-red-400'
                          }`}>
                            {req.status}
                          </span>
                        </td>
                        <td className="py-4 px-3 text-slate-450 italic">
                          {req.remarks ? `${req.remarks} (by ${req.approved_by_first_name || ''})` : '-'}
                        </td>
                        <td className="py-4 px-3 text-right">
                          {req.status === 'PENDING' ? (
                            <button
                              onClick={() => {
                                setSelectedReq(req);
                                setActionForm({ action: 'APPROVED', remarks: '' });
                                setRegularizationActionDrawerOpen(true);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[9.5px] font-black uppercase tracking-wider transition-colors cursor-pointer"
                            >
                              Action
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Closed</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Manual Override Log edit slideout drawer */}
      <SlideDrawer
        isOpen={logEditDrawerOpen}
        onClose={() => setLogEditDrawerOpen(false)}
        title={logForm.id ? 'Edit Attendance Record' : 'Manual Attendance Entry'}
      >
        <form onSubmit={handleSaveLogOverride} className="space-y-6 text-left p-2">
          <div>
            <label className="block text-[9.5px] font-black text-slate-500 dark:text-slate-450 uppercase tracking-widest mb-1.5">Select Employee</label>
            <SearchableSelect
              options={employees.map(emp => ({
                value: emp.id,
                label: `${emp.emp_id_code} - ${emp.first_name} ${emp.last_name}`
              }))}
              value={logForm.employee_id}
              onChange={val => setLogForm({ ...logForm, employee_id: val })}
              placeholder="-- Choose Employee --"
              disabled={!!logForm.id}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[9.5px] font-black text-slate-500 dark:text-slate-450 uppercase tracking-widest mb-1.5">Date</label>
              <CustomDatePicker
                value={logForm.attendance_date}
                onChange={val => setLogForm({ ...logForm, attendance_date: val })}
                disabled={!!logForm.id}
                required
              />
            </div>

            <div>
              <label className="block text-[9.5px] font-black text-slate-500 dark:text-slate-450 uppercase tracking-widest mb-1.5">Shift Type</label>
              <SearchableSelect
                options={shifts.map(s => ({
                  value: String(s.id),
                  label: `${s.name} (${s.start_time} - ${s.end_time})`
                }))}
                value={logForm.shift_id}
                onChange={val => setLogForm({ ...logForm, shift_id: val })}
                placeholder="-- No Shift / Default --"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[9.5px] font-black text-slate-500 dark:text-slate-450 uppercase tracking-widest mb-1.5">Punch-In Time</label>
              <div className="relative">
                <input
                  type="datetime-local"
                  value={logForm.first_in}
                  onChange={e => setLogForm({ ...logForm, first_in: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 pl-10 pr-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 font-mono"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 dark:text-slate-550">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-[9.5px] font-black text-slate-500 dark:text-slate-450 uppercase tracking-widest mb-1.5">Punch-Out Time</label>
              <div className="relative">
                <input
                  type="datetime-local"
                  value={logForm.last_out}
                  onChange={e => setLogForm({ ...logForm, last_out: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 pl-10 pr-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 font-mono"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 dark:text-slate-550">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-[9.5px] font-black text-slate-500 dark:text-slate-450 uppercase tracking-widest mb-1.5">Status</label>
              <select
                value={logForm.status}
                onChange={e => setLogForm({ ...logForm, status: e.target.value })}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
              >
                <option value="PRESENT">PRESENT</option>
                <option value="ABSENT">ABSENT</option>
                <option value="HALF_DAY">HALF_DAY</option>
                <option value="HOLIDAY">HOLIDAY</option>
                <option value="ON_LEAVE">ON_LEAVE</option>
              </select>
            </div>
            <div>
              <label className="block text-[9.5px] font-black text-slate-500 dark:text-slate-450 uppercase tracking-widest mb-1.5">Late (Min)</label>
              <input
                type="number"
                value={logForm.late_minutes}
                onChange={e => setLogForm({ ...logForm, late_minutes: e.target.value })}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800/80">
            <button
              type="button"
              onClick={() => setLogEditDrawerOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50/10 text-xs font-bold text-slate-500 dark:text-slate-400 transition-all cursor-pointer bg-transparent"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-sm transition-all cursor-pointer"
            >
              Save Attendance
            </button>
          </div>
        </form>
      </SlideDrawer>

      {/* Punch Simulator Slideout Drawer */}
      <SlideDrawer
        isOpen={punchSimulatorOpen}
        onClose={() => setPunchSimulatorOpen(false)}
        title="Web Punch Simulator"
      >
        <form onSubmit={handleSimulatePunch} className="space-y-6 text-left p-2">
          <div>
            <label className="block text-[9.5px] font-black text-slate-500 dark:text-slate-450 uppercase tracking-widest mb-1.5">Employee</label>
            <SearchableSelect
              options={employees.map(emp => ({
                value: emp.id,
                label: `${emp.emp_id_code} - ${emp.first_name} ${emp.last_name}`
              }))}
              value={punchForm.employee_id}
              onChange={val => setPunchForm({ ...punchForm, employee_id: val })}
              placeholder="-- Select Employee --"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[9.5px] font-black text-slate-500 dark:text-slate-450 uppercase tracking-widest mb-1.5">Date</label>
              <input
                type="date"
                required
                max={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]}
                value={punchForm.simDate}
                onChange={e => setPunchForm({ ...punchForm, simDate: e.target.value })}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-sans transition-all duration-200 shadow-inner cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-[9.5px] font-black text-slate-500 dark:text-slate-450 uppercase tracking-widest mb-1.5">Time</label>
              <input
                type="time"
                required
                value={punchForm.simTime}
                onChange={e => setPunchForm({ ...punchForm, simTime: e.target.value })}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-sans transition-all duration-200 shadow-inner cursor-pointer"
              />
            </div>

            <div className="col-span-2">
              <button
                type="button"
                onClick={() => {
                  const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString();
                  setPunchForm({ 
                    ...punchForm, 
                    simDate: nowLocal.substring(0, 10), 
                    simTime: nowLocal.substring(11, 16) 
                  });
                }}
                className="text-[10px] font-black text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 transition-all bg-transparent border-0 cursor-pointer p-0"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Set to current time
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[9.5px] font-black text-slate-500 dark:text-slate-450 uppercase tracking-widest mb-1.5">Direction</label>
            <div className="grid grid-cols-2 gap-4">
              <label className={`flex items-center justify-center p-3 rounded-xl border cursor-pointer select-none transition-all duration-150 text-center ${
                punchForm.direction === 'IN' 
                  ? 'bg-green-500/10 border-green-500 text-green-600'
                  : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50/20'
              }`}>
                <input
                  type="radio"
                  name="direction"
                  value="IN"
                  checked={punchForm.direction === 'IN'}
                  onChange={() => setPunchForm({ ...punchForm, direction: 'IN' })}
                  className="sr-only"
                />
                <span className="text-xs font-black uppercase tracking-wider">Check-In (IN)</span>
              </label>

              <label className={`flex items-center justify-center p-3 rounded-xl border cursor-pointer select-none transition-all duration-150 text-center ${
                punchForm.direction === 'OUT' 
                  ? 'bg-red-500/10 border-red-500 text-red-600'
                  : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50/20'
              }`}>
                <input
                  type="radio"
                  name="direction"
                  value="OUT"
                  checked={punchForm.direction === 'OUT'}
                  onChange={() => setPunchForm({ ...punchForm, direction: 'OUT' })}
                  className="sr-only"
                />
                <span className="text-xs font-black uppercase tracking-wider">Check-Out (OUT)</span>
              </label>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800/80">
            <button
              type="button"
              onClick={() => setPunchSimulatorOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50/10 text-xs font-bold text-slate-500 dark:text-slate-400 transition-all cursor-pointer bg-transparent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSimulating}
              className={`px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2 ${
                isSimulating ? 'opacity-85 cursor-not-allowed bg-blue-700' : ''
              }`}
            >
              {isSimulating ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Simulating...</span>
                </>
              ) : (
                'Simulate Punch'
              )}
            </button>
          </div>
        </form>
      </SlideDrawer>

      {/* Punch Upload Slideout Drawer */}
      <SlideDrawer
        isOpen={punchUploadOpen}
        onClose={() => setPunchUploadOpen(false)}
        title="Upload Punches (CSV)"
      >
        <div className="flex flex-col h-full">
          <div className="flex-1 overflow-y-auto premium-scrollbar p-6 space-y-6">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Upload raw punch data using a CSV file. The file must contain exactly the following two columns:
              <br/><br/>
              <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono text-[10px] text-blue-600 dark:text-blue-400 font-bold">empid</code> - The unique employee ID code<br/>
              <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono text-[10px] text-blue-600 dark:text-blue-400 font-bold mt-1 inline-block">punchdate</code> - Valid Datetime string (e.g. 2023-10-25T09:00:00)
            </p>

            <button
              onClick={downloadSamplePunchCsv}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-300 text-[10px] font-black uppercase tracking-wider rounded-xl transition-colors w-full border border-slate-200 dark:border-slate-700 cursor-pointer"
            >
              Download Sample CSV
            </button>

            <div>
              <label className="block text-[9.5px] font-black text-slate-500 dark:text-slate-450 uppercase tracking-widest mb-1.5">Select CSV File</label>
              <input
                type="file"
                accept=".csv"
                onChange={e => {
                  if (e.target.files && e.target.files.length > 0) {
                    setPunchCsvFile(e.target.files[0]);
                  }
                }}
                className="form-input text-xs w-full cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:uppercase file:tracking-wider file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-900/30 dark:file:text-blue-400 hover:file:bg-blue-100 dark:hover:file:bg-blue-900/50"
              />
              {punchCsvFile && (
                <p className="mt-2 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  Selected: {punchCsvFile.name}
                </p>
              )}
            </div>
          </div>
          <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-900/30">
            <button
              onClick={() => setPunchUploadOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handlePunchUpload}
              disabled={isUploadingPunches || !punchCsvFile}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-[10px] font-black uppercase tracking-wider shadow-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isUploadingPunches ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Uploading...
                </>
              ) : (
                'Upload Punches'
              )}
            </button>
          </div>
        </div>
      </SlideDrawer>

      {/* Regularization Action Slideout Drawer */}
      <SlideDrawer
        isOpen={regularizationActionDrawerOpen}
        onClose={() => setRegularizationActionDrawerOpen(false)}
        title="Process Regularization Request"
      >
        {selectedReq && (
          <form onSubmit={handleActionRegularization} className="space-y-6 text-left p-2">
            <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl space-y-2 border border-slate-150 dark:border-slate-850">
              <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Employee Request Summary</div>
              <div className="text-xs text-slate-800 dark:text-slate-200">
                <span className="font-bold">Employee:</span> {selectedReq.first_name} {selectedReq.last_name} ({selectedReq.emp_id_code})
              </div>
              <div className="text-xs text-slate-800 dark:text-slate-200">
                <span className="font-bold">Date:</span> {new Date(selectedReq.attendance_date).toLocaleDateString()}
              </div>
              <div className="text-xs text-slate-800 dark:text-slate-200 font-mono">
                <span className="font-bold font-sans">Requested Timings:</span> {selectedReq.requested_in || '-'} to {selectedReq.requested_out || '-'}
              </div>
              <div className="text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-950 p-2 rounded border border-slate-100 dark:border-slate-900 mt-2">
                <span className="font-bold">Reason:</span> "{selectedReq.reason}"
              </div>
            </div>

            <div>
              <label className="block text-[9.5px] font-black text-slate-500 dark:text-slate-450 uppercase tracking-widest mb-1.5 font-sans">Decision</label>
              <div className="grid grid-cols-2 gap-4">
                <label className={`flex items-center justify-center p-3 rounded-xl border cursor-pointer select-none transition-all duration-150 text-center ${
                  actionForm.action === 'APPROVED' 
                    ? 'bg-green-500/10 border-green-500 text-green-600'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-550/10'
                }`}>
                  <input
                    type="radio"
                    name="decision"
                    value="APPROVED"
                    checked={actionForm.action === 'APPROVED'}
                    onChange={() => setActionForm({ ...actionForm, action: 'APPROVED' })}
                    className="sr-only"
                  />
                  <span className="text-xs font-black uppercase tracking-wider">Approve Request</span>
                </label>

                <label className={`flex items-center justify-center p-3 rounded-xl border cursor-pointer select-none transition-all duration-150 text-center ${
                  actionForm.action === 'REJECTED' 
                    ? 'bg-red-500/10 border-red-500 text-red-600'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-550/10'
                }`}>
                  <input
                    type="radio"
                    name="decision"
                    value="REJECTED"
                    checked={actionForm.action === 'REJECTED'}
                    onChange={() => setActionForm({ ...actionForm, action: 'REJECTED' })}
                    className="sr-only"
                  />
                  <span className="text-xs font-black uppercase tracking-wider">Reject Request</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-[9.5px] font-black text-slate-500 dark:text-slate-450 uppercase tracking-widest mb-1.5 font-sans">Remarks / Feedback</label>
              <textarea
                value={actionForm.remarks}
                onChange={e => setActionForm({ ...actionForm, remarks: e.target.value })}
                placeholder="Provide remarks to the employee..."
                rows={3}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800/80">
              <button
                type="button"
                onClick={() => setRegularizationActionDrawerOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50/10 text-xs font-bold text-slate-500 dark:text-slate-400 transition-all cursor-pointer bg-transparent"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-sm transition-all cursor-pointer"
              >
                Submit Decision
              </button>
            </div>
          </form>
        )}
      </SlideDrawer>

      {activeTab === 'permissions' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-xs font-black text-slate-805 dark:text-slate-200 uppercase tracking-widest text-left font-sans">Short-time Permission Requests</h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-0.5 text-left font-sans">Review outdoor, early exit, late arrival and mid-day gatepass requests</p>
          </div>

          <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-card p-6 shadow-sm text-left">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-550 dark:text-slate-400 font-black uppercase tracking-widest text-[9.5px]">
                    {!companyId && <th className="py-3.5 px-3">Company</th>}
                    <th className="py-3.5 px-3">Date</th>
                    <th className="py-3.5 px-3">Emp Code</th>
                    <th className="py-3.5 px-3">Employee</th>
                    <th className="py-3.5 px-3">Category</th>
                    <th className="py-3.5 px-3">Time Range</th>
                    <th className="py-3.5 px-3">Duration</th>
                    <th className="py-3.5 px-3">Reason</th>
                    <th className="py-3.5 px-3">Status</th>
                    <th className="py-3.5 px-3">Approver Remarks</th>
                    <th className="py-3.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {permissionsList.length === 0 ? (
                    <tr>
                      <td colSpan={!companyId ? 11 : 10} className="py-8 text-center text-slate-450 dark:text-slate-550 font-bold">
                        No permission requests logged.
                      </td>
                    </tr>
                  ) : (
                    permissionsList.map(perm => (
                      <tr key={perm.id} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-550/5 transition-all">
                        {!companyId && <td className="py-4 px-3 text-slate-550 dark:text-slate-400 font-bold">{perm.company_name || 'Global'}</td>}
                        <td className="py-4 px-3 font-semibold text-slate-655 dark:text-slate-400 font-mono">{new Date(perm.permission_date).toLocaleDateString()}</td>
                        <td className="py-4 px-3 text-slate-500 font-mono font-semibold">{perm.emp_id_code}</td>
                        <td className="py-4 px-3 font-black text-slate-800 dark:text-slate-200">{perm.first_name} {perm.last_name}</td>
                        <td className="py-4 px-3 font-bold text-slate-700 dark:text-slate-300">
                          {perm.permission_type === 'LATE_ARRIVALS' ? '🕒 Late Arrival' : perm.permission_type === 'EARLY_EXIT' ? '🚪 Early Exit' : perm.permission_type === 'MID_DAY' ? '🍔 Mid-Day Break' : '💼 On-Duty Outdoor'}
                        </td>
                        <td className="py-4 px-3 font-mono text-slate-650 dark:text-slate-350">{perm.from_time} - {perm.to_time}</td>
                        <td className="py-4 px-3 font-bold text-blue-600 dark:text-blue-400 font-mono">{perm.duration_minutes} mins</td>
                        <td className="py-4 px-3 text-slate-550 dark:text-slate-400 max-w-[180px] truncate" title={perm.reason}>{perm.reason}</td>
                        <td className="py-4 px-3">
                          <span className={`px-2 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider ${
                            perm.status === 'PENDING'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              : perm.status === 'APPROVED'
                              ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                              : 'bg-red-500/10 text-red-600 dark:text-red-400'
                          }`}>
                            {perm.status}
                          </span>
                        </td>
                        <td className="py-4 px-3 text-slate-450 italic">
                          {perm.remarks ? `${perm.remarks} (by ${perm.approved_by_first_name || ''})` : '-'}
                        </td>
                        <td className="py-4 px-3 text-right">
                          {perm.status === 'PENDING' ? (
                            <button
                              onClick={() => {
                                setSelectedPerm(perm);
                                setPermActionForm({ action: 'APPROVED', remarks: '' });
                                setPermissionActionDrawerOpen(true);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[9.5px] font-black uppercase tracking-wider transition-colors cursor-pointer"
                            >
                              Action
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-450 dark:text-slate-550 font-bold uppercase">CLOSED</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Permission Action Slideout Drawer */}
      <SlideDrawer
        isOpen={permissionActionDrawerOpen}
        onClose={() => setPermissionActionDrawerOpen(false)}
        title="Process Permission Request"
      >
        {selectedPerm && (
          <form onSubmit={handleActionPermission} className="space-y-6 text-left p-2">
            <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl space-y-2 border border-slate-150 dark:border-slate-855">
              <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Employee Request Summary</div>
              <div className="text-xs text-slate-800 dark:text-slate-200">
                <span className="font-bold">Employee:</span> {selectedPerm.first_name} {selectedPerm.last_name} ({selectedPerm.emp_id_code})
              </div>
              <div className="text-xs text-slate-800 dark:text-slate-200">
                <span className="font-bold">Date:</span> {new Date(selectedPerm.permission_date).toLocaleDateString()}
              </div>
              <div className="text-xs text-slate-800 dark:text-slate-200">
                <span className="font-bold">Category:</span> {selectedPerm.permission_type}
              </div>
              <div className="text-xs text-slate-800 dark:text-slate-200 font-mono">
                <span className="font-bold font-sans">Requested Timing:</span> {selectedPerm.from_time} to {selectedPerm.to_time} ({selectedPerm.duration_minutes} mins)
              </div>
              <div className="text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-950 p-2 rounded border border-slate-100 dark:border-slate-900 mt-2">
                <span className="font-bold">Reason:</span> "{selectedPerm.reason}"
              </div>
            </div>

            <div>
              <label className="block text-[9.5px] font-black text-slate-500 dark:text-slate-455 uppercase tracking-widest mb-1.5 font-sans">Decision</label>
              <div className="grid grid-cols-2 gap-4">
                <label className={`flex items-center justify-center p-3 rounded-xl border cursor-pointer select-none transition-all duration-150 text-center ${
                  permActionForm.action === 'APPROVED' 
                    ? 'bg-green-500/10 border-green-500 text-green-600'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-550/10'
                }`}>
                  <input
                    type="radio"
                    name="perm-decision"
                    checked={permActionForm.action === 'APPROVED'}
                    onChange={() => setPermActionForm(prev => ({ ...prev, action: 'APPROVED' }))}
                    className="hidden"
                  />
                  <span className="text-xs font-black uppercase tracking-wider">Approve</span>
                </label>
                <label className={`flex items-center justify-center p-3 rounded-xl border cursor-pointer select-none transition-all duration-150 text-center ${
                  permActionForm.action === 'REJECTED' 
                    ? 'bg-red-500/10 border-red-500 text-red-600'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-550/10'
                }`}>
                  <input
                    type="radio"
                    name="perm-decision"
                    checked={permActionForm.action === 'REJECTED'}
                    onChange={() => setPermActionForm(prev => ({ ...prev, action: 'REJECTED' }))}
                    className="hidden"
                  />
                  <span className="text-xs font-black uppercase tracking-wider">Reject</span>
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[9.5px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-widest font-sans">Approver Comments</label>
              <textarea
                rows={3}
                value={permActionForm.remarks}
                onChange={e => setPermActionForm(prev => ({ ...prev, remarks: e.target.value }))}
                placeholder="Add decision remarks or feedback..."
                className="w-full bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-850 rounded-xl px-3.5 py-2.5 text-xs font-semibold outline-none focus:border-blue-500 transition-all resize-none"
              />
            </div>

            <div className="flex items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-850">
              <button
                type="button"
                onClick={() => setPermissionActionDrawerOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-550/10 text-xs font-bold text-slate-500 dark:text-slate-450 transition-all cursor-pointer bg-transparent"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-sm transition-all cursor-pointer"
              >
                Submit Decision
              </button>
            </div>
          </form>
        )}
      </SlideDrawer>

      {/* Location Map Preview Modal */}
      {selectedMapPunch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-card w-full max-w-xl rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl overflow-hidden text-left flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center text-lg shadow-2xs">
                  📍
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-850 dark:text-slate-100 uppercase tracking-wider font-sans">
                    Punch Location Details
                  </h3>
                  <p className="text-[10.5px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5 font-sans">
                    {selectedMapPunch.emp_id_code} - {selectedMapPunch.first_name} {selectedMapPunch.last_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedMapPunch(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-all cursor-pointer border-0 outline-none"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto">
              {/* Punch info banner */}
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800 text-xs">
                <div>
                  <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 block">Punch Time</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{formatPunchTime(selectedMapPunch.punch_time)}</span>
                </div>
                <div>
                  <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 block">Source / Direction</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 font-sans">{selectedMapPunch.source || 'BULK'} ({selectedMapPunch.direction || 'IN'})</span>
                </div>
              </div>

              {/* Location Address string */}
              {selectedMapPunch.location_name && (
                <div className="p-3.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40">
                  <span className="text-[9.5px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 block mb-1">
                    Verified Address
                  </span>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-relaxed font-sans">
                    {selectedMapPunch.location_name}
                  </p>
                </div>
              )}

              {/* Map iFrame or Coordinates */}
              {selectedMapPunch.latitude && selectedMapPunch.longitude ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono px-1">
                    <span>Lat: <strong>{selectedMapPunch.latitude}</strong></span>
                    <span>Long: <strong>{selectedMapPunch.longitude}</strong></span>
                  </div>
                  <div className="w-full h-64 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-inner bg-slate-100 dark:bg-slate-900 relative">
                    <iframe
                      title="Punch Location Map"
                      width="100%"
                      height="100%"
                      frameBorder="0"
                      scrolling="no"
                      marginHeight={0}
                      marginWidth={0}
                      src={`https://maps.google.com/maps?q=${selectedMapPunch.latitude},${selectedMapPunch.longitude}&z=15&output=embed`}
                      className="w-full h-full"
                    />
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/30 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                  <span className="text-3xl block mb-2">📟</span>
                  <p className="text-xs font-black text-slate-700 dark:text-slate-300">Bio-Metric Punch</p>
                  <p className="text-[10.5px] text-slate-400 dark:text-slate-500 font-medium mt-1">
                    GPS Coordinates not captured for physical biometric terminal punch.
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between">
              {selectedMapPunch.latitude && selectedMapPunch.longitude ? (
                <a
                  href={`https://www.google.com/maps?q=${selectedMapPunch.latitude},${selectedMapPunch.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-2xs"
                >
                  <span>🌐</span> Open in Google Maps
                </a>
              ) : <div />}

              <button
                onClick={() => setSelectedMapPunch(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-650 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/40 transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
