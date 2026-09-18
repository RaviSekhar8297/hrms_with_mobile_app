'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface SlideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
}

export default function SlideDrawer({ isOpen, onClose, title, children, width }: SlideDrawerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[999999] flex justify-end font-sans">
      {/* Full Viewport Backdrop Dim & Blur Layer covering Sidebar, Header & Body */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity duration-300 animate-fadeIn cursor-pointer"
        onClick={onClose}
      />

      {/* Drawer Panel content */}
      <aside className={`relative w-full ${width || 'max-w-[480px]'} h-full bg-white dark:bg-slate-900 border-l border-slate-200/80 dark:border-slate-800 shadow-[0_0_60px_rgba(0,0,0,0.3)] dark:shadow-[0_0_80px_rgba(0,0,0,0.7)] z-[1000000] flex flex-col justify-between animate-slideIn`}>
        {/* Decorative branding left gradient bar */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-600 via-indigo-600 to-violet-600" />

        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-200/80 dark:border-slate-800 px-6 flex-shrink-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md">
          <div className="flex flex-col text-left pl-1">
            <h3 className="text-xs font-black tracking-wider text-slate-800 dark:text-slate-100 uppercase font-outfit">
              {title}
            </h3>
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">
              HRMS Console & Audit Details
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200 transition-all cursor-pointer hover:scale-105 duration-200 shadow-2xs"
          >
            <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 no-scrollbar bg-slate-50/30 dark:bg-slate-900/40">
          {children}
        </div>
      </aside>
    </div>,
    document.body
  );
}
