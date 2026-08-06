'use client';

import React, { useEffect, useState } from 'react';
import DashboardPageHeader from '../components/DashboardPageHeader';
import { getHeaders } from '../utils/api';
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

const SHIFT_TABS = [
  { id: 'policies',    label: 'Shift Policies',           permission: 'view_shift_masters' },
  { id: 'assignments', label: 'Employee Shift Mapping',   permission: 'view_shift_assignments' },
  { id: 'rotation',    label: 'Shift Rotation Scheduler', permission: 'view_shift_rotation' },
] as const;
type ShiftTabId = typeof SHIFT_TABS[number]['id'];

export default function ShiftsPage() {
  const { showToast } = useDashboard();
  const { hasPermission } = usePermissions();
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Tab state: 'policies' | 'assignments' | 'rotation'
  const [activeTab, setActiveTab] = useState<ShiftTabId>('policies');

  // Shifts state
  const [shifts, setShifts] = useState<any[]>([]);
  const [addShiftDrawerOpen, setAddShiftDrawerOpen] = useState(false);
  const [newShiftForm, setNewShiftForm] = useState({
    id: '',
    name: '',
    start_time: '09:00',
    end_time: '18:00',
    grace_in_minutes: '15',
    grace_out_minutes: '15',
    halfday_minutes: '240',
    fullday_minutes: '480',
    is_overnight: false,
    company_id: ''
  });

  // Employee Shift Assignment state
  const [employeeShifts, setEmployeeShifts] = useState<any[]>([]);
  const [assignmentDrawerOpen, setAssignmentDrawerOpen] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState({
    id: '',
    employee_id: '',
    shift_id: '',
    effective_from: '',
    effective_to: '',
    is_default: false
  });

  // Rotation scheduling state
  const [rotationForm, setRotationForm] = useState({
    employee_ids: [] as string[],
    shift_ids: [] as string[],
    days_interval: 10,
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  });
  const [empSearch, setEmpSearch] = useState('');
  const [selectedShiftForSeq, setSelectedShiftForSeq] = useState('');

  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('superadmin');

  const visibleTabs = SHIFT_TABS.filter(t => hasPermission(t.permission));

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
      if (res.ok) {
        setShifts(data.shifts || []);
      }
    } catch (e) {
      console.error(e);
      showToast('Failed to fetch shift policies.', 'error');
    }
  };

  const fetchEmployeeShifts = async () => {
    if (!companyId && !isSuperAdmin) return;
    try {
      const url = companyId
        ? `http://localhost:5000/api/v1/employee-shifts?companyId=${companyId}`
        : 'http://localhost:5000/api/v1/employee-shifts';
      const res = await fetch(url, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        setEmployeeShifts(data.employeeShifts || []);
      }
    } catch (e) {
      console.error(e);
      showToast('Failed to fetch employee shift assignments.', 'error');
    }
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
      if (res.ok) {
        setEmployees(data.employees || []);
      }
    } catch (e) {
      console.error(e);
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
    if (isSuperAdmin) {
      fetchCompanies();
    }
  }, [companyId, isSuperAdmin]);

  useEffect(() => {
    if (companyId || isSuperAdmin) {
      fetchShifts();
      fetchEmployeeShifts();
      fetchEmployees();
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

  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShiftForm.name || !newShiftForm.start_time || !newShiftForm.end_time) {
      showToast('Please fill in Shift Name, Start Time and End Time.', 'error');
      return;
    }
    const targetCompanyId = companyId || newShiftForm.company_id;
    if (!targetCompanyId) {
      showToast('Please select a company for this shift policy.', 'error');
      return;
    }
    try {
      const method = newShiftForm.id ? 'PUT' : 'POST';
      const url = newShiftForm.id 
        ? `http://localhost:5000/api/v1/shifts/${newShiftForm.id}`
        : 'http://localhost:5000/api/v1/shifts';

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify({
          companyId: targetCompanyId,
          ...newShiftForm
        })
      });

      if (res.ok) {
        showToast(`Shift ${newShiftForm.id ? 'updated' : 'created'} successfully!`, 'success');
        setAddShiftDrawerOpen(false);
        fetchShifts();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to save shift policy.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Connection to server failed', 'error');
    }
  };

  const handleDeleteShift = async (id: string) => {
    if (!confirm('Are you sure you want to delete this shift?')) return;
    try {
      const selectedShiftObj = shifts.find(s => String(s.id) === String(id));
      const targetCompanyId = companyId || (selectedShiftObj ? selectedShiftObj.company_id : null);
      const res = await fetch(`http://localhost:5000/api/v1/shifts/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
        body: JSON.stringify({ companyId: targetCompanyId })
      });
      if (res.ok) {
        showToast('Shift policy deleted successfully', 'success');
        fetchShifts();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to delete shift', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Connection to server failed', 'error');
    }
  };

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignmentForm.employee_id || !assignmentForm.shift_id || !assignmentForm.effective_from) {
      showToast('Please fill in employee, shift and effective from date.', 'error');
      return;
    }
    try {
      const selectedEmployeeObj = employees.find(emp => emp.id === assignmentForm.employee_id);
      const targetCompanyId = companyId || (selectedEmployeeObj ? selectedEmployeeObj.company_id : null);
      const method = assignmentForm.id ? 'PUT' : 'POST';
      const url = assignmentForm.id 
        ? `http://localhost:5000/api/v1/employee-shifts/${assignmentForm.id}`
        : 'http://localhost:5000/api/v1/employee-shifts';

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify({
          companyId: targetCompanyId,
          ...assignmentForm
        })
      });

      if (res.ok) {
        showToast(`Employee shift assigned successfully!`, 'success');
        setAssignmentDrawerOpen(false);
        fetchEmployeeShifts();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to assign shift.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Connection to server failed', 'error');
    }
  };

  const handleSaveRotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rotationForm.employee_ids.length === 0) {
      showToast('Please select at least one employee.', 'error');
      return;
    }
    if (rotationForm.shift_ids.length === 0) {
      showToast('Please build a shift rotation sequence with at least one shift.', 'error');
      return;
    }
    if (!rotationForm.days_interval || rotationForm.days_interval <= 0) {
      showToast('Please enter a valid interval in days.', 'error');
      return;
    }
    if (!rotationForm.start_date || !rotationForm.end_date) {
      showToast('Please enter both start and end dates.', 'error');
      return;
    }

    try {
      const targetCompanyId = companyId;
      const res = await fetch('http://localhost:5000/api/v1/employee-shifts/rotate', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          companyId: targetCompanyId,
          ...rotationForm
        })
      });

      if (res.ok) {
        showToast('Shift rotation scheduled successfully!', 'success');
        setRotationForm({
          employee_ids: [],
          shift_ids: [],
          days_interval: 10,
          start_date: new Date().toISOString().split('T')[0],
          end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        });
        setActiveTab('assignments');
        fetchEmployeeShifts();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to generate rotation schedule.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Connection to server failed', 'error');
    }
  };

  const getRotationPreview = () => {
    const { start_date, end_date, days_interval, shift_ids } = rotationForm;
    if (!start_date || !days_interval || days_interval <= 0 || shift_ids.length === 0) {
      return [];
    }

    const start = new Date(start_date);
    const end = new Date(end_date || start_date);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      return [];
    }

    const previewList: any[] = [];
    let currentDate = new Date(start);
    let shiftIndex = 0;
    
    for (let i = 0; i < 3; i++) {
      if (currentDate > end) break;
      const currentShiftId = shift_ids[shiftIndex];
      const shiftDetail = shifts.find(s => String(s.id) === String(currentShiftId));
      if (!shiftDetail) break;

      const blockStart = new Date(currentDate);
      const blockEnd = new Date(currentDate);
      blockEnd.setDate(blockEnd.getDate() + days_interval - 1);
      const finalBlockEnd = blockEnd > end ? end : blockEnd;

      previewList.push({
        shiftName: shiftDetail.name,
        startTime: shiftDetail.start_time,
        endTime: shiftDetail.end_time,
        startStr: blockStart.toISOString().split('T')[0],
        endStr: finalBlockEnd.toISOString().split('T')[0],
      });

      currentDate.setDate(currentDate.getDate() + days_interval);
      shiftIndex = (shiftIndex + 1) % shift_ids.length;
    }
    return previewList;
  };

  const handleDeleteAssignment = async (id: string) => {
    if (!confirm('Are you sure you want to remove this shift assignment?')) return;
    try {
      const selectedAss = employeeShifts.find(es => String(es.id) === String(id));
      const targetCompanyId = companyId || (selectedAss ? selectedAss.company_id : null);
      const res = await fetch(`http://localhost:5000/api/v1/employee-shifts/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
        body: JSON.stringify({ companyId: targetCompanyId })
      });
      if (res.ok) {
        showToast('Employee shift assignment removed successfully', 'success');
        fetchEmployeeShifts();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to delete assignment', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Connection to server failed', 'error');
    }
  };

  const getGraceInLimitText = () => {
    const startTimeStr = newShiftForm.start_time;
    const graceMinutes = parseInt(String(newShiftForm.grace_in_minutes || 0), 10);
    if (!startTimeStr || isNaN(graceMinutes) || graceMinutes <= 0) return null;
    
    const parts = startTimeStr.split(':');
    if (parts.length < 2) return null;
    let hours = parseInt(parts[0], 10);
    let minutes = parseInt(parts[1], 10);
    if (isNaN(hours) || isNaN(minutes)) return null;

    let targetMinutes = minutes + graceMinutes;
    let targetHours = hours + Math.floor(targetMinutes / 60);
    targetMinutes = targetMinutes % 60;
    targetHours = targetHours % 24;

    const pad = (num: number) => String(num).padStart(2, '0');
    const ampm = targetHours >= 12 ? 'PM' : 'AM';
    const displayHours = targetHours % 12 === 0 ? 12 : targetHours % 12;
    return `${pad(displayHours)}:${pad(targetMinutes)} ${ampm}`;
  };

  const getGraceOutLimitText = () => {
    const endTimeStr = newShiftForm.end_time;
    const graceMinutes = parseInt(String(newShiftForm.grace_out_minutes || 0), 10);
    if (!endTimeStr || isNaN(graceMinutes) || graceMinutes <= 0) return null;
    
    const parts = endTimeStr.split(':');
    if (parts.length < 2) return null;
    let hours = parseInt(parts[0], 10);
    let minutes = parseInt(parts[1], 10);
    if (isNaN(hours) || isNaN(minutes)) return null;

    let totalMins = (hours * 60 + minutes) - graceMinutes;
    if (totalMins < 0) totalMins += 24 * 60;
    let targetHours = Math.floor(totalMins / 60) % 24;
    let targetMinutes = totalMins % 60;

    const pad = (num: number) => String(num).padStart(2, '0');
    const ampm = targetHours >= 12 ? 'PM' : 'AM';
    const displayHours = targetHours % 12 === 0 ? 12 : targetHours % 12;
    return `${pad(displayHours)}:${pad(targetMinutes)} ${ampm}`;
  };

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }} className="font-['DM_Sans',sans-serif] space-y-6 animate-fadeIn w-full">
      <DashboardPageHeader
        title="Shifts & Schedules"
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

      {/* Tabs */}
      {visibleTabs.length === 0 ? (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 text-xs font-bold">
          <span>⚠️</span> You don't have permission to access any Shifts modules.
        </div>
      ) : (
        <div className="flex gap-2 p-1.5 bg-slate-100/70 dark:bg-slate-900/40 rounded-2xl border border-slate-200/50 dark:border-slate-800/80 max-w-fit">
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

      {activeTab === 'policies' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest text-left font-sans">Shift Master Configuration</h3>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-0.5 text-left font-sans">Define working hours, grace windows, and overnight shifts</p>
            </div>
            {hasPermission('create_shift_masters') && (
              <button
                onClick={() => {
                  setNewShiftForm({
                    id: '',
                    name: '',
                    start_time: '09:00',
                    end_time: '18:00',
                    grace_in_minutes: '15',
                    grace_out_minutes: '15',
                    halfday_minutes: '240',
                    fullday_minutes: '480',
                    is_overnight: false,
                    company_id: ''
                  });
                  setAddShiftDrawerOpen(true);
                }}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-wider shadow-sm transition-all duration-200 cursor-pointer flex items-center gap-1.5 flex-shrink-0"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Create Shift
              </button>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-card p-6 shadow-sm text-left">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-550 dark:text-slate-400 font-black uppercase tracking-widest text-[9.5px]">
                    {!companyId && <th className="py-3.5 px-3">Company</th>}
                    <th className="py-3.5 px-3">Shift Name</th>
                    <th className="py-3.5 px-3">Working Hours</th>
                    <th className="py-3.5 px-3">Grace (In / Out)</th>
                    <th className="py-3.5 px-3">Half / Full Day Limits</th>
                    <th className="py-3.5 px-3">Type</th>
                    <th className="py-3.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shifts.length === 0 ? (
                    <tr>
                      <td colSpan={!companyId ? 7 : 6} className="py-8 text-center text-slate-450 dark:text-slate-550 font-bold">
                        No shift policies configured yet.
                      </td>
                    </tr>
                  ) : (
                    shifts.map(s => (
                      <tr key={s.id} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-550/5 transition-all">
                        {!companyId && <td className="py-4 px-3 text-slate-550 dark:text-slate-400 font-bold">{s.company_name || 'Global'}</td>}
                        <td className="py-4 px-3 font-black text-slate-800 dark:text-slate-200">{s.name}</td>
                        <td className="py-4 px-3 font-semibold text-slate-700 dark:text-slate-350 font-mono">{s.start_time} - {s.end_time}</td>
                        <td className="py-4 px-3 text-slate-500 dark:text-slate-400 font-mono">{s.grace_in_minutes}m / {s.grace_out_minutes}m</td>
                        <td className="py-4 px-3 text-slate-500 dark:text-slate-400 font-mono">{s.halfday_minutes}m / {s.fullday_minutes}m</td>
                        <td className="py-4 px-3">
                          <span className={`px-2 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider ${s.is_overnight ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                            {s.is_overnight ? 'Overnight' : 'Regular'}
                          </span>
                        </td>
                        <td className="py-4 px-3 text-right space-x-2">
                          {hasPermission('edit_shift_masters') && (
                            <button
                              onClick={() => {
                                setNewShiftForm({
                                  id: String(s.id),
                                  name: s.name,
                                  start_time: s.start_time,
                                  end_time: s.end_time,
                                  grace_in_minutes: String(s.grace_in_minutes),
                                  grace_out_minutes: String(s.grace_out_minutes),
                                  halfday_minutes: String(s.halfday_minutes),
                                  fullday_minutes: String(s.fullday_minutes),
                                  is_overnight: s.is_overnight,
                                  company_id: s.company_id ? String(s.company_id) : ''
                                });
                                setAddShiftDrawerOpen(true);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500 text-blue-600 hover:text-white dark:text-blue-400 text-[10px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer"
                            >
                              Edit
                            </button>
                          )}
                          {hasPermission('delete_shift_masters') && (
                            <button
                              onClick={() => handleDeleteShift(s.id)}
                              className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-600 text-red-600 hover:text-white dark:text-red-400 text-[10px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer"
                            >
                              Delete
                            </button>
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

      {activeTab === 'assignments' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest text-left font-sans">Employee Shift Assignments</h3>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-0.5 text-left font-sans">Assign work shifts to individual employees with effective dates</p>
            </div>
            {hasPermission('create_shift_assignments') && (
              <button
                onClick={() => {
                  setAssignmentForm({
                    id: '',
                    employee_id: '',
                    shift_id: shifts.length > 0 ? shifts[0].id : '',
                    effective_from: new Date().toISOString().split('T')[0],
                    effective_to: '',
                    is_default: false
                  });
                  setAssignmentDrawerOpen(true);
                }}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-wider shadow-sm transition-all duration-200 cursor-pointer flex items-center gap-1.5 flex-shrink-0"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Assign Shift
              </button>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-card p-6 shadow-sm text-left">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-550 dark:text-slate-400 font-black uppercase tracking-widest text-[9.5px]">
                    {!companyId && <th className="py-3.5 px-3">Company</th>}
                    <th className="py-3.5 px-3">Employee Code</th>
                    <th className="py-3.5 px-3">Employee Name</th>
                    <th className="py-3.5 px-3">Assigned Shift</th>
                    <th className="py-3.5 px-3">Effective From</th>
                    <th className="py-3.5 px-3">Effective To</th>
                    <th className="py-3.5 px-3">Is Default</th>
                    <th className="py-3.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeShifts.length === 0 ? (
                    <tr>
                      <td colSpan={!companyId ? 8 : 7} className="py-8 text-center text-slate-450 dark:text-slate-550 font-bold">
                        No shift assignments defined yet.
                      </td>
                    </tr>
                  ) : (
                    employeeShifts.map(es => (
                      <tr key={es.id} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-550/5 transition-all">
                        {!companyId && <td className="py-4 px-3 text-slate-550 dark:text-slate-400 font-bold">{es.company_name || 'Global'}</td>}
                        <td className="py-4 px-3 font-semibold text-slate-600 dark:text-slate-400 font-mono">{es.emp_id_code}</td>
                        <td className="py-4 px-3 font-black text-slate-800 dark:text-slate-200">{es.first_name} {es.last_name}</td>
                        <td className="py-4 px-3 font-bold text-blue-600 dark:text-blue-400">{es.shift_name}</td>
                        <td className="py-4 px-3 text-slate-500 dark:text-slate-400 font-mono">{new Date(es.effective_from).toLocaleDateString()}</td>
                        <td className="py-4 px-3 text-slate-500 dark:text-slate-400 font-mono">{es.effective_to ? new Date(es.effective_to).toLocaleDateString() : 'Ongoing'}</td>
                        <td className="py-4 px-3">
                          <span className={`px-2 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider ${es.is_default ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                            {es.is_default ? 'YES' : 'NO'}
                          </span>
                        </td>
                        <td className="py-4 px-3 text-right space-x-2">
                          {hasPermission('edit_shift_assignments') && (
                            <button
                              onClick={() => {
                                setAssignmentForm({
                                  id: String(es.id),
                                  employee_id: es.employee_id,
                                  shift_id: es.shift_id,
                                  effective_from: new Date(es.effective_from).toISOString().split('T')[0],
                                  effective_to: es.effective_to ? new Date(es.effective_to).toISOString().split('T')[0] : '',
                                  is_default: es.is_default
                                });
                                setAssignmentDrawerOpen(true);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500 text-blue-600 hover:text-white dark:text-blue-400 text-[10px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer"
                            >
                              Edit
                            </button>
                          )}
                          {hasPermission('delete_shift_assignments') && (
                            <button
                              onClick={() => handleDeleteAssignment(es.id)}
                              className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-600 text-red-600 hover:text-white dark:text-red-400 text-[10px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer"
                            >
                              Delete
                            </button>
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

      {activeTab === 'rotation' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest text-left font-sans">Shift Rotation Scheduler</h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-550 font-bold mt-0.5 text-left font-sans">Configure automated date-effective shift rotation cycles for multiple employees simultaneously.</p>
          </div>

          <form onSubmit={handleSaveRotation} className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-left">
            {/* Column 1: Employees Selection (5 cols) */}
            <div className="lg:col-span-5 space-y-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-card p-5 shadow-sm flex flex-col h-[520px]">
              <div>
                <h4 className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">1. Select Employees</h4>
                <p className="text-[9.5px] text-slate-400 dark:text-slate-500 font-bold mt-0.5">Select one or more employees for this rotation cycle</p>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search employees by name or code..."
                  value={empSearch}
                  onChange={e => setEmpSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 pl-9 pr-4 py-2 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-450 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all font-semibold"
                />
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </div>

              {/* Select All / Deselect All */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const filteredIds = employees
                      .filter(emp => `${emp.first_name} ${emp.last_name} ${emp.emp_id_code}`.toLowerCase().includes(empSearch.toLowerCase()))
                      .map(emp => emp.id);
                    setRotationForm(prev => ({
                      ...prev,
                      employee_ids: Array.from(new Set([...prev.employee_ids, ...filteredIds]))
                    }));
                  }}
                  className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[10px] font-bold text-slate-650 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const filteredIds = employees
                      .filter(emp => `${emp.first_name} ${emp.last_name} ${emp.emp_id_code}`.toLowerCase().includes(empSearch.toLowerCase()))
                      .map(emp => emp.id);
                    setRotationForm(prev => ({
                      ...prev,
                      employee_ids: prev.employee_ids.filter(id => !filteredIds.includes(id))
                    }));
                  }}
                  className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[10px] font-bold text-slate-650 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  Clear Selection
                </button>
              </div>

              {/* Scrollable List */}
              <div className="flex-1 overflow-y-auto border border-slate-150 dark:border-slate-850 rounded-xl p-2 space-y-1 bg-slate-50/20 dark:bg-slate-950/20">
                {employees
                  .filter(emp => `${emp.first_name} ${emp.last_name} ${emp.emp_id_code}`.toLowerCase().includes(empSearch.toLowerCase()))
                  .map(emp => {
                    const isChecked = rotationForm.employee_ids.includes(emp.id);
                    return (
                      <label
                        key={emp.id}
                        className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all cursor-pointer select-none ${
                          isChecked
                            ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40 text-blue-950 dark:text-blue-200 font-bold'
                            : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-900/30 text-slate-700 dark:text-slate-300 font-medium'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            if (e.target.checked) {
                              setRotationForm(prev => ({
                                ...prev,
                                employee_ids: [...prev.employee_ids, emp.id]
                              }));
                            } else {
                              setRotationForm(prev => ({
                                ...prev,
                                employee_ids: prev.employee_ids.filter(id => id !== emp.id)
                              }));
                            }
                          }}
                          className="h-3.5 w-3.5 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                        />
                        <div className="flex flex-col text-left">
                          <span className="text-xs">{emp.first_name} {emp.last_name}</span>
                          <span className="text-[9px] font-mono text-slate-400 dark:text-slate-550 font-bold">{emp.emp_id_code}</span>
                        </div>
                      </label>
                    );
                  })}
              </div>
              <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                {rotationForm.employee_ids.length} employees selected
              </div>
            </div>

            {/* Column 2: Rotation Parameters & Sequence (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-card p-5 shadow-sm space-y-4">
                <div>
                  <h4 className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">2. Rotation Configuration</h4>
                  <p className="text-[9.5px] text-slate-400 dark:text-slate-500 font-bold mt-0.5">Specify scheduling intervals and date durations</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[9.5px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Interval (Days)</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={rotationForm.days_interval}
                      onChange={e => setRotationForm({ ...rotationForm, days_interval: parseInt(e.target.value) || 1 })}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-950 transition-colors text-slate-800 dark:text-slate-200 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[9.5px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Start Date</label>
                    <input
                      type="date"
                      required
                      value={rotationForm.start_date}
                      onChange={e => setRotationForm({ ...rotationForm, start_date: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-950 transition-colors text-slate-800 dark:text-slate-200 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[9.5px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">End Date</label>
                    <input
                      type="date"
                      required
                      value={rotationForm.end_date}
                      onChange={e => setRotationForm({ ...rotationForm, end_date: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-950 transition-colors text-slate-800 dark:text-slate-200 font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-card p-5 shadow-sm space-y-4">
                <div>
                  <h4 className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">3. Shift Rotation Sequence</h4>
                  <p className="text-[9.5px] text-slate-400 dark:text-slate-500 font-bold mt-0.5">Build the chain of shifts that will rotate sequentially</p>
                </div>

                {/* Add to Sequence Editor */}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <SearchableSelect
                      options={shifts.map(s => ({ value: s.id, label: `${s.name} (${s.start_time} - ${s.end_time})` }))}
                      value={selectedShiftForSeq}
                      onChange={setSelectedShiftForSeq}
                      placeholder="Choose Shift to add..."
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedShiftForSeq) return;
                      setRotationForm(prev => ({
                        ...prev,
                        shift_ids: [...prev.shift_ids, selectedShiftForSeq]
                      }));
                      setSelectedShiftForSeq('');
                    }}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all duration-200 cursor-pointer flex-shrink-0"
                  >
                    Add Shift
                  </button>
                </div>

                {/* Sequence Display Chain */}
                <div className="space-y-2">
                  {rotationForm.shift_ids.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-450 dark:text-slate-550 font-bold border border-dashed border-slate-200 dark:border-slate-800/60 rounded-xl">
                      No shifts in the sequence yet. Select a shift above to build the sequence chain.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {rotationForm.shift_ids.map((shiftId, index) => {
                        const shiftDetail = shifts.find(s => String(s.id) === String(shiftId));
                        return (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-850 bg-slate-50/40 dark:bg-slate-950/20"
                          >
                            <div className="flex items-center gap-3">
                              <span className="h-5 w-5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[10px] font-black font-mono">
                                {index + 1}
                              </span>
                              <div className="text-left">
                                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{shiftDetail?.name || 'Unknown Shift'}</p>
                                <p className="text-[9.5px] font-mono text-slate-400 dark:text-slate-500 font-bold">
                                  {shiftDetail ? `${shiftDetail.start_time} - ${shiftDetail.end_time}` : ''}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setRotationForm(prev => ({
                                  ...prev,
                                  shift_ids: prev.shift_ids.filter((_, idx) => idx !== index)
                                }));
                              }}
                              className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-all cursor-pointer"
                            >
                              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Dynamic Live Schedule Preview */}
              {getRotationPreview().length > 0 && (
                <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-blue-50/10 dark:bg-slate-900/10 p-5 shadow-sm space-y-3.5">
                  <div>
                    <h4 className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 111.086 1.086L12 12.75l-.04.02a.75.75 0 11-1.087-1.086l.041-.02zM12 21a9 9 0 100-18 9 9 0 000 18z" stroke="currentColor" />
                      </svg>
                      Live Schedule Preview (First 3 Cycles)
                    </h4>
                    <p className="text-[9px] text-slate-400 dark:text-slate-550 font-bold mt-0.5">Calculated sequence blocks for selected dates</p>
                  </div>
                  
                  <div className="space-y-2">
                    {getRotationPreview().map((item, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-lg bg-white dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/40 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="h-4.5 w-4.5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[9px] font-black">
                            {idx + 1}
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{item.shiftName}</span>
                          <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 font-mono">({item.startTime} - {item.endTime})</span>
                        </div>
                        <div className="mt-1 sm:mt-0 text-[10px] font-bold text-blue-650 dark:text-blue-450 font-mono">
                          {new Date(item.startStr).toLocaleDateString(undefined, {month:'short', day:'numeric'})} ➔ {new Date(item.endStr).toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'})}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview and Save actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-xs font-black text-white shadow-md transition-all duration-200 cursor-pointer uppercase tracking-wider"
                >
                  Generate & Apply Rotation Schedule
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Add/Edit Shift Drawer */}
      <SlideDrawer
        isOpen={addShiftDrawerOpen}
        onClose={() => setAddShiftDrawerOpen(false)}
        title={newShiftForm.id ? 'Edit Shift Policy' : 'Create Custom Shift Policy'}
      >
        <form onSubmit={handleCreateShift} className="space-y-6 text-left p-2">
          {!companyId && (
            <div>
              <label className="block text-[9.5px] font-black text-slate-500 dark:text-slate-450 uppercase tracking-widest mb-1.5">Select Company</label>
              <SearchableSelect
                options={companies.map(c => ({
                  value: String(c.id),
                  label: c.name
                }))}
                value={newShiftForm.company_id}
                onChange={val => setNewShiftForm({ ...newShiftForm, company_id: val })}
                placeholder="-- Choose Company --"
                required
                disabled={!!newShiftForm.id}
              />
            </div>
          )}

          <div>
            <label className="block text-[9.5px] font-black text-slate-500 dark:text-slate-450 uppercase tracking-widest mb-1.5">Shift Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Standard Day Shift"
              value={newShiftForm.name}
              onChange={e => setNewShiftForm({ ...newShiftForm, name: e.target.value })}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-950 transition-colors text-slate-800 dark:text-slate-200"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[9.5px] font-black text-slate-500 dark:text-slate-450 uppercase tracking-widest mb-1.5">Start Time</label>
              <input
                type="text"
                required
                placeholder="e.g. 09:00"
                value={newShiftForm.start_time}
                onChange={e => setNewShiftForm({ ...newShiftForm, start_time: e.target.value })}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-950 transition-colors text-slate-800 dark:text-slate-200 font-mono"
              />
            </div>
            <div>
              <label className="block text-[9.5px] font-black text-slate-500 dark:text-slate-450 uppercase tracking-widest mb-1.5">End Time</label>
              <input
                type="text"
                required
                placeholder="e.g. 18:00"
                value={newShiftForm.end_time}
                onChange={e => setNewShiftForm({ ...newShiftForm, end_time: e.target.value })}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-950 transition-colors text-slate-800 dark:text-slate-200 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[9.5px] font-black text-slate-500 dark:text-slate-450 uppercase tracking-widest mb-1.5">Grace In (Minutes)</label>
              <input
                type="number"
                value={newShiftForm.grace_in_minutes}
                onChange={e => setNewShiftForm({ ...newShiftForm, grace_in_minutes: e.target.value })}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-950 transition-colors text-slate-800 dark:text-slate-200 font-mono"
              />
              {getGraceInLimitText() && (
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-sans">
                  e.g., Max arrival time: <span className="font-bold text-blue-600 dark:text-blue-400">{getGraceInLimitText()}</span>
                </p>
              )}
            </div>
            <div>
              <label className="block text-[9.5px] font-black text-slate-500 dark:text-slate-450 uppercase tracking-widest mb-1.5">Grace Out (Minutes)</label>
              <input
                type="number"
                value={newShiftForm.grace_out_minutes}
                onChange={e => setNewShiftForm({ ...newShiftForm, grace_out_minutes: e.target.value })}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-950 transition-colors text-slate-800 dark:text-slate-200 font-mono"
              />
              {getGraceOutLimitText() && (
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-sans">
                  e.g., Earliest check-out: <span className="font-bold text-blue-600 dark:text-blue-400">{getGraceOutLimitText()}</span>
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[9.5px] font-black text-slate-500 dark:text-slate-450 uppercase tracking-widest mb-1.5">Half-Day Limit (Min)</label>
              <input
                type="number"
                value={newShiftForm.halfday_minutes}
                onChange={e => setNewShiftForm({ ...newShiftForm, halfday_minutes: e.target.value })}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-950 transition-colors text-slate-800 dark:text-slate-200 font-mono"
              />
            </div>
            <div>
              <label className="block text-[9.5px] font-black text-slate-500 dark:text-slate-450 uppercase tracking-widest mb-1.5">Full-Day Limit (Min)</label>
              <input
                type="number"
                value={newShiftForm.fullday_minutes}
                onChange={e => setNewShiftForm({ ...newShiftForm, fullday_minutes: e.target.value })}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-950 transition-colors text-slate-800 dark:text-slate-200 font-mono"
              />
            </div>
          </div>

          <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={newShiftForm.is_overnight}
              onChange={e => setNewShiftForm({ ...newShiftForm, is_overnight: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
            />
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 font-sans">Overnight Shift</span>
              <p className="text-[10px] text-slate-400 dark:text-slate-550 mt-0.5 font-sans">Check this if the shift span crosses midnight (e.g. night shift)</p>
            </div>
          </label>

          <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800/80">
            <button
              type="button"
              onClick={() => setAddShiftDrawerOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50/10 text-xs font-bold text-slate-500 dark:text-slate-400 transition-all cursor-pointer bg-transparent"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-sm transition-all cursor-pointer"
            >
              {newShiftForm.id ? 'Update Shift' : 'Create Shift'}
            </button>
          </div>
        </form>
      </SlideDrawer>

      {/* Assign Employee Shift Drawer */}
      <SlideDrawer
        isOpen={assignmentDrawerOpen}
        onClose={() => setAssignmentDrawerOpen(false)}
        title={assignmentForm.id ? 'Edit Shift Assignment' : 'Assign Employee Shift'}
      >
        <form onSubmit={handleSaveAssignment} className="space-y-6 text-left p-2">
          <div>
            <label className="block text-[9.5px] font-black text-slate-500 dark:text-slate-450 uppercase tracking-widest mb-1.5">Select Employee</label>
            <SearchableSelect
              options={employees.map(emp => ({
                value: emp.id,
                label: `${emp.emp_id_code} - ${emp.first_name} ${emp.last_name}`
              }))}
              value={assignmentForm.employee_id}
              onChange={val => setAssignmentForm({ ...assignmentForm, employee_id: val })}
              placeholder="-- Choose Employee --"
              disabled={!!assignmentForm.id}
              required
            />
          </div>

          <div>
            <label className="block text-[9.5px] font-black text-slate-500 dark:text-slate-450 uppercase tracking-widest mb-1.5">Select Shift</label>
            <SearchableSelect
              options={shifts.map(s => ({
                value: String(s.id),
                label: `${s.name} (${s.start_time} - ${s.end_time})`
              }))}
              value={assignmentForm.shift_id}
              onChange={val => setAssignmentForm({ ...assignmentForm, shift_id: val })}
              placeholder="-- Choose Shift --"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[9.5px] font-black text-slate-500 dark:text-slate-450 uppercase tracking-widest mb-1.5">Effective From</label>
              <CustomDatePicker
                value={assignmentForm.effective_from}
                onChange={val => setAssignmentForm({ ...assignmentForm, effective_from: val })}
                required
              />
            </div>
            <div>
              <label className="block text-[9.5px] font-black text-slate-500 dark:text-slate-450 uppercase tracking-widest mb-1.5">Effective To (Optional)</label>
              <CustomDatePicker
                value={assignmentForm.effective_to}
                onChange={val => setAssignmentForm({ ...assignmentForm, effective_to: val })}
              />
            </div>
          </div>

          <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={assignmentForm.is_default}
              onChange={e => setAssignmentForm({ ...assignmentForm, is_default: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
            />
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 font-sans">Set as Default Shift</span>
              <p className="text-[10px] text-slate-400 dark:text-slate-550 mt-0.5 font-sans">Sets this as the primary default shift policy for this employee</p>
            </div>
          </label>

          <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800/80">
            <button
              type="button"
              onClick={() => setAssignmentDrawerOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50/10 text-xs font-bold text-slate-500 dark:text-slate-400 transition-all cursor-pointer bg-transparent"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-sm transition-all cursor-pointer"
            >
              {assignmentForm.id ? 'Update Assignment' : 'Assign Shift'}
            </button>
          </div>
        </form>
      </SlideDrawer>
    </div>
  );
}
