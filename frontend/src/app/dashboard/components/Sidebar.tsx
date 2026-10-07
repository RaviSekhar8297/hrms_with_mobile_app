'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Download, ChevronLeft, ChevronDown, X, Smartphone } from 'lucide-react';

export interface SidebarItem {
  tab: string;
  label: string;
  icon: React.ReactNode;
  permission?: string;
  badge?: string;
}

export interface SidebarGroup {
  title: string;
  items: SidebarItem[];
  superAdminOnly?: boolean;
}

interface SidebarProps {
  isMobile?: boolean;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  companyName: string;
  companyLogo: string;
  logoError: boolean;
  setLogoError: (err: boolean) => void;
  sidebarSearch: string;
  setSidebarSearch: (query: string) => void;
  sidebarGroups: SidebarGroup[];
  isSuperAdmin: boolean;
  hasPermission: (permission?: string) => boolean;
  currentTab: string;
  pathname: string;
}

const getGroupDefaultIcon = (title: string, fallback: React.ReactNode) => {
  const t = title.toLowerCase();
  if (t.includes('org') || t.includes('company') || t.includes('branch')) {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    );
  }
  if (t.includes('attend') || t.includes('time') || t.includes('punch') || t.includes('track')) {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  if (t.includes('enjoy') || t.includes('shift') || t.includes('holiday') || t.includes('weekoff')) {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
  }
  if (t.includes('leave')) {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
      </svg>
    );
  }
  if (t.includes('onboard')) {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
      </svg>
    );
  }
  if (t.includes('payroll') || t.includes('salary') || t.includes('finance') || t.includes('tds')) {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  if (t.includes('work') || t.includes('bridge') || t.includes('task') || t.includes('project')) {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    );
  }
  if (t.includes('recruit') || t.includes('career') || t.includes('talent')) {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    );
  }
  if (t.includes('config') || t.includes('setting') || t.includes('admin')) {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    );
  }
  return fallback;
};

