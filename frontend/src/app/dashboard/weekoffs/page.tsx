'use client';

import React, { useEffect, useState } from 'react';
import DashboardPageHeader from '../components/DashboardPageHeader';
import { getHeaders } from '../utils/api';
import { useDashboard } from '../components/DashboardContext';
import { usePermissions } from '../hooks/usePermissions';

interface Company {
  id: string;
  name: string;
  subdomain: string;
  status: string;
  created_at: string;
}

interface SeasonalPeriod {
  id: string;
  startMonth: number;
  endMonth: number;
  off_days: string[];
  alternate_rules: Record<string, number[]>;
}

export default function WeekOffsPage() {
  const { showToast } = useDashboard();
  const { hasPermission } = usePermissions();
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [allWeekoffs, setAllWeekoffs] = useState<any[]>([]);
  const [isAllScope, setIsAllScope] = useState<boolean>(false);
  const [policyToDelete, setPolicyToDelete] = useState<any | null>(null);
  
  // Week-off configuration states
  const [weekoff, setWeekoff] = useState<any>(null);
  const [weekoffForm, setWeekoffForm] = useState({
    name: 'Standard Week-off',
    off_days: [] as string[]
  });
  const [alternateRules, setAlternateRules] = useState<Record<string, number[]>>({});

  // Seasonal periods advanced states
  const [policyType, setPolicyType] = useState<'year-round' | 'seasonal'>('year-round');
  const [seasonalPeriods, setSeasonalPeriods] = useState<SeasonalPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const currentPeriod = policyType === 'seasonal'
    ? seasonalPeriods.find(p => p.id === selectedPeriodId)
    : null;

  const getPeriodValidation = () => {
    if (policyType !== 'seasonal') return { isValid: true, error: '', coveredCount: 12 };
    if (seasonalPeriods.length === 0) return { isValid: true, error: '', coveredCount: 0 };

    const monthCounts = new Array(13).fill(0); // 1-indexed
    let hasOverlap = false;
    const overlappingMonths: number[] = [];

    for (const p of seasonalPeriods) {
      const start = p.startMonth;
      const end = p.endMonth;

      if (start <= end) {
        for (let m = start; m <= end; m++) {
          monthCounts[m]++;
          if (monthCounts[m] > 1 && !overlappingMonths.includes(m)) {
            overlappingMonths.push(m);
            hasOverlap = true;
          }
        }
      } else {
        // Wrap around range (e.g. Dec to Feb)
        let m = start;
        while (true) {
          monthCounts[m]++;
          if (monthCounts[m] > 1 && !overlappingMonths.includes(m)) {
            overlappingMonths.push(m);
            hasOverlap = true;
          }
          if (m === end) break;
          m = m === 12 ? 1 : m + 1;
        }
      }
    }

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (hasOverlap) {
      const overlapStr = overlappingMonths.map(m => monthNames[m - 1]).join(', ');
      return {
        isValid: false,
        error: `Overlapping months detected: ${overlapStr}. Please ensure each month is in only one range.`,
        coveredCount: monthCounts.filter((c, i) => i > 0 && c > 0).length
      };
    }

    const coveredCount = monthCounts.filter((c, i) => i > 0 && c > 0).length;
    if (coveredCount < 12) {
      const uncoveredMonths: string[] = [];
      for (let m = 1; m <= 12; m++) {
        if (monthCounts[m] === 0) {
          uncoveredMonths.push(monthNames[m - 1]);
        }
      }
      return {
        isValid: false,
        error: `All 12 months must be covered to save the policy. Uncovered months: ${uncoveredMonths.join(', ')}.`,
        coveredCount
      };
    }

    return {
      isValid: true,
      error: '',
      coveredCount: 12
    };
  };

  const validation = getPeriodValidation();

  const autoTrimRedundantPeriods = (periods: SeasonalPeriod[]) => {
    const coveredMonths = new Set<number>();
    const trimmed: SeasonalPeriod[] = [];

    for (const p of periods) {
      if (coveredMonths.size === 12) {
        continue;
      }
      trimmed.push(p);

      const start = p.startMonth;
      const end = p.endMonth;
      if (start <= end) {
        for (let m = start; m <= end; m++) {
          coveredMonths.add(m);
        }
      } else {
        let m = start;
        while (true) {
          coveredMonths.add(m);
          if (m === end) break;
          m = m === 12 ? 1 : m + 1;
        }
      }
    }
    return trimmed;
  };

  const autoFillGaps = (periods: SeasonalPeriod[]) => {
    let current = [...periods];
    let attempts = 0;

    while (attempts < 12) {
      let firstUncovered = 0;
      for (let m = 1; m <= 12; m++) {
        const isCovered = current.some(p => {
          if (p.startMonth <= p.endMonth) {
            return m >= p.startMonth && m <= p.endMonth;
          } else {
            return m >= p.startMonth || m <= p.endMonth;
          }
        });
        if (!isCovered) {
          firstUncovered = m;
          break;
        }
      }

      if (firstUncovered === 0) {
        break;
      }

      let gapEnd = 12;
      for (let m = firstUncovered + 1; m <= 12; m++) {
        const isCovered = current.some(p => {
          if (p.startMonth <= p.endMonth) {
            return m >= p.startMonth && m <= p.endMonth;
          } else {
            return m >= p.startMonth || m <= p.endMonth;
          }
        });
        if (isCovered) {
          gapEnd = m - 1;
          break;
        }
      }

      const newId = 'p_auto_' + Date.now() + '_' + attempts;
      current.push({
        id: newId,
        startMonth: firstUncovered,
        endMonth: gapEnd,
        off_days: ['Sunday'],
        alternate_rules: { Sunday: [1, 2, 3, 4, 5] }
      });
      attempts++;
    }

    return current.sort((a, b) => a.startMonth - b.startMonth);
  };

  const updateSeasonalPeriodsAndTrim = (updated: SeasonalPeriod[]) => {
    const trimmed = autoTrimRedundantPeriods(updated);
    setSeasonalPeriods(trimmed);
    if (trimmed.length > 0 && !trimmed.some(p => p.id === selectedPeriodId)) {
      setSelectedPeriodId(trimmed[0].id);
    }
  };

  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('superadmin');

  useEffect(() => {
    const storedRoles = localStorage.getItem('roles');
    const storedEmail = localStorage.getItem('email');
    const storedCompanyId = localStorage.getItem('companyId');
    let parsedRoles: string[] = [];
    if (storedRoles) {
      parsedRoles = JSON.parse(storedRoles);
      setRoles(parsedRoles);
    }
    if (storedEmail) setEmail(storedEmail);
    
    const isSuper = parsedRoles.includes('SuperAdmin') || parsedRoles.includes('superadmin');
    if (isSuper) {
      setCompanyId(storedCompanyId || 'all');
    } else {
      if (storedCompanyId && storedCompanyId !== 'all') {
        setCompanyId(storedCompanyId);
      } else {
        setCompanyId(null);
      }
    }
  }, []);

  const updateCurrentPeriod = (updatedOffDays: string[], updatedAltRules: Record<string, number[]>) => {
    if (!selectedPeriodId) return;
    setSeasonalPeriods(prev => prev.map(p =>
      p.id === selectedPeriodId
        ? { ...p, off_days: updatedOffDays, alternate_rules: updatedAltRules }
        : p
    ));
  };

  const fetchWeekoffs = async () => {
    try {
      const isSuper = roles.includes('SuperAdmin') || roles.includes('superadmin');
      let queryParam = '';
      if (isSuper && companyId) {
        queryParam = `?companyId=${companyId}`;
      } else if (!isSuper && companyId && companyId !== 'all') {
        queryParam = `?companyId=${companyId}`;
      }
      const res = await fetch(`http://localhost:5000/api/v1/weekoffs${queryParam}`, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        if (data.isAll) {
          setIsAllScope(true);
          setAllWeekoffs(data.weekoffs || []);
          setWeekoff(null);
          setCompanyName('');
        } else {
          setIsAllScope(false);
          setAllWeekoffs([]);
          if (data.companyName) {
            setCompanyName(data.companyName);
          } else {
            setCompanyName('');
          }
          const val = data.weekoff || null;
          setWeekoff(val);
          if (val) {
            let parsedOffDays: string[] = [];
            let parsedAltRules: any = {};
            try {
              parsedOffDays = typeof val.off_days === 'string' ? JSON.parse(val.off_days) : val.off_days;
            } catch (e) { parsedOffDays = []; }
            if (!parsedOffDays || !Array.isArray(parsedOffDays)) parsedOffDays = [];

            try {
              parsedAltRules = typeof val.alternate_rules === 'string' ? JSON.parse(val.alternate_rules) : val.alternate_rules;
            } catch (e) { parsedAltRules = {}; }
            if (!parsedAltRules) parsedAltRules = {};

            setWeekoffForm({
              name: val.name || 'Standard Week-off',
              off_days: parsedOffDays
            });

            if (parsedAltRules && parsedAltRules.type === 'seasonal') {
              setPolicyType('seasonal');
              setSeasonalPeriods(parsedAltRules.periods || []);
              if (parsedAltRules.periods && parsedAltRules.periods.length > 0) {
                setSelectedPeriodId(parsedAltRules.periods[0].id);
              }
              setAlternateRules({});
            } else {
              setPolicyType('year-round');
              setAlternateRules(parsedAltRules || {});
              setSeasonalPeriods([]);
              setSelectedPeriodId('');
            }
          } else {
            // Reset forms if no policy set
            setWeekoffForm({
              name: 'Standard Week-off',
              off_days: []
            });
            setAlternateRules({});
            setPolicyType('year-round');
            setSeasonalPeriods([]);
            setSelectedPeriodId('');
          }
        }
      }
    } catch (e) {
      console.error(e);
      showToast('Failed to fetch week-off policy.', 'error');
    }
  };

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

  useEffect(() => {
    fetchWeekoffs();
  }, [companyId, roles]);

  const handleCompanyChange = (id: string) => {
    const val = id || null;
    setCompanyId(val);
    if (val) {
      localStorage.setItem('companyId', val);
    } else {
      localStorage.removeItem('companyId');
    }
  };

  const handleSaveWeekoffs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (policyType === 'seasonal') {
      const v = getPeriodValidation();
      if (!v.isValid) {
        showToast(v.error, 'error');
        return;
      }
    }
    try {
      const payloadAlternateRules = policyType === 'seasonal'
        ? { type: 'seasonal', periods: seasonalPeriods }
        : alternateRules;

      const res = await fetch('http://localhost:5000/api/v1/weekoffs', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          companyId,
          name: weekoffForm.name,
          off_days: policyType === 'seasonal' ? [] : weekoffForm.off_days,
          alternate_rules: payloadAlternateRules
        })
      });
      if (res.ok) {
        showToast('Week-off policy saved successfully!', 'success');
        setIsDrawerOpen(false);
        fetchWeekoffs();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to save week-off policy', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Connection to server failed', 'error');
    }
  };

  const handleDeletePolicy = () => {
    if (!companyId) return;
    setPolicyToDelete(null);
    setShowDeleteConfirm(true);
  };

  const executeDeletePolicy = async () => {
    const targetCompanyId = policyToDelete ? policyToDelete.company_id : companyId;
    if (!targetCompanyId) return;
    try {
      const res = await fetch(`http://localhost:5000/api/v1/weekoffs?companyId=${targetCompanyId}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (res.ok) {
        showToast('Week-off policy deleted successfully!', 'success');
        setPolicyToDelete(null);
        if (!policyToDelete) {
          setWeekoff(null);
          setWeekoffForm({ name: 'Standard Week-off', off_days: [] });
          setAlternateRules({});
          setPolicyType('year-round');
          setSeasonalPeriods([]);
          setSelectedPeriodId('');
        }
        fetchWeekoffs();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to delete policy', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('An error occurred while deleting the policy.', 'error');
    }
  };

  const handleEditPolicyFromAll = (policy: any) => {
    setCompanyId(policy.company_id);
    localStorage.setItem('companyId', policy.company_id);
    setWeekoff(policy);
    setCompanyName(policy.company_name || '');
    
    let parsedOffDays: string[] = [];
    let parsedAltRules: any = {};
    try {
      parsedOffDays = typeof policy.off_days === 'string' ? JSON.parse(policy.off_days) : policy.off_days;
    } catch (e) { parsedOffDays = []; }
    if (!parsedOffDays || !Array.isArray(parsedOffDays)) parsedOffDays = [];

    try {
      parsedAltRules = typeof policy.alternate_rules === 'string' ? JSON.parse(policy.alternate_rules) : policy.alternate_rules;
    } catch (e) { parsedAltRules = {}; }
    if (!parsedAltRules) parsedAltRules = {};

    setWeekoffForm({
      name: policy.name || 'Standard Week-off',
      off_days: parsedOffDays
    });

    if (parsedAltRules && parsedAltRules.type === 'seasonal') {
      setPolicyType('seasonal');
      setSeasonalPeriods(parsedAltRules.periods || []);
      if (parsedAltRules.periods && parsedAltRules.periods.length > 0) {
        setSelectedPeriodId(parsedAltRules.periods[0].id);
      }
      setAlternateRules({});
    } else {
      setPolicyType('year-round');
      setAlternateRules(parsedAltRules || {});
      setSeasonalPeriods([
        {
          id: 'p_init',
          startMonth: 1,
          endMonth: 12,
          off_days: ['Sunday'],
          alternate_rules: { Sunday: [1, 2, 3, 4, 5] }
        }
      ]);
      setSelectedPeriodId('p_init');
    }
    setIsDrawerOpen(true);
  };

  const handleDeletePolicyFromAll = (policy: any) => {
    setPolicyToDelete(policy);
    setShowDeleteConfirm(true);
  };

  const openConfigureDrawer = () => {
    if (weekoff) {
      let parsedOffDays: string[] = [];
      let parsedAltRules: any = {};
      try {
        parsedOffDays = typeof weekoff.off_days === 'string' ? JSON.parse(weekoff.off_days) : weekoff.off_days;
      } catch (e) { parsedOffDays = []; }
      if (!parsedOffDays || !Array.isArray(parsedOffDays)) parsedOffDays = [];

      try {
        parsedAltRules = typeof weekoff.alternate_rules === 'string' ? JSON.parse(weekoff.alternate_rules) : weekoff.alternate_rules;
      } catch (e) { parsedAltRules = {}; }
      if (!parsedAltRules) parsedAltRules = {};

      setWeekoffForm({
        name: weekoff.name || 'Standard Week-off',
        off_days: parsedOffDays
      });

      if (parsedAltRules && parsedAltRules.type === 'seasonal') {
        setPolicyType('seasonal');
        setSeasonalPeriods(parsedAltRules.periods || []);
        if (parsedAltRules.periods && parsedAltRules.periods.length > 0) {
          setSelectedPeriodId(parsedAltRules.periods[0].id);
        }
        setAlternateRules({});
      } else {
        setPolicyType('year-round');
        setAlternateRules(parsedAltRules || {});
        setSeasonalPeriods([
          {
            id: 'p_init',
            startMonth: 1,
            endMonth: 12,
            off_days: ['Sunday'],
            alternate_rules: { Sunday: [1, 2, 3, 4, 5] }
          }
        ]);
        setSelectedPeriodId('p_init');
      }
    } else {
      setWeekoffForm({
        name: 'Standard Week-off',
        off_days: []
      });
      setPolicyType('year-round');
      setAlternateRules({});
      setSeasonalPeriods([
        {
          id: 'p_init',
          startMonth: 1,
          endMonth: 12,
          off_days: ['Sunday'],
          alternate_rules: { Sunday: [1, 2, 3, 4, 5] }
        }
      ]);
      setSelectedPeriodId('p_init');
    }
    setIsDrawerOpen(true);
  };

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Parse saved data for display on the main page
  let savedOffDays: string[] = [];
  let savedAltRules: any = {};
  let savedPolicyType: 'year-round' | 'seasonal' = 'year-round';
  let savedSeasonalPeriods: SeasonalPeriod[] = [];
  let savedPolicyName = 'Standard Week-off';

  const getMonthName = (m: number) => monthNames[m - 1] || '';

  if (weekoff) {
    savedPolicyName = weekoff.name || 'Standard Week-off';
    try {
      savedOffDays = typeof weekoff.off_days === 'string' ? JSON.parse(weekoff.off_days) : weekoff.off_days;
    } catch (e) { savedOffDays = []; }
    if (!savedOffDays || !Array.isArray(savedOffDays)) savedOffDays = [];

    try {
      savedAltRules = typeof weekoff.alternate_rules === 'string' ? JSON.parse(weekoff.alternate_rules) : weekoff.alternate_rules;
    } catch (e) { savedAltRules = {}; }
    if (!savedAltRules) savedAltRules = {};

    if (savedAltRules && savedAltRules.type === 'seasonal') {
      savedPolicyType = 'seasonal';
      savedSeasonalPeriods = savedAltRules.periods || [];
    }
  }

  const activeCoName = companyName || (companyId && companies.find(c => c.id === companyId)?.name) || '';

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }} className="font-['DM_Sans',sans-serif] space-y-6 animate-fadeIn w-full">
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spinSlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spinSlow 8s linear infinite;
        }
      `}} />
      <DashboardPageHeader
        title="Week-off Policies Configuration"
        actionMessage=""
        actionError=""
        companies={companies}
        companyId={companyId}
        handleCompanyChange={handleCompanyChange}
        isSuperAdmin={isSuperAdmin}
        email={email}
        hideCompanySelect={!isSuperAdmin}
        hideUserBadge={true}
        noneLabel="All"
      />

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-gradient-to-br from-blue-500/15 to-indigo-500/15 border border-blue-500/25 text-blue-600 dark:text-blue-400 shadow-sm flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </span>
            <div>
              <h3 className="text-sm font-black text-slate-850 dark:text-slate-100 uppercase tracking-widest text-left font-sans">Week-off Policy Settings</h3>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-0.5 text-left font-sans">Configure recurring weekly holidays and custom seasonal periods</p>
            </div>
          </div>
        </div>

        {isAllScope ? (
          allWeekoffs.length === 0 ? (
            <div className="w-full rounded-[24px] border border-slate-200/50 dark:border-slate-800/80 bg-white/50 dark:bg-slate-900/10 backdrop-blur-md p-12 text-center shadow-lg border-t-[3px] border-t-indigo-500/50 dark:border-t-indigo-600/50">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-5 border border-indigo-500/20 shadow-inner">
                <svg className="w-7 h-7 animate-pulse" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
              </div>
              <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest mb-2 font-sans">No policies configured yet</h4>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold max-w-sm mx-auto font-sans leading-relaxed">
                No companies have a week-off policy configured. Please select a company from the dropdown list to configure its first policy.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-8 w-full">
              {allWeekoffs.map(policy => {
                let pOffDays: string[] = [];
                let pAltRules: any = {};
                let pPolicyType: 'year-round' | 'seasonal' = 'year-round';
                let pSeasonalPeriods: SeasonalPeriod[] = [];

                try {
                  pOffDays = typeof policy.off_days === 'string' ? JSON.parse(policy.off_days) : policy.off_days;
                } catch (e) { pOffDays = []; }
                if (!pOffDays || !Array.isArray(pOffDays)) pOffDays = [];

                try {
                  pAltRules = typeof policy.alternate_rules === 'string' ? JSON.parse(policy.alternate_rules) : policy.alternate_rules;
                } catch (e) { pAltRules = {}; }
                if (!pAltRules) pAltRules = {};

                if (pAltRules && pAltRules.type === 'seasonal') {
                  pPolicyType = 'seasonal';
                  pSeasonalPeriods = pAltRules.periods || [];
                }

                return (
                  <div key={policy.id} className="w-full rounded-[24px] border border-slate-200/50 dark:border-slate-800/80 bg-white dark:bg-slate-950 p-7 shadow-lg space-y-7 text-left border-t-[3px] border-t-blue-500/80 dark:border-t-blue-600/80 transition-all hover:shadow-xl hover:shadow-blue-500/5 duration-300">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/60 pb-5">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h4 className="text-base font-black text-slate-800 dark:text-slate-100 font-sans tracking-wide">{policy.name || 'Standard Week-off'}</h4>
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1 shadow-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active
                          </span>
                          <span className="px-3 py-0.5 rounded-full bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/60 text-[10px] font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5 shadow-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                            {policy.company_name}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold font-sans">
                          Active policy applied to all employees of this tenant
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 self-start md:self-center">
                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800 px-3 py-1.5 rounded-xl shadow-inner">
                          <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest font-sans">Policy Mode:</span>
                          <span className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider font-sans flex items-center gap-1">
                            {pPolicyType === 'year-round' ? '📅 Year-Round' : '🌀 Seasonal Periods'}
                          </span>
                        </div>
                        
                        {hasPermission('edit_weekoff_masters') && (
                          <button
                            onClick={() => handleEditPolicyFromAll(policy)}
                            className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/45 border border-blue-200 dark:border-blue-900/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900 text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm"
                            title="Edit Policy"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                            </svg>
                            Edit
                          </button>
                        )}

                        {hasPermission('delete_weekoff_masters') && (
                          <button
                            onClick={() => handleDeletePolicyFromAll(policy)}
                            className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/45 border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-455 hover:bg-rose-100 dark:hover:bg-rose-900 text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm"
                            title="Delete Policy"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                            Delete
                          </button>
                        )}
                      </div>
                    </div>

                    {pPolicyType === 'year-round' ? (
                      <div className="space-y-4 animate-fadeIn">
                        <h5 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest font-sans">Weekly Off-Days Summary</h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4">
                          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
                            const isOff = pOffDays && pOffDays.includes(day);
                            const weeks = (pAltRules && pAltRules[day]) || [];
                            return (
                              <div 
                                key={day} 
                                className={`p-4 rounded-2xl border transition-all duration-350 flex flex-col justify-between h-30 hover:scale-[1.015] ${
                                  isOff 
                                    ? 'bg-gradient-to-br from-blue-500/5 to-indigo-500/5 dark:from-blue-900/10 dark:to-indigo-900/15 border-blue-300 dark:border-blue-900/80 shadow-md shadow-blue-500/5'
                                    : 'bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-750'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-black text-slate-850 dark:text-slate-200 uppercase tracking-wider font-sans">
                                    {day.substring(0, 3)}
                                  </span>
                                  <span className={`w-2 h-2 rounded-full ${isOff ? 'bg-blue-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-600'}`} />
                                </div>

                                <div className="mt-2">
                                  <span className={`block text-[8px] font-black uppercase tracking-widest ${
                                    isOff ? 'text-blue-600 dark:text-blue-450 font-black' : 'text-slate-450 dark:text-slate-500'
                                  }`}>
                                    {isOff 
                                      ? weeks.length === 0
                                        ? 'No weeks selected'
                                        : weeks.length === 5
                                          ? 'All weeks off'
                                          : `Weeks: ${weeks.join(', ')}`
                                      : 'Working Day'
                                    }
                                  </span>
                                </div>

                                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-850 flex items-center justify-center min-h-[35px]">
                                  {isOff ? (
                                    <div className="flex items-center gap-1.2 animate-fadeIn">
                                      {[1, 2, 3, 4, 5].map(weekNum => {
                                        const isWeekOff = weeks.includes(weekNum);
                                        return (
                                          <span
                                            key={weekNum}
                                            className={`w-5.5 h-5.5 rounded-lg text-[8px] flex items-center justify-center transition-all border ${
                                              isWeekOff
                                                ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-200/80 dark:border-blue-900/60 text-blue-600 dark:text-blue-400 font-extrabold shadow-sm scale-105'
                                                : 'bg-slate-50/50 dark:bg-slate-900/50 border-slate-200/30 dark:border-slate-800/80 text-slate-400 dark:text-slate-500 font-medium'
                                            }`}
                                          >
                                            {weekNum}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium italic uppercase tracking-wider font-sans">No off-weeks</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4 animate-fadeIn">
                        <h5 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest font-sans">Seasonal Cycles & Periods</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                          {pSeasonalPeriods.map((period, index) => {
                            const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                            const dayLetters: Record<string, string> = {
                              Monday: 'M', Tuesday: 'T', Wednesday: 'W', Thursday: 'T', Friday: 'F', Saturday: 'S', Sunday: 'S'
                            };
                            return (
                              <div 
                                key={period.id} 
                                className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between min-h-[155px] shadow-sm hover:shadow-md hover:scale-[1.015] transition-all duration-350 text-left"
                              >
                                <div>
                                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/85 pb-2.5 mb-4">
                                    <span className="text-[10px] font-black text-slate-850 dark:text-slate-200 uppercase tracking-widest font-sans flex items-center gap-2">
                                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500/85 dark:bg-blue-600/85 shadow-sm" />
                                      Period {index + 1}: {getMonthName(period.startMonth)} - {getMonthName(period.endMonth)}
                                    </span>
                                    <span className="px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 text-[8px] font-black uppercase tracking-wider font-sans">
                                      {period.endMonth >= period.startMonth 
                                        ? period.endMonth - period.startMonth + 1 
                                        : 12 - period.startMonth + period.endMonth + 1} Months
                                    </span>
                                  </div>
                                  
                                  <div className="flex items-center gap-2 mb-4 justify-between px-1">
                                    {daysOrder.map(day => {
                                      const isOff = period.off_days && period.off_days.includes(day);
                                      return (
                                        <div key={day} className="flex flex-col items-center gap-1">
                                          <span 
                                            className={`w-6 h-6 rounded-lg text-[9px] font-black flex items-center justify-center border transition-all duration-200 ${
                                              isOff
                                                ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20 scale-105'
                                                : 'bg-transparent border-slate-200 dark:border-slate-800/80 text-slate-400 dark:text-slate-500'
                                            }`} 
                                            title={day}
                                          >
                                            {dayLetters[day]}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>

                                <div className="border-t border-slate-100 dark:border-slate-800/85 pt-3 mt-1 space-y-1">
                                  {!period.off_days || period.off_days.length === 0 ? (
                                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 italic uppercase tracking-wider">No off-days configured</span>
                                  ) : (
                                    <div className="flex flex-wrap gap-1.5">
                                      {period.off_days.map(day => {
                                        const weeks = (period.alternate_rules && period.alternate_rules[day]) || [];
                                        return (
                                          <span 
                                            key={day} 
                                            className="inline-flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950 border border-blue-500/20 rounded-md px-2 py-0.5 text-[8px] font-black text-blue-700 dark:text-blue-300 uppercase tracking-widest shadow-sm"
                                          >
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                            {day.substring(0, 3)}: {weeks.length === 5 ? 'All' : weeks.join(',')}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : !companyId ? (
          <div className="max-w-xl rounded-[24px] border border-slate-200/50 dark:border-slate-800/80 bg-white/50 dark:bg-slate-900/10 backdrop-blur-md p-10 text-center shadow-lg animate-fadeIn border-t-[3px] border-t-blue-500/50 dark:border-t-blue-600/50 mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-5 border border-blue-500/20 shadow-inner">
              <svg className="w-6 h-6 animate-pulse" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.656 48.656 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3M3 12c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M3 12l3 3m-3-3l-3 3" />
              </svg>
            </div>
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest mb-2.5 font-sans">No Company Selected</h4>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold max-w-sm mx-auto font-sans leading-relaxed">
              Please select a company from the dropdown menu in the header to configure weekly off days.
            </p>
          </div>
        ) : !weekoff ? (
          <div className="w-full rounded-[24px] border border-slate-200/50 dark:border-slate-800/80 bg-white/50 dark:bg-slate-900/10 backdrop-blur-md p-12 text-center shadow-lg animate-fadeIn border-t-[3px] border-t-indigo-500/50 dark:border-t-indigo-600/50">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-5 border border-indigo-500/20 shadow-inner">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </div>
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest mb-2 font-sans">No Policy Configured</h4>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold max-w-sm mx-auto mb-6 font-sans leading-relaxed">
              No week-off policy has been configured for this company yet. Get started by initializing the policy.
            </p>
            <button
              onClick={openConfigureDrawer}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-[10px] font-black uppercase tracking-wider shadow-md hover:shadow-lg shadow-blue-500/15 hover:shadow-blue-500/25 transition-all cursor-pointer transform hover:-translate-y-0.5"
            >
              Initialize Week-off Policy
            </button>
          </div>
        ) : (
          /* Active Policy Display Card */
          <div className="w-full rounded-[24px] border border-slate-200/50 dark:border-slate-800/80 bg-white dark:bg-slate-950 p-7 shadow-lg space-y-7 text-left animate-fadeIn border-t-[3px] border-t-blue-500/80 dark:border-t-blue-600/80 transition-all hover:shadow-xl hover:shadow-blue-500/5 duration-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/60 pb-5">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h4 className="text-base font-black text-slate-800 dark:text-slate-100 font-sans tracking-wide">{savedPolicyName}</h4>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Active
                  </span>
                  {activeCoName && (
                    <span className="px-3 py-0.5 rounded-full bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/60 text-[10px] font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5 shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                      {activeCoName}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold font-sans">
                  Active policy applied to all employees of this tenant
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 self-start md:self-center">
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800 px-3 py-1.5 rounded-xl shadow-inner">
                  <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest font-sans">Policy Mode:</span>
                  <span className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider font-sans flex items-center gap-1">
                    {savedPolicyType === 'year-round' ? '📅 Year-Round' : '🌀 Seasonal Periods'}
                  </span>
                </div>
                
                {hasPermission('edit_weekoff_masters') && (
                  <button
                    onClick={openConfigureDrawer}
                    className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/45 border border-blue-200 dark:border-blue-900/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900 text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm animate-fadeIn"
                    title="Edit Policy"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                    </svg>
                    Edit Policy
                  </button>
                )}

                {hasPermission('delete_weekoff_masters') && (
                  <button
                    onClick={handleDeletePolicy}
                    className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/45 border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-455 hover:bg-rose-100 dark:hover:bg-rose-900 text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm animate-fadeIn"
                    title="Delete Policy"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                    Delete Policy
                  </button>
                )}
              </div>
            </div>

            {savedPolicyType === 'year-round' ? (
              <div className="space-y-4 animate-fadeIn">
                <h5 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest font-sans">Weekly Off-Days Summary</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4">
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
                    const isOff = savedOffDays && savedOffDays.includes(day);
                    const weeks = (savedAltRules && savedAltRules[day]) || [];
                    return (
                      <div 
                        key={day} 
                        className={`p-4 rounded-2xl border transition-all duration-350 flex flex-col justify-between h-30 hover:scale-[1.015] ${
                          isOff 
                            ? 'bg-gradient-to-br from-blue-500/5 to-indigo-500/5 dark:from-blue-900/10 dark:to-indigo-900/15 border-blue-300 dark:border-blue-900/80 shadow-md shadow-blue-500/5'
                            : 'bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-750'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-850 dark:text-slate-200 uppercase tracking-wider font-sans">
                            {day.substring(0, 3)}
                          </span>
                          <span className={`w-2 h-2 rounded-full ${isOff ? 'bg-blue-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-600'}`} />
                        </div>

                        <div className="mt-2">
                          <span className={`block text-[8px] font-black uppercase tracking-widest ${
                            isOff ? 'text-blue-600 dark:text-blue-450 font-black' : 'text-slate-450 dark:text-slate-500'
                          }`}>
                            {isOff 
                              ? weeks.length === 0
                                ? 'No weeks selected'
                                : weeks.length === 5
                                  ? 'All weeks off'
                                  : `Weeks: ${weeks.join(', ')}`
                              : 'Working Day'
                            }
                          </span>
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-850 flex items-center justify-center min-h-[35px]">
                          {isOff ? (
                            <div className="flex items-center gap-1.2 animate-fadeIn">
                              {[1, 2, 3, 4, 5].map(weekNum => {
                                const isWeekOff = weeks.includes(weekNum);
                                return (
                                  <span
                                    key={weekNum}
                                    className={`w-5.5 h-5.5 rounded-lg text-[8px] flex items-center justify-center transition-all border ${
                                      isWeekOff
                                        ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-200/80 dark:border-blue-900/60 text-blue-600 dark:text-blue-400 font-extrabold shadow-sm scale-105'
                                        : 'bg-slate-50/50 dark:bg-slate-900/50 border-slate-200/30 dark:border-slate-800/80 text-slate-400 dark:text-slate-500 font-medium'
                                    }`}
                                  >
                                    {weekNum}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium italic uppercase tracking-wider font-sans">No off-weeks</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Seasonal timeline display */
              <div className="space-y-4 animate-fadeIn">
                <h5 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest font-sans">Seasonal Cycles & Periods</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {savedSeasonalPeriods.map((period, index) => {
                    const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                    const dayLetters: Record<string, string> = {
                      Monday: 'M', Tuesday: 'T', Wednesday: 'W', Thursday: 'T', Friday: 'F', Saturday: 'S', Sunday: 'S'
                    };
                    return (
                      <div 
                        key={period.id} 
                        className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between min-h-[155px] shadow-sm hover:shadow-md hover:scale-[1.015] transition-all duration-300 text-left"
                      >
                        <div>
                          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/85 pb-2.5 mb-4">
                            <span className="text-[10px] font-black text-slate-850 dark:text-slate-200 uppercase tracking-widest font-sans flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-blue-500/85 dark:bg-blue-600/85 shadow-sm" />
                              Period {index + 1}: {getMonthName(period.startMonth)} - {getMonthName(period.endMonth)}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 text-[8px] font-black uppercase tracking-wider font-sans">
                              {period.endMonth >= period.startMonth 
                                ? period.endMonth - period.startMonth + 1 
                                : 12 - period.startMonth + period.endMonth + 1} Months
                            </span>
                          </div>
                          
                          {/* Mini Day Timeline */}
                          <div className="flex items-center gap-2 mb-4 justify-between px-1">
                            {daysOrder.map(day => {
                              const isOff = period.off_days && period.off_days.includes(day);
                              return (
                                <div key={day} className="flex flex-col items-center gap-1">
                                  <span 
                                    className={`w-6 h-6 rounded-lg text-[9px] font-black flex items-center justify-center border transition-all duration-200 ${
                                      isOff
                                        ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20 scale-105'
                                        : 'bg-transparent border-slate-200 dark:border-slate-800/80 text-slate-400 dark:text-slate-500'
                                    }`} 
                                    title={day}
                                  >
                                    {dayLetters[day]}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* List of off days and active weeks */}
                        <div className="border-t border-slate-100 dark:border-slate-800/85 pt-3 mt-1 space-y-1">
                          {!period.off_days || period.off_days.length === 0 ? (
                            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 italic uppercase tracking-wider">No off-days configured</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {period.off_days.map(day => {
                                const weeks = (period.alternate_rules && period.alternate_rules[day]) || [];
                                return (
                                  <span 
                                    key={day} 
                                    className="inline-flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950 border border-blue-500/20 rounded-md px-2 py-0.5 text-[8px] font-black text-blue-700 dark:text-blue-300 uppercase tracking-widest shadow-sm"
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                    {day.substring(0, 3)}: {weeks.length === 5 ? 'All' : weeks.join(',')}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 🧭 Off-Canvas Configuration Drawer */}
      {isDrawerOpen && (
        <>
          {/* Backdrop Overlay */}
          <div 
            onClick={() => setIsDrawerOpen(false)}
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-md z-40 transition-opacity duration-300 animate-fadeIn"
          />

          {/* Drawer Body */}
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-white dark:bg-slate-950 shadow-2xl border-l border-slate-200/80 dark:border-slate-800 flex flex-col transition-all duration-300 transform animate-slideInRight text-left font-sans">
            <style dangerouslySetInnerHTML={{__html: `
              @keyframes slideInRight {
                from { transform: translateX(100%); }
                to { transform: translateX(0); }
              }
              .animate-slideInRight {
                animation: slideInRight 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards;
              }
            `}} />

            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/50 backdrop-blur-md flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20 border border-white/20">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest font-sans">Configure Week-off Policy</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-0.5 font-sans">Define recurring weekly holidays and seasonal calendar overrides</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Drawer Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Policy Name & Mode Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 p-4.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30">
                <div>
                  <label className="block text-[9.5px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 font-sans">Policy Name *</label>
                  <input
                    type="text"
                    value={weekoffForm.name}
                    onChange={e => setWeekoffForm({ ...weekoffForm, name: e.target.value })}
                    placeholder="e.g. Standard Week-off"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-sans shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-[9.5px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 font-sans">Policy Mode *</label>
                  <div className="relative flex items-center bg-slate-200/70 dark:bg-slate-900 rounded-xl p-1 w-full h-[38px] border border-slate-300/40 dark:border-slate-800 select-none">
                    <div
                      className="absolute top-1 bottom-1 rounded-lg bg-white dark:bg-slate-800 shadow-sm border border-slate-200/50 dark:border-slate-700 transition-all duration-300 ease-in-out"
                      style={{
                        left: policyType === 'year-round' ? '4px' : 'calc(50% + 2px)',
                        width: 'calc(50% - 6px)'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setPolicyType('year-round')}
                      className={`relative z-10 flex-1 text-center text-[10px] font-black uppercase tracking-wider transition-colors duration-250 cursor-pointer ${
                        policyType === 'year-round'
                          ? 'text-indigo-600 dark:text-indigo-400'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      Year-Round
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPolicyType('seasonal');
                        if (seasonalPeriods.length === 0) {
                          setSeasonalPeriods([
                            {
                              id: 'p1',
                              startMonth: 1,
                              endMonth: 12,
                              off_days: ['Saturday', 'Sunday'],
                              alternate_rules: { Saturday: [1, 3], Sunday: [1, 2, 3, 4, 5] }
                            }
                          ]);
                          setSelectedPeriodId('p1');
                        }
                      }}
                      className={`relative z-10 flex-1 text-center text-[10px] font-black uppercase tracking-wider transition-colors duration-250 cursor-pointer ${
                        policyType === 'seasonal'
                          ? 'text-indigo-600 dark:text-indigo-400'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      Seasonal Periods
                    </button>
                  </div>
                </div>
              </div>

              {policyType === 'seasonal' && (
                <div className="p-4.5 rounded-2xl border border-indigo-200/60 dark:border-indigo-900/40 bg-indigo-50/30 dark:bg-indigo-950/20 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-indigo-900 dark:text-indigo-200 uppercase tracking-widest font-sans flex items-center gap-1.5">
                      <span>🌀</span> Configured Month Ranges
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        let firstUncovered = 1;
                        for (let m = 1; m <= 12; m++) {
                          const isCovered = seasonalPeriods.some(p => {
                            if (p.startMonth <= p.endMonth) {
                              return m >= p.startMonth && m <= p.endMonth;
                            } else {
                              return m >= p.startMonth || m <= p.endMonth;
                            }
                          });
                          if (!isCovered) {
                            firstUncovered = m;
                            break;
                          }
                        }
                        const newId = 'p_' + Date.now();
                        setSeasonalPeriods([
                          ...seasonalPeriods,
                          {
                            id: newId,
                            startMonth: firstUncovered,
                            endMonth: 12,
                            off_days: [],
                            alternate_rules: {}
                          }
                        ]);
                        setSelectedPeriodId(newId);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[9.5px] font-black uppercase tracking-widest transition-all shadow-sm cursor-pointer"
                    >
                      + Add Period
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {seasonalPeriods.map((p, idx) => {
                      const isSelected = p.id === selectedPeriodId;
                      return (
                        <div
                          key={p.id}
                          onClick={() => setSelectedPeriodId(p.id)}
                          className={`p-4 rounded-2xl border cursor-pointer transition-all duration-300 flex flex-col justify-between shadow-xs hover:shadow-md ${
                            isSelected
                              ? 'bg-gradient-to-br from-indigo-500/10 to-blue-500/10 dark:from-indigo-950/40 dark:to-blue-950/40 border-indigo-500 dark:border-indigo-500 ring-2 ring-indigo-500/20'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <select
                                value={p.startMonth}
                                onChange={e => {
                                  const updated = seasonalPeriods.map(x =>
                                    x.id === p.id ? { ...x, startMonth: parseInt(e.target.value) } : x
                                  );
                                  updateSeasonalPeriodsAndTrim(autoFillGaps(updated));
                                }}
                                onClick={e => e.stopPropagation()}
                                className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1 text-[10px] font-black text-slate-800 dark:text-slate-200 outline-none cursor-pointer focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 transition-all shadow-xs"
                              >
                                {monthNames.map((m, idx) => (
                                  <option key={m} value={idx + 1}>{m}</option>
                                ))}
                              </select>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-widest font-sans">to</span>
                              <select
                                value={p.endMonth}
                                onChange={e => {
                                  const updated = seasonalPeriods.map(x =>
                                    x.id === p.id ? { ...x, endMonth: parseInt(e.target.value) } : x
                                  );
                                  updateSeasonalPeriodsAndTrim(autoFillGaps(updated));
                                }}
                                onClick={e => e.stopPropagation()}
                                className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1 text-[10px] font-black text-slate-800 dark:text-slate-200 outline-none cursor-pointer focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 transition-all shadow-xs"
                              >
                                {monthNames.map((m, idx) => (
                                  <option key={m} value={idx + 1}>{m}</option>
                                ))}
                              </select>
                            </div>

                            {seasonalPeriods.length > 1 && (
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  const updated = seasonalPeriods.filter(x => x.id !== p.id);
                                  setSeasonalPeriods(updated);
                                  if (isSelected && updated.length > 0) {
                                    setSelectedPeriodId(updated[0].id);
                                  }
                                }}
                                className="text-rose-500 hover:text-rose-600 transition-colors p-1 cursor-pointer hover:bg-rose-500/10 rounded-lg"
                                title="Delete Period"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>

                          <div className="mt-3 text-[9.5px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider font-sans border-t border-slate-100 dark:border-slate-800/80 pt-2.5">
                            {p.off_days.length === 0 ? (
                              <span className="text-slate-400 font-bold italic">No off-days configured</span>
                            ) : (
                              <span>
                                Off: {p.off_days.map(d => {
                                  const alt = p.alternate_rules[d] || [];
                                  return `${d.substring(0, 3)} (${alt.length === 5 ? 'All' : alt.join(',') || 'None'})`;
                                }).join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {validation.error && (
                    <div className="p-4 rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-start gap-2.5 animate-fadeIn shadow-xs">
                      <div className="mt-0.5 flex-shrink-0">
                        <svg className="w-4 h-4 text-rose-500 animate-bounce" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <span>{validation.error}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Configure Days Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-2">
                  <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest font-sans flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                    {policyType === 'seasonal' ? 'Configure Days for Selected Period' : 'Configure Days of the Week'}
                  </label>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Click toggles to mark week-offs
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
                    const isChecked = policyType === 'seasonal' ? (currentPeriod?.off_days.includes(day) || false) : weekoffForm.off_days.includes(day);
                    const activeWeeks = policyType === 'seasonal' ? (currentPeriod?.alternate_rules[day] || []) : (alternateRules[day] || []);

                    return (
                      <div 
                        key={day} 
                        className={`p-4.5 rounded-2xl transition-all duration-300 flex flex-col justify-between space-y-3.5 ${
                          isChecked 
                            ? 'bg-gradient-to-br from-indigo-500/10 via-blue-500/5 to-purple-500/10 dark:from-indigo-950/40 dark:via-blue-950/30 dark:to-purple-950/40 border-2 border-indigo-500/80 dark:border-indigo-500/80 shadow-md shadow-indigo-500/10'
                            : 'bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs'
                        }`}
                      >
                        {/* Day Card Header with Title & Switch */}
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <span className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider font-sans block">{day}</span>
                            <span className={`inline-block text-[9px] font-black uppercase tracking-widest mt-0.5 px-2 py-0.5 rounded-full border ${
                              isChecked 
                                ? 'bg-indigo-100/80 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' 
                                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 border-slate-200/50 dark:border-slate-700/50'
                            }`}>
                              {isChecked 
                                ? activeWeeks.length === 0
                                  ? 'No weeks selected'
                                  : activeWeeks.length === 5
                                    ? 'All weeks off'
                                    : `Weeks: ${activeWeeks.join(', ')}`
                                : 'Working Day'
                              }
                            </span>
                          </div>

                          {/* Toggle Switch */}
                          <button
                            type="button"
                            onClick={() => {
                              const currentOffDays = policyType === 'seasonal' ? (currentPeriod?.off_days || []) : weekoffForm.off_days;
                              const currentAltRules = policyType === 'seasonal' ? (currentPeriod?.alternate_rules || {}) : alternateRules;

                              const isCurrentlyChecked = currentOffDays.includes(day);
                              const updatedOffDays = isCurrentlyChecked
                                ? currentOffDays.filter(d => d !== day)
                                : [...currentOffDays, day];

                              const updatedAltRules = { ...currentAltRules };
                              if (!isCurrentlyChecked) {
                                updatedAltRules[day] = [1, 2, 3, 4, 5]; // Default all weeks on when toggled ON
                              } else {
                                delete updatedAltRules[day];
                              }

                              if (policyType === 'seasonal') {
                                updateCurrentPeriod(updatedOffDays, updatedAltRules);
                              } else {
                                setWeekoffForm({ ...weekoffForm, off_days: updatedOffDays });
                                setAlternateRules(updatedAltRules);
                              }
                            }}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-300 ease-in-out outline-none shadow-sm ${
                              isChecked ? 'bg-gradient-to-r from-indigo-600 to-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-300 ease-in-out ${
                                isChecked ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>

                        {/* Weeks Selection Row */}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-center min-h-[42px]">
                          {isChecked ? (
                            <div className="flex items-center gap-1.5 animate-fadeIn">
                              {[1, 2, 3, 4, 5].map(weekNum => {
                                const isWeekChecked = activeWeeks.includes(weekNum);
                                return (
                                  <button
                                    type="button"
                                    key={weekNum}
                                    onClick={() => {
                                      const currentAltRules = policyType === 'seasonal' ? (currentPeriod?.alternate_rules || {}) : alternateRules;
                                      const isWeekChecked = activeWeeks.includes(weekNum);

                                      const updatedWeeks = isWeekChecked
                                        ? activeWeeks.filter(w => w !== weekNum)
                                        : [...activeWeeks, weekNum].sort();

                                      const updatedAltRules = {
                                        ...currentAltRules,
                                        [day]: updatedWeeks
                                      };

                                      if (policyType === 'seasonal') {
                                        updateCurrentPeriod(policyType === 'seasonal' ? (currentPeriod?.off_days || []) : weekoffForm.off_days, updatedAltRules);
                                      } else {
                                        setAlternateRules(updatedAltRules);
                                      }
                                    }}
                                    className={`w-7 h-7 rounded-xl text-xs flex items-center justify-center transition-all cursor-pointer font-black ${
                                      isWeekChecked
                                        ? 'bg-gradient-to-tr from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-600/30 scale-105 border border-indigo-400/50'
                                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-slate-800 dark:hover:text-slate-200'
                                    }`}
                                    title={`Toggle Week ${weekNum}`}
                                  >
                                    {weekNum}
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="w-full py-1.5 text-center rounded-xl bg-slate-100/50 dark:bg-slate-950/40 border border-dashed border-slate-200 dark:border-slate-800/60">
                              <span className="text-[9.5px] text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-widest font-sans">No Off-Weeks</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Drawer Footer */}
            <div className="p-5 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-black text-slate-700 dark:text-slate-300 font-sans uppercase tracking-wider">
                  {(policyType === 'seasonal' ? (currentPeriod?.off_days.length || 0) : weekoffForm.off_days.length)} Days Off Configured
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-black uppercase tracking-wider hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveWeekoffs}
                  disabled={policyType === 'seasonal' && !validation.isValid}
                  className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white shadow-lg transition-all duration-200 flex items-center gap-2 ${
                    policyType === 'seasonal' && !validation.isValid
                      ? 'bg-slate-400/70 dark:bg-slate-700/60 cursor-not-allowed shadow-none'
                      : 'bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-indigo-600/30 cursor-pointer active:scale-[0.98]'
                  }`}
                >
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  Save Policy
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 🗑️ DELETION CONFIRMATION TOAST OVERLAY */}
      {showDeleteConfirm && (
        <>
          <div className="fixed inset-0 z-[90] bg-black/25 backdrop-blur-[2px]" onClick={() => setShowDeleteConfirm(false)} />
          <div className="fixed right-6 top-1/2 -translate-y-1/2 z-[100] w-[310px] animate-slideIn">
            <div className="rounded-2xl border border-slate-200 dark:border-rose-900/40 bg-white dark:bg-[#1c1624] shadow-2xl shadow-black/40 overflow-hidden">
              <div className="h-1 w-full bg-gradient-to-r from-rose-600 to-red-400" />
              <div className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/20 flex items-center justify-center flex-shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14H6L5 6" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4h6v2" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-455">Confirm Deletion</h4>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5">This action cannot be undone</p>
                  </div>
                </div>
                <div className="mb-5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-left">
                  <p className="text-[12px] text-slate-700 dark:text-slate-200 font-medium leading-relaxed">
                    Delete week-off policy <span className="font-black text-rose-600 dark:text-rose-400">&ldquo;{policyToDelete ? policyToDelete.name : savedPolicyName}&rdquo;</span> for <span className="font-bold text-slate-800 dark:text-slate-100">&ldquo;{policyToDelete ? policyToDelete.company_name : companyName || 'this company'}&rdquo;</span>?
                  </p>
                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium mt-1.5">
                    ⚠️ Weekly off scheduling will revert to standard working days.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { executeDeletePolicy(); setShowDeleteConfirm(false); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-[0.97] text-white text-[11px] font-bold cursor-pointer shadow-md shadow-rose-600/25 transition-all"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
                    Yes, Delete
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-bold cursor-pointer border border-slate-200 dark:border-slate-700 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}


