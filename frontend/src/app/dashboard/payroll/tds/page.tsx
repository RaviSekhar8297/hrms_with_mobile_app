'use client';

import React, { useState, useMemo } from 'react';
import {
  Calculator,
  ShieldCheck,
  TrendingDown,
  Info,
  Sparkles,
  RotateCcw,
  Sliders,
  ChevronDown,
  ChevronUp,
  DollarSign,
  PieChart,
  CheckCircle2,
  Zap,
  Layers,
  ArrowRight
} from 'lucide-react';

export default function TDSCalculatorPage() {
  // Input States
  const [grossInput, setGrossInput] = useState<string>('1000000'); // Default ₹10,00,000
  const [inputFrequency, setInputFrequency] = useState<'annual' | 'monthly'>('annual');
  const [regime, setRegime] = useState<'new' | 'old'>('new');
  const [showAdvancedDeductions, setShowAdvancedDeductions] = useState<boolean>(false);

  // Old Regime Deductions
  const [sec80c, setSec80c] = useState<string>('150000'); // Default max ₹1.5L
  const [sec80d, setSec80d] = useState<string>('25000');  // Default ₹25k
  const [hraExemption, setHraExemption] = useState<string>('50000');
  const [homeLoanInterest, setHomeLoanInterest] = useState<string>('0');
  const [sec80ccd1b, setSec80ccd1b] = useState<string>('0'); // NPS max ₹50k
  const [eduAllowance, setEduAllowance] = useState<string>('2400'); // Sec 10(14) max ₹2,400 (2 children)
  const [officialAllowance, setOfficialAllowance] = useState<string>('0'); // Business duty allowance exemption

  // Numeric helper
  const parseNum = (val: string) => {
    const n = parseFloat(val.replace(/[^0-9.]/g, ''));
    return isNaN(n) ? 0 : n;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Raw Annual Gross Salary
  const rawGross = parseNum(grossInput);
  const annualGross = inputFrequency === 'monthly' ? rawGross * 12 : rawGross;

  // New Regime Computation Helper (FY 2024-25 / FY 2025-26)
  const computeNewRegimeTax = (gross: number) => {
    const stdDeduction = 75000;
    const netTaxable = Math.max(0, gross - stdDeduction);

    let taxBeforeRebate = 0;
    const slabBreakdown: { slab: string; rate: string; taxableAmt: number; taxAmt: number }[] = [];

    // Slabs
    // 0 - 3L (0%)
    const b1 = Math.min(netTaxable, 300000);
    slabBreakdown.push({ slab: '₹0 - ₹3,00,000', rate: '0%', taxableAmt: b1, taxAmt: 0 });

    // 3L - 7L (5%)
    let t2 = 0;
    if (netTaxable > 300000) {
      const b2 = Math.min(netTaxable - 300000, 400000);
      t2 = b2 * 0.05;
      taxBeforeRebate += t2;
      slabBreakdown.push({ slab: '₹3,00,001 - ₹7,00,000', rate: '5%', taxableAmt: b2, taxAmt: t2 });
    } else {
      slabBreakdown.push({ slab: '₹3,00,001 - ₹7,00,000', rate: '5%', taxableAmt: 0, taxAmt: 0 });
    }

    // 7L - 10L (10%)
    let t3 = 0;
    if (netTaxable > 700000) {
      const b3 = Math.min(netTaxable - 700000, 300000);
      t3 = b3 * 0.10;
      taxBeforeRebate += t3;
      slabBreakdown.push({ slab: '₹7,00,001 - ₹10,00,000', rate: '10%', taxableAmt: b3, taxAmt: t3 });
    } else {
      slabBreakdown.push({ slab: '₹7,00,001 - ₹10,00,000', rate: '10%', taxableAmt: 0, taxAmt: 0 });
    }

    // 10L - 12L (15%)
    let t4 = 0;
    if (netTaxable > 1000000) {
      const b4 = Math.min(netTaxable - 1000000, 200000);
      t4 = b4 * 0.15;
      taxBeforeRebate += t4;
      slabBreakdown.push({ slab: '₹10,00,001 - ₹12,00,000', rate: '15%', taxableAmt: b4, taxAmt: t4 });
    } else {
      slabBreakdown.push({ slab: '₹10,00,001 - ₹12,00,000', rate: '15%', taxableAmt: 0, taxAmt: 0 });
    }

    // 12L - 15L (20%)
    let t5 = 0;
    if (netTaxable > 1200000) {
      const b5 = Math.min(netTaxable - 1200000, 300000);
      t5 = b5 * 0.20;
      taxBeforeRebate += t5;
      slabBreakdown.push({ slab: '₹12,00,001 - ₹15,00,000', rate: '20%', taxableAmt: b5, taxAmt: t5 });
    } else {
      slabBreakdown.push({ slab: '₹12,00,001 - ₹15,00,000', rate: '20%', taxableAmt: 0, taxAmt: 0 });
    }

    // Above 15L (30%)
    let t6 = 0;
    if (netTaxable > 1500000) {
      const b6 = netTaxable - 1500000;
      t6 = b6 * 0.30;
      taxBeforeRebate += t6;
      slabBreakdown.push({ slab: 'Above ₹15,00,000', rate: '30%', taxableAmt: b6, taxAmt: t6 });
    } else {
      slabBreakdown.push({ slab: 'Above ₹15,00,000', rate: '30%', taxableAmt: 0, taxAmt: 0 });
    }

    // Section 87A Rebate (up to ₹25,000 if netTaxable <= ₹7,00,000)
    let rebate87A = 0;
    if (netTaxable <= 700000) {
      rebate87A = Math.min(taxBeforeRebate, 25000);
    }

    const taxAfterRebate = Math.max(0, taxBeforeRebate - rebate87A);
    const cess = Math.round(taxAfterRebate * 0.04);
    const totalTax = taxAfterRebate + cess;
    const monthlyTDS = Math.round(totalTax / 12);

    return {
      gross,
      stdDeduction,
      totalDeductions: stdDeduction,
      netTaxable,
      taxBeforeRebate,
      rebate87A,
      taxAfterRebate,
      cess,
      totalTax,
      monthlyTDS,
      slabBreakdown
    };
  };

  // Old Regime Computation Helper
  const computeOldRegimeTax = (gross: number) => {
    const stdDeduction = 50000;
    const c80c = Math.min(150000, parseNum(sec80c));
    const c80d = Math.min(50000, parseNum(sec80d));
    const hra = parseNum(hraExemption);
    const hlInterest = Math.min(200000, parseNum(homeLoanInterest));
    const nps = Math.min(50000, parseNum(sec80ccd1b));
    const edu = Math.min(2400, parseNum(eduAllowance));
    const offDuty = parseNum(officialAllowance);

    const totalDeductions = stdDeduction + c80c + c80d + hra + hlInterest + nps + edu + offDuty;
    const netTaxable = Math.max(0, gross - totalDeductions);

    let taxBeforeRebate = 0;
    const slabBreakdown: { slab: string; rate: string; taxableAmt: number; taxAmt: number }[] = [];

    // 0 - 2.5L (0%)
    const b1 = Math.min(netTaxable, 250000);
    slabBreakdown.push({ slab: '₹0 - ₹2,50,000', rate: '0%', taxableAmt: b1, taxAmt: 0 });

    // 2.5L - 5L (5%)
    let t2 = 0;
    if (netTaxable > 250000) {
      const b2 = Math.min(netTaxable - 250000, 250000);
      t2 = b2 * 0.05;
      taxBeforeRebate += t2;
      slabBreakdown.push({ slab: '₹2,50,001 - ₹5,00,000', rate: '5%', taxableAmt: b2, taxAmt: t2 });
    } else {
      slabBreakdown.push({ slab: '₹2,50,001 - ₹5,00,000', rate: '5%', taxableAmt: 0, taxAmt: 0 });
    }

    // 5L - 10L (20%)
    let t3 = 0;
    if (netTaxable > 500000) {
      const b3 = Math.min(netTaxable - 500000, 500000);
      t3 = b3 * 0.20;
      taxBeforeRebate += t3;
      slabBreakdown.push({ slab: '₹5,00,001 - ₹10,00,000', rate: '20%', taxableAmt: b3, taxAmt: t3 });
    } else {
      slabBreakdown.push({ slab: '₹5,00,001 - ₹10,00,000', rate: '20%', taxableAmt: 0, taxAmt: 0 });
    }

    // Above 10L (30%)
    let t4 = 0;
    if (netTaxable > 1000000) {
      const b4 = netTaxable - 1000000;
      t4 = b4 * 0.30;
      taxBeforeRebate += t4;
      slabBreakdown.push({ slab: 'Above ₹10,00,000', rate: '30%', taxableAmt: b4, taxAmt: t4 });
    } else {
      slabBreakdown.push({ slab: 'Above ₹10,00,000', rate: '30%', taxableAmt: 0, taxAmt: 0 });
    }

    // Section 87A Rebate (up to ₹12,500 if netTaxable <= ₹5,00,000)
    let rebate87A = 0;
    if (netTaxable <= 500000) {
      rebate87A = Math.min(taxBeforeRebate, 12500);
    }

    const taxAfterRebate = Math.max(0, taxBeforeRebate - rebate87A);
    const cess = Math.round(taxAfterRebate * 0.04);
    const totalTax = taxAfterRebate + cess;
    const monthlyTDS = Math.round(totalTax / 12);

    return {
      gross,
      stdDeduction,
      totalDeductions,
      netTaxable,
      taxBeforeRebate,
      rebate87A,
      taxAfterRebate,
      cess,
      totalTax,
      monthlyTDS,
      slabBreakdown
    };
  };

  const newRegimeRes = useMemo(() => computeNewRegimeTax(annualGross), [annualGross]);
  const oldRegimeRes = useMemo(
    () => computeOldRegimeTax(annualGross),
    [annualGross, sec80c, sec80d, hraExemption, homeLoanInterest, sec80ccd1b, eduAllowance, officialAllowance]
  );

  const activeRes = regime === 'new' ? newRegimeRes : oldRegimeRes;

  const savingsDifference = Math.abs(newRegimeRes.totalTax - oldRegimeRes.totalTax);
  const recommendedRegime = newRegimeRes.totalTax <= oldRegimeRes.totalTax ? 'new' : 'old';

  const monthlyTakeHome = Math.max(0, Math.round((annualGross / 12) - activeRes.monthlyTDS));

  return (
    <div className="w-full space-y-6 pb-24 text-left animate-fadeIn font-sans">
      
      {/* SLEEK TOP HEADER */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 text-[11px] font-extrabold font-mono tracking-wider border border-indigo-200/60 dark:border-indigo-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>TAX COMPUTATION ENGINE</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10.5px] font-bold font-mono border border-emerald-200/60 dark:border-emerald-800">
                FY 2024-25 & 2025-26
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-outfit tracking-tight">
              TDS Tax Deduction & Regime Calculator
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-normal">
              Calculate exact monthly TDS deductions, slab-by-slab breakdown, and compare Old vs New Tax Regimes instantly.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setGrossInput('1000000');
              setRegime('new');
              setInputFrequency('annual');
              setSec80c('150000');
              setSec80d('25000');
              setHraExemption('50000');
              setHomeLoanInterest('0');
              setSec80ccd1b('0');
              setEduAllowance('2400');
              setOfficialAllowance('0');
            }}
            className="px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-slate-500" />
            <span>Reset Inputs</span>
          </button>
        </div>
      </div>

      {/* TWO COLUMN DASHBOARD GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: INPUT CONTROLS (5/12) */}
        <div className="lg:col-span-5 space-y-6">

          {/* SALARY DETAILS CARD */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
              <h2 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider font-outfit flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>1. Salary Inputs</span>
              </h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                STEP 1
              </span>
            </div>

            {/* Income Frequency Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Salary Input Mode
              </label>
              <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/70 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setInputFrequency('annual')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    inputFrequency === 'annual'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Annual CTC / Gross
                </button>
                <button
                  type="button"
                  onClick={() => setInputFrequency('monthly')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    inputFrequency === 'monthly'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Monthly Gross
                </button>
              </div>
            </div>

            {/* Gross Salary Input */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>{inputFrequency === 'annual' ? 'Gross Annual Salary (CTC)' : 'Gross Monthly Salary'}</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-mono font-extrabold">
                  {formatCurrency(rawGross)}
                </span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 font-black text-sm font-mono">
                  ₹
                </span>
                <input
                  type="text"
                  value={grossInput}
                  onChange={(e) => setGrossInput(e.target.value)}
                  placeholder="1000000"
                  className="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white font-extrabold text-base focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-mono shadow-2xs"
                />
              </div>
              {inputFrequency === 'monthly' && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium pt-1">
                  Equivalent Annual Gross: <strong className="text-slate-800 dark:text-slate-200 font-mono">{formatCurrency(annualGross)}</strong>
                </p>
              )}
            </div>

            {/* Quick Presets */}
            <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
              <label className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                Quick Presets:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {['500000', '750000', '1000000', '1250000', '1500000', '2000000'].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      setInputFrequency('annual');
                      setGrossInput(amt);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all border cursor-pointer ${
                      annualGross === parseFloat(amt)
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    ₹{(parseFloat(amt) / 100000).toFixed(1)}L
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* TAX REGIME SELECTION CARD */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
              <h2 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider font-outfit flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>2. Tax Regime Selection</span>
              </h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                STEP 2
              </span>
            </div>

            {/* Regime Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* New Regime Card */}
              <div
                onClick={() => setRegime('new')}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer space-y-2.5 relative ${
                  regime === 'new'
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 bg-slate-50/40 dark:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-indigo-950 dark:text-indigo-200 uppercase">
                    New Regime
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[9px] font-bold font-mono">
                    DEFAULT
                  </span>
                </div>
                <p className="text-[11.5px] text-slate-600 dark:text-slate-400 leading-snug font-medium">
                  Lower Tax Slabs + ₹75,000 Std Deduction. Zero Tax up to ₹7.75L Gross!
                </p>
                <div className="text-xs font-black font-mono text-indigo-600 dark:text-indigo-400 pt-1 border-t border-indigo-100 dark:border-indigo-900/60">
                  Est. TDS: {formatCurrency(newRegimeRes.monthlyTDS)}/mo
                </div>
              </div>

              {/* Old Regime Card */}
              <div
                onClick={() => setRegime('old')}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer space-y-2.5 relative ${
                  regime === 'old'
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 bg-slate-50/40 dark:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase">
                    Old Regime
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[9px] font-bold font-mono">
                    INVESTMENTS
                  </span>
                </div>
                <p className="text-[11.5px] text-slate-600 dark:text-slate-400 leading-snug font-medium">
                  Allows 80C, 80D, HRA, Home Loan Interest deductions + ₹50k Std Deduction.
                </p>
                <div className="text-xs font-black font-mono text-slate-800 dark:text-slate-200 pt-1 border-t border-slate-200 dark:border-slate-700">
                  Est. TDS: {formatCurrency(oldRegimeRes.monthlyTDS)}/mo
                </div>
              </div>
            </div>

            {/* OLD REGIME EXPANDABLE DEDUCTIONS */}
            {regime === 'old' && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <button
                  type="button"
                  onClick={() => setShowAdvancedDeductions(!showAdvancedDeductions)}
                  className="flex items-center justify-between w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-indigo-500" />
                    <span>Customize Old Regime Deductions & Exemptions</span>
                  </span>
                  {showAdvancedDeductions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showAdvancedDeductions && (
                  <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3 animate-fadeIn">
                    {/* Section 80C */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                        <span>Section 80C (EPF, PPF, LIC, ELSS, School Fee)</span>
                        <span className="text-slate-400 text-[10px]">Max ₹1.5L</span>
                      </label>
                      <input
                        type="text"
                        value={sec80c}
                        onChange={(e) => setSec80c(e.target.value)}
                        placeholder="150000"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold font-mono"
                      />
                    </div>

                    {/* Section 80D */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                        <span>Section 80D (Health Insurance Premium)</span>
                        <span className="text-slate-400 text-[10px]">Max ₹50k</span>
                      </label>
                      <input
                        type="text"
                        value={sec80d}
                        onChange={(e) => setSec80d(e.target.value)}
                        placeholder="25000"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold font-mono"
                      />
                    </div>

                    {/* HRA Exemption */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        HRA Exemption Amount
                      </label>
                      <input
                        type="text"
                        value={hraExemption}
                        onChange={(e) => setHraExemption(e.target.value)}
                        placeholder="50000"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold font-mono"
                      />
                    </div>

                    {/* Home Loan Interest Sec 24B */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                        <span>Home Loan Interest (Sec 24B)</span>
                        <span className="text-slate-400 text-[10px]">Max ₹2L</span>
                      </label>
                      <input
                        type="text"
                        value={homeLoanInterest}
                        onChange={(e) => setHomeLoanInterest(e.target.value)}
                        placeholder="0"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold font-mono"
                      />
                    </div>

                    {/* Children Education Allowance Sec 10(14) */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                        <span>Children Education Allowance (Sec 10(14))</span>
                        <span className="text-slate-400 text-[10px]">Max ₹2,400</span>
                      </label>
                      <input
                        type="text"
                        value={eduAllowance}
                        onChange={(e) => setEduAllowance(e.target.value)}
                        placeholder="2400"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold font-mono"
                      />
                    </div>

                    {/* Business / Official Duty Allowance */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                        <span>Official Business Conveyance / Duty Allowance</span>
                        <span className="text-emerald-600 text-[10px] font-bold">Exempt</span>
                      </label>
                      <input
                        type="text"
                        value={officialAllowance}
                        onChange={(e) => setOfficialAllowance(e.target.value)}
                        placeholder="0"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: COMPUTATION & SLAB BREAKDOWN (7/12) */}
        <div className="lg:col-span-7 space-y-6">

          {/* MAIN SUMMARY STAT CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* MONTHLY TDS CARD */}
            <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-blue-700 rounded-3xl p-5 text-white shadow-md space-y-2 relative overflow-hidden">
              <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-100 flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-indigo-200" />
                <span>Monthly TDS Cut</span>
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight">
                {formatCurrency(activeRes.monthlyTDS)}
              </div>
              <p className="text-[11px] text-indigo-100/90 font-medium">
                Deducted every month from salary
              </p>
            </div>

            {/* TOTAL ANNUAL TAX CARD */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-500" />
                <span>Annual Income Tax</span>
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white tracking-tight">
                {formatCurrency(activeRes.totalTax)}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Includes 4% Health & Cess
              </p>
            </div>

            {/* ESTIMATED TAKE HOME CARD */}
            <div className="bg-emerald-50/90 dark:bg-emerald-950/40 rounded-3xl border border-emerald-200/80 dark:border-emerald-800/70 p-5 shadow-xs space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4 text-emerald-600" />
                <span>Est. In-Hand Pay</span>
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-900 dark:text-emerald-100 tracking-tight">
                {formatCurrency(monthlyTakeHome)}
              </div>
              <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 font-medium">
                Est. Monthly after TDS
              </p>
            </div>
          </div>

          {/* RECOMMENDATION ALERT BANNER */}
          <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent rounded-2xl border border-amber-500/30 p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 font-bold text-base">
                💡
              </div>
              <div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-semibold">
                <span>Recommendation: </span>
                <strong className="text-amber-700 dark:text-amber-300 uppercase font-bold">
                  {recommendedRegime === 'new' ? 'New Tax Regime' : 'Old Tax Regime'}
                </strong>{' '}
                saves you{' '}
                <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
                  {formatCurrency(savingsDifference)}/year
                </span>{' '}
                in tax!
              </div>
            </div>
          </div>

          {/* SLAB BY SLAB COMPUTATION CARD */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
              <h3 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider font-outfit flex items-center gap-2">
                <PieChart className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Slab-by-Slab Tax Computation ({regime === 'new' ? 'New Regime' : 'Old Regime'})</span>
              </h3>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                INCOME TAX ACT
              </span>
            </div>

            {/* COMPUTATION SUMMARY PILLS */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold">
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Gross Annual</span>
                <span className="font-mono font-extrabold text-slate-900 dark:text-white">{formatCurrency(annualGross)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Total Deductions</span>
                <span className="font-mono font-extrabold text-rose-600 dark:text-rose-400">- {formatCurrency(activeRes.totalDeductions)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Net Taxable Income</span>
                <span className="font-mono font-extrabold text-indigo-600 dark:text-indigo-400">{formatCurrency(activeRes.netTaxable)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Sec 87A Rebate</span>
                <span className="font-mono font-extrabold text-emerald-600 dark:text-emerald-400">{activeRes.rebate87A > 0 ? `- ${formatCurrency(activeRes.rebate87A)}` : '₹0'}</span>
              </div>
            </div>

            {/* SLAB TABLE */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Income Slab</th>
                    <th className="py-2.5 px-3">Tax Rate</th>
                    <th className="py-2.5 px-3">Taxable Amount</th>
                    <th className="py-2.5 px-3 text-right">Tax Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium">
                  {activeRes.slabBreakdown.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">{row.slab}</td>
                      <td className="py-3 px-3">
                        <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-mono font-extrabold text-[10.5px] border border-indigo-200/60 dark:border-indigo-800">
                          {row.rate}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400">{formatCurrency(row.taxableAmt)}</td>
                      <td className="py-3 px-3 text-right font-mono font-extrabold text-slate-900 dark:text-white">
                        {formatCurrency(row.taxAmt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-slate-200 dark:border-slate-700 font-extrabold text-slate-900 dark:text-white">
                  <tr>
                    <td colSpan={3} className="py-3 px-3 text-slate-500 dark:text-slate-400">Total Tax Before Cess</td>
                    <td className="py-3 px-3 text-right font-mono">{formatCurrency(activeRes.taxBeforeRebate)}</td>
                  </tr>
                  {activeRes.rebate87A > 0 && (
                    <tr className="text-emerald-600 dark:text-emerald-400">
                      <td colSpan={3} className="py-2 px-3">Less: Sec 87A Tax Rebate (Full Exemption)</td>
                      <td className="py-2 px-3 text-right font-mono">- {formatCurrency(activeRes.rebate87A)}</td>
                    </tr>
                  )}
                  <tr>
                    <td colSpan={3} className="py-2 px-3 text-slate-500 dark:text-slate-400">Add: 4% Health & Education Cess</td>
                    <td className="py-2 px-3 text-right font-mono">{formatCurrency(activeRes.cess)}</td>
                  </tr>
                  <tr className="bg-indigo-50/70 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-100 text-sm">
                    <td colSpan={3} className="py-3.5 px-3 font-black">Final Annual Income Tax Payable</td>
                    <td className="py-3.5 px-3 text-right font-mono font-black text-indigo-600 dark:text-indigo-400">
                      {formatCurrency(activeRes.totalTax)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* EXPLANATORY NOTE CARD */}
          <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-4 space-y-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
              <Info className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>How TDS is Deducted Monthly:</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11.5px]">
              TDS (Section 192 of Income Tax Act) is calculated by estimating the total annual income tax based on the chosen Regime and dividing it into 12 equal monthly installments deducted from your gross salary.
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}
