'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardPageHeader from '../components/DashboardPageHeader';
import { getHeaders, getUrl } from '../utils/api';
import SlideDrawer from '../components/SlideDrawer';
import { useDashboard } from '../components/DashboardContext';
import SearchableSelect from '../components/SearchableSelect';

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
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [drawerBranches, setDrawerBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const itemsPerPage = 20;

  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [deletingDepartment, setDeletingDepartment] = useState<Department | null>(null);

  // Form states
  const [deptForm, setDeptForm] = useState({ name: '', description: '', branch_id: '', companyId: '', status: 'ACTIVE' });

  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('superadmin');
  const canView = isSuperAdmin || permissions.includes('view_departments');
  const canCreate = isSuperAdmin || permissions.includes('create_departments');
  const canEdit = isSuperAdmin || permissions.includes('edit_departments');
  const canDelete = isSuperAdmin || permissions.includes('delete_departments');

  const filteredDepartments = departments.filter(d => 
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.branch_name && d.branch_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalItems = filteredDepartments.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const paginatedDepartments = filteredDepartments.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [companyId, searchTerm]);

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
      const res = await fetch('/api/v1/companies', { headers: getHeaders() });
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
    if (isSuperAdmin) {
      fetchCompanies();
    }
    fetchBranches();
    fetchDepartments();
  }, [companyId, isSuperAdmin]);

  useEffect(() => {
    if (!deletingDepartment) return;
    const timer = setTimeout(() => {
      setDeletingDepartment(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [deletingDepartment]);

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

    if (!deptForm.name || !deptForm.description || !deptForm.branch_id) {
      showToast('Office Branch, Department Name, and Description are required', 'error');
      return;
    }

    try {
      const url = editMode 
        ? `/api/v1/departments/${selectedDepartmentId}`
        : '/api/v1/departments';
      const method = editMode ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify({
          name: deptForm.name,
          description: deptForm.description,
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
    }
  };

  const handleEditClick = async (dept: Department) => {
    setEditMode(true);
    setSelectedDepartmentId(dept.id);
    setDeptForm({
      name: dept.name,
      description: dept.description,
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
    try {
      const res = await fetch(`/api/v1/departments/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Department deleted successfully!', 'success');
        fetchDepartments();
      } else {
        showToast(data.error || 'Failed to delete department', 'error');
      }
    } catch (err) {
      showToast('Failed to delete department', 'error');
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
      <div className="flex h-[60vh] flex-col items-center justify-center text-center p-6 animate-fadeIn">
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
    <div className="space-y-6 animate-fadeIn">
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

      {/* Slide Drawer Form */}
      <SlideDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} title={editMode ? "Modify Department" : "Create Department"}>
        <form onSubmit={handleSaveDepartment} className="space-y-5 text-left">
          
          {isSuperAdmin && (
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
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
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
              Office Branch
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
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
              Department Name
            </label>
            <input
              type="text" placeholder="e.g. Engineering"
              value={deptForm.name}
              onChange={e => setDeptForm({ ...deptForm, name: e.target.value })}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-450 outline-none focus:border-blue-500 focus:bg-card focus:ring-2 focus:ring-blue-100 transition-all duration-200"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
              Description
            </label>
            <input
              type="text" placeholder="e.g. Tech & Development"
              value={deptForm.description}
              onChange={e => setDeptForm({ ...deptForm, description: e.target.value })}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-450 outline-none focus:border-blue-500 focus:bg-card focus:ring-2 focus:ring-blue-100 transition-all duration-200"
            />
          </div>

          {editMode && (
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
                Status
              </label>
              <select
                value={deptForm.status}
                onChange={e => setDeptForm({ ...deptForm, status: e.target.value })}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 focus:bg-card focus:ring-2 focus:ring-blue-100 transition-all duration-200"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          )}

          <button type="submit" className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-sm transition-all duration-200 cursor-pointer">
            {editMode ? 'Save Department changes' : 'Create Department'}
          </button>
        </form>
      </SlideDrawer>

      {/* Grid Table display */}
      <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-card p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5 border-b border-slate-100 dark:border-slate-800 pb-3.5">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-250">
              Departments list
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50">
              {filteredDepartments.length} Total
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <svg className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                placeholder="Search department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-search pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none focus:border-blue-500 transition-all"
              />
            </div>

            {/* ADD DEPARTMENT BUTTON IN CONTROLS ROW */}
            {canCreate && (
              <button
                onClick={openAddDrawer}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-extrabold shadow-md shadow-indigo-600/20 hover:shadow-lg hover:scale-105 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <i className="fa-solid fa-plus text-xs"></i>
                <span>Add Department</span>
              </button>
            )}
          </div>
        </div>

        {/* 2. CARD FORMAT GRID VIEW */}
        {loading ? (
          <div className="py-16 text-center text-slate-400 dark:text-slate-500 font-bold flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
            <span>Loading departments...</span>
          </div>
        ) : paginatedDepartments.length === 0 ? (
          <div className="py-16 text-center text-slate-400 dark:text-slate-500">
            <i className="fa-solid fa-folder-open text-4xl mb-3 block text-slate-300 dark:text-slate-600"></i>
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">
              {searchTerm ? 'No matching departments found.' : 'No departments registered yet.'}
            </h4>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginatedDepartments.map(d => {
              const status = d.status || 'ACTIVE';
              return (
                <div
                  key={d.id}
                  style={{ boxShadow: 'rgba(14, 30, 37, 0.12) 0px 2px 4px 0px, rgba(14, 30, 37, 0.32) 0px 2px 16px 0px' }}
                  className="group relative rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-card p-5 hover:border-indigo-300 dark:hover:border-indigo-800/60 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between overflow-hidden space-y-4"
                >
                  <div>
                    {/* Header: Light Color Icon + Status Pill */}
                    <div className="flex items-center justify-between gap-2 mb-3.5">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-50 via-purple-50 to-blue-50 dark:from-indigo-950/60 dark:via-purple-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg shrink-0 border border-indigo-100 dark:border-indigo-900/40 shadow-xs group-hover:scale-110 transition-transform duration-300">
                        <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
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

                    {/* Department Title */}
                    <h4 className="text-base font-extrabold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors tracking-tight line-clamp-1" title={d.name}>
                      {d.name}
                    </h4>

                    {/* Office Branch Badge */}
                    <div className="flex items-center gap-1.5 mt-1.5 mb-2">
                      <svg className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                      </svg>
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 truncate">
                        {d.branch_name || 'Branch N/A'}
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {d.description || 'No department description provided.'}
                    </p>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 mt-auto">
                    <div className="flex flex-col text-[10px] font-bold font-mono">
                      <span className="text-[8.5px] text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-widest">Created At</span>
                      <span className="text-slate-600 dark:text-slate-300 font-bold">
                        {formatDateTime(d.created_at || (d as any).createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {canEdit && (
                        <button
                          onClick={() => handleEditClick(d)}
                          title="Edit department"
                          className="h-8 w-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/60 hover:bg-gradient-to-r hover:from-blue-600 hover:to-indigo-600 hover:text-white hover:border-transparent shadow-xs hover:shadow-md hover:shadow-blue-500/25 active:scale-95 transition-all duration-200 cursor-pointer flex items-center justify-center group/edit"
                        >
                          <svg className="w-4 h-4 transition-transform group-hover/edit:scale-110" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.83 20.089a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                          </svg>
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => setDeletingDepartment(d)}
                          title="Delete department"
                          className="h-8 w-8 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800/60 hover:bg-gradient-to-r hover:from-rose-600 hover:to-red-600 hover:text-white hover:border-transparent shadow-xs hover:shadow-md hover:shadow-rose-500/25 active:scale-95 transition-all duration-200 cursor-pointer flex items-center justify-center group/del"
                        >
                          <svg className="w-4 h-4 transition-transform group-hover/del:scale-110" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Bar */}
        {!loading && filteredDepartments.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Showing <span className="font-bold text-slate-700 dark:text-slate-200">{totalItems > 0 ? startIndex + 1 : 0}</span> to{' '}
              <span className="font-bold text-slate-700 dark:text-slate-200">{endIndex}</span> of{' '}
              <span className="font-bold text-slate-700 dark:text-slate-200">{totalItems}</span> departments
            </div>

            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(1)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="First Page"
              >
                « First
              </button>
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Previous Page"
              >
                ‹ Prev
              </button>

              <span className="px-3 py-1 text-xs font-extrabold text-slate-700 dark:text-slate-300">
                Page {currentPage} of {totalPages}
              </span>

              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Next Page"
              >
                Next ›
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Last Page"
              >
                Last »
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 🗑️ DELETION CONFIRMATION INTERACTIVE TOAST OVERLAY */}
      {deletingDepartment && (
        <>
          <div className="fixed inset-0 z-[90] bg-black/25 backdrop-blur-[2px]" onClick={() => setDeletingDepartment(null)} />
          <div className="fixed right-6 top-1/2 -translate-y-1/2 z-[100] w-[310px] animate-slideIn">
            <div className="rounded-2xl border border-slate-200 dark:border-red-900/40 bg-white dark:bg-[#1c1624] shadow-2xl shadow-black/40 overflow-hidden">
              <div className="h-1 w-full bg-gradient-to-r from-rose-600 to-red-400" />
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
                <div className="mb-5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30">
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
                    onClick={() => { executeDeleteDepartment(deletingDepartment.id); setDeletingDepartment(null); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-[0.97] text-white text-[11px] font-bold cursor-pointer shadow-md shadow-rose-600/25 transition-all"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
                    Yes, Delete
                  </button>
                  <button
                    onClick={() => setDeletingDepartment(null)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-650 dark:text-slate-300 text-[11px] font-bold cursor-pointer border border-slate-200 dark:border-slate-700 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
