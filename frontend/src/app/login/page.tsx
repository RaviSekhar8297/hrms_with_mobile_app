'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

function EdmBrihaspathiTitle({
  className = "text-2xl font-black tracking-wider text-[#0F172A] font-outfit block leading-tight",
  letterClassName = "",
}: {
  className?: string;
  letterClassName?: string;
}) {
  const text = "BRIHASPATHI";
  const letters = text.split("");

  const [activeStage, setActiveStage] = useState<'flyingIn' | 'pulsing' | 'fadingOut'>('flyingIn');
  const [keyCycle, setKeyCycle] = useState(0);

  useEffect(() => {
    let timer1: NodeJS.Timeout;
    let timer2: NodeJS.Timeout;
    let timer3: NodeJS.Timeout;

    const totalBuildTime = 3000;
    const pulseDuration = 3000;
    const fadeOutDuration = 500;
    const pauseBeforeNextCycle = 500;

    setActiveStage('flyingIn');

    timer1 = setTimeout(() => {
      setActiveStage('pulsing');
    }, totalBuildTime);

    timer2 = setTimeout(() => {
      setActiveStage('fadingOut');
    }, totalBuildTime + pulseDuration);

    timer3 = setTimeout(() => {
      setKeyCycle((prev) => prev + 1);
    }, totalBuildTime + pulseDuration + fadeOutDuration + pauseBeforeNextCycle);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [keyCycle]);

  const totalBuildTime = 3000;
  const staggerDelay = totalBuildTime / letters.length;

  return (
    <div className={`inline-block overflow-hidden py-0.5 ${activeStage === 'pulsing' ? 'animate-edm-pulse' : ''}`}>
      <span className={className}>
        {letters.map((char, idx) => {
          const delayMs = idx * staggerDelay;
          let animationStyle = '';

          if (activeStage === 'flyingIn') {
            animationStyle = `flyInRight 0.8s ease-out ${delayMs}ms forwards`;
          } else if (activeStage === 'pulsing') {
            animationStyle = 'none';
          } else if (activeStage === 'fadingOut') {
            animationStyle = 'fadeOut 0.5s ease-out forwards';
          }

          return (
            <span
              key={`${keyCycle}-${idx}`}
              className={`inline-block ${letterClassName}`}
              style={{
                opacity: activeStage === 'pulsing' ? 1 : 0,
                animation: animationStyle,
                color: 'inherit',
              }}
            >
              {char}
            </span>
          );
        })}
      </span>
    </div>
  );
}

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    
    // Force light mode theme reset for clean rendering
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.remove('theme-nordic-light');
    }

    // Clear old tokens if logout/clear param is present in URL
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('logout') === 'true' || urlParams.get('clear') === 'true') {
        localStorage.removeItem('access_token');
        localStorage.removeItem('email');
        localStorage.removeItem('roles');
        localStorage.removeItem('permissions');
        localStorage.removeItem('companyId');
        localStorage.removeItem('designation');
        sessionStorage.clear();
      } else {
        const token = localStorage.getItem('access_token');
        if (token) router.replace('/dashboard');
      }
    }

    const savedEmail = localStorage.getItem('remembered_email');
    if (savedEmail) {
      setUsername(savedEmail);
      setRememberMe(true);
    }
  }, [router]);

  useEffect(() => {
    if (error || successMessage) {
      const timer = setTimeout(() => {
        setError('');
        setSuccessMessage('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, successMessage]);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!username || !password) {
      setError('Please enter both email/username and password.');
      return;
    }
    if (username.length > 40) {
      setError('Username/Email cannot exceed 40 characters.');
      return;
    }
    if (password.length > 20) {
      setError('Password cannot exceed 20 characters.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok) {
        if (rememberMe) {
          localStorage.setItem('remembered_email', username);
        } else {
          localStorage.removeItem('remembered_email');
        }
        let userEmail = data.email || username;
        let userRoles: string[] = Array.isArray(data.roles) ? data.roles : ['SuperAdmin'];
        try {
          if (data.access_token) {
            const tokenPayload = JSON.parse(atob(data.access_token.split('.')[1]));
            if (tokenPayload.email) userEmail = tokenPayload.email;
            if (tokenPayload.realm_access?.roles && Array.isArray(tokenPayload.realm_access.roles)) {
              userRoles = [...tokenPayload.realm_access.roles];
            } else if (tokenPayload.roles && Array.isArray(tokenPayload.roles)) {
              userRoles = [...tokenPayload.roles];
            }
          }
        } catch {}

        const lowerUser = username.toLowerCase();
        if (
          lowerUser === 'superadmin' || 
          lowerUser === 'superadmin@hrms.com'
        ) {
          if (!userRoles.includes('SuperAdmin')) {
            userRoles.push('SuperAdmin');
          }
        }

        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('email', userEmail);
        localStorage.setItem('roles', JSON.stringify(userRoles));
        sessionStorage.setItem('session_active', 'true');
        if (data.companyId) localStorage.setItem('companyId', data.companyId);
        else localStorage.removeItem('companyId');

        try {
          const permRes = await fetch('/api/v1/auth/user-permissions', {
            headers: { Authorization: `Bearer ${data.access_token}` }
          });
          if (permRes.ok) {
            const permData = await permRes.json();
            if (permData.permissions) {
              localStorage.setItem('permissions', JSON.stringify(permData.permissions));
            }
            if (permData.scopes) {
              localStorage.setItem('permissionScopes', JSON.stringify(permData.scopes));
            }
          }
        } catch {}

        const rolesArr = userRoles;
        const isSuperAdminUser = rolesArr.includes('SuperAdmin') || 
                                 lowerUser === 'superadmin' || 
                                 lowerUser === 'superadmin@hrms.com';
        
        const isFirstTimeLogin = !isSuperAdminUser && (data.is_temporary_password === true);

        if (isFirstTimeLogin) {
          router.replace(`/passwordupdate?username=${encodeURIComponent(username)}&temp=${encodeURIComponent(password)}`);
        } else {
          router.replace('/dashboard');
        }
      } else {
        let errMsg = data.error || 'Invalid email or password. Please try again.';
        if (errMsg === 'invalid_grant' || errMsg.includes('invalid_grant') || errMsg.toLowerCase().includes('invalid credential')) {
          errMsg = 'Invalid email or password. Please check your credentials and try again.';
        }
        const userIsStillTemp = data.is_temporary_password === true;
        
        if (userIsStillTemp && (errMsg.includes('fully set up') || errMsg.includes('temporary'))) {
          router.replace(`/passwordupdate?username=${encodeURIComponent(username)}&temp=${encodeURIComponent(password)}`);
        } else {
          setError(errMsg);
        }
      }
    } catch {
      setError('Cannot connect to server. Please ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div data-login-container="true" className="min-h-screen h-screen w-full flex flex-col font-sans bg-[#f4f7fa] text-slate-900 select-none overflow-hidden relative">
      
      {/* 🖼️ FULL-WIDTH EDGE-TO-EDGE 3D HRMS GRAPHIC BACKGROUND WITH SOFT OPACITY */}
      <div className="absolute inset-0 z-0 overflow-hidden w-full h-full">
        <img
          src="/hrms_login_3d_light_graphic.jpg"
          alt="Brihaspathi Enterprise HRMS Platform"
          className="w-full h-full object-cover sm:object-contain opacity-45 sm:opacity-30"
        />
        {/* Soft Ambient Veil for Card Contrast */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#eef1f6]/70 via-transparent to-[#eef1f6]/60 pointer-events-none" />
      </div>

      {/* 🚀 MAIN CONTENT AREA: CENTERED FLOATING GLASS CONSOLE */}
      <main className="relative z-10 flex-1 w-full h-full flex items-center justify-center px-4 sm:px-6 py-6">
        
        {/* Centered Light Glassmorphic Sign-In Card with Soft Borders */}
        <div className="w-full sm:w-[400px] xl:w-[420px] shrink-0 my-auto">
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-7 sm:p-8 border border-[#e4e7ec] shadow-[0_8px_16px_-6px_rgba(16,24,40,0.06),0_32px_64px_-16px_rgba(16,24,40,0.18)] space-y-6 relative overflow-hidden transition-all duration-300 text-slate-900 animate-scaleUp">
            
            {/* Header Titles (Welcome Back & Sign in to your HRMS) */}
            <div className="text-center space-y-2.5">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white shadow-[0_8px_20px_-6px_rgba(79,70,229,0.55)]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                </svg>
              </div>
              <div className="space-y-1">
                <h2 className="text-[22px] sm:text-2xl font-semibold tracking-[-0.02em] text-slate-900 font-sans">
                  Welcome Back
                </h2>
                <p className="text-[13px] text-slate-500">
                  Sign in to your HRMS
                </p>
              </div>
            </div>

            {/* Alert Error / Success Messages */}
            {error && (
              <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/20 bg-rose-500/[0.06] p-3 text-xs text-rose-700 animate-fadeIn">
                <svg className="w-4 h-4 mt-px shrink-0 text-rose-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008ZM12 3l9 16.5H3L12 3Z" />
                </svg>
                <div className="flex-1 font-medium leading-relaxed">{error}</div>
                <button type="button" onClick={() => setError('')} className="shrink-0 text-rose-400 hover:text-rose-700 font-semibold cursor-pointer">&times;</button>
              </div>
            )}

            {successMessage && (
              <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3 text-xs text-emerald-700 animate-fadeIn">
                <svg className="w-4 h-4 mt-px shrink-0 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <div className="flex-1 font-medium leading-relaxed">{successMessage}</div>
                <button type="button" onClick={() => setSuccessMessage('')} className="shrink-0 text-emerald-400 hover:text-emerald-700 font-semibold cursor-pointer">&times;</button>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              
              {/* Field 1: Username / Email (Max 40 chars) */}
              <div className="relative flex items-center">
                <input
                  id="username"
                  type="text"
                  required
                  maxLength={40}
                  placeholder="Username or Email ID (max 40 chars)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.slice(0, 40))}
                  className="login-input w-full h-12 py-3 pl-4 pr-11 rounded-[11px] border border-[#d0d5dd] bg-white text-[13.5px] font-medium text-slate-900 outline-none transition-all duration-200 placeholder:text-slate-400 placeholder:text-[13px] placeholder:font-normal"
                />
                <div className="absolute right-3.5 text-slate-400 pointer-events-none">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </div>
              </div>

              {/* Field 2: Password (Max 20 chars) */}
              <div className="relative flex items-center">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  maxLength={20}
                  placeholder="Password (max 20 chars)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value.slice(0, 20))}
                  className="login-input w-full h-12 py-3 pl-4 pr-11 rounded-[11px] border border-[#d0d5dd] bg-white text-[13.5px] font-medium text-slate-900 outline-none transition-all duration-200 placeholder:text-slate-400 placeholder:text-[13px] placeholder:font-normal"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer p-1"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Stylish Custom Checkbox & Forgot Password Link */}
              <div className="flex items-center justify-between text-xs pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 font-medium group">
                  <div className="relative flex items-center justify-center">
                    <input 
                      type="checkbox" 
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="sr-only peer" 
                    />
                    <div className="w-4 h-4 rounded-[5px] border border-[#d0d5dd] bg-white peer-checked:bg-brand-600 peer-checked:border-brand-600 group-hover:border-brand-500 peer-focus-visible:ring-4 peer-focus-visible:ring-brand-600/10 transition-all duration-200 flex items-center justify-center">
                      <svg 
                        className={`w-3 h-3 text-white transition-transform duration-200 ${rememberMe ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`} 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor" 
                        strokeWidth="3.5"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  <span className="group-hover:text-slate-900 transition-colors text-[12.5px] font-medium text-slate-600">Keep me signed in</span>
                </label>
                <a 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); alert('Please contact your HR Administrator to reset your credentials.'); }}
                  className="text-brand-600 hover:text-brand-700 transition-colors font-semibold hover:underline text-[12.5px]"
                >
                  Forgot Password?
                </a>
              </div>

              {/* Vibrant Blue SIGN IN Button */}
              <button 
                type="submit" 
                disabled={loading} 
                className="w-full h-12 px-6 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-[13px] tracking-[0.02em] rounded-[11px] shadow-[0_8px_20px_-6px_rgba(79,70,229,0.5)] active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed mt-1"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>SIGNING IN...</span>
                  </div>
                ) : (
                  <span>SIGN IN</span>
                )}
              </button>

            </form>

            {/* Social SSO Divider */}
            <div className="relative my-3 text-center">
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-[#eaecf0]" />
              <span className="relative px-3 font-medium text-[10px] bg-white rounded-full text-slate-400 uppercase tracking-[0.14em]">
                Sign in with
              </span>
            </div>

            {/* Social SSO Buttons (Preserved as requested) */}
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => router.push('/company_setup')}
                className="flex items-center justify-center h-11 rounded-[11px] bg-white border border-[#e4e7ec] hover:border-[#d0d5dd] hover:bg-slate-50 transition-colors cursor-pointer"
                title="Sign in with Google"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.68 1.54 14.98 1 12 1 7.35 1 3.37 3.65 1.39 7.56l3.85 2.99c.9-2.7 3.4-4.51 6.76-4.51z" />
                  <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.29 1.48-1.14 2.73-2.4 3.58l3.76 2.91c2.2-2.03 3.67-5.01 3.67-8.64z" />
                  <path fill="#FBBC05" d="M5.24 14.56c-.23-.69-.36-1.43-.36-2.2s.13-1.51.36-2.2L1.39 7.17C.5 8.97 0 10.97 0 13s.5 4.03 1.39 5.83l3.85-3.27z" />
                  <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.76-2.91c-1.1.74-2.52 1.18-4.2 1.18-3.36 0-5.86-1.81-6.76-4.51L1.39 17.1C3.37 20.95 7.35 23 12 23z" />
                </svg>
              </button>

              <button
                type="button"
                onClick={() => alert('Apple ID SSO configured.')}
                className="flex items-center justify-center h-11 rounded-[11px] bg-white border border-[#e4e7ec] hover:border-[#d0d5dd] hover:bg-slate-50 transition-colors cursor-pointer text-slate-900"
                title="Sign in with Apple"
              >
                <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.21.67-2.93 1.49-.62.69-1.16 1.84-1.01 2.96 1.12.09 2.27-.56 2.95-1.39" />
                </svg>
              </button>

              <button
                type="button"
                onClick={() => alert('Microsoft SSO configured.')}
                className="flex items-center justify-center h-11 rounded-[11px] bg-white border border-[#e4e7ec] hover:border-[#d0d5dd] hover:bg-slate-50 transition-colors cursor-pointer"
                title="Sign in with Microsoft"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 23 23">
                  <path fill="#f35325" d="M0 0h11v11H0z" />
                  <path fill="#81bc06" d="M12 0h11v11H12z" />
                  <path fill="#05a6f0" d="M0 12h11v11H0z" />
                  <path fill="#ffba08" d="M12 12h11v11H12z" />
                </svg>
              </button>
            </div>

          </div>
        </div>

      </main>

    </div>
  );
}
