'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle2, Printer } from 'lucide-react';

export default function PublicIdCardPage() {
  const params = useParams();
  const empId = (params?.id as string) || '';
  
  const [employee, setEmployee] = useState<any>(null);
  const [companyDetails, setCompanyDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        // Fetch public employee details using public route for QR scans
        const fetchId = empId || '101';
        const res = await fetch(`/api/v1/employees/public/idcard/${encodeURIComponent(fetchId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.employee) {
            setEmployee(data.employee);
          }
        }
        
        // Fetch company details
        const coRes = await fetch(`/api/v1/companies`);
        if (coRes.ok) {
          const coData = await coRes.json();
          if (coData.companies && coData.companies.length > 0) {
            setCompanyDetails(coData.companies[0]);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [empId]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-slate-100 flex flex-col items-center justify-center p-4 font-sans select-none relative overflow-x-hidden">
      
      {/* Background Decorative Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Seal */}
      <div className="mb-6 flex flex-col items-center text-center space-y-2 relative z-10">
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-extrabold text-xs tracking-wider uppercase backdrop-blur-md shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span>OFFICIALLY VERIFIED EMPLOYEE ID</span>
        </div>
        <p className="text-xs text-slate-400 font-medium max-w-xs">
          Authentic Identity Credentials issued by Brihaspathi Technologies Limited
        </p>
      </div>

      {/* 🎴 REALISTIC PHYSICAL ID CARD */}
      <div className="w-[330px] sm:w-[350px] rounded-3xl border border-slate-300 dark:border-slate-700 bg-white text-slate-900 shadow-2xl overflow-hidden relative flex flex-col font-sans border-t-4 border-t-blue-600 transition-all duration-300 hover:shadow-blue-500/20">
        
        {/* 1. Header Section with Smooth Vector Curves & Branding Logo */}
        <div className="relative bg-[#07518a] pt-7 pb-16 px-4 text-center text-white overflow-hidden">
          
          {/* Background Decorative Vector Waves & Circles Pattern */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
            <div className="absolute -top-12 -left-12 w-56 h-56 rounded-full bg-sky-400/20 blur-xl" />
            <div className="absolute -bottom-16 -right-16 w-60 h-60 rounded-full bg-cyan-300/15 blur-xl" />

            <svg className="absolute inset-0 w-full h-full opacity-35" preserveAspectRatio="none" viewBox="0 0 400 160">
              <path d="M -50 160 C 90 20, 260 180, 450 30 L 450 0 L -50 0 Z" fill="#ffffff" fillOpacity="0.1" />
              <path d="M -20 0 C 130 140, 270 10, 420 120 L 420 0 Z" fill="#38bdf8" fillOpacity="0.1" />
              <circle cx="60" cy="40" r="90" fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.25" />
              <circle cx="340" cy="120" r="110" fill="none" stroke="#7dd3fc" strokeWidth="1" opacity="0.2" />
            </svg>
          </div>
          
          <div className="relative z-10 flex flex-col items-center justify-center">
            {companyDetails?.branding_logo || employee?.branding_logo ? (
              <img 
                src={companyDetails?.branding_logo || employee?.branding_logo} 
                alt="Company Branding Logo" 
                className="max-h-12 max-w-[240px] object-contain drop-shadow-md brightness-0 invert"
              />
            ) : (
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1.5">
                  <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="9" strokeOpacity="0.4" />
                    <path d="M12 3a9 9 0 0 1 9 9 9 9 0 0 1-9 9" strokeLinecap="round" />
                  </svg>
                  <span className="text-xl font-black tracking-tight text-white drop-shadow-sm uppercase font-outfit">
                    Brihaspathi
                  </span>
                </div>
                <span className="text-[9px] text-blue-100 font-bold tracking-widest uppercase mt-0.5 opacity-90">
                  ...The Guru of Tomorrow's Technology
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 2. Circular Photo Section & Card Body Background (NO overflow-hidden to prevent photo top clipping) */}
        <div className="relative bg-gradient-to-b from-slate-50 via-white to-sky-50/40 text-slate-900">
          
          {/* Centered Circular Employee Photo overlapping header cleanly */}
          <div className="-mt-14 flex justify-center relative z-30">
            <div className="w-32 h-32 rounded-full border-4 border-white bg-gradient-to-tr from-[#07518a] via-blue-600 to-sky-400 p-1 shadow-2xl flex items-center justify-center overflow-hidden shrink-0">
              {employee?.emp_image ? (
                <img 
                  src={employee.emp_image} 
                  alt="Employee Portrait" 
                  className="w-full h-full rounded-full object-cover object-top"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-gradient-to-br from-[#07518a] to-blue-900 text-white font-black text-4xl flex items-center justify-center uppercase">
                  {employee?.first_name ? employee.first_name.charAt(0) : 'R'}
                </div>
              )}
            </div>
          </div>

          {/* 3. Employee Name & Designation */}
          <div className="px-5 pt-3 pb-2 text-center flex flex-col items-center relative z-10">
            <h2 className="text-xl font-black text-blue-950 tracking-tight leading-snug">
              {employee ? `${employee.first_name || ''} ${employee.last_name || ''}`.trim() : 'Rajasekhar Papolu'}
            </h2>
            <div className="w-16 h-0.5 bg-[#07518a] my-1.5 rounded-full opacity-80" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              {employee?.designation_name || 'MANAGING DIRECTOR'}
            </span>
          </div>

          {/* 4. Blue Pill Box: ID No & Blood Group */}
          <div className="px-5 my-2.5 relative z-10">
            <div className="bg-[#07518a] text-white rounded-xl px-4 py-2.5 flex items-center justify-between shadow-md text-xs font-bold font-mono">
              <div className="flex items-center gap-1.5">
                <span className="text-sky-200">ID No:</span>
                <span className="text-white font-extrabold tracking-wider">
                  {employee?.emp_id_code || empId || '101'}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <span className="text-rose-400 text-sm">🩸 :</span>
                <span className="text-blue-100 font-extrabold">
                  {employee?.blood_group ? (employee.blood_group.includes('Ve') ? employee.blood_group : `${employee.blood_group} Ve`) : 'A+ Ve'}
                </span>
              </div>
            </div>
          </div>

          {/* 5. Issuing Authority Cursive Green Signature Section */}
          <div className="px-5 pt-1 pb-3 flex flex-col items-end text-right relative z-10">
            <div className="h-9 w-28 flex items-center justify-end pr-1">
              <svg className="w-full h-full text-emerald-600" viewBox="0 0 120 40" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M 22 28 C 12 18, 20 8, 28 14 C 36 20, 26 34, 34 34 C 44 34, 38 20, 48 20 C 56 20, 52 32, 62 30 C 72 28, 78 16, 88 22 C 94 26, 100 20, 106 23" />
                <path d="M 60 28 L 92 28" />
              </svg>
            </div>
            <span className="text-[9.5px] font-extrabold text-[#07518a] uppercase tracking-wider border-t border-slate-300/80 pt-0.5 mt-0.5">
              Issuing Authority
            </span>
          </div>
        </div>

        {/* 6. Bottom Blue Footer Banner */}
        <div className="bg-[#07518a] text-white p-3.5 text-center text-[9px] leading-snug font-sans space-y-1.5 relative overflow-hidden">
          {/* Subtly curved light glow behind footer */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-sky-400/10 rounded-full blur-xl pointer-events-none" />

          <p className="font-extrabold text-[11px] tracking-wide uppercase relative z-10">
            {companyDetails?.name || employee?.company_name || 'Brihaspathi Technologies Limited'}
          </p>
          <p className="text-[8.5px] text-sky-200 font-medium italic relative z-10">
            (Formerly known as Brihaspathi Technologies Private Limited)
          </p>
          <p className="font-semibold text-blue-100 text-[9px] relative z-10">
            Toll Free: 1800 296 8899, Phone: +91-9989994488
          </p>
          <p className="font-extrabold text-sky-200 hover:underline cursor-pointer text-[9.5px] relative z-10">
            www.brihaspathi.com
          </p>

          {/* 2-Column Side-by-Side Office Addresses */}
          <div className="border-t border-sky-300/30 pt-1.5 grid grid-cols-2 gap-2 text-left text-[8px] sm:text-[8.5px] leading-tight text-blue-100 relative z-10">
            <div className="space-y-0.5">
              <span className="font-extrabold text-white block uppercase tracking-wide border-b border-sky-300/30 pb-0.5 mb-1">Corporate Office</span>
              <p className="opacity-95">#501, #508-510, Shangrila Plaza, Road No. 2, Banjara Hills, Hyd - 34</p>
            </div>
            <div className="space-y-0.5 border-l border-sky-300/30 pl-2">
              <span className="font-extrabold text-white block uppercase tracking-wide border-b border-sky-300/30 pb-0.5 mb-1">Registered Office</span>
              <p className="opacity-95">#7-1-621/259, Sahithi Arcade, V Floor, S R Nagar, Hyd -38</p>
            </div>
          </div>
        </div>

      </div>

      {/* Action Footer */}
      <div className="mt-6 flex items-center gap-3 relative z-10">
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>Print / Save ID Card</span>
        </button>
      </div>

    </div>
  );
}
