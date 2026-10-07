'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import DashboardPageHeader from '../components/DashboardPageHeader';
import { getHeaders, getUrl } from '../utils/api';
import SlideDrawer from '../components/SlideDrawer';
import { useDashboard } from '../components/DashboardContext';
import SearchableSelect from '../components/SearchableSelect';
import { usePermissions } from '../hooks/usePermissions';
import ModernPagination from '../components/ModernPagination';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import PageLoader from '@/components/ui/PageLoader';

interface Company {
  id: string;
  name: string;
  subdomain?: string;
  status?: string;
  created_at?: string;
}

interface Branch {
  id: string;
  name: string;
  address: string;
  status: string;
  created_at: string;
}

interface Department {
  id: string;
  company_id?: string;
  branch_id: string;
  branch_name?: string;
  name: string;
  description: string;
  status: string;
  created_at?: string;
}

export default function DepartmentsPage() {
  const { showToast, companyId, setCompanyId } = useDashboard();
  const { hasPermission } = usePermissions();
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [drawerBranches, setDrawerBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('ALL');
  const [pageSize, setPageSize] = useState(20);

  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingDepartment, setDeletingDepartment] = useState<Department | null>(null);

  // Form states
  const [deptForm, setDeptForm] = useState({ name: '', description: '', branch_id: '', companyId: '', status: 'ACTIVE' });

  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('superadmin');
  const canView = isSuperAdmin || hasPermission('departments_view');
  const canCreate = isSuperAdmin || hasPermission('departments_create');
  const canEdit = isSuperAdmin || hasPermission('departments_edit');
  const canDelete = isSuperAdmin || hasPermission('departments_delete');

  const filteredDepartments = departments.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.description && d.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (d.branch_name && d.branch_name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesBranch = selectedBranchFilter === 'ALL' || d.branch_id === selectedBranchFilter;
    return matchesSearch && matchesBranch;
  });

  const totalItems = filteredDepartments.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedDepartments = filteredDepartments.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [companyId, searchTerm, pageSize, selectedBranchFilter]);

  useEffect(() => {
    const storedRoles = localStorage.getItem('roles');
    const storedEmail = localStorage.getItem('email');
    const storedPermissions = localStorage.getItem('permissions');
    if (storedRoles) setRoles(JSON.parse(storedRoles));
    if (storedEmail) setEmail(storedEmail);
    if (storedPermissions) setPermissions(JSON.parse(storedPermissions));
  }, []);

  const fetchCompanies = async () => {
    try {
      const res = await fetch(getUrl('/api/v1/companies'), { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) setCompanies(data.companies || []);
    } catch (e) { console.error(e); }
  };

  const fetchBranchesForCompany = async (targetCompanyId: string) => {
    try {
      const res = await fetch(`/api/v1/branches?companyId=${targetCompanyId}`, { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) {
        return data.branches || [];
      }
    } catch (e) { console.error(e); }
    return [];
  };

  const fetchBranches = async () => {
    try {
      const res = await fetch(getUrl('/api/v1/branches', companyId), { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) {
        setBranches(data.branches || []);
        if (!isSuperAdmin) {
          setDrawerBranches(data.branches || []);
        }
      }
    } catch (e) { console.error(e); }
  };

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const res = await fetch(getUrl('/api/v1/departments', companyId), { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) setDepartments(data.departments || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => {
    Promise.all([
      isSuperAdmin ? fetchCompanies() : Promise.resolve(),
      fetchBranches(),
      fetchDepartments()
    ]);
  }, [companyId, isSuperAdmin]);

  // Handle cascading dynamic company choice in drawer
  const handleDrawerCompanyChange = async (targetCompanyId: string) => {
    setDeptForm(prev => ({ ...prev, companyId: targetCompanyId, branch_id: '' }));
    if (targetCompanyId) {
      const filteredBranches = await fetchBranchesForCompany(targetCompanyId);
      setDrawerBranches(filteredBranches);
    } else {
      setDrawerBranches([]);
    }
  };

  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();

    const targetCompanyId = isSuperAdmin ? deptForm.companyId : companyId;
    if (isSuperAdmin && !targetCompanyId) {
      showToast('Please select a company first.', 'error');
      return;
    }

    if (!deptForm.branch_id) {
      showToast('Office Branch is required', 'error');
      return;
    }

    if (!deptForm.name.trim()) {
      showToast('Department Name is required', 'error');
      return;
    }

    if (deptForm.name.trim().length > 50) {
      showToast('Department Name cannot exceed 50 characters', 'error');
      return;
    }

    if (deptForm.description && deptForm.description.trim().length > 150) {
      showToast('Description cannot exceed 150 characters', 'error');
      return;
    }

    // Duplicate check within branch/company
    const cleanName = deptForm.name.trim().toLowerCase();
    const isDuplicate = departments.some(d => 
      d.id !== selectedDepartmentId &&
      d.name.trim().toLowerCase() === cleanName &&
      String(d.branch_id) === String(deptForm.branch_id) &&
      (targetCompanyId && targetCompanyId !== 'all' ? String(d.company_id) === String(targetCompanyId) : true)
    );
    if (isDuplicate) {
      showToast(`A department with the name "${deptForm.name.trim()}" already exists in this branch`, 'error');
      return;
    }

    setIsSaving(true);
    try {
      const url = editMode 
        ? `/api/v1/departments/${selectedDepartmentId}`
        : '/api/v1/departments';
      const method = editMode ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify({
          name: deptForm.name.trim(),
          description: deptForm.description.trim(),
          branch_id: deptForm.branch_id,
          companyId: targetCompanyId,
          status: editMode ? deptForm.status : undefined
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(editMode ? 'Department updated successfully!' : 'Department created successfully!', 'success');
        setDeptForm({ name: '', description: '', branch_id: '', companyId: companyId || '', status: 'ACTIVE' });
        setDrawerOpen(false);
        setEditMode(false);
        setSelectedDepartmentId(null);
        fetchDepartments();
      } else {
        showToast(data.error || 'Failed to save department', 'error');
      }
    } catch (err) {
      showToast('Failed to save department', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditClick = async (dept: Department) => {
    setEditMode(true);
    setSelectedDepartmentId(dept.id);
    setDeptForm({
      name: dept.name,
      description: dept.description || '',
      branch_id: dept.branch_id,
      companyId: dept.company_id || '',
      status: dept.status || 'ACTIVE'
    });

    const targetComp = dept.company_id || companyId || '';
    if (targetComp) {
      const bList = await fetchBranchesForCompany(targetComp);
      setDrawerBranches(bList);
    } else {
      setDrawerBranches([]);
    }
    setDrawerOpen(true);
  };

  const executeDeleteDepartment = async (id: string) => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/v1/departments/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Department deleted successfully!', 'success');
        setDeletingDepartment(null);
        fetchDepartments();
      } else {
        showToast(data.error || 'Failed to delete department', 'error');
      }
    } catch (err) {
      showToast('Failed to delete department', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const openAddDrawer = () => {
    setEditMode(false);
    setSelectedDepartmentId(null);
    setDeptForm({ name: '', description: '', branch_id: '', companyId: companyId || '', status: 'ACTIVE' });
    if (!isSuperAdmin) {
      setDrawerBranches(branches);
    } else {
      setDrawerBranches([]);
    }
    setDrawerOpen(true);
  };

  const formatDateTime = (rawStr?: string | null) => {
    if (!rawStr) return '—';
    try {
      const dt = new Date(rawStr);
      if (isNaN(dt.getTime())) return '—';
      
      const day = String(dt.getDate()).padStart(2, '0');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[dt.getMonth()];
      const year = dt.getFullYear();
      
      let hours = dt.getHours();
      const minutes = String(dt.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'pm' : 'am';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const strHours = String(hours).padStart(2, '0');
      
      return `${day} ${month} ${year} • ${strHours}:${minutes} ${ampm}`;
    } catch {
      return '—';
    }
  };

  if (roles.length > 0 && !canView) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center p-6 animate-fadeIn font-dmsans">
        <div className="h-16 w-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4 text-3xl">
          🔒
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Access Denied</h3>
        <p className="text-slate-500 dark:text-slate-400 text-xs mt-1.5 max-w-sm">
          You do not have the required permissions to access the Departments module. Please contact your administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn font-dmsans">
      <div className="w-full">
        <DashboardPageHeader
          title="Departments Manager"
          actionMessage=""
          actionError=""
          companies={companies}
          companyId={companyId}
          handleCompanyChange={() => {}}
          isSuperAdmin={isSuperAdmin}
          email={email}
          hideCompanySelect={true}
          hideUserBadge={true}
        />
      </div>

      {/* Main Listing Container */}
      <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/80 bg-card p-6 shadow-sm space-y-6">
        
        {/* Search & Action Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:max-w-xs">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search departments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-[#07518a] focus:bg-card focus:ring-2 focus:ring-[#07518a]/20 transition-all duration-200 font-medium font-dmsans"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
            <div className="w-full sm:w-56">
              <SearchableSelect
                placeholder="All Branches"
                value={selectedBranchFilter}
                onChange={(val) => setSelectedBranchFilter(val)}
                options={[
                  { value: 'ALL', label: 'All Branches' },
                  ...branches.map((b) => ({ value: b.id, label: b.name }))
                ]}
              />
            </div>

            {canCreate && (
              <button
                onClick={openAddDrawer}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#07518a] hover:bg-[#064270] text-white text-xs font-bold shadow-md shadow-[#07518a]/20 hover:shadow-lg hover:shadow-[#07518a]/25 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer group flex-shrink-0 font-dmsans"
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-md bg-white/20 group-hover:bg-white/30 transition-colors flex-shrink-0">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </span>
                <span className="tracking-wide font-bold">+ Create Department</span>
              </button>
            )}
          </div>
        </div>

        {/* Card Grid View */}
        {loading ? (
          <PageLoader message="Loading Departments..." />
        ) : paginatedDepartments.length === 0 ? (
          <div className="py-16 text-center text-slate-400 dark:text-slate-500 font-bold tracking-wide border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
            <div className="flex flex-col items-center gap-2">
              <svg className="w-9 h-9 text-slate-300 dark:text-slate-700" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15" />
              </svg>
              <span>{searchTerm || selectedBranchFilter !== 'ALL' ? 'No matching departments found.' : 'No departments registered yet.'}</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginatedDepartments.map(d => {
              const status = d.status || 'ACTIVE';
              return (
                <div
                  key={d.id}
                  style={{ boxShadow: 'rgba(14, 30, 37, 0.12) 0px 2px 4px 0px, rgba(14, 30, 37, 0.32) 0px 2px 16px 0px' }}
                  className="group relative rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-card p-5 hover:border-[#07518a]/50 dark:hover:border-[#07518a]/60 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between overflow-hidden space-y-4"
                >
                  <div className="space-y-3">
                    {/* Header: Icon + Status Pill */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#07518a] to-[#0d6db8] text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-md shadow-[#07518a]/20 group-hover:scale-105 transition-transform duration-300">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.72m12 0a5.971 5.971 0 00-.941-3.197M6 18.72a5.971 5.971 0 01.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 005.058 2.772m-10.116 0A9.094 9.094 0 012.25 15.52a3 3 0 014.682-2.72m0 0c.148.274.321.533.516.776M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                        </svg>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex-shrink-0 ${
                        status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200/80 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30'
                          : 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-900/30 dark:text-slate-400 dark:border-slate-800'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${status === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                        <span>{status}</span>
                      </span>
                    </div>

                    {/* Department Title with Tooltip */}
                    <div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 group-hover:text-[#07518a] dark:group-hover:text-[#3894db] transition-colors tracking-tight line-clamp-1 cursor-default">
                            {d.name}
                          </h4>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <span className="font-semibold">{d.name}</span>
                        </TooltipContent>
                      </Tooltip>
                    </div>

                    {/* Office Branch Badge with Tooltip */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="p-2.5 rounded-xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/60 flex items-center gap-2 cursor-default">
                          <svg className="w-3.5 h-3.5 text-[#07518a] dark:text-[#3894db] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                          </svg>
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                            {d.branch_name || 'Branch N/A'}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <span>Office Branch: {d.branch_name || 'N/A'}</span>
                      </TooltipContent>
                    </Tooltip>

                    {/* Description */}
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed min-h-[32px]">
                      {d.description || <span className="text-slate-400 italic">No department description provided.</span>}
                    </p>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 mt-auto">
                    <div className="flex flex-col text-[10px] font-bold font-dmsans">
                      <span className="text-[8.5px] text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-widest">Created At</span>
                      <span className="text-slate-600 dark:text-slate-300 font-bold">
                        {formatDateTime(d.created_at || (d as any).createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {canEdit && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleEditClick(d)}
                              className="h-8 w-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-[#07518a] dark:text-[#3894db] border border-blue-200/80 dark:border-blue-800/60 hover:bg-[#07518a] hover:text-white hover:border-transparent shadow-xs hover:shadow-md hover:shadow-[#07518a]/25 active:scale-95 transition-all duration-200 cursor-pointer flex items-center justify-center group/edit"
                            >
                              <svg className="w-4 h-4 transition-transform group-hover/edit:scale-110" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.83 20.089a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                              </svg>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">Edit Department</TooltipContent>
                        </Tooltip>
                      )}
                      {canDelete && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => setDeletingDepartment(d)}
                              className="h-8 w-8 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800/60 hover:bg-gradient-to-r hover:from-rose-600 hover:to-red-600 hover:text-white hover:border-transparent shadow-xs hover:shadow-md hover:shadow-rose-500/25 active:scale-95 transition-all duration-200 cursor-pointer flex items-center justify-center group/del"
                            >
                              <svg className="w-4 h-4 transition-transform group-hover/del:scale-110" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                              </svg>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">Delete Department</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 🚀 MODERN ELEGANT PAGINATION */}
        {!loading && filteredDepartments.length > 0 && (
          <ModernPagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={totalItems}
            startIndex={startIndex}
            endIndex={endIndex}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[10, 20, 50, 100]}
            itemLabel="departments"
          />
        )}
      </div>

      {/* Slide Drawer Form */}
      <SlideDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} title={editMode ? "Modify Department" : "Create Department"}>
        <form onSubmit={handleSaveDepartment} className="space-y-5 text-left font-dmsans">
          
          {isSuperAdmin && (
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 font-dmsans">
                Target Company First
              </label>
              <SearchableSelect
                placeholder="Select Company"
                options={companies.map(c => ({ value: c.id, label: c.name }))}
                value={deptForm.companyId}
                onChange={val => handleDrawerCompanyChange(val)}
                disabled={editMode}
              />
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 font-dmsans">
              Office Branch *
            </label>
            <SearchableSelect
              placeholder="Select Branch"
              options={drawerBranches.map(b => ({ value: b.id, label: b.name }))}
              value={deptForm.branch_id}
              onChange={val => setDeptForm({ ...deptForm, branch_id: val })}
              disabled={isSuperAdmin && !deptForm.companyId}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest font-dmsans">
                Department Name *
              </label>
              <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 font-dmsans">
                {deptForm.name.length}/50
              </span>
            </div>
            <input
              type="text"
              placeholder="e.g. Engineering"
              maxLength={50}
              value={deptForm.name}
              onChange={e => setDeptForm({ ...deptForm, name: e.target.value.slice(0, 50) })}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none focus:border-[#07518a] focus:bg-card focus:ring-2 focus:ring-[#07518a]/20 transition-all duration-200 font-medium font-dmsans"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest font-dmsans">
                Description <span className="text-slate-400 lowercase text-[10px] font-normal">(optional)</span>
              </label>
              <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 font-dmsans">
                {deptForm.description.length}/150
              </span>
            </div>
            <input
              type="text"
              placeholder="e.g. Tech & Development (max 150 characters)"
              maxLength={150}
              value={deptForm.description}
              onChange={e => setDeptForm({ ...deptForm, description: e.target.value.slice(0, 150) })}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none focus:border-[#07518a] focus:bg-card focus:ring-2 focus:ring-[#07518a]/20 transition-all duration-200 font-medium font-dmsans"
            />
          </div>

          {editMode && (
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 font-dmsans">
                Status
              </label>
              <select
                value={deptForm.status}
                onChange={e => setDeptForm({ ...deptForm, status: e.target.value })}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-[#07518a] focus:bg-card focus:ring-2 focus:ring-[#07518a]/20 transition-all duration-200 font-bold font-dmsans"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          )}

          <button 
            type="submit" 
            disabled={isSaving}
            className="w-full py-2.5 rounded-xl bg-[#07518a] hover:bg-[#064270] text-xs font-bold text-white shadow-md shadow-[#07518a]/20 transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-dmsans"
          >
            {isSaving && (
              <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
            )}
            {isSaving ? (editMode ? 'Saving changes...' : 'Creating...') : (editMode ? 'Save Department changes' : 'Create Department')}
          </button>
        </form>
      </SlideDrawer>

      {/* 🗑️ DELETION CONFIRMATION DIALOG (Full-screen Body Portal) */}
      {typeof document !== 'undefined' && deletingDepartment && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 font-dmsans">
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm animate-fadeIn" onClick={() => !isDeleting && setDeletingDepartment(null)} />
          <div className="relative z-10 w-full max-w-[360px] animate-scaleUp">
            <div className="rounded-2xl border border-slate-200 dark:border-rose-900/40 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
              <div className="h-1.5 w-full bg-gradient-to-r from-rose-600 to-red-400" />
              <div className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/20 flex items-center justify-center flex-shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14H6L5 6" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4h6v2" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400">Confirm Deletion</h4>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5">This action cannot be undone</p>
                  </div>
                </div>
                <div className="mb-5 p-3.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30">
                  <p className="text-[12px] text-slate-700 dark:text-slate-200 font-medium leading-relaxed">
                    Delete department{' '}
                    <span className="font-black text-rose-600 dark:text-rose-400">&ldquo;{deletingDepartment.name}&rdquo;</span>?
                  </p>
                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium mt-1.5">
                    ⚠️ Associated designations and employees may be affected.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => executeDeleteDepartment(deletingDepartment.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-[0.97] text-white text-[11px] font-bold cursor-pointer shadow-md shadow-rose-600/25 transition-all border-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDeleting ? (
                      <>
                        <svg className="animate-spin h-3 w-3 text-white" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                        </svg>
                        Deleting...
                      </>
                    ) : (
                      <>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
                        Yes, Delete
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => setDeletingDepartment(null)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-bold cursor-pointer border border-slate-200 dark:border-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
