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
export type FontType = 'Inter' | 'Outfit' | 'Space Grotesk' | 'Playfair Display' | 'DM Sans';

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
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [layout, setLayoutState] = useState<LayoutType>('sidebar');
  const [theme, setThemeState] = useState<ThemeType>('slate-dark');
  const [font, setFontState] = useState<FontType>('DM Sans');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [bodyLoading, setBodyLoading] = useState(false);

  // Initialize from LocalStorage
  useEffect(() => {
    const savedLayout = localStorage.getItem('pref_layout') as LayoutType;
    if (savedLayout) setLayoutState(savedLayout);

    const savedTheme = localStorage.getItem('pref_theme') as any;
    if (savedTheme) {
      if (savedTheme === 'slate-dark' || savedTheme === 'nordic-light') {
        setThemeState(savedTheme);
      } else {
        setThemeState('slate-dark');
        localStorage.setItem('pref_theme', 'slate-dark');
      }
    }

    const savedFont = localStorage.getItem('pref_font') as FontType;
    if (savedFont) setFontState(savedFont);
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
    let mappedFont = 'Inter, sans-serif';
    if (font === 'Outfit') mappedFont = 'Outfit, sans-serif';
    else if (font === 'Space Grotesk') mappedFont = '"Space Grotesk", sans-serif';
    else if (font === 'Playfair Display') mappedFont = '"Playfair Display", serif';
    else if (font === 'DM Sans') mappedFont = '"DM Sans", sans-serif';
    doc.style.fontFamily = mappedFont;

    // Theme values configuration
    if (theme === 'nordic-light') {
      doc.classList.add('theme-nordic-light');
      doc.style.setProperty('--background', '#f8fafc');
      doc.style.setProperty('--foreground', '#0f172a');
      doc.style.setProperty('--card', '#ffffff');
    } else {
      doc.classList.add('dark', 'theme-slate-dark');
      doc.style.setProperty('--background', '#0a0f1d');
      doc.style.setProperty('--foreground', '#f8fafc');
      doc.style.setProperty('--card', '#13192b');
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
