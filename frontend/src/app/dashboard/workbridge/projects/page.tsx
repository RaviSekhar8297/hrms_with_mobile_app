'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardPageHeader from '../../components/DashboardPageHeader';
import { getHeaders, API_BASE } from '../../utils/api';
import SlideDrawer from '../../components/SlideDrawer';
import { useDashboard } from '../../components/DashboardContext';
import { usePermissions } from '../../hooks/usePermissions';
import SearchableSelect from '../../components/SearchableSelect';
import { 
  FolderPlus, 
  Users, 
  Calendar, 
  AlertCircle, 
  Edit2, 
  Trash2, 
  FolderKanban, 
  Plus, 
  Search, 
  CheckCircle2, 
  UserCheck, 
  Briefcase,
  Clock,
  UserPlus,
  X
} from 'lucide-react';

export default function WorkBridgeProjectsPage() {
  const router = useRouter();
  const { showToast, companyId: globalCompanyId } = useDashboard();
  const { hasPermission, isSuperAdmin } = usePermissions();

  const canCreate = isSuperAdmin || hasPermission('projects_create');
  const canEdit = isSuperAdmin || hasPermission('projects_edit');
  const canDelete = isSuperAdmin || hasPermission('projects_delete');

  const activeCompanyId = globalCompanyId;

  const [projects, setProjects] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  // Edit Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<any | null>(null);

  // Team Assignment Drawer / Modal
  const [teamDrawerOpen, setTeamDrawerOpen] = useState(false);
  const [teamProject, setTeamProject] = useState<any | null>(null);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  const [form, setForm] = useState({
    project_code: '',
    project_name: '',
    client_name: '',
    description: '',
    priority: 'MEDIUM',
    status: 'PLANNING',
    project_manager_id: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    milestone: '',
  });

  useEffect(() => {
    fetchProjects();
    fetchEmployees();
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

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const cid = activeCompanyId || localStorage.getItem('companyId');
      const url = cid && cid !== 'all'
        ? `${API_BASE}/api/v1/workbridge/projects?company_id=${cid}`
        : `${API_BASE}/api/v1/workbridge/projects`;
      const res = await fetch(url, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      } else {
        showToast('Failed to fetch projects', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Error loading projects', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDrawer = (project?: any) => {
    if (project) {
      setEditingProject(project);
      setForm({
        project_code: project.project_code || '',
        project_name: project.project_name || '',
        client_name: project.client_name || '',
        description: project.description || '',
        priority: project.priority || 'MEDIUM',
        status: project.status || 'PLANNING',
        project_manager_id: project.project_manager_id || '',
        start_date: project.start_date ? new Date(project.start_date).toISOString().split('T')[0] : '',
        end_date: project.end_date ? new Date(project.end_date).toISOString().split('T')[0] : '',
        milestone: project.milestone || '',
      });
    } else {
      setEditingProject(null);
      setForm({
        project_code: `PRJ-${Math.floor(1000 + Math.random() * 9000)}`,
        project_name: '',
        client_name: '',
        description: '',
        priority: 'MEDIUM',
        status: 'PLANNING',
        project_manager_id: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        milestone: '',
      });
    }
    setDrawerOpen(true);
  };

  const handleOpenTeamDrawer = (project: any) => {
    setTeamProject(project);
    setSelectedEmpId('');
    setTeamDrawerOpen(true);
  };

  const handleAddMember = async () => {
    if (!teamProject || !selectedEmpId) {
      showToast('Please select an employee to add', 'error');
      return;
    }

    const currentMemberIds = new Set([
      ...(teamProject.members || []).map((m: any) => m.employee_id || m.id),
      ...(teamProject.project_manager_id ? [teamProject.project_manager_id] : []),
    ]);
    if (currentMemberIds.has(selectedEmpId)) {
      showToast('Employee is already assigned to this project or is Project Manager!', 'error');
      return;
    }

    setIsAssigning(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/workbridge/projects/${teamProject.id}/members`, {
        method: 'POST',
        headers: {
          ...getHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ employee_id: selectedEmpId, role: 'MEMBER' }),
      });

      if (res.ok) {
        showToast('Team member assigned successfully! 👥', 'success');
        setSelectedEmpId('');
        fetchProjects();

        // Refresh team project locally
        const updatedRes = await fetch(`${API_BASE}/api/v1/workbridge/projects/${teamProject.id}/members`, { headers: getHeaders() });
        if (updatedRes.ok) {
          const data = await updatedRes.json();
          setTeamProject((prev: any) => ({ ...prev, members: data.members || [] }));
        }
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to assign team member', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Error assigning team member', 'error');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleRemoveMember = async (employeeId: string) => {
    if (!teamProject) return;

    try {
      const res = await fetch(`${API_BASE}/api/v1/workbridge/projects/${teamProject.id}/members/${employeeId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });

      if (res.ok) {
        showToast('Team member unassigned', 'success');
        fetchProjects();
        setTeamProject((prev: any) => ({
          ...prev,
          members: (prev.members || []).filter((m: any) => (m.employee_id || m.id) !== employeeId && m.id !== employeeId),
        }));
      } else {
        showToast('Failed to unassign member', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Error removing team member', 'error');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.project_name.trim() || !form.project_code.trim()) {
      showToast('Please fill out Project Code and Name', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const cid = activeCompanyId || localStorage.getItem('companyId');
      const payload = {
        ...form,
        company_id: cid,
      };

      const url = editingProject
        ? `${API_BASE}/api/v1/workbridge/projects/${editingProject.id}`
        : `${API_BASE}/api/v1/workbridge/projects`;
      const method = editingProject ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          ...getHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showToast(editingProject ? 'Project updated successfully!' : 'Project created successfully!', 'success');
        setDrawerOpen(false);
        fetchProjects();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to save project', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Network error saving project', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to archive this project?')) return;

    try {
      const res = await fetch(`${API_BASE}/api/v1/workbridge/projects/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (res.ok) {
        showToast('Project archived successfully', 'success');
        fetchProjects();
      } else {
        showToast('Failed to archive project', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Error archiving project', 'error');
    }
  };

  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.project_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.project_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.client_name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesPriority = priorityFilter === 'ALL' || p.priority === priorityFilter;

    return matchesSearch && matchesPriority;
  });

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'CRITICAL':
        return 'bg-red-50 text-red-700 border-red-200/80';
      case 'HIGH':
        return 'bg-orange-50 text-orange-700 border-orange-200/80';
      case 'MEDIUM':
        return 'bg-blue-50 text-blue-700 border-blue-200/80';
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
    }
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'COMPLETED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
      case 'IN_PROGRESS':
        return 'bg-blue-50 text-blue-700 border-blue-200/80';
      case 'ON_HOLD':
        return 'bg-amber-50 text-amber-700 border-amber-200/80';
      case 'CANCELLED':
        return 'bg-rose-50 text-rose-700 border-rose-200/80';
      default:
        return 'bg-indigo-50 text-indigo-700 border-indigo-200/80';
    }
  };

  const employeeOptions = [
    { value: '', label: 'Unassigned / Select Manager' },
    ...employees.map((emp) => ({
      value: emp.id,
      label: `${emp.first_name} ${emp.last_name} (${emp.emp_id_code || 'EMP'})`,
    })),
  ];

  const teamMemberIds = new Set(
    (teamProject?.members || []).map((m: any) => m.employee_id || m.id)
  );
  const managerId = teamProject?.project_manager_id;

  const assignableEmployeeOptions = [
    { value: '', label: 'Select Employee to Add to Team...' },
    ...employees.map((emp) => {
      const isManager = emp.id === managerId;
      const isAlreadyMember = teamMemberIds.has(emp.id);
      const isAssigned = isManager || isAlreadyMember;

      let tag = '';
      if (isManager) tag = ' — 👤 Project Manager (Already Assigned)';
      else if (isAlreadyMember) tag = ' — ✅ Already Assigned';

      return {
        value: emp.id,
        label: `${emp.first_name} ${emp.last_name} (${emp.emp_id_code || 'EMP'})${tag}`,
        disabled: isAssigned,
      };
    }),
  ];

  const priorityOptions = [
    { value: 'ALL', label: 'All Priorities' },
    { value: 'LOW', label: 'Low Priority' },
    { value: 'MEDIUM', label: 'Medium Priority' },
    { value: 'HIGH', label: 'High Priority' },
    { value: 'CRITICAL', label: 'Critical Priority' },
  ];

  return (
    <div className="space-y-6 animate-fadeIn select-none relative w-full">
      <DashboardPageHeader
        title="Projects Directory"
        subtitle="Manage client deliverables, project codes, managers, and progress tracking"
      />

      {/* Main Listing & Filters Panel */}
      <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/80 bg-card p-6 shadow-sm space-y-6 w-full">
        
        {/* Inline Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:max-w-md">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Search by project code, title, client..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-100 transition-all duration-200"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
            <div className="w-44">
              <SearchableSelect
                options={priorityOptions}
                value={priorityFilter}
                onChange={(val) => setPriorityFilter(val)}
                placeholder="All Priorities"
              />
            </div>

            {canCreate && (
              <button
                onClick={() => router.push('/dashboard/workbridge/projects/create')}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs transition-all text-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add Project
              </button>
            )}
          </div>
        </div>

        {/* Projects Grid or Clean No Data State */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <div className="w-8 h-8 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
            <span className="text-xs font-semibold text-slate-500">Loading Projects...</span>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="bg-slate-50/50 border border-slate-200/80 rounded-2xl p-12 text-center max-w-md mx-auto my-6">
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-500">
              <FolderKanban className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">No Projects Found</h3>
            <p className="text-slate-500 text-xs mb-6 leading-relaxed">
              There are currently no active projects matching your filter criteria for this company.
            </p>
            {canCreate && (
              <button
                onClick={() => router.push('/dashboard/workbridge/projects/create')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs text-xs transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add Project
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
            {filteredProjects.map((p) => {
              const total = parseInt(p.total_tasks || 0);
              const completed = parseInt(p.completed_tasks || 0);
              const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
              const membersList = p.members || [];

              return (
                <div
                  key={p.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-indigo-500/50 transition-all rounded-2xl p-5 shadow-xs flex flex-col justify-between group hover:shadow-md relative overflow-hidden"
                >
                  <div className="space-y-3">
                    {/* Header Badges */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-0.5 rounded-lg">
                        {p.project_code}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {/* Status Badge */}
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${getStatusBadge(p.status || 'PLANNING')}`}>
                          {p.status || 'PLANNING'}
                        </span>
                        {/* Priority Badge */}
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${getPriorityBadge(p.priority)}`}>
                          {p.priority}
                        </span>
                      </div>
                    </div>

                    {/* Title */}
                    <div className="pt-1">
                      <h3 className="text-base font-black text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-snug">
                        {p.project_name}
                      </h3>
                    </div>

                    {/* Client Name & Target Deadline Inline */}
                    <div className="flex items-center justify-between gap-2 text-xs font-semibold">
                      {p.client_name ? (
                        <p
                          className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate max-w-[180px]"
                          title={p.client_name.length > 15 ? p.client_name : undefined}
                        >
                          <Briefcase className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>
                            Client: {p.client_name.length > 15 ? `${p.client_name.slice(0, 15)}...` : p.client_name}
                          </span>
                        </p>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">No Client</span>
                      )}

                      {p.end_date && (
                        <div
                          className="text-[11px] text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 px-2 py-0.5 rounded-lg border border-rose-200/80 dark:border-rose-900 shrink-0"
                          title={`Target Deadline: ${new Date(p.end_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                        >
                          <Calendar className="w-3.5 h-3.5 text-rose-500 shrink-0" /> 
                          <span>{new Date(p.end_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    {p.description && (
                      <p
                        className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed"
                        title={p.description.length > 50 ? p.description : undefined}
                      >
                        {p.description.length > 50 ? `${p.description.slice(0, 50)}...` : p.description}
                      </p>
                    )}
                  </div>

                  <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
                    {/* Task Progress */}
                    <div>
                      <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1.5 font-bold">
                        <span>Tasks Progress</span>
                        <span className="text-indigo-600 dark:text-indigo-400">{completed}/{total} ({progress}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-200/60 dark:border-slate-700">
                        <div
                          className="bg-gradient-to-r from-indigo-500 to-blue-500 h-full transition-all duration-300 rounded-full"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Manager & Team Members Display */}
                    <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 pt-1">
                      <span className="flex items-center gap-1.5 font-semibold text-[11px] text-slate-700 dark:text-slate-300">
                        <UserCheck className="w-3.5 h-3.5 text-indigo-600" /> {p.manager_name || 'No Manager'}
                      </span>

                      {/* Team Member Avatars List */}
                      <div className="flex items-center gap-1">
                        {membersList.length > 0 ? (
                          <div className="flex items-center -space-x-2 overflow-hidden py-0.5">
                            {membersList.slice(0, 3).map((m: any, idx: number) => {
                              const initials = ((m.first_name?.[0] || '') + (m.last_name?.[0] || '')).toUpperCase() || 'E';
                              return (
                                <div
                                  key={m.id || idx}
                                  className="w-6 h-6 rounded-full bg-indigo-600 dark:bg-indigo-500 text-white text-[9px] font-black flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-xs"
                                  title={`${m.first_name} ${m.last_name} (${m.emp_id_code || 'EMP'})`}
                                >
                                  {initials}
                                </div>
                              );
                            })}
                            {membersList.length > 3 && (
                              <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[9px] font-bold flex items-center justify-center border-2 border-white dark:border-slate-900">
                                +{membersList.length - 3}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">No team</span>
                        )}

                        {/* Action Buttons: Add Team (+), Edit, Delete strictly permission guarded */}
                        <div className="flex items-center gap-1.5 ml-2 border-l border-slate-100 dark:border-slate-800 pl-2">
                          {canEdit && (
                            <button
                              onClick={() => handleOpenTeamDrawer(p)}
                              className="p-1.5 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 dark:hover:bg-emerald-900 rounded-lg transition-colors border border-emerald-200/80 dark:border-emerald-800 cursor-pointer shadow-xs"
                              title="Add Team Member"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canEdit && (
                            <button
                              onClick={() => handleOpenDrawer(p)}
                              className="p-1.5 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 dark:hover:bg-indigo-900 rounded-lg transition-colors border border-indigo-200/80 dark:border-indigo-800 cursor-pointer shadow-xs"
                              title="Edit Project Details"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(p.id)}
                              className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 hover:text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 dark:hover:bg-rose-900 rounded-lg transition-colors border border-rose-200/80 dark:border-rose-800 cursor-pointer shadow-xs"
                              title="Archive Project"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Slide Drawer: Edit Project */}
      <SlideDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingProject ? 'Edit Project 📁' : 'Create New Project 📁'}
      >
        <form onSubmit={handleSave} className="space-y-4 text-slate-800 dark:text-white">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Project Code *</label>
              <input
                type="text"
                required
                value={form.project_code}
                onChange={(e) => setForm({ ...form, project_code: e.target.value })}
                placeholder="e.g. PRJ-1001"
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Priority</label>
              <SearchableSelect
                options={[
                  { value: 'LOW', label: '🟢 Low' },
                  { value: 'MEDIUM', label: '🔵 Medium' },
                  { value: 'HIGH', label: '🟠 High' },
                  { value: 'CRITICAL', label: '🔴 Critical' },
                ]}
                value={form.priority}
                onChange={(val) => setForm({ ...form, priority: val })}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Project Name *</label>
            <input
              type="text"
              required
              value={form.project_name}
              onChange={(e) => setForm({ ...form, project_name: e.target.value })}
              placeholder="e.g. Mobile Banking App Redesign"
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Client Name</label>
            <input
              type="text"
              value={form.client_name}
              onChange={(e) => setForm({ ...form, client_name: e.target.value })}
              placeholder="e.g. Acme Corp"
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Milestone <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={form.milestone || ''}
              onChange={(e) => setForm({ ...form, milestone: e.target.value })}
              placeholder="e.g. Phase 1 Release / Design Prototype"
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Project Manager</label>
            <SearchableSelect
              options={employeeOptions}
              value={form.project_manager_id}
              onChange={(val) => setForm({ ...form, project_manager_id: val })}
              placeholder="Search Manager..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Start Date</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">End Date</label>
              <input
                type="date"
                min={form.start_date}
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Description</label>
            <textarea
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Scope, objectives, and client requirements..."
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="pt-6 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : editingProject ? 'Update Project' : 'Create Project'}
            </button>
          </div>
        </form>
      </SlideDrawer>

      {/* Slide Drawer: Manage Project Team Members */}
      <SlideDrawer
        isOpen={teamDrawerOpen}
        onClose={() => setTeamDrawerOpen(false)}
        title="Manage Project Team 👥"
      >
        {teamProject && (
          <div className="space-y-6 text-slate-800 dark:text-white">
            {/* Project Summary Banner */}
            <div className="bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-900 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                  {teamProject.project_code}
                </span>
                <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200">{teamProject.project_name}</span>
              </div>
              <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80">
                Add or remove team members assigned to work on this workspace project.
              </p>
            </div>

            {/* Add Team Member Section */}
            {canEdit && (
              <div className="space-y-3 bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 rounded-xl">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-indigo-600" /> Add Team Member
                </label>
                <div className="space-y-3">
                  <SearchableSelect
                    options={assignableEmployeeOptions}
                    value={selectedEmpId}
                    onChange={(val) => setSelectedEmpId(val)}
                    placeholder="Search Employee to Assign..."
                  />
                  <button
                    type="button"
                    onClick={handleAddMember}
                    disabled={!selectedEmpId || isAssigning}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all shadow-xs disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> {isAssigning ? 'Assigning Employee...' : 'Assign to Project Team'}
                  </button>
                </div>
              </div>
            )}

            {/* Currently Assigned Members List */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Assigned Team Members</span>
                <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full text-[10px]">
                  {teamProject.members ? teamProject.members.length : 0} Members
                </span>
              </h4>

              {!teamProject.members || teamProject.members.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-800">
                  <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400">No Team Members Assigned Yet</p>
                  <p className="text-[11px] text-slate-400">Use the selector above to assign employees to this project team.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                  {teamProject.members.map((m: any) => {
                    const empId = m.employee_id || m.id;
                    const name = `${m.first_name || ''} ${m.last_name || ''}`.trim() || 'Employee';
                    const code = m.emp_id_code || 'EMP';
                    const initials = ((m.first_name?.[0] || '') + (m.last_name?.[0] || '')).toUpperCase() || 'E';

                    return (
                      <div
                        key={empId}
                        className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl hover:border-indigo-300 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center shadow-xs shrink-0">
                            {initials}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-900 dark:text-white block">{name}</span>
                            <span className="text-[10px] text-slate-500 font-mono block">Code: {code} • {m.email || 'No email'}</span>
                          </div>
                        </div>

                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(empId)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg transition-colors cursor-pointer"
                            title="Remove Member from Project"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </SlideDrawer>
    </div>
  );
}
