'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardPageHeader from '../../components/DashboardPageHeader';
import { getHeaders, API_BASE } from '../../utils/api';
import SlideDrawer from '../../components/SlideDrawer';
import { useDashboard } from '../../components/DashboardContext';
import { usePermissions } from '../../hooks/usePermissions';
import SearchableSelect from '../../components/SearchableSelect';
import { Clock, Calendar, CheckCircle2, XCircle, Send, Plus, Filter, User, FolderKanban, Briefcase } from 'lucide-react';

export default function WorkBridgeTimesheetsPage() {
  const router = useRouter();
  const { showToast, companyId: globalCompanyId } = useDashboard();
  const { hasPermission, isSuperAdmin } = usePermissions();

  const canApprove = isSuperAdmin || hasPermission('approve_timesheets') || hasPermission('edit');

  const activeCompanyId = globalCompanyId;

  const [timesheets, setTimesheets] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // Manual Time Log Modal
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    project_id: '',
    task_id: '',
    work_date: new Date().toISOString().split('T')[0],
    duration_hours: '1.0',
    description: '',
  });

  useEffect(() => {
    fetchProjects();
    fetchEmployees();
  }, [activeCompanyId]);

  useEffect(() => {
    fetchTimesheets();
  }, [activeCompanyId, selectedEmployeeId, selectedStatus]);

  const fetchProjects = async () => {
    try {
      const cid = activeCompanyId || localStorage.getItem('companyId');
      const url = cid && cid !== 'all' ? `${API_BASE}/api/v1/workbridge/projects?company_id=${cid}` : `${API_BASE}/api/v1/workbridge/projects`;
      const res = await fetch(url, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch (e) {}
  };

  const fetchEmployees = async () => {
    try {
      const cid = activeCompanyId || localStorage.getItem('companyId');
      const url = cid && cid !== 'all' ? `${API_BASE}/api/v1/employees?company_id=${cid}` : `${API_BASE}/api/v1/employees`;
      const res = await fetch(url, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setEmployees(Array.isArray(data) ? data : (data.employees || []));
      }
    } catch (e) {}
  };

  const fetchTasksForProject = async (projId: string) => {
    if (!projId) {
      setTasks([]);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/v1/workbridge/tasks?project_id=${projId}`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch (e) {}
  };

  const fetchTimesheets = async () => {
    setIsLoading(true);
    try {
      const cid = activeCompanyId || localStorage.getItem('companyId');
      const params = new URLSearchParams();
      if (cid && cid !== 'all') params.append('company_id', cid);
      if (selectedEmployeeId !== 'ALL') params.append('employee_id', selectedEmployeeId);
      if (selectedStatus !== 'ALL') params.append('status', selectedStatus);

      const res = await fetch(`${API_BASE}/api/v1/workbridge/timesheets?${params.toString()}`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setTimesheets(data.timesheets || []);
      }
    } catch (e) {
      console.error(e);
      showToast('Error fetching timesheets', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualTimeSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.project_id || !form.work_date || !form.duration_hours) {
      showToast('Please fill out Project, Date, and Duration', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const cid = activeCompanyId || localStorage.getItem('companyId');
      const payload = {
        company_id: cid,
        project_id: form.project_id,
        task_id: form.task_id || null,
        entry_date: form.work_date,
        duration_minutes: Math.round(parseFloat(form.duration_hours) * 60),
        description: form.description,
      };

      const res = await fetch(`${API_BASE}/api/v1/workbridge/timesheets/entries`, {
        method: 'POST',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showToast('Manual time entry added ⏱️', 'success');
        setDrawerOpen(false);
        fetchTimesheets();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to add time entry', 'error');
      }
    } catch (e) {
      showToast('Network error saving time log', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateStatus = async (timesheetId: string, status: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/workbridge/timesheets/${timesheetId}/status`, {
        method: 'PUT',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        showToast(`Timesheet marked as ${status}!`, 'success');
        fetchTimesheets();
      } else {
        const err = await res.json();
        showToast(err.error || 'Status update failed', 'error');
      }
    } catch (e) {
      showToast('Error updating timesheet status', 'error');
    }
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'APPROVED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'SUBMITTED':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'REJECTED':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const employeeFilterOptions = [
    { value: 'ALL', label: 'All Employees' },
    ...employees.map((emp) => ({
      value: emp.id,
      label: `${emp.first_name} ${emp.last_name} (${emp.emp_id_code || 'EMP'})`,
    })),
  ];

  const statusFilterOptions = [
    { value: 'ALL', label: 'All Statuses' },
    { value: 'DRAFT', label: 'Draft' },
    { value: 'SUBMITTED', label: 'Submitted (Pending Approval)' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'REJECTED', label: 'Rejected' },
  ];

  const projectFormOptions = projects.map((p) => ({
    value: p.id,
    label: `${p.project_name} (${p.project_code || 'PRJ'})`,
  }));

  const taskFormOptions = [
    { value: '', label: 'None / Direct Project Entry' },
    ...tasks.map((t) => ({
      value: t.id,
      label: `${t.task_code} - ${t.title || t.task_name}`,
    })),
  ];

  return (
    <div className="space-y-6 animate-fadeIn select-none relative">
      <DashboardPageHeader
        title="Weekly Timesheets"
        subtitle="Review employee time logs, live timer records, manual entries, and approval status"
      />

      {/* Main Listing & Filters Panel */}
      <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/80 bg-card p-6 shadow-sm space-y-6">
        
        {/* Inline Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="w-full sm:w-64">
            <SearchableSelect
              options={employeeFilterOptions}
              value={selectedEmployeeId}
              onChange={(val) => setSelectedEmployeeId(val)}
              placeholder="All Employees"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
            <div className="w-48">
              <SearchableSelect
                options={statusFilterOptions}
                value={selectedStatus}
                onChange={(val) => setSelectedStatus(val)}
                placeholder="All Statuses"
              />
            </div>

            <button
              onClick={() => router.push('/dashboard/workbridge/timesheets/log')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition-all text-xs"
            >
              <Plus className="w-4 h-4" /> Log Manual Time
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <div className="w-8 h-8 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
            <span className="text-xs font-semibold text-slate-500">Loading Timesheets...</span>
          </div>
        ) : timesheets.length === 0 ? (
          <div className="bg-slate-50/50 border border-slate-200/80 rounded-2xl p-12 text-center max-w-md mx-auto my-6">
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-500">
              <Clock className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">No Timesheets Found</h3>
            <p className="text-slate-500 text-xs mb-6 leading-relaxed">
              There are no weekly timesheets matching your filters. Log manual work time to generate records.
            </p>
            <button
              onClick={() => setDrawerOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs text-xs transition-all"
            >
              <Plus className="w-4 h-4" /> Log Manual Time
            </button>
          </div>
        ) : (
        <div className="space-y-4">
          {timesheets.map((ts) => {
            const totalHours = ((ts.total_minutes || 0) / 60).toFixed(1);
            return (
              <div
                key={ts.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 hover:border-emerald-500 transition-all"
              >
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center border border-indigo-200">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{ts.employee_name || 'Employee'}</h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 font-semibold">
                        <Calendar className="w-3.5 h-3.5 text-emerald-600" /> Week: {new Date(ts.start_date).toLocaleDateString()} - {new Date(ts.end_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-[11px] text-slate-400 block font-bold">Total Worked</span>
                      <span className="text-lg font-extrabold text-emerald-600">{totalHours} hrs</span>
                    </div>

                    <span className={`px-3 py-1 text-xs font-bold rounded-full border ${getStatusBadge(ts.status)}`}>
                      {ts.status}
                    </span>

                    <div className="flex items-center gap-2">
                      {ts.status === 'DRAFT' && (
                        <button
                          onClick={() => handleUpdateStatus(ts.id, 'SUBMITTED')}
                          className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs"
                        >
                          <Send className="w-3.5 h-3.5" /> Submit
                        </button>
                      )}

                      {canApprove && ts.status === 'SUBMITTED' && (
                        <>
                          <button
                            onClick={() => handleUpdateStatus(ts.id, 'APPROVED')}
                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(ts.id, 'REJECTED')}
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-xs"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {ts.entries && ts.entries.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50/50">
                    <table className="w-full text-left text-xs text-slate-800">
                      <thead className="bg-white text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-2.5">Date</th>
                          <th className="px-4 py-2.5">Project</th>
                          <th className="px-4 py-2.5">Task</th>
                          <th className="px-4 py-2.5">Description</th>
                          <th className="px-4 py-2.5 text-right">Duration</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {ts.entries.map((e: any) => (
                          <tr key={e.id} className="hover:bg-slate-100/60">
                            <td className="px-4 py-2.5 text-slate-500 font-semibold">{new Date(e.entry_date).toLocaleDateString()}</td>
                            <td className="px-4 py-2.5 font-bold text-slate-900">{e.project_name || '-'}</td>
                            <td className="px-4 py-2.5 text-indigo-700 font-mono font-bold">{e.task_code || e.task_title || '-'}</td>
                            <td className="px-4 py-2.5 text-slate-600">{e.description || 'Work Log'}</td>
                            <td className="px-4 py-2.5 text-right font-extrabold text-slate-900">
                              {((e.duration_minutes || e.minutes || 0) / 60).toFixed(1)} hrs
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No detailed log entries for this week yet.</p>
                )}
              </div>
            );
          })}
        </div>
      )}
      </div>

      {/* Manual Time Entry Drawer */}
      <SlideDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Log Manual Work Time ⏱️"
      >
        <form onSubmit={handleManualTimeSave} className="space-y-4 text-slate-800">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Project *</label>
            <SearchableSelect
              options={projectFormOptions}
              value={form.project_id}
              onChange={(val) => {
                setForm({ ...form, project_id: val, task_id: '' });
                fetchTasksForProject(val);
              }}
              placeholder="Search Project..."
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Related Task (Optional)</label>
            <SearchableSelect
              options={taskFormOptions}
              value={form.task_id}
              onChange={(val) => setForm({ ...form, task_id: val })}
              placeholder="Search Task..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Work Date *</label>
              <input
                type="date"
                required
                value={form.work_date}
                onChange={(e) => setForm({ ...form, work_date: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Duration (Hours) *</label>
              <input
                type="number"
                step="0.25"
                min="0.25"
                max="24"
                required
                value={form.duration_hours}
                onChange={(e) => setForm({ ...form, duration_hours: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Work Description</label>
            <textarea
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What features or tasks did you work on?"
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="pt-6 flex justify-end gap-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs disabled:opacity-50"
            >
              {isSaving ? 'Logging...' : 'Save Time Entry'}
            </button>
          </div>
        </form>
      </SlideDrawer>
    </div>
  );
}
