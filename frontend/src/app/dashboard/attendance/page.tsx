'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import DashboardPageHeader from '../components/DashboardPageHeader';
import { getHeaders, API_BASE } from '../utils/api';
import SlideDrawer from '../components/SlideDrawer';
import { useDashboard } from '../components/DashboardContext';
import SearchableSelect from '../components/SearchableSelect';
import CustomDatePicker from '../components/CustomDatePicker';
import { usePermissions } from '../hooks/usePermissions';
import AttendanceSubHeader from '../components/AttendanceSubHeader';
import { Download, FileSpreadsheet, Calendar, Upload } from 'lucide-react';
import { getDeviceIdentifier, getDeviceModel } from '../utils/deviceUtils';

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
  email: string;
  company_id?: string;
  department_id?: string;
  department_name?: string;
  designation_name?: string;
  reporting_to_id?: string;
  reporting_to?: string;
}

// Tab definitions with permission keys
const ATTENDANCE_TABS = [
  { id: 'policies',        label: 'Attendance Rules',         permission: 'view_attendance_policies' },
  { id: 'punches',         label: 'Attendance Logs',           permission: 'view_punch_records' },
  { id: 'logs',            label: 'Attendance',                permission: 'view_attendance_summary' },
  { id: 'regularizations', label: 'Regularization',           permission: 'view_attendance_regularizations' },
  { id: 'permissions',     label: 'Permission',               permission: 'view_permission_requests' },
] as const;

type AttendanceTabId = typeof ATTENDANCE_TABS[number]['id'];

