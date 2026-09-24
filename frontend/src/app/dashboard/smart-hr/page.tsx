'use client';

import React, { useEffect, useState } from 'react';
import DashboardPageHeader from '../components/DashboardPageHeader';
import { getHeaders } from '../utils/api';
import SlideDrawer from '../components/SlideDrawer';
import { useDashboard } from '../components/DashboardContext';
import { 
  Calendar, 
  Clock, 
  Mail, 
  MessageSquare, 
  Users, 
  User, 
  Play, 
  Pencil, 
  Trash2, 
  Plus, 
  Cake, 
  Award, 
  DollarSign, 
  BarChart2, 
  CheckCircle2, 
  PauseCircle 
} from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

export default function SmartHRPage() {
  const { showToast, companyId: globalCompanyId, companies } = useDashboard();
  const [companyId, setCompanyId] = useState<string | null>(null);

  // Active company ID priority: global context -> local state -> localStorage
  const activeCompanyId = globalCompanyId || companyId || (typeof window !== 'undefined' ? localStorage.getItem('companyId') : null);

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

  const [permissions, setPermissions] = useState<string[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    try {
      const storedPerms = localStorage.getItem('permissions');
      const storedRoles = localStorage.getItem('roles');
      if (storedPerms) setPermissions(JSON.parse(storedPerms));
      if (storedRoles) {
        const rList = JSON.parse(storedRoles);
        setIsSuperAdmin(rList.map((r: string) => r.toLowerCase()).includes('superadmin'));
      }
    } catch {}
  }, []);

  const canViewSchedules = isSuperAdmin || permissions.includes('view_smart_hr_schedules') || permissions.includes('*');
  const canCreateSchedules = isSuperAdmin || permissions.includes('create_smart_hr_schedules') || permissions.includes('*');
  const canEditSchedules = isSuperAdmin || permissions.includes('edit_smart_hr_schedules') || permissions.includes('*');
  const canDeleteSchedules = isSuperAdmin || permissions.includes('delete_smart_hr_schedules') || permissions.includes('*');

  const canViewTemplates = isSuperAdmin || permissions.includes('view_smart_hr_templates') || permissions.includes('*');
  const canCreateTemplates = isSuperAdmin || permissions.includes('create_smart_hr_templates') || permissions.includes('*');
  const canEditTemplates = isSuperAdmin || permissions.includes('edit_smart_hr_templates') || permissions.includes('*');
  const canDeleteTemplates = isSuperAdmin || permissions.includes('delete_smart_hr_templates') || permissions.includes('*');

  const canViewLogs = isSuperAdmin || permissions.includes('view_smart_hr_logs') || permissions.includes('*');
  const canDeleteLogs = isSuperAdmin || permissions.includes('delete_smart_hr_logs') || permissions.includes('*');

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
  }, [activeCompanyId]);

  const fetchAttendancePolicy = async () => {
    try {
      const cid = activeCompanyId;
      const q = cid && cid !== 'all' ? `?companyId=${cid}&company_id=${cid}` : '';
      const res = await fetch(`/api/v1/attendance/policies${q}`, { headers: getHeaders() });
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
      const cid = activeCompanyId;
      const q = cid && cid !== 'all' ? `?companyId=${cid}&company_id=${cid}` : '';
      const [emailRes, whatsappRes] = await Promise.all([
        fetch(`/api/v1/recruitment/settings/email${q}`, { headers: getHeaders() }),
        fetch(`/api/v1/recruitment/settings/whatsapp${q}`, { headers: getHeaders() })
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
      const cid = activeCompanyId || 'all';
      const res = await fetch(`/api/v1/employees?companyId=${cid}&company_id=${cid}`, { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) setEmployees(data.employees || []);
    } catch (e) {}
  };

  const fetchSchedules = async () => {
    setIsLoading(true);
    try {
      const cid = activeCompanyId;
      const q = cid && cid !== 'all' ? `?companyId=${cid}&company_id=${cid}` : '';
      const res = await fetch(`/api/v1/smart-hr/schedules${q}`, { headers: getHeaders() });
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
      const cid = activeCompanyId;
      const q = cid && cid !== 'all' ? `?companyId=${cid}&company_id=${cid}` : '';
      const res = await fetch(`/api/v1/smart-hr/templates${q}`, { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) setTemplates(data.templates || []);
    } catch (e) {}
  };

  const fetchLogs = async () => {
    try {
      const cid = activeCompanyId;
      const q = cid && cid !== 'all' ? `?companyId=${cid}&company_id=${cid}` : '';
      const res = await fetch(`/api/v1/smart-hr/logs${q}`, { headers: getHeaders() });
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
        body: JSON.stringify({
          ...scheduleForm,
          company_id: activeCompanyId && activeCompanyId !== 'all' ? activeCompanyId : undefined
        })
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
        body: JSON.stringify({
          ...templateForm,
          company_id: activeCompanyId && activeCompanyId !== 'all' ? activeCompanyId : undefined
        })
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
        <div className="w-10 h-10 rounded-xl bg-pink-100 dark:bg-pink-950/60 text-pink-600 dark:text-pink-300 border border-pink-200 dark:border-pink-800 flex items-center justify-center shrink-0 shadow-2xs">
          <Cake className="w-5 h-5 text-pink-600 dark:text-pink-300" />
        </div>
      );
    }
    if (taskType?.includes('ANNIVERSARY')) {
      return (
        <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center justify-center shrink-0 shadow-2xs">
          <Award className="w-5 h-5 text-amber-600 dark:text-amber-300" />
        </div>
      );
    }
    if (taskType?.includes('PAYROLL')) {
      return (
        <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center shrink-0 shadow-2xs">
          <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-300" />
        </div>
      );
    }
    return (
      <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-300 border border-sky-200 dark:border-sky-800 flex items-center justify-center shrink-0 shadow-2xs">
        <BarChart2 className="w-5 h-5 text-sky-600 dark:text-sky-300" />
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
        <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 w-full sm:w-auto overflow-x-auto gap-1">
          {canViewSchedules && (
            <button
              onClick={() => setActiveTab('schedules')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'schedules'
                  ? 'bg-[#07518a] text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/50'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Automated Schedules</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${activeTab === 'schedules' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                {schedules.length}
              </span>
            </button>
          )}

          {canViewTemplates && (
            <button
              onClick={() => setActiveTab('templates')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'templates'
                  ? 'bg-[#07518a] text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/50'
              }`}
            >
              <Mail className="w-4 h-4" />
              <span>Message Templates</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${activeTab === 'templates' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                {templates.length}
              </span>
            </button>
          )}

          {canViewLogs && (
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'logs'
                  ? 'bg-[#07518a] text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/50'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Execution Logs</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${activeTab === 'logs' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                {logs.length}
              </span>
            </button>
          )}
        </div>

        {/* GATEWAY STATUS BADGES & RIGHT ACTION BUTTON */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 p-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
            <span className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-all ${
              emailConfigured 
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' 
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
            }`}>
              <Mail className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Email Gateway: <strong className="font-extrabold">{emailConfigured ? 'ACTIVE' : 'OFFLINE'}</strong></span>
            </span>

            <span className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-all ${
              whatsappConfigured 
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' 
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
            }`}>
              <MessageSquare className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
              <span>WhatsApp API: <strong className="font-extrabold">{whatsappConfigured ? 'CONNECTED' : 'OFFLINE'}</strong></span>
            </span>
          </div>

          {activeTab === 'schedules' && canCreateSchedules && (
            <button
              onClick={openNewSchedule}
              className="px-4 py-2 bg-[#07518a] hover:bg-[#053d69] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>New Schedule</span>
            </button>
          )}
          {activeTab === 'templates' && canCreateTemplates && (
            <button
              onClick={openNewTemplate}
              className="px-4 py-2 bg-[#07518a] hover:bg-[#053d69] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>New Template</span>
            </button>
          )}
        </div>
      </div>

      {/* 🗓️ TAB 1: AUTOMATED SCHEDULES CARDS */}
      {activeTab === 'schedules' && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="p-16 text-center space-y-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="w-8 h-8 border-4 border-[#07518a] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Loading Schedules...</p>
            </div>
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
                  className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-800 transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {getSplineTaskIcon(s.task_type)}
                      <div>
                        <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 font-outfit">{s.title}</h4>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {s.task_type?.includes('PAYROLL') ? (
                            <span className="px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-extrabold text-[11px] border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              MONTHLY ({s.execution_day_of_month || 26}th Date - Post Cutoff)
                            </span>
                          ) : s.task_type?.includes('BIRTHDAY') ? (
                            <span className="px-2.5 py-1 rounded-md bg-pink-50 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 font-extrabold text-[11px] border border-pink-200 dark:border-pink-800 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-pink-600 dark:text-pink-400" />
                              DAILY
                            </span>
                          ) : s.task_type?.includes('ANNIVERSARY') ? (
                            <span className="px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-extrabold text-[11px] border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                              DAILY
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-md bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-extrabold text-[11px] border border-sky-200 dark:border-sky-800 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                              {s.frequency}
                              {s.frequency === 'WEEKLY' && s.execution_day_of_week ? ` (${s.execution_day_of_week})` : ''}
                            </span>
                          )}

                          <span className="px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-mono font-bold text-[11px] border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                            {format12Hour(s.execution_time)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0">
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <button
                              type="button"
                              onClick={() => handleToggleScheduleStatus(s)}
                              className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1 border ${
                                s.status === 'ACTIVE'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                              }`}
                            >
                              {s.status === 'ACTIVE' ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                  <span>Active</span>
                                </>
                              ) : (
                                <>
                                  <PauseCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                  <span>Paused</span>
                                </>
                              )}
                            </button>
                          }
                        />
                        <TooltipContent>
                          <p>{`Click to ${s.status === 'ACTIVE' ? 'Pause' : 'Activate'} schedule`}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] p-3.5 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-800">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block font-bold text-[10.5px]">Dispatch Channel</span>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {(s.channel_type === 'EMAIL' || s.channel_type === 'BOTH') && (
                          <span className="px-2.5 py-1 rounded-md text-[10.5px] font-extrabold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 flex items-center gap-1">
                            <Mail className="w-3 h-3 text-emerald-600" /> Email ({emailConfigured ? 'Active' : 'Not Set'})
                          </span>
                        )}

                        {(s.channel_type === 'WHATSAPP' || s.channel_type === 'BOTH') && (
                          <span className="px-2.5 py-1 rounded-md text-[10.5px] font-extrabold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800 flex items-center gap-1">
                            <MessageSquare className="w-3 h-3 text-rose-500" /> WhatsApp ({whatsappConfigured ? 'Connected' : 'Offline'})
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block font-bold text-[10.5px]">Target Recipients</span>
                      <div className="flex items-center gap-1.5 mt-1">
                        {s.recipient_type === 'SINGLE_EMPLOYEE' ? (
                          <span className="text-sky-800 dark:text-sky-200 font-extrabold flex items-center gap-1 text-xs truncate bg-sky-50 dark:bg-sky-950/60 px-2.5 py-1 rounded-md border border-sky-200/80 dark:border-sky-800">
                            <User className="w-3 h-3 text-sky-600 dark:text-sky-400" /> {s.target_employee_name || 'Single Employee'}
                          </span>
                        ) : (
                          <span className="text-sky-800 dark:text-sky-200 font-extrabold flex items-center gap-1 text-xs bg-sky-50 dark:bg-sky-950/60 px-2.5 py-1 rounded-md border border-sky-200/80 dark:border-sky-800">
                            <Users className="w-3 h-3 text-sky-600 dark:text-sky-400" /> All Active Employees
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                    <span className="text-slate-400 font-medium flex items-center gap-1 font-mono text-[10.5px]">
                      <span>Created: {new Date(s.created_at || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    </span>

                    <div className="flex items-center gap-2">
                      {canEditSchedules && (
                        <>
                          <button
                            onClick={() => handleExecuteNow(s.id)}
                            disabled={runningScheduleId === s.id}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
                            title="Run instant trigger right now"
                          >
                            {runningScheduleId === s.id ? (
                              <>
                                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                <span>Running...</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3.5 h-3.5 fill-white text-white" />
                                <span>Run Now</span>
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => openEditSchedule(s)}
                            className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 transition-all cursor-pointer flex items-center gap-1.5"
                          >
                            <Pencil className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                            <span>Edit</span>
                          </button>
                        </>
                      )}
                      {canDeleteSchedules && (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <button
                                onClick={() => handleDeleteSchedule(s.id)}
                                className="p-2 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-600 text-rose-600 hover:text-white rounded-xl border border-rose-200 dark:border-rose-800 transition-all cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            }
                          />
                          <TooltipContent>
                            <p>Delete schedule</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
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
              className="flex-1 py-2.5 bg-[#07518a] hover:bg-[#053d69] text-white font-bold text-xs rounded-xl shadow cursor-pointer transition-colors"
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
              className="flex-1 py-2.5 bg-[#07518a] hover:bg-[#053d69] text-white font-bold text-xs rounded-xl shadow cursor-pointer transition-colors"
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
