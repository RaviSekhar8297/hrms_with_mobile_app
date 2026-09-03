'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import DashboardPageHeader from '../components/DashboardPageHeader';
import { getHeaders, getUrl } from '../utils/api';
import { usePermissions } from '../hooks/usePermissions';
import { getDeviceIdentifier, getDeviceModel } from '../utils/deviceUtils';
import { useDashboard } from '../components/DashboardContext';

interface Company {
  id: string;
  name: string;
  subdomain: string;
  status: string;
  created_at: string;
}

interface Branch {
  id: string;
  name: string;
  address: string;
  status: string;
  created_at: string;
}

interface Employee {
  id: string;
  emp_id_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  status: string;
  joining_date: string;
  dob?: string;
  emp_image?: string;
  designation_name?: string;
  department_name?: string;
  branch_name?: string;
  shift_name?: string;
}

interface ActivityLog {
  id: string;
  user_email: string;
  action: string;
  module: string;
  details: any;
  ip_address: string;
  created_at: string;
}

const formatDetails = (details: any): string => {
  if (!details) return '';
  try {
    let parsed = details;
    if (typeof details === 'string') {
      if (details.startsWith('{') || details.startsWith('[')) {
        parsed = JSON.parse(details);
      } else {
        return details;
      }
    }
    if (typeof parsed === 'object' && parsed !== null) {
      if (parsed.message) return String(parsed.message);
      if (parsed.name) return `Name: ${parsed.name}`;
      if (parsed.email) return `Email: ${parsed.email}`;
      if (parsed.description) return String(parsed.description);

      const parts: string[] = [];
      if (parsed.roles && Array.isArray(parsed.roles)) {
        const cleanRoles = parsed.roles.filter(
          (r: string) => !r.startsWith('default-roles') && r !== 'offline_access' && r !== 'uma_authorization'
        );
        if (cleanRoles.length > 0) {
          parts.push(`Roles: ${cleanRoles.join(', ')}`);
        }
      }

      Object.keys(parsed).forEach(k => {
        if (k === 'roles' || k === 'login_at') return;
        const val = parsed[k];
        if (val !== undefined && val !== null) {
          parts.push(`${k}: ${typeof val === 'object' ? JSON.stringify(val) : val}`);
        }
      });

      return parts.length > 0 ? parts.join(' • ') : 'System Session Authenticated';
    }
    return String(parsed);
  } catch (e) {
    return String(details);
  }
};

