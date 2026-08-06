'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { DashboardProvider, useDashboard, FontType } from './components/DashboardContext';
import { Header } from './components/Header';
import { Sidebar, SidebarGroup, SidebarItem } from './components/Sidebar';

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const currentTab = pathname.split('/').pop() || 'overview';

  const {
    layout,
    setLayout,
    theme,
    setTheme,
    font,
    setFont,
    toasts,
    dismissToast,
    bodyLoading,
  } = useDashboard();

  const [authorized, setAuthorized] = useState(false);
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [moreAppsOpen, setMoreAppsOpen] = useState(false);
  const [appSearch, setAppSearch] = useState('');
  const [companyLogo, setCompanyLogo] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('HRMS PORTAL');
  const [logoError, setLogoError] = useState<boolean>(false);
  const [designation, setDesignation] = useState<string>('');
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setLogoError(false);
  }, [companyLogo]);

  // ⏳ Session Timer State
  const SESSION_DURATION = 3000;
  const [timeLeft, setTimeLeft] = useState<number>(SESSION_DURATION);
  const [showSessionWarning, setShowSessionWarning] = useState<boolean>(false);

  const resetSessionTimer = () => {
    setTimeLeft(SESSION_DURATION);
    setShowSessionWarning(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Draggable bottom pill state & refs
  const [fabPos, setFabPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ startX: 0, startY: 0, posX: 0, posY: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(false);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: fabPos.x,
      posY: fabPos.y,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - dragStartRef.current.startX;
      const dy = moveEvent.clientY - dragStartRef.current.startY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        setIsDragging(true);
      }
      setFabPos({
        x: dragStartRef.current.posX + dx,
        y: dragStartRef.current.posY + dy,
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(false);
    const touch = e.touches[0];
    dragStartRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      posX: fabPos.x,
      posY: fabPos.y,
    };

    const handleTouchMove = (moveEvent: TouchEvent) => {
      const touch = moveEvent.touches[0];
      const dx = touch.clientX - dragStartRef.current.startX;
      const dy = touch.clientY - dragStartRef.current.startY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        setIsDragging(true);
      }
      setFabPos({
        x: dragStartRef.current.posX + dx,
        y: dragStartRef.current.posY + dy,
      });
    };

    const handleTouchEnd = () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };

    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);
  };

  const handleFabClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (isDragging) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    setMoreAppsOpen(true);
  };

  useEffect(() => {
    if (!moreAppsOpen) {
      setAppSearch('');
    }
  }, [moreAppsOpen]);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const storedEmail = localStorage.getItem('email');
    const storedRoles = localStorage.getItem('roles');
    const storedPermissions = localStorage.getItem('permissions');

    const storedDesignation = localStorage.getItem('designation');
    if (storedDesignation) {
      setDesignation(storedDesignation);
    }

    if (!token) {
      router.push('/login');
    } else {
      setAuthorized(true);
      setEmail(storedEmail || 'user@hrms.com');
      if (storedRoles) {
        setRoles(JSON.parse(storedRoles));
      }
      if (storedPermissions) {
        setPermissions(JSON.parse(storedPermissions));
      }
      // Load company branding
      const storedCompanyId = localStorage.getItem('companyId');
      fetch(`http://localhost:5000/api/v1/companies`, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...(storedCompanyId ? { 'x-company-id': storedCompanyId } : {}),
        },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data) return;
          const companies: Array<{ id: string; name: string; branding_logo: string }> =
            data.companies || [];
          const match = companies.find((c) => c.id === storedCompanyId) || companies[0];
          if (match) {
            setCompanyLogo(match.branding_logo || '');
            setCompanyName(match.name || 'HRMS PORTAL');
          }
        })
        .catch(() => {});

      // Fetch employee designation details
      fetch(`http://localhost:5000/api/v1/employees`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data) return;
          const list: Array<{ email: string; designation_name: string }> = data.employees || [];
          const found = list.find(
            (emp) => emp.email.toLowerCase() === (storedEmail || '').toLowerCase()
          );
          if (found) {
            setDesignation(found.designation_name || 'Organization Member');
            localStorage.setItem('designation', found.designation_name || '');
          } else {
            const isUserSuper = JSON.parse(storedRoles || '[]')
              .map((r: string) => r.toLowerCase())
              .includes('superadmin');
            if (isUserSuper) {
              setDesignation('SUPER ADMIN');
              localStorage.setItem('designation', 'SUPER ADMIN');
            }
          }
        })
        .catch(() => {});
    }
  }, [router, pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      if (response.status === 401) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('email');
        localStorage.removeItem('roles');
        localStorage.removeItem('permissions');
        localStorage.removeItem('companyId');
        localStorage.removeItem('designation');
        sessionStorage.clear();
        router.push('/login?clear=true');
      }
      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('email');
    localStorage.removeItem('roles');
    localStorage.removeItem('permissions');
    localStorage.removeItem('companyId');
    localStorage.removeItem('designation');
    sessionStorage.clear();
    router.push('/login?clear=true');
  };

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans transition-colors duration-200">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Verifying session security...</p>
        </div>
      </div>
    );
  }

  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('superadmin');

  // Helper to check dynamic role-based permissions
  const hasPermission = (permissionName?: string) => {
    if (!permissionName) return true;
    if (isSuperAdmin) return true;
    return permissions.includes(permissionName);
  };

  // Unified list of sidebar groups and items
  const sidebarGroups: SidebarGroup[] = [
    {
      title: 'Core Console',
      items: isSuperAdmin
        ? [
            {
              tab: 'overview',
              label: 'Overview',
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              ),
            },
            {
              tab: 'profile',
              label: 'My Profile',
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              ),
            },
            {
              tab: 'analytics',
              label: 'Analytics',
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 00-2 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h-2a2 2 0 00-2-2z" />
                </svg>
              ),
            },
            {
              tab: 'employees',
              label: 'Employees',
              permission: 'view_employees',
              badge: 'Active',
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ),
            },
          ]
        : [
            {
              tab: 'overview',
              label: 'Dashboard',
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              ),
            },
            {
              tab: 'profile',
              label: 'My Profile',
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              ),
            },
            {
              tab: 'attendance_requests',
              label: 'Attendance Requests',
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              ),
            },
            {
              tab: 'attendance_permissions',
              label: 'Permission Requests',
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ),
            },
          ],
    },
    {
      title: 'Organization',
      items: [
        {
          tab: 'flow',
          label: 'Organization Flow',
          permission: 'view_branches',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3m0 0a3 3 0 100 6 3 3 0 000-6zm-7 9h14m-14 0a2 2 0 00-2 2v2a2 2 0 002 2h4a2 2 0 002-2v-2a2 2 0 00-2-2H5zm10 0a2 2 0 00-2 2v2a2 2 0 002 2h4a2 2 0 002-2v-2a2 2 0 00-2-2h-4z" />
            </svg>
          ),
        },
        ...(isSuperAdmin
          ? [
              {
                tab: 'companies',
                label: 'Tenants/Companies',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                ),
              },
            ]
          : []),
        {
          tab: 'branches',
          label: 'Branches',
          permission: 'view_branches',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ),
        },
        {
          tab: 'departments',
          label: 'Departments',
          permission: 'view_departments',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          ),
        },
        {
          tab: 'designations',
          label: 'Designations',
          permission: 'view_designations',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          ),
        },
        {
          tab: 'roles',
          label: 'Roles & Access',
          permission: 'view_roles',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m-2 4a2 2 0 012-2m-2 4a2 2 0 11-4 0M9 9a2 2 0 00-2 2m2 4a2 2 0 00-2-2m2 4a2 2 0 11-4 0M9 12H5m0 0l-2-2m2 2l-2 2m14-2a6 6 0 11-12 0 6 6 0 0112 0z" />
            </svg>
          ),
        },
      ],
    },
    {
      title: 'Payroll Suite',
      items: [
        {
          tab: 'payroll',
          label: 'Payroll Hub',
          permission: 'view_salary_slabs',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        },
        {
          tab: 'payroll/generate',
          label: 'Generate Payroll',
          permission: 'view_salary_slabs',
          badge: 'Pro',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          ),
        },
        {
          tab: 'formula',
          label: 'Calculation Formulas',
          permission: 'view_salary_component_configurations',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          ),
        },
        {
          tab: 'structure',
          label: 'Salary Structure',
          permission: 'view_salary_slabs',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          ),
        },
        {
          tab: 'payslip',
          label: 'Payslip Console',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
        },
      ],
    },
    {
      title: 'Attendance Engine',
      items: [
        {
          tab: 'shifts',
          label: 'Shifts',
          permission: 'view_shift_masters',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        },
        {
          tab: 'attendance',
          label: 'Attendance',
          permission: 'view_attendance_summary',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          ),
        },
        {
          tab: 'holidays',
          label: 'Holidays Calendar',
          permission: 'view_holiday_masters',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
            </svg>
          ),
        },
        {
          tab: 'weekoffs',
          label: 'Week-off Policies',
          permission: 'view_weekoff_policies',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1.5M12 19.5V21M3 12h1.5m15 0H21m-1.5-6.364l-1.06 1.06m-11.88 0L5.436 5.636m12.728 12.728l-1.06-1.06M6.436 17.364l-1.06 1.06M16.5 12a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
            </svg>
          ),
        },
        {
          tab: 'leaves',
          label: 'Leave Control',
          permission: 'view_leave_requests',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          ),
        },
      ],
    },
    {
      title: 'Talent & Operations',
      items: [
        {
          tab: 'recruitment',
          label: 'Recruitment (ATS)',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          ),
        },
        {
          tab: 'configuration',
          label: 'Configuration',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ),
        },
        {
          tab: 'careers',
          label: 'Careers Portal',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          ),
        },
        {
          tab: 'interviews',
          label: 'Interviews Panel',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          ),
        },
        {
          tab: 'onboarding',
          label: 'Employee Onboarding',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          ),
        },
        {
          tab: 'performance',
          label: 'Performance OKRs',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          ),
        },
        {
          tab: 'lms',
          label: 'LMS Skill Training',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.246.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          ),
        },
        {
          tab: 'assets',
          label: 'Assets & Tickets',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
          ),
        },
        {
          tab: 'visitors',
          label: 'Visitor Pass',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          ),
        },
      ],
    },
    {
      title: 'Platform Suite',
      items: [
        {
          tab: 'billing',
          label: 'SaaS Plan & Flags',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          ),
        },
        {
          tab: 'companies',
          label: 'Tenants Manager',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          ),
        },
      ],
      superAdminOnly: true,
    },
    {
      title: 'Executive Insights',
      items: [
        {
          tab: 'kpi',
          label: 'KPI',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
            </svg>
          ),
        },
      ],
    },
  ];

  const flatItems = Array.from(
    new Map(
      sidebarGroups
        .filter((g) => !g.superAdminOnly || isSuperAdmin)
        .flatMap((g) => g.items)
        .filter((item) => hasPermission(item.permission))
        .map((item) => [item.tab, item])
    ).values()
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground transition-colors duration-200 font-sans">
      {/* 🖥️ LEFT SIDEBAR (Desktop) */}
      {layout === 'sidebar' && (
        <Sidebar
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
          companyName={companyName}
          companyLogo={companyLogo}
          logoError={logoError}
          setLogoError={setLogoError}
          sidebarSearch={sidebarSearch}
          setSidebarSearch={setSidebarSearch}
          sidebarGroups={sidebarGroups}
          isSuperAdmin={isSuperAdmin}
          hasPermission={hasPermission}
          currentTab={currentTab}
          pathname={pathname}
        />
      )}

      {/* 📱 MOBILE NAVIGATION DRAWER */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          <aside
            style={{ fontFamily: '"DM Sans", sans-serif' }}
            className="relative flex flex-col w-64 max-w-xs h-full bg-card border-r border-slate-200 dark:border-slate-800 p-4 shadow-xl z-50 animate-slideRight"
          >
            <div className="flex h-14 items-center justify-between border-b border-slate-100 dark:border-slate-800 mb-4 px-2">
              {companyLogo && !logoError ? (
                <div className="flex items-center h-full py-1">
                  <img
                    src={companyLogo}
                    alt={companyName}
                    className="max-h-9 max-w-[160px] object-contain"
                    onError={() => setLogoError(true)}
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden bg-gradient-to-tr from-blue-600 to-indigo-700 text-white font-black text-sm shadow-md flex-shrink-0">
                    {companyName.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-extrabold text-xs tracking-wider uppercase text-slate-800 dark:text-slate-100 truncate max-w-[130px]">
                    {companyName}
                  </span>
                </div>
              )}
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-2 pb-3 mb-2 flex-shrink-0 border-b border-slate-100 dark:border-slate-800">
              <div className="group relative flex items-center w-full h-[38px] rounded-xl bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-center justify-center pl-3.5 pr-2.5 text-slate-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search navigation..."
                  value={sidebarSearch}
                  onChange={(e) => setSidebarSearch(e.target.value)}
                  className="w-full h-full bg-transparent border-0 focus:ring-0 focus:outline-none text-xs placeholder-slate-400 text-slate-800 dark:text-slate-100 font-medium pr-8"
                />
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto no-scrollbar space-y-4" onClick={() => setMobileMenuOpen(false)}>
              {sidebarGroups.map((group, idx) => (
                <div key={idx} className="space-y-1">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider px-2 block">
                    {group.title}
                  </span>
                  {group.items.map((item) => (
                    <Link
                      key={item.tab}
                      href={`/dashboard/${item.tab}`}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 transition-colors"
                    >
                      <span>{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>
              ))}
            </nav>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mt-2">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border border-rose-200 dark:border-rose-950/20 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-xs font-extrabold cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* 🚀 MAIN CONTENT CONTAINER */}
      <div className="flex flex-1 flex-col h-full overflow-hidden">
        {/* TOP HEADER BAR */}
        <Header
          companyName={companyName}
          currentTime={currentTime}
          email={email}
          designation={designation}
          isSuperAdmin={isSuperAdmin}
          timeLeft={timeLeft}
          resetSessionTimer={resetSessionTimer}
          formatTime={formatTime}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
          setSettingsOpen={setSettingsOpen}
          setMoreAppsOpen={setMoreAppsOpen}
          handleLogout={handleLogout}
          theme={theme}
          setTheme={setTheme}
        />

        {/* 🚀 MAIN BODY AREA */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 relative no-scrollbar">
          {bodyLoading ? (
            <div className="w-full h-full flex flex-col gap-6 animate-fadeIn p-2">
              <div className="h-9 w-1/4 rounded-xl shimmer-loading" />
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="h-28 rounded-2xl shimmer-loading" />
                <div className="h-28 rounded-2xl shimmer-loading" />
                <div className="h-28 rounded-2xl shimmer-loading" />
                <div className="h-28 rounded-2xl shimmer-loading" />
              </div>
              <div className="h-80 rounded-2xl shimmer-loading" />
            </div>
          ) : (
            <div className={`${layout === 'bottom-dock' ? 'pb-24' : ''}`}>
              {children}
            </div>
          )}
        </main>
      </div>

      {/* ⚓ FLOATING BOTTOM DOCK NAVIGATION (If enabled in settings) */}
      {layout === 'bottom-dock' && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 select-none touch-none"
          style={{ transform: `translate(calc(-50% + ${fabPos.x}px), ${fabPos.y}px)` }}
        >
          <button
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onClick={handleFabClick}
            className="flex items-center gap-2.5 px-6 py-3 rounded-full border border-slate-200/80 dark:border-slate-800/80 bg-card/90 shadow-2xl backdrop-blur-xl hover:scale-105 active:scale-95 hover:border-blue-500/50 dark:hover:border-blue-500/50 transition-all duration-250 cursor-grab active:cursor-grabbing group text-slate-800 dark:text-slate-200"
          >
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
            </svg>
            <span className="text-[10px] uppercase tracking-widest font-black">App Launcher</span>
          </button>
        </div>
      )}

      {/* 🎛️ MORE APPS POP-UP DRAWER */}
      {moreAppsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs" onClick={() => setMoreAppsOpen(false)} />
          <div className="relative w-full max-w-2xl bg-card rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-2xl z-50 animate-scaleUp max-h-[70vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800/60 pb-4 mb-5 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md shadow-blue-500/20 flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                  </svg>
                </div>
                <div className="flex flex-col text-left">
                  <h3 className="text-base font-black tracking-tight text-slate-800 dark:text-slate-100">
                    Enterprise Module Launcher
                  </h3>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-0.5 tracking-wider uppercase">
                    All platform modules & tools
                  </span>
                </div>
              </div>
              <button
                onClick={() => setMoreAppsOpen(false)}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-5 relative flex-shrink-0">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Search modules & tools..."
                value={appSearch}
                onChange={(e) => setAppSearch(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-xs outline-none focus:border-blue-500 focus:bg-card focus:ring-4 focus:ring-blue-500/10 transition-all placeholder-slate-400 text-slate-800 dark:text-slate-100 font-semibold"
              />
              {appSearch && (
                <button
                  onClick={() => setAppSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-1 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar pr-1 min-h-0">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pb-4">
                {flatItems
                  .filter(
                    (item) =>
                      item.label.toLowerCase().includes(appSearch.toLowerCase()) ||
                      item.tab.toLowerCase().includes(appSearch.toLowerCase())
                  )
                  .map((item: SidebarItem) => (
                    <Link
                      key={item.tab}
                      href={`/dashboard/${item.tab}`}
                      onClick={() => setMoreAppsOpen(false)}
                      className={`group flex flex-col items-center text-center p-4 rounded-2xl border transition-all duration-200 cursor-pointer ${
                        currentTab === item.tab
                          ? 'bg-blue-500/10 border-blue-500/40 shadow-md ring-1 ring-blue-500/20'
                          : 'border-slate-200/70 dark:border-slate-800/60 bg-card hover:border-blue-300 dark:hover:border-blue-900/60 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 hover:shadow-lg'
                      }`}
                    >
                      <div
                        className={`flex items-center justify-center h-11 w-11 rounded-2xl mb-3 text-2xl transition-transform duration-200 group-hover:scale-110 ${
                          currentTab === item.tab
                            ? 'bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                            : 'bg-slate-100/80 dark:bg-slate-800/60 text-slate-500 group-hover:bg-blue-50 dark:group-hover:bg-blue-950/30 group-hover:text-blue-600'
                        }`}
                      >
                        {item.icon}
                      </div>
                      <span
                        className={`text-xs font-bold tracking-wide leading-tight ${
                          currentTab === item.tab
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-slate-700 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                        }`}
                      >
                        {item.label}
                      </span>
                    </Link>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🎨 PERSONALIZATION SETTINGS DRAWER */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs" onClick={() => setSettingsOpen(false)} />
          <aside className="relative w-80 h-full bg-card border-l border-slate-200 dark:border-slate-800 p-6 shadow-2xl z-50 flex flex-col justify-between animate-slideIn select-none overflow-hidden font-sans">
            <div className="flex-1 overflow-y-auto pr-1 no-scrollbar space-y-6">
              <div>
                <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800 pb-4 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-md text-white">
                      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-2.22 1.124l-3.147 3.146a.5.5 0 01-.708-.708l3.146-3.147a3 3 0 001.124-2.22V11.75a3.75 3.75 0 117.5 0v1.894a3 3 0 001.124 2.22l3.147 3.146a.5.5 0 01-.708.708l-3.147-3.146a3 3 0 00-2.22-1.124H9.53z" />
                      </svg>
                    </div>
                    <div className="flex flex-col text-left">
                      <h3 className="text-sm font-black tracking-tight text-slate-800 dark:text-slate-100">
                        Personalize UI
                      </h3>
                      <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold tracking-wider uppercase">
                        Aesthetics Console
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSettingsOpen(false)}
                    className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Navigation Style */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        Navigation Mode
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setLayout('sidebar')}
                        className={`py-2.5 px-3.5 rounded-xl border text-xs font-extrabold transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                          layout === 'sidebar'
                            ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20'
                            : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500'
                        }`}
                      >
                        <span className="text-base">🗂️</span>
                        <span>Sidebar</span>
                      </button>
                      <button
                        onClick={() => setLayout('bottom-dock')}
                        className={`py-2.5 px-3.5 rounded-xl border text-xs font-extrabold transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                          layout === 'bottom-dock'
                            ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20'
                            : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500'
                        }`}
                      >
                        <span className="text-base">⚓</span>
                        <span>Bottom Dock</span>
                      </button>
                    </div>
                  </div>

                  {/* Color Palette */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        Theme Mode
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setTheme('slate-dark')}
                        className={`relative flex flex-col items-center justify-center p-3 rounded-xl border transition-all cursor-pointer ${
                          theme === 'slate-dark'
                            ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/20'
                            : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="h-5 w-10 rounded bg-[#0b0f19] mb-2 border border-slate-700 shadow-xs" />
                        <span className="text-[10px] font-black text-slate-700 dark:text-slate-300">Slate Dark</span>
                        {theme === 'slate-dark' && (
                          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[8px] font-black">✓</span>
                        )}
                      </button>

                      <button
                        onClick={() => setTheme('nordic-light')}
                        className={`relative flex flex-col items-center justify-center p-3 rounded-xl border transition-all cursor-pointer ${
                          theme === 'nordic-light'
                            ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/20'
                            : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="h-5 w-10 rounded bg-[#f8fafc] mb-2 border border-slate-300 shadow-xs" />
                        <span className="text-[10px] font-black text-slate-700 dark:text-slate-300">Nordic Light</span>
                        {theme === 'nordic-light' && (
                          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[8px] font-black">✓</span>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Typography Font */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        Typography Font
                      </label>
                    </div>
                    <div className="space-y-1.5">
                      {(['Inter', 'Outfit', 'Space Grotesk', 'Playfair Display', 'DM Sans'] as const).map((f) => (
                        <button
                          key={f}
                          onClick={() => setFont(f)}
                          className={`w-full py-2.5 px-3.5 rounded-xl border text-left text-xs font-extrabold transition-all cursor-pointer flex justify-between items-center ${
                            font === f
                              ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20'
                              : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          <span style={{ fontFamily: f }}>{f}</span>
                          {font === f && (
                            <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200/50 dark:border-slate-800 pt-4 mt-4 flex-shrink-0 bg-card">
              <button
                onClick={() => {
                  setLayout('sidebar');
                  setTheme('slate-dark');
                  setFont('DM Sans');
                  setSettingsOpen(false);
                }}
                className="w-full py-2.5 px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-xs font-extrabold hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:text-rose-600 transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Reset Default Styles</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* 🥞 ANIMATED TOASTS STACK PANEL */}
      <div className="fixed right-6 bottom-6 z-[99] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none font-sans">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto animate-toast">
            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-slate-900/95 text-slate-100 border border-slate-700/70 shadow-2xl backdrop-blur-2xl">
              <div className="flex items-center gap-3">
                <span
                  className={`flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-xl border ${
                    toast.type === 'error'
                      ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                      : toast.type === 'info'
                      ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                      : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  }`}
                >
                  {toast.type === 'error' ? '✕' : toast.type === 'info' ? 'ℹ' : '✓'}
                </span>
                <div>
                  <p className="text-xs font-bold leading-snug text-slate-100">{toast.message}</p>
                  <span
                    className={`text-[9.5px] font-extrabold uppercase tracking-wider block mt-0.5 ${
                      toast.type === 'error'
                        ? 'text-rose-400'
                        : toast.type === 'info'
                        ? 'text-blue-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {toast.type}
                  </span>
                </div>
              </div>
              <button
                onClick={() => dismissToast(toast.id)}
                className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-400 hover:text-white transition-colors cursor-pointer border border-slate-700/50"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>


    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </DashboardProvider>
  );
}
