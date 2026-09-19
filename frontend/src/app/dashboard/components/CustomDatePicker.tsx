'use client';

import React, { useState, useRef, useEffect } from 'react';

interface CustomDatePickerProps {
  value: string; // Format: "YYYY-MM-DD"
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  maxDate?: string;
}

const monthsList = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function CustomDatePicker({
  value,
  onChange,
  placeholder = 'Select date...',
  disabled = false,
  required = false,
  maxDate
}: CustomDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState<Date>(new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse YYYY-MM-DD in local timezone to avoid off-by-one errors
  const parseLocalDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }
    return new Date();
  };

  const formatLocalDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Sync view month with selected value on load or change
  useEffect(() => {
    if (value) {
      setViewMonth(parseLocalDate(value));
    }
  }, [value]);

  // Click outside listener to close popup
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePrevMonth = () => {
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1));
  };

  const handleDaySelect = (d: Date) => {
    onChange(formatLocalDate(d));
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setIsOpen(false);
  };

  const handleToday = () => {
    onChange(formatLocalDate(new Date()));
    setIsOpen(false);
  };

  // Build grid day cells
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const startDayOfWeek = firstDayOfMonth.getDay();
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const totalDaysInPrevMonth = new Date(year, month, 0).getDate();

  const cells: { date: Date; isCurrentMonth: boolean; key: string }[] = [];

  // Prev month padding
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const d = totalDaysInPrevMonth - i;
    cells.push({
      date: new Date(year, month - 1, d),
      isCurrentMonth: false,
      key: `prev-${d}`
    });
  }

  // Current month days
  for (let d = 1; d <= totalDaysInMonth; d++) {
    cells.push({
      date: new Date(year, month, d),
      isCurrentMonth: true,
      key: `curr-${d}`
    });
  }

  // Next month padding up to 42 cells (6 rows * 7 columns)
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    cells.push({
      date: new Date(year, month + 1, d),
      isCurrentMonth: false,
      key: `next-${d}`
    });
  }

  // Years options range: current year +/- 15 years
  const currentYear = new Date().getFullYear();
  const yearsRange: number[] = [];
  for (let y = currentYear - 15; y <= currentYear + 15; y++) {
    yearsRange.push(y);
  }

  // Format display text for input trigger
  const displayFormattedDate = (dateStr: string) => {
    if (!dateStr) return '';
    const dateObj = parseLocalDate(dateStr);
    return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const isSelected = (d: Date) => {
    if (!value) return false;
    const selectedDate = parseLocalDate(value);
    return (
      d.getDate() === selectedDate.getDate() &&
      d.getMonth() === selectedDate.getMonth() &&
      d.getFullYear() === selectedDate.getFullYear()
    );
  };

  const isToday = (d: Date) => {
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  const isDateDisabled = (d: Date) => {
    if (!maxDate) return false;
    const maxDateObj = parseLocalDate(maxDate);
    const dCopy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const maxCopy = new Date(maxDateObj.getFullYear(), maxDateObj.getMonth(), maxDateObj.getDate());
    return dCopy.getTime() > maxCopy.getTime();
  };

  return (
    <div ref={containerRef} className="relative w-full text-left">
      {/* Hidden input for native HTML5 form compatibility */}
      <input
        type="text"
        required={required}
        value={value}
        onChange={() => {}}
        tabIndex={-1}
        className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
      />

      {/* Input Trigger */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40 px-3.5 py-2.5 text-xs cursor-pointer outline-none transition-all duration-200 ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        } ${isOpen ? 'border-blue-500 ring-4 ring-blue-500/10 bg-card' : ''}`}
      >
        <div className="flex items-center gap-2">
          {/* Calendar Left Icon */}
          <svg className="w-4 h-4 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
          <span className={value ? 'text-slate-800 dark:text-slate-200 font-semibold' : 'text-slate-400 dark:text-slate-550'}>
            {value ? displayFormattedDate(value) : placeholder}
          </span>
        </div>
        {value && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-0.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Calendar Dropdown */}
      {isOpen && (
        <div className="absolute left-0 z-50 mt-2 w-[280px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-card p-4 shadow-xl dark:shadow-slate-950/75 animate-fadeIn">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>

            <div className="flex gap-1 items-center">
              <select
                value={month}
                onChange={(e) => setViewMonth(new Date(year, parseInt(e.target.value), 1))}
                className="bg-transparent font-black text-xs text-slate-800 dark:text-slate-200 outline-none cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 px-1.5 py-1 rounded-lg"
              >
                {monthsList.map((m, idx) => (
                  <option key={m} value={idx} className="bg-card text-slate-800 dark:text-slate-200">
                    {m}
                  </option>
                ))}
              </select>

              <select
                value={year}
                onChange={(e) => setViewMonth(new Date(parseInt(e.target.value), month, 1))}
                className="bg-transparent font-black text-xs text-slate-800 dark:text-slate-200 outline-none cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 px-1.5 py-1 rounded-lg"
              >
                {yearsRange.map((y) => (
                  <option key={y} value={y} className="bg-card text-slate-800 dark:text-slate-200">
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
              <span key={day} className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                {day}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {cells.map((cell) => {
              const selected = isSelected(cell.date);
              const today = isToday(cell.date);
              const isDisabled = isDateDisabled(cell.date);

              return (
                <button
                  key={cell.key}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => !isDisabled && handleDaySelect(cell.date)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs transition-all font-sans mx-auto ${
                    isDisabled
                      ? 'opacity-20 cursor-not-allowed text-slate-300 dark:text-slate-700'
                      : cell.isCurrentMonth
                      ? 'font-bold text-slate-800 dark:text-slate-200 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80'
                      : 'text-slate-300 dark:text-slate-650 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80'
                  } ${
                    selected && !isDisabled
                      ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700'
                      : today && !isDisabled
                      ? 'border border-blue-500 text-blue-600 dark:text-blue-400 font-extrabold'
                      : ''
                  }`}
                >
                  {cell.date.getDate()}
                </button>
              );
            })}
          </div>

          {/* Bottom Actions */}
          <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 mt-3 pt-2.5">
            <button
              type="button"
              onClick={handleClear}
              className="text-[10.5px] font-black uppercase tracking-wider text-red-500 hover:text-red-600 cursor-pointer"
            >
              Clear
            </button>
            <button
              type="button"
              disabled={!!(maxDate && isDateDisabled(new Date()))}
              onClick={handleToday}
              className={`text-[10.5px] font-black uppercase tracking-wider ${
                !!(maxDate && isDateDisabled(new Date()))
                  ? 'opacity-30 cursor-not-allowed text-slate-400'
                  : 'text-blue-650 hover:text-blue-750 cursor-pointer'
              }`}
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
