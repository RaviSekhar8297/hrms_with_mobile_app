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
  company_id?: string;
  branch_id: string;
  branch_name?: string;
  name: string;
  description: string;
  status: string;
}

export default function DepartmentsPage() {
  const { showToast } = useDashboard();
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [drawerBranches, setDrawerBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [filterCompanyId, setFilterCompanyId] = useState<string | null>(null);
  const [deletingDepartment, setDeletingDepartment] = useState<Department | null>(null);

  // Form states
  const [deptForm, setDeptForm] = useState({ name: '', description: '', branch_id: '', companyId: '', status: 'ACTIVE' });

  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('superadmin');

  useEffect(() => {
    const storedRoles = localStorage.getItem('roles');
    const storedEmail = localStorage.getItem('email');
    const storedCompanyId = localStorage.getItem('companyId');
    if (storedRoles) setRoles(JSON.parse(storedRoles));
    if (storedEmail) setEmail(storedEmail);
    if (storedCompanyId) {
      setCompanyId(storedCompanyId);
      setDeptForm(prev => ({ ...prev, companyId: storedCompanyId }));
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
      if (res.ok) {
        return data.branches || [];
      }
    } catch (e) { console.error(e); }
    return [];
  };

  const fetchBranches = async () => {
    try {
      const activeId = isSuperAdmin ? filterCompanyId : companyId;
      const res = await fetch(getUrl('/api/v1/branches', activeId), { headers: getHeaders() });
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
      const activeId = isSuperAdmin ? filterCompanyId : companyId;
      const res = await fetch(getUrl('/api/v1/departments', activeId), { headers: getHeaders() });
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
  }, [companyId, filterCompanyId, isSuperAdmin]);

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
        ? `http://localhost:5000/api/v1/departments/${selectedDepartmentId}`
        : 'http://localhost:5000/api/v1/departments';
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
      const res = await fetch(`http://localhost:5000/api/v1/departments/${id}`, {
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
        >
          <button
            onClick={openAddDrawer}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-xs font-black text-white shadow-md shadow-blue-500/10 hover:shadow-lg hover:shadow-blue-500/20 transition-all duration-200 cursor-pointer flex items-center gap-1.5 flex-shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Department
          </button>
        </DashboardPageHeader>
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
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-250">
            Departments list
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
                <th className="py-3 px-3">Department Name</th>
                <th className="py-3 px-3">Description</th>
                <th className="py-3 px-3">Office Branch</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400 dark:text-slate-500 font-medium">
                    Loading departments...
                  </td>
                </tr>
              ) : departments.map(d => (
                <tr key={d.id} className="border-b border-slate-100 dark:border-slate-850 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all">
                  <td className="py-3 px-3 font-bold text-slate-750 dark:text-slate-200">{d.name}</td>
                  <td className="py-3 px-3 text-slate-600 dark:text-slate-400 font-medium">{d.description}</td>
                  <td className="py-3 px-3 text-slate-550 dark:text-slate-400 font-semibold">{d.branch_name || 'N/A'}</td>
                  <td className="py-3 px-3">
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold border ${
                      d.status === 'ACTIVE' || !d.status
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 border-emerald-500/20'
                        : 'bg-slate-500/10 text-slate-600 dark:text-slate-455 border-slate-500/20'
                    }`}>
                      {d.status || 'ACTIVE'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleEditClick(d)}
                        title="Edit department"
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-200 dark:hover:border-blue-900/35 transition-colors cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.83 20.089a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeletingDepartment(d)}
                        title="Delete department"
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
              {!loading && departments.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400 dark:text-slate-500 font-medium">
                    No departments registered yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
