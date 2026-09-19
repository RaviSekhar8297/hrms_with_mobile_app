'use client';

import React, { useState, useEffect } from 'react';
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

    return `group relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs select-none transition-all duration-200 font-sidebar ${
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

      // CORE CONSOLE items (Overview, My Profile, Analytics) display DIRECTLY at top without UL-LI accordion wrapper
      const isCoreGroup = group.title.toUpperCase().includes('CORE') || groupIdx === 0;

      if (isCoreGroup) {
        return (
          <div key={groupIdx} className="mb-3 space-y-1 border-b border-slate-100 dark:border-slate-800/80 pb-3">
            <div className="space-y-1">
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
          ) : (
            <div className="h-2" />
          )}

          {/* Collapsible Children List */}
          <div
            className={`space-y-1 transition-all duration-300 ${
              (sidebarCollapsed && !isMobile) || isOpen ? 'max-h-[600px] opacity-100 mt-1' : 'max-h-0 opacity-0 overflow-hidden'
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
                        ? 'text-white'
                        : 'text-slate-400 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200'
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
      className={`hidden md:flex flex-col h-full rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm transition-all duration-300 flex-shrink-0 z-30 font-sidebar overflow-hidden ${
        sidebarCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* 🏢 Sidebar Brand Header */}
      <div className="flex h-16 items-center border-b border-slate-200/80 dark:border-slate-800/80 flex-shrink-0 justify-center px-4 relative">
        {companyLogo && !logoError ? (
          sidebarCollapsed ? (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs p-1">
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
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl overflow-hidden bg-[#07518a] shadow-md shadow-[#07518a]/25 flex-shrink-0 border border-white/20 text-white font-black text-lg">
              {companyName ? companyName.charAt(0).toUpperCase() : 'H'}
            </div>
            {!sidebarCollapsed && (
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
            )}
          </div>
        )}
      </div>

      {/* 🔍 Sidebar Search Bar */}
      {!sidebarCollapsed && (
        <div className="px-3.5 py-3 flex-shrink-0 border-b border-slate-100 dark:border-slate-800/80 flex items-center gap-2">
          <div className="relative flex items-center flex-1">
            <input
              type="text"
              placeholder="Search menu items..."
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-xl text-xs font-semibold placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-800 dark:text-slate-100 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-[#07518a] focus:ring-2 focus:ring-[#07518a]/20 transition-all shadow-2xs"
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
            className="p-2 rounded-xl bg-[#07518a]/10 hover:bg-[#07518a]/20 dark:bg-[#07518a]/20 dark:hover:bg-[#07518a]/40 text-[#07518a] dark:text-[#38bdf8] border border-[#07518a]/30 transition-all cursor-pointer flex-shrink-0 flex items-center justify-center group shadow-2xs active:scale-95"
          >
            <Download className="w-4 h-4 transition-transform group-hover:scale-110" />
          </button>
        </div>
      )}

      {/* 📜 Scrollable Sidebar Nav Links */}
      <nav className="flex-1 overflow-y-auto p-3 no-scrollbar space-y-1">
        {renderNavLinks()}
      </nav>

      {/* 🔘 Sidebar Collapse Toggle Footer */}
      <div className="p-3 border-t border-slate-200/60 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 flex-shrink-0">
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="flex w-full items-center justify-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-card hover:bg-slate-100 dark:hover:bg-slate-800/70 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-all shadow-xs cursor-pointer group"
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

      {/* 📱 PWA Install Guide Modal (Fallback for devices/browsers where auto prompt is restricted) */}
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
    </aside>
  );
};
