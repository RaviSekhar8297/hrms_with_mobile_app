'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Field, FieldLabel } from '@/components/ui/field';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { Calendar as CalendarIcon, X } from 'lucide-react';

function parseDateValue(val?: string | Date): Date | undefined {
  if (!val) return undefined;
  if (val instanceof Date) return isNaN(val.getTime()) ? undefined : val;
  if (typeof val === 'string' && val.trim()) {
    const parts = val.trim().split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        return new Date(y, m, d);
      }
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}

function formatDateToIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDisplayDate(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export interface DatePickerSimpleProps {
  value?: string | Date;
  onChange?: (dateString: string, date?: Date) => void;
  label?: React.ReactNode;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  maxDate?: Date | string;
  minDate?: Date | string;
  id?: string;
  disabled?: boolean;
}

export function DatePickerSimple({
  value,
  onChange,
  label,
  placeholder = 'Select date',
  className = 'w-full',
  triggerClassName = '',
  maxDate,
  minDate,
  id,
  disabled = false,
}: DatePickerSimpleProps = {}) {
  const [open, setOpen] = React.useState(false);
  const parsedDate = React.useMemo(() => parseDateValue(value), [value]);
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(parsedDate);

  React.useEffect(() => {
    setSelectedDate(parseDateValue(value));
  }, [value]);

  const handleSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date) {
      onChange?.(formatDateToIso(date), date);
    } else {
      onChange?.('', undefined);
    }
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedDate(undefined);
    onChange?.('', undefined);
  };

  const handleToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    const today = new Date();
    setSelectedDate(today);
    onChange?.(formatDateToIso(today), today);
    setOpen(false);
  };

  return (
    <div className={`relative flex flex-col ${className}`}>
      {label && (
        <label htmlFor={id} className="block font-bold text-slate-700 dark:text-slate-300 text-xs mb-1 select-none">
          {label}
        </label>
      )}
      <Popover open={open && !disabled} onOpenChange={(val) => !disabled && setOpen(val)}>
        <PopoverTrigger
          render={
            <div
              id={id}
              role="button"
              tabIndex={disabled ? -1 : 0}
              className={`stylish-input w-full min-h-[42px] px-3.5 py-2.5 rounded-xl border-2 bg-white dark:bg-slate-900 text-xs font-semibold transition-all duration-200 outline-none shadow-xs flex items-center justify-between text-left cursor-pointer select-none ${
                disabled
                  ? 'opacity-50 cursor-not-allowed border-slate-200 dark:border-slate-800'
                  : open
                  ? 'border-[#07518a] ring-4 ring-[#07518a]/15'
                  : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
              } ${triggerClassName}`}
            >
              <div className="flex items-center gap-2 truncate">
                <CalendarIcon className="w-4 h-4 text-slate-400 shrink-0" />
                <span className={selectedDate ? 'text-slate-900 dark:text-slate-100 font-bold' : 'text-slate-400 font-semibold'}>
                  {selectedDate ? formatDisplayDate(selectedDate) : placeholder}
                </span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {selectedDate && !disabled && (
                  <button
                    type="button"
                    onClick={handleClear}
                    title="Clear date"
                    className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          }
        />
        <PopoverContent className="w-auto overflow-hidden p-0 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            defaultMonth={selectedDate || (maxDate ? parseDateValue(maxDate) : new Date())}
            captionLayout="dropdown"
            onSelect={handleSelect}
            maxDate={maxDate}
            minDate={minDate}
          />
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={handleToday}
              className="text-[11px] font-bold text-[#07518a] hover:text-[#064270] dark:text-[#38bdf8] hover:underline cursor-pointer"
            >
              Today
            </button>
            {selectedDate && (
              <button
                type="button"
                onClick={handleClear}
                className="text-[11px] font-bold text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
              >
                Clear Selection
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export interface TooltipDisabledProps {
  text?: string;
  buttonText?: string;
  className?: string;
}

export function TooltipDisabled({
  text = 'This feature is currently unavailable',
  buttonText = 'Disabled',
  className = '',
}: TooltipDisabledProps = {}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className={`inline-block w-fit ${className}`}>
            <Button variant="outline" disabled>
              {buttonText}
            </Button>
          </span>
        }
      />
      <TooltipContent>
        <p>{text}</p>
      </TooltipContent>
    </Tooltip>
  );
}
