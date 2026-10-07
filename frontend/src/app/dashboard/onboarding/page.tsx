'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardPageHeader from '../components/DashboardPageHeader';
import SlideDrawer from '../components/SlideDrawer';
import { useDashboard } from '../components/DashboardContext';
import { usePermissions } from '../hooks/usePermissions';
import { getHeaders } from '../utils/api';
import PageLoader from '@/components/ui/PageLoader';

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
  const { showToast, companyId: globalCompanyId } = useDashboard();
  const { hasPermission, isSuperAdmin: isSuperAdminPerm } = usePermissions();

  const isSuperAdmin = isSuperAdminPerm;

  const canView = isSuperAdmin || hasPermission('onboardings_view') || hasPermission('view_onboardings') || hasPermission('onboarding_view') || hasPermission('employee_onboardings_view');
  const canCreate = isSuperAdmin || hasPermission('onboardings_create') || hasPermission('create_onboardings') || hasPermission('onboarding_create') || hasPermission('employee_onboardings_create');

  const [activeTab, setActiveTab] = useState<Tab>('pipeline');
  const [records, setRecords] = useState<OnboardingRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const activeCompanyId = globalCompanyId || (typeof window !== 'undefined' ? localStorage.getItem('companyId') : '');

  // Direct Candidate Invite Drawer States
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
    if (canView) {
      fetchRecords();
    }
  }, [activeCompanyId, canView]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      let url = '/api/v1/onboarding';
      if (activeCompanyId && activeCompanyId !== 'all') {
        url += `?company_id=${activeCompanyId}`;
      }
      const res = await fetch(url, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.onboardings || []);
        setRecords(list);
      } else {
        showToast('Error loading onboarding records', 'error');
      }
    } catch (err) {
      showToast('Connection failure loading onboarding records', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isInviteModalOpen) {
      let url = '/api/v1/onboarding/smtp-info';
      if (activeCompanyId && activeCompanyId !== 'all') {
        url += `?company_id=${activeCompanyId}`;
      }
      fetch(url, { headers: getHeaders() })
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
  }, [isInviteModalOpen, activeCompanyId]);

  const handleDirectInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteForm.full_name || !inviteForm.email) {
      showToast('Full name and Email are required', 'error');
      return;
    }
    setSubmittingInvite(true);
    try {
      const companyId = activeCompanyId && activeCompanyId !== 'all' ? activeCompanyId : undefined;
      const res = await fetch('/api/v1/onboarding/direct-invite', {
        method: 'POST',
        headers: getHeaders(),
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
        showToast(err.error || 'Failed to create candidate invite', 'error');
      }
    } catch (err) {
      showToast('Connection error sending candidate invite', 'error');
    } finally {
      setSubmittingInvite(false);
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
  const totalOffersSent = records.filter(r => r.onboarding_status === 'OFFER_SENT' || r.onboarding_status === 'LINK_SENT').length;
  const totalDocsSubmitted = records.filter(r => r.onboarding_status === 'DOCS_SUBMITTED' || r.onboarding_status === 'VERIFIED').length;

  const getStageInfo = (status: string) => {
    switch (status) {
      case 'INITIATED':
        return { label: '1. Offer Initiated', badgeBg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700', pct: 15 };
      case 'OFFER_SENT':
        return { label: '1. Offer Sent', badgeBg: 'bg-[#07518a]/10 text-[#07518a] dark:text-[#38bdf8] border-[#07518a]/30', pct: 30 };
      case 'LINK_SENT':
        return { label: '2. Link Sent', badgeBg: 'bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-800', pct: 50 };
      case 'DOCS_SUBMITTED':
        return { label: '3. Docs Submitted', badgeBg: 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800', pct: 75 };
      case 'COMPLETED':
        return { label: '4. Active Employee', badgeBg: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800', pct: 100 };
      case 'CANCELLED':
        return { label: 'Offer Rejected', badgeBg: 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800', pct: 0 };
      default:
        return { label: status, badgeBg: 'bg-slate-100 text-slate-600 border-slate-200', pct: 10 };
    }
  };

  if (!canView) {
    return (
      <div className="space-y-6 pb-12">
        <DashboardPageHeader
          title="Employee Onboarding Portal"
          companyId={activeCompanyId}
          hideCompanySelect={true}
          hideUserBadge={true}
        />
        <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
          <div className="w-14 h-14 bg-rose-50 dark:bg-rose-950/50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-3 text-2xl font-bold">
            🚫
          </div>
          <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100">Access Restricted</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            You do not have permission to view employee onboarding portal. Please contact your system administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* 🚀 DASHBOARD PAGE HEADER WITH DIRECT INVITE ACTION */}
      <DashboardPageHeader
        title="Employee Onboarding Portal"
        companyId={activeCompanyId}
        hideCompanySelect={true}
        hideUserBadge={true}
      >
        {canCreate && (
          <button
            type="button"
            onClick={() => setIsInviteModalOpen(true)}
            className="px-4 py-2 bg-[#07518a] hover:bg-[#053d69] text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            <span>Direct Candidate Invite</span>
          </button>
        )}
      </DashboardPageHeader>

      {/* 📊 SUMMARY METRICS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Active Pipeline</span>
            <span className="text-2xl font-black text-[#07518a] dark:text-[#38bdf8] font-mono mt-1 block">{totalUpcoming}</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#07518a]/10 text-[#07518a] dark:text-[#38bdf8] border border-[#07518a]/20 flex items-center justify-center font-bold text-xl">
            🚀
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-extrabold text-sky-600 dark:text-sky-400 uppercase tracking-wider block">Offer / Links Sent</span>
            <span className="text-2xl font-black text-sky-600 dark:text-sky-400 font-mono mt-1 block">{totalOffersSent}</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-900 flex items-center justify-center font-bold text-xl">
            ✉️
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">Docs Submitted</span>
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono mt-1 block">{totalDocsSubmitted}</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900 flex items-center justify-center font-bold text-xl">
            📑
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">Converted Employees</span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1 block">{totalCompleted}</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900 flex items-center justify-center font-bold text-xl">
            ✅
          </div>
        </div>
      </div>

      {/* 🎛️ CONTROLS, TABS & FILTER BAR */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* TABS SWITCHER */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
          <button
            onClick={() => setActiveTab('pipeline')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'pipeline'
                ? 'bg-[#07518a] text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <span>🚀 Active Pipeline</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${activeTab === 'pipeline' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
              {totalUpcoming}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('completed')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'completed'
                ? 'bg-[#07518a] text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <span>✅ Converted Employees</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${activeTab === 'completed' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
              {totalCompleted}
            </span>
          </button>
        </div>

        {/* SEARCH & STATUS FILTER */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Search candidate, role, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#07518a] font-medium"
            />
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#07518a] cursor-pointer"
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

      {/* 📋 CANDIDATES LIST / CARDS */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <PageLoader message="Loading onboarding records..." />
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
            <span className="text-4xl block mb-2">📋</span>
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">No Onboarding Records Found</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              There are no candidate records matching your current filter. Click "Direct Candidate Invite" to invite a new candidate.
            </p>
          </div>
        ) : (
          filteredRecords.map((item) => {
            const stage = getStageInfo(item.onboarding_status);
            const isCompleted = item.onboarding_status === 'COMPLETED';
            const isOfferSent = item.onboarding_status !== 'INITIATED';
            const hasSubmittedDocs = item.onboarding_status === 'DOCS_SUBMITTED' || item.onboarding_status === 'VERIFIED' || isCompleted;

            return (
              <div 
                key={item.id} 
                className="px-6 py-4 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl hover:border-[#07518a]/50 dark:hover:border-[#38bdf8]/50 hover:shadow-md transition-all duration-200 flex flex-wrap items-center justify-between gap-4 relative text-left"
              >
                {/* Left Accent Stripe */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl ${isCompleted ? 'bg-emerald-500' : hasSubmittedDocs ? 'bg-amber-500' : isOfferSent ? 'bg-sky-500' : 'bg-[#07518a]'}`} />

                {/* 1. Candidate Info Block */}
                <div className="flex items-center gap-3.5 pl-2 min-w-[260px]">
                  <div className="w-10 h-10 rounded-xl bg-[#07518a]/10 text-[#07518a] dark:text-[#38bdf8] border border-[#07518a]/20 flex items-center justify-center text-sm font-black shrink-0">
                    {(item.candidate_name || 'C').charAt(0).toUpperCase()}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">
                        {item.candidate_name || 'Candidate Record'}
                      </h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {item.onboarding_code}
                      </span>
                    </div>

                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                      {item.candidate_email} {item.candidate_phone ? `• 📞 ${item.candidate_phone}` : ''}
                    </p>
                  </div>
                </div>

                {/* 2. Role Pill */}
                <div className="shrink-0">
                  <span className="px-3 py-1 rounded-xl text-xs font-bold bg-[#07518a]/10 text-[#07518a] dark:text-[#38bdf8] border border-[#07518a]/20">
                    💼 {item.job_title || 'New Role'}
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
                      <span className="text-[#07518a] dark:text-[#38bdf8] font-mono">{stage.pct}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200/50">
                      <div className="h-full bg-gradient-to-r from-[#07518a] to-emerald-500 transition-all duration-500" style={{ width: `${stage.pct}%` }} />
                    </div>
                  </div>
                </div>

                {/* 5. MANAGE BUTTON */}
                <div className="shrink-0">
                  <button
                    onClick={() => router.push(`/dashboard/onboarding/${item.id}`)}
                    className="px-4 py-2 bg-[#07518a]/10 hover:bg-[#07518a] text-[#07518a] hover:text-white dark:text-[#38bdf8] dark:hover:text-white font-bold text-xs rounded-xl border border-[#07518a]/30 transition-all cursor-pointer flex items-center gap-1.5 group"
                  >
                    <span>Manage Onboarding</span>
                    <span className="group-hover:translate-x-0.5 transition-transform font-bold">→</span>
                  </button>
                </div>

              </div>
            );
          })
        )}
      </div>

      {/* 🚪 DIRECT CANDIDATE ONBOARDING INVITE SLIDE DRAWER */}
      <SlideDrawer
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        title="Direct Candidate Invite"
      >
        <form onSubmit={handleDirectInviteSubmit} className="space-y-4 p-4" autoComplete="off">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Full Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Kiran Kumar"
              value={inviteForm.full_name}
              onChange={(e) => setInviteForm({ ...inviteForm, full_name: e.target.value })}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-[#07518a]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Email Address *
              </label>
              <input
                type="email"
                required
                placeholder="kiran@gmail.com"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-[#07518a]"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                placeholder="9848012345"
                value={inviteForm.phone}
                onChange={(e) => setInviteForm({ ...inviteForm, phone: e.target.value })}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-[#07518a]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Job Designation
              </label>
              <input
                type="text"
                placeholder="e.g. Software Engineer"
                value={inviteForm.job_title}
                onChange={(e) => setInviteForm({ ...inviteForm, job_title: e.target.value })}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-[#07518a]"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Target Joining Date
              </label>
              <input
                type="date"
                value={inviteForm.target_joining_date}
                onChange={(e) => setInviteForm({ ...inviteForm, target_joining_date: e.target.value })}
                autoComplete="off"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-[#07518a]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
              Candidate Joining Type *
            </label>
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setInviteForm({ ...inviteForm, candidate_type: 'EXPERIENCED' })}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  inviteForm.candidate_type === 'EXPERIENCED'
                    ? 'bg-[#07518a] text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>💼</span>
                <span>Experienced</span>
              </button>
              <button
                type="button"
                onClick={() => setInviteForm({ ...inviteForm, candidate_type: 'FRESHER' })}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  inviteForm.candidate_type === 'FRESHER'
                    ? 'bg-[#07518a] text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>🎓</span>
                <span>Fresher</span>
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Sending Email From (SMTP Sender) *
            </label>
            {availableSenders.length > 0 ? (
              <select
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-[#07518a] cursor-pointer"
              >
                {availableSenders.map((s) => (
                  <option key={s.id || s.email} value={s.email}>
                    ✉️ {s.email} {s.name ? `(${s.name})` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <span>✉️</span>
                <span>{senderEmail || 'hr@brihaspathi.com'}</span>
                <span className="ml-auto text-[10px] text-slate-400 font-mono">(System SMTP Email)</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="submit"
              disabled={submittingInvite}
              className="flex-1 py-2.5 bg-[#07518a] hover:bg-[#053d69] text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
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
            <button
              type="button"
              onClick={() => setIsInviteModalOpen(false)}
              className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </SlideDrawer>
    </div>
  );
}
