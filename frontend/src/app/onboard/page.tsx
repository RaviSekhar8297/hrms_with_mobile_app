'use client';

import React, { useState } from 'react';

export default function CandidateOnboardingPortal() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Candidate Input Fields
  const [panNumber, setPanNumber] = useState('');
  const [aadharNumber, setAadharNumber] = useState('');
  const [currentAddress, setCurrentAddress] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [emergencyRel, setEmergencyRel] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4 font-sans">
      <div className="max-w-xl w-full bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
        
        {/* Glow backdrop */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {submitted ? (
          <div className="py-12 text-center space-y-4 animate-fadeIn">
            <span className="text-5xl inline-block mb-2">🎉</span>
            <h2 className="text-2xl font-extrabold text-white font-outfit">Onboarding Details Submitted!</h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              Thank you for submitting your verification details and bank account information. The HR team is reviewing your documents and will issue your employee login credentials shortly.
            </p>
            <div className="pt-4">
              <span className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-extrabold text-xs rounded-xl inline-block">
                ✓ Document Verification in Progress
              </span>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
            
            {/* Header */}
            <div className="border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  CANDIDATE SELF-SERVICE
                </span>
              </div>
              <h2 className="text-xl font-black text-white mt-2 font-outfit">Welcome to Employee Onboarding</h2>
              <p className="text-xs text-slate-400 mt-1">Please fill in your details below to complete your pre-joining verification.</p>
            </div>

            {/* Compliance Info */}
            <div className="space-y-4">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-400">1. Verification Identifiers</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">PAN Card Number</label>
                  <input
                    type="text"
                    required
                    placeholder="ABCDE1234F"
                    value={panNumber}
                    onChange={(e) => setPanNumber(e.target.value)}
                    className="w-full text-xs font-mono font-bold px-3 py-2.5 rounded-xl border border-slate-800 bg-slate-900 focus:border-indigo-500 outline-none text-white placeholder:text-slate-600"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Aadhaar Card Number</label>
                  <input
                    type="text"
                    required
                    placeholder="12-digit Aadhaar Number"
                    value={aadharNumber}
                    onChange={(e) => setAadharNumber(e.target.value)}
                    className="w-full text-xs font-mono font-bold px-3 py-2.5 rounded-xl border border-slate-800 bg-slate-900 focus:border-indigo-500 outline-none text-white placeholder:text-slate-600"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Current Residential Address</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Street, City, State, Pincode"
                  value={currentAddress}
                  onChange={(e) => setCurrentAddress(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-800 bg-slate-900 focus:border-indigo-500 outline-none text-white placeholder:text-slate-600 resize-none"
                />
              </div>
            </div>

            {/* Bank Info */}
            <div className="space-y-4 pt-2 border-t border-slate-800">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-400">2. Salary Disbursement Bank Account</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Bank Name</label>
                  <input
                    type="text"
                    required
                    placeholder="HDFC, ICICI, SBI, etc."
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-800 bg-slate-900 focus:border-indigo-500 outline-none text-white placeholder:text-slate-600"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Account Number</label>
                  <input
                    type="text"
                    required
                    placeholder="Account Number"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="w-full text-xs font-mono font-bold px-3 py-2.5 rounded-xl border border-slate-800 bg-slate-900 focus:border-indigo-500 outline-none text-white placeholder:text-slate-600"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">IFSC Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. HDFC0001234"
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value)}
                    className="w-full text-xs font-mono font-bold px-3 py-2.5 rounded-xl border border-slate-800 bg-slate-900 focus:border-indigo-500 outline-none text-white placeholder:text-slate-600"
                  />
                </div>
              </div>
            </div>

            {/* Emergency Contacts */}
            <div className="space-y-4 pt-2 border-t border-slate-800">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-400">3. Emergency Contact Person</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Contact Name"
                    value={emergencyName}
                    onChange={(e) => setEmergencyName(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-800 bg-slate-900 focus:border-indigo-500 outline-none text-white placeholder:text-slate-600"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Relationship</label>
                  <input
                    type="text"
                    required
                    placeholder="Father, Spouse, etc."
                    value={emergencyRel}
                    onChange={(e) => setEmergencyRel(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-800 bg-slate-900 focus:border-indigo-500 outline-none text-white placeholder:text-slate-600"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Phone Number</label>
                  <input
                    type="text"
                    required
                    placeholder="Phone"
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-800 bg-slate-900 focus:border-indigo-500 outline-none text-white placeholder:text-slate-600"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4 border-t border-slate-800">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl transition-all shadow-lg shadow-indigo-600/25 cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Submitting Details...' : '✨ Submit Verification Details'}
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
}
