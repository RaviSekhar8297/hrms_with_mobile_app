'use client';

import React from 'react';
import Link from 'next/link';

export interface AttendanceSubHeaderProps {
  activeTab: 'logs' | 'atd_history' | 'rules' | 'regularization' | 'permissions' | 'raw' | 'summary' | 'locks';
}

export const ATTENDANCE_NAV_ITEMS = [
  { id: 'logs', label: 'Attendance', href: '/dashboard/attendance', icon: '📅' },
  { id: 'atd_history', label: 'History', href: '/dashboard/atd_history', icon: '📜' },
  { id: 'rules', label: 'Policy', href: '/dashboard/attendance/rules', icon: '⏰' },
  { id: 'locks', label: 'Locks', href: '/dashboard/attendance/locks', icon: '🔒' },
  { id: 'regularization', label: 'Regularization', href: '/dashboard/attendance/regularization', icon: '📝' },
  { id: 'permissions', label: 'Permission', href: '/dashboard/attendance/permissions', icon: '🎫' },
  { id: 'raw', label: 'Attendance Logs', href: '/dashboard/attendance/raw-punches', icon: '🔌' },
  { id: 'summary', label: 'Attendance Summary', href: '/dashboard/attendance_summary', icon: '📊' },
] as const;

export const AttendanceSubHeader: React.FC<AttendanceSubHeaderProps> = ({ activeTab }) => {
  return (
    <div className="flex flex-wrap items-center gap-2 p-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs mb-6">
      {ATTENDANCE_NAV_ITEMS.map((item) => {
        const isActive = activeTab === item.id;
        
        let activeBgClass = 'bg-blue-600 text-white shadow-xs scale-[1.02] border-blue-600';
        let activeDotClass = 'bg-white';

        if (item.id === 'atd_history') {
          activeBgClass = 'bg-teal-600 text-white shadow-xs scale-[1.02] border-teal-600';
        } else if (item.id === 'rules') {
          activeBgClass = 'bg-indigo-600 text-white shadow-xs scale-[1.02] border-indigo-600';
        } else if (item.id === 'locks') {
          activeBgClass = 'bg-rose-600 text-white shadow-xs scale-[1.02] border-rose-600';
        } else if (item.id === 'regularization') {
          activeBgClass = 'bg-emerald-600 text-white shadow-xs scale-[1.02] border-emerald-600';
        } else if (item.id === 'permissions') {
          activeBgClass = 'bg-amber-600 text-white shadow-xs scale-[1.02] border-amber-600';
        } else if (item.id === 'raw') {
          activeBgClass = 'bg-purple-600 text-white shadow-xs scale-[1.02] border-purple-600';
        }

        return (
          <Link
            key={item.id}
            href={item.href}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 flex items-center gap-2.5 whitespace-nowrap cursor-pointer border ${
              isActive
                ? activeBgClass
                : 'bg-slate-50/80 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span className="text-sm">{item.icon}</span>
            <span>{item.label}</span>
            {isActive && <span className={`w-1.5 h-1.5 rounded-full ${activeDotClass} animate-ping`} />}
          </Link>
        );
      })}
    </div>
  );
};

export default AttendanceSubHeader;
