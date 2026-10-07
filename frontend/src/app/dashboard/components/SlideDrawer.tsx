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
  const [rendered, setRendered] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setRendered(true);
      const raf = requestAnimationFrame(() => {
        const timer = setTimeout(() => setAnimating(true), 15);
        return () => clearTimeout(timer);
      });
      return () => cancelAnimationFrame(raf);
    } else {
      setAnimating(false);
      const timer = setTimeout(() => setRendered(false), 350);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

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

  if (!rendered || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[999999] flex justify-end font-sans overflow-hidden">
      {/* Full Viewport Backdrop Dim & Blur Layer with fluid fade */}
      <div
        className={`fixed inset-0 bg-slate-950/65 backdrop-blur-md transition-opacity duration-350 ease-out cursor-pointer ${
          animating ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      {/* Drawer Panel content with ultra-smooth spring slide & shadow elevation */}
      <aside
        className={`relative w-full ${width || 'max-w-[500px]'} h-full bg-white dark:bg-slate-900 border-l border-slate-200/80 dark:border-slate-800 shadow-[0_0_80px_rgba(0,0,0,0.4)] dark:shadow-[0_0_100px_rgba(0,0,0,0.85)] z-[1000000] flex flex-col justify-between transform transition-all duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          animating ? 'translate-x-0 opacity-100 scale-100' : 'translate-x-full opacity-0 scale-[0.98]'
        }`}
      >
        {/* Decorative branding left gradient bar */}
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-[#07518a] via-indigo-600 to-sky-500 shadow-sm" />

        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-200/80 dark:border-slate-800 px-6 flex-shrink-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
          <div className="flex flex-col text-left pl-2">
            <h3 className="text-xs font-black tracking-wider text-slate-800 dark:text-slate-100 uppercase font-outfit">
              {title}
            </h3>
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">
              HRMS Console & Audit Details
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200 transition-all cursor-pointer hover:scale-105 active:scale-95 duration-200 shadow-2xs hover:rotate-90"
            title="Close Drawer"
          >
            <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Form Body with subtle slide-up and fade-in */}
        <div className={`flex-1 overflow-y-auto p-6 space-y-5 no-scrollbar bg-slate-50/40 dark:bg-slate-900/50 transform transition-all duration-350 delay-75 ease-out ${
          animating ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
        }`}>
          {children}
        </div>
      </aside>
    </div>,
    document.body
  );
}
