'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

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
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('email', data.email);
        localStorage.setItem('roles', JSON.stringify(data.roles));
        localStorage.setItem('permissions', JSON.stringify(data.permissions || []));
        if (data.companyId) localStorage.setItem('companyId', data.companyId);
        else localStorage.removeItem('companyId');

        const rolesArr = data.roles || [];
        const isSuperAdminUser = rolesArr.includes('SuperAdmin') || 
                                 username.toLowerCase() === 'superadmin' || 
                                 username.toLowerCase() === 'rajasekhar' || 
                                 username.toLowerCase() === 'admin@hrms.com' ||
                                 username.toLowerCase() === 'superadmin@hrms.com' ||
                                 username.toLowerCase() === 'md@brihaspathi.com';
        
        const isFirstTimeLogin = !isSuperAdminUser && (data.is_temporary_password === true);

        if (isFirstTimeLogin) {
          router.replace(`/passwordupdate?username=${encodeURIComponent(username)}&temp=${encodeURIComponent(password)}`);
        } else {
          router.replace('/dashboard');
        }
      } else {
        const errMsg = data.error || 'Invalid email or password. Please try again.';
        const isTempPass = password === '123456' || password === '123' || password.toLowerCase().includes('temp');
        if ((errMsg.includes('fully set up') || errMsg.includes('temporary')) && isTempPass) {
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
    <div data-login-container="true" className="min-h-screen h-screen w-full flex flex-col lg:flex-row font-sans bg-slate-50 text-slate-900 select-none overflow-hidden relative">
      
      {/* 🌌 SOFT LIGHT GRADIENT ORBS */}
      <div className="absolute top-[-10%] left-[-5%] w-[650px] h-[650px] bg-indigo-200/35 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[650px] h-[650px] bg-purple-200/35 rounded-full blur-[140px] pointer-events-none" />

      {/* 🔔 ELEGANT TOAST NOTIFICATION */}
      {(error || successMessage) && (
        <div 
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] w-[90%] max-w-[440px] rounded-2xl p-4 flex items-center gap-3.5 shadow-2xl backdrop-blur-2xl border transition-all duration-300 animate-slide-down bg-white"
          style={{
            borderColor: error ? '#fecdd3' : '#a7f3d0',
            boxShadow: error ? '0 20px 50px -10px rgba(225, 29, 72, 0.2)' : '0 20px 50px -10px rgba(16, 185, 129, 0.2)',
            color: '#0f172a'
          }}
        >
          <div className={`p-2.5 rounded-xl text-white shrink-0 ${error ? 'bg-rose-600' : 'bg-emerald-600'}`}>
            {error ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            )}
          </div>

          <div className="flex-1 min-w-0 text-left">
            <h4 className={`text-[10px] font-black uppercase tracking-widest ${error ? 'text-rose-600' : 'text-emerald-700'}`}>
              {error ? 'Notice' : 'Success'}
            </h4>
            <p className="text-xs font-bold text-slate-800 mt-0.5 leading-snug break-words">
              {error || successMessage}
            </p>
          </div>

          <button
            type="button"
            onClick={() => { setError(''); setSuccessMessage(''); }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 transition-colors cursor-pointer shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* 🏢 LEFT PANEL: FULL-HEIGHT ENTERPRISE SHOWCASE */}
      <div className="hidden lg:flex lg:w-7/12 h-screen relative p-12 xl:p-16 flex-col justify-between overflow-hidden bg-gradient-to-br from-indigo-50/80 via-slate-50 to-purple-50/60 border-r border-slate-200/80">
        
        {/* Top Branding Header */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-purple-700 text-white flex items-center justify-center shadow-xl shadow-indigo-600/25">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
            </div>
            <div className="text-left">
              <span className="text-xl font-black tracking-wider uppercase block font-outfit text-slate-900 leading-none">
                BRIHASPATHI
              </span>
              <span className="text-xs font-bold text-indigo-700 tracking-widest uppercase block mt-1">
                Enterprise Operating Platform
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-bold shadow-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span>v4.8 • Online System</span>
          </div>
        </div>

        {/* Center Main Presentation Hero */}
        <div className="relative z-10 my-auto py-6 space-y-8 text-left max-w-xl">
          
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-indigo-200 bg-white/90 text-indigo-800 text-xs font-bold uppercase tracking-wider shadow-xs backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
            <span>Unified Enterprise Workflow Management</span>
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl xl:text-5xl font-black tracking-tight text-slate-900 leading-[1.12] font-outfit">
              One Platform. <br />
              <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-800 bg-clip-text text-transparent">
                Total Enterprise Workflow.
              </span>
            </h1>
            <p className="text-sm font-semibold text-slate-600 leading-relaxed max-w-lg">
              Streamline organizational governance, operational workflows, entity hierarchies, and automated business processes across all your locations in one unified platform.
            </p>
          </div>

          {/* Feature Showcase Grid */}
          <div className="grid grid-cols-2 gap-4">
            
            <div className="p-4.5 rounded-2xl border border-slate-200/90 bg-white/90 backdrop-blur-xl shadow-xs hover:border-indigo-300 transition-all text-left">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black uppercase text-indigo-700 tracking-wider font-outfit font-bold">Enterprise Operations</span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              </div>
              <div className="text-2xl font-black text-slate-900 font-outfit">Total Control</div>
              <p className="text-xs text-slate-500 mt-1 font-medium">End-to-end organizational governance</p>
            </div>

            <div className="p-4.5 rounded-2xl border border-slate-200/90 bg-white/90 backdrop-blur-xl shadow-xs hover:border-purple-300 transition-all text-left">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black uppercase text-purple-700 tracking-wider font-outfit font-bold">Multi-Entity OS</span>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">Global</span>
              </div>
              <div className="text-2xl font-black text-slate-900 font-outfit">Scalable</div>
              <p className="text-xs text-slate-500 mt-1 font-medium">Multi-branch management & sync</p>
            </div>

          </div>

          {/* Security Assurance Badge Pill */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-slate-200/90 bg-white/90 shadow-xs backdrop-blur-md">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-600 shrink-0">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span className="text-xs font-bold text-slate-700">ISO 27001 Certified Security • 256-bit AES Encrypted Vaults</span>
          </div>

        </div>

        {/* Footer info */}
        <div className="relative z-10 flex items-center justify-between text-xs text-slate-500 pt-4 border-t border-slate-200/80">
          <span>© {new Date().getFullYear()} <strong className="text-slate-800 font-bold">Brihaspathi Technologies</strong></span>
          <span className="font-mono text-xs text-indigo-700 font-bold">Brihaspathi Enterprise</span>
        </div>

      </div>

      {/* 🔐 RIGHT PANEL: FULL HEIGHT CLEAN WHITE SIGN IN CONSOLE PANEL */}
      <div className="w-full lg:w-5/12 h-screen flex flex-col justify-between p-8 sm:p-12 xl:p-16 relative z-10 bg-white">
        
        {/* Mobile Header Logo */}
        <div className="lg:hidden flex items-center justify-between w-full pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
            </div>
            <div className="text-left">
              <span className="text-base font-black tracking-widest uppercase block font-outfit text-slate-900 leading-none">
                BRIHASPATHI
              </span>
              <span className="text-[10px] font-bold text-indigo-600 block mt-0.5">Enterprise Portal</span>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border border-emerald-300 bg-emerald-50 text-emerald-800">
            System Online
          </span>
        </div>

        {/* Form Container */}
        <div className="my-auto w-full max-w-md mx-auto py-4">
          
          <div className="text-left mb-8 space-y-2">
            <h2 className="text-3xl font-black tracking-tight text-slate-900 font-outfit">
              Welcome Back
            </h2>
            <p className="text-xs font-semibold text-slate-500">
              Sign in to access your enterprise workspace.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            
            {/* Username Field */}
            <div className="space-y-1.5 text-left">
              <label htmlFor="username" className="text-xs font-extrabold uppercase text-slate-700 tracking-wider block font-outfit">
                Username or Email <span className="text-indigo-600">*</span>
              </label>
              <div className="relative">
                <input
                  id="username"
                  type="text"
                  required
                  placeholder="e.g. employee@brihaspathi.com"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  style={{ color: '#0f172a', backgroundColor: '#ffffff' }}
                  className="login-input w-full py-3.5 px-4 rounded-xl border-2 border-slate-200 bg-white text-slate-900 font-bold text-sm outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/15 transition-all placeholder:text-slate-400 placeholder:font-medium shadow-xs"
                />
              </div>
            </div>

            {/* Password Field (EXPLICIT PURE BLACK COLOR FIX FOR TYPING & BULLETS) */}
            <div className="space-y-1.5 text-left">
              <div className="flex justify-between items-center">
                <label htmlFor="password" className="text-xs font-extrabold uppercase text-slate-700 tracking-wider block font-outfit">
                  Password <span className="text-indigo-600">*</span>
                </label>
                <a 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); alert('Please contact your HR Administrator to reset your credentials.'); }}
                  className="text-xs font-bold text-indigo-700 hover:underline transition-all"
                >
                  Forgot Password?
                </a>
              </div>
              <div className="relative flex items-center">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter your password..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ color: '#0f172a', backgroundColor: '#ffffff', WebkitTextFillColor: '#0f172a' }}
                  className="login-input w-full py-3.5 px-4 pr-12 rounded-xl border-2 border-slate-200 bg-white text-slate-900 font-bold text-sm outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/15 transition-all placeholder:text-slate-400 placeholder:font-medium shadow-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 text-slate-400 hover:text-slate-900 transition-colors cursor-pointer p-1 z-10"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 accent-indigo-600 cursor-pointer" 
                />
                <span className="text-xs font-bold text-slate-800">Keep me signed in</span>
              </label>
            </div>

            {/* Submit Button */}
            <button 
              type="submit" 
              disabled={loading} 
              className="w-full py-4 px-6 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-indigo-600/25 active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed font-outfit tracking-wide mt-2"
            >
              {loading ? (
                <div className="flex items-center gap-2.5">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Signing In...</span>
                </div>
              ) : (
                <span className="flex items-center gap-2">
                  Sign In
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </span>
              )}
            </button>

          </form>

          {/* Social SSO Options */}
          <div className="relative my-6 text-center">
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-slate-200" />
            <span className="relative px-3 font-bold text-[10px] font-outfit bg-white text-slate-400 uppercase tracking-widest">
              Or Sign In With
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {[
              { 
                name: 'Google', 
                icon: (
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.68 1.54 14.98 1 12 1 7.35 1 3.37 3.65 1.39 7.56l3.85 2.99c.9-2.7 3.4-4.51 6.76-4.51z" />
                    <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.29 1.48-1.14 2.73-2.4 3.58l3.76 2.91c2.2-2.03 3.67-5.01 3.67-8.64z" />
                    <path fill="#FBBC05" d="M5.24 14.56c-.23-.69-.36-1.43-.36-2.2s.13-1.51.36-2.2L1.39 7.17C.5 8.97 0 10.97 0 13s.5 4.03 1.39 5.83l3.85-3.27z" />
                    <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.76-2.91c-1.1.74-2.52 1.18-4.2 1.18-3.36 0-5.86-1.81-6.76-4.51L1.39 17.1C3.37 20.95 7.35 23 12 23z" />
                  </svg>
                ),
                onClick: () => router.push('/company_setup')
              },
              { 
                name: 'Apple', 
                icon: (
                  <svg className="w-4 h-4 fill-current shrink-0 text-slate-900" viewBox="0 0 24 24">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.21.67-2.93 1.49-.62.69-1.16 1.84-1.01 2.96 1.12.09 2.27-.56 2.95-1.39" />
                  </svg>
                ),
                onClick: () => alert('Apple ID SSO configured.')
              },
              { 
                name: 'Microsoft', 
                icon: (
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 23 23">
                    <path fill="#f35325" d="M0 0h11v11H0z" />
                    <path fill="#81bc06" d="M12 0h11v11H12z" />
                    <path fill="#05a6f0" d="M0 12h11v11H0z" />
                    <path fill="#ffba08" d="M12 12h11v11H12z" />
                  </svg>
                ),
                onClick: () => alert('Microsoft SSO configured.')
              }
            ].map((sso, i) => (
              <button
                key={i}
                type="button"
                onClick={sso.onClick}
                className="flex items-center justify-center gap-2 py-2.5 px-3 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 transition-all font-bold text-xs cursor-pointer shadow-xs text-slate-800 font-outfit"
              >
                {sso.icon}
                <span className="hidden sm:inline">{sso.name}</span>
              </button>
            ))}
          </div>

        </div>

        {/* Footer */}
        <footer className="text-[11px] font-semibold flex flex-col sm:flex-row items-center justify-between gap-2 text-slate-500 w-full max-w-md mx-auto pt-4 border-t border-slate-100">
          <span>© {new Date().getFullYear()} <strong className="text-slate-800">Brihaspathi Tech</strong></span>
          <div className="flex gap-3 font-medium text-slate-500">
            <a href="#" className="hover:text-indigo-700 transition-colors">Privacy Policy</a>
            <span>•</span>
            <a href="#" className="hover:text-indigo-700 transition-colors">Terms of Service</a>
          </div>
        </footer>

      </div>

      {/* Scoped CSS animations & Explicit Input Autofill Fix */}
      <style>{`
        @keyframes slide-down {
          0% { transform: translateY(-120%) translateX(-50%); opacity: 0; }
          100% { transform: translateY(0) translateX(-50%); opacity: 1; }
        }
        .animate-slide-down {
          animation: slide-down 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        div[data-login-container] input,
        div[data-login-container] input:focus,
        div[data-login-container] input:active {
          color: #0f172a !important;
          -webkit-text-fill-color: #0f172a !important;
          caret-color: #0f172a !important;
        }
        input:-webkit-autofill,
        input:-webkit-autofill:hover, 
        input:-webkit-autofill:focus {
          -webkit-text-fill-color: #0f172a !important;
          -webkit-box-shadow: 0 0 0px 1000px #ffffff inset !important;
          transition: background-color 5000s ease-in-out 0s;
        }
      `}</style>

    </div>
  );
}
