'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AttendanceRequestsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/leaves/compoff');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center space-y-2">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-sm text-slate-500 font-medium">Redirecting to Comp-Off Claims...</p>
      </div>
    </div>
  );
}
