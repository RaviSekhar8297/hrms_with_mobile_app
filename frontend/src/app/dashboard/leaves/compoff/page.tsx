'use client';

import React, { useEffect, useState } from 'react';
import DashboardPageHeader from '../../components/DashboardPageHeader';
import { getHeaders } from '../../utils/api';
import SlideDrawer from '../../components/SlideDrawer';
import { useDashboard } from '../../components/DashboardContext';

export default function CompOffClaimsPage() {
  const { showToast } = useDashboard();
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const [viewScope, setViewScope] = useState<'my' | 'team'>('my');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [fromDateFilter, setFromDateFilter] = useState('');
  const [toDateFilter, setToDateFilter] = useState('');
  const todayStr = new Date().toISOString().split('T')[0];

  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [compOffRequests, setCompOffRequests] = useState<any[]>([]);
  const [eligibleDates, setEligibleDates] = useState<any[]>([]);
  const [isFetchingEligible, setIsFetchingEligible] = useState(false);
  const [compOffDrawerOpen, setCompOffDrawerOpen] = useState(false);

  const [compOffForm, setCompOffForm] = useState({
    worked_date: '',
    comp_off_type: 'FULL_DAY',
    reason: ''
  });

  const [actionModal, setActionModal] = useState<{ open: boolean; req: any | null; type: 'APPROVE' | 'REJECT' }>({
    open: false,
    req: null,
    type: 'APPROVE'
  });
  const [managerRemarks, setManagerRemarks] = useState('');

  useEffect(() => {
    const storedRoles = localStorage.getItem('roles');
    const storedEmail = localStorage.getItem('email');
    const storedCompanyId = localStorage.getItem('companyId');
    let parsedRoles: string[] = [];
    if (storedRoles) {
      try {
        parsedRoles = JSON.parse(storedRoles);
        setRoles(parsedRoles);
      } catch (e) {}
    }
    if (storedEmail) setEmail(storedEmail);
    if (storedCompanyId) setCompanyId(storedCompanyId);

    const isSuper = parsedRoles.includes('SuperAdmin') || parsedRoles.includes('superadmin');
    const isMgr = parsedRoles.some(r => {
      const lr = r.toLowerCase();
      return lr.includes('manager') || lr.includes('head') || lr.includes('lead') || lr.includes('executive') || lr.includes('director');
    });

    if (isSuper || isMgr) setViewScope('team');
  }, []);

  useEffect(() => {
    fetchCompOffRequests(viewScope);
  }, [viewScope, companyId]);

  const fetchCompOffRequests = async (scope: 'my' | 'team') => {
    setIsLoading(true);
    const cid = companyId || 'all';
    try {
      const res = await fetch(`/api/v1/comp-off-requests?companyId=${cid}&scope=${scope}`, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) setCompOffRequests(data.requests || []);
    } catch (e) {
      showToast('Error loading comp-off requests', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEligibleDates = async () => {
    setIsFetchingEligible(true);
    try {
      const res = await fetch('/api/v1/comp-off-requests/eligible-dates', {
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) setEligibleDates(data.eligibleDates || []);
    } catch (e) {
      console.error('Error fetching eligible dates:', e);
    } finally {
      setIsFetchingEligible(false);
    }
  };

  const handleOpenDrawer = () => {
    setCompOffDrawerOpen(true);
    fetchEligibleDates();
  };

  const handleClaimCompOff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compOffForm.worked_date) {
      showToast('Please select a worked weekend/holiday date', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch('/api/v1/comp-off-requests', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(compOffForm)
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Comp-off claim submitted successfully', 'success');
        setCompOffDrawerOpen(false);
        setCompOffForm({ worked_date: '', comp_off_type: 'FULL_DAY', reason: '' });
        fetchCompOffRequests(viewScope);
      } else {
        showToast(data.error || 'Failed to submit comp-off claim', 'error');
      }
    } catch (e) {
      showToast('Server connection error', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleProcessCompOff = async () => {
    if (!actionModal.req) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/v1/comp-off-requests/${actionModal.req.id}/action`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          action: actionModal.type === 'APPROVE' ? 'APPROVED' : 'REJECTED',
          rejection_reason: managerRemarks
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Comp-off request ${actionModal.type === 'APPROVE' ? 'Approved' : 'Rejected'}`, 'success');
        setActionModal({ open: false, req: null, type: 'APPROVE' });
        setManagerRemarks('');
        fetchCompOffRequests(viewScope);
      } else {
        showToast(data.error || 'Failed to process request', 'error');
      }
    } catch (e) {
      showToast('Connection error', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = compOffRequests.filter(req => {
    const matchesStatus = statusFilter === 'ALL' || req.status === statusFilter;
    const name = req.employee_name || '';
    const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          req.reason?.toLowerCase().includes(searchTerm.toLowerCase());
    const reqWorkedDate = req.worked_date ? req.worked_date.split('T')[0] : '';
    const matchesFromDate = !fromDateFilter || reqWorkedDate >= fromDateFilter;
    const matchesToDate = !toDateFilter || reqWorkedDate <= toDateFilter;
    return matchesStatus && matchesSearch && matchesFromDate && matchesToDate;
  });

  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('superadmin');
  const isManager = !isSuperAdmin && roles.some(r => {
    const lr = r.toLowerCase();
    return lr.includes('manager') || lr.includes('head') || lr.includes('lead') || lr.includes('executive') || lr.includes('director') || lr.includes('supervisor');
  });

  return (
    <div style={{ fontFamily: "'Poppins', 'Inter', sans-serif" }} className="space-y-6 pb-12">
      <DashboardPageHeader
        title="Comp-Off Claims & Approvals"
        companyId={companyId}
        isSuperAdmin={isSuperAdmin}
        email={email}
        hideCompanySelect={true}
        hideUserBadge={true}
      />

      {/* 📊 4. LIGHT GRADIENT STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Claims */}
        <div 
          style={{ boxShadow: 'rgba(14, 30, 37, 0.08) 0px 2px 4px 0px, rgba(14, 30, 37, 0.16) 0px 2px 12px 0px' }}
          className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50/90 via-purple-50/70 to-blue-50/90 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-blue-950/40 border border-indigo-200/80 dark:border-indigo-800/50 flex items-center justify-between transition-all duration-300 hover:-translate-y-0.5"
        >
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 block">
              Total Claims
            </span>
            <span className="text-3xl font-black mt-1 block tracking-tight text-slate-850 dark:text-slate-100 font-mono">
              {compOffRequests.length}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center justify-center font-bold text-xl shadow-xs">
            <i className="fa-solid fa-hourglass-half"></i>
          </div>
        </div>

        {/* Card 2: Pending Review */}
        <div 
          style={{ boxShadow: 'rgba(14, 30, 37, 0.08) 0px 2px 4px 0px, rgba(14, 30, 37, 0.16) 0px 2px 12px 0px' }}
          className="p-5 rounded-2xl bg-gradient-to-br from-amber-50/90 via-orange-50/70 to-yellow-50/90 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-yellow-950/40 border border-amber-200/80 dark:border-amber-800/50 flex items-center justify-between transition-all duration-300 hover:-translate-y-0.5"
        >
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-amber-600 dark:text-amber-400 block">
              Pending Review
            </span>
            <span className="text-3xl font-black mt-1 block tracking-tight text-slate-850 dark:text-slate-100 font-mono">
              {compOffRequests.filter(r => r.status === 'PENDING').length}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60 flex items-center justify-center font-bold text-xl shadow-xs">
            <i className="fa-solid fa-bell"></i>
          </div>
        </div>

        {/* Card 3: Approved Credits */}
        <div 
          style={{ boxShadow: 'rgba(14, 30, 37, 0.08) 0px 2px 4px 0px, rgba(14, 30, 37, 0.16) 0px 2px 12px 0px' }}
          className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50/90 via-teal-50/70 to-green-50/90 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-green-950/40 border border-emerald-200/80 dark:border-emerald-800/50 flex items-center justify-between transition-all duration-300 hover:-translate-y-0.5"
        >
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 block">
              Approved Credits
            </span>
            <span className="text-3xl font-black mt-1 block tracking-tight text-slate-850 dark:text-slate-100 font-mono">
              {compOffRequests.filter(r => r.status === 'APPROVED').length}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center justify-center font-bold text-xl shadow-xs">
            <i className="fa-solid fa-award"></i>
          </div>
        </div>

        {/* Card 4: Rejected Claims */}
        <div 
          style={{ boxShadow: 'rgba(14, 30, 37, 0.08) 0px 2px 4px 0px, rgba(14, 30, 37, 0.16) 0px 2px 12px 0px' }}
          className="p-5 rounded-2xl bg-gradient-to-br from-rose-50/90 via-red-50/70 to-pink-50/90 dark:from-rose-950/40 dark:via-red-950/30 dark:to-pink-950/40 border border-rose-200/80 dark:border-rose-800/50 flex items-center justify-between transition-all duration-300 hover:-translate-y-0.5"
        >
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-rose-600 dark:text-rose-400 block">
              Rejected Claims
            </span>
            <span className="text-3xl font-black mt-1 block tracking-tight text-slate-850 dark:text-slate-100 font-mono">
              {compOffRequests.filter(r => r.status === 'REJECTED').length}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60 flex items-center justify-center font-bold text-xl shadow-xs">
            <i className="fa-solid fa-circle-xmark"></i>
          </div>
        </div>
      </div>

      {/* 🎛️ CONTROLS & FILTER BAR */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        
        {/* SCOPE SWITCHER / BADGE (LEFT) */}
        {isManager ? (
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setViewScope('my')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                viewScope === 'my'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <i className="fa-solid fa-user mr-1.5 text-xs"></i>
              My Claims
            </button>
            <button
              onClick={() => setViewScope('team')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                viewScope === 'team'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <i className="fa-solid fa-users mr-1.5 text-xs"></i>
              Team Claims Queue
            </button>
          </div>
        ) : isSuperAdmin ? (
          <div className="px-3.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center gap-1.5 shrink-0">
            <i className="fa-solid fa-building text-indigo-500"></i>
            <span>Organization Comp-Off Claims Queue</span>
          </div>
        ) : (
          <div className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 shrink-0">
            <i className="fa-solid fa-user text-slate-400"></i>
            <span>My Comp-Off Claims</span>
          </div>
        )}

        {/* RIGHT GROUP: SEARCH -> FROM/TO DATE FILTERS -> STATUS PILLS -> CLAIM COMP-OFF BUTTON */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto flex-wrap">
          
          {/* 1. SEARCH INPUT */}
          <div className="relative w-full sm:w-44">
            <i className="fa-solid fa-magnifying-glass text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 text-xs pointer-events-none"></i>
            <input
              type="text"
              placeholder="Search employee..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-search pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold placeholder:text-slate-400 text-slate-800 dark:text-slate-100 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
          </div>

          {/* 2. FROM DATE FILTER */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider shrink-0">From:</span>
            <div className="relative w-36">
              <input
                type="date"
                max={todayStr}
                value={fromDateFilter}
                onChange={e => setFromDateFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500 transition-all cursor-pointer"
              />
              {fromDateFilter && (
                <button
                  onClick={() => setFromDateFilter('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500 text-[10px] cursor-pointer"
                  title="Clear From Date"
                >
                  <i className="fa-solid fa-circle-xmark"></i>
                </button>
              )}
            </div>
          </div>

          {/* 3. TO DATE FILTER */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider shrink-0">To:</span>
            <div className="relative w-36">
              <input
                type="date"
                max={todayStr}
                value={toDateFilter}
                onChange={e => setToDateFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500 transition-all cursor-pointer"
              />
              {toDateFilter && (
                <button
                  onClick={() => setToDateFilter('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500 text-[10px] cursor-pointer"
                  title="Clear To Date"
                >
                  <i className="fa-solid fa-circle-xmark"></i>
                </button>
              )}
            </div>
          </div>

          {/* 3. STATUS FILTER PILLS */}
          <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60 w-full sm:w-auto overflow-x-auto">
            {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3.5 py-1.5 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                  statusFilter === st
                    ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-600/25 scale-[1.02]'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-semibold'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* 4. CLAIM COMP-OFF BUTTON (NOT SHOWN FOR SUPERADMIN) */}
          {!isSuperAdmin && (
            <button
              onClick={handleOpenDrawer}
              className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-indigo-600 via-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-extrabold rounded-xl shadow-md shadow-indigo-600/20 hover:shadow-lg hover:scale-[1.02] transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
            >
              <i className="fa-solid fa-plus text-xs"></i>
              <span>Claim Comp-Off</span>
            </button>
          )}

        </div>
      </div>

      {/* 📜 COMP-OFF TABLE */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
            <span className="text-xs font-medium text-slate-400">Loading comp-off claims...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <i className="fa-solid fa-folder-open text-4xl text-slate-300 dark:text-slate-600 block mb-3"></i>
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">No Comp-Off Claims Found</h4>
            <p className="text-xs text-slate-400 mt-1">Click "Claim Comp-Off" to request credit for worked weekend days.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="p-4 w-16 text-center">SL. NO</th>
                  <th className="p-4">Employee</th>
                  <th className="p-4">Worked Date</th>
                  <th className="p-4">Claim Type</th>
                  <th className="p-4">Reason</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {filtered.map((req, idx) => (
                  <tr key={req.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="p-4 text-center font-bold text-slate-400 dark:text-slate-500 font-mono text-[11px]">
                      {String(idx + 1).padStart(2, '0')}
                    </td>
                    <td className="p-4 font-bold text-slate-800 dark:text-slate-100">
                      {req.employee_name || 'Staff Member'}
                    </td>
                    <td className="p-4 font-semibold text-slate-700 dark:text-slate-200">
                      <i className="fa-solid fa-calendar-day text-indigo-500 mr-1.5"></i>
                      {req.worked_date?.split('T')[0]}
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-extrabold text-[10.5px] border border-indigo-200/60 dark:border-indigo-800/60">
                        {req.comp_off_type}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600 dark:text-slate-300 max-w-[220px]">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate block font-medium">
                          {req.reason
                            ? (req.reason.length > 22 ? `${req.reason.substring(0, 22)}...` : req.reason)
                            : 'N/A'}
                        </span>
                        {req.reason && req.reason.length > 22 && (
                          <button
                            onClick={() => setSelectedReason(req.reason)}
                            title="Click to view full reason"
                            className="px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 rounded-md border border-indigo-200/80 dark:border-indigo-800/60 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 dark:hover:text-white transition-all shrink-0 cursor-pointer shadow-2xs"
                          >
                            View
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-[10.5px] font-extrabold uppercase tracking-wide inline-flex items-center gap-1.5 ${
                        req.status === 'APPROVED' ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' :
                        req.status === 'REJECTED' ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800' :
                        'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                      }`}>
                        <i className={`fa-solid ${
                          req.status === 'APPROVED' ? 'fa-circle-check text-emerald-500' :
                          req.status === 'REJECTED' ? 'fa-circle-xmark text-rose-500' :
                          'fa-clock text-amber-500'
                        }`}></i>
                        <span>{req.status}</span>
                      </span>
                    </td>
                    {/* 5. STYLED APPROVE / REJECT BUTTONS */}
                    <td className="p-4 text-right">
                      {req.status === 'PENDING' && viewScope === 'team' ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setActionModal({ open: true, req, type: 'APPROVE' })}
                            className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-emerald-500/20 transition-all hover:scale-105 flex items-center gap-1.5 cursor-pointer"
                          >
                            <i className="fa-solid fa-check text-xs"></i>
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => setActionModal({ open: true, req, type: 'REJECT' })}
                            className="px-3.5 py-1.5 bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-rose-500/20 transition-all hover:scale-105 flex items-center gap-1.5 cursor-pointer"
                          >
                            <i className="fa-solid fa-xmark text-xs"></i>
                            <span>Reject</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">No action</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 🚪 CLAIM COMP-OFF DRAWER */}
      <SlideDrawer
        isOpen={compOffDrawerOpen}
        onClose={() => setCompOffDrawerOpen(false)}
        title="Claim Comp-Off Credit"
      >
        <form onSubmit={handleClaimCompOff} className="space-y-4 p-4">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Select Worked Weekend / Holiday Date *
            </label>
            {isFetchingEligible ? (
              <div className="text-xs text-slate-400 p-3 bg-slate-50 rounded-xl">Fetching eligible dates...</div>
            ) : eligibleDates.length === 0 ? (
              <div>
                <input
                  type="date"
                  max={todayStr}
                  value={compOffForm.worked_date}
                  onChange={e => setCompOffForm(prev => ({ ...prev, worked_date: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-1 block">No auto-detected overtime logs. Enter worked date manually.</span>
              </div>
            ) : (
              <select
                value={compOffForm.worked_date}
                onChange={e => setCompOffForm(prev => ({ ...prev, worked_date: e.target.value }))}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                required
              >
                <option value="">-- Choose Date --</option>
                {eligibleDates.map(d => (
                  <option key={d.date} value={d.date}>
                    📅 {d.date} ({d.reason || 'Weekend/Holiday Punch'})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Claim Duration Type</label>
            <div className="grid grid-cols-2 gap-2">
              {['FULL_DAY', 'HALF_DAY'].map(type => (
                <button
                  type="button"
                  key={type}
                  onClick={() => setCompOffForm(prev => ({ ...prev, comp_off_type: type }))}
                  className={`py-2 text-xs font-bold rounded-xl border ${
                    compOffForm.comp_off_type === type
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-600'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  {type === 'FULL_DAY' ? 'Full Day (1.0 Credit)' : 'Half Day (0.5 Credit)'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Reason / Project Notes *</label>
            <textarea
              rows={3}
              placeholder="State reason or project task completed on this day..."
              value={compOffForm.reason}
              onChange={e => setCompOffForm(prev => ({ ...prev, reason: e.target.value }))}
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
              required
            />
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 bg-indigo-600 text-white font-bold text-xs rounded-xl shadow"
            >
              {isSaving ? 'Submitting...' : 'Submit Claim'}
            </button>
            <button
              type="button"
              onClick={() => setCompOffDrawerOpen(false)}
              className="px-4 py-2.5 border text-xs font-bold rounded-xl"
            >
              Cancel
            </button>
          </div>
        </form>
      </SlideDrawer>

      {/* 💬 ACTION MODAL */}
      {actionModal.open && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
              {actionModal.type === 'APPROVE' ? 'Approve Comp-Off Claim' : 'Reject Comp-Off Claim'}
            </h4>
            
            <p className="text-xs text-slate-500">
              Confirm {actionModal.type.toLowerCase()} for <strong className="text-slate-800 dark:text-slate-200">{actionModal.req?.employee_name}</strong> on date {actionModal.req?.worked_date?.split('T')[0]}.
            </p>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Remarks</label>
              <textarea
                rows={3}
                placeholder="Manager comments..."
                value={managerRemarks}
                onChange={e => setManagerRemarks(e.target.value)}
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 rounded-xl text-xs"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleProcessCompOff}
                disabled={isSaving}
                className={`flex-1 py-2.5 text-white font-bold text-xs rounded-xl shadow ${
                  actionModal.type === 'APPROVE' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'
                }`}
              >
                {isSaving ? 'Processing...' : `Confirm ${actionModal.type}`}
              </button>
              <button
                onClick={() => setActionModal({ open: false, req: null, type: 'APPROVE' })}
                className="px-4 py-2.5 border text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📜 FULL REASON MODAL POPOVER */}
      {selectedReason && (
        <div className="fixed inset-0 z-[110] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => setSelectedReason(null)}>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-scaleUp" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
                  <i className="fa-solid fa-file-text"></i>
                </div>
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-100">
                  Full Comp-Off Reason
                </h4>
              </div>
              <button onClick={() => setSelectedReason(null)} className="text-slate-400 hover:text-rose-500 transition-colors p-1 cursor-pointer">
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 font-medium leading-relaxed max-h-60 overflow-y-auto">
              {selectedReason}
            </div>

            <div className="text-right">
              <button
                onClick={() => setSelectedReason(null)}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-sm transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
