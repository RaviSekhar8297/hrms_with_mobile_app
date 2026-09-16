'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getHeaders, API_BASE } from '../../../utils/api';
import { useDashboard } from '../../../components/DashboardContext';
import SearchableSelect from '../../../components/SearchableSelect';
import {
  ArrowLeft,
  Clock,
  Calendar,
  Plus,
  Trash2,
  Save,
  Loader2,
  Sparkles
} from 'lucide-react';

interface ActivityItem {
  id: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  status: string;
  projectId: string;
  taskId: string;
  title: string;
  description: string;
}

export default function ManualTimesheetLogPage() {
  const router = useRouter();
  const { showToast, companyId: globalCompanyId } = useDashboard();
  const activeCompanyId = globalCompanyId;

  const todayStr = new Date().toISOString().split('T')[0];
  const [logDate, setLogDate] = useState(todayStr);

  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [activities, setActivities] = useState<ActivityItem[]>([
    {
      id: 'act-1',
      startTime: '09:30',
      endTime: '11:30',
      durationMinutes: 120,
      status: 'Working',
      projectId: '',
      taskId: '',
      title: '',
      description: '',
    },
  ]);

  useEffect(() => {
    fetchProjects();
    fetchTasks();
  }, [activeCompanyId]);

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

  const fetchTasks = async () => {
    try {
      const cid = activeCompanyId || localStorage.getItem('companyId');
      const url = cid && cid !== 'all' ? `${API_BASE}/api/v1/workbridge/tasks?company_id=${cid}` : `${API_BASE}/api/v1/workbridge/tasks`;
      const res = await fetch(url, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch (e) {}
  };

  const calculateMinutes = (start: string, end: string) => {
    if (!start || !end) return 60;
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    const startMins = sH * 60 + sM;
    const endMins = eH * 60 + eM;
    const diff = endMins - startMins;
    return diff > 0 ? diff : 60;
  };

  const updateActivityField = (id: string, field: keyof ActivityItem, value: any) => {
    setActivities((prev) =>
      prev.map((act) => {
        if (act.id === id) {
          const updated = { ...act, [field]: value };
          // Auto-fill Title if a Task is selected, clear Title if set to None ("")
          if (field === 'taskId') {
            if (value) {
              const selectedTask = tasks.find((t) => t.id === value);
              if (selectedTask) {
                const taskTitle = selectedTask.title || selectedTask.task_name || '';
                updated.title = taskTitle.slice(0, 100);
              }
            } else {
              updated.title = '';
            }
          }
          return updated;
        }
        return act;
      })
    );
  };

  const handleTimeChange = (id: string, field: 'startTime' | 'endTime', value: string) => {
    setActivities((prev) => {
      const index = prev.findIndex((a) => a.id === id);
      if (index === -1) return prev;

      const nextActivities = [...prev];
      const act = { ...nextActivities[index] };

      const newStart = field === 'startTime' ? value : act.startTime;
      let newEnd = field === 'endTime' ? value : act.endTime;

      if (field === 'startTime' && newStart >= newEnd) {
        const [h, m] = newStart.split(':').map(Number);
        const nextH = Math.min(23, h + 2);
        newEnd = `${String(nextH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }

      act.startTime = newStart;
      act.endTime = newEnd;
      act.durationMinutes = calculateMinutes(newStart, newEnd);
      nextActivities[index] = act;

      // Cascade forward to ensure subsequent activities start after previous activity ends
      for (let j = index + 1; j < nextActivities.length; j++) {
        const prevAct = nextActivities[j - 1];
        const currentAct = { ...nextActivities[j] };

        if (currentAct.startTime < prevAct.endTime) {
          currentAct.startTime = prevAct.endTime;
          const [h, m] = currentAct.startTime.split(':').map(Number);
          const nextH = Math.min(23, h + 2);
          const suggestedEnd = `${String(nextH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          if (currentAct.endTime <= currentAct.startTime) {
            currentAct.endTime = suggestedEnd;
          }
          currentAct.durationMinutes = calculateMinutes(currentAct.startTime, currentAct.endTime);
          nextActivities[j] = currentAct;
        }
      }

      return nextActivities;
    });
  };

  // Next activity starts at previous activity's endTime
  const handleAddActivityRow = () => {
    const lastAct = activities[activities.length - 1];
    let newStart = '11:30';
    let newEnd = '13:30';
    if (lastAct && lastAct.endTime) {
      newStart = lastAct.endTime;
      const [h, m] = newStart.split(':').map(Number);
      const nextH = Math.min(23, h + 2);
      newEnd = `${String(nextH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    const newRow: ActivityItem = {
      id: `act-${Date.now()}`,
      startTime: newStart,
      endTime: newEnd,
      durationMinutes: calculateMinutes(newStart, newEnd),
      status: 'Working',
      projectId: lastAct ? lastAct.projectId : '',
      taskId: '',
      title: '',
      description: '',
    };
    setActivities([...activities, newRow]);
  };

  const handleRemoveActivityRow = (id: string) => {
    if (activities.length === 1) {
      showToast('At least one activity is required', 'error');
      return;
    }
    setActivities(activities.filter((a) => a.id !== id));
  };

  const handleSubmitAll = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!logDate) {
      showToast('Please select a Work Date', 'error');
      return;
    }

    for (let i = 0; i < activities.length; i++) {
      const act = activities[i];
      if (!act.title.trim()) {
        showToast(`Please enter Title for Activity ${i + 1}`, 'error');
        return;
      }
      if (act.title.trim().length > 100) {
        showToast(`Title for Activity ${i + 1} cannot exceed 100 characters`, 'error');
        return;
      }
      if (!act.description.trim()) {
        showToast(`Please enter Description for Activity ${i + 1}`, 'error');
        return;
      }
      if (act.description.trim().length > 1000) {
        showToast(`Description for Activity ${i + 1} cannot exceed 1000 characters`, 'error');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const cid = activeCompanyId || localStorage.getItem('companyId');
      const payloadEntries = activities.map((act) => ({
        entry_date: logDate,
        duration_minutes: act.durationMinutes,
        title: act.title.trim(),
        description: act.description.trim(),
        project_id: act.projectId || null,
        task_id: act.taskId || null,
        status: act.status,
      }));

      const res = await fetch(`${API_BASE}/api/v1/workbridge/timesheets/entries`, {
        method: 'POST',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: cid,
          entries: payloadEntries,
        }),
      });

      if (res.ok) {
        showToast(`Successfully logged ${activities.length} activity entries! 🚀`, 'success');
        router.push('/dashboard/workbridge/timesheets');
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to save timesheet activities', 'error');
      }
    } catch (e) {
      showToast('Network error saving timesheet entries', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const projectOptions = [
    { value: '', label: 'General / Standalone Work (No Project)' },
    ...projects.map((p) => ({
      value: p.id,
      label: `${p.project_name} (${p.project_code})`,
    })),
  ];

  const timeSlotOptions = [
    { value: '08:00', label: '08:00 AM' },
    { value: '08:30', label: '08:30 AM' },
    { value: '09:00', label: '09:00 AM' },
    { value: '09:30', label: '09:30 AM' },
    { value: '10:00', label: '10:00 AM' },
    { value: '10:30', label: '10:30 AM' },
    { value: '11:00', label: '11:00 AM' },
    { value: '11:30', label: '11:30 AM' },
    { value: '12:00', label: '12:00 PM (Noon)' },
    { value: '12:30', label: '12:30 PM' },
    { value: '13:00', label: '01:00 PM' },
    { value: '13:30', label: '01:30 PM' },
    { value: '14:00', label: '02:00 PM' },
    { value: '14:30', label: '02:30 PM' },
    { value: '15:00', label: '03:00 PM' },
    { value: '15:30', label: '03:30 PM' },
    { value: '16:00', label: '04:00 PM' },
    { value: '16:30', label: '04:30 PM' },
    { value: '17:00', label: '05:00 PM' },
    { value: '17:30', label: '05:30 PM' },
    { value: '18:00', label: '06:00 PM' },
    { value: '18:30', label: '06:30 PM' },
    { value: '19:00', label: '07:00 PM' },
    { value: '19:30', label: '07:30 PM' },
    { value: '20:00', label: '08:00 PM' },
  ];

  const totalLoggedMinutesSum = activities.reduce((sum, a) => sum + a.durationMinutes, 0);
  const totalLoggedHoursSum = (totalLoggedMinutesSum / 60).toFixed(1);

  return (
    <div className="space-y-6 animate-fadeIn select-none relative w-full pb-16 pt-2">
      {/* Req 2: Light Background Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-indigo-50/90 via-slate-50 to-blue-50/80 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-6 rounded-2xl text-slate-900 dark:text-white shadow-xs border border-indigo-200/70 dark:border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              Work-Bridge Suite
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">• Multi-Activity Logger</span>
          </div>
          <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Log Worked Hours & Activities
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Record multiple tasks/activities for a given date, track hours, and submit weekly timesheet entries.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/dashboard/workbridge/timesheets')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs transition-all border border-slate-200 dark:border-slate-700 shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4" /> Cancel & Back
          </button>
          
          {/* Req 6: Inside Spinner on Submit button */}
          <button
            type="button"
            onClick={handleSubmitAll}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" /> Submitting Activities...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> Submit All Activities ({totalLoggedHoursSum}h)
              </>
            )}
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmitAll} className="space-y-6 w-full" noValidate>
        {/* Dynamic Activity List Blocks */}
        <div className="space-y-6">
          {activities.map((act, idx) => {
            const filteredTasks = act.projectId
              ? tasks.filter((t) => t.project_id === act.projectId)
              : tasks;

            const taskOptions = [
              { value: '', label: 'None (Select Task or General Activity)' },
              ...filteredTasks.map((t) => ({
                value: t.id,
                label: `${t.title || t.task_name} (${t.task_code || 'TSK'})`,
              })),
            ];

            const prevAct = idx > 0 ? activities[idx - 1] : null;
            const minStart = prevAct ? prevAct.endTime : '00:00';
            const availableStartOptions = timeSlotOptions.filter((t) => t.value >= minStart);
            const availableEndOptions = timeSlotOptions.filter((t) => t.value > act.startTime);

            return (
              <div
                key={act.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs space-y-5 relative transition-all hover:shadow-xs"
              >
                {/* Activity Card Header */}
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      Activity {idx + 1}
                    </h3>
                  </div>

                  {/* Req 4: Remove button only from 2nd activity onwards */}
                  {idx > 0 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveActivityRow(act.id)}
                      className="text-xs text-rose-500 hover:text-rose-700 font-bold flex items-center gap-1 bg-rose-50 dark:bg-rose-950/40 px-3 py-1 rounded-lg border border-rose-200 dark:border-rose-900 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove Activity
                    </button>
                  )}
                </div>

                {/* Grid 1: Date, Start Time -> End Time, Status */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 text-xs">
                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Date
                    </label>
                    <input
                      type="date"
                      value={logDate}
                      onChange={(e) => setLogDate(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-white"
                    />
                  </div>

                  <div className="md:col-span-6">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Time Slot (Start to End)
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={act.startTime}
                        onChange={(e) => handleTimeChange(act.id, 'startTime', e.target.value)}
                        className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {availableStartOptions.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>

                      <span className="text-xs font-extrabold text-slate-400">to</span>

                      <select
                        value={act.endTime}
                        onChange={(e) => handleTimeChange(act.id, 'endTime', e.target.value)}
                        className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {availableEndOptions.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>

                      <span className="px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-extrabold rounded-xl border border-indigo-200 dark:border-indigo-800 shrink-0 text-[11px]">
                        {(act.durationMinutes / 60).toFixed(1)} h
                      </span>
                    </div>
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Work Status
                    </label>
                    <select
                      value={act.status}
                      onChange={(e) => updateActivityField(act.id, 'status', e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Working">⚡ Working / Active</option>
                      <option value="Meeting">💬 Meeting / Discussion</option>
                      <option value="Review">🔍 Code / Output Review</option>
                      <option value="Support">🛠️ Customer / System Support</option>
                      <option value="Break">⏸️ On Break</option>
                    </select>
                  </div>
                </div>

                {/* Grid 2: Optional Project & Optional Task */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Project (Optional - Leave blank for Standalone Work)
                    </label>
                    <SearchableSelect
                      options={projectOptions}
                      value={act.projectId}
                      onChange={(val: string) => updateActivityField(act.id, 'projectId', val)}
                      placeholder="Select Project or Standalone..."
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Task (Optional)
                    </label>
                    <SearchableSelect
                      options={taskOptions}
                      value={act.taskId}
                      onChange={(val: string) => updateActivityField(act.id, 'taskId', val)}
                      placeholder="Select Task..."
                    />
                  </div>
                </div>

                {/* Title & Description */}
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        Title / Work Name <span className="text-slate-400 font-normal">(Select task above to auto-fill or enter custom title)</span>
                      </label>
                      <span className={`text-[10px] font-mono font-bold ${act.title.length >= 100 ? 'text-rose-500 font-extrabold' : 'text-slate-400'}`}>
                        {act.title.length}/100
                      </span>
                    </div>
                    <input
                      type="text"
                      maxLength={100}
                      value={act.title}
                      onChange={(e) => updateActivityField(act.id, 'title', e.target.value)}
                      placeholder="What did you work on? (Max 100 chars)"
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        Description / Work Details
                      </label>
                      <span className={`text-[10px] font-mono font-bold ${act.description.length >= 1000 ? 'text-rose-500 font-extrabold' : 'text-slate-400'}`}>
                        {act.description.length}/1000
                      </span>
                    </div>
                    <textarea
                      rows={3}
                      maxLength={1000}
                      value={act.description}
                      onChange={(e) => updateActivityField(act.id, 'description', e.target.value)}
                      placeholder="Details of work performed... (Max 1000 chars)"
                      className="w-full bg-slate-50/60 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium leading-relaxed"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add Activity Row Button */}
        <div>
          <button
            type="button"
            onClick={handleAddActivityRow}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" /> Add Activity
          </button>
        </div>

        {/* Action Footer Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between bg-white dark:bg-slate-900 p-5 rounded-2xl text-slate-800 dark:text-slate-100 shadow-2xs border border-slate-200/80 dark:border-slate-800 w-full gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Ready to submit {activities.length} activity entries ({totalLoggedHoursSum} hours total)?
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/dashboard/workbridge/timesheets')}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors"
            >
              Cancel
            </button>

            {/* Req 6: Submit button inside spinner */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-7 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" /> Submitting Activities...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" /> Submit All Activities ({totalLoggedHoursSum}h)
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
