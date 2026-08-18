'use client';

import React, { useEffect, useState } from 'react';
import DashboardPageHeader from '../components/DashboardPageHeader';
import { getHeaders, getUrl } from '../utils/api';

interface Company {
  id: string;
  name: string;
  subdomain: string;
  status: string;
  created_at: string;
}

export default function BillingPage() {
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);

  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');

  // Interactive slider seat count state
  const [seats, setSeats] = useState(25);

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

  // Derived price calculation based on tiers
  const pricePerSeat = seats > 200 ? 3 : seats > 50 ? 4 : 5; // Volume discounts
  const monthlyCost = seats * pricePerSeat;

  const handleUpdateSubscription = () => {
    setActionMessage(`Subscription plan updated to ${seats} seats: $${monthlyCost}/month`);
    setTimeout(() => setActionMessage(''), 3000);
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
        title="Billing & Tenant Subscriptions Plan"
        actionMessage={actionMessage}
        actionError={actionError}
        companies={companies}
        companyId={companyId}
        handleCompanyChange={handleCompanyChange}
        isSuperAdmin={isSuperAdmin}
        email={email}
      />

      <div className="grid gap-6 md:grid-cols-3">
        {/* Interactive seat cost slider */}
        <div className="md:col-span-2 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800">Dynamic Seats Calculator</h3>
              <span className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-100 font-mono font-bold px-2 py-0.5 rounded uppercase tracking-wider">Volume Discount active</span>
            </div>
            
            <div className="space-y-6 my-6">
              <div>
                <label className="flex justify-between text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                  <span>Number of Employee Seats</span>
                  <span className="text-indigo-600 font-mono font-bold">{seats} active accounts</span>
                </label>
                <input
                  type="range" min="5" max="500" step="5"
                  value={seats}
                  onChange={e => setSeats(Number(e.target.value))}
                  className="w-full h-2 bg-slate-150 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3 text-center pt-2">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Pricing Tier</span>
                  <p className="text-sm font-bold text-slate-700 mt-1">{seats > 200 ? 'Enterprise Pro' : seats > 50 ? 'Growth Scale' : 'Startup Core'}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Unit Cost Seat</span>
                  <p className="text-sm font-bold text-slate-700 mt-1 font-mono">${pricePerSeat}/month</p>
                </div>
                <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
                  <span className="text-[9px] font-bold text-indigo-550 uppercase tracking-wider">Estimated Total Cost</span>
                  <p className="text-lg font-black text-indigo-700 mt-1 font-mono">${monthlyCost.toLocaleString()}/mo</p>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleUpdateSubscription}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
          >
            Update Tenant Subscription Seat count
          </button>
        </div>

        {/* Feature Tiers Matrix */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm h-fit space-y-4">
          <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3">Available Platform Packages</h3>
          <div className="space-y-3.5">
            <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 space-y-1">
              <h4 className="text-xs font-bold text-slate-750">Startup Core ($5 / seat / mo)</h4>
              <p className="text-[10px] text-slate-500 font-medium">Standard HRMS features: Branches, Departments, Designations, Employee directory, geofenced checks.</p>
            </div>
            <div className="p-3.5 rounded-xl border border-blue-150 bg-blue-50/20 space-y-1">
              <h4 className="text-xs font-bold text-blue-700">Growth Scale ($4 / seat / mo)</h4>
              <p className="text-[10px] text-blue-600 font-medium">Startup Core + Statutory Compensation calculator, OKR objectives sliders, ATS recruitment board, LMS certificates.</p>
            </div>
            <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 space-y-1">
              <h4 className="text-xs font-bold text-slate-750">Enterprise Pro ($3 / seat / mo)</h4>
              <p className="text-[10px] text-slate-500 font-medium">Growth Scale + API edge gateways access, dedicated multi-tenant DB schema isolation, SSO Keycloak SAML support.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
