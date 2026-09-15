'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DashboardPageHeader from '../../components/DashboardPageHeader';
import { getHeaders, API_BASE } from '../../utils/api';
import SlideDrawer from '../../components/SlideDrawer';
import { useDashboard } from '../../components/DashboardContext';
import { usePermissions } from '../../hooks/usePermissions';
import SearchableSelect from '../../components/SearchableSelect';
import {
  CheckSquare,
  Plus,
  Play,
  Square,
  Clock,
  User,
  Calendar,
  Tag,
  Filter,
  Kanban,
  List,
  Edit2,
  Trash2,
  ExternalLink,
  FolderKanban,
  Search,
  CheckCircle2,
  Zap,
  Check,
  Layers
} from 'lucide-react';

export default function WorkBridgeTasksPage() {
  const router = useRouter();
  const { showToast, companyId: globalCompanyId } = useDashboard();
  const { hasPermission, getPermissionScope, isSuperAdmin } = usePermissions();

  const canCreate = isSuperAdmin || hasPermission('project_tasks_create') || hasPermission('create_project_tasks') || hasPermission('create_tasks') || hasPermission('create');
  const canEdit = isSuperAdmin || hasPermission('project_tasks_edit') || hasPermission('edit_project_tasks') || hasPermission('edit_tasks') || hasPermission('edit');
  const canDelete = isSuperAdmin || hasPermission('project_tasks_delete') || hasPermission('delete_project_tasks') || hasPermission('delete_tasks') || hasPermission('delete');

  const activeCompanyId = globalCompanyId;

  const [projects, setProjects] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [activeTimers, setActiveTimers] = useState<Record<string, any>>({});
  const [allLabels, setAllLabels] = useState<any[]>([]);
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Filters
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [selectedStageFilter, setSelectedStageFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Form & Modal
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [form, setForm] = useState({
    project_id: '',
    milestone_id: '',
    task_code: '',
    title: '',
    description: '',
    priority: 'MEDIUM',
    workflow_stage_id: 'STAGE_BACKLOG',
    estimated_hours: '4',
    due_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    due_datetime: '',
    assigned_to: '',
  });

  const defaultStages = [
    { id: 'STAGE_BACKLOG', name: 'Backlog', color_code: '#64748b' },
    { id: 'STAGE_IN_PROGRESS', name: 'In Progress', color_code: '#2563eb' },
    { id: 'STAGE_IN_REVIEW', name: 'In Review', color_code: '#d97706' },
    { id: 'STAGE_DONE', name: 'Completed', color_code: '#16a34a' },
  ];

  const [workflowStages, setWorkflowStages] = useState<any[]>(defaultStages);

  useEffect(() => {
    fetchProjects();
    fetchEmployees();
    fetchActiveTimers();
    fetchLabels();
    fetchWorkflowStages();
  }, [activeCompanyId]);

  useEffect(() => {
    fetchTasks();
  }, [activeCompanyId, selectedProjectId, selectedPriority]);

  const fetchWorkflowStages = async () => {
    try {
      const cid = activeCompanyId || localStorage.getItem('companyId');
      const url = cid && cid !== 'all' ? `${API_BASE}/api/v1/workbridge/workflows?company_id=${cid}` : `${API_BASE}/api/v1/workbridge/workflows`;
      const res = await fetch(url, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        const list = data.workflows || [];
        if (list.length > 0) {
          setWorkflowStages(list.map((w: any) => ({
            id: w.status_key,
            name: w.status_label,
            color_code: w.status_color || '#2563eb',
          })));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLabels = async () => {
    try {
      const cid = activeCompanyId || localStorage.getItem('companyId');
      const url = cid && cid !== 'all' ? `${API_BASE}/api/v1/workbridge/labels?company_id=${cid}` : `${API_BASE}/api/v1/workbridge/labels`;
      const res = await fetch(url, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setAllLabels(data.labels || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchProjects = async () => {
    try {
      const cid = activeCompanyId || localStorage.getItem('companyId');
      const url = cid && cid !== 'all'
        ? `${API_BASE}/api/v1/workbridge/projects?company_id=${cid}`
        : `${API_BASE}/api/v1/workbridge/projects`;
      const res = await fetch(url, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
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
        
        // Data scope filter for assignees dropdown using exact Employee UUID (id)
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

  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      const cid = activeCompanyId || localStorage.getItem('companyId');
      const params = new URLSearchParams();
      if (cid && cid !== 'all') params.append('company_id', cid);
      if (selectedProjectId !== 'ALL') params.append('project_id', selectedProjectId);
      if (selectedPriority !== 'ALL') params.append('priority', selectedPriority);

      const res = await fetch(`${API_BASE}/api/v1/workbridge/tasks?${params.toString()}`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch (e) {
      console.error(e);
      showToast('Error loading tasks', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTaskLabels = async (taskId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/workbridge/tasks/${taskId}/labels`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSelectedLabelIds((data.labels || []).map((l: any) => l.label_id || l.id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchActiveTimers = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/workbridge/timer/active`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        const timerMap: Record<string, any> = {};
        if (data.active_timer) {
          timerMap[data.active_timer.task_id] = data.active_timer;
        }
        setActiveTimers(timerMap);
      }
    } catch (e) {}
  };

  const handleToggleTimer = async (taskId: string) => {
    const isRunning = !!activeTimers[taskId];
    try {
      const endpoint = isRunning ? '/api/v1/workbridge/timer/stop' : '/api/v1/workbridge/timer/start';
      const body = isRunning ? {} : { task_id: taskId };
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        showToast(isRunning ? 'Timer stopped & saved! ⏱️' : 'Live timer started ⏱️', 'success');
        fetchActiveTimers();
        fetchTasks();
      } else {
        const err = await res.json();
        showToast(err.error || 'Timer action failed', 'error');
      }
    } catch (e) {
      showToast('Error managing timer', 'error');
    }
  };

  const handleOpenDrawer = (task?: any) => {
    if (!task) {
      router.push('/dashboard/workbridge/tasks/create');
      return;
    }
    setEditingTask(task);
    setForm({
      project_id: task.project_id || '',
      milestone_id: task.milestone_id || '',
      task_code: task.task_code || '',
      title: task.title || task.task_name || '',
      description: task.description || '',
      priority: task.priority || 'MEDIUM',
      workflow_stage_id: task.status || 'STAGE_BACKLOG',
      estimated_hours: String((task.estimated_minutes || 240) / 60),
      due_date: task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : '',
      due_datetime: task.due_datetime ? new Date(task.due_datetime).toISOString().slice(0, 16) : '',
      assigned_to: task.assigned_to || '',
    });
    if (task.project_id) fetchMilestones(task.project_id);
    fetchTaskLabels(task.id);
    setDrawerOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.project_id || !form.title.trim()) {
      showToast('Please specify Project and Task Title', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const cid = activeCompanyId || localStorage.getItem('companyId');
      const payload = {
        ...form,
        company_id: cid,
      };

      const url = editingTask
        ? `${API_BASE}/api/v1/workbridge/tasks/${editingTask.id}`
        : `${API_BASE}/api/v1/workbridge/tasks`;
      const method = editingTask ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const resData = await res.json();
        const savedTaskId = editingTask ? editingTask.id : (resData.task?.id || resData.id);

        // Save selected label mappings (max 4 enforced)
        if (savedTaskId) {
          const finalLabels = selectedLabelIds.slice(0, 4);
          await fetch(`${API_BASE}/api/v1/workbridge/tasks/${savedTaskId}/labels`, {
            method: 'POST',
            headers: { ...getHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ label_ids: finalLabels }),
          });
        }

        showToast(editingTask ? 'Task updated!' : 'Task created!', 'success');
        setDrawerOpen(false);
        fetchTasks();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to save task', 'error');
      }
    } catch (e) {
      showToast('Network error saving task', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleLabelSelection = (labelId: string) => {
    if (selectedLabelIds.includes(labelId)) {
      setSelectedLabelIds(selectedLabelIds.filter(id => id !== labelId));
    } else {
      if (selectedLabelIds.length >= 4) {
        showToast('Maximum 4 labels allowed per task!', 'error');
        return;
      }
      setSelectedLabelIds([...selectedLabelIds, labelId]);
    }
  };

  const handleUpdateStage = async (taskId: string, stageId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/workbridge/tasks/${taskId}`, {
        method: 'PUT',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: stageId }),
      });
      if (res.ok) {
        showToast('Task status updated! 🚀', 'success');
        fetchTasks();
      }
    } catch (e) {
      showToast('Failed to update stage', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/workbridge/tasks/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (res.ok) {
        showToast('Task deleted', 'success');
        fetchTasks();
      }
    } catch (e) {
      showToast('Error deleting task', 'error');
    }
  };

  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      (t.title || t.task_name)?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.task_code?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStage = selectedStageFilter === 'ALL' || (t.status || 'STAGE_BACKLOG') === selectedStageFilter;
    return matchesSearch && matchesStage;
  });

  const getStageInfo = (statusKey?: string) => {
    const st = workflowStages.find((s) => s.id === statusKey);
    if (st) return st;
    return { name: statusKey || 'Backlog', color_code: '#2563eb' };
  };

  const formatTimeWorked = (minutes?: number) => {
    const mins = Number(minutes) || 0;
    if (mins === 0) return '0m';
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hrs === 0) return `${remMins}m`;
    if (remMins === 0) return `${hrs}h`;
    return `${hrs}h ${remMins}m`;
  };

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'URGENT':
      case 'CRITICAL':
        return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900';
      case 'HIGH':
        return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-900';
      case 'LOW':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900';
      case 'MEDIUM':
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900';
    }
  };

  const projectFilterOptions = [
    { value: 'ALL', label: 'All Projects' },
    ...projects.map((p) => ({
      value: p.id,
      label: `${p.project_name} (${p.project_code || 'PRJ'})`,
    })),
  ];

  const projectFormOptions = projects.map((p) => ({
    value: p.id,
    label: `${p.project_name} (${p.project_code || 'PRJ'})`,
  }));

  const milestoneFormOptions = [
    { value: '', label: 'None (No Milestone)' },
    ...milestones.map((m) => ({
      value: m.id,
      label: m.milestone_name || m.title,
    })),
  ];

  const employeeFormOptions = [
    { value: '', label: 'Assign to Myself (Self Task)' },
    ...employees.map((e) => ({
      value: e.id,
      label: `${e.first_name || ''} ${e.last_name || ''} (${e.emp_id_code || e.email || 'EMP'})`.trim(),
    })),
  ];

  return (
    <div className="space-y-6 animate-fadeIn select-none relative">
      <DashboardPageHeader
        title="Task Board"
        subtitle="Manage sprint tasks, Kanban stage progression, live timers, and team tags"
      />

      {/* Main Container */}
      <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/80 bg-card p-6 shadow-2xs space-y-6">
        
        {/* Top Header Controls & Stage Tabs */}
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-5">
          
          {/* Stage Filter Tabs (All, Backlog, In Progress, In Review, Completed) */}
          <div className="flex flex-wrap items-center gap-1.5 w-full lg:w-auto">
            <button
              onClick={() => setSelectedStageFilter('ALL')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedStageFilter === 'ALL'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>All Tasks</span>
              <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-extrabold ${
                selectedStageFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}>
                {tasks.length}
              </span>
            </button>

            {workflowStages.map((st) => {
              const isActive = selectedStageFilter === st.id;
              const count = tasks.filter(t => (t.status || 'STAGE_BACKLOG') === st.id).length;
              return (
                <button
                  key={st.id}
                  onClick={() => setSelectedStageFilter(st.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: st.color_code }} />
                  <span>{st.name}</span>
                  <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-extrabold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right Filters & Action Bar */}
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-between lg:justify-end">
            <div className="w-full sm:w-48">
              <SearchableSelect
                options={projectFilterOptions}
                value={selectedProjectId}
                onChange={(val) => setSelectedProjectId(val)}
                placeholder="All Projects"
              />
            </div>

            <div className="w-full sm:w-36">
              <SearchableSelect
                options={[
                  { value: 'ALL', label: 'All Priorities' },
                  { value: 'URGENT', label: 'Urgent / Critical' },
                  { value: 'HIGH', label: 'High Priority' },
                  { value: 'MEDIUM', label: 'Medium Priority' },
                  { value: 'LOW', label: 'Low Priority' },
                ]}
                value={selectedPriority}
                onChange={(val) => setSelectedPriority(val)}
                placeholder="All Priorities"
              />
            </div>

            <div className="relative w-full sm:w-40">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-all"
              />
            </div>

            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'grid' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs' : 'text-slate-500'
                }`}
                title="Grid View"
              >
                <Kanban className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'list' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs' : 'text-slate-500'
                }`}
                title="List View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {canCreate && (
              <button
                onClick={() => router.push('/dashboard/workbridge/tasks/create')}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition-all text-xs shrink-0"
              >
                <Plus className="w-4 h-4" /> Create Task
              </button>
            )}
          </div>
        </div>

        {/* Task Cards Grid View or List View */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <div className="w-8 h-8 rounded-full border-3 border-blue-600 border-t-transparent animate-spin" />
            <span className="text-xs font-semibold text-slate-500">Loading Task Board...</span>
          </div>
        ) : filteredTasks.length === 0 ? (
          /* Single Clean Empty State — No Big Empty Columns */
          <div className="bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-12 text-center max-w-md mx-auto my-6">
            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950/50 rounded-2xl flex items-center justify-center mx-auto mb-3 text-blue-600 dark:text-blue-400">
              <CheckSquare className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">No Tasks Found</h3>
            <p className="text-slate-500 text-xs mb-5 leading-relaxed">
              No tasks match your current filter query.
            </p>
            {canCreate && (
              <button
                onClick={() => router.push('/dashboard/workbridge/tasks/create')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs text-xs transition-all"
              >
                <Plus className="w-4 h-4" /> Create New Task
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          /* ELEGANT & CLEAN TASK CARDS GRID VIEW */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredTasks.map((task) => {
              const isTimerRunning = !!activeTimers[task.id];
              const taskLabels = Array.isArray(task.labels) ? task.labels.slice(0, 4) : [];
              const stInfo = getStageInfo(task.status);

              return (
                <div
                  key={task.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-2xs hover:shadow-md hover:border-blue-400 dark:hover:border-blue-600 transition-all duration-200 flex flex-col justify-between space-y-3 relative group"
                >
                  <div className="space-y-2.5">
                    {/* TOP HEADER: Stage Pill + Task Code + Priority */}
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800"
                          style={{ color: stInfo.color_code }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: stInfo.color_code }} />
                          {stInfo.name}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400">
                          {task.task_code}
                        </span>
                      </div>

                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getPriorityBadge(task.priority)}`}>
                        {task.priority}
                      </span>
                    </div>

                    {/* Task Title */}
                    <Link
                      href={`/dashboard/workbridge/tasks/${task.id}`}
                      className="block font-bold text-slate-900 dark:text-white text-xs hover:text-blue-600 dark:hover:text-blue-400 transition-colors leading-snug"
                    >
                      {task.title || task.task_name}
                    </Link>

                    {/* Task Description Snippet */}
                    {task.description && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 font-normal bg-slate-50/60 dark:bg-slate-800/30 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                        {task.description}
                      </p>
                    )}

                    {/* Task Labels */}
                    {taskLabels.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {taskLabels.map((lbl: any, lIdx: number) => (
                          <span
                            key={lbl.id || lIdx}
                            className="px-2 py-0.5 rounded-md text-[10px] font-bold border truncate max-w-[100px]"
                            style={{
                              backgroundColor: `${lbl.color_code || '#2563eb'}15`,
                              borderColor: `${lbl.color_code || '#2563eb'}30`,
                              color: lbl.color_code || '#2563eb',
                            }}
                          >
                            {lbl.name}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Clean Minimal Metadata */}
                    <div className="space-y-1.5 text-[11px] text-slate-500 font-medium pt-1">
                      {/* Project Name */}
                      <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                        <FolderKanban className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span className="truncate font-semibold text-[11px]">
                          {task.project_name ? task.project_name : 'Standalone Task'}
                        </span>
                      </div>

                      {/* Time Worked & End Date Row */}
                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <Link
                          href="/dashboard/workbridge/timesheets"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-800/50 hover:underline"
                          title="Click to view full Timesheets logs"
                        >
                          <Clock className="w-3 h-3 text-emerald-500 shrink-0" />
                          <span>Worked: {formatTimeWorked(task.total_logged_minutes)}</span>
                          {isTimerRunning && (
                            <span className="text-[9px] bg-red-600 text-white px-1 py-0.5 rounded font-extrabold animate-pulse ml-0.5">
                              LIVE
                            </span>
                          )}
                        </Link>

                        <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                          <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>
                            {task.due_datetime ? new Date(task.due_datetime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : (task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No End Date')}
                          </span>
                        </div>
                      </div>

                      {/* Assignee */}
                      <div className="flex items-center gap-1.5 text-slate-500 pt-0.5">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate text-[11px]">{task.assignee_name || 'Self / Unassigned'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <button
                      onClick={() => handleToggleTimer(task.id)}
                      className={`px-2.5 py-1 rounded-lg border font-bold text-[11px] flex items-center gap-1.5 transition-all ${
                        isTimerRunning
                          ? 'bg-red-50 text-red-700 border-red-200 animate-pulse'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:text-blue-600 hover:border-blue-300'
                      }`}
                      title={isTimerRunning ? 'Stop Live Timer' : 'Start Live Timer'}
                    >
                      {isTimerRunning ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                      <span>{isTimerRunning ? 'Stop Timer' : 'Timer'}</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <select
                        value={task.status || 'STAGE_BACKLOG'}
                        onChange={(e) => handleUpdateStage(task.id, e.target.value)}
                        className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] text-slate-700 dark:text-slate-300 px-2 py-1 focus:outline-none font-bold"
                      >
                        {workflowStages.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>

                      {canEdit && (
                        <button
                          onClick={() => router.push(`/dashboard/workbridge/tasks/${task.id}/edit`)}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          title="Edit Task"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(task.id)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          title="Delete Task"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* LIST VIEW */
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-800 dark:text-white">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Title & Labels</th>
                    <th className="px-4 py-3">Project</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {filteredTasks.map((t) => {
                    const taskLabels = Array.isArray(t.labels) ? t.labels.slice(0, 4) : [];
                    return (
                      <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 font-mono text-blue-700 dark:text-blue-400 font-bold text-xs">{t.task_code}</td>
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white space-y-1">
                          <Link href={`/dashboard/workbridge/tasks/${t.id}`} className="hover:underline flex items-center gap-1.5">
                            {t.title || t.task_name} <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                          </Link>
                          {taskLabels.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {taskLabels.map((lbl: any, lIdx: number) => (
                                <span
                                  key={lbl.id || lIdx}
                                  className="px-2 py-0.5 rounded-md text-[10px] font-extrabold border"
                                  style={{
                                    backgroundColor: `${lbl.color_code || '#2563eb'}20`,
                                    borderColor: `${lbl.color_code || '#2563eb'}45`,
                                    color: lbl.color_code || '#2563eb',
                                  }}
                                >
                                  {lbl.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs">{t.project_name || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getPriorityBadge(t.priority)}`}>
                            {t.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={t.status || 'STAGE_BACKLOG'}
                            onChange={(e) => handleUpdateStage(t.id, e.target.value)}
                            className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-800 dark:text-white px-2 py-1 focus:outline-none font-semibold"
                          >
                            {workflowStages.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleToggleTimer(t.id)}
                              className={`p-1.5 rounded-lg border transition-all ${
                                activeTimers[t.id]
                                  ? 'bg-red-50 text-red-600 border-red-200 animate-pulse'
                                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:text-blue-600'
                              }`}
                              title="Timer"
                            >
                              {activeTimers[t.id] ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                            </button>
                            {canEdit && (
                              <button
                                onClick={() => router.push(`/dashboard/workbridge/tasks/${t.id}/edit`)}
                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => handleDelete(t.id)}
                                className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Slide Drawer */}
      <SlideDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingTask ? `Edit Task (${form.task_code}) 📌` : 'Create New Task 📌'}
      >
        <form onSubmit={handleSave} className="space-y-4 text-slate-800 dark:text-white">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Project *</label>
              <SearchableSelect
                options={projectFormOptions}
                value={form.project_id}
                onChange={(val) => {
                  setForm({ ...form, project_id: val, milestone_id: '' });
                  fetchMilestones(val);
                }}
                placeholder="Search Project..."
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Milestone</label>
              <SearchableSelect
                options={milestoneFormOptions}
                value={form.milestone_id}
                onChange={(val) => setForm({ ...form, milestone_id: val })}
                placeholder="Search Milestone..."
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Task Title *</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Implement OAuth JWT Refresh Endpoint"
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Assignee (Assign / Reassign Task)</label>
            <SearchableSelect
              options={employeeFormOptions}
              value={form.assigned_to}
              onChange={(val) => setForm({ ...form, assigned_to: val })}
              placeholder="Select Assignee..."
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Priority</label>
              <SearchableSelect
                options={[
                  { value: 'LOW', label: 'Low' },
                  { value: 'MEDIUM', label: 'Medium' },
                  { value: 'HIGH', label: 'High' },
                  { value: 'CRITICAL', label: 'Critical' },
                ]}
                value={form.priority}
                onChange={(val) => setForm({ ...form, priority: val })}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Estimated Hours</label>
              <input
                type="number"
                step="0.5"
                value={form.estimated_hours}
                onChange={(e) => setForm({ ...form, estimated_hours: e.target.value })}
                placeholder="e.g. 4"
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Target Due Time</label>
              <input
                type="datetime-local"
                value={form.due_datetime}
                onChange={(e) => setForm({ ...form, due_datetime: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
              />
            </div>
          </div>

          {/* TASK LABELS MULTI-SELECT CHIPS (Strictly Max 4 Limit Enforced) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-blue-600" /> Task Labels / Tags
              </span>
              <span className={`text-[10px] font-extrabold ${selectedLabelIds.length >= 4 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
                ({selectedLabelIds.length}/4 Selected)
              </span>
            </label>
            
            {allLabels.length === 0 ? (
              <div className="text-xs text-slate-400 italic">No master labels configured</div>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
                {allLabels.map((lbl) => {
                  const isSelected = selectedLabelIds.includes(lbl.id);
                  const color = lbl.color_code || lbl.label_color || '#2563eb';
                  const name = lbl.name || lbl.label_name;
                  return (
                    <button
                      key={lbl.id}
                      type="button"
                      onClick={() => toggleLabelSelection(lbl.id)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
                        isSelected ? 'shadow-2xs ring-1 ring-blue-500 scale-[1.02]' : 'opacity-70 hover:opacity-100'
                      }`}
                      style={{
                        backgroundColor: isSelected ? `${color}30` : `${color}10`,
                        borderColor: isSelected ? color : `${color}40`,
                        color: color,
                      }}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      <span>{name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Description</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Task specs and requirements..."
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : editingTask ? 'Update Task' : 'Create Task'}
            </button>
          </div>
        </form>
      </SlideDrawer>
    </div>
  );
}