export const Sidebar: React.FC<SidebarProps> = ({
  isMobile = false,
  sidebarCollapsed,
  setSidebarCollapsed,
  companyName,
  companyLogo,
  logoError,
  setLogoError,
  sidebarSearch,
  setSidebarSearch,
  sidebarGroups,
  isSuperAdmin,
  hasPermission,
  currentTab,
  pathname,
}) => {
  const [openGroupKey, setOpenGroupKey] = useState<string>('');
  const [userInteracted, setUserInteracted] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallModal, setShowInstallModal] = useState<boolean>(false);

  // Floating Fixed Popup for Collapsed Sidebar
  const [hoveredPopup, setHoveredPopup] = useState<{
    type: 'single' | 'group';
    item?: SidebarItem;
    group?: SidebarGroup;
    top: number;
    left: number;
  } | null>(null);

  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = (
    type: 'single' | 'group',
    data: { item?: SidebarItem; group?: SidebarGroup },
    e: React.MouseEvent<HTMLElement>
  ) => {
    if (!sidebarCollapsed || isMobile) return;
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredPopup({
      type,
      ...data,
      top: rect.top,
      left: rect.right + 10,
    });
  };

  const handleMouseLeave = () => {
    if (!sidebarCollapsed || isMobile) return;
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredPopup(null);
    }, 120);
  };

  const handlePopupEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
  };

  const handlePopupLeave = () => {
    setHoveredPopup(null);
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).deferredPwaPrompt) {
      setDeferredPrompt((window as any).deferredPwaPrompt);
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      if (typeof window !== 'undefined') {
        (window as any).deferredPwaPrompt = e;
      }
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallPWA = async () => {
    const activePrompt = deferredPrompt || (typeof window !== 'undefined' ? (window as any).deferredPwaPrompt : null);
    if (activePrompt) {
      try {
        activePrompt.prompt();
        const choice = await activePrompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          setDeferredPrompt(null);
          if (typeof window !== 'undefined') (window as any).deferredPwaPrompt = null;
        }
      } catch (err) {
        console.error('PWA prompt error:', err);
        setShowInstallModal(true);
      }
    } else {
      setShowInstallModal(true);
    }
  };

  const allSidebarTabs = React.useMemo(() => {
    return sidebarGroups.flatMap((g) => g.items.map((i) => i.tab));
  }, [sidebarGroups]);

  const checkIsActive = (tabName: string) => {
    const cleanPath = (pathname || '').replace('/dashboard/', '');
    if (cleanPath === tabName) return true;
    if (cleanPath.startsWith(tabName + '/') && !allSidebarTabs.includes(cleanPath)) {
      return true;
    }
    return false;
  };

  const groupTitleKey = (title: string, idx: number) => `${title}_${idx}`;

  // Automatically set openGroupKey to the group containing the active tab on page load / route navigation
  useEffect(() => {
    setUserInteracted(false);
    let foundActiveKey = '';
    sidebarGroups.forEach((group, idx) => {
      const isCoreGroup = group.title.toUpperCase().includes('CORE') || idx === 0;
      if (!isCoreGroup) {
        const hasActiveChild = group.items.some((item) => checkIsActive(item.tab));
        if (hasActiveChild) {
          foundActiveKey = groupTitleKey(group.title, idx);
        }
      }
    });
    setOpenGroupKey(foundActiveKey);
  }, [pathname]);

  const toggleGroup = (groupKey: string) => {
    setUserInteracted(true);
    setOpenGroupKey((prev) => (prev === groupKey ? '' : groupKey));
  };

  const getLinkClass = (tabName: string) => {
    const isActive = checkIsActive(tabName);

    return `group relative flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs select-none transition-all duration-200 font-sidebar ${
      isActive
        ? 'bg-[#07518a] text-white font-bold shadow-md shadow-[#07518a]/30 scale-[1.01]'
        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/90 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white font-semibold'
    }`;
  };

  const renderNavLinks = () => {
    return sidebarGroups.map((group, groupIdx) => {
      if (group.superAdminOnly && !isSuperAdmin) return null;
      let visibleItems = group.items.filter((item) => hasPermission(item.permission));

      if (sidebarSearch.trim()) {
        const query = sidebarSearch.toLowerCase();
        visibleItems = visibleItems.filter(
          (item) =>
            item.label.toLowerCase().includes(query) || item.tab.toLowerCase().includes(query)
        );
      }

      if (visibleItems.length === 0) return null;

      // CORE CONSOLE items (Overview, My Profile, Work Flow, Analytics, Employees, AI Assistant) display DIRECTLY
      const isCoreGroup = group.title.toUpperCase().includes('CORE') || groupIdx === 0;

      if (isCoreGroup) {
        return (
          <div key={groupIdx} className="mb-1 space-y-1 border-b border-slate-100 dark:border-slate-800/80 pb-1.5">
            <div className="space-y-1">
              {visibleItems.map((item) => {
                const isActive = checkIsActive(item.tab);
                const linkEl = (
                  <Link
                    href={`/dashboard/${item.tab}`}
                    className={getLinkClass(item.tab)}
                  >
                    <span
                      className={`flex-shrink-0 transition-transform duration-200 group-hover:scale-105 ${
                        isActive
                          ? 'text-white'
                          : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-100'
                      }`}
                    >
                      {item.icon}
                    </span>

                    {(!sidebarCollapsed || isMobile) && (
                      <span className={`truncate tracking-tight flex-1 ${isActive ? 'font-bold text-white' : 'font-semibold text-slate-700 dark:text-slate-200'}`}>
                        {item.label}
                      </span>
                    )}

                    {(!sidebarCollapsed || isMobile) && item.badge && (
                      <span
                        className={`ml-auto text-[9.5px] font-black px-2 py-0.5 rounded-full ${
                          isActive
                            ? 'bg-white/20 text-white border border-white/30'
                            : 'bg-[#07518a]/10 text-[#07518a] dark:text-[#38bdf8] border border-[#07518a]/20'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}

                    {isActive && sidebarCollapsed && !isMobile && (
                      <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-8 rounded-l-md bg-[#07518a] shadow-sm" />
                    )}
                  </Link>
                );

                if (sidebarCollapsed && !isMobile) {
                  return (
                    <div
                      key={item.tab}
                      className="relative w-full"
                      onMouseEnter={(e) => handleMouseEnter('single', { item }, e)}
                      onMouseLeave={handleMouseLeave}
                    >
                      {linkEl}
                    </div>
                  );
                }

                return <React.Fragment key={item.tab}>{linkEl}</React.Fragment>;
              })}
            </div>
          </div>
        );
      }

      // COLLAPSED MODE FOR ACCORDION GROUPS WITH SUBMENUS (Organization, Time & Attendance, Payroll, Leave, etc.)
      if (sidebarCollapsed && !isMobile) {
        const firstItem = visibleItems[0];
        const hasActiveItem = visibleItems.some((item) => checkIsActive(item.tab));
        const groupIcon = getGroupDefaultIcon(group.title, firstItem?.icon);

        return (
          <div
            key={groupIdx}
            className="relative w-full mb-0.5"
            onMouseEnter={(e) => handleMouseEnter('group', { group: { ...group, items: visibleItems } }, e)}
            onMouseLeave={handleMouseLeave}
          >
            <Link
              href={`/dashboard/${firstItem.tab}`}
              className={`group relative flex items-center justify-center p-2.5 rounded-lg text-xs select-none transition-all duration-200 font-sidebar ${
                hasActiveItem
                  ? 'bg-[#07518a] text-white font-bold shadow-md shadow-[#07518a]/30 scale-[1.01]'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/90 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white font-semibold'
              }`}
            >
              <span className={`flex-shrink-0 transition-transform duration-200 group-hover:scale-110 ${hasActiveItem ? 'text-white' : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-100'}`}>
                {groupIcon}
              </span>

              {hasActiveItem && (
                <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-7 rounded-l-md bg-[#07518a] shadow-sm" />
              )}
            </Link>
          </div>
        );
      }

      // EXPANDED / MOBILE ACCORDION GROUPS
      const currentKey = groupTitleKey(group.title, groupIdx);
      const groupHasActiveChild = group.items.some((item) => checkIsActive(item.tab));
      const isSearching = sidebarSearch.trim().length > 0;
      
      const isOpen = isSearching || openGroupKey === currentKey || (!userInteracted && openGroupKey === '' && groupHasActiveChild);

      return (
        <div key={groupIdx} className="mb-2">
          {/* Collapsible Accordion Header */}
          <button
            type="button"
            onClick={() => toggleGroup(currentKey)}
            className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-left hover:bg-slate-100/70 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group/hdr"
          >
            <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full transition-colors ${groupHasActiveChild ? 'bg-[#07518a] shadow-xs shadow-[#07518a]/50' : 'bg-slate-300 dark:bg-slate-600'}`} />
              <h4 className={`text-[11px] font-bold uppercase tracking-wider font-sidebar transition-colors ${groupHasActiveChild ? 'text-[#07518a] dark:text-[#38bdf8]' : 'text-slate-400 dark:text-slate-500 group-hover/hdr:text-slate-700 dark:group-hover/hdr:text-slate-300'}`}>
                {group.title}
              </h4>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[9.5px] font-mono text-slate-400 dark:text-slate-500 font-bold bg-slate-100 dark:bg-slate-800/60 px-1.5 py-0.5 rounded">
                {visibleItems.length}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-0' : '-rotate-90'}`}
              />
            </div>
          </button>

          {/* Collapsible Children List */}
          <div
            className={`space-y-1 transition-all duration-300 ${
              isOpen ? 'max-h-[800px] opacity-100 mt-1' : 'max-h-0 opacity-0 overflow-hidden'
            }`}
          >
            {visibleItems.map((item) => {
              const isActive = checkIsActive(item.tab);

              return (
                <Link
                  key={item.tab}
                  href={`/dashboard/${item.tab}`}
                  className={getLinkClass(item.tab)}
                >
                  <span
                    className={`flex-shrink-0 transition-transform duration-200 group-hover:scale-105 ${
                      isActive
                        ? 'text-white'
                        : 'text-slate-400 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200'
                    }`}
                  >
                    {item.icon}
                  </span>

                  <span className={`truncate tracking-tight flex-1 ${isActive ? 'font-bold text-white' : 'font-semibold text-slate-700 dark:text-slate-200'}`}>
                    {item.label}
                  </span>

                  {item.badge && (
                    <span
                      className={`ml-auto text-[9.5px] font-black px-2 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-white/20 text-white border border-white/30'
                          : 'bg-[#07518a]/10 text-[#07518a] dark:text-[#38bdf8] border border-[#07518a]/20'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      );
    });
  };

  if (isMobile) {
    return (
      <div className="flex flex-col h-full w-full font-sidebar select-none">
        {/* 🔍 Search Bar */}
        <div className="px-1 pb-2 flex-shrink-0 border-b border-slate-100 dark:border-slate-800/80 mb-2 flex items-center gap-2">
          <div className="relative flex items-center flex-1">
            <input
              type="text"
              placeholder="Search menu items..."
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-800 dark:text-slate-100 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-[#07518a] focus:ring-2 focus:ring-[#07518a]/20 transition-all"
            />
            {sidebarSearch && (
              <button
                onClick={() => setSidebarSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={handleInstallPWA}
            title="Download PWA"
            className="p-2 rounded-xl bg-[#07518a]/10 hover:bg-[#07518a]/20 dark:bg-[#07518a]/20 dark:hover:bg-[#07518a]/40 text-[#07518a] dark:text-[#38bdf8] border border-[#07518a]/30 transition-all cursor-pointer flex-shrink-0 flex items-center justify-center group active:scale-95"
          >
            <Download className="w-4 h-4 transition-transform group-hover:scale-110" />
          </button>
        </div>

        {/* 📜 Scrollable Tree Menu */}
        <nav className="flex-1 overflow-y-auto py-1 space-y-1 no-scrollbar">
          {renderNavLinks()}
        </nav>
      </div>
    );
  }

  return (
    <aside
      style={{ fontFamily: "'Inter', 'Outfit', sans-serif" }}
      className={`hidden md:flex flex-col h-full rounded-xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm transition-all duration-300 flex-shrink-0 z-30 font-sidebar overflow-hidden ${
        sidebarCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* 🏢 Sidebar Brand Header */}
      <div className="flex h-16 items-center border-b border-slate-200/80 dark:border-slate-800/80 flex-shrink-0 justify-center px-4 relative">
        {companyLogo && !logoError ? (
          sidebarCollapsed ? (
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="flex h-10 w-10 items-center justify-center rounded-xl overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs p-1 cursor-pointer hover:scale-105 transition-transform"
              title="Expand Sidebar"
            >
              <img
                src={companyLogo}
                alt={companyName}
                className="h-full w-full object-contain"
                onError={() => setLogoError(true)}
              />
            </button>
          ) : (
            <div className="flex items-center justify-center w-full h-full py-2 px-1">
              <img
                src={companyLogo}
                alt={companyName}
                className="max-h-12 max-w-[200px] object-contain transition-all"
                onError={() => setLogoError(true)}
              />
            </div>
          )
        ) : (
          <div className="flex items-center gap-3 w-full px-2">
            {sidebarCollapsed ? (
              <button
                onClick={() => setSidebarCollapsed(false)}
                className="flex h-10 w-10 items-center justify-center rounded-2xl overflow-hidden bg-[#07518a] shadow-md shadow-[#07518a]/25 flex-shrink-0 border border-white/20 text-white font-black text-lg cursor-pointer hover:scale-105 transition-transform"
                title="Expand Sidebar"
              >
                {companyName ? companyName.charAt(0).toUpperCase() : 'H'}
              </button>
            ) : (
              <>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl overflow-hidden bg-[#07518a] shadow-md shadow-[#07518a]/25 flex-shrink-0 border border-white/20 text-white font-black text-lg">
                  {companyName ? companyName.charAt(0).toUpperCase() : 'H'}
                </div>
                <div className="flex flex-col text-left overflow-hidden">
                  <span className="font-black tracking-wider text-slate-800 dark:text-slate-100 text-xs uppercase leading-tight whitespace-nowrap truncate max-w-[140px]">
                    {companyName || 'HRMS PORTAL'}
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9px] font-extrabold text-[#07518a] dark:text-[#38bdf8] tracking-widest uppercase">
                      Enterprise v2.4
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* 🔍 Sidebar Search Bar (Only when expanded) */}
      {!sidebarCollapsed && (
        <div className="px-3.5 py-3 flex-shrink-0 border-b border-slate-100 dark:border-slate-800/80 flex items-center gap-2">
          <div className="relative flex items-center flex-1">
            <input
              type="text"
              placeholder="Search menu items..."
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-lg text-xs font-semibold placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-800 dark:text-slate-100 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-[#07518a] focus:ring-2 focus:ring-[#07518a]/20 transition-all shadow-2xs"
            />
            {sidebarSearch && (
              <button
                onClick={() => setSidebarSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer transition-colors"
                title="Clear Search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={handleInstallPWA}
            title="Download PWA"
            className="p-2 rounded-lg bg-[#07518a]/10 hover:bg-[#07518a]/20 dark:bg-[#07518a]/20 dark:hover:bg-[#07518a]/40 text-[#07518a] dark:text-[#38bdf8] border border-[#07518a]/30 transition-all cursor-pointer flex-shrink-0 flex items-center justify-center group shadow-2xs active:scale-95"
          >
            <Download className="w-4 h-4 transition-transform group-hover:scale-110" />
          </button>
        </div>
      )}

      {/* 📜 Scrollable Sidebar Nav Links */}
      <nav className="flex-1 min-h-0 p-2 space-y-1 overflow-y-auto no-scrollbar">
        {renderNavLinks()}
      </nav>

      {/* 🔘 Sidebar Collapse Toggle Footer - Pinned Always at Bottom */}
      <div className="p-2 border-t border-slate-200/60 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 flex-shrink-0 mt-auto z-20">
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className={`flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-card hover:bg-slate-100 dark:hover:bg-slate-800/70 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-all shadow-xs cursor-pointer group ${
            sidebarCollapsed ? 'w-10 h-10 mx-auto' : 'w-full p-2.5 gap-2'
          }`}
          title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          <ChevronLeft
            className={`w-4 h-4 transition-transform duration-300 ${
              sidebarCollapsed ? 'rotate-180 text-[#07518a]' : 'group-hover:-translate-x-0.5'
            }`}
          />
          {!sidebarCollapsed && <span className="text-xs font-bold font-sidebar">Collapse Menu</span>}
        </button>
      </div>

      {/* 📱 PWA Install Guide Modal */}
      {showInstallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 text-slate-800 dark:text-slate-100 relative">
            <button
              onClick={() => setShowInstallModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#07518a]/10 text-[#07518a] flex items-center justify-center font-black">
                <Smartphone className="w-6 h-6 text-[#07518a]" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:white">Install HRMS App</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Add Brihaspathi HRMS to your home screen</p>
              </div>
            </div>

            <div className="space-y-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs">
              <div className="flex items-start gap-2.5">
                <span className="font-bold text-[#07518a] dark:text-[#38bdf8]">1.</span>
                <span><strong>Android / Chrome:</strong> Tap browser menu <strong className="font-mono">⋮</strong> → Select <strong>"Install App"</strong> or <strong>"Add to Home Screen"</strong>.</span>
              </div>
              <div className="flex items-start gap-2.5 border-t border-slate-200/60 dark:border-slate-700/60 pt-2.5">
                <span className="font-bold text-[#07518a] dark:text-[#38bdf8]">2.</span>
                <span><strong>iPhone / Safari:</strong> Tap Share button <strong className="font-mono">🔗</strong> → Select <strong>"Add to Home Screen"</strong>.</span>
              </div>
            </div>

            <button
              onClick={() => setShowInstallModal(false)}
              className="w-full py-2.5 bg-[#07518a] hover:bg-[#064270] text-white font-bold rounded-xl text-xs transition-colors shadow-md shadow-[#07518a]/20 cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* 🪟 FLOATING FIXED TOOLTIPS & FLYOUT SUBMENUS */}
      {sidebarCollapsed && !isMobile && hoveredPopup && (
        <div
          style={{
            position: 'fixed',
            left: `${hoveredPopup.left}px`,
            top: `${hoveredPopup.type === 'single' ? hoveredPopup.top + 4 : Math.max(16, Math.min(hoveredPopup.top - 8, (typeof window !== 'undefined' ? window.innerHeight : 800) - 390))}px`,
            zIndex: 999999,
          }}
          onMouseEnter={handlePopupEnter}
          onMouseLeave={handlePopupLeave}
          className="pointer-events-auto select-none animate-in fade-in zoom-in-95 duration-100"
        >
          {hoveredPopup.type === 'single' && hoveredPopup.item && (
            <div className="relative flex items-center gap-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-2xl px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap border border-slate-700/60 dark:border-slate-300/60">
              {/* Tooltip Arrow */}
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900 dark:border-r-slate-100" />
              <span>{hoveredPopup.item.label}</span>
              {hoveredPopup.item.badge && (
                <span className="text-[9.5px] px-1.5 py-0.5 bg-[#07518a] text-white rounded-full font-black">
                  {hoveredPopup.item.badge}
                </span>
              )}
            </div>
          )}

          {hoveredPopup.type === 'group' && hoveredPopup.group && (
            <div className="relative flex flex-col min-w-[240px] max-w-[280px] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xl p-2.5 before:absolute before:-left-3 before:top-0 before:bottom-0 before:w-3 before:content-['']">
              {/* Flyout Arrow */}
              <div className="absolute right-full top-4 border-6 border-transparent border-r-white dark:border-r-slate-900" />

              {/* Header */}
              <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1.5 flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#07518a] dark:text-[#38bdf8] font-sidebar truncate">
                  {hoveredPopup.group.title}
                </span>
                <span className="text-[9.5px] font-mono font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                  {hoveredPopup.group.items.length} pages
                </span>
              </div>

              {/* Submenu List */}
              <ul className="space-y-1 max-h-[360px] overflow-y-auto no-scrollbar list-none p-0 m-0">
                {hoveredPopup.group.items.map((subItem) => {
                  const isSubActive = checkIsActive(subItem.tab);
                  return (
                    <li key={subItem.tab}>
                      <Link
                        href={`/dashboard/${subItem.tab}`}
                        onClick={() => setHoveredPopup(null)}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 ${
                          isSubActive
                            ? 'bg-[#07518a] text-white font-bold shadow-xs'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <span className={`w-4 h-4 flex-shrink-0 ${isSubActive ? 'text-white' : 'text-slate-400'}`}>
                          {subItem.icon}
                        </span>
                        <span className="truncate flex-1 text-left">{subItem.label}</span>
                        {subItem.badge && (
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                            isSubActive ? 'bg-white/20 text-white' : 'bg-[#07518a]/10 text-[#07518a] dark:text-[#38bdf8]'
                          }`}>
                            {subItem.badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
