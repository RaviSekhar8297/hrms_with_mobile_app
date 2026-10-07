'use client';

import React, { useState } from 'react';
import DashboardPageHeader from '../components/DashboardPageHeader';
import { useDashboard } from '../components/DashboardContext';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

export default function AnalyticsPage() {
  const { showToast, companyId } = useDashboard();
  const [timeRange, setTimeRange] = useState<'30D' | 'QTD' | 'YTD' | '12M'>('12M');
  const [activeChartTab, setActiveChartTab] = useState<'payroll' | 'hiring'>('payroll');
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  // Toggle visible layers in payroll chart
  const [payrollLayers, setPayrollLayers] = useState({
    base: true,
    bonus: true,
    statutory: true,
  });

  const toggleLayer = (layer: 'base' | 'bonus' | 'statutory') => {
    setPayrollLayers(prev => ({ ...prev, [layer]: !prev[layer] }));
  };

  const handleExport = (format: string) => {
    showToast(`Executive Analytics report exported (${format}) successfully!`, 'success');
  };

  // 12-Month Dual Data: Hired vs Exited
  const hiringData = [
    { month: 'Jan', hired: 65, exited: 12 },
    { month: 'Feb', hired: 48, exited: 8 },
    { month: 'Mar', hired: 52, exited: 10 },
    { month: 'Apr', hired: 70, exited: 14 },
    { month: 'May', hired: 58, exited: 9 },
    { month: 'Jun', hired: 82, exited: 11 },
    { month: 'Jul', hired: 90, exited: 15 },
    { month: 'Aug', hired: 95, exited: 12 },
    { month: 'Sep', hired: 68, exited: 10 },
    { month: 'Oct', hired: 74, exited: 11 },
    { month: 'Nov', hired: 62, exited: 8 },
    { month: 'Dec', hired: 88, exited: 14 },
  ];

  // 12-Month Payroll Trend (in Crores INR)
  const payrollTrend = [
    { month: 'Jan', base: 5.1, bonus: 0.5, statutory: 0.9 },
    { month: 'Feb', base: 5.1, bonus: 0.4, statutory: 0.9 },
    { month: 'Mar', base: 5.3, bonus: 0.7, statutory: 0.9 },
    { month: 'Apr', base: 5.2, bonus: 0.5, statutory: 0.9 },
    { month: 'May', base: 5.3, bonus: 0.6, statutory: 1.0 },
    { month: 'Jun', base: 5.4, bonus: 0.5, statutory: 1.0 },
    { month: 'Jul', base: 5.5, bonus: 0.8, statutory: 1.0 },
    { month: 'Aug', base: 5.6, bonus: 0.6, statutory: 1.0 },
    { month: 'Sep', base: 4.8, bonus: 0.5, statutory: 0.8 },
    { month: 'Oct', base: 4.9, bonus: 0.6, statutory: 0.8 },
    { month: 'Nov', base: 5.0, bonus: 0.4, statutory: 0.9 },
    { month: 'Dec', base: 5.2, bonus: 0.9, statutory: 0.9 },
  ];

  // Live Attendance Stream
  const livePunches = [
    { name: 'Ravi Sekhar', role: 'AI Lead', dept: 'Engineering', time: '09:02 AM', location: 'Hyderabad HQ', method: 'Biometric IoT', status: 'ON_TIME', initials: 'RS', color: 'from-[#07518a] to-[#0d6db8]' },
    { name: 'Ananya Sharma', role: 'Sr PM', dept: 'Product', time: '09:05 AM', location: 'Bengaluru Hub', method: 'Face Recognition', status: 'ON_TIME', initials: 'AS', color: 'from-purple-600 to-indigo-600' },
    { name: 'Praveen Kumar', role: 'Sales Mgr', dept: 'Sales', time: '09:14 AM', location: 'Mumbai Branch', method: 'Mobile GPS', status: 'LATE', initials: 'PK', color: 'from-amber-600 to-orange-600' },
    { name: 'Deepika Reddy', role: 'UI/UX Lead', dept: 'Design', time: '09:18 AM', location: 'Hyderabad HQ', method: 'Biometric IoT', status: 'ON_TIME', initials: 'DR', color: 'from-emerald-600 to-teal-600' },
    { name: 'Vikram Verma', role: 'DevOps', dept: 'Infra', time: '09:25 AM', location: 'Remote VPN', method: 'Web Punch', status: 'ON_TIME', initials: 'VV', color: 'from-sky-600 to-blue-600' },
  ];

  return (
    <div className="space-y-6 animate-fadeIn font-dmsans text-left pb-12">
      
      {/* Header with Title & Action Controls */}
      <div className="w-full">
        <DashboardPageHeader
          title="Executive Analytics & Business Intelligence"
          actionMessage=""
          actionError=""
          companies={[]}
          companyId={companyId || 'all'}
          handleCompanyChange={() => {}}
          isSuperAdmin={true}
          email="superadmin@brihaspathi.com"
          hideCompanySelect={true}
          hideUserBadge={true}
        />
      </div>

      {/* Control Bar: Timeframe Selector & Export Actions */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-card p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="h-8 w-8 rounded-xl bg-[#07518a]/10 dark:bg-[#07518a]/20 border border-[#07518a]/20 flex items-center justify-center text-[#07518a] dark:text-[#3894db]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Real-time Organization Metrics
            </h3>
            <p className="text-[11px] text-slate-400 font-medium">Cross-subsidiary workforce, financial & operational reporting</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
          {/* Timeframe Pill Switcher */}
          <div className="inline-flex rounded-xl bg-slate-100/80 dark:bg-slate-900/60 p-1 border border-slate-200/80 dark:border-slate-800">
            {(['30D', 'QTD', 'YTD', '12M'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
                  timeRange === range
                    ? 'bg-white dark:bg-slate-800 text-[#07518a] dark:text-[#3894db] shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          {/* Export Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExport('PDF')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all duration-200 cursor-pointer shadow-xs"
            >
              <svg className="w-3.5 h-3.5 text-rose-500" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <span>Export PDF</span>
            </button>
            <button
              onClick={() => handleExport('Excel')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#07518a] hover:bg-[#064270] text-white text-xs font-bold transition-all duration-200 cursor-pointer shadow-md shadow-[#07518a]/20"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* 🚀 TOP EXECUTIVE KPI STATS CARDS (6 DENSE ELEGANT CARDS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        
        {/* Card 1: Total Workforce */}
        <div
          style={{ boxShadow: 'rgba(14, 30, 37, 0.08) 0px 2px 4px 0px, rgba(14, 30, 37, 0.16) 0px 2px 12px 0px' }}
          className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-card p-4 hover:border-[#07518a]/40 hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Total Workforce
            </span>
            <div className="h-8 w-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-[#07518a] dark:text-[#3894db] flex items-center justify-center shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.72m12 0a5.971 5.971 0 00-.941-3.197M6 18.72a5.971 5.971 0 01.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 005.058 2.772m-10.116 0A9.094 9.094 0 012.25 15.52a3 3 0 014.682-2.72m0 0c.148.274.321.533.516.776M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">1,428</div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-md">
                ↑ 12.4%
              </span>
              <span className="text-[10px] text-slate-400">vs last month</span>
            </div>
          </div>
        </div>

        {/* Card 2: Gross Monthly Payroll */}
        <div
          style={{ boxShadow: 'rgba(14, 30, 37, 0.08) 0px 2px 4px 0px, rgba(14, 30, 37, 0.16) 0px 2px 12px 0px' }}
          className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-card p-4 hover:border-emerald-500/40 hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Gross Payroll
            </span>
            <div className="h-8 w-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">₹ 6.42 Cr</div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-md">
                ✓ 90.4%
              </span>
              <span className="text-[10px] text-slate-400">budget utilized</span>
            </div>
          </div>
        </div>

        {/* Card 3: Shift Attendance */}
        <div
          style={{ boxShadow: 'rgba(14, 30, 37, 0.08) 0px 2px 4px 0px, rgba(14, 30, 37, 0.16) 0px 2px 12px 0px' }}
          className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-card p-4 hover:border-indigo-500/40 hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Shift Attendance
            </span>
            <div className="h-8 w-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">96.4%</div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded-md">
                1,376 Staff
              </span>
              <span className="text-[10px] text-slate-400">checked in</span>
            </div>
          </div>
        </div>

        {/* Card 4: Leaves Today */}
        <div
          style={{ boxShadow: 'rgba(14, 30, 37, 0.08) 0px 2px 4px 0px, rgba(14, 30, 37, 0.16) 0px 2px 12px 0px' }}
          className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-card p-4 hover:border-amber-500/40 hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Absence Rate
            </span>
            <div className="h-8 w-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">2.8%</div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded-md">
                38 On Leave
              </span>
              <span className="text-[10px] text-slate-400">approved</span>
            </div>
          </div>
        </div>

        {/* Card 5: ATS Open Pipeline */}
        <div
          style={{ boxShadow: 'rgba(14, 30, 37, 0.08) 0px 2px 4px 0px, rgba(14, 30, 37, 0.16) 0px 2px 12px 0px' }}
          className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-card p-4 hover:border-purple-500/40 hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              ATS Pipeline
            </span>
            <div className="h-8 w-8 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">42 Roles</div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-purple-600 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 px-1.5 py-0.5 rounded-md">
                184 Candidates
              </span>
              <span className="text-[10px] text-slate-400">in screening</span>
            </div>
          </div>
        </div>

        {/* Card 6: Performance Rating */}
        <div
          style={{ boxShadow: 'rgba(14, 30, 37, 0.08) 0px 2px 4px 0px, rgba(14, 30, 37, 0.16) 0px 2px 12px 0px' }}
          className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-card p-4 hover:border-teal-500/40 hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Avg KPI Index
            </span>
            <div className="h-8 w-8 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
              </svg>
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">88.6%</div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 px-1.5 py-0.5 rounded-md">
                ⭐ 4.8 / 5.0
              </span>
              <span className="text-[10px] text-slate-400">overall rating</span>
            </div>
          </div>
        </div>

      </div>

      {/* 📊 SECTION 1: WORKFORCE FINANCIAL TRENDS & RECRUITMENT DYNAMICS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Main Chart Card (8 Cols) */}
        <div
          style={{ boxShadow: 'rgba(14, 30, 37, 0.08) 0px 2px 4px 0px, rgba(14, 30, 37, 0.2) 0px 2px 14px 0px' }}
          className="lg:col-span-8 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-card p-6 flex flex-col justify-between space-y-4"
        >
          {/* Chart Header & Toggles */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#07518a] animate-pulse" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                  {activeChartTab === 'payroll' ? '12-Month Payroll & Spend Distribution' : '12-Month Workforce Inflow vs Exits'}
                </h3>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                {activeChartTab === 'payroll' ? 'Values represented in INR Crores (₹ Cr)' : 'Monthly employee onboarding vs turnover tracking'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-900/80 p-0.5 border border-slate-200 dark:border-slate-800 text-xs">
                <button
                  onClick={() => setActiveChartTab('payroll')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    activeChartTab === 'payroll'
                      ? 'bg-white dark:bg-slate-800 text-[#07518a] dark:text-[#3894db] shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Payroll Spend
                </button>
                <button
                  onClick={() => setActiveChartTab('hiring')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    activeChartTab === 'hiring'
                      ? 'bg-white dark:bg-slate-800 text-[#07518a] dark:text-[#3894db] shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Hiring Inflow
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Chart Visual */}
          {activeChartTab === 'payroll' ? (
            <div className="space-y-3">
              {/* Payroll Interactive Layer Filter Pills */}
              <div className="flex items-center gap-3 text-xs font-bold">
                <button
                  onClick={() => toggleLayer('base')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                    payrollLayers.base
                      ? 'bg-[#07518a]/10 border-[#07518a]/30 text-[#07518a] dark:text-[#3894db]'
                      : 'opacity-40 border-slate-200 text-slate-400'
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-[#07518a]" /> Base Salary (Avg ₹5.2 Cr)
                </button>
                <button
                  onClick={() => toggleLayer('bonus')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                    payrollLayers.bonus
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                      : 'opacity-40 border-slate-200 text-slate-400'
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Incentives & Bonus (Avg ₹0.6 Cr)
                </button>
                <button
                  onClick={() => toggleLayer('statutory')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                    payrollLayers.statutory
                      ? 'bg-purple-50 border-purple-300 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400'
                      : 'opacity-40 border-slate-200 text-slate-400'
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-purple-500" /> Statutory & PF (Avg ₹0.9 Cr)
                </button>
              </div>

              {/* High-definition SVG Payroll Bar Chart */}
              <div className="h-56 w-full relative pt-2">
                <svg className="w-full h-full" viewBox="0 0 1000 200" preserveAspectRatio="none">
                  <line x1="40" y1="30" x2="980" y2="30" stroke="currentColor" className="text-slate-100 dark:text-slate-800/80" strokeDasharray="4 4" />
                  <line x1="40" y1="80" x2="980" y2="80" stroke="currentColor" className="text-slate-100 dark:text-slate-800/80" strokeDasharray="4 4" />
                  <line x1="40" y1="130" x2="980" y2="130" stroke="currentColor" className="text-slate-100 dark:text-slate-800/80" strokeDasharray="4 4" />
                  <line x1="40" y1="170" x2="980" y2="170" stroke="currentColor" className="text-slate-200 dark:text-slate-700" strokeWidth="1.5" />

                  {payrollTrend.map((item, idx) => {
                    const x = 55 + idx * 78;
                    const maxVal = 7.5;
                    const baseH = payrollLayers.base ? (item.base / maxVal) * 130 : 0;
                    const bonusH = payrollLayers.bonus ? (item.bonus / maxVal) * 130 : 0;
                    const statH = payrollLayers.statutory ? (item.statutory / maxVal) * 130 : 0;
                    const isHovered = hoveredBar === idx;

                    return (
                      <g
                        key={idx}
                        className="cursor-pointer transition-all duration-200"
                        onMouseEnter={() => setHoveredBar(idx)}
                        onMouseLeave={() => setHoveredBar(null)}
                      >
                        {/* Hover Highlight bar */}
                        {isHovered && (
                          <rect x={x - 4} y="10" width="64" height="160" rx="8" fill="#07518a" fillOpacity="0.06" />
                        )}

                        {/* Base Salary bar */}
                        {payrollLayers.base && (
                          <rect x={x} y={170 - baseH} width="16" height={baseH} rx="4" fill="#07518a" />
                        )}

                        {/* Bonus Bar */}
                        {payrollLayers.bonus && (
                          <rect x={x + 18} y={170 - bonusH} width="16" height={bonusH} rx="4" fill="#10b981" />
                        )}

                        {/* Statutory Bar */}
                        {payrollLayers.statutory && (
                          <rect x={x + 36} y={170 - statH} width="16" height={statH} rx="4" fill="#8b5cf6" />
                        )}

                        {/* Month Label */}
                        <text
                          x={x + 26}
                          y="190"
                          textAnchor="middle"
                          fontSize="11"
                          fontWeight={isHovered ? '900' : '700'}
                          fill={isHovered ? '#07518a' : '#64748b'}
                        >
                          {item.month}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {/* Floating dynamic hover indicator */}
                {hoveredBar !== null && (
                  <div className="absolute top-2 right-4 bg-slate-900 text-white p-2.5 rounded-xl text-[11px] font-bold shadow-xl border border-slate-700 animate-fadeIn pointer-events-none">
                    <span className="text-slate-400 block uppercase text-[9px] font-extrabold">{payrollTrend[hoveredBar].month} Summary</span>
                    <div className="flex gap-3 mt-1">
                      <span className="text-blue-300">Base: ₹{payrollTrend[hoveredBar].base}Cr</span>
                      <span className="text-emerald-300">Bonus: ₹{payrollTrend[hoveredBar].bonus}Cr</span>
                      <span className="text-purple-300">Statutory: ₹{payrollTrend[hoveredBar].statutory}Cr</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Hiring vs Exit Inflow Dual Bar Chart */
            <div className="space-y-3">
              <div className="flex items-center gap-4 text-xs font-bold">
                <span className="flex items-center gap-1.5 text-[#07518a] dark:text-[#3894db]">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#07518a]" /> New Joinees (Total: 812)
                </span>
                <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Exits / Resignations (Total: 137)
                </span>
                <span className="ml-auto text-emerald-600 dark:text-emerald-400 font-extrabold text-[11px]">
                  Net Growth: +675 FTEs
                </span>
              </div>

              <div className="h-56 w-full relative pt-2">
                <svg className="w-full h-full" viewBox="0 0 1000 200" preserveAspectRatio="none">
                  <line x1="40" y1="30" x2="980" y2="30" stroke="currentColor" className="text-slate-100 dark:text-slate-800/80" strokeDasharray="4 4" />
                  <line x1="40" y1="80" x2="980" y2="80" stroke="currentColor" className="text-slate-100 dark:text-slate-800/80" strokeDasharray="4 4" />
                  <line x1="40" y1="130" x2="980" y2="130" stroke="currentColor" className="text-slate-100 dark:text-slate-800/80" strokeDasharray="4 4" />
                  <line x1="40" y1="170" x2="980" y2="170" stroke="currentColor" className="text-slate-200 dark:text-slate-700" strokeWidth="1.5" />

                  {hiringData.map((item, idx) => {
                    const x = 55 + idx * 78;
                    const maxVal = 100;
                    const hiredH = (item.hired / maxVal) * 130;
                    const exitedH = (item.exited / maxVal) * 130;

                    return (
                      <g key={idx} className="cursor-pointer group">
                        <rect x={x + 4} y={170 - hiredH} width="22" height={hiredH} rx="5" fill="#07518a" />
                        <rect x={x + 30} y={170 - exitedH} width="16" height={exitedH} rx="4" fill="#f43f5e" />
                        <text x={x + 28} y="190" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#64748b">
                          {item.month}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Entity / Subsidiary Payroll Share (4 Cols) */}
        <div
          style={{ boxShadow: 'rgba(14, 30, 37, 0.08) 0px 2px 4px 0px, rgba(14, 30, 37, 0.2) 0px 2px 14px 0px' }}
          className="lg:col-span-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-card p-6 flex flex-col justify-between space-y-4"
        >
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
              Entity Spend Distribution
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">Disbursement by legal corporate subsidiary</p>
          </div>

          <div className="space-y-3.5">
            {[
              { name: 'Brihaspathi Rail Pvt Ltd', share: '48%', amount: '₹ 3.08 Cr', staff: '680 Staff', color: 'bg-[#07518a]' },
              { name: 'Brihaspathi Tech Ltd', share: '32%', amount: '₹ 2.05 Cr', staff: '450 Staff', color: 'bg-indigo-600' },
              { name: 'Brihaspathi Solutions', share: '20%', amount: '₹ 1.29 Cr', staff: '298 Staff', color: 'bg-purple-600' },
            ].map((item, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <div>
                    <h5 className="font-extrabold text-slate-900 dark:text-slate-100">{item.name}</h5>
                    <span className="text-[10px] text-slate-400 font-semibold">{item.staff}</span>
                  </div>
                  <span className="font-mono font-black text-[#07518a] dark:text-[#3894db]">{item.amount}</span>
                </div>
                <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full ${item.color} rounded-full transition-all duration-500`} style={{ width: item.share }} />
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700 dark:text-slate-300">Total Monthly Spend</span>
            <span className="font-mono font-black text-[#07518a] dark:text-[#3894db]">₹ 6.42 Cr</span>
          </div>
        </div>

      </div>

      {/* 🌴 SECTION 2: LEAVE & ABSENCE HEALTH ANALYTICS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Leave Category Distribution (4 Cols) */}
        <div
          style={{ boxShadow: 'rgba(14, 30, 37, 0.08) 0px 2px 4px 0px, rgba(14, 30, 37, 0.2) 0px 2px 14px 0px' }}
          className="lg:col-span-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-card p-6 space-y-4"
        >
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
              Leave Category Share
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">Breakdown of 38 active leaves today</p>
          </div>

          <div className="space-y-3 text-xs font-bold">
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-700 dark:text-slate-300">Casual Leave (CL)</span>
                <span className="text-[#07518a] dark:text-[#3894db] font-mono">16 Staff (42%)</span>
              </div>
              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-[#07518a]" style={{ width: '42%' }} />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-700 dark:text-slate-300">Sick Leave (SL)</span>
                <span className="text-rose-600 dark:text-rose-400 font-mono">10 Staff (26%)</span>
              </div>
              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-rose-500" style={{ width: '26%' }} />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-700 dark:text-slate-300">Earned Leave (EL)</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-mono">8 Staff (21%)</span>
              </div>
              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: '21%' }} />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-700 dark:text-slate-300">Unpaid Leave / LOP</span>
                <span className="text-amber-600 dark:text-amber-400 font-mono">4 Staff (11%)</span>
              </div>
              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500" style={{ width: '11%' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Department Absence Benchmark (4 Cols) */}
        <div
          style={{ boxShadow: 'rgba(14, 30, 37, 0.08) 0px 2px 4px 0px, rgba(14, 30, 37, 0.2) 0px 2px 14px 0px' }}
          className="lg:col-span-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-card p-6 space-y-4"
        >
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
              Dept Absence Benchmark
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">Daily absent count & percentage rates</p>
          </div>

          <div className="space-y-2.5">
            {[
              { dept: 'Software Engineering', rate: '2.1%', count: '9 Absent', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40' },
              { dept: 'Sales & Marketing', rate: '3.8%', count: '11 Absent', color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40' },
              { dept: 'Customer Support', rate: '4.2%', count: '8 Absent', color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40' },
              { dept: 'Operations & Logistics', rate: '2.9%', count: '7 Absent', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40' },
              { dept: 'Finance & HR', rate: '1.5%', count: '3 Absent', color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40' },
            ].map((d, i) => (
              <div key={i} className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                <span className="font-extrabold text-slate-800 dark:text-slate-200 truncate max-w-[150px]">{d.dept}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-medium">{d.count}</span>
                  <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-md ${d.color}`}>{d.rate}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Leave Application Approval Pipeline (4 Cols) */}
        <div
          style={{ boxShadow: 'rgba(14, 30, 37, 0.08) 0px 2px 4px 0px, rgba(14, 30, 37, 0.2) 0px 2px 14px 0px' }}
          className="lg:col-span-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-card p-6 space-y-4"
        >
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
              Leave Request Pipeline
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">Manager approvals & HR audit stats</p>
          </div>

          <div className="space-y-2.5 text-xs font-bold">
            <div className="p-2.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 flex justify-between items-center">
              <span className="text-slate-700 dark:text-slate-300">Submitted Applications</span>
              <span className="font-mono font-black text-[#07518a] dark:text-[#3894db]">142 Requests</span>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 flex justify-between items-center">
              <span className="text-slate-700 dark:text-slate-300">Approved Applications</span>
              <span className="font-mono font-black text-emerald-700 dark:text-emerald-400">128 (90.1%)</span>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 flex justify-between items-center">
              <span className="text-slate-700 dark:text-slate-300">Pending Approvals</span>
              <span className="font-mono font-black text-amber-700 dark:text-amber-400">10 Pending</span>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40 flex justify-between items-center">
              <span className="text-slate-700 dark:text-slate-300">Rejected / Revoked</span>
              <span className="font-mono font-black text-rose-700 dark:text-rose-400">4 Rejected</span>
            </div>
          </div>
        </div>

      </div>

      {/* 🎯 SECTION 3: TALENT ACQUISITION & PERFORMANCE EXCELLENCE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* ATS Hiring Funnel (6 Cols) */}
        <div
          style={{ boxShadow: 'rgba(14, 30, 37, 0.08) 0px 2px 4px 0px, rgba(14, 30, 37, 0.2) 0px 2px 14px 0px' }}
          className="lg:col-span-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-card p-6 space-y-4"
        >
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
              Talent Acquisition Funnel
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">Full lifecycle candidate conversion stages</p>
          </div>

          <div className="space-y-2 text-xs">
            {[
              { stage: '1. Applications Sourced', count: 1840, conversion: '100%', color: 'bg-[#07518a]' },
              { stage: '2. Resume Shortlisted', count: 620, conversion: '33.7%', color: 'bg-blue-600' },
              { stage: '3. Technical Evaluation', count: 280, conversion: '15.2%', color: 'bg-indigo-600' },
              { stage: '4. Offer Letter Released', count: 48, conversion: '2.6%', color: 'bg-purple-600' },
              { stage: '5. Offer Accepted (48h)', count: 42, conversion: '2.3%', color: 'bg-teal-600' },
              { stage: '6. Employee Onboarded', count: 38, conversion: '2.1%', color: 'bg-emerald-600' },
            ].map((item, idx) => (
              <div key={idx} className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <span className={`h-6 w-6 rounded-lg ${item.color} text-white font-black text-[10px] flex items-center justify-center shrink-0`}>
                    {idx + 1}
                  </span>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200">{item.stage}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{item.count}</span>
                  <span className="text-[10px] font-mono text-slate-400 font-bold">({item.conversion})</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Performance & Talent Retention Curve (6 Cols) */}
        <div
          style={{ boxShadow: 'rgba(14, 30, 37, 0.08) 0px 2px 4px 0px, rgba(14, 30, 37, 0.2) 0px 2px 14px 0px' }}
          className="lg:col-span-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-card p-6 flex flex-col justify-between space-y-4"
        >
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
              Workforce Performance & Retention
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">Quarterly KPI appraisal grading distribution</p>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 space-y-1.5">
              <div className="flex justify-between font-black text-emerald-950 dark:text-emerald-300">
                <span>Exceeds Expectations (High Performers)</span>
                <span>314 Staff (22%)</span>
              </div>
              <div className="h-2 w-full bg-emerald-200 dark:bg-emerald-900/50 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-600 rounded-full" style={{ width: '22%' }} />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 space-y-1.5">
              <div className="flex justify-between font-black text-blue-950 dark:text-blue-300">
                <span>Meets Expectations (Core Contributors)</span>
                <span>971 Staff (68%)</span>
              </div>
              <div className="h-2 w-full bg-blue-200 dark:bg-blue-900/50 rounded-full overflow-hidden">
                <div className="h-full bg-[#07518a] rounded-full" style={{ width: '68%' }} />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 space-y-1.5">
              <div className="flex justify-between font-black text-amber-950 dark:text-amber-300">
                <span>Needs Improvement (Mentorship & PIP)</span>
                <span>143 Staff (10%)</span>
              </div>
              <div className="h-2 w-full bg-amber-200 dark:bg-amber-900/50 rounded-full overflow-hidden">
                <div className="h-full bg-amber-600 rounded-full" style={{ width: '10%' }} />
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-50/80 dark:bg-slate-900/50 rounded-xl border border-slate-200/80 dark:border-slate-800 flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-300">
            <span>📉 Monthly Attrition Rate: 0.8% MoM</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">✓ Healthy Retention</span>
          </div>
        </div>

      </div>

      {/* 🗺️ SECTION 4: REGIONAL DENSITY & LIVE BIOMETRIC FEED */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Regional Headcount Density (5 Cols) */}
        <div
          style={{ boxShadow: 'rgba(14, 30, 37, 0.08) 0px 2px 4px 0px, rgba(14, 30, 37, 0.2) 0px 2px 14px 0px' }}
          className="lg:col-span-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-card p-6 space-y-4"
        >
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
              Branch Regional Distribution
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">Headcount by office branch location</p>
          </div>

          <div className="space-y-3 text-xs">
            {[
              { city: 'Hyderabad HQ (TG)', staff: 680, share: '47.6%', color: 'bg-[#07518a]' },
              { city: 'Bengaluru R&D Hub (KA)', staff: 450, share: '31.5%', color: 'bg-indigo-600' },
              { city: 'Mumbai Regional Office (MH)', staff: 202, share: '14.1%', color: 'bg-purple-600' },
              { city: 'Delhi NCR Office (DL)', staff: 96, share: '6.8%', color: 'bg-teal-600' },
            ].map((b, i) => (
              <div key={i} className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 space-y-1.5">
                <div className="flex justify-between font-extrabold text-slate-900 dark:text-slate-100">
                  <span>{b.city}</span>
                  <span className="text-[#07518a] dark:text-[#3894db] font-mono">{b.staff} Staff ({b.share})</span>
                </div>
                <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full ${b.color} rounded-full`} style={{ width: b.share }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Biometric & Geo Check-In Stream (7 Cols) */}
        <div
          style={{ boxShadow: 'rgba(14, 30, 37, 0.08) 0px 2px 4px 0px, rgba(14, 30, 37, 0.2) 0px 2px 14px 0px' }}
          className="lg:col-span-7 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-card p-6 space-y-4"
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                Live Attendance & Geo Punches
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">Real-time IoT biometric and mobile punch feed</p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-900/30 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> LIVE STREAM
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            {livePunches.map((p, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 flex justify-between items-center hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${p.color} text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs`}>
                    {p.initials}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-900 dark:text-slate-100">{p.name}</span>
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-blue-50 dark:bg-blue-950/50 text-[#07518a] dark:text-[#3894db] border border-blue-200/60 dark:border-blue-800/40">
                        {p.dept}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                      {p.role} • {p.location} • <span className="font-semibold text-slate-500 dark:text-slate-400">{p.method}</span>
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-mono font-extrabold text-slate-900 dark:text-slate-100 block">{p.time}</span>
                  <span
                    className={`inline-block text-[9px] font-extrabold px-2 py-0.5 rounded-full border mt-0.5 ${
                      p.status === 'ON_TIME'
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200/80 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/30'
                        : 'bg-amber-50 text-amber-600 border-amber-200/80 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/30'
                    }`}
                  >
                    {p.status === 'ON_TIME' ? '✓ On Time' : '⚠️ Late Check-in'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}