export default function AttendancePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const { showToast, companyId: ctxCompanyId } = useDashboard();
  const { hasPermission, getPermissionScope, isSuperAdmin } = usePermissions();
  const attendanceScope = getPermissionScope('attendance_view') || getPermissionScope('attendance_summary_view');
  const isSelfScope = !isSuperAdmin && attendanceScope === 'SELF';
  const isTeamScope = !isSuperAdmin && (attendanceScope === 'TEAM' || attendanceScope === 'REPORTING');
  const isDeptScope = !isSuperAdmin && attendanceScope === 'DEPARTMENT';
  const canCreateAttendance = isSuperAdmin || hasPermission('attendance_raw_punches_create');

  // Quick Action / Application Permissions for Off-canvas Drawer
  const canApplyLeave = isSuperAdmin || hasPermission('leave_requests_create') || hasPermission('leave_request_create');
  const canApplyRegularization = isSuperAdmin || hasPermission('attendance_regularizations_create');
  const canApplyPermission = isSuperAdmin || hasPermission('permission_requests_create');
  const canShowQuickActions = canApplyLeave || canApplyRegularization || canApplyPermission;

  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const activeCompanyId = ctxCompanyId || companyId;

  const currentUserEmail = (typeof window !== 'undefined' ? localStorage.getItem('email') : email) || email || '';
  const currentEmp = employees.find(e => e.email?.toLowerCase() === currentUserEmail.toLowerCase());

  // Compute scoped employees list for dropdown filter
  const scopedEmployees = React.useMemo(() => {
    if (isSuperAdmin || attendanceScope === 'ALL') {
      return employees;
    }
    if (!currentEmp) {
      return employees;
    }
    if (isSelfScope) {
      return [currentEmp];
    }
    if (isTeamScope) {
      return employees.filter(e =>
        e.id === currentEmp.id ||
        (e as any).reporting_to_id === currentEmp.id ||
        (e as any).reporting_to === currentEmp.id
      );
    }
    if (isDeptScope) {
      return employees.filter(e =>
        e.id === currentEmp.id ||
        (e.department_id && currentEmp.department_id && e.department_id === currentEmp.department_id) ||
        (e.department_name && currentEmp.department_name && e.department_name.toLowerCase() === currentEmp.department_name.toLowerCase())
      );
    }
    return employees;
  }, [employees, isSuperAdmin, attendanceScope, isSelfScope, isTeamScope, isDeptScope, currentEmp]);

  // Set initial employee selection to current logged-in employee for Self, Team, and Department scopes
  useEffect(() => {
    if (currentEmp?.id) {
      if (isSelfScope || isTeamScope || isDeptScope) {
        setFilterEmployee(currentEmp.id);
      }
    }
  }, [currentEmp?.id, isSelfScope, isTeamScope, isDeptScope]);

  // Tab state — default to logs
  const [activeTab, setActiveTab] = useState<AttendanceTabId>('logs');

  // Shifts (for selection in forms)
  const [shifts, setShifts] = useState<any[]>([]);

  const [isExporting, setIsExporting] = useState(false);
  const todayStr = new Date().toLocaleDateString('en-CA');

  // 📅 Calendar View State for Non-SuperAdmin & Employee Roles
  const [viewMode, setViewMode] = useState<'calendar' | 'table'>('calendar');
  const [calYear, setCalYear] = useState<number>(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState<number>(new Date().getMonth());
  const [selectedDayLog, setSelectedDayLog] = useState<any | null>(null);
  const [dayDetailModalOpen, setDayDetailModalOpen] = useState(false);
  const [holidaysList, setHolidaysList] = useState<any[]>([]);
  const [leaveRequestsList, setLeaveRequestsList] = useState<any[]>([]);
  const [weekoffPolicy, setWeekoffPolicy] = useState<any>(null);

  const isDynamicWeekoff = (dateObj: Date) => {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayIndex = dateObj.getDay();
    const dayName = dayNames[dayIndex];
    const dayNum = dateObj.getDate();
    const weekIndex = Math.ceil(dayNum / 7);

    if (!weekoffPolicy) {
      if (dayIndex === 0) return true;
      if (dayIndex === 6 && (weekIndex === 2 || weekIndex === 4)) return true;
      return false;
    }

    const rawOffDays = weekoffPolicy.off_days || [];
    const offDays: string[] = typeof rawOffDays === 'string'
      ? JSON.parse(rawOffDays)
      : (Array.isArray(rawOffDays) ? rawOffDays : []);

    const rawAltRules = weekoffPolicy.alternate_rules || {};
    const altRules = typeof rawAltRules === 'string'
      ? JSON.parse(rawAltRules)
      : (rawAltRules || {});

    const isOffConfigured = offDays.some((d: any) => {
      if (typeof d === 'string') return d.toLowerCase() === dayName.toLowerCase();
      if (typeof d === 'number') return d === dayIndex;
      return false;
    });

    if (!isOffConfigured) return false;

    const activeWeeks = altRules[dayName] || altRules[dayName.toLowerCase()] || altRules[dayIndex];
    if (Array.isArray(activeWeeks) && activeWeeks.length > 0) {
      return activeWeeks.includes(weekIndex);
    }

    return true;
  };

  // 📸 Web Punch / Mark Attendance Modal State
  const [punchModalOpen, setPunchModalOpen] = useState(false);
  const [punchDirection, setPunchDirection] = useState<'IN' | 'OUT'>('IN');
  const [punchLat, setPunchLat] = useState<number | null>(null);
  const [punchLng, setPunchLng] = useState<number | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [capturedSelfie, setCapturedSelfie] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isSubmittingPunch, setIsSubmittingPunch] = useState(false);
  const [punchMessage, setPunchMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchAddressName = async (lat: number, lng: number) => {
    try {
      setLocationName('Locating address...');
      const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyCN9htaexjSDWMVybqWtlSl1ygNpZWkobg';
      if (googleApiKey) {
        const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googleApiKey}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.results && data.results.length > 0) {
            setLocationName(data.results[0].formatted_address);
            return;
          }
        }
      }
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=en`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.display_name) {
          setLocationName(data.display_name);
          return;
        }
      }
    } catch (e) {
      console.warn('Reverse geocode error:', e);
    }
    setLocationName(`Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`);
  };

  const startCamera = async () => {
    try {
      setCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setGpsError('Could not access webcam for selfie verification.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const captureSelfie = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedSelfie(dataUrl);
        stopCamera();
      }
    }
  };

  const fetchIPLocationFallback = async () => {
    try {
      const res = await fetch('https://ipapi.co/json/');
      if (res.ok) {
        const data = await res.json();
        if (data && data.latitude && data.longitude) {
          setPunchLat(data.latitude);
          setPunchLng(data.longitude);
          const cityState = [data.city, data.region, data.country_name].filter(Boolean).join(', ');
          setLocationName(cityState || 'Location Detected (Network)');
          setGpsError(null);
          return true;
        }
      }
    } catch (e) {
      // Ignore network errors silently
    }
    return false;
  };

  const getGPSLocation = () => {
    setGpsLoading(true);
    setGpsError(null);
    setLocationName('Detecting live location...');

    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPunchLat(pos.coords.latitude);
          setPunchLng(pos.coords.longitude);
          fetchAddressName(pos.coords.latitude, pos.coords.longitude);
          setGpsLoading(false);
        },
        async () => {
          // Silently fallback to IP location on permission denied or error
          const success = await fetchIPLocationFallback();
          if (!success) {
            setGpsError('Unable to retrieve location. Check browser permissions.');
          }
          setGpsLoading(false);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      fetchIPLocationFallback().then((success) => {
        if (!success) {
          setGpsError('Geolocation is not supported by your browser.');
        }
        setGpsLoading(false);
      });
    }
  };

  const submitWebPunch = async () => {
    setIsSubmittingPunch(true);
    setPunchMessage(null);
    try {
      const storedEmpId = localStorage.getItem('employeeId');
      const targetEmpId = storedEmpId || (employees.length > 0 ? employees[0].id : '');
      const d = new Date();
      const tzOffset = -d.getTimezoneOffset();
      const diff = tzOffset >= 0 ? '+' : '-';
      const pad = (num: number) => String(Math.floor(Math.abs(num))).padStart(2, '0');
      const localIso = d.getFullYear() +
        '-' + pad(d.getMonth() + 1) +
        '-' + pad(d.getDate()) +
        'T' + pad(d.getHours()) +
        ':' + pad(d.getMinutes()) +
        ':' + pad(d.getSeconds()) +
        diff + pad(tzOffset / 60) + ':' + pad(tzOffset % 60);

      const isMobileDevice = typeof window !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
      const punchSource = isMobileDevice ? 'MOBILE' : 'WEB';

      if (!isMobileDevice && policyForm?.allow_web_punch === false) {
        setPunchMessage({ type: 'error', text: 'Web portal clock-in is disabled by company policy. Please use Mobile App or Biometric device.' });
        setIsSubmittingPunch(false);
        return;
      }

      if (isMobileDevice && policyForm?.allow_mobile_punch === false) {
        setPunchMessage({ type: 'error', text: 'Mobile clock-in is disabled by company policy. Please use Web Portal or Biometric device.' });
        setIsSubmittingPunch(false);
        return;
      }

      if (policyForm?.require_selfie && !capturedSelfie) {
        setPunchMessage({ type: 'error', text: 'Selfie photo verification is mandatory as per company attendance rules.' });
        setIsSubmittingPunch(false);
        return;
      }

      if (policyForm?.require_gps && (!punchLat || !punchLng)) {
        setPunchMessage({ type: 'error', text: 'GPS Location verification is mandatory as per company attendance rules.' });
        setIsSubmittingPunch(false);
        return;
      }

      const cid = localStorage.getItem('companyId') || companyId;

      const body = {
        companyId: cid,
        employee_id: targetEmpId,
        punch_time: localIso,
        direction: punchDirection,
        source: punchSource,
        latitude: punchLat,
        longitude: punchLng,
        image_url: capturedSelfie,
        location_name: locationName,
        device_identifier: getDeviceIdentifier(),
        device_model: getDeviceModel()
      };

      const res = await fetch('/api/v1/attendance/punches', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (res.ok) {
        setPunchMessage({ type: 'success', text: `Punch ${punchDirection} recorded successfully!` });
        stopCamera();
        setTimeout(() => {
          setPunchModalOpen(false);
          fetchLogs();
        }, 1200);
      } else {
        setPunchMessage({ type: 'error', text: data.error || 'Failed to submit punch.' });
      }
    } catch (e: any) {
      setPunchMessage({ type: 'error', text: e.message || 'Error submitting punch.' });
    } finally {
      setIsSubmittingPunch(false);
    }
  };

  // Logs state
  const [logs, setLogs] = useState<any[]>([]);
  const [isLogsLoading, setIsLogsLoading] = useState(false);
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

  // Filter tabs based on user permissions
  const visibleTabs = ATTENDANCE_TABS.filter(t => hasPermission(t.permission));

  // Auto-correct activeTab if it's no longer visible
  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.find(t => t.id === activeTab)) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [visibleTabs.map(t => t.id).join(',')]);

  useEffect(() => {
    const storedRoles = JSON.parse(localStorage.getItem('roles') || '[]');
    const storedEmail = localStorage.getItem('email');
    const storedCompanyId = localStorage.getItem('companyId');
    if (storedRoles) setRoles(storedRoles);
    if (storedEmail) setEmail(storedEmail);
    if (storedCompanyId) setCompanyId(storedCompanyId);
    
    // Set default viewMode based on role
    const adminCheck = storedRoles.includes('SuperAdmin') || storedRoles.includes('superadmin');
    if (!adminCheck) {
      setViewMode('calendar');
    }
  }, []);

  // 🗓️ Sync Calendar Month with API Date Range
  useEffect(() => {
    if (viewMode === 'calendar') {
      const lastDay = new Date(calYear, calMonth + 1, 0).getDate();
      const startStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-01`;
      const endStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      setFilterDateStart(startStr);
      setFilterDateEnd(endStr);
    }
  }, [calYear, calMonth, viewMode]);

  useEffect(() => {
    if (viewMode === 'calendar' && filterDateStart && filterDateEnd) {
      fetchLogs();
    }
  }, [filterDateStart, filterDateEnd, filterEmployee, viewMode]);

  const handlePrevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear(prev => prev - 1);
    } else {
      setCalMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    const now = new Date();
    if (calYear > now.getFullYear() || (calYear === now.getFullYear() && calMonth >= now.getMonth())) {
      return; // Cannot navigate to future months
    }
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear(prev => prev + 1);
    } else {
      setCalMonth(prev => prev + 1);
    }
  };

  const handleTodayMonth = () => {
    setCalYear(new Date().getFullYear());
    setCalMonth(new Date().getMonth());
  };

  const fetchHolidaysAndLeaves = async () => {
    try {
      const isSuper = roles.includes('SuperAdmin') || roles.includes('superadmin');
      const cid = isSuper ? companyId : localStorage.getItem('companyId');
      const queryParam = cid && cid !== 'all' ? `?companyId=${cid}` : '';
      
      const holRes = await fetch(`/api/v1/holidays${queryParam}`, { headers: getHeaders() });
      if (holRes.ok) {
        const holData = await holRes.json();
        setHolidaysList(holData.holidays || []);
      }

      const leaveRes = await fetch(`/api/v1/leave-requests${queryParam}`, { headers: getHeaders() });
      if (leaveRes.ok) {
        const leaveData = await leaveRes.json();
        setLeaveRequestsList(leaveData.leaveRequests || []);
      }

      const weekoffRes = await fetch(`/api/v1/weekoffs${queryParam}`, { headers: getHeaders() });
      if (weekoffRes.ok) {
        const wData = await weekoffRes.json();
        const policyObj = wData.weekoff || wData.policy || (Array.isArray(wData.weekoffs) ? wData.weekoffs[0] : null);
        setWeekoffPolicy(policyObj || null);
      }
    } catch (e) {
      console.error('Error fetching holidays/leaves for calendar:', e);
    }
  };

  useEffect(() => {
    fetchHolidaysAndLeaves();
  }, [companyId, calYear, calMonth]);

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
        ? `/api/v1/shifts?companyId=${companyId}`
        : '/api/v1/shifts';
      const res = await fetch(url, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) setShifts(data.shifts || []);
    } catch (e) { console.error(e); }
  };

  const fetchEmployees = async () => {
    try {
      const cid = activeCompanyId || localStorage.getItem('companyId');
      const url = cid && cid !== 'all'
        ? `/api/v1/employees?companyId=${cid}&module=attendance`
        : '/api/v1/employees?module=attendance';
      const res = await fetch(url, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        const emps = data.employees || [];
        setEmployees(emps);
        if (emps.length === 1) {
          setFilterEmployee(emps[0].id);
        }
      }
    } catch (e) { console.error(e); }
  };

  const fetchLogs = async () => {
    setIsLogsLoading(true);
    try {
      const cid = activeCompanyId || localStorage.getItem('companyId');
      let url = cid && cid !== 'all'
        ? `/api/v1/attendance/summary?companyId=${cid}`
        : '/api/v1/attendance/summary';
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
    } finally {
      setIsLogsLoading(false);
    }
  };

  const fetchPunches = async () => {
    try {
      const cid = activeCompanyId || localStorage.getItem('companyId');
      const url = cid && cid !== 'all'
        ? `/api/v1/attendance/punches?companyId=${cid}`
        : '/api/v1/attendance/punches';
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
    const targetCid = activeCompanyId || (typeof window !== 'undefined' ? localStorage.getItem('companyId') : null) || companyId;
    if (!targetCid) {
      setPolicy(null);
      if (isSuperAdmin) {
        try {
          const res = await fetch('/api/v1/attendance/policies', {
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
      const res = await fetch(`/api/v1/attendance/policies?companyId=${targetCid}`, {
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
          allow_mobile_punch: data.policy.allow_mobile_punch !== undefined && data.policy.allow_mobile_punch !== null ? !!data.policy.allow_mobile_punch : true,
          allow_web_punch: data.policy.allow_web_punch !== undefined && data.policy.allow_web_punch !== null ? !!data.policy.allow_web_punch : true,
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
        ? `/api/v1/attendance/regularizations?companyId=${companyId}`
        : '/api/v1/attendance/regularizations';
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
        ? `/api/v1/attendance/permissions?companyId=${companyId}`
        : '/api/v1/attendance/permissions';
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
      const res = await fetch('/api/v1/companies', { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) setCompanies(data.companies || []);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (isSuperAdmin) fetchCompanies();
  }, [companyId, isSuperAdmin]);

  useEffect(() => {
    fetchShifts();
    fetchEmployees();
    fetchPolicy();
    if (activeTab === 'logs') fetchLogs();
    if (activeTab === 'punches') fetchPunches();
    if (activeTab === 'regularizations') fetchRegularizations();
    if (activeTab === 'permissions') fetchPermissions();
  }, [activeCompanyId, activeTab, isSuperAdmin]);

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
        ? `/api/v1/attendance/summary/${logForm.id}`
        : '/api/v1/attendance/summary';

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
      const res = await fetch(`/api/v1/attendance/summary/${id}`, {
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

      const res = await fetch('/api/v1/attendance/punches', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          companyId: targetCompanyId,
          employee_id: punchForm.employee_id,
          direction: punchForm.direction,
          source: punchForm.source,
          punch_time: `${punchForm.simDate} ${punchForm.simTime}:00`,
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
      const res = await fetch('/api/v1/attendance/policies', {
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
      const res = await fetch(`/api/v1/attendance/regularizations/${selectedReq.id}/action`, {
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
      const res = await fetch(`/api/v1/attendance/permissions/${selectedPerm.id}/action`, {
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
      const punchDateStr = String(p.punch_time || '').split(' ')[0].split('T')[0];
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
    let iso = String(timeStr).trim();
    if (!iso.includes('T') && iso.includes(' ')) {
      iso = iso.replace(' ', 'T');
    }
    const d = new Date(iso);
    if (isNaN(d.getTime())) return timeStr;
    return d.toLocaleString([], {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  const formatTimeOnly = (timeStr: string) => {
    if (!timeStr) return '-';
    let iso = String(timeStr).trim();
    if (!iso.includes('T') && iso.includes(' ')) {
      iso = iso.replace(' ', 'T');
    }
    const d = new Date(iso);
    if (isNaN(d.getTime())) return timeStr;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const str = String(dateStr).split(' ')[0].split('T')[0];
    const parts = str.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = String(parseInt(parts[2], 10)).padStart(2, '0');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${day}-${months[monthIdx] || 'Jan'}-${year}`;
    }
    return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
  };

  const formatLateMinutes = (mins: number) => {
    if (!mins || mins <= 0) return null;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    if (hours > 0) {
      return `+${hours}h ${remainingMins}m Late`;
    }
    return `+${remainingMins}m Late`;
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const renderCalendarView = () => {
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const firstDayIndex = new Date(calYear, calMonth, 1).getDay();

    // Statistics calculation for current month
    let presentCount = 0;
    let halfDayCount = 0;
    let weekOffCount = 0;
    let holidayCount = 0;
    let leaveCount = 0;
    let absentCount = 0;
    let totalWorkedMinutes = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const isWO = isDynamicWeekoff(new Date(calYear, calMonth, d));
      if (isWO) weekOffCount++;
    }

    logs.forEach(l => {
      const st = String(l.status || '').toUpperCase();
      if (st === 'PRESENT') presentCount++;
      else if (st === 'HALF_DAY') halfDayCount++;
      else if (st === 'ON_LEAVE') leaveCount++;
      else if (st === 'HOLIDAY') holidayCount++;
      else if (st === 'ABSENT') absentCount++;
      if (l.worked_minutes) totalWorkedMinutes += Number(l.worked_minutes);
    });

    // Check holiday list count for month
    holidayCount = Math.max(holidayCount, holidaysList.length);
    leaveCount = Math.max(leaveCount, leaveRequestsList.length);

    const totalWorkedHours = (totalWorkedMinutes / 60).toFixed(1);
    const targetMonthlyHours = Math.max(160, Math.round((daysInMonth - weekOffCount - holidayCount) * 8));

    // Today's log & focus stats
    const todayLog = logs.find(l => {
      if (!l.attendance_date) return false;
      const raw = String(l.attendance_date).split('T')[0].split(' ')[0];
      return raw === todayStr;
    });

    const isTodayPresent = todayLog && (todayLog.first_in || todayLog.status === 'PRESENT' || todayLog.status === 'HALF_DAY');
    const todayCheckInTime = todayLog?.first_in ? formatTimeOnly(todayLog.first_in) : null;
    const todayWorkedMins = todayLog?.worked_minutes || 0;
    const todayWorkedHours = (todayWorkedMins / 60).toFixed(1);
    const dailyGoalHours = 8.0;
    const dailyProgressPercent = Math.min(100, Math.round((todayWorkedMins / 480) * 100));

    const daysArray: (number | null)[] = [];
    for (let i = 0; i < firstDayIndex; i++) daysArray.push(null);
    for (let d = 1; d <= daysInMonth; d++) daysArray.push(d);

    return (
      <div className="space-y-5 animate-fadeIn font-sans">
        {/* TOP HEADER BAR */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          {/* Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-xl border border-emerald-500/20 shadow-2xs">
              👊
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                Punch History
              </h2>
              <p className="text-xs text-slate-500 font-medium">Monthly punch tracking & interactive calendar</p>
            </div>
          </div>

          {/* Action Controls */}
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {!isSelfScope && (
              <div className="w-52">
                <SearchableSelect
                  options={scopedEmployees.map(emp => ({
                    value: emp.id,
                    label: `${emp.emp_id_code} - ${emp.first_name} ${emp.last_name}`
                  }))}
                  value={filterEmployee}
                  onChange={val => setFilterEmployee(val)}
                  placeholder={isTeamScope || isDeptScope ? "Select Employee" : "-- All Employees --"}
                />
              </div>
            )}

            {/* Export Excel Button */}
            <button
              onClick={handleExportExcel}
              disabled={isExporting}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              {isExporting ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Export</span>
                </>
              )}
            </button>

            {/* Mark Attendance Button */}
            {canCreateAttendance && (
              <button
                type="button"
                onClick={() => {
                  setPunchModalOpen(true);
                  getGPSLocation();
                  if (policyForm?.require_selfie) {
                    startCamera();
                  }
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center gap-2"
              >
                <span>📸</span> Mark Attendance
              </button>
            )}
          </div>
        </div>

        {/* MAIN 3-COLUMN DASHBOARD GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* LEFT COLUMN: Full-Width Single Cards (3 cols on lg/xl) */}
          <div className="lg:col-span-3 space-y-3">
            
            {/* Total Present Card */}
            <div className="w-full bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-xs flex items-center justify-between hover:border-emerald-300 transition-all">
              <div>
                <p className="text-xs text-slate-500 font-bold">Total Present</p>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-2xl font-black text-emerald-600">{presentCount}</span>
                  <span className="text-xs font-bold text-slate-400">Days</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-2xs">
                <Calendar className="w-5 h-5" />
              </div>
            </div>

            {/* Total Half Days Card */}
            <div className="w-full bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-xs flex items-center justify-between hover:border-amber-300 transition-all">
              <div>
                <p className="text-xs text-slate-500 font-bold">Total Half Days</p>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-2xl font-black text-amber-500">{halfDayCount}</span>
                  <span className="text-xs font-bold text-slate-400">Days</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 shadow-2xs">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
            </div>

            {/* Total Holidays Card */}
            <div className="w-full bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-xs flex items-center justify-between hover:border-orange-300 transition-all">
              <div>
                <p className="text-xs text-slate-500 font-bold">Total Holidays</p>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-2xl font-black text-orange-600">{holidayCount}</span>
                  <span className="text-xs font-bold text-slate-400">Days</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-100 text-lg shadow-2xs">
                🎉
              </div>
            </div>

            {/* Total Leaves Card */}
            <div className="w-full bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-xs flex items-center justify-between hover:border-indigo-300 transition-all">
              <div>
                <p className="text-xs text-slate-500 font-bold">Total Leaves</p>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-2xl font-black text-indigo-600">{leaveCount}</span>
                  <span className="text-xs font-bold text-slate-400">Days</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 text-lg shadow-2xs">
                🏖️
              </div>
            </div>

            {/* Total Week Off Card */}
            <div className="w-full bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-xs flex items-center justify-between hover:border-purple-300 transition-all">
              <div>
                <p className="text-xs text-slate-500 font-bold">Total Week Off</p>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-2xl font-black text-purple-600">{weekOffCount}</span>
                  <span className="text-xs font-bold text-slate-400">Days</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100 shadow-2xs">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3M3 11v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5M18 11v8M6 11v8" />
                </svg>
              </div>
            </div>

            {/* Hours This Month Card */}
            <div className="w-full bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-xs space-y-2 hover:border-emerald-300 transition-all">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 font-bold">Hours This Month</p>
                <span className="text-xs">⏱️</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-emerald-600">{totalWorkedHours}</span>
                <span className="text-xs font-bold text-slate-400">/ {targetMonthlyHours} hrs</span>
              </div>
              <div className="pt-1">
                <svg className="w-full h-7 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 100 25">
                  <path d="M0 20 Q 15 15, 25 18 T 50 10 T 75 14 T 100 5" strokeLinecap="round" />
                </svg>
              </div>
            </div>

          </div>

          {/* CENTER COLUMN: Calendar Monthly Grid (6 cols on lg/xl) */}
          <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
            
            {/* Center Header: Month Navigator */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-1 bg-slate-50 p-1.5 rounded-xl border border-slate-200/80 shadow-2xs">
                <button
                  onClick={handlePrevMonth}
                  className="w-7 h-7 rounded-lg hover:bg-white text-slate-700 font-extrabold flex items-center justify-center transition-all cursor-pointer hover:shadow-2xs text-sm"
                  title="Previous Month"
                >
                  ‹
                </button>
                <span className="px-3 text-xs font-bold text-slate-800 min-w-[120px] text-center">
                  📅 {monthNames[calMonth]} {calYear}
                </span>
                <button
                  onClick={handleNextMonth}
                  disabled={calYear > new Date().getFullYear() || (calYear === new Date().getFullYear() && calMonth >= new Date().getMonth())}
                  className={`w-7 h-7 rounded-lg font-extrabold flex items-center justify-center transition-all text-sm ${
                    (calYear > new Date().getFullYear() || (calYear === new Date().getFullYear() && calMonth >= new Date().getMonth()))
                      ? 'opacity-25 cursor-not-allowed text-slate-300'
                      : 'hover:bg-white text-slate-700 cursor-pointer hover:shadow-2xs'
                  }`}
                  title={(calYear > new Date().getFullYear() || (calYear === new Date().getFullYear() && calMonth >= new Date().getMonth())) ? "Future months disabled" : "Next Month"}
                >
                  ›
                </button>
              </div>
            </div>

            {/* Days Grid Container */}
            <div className="w-full relative min-h-[380px]">
              {isLogsLoading && (
                <div className="absolute inset-0 z-20 bg-white/80 backdrop-blur-xs flex flex-col items-center justify-center p-8 transition-all">
                  <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="mt-2.5 text-xs font-bold text-slate-600">
                    Loading Attendance Logs...
                  </span>
                </div>
              )}

              {/* Grid Header SUN MON TUE WED THU FRI SAT */}
              <div className="grid grid-cols-7 text-center pb-2.5 border-b border-slate-100">
                {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((dName, i) => (
                  <span key={dName} className={`text-[11px] font-extrabold tracking-wider ${i === 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                    {dName}
                  </span>
                ))}
              </div>

              {/* Days Cells Grid */}
              <div className="grid grid-cols-7 gap-2 pt-2.5">
                {daysArray.map((dayNum, idx) => {
                  if (dayNum === null) {
                    return <div key={`empty-${idx}`} className="h-20 rounded-xl bg-slate-50/40" />;
                  }

                  const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                  
                  const dayLog = logs.find(l => {
                    if (!l.attendance_date) return false;
                    const raw = String(l.attendance_date).split('T')[0].split(' ')[0];
                    return raw === dateStr;
                  });

                  const matchedHoliday = holidaysList.find(h => {
                    const raw = String(h.holiday_date || h.date || h.from_date || '');
                    if (!raw) return false;
                    return raw.split('T')[0].split(' ')[0] === dateStr;
                  });

                  const matchedLeave = leaveRequestsList.find(lr => {
                    const statusUpper = String(lr.status || '').toUpperCase();
                    if (statusUpper !== 'APPROVED' && statusUpper !== 'PENDING') return false;
                    const fDate = String(lr.start_date || lr.from_date || '').split('T')[0].split(' ')[0];
                    const tDate = String(lr.end_date || lr.to_date || fDate).split('T')[0].split(' ')[0];
                    return dateStr >= fDate && dateStr <= tDate;
                  });

                  const isToday = dateStr === todayStr;
                  const isFuture = dateStr > todayStr;
                  const isWeekOff = isDynamicWeekoff(new Date(calYear, calMonth, dayNum));
                  
                  let statusBadge = '';
                  let statusBadgeStyle = 'bg-slate-100 text-slate-500';
                  let dotColor = 'bg-slate-300';
                  let hoursLabel = '--';
                  let cellBg = 'bg-slate-50/60 border-slate-200/70 hover:border-slate-300';
                  
                  if (isFuture) {
                    statusBadge = '';
                    hoursLabel = '--';
                    dotColor = 'bg-slate-200';
                    cellBg = 'bg-slate-50/20 border-slate-100';
                  } else if (dayLog && (dayLog.first_in || dayLog.status === 'PRESENT' || dayLog.status === 'HALF_DAY')) {
                    if (dayLog.worked_minutes > 0) {
                      const hrs = (dayLog.worked_minutes / 60).toFixed(1);
                      hoursLabel = `${hrs}h`;
                    } else {
                      hoursLabel = '8.0h';
                    }

                    if (dayLog.status === 'HALF_DAY') {
                      statusBadge = 'HD';
                      statusBadgeStyle = 'bg-amber-100 text-amber-700 font-extrabold';
                      dotColor = 'bg-amber-500';
                      cellBg = 'bg-amber-50/30 border-amber-200 hover:border-amber-400';
                    } else {
                      statusBadge = 'P';
                      statusBadgeStyle = 'bg-emerald-100 text-emerald-700 font-extrabold';
                      dotColor = 'bg-emerald-500';
                      cellBg = 'bg-emerald-50/20 border-emerald-200 hover:border-emerald-400';
                    }
                  } else if (matchedLeave) {
                    const lCode = matchedLeave.leave_type_code || matchedLeave.leave_type || 'L';
                    statusBadge = lCode;
                    statusBadgeStyle = 'bg-indigo-100 text-indigo-700 font-extrabold';
                    hoursLabel = 'Leave';
                    dotColor = 'bg-indigo-500';
                    cellBg = 'bg-indigo-50/30 border-indigo-200 hover:border-indigo-400';
                  } else if (matchedHoliday) {
                    statusBadge = 'H';
                    statusBadgeStyle = 'bg-orange-100 text-orange-700 font-extrabold';
                    hoursLabel = matchedHoliday?.title || 'Holiday';
                    dotColor = 'bg-orange-500';
                    cellBg = 'bg-orange-50/30 border-orange-200 hover:border-orange-400';
                  } else if (isWeekOff) {
                    statusBadge = 'WO';
                    statusBadgeStyle = 'bg-purple-100 text-purple-700 font-extrabold';
                    hoursLabel = 'WO';
                    dotColor = 'bg-purple-400';
                    cellBg = 'bg-purple-50/30 border-purple-200 hover:border-purple-400';
                  } else if (dayLog && dayLog.status === 'ABSENT') {
                    statusBadge = 'A';
                    statusBadgeStyle = 'bg-rose-100 text-rose-700 font-extrabold';
                    hoursLabel = '--';
                    dotColor = 'bg-rose-400';
                    cellBg = 'bg-rose-50/30 border-rose-200 hover:border-rose-400';
                  }

                  const cellPayload = dayLog || {
                    attendance_date: dateStr,
                    holiday: matchedHoliday,
                    leave: matchedLeave
                  };

                  return (
                    <div
                      key={`day-${dayNum}`}
                      onClick={() => {
                        if (isFuture) return;
                        setSelectedDayLog(cellPayload);
                        setDayDetailModalOpen(true);
                      }}
                      className={`h-20 rounded-xl p-2.5 border flex flex-col justify-between transition-all duration-200 ${
                        isFuture
                          ? 'opacity-30 bg-slate-100/40 border-dashed border-slate-200/80 cursor-not-allowed select-none'
                          : `cursor-pointer hover:shadow-md group ${cellBg}`
                      } ${
                        isToday ? 'border-2 border-cyan-500 bg-cyan-50/40 ring-2 ring-cyan-400/20 shadow-xs' : ''
                      }`}
                    >
                      {/* Top Row: Day Number & Status Badge */}
                      <div className="flex items-center justify-between">
                        <span className={`text-xs ${isToday ? 'text-cyan-800 font-black' : 'text-slate-800 font-bold'}`}>
                          {dayNum}
                        </span>
                        
                        <div className="flex items-center gap-1">
                          {isToday && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-cyan-500 text-white leading-none shadow-2xs animate-pulse">
                              TODAY
                            </span>
                          )}
                          {statusBadge && !isToday && (
                            <span className={`text-[9.5px] px-1.5 py-0.5 rounded-md leading-none ${statusBadgeStyle}`}>
                              {statusBadge}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Bottom Row: Dot & Hours/Status text */}
                      <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-slate-700 truncate">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
                        <span className="truncate">{hoursLabel}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Color Legend Bar at Bottom */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 font-medium flex-wrap gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Present (8.0h)
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-100 font-bold text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-amber-500" /> Half Day (4.0h)
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" /> Leaves
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-50 text-orange-700 border border-orange-100 font-bold text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-orange-500" /> Holidays
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-100 font-bold text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-purple-500" /> Week Off
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-100 font-bold text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-rose-500" /> Absent
                </span>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Today's Focus & Quick Actions (3 cols on lg/xl) */}
          <div className="lg:col-span-3 space-y-4">
            
            {/* Card 1: Today's Focus & Hours Progress */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4.5 shadow-xs space-y-4">
              
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-amber-500 text-base">⚡</span>
                  <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">Today's Focus</h3>
                </div>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {new Date().toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })}
                </span>
              </div>

              {/* Punch Status Box */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/70 border border-slate-100">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Punch Status</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${isTodayPresent ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    <span className={`text-xs font-extrabold ${isTodayPresent ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {isTodayPresent ? 'Present' : 'Not Checked In'}
                    </span>
                  </div>
                </div>
                {todayCheckInTime && (
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">In Time</p>
                    <p className="text-xs font-extrabold text-slate-700 mt-0.5">{todayCheckInTime}</p>
                  </div>
                )}
              </div>

              {/* Shift Timing Banner */}
              <div className="p-3 rounded-xl bg-indigo-50/40 border border-indigo-100 flex items-center gap-2.5 text-xs text-indigo-900 font-medium">
                <span className="text-indigo-600 text-sm">⏰</span>
                <div>
                  <p className="font-bold text-[11px] text-indigo-950">Shift Timing: 09:00 AM - 06:00 PM</p>
                  <p className="text-[10px] text-indigo-600">Standard 8.0 hrs General Shift</p>
                </div>
              </div>

              {/* Hours Today & Circular Progress */}
              <div className="flex items-center justify-between pt-1">
                <div className="space-y-1">
                  <p className="text-[11px] text-slate-500 font-semibold">Hours Today</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-emerald-600">{todayWorkedHours}</span>
                    <span className="text-xs font-bold text-slate-400">/ {dailyGoalHours} hrs</span>
                  </div>
                  <p className="text-[10.5px] text-slate-400 font-medium">
                    {dailyProgressPercent >= 100 ? '🎉 Goal reached' : 'In progress'}
                  </p>
                </div>

                {/* Gauge */}
                <div className="relative w-16 h-16 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-slate-100"
                      strokeWidth="3.5"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="text-emerald-500"
                      strokeDasharray={`${dailyProgressPercent}, 100`}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <span className="absolute text-[11px] font-black text-emerald-600">
                    {dailyProgressPercent}%
                  </span>
                </div>
              </div>

              {/* View Timeline Action Button */}
              <button
                onClick={() => {
                  if (canCreateAttendance) {
                    setPunchModalOpen(true);
                    getGPSLocation();
                    if (policyForm?.require_selfie) {
                      startCamera();
                    }
                  }
                }}
                className="w-full py-2 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
              >
                <span>View Today's Timeline</span>
                <span>›</span>
              </button>

            </div>

            {/* Card 2: Quick Request Actions */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-2.5">
              <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
                📌 Quick Attendance Tools
              </h4>
              <div className="space-y-2 pt-1">
                <button
                  onClick={() => setActiveTab('regularizations')}
                  className="w-full p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50/60 border border-slate-200/80 text-slate-700 hover:text-emerald-700 text-xs font-bold flex items-center justify-between transition-all cursor-pointer group"
                >
                  <span className="flex items-center gap-2">
                    <span>📝</span> Apply Regularization
                  </span>
                  <span className="text-slate-400 group-hover:translate-x-0.5 transition-transform">›</span>
                </button>

                <button
                  onClick={() => setActiveTab('permissions')}
                  className="w-full p-2.5 rounded-xl bg-slate-50 hover:bg-amber-50/60 border border-slate-200/80 text-slate-700 hover:text-amber-700 text-xs font-bold flex items-center justify-between transition-all cursor-pointer group"
                >
                  <span className="flex items-center gap-2">
                    <span>🎫</span> Request Permission
                  </span>
                  <span className="text-slate-400 group-hover:translate-x-0.5 transition-transform">›</span>
                </button>
              </div>
            </div>

            {/* Card 3: Upcoming Holidays Banner */}
            {holidaysList.length > 0 && (
              <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-200/80 p-3.5 rounded-2xl flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-orange-500 text-white flex items-center justify-center font-bold text-base shadow-xs flex-shrink-0">
                  🎉
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-orange-600 block">Upcoming Holiday</span>
                  <p className="text-xs font-extrabold text-slate-900 mt-0.5">
                    {holidaysList[0]?.title || holidaysList[0]?.holiday_name || 'Festival Holiday'}
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium">
                    {holidaysList[0]?.holiday_date ? formatDisplayDate(holidaysList[0].holiday_date) : 'Scheduled Holiday'}
                  </p>
                </div>
              </div>
            )}

          </div>

        </div>
      </div>
    );
  };

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }} className="attendance-page-container font-['DM_Sans',sans-serif] space-y-6 animate-fadeIn w-full">
      <style dangerouslySetInnerHTML={{__html: `
        .attendance-page-container,
        .attendance-page-container td,
        .attendance-page-container th,
        .attendance-page-container button,
        .attendance-page-container input,
        .attendance-page-container select,
        .attendance-page-container label,
        .attendance-page-container span,
        .attendance-page-container div,
        .attendance-page-container p {
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

      {/* Tab Contents */}
      {activeTab === 'logs' && (
        <div className="space-y-6">
          {renderCalendarView()}
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
      {mounted && selectedMapPunch && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-fadeIn font-sans">
          <div className="bg-card w-full max-w-xl rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-[0_0_80px_rgba(0,0,0,0.5)] overflow-hidden text-left flex flex-col max-h-[90vh] z-[10000]">
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
        </div>,
        document.body
      )}

      {/* 📅 Interactive Day Detail Modal for Calendar Cell Click */}
      {dayDetailModalOpen && selectedDayLog && (
        <SlideDrawer
          isOpen={dayDetailModalOpen}
          onClose={() => setDayDetailModalOpen(false)}
          title={`Attendance Audit — ${formatDisplayDate(selectedDayLog.attendance_date)}`}
          width="max-w-[560px]"
        >
          <div className="space-y-5 animate-fadeIn font-sans">
            {/* Light Soft Header Card */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-50 via-blue-50/50 to-indigo-50/60 dark:from-slate-900 dark:via-slate-900/90 dark:to-slate-800/80 border border-slate-200/80 dark:border-slate-800 shadow-2xs relative overflow-hidden">
              <div className="flex items-center justify-between relative z-10">
                <div>
                  <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest block mb-0.5">
                    Attendance Audit Details
                  </span>
                  <h4 className="text-base font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight font-outfit">
                    {selectedDayLog.first_name ? `${selectedDayLog.first_name} ${selectedDayLog.last_name}` : (selectedDayLog.customLabel || 'Employee Record')}
                  </h4>
                  {selectedDayLog.emp_id_code && (
                    <p className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 mt-1">
                      EMP ID: {selectedDayLog.emp_id_code}
                    </p>
                  )}
                </div>
                <span className={`px-3 py-1.5 rounded-xl text-xs font-extrabold uppercase tracking-wider border ${
                  selectedDayLog.status?.toUpperCase() === 'PRESENT' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900' :
                  selectedDayLog.status?.toUpperCase() === 'ABSENT' ? 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900' :
                  selectedDayLog.status?.toUpperCase() === 'HALF_DAY' ? 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900' :
                  'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                }`}>
                  {String(selectedDayLog.status || '').replace('_', ' ')}
                </span>
              </div>
            </div>

            {/* Time Details Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl border border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-1 shadow-2xs">
                <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                  <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25V9m11.25 0v11.25A2.25 2.25 0 0118 22.5H6a2.25 2.25 0 01-2.25-2.25V9m16.5 0h-16.5" />
                  </svg>
                  <span className="text-[10px] font-black uppercase tracking-wider">Punch In Time</span>
                </div>
                <p className="text-sm font-mono font-black text-slate-800 dark:text-slate-100">
                  {selectedDayLog.first_in ? formatPunchTime(selectedDayLog.first_in) : 'Not Punched In'}
                </p>
              </div>

              <div className="p-4 rounded-2xl border border-rose-200/80 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20 space-y-1 shadow-2xs">
                <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400">
                  <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25V9m11.25 0v11.25A2.25 2.25 0 0118 22.5H6a2.25 2.25 0 01-2.25-2.25V9m16.5 0h-16.5" />
                  </svg>
                  <span className="text-[10px] font-black uppercase tracking-wider">Punch Out Time</span>
                </div>
                <p className="text-sm font-mono font-black text-slate-800 dark:text-slate-100">
                  {selectedDayLog.last_out ? formatPunchTime(selectedDayLog.last_out) : 'Not Punched Out'}
                </p>
              </div>
            </div>

            {/* Shift & Metrics Cards */}
            <div className="space-y-3 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shadow-2xs">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-500 dark:text-slate-400">Assigned Shift:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 px-3 py-1 rounded-lg">
                  {selectedDayLog.shift_name || 'General Shift'}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-500 dark:text-slate-400">Total Worked Duration:</span>
                <span className="font-mono font-black text-slate-800 dark:text-slate-100">
                  ⏱️ {selectedDayLog.worked_minutes ? `${Math.floor(selectedDayLog.worked_minutes / 60)} Hours ${selectedDayLog.worked_minutes % 60} Mins` : '0 Hours 0 Mins'}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-500 dark:text-slate-400">Late Arrival:</span>
                <span className={`font-mono font-black ${selectedDayLog.late_minutes > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {selectedDayLog.late_minutes > 0 ? formatLateMinutes(selectedDayLog.late_minutes) : 'On Time (0 mins)'}
                </span>
              </div>

              {selectedDayLog.customLabel && (
                <div className="flex justify-between items-center text-xs pt-2.5 border-t border-slate-200/60 dark:border-slate-800">
                  <span className="font-semibold text-slate-500 dark:text-slate-400">Calendar Event:</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">
                    {selectedDayLog.customLabel}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center text-xs pt-2.5 border-t border-slate-200/60 dark:border-slate-800">
                <span className="font-semibold text-slate-500 dark:text-slate-400">Regularization Status:</span>
                <span className={`font-bold text-[10.5px] uppercase tracking-wider px-2.5 py-1 rounded-lg ${selectedDayLog.is_regularized ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                  {selectedDayLog.is_regularized ? 'Regularized' : 'Normal'}
                </span>
              </div>
            </div>

            {/* ⚡ Colorful Column Action Buttons Section */}
            {canShowQuickActions && (
              <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Quick Actions / Applications
                  </span>
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200/60 dark:border-blue-900/60">
                    Employee Portal
                  </span>
                </div>

                <div className="flex flex-col gap-2.5">
                  {/* 🌴 Apply Leave Button */}
                  {canApplyLeave && (
                    <button
                      type="button"
                      onClick={() => router.push('/dashboard/leaves/requests')}
                      className="w-full group flex items-center justify-between p-3.5 rounded-xl border border-amber-200/80 dark:border-amber-900/40 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent hover:from-amber-500/20 hover:via-amber-500/10 dark:from-amber-500/20 dark:via-amber-500/10 hover:border-amber-300 dark:hover:border-amber-700/60 transition-all duration-200 shadow-2xs hover:shadow-md cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold text-sm shadow-sm group-hover:scale-105 transition-transform">
                          🌴
                        </div>
                        <div className="text-left">
                          <span className="block text-xs font-black text-amber-950 dark:text-amber-200 uppercase tracking-wide group-hover:text-amber-600 dark:group-hover:text-amber-300 transition-colors font-outfit">
                            Apply Leave
                          </span>
                          <span className="block text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">
                            Request casual, sick or annual leave for this date
                          </span>
                        </div>
                      </div>
                      <span className="p-1.5 rounded-lg bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 group-hover:translate-x-1 transition-transform border border-amber-200/60 dark:border-amber-900/50 shadow-2xs">
                        <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                      </span>
                    </button>
                  )}

                  {/* 📝 Apply Request Button */}
                  {canApplyRegularization && (
                    <button
                      type="button"
                      onClick={() => router.push('/dashboard/attendance/regularization')}
                      className="w-full group flex items-center justify-between p-3.5 rounded-xl border border-indigo-200/80 dark:border-indigo-900/40 bg-gradient-to-r from-indigo-500/10 via-indigo-500/5 to-transparent hover:from-indigo-500/20 hover:via-indigo-500/10 dark:from-indigo-500/20 dark:via-indigo-500/10 hover:border-indigo-300 dark:hover:border-indigo-700/60 transition-all duration-200 shadow-2xs hover:shadow-md cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm group-hover:scale-105 transition-transform">
                          📝
                        </div>
                        <div className="text-left">
                          <span className="block text-xs font-black text-indigo-950 dark:text-indigo-200 uppercase tracking-wide group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors font-outfit">
                            Apply Request
                          </span>
                          <span className="block text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">
                            Submit regularization or work-from-home request
                          </span>
                        </div>
                      </div>
                      <span className="p-1.5 rounded-lg bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 group-hover:translate-x-1 transition-transform border border-indigo-200/60 dark:border-indigo-900/50 shadow-2xs">
                        <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                      </span>
                    </button>
                  )}

                  {/* ⏱️ Apply Permission Button */}
                  {canApplyPermission && (
                    <button
                      type="button"
                      onClick={() => router.push('/dashboard/attendance/permissions')}
                      className="w-full group flex items-center justify-between p-3.5 rounded-xl border border-emerald-200/80 dark:border-emerald-900/40 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent hover:from-emerald-500/20 hover:via-emerald-500/10 dark:from-emerald-500/20 dark:via-emerald-500/10 hover:border-emerald-300 dark:hover:border-emerald-700/60 transition-all duration-200 shadow-2xs hover:shadow-md cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-sm group-hover:scale-105 transition-transform">
                          ⏱️
                        </div>
                        <div className="text-left">
                          <span className="block text-xs font-black text-emerald-950 dark:text-emerald-200 uppercase tracking-wide group-hover:text-emerald-600 dark:group-hover:text-emerald-300 transition-colors font-outfit">
                            Apply Permission
                          </span>
                          <span className="block text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">
                            Request short duration or late entry permission
                          </span>
                        </div>
                      </div>
                      <span className="p-1.5 rounded-lg bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 group-hover:translate-x-1 transition-transform border border-emerald-200/60 dark:border-emerald-900/50 shadow-2xs">
                        <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                      </span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </SlideDrawer>
      )}

      {/* 📸 Mark Attendance / Web Punch Center Dialog Modal */}
      {mounted && punchModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 animate-fadeIn font-sans">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-[0_0_80px_rgba(0,0,0,0.5)] max-w-md w-full overflow-hidden space-y-0 relative animate-scaleUp z-[10000]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">📸</span>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white font-outfit">
                    Mark Attendance (Web Punch)
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    {policyForm?.require_selfie ? 'GPS Location & Selfie Verification' : 'GPS Location Verification'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setPunchModalOpen(false);
                }}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-colors border-0 cursor-pointer text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Alert / Notification banner */}
              {punchMessage && (
                <div className={`p-3.5 rounded-2xl text-xs font-bold ${punchMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                  {punchMessage.text}
                </div>
              )}

              {/* GPS Verification Card */}
              <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    🌐 GPS Location Verification
                  </span>
                  <button
                    type="button"
                    onClick={getGPSLocation}
                    disabled={gpsLoading}
                    className="text-[9.5px] font-extrabold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer bg-transparent border-0"
                  >
                    {gpsLoading ? 'Fetching...' : 'Re-detect GPS'}
                  </button>
                </div>

                {punchLat && punchLng ? (
                  <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 leading-snug">
                        📍 {locationName || 'Detecting location address...'}
                      </p>
                      <span className="text-[9px] bg-emerald-600 text-white px-2 py-0.5 rounded font-sans uppercase font-bold shrink-0 shadow-2xs">
                        GPS Verified
                      </span>
                    </div>
                  </div>
                ) : gpsError ? (
                  <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 text-xs font-bold">
                    ⚠️ {gpsError}
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-bold">
                    📍 Click "Re-detect GPS" to verify location permissions.
                  </div>
                )}
              </div>

              {/* Camera / Selfie Capture Card - Only required/shown if require_selfie is enabled */}
              {policyForm?.require_selfie && (
                <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                      📸 Selfie Photo Verification
                    </span>
                    <span className="text-[9px] bg-indigo-600 text-white px-2 py-0.5 rounded font-sans uppercase font-bold shrink-0 shadow-2xs">
                      Required
                    </span>
                  </div>

                  {capturedSelfie ? (
                    <div className="space-y-2 text-center">
                      <img
                        src={capturedSelfie}
                        alt="Captured Selfie Verification"
                        className="w-48 h-36 object-cover rounded-2xl mx-auto border-2 border-emerald-500 shadow-md"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setCapturedSelfie(null);
                          startCamera();
                        }}
                        className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer bg-transparent border-0"
                      >
                        Retake Selfie Photo
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3 text-center">
                      <div className="w-full h-44 rounded-2xl bg-black overflow-hidden relative flex items-center justify-center border border-slate-700 shadow-inner">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          style={{ transform: 'scaleX(-1)' }}
                          className="w-full h-full object-cover"
                        />
                        <canvas ref={canvasRef} className="hidden" />
                        {!cameraActive && (
                          <button
                            type="button"
                            onClick={startCamera}
                            className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors shadow-md cursor-pointer"
                          >
                            📷 Enable Camera
                          </button>
                        )}
                      </div>

                      {cameraActive && (
                        <button
                          type="button"
                          onClick={captureSelfie}
                          className="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md shadow-indigo-500/25 transition-all cursor-pointer hover:scale-105"
                        >
                          📸 Take Selfie Snapshot
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={submitWebPunch}
                  disabled={
                    isSubmittingPunch ||
                    (policyForm?.require_selfie ? !capturedSelfie : false) ||
                    (policyForm?.require_gps ? (!punchLat || !punchLng) : false)
                  }
                  className={`w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all duration-200 ${
                    isSubmittingPunch ||
                    (policyForm?.require_selfie ? !capturedSelfie : false) ||
                    (policyForm?.require_gps ? (!punchLat || !punchLng) : false)
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 border border-slate-300/40 dark:border-slate-700/40 cursor-not-allowed shadow-none'
                      : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white shadow-lg shadow-blue-500/25 hover:scale-[1.01] cursor-pointer'
                  }`}
                >
                  {isSubmittingPunch
                    ? 'Submitting Punch...'
                    : (policyForm?.require_selfie && !capturedSelfie)
                    ? '📸 Capture Selfie Photo First to Submit'
                    : (policyForm?.require_gps && (!punchLat || !punchLng))
                    ? '📍 Waiting for GPS Location to Submit'
                    : 'Submit Attendance Punch Now'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
