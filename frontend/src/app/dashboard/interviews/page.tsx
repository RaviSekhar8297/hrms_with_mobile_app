'use client';

import React, { useState, useEffect } from 'react';

type Tab = 'my_schedules' | 'history';

export default function InterviewsDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('my_schedules');
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('SCHEDULED');

  const [feedback, setFeedback] = useState({
    technical_rating: 4,
    communication_rating: 4,
    detailed_feedback: '',
    recommendation: 'HIRE'
  });

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      const res = await fetch('/api/v1/interviews/schedules', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSchedules(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      setHistoryLoading(true);
      const token = localStorage.getItem('access_token');
      const res = await fetch('/api/v1/interviews/feedback/history', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'my_schedules') {
      fetchSchedules();
    } else if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab]);

  const handleSubmitFeedback = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch('/api/v1/interviews/feedback', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...feedback,
          schedule_id: selectedSchedule?.id,
          candidate_id: selectedSchedule?.candidate_id
        })
      });
      if (res.ok) {
        setShowFeedbackModal(false);
        fetchSchedules();
        fetchHistory();
        setFeedback({ technical_rating: 4, communication_rating: 4, detailed_feedback: '', recommendation: 'HIRE' });
      } else {
        alert('Failed to submit feedback. Please try again.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredSchedules = schedules.filter(item => {
    const matchesSearch = 
      (item.candidate_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.job_title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.candidate_email || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalUpcoming = schedules.filter(s => s.status === 'SCHEDULED').length;
  const totalCompleted = schedules.filter(s => s.status === 'COMPLETED').length;

  return (
    <div style={{ fontFamily: '"DM Sans", sans-serif' }} className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden">
      
      {/* HEADER & TOP STATS BAR */}
      <div className="flex-shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 sm:px-8 pt-6 pb-4 z-10 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider border border-indigo-100 dark:border-indigo-800/40">
                Recruitment & Talent Suite
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight font-outfit">
              Interview Panel & Evaluation
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
              Manage scheduled technical interviews, conduct candidate evaluations, and log scorecards.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-3">
            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2.5 flex items-center gap-3 shadow-2xs">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Upcoming</span>
                <span className="text-base font-extrabold text-slate-800 dark:text-white font-outfit leading-none">{totalUpcoming}</span>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2.5 flex items-center gap-3 shadow-2xs">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Completed</span>
                <span className="text-base font-extrabold text-slate-800 dark:text-white font-outfit leading-none">{totalCompleted}</span>
              </div>
            </div>
          </div>
        </div>

        {/* TAB NAVIGATION & SEARCH BAR */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2">
          
          <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl">
            {[
              { id: 'my_schedules', label: 'Assigned Interviews', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
              { id: 'history', label: 'Evaluation History', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as Tab)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
                  </svg>
                  {tab.label}
                </button>
              );
            })}
          </div>

          {activeTab === 'my_schedules' && (
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-64">
                <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Search candidate or job..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="ALL">All Status</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
          )}

        </div>
      </div>

      {/* CONTENT AREA */}
      <div className="flex-1 overflow-y-auto p-6 sm:p-8 relative">
        
        {/* =============================================================== */}
        {/* SCHEDULED INTERVIEWS TAB */}
        {/* =============================================================== */}
        {activeTab === 'my_schedules' && (
          <div>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
                <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
                <span className="text-xs font-bold text-slate-500">Loading interview schedules...</span>
              </div>
            ) : filteredSchedules.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center shadow-2xs">
                <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-indigo-100 dark:border-indigo-800/40">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white font-outfit">No Assigned Interviews Found</h3>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                  There are currently no interview schedules matching your criteria. New interview assignments will appear here automatically.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSchedules.map((item) => {
                  const startTime = item.scheduled_start_time ? new Date(item.scheduled_start_time) : null;
                  const formattedDate = startTime ? startTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'TBD';
                  const formattedTime = startTime ? startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'TBD';
                  const isCompleted = item.status === 'COMPLETED';

                  return (
                    <div 
                      key={item.id} 
                      className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md transition-all duration-200 flex flex-col justify-between relative overflow-hidden group space-y-4"
                    >
                      {/* Top Accent Indicator */}
                      <div className={`absolute top-0 left-0 right-0 h-1 ${isCompleted ? 'bg-emerald-500' : 'bg-indigo-600'}`} />

                      <div>
                        <div className="flex items-start justify-between gap-3 mb-3 pt-1">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-base font-black shadow-xs shrink-0 font-outfit">
                              {(item.candidate_name || 'C').charAt(0).toUpperCase()}
                            </div>
                            <div className="truncate">
                              <h3 className="text-sm font-black text-slate-900 dark:text-white truncate" title={item.candidate_name}>
                                {item.candidate_name || 'Candidate Record'}
                              </h3>
                              <p className="text-[11px] font-extrabold text-indigo-600 dark:text-indigo-400 truncate">
                                {item.job_title || 'Software Development'}
                              </p>
                            </div>
                          </div>

                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border shrink-0 ${
                            isCompleted 
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border-emerald-200/60 dark:border-emerald-800/40' 
                              : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 border-indigo-200/60 dark:border-indigo-800/40'
                          }`}>
                            {item.status || 'SCHEDULED'}
                          </span>
                        </div>

                        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Round</span>
                            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300">{item.round_name || 'Technical Round'}</span>
                          </div>

                          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Schedule</span>
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{formattedDate} • {formattedTime}</span>
                          </div>

                          {item.candidate_email && (
                            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email</span>
                              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 truncate max-w-[160px]">{item.candidate_email}</span>
                            </div>
                          )}

                          {item.candidate_phone && (
                            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phone</span>
                              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">{item.candidate_phone}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                        {item.meeting_link && item.meeting_link.startsWith('http') && (
                          <a
                            href={item.meeting_link}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                              <polygon points="23 7 16 12 23 17 23 7" />
                              <rect x="1" y="5" width="15" height="14" rx="2" />
                            </svg>
                            Meeting
                          </a>
                        )}

                        <button
                          onClick={() => { setSelectedSchedule(item); setShowFeedbackModal(true); }}
                          disabled={isCompleted}
                          className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer ${
                            isCompleted
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-700'
                              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20 active:scale-95'
                          }`}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                          {isCompleted ? 'Feedback Logged' : 'Evaluate & Score'}
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* =============================================================== */}
        {/* EVALUATION HISTORY TAB */}
        {/* =============================================================== */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {historyLoading ? (
              <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
                <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
                <span className="text-xs font-bold text-slate-500">Fetching evaluation history...</span>
              </div>
            ) : history.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center shadow-2xs">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-200 dark:border-slate-700">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white font-outfit">No Evaluation History Available</h3>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                  When technical feedback is submitted for a candidate, evaluation reports will be archived here.
                </p>
              </div>
            ) : (
              history.map((item) => (
                <div key={item.id} className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xs text-left">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-extrabold text-slate-900 dark:text-white font-outfit">
                          {item.candidate_name || 'Evaluated Candidate'}
                        </h4>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                          item.recommendation === 'STRONG_HIRE' || item.recommendation === 'HIRE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {item.recommendation || 'EVALUATED'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Position: <span className="font-bold text-slate-700 dark:text-slate-300">{item.job_title || 'Engineering'}</span> • Round: {item.round_name || 'Technical'}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
                      <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                        <span>Technical:</span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">{item.technical_rating}/5 ⭐</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                        <span>Communication:</span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">{item.communication_rating}/5 ⭐</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block mb-1">Detailed Evaluation Notes</span>
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50/70 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
                      {item.feedback || 'No detailed written comments provided.'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

      </div>

      {/* =============================================================== */}
      {/* EVALUATION DRAWER / MODAL */}
      {/* =============================================================== */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-50 overflow-hidden font-sans">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity" onClick={() => setShowFeedbackModal(false)} />
          
          <div className="fixed inset-y-0 right-0 max-w-xl w-full flex shadow-2xl transform transition-transform duration-300">
            <div className="w-full h-full bg-white dark:bg-slate-900 flex flex-col justify-between border-l border-slate-200 dark:border-slate-800">
              
              {/* Drawer Header */}
              <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-indigo-50/40 dark:bg-indigo-950/30">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Technical Scorecard</span>
                  <h2 className="text-xl font-extrabold text-slate-900 dark:text-white font-outfit mt-0.5">
                    Evaluate {selectedSchedule?.candidate_name || 'Candidate'}
                  </h2>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">
                    Position: {selectedSchedule?.job_title || 'Software Engineer'}
                  </p>
                </div>
                <button 
                  onClick={() => setShowFeedbackModal(false)} 
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Drawer Form Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 text-left">
                
                {/* Rating Pickers */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                      Technical Competency (1-5)
                    </label>
                    <select
                      value={feedback.technical_rating}
                      onChange={(e) => setFeedback({ ...feedback, technical_rating: parseInt(e.target.value) })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 dark:text-white focus:outline-none focus:border-indigo-600 cursor-pointer"
                    >
                      {[1, 2, 3, 4, 5].map((val) => (
                        <option key={val} value={val}>{val} - {val === 5 ? 'Exceptional' : val === 4 ? 'Strong' : val === 3 ? 'Average' : 'Below Average'}</option>
                      ))}
                    </select>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                      Communication Skill (1-5)
                    </label>
                    <select
                      value={feedback.communication_rating}
                      onChange={(e) => setFeedback({ ...feedback, communication_rating: parseInt(e.target.value) })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 dark:text-white focus:outline-none focus:border-indigo-600 cursor-pointer"
                    >
                      {[1, 2, 3, 4, 5].map((val) => (
                        <option key={val} value={val}>{val} - {val === 5 ? 'Fluent' : val === 4 ? 'Good' : val === 3 ? 'Fair' : 'Needs Work'}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Final Recommendation Dropdown */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                    Final Hiring Recommendation
                  </label>
                  <select
                    value={feedback.recommendation}
                    onChange={(e) => setFeedback({ ...feedback, recommendation: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-extrabold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-600 cursor-pointer"
                  >
                    <option value="STRONG_HIRE">🌟 STRONG HIRE - Exceeds Expectations</option>
                    <option value="HIRE">✅ HIRE - Meets All Requirements</option>
                    <option value="MAYBE">⚠️ MAYBE - Needs Second Round</option>
                    <option value="NO_HIRE">❌ NO HIRE - Does Not Meet Requirements</option>
                  </select>
                </div>

                {/* Written Feedback Notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                    Detailed Assessment & Key Takeaways
                  </label>
                  <textarea
                    rows={5}
                    value={feedback.detailed_feedback}
                    onChange={(e) => setFeedback({ ...feedback, detailed_feedback: e.target.value })}
                    placeholder="Provide specific notes on coding capability, system design performance, architecture questions, and cultural fit..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl p-4 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 resize-none"
                  />
                </div>

              </div>

              {/* Drawer Footer Actions */}
              <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3 bg-slate-50 dark:bg-slate-900">
                <button
                  onClick={() => setShowFeedbackModal(false)}
                  className="px-5 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitFeedback}
                  className="px-6 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 active:scale-[0.98] transition-all text-xs cursor-pointer"
                >
                  Submit Evaluation Report
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
