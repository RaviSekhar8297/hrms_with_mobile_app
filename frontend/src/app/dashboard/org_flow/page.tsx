'use client';

import React, { useEffect, useState, useRef } from 'react';
import DashboardPageHeader from '../components/DashboardPageHeader';
import { getHeaders, getUrl } from '../utils/api';
import { useDashboard } from '../components/DashboardContext';
import PageLoader from '@/components/ui/PageLoader';

interface Company {
  id: string;
  name: string;
  subdomain?: string;
  branding_logo?: string;
  status?: string;
  created_at?: string;
}

interface Branch {
  id: string;
  company_id: string;
  name: string;
  branch_code?: string;
  city?: string;
  state?: string;
  is_active?: boolean;
}

interface Department {
  id: string;
  company_id: string;
  branch_id?: string;
  name: string;
  dept_code?: string;
  is_active?: boolean;
}

interface Employee {
  id: string;
  company_id: string;
  branch_id?: string;
  department_id?: string;
  dept_id?: string;
  first_name: string;
  last_name?: string;
  email: string;
  phone?: string;
  designation_name?: string;
  department_name?: string;
  branch_name?: string;
  emp_id_code?: string;
  status?: string;
  emp_image?: string;
  profile_picture?: string;
  avatar_url?: string;
  photo?: string;
}

