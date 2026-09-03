'use client';

import React, { useState } from 'react';
import DashboardPageHeader from '../components/DashboardPageHeader';
import { useDashboard } from '../components/DashboardContext';

export default function AnalyticsPage() {
  const { showToast } = useDashboard();

  // Wave Chart Legends Toggle
  const [payrollLegend, setPayrollLegend] = useState({
    baseSalary: true,
    bonuses: true,
    statutory: true,
  });

  const handleExport = (format: string) => {
    showToast(`📊 Exporting Superadmin Executive Analytics Report (${format})...`, 'info');
  };

  // 12-Month Dual Column Bar Chart Data (Hired vs Exited)
  const hiringOverviewData = [
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

  // Monthly Payroll Trend Data (12 Months)
  const payrollTrendData = [
    { month: 'Sep', base: 4.8, bonus: 0.5, statutory: 0.8 },
    { month: 'Oct', base: 4.9, bonus: 0.6, statutory: 0.8 },
    { month: 'Nov', base: 5.0, bonus: 0.4, statutory: 0.9 },
    { month: 'Dec', base: 5.2, bonus: 0.9, statutory: 0.9 },
    { month: 'Jan', base: 5.1, bonus: 0.5, statutory: 0.9 },
    { month: 'Feb', base: 5.1, bonus: 0.4, statutory: 0.9 },
    { month: 'Mar', base: 5.3, bonus: 0.7, statutory: 0.9 },
    { month: 'Apr', base: 5.2, bonus: 0.5, statutory: 0.9 },
    { month: 'May', base: 5.3, bonus: 0.6, statutory: 1.0 },
    { month: 'Jun', base: 5.4, bonus: 0.5, statutory: 1.0 },
    { month: 'Jul', base: 5.5, bonus: 0.8, statutory: 1.0 },
    { month: 'Aug', base: 5.6, bonus: 0.6, statutory: 1.0 },
  ];

  // Live Attendance Punches Stream
  const livePunches = [
    { name: 'Ravi Sekhar', role: 'AI Lead', dept: 'Engg', time: '09:02 AM', location: 'Hyderabad HQ', status: 'ON_TIME', avatar: 'RS', color: 'bg-indigo-100 text-indigo-700' },
    { name: 'Ananya Sharma', role: 'Sr PM', dept: 'Product', time: '09:05 AM', location: 'Bengaluru R&D', status: 'ON_TIME', avatar: 'AS', color: 'bg-purple-100 text-purple-700' },
    { name: 'Praveen Kumar', role: 'Sales Mgr', dept: 'Sales', time: '09:14 AM', location: 'Mumbai Branch', status: 'LATE', avatar: 'PK', color: 'bg-amber-100 text-amber-700' },
    { name: 'Deepika Reddy', role: 'UI Lead', dept: 'Design', time: '09:18 AM', location: 'Hyderabad HQ', status: 'ON_TIME', avatar: 'DR', color: 'bg-emerald-100 text-emerald-700' },
    { name: 'Vikram Verma', role: 'DevOps', dept: 'Engg', time: '09:25 AM', location: 'Remote VPN', status: 'ON_TIME', avatar: 'VV', color: 'bg-sky-100 text-sky-700' },
  ];

  return (
    <div className="space-y-4 animate-fadeIn w-full pb-10 select-none font-sans text-left bg-slate-50/60 p-2 sm:p-3 rounded-2xl">
      
      {/* 👑 SUPERADMIN PAGE HEADER (COMPACT LIGHT THEME) */}
      <DashboardPageHeader
        title="Superadmin Executive Analytics & Intelligence"
        actionMessage=""
        actionError=""
        companies={[]}
        companyId="all"
        handleCompanyChange={() => {}}
        isSuperAdmin={true}
        email="superadmin@brihaspathi.com"
        hideCompanySelect={true}
        hideUserBadge={false}
      />

      {/* 🚀 COMPACT TOP KPI TILES (6 CRISP DENSE TILES) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        
        {/* Card 1: Total Workforce */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between hover:border-indigo-300 transition-all">
          <div className="space-y-0.5">
            <span className="text-[9px] font-black uppercase text-slate-400">Total Workforce</span>
            <h3 className="text-xl font-black text-slate-900 font-outfit leading-none">1,428</h3>
            <span className="text-[9px] font-extrabold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded-md inline-block">
              ↑ 12.4% MoM
            </span>
          </div>
          <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600 text-lg">👥</span>
        </div>

        {/* Card 2: Monthly Payroll */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between hover:border-emerald-300 transition-all">
          <div className="space-y-0.5">
            <span className="text-[9px] font-black uppercase text-slate-400">Gross Payroll</span>
            <h3 className="text-xl font-black text-slate-900 font-outfit leading-none">₹ 6.42 Cr</h3>
            <span className="text-[9px] font-extrabold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded-md inline-block">
              ✓ 90.4% Budget
            </span>
          </div>
          <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 text-lg">💰</span>
        </div>

        {/* Card 3: Today Attendance */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between hover:border-blue-300 transition-all">
          <div className="space-y-0.5">
            <span className="text-[9px] font-black uppercase text-slate-400">Shift Attendance</span>
            <h3 className="text-xl font-black text-slate-900 font-outfit leading-none">96.4%</h3>
            <span className="text-[9px] font-extrabold text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded-md inline-block">
              1,376 Checked-In
            </span>
          </div>
          <span className="p-2 rounded-xl bg-blue-50 text-blue-600 text-lg">⏱️</span>
        </div>

        {/* Card 4: Leaves Today */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between hover:border-amber-300 transition-all">
          <div className="space-y-0.5">
            <span className="text-[9px] font-black uppercase text-slate-400">Leaves Today</span>
            <h3 className="text-xl font-black text-slate-900 font-outfit leading-none">38 Staff</h3>
            <span className="text-[9px] font-extrabold text-amber-600 bg-amber-50 px-1.5 py-0.2 rounded-md inline-block">
              2.8% Absence
            </span>
          </div>
          <span className="p-2 rounded-xl bg-amber-50 text-amber-600 text-lg">🌴</span>
        </div>

        {/* Card 5: ATS Recruitment */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between hover:border-purple-300 transition-all">
          <div className="space-y-0.5">
            <span className="text-[9px] font-black uppercase text-slate-400">ATS Openings</span>
            <h3 className="text-xl font-black text-slate-900 font-outfit leading-none">42 Roles</h3>
            <span className="text-[9px] font-extrabold text-purple-600 bg-purple-50 px-1.5 py-0.2 rounded-md inline-block">
              184 Applicants
            </span>
          </div>
          <span className="p-2 rounded-xl bg-purple-50 text-purple-600 text-lg">🎯</span>
        </div>

        {/* Card 6: Performance Index */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between hover:border-teal-300 transition-all">
          <div className="space-y-0.5">
            <span className="text-[9px] font-black uppercase text-slate-400">KPI Avg Rating</span>
            <h3 className="text-xl font-black text-slate-900 font-outfit leading-none">88.6%</h3>
            <span className="text-[9px] font-extrabold text-teal-600 bg-teal-50 px-1.5 py-0.2 rounded-md inline-block">
              ⭐ 4.8 Rating
            </span>
          </div>
          <span className="p-2 rounded-xl bg-teal-50 text-teal-600 text-lg">⭐</span>
        </div>

      </div>

      {/* 🌴 ROW 2: COMPACT LEAVE & ABSENCE MANAGEMENT ANALYTICS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">🌴</span>
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 font-outfit">
              Leave & Absence Intelligence
            </h2>
          </div>
          <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
            Absence Rate: 2.8% Today (38 Staff)
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
          
          {/* Leave Type Breakdown (4 Cols) */}
          <div className="lg:col-span-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Leave Category Share</h3>
            
            <div className="space-y-2.5 text-xs font-extrabold">
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-700">Casual Leave (CL)</span>
                  <span className="text-indigo-600 font-mono">16 Staff (42%)</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-600" style={{ width: '42%' }} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-700">Sick Leave (SL)</span>
                  <span className="text-rose-600 font-mono">10 Staff (26%)</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-rose-500" style={{ width: '26%' }} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-700">Earned Leave (EL)</span>
                  <span className="text-emerald-600 font-mono">8 Staff (21%)</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: '21%' }} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-700">Unpaid / LOP</span>
                  <span className="text-amber-600 font-mono">4 Staff (11%)</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500" style={{ width: '11%' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Departmental Absence Rates (4 Cols) */}
          <div className="lg:col-span-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Dept Absence Rates</h3>
            
            <div className="space-y-2">
              {[
                { dept: 'Software Engineering', rate: '2.1%', count: '9 Absent', color: 'text-emerald-600 bg-emerald-50' },
                { dept: 'Sales & Marketing', rate: '3.8%', count: '11 Absent', color: 'text-amber-600 bg-amber-50' },
                { dept: 'Customer Support', rate: '4.2%', count: '8 Absent', color: 'text-rose-600 bg-rose-50' },
                { dept: 'Operations & Logistics', rate: '2.9%', count: '7 Absent', color: 'text-emerald-600 bg-emerald-50' },
                { dept: 'Finance & HR', rate: '1.5%', count: '3 Absent', color: 'text-indigo-600 bg-indigo-50' },
              ].map((d, i) => (
                <div key={i} className="p-2 rounded-xl bg-slate-50 border border-slate-200/50 flex items-center justify-between text-xs">
                  <span className="font-extrabold text-slate-900 truncate max-w-[160px]">{d.dept}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 font-medium">{d.count}</span>
                    <span className={`text-[9px] font-mono font-black px-2 py-0.5 rounded-md ${d.color}`}>{d.rate}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Leave Application Pipeline (4 Cols) */}
          <div className="lg:col-span-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Leave Application Pipeline</h3>
            
            <div className="space-y-2 text-xs font-bold">
              <div className="p-2.5 rounded-xl bg-indigo-50/60 border border-indigo-100 flex justify-between items-center">
                <span>Submitted Applications</span>
                <span className="font-mono font-black text-indigo-700">142 Requests</span>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100 flex justify-between items-center">
                <span>Approved Requests</span>
                <span className="font-mono font-black text-emerald-700">128 (90.1%)</span>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-100 flex justify-between items-center">
                <span>Pending HR Audit</span>
                <span className="font-mono font-black text-amber-700">10 Pending</span>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-50/60 border border-rose-100 flex justify-between items-center">
                <span>Rejected / Cancelled</span>
                <span className="font-mono font-black text-rose-700">4 Rejected</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* 💻 ROW 3: NEW SKILL MATRIX & IT ASSET ALLOCATION ANALYTICS (NEW MODULE) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">💻</span>
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 font-outfit">
              IT Asset Allocation & Workforce Skill Matrix
            </h2>
          </div>
          <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
            1,369 Assets Assigned (94% Utilization)
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
          
          {/* IT Assets Allocation Breakdown (6 Cols) */}
          <div className="lg:col-span-6 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Enterprise IT Asset Distribution</h3>
            
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Laptops & Workstations</span>
                <div className="flex justify-between items-baseline">
                  <span className="text-lg font-black text-slate-900 font-outfit">1,120</span>
                  <span className="text-[10px] font-black text-emerald-600">94% Active</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Biometric IoT Scanners</span>
                <div className="flex justify-between items-baseline">
                  <span className="text-lg font-black text-slate-900 font-outfit">140</span>
                  <span className="text-[10px] font-black text-indigo-600">100% Online</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Corporate Mobile Devices</span>
                <div className="flex justify-between items-baseline">
                  <span className="text-lg font-black text-slate-900 font-outfit">85</span>
                  <span className="text-[10px] font-black text-emerald-600">98% Assigned</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Fleet Vehicles & Assets</span>
                <div className="flex justify-between items-baseline">
                  <span className="text-lg font-black text-slate-900 font-outfit">24</span>
                  <span className="text-[10px] font-black text-amber-600">Maintenance 2</span>
                </div>
              </div>
            </div>
          </div>

          {/* Skill Competency Distribution (6 Cols) */}
          <div className="lg:col-span-6 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Workforce Seniority & Skill Matrix</h3>
            
            <div className="space-y-2.5 text-xs font-extrabold">
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-700">Senior Engineers & Architects</span>
                  <span className="text-indigo-600 font-mono">600 Staff (42%)</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-600" style={{ width: '42%' }} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-700">Mid-Level Specialists</span>
                  <span className="text-purple-600 font-mono">542 Staff (38%)</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500" style={{ width: '38%' }} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-700">Associate & Entry Staff</span>
                  <span className="text-teal-600 font-mono">286 Staff (20%)</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-teal-500" style={{ width: '20%' }} />
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* 💳 ROW 4: PAYROLL DISBURSEMENT & FINANCIAL ANALYTICS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">💳</span>
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 font-outfit">
              Payroll & Financial Compensation
            </h2>
          </div>
          <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
            Monthly Spend: ₹ 6.42 Cr
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
          
          {/* 12-Month Payroll Trend (8 Cols) */}
          <div className="lg:col-span-8 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">12-Month Payroll Trend</h3>
              <div className="flex items-center gap-2 text-[10px] font-extrabold">
                <span className="flex items-center gap-1 text-indigo-600"><span className="h-2 w-2 rounded-full bg-indigo-600" /> Base</span>
                <span className="flex items-center gap-1 text-emerald-600"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Bonus</span>
                <span className="flex items-center gap-1 text-purple-600"><span className="h-2 w-2 rounded-full bg-purple-500" /> Statutory</span>
              </div>
            </div>

            <div className="h-44 w-full pt-1">
              <svg className="w-full h-full" viewBox="0 0 1000 180">
                <line x1="50" y1="30" x2="980" y2="30" stroke="#f1f5f9" strokeDasharray="3 3" />
                <line x1="50" y1="80" x2="980" y2="80" stroke="#f1f5f9" strokeDasharray="3 3" />
                <line x1="50" y1="130" x2="980" y2="130" stroke="#f1f5f9" strokeDasharray="3 3" />
                <line x1="50" y1="160" x2="980" y2="160" stroke="#cbd5e1" strokeWidth="1.5" />

                {payrollTrendData.map((item, idx) => {
                  const x = 70 + idx * 76;
                  const maxVal = 8.0;
                  const baseH = (item.base / maxVal) * 120;
                  const bonusH = (item.bonus / maxVal) * 120;
                  const statH = (item.statutory / maxVal) * 120;

                  return (
                    <g key={idx} className="group/bar cursor-pointer">
                      <rect x={x} y={160 - baseH} width="16" height={baseH} rx="3" fill="#4f46e5" />
                      <rect x={x + 18} y={160 - bonusH} width="16" height={bonusH} rx="3" fill="#10b981" />
                      <rect x={x + 36} y={160 - statH} width="16" height={statH} rx="3" fill="#8b5cf6" />
                      <text x={x + 26} y="174" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#64748b">
                        {item.month}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Subsidiary Share (4 Cols) */}
          <div className="lg:col-span-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Payroll Share by Entity</h3>
            
            <div className="space-y-3">
              {[
                { name: 'Brihaspathi Rail Pvt Ltd', share: '48%', amount: '₹ 3.08 Cr', staff: '680 Staff', color: 'bg-indigo-600' },
                { name: 'Brihaspathi Tech Ltd', share: '32%', amount: '₹ 2.05 Cr', staff: '450 Staff', color: 'bg-blue-600' },
                { name: 'Brihaspathi Solutions', share: '20%', amount: '₹ 1.29 Cr', staff: '298 Staff', color: 'bg-purple-600' },
              ].map((item, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/50 space-y-1 text-xs">
                  <div className="flex justify-between font-black">
                    <span className="text-slate-900">{item.name}</span>
                    <span className="text-indigo-600 font-mono">{item.amount}</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div className={`h-full ${item.color}`} style={{ width: item.share }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* 🎯 ROW 5: ATS RECRUITMENT & PERFORMANCE BELL CURVE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        
        {/* ATS Funnel (6 Cols) */}
        <div className="lg:col-span-6 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">ATS Hiring Funnel</h3>
          
          <div className="space-y-2 text-xs">
            {[
              { stage: '1. Applications Received', count: 1840, color: 'bg-indigo-600' },
              { stage: '2. Sourced & Screened', count: 620, color: 'bg-blue-600' },
              { stage: '3. Technical Interview', count: 280, color: 'bg-purple-600' },
              { stage: '4. Offer Letter Issued', count: 48, color: 'bg-amber-600' },
              { stage: '5. Offer Accepted (48h)', count: 42, color: 'bg-teal-600' },
              { stage: '6. Employee Converted', count: 38, color: 'bg-emerald-600' },
            ].map((item, idx) => (
              <div key={idx} className="p-2 rounded-xl bg-slate-50 border border-slate-200/50 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className={`h-6 w-6 rounded-lg ${item.color} text-white font-black text-[10px] flex items-center justify-center shrink-0`}>
                    {idx + 1}
                  </span>
                  <span className="font-extrabold text-slate-900">{item.stage}</span>
                </div>
                <span className="font-mono font-black text-slate-900">{item.count} Candidates</span>
              </div>
            ))}
          </div>
        </div>

        {/* Performance & Retention Bell Curve (6 Cols) */}
        <div className="lg:col-span-6 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3 flex flex-col justify-between">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Performance Rating & Retention</h3>
          
          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-100 space-y-1">
              <div className="flex justify-between font-black text-emerald-950">
                <span>Exceeds Expectations (High Performers)</span>
                <span>314 Staff (22%)</span>
              </div>
              <div className="h-1.5 w-full bg-emerald-200 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-600" style={{ width: '22%' }} />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-100 space-y-1">
              <div className="flex justify-between font-black text-indigo-950">
                <span>Meets Expectations (Core Performers)</span>
                <span>971 Staff (68%)</span>
              </div>
              <div className="h-1.5 w-full bg-indigo-200 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-600" style={{ width: '68%' }} />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-100 space-y-1">
              <div className="flex justify-between font-black text-amber-950">
                <span>Needs Improvement (PIP Guidance)</span>
                <span>143 Staff (10%)</span>
              </div>
              <div className="h-1.5 w-full bg-amber-200 rounded-full overflow-hidden">
                <div className="h-full bg-amber-600" style={{ width: '10%' }} />
              </div>
            </div>
          </div>

          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center text-xs font-bold text-slate-700">
            <span>📉 Monthly Attrition Rate: 0.8% MoM</span>
            <span className="text-emerald-600 font-extrabold">✓ Healthy Retention</span>
          </div>
        </div>

      </div>

      {/* 🗺️ ROW 6: REGIONAL HEADCOUNT & LIVE BIOMETRIC STREAM */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        
        {/* Branch Regional Distribution (5 Cols) */}
        <div className="lg:col-span-5 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Branch Regional Density</h3>
          
          <div className="space-y-2 text-xs">
            {[
              { city: 'Hyderabad HQ (TG)', staff: 680, share: '47.6%', color: 'bg-indigo-600' },
              { city: 'Bengaluru R&D Hub (KA)', staff: 450, share: '31.5%', color: 'bg-blue-600' },
              { city: 'Mumbai Regional Office (MH)', staff: 202, share: '14.1%', color: 'bg-purple-600' },
              { city: 'Delhi NCR Office (DL)', staff: 96, share: '6.8%', color: 'bg-teal-600' },
            ].map((b, i) => (
              <div key={i} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/50 space-y-1">
                <div className="flex justify-between font-black">
                  <span className="text-slate-900">{b.city}</span>
                  <span className="text-indigo-600 font-mono">{b.staff} Staff ({b.share})</span>
                </div>
                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div className={`h-full ${b.color}`} style={{ width: b.share }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Attendance Activity Stream (7 Cols) */}
        <div className="lg:col-span-7 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Live Biometric & Geo Stream</h3>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> LIVE STREAM
            </span>
          </div>

          <div className="space-y-2 text-xs">
            {livePunches.map((p, idx) => (
              <div key={idx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/50 flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <div className={`h-8 w-8 rounded-xl ${p.color} font-extrabold text-[10px] flex items-center justify-center shrink-0 border border-slate-200`}>
                    {p.avatar}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-slate-900">{p.name}</span>
                      <span className="px-1.5 py-0.2 rounded text-[8px] font-black bg-indigo-50 text-indigo-600 border border-indigo-200">{p.dept}</span>
                    </div>
                    <p className="text-[9px] text-slate-400 font-medium">{p.role} • {p.location}</p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-mono font-black text-slate-900 block">{p.time}</span>
                  <span className={`text-[8px] font-extrabold px-1.5 py-0.2 rounded border ${p.status === 'ON_TIME' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                    {p.status === 'ON_TIME' ? '✓ On Time' : '⚠️ Late'}
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

