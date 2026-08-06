'use client';

import React, { useEffect, useState } from 'react';
import DashboardPageHeader from '../components/DashboardPageHeader';
import { getHeaders, getUrl } from '../utils/api';

interface Company {
  id: string;
  name: string;
  subdomain: string;
  status: string;
  created_at: string;
}

export default function PerformancePage() {
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);

  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');

  // Performance Objectives / OKR state
  const [okrs, setOkrs] = useState([
    { id: 1, name: 'Ananya Rao', objective: 'Migrate legacy UI modules to Next.js App Router', progress: 75 },
    { id: 2, name: 'Srinivas Rao', objective: 'Achieve ISO 27001 ISMS corporate compliance', progress: 40 },
    { id: 3, name: 'Nikitha Reddy', objective: 'Hire 12 staff React Engineers in Q3 pipeline', progress: 95 },
  ]);

  // Bell Curve Distribution calibration state
  const [distUnder, setDistUnder] = useState(10);
  const [distMeets, setDistMeets] = useState(70);
  const [distExceeds, setDistExceeds] = useState(20);

  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('superadmin');

  useEffect(() => {
    const storedRoles = localStorage.getItem('roles');
    const storedEmail = localStorage.getItem('email');
    const storedCompanyId = localStorage.getItem('companyId');
    if (storedRoles) setRoles(JSON.parse(storedRoles));
    if (storedEmail) setEmail(storedEmail);
    if (storedCompanyId) setCompanyId(storedCompanyId);
  }, []);

  const fetchCompanies = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/v1/companies', { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) setCompanies(data.companies || []);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      fetchCompanies();
    }
  }, [companyId, isSuperAdmin]);

  const handleUpdateProgress = (id: number, val: number) => {
    setOkrs(okrs.map(o => o.id === id ? { ...o, progress: val } : o));
  };

  const handleCalibrateCurve = () => {
    const sum = distUnder + distMeets + distExceeds;
    if (sum !== 100) {
      setActionError(`Calibrate error: Distribution sum must equal 100% (currently ${sum}%)`);
      return;
    }
    setActionMessage('Performance Bell Curve calibration updated successfully');
    setActionError('');
    setTimeout(() => setActionMessage(''), 3000);
  };

  const handleCompanyChange = (id: string) => {
    const val = id || null;
    setCompanyId(val);
    if (val) {
      localStorage.setItem('companyId', val);
    } else {
      localStorage.removeItem('companyId');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <DashboardPageHeader
        title="Performance Objectives & Appraisal Calibrations"
        actionMessage={actionMessage}
        actionError={actionError}
        companies={companies}
        companyId={companyId}
        handleCompanyChange={handleCompanyChange}
        isSuperAdmin={isSuperAdmin}
        email={email}
      />

      <div className="grid gap-6 md:grid-cols-3">
        {/* OKR Tracker */}
        <div className="md:col-span-2 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-4 border-b border-slate-100 pb-3 flex items-center justify-between">
            <span>Corporate Key Results (OKRs)</span>
            <span className="text-[9px] bg-emerald-50 text-emerald-600 border border-emerald-100 font-mono font-bold px-2 py-0.5 rounded uppercase tracking-wider">Active Q3 cycle</span>
          </h3>
          <div className="space-y-5">
            {okrs.map(okr => (
              <div key={okr.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-all space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">{okr.name}</h4>
                    <p className="text-[11px] text-slate-500 font-medium mt-1">Goal: "{okr.objective}"</p>
                  </div>
                  <span className="text-[11px] font-bold text-blue-600 font-mono">{okr.progress}%</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range" min="0" max="100" step="5"
                    value={okr.progress}
                    onChange={e => handleUpdateProgress(okr.id, Number(e.target.value))}
                    className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="h-2 w-28 bg-slate-250 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full" style={{ width: `${okr.progress}%` }}></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bell Curve Calibrator */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm h-fit">
          <h3 className="text-sm font-bold text-slate-800 mb-4 border-b border-slate-100 pb-3">Bell Curve Distribution</h3>
          <div className="space-y-4">
            <div>
              <label className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                <span>Needs Improvement</span>
                <span className="text-red-500 font-mono">{distUnder}%</span>
              </label>
              <input
                type="range" min="0" max="40" step="5"
                value={distUnder}
                onChange={e => setDistUnder(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-red-500"
              />
            </div>
            <div>
              <label className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                <span>Meets Expectations</span>
                <span className="text-blue-600 font-mono">{distMeets}%</span>
              </label>
              <input
                type="range" min="40" max="90" step="5"
                value={distMeets}
                onChange={e => setDistMeets(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
            <div>
              <label className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                <span>Exceeds Target Bounds</span>
                <span className="text-emerald-500 font-mono">{distExceeds}%</span>
              </label>
              <input
                type="range" min="0" max="40" step="5"
                value={distExceeds}
                onChange={e => setDistExceeds(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>
            
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 flex justify-between items-center text-xs">
              <span className="font-bold text-slate-550">Total Sum:</span>
              <span className={`font-mono font-bold ${distUnder + distMeets + distExceeds === 100 ? 'text-emerald-600' : 'text-red-600'}`}>
                {distUnder + distMeets + distExceeds}%
              </span>
            </div>

            <button
              onClick={handleCalibrateCurve}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
            >
              Update Calibration Policy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
