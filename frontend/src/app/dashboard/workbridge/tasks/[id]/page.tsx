'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardPageHeader from '../../../components/DashboardPageHeader';
import { getHeaders, API_BASE } from '../../../utils/api';
import { useDashboard } from '../../../components/DashboardContext';
import { usePermissions } from '../../../hooks/usePermissions';
import {
  ArrowLeft,
  CheckSquare,
  Clock,
  User,
  Calendar,
  MessageSquare,
  Play,
  Square,
  Plus,
  Trash2,
  Send,
  AlertCircle,
  FolderKanban,
  History,
  CheckCircle2,
  Zap,
  Tag,
  Layers,
  Edit2,
  Building2,
  Lock,
  Sparkles,
  Loader2,
  Activity,
  PlusCircle,
  X
} from 'lucide-react';

export default function WorkBridgeTaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params?.id as string;

  const { showToast } = useDashboard();
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission('project_tasks_edit');

  const [task, setTask] = useState<any | null>(null);
  const [subtasks, setSubtasks] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [timerLogs, setTimerLogs] = useState<any[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [activeTimer, setActiveTimer] = useState<any | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isTogglingTimer, setIsTogglingTimer] = useState(false);
  const [isAddingChecklist, setIsAddingChecklist] = useState(false);
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newCommentText, setNewCommentText] = useState('');

  // Manual Time Log Modal State
  const [showManualLogModal, setShowManualLogModal] = useState(false);
  const [manualHours, setManualHours] = useState('1');
  const [manualMinutes, setManualMinutes] = useState('0');
  const [manualDesc, setManualDesc] = useState('');
  const [isSavingManualLog, setIsSavingManualLog] = useState(false);

  useEffect(() => {
    if (taskId) {
      fetchTaskDetail();
      fetchActiveTimer();
    }
  }, [taskId]);

  const fetchTaskDetail = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/workbridge/tasks/${taskId}`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setTask(data.task || null);
        setSubtasks(data.task?.subtasks || []);
        setComments(data.task?.comments || []);
        setTimerLogs(data.task?.timer_logs || []);
        setActivityLogs(data.task?.activity_logs || []);
      } else {
        showToast('Task not found', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Error loading task detail', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchActiveTimer = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/workbridge/timer/active`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.active_timer && data.active_timer.task_id === taskId) {
          setActiveTimer(data.active_timer);
        } else {
          setActiveTimer(null);
        }
      }
    } catch (e) {}
  };

  const handleToggleTimer = async () => {
    if (isTogglingTimer) return;
    setIsTogglingTimer(true);
    try {
      const endpoint = activeTimer ? '/api/v1/workbridge/timer/stop' : '/api/v1/workbridge/timer/start';
      const body = activeTimer ? {} : { task_id: taskId };
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        showToast(activeTimer ? 'Timer stopped & saved! ⏱️' : 'Live timer started! ⏱️', 'success');
        await fetchActiveTimer();
        await fetchTaskDetail();
      } else {
        const err = await res.json();
        showToast(err.error || 'Timer action failed', 'error');
      }
    } catch (e) {
      showToast('Error toggling timer', 'error');
    } finally {
      setIsTogglingTimer(false);
    }
  };

  const handleSaveManualLog = async (e: React.FormEvent) => {
    e.preventDefault();
    const h = parseFloat(manualHours) || 0;
    const m = parseFloat(manualMinutes) || 0;
    if (h <= 0 && m <= 0) {
      showToast('Please enter valid hours or minutes', 'error');
      return;
    }

    setIsSavingManualLog(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/workbridge/timer/manual`, {
        method: 'POST',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: taskId,
          hours: h,
          minutes: m,
          description: manualDesc,
        }),
      });

      if (res.ok) {
        showToast('Worked time logged manually! ⏱️', 'success');
        setShowManualLogModal(false);
        setManualHours('1');
        setManualMinutes('0');
        setManualDesc('');
        fetchTaskDetail();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to log time', 'error');
      }
    } catch (e) {
      showToast('Error logging manual time', 'error');
    } finally {
      setIsSavingManualLog(false);
    }
  };

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim() || isAddingChecklist) return;

    setIsAddingChecklist(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/workbridge/tasks/${taskId}/checklists`, {
        method: 'POST',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_text: newSubtaskTitle }),
      });
      if (res.ok) {
        showToast('Subtask item added', 'success');
        setNewSubtaskTitle('');
        fetchTaskDetail();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to add checklist item', 'error');
      }
    } catch (e) {
      showToast('Failed to add subtask', 'error');
    } finally {
      setIsAddingChecklist(false);
    }
  };

  const handleToggleSubtask = async (subtaskId: string, isCompleted: boolean) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/workbridge/tasks/${taskId}/checklists/${subtaskId}`, {
        method: 'PUT',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_completed: isCompleted }),
      });
      if (res.ok) {
        fetchTaskDetail();
      }
    } catch (e) {
      showToast('Failed to update subtask', 'error');
    }
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/workbridge/tasks/${taskId}/checklists/${subtaskId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (res.ok) {
        fetchTaskDetail();
      }
    } catch (e) {
      showToast('Failed to delete subtask', 'error');
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || isPostingComment) return;

    setIsPostingComment(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/workbridge/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment_text: newCommentText }),
      });
      if (res.ok) {
        showToast('Comment posted', 'success');
        setNewCommentText('');
        fetchTaskDetail();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to post comment', 'error');
      }
    } catch (e) {
      showToast('Failed to post comment', 'error');
    } finally {
      setIsPostingComment(false);
    }
  };

  const formatLoggedTime = (minutes?: number) => {
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

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3 min-h-[400px]">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <span className="text-xs font-semibold text-slate-500">Loading Task Details...</span>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 p-6 text-center py-20">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-800">Task Not Found</h2>
        <button
          onClick={() => router.push('/dashboard/workbridge/tasks')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-xs"
        >
          Back to Tasks
        </button>
      </div>
    );
  }

  const completedSubtasksCount = subtasks.filter((s) => s.is_completed).length;
  const checklistProgress = subtasks.length > 0 ? Math.round((completedSubtasksCount / subtasks.length) * 100) : 0;
  const estimatedHours = (task.estimated_minutes || 0) / 60;
  const loggedMinutes = Number(task.total_logged_minutes) || 0;
  const loggedHours = (loggedMinutes / 60).toFixed(1);

  return (
    <div className="space-y-6 animate-fadeIn select-none relative w-full pb-12">
      {/* Top Banner Header - Styled like Project Create page */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 p-6 rounded-2xl text-white shadow-lg border border-indigo-700/40">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
              Work-Bridge Suite
            </span>
            <span className="text-xs text-indigo-300 font-medium">• Task Specification & Activity Center</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-indigo-400" /> {task.title || task.task_name}
          </h1>
          <p className="text-xs text-indigo-200/80">
            Task Code: <span className="font-mono font-bold text-indigo-300">{task.task_code}</span> • Created on {task.created_at ? new Date(task.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/dashboard/workbridge/tasks')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-xs backdrop-blur-md transition-all border border-white/15"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Task Board
          </button>

          {canEdit && (
            <button
              type="button"
              onClick={() => router.push(`/dashboard/workbridge/tasks/${task.id}/edit`)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all shadow-md"
            >
              <Edit2 className="w-4 h-4" /> Edit Task
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowManualLogModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-xs backdrop-blur-md transition-all border border-white/20"
          >
            <PlusCircle className="w-4 h-4 text-emerald-400" /> Log Time Manually
          </button>

          {/* Live Timer button with Inside Spinner */}
          <button
            type="button"
            onClick={handleToggleTimer}
            disabled={isTogglingTimer}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all shadow-md disabled:opacity-50 ${
              activeTimer
                ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white animate-pulse'
                : 'bg-emerald-500 hover:bg-emerald-600 text-white'
            }`}
          >
            {isTogglingTimer ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin fill-current" />
                {activeTimer ? 'Stopping Timer...' : 'Starting Timer...'}
              </>
            ) : activeTimer ? (
              <>
                <Square className="w-4 h-4 fill-current" /> Stop Active Timer
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" /> Start Live Timer
              </>
            )}
          </button>
        </div>
      </div>

      {/* System & Metadata Bar (Auto Configured / Non-Editable) */}
      <div className="bg-slate-900/5 dark:bg-slate-800/40 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl p-5 w-full">
        <div className="flex items-center justify-between mb-3 border-b border-indigo-100/60 dark:border-indigo-900/30 pb-2">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-xs font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-200">
              System & Task Overview Metadata
            </h2>
          </div>
          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
            Work-Bridge Task State
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
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Task Reference ID</span>
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 mt-0.5 block">
                {task.task_code || 'TSK-AUTO'}
              </span>
            </div>
            <Tag className="w-3.5 h-3.5 text-indigo-400" />
          </div>

          <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Priority Level</span>
              <span className={`font-bold flex items-center gap-1 mt-0.5 text-xs px-2 py-0.5 rounded-md border ${getPriorityBadge(task.priority)}`}>
                {task.priority} Priority
              </span>
            </div>
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          </div>

          <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Logged Time</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                <Clock className="w-3.5 h-3.5 text-emerald-500" /> {formatLoggedTime(loggedMinutes)}
              </span>
            </div>
            <Lock className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
          </div>
        </div>
      </div>

      {/* Main Task Description & Scope Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-black text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 px-2.5 py-1 rounded-lg">
              {task.task_code}
            </span>
            {task.project_name ? (
              <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                <FolderKanban className="w-3.5 h-3.5 text-indigo-500" /> {task.project_name}
              </span>
            ) : (
              <span className="text-xs italic text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" /> Standalone Task
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
              Stage: {task.status || 'Backlog'}
            </span>
          </div>
        </div>

        <h2 className="text-xl font-black text-slate-900 dark:text-white leading-snug tracking-tight">
          {task.title || task.task_name}
        </h2>

        {task.description ? (
          <div className="bg-slate-50/80 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Task Description & Instructions</span>
            <p className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed whitespace-pre-line font-medium">
              {task.description}
            </p>
          </div>
        ) : (
          <p className="text-slate-400 text-xs italic">No detailed description provided for this task.</p>
        )}
      </div>

      {/* Req 2: Side-by-Side 2-Column Layout for Task Checklist and Discussion & Updates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Task Checklist Card (Left Column) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm">
                <CheckSquare className="w-5 h-5 text-blue-600" /> Task Checklist ({completedSubtasksCount}/{subtasks.length})
              </h3>
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{checklistProgress}% Completed</span>
            </div>

            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-200/80 dark:border-slate-700">
              <div
                className="bg-blue-600 h-full transition-all duration-300"
                style={{ width: `${checklistProgress}%` }}
              />
            </div>

            <div className="space-y-2.5 pt-2 max-h-80 overflow-y-auto pr-1">
              {subtasks.length === 0 ? (
                <p className="text-slate-400 text-xs italic py-6 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-800">
                  No checklist items yet. Add sub-tasks to track granular progress.
                </p>
              ) : (
                subtasks.map((s) => (
                  <div
                    key={s.id}
                    className={`flex items-start justify-between border rounded-xl p-3 transition-all ${
                      s.is_completed
                        ? 'bg-emerald-50/40 border-emerald-200/80 dark:bg-emerald-950/20'
                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 hover:bg-slate-100/60'
                    }`}
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0 pr-2">
                      <input
                        type="checkbox"
                        checked={s.is_completed}
                        onChange={(e) => handleToggleSubtask(s.id, e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 bg-white cursor-pointer mt-0.5"
                      />
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <span className={`text-xs font-semibold block leading-snug ${s.is_completed ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'}`}>
                          {s.item_text || s.item_name}
                        </span>
                        
                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400 font-medium">
                          {s.created_at && (
                            <span>Added: {new Date(s.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                          )}
                          {s.is_completed && (
                            <span className="text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-100/80 dark:bg-emerald-900/50 px-1.5 py-0.2 rounded">
                              ✓ Completed {s.completed_by_name ? `by ${s.completed_by_name}` : ''} {s.completed_at ? `on ${new Date(s.completed_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}` : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteSubtask(s.id)}
                      className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors shrink-0"
                      title="Delete item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <form onSubmit={handleAddSubtask} className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <input
              type="text"
              placeholder="Add new checklist item..."
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
            <button
              type="submit"
              disabled={isAddingChecklist || !newSubtaskTitle.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAddingChecklist ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" /> Adding...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" /> Add Item
                </>
              )}
            </button>
          </form>
        </div>

        {/* Discussion & Updates Card (Right Column) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm">
              <MessageSquare className="w-5 h-5 text-blue-600" /> Discussion & Updates ({comments.length})
            </h3>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {comments.length === 0 ? (
                <p className="text-slate-400 text-xs italic py-6 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-800">
                  No comments yet. Start the discussion below!
                </p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs border-b border-slate-200/60 dark:border-slate-700/60 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center">
                          {(c.author_name || 'U').charAt(0)}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 dark:text-white">{c.author_name || 'Team Member'}</span>
                          {c.author_code && (
                            <span className="text-[10px] font-mono font-semibold text-slate-500 bg-slate-200 dark:bg-slate-700 px-1.5 py-0.2 rounded">
                              {c.author_code}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        {c.created_at ? new Date(c.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : ''}
                      </span>
                    </div>
                    <p className="text-slate-800 dark:text-slate-200 text-xs leading-relaxed font-medium whitespace-pre-wrap pt-0.5">
                      {c.comment_text || c.comment}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <form onSubmit={handleAddComment} className="flex flex-col gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <textarea
              rows={2}
              placeholder="Write a comment or project update..."
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isPostingComment || !newCommentText.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPostingComment ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> Posting...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" /> Post Comment
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Task Overview, Timer Logs History & Task Activity Logs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Task Overview Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3 text-xs uppercase tracking-wider flex items-center gap-2">
            <User className="w-4 h-4 text-blue-600" /> Task Overview
          </h3>

          <div className="space-y-3 text-xs font-medium">
            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-purple-500" /> Assignee:
              </span>
              <span className="font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 border border-purple-200/60 px-2 py-0.5 rounded-md">
                {task.assignee_name || 'Unassigned'}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-500" /> Due Date:
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'None'}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-500" /> Estimated:
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{estimatedHours.toFixed(1)} Hours</span>
            </div>

            <div className="flex items-center justify-between py-1">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> Created:
              </span>
              <span className="font-semibold text-slate-600 dark:text-slate-400">
                {task.created_at ? new Date(task.created_at).toLocaleDateString() : '-'}
              </span>
            </div>
          </div>
        </div>

        {/* Timer Logs History Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-600" /> Timer Logs History
            </h3>
            <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 px-2 py-0.5 rounded-md">
              Worked: {formatLoggedTime(loggedMinutes)}
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
              <span>Logged: {loggedHours}h</span>
              <span>Est: {estimatedHours.toFixed(1)}h</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden border border-slate-200/80 dark:border-slate-700">
              <div
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.round((loggedMinutes / (task.estimated_minutes || 540)) * 100))}%` }}
              />
            </div>
          </div>

          <div className="space-y-2.5 pt-1 max-h-64 overflow-y-auto pr-1">
            {timerLogs.length === 0 ? (
              <div className="text-center py-6 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-800 space-y-1">
                <Clock className="w-6 h-6 text-slate-300 mx-auto" />
                <p className="text-slate-400 text-xs italic">No timer logs recorded yet.</p>
              </div>
            ) : (
              timerLogs.map((log) => (
                <div
                  key={log.id}
                  className={`border rounded-xl p-3 space-y-1.5 transition-all text-xs ${
                    log.is_running
                      ? 'bg-red-50/60 border-red-200 text-red-900 dark:bg-red-950/30 dark:border-red-900/60 animate-pulse'
                      : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 text-[11px]">
                      <User className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      {log.employee_name || 'Employee'}
                    </span>
                    {log.is_running ? (
                      <span className="text-[9px] bg-red-600 text-white px-2 py-0.5 rounded-full font-black animate-pulse">
                        LIVE RUNNING
                      </span>
                    ) : (
                      <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-950 px-2 py-0.5 rounded-md">
                        {formatLoggedTime(log.duration_minutes)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    <span>
                      Start: {log.start_time ? new Date(log.start_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                    </span>
                    {log.end_time && (
                      <span>
                        End: {new Date(log.end_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Task Activity Logs Timeline Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-600" /> Task Activity Log
            </h3>
            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded">
              {activityLogs.length} Events
            </span>
          </div>

          <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
            {activityLogs.length === 0 ? (
              <div className="text-center py-6 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-800">
                <p className="text-slate-400 text-xs italic">No activity log entries recorded yet.</p>
              </div>
            ) : (
              activityLogs.map((act) => (
                <div key={act.id} className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-xl p-2.5 text-xs space-y-1">
                  <div className="flex items-center justify-between font-bold text-[11px]">
                    <span className="text-indigo-600 dark:text-indigo-400">{act.action_type}</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      {act.created_at ? new Date(act.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : ''}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-600 dark:text-slate-300 font-medium">
                    {act.actor_name ? `By ${act.actor_name}` : 'System'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Manual Time Logging Modal */}
      {showManualLogModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600" /> Log Worked Time Manually
              </h3>
              <button
                onClick={() => setShowManualLogModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveManualLog} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Hours Worked
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="24"
                    step="0.5"
                    value={manualHours}
                    onChange={(e) => setManualHours(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Minutes
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    step="5"
                    value={manualMinutes}
                    onChange={(e) => setManualMinutes(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Work Description / Note
                </label>
                <textarea
                  rows={3}
                  value={manualDesc}
                  onChange={(e) => setManualDesc(e.target.value)}
                  placeholder="Describe work performed during this logged duration..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowManualLogModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingManualLog}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  {isSavingManualLog ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                  Save Worked Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