export default function OverviewPage() {
  const { companyId: contextCompanyId, setCompanyId: setContextCompanyId } = useDashboard();
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const companyId = contextCompanyId || (typeof window !== 'undefined' ? localStorage.getItem('companyId') : null);

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [myProfile, setMyProfile] = useState<Employee | null>(null);

  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');

  const [auditSearch, setAuditSearch] = useState('');
  const [auditFilter, setAuditFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('superadmin');

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesModule = auditFilter === 'ALL' || (log.module || '').toUpperCase() === auditFilter;
      const searchLower = auditSearch.toLowerCase();
      const matchesSearch = !auditSearch || 
        (log.user_email || '').toLowerCase().includes(searchLower) ||
        (log.action || '').toLowerCase().includes(searchLower) ||
        (log.module || '').toLowerCase().includes(searchLower) ||
        (log.ip_address || '').toLowerCase().includes(searchLower) ||
        formatDetails(log.details).toLowerCase().includes(searchLower);
      return matchesModule && matchesSearch;
    });
  }, [logs, auditFilter, auditSearch]);

  useEffect(() => {
    const storedRoles = localStorage.getItem('roles');
    const storedEmail = localStorage.getItem('email');
    const storedCompanyId = localStorage.getItem('companyId');
    const storedProfile = localStorage.getItem('myProfile');
    if (storedRoles) setRoles(JSON.parse(storedRoles));
    if (storedEmail) setEmail(storedEmail);
    if (storedCompanyId) setContextCompanyId(storedCompanyId);
    if (storedProfile) {
      try { setMyProfile(JSON.parse(storedProfile)); } catch(e) {}
    }
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    setIsRefreshing(true);
    const startTime = Date.now();
    try {
      const res = await fetch(getUrl('/api/v1/auth/logs', companyId), { headers: getHeaders() });
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (e) { console.error(e); }
    
    const elapsedTime = Date.now() - startTime;
    const remainingTime = Math.max(0, 800 - elapsedTime);
    setTimeout(() => {
      setLoading(false);
      setIsRefreshing(false);
    }, remainingTime);
  };

  const fetchCompanies = async () => {
    try {
      const res = await fetch('/api/v1/companies', { headers: getHeaders() });
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        setCompanies(data.companies || []);
      }
    } catch (e) { console.error(e); }
  };

  const fetchBranches = async () => {
    try {
      const res = await fetch(getUrl('/api/v1/branches', companyId), { headers: getHeaders() });
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        setBranches(data.branches || []);
      }
    } catch (e) { console.error(e); }
  };

  const fetchMyProfile = async () => {
    try {
      const url = getUrl('/api/v1/employees/me');
      const res = await fetch(url, { headers: getHeaders() });
      if (!res.ok) {
        console.warn('📌 [Overview] /api/v1/employees/me non-200 status:', res.status);
        return;
      }
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.employee) {
          setMyProfile(data.employee);
          localStorage.setItem('myProfile', JSON.stringify(data.employee));
        }
      }
    } catch (e) {
      console.error('❌ [Overview] Error fetching my profile:', e);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await fetch(getUrl('/api/v1/employees', companyId), { headers: getHeaders() });
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        setEmployees(data.employees || []);
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      fetchCompanies();
    }
    fetchLogs();
    fetchBranches();
    fetchEmployees();
    fetchMyProfile();
  }, [companyId, isSuperAdmin]);

  const handleCompanyChange = (id: string) => {
    const val = id || null;
    setContextCompanyId(val);
  };

  if (!isSuperAdmin) {
    return (
      <EmployeeDashboard 
        employees={employees} 
        myProfile={myProfile}
        email={email} 
        actionMessage={actionMessage}
        actionError={actionError}
        companies={companies}
        companyId={companyId}
        handleCompanyChange={handleCompanyChange}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn w-full">
      {/* 🌌 SENIOR EXECUTIVE CONTROL CENTER HERO BANNER */}
      <div className="relative rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 md:p-8 shadow-xs overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6 group">
        <div className="absolute top-0 left-0 right-0 h-[3.5px] bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 opacity-90" />
        <div className="absolute -top-12 -right-12 w-80 h-80 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="space-y-2.5 text-left relative z-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-3.5 py-1 rounded-full border border-blue-200 dark:border-blue-900/40">
              Executive Control Console
            </span>
            <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-900 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Cluster Operational (99.98%)
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white font-outfit">
            Welcome back, SuperAdmin 👑
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl font-medium leading-relaxed">
            Logged in as <span className="font-extrabold text-blue-600 dark:text-blue-400">{email}</span>. Real-time multi-tenant database clusters, RBAC security matrix, and communication webhooks are active.
          </p>
        </div>
      </div>

      {/* ⚡ SENIOR UI/UX ADMINISTRATIVE OPERATIONS GRID */}
      <div className="space-y-3 text-left">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider font-outfit flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600" />
              Quick Administrative Operations
            </h3>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              Direct access to essential enterprise management modules and security controls
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Action Card 1: Staff Control */}
          <Link 
            href="/dashboard/employees" 
            className="group relative p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-500/80 dark:hover:border-blue-400 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg shadow-2xs flex flex-col justify-between overflow-hidden cursor-pointer"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="flex justify-between items-start">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-900/40 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-2xs">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <span className="text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-1 transition-all duration-300">
                →
              </span>
            </div>
            <div className="mt-4">
              <h4 className="font-extrabold text-sm text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                Staff Control & Directory
              </h4>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                Manage employee profiles, onboarding status & branch assignments.
              </p>
            </div>
          </Link>

          {/* Action Card 2: Access Policies */}
          <Link 
            href="/dashboard/roles" 
            className="group relative p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-500/80 dark:hover:border-indigo-400 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg shadow-2xs flex flex-col justify-between overflow-hidden cursor-pointer"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="flex justify-between items-start">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-900/40 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-2xs">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <span className="text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-1 transition-all duration-300">
                →
              </span>
            </div>
            <div className="mt-4">
              <h4 className="font-extrabold text-sm text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                Access & Security Policies
              </h4>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                Keycloak RBAC permission matrices & role management.
              </p>
            </div>
          </Link>

          {/* Action Card 3: Payroll Hub */}
          <Link 
            href="/dashboard/payroll" 
            className="group relative p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-500/80 dark:hover:border-emerald-400 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg shadow-2xs flex flex-col justify-between overflow-hidden cursor-pointer"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="flex justify-between items-start">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-900/40 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-2xs">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:translate-x-1 transition-all duration-300">
                →
              </span>
            </div>
            <div className="mt-4">
              <h4 className="font-extrabold text-sm text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                Payroll & Compensation
              </h4>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                Process salary structures, payslips, deductions & taxes.
              </p>
            </div>
          </Link>

          {/* Action Card 4: Company Configurations */}
          <Link 
            href="/dashboard/configuration" 
            className="group relative p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-violet-500/80 dark:hover:border-violet-400 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg shadow-2xs flex flex-col justify-between overflow-hidden cursor-pointer"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 to-fuchsia-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="flex justify-between items-start">
              <div className="w-12 h-12 rounded-2xl bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 border border-violet-200/80 dark:border-violet-900/40 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-2xs">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <span className="text-slate-400 group-hover:text-violet-600 dark:group-hover:text-violet-400 group-hover:translate-x-1 transition-all duration-300">
                →
              </span>
            </div>
            <div className="mt-4">
              <h4 className="font-extrabold text-sm text-slate-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                Company Configurations
              </h4>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                SMTP mailers, Meta WhatsApp API & automations.
              </p>
            </div>
          </Link>
        </div>
      </div>

      {/* 📊 KPI METRIC CARDS */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total Tenants */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xs relative overflow-hidden flex flex-col justify-between h-36 transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-blue-500 dark:hover:border-blue-400 cursor-pointer group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 opacity-90 group-hover:h-1.5 transition-all duration-300" />
          <div className="flex justify-between items-start z-10 text-left">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              Registered Tenants
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 transition-all duration-300 group-hover:scale-110 shadow-2xs border border-blue-200/80 dark:border-blue-900/40">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          </div>
          <div className="flex items-end justify-between z-10 mt-auto w-full text-left">
            <div>
              <h3 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white font-outfit leading-none">
                {companies.length}
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-extrabold uppercase tracking-wider mt-1.5">
                Active instances in network
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[9.5px] px-2.5 py-1 rounded-full font-black bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/40 shadow-2xs shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
              <span>Live Scope</span>
            </div>
          </div>
        </div>

        {/* Card 2: Office Branches */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xs relative overflow-hidden flex flex-col justify-between h-36 transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-emerald-500 dark:hover:border-emerald-400 cursor-pointer group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500 opacity-90 group-hover:h-1.5 transition-all duration-300" />
          <div className="flex justify-between items-start z-10 text-left">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
              Active Branches
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 transition-all duration-300 group-hover:scale-110 shadow-2xs border border-emerald-200/80 dark:border-emerald-900/40">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          </div>
          <div className="flex items-end justify-between z-10 mt-auto w-full text-left">
            <div>
              <h3 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white font-outfit leading-none">
                {branches.length}
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-extrabold uppercase tracking-wider mt-1.5">
                Operational divisions
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[9.5px] px-2.5 py-1 rounded-full font-black bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/40 shadow-2xs shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
              <span>Operational</span>
            </div>
          </div>
        </div>

        {/* Card 3: Total Employees (Workforce Headcount) */}
        <Link href="/dashboard/employees" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xs relative overflow-hidden flex flex-col justify-between h-36 transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-amber-500 dark:hover:border-amber-400 cursor-pointer group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500 opacity-90 group-hover:h-1.5 transition-all duration-300" />
          <div className="flex justify-between items-start z-10 text-left">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
              Workforce Headcount
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 transition-all duration-300 group-hover:scale-110 shadow-2xs border border-amber-200/80 dark:border-amber-900/40">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
          <div className="flex items-end justify-between z-10 mt-auto w-full text-left">
            <div>
              <h3 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white font-outfit leading-none">
                {employees.length}
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-extrabold uppercase tracking-wider mt-1.5">
                Onboarded profiles
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[9.5px] px-2.5 py-1 rounded-full font-black bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40 shadow-2xs shrink-0">
              <span className="text-[8.5px] leading-none mb-0.5">▲</span>
              <span>Active Staff</span>
            </div>
          </div>
        </Link>

        {/* Card 4: Security Events */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xs relative overflow-hidden flex flex-col justify-between h-36 transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-rose-500 dark:hover:border-rose-400 cursor-pointer group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-red-500 opacity-90 group-hover:h-1.5 transition-all duration-300" />
          <div className="flex justify-between items-start z-10 text-left">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-400 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
              Security Events
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 transition-all duration-300 group-hover:scale-110 shadow-2xs border border-rose-200/80 dark:border-rose-900/40">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
          </div>
          <div className="flex items-end justify-between z-10 mt-auto w-full text-left">
            <div>
              <h3 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white font-outfit leading-none">
                {logs.length}
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-extrabold uppercase tracking-wider mt-1.5">
                Real-time audit logs
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[9.5px] px-2.5 py-1 rounded-full font-black bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/40 shadow-2xs shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-pulse" />
              <span>Live Audit</span>
            </div>
          </div>
        </div>
      </div>

      {/* 📜 REAL-TIME AUDIT LOGS - PROFESSIONAL AUDIT TRAIL */}
      <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-xs flex flex-col relative overflow-hidden text-left gap-5">
        
        {/* TOP TOOLBAR: TITLE + METRICS + SEARCH + VIEW SWITCHER + REFRESH */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-5 border-b border-slate-100 dark:border-slate-800 gap-4 shrink-0">
          
          {/* LEFT: TITLE & LIVE BADGE */}
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2.5 font-outfit">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span>Real-Time Audit Trail</span>
            </h3>

            {/* STATUS COUNTERS */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-[11px] font-bold tracking-wide border border-slate-200/80 dark:border-slate-700 flex items-center gap-1.5 shadow-2xs">
                Total: <span className="font-mono text-slate-900 dark:text-white font-black">{logs.length}</span>
              </span>

              <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-lg text-[11px] font-bold tracking-wide border border-emerald-200/80 dark:border-emerald-900/50 flex items-center gap-1.5 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Success: <span className="font-mono font-black">{logs.filter(l => l.action.includes('SUCCESS') || l.action.includes('REGISTER') || l.action.includes('CREATE') || l.action.includes('RELEASE')).length}</span>
              </span>

              <span className="px-2.5 py-1 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 rounded-lg text-[11px] font-bold tracking-wide border border-rose-200/80 dark:border-rose-900/50 flex items-center gap-1.5 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                Warn / Fail: <span className="font-mono font-black">{logs.filter(l => l.action.includes('FAILED') || l.action.includes('FAIL') || l.action.includes('ERROR') || l.action.includes('DELETE') || l.action.includes('REMOVE')).length}</span>
              </span>
            </div>
          </div>

          {/* RIGHT: SEARCH + MODULE FILTER + VIEW TOGGLE + REFRESH */}
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-56">
              <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                placeholder="Search email, IP, action..."
                value={auditSearch}
                onChange={e => setAuditSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
              />
              {auditSearch && (
                <button onClick={() => setAuditSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">✕</button>
              )}
            </div>

            {/* Module Filter Pills */}
            <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] font-bold">
              {['ALL', 'AUTH', 'EMPLOYEE', 'COMPANY'].map(mod => (
                <button
                  key={mod}
                  onClick={() => setAuditFilter(mod)}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    auditFilter === mod
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-2xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {mod}
                </button>
              ))}
            </div>

            {/* View Mode Switcher (Grid vs Table) */}
            <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] font-bold shrink-0">
              <button
                onClick={() => setViewMode('grid')}
                title="Grid Cards View"
                className={`p-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-2xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('table')}
                title="Table Stream View"
                className={`p-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-2xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </button>
            </div>

            {/* Refresh Button */}
            <button
              onClick={fetchLogs}
              disabled={isRefreshing}
              title="Refresh Audit logs"
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 transition-all cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50 flex items-center justify-center bg-white dark:bg-slate-800 shrink-0"
            >
              <svg className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* LOGS DISPLAY CONTAINER */}
        <div className="flex-1 overflow-x-auto overflow-y-auto max-h-[540px] pr-1">
          {loading && logs.length === 0 ? (
            <div className="flex py-16 flex-col items-center justify-center space-y-3">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Syncing activity logs...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex py-16 flex-col items-center justify-center select-none text-slate-400 dark:text-slate-600 space-y-2">
              <span className="text-3xl">📜</span>
              <p className="text-xs font-bold uppercase tracking-wider">
                {logs.length === 0 ? 'No audit trail logs recorded' : 'No logs match your filter'}
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            /* 1. CARDS GRID VIEW - CRISP LIGHT BORDER & SUBTLE SHADOW */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-1">
              {filteredLogs.map(log => {
                const isSuccess = log.action.includes('SUCCESS') || log.action.includes('REGISTER') || log.action.includes('CREATE') || log.action.includes('RELEASE');
                const isDelete = log.action.includes('DELETE') || log.action.includes('REMOVE') || log.action.includes('FAIL') || log.action.includes('FAILED');
                
                const initial = (log.user_email || 'U').charAt(0).toUpperCase();
                const detailsText = formatDetails(log.details);
                const dateObj = new Date(log.created_at);
                const formattedTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

                return (
                  <div
                    key={log.id}
                    className="p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700/80 transition-all duration-200 flex flex-col justify-between gap-3 text-left group"
                  >
                    {/* Top Row: Module Badge + Action Status Badge */}
                    <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] font-black px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md border border-slate-200 dark:border-slate-700 uppercase tracking-wide truncate">
                        {log.module}
                      </span>

                      <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-md tracking-wide border shrink-0 ${
                        isSuccess
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60'
                          : isDelete
                          ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-900/60'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-900/60'
                      }`}>
                        {log.action}
                      </span>
                    </div>

                    {/* User Email & Avatar */}
                    <div className="flex items-center gap-2.5 min-w-0 my-0.5">
                      <div className="w-6.5 h-6.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-black text-[11px] flex items-center justify-center shrink-0 border border-indigo-200 dark:border-indigo-900">
                        {initial}
                      </div>
                      <h5 className="font-extrabold text-slate-800 dark:text-slate-100 truncate text-xs" title={log.user_email}>
                        {log.user_email}
                      </h5>
                    </div>

                    {/* Activity Message Card Box */}
                    <div className="bg-slate-50/80 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                      <p className="text-[11.5px] text-slate-600 dark:text-slate-300 font-normal line-clamp-2 leading-relaxed" title={detailsText}>
                        {detailsText || 'System Action Authenticated'}
                      </p>
                    </div>

                    {/* Bottom Row: Timestamp & IP Address */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10.5px] text-slate-500 dark:text-slate-400 font-medium mt-auto">
                      <span className="flex items-center gap-1 font-bold text-slate-500">
                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {formattedTime}
                      </span>
                      <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 font-bold">
                        {log.ip_address || '127.0.0.1'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* 2. TABLE STREAM VIEW */
            <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-900/50 overflow-hidden">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800/60 text-[10.5px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider sticky top-0 backdrop-blur-md z-10">
                    <th className="py-3 px-4 w-36">Time</th>
                    <th className="py-3 px-4 w-52">Actor / User</th>
                    <th className="py-3 px-4 w-44">Module & Action</th>
                    <th className="py-3 px-4">Activity Description</th>
                    <th className="py-3 px-4 w-32 text-right">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                  {filteredLogs.map(log => {
                    const isSuccess = log.action.includes('SUCCESS') || log.action.includes('REGISTER') || log.action.includes('CREATE') || log.action.includes('RELEASE');
                    const isDelete = log.action.includes('DELETE') || log.action.includes('REMOVE') || log.action.includes('FAIL') || log.action.includes('FAILED');
                    
                    const initial = (log.user_email || 'U').charAt(0).toUpperCase();
                    const detailsText = formatDetails(log.details);
                    const dateObj = new Date(log.created_at);
                    const formattedTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
                    const formattedDate = dateObj.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });

                    return (
                      <tr 
                        key={log.id} 
                        className="hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors duration-150 group"
                      >
                        <td className="py-3 px-4 whitespace-nowrap text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                          <div className="font-semibold text-slate-700 dark:text-slate-300">{formattedTime}</div>
                          <div className="text-[9.5px] text-slate-400 dark:text-slate-500 font-medium">{formattedDate}</div>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-black text-xs flex items-center justify-center shrink-0 border border-indigo-200/80 dark:border-indigo-900/60">
                              {initial}
                            </div>
                            <span className="font-semibold text-slate-900 dark:text-slate-100 truncate text-xs" title={log.user_email}>
                              {log.user_email}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md uppercase tracking-wide border border-slate-300/50 dark:border-slate-700">
                              {log.module}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md tracking-wide border ${
                              isSuccess
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-900/50'
                                : isDelete
                                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200/80 dark:border-rose-900/50'
                                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200/80 dark:border-amber-900/50'
                            }`}>
                              {log.action}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <p className="text-slate-700 dark:text-slate-300 font-normal line-clamp-1 max-w-md" title={detailsText}>
                            {detailsText || 'System Action Authenticated'}
                          </p>
                        </td>

                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <span className="font-mono text-[10.5px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 inline-flex items-center gap-1">
                            <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                            {log.ip_address || '127.0.0.1'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// 🖥️ HIGH-FIDELITY EMPLOYEE DASHBOARD COMPONENT
// -------------------------------------------------------------
function EmployeeDashboard({
  employees,
  myProfile,
  email,
  actionMessage: _actionMessage,
  actionError: _actionError,
  companies: _companies,
  companyId,
  handleCompanyChange: _handleCompanyChange
}: {
  employees: Employee[];
  myProfile?: Employee | null;
  email: string;
  actionMessage: string;
  actionError: string;
  companies: Company[];
  companyId: string | null;
  handleCompanyChange: (id: string) => void;
}) {
  const { hasPermission } = usePermissions();
  const canViewAttendance = hasPermission('view_attendance');

  const rolesStr = typeof window !== 'undefined' ? localStorage.getItem('roles') : null;
  const roles: string[] = rolesStr ? JSON.parse(rolesStr) : [];
  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('superadmin');

  const [time, setTime] = useState<Date | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState<string | null>(null);

  const [holidays, setHolidays] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [_regularizations, setRegularizations] = useState<any[]>([]);
  const [_permissions, setPermissions] = useState<any[]>([]);
  const [_dataLoading, setDataLoading] = useState(false);

  // Calendar state for My Attendance Calendar
  const [currentDate, setCurrentDate] = useState(new Date(2026, 6, 1)); // Default July 2026

  useEffect(() => {
    const fetchData = async () => {
      setDataLoading(true);
      try {
        const headers = getHeaders();
        const holRes = await fetch(getUrl('/api/v1/holidays', companyId), { headers });
        if (holRes.ok) {
          const d = await holRes.json();
          setHolidays(d.holidays || []);
        }

        const leaveRes = await fetch(getUrl('/api/v1/leave-requests', companyId), { headers });
        if (leaveRes.ok) {
          const d = await leaveRes.json();
          setLeaveRequests(d.requests || []);
        }

        const regRes = await fetch(getUrl('/api/v1/attendance/regularizations', companyId), { headers });
        if (regRes.ok) {
          const d = await regRes.json();
          setRegularizations(d.regularizations || []);
        }

        const permRes = await fetch(getUrl('/api/v1/attendance/permissions', companyId), { headers });
        if (permRes.ok) {
          const d = await permRes.json();
          setPermissions(d.permissions || []);
        }
      } catch (e) {
        console.error('Error fetching employee dashboard stats:', e);
      } finally {
        setDataLoading(false);
      }
    };

    fetchData();
  }, [companyId]);

  useEffect(() => {
    setTime(new Date());
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const [punching, setPunching] = useState(false);
  const [punchMsg, setPunchMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [firstInTimestamp, setFirstInTimestamp] = useState<Date | null>(null);
  const [accumulatedPastSeconds, setAccumulatedPastSeconds] = useState<number>(0);
  const [currentInTimestamp, setCurrentInTimestamp] = useState<Date | null>(null);
  const [elapsedWorkingSeconds, setElapsedWorkingSeconds] = useState<number>(0);
  const [todayLocationName, setTodayLocationName] = useState<string | null>(null);

  // 📸 Mark Attendance Modal State in Overview page
  const [punchModalOpen, setPunchModalOpen] = useState(false);
  const [punchDirection, setPunchDirection] = useState<'IN' | 'OUT'>('IN');
  const [punchLat, setPunchLat] = useState<number | null>(null);
  const [punchLng, setPunchLng] = useState<number | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [capturedSelfie, setCapturedSelfie] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isSubmittingPunch, setIsSubmittingPunch] = useState(false);
  const [modalPunchMsg, setModalPunchMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchAddressName = async (lat: number, lng: number) => {
    try {
      setLocationName('Locating address...');
      const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyCN9htaexjSDWMVybqWtlSl1ygNpZWkobg';
      if (googleApiKey) {
        const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googleApiKey}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.results && data.results.length > 0) {
            setLocationName(data.results[0].formatted_address);
            setTodayLocationName(data.results[0].formatted_address);
            return;
          }
        }
      }
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=en`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.display_name) {
          setLocationName(data.display_name);
          setTodayLocationName(data.display_name);
          return;
        }
      }
    } catch (e) {
      console.warn('Reverse geocode error:', e);
    }
    setLocationName(`Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`);
  };

  const startCamera = async () => {
    try {
      setCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setGpsError('Could not access webcam for selfie verification.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const captureSelfie = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedSelfie(dataUrl);
        stopCamera();
      }
    }
  };

  const fetchIPLocationFallback = async () => {
    try {
      const res = await fetch('https://ipapi.co/json/');
      if (res.ok) {
        const data = await res.json();
        if (data && data.latitude && data.longitude) {
          setPunchLat(data.latitude);
          setPunchLng(data.longitude);
          const cityState = [data.city, data.region, data.country_name].filter(Boolean).join(', ');
          setLocationName(cityState || 'Location Detected (Network)');
          setTodayLocationName(cityState || 'Location Detected (Network)');
          setGpsError(null);
          return true;
        }
      }
    } catch (e) {}
    return false;
  };

  const getGPSLocation = () => {
    setGpsLoading(true);
    setGpsError(null);
    setLocationName('Detecting live location...');

    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPunchLat(pos.coords.latitude);
          setPunchLng(pos.coords.longitude);
          fetchAddressName(pos.coords.latitude, pos.coords.longitude);
          setGpsLoading(false);
        },
        async () => {
          const success = await fetchIPLocationFallback();
          if (!success) {
            setGpsError('Unable to retrieve location. Please allow browser location permissions or click Re-detect GPS.');
          }
          setGpsLoading(false);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      fetchIPLocationFallback().then((success) => {
        if (!success) {
          setGpsError('Geolocation is not supported by your browser.');
        }
        setGpsLoading(false);
      });
    }
  };

  const openMarkAttendanceModal = () => {
    const nextDirection = checkedIn ? 'OUT' : 'IN';
    setPunchDirection(nextDirection);
    setPunchModalOpen(true);
    getGPSLocation();
    startCamera();
  };

  const submitWebPunch = async () => {
    setIsSubmittingPunch(true);
    setModalPunchMsg(null);
    try {
      const targetEmpId = me?.id || localStorage.getItem('employeeId') || '';
      const cid = localStorage.getItem('companyId') || companyId;

      const d = new Date();
      const tzOffset = -d.getTimezoneOffset();
      const diff = tzOffset >= 0 ? '+' : '-';
      const pad = (num: number) => String(Math.floor(Math.abs(num))).padStart(2, '0');
      const localIso = d.getFullYear() +
        '-' + pad(d.getMonth() + 1) +
        '-' + pad(d.getDate()) +
        'T' + pad(d.getHours()) +
        ':' + pad(d.getMinutes()) +
        ':' + pad(d.getSeconds()) +
        diff + pad(tzOffset / 60) + ':' + pad(tzOffset % 60);

      const isMobileDevice = typeof window !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
      const punchSource = isMobileDevice ? 'MOBILE' : 'WEB';

      const body = {
        companyId: cid,
        employee_id: targetEmpId,
        punch_time: localIso,
        direction: punchDirection,
        source: punchSource,
        latitude: punchLat,
        longitude: punchLng,
        image_url: capturedSelfie,
        location_name: locationName,
        device_identifier: getDeviceIdentifier(),
        device_model: getDeviceModel(),
      };

      const res = await fetch('/api/v1/attendance/punches', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (res.ok) {
        setModalPunchMsg({ type: 'success', text: `Punch ${punchDirection} recorded successfully!` });
        const nextState = punchDirection === 'IN';
        setCheckedIn(nextState);
        setTimeout(() => {
          setPunchModalOpen(false);
          stopCamera();
          window.location.reload();
        }, 1000);
      } else {
        setModalPunchMsg({ type: 'error', text: data.error || 'Failed to record punch' });
      }
    } catch (err: any) {
      setModalPunchMsg({ type: 'error', text: err?.message || 'Network error submitting punch' });
    } finally {
      setIsSubmittingPunch(false);
    }
  };

  // Fetch today's actual punch status and calculate interval-based working hours
  useEffect(() => {
    const fetchTodayPunchStatus = async () => {
      try {
        const headers = getHeaders();
        const res = await fetch('/api/v1/attendance/punches', { headers });
        if (res.ok) {
          const data = await res.json();
          const punches = data.punches || [];
          setAllPunches(punches);
          const todayStr = new Date().toISOString().split('T')[0];
          const todayPunches = punches.filter((p: any) => String(p.punch_time).startsWith(todayStr));
          
          if (todayPunches.length > 0) {
            const sortedPunches = [...todayPunches].sort((a: any, b: any) => new Date(a.punch_time).getTime() - new Date(b.punch_time).getTime());
            
            let totalPastSecs = 0;
            let activeInDate: Date | null = null;
            let firstInDate: Date | null = null;

            for (const p of sortedPunches) {
              const pDate = new Date(p.punch_time);
              if (p.direction === 'IN') {
                if (!firstInDate) firstInDate = pDate;
                activeInDate = pDate;
              } else if (p.direction === 'OUT' && activeInDate) {
                const durationSecs = Math.max(0, Math.floor((pDate.getTime() - activeInDate.getTime()) / 1000));
                totalPastSecs += durationSecs;
                activeInDate = null;
              }
            }

            setAccumulatedPastSeconds(totalPastSecs);
            setCurrentInTimestamp(activeInDate);
            setCheckedIn(!!activeInDate);

            if (firstInDate) {
              setFirstInTimestamp(firstInDate);
              setCheckInTime(firstInDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }));
            }

            const lastPunchWithLoc = [...sortedPunches].reverse().find((p: any) => p.location_name || (p.latitude && p.longitude));
            if (lastPunchWithLoc) {
              if (lastPunchWithLoc.location_name) {
                setTodayLocationName(lastPunchWithLoc.location_name);
              } else if (lastPunchWithLoc.latitude && lastPunchWithLoc.longitude) {
                fetchAddressName(lastPunchWithLoc.latitude, lastPunchWithLoc.longitude);
              }
            }
          } else {
            setCheckedIn(false);
            setAccumulatedPastSeconds(0);
            setCurrentInTimestamp(null);
            setFirstInTimestamp(null);
          }
        }
      } catch (e) {}
    };
    fetchTodayPunchStatus();
  }, [companyId]);

  // Live timer tick for working hours (Accumulated past sessions + current session)
  useEffect(() => {
    const updateElapsed = () => {
      let currentSessionSecs = 0;
      if (currentInTimestamp) {
        const now = new Date();
        currentSessionSecs = Math.max(0, Math.floor((now.getTime() - currentInTimestamp.getTime()) / 1000));
      }
      setElapsedWorkingSeconds(accumulatedPastSeconds + currentSessionSecs);
    };

    updateElapsed();

    if (currentInTimestamp) {
      const interval = setInterval(updateElapsed, 1000);
      return () => clearInterval(interval);
    }
  }, [accumulatedPastSeconds, currentInTimestamp]);

  const formatWorkingHours = (totalSecs: number) => {
    if (!totalSecs || totalSecs <= 0) return '00h 00m 00s';
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${String(hrs).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
  };

  const getGreeting = () => {
    if (!time) return 'Good Morning,';
    const hrs = time.getHours();
    if (hrs < 12) return 'Good Morning,';
    if (hrs < 17) return 'Good Afternoon,';
    return 'Good Evening,';
  };

  const me = myProfile || employees.find(emp => emp.email?.toLowerCase() === email.toLowerCase());
  const displayName = me ? `${me.first_name} ${me.last_name}` : email.split('@')[0];

  const getBirthdaysToday = () => {
    const today = new Date();
    const currentMonth = today.getMonth(); // 0-indexed
    const currentDate = today.getDate(); // 1-indexed
    
    return employees
      .filter(emp => {
        if (!emp.dob) return false;
        const parts = emp.dob.split('T')[0].split('-');
        if (parts.length < 3) return false;
        const dobMonth = parseInt(parts[1], 10) - 1;
        const dobDate = parseInt(parts[2], 10);
        return dobMonth === currentMonth && dobDate === currentDate;
      })
      .map(emp => ({
        name: `${emp.first_name} ${emp.last_name}`,
        designation: emp.designation_name || 'Engineering',
        image: emp.emp_image,
      }));
  };

  const getAnniversariesToday = () => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentDate = today.getDate();
    
    return employees
      .filter(emp => {
        if (!emp.joining_date) return false;
        const parts = emp.joining_date.split('T')[0].split('-');
        if (parts.length < 3) return false;
        const joinMonth = parseInt(parts[1], 10) - 1;
        const joinDate = parseInt(parts[2], 10);
        const joinYear = parseInt(parts[0], 10);
        const years = today.getFullYear() - joinYear;
        return joinMonth === currentMonth && joinDate === currentDate && years >= 1;
      })
      .map(emp => {
        const parts = emp.joining_date.split('T')[0].split('-');
        const joinYear = parseInt(parts[0], 10);
        const years = today.getFullYear() - joinYear;
        return {
          name: `${emp.first_name} ${emp.last_name}`,
          years: years > 0 ? years : 1,
          designation: emp.designation_name || 'Sales & Marketing',
          image: emp.emp_image,
        };
      });
  };

  const [allPunches, setAllPunches] = useState<any[]>([]);

  // Month Calendar Days Generator
  const getCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const days = [];

    // Previous month filler
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ day: prevMonthDays - i, isCurrentMonth: false, status: 'none' });
    }

    const today = new Date();

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      const dayOfWeek = dateObj.getDay();
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      
      const dayPunches = allPunches.filter((p: any) => String(p.punch_time).startsWith(dateStr));
      const hasInPunch = dayPunches.some((p: any) => p.direction === 'IN');
      const isLeave = leaveRequests.some((lr: any) => {
        const f = String(lr.start_date || lr.from_date || '').split('T')[0];
        const t = String(lr.end_date || lr.to_date || f).split('T')[0];
        return dateStr >= f && dateStr <= t && (lr.status === 'APPROVED' || lr.status === 'PENDING');
      });

      let status = 'none';

      if (dayOfWeek === 0 || dayOfWeek === 6) {
        status = 'weekend';
      } else if (hasInPunch) {
        status = 'present';
      } else if (isLeave) {
        status = 'leave';
      } else if (dateObj < today) {
        status = 'absent';
      }

      days.push({ day: d, isCurrentMonth: true, status });
    }

    // Next month filler
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      days.push({ day: i, isCurrentMonth: false, status: 'none' });
    }

    return days;
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <div className="space-y-6 animate-fadeIn w-full pb-16 font-sans text-slate-800 dark:text-slate-100">
      
      {/* ── ROW 1: TOP SECTION: GREETING BANNER & TODAY'S ATTENDANCE PUNCH ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
        
        {/* Left 2 Cols: Good Morning Banner (LIGHT THEME FOR NON-SUPERADMIN) */}
        <div className="lg:col-span-2 rounded-3xl border border-indigo-100 dark:border-slate-800 bg-gradient-to-br from-indigo-50/90 via-purple-50/80 to-blue-50/70 dark:bg-slate-900 p-6 md:p-8 relative overflow-hidden flex flex-col justify-between shadow-xs text-slate-800 dark:text-slate-100 group transition-all duration-300">
          
          {/* Background blur rings */}
          <div className="absolute right-0 top-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600" />
          
          <div className="flex justify-between items-start gap-4 z-10">
            <div className="space-y-2 text-left">
              <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-600/10 text-indigo-700 dark:text-indigo-300 text-xs font-black uppercase tracking-widest border border-indigo-200/80 dark:border-indigo-800/50 shadow-2xs">
                {getGreeting()} <span className="animate-float-emoji inline-block text-sm">👋</span>
              </span>
              <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tight font-outfit mt-3">
                {displayName.toUpperCase()}
              </h1>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold leading-relaxed max-w-md pt-1">
                Welcome back to your workspace. Have a highly productive and successful day ahead!
              </p>
            </div>
          </div>

          {/* Bottom Branch, Department & Designation Chips */}
          <div className="flex flex-wrap items-center gap-3 mt-6 pt-2 z-10">
            {/* Branch */}
            <span className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20 shadow-2xs text-xs font-bold">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center text-sm">📍</span>
              <span>
                Branch: <strong className="font-black uppercase text-slate-900 dark:text-white tracking-wider">{me?.branch_name || 'Main Branch'}</strong>
              </span>
            </span>

            {/* Department */}
            <span className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-blue-500/10 text-blue-800 dark:text-blue-300 border border-blue-500/20 shadow-2xs text-xs font-bold">
              <span className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center text-sm">🏢</span>
              <span>
                Department: <strong className="font-black uppercase text-slate-900 dark:text-white tracking-wider">{me?.department_name || 'Pending'}</strong>
              </span>
            </span>

            {/* Designation */}
            <span className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-purple-500/10 text-purple-800 dark:text-purple-300 border border-purple-500/20 shadow-2xs text-xs font-bold">
              <span className="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center text-sm">💼</span>
              <span>
                Designation: <strong className="font-black uppercase text-slate-900 dark:text-white tracking-wider">{me?.designation_name || 'Pending'}</strong>
              </span>
            </span>
          </div>
        </div>

        {/* Right 1 Col: Today's Attendance Punch Card */}
        <div className="rounded-3xl border border-indigo-100 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-6 shadow-lg shadow-indigo-950/5 flex flex-col justify-between text-left transition-all duration-300 hover:shadow-xl hover:border-indigo-200 dark:hover:border-indigo-900/50 group">
          <div>
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                TODAY'S ATTENDANCE
              </span>
              <span className={`text-[10px] font-black px-3 py-1 rounded-full border uppercase tracking-wider flex items-center gap-1.5 shadow-xs ${
                checkedIn
                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-400'
                  : 'bg-amber-500/10 text-amber-600 border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-400'
              }`}>
                <span className={`w-2 h-2 rounded-full ${checkedIn ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                {checkedIn ? 'CHECKED IN' : 'CHECKED OUT'}
              </span>
            </div>

            <div className="flex items-center justify-between my-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                  WORKING HOURS TODAY
                </p>
                <div className="flex items-baseline gap-1 mt-1.5">
                  <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight font-mono" style={{ fontFamily: "'DM Sans', monospace" }}>
                    {checkedIn ? formatWorkingHours(elapsedWorkingSeconds) : '00h 00m 00s'}
                  </span>
                </div>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1">
                  <span>Shift:</span> <strong className="font-extrabold text-slate-800 dark:text-slate-200">{me?.shift_name || 'Standard Day Shift (09:30 AM - 06:30 PM)'}</strong>
                </p>
                {todayLocationName && (
                  <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                    <span>📍 Location:</span> <strong className="font-bold">{todayLocationName}</strong>
                  </p>
                )}
              </div>

              {/* Fingerprint Graphic */}
              <div className="w-15 h-15 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-blue-500/10 dark:from-indigo-500/20 dark:to-blue-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center shadow-md shrink-0 group-hover:scale-105 transition-transform duration-300">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 004 11c0 1.341.17 2.643.49 3.882" />
                </svg>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            {punchMsg && (
              <div className={`p-2.5 rounded-xl text-[11px] font-extrabold flex items-center justify-between border shadow-2xs ${
                punchMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}>
                <span>{punchMsg.text}</span>
                <button onClick={() => setPunchMsg(null)} className="text-xs font-bold px-1 cursor-pointer">&times;</button>
              </div>
            )}
            <div className="flex items-center gap-3">
              {isSuperAdmin ? (
                <div className="flex-1 py-3 px-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-[11px] font-extrabold flex items-center justify-center gap-2">
                  <span>👑</span>
                  <span>SuperAdmin Accounts Are Exempt From Attendance Punching</span>
                </div>
              ) : (
                <button
                  onClick={openMarkAttendanceModal}
                  disabled={punching}
                  className={`flex-1 py-3 px-5 rounded-2xl text-[11px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer active:scale-95 flex items-center justify-center gap-2 shadow-md disabled:opacity-60 ${
                    checkedIn
                      ? 'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white shadow-rose-500/20'
                      : 'bg-gradient-to-r from-indigo-600 via-indigo-650 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-indigo-500/25'
                  }`}
                >
                  {punching ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Punching...
                    </span>
                  ) : (
                    <span>{checkedIn ? 'CHECK-OUT NOW' : 'PUNCH CHECK-IN'}</span>
                  )}
                </button>
              )}

              {canViewAttendance && (
                <Link
                  href="/dashboard/attendance"
                  className="py-3 px-4 rounded-2xl text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all text-center flex items-center justify-center shadow-xs"
                >
                  TIMELINE
                </Link>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* ── ROW 2: 4 METRIC CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Today's Shift */}
        <div className="rounded-3xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-emerald-500/40 group">
          <div className="flex items-center justify-between">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center text-xl shadow-2xs group-hover:scale-110 transition-transform">
              📅
            </div>
            <span className="text-[10px] font-black px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/25 dark:text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
              In Progress
            </span>
          </div>

          <div className="mt-4">
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Today's Shift</p>
            <h4 className="text-lg font-extrabold text-slate-900 dark:text-white mt-1 font-outfit">
              09:00 AM - 06:00 PM
            </h4>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] font-semibold text-slate-500 flex items-center justify-between">
            <span>Shift Type:</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-extrabold bg-emerald-500/10 px-2.5 py-0.5 rounded-lg">{me?.shift_name || 'General Shift'}</span>
          </div>
        </div>

        {/* Card 2: Working Hours Today */}
        <div className="rounded-3xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-blue-500/40 group">
          <div className="flex items-center justify-between">
            <div className="w-11 h-11 rounded-2xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center text-xl shadow-2xs group-hover:scale-110 transition-transform">
              🕒
            </div>
            <span className="text-[10px] font-black px-3 py-1 rounded-full bg-blue-500/15 text-blue-600 dark:bg-blue-500/25 dark:text-blue-400 border border-blue-500/30 uppercase tracking-wider">
              Live Tracker
            </span>
          </div>

          <div className="mt-4">
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Working Hours Today</p>
            <h4 className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white mt-1" style={{ fontFamily: "'DM Sans', monospace" }}>
              {checkedIn && checkInTime ? '03h 42m 10s' : '00h 00m 00s'}
            </h4>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] font-semibold text-slate-500 flex items-center justify-between">
            <span>Break Time:</span>
            <span className="font-mono text-blue-600 dark:text-blue-400 font-extrabold bg-blue-500/10 px-2.5 py-0.5 rounded-lg">00h 00m</span>
          </div>
        </div>

        {/* Card 3: Leave Balance */}
        <div className="rounded-3xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-purple-500/40 group">
          <div className="flex items-center justify-between">
            <div className="w-11 h-11 rounded-2xl bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center text-xl shadow-2xs group-hover:scale-110 transition-transform">
              ☂️
            </div>
            <span className="text-[10px] font-black px-3 py-1 rounded-full bg-purple-500/15 text-purple-600 dark:bg-purple-500/25 dark:text-purple-400 border border-purple-500/30 uppercase tracking-wider">
              Quota
            </span>
          </div>

          <div className="mt-4">
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Leave Balance</p>
            <h4 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1 font-outfit">
              12 <span className="text-xs font-bold text-slate-500">Days</span>
            </h4>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[10.5px] font-bold text-slate-500 flex items-center justify-between gap-1">
            <span className="bg-purple-500/10 text-purple-600 dark:text-purple-300 px-2 py-0.5 rounded-md">Casual: <strong>6</strong></span>
            <span className="bg-purple-500/10 text-purple-600 dark:text-purple-300 px-2 py-0.5 rounded-md">Sick: <strong>4</strong></span>
            <span className="bg-purple-500/10 text-purple-600 dark:text-purple-300 px-2 py-0.5 rounded-md">Annual: <strong>2</strong></span>
          </div>
        </div>

        {/* Card 4: Attendance (This Month) */}
        <div className="rounded-3xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex items-center justify-between text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-amber-500/40 group">
          <div className="flex-1">
            <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">Attendance (This Month)</p>
            <h4 className="text-3xl font-black text-slate-900 dark:text-white mt-1 font-outfit">
              96%
            </h4>
            <p className="text-[11px] font-semibold text-slate-500 mt-2 flex items-center gap-2">
              <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">Present: 21</span>
              <span>•</span>
              <span className="text-rose-600 dark:text-rose-400 font-extrabold">Absent: 1</span>
            </p>
          </div>

          {/* Progress Ring */}
          <div className="relative w-15 h-15 shrink-0 flex items-center justify-center ml-2 group-hover:scale-105 transition-transform">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <path className="text-slate-100 dark:text-slate-800" strokeWidth="4" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <path className="text-amber-500" strokeDasharray="96, 100" strokeWidth="4" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            </svg>
            <span className="absolute text-[11px] font-black text-slate-900 dark:text-white">96%</span>
          </div>
        </div>

      </div>

      {/* ── ROW 3: QUICK ACCESS (Full Single Row Layout) ── */}
      <div className="rounded-3xl border border-slate-200/60 dark:border-slate-800 bg-card p-6 shadow-sm text-left transition-all duration-300 hover:shadow-md">
        <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100 dark:border-slate-800/60">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Quick Access Hub
          </h3>
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Shortcuts
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3.5">
          {[
            { label: 'Leave', icon: '🌴', href: '/dashboard/leaves', bg: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-500/20' },
            { label: 'Payslip', icon: '📄', href: '/dashboard/payslip', bg: 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border-blue-500/20' },
            { label: 'Attendance', icon: '⏱️', href: '/dashboard/attendance', bg: 'bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 border-purple-500/20' },
            { label: 'Reports', icon: '📊', href: '/dashboard/analytics', bg: 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border-amber-500/20' },
            { label: 'Docs', icon: '📂', href: '/dashboard/profile', bg: 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 border-indigo-500/20' },
            { label: 'Notice', icon: '📢', href: '/dashboard/overview', bg: 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 border-rose-500/20' },
            { label: 'Holidays', icon: '🏖️', href: '/dashboard/holidays', bg: 'bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400 border-teal-500/20' },
            { label: 'Help', icon: '🎧', href: '/dashboard/overview', bg: 'bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400 border-cyan-500/20' },
          ].map((item, idx) => (
            <Link
              key={idx}
              href={item.href}
              className="flex flex-col items-center justify-center p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:-translate-y-1 hover:shadow-md hover:border-indigo-500/30 transition-all duration-200 group cursor-pointer"
            >
              <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center text-xl group-hover:scale-110 transition-all duration-200 mb-2.5 shadow-2xs ${item.bg}`}>
                {item.icon}
              </div>
              <span className="text-[11.5px] font-black text-slate-700 dark:text-slate-200 group-hover:text-indigo-650 dark:group-hover:text-indigo-400 text-center truncate w-full tracking-wide">
                {item.label}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* ── ROW 4: MY ATTENDANCE CALENDAR & MY LEAVE STATUS (2 COLUMNS) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        
        {/* Left: My Attendance Calendar (7 cols) */}
        <div className="lg:col-span-7 rounded-3xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm text-left flex flex-col justify-between transition-all duration-300 hover:shadow-md">
          <div>
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5 pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center text-lg font-bold shadow-2xs">
                  📅
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-200 font-outfit">
                    MY ATTENDANCE CALENDAR
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">Track daily status & leave history</p>
                </div>
              </div>

              {/* Single Unified Month & Year Selection Control (Past & Current Months Only) */}
              {(() => {
                const realNow = new Date();
                const currentRealMonth = realNow.getMonth();
                const currentRealYear = realNow.getFullYear();

                const isMaxMonth = currentDate.getFullYear() > currentRealYear || 
                  (currentDate.getFullYear() === currentRealYear && currentDate.getMonth() >= currentRealMonth);

                const monthYearOptions: Array<{ val: string; label: string }> = [];
                for (let yr = 2024; yr <= currentRealYear; yr++) {
                  const maxM = (yr === currentRealYear) ? currentRealMonth : 11;
                  for (let mIdx = 0; mIdx <= maxM; mIdx++) {
                    monthYearOptions.push({
                      val: `${mIdx}-${yr}`,
                      label: `${monthNames[mIdx]} ${yr}`
                    });
                  }
                }

                return (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentDate(new Date())}
                      title="Jump to Current Month"
                      className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase bg-indigo-500/10 text-indigo-650 dark:bg-indigo-500/20 dark:text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all cursor-pointer shadow-2xs"
                    >
                      Today
                    </button>

                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/90 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                      <button
                        onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
                        className="w-7 h-7 flex items-center justify-center text-xs font-black text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:shadow-2xs rounded-lg transition-all cursor-pointer border-0 outline-none"
                        title="Previous Month"
                      >
                        ‹
                      </button>

                      {/* Single Unified Dropdown: Past up to Current Month ONLY */}
                      <select
                        value={`${currentDate.getMonth()}-${currentDate.getFullYear()}`}
                        onChange={(e) => {
                          const [m, y] = e.target.value.split('-').map(Number);
                          setCurrentDate(new Date(y, m, 1));
                        }}
                        className="bg-transparent border-0 text-xs font-black uppercase text-slate-800 dark:text-slate-100 focus:ring-0 focus:outline-none cursor-pointer px-2 py-0.5 tracking-wider font-outfit"
                      >
                        {monthYearOptions.map(opt => (
                          <option key={opt.val} value={opt.val} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-bold uppercase">
                            {opt.label.toUpperCase()}
                          </option>
                        ))}
                      </select>

                      <button
                        disabled={isMaxMonth}
                        onClick={() => {
                          if (!isMaxMonth) {
                            setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
                          }
                        }}
                        className={`w-7 h-7 flex items-center justify-center text-xs font-black rounded-lg transition-all border-0 outline-none ${
                          isMaxMonth
                            ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-40'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:shadow-2xs cursor-pointer'
                        }`}
                        title={isMaxMonth ? "Cannot view future months" : "Next Month"}
                      >
                        ›
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Days of Week Header */}
            <div className="grid grid-cols-7 gap-1.5 text-center mb-2.5 bg-slate-100/60 dark:bg-slate-800/50 p-2 rounded-2xl border border-slate-200/50 dark:border-slate-800">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, idx) => (
                <span key={idx} className={`text-[10.5px] font-black uppercase py-0.5 tracking-wider ${idx === 0 || idx === 6 ? 'text-rose-500 dark:text-rose-400 font-extrabold' : 'text-slate-700 dark:text-slate-300'}`}>
                  {d}
                </span>
              ))}
            </div>

            {/* Calendar Days Grid */}
            <div className="grid grid-cols-7 gap-1.5 text-center mb-5">
              {getCalendarDays().map((cell, idx) => {
                const today = new Date();
                const isToday = cell.isCurrentMonth && cell.day === today.getDate() && currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear();

                let cellBg = 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800';
                let textStyle = 'text-slate-700 dark:text-slate-200 font-bold';
                if (!cell.isCurrentMonth) {
                  textStyle = 'text-slate-300 dark:text-slate-700 font-normal';
                } else if (cell.status === 'present') {
                  cellBg = 'bg-emerald-500/10 border-emerald-500/30 dark:bg-emerald-500/20';
                  textStyle = 'text-emerald-600 dark:text-emerald-400 font-black text-sm';
                } else if (cell.status === 'absent') {
                  cellBg = 'bg-rose-500/10 border-rose-500/30 dark:bg-rose-500/20';
                  textStyle = 'text-rose-600 dark:text-rose-400 font-black text-sm';
                } else if (cell.status === 'late') {
                  cellBg = 'bg-amber-500/10 border-amber-500/30 dark:bg-amber-500/20';
                  textStyle = 'text-amber-600 dark:text-amber-400 font-black text-sm';
                } else if (cell.status === 'leave') {
                  cellBg = 'bg-purple-500/10 border-purple-500/30 dark:bg-purple-500/20';
                  textStyle = 'text-purple-600 dark:text-purple-400 font-black text-sm';
                } else if (cell.status === 'weekend') {
                  cellBg = 'bg-slate-100/60 dark:bg-slate-800/20 border-slate-200/50 dark:border-slate-800';
                  textStyle = 'text-slate-400 dark:text-slate-500 font-bold';
                }

                return (
                  <div
                    key={idx}
                    className={`h-10 flex flex-col items-center justify-center rounded-2xl transition-all relative border hover:scale-105 shadow-2xs ${cellBg} ${
                      isToday ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900 z-10 shadow-md' : ''
                    }`}
                  >
                    <span className={`font-outfit ${textStyle}`}>{cell.day}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Calendar Legend Pill Badges */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-black border-t border-slate-100 dark:border-slate-800 pt-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/30 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Present
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-500/30 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-rose-500" /> Absent
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/30 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> Late
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 border border-purple-500/30 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-purple-500" /> On Leave
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500" /> Weekend
            </span>
          </div>
        </div>

        {/* Right: My Leave Status (5 cols) */}
        <div className="lg:col-span-5 rounded-3xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm text-left flex flex-col justify-between transition-all duration-300 hover:shadow-md">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-200 font-outfit flex items-center gap-2">
                <span className="text-base">☂️</span> My Leave Status
              </h3>
              <Link href="/dashboard/leaves" className="text-[10px] font-black text-indigo-650 dark:text-indigo-400 hover:underline tracking-wider uppercase bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                View All
              </Link>
            </div>

            {/* 3 Metric Pills */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/30 text-center shadow-2xs">
                <p className="text-[9.5px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">APPROVED</p>
                <p className="text-xl font-black text-emerald-700 dark:text-emerald-300 mt-0.5 font-outfit">
                  {leaveRequests.filter((l: any) => String(l.status).toUpperCase() === 'APPROVED').length} <span className="text-xs font-bold">Reqs</span>
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/30 text-center shadow-2xs">
                <p className="text-[9.5px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">PENDING</p>
                <p className="text-xl font-black text-amber-700 dark:text-amber-300 mt-0.5 font-outfit">
                  {leaveRequests.filter((l: any) => String(l.status).toUpperCase() === 'PENDING').length} <span className="text-xs font-bold">Reqs</span>
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-500/30 text-center shadow-2xs">
                <p className="text-[9.5px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">REJECTED</p>
                <p className="text-xl font-black text-rose-700 dark:text-rose-300 mt-0.5 font-outfit">
                  {leaveRequests.filter((l: any) => String(l.status).toUpperCase() === 'REJECTED').length} <span className="text-xs font-bold">Reqs</span>
                </p>
              </div>
            </div>

            {/* Recent Leave Request Items */}
            <div className="space-y-3">
              {leaveRequests.length === 0 ? (
                <div className="p-6 text-center text-slate-400 dark:text-slate-500 text-xs font-bold bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-200/50 dark:border-slate-800">
                  🌴 No leave requests logged yet.
                </div>
              ) : (
                leaveRequests.slice(0, 3).map((item: any, idx: number) => {
                  const statusUpper = String(item.status || '').toUpperCase();
                  const badgeColor = statusUpper === 'APPROVED' ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:bg-emerald-500/25 dark:text-emerald-400' :
                    statusUpper === 'PENDING' ? 'bg-amber-500/15 text-amber-600 border-amber-500/30 dark:bg-amber-500/25 dark:text-amber-400' :
                    'bg-rose-500/15 text-rose-600 border-rose-500/30 dark:bg-rose-500/25 dark:text-rose-400';
                  
                  const startDateStr = String(item.start_date || item.from_date || '').split('T')[0];
                  const endDateStr = String(item.end_date || item.to_date || startDateStr).split('T')[0];

                  return (
                    <div key={idx} className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:border-indigo-500/30 transition-all duration-200 shadow-2xs">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center text-lg shadow-2xs">
                          🌴
                        </div>
                        <div>
                          <h5 className="text-xs font-black text-slate-800 dark:text-slate-100">{item.leave_type || item.leave_type_code || 'Leave'}</h5>
                          <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">{startDateStr} - {endDateStr}</p>
                        </div>
                      </div>
                      <span className={`text-[9.5px] font-black px-3 py-1 rounded-full border uppercase tracking-wider ${badgeColor}`}>
                        {statusUpper}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>

      {/* ── ROW 5: TODAY'S BIRTHDAYS & TODAY'S WORK ANNIVERSARIES (2 CARDS ROW) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
        
        {/* 1. Today's Birthdays */}
        <div className="rounded-3xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 shadow-sm text-left flex flex-col justify-between overflow-hidden min-h-[220px] transition-all duration-300 hover:shadow-md">
          <div>
            <div className="flex items-center gap-3.5 mb-5 pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center text-xl font-bold shadow-2xs">
                🎂
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-200 font-outfit">
                  TODAY'S BIRTHDAYS
                </h4>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">Celebrate team milestones</p>
              </div>
            </div>

            {/* Today's Birthdays List/Marquee */}
            {getBirthdaysToday().length > 0 ? (
              <div className="overflow-hidden w-full py-2">
                <div className="animate-marquee gap-3.5 flex">
                  {[...getBirthdaysToday(), ...getBirthdaysToday(), ...getBirthdaysToday()].map((item, idx) => (
                    <div key={idx} className="w-[270px] shrink-0 flex items-center justify-between gap-3 p-4 rounded-2xl bg-indigo-500/5 dark:bg-slate-800/60 border border-indigo-500/20 dark:border-slate-800 shadow-2xs hover:shadow-xs transition-all">
                      <div className="flex items-center gap-3.5 min-w-0">
                        {item.image ? (
                          <img src={item.image} className="w-11 h-11 rounded-full object-cover shrink-0 ring-2 ring-indigo-500/30 shadow-xs" alt="avatar" />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-indigo-600 to-blue-500 text-white font-extrabold text-sm flex items-center justify-center shrink-0 shadow-xs ring-2 ring-indigo-500/30">
                            {item.name.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">{item.name}</p>
                          <p className="text-[10px] font-semibold text-slate-500 truncate mt-0.5">{item.designation}</p>
                          <span className="inline-block text-[8.5px] font-extrabold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 mt-1">
                            🎂 Today
                          </span>
                        </div>
                      </div>

                      <button className="text-[10px] font-black px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border-0 shadow-md transition-all cursor-pointer shrink-0 active:scale-95">
                        Wish 🎉
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <span className="text-4xl mb-2.5">🎂</span>
                <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200">No birthdays today</p>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-semibold mt-1">Celebrate team milestones when they arrive!</p>
              </div>
            )}
          </div>
        </div>

        {/* 2. Today's Work Anniversaries */}
        <div className="rounded-3xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 shadow-sm text-left flex flex-col justify-between overflow-hidden min-h-[220px] transition-all duration-300 hover:shadow-md">
          <div>
            <div className="flex items-center gap-3.5 mb-5 pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <div className="w-11 h-11 rounded-2xl bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center text-xl font-bold shadow-2xs">
                🎖️
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-200 font-outfit">
                  TODAY'S WORK ANNIVERSARIES
                </h4>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">Recognize dedication & loyalty</p>
              </div>
            </div>

            {/* Today's Anniversaries List/Marquee */}
            {getAnniversariesToday().length > 0 ? (
              <div className="overflow-hidden w-full py-2">
                <div className="animate-marquee gap-3.5 flex">
                  {[...getAnniversariesToday(), ...getAnniversariesToday(), ...getAnniversariesToday()].map((item, idx) => (
                    <div key={idx} className="w-[270px] shrink-0 flex items-center justify-between gap-3 p-4 rounded-2xl bg-purple-500/5 dark:bg-slate-800/60 border border-purple-500/20 dark:border-slate-800 shadow-2xs hover:shadow-xs transition-all">
                      <div className="flex items-center gap-3.5 min-w-0">
                        {item.image ? (
                          <img src={item.image} className="w-11 h-11 rounded-full object-cover shrink-0 ring-2 ring-purple-500/30 shadow-xs" alt="avatar" />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 text-white font-extrabold text-sm flex items-center justify-center shrink-0 shadow-xs ring-2 ring-purple-500/30">
                            {item.name.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">{item.name}</p>
                          <p className="text-[10px] font-semibold text-slate-500 truncate mt-0.5">{item.designation}</p>
                          <span className="inline-block text-[8.5px] font-extrabold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 mt-1">
                            🎖️ {item.years} Yrs Today
                          </span>
                        </div>
                      </div>

                      <button className="text-[10px] font-black px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white border-0 shadow-md transition-all cursor-pointer shrink-0 active:scale-95">
                        Wish 👏
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <span className="text-4xl mb-2.5">🎖️</span>
                <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200">No work anniversaries today</p>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-semibold mt-1">Recognizing team dedication and loyalty!</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── ROW 6: UPCOMING HOLIDAYS, ANNOUNCEMENTS, NEED HELP (3 CARDS ROW) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
        
        {/* 1. Upcoming Holidays */}
        <div className="rounded-3xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm text-left flex flex-col justify-between transition-all duration-300 hover:shadow-md hover:border-teal-500/40">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <h4 className="text-xs font-black uppercase tracking-widest text-teal-600 dark:text-teal-400 flex items-center gap-2 font-outfit">
                <span className="text-base">🌴</span> UPCOMING HOLIDAYS
              </h4>
              <Link href="/dashboard/holidays" className="text-[10px] font-black text-indigo-650 dark:text-indigo-400 hover:underline uppercase tracking-wider bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                View Calendar
              </Link>
            </div>

            <div className="space-y-3">
              {[
                { date: '01 MAY', name: 'Labour Day', day: 'Thursday' },
                { date: '15 AUG', name: 'Independence Day', day: 'Friday' },
                { date: '26 JAN', name: 'Republic Day', day: 'Monday' },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-3.5 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-teal-500/30 transition-all shadow-2xs">
                  <div className="w-11 h-11 rounded-2xl bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400 border border-teal-500/20 flex flex-col items-center justify-center shrink-0 shadow-2xs">
                    <span className="text-[8.5px] font-black uppercase leading-none">{item.date.split(' ')[1]}</span>
                    <span className="text-xs font-black leading-none mt-1 font-outfit">{item.date.split(' ')[0]}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">{item.name}</p>
                    <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">{item.day}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 2. Announcements */}
        <div className="rounded-3xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm text-left flex flex-col justify-between transition-all duration-300 hover:shadow-md hover:border-indigo-500/40">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <h4 className="text-xs font-black uppercase tracking-widest text-indigo-650 dark:text-indigo-400 flex items-center gap-2 font-outfit">
                <span className="text-base">📢</span> ANNOUNCEMENTS
              </h4>
              <button className="text-[10px] font-black text-indigo-650 dark:text-indigo-400 hover:underline uppercase tracking-wider cursor-pointer bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                View All
              </button>
            </div>

            <div className="space-y-3">
              {[
                { title: 'New HR Policy Update', time: '2 days ago', icon: '📢' },
                { title: 'Office Maintenance Scheduled', time: '3 days ago', icon: '📋' },
                { title: 'Annual Team Outing Plan', time: '1 week ago', icon: '🎉' },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-indigo-500/30 transition-all shadow-2xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-base shrink-0">{item.icon}</span>
                    <p className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">{item.title}</p>
                  </div>
                  <span className="text-[9.5px] font-black text-slate-400 dark:text-slate-500 shrink-0 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">{item.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 3. Need Help? (Light Soft Theme) */}
        <div className="rounded-3xl border border-indigo-200/80 dark:border-slate-800 bg-gradient-to-br from-indigo-50/90 via-slate-50 to-blue-50/80 dark:from-slate-900 dark:to-slate-800 p-6 shadow-sm text-left flex flex-col justify-between transition-all duration-300 hover:shadow-md text-slate-800 dark:text-white group">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center text-xl mb-4 backdrop-blur-md shadow-2xs group-hover:scale-110 transition-transform">
              🎧
            </div>
            <h4 className="text-base font-black uppercase tracking-wider text-slate-900 dark:text-white font-outfit">
              Need Help?
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed font-medium">
              Have questions or facing issues? Raise a ticket or connect directly with our support team.
            </p>
          </div>

          <div className="mt-6">
            <button className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 border-0 text-xs font-black text-white shadow-md shadow-indigo-500/20 transition-all text-center cursor-pointer active:scale-98">
              Create Support Ticket
            </button>
          </div>
        </div>
      </div>

      {/* 📸 Mark Attendance Center Dialog Modal */}
      {punchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full border border-slate-200/80 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xl shrink-0">
                  📸
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white font-outfit">
                    MARK ATTENDANCE ({punchDirection === 'IN' ? 'CHECK IN' : 'CHECK OUT'})
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    GPS LOCATION & SELFIE VERIFICATION
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPunchModalOpen(false);
                  stopCamera();
                }}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center text-base font-bold transition-colors cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {modalPunchMsg && (
                <div className={`p-3 rounded-2xl text-xs font-bold flex items-center justify-between border ${
                  modalPunchMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40'
                    : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/40'
                }`}>
                  <span>{modalPunchMsg.text}</span>
                  <button onClick={() => setModalPunchMsg(null)} className="text-xs font-bold px-1">&times;</button>
                </div>
              )}

              {/* GPS Verification Card */}
              <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    🌐 GPS Location Verification
                  </span>
                  <button
                    type="button"
                    onClick={getGPSLocation}
                    disabled={gpsLoading}
                    className="text-[9.5px] font-extrabold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer bg-transparent border-0"
                  >
                    {gpsLoading ? 'Fetching...' : 'Re-detect GPS'}
                  </button>
                </div>

                {punchLat && punchLng ? (
                  <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 leading-snug">
                        📍 {locationName || 'Detecting location address...'}
                      </p>
                      <span className="text-[9px] bg-emerald-600 text-white px-2 py-0.5 rounded font-sans uppercase font-bold shrink-0 shadow-2xs">
                        GPS Verified
                      </span>
                    </div>
                  </div>
                ) : gpsError ? (
                  <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 text-xs font-bold">
                    ⚠️ {gpsError}
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-bold">
                    📍 Click "Re-detect GPS" to verify location permissions.
                  </div>
                )}
              </div>

              {/* Camera / Selfie Capture Card */}
              <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                  📸 Selfie Photo Verification
                </span>

                {capturedSelfie ? (
                  <div className="space-y-2 text-center">
                    <img
                      src={capturedSelfie}
                      alt="Captured Selfie Verification"
                      className="w-48 h-36 object-cover rounded-2xl mx-auto border-2 border-emerald-500 shadow-md"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setCapturedSelfie(null);
                        startCamera();
                      }}
                      className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer bg-transparent border-0"
                    >
                      Retake Selfie Photo
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 text-center">
                    <div className="w-full h-44 rounded-2xl bg-black overflow-hidden relative flex items-center justify-center border border-slate-700 shadow-inner">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{ transform: 'scaleX(-1)' }}
                        className="w-full h-full object-cover"
                      />
                      <canvas ref={canvasRef} className="hidden" />
                      {!cameraActive && (
                        <button
                          type="button"
                          onClick={startCamera}
                          className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors shadow-md cursor-pointer"
                        >
                          📷 Enable Camera
                        </button>
                      )}
                    </div>

                    {cameraActive && (
                      <button
                        type="button"
                        onClick={captureSelfie}
                        className="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md shadow-indigo-500/25 transition-all cursor-pointer hover:scale-105"
                      >
                        📸 Take Selfie Snapshot
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={submitWebPunch}
                  disabled={isSubmittingPunch || !capturedSelfie}
                  className={`w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all duration-200 ${
                    isSubmittingPunch || !capturedSelfie
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 border border-slate-300/40 dark:border-slate-700/40 cursor-not-allowed shadow-none'
                      : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white shadow-lg shadow-blue-500/25 hover:scale-[1.01] cursor-pointer'
                  }`}
                >
                  {isSubmittingPunch
                    ? 'Submitting Punch...'
                    : !capturedSelfie
                    ? '📸 Capture Selfie Photo First to Submit'
                    : `Submit ${punchDirection === 'IN' ? 'Check In' : 'Check Out'} Punch Now`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

