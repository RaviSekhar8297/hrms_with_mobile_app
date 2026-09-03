'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export type LayoutType = 'sidebar' | 'bottom-dock';
export type ThemeType = 'slate-dark' | 'nordic-light';
export type FontType = 'Poppins' | 'Inter' | 'Outfit' | 'Space Grotesk' | 'Playfair Display' | 'DM Sans';

interface CompanyItem {
  id: string;
  name: string;
  subdomain?: string;
  status?: string;
}

interface DashboardContextType {
  layout: LayoutType;
  setLayout: (layout: LayoutType) => void;
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  font: FontType;
  setFont: (font: FontType) => void;
  toasts: Toast[];
  showToast: (message: string, type?: 'success' | 'error' | 'info', duration?: number) => void;
  dismissToast: (id: string) => void;
  bodyLoading: boolean;
  setBodyLoading: (loading: boolean) => void;
  companyId: string | null;
  setCompanyId: (id: string | null) => void;
  companies: CompanyItem[];
  setCompanies: (list: CompanyItem[]) => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [layout, setLayoutState] = useState<LayoutType>('sidebar');
  const [theme, setThemeState] = useState<ThemeType>('nordic-light');
  const [font, setFontState] = useState<FontType>('Poppins');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [bodyLoading, setBodyLoading] = useState(false);
  const [companyId, setCompanyIdState] = useState<string | null>(null);
  const [companies, setCompanies] = useState<CompanyItem[]>([]);

  const setCompanyId = (id: string | null) => {
    setCompanyIdState(id);
    if (id) {
      localStorage.setItem('companyId', id);
    } else {
      localStorage.removeItem('companyId');
    }
  };

  // Initialize from LocalStorage & fetch companies if needed
  useEffect(() => {
    const savedCompanyId = localStorage.getItem('companyId');
    if (savedCompanyId) setCompanyIdState(savedCompanyId);

    const savedLayout = localStorage.getItem('pref_layout') as LayoutType;
    if (savedLayout) setLayoutState(savedLayout);

    const savedTheme = localStorage.getItem('pref_theme') as any;
    if (savedTheme) {
      if (savedTheme === 'slate-dark' || savedTheme === 'nordic-light') {
        setThemeState(savedTheme);
      } else {
        setThemeState('nordic-light');
        localStorage.setItem('pref_theme', 'nordic-light');
      }
    } else {
      setThemeState('nordic-light');
      localStorage.setItem('pref_theme', 'nordic-light');
    }

    const savedFont = localStorage.getItem('pref_font') as FontType;
    if (savedFont) {
      setFontState(savedFont);
    } else {
      setFontState('Poppins');
      localStorage.setItem('pref_font', 'Poppins');
    }
  }, []);

  // Sync Layout class
  const setLayout = (newLayout: LayoutType) => {
    setLayoutState(newLayout);
    localStorage.setItem('pref_layout', newLayout);
  };

  // Sync Theme variables and classes
  const setTheme = (newTheme: ThemeType) => {
    setThemeState(newTheme);
    localStorage.setItem('pref_theme', newTheme);
  };

  // Sync Font styles
  const setFont = (newFont: FontType) => {
    setFontState(newFont);
    localStorage.setItem('pref_font', newFont);
  };

  // Apply visual styling dynamically
  useEffect(() => {
    const doc = document.documentElement;

    // Remove old classes
    doc.classList.remove('theme-slate-dark', 'theme-indigo-velvet', 'theme-midnight-emerald', 'theme-nordic-light', 'dark');

    // Font mapping
    let mappedFont = '"Poppins", "Inter", sans-serif';
    if (font === 'Poppins') mappedFont = '"Poppins", "Inter", sans-serif';
    else if (font === 'Inter') mappedFont = '"Inter", "Poppins", sans-serif';
    else if (font === 'Outfit' || font === 'DM Sans') mappedFont = '"Outfit", "Plus Jakarta Sans", sans-serif';
    else if (font === 'Space Grotesk') mappedFont = '"Space Grotesk", sans-serif';
    else if (font === 'Playfair Display') mappedFont = '"Playfair Display", serif';
    
    doc.style.fontFamily = mappedFont;
    document.body.style.fontFamily = mappedFont;

    // Theme values configuration
    if (theme === 'slate-dark') {
      doc.classList.add('dark', 'theme-slate-dark');
      doc.style.setProperty('--background', '#090d16');
      doc.style.setProperty('--foreground', '#f8fafc');
      doc.style.setProperty('--card', '#0f172a');
      document.body.style.backgroundColor = '#090d16';
    } else {
      doc.classList.remove('dark');
      doc.classList.add('theme-nordic-light');
      doc.style.setProperty('--background', '#f4f6f9');
      doc.style.setProperty('--foreground', '#0f172a');
      doc.style.setProperty('--card', '#ffffff');
      document.body.style.backgroundColor = '#f4f6f9';
    }
  }, [theme, font]);

  // Handle path transitions loading indicators
  useEffect(() => {
    setBodyLoading(true);
    const timer = setTimeout(() => {
      setBodyLoading(false);
    }, 450);
    return () => clearTimeout(timer);
  }, [pathname]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success', duration = 3500) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Auto clear
    setTimeout(() => {
      dismissToast(id);
    }, duration);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <DashboardContext.Provider
      value={{
        layout,
        setLayout,
        theme,
        setTheme,
        font,
        setFont,
        toasts,
        showToast,
        dismissToast,
        bodyLoading,
        setBodyLoading,
        companyId,
        setCompanyId,
        companies,
        setCompanies,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}
