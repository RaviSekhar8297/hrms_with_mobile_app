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
  { id: 'list',   label: '📅 Holidays Calendar',         permission: 'view_holiday_masters' },
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

  const parseHolidayDate = (dateStr: string) => {
    const dateObj = new Date(dateStr);
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const month = months[dateObj.getMonth()] || 'JAN';
    const day = String(dateObj.getDate()).padStart(2, '0');
    const year = dateObj.getFullYear();
    return { month, day, year };
  };

  return (
    <div className="space-y-6 animate-fadeIn w-full text-left" style={{ fontFamily: "'DM Sans', sans-serif" }}>
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

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-gradient-to-br from-blue-500/15 to-indigo-500/15 border border-blue-500/25 text-blue-600 dark:text-blue-400 shadow-sm flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </span>
            <div>
              <h3 className="text-sm font-black text-slate-855 dark:text-slate-100 uppercase tracking-widest font-sans">Holidays Calendar</h3>
              <p className="text-[10px] text-slate-400 dark:text-slate-555 font-bold mt-0.5 font-sans">Manage annual holiday schedules and branch-wise restriction permissions</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            {isSuperAdmin && (
              <span className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-1 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
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
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-md shadow-blue-500/10 transition-all duration-200 cursor-pointer flex items-center gap-1.5 flex-shrink-0"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Create Holiday
              </button>
            )}
          </div>
        </div>

        {/* Segmented Control Tabs */}
        {visibleTabs.length === 0 ? (
          <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 text-xs font-bold">
            <span>⚠️</span> You don't have permission to view Holidays. Contact your administrator.
          </div>
        ) : (
          <div className="flex bg-slate-100/80 dark:bg-slate-900/60 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-800/80 w-fit gap-2">
            {visibleTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-slate-950 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200/40 dark:border-slate-800/40'
                    : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-350'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'list' ? (
          <div>
            {holidays.length === 0 ? (
              <div className="rounded-[24px] border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-955 p-10 text-center shadow-md">
                <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest font-sans">No Holiday Entries Found</p>
                <p className="text-[10px] text-slate-450 dark:text-slate-550 mt-1 font-bold">Try creating a holiday or check the selected company</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl">
                {holidays.map(h => {
                  const { month, day, year } = parseHolidayDate(h.holiday_date);
                  return (
                    <div
                      key={h.id}
                      className="group relative rounded-3xl border border-slate-200/60 dark:border-slate-850/80 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-950 dark:to-slate-900/40 p-5 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 flex flex-col justify-between max-w-md w-full"
                    >
                      <div className="flex gap-4 items-start">
                        {/* Calendar Tear-off Graphic */}
                        <div className="w-14 h-16 rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 overflow-hidden flex flex-col items-center flex-shrink-0 shadow-inner">
                          <div className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 py-0.5 text-center">
                            <span className="text-[8.5px] font-black text-white tracking-widest leading-tight">{month}</span>
                          </div>
                          <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-slate-950 w-full">
                            <span className="text-base font-black text-slate-800 dark:text-slate-200 tracking-tight leading-none">{day}</span>
                            <span className="text-[7.5px] font-extrabold text-slate-400 dark:text-slate-500 tracking-wider mt-0.5">{year}</span>
                          </div>
                        </div>

                        {/* Holiday Details */}
                        <div className="flex-1 text-left min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                            <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider ${h.is_restricted ? 'bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400'}`}>
                              {h.is_restricted ? 'Restricted (RH)' : 'General'}
                            </span>
                            {h.company_name && (
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/60 text-[8px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider truncate max-w-[150px]">
                                🏢 {h.company_name}
                              </span>
                            )}
                          </div>

                          <h4 className="text-sm font-black text-slate-850 dark:text-slate-100 tracking-wide line-clamp-1 leading-snug">
                            {h.name}
                          </h4>
                          
                          <p className="text-[10px] text-slate-450 dark:text-slate-500 font-bold leading-relaxed line-clamp-2 mt-1.5 font-sans">
                            {h.description || 'No description available.'}
                          </p>
                        </div>
                      </div>

                      <div className="flex justify-end items-center pt-3.5 mt-4 border-t border-slate-100 dark:border-slate-850/60 gap-2">
                        {hasPermission('edit_holiday_masters') && (
                          <button
                            onClick={() => {
                              setNewHolidayForm({
                                id: String(h.id),
                                name: h.name,
                                holiday_date: h.holiday_date.split('T')[0],
                                description: h.description,
                                is_restricted: h.is_restricted,
                                company_id: h.company_id
                              });
                              setAddHolidayDrawerOpen(true);
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/15 border border-blue-500/20 text-blue-650 dark:text-blue-400 text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                            </svg>
                            Edit
                          </button>
                        )}
                        {hasPermission('delete_holiday_masters') && (
                          <button
                            onClick={() => handleDeleteHoliday(h.id, h.name, h.company_id)}
                            className="px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/20 text-rose-650 dark:text-rose-455 text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div>
            {holidays.length === 0 ? (
              <div className="rounded-[24px] border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-955 p-10 text-center shadow-md">
                <p className="text-xs font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest font-sans">No Holidays Available</p>
                <p className="text-[10px] text-slate-450 dark:text-slate-500 font-bold mt-1">Please define holidays in the Holidays Calendar tab first.</p>
              </div>
            ) : branches.length === 0 ? (
              <div className="rounded-[24px] border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-955 p-10 text-center shadow-md">
                <p className="text-xs font-black text-slate-400 dark:text-slate-555 uppercase tracking-widest font-sans">No Branches Available</p>
                <p className="text-[10px] text-slate-455 dark:text-slate-500 font-bold mt-1">No branches configured. All holidays apply globally.</p>
              </div>
            ) : (
              <div className="rounded-[24px] border border-slate-200/60 dark:border-slate-850/80 bg-white dark:bg-slate-955 shadow-md overflow-hidden border-t-[3px] border-t-indigo-500/80 dark:border-t-indigo-600/80">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 text-[9px] font-black uppercase tracking-widest font-sans">
                        <th className="py-4.5 px-5 text-left min-w-[220px] border-r border-slate-100 dark:border-slate-850/50">Branch Name</th>
                        {holidays.map(h => {
                          const formattedDate = new Date(h.holiday_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric'
                          });
                          return (
                            <th key={h.id} className="py-4.5 px-4 text-center min-w-[150px] border-r last:border-r-0 border-slate-100 dark:border-slate-850/50">
                              <span className="block font-black text-slate-800 dark:text-slate-200 tracking-wide text-[10px]">{h.name}</span>
                              <span className="block font-bold text-blue-500 dark:text-blue-400 mt-1 font-mono text-[8.5px]">{formattedDate.toUpperCase()}</span>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {branches.map(branch => (
                        <tr key={branch.id} className="border-b border-slate-100 dark:border-slate-850/50 hover:bg-slate-500/5 transition-colors">
                          <td className="py-5 px-5 font-black text-slate-800 dark:text-slate-200 border-r border-slate-100 dark:border-slate-850/50 text-left">
                            <span className="block text-xs font-black tracking-wide">{branch.name}</span>
                            {branch.company_name && (
                              <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-900 text-[7.5px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-1">
                                🏢 {branch.company_name}
                              </span>
                            )}
                          </td>
                          {holidays.map(holiday => {
                            const isApplicable = branch.company_id === holiday.company_id;
                            if (!isApplicable) {
                              return (
                                <td key={holiday.id} className="py-5 px-4 text-center border-r last:border-r-0 border-slate-100 dark:border-slate-850/50 select-none">
                                  <span className="text-[10px] text-slate-300 dark:text-slate-700 font-bold uppercase tracking-widest">-</span>
                                </td>
                              );
                            }

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

                            return (
                              <td key={holiday.id} className="py-5 px-4 text-center border-r last:border-r-0 border-slate-100 dark:border-slate-850/50">
                                <div className="flex flex-col items-center justify-center gap-1.5">
                                  <button
                                    disabled={!hasPermission('edit_holiday_masters')}
                                    onClick={() => toggleHolidayBranch(holiday.id, branch.id, isObserved)}
                                    className={`relative inline-flex h-5.5 w-10.5 items-center rounded-full transition-colors focus:outline-none ${
                                      !hasPermission('edit_holiday_masters')
                                        ? 'opacity-40 cursor-not-allowed'
                                        : 'cursor-pointer'
                                    } ${
                                      isObserved ? 'bg-emerald-500' : 'bg-rose-500/80 dark:bg-rose-900/60'
                                    }`}
                                  >
                                    <span
                                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-250 ease-in-out ${
                                        isObserved ? 'translate-x-6' : 'translate-x-1'
                                      }`}
                                    />
                                  </button>
                                  <span className={`block text-[8px] font-black tracking-wider uppercase font-sans ${isObserved ? 'text-emerald-600 dark:text-emerald-450' : 'text-rose-600 dark:text-rose-455'}`}>
                                    {isObserved ? 'YES' : 'NO'}
                                  </span>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
