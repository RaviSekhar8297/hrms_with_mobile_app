'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

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

    return `group relative flex items-center gap-3 rounded-[10px] px-3 py-2 text-xs select-none font-sidebar transition-all duration-200 before:pointer-events-none before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-[3px] before:rounded-r-full before:bg-brand-600 before:transition-opacity before:duration-200 ${
      isActive
        ? 'bg-brand-600/10 text-brand-700 dark:bg-brand-400/10 dark:text-brand-300 font-semibold before:opacity-100'
        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-white/[0.05] hover:text-slate-900 dark:hover:text-slate-100 font-medium before:opacity-0'
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

      // CORE CONSOLE items (Overview, My Profile, Analytics) display DIRECTLY at top without UL-LI accordion wrapper
      const isCoreGroup = group.title.toUpperCase().includes('CORE') || groupIdx === 0;

      if (isCoreGroup) {
        return (
          <div key={groupIdx} className="mb-2 space-y-0.5 border-b border-[#eaecf0] dark:border-white/[0.06] pb-2.5">
            <div className="space-y-0.5">
              {visibleItems.map((item) => {
                const isActive = checkIsActive(item.tab);
                return (
                  <Link
                    key={item.tab}
                    href={`/dashboard/${item.tab}`}
                    className={getLinkClass(item.tab)}
                    title={sidebarCollapsed && !isMobile ? item.label : undefined}
                  >
                    <span
                      className={`flex-shrink-0 transition-transform duration-200 group-hover:scale-105 ${
                        isActive
                          ? 'text-brand-600 dark:text-brand-400'
                          : 'text-slate-400 dark:text-slate-500 group-hover:text-brand-600 dark:group-hover:text-brand-400'
                      }`}
                    >
                      {item.icon}
                    </span>

                    {(!sidebarCollapsed || isMobile) && (
                      <span className={`truncate tracking-tight flex-1 ${isActive ? 'font-semibold text-brand-700 dark:text-brand-300' : 'font-medium text-slate-600 dark:text-slate-300'}`}>
                        {item.label}
                      </span>
                    )}

                    {(!sidebarCollapsed || isMobile) && item.badge && (
                      <span
                        className={`ml-auto text-[9.5px] font-black px-2 py-0.5 rounded-full ${
                          isActive
                            ? 'bg-brand-600/10 text-brand-700 border border-brand-600/20 dark:bg-brand-400/10 dark:text-brand-300 dark:border-brand-400/20'
                            : 'bg-slate-100 text-slate-600 border border-slate-200/70 dark:bg-white/[0.06] dark:text-slate-300 dark:border-white/10'
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
      }

      // EXCLUSIVE ACCORDION GROUPS (Opening one closes others cleanly)
      const currentKey = groupTitleKey(group.title, groupIdx);
      const groupHasActiveChild = group.items.some((item) => checkIsActive(item.tab));
      const isSearching = sidebarSearch.trim().length > 0;
      
      // Group is open if searching OR explicitly selected as openGroupKey OR (!userInteracted and active child)
      const isOpen = isSearching || openGroupKey === currentKey || (!userInteracted && openGroupKey === '' && groupHasActiveChild);

      return (
        <div key={groupIdx} className="mb-2">
          {(!sidebarCollapsed || isMobile) ? (
            /* Collapsible Accordion Header */
            <button
              type="button"
              onClick={() => toggleGroup(currentKey)}
              className="flex items-center justify-between w-full px-2.5 py-2 rounded-[10px] text-left hover:bg-slate-100/70 dark:hover:bg-white/[0.04] transition-colors cursor-pointer group/hdr"
            >
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full transition-colors ${groupHasActiveChild ? 'bg-brand-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                <h4 className={`text-[10.5px] font-semibold uppercase tracking-[0.08em] font-sidebar transition-colors ${groupHasActiveChild ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400 dark:text-slate-500 group-hover/hdr:text-slate-600 dark:group-hover/hdr:text-slate-300'}`}>
                  {group.title}
                </h4>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 bg-slate-100/80 dark:bg-white/[0.06] px-1.5 py-0.5 rounded-md tabular-nums">
                  {visibleItems.length}
                </span>
                <svg
                  className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-0' : '-rotate-90'}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </button>
          ) : (
            <div className="h-2" />
          )}

          {/* Collapsible Children List */}
          <div
            className={`space-y-0.5 transition-all duration-300 ${
              (sidebarCollapsed && !isMobile) || isOpen ? 'max-h-[600px] opacity-100 mt-0.5' : 'max-h-0 opacity-0 overflow-hidden'
            }`}
          >
            {visibleItems.map((item) => {
              const isActive = checkIsActive(item.tab);

              return (
                <Link
                  key={item.tab}
                  href={`/dashboard/${item.tab}`}
                  className={getLinkClass(item.tab)}
                  title={sidebarCollapsed && !isMobile ? item.label : undefined}
                >
                  <span
                    className={`flex-shrink-0 transition-transform duration-200 group-hover:scale-105 ${
                      isActive
                        ? 'text-brand-600 dark:text-brand-400'
                        : 'text-slate-400 dark:text-slate-500 group-hover:text-brand-600 dark:group-hover:text-brand-400'
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
                          ? 'bg-brand-600/10 text-brand-700 border border-brand-600/20 dark:bg-brand-400/10 dark:text-brand-300 dark:border-brand-400/20'
                          : 'bg-slate-100 text-slate-600 border border-slate-200/70 dark:bg-white/[0.06] dark:text-slate-300 dark:border-white/10'
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
        <div className="px-1 pb-3 flex-shrink-0 border-b border-[#eaecf0] dark:border-white/[0.06] mb-2 flex items-center gap-2">
          <div className="relative flex items-center flex-1">
            <svg
              className="pointer-events-none absolute left-3 w-3.5 h-3.5 text-slate-400 dark:text-slate-500"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <circle cx="11" cy="11" r="7" />
              <path strokeLinecap="round" d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="text"
              placeholder="Search menu items..."
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              className="w-full pl-9 text-xs"
            />
            {sidebarSearch && (
              <button
                onClick={() => setSidebarSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.08] cursor-pointer transition-colors"
              >
                ✕
              </button>
            )}
          </div>

          <button
            onClick={handleInstallPWA}
            title="Download PWA"
            className="h-9 w-9 rounded-[10px] border border-[#e4e7ec] dark:border-white/[0.08] bg-transparent hover:bg-slate-50 dark:hover:bg-white/[0.05] text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition-all cursor-pointer flex-shrink-0 flex items-center justify-center group active:scale-95"
          >
            <svg className="w-4 h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
        </div>

        {/* 📜 Scrollable Tree Menu */}
        <nav className="flex-1 overflow-y-auto py-1 space-y-0.5 no-scrollbar">
          {renderNavLinks()}
        </nav>
      </div>
    );
  }

  return (
    <aside
      style={{ fontFamily: "'Inter', 'Outfit', sans-serif" }}
      className={`hidden md:flex flex-col h-full rounded-2xl border bg-card transition-all duration-300 flex-shrink-0 z-30 font-sidebar overflow-hidden ${
        sidebarCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* 🏢 Sidebar Brand Header */}
      <div className="flex h-16 items-center border-b border-[#eaecf0] dark:border-white/[0.06] flex-shrink-0 justify-center px-4 relative">
        {companyLogo && !logoError ? (
          sidebarCollapsed ? (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl overflow-hidden bg-white dark:bg-white/[0.04] border border-[#e4e7ec] dark:border-white/[0.08] p-1">
              <img
                src={companyLogo}
                alt={companyName}
                className="h-full w-full object-contain"
                onError={() => setLogoError(true)}
              />
            </div>
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl overflow-hidden bg-brand-600 shadow-sm flex-shrink-0 text-white font-semibold text-base">
              {companyName ? companyName.charAt(0).toUpperCase() : 'H'}
            </div>
            {!sidebarCollapsed && (
              <div className="flex flex-col text-left overflow-hidden">
                <span className="font-semibold tracking-wide text-slate-800 dark:text-slate-100 text-xs uppercase leading-tight whitespace-nowrap truncate max-w-[140px]">
                  {companyName || 'HRMS PORTAL'}
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 tracking-[0.14em] uppercase">
                    Enterprise v2.4
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 🔍 Sidebar Search Bar */}
      {!sidebarCollapsed && (
        <div className="px-3 py-3 flex-shrink-0 border-b border-[#eaecf0] dark:border-white/[0.06] flex items-center gap-2">
          <div className="relative flex items-center flex-1">
            <svg
              className="pointer-events-none absolute left-3 w-3.5 h-3.5 text-slate-400 dark:text-slate-500"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <circle cx="11" cy="11" r="7" />
              <path strokeLinecap="round" d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="text"
              placeholder="Search menu items..."
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              className="w-full pl-9 text-xs"
            />
            {sidebarSearch && (
              <button
                onClick={() => setSidebarSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.08] cursor-pointer transition-colors"
                title="Clear Search"
              >
                ✕
              </button>
            )}
          </div>

          <button
            onClick={handleInstallPWA}
            title="Download PWA"
            className="h-9 w-9 rounded-[10px] border border-[#e4e7ec] dark:border-white/[0.08] bg-transparent hover:bg-slate-50 dark:hover:bg-white/[0.05] text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition-all cursor-pointer flex-shrink-0 flex items-center justify-center group active:scale-95"
          >
            <svg className="w-4 h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
        </div>
      )}

      {/* 📜 Scrollable Sidebar Nav Links */}
      <nav className="flex-1 overflow-y-auto p-3 no-scrollbar space-y-0.5">
        {renderNavLinks()}
      </nav>

      {/* 🔘 Sidebar Collapse Toggle Footer */}
      <div className="p-3 border-t border-[#eaecf0] dark:border-white/[0.06] flex-shrink-0">
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="flex w-full items-center justify-center gap-2 p-2.5 rounded-[10px] border border-[#e4e7ec] dark:border-white/[0.08] bg-transparent hover:bg-slate-50 dark:hover:bg-white/[0.05] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-all cursor-pointer group"
          title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          <svg
            className={`w-4 h-4 transition-transform duration-300 ${
              sidebarCollapsed ? 'rotate-180 text-brand-600' : 'group-hover:-translate-x-0.5'
            }`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            viewBox="0 0 24 24"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          {!sidebarCollapsed && <span className="text-xs font-medium font-sidebar">Collapse Menu</span>}
        </button>
      </div>

      {/* 📱 PWA Install Guide Modal (Fallback for devices/browsers where auto prompt is restricted) */}
      {showInstallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 backdrop-blur-[2px] p-4 animate-fadeIn">
          <div className="bg-card border border-[#e4e7ec] dark:border-white/[0.08] rounded-2xl max-w-md w-full p-6 shadow-[0_24px_64px_-16px_rgba(16,24,40,0.32)] dark:shadow-[0_24px_64px_-16px_rgba(0,0,0,0.65)] space-y-4 text-foreground relative animate-scaleUp">
            <button
              onClick={() => setShowInstallModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors text-sm"
            >
              ✕
            </button>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600/10 text-brand-600 dark:text-brand-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <rect x="6" y="2" width="12" height="20" rx="2.5" />
                  <path strokeLinecap="round" d="M11 18h2" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-[15px] text-foreground">Install HRMS App</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Add Brihaspathi HRMS to your home screen</p>
              </div>
            </div>

            <div className="space-y-3 bg-[#f9fafb] dark:bg-white/[0.03] p-4 rounded-xl border border-[#eef1f5] dark:border-white/[0.06] text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-start gap-2.5">
                <span className="font-semibold text-brand-600 dark:text-brand-400">1.</span>
                <span><strong>Android / Chrome:</strong> Tap browser menu <strong className="font-mono">⋮</strong> → Select <strong>"Install App"</strong> or <strong>"Add to Home Screen"</strong>.</span>
              </div>
              <div className="flex items-start gap-2.5 border-t border-[#eef1f5] dark:border-white/[0.06] pt-2.5">
                <span className="font-semibold text-brand-600 dark:text-brand-400">2.</span>
                <span><strong>iPhone / Safari:</strong> Tap Share button <strong className="font-mono">🔗</strong> → Select <strong>"Add to Home Screen"</strong>.</span>
              </div>
            </div>

            <button
              onClick={() => setShowInstallModal(false)}
              className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-[10px] text-xs transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};
