'use client';

import React, { useEffect, useState } from 'react';
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
  company_id?: string;
  name: string;
  address: string;
  status: string;
  created_at: string;
}

export default function BranchesPage() {
  const { showToast } = useDashboard();
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [deletingBranch, setDeletingBranch] = useState<Branch | null>(null);
  const [filterCompanyId, setFilterCompanyId] = useState<string | null>(null);

  // Form states
  const [branchForm, setBranchForm] = useState({ name: '', address: '', companyId: '', status: 'ACTIVE' });

  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('superadmin');
  const canView = isSuperAdmin || permissions.includes('view_branches');
  const canCreate = isSuperAdmin || permissions.includes('create_branches');
  const canEdit = isSuperAdmin || permissions.includes('edit_branches');
  const canDelete = isSuperAdmin || permissions.includes('delete_branches');

  useEffect(() => {
    const storedRoles = localStorage.getItem('roles');
    const storedEmail = localStorage.getItem('email');
    const storedCompanyId = localStorage.getItem('companyId');
    const storedPermissions = localStorage.getItem('permissions');
    if (storedRoles) setRoles(JSON.parse(storedRoles));
    if (storedEmail) setEmail(storedEmail);
    if (storedCompanyId) {
      setCompanyId(storedCompanyId);
      setBranchForm(prev => ({ ...prev, companyId: storedCompanyId }));
    }
    if (storedPermissions) setPermissions(JSON.parse(storedPermissions));
  }, []);

  const fetchCompanies = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/v1/companies', { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) setCompanies(data.companies || []);
    } catch (e) { console.error(e); }
  };

  const fetchBranches = async () => {
    setLoading(true);
    try {
      const activeId = isSuperAdmin ? filterCompanyId : companyId;
      const res = await fetch(getUrl('/api/v1/branches', activeId), { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) setBranches(data.branches || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => {
    if (isSuperAdmin) {
      fetchCompanies();
    }
    fetchBranches();
  }, [companyId, filterCompanyId, isSuperAdmin]);

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

    if (!branchForm.name || !branchForm.address) {
      showToast('Branch Name and Address are required', 'error');
      return;
    }

    try {
      const url = editMode 
        ? `http://localhost:5000/api/v1/branches/${selectedBranchId}`
        : 'http://localhost:5000/api/v1/branches';
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
      const res = await fetch(`http://localhost:5000/api/v1/branches/${id}`, {
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
    <div className="space-y-6 animate-fadeIn">
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
        >
          {canCreate && (
            <button
              onClick={openAddDrawer}
              className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-blue-600/25 hover:shadow-lg hover:shadow-blue-600/30 transition-all duration-200 cursor-pointer group flex-shrink-0"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white/20 group-hover:bg-white/30 transition-colors flex-shrink-0">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </span>
              <span className="tracking-wide">Add Branch</span>
            </button>
          )}
        </DashboardPageHeader>
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
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
              Branch Name
            </label>
            <input
              type="text" placeholder="e.g. Hitech City HQ"
              value={branchForm.name}
              onChange={e => setBranchForm({ ...branchForm, name: e.target.value })}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-450 outline-none focus:border-blue-500 focus:bg-card focus:ring-2 focus:ring-blue-100 transition-all duration-200"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
              Branch Address
            </label>
            <textarea
              placeholder="e.g. Hyderabad, India"
              value={branchForm.address}
              onChange={e => setBranchForm({ ...branchForm, address: e.target.value })}
              className="w-full h-24 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-450 outline-none focus:border-blue-500 focus:bg-card focus:ring-2 focus:ring-blue-100 transition-all duration-200"
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
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 focus:bg-card focus:ring-2 focus:ring-blue-100 transition-all duration-200"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          )}

          <button type="submit" className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-sm transition-all duration-200 cursor-pointer">
            {editMode ? 'Save Branch changes' : 'Create Office Branch'}
          </button>
        </form>
      </SlideDrawer>

      {/* Listing Table Container */}
      <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-card p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5 border-b border-slate-100 dark:border-slate-800/60 pb-3.5">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-250">
            Office Locations
          </h3>
          {isSuperAdmin && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Filter Company:</span>
              <div className="w-48 text-left">
                <SearchableSelect
                  placeholder="All Companies"
                  options={[
                    { value: 'ALL', label: 'All Companies' },
                    ...companies.map(c => ({ value: c.id, label: c.name }))
                  ]}
                  value={filterCompanyId || 'ALL'}
                  onChange={val => {
                    setFilterCompanyId(val === 'ALL' ? null : val);
                  }}
                />
              </div>
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-850 text-slate-550 dark:text-slate-450 font-bold uppercase tracking-wider">
                <th className="py-3 px-3">Branch Name</th>
                <th className="py-3 px-3">Address</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Created At</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400 dark:text-slate-500 font-medium">
                    Loading branches...
                  </td>
                </tr>
              ) : branches.map(b => (
                <tr key={b.id} className="border-b border-slate-100 dark:border-slate-850 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all">
                  <td className="py-3 px-3 font-bold text-slate-750 dark:text-slate-200">{b.name}</td>
                  <td className="py-3 px-3 text-slate-600 dark:text-slate-400 font-medium">{b.address}</td>
                  <td className="py-3 px-3">
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold border ${
                      b.status === 'ACTIVE' || !b.status
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 border-emerald-500/20'
                        : 'bg-slate-500/10 text-slate-600 dark:text-slate-455 border-slate-500/20'
                    }`}>
                      {b.status || 'ACTIVE'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-400 dark:text-slate-500 font-medium">
                    {new Date(b.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {canEdit && (
                        <button
                          onClick={() => handleEditClick(b)}
                          title="Edit location"
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-200 dark:hover:border-blue-900/35 transition-colors cursor-pointer"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.83 20.089a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                          </svg>
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => setDeletingBranch(b)}
                          title="Delete location"
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-400 hover:text-rose-600 dark:hover:text-rose-455 hover:border-rose-200 dark:hover:border-rose-900/35 transition-colors cursor-pointer"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      )}
                      {!canEdit && !canDelete && (
                        <span className="text-slate-400 dark:text-slate-650 font-bold">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && branches.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400 dark:text-slate-500 font-medium">
                    No branches registered yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 🗑️ DELETION CONFIRMATION INTERACTIVE TOAST OVERLAY */}
      {deletingBranch && (
        <>
          <div className="fixed inset-0 z-[90] bg-black/25 backdrop-blur-[2px]" onClick={() => setDeletingBranch(null)} />
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
