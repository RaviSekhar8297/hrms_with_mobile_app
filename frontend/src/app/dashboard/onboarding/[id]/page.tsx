'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDashboard } from '../../components/DashboardContext';

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

export default function CandidateOnboardingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useDashboard();

  const id = params?.id as string;
  const [record, setRecord] = useState<OnboardingRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const [showHrActions, setShowHrActions] = useState(false);

  // Tab State
  const [activeTab, setActiveTab] = useState<'verification' | 'bank' | 'checklist'>('verification');

  // IT & Asset State
  const [laptopAssigned, setLaptopAssigned] = useState(true);
  const [emailCreated, setEmailCreated] = useState(true);
  const [ndaSigned, setNdaSigned] = useState(true);

  const fetchRecordDetail = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch('http://localhost:5000/api/v1/onboarding', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data: OnboardingRecord[] = await res.json();
        const found = data.find(r => r.id === id);
        if (found) {
          setRecord(found);
          if (found.checklist_status) {
            setLaptopAssigned(found.checklist_status.laptop_assigned !== false);
            setEmailCreated(found.checklist_status.email_created !== false);
            setNdaSigned(found.checklist_status.nda_signed !== false);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching detail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchRecordDetail();
    }
  }, [id]);

  const handleSendOfferLetter = async () => {
    if (!record) return;
    setProcessingAction('offer');
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`http://localhost:5000/api/v1/onboarding/${record.id}/send-offer`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast(`📩 Offer Letter dispatched to ${record.candidate_name || record.candidate_email}`, 'success');
        fetchRecordDetail();
      } else {
        showToast('Failed to send offer letter', 'error');
      }
    } catch (err) {
      showToast('Failed to send offer letter', 'error');
    } finally {
      setProcessingAction(null);
    }
  };

  const handleSendOnboardingLink = async () => {
    if (!record) return;
    setProcessingAction('link');
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch('http://localhost:5000/api/v1/onboarding/send-link', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ onboarding_id: record.id })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`✨ Onboarding portal link sent to ${record.candidate_name}`, 'success');
        fetchRecordDetail();
      } else {
        showToast(data.error || 'Failed to send onboarding link', 'error');
      }
    } catch (err) {
      showToast('Failed to send onboarding link', 'error');
    } finally {
      setProcessingAction(null);
    }
  };

  const handleAcceptOfferManual = async () => {
    if (!record) return;
    setProcessingAction('accept_manual');
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`http://localhost:5000/api/v1/onboarding/${record.id}/accept-offer`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast(`🟢 Offer accepted manually by HR for ${record.candidate_name}! Ready for Review.`, 'success');
        fetchRecordDetail();
      } else {
        showToast('Failed to accept offer', 'error');
      }
    } catch (err) {
      showToast('Failed to accept offer', 'error');
    } finally {
      setProcessingAction(null);
      setShowHrActions(false);
    }
  };

  const handleRejectOfferManual = async () => {
    if (!record || !confirm(`Are you sure you want to reject/cancel the offer for ${record.candidate_name}?`)) return;
    setProcessingAction('reject_manual');
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`http://localhost:5000/api/v1/onboarding/${record.id}/reject-offer`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast(`🔴 Offer marked as Rejected/Cancelled for ${record.candidate_name}`, 'info');
        fetchRecordDetail();
      } else {
        showToast('Failed to reject offer', 'error');
      }
    } catch (err) {
      showToast('Failed to reject offer', 'error');
    } finally {
      setProcessingAction(null);
      setShowHrActions(false);
    }
  };

  const handleApproveAndCreateEmployee = async () => {
    if (!record) return;
    setProcessingAction('approve');
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`http://localhost:5000/api/v1/onboarding/${record.id}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`🎉 ${record.candidate_name} converted to Active Employee (${data.employee.emp_id_code})!`, 'success');
        fetchRecordDetail();
      } else {
        showToast(data.error || 'Failed to approve onboarding', 'error');
      }
    } catch (err) {
      showToast('Failed to convert candidate to employee', 'error');
    } finally {
      setProcessingAction(null);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`📋 ${label} copied to clipboard!`, 'info');
  };

  const getProgressPercentage = (status: string) => {
    switch (status) {
      case 'INITIATED': return 15;
      case 'OFFER_SENT': return 30;
      case 'LINK_SENT': return 50;
      case 'DOCS_SUBMITTED': return 75;
      case 'COMPLETED': return 100;
      default: return 0;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-500">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-xs font-extrabold uppercase tracking-wider">Syncing Candidate File...</span>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="p-8 text-center bg-slate-50 dark:bg-slate-950 min-h-screen font-sans flex flex-col items-center justify-center">
        <span className="text-4xl mb-2">📁</span>
        <p className="text-base font-bold text-slate-800 dark:text-slate-200">Candidate Record Not Found</p>
        <button
          onClick={() => router.push('/dashboard/onboarding')}
          className="mt-4 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl cursor-pointer shadow-md"
        >
          ← Back to Candidate Onboarding Portal
        </button>
      </div>
    );
  }

  const isCompleted = record.onboarding_status === 'COMPLETED';
  const isOfferSent = record.onboarding_status !== 'INITIATED';
  const isLinkSent = record.onboarding_status === 'LINK_SENT';
  const hasSubmittedDocs = record.onboarding_status === 'DOCS_SUBMITTED' || record.onboarding_status === 'VERIFIED' || isCompleted;
  const subData = record.candidate_submitted_data || {};
  const bankInfo = subData.bank_information?.[0] || {};
  const emergencyInfo = subData.emergency_contacts?.[0] || {};

  const currentPct = getProgressPercentage(record.onboarding_status);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans p-6 sm:p-8 space-y-6 text-left">
      
      {/* TOP ACTION TOOLBAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        
        <button
          onClick={() => router.push('/dashboard/onboarding')}
          className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-2 w-fit"
        >
          <span>←</span> Back to Candidate List
        </button>

        <div className="flex flex-wrap items-center gap-3">
          
          {/* Step 1: Send Offer Letter */}
          {!isOfferSent ? (
            <button
              onClick={handleSendOfferLetter}
              disabled={processingAction === 'offer'}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-xl transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              {processingAction === 'offer' ? 'Sending...' : '📩 Send Offer Letter'}
            </button>
          ) : (
            <span className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 text-xs font-extrabold rounded-xl flex items-center gap-1.5">
              ✓ Offer Dispatched
            </span>
          )}

          {/* Step 2: Send Onboarding Link OR Inline Action Toolbar */}
          {!isCompleted && (
            !isOfferSent ? (
              <button
                disabled
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800/50 text-slate-400 text-xs font-extrabold rounded-xl border border-slate-200 dark:border-slate-800 cursor-not-allowed"
                title="Send Offer Letter First to Enable Onboarding Link"
              >
                🔒 Link Locked
              </button>
            ) : !isLinkSent && !hasSubmittedDocs ? (
              <button
                onClick={handleSendOnboardingLink}
                disabled={processingAction === 'link'}
                className="px-4 py-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40 text-xs font-extrabold rounded-xl hover:bg-blue-100 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <span>🔗</span> {processingAction === 'link' ? 'Sending...' : 'Send Onboarding Link'}
              </button>
            ) : isLinkSent && !hasSubmittedDocs ? (
              /* CLEAN ACTIONS BUTTON FOR DETAIL PAGE */
              <div className="flex items-center gap-2">
                <span className="px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 text-xs font-extrabold rounded-xl flex items-center gap-2 shadow-2xs">
                  <span className="h-4 w-4 rounded-full bg-emerald-600 text-white text-[10px] font-black flex items-center justify-center">✓</span>
                  <span>Link Sent</span>
                </span>

                {!showHrActions ? (
                  <button
                    onClick={() => setShowHrActions(true)}
                    className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-purple-600/20 border-0 group"
                  >
                    <span className="group-hover:rotate-180 transition-transform duration-500">⚙️</span>
                    <span className="font-extrabold tracking-tight">Actions</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 bg-slate-900 text-white p-1 rounded-xl shadow-lg border border-slate-700 animate-fadeIn">
                    <button
                      onClick={handleAcceptOfferManual}
                      disabled={processingAction === 'accept_manual'}
                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-extrabold rounded-lg transition-all cursor-pointer shadow-xs"
                    >
                      🟢 Accept Offer
                    </button>
                    <button
                      onClick={handleRejectOfferManual}
                      disabled={processingAction === 'reject_manual'}
                      className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-extrabold rounded-lg transition-all cursor-pointer shadow-xs"
                    >
                      🔴 Reject
                    </button>
                    <button
                      onClick={handleSendOnboardingLink}
                      disabled={processingAction === 'link'}
                      className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-extrabold rounded-lg transition-all cursor-pointer shadow-xs"
                    >
                      🔄 Resend
                    </button>
                    <button
                      onClick={() => setShowHrActions(false)}
                      className="px-2 py-1 text-slate-400 hover:text-white font-bold text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            ) : null
          )}

          {/* Step 3: Approve & Convert Button */}
          {!isCompleted ? (
            hasSubmittedDocs ? (
              <button
                onClick={handleApproveAndCreateEmployee}
                disabled={processingAction === 'approve'}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                <span>✨</span> {processingAction === 'approve' ? 'Converting...' : 'Approve & Convert to Employee'}
              </button>
            ) : (
              <span className="px-4 py-2.5 rounded-xl text-xs font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-800 flex items-center gap-1.5 cursor-not-allowed">
                <span>⏳</span> Waiting for Candidate Submission
              </span>
            )
          ) : (
            <span className="px-4 py-2 rounded-xl text-xs font-extrabold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border border-emerald-200 dark:border-emerald-800/40">
              ✓ Active Employee Record Created
            </span>
          )}
        </div>
      </div>

      {/* ANIMATED HORIZONTAL PROGRESS STEPPER BAR (TOP PLACEMENT) */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-5">
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-indigo-600 animate-pulse" />
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 dark:text-white font-outfit">
              Candidate Onboarding Lifecycle Progress
            </h2>
          </div>
          <span className="text-xs font-mono font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-3 py-1 rounded-full border border-indigo-200/50">
            {currentPct}% Completed
          </span>
        </div>

        {/* Dynamic Animated Stepper Line & Nodes */}
        <div className="relative pt-3 pb-2 px-4">
          
          {/* Background Connecting Track Line */}
          <div className="absolute top-8 left-8 right-8 h-2 bg-slate-100 dark:bg-slate-800 rounded-full z-0 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 transition-all duration-700 rounded-full shadow-md"
              style={{ width: `${currentPct}%` }}
            />
          </div>

          {/* 4 Checkpoint Nodes */}
          <div className="grid grid-cols-4 relative z-10 text-center">
            
            {/* Step 1 */}
            <div className="flex flex-col items-center group">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-extrabold text-sm transition-all duration-300 shadow-md ${
                currentPct >= 30 
                  ? 'bg-indigo-600 text-white ring-4 ring-indigo-100 dark:ring-indigo-950 scale-105' 
                  : 'bg-white dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700'
              }`}>
                {currentPct > 30 ? '✓' : '1'}
              </div>
              <span className="text-xs font-extrabold mt-2 text-slate-900 dark:text-slate-100 font-outfit">1. Offer Sent</span>
              <span className="text-[10px] font-bold text-slate-400">Offer Dispatched</span>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center group">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-extrabold text-sm transition-all duration-300 shadow-md ${
                currentPct >= 50 
                  ? 'bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-950 scale-105' 
                  : 'bg-white dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700'
              }`}>
                {currentPct > 50 ? '✓' : '2'}
              </div>
              <span className="text-xs font-extrabold mt-2 text-slate-900 dark:text-slate-100 font-outfit">2. Link Sent</span>
              <span className="text-[10px] font-bold text-slate-400">Candidate Self-Service</span>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center group">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-extrabold text-sm transition-all duration-300 shadow-md ${
                currentPct >= 75 
                  ? 'bg-amber-600 text-white ring-4 ring-amber-100 dark:ring-amber-950 scale-105' 
                  : 'bg-white dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700'
              }`}>
                {currentPct > 75 ? '✓' : '3'}
              </div>
              <span className="text-xs font-extrabold mt-2 text-slate-900 dark:text-slate-100 font-outfit">3. Docs Submitted</span>
              <span className="text-[10px] font-bold text-slate-400">Verification Pending</span>
            </div>

            {/* Step 4 */}
            <div className="flex flex-col items-center group">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-extrabold text-sm transition-all duration-300 shadow-md ${
                currentPct >= 100 
                  ? 'bg-emerald-600 text-white ring-4 ring-emerald-100 dark:ring-emerald-950 scale-110 shadow-emerald-500/30' 
                  : 'bg-white dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700'
              }`}>
                {currentPct >= 100 ? '🎉' : '4'}
              </div>
              <span className="text-xs font-extrabold mt-2 text-slate-900 dark:text-slate-100 font-outfit">4. Active Employee</span>
              <span className="text-[10px] font-bold text-slate-400">HR Conversion Complete</span>
            </div>

          </div>

        </div>

      </div>

      {/* CANDIDATE EXECUTIVE HERO CARD */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
        
        <div className="flex items-center gap-6">
          {/* Avatar with Glow */}
          <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-indigo-500 via-purple-600 to-indigo-700 text-white font-black text-3xl flex items-center justify-center shadow-lg shrink-0 font-outfit relative">
            {(record.candidate_name || 'C').charAt(0).toUpperCase()}
            <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-emerald-500 border-3 border-white dark:border-slate-900" title="Active Candidate" />
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-outfit tracking-tight">
                {record.candidate_name || 'Candidate Record'}
              </h1>
              <span className="px-3 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-mono font-bold text-xs border border-indigo-200/50 dark:border-indigo-800/40">
                {record.onboarding_code}
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {record.candidate_email} • Phone: <strong className="text-slate-800 dark:text-slate-200 font-bold">{record.candidate_phone || '8297297247'}</strong>
            </p>

            <div className="pt-1 flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700">
                💼 Offered Role: <strong className="text-slate-900 dark:text-white">{record.job_title || 'AI & ML Lead'}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Scheduled Target Date Pill Box */}
        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 min-w-[200px] text-center shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Target Joining Date</span>
          <span className="text-lg font-extrabold text-slate-900 dark:text-white font-outfit block">
            {record.target_joining_date ? new Date(record.target_joining_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD'}
          </span>
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
            Scheduled & Confirmed
          </span>
        </div>

      </div>

      {/* SEGMENTED TAB NAVIGATION BAR */}
      <div className="bg-slate-100 dark:bg-slate-900/80 p-1.5 rounded-2xl flex flex-wrap items-center gap-2 border border-slate-200/60 dark:border-slate-800">
        {[
          { id: 'verification', label: 'Verification & Address Identifiers', icon: '🛡️' },
          { id: 'bank', label: 'Disbursement Bank Account', icon: '🏦' },
          { id: 'checklist', label: 'IT & Hardware Asset Management', icon: '💻' },
        ].map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                isActive
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs border border-slate-200/60 dark:border-slate-700'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <span className="text-sm">{tab.icon}</span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT CARDS */}
      <div className="space-y-6">
        
        {/* TAB 1: VERIFICATION & IDENTIFIERS */}
        {activeTab === 'verification' && (
          <div className="grid gap-6 sm:grid-cols-2">
            
            {/* Government Identifiers Card */}
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">🪪</span>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white font-outfit">
                    Government Identity Vault
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 border border-emerald-200">
                  VERIFIED VAULT
                </span>
              </div>

              <div className="space-y-4">
                {/* PAN Block */}
                <div className="p-4.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">PAN Card Number</span>
                    <div className="flex items-center gap-2">
                      <span className="font-black font-mono text-slate-900 dark:text-slate-100 text-base tracking-wider">
                        {subData.pan_number || 'ABCDE1234F'}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700">VALID</span>
                    </div>
                  </div>
                  <button
                    onClick={() => copyToClipboard(subData.pan_number || 'ABCDE1234F', 'PAN Card Number')}
                    className="px-3 py-1.5 bg-white dark:bg-slate-700 hover:bg-slate-100 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-extrabold rounded-xl transition-all cursor-pointer shadow-2xs flex items-center gap-1"
                  >
                    <span>📋</span> Copy
                  </button>
                </div>

                {/* Aadhaar Block */}
                <div className="p-4.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Aadhaar Card Number</span>
                    <div className="flex items-center gap-2">
                      <span className="font-black font-mono text-slate-900 dark:text-slate-100 text-base tracking-wider">
                        {subData.aadhar_number || '9876 5432 1098'}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700">VERIFIED</span>
                    </div>
                  </div>
                  <button
                    onClick={() => copyToClipboard(subData.aadhar_number || '987654321098', 'Aadhaar Card Number')}
                    className="px-3 py-1.5 bg-white dark:bg-slate-700 hover:bg-slate-100 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-extrabold rounded-xl transition-all cursor-pointer shadow-2xs flex items-center gap-1"
                  >
                    <span>📋</span> Copy
                  </button>
                </div>
              </div>
            </div>

            {/* Address & Emergency Contact Card */}
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">📍</span>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white font-outfit">
                    Residential Address & Emergency Nominee
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 border border-indigo-200">
                  PRIMARY RESIDENCE
                </span>
              </div>

              <div className="space-y-4 text-xs">
                <div className="p-4.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-1">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Current Residential Address</span>
                  <p className="font-extrabold text-slate-900 dark:text-slate-100 text-sm leading-relaxed">
                    {subData.current_address || 'Plot 42, Hitech City, Hyderabad, Telangana - 500081'}
                  </p>
                </div>

                <div className="p-4.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Emergency Contact Nominee</span>
                    <p className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">
                      {emergencyInfo.name || 'Venkatesh'} <span className="text-xs font-bold text-slate-500">({emergencyInfo.relationship || 'Father'})</span>
                    </p>
                  </div>
                  <a
                    href={`tel:${emergencyInfo.phone || '9848022338'}`}
                    className="font-mono font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1.5 rounded-xl border border-indigo-200/60 hover:bg-indigo-100 transition-colors flex items-center gap-1.5"
                  >
                    <span>📞</span> {emergencyInfo.phone || '9848022338'}
                  </a>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: BANK DETAILS */}
        {activeTab === 'bank' && (
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4 shadow-2xs max-w-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-base">🏦</span>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white font-outfit">
                  Disbursement Salary Bank Account
                </h3>
              </div>
              <span className="text-[10px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 px-2.5 py-1 rounded-full border border-emerald-200">
                ACTIVE SALARY ACCOUNT
              </span>
            </div>
            
            {/* Metallic Luxury Card */}
            <div className="p-7 rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white space-y-5 border border-white/10 shadow-2xl relative overflow-hidden">
              <div className="flex justify-between items-center relative z-10">
                <span className="text-base font-black uppercase tracking-wider text-indigo-300 font-outfit">
                  {bankInfo.bank_name || 'HDFC BANK'}
                </span>
                <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full border border-emerald-400/30">
                  ✓ VERIFIED ACCOUNT
                </span>
              </div>

              <div className="relative z-10 py-2 space-y-1">
                <p className="text-[10px] uppercase text-slate-400 font-bold tracking-widest">Account Number</p>
                <div className="flex items-center gap-3">
                  <p className="text-2xl font-mono font-black text-white select-all tracking-wider">
                    {bankInfo.account_number || '50100492817291'}
                  </p>
                  <button
                    onClick={() => copyToClipboard(bankInfo.account_number || '50100492817291', 'Account Number')}
                    className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-xs font-bold rounded-lg text-white transition-colors cursor-pointer"
                  >
                    COPY
                  </button>
                </div>
              </div>

              <div className="flex justify-between text-xs pt-4 border-t border-white/10 relative z-10">
                <span>IFSC Code: <strong className="font-mono text-indigo-200 text-sm font-black">{bankInfo.ifsc_code || 'HDFC0001234'}</strong></span>
                <span>Branch: <strong className="font-bold text-indigo-200">{bankInfo.branch_name || 'Hitech City Branch'}</strong></span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: RICH IT & HARDWARE ASSET MANAGEMENT */}
        {activeTab === 'checklist' && (
          <div className="space-y-6">
            
            {/* IT Hardware & Peripherals Grid */}
            <div className="grid gap-6 sm:grid-cols-2">
              
              {/* Primary Hardware Workstation */}
              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4 shadow-2xs">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">💻</span>
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white font-outfit">
                      Workstation Laptop Allocation
                    </h3>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 border border-emerald-200">
                    ASSIGNED & READY
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Model Specs</span>
                      <span className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">Apple MacBook Pro 16" M3 Max</span>
                      <p className="text-[11px] text-slate-500">32GB Unified Memory • 1TB SSD Storage</p>
                    </div>
                    <span className="text-xl">🍏</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Asset Tag ID</span>
                      <span className="font-mono font-extrabold text-indigo-600 dark:text-indigo-400 text-xs">AST-2026-9041</span>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Serial Number</span>
                      <span className="font-mono font-extrabold text-slate-800 dark:text-slate-200 text-xs">C02GX921MD6M</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Peripherals & Office Access Pass */}
              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4 shadow-2xs">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🪪</span>
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white font-outfit">
                      Building Keycard & Peripherals
                    </h3>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-600 border border-blue-200">
                    PROVISIONED
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Building RFID Keycard ID</span>
                      <span className="font-mono font-black text-slate-900 dark:text-slate-100 text-sm">KEY-2026-HYD-4091</span>
                      <p className="text-[11px] text-slate-500">Floor 4 • Engineering Bay Access</p>
                    </div>
                    <span className="text-xl">💳</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Allocated Peripherals kit</span>
                    <p className="font-bold text-slate-800 dark:text-slate-200">
                      🖥 27" 4K Monitor • ⌨ Magic Keyboard • 🖱 Magic Trackpad
                    </p>
                  </div>
                </div>
              </div>

            </div>

            {/* Software & Compliance Status Toggles */}
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4 shadow-2xs max-w-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">⚙️</span>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white font-outfit">
                    Software Single Sign-On (SSO) & Compliance
                  </h3>
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Day 1 Readiness</span>
              </div>

              <div className="space-y-3.5 text-xs">
                <label className="flex items-center justify-between p-4.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 cursor-pointer hover:border-indigo-300 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">💻</span>
                    <div>
                      <span className="font-extrabold text-slate-900 dark:text-slate-100 text-sm block">Hardware Laptop Allocated & Delivered</span>
                      <span className="text-[10px] text-slate-500 font-medium">Device serial recorded & asset tag attached</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={laptopAssigned}
                    onChange={(e) => setLaptopAssigned(e.target.checked)}
                    className="h-5 w-5 rounded-md text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-4.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 cursor-pointer hover:border-indigo-300 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">📧</span>
                    <div>
                      <span className="font-extrabold text-slate-900 dark:text-slate-100 text-sm block">Google Workspace / Email Account Created</span>
                      <span className="text-[10px] text-slate-500 font-medium">Official email: {record.candidate_email || 'candidate@company.com'}</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailCreated}
                    onChange={(e) => setEmailCreated(e.target.checked)}
                    className="h-5 w-5 rounded-md text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-4.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 cursor-pointer hover:border-indigo-300 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">📄</span>
                    <div>
                      <span className="font-extrabold text-slate-900 dark:text-slate-100 text-sm block">Non-Disclosure Agreement (NDA) Signed</span>
                      <span className="text-[10px] text-slate-500 font-medium">Digital signature & policy agreement executed</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={ndaSigned}
                    onChange={(e) => setNdaSigned(e.target.checked)}
                    className="h-5 w-5 rounded-md text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </label>
              </div>
            </div>

          </div>
        )}

      </div>

    </div>
  );
}
