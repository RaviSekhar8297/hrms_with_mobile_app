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
        if (token) router.push('/dashboard');
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
                                 username.toLowerCase() === 'md@brihaspathi.com';
        const isTempPass = (password === '123' || password === '123456' || password.toLowerCase().includes('temp')) && !isSuperAdminUser;

        if (isTempPass) {
          router.push(`/passwordupdate?username=${encodeURIComponent(username)}&temp=${encodeURIComponent(password)}`);
        } else {
          router.push('/dashboard');
        }
      } else {
        const errMsg = data.error || 'Invalid email or password. Please try again.';
        const isTempPass = password === '123456' || password === '123' || password.toLowerCase().includes('temp');
        if ((errMsg.includes('fully set up') || errMsg.includes('temporary')) && isTempPass) {
          router.push(`/passwordupdate?username=${encodeURIComponent(username)}&temp=${encodeURIComponent(password)}`);
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
    <div 
      className="min-h-screen w-full flex flex-col lg:flex-row select-none overflow-hidden font-sans relative"
      style={{ backgroundColor: '#f1f5f9', color: '#0f172a' }}
    >
      
      {/* 🌌 AMBIENT BACKGROUND LIGHT GLOW ORBS */}
      <div className="absolute top-[-10%] left-[-10%] w-[650px] h-[650px] bg-indigo-300/40 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[700px] h-[700px] bg-purple-300/40 rounded-full blur-[160px] pointer-events-none" />

      {/* 🔔 FLOATING TOAST NOTIFICATION */}
      {(error || successMessage) && (
        <div 
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-[440px] rounded-2xl border p-4 flex items-start gap-3 bg-white shadow-2xl animate-toast-slide-down transition-all duration-300"
          style={{
            borderColor: error ? '#ef4444' : '#10b981',
            boxShadow: '0 20px 40px -10px rgba(15, 23, 42, 0.25)',
            color: '#0f172a'
          }}
        >
          <div className={`p-2 rounded-xl shrink-0 ${error ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
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

          <div className="flex-1 min-w-0 text-left pt-0.5">
            <h4 className={`text-xs font-extrabold uppercase tracking-wider ${error ? 'text-red-700' : 'text-emerald-700'}`}>
              {error ? 'Login Notice' : 'Success'}
            </h4>
            <p className="text-xs font-bold leading-relaxed mt-0.5 break-words" style={{ color: '#0f172a' }}>
              {error || successMessage}
            </p>
          </div>

          <button
            onClick={() => {
              setError('');
              setSuccessMessage('');
            }}
            className="p-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* 🌌 LEFT PANEL: CORPORATE BRAND SHOWCASE (SEAMLESS CANVAS, NO SPLIT LINE) */}
      <div className="hidden lg:flex lg:w-7/12 relative p-12 xl:p-16 flex-col justify-between overflow-hidden z-10">
        
        {/* Top Header Logo */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-700 via-indigo-600 to-purple-700 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 border border-white">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <div>
              <span className="text-xl font-black tracking-widest uppercase block leading-none font-outfit" style={{ color: '#0f172a' }}>HRMASTER</span>
              <span className="text-xs font-black tracking-widest uppercase block mt-1" style={{ color: '#4338ca' }}>Brihaspathi Technologies</span>
            </div>
          </div>

          <div 
            className="flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-extrabold shadow-sm"
            style={{ backgroundColor: '#ecfdf5', borderColor: '#a7f3d0', color: '#047857' }}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Cloud Network Live • 99.99% Uptime</span>
          </div>
        </div>

        {/* Center Hero Content */}
        <div className="relative z-10 my-auto max-w-xl text-left space-y-6">
          <div 
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-black uppercase tracking-wider shadow-xs"
            style={{ backgroundColor: '#e0e7ff', borderColor: '#c7d2fe', color: '#3730a3' }}
          >
            <span className="w-2 h-2 rounded-full bg-indigo-700 animate-ping" />
            <span>Enterprise Workforce OS</span>
          </div>

          <h1 className="text-4xl xl:text-5xl font-black tracking-tight leading-[1.15] font-outfit" style={{ color: '#0f172a' }}>
            Intelligent HR & <br />
            <span style={{ color: '#4338ca' }}>
              Automated Payroll Engine
            </span>
          </h1>

          <p className="text-sm xl:text-base font-bold leading-relaxed" style={{ color: '#1e293b' }}>
            Empowering multi-tenant corporate entities with automated statutory compliance (PF, ESI, LOP), real-time biometric attendance, and precision payroll execution.
          </p>

          {/* Key Feature Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div 
              className="p-4 rounded-2xl border-2 space-y-2 hover:border-indigo-400 transition-all shadow-md group"
              style={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1' }}
            >
              <div className="w-9 h-9 rounded-xl bg-blue-100 border border-blue-300 text-blue-800 flex items-center justify-center group-hover:scale-105 transition-transform">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <h4 className="text-xs font-black font-outfit" style={{ color: '#0f172a' }}>Statutory Payroll</h4>
              <p className="text-[11px] font-bold leading-snug" style={{ color: '#334155' }}>100% Tax, PF & ESI Compliance</p>
            </div>

            <div 
              className="p-4 rounded-2xl border-2 space-y-2 hover:border-indigo-400 transition-all shadow-md group"
              style={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1' }}
            >
              <div className="w-9 h-9 rounded-xl bg-purple-100 border border-purple-300 text-purple-800 flex items-center justify-center group-hover:scale-105 transition-transform">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <h4 className="text-xs font-black font-outfit" style={{ color: '#0f172a' }}>Multi-Tenant RBAC</h4>
              <p className="text-[11px] font-bold leading-snug" style={{ color: '#334155' }}>Granular Governance & Access</p>
            </div>

            <div 
              className="p-4 rounded-2xl border-2 space-y-2 hover:border-indigo-400 transition-all shadow-md group"
              style={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1' }}
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-800 flex items-center justify-center group-hover:scale-105 transition-transform">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <h4 className="text-xs font-black font-outfit" style={{ color: '#0f172a' }}>Biometric Sync</h4>
              <p className="text-[11px] font-bold leading-snug" style={{ color: '#334155' }}>Live Attendance & Geo Punch</p>
            </div>
          </div>
        </div>

        {/* Footer Security Badges (Cleaned up, line removed) */}
        <div className="relative z-10 flex items-center justify-between pt-4 text-xs font-bold">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-700">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span className="font-extrabold" style={{ color: '#0f172a' }}>ISO 27001 Certified • 256-bit AES Encryption</span>
          </div>
          <span 
            className="font-mono text-xs font-black px-3 py-1 rounded-lg border shadow-xs"
            style={{ color: '#3730a3', backgroundColor: '#ffffff', borderColor: '#cbd5e1' }}
          >
            v4.8.2 Enterprise
          </span>
        </div>

      </div>

      {/* 🔐 RIGHT PANEL: ULTRA-HIGH CONTRAST SIGN IN FORM */}
      <div className="w-full lg:w-5/12 flex flex-col justify-between p-5 sm:p-10 xl:p-14 relative overflow-y-auto z-10">
        
        {/* Mobile Header Logo */}
        <div className="lg:hidden flex items-center justify-between pb-4 mb-4 border-b-2" style={{ borderColor: '#cbd5e1' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-700 text-white flex items-center justify-center shadow-md">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <span className="text-base font-black tracking-widest uppercase font-outfit" style={{ color: '#0f172a' }}>HRMASTER</span>
          </div>

          <span 
            className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border"
            style={{ color: '#047857', backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }}
          >
            System Online
          </span>
        </div>

        {/* Elevated Executive Form Card Container */}
        <div 
          className="login-card w-full max-w-md mx-auto my-auto p-8 sm:p-10 rounded-3xl border-2 shadow-2xl transition-all duration-300"
          style={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1' }}
        >
          
          {/* Card Header */}
          <div className="text-left mb-8 space-y-2">
            <div 
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-black tracking-wide"
              style={{ color: '#3730a3', backgroundColor: '#e0e7ff', borderColor: '#c7d2fe' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>Secure Portal Sign In</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-black tracking-tight font-outfit pt-1" style={{ color: '#0f172a' }}>
              Welcome back
            </h2>
            <p className="text-sm font-bold" style={{ color: '#334155' }}>
              Enter your corporate credentials to access your account.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            
            {/* Email / Username Input */}
            <div className="flex flex-col text-left space-y-1.5">
              <span className="block text-xs font-black tracking-wide font-outfit" style={{ color: '#0f172a' }}>
                Email Address or Username
              </span>
              <div 
                className="flex items-center w-full px-3.5 py-3.5 rounded-xl border-2 focus-within:border-indigo-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-500/20 transition-all duration-200 shadow-xs"
                style={{ backgroundColor: '#f8fafc', borderColor: '#cbd5e1' }}
              >
                <span className="shrink-0 mr-3 flex items-center justify-center pointer-events-none" style={{ color: '#475569' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </span>
                <input
                  id="username"
                  type="text"
                  placeholder="name@company.com"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  style={{ color: '#0f172a' }}
                  className="flex-1 min-w-0 bg-transparent border-none outline-none text-sm font-extrabold placeholder:text-slate-500 focus:outline-none focus:ring-0 p-0"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="flex flex-col text-left space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="block text-xs font-black tracking-wide font-outfit" style={{ color: '#0f172a' }}>
                  Password
                </span>
                <a 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); alert('Please contact your HR Administrator to reset your credentials.'); }}
                  className="text-xs font-extrabold hover:underline transition-all"
                  style={{ color: '#3730a3' }}
                >
                  Forgot password?
                </a>
              </div>
              <div 
                className="flex items-center w-full px-3.5 py-3.5 rounded-xl border-2 focus-within:border-indigo-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-500/20 transition-all duration-200 shadow-xs"
                style={{ backgroundColor: '#f8fafc', borderColor: '#cbd5e1' }}
              >
                <span className="shrink-0 mr-3 flex items-center justify-center pointer-events-none" style={{ color: '#475569' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ color: '#0f172a' }}
                  className="flex-1 min-w-0 bg-transparent border-none outline-none text-sm font-extrabold placeholder:text-slate-500 focus:outline-none focus:ring-0 p-0"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="ml-2 hover:text-slate-900 shrink-0 flex items-center justify-center transition-colors cursor-pointer"
                  style={{ color: '#475569' }}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
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
                  className="w-4 h-4 rounded border-slate-400 text-indigo-700 accent-indigo-700 cursor-pointer bg-white" 
                />
                <span className="text-xs font-extrabold" style={{ color: '#0f172a' }}>Keep me signed in</span>
              </label>
            </div>

            {/* Submit Button */}
            <button 
              type="submit" 
              disabled={loading} 
              className="w-full py-3.5 bg-gradient-to-r from-indigo-700 via-indigo-600 to-purple-700 hover:from-indigo-600 hover:to-purple-600 text-white font-black text-sm rounded-xl shadow-lg shadow-indigo-700/30 active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed font-outfit tracking-wide mt-2"
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
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t-2" style={{ borderColor: '#cbd5e1' }} />
            <span className="relative px-3 font-bold text-xs font-outfit" style={{ backgroundColor: '#ffffff', color: '#475569' }}>
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
                  <svg className="w-4 h-4 fill-current shrink-0" style={{ color: '#0f172a' }} viewBox="0 0 24 24">
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
                className="flex items-center justify-center gap-2 py-2.5 px-3 border-2 rounded-xl bg-white hover:bg-slate-100 transition-all font-bold text-xs cursor-pointer shadow-xs font-outfit"
                style={{ borderColor: '#cbd5e1', color: '#0f172a' }}
              >
                {sso.icon}
                <span className="hidden sm:inline font-outfit">{sso.name}</span>
              </button>
            ))}
          </div>

        </div>

        {/* Footer */}
        <footer className="pt-6 text-xs font-bold flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left" style={{ color: '#334155' }}>
          <span>© {new Date().getFullYear()} <strong style={{ color: '#0f172a' }}>Brihaspathi Technologies</strong>. All rights reserved.</span>
          <div className="flex gap-4 font-bold" style={{ color: '#334155' }}>
            <a href="#" className="hover:underline transition-colors" style={{ color: '#0f172a' }}>Privacy Policy</a>
            <span>•</span>
            <a href="#" className="hover:underline transition-colors" style={{ color: '#0f172a' }}>Terms of Service</a>
          </div>
        </footer>

      </div>

      {/* Scoped CSS animation */}
      <style>{`
        @keyframes toast-slide-down {
          0% { transform: translateY(-120%) translateX(-50%); opacity: 0; }
          100% { transform: translateY(0) translateX(-50%); opacity: 1; }
        }
        .animate-toast-slide-down {
          animation: toast-slide-down 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

    </div>
  );
}
