'use client';

import * as React from 'react';

interface TooltipContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const TooltipContext = React.createContext<TooltipContextType | undefined>(undefined);

export interface TooltipProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function Tooltip({ open: controlledOpen, defaultOpen = false, onOpenChange, children }: TooltipProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = React.useCallback(
    (newOpen: boolean) => {
      if (!isControlled) setUncontrolledOpen(newOpen);
      onOpenChange?.(newOpen);
    },
    [isControlled, onOpenChange]
  );

  return (
    <TooltipContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block group">{children}</div>
    </TooltipContext.Provider>
  );
}

export interface TooltipTriggerProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
  render?: React.ReactElement<any>;
}

export function TooltipTrigger({ asChild, render, children, className = '', ...props }: TooltipTriggerProps) {
  const context = React.useContext(TooltipContext);
  if (!context) throw new Error('TooltipTrigger must be used within Tooltip');

  const handleMouseEnter = () => context.setOpen(true);
  const handleMouseLeave = () => context.setOpen(false);

  if (render) {
    return (
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`inline-block ${className}`}
        {...props}
      >
        {render}
      </div>
    );
  }

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`inline-block ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export interface TooltipContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
}

export function TooltipContent({ side = 'top', align = 'center', className = '', children, ...props }: TooltipContentProps) {
  const context = React.useContext(TooltipContext);
  if (!context) throw new Error('TooltipContent must be used within Tooltip');

  if (!context.open) return null;

  let positionClass = '';

  if (side === 'top' || side === 'bottom') {
    const vertical = side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2';
    if (align === 'end') {
      positionClass = `${vertical} right-0`;
    } else if (align === 'start') {
      positionClass = `${vertical} left-0`;
    } else {
      positionClass = `${vertical} left-1/2 -translate-x-1/2`;
    }
  } else {
    const horizontal = side === 'left' ? 'right-full mr-2' : 'left-full ml-2';
    if (align === 'end') {
      positionClass = `${horizontal} bottom-0`;
    } else if (align === 'start') {
      positionClass = `${horizontal} top-0`;
    } else {
      positionClass = `${horizontal} top-1/2 -translate-y-1/2`;
    }
  }

  return (
    <div
      role="tooltip"
      className={`absolute z-[100] whitespace-nowrap rounded-lg bg-slate-900 dark:bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-white dark:text-slate-900 shadow-xl pointer-events-none ${positionClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
