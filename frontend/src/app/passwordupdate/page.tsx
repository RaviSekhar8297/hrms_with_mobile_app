'use client';

import React, { Suspense, useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

import { API_BASE } from '../dashboard/utils/api';

interface WelcomeProfile {
  found: boolean;
  name: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  designation: string;
  department?: string;
  branch?: string;
  joiningDate: string;
  companyName: string;
  companyLogo?: string | null;
  empImage?: string | null;
  stats?: {
    years: number;
    branches: number;
    teamMembers: number;
  };
}

function PasswordUpdateForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const emailParam = searchParams.get('username') || '';
  const tempParam = searchParams.get('temp') || '';

  // Stage 1: 'WELCOME', Stage 2: 'PASSWORD_RESET'
  const [stage, setStage] = useState<'WELCOME' | 'PASSWORD_RESET'>('WELCOME');

  const [username, setUsername] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStrength, setPasswordStrength] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Profile Data
  const [profile, setProfile] = useState<WelcomeProfile | null>(null);

  // Typing Effect
  const [typedMessage, setTypedMessage] = useState('');

  // Canvas Refs
  const particlesCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const tiltCardRef = useRef<HTMLDivElement | null>(null);

  // Fetch Welcome Profile data
  useEffect(() => {
    setMounted(true);
    // Ensure active token is cleared so user cannot bypass password reset to dashboard
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('email');
      localStorage.removeItem('roles');
      localStorage.removeItem('permissions');
      localStorage.removeItem('companyId');
    }

    if (emailParam) setUsername(emailParam);
    if (tempParam) setOldPassword(tempParam);

    const activeUser = emailParam || 'employee';

    fetch(`${API_BASE}/api/v1/auth/welcome-profile?username=${encodeURIComponent(activeUser)}`)
      .then(res => res.json())
      .then(data => setProfile(data))
      .catch(err => {
        console.error('Error fetching welcome profile:', err);
        setProfile({
          found: false,
          name: activeUser.split('@')[0] || 'Team Member',
          designation: 'Software Engineer',
          joiningDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          companyName: 'HRMaster Cloud',
          stats: { years: 10, branches: 6, teamMembers: 2500 }
        });
      });
  }, [emailParam, tempParam]);

  // Typing Text Effect
  useEffect(() => {
    if (!mounted || stage !== 'WELCOME') return;
    const msg = profile
      ? `We're thrilled to have you on board! Your journey of innovation with the ${profile.companyName} family starts today. 🎊`
      : "We're thrilled to have you on board! Your journey of innovation starts today. 🎊";

    let i = 0;
    setTypedMessage('');
    const timer = setInterval(() => {
      if (i <= msg.length) {
        setTypedMessage(msg.slice(0, i));
        i++;
      } else {
        clearInterval(timer);
      }
    }, 38);

    return () => clearInterval(timer);
  }, [mounted, stage, profile]);

  // Handle browser back button navigation: Stage 2 -> Stage 1 -> Login Page
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.history.pushState({ page: 'passwordupdate' }, '');
    }
    const handlePopState = () => {
      if (stage === 'PASSWORD_RESET') {
        setStage('WELCOME');
      } else {
        router.replace('/login');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [stage, router]);

  // High-Definition Twinkling Star & Glowing Particle Background Canvas Effect
  useEffect(() => {
    if (!mounted || stage !== 'WELCOME') return;
    const canvas = particlesCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // 140 Crisp Glowing Pure White Particles & Stars
    const particles: {
      x: number;
      y: number;
      r: number;
      s: number;
      o: number;
      maxO: number;
      minO: number;
      pulseSpeed: number;
      pulseDir: number;
      swayOffset: number;
      isStar: boolean;
      color: string;
    }[] = [];

    const starColors = ['#ffffff', '#ffffff', '#eef2ff', '#e0e7ff', '#c7d2fe', '#fde68a'];

    for (let i = 0; i < 140; i++) {
      const isStar = Math.random() > 0.7;
      const baseAlpha = Math.random() * 0.45 + 0.45;
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: isStar ? Math.random() * 2.2 + 1.2 : Math.random() * 2.5 + 0.9,
        s: Math.random() * 0.45 + 0.15,
        o: baseAlpha,
        maxO: Math.min(1, baseAlpha + 0.35),
        minO: Math.max(0.2, baseAlpha - 0.35),
        pulseSpeed: Math.random() * 0.015 + 0.006,
        pulseDir: Math.random() > 0.5 ? 1 : -1,
        swayOffset: Math.random() * Math.PI * 2,
        isStar,
        color: starColors[(Math.random() * starColors.length) | 0],
      });
    }

    const drawStarShape = (cx: number, cy: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 2.2);
      ctx.lineTo(cx + r * 0.5, cy - r * 0.5);
      ctx.lineTo(cx + r * 2.2, cy);
      ctx.lineTo(cx + r * 0.5, cy + r * 0.5);
      ctx.lineTo(cx, cy + r * 2.2);
      ctx.lineTo(cx - r * 0.5, cy + r * 0.5);
      ctx.lineTo(cx - r * 2.2, cy);
      ctx.lineTo(cx - r * 0.5, cy - r * 0.5);
      ctx.closePath();
      ctx.fill();
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        // Upward movement & gentle sway
        p.y -= p.s;
        p.x += Math.sin(p.swayOffset + p.y * 0.012) * 0.35;

        // Twinkle opacity pulse
        p.o += p.pulseSpeed * p.pulseDir;
        if (p.o >= p.maxO) {
          p.o = p.maxO;
          p.pulseDir = -1;
        } else if (p.o <= p.minO) {
          p.o = p.minO;
          p.pulseDir = 1;
        }

        // Loop around screen boundary
        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;

        ctx.save();
        ctx.globalAlpha = p.o;
        ctx.fillStyle = p.color;

        // Glowing outer shadow for crisp bright stars
        ctx.shadowBlur = p.r > 1.8 ? 14 : 7;
        ctx.shadowColor = p.color;

        if (p.isStar) {
          drawStarShape(p.x, p.y, p.r);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };
    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [mounted, stage]);

  // Confetti Burst Trigger
  const triggerConfetti = (durationMs = 5000) => {
    const canvas = confettiCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const colors = ['#6366f1', '#8b5cf6', '#d946ef', '#f59e0b', '#10b981', '#38bdf8'];
    let pieces: { x: number; y: number; w: number; h: number; c: string; vy: number; vx: number; r: number; vr: number }[] = [];

    for (let i = 0; i < 160; i++) {
      pieces.push({
        x: Math.random() * width,
        y: -20 - Math.random() * height * 0.5,
        w: 6 + Math.random() * 8,
        h: 4 + Math.random() * 6,
        c: colors[(Math.random() * colors.length) | 0],
        vy: 2 + Math.random() * 3,
        vx: -1 + Math.random() * 2,
        r: Math.random() * 360,
        vr: -3 + Math.random() * 6,
      });
    }

    const spawnUntil = Date.now() + durationMs;
    let animId: number;

    const tick = () => {
      ctx.clearRect(0, 0, width, height);
      const isAlive = Date.now() < spawnUntil;
      pieces = pieces.filter(p => p.y < height + 30);
      for (const p of pieces) {
        p.y += p.vy;
        p.x += p.vx + Math.sin(p.y * 0.01);
        p.r += p.vr;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.r * Math.PI) / 180);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      if (isAlive || pieces.length > 0) {
        animId = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, width, height);
      }
    };
    tick();
  };

  // Confetti trigger every 5 seconds on Welcome page
  useEffect(() => {
    if (mounted && stage === 'WELCOME') {
      // Immediate burst on page load
      const initialTimer = setTimeout(() => triggerConfetti(3500), 300);
      
      // Recurring confetti burst every 10 seconds
      const interval = setInterval(() => {
        triggerConfetti(4500);
      }, 10000);

      return () => {
        clearTimeout(initialTimer);
        clearInterval(interval);
      };
    }
  }, [mounted, stage]);

  // 3D Tilt Card Effect
  const handleMouseMoveCard = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = tiltCardRef.current;
    if (!card) return;
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    card.style.transform = `rotateY(${x * 14}deg) rotateX(${-y * 14}deg)`;
    card.style.setProperty('--gx', `${x * 100 + 50}%`);
    card.style.setProperty('--gy', `${y * 100 + 50}%`);
  };

  const handleMouseLeaveCard = () => {
    const card = tiltCardRef.current;
    if (card) card.style.transform = 'rotateY(0deg) rotateX(0deg)';
  };

  // Password Strength Check
  const handlePasswordChange = (val: string) => {
    setNewPassword(val);
    let score = 0;
    if (val.length >= 8) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;
    setPasswordStrength(score);
  };

  const getStrengthTextAndColor = () => {
    if (newPassword.length === 0) return { text: 'Empty', color: 'text-slate-400', progressColor: 'bg-slate-200', percent: '0%' };
    if (passwordStrength <= 1) return { text: 'Weak password', color: 'text-rose-500', progressColor: 'bg-rose-500', percent: '25%' };
    if (passwordStrength === 2) return { text: 'Fair security', color: 'text-amber-500', progressColor: 'bg-amber-500', percent: '50%' };
    if (passwordStrength === 3) return { text: 'Good security', color: 'text-indigo-400', progressColor: 'bg-indigo-400', percent: '75%' };
    return { text: 'Strong security', color: 'text-emerald-500', progressColor: 'bg-emerald-500', percent: '100%' };
  };

  const handleSubmitPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      setError('Please fill in both new password fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    setLoading(true);
    setError('');

    const effectiveOldPassword = oldPassword || tempParam || '123456';
    const apiUrl = `${API_BASE}/api/v1/auth/reset-temporary-password`;

    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          temporaryPassword: effectiveOldPassword,
          newPassword
        })
      });
      const data = await res.json();
      if (res.ok) {
        triggerConfetti(6000);
        router.push('/passwordupdate/success');
      } else {
        setError(data.error || 'Failed to update password. Please try again.');
      }
    } catch {
      setError('Server connection failure. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  const displayName = profile?.name || username.split('@')[0] || 'Team Member';
  const designation = profile?.designation || 'Software Engineer';
  const companyName = profile?.companyName || 'HRMaster Cloud';
  const companyLogo = profile?.companyLogo;
  const empImage = profile?.empImage;
  const joiningDate = profile?.joiningDate || 'Joining Day';

  const userInitials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'EM';

  const strengthInfo = getStrengthTextAndColor();

  return (
    <div className="welcome-root-scope min-h-screen w-full font-sans text-white overflow-x-hidden flex flex-col justify-between relative bg-[#0f0c29]">
      
      {/* Background Glow Orbs */}
      <div className="orb orb1" />
      <div className="orb orb2" />
      <div className="orb orb3" />

      <canvas ref={particlesCanvasRef} id="particles" />
      <canvas ref={confettiCanvasRef} id="confetti" />

      {/* 🌟 TOP BAR (FIXED) */}
      <header className="topbar">
        <div className="brand">
          {companyLogo ? (
            <img src={companyLogo} alt={companyName} />
          ) : (
            <div className="company-logo-fallback">
              {companyName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1>{companyName}</h1>
            <p>Innovate • Transform • Grow</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (stage === 'PASSWORD_RESET') {
                setStage('WELCOME');
              } else {
                router.replace('/login');
              }
            }}
            className="top-chip hover:bg-white/20 transition-all cursor-pointer flex items-center gap-1.5 font-semibold text-xs"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Back to Login
          </button>
          <span className="top-chip flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
            {joiningDate}
          </span>
        </div>
      </header>

      {/* 🌟 MAIN STAGE CONTAINER */}
      {stage === 'WELCOME' ? (
        <main className="wrap animate-fade-up">
          
          {/* LEFT: Employee Floating Photo Card */}
          <section className="scene">
            <div className="floater">
              <div
                className="photo-card"
                id="tiltCard"
                ref={tiltCardRef}
                onMouseMove={handleMouseMoveCard}
                onMouseLeave={handleMouseLeaveCard}
              >
                {empImage ? (
                  <img src={empImage} alt={displayName} />
                ) : (
                  <div className="avatar-fallback">
                    <span>{userInitials}</span>
                  </div>
                )}
                <span className="chip chip1">
                  <svg className="inline w-3.5 h-3.5 -mt-0.5 mr-1 text-indigo-300" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                  </svg>
                  New Joiner
                </span>
                <span className="spark s1">✦</span>
                <span className="spark s2">✦</span>
                <span className="spark s3">✦</span>
                <div className="overlay">
                  <h2>{displayName}</h2>
                  <p>{designation}</p>
                </div>
              </div>
            </div>
          </section>

          {/* RIGHT: Onboarding Details & CTA */}
          <section className="right" id="rightCol">
            <div className="script">Welcome Aboard!</div>
            <h1 className="greet">
              Hello, {displayName} <span className="wave">👋</span>
            </h1>

            <p className="typing-wrap">
              <span>{typedMessage}</span>
              <span className="cursor" />
            </p>

            <div className="sec about" style={{ '--d': '1.2s' } as React.CSSProperties}>
              <h3>About {companyName}</h3>
              <p>
                <b>{companyName}</b> is a global IT & enterprise services leader crafting digital transformation and cloud workforce solutions. Today, you become part of a family that celebrates innovation, collaboration, and growth — welcome to your new beginning! 🌟
              </p>
            </div>

            <div className="sec" style={{ '--d': '1.5s' } as React.CSSProperties}>
              <h3>{companyName} at a glance</h3>
              <div className="stats">
                <div className="stat">
                  <span className="num">{profile?.stats?.years || 10}+</span>
                  <small>Years of Excellence</small>
                </div>
                <div className="stat">
                  <span className="num">{profile?.stats?.branches || 6}</span>
                  <small>Branches Active</small>
                </div>
                <div className="stat">
                  <span className="num">{profile?.stats?.teamMembers || 2500}+</span>
                  <small>Team Members</small>
                </div>
              </div>
            </div>

            <div className="sec" style={{ '--d': '1.8s' } as React.CSSProperties}>
              <h3>Our Core Hubs</h3>
              <div className="branches-grid">
                <div className="branch" style={{ '--d': '2.0s' } as React.CSSProperties}>
                  <span className="b-icon">
                    <svg className="w-4.5 h-4.5 text-indigo-200" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                    </svg>
                  </span>
                  <div>
                    <b>Hyderabad</b>
                    <small>Head Office</small>
                  </div>
                </div>
                <div className="branch" style={{ '--d': '2.15s' } as React.CSSProperties}>
                  <span className="b-icon">
                    <svg className="w-4.5 h-4.5 text-indigo-200" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m6.75 7.5 3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                  </span>
                  <div>
                    <b>Bengaluru</b>
                    <small>R&D Center</small>
                  </div>
                </div>
                <div className="branch" style={{ '--d': '2.3s' } as React.CSSProperties}>
                  <span className="b-icon">
                    <svg className="w-4.5 h-4.5 text-indigo-200" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
                    </svg>
                  </span>
                  <div>
                    <b>Mumbai</b>
                    <small>Finance Hub</small>
                  </div>
                </div>
              </div>
            </div>

            <div className="cta-row">
              <button
                className="btn btn-p"
                onClick={() => {
                  triggerConfetti(3500);
                  if (typeof window !== 'undefined') {
                    window.history.pushState({ stage: 'PASSWORD_RESET' }, '');
                  }
                  setStage('PASSWORD_RESET');
                }}
              >
                Let&apos;s Get Started
                <svg className="inline w-4 h-4 ml-2 -mt-0.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </button>
            </div>
          </section>

        </main>
      ) : (
        /* 🌟 STAGE 2: CHANGE PASSWORD FORM (HIGH CONTRAST GLASS CARD) */
        <main className="wrap-form animate-fade-up max-w-lg mx-auto my-auto relative z-20 w-full px-4 py-8">
          <div className="bg-[#12102e]/85 backdrop-blur-2xl border border-white/10 rounded-2xl p-7 sm:p-9 text-white shadow-[0_24px_64px_-16px_rgba(0,0,0,0.75)] relative overflow-hidden text-left">
            
            {/* Header Badge */}
            <div className="flex items-center justify-between pb-6 mb-6 border-b border-white/[0.08]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center shadow-[0_8px_20px_-6px_rgba(79,70,229,0.6)]">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white tracking-[-0.01em] font-outfit">
                    Update Account Password
                  </h2>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">
                    First Time Security Configuration for <strong className="text-indigo-300">{displayName}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStage('WELCOME')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                </svg>
                Back
              </button>
            </div>

            {error && (
              <div className="p-3.5 mb-5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-200 text-xs font-medium flex items-start gap-2.5">
                <svg className="w-4 h-4 mt-px shrink-0 text-rose-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008ZM12 3l9 16.5H3L12 3Z" />
                </svg>
                <span className="pt-0.5 leading-relaxed">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmitPasswordReset} className="space-y-5">
              
              {/* Username Badge Display (Readonly) */}
              <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-between">
                <span className="text-[10.5px] font-semibold uppercase text-slate-400 tracking-[0.08em]">Account Email</span>
                <span className="text-xs font-mono font-medium text-indigo-300">{username}</span>
              </div>

              {/* New Password Input */}
              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase text-slate-300 tracking-[0.08em] block font-outfit">
                  New Permanent Password <span className="text-rose-400">*</span>
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    placeholder="Minimum 8 characters..."
                    value={newPassword}
                    onChange={e => handlePasswordChange(e.target.value)}
                    style={{ color: '#ffffff', backgroundColor: '#0f172a' }}
                    className="w-full tracking-[0.2em] placeholder:text-sm placeholder:font-sans placeholder:tracking-normal"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3.5 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
                  >
                    {showNewPassword ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Password Strength Meter */}
                <div className="mt-1 px-1">
                  <div className="flex justify-between items-center text-[10.5px] font-semibold mb-1.5">
                    <span className="text-slate-400">Password Strength:</span>
                    <span className={strengthInfo.color}>{strengthInfo.text}</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className={`h-full ${strengthInfo.progressColor} transition-all duration-300`}
                      style={{ width: strengthInfo.percent }}
                    />
                  </div>
                </div>
              </div>

              {/* Confirm Password Input */}
              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase text-slate-300 tracking-[0.08em] block font-outfit">
                  Confirm New Password <span className="text-rose-400">*</span>
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    placeholder="Re-enter new password..."
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    style={{ color: '#ffffff', backgroundColor: '#0f172a' }}
                    className="w-full tracking-[0.2em] placeholder:text-sm placeholder:font-sans placeholder:tracking-normal"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
                  >
                    {showConfirmPassword ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                {(() => {
                  const isFormValid = newPassword.length >= 8 && confirmPassword.length >= 8 && newPassword === confirmPassword;
                  return (
                    <button
                      type="submit"
                      disabled={!isFormValid || loading}
                      className={`w-full py-3.5 px-6 rounded-[11px] font-semibold text-[13.5px] transition-all flex items-center justify-center gap-2 ${
                        isFormValid && !loading
                          ? 'bg-brand-600 hover:bg-brand-700 text-white cursor-pointer shadow-[0_10px_28px_-8px_rgba(79,70,229,0.65)] active:scale-[0.99]'
                          : 'bg-white/[0.06] text-slate-500 border border-white/10 cursor-not-allowed'
                      }`}
                    >
                      {loading ? (
                        <>
                          <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        </>
                      ) : (
                        <span className="flex items-center gap-2">
                          Set Password & Proceed
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                          </svg>
                        </span>
                      )}
                    </button>
                  );
                })()}
              </div>
            </form>

          </div>
        </main>
      )}

      {/* 🌟 MARQUEE FOOTER (FIXED BOTTOM) */}
      <footer className="marquee">
        <div className="track" id="track">
          <span>✦ Welcome to {companyName} <em>{displayName}</em></span>
          <span>✦ {companyName} • {designation}</span>
          <span>✦ Innovate • Transform • Grow</span>
          <span>✦ Happy to have you on board at {companyName} <em>🎉</em></span>
          <span>✦ Welcome to {companyName} <em>{displayName}</em></span>
          <span>✦ {companyName} • {designation}</span>
        </div>
      </footer>

      {/* 🌟 EMBEDDED CSS STYLES & ANIMATIONS FROM HTML REFERENCE */}
      <style>{`
        @property --angle {
          syntax: '<angle>';
          initial-value: 0deg;
          inherits: false;
        }

        .welcome-root-scope {
          background: linear-gradient(135deg, #0b0d1a, #171a33, #1b1533, #0e1024);
          background-size: 300% 300%;
          animation: gradientShift 14s ease infinite;
        }

        .welcome-root-scope input[type="text"],
        .welcome-root-scope input[type="password"] {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          background-color: #0f172a !important;
          border: 1px solid rgba(255, 255, 255, 0.14) !important;
          border-radius: 11px !important;
          padding: 13px 46px 13px 15px !important;
          font-size: 0.875rem !important;
          font-weight: 500 !important;
          font-family: inherit !important;
          outline: none !important;
          box-shadow: none !important;
          transition: border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease !important;
        }

        .welcome-root-scope input[type="text"]:focus,
        .welcome-root-scope input[type="password"]:focus {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          background-color: #0b1020 !important;
          border-color: #818cf8 !important;
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.25) !important;
        }

        .welcome-root-scope input:-webkit-autofill,
        .welcome-root-scope input:-webkit-autofill:hover, 
        .welcome-root-scope input:-webkit-autofill:focus,
        .welcome-root-scope input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 1000px #0f172a inset !important;
          -webkit-text-fill-color: #ffffff !important;
          caret-color: #ffffff !important;
        }

        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(28px); }
          to { opacity: 1; transform: none; }
        }
        @keyframes fadeDown {
          from { opacity: 0; transform: translateY(-28px); }
          to { opacity: 1; transform: none; }
        }
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.4); }
          to { opacity: 1; transform: scale(1); }
        }

        .orb {
          position: fixed;
          border-radius: 50%;
          filter: blur(90px);
          opacity: 0.22;
          z-index: 0;
          animation: orbFloat 12s ease-in-out infinite;
        }
        .orb1 { width: 380px; height: 380px; background: #4f46e5; top: -100px; left: -100px; }
        .orb2 { width: 320px; height: 320px; background: #7c3aed; bottom: -80px; right: -80px; animation-delay: -4s; }
        .orb3 { width: 240px; height: 240px; background: #0891b2; top: 45%; left: 55%; animation-delay: -8s; }

        @keyframes orbFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(40px, -50px) scale(1.15); }
        }

        #particles { position: fixed; inset: 0; z-index: 0; pointer-events: none; }
        #confetti { position: fixed; inset: 0; z-index: 50; pointer-events: none; }

        .topbar {
          position: relative;
          z-index: 3;
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          max-width: 1400px;
          width: 100%;
          margin: 0 auto;
          padding: 18px 28px;
          animation: fadeDown .8s cubic-bezier(.22,1,.36,1) both;
        }
        .brand { display: flex; align-items: center; gap: 16px; text-align: left; }
        .brand img {
          width: 72px; height: 72px; border-radius: 20px; background: #fff; padding: 6px; object-fit: contain;
          box-shadow: 0 0 26px rgba(129,140,248,.35);
          animation: logoSpinIn .9s cubic-bezier(.68,-.55,.27,1.55) .2s both, logoGlow 3.2s ease-in-out 1.4s infinite;
        }
        .company-logo-fallback {
          width: 72px; height: 72px; border-radius: 20px; background: linear-gradient(135deg, #4f46e5, #7c3aed);
          color: white; font-size: 28px; font-weight: 700; display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 26px rgba(129,140,248,.35);
          animation: logoSpinIn .9s cubic-bezier(.68,-.55,.27,1.55) .2s both, logoGlow 3.2s ease-in-out 1.4s infinite;
        }
        @keyframes logoSpinIn { from { transform: rotate(-200deg) scale(0); opacity: 0; } }
        @keyframes logoGlow {
          0%, 100% { box-shadow: 0 0 0 3px rgba(129,140,248,.25), 0 0 20px rgba(129,140,248,.25); }
          50% { box-shadow: 0 0 0 6px rgba(129,140,248,.1), 0 0 34px rgba(129,140,248,.45); }
        }
        .brand h1 { font-size: 1.1rem; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #fff; }
        .brand p { font-size: .64rem; letter-spacing: 2.5px; text-transform: uppercase; color: #8b91b5; }
        .top-chip {
          padding: 8px 16px; border: 1px solid rgba(255,255,255,.14); border-radius: 10px; font-size: .72rem;
          letter-spacing: 1.5px; text-transform: uppercase; color: #c6cbe4; backdrop-filter: blur(8px);
          animation: fadeUp .8s ease .4s both;
        }

        .wrap {
          position: relative; z-index: 2; flex: 1; min-height: 0; display: grid;
          grid-template-columns: minmax(420px,520px) 1fr; gap: 48px; align-items: stretch;
          max-width: 1400px; width: 100%; margin: 0 auto; padding: 6px 28px 18px;
        }

        .scene { align-self: center; perspective: 1100px; animation: fadeUp 1s cubic-bezier(.22,1,.36,1) .25s both; width: 100%; }
        .floater { animation: bob 6s ease-in-out 2s infinite; }
        @keyframes bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }

        .photo-card {
          position: relative; margin: 0 auto; height: min(72vh,630px); aspect-ratio: 4/5; max-width: 100%;
          border-radius: 28px; transform-style: preserve-3d; transition: transform .25s ease; cursor: pointer;
        }
        .photo-card::before {
          content: ''; position: absolute; inset: -3px; border-radius: 30px; z-index: -1;
          background: conic-gradient(from var(--angle), #6366f1, #8b5cf6, #d946ef, #8b5cf6, #6366f1);
          animation: rotateAngle 12s linear infinite;
        }
        @keyframes rotateAngle { to { --angle: 360deg; } }
        .photo-card::after {
          content: ''; position: absolute; inset: 0; border-radius: 28px; pointer-events: none;
          background: radial-gradient(circle at var(--gx,50%) var(--gy,50%), rgba(255,255,255,.18), transparent 55%);
        }
        .photo-card img {
          width: 100%; height: 100%; object-fit: cover; object-position: top center; border-radius: 28px;
          border: 4px solid #101426; display: block;
        }
        .avatar-fallback {
          width: 100%; height: 100%; border-radius: 28px; border: 4px solid #101426;
          background: linear-gradient(135deg, #1e1b4b, #312e81, #4c1d95);
          display: flex; align-items: center; justify-content: center;
          color: #c7d2fe; font-size: 4.5rem; font-weight: 700; text-shadow: 0 0 30px rgba(129,140,248,0.45);
        }

        .overlay {
          position: absolute; left: 0; right: 0; bottom: 0; padding: 56px 20px 18px; text-align: center;
          background: linear-gradient(transparent, rgba(8,8,22,.94)); border-radius: 0 0 24px 24px;
          animation: fadeUp .8s ease 1.1s both;
        }
        .overlay h2 {
          font-size: 1.6rem; font-weight: 700; background: linear-gradient(90deg,#fff,#bcd6ff);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .overlay p { font-size: .76rem; letter-spacing: 2.5px; text-transform: uppercase; color: #a5b4fc; margin-top: 4px; }

        .chip {
          position: absolute; padding: 9px 18px; border-radius: 999px; font-size: .74rem; font-weight: 500;
          background: rgba(15,17,32,.72); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,.14);
          box-shadow: 0 10px 26px rgba(0,0,0,.35);
          animation: popIn .6s cubic-bezier(.68,-.55,.27,1.55) both, bob 4s ease-in-out 2s infinite;
        }
        .chip1 { top: 22px; left: -26px; animation-delay: 1.25s, 2s; }
        .chip2 { top: 64px; right: -30px; animation-delay: 1.45s, 2.4s; }
        .chip3 { bottom: 110px; left: -34px; animation-delay: 1.65s, 2.8s; }

        .spark { position: absolute; color: #a5b4fc; font-size: 1.2rem; animation: twinkle 2.2s ease infinite; text-shadow: 0 0 12px rgba(129,140,248,.8); }
        .s1 { top: -18px; right: 40px; }
        .s2 { bottom: -14px; left: 34px; animation-delay: .7s; }
        .s3 { top: 40%; right: -22px; animation-delay: 1.3s; }
        @keyframes twinkle { 0%,100% { opacity: 0; transform: scale(.4) rotate(0); } 50% { opacity: 1; transform: scale(1.15) rotate(180deg); } }

        .right {
          min-height: 0; overflow-y: auto; padding: 16px 18px 36px 6px; text-align: left;
          scrollbar-width: thin; scrollbar-color: rgba(99,102,241,.6) transparent;
        }
        .right::-webkit-scrollbar { width: 6px; }
        .right::-webkit-scrollbar-track { background: transparent; }
        .right::-webkit-scrollbar-thumb { background: linear-gradient(#6366f1,#8b5cf6); border-radius: 99px; }

        .script {
          font-size: 2.4rem; line-height: 1.18; font-weight: 700;
          background: linear-gradient(90deg,#e0e7ff,#a5b4fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          animation: fadeUp .8s ease .5s both;
        }
        .greet { font-size: 1.9rem; font-weight: 700; margin-top: 2px; animation: fadeUp .8s ease .7s both; color: #fff; }
        .wave { display: inline-block; animation: wave 1.8s ease-in-out 1.4s infinite; transform-origin: 70% 70%; }
        @keyframes wave { 0%,100% { transform: rotate(0); } 20% { transform: rotate(24deg); } 40% { transform: rotate(-12deg); } 60% { transform: rotate(20deg); } 80% { transform: rotate(-6deg); } }

        .typing-wrap { min-height: 26px; margin-top: 12px; font-size: .94rem; font-weight: 400; color: #c6cbe4; animation: fadeUp .8s ease .9s both; }
        .cursor { display: inline-block; width: 2px; height: 1em; background: #a5b4fc; vertical-align: -2px; margin-left: 2px; animation: blink .8s step-end infinite; }
        @keyframes blink { 50% { opacity: 0; } }

        .sec { margin-top: 30px; animation: fadeUp .8s ease var(--d,1.2s) both; }
        .sec h3 { display: flex; align-items: center; gap: 12px; font-size: .72rem; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; color: #8b91b5; }
        .sec h3::after { content: ''; height: 1px; width: 70px; background: linear-gradient(90deg,#6366f1,transparent); transform: scaleX(0); transform-origin: left; animation: grow .8s ease calc(var(--d,1.2s) + .3s) forwards; }
        @keyframes grow { to { transform: scaleX(1); } }

        .about p { margin-top: 12px; font-size: .88rem; font-weight: 400; line-height: 1.75; color: #c3c8e6; border-left: 3px solid #6366f1; padding-left: 16px; }
        .about b { color: #c7d2fe; font-weight: 600; }

        .stats { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; margin-top: 16px; }
        .stat { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); border-radius: 16px; padding: 16px 8px; text-align: center; transition: transform .3s, background .3s, border-color .3s; }
        .stat:hover { transform: translateY(-5px); background: rgba(255,255,255,.1); border-color: rgba(129,140,248,.45); }
        .stat .num { font-size: 1.6rem; font-weight: 700; background: linear-gradient(90deg,#e0e7ff,#a5b4fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .stat small { display: block; margin-top: 2px; font-size: .64rem; letter-spacing: 1.5px; text-transform: uppercase; color: #8b91b5; }

        .branches-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; margin-top: 16px; }
        .branch { display: flex; align-items: center; gap: 12px; padding: 13px 14px; border-radius: 16px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); animation: fadeUp .6s ease var(--d) both; transition: transform .3s, border-color .3s, box-shadow .3s; }
        .branch:hover { transform: translateY(-5px) scale(1.02); border-color: rgba(99,102,241,.55); box-shadow: 0 14px 30px rgba(79,70,229,.28); }
        .b-icon { width: 40px; height: 40px; flex: 0 0 40px; display: grid; place-items: center; font-size: 1.15rem; border-radius: 12px; background: linear-gradient(135deg,rgba(99,102,241,.4),rgba(139,92,246,.3)); color: #c7d2fe; }
        .branch b { font-size: .86rem; font-weight: 600; display: block; color: #fff; }
        .branch small { font-size: .62rem; letter-spacing: 1.5px; text-transform: uppercase; color: #8b91b5; }

        .cta-row { display: flex; gap: 16px; margin-top: 34px; flex-wrap: wrap; animation: fadeUp .8s ease 2.9s both; }
        .btn { padding: 13px 30px; border: none; border-radius: 12px; font-family: inherit; font-size: .85rem; font-weight: 600; letter-spacing: .3px; cursor: pointer; transition: transform .2s ease, box-shadow .2s ease, background-color .2s ease; }
        .btn-p { color: #fff; background: #4f46e5; box-shadow: 0 10px 28px -8px rgba(79,70,229,.6); }
        .btn-p:hover { transform: translateY(-2px); background-color: #4338ca; box-shadow: 0 16px 36px -10px rgba(79,70,229,.65); }

        .marquee { position: relative; z-index: 2; flex: 0 0 auto; overflow: hidden; padding: 13px 0; border-top: 1px solid rgba(255,255,255,.08); background: rgba(0,0,0,.2); animation: fadeUp 1s ease 1s both; }
        .track { display: flex; gap: 56px; width: max-content; white-space: nowrap; animation: scroll 24s linear infinite; }
        .track span { font-size: .7rem; letter-spacing: 4px; color: #6f74a0; text-transform: uppercase; }
        .track em { color: #a5b4fc; font-style: normal; }
        @keyframes scroll { to { transform: translateX(-50%); } }

        @media(max-width:980px){
          .wrap { grid-template-columns: 1fr; gap: 44px; padding-top: 4px; }
          .scene { max-width: 400px; margin: 0 auto; width: 100%; }
          .photo-card { height: auto; aspect-ratio: 4/5; width: 100%; }
          .right { overflow: visible; padding: 0 4px; }
          .branches-grid { grid-template-columns: 1fr 1fr; }
          .greet { font-size: 1.5rem; }
          .script { font-size: 2rem; }
          .top-chip { display: none; }
        }
        @media(max-width:520px){
          .branches-grid, .stats { grid-template-columns: 1fr 1fr; }
          .chip1 { left: -8px; } .chip2 { right: -8px; } .chip3 { left: -8px; }
        }
      `}</style>

    </div>
  );
}

export default function PasswordUpdatePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex flex-col items-center justify-center gap-3 bg-[#0b0d1a] text-slate-300 text-xs font-medium">
          <div className="h-5 w-5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
          Loading Onboarding Context...
        </div>
      }
    >
      <PasswordUpdateForm />
    </Suspense>
  );
}
