'use client';

import React, { useEffect, useState } from 'react';
import DashboardPageHeader from '../components/DashboardPageHeader';
import { getHeaders, getUrl } from '../utils/api';
import SearchableSelect from '../components/SearchableSelect';

interface Company {
  id: string;
  name: string;
  subdomain: string;
  status: string;
  created_at: string;
}

export default function LmsPage() {
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);

  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');

  // Course Catalogs
  const courses = [
    { id: 1, title: 'Corporate Security & ISO 27001 compliance', duration: '2.5 hrs', rating: 4.8, progress: 100 },
    { id: 2, title: 'Next.js App Router Architecture Best Practices', duration: '5.0 hrs', rating: 4.9, progress: 60 },
    { id: 3, title: 'Statutory Payroll Deductions & TDS TDS Calibrations', duration: '3.0 hrs', rating: 4.6, progress: 10 },
  ];

  // Dynamic certificate preview details
  const [certStudent, setCertStudent] = useState('Ananya Rao');
  const [certCourse, setCertCourse] = useState('Corporate Security & ISO 27001 compliance');

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

  const handlePrintCertificate = () => {
    setActionMessage(`Downloading certified credential token for ${certStudent}`);
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
        title="LMS Learning Platform & Certifications"
        actionMessage={actionMessage}
        actionError={actionError}
        companies={companies}
        companyId={companyId}
        handleCompanyChange={handleCompanyChange}
        isSuperAdmin={isSuperAdmin}
        email={email}
      />

      <div className="grid gap-6 md:grid-cols-3">
        {/* Course Directory */}
        <div className="md:col-span-1.5 space-y-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-4 border-b border-slate-100 pb-3">Enrolled Course Directory</h3>
            <div className="space-y-4">
              {courses.map(c => (
                <div key={c.id} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-all space-y-2.5">
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 leading-snug">{c.title}</h4>
                    <p className="text-[10px] text-slate-400 font-semibold mt-1">Duration: {c.duration} | ⭐ {c.rating}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full" style={{ width: `${c.progress}%` }}></div>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 font-mono">{c.progress}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Certificate Generator */}
        <div className="md:col-span-2 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-4 border-b border-slate-100 pb-3">Dynamic Credentials Generator</h3>
            <div className="grid gap-4 sm:grid-cols-2 mb-6">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Recipient Full Name</label>
                <input
                  type="text"
                  value={certStudent}
                  onChange={e => setCertStudent(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Select Completed Course</label>
                <SearchableSelect
                  placeholder="Select Completed Course"
                  options={courses.map(c => ({ value: c.title, label: c.title }))}
                  value={certCourse}
                  onChange={val => setCertCourse(val)}
                />
              </div>
            </div>

            {/* SVG Certificate Preview Panel */}
            <div className="border border-slate-200 rounded-xl p-6 bg-slate-50 flex items-center justify-center min-h-[220px]">
              <div className="w-full max-w-md border-4 border-double border-blue-800 bg-white p-6 text-center space-y-4 shadow">
                <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Certificate of Completion</span>
                <p className="text-[10px] font-semibold text-slate-500">This is proudly presented to</p>
                <h4 className="text-lg font-black text-blue-900 border-b border-slate-200 pb-2 w-fit mx-auto px-4 italic">{certStudent}</h4>
                <p className="text-[10px] text-slate-500 leading-relaxed font-medium">for successfully completing training program for <br /><span className="font-bold text-slate-800">{certCourse}</span></p>
                <div className="flex justify-between items-end pt-4 border-t border-slate-100 text-[8px] text-slate-400 font-bold uppercase tracking-wider font-mono">
                  <span>Authorized HRMS Credential</span>
                  <span>ID: CERT-{Date.now().toString().slice(-6)}</span>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handlePrintCertificate}
            className="w-full mt-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
          >
            Export Secure Credentials PDF
          </button>
        </div>
      </div>
    </div>
  );
}
