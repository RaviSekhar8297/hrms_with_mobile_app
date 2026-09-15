'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardPageHeader from '../../../components/DashboardPageHeader';
import { getHeaders, API_BASE } from '../../../utils/api';
import { useDashboard } from '../../../components/DashboardContext';
import { usePermissions } from '../../../hooks/usePermissions';
import SearchableSelect from '../../../components/SearchableSelect';
import { 
  ArrowLeft, 
  Save, 
  ShieldAlert, 
  Briefcase, 
  UserCheck, 
  Calendar, 
  FileText, 
  Building2, 
  Lock, 
  Clock, 
  Sparkles,
  Layers,
  Tag,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function CreateProjectPage() {
  const router = useRouter();
  const { showToast, companyId: globalCompanyId } = useDashboard();
  const { hasPermission, isSuperAdmin } = usePermissions();

  const canCreate = isSuperAdmin || hasPermission('create_projects') || hasPermission('create');
  const activeCompanyId = globalCompanyId;

  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const [form, setForm] = useState({
    project_code: `PRJ-${Math.floor(1000 + Math.random() * 9000)}`,
    project_name: '',
    client_name: '',
    description: '',
    priority: 'MEDIUM',
    status: 'PLANNING',
    project_manager_id: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    estimated_hours: '',
    category: '',
  });

  useEffect(() => {
    fetchEmployees();
    fetchDepartments();
  }, [activeCompanyId]);

  const fetchEmployees = async () => {
    try {
      const cid = activeCompanyId || localStorage.getItem('companyId');
      const url = cid && cid !== 'all' ? `${API_BASE}/api/v1/employees?company_id=${cid}` : `${API_BASE}/api/v1/employees`;
      const res = await fetch(url, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setEmployees(Array.isArray(data) ? data : (data.employees || []));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchDepartments = async () => {
    try {
      const cid = activeCompanyId || localStorage.getItem('companyId');
      const url = cid && cid !== 'all' ? `${API_BASE}/api/v1/departments?companyId=${cid}` : `${API_BASE}/api/v1/departments`;
      const res = await fetch(url, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.departments || data.data || []);
        setDepartments(list);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.project_code.trim()) {
      showToast('Please enter Project Code', 'error');
      return;
    }
    if (!form.project_name.trim()) {
      showToast('Please enter Project Name', 'error');
      return;
    }
    if (form.end_date && form.start_date && new Date(form.end_date) < new Date(form.start_date)) {
      showToast('End Date cannot be before Start Date', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const cid = activeCompanyId || localStorage.getItem('companyId');
      const payload = {
        ...form,
        company_id: cid,
      };

      const res = await fetch(`${API_BASE}/api/v1/workbridge/projects`, {
        method: 'POST',
        headers: {
          ...getHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showToast('Project created successfully! 🚀', 'success');
        router.push('/dashboard/workbridge/projects');
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to create project', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Network error creating project', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const employeeOptions = [
    { value: '', label: 'Unassigned / Select Project Manager' },
    ...employees.map((emp) => ({
      value: emp.id,
      label: `${emp.first_name} ${emp.last_name} (${emp.emp_id_code || 'EMP'})`,
    })),
  ];

  const priorityOptions = [
    { value: 'LOW', label: '🟢 Low' },
    { value: 'MEDIUM', label: '🔵 Medium' },
    { value: 'HIGH', label: '🟠 High' },
    { value: 'CRITICAL', label: '🔴 Critical' },
  ];

  const statusOptions = [
    { value: 'PLANNING', label: '📋 Planning / Concept' },
    { value: 'IN_PROGRESS', label: '⚡ In Progress / Active' },
    { value: 'ON_HOLD', label: '⏸️ On Hold / Paused' },
    { value: 'COMPLETED', label: '✅ Completed' },
    { value: 'CANCELLED', label: '🚫 Cancelled' },
  ];

  const departmentOptions = [
    { value: '', label: 'Select Project Department...' },
    ...departments.map((dept) => {
      const name = dept.department_name || dept.name || dept.dept_name || `Department #${dept.id}`;
      return {
        value: name,
        label: name,
      };
    }),
  ];

  if (!canCreate) {
    return (
      <div className="space-y-6 animate-fadeIn select-none relative w-full">
        <DashboardPageHeader title="Create New Project" />
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center max-w-md mx-auto my-10 shadow-xs">
          <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Access Denied</h3>
          <p className="text-slate-500 text-xs mb-6">
            You do not have the required permissions (`create_projects`) to create a new project.
          </p>
          <button
            onClick={() => router.push('/dashboard/workbridge/projects')}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors"
          >
            Back to Projects Directory
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn select-none relative w-full pb-12">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 p-6 rounded-2xl text-white shadow-lg border border-indigo-700/40">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
              Work-Bridge Suite
            </span>
            <span className="text-xs text-indigo-300 font-medium">• New Project Wizard</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-indigo-400" /> Create New Workspace Project
          </h1>
          <p className="text-xs text-indigo-200/80">
            Define project attributes, assign leadership, specify timelines, and configure system defaults.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/dashboard/workbridge/projects')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-xs backdrop-blur-md transition-all border border-white/15"
          >
            <ArrowLeft className="w-4 h-4" /> Cancel & Back
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs transition-all shadow-md disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {isSaving ? 'Saving Project...' : 'Save & Publish Project'}
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6 w-full">
        {/* Section 1: System Defaults & Read-only Metadata */}
        <div className="bg-slate-900/5 dark:bg-slate-800/40 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl p-5 w-full">
          <div className="flex items-center justify-between mb-3 border-b border-indigo-100/60 dark:border-indigo-900/30 pb-2">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-xs font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-200">
                System & Organization Metadata (Auto Configured / Non-Editable)
              </h2>
            </div>
            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
              Read-Only System Fields
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Organization</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mt-0.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-500" /> Brihaspathi Technologies
                </span>
              </div>
              <Lock className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
            </div>

            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Auto Reference ID</span>
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 mt-0.5 block">
                  {form.project_code || 'PRJ-AUTO'}
                </span>
              </div>
              <Tag className="w-3.5 h-3.5 text-indigo-400" />
            </div>

            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Initial Health</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> On Track / Active
                </span>
              </div>
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            </div>

            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Created Date</span>
                <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 mt-0.5">
                  <Clock className="w-3.5 h-3.5 text-amber-500" /> {new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <Lock className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
            </div>
          </div>
        </div>

        {/* Section 2: General Project Information */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5 w-full">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">1. Core Project Identification</h3>
              <p className="text-[11px] text-slate-500">Essential identifiers and client affiliation details</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Project Code <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={form.project_code}
                onChange={(e) => setForm({ ...form, project_code: e.target.value })}
                placeholder="e.g. PRJ-1001"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Project Title / Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={form.project_name}
                onChange={(e) => setForm({ ...form, project_name: e.target.value })}
                placeholder="e.g. Enterprise HRMS Mobile App Redesign"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Client Name / Account
              </label>
              <input
                type="text"
                value={form.client_name}
                onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                placeholder="e.g. Brihaspathi Technologies Ltd"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Managerial Leadership, Status & Dates */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5 w-full">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">2. Leadership, Timeline & Department</h3>
              <p className="text-[11px] text-slate-500">Assign project leadership, schedule start/end dates, set priority, and select company department</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Project Manager / Owner
              </label>
              <SearchableSelect
                options={employeeOptions}
                value={form.project_manager_id}
                onChange={(val) => setForm({ ...form, project_manager_id: val })}
                placeholder="Select Project Manager..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Priority Level
              </label>
              <SearchableSelect
                options={priorityOptions}
                value={form.priority}
                onChange={(val) => setForm({ ...form, priority: val })}
                placeholder="Select Priority"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Project Status
              </label>
              <SearchableSelect
                options={statusOptions}
                value={form.status}
                onChange={(val) => setForm({ ...form, status: val })}
                placeholder="Select Status"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Start Date
              </label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => {
                  const newStart = e.target.value;
                  setForm((prev) => {
                    const isEndBeforeStart = prev.end_date && new Date(prev.end_date) < new Date(newStart);
                    return {
                      ...prev,
                      start_date: newStart,
                      end_date: isEndBeforeStart ? '' : prev.end_date,
                    };
                  });
                }}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Target Deadline / End Date
              </label>
              <input
                type="date"
                min={form.start_date}
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Project Department
              </label>
              <SearchableSelect
                options={departmentOptions}
                value={form.category}
                onChange={(val) => setForm({ ...form, category: val })}
                placeholder="Select Project Department..."
              />
            </div>
          </div>
        </div>

        {/* Section 4: Detailed Scope & Goals */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5 w-full">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">3. Scope, Objectives & Deliverables</h3>
              <p className="text-[11px] text-slate-500">Provide complete specifications, technical scope, and team instructions</p>
            </div>
          </div>

          <div>
            <textarea
              rows={6}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Enter detailed project scope, key milestones, deliverables, tech stack details, and instructions for team members..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed font-normal"
            />
          </div>
        </div>

        {/* Action Footer Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between bg-white dark:bg-slate-900 p-5 rounded-2xl text-slate-800 dark:text-slate-100 shadow-sm border border-slate-200/80 dark:border-slate-800 w-full gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Ready to initialize project directory?</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/dashboard/workbridge/projects')}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-7 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all shadow-sm disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {isSaving ? 'Creating Project...' : 'Save & Publish Project'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
