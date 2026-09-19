'use client';

import React from 'react';
import SearchableSelect from './SearchableSelect';

export interface Company {
  id: string;
  name: string;
  subdomain?: string;
  status?: string;
  created_at?: string;
}

interface DashboardPageHeaderProps {
  title: string;
  subtitle?: string;
  statusBadge?: React.ReactNode;
  actionMessage?: string;
  actionError?: string;
  companies?: Company[];
  companyId?: string | null;
  handleCompanyChange?: (id: string) => void;
  isSuperAdmin?: boolean;
  email?: string;
  hideUserBadge?: boolean;
  hideCompanySelect?: boolean;
  noneLabel?: string;
  children?: React.ReactNode;
}

export default function DashboardPageHeader({
  title,
  subtitle,
  statusBadge,
  actionMessage,
  actionError,
  companies = [],
  companyId = null,
  handleCompanyChange,
  isSuperAdmin = false,
  email = '',
  hideUserBadge = false,
  hideCompanySelect = true,
  noneLabel,
  children
}: DashboardPageHeaderProps) {
  return (
    <div className="space-y-4 w-full">
      {/* 🚀 HEADER DETAILS CARD */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center rounded-2xl border border-slate-200/60 dark:border-slate-800/80 border-l-4 border-l-[#07518a] bg-card py-3 px-4 sm:px-5 shadow-xs gap-3 transition-all duration-200">
        <div className="text-left">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 md:text-xl tracking-tight uppercase">{title}</h2>
            {statusBadge}
          </div>
          {subtitle ? (
            <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{subtitle}</p>
          ) : (
            <p className="mt-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5 flex-wrap">
              Active Scope: 
              <span className="font-extrabold text-[#07518a] dark:text-[#38bdf8] bg-[#07518a]/10 border border-[#07518a]/20 px-2 py-0.5 rounded text-[9px] uppercase tracking-wider">
                {isSuperAdmin ? 'Master Multi-Tenant Console' : 'Isolated Tenant'}
              </span>
            </p>
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-start lg:justify-end">
          {!hideUserBadge && email && (
            <div className="rounded-xl bg-slate-50/50 dark:bg-slate-950/20 px-3.5 py-1.5 border border-slate-200/60 dark:border-slate-800 text-[10px] font-mono text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
              User: {email}
            </div>
          )}
          {children}
        </div>
      </div>

      {/* Notifications */}
      {actionMessage && (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 animate-slideDown shadow-sm flex items-center gap-2">
          <span>✅</span> {actionMessage}
        </div>
      )}
      {actionError && (
        <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-3.5 text-xs font-bold text-red-600 dark:text-red-400 animate-slideDown shadow-sm flex items-center gap-2">
          <span>⚠️</span> {actionError}
        </div>
      )}
    </div>
  );
}
