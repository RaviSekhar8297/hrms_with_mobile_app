'use client';

import React, { useState, useRef, useEffect } from 'react';

interface Option {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select option...',
  disabled = false,
  required = false
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div ref={containerRef} className={`relative w-full select-none text-left ${isOpen ? 'z-[100]' : 'z-10'}`}>
      {/* Hidden input for HTML5 standard form validation */}
      <input
        type="text"
        required={required}
        value={value}
        onChange={() => {}}
        tabIndex={-1}
        className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
      />

      {/* Select Trigger element */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between rounded-[11px] border bg-white dark:bg-white/[0.035] border-[#d0d5dd] dark:border-white/[0.1] px-3 py-2.5 text-[12.5px] font-medium text-slate-800 dark:text-slate-100 cursor-pointer outline-none transition-all duration-200 ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        } ${isOpen ? 'border-brand-600 ring-4 ring-brand-600/10' : 'hover:border-[#b9c0cc] dark:hover:border-white/20'}`}
      >
        <span className={selectedOption ? 'text-slate-800 dark:text-slate-100 font-semibold truncate' : 'text-slate-400 dark:text-slate-500 font-normal truncate'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg
          className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform duration-200 shrink-0 ml-1 ${isOpen ? 'rotate-180 text-brand-600 dark:text-brand-400' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </div>

      {/* Dropdown Card panel */}
      {isOpen && (
        <div className="absolute left-0 right-0 z-[100] mt-1.5 rounded-xl border border-[#e4e7ec] dark:border-white/[0.08] bg-card p-2 shadow-[0_16px_40px_-12px_rgba(16,24,40,0.24)] dark:shadow-[0_16px_40px_-12px_rgba(0,0,0,0.65)] animate-fadeIn max-h-60 flex flex-col">
          {/* Filter Search Input box */}
          <div className="relative mb-1.5 flex-shrink-0 flex items-center">
            <input
              type="text"
              autoFocus
              placeholder="Search..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="!pl-9 !pr-8 w-full text-xs"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500 pointer-events-none"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            {searchTerm && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSearchTerm('');
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
                title="Clear search"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Filtered option rows list */}
          <div className="flex-1 overflow-y-auto no-scrollbar max-h-44 space-y-0.5">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(opt => (
                <div
                  key={opt.value}
                  onClick={() => {
                    if (opt.disabled) return;
                    onChange(opt.value);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                  className={`px-3 py-2 rounded-lg text-xs transition-colors ${
                    opt.disabled
                      ? 'opacity-60 cursor-not-allowed text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-white/[0.03] font-medium'
                      : opt.value === value
                      ? 'bg-brand-600 text-white font-semibold cursor-pointer'
                      : 'text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-white/[0.05] cursor-pointer'
                  }`}
                >
                  {opt.label}
                </div>
              ))
            ) : (
              <div className="px-3 py-2 text-center text-xs text-slate-400 dark:text-slate-500 font-normal">
                No matching results
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
