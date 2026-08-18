'use client';

import React, { useEffect, useState, useMemo } from 'react';
import DashboardPageHeader from '../components/DashboardPageHeader';
import { getHeaders, getUrl } from '../utils/api';
import { useDashboard } from '../components/DashboardContext';

interface Company {
  id: string;
  name: string;
  subdomain: string;
  branding_logo?: string;
  status?: string;
}

interface Branch {
  id: string;
  company_id?: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  code?: string;
  status?: string;
}

interface Department {
  id: string;
  company_id?: string;
  branch_id?: string;
  name: string;
  description?: string;
  status?: string;
}

interface Employee {
  id: string;
  company_id?: string;
  branch_id?: string;
  department_id?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  email: string;
  phone?: string;
  designation_name?: string;
  role?: string;
  status?: string;
  emp_id_code?: string;
  employee_code?: string;
  emp_code?: string;
  emp_image?: string;
  profile_picture?: string;
  profile_image?: string;
  avatar_url?: string;
  photo_url?: string;
  avatar?: string;
  photo?: string;
}

export default function OrganizationFlowPage() {
  const { showToast } = useDashboard();
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [userCompanyId, setUserCompanyId] = useState<string | null>(null);

  // Data states
  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [loading, setLoading] = useState(true);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'diagram' | 'matrix'>('diagram');

  // Track expanded state for branches and departments (Default: COLLAPSED, user clicks to expand single-by-single)
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('superadmin');

  useEffect(() => {
    const storedRoles = localStorage.getItem('roles');
    const storedEmail = localStorage.getItem('email');
    const storedCompanyId = localStorage.getItem('companyId');
    if (storedRoles) setRoles(JSON.parse(storedRoles));
    if (storedEmail) setEmail(storedEmail);
    if (storedCompanyId) setUserCompanyId(storedCompanyId);
  }, []);

  // Fetch all organizational entities
  const fetchAllData = async () => {
    setLoading(true);
    try {
      const headers = getHeaders();
      const [compRes, branchRes, deptRes, empRes] = await Promise.all([
        fetch(getUrl('/api/v1/companies'), { headers }),
        fetch(getUrl('/api/v1/branches'), { headers }),
        fetch(getUrl('/api/v1/departments'), { headers }),
        fetch(getUrl('/api/v1/employees'), { headers })
      ]);

      const [compData, branchData, deptData, empData] = await Promise.all([
        compRes.ok ? compRes.json() : { companies: [] },
        branchRes.ok ? branchRes.json() : { branches: [] },
        deptRes.ok ? deptRes.json() : { departments: [] },
        empRes.ok ? empRes.json() : { employees: [] }
      ]);

      const compList: Company[] = compData.companies || [];
      setCompanies(compList);
      setBranches(branchData.branches || []);
      setDepartments(deptData.departments || []);
      setEmployees(empData.employees || []);

      // Automatically select first company if available
      if (compList.length > 0) {
        setSelectedCompanyId(compList[0].id);
      }
    } catch (err) {
      console.error('Error fetching org flow data:', err);
      showToast('Failed to load organizational hierarchy data', 'error');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Exclusive Accordion Node Toggles: Opening one branch closes other branches; opening one dept closes other depts
  const toggleBranchNode = (branchId: string) => {
    setExpandedNodes(prev => {
      const branchKey = `branch-${branchId}`;
      const isCurrentlyExpanded = !!prev[branchKey];
      if (isCurrentlyExpanded) {
        return {}; // Collapse everything
      }
      // Expand only this branch
      return { [branchKey]: true };
    });
  };

  const toggleDeptNode = (branchId: string, deptId: string) => {
    setExpandedNodes(prev => {
      const branchKey = `branch-${branchId}`;
      const deptKey = `dept-${deptId}`;
      const isCurrentlyExpanded = !!prev[deptKey];
      if (isCurrentlyExpanded) {
        return { [branchKey]: true }; // Collapse department but keep branch open
      }
      // Open only this department under this branch
      return { [branchKey]: true, [deptKey]: true };
    });
  };

  const expandAll = () => {
    const allExpanded: Record<string, boolean> = {};
    branches.forEach(b => { allExpanded[`branch-${b.id}`] = true; });
    departments.forEach(d => { allExpanded[`dept-${d.id}`] = true; });
    setExpandedNodes(allExpanded);
  };

  const collapseAll = () => {
    setExpandedNodes({});
  };

  // Filter companies based on scope selection
  const visibleCompanies = useMemo(() => {
    if (!isSuperAdmin && userCompanyId) {
      return companies.filter(c => c.id === userCompanyId);
    }
    if (selectedCompanyId && selectedCompanyId !== 'ALL') {
      return companies.filter(c => c.id === selectedCompanyId);
    }
    return companies;
  }, [companies, selectedCompanyId, isSuperAdmin, userCompanyId]);

  // Overall Statistics
  const stats = useMemo(() => {
    return {
      totalCompanies: companies.length,
      totalBranches: branches.length,
      totalDepartments: departments.length,
      totalEmployees: employees.length
    };
  }, [companies, branches, departments, employees]);

  const isAllExpanded = Object.keys(expandedNodes).length > 0;
  const toggleExpandCollapseAll = () => {
    if (isAllExpanded) {
      collapseAll();
    } else {
      expandAll();
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn select-none relative pb-24 font-sans">
      
      {/* 🚀 Page Header */}
      <DashboardPageHeader
        title="Organization Structure & Hierarchy"
        isSuperAdmin={isSuperAdmin}
        hideCompanySelect={true}
        hideUserBadge={true}
      />

      {/* 📊 Metrics Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Metric 1: Corporate Tenants */}
        <div className="group relative rounded-2xl bg-gradient-to-br from-indigo-50/95 via-sky-50/30 to-white dark:from-indigo-950/40 dark:via-slate-900 dark:to-slate-900 border border-indigo-200/70 dark:border-indigo-800/60 p-4 flex items-center justify-between shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer overflow-hidden backdrop-blur-xs">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Corporate Tenants</p>
            <h4 className="text-2xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight font-mono">{stats.totalCompanies}</h4>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-indigo-100/80 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 flex items-center justify-center border border-indigo-200/60 dark:border-indigo-800/60 shadow-xs group-hover:scale-105 transition-transform">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
        </div>

        {/* Metric 2: Active Branches */}
        <div className="group relative rounded-2xl bg-gradient-to-br from-emerald-50/95 via-teal-50/30 to-white dark:from-emerald-950/40 dark:via-slate-900 dark:to-slate-900 border border-emerald-200/70 dark:border-emerald-800/60 p-4 flex items-center justify-between shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer overflow-hidden backdrop-blur-xs">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Active Branches</p>
            <h4 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight font-mono">{stats.totalBranches}</h4>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-emerald-100/80 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 flex items-center justify-center border border-emerald-200/60 dark:border-emerald-800/60 shadow-xs group-hover:scale-105 transition-transform">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        </div>

        {/* Metric 3: Departments */}
        <div className="group relative rounded-2xl bg-gradient-to-br from-amber-50/95 via-orange-50/30 to-white dark:from-amber-950/40 dark:via-slate-900 dark:to-slate-900 border border-amber-200/70 dark:border-amber-800/60 p-4 flex items-center justify-between shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer overflow-hidden backdrop-blur-xs">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">Departments</p>
            <h4 className="text-2xl font-black text-amber-600 dark:text-amber-400 tracking-tight font-mono">{stats.totalDepartments}</h4>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-amber-100/80 dark:bg-amber-900/60 text-amber-600 dark:text-amber-300 flex items-center justify-center border border-amber-200/60 dark:border-amber-800/60 shadow-xs group-hover:scale-105 transition-transform">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
        </div>

        {/* Metric 4: Total Personnel */}
        <div className="group relative rounded-2xl bg-gradient-to-br from-rose-50/95 via-pink-50/30 to-white dark:from-rose-950/40 dark:via-slate-900 dark:to-slate-900 border border-rose-200/70 dark:border-rose-800/60 p-4 flex items-center justify-between shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer overflow-hidden backdrop-blur-xs">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400">Total Personnel</p>
            <h4 className="text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tight font-mono">{stats.totalEmployees}</h4>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-rose-100/80 dark:bg-rose-900/60 text-rose-600 dark:text-rose-300 flex items-center justify-center border border-rose-200/60 dark:border-rose-800/60 shadow-xs group-hover:scale-105 transition-transform">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* 🏢 Corporate Tenant Selector */}
      <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20 shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h4m-4 0V11m0 0h4m-4 0H9m4 0V7m0 0h4m-4 0H9" />
              </svg>
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white font-outfit">
                Select Corporate Entity
              </h3>
              <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">
                Filter organizational hierarchy, departments, and personnel metrics by company
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleExpandCollapseAll}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2"
              title={isAllExpanded ? 'Collapse All Hierarchy Nodes' : 'Expand All Hierarchy Nodes'}
            >
              <svg className={`w-4 h-4 transition-transform duration-300 ${isAllExpanded ? 'text-indigo-500' : 'text-blue-500'}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={isAllExpanded ? "M4.5 15.75l7.5-7.5 7.5 7.5" : "M19.5 8.25l-7.5 7.5-7.5-7.5"} />
              </svg>
              <span>{isAllExpanded ? 'Collapse All' : 'Expand All'}</span>
            </button>

            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => setSelectedCompanyId('ALL')}
                className={`text-xs font-extrabold uppercase tracking-wider px-4 py-2 rounded-xl border transition-all cursor-pointer flex items-center gap-2 ${
                  selectedCompanyId === 'ALL'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                <span>Show All Tenants</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {companies.map(comp => {
            const isSelected = selectedCompanyId === comp.id;
            const compBranchesCount = branches.filter(b => !b.company_id || b.company_id === comp.id).length;
            const compEmpsCount = employees.filter(e => !e.company_id || e.company_id === comp.id).length;

            return (
              <button
                key={comp.id}
                onClick={() => setSelectedCompanyId(comp.id)}
                className={`group p-3 rounded-2xl border-2 text-left transition-all duration-300 cursor-pointer relative overflow-hidden flex flex-col justify-between gap-2.5 ${
                  isSelected
                    ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/25 ring-2 ring-indigo-400/60 scale-[1.01] -translate-y-0.5'
                    : 'bg-white dark:bg-slate-900/90 border-slate-200/90 dark:border-slate-750 text-slate-800 dark:text-slate-200 shadow-sm hover:shadow-md hover:border-indigo-500 dark:hover:border-indigo-400 hover:-translate-y-0.5'
                }`}
              >
                {/* Sleek Top Arrow Ribbon Bar */}
                <div className="flex items-center justify-between gap-2.5 w-full">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {comp.branding_logo ? (
                      <div className={`h-12 w-16 rounded-xl p-1 border flex items-center justify-center shrink-0 transition-all ${
                        isSelected ? 'bg-white border-white/20 shadow-xs' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm'
                      }`}>
                        <img src={comp.branding_logo} alt={comp.name} className="h-full w-full object-contain" />
                      </div>
                    ) : (
                      <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-sm font-black shrink-0 transition-all shadow-xs ${
                        isSelected ? 'bg-white/20 text-white border border-white/30' : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'
                      }`}>
                        {comp.name.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    
                    <div className="min-w-0 flex-1">
                      <h4 className={`text-xs font-black font-outfit tracking-tight truncate leading-snug ${
                        isSelected ? 'text-white' : 'text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400'
                      }`}>
                        {comp.name}
                      </h4>
                      {comp.subdomain && (
                        <p className={`text-[9.5px] font-mono font-bold truncate mt-0.5 ${
                          isSelected ? 'text-indigo-100/90' : 'text-slate-400 dark:text-slate-500'
                        }`}>
                          @{comp.subdomain}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Sleek Arrow Indicator Badge */}
                  <div className="shrink-0">
                    {isSelected ? (
                      <div className="w-7 h-7 rounded-xl bg-white text-indigo-600 flex items-center justify-center text-xs font-black shadow-md transition-transform group-hover:translate-x-0.5">
                        ➔
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:text-indigo-600 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/50 flex items-center justify-center text-xs font-extrabold transition-all group-hover:translate-x-0.5 border border-slate-200 dark:border-slate-700 shadow-2xs">
                        ➔
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Row: Compact Stats Pills */}
                <div className={`flex items-center gap-2 pt-2.5 border-t ${
                  isSelected ? 'border-white/20' : 'border-slate-100 dark:border-slate-800'
                }`}>
                  <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg flex items-center gap-1 ${
                    isSelected 
                      ? 'bg-white/15 text-white backdrop-blur-md border border-white/10' 
                      : 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-900/40 shadow-2xs'
                  }`}>
                    🏢 {compBranchesCount} Branches
                  </span>

                  <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg flex items-center gap-1 ${
                    isSelected 
                      ? 'bg-white/15 text-white backdrop-blur-md border border-white/10' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-2xs'
                  }`}>
                    👥 {compEmpsCount} Personnel
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 🔍 Search & View Switcher Bar */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-card p-3.5 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        
        {/* Search */}
        <div className="relative w-full md:max-w-xs">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Search employees, departments, branches..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-search pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 focus:bg-card focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-all duration-200"
          />
        </div>

        {/* Mode Buttons */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800">
            <button
              onClick={() => setViewMode('diagram')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'diagram'
                  ? 'bg-card text-blue-600 dark:text-blue-400 shadow-2xs border border-slate-200/80 dark:border-slate-700'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3m0 0a3 3 0 100 6 3 3 0 000-6zm-7 9h14m-14 0a2 2 0 00-2 2v2a2 2 0 002 2h4a2 2 0 002-2v-2a2 2 0 00-2-2H5zm10 0a2 2 0 00-2 2v2a2 2 0 002 2h4a2 2 0 002-2v-2a2 2 0 00-2-2h-4z" />
              </svg>
              <span>🌳 Diagram View</span>
            </button>

            <button
              onClick={() => setViewMode('matrix')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'matrix'
                  ? 'bg-card text-blue-600 dark:text-blue-400 shadow-2xs border border-slate-200/80 dark:border-slate-700'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
              <span>📊 Matrix Directory</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/80 bg-card p-16 text-center text-slate-400">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-blue-500 border-t-transparent mb-3" />
          <p className="text-xs font-bold uppercase tracking-wider">Building Organization Hierarchy...</p>
        </div>
      ) : visibleCompanies.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/80 bg-card p-16 text-center text-slate-400">
          <svg className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
          </svg>
          <p className="text-xs font-bold uppercase tracking-wider">No Corporate Tenants found to construct hierarchy.</p>
        </div>
      ) : viewMode === 'diagram' ? (

        /* ========================================================================= */
        /* MODE 1: 🌳 VISUAL DIAGRAM FLOW (Interactive Modern Flowchart)             */
        /* ========================================================================= */
        <div className="space-y-10">
          {visibleCompanies.map(company => {
            const companyBranches = branches.filter(b => !b.company_id || b.company_id === company.id);

            return (
              <div key={company.id} className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-card p-6 md:p-8 shadow-sm space-y-8 relative overflow-hidden">
                
                {/* 🏢 STREAMLINED HIERARCHY CONNECTOR SYSTEM */}
                <div className="flex flex-col items-center w-full my-2 relative">
                  {/* Downward Flow Arrow Pill Badge */}
                  <div className="px-5 py-2 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white text-[11px] font-black uppercase tracking-widest flex items-center gap-2.5 shadow-md shadow-indigo-500/25 border border-white/20 z-10">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                    <span>ORGANIZATION BRANCH UNITS ({companyBranches.length} ACTIVE BRANCHES)</span>
                    <svg className="w-4 h-4 animate-bounce ml-1 shrink-0" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
                    </svg>
                  </div>

                  {/* Line below badge */}
                  <div className="h-4 w-1 bg-indigo-500 dark:bg-indigo-400 rounded-full my-1" />

                  {/* Solid Horizontal Branching Tree Line across grid */}
                  <div className="w-full max-w-5xl h-1 bg-gradient-to-r from-indigo-500/10 via-indigo-500 to-indigo-500/10 rounded-full mb-4" />
                </div>

                {/* 📍 BRANCHES LEVEL FLOW (Single Horizontal Row with Left/Right Navigation Arrows) */}
                {companyBranches.length > 0 && (() => {
                  const activeBranch = companyBranches.find(b => expandedNodes[`branch-${b.id}`]);
                  const activeBranchDepts = activeBranch ? departments.filter(d => d.branch_id === activeBranch.id) : [];

                  return (
                    <div className="w-full space-y-6">
                      
                      {/* Horizontal Branch Carousel Row with Navigation Arrows */}
                      <div className="relative w-full flex items-center justify-between gap-2.5">
                        {/* Left Arrow Button */}
                        <button
                          type="button"
                          onClick={() => {
                            const el = document.getElementById(`branch-carousel-${company.id}`);
                            if (el) el.scrollBy({ left: -260, behavior: 'smooth' });
                          }}
                          className="h-9 w-9 rounded-xl bg-card border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 shadow-2xs hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center shrink-0 cursor-pointer transition-all active:scale-95 z-10"
                          title="Scroll Left"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                          </svg>
                        </button>

                        {/* Single Horizontal Scrollable Row */}
                        <div
                          id={`branch-carousel-${company.id}`}
                          className="flex items-center gap-3.5 overflow-x-auto no-scrollbar py-2.5 px-1 scroll-smooth w-full"
                        >
                          {companyBranches.map(branch => {
                            const isBranchExpanded = activeBranch?.id === branch.id;
                            const branchDepts = departments.filter(d => d.branch_id === branch.id);
                            const branchEmps = employees.filter(e => e.branch_id === branch.id);

                            const matchesQuery = searchQuery && (
                              branch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              (branch.city && branch.city.toLowerCase().includes(searchQuery.toLowerCase()))
                            );

                            return (
                              <div
                                key={branch.id}
                                onClick={() => toggleBranchNode(branch.id)}
                                className={`w-[240px] min-w-[240px] max-w-[240px] rounded-2xl border-2 p-3.5 shadow-xs hover:shadow-md cursor-pointer transition-all duration-200 text-left select-none shrink-0 ${
                                  matchesQuery
                                    ? 'border-amber-400 bg-amber-50/30 ring-2 ring-amber-400/20'
                                    : isBranchExpanded
                                    ? 'border-blue-600 bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 text-white shadow-lg shadow-blue-500/25 scale-[1.02]'
                                    : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-blue-500 hover:-translate-y-0.5 text-slate-900 dark:text-slate-100'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                                      isBranchExpanded ? 'bg-white/20 text-white' : 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 border border-blue-100 dark:border-blue-900/40'
                                    }`}>
                                      📍
                                    </div>
                                    <div className="min-w-0">
                                      <h4 className="text-xs font-black uppercase tracking-wide truncate">{branch.name}</h4>
                                    </div>
                                  </div>

                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border shrink-0 ${
                                    isBranchExpanded
                                      ? 'bg-white text-blue-600 border-white'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                  }`}>
                                    {isBranchExpanded ? 'Active ▲' : 'Open ▼'}
                                  </span>
                                </div>

                                <div className={`flex items-center justify-between text-[9.5px] font-extrabold mt-3 pt-2.5 border-t ${
                                  isBranchExpanded ? 'border-white/20 text-blue-50' : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'
                                }`}>
                                  <span className={`px-2 py-0.5 rounded-md ${isBranchExpanded ? 'bg-white/15' : 'bg-slate-100 dark:bg-slate-800/80'}`}>
                                    📁 {branchDepts.length} Depts
                                  </span>
                                  <span className={`px-2 py-0.5 rounded-md ${isBranchExpanded ? 'bg-white/15' : 'bg-slate-100 dark:bg-slate-800/80'}`}>
                                    👥 {branchEmps.length} Staff
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Right Arrow Button */}
                        <button
                          type="button"
                          onClick={() => {
                            const el = document.getElementById(`branch-carousel-${company.id}`);
                            if (el) el.scrollBy({ left: 260, behavior: 'smooth' });
                          }}
                          className="h-9 w-9 rounded-xl bg-card border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 shadow-2xs hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center shrink-0 cursor-pointer transition-all active:scale-95 z-10"
                          title="Scroll Right"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                          </svg>
                        </button>
                      </div>

                      {/* 🚀 ACTIVE EXPANDED BRANCH HIERARCHY PANEL */}
                      {activeBranch && (
                        <div className="w-full rounded-2xl border-2 border-blue-500/40 bg-card p-5 shadow-sm space-y-5 text-left animate-fadeIn mt-4">
                          {/* Active Branch Title Bar */}
                          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center text-xs font-bold shadow-2xs">
                                📍
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[8.5px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md border border-blue-500/20">
                                    Active Branch Hierarchy
                                  </span>
                                  <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">{activeBranch.name}</h3>
                                </div>
                                <p className="text-[10.5px] text-slate-400 font-bold mt-0.5">
                                  {activeBranch.city ? `📍 ${activeBranch.city} • ` : ''}{activeBranchDepts.length} Departments Registered
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setExpandedNodes({})}
                              className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                            >
                              Collapse Branch ✕
                            </button>
                          </div>

                          {/* Departments Horizontal Carousel / Compact Cards Row */}
                          <div className="space-y-3 pt-1">
                            {activeBranchDepts.length === 0 ? (
                              <div className="p-6 text-center text-slate-400 font-bold text-xs border-2 border-dashed border-slate-200/80 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/20">
                                No departments registered under {activeBranch.name}.
                              </div>
                            ) : (() => {
                              const activeDept = activeBranchDepts.find(d => expandedNodes[`dept-${d.id}`]);
                              const activeDeptEmps = activeDept ? employees.filter(e => e.department_id === activeDept.id || (e.branch_id === activeBranch.id && !e.department_id)) : [];

                              return (
                                <div className="space-y-3.5">
                                  {/* Department Section Header Bar */}
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-100 dark:border-slate-800/80">
                                    <div className="flex items-center gap-2.5">
                                      <div className="h-6 w-6 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center text-xs font-bold border border-purple-500/20">
                                        🏢
                                      </div>
                                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 font-outfit">
                                        Departments under <span className="text-purple-600 dark:text-purple-400">{activeBranch.name}</span>
                                      </h4>
                                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-purple-100/80 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60">
                                        {activeBranchDepts.length} Units
                                      </span>
                                    </div>
                                    <p className="text-[10.5px] font-semibold text-slate-400 dark:text-slate-500">
                                      Click card to view personnel matrix
                                    </p>
                                  </div>

                                  {/* Department Cards Horizontal Row */}
                                  <div className="relative w-full flex items-center justify-between gap-2.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const el = document.getElementById(`dept-carousel-${activeBranch.id}`);
                                        if (el) el.scrollBy({ left: -280, behavior: 'smooth' });
                                      }}
                                      className="h-9 w-9 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 shadow-2xs hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:text-purple-600 hover:border-purple-300 dark:hover:border-purple-700 flex items-center justify-center shrink-0 cursor-pointer transition-all active:scale-95 z-10"
                                      title="Scroll Left"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                                      </svg>
                                    </button>

                                    <div
                                      id={`dept-carousel-${activeBranch.id}`}
                                      className="flex items-center gap-3.5 overflow-x-auto no-scrollbar py-2 px-1 scroll-smooth w-full"
                                    >
                                      {activeBranchDepts.map(dept => {
                                        const isDeptExpanded = activeDept?.id === dept.id;
                                        const deptEmps = employees.filter(e => e.department_id === dept.id || (e.branch_id === activeBranch.id && !e.department_id));
                                        const firstLetter = dept.name ? dept.name.charAt(0).toUpperCase() : 'D';

                                        return (
                                          <div
                                            key={dept.id}
                                            onClick={() => toggleDeptNode(activeBranch.id, dept.id)}
                                            className={`w-[265px] min-w-[265px] max-w-[265px] rounded-2xl border-2 p-3.5 shadow-xs hover:shadow-md cursor-pointer transition-all duration-200 text-left select-none shrink-0 flex flex-col justify-between gap-3 ${
                                              isDeptExpanded
                                                ? 'border-purple-600 bg-gradient-to-br from-purple-600 via-indigo-600 to-purple-700 text-white shadow-lg shadow-purple-500/25 scale-[1.02]'
                                                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-purple-500 hover:-translate-y-0.5 text-slate-900 dark:text-slate-100'
                                            }`}
                                          >
                                            {/* Top Row: Initial Chip + Department Title + View Pill */}
                                            <div className="flex items-center justify-between gap-2.5 w-full">
                                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                <div className={`h-8 w-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 transition-colors ${
                                                  isDeptExpanded
                                                    ? 'bg-white/20 text-white border border-white/30'
                                                    : 'bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/40'
                                                }`}>
                                                  {firstLetter}
                                                </div>

                                                <h5 className={`text-xs font-black font-outfit uppercase tracking-tight truncate min-w-0 ${
                                                  isDeptExpanded ? 'text-white' : 'text-slate-900 dark:text-slate-100'
                                                }`} title={dept.name}>
                                                  {dept.name}
                                                </h5>
                                              </div>

                                              <span className={`text-[9.5px] font-extrabold px-2.5 py-1 rounded-xl shrink-0 border transition-all ${
                                                isDeptExpanded
                                                  ? 'bg-white text-purple-700 border-white shadow-xs'
                                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-700/80 hover:bg-purple-50 hover:text-purple-600'
                                              }`}>
                                                {isDeptExpanded ? 'Active ▲' : 'View ▼'}
                                              </span>
                                            </div>

                                            {/* Bottom Row: Staff Personnel Pill Count */}
                                            <div className={`flex items-center justify-between text-[10px] font-extrabold pt-2.5 border-t ${
                                              isDeptExpanded
                                                ? 'border-white/20 text-purple-100'
                                                : 'border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400'
                                            }`}>
                                              <span className="flex items-center gap-1.5">
                                                <svg className="w-3.5 h-3.5 opacity-80" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                                                </svg>
                                                <span>{deptEmps.length} Personnel</span>
                                              </span>

                                              <span className={`text-[9px] font-bold ${isDeptExpanded ? 'text-purple-200' : 'text-slate-400'}`}>
                                                Unit
                                              </span>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        const el = document.getElementById(`dept-carousel-${activeBranch.id}`);
                                        if (el) el.scrollBy({ left: 280, behavior: 'smooth' });
                                      }}
                                      className="h-9 w-9 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 shadow-2xs hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:text-purple-600 hover:border-purple-300 dark:hover:border-purple-700 flex items-center justify-center shrink-0 cursor-pointer transition-all active:scale-95 z-10"
                                      title="Scroll Right"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                      </svg>
                                    </button>
                                  </div>

                                  {/* Active Department Personnel Staff Grid */}
                                  {activeDept && (
                                    <div className="p-4 rounded-xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/20 dark:bg-purple-950/10 space-y-3 animate-fadeIn mt-3">
                                      <div className="flex items-center justify-between pb-2 border-b border-purple-100 dark:border-purple-900/40">
                                        <div className="flex items-center gap-2">
                                          <div className="h-5 w-5 rounded bg-purple-600 text-white flex items-center justify-center text-[10px] font-bold">
                                            👥
                                          </div>
                                          <h5 className="text-xs font-black text-slate-900 dark:text-slate-100">
                                            {activeDept.name} Personnel ({activeDeptEmps.length})
                                          </h5>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => toggleDeptNode(activeBranch.id, activeDept.id)}
                                          className="text-[10px] font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                        >
                                          Close Department ✕
                                        </button>
                                      </div>

                                      {activeDeptEmps.length === 0 ? (
                                        <p className="text-[10.5px] text-slate-400 font-bold italic py-2 text-center">
                                          No staff members assigned to this department.
                                        </p>
                                      ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 w-full">
                                          {activeDeptEmps.map(emp => {
                                            const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.name || emp.email.split('@')[0];
                                            const empInitials = fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                                            const avatarUrl = emp.emp_image || emp.profile_picture || emp.profile_image || emp.avatar_url || emp.photo_url || emp.avatar || emp.photo;
                                            const empCode = emp.emp_id_code || emp.employee_code || emp.emp_code;
                                            const designationText = emp.designation_name || emp.role || 'Team Member';
                                            const isInactive = emp.status && (emp.status.toUpperCase() === 'INACTIVE' || emp.status.toUpperCase() === 'DISABLED' || emp.status.toUpperCase() === 'TERMINATED');

                                            return (
                                              <div
                                                key={emp.id}
                                                className="p-2 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-2 shadow-2xs hover:border-purple-300 transition-all"
                                              >
                                                <div className="flex items-center gap-2 min-w-0">
                                                  {avatarUrl ? (
                                                    <img
                                                      src={avatarUrl}
                                                      alt={fullName}
                                                      className="h-7 w-7 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                                                      onError={(e) => {
                                                        (e.target as HTMLElement).style.display = 'none';
                                                      }}
                                                    />
                                                  ) : (
                                                    <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center text-[9px] font-black shrink-0 shadow-2xs">
                                                      {empInitials || 'EM'}
                                                    </div>
                                                  )}
                                                  <div className="text-left min-w-0">
                                                    <p className="text-[11px] font-bold text-slate-850 dark:text-slate-100 truncate">{fullName}</p>
                                                    <p className="text-[8.5px] font-semibold text-slate-400 dark:text-slate-500 truncate mt-0.5" title={`${designationText} ${empCode ? `(${empCode})` : ''}`}>
                                                      {designationText} {empCode && <span className="font-mono text-indigo-500 font-bold ml-0.5">#{empCode}</span>}
                                                    </p>
                                                  </div>
                                                </div>

                                                {isInactive ? (
                                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold bg-rose-50 text-rose-600 dark:bg-rose-950/40 border border-rose-200/60 shrink-0">
                                                    <span className="h-1 w-1 rounded-full bg-rose-500" />
                                                    Inactive
                                                  </span>
                                                ) : (
                                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 border border-emerald-200/60 shrink-0">
                                                    <span className="h-1 w-1 rounded-full bg-emerald-500" />
                                                    Active
                                                  </span>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      )}

                    </div>
                  );
                })()}

              </div>
            );
          })}
        </div>
      ) : (

        /* ========================================================================= */
        /* MODE 2: 📊 INTERACTIVE MATRIX DIRECTORY TABLE (Accordion Tree Table)      */
        /* ========================================================================= */
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 text-slate-400 font-extrabold uppercase tracking-widest text-[9.5px]">
                  <th className="py-3.5 px-4">Level / Entity Type</th>
                  <th className="py-3.5 px-4">Name / Title</th>
                  <th className="py-3.5 px-4">Context / Location</th>
                  <th className="py-3.5 px-4">Personnel Count</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Drill Down Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                {visibleCompanies.map(comp => {
                  const compBranches = branches.filter(b => !b.company_id || b.company_id === comp.id);
                  const compEmps = employees.filter(e => !e.company_id || e.company_id === comp.id);

                  return (
                    <React.Fragment key={comp.id}>
                      
                      {/* 🏢 COMPANY ROW */}
                      <tr className="bg-blue-50/20 dark:bg-blue-950/20 font-bold border-t-2 border-blue-500/20">
                        <td className="py-3 px-4 flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-blue-600 text-white text-[9px] font-black uppercase">Company</span>
                        </td>
                        <td className="py-3 px-4 font-black text-slate-850 dark:text-slate-100 text-sm">
                          {comp.name}
                        </td>
                        <td className="py-3 px-4 font-mono text-blue-500 text-xs">
                          {comp.subdomain}.hrms.com
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-700 dark:text-slate-300">
                          👥 {compEmps.length} Employees
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                            ACTIVE
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-slate-400 text-xs font-bold">
                          📍 {compBranches.length} Branches
                        </td>
                      </tr>

                      {/* 📍 BRANCH ROWS */}
                      {compBranches.map(branch => {
                        const isBranchExpanded = !!expandedNodes[`branch-${branch.id}`];
                        const branchDepts = departments.filter(d => d.branch_id === branch.id);
                        const branchEmps = employees.filter(e => e.branch_id === branch.id);

                        return (
                          <React.Fragment key={branch.id}>
                            <tr
                              onClick={() => toggleBranchNode(branch.id)}
                              className="hover:bg-slate-50 dark:hover:bg-slate-850 cursor-pointer transition-colors"
                            >
                              <td className="py-2.5 px-4 pl-8 flex items-center gap-2 text-slate-500">
                                <span className={`h-4.5 w-4.5 rounded-md flex items-center justify-center text-[10px] font-black transition-colors ${
                                  isBranchExpanded ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600'
                                }`}>
                                  {isBranchExpanded ? '▼' : '▶'}
                                </span>
                                <span className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 text-[8.5px] font-bold uppercase">
                                  Branch
                                </span>
                              </td>
                              <td className="py-2.5 px-4 font-bold text-slate-800 dark:text-slate-200">
                                {branch.name}
                              </td>
                              <td className="py-2.5 px-4 text-slate-500 text-[10px]">
                                {branch.city || 'Branch Office'}
                              </td>
                              <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400 font-medium">
                                📁 {branchDepts.length} Depts • 👥 {branchEmps.length} Staff
                              </td>
                              <td className="py-2.5 px-4">
                                <span className="text-[9px] font-bold text-indigo-500">Connected</span>
                              </td>
                              <td className="py-2.5 px-4 text-right text-[10px] font-bold text-indigo-600">
                                {isBranchExpanded ? 'Hide Departments' : 'Show Departments ▶'}
                              </td>
                            </tr>

                            {/* 📁 DEPARTMENT ROWS (ONLY VISIBLE WHEN BRANCH IS EXPANDED IN MATRIX!) */}
                            {isBranchExpanded && branchDepts.map(dept => {
                              const isDeptExpanded = !!expandedNodes[`dept-${dept.id}`];
                              const deptEmps = employees.filter(e => e.department_id === dept.id);

                              return (
                                <React.Fragment key={dept.id}>
                                  <tr
                                    onClick={() => toggleDeptNode(branch.id, dept.id)}
                                    className="bg-slate-50/50 dark:bg-slate-950/40 hover:bg-purple-50/30 cursor-pointer transition-colors border-l-4 border-l-purple-500"
                                  >
                                    <td className="py-2.5 px-4 pl-14 flex items-center gap-2 text-slate-400">
                                      <span className={`h-4.5 w-4.5 rounded-md flex items-center justify-center text-[10px] font-black transition-colors ${
                                        isDeptExpanded ? 'bg-purple-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600'
                                      }`}>
                                        {isDeptExpanded ? '▼' : '▶'}
                                      </span>
                                      <span className="px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/50 text-purple-600 text-[8.5px] font-bold uppercase">
                                        Department
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-4 font-bold text-slate-800 dark:text-slate-200">
                                      {dept.name}
                                    </td>
                                    <td className="py-2.5 px-4 text-slate-400 text-[9.5px] italic">
                                      {branch.name}
                                    </td>
                                    <td className="py-2.5 px-4 text-purple-600 dark:text-purple-400 font-bold">
                                      👥 {deptEmps.length} Employees
                                    </td>
                                    <td className="py-2.5 px-4 text-slate-400 text-[9px]">
                                      Operational
                                    </td>
                                    <td className="py-2.5 px-4 text-right text-[10px] font-bold text-purple-600">
                                      {isDeptExpanded ? 'Hide Staff' : 'View Staff ▶'}
                                    </td>
                                  </tr>

                                  {/* 👤 EMPLOYEE ROWS (ONLY VISIBLE WHEN DEPARTMENT IS EXPANDED IN MATRIX!) */}
                                  {isDeptExpanded && (
                                    deptEmps.length === 0 ? (
                                      <tr className="bg-slate-100/40 dark:bg-slate-900/40">
                                        <td colSpan={6} className="py-2 px-4 pl-24 text-[10px] italic text-slate-400">
                                          No personnel assigned to this department
                                        </td>
                                      </tr>
                                    ) : (
                                      deptEmps.map(emp => {
                                        const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.name || emp.email.split('@')[0];
                                        const empInitials = fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

                                        return (
                                          <tr key={emp.id} className="bg-emerald-50/20 dark:bg-emerald-950/10 hover:bg-emerald-50/40 transition-colors">
                                            <td className="py-2.5 px-4 pl-20 flex items-center gap-2">
                                              <div className="h-5.5 w-5.5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[8px] font-black shadow-2xs">
                                                {empInitials}
                                              </div>
                                              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[8px] font-extrabold uppercase">
                                                Staff Member
                                              </span>
                                            </td>
                                            <td className="py-2.5 px-4 font-bold text-slate-850 dark:text-slate-200 text-xs">
                                              {fullName}
                                            </td>
                                            <td className="py-2.5 px-4 text-slate-500 text-[10px]">
                                              {emp.designation_name || 'Team Member'} ({emp.email})
                                            </td>
                                            <td className="py-2.5 px-4 text-slate-500 font-mono text-[10px]">
                                              {emp.role || 'Employee'}
                                            </td>
                                            <td className="py-2.5 px-4">
                                              <span className="px-2 py-0.5 rounded bg-emerald-500 text-white text-[8px] font-extrabold">
                                                ACTIVE
                                              </span>
                                            </td>
                                            <td className="py-2.5 px-4 text-right text-slate-400 text-[9px]">
                                              Employee Node
                                            </td>
                                          </tr>
                                        );
                                      })
                                    )
                                  )}

                                </React.Fragment>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}

                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
