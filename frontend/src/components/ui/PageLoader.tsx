'use client';

import React from 'react';

interface PageLoaderProps {
  message?: string;
  className?: string;
  compact?: boolean;
  color?: string;
  size?: number;
}

export default function PageLoader({
  message = 'Loading Data...',
  className = '',
  compact = false,
  color = '#07518a',
  size,
}: PageLoaderProps) {
  const finalSize = size || (compact ? 24 : 32);

  return (
    <div
      className={`w-full flex flex-col items-center justify-center text-center ${
        compact ? 'py-4 px-3' : 'py-8 px-6'
      } ${className}`}
    >
      <div className="flex flex-col items-center justify-center space-y-2.5 max-w-xs mx-auto">
        {/* === PREVIOUS SPINNER (Commented out for easy revert) === */}
        {/*
        <div className="w-7 h-7 border-[2.5px] border-[#07518a] border-t-transparent rounded-full animate-spin" />
        */}

        {/* === INSTANT HARDWARE-ACCELERATED CIRCLES LOADER === */}
        <div className="flex items-center justify-center">
          <svg
            width={finalSize}
            height={finalSize}
            viewBox="0 0 135 135"
            xmlns="http://www.w3.org/2000/svg"
            fill={color}
            aria-label="circles-loading"
            className="overflow-visible"
          >
            <style>{`
              @keyframes circleSpinCW {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
              .circle-outer {
                transform-origin: 67.5px 67.5px;
                animation: circleSpinCW 3s linear infinite;
                will-change: transform;
              }
            `}</style>
            <path
              className="circle-outer"
              d="M28.19 40.31c6.627 0 12-5.374 12-12 0-6.628-5.373-12-12-12-6.628 0-12 5.372-12 12 0 6.626 5.372 12 12 12zm30.72-19.825c4.686 4.687 12.284 4.687 16.97 0 4.686-4.686 4.686-12.284 0-16.97-4.686-4.687-12.284-4.687-16.97 0-4.687 4.686-4.687 12.284 0 16.97zm35.74 7.705c0 6.627 5.37 12 12 12 6.626 0 12-5.373 12-12 0-6.628-5.374-12-12-12-6.63 0-12 5.372-12 12zm19.822 30.72c-4.686 4.686-4.686 12.284 0 16.97 4.687 4.686 12.285 4.686 16.97 0 4.687-4.686 4.687-12.284 0-16.97-4.685-4.687-12.283-4.687-16.97 0zm-7.704 35.74c-6.627 0-12 5.37-12 12 0 6.626 5.373 12 12 12s12-5.374 12-12c0-6.63-5.373-12-12-12zm-30.72 19.822c-4.686-4.686-12.284-4.686-16.97 0-4.686 4.688-4.686 12.285 0 16.97 4.686 4.687 12.284 4.687 16.97 0 4.687-4.685 4.687-12.282 0-16.97zm-35.74-7.704c0-6.627-5.372-12-12-12-6.626 0-12 5.373-12 12s5.374 12 12 12c6.628 0 12-5.373 12-12zm-19.823-30.72c4.687-4.686 4.687-12.284 0-16.97-4.686-4.686-12.284-4.686-16.97 0-4.687 4.686-4.687 12.284 0 16.97 4.686 4.687 12.284 4.687 16.97 0z"
            />
          </svg>
        </div>

        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest font-dmsans select-none">
          {message}
        </p>
      </div>
    </div>
  );
}
