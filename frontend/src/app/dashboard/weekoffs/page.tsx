'use client';

import React, { useEffect, useState } from 'react';
import DashboardPageHeader from '../components/DashboardPageHeader';
import { getHeaders } from '../utils/api';
import { useDashboard } from '../components/DashboardContext';
import { usePermissions } from '../hooks/usePermissions';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

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
  const { showToast, companyId: globalCompanyId } = useDashboard();
  const { hasPermission, isSuperAdmin: isSuperAdminPerm } = usePermissions();
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);

  const isSuperAdmin = isSuperAdminPerm || roles.includes('SuperAdmin') || roles.includes('superadmin');

  // 🛡️ Standardized tablename_action Permissions
  const canView = isSuperAdmin || hasPermission('weekoffs_view') || hasPermission('view_weekoffs') || hasPermission('view_weekoff_masters');
  const canCreate = isSuperAdmin || hasPermission('weekoffs_create') || hasPermission('create_weekoffs') || hasPermission('create_weekoff_masters');
  const canEdit = isSuperAdmin || hasPermission('weekoffs_edit') || hasPermission('edit_weekoffs') || hasPermission('edit_weekoff_masters');
  const canDelete = isSuperAdmin || hasPermission('weekoffs_delete') || hasPermission('delete_weekoffs') || hasPermission('delete_weekoff_masters');

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
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const currentPeriod = policyType === 'seasonal'
    ? seasonalPeriods.find(p => p.id === selectedPeriodId)
    : null;

  // Sync local companyId with global header company selector context
  useEffect(() => {
    if (globalCompanyId !== undefined && globalCompanyId !== companyId) {
      setCompanyId(globalCompanyId);
    }
  }, [globalCompanyId]);

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
      const res = await fetch(`/api/v1/weekoffs${queryParam}`, {
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
      const res = await fetch('/api/v1/companies', { headers: getHeaders() });
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

      const res = await fetch('/api/v1/weekoffs', {
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
        setIsEditing(false);
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
      const res = await fetch(`/api/v1/weekoffs?companyId=${targetCompanyId}`, {
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
        setIsEditing(false);
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
    setIsEditing(true);
  };

  const handleDeletePolicyFromAll = (policy: any) => {
    setPolicyToDelete(policy);
    setShowDeleteConfirm(true);
  };

  const startPolicyEdit = () => {
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
    setIsEditing(true);
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

  // Render Day Cards in Policy View
  const renderDayViewCard = (day: string, pOffDays: string[], pAltRules: any, index: number = 0) => {
    const isOff = pOffDays && pOffDays.includes(day);
    const weeks = (pAltRules && pAltRules[day]) || [];
    const isFullOff = isOff && weeks.length === 5;
    const isPartialOff = isOff && weeks.length > 0 && weeks.length < 5;

    const dayMeta: Record<string, { short: string; bgLight: string; bgDark: string; borderLight: string; textLight: string }> = {
      Monday: { short: 'M', bgLight: 'bg-blue-50', bgDark: 'dark:bg-blue-950/40', borderLight: 'border-blue-200', textLight: 'text-blue-600 dark:text-blue-400' },
      Tuesday: { short: 'T', bgLight: 'bg-slate-100', bgDark: 'dark:bg-slate-800', borderLight: 'border-slate-200', textLight: 'text-slate-600 dark:text-slate-400' },
      Wednesday: { short: 'W', bgLight: 'bg-teal-50', bgDark: 'dark:bg-teal-950/40', borderLight: 'border-teal-200', textLight: 'text-teal-600 dark:text-teal-400' },
      Thursday: { short: 'T', bgLight: 'bg-indigo-50', bgDark: 'dark:bg-indigo-950/40', borderLight: 'border-indigo-200', textLight: 'text-indigo-600 dark:text-indigo-400' },
      Friday: { short: 'F', bgLight: 'bg-emerald-50', bgDark: 'dark:bg-emerald-950/40', borderLight: 'border-emerald-200', textLight: 'text-emerald-600 dark:text-emerald-400' },
      Saturday: { short: 'S', bgLight: 'bg-amber-50', bgDark: 'dark:bg-amber-950/40', borderLight: 'border-amber-200', textLight: 'text-amber-600 dark:text-amber-400' },
      Sunday: { short: 'S', bgLight: 'bg-rose-50', bgDark: 'dark:bg-rose-950/40', borderLight: 'border-rose-200', textLight: 'text-rose-600 dark:text-rose-400' },
    };

    const meta = dayMeta[day] || { short: day.charAt(0).toUpperCase(), bgLight: 'bg-slate-100', bgDark: 'dark:bg-slate-800', borderLight: 'border-slate-200', textLight: 'text-slate-600' };

    return (
      <div 
        key={day} 
        style={{ animationDelay: `${index * 40}ms` }}
        className={`relative p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between min-h-[160px] shadow-2xs hover:shadow-md font-sidebar ${
          isFullOff
            ? 'bg-blue-50/50 dark:bg-[#07518a]/10 border-[#07518a]/60 dark:border-[#38bdf8]/60'
            : isPartialOff
            ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-400/80 dark:border-amber-600/70'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
        }`}
      >
        {/* Card Top: Avatar + Name and Badge */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${meta.bgLight} ${meta.bgDark} ${meta.textLight} border ${meta.borderLight} dark:border-slate-700 shadow-2xs shrink-0 font-sidebar`}>
              {meta.short}
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-850 dark:text-slate-100 font-sidebar tracking-tight">
                {day}
              </h4>
            </div>
          </div>

          <span className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold tracking-tight whitespace-nowrap flex items-center gap-1.5 shrink-0 font-sidebar ${
            isFullOff
              ? 'bg-[#07518a] text-white shadow-xs'
              : isPartialOff
              ? 'bg-amber-500 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              isFullOff ? 'bg-white animate-pulse' : isPartialOff ? 'bg-white animate-pulse' : 'bg-slate-400 dark:bg-slate-500'
            }`} />
            {isFullOff ? 'Full Off' : isPartialOff ? 'Alternate Off' : 'Working Day'}
          </span>
        </div>

        {/* Middle Status text */}
        <div className="my-3.5">
          {isFullOff ? (
            <p className="text-xs font-bold text-[#07518a] dark:text-[#38bdf8] flex items-center gap-1.5 font-sidebar">
              <span>✨</span> All 5 Weeks Off
            </p>
          ) : isPartialOff ? (
            <p className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5 font-sidebar">
              <span>🗓️</span> Weeks: {weeks.join(', ')} Off
            </p>
          ) : (
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-sidebar">
              <span>💼</span> Full Working Day
            </p>
          )}
        </div>

        {/* Bottom 5 Week Indicators with UI Tooltip */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80">
          <div className="grid grid-cols-5 gap-2 w-full">
            {[1, 2, 3, 4, 5].map(weekNum => {
              const isWeekOff = weeks.includes(weekNum);
              return (
                <Tooltip key={weekNum} className="w-full block">
                  <TooltipTrigger asChild={false} className="w-full block">
                    <div
                      className={`w-full h-8 rounded-xl text-xs flex items-center justify-center font-bold transition-all cursor-default font-sidebar shadow-2xs ${
                        isWeekOff
                          ? isFullOff
                            ? 'bg-[#07518a] text-white shadow-xs'
                            : 'bg-amber-500 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80'
                      }`}
                    >
                      {weekNum}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {isWeekOff
                      ? isFullOff
                        ? `Week ${weekNum}: Full Off-Day`
                        : `Week ${weekNum}: Alternate Off-Day`
                      : `Week ${weekNum}: Regular Working Day`}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="font-sidebar space-y-6 animate-fadeIn w-full">
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

      {/* 🌟 FULL PAGE EDITOR OR POLICY VIEW TOGGLE */}
      {isEditing ? (
        /* ================= FULL PAGE DEDICATED POLICY CONFIGURATION EDITOR ================= */
        <div className="w-full rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md overflow-hidden text-left animate-fadeIn space-y-0">
          {/* Editor Header Bar */}
          <div className="p-6 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer shadow-2xs"
                title="Back to View"
              >
                ← Back
              </button>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest font-sans">
                  {weekoff ? 'Edit Week-off Policy' : 'Create New Week-off Policy'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-0.5 font-sans">
                  Configure recurring weekly holidays and seasonal calendar rules for {activeCoName || 'this tenant'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-black uppercase tracking-wider hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveWeekoffs}
                disabled={policyType === 'seasonal' && !validation.isValid}
                className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white shadow-md transition-all duration-200 flex items-center gap-2 border-0 ${
                  policyType === 'seasonal' && !validation.isValid
                    ? 'bg-slate-400/70 dark:bg-slate-700/60 cursor-not-allowed shadow-none'
                    : 'bg-[#07518a] hover:bg-[#053d69] shadow-[#07518a]/30 cursor-pointer active:scale-[0.98]'
                }`}
              >
                Save Policy
              </button>
            </div>
          </div>

          {/* Editor Body Container */}
          <div className="p-6 md:p-8 space-y-8">
            
            {/* Policy Name & Mode Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 font-sans">Policy Name *</label>
                <input
                  type="text"
                  value={weekoffForm.name}
                  onChange={e => setWeekoffForm({ ...weekoffForm, name: e.target.value })}
                  placeholder="e.g. Standard Week-off"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-sans shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 font-sans">Policy Mode *</label>
                <div className="relative flex items-center bg-slate-200/70 dark:bg-slate-900 rounded-xl p-1 w-full h-[42px] border border-slate-300/40 dark:border-slate-800 select-none">
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
                    className={`relative z-10 flex-1 text-center text-xs font-black uppercase tracking-wider transition-colors duration-250 cursor-pointer ${
                      policyType === 'year-round'
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    📅 Year-Round
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
                    className={`relative z-10 flex-1 text-center text-xs font-black uppercase tracking-wider transition-colors duration-250 cursor-pointer ${
                      policyType === 'seasonal'
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    🌀 Seasonal Periods
                  </button>
                </div>
              </div>
            </div>

            {/* Seasonal Periods Configurator */}
            {policyType === 'seasonal' && (
              <div className="p-6 rounded-2xl border border-indigo-200/60 dark:border-indigo-900/40 bg-indigo-50/30 dark:bg-indigo-950/20 space-y-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-indigo-900 dark:text-indigo-200 uppercase tracking-widest font-sans flex items-center gap-2">
                    <span>🌀</span> Seasonal Cycles & Month Ranges
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
                    className="px-3.5 py-1.5 rounded-xl bg-[#07518a] hover:bg-[#053d69] text-white text-xs font-black uppercase tracking-widest transition-all shadow-xs cursor-pointer border-0"
                  >
                    + Add Period
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {seasonalPeriods.map((p, idx) => {
                    const isSelected = p.id === selectedPeriodId;
                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedPeriodId(p.id)}
                        className={`p-5 rounded-2xl border cursor-pointer transition-all duration-300 flex flex-col justify-between shadow-xs hover:shadow-md ${
                          isSelected
                            ? 'bg-white dark:bg-slate-900 border-indigo-500 dark:border-indigo-500 ring-2 ring-indigo-500/20'
                            : 'bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <select
                              value={p.startMonth}
                              onChange={e => {
                                const updated = seasonalPeriods.map(x =>
                                  x.id === p.id ? { ...x, startMonth: parseInt(e.target.value) } : x
                                );
                                updateSeasonalPeriodsAndTrim(autoFillGaps(updated));
                              }}
                              onClick={e => e.stopPropagation()}
                              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer focus:border-indigo-500 transition-all shadow-xs"
                            >
                              {monthNames.map((m, idx) => (
                                <option key={m} value={idx + 1}>{m}</option>
                              ))}
                            </select>
                            <span className="text-xs text-slate-400 font-extrabold uppercase tracking-widest font-sans">to</span>
                            <select
                              value={p.endMonth}
                              onChange={e => {
                                const updated = seasonalPeriods.map(x =>
                                  x.id === p.id ? { ...x, endMonth: parseInt(e.target.value) } : x
                                );
                                updateSeasonalPeriodsAndTrim(autoFillGaps(updated));
                              }}
                              onClick={e => e.stopPropagation()}
                              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer focus:border-indigo-500 transition-all shadow-xs"
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
                              className="text-rose-500 hover:text-rose-600 transition-colors p-1.5 cursor-pointer hover:bg-rose-500/10 rounded-lg"
                              title="Delete Period"
                            >
                              ✕
                            </button>
                          )}
                        </div>

                        <div className="mt-4 text-xs font-bold text-slate-600 dark:text-slate-400 font-sans border-t border-slate-100 dark:border-slate-800/80 pt-3">
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
                    <span>⚠️</span>
                    <span>{validation.error}</span>
                  </div>
                )}
              </div>
            )}

            {/* Configure Days Grid Section */}
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-3">
                <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest font-sans flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse" />
                  {policyType === 'seasonal' ? 'Configure Days for Selected Period' : 'Configure Days of the Week'}
                </label>
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Click toggle to set day as Off-Day
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, dayIdx) => {
                  const isChecked = policyType === 'seasonal' ? (currentPeriod?.off_days.includes(day) || false) : weekoffForm.off_days.includes(day);
                  const activeWeeks = policyType === 'seasonal' ? (currentPeriod?.alternate_rules[day] || []) : (alternateRules[day] || []);

                  const dayMeta: Record<string, { short: string; bgLight: string; bgDark: string; borderLight: string; textLight: string }> = {
                    Monday: { short: 'MO', bgLight: 'bg-indigo-50/80', bgDark: 'dark:bg-indigo-950/60', borderLight: 'border-indigo-200/80', textLight: 'text-indigo-600 dark:text-indigo-400' },
                    Tuesday: { short: 'TU', bgLight: 'bg-blue-50/80', bgDark: 'dark:bg-blue-950/60', borderLight: 'border-blue-200/80', textLight: 'text-blue-600 dark:text-blue-400' },
                    Wednesday: { short: 'WE', bgLight: 'bg-cyan-50/80', bgDark: 'dark:bg-cyan-950/60', borderLight: 'border-cyan-200/80', textLight: 'text-cyan-600 dark:text-cyan-400' },
                    Thursday: { short: 'TH', bgLight: 'bg-teal-50/80', bgDark: 'dark:bg-teal-950/60', borderLight: 'border-teal-200/80', textLight: 'text-teal-600 dark:text-teal-400' },
                    Friday: { short: 'FR', bgLight: 'bg-emerald-50/80', bgDark: 'dark:bg-emerald-950/60', borderLight: 'border-emerald-200/80', textLight: 'text-emerald-600 dark:text-emerald-400' },
                    Saturday: { short: 'SA', bgLight: 'bg-amber-50/80', bgDark: 'dark:bg-amber-950/60', borderLight: 'border-amber-200/80', textLight: 'text-amber-600 dark:text-amber-400' },
                    Sunday: { short: 'SU', bgLight: 'bg-rose-50/80', bgDark: 'dark:bg-rose-950/60', borderLight: 'border-rose-200/80', textLight: 'text-rose-600 dark:text-rose-400' },
                  };

                  const meta = dayMeta[day] || { short: day.substring(0, 2).toUpperCase(), bgLight: 'bg-slate-50', bgDark: 'dark:bg-slate-900', borderLight: 'border-slate-200', textLight: 'text-slate-600' };

                  return (
                    <div 
                      key={day} 
                      style={{ animationDelay: `${dayIdx * 40}ms` }}
                      className={`group p-5 rounded-2xl transition-all duration-300 flex flex-col justify-between space-y-4 animate-fade-up relative overflow-hidden backdrop-blur-xs ${
                        isChecked 
                          ? 'bg-gradient-to-br from-indigo-500/15 via-blue-500/10 to-purple-500/15 dark:from-indigo-950/70 dark:via-blue-950/50 dark:to-purple-950/70 border-2 border-indigo-500/80 dark:border-indigo-400/80 shadow-lg shadow-indigo-500/15 hover:shadow-xl hover:-translate-y-1'
                          : 'bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-slate-700 shadow-xs hover:shadow-lg hover:-translate-y-1'
                      }`}
                    >
                      {/* Day Card Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs tracking-wider transition-transform duration-300 group-hover:scale-110 shadow-2xs ${meta.bgLight} ${meta.bgDark} ${meta.textLight} border ${meta.borderLight} dark:border-slate-800`}>
                            {meta.short}
                          </div>
                          <div>
                            <span className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider font-sans block">{day}</span>
                            <span className={`inline-block text-[9.5px] font-black uppercase tracking-wider mt-1 px-2.5 py-0.5 rounded-full border ${
                              isChecked 
                                ? activeWeeks.length === 5 
                                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                                  : 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200/50 dark:border-slate-700/50'
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
                              updatedAltRules[day] = [1, 2, 3, 4, 5];
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
                          className={`relative inline-flex h-6.5 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-300 ease-in-out outline-none shadow-xs ${
                            isChecked ? 'bg-indigo-600 shadow-indigo-500/40' : 'bg-slate-300 dark:bg-slate-700'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5.5 w-5.5 transform rounded-full bg-white shadow-md transition duration-300 ease-in-out ${
                              isChecked ? 'translate-x-4.5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Weeks Selection Row */}
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-center min-h-[44px]">
                        {isChecked ? (
                          <div className="flex items-center justify-between w-full gap-1 animate-fadeIn">
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
                                  className={`flex-1 h-7 rounded-xl text-xs flex items-center justify-center transition-all duration-200 cursor-pointer font-black ${
                                    isWeekChecked
                                      ? 'bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/30 scale-105 border border-indigo-400/60'
                                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400'
                                  }`}
                                  title={`Toggle Week ${weekNum}`}
                                >
                                  {weekNum}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="w-full py-1.5 text-center rounded-xl bg-slate-50/80 dark:bg-slate-950/40 border border-dashed border-slate-200 dark:border-slate-800">
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-widest font-sans">Full Working Day</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Editor Footer Action Bar */}
          <div className="p-6 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                {(policyType === 'seasonal' ? (currentPeriod?.off_days.length || 0) : weekoffForm.off_days.length)} Days Off Configured
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-black uppercase tracking-wider hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveWeekoffs}
                disabled={policyType === 'seasonal' && !validation.isValid}
                className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white shadow-md transition-all duration-200 flex items-center gap-2 border-0 ${
                  policyType === 'seasonal' && !validation.isValid
                    ? 'bg-slate-400/70 dark:bg-slate-700/60 cursor-not-allowed shadow-none'
                    : 'bg-[#07518a] hover:bg-[#053d69] shadow-[#07518a]/30 cursor-pointer active:scale-[0.98]'
                }`}
              >
                Save Policy
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ================= POLICY DISPLAY READ-ONLY VIEW ================= */
        <div className="space-y-6">
          {isAllScope ? (
            allWeekoffs.length === 0 ? (
              <div className="w-full rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center shadow-xs space-y-3">
                <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest font-sans">No policies configured yet</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium max-w-sm mx-auto font-sans">
                  No companies have a week-off policy configured. Please select a company from the header dropdown to configure its policy.
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
                    <div key={policy.id} className="w-full rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-6 text-left transition-all duration-200">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <h4 className="text-base font-bold text-slate-850 dark:text-slate-100 font-sidebar">{policy.name || 'Standard Week-off'}</h4>
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold uppercase tracking-wider font-sidebar">
                              Active
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <span className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold uppercase">
                            {pPolicyType === 'year-round' ? '📅 Year-Round' : '🌀 Seasonal Periods'}
                          </span>
                          
                          {canEdit && (
                            <button
                              onClick={() => handleEditPolicyFromAll(policy)}
                              className="px-3.5 py-1.5 rounded-xl bg-[#07518a] hover:bg-[#053d69] text-white text-xs font-bold transition-all cursor-pointer border-0 shadow-xs"
                            >
                              Edit Policy
                            </button>
                          )}

                          {canDelete && (
                            <button
                              onClick={() => handleDeletePolicyFromAll(policy)}
                              className="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950 dark:hover:bg-rose-900 dark:text-rose-400 text-xs font-bold transition-all cursor-pointer border border-rose-200 dark:border-rose-800"
                            >
                              Delete Policy
                            </button>
                          )}

                          {canCreate && (
                            <button
                              onClick={startPolicyEdit}
                              className="px-3.5 py-1.5 rounded-xl bg-[#07518a] hover:bg-[#053d69] text-white text-xs font-bold transition-all cursor-pointer shadow-xs border-0"
                            >
                              + Configure Policy
                            </button>
                          )}
                        </div>
                      </div>

                      {pPolicyType === 'year-round' ? (
                        <div className="space-y-3">
                          <h5 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-sidebar flex items-center gap-2">
                            <span>🗓️</span> Weekly Off-Days Summary
                          </h5>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, idx) => 
                              renderDayViewCard(day, pOffDays, pAltRules, idx)
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <h5 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-sidebar">Seasonal Cycles & Periods</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {pSeasonalPeriods.map((period, index) => (
                              <div key={period.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider font-sidebar">
                                    Period {index + 1}: {getMonthName(period.startMonth)} - {getMonthName(period.endMonth)}
                                  </span>
                                </div>
                                <div className="text-xs font-medium text-slate-600 dark:text-slate-400 font-sidebar">
                                  {period.off_days.length === 0 ? (
                                    <span className="italic text-slate-400">No off-days</span>
                                  ) : (
                                    <div className="flex flex-wrap gap-1.5">
                                      {period.off_days.map(day => (
                                        <span key={day} className="px-2 py-0.5 rounded-md bg-[#07518a]/10 text-[#07518a] dark:text-[#38bdf8] text-xs font-bold border border-[#07518a]/20 font-sidebar">
                                          {day.substring(0, 3)}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : !companyId ? (
            <div className="max-w-xl rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center shadow-xs mx-auto space-y-3 font-sidebar">
              <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-sidebar">No Company Selected</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium font-sidebar">
                Please select a company from the dropdown menu in the header to view or configure weekly off days.
              </p>
            </div>
          ) : !weekoff ? (
            <div className="w-full rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center shadow-xs space-y-4 font-sidebar">
              <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-sidebar">No Policy Configured</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium max-w-sm mx-auto font-sidebar">
                No week-off policy has been configured yet.
              </p>
              <button
                onClick={startPolicyEdit}
                className="px-5 py-2.5 rounded-xl bg-[#07518a] hover:bg-[#053d69] text-white text-xs font-bold transition-all shadow-xs cursor-pointer border-0 font-sidebar"
              >
                Initialize Week-off Policy
              </button>
            </div>
          ) : (
            /* Active Single Policy Card Display */
            <div className="w-full rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-6 text-left transition-all duration-200 font-sidebar">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h4 className="text-base font-bold text-slate-850 dark:text-slate-100 font-sidebar">{savedPolicyName}</h4>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold uppercase tracking-wider font-sidebar">
                      Active
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 font-sidebar">
                  <span className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold uppercase font-sidebar">
                    {savedPolicyType === 'year-round' ? '📅 Year-Round' : '🌀 Seasonal Periods'}
                  </span>
                  
                  {canEdit && (
                    <button
                      onClick={startPolicyEdit}
                      className="px-4 py-2 rounded-xl bg-[#07518a] hover:bg-[#053d69] text-white text-xs font-bold transition-all duration-200 cursor-pointer shadow-xs border-0 font-sidebar"
                    >
                      Edit Policy
                    </button>
                  )}

                  {canDelete && (
                    <button
                      onClick={handleDeletePolicy}
                      className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950 dark:hover:bg-rose-900 dark:text-rose-400 text-xs font-bold transition-all duration-200 cursor-pointer border border-rose-200 dark:border-rose-800 font-sidebar"
                    >
                      Delete Policy
                    </button>
                  )}

                  {canCreate && (
                    <button
                      onClick={startPolicyEdit}
                      className="px-4 py-2 rounded-xl bg-[#07518a] hover:bg-[#053d69] text-white text-xs font-bold transition-all duration-200 cursor-pointer shadow-xs border-0 font-sidebar"
                    >
                      + Configure Policy
                    </button>
                  )}
                </div>
              </div>

              {savedPolicyType === 'year-round' ? (
                <div className="space-y-3">
                  <h5 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-sidebar flex items-center gap-2">
                    <span>🗓️</span> Weekly Off-Days Summary
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, idx) => 
                      renderDayViewCard(day, savedOffDays, savedAltRules, idx)
                    )}
                  </div>
                </div>
              ) : (
                /* Seasonal timeline display */
                <div className="space-y-3">
                  <h5 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-sidebar">Seasonal Cycles & Periods</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {savedSeasonalPeriods.map((period, index) => (
                      <div 
                        key={period.id} 
                        style={{ animationDelay: `${index * 60}ms` }}
                        className="group p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 hover:border-[#07518a] transition-all duration-300 shadow-xs hover:shadow-md animate-fade-up space-y-3 relative overflow-hidden font-sidebar"
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                          <span className="text-xs font-bold text-[#07518a] dark:text-[#38bdf8] uppercase tracking-wider font-sidebar flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-[#07518a]/10 text-[#07518a] dark:bg-[#07518a]/20 dark:text-[#38bdf8] border border-[#07518a]/20 flex items-center justify-center text-[10px] font-bold">
                              P{index + 1}
                            </span>
                            {getMonthName(period.startMonth)} → {getMonthName(period.endMonth)}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-[9.5px] font-bold">
                            Period {index + 1}
                          </span>
                        </div>
                        <div className="text-xs font-medium text-slate-600 dark:text-slate-400 pt-1">
                          {period.off_days.length === 0 ? (
                            <span className="italic text-slate-400 font-semibold">No off-days configured</span>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {period.off_days.map((day: string) => (
                                <span key={day} className="px-2.5 py-1 rounded-xl bg-[#07518a]/10 text-[#07518a] dark:text-[#38bdf8] text-xs font-bold border border-[#07518a]/20 font-sidebar">
                                  {day}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 🗑️ DELETION CONFIRMATION TOAST OVERLAY */}
      {showDeleteConfirm && (
        <>
          <div className="fixed inset-0 z-[90] bg-black/25 backdrop-blur-[2px]" onClick={() => setShowDeleteConfirm(false)} />
          <div className="fixed right-6 top-1/2 -translate-y-1/2 z-[100] w-[310px] animate-slideIn">
            <div className="rounded-2xl border border-slate-200 dark:border-rose-900/40 bg-white dark:bg-[#1c1624] shadow-2xl shadow-black/40 overflow-hidden text-left">
              <div className="h-1 w-full bg-gradient-to-r from-rose-600 to-red-400" />
              <div className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/20 flex items-center justify-center flex-shrink-0">
                    🗑️
                  </div>
                  <div>
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-455">Confirm Deletion</h4>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5">This action cannot be undone</p>
                  </div>
                </div>
                <div className="mb-5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-left">
                  <p className="text-[12px] text-slate-700 dark:text-slate-200 font-medium leading-relaxed">
                    Delete week-off policy <span className="font-black text-rose-600 dark:text-rose-400">&ldquo;{policyToDelete ? policyToDelete.name : savedPolicyName}&rdquo;</span> for <span className="font-bold text-slate-800 dark:text-slate-100">&ldquo;{policyToDelete ? policyToDelete.company_name : activeCoName || 'this company'}&rdquo;</span>?
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
