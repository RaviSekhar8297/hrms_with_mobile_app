'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardCareersPortal() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch('/api/v1/recruitment/jobs', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setJobs(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const departments = ['All', ...Array.from(new Set(jobs.map(j => j.department_name || 'Other')))];

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.title.toLowerCase().includes(searchQuery.toLowerCase()) || job.job_code?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = selectedDepartment === 'All' || (job.department_name || 'Other') === selectedDepartment;
    return matchesSearch && matchesDept;
  });

  return (
    <div className="flex flex-col h-full bg-slate-50/60 dark:bg-slate-950 overflow-hidden font-['DM_Sans',sans-serif]">
      
      {/* HEADER */}
      <div className="flex-shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 px-6 py-5 z-10 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Internal Careers Portal</h1>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider">
            Explore and Preview Active Job Postings
          </p>
        </div>
        
        {/* SEARCH BAR */}
        <div className="flex w-full md:w-auto bg-slate-50 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center px-3 w-full">
            <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input 
              type="text" 
              placeholder="Search jobs by title or code..." 
              className="bg-transparent border-none py-1.5 px-2 text-xs font-semibold focus:outline-none focus:ring-0 text-slate-800 dark:text-white placeholder-slate-400 w-full md:w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* CONTENT AREA */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
        
        {/* DEPARTMENT FILTER */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {departments.map((dept) => (
            <button 
              key={dept}
              onClick={() => setSelectedDepartment(dept as string)}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                selectedDepartment === dept 
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20' 
                  : 'bg-white text-slate-600 border border-slate-200/80 hover:border-slate-300 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800'
              }`}
            >
              {dept}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          /* JOB LISTINGS GRID */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-12">
            {filteredJobs.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800">
                <p className="text-slate-500 dark:text-slate-400 font-bold text-sm">No jobs found matching your criteria.</p>
              </div>
            ) : filteredJobs.map((job, idx) => (
              <div 
                key={job.id} 
                onClick={() => router.push(`/dashboard/careers/${job.id}`)}
                className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/10 group flex flex-col relative overflow-hidden cursor-pointer"
                style={{animationDelay: `${idx * 50}ms`}}
              >
                {job.status === 'CLOSED' && (
                  <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center rounded-3xl">
                    <span className="px-4 py-1.5 bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-400 font-black tracking-widest text-xs rounded-xl uppercase border border-rose-200 dark:border-rose-800 shadow-md">Closed</span>
                  </div>
                )}

                <div className="flex justify-between items-start mb-4 relative z-0">
                  <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60 rounded-lg text-[10px] uppercase font-black tracking-wider">
                    {job.department_name || 'General'}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 rounded-lg text-[10px] font-black tracking-wider border border-blue-200/60">
                      <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                      <span>{job.applications_count || 0} Applied</span>
                    </span>

                    {job.status === 'PUBLISHED' && (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 rounded-lg text-[10px] font-black uppercase tracking-wider border border-emerald-200/60">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div> Active
                      </span>
                    )}
                    {job.status === 'DRAFT' && (
                      <span className="px-2.5 py-1 bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 rounded-lg text-[10px] font-black uppercase tracking-wider border border-amber-200/60">
                        Draft
                      </span>
                    )}
                  </div>
                </div>

                <h3 className="text-xl font-black text-slate-800 dark:text-white mb-1 leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors relative z-0">
                  {job.title}
                </h3>
                <p className="text-[11px] font-bold text-slate-400 mb-4 font-mono relative z-0">{job.job_code || job.id.substring(0,8)}</p>
                
                <div className="grid grid-cols-2 gap-3 mb-4 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 flex-1 relative z-0">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-black text-slate-400 mb-0.5">Location</p>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      {job.work_mode || 'On-site'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-black text-slate-400 mb-0.5">Job Type</p>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 text-purple-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {job.employment_type || 'Full-Time'}
                    </p>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800 relative z-0">
                  <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                    {job.min_salary ? `${job.currency || 'INR'} ${(job.min_salary/1000).toFixed(0)}k${job.max_salary ? ` - ${(job.max_salary/1000).toFixed(0)}k` : ''}` : 'Competitive'}
                  </span>
                  <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                    View Details &rarr;
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