export default function OrgFlowPage() {
  const { showToast } = useDashboard();
  const [loading, setLoading] = useState<boolean>(true);

  // Datasets
  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Selection Hierarchy (STRICT STEP BY STEP)
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);

  // Search Filter for Personnel
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState<string>('');

  // Carousel Refs
  const compCarouselRef = useRef<HTMLDivElement>(null);
  const branchCarouselRef = useRef<HTMLDivElement>(null);
  const deptCarouselRef = useRef<HTMLDivElement>(null);

  // Fetch Datasets
  useEffect(() => {
    const fetchOrgData = async () => {
      setLoading(true);
      try {
        // 1. Fetch Companies
        const compRes = await fetch(getUrl('/api/v1/companies'), { headers: getHeaders() });
        const compData = await compRes.json();
        const compList: Company[] = compData.companies || [];
        setCompanies(compList);

        // Auto-select first company if only 1 exists
        if (compList.length === 1) {
          setSelectedCompanyId(compList[0].id);
        }

        // 2. Fetch Branches
        const branchRes = await fetch(getUrl('/api/v1/branches'), { headers: getHeaders() });
        if (branchRes.ok) {
          const branchData = await branchRes.json();
          setBranches(branchData.branches || branchData || []);
        }

        // 3. Fetch Departments
        const deptRes = await fetch(getUrl('/api/v1/departments'), { headers: getHeaders() });
        if (deptRes.ok) {
          const deptData = await deptRes.json();
          setDepartments(deptData.departments || deptData || []);
        }

        // 4. Fetch Employees
        const empRes = await fetch(getUrl('/api/v1/employees?limit=1000'), { headers: getHeaders() });
        if (empRes.ok) {
          const empData = await empRes.json();
          setEmployees(empData.employees || empData || []);
        }
      } catch (err) {
        console.error('Error fetching org flow data:', err);
        showToast('Failed to load organization hierarchy data', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchOrgData();
  }, []);

  // Scroll Helper
  const scrollRef = (ref: React.RefObject<HTMLDivElement | null>, direction: 'left' | 'right') => {
    if (ref.current) {
      const scrollAmount = direction === 'left' ? -300 : 300;
      ref.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Filtered Branches for selected Company
  const visibleBranches = branches.filter(b => 
    selectedCompanyId ? String(b.company_id) === String(selectedCompanyId) : false
  );

  // Filtered Departments for selected Branch / Company
  const visibleDepartments = departments.filter(d => {
    if (!selectedCompanyId || !selectedBranchId) return false;
    if (d.company_id && String(d.company_id) !== String(selectedCompanyId)) return false;
    if (d.branch_id && String(d.branch_id) !== String(selectedBranchId)) return false;
    return true;
  });

  // Filtered Employees STRICT MATCH on Selected Department
  const rawVisibleEmployees = employees.filter(e => {
    if (!selectedCompanyId || !selectedBranchId || !selectedDeptId) return false;

    // STRICT Department check
    const empDept = e.department_id || e.dept_id;
    if (!empDept || String(empDept) !== String(selectedDeptId)) return false;

    // Optional Branch check if assigned
    if (e.branch_id && String(e.branch_id) !== String(selectedBranchId)) return false;

    // Optional Company check if assigned
    if (e.company_id && String(e.company_id) !== String(selectedCompanyId)) return false;

    return true;
  });

  // Filter by search query if user types in search
  const visibleEmployees = rawVisibleEmployees.filter(emp => {
    if (!employeeSearchQuery.trim()) return true;
    const q = employeeSearchQuery.toLowerCase();
    const fullName = `${emp.first_name} ${emp.last_name || ''}`.toLowerCase();
    const desig = (emp.designation_name || '').toLowerCase();
    const email = (emp.email || '').toLowerCase();
    const code = (emp.emp_id_code || '').toLowerCase();
    return fullName.includes(q) || desig.includes(q) || email.includes(q) || code.includes(q);
  });

  // Handlers
  const handleSelectCompany = (comp: Company) => {
    if (selectedCompanyId === comp.id) {
      setSelectedCompanyId(null);
      setSelectedBranchId(null);
      setSelectedDeptId(null);
      setEmployeeSearchQuery('');
    } else {
      setSelectedCompanyId(comp.id);
      setSelectedBranchId(null);
      setSelectedDeptId(null);
      setEmployeeSearchQuery('');
    }
  };

  const handleSelectBranch = (branch: Branch) => {
    if (selectedBranchId === branch.id) {
      setSelectedBranchId(null);
      setSelectedDeptId(null);
      setEmployeeSearchQuery('');
    } else {
      setSelectedBranchId(branch.id);
      setSelectedDeptId(null);
      setEmployeeSearchQuery('');
    }
  };

  const handleSelectDepartment = (dept: Department) => {
    if (selectedDeptId === dept.id) {
      setSelectedDeptId(null);
      setEmployeeSearchQuery('');
    } else {
      setSelectedDeptId(dept.id);
      setEmployeeSearchQuery('');
    }
  };

  const resetAllSelections = () => {
    setSelectedCompanyId(null);
    setSelectedBranchId(null);
    setSelectedDeptId(null);
    setEmployeeSearchQuery('');
  };

  const selectedCompany = companies.find(c => c.id === selectedCompanyId);
  const selectedBranch = branches.find(b => b.id === selectedBranchId);
  const selectedDept = departments.find(d => d.id === selectedDeptId);

  // Image Helper
  const getEmployeeImageSrc = (emp: Employee): string | null => {
    const raw = emp.emp_image || emp.profile_picture || emp.avatar_url || emp.photo;
    if (!raw || raw === 'null' || raw === 'undefined') return null;
    if (raw.startsWith('data:') || raw.startsWith('http://') || raw.startsWith('https://')) {
      return raw;
    }
    return getUrl(raw);
  };

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }} className="org-flow-root font-dmsans space-y-4 pb-20 text-left">
      <style jsx global>{`
        .org-flow-root,
        .org-flow-root * {
          font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        }
      `}</style>

      {/* Header Banner */}
      <DashboardPageHeader
        title="Organization Flow Directory"
        hideCompanySelect={true}
      />

      {loading ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <PageLoader message="Loading Organization Hierarchy..." />
        </div>
      ) : (
        <div className="space-y-4">

          {/* Top Breadcrumb Path & Reset Action */}
          {(selectedCompany || selectedBranch || selectedDept) && (
            <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 px-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs shadow-2xs animate-fadeIn">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Flow:</span>
                
                {selectedCompany && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[#07518a]/10 text-[#07518a] dark:text-blue-300 font-bold border border-[#07518a]/20">
                    🏢 {selectedCompany.name}
                  </span>
                )}

                {selectedBranch && (
                  <>
                    <span className="text-slate-300 dark:text-slate-600 font-bold">→</span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800">
                      📍 {selectedBranch.name}
                    </span>
                  </>
                )}

                {selectedDept && (
                  <>
                    <span className="text-slate-300 dark:text-slate-600 font-bold">→</span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 font-bold border border-teal-200 dark:border-teal-800">
                      📂 {selectedDept.name}
                    </span>
                  </>
                )}
              </div>

              <button
                onClick={resetAllSelections}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-slate-700 text-[11px] font-bold transition-all cursor-pointer"
              >
                <span>✕</span> Reset
              </button>
            </div>
          )}

          {/* ======================================================== */}
          {/* STEP 1: COMPANIES CAROUSEL */}
          {/* ======================================================== */}
          <div className="space-y-2.5 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-[#07518a]/10 text-[#07518a] dark:text-blue-300 border border-[#07518a]/20 text-[10px] font-extrabold uppercase tracking-wider">
                  Step 01
                </span>
                <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                  Select Corporate Company
                </h3>
                <span className="text-[10px] font-bold text-slate-400">
                  ({companies.length})
                </span>
              </div>
              <span className="text-[10px] font-medium text-slate-400">
                Click a company card to reveal branches
              </span>
            </div>

            {/* Carousel Box */}
            <div className="flex items-center gap-2 pt-0.5">
              {/* Left Arrow */}
              <button
                type="button"
                onClick={() => scrollRef(compCarouselRef, 'left')}
                className="h-8 w-8 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:text-[#07518a] dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0 shadow-2xs"
                title="Scroll Left"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>

              {/* Scrollable Container */}
              <div
                ref={compCarouselRef}
                className="flex gap-3 overflow-x-auto no-scrollbar scroll-smooth py-1.5 px-0.5 flex-1"
              >
                {companies.map((comp) => {
                  const isSelected = selectedCompanyId === comp.id;
                  const compBranches = branches.filter(b => String(b.company_id) === String(comp.id));
                  const compEmps = employees.filter(e => String(e.company_id) === String(comp.id));

                  return (
                    <div
                      key={comp.id}
                      onClick={() => handleSelectCompany(comp)}
                      className={`w-72 shrink-0 p-3.5 rounded-xl border transition-all duration-150 cursor-pointer relative flex flex-col justify-between ${
                        isSelected
                          ? 'bg-[#07518a]/5 dark:bg-[#07518a]/15 border-2 border-[#07518a] shadow-sm'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-[#07518a]/50 dark:hover:border-blue-500/50 hover:shadow-xs'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Clean Logo Box */}
                        <div className="w-12 h-12 rounded-xl bg-white border border-slate-200/80 shadow-2xs flex items-center justify-center shrink-0 p-1.5 overflow-hidden">
                          {comp.branding_logo ? (
                            <img
                              src={comp.branding_logo}
                              alt={comp.name}
                              className="w-9 h-9 object-contain"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <span className="font-black text-lg text-[#07518a] uppercase">
                              {comp.name.charAt(0)}
                            </span>
                          )}
                        </div>

                        {/* Company Info */}
                        <div className="flex-1 min-w-0 pr-4">
                          <h4 className="font-bold text-xs leading-snug line-clamp-1 text-slate-900 dark:text-white">
                            {comp.name}
                          </h4>
                          <span className="text-[9.5px] font-medium block truncate text-slate-400 mt-0.5">
                            {comp.subdomain ? `${comp.subdomain}.hrms.com` : 'Corporate Tenant'}
                          </span>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[9.5px] font-bold text-slate-500 dark:text-slate-400">
                        <span>📍 {compBranches.length} Branches</span>
                        <span>👥 {compEmps.length} Staff</span>
                      </div>

                      {/* Checkmark */}
                      {isSelected && (
                        <div className="absolute top-2.5 right-2.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[#07518a] text-white text-[9.5px] font-black shadow-xs">
                          ✓
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Right Arrow */}
              <button
                type="button"
                onClick={() => scrollRef(compCarouselRef, 'right')}
                className="h-8 w-8 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:text-[#07518a] dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0 shadow-2xs"
                title="Scroll Right"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>
          </div>

          {/* ======================================================== */}
          {/* STEP 2: BRANCHES CAROUSEL */}
          {/* ======================================================== */}
          {selectedCompanyId && (
            <div className="space-y-2.5 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs animate-fadeIn">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-[10px] font-extrabold uppercase tracking-wider">
                    Step 02
                  </span>
                  <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                    Regional Branches in &quot;{selectedCompany?.name}&quot;
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400">
                    ({visibleBranches.length})
                  </span>
                </div>
                <span className="text-[10px] font-medium text-slate-400">
                  Click a branch card to reveal departments
                </span>
              </div>

              {visibleBranches.length === 0 ? (
                <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40">
                  <p className="text-xs font-medium text-slate-500">No regional branches registered under this company yet.</p>
                </div>
              ) : (
                <div className="flex items-center gap-2 pt-0.5">
                  {/* Left Arrow */}
                  <button
                    type="button"
                    onClick={() => scrollRef(branchCarouselRef, 'left')}
                    className="h-8 w-8 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0 shadow-2xs"
                    title="Scroll Left"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                  </button>

                  {/* Scrollable Container */}
                  <div
                    ref={branchCarouselRef}
                    className="flex gap-3 overflow-x-auto no-scrollbar scroll-smooth py-1.5 px-0.5 flex-1"
                  >
                    {visibleBranches.map((branch) => {
                      const isSelected = selectedBranchId === branch.id;
                      const branchDepts = departments.filter(d => 
                        (d.branch_id && String(d.branch_id) === String(branch.id)) || 
                        (!d.branch_id && String(d.company_id) === String(branch.company_id))
                      );
                      const branchEmps = employees.filter(e => e.branch_id && String(e.branch_id) === String(branch.id));

                      return (
                        <div
                          key={branch.id}
                          onClick={() => handleSelectBranch(branch)}
                          className={`w-56 shrink-0 p-3.5 rounded-xl border transition-all duration-150 cursor-pointer relative ${
                            isSelected
                              ? 'bg-indigo-50/60 dark:bg-indigo-950/30 border-2 border-indigo-600 shadow-sm'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-400/50 dark:hover:border-indigo-500/50 hover:shadow-xs'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-2 min-w-0 pr-4">
                              <span className="text-sm">📍</span>
                              <div className="min-w-0">
                                <h4 className="font-bold text-xs truncate text-slate-900 dark:text-white">
                                  {branch.name}
                                </h4>
                                <span className="text-[9.5px] font-medium block truncate text-slate-400">
                                  Code: {branch.branch_code || 'MAIN'}
                                </span>
                              </div>
                            </div>

                            {isSelected && (
                              <div className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-indigo-600 text-white text-[9.5px] font-black shadow-xs shrink-0">
                                ✓
                              </div>
                            )}
                          </div>

                          {/* Stats */}
                          <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[9.5px] font-bold text-slate-500 dark:text-slate-400">
                            <span>📂 {branchDepts.length} Depts</span>
                            <span>👥 {branchEmps.length} Staff</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Right Arrow */}
                  <button
                    type="button"
                    onClick={() => scrollRef(branchCarouselRef, 'right')}
                    className="h-8 w-8 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0 shadow-2xs"
                    title="Scroll Right"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* STEP 3: DEPARTMENTS CAROUSEL */}
          {/* ======================================================== */}
          {selectedCompanyId && selectedBranchId && (
            <div className="space-y-2.5 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs animate-fadeIn">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 text-[10px] font-extrabold uppercase tracking-wider">
                    Step 03
                  </span>
                  <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                    Departments in &quot;{selectedBranch?.name}&quot;
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400">
                    ({visibleDepartments.length})
                  </span>
                </div>
                <span className="text-[10px] font-medium text-slate-400">
                  Click a department card to view personnel
                </span>
              </div>

              {visibleDepartments.length === 0 ? (
                <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40">
                  <p className="text-xs font-medium text-slate-500">No departments configured under this branch.</p>
                </div>
              ) : (
                <div className="flex items-center gap-2 pt-0.5">
                  {/* Left Arrow */}
                  <button
                    type="button"
                    onClick={() => scrollRef(deptCarouselRef, 'left')}
                    className="h-8 w-8 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0 shadow-2xs"
                    title="Scroll Left"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                  </button>

                  {/* Scrollable Container */}
                  <div
                    ref={deptCarouselRef}
                    className="flex gap-3 overflow-x-auto no-scrollbar scroll-smooth py-1.5 px-0.5 flex-1"
                  >
                    {visibleDepartments.map((dept) => {
                      const isSelected = selectedDeptId === dept.id;
                      const deptPersonnel = employees.filter(e => {
                        const empDept = e.department_id || e.dept_id;
                        return empDept && String(empDept) === String(dept.id);
                      });

                      return (
                        <div
                          key={dept.id}
                          onClick={() => handleSelectDepartment(dept)}
                          className={`w-52 shrink-0 p-3.5 rounded-xl border transition-all duration-150 cursor-pointer relative ${
                            isSelected
                              ? 'bg-teal-50/60 dark:bg-teal-950/30 border-2 border-teal-600 shadow-sm'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-teal-400/50 dark:hover:border-teal-500/50 hover:shadow-xs'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-2 min-w-0 pr-4">
                              <span className="text-sm">📂</span>
                              <div className="min-w-0">
                                <h5 className="font-bold text-xs truncate text-slate-900 dark:text-white">
                                  {dept.name}
                                </h5>
                                <span className="text-[9.5px] font-medium block truncate text-slate-400">
                                  {deptPersonnel.length} Personnel
                                </span>
                              </div>
                            </div>

                            {isSelected && (
                              <div className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-teal-600 text-white text-[9.5px] font-black shadow-xs shrink-0">
                                ✓
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Right Arrow */}
                  <button
                    type="button"
                    onClick={() => scrollRef(deptCarouselRef, 'right')}
                    className="h-8 w-8 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0 shadow-2xs"
                    title="Scroll Right"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* STEP 4: PERSONNEL DIRECTORY */}
          {/* ======================================================== */}
          {selectedCompanyId && selectedBranchId && selectedDeptId && (
            <div className="space-y-3 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs animate-fadeIn">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-extrabold uppercase tracking-wider">
                    Step 04
                  </span>
                  <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                    Personnel Directory in &quot;{selectedDept?.name}&quot;
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400">
                    ({rawVisibleEmployees.length})
                  </span>
                </div>

                {/* Quick Search */}
                <div className="relative w-full sm:w-60">
                  <input
                    type="text"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    value={employeeSearchQuery}
                    onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                    placeholder="Search personnel..."
                    className="w-full pl-7 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 outline-none focus:border-emerald-500 transition-all shadow-2xs"
                  />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                    🔍
                  </span>
                  {employeeSearchQuery && (
                    <button
                      onClick={() => setEmployeeSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {rawVisibleEmployees.length === 0 ? (
                <div className="p-8 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40">
                  <p className="text-xs font-medium text-slate-500">No personnel registered in this department.</p>
                </div>
              ) : visibleEmployees.length === 0 ? (
                <div className="p-6 text-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                  <p className="text-xs font-medium text-slate-500">No personnel match &quot;{employeeSearchQuery}&quot;</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {visibleEmployees.map((emp) => {
                    const initials = `${emp.first_name?.charAt(0) || ''}${emp.last_name?.charAt(0) || ''}`.toUpperCase();
                    const imgSrc = getEmployeeImageSrc(emp);
                    const empStatus = (emp.status || 'ACTIVE').toUpperCase();
                    const isEmpActive = empStatus === 'ACTIVE';

                    return (
                      <div
                        key={emp.id}
                        className={`p-3 rounded-xl border bg-white dark:bg-slate-900 transition-all duration-150 flex items-center gap-2.5 shadow-2xs ${
                          isEmpActive 
                            ? 'border-slate-200/80 dark:border-slate-800 hover:border-emerald-500/50 hover:shadow-xs' 
                            : 'opacity-75 border-slate-200/70 dark:border-slate-800/70 bg-slate-50/50 dark:bg-slate-900/50'
                        }`}
                      >
                        {/* Avatar */}
                        <div className={`h-9 w-9 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 overflow-hidden border ${
                          isEmpActive 
                            ? 'bg-[#07518a]/10 text-[#07518a] dark:text-blue-300 border-[#07518a]/20' 
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                        }`}>
                          {imgSrc ? (
                            <img
                              src={imgSrc}
                              alt={emp.first_name}
                              className="h-9 w-9 object-cover rounded-lg"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            initials || 'EM'
                          )}
                        </div>

                        {/* Employee Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {emp.first_name} {emp.last_name || ''}
                            </h4>
                            
                            {/* Status */}
                            <span className={`text-[8px] font-black px-1.5 py-0.2 rounded border shrink-0 ${
                              isEmpActive 
                                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' 
                                : 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                            }`}>
                              {empStatus}
                            </span>
                          </div>

                          <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate">
                            {emp.designation_name || 'Team Member'}
                          </p>

                          <div className="flex items-center justify-between text-[9px] text-slate-400 truncate mt-0.5">
                            <span className="truncate">{emp.email}</span>
                            <span className="font-mono font-bold text-slate-600 dark:text-slate-300 ml-1 shrink-0">
                              #{emp.emp_id_code || 'EMP'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
}
