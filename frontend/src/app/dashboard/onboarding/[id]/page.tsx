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
  onboarding_status: 'INITIATED' | 'PENDING_OFFER' | 'OFFER_SENT' | 'OFFER_ACCEPTED' | 'OFFER_REJECTED' | 'LINK_SENT' | 'DOCS_SUBMITTED' | 'VERIFIED' | 'COMPLETED' | 'CANCELLED';
  target_joining_date: string;
  actual_joining_date?: string;
  candidate_submitted_data?: any;
  document_verification_status?: any;
  checklist_status?: any;
  created_at: string;
  updated_at?: string;
  link_sent_at?: string;
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

  // Re-Upload Request State
  const [isReuploadModalOpen, setIsReuploadModalOpen] = useState(false);
  const [reuploadNotes, setReuploadNotes] = useState('');
  const [submittingReupload, setSubmittingReupload] = useState(false);
  const [activeTab, setActiveTab] = useState<'verification' | 'documents' | 'bank' | 'checklist'>('verification');
  const [previewDoc, setPreviewDoc] = useState<{ title: string; file: { name: string; data: string } } | null>(null);

  // SMTP Sender Email State
  const [availableSenders, setAvailableSenders] = useState<any[]>([]);
  const [senderEmail, setSenderEmail] = useState<string>('');

  // Off-Canvas Offer Drawer State
  const [showOfferDrawer, setShowOfferDrawer] = useState(false);
  const [customDesignation, setCustomDesignation] = useState('');
  const [customJoiningDate, setCustomJoiningDate] = useState('');
  const [customWorkLocation, setCustomWorkLocation] = useState('');
  const [customMessage, setCustomMessage] = useState('');

  const fetchSmtpInfo = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch('/api/v1/onboarding/smtp-info', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const sendersList = Array.isArray(data) 
          ? data 
          : (data.senders || data.available_senders || []);

        if (sendersList.length > 0) {
          setAvailableSenders(sendersList);
          setSenderEmail(data.selected_email || data.sender_email || sendersList[0].email || sendersList[0].from_email || '');
        } else {
          setAvailableSenders([]);
          setSenderEmail('');
        }
      }
    } catch (err) {
      console.error('Error fetching SMTP senders:', err);
    }
  };

  const handleDownloadFile = (fileName: string, dataUrl: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName || 'document';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // IT & Asset State
  const [laptopAssigned, setLaptopAssigned] = useState(true);
  const [emailCreated, setEmailCreated] = useState(true);
  const [ndaSigned, setNdaSigned] = useState(true);

  const fetchRecordDetail = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch('/api/v1/onboarding', {
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
      fetchSmtpInfo();
    }
  }, [id]);

  const handleResetStatus = async (targetStatus = 'PENDING_OFFER') => {
    if (!record) return;
    setProcessingAction('reset');
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`/api/v1/onboarding/${record.id}/reset-status`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ target_status: targetStatus })
      });
      if (res.ok) {
        showToast('↩️ Stepped back status to Step 1 (Pending Offer)', 'info');
        fetchRecordDetail();
      }
    } catch (err) {
      console.error('Reset status error:', err);
    } finally {
      setProcessingAction(null);
    }
  };

  const openOfferDrawer = () => {
    if (!record) return;
    setCustomDesignation(record.job_title || '');
    setCustomJoiningDate(record.target_joining_date ? record.target_joining_date.split('T')[0] : '');
    setCustomWorkLocation('Corporate Office, Hyderabad');
    setCustomMessage('Your compensation and other employment benefits will be as discussed and agreed upon during the selection process. The detailed terms and conditions of your employment will be provided as part of your appointment and joining formalities.');
    setShowOfferDrawer(true);
  };

  const handleSendOfferLetter = async () => {
    if (!record) return;
    setProcessingAction('offer');
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`/api/v1/onboarding/${record.id}/send-offer`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          sender_email: senderEmail,
          custom_designation: customDesignation,
          custom_joining_date: customJoiningDate,
          custom_work_location: customWorkLocation,
          custom_message: customMessage
        })
      });
      const data = await res.json();

      if (res.ok) {
        if (data.email_sent === false) {
          showToast(`⚠️ Offer set, but Email failed: ${data.email_error || 'Check SMTP credentials'}`, 'error');
        } else {
          showToast(`📩 Offer Letter sent to ${record.candidate_name || record.candidate_email}`, 'success');
        }
        setShowOfferDrawer(false);
        fetchRecordDetail();
      } else {
        showToast(data.error || 'Failed to send offer letter', 'error');
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
      const res = await fetch('/api/v1/onboarding/send-link', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ onboarding_id: record.id, sender_email: senderEmail })
      });
      const data = await res.json();

      if (res.ok) {
        if (data.email_sent === false) {
          showToast(`⚠️ Link set, but Email failed: ${data.email_error || 'Check SMTP credentials'}`, 'error');
        } else {
          showToast(`✨ Onboarding portal link sent to ${record.candidate_name}`, 'success');
        }
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
      const res = await fetch(`/api/v1/onboarding/${record.id}/accept-offer`, {
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
      const res = await fetch(`/api/v1/onboarding/${record.id}/reject-offer`, {
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

  const handleVerifyDocs = async () => {
    if (!record) return;
    setProcessingAction('verify_docs');
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`/api/v1/onboarding/${record.id}/verify-docs`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast(`🛡️ Compliance documents verified & approved for ${record.candidate_name}!`, 'success');
        fetchRecordDetail();
      } else {
        showToast('Failed to verify documents', 'error');
      }
    } catch (err) {
      showToast('Failed to verify documents', 'error');
    } finally {
      setProcessingAction(null);
    }
  };

  const handleRequestReuploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!record) return;
    setSubmittingReupload(true);
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`/api/v1/onboarding/${record.id}/request-reupload`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ notes: reuploadNotes })
      });
      if (res.ok) {
        showToast(`⚠️ Re-upload request recorded and portal magic link reset for ${record.candidate_name}`, 'info');
        setIsReuploadModalOpen(false);
        setReuploadNotes('');
        fetchRecordDetail();
      } else {
        showToast('Failed to request re-upload', 'error');
      }
    } catch (err) {
      showToast('Failed to request re-upload', 'error');
    } finally {
      setSubmittingReupload(false);
    }
  };

  const handleApproveAndCreateEmployee = async () => {
    if (!record) return;
    setProcessingAction('approve');
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`/api/v1/onboarding/${record.id}/approve`, {
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

  const formatStepDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' • ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return null;
    }
  };

  const getProgressPercentage = (status: string) => {
    switch (status) {
      case 'PENDING_OFFER': return 0;
      case 'INITIATED': return 0;
      case 'OFFER_SENT': return 30;
      case 'LINK_SENT': return 50;
      case 'DOCS_SUBMITTED': return 75;
      case 'VERIFIED': return 90;
      case 'COMPLETED': return 100;
      default: return 0;
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center space-y-3">
        <div className="w-8 h-8 border-4 border-[#07518a] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Loading Candidate Profile...</p>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="p-8 text-center bg-slate-50 dark:bg-slate-950 min-h-[400px] font-sans flex flex-col items-center justify-center">
        <span className="text-4xl mb-2">📁</span>
        <p className="text-base font-bold text-slate-800 dark:text-slate-200">Candidate Record Not Found</p>
        <button
          onClick={() => router.push('/dashboard/onboarding')}
          className="mt-4 px-5 py-2.5 bg-[#07518a] hover:bg-[#064270] text-white font-bold text-xs rounded-xl cursor-pointer shadow-md"
        >
          ← Back to Candidate Onboarding Portal
        </button>
      </div>
    );
  }

  const isCompleted = record.onboarding_status === 'COMPLETED';
  const isOfferSent = record.onboarding_status !== 'INITIATED' && record.onboarding_status !== 'PENDING_OFFER';
  const isLinkSent = record.onboarding_status === 'LINK_SENT' || record.onboarding_status === 'DOCS_SUBMITTED' || record.onboarding_status === 'VERIFIED' || isCompleted;
  const hasSubmittedDocs = record.onboarding_status === 'DOCS_SUBMITTED' || record.onboarding_status === 'VERIFIED' || isCompleted;
  const isDocsApproved = record.onboarding_status === 'VERIFIED' || isCompleted;
  const subData = record.candidate_submitted_data || {};
  const bankInfo = subData.bank_information?.[0] || {};
  const emergencyInfo = subData.emergency_contacts?.[0] || {};

  const docsObj = subData.documents || {};
  const submittedDocList: { key: string; label: string; file: { name: string; data: string }; icon: string; category: string }[] = [
    { key: 'pan_card', label: 'PAN Card Proof', file: docsObj.pan_card, icon: '🪪', category: 'Government Identity' },
    { key: 'aadhar_card', label: 'Aadhaar Card Proof', file: docsObj.aadhar_card, icon: '🆔', category: 'Government Identity' },
    { key: 'education_certificate', label: 'Education Degree Certificate', file: docsObj.education_certificate, icon: '🎓', category: 'Education' },
    { key: 'bank_passbook', label: 'Bank Passbook / Cheque', file: docsObj.bank_passbook, icon: '🏦', category: 'Financial' },
    { key: 'passport_photo', label: 'Passport Photograph', file: docsObj.passport_photo, icon: '📷', category: 'Identity Photo' },
    { key: 'payslip_month_1', label: 'Payslip (Month 1)', file: docsObj.payslip_month_1, icon: '💵', category: 'Salary Slip' },
    { key: 'payslip_month_2', label: 'Payslip (Month 2)', file: docsObj.payslip_month_2, icon: '💵', category: 'Salary Slip' },
    { key: 'payslip_month_3', label: 'Payslip (Month 3)', file: docsObj.payslip_month_3, icon: '💵', category: 'Salary Slip' },
  ].filter((item): item is { key: string; label: string; file: { name: string; data: string }; icon: string; category: string } => !!(item.file && item.file.data));

  const currentPct = getProgressPercentage(record.onboarding_status);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans space-y-6 text-left">
      
      {/* TOP ACTION TOOLBAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        
        <button
          onClick={() => router.push('/dashboard/onboarding')}
          className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-2 w-fit shadow-xs"
        >
          <span>←</span> Back to Candidate List
        </button>

        <div className="flex flex-wrap items-center gap-3">
          
          {/* Step 1: Send Offer Letter */}
          {!isOfferSent ? (
            <button
              onClick={openOfferDrawer}
              disabled={processingAction === 'offer'}
              className="px-4 py-2 bg-[#07518a] hover:bg-[#064270] text-white text-xs font-extrabold rounded-xl transition-all cursor-pointer shadow-md shadow-[#07518a]/20 disabled:opacity-50 flex items-center gap-2"
            >
              {processingAction === 'offer' ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Sending Offer...</span>
                </>
              ) : (
                <>
                  <span>📩</span> Send Offer Letter
                </>
              )}
            </button>
          ) : (
            <span className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 text-xs font-extrabold rounded-xl flex items-center gap-1.5">
              ✓ Offer Letter Sent
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
                className="px-4 py-2 bg-[#07518a]/10 dark:bg-[#07518a]/20 text-[#07518a] dark:text-[#38bdf8] border border-[#07518a]/30 text-xs font-extrabold rounded-xl hover:bg-[#07518a]/20 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {processingAction === 'link' ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-[#07518a]/30 border-t-[#07518a] dark:border-[#38bdf8]/30 dark:border-t-[#38bdf8] rounded-full animate-spin" />
                    <span>Sending Link...</span>
                  </>
                ) : (
                  <>
                    <span>🔗</span> Send Onboarding Link
                  </>
                )}
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
                    className="px-3.5 py-2 bg-[#07518a] hover:bg-[#064270] text-white text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-[#07518a]/20 border-0 group"
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
                      className="px-3 py-1.5 bg-[#07518a] hover:bg-[#064270] text-white text-xs font-extrabold rounded-lg transition-all cursor-pointer shadow-xs"
                    >
                      🔄 Resend Link
                    </button>
                    <button
                      onClick={() => handleResetStatus('PENDING_OFFER')}
                      disabled={processingAction === 'reset'}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-extrabold rounded-lg transition-all cursor-pointer shadow-xs"
                      title="Reset status back to Step 1 (Pending Offer)"
                    >
                      ↩️ Reset Step 1
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

          {/* Step 3 & Step 4: Document Verification and Employee Conversion Actions */}
          {!isCompleted ? (
            record.onboarding_status === 'DOCS_SUBMITTED' ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleVerifyDocs}
                  disabled={processingAction === 'verify_docs'}
                  className="px-5 py-2.5 bg-[#07518a] hover:bg-[#064270] text-white font-extrabold text-xs rounded-xl transition-all shadow-md shadow-[#07518a]/20 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <span>🛡️</span> {processingAction === 'verify_docs' ? 'Verifying...' : 'Verify & Approve Documents'}
                </button>
                <button
                  onClick={() => setIsReuploadModalOpen(true)}
                  className="px-4 py-2.5 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 text-amber-700 dark:text-amber-300 font-extrabold text-xs rounded-xl border border-amber-300 dark:border-amber-800 transition-all cursor-pointer shadow-2xs flex items-center gap-1.5"
                >
                  <span>⚠️</span> Request Re-Upload
                </button>
              </div>
            ) : record.onboarding_status === 'VERIFIED' ? (
              <div className="flex items-center gap-3">
                <span className="px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 text-xs font-extrabold rounded-xl flex items-center gap-2 shadow-2xs">
                  <span>✓ Compliance Docs Verified</span>
                </span>
                <button
                  onClick={handleApproveAndCreateEmployee}
                  disabled={processingAction === 'approve'}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  <span>✨</span> {processingAction === 'approve' ? 'Converting...' : 'Approve & Convert to Employee'}
                </button>
              </div>
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
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#07518a] animate-pulse" />
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 dark:text-white font-outfit">
              Candidate Onboarding Lifecycle Progress
            </h2>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Sender Email Selection Dropdown */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700 shadow-2xs">
              <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Sending Email From:</span>
              {availableSenders.length > 0 ? (
                <select
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  className="bg-transparent text-xs font-black text-[#07518a] dark:text-[#38bdf8] outline-none cursor-pointer pr-1"
                >
                  {availableSenders.map((s, idx) => (
                    <option key={s.id || s.email || idx} value={s.email || s.from_email} className="text-slate-900 bg-white dark:bg-slate-900 font-bold">
                      ✉️ {s.email || s.from_email} {s.name ? `(${s.name})` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-xs font-mono font-bold text-rose-500 dark:text-rose-400 flex items-center gap-1">
                  ⚠️ No Email Configured
                </span>
              )}
            </div>

            <span className="text-xs font-mono font-extrabold text-[#07518a] dark:text-[#38bdf8] bg-[#07518a]/10 dark:bg-[#07518a]/20 px-3 py-1 rounded-full border border-[#07518a]/20">
              {currentPct}% Completed
            </span>
          </div>
        </div>

        {/* Dynamic Animated Stepper Line & Nodes */}
        <div className="relative pt-3 pb-2 px-4">
          
          {/* Background Connecting Track Line */}
          <div className="absolute top-8 left-8 right-8 h-2 bg-slate-100 dark:bg-slate-800 rounded-full z-0 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#07518a] via-blue-500 to-emerald-500 transition-all duration-700 rounded-full shadow-md"
              style={{ width: `${currentPct}%` }}
            />
          </div>

          {/* 4 Checkpoint Nodes */}
          <div className="grid grid-cols-4 relative z-10 text-center">
            
            {/* Step 1 */}
            <div className="flex flex-col items-center group">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-extrabold text-sm transition-all duration-300 shadow-md ${
                isOfferSent 
                  ? 'bg-[#07518a] text-white ring-4 ring-[#07518a]/20 scale-105' 
                  : 'bg-white dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700'
              }`}>
                {isOfferSent ? '✓' : '1'}
              </div>
              <span className="text-xs font-extrabold mt-2 text-slate-900 dark:text-slate-100 font-outfit">1. Offer Sent</span>
              {isOfferSent ? (
                <>
                  <span className="text-[10px] font-bold text-slate-400">Offer Letter Sent</span>
                  {record.onboarding_status === 'OFFER_ACCEPTED' || record.onboarding_status === 'LINK_SENT' || record.onboarding_status === 'DOCS_SUBMITTED' || record.onboarding_status === 'VERIFIED' || record.onboarding_status === 'COMPLETED' ? (
                    <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full mt-1 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1 shadow-2xs">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                      🟢 Offer Accepted
                    </span>
                  ) : record.onboarding_status === 'OFFER_REJECTED' ? (
                    <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-full mt-1 border border-rose-200 dark:border-rose-800/60">
                      🔴 Offer Declined
                    </span>
                  ) : (
                    <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full mt-1 border border-amber-200 dark:border-amber-800/60">
                      ⏳ Acceptance Pending
                    </span>
                  )}
                  <span className="text-[9px] font-mono font-extrabold text-[#07518a] dark:text-[#38bdf8] bg-[#07518a]/10 dark:bg-[#07518a]/20 px-2 py-0.5 rounded-md mt-1 border border-[#07518a]/20">
                    {formatStepDate(record.created_at)}
                  </span>
                </>
              ) : (
                <button
                  onClick={openOfferDrawer}
                  disabled={processingAction === 'offer'}
                  className="mt-1.5 px-3 py-1 bg-[#07518a] hover:bg-[#064270] text-white text-[10px] font-black rounded-lg transition-all cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {processingAction === 'offer' ? (
                    <>
                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <span>📩</span> Send Offer Letter
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center group">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-extrabold text-sm transition-all duration-300 shadow-md ${
                isLinkSent 
                  ? 'bg-[#07518a] text-white ring-4 ring-[#07518a]/20 scale-105' 
                  : 'bg-white dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700'
              }`}>
                {isLinkSent ? '✓' : '2'}
              </div>
              <span className="text-xs font-extrabold mt-2 text-slate-900 dark:text-slate-100 font-outfit">2. Portal Link</span>
              {isLinkSent ? (
                <>
                  <span className="text-[10px] font-bold text-slate-400">Magic Link Sent</span>
                  <span className="text-[9px] font-mono font-extrabold text-[#07518a] dark:text-[#38bdf8] bg-[#07518a]/10 dark:bg-[#07518a]/20 px-2 py-0.5 rounded-md mt-1 border border-[#07518a]/20">
                    {formatStepDate(record.link_sent_at || record.updated_at)}
                  </span>
                </>
              ) : !isOfferSent ? (
                <span className="text-[10px] font-bold text-slate-400 mt-1">🔒 Locked (Offer 1st)</span>
              ) : (
                <button
                  onClick={handleSendOnboardingLink}
                  disabled={processingAction === 'link'}
                  className="mt-1.5 px-3 py-1 bg-[#07518a] hover:bg-[#064270] text-white text-[10px] font-black rounded-lg transition-all cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1"
                >
                  {processingAction === 'link' ? (
                    <>
                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <span>🔗</span> Send Portal Link
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center group">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-extrabold text-sm transition-all duration-300 shadow-md ${
                isDocsApproved 
                  ? 'bg-emerald-600 text-white ring-4 ring-emerald-100 dark:ring-emerald-950 scale-105 shadow-emerald-500/30' 
                  : hasSubmittedDocs 
                  ? 'bg-amber-500 text-white ring-4 ring-amber-100 dark:ring-amber-950 scale-105' 
                  : 'bg-white dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700'
              }`}>
                {isDocsApproved ? '✓' : '3'}
              </div>
              <span className="text-xs font-extrabold mt-2 text-slate-900 dark:text-slate-100 font-outfit">
                {isDocsApproved ? '3. Docs Verified' : '3. Docs Submitted'}
              </span>
              {hasSubmittedDocs ? (
                <>
                  <span className="text-[10px] font-bold text-slate-400">
                    {isDocsApproved ? 'Verification Approved' : 'Submitted & Pending Approval'}
                  </span>
                  <span className="text-[9px] font-mono font-extrabold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md mt-1 border border-amber-100/50">
                    {formatStepDate(record.candidate_submitted_data?.submitted_at || record.updated_at)}
                  </span>
                </>
              ) : (
                <span className="text-[10px] font-bold text-slate-400 mt-1">⏳ Waiting Submission</span>
              )}
            </div>

            {/* Step 4 */}
            <div className="flex flex-col items-center group">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-extrabold text-sm transition-all duration-300 shadow-md ${
                isCompleted 
                  ? 'bg-emerald-600 text-white ring-4 ring-emerald-100 dark:ring-emerald-950 scale-110 shadow-emerald-500/30' 
                  : 'bg-white dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700'
              }`}>
                {isCompleted ? '🎉' : '4'}
              </div>
              <span className="text-xs font-extrabold mt-2 text-slate-900 dark:text-slate-100 font-outfit">4. Active Employee</span>
              {isCompleted ? (
                <>
                  <span className="text-[10px] font-bold text-slate-400">HR Conversion Complete</span>
                  <span className="text-[9px] font-mono font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md mt-1 border border-emerald-100/50">
                    {formatStepDate(record.actual_joining_date || record.updated_at)}
                  </span>
                </>
              ) : isDocsApproved ? (
                <button
                  onClick={handleApproveAndCreateEmployee}
                  disabled={processingAction === 'approve'}
                  className="mt-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black rounded-lg transition-all cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1"
                >
                  {processingAction === 'approve' ? 'Converting...' : '👤 Convert to Employee'}
                </button>
              ) : (
                <span className="text-[10px] font-bold text-slate-400 mt-1">HR Conversion Complete</span>
              )}
            </div>

          </div>

        </div>

      </div>

      {/* CANDIDATE EXECUTIVE HERO CARD */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
        
        <div className="flex items-center gap-6">
          {/* Avatar with Glow */}
          <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-[#07518a] via-blue-700 to-[#064270] text-white font-black text-3xl flex items-center justify-center shadow-lg shrink-0 font-outfit relative">
            {(record.candidate_name || 'C').charAt(0).toUpperCase()}
            <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-emerald-500 border-3 border-white dark:border-slate-900" title="Active Candidate" />
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-outfit tracking-tight">
                {record.candidate_name || 'Candidate Record'}
              </h1>
              <span className="px-3 py-1 rounded-md bg-[#07518a]/10 dark:bg-[#07518a]/20 text-[#07518a] dark:text-[#38bdf8] font-mono font-bold text-xs border border-[#07518a]/20">
                {record.onboarding_code}
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {record.candidate_email} • Phone: <strong className="text-slate-800 dark:text-slate-200 font-bold">{record.candidate_phone || '8297297247'}</strong>
            </p>

            <div className="pt-1 flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-slate-100 dark:bg-slate-800 text-[#07518a] dark:text-[#38bdf8] border border-slate-200 dark:border-slate-700">
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
          { id: 'documents', label: `Uploaded Compliance Documents Vault (${submittedDocList.length})`, icon: '📂' },
          { id: 'bank', label: 'Disbursement Bank Account', icon: '🏦' },
        ].map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#07518a] text-white shadow-md shadow-[#07518a]/20'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-white/50 dark:hover:bg-slate-800/50'
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
          (!subData.pan_number && !subData.aadhar_number && !subData.current_address && !emergencyInfo.name) ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 space-y-3 shadow-2xs">
              <div className="w-16 h-16 rounded-2xl bg-[#07518a]/10 text-[#07518a] text-3xl flex items-center justify-center mx-auto">
                🪪
              </div>
              <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-200">No Verification Details Submitted Yet</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                The candidate has not submitted their Government Identity (PAN, Aadhaar) or Residential Address details via the onboarding self-service link.
              </p>
            </div>
          ) : (
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
                  {subData.pan_number && (
                    <div className="p-4.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">PAN Card Number</span>
                        <div className="flex items-center gap-2">
                          <span className="font-black font-mono text-slate-900 dark:text-slate-100 text-base tracking-wider">
                            {subData.pan_number}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700">VALID</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {docsObj.pan_card && docsObj.pan_card.data && (
                          <button
                            onClick={() => setPreviewDoc({ title: 'PAN Card Proof', file: docsObj.pan_card })}
                            className="px-3 py-1.5 bg-[#07518a]/10 hover:bg-[#07518a]/20 text-[#07518a] dark:text-[#38bdf8] border border-[#07518a]/20 text-xs font-extrabold rounded-xl transition-all cursor-pointer shadow-2xs flex items-center gap-1"
                          >
                            <span>👁️</span> View File
                          </button>
                        )}
                        <button
                          onClick={() => copyToClipboard(subData.pan_number, 'PAN Card Number')}
                          className="px-3 py-1.5 bg-white dark:bg-slate-700 hover:bg-slate-100 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-extrabold rounded-xl transition-all cursor-pointer shadow-2xs flex items-center gap-1"
                        >
                          <span>📋</span> Copy
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Aadhaar Block */}
                  {subData.aadhar_number && (
                    <div className="p-4.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Aadhaar Card Number</span>
                        <div className="flex items-center gap-2">
                          <span className="font-black font-mono text-slate-900 dark:text-slate-100 text-base tracking-wider">
                            {subData.aadhar_number}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700">VERIFIED</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {docsObj.aadhar_card && docsObj.aadhar_card.data && (
                          <button
                            onClick={() => setPreviewDoc({ title: 'Aadhaar Card Proof', file: docsObj.aadhar_card })}
                            className="px-3 py-1.5 bg-[#07518a]/10 hover:bg-[#07518a]/20 text-[#07518a] dark:text-[#38bdf8] border border-[#07518a]/20 text-xs font-extrabold rounded-xl transition-all cursor-pointer shadow-2xs flex items-center gap-1"
                          >
                            <span>👁️</span> View File
                          </button>
                        )}
                        <button
                          onClick={() => copyToClipboard(subData.aadhar_number, 'Aadhaar Card Number')}
                          className="px-3 py-1.5 bg-white dark:bg-slate-700 hover:bg-slate-100 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-extrabold rounded-xl transition-all cursor-pointer shadow-2xs flex items-center gap-1"
                        >
                          <span>📋</span> Copy
                        </button>
                      </div>
                    </div>
                  )}
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
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#07518a]/10 text-[#07518a] dark:text-[#38bdf8] border border-[#07518a]/20">
                    PRIMARY RESIDENCE
                  </span>
                </div>

                <div className="space-y-4 text-xs">
                  {subData.current_address && (
                    <div className="p-4.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-1">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Current Residential Address</span>
                      <p className="font-extrabold text-slate-900 dark:text-slate-100 text-sm leading-relaxed">
                        {subData.current_address}
                      </p>
                    </div>
                  )}

                  {emergencyInfo.name && (
                    <div className="p-4.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Emergency Contact Nominee</span>
                        <p className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">
                          {emergencyInfo.name} <span className="text-xs font-bold text-slate-500">({emergencyInfo.relationship || 'Contact'})</span>
                        </p>
                      </div>
                      {emergencyInfo.phone && (
                        <a
                          href={`tel:${emergencyInfo.phone}`}
                          className="font-mono font-black text-[#07518a] dark:text-[#38bdf8] bg-[#07518a]/10 dark:bg-[#07518a]/20 px-3 py-1.5 rounded-xl border border-[#07518a]/20 hover:bg-[#07518a]/20 transition-colors flex items-center gap-1.5"
                        >
                          <span>📞</span> {emergencyInfo.phone}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>

            </div>
          )
        )}

        {/* TAB 2: UPLOADED COMPLIANCE DOCUMENTS VAULT */}
        {activeTab === 'documents' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-6 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white font-outfit flex items-center gap-2">
                    <span>📂</span> Candidate Submitted Document Vault
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Compliance documents, proof of identity, educational certificates, and salary slips submitted by candidate.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-[#07518a]/10 dark:bg-[#07518a]/20 text-[#07518a] dark:text-[#38bdf8] border border-[#07518a]/20 w-fit">
                  {submittedDocList.length} Files Attached
                </span>
              </div>

              {submittedDocList.length === 0 ? (
                <div className="py-16 text-center space-y-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                  <span className="text-4xl inline-block mb-1">📁</span>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No Attached Documents Found</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    The candidate has not uploaded document files yet or has submitted textual details only.
                  </p>
                </div>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {submittedDocList.map((docItem) => (
                    <div
                      key={docItem.key}
                      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-5 space-y-4 shadow-2xs hover:border-[#07518a]/40 dark:hover:border-[#07518a]/50 transition-all flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-2xl">{docItem.icon}</span>
                          <span className="text-[10px] font-mono font-bold bg-[#07518a]/10 dark:bg-[#07518a]/20 text-[#07518a] dark:text-[#38bdf8] px-2.5 py-0.5 rounded-full border border-[#07518a]/20">
                            {docItem.category}
                          </span>
                        </div>

                        <div>
                          <h4 className="text-sm font-black text-slate-900 dark:text-white font-outfit">{docItem.label}</h4>
                          <p className="text-[11px] font-mono text-slate-500 truncate mt-0.5">{docItem.file.name}</p>
                        </div>

                        {/* Thumbnail / Document Preview Card */}
                        <div className="h-32 bg-slate-200 dark:bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center border border-slate-200 dark:border-slate-700 relative group">
                          {docItem.file.data.startsWith('data:image/') ? (
                            <img src={docItem.file.data} alt={docItem.label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          ) : (
                            <div className="text-center p-4">
                              <span className="text-3xl block mb-1">📄</span>
                              <span className="text-[10px] font-bold text-slate-500 uppercase">{docItem.file.name.split('.').pop() || 'PDF'}</span>
                            </div>
                          )}
                          <button
                            onClick={() => setPreviewDoc({ title: docItem.label, file: docItem.file })}
                            className="absolute inset-0 bg-slate-900/60 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          >
                            <span>👁️</span> Click to Preview
                          </button>
                        </div>
                      </div>

                      <div className="pt-2 flex items-center gap-2">
                        <button
                          onClick={() => setPreviewDoc({ title: docItem.label, file: docItem.file })}
                          className="flex-1 py-2 bg-[#07518a] hover:bg-[#064270] text-white font-extrabold text-xs rounded-xl transition-colors cursor-pointer shadow-2xs flex items-center justify-center gap-1"
                        >
                          <span>👁️</span> View
                        </button>
                        <button
                          onClick={() => handleDownloadFile(docItem.file.name, docItem.file.data)}
                          className="py-2 px-3 bg-white dark:bg-slate-700 hover:bg-slate-100 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-extrabold text-xs rounded-xl transition-colors cursor-pointer shadow-2xs flex items-center justify-center gap-1"
                          title="Download File"
                        >
                          <span>⬇️</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: BANK DETAILS */}
        {activeTab === 'bank' && (
          !bankInfo.account_number ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 space-y-3 shadow-2xs">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 text-3xl flex items-center justify-center mx-auto">
                🏦
              </div>
              <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-200">No Disbursement Bank Account Submitted Yet</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Disbursement bank account number, IFSC code, and branch details will be populated here after candidate submission.
              </p>
            </div>
          ) : (
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
              <div className="p-7 rounded-3xl bg-gradient-to-br from-slate-900 via-[#07518a]/80 to-slate-900 text-white space-y-5 border border-white/10 shadow-2xl relative overflow-hidden">
                <div className="flex justify-between items-center relative z-10">
                  <span className="text-base font-black uppercase tracking-wider text-sky-300 font-outfit">
                    {bankInfo.bank_name || 'PRIMARY BANK'}
                  </span>
                  <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full border border-emerald-400/30">
                    ✓ VERIFIED ACCOUNT
                  </span>
                </div>

                <div className="relative z-10 py-2 space-y-1">
                  <p className="text-[10px] uppercase text-slate-400 font-bold tracking-widest">Account Number</p>
                  <div className="flex items-center gap-3">
                    <p className="text-2xl font-mono font-black text-white select-all tracking-wider">
                      {bankInfo.account_number}
                    </p>
                    <button
                      onClick={() => copyToClipboard(bankInfo.account_number, 'Account Number')}
                      className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-xs font-bold rounded-lg text-white transition-colors cursor-pointer"
                    >
                      COPY
                    </button>
                  </div>
                </div>

                <div className="flex justify-between text-xs pt-4 border-white/10 relative z-10">
                  <span>IFSC Code: <strong className="font-mono text-sky-200 text-sm font-black">{bankInfo.ifsc_code || 'N/A'}</strong></span>
                  <span>Branch: <strong className="font-bold text-sky-200">{bankInfo.branch_name || 'Main Branch'}</strong></span>
                </div>
              </div>
            </div>
          )
        )}

      </div>

      {/* DOCUMENT PREVIEW MODAL */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-outfit">{previewDoc.title}</h3>
                <p className="text-xs text-slate-500 font-mono truncate max-w-md">{previewDoc.file.name}</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleDownloadFile(previewDoc.file.name, previewDoc.file.data)}
                  className="px-4 py-2 bg-[#07518a] hover:bg-[#064270] text-white font-bold text-xs rounded-xl cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <span>⬇️</span> Download File
                </button>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 overflow-auto flex items-center justify-center bg-slate-100 dark:bg-slate-950 min-h-[400px]">
              {previewDoc.file.data.startsWith('data:image/') ? (
                <img src={previewDoc.file.data} alt={previewDoc.title} className="max-h-[70vh] object-contain rounded-xl shadow-md" />
              ) : previewDoc.file.data.startsWith('data:application/pdf') ? (
                <iframe src={previewDoc.file.data} className="w-full h-[65vh] rounded-xl border border-slate-200" title={previewDoc.title} />
              ) : (
                <div className="text-center p-8 space-y-4">
                  <span className="text-5xl block">📄</span>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">File Preview Not Directly Embeddable</p>
                  <button
                    onClick={() => handleDownloadFile(previewDoc.file.name, previewDoc.file.data)}
                    className="px-5 py-2.5 bg-[#07518a] hover:bg-[#064270] text-white font-bold text-xs rounded-xl cursor-pointer shadow-md"
                  >
                    Download & View File ({previewDoc.file.name})
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DOCUMENT RE-UPLOAD REQUEST MODAL */}
      {isReuploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">⚠️</span>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white font-outfit">
                    Request Document Re-Upload
                  </h3>
                  <p className="text-xs text-slate-500">
                    Notify candidate {record?.candidate_name} to re-upload missing or invalid documents.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsReuploadModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRequestReuploadSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 block mb-2">
                  HR Note / Instructions for Candidate
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="e.g. Please re-upload a clear copy of your PAN Card and Month 3 Payslip. The previous upload was blurry."
                  value={reuploadNotes}
                  onChange={(e) => setReuploadNotes(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-xs font-medium text-slate-900 dark:text-white outline-none focus:border-[#07518a] focus:ring-2 focus:ring-[#07518a]/20 transition-all resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsReuploadModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-extrabold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReupload || !reuploadNotes.trim()}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer shadow-md disabled:opacity-50 flex items-center gap-1.5"
                >
                  <span>✉️</span> {submittingReupload ? 'Sending...' : 'Send Re-Upload Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OFF-CANVAS OFFER LETTER PREVIEW & EDIT DRAWER MODAL */}
      {showOfferDrawer && record && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex justify-end animate-fadeIn">
          <div className="w-full max-w-5xl bg-white dark:bg-slate-900 h-full flex flex-col shadow-2xl border-l border-slate-200 dark:border-slate-800">
            
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/80">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-[#07518a]/10 dark:bg-[#07518a]/20 text-[#07518a] dark:text-[#38bdf8] flex items-center justify-center text-lg font-bold">
                  📝
                </span>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white font-outfit">
                    Offer Letter Preview & Custom Editor
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Edit content or correct spelling errors before sending email to {record.candidate_name || record.candidate_email}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowOfferDrawer(false)}
                className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 font-bold flex items-center justify-center cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            {/* Drawer Body: Two-Column Layout (Left Form, Right Live Preview) */}
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Form Controls (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-[#07518a]/5 dark:bg-[#07518a]/10 p-4 rounded-2xl border border-[#07518a]/20 space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-[#07518a] dark:text-[#38bdf8] flex items-center gap-1.5">
                    <span>⚙️</span> Email Dispatch Settings
                  </h4>

                  {/* Sender Email Selection */}
                  <div>
                    <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                      Sender Account (From Email)
                    </label>
                    <select
                      value={senderEmail}
                      onChange={(e) => setSenderEmail(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-[#07518a]"
                    >
                      {availableSenders.map((s, idx) => (
                        <option key={s.id || s.email || idx} value={s.email || s.from_email}>
                          ✉️ {s.email || s.from_email} {s.name ? `(${s.name})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Offer Field Customization */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    ✍️ Edit Offer Document Content
                  </h4>

                  <div>
                    <label className="text-[11px] font-extrabold text-slate-600 dark:text-slate-400 block mb-1">
                      Designation / Position Title
                    </label>
                    <input
                      type="text"
                      value={customDesignation}
                      onChange={(e) => setCustomDesignation(e.target.value)}
                      placeholder="e.g. Senior Software Engineer"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-[#07518a]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-extrabold text-slate-600 dark:text-slate-400 block mb-1">
                        Proposed Joining Date
                      </label>
                      <input
                        type="date"
                        value={customJoiningDate}
                        onChange={(e) => setCustomJoiningDate(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-[#07518a]"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-extrabold text-slate-600 dark:text-slate-400 block mb-1">
                        Work Location
                      </label>
                      <input
                        type="text"
                        value={customWorkLocation}
                        onChange={(e) => setCustomWorkLocation(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-[#07518a]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-extrabold text-slate-600 dark:text-slate-400 block mb-1">
                      ✍️ Edit Email Body Text / Paragraphs
                    </label>
                    <textarea
                      rows={6}
                      value={customMessage}
                      onChange={(e) => setCustomMessage(e.target.value)}
                      placeholder="Edit main email body text, compensation terms, or correct spelling errors here..."
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs font-medium text-slate-900 dark:text-white outline-none focus:border-[#07518a] resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Live Interactive Full-Width Email Preview (7 cols) */}
              <div className="lg:col-span-7 bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-y-auto space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <span>👁️</span> Live Email Preview (Full Width View)
                  </span>
                  <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                    Real-time Sync
                  </span>
                </div>

                {/* Email Canvas Box */}
                <div className="bg-white text-slate-900 p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 text-xs leading-relaxed font-sans w-full">
                  <div className="border-b border-slate-100 pb-4 text-center">
                    <h2 className="text-lg font-black text-slate-900 font-outfit">
                      Brihaspathi Technologies Limited
                    </h2>
                  </div>

                  <div className="border-b border-slate-100 pb-3 text-slate-500 font-medium">
                    <p><strong>Date:</strong> {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                    <p><strong>To:</strong> <strong className="text-slate-900">{record.candidate_name || record.candidate_email}</strong></p>
                  </div>

                  <div className="border-l-4 border-[#07518a] pl-3 py-1 font-black text-[#07518a] text-xs">
                    Subject: Offer of Employment – {customDesignation || record.job_title || 'Position'}
                  </div>

                  <p>Dear <strong>{record.candidate_name || 'Candidate'}</strong>,</p>

                  <p>We are pleased to offer you employment with <strong>Brihaspathi Technologies Limited</strong> for the position of <strong>{customDesignation || record.job_title || 'Position'}</strong>.</p>

                  <div className="border-l-3 border-[#07518a] pl-3 py-1 space-y-1 font-bold">
                    <p>📅 Proposed Date of Joining: <span className="text-[#07518a]">{customJoiningDate ? new Date(customJoiningDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'As per mutual agreement'}</span></p>
                    <p>📍 Place of Work: <span className="text-[#07518a]">{customWorkLocation || 'Corporate Office, Hyderabad'}</span></p>
                  </div>

                  <div className="text-slate-700 dark:text-slate-300 text-xs font-medium leading-relaxed my-3 whitespace-pre-wrap">
                    {customMessage || 'Your compensation and other employment benefits will be as discussed and agreed upon during the selection process. The detailed terms and conditions of your employment will be provided as part of your appointment and joining formalities.'}
                  </div>

                  <div className="text-center py-3 bg-[#07518a]/5 rounded-xl border border-[#07518a]/20">
                    <span className="inline-block bg-[#07518a] text-white font-extrabold px-6 py-2 rounded-xl text-xs shadow-xs">
                      👍 Accept Offer Letter
                    </span>
                    <p className="text-[10px] text-slate-500 mt-2 font-bold px-4">
                      📌 Important Note: Once you click Accept Offer Letter, your candidate onboarding portal link will be unlocked.
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 text-slate-500 font-bold">
                    <span>Warm Regards,</span><br/>
                    <span>Human Resources Department</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowOfferDrawer(false)}
                className="px-4 py-2.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 font-extrabold text-xs rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendOfferLetter}
                disabled={processingAction === 'offer'}
                className="px-6 py-2.5 bg-[#07518a] hover:bg-[#064270] text-white font-extrabold text-xs rounded-xl shadow-lg shadow-[#07518a]/20 cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {processingAction === 'offer' ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Dispatching Email...</span>
                  </>
                ) : (
                  <>
                    <span>🚀</span> Send Official Offer Letter
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
