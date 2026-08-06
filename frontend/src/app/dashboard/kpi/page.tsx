'use client';

import React, { useState, useEffect } from 'react';

export default function KPIDashboardPage() {
  const [timeRange, setTimeRange] = useState<'today' | 'this_month' | 'year'>('this_month');

  // Exact data mapping matching reference screenshot
  const [kpiData, setKpiData] = useState({
    approvalStatus: {
      requested: 265,
      requestedDiff: '+ 12 vs yesterday',
      approved: 2,
      approvedDiff: '- 6 vs yesterday',
      rejected: 4,
      rejectedDiff: '- 2 vs yesterday',
      pending: 18,
      pendingDiff: '- 6 vs yesterday',
    },
    overtimeSummary: {
      overtimeHours: 42,
      hoursDiff: '+ 12 vs yesterday',
      compensation: 5,
      compDiff: '+ 12 vs yesterday',
      avgOvertime: 21,
      avgDiff: '- 2 vs yesterday',
      byJobTitle: 21,
      jobDiff: '- 6 vs yesterday',
    },
    statusPills: {
      onHold: 8,
      onHoldTrend: '1.2% vs last month',
      rejected: 17,
      rejectedTrend: '0.3% vs last month',
      completed: 301,
      completedTrend: '2.9% vs last month',
      canceled: 23,
      canceledTrend: '0.1% vs last month',
    },
    workforceMetrics: {
      totalEmployees: 25,
      activeEmployees: 15,
      inactiveEmployees: 6,
      todayLogins: 4,
    },
    projectPerformance: {
      totalProjects: 1950,
      totalProjectsTrend: '2.50%',
      activeProjects: 49,
      activeProjectsTrend: '2.50%',
      dueTasks: 120,
      dueTasksTrend: '5.80%',
      productivity: 1950,
      productivityTrend: '4.60%',
      members: 110,
      membersTrend: '2.70%',
    },
    taskProgress: {
      totalTasks: 128,
      completedTasks: 82,
      inProgressTasks: 25,
      overdueTasks: 12,
      pendingTasks: 9,
      completionRate: 64,
    }
  });

  useEffect(() => {
    const fetchRealData = async () => {
      try {
        const token = localStorage.getItem('access_token');
        const companyId = localStorage.getItem('companyId');
        const headers = { 'Authorization': `Bearer ${token}` };
        const q = companyId ? `?company_id=${companyId}` : '';

        const empRes = await fetch(`http://localhost:5000/api/v1/employees${q}`, { headers });
        if (empRes.ok) {
          const empData = await empRes.json();
          const list = empData.employees || empData || [];
          if (Array.isArray(list) && list.length > 0) {
            const total = list.length;
            const active = list.filter((e: any) => (e.status || 'ACTIVE') === 'ACTIVE').length;
            const inactive = total - active;
            setKpiData(prev => ({
              ...prev,
              workforceMetrics: {
                ...prev.workforceMetrics,
                totalEmployees: total,
                activeEmployees: active,
                inactiveEmployees: inactive,
              }
            }));
          }
        }
      } catch (err) {
        console.error('Error loading KPI data:', err);
      }
    };
    fetchRealData();
  }, []);

  return (
    <div style={{ fontFamily: '"DM Sans", sans-serif' }} className="min-h-full bg-[#f4f7fc] dark:bg-slate-950 px-6 sm:px-10 py-8 space-y-6">
      
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-5 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-sm">
            📊
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">KPI Dashboard</h1>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
              Real-time enterprise metrics & organizational performance scorecards.
            </p>
          </div>
        </div>

        {/* Time Selector */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700">
          {[
            { id: 'today', label: 'Today' },
            { id: 'this_month', label: 'This Month' },
            { id: 'year', label: 'This Year' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setTimeRange(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                timeRange === tab.id
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-black'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ROW 1: TWO BIG MULTI-METRIC SUMMARY CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Panel 1: Approval Status */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-2xl p-6 shadow-2xs space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Approval Status</h3>
            </div>
            <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-sm tracking-widest">•••</button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <span className="text-xs font-semibold text-slate-400 block">Requested</span>
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-outfit mt-0.5 block">{kpiData.approvalStatus.requested}</span>
              <span className="text-[11px] font-semibold text-blue-500 block mt-1">{kpiData.approvalStatus.requestedDiff}</span>
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-400 block">Approved</span>
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-outfit mt-0.5 block">{kpiData.approvalStatus.approved}</span>
              <span className="text-[11px] font-semibold text-rose-500 block mt-1">{kpiData.approvalStatus.approvedDiff}</span>
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-400 block">Rejected</span>
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-outfit mt-0.5 block">{kpiData.approvalStatus.rejected}</span>
              <span className="text-[11px] font-semibold text-rose-500 block mt-1">{kpiData.approvalStatus.rejectedDiff}</span>
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-400 block">Pending</span>
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-outfit mt-0.5 block">{kpiData.approvalStatus.pending}</span>
              <span className="text-[11px] font-semibold text-rose-500 block mt-1">{kpiData.approvalStatus.pendingDiff}</span>
            </div>
          </div>
        </div>

        {/* Panel 2: Overtime Hours summary */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-2xl p-6 shadow-2xs space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Overtime Hours summary</h3>
            </div>
            <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-sm tracking-widest">•••</button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <span className="text-xs font-semibold text-slate-400 block">Overtime Hours</span>
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-outfit mt-0.5 block">{kpiData.overtimeSummary.overtimeHours}</span>
              <span className="text-[11px] font-semibold text-blue-500 block mt-1">{kpiData.overtimeSummary.hoursDiff}</span>
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-400 block">Compensation</span>
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-outfit mt-0.5 block">{kpiData.overtimeSummary.compensation}</span>
              <span className="text-[11px] font-semibold text-blue-500 block mt-1">{kpiData.overtimeSummary.compDiff}</span>
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-400 block">Average Overtime</span>
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-outfit mt-0.5 block">{kpiData.overtimeSummary.avgOvertime}</span>
              <span className="text-[11px] font-semibold text-rose-500 block mt-1">{kpiData.overtimeSummary.avgDiff}</span>
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-400 block">Overtime by Job Title</span>
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-outfit mt-0.5 block">{kpiData.overtimeSummary.byJobTitle}</span>
              <span className="text-[11px] font-semibold text-rose-500 block mt-1">{kpiData.overtimeSummary.jobDiff}</span>
            </div>
          </div>
        </div>

      </div>

      {/* ROW 2: FOUR HORIZONTAL STATUS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* On hold */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5 rounded-2xl shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 border border-blue-100 dark:border-blue-900/40 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
              </svg>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-400 block">On hold</span>
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white font-outfit">{kpiData.statusPills.onHold}</span>
            </div>
          </div>
          <span className="text-xs font-semibold text-rose-500 flex items-center gap-0.5">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 4.5l-15 15m0 0h11.25m-11.25 0V8.25" /></svg>
            {kpiData.statusPills.onHoldTrend}
          </span>
        </div>

        {/* Rejected */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5 rounded-2xl shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-500 border border-rose-100 dark:border-rose-900/40 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-400 block">Rejected</span>
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white font-outfit">{kpiData.statusPills.rejected}</span>
            </div>
          </div>
          <span className="text-xs font-semibold text-rose-500 flex items-center gap-0.5">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 4.5l-15 15m0 0h11.25m-11.25 0V8.25" /></svg>
            {kpiData.statusPills.rejectedTrend}
          </span>
        </div>

        {/* Completed */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5 rounded-2xl shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 border border-teal-100 dark:border-teal-900/40 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-400 block">Completed</span>
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white font-outfit">{kpiData.statusPills.completed}</span>
            </div>
          </div>
          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-0.5">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" /></svg>
            {kpiData.statusPills.completedTrend}
          </span>
        </div>

        {/* Canceled */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5 rounded-2xl shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-600 border border-orange-100 dark:border-orange-900/40 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-400 block">Canceled</span>
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white font-outfit">{kpiData.statusPills.canceled}</span>
            </div>
          </div>
          <span className="text-xs font-semibold text-rose-500 flex items-center gap-0.5">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 4.5l-15 15m0 0h11.25m-11.25 0V8.25" /></svg>
            {kpiData.statusPills.canceledTrend}
          </span>
        </div>

      </div>

      {/* ROW 3: SOFT PASTEL COLORED WORKFORCE CARDS (Exactly like reference screenshot) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Total Customers */}
        <div className="bg-[#eef2ff] dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 p-6 rounded-2xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Total Customers</span>
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-outfit mt-1 block">
              {kpiData.workforceMetrics.totalEmployees.toString().padStart(2, '0')}
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-indigo-200/70 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          </div>
        </div>

        {/* Active Customers */}
        <div className="bg-[#e6fffa] dark:bg-teal-950/30 border border-teal-100 dark:border-teal-900/40 p-6 rounded-2xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Active Customers</span>
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-outfit mt-1 block">
              {kpiData.workforceMetrics.activeEmployees.toString().padStart(2, '0')}
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-teal-200/70 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
        </div>

        {/* Inactive Customers */}
        <div className="bg-[#fff1f2] dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40 p-6 rounded-2xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Inactive Customers</span>
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-outfit mt-1 block">
              {kpiData.workforceMetrics.inactiveEmployees.toString().padStart(2, '0')}
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-rose-200/70 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M22 10.5h-6m-2.25-4.125a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM2.25 19.5a7.5 7.5 0 0114.998 0A17.933 17.933 0 019.75 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
        </div>

        {/* Contacts Login In */}
        <div className="bg-[#f0f9ff] dark:bg-sky-950/30 border border-sky-100 dark:border-sky-900/40 p-6 rounded-2xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Contacts Login In</span>
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-outfit mt-1 block">
              {kpiData.workforceMetrics.todayLogins.toString().padStart(2, '0')}
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-sky-200/70 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
          </div>
        </div>

      </div>

      {/* ROW 4: FIVE VERTICAL ICON CARDS WITH DOTTED LINES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
        
        {/* Total Projects */}
        <div className="bg-[#eef2ff] dark:bg-slate-900 border border-indigo-100/90 dark:border-slate-800 p-6 rounded-2xl shadow-2xs flex flex-col items-center text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l4.179 2.25m-4.179-2.25l4.179-2.25m4.179 6.75l4.179-2.25m-4.179 2.25l-4.179-2.25m4.179 2.25l4.179 2.25M6.429 14.25l4.179 2.25m0-4.5l4.179 2.25" />
            </svg>
          </div>
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">Total Projects</span>
            <span className="text-3xl font-black text-indigo-700 dark:text-indigo-300 font-outfit mt-1 block">{kpiData.projectPerformance.totalProjects}</span>
          </div>
          <div className="w-full border-t border-dashed border-slate-300 dark:border-slate-700 pt-2 flex justify-between items-center text-xs text-slate-500 font-medium">
            <span>This Month</span>
            <span className="text-blue-600 dark:text-blue-400 font-black flex items-center gap-0.5">
              {kpiData.projectPerformance.totalProjectsTrend}
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" /></svg>
            </span>
          </div>
        </div>

        {/* Active Projects */}
        <div className="bg-[#e6fffa] dark:bg-slate-900 border border-teal-100/90 dark:border-slate-800 p-6 rounded-2xl shadow-2xs flex flex-col items-center text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-teal-500 text-white flex items-center justify-center shadow-md shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
            </svg>
          </div>
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">Active Projects</span>
            <span className="text-3xl font-black text-teal-700 dark:text-teal-300 font-outfit mt-1 block">{kpiData.projectPerformance.activeProjects}</span>
          </div>
          <div className="w-full border-t border-dashed border-slate-300 dark:border-slate-700 pt-2 flex justify-between items-center text-xs text-slate-500 font-medium">
            <span>Completed</span>
            <span className="text-blue-600 dark:text-blue-400 font-black flex items-center gap-0.5">
              {kpiData.projectPerformance.activeProjectsTrend}
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" /></svg>
            </span>
          </div>
        </div>

        {/* Due Tasks */}
        <div className="bg-[#fefce8] dark:bg-slate-900 border border-amber-100/90 dark:border-slate-800 p-6 rounded-2xl shadow-2xs flex flex-col items-center text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">Due Tasks</span>
            <span className="text-3xl font-black text-amber-600 dark:text-amber-400 font-outfit mt-1 block">{kpiData.projectPerformance.dueTasks}</span>
          </div>
          <div className="w-full border-t border-dashed border-slate-300 dark:border-slate-700 pt-2 flex justify-between items-center text-xs text-slate-500 font-medium">
            <span>Incomplete</span>
            <span className="text-rose-500 font-black flex items-center gap-0.5">
              {kpiData.projectPerformance.dueTasksTrend}
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 4.5l-15 15m0 0h11.25m-11.25 0V8.25" /></svg>
            </span>
          </div>
        </div>

        {/* Productivity */}
        <div className="bg-[#fff7ed] dark:bg-slate-900 border border-orange-100/90 dark:border-slate-800 p-6 rounded-2xl shadow-2xs flex flex-col items-center text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-orange-500 text-white flex items-center justify-center shadow-md shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">Productivity</span>
            <span className="text-3xl font-black text-orange-600 dark:text-orange-400 font-outfit mt-1 block">{kpiData.projectPerformance.productivity}</span>
          </div>
          <div className="w-full border-t border-dashed border-slate-300 dark:border-slate-700 pt-2 flex justify-between items-center text-xs text-slate-500 font-medium">
            <span>Increase</span>
            <span className="text-blue-600 dark:text-blue-400 font-black flex items-center gap-0.5">
              {kpiData.projectPerformance.productivityTrend}
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" /></svg>
            </span>
          </div>
        </div>

        {/* Members */}
        <div className="bg-[#f0f9ff] dark:bg-slate-900 border border-sky-100/90 dark:border-slate-800 p-6 rounded-2xl shadow-2xs flex flex-col items-center text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-sky-500 text-white flex items-center justify-center shadow-md shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          </div>
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">Members</span>
            <span className="text-3xl font-black text-[#0284c7] dark:text-sky-300 font-outfit mt-1 block">{kpiData.projectPerformance.members}</span>
          </div>
          <div className="w-full border-t border-dashed border-slate-300 dark:border-slate-700 pt-2 flex justify-between items-center text-xs text-slate-500 font-medium">
            <span>Leads</span>
            <span className="text-rose-500 font-black flex items-center gap-0.5">
              {kpiData.projectPerformance.membersTrend}
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 4.5l-15 15m0 0h11.25m-11.25 0V8.25" /></svg>
            </span>
          </div>
        </div>

      </div>

      {/* ROW 5: TASK PROGRESS GRID (Bottom row in screenshot) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5">
        
        {/* Total Tasks */}
        <div className="bg-[#eef2ff] dark:bg-slate-900 border border-indigo-100/90 dark:border-slate-800 p-5 rounded-2xl shadow-2xs space-y-2">
          <span className="text-3xl font-black text-indigo-700 dark:text-indigo-300 font-outfit block">{kpiData.taskProgress.totalTasks}</span>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Total Tasks</span>
          <p className="text-[11px] text-slate-400 leading-tight">Total number of tasks created in the system.</p>
        </div>

        {/* Completed Tasks */}
        <div className="bg-[#e6fffa] dark:bg-slate-900 border border-teal-100/90 dark:border-slate-800 p-5 rounded-2xl shadow-2xs space-y-2">
          <span className="text-3xl font-black text-teal-700 dark:text-teal-300 font-outfit block">{kpiData.taskProgress.completedTasks}</span>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Completed Tasks</span>
          <p className="text-[11px] text-slate-400 leading-tight">Tasks successfully finished before due date.</p>
        </div>

        {/* In Progress Tasks */}
        <div className="bg-[#fefce8] dark:bg-slate-900 border border-amber-100/90 dark:border-slate-800 p-5 rounded-2xl shadow-2xs space-y-2">
          <span className="text-3xl font-black text-amber-700 dark:text-amber-300 font-outfit block">{kpiData.taskProgress.inProgressTasks}</span>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">In Progress Tasks</span>
          <p className="text-[11px] text-slate-400 leading-tight">Tasks currently being worked on by members.</p>
        </div>

        {/* Overdue Tasks */}
        <div className="bg-[#fff1f2] dark:bg-slate-900 border border-rose-100/90 dark:border-slate-800 p-5 rounded-2xl shadow-2xs space-y-2">
          <span className="text-3xl font-black text-rose-700 dark:text-rose-300 font-outfit block">{kpiData.taskProgress.overdueTasks}</span>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Overdue Tasks</span>
          <p className="text-[11px] text-slate-400 leading-tight">Tasks not completed by their due date.</p>
        </div>

        {/* Pending Tasks */}
        <div className="bg-[#fff7ed] dark:bg-slate-900 border border-orange-100/90 dark:border-slate-800 p-5 rounded-2xl shadow-2xs space-y-2">
          <span className="text-3xl font-black text-orange-700 dark:text-orange-300 font-outfit block">{kpiData.taskProgress.pendingTasks}</span>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Pending Tasks</span>
          <p className="text-[11px] text-slate-400 leading-tight">Tasks not yet started or assigned.</p>
        </div>

        {/* Completion Rate(%) */}
        <div className="bg-[#f0f9ff] dark:bg-slate-900 border border-sky-100/90 dark:border-slate-800 p-5 rounded-2xl shadow-2xs space-y-2">
          <span className="text-3xl font-black text-[#0284c7] dark:text-sky-300 font-outfit block">{kpiData.taskProgress.completionRate}%</span>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Completion Rate(%)</span>
          <p className="text-[11px] text-slate-400 leading-tight">Percentage of completed tasks out of total.</p>
        </div>

      </div>

    </div>
  );
}
