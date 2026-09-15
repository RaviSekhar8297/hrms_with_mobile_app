'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardPageHeader from '../../../components/DashboardPageHeader';
import { getHeaders, API_BASE } from '../../../utils/api';
import { useDashboard } from '../../../components/DashboardContext';
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
  FolderKanban
} from 'lucide-react';

export default function WorkBridgeTaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params?.id as string;

  const { showToast } = useDashboard();

  const [task, setTask] = useState<any | null>(null);
  const [subtasks, setSubtasks] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [activeTimer, setActiveTimer] = useState<any | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newCommentText, setNewCommentText] = useState('');

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
    try {
      const endpoint = activeTimer ? '/api/v1/workbridge/timer/stop' : '/api/v1/workbridge/timer/start';
      const body = activeTimer ? {} : { task_id: taskId };
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        showToast(activeTimer ? 'Timer stopped!' : 'Timer started!', 'success');
        fetchActiveTimer();
        fetchTaskDetail();
      } else {
        const err = await res.json();
        showToast(err.error || 'Timer action failed', 'error');
      }
    } catch (e) {
      showToast('Error toggling timer', 'error');
    }
  };

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;

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
      }
    } catch (e) {
      showToast('Failed to add subtask', 'error');
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
    if (!newCommentText.trim()) return;

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
      }
    } catch (e) {
      showToast('Failed to post comment', 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3 min-h-[400px]">
        <div className="w-8 h-8 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
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
          className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm"
        >
          Back to Tasks
        </button>
      </div>
    );
  }

  const completedSubtasksCount = subtasks.filter((s) => s.is_completed).length;
  const checklistProgress = subtasks.length > 0 ? Math.round((completedSubtasksCount / subtasks.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push('/dashboard/workbridge/tasks')}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Tasks
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleTimer}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all shadow-sm ${
              activeTimer
                ? 'bg-red-50 text-red-700 border-red-200 animate-pulse'
                : 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {activeTimer ? (
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

      {/* Task Header Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
              {task.task_code}
            </span>
            {task.project_name && (
              <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                <FolderKanban className="w-3.5 h-3.5" /> {task.project_name}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              {task.priority} Priority
            </span>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 leading-snug">{task.title || task.task_name}</h1>

        {task.description && (
          <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line bg-slate-50 p-4 rounded-xl border border-slate-200">
            {task.description}
          </p>
        )}
      </div>

      {/* 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Subtasks */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 flex items-center gap-2 text-base">
                <CheckSquare className="w-5 h-5 text-emerald-600" /> Task Checklist ({completedSubtasksCount}/{subtasks.length})
              </h3>
              <span className="text-xs font-bold text-emerald-600">{checklistProgress}% Completed</span>
            </div>

            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
              <div
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{ width: `${checklistProgress}%` }}
              />
            </div>

            <div className="space-y-2 pt-2">
              {subtasks.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-3"
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={s.is_completed}
                      onChange={(e) => handleToggleSubtask(s.id, e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 bg-white cursor-pointer"
                    />
                    <span className={`text-sm ${s.is_completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                      {s.item_text || s.item_name}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteSubtask(s.id)}
                    className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddSubtask} className="flex gap-2 pt-2">
              <input
                type="text"
                placeholder="Add new checklist item..."
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1 shadow-sm"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </form>
          </div>

          {/* Comments */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 flex items-center gap-2 text-base">
              <MessageSquare className="w-5 h-5 text-emerald-600" /> Discussion & Updates ({comments.length})
            </h3>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {comments.length === 0 ? (
                <p className="text-slate-400 text-xs italic py-4 text-center">No comments yet. Start the discussion!</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-emerald-700 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" /> {c.author_name || 'Team Member'}
                      </span>
                      <span className="text-slate-400">
                        {c.created_at ? new Date(c.created_at).toLocaleString() : ''}
                      </span>
                    </div>
                    <p className="text-slate-800 text-sm leading-relaxed">{c.comment_text || c.comment}</p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleAddComment} className="flex flex-col gap-2 pt-2">
              <textarea
                rows={3}
                placeholder="Write a comment..."
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" /> Post Comment
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-3 text-xs uppercase tracking-wider">
              Task Details
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" /> Due Date:
                </span>
                <span className="font-semibold text-slate-800">
                  {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'None'}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" /> Estimated:
                </span>
                <span className="font-semibold text-slate-800">{((task.estimated_minutes || 0) / 60).toFixed(1)} Hours</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
