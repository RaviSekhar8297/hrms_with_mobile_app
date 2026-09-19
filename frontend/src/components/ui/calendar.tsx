'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface CalendarProps {
  mode?: 'single';
  selected?: Date;
  defaultMonth?: Date;
  captionLayout?: 'dropdown' | 'buttons';
  onSelect?: (date: Date | undefined) => void;
  maxDate?: Date | string;
  minDate?: Date | string;
  className?: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function Calendar({
  selected,
  defaultMonth,
  captionLayout = 'dropdown',
  onSelect,
  maxDate,
  minDate,
  className = '',
}: CalendarProps) {
  const initialDate = selected || defaultMonth || new Date();
  const [currentMonth, setCurrentMonth] = React.useState(initialDate.getMonth());
  const [currentYear, setCurrentYear] = React.useState(initialDate.getFullYear());

  React.useEffect(() => {
    if (selected) {
      setCurrentMonth(selected.getMonth());
      setCurrentYear(selected.getFullYear());
    } else if (defaultMonth) {
      setCurrentMonth(defaultMonth.getMonth());
      setCurrentYear(defaultMonth.getFullYear());
    }
  }, [selected, defaultMonth]);

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const isSelected = (day: number) => {
    if (!selected) return false;
    return (
      selected.getDate() === day &&
      selected.getMonth() === currentMonth &&
      selected.getFullYear() === currentYear
    );
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      today.getDate() === day &&
      today.getMonth() === currentMonth &&
      today.getFullYear() === currentYear
    );
  };

  const isDateDisabled = (day: number) => {
    const dayDate = new Date(currentYear, currentMonth, day);
    if (maxDate) {
      const max = typeof maxDate === 'string' ? new Date(maxDate) : maxDate;
      const maxEnd = new Date(max.getFullYear(), max.getMonth(), max.getDate(), 23, 59, 59, 999);
      if (dayDate.getTime() > maxEnd.getTime()) return true;
    }
    if (minDate) {
      const min = typeof minDate === 'string' ? new Date(minDate) : minDate;
      const minStart = new Date(min.getFullYear(), min.getMonth(), min.getDate(), 0, 0, 0, 0);
      if (dayDate.getTime() < minStart.getTime()) return true;
    }
    return false;
  };

  const currentYearVal = new Date().getFullYear();
  const startYear = currentYearVal - 85;
  const endYear = currentYearVal + 15;
  const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);

  return (
    <div className={`p-4 bg-white dark:bg-slate-900 font-sans select-none w-72 ${className}`}>
      {/* Calendar Header with Controls */}
      <div className="flex items-center justify-between gap-1 pb-3 mb-2 border-b border-slate-100 dark:border-slate-800">
        <button
          type="button"
          onClick={handlePrevMonth}
          className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {captionLayout === 'dropdown' ? (
          <div className="flex items-center gap-1.5">
            <select
              value={currentMonth}
              onChange={(e) => setCurrentMonth(Number(e.target.value))}
              className="px-1.5 py-1 text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-700 outline-none cursor-pointer"
            >
              {MONTHS.map((name, idx) => (
                <option key={name} value={idx}>
                  {name}
                </option>
              ))}
            </select>

            <select
              value={currentYear}
              onChange={(e) => setCurrentYear(Number(e.target.value))}
              className="px-1.5 py-1 text-xs font-bold font-mono bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-700 outline-none cursor-pointer"
            >
              {years.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <span className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">
            {MONTHS[currentMonth]} {currentYear}
          </span>
        )}

        <button
          type="button"
          onClick={handleNextMonth}
          className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Weekday Names Header */}
      <div className="grid grid-cols-7 gap-1 mb-1 text-center">
        {WEEKDAYS.map((wd) => (
          <div key={wd} className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 py-1">
            {wd}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {Array.from({ length: firstDayIndex }).map((_, i) => (
          <div key={`empty-${i}`} className="w-8 h-8" />
        ))}

        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const active = isSelected(day);
          const current = isToday(day);
          const disabled = isDateDisabled(day);

          return (
            <button
              key={day}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (disabled) return;
                const newDate = new Date(currentYear, currentMonth, day);
                onSelect?.(newDate);
              }}
              className={`w-8 h-8 rounded-xl text-xs font-bold transition-all duration-150 flex items-center justify-center ${
                disabled
                  ? 'opacity-25 cursor-not-allowed text-slate-400 dark:text-slate-600'
                  : active
                  ? 'bg-[#07518a] text-white shadow-xs font-black cursor-pointer'
                  : current
                  ? 'bg-[#07518a]/10 dark:bg-[#07518a]/20 text-[#07518a] dark:text-[#38bdf8] font-black border border-[#07518a]/30 cursor-pointer'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer'
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
