'use client';

import React, { useEffect, useState } from 'react';
import DashboardPageHeader from '../components/DashboardPageHeader';
import { getHeaders, getUrl } from '../utils/api';
import SlideDrawer from '../components/SlideDrawer';
import { useDashboard } from '../components/DashboardContext';
import SearchableSelect from '../components/SearchableSelect';
import { usePermissions } from '../hooks/usePermissions';
import ModernPagination from '../components/ModernPagination';

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
  company_id?: string;
  company_name?: string;
  created_at: string;
}

export default function BranchesPage() {
  const { showToast, companyId, setCompanyId } = useDashboard();
  const { hasPermission } = usePermissions();
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingBranch, setDeletingBranch] = useState<Branch | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, pageSize]);

  // Form states
  const [branchForm, setBranchForm] = useState({ name: '', address: '', companyId: '', status: 'ACTIVE' });

  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('superadmin');
  const canView = isSuperAdmin || hasPermission('view_branches');
  const canCreate = isSuperAdmin || hasPermission('create_branches');
  const canEdit = isSuperAdmin || hasPermission('edit_branches');
  const canDelete = isSuperAdmin || hasPermission('delete_branches');

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
    } catch (e) {
      console.error(e);
    }
  };

  const fetchBranches = async () => {
    setLoading(true);
    try {
      const res = await fetch(getUrl('/api/v1/branches', companyId), { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) {
        setBranches(data.branches || []);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isSuperAdmin) {
      fetchCompanies();
    }
    fetchBranches();
  }, [companyId, isSuperAdmin]);

  useEffect(() => {
    if (!deletingBranch) return;
    const timer = setTimeout(() => {
      setDeletingBranch(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [deletingBranch]);

  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Choose selected company ID or current active tenant scope ID
    const targetCompanyId = isSuperAdmin ? branchForm.companyId : companyId;
    if (isSuperAdmin && !targetCompanyId) {
      showToast('Please select a company first.', 'error');
      return;
    }

    if (!branchForm.name.trim()) {
      showToast('Branch Name is required', 'error');
      return;
    }

    if (branchForm.name.trim().length > 50) {
      showToast('Branch Name cannot exceed 50 characters', 'error');
      return;
    }

    // Duplicate check within company
    const cleanName = branchForm.name.trim().toLowerCase();
    const isDuplicate = branches.some(b => 
      b.id !== selectedBranchId &&
      b.name.trim().toLowerCase() === cleanName &&
      (targetCompanyId && targetCompanyId !== 'all' ? String(b.company_id) === String(targetCompanyId) : true)
    );
    if (isDuplicate) {
      showToast(`A branch with the name "${branchForm.name.trim()}" already exists in this company`, 'error');
      return;
    }

    setIsSaving(true);
    try {
      const url = editMode 
        ? `/api/v1/branches/${selectedBranchId}`
        : '/api/v1/branches';
      const method = editMode ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify({
          name: branchForm.name,
          address: branchForm.address,
          companyId: targetCompanyId,
          status: editMode ? branchForm.status : undefined
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(editMode ? 'Branch updated successfully!' : 'Branch location registered successfully!', 'success');
        setBranchForm({ name: '', address: '', companyId: companyId || '', status: 'ACTIVE' });
        setDrawerOpen(false);
        setEditMode(false);
        setSelectedBranchId(null);
        fetchBranches();
      } else {
        showToast(data.error || 'Failed to save branch location', 'error');
      }
    } catch (err) {
      showToast('Failed to save branch location', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditClick = (branch: Branch) => {
    setEditMode(true);
    setSelectedBranchId(branch.id);
    setBranchForm({
      name: branch.name,
      address: branch.address,
      companyId: branch.company_id || '',
      status: branch.status || 'ACTIVE'
    });
    setDrawerOpen(true);
  };

  const executeDeleteBranch = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/branches/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Branch deleted successfully!', 'success');
        fetchBranches();
      } else {
        showToast(data.error || 'Failed to delete branch', 'error');
      }
    } catch (err) {
      showToast('Failed to delete branch', 'error');
    }
  };

  const openAddDrawer = () => {
    setEditMode(false);
    setSelectedBranchId(null);
    setBranchForm({ name: '', address: '', companyId: companyId || '', status: 'ACTIVE' });
    setDrawerOpen(true);
  };

  const filteredBranches = branches.filter(b => 
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    b.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Pagination calculation
  const totalItems = filteredBranches.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedBranches = filteredBranches.slice(startIndex, endIndex);

  if (roles.length > 0 && !canView) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center p-6 animate-fadeIn">
        <div className="h-16 w-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4 text-3xl">
          🔒
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Access Denied</h3>
        <p className="text-slate-500 dark:text-slate-400 text-xs mt-1.5 max-w-sm">
          You do not have the required permissions to access the Office Branches module. Please contact your administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn select-none">
      
      {/* Page Header */}
      <div className="w-full">
        <DashboardPageHeader
          title="Office Branches"
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

      {/* Main Listing Panel */}
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
              placeholder="Search office branches..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 focus:bg-card focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-all duration-200"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">

            {canCreate && (
              <button
                onClick={openAddDrawer}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-blue-600/20 hover:shadow-lg hover:shadow-blue-600/25 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer group flex-shrink-0"
              >
                <span className="flex h-4.5 w-4.5 items-center justify-center rounded-md bg-white/20 group-hover:bg-white/30 transition-colors flex-shrink-0">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </span>
                <span className="tracking-wide">Add Branch</span>
              </button>
            )}
          </div>
        </div>

        {/* Card Grid View */}
        {loading ? (
          <div className="py-20 text-center text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent mr-2.5 align-middle" />
            Loading office branch locations...
          </div>
        ) : filteredBranches.length === 0 ? (
          <div className="py-16 text-center text-slate-400 dark:text-slate-500 font-bold tracking-wide border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
            <div className="flex flex-col items-center gap-2">
              <svg className="w-9 h-9 text-slate-300 dark:text-slate-700" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              <span>No office branch locations match your criteria.</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {paginatedBranches.map(b => (
              <div 
                key={b.id} 
                style={{ boxShadow: 'rgba(14, 30, 37, 0.12) 0px 2px 4px 0px, rgba(14, 30, 37, 0.32) 0px 2px 16px 0px' }}
                className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-card p-5 hover:border-blue-300 dark:hover:border-blue-800/60 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group space-y-4 relative overflow-hidden"
              >
                <div className="space-y-3">
                  {/* Card Header: Icon + Name + Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 flex-shrink-0">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-extrabold text-slate-850 dark:text-slate-100 text-sm tracking-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{b.name}</h4>
                        <span className="text-[9.5px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">
                          Office Branch
                        </span>
                      </div>
                    </div>

                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex-shrink-0 ${
                      b.status === 'ACTIVE' || !b.status
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200/80 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30'
                        : 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-900/30 dark:text-slate-400 dark:border-slate-800'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${b.status === 'ACTIVE' || !b.status ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                      <span>{b.status || 'ACTIVE'}</span>
                    </span>
                  </div>

                  {/* Address Details */}
                  <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/60 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2">
                    <svg className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15" />
                    </svg>
                    <span className="font-medium line-clamp-2">{b.address}</span>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
                  <div className="flex flex-col text-[10px] font-bold font-mono">
                    <span className="text-[8.5px] text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-widest">Created At</span>
                    <span className="text-slate-600 dark:text-slate-300 font-bold">
                      {b.created_at ? `${new Date(b.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} • ${new Date(b.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {canEdit && (
                      <button
                        onClick={() => handleEditClick(b)}
                        title="Edit location"
                        className="h-8 w-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/60 hover:bg-gradient-to-r hover:from-blue-600 hover:to-indigo-600 hover:text-white hover:border-transparent shadow-xs hover:shadow-md hover:shadow-blue-500/25 active:scale-95 transition-all duration-200 cursor-pointer flex items-center justify-center group"
                      >
                        <svg className="w-4 h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.83 20.089a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                        </svg>
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => setDeletingBranch(b)}
                        title="Delete location"
                        className="h-8 w-8 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800/60 hover:bg-gradient-to-r hover:from-rose-600 hover:to-red-600 hover:text-white hover:border-transparent shadow-xs hover:shadow-md hover:shadow-rose-500/25 active:scale-95 transition-all duration-200 cursor-pointer flex items-center justify-center group"
                      >
                        <svg className="w-4 h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 🚀 MODERN ELEGANT PAGINATION */}
        {!loading && filteredBranches.length > 0 && (
          <ModernPagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={totalItems}
            startIndex={startIndex}
            endIndex={endIndex}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[8, 12, 24, 48]}
            itemLabel="branches"
          />
        )}
      </div>

      {/* Slide drawer for Adding/Editing Branch */}
      <SlideDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} title={editMode ? "Modify Office Branch" : "Add Office Branch"}>
        <form onSubmit={handleSaveBranch} className="space-y-5 text-left">
          {isSuperAdmin && (
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
                Target Company
              </label>
              <SearchableSelect
                placeholder="Select Company Context"
                options={companies.map(c => ({ value: c.id, label: c.name }))}
                value={branchForm.companyId}
                onChange={val => setBranchForm({ ...branchForm, companyId: val })}
                disabled={editMode}
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                Branch Name *
              </label>
              <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                {branchForm.name.length}/50
              </span>
            </div>
            <input
              type="text"
              placeholder="e.g. Hitech City HQ"
              maxLength={50}
              value={branchForm.name}
              onChange={e => setBranchForm({ ...branchForm, name: e.target.value.slice(0, 50) })}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none focus:border-blue-500 focus:bg-card focus:ring-2 focus:ring-blue-100 transition-all duration-200 font-medium"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
              Branch Address <span className="text-slate-400 lowercase text-[10px] font-normal">(optional)</span>
            </label>
            <textarea
              placeholder="e.g. Hyderabad, India"
              value={branchForm.address}
              onChange={e => setBranchForm({ ...branchForm, address: e.target.value })}
              className="w-full h-24 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none focus:border-blue-500 focus:bg-card focus:ring-2 focus:ring-blue-100 transition-all duration-200 font-medium"
            />
          </div>

          {editMode && (
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
                Status
              </label>
              <select
                value={branchForm.status}
                onChange={e => setBranchForm({ ...branchForm, status: e.target.value })}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 focus:bg-card focus:ring-2 focus:ring-blue-100 transition-all duration-200 font-bold"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          )}

          <button 
            type="submit" 
            disabled={isSaving}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-xs font-bold text-white shadow-md shadow-blue-600/20 active:scale-[0.99] transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSaving && (
              <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
            )}
            {isSaving ? (editMode ? 'Saving changes...' : 'Creating...') : (editMode ? 'Save Branch changes' : 'Create Office Branch')}
          </button>
        </form>
      </SlideDrawer>

      {/* 🗑️ DELETION CONFIRMATION INTERACTIVE TOAST OVERLAY */}
      {deletingBranch && (
        <>
          <div className="fixed inset-0 z-[90] bg-black/25 backdrop-blur-[2px]" onClick={() => setDeletingBranch(null)} />
          <div className="fixed right-6 top-1/2 -translate-y-1/2 z-[100] w-[310px] animate-slideIn">
            <div className="rounded-2xl border border-slate-200 dark:border-rose-900/40 bg-card shadow-2xl overflow-hidden">
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
                <div className="mb-5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30">
                  <p className="text-[12px] text-slate-700 dark:text-slate-200 font-medium leading-relaxed">
                    Delete office branch{' '}
                    <span className="font-black text-rose-600 dark:text-rose-400">&ldquo;{deletingBranch.name}&rdquo;</span>?
                  </p>
                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium mt-1.5">
                    ⚠️ Associated departments and employees may be affected.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { executeDeleteBranch(deletingBranch.id); setDeletingBranch(null); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-[0.97] text-white text-[11px] font-bold cursor-pointer shadow-md shadow-rose-600/25 transition-all"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
                    Yes, Delete
                  </button>
                  <button
                    onClick={() => setDeletingBranch(null)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-bold cursor-pointer border border-slate-200 dark:border-slate-700 transition-all"
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
