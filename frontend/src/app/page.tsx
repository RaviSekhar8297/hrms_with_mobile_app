'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Animate progress bar
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 4;
      });
    }, 30);

    // Redirect after splash
    const timer = setTimeout(() => {
      const token = localStorage.getItem('access_token');
      if (token) {
        router.push('/dashboard');
      } else {
        router.push('/login');
      }
    }, 900);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [router]);

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        minHeight: '100vh',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #060a18 0%, #0c1128 50%, #070b19 100%)',
        fontFamily: "'Inter', 'DM Sans', system-ui, sans-serif",
      }}
    >
      {/* Animated background orbs */}
      <div
        style={{
          position: 'absolute',
          top: '-15%',
          left: '-10%',
          width: '550px',
          height: '550px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(109,40,217,0.12) 0%, rgba(79,70,229,0.06) 60%, transparent 80%)',
          filter: 'blur(60px)',
          animation: 'pulse 4s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-15%',
          right: '-10%',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, rgba(99,102,241,0.05) 60%, transparent 80%)',
          filter: 'blur(60px)',
          animation: 'pulse 5s ease-in-out infinite 1s',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '40%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '300px',
          height: '300px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(124,58,237,0.05) 0%, transparent 70%)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }}
      />

      {/* Grid pattern overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `linear-gradient(rgba(148,163,184,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.03) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
          pointerEvents: 'none',
        }}
      />

      {/* Main content */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '32px',
          animation: 'fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) forwards',
        }}
      >
        {/* Logo Icon */}
        <div style={{ position: 'relative' }}>
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '22px',
              background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 50%, #2563eb 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 20px 60px -10px rgba(124,58,237,0.5), 0 0 0 1px rgba(124,58,237,0.2)',
              animation: 'logoGlow 2s ease-in-out infinite',
            }}
          >
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          {/* Glow ring */}
          <div
            style={{
              position: 'absolute',
              inset: '-6px',
              borderRadius: '28px',
              border: '1px solid rgba(124,58,237,0.2)',
              animation: 'ringPulse 2s ease-in-out infinite',
            }}
          />
        </div>

        {/* Brand name */}
        <div style={{ textAlign: 'center' }}>
          <h1
            style={{
              fontSize: '28px',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              background: 'linear-gradient(135deg, #ffffff 0%, #c4b5fd 50%, #818cf8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            HRMaster
          </h1>
          <p
            style={{
              marginTop: '6px',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'rgba(148,163,184,0.6)',
            }}
          >
            Enterprise HR Platform
          </p>
        </div>

        {/* Progress bar */}
        <div
          style={{
            width: '200px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <div
            style={{
              width: '100%',
              height: '3px',
              borderRadius: '99px',
              background: 'rgba(148,163,184,0.1)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progress}%`,
                borderRadius: '99px',
                background: 'linear-gradient(90deg, #7c3aed, #4f46e5, #818cf8)',
                transition: 'width 0.08s linear',
                boxShadow: '0 0 8px rgba(124,58,237,0.6)',
              }}
            />
          </div>
          <p
            style={{
              fontSize: '10px',
              fontWeight: 600,
              color: 'rgba(148,163,184,0.45)',
              letterSpacing: '0.05em',
            }}
          >
            Initializing session...
          </p>
        </div>
      </div>

      {/* Version footer */}
      <div
        style={{
          position: 'absolute',
          bottom: '28px',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '9px',
          fontWeight: 600,
          color: 'rgba(148,163,184,0.25)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}
      >
        © 2026 HRMaster · v2.0
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.7; transform: scale(1.05); }
        }
        @keyframes logoGlow {
          0%, 100% { box-shadow: 0 20px 60px -10px rgba(124,58,237,0.5), 0 0 0 1px rgba(124,58,237,0.2); }
          50%       { box-shadow: 0 20px 80px -5px rgba(124,58,237,0.7), 0 0 0 1px rgba(124,58,237,0.35); }
        }
        @keyframes ringPulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50%       { opacity: 0.8; transform: scale(1.04); }
        }
      `}</style>
    </div>
  );
}
