'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { User, LogOut } from 'lucide-react';
import { getHeaders, getUrl } from '../utils/api';
import NotificationBell from './NotificationBell';
import { useDashboard } from './DashboardContext';
import MoodBooster from './MoodBooster';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

interface HeaderProps {
  companyName: string;
  currentTime: Date | null;
  email: string;
  designation: string;
  isSuperAdmin: boolean;
  timeLeft: number;
  resetSessionTimer: () => void;
  formatTime: (seconds: number) => string;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setMoreAppsOpen: (open: boolean) => void;
  handleLogout: () => void;
  theme: string;
  setTheme: (theme: any) => void;
}

function HeaderCompanySelector({ companyName, isSuperAdmin }: { companyName: string; isSuperAdmin: boolean }) {
  const { companyId, setCompanyId, companies, setCompanies } = useDashboard();

  useEffect(() => {
    if (isSuperAdmin && companies.length === 0) {
      fetch('/api/v1/companies', { headers: getHeaders() })
        .then(res => res.json())
        .then(data => {
          const list = Array.isArray(data) ? data : (data.companies || []);
          if (list.length > 0) {
            // Sort by created_at ascending (earliest created company first)
            const sorted = [...list].sort((a: any, b: any) => {
              const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
              const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
              return tA - tB;
            });
            setCompanies(sorted);

            // Initially select the company with earliest created_at if no user preference was explicitly chosen in session or stored
            const stored = localStorage.getItem('companyId');
            const userChosen = sessionStorage.getItem('company_user_selected');
            if (!userChosen || !stored || stored === 'all' || !list.some((c: any) => c.id === stored)) {
              setCompanyId(sorted[0].id);
            }
          }
        })
        .catch(err => console.error('Error fetching companies in header:', err));
    }
  }, [isSuperAdmin, companies.length]);

  const formatCompanyName = (name: string) => {
    if (!name) return '';
    return name.length > 35 ? `${name.slice(0, 35)}...` : name;
  };

  if (!isSuperAdmin) {
    const formatted = formatCompanyName(companyName || 'Company Tenant');
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center h-[38px] px-3.5 rounded-lg bg-[#07518a]/10 dark:bg-[#07518a]/20 border border-[#07518a]/30 text-[#07518a] dark:text-[#38bdf8] shadow-2xs cursor-default">
            <span className="text-[11px] sm:text-[11.5px] font-extrabold tracking-wide uppercase truncate max-w-[160px] xs:max-w-[200px] sm:max-w-[260px] md:max-w-[320px]">
              {formatted}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs font-bold text-xs bg-slate-900 text-white dark:bg-slate-800 border border-slate-700 shadow-xl">
          {companyName || 'Corporate Tenant'}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="flex items-center h-[38px] px-2.5 rounded-lg bg-[#07518a]/10 dark:bg-[#07518a]/20 border border-[#07518a]/30 text-[#07518a] dark:text-[#38bdf8] shadow-2xs">
      <select
        value={companyId || 'all'}
        onChange={(e) => {
          sessionStorage.setItem('company_user_selected', 'true');
          setCompanyId(e.target.value === 'all' ? null : e.target.value);
        }}
        className="bg-transparent text-[11px] sm:text-[11.5px] font-extrabold tracking-wide uppercase text-[#07518a] dark:text-[#38bdf8] focus:outline-none cursor-pointer pr-0.5 py-0.5 truncate max-w-[160px] xs:max-w-[200px] sm:max-w-[260px] md:max-w-[320px]"
      >
        <option value="all" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-semibold uppercase">
          Select Company
        </option>
        {companies.map(c => (
          <option key={c.id} value={c.id} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-semibold uppercase" title={c.name}>
            {formatCompanyName(c.name)}
          </option>
        ))}
      </select>
    </div>
  );
}

const GLOBAL_NAV_ITEMS = [
  { label: 'Overview / Dashboard', path: '/dashboard/overview', category: 'Module', icon: '📊' },
  { label: 'Employees Directory', path: '/dashboard/employees', category: 'Module', icon: '👥' },
  { label: 'Comp-Offs', path: '/dashboard/leaves/compoff', category: 'Module', icon: '⏱️' },
  { label: 'Permissions', path: '/dashboard/attendance/permissions', category: 'Module', icon: '📝' },
  { label: 'Attendance Policies & Logs', path: '/dashboard/attendance', category: 'Module', icon: '📅' },
  { label: 'Attendance Location Tracking', path: '/dashboard/attendance/live-tracking', category: 'Module', icon: '📍' },
  { label: 'Leave Requests & Balances', path: '/dashboard/leaves', category: 'Module', icon: '🌴' },
  { label: 'Payroll Management', path: '/dashboard/payroll', category: 'Module', icon: '💰' },
  { label: 'Run Payroll Batch', path: '/dashboard/payroll/generate', category: 'Module', icon: '⚡' },
  { label: 'Salary Structures', path: '/dashboard/structure', category: 'Module', icon: '📑' },
  { label: 'Formula Builder', path: '/dashboard/formula', category: 'Module', icon: '🧮' },
  { label: 'Companies (Tenants)', path: '/dashboard/companies', category: 'Module', icon: '🏢' },
  { label: 'Branch Offices', path: '/dashboard/branches', category: 'Module', icon: '📍' },
  { label: 'Departments', path: '/dashboard/departments', category: 'Module', icon: '🏢' },
  { label: 'Designations', path: '/dashboard/designations', category: 'Module', icon: '👔' },
  { label: 'Roles & Permissions', path: '/dashboard/roles', category: 'Module', icon: '🛡️' },
  { label: 'Shift Roster & Master', path: '/dashboard/shifts', category: 'Module', icon: '⏰' },
  { label: 'Performance Reviews', path: '/dashboard/performance', category: 'Module', icon: '🎯' },
  { label: 'LMS / Training', path: '/dashboard/lms', category: 'Module', icon: '🎓' },
  { label: 'Asset Management', path: '/dashboard/assets', category: 'Module', icon: '💻' },
  { label: 'Analytics & Reports', path: '/dashboard/analytics', category: 'Module', icon: '📈' },
  { label: 'Billing & Subscriptions', path: '/dashboard/billing', category: 'Module', icon: '💳' },
  { label: 'My Profile & Settings', path: '/dashboard/profile', category: 'Module', icon: '👤' },
];

export const Header: React.FC<HeaderProps> = ({
  companyName,
  currentTime,
  email,
  designation,
  isSuperAdmin,
  timeLeft,
  resetSessionTimer,
  formatTime,
  mobileMenuOpen,
  setMobileMenuOpen,
  setSettingsOpen,
  setMoreAppsOpen,
  handleLogout,
  theme,
  setTheme,
}) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [employeesList, setEmployeesList] = useState<any[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const profileMenuRef = useRef<HTMLDivElement>(null);

  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [userFullName, setUserFullName] = useState<string>('');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('myProfile');
      if (stored) {
        const parsed = JSON.parse(stored);
        const img = parsed.emp_image || parsed.profile_picture || parsed.profile_image || parsed.avatar_url || parsed.photo_url || parsed.avatar || parsed.photo;
        if (img) setProfilePhoto(img);
        const fname = (parsed.first_name || parsed.name || '').trim();
        const lname = (parsed.last_name || '').trim();
        const fullName = `${fname} ${lname}`.trim();
        if (fullName) setUserFullName(fullName);
      }
    } catch (e) {}

    const fetchMe = async () => {
      try {
        const res = await fetch('/api/v1/employees/me', { headers: getHeaders() });
        if (res.ok) {
          const data = await res.json();
          const emp = data.employee || data;
          const img = emp.emp_image || emp.profile_picture || emp.profile_image || emp.avatar_url || emp.photo_url || emp.avatar || emp.photo;
          if (img) setProfilePhoto(img);
          const fname = (emp.first_name || emp.name || '').trim();
          const lname = (emp.last_name || '').trim();
          const fullName = `${fname} ${lname}`.trim();
          if (fullName) setUserFullName(fullName);
        }
      } catch (e) {}
    };
    fetchMe();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setShowSearchDropdown(true);
      }
    };
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const fetchEmployeesForSearch = async () => {
    if (employeesList.length > 0) return;
    try {
      const res = await fetch(getUrl('/api/v1/employees'), { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setEmployeesList(data.employees || []);
      }
    } catch (e) {
      console.warn('Global search employee fetch error:', e);
    }
  };

  const filteredNav = GLOBAL_NAV_ITEMS.filter((item) =>
    item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredEmployees = searchQuery.trim()
    ? employeesList.filter((emp) => {
        const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.toLowerCase();
        const emailStr = (emp.email || '').toLowerCase();
        const codeStr = (emp.emp_id_code || '').toLowerCase();
        const desigStr = (emp.designation_name || '').toLowerCase();
        const q = searchQuery.toLowerCase();
        return fullName.includes(q) || emailStr.includes(q) || codeStr.includes(q) || desigStr.includes(q);
      }).slice(0, 6)
    : [];

  const toggleTheme = () => {
    if (theme === 'nordic-light') {
      setTheme('slate-dark');
    } else {
      setTheme('nordic-light');
    }
  };

  return (
    <header
      style={{ fontFamily: '"Inter", "DM Sans", sans-serif' }}
      className="flex h-16 flex-shrink-0 items-center justify-between rounded-xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm px-2.5 sm:px-4 md:px-6 transition-colors duration-200 z-20 w-full"
    >
      {/* 👈 Left Header Section: Mobile Menu + Company Badge + Live Clock */}
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all shadow-xs cursor-pointer"
          title="Toggle Navigation Menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Header Organization / Company Badge / Global Selector */}
        <HeaderCompanySelector companyName={companyName} isSuperAdmin={isSuperAdmin} />

        {/* Live Date & Clock Display Badge */}
        <div className="hidden lg:flex items-center px-3.5 py-1.5 rounded-lg bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/70 text-slate-700 dark:text-slate-200 select-none shadow-2xs">
          <div className="flex flex-col text-left leading-tight">
            <span className="text-xs sm:text-sm font-black font-mono tracking-tight tabular-nums text-slate-900 dark:text-slate-100">
              {currentTime ? currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) : ''}
            </span>
            <span className="text-[10.5px] font-extrabold text-slate-500 dark:text-slate-400 tracking-tight">
              {currentTime ? currentTime.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : ''}
            </span>
          </div>
        </div>
      </div>

      {/* 👉 Center & Right Header Section: Global Search + Session Timer + Notifications + Theme + Profile */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 justify-end">

        {/* 🔍 GLOBAL SEARCH INPUT & DROPDOWN */}
        <div className="hidden md:block relative w-44 lg:w-56 xl:w-64 mx-1.5">
          <div className="relative flex items-center">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none z-10 text-slate-400">
              <svg className="w-4 h-4 text-[#07518a]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </span>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              style={{ paddingLeft: '2.6rem', paddingRight: '4rem' }}
              onFocus={() => {
                fetchEmployeesForSearch();
                if (searchQuery.trim().length > 0) {
                  setShowSearchDropdown(true);
                }
              }}
              onChange={(e) => {
                const val = e.target.value;
                setSearchQuery(val);
                if (val.trim().length > 0) {
                  setShowSearchDropdown(true);
                } else {
                  setShowSearchDropdown(false);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchQuery.trim().length > 0) {
                  setShowSearchDropdown(true);
                }
              }}
              placeholder="Search modules, pages, employees..."
              className="w-full h-[38px] py-1.5 rounded-lg border border-slate-200/90 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-md text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 font-medium outline-none focus:border-[#07518a] focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-[#07518a]/15 transition-all duration-200 shadow-inner"
            />
            <div className="absolute right-2.5 flex items-center gap-1">
              {searchQuery ? (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setShowSearchDropdown(false);
                  }}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs p-1 font-bold cursor-pointer transition-colors"
                >
                  ✕
                </button>
              ) : (
                <kbd className="hidden sm:inline-block px-2 py-0.5 text-[9.5px] font-mono font-bold text-slate-500 dark:text-slate-400 bg-slate-200/80 dark:bg-slate-800 rounded-lg border border-slate-300/60 dark:border-slate-700 shadow-2xs">
                  Ctrl K
                </kbd>
              )}
            </div>
          </div>

          {/* Search Dropdown Results */}
          {showSearchDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowSearchDropdown(false)} />
              <div className="absolute left-1/2 -translate-x-1/2 mt-2.5 w-[92vw] sm:w-[500px] max-h-[480px] overflow-y-auto rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl p-4 shadow-2xl shadow-slate-900/15 z-50 animate-in fade-in slide-in-from-top-2 duration-200 no-scrollbar space-y-4 font-sans">
                
                {/* Modules & Pages Section */}
                {filteredNav.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between px-2 pb-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-[10.5px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest flex items-center gap-1.5">
                        <span>⚡</span> Modules & Pages
                      </span>
                      <span className="text-[9.5px] font-black px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60">
                        {filteredNav.length} FOUND
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {filteredNav.slice(0, 8).map((nav) => (
                        <Link
                          key={nav.path}
                          href={nav.path}
                          onClick={() => setShowSearchDropdown(false)}
                          className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-blue-50/80 dark:hover:bg-slate-800/80 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-150 group"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-sm shrink-0">{nav.icon || '📄'}</span>
                            <span className="truncate max-w-[320px]">{nav.label}</span>
                          </div>
                          <span className="text-[10px] text-slate-300 dark:text-slate-600 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all">➜</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Employees Section */}
                {filteredEmployees.length > 0 && (
                  <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between px-2 pb-1">
                      <span className="text-[10.5px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest flex items-center gap-1.5">
                        <span>👥</span> Employees Directory
                      </span>
                      <span className="text-[9.5px] font-black px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60">
                        {filteredEmployees.length} MATCHES
                      </span>
                    </div>
                    <div className="space-y-1">
                      {filteredEmployees.map((emp) => (
                        <Link
                          key={emp.id}
                          href={`/dashboard/employees/${emp.id}`}
                          onClick={() => setShowSearchDropdown(false)}
                          className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-gradient-to-r hover:from-indigo-50/80 hover:to-purple-50/50 dark:hover:from-indigo-950/40 dark:hover:to-purple-950/30 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-150 group shadow-2xs hover:shadow-xs border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900/30"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-black text-xs flex items-center justify-center shadow-xs shrink-0">
                              {emp.first_name ? emp.first_name.charAt(0).toUpperCase() : 'E'}
                            </div>
                            <div className="text-left min-w-0 flex-1">
                              <p className="leading-tight font-black text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 truncate">
                                {emp.first_name} {emp.last_name}
                              </p>
                              <p className="text-[10.5px] font-medium text-slate-400 dark:text-slate-500 truncate">
                                {emp.email || emp.emp_id_code}
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 px-2.5 py-1 rounded-xl border border-indigo-200 dark:border-indigo-800/60 shadow-2xs shrink-0 whitespace-nowrap truncate max-w-[170px]">
                            {emp.designation_name || 'Employee'}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {filteredNav.length === 0 && filteredEmployees.length === 0 && (
                  <div className="py-8 text-center space-y-2">
                    <span className="text-2xl">🔍</span>
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      No matching modules or employees found
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Try searching for keyword like "Payroll", "Leave", or employee name
                    </p>
                  </div>
                )}

                {/* Dropdown Footer Shortcuts */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500 px-2">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 font-mono">↵</kbd> Select
                    </span>
                    <span className="flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 font-mono">ESC</kbd> Close
                    </span>
                  </div>
                  <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-blue-500">
                    Enterprise Search Console
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 🎈 MOOD BOOSTER / INSTANT CHEER WIDGET */}
        <div className="hidden sm:block">
          <MoodBooster userName={userFullName || (email ? email.split('@')[0] : '')} />
        </div>

        {/* ⚙️ Personalization Settings Cog */}
        <button
          onClick={() => setSettingsOpen(true)}
          className="hidden sm:flex p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-card text-slate-500 hover:text-slate-850 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-xs"
          title="UI Personalization & Aesthetic Settings"
        >
          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.43l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.991l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        {/* 🔔 Live Enterprise Notification Bell & Drawer */}
        <NotificationBell />

        {/* 👤 Senior Executive User Profile Avatar & Dropdown */}
        <div ref={profileMenuRef} className="relative shrink-0">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2 bg-slate-100/70 dark:bg-slate-800/40 hover:bg-slate-200/60 dark:hover:bg-slate-800/80 p-1 sm:pl-3.5 sm:pr-2 sm:py-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 select-none transition-all cursor-pointer shadow-xs shrink-0"
          >
            {/* 1. NAMES ON LEFT */}
            <div className="hidden sm:flex flex-col text-right cursor-pointer">
              <span className="text-xs font-black tracking-tight leading-none text-[#07518a] dark:text-[#38bdf8] truncate max-w-[200px]">
                {((userFullName || (email ? email.split('@')[0] : 'ADMIN')).length > 30
                  ? (userFullName || (email ? email.split('@')[0] : 'ADMIN')).slice(0, 30) + '...'
                  : (userFullName || (email ? email.split('@')[0] : 'ADMIN'))).toUpperCase()}
              </span>
              <span className="text-[9px] font-black text-slate-950 dark:text-white tracking-wider uppercase mt-1 leading-none truncate max-w-[200px]">
                {((designation || (isSuperAdmin ? 'SUPER ADMIN' : 'EXECUTIVE')).length > 30
                  ? (designation || (isSuperAdmin ? 'SUPER ADMIN' : 'EXECUTIVE')).slice(0, 30) + '...'
                  : (designation || (isSuperAdmin ? 'SUPER ADMIN' : 'EXECUTIVE'))).toUpperCase()}
              </span>
            </div>

            {/* 2. IMAGE / CAPITAL INITIAL BADGE ON RIGHT */}
            <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-[#07518a] text-white font-extrabold text-xs uppercase shadow-sm flex-shrink-0 overflow-hidden">
              {profilePhoto && !imageError ? (
                <img
                  src={profilePhoto}
                  alt="Profile"
                  className="w-full h-full object-cover rounded-xl"
                  onError={() => setImageError(true)}
                />
              ) : (
                <span>{(userFullName || (email ? email.split('@')[0] : 'U')).charAt(0).toUpperCase()}</span>
              )}
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900 z-10" />
            </div>

            <svg
              className={`hidden sm:block w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                showProfileMenu ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          {/* Profile Dropdown Menu */}
          {showProfileMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
              <div 
                className="absolute right-0 mt-2 w-44 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0f172a] shadow-xl shadow-slate-900/10 z-50 animate-toast overflow-hidden p-1.5 space-y-1 font-sans"
              >
                <Link
                  href="/dashboard/profile"
                  onClick={() => setShowProfileMenu(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-[#07518a]/10 hover:text-[#07518a] dark:hover:text-[#38bdf8] font-bold text-xs transition-all duration-150 group cursor-pointer"
                >
                  <User className="w-4 h-4 text-[#07518a] dark:text-[#38bdf8] shrink-0" />
                  <span>Profile</span>
                </Link>

                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-bold text-xs transition-all duration-150 group cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-rose-500 transition-transform group-hover:translate-x-0.5 shrink-0" />
                  <span>Sign Out</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
