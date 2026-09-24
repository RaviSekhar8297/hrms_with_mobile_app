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
    <div className="min-h-screen bg-slate-100 text-slate-900 flex items-center justify-center p-3 sm:p-6 font-sans w-full">
      <div className="w-full bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-8 relative overflow-hidden">
        
        {loadingStatus ? (
          <div className="py-20 text-center space-y-4">
            <div className="w-10 h-10 border-4 border-[#07518a] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Verifying candidate onboarding link...</p>
          </div>
        ) : alreadySubmitted || submitted ? (
          <div className="py-16 text-center space-y-5 animate-fadeIn">
            <span className="text-6xl inline-block mb-2">🎉</span>
            <h2 className="text-3xl font-black text-slate-900 font-outfit">
              {submitted ? 'Onboarding Submission Complete!' : 'Submission Complete!'}
            </h2>
            <p className="text-sm text-slate-600 max-w-xl mx-auto leading-relaxed font-medium">
              Thank you, <strong className="text-slate-900">{candidateInfo.candidate_name || 'Candidate'}</strong>. Your pre-joining documentation and verification details have been received successfully and sent to HR for compliance review.
            </p>
            <div className="pt-4">
              <span className="px-6 py-3 bg-emerald-50 border border-emerald-200 text-emerald-700 font-extrabold text-xs rounded-2xl inline-flex items-center gap-2 shadow-xs">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
                ✓ Document Verification & Approval Pending HR Review
              </span>
            </div>
          </div>
        ) : candidateInfo.onboarding_status === 'OFFER_SENT' && !offerAccepted ? (
          <div className="py-6 space-y-6 animate-fadeIn max-w-5xl mx-auto text-left w-full">
            
            {/* Header Branding */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-md space-y-6">
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
                <div>
                  {candidateInfo.company_logo && (
                    <img 
                      src={candidateInfo.company_logo.startsWith('http') || candidateInfo.company_logo.startsWith('data:') ? candidateInfo.company_logo : `https://newhrms.brihaspathi.in${candidateInfo.company_logo}`} 
                      alt={candidateInfo.company_name || 'Company Logo'} 
                      className="h-10 max-w-[240px] object-contain mb-2" 
                    />
                  )}
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 font-outfit">
                    {candidateInfo.company_name || 'Brihaspathi Rail Private Limited'}
                  </h2>
                  <p className="text-xs text-slate-500 font-bold">Official Employment Offer Letter</p>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center sm:text-right shrink-0">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 block">Offer Validity Deadline</span>
                  <strong className="text-xs font-mono font-black text-amber-900">
                    {candidateInfo.token_expires_at ? new Date(candidateInfo.token_expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '2 Days / 48 Hours'}
                  </strong>
                  <span className="text-[10px] text-amber-600 block mt-0.5 font-bold">⏱️ Strictly 2 Days (48 Hours)</span>
                </div>
              </div>

              {errorMsg && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold text-center">
                  ⚠️ {errorMsg}
                </div>
              )}

              {/* Offer Document Text */}
              <div className="space-y-4 text-xs sm:text-sm text-slate-700 leading-relaxed font-medium bg-slate-50/60 p-6 rounded-2xl border border-slate-200/80">
                <div className="border-b border-slate-200 pb-3 flex justify-between font-bold text-slate-900">
                  <span>Date: {candidateInfo.created_at ? new Date(candidateInfo.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                  <span>To: {candidateInfo.candidate_name || 'Candidate'}</span>
                </div>

                <div className="bg-[#07518a]/10 border-l-4 border-[#07518a] p-3 rounded-md text-[#07518a] font-black text-sm">
                  Subject: Offer of Employment – {candidateInfo.designation || 'Software Engineer'}
                </div>

                <p>Dear <strong>{candidateInfo.candidate_name || 'Candidate'}</strong>,</p>

                <p>
                  We are pleased to offer you employment with <strong>{candidateInfo.company_name || 'Brihaspathi Rail Private Limited'}</strong> for the position of <strong>{candidateInfo.designation || 'Software Engineer'}</strong>.
                </p>

                <div className="grid sm:grid-cols-2 gap-3 p-4 bg-white rounded-xl border border-slate-200 font-bold text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Proposed Date of Joining</span>
                    <span className="text-slate-900 text-sm font-black font-outfit">
                      {candidateInfo.target_joining_date ? new Date(candidateInfo.target_joining_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'To Be Confirmed'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Place of Work</span>
                    <span className="text-slate-900 text-sm font-black font-outfit">
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

                <p className="font-bold text-amber-800 bg-amber-50/60 p-3 rounded-xl border border-amber-200/50">
                  ⚠️ Please confirm your acceptance of this offer within 2 days (48 hours) of issue.
                </p>

                <p>
                  We are delighted to welcome you to <strong>{candidateInfo.company_name || 'Brihaspathi Rail Private Limited'}</strong> and look forward to having you as a valued member of our team.
                </p>

                <div className="pt-3 border-t border-slate-200 font-bold">
                  <span>Warm Regards,</span><br/>
                  <span>Human Resources Department</span><br/>
                  <strong className="text-[#07518a] font-extrabold">{candidateInfo.company_name || 'Brihaspathi Rail Private Limited'}</strong>
                </div>
              </div>

              {/* Acceptance Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-4">
                <button
                  type="button"
                  onClick={handleAcceptOffer}
                  disabled={acceptingOffer}
                  className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-sm rounded-2xl transition-all shadow-lg shadow-emerald-600/20 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <span>👍</span> {acceptingOffer ? 'Accepting Offer...' : 'Accept Offer Letter'}
                </button>
              </div>

            </div>

          </div>
        ) : (candidateInfo.onboarding_status === 'OFFER_ACCEPTED' || offerAccepted) && candidateInfo.onboarding_status !== 'LINK_SENT' && !submitted ? (
          /* THANK YOU FOR ACCEPTING CONFIRMATION SCREEN */
          <div className="py-16 text-center space-y-6 animate-fadeIn max-w-2xl mx-auto">
            <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-950/60 rounded-3xl flex items-center justify-center text-4xl mx-auto text-emerald-600 shadow-lg shadow-emerald-500/20 border border-emerald-200">
              🎉
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-black text-slate-900 dark:text-white font-outfit">
                Thank You for Accepting the Offer!
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                Dear <strong className="text-slate-900 dark:text-white">{candidateInfo.candidate_name || 'Candidate'}</strong>, your offer letter acceptance has been registered with <strong>{candidateInfo.company_name || 'HR Team'}</strong>.
              </p>
            </div>

            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl p-6 text-left space-y-2 shadow-xs">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-extrabold text-sm">
                <span>🟢 Offer Acceptance Status: Confirmed</span>
              </div>
              <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium leading-relaxed">
                HR has been notified of your acceptance. Once HR dispatches your Onboarding Portal Link, you will receive an email to upload your pre-employment verification documents.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
            
            {/* Header with Dynamic Company Branding Logo & Company Name */}
            <div className="border-b border-slate-200 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                {candidateInfo.company_logo ? (
                  <div className="mb-3">
                    <img 
                      src={candidateInfo.company_logo.startsWith('http') || candidateInfo.company_logo.startsWith('data:') ? candidateInfo.company_logo : `https://newhrms.brihaspathi.in${candidateInfo.company_logo}`} 
                      alt={candidateInfo.company_name || 'Company Logo'} 
                      className="h-12 max-w-[280px] object-contain rounded-xl bg-slate-50 p-1.5 border border-slate-200" 
                    />
                  </div>
                ) : null}
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-3 py-0.5 rounded-full text-[11px] font-extrabold bg-[#07518a]/10 text-[#07518a] border border-[#07518a]/20 uppercase tracking-wider">
                    Candidate Onboarding Portal
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 font-outfit tracking-tight">
                  Welcome to {candidateInfo.company_name || 'Brihaspathi Technologies Limited'}
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  Dear <strong className="text-[#07518a] font-extrabold">{candidateInfo.candidate_name || 'Candidate'}</strong>, please enter your details and upload required compliance document files below.
                </p>
              </div>

              {candidateInfo.target_joining_date && (
                <div className="shrink-0 bg-[#07518a]/10 border border-[#07518a]/20 rounded-2xl p-4 text-center md:text-right shadow-2xs">
                  <span className="text-[11px] font-extrabold text-[#07518a] uppercase tracking-wider block mb-0.5">Target Joining Date</span>
                  <strong className="text-sm font-black text-[#07518a]">
                    {new Date(candidateInfo.target_joining_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </strong>
                </div>
              )}
            </div>

            {errorMsg && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold text-center shadow-xs">
                ⚠️ {errorMsg}
              </div>
            )}

            {/* CANDIDATE JOINING TYPE INFORMATIONAL BADGE (Configured by HR) */}
            <div className="bg-[#07518a]/5 p-4 rounded-2xl border border-[#07518a]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{candidateType === 'EXPERIENCED' ? '💼' : '🎓'}</span>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-[#07518a]">
                    Candidate Profile: {candidateType === 'EXPERIENCED' ? 'Experienced Professional' : 'Fresher Candidate'}
                  </h3>
                  <p className="text-xs text-slate-600 font-medium">
                    {candidateType === 'EXPERIENCED'
                      ? 'HR has configured your profile as Experienced. Please upload your last 3 months payslips along with statutory documents.'
                      : 'HR has configured your profile as a Fresher. Standard statutory compliance document uploads are required.'}
                  </p>
                </div>
              </div>
              <span className={`px-3 py-1.5 rounded-xl text-xs font-extrabold shrink-0 border ${
                candidateType === 'EXPERIENCED'
                  ? 'bg-[#07518a] text-white border-[#07518a]'
                  : 'bg-emerald-600 text-white border-emerald-600'
              }`}>
                {candidateType === 'EXPERIENCED' ? '💼 Experienced' : '🎓 Fresher'}
              </span>
            </div>

            {/* 2-COLUMN SIDE-BY-SIDE CARDS GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* LEFT COLUMN: Identity & Education */}
              <div className="space-y-8">
                
                {/* CARD 1: Statutory Identity & Compliance Verification */}
                <div className="space-y-5 bg-slate-50/70 p-6 sm:p-7 rounded-2xl border border-slate-200/80 shadow-xs hover:border-[#07518a]/30 transition-all">
                  <h3 className="text-xs font-black uppercase tracking-wider text-[#07518a] flex items-center gap-2 border-b border-slate-200 pb-3">
                    <span className="w-6 h-6 rounded-full bg-[#07518a] text-white text-[11px] flex items-center justify-center font-bold">1</span>
                    <span>Statutory Identity & Document Uploads</span>
                  </h3>
                  
                  <div className="space-y-4">
                    {/* PAN Card */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">PAN Card Number *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. ABCDE1234F"
                        value={panNumber}
                        onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                        className="w-full text-xs font-mono font-bold px-3.5 py-3 rounded-xl border border-slate-300 bg-white focus:border-[#07518a] focus:ring-2 focus:ring-[#07518a]/20 outline-none text-slate-900 uppercase placeholder:text-slate-400 mb-2"
                      />
                      <label className="block text-[11px] font-extrabold text-slate-600 mb-1">Upload PAN Card Image (PNG, JPG, JPEG, PDF) *</label>
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/jpg, application/pdf"
                          onChange={(e) => handleFileUpload(e, setPanFile)}
                          className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:bg-[#07518a]/10 file:text-[#07518a] hover:file:bg-[#07518a]/20 cursor-pointer border border-slate-300 rounded-xl bg-white p-1"
                        />
                        {panFile && <p className="text-[11px] font-bold text-emerald-600 mt-1">✓ Attached: {panFile.name}</p>}
                      </div>
                    </div>

                    {/* Aadhaar Card */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Aadhaar Card Number *</label>
                      <input
                        type="text"
                        required
                        maxLength={14}
                        placeholder="12-digit Aadhaar Number"
                        value={aadharNumber}
                        onChange={(e) => setAadharNumber(e.target.value)}
                        className="w-full text-xs font-mono font-bold px-3.5 py-3 rounded-xl border border-slate-300 bg-white focus:border-[#07518a] focus:ring-2 focus:ring-[#07518a]/20 outline-none text-slate-900 placeholder:text-slate-400 mb-2"
                      />
                      <label className="block text-[11px] font-extrabold text-slate-600 mb-1">Upload Aadhaar Card Image (PNG, JPG, JPEG, PDF) *</label>
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/jpg, application/pdf"
                          onChange={(e) => handleFileUpload(e, setAadharFile)}
                          className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:bg-[#07518a]/10 file:text-[#07518a] hover:file:bg-[#07518a]/20 cursor-pointer border border-slate-300 rounded-xl bg-white p-1"
                        />
                        {aadharFile && <p className="text-[11px] font-bold text-emerald-600 mt-1">✓ Attached: {aadharFile.name}</p>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* CARD 2: Educational Qualification & Address */}
                <div className="space-y-5 bg-slate-50/70 p-6 sm:p-7 rounded-2xl border border-slate-200/80 shadow-xs hover:border-[#07518a]/30 transition-all">
                  <h3 className="text-xs font-black uppercase tracking-wider text-[#07518a] flex items-center gap-2 border-b border-slate-200 pb-3">
                    <span className="w-6 h-6 rounded-full bg-[#07518a] text-white text-[11px] flex items-center justify-center font-bold">2</span>
                    <span>Education & Residential Address</span>
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Highest Educational Degree / Qualification *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. B.Tech Computer Science / MCA / MBA / Degree"
                        value={highestEducation}
                        onChange={(e) => setHighestEducation(e.target.value)}
                        className="w-full text-xs font-bold px-3.5 py-3 rounded-xl border border-slate-300 bg-white focus:border-[#07518a] focus:ring-2 focus:ring-[#07518a]/20 outline-none text-slate-900 placeholder:text-slate-400 mb-2"
                      />
                      <label className="block text-[11px] font-extrabold text-slate-600 mb-1">Upload Degree Certificate / Marksheet (PNG, JPG, JPEG, PDF) *</label>
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/jpg, application/pdf"
                          onChange={(e) => handleFileUpload(e, setEducationFile)}
                          className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:bg-[#07518a]/10 file:text-[#07518a] hover:file:bg-[#07518a]/20 cursor-pointer border border-slate-300 rounded-xl bg-white p-1"
                        />
                        {educationFile && <p className="text-[11px] font-bold text-emerald-600 mt-1">✓ Attached: {educationFile.name}</p>}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Permanent & Current Residential Address *</label>
                      <textarea
                        rows={3}
                        required
                        placeholder="House No, Street, City, State, Pincode"
                        value={currentAddress}
                        onChange={(e) => setCurrentAddress(e.target.value)}
                        className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white focus:border-[#07518a] focus:ring-2 focus:ring-[#07518a]/20 outline-none text-slate-900 placeholder:text-slate-400 resize-none"
                      />
                    </div>
                  </div>
                </div>

              </div>

              {/* RIGHT COLUMN: Bank, Emergency Info & Payslips */}
              <div className="space-y-8">
                
                {/* CARD 3: Salary Disbursement Bank Account Details */}
                <div className="space-y-5 bg-slate-50/70 p-6 sm:p-7 rounded-2xl border border-slate-200/80 shadow-xs hover:border-[#07518a]/30 transition-all">
                  <h3 className="text-xs font-black uppercase tracking-wider text-[#07518a] flex items-center gap-2 border-b border-slate-200 pb-3">
                    <span className="w-6 h-6 rounded-full bg-[#07518a] text-white text-[11px] flex items-center justify-center font-bold">3</span>
                    <span>Bank Account & Passbook / Cheque Upload</span>
                  </h3>

                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Bank Name *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. HDFC Bank / ICICI / SBI"
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          className="w-full text-xs font-bold px-3.5 py-3 rounded-xl border border-slate-300 bg-white focus:border-[#07518a] focus:ring-2 focus:ring-[#07518a]/20 outline-none text-slate-900 placeholder:text-slate-400"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">IFSC Code *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. HDFC0001234"
                          value={ifscCode}
                          onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                          className="w-full text-xs font-mono font-bold px-3.5 py-3 rounded-xl border border-slate-300 bg-white focus:border-[#07518a] focus:ring-2 focus:ring-[#07518a]/20 outline-none text-slate-900 placeholder:text-slate-400 uppercase"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Bank Account Number *</label>
                      <input
                        type="text"
                        required
                        placeholder="Account Number"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        className="w-full text-xs font-mono font-bold px-3.5 py-3 rounded-xl border border-slate-300 bg-white focus:border-[#07518a] focus:ring-2 focus:ring-[#07518a]/20 outline-none text-slate-900 placeholder:text-slate-400 mb-2"
                      />
                      <label className="block text-[11px] font-extrabold text-slate-600 mb-1">Upload Cancelled Cheque / Bank Passbook Image (PNG, JPG, JPEG, PDF) *</label>
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/jpg, application/pdf"
                          onChange={(e) => handleFileUpload(e, setBankFile)}
                          className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:bg-[#07518a]/10 file:text-[#07518a] hover:file:bg-[#07518a]/20 cursor-pointer border border-slate-300 rounded-xl bg-white p-1"
                        />
                        {bankFile && <p className="text-[11px] font-bold text-emerald-600 mt-1">✓ Attached: {bankFile.name}</p>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* CARD 4: Emergency Contact Details & Passport Photo Upload */}
                <div className="space-y-5 bg-slate-50/70 p-6 sm:p-7 rounded-2xl border border-slate-200/80 shadow-xs hover:border-[#07518a]/30 transition-all">
                  <h3 className="text-xs font-black uppercase tracking-wider text-[#07518a] flex items-center gap-2 border-b border-slate-200 pb-3">
                    <span className="w-6 h-6 rounded-full bg-[#07518a] text-white text-[11px] flex items-center justify-center font-bold">4</span>
                    <span>Emergency Contact & Passport Photograph</span>
                  </h3>

                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Contact Person Full Name *</label>
                        <input
                          type="text"
                          required
                          placeholder="Contact Name"
                          value={emergencyName}
                          onChange={(e) => setEmergencyName(e.target.value)}
                          className="w-full text-xs font-bold px-3.5 py-3 rounded-xl border border-slate-300 bg-white focus:border-[#07518a] focus:ring-2 focus:ring-[#07518a]/20 outline-none text-slate-900 placeholder:text-slate-400"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Relationship *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Father / Spouse / Mother"
                          value={emergencyRel}
                          onChange={(e) => setEmergencyRel(e.target.value)}
                          className="w-full text-xs font-bold px-3.5 py-3 rounded-xl border border-slate-300 bg-white focus:border-[#07518a] focus:ring-2 focus:ring-[#07518a]/20 outline-none text-slate-900 placeholder:text-slate-400"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Contact Phone Number *</label>
                      <input
                        type="tel"
                        required
                        placeholder="10-digit Phone Number"
                        value={emergencyPhone}
                        onChange={(e) => setEmergencyPhone(e.target.value)}
                        className="w-full text-xs font-mono font-bold px-3.5 py-3 rounded-xl border border-slate-300 bg-white focus:border-[#07518a] focus:ring-2 focus:ring-[#07518a]/20 outline-none text-slate-900 placeholder:text-slate-400 mb-2"
                      />
                      <label className="block text-[11px] font-extrabold text-slate-600 mb-1">Upload Passport Size Photograph (PNG, JPG, JPEG) *</label>
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/jpg"
                          onChange={(e) => handleFileUpload(e, setPhotoFile)}
                          className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:bg-[#07518a]/10 file:text-[#07518a] hover:file:bg-[#07518a]/20 cursor-pointer border border-slate-300 rounded-xl bg-white p-1"
                        />
                        {photoFile && <p className="text-[11px] font-bold text-emerald-600 mt-1">✓ Attached: {photoFile.name}</p>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* CARD 5: Experienced Professional - Last 3 Months Payslips (Conditional on EXPERIENCED) */}
                {candidateType === 'EXPERIENCED' && (
                  <div className="space-y-5 bg-[#07518a]/5 p-6 sm:p-7 rounded-2xl border border-[#07518a]/20 shadow-xs hover:border-[#07518a]/40 transition-all animate-fadeIn">
                    <h3 className="text-xs font-black uppercase tracking-wider text-[#07518a] flex items-center gap-2 border-b border-[#07518a]/20 pb-3">
                      <span className="w-6 h-6 rounded-full bg-[#07518a] text-white text-[11px] flex items-center justify-center font-bold">5</span>
                      <span>Previous Employment & Last 3 Months Payslips</span>
                    </h3>

                    <div className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Previous Company Name</label>
                          <input
                            type="text"
                            placeholder="Previous Company"
                            value={previousCompany}
                            onChange={(e) => setPreviousCompany(e.target.value)}
                            className="w-full text-xs font-bold px-3.5 py-3 rounded-xl border border-slate-300 bg-white focus:border-[#07518a] focus:ring-2 focus:ring-[#07518a]/20 outline-none text-slate-900 placeholder:text-slate-400"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Previous Designation</label>
                          <input
                            type="text"
                            placeholder="e.g. Senior Software Engineer"
                            value={previousDesignation}
                            onChange={(e) => setPreviousDesignation(e.target.value)}
                            className="w-full text-xs font-bold px-3.5 py-3 rounded-xl border border-slate-300 bg-white focus:border-[#07518a] focus:ring-2 focus:ring-[#07518a]/20 outline-none text-slate-900 placeholder:text-slate-400"
                          />
                        </div>
                      </div>

                      {/* 3 Months Payslips Uploads */}
                      <div>
                        <label className="block text-[11px] font-extrabold text-slate-700 mb-1">Upload Payslip Month 1 (Latest Month) *</label>
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/jpg, application/pdf"
                          onChange={(e) => handleFileUpload(e, setPayslip1File)}
                          className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:bg-[#07518a]/10 file:text-[#07518a] hover:file:bg-[#07518a]/20 cursor-pointer border border-slate-300 rounded-xl bg-white p-1 mb-2"
                        />
                        {payslip1File && <p className="text-[11px] font-bold text-emerald-600 mb-3">✓ Attached Month 1: {payslip1File.name}</p>}

                        <label className="block text-[11px] font-extrabold text-slate-700 mb-1">Upload Payslip Month 2 *</label>
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/jpg, application/pdf"
                          onChange={(e) => handleFileUpload(e, setPayslip2File)}
                          className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:bg-[#07518a]/10 file:text-[#07518a] hover:file:bg-[#07518a]/20 cursor-pointer border border-slate-300 rounded-xl bg-white p-1 mb-2"
                        />
                        {payslip2File && <p className="text-[11px] font-bold text-emerald-600 mb-3">✓ Attached Month 2: {payslip2File.name}</p>}

                        <label className="block text-[11px] font-extrabold text-slate-700 mb-1">Upload Payslip Month 3 *</label>
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/jpg, application/pdf"
                          onChange={(e) => handleFileUpload(e, setPayslip3File)}
                          className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:bg-[#07518a]/10 file:text-[#07518a] hover:file:bg-[#07518a]/20 cursor-pointer border border-slate-300 rounded-xl bg-white p-1"
                        />
                        {payslip3File && <p className="text-[11px] font-bold text-emerald-600 mt-1">✓ Attached Month 3: {payslip3File.name}</p>}
                      </div>
                    </div>
                  </div>
                )}

              </div>

            </div>

            {/* SUBMIT BUTTON WITH MANDATORY VALIDATION LOCK */}
            <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-xs font-bold text-slate-500">
                {!isFormValid ? (
                  <span className="text-amber-600 flex items-center gap-1.5">
                    <span>🔒</span>
                    <span>
                      {candidateType === 'EXPERIENCED' 
                        ? 'Please fill all required text details & upload 5 base documents plus last 3 months payslips.' 
                        : 'Please fill all required text details & upload all 5 base document files.'}
                    </span>
                  </span>
                ) : (
                  <span className="text-emerald-600 flex items-center gap-1.5">
                    <span>✅</span>
                    <span>All required details & document files completed! Ready for submission.</span>
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={!isFormValid || submitting}
                className={`px-10 py-4 font-extrabold text-sm rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 ${
                  isFormValid && !submitting
                    ? 'bg-[#07518a] hover:bg-[#064270] text-white cursor-pointer shadow-md shadow-[#07518a]/25'
                    : 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed shadow-none'
                }`}
              >
                {submitting ? 'Submitting Onboarding Details...' : '🚀 Submit Onboarding Details'}
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
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-[#07518a] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <CandidateOnboardingPortalContent />
    </Suspense>
  );
}
