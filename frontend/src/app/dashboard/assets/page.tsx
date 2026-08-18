'use client';

import React, { useEffect, useState } from 'react';
import DashboardPageHeader from '../components/DashboardPageHeader';
import { getHeaders, getUrl } from '../utils/api';
import SearchableSelect from '../components/SearchableSelect';
import { useDashboard } from '../components/DashboardContext';

interface Company {
  id: string;
  name: string;
  subdomain: string;
  status: string;
  created_at: string;
}

interface Asset {
  id: number;
  tag: string;
  name: string;
  type: string;
  assignedTo: string;
  status: 'Assigned' | 'Available' | 'Maintenance';
}

export default function AssetsPage() {
  const { showToast } = useDashboard();
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);

  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');

  const [assets, setAssets] = useState<Asset[]>([
    { id: 1, tag: 'AST-2026-001', name: 'MacBook Pro M3 Max 64GB', type: 'Laptop', assignedTo: 'Ananya Rao', status: 'Assigned' },
    { id: 2, tag: 'AST-2026-002', name: 'Dell UltraSharp 32" 4K Monitor', type: 'Display', assignedTo: 'Siddharth Sen', status: 'Assigned' },
    { id: 3, tag: 'AST-2026-003', name: 'iPad Pro 11" 256GB WiFi', type: 'Tablet', assignedTo: '-- Available --', status: 'Available' },
  ]);

  const [newAsset, setNewAsset] = useState({ tag: '', name: '', type: 'Laptop', assignedTo: '', status: 'Available' as const });

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
    try {
      const res = await fetch('/api/v1/companies', { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) setCompanies(data.companies || []);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      fetchCompanies();
    }
  }, [companyId, isSuperAdmin]);

  const handleRegisterAsset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAsset.name) {
      showToast('Hardware Model Name is required', 'error');
      return;
    }
    const asset: Asset = {
      id: Date.now(),
      tag: newAsset.tag || `AST-2026-${Math.floor(100 + Math.random() * 900)}`,
      name: newAsset.name,
      type: newAsset.type,
      assignedTo: newAsset.assignedTo || '-- Available --',
      status: newAsset.assignedTo ? 'Assigned' : 'Available',
    };
    setAssets([...assets, asset]);
    setNewAsset({ tag: '', name: '', type: 'Laptop', assignedTo: '', status: 'Available' });
    showToast('Asset registered successfully in central inventory database', 'success');
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

  return (
    <div className="space-y-6 animate-fadeIn">
      <DashboardPageHeader
        title="IT Hardware Assets Catalog"
        actionMessage={actionMessage}
        actionError={actionError}
        companies={companies}
        companyId={companyId}
        handleCompanyChange={handleCompanyChange}
        isSuperAdmin={isSuperAdmin}
        email={email}
      />

      <div className="grid gap-6 md:grid-cols-3">
        {/* Register Form */}
        <div className="md:col-span-1 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm h-fit">
          <h3 className="text-sm font-bold text-slate-800 mb-4 border-b border-slate-100 pb-3">Register Hardware Asset</h3>
          <form onSubmit={handleRegisterAsset} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Asset Code / Tag</label>
              <input
                type="text" placeholder="e.g. AST-2026-905"
                value={newAsset.tag}
                onChange={e => setNewAsset({ ...newAsset, tag: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Hardware Model Name</label>
              <input
                type="text" placeholder="e.g. ThinkPad T14 Gen 4"
                value={newAsset.name}
                onChange={e => setNewAsset({ ...newAsset, name: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Asset Category Type</label>
              <SearchableSelect
                placeholder="Select Asset Type"
                options={[
                  { value: 'Laptop', label: 'Laptop Workstation' },
                  { value: 'Display', label: 'UltraSharp Display' },
                  { value: 'Tablet', label: 'Tablet Device' },
                  { value: 'Peripherals', label: 'Office Accessories' }
                ]}
                value={newAsset.type}
                onChange={val => setNewAsset({ ...newAsset, type: val })}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Assign To Employee</label>
              <input
                type="text" placeholder="e.g. Ananya Rao (optional)"
                value={newAsset.assignedTo}
                onChange={e => setNewAsset({ ...newAsset, assignedTo: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500"
              />
            </div>
            <button type="submit" className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer">
              Register Hardware Asset
            </button>
          </form>
        </div>

        {/* Inventory Directory */}
        <div className="md:col-span-2 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-4 border-b border-slate-100 pb-3">Central Hardware Inventory</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-3 px-3">Asset Tag</th>
                  <th className="py-3 px-3">Model Details</th>
                  <th className="py-3 px-3">Category Type</th>
                  <th className="py-3 px-3">Owner Allocation</th>
                  <th className="py-3 px-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {assets.map(asset => (
                  <tr key={asset.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-all">
                    <td className="py-3 px-3 font-mono font-bold text-blue-600 text-[11px]">{asset.tag}</td>
                    <td className="py-3 px-3 font-bold text-slate-700">{asset.name}</td>
                    <td className="py-3 px-3 text-slate-550 font-medium">{asset.type}</td>
                    <td className="py-3 px-3 text-slate-600 font-medium">{asset.assignedTo}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${asset.status === 'Assigned' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                        {asset.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
