'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PasswordUpdateSuccessPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  const handleProceedToLogin = () => {
    if (typeof window !== 'undefined') {
      const rememberedEmail = localStorage.getItem('remembered_email');
      localStorage.clear();
      sessionStorage.clear();
      if (rememberedEmail) {
        localStorage.setItem('remembered_email', rememberedEmail);
      }
    }
    router.replace('/login?logout=true&clear=true');
  };

  useEffect(() => {
    setMounted(true);
    // Clear any active tokens and session state when password update success page opens
    if (typeof window !== 'undefined') {
      const rememberedEmail = localStorage.getItem('remembered_email');
      localStorage.clear();
      sessionStorage.clear();
      if (rememberedEmail) {
        localStorage.setItem('remembered_email', rememberedEmail);
      }
    }
    // Switch to light theme on mount
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('theme-nordic-light');

    return () => {
      // Revert to dark mode on unmount
      document.documentElement.classList.remove('theme-nordic-light');
      document.documentElement.classList.add('dark');
    };
  }, []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#f8fafc] dm-sans-page select-none p-6">
      
      {/* Centered Success Card Container */}
      <div className="w-full max-w-[420px] bg-white rounded-3xl border border-slate-200/80 p-8 sm:p-10 shadow-xl shadow-slate-100/40 text-center animate-scale-up">
        
        {/* Animated Checkmark Badge */}
        <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-100 shadow-inner animate-pulse-ring">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        
        <h3 className="text-xl font-extrabold text-[#0f2d59] tracking-tight mb-2">Password configured successfully</h3>
        <p className="text-[13.5px] text-slate-500 font-semibold mb-8 max-w-xs mx-auto leading-relaxed">
          Your new permanent credentials have been configured. You can now use your updated password to sign in.
        </p>

        {/* Proceed Button */}
        <button 
          onClick={handleProceedToLogin}
          className="w-full py-3.5 bg-[#0f62fe] hover:bg-[#0b54d4] text-white text-[14.5px] font-bold rounded-xl shadow-lg shadow-blue-500/10 hover:shadow-xl hover:shadow-blue-500/15 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>Proceed to Sign In</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>

      </div>

      {/* Styled Override CSS */}
      <style>{`
        .dm-sans-page {
          font-family: 'DM Sans', sans-serif !important;
        }
        .dm-sans-page * {
          font-family: 'DM Sans', sans-serif !important;
        }
        @keyframes scale-up {
          0% { opacity: 0; transform: scale(0.96) translateY(8px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-scale-up {
          animation: scale-up 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.2); }
          70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        .animate-pulse-ring {
          animation: pulse-ring 2s infinite;
        }
      `}</style>

    </div>
  );
}
