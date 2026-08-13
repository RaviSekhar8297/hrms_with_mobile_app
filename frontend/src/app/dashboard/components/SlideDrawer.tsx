'use client';

import React, { useEffect } from 'react';

interface SlideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function SlideDrawer({ isOpen, onClose, title, children }: SlideDrawerProps) {
  // Prevent body scrolling when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop Dim Layer */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-fadeIn"
        onClick={onClose}
      />

      {/* Drawer Panel content */}
      <aside className="relative w-full max-w-[460px] h-full bg-card/95 dark:bg-slate-900/98 backdrop-blur-md border-l border-slate-200/50 dark:border-slate-800/60 shadow-[-10px_0_50px_-10px_rgba(0,0,0,0.15)] dark:shadow-[-10px_0_60px_-10px_rgba(0,0,0,0.6)] z-50 flex flex-col justify-between animate-slideIn">
        {/* Decorative branding left bar */}
        <div className="absolute left-0 top-0 bottom-0 w-[3.5px] bg-gradient-to-b from-blue-500 to-indigo-700" />

        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-200/80 dark:border-slate-800 px-6 flex-shrink-0 bg-white/50 dark:bg-slate-900/50">
          <div className="flex flex-col text-left pl-1">
            <h3 className="text-xs font-extrabold tracking-wider text-slate-800 dark:text-slate-100 uppercase">
              {title}
            </h3>
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">
              Leave & Absences Console
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200 transition-all cursor-pointer hover:scale-105 duration-200 shadow-2xs"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 no-scrollbar bg-white/40 dark:bg-slate-900/40">
          {children}
        </div>
      </aside>
    </div>
  );
}
