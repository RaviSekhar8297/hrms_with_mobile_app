'use client';

import React, { useEffect, useState } from 'react';
import DashboardPageHeader from '../components/DashboardPageHeader';
import { getHeaders } from '../utils/api';
import SlideDrawer from '../components/SlideDrawer';
import { useDashboard } from '../components/DashboardContext';

export default function SmartHRPage() {
  const { showToast } = useDashboard();
  const [companyId, setCompanyId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'schedules' | 'templates' | 'logs'>('schedules');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Data states
  const [schedules, setSchedules] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  // Integration validation states
  const [emailConfigured, setEmailConfigured] = useState<boolean>(false);
  const [whatsappConfigured, setWhatsappConfigured] = useState<boolean>(false);

  // Searchable employee combobox states
  const [empSearchQuery, setEmpSearchQuery] = useState('');
  const [empDropdownOpen, setEmpDropdownOpen] = useState(false);

  // Drawer states
  const [scheduleDrawerOpen, setScheduleDrawerOpen] = useState(false);
  const [templateDrawerOpen, setTemplateDrawerOpen] = useState(false);

  const [editingSchedule, setEditingSchedule] = useState<any | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);

  // Form states
  const [scheduleForm, setScheduleForm] = useState({
    title: '',
    task_type: 'BIRTHDAY_WISHES',
    frequency: 'DAILY',
    execution_time: '09:00',
    execution_day_of_week: 'MONDAY',
    execution_day_of_month: '1',
    recipient_type: 'ALL_EMPLOYEES',
    target_employee_id: '',
    channel_type: 'BOTH',
    status: 'ACTIVE'
  });

  const [templateForm, setTemplateForm] = useState({
    template_type: 'BIRTHDAY',
    title: '',
    subject: '',
    body_content: '',
    channel_type: 'BOTH'
  });

  useEffect(() => {
    const storedCompanyId = localStorage.getItem('companyId');
    if (storedCompanyId) setCompanyId(storedCompanyId);
  }, []);

  // Attendance Cutoff Policy state (Synced from /dashboard/attendance/rules)
  const [cutoffPolicy, setCutoffPolicy] = useState<{ cycle_start_day: number; cycle_end_day: number }>({
    cycle_start_day: 26,
    cycle_end_day: 25
  });

  useEffect(() => {
    fetchSchedules();
    fetchTemplates();
    fetchLogs();
    fetchIntegrations();
    fetchEmployees();
    fetchAttendancePolicy();
  }, [companyId]);

  const fetchAttendancePolicy = async () => {
    try {
      const cid = companyId ? `?company_id=${companyId}` : '';
      const res = await fetch(`/api/v1/attendance/policies${cid}`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          setCutoffPolicy({
            cycle_start_day: Number(data[0].cycle_start_day) || 26,
            cycle_end_day: Number(data[0].cycle_end_day) || 25
          });
        }
      }
    } catch (e) {}
  };

  const fetchIntegrations = async () => {
    try {
      const cid = companyId ? `?company_id=${companyId}` : '';
      const [emailRes, whatsappRes] = await Promise.all([
        fetch(`/api/v1/recruitment/settings/email${cid}`, { headers: getHeaders() }),
        fetch(`/api/v1/recruitment/settings/whatsapp${cid}`, { headers: getHeaders() })
      ]);
      if (emailRes.ok) {
        const data = await emailRes.json();
        setEmailConfigured(!!(data && data.is_active));
      }
      if (whatsappRes.ok) {
        const data = await whatsappRes.json();
        setWhatsappConfigured(!!(data && data.is_active));
      }
    } catch (e) {}
  };

  const fetchEmployees = async () => {
    try {
      const cid = companyId || 'all';
      const res = await fetch(`/api/v1/employees?companyId=${cid}`, { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) setEmployees(data.employees || []);
    } catch (e) {}
  };

  const fetchSchedules = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/smart-hr/schedules', { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) setSchedules(data.schedules || []);
    } catch (e) {
      showToast('Error loading schedules', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/v1/smart-hr/templates', { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) setTemplates(data.templates || []);
    } catch (e) {}
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/v1/smart-hr/logs', { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) setLogs(data.logs || []);
    } catch (e) {}
  };

  // SCHEDULE HANDLERS
  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleForm.title) {
      showToast('Please enter a schedule title', 'error');
      return;
    }
    if (scheduleForm.recipient_type === 'SINGLE_EMPLOYEE' && !scheduleForm.target_employee_id) {
      showToast('Please select a specific employee', 'error');
      return;
    }

    // Prevent duplicate schedule titles
    const isDuplicateTitle = schedules.some(
      s => s.title.trim().toLowerCase() === scheduleForm.title.trim().toLowerCase() && s.id !== editingSchedule?.id
    );
    if (isDuplicateTitle) {
      showToast('A schedule with this title already exists. Please enter a unique title.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const method = editingSchedule ? 'PUT' : 'POST';
      const url = editingSchedule
        ? `/api/v1/smart-hr/schedules/${editingSchedule.id}`
        : '/api/v1/smart-hr/schedules';

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(scheduleForm)
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Schedule ${editingSchedule ? 'updated' : 'created'} successfully`, 'success');
        setScheduleDrawerOpen(false);
        setEditingSchedule(null);
        fetchSchedules();
      } else {
        showToast(data.error || 'Failed to save schedule', 'error');
      }
    } catch (e) {
      showToast('Connection error', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleScheduleStatus = async (s: any) => {
    const newStatus = s.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      const res = await fetch(`/api/v1/smart-hr/schedules/${s.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          ...s,
          status: newStatus
        })
      });
      if (res.ok) {
        showToast(`Schedule ${newStatus === 'ACTIVE' ? 'activated' : 'paused'} successfully`, 'success');
        fetchSchedules();
      } else {
        showToast('Failed to update status', 'error');
      }
    } catch (e) {
      showToast('Error updating status', 'error');
    }
  };

  const [runningScheduleId, setRunningScheduleId] = useState<string | null>(null);

  const handleExecuteNow = async (id: string) => {
    setRunningScheduleId(id);
    try {
      const res = await fetch(`/api/v1/smart-hr/schedules/${id}/execute`, {
        method: 'POST',
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'Trigger executed successfully!', 'success');
        fetchLogs();
      } else {
        showToast(data.error || 'Trigger failed', 'error');
      }
    } catch (e) {
      showToast('Error executing trigger', 'error');
    } finally {
      setRunningScheduleId(null);
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return;
    try {
      const res = await fetch(`/api/v1/smart-hr/schedules/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (res.ok) {
        showToast('Schedule deleted successfully', 'success');
        fetchSchedules();
      }
    } catch (e) {
      showToast('Error deleting schedule', 'error');
    }
  };

  const handleTaskTypeSelectChange = (newTaskType: string) => {
    if (newTaskType === 'PAYROLL_GENERATION') {
      const autoRunDay = String(Number(cutoffPolicy.cycle_end_day) + 1);
      setScheduleForm(prev => ({
        ...prev,
        task_type: newTaskType,
        frequency: 'MONTHLY',
        execution_day_of_month: autoRunDay
      }));
    } else {
      setScheduleForm(prev => ({
        ...prev,
        task_type: newTaskType
      }));
    }
  };

  const openNewSchedule = () => {
    setEditingSchedule(null);
    let defaultChannel = 'BOTH';
    if (emailConfigured && !whatsappConfigured) defaultChannel = 'EMAIL';
    else if (!emailConfigured && whatsappConfigured) defaultChannel = 'WHATSAPP';
    else if (emailConfigured && whatsappConfigured) defaultChannel = 'BOTH';
    else defaultChannel = 'EMAIL';

    setScheduleForm({
      title: '',
      task_type: 'BIRTHDAY_WISHES',
      frequency: 'DAILY',
      execution_time: '09:00',
      execution_day_of_week: 'MONDAY',
      execution_day_of_month: '1',
      recipient_type: 'ALL_EMPLOYEES',
      target_employee_id: '',
      channel_type: defaultChannel,
      status: 'ACTIVE'
    });
    setEmpSearchQuery('');
    setEmpDropdownOpen(false);
    setScheduleDrawerOpen(true);
  };

  const openEditSchedule = (s: any) => {
    setEditingSchedule(s);
    const isPayroll = s.task_type === 'PAYROLL_GENERATION';
    const defaultPayrollDay = String(Number(cutoffPolicy.cycle_end_day) + 1);
    setScheduleForm({
      title: s.title || '',
      task_type: s.task_type || 'BIRTHDAY_WISHES',
      frequency: isPayroll ? 'MONTHLY' : (s.frequency || 'DAILY'),
      execution_time: s.execution_time?.slice(0, 5) || '09:00',
      execution_day_of_week: s.execution_day_of_week || 'MONDAY',
      execution_day_of_month: isPayroll ? (s.execution_day_of_month ? String(s.execution_day_of_month) : defaultPayrollDay) : String(s.execution_day_of_month || 1),
      recipient_type: s.recipient_type || 'ALL_EMPLOYEES',
      target_employee_id: s.target_employee_id || '',
      channel_type: s.channel_type || 'BOTH',
      status: s.status || 'ACTIVE'
    });
    setEmpSearchQuery('');
    setEmpDropdownOpen(false);
    setScheduleDrawerOpen(true);
  };

  // TEMPLATE HANDLERS
  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateForm.title || !templateForm.body_content) {
      showToast('Please enter title and message body', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const method = editingTemplate ? 'PUT' : 'POST';
      const url = editingTemplate
        ? `/api/v1/smart-hr/templates/${editingTemplate.id}`
        : '/api/v1/smart-hr/templates';

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(templateForm)
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Template ${editingTemplate ? 'updated' : 'created'} successfully`, 'success');
        setTemplateDrawerOpen(false);
        setEditingTemplate(null);
        fetchTemplates();
      } else {
        showToast(data.error || 'Failed to save template', 'error');
      }
    } catch (e) {
      showToast('Connection error', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      const res = await fetch(`/api/v1/smart-hr/templates/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (res.ok) {
        showToast('Template deleted successfully', 'success');
        fetchTemplates();
      }
    } catch (e) {
      showToast('Error deleting template', 'error');
    }
  };

  const openNewTemplate = () => {
    setEditingTemplate(null);
    setTemplateForm({
      template_type: 'BIRTHDAY',
      title: '',
      subject: '',
      body_content: '',
      channel_type: 'BOTH'
    });
    setTemplateDrawerOpen(true);
  };

  const openEditTemplate = (t: any) => {
    setEditingTemplate(t);
    setTemplateForm({
      template_type: t.template_type || 'BIRTHDAY',
      title: t.title || '',
      subject: t.subject || '',
      body_content: t.body_content || '',
      channel_type: t.channel_type || 'BOTH'
    });
    setTemplateDrawerOpen(true);
  };

  // LOG HANDLERS
  const handleDeleteLog = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/smart-hr/logs/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (res.ok) {
        showToast('Log entry removed', 'success');
        fetchLogs();
      }
    } catch (e) {}
  };

  const insertVariable = (varName: string) => {
    setTemplateForm(prev => ({
      ...prev,
      body_content: prev.body_content + ` {{${varName}}}`
    }));
  };

  const format12Hour = (timeStr: string) => {
    if (!timeStr) return '09:00 AM';
    const [h, m] = timeStr.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${String(hour12).padStart(2, '0')}:${String(m || 0).padStart(2, '0')} ${period}`;
  };

  const filteredEmployees = employees.filter(emp => {
    const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.toLowerCase();
    const code = (emp.emp_id_code || '').toLowerCase();
    const email = (emp.email || '').toLowerCase();
    const q = empSearchQuery.toLowerCase();
    return fullName.includes(q) || code.includes(q) || email.includes(q);
  });

  const selectedEmp = employees.find(e => e.id === scheduleForm.target_employee_id);

  const getSplineTaskIcon = (taskType: string) => {
    if (taskType?.includes('BIRTHDAY')) {
      return (
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-500/20 via-rose-500/20 to-purple-500/20 border border-pink-300/40 shadow-sm flex items-center justify-center text-2xl shrink-0 transform hover:scale-110 transition-all duration-300">
          🎂
        </div>
      );
    }
    if (taskType?.includes('ANNIVERSARY')) {
      return (
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500/20 via-yellow-500/20 to-orange-500/20 border border-amber-300/40 shadow-sm flex items-center justify-center text-2xl shrink-0 transform hover:scale-110 transition-all duration-300">
          🏆
        </div>
      );
    }
    if (taskType?.includes('PAYROLL')) {
      return (
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500/20 via-teal-500/20 to-green-500/20 border border-emerald-300/40 shadow-sm flex items-center justify-center text-2xl shrink-0 transform hover:scale-110 transition-all duration-300">
          💰
        </div>
      );
    }
    return (
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-500/20 via-indigo-500/20 to-cyan-500/20 border border-blue-300/40 shadow-sm flex items-center justify-center text-2xl shrink-0 transform hover:scale-110 transition-all duration-300">
        📊
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER */}
      <DashboardPageHeader
        title="Smart HR Auto-Pilot Console"
        companyId={companyId}
        hideCompanySelect={true}
        hideUserBadge={true}
      />

      {/* 🎛️ TAB SWITCHER & ACTION BUTTON BAR */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setActiveTab('schedules')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'schedules'
                ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-600/25 scale-[1.02]'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <span>🗓️</span>
            <span>Automated Schedules</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${activeTab === 'schedules' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {schedules.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('templates')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'templates'
                ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-600/25 scale-[1.02]'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <span>✉️</span>
            <span>Message Templates</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${activeTab === 'templates' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {templates.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'logs'
                ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-600/25 scale-[1.02]'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <span>⏱️</span>
            <span>Execution Logs</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${activeTab === 'logs' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {logs.length}
            </span>
          </button>
        </div>

        {/* GATEWAY STATUS BADGES & RIGHT ACTION BUTTON */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
            <span className={`px-3 py-1 rounded-xl text-[11px] font-black tracking-wide flex items-center gap-2 border transition-all ${
              emailConfigured 
                ? 'bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-800 border-emerald-200 shadow-xs' 
                : 'bg-gradient-to-r from-rose-50 to-red-50 text-rose-800 border-rose-200'
            }`}>
              <span className="text-sm">📧</span>
              <span>Email Gateway: <strong className={emailConfigured ? 'text-emerald-700 font-extrabold' : 'text-rose-700 font-extrabold'}>{emailConfigured ? 'ACTIVE' : 'OFFLINE'}</strong></span>
            </span>

            <span className={`px-3 py-1 rounded-xl text-[11px] font-black tracking-wide flex items-center gap-2 border transition-all ${
              whatsappConfigured 
                ? 'bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-800 border-emerald-200 shadow-xs' 
                : 'bg-gradient-to-r from-rose-50 to-red-50 text-rose-800 border-rose-200'
            }`}>
              <span className="text-sm">💬</span>
              <span>WhatsApp API: <strong className={whatsappConfigured ? 'text-emerald-700 font-extrabold' : 'text-rose-700 font-extrabold'}>{whatsappConfigured ? 'CONNECTED' : 'OFFLINE'}</strong></span>
            </span>
          </div>

          {activeTab === 'schedules' && (
            <button
              onClick={openNewSchedule}
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 via-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-extrabold rounded-xl shadow-md shadow-indigo-600/20 hover:shadow-lg hover:scale-[1.02] transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>✨</span>
              <span>Create New Schedule</span>
            </button>
          )}
          {activeTab === 'templates' && (
            <button
              onClick={openNewTemplate}
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 via-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-extrabold rounded-xl shadow-md shadow-indigo-600/20 hover:shadow-lg hover:scale-[1.02] transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>✨</span>
              <span>Create New Template</span>
            </button>
          )}
        </div>
      </div>

      {/* 🗓️ TAB 1: AUTOMATED SCHEDULES CARDS */}
      {activeTab === 'schedules' && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="p-12 text-center text-xs text-slate-400">Loading schedules...</div>
          ) : schedules.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 rounded-2xl">
              <span className="text-4xl block mb-3">🪄</span>
              <h4 className="text-sm font-bold text-slate-700">No automated schedules created yet.</h4>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
              {schedules.map(s => (
                <div
                  key={s.id}
                  style={{ boxShadow: 'rgba(14, 30, 37, 0.08) 0px 2px 4px 0px, rgba(14, 30, 37, 0.16) 0px 2px 16px 0px' }}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {getSplineTaskIcon(s.task_type)}
                      <div>
                        <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">{s.title}</h4>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {s.task_type?.includes('PAYROLL') ? (
                            <span className="px-2.5 py-0.5 rounded-md bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 font-extrabold text-[10.5px] border border-purple-200/80 flex items-center gap-1">
                              <span>🗓️</span>
                              MONTHLY ({s.execution_day_of_month || 26}th Date - Post Cutoff)
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold text-[10.5px] border border-slate-200/80 flex items-center gap-1">
                              <span>🗓️</span>
                              {s.frequency}
                              {s.frequency === 'WEEKLY' && s.execution_day_of_week ? ` (${s.execution_day_of_week})` : ''}
                              {s.frequency === 'MONTHLY' && s.execution_day_of_month ? ` (${s.execution_day_of_month}${Number(s.execution_day_of_month) === 31 ? 'st - Last Day' : 'th Date'})` : ''}
                            </span>
                          )}

                          <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-600 font-black text-[11px] border border-indigo-200 flex items-center gap-1 font-mono">
                            <span>⏰</span>
                            {format12Hour(s.execution_time)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleScheduleStatus(s)}
                        title={`Click to ${s.status === 'ACTIVE' ? 'Pause' : 'Activate'} schedule`}
                        className={`relative inline-flex h-7 items-center rounded-full px-1.5 py-0.5 transition-all duration-200 ease-in-out cursor-pointer text-[10px] font-black tracking-wider uppercase border shadow-xs ${
                          s.status === 'ACTIVE'
                            ? 'bg-emerald-500 text-white border-emerald-600 pl-2.5 pr-1.5'
                            : 'bg-amber-100 text-amber-800 border-amber-300 pl-1.5 pr-2.5 dark:bg-amber-950/60 dark:text-amber-300'
                        }`}
                      >
                        {s.status === 'ACTIVE' ? (
                          <span className="flex items-center gap-1.5">
                            <span>ACTIVE</span>
                            <span className="h-4 w-4 rounded-full bg-white shadow-md inline-block shrink-0" />
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5">
                            <span className="h-4 w-4 rounded-full bg-amber-500 shadow-md inline-block shrink-0" />
                            <span>PAUSED</span>
                          </span>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div>
                      <span className="text-slate-400 block font-bold text-[10.5px]">Dispatch Channel</span>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {(s.channel_type === 'EMAIL' || s.channel_type === 'BOTH') && (
                          <span className={`px-2.5 py-1 rounded-lg text-[10.5px] font-extrabold flex items-center gap-1.5 border ${
                            emailConfigured 
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80 shadow-xs' 
                              : 'bg-rose-50 text-rose-800 border-rose-200/80'
                          }`}>
                            <span>📧</span>
                            <span>Email ({emailConfigured ? 'Active' : 'Not Set'})</span>
                          </span>
                        )}

                        {(s.channel_type === 'WHATSAPP' || s.channel_type === 'BOTH') && (
                          <span className={`px-2.5 py-1 rounded-lg text-[10.5px] font-extrabold flex items-center gap-1.5 border ${
                            whatsappConfigured 
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80 shadow-xs' 
                              : 'bg-rose-50 text-rose-800 border-rose-200/80'
                          }`}>
                            <span>💬</span>
                            <span>WhatsApp ({whatsappConfigured ? 'Connected' : 'Offline'})</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-bold text-[10.5px]">Target Recipients</span>
                      <div className="flex items-center gap-1.5 mt-1">
                        {s.recipient_type === 'SINGLE_EMPLOYEE' ? (
                          <span className="text-slate-800 dark:text-slate-200 font-extrabold flex items-center gap-1.5 text-xs truncate bg-indigo-50/80 dark:bg-indigo-950/40 px-2.5 py-1 rounded-lg border border-indigo-200/70">
                            <span>👤</span>
                            <span>{s.target_employee_name || 'Single Employee'}</span>
                          </span>
                        ) : (
                          <span className="text-slate-800 dark:text-slate-200 font-extrabold flex items-center gap-1.5 text-xs bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200/80">
                            <span>👥</span>
                            <span>All Active Employees</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                    <span className="text-slate-400 font-medium flex items-center gap-1.5 font-mono text-[10.5px]">
                      <span>🗓️</span>
                      <span><strong>Created At:</strong> {new Date(s.created_at || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, {new Date(s.created_at || Date.now()).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleExecuteNow(s.id)}
                        disabled={runningScheduleId === s.id}
                        className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-extrabold rounded-xl hover:bg-emerald-600 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-60"
                        title="Run instant trigger right now"
                      >
                        {runningScheduleId === s.id ? (
                          <>
                            <span className="w-3 h-3 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></span>
                            <span>Sending...</span>
                          </>
                        ) : (
                          <>
                            <span>⚡</span> Run Now
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => openEditSchedule(s)}
                        className="px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 text-xs font-extrabold rounded-xl hover:bg-blue-600 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                      >
                        <span>✏️</span> Edit
                      </button>
                      <button
                        onClick={() => handleDeleteSchedule(s.id)}
                        className="px-3 py-1.5 bg-rose-50 text-rose-600 border border-rose-200 text-xs font-extrabold rounded-xl hover:bg-rose-600 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                      >
                        <span>🗑️</span> Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 🎨 TAB 2: MESSAGE TEMPLATES */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          {templates.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 rounded-2xl">
              <span className="text-4xl block mb-3">✉️</span>
              <h4 className="text-sm font-bold text-slate-700">No message templates found.</h4>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map(t => (
                <div
                  key={t.id}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-3"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2.5 py-0.5 rounded bg-indigo-50 text-indigo-600 font-extrabold text-[10px] uppercase">
                        {t.template_type}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold text-[10px]">
                        {t.channel_type}
                      </span>
                    </div>
                    <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">{t.title}</h4>
                    {t.subject && <p className="text-xs text-indigo-500 font-semibold mt-1">Subject: {t.subject}</p>}
                    <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs text-slate-600 dark:text-slate-300 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto border border-slate-200/60">
                      {t.body_content}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => openEditTemplate(t)}
                      className="px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 text-xs font-extrabold rounded-xl hover:bg-blue-600 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                    >
                      <span>✏️</span> Edit
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(t.id)}
                      className="px-3 py-1.5 bg-rose-50 text-rose-600 border border-rose-200 text-xs font-extrabold rounded-xl hover:bg-rose-600 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                    >
                      <span>🗑️</span> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 📊 TAB 3: EXECUTION LOGS TABLE */}
      {activeTab === 'logs' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {logs.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">No execution logs found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="p-4">Execution Date & Time</th>
                    <th className="p-4">Task Name</th>
                    <th className="p-4">Task Type</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Recipients</th>
                    <th className="p-4">Summary</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {logs.map(l => (
                    <tr key={l.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 font-mono text-slate-500 font-bold">
                        {new Date(l.executed_at).toLocaleString()}
                      </td>
                      <td className="p-4 font-extrabold text-slate-900 dark:text-slate-100">{l.title}</td>
                      <td className="p-4 font-bold text-indigo-600 text-[11px]">{l.task_type}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-lg font-extrabold text-[10.5px] ${l.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-rose-50 text-rose-600 border border-rose-200'}`}>
                          {l.status}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-slate-700">{l.success_count} / {l.total_recipients}</td>
                      <td className="p-4 text-slate-500 max-w-xs truncate">{l.summary}</td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleDeleteLog(l.id)}
                          className="px-2.5 py-1 bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold rounded-lg hover:bg-rose-600 hover:text-white transition-all cursor-pointer"
                        >
                          Delete Log
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 🚪 CREATE / EDIT SCHEDULE DRAWER */}
      <SlideDrawer
        isOpen={scheduleDrawerOpen}
        onClose={() => setScheduleDrawerOpen(false)}
        title={editingSchedule ? 'Edit Automated Schedule' : 'Create Automated Schedule'}
      >
        <form onSubmit={handleSaveSchedule} className="space-y-4 p-4">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Schedule Title *</label>
            <input
              type="text"
              placeholder="e.g. Daily Employee Birthday Greetings"
              value={scheduleForm.title}
              onChange={e => setScheduleForm(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Task Type</label>
              <select
                value={scheduleForm.task_type}
                onChange={e => handleTaskTypeSelectChange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
              >
                <option value="BIRTHDAY_WISHES">Birthday Wishes</option>
                <option value="ANNIVERSARY_WISHES">Work Anniversary Wishes</option>
                <option value="ATTENDANCE_REPORT">Attendance Report Digest</option>
                <option value="PAYROLL_GENERATION">Automated Payroll Generation</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Frequency</label>
              <select
                value={scheduleForm.frequency}
                onChange={e => setScheduleForm(prev => ({ ...prev, frequency: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                disabled={scheduleForm.task_type === 'PAYROLL_GENERATION'}
              >
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
              </select>
            </div>
          </div>

          {/* PAYROLL ATTENDANCE CUTOFF AUTO-SYNC NOTICE */}
          {scheduleForm.task_type === 'PAYROLL_GENERATION' && (
            <div className="p-3.5 bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 border border-purple-200 rounded-2xl text-xs space-y-1.5 dark:bg-purple-950/40 dark:border-purple-800 shadow-xs">
              <div className="flex items-center gap-1.5 text-purple-900 dark:text-purple-200 font-extrabold text-xs">
                <span>⚡ Auto-Synced with Attendance Cutoff Rules</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                Attendance Period: <strong>{cutoffPolicy.cycle_start_day}th of Previous Month</strong> to <strong>{cutoffPolicy.cycle_end_day}th of Current Month</strong>.<br/>
                Auto-Payroll Run is locked to <strong>{Number(cutoffPolicy.cycle_end_day) + 1}th Date of Month</strong> (post-cutoff day).
              </p>
            </div>
          )}

          {/* DYNAMIC DAY SELECTOR DEPENDING ON FREQUENCY */}
          {scheduleForm.frequency === 'WEEKLY' && (
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Day of Week *</label>
              <select
                value={scheduleForm.execution_day_of_week}
                onChange={e => setScheduleForm(prev => ({ ...prev, execution_day_of_week: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
              >
                <option value="MONDAY">Every Monday</option>
                <option value="TUESDAY">Every Tuesday</option>
                <option value="WEDNESDAY">Every Wednesday</option>
                <option value="THURSDAY">Every Thursday</option>
                <option value="FRIDAY">Every Friday</option>
                <option value="SATURDAY">Every Saturday</option>
                <option value="SUNDAY">Every Sunday</option>
              </select>
            </div>
          )}

          {scheduleForm.frequency === 'MONTHLY' && (
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Date of Month *</label>
              <select
                value={scheduleForm.execution_day_of_month}
                onChange={e => setScheduleForm(prev => ({ ...prev, execution_day_of_month: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                disabled={scheduleForm.task_type === 'PAYROLL_GENERATION'}
              >
                {scheduleForm.task_type === 'PAYROLL_GENERATION' && (
                  <option value={String(Number(cutoffPolicy.cycle_end_day) + 1)}>
                    {Number(cutoffPolicy.cycle_end_day) + 1}th Date of Month (Post-Cutoff Auto-Run)
                  </option>
                )}
                <option value="1">1st Date of Month</option>
                <option value="5">5th Date of Month</option>
                <option value="10">10th Date of Month</option>
                <option value="15">15th Date of Month</option>
                <option value="20">20th Date of Month</option>
                <option value="25">25th Date of Month (Cutoff End)</option>
                <option value="26">26th Date of Month (Post-Cutoff)</option>
                <option value="28">28th Date of Month</option>
                <option value="31">Last Day of Month (31st)</option>
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Execution Time *</label>
              <input
                type="time"
                value={scheduleForm.execution_time}
                onChange={e => setScheduleForm(prev => ({ ...prev, execution_time: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Dispatch Channel *</label>
              <select
                value={scheduleForm.channel_type}
                onChange={e => setScheduleForm(prev => ({ ...prev, channel_type: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
              >
                <option value="BOTH" disabled={!emailConfigured || !whatsappConfigured}>
                  Email & WhatsApp {!emailConfigured || !whatsappConfigured ? '(⚠️ Config Required)' : ''}
                </option>
                <option value="EMAIL" disabled={!emailConfigured}>
                  Email Only {!emailConfigured ? '(⚠️ Not Configured)' : ''}
                </option>
                <option value="WHATSAPP" disabled={!whatsappConfigured}>
                  WhatsApp Only {!whatsappConfigured ? '(⚠️ Not Configured)' : ''}
                </option>
              </select>
            </div>
          </div>

          {(!emailConfigured || !whatsappConfigured) && (
            <p className="text-[11px] text-amber-700 font-medium bg-amber-50 p-2.5 rounded-xl border border-amber-200 flex items-center gap-1.5">
              <span>⚠️</span>
              <span>To enable Email or WhatsApp dispatch channels, please configure your SMTP / WhatsApp credentials in <strong>Settings ➔ Configuration</strong> page.</span>
            </p>
          )}

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Target Recipients *</label>
            <select
              value={scheduleForm.recipient_type}
              onChange={e => setScheduleForm(prev => ({ ...prev, recipient_type: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
            >
              <option value="ALL_EMPLOYEES">👥 All Active Employees</option>
              <option value="SINGLE_EMPLOYEE">👤 Single Specific Employee</option>
            </select>
          </div>

          {scheduleForm.recipient_type === 'SINGLE_EMPLOYEE' && (
            <div className="relative">
              <label className="text-xs font-bold text-slate-700 block mb-1">Select Specific Employee *</label>
              
              {selectedEmp ? (
                <div className="flex items-center justify-between p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-xl">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-extrabold flex items-center justify-center text-xs shadow-xs">
                      {selectedEmp.first_name?.[0]}{selectedEmp.last_name?.[0]}
                    </div>
                    <div>
                      <h5 className="text-xs font-extrabold text-slate-900">{selectedEmp.first_name} {selectedEmp.last_name}</h5>
                      <span className="text-[10px] font-mono text-indigo-600 font-bold">{selectedEmp.emp_id_code || selectedEmp.email}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setScheduleForm(prev => ({ ...prev, target_employee_id: '' }));
                      setEmpSearchQuery('');
                      setEmpDropdownOpen(true);
                    }}
                    className="p-1 text-slate-400 hover:text-rose-600 text-xs font-bold cursor-pointer flex items-center gap-1"
                  >
                    <span>❌</span> Change
                  </button>
                </div>
              ) : (
                <div>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Type employee name, ID code, or email..."
                      value={empSearchQuery}
                      onFocus={() => setEmpDropdownOpen(true)}
                      onChange={e => {
                        setEmpSearchQuery(e.target.value);
                        setEmpDropdownOpen(true);
                      }}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:border-indigo-500 focus:outline-none"
                    />
                    <span className="absolute left-3 top-2.5 text-xs text-slate-400">🔍</span>
                  </div>

                  {empDropdownOpen && (
                    <div className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredEmployees.length === 0 ? (
                        <div className="p-3 text-center text-xs text-slate-400 font-medium">No matching employees found</div>
                      ) : (
                        filteredEmployees.map(emp => (
                          <div
                            key={emp.id}
                            onClick={() => {
                              setScheduleForm(prev => ({ ...prev, target_employee_id: emp.id }));
                              setEmpDropdownOpen(false);
                              setEmpSearchQuery('');
                            }}
                            className="p-2.5 hover:bg-indigo-50/70 dark:hover:bg-slate-800 cursor-pointer flex items-center justify-between transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-md bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-[10px]">
                                {emp.first_name?.[0]}{emp.last_name?.[0]}
                              </div>
                              <div>
                                <h6 className="text-xs font-bold text-slate-900 dark:text-slate-100">{emp.first_name} {emp.last_name}</h6>
                                <span className="text-[10px] text-slate-400 font-mono">{emp.email}</span>
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px] font-bold">
                              {emp.emp_id_code || 'EMP'}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 bg-indigo-600 text-white font-bold text-xs rounded-xl shadow cursor-pointer"
            >
              {isSaving ? 'Saving...' : editingSchedule ? 'Update Schedule' : 'Create Schedule'}
            </button>
            <button
              type="button"
              onClick={() => setScheduleDrawerOpen(false)}
              className="px-4 py-2.5 bg-slate-100 text-slate-600 font-bold text-xs rounded-xl cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </SlideDrawer>

      {/* 🚪 CREATE / EDIT TEMPLATE DRAWER */}
      <SlideDrawer
        isOpen={templateDrawerOpen}
        onClose={() => setTemplateDrawerOpen(false)}
        title={editingTemplate ? 'Edit Message Template' : 'Create Message Template'}
      >
        <form onSubmit={handleSaveTemplate} className="space-y-4 p-4">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Template Title *</label>
            <input
              type="text"
              placeholder="e.g. Standard Birthday Wishes Template"
              value={templateForm.title}
              onChange={e => setTemplateForm(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Category</label>
              <select
                value={templateForm.template_type}
                onChange={e => setTemplateForm(prev => ({ ...prev, template_type: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
              >
                <option value="BIRTHDAY">Birthday Wishes</option>
                <option value="ANNIVERSARY">Work Anniversary</option>
                <option value="ATTENDANCE_SUMMARY">Attendance Summary</option>
                <option value="PAYROLL_NOTICE">Payroll Notice</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Channel</label>
              <select
                value={templateForm.channel_type}
                onChange={e => setTemplateForm(prev => ({ ...prev, channel_type: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
              >
                <option value="BOTH">Email & WhatsApp</option>
                <option value="EMAIL">Email Only</option>
                <option value="WHATSAPP">WhatsApp Only</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Email Subject (Optional)</label>
            <input
              type="text"
              placeholder="e.g. 🎉 Happy Birthday {{employee_name}}!"
              value={templateForm.subject}
              onChange={e => setTemplateForm(prev => ({ ...prev, subject: e.target.value }))}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 block">Message Body Content *</label>
              <span className="text-[10px] text-slate-400">Insert Tag:</span>
            </div>
            
            {/* TAG BUTTONS */}
            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
              <button type="button" onClick={() => insertVariable('employee_name')} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 font-extrabold text-[10px] rounded-lg border border-indigo-200 hover:bg-indigo-600 hover:text-white transition-all cursor-pointer">
                + employee_name
              </button>
              <button type="button" onClick={() => insertVariable('company_name')} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 font-extrabold text-[10px] rounded-lg border border-indigo-200 hover:bg-indigo-600 hover:text-white transition-all cursor-pointer">
                + company_name
              </button>
              <button type="button" onClick={() => insertVariable('years_count')} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 font-extrabold text-[10px] rounded-lg border border-indigo-200 hover:bg-indigo-600 hover:text-white transition-all cursor-pointer">
                + years_count
              </button>
            </div>

            <textarea
              rows={5}
              placeholder="Type message content..."
              value={templateForm.body_content}
              onChange={e => setTemplateForm(prev => ({ ...prev, body_content: e.target.value }))}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
              required
            />
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 bg-indigo-600 text-white font-bold text-xs rounded-xl shadow cursor-pointer"
            >
              {isSaving ? 'Saving...' : editingTemplate ? 'Update Template' : 'Create Template'}
            </button>
            <button
              type="button"
              onClick={() => setTemplateDrawerOpen(false)}
              className="px-4 py-2.5 bg-slate-100 text-slate-600 font-bold text-xs rounded-xl cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </SlideDrawer>
    </div>
  );
}
