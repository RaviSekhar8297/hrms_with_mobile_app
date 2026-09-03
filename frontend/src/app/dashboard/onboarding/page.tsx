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
  email_status?: string;
  email_error_message?: string;
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

  // Company Filter States (Super Admin)
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Direct Candidate Invite Modal States
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [senderEmail, setSenderEmail] = useState<string>('');
  const [availableSenders, setAvailableSenders] = useState<{ id: string; email: string; name: string }[]>([]);
  const [inviteForm, setInviteForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    job_title: '',
    candidate_type: 'EXPERIENCED' as 'EXPERIENCED' | 'FRESHER',
    target_joining_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });
  const [submittingInvite, setSubmittingInvite] = useState(false);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        if (u.role === 'SUPER_ADMIN' || u.is_super_admin) setIsSuperAdmin(true);
      } catch {}
    }
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch('/api/v1/companies', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCompanies(data.companies || []);
      }
    } catch (err) {}
  };

  useEffect(() => {
    if (isInviteModalOpen) {
      const token = localStorage.getItem('access_token');
      let url = '/api/v1/onboarding/smtp-info';
      if (selectedCompanyId) {
        url += `?company_id=${selectedCompanyId}`;
      }
      fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(data => {
          const sendersList = data.available_senders || data.senders || [];
          if (sendersList.length > 0) {
            setAvailableSenders(sendersList);
            setSenderEmail(data.selected_email || data.sender_email || sendersList[0].email);
          }
        })
        .catch(() => {});
    }
  }, [isInviteModalOpen, selectedCompanyId]);

  const handleDirectInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteForm.full_name || !inviteForm.email) {
      showToast('Full name and Email are required', 'error');
      return;
    }
    setSubmittingInvite(true);
    try {
      const token = localStorage.getItem('access_token');
      const companyId = localStorage.getItem('selectedCompanyId');
      const res = await fetch('/api/v1/onboarding/direct-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ...inviteForm, company_id: companyId, sender_email: senderEmail })
      });
      if (res.ok) {
        const data = await res.json();
        const magicUrl = `${window.location.origin}${data.magic_link}`;
        try {
          await navigator.clipboard.writeText(magicUrl);
        } catch {}

        if (data.email_sent === false) {
          showToast(`⚠️ Invite created & link copied, but Email dispatch failed: ${data.email_error || 'SMTP Error'}`, 'error');
        } else {
          showToast(`🚀 Onboarding invite created, Email sent & link copied to clipboard!`, 'success');
        }
        setIsInviteModalOpen(false);
        setInviteForm({
          full_name: '',
          email: '',
          phone: '',
          job_title: '',
          candidate_type: 'EXPERIENCED',
          target_joining_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        });
        fetchRecords();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to send direct invite', 'error');
      }
    } catch (e) {
      showToast('Connection error sending direct invite', 'error');
    } finally {
      setSubmittingInvite(false);
    }
  };

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      let url = '/api/v1/onboarding';
      if (selectedCompanyId) {
        url += `?company_id=${selectedCompanyId}`;
      }
      const res = await fetch(url, {
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
  }, [selectedCompanyId]);

  const handleSendOfferLetter = async (rec: OnboardingRecord) => {
    setProcessingAction(rec.id);
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`/api/v1/onboarding/${rec.id}/send-offer`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast(`📩 Offer Letter sent to ${rec.candidate_name || rec.candidate_email}`, 'success');
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
      const res = await fetch('/api/v1/onboarding/send-link', {
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
      const res = await fetch(`/api/v1/onboarding/${rec.id}/accept-offer`, {
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
      const res = await fetch(`/api/v1/onboarding/${rec.id}/reject-offer`, {
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

          {/* Direct Candidate Invite Action & Company Selector */}
          <div className="flex items-center gap-3">
            {companies.length > 0 && (
              <select
                value={selectedCompanyId || 'all'}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-extrabold text-slate-900 dark:text-white outline-none cursor-pointer shadow-2xs"
              >
                <option value="all">🌐 All Companies</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={() => setIsInviteModalOpen(true)}
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-extrabold rounded-xl shadow-md shadow-indigo-600/20 flex items-center gap-2 transition-all cursor-pointer border-0 active:scale-95 whitespace-nowrap"
            >
              <span className="text-sm font-black">+</span>
              <span>Direct Candidate Invite</span>
            </button>
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
            {/* SEARCH INPUT MATCHING ALL STAGES HEIGHT EXACTLY */}
            <div className="relative flex items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 h-10 w-full sm:w-80 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all shadow-2xs">
              <svg className="w-4 h-4 text-slate-400 shrink-0 mr-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search candidate name, email, role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-0 outline-none w-full text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 h-full"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer shadow-2xs shrink-0"
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

                  {/* 5. SINGLE CLEAN MANAGE BUTTON */}
                  <div className="shrink-0">
                    <button
                      onClick={() => router.push(`/dashboard/onboarding/${item.id}`)}
                      className="px-4 py-2 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-600 text-indigo-600 hover:text-white dark:text-indigo-400 font-extrabold text-xs rounded-xl border border-indigo-200 dark:border-indigo-800 transition-all cursor-pointer shadow-2xs flex items-center gap-2 group"
                    >
                      <span>Manage Onboarding</span>
                      <span className="group-hover:translate-x-1 transition-transform font-black">→</span>
                    </button>
                  </div>

                </div>
              );
            })
          )}
        </div>

      </div>

      {/* 🚀 DIRECT CANDIDATE ONBOARDING INVITE OFF-CANVAS SLIDE DRAWER */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop (Click to Close Drawer) */}
          <div 
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-xs transition-opacity cursor-pointer"
            onClick={() => setIsInviteModalOpen(false)}
          ></div>
          
          <div className="relative w-full max-w-[520px] bg-white dark:bg-slate-900 h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col animate-slideInRight">
            
            {/* DRAWER HEADER */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-slate-900 dark:to-slate-850">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center text-xl font-bold shadow-md">
                  🚀
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white font-outfit">Direct Candidate Invite</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Bypass ATS & dispatch onboarding portal link directly</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="w-9 h-9 rounded-full bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center font-bold text-sm cursor-pointer border border-slate-200 dark:border-slate-700 hover:bg-slate-100 transition-all"
              >
                ✕
              </button>
            </div>

            {/* DRAWER FORM BODY */}
            <div className="flex-1 overflow-y-auto p-6">
              <form onSubmit={handleDirectInviteSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kiran Kumar"
                    value={inviteForm.full_name}
                    onChange={(e) => setInviteForm({ ...inviteForm, full_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-purple-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      placeholder="kiran@gmail.com"
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Phone Number</label>
                    <input
                      type="tel"
                      placeholder="9848012345"
                      value={inviteForm.phone}
                      onChange={(e) => setInviteForm({ ...inviteForm, phone: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Job Designation</label>
                    <input
                      type="text"
                      placeholder="e.g. Software Engineer"
                      value={inviteForm.job_title}
                      onChange={(e) => setInviteForm({ ...inviteForm, job_title: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Target Joining Date</label>
                    <input
                      type="date"
                      value={inviteForm.target_joining_date}
                      onChange={(e) => setInviteForm({ ...inviteForm, target_joining_date: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Candidate Joining Type *
                  </label>
                  <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setInviteForm({ ...inviteForm, candidate_type: 'EXPERIENCED' })}
                      className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 ${
                        inviteForm.candidate_type === 'EXPERIENCED'
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 scale-[1.01]'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-bold'
                      }`}
                    >
                      <span>💼</span>
                      <span>Experienced Professional</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setInviteForm({ ...inviteForm, candidate_type: 'FRESHER' })}
                      className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 ${
                        inviteForm.candidate_type === 'FRESHER'
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 scale-[1.01]'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-bold'
                      }`}
                    >
                      <span>🎓</span>
                      <span>Fresher Candidate</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Sending Email From (SMTP Sender) *
                  </label>
                  {availableSenders.length > 0 ? (
                    <select
                      value={senderEmail}
                      onChange={(e) => setSenderEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
                    >
                      {availableSenders.map((s) => (
                        <option key={s.id || s.email} value={s.email}>
                          ✉️ {s.email} {s.name ? `(${s.name})` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2 shadow-2xs">
                      <span>✉️</span>
                      <span>{senderEmail || 'hr@brihaspathi.com'}</span>
                      <span className="ml-auto text-[10px] text-slate-400 font-mono">(System SMTP Email)</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsInviteModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingInvite}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-black shadow-md shadow-purple-600/20 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
                  >
                    {submittingInvite ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Sending Invite...</span>
                      </>
                    ) : (
                      <>
                        <span>🚀 Send Direct Invite</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

          </div>
        </div>
      )}

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
