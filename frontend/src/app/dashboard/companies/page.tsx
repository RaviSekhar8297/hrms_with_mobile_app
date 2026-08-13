'use client';

import React, { useEffect, useState } from 'react';
import DashboardPageHeader from '../components/DashboardPageHeader';
import { getHeaders } from '../utils/api';
import SlideDrawer from '../components/SlideDrawer';
import { useDashboard } from '../components/DashboardContext';

interface Company {
  id: string;
  name: string;
  company_code?: string;
  subdomain: string;
  domain: string;
  branding_logo: string;
  status: string;
  established_date?: string;
  created_at: string;
}

export default function CompaniesPage() {
  const { showToast } = useDashboard();
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Deletion interactive toast state
  const [deletingCompany, setDeletingCompany] = useState<Company | null>(null);

  // Form states
  const [companyForm, setCompanyForm] = useState({
    name: '',
    company_code: '',
    subdomain: '',
    domain: '',
    branding_logo: '',
    status: 'ACTIVE',
    established_date: ''
  });

  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('superadmin');

  useEffect(() => {
    const storedRoles = localStorage.getItem('roles');
    const storedEmail = localStorage.getItem('email');
    const storedCompanyId = localStorage.getItem('companyId');
    if (storedRoles) setRoles(JSON.parse(storedRoles));
    if (storedEmail) setEmail(storedEmail);
    if (storedCompanyId) setCompanyId(storedCompanyId);
  }, []);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/v1/companies', { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) {
        setCompanies(data.companies || []);
      } else {
        showToast(data.error || 'Failed to fetch companies list', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Connection to company API failed', 'error');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCompanies();
  }, [companyId]);

  useEffect(() => {
    if (!deletingCompany) return;
    const timer = setTimeout(() => {
      setDeletingCompany(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [deletingCompany]);

  const openAddDrawer = () => {
    setEditMode(false);
    setSelectedCompanyId(null);
    setCompanyForm({
      name: '',
      company_code: '',
      subdomain: '',
      domain: '',
      branding_logo: '',
      status: 'ACTIVE',
      established_date: ''
    });
    setDrawerOpen(true);
  };

  const openEditDrawer = (company: Company) => {
    setEditMode(true);
    setSelectedCompanyId(company.id);
    let estDateFormatted = '';
    if (company.established_date) {
      try {
        estDateFormatted = new Date(company.established_date).toISOString().split('T')[0];
      } catch (e) {
        estDateFormatted = company.established_date.split('T')[0] || '';
      }
    }
    setCompanyForm({
      name: company.name,
      company_code: company.company_code || company.subdomain?.toUpperCase() || '',
      subdomain: company.subdomain,
      domain: company.domain || '',
      branding_logo: company.branding_logo || '',
      status: company.status || 'ACTIVE',
      established_date: estDateFormatted
    });
    setDrawerOpen(true);
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyForm.name || !companyForm.subdomain) {
      showToast('Corporate Name and Subdomain are required', 'error');
      return;
    }

    const endpoint = editMode 
      ? `http://localhost:5000/api/v1/companies/${selectedCompanyId}` 
      : 'http://localhost:5000/api/v1/companies';
    const method = editMode ? 'PUT' : 'POST';

    try {
      const res = await fetch(endpoint, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(companyForm)
      });
      const data = await res.json();
      if (res.ok) {
        showToast(editMode ? 'Tenant details updated successfully!' : 'Tenant company successfully registered!', 'success');
        setDrawerOpen(false);
        fetchCompanies();
      } else {
        showToast(data.error || 'Failed to save company', 'error');
      }
    } catch (err) {
      showToast('Failed to save company record', 'error');
    }
  };

  const executeDeleteCompany = async (id: string) => {
    try {
      const res = await fetch(`http://localhost:5000/api/v1/companies/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Tenant company successfully removed', 'success');
        fetchCompanies();
      } else {
        showToast(data.error || 'Failed to delete company', 'error');
      }
    } catch (err) {
      showToast('Error deleting tenant company', 'error');
    }
  };

  const handleCompanyChange = (id: string) => {
    const val = id || null;
    setCompanyId(val);
    if (val) {
      localStorage.setItem('companyId', val);
    } else {
      localStorage.removeItem('companyId');
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="p-6 text-center text-xs font-bold text-red-600 dark:text-red-400 border border-red-200/50 dark:border-red-950/30 bg-red-50/10 rounded-2xl animate-fadeIn">
        ⚠️ Unauthorized Access. Master Multi-Tenant company administration console requires SuperAdmin role privilege permissions.
      </div>
    );
  }

  // Filtered companies based on search query and status filter
  const filteredCompanies = companies.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          c.subdomain.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (c.domain && c.domain.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-fadeIn select-none relative">
      
      {/* Page Header */}
      <div className="w-full">
        <DashboardPageHeader
          title="Multi-Tenant Companies"
          actionMessage=""
          actionError=""
          companies={companies}
          companyId={companyId}
          handleCompanyChange={handleCompanyChange}
          isSuperAdmin={isSuperAdmin}
          email={email}
          hideCompanySelect={true}
          hideUserBadge={true}
        />
      </div>

      {/* Main Listing & Filters Panel */}
      <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/80 bg-card p-6 shadow-sm space-y-6">
        {/* Search & Real-time Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:max-w-xs">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search corporate tenants..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-search pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 focus:bg-card focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-all duration-200"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Status:</span>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-blue-500 focus:bg-card focus:ring-1 focus:ring-blue-100 cursor-pointer"
              >
                <option value="ALL">Show All</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>

            <button
              onClick={openAddDrawer}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-blue-600/20 hover:shadow-lg hover:shadow-blue-600/25 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer group flex-shrink-0"
            >
              <span className="flex h-4.5 w-4.5 items-center justify-center rounded-md bg-white/20 group-hover:bg-white/30 transition-colors flex-shrink-0">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </span>
              <span className="tracking-wide">Onboard Tenant</span>
            </button>
          </div>
        </div>

        {/* Table Listing */}
        <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800/80">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/70 dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-widest text-[9.5px] select-none">
                <th className="py-3.5 px-3 w-36 text-center">Identity</th>
                <th className="py-3.5 px-4">Company Details</th>
                <th className="py-3.5 px-4">Subdomain Access</th>
                <th className="py-3.5 px-4">Connected Domain</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Established Date</th>
                <th className="py-3.5 px-4">Created At</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-850/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-450 dark:text-slate-500 font-bold uppercase tracking-wider">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent mr-2.5 align-middle" />
                    Syncing tenant instances...
                  </td>
                </tr>
              ) : filteredCompanies.map(c => {
                const initials = c.name ? c.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'CO';
                
                return (
                  <tr key={c.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/20 transition-colors duration-150">
                    
                    {/* Extra Large Logo/Identity Avatar with theme-adaptive background */}
                    <td className="py-3.5 px-3">
                      <div className="flex justify-center">
                        {c.branding_logo ? (
                          <div className="h-14 w-32 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center p-1 border border-slate-200 dark:border-slate-700 shadow-sm relative group overflow-hidden">
                            <img 
                              src={c.branding_logo} 
                              alt={c.name} 
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              className="h-full w-full object-contain rounded-md transition-transform duration-200 group-hover:scale-105"
                            />
                          </div>
                        ) : (
                          <div className="h-14 w-14 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-sm font-black shadow-xs tracking-wider">
                            {initials}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Company Details with Company Code right below Company Name */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col text-left space-y-1">
                        <span className="font-bold text-slate-850 dark:text-slate-100 text-sm tracking-tight">{c.name}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">CODE:</span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-mono font-extrabold text-[10.5px] border border-indigo-200/70 dark:border-indigo-900/50 uppercase tracking-wider">
                            {c.company_code || c.subdomain?.toUpperCase() || 'COMP'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Subdomain */}
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-600 dark:text-blue-400 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                        <span>{c.subdomain}.hrms.com</span>
                      </div>
                    </td>

                    {/* Connected Domain */}
                    <td className="py-3.5 px-4">
                      {c.domain ? (
                        <div className="inline-flex items-center gap-1.5 font-mono text-slate-700 dark:text-slate-300 font-bold border border-slate-200/80 dark:border-slate-800 px-2.5 py-1 rounded-xl bg-slate-50/50 dark:bg-slate-950/20 max-w-max">
                          <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-.778.099-1.533.284-2.253m0 0L21 12" />
                          </svg>
                          <span>{c.domain}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-600 font-medium italic select-none">No custom domain linked</span>
                      )}
                    </td>

                    {/* Status badge */}
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                        c.status === 'ACTIVE' || !c.status
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200/80 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30'
                          : c.status === 'SUSPENDED'
                          ? 'bg-amber-50 text-amber-600 border-amber-200/80 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30'
                          : 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-900/30 dark:text-slate-400 dark:border-slate-800'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          c.status === 'ACTIVE' || !c.status
                            ? 'bg-emerald-500 animate-pulse'
                            : c.status === 'SUSPENDED'
                            ? 'bg-amber-500'
                            : 'bg-slate-400'
                        }`} />
                        <span>{c.status || 'ACTIVE'}</span>
                      </span>
                    </td>

                    {/* Established Date */}
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 font-mono font-medium text-xs">
                      {c.established_date ? (
                        <span>{new Date(c.established_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-600 font-medium italic select-none">N/A</span>
                      )}
                    </td>

                    {/* Created At */}
                    <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 font-mono font-bold">
                      {new Date(c.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditDrawer(c)}
                          title="Modify company details"
                          className="h-8 w-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/60 hover:bg-gradient-to-r hover:from-blue-600 hover:to-indigo-600 hover:text-white hover:border-transparent shadow-xs hover:shadow-md hover:shadow-blue-500/25 active:scale-95 transition-all duration-200 cursor-pointer flex items-center justify-center group"
                        >
                          <svg className="w-4 h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.83 20.089a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeletingCompany(c)}
                          title="Delete company"
                          className="h-8 w-8 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800/60 hover:bg-gradient-to-r hover:from-rose-600 hover:to-red-600 hover:text-white hover:border-transparent shadow-xs hover:shadow-md hover:shadow-rose-500/25 active:scale-95 transition-all duration-200 cursor-pointer flex items-center justify-center group"
                        >
                          <svg className="w-4 h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && filteredCompanies.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400 dark:text-slate-500 font-bold tracking-wide select-none">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="w-8 h-8 text-slate-300 dark:text-slate-700" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15" />
                      </svg>
                      <span>No corporate tenants match your search filter criteria.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide Drawer for Onboarding & Editing */}
      <SlideDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} title={editMode ? "Modify Tenant Company" : "Onboard New Tenant"}>
        <form onSubmit={handleSaveCompany} className="space-y-5">

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
              Company Corporate Name *
            </label>
            <input
              type="text" placeholder="e.g. Acme Corp Inc"
              value={companyForm.name}
              onChange={e => setCompanyForm({ ...companyForm, name: e.target.value })}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none focus:border-blue-500 focus:bg-card focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-all duration-200 font-medium"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
              Company Code (Prefix)
            </label>
            <input
              type="text" placeholder="e.g. BTL, ACME"
              value={companyForm.company_code}
              onChange={e => setCompanyForm({ ...companyForm, company_code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none focus:border-blue-500 focus:bg-card focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-all duration-200 font-mono font-bold uppercase"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
              Tenant Subdomain identifier *
            </label>
            <div className="relative">
              <input
                type="text" placeholder="e.g. acme"
                value={companyForm.subdomain}
                onChange={e => setCompanyForm({ ...companyForm, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 pl-3.5 pr-24 py-2.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none focus:border-blue-500 focus:bg-card focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-all duration-200 font-mono"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider select-none bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                .hrms.com
              </span>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
              Established Date (Date of Incorporation)
            </label>
            <input
              type="date"
              value={companyForm.established_date}
              onChange={e => setCompanyForm({ ...companyForm, established_date: e.target.value })}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 focus:bg-card focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-all duration-200 font-mono font-medium"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
              Custom Corporate Domain (Optional)
            </label>
            <input
              type="text" placeholder="e.g. acme.com"
              value={companyForm.domain}
              onChange={e => setCompanyForm({ ...companyForm, domain: e.target.value.toLowerCase().trim() })}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none focus:border-blue-500 focus:bg-card focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-all duration-200 font-mono"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
              Branding Logo (Optional)
            </label>

            {/* Dual Surface Preview for uploaded logo (Light vs Dark background) */}
            {companyForm.branding_logo && (
              <div className="space-y-2 mb-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Logo Preview across surfaces</p>
                  <button
                    type="button"
                    onClick={() => setCompanyForm({ ...companyForm, branding_logo: '' })}
                    className="text-[9.5px] font-black text-rose-500 hover:text-rose-600 uppercase tracking-wider px-2 py-0.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {/* Light Surface preview */}
                  <div className="flex flex-col items-center gap-1.5 p-2 rounded-lg border border-slate-200 bg-white shadow-xs">
                    <span className="text-[8.5px] font-bold text-slate-400 uppercase">Light Theme</span>
                    <div className="h-14 w-full flex items-center justify-center p-1">
                      <img
                        src={companyForm.branding_logo}
                        alt="Logo light preview"
                        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  </div>
                  {/* Dark Surface preview */}
                  <div className="flex flex-col items-center gap-1.5 p-2 rounded-lg border border-slate-800 bg-slate-900 shadow-xs">
                    <span className="text-[8.5px] font-bold text-slate-400 uppercase">Dark Theme</span>
                    <div className="h-14 w-full flex items-center justify-center p-1">
                      <img
                        src={companyForm.branding_logo}
                        alt="Logo dark preview"
                        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* File picker dropzone */}
            <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50/20 dark:hover:bg-blue-950/10 transition-all duration-200 group">
              <div className="flex flex-col items-center gap-1.5 text-center px-4">
                <svg className="w-7 h-7 text-slate-400 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <p className="text-[10.5px] font-bold text-slate-600 dark:text-slate-300 group-hover:text-blue-600 transition-colors">
                  {companyForm.branding_logo ? 'Click to replace logo' : 'Click or drop logo image here'}
                </p>
                <p className="text-[9px] text-slate-400 dark:text-slate-500">Supports PNG (transparent), JPG, SVG, WebP (Max 5MB)</p>
              </div>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 5 * 1024 * 1024) { alert('Image too large. Please choose an image under 5MB.'); return; }
                  const img = new Image();
                  const objectUrl = URL.createObjectURL(file);
                  img.onload = () => {
                    const MAX = 512;
                    const scale = Math.min(1, MAX / Math.max(img.width, img.height));
                    const canvas = document.createElement('canvas');
                    canvas.width  = Math.round(img.width  * scale);
                    canvas.height = Math.round(img.height * scale);
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                      // Clear canvas to ensure transparent background is preserved for PNG
                      ctx.clearRect(0, 0, canvas.width, canvas.height);
                      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    }
                    // CRITICAL FIX: Use image/png instead of image/jpeg to keep PNG transparency intact
                    const compressed = canvas.toDataURL('image/png');
                    setCompanyForm(prev => ({ ...prev, branding_logo: compressed }));
                    URL.revokeObjectURL(objectUrl);
                  };
                  img.src = objectUrl;
                  e.target.value = '';
                }}
              />
            </label>
          </div>

          {editMode && (
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
                Activation Status
              </label>
              <select
                value={companyForm.status}
                onChange={e => setCompanyForm({ ...companyForm, status: e.target.value })}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 focus:bg-card focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-all duration-200 font-bold"
              >
                <option value="ACTIVE" className="bg-card text-emerald-600 font-bold">ACTIVE</option>
                <option value="SUSPENDED" className="bg-card text-amber-600 font-bold">SUSPENDED</option>
                <option value="INACTIVE" className="bg-card text-slate-500 font-bold">INACTIVE</option>
              </select>
            </div>
          )}

          <div className="pt-2">
            <button type="submit" className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-xs font-bold text-white shadow-md shadow-blue-600/20 active:scale-[0.99] transition-all duration-200 cursor-pointer">
              {editMode ? "Save Changes" : "Register Corporate Tenant"}
            </button>
          </div>
        </form>
      </SlideDrawer>

      {/* 🗑️ DELETION CONFIRMATION DIALOG */}
      {deletingCompany && (
        <>
          <div className="fixed inset-0 z-[90] bg-black/30 backdrop-blur-[2px]" onClick={() => setDeletingCompany(null)} />
          <div className="fixed right-6 top-1/2 -translate-y-1/2 z-[100] w-[320px] animate-slideIn">
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
                <div className="mb-5 p-3.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30">
                  <p className="text-[12px] text-slate-700 dark:text-slate-200 font-medium leading-relaxed">
                    Delete corporate tenant{' '}
                    <span className="font-black text-rose-600 dark:text-rose-400">&ldquo;{deletingCompany.name}&rdquo;</span>?
                  </p>
                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium mt-1.5">
                    ⚠️ Linked employee accounts will be orphaned.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { executeDeleteCompany(deletingCompany.id); setDeletingCompany(null); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-[0.97] text-white text-[11px] font-bold cursor-pointer shadow-md shadow-rose-600/25 transition-all"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
                    Yes, Delete
                  </button>
                  <button
                    onClick={() => setDeletingCompany(null)}
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
