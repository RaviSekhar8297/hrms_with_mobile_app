'use client';

import React from 'react';

export interface ModernPaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
  className?: string;
}

export const ModernPagination: React.FC<ModernPaginationProps> = ({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  startIndex,
  endIndex,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  itemLabel = 'entries',
  className = '',
}) => {
  if (totalItems <= 0) return null;

  const validTotalPages = Math.max(1, totalPages || 1);
  const validCurrentPage = Math.min(Math.max(1, currentPage), validTotalPages);

  // Calculate page number pills (max 5 buttons centered around current page)
  const pages: number[] = [];
  const maxButtons = 5;
  let startPage = Math.max(1, validCurrentPage - 2);
  let endPage = Math.min(validTotalPages, startPage + maxButtons - 1);

  if (endPage - startPage + 1 < maxButtons) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  for (let p = startPage; p <= endPage; p++) {
    pages.push(p);
  }

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 mt-2 border-t border-slate-200/80 dark:border-slate-800 text-xs font-['DM_Sans',sans-serif] ${className}`}
    >
      {/* Left: Rows Per Page Selector & Summary info */}
      <div className="flex flex-wrap items-center gap-3 text-slate-500 dark:text-slate-400 text-xs font-semibold">
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const newSize = Number(e.target.value);
                onPageSizeChange(newSize);
                onPageChange(1);
              }}
              className="bg-slate-100 dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 rounded-xl px-3 py-1.5 font-extrabold text-xs text-slate-700 dark:text-slate-200 outline-none focus:border-[#07518a] transition-all cursor-pointer"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}

        <span className="text-slate-500 dark:text-slate-400 text-xs font-medium ml-1">
          Showing <strong className="text-slate-900 dark:text-slate-100 font-extrabold">{totalItems > 0 ? startIndex + 1 : 0}</strong> to{' '}
          <strong className="text-slate-900 dark:text-slate-100 font-extrabold">{endIndex}</strong> of{' '}
          <strong className="text-slate-900 dark:text-slate-100 font-extrabold">{totalItems}</strong> {itemLabel}
        </span>
      </div>

      {/* Right: Page Pills & Jumpers */}
      <div className="flex items-center gap-1.5">
        {/* First Page Button */}
        <button
          onClick={() => onPageChange(1)}
          disabled={validCurrentPage === 1}
          className="h-8 w-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 font-black hover:bg-[#07518a]/10 hover:text-[#07518a] dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer flex items-center justify-center text-xs shrink-0"
          title="First Page"
        >
          «
        </button>

        {/* Previous Button */}
        <button
          onClick={() => onPageChange(Math.max(validCurrentPage - 1, 1))}
          disabled={validCurrentPage === 1}
          className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold hover:bg-[#07518a]/10 hover:text-[#07518a] dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer text-xs"
        >
          Previous
        </button>

        {/* Page Number Pills */}
        <div className="flex items-center gap-1">
          {pages.map((p) => (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`h-8 min-w-[32px] px-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center ${
                validCurrentPage === p
                  ? 'bg-[#07518a] text-white shadow-md shadow-[#07518a]/25 ring-2 ring-[#07518a]/40'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Next Button */}
        <button
          onClick={() => onPageChange(Math.min(validCurrentPage + 1, validTotalPages))}
          disabled={validCurrentPage >= validTotalPages}
          className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold hover:bg-[#07518a]/10 hover:text-[#07518a] dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer text-xs"
        >
          Next
        </button>

        {/* Last Page Button */}
        <button
          onClick={() => onPageChange(validTotalPages)}
          disabled={validCurrentPage >= validTotalPages}
          className="h-8 w-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 font-black hover:bg-[#07518a]/10 hover:text-[#07518a] dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer flex items-center justify-center text-xs shrink-0"
          title="Last Page"
        >
          »
        </button>
      </div>
    </div>
  );
};

export default ModernPagination;
