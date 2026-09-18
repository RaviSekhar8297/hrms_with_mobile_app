'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { User, LogOut } from 'lucide-react';
import { getHeaders, getUrl } from '../utils/api';
import NotificationBell from './NotificationBell';
import { useDashboard } from './DashboardContext';
import MoodBooster from './MoodBooster';

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
            setCompanies(list);
            if (!companyId && !localStorage.getItem('companyId')) {
              setCompanyId(list[0].id);
            }
          }
        })
        .catch(err => console.error('Error fetching companies in header:', err));
    }
  }, [isSuperAdmin, companies.length]);

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] bg-slate-100/80 dark:bg-white/[0.05] border border-[#e4e7ec] dark:border-white/[0.08] text-slate-700 dark:text-slate-200">
        <div className="hidden sm:flex w-5 h-5 rounded-md bg-brand-600 text-white items-center justify-center flex-shrink-0">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
          </svg>
        </div>
        <span className="text-[11px] sm:text-[11.5px] font-semibold tracking-wide uppercase truncate max-w-[85px] xs:max-w-[120px] sm:max-w-[210px] md:max-w-[280px]">
          {companyName || 'Company Tenant'}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-[10px] bg-slate-100/80 dark:bg-white/[0.05] border border-[#e4e7ec] dark:border-white/[0.08] text-slate-700 dark:text-slate-200">
      <div className="hidden sm:flex w-5 h-5 rounded-md bg-brand-600 text-white items-center justify-center flex-shrink-0">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
        </svg>
      </div>
      <select
        value={companyId || 'all'}
        onChange={(e) => setCompanyId(e.target.value === 'all' ? null : e.target.value)}
        className="header-company-select uppercase truncate max-w-[90px] xs:max-w-[130px] sm:max-w-[220px] md:max-w-[300px]"
      >
        <option value="all" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-semibold uppercase">
          -- All Companies --
        </option>
        {companies.map(c => (
          <option key={c.id} value={c.id} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-semibold uppercase">
            {c.name}
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
      className="flex h-16 flex-shrink-0 items-center justify-between rounded-2xl border bg-card px-3 sm:px-4 md:px-5 transition-colors duration-200 z-20 w-full"
    >
      {/* 👈 Left Header Section: Mobile Menu + Company Badge + Live Clock */}
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 rounded-[10px] border border-[#e4e7ec] dark:border-white/[0.08] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-all cursor-pointer"
          title="Toggle Navigation Menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Header Organization / Company Badge / Global Selector */}
        <HeaderCompanySelector companyName={companyName} isSuperAdmin={isSuperAdmin} />

        {/* Live Date & Clock Display Badge */}
        <div className="hidden lg:flex items-center gap-2.5 px-3.5 py-1.5 rounded-[10px] bg-slate-100/80 dark:bg-white/[0.05] border border-[#e4e7ec] dark:border-white/[0.08] text-slate-700 dark:text-slate-200 select-none">
          <span className="h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0" title="System Clock Active" />
          <div className="flex flex-col text-left leading-tight">
            <span className="text-xs sm:text-[13px] font-semibold font-mono tracking-tight tabular-nums text-slate-900 dark:text-slate-100">
              {currentTime ? currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) : ''}
            </span>
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 tracking-tight">
              {currentTime ? currentTime.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : ''}
            </span>
          </div>
        </div>
      </div>

      {/* 👉 Center & Right Header Section: Global Search + Session Timer + Notifications + Theme + Profile */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 justify-end">

        {/* 🔍 GLOBAL SEARCH INPUT & DROPDOWN */}
        <div className="hidden md:block relative flex-1 max-w-xs sm:max-w-md mx-2">
          <div className="relative flex items-center">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none z-10 text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
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
              className="w-full py-2.5 text-xs"
            />
            <div className="absolute right-2.5 flex items-center gap-1">
              {searchQuery ? (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setShowSearchDropdown(false);
                  }}
                  className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.08] cursor-pointer transition-colors"
                >
                  ✕
                </button>
              ) : (
                <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-medium text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-white/[0.06] rounded-md border border-[#e4e7ec] dark:border-white/[0.08]">
                  Ctrl K
                </kbd>
              )}
            </div>
          </div>

          {/* Search Dropdown Results */}
          {showSearchDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowSearchDropdown(false)} />
              <div className="absolute left-1/2 -translate-x-1/2 mt-2.5 w-[92vw] sm:w-[500px] max-h-[480px] overflow-y-auto rounded-2xl border border-[#e4e7ec] dark:border-white/[0.08] bg-card p-4 shadow-[0_24px_64px_-16px_rgba(16,24,40,0.28)] dark:shadow-[0_24px_64px_-16px_rgba(0,0,0,0.65)] z-50 animate-fadeIn no-scrollbar space-y-4 font-sans">
                
                {/* Modules & Pages Section */}
                {filteredNav.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between px-2 pb-2 border-b border-[#eaecf0] dark:border-white/[0.06]">
                      <span className="text-[10.5px] font-semibold uppercase text-slate-400 dark:text-slate-500 tracking-[0.08em]">
                        Modules & Pages
                      </span>
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400">
                        {filteredNav.length} FOUND
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {filteredNav.slice(0, 8).map((nav) => (
                        <Link
                          key={nav.path}
                          href={nav.path}
                          onClick={() => setShowSearchDropdown(false)}
                          className="flex items-center justify-between px-2 py-1.5 rounded-[10px] text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-white/[0.05] hover:text-slate-900 dark:hover:text-slate-50 transition-colors duration-150 group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 dark:bg-white/[0.06] text-[13px] shrink-0">{nav.icon || '📄'}</span>
                            <span className="truncate max-w-[320px]">{nav.label}</span>
                          </div>
                          <svg className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
                          </svg>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Employees Section */}
                {filteredEmployees.length > 0 && (
                  <div className="space-y-1.5 pt-1 border-t border-[#eaecf0] dark:border-white/[0.06]">
                    <div className="flex items-center justify-between px-2 pb-2">
                      <span className="text-[10.5px] font-semibold uppercase text-slate-400 dark:text-slate-500 tracking-[0.08em]">
                        Employees Directory
                      </span>
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400">
                        {filteredEmployees.length} MATCHES
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {filteredEmployees.map((emp) => (
                        <Link
                          key={emp.id}
                          href={`/dashboard/employees/${emp.id}`}
                          onClick={() => setShowSearchDropdown(false)}
                          className="flex items-center justify-between gap-3 px-2 py-2 rounded-[10px] text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-white/[0.05] transition-colors duration-150 group"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600/10 text-brand-700 dark:bg-brand-400/10 dark:text-brand-300 font-semibold text-xs shrink-0">
                              {emp.first_name ? emp.first_name.charAt(0).toUpperCase() : 'E'}
                            </div>
                            <div className="text-left min-w-0 flex-1">
                              <p className="leading-tight font-medium text-slate-800 dark:text-slate-100 group-hover:text-brand-700 dark:group-hover:text-brand-300 truncate">
                                {emp.first_name} {emp.last_name}
                              </p>
                              <p className="text-[10.5px] font-normal text-slate-400 dark:text-slate-500 truncate">
                                {emp.email || emp.emp_id_code}
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/[0.06] px-2 py-1 rounded-md shrink-0 whitespace-nowrap truncate max-w-[170px]">
                            {emp.designation_name || 'Employee'}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {filteredNav.length === 0 && filteredEmployees.length === 0 && (
                  <div className="py-8 text-center space-y-2">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/[0.06] text-slate-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                      </svg>
                    </div>
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      No matching modules or employees found
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Try searching for keyword like "Payroll", "Leave", or employee name
                    </p>
                  </div>
                )}

                {/* Dropdown Footer Shortcuts */}
                <div className="pt-2 border-t border-[#eaecf0] dark:border-white/[0.06] flex items-center justify-between text-[10px] font-medium text-slate-400 dark:text-slate-500 px-2">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-white/[0.06] rounded-md border border-[#e4e7ec] dark:border-white/[0.08] font-mono">↵</kbd> Select
                    </span>
                    <span className="flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-white/[0.06] rounded-md border border-[#e4e7ec] dark:border-white/[0.08] font-mono">ESC</kbd> Close
                    </span>
                  </div>
                  <span className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
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

        {/* 🌓 Quick Dark/Light Theme Switcher */}
        <button
          onClick={toggleTheme}
          className="flex p-2 rounded-[10px] border border-[#e4e7ec] dark:border-white/[0.08] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-all cursor-pointer"
          title={`Switch to ${theme === 'nordic-light' ? 'Slate Dark' : 'Nordic Light'} mode`}
        >
          {theme === 'nordic-light' ? (
            <svg className="w-4.5 h-4.5 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m0 13.5V21m8.25-9h-2.25M5.25 12H3m15.364 6.364l-1.591-1.591M6.75 6.75L5.159 5.159m12.728 0l-1.591 1.591M6.75 17.25l-1.591 1.591M12 8.25a3.75 3.75 0 100 7.5 3.75 3.75 0 000-7.5z" />
            </svg>
          ) : (
            <svg className="w-4.5 h-4.5 text-brand-400" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
            </svg>
          )}
        </button>

        {/* ⚙️ Personalization Settings Cog */}
        <button
          onClick={() => setSettingsOpen(true)}
          className="hidden sm:flex p-2 rounded-[10px] border border-[#e4e7ec] dark:border-white/[0.08] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-all cursor-pointer"
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
            className="flex items-center gap-2 bg-transparent hover:bg-slate-50 dark:hover:bg-white/[0.05] p-1 sm:pl-3 sm:pr-1.5 sm:py-1 rounded-[10px] border border-[#e4e7ec] dark:border-white/[0.08] select-none transition-all cursor-pointer shrink-0"
          >
            {/* 1. NAMES ON LEFT */}
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold tracking-tight leading-none text-slate-800 dark:text-slate-100">
                {(userFullName || (email ? email.split('@')[0] : 'ADMIN')).toUpperCase()}
              </span>
              <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500 tracking-[0.08em] uppercase mt-1 leading-none">
                {(designation || (isSuperAdmin ? 'SUPER ADMIN' : 'EXECUTIVE')).toUpperCase()}
              </span>
            </div>

            {/* 2. IMAGE / CAPITAL INITIAL BADGE ON RIGHT */}
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white font-semibold text-xs uppercase flex-shrink-0 overflow-hidden">
              {profilePhoto && !imageError ? (
                <img
                  src={profilePhoto}
                  alt="Profile"
                  className="w-full h-full object-cover rounded-lg"
                  onError={() => setImageError(true)}
                />
              ) : (
                <span>{(userFullName || (email ? email.split('@')[0] : 'U')).charAt(0).toUpperCase()}</span>
              )}
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#0f172a] z-10" />
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
                className="absolute right-0 mt-2.5 w-48 rounded-xl border border-[#e4e7ec] dark:border-white/[0.08] shadow-[0_16px_40px_-12px_rgba(16,24,40,0.24)] dark:shadow-[0_16px_40px_-12px_rgba(0,0,0,0.6)] z-50 animate-toast overflow-hidden p-1 space-y-0.5 font-sans"
                style={{ backgroundColor: theme === 'nordic-light' ? '#ffffff' : '#111827' }}
              >
                <Link
                  href="/dashboard/profile"
                  onClick={() => setShowProfileMenu(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-700 dark:text-slate-200 hover:text-brand-700 dark:hover:text-brand-300 font-medium text-xs transition-colors duration-150 group cursor-pointer"
                >
                  <User className="w-4 h-4 text-slate-400 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors shrink-0" />
                  <span>Profile</span>
                </Link>

                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium text-xs transition-colors duration-150 group cursor-pointer"
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
