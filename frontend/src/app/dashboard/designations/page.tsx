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
  name: string;
  address: string;
  status: string;
  created_at: string;
}

interface Department {
  id: string;
  branch_id: string;
  branch_name?: string;
  name: string;
  description: string;
  status: string;
}

interface Designation {
  id: string;
  company_id?: string;
  branch_id: string;
  branch_name?: string;
  department_id: string;
  department_name?: string;
  name: string;
  description: string;
  status: string;
}

export default function DesignationsPage() {
  const { showToast } = useDashboard();
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);

  // Drawer cascaded lists
  const [drawerBranches, setDrawerBranches] = useState<Branch[]>([]);
  const [drawerDepartments, setDrawerDepartments] = useState<Department[]>([]);

  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedDesignationId, setSelectedDesignationId] = useState<string | null>(null);
  const [filterCompanyId, setFilterCompanyId] = useState<string | null>(null);
  const [deletingDesignation, setDeletingDesignation] = useState<Designation | null>(null);

  // Form states
  const [desigForm, setDesigForm] = useState({ name: '', description: '', branch_id: '', department_id: '', companyId: '', status: 'ACTIVE' });

  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('superadmin');

  useEffect(() => {
    const storedRoles = localStorage.getItem('roles');
    const storedEmail = localStorage.getItem('email');
    const storedCompanyId = localStorage.getItem('companyId');
    if (storedRoles) setRoles(JSON.parse(storedRoles));
    if (storedEmail) setEmail(storedEmail);
    if (storedCompanyId) {
      setCompanyId(storedCompanyId);
      setDesigForm(prev => ({ ...prev, companyId: storedCompanyId }));
    }
  }, []);

  const fetchCompanies = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/v1/companies', { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) setCompanies(data.companies || []);
    } catch (e) { console.error(e); }
  };

  const fetchBranchesForCompany = async (targetCompanyId: string) => {
    try {
      const res = await fetch(`http://localhost:5000/api/v1/branches?companyId=${targetCompanyId}`, { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) return data.branches || [];
    } catch (e) { console.error(e); }
    return [];
  };

  const fetchDepartmentsForCompany = async (targetCompanyId: string) => {
    try {
      const res = await fetch(`http://localhost:5000/api/v1/departments?companyId=${targetCompanyId}`, { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) return data.departments || [];
    } catch (e) { console.error(e); }
    return [];
  };

  const fetchBranchesAndDepartments = async () => {
    try {
      const activeId = isSuperAdmin ? filterCompanyId : companyId;
      const resB = await fetch(getUrl('/api/v1/branches', activeId), { headers: getHeaders() });
      const dataB = await resB.json();
      if (resB.ok) {
        setBranches(dataB.branches || []);
        if (!isSuperAdmin) setDrawerBranches(dataB.branches || []);
      }

      const resD = await fetch(getUrl('/api/v1/departments', activeId), { headers: getHeaders() });
      const dataD = await resD.json();
      if (resD.ok) {
        setDepartments(dataD.departments || []);
        if (!isSuperAdmin) setDrawerDepartments(dataD.departments || []);
      }
    } catch (e) { console.error(e); }
  };

  const fetchDesignations = async () => {
    setLoading(true);
    try {
      const activeId = isSuperAdmin ? filterCompanyId : companyId;
      const res = await fetch(getUrl('/api/v1/designations', activeId), { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) setDesignations(data.designations || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => {
    if (isSuperAdmin) {
      fetchCompanies();
    }
    fetchBranchesAndDepartments();
    fetchDesignations();
  }, [companyId, filterCompanyId, isSuperAdmin]);

  useEffect(() => {
    if (!deletingDesignation) return;
    const timer = setTimeout(() => {
      setDeletingDesignation(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [deletingDesignation]);

  // Cascading handler when company selection changes in drawer
  const handleDrawerCompanyChange = async (targetCompanyId: string) => {
    setDesigForm(prev => ({ ...prev, companyId: targetCompanyId, branch_id: '', department_id: '' }));
    if (targetCompanyId) {
      const bList = await fetchBranchesForCompany(targetCompanyId);
      const dList = await fetchDepartmentsForCompany(targetCompanyId);
      setDrawerBranches(bList);
      setDrawerDepartments(dList);
    } else {
      setDrawerBranches([]);
      setDrawerDepartments([]);
    }
  };

  const handleSaveDesignation = async (e: React.FormEvent) => {
    e.preventDefault();

    const targetCompanyId = isSuperAdmin ? desigForm.companyId : companyId;
    if (isSuperAdmin && !targetCompanyId) {
      showToast('Please select a company context first.', 'error');
      return;
    }

    if (!desigForm.name || !desigForm.description || !desigForm.branch_id || !desigForm.department_id) {
      showToast('Office Branch, Department, Title, and Description are required', 'error');
      return;
    }

    try {
      const url = editMode 
        ? `http://localhost:5000/api/v1/designations/${selectedDesignationId}`
        : 'http://localhost:5000/api/v1/designations';
      const method = editMode ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify({
          name: desigForm.name,
          description: desigForm.description,
          branch_id: desigForm.branch_id,
          department_id: desigForm.department_id,
          companyId: targetCompanyId,
          status: editMode ? desigForm.status : undefined
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(editMode ? 'Designation updated successfully!' : 'Designation registered successfully!', 'success');
        setDesigForm({ name: '', description: '', branch_id: '', department_id: '', companyId: companyId || '', status: 'ACTIVE' });
        setDrawerOpen(false);
        setEditMode(false);
        setSelectedDesignationId(null);
        fetchDesignations();
      } else {
        showToast(data.error || 'Failed to save designation', 'error');
      }
    } catch (err) {
      showToast('Failed to save designation', 'error');
    }
  };

  const handleEditClick = async (ds: Designation) => {
    setEditMode(true);
    setSelectedDesignationId(ds.id);
    setDesigForm({
      name: ds.name,
      description: ds.description,
      branch_id: ds.branch_id,
      department_id: ds.department_id,
      companyId: ds.company_id || '',
      status: ds.status || 'ACTIVE'
    });

    const targetComp = ds.company_id || companyId || '';
    if (targetComp) {
      const bList = await fetchBranchesForCompany(targetComp);
      const dList = await fetchDepartmentsForCompany(targetComp);
      setDrawerBranches(bList);
      setDrawerDepartments(dList);
    } else {
      setDrawerBranches([]);
      setDrawerDepartments([]);
    }
    setDrawerOpen(true);
  };

  const executeDeleteDesignation = async (id: string) => {
    try {
      const res = await fetch(`http://localhost:5000/api/v1/designations/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Designation deleted successfully!', 'success');
        fetchDesignations();
      } else {
        showToast(data.error || 'Failed to delete designation', 'error');
      }
    } catch (err) {
      showToast('Failed to delete designation', 'error');
    }
  };

  const openAddDrawer = () => {
    setEditMode(false);
    setSelectedDesignationId(null);
    setDesigForm({ name: '', description: '', branch_id: '', department_id: '', companyId: companyId || '', status: 'ACTIVE' });
    if (!isSuperAdmin) {
      setDrawerBranches(branches);
      setDrawerDepartments(departments);
    } else {
      setDrawerBranches([]);
      setDrawerDepartments([]);
    }
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="w-full">
        <DashboardPageHeader
          title="Job Designations Builder"
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
          <button
            onClick={openAddDrawer}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-xs font-black text-white shadow-md shadow-blue-500/10 hover:shadow-lg hover:shadow-blue-500/20 transition-all duration-200 cursor-pointer flex items-center gap-1.5 flex-shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Designation
          </button>
        </DashboardPageHeader>
      </div>

      {/* Slide Drawer for creation/editing */}
      <SlideDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} title={editMode ? "Modify Designation" : "Create Designation"}>
        <form onSubmit={handleSaveDesignation} className="space-y-5 text-left">
          
          {isSuperAdmin && (
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
                1. Select Company
              </label>
              <SearchableSelect
                placeholder="Select Company Context"
                options={companies.map(c => ({ value: c.id, label: c.name }))}
                value={desigForm.companyId}
                onChange={val => handleDrawerCompanyChange(val)}
                disabled={editMode}
              />
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
              2. Office Branch
            </label>
            <SearchableSelect
              placeholder="Select Office Branch"
              options={drawerBranches.map(b => ({ value: b.id, label: b.name }))}
              value={desigForm.branch_id}
              onChange={val => setDesigForm({ ...desigForm, branch_id: val, department_id: '' })}
              disabled={isSuperAdmin && !desigForm.companyId}
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
              3. Associated Department
            </label>
            <SearchableSelect
              placeholder="Select Department"
              options={drawerDepartments.filter(d => d.branch_id === desigForm.branch_id).map(d => ({ value: d.id, label: d.name }))}
              value={desigForm.department_id}
              onChange={val => setDesigForm({ ...desigForm, department_id: val })}
              disabled={!desigForm.branch_id}
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
              Designation Title
            </label>
            <input
              type="text" placeholder="e.g. Lead Software Engineer"
              value={desigForm.name}
              onChange={e => setDesigForm({ ...desigForm, name: e.target.value })}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-450 outline-none focus:border-blue-500 focus:bg-card focus:ring-2 focus:ring-blue-100 transition-all duration-200"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
              Description
            </label>
            <input
              type="text" placeholder="e.g. Full-stack tech owner"
              value={desigForm.description}
              onChange={e => setDesigForm({ ...desigForm, description: e.target.value })}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-450 outline-none focus:border-blue-500 focus:bg-card focus:ring-2 focus:ring-blue-100 transition-all duration-200"
            />
          </div>

          {editMode && (
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
                Status
              </label>
              <select
                value={desigForm.status}
                onChange={e => setDesigForm({ ...desigForm, status: e.target.value })}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 focus:bg-card focus:ring-2 focus:ring-blue-100 transition-all duration-200"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          )}

          <button type="submit" className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-sm transition-all duration-200 cursor-pointer">
            {editMode ? 'Save Designation changes' : 'Create Designation'}
          </button>
        </form>
      </SlideDrawer>

      {/* Grid List View */}
      <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-card p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5 border-b border-slate-100 dark:border-slate-800 pb-3.5">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-250">
            Designations list
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
              <tr className="border-b border-slate-200 dark:border-slate-850 text-slate-550 dark:text-slate-455 font-bold uppercase tracking-wider">
                <th className="py-3 px-3">Designation Title</th>
                <th className="py-3 px-3">Description</th>
                <th className="py-3 px-3">Department</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400 dark:text-slate-500 font-medium">
                    Loading designations...
                  </td>
                </tr>
              ) : designations.map(ds => (
                <tr key={ds.id} className="border-b border-slate-100 dark:border-slate-850 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all">
                  <td className="py-3 px-3 font-bold text-slate-750 dark:text-slate-200">{ds.name}</td>
                  <td className="py-3 px-3 text-slate-600 dark:text-slate-400 font-medium">{ds.description}</td>
                  <td className="py-3 px-3 text-slate-550 dark:text-slate-400 font-semibold">{ds.department_name || 'N/A'}</td>
                  <td className="py-3 px-3">
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold border ${
                      ds.status === 'ACTIVE' || !ds.status
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 border-emerald-500/20'
                        : 'bg-slate-500/10 text-slate-600 dark:text-slate-455 border-slate-500/20'
                    }`}>
                      {ds.status || 'ACTIVE'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleEditClick(ds)}
                        title="Edit designation"
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-200 dark:hover:border-blue-900/35 transition-colors cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.83 20.089a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeletingDesignation(ds)}
                        title="Delete designation"
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-400 hover:text-rose-600 dark:hover:text-rose-455 hover:border-rose-200 dark:hover:border-rose-900/35 transition-colors cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && designations.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400 dark:text-slate-500 font-medium">
                    No designations registered yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 🗑️ DELETION CONFIRMATION INTERACTIVE TOAST OVERLAY */}
      {deletingDesignation && (
        <>
          <div className="fixed inset-0 z-[90] bg-black/25 backdrop-blur-[2px]" onClick={() => setDeletingDesignation(null)} />
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
                    Delete designation{' '}
                    <span className="font-black text-rose-600 dark:text-rose-400">&ldquo;{deletingDesignation.name}&rdquo;</span>?
                  </p>
                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium mt-1.5">
                    ⚠️ Associated employees may be affected.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { executeDeleteDesignation(deletingDesignation.id); setDeletingDesignation(null); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-[0.97] text-white text-[11px] font-bold cursor-pointer shadow-md shadow-rose-600/25 transition-all"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
                    Yes, Delete
                  </button>
                  <button
                    onClick={() => setDeletingDesignation(null)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-650 dark:text-slate-330 text-[11px] font-bold cursor-pointer border border-slate-200 dark:border-slate-700 transition-all"
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
