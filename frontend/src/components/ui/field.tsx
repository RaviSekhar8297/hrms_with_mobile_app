'use client';

import * as React from 'react';

export interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Field({ className = '', children, ...props }: FieldProps) {
  return (
    <div className={`flex flex-col space-y-1.5 ${className}`} {...props}>
      {children}
    </div>
  );
}

export interface FieldLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

export function FieldLabel({ className = '', children, ...props }: FieldLabelProps) {
  return (
    <label
      className={`text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 select-none ${className}`}
      {...props}
    >
      {children}
    </label>
  );
}
