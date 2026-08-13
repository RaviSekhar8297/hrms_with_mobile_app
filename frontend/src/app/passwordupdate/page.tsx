'use client';

import React, { Suspense, useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

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
    if (emailParam) setUsername(emailParam);
    if (tempParam) setOldPassword(tempParam);

    const activeUser = emailParam || 'employee';
    const hostIp = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

    fetch(`http://${hostIp}:5000/api/v1/auth/welcome-profile?username=${encodeURIComponent(activeUser)}`)
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

    const starColors = ['#ffffff', '#ffffff', '#ffffff', '#f0f4ff', '#fff9c4', '#c7d2fe'];

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

    const colors = ['#ff0080', '#ffd700', '#00ff88', '#40e0d0', '#7b68ee', '#ff8c00'];
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
    if (passwordStrength === 3) return { text: 'Good security', color: 'text-[#0f62fe]', progressColor: 'bg-[#0f62fe]', percent: '75%' };
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
    const hostIp = window.location.hostname;
    const apiUrl = `http://${hostIp}:5000/api/v1/auth/reset-temporary-password`;

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
        <span className="top-chip">🗓️ {joiningDate}</span>
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
                <span className="chip chip1">🎉 New Joiner</span>
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
                  <span className="b-icon">🏢</span>
                  <div>
                    <b>Hyderabad</b>
                    <small>Head Office</small>
                  </div>
                </div>
                <div className="branch" style={{ '--d': '2.15s' } as React.CSSProperties}>
                  <span className="b-icon">💻</span>
                  <div>
                    <b>Bengaluru</b>
                    <small>R&D Center</small>
                  </div>
                </div>
                <div className="branch" style={{ '--d': '2.3s' } as React.CSSProperties}>
                  <span className="b-icon">📈</span>
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
                  setStage('PASSWORD_RESET');
                }}
              >
                Let&apos;s Get Started 🚀
              </button>
            </div>
          </section>

        </main>
      ) : (
        /* 🌟 STAGE 2: CHANGE PASSWORD FORM (HIGH CONTRAST GLASS CARD) */
        <main className="wrap-form animate-fade-up max-w-lg mx-auto my-auto relative z-20 w-full px-4 py-8">
          <div className="bg-[#12102e]/95 backdrop-blur-2xl border-2 border-indigo-500/40 rounded-3xl p-8 sm:p-10 text-white shadow-2xl shadow-indigo-950/90 relative overflow-hidden text-left">
            
            {/* Header Badge */}
            <div className="flex items-center justify-between pb-6 mb-6 border-b border-indigo-500/20">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-600 to-pink-600 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-indigo-500/30 border border-white/20">
                  🔐
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tight font-outfit">
                    Update Account Password
                  </h2>
                  <p className="text-xs text-indigo-200 font-semibold mt-0.5">
                    First Time Security Configuration for <strong className="text-amber-300">{displayName}</strong>
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3.5 mb-5 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs font-bold flex items-start gap-2.5">
                <span className="text-base">⚠️</span>
                <span className="pt-0.5">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmitPasswordReset} className="space-y-5">
              
              {/* Username Badge Display (Readonly) */}
              <div className="p-3 rounded-xl bg-indigo-950/60 border border-indigo-500/30 flex items-center justify-between">
                <span className="text-[11px] font-black uppercase text-indigo-300 tracking-wider">Account Email</span>
                <span className="text-xs font-mono font-bold text-amber-300">{username}</span>
              </div>

              {/* New Password Input */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-indigo-200 tracking-wider block font-outfit">
                  New Permanent Password <span className="text-pink-400">*</span>
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    placeholder="Minimum 8 characters..."
                    value={newPassword}
                    onChange={e => handlePasswordChange(e.target.value)}
                    style={{ color: '#ffffff', backgroundColor: '#0f172a' }}
                    className="w-full py-3.5 px-4 pr-12 rounded-xl border-2 border-indigo-500/50 text-white font-mono text-base tracking-[0.2em] outline-none focus:border-indigo-400 focus:bg-[#050515] focus:ring-4 focus:ring-indigo-500/30 placeholder:text-slate-400 placeholder:font-sans placeholder:tracking-normal transition-all shadow-md"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3.5 text-slate-300 hover:text-white transition-colors cursor-pointer text-base p-1"
                  >
                    {showNewPassword ? '👁️' : '🙈'}
                  </button>
                </div>

                {/* Password Strength Meter */}
                <div className="mt-1 px-1">
                  <div className="flex justify-between items-center text-[10.5px] font-bold mb-1">
                    <span className="text-slate-300">Password Strength:</span>
                    <span className={strengthInfo.color}>{strengthInfo.text}</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-white/10">
                    <div
                      className={`h-full ${strengthInfo.progressColor} transition-all duration-300`}
                      style={{ width: strengthInfo.percent }}
                    />
                  </div>
                </div>
              </div>

              {/* Confirm Password Input */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-indigo-200 tracking-wider block font-outfit">
                  Confirm New Password <span className="text-pink-400">*</span>
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    placeholder="Re-enter new password..."
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    style={{ color: '#ffffff', backgroundColor: '#0f172a' }}
                    className="w-full py-3.5 px-4 pr-12 rounded-xl border-2 border-indigo-500/50 text-white font-mono text-base tracking-[0.2em] outline-none focus:border-indigo-400 focus:bg-[#050515] focus:ring-4 focus:ring-indigo-500/30 placeholder:text-slate-400 placeholder:font-sans placeholder:tracking-normal transition-all shadow-md"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 text-slate-300 hover:text-white transition-colors cursor-pointer text-base p-1"
                  >
                    {showConfirmPassword ? '👁️' : '🙈'}
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
                      className={`w-full py-4 px-6 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg ${
                        isFormValid && !loading
                          ? 'bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-600 hover:from-indigo-600 hover:to-pink-700 text-white cursor-pointer shadow-indigo-500/25 active:scale-[0.99]'
                          : 'bg-slate-800/90 text-slate-400 border border-slate-700/60 cursor-not-allowed opacity-80'
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
                        <span>Set Password & Proceed 🚀</span>
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
          background: linear-gradient(135deg, #0f0c29, #302b63, #24243e, #141432);
          background-size: 300% 300%;
          animation: gradientShift 14s ease infinite;
        }

        .welcome-root-scope input[type="text"],
        .welcome-root-scope input[type="password"] {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          background-color: #0f172a !important;
          border-color: rgba(99, 102, 241, 0.5) !important;
        }

        .welcome-root-scope input[type="text"]:focus,
        .welcome-root-scope input[type="password"]:focus {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          background-color: #050515 !important;
          border-color: #818cf8 !important;
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.35) !important;
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
          filter: blur(80px);
          opacity: 0.4;
          z-index: 0;
          animation: orbFloat 12s ease-in-out infinite;
        }
        .orb1 { width: 380px; height: 380px; background: #7b68ee; top: -100px; left: -100px; }
        .orb2 { width: 320px; height: 320px; background: #ff0080; bottom: -80px; right: -80px; animation-delay: -4s; }
        .orb3 { width: 240px; height: 240px; background: #00c9a7; top: 45%; left: 55%; animation-delay: -8s; }

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
          width: 88px; height: 88px; border-radius: 50%; background: #fff; padding: 6px; object-fit: contain;
          box-shadow: 0 0 26px rgba(255,215,0,.45);
          animation: logoSpinIn 1s cubic-bezier(.68,-.55,.27,1.55) .2s both, logoGlow 2.8s ease-in-out 1.4s infinite;
        }
        .company-logo-fallback {
          width: 88px; height: 88px; border-radius: 50%; background: linear-gradient(135deg, #7b68ee, #ff0080);
          color: white; font-size: 34px; font-weight: 800; display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 26px rgba(255,215,0,.45);
          animation: logoSpinIn 1s cubic-bezier(.68,-.55,.27,1.55) .2s both, logoGlow 2.8s ease-in-out 1.4s infinite;
        }
        @keyframes logoSpinIn { from { transform: rotate(-200deg) scale(0); opacity: 0; } }
        @keyframes logoGlow {
          0%, 100% { box-shadow: 0 0 0 4px rgba(255,215,0,.35), 0 0 24px rgba(255,215,0,.35); }
          50% { box-shadow: 0 0 0 8px rgba(255,215,0,.15), 0 0 44px rgba(255,215,0,.65); }
        }
        .brand h1 { font-size: 1.25rem; font-weight: 800; letter-spacing: 2.5px; text-transform: uppercase; color: #fff; }
        .brand p { font-size: .68rem; letter-spacing: 3px; text-transform: uppercase; color: #9aa0c3; }
        .top-chip {
          padding: 9px 20px; border: 1px solid rgba(255,255,255,.2); border-radius: 999px; font-size: .75rem;
          letter-spacing: 2px; text-transform: uppercase; color: #cfd2ea; backdrop-filter: blur(8px);
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
          content: ''; position: absolute; inset: -4px; border-radius: 32px; z-index: -1;
          background: conic-gradient(from var(--angle), #ff0080, #ffd700, #00ff88, #40e0d0, #7b68ee, #ff0080);
          animation: rotateAngle 10s linear infinite;
        }
        @keyframes rotateAngle { to { --angle: 360deg; } }
        .photo-card::after {
          content: ''; position: absolute; inset: 0; border-radius: 28px; pointer-events: none;
          background: radial-gradient(circle at var(--gx,50%) var(--gy,50%), rgba(255,255,255,.22), transparent 55%);
        }
        .photo-card img {
          width: 100%; height: 100%; object-fit: cover; object-position: top center; border-radius: 28px;
          border: 5px solid #14122b; display: block;
        }
        .avatar-fallback {
          width: 100%; height: 100%; border-radius: 28px; border: 5px solid #14122b;
          background: linear-gradient(135deg, #1e1b4b, #311b92, #4a148c);
          display: flex; align-items: center; justify-content: center;
          color: #ffd700; font-size: 5rem; font-weight: 800; text-shadow: 0 0 30px rgba(255,215,0,0.5);
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
        .overlay p { font-size: .76rem; letter-spacing: 3px; text-transform: uppercase; color: #ffd700; margin-top: 4px; }

        .chip {
          position: absolute; padding: 9px 18px; border-radius: 999px; font-size: .74rem; font-weight: 600;
          background: rgba(20,18,43,.85); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,.2);
          box-shadow: 0 10px 26px rgba(0,0,0,.4);
          animation: popIn .6s cubic-bezier(.68,-.55,.27,1.55) both, bob 4s ease-in-out 2s infinite;
        }
        .chip1 { top: 22px; left: -26px; animation-delay: 1.25s, 2s; }
        .chip2 { top: 64px; right: -30px; animation-delay: 1.45s, 2.4s; }
        .chip3 { bottom: 110px; left: -34px; animation-delay: 1.65s, 2.8s; }

        .spark { position: absolute; color: #ffd700; font-size: 1.2rem; animation: twinkle 2.2s ease infinite; text-shadow: 0 0 12px #ffd700; }
        .s1 { top: -18px; right: 40px; }
        .s2 { bottom: -14px; left: 34px; animation-delay: .7s; }
        .s3 { top: 40%; right: -22px; animation-delay: 1.3s; }
        @keyframes twinkle { 0%,100% { opacity: 0; transform: scale(.4) rotate(0); } 50% { opacity: 1; transform: scale(1.15) rotate(180deg); } }

        .right {
          min-height: 0; overflow-y: auto; padding: 16px 18px 36px 6px; text-align: left;
          scrollbar-width: thin; scrollbar-color: rgba(123,104,238,.6) transparent;
        }
        .right::-webkit-scrollbar { width: 6px; }
        .right::-webkit-scrollbar-track { background: transparent; }
        .right::-webkit-scrollbar-thumb { background: linear-gradient(#7b68ee,#ff0080); border-radius: 99px; }

        .script {
          font-size: 2.8rem; line-height: 1.15; font-weight: 800;
          background: linear-gradient(90deg,#ffd700,#ff8c00,#ffd700); -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          animation: fadeUp .8s ease .5s both;
        }
        .greet { font-size: 2.1rem; font-weight: 800; margin-top: 2px; animation: fadeUp .8s ease .7s both; color: #fff; }
        .wave { display: inline-block; animation: wave 1.8s ease-in-out 1.4s infinite; transform-origin: 70% 70%; }
        @keyframes wave { 0%,100% { transform: rotate(0); } 20% { transform: rotate(24deg); } 40% { transform: rotate(-12deg); } 60% { transform: rotate(20deg); } 80% { transform: rotate(-6deg); } }

        .typing-wrap { min-height: 26px; margin-top: 12px; font-size: .98rem; font-weight: 300; color: #cfd2ea; animation: fadeUp .8s ease .9s both; }
        .cursor { display: inline-block; width: 2px; height: 1em; background: #ffd700; vertical-align: -2px; margin-left: 2px; animation: blink .8s step-end infinite; }
        @keyframes blink { 50% { opacity: 0; } }

        .sec { margin-top: 30px; animation: fadeUp .8s ease var(--d,1.2s) both; }
        .sec h3 { display: flex; align-items: center; gap: 12px; font-size: .75rem; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; color: #9aa0c3; }
        .sec h3::after { content: ''; height: 1px; width: 70px; background: linear-gradient(90deg,#7b68ee,transparent); transform: scaleX(0); transform-origin: left; animation: grow .8s ease calc(var(--d,1.2s) + .3s) forwards; }
        @keyframes grow { to { transform: scaleX(1); } }

        .about p { margin-top: 12px; font-size: .9rem; font-weight: 300; line-height: 1.75; color: #c9ccec; border-left: 3px solid #7b68ee; padding-left: 16px; }
        .about b { color: #ffd700; font-weight: 600; }

        .stats { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; margin-top: 16px; }
        .stat { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); border-radius: 16px; padding: 16px 8px; text-align: center; transition: transform .3s, background .3s, border-color .3s; }
        .stat:hover { transform: translateY(-5px); background: rgba(255,255,255,.1); border-color: rgba(255,215,0,.4); }
        .stat .num { font-size: 1.7rem; font-weight: 800; background: linear-gradient(90deg,#ffd700,#ff8c00); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .stat small { display: block; margin-top: 2px; font-size: .64rem; letter-spacing: 1.5px; text-transform: uppercase; color: #9aa0c3; }

        .branches-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; margin-top: 16px; }
        .branch { display: flex; align-items: center; gap: 12px; padding: 13px 14px; border-radius: 16px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); animation: fadeUp .6s ease var(--d) both; transition: transform .3s, border-color .3s, box-shadow .3s; }
        .branch:hover { transform: translateY(-5px) scale(1.02); border-color: rgba(123,104,238,.6); box-shadow: 0 14px 30px rgba(123,104,238,.25); }
        .b-icon { width: 40px; height: 40px; flex: 0 0 40px; display: grid; place-items: center; font-size: 1.15rem; border-radius: 12px; background: linear-gradient(135deg,rgba(123,104,238,.35),rgba(255,0,128,.3)); }
        .branch b { font-size: .86rem; font-weight: 600; display: block; color: #fff; }
        .branch small { font-size: .62rem; letter-spacing: 1.5px; text-transform: uppercase; color: #9aa0c3; }

        .cta-row { display: flex; gap: 16px; margin-top: 34px; flex-wrap: wrap; animation: fadeUp .8s ease 2.9s both; }
        .btn { padding: 14px 34px; border: none; border-radius: 999px; font-family: inherit; font-size: .9rem; font-weight: 600; letter-spacing: 1px; cursor: pointer; transition: transform .3s, box-shadow .3s; position: relative; overflow: hidden; }
        .btn-p { color: #fff; background: linear-gradient(90deg,#7b68ee,#ff0080); box-shadow: 0 10px 30px rgba(255,0,128,.35); }
        .btn-p::before { content: ''; position: absolute; top: 0; left: -120%; width: 50%; height: 100%; transform: skewX(-20deg); background: linear-gradient(120deg,transparent,rgba(255,255,255,.35),transparent); transition: left .6s ease; }
        .btn-p:hover::before { left: 130%; }
        .btn-p:hover { transform: translateY(-3px) scale(1.04); box-shadow: 0 16px 42px rgba(255,0,128,.5); }

        .marquee { position: relative; z-index: 2; flex: 0 0 auto; overflow: hidden; padding: 13px 0; border-top: 1px solid rgba(255,255,255,.08); background: rgba(0,0,0,.2); animation: fadeUp 1s ease 1s both; }
        .track { display: flex; gap: 56px; width: max-content; white-space: nowrap; animation: scroll 24s linear infinite; }
        .track span { font-size: .7rem; letter-spacing: 4px; color: #6f74a0; text-transform: uppercase; }
        .track em { color: #ffd700; font-style: normal; }
        @keyframes scroll { to { transform: translateX(-50%); } }

        @media(max-width:980px){
          .wrap { grid-template-columns: 1fr; gap: 44px; padding-top: 4px; }
          .scene { max-width: 400px; margin: 0 auto; width: 100%; }
          .photo-card { height: auto; aspect-ratio: 4/5; width: 100%; }
          .right { overflow: visible; padding: 0 4px; }
          .branches-grid { grid-template-columns: 1fr 1fr; }
          .greet { font-size: 1.6rem; }
          .script { font-size: 2.2rem; }
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
        <div className="min-h-screen w-full flex items-center justify-center bg-[#0f0c29] text-white font-bold uppercase tracking-wider text-xs">
          Loading Onboarding Context...
        </div>
      }
    >
      <PasswordUpdateForm />
    </Suspense>
  );
}
