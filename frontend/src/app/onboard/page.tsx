'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function CandidateOnboardingPortalContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [loadingStatus, setLoadingStatus] = useState(true);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [candidateInfo, setCandidateInfo] = useState<{
    candidate_name?: string;
    company_name?: string;
    company_logo?: string;
    target_joining_date?: string;
    onboarding_status?: string;
    token_expires_at?: string;
    created_at?: string;
    designation?: string;
    work_location?: string;
  }>({});

  const [acceptingOffer, setAcceptingOffer] = useState(false);
  const [offerAccepted, setOfferAccepted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Candidate Input Fields
  const [candidateType, setCandidateType] = useState<'EXPERIENCED' | 'FRESHER'>('EXPERIENCED');
  const [panNumber, setPanNumber] = useState('');
  const [aadharNumber, setAadharNumber] = useState('');
  const [currentAddress, setCurrentAddress] = useState('');
  const [highestEducation, setHighestEducation] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [emergencyRel, setEmergencyRel] = useState('');
  const [previousCompany, setPreviousCompany] = useState('');
  const [previousDesignation, setPreviousDesignation] = useState('');

  // File Upload States
  const [panFile, setPanFile] = useState<{ name: string; data: string } | null>(null);
  const [aadharFile, setAadharFile] = useState<{ name: string; data: string } | null>(null);
  const [educationFile, setEducationFile] = useState<{ name: string; data: string } | null>(null);
  const [bankFile, setBankFile] = useState<{ name: string; data: string } | null>(null);
  const [photoFile, setPhotoFile] = useState<{ name: string; data: string } | null>(null);
  const [payslip1File, setPayslip1File] = useState<{ name: string; data: string } | null>(null);
  const [payslip2File, setPayslip2File] = useState<{ name: string; data: string } | null>(null);
  const [payslip3File, setPayslip3File] = useState<{ name: string; data: string } | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<{ name: string; data: string } | null>>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setter({
          name: file.name,
          data: event.target.result as string
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const isFormValid = 
    panNumber.trim() !== '' &&
    aadharNumber.trim() !== '' &&
    currentAddress.trim() !== '' &&
    highestEducation.trim() !== '' &&
    bankName.trim() !== '' &&
    accountNumber.trim() !== '' &&
    ifscCode.trim() !== '' &&
    emergencyName.trim() !== '' &&
    emergencyPhone.trim() !== '' &&
    emergencyRel.trim() !== '' &&
    panFile !== null &&
    aadharFile !== null &&
    educationFile !== null &&
    bankFile !== null &&
    photoFile !== null &&
    (candidateType === 'FRESHER' || (payslip1File !== null && payslip2File !== null && payslip3File !== null));

  useEffect(() => {
    if (!token) {
      setLoadingStatus(false);
      return;
    }
    fetch(`/api/v1/onboarding/portal-status?token=${encodeURIComponent(token)}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setErrorMsg(data.error);
        } else {
          setAlreadySubmitted(!!data.already_submitted);
          setIsExpired(!!data.is_expired);
          if (data.candidate_type) {
            setCandidateType(data.candidate_type === 'FRESHER' ? 'FRESHER' : 'EXPERIENCED');
          }
          setCandidateInfo({
            candidate_name: data.candidate_name,
            company_name: data.company_name,
            company_logo: data.company_logo,
            target_joining_date: data.target_joining_date,
            onboarding_status: data.onboarding_status,
            token_expires_at: data.token_expires_at,
            created_at: data.created_at,
            designation: data.designation,
            work_location: data.work_location
          });
        }
      })
      .catch(() => setErrorMsg('Connection error loading portal'))
      .finally(() => setLoadingStatus(false));
  }, [token]);

  const handleAcceptOffer = async () => {
    if (!token) return;
    setAcceptingOffer(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/v1/onboarding/accept-offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const data = await res.json();
      if (res.ok) {
        setOfferAccepted(true);
        setCandidateInfo(prev => ({ ...prev, onboarding_status: 'OFFER_ACCEPTED' }));
      } else {
        setErrorMsg(data.error || 'Failed to accept offer letter');
      }
    } catch (err) {
      setErrorMsg('Network error accepting offer letter');
    } finally {
      setAcceptingOffer(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setErrorMsg('Invalid onboarding token');
      return;
    }
    if (!isFormValid) {
      setErrorMsg(candidateType === 'EXPERIENCED' 
        ? 'Please fill all required text details and upload all 5 base documents plus last 3 months payslips.' 
        : 'Please fill all required text details and upload all 5 required base document files.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/v1/onboarding/portal-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          candidate_type: candidateType,
          pan_number: panNumber,
          aadhar_number: aadharNumber,
          current_address: currentAddress,
          highest_education: highestEducation,
          bank_name: bankName,
          account_number: accountNumber,
          ifsc_code: ifscCode,
          emergency_name: emergencyName,
          emergency_phone: emergencyPhone,
          emergency_relationship: emergencyRel,
          previous_company: previousCompany,
          previous_designation: previousDesignation,
          documents: {
            pan_card: panFile,
            aadhar_card: aadharFile,
            education_certificate: educationFile,
            bank_passbook: bankFile,
            passport_photo: photoFile,
            payslip_month_1: payslip1File,
            payslip_month_2: payslip2File,
            payslip_month_3: payslip3File
          }
        })
      });

      const data = await res.json();
      if (res.ok) {
        setSubmitted(true);
      } else {
        setErrorMsg(data.error || 'Failed to submit onboarding details');
      }
    } catch (err) {
      setErrorMsg('Connection error submitting details');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f6f9] text-slate-900 flex items-center justify-center p-3 sm:p-6 font-sans w-full">
      <div className="w-full bg-white border border-[#e4e7ec] rounded-2xl p-6 sm:p-10 shadow-[0_8px_16px_-6px_rgba(16,24,40,0.06),0_32px_64px_-16px_rgba(16,24,40,0.16)] space-y-8 relative overflow-hidden">
        
        {loadingStatus ? (
          <div className="py-20 text-center space-y-4">
            <div className="w-12 h-12 border-4 border-brand-600/15 border-t-brand-600 rounded-full animate-spin mx-auto" />
            <p className="text-sm font-medium text-slate-500">Verifying candidate onboarding link...</p>
          </div>
        ) : alreadySubmitted || submitted ? (
          <div className="py-16 text-center space-y-5 animate-fadeIn">
            <span className="inline-flex w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/15 text-emerald-600 items-center justify-center mb-2">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </span>
            <h2 className="text-3xl font-semibold text-slate-900 font-outfit tracking-[-0.01em]">
              {submitted ? 'Onboarding Submission Complete!' : 'Submission Complete!'}
            </h2>
            <p className="text-sm text-slate-500 max-w-xl mx-auto leading-relaxed font-medium">
              Thank you, <strong className="text-slate-900">{candidateInfo.candidate_name || 'Candidate'}</strong>. Your pre-joining documentation and verification details have been received successfully and sent to HR for compliance review.
            </p>
            <div className="pt-4">
              <span className="px-6 py-3 bg-emerald-500/10 border border-emerald-500/15 text-emerald-700 font-semibold text-xs rounded-xl inline-flex items-center gap-2.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Document Verification &amp; Approval Pending HR Review
              </span>
            </div>
          </div>
        ) : candidateInfo.onboarding_status === 'OFFER_SENT' && !offerAccepted ? (
          <div className="py-6 space-y-6 animate-fadeIn max-w-5xl mx-auto text-left w-full">
            
            {/* Header Branding */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#e4e7ec] shadow-[0_1px_2px_rgba(16,24,40,0.04)] space-y-6">
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#eaecf0] pb-6">
                <div>
                  {candidateInfo.company_logo && (
                    <img 
                      src={candidateInfo.company_logo.startsWith('http') || candidateInfo.company_logo.startsWith('data:') ? candidateInfo.company_logo : `https://newhrms.brihaspathi.in${candidateInfo.company_logo}`} 
                      alt={candidateInfo.company_name || 'Company Logo'} 
                      className="h-10 max-w-[240px] object-contain mb-2" 
                    />
                  )}
                  <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 font-outfit tracking-[-0.01em]">
                    {candidateInfo.company_name || 'Brihaspathi Rail Private Limited'}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">Official Employment Offer Letter</p>
                </div>

                <div className="bg-amber-500/[0.07] border border-amber-500/20 rounded-xl p-4 text-center sm:text-right shrink-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 block">Offer Validity Deadline</span>
                  <strong className="text-xs font-mono font-semibold text-amber-900">
                    {candidateInfo.token_expires_at ? new Date(candidateInfo.token_expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '2 Days / 48 Hours'}
                  </strong>
                  <span className="text-[10px] text-amber-600 block mt-0.5 font-medium">Strictly 2 Days (48 Hours)</span>
                </div>
              </div>

              {errorMsg && (
                <div className="p-4 rounded-xl bg-rose-500/[0.06] border border-rose-500/20 text-rose-700 text-xs font-medium flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008ZM12 3l9 16.5H3L12 3Z" />
                  </svg>
                  {errorMsg}
                </div>
              )}

              {/* Offer Document Text */}
              <div className="space-y-4 text-xs sm:text-sm text-slate-600 leading-relaxed font-medium bg-[#fafbfc] p-6 rounded-2xl border border-[#eaecf0]">
                <div className="border-b border-[#eaecf0] pb-3 flex justify-between font-semibold text-slate-900">
                  <span>Date: {candidateInfo.created_at ? new Date(candidateInfo.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                  <span>To: {candidateInfo.candidate_name || 'Candidate'}</span>
                </div>

                <div className="bg-brand-600/[0.06] border-l-4 border-brand-600 p-3 rounded-md text-slate-900 font-semibold text-sm">
                  Subject: Offer of Employment – {candidateInfo.designation || 'Software Engineer'}
                </div>

                <p>Dear <strong>{candidateInfo.candidate_name || 'Candidate'}</strong>,</p>

                <p>
                  We are pleased to offer you employment with <strong>{candidateInfo.company_name || 'Brihaspathi Rail Private Limited'}</strong> for the position of <strong>{candidateInfo.designation || 'Software Engineer'}</strong>.
                </p>

                <div className="grid sm:grid-cols-2 gap-3 p-4 bg-white rounded-xl border border-[#e4e7ec] font-semibold text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-medium tracking-wider">Proposed Date of Joining</span>
                    <span className="text-slate-900 text-sm font-semibold font-outfit">
                      {candidateInfo.target_joining_date ? new Date(candidateInfo.target_joining_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'To Be Confirmed'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-medium tracking-wider">Place of Work</span>
                    <span className="text-slate-900 text-sm font-semibold font-outfit">
                      {candidateInfo.work_location || 'Corporate Office, Hyderabad'}
                    </span>
                  </div>
                </div>

                <p>
                  Your compensation and other employment benefits will be as discussed and agreed upon during the selection process. The detailed terms and conditions of your employment will be provided as part of your appointment and joining formalities.
                </p>

                <p>
                  This offer is subject to the successful completion of the required pre-employment documentation and verification process.
                </p>

                <p className="font-semibold text-amber-800 bg-amber-500/[0.07] p-3 rounded-xl border border-amber-500/20">
                  Please confirm your acceptance of this offer within 2 days (48 hours) of issue.
                </p>

                <p>
                  We are delighted to welcome you to <strong>{candidateInfo.company_name || 'Brihaspathi Rail Private Limited'}</strong> and look forward to having you as a valued member of our team.
                </p>

                <div className="pt-3 border-t border-[#eaecf0] font-semibold">
                  <span>Warm Regards,</span><br/>
                  <span>Human Resources Department</span><br/>
                  <strong className="text-brand-600 font-semibold">{candidateInfo.company_name || 'Brihaspathi Rail Private Limited'}</strong>
                </div>
              </div>

              {/* Acceptance Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-4">
                <button
                  type="button"
                  onClick={handleAcceptOffer}
                  disabled={acceptingOffer}
                  className="w-full sm:w-auto px-8 py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm rounded-[11px] transition-all shadow-[0_8px_20px_-6px_rgba(79,70,229,0.5)] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  {acceptingOffer ? 'Accepting Offer...' : 'Accept Offer Letter'}
                </button>
              </div>

            </div>

          </div>
        ) : (candidateInfo.onboarding_status === 'OFFER_ACCEPTED' || offerAccepted) && candidateInfo.onboarding_status !== 'LINK_SENT' && !submitted ? (
          /* THANK YOU FOR ACCEPTING CONFIRMATION SCREEN */
          <div className="py-16 text-center space-y-6 animate-fadeIn max-w-2xl mx-auto">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto text-emerald-600 shadow-[0_8px_20px_-6px_rgba(16,185,129,0.25)] border border-emerald-500/15">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-semibold text-slate-900 dark:text-white font-outfit tracking-[-0.01em]">
                Thank You for Accepting the Offer!
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-300 leading-relaxed font-medium">
                Dear <strong className="text-slate-900 dark:text-white">{candidateInfo.candidate_name || 'Candidate'}</strong>, your offer letter acceptance has been registered with <strong>{candidateInfo.company_name || 'HR Team'}</strong>.
              </p>
            </div>

            <div className="bg-emerald-500/[0.07] dark:bg-emerald-950/40 border border-emerald-500/20 dark:border-emerald-800/60 rounded-2xl p-6 text-left space-y-2">
              <div className="flex items-center gap-2.5 text-emerald-800 dark:text-emerald-300 font-semibold text-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Offer Acceptance Status: Confirmed
              </div>
              <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium leading-relaxed">
                HR has been notified of your acceptance. Once HR dispatches your Onboarding Portal Link, you will receive an email to upload your pre-employment verification documents.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
            
            {/* Header with Dynamic Company Branding Logo & Company Name */}
            <div className="border-b border-[#eaecf0] pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                {candidateInfo.company_logo ? (
                  <div className="mb-3">
                    <img 
                      src={candidateInfo.company_logo.startsWith('http') || candidateInfo.company_logo.startsWith('data:') ? candidateInfo.company_logo : `https://newhrms.brihaspathi.in${candidateInfo.company_logo}`} 
                      alt={candidateInfo.company_name || 'Company Logo'} 
                      className="h-12 max-w-[280px] object-contain rounded-xl bg-[#fafbfc] p-1.5 border border-[#eaecf0]" 
                    />
                  </div>
                ) : null}
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-brand-600/[0.07] text-brand-700 border border-brand-600/15 uppercase tracking-wider">
                    Candidate Onboarding Portal
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 font-outfit tracking-[-0.015em]">
                  Welcome to {candidateInfo.company_name || 'Brihaspathi Technologies Limited'}
                </h2>
                <p className="text-sm text-slate-500 mt-1.5 font-medium">
                  Dear <strong className="text-brand-600 font-semibold">{candidateInfo.candidate_name || 'Candidate'}</strong>, please enter your details and upload required compliance document files below.
                </p>
              </div>

              {candidateInfo.target_joining_date && (
                <div className="shrink-0 bg-brand-600/[0.05] border border-brand-600/15 rounded-2xl p-4 text-center md:text-right">
                  <span className="text-[11px] font-semibold text-brand-600/90 uppercase tracking-wider block mb-0.5">Target Joining Date</span>
                  <strong className="text-sm font-semibold text-slate-900">
                    {new Date(candidateInfo.target_joining_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </strong>
                </div>
              )}
            </div>

            {errorMsg && (
              <div className="p-4 rounded-xl bg-rose-500/[0.06] border border-rose-500/20 text-rose-700 text-xs font-medium flex items-center justify-center gap-2">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008ZM12 3l9 16.5H3L12 3Z" />
                </svg>
                {errorMsg}
              </div>
            )}

            {/* CANDIDATE JOINING TYPE INFORMATIONAL BADGE (Configured by HR) */}
            <div className="bg-[#fafbfc] p-4 rounded-2xl border border-[#eaecf0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-brand-600/10 text-brand-600 flex items-center justify-center shrink-0">
                  {candidateType === 'EXPERIENCED' ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0M12 12.75h.008v.008H12v-.008Z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
                    </svg>
                  )}
                </span>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900">
                    Candidate Profile: {candidateType === 'EXPERIENCED' ? 'Experienced Professional' : 'Fresher Candidate'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {candidateType === 'EXPERIENCED'
                      ? 'HR has configured your profile as Experienced. Please upload your last 3 months payslips along with statutory documents.'
                      : 'HR has configured your profile as a Fresher. Standard statutory compliance document uploads are required.'}
                  </p>
                </div>
              </div>
              <span className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 border ${
                candidateType === 'EXPERIENCED'
                  ? 'bg-brand-600/[0.07] text-brand-700 border-brand-600/20'
                  : 'bg-emerald-500/[0.07] text-emerald-700 border-emerald-500/20'
              }`}>
                {candidateType === 'EXPERIENCED' ? 'Experienced' : 'Fresher'}
              </span>
            </div>

            {/* 2-COLUMN SIDE-BY-SIDE CARDS GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* LEFT COLUMN: Identity & Education */}
              <div className="space-y-8">
                
                {/* CARD 1: Statutory Identity & Compliance Verification */}
                <div className="space-y-5 bg-white p-6 sm:p-7 rounded-2xl border border-[#e4e7ec] shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900 flex items-center gap-2 border-b border-[#eaecf0] pb-3">
                    <span className="w-6 h-6 rounded-full bg-brand-600 text-white text-[11px] flex items-center justify-center font-semibold">1</span>
                    <span>Statutory Identity & Document Uploads</span>
                  </h3>
                  
                  <div className="space-y-4">
                    {/* PAN Card */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">PAN Card Number *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. ABCDE1234F"
                        value={panNumber}
                        onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                        className="w-full text-xs font-mono font-bold px-3.5 py-3 rounded-[11px] border border-[#d0d5dd] bg-white focus:border-brand-600 outline-none text-slate-900 uppercase placeholder:text-slate-400 mb-2"
                      />
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Upload PAN Card Image (PNG, JPG, JPEG, PDF) *</label>
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/jpg, application/pdf"
                          onChange={(e) => handleFileUpload(e, setPanFile)}
                          className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-600/10 file:text-brand-700 hover:file:bg-brand-600/15 cursor-pointer border border-[#e4e7ec] rounded-[11px] bg-white p-1"
                        />
                        {panFile && <p className="text-[11px] font-medium text-emerald-600 mt-1">✓ Attached: {panFile.name}</p>}
                      </div>
                    </div>

                    {/* Aadhaar Card */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Aadhaar Card Number *</label>
                      <input
                        type="text"
                        required
                        maxLength={14}
                        placeholder="12-digit Aadhaar Number"
                        value={aadharNumber}
                        onChange={(e) => setAadharNumber(e.target.value)}
                        className="w-full text-xs font-mono font-bold px-3.5 py-3 rounded-[11px] border border-[#d0d5dd] bg-white focus:border-brand-600 outline-none text-slate-900 placeholder:text-slate-400 mb-2"
                      />
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Upload Aadhaar Card Image (PNG, JPG, JPEG, PDF) *</label>
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/jpg, application/pdf"
                          onChange={(e) => handleFileUpload(e, setAadharFile)}
                          className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-600/10 file:text-brand-700 hover:file:bg-brand-600/15 cursor-pointer border border-[#e4e7ec] rounded-[11px] bg-white p-1"
                        />
                        {aadharFile && <p className="text-[11px] font-medium text-emerald-600 mt-1">✓ Attached: {aadharFile.name}</p>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* CARD 2: Educational Qualification & Address */}
                <div className="space-y-5 bg-white p-6 sm:p-7 rounded-2xl border border-[#e4e7ec] shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900 flex items-center gap-2 border-b border-[#eaecf0] pb-3">
                    <span className="w-6 h-6 rounded-full bg-brand-600 text-white text-[11px] flex items-center justify-center font-semibold">2</span>
                    <span>Education & Residential Address</span>
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Highest Educational Degree / Qualification *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. B.Tech Computer Science / MCA / MBA / Degree"
                        value={highestEducation}
                        onChange={(e) => setHighestEducation(e.target.value)}
                        className="w-full text-xs font-bold px-3.5 py-3 rounded-[11px] border border-[#d0d5dd] bg-white focus:border-brand-600 outline-none text-slate-900 placeholder:text-slate-400 mb-2"
                      />
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Upload Degree Certificate / Marksheet (PNG, JPG, JPEG, PDF) *</label>
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/jpg, application/pdf"
                          onChange={(e) => handleFileUpload(e, setEducationFile)}
                          className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-600/10 file:text-brand-700 hover:file:bg-brand-600/15 cursor-pointer border border-[#e4e7ec] rounded-[11px] bg-white p-1"
                        />
                        {educationFile && <p className="text-[11px] font-medium text-emerald-600 mt-1">✓ Attached: {educationFile.name}</p>}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Permanent & Current Residential Address *</label>
                      <textarea
                        rows={3}
                        required
                        placeholder="House No, Street, City, State, Pincode"
                        value={currentAddress}
                        onChange={(e) => setCurrentAddress(e.target.value)}
                        className="w-full text-xs px-3.5 py-2.5 rounded-[11px] border border-[#d0d5dd] bg-white focus:border-brand-600 outline-none text-slate-900 placeholder:text-slate-400 resize-none"
                      />
                    </div>
                  </div>
                </div>

              </div>

              {/* RIGHT COLUMN: Bank, Emergency Info & Payslips */}
              <div className="space-y-8">
                
                {/* CARD 3: Salary Disbursement Bank Account Details */}
                <div className="space-y-5 bg-white p-6 sm:p-7 rounded-2xl border border-[#e4e7ec] shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900 flex items-center gap-2 border-b border-[#eaecf0] pb-3">
                    <span className="w-6 h-6 rounded-full bg-brand-600 text-white text-[11px] flex items-center justify-center font-semibold">3</span>
                    <span>Bank Account & Passbook / Cheque Upload</span>
                  </h3>

                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Bank Name *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. HDFC Bank / ICICI / SBI"
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          className="w-full text-xs font-bold px-3.5 py-3 rounded-[11px] border border-[#d0d5dd] bg-white focus:border-brand-600 outline-none text-slate-900 placeholder:text-slate-400"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">IFSC Code *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. HDFC0001234"
                          value={ifscCode}
                          onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                          className="w-full text-xs font-mono font-bold px-3.5 py-3 rounded-[11px] border border-[#d0d5dd] bg-white focus:border-brand-600 outline-none text-slate-900 placeholder:text-slate-400 uppercase"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Bank Account Number *</label>
                      <input
                        type="text"
                        required
                        placeholder="Account Number"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        className="w-full text-xs font-mono font-bold px-3.5 py-3 rounded-[11px] border border-[#d0d5dd] bg-white focus:border-brand-600 outline-none text-slate-900 placeholder:text-slate-400 mb-2"
                      />
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Upload Cancelled Cheque / Bank Passbook Image (PNG, JPG, JPEG, PDF) *</label>
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/jpg, application/pdf"
                          onChange={(e) => handleFileUpload(e, setBankFile)}
                          className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-600/10 file:text-brand-700 hover:file:bg-brand-600/15 cursor-pointer border border-[#e4e7ec] rounded-[11px] bg-white p-1"
                        />
                        {bankFile && <p className="text-[11px] font-medium text-emerald-600 mt-1">✓ Attached: {bankFile.name}</p>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* CARD 4: Emergency Contact Details & Passport Photo Upload */}
                <div className="space-y-5 bg-white p-6 sm:p-7 rounded-2xl border border-[#e4e7ec] shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900 flex items-center gap-2 border-b border-[#eaecf0] pb-3">
                    <span className="w-6 h-6 rounded-full bg-brand-600 text-white text-[11px] flex items-center justify-center font-semibold">4</span>
                    <span>Emergency Contact & Passport Photograph</span>
                  </h3>

                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Contact Person Full Name *</label>
                        <input
                          type="text"
                          required
                          placeholder="Contact Name"
                          value={emergencyName}
                          onChange={(e) => setEmergencyName(e.target.value)}
                          className="w-full text-xs font-bold px-3.5 py-3 rounded-[11px] border border-[#d0d5dd] bg-white focus:border-brand-600 outline-none text-slate-900 placeholder:text-slate-400"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Relationship *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Father / Spouse / Mother"
                          value={emergencyRel}
                          onChange={(e) => setEmergencyRel(e.target.value)}
                          className="w-full text-xs font-bold px-3.5 py-3 rounded-[11px] border border-[#d0d5dd] bg-white focus:border-brand-600 outline-none text-slate-900 placeholder:text-slate-400"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Contact Phone Number *</label>
                      <input
                        type="tel"
                        required
                        placeholder="10-digit Phone Number"
                        value={emergencyPhone}
                        onChange={(e) => setEmergencyPhone(e.target.value)}
                        className="w-full text-xs font-mono font-bold px-3.5 py-3 rounded-[11px] border border-[#d0d5dd] bg-white focus:border-brand-600 outline-none text-slate-900 placeholder:text-slate-400 mb-2"
                      />
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Upload Passport Size Photograph (PNG, JPG, JPEG) *</label>
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/jpg"
                          onChange={(e) => handleFileUpload(e, setPhotoFile)}
                          className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-600/10 file:text-brand-700 hover:file:bg-brand-600/15 cursor-pointer border border-[#e4e7ec] rounded-[11px] bg-white p-1"
                        />
                        {photoFile && <p className="text-[11px] font-medium text-emerald-600 mt-1">✓ Attached: {photoFile.name}</p>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* CARD 5: Experienced Professional - Last 3 Months Payslips (Conditional on EXPERIENCED) */}
                {candidateType === 'EXPERIENCED' && (
                  <div className="space-y-5 bg-white p-6 sm:p-7 rounded-2xl border border-[#e4e7ec] shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all animate-fadeIn">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900 flex items-center gap-2 border-b border-[#eaecf0] pb-3">
                      <span className="w-6 h-6 rounded-full bg-brand-600 text-white text-[11px] flex items-center justify-center font-semibold">5</span>
                      <span>Previous Employment & Last 3 Months Payslips</span>
                    </h3>

                    <div className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Previous Company Name</label>
                          <input
                            type="text"
                            placeholder="Previous Company"
                            value={previousCompany}
                            onChange={(e) => setPreviousCompany(e.target.value)}
                            className="w-full text-xs font-bold px-3.5 py-3 rounded-[11px] border border-[#d0d5dd] bg-white focus:border-brand-600 outline-none text-slate-900 placeholder:text-slate-400"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Previous Designation</label>
                          <input
                            type="text"
                            placeholder="e.g. Senior Software Engineer"
                            value={previousDesignation}
                            onChange={(e) => setPreviousDesignation(e.target.value)}
                            className="w-full text-xs font-bold px-3.5 py-3 rounded-[11px] border border-[#d0d5dd] bg-white focus:border-brand-600 outline-none text-slate-900 placeholder:text-slate-400"
                          />
                        </div>
                      </div>

                      {/* 3 Months Payslips Uploads */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">Upload Payslip Month 1 (Latest Month) *</label>
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/jpg, application/pdf"
                          onChange={(e) => handleFileUpload(e, setPayslip1File)}
                          className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-600/10 file:text-brand-700 hover:file:bg-brand-600/15 cursor-pointer border border-[#e4e7ec] rounded-[11px] bg-white p-1 mb-2"
                        />
                        {payslip1File && <p className="text-[11px] font-medium text-emerald-600 mb-3">✓ Attached Month 1: {payslip1File.name}</p>}

                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">Upload Payslip Month 2 *</label>
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/jpg, application/pdf"
                          onChange={(e) => handleFileUpload(e, setPayslip2File)}
                          className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-600/10 file:text-brand-700 hover:file:bg-brand-600/15 cursor-pointer border border-[#e4e7ec] rounded-[11px] bg-white p-1 mb-2"
                        />
                        {payslip2File && <p className="text-[11px] font-medium text-emerald-600 mb-3">✓ Attached Month 2: {payslip2File.name}</p>}

                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">Upload Payslip Month 3 *</label>
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/jpg, application/pdf"
                          onChange={(e) => handleFileUpload(e, setPayslip3File)}
                          className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-600/10 file:text-brand-700 hover:file:bg-brand-600/15 cursor-pointer border border-[#e4e7ec] rounded-[11px] bg-white p-1"
                        />
                        {payslip3File && <p className="text-[11px] font-medium text-emerald-600 mt-1">✓ Attached Month 3: {payslip3File.name}</p>}
                      </div>
                    </div>
                  </div>
                )}

              </div>

            </div>

            {/* SUBMIT BUTTON WITH MANDATORY VALIDATION LOCK */}
            <div className="pt-6 border-t border-[#eaecf0] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-xs font-medium text-slate-500">
                {!isFormValid ? (
                  <span className="text-amber-600 flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                    <span>
                      {candidateType === 'EXPERIENCED' 
                        ? 'Please fill all required text details & upload 5 base documents plus last 3 months payslips.' 
                        : 'Please fill all required text details & upload all 5 base document files.'}
                    </span>
                  </span>
                ) : (
                  <span className="text-emerald-600 flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    <span>All required details & document files completed! Ready for submission.</span>
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={!isFormValid || submitting}
                className={`px-10 py-3.5 font-semibold text-sm rounded-[11px] transition-all flex items-center justify-center gap-2 ${
                  isFormValid && !submitting
                    ? 'bg-brand-600 hover:bg-brand-700 text-white cursor-pointer shadow-[0_8px_20px_-6px_rgba(79,70,229,0.5)] active:scale-[0.99]'
                    : 'bg-slate-100 text-slate-400 border border-[#e4e7ec] cursor-not-allowed'
                }`}
              >
                {submitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />
                    <span>Submitting Onboarding Details...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                    </svg>
                    <span>Submit Onboarding Details</span>
                  </>
                )}
              </button>
            </div>

          </form>
        )}
      </div>
    </div>
  );
}

export default function CandidateOnboardingPortalPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f4f6f9] flex items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-brand-600/15 border-t-brand-600 rounded-full animate-spin" />
      </div>
    }>
      <CandidateOnboardingPortalContent />
    </Suspense>
  );
}
