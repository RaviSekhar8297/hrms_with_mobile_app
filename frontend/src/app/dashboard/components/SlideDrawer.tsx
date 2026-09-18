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
        className="fixed inset-0 bg-slate-950/50 backdrop-blur-[2px] transition-opacity duration-300 animate-fadeIn cursor-pointer"
        onClick={onClose}
      />

      {/* Drawer Panel content */}
      <aside className={`relative w-full ${width || 'max-w-[480px]'} h-full bg-card z-[1000000] flex flex-col justify-between animate-slideIn`}>
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-[#eaecf0] dark:border-white/[0.06] px-6 flex-shrink-0">
          <div className="flex flex-col text-left">
            <h3 className="text-[13.5px] font-semibold tracking-[-0.01em] text-slate-800 dark:text-slate-100 font-outfit">
              {title}
            </h3>
            <span className="text-[9.5px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-[0.08em] mt-0.5">
              HRMS Console & Audit Details
            </span>
          </div>

          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 no-scrollbar">
          {children}
        </div>
      </aside>
    </div>,
    document.body
  );
}
