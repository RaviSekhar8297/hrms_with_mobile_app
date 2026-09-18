'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  User,
  Zap,
  BarChart3,
  Users,
  Sparkles,
  GitMerge,
  Building2,
  GitBranch,
  Layers,
  Award,
  ShieldCheck,
  CreditCard,
  Calculator,
  Percent,
  Clock,
  FileSpreadsheet,
  Palmtree,
  Briefcase,
  Search,
  X,
  MapPin
} from 'lucide-react';
import { DashboardProvider, useDashboard, FontType } from './components/DashboardContext';
import { Header } from './components/Header';
import LiveLocationTracker from './components/LiveLocationTracker';
import { Sidebar, SidebarGroup, SidebarItem } from './components/Sidebar';
import { FloatingAiWidget } from './components/FloatingAiWidget';
const getLucideIcon = (tab: string, fallback: React.ReactNode) => {
  switch (tab) {
    case 'overview': return <LayoutDashboard className="w-5 h-5" />;
    case 'profile': return <User className="w-5 h-5" />;
    case 'flow': return <Zap className="w-5 h-5 text-indigo-500" />;
    case 'analytics': return <BarChart3 className="w-5 h-5 text-blue-500" />;
    case 'employees': return <Users className="w-5 h-5 text-amber-500" />;
    case 'ai-assistant': return <Sparkles className="w-5 h-5 text-purple-500 animate-pulse" />;
    case 'org_flow': return <GitMerge className="w-5 h-5 text-purple-500" />;
    case 'companies': return <Building2 className="w-5 h-5 text-cyan-500" />;
    case 'branches': return <GitBranch className="w-5 h-5 text-emerald-500" />;
    case 'departments': return <Layers className="w-5 h-5 text-indigo-500" />;
    case 'designations': return <Award className="w-5 h-5 text-amber-500" />;
    case 'roles': return <ShieldCheck className="w-5 h-5 text-violet-500" />;
    case 'payroll': return <CreditCard className="w-5 h-5 text-emerald-500" />;
    case 'payroll/generate': return <Calculator className="w-5 h-5 text-indigo-500" />;
    case 'payroll/tds': return <Percent className="w-5 h-5 text-sky-500" />;
    case 'structure': return <FileSpreadsheet className="w-5 h-5 text-teal-500" />;
    case 'attendance': return <Clock className="w-5 h-5 text-blue-500" />;
    case 'leaves': return <Palmtree className="w-5 h-5 text-green-500" />;
    case 'performance': return <Award className="w-5 h-5 text-rose-500" />;
    case 'recruitment': return <Briefcase className="w-5 h-5 text-pink-500" />;
    case 'attendance/live-tracking': return <MapPin className="w-5 h-5 text-rose-500" />;
    default: return fallback;
  }
};

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
    companyId,
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

  // Dynamic Company Branding sync when companyId changes
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    const currentCompanyId = companyId || localStorage.getItem('companyId');
    fetch(`/api/v1/companies`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const companies: Array<{ id: string; name: string; branding_logo: string }> =
          data.companies || [];
        const match = companies.find((c) => c.id === currentCompanyId) || companies[0];
        if (match) {
          setCompanyLogo(match.branding_logo || '');
          setCompanyName(match.name || 'HRMS PORTAL');
        }
      })
      .catch(() => { });
  }, [companyId]);

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

  // Draggable bottom pill & App Launcher state
  const [launcherMode, setLauncherMode] = useState<'orbital' | 'grid'>('orbital');
  const [hoveredApp, setHoveredApp] = useState<SidebarItem | null>(null);
  const [animTime, setAnimTime] = useState(0);

  useEffect(() => {
    if (!moreAppsOpen || launcherMode !== 'orbital') return;
    let animId: number;
    let startTimestamp: number;

    const animate = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = (timestamp - startTimestamp) / 1000;
      setAnimTime(elapsed);
      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [moreAppsOpen, launcherMode]);

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

    // Verify tab/browser session state. If browser was closed, sessionStorage is wiped automatically.
    const isSessionActive = sessionStorage.getItem('session_active');
    if (!token || !isSessionActive) {
      handleLogout();
      return;
    } else {
      setAuthorized(true);
      setEmail(storedEmail || 'user@hrms.com');
      if (storedRoles) {
        setRoles(JSON.parse(storedRoles));
      }
      if (storedPermissions) {
        setPermissions(JSON.parse(storedPermissions));
      }

      // Auto-refetch live permissions from server to keep sidebar 100% synced with System Permission Matrix
      fetch('/api/v1/auth/user-permissions', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.permissions && Array.isArray(data.permissions)) {
            setPermissions(data.permissions);
            localStorage.setItem('permissions', JSON.stringify(data.permissions));
          }
          if (data.scopes && typeof data.scopes === 'object') {
            localStorage.setItem('permissionScopes', JSON.stringify(data.scopes));
          }
        })
        .catch(() => { });

      // Load company branding
      const storedCompanyId = localStorage.getItem('companyId');
      fetch(`/api/v1/companies`, {
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
        .catch(() => { });

      // Fetch employee designation details
      fetch(`/api/v1/employees`, {
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
        .catch(() => { });
    }
  }, [router, pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      if (response.status === 401) {
        handleLogout();
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
    localStorage.removeItem('permissionScopes');
    localStorage.removeItem('companyId');
    localStorage.removeItem('designation');
    sessionStorage.clear();
    if (typeof window !== 'undefined') {
      window.location.href = '/login?clear=true';
    }
  };

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f6f9] dark:bg-[#090d16] text-slate-800 dark:text-slate-100 font-sans transition-colors duration-200">
        <div className="flex flex-col items-center gap-5">
          <div className="relative flex h-12 w-12 items-center justify-center">
            <div className="absolute inset-0 rounded-2xl bg-brand-600/10" />
            <div className="h-6 w-6 animate-spin rounded-full border-[2.5px] border-brand-600 border-t-transparent" />
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-[13px] font-medium tracking-tight">Verifying session security...</p>
        </div>
      </div>
    );
  }

  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('superadmin');

  // Helper to check dynamic role-based permissions strictly
  const hasPermission = (permissionName?: string) => {
    if (!permissionName) return true;
    if (isSuperAdmin) return true;
    if (permissions.includes(permissionName) || permissions.includes('*')) return true;
    if (permissionName === 'view_payroll_runs' && permissions.includes('view_payroll')) return true;
    if (permissionName === 'view_payroll' && permissions.includes('view_payroll_runs')) return true;
    return false;
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
            tab: 'flow',
            label: 'Work Flow',
            badge: 'Guide',
            icon: (
              <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
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
          {
            tab: 'ai-assistant',
            label: 'AI Assistant',
            badge: 'Free AI',
            icon: (
              <svg className="w-5 h-5 text-purple-400 animate-pulse" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
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
            tab: 'flow',
            label: 'Work Flow',
            badge: 'Guide',
            icon: (
              <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
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
          {
            tab: 'ai-assistant',
            label: 'AI Assistant',
            badge: 'Free AI',
            icon: (
              <svg className="w-5 h-5 text-purple-400 animate-pulse" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
              </svg>
            ),
          },
        ],
    },

    {
      title: 'Organization',
      items: [
        {
          tab: 'org_flow',
          label: 'Organization Flow',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          ),
        },
        ...(isSuperAdmin
          ? [
            {
              tab: 'companies',
              label: 'Companies (Tenants)',
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
          permission: 'view_payroll_runs',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        },
        {
          tab: 'payroll/generate',
          label: 'Generate Payroll',
          permission: 'view_payroll_runs',
          badge: 'Pro',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          ),
        },
        {
          tab: 'formula',
          label: 'Formulas',
          permission: 'view_salary_component_configurations',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          ),
        },
        {
          tab: 'structure',
          label: 'Structure',
          permission: 'view_salary_structures',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          ),
        },
        {
          tab: 'payroll/tds',
          label: 'TDS Tax',
          permission: 'view_payroll_runs',
          badge: 'Tax',
          icon: (
            <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          ),
        },
        {
          tab: 'payslip',
          label: 'Payslips',
          permission: 'view_payslips',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
        },
      ],
    },
    {
      title: 'Time & Attendance',
      items: [
        {
          tab: 'attendance',
          label: 'Attendance',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          ),
        },
        {
          tab: 'atd_history',
          label: 'History',
          permission: 'view_attendance_summary',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        },
        {
          tab: 'attendance/live-tracking',
          label: 'Tracking',
          permission: 'view_attendance_summary',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ),
        },
        {
          tab: 'attendance/rules',
          label: 'Policy',
          permission: 'view_attendance_policies',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ),
        },
        {
          tab: 'attendance/locks',
          label: 'Locks',
          permission: 'view_attendance_locks',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          ),
        },
        {
          tab: 'attendance/regularization',
          label: 'Regularization',
          permission: 'view_attendance_regularizations',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          ),
        },
        {
          tab: 'attendance/permissions',
          label: 'Permissions',
          permission: 'view_permission_requests',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        },
        {
          tab: 'leaves/compoff',
          label: 'Comp-Offs',
          permission: 'view_comp_off_requests',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        },
        {
          tab: 'attendance/raw-punches',
          label: 'Logs',
          permission: 'view_attendance_raw_punches',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          ),
        },
        {
          tab: 'attendance_summary',
          label: 'Summary',
          permission: 'view_attendance_summary',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
        },
        {
          tab: 'attendance/device-binding',
          label: 'Device Binding',
          permission: 'view_employee_devices',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          ),
        },
      ],
    },
    {
      title: 'Enjoyable Days',
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
          tab: 'holidays',
          label: 'Holidays',
          permission: 'view_holiday_masters',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
            </svg>
          ),
        },
        {
          tab: 'weekoffs',
          label: 'Week-offs',
          permission: 'view_weekoff_policies',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1.5M12 19.5V21M3 12h1.5m15 0H21m-1.5-6.364l-1.06 1.06m-11.88 0L5.436 5.636m12.728 12.728l-1.06-1.06M6.436 17.364l-1.06 1.06M16.5 12a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
            </svg>
          ),
        },
      ],
    },
    {
      title: 'Leave Track',
      items: [
        {
          tab: 'leaves/requests',
          label: 'Leave Requests',
          permission: 'view_leave_requests',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          ),
        },

        {
          tab: 'leaves/balances',
          label: 'Leave Balances',
          permission: 'view_leave_balances',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          ),
        },
        {
          tab: 'leaves',
          label: 'Leave Types',
          permission: 'view_leave_types',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ),
        },
      ],
    },
    {
      title: 'Onboarding',
      items: [
        {
          tab: 'recruitment',
          label: 'Recruitment (ATS)',
          permission: 'view_job_postings',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
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
          tab: 'onboarding',
          label: 'Pre Joining',
          permission: 'view_employee_onboardings',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          ),
        },
        {
          tab: 'onboarding/letters',
          label: 'Letters',
          badge: 'New',
          icon: (
            <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
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
      title: 'Settings',
      items: [
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
          tab: 'smart-hr',
          label: 'SMART HR',
          badge: 'NEW',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
            </svg>
          ),
        },
      ],
    },
    {
      title: 'Work-Bridge',
      items: [
        {
          tab: 'workbridge/projects',
          label: 'Projects Directory',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          ),
        },
        {
          tab: 'workbridge/workflows',
          label: 'Workflow',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          ),
        },
        {
          tab: 'workbridge/tasks',
          label: 'Task Board',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          ),
        },
        {
          tab: 'workbridge/timesheets',
          label: 'Timesheet',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        },
        {
          tab: 'workbridge/labels',
          label: 'Labels & Tags',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
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

  const isCompanyAdmin = isSuperAdmin || roles.some((r) => r.toLowerCase().includes('admin'));

  const flatItems = Array.from(
    new Map(
      sidebarGroups
        .filter((g) => !g.superAdminOnly || isSuperAdmin)
        .flatMap((g) => g.items)
        .filter((item) => {
          if (item.tab === 'roles') {
            return isCompanyAdmin && hasPermission(item.permission);
          }
          return hasPermission(item.permission);
        })
        .map((item) => [item.tab, item])
    ).values()
  );

  return (
    <div className="bg-background flex h-screen w-screen overflow-hidden text-foreground transition-colors duration-200 font-sans p-3 md:p-4 gap-3 md:gap-4">

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
            className="fixed inset-0 bg-slate-950/55 backdrop-blur-[2px] transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          <aside
            style={{ fontFamily: '"Inter", sans-serif' }}
            className="relative flex flex-col w-72 max-w-[85vw] h-full bg-card border-r border-[#e4e7ec] dark:border-white/[0.07] p-4 shadow-2xl z-50 animate-slideRight"
          >
            <div className="flex h-14 items-center justify-between border-b border-[#eef0f4] dark:border-white/[0.06] mb-4 px-1">
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
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl overflow-hidden bg-brand-600 text-white font-bold text-sm shadow-sm flex-shrink-0">
                    {companyName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="font-bold text-[13px] tracking-tight text-slate-800 dark:text-slate-100 truncate max-w-[140px]">
                      {companyName}
                    </span>
                    <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                      Enterprise HRMS
                    </span>
                  </div>
                </div>
              )}
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-xl border border-[#e4e7ec] dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.04] text-slate-400 dark:text-slate-500 cursor-pointer transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div
              className="flex-1 overflow-y-auto no-scrollbar"
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('a')) {
                  setMobileMenuOpen(false);
                }
              }}
            >
              <Sidebar
                isMobile={true}
                sidebarCollapsed={false}
                setSidebarCollapsed={() => { }}
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
            </div>

            <div className="border-t border-[#eef0f4] dark:border-white/[0.06] pt-4 mt-2">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border border-rose-200/80 dark:border-rose-500/20 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-semibold transition-colors cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* 🚀 MAIN CONTENT CONTAINER */}
      <div className="flex flex-1 flex-col h-full overflow-hidden gap-3 md:gap-4 min-w-0">
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
        <main className="flex-1 overflow-y-auto p-4 md:p-6 relative no-scrollbar rounded-2xl border border-[#e4e7ec] dark:border-white/[0.07] bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04),0_4px_12px_-2px_rgba(16,24,40,0.05)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.24),0_10px_28px_-8px_rgba(0,0,0,0.4)]">
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
              <LiveLocationTracker />
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
            className="group relative flex items-center justify-center gap-2.5 px-4 py-2.5 sm:px-5 sm:py-3 rounded-full border border-white/10 bg-slate-900/95 text-white shadow-[0_10px_34px_-8px_rgba(15,23,42,0.55)] backdrop-blur-xl hover:bg-slate-800 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-200 cursor-grab active:cursor-grabbing"
          >
            <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-white/10 text-white group-hover:bg-brand-600 transition-colors duration-200">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="2" />
                <rect x="14" y="3" width="7" height="7" rx="2" />
                <rect x="14" y="14" width="7" height="7" rx="2" />
                <rect x="3" y="14" width="7" height="7" rx="2" />
              </svg>
            </span>
            <span className="hidden sm:inline text-[11px] font-semibold tracking-wide uppercase text-white/90 group-hover:text-white transition-colors">App Launcher</span>
            <span className="sm:hidden text-xs font-semibold tracking-wide uppercase text-white">Apps</span>
          </button>
        </div>
      )}

      {/* 🎛️ MORE APPS POP-UP (Light-Themed Launcher with Live Search) */}
      {moreAppsOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center pb-2 sm:pb-3 pointer-events-none">
          {/* Soft dim backdrop */}
          <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-[2px] pointer-events-auto transition-opacity duration-300" onClick={() => setMoreAppsOpen(false)} />

          {/* Launcher Modal Container */}
          <div
            className="relative z-50 w-[95vw] max-w-[820px] sm:w-[800px] bg-card text-slate-900 dark:text-slate-100 rounded-3xl border border-[#e4e7ec] dark:border-white/[0.08] shadow-[0_24px_80px_-12px_rgba(15,23,42,0.32)] animate-scaleUp flex flex-col overflow-hidden pointer-events-auto font-sans select-none mb-1"
            style={{
              maxHeight: '88vh'
            }}
          >
            {/* Popover Header with Search & View Switcher */}
            <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 border-b border-[#eef0f4] dark:border-white/[0.06] px-5 sm:px-6 py-4 flex-shrink-0 bg-[#fafbfc] dark:bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 shadow-sm text-white flex-shrink-0">
                  <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="2" />
                    <rect x="14" y="3" width="7" height="7" rx="2" />
                    <rect x="14" y="14" width="7" height="7" rx="2" />
                    <rect x="3" y="14" width="7" height="7" rx="2" />
                  </svg>
                </div>
                <div className="flex flex-col text-left">
                  <h3 className="text-sm sm:text-[15px] font-bold tracking-tight text-slate-900 dark:text-slate-100 font-sans">
                    App Directory
                  </h3>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium tracking-wide uppercase">
                    All modules at a glance
                  </span>
                </div>
              </div>

              {/* Real-time Integrated Search Input Bar */}
              <div className="relative flex-1 max-w-[280px] order-3 sm:order-none w-full sm:w-auto">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search modules..."
                  value={appSearch}
                  onChange={(e) => setAppSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 rounded-xl border border-[#e4e7ec] dark:border-white/[0.08] bg-card text-xs font-medium outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/12 text-slate-800 dark:text-slate-100 placeholder-slate-400 transition-all"
                />
                {appSearch && (
                  <button
                    onClick={() => setAppSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs p-1 cursor-pointer font-semibold"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* View Mode Toggle & Close Button */}
              <div className="flex items-center gap-2">
                <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-white/[0.05] border border-[#e4e7ec] dark:border-white/[0.06] text-[11px] font-semibold">
                  <button
                    onClick={() => setLauncherMode('orbital')}
                    className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${launcherMode === 'orbital'
                        ? 'bg-card text-slate-900 dark:text-white shadow-sm font-semibold'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                  >
                    <span>Orbital</span>
                  </button>
                  <button
                    onClick={() => setLauncherMode('grid')}
                    className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${launcherMode === 'grid'
                        ? 'bg-card text-slate-900 dark:text-white shadow-sm font-semibold'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                  >
                    <span>Grid</span>
                  </button>
                </div>

                <button
                  onClick={() => setMoreAppsOpen(false)}
                  className="w-8 h-8 rounded-xl border border-[#e4e7ec] dark:border-white/[0.08] bg-card text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] flex items-center justify-center transition-all cursor-pointer font-semibold"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Content Area */}
            {launcherMode === 'orbital' ? (
              <div className="relative w-full h-[400px] sm:h-[440px] flex items-center justify-center overflow-hidden bg-[#fafbfc] dark:bg-white/[0.015]">
                {/* SVG Concentric Arc Rings with Large Non-Overlapping Gaps */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 750 400" preserveAspectRatio="xMidYMid meet">
                  {/* Outer Ring 3 - R = 310 */}
                  <path d="M 65 360 A 310 310 0 0 1 685 360" stroke="rgba(148, 163, 184, 0.3)" strokeDasharray="5 7" fill="none" strokeWidth="1.4" />
                  {/* Middle Ring 2 - R = 215 */}
                  <path d="M 160 360 A 215 215 0 0 1 590 360" stroke="rgba(148, 163, 184, 0.26)" fill="none" strokeWidth="1.4" />
                  {/* Inner Ring 1 - R = 125 */}
                  <path d="M 250 360 A 125 125 0 0 1 500 360" stroke="rgba(148, 163, 184, 0.22)" strokeDasharray="4 6" fill="none" strokeWidth="1.4" />
                </svg>

                {/* Central Bottom Hub Anchor */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
                  <div className="w-14 h-14 rounded-2xl bg-brand-600 border border-white/25 shadow-[0_10px_30px_-8px_rgba(79,70,229,0.55)] flex items-center justify-center text-white">
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400 mt-2">HRMS Core</span>
                </div>

                {/* Orbiting App Badges / Nodes with Harmonic Smooth Arc Motion (Zero Scrambling/Stacking) */}
                <div className="absolute inset-0">
                  {flatItems.slice(0, 15).map((item: SidebarItem, idx: number) => {
                    let ringRadius = 120;
                    let angle = 90;

                    // Harmonic Pendulum Sine Oscillation: Each item moves back & forth gracefully along its EXACT arc line without ever jumping or stacking!
                    if (idx < 4) {
                      ringRadius = 120;
                      const homeAngles = [155, 115, 65, 25];
                      const home = homeAngles[idx] || 90;
                      angle = home + 14 * Math.sin(animTime * 0.8 + idx * 0.7);
                    } else if (idx < 9) {
                      ringRadius = 205;
                      const homeAngles = [162, 126, 90, 54, 18];
                      const home = homeAngles[idx - 4] || 90;
                      angle = home - 16 * Math.sin(animTime * 0.6 + idx * 0.6);
                    } else {
                      ringRadius = 290;
                      const homeAngles = [168, 137, 106, 74, 43, 12];
                      const home = homeAngles[idx - 9] || 90;
                      angle = home + 18 * Math.sin(animTime * 0.5 + idx * 0.5);
                    }

                    const rad = (angle * Math.PI) / 180;
                    const leftPct = 50 + (ringRadius / 375) * 50 * Math.cos(rad);
                    const topPct = 90 - (ringRadius / 390) * 100 * Math.sin(rad);

                    const isMatched = !appSearch ||
                      item.label.toLowerCase().includes(appSearch.toLowerCase()) ||
                      item.tab.toLowerCase().includes(appSearch.toLowerCase());

                    return (
                      <div
                        key={item.tab}
                        style={{
                          left: `${leftPct}%`,
                          top: `${topPct}%`,
                          transform: 'translate(-50%, -50%)'
                        }}
                        className={`absolute transition-all duration-300 ${isMatched ? 'opacity-100 z-30' : 'opacity-20 scale-90 blur-[0.5px] z-10 pointer-events-none'
                          } group`}
                      >
                        <Link
                          href={`/dashboard/${item.tab}`}
                          onClick={() => setMoreAppsOpen(false)}
                          className="relative flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-card border border-[#e4e7ec] dark:border-white/[0.1] shadow-[0_2px_8px_-2px_rgba(16,24,40,0.12)] transition-all duration-300 group-hover:scale-110 group-hover:border-brand-400 group-hover:shadow-[0_10px_24px_-6px_rgba(79,70,229,0.35)] group-hover:z-50 cursor-pointer text-slate-600 dark:text-slate-300"
                        >
                          <div className="flex items-center justify-center">
                            {getLucideIcon(item.tab, item.icon)}
                          </div>

                          {/* Hover Tooltip Badge (Single cleanly positioned tooltip) */}
                          <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-50 whitespace-nowrap bg-slate-900 text-white font-semibold text-[11px] px-3 py-1.5 rounded-lg shadow-xl">
                            {item.label}
                          </div>
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Grid Launcher Mode */
              <div className="p-6 flex-1 overflow-y-auto no-scrollbar space-y-4">
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {flatItems
                    .filter((item) =>
                      item.label.toLowerCase().includes(appSearch.toLowerCase()) ||
                      item.tab.toLowerCase().includes(appSearch.toLowerCase())
                    )
                    .map((item: SidebarItem) => (
                      <Link
                        key={item.tab}
                        href={`/dashboard/${item.tab}`}
                        onClick={() => setMoreAppsOpen(false)}
                        className={`group flex flex-col items-center text-center p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer ${currentTab === item.tab
                            ? 'bg-brand-50 dark:bg-brand-500/10 border-brand-300 dark:border-brand-500/30 text-brand-700 dark:text-brand-300 shadow-[0_4px_14px_-4px_rgba(79,70,229,0.28)]'
                            : 'border-[#e4e7ec] dark:border-white/[0.07] bg-[#fafbfc] dark:bg-white/[0.02] hover:border-brand-300 dark:hover:border-brand-500/30 hover:bg-card dark:hover:bg-white/[0.04] text-slate-800 dark:text-slate-200'
                          }`}
                      >
                        <div className="w-10 h-10 rounded-xl bg-card dark:bg-white/[0.04] border border-[#e4e7ec] dark:border-white/[0.08] text-slate-600 dark:text-slate-300 flex items-center justify-center text-xl mb-2 group-hover:scale-105 group-hover:border-brand-300 group-hover:text-brand-600 transition-all shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                          {getLucideIcon(item.tab, item.icon)}
                        </div>
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 group-hover:text-brand-700 dark:group-hover:text-brand-300 line-clamp-2">
                          {item.label}
                        </span>
                      </Link>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 🎨 PERSONALIZATION SETTINGS DRAWER */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-slate-950/55 backdrop-blur-[2px]" onClick={() => setSettingsOpen(false)} />
          <aside className="relative w-80 h-full bg-card border-l border-[#e4e7ec] dark:border-white/[0.07] p-6 shadow-2xl z-50 flex flex-col justify-between animate-slideIn select-none overflow-hidden font-sans">
            <div className="flex-1 overflow-y-auto pr-1 no-scrollbar space-y-6">
              <div>
                <div className="flex items-center justify-between border-b border-[#eef0f4] dark:border-white/[0.06] pb-4 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 shadow-sm text-white">
                      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-2.22 1.124l-3.147 3.146a.5.5 0 01-.708-.708l3.146-3.147a3 3 0 001.124-2.22V11.75a3.75 3.75 0 117.5 0v1.894a3 3 0 001.124 2.22l3.147 3.146a.5.5 0 01-.708.708l-3.147-3.146a3 3 0 00-2.22-1.124H9.53z" />
                      </svg>
                    </div>
                    <div className="flex flex-col text-left">
                      <h3 className="text-sm font-bold tracking-tight text-slate-800 dark:text-slate-100">
                        Personalize UI
                      </h3>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium tracking-wide uppercase">
                        Aesthetics Console
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSettingsOpen(false)}
                    className="p-2 rounded-xl border border-[#e4e7ec] dark:border-white/[0.08] hover:bg-slate-100 dark:hover:bg-white/[0.05] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Navigation Style */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                      <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        Navigation Mode
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          setLayout('sidebar');
                          setSettingsOpen(false);
                        }}
                        className={`py-2.5 px-3.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer flex flex-col items-center gap-1.5 ${layout === 'sidebar'
                            ? 'border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400 ring-1 ring-brand-500/20'
                            : 'border-[#e4e7ec] dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.04] text-slate-500 dark:text-slate-400'
                          }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <rect x="3" y="4" width="18" height="16" rx="3" />
                          <path d="M9 4v16" />
                        </svg>
                        <span>Sidebar</span>
                      </button>
                      <button
                        onClick={() => {
                          setLayout('bottom-dock');
                          setSettingsOpen(false);
                        }}
                        className={`py-2.5 px-3.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer flex flex-col items-center gap-1.5 ${layout === 'bottom-dock'
                            ? 'border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400 ring-1 ring-brand-500/20'
                            : 'border-[#e4e7ec] dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.04] text-slate-500 dark:text-slate-400'
                          }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <rect x="3" y="4" width="18" height="16" rx="3" />
                          <path d="M8 16h8" />
                        </svg>
                        <span>Bottom Dock</span>
                      </button>
                    </div>
                  </div>

                  {/* Color Palette */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                      <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        Theme Mode
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          setTheme('slate-dark');
                          setSettingsOpen(false);
                        }}
                        className={`relative flex flex-col items-center justify-center p-3 rounded-xl border transition-all cursor-pointer ${theme === 'slate-dark'
                            ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500/20'
                            : 'border-[#e4e7ec] dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.04]'
                          }`}
                      >
                        <div className="h-5 w-10 rounded-md bg-[#0b0f19] mb-2 border border-slate-700 shadow-sm" />
                        <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">Slate Dark</span>
                        {theme === 'slate-dark' && (
                          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 text-white text-[8px] font-bold">✓</span>
                        )}
                      </button>

                      <button
                        onClick={() => {
                          setTheme('nordic-light');
                          setSettingsOpen(false);
                        }}
                        className={`relative flex flex-col items-center justify-center p-3 rounded-xl border transition-all cursor-pointer ${theme === 'nordic-light'
                            ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500/20'
                            : 'border-[#e4e7ec] dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.04]'
                          }`}
                      >
                        <div className="h-5 w-10 rounded-md bg-[#f8fafc] mb-2 border border-slate-300 shadow-sm" />
                        <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">Nordic Light</span>
                        {theme === 'nordic-light' && (
                          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 text-white text-[8px] font-bold">✓</span>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Typography Font */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                      <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        Typography Font
                      </label>
                    </div>
                    <div className="space-y-1.5">
                      {(['Poppins', 'Inter', 'Outfit', 'Space Grotesk', 'Playfair Display', 'DM Sans'] as const).map((f) => (
                        <button
                          key={f}
                          onClick={() => {
                            setFont(f);
                            setSettingsOpen(false);
                          }}
                          className={`w-full py-2.5 px-3.5 rounded-xl border text-left text-xs font-semibold transition-all cursor-pointer flex justify-between items-center ${font === f
                              ? 'border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400 ring-1 ring-brand-500/20'
                              : 'border-[#e4e7ec] dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.04]'
                            }`}
                        >
                          <span style={{ fontFamily: f }}>{f}</span>
                          {font === f && (
                            <svg className="w-3.5 h-3.5 text-brand-500" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
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

            <div className="border-t border-[#eef0f4] dark:border-white/[0.06] pt-4 mt-4 flex-shrink-0 bg-card">
              <button
                onClick={() => {
                  setLayout('sidebar');
                  setTheme('slate-dark');
                  setFont('Poppins');
                  setSettingsOpen(false);
                }}
                className="w-full py-2.5 px-3.5 rounded-xl border border-[#e4e7ec] dark:border-white/[0.08] text-slate-600 dark:text-slate-400 text-xs font-semibold hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Reset Default Styles</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* 🥞 ANIMATED TOASTS STACK PANEL (TOP RIGHT or MIDDLE RIGHT on /dashboard/roles & /dashboard/attendance/rules) */}
      <div className={`fixed right-6 z-[999999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none font-sans transition-all duration-300 ${
        pathname?.includes('/dashboard/roles') || pathname?.includes('/dashboard/attendance/rules') || pathname?.includes('/rules')
          ? 'top-1/2 -translate-y-1/2'
          : 'top-6'
      }`}>
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto animate-toast">
            <div className="relative flex items-center justify-between gap-3 pl-5 pr-3 py-3 rounded-xl bg-card border border-[#e4e7ec] dark:border-white/[0.08] shadow-[0_12px_32px_-8px_rgba(16,24,40,0.22)] dark:shadow-[0_14px_36px_-8px_rgba(0,0,0,0.55)] overflow-hidden">
              {/* Type accent bar */}
              <span
                className={`absolute left-0 top-0 bottom-0 w-1 ${
                  toast.type === 'error'
                    ? 'bg-rose-500'
                    : toast.type === 'info'
                    ? 'bg-blue-500'
                    : 'bg-emerald-500'
                }`}
              />
              <div className="flex items-center gap-3">
                <span
                  className={`flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border text-sm font-semibold ${
                    toast.type === 'error'
                      ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-100 dark:border-rose-500/20 text-rose-600 dark:text-rose-400'
                      : toast.type === 'info'
                      ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-400'
                      : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {toast.type === 'error' ? '✕' : toast.type === 'info' ? 'ℹ' : '✓'}
                </span>
                <div>
                  <p className="text-xs font-semibold leading-snug text-slate-900 dark:text-slate-100">{toast.message}</p>
                  <span
                    className={`text-[9.5px] font-semibold uppercase tracking-wider block mt-0.5 ${
                      toast.type === 'error'
                        ? 'text-rose-600 dark:text-rose-400'
                        : toast.type === 'info'
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {toast.type}
                  </span>
                </div>
              </div>
              <button
                onClick={() => dismissToast(toast.id)}
                className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.1] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer border border-[#e4e7ec] dark:border-white/[0.06]"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Global 100% Free Floating AI Assistant Widget */}
      <FloatingAiWidget />
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
