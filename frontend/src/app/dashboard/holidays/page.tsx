'use client';

import React, { useEffect, useState } from 'react';
import DashboardPageHeader from '../components/DashboardPageHeader';
import { getHeaders } from '../utils/api';
import SlideDrawer from '../components/SlideDrawer';
import { useDashboard } from '../components/DashboardContext';
import { usePermissions } from '../hooks/usePermissions';
import { Calendar, Building2, Plus, Search, Edit3, Trash2, CheckCircle2, Sparkles } from 'lucide-react';

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
  { id: 'list', label: 'Holidays Calendar', permission: 'view_holiday_masters', icon: Calendar },
  { id: 'matrix', label: 'Branch Restrictions Matrix', permission: 'view_holiday_masters', icon: Building2 },
] as const;
type HolidayTabId = typeof HOLIDAY_TABS[number]['id'];

export default function HolidaysPage() {
  const { showToast, companyId } = useDashboard();
  const { hasPermission } = usePermissions();
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
    if (storedRoles) {
      try {
        setRoles(JSON.parse(storedRoles));
      } catch (e) {}
    }
    if (storedEmail) setEmail(storedEmail);
  }, []);

  const fetchHolidays = async () => {
    setIsLoading(true);
    try {
      const isSuper = roles.includes('SuperAdmin') || roles.includes('superadmin');
      const cid = companyId || 'all';
      const queryParam = `?companyId=${cid}`;
      const res = await fetch(`/api/v1/holidays${queryParam}`, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        setHolidays(data.holidays || []);
      }
    } catch (e) {
      console.error(e);
      showToast('Failed to fetch holidays calendar.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      const cid = companyId || 'all';
      const res = await fetch(`/api/v1/branches?companyId=${cid}`, {
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
      const res = await fetch('/api/v1/companies', { headers: getHeaders() });
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
    // Handled globally by DashboardContext
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
        ? `/api/v1/holidays/${newHolidayForm.id}`
        : '/api/v1/holidays';

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
      const res = await fetch(`/api/v1/holidays/${id}`, {
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
      const res = await fetch(`/api/v1/holidays/${holidayId}/restrict-branches`, {
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
    for (let i = 0; i <= 5; i++) {
      years.push(currentYear - i);
    }
    return years;
  }, [currentYear]);

  const MONTH_FILTERS = [
    { key: 'ALL', label: 'All' },
    { key: 'JAN', label: 'Jan' },
    { key: 'FEB', label: 'Feb' },
    { key: 'MAR', label: 'Mar' },
    { key: 'APR', label: 'Apr' },
    { key: 'MAY', label: 'May' },
    { key: 'JUN', label: 'Jun' },
    { key: 'JUL', label: 'Jul' },
    { key: 'AUG', label: 'Aug' },
    { key: 'SEP', label: 'Sep' },
    { key: 'OCT', label: 'Oct' },
    { key: 'NOV', label: 'Nov' },
    { key: 'DEC', label: 'Dec' },
  ];

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
    <div className="space-y-6 animate-fadeIn w-full text-left font-sans">
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
                const IconComponent = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-2 px-4.5 rounded-xl text-xs transition-all duration-200 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                      isActive
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 font-black shadow-xs border border-slate-200/80 dark:border-slate-700/80'
                        : 'text-slate-600 dark:text-slate-400 font-bold hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/60 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <IconComponent className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-3 self-end sm:self-auto">
            {isSuperAdmin && (
              <span className="px-3.5 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 text-[10.5px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-2 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
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
                className="px-4.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex items-center gap-2 border-0"
              >
                <Plus className="w-4 h-4 text-white" />
                <span>Create Holiday</span>
              </button>
            )}
          </div>
        </div>

        {/* 🔍 SEARCH BAR & QUICK FILTERS */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3.5">
          {/* Search Input Bar */}
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search holidays by name, date, year, month, or branch..."
              className="w-full pl-10 pr-10 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-all"
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
              {/* Year Select Pill Dropdown */}
              <div className="shrink-0">
                <select
                  value={selectedYearFilter}
                  onChange={e => setSelectedYearFilter(e.target.value)}
                  className="px-3 py-1 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 outline-none cursor-pointer font-sans shadow-2xs hover:bg-indigo-100/70 dark:hover:bg-indigo-900/60 transition-colors"
                >
                  {availableYears.map(yr => (
                    <option key={yr} value={String(yr)}>{yr}</option>
                  ))}
                </select>
              </div>

              <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 shrink-0" />

              {/* Month Pills */}
              {MONTH_FILTERS.map(m => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setSelectedMonthFilter(m.key)}
                  className={`px-3 py-1 rounded-xl text-xs transition-all duration-150 cursor-pointer whitespace-nowrap ${
                    selectedMonthFilter === m.key
                      ? 'bg-indigo-600 text-white font-bold shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 font-semibold border border-slate-200/70 dark:border-slate-800'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ALL HOLIDAYS DIRECT UNIFIED DISPLAY GRID */}
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <div className="w-8 h-8 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
            <span className="text-xs font-bold text-slate-400">Loading holiday data...</span>
          </div>
        ) : activeTab === 'list' ? (
          <div>
            {filteredHolidays.length === 0 ? (
              <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center shadow-xs space-y-3">
                <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">No Holiday Entries Found</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {searchQuery ? `No holidays match "${searchQuery}"` : 'Try creating a holiday or check the selected company filter'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredHolidays.map((h) => (
                  <div
                    key={h.id}
                    className="group relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between"
                  >
                    <div className="p-4 space-y-3">
                      <div className="flex justify-between items-start gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          h.is_restricted
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60'
                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60'
                        }`}>
                          {h.is_restricted ? 'Restricted (RH)' : 'General Holiday'}
                        </span>

                        {h.company_name && (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[9.5px] font-bold truncate max-w-[120px] border border-slate-200/60 dark:border-slate-700/60" title={h.company_name}>
                            🏢 {h.company_name}
                          </span>
                        )}
                      </div>

                      <div className="flex gap-3 items-center">
                        {/* DATE BADGE */}
                        <div className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center shrink-0 w-14 text-center">
                          <span className={`text-[9.5px] font-black uppercase tracking-wider ${
                            h.is_restricted ? 'text-amber-600 dark:text-amber-400' : 'text-indigo-600 dark:text-indigo-400'
                          }`}>
                            {h.monthShort}
                          </span>
                          <span className="text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight leading-none my-0.5 font-mono">
                            {h.dayNum}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400">
                            {h.year}
                          </span>
                        </div>

                        {/* HOLIDAY DETAILS */}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 truncate" title={h.name}>
                            {h.name}
                          </h4>
                          <p className="text-[11px] text-slate-400 dark:text-slate-400 font-medium line-clamp-2 mt-0.5">
                            {h.description || 'Official holiday observance.'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* CARD ACTIONS */}
                    {(hasPermission('edit_holiday_masters') || hasPermission('delete_holiday_masters')) && (
                      <div className="px-4 py-2.5 bg-slate-50/60 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex justify-end items-center gap-1.5">
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
                            className="p-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 text-xs font-bold border border-slate-200 dark:border-slate-700 cursor-pointer"
                            title="Edit Holiday"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {hasPermission('delete_holiday_masters') && (
                          <button
                            onClick={() => handleDeleteHoliday(h.id, h.name, h.company_id)}
                            className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 text-xs font-bold border border-rose-200/80 dark:border-rose-800/80 cursor-pointer"
                            title="Delete Holiday"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {holidays.length === 0 ? (
              <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center shadow-xs">
                <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">No Holidays Available</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">Please define holidays in the Holidays Calendar tab first.</p>
              </div>
            ) : filteredBranches.length === 0 ? (
              <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center shadow-xs">
                <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">No Matching Branches</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                  {searchQuery ? `No branches match "${searchQuery}"` : 'No branches configured. All holidays apply globally.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
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
                      className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden"
                    >
                      {/* Full Width Branch Row Header */}
                      <div className="p-4 bg-slate-50/70 dark:bg-slate-950/40 border-b border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-900">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                                {branch.name}
                              </h3>
                              {branch.company_name && (
                                <span className="px-2 py-0.5 rounded-full bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[9.5px] font-bold border border-slate-300/50 dark:border-slate-700/60">
                                  {branch.company_name}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                              Branch Holiday Restriction & Observance Rules
                            </p>
                          </div>
                        </div>

                        {/* Counts Badge Pills */}
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 text-[10px] font-black uppercase">
                            ✓ {observedCount} Observed
                          </span>
                          {restrictedCount > 0 && (
                            <span className="px-3 py-1 rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60 text-[10px] font-black uppercase">
                              🚫 {restrictedCount} Restricted
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Holidays grid for this branch */}
                      <div className="p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          {companyHolidays.map(h => {
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
                            const isObserved = !isRestricted;

                            const info = parseHolidayFullInfo(h.holiday_date);

                            return (
                              <div
                                key={h.id}
                                className={`p-3 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                                  isObserved
                                    ? 'bg-emerald-50/40 dark:bg-emerald-950/10 border-emerald-200/60 dark:border-emerald-900/40'
                                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-800 opacity-60'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center shrink-0 font-mono text-[9px] font-bold text-slate-700 dark:text-slate-300">
                                    {info.monthShort} {info.dayNum}
                                  </div>
                                  <div className="min-w-0">
                                    <span className="block text-xs font-bold text-slate-800 dark:text-slate-200 truncate" title={h.name}>
                                      {h.name}
                                    </span>
                                    <span className="block text-[9.5px] text-slate-400 font-medium truncate">
                                      {h.is_restricted ? 'Restricted (RH)' : 'General Holiday'}
                                    </span>
                                  </div>
                                </div>

                                {hasPermission('edit_holiday_masters') ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleHolidayBranch(h.id, branch.id, isObserved)}
                                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                      isObserved ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                                    }`}
                                  >
                                    <span
                                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                                        isObserved ? 'translate-x-4' : 'translate-x-0'
                                      }`}
                                    />
                                  </button>
                                ) : (
                                  <span className={`text-[10px] font-extrabold ${isObserved ? 'text-emerald-600' : 'text-slate-400'}`}>
                                    {isObserved ? 'YES' : 'NO'}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ➕ ADD / EDIT HOLIDAY SLIDE DRAWER */}
      <SlideDrawer
        isOpen={addHolidayDrawerOpen}
        onClose={() => {
          setAddHolidayDrawerOpen(false);
          setNewHolidayForm({
            id: '',
            name: '',
            holiday_date: '',
            description: '',
            is_restricted: false,
            company_id: ''
          });
        }}
        title={newHolidayForm.id ? 'Edit Holiday Master Entry' : 'Create New Holiday Entry'}
      >
        <form onSubmit={handleCreateHoliday} className="space-y-4 text-xs font-sans">
          {isSuperAdmin && (
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
                Target Company <span className="text-rose-500">*</span>
              </label>
              <select
                value={newHolidayForm.company_id || (companyId !== 'all' ? (companyId || '') : '')}
                onChange={e => setNewHolidayForm(prev => ({ ...prev, company_id: e.target.value }))}
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="">-- Select Target Company --</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
              Holiday Name / Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={newHolidayForm.name}
              onChange={e => setNewHolidayForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Independence Day or Republic Day"
              required
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
              Holiday Observance Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={newHolidayForm.holiday_date}
              onChange={e => setNewHolidayForm(prev => ({ ...prev, holiday_date: e.target.value }))}
              required
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
              Description / Observance Notes
            </label>
            <textarea
              rows={3}
              value={newHolidayForm.description}
              onChange={e => setNewHolidayForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Optional notes or details about this holiday..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
            />
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 flex items-center justify-between">
            <div>
              <span className="block font-bold text-slate-800 dark:text-slate-200 text-xs">Restricted Holiday (RH)</span>
              <span className="block text-[10px] text-slate-400 font-medium">Optional holiday for specific employees</span>
            </div>
            <button
              type="button"
              onClick={() => setNewHolidayForm(prev => ({ ...prev, is_restricted: !prev.is_restricted }))}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                newHolidayForm.is_restricted ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                  newHolidayForm.is_restricted ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setAddHolidayDrawerOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer shadow-xs"
            >
              {newHolidayForm.id ? 'Save Changes' : 'Create Entry'}
            </button>
          </div>
        </form>
      </SlideDrawer>

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmHolidayId && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center text-xl mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
                Delete Holiday Entry?
              </h3>
              <p className="text-xs text-slate-400 font-medium mt-1">
                Are you sure you want to delete <strong className="text-slate-700 dark:text-slate-200">{deleteConfirmHolidayName}</strong>? This action cannot be undone.
              </p>
            </div>

            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmHolidayId(null);
                  setDeleteConfirmCompanyId(null);
                  setDeleteConfirmHolidayName(null);
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmDeleteHoliday(deleteConfirmHolidayId, deleteConfirmCompanyId || '')}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
