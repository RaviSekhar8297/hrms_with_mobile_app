'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { getHeaders, getUrl } from '../utils/api';

interface NotificationItem {
  id: number;
  text: string;
  time: string;
  unread: boolean;
  category?: 'system' | 'employee' | 'payroll';
}

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

const GLOBAL_NAV_ITEMS = [
  { label: 'Overview / Dashboard', path: '/dashboard/overview', category: 'Module', icon: '📊' },
  { label: 'Employees Directory', path: '/dashboard/employees', category: 'Module', icon: '👥' },
  { label: 'Attendance Requests', path: '/dashboard/attendance_requests', category: 'Module', icon: '⏱️' },
  { label: 'Permission Requests', path: '/dashboard/attendance_permissions', category: 'Module', icon: '📝' },
  { label: 'Attendance Policies & Logs', path: '/dashboard/attendance', category: 'Module', icon: '📅' },
  { label: 'Leave Requests & Balances', path: '/dashboard/leaves', category: 'Module', icon: '🌴' },
  { label: 'Payroll Management', path: '/dashboard/payroll', category: 'Module', icon: '💰' },
  { label: 'Run Payroll Batch', path: '/dashboard/payroll/generate', category: 'Module', icon: '⚡' },
  { label: 'Salary Structures', path: '/dashboard/structure', category: 'Module', icon: '📑' },
  { label: 'Formula Builder', path: '/dashboard/formula', category: 'Module', icon: '🧮' },
  { label: 'Tenants / Companies', path: '/dashboard/companies', category: 'Module', icon: '🏢' },
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
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [notifFilter, setNotifFilter] = useState<'all' | 'unread'>('all');

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [employeesList, setEmployeesList] = useState<any[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [notifications, setNotifications] = useState<NotificationItem[]>([
    { id: 1, text: 'New employee Arjun Kumar registered in Hitech City Branch', time: '2 mins ago', unread: true, category: 'employee' },
    { id: 2, text: 'Branch "Hitech City, Hyderabad" configuration saved', time: '1 hour ago', unread: true, category: 'system' },
    { id: 3, text: 'System security scan passed with zero vulnerabilities', time: '5 hours ago', unread: true, category: 'system' },
    { id: 4, text: 'Monthly payroll batch generated for Engineering Dept', time: '1 day ago', unread: false, category: 'payroll' },
  ]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setShowSearchDropdown(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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

  const unreadCount = notifications.filter((n) => n.unread).length;

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const clearNotification = (id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const toggleTheme = () => {
    if (theme === 'nordic-light') {
      setTheme('slate-dark');
    } else {
      setTheme('nordic-light');
    }
  };

  return (
    <header
      style={{ fontFamily: '"DM Sans", sans-serif' }}
      className="flex h-18 flex-shrink-0 items-center justify-between border-b border-slate-200/60 dark:border-slate-800/80 bg-card/95 backdrop-blur-md px-4 md:px-6 shadow-xs transition-colors duration-200 z-20"
    >
      {/* 👈 Left Header Section: Mobile Menu + Company Badge + Live Clock */}
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-card text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-xs cursor-pointer"
          title="Toggle Navigation Menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Header Organization / Company Badge */}
        <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50/80 dark:from-blue-950/40 dark:to-indigo-950/30 border border-blue-200/70 dark:border-blue-900/50 text-blue-700 dark:text-blue-300 shadow-2xs">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-xs font-black shadow-xs flex-shrink-0">
            🏢
          </div>
          <span className="text-xs font-black tracking-wide uppercase truncate max-w-[130px] sm:max-w-[200px] md:max-w-[260px]">
            {companyName}
          </span>
        </div>

        {/* Live Date & Clock Display Badge (Stacked: Time Top, Date Bottom) */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 select-none shadow-2xs">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" title="System Clock Active" />
          <div className="flex flex-col text-left leading-tight">
            <span className="text-xs font-mono font-black tracking-wide tabular-nums text-slate-800 dark:text-slate-100">
              {currentTime ? currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) : ''}
            </span>
            <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 tracking-tight mt-0.5">
              {currentTime ? currentTime.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : ''}
            </span>
          </div>
        </div>
      </div>

      {/* 👉 Center & Right Header Section: Global Search + Session Timer + Notifications + Theme + Profile */}
      <div className="flex items-center gap-2.5 sm:gap-3 flex-1 justify-end">

        {/* 🔍 GLOBAL SEARCH INPUT & DROPDOWN */}
        <div className="relative flex-1 max-w-xs sm:max-w-md mx-2">
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
              placeholder="Global Search (Ctrl + K)..."
              className="w-full pl-search pr-search py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900/60 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 font-medium outline-none focus:border-blue-500 focus:bg-card focus:ring-2 focus:ring-blue-500/20 transition-all shadow-2xs"
            />
            <div className="absolute right-2.5 flex items-center gap-1">
              {searchQuery ? (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setShowSearchDropdown(false);
                  }}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs px-1 font-bold cursor-pointer"
                >
                  ✕
                </button>
              ) : (
                <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-mono font-bold text-slate-400 bg-slate-200/60 dark:bg-slate-800 rounded border border-slate-300/50 dark:border-slate-700">
                  Ctrl K
                </kbd>
              )}
            </div>
          </div>

          {/* Search Dropdown Results */}
          {showSearchDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowSearchDropdown(false)} />
              <div className="absolute left-0 right-0 mt-2.5 max-h-96 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-card p-3 shadow-2xl z-50 animate-toast no-scrollbar">
                
                {/* Modules & Pages Section */}
                {filteredNav.length > 0 && (
                  <div className="mb-3">
                    <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider px-2 block mb-1.5">
                      📑 Modules & Pages ({filteredNav.length})
                    </span>
                    <div className="space-y-1">
                      {filteredNav.slice(0, 8).map((nav) => (
                        <Link
                          key={nav.path}
                          href={nav.path}
                          onClick={() => setShowSearchDropdown(false)}
                          className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-blue-50/70 dark:hover:bg-blue-950/40 hover:text-blue-600 transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-base">{nav.icon}</span>
                            <span>{nav.label}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono font-normal hidden sm:inline">{nav.path}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Employees Section */}
                {filteredEmployees.length > 0 && (
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider px-2 block mb-1.5 border-t border-slate-100 dark:border-slate-800/80 pt-2">
                      👥 Employees ({filteredEmployees.length})
                    </span>
                    <div className="space-y-1">
                      {filteredEmployees.map((emp) => (
                        <Link
                          key={emp.id}
                          href={`/dashboard/employees/${emp.id}`}
                          onClick={() => setShowSearchDropdown(false)}
                          className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 hover:text-indigo-600 transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-black text-[10px] flex items-center justify-center border border-indigo-500/20">
                              {emp.first_name ? emp.first_name.charAt(0).toUpperCase() : 'E'}
                            </div>
                            <div>
                              <p className="leading-tight font-extrabold">{emp.first_name} {emp.last_name}</p>
                              <p className="text-[10px] font-normal text-slate-400 dark:text-slate-500">{emp.email || emp.emp_id_code}</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-semibold text-indigo-500 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-900/40">
                            {emp.designation_name || 'Employee'}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {filteredNav.length === 0 && filteredEmployees.length === 0 && (
                  <div className="p-4 text-center text-xs font-semibold text-slate-400">
                    No matching modules or employees found for "{searchQuery}"
                  </div>
                )}
              </div>
            </>
          )}
        </div>



        {/* 🌓 Quick Dark/Light Theme Switcher */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-card text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-xs"
          title={`Switch to ${theme === 'nordic-light' ? 'Slate Dark' : 'Nordic Light'} mode`}
        >
          {theme === 'nordic-light' ? (
            <svg className="w-4.5 h-4.5 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m0 13.5V21m8.25-9h-2.25M5.25 12H3m15.364 6.364l-1.591-1.591M6.75 6.75L5.159 5.159m12.728 0l-1.591 1.591M6.75 17.25l-1.591 1.591M12 8.25a3.75 3.75 0 100 7.5 3.75 3.75 0 000-7.5z" />
            </svg>
          ) : (
            <svg className="w-4.5 h-4.5 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
            </svg>
          )}
        </button>

        {/* ⚙️ Personalization Settings Cog */}
        <button
          onClick={() => setSettingsOpen(true)}
          className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-card text-slate-500 hover:text-slate-850 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-xs"
          title="UI Personalization & Aesthetic Settings"
        >
          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.43l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.991l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        {/* 🔔 Notification Bell & Popover Drawer */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-card text-slate-500 hover:text-slate-850 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-xs"
            title="Notification Center"
          >
            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" />
            )}
          </button>

          {showNotifications && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
              <div className="absolute right-0 mt-2.5 w-80 sm:w-96 rounded-2xl border border-slate-200 dark:border-slate-800 bg-card p-4 shadow-2xl z-50 animate-toast">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-xs text-slate-800 dark:text-slate-200 uppercase tracking-widest">
                      Notifications
                    </span>
                    {unreadCount > 0 && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                <div className="flex gap-1 mb-3 p-1 rounded-xl bg-slate-100/70 dark:bg-slate-800/60 text-[10px] font-extrabold">
                  <button
                    onClick={() => setNotifFilter('all')}
                    className={`flex-1 py-1 rounded-lg transition-colors cursor-pointer ${
                      notifFilter === 'all'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    All ({notifications.length})
                  </button>
                  <button
                    onClick={() => setNotifFilter('unread')}
                    className={`flex-1 py-1 rounded-lg transition-colors cursor-pointer ${
                      notifFilter === 'unread'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    Unread ({unreadCount})
                  </button>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto no-scrollbar">
                  {notifications
                    .filter((n) => (notifFilter === 'unread' ? n.unread : true))
                    .map((notif) => (
                      <div
                        key={notif.id}
                        className={`group relative p-3 rounded-xl border transition-all text-xs leading-relaxed ${
                          notif.unread
                            ? 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-900/40'
                            : 'bg-transparent border-transparent hover:bg-slate-100/60 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <p className="font-medium text-slate-800 dark:text-slate-200 pr-4">{notif.text}</p>
                          <button
                            onClick={() => clearNotification(notif.id)}
                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs transition-opacity cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold block mt-1.5">
                          {notif.time}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* 👤 Senior Executive User Profile Avatar & Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2 bg-slate-100/70 dark:bg-slate-800/40 hover:bg-slate-200/60 dark:hover:bg-slate-800/80 p-1 sm:px-3 sm:py-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 select-none transition-all cursor-pointer shadow-xs"
          >
            <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 text-white font-extrabold text-xs uppercase shadow-sm flex-shrink-0">
              {email ? email.charAt(0).toUpperCase() : 'U'}
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
            </div>

            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-black tracking-tight leading-none text-slate-800 dark:text-slate-100">
                {email ? email.split('@')[0].toUpperCase() : 'ADMIN'}
              </span>
              <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 tracking-wider uppercase mt-1 leading-none">
                {(designation || (isSuperAdmin ? 'SUPER ADMIN' : 'EXECUTIVE')).toUpperCase()}
              </span>
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
              <div className="absolute right-0 mt-3 w-72 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-card/95 backdrop-blur-xl p-3.5 shadow-2xl z-50 animate-toast space-y-3 font-sans">
                {/* Header User Card */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-transparent border border-blue-500/10 dark:border-blue-500/20">
                  <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 text-white font-black text-sm uppercase shadow-sm flex-shrink-0">
                    {email ? email.charAt(0).toUpperCase() : 'U'}
                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" />
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">
                      {email ? email.split('@')[0].toUpperCase() : 'ADMIN'}
                    </span>
                    <span className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400 truncate">
                      {email}
                    </span>
                    <span className="inline-flex items-center gap-1 mt-1 text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      {designation || (isSuperAdmin ? 'SUPER ADMINISTRATOR' : 'ORGANIZATION MEMBER')}
                    </span>
                  </div>
                </div>

                {/* Quick Menu Links */}
                <div className="space-y-1">
                  <Link
                    href="/dashboard/profile"
                    onClick={() => setShowProfileMenu(false)}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-all duration-150 group"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors flex-shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        My Profile Settings
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">View & manage your account</span>
                    </div>
                  </Link>

                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      setSettingsOpen(true);
                    }}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-all duration-150 cursor-pointer group"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors flex-shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072" />
                      </svg>
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        UI Personalization
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">Color themes & dark mode</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      setMoreAppsOpen(true);
                    }}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-all duration-150 cursor-pointer group"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-colors flex-shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 16.875h3.375m0 0h3.375m-3.375 0V13.5m0 3.375v3.375M6 10.5h2.25a2.25 2.25 0 002.25-2.25V6a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6v2.25A2.25 2.25 0 006 10.5zm0 9.75h2.25a2.25 2.25 0 002.25-2.25v-2.25a2.25 2.25 0 00-2.25-2.25H6a2.25 2.25 0 00-2.25 2.25v2.25A2.25 2.25 0 006 20.25zM15.75 6a2.25 2.25 0 012.25-2.25h2.25A2.25 2.25 0 0122.5 6v2.25a2.25 2.25 0 01-2.25 2.25h-2.25A2.25 2.25 0 0115.75 8.25V6z" />
                      </svg>
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        Module Launcher
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">Quick switch HR apps</span>
                    </div>
                  </button>
                </div>

                {/* Footer Sign Out */}
                <div className="border-t border-slate-100 dark:border-slate-800/80 pt-2">
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      handleLogout();
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-600 text-rose-600 hover:text-white dark:text-rose-400 border border-rose-500/20 transition-all duration-200 text-xs font-bold cursor-pointer group"
                  >
                    <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                    </svg>
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
