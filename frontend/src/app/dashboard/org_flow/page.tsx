'use client';

import React, { useEffect, useState, useRef } from 'react';
import DashboardPageHeader from '../components/DashboardPageHeader';
import { getHeaders, getUrl } from '../utils/api';
import { useDashboard } from '../components/DashboardContext';

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
  const [roles, setRoles] = useState<string[]>([]);
  const [userCompanyId, setUserCompanyId] = useState<string | null>(null);
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

  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('superadmin');

  // Carousel Refs
  const compCarouselRef = useRef<HTMLDivElement>(null);
  const branchCarouselRef = useRef<HTMLDivElement>(null);
  const deptCarouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const storedRoles = localStorage.getItem('roles');
    const storedCompanyId = localStorage.getItem('companyId');
    if (storedRoles) setRoles(JSON.parse(storedRoles));
    if (storedCompanyId) setUserCompanyId(storedCompanyId);
  }, []);

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
      const scrollAmount = direction === 'left' ? -280 : 280;
      ref.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Filtered Companies
  const visibleCompanies = isSuperAdmin 
    ? companies 
    : companies.filter(c => c.id === userCompanyId);

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

  // Filtered Employees STRICT MATCH on Selected Department! (Includes ACTIVE & INACTIVE)
  const visibleEmployees = employees.filter(e => {
    if (!selectedCompanyId || !selectedBranchId || !selectedDeptId) return false;

    // STRICT Department check: employee MUST have department_id matching selectedDeptId!
    const empDept = e.department_id || e.dept_id;
    if (!empDept || String(empDept) !== String(selectedDeptId)) return false;

    // Optional Branch check if assigned
    if (e.branch_id && String(e.branch_id) !== String(selectedBranchId)) return false;

    // Optional Company check if assigned
    if (e.company_id && String(e.company_id) !== String(selectedCompanyId)) return false;

    return true;
  });

  // Handlers
  const handleSelectCompany = (comp: Company) => {
    if (selectedCompanyId === comp.id) {
      setSelectedCompanyId(null);
      setSelectedBranchId(null);
      setSelectedDeptId(null);
    } else {
      setSelectedCompanyId(comp.id);
      setSelectedBranchId(null);
      setSelectedDeptId(null);
    }
  };

  const handleSelectBranch = (branch: Branch) => {
    if (selectedBranchId === branch.id) {
      setSelectedBranchId(null);
      setSelectedDeptId(null);
    } else {
      setSelectedBranchId(branch.id);
      setSelectedDeptId(null);
    }
  };

  const handleSelectDepartment = (dept: Department) => {
    if (selectedDeptId === dept.id) {
      setSelectedDeptId(null);
    } else {
      setSelectedDeptId(dept.id);
    }
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
    <div className="space-y-6 pb-20">
      {/* Header Banner */}
      <DashboardPageHeader
        title="Organization Flow Directory"
        hideCompanySelect={true}
      />

      {loading ? (
        <div className="p-16 text-center space-y-3">
          <div className="w-8 h-8 border-4 border-[#07518a] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Loading Enterprise Flow...</p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* STEP 1: COMPANIES CAROUSEL */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse" />
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">
                  Step 1: Select Corporate Company ({visibleCompanies.length})
                </h3>
              </div>
              <span className="text-[10px] font-bold text-slate-400">
                Click a company card to reveal regional branches
              </span>
            </div>

            {/* Carousel Box */}
            <div className="relative flex items-center">
              {/* Light Sleek Left Arrow */}
              <button
                onClick={() => scrollRef(compCarouselRef, 'left')}
                className="z-10 h-6.5 w-6.5 rounded-full bg-white/90 dark:bg-slate-800/90 text-slate-400 hover:text-slate-800 dark:hover:text-white shadow-xs border border-slate-200/80 dark:border-slate-700 flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0 -mr-2 text-[9px]"
                title="Scroll Left"
              >
                ◀
              </button>

              {/* Scrollable Container */}
              <div
                ref={compCarouselRef}
                className="flex gap-4 overflow-x-auto no-scrollbar scroll-smooth px-3 py-1.5 w-full"
              >
                {visibleCompanies.map((comp) => {
                  const isSelected = selectedCompanyId === comp.id;
                  const compBranches = branches.filter(b => String(b.company_id) === String(comp.id));
                  const compEmps = employees.filter(e => String(e.company_id) === String(comp.id));

                  return (
                    <div
                      key={comp.id}
                      onClick={() => handleSelectCompany(comp)}
                      className={`w-80 shrink-0 p-4 rounded-2xl border transition-all cursor-pointer shadow-xs hover:shadow-lg relative flex flex-col justify-between ${
                        isSelected
                          ? 'bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 text-white border-violet-400 ring-2 ring-violet-400/40 shadow-violet-500/20'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-violet-300 dark:hover:border-violet-700 hover:bg-slate-50/70 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        {/* 🌟 ENLARGED PROMINENT LOGO CONTAINER */}
                        <div className={`w-20 h-20 rounded-2xl flex items-center justify-center shrink-0 shadow-md p-1.5 ${
                          isSelected 
                            ? 'bg-white/20 border border-white/30 backdrop-blur-md text-white' 
                            : 'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400'
                        }`}>
                          {comp.branding_logo ? (
                            <img src={comp.branding_logo} alt={comp.name} className="w-16 h-16 object-contain rounded-xl" />
                          ) : (
                            <span className="font-black text-3xl uppercase">{comp.name.charAt(0)}</span>
                          )}
                        </div>

                        {/* Company Info */}
                        <div className="flex-1 min-w-0">
                          <h4 className={`font-black text-xs leading-snug break-words ${isSelected ? 'text-white' : 'text-slate-800 dark:text-slate-100'}`}>
                            {comp.name}
                          </h4>
                          <span className={`text-[10px] font-semibold block truncate mt-1 ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                            {comp.subdomain ? `${comp.subdomain}.hrms.com` : 'Corporate Tenant'}
                          </span>
                        </div>
                      </div>

                      {/* Stats Footer */}
                      <div className="mt-3.5 pt-2.5 border-t border-slate-100/20 dark:border-slate-800/40 flex items-center justify-between text-[10px] font-black">
                        <span className={isSelected ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'}>
                          📍 {compBranches.length} Branches
                        </span>
                        <span className={isSelected ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'}>
                          👥 {compEmps.length} Personnel
                        </span>
                      </div>

                      {isSelected && (
                        <div className="absolute top-2 right-2 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-white text-violet-600 text-[10px] font-black shadow-xs">
                          ✓
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Light Sleek Right Arrow */}
              <button
                onClick={() => scrollRef(compCarouselRef, 'right')}
                className="z-10 h-6.5 w-6.5 rounded-full bg-white/90 dark:bg-slate-800/90 text-slate-400 hover:text-slate-800 dark:hover:text-white shadow-xs border border-slate-200/80 dark:border-slate-700 flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0 -ml-2 text-[9px]"
                title="Scroll Right"
              >
                ▶
              </button>
            </div>
          </div>

          {/* FLOW CONNECTOR LINE 1 */}
          {selectedCompanyId && (
            <div className="flex flex-col items-center justify-center -my-2 animate-fadeIn">
              <div className="w-0.5 h-6 bg-gradient-to-b from-blue-500 to-indigo-500 rounded-full shadow-xs" />
              <div className="w-2 h-2 rounded-full bg-indigo-500 border-2 border-white dark:border-slate-900 shadow-xs" />
            </div>
          )}

          {/* STEP 2: BRANCHES CAROUSEL (ONLY AFTER COMPANY CLICKED) */}
          {selectedCompanyId && (
            <div className="space-y-2 pt-2 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 animate-pulse" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                    Step 2: Regional Branches in "{selectedCompany?.name}" ({visibleBranches.length})
                  </h3>
                </div>
                <span className="text-[10px] font-bold text-slate-400">
                  Click a branch card to reveal departments
                </span>
              </div>

              {visibleBranches.length === 0 ? (
                <div className="p-6 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50">
                  <p className="text-xs font-bold text-slate-500">No regional branches registered under this company yet.</p>
                </div>
              ) : (
                <div className="relative flex items-center">
                  <button
                    onClick={() => scrollRef(branchCarouselRef, 'left')}
                    className="z-10 h-6.5 w-6.5 rounded-full bg-white/90 dark:bg-slate-800/90 text-slate-400 hover:text-slate-800 dark:hover:text-white shadow-xs border border-slate-200/80 dark:border-slate-700 flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0 -mr-2 text-[9px]"
                  >
                    ◀
                  </button>

                  <div
                    ref={branchCarouselRef}
                    className="flex gap-3.5 overflow-x-auto no-scrollbar scroll-smooth px-3 py-1.5 w-full"
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
                          className={`w-60 shrink-0 p-3 rounded-2xl border transition-all cursor-pointer shadow-xs hover:shadow-md relative ${
                            isSelected
                              ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white border-indigo-400 ring-2 ring-indigo-400/40 shadow-indigo-500/20'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-slate-50/70 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="text-lg">📍</span>
                              <div className="min-w-0">
                                <h4 className={`font-extrabold text-xs truncate ${isSelected ? 'text-white' : 'text-slate-800 dark:text-slate-100'}`}>
                                  {branch.name}
                                </h4>
                                <span className={`text-[10px] font-medium block truncate ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                                  Code: {branch.branch_code || 'MAIN'}
                                </span>
                              </div>
                            </div>
                            {isSelected && <span className="text-[10px] text-white font-black">✓</span>}
                          </div>

                          <div className="mt-2.5 pt-2 border-t border-slate-100/20 flex items-center justify-between text-[10px] font-black">
                            <span className={isSelected ? 'text-indigo-100' : 'text-slate-500'}>
                              📂 {branchDepts.length} Depts
                            </span>
                            <span className={isSelected ? 'text-indigo-100' : 'text-slate-500'}>
                              👥 {branchEmps.length} Staff
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => scrollRef(branchCarouselRef, 'right')}
                    className="z-10 h-6.5 w-6.5 rounded-full bg-white/90 dark:bg-slate-800/90 text-slate-400 hover:text-slate-800 dark:hover:text-white shadow-xs border border-slate-200/80 dark:border-slate-700 flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0 -ml-2 text-[9px]"
                  >
                    ▶
                  </button>
                </div>
              )}
            </div>
          )}

          {/* FLOW CONNECTOR LINE 2 */}
          {selectedCompanyId && selectedBranchId && (
            <div className="flex flex-col items-center justify-center -my-2 animate-fadeIn">
              <div className="w-0.5 h-6 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full shadow-xs" />
              <div className="w-2 h-2 rounded-full bg-purple-500 border-2 border-white dark:border-slate-900 shadow-xs" />
            </div>
          )}

          {/* STEP 3: DEPARTMENTS CAROUSEL (ONLY AFTER BRANCH CLICKED) */}
          {selectedCompanyId && selectedBranchId && (
            <div className="space-y-2 pt-2 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-purple-500 animate-pulse" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-purple-600 dark:text-purple-400">
                    Step 3: Departments in "{selectedBranch?.name}" ({visibleDepartments.length})
                  </h3>
                </div>
                <span className="text-[10px] font-bold text-slate-400">
                  Click a department card to view personnel
                </span>
              </div>

              {visibleDepartments.length === 0 ? (
                <div className="p-6 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50">
                  <p className="text-xs font-bold text-slate-500">No departments configured under this branch.</p>
                </div>
              ) : (
                <div className="relative flex items-center">
                  <button
                    onClick={() => scrollRef(deptCarouselRef, 'left')}
                    className="z-10 h-6.5 w-6.5 rounded-full bg-white/90 dark:bg-slate-800/90 text-slate-400 hover:text-slate-800 dark:hover:text-white shadow-xs border border-slate-200/80 dark:border-slate-700 flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0 -mr-2 text-[9px]"
                  >
                    ◀
                  </button>

                  <div
                    ref={deptCarouselRef}
                    className="flex gap-3 overflow-x-auto no-scrollbar scroll-smooth px-3 py-1.5 w-full"
                  >
                    {visibleDepartments.map((dept) => {
                      const isSelected = selectedDeptId === dept.id;
                      // Total count of ALL personnel in THIS department
                      const deptPersonnel = employees.filter(e => {
                        const empDept = e.department_id || e.dept_id;
                        return empDept && String(empDept) === String(dept.id);
                      });

                      return (
                        <div
                          key={dept.id}
                          onClick={() => handleSelectDepartment(dept)}
                          className={`w-52 shrink-0 p-3 rounded-xl border transition-all cursor-pointer relative ${
                            isSelected
                              ? 'bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 text-white border-purple-400 ring-2 ring-purple-400/40 shadow-purple-500/20'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-700 hover:bg-slate-50/70 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-base">📂</span>
                              <div className="min-w-0">
                                <h5 className={`font-black text-xs truncate ${isSelected ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>
                                  {dept.name}
                                </h5>
                                <span className={`text-[9px] font-bold block ${isSelected ? 'text-purple-100' : 'text-slate-400'}`}>
                                  {deptPersonnel.length} Personnel
                                </span>
                              </div>
                            </div>
                            {isSelected && <span className="text-[10px] font-black text-white">✓</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => scrollRef(deptCarouselRef, 'right')}
                    className="z-10 h-6.5 w-6.5 rounded-full bg-white/90 dark:bg-slate-800/90 text-slate-400 hover:text-slate-800 dark:hover:text-white shadow-xs border border-slate-200/80 dark:border-slate-700 flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0 -ml-2 text-[9px]"
                  >
                    ▶
                  </button>
                </div>
              )}
            </div>
          )}

          {/* FLOW CONNECTOR LINE 3 */}
          {selectedCompanyId && selectedBranchId && selectedDeptId && (
            <div className="flex flex-col items-center justify-center -my-2 animate-fadeIn">
              <div className="w-0.5 h-6 bg-gradient-to-b from-purple-500 to-emerald-500 rounded-full shadow-xs" />
              <div className="w-2 h-2 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 shadow-xs" />
            </div>
          )}

          {/* STEP 4: EMPLOYEES CARDS (SHOWS ACTIVE AND INACTIVE WITH CLEAR STATUS BADGES) */}
          {selectedCompanyId && selectedBranchId && selectedDeptId && (
            <div className="space-y-3 pt-2 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                    Step 4: Personnel Directory in "{selectedDept?.name}" ({visibleEmployees.length})
                  </h3>
                </div>
              </div>

              {visibleEmployees.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50">
                  <span className="text-2xl block mb-1">👤</span>
                  <p className="text-xs font-bold text-slate-500">No personnel registered in this department.</p>
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
                        className={`p-2.5 rounded-xl border bg-white dark:bg-slate-900 transition-all flex items-center gap-2.5 shadow-xs ${
                          isEmpActive 
                            ? 'hover:border-emerald-500/40 hover:shadow-md' 
                            : 'opacity-85 border-slate-200/90 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40'
                        }`}
                      >
                        {/* AVATAR / REAL EMPLOYEE PHOTO */}
                        <div className={`h-9 w-9 rounded-xl font-black text-xs flex items-center justify-center shadow-xs shrink-0 overflow-hidden border ${
                          isEmpActive 
                            ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-emerald-500/20' 
                            : 'bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                        }`}>
                          {imgSrc ? (
                            <img
                              src={imgSrc}
                              alt={emp.first_name}
                              className="h-9 w-9 object-cover rounded-xl"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            initials || 'EM'
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">
                              {emp.first_name} {emp.last_name || ''}
                            </h4>
                            
                            {/* STATUS BADGE: ACTIVE vs INACTIVE */}
                            <span className={`text-[8px] font-black px-1.5 py-0.2 rounded-full border shrink-0 ${
                              isEmpActive 
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                            }`}>
                              {empStatus}
                            </span>
                          </div>

                          <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                            {emp.designation_name || 'Team Member'}
                          </p>

                          <div className="flex items-center justify-between text-[9px] text-slate-400 font-medium truncate mt-0.5">
                            <span className="truncate">{emp.email}</span>
                            <span className="font-bold text-slate-600 dark:text-slate-300 ml-1">#{emp.emp_id_code || 'EMP'}</span>
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
