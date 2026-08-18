'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function JobDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Apply Form State
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    company_id: ''
  });
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchJobDetails();
  }, [id]);

  const fetchJobDetails = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`/api/v1/recruitment/jobs/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setJob(data);
        setFormData(prev => ({ ...prev, company_id: data.company_id }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const token = localStorage.getItem('access_token');
      
      const submitData = new FormData();
      submitData.append('first_name', formData.first_name);
      submitData.append('last_name', formData.last_name);
      submitData.append('email', formData.email);
      submitData.append('phone', formData.phone);
      submitData.append('company_id', formData.company_id);
      if (resumeFile) {
        submitData.append('resume', resumeFile);
      }

      const res = await fetch(`/api/v1/recruitment/jobs/${id}/apply`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`
        },
        body: submitData
      });
      if (res.ok) {
        setSuccess(true);
        setShowApplyForm(false);
      }
    } catch (err) {
      console.error('Failed to apply', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px] h-full bg-slate-50/50 dark:bg-slate-950 font-['DM_Sans',sans-serif]">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-semibold text-slate-400">Loading job details...</span>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] h-full bg-slate-50/50 dark:bg-slate-950 font-['DM_Sans',sans-serif] p-6">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Job Opening Not Found</h2>
        <p className="text-xs text-slate-500 mb-4">This position may have been closed or relocated.</p>
        <button onClick={() => router.push('/dashboard/careers')} className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold">
          Back to Careers
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 overflow-y-auto custom-scrollbar font-['DM_Sans',sans-serif] p-6 space-y-6">
      
      {/* HEADER CARD - CLEAN WHITE FULL WIDTH */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col space-y-4">
        
        {/* TOP BAR */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button 
            onClick={() => router.push('/dashboard/careers')} 
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            <span>Back to All Openings</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-wider">
              {job.department_name || 'General'}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold">
              CODE: {job.job_code || 'JOB-001'}
            </span>
            {job.status === 'PUBLISHED' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Actively Hiring
              </span>
            )}
          </div>
        </div>

        {/* TITLE & ACTION */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white tracking-tight">
              {job.title}
            </h1>

            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500 dark:text-slate-400 mt-2">
              <span className="inline-flex items-center gap-1">
                <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                {job.work_mode || 'Remote'}
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1">
                <svg className="w-3.5 h-3.5 text-purple-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                {job.employment_type || 'Full-Time'}
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                {job.currency || 'INR'} {job.min_salary ? `${(job.min_salary/1000).toFixed(0)}k` : 'Negotiable'} {job.max_salary ? `- ${(job.max_salary/1000).toFixed(0)}k` : ''}
              </span>
            </div>
          </div>

          <button 
            onClick={() => setShowApplyForm(true)}
            disabled={job.status === 'CLOSED'}
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-slate-300 disabled:to-slate-400 text-white font-black rounded-xl text-xs shadow-md shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer shrink-0"
          >
            {job.status === 'CLOSED' ? 'Position Closed' : 'Apply For This Position'} &rarr;
          </button>
        </div>
      </div>

      {/* QUICK METRICS ROW */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block mb-0.5">Experience</span>
          <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{job.minimum_experience_years || 0}+ Years</span>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block mb-0.5">Work Mode</span>
          <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{job.work_mode || 'Remote'}</span>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block mb-0.5">Employment Type</span>
          <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{job.employment_type || 'Full-Time'}</span>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block mb-0.5">Posted On</span>
          <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{new Date(job.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        </div>
      </div>

      {/* MAIN 2-COLUMN SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: DESCRIPTION */}
        <div className="lg:col-span-2 space-y-6">
          
          {success && (
            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 p-4 rounded-xl flex items-center gap-3 animate-fadeIn">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-bold text-sm shrink-0">
                ✓
              </div>
              <div>
                <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-300">Application Submitted!</h4>
                <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  Your application for {job.title} has been received successfully.
                </p>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-slate-800 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800 uppercase tracking-wider">
              Job Description
            </h3>

            <div className="text-xs md:text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
              {job.description || 'No detailed description provided.'}
            </div>

            {/* PERKS & BENEFITS */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3">Perks & Key Benefits</h4>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 text-xs font-semibold text-slate-700 dark:text-slate-300">🏥 Health Insurance</span>
                <span className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 text-xs font-semibold text-slate-700 dark:text-slate-300">🏡 Flexible Work Environment</span>
                <span className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 text-xs font-semibold text-slate-700 dark:text-slate-300">📈 Annual Performance Bonus</span>
                <span className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 text-xs font-semibold text-slate-700 dark:text-slate-300">🎓 Paid Certifications</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: SIDEBAR */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm sticky top-6 space-y-4">
            <h3 className="text-sm font-black text-slate-800 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800 uppercase tracking-wider">
              Job Summary
            </h3>

            <div className="space-y-3 text-xs font-semibold">
              <div className="flex justify-between items-center py-1 border-b border-slate-50 dark:border-slate-800">
                <span className="text-slate-400">Department</span>
                <span className="font-bold text-slate-700 dark:text-slate-200">{job.department_name || 'General'}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-50 dark:border-slate-800">
                <span className="text-slate-400">Experience</span>
                <span className="font-bold text-slate-700 dark:text-slate-200">{job.minimum_experience_years || 0}+ Years</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-50 dark:border-slate-800">
                <span className="text-slate-400">Salary Range</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {job.currency || 'INR'} {job.min_salary ? `${(job.min_salary/1000).toFixed(0)}k` : 'Negotiable'} {job.max_salary ? `- ${(job.max_salary/1000).toFixed(0)}k` : ''}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-50 dark:border-slate-800">
                <span className="text-slate-400">Employment Type</span>
                <span className="font-bold text-slate-700 dark:text-slate-200">{job.employment_type || 'Full-Time'}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">Location</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">{job.work_mode || 'Remote'}</span>
              </div>
            </div>

            <button 
              onClick={() => setShowApplyForm(true)}
              disabled={job.status === 'CLOSED'}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-slate-300 disabled:to-slate-400 text-white font-black rounded-xl text-xs tracking-wider uppercase shadow-md shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer"
            >
              {job.status === 'CLOSED' ? 'Position Closed' : 'Apply For Position'}
            </button>
          </div>
        </div>
      </div>

      {/* APPLY MODAL */}
      {showApplyForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <div>
                <h2 className="text-base font-black text-slate-800 dark:text-white">Apply for {job.title}</h2>
                <p className="text-xs text-slate-400 font-medium">Please provide your details below</p>
              </div>
              <button onClick={() => setShowApplyForm(false)} className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors cursor-pointer">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <form onSubmit={handleApply} className="p-6 overflow-y-auto custom-scrollbar space-y-4 flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">First Name *</label>
                  <input type="text" required value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="John" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Last Name *</label>
                  <input type="text" required value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="Doe" />
                </div>
              </div>
              
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Email Address *</label>
                <input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="john@example.com" />
              </div>
              
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Phone Number *</label>
                <input type="tel" required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="+91 9876543210" />
              </div>
              
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Resume / CV Document</label>
                <input type="file" accept=".pdf,.doc,.docx" onChange={e => setResumeFile(e.target.files?.[0] || null)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-black file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
              </div>
              
              <div className="pt-3">
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white py-3 rounded-xl text-xs font-black tracking-wider uppercase shadow-md shadow-indigo-500/20 transition-all flex justify-center items-center gap-2 cursor-pointer"
                >
                  {submitting ? (
                    <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Submitting...</>
                  ) : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
