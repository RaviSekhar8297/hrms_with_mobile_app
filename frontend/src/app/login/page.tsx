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
  const [isUsernameFocused, setIsUsernameFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    
    // Force light mode on document.documentElement for login page so dark classes don't mess up text
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
      const res = await fetch('http://localhost:5000/api/v1/auth/login', {
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
    <div className="min-h-screen w-full flex flex-col lg:flex-row select-none overflow-hidden font-sans relative bg-gradient-to-br from-amber-50/70 via-slate-50 to-indigo-50/60 text-slate-900">
      
      {/* 🌌 ELEGANT SOFT AMBIENT LIGHT ORBS */}
      <div className="absolute top-[-10%] left-[-10%] w-[650px] h-[650px] bg-indigo-200/40 rounded-full blur-[140px] pointer-events-none animate-pulse-slow" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[700px] h-[700px] bg-purple-200/35 rounded-full blur-[150px] pointer-events-none animate-pulse-slow" />
      <div className="absolute top-[40%] left-[25%] w-[450px] h-[450px] bg-amber-200/30 rounded-full blur-[130px] pointer-events-none" />

      {/* 🔔 FLOATING TOAST NOTIFICATION */}
      {(error || successMessage) && (
        <div 
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-[440px] rounded-2xl p-4 flex items-center gap-3.5 shadow-2xl backdrop-blur-xl transition-all duration-300 animate-toast-slide-down"
          style={{
            backgroundColor: '#ffffff',
            border: error ? '1px solid #fecdd3' : '1px solid #a7f3d0',
            boxShadow: error ? '0 20px 40px -10px rgba(225, 29, 72, 0.2)' : '0 20px 40px -10px rgba(16, 185, 129, 0.2)',
            color: '#0f172a'
          }}
        >
          <div 
            style={{
              backgroundColor: error ? '#e11d48' : '#059669',
              color: '#ffffff',
              padding: '10px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: error ? '0 4px 12px rgba(225, 29, 72, 0.3)' : '0 4px 12px rgba(5, 150, 105, 0.3)',
              flexShrink: 0
            }}
          >
            {error ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>

          <div className="flex-1 min-w-0 text-left">
            <h4 
              style={{
                color: error ? '#e11d48' : '#059669',
                fontSize: '11px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                margin: 0
              }}
            >
              {error ? 'LOGIN NOTICE' : 'SUCCESS'}
            </h4>
            <p 
              style={{
                color: '#0f172a',
                fontSize: '13px',
                fontWeight: 700,
                lineHeight: 1.4,
                marginTop: '2px',
                margin: 0,
                wordBreak: 'break-word'
              }}
            >
              {error || successMessage}
            </p>
          </div>

          <button
            onClick={() => {
              setError('');
              setSuccessMessage('');
            }}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#64748b',
              padding: '6px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* 🌌 LEFT PANEL: ELEGANT WHITE & CREAM HERO SHOWCASE */}
      <div className="hidden lg:flex lg:w-1/2 relative p-12 xl:p-16 flex-col justify-between overflow-hidden z-10">
        
        {/* Top Header Logo */}
        <div className="relative z-10 flex items-center justify-between animate-fade-in-down">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-purple-700 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <div>
              <span className="text-xl font-black tracking-widest uppercase block leading-none font-outfit text-slate-900">HRMASTER</span>
              <span className="text-xs font-bold tracking-widest uppercase block mt-1 text-indigo-700">Brihaspathi Technologies</span>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-extrabold shadow-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span>v4.8 Enterprise • Operational</span>
          </div>
        </div>

        {/* Center Hero Section */}
        <div className="relative z-10 my-auto py-8 space-y-8 animate-fade-in-up">
          
          {/* Main Headline Badge */}
          <div className="space-y-4 text-left">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-800 text-xs font-black uppercase tracking-wider shadow-xs">
              <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
              <span>Enterprise Workforce OS</span>
            </div>

            <h1 className="text-4xl xl:text-5xl font-black tracking-tight leading-[1.15] font-outfit text-slate-900">
              Next-Gen Workforce <br />
              <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-800 bg-clip-text text-transparent">
                Intelligence & Payroll
              </span>
            </h1>

            <p className="text-sm xl:text-base font-semibold text-slate-600 max-w-lg leading-relaxed">
              Empowering enterprise organizations with automated statutory compliance, real-time biometric attendance tracking, and instant multi-tenant payroll processing.
            </p>
          </div>

          {/* Feature Cards */}
          <div className="space-y-4">
            
            {/* Feature Card 1 */}
            <div className="p-4 rounded-2xl border border-slate-200/90 bg-white/90 backdrop-blur-xl flex items-center justify-between hover:border-indigo-400 hover:shadow-lg transition-all duration-300 hover:scale-[1.01] shadow-xs group">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0 shadow-xs group-hover:bg-indigo-600 group-hover:text-white transition-all">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 font-outfit">Automated Payroll Engine</h4>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">100% Tax, PF, ESI & LOP precision compliance</p>
                </div>
              </div>
              <span className="text-xs font-black px-3 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">Auto</span>
            </div>

            {/* Feature Card 2 */}
            <div className="p-4 rounded-2xl border border-slate-200/90 bg-white/90 backdrop-blur-xl flex items-center justify-between hover:border-purple-400 hover:shadow-lg transition-all duration-300 hover:scale-[1.01] shadow-xs group">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 flex items-center justify-center shrink-0 shadow-xs group-hover:bg-purple-600 group-hover:text-white transition-all">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 font-outfit">Biometric & Geo Sync</h4>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">Real-time attendance stream & shift logs</p>
                </div>
              </div>
              <span className="text-xs font-black px-3 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-200">Live</span>
            </div>

            {/* Feature Card 3 */}
            <div className="p-4 rounded-2xl border border-slate-200/90 bg-white/90 backdrop-blur-xl flex items-center justify-between hover:border-emerald-400 hover:shadow-lg transition-all duration-300 hover:scale-[1.01] shadow-xs group">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0 shadow-xs group-hover:bg-emerald-600 group-hover:text-white transition-all">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 font-outfit">Multi-Tenant RBAC Security</h4>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">Granular governance & encrypted data access</p>
                </div>
              </div>
              <span className="text-xs font-black px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">Secure</span>
            </div>

          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-3 gap-3.5 pt-2">
            <div className="p-4 rounded-2xl border border-slate-200 bg-white/90 backdrop-blur-xl text-center shadow-xs">
              <span className="text-xl xl:text-2xl font-black text-indigo-700 font-outfit block">99.99%</span>
              <span className="text-xs font-bold text-slate-500 mt-1 block">System Uptime</span>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 bg-white/90 backdrop-blur-xl text-center shadow-xs">
              <span className="text-xl xl:text-2xl font-black text-purple-700 font-outfit block">100%</span>
              <span className="text-xs font-bold text-slate-500 mt-1 block">Statutory Tax</span>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 bg-white/90 backdrop-blur-xl text-center shadow-xs">
              <span className="text-xl xl:text-2xl font-black text-emerald-700 font-outfit block">Realtime</span>
              <span className="text-xs font-bold text-slate-500 mt-1 block">Punch Sync</span>
            </div>
          </div>

        </div>

        {/* Footer Security Info */}
        <div className="relative z-10 flex items-center justify-between text-xs text-slate-500 pt-4 border-t border-slate-200/80">
          <div className="flex items-center gap-2">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-600">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span className="font-bold text-slate-700">ISO 27001 Certified • 256-bit AES Encryption</span>
          </div>
          <span className="font-mono text-xs font-black text-indigo-700">Brihaspathi Tech</span>
        </div>

      </div>

      {/* 🔐 RIGHT PANEL: SIGN IN FORM CONTAINER */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 sm:p-12 xl:p-16 relative z-10 my-auto min-h-screen">
        
        {/* Mobile Header Logo */}
        <div className="lg:hidden flex items-center justify-between w-full max-w-md pb-6 mb-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <div>
              <span className="text-base font-black tracking-widest uppercase font-outfit text-slate-900">HRMASTER</span>
              <span className="text-[10px] font-bold text-indigo-600 block">Brihaspathi Tech</span>
            </div>
          </div>

          <span className="text-[10px] font-extrabold uppercase px-3 py-1 rounded-full border border-emerald-300 bg-emerald-50 text-emerald-800">
            System Online
          </span>
        </div>

        {/* Elevated Sign In Card Container (Clean Single-Border Design) */}
        <div className="login-card w-full max-w-md p-8 sm:p-10 rounded-3xl border border-slate-200/90 bg-white/95 backdrop-blur-2xl shadow-[0_20px_60px_-15px_rgba(15,23,42,0.08)] transition-all duration-300 animate-fade-in-up">
          
          {/* Card Header */}
          <div className="text-left mb-8 space-y-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-800 text-xs font-black tracking-wide">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>Secure Portal Access</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-black tracking-tight font-outfit text-slate-900 pt-1">
              Welcome back
            </h2>
            <p className="text-sm font-semibold text-slate-500">
              Enter your corporate credentials to access your console.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            
            {/* Username Input with Floating Notch Label */}
            <div className="relative w-full pt-1.5">
              <input
                id="username"
                type="text"
                placeholder=""
                value={username}
                onFocus={() => setIsUsernameFocused(true)}
                onBlur={() => setIsUsernameFocused(false)}
                onChange={(e) => setUsername(e.target.value)}
                className="login-input peer w-full px-4 py-3.5 rounded-xl border-2 border-slate-400 bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/20 text-sm font-bold text-slate-900 outline-none transition-all duration-200 shadow-sm"
              />
              <label
                htmlFor="username"
                style={{ marginBottom: 0, marginTop: 0 }}
                className={`absolute left-3.5 transition-all duration-200 pointer-events-none px-1.5 bg-white font-bold rounded-md z-10 ${
                  isUsernameFocused || username
                    ? '-top-2 text-xs text-indigo-600 font-black'
                    : 'top-5 -translate-y-1/2 text-sm text-slate-500 font-semibold'
                }`}
              >
                Username
              </label>
            </div>

            {/* Password Input with Floating Notch Label */}
            <div className="flex flex-col text-left space-y-1">
              <div className="flex justify-end items-center pr-1">
                <a 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); alert('Please contact your HR Administrator to reset your credentials.'); }}
                  className="text-xs font-bold text-indigo-700 hover:underline transition-all"
                >
                  Forgot password?
                </a>
              </div>
              <div className="relative w-full pt-1">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder=""
                  value={password}
                  onFocus={() => setIsPasswordFocused(true)}
                  onBlur={() => setIsPasswordFocused(false)}
                  onChange={(e) => setPassword(e.target.value)}
                  className="login-input peer w-full pl-4 pr-11 py-3.5 rounded-xl border-2 border-slate-400 bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/20 text-sm font-bold text-slate-900 outline-none transition-all duration-200 shadow-sm"
                />
                <label
                  htmlFor="password"
                  style={{ marginBottom: 0, marginTop: 0 }}
                  className={`absolute left-3.5 transition-all duration-200 pointer-events-none px-1.5 bg-white font-bold rounded-md z-10 ${
                    isPasswordFocused || password
                      ? '-top-2 text-xs text-indigo-600 font-black'
                      : 'top-5 -translate-y-1/2 text-sm text-slate-500 font-semibold'
                  }`}
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-[52%] -translate-y-1/2 text-slate-400 hover:text-slate-900 shrink-0 flex items-center justify-center transition-colors cursor-pointer z-20"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
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
              className="w-full py-3.5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white font-black text-sm rounded-xl shadow-lg shadow-indigo-600/25 active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed font-outfit tracking-wide mt-2"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Authenticating...</span>
                </div>
              ) : (
                <span className="flex items-center gap-2">
                  Sign In to Console
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </span>
              )}
            </button>
          </form>

          {/* SSO Divider */}
          <div className="relative my-7 text-center">
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-slate-200" />
            <span className="relative px-3 font-bold text-xs font-outfit bg-white text-slate-400">
              Or sign in with SSO
            </span>
          </div>

          {/* SSO Buttons */}
          <div className="grid grid-cols-3 gap-3">
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
                <span className="hidden sm:inline font-outfit">{sso.name}</span>
              </button>
            ))}
          </div>

        </div>

        {/* Footer */}
        <footer className="pt-8 text-xs font-bold flex flex-col sm:flex-row items-center justify-between gap-2 text-center text-slate-500 w-full max-w-md">
          <span>© {new Date().getFullYear()} <strong className="text-slate-900">Brihaspathi Technologies</strong></span>
          <div className="flex gap-4 font-bold text-slate-500">
            <a href="#" className="hover:text-indigo-700 transition-colors">Privacy Policy</a>
            <span>•</span>
            <a href="#" className="hover:text-indigo-700 transition-colors">Terms of Service</a>
          </div>
        </footer>

      </div>

      {/* Scoped CSS animations & Autofill Fix */}
      <style>{`
        @keyframes toast-slide-down {
          0% { transform: translateY(-120%) translateX(-50%); opacity: 0; }
          100% { transform: translateY(0) translateX(-50%); opacity: 1; }
        }
        @keyframes fade-in-up {
          0% { transform: translateY(16px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes fade-in-down {
          0% { transform: translateY(-16px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes pulse-slow {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.08); opacity: 0.5; }
        }
        .animate-toast-slide-down {
          animation: toast-slide-down 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-fade-in-down {
          animation: fade-in-down 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-pulse-slow {
          animation: pulse-slow 8s infinite ease-in-out;
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
