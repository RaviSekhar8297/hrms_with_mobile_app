'use client';

import React from 'react';
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

  const getLinkClass = (tabName: string) => {
    const isActive = checkIsActive(tabName);

    return `group relative flex items-center gap-3.5 px-4 py-3 rounded-2xl text-[13.5px] select-none transition-all duration-200 font-sidebar ${
      isActive
        ? 'bg-gradient-to-r from-cyan-600 via-teal-600 to-blue-600 text-white font-bold shadow-md shadow-cyan-600/25 scale-[1.01]'
        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white font-semibold'
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

      return (
        <div key={groupIdx} className="space-y-1 mb-5">
          {!sidebarCollapsed && (
            <div className="flex items-center justify-between px-3.5 mb-2">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500/80 shadow-xs shadow-cyan-500/50" />
                <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-sidebar">
                  {group.title}
                </h4>
              </div>
              <span className="text-[9.5px] font-mono text-slate-400 dark:text-slate-500 font-bold bg-slate-100 dark:bg-slate-800/60 px-1.5 py-0.5 rounded">
                {visibleItems.length}
              </span>
            </div>
          )}
          <div className="space-y-1">
            {visibleItems.map((item) => {
              const isActive = checkIsActive(item.tab);

              return (
                <Link
                  key={item.tab}
                  href={`/dashboard/${item.tab}`}
                  className={getLinkClass(item.tab)}
                  title={sidebarCollapsed ? item.label : undefined}
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

                  {!sidebarCollapsed && (
                    <span className={`truncate tracking-tight flex-1 ${isActive ? 'font-bold text-white' : 'font-semibold text-slate-700 dark:text-slate-200'}`}>
                      {item.label}
                    </span>
                  )}

                  {!sidebarCollapsed && item.badge && (
                    <span
                      className={`ml-auto text-[9.5px] font-black px-2 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-white/20 text-white border border-white/30'
                          : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}

                  {isActive && sidebarCollapsed && (
                    <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-8 rounded-l-md bg-cyan-500 shadow-sm" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      );
    });
  };

  return (
    <aside
      style={{ fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif" }}
      className={`hidden md:flex flex-col h-full border-r border-slate-200/60 dark:border-slate-800/80 bg-card/95 backdrop-blur-md shadow-sm transition-all duration-300 flex-shrink-0 z-30 font-sidebar ${
        sidebarCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* 🏢 Sidebar Brand Header */}
      <div className="flex h-18 items-center border-b border-slate-200/50 dark:border-slate-800/80 flex-shrink-0 justify-center px-4 relative">
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
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 shadow-md shadow-blue-600/25 flex-shrink-0 border border-white/20 text-white font-black text-lg">
              {companyName ? companyName.charAt(0).toUpperCase() : 'H'}
            </div>
            {!sidebarCollapsed && (
              <div className="flex flex-col text-left overflow-hidden">
                <span className="font-black tracking-wider text-slate-800 dark:text-slate-100 text-xs uppercase leading-tight whitespace-nowrap truncate max-w-[140px]">
                  {companyName || 'HRMS PORTAL'}
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[9px] font-extrabold text-blue-600 dark:text-blue-400 tracking-widest uppercase">
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
        <div className="px-3.5 py-3 flex-shrink-0 border-b border-slate-100 dark:border-slate-800/80">
          <div className="relative flex items-center w-full">
            <input
              type="text"
              placeholder="Search menu items..."
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-xl text-xs font-semibold placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-800 dark:text-slate-100 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-2xs"
            />
            {sidebarSearch && (
              <button
                onClick={() => setSidebarSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs p-0.5 cursor-pointer transition-colors"
                title="Clear Search"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* 📜 Scrollable Sidebar Nav Links */}
      <nav className="flex-1 overflow-y-auto p-4 no-scrollbar">
        {renderNavLinks()}
      </nav>


      {/* 🔘 Sidebar Collapse Toggle Footer */}
      <div className="p-3 border-t border-slate-200/60 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 flex-shrink-0">
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="flex w-full items-center justify-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-card hover:bg-slate-100 dark:hover:bg-slate-800/70 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-all shadow-xs cursor-pointer group"
          title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          <svg
            className={`w-4 h-4 transition-transform duration-300 ${
              sidebarCollapsed ? 'rotate-180 text-blue-500' : 'group-hover:-translate-x-0.5'
            }`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
          {!sidebarCollapsed && (
            <span className="text-xs font-extrabold tracking-tight">Collapse Navigation</span>
          )}
        </button>
      </div>
    </aside>
  );
};
