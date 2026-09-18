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
      className={`flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 mt-2 border-t border-[#eaecf0] dark:border-white/[0.06] text-xs ${className}`}
    >
      {/* Left: Rows Per Page Selector & Summary info */}
      <div className="flex flex-wrap items-center gap-3 text-slate-500 dark:text-slate-400 text-xs">
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-slate-400 dark:text-slate-500">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const newSize = Number(e.target.value);
                onPageSizeChange(newSize);
                onPageChange(1);
              }}
              className="pagination-select cursor-pointer"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}

        <span className="text-slate-500 dark:text-slate-400 text-xs font-normal ml-1">
          Showing <strong className="text-slate-800 dark:text-slate-100 font-semibold tabular-nums">{totalItems > 0 ? startIndex + 1 : 0}</strong> to{' '}
          <strong className="text-slate-800 dark:text-slate-100 font-semibold tabular-nums">{endIndex}</strong> of{' '}
          <strong className="text-slate-800 dark:text-slate-100 font-semibold tabular-nums">{totalItems}</strong> {itemLabel}
        </span>
      </div>

      {/* Right: Page Pills & Jumpers */}
      <div className="flex items-center gap-1.5">
        {/* First Page Button */}
        <button
          onClick={() => onPageChange(1)}
          disabled={validCurrentPage === 1}
          className="h-8 w-8 rounded-lg border border-[#e4e7ec] dark:border-white/[0.08] bg-transparent text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-white/[0.06] hover:text-brand-600 dark:hover:text-brand-400 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer flex items-center justify-center text-xs shrink-0"
          title="First Page"
        >
          «
        </button>

        {/* Previous Button */}
        <button
          onClick={() => onPageChange(Math.max(validCurrentPage - 1, 1))}
          disabled={validCurrentPage === 1}
          className="px-3 py-1.5 rounded-lg border border-[#e4e7ec] dark:border-white/[0.08] bg-transparent text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-white/[0.06] hover:text-brand-600 dark:hover:text-brand-400 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer text-xs"
        >
          Previous
        </button>

        {/* Page Number Pills */}
        <div className="flex items-center gap-1">
          {pages.map((p) => (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`h-8 min-w-[32px] px-2 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-center tabular-nums ${
                validCurrentPage === p
                  ? 'bg-brand-600 text-white font-semibold shadow-[0_1px_2px_rgba(16,24,40,0.08),0_1px_3px_rgba(16,24,40,0.06)]'
                  : 'bg-transparent text-slate-600 dark:text-slate-300 font-medium border border-[#e4e7ec] dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.06]'
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
          className="px-3 py-1.5 rounded-lg border border-[#e4e7ec] dark:border-white/[0.08] bg-transparent text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-white/[0.06] hover:text-brand-600 dark:hover:text-brand-400 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer text-xs"
        >
          Next
        </button>

        {/* Last Page Button */}
        <button
          onClick={() => onPageChange(validTotalPages)}
          disabled={validCurrentPage >= validTotalPages}
          className="h-8 w-8 rounded-lg border border-[#e4e7ec] dark:border-white/[0.08] bg-transparent text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-white/[0.06] hover:text-brand-600 dark:hover:text-brand-400 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer flex items-center justify-center text-xs shrink-0"
          title="Last Page"
        >
          »
        </button>
      </div>
    </div>
  );
};

export default ModernPagination;
