'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboard } from '../components/DashboardContext';

type Tab = 'pipeline' | 'completed';

interface OnboardingRecord {
  id: string;
  company_id: string;
  onboarding_code: string;
  candidate_id: string;
  application_id: string;
  candidate_offer_id?: string;
  created_employee_id?: string;
  portal_token?: string;
  onboarding_status: 'INITIATED' | 'OFFER_SENT' | 'LINK_SENT' | 'DOCS_SUBMITTED' | 'VERIFIED' | 'COMPLETED' | 'CANCELLED';
  target_joining_date: string;
  actual_joining_date?: string;
  candidate_submitted_data?: any;
  document_verification_status?: any;
  checklist_status?: any;
  created_at: string;
  candidate_name?: string;
  candidate_email?: string;
  candidate_phone?: string;
  job_title?: string;
}

export default function OnboardingDashboard() {
  const router = useRouter();
  const { showToast } = useDashboard();
  const [activeTab, setActiveTab] = useState<Tab>('pipeline');
  const [records, setRecords] = useState<OnboardingRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      const res = await fetch('http://localhost:5000/api/v1/onboarding', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRecords(data || []);
      }
    } catch (err) {
      console.error('Error fetching onboarding records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const handleSendOfferLetter = async (rec: OnboardingRecord) => {
    setProcessingAction(rec.id);
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`http://localhost:5000/api/v1/onboarding/${rec.id}/send-offer`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast(`📩 Offer Letter dispatched to ${rec.candidate_name || rec.candidate_email}`, 'success');
        fetchRecords();
      } else {
        showToast('Failed to send offer letter', 'error');
      }
    } catch (err) {
      showToast('Failed to send offer letter', 'error');
    } finally {
      setProcessingAction(null);
    }
  };

  const handleSendOnboardingLink = async (rec: OnboardingRecord) => {
    setProcessingAction(rec.id);
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch('http://localhost:5000/api/v1/onboarding/send-link', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ onboarding_id: rec.id })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`✨ Onboarding portal link sent to ${rec.candidate_name}`, 'success');
        fetchRecords();
      } else {
        showToast(data.error || 'Failed to send onboarding link', 'error');
      }
    } catch (err) {
      showToast('Failed to send onboarding link', 'error');
    } finally {
      setProcessingAction(null);
    }
  };

  const handleAcceptOfferManual = async (rec: OnboardingRecord) => {
    setProcessingAction(rec.id);
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`http://localhost:5000/api/v1/onboarding/${rec.id}/accept-offer`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast(`🟢 Offer accepted manually by HR for ${rec.candidate_name}! Ready for Review.`, 'success');
        fetchRecords();
      } else {
        showToast('Failed to accept offer', 'error');
      }
    } catch (err) {
      showToast('Failed to accept offer', 'error');
    } finally {
      setProcessingAction(null);
      setExpandedRowId(null);
    }
  };

  const handleRejectOfferManual = async (rec: OnboardingRecord) => {
    if (!confirm(`Are you sure you want to reject/cancel the offer for ${rec.candidate_name}?`)) return;
    setProcessingAction(rec.id);
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`http://localhost:5000/api/v1/onboarding/${rec.id}/reject-offer`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast(`🔴 Offer marked as Rejected/Cancelled for ${rec.candidate_name}`, 'info');
        fetchRecords();
      } else {
        showToast('Failed to reject offer', 'error');
      }
    } catch (err) {
      showToast('Failed to reject offer', 'error');
    } finally {
      setProcessingAction(null);
      setExpandedRowId(null);
    }
  };

  const activePipelineRecords = records.filter(r => r.onboarding_status !== 'COMPLETED' && r.onboarding_status !== 'CANCELLED');
  const completedRecords = records.filter(r => r.onboarding_status === 'COMPLETED');

  const targetList = activeTab === 'pipeline' ? activePipelineRecords : completedRecords;

  const filteredRecords = targetList.filter(item => {
    const matchesSearch =
      (item.candidate_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.job_title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.candidate_email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.onboarding_code || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'ALL' || item.onboarding_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalUpcoming = activePipelineRecords.length;
  const totalCompleted = completedRecords.length;

  const getStageInfo = (status: string) => {
    switch (status) {
      case 'INITIATED':
        return { label: '1. Offer Initiated', badgeBg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700', pct: 15 };
      case 'OFFER_SENT':
        return { label: '1. Offer Sent', badgeBg: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/40', pct: 30 };
      case 'LINK_SENT':
        return { label: '2. Link Sent', badgeBg: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/40', pct: 50 };
      case 'DOCS_SUBMITTED':
        return { label: '3. Docs Submitted', badgeBg: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/40', pct: 75 };
      case 'COMPLETED':
        return { label: '4. Active Employee', badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40', pct: 100 };
      case 'CANCELLED':
        return { label: 'Offer Rejected', badgeBg: 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/40', pct: 0 };
      default:
        return { label: status, badgeBg: 'bg-slate-100 text-slate-600 border-slate-200', pct: 10 };
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans text-left">
      
      {/* HEADER & TOP STATS BAR */}
      <div className="flex-shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 sm:px-8 pt-6 pb-4 z-10 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-[11px] font-extrabold uppercase tracking-wider border border-indigo-100 dark:border-indigo-800/40">
                Recruitment & Talent Suite
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight font-outfit">
              Employee Onboarding Portal
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
              Manage pre-joining candidate self-service, verify compliance documents, and 1-click convert into active employees.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-3">
            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2.5 flex items-center gap-3 shadow-2xs">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="8.5" cy="7" r="4" />
                  <polyline points="17 11 19 13 23 9" />
                </svg>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Onboarding</span>
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
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Converted</span>
                <span className="text-base font-extrabold text-slate-800 dark:text-white font-outfit leading-none">{totalCompleted}</span>
              </div>
            </div>
          </div>
        </div>

        {/* TAB NAVIGATION & SEARCH BAR */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2">
          
          <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl">
            {[
              { id: 'pipeline', label: 'Active Pipeline', icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z' },
              { id: 'completed', label: 'Converted Employees', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
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

          <div className="flex items-center gap-3">
            {/* SEARCH WRAPPER */}
            <div className="onboarding-search-wrapper flex items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 focus-within:border-indigo-500 transition-all flex-1 sm:w-72 shadow-2xs">
              <svg className="w-4 h-4 text-slate-400 shrink-0 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search candidate name or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="onboarding-search-input bg-transparent border-0 outline-none w-full text-xs font-semibold text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
            >
              <option value="ALL">All Stages</option>
              <option value="INITIATED">Offer Initiated</option>
              <option value="OFFER_SENT">1. Offer Sent</option>
              <option value="LINK_SENT">2. Link Sent</option>
              <option value="DOCS_SUBMITTED">3. Docs Submitted</option>
              <option value="COMPLETED">4. Active Employee</option>
            </select>
          </div>

        </div>
      </div>

      {/* CONTENT AREA - VIBRANT PURPLE ACTIONS BUTTON */}
      <div className="flex-1 overflow-y-auto p-6 sm:p-8 relative">
        
        <div className="space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
              <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
              <span className="text-xs font-bold text-slate-500">Loading onboarding records...</span>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center shadow-2xs">
              <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-indigo-100 dark:border-indigo-800/40">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="8.5" cy="7" r="4" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white font-outfit">No Onboarding Candidates Found</h3>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                There are currently no candidate records matching your search query. Select candidates in Recruitment ATS to add them here.
              </p>
            </div>
          ) : (
            filteredRecords.map((item) => {
              const stage = getStageInfo(item.onboarding_status);
              const isCompleted = item.onboarding_status === 'COMPLETED';
              const isOfferSent = item.onboarding_status !== 'INITIATED';
              const isLinkSent = item.onboarding_status === 'LINK_SENT';
              const hasSubmittedDocs = item.onboarding_status === 'DOCS_SUBMITTED' || item.onboarding_status === 'VERIFIED' || isCompleted;
              const isExpanded = expandedRowId === item.id;

              return (
                <div 
                  key={item.id} 
                  className="px-6 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md transition-all duration-200 flex flex-wrap items-center justify-between gap-4 relative text-left"
                >
                  {/* Left Accent Stripe */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl ${isCompleted ? 'bg-emerald-500' : hasSubmittedDocs ? 'bg-amber-500' : isOfferSent ? 'bg-blue-500' : 'bg-indigo-600'}`} />

                  {/* 1. Candidate Info Block */}
                  <div className="flex items-center gap-3.5 pl-2 min-w-[260px]">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center text-base font-extrabold shadow-sm shrink-0 font-outfit">
                      {(item.candidate_name || 'C').charAt(0).toUpperCase()}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white font-outfit tracking-tight">
                          {item.candidate_name || 'Candidate Record'}
                        </h3>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {item.onboarding_code}
                        </span>
                      </div>

                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        {item.candidate_email} • <span className="font-bold text-slate-700 dark:text-slate-300">📞 {item.candidate_phone || '9876543210'}</span>
                      </p>
                    </div>
                  </div>

                  {/* 2. Role Pill */}
                  <div className="shrink-0">
                    <span className="px-3 py-1 rounded-xl text-xs font-extrabold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50">
                      💼 {item.job_title || 'AI & ML'}
                    </span>
                  </div>

                  {/* 3. Joining Date Pill */}
                  <div className="shrink-0 text-xs">
                    <span className="text-slate-400 font-medium">Joining: </span>
                    <strong className="text-slate-800 dark:text-slate-200 font-extrabold">
                      {item.target_joining_date ? new Date(item.target_joining_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD'}
                    </strong>
                  </div>

                  {/* 4. Stage & Progress Bar */}
                  <div className="flex items-center gap-3 shrink-0 min-w-[180px]">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${stage.badgeBg}`}>
                      {stage.label}
                    </span>

                    <div className="w-20 space-y-1">
                      <div className="flex justify-between items-center text-[9px] font-bold">
                        <span className="text-slate-400">Prog</span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-mono">{stage.pct}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200/50">
                        <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-500" style={{ width: `${stage.pct}%` }} />
                      </div>
                    </div>
                  </div>

                  {/* 5. ACTION BUTTONS & ACTIONS BUTTON */}
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    
                    {/* Step 1: Send Offer Letter */}
                    {!isOfferSent ? (
                      <button
                        onClick={() => handleSendOfferLetter(item)}
                        disabled={processingAction === item.id}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-xl transition-all cursor-pointer shadow-xs disabled:opacity-50"
                        title="Dispatch Offer Letter to candidate"
                      >
                        {processingAction === item.id ? 'Sending...' : '📩 Send Offer'}
                      </button>
                    ) : (
                      <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 text-[11px] font-bold rounded-xl flex items-center gap-1">
                        ✓ Offer Sent
                      </span>
                    )}

                    {/* Step 2: Send Onboarding Link OR Actions Toolbar */}
                    {!isCompleted && (
                      !isOfferSent ? (
                        <button
                          disabled
                          className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800/50 text-slate-400 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 cursor-not-allowed"
                          title="Send Offer Letter First to Enable Onboarding Link"
                        >
                          🔒 Link Locked
                        </button>
                      ) : !isLinkSent && !hasSubmittedDocs ? (
                        <button
                          onClick={() => handleSendOnboardingLink(item)}
                          disabled={processingAction === item.id}
                          className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-xl transition-all cursor-pointer border border-blue-200 dark:border-blue-800/40 disabled:opacity-50"
                          title="Send Portal Link to Candidate"
                        >
                          {processingAction === item.id ? 'Sending...' : '🔗 Send Link'}
                        </button>
                      ) : isLinkSent && !hasSubmittedDocs ? (
                        /* CLEAN ACTIONS BUTTON */
                        <div className="flex items-center gap-1.5">
                          <span className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 text-xs font-extrabold rounded-xl flex items-center gap-1.5 shadow-2xs">
                            <span className="h-4 w-4 rounded-full bg-emerald-600 text-white text-[10px] font-black flex items-center justify-center">✓</span>
                            <span>Link Sent</span>
                          </span>

                          {!isExpanded ? (
                            <button
                              onClick={() => setExpandedRowId(item.id)}
                              className="px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-purple-600/20 border-0 group"
                              title="Click for Manual Accept/Reject Actions"
                            >
                              <span className="group-hover:rotate-180 transition-transform duration-500">⚙️</span>
                              <span className="font-extrabold tracking-tight">Actions</span>
                            </button>
                          ) : (
                            /* EXPANDED INLINE BUTTONS */
                            <div className="flex items-center gap-1 bg-slate-900 text-white p-1 rounded-xl shadow-lg border border-slate-700 animate-fadeIn">
                              <button
                                onClick={() => handleAcceptOfferManual(item)}
                                disabled={processingAction === item.id}
                                className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-extrabold rounded-lg transition-all cursor-pointer"
                                title="Accept Offer on behalf of candidate"
                              >
                                🟢 Accept
                              </button>

                              <button
                                onClick={() => handleRejectOfferManual(item)}
                                disabled={processingAction === item.id}
                                className="px-2.5 py-1 bg-rose-500 hover:bg-rose-600 text-white text-xs font-extrabold rounded-lg transition-all cursor-pointer"
                                title="Reject / Cancel Offer"
                              >
                                🔴 Reject
                              </button>

                              <button
                                onClick={() => handleSendOnboardingLink(item)}
                                disabled={processingAction === item.id}
                                className="px-2.5 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs font-extrabold rounded-lg transition-all cursor-pointer"
                                title="Resend Portal Link"
                              >
                                🔄 Resend
                              </button>

                              <button
                                onClick={() => setExpandedRowId(null)}
                                className="px-1.5 py-1 text-slate-400 hover:text-white font-bold text-xs cursor-pointer ml-1"
                              >
                                ✕
                              </button>
                            </div>
                          )}
                        </div>
                      ) : null
                    )}

                    {/* Step 3: Review & Approve Button */}
                    {hasSubmittedDocs ? (
                      <button
                        onClick={() => router.push(`/dashboard/onboarding/${item.id}`)}
                        className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
                      >
                        <span>👁</span> Review & Approve
                      </button>
                    ) : (
                      <span className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-extrabold text-[11px] rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-1 cursor-not-allowed">
                        <span>⏳</span> Waiting
                      </span>
                    )}

                  </div>

                </div>
              );
            })
          )}
        </div>

      </div>

      {/* SCOPED OVERRIDE STYLES TO PREVENT INPUT ICON OVERLAP */}
      <style>{`
        .onboarding-search-input {
          padding-left: 0px !important;
          padding-top: 0px !important;
          padding-bottom: 0px !important;
          box-shadow: none !important;
        }
      `}</style>

    </div>
  );
}
