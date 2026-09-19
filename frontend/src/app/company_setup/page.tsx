'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Branch {
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
}

// Clean, premium inline SVG Icons Component Library
const Icons = {
  User: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  Phone: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  ),
  Building: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  Globe: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9-9c1.657 0 3 4.03 3 9s-1.343 9-3 9m0-18c-1.657 0-3 4.03-3 9s1.343 9 3 9m-9-9a9 9 0 019-9" />
    </svg>
  ),
  MapPin: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  Shield: () => (
    <svg className="w-4.5 h-4.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  Briefcase: () => (
    <svg className="w-4.5 h-4.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  Users: () => (
    <svg className="w-4.5 h-4.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  Cog: () => (
    <svg className="w-4.5 h-4.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  Code: () => (
    <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  ),
  Heart: () => (
    <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  ),
  Currency: () => (
    <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Support: () => (
    <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  Scale: () => (
    <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
    </svg>
  )
};

export default function CompanySetupPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Switch to light theme on company setup page mount
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('theme-nordic-light');

    return () => {
      // Revert to dark mode on unmount
      document.documentElement.classList.remove('theme-nordic-light');
      document.documentElement.classList.add('dark');
    };
  }, []);

  // State Management
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [fadeState, setFadeState] = useState('fade-in');
  const [loadingStep, setLoadingStep] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);

  const triggerStepTransition = (nextStep: number) => {
    setFadeState('fade-out');
    setTimeout(() => {
      setStep(nextStep);
      setFadeState('fade-in');
    }, 200);
  };

  // Step 1: Admin Profile
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState('Founder / CEO');

  // Step 2: Company Setup
  const [companyName, setCompanyName] = useState('');
  const [website, setWebsite] = useState('');
  const [industry, setIndustry] = useState('Technology');
  const [companySize, setCompanySize] = useState('11-50');

  // Step 3: Branch Config
  const [branchName, setBranchName] = useState('Headquarters');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('India');
  const [branches, setBranches] = useState<Branch[]>([]);

  // Local helper to add a branch to the list
  const handleAddBranch = () => {
    if (!branchName.trim() || !address.trim() || !city.trim() || !state.trim()) {
      alert('Please fill out all the branch details before adding.');
      return;
    }
    const newBranch: Branch = {
      name: branchName,
      address,
      city,
      state,
      country,
    };
    setBranches([...branches, newBranch]);
    
    // Reset inputs for another branch entry
    setBranchName(`Branch ${branches.length + 2}`);
    setAddress('');
    setCity('');
    setState('');
  };

  const handleRemoveBranch = (idx: number) => {
    setBranches(branches.filter((_, i) => i !== idx));
  };

  // Validations per step
  const isStep1Valid = fullName.trim() !== '' && phone.trim() !== '' && designation !== '';
  const isStep2Valid = companyName.trim() !== '' && industry !== '' && companySize !== '';
  const isStep3Valid = branches.length > 0 || (address.trim() !== '' && city.trim() !== '' && state.trim() !== '');

  const handleNext = () => {
    let nextStep = step;
    if (step === 1 && isStep1Valid) {
      nextStep = 2;
    } else if (step === 2 && isStep2Valid) {
      nextStep = 3;
    } else if (step === 3 && isStep3Valid) {
      if (branches.length === 0 && address.trim() !== '') {
        const autoBranch: Branch = {
          name: branchName,
          address,
          city,
          state,
          country,
        };
        setBranches([autoBranch]);
      }
      nextStep = 4;
    }
    if (nextStep !== step) {
      triggerStepTransition(nextStep);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      triggerStepTransition(step - 1);
    }
  };

  const handleCompleteSetup = () => {
    setLoading(true);
    setLoadingStep(0);
    setLoadingProgress(0);

    const interval = setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 1;
      });
    }, 35); // 3.5 seconds total loading animation

    setTimeout(() => setLoadingStep(1), 800);
    setTimeout(() => setLoadingStep(2), 1700);
    setTimeout(() => setLoadingStep(3), 2600);
    setTimeout(() => setLoadingStep(4), 3300);

    setTimeout(() => {
      router.push('/dashboard');
    }, 4200);
  };

  const stepsList = [
    { num: 1, label: 'Administrator', desc: 'Personal details' },
    { num: 2, label: 'Company Profile', desc: 'Sector & scale' },
    { num: 3, label: 'Office Branches', desc: 'HQ & branches' },
    { num: 4, label: 'Launch Workspace', desc: 'Deploy environment' }
  ];

  if (!mounted) return null;

  return (
    <div className="relative min-h-screen w-full flex flex-col md:flex-row bg-gradient-to-br from-[#f8fafc] via-[#eff6ff] to-[#e0f2fe] text-slate-800 font-sans select-none overflow-hidden z-10">
      
      {/* Abstract Wavy Background Curves matching user reference image, spanning full page */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none -z-10" preserveAspectRatio="none" viewBox="0 0 1440 900" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="wave-grad-1" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.18" />
            <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="wave-grad-2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0" />
            <stop offset="50%" stopColor="#0284c7" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#0369a1" stopOpacity="0.25" />
          </linearGradient>
          <linearGradient id="wave-grad-3" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.22" />
            <stop offset="40%" stopColor="#bae6fd" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#e0f2fe" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="wave-grad-4" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0284c7" stopOpacity="0.16" />
            <stop offset="50%" stopColor="#0ea5e9" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
          </linearGradient>
        </defs>
        
        {/* Curve 4: top-left to bottom-right sweep */}
        <path d="M -100 -100 C 150 150 300 400 800 500 L -100 800 Z" fill="url(#wave-grad-1)" />

        {/* Curve 3: middle wave */}
        <path d="M -100 500 C 300 300 800 700 1500 400 L 1500 1000 L -100 1000 Z" fill="url(#wave-grad-3)" />

        {/* Curve 2: lower sweeping wave */}
        <path d="M -100 650 C 400 500 900 350 1500 300 L 1500 1000 L -100 1000 Z" fill="url(#wave-grad-2)" />

        {/* Curve 1: front translucent wave */}
        <path d="M -100 800 C 300 850 1000 600 1500 550 L 1500 1000 L -100 1000 Z" fill="url(#wave-grad-4)" />
      </svg>


      {/* LEFT COLUMN: Clean Slate Integrated Sidebar with Animated Vertical Progress */}
      <div className="w-full md:w-[280px] lg:w-[320px] bg-[#f8fafc]/30 backdrop-blur-md border-b md:border-b-0 md:border-r border-slate-200/50 p-8 md:p-10 flex flex-col justify-between shrink-0 relative z-20">
        <div className="flex flex-col gap-14">
          
          {/* Logo Header */}
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/10">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </span>
            <span className="text-[13px] font-black tracking-[0.2em] uppercase text-slate-800">HRMaster</span>
          </div>

          {/* Vertical Steps Timeline with animated progress line */}
          <div className="flex flex-col gap-8 relative px-1">
            {/* Elegant connecting line */}
            <div className="absolute left-[15px] top-4 bottom-4 w-[2px] bg-slate-200" />
            <div 
              className="absolute left-[15px] top-4 w-[2px] bg-blue-600 transition-all duration-500 ease-out"
              style={{ height: `${Math.max(0, ((step - 1) / (stepsList.length - 1)) * 88)}%` }}
            />

            {stepsList.map((s, idx) => {
              const isCompleted = step > s.num;
              const isActive = step === s.num;
              return (
                <div 
                  key={s.num} 
                  className={`flex gap-4 items-center p-3.5 -mx-3 rounded-[16px] transition-all duration-350 ${
                    isActive 
                      ? 'bg-blue-50/60 shadow-sm border border-slate-200/50 scale-[1.02]' 
                      : 'border border-transparent'
                  } animate-slide-in-left`}
                  style={{ animationDelay: `${(idx + 1) * 80}ms` }}
                >
                  <div className="relative flex items-center justify-center w-8 h-8 shrink-0">
                    {/* Active Step Pulse Glow Ring */}
                    {isActive && (
                      <div className="absolute inset-0 rounded-full active-pulse" />
                    )}
                    
                    <div 
                      className={`w-8 h-8 rounded-full flex items-center justify-center border font-extrabold text-xs transition-all duration-300 ${
                        isCompleted 
                          ? 'bg-blue-600 border-blue-600 text-white shadow-sm scale-100 animate-scale-in' 
                          : isActive 
                            ? 'bg-white border-blue-600 text-blue-600 scale-105 relative z-10'
                            : 'bg-white border-slate-200 text-slate-400'
                      }`}
                    >
                      {isCompleted ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        s.num
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col mt-0.5 ml-0.5">
                    <span className={`text-[11px] font-black tracking-wide uppercase transition-colors ${isActive ? 'text-blue-600' : isCompleted ? 'text-slate-700' : 'text-slate-400'}`}>
                      {s.label}
                    </span>
                    <span className="text-[9.5px] text-slate-400 font-bold mt-0.5 leading-none">{s.desc}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Small copyright info */}
        <div className="hidden md:block">
          <span className="text-[9px] text-slate-400 font-bold">HRMaster Setup Console • v1.4</span>
        </div>
      </div>

      {/* RIGHT COLUMN: Professional Clean Centered Form Area with transparent background */}
      <div className="flex-1 bg-transparent p-6 md:p-12 lg:p-16 flex items-center justify-center overflow-y-auto relative z-20">
        
        {/* Simple and Professional Setup Card with highly curved angles & translucent glass backdrop */}
        <div className={`w-full max-w-5xl bg-white/30 backdrop-blur-xl border border-white/45 shadow-[0_30px_60px_rgba(15,23,42,0.04)] rounded-[32px] p-6 sm:p-10 md:p-12 relative z-30 transition-all duration-500 ${
          loading ? 'loading-card-active' : ''
        }`}>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-8 animate-[scale-in_0.35s_cubic-bezier(0.16,1,0.3,1)]">
              {/* Spinner / Pulse graphic */}
              <div className="relative w-20 h-20 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-blue-500/10" />
                <div 
                  className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" 
                  style={{ animationDuration: '1.2s' }}
                />
                <span className="text-sm font-black text-blue-600">{loadingProgress}%</span>
              </div>

              {/* Progress Titles */}
              <div className="text-center space-y-2">
                <h3 className="text-xl font-black text-slate-800 tracking-tight">Deploying Your Workspace</h3>
                <p className="text-xs text-slate-500 font-bold max-w-sm">Please wait while we tailormake your organization's dashboard environment.</p>
              </div>

              {/* Progress Milestones */}
              <div className="w-full max-w-md bg-white/60 border border-slate-200/50 rounded-2xl p-6 space-y-4 shadow-sm">
                {[
                  { id: 0, text: 'Initializing cloud resources' },
                  { id: 1, text: 'Configuring database & schema' },
                  { id: 2, text: 'Generating branch roster tables' },
                  { id: 3, text: 'Bootstrapping admin permissions' }
                ].map((m) => {
                  const isChecked = loadingStep > m.id;
                  const isActive = loadingStep === m.id;
                  return (
                    <div key={m.id} className="flex items-center justify-between text-xs transition-opacity duration-300">
                      <div className="flex items-center gap-3">
                        {isChecked ? (
                          <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center animate-[scale-in_0.25s_cubic-bezier(0.16,1,0.3,1)]">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                        ) : isActive ? (
                          <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center relative">
                            <span className="w-2.5 h-2.5 bg-blue-600 rounded-full animate-ping absolute" />
                            <span className="w-2 h-2 bg-blue-600 rounded-full" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border border-slate-200 bg-white" />
                        )}
                        <span className={`font-bold transition-colors duration-300 ${
                          isChecked ? 'text-slate-500 line-through decoration-slate-300' : isActive ? 'text-slate-800' : 'text-slate-400'
                        }`}>
                          {m.text}
                        </span>
                      </div>
                      
                      {isActive && (
                        <span className="text-[10px] font-black text-blue-600 tracking-wider animate-pulse uppercase">In Progress</span>
                      )}
                      {isChecked && (
                        <span className="text-[10px] font-black text-emerald-600 tracking-wider uppercase">Completed</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Progress bar */}
              <div className="w-full max-w-md bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200/50">
                <div 
                  className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 h-full rounded-full transition-all duration-75 shadow-lg shadow-blue-500/20"
                  style={{ width: `${loadingProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <>
              {/* Animated Wrapper for steps */}
              <div className={`transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                fadeState === 'fade-in' 
                  ? 'opacity-100 translate-y-0 scale-100' 
                  : 'opacity-0 translate-y-3 scale-[0.995]'
              }`}>
            
            {/* STEP 1: Administrator Profile */}
            {step === 1 && (
              <div className="space-y-6">
              <div className="flex items-center gap-3.5 mb-2">
                <span className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                  <Icons.User />
                </span>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-800 tracking-tight leading-none">Let's set up your profile</h2>
                  <p className="text-xs text-slate-400 font-bold mt-1.5">Enter your basic credentials to launch the primary administrator account.</p>
                </div>
              </div>
              
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="flex flex-col gap-2">
                    <label className="input-label">Full Name</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 z-10">
                        <Icons.User />
                      </span>
                      <input 
                        type="text" 
                        placeholder="eg. Ramesh Kumar"
                        value={fullName}
                        onChange={e => setFullName(e.target.value)}
                        className="form-input form-input-with-icon"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="input-label">Business Phone Number</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 z-10">
                        <Icons.Phone />
                      </span>
                      <input 
                        type="text" 
                        placeholder="eg. +91 98765 43210"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        className="form-input form-input-with-icon"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="input-label">Your Corporate Designation</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-1">
                    {[
                      { role: 'Founder / CEO', desc: 'Workspace controller & billing admin', icon: <Icons.Shield /> },
                      { role: 'HR Manager', desc: 'Roster & payroll compliance lead', icon: <Icons.Users /> },
                      { role: 'Operations Manager', desc: 'Roster builder & shifting admin', icon: <Icons.Cog /> },
                      { role: 'IT Administrator', desc: 'Active Directory & system policies', icon: <Icons.Briefcase /> },
                    ].map((item) => (
                      <button
                        key={item.role}
                        type="button"
                        onClick={() => setDesignation(item.role)}
                        className={`p-4 text-left border rounded-[18px] transition-all duration-300 cursor-pointer flex items-start gap-3.5 relative overflow-hidden hover:scale-[1.01] hover:shadow-sm ${
                          designation === item.role 
                            ? 'bg-blue-50/40 border-blue-500 shadow-sm ring-1 ring-blue-500' 
                            : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                        }`}
                      >
                        {designation === item.role && (
                          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-600 rounded-r" />
                        )}
                        <span className="shrink-0 mt-0.5">{item.icon}</span>
                        <div className="flex flex-col">
                          <span className={`text-[11.5px] font-black leading-tight ${designation === item.role ? 'text-blue-700' : 'text-slate-700'}`}>
                            {item.role}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold mt-1.5 leading-tight">{item.desc}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

            {/* STEP 2: Company Setup */}
            {step === 2 && (
              <div className="space-y-6">
              <div className="flex items-center gap-3.5 mb-2">
                <span className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                  <Icons.Building />
                </span>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-800 tracking-tight leading-none">Tell us about your organization</h2>
                  <p className="text-xs text-slate-400 font-bold mt-1.5">Provide legal and corporate metadata to tailor the HR dashboard templates.</p>
                </div>
              </div>

              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="flex flex-col gap-2">
                    <label className="input-label">Company Legal Name</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 z-10">
                        <Icons.Building />
                      </span>
                      <input 
                        type="text" 
                        placeholder="eg. Brihaspathi Technologies"
                        value={companyName}
                        onChange={e => setCompanyName(e.target.value)}
                        className="form-input form-input-with-icon"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="input-label">Company Domain/Website (Optional)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 z-10">
                        <Icons.Globe />
                      </span>
                      <input 
                        type="text" 
                        placeholder="eg. https://brihaspathitech.com"
                        value={website}
                        onChange={e => setWebsite(e.target.value)}
                        className="form-input form-input-with-icon"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="input-label">Industry Sector</label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-1">
                    {[
                      { name: 'Technology', icon: <Icons.Code /> },
                      { name: 'Healthcare', icon: <Icons.Heart /> },
                      { name: 'Financial', icon: <Icons.Currency /> },
                      { name: 'Manufacturing', icon: <Icons.Support /> },
                      { name: 'Other', icon: <Icons.Scale /> },
                    ].map((ind) => (
                      <button
                        key={ind.name}
                        type="button"
                        onClick={() => setIndustry(ind.name)}
                        className={`py-3.5 px-3 border rounded-[18px] text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 hover:scale-[1.01] hover:shadow-sm ${
                          industry === ind.name 
                            ? 'bg-blue-50/40 border-blue-500 text-blue-700 shadow-sm ring-1 ring-blue-500' 
                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-500'
                        }`}
                      >
                        <span className="shrink-0">{ind.icon}</span>
                        <span>{ind.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="input-label">Company Size</label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-1">
                    {['1-10', '11-50', '51-200', '201-500', '500+'].map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setCompanySize(size)}
                        className={`py-4 text-center border rounded-[18px] text-xs font-black transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 hover:scale-[1.01] hover:shadow-sm ${
                          companySize === size 
                            ? 'bg-blue-50/40 border-blue-500 text-blue-700 shadow-sm ring-1 ring-blue-500' 
                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-500'
                        }`}
                      >
                        <span className="text-[9px] text-slate-400 font-bold">Employees</span>
                        <span className="text-[12px] font-extrabold leading-none">{size}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

            {/* STEP 3: Branches Setup */}
            {step === 3 && (
              <div className="space-y-6">
              <div className="flex items-center gap-3.5 mb-2">
                <span className="p-3 bg-violet-50 text-violet-600 rounded-2xl">
                  <Icons.MapPin />
                </span>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-800 tracking-tight leading-none">Configure Office Locations</h2>
                  <p className="text-xs text-slate-400 font-bold mt-1.5">Enter office branch locations to initialize roster limits & geo-fencing rules.</p>
                </div>
              </div>

              <div className="space-y-4">
                
                {/* Branch Input Box */}
                <div className="p-4 bg-white/70 rounded-2xl border border-slate-200/50 flex flex-col gap-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="input-label">Branch name</label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 z-10">
                          <Icons.Building />
                        </span>
                        <input 
                          type="text" 
                          placeholder="eg. Hyderabad HQ"
                          value={branchName}
                          onChange={e => setBranchName(e.target.value)}
                          className="form-input form-input-with-icon py-2.5 text-xs"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="input-label">Country</label>
                      <select
                        value={country}
                        onChange={e => setCountry(e.target.value)}
                        className="form-select py-2 text-xs h-[38px]"
                      >
                        <option>India</option>
                        <option>United States</option>
                        <option>United Kingdom</option>
                        <option>Singapore</option>
                        <option>United Arab Emirates</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="input-label">Street Address</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 z-10">
                        <Icons.MapPin />
                      </span>
                      <input 
                        type="text" 
                        placeholder="eg. Plot 43, Hitec City, Phase 2"
                        value={address}
                        onChange={e => setAddress(e.target.value)}
                        className="form-input form-input-with-icon py-2.5 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="input-label">City</label>
                      <input 
                        type="text" 
                        placeholder="eg. Hyderabad"
                        value={city}
                        onChange={e => setCity(e.target.value)}
                        className="form-input py-2 text-xs"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="input-label">State / Province</label>
                      <input 
                        type="text" 
                        placeholder="eg. Telangana"
                        value={state}
                        onChange={e => setState(e.target.value)}
                        className="form-input py-2 text-xs"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddBranch}
                    className="self-end px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[10.5px] font-black hover:bg-slate-800 transition-all flex items-center gap-1.5 cursor-pointer mt-1"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    <span>Save Location</span>
                  </button>
                </div>

                {/* List of branches */}
                {branches.length > 0 && (
                  <div className="mt-1">
                    <h4 className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 mb-2">Saved Branches ({branches.length})</h4>
                    <div className="flex flex-col gap-2 max-h-[130px] overflow-y-auto pr-1">
                      {branches.map((b, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/20 text-xs hover:border-slate-200 transition-all">
                          <div className="flex items-center gap-2.5">
                            <span className="p-1.5 bg-blue-50 text-blue-500 rounded-lg">
                              <Icons.MapPin />
                            </span>
                            <div className="flex flex-col">
                              <span className="font-extrabold text-slate-700 leading-tight">{b.name}</span>
                              <span className="text-[9.5px] text-slate-400 font-bold mt-0.5">{b.address}, {b.city}, {b.state}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveBranch(idx)}
                            className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

            {/* STEP 4: Review and Build */}
            {step === 4 && (
              <div className="text-center py-2 space-y-5">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-500 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/5 animate-pulse">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>

              <div>
                <h2 className="text-lg font-extrabold text-slate-800 tracking-tight leading-none">Your workplace is ready to build!</h2>
                <p className="text-xs text-slate-400 font-bold mt-1.5">Review the configuration settings summary below before deploying your environment.</p>
              </div>

              {/* Review summary cards grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-left pt-2">
                
                {/* Admin and Company config card */}
                <div className="p-4 border border-slate-200/50 rounded-2xl bg-white/70 flex flex-col gap-3">
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Company Details</span>
                    <h4 className="text-xs font-black text-slate-700 mt-1">{companyName}</h4>
                    <p className="text-[9.5px] text-slate-400 font-bold mt-0.5">{industry} • {companySize} employees</p>
                  </div>
                  <div className="h-[1px] bg-slate-200" />
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Administrator</span>
                    <h4 className="text-xs font-black text-slate-700 mt-1">{fullName}</h4>
                    <p className="text-[9.5px] text-slate-400 font-bold mt-0.5">{designation} • {phone}</p>
                  </div>
                </div>

                {/* Branches card */}
                <div className="p-4 border border-slate-200/50 rounded-2xl bg-white/70 flex flex-col">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-2">Saved Office Branches ({branches.length})</span>
                  <div className="flex flex-col gap-2.5 max-h-[130px] overflow-y-auto pr-1">
                    {branches.map((b, i) => (
                      <div key={i} className="flex gap-2 items-start border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                        <span className="text-blue-500 mt-0.5">
                          <Icons.MapPin />
                        </span>
                        <div className="flex flex-col">
                          <span className="text-xs font-extrabold text-slate-700 leading-none">{b.name}</span>
                          <span className="text-[9.5px] text-slate-400 font-bold mt-0.5 leading-tight">{b.city}, {b.state}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Build button action */}
              <button
                type="button"
                onClick={handleCompleteSetup}
                disabled={loading}
                className="w-full max-w-[240px] mx-auto py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-black rounded-xl shadow-md shadow-emerald-500/10 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              >
                {loading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Deploying Resources...</span>
                  </>
                ) : (
                  <span>Build Workspace</span>
                )}
              </button>
              </div>
            )}
          </div>

          {/* Navigation Controls */}
          {step < 4 && (
            <div className="flex items-center justify-between border-t border-slate-200/60 mt-8 pt-5">
              <button
                type="button"
                onClick={handleBack}
                disabled={step === 1}
                className="px-4 py-2 border border-slate-200 text-slate-500 font-black rounded-lg text-xs hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Back
              </button>
              
              <button
                type="button"
                onClick={handleNext}
                disabled={
                  (step === 1 && !isStep1Valid) ||
                  (step === 2 && !isStep2Valid) ||
                  (step === 3 && !isStep3Valid)
                }
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-lg text-xs shadow-sm hover:shadow active:scale-[0.98] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </div>
          )}

          </>
        )}

        </div>

      </div>

      {/* Styled CSS override classes */}
      <style>{`
        .input-label {
          font-size: 9.5px !important;
          font-weight: 800 !important;
          color: #475569 !important;
          letter-spacing: 0.08em !important;
          text-transform: uppercase !important;
          display: block !important;
        }

        input[type="text"].form-input {
          width: 100% !important;
          background-color: #ffffff !important;
          border: 1px solid #cbd5e1 !important;
          border-radius: 10px !important;
          padding: 10px 14px !important;
          font-size: 12px !important;
          font-weight: 600 !important;
          color: #0f172a !important;
          outline: none !important;
          transition: all 0.2s ease !important;
        }
        input[type="text"].form-input:focus {
          background-color: white !important;
          border-color: #2563eb !important;
          box-shadow: 0 0 0 4px rgba(37,99,235,0.06) !important;
        }

        input[type="text"].form-input-with-icon {
          padding-left: 2.5rem !important;
        }

        .form-select {
          width: 100% !important;
          background-color: #ffffff !important;
          border: 1px solid #cbd5e1 !important;
          border-radius: 10px !important;
          padding: 10px 14px !important;
          font-size: 12px !important;
          font-weight: 600 !important;
          color: #0f172a !important;
          outline: none !important;
          transition: all 0.2s ease !important;
          cursor: pointer !important;
          background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e") !important;
          background-repeat: no-repeat !important;
          background-position: right 12px center !important;
          background-size: 14px !important;
          appearance: none !important;
          padding-right: 32px !important;
        }
        .form-select:focus {
          background-color: white !important;
          border-color: #2563eb !important;
          box-shadow: 0 0 0 4px rgba(37,99,235,0.06) !important;
        }

        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes scale-in {
          0% {
            transform: scale(0.9);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        .animate-scale-in {
          animation: scale-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        @keyframes pulse-ring {
          0% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.45);
          }
          70% {
            transform: scale(1);
            box-shadow: 0 0 0 8px rgba(37, 99, 235, 0);
          }
          100% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(37, 99, 235, 0);
          }
        }
        .active-pulse {
          animation: pulse-ring 2.2s cubic-bezier(0.24, 0, 0.38, 1) infinite;
        }

        @keyframes slide-in-left {
          from {
            opacity: 0;
            transform: translateX(-16px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .animate-slide-in-left {
          opacity: 0;
          animation: slide-in-left 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes border-glow-pulse {
          0%, 100% {
            border-color: rgba(99, 102, 241, 0.35);
            box-shadow: 0 0 30px rgba(99, 102, 241, 0.25), 0 30px 60px rgba(15,23,42,0.04);
          }
          50% {
            border-color: rgba(139, 92, 246, 0.65);
            box-shadow: 0 0 50px rgba(139, 92, 246, 0.5), 0 30px 60px rgba(15,23,42,0.04);
          }
        }
        .loading-card-active {
          animation: border-glow-pulse 2s ease-in-out infinite !important;
        }
      `}</style>
    </div>
  );
}
