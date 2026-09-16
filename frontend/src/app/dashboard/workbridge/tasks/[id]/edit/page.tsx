'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import DashboardPageHeader from '../../../../components/DashboardPageHeader';
import { getHeaders, API_BASE } from '../../../../utils/api';
import { useDashboard } from '../../../../components/DashboardContext';
import { usePermissions } from '../../../../hooks/usePermissions';
import SearchableSelect from '../../../../components/SearchableSelect';
import {
  ArrowLeft,
  Save,
  CheckSquare,
  Clock,
  Calendar,
  Tag,
  UserCheck,
  Building2,
  Layers,
  FileText,
  Sparkles,
  Check,
  AlertCircle,
  Loader2,
  Trash2
} from 'lucide-react';

export default function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const taskId = resolvedParams.id;
  const router = useRouter();
  const { showToast, companyId: globalCompanyId } = useDashboard();
  const { getPermissionScope, isSuperAdmin, hasPermission } = usePermissions();

  const canEdit = hasPermission('project_tasks_edit');
  const canDelete = hasPermission('project_tasks_delete');

  const activeCompanyId = globalCompanyId;

  const [projects, setProjects] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [allLabels, setAllLabels] = useState<any[]>([]);
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [isLoadingTask, setIsLoadingTask] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(todayStr);
  const [startTime, setStartTime] = useState('09:00');
  const [dueDate, setDueDate] = useState(todayStr);
  const [dueTime, setDueTime] = useState('18:00');
  const [storyPoints, setStoryPoints] = useState('5');
  const [activeQuickRange, setActiveQuickRange] = useState<string>('Today');

  const [form, setForm] = useState({
    project_id: '',
    milestone_id: '',
    task_code: '',
    title: '',
    description: '',
    priority: 'MEDIUM',
    workflow_stage_id: 'STAGE_BACKLOG',
    estimated_hours: '4',
    start_date: todayStr,
    due_date: todayStr,
    due_datetime: `${todayStr}T18:00:00`,
    assigned_to: '',
  });

  useEffect(() => {
    fetchProjects();
    fetchEmployees();
    fetchTaskLabelsMaster();
    if (taskId) {
      fetchTaskDetail(taskId);
      fetchTaskLabels(taskId);
    }
  }, [taskId, activeCompanyId]);

  const fetchTaskLabelsMaster = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/workbridge/labels`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        const rawLabels = data.labels || [];
        const uniqueLabels: any[] = [];
        const seenNames = new Set<string>();
        for (const lbl of rawLabels) {
          const normName = (lbl.name || lbl.label_name || '').trim().toLowerCase();
          if (normName && !seenNames.has(normName)) {
            seenNames.add(normName);
            uniqueLabels.push(lbl);
          }
        }
        setAllLabels(uniqueLabels);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchProjects = async () => {
    try {
      const cid = activeCompanyId || localStorage.getItem('companyId');
      const url = cid && cid !== 'all' ? `${API_BASE}/api/v1/workbridge/projects?company_id=${cid}` : `${API_BASE}/api/v1/workbridge/projects`;
      const res = await fetch(url, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMilestones = async (projId: string) => {
    if (!projId) {
      setMilestones([]);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/v1/workbridge/milestones?project_id=${projId}`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setMilestones(data.milestones || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchEmployees = async () => {
    try {
      const cid = activeCompanyId || localStorage.getItem('companyId');
      const url = cid && cid !== 'all' ? `${API_BASE}/api/v1/employees?company_id=${cid}` : `${API_BASE}/api/v1/employees`;
      const res = await fetch(url, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        const empList = Array.isArray(data) ? data : (data.employees || []);

        const taskScope = getPermissionScope('project_tasks');
        if (!isSuperAdmin && taskScope === 'SELF') {
          let currentEmpId = '';
          try {
            const profileStr = localStorage.getItem('myProfile');
            if (profileStr) {
              const prof = JSON.parse(profileStr);
              currentEmpId = prof.id || prof.employeeId || '';
            }
          } catch {}

          const userEmail = (localStorage.getItem('email') || '').toLowerCase();
          const filtered = empList.filter((e: any) =>
            (currentEmpId && e.id === currentEmpId) ||
            ((e.email || '').toLowerCase() === userEmail && userEmail.length > 0)
          );
          setEmployees(filtered);
        } else {
          setEmployees(empList);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTaskDetail = async (id: string) => {
    setIsLoadingTask(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/workbridge/tasks/${id}`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        const task = data.task || data;
        if (task) {
          const sDate = task.start_date ? new Date(task.start_date).toISOString().split('T')[0] : todayStr;
          let dDate = task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : todayStr;
          let dTime = '18:00';
          if (task.due_datetime) {
            const dt = new Date(task.due_datetime);
            dDate = dt.toISOString().split('T')[0];
            dTime = dt.toTimeString().slice(0, 5);
          }

          setStartDate(sDate);
          setDueDate(dDate);
          setDueTime(dTime);
          setForm({
            project_id: task.project_id || '',
            milestone_id: task.milestone_id || '',
            task_code: task.task_code || '',
            title: task.title || task.task_name || '',
            description: task.description || '',
            priority: task.priority || 'MEDIUM',
            workflow_stage_id: task.status || 'STAGE_BACKLOG',
            estimated_hours: String((task.estimated_minutes || 240) / 60),
            start_date: sDate,
            due_date: dDate,
            due_datetime: task.due_datetime || `${dDate}T${dTime}:00`,
            assigned_to: task.assigned_to || '',
          });

          if (task.project_id) fetchMilestones(task.project_id);
        }
      } else {
        showToast('Task not found', 'error');
      }
    } catch (e) {
      showToast('Error loading task details', 'error');
    } finally {
      setIsLoadingTask(false);
    }
  };

  const fetchTaskLabels = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/workbridge/tasks/${id}/labels`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSelectedLabelIds((data.labels || []).map((l: any) => l.label_id || l.id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const toggleLabelSelection = (labelId: string) => {
    if (selectedLabelIds.includes(labelId)) {
      setSelectedLabelIds(selectedLabelIds.filter((id) => id !== labelId));
    } else {
      if (selectedLabelIds.length >= 4) {
        showToast('Maximum 4 labels allowed per task!', 'error');
        return;
      }
      setSelectedLabelIds([...selectedLabelIds, labelId]);
    }
  };

  const handleQuickRange = (days: number, label: string) => {
    setActiveQuickRange(label);
    const now = new Date();
    const end = new Date(now);

    if (days === 0) {
      setStartDate(todayStr);
      setStartTime('09:00');
      setDueDate(todayStr);
      setDueTime('18:00');
      setForm((prev) => ({
        ...prev,
        start_date: todayStr,
        due_date: todayStr,
        due_datetime: `${todayStr}T18:00:00`,
        estimated_hours: '9',
      }));
    } else {
      end.setDate(now.getDate() + (days - 1));
      const endStr = end.toISOString().split('T')[0];
      setStartDate(todayStr);
      setStartTime('09:00');
      setDueDate(endStr);
      setDueTime('18:00');
      const estHours = (days * 8).toString();
      setForm((prev) => ({
        ...prev,
        start_date: todayStr,
        due_date: endStr,
        due_datetime: `${endStr}T18:00:00`,
        estimated_hours: estHours,
      }));
    }
  };

  const handleStartChange = (sDate: string, sTime: string) => {
    setStartDate(sDate);
    setStartTime(sTime);
    const combinedDue = `${dueDate}T${dueTime}:00`;
    setForm((prev) => ({
      ...prev,
      start_date: sDate,
      due_datetime: combinedDue,
    }));
  };

  const handleEndChange = (eDate: string, eTime: string) => {
    setDueDate(eDate);
    setDueTime(eTime);
    const combinedDue = `${eDate}T${eTime}:00`;
    setForm((prev) => ({
      ...prev,
      due_date: eDate,
      due_datetime: combinedDue,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      showToast('You do not have permission to edit tasks', 'error');
      return;
    }
    if (!form.title.trim()) {
      showToast('Please enter Task Title', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const cid = activeCompanyId || localStorage.getItem('companyId');
      const payload = {
        ...form,
        start_date: startDate,
        due_date: dueDate,
        due_datetime: `${dueDate}T${dueTime}:00`,
        company_id: cid,
      };

      const res = await fetch(`${API_BASE}/api/v1/workbridge/tasks/${taskId}`, {
        method: 'PUT',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        if (selectedLabelIds.length >= 0) {
          const finalLabels = selectedLabelIds.slice(0, 4);
          await fetch(`${API_BASE}/api/v1/workbridge/tasks/${taskId}/labels`, {
            method: 'POST',
            headers: { ...getHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ label_ids: finalLabels }),
          });
        }

        showToast('Task updated successfully! 🚀', 'success');
        router.push('/dashboard/workbridge/tasks');
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to update task', 'error');
      }
    } catch (e) {
      showToast('Network error updating task', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!canDelete) {
      showToast('You do not have permission to delete tasks', 'error');
      return;
    }
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/workbridge/tasks/${taskId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (res.ok) {
        showToast('Task deleted successfully', 'success');
        router.push('/dashboard/workbridge/tasks');
      } else {
        showToast('Failed to delete task', 'error');
      }
    } catch (e) {
      showToast('Error deleting task', 'error');
    }
  };

  const projectOptions = [
    { value: '', label: 'Standalone / General Task (No Project)' },
    ...projects.map((p: any) => ({
      value: p.id,
      label: `${p.project_name} (${p.project_code})`,
    })),
  ];

  const milestoneOptions = [
    { value: '', label: 'None (No Milestone)' },
    ...milestones.map((m: any) => ({
      value: m.id,
      label: m.milestone_name || m.title,
    })),
  ];

  const employeeOptions = [
    { value: '', label: 'Assign to Myself (Self Task)' },
    ...employees.map((e: any) => ({
      value: e.id,
      label: `${e.first_name || ''} ${e.last_name || ''} (${e.emp_id_code || 'EMP'})`.trim(),
    })),
  ];

  if (isLoadingTask) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] py-20">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-xs font-bold text-slate-500 mt-3">Loading task data...</p>
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
            <span className="text-xs text-indigo-300 font-medium">• Edit Task ({form.task_code})</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-indigo-400" /> Edit Task: {form.title}
          </h1>
          <p className="text-xs text-indigo-200/80">
            Update task scope, assignment, timeline schedule, and project details.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {canDelete && (
            <button
              type="button"
              onClick={handleDelete}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-600/80 hover:bg-rose-700 text-white font-bold rounded-xl text-xs backdrop-blur-md transition-all border border-rose-500/30"
            >
              <Trash2 className="w-4 h-4" /> Delete Task
            </button>
          )}
          <button
            type="button"
            onClick={() => router.push('/dashboard/workbridge/tasks')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-xs backdrop-blur-md transition-all border border-white/15"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Tasks
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Full-width 2-column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Left Main Column (7 cols) */}
          <div className="lg:col-span-7 space-y-6">

            {/* Combined Card 1: Task Title & Description (Req 3) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 md:p-7 shadow-sm transition-all hover:shadow-md">
              <div className="flex items-center gap-3 mb-6 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                    Task Details & Description
                  </h2>
                  <p className="text-[11px] text-slate-400 font-medium">Specify the task title, code, and detailed instructions.</p>
                </div>
              </div>

              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                  <div className="md:col-span-4">
                    <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-2">
                      Task Code
                    </label>
                    <input
                      type="text"
                      value={form.task_code}
                      onChange={(e) => setForm({ ...form, task_code: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-2xl px-4 py-3 text-xs font-mono font-black text-blue-600 dark:text-blue-400 outline-none focus:ring-2 focus:ring-blue-500 uppercase tracking-wider"
                    />
                  </div>

                  <div className="md:col-span-8">
                    <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-2">
                      Task Title <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder="e.g. Implement OAuth JWT Refresh Endpoint"
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl px-4 py-3 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-2">
                    Description & Instructions
                  </label>
                  <textarea
                    rows={5}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Provide task specs, acceptance criteria, or specific execution guidelines..."
                    className="w-full bg-slate-50/50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-2xl p-4 text-xs font-medium text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-purple-500 shadow-2xs leading-relaxed"
                  />
                </div>
              </div>
            </div>

            {/* Card 2: Project & Milestone (Optional Project) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 md:p-7 shadow-sm transition-all hover:shadow-md">
              <div className="flex items-center gap-3 mb-6 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="w-9 h-9 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                    Project & Milestone
                  </h2>
                  <p className="text-[11px] text-slate-400 font-medium">Link this task to a project or keep it as a standalone task.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-2">
                    Project (Optional)
                  </label>
                  <SearchableSelect
                    options={projectOptions}
                    value={form.project_id}
                    onChange={(val: string) => {
                      setForm({ ...form, project_id: val, milestone_id: '' });
                      fetchMilestones(val);
                    }}
                    placeholder="Select Project or Standalone..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-2">
                    Milestone (Optional)
                  </label>
                  <SearchableSelect
                    options={milestoneOptions}
                    value={form.milestone_id}
                    onChange={(val: string) => setForm({ ...form, milestone_id: val })}
                    placeholder="Link to milestone..."
                  />
                </div>
              </div>
            </div>

            {/* Card 3: Task Tags & Master Labels */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 md:p-7 shadow-sm transition-all hover:shadow-md">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center">
                    <Tag className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                      Task Tags / Labels
                    </h2>
                    <p className="text-[11px] text-slate-400 font-medium">Attach category tags to categorize this task.</p>
                  </div>
                </div>

                <span className={`text-xs font-black px-3 py-1 rounded-full ${selectedLabelIds.length >= 4 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
                  {selectedLabelIds.length} / 4 Selected
                </span>
              </div>

              {allLabels.length === 0 ? (
                <div className="text-xs text-slate-400 italic">No master labels configured</div>
              ) : (
                <div className="flex flex-wrap gap-2.5 p-4 bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl">
                  {allLabels.map((lbl) => {
                    const isSelected = selectedLabelIds.includes(lbl.id);
                    const color = lbl.color_code || lbl.label_color || '#2563eb';
                    const name = lbl.name || lbl.label_name;
                    return (
                      <button
                        key={lbl.id}
                        type="button"
                        onClick={() => toggleLabelSelection(lbl.id)}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                          isSelected ? 'shadow-md ring-2 ring-blue-500 scale-105' : 'opacity-75 hover:opacity-100 hover:scale-102'
                        }`}
                        style={{
                          backgroundColor: isSelected ? `${color}25` : `${color}10`,
                          borderColor: isSelected ? color : `${color}40`,
                          color: color,
                        }}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        <span>{name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* Right Side Column (5 cols) */}
          <div className="lg:col-span-5 space-y-6">

            {/* Card 4: Schedule (Image 2 style) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-black text-slate-900 dark:text-white">
                  Schedule
                </h2>
              </div>

              {/* START (DATE AND TIME) */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  START (DATE AND TIME)
                </label>
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-7">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => handleStartChange(e.target.value, startTime)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="col-span-5">
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => handleStartChange(startDate, e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* END (DATE AND TIME) */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  END (DATE AND TIME)
                </label>
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-7">
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => handleEndChange(e.target.value, dueTime)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="col-span-5">
                    <input
                      type="time"
                      value={dueTime}
                      onChange={(e) => handleEndChange(dueDate, e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* QUICK RANGE */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  QUICK RANGE
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'Today', days: 0 },
                    { label: '2 days', days: 2 },
                    { label: '3 days', days: 3 },
                    { label: '4 days', days: 4 },
                    { label: '5 days', days: 5 },
                  ].map((range) => (
                    <button
                      key={range.label}
                      type="button"
                      onClick={() => handleQuickRange(range.days, range.label)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                        activeQuickRange === range.label
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration & Story points */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Duration (working time)
                  </label>
                  <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-white">
                    {form.estimated_hours ? `${form.estimated_hours}h` : '4h'}
                    <span className="block text-[10px] text-slate-400 font-normal mt-0.5">
                      Calendar span: {form.estimated_hours ? `${form.estimated_hours}h` : '4h'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Story points
                  </label>
                  <SearchableSelect
                    options={[
                      { value: '1', label: '1' },
                      { value: '2', label: '2' },
                      { value: '3', label: '3' },
                      { value: '5', label: '5' },
                      { value: '8', label: '8' },
                      { value: '13', label: '13' },
                    ]}
                    value={storyPoints}
                    onChange={(val: string) => setStoryPoints(val)}
                  />
                </div>
              </div>
            </div>

            {/* Card 5: Assignment & Workflow */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="w-9 h-9 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                    Assignee & Workflow
                  </h2>
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-2">
                  Assignee Employee
                </label>
                <SearchableSelect
                  options={employeeOptions}
                  value={form.assigned_to}
                  onChange={(val: string) => setForm({ ...form, assigned_to: val })}
                  placeholder="Select Assignee..."
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-2">
                  Priority Level
                </label>
                <SearchableSelect
                  options={[
                    { value: 'LOW', label: 'Low Priority 🟢' },
                    { value: 'MEDIUM', label: 'Medium Priority 🔵' },
                    { value: 'HIGH', label: 'High Priority 🟠' },
                    { value: 'CRITICAL', label: 'Critical Priority 🔴' },
                  ]}
                  value={form.priority}
                  onChange={(val: string) => setForm({ ...form, priority: val })}
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-2">
                  Workflow Stage
                </label>
                <SearchableSelect
                  options={[
                    { value: 'STAGE_BACKLOG', label: 'Backlog 📋' },
                    { value: 'STAGE_IN_PROGRESS', label: 'In Progress ⚡' },
                    { value: 'STAGE_IN_REVIEW', label: 'In Review 🔍' },
                    { value: 'STAGE_DONE', label: 'Completed ✅' },
                  ]}
                  value={form.workflow_stage_id}
                  onChange={(val: string) => setForm({ ...form, workflow_stage_id: val })}
                />
              </div>
            </div>

            {/* Action Buttons Box - Side by Side Cancel & Save (Req 4) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 shadow-md">
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => router.push('/dashboard/workbridge/tasks')}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-extrabold rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !canEdit}
                  className="inline-flex items-center justify-center gap-2 py-2.5 px-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-black rounded-xl text-xs shadow-md transition-all disabled:opacity-50 tracking-wider uppercase"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>{isSaving ? 'Updating...' : 'Update Task'}</span>
                </button>
              </div>
            </div>

          </div>

        </div>
      </form>
    </div>
  );
}
