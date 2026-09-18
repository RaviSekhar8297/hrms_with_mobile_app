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
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center rounded-2xl border border-[#e4e7ec] dark:border-white/[0.07] bg-card py-3.5 px-4 sm:px-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.05)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.24),0_10px_28px_-8px_rgba(0,0,0,0.4)] gap-3 transition-all duration-200">
        <div className="text-left">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[17px] font-semibold text-slate-900 dark:text-slate-100 md:text-lg tracking-[-0.01em]">{title}</h2>
            {statusBadge}
          </div>
          {subtitle ? (
            <p className="mt-1 text-[12.5px] font-normal text-slate-500 dark:text-slate-400">{subtitle}</p>
          ) : (
            <p className="mt-1.5 text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-[0.08em] flex items-center gap-1.5 flex-wrap">
              Active Scope: 
              <span className="font-semibold text-brand-600 dark:text-brand-400 bg-brand-600/10 border border-brand-600/15 px-1.5 py-0.5 rounded-md text-[9.5px] uppercase tracking-wide">
                {isSuperAdmin ? 'Master Multi-Tenant Console' : 'Isolated Tenant'}
              </span>
            </p>
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-start lg:justify-end">
          {!hideUserBadge && email && (
            <div className="rounded-lg bg-slate-50 dark:bg-white/[0.04] px-3 py-1.5 border border-[#e4e7ec] dark:border-white/[0.08] text-[10px] font-mono text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">
              User: {email}
            </div>
          )}
          {children}
        </div>
      </div>

      {/* Notifications */}
      {actionMessage && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.08] p-3 text-xs font-medium text-emerald-700 dark:text-emerald-400 animate-slideDown flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          {actionMessage}
        </div>
      )}
      {actionError && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.08] p-3 text-xs font-medium text-red-700 dark:text-red-400 animate-slideDown flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008ZM12 3l9 16.5H3L12 3Z" />
          </svg>
          {actionError}
        </div>
      )}
    </div>
  );
}
