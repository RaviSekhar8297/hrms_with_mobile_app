'use client';

import React, { useEffect, useState } from 'react';
import DashboardPageHeader from '../components/DashboardPageHeader';
import { getHeaders } from '../utils/api';
import SlideDrawer from '../components/SlideDrawer';
import { useDashboard } from '../components/DashboardContext';
import { usePermissions } from '../hooks/usePermissions';

interface Company {
  id: string;
  name: string;
  subdomain: string;
  status: string;
  created_at: string;
}

interface Branch {
  id: string;
  company_id: string;
  name: string;
  address: string;
  status: string;
  company_name?: string;
}

const HOLIDAY_TABS = [
  { id: 'list', label: '📅 Holidays Calendar', permission: 'view_holiday_masters' },
  { id: 'matrix', label: '🏢 Branch Restrictions Matrix', permission: 'view_holiday_masters' },
] as const;
type HolidayTabId = typeof HOLIDAY_TABS[number]['id'];

export default function HolidaysPage() {
  const { showToast } = useDashboard();
  const { hasPermission } = usePermissions();
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  // Holidays state
  const [holidays, setHolidays] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<HolidayTabId>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('ALL');
  const [selectedYearFilter, setSelectedYearFilter] = useState<string>(String(new Date().getFullYear()));
  const [addHolidayDrawerOpen, setAddHolidayDrawerOpen] = useState(false);
  const [newHolidayForm, setNewHolidayForm] = useState({
    id: '',
    name: '',
    holiday_date: '',
    description: '',
    is_restricted: false,
    company_id: ''
  });

  // Custom Delete Confirm State
  const [deleteConfirmHolidayId, setDeleteConfirmHolidayId] = useState<string | null>(null);
  const [deleteConfirmCompanyId, setDeleteConfirmCompanyId] = useState<string | null>(null);
  const [deleteConfirmHolidayName, setDeleteConfirmHolidayName] = useState<string | null>(null);

  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('superadmin');

  const visibleTabs = HOLIDAY_TABS.filter(t => hasPermission(t.permission));

  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.find(t => t.id === activeTab)) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [visibleTabs.map(t => t.id).join(',')]);

  useEffect(() => {
    const storedRoles = localStorage.getItem('roles');
    const storedEmail = localStorage.getItem('email');
    const storedCompanyId = localStorage.getItem('companyId');

    let initialRoles: string[] = [];
    if (storedRoles) {
      const parsed = JSON.parse(storedRoles);
      setRoles(parsed);
      initialRoles = parsed;
    }
    if (storedEmail) setEmail(storedEmail);

    const isSuper = initialRoles.includes('SuperAdmin') || initialRoles.includes('superadmin');
    if (isSuper) {
      const activeCo = storedCompanyId || 'all';
      setCompanyId(activeCo);
      if (!storedCompanyId) {
        localStorage.setItem('companyId', 'all');
      }
    } else {
      if (storedCompanyId && storedCompanyId !== 'all') {
        setCompanyId(storedCompanyId);
      } else {
        setCompanyId(null);
      }
    }
  }, []);

  const fetchHolidays = async () => {
    try {
      const isSuper = roles.includes('SuperAdmin') || roles.includes('superadmin');
      let queryParam = '';
      if (isSuper && companyId) {
        queryParam = `?companyId=${companyId}`;
      } else if (!isSuper && companyId && companyId !== 'all') {
        queryParam = `?companyId=${companyId}`;
      }
      const res = await fetch(`http://localhost:5000/api/v1/holidays${queryParam}`, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        setHolidays(data.holidays || []);
      }
    } catch (e) {
      console.error(e);
      showToast('Failed to fetch holidays calendar.', 'error');
    }
  };

  const fetchBranches = async () => {
    try {
      const isSuper = roles.includes('SuperAdmin') || roles.includes('superadmin');
      const targetCo = (isSuper && companyId && companyId !== 'all') ? companyId : (!isSuper ? (companyId || '') : '');
      if (!targetCo) return;
      const res = await fetch(`http://localhost:5000/api/v1/branches?companyId=${targetCo}`, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        setBranches(data.branches || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchCompanies = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/v1/companies', { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) setCompanies(data.companies || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      fetchCompanies();
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    fetchHolidays();
    fetchBranches();
  }, [companyId, roles]);

  const handleCompanyChange = (id: string) => {
    const val = id || 'all';
    setCompanyId(val);
    localStorage.setItem('companyId', val);
  };

  const handleCreateHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolidayForm.name || !newHolidayForm.holiday_date) {
      showToast('Please fill in Holiday Name and Holiday Date.', 'error');
      return;
    }
    const targetCompanyId = newHolidayForm.company_id || companyId;
    if (!targetCompanyId || targetCompanyId === 'all') {
      showToast('Please select a target company.', 'error');
      return;
    }

    try {
      const method = newHolidayForm.id ? 'PUT' : 'POST';
      const url = newHolidayForm.id
        ? `http://localhost:5000/api/v1/holidays/${newHolidayForm.id}`
        : 'http://localhost:5000/api/v1/holidays';

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify({
          companyId: targetCompanyId,
          ...newHolidayForm
        })
      });

      if (res.ok) {
        showToast(`Holiday calendar entry ${newHolidayForm.id ? 'updated' : 'created'} successfully!`, 'success');
        setAddHolidayDrawerOpen(false);
        setNewHolidayForm({
          id: '',
          name: '',
          holiday_date: '',
          description: '',
          is_restricted: false,
          company_id: ''
        });
        fetchHolidays();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to save holiday entry.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Connection to server failed', 'error');
    }
  };

  const handleDeleteHoliday = (id: string, name: string, holidayCompanyId: string) => {
    setDeleteConfirmHolidayId(id);
    setDeleteConfirmHolidayName(name);
    setDeleteConfirmCompanyId(holidayCompanyId);
  };

  const confirmDeleteHoliday = async (id: string, holidayCompanyId: string) => {
    try {
      const res = await fetch(`http://localhost:5000/api/v1/holidays/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
        body: JSON.stringify({ companyId: holidayCompanyId })
      });
      if (res.ok) {
        showToast('Holiday deleted successfully', 'success');
        setDeleteConfirmHolidayId(null);
        setDeleteConfirmCompanyId(null);
        setDeleteConfirmHolidayName(null);
        fetchHolidays();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to delete holiday', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Connection to server failed', 'error');
    }
  };

  const toggleHolidayBranch = async (holidayId: string, branchId: string, isCurrentlyObserved: boolean) => {
    const holiday = holidays.find(h => h.id === holidayId);
    if (!holiday) return;

    let currentRestricted: string[] = [];
    try {
      currentRestricted = Array.isArray(holiday.restricted_branches)
        ? holiday.restricted_branches
        : (typeof holiday.restricted_branches === 'string'
          ? JSON.parse(holiday.restricted_branches || '[]')
          : []);
    } catch (e) {
      currentRestricted = [];
    }

    let newRestricted: string[] = [];
    if (isCurrentlyObserved) {
      newRestricted = [...currentRestricted, branchId];
    } else {
      newRestricted = currentRestricted.filter(id => id !== branchId);
    }

    const updatedHolidays = holidays.map(h => {
      if (h.id === holidayId) {
        return { ...h, restricted_branches: newRestricted };
      }
      return h;
    });
    setHolidays(updatedHolidays);

    try {
      const res = await fetch(`http://localhost:5000/api/v1/holidays/${holidayId}/restrict-branches`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          companyId: holiday.company_id,
          restricted_branches: newRestricted
        })
      });

      if (res.ok) {
        showToast(
          `Holiday "${holiday.name}" restriction updated successfully.`,
          'success'
        );
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to update holiday restriction.', 'error');
        fetchHolidays();
      }
    } catch (err) {
      console.error(err);
      showToast('Connection to server failed.', 'error');
      fetchHolidays();
    }
  };

  const parseHolidayFullInfo = (dateStr: string) => {
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const monthFullNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const rawStr = String(dateStr || '').trim();
    const match = rawStr.match(/^(\d{4})-(\d{2})-(\d{2})/);

    let y = 2026, m = 0, d = 1;
    if (match) {
      y = parseInt(match[1], 10);
      m = parseInt(match[2], 10) - 1;
      d = parseInt(match[3], 10);
    } else {
      const dateObj = new Date(rawStr);
      y = dateObj.getFullYear();
      m = dateObj.getMonth();
      d = dateObj.getDate();
    }

    const exactDateObj = new Date(y, m, d);

    const monthShort = months[m] || 'JAN';
    const monthFull = monthFullNames[m] || 'January';
    const dayNum = String(d).padStart(2, '0');
    const dayName = daysOfWeek[exactDateObj.getDay()] || 'Monday';
    const year = y;
    const monthNum = String(m + 1).padStart(2, '0');
    const monthKey = `${year}-${monthNum}`;
    const monthTitle = `${monthFull} ${year}`;
    const formattedYMD = `${year}-${monthNum}-${dayNum}`;
    return { monthShort, monthFull, dayNum, dayName, year, monthNum, monthKey, monthTitle, formattedYMD };
  };

  const sortedHolidays = React.useMemo(() => {
    const list = [...holidays].map(h => {
      const info = parseHolidayFullInfo(h.holiday_date);
      return { ...h, ...info };
    });
    return list.sort((a, b) => new Date(a.holiday_date).getTime() - new Date(b.holiday_date).getTime());
  }, [holidays]);

  const currentYear = new Date().getFullYear();

  const availableYears = React.useMemo(() => {
    const years: number[] = [];
    for (let i = 0; i <= 10; i++) {
      years.push(currentYear - i);
    }
    return years;
  }, [currentYear]);

  const filteredHolidays = React.useMemo(() => {
    let list = sortedHolidays;
    if (selectedYearFilter !== 'ALL') {
      list = list.filter(h => String(h.year) === String(selectedYearFilter));
    }
    if (selectedMonthFilter !== 'ALL') {
      list = list.filter(h => h.monthShort === selectedMonthFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(h =>
        h.name.toLowerCase().includes(q) ||
        (h.description && h.description.toLowerCase().includes(q)) ||
        (h.company_name && h.company_name.toLowerCase().includes(q)) ||
        h.monthShort.toLowerCase().includes(q) ||
        h.monthFull.toLowerCase().includes(q) ||
        h.dayName.toLowerCase().includes(q) ||
        h.holiday_date.includes(q) ||
        String(h.year).includes(q)
      );
    }
    return list;
  }, [sortedHolidays, searchQuery, selectedMonthFilter, selectedYearFilter]);

  const filteredBranches = React.useMemo(() => {
    let list = branches;
    if (searchQuery.trim() || selectedYearFilter !== 'ALL') {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(b => {
        const companyHolidays = holidays.filter(h => h.company_id === b.company_id);
        const yearMatches = selectedYearFilter === 'ALL' || companyHolidays.some(h => String(parseHolidayFullInfo(h.holiday_date).year) === String(selectedYearFilter));
        const searchMatches = !q || b.name.toLowerCase().includes(q) || (b.company_name && b.company_name.toLowerCase().includes(q)) || companyHolidays.some(h => h.name.toLowerCase().includes(q));
        return yearMatches && searchMatches;
      });
    }
    return list;
  }, [branches, holidays, searchQuery, selectedYearFilter]);

  return (
    <div className="space-y-6 animate-fadeIn w-full text-left" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <DashboardPageHeader
        title="Holidays Calendar Configuration"
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

      {/* 📊 KPI STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-lg shrink-0 border border-blue-500/20">
            📅
          </div>
          <div>
            <p className="text-[10.5px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Total Holidays</p>
            <p className="text-xl font-black text-slate-900 dark:text-white">{holidays.length}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-lg shrink-0 border border-indigo-500/20">
            🏢
          </div>
          <div>
            <p className="text-[10.5px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Active Branches</p>
            <p className="text-xl font-black text-slate-900 dark:text-white">{branches.length}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-lg shrink-0 border border-emerald-500/20">
            ✨
          </div>
          <div>
            <p className="text-[10.5px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">General Holidays</p>
            <p className="text-xl font-black text-slate-900 dark:text-white">{holidays.filter(h => !h.is_restricted).length}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center text-lg shrink-0 border border-amber-500/20">
            📜
          </div>
          <div>
            <p className="text-[10.5px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Restricted (RH)</p>
            <p className="text-xl font-black text-slate-900 dark:text-white">{holidays.filter(h => h.is_restricted).length}</p>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {/* Navigation Tabs Bar & Create Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {visibleTabs.length === 0 ? (
            <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 text-xs font-bold">
              <span>⚠️</span> You don't have permission to view Holidays. Contact your administrator.
            </div>
          ) : (
            <div className="p-1.5 rounded-2xl bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800 flex items-center gap-1 font-sans overflow-x-auto no-scrollbar shadow-inner">
              {visibleTabs.map(tab => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-2 px-4.5 rounded-xl text-xs transition-all duration-200 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                      isActive
                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-black shadow-sm border border-slate-200/80 dark:border-slate-700/80 scale-[1.01]'
                        : 'text-slate-600 dark:text-slate-400 font-bold hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/60 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <span className="text-sm">{tab.id === 'list' ? '📅' : '🏢'}</span>
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-3 self-end sm:self-auto">
            {isSuperAdmin && (
              <span className="px-3.5 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60 text-[10.5px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-2 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                {companyId === 'all' ? 'All Companies View' : 'Single Company View'}
              </span>
            )}

            {companyId && activeTab === 'list' && (isSuperAdmin || companyId !== 'all') && hasPermission('create_holiday_masters') && (
              <button
                onClick={() => {
                  setNewHolidayForm({
                    id: '',
                    name: '',
                    holiday_date: '',
                    description: '',
                    is_restricted: false,
                    company_id: companyId === 'all' ? '' : companyId
                  });
                  setAddHolidayDrawerOpen(true);
                }}
                className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:via-indigo-500 hover:to-violet-500 text-white text-xs font-black shadow-lg shadow-blue-500/20 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer flex items-center gap-2 border-0"
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span>Create Holiday</span>
              </button>
            )}
          </div>
        </div>

        {/* 🔍 SEARCH BAR & QUICK FILTERS */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-3.5">
          {/* Search Input Bar */}
          <div className="relative w-full">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search holidays by name, date, year, month, or branch..."
              className="w-full px-4 pr-10 py-2.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Year & Month Quick Filter Bar (Under Search Bar) */}
          {activeTab === 'list' && (
            <div className="pt-1 flex items-center gap-2 overflow-x-auto no-scrollbar max-w-full">
              <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider shrink-0">
                Filter:
              </span>

              {/* Year Select Pill Dropdown before ALL */}
              <div className="shrink-0">
                <select
                  value={selectedYearFilter}
                  onChange={e => setSelectedYearFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl text-[10.5px] font-black uppercase bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 outline-none cursor-pointer shadow-2xs font-sans"
                >
                  <option value="ALL">ALL YEARS</option>
                  {availableYears.map(yr => (
                    <option key={yr} value={String(yr)}>{yr}</option>
                  ))}
                </select>
              </div>

              <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 shrink-0" />

              {/* Month Pills: ALL, JAN, FEB, ... DEC */}
              {['ALL', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'].map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSelectedMonthFilter(m)}
                  className={`px-3.5 py-1.5 rounded-xl text-[10.5px] font-black uppercase transition-all duration-150 cursor-pointer whitespace-nowrap ${
                    selectedMonthFilter === m
                      ? 'bg-blue-600 text-white shadow-xs scale-105'
                      : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 font-bold border border-slate-200/60 dark:border-slate-800'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ALL HOLIDAYS DIRECT UNIFIED DISPLAY GRID */}
        {activeTab === 'list' ? (
          <div>
            {filteredHolidays.length === 0 ? (
              <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center shadow-sm space-y-3">
                <span className="text-3xl">📅</span>
                <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">No Holiday Entries Found</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {searchQuery ? `No holidays match "${searchQuery}"` : 'Try creating a holiday or check the selected company filter'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {filteredHolidays.map((h) => (
                  <div
                    key={h.id}
                    className="group relative overflow-hidden rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-xl hover:border-blue-500/40 dark:hover:border-blue-500/40 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
                  >
                    {/* Top Accent Gradient Bar */}
                    <div className={`h-1.5 w-full bg-gradient-to-r ${
                      h.is_restricted ? 'from-amber-500 to-orange-500' : 'from-blue-600 via-indigo-600 to-violet-600'
                    }`} />

                    <div className="p-5 space-y-4">
                      <div className="flex gap-4 items-start">
                        {/* MODERN MINIMALIST DATE BADGE WITH YEAR */}
                        <div className="px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/70 flex flex-col items-center justify-center shrink-0 w-16 text-center shadow-2xs group-hover:border-blue-500/40 transition-colors">
                          <span className={`text-[10px] font-black uppercase tracking-wider ${
                            h.is_restricted ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'
                          }`}>
                            {h.monthShort}
                          </span>
                          <span className="text-xl font-black text-slate-900 dark:text-white tracking-tight leading-none my-0.5">
                            {h.dayNum}
                          </span>
                          <span className="text-[9.5px] font-extrabold text-slate-500 dark:text-slate-400">
                            {h.year}
                          </span>
                        </div>

                        {/* HOLIDAY DETAILS */}
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              h.is_restricted
                                ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60'
                                : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60'
                            }`}>
                              {h.is_restricted ? 'Restricted (RH)' : 'General Holiday'}
                            </span>

                            {h.company_name && (
                              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold truncate max-w-[130px] border border-slate-200/60 dark:border-slate-700/60" title={h.company_name}>
                                🏢 {h.company_name}
                              </span>
                            )}
                          </div>

                          <h4 className="text-sm font-black text-slate-900 dark:text-white tracking-tight leading-snug truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" title={h.name}>
                            {h.name}
                          </h4>

                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed line-clamp-2">
                            {h.description || 'Official company holiday observance.'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* CARD ACTIONS */}
                    <div className="px-5 py-3 bg-slate-50/60 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex justify-end items-center gap-2">
                      {hasPermission('edit_holiday_masters') && (
                        <button
                          onClick={() => {
                            setNewHolidayForm({
                              id: String(h.id),
                              name: h.name,
                              holiday_date: h.formattedYMD || (h.holiday_date ? String(h.holiday_date).match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || '' : ''),
                              description: h.description,
                              is_restricted: h.is_restricted,
                              company_id: h.company_id
                            });
                            setAddHolidayDrawerOpen(true);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 text-xs font-bold border border-slate-200 dark:border-slate-700 shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                          </svg>
                          <span>Edit</span>
                        </button>
                      )}
                      {hasPermission('delete_holiday_masters') && (
                        <button
                          onClick={() => handleDeleteHoliday(h.id, h.name, h.company_id)}
                          className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 text-xs font-bold border border-rose-200/80 dark:border-rose-800/80 shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <svg className="w-3.5 h-3.5 text-rose-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {holidays.length === 0 ? (
              <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center shadow-sm">
                <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">No Holidays Available</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">Please define holidays in the Holidays Calendar tab first.</p>
              </div>
            ) : filteredBranches.length === 0 ? (
              <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center shadow-sm">
                <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">No Matching Branches</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                  {searchQuery ? `No branches match "${searchQuery}"` : 'No branches configured. All holidays apply globally.'}
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {filteredBranches.map(branch => {
                  const companyHolidays = holidays.filter(h => h.company_id === branch.company_id);
                  let observedCount = 0;
                  let restrictedCount = 0;

                  companyHolidays.forEach(h => {
                    let isRestricted = false;
                    try {
                      const restrictedArr = Array.isArray(h.restricted_branches)
                        ? h.restricted_branches
                        : (typeof h.restricted_branches === 'string'
                          ? JSON.parse(h.restricted_branches || '[]')
                          : []);
                      isRestricted = restrictedArr.includes(branch.id);
                    } catch (e) {
                      isRestricted = false;
                    }
                    if (isRestricted) restrictedCount++;
                    else observedCount++;
                  });

                  return (
                    <div
                      key={branch.id}
                      className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden"
                    >
                      {/* Full Width Branch Row Header */}
                      <div className="p-4 sm:px-6 bg-gradient-to-r from-slate-50 via-slate-50 to-blue-50/20 dark:from-slate-800/60 dark:via-slate-800/40 dark:to-blue-950/20 border-b border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-lg font-black shrink-0 border border-blue-500/20 shadow-2xs">
                            🏢
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                                {branch.name}
                              </h3>
                              {branch.company_name && (
                                <span className="px-2.5 py-0.5 rounded-full bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold border border-slate-300/50 dark:border-slate-700/60">
                                  {branch.company_name}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                              Branch Holiday Restriction & Observance Rules
                            </p>
                          </div>
                        </div>

                        {/* Counts Badge Pills */}
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 text-[10.5px] font-black uppercase tracking-wider shadow-2xs">
                            ✓ {observedCount} Observed
                          </span>
                          {restrictedCount > 0 && (
                            <span className="px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 text-[10.5px] font-black uppercase tracking-wider shadow-2xs">
                              ✕ {restrictedCount} Restricted
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Branch Holidays Row Grid */}
                      <div className="p-4 sm:p-5 bg-slate-50/30 dark:bg-slate-900/30">
                        {companyHolidays.length === 0 ? (
                          <div className="py-6 text-center text-xs text-slate-400 font-medium">
                            No holidays configured for this company.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                            {companyHolidays.map(holiday => {
                              let isRestricted = false;
                              try {
                                const restrictedArr = Array.isArray(holiday.restricted_branches)
                                  ? holiday.restricted_branches
                                  : (typeof holiday.restricted_branches === 'string'
                                    ? JSON.parse(holiday.restricted_branches || '[]')
                                    : []);
                                isRestricted = restrictedArr.includes(branch.id);
                              } catch (e) {
                                isRestricted = false;
                              }
                              const isObserved = !isRestricted;
                              const hInfo = parseHolidayFullInfo(holiday.holiday_date);

                              return (
                                <div
                                  key={holiday.id}
                                  className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 shadow-2xs hover:shadow-xs hover:border-blue-400/40 transition-all duration-200"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    {/* Date Badge */}
                                    <div className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-[10.5px] font-black text-center shrink-0 border border-slate-200/90 dark:border-slate-700/80 shadow-2xs">
                                      {hInfo.monthShort} {hInfo.dayNum}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-xs font-black text-slate-900 dark:text-slate-100 truncate" title={holiday.name}>
                                        {holiday.name}
                                      </p>
                                      <span className="text-[9.5px] font-semibold text-slate-400 dark:text-slate-500 block truncate">
                                        {holiday.is_restricted ? 'Restricted (RH)' : 'General Holiday'}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Toggle Switch */}
                                  <div className="flex items-center gap-2 shrink-0">
                                    <button
                                      disabled={!hasPermission('edit_holiday_masters')}
                                      onClick={() => toggleHolidayBranch(holiday.id, branch.id, isObserved)}
                                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none shadow-2xs ${
                                        !hasPermission('edit_holiday_masters')
                                          ? 'opacity-40 cursor-not-allowed'
                                          : 'cursor-pointer'
                                      } ${isObserved ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                                    >
                                      <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out ${
                                          isObserved ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                      />
                                    </button>
                                    <span className={`text-[10px] font-black tracking-wider uppercase w-8 text-center ${
                                      isObserved ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'
                                    }`}>
                                      {isObserved ? 'YES' : 'NO'}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Custom Delete Confirmation Modal */}
      {deleteConfirmHolidayId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center animate-fadeIn p-4">
          <div className="bg-white dark:bg-slate-950 border border-slate-200/60 dark:border-slate-850/80 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-455 flex items-center justify-center mx-auto border border-rose-500/20">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </div>

            <div className="space-y-1.5">
              <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Delete Holiday</h4>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold leading-relaxed">
                Are you sure you want to delete the holiday <span className="text-rose-600 dark:text-rose-400">"{deleteConfirmHolidayName}"</span>? This action cannot be undone.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmHolidayId(null);
                  setDeleteConfirmCompanyId(null);
                  setDeleteConfirmHolidayName(null);
                }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-xs font-bold text-slate-500 dark:text-slate-400 transition-colors cursor-pointer bg-transparent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (deleteConfirmHolidayId && deleteConfirmCompanyId) {
                    confirmDeleteHoliday(deleteConfirmHolidayId, deleteConfirmCompanyId);
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white transition-colors cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Holiday Drawer */}
      <SlideDrawer
        isOpen={addHolidayDrawerOpen}
        onClose={() => setAddHolidayDrawerOpen(false)}
        title={newHolidayForm.id ? 'Edit Holiday Calendar Entry' : 'Create Holiday Calendar Entry'}
      >
        <form onSubmit={handleCreateHoliday} className="space-y-6 text-left p-2">
          {companyId === 'all' && !newHolidayForm.id && (
            <div>
              <label className="block text-[9.5px] font-black text-slate-500 dark:text-slate-450 uppercase tracking-widest mb-1.5">Target Company</label>
              <select
                required
                value={newHolidayForm.company_id}
                onChange={e => setNewHolidayForm({ ...newHolidayForm, company_id: e.target.value })}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-950 transition-colors text-slate-800 dark:text-slate-200"
              >
                <option value="">-- Select Company --</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-[9.5px] font-black text-slate-500 dark:text-slate-455 uppercase tracking-widest mb-1.5">Holiday Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Independence Day"
              value={newHolidayForm.name}
              onChange={e => setNewHolidayForm({ ...newHolidayForm, name: e.target.value })}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-950 transition-colors text-slate-800 dark:text-slate-200"
            />
          </div>

          <div>
            <label className="block text-[9.5px] font-black text-slate-500 dark:text-slate-455 uppercase tracking-widest mb-1.5">Holiday Date</label>
            <input
              type="date"
              required
              value={newHolidayForm.holiday_date}
              onChange={e => setNewHolidayForm({ ...newHolidayForm, holiday_date: e.target.value })}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-950 transition-colors text-slate-800 dark:text-slate-200 font-mono"
            />
          </div>

          <div>
            <label className="block text-[9.5px] font-black text-slate-500 dark:text-slate-455 uppercase tracking-widest mb-1.5">Description</label>
            <textarea
              placeholder="Short description of the holiday..."
              value={newHolidayForm.description}
              onChange={e => setNewHolidayForm({ ...newHolidayForm, description: e.target.value })}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-950 transition-colors text-slate-800 dark:text-slate-200 h-20 resize-none"
            />
          </div>

          <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={newHolidayForm.is_restricted}
              onChange={e => setNewHolidayForm({ ...newHolidayForm, is_restricted: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
            />
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Restricted Holiday (RH)</span>
              <p className="text-[10px] text-slate-400 dark:text-slate-550 mt-0.5">Check this if the holiday is optional / restricted to specific categories</p>
            </div>
          </label>

          <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800/80">
            <button
              type="button"
              onClick={() => setAddHolidayDrawerOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-855 hover:bg-slate-550/10 text-xs font-bold text-slate-500 dark:text-slate-455 transition-all cursor-pointer bg-transparent"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-sm transition-all cursor-pointer"
            >
              {newHolidayForm.id ? 'Update Holiday' : 'Create Holiday'}
            </button>
          </div>
        </form>
      </SlideDrawer>
    </div>
  );
}
