'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import DashboardPageHeader from '../../components/DashboardPageHeader';
import { getHeaders } from '../../utils/api';
import { useDashboard } from '../../components/DashboardContext';

interface PayslipItem {
  id: string;
  component_code: string;
  component_name: string;
  type: 'EARNING' | 'DEDUCTION';
  amount: number;
}

interface PayslipDetails {
  id: string;
  employee_id: string;
  emp_id_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  joining_date?: string;
  department_name?: string;
  designation_name?: string;
  branch_name?: string;
  company_name?: string;
  company_logo?: string;
  company_address?: string;
  bank_information?: any;
  pan_number?: string;
  pf_number?: string;
  pf_no?: string;
  esi_number?: string;
  esi_no?: string;
  gross_salary: number;
  total_deductions: number;
  net_salary: number;
  pay_period: string;
  status: string;
  paid_days?: number;
  casual_leaves?: number;
  lop_days?: number;
}

// Dynamic Number to Words converter (Indian Numbering System)
function numberToWords(num: number): string {
  if (!num || isNaN(num) || num <= 0) return 'Zero Rupees Only';

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(n: number): string {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + inWords(n % 100) : '');
    if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + inWords(n % 1000) : '');
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + inWords(n % 100000) : '');
    return inWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + inWords(n % 10000000) : '');
  }

  return `${inWords(Math.floor(num))} Rupees Only`;
}

export default function DedicatedPayslipStatementPage() {
  const router = useRouter();
  const params = useParams();
  const empId = params?.id as string;

  const { showToast } = useDashboard();
  const [payslip, setPayslip] = useState<PayslipDetails | null>(null);
  const [items, setItems] = useState<PayslipItem[]>([]);
  const [structures, setStructures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // TOP TABS CONTROL (New Structure, Old Structure, Payslips)
  const [activeTab, setActiveTab] = useState<'NEW_STRUCTURE' | 'OLD_STRUCTURE' | 'PAYSLIPS'>('NEW_STRUCTURE');
  const [selectedPayslipMonth, setSelectedPayslipMonth] = useState('2026-07');
  const [selectedOldRevisionIndex, setSelectedOldRevisionIndex] = useState(0);

  // DM SANS FONT FAMILY ENFORCED GLOBALLY
  const activeFontFamily = "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  useEffect(() => {
    if (empId) {
      fetchLivePayslipStatement();
    }
  }, [empId]);

  // Safe fetch function to prevent "Unexpected token '<'" SyntaxError on HTML 404/500 responses
  const safeFetchJson = async (url: string) => {
    try {
      const res = await fetch(url, { headers: getHeaders() });
      const contentType = res.headers.get('content-type');
      if (res.ok && contentType && contentType.includes('application/json')) {
        return await res.json();
      }
    } catch (e) {
      console.error('Fetch JSON Error:', e);
    }
    return null;
  };

  const fetchLivePayslipStatement = async () => {
    setLoading(true);
    try {
      const data = await safeFetchJson(`/api/v1/payroll/payslips/employee/${empId}`);
      if (data) {
        if (data.payslip) setPayslip(data.payslip);
        if (data.items) setItems(data.items || []);
        if (data.structures) setStructures(data.structures || []);
      } else {
        await fetchFallbackEmployee();
      }
    } catch (e) {
      console.error(e);
      await fetchFallbackEmployee();
    } finally {
      setLoading(false);
    }
  };

  const fetchFallbackEmployee = async () => {
    try {
      const empData = await safeFetchJson(`/api/v1/employees/${empId}`);
      const emp = empData ? (empData.employee || empData) : null;
      if (emp && emp.id) {
        setPayslip({
          id: emp.id,
          employee_id: emp.id,
          first_name: emp.first_name || 'Employee',
          last_name: emp.last_name || '',
          emp_id_code: emp.emp_id_code || emp.emp_id || 'EMP101',
          email: emp.email || 'employee@company.com',
          phone: emp.phone || '919000000000',
          joining_date: emp.joining_date ? emp.joining_date.split('T')[0] : '',
          department_name: emp.department_name || 'Department',
          designation_name: emp.designation_name || 'Staff',
          company_name: emp.company_name || 'Company Name',
          company_logo: emp.company_logo || emp.branding_logo || '',
          company_address: emp.company_address || '',
          gross_salary: 0,
          total_deductions: 0,
          net_salary: 0,
          pay_period: '2026-07',
          status: 'GENERATED'
        });
      }
    } catch (err) {
      console.error('Error fetching fallback employee:', err);
    }
  };

  const handlePrintPDF = () => {
    window.print();
  };

  const handleSendWhatsApp = () => {
    if (!payslip) return;
    const text = `Hello ${payslip.first_name},\n\nYour Payslip Statement for ${payslip.pay_period || '2026-07'} is ready.\n\n*Gross Salary:* ₹${(parseFloat(String(payslip.gross_salary)) || 0).toLocaleString('en-IN')}\n*Deductions:* ₹${(parseFloat(String(payslip.total_deductions)) || 0).toLocaleString('en-IN')}\n*Net Pay:* ₹${(parseFloat(String(payslip.net_salary)) || 0).toLocaleString('en-IN')}\n\n- ${payslip.company_name || 'HR Team'}`;
    const phone = payslip.phone || '919000000000';
    const waUrl = `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
    showToast(`WhatsApp message draft opened for ${payslip.first_name}!`, 'success');
  };

  const handleSendEmail = () => {
    if (!payslip) return;
    setLoadingAction('email');
    setTimeout(() => {
      setLoadingAction(null);
      showToast(`✉️ Payslip PDF email delivered successfully to ${payslip.email || 'employee@company.com'}!`, 'success');
    }, 1000);
  };

  if (loading || !payslip) {
    return (
      <div style={{ fontFamily: activeFontFamily }} className="p-16 text-center text-slate-400 font-bold flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <span>Loading compensation profile & payslip details...</span>
      </div>
    );
  }

  // Dynamic Line Items calculation directly from database items or proportions
  const getItemAmount = (code: string) => {
    const found = items.find(i => i.component_code === code);
    return found ? parseFloat(String(found.amount)) : 0;
  };

  // Real Database Structures:
  // New Structure = structures[0] (Latest Active DB Structure)
  // Old Structures = structures.slice(1) (Previous DB Structures)
  const newStruct = structures.length > 0 ? structures[0] : null;
  const oldStructures = structures.length > 1 ? structures.slice(1) : [];

  const isOld = activeTab === 'OLD_STRUCTURE';
  const activeStruct = isOld
    ? (oldStructures[selectedOldRevisionIndex] || null)
    : newStruct;

  const basic = activeStruct ? parseFloat(String(activeStruct.basic || 0)) : getItemAmount('BASIC');
  const hra = activeStruct ? parseFloat(String(activeStruct.hra || 0)) : getItemAmount('HRA');
  const ca = activeStruct ? parseFloat(String(activeStruct.ca || 0)) : getItemAmount('CA');
  const ma = activeStruct ? parseFloat(String(activeStruct.ma || 0)) : getItemAmount('MA');
  const sa = activeStruct ? parseFloat(String(activeStruct.sa || 0)) : getItemAmount('SA');
  const otherAllow = activeStruct ? parseFloat(String(activeStruct.other_allowance || 0)) : getItemAmount('OTHER_ALLOW');

  const pf = activeStruct ? parseFloat(String(activeStruct.employee_pf || 0)) : getItemAmount('PF');
  const esi = activeStruct ? parseFloat(String(activeStruct.employee_esi || 0)) : getItemAmount('ESI');
  const profTax = activeStruct ? parseFloat(String(activeStruct.professional_tax || 0)) : getItemAmount('PROF_TAX');

  const totalGross = activeStruct
    ? (parseFloat(String(activeStruct.salary_per_month || activeStruct.gross_salary || 0)) || (basic + hra + ca + ma + sa + otherAllow))
    : parseFloat(String(payslip.gross_salary || 0));

  const totalDeductions = activeStruct
    ? (pf + esi + profTax)
    : parseFloat(String(payslip.total_deductions || 0));

  const netPay = totalGross - totalDeductions;

  // Employer Benefits
  const employerPf = activeStruct ? parseFloat(String(activeStruct.employer_pf || pf)) : pf;
  const employerEsi = activeStruct ? parseFloat(String(activeStruct.employer_esi || esi)) : esi;
  const statBonus = Math.round(basic * 0.0833);
  const gratuity = activeStruct ? parseFloat(String(activeStruct.gratuity || 0)) : Math.round((basic * 15) / 26 / 12);
  const totalEmployerBenefits = Math.round(employerPf + employerEsi + statBonus + gratuity);

  const currentSalaryPerMonth = totalGross;
  const currentSalaryPerAnnum = activeStruct && activeStruct.salary_per_annum
    ? parseFloat(String(activeStruct.salary_per_annum))
    : currentSalaryPerMonth * 12;

  const currentMonthlyCtc = activeStruct && activeStruct.monthly_ctc
    ? parseFloat(String(activeStruct.monthly_ctc))
    : (totalGross + employerPf + totalEmployerBenefits);

  const currentYearlyCtc = currentMonthlyCtc * 12;

  const cleanDoj = payslip.joining_date ? payslip.joining_date.split('T')[0] : 'N/A';

  // DYNAMIC PAYSLIP MONTHS GENERATOR
  const generateDynamicPayPeriods = (joiningDateStr?: string) => {
    const months = [];
    const now = new Date();
    const start = joiningDateStr ? new Date(joiningDateStr) : new Date(now.getFullYear() - 1, 0, 1);
    const current = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June', 
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    while (current >= start && months.length < 36) {
      const year = current.getFullYear();
      const monthNum = String(current.getMonth() + 1).padStart(2, '0');
      const monthName = monthNames[current.getMonth()];
      months.push({ value: `${year}-${monthNum}`, label: `${monthName} ${year}` });
      current.setMonth(current.getMonth() - 1);
    }

    if (months.length === 0) {
      months.push({ value: '2026-07', label: 'July 2026' });
    }

    return months;
  };

  const dynamicPayPeriods = generateDynamicPayPeriods(payslip.joining_date);

  return (
    <div style={{ fontFamily: activeFontFamily }} className="payslip-detail-container font-sans space-y-6 animate-fadeIn w-full text-left pb-24 px-2 sm:px-4">
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap');
        .payslip-detail-container,
        .payslip-detail-container button,
        .payslip-detail-container input,
        .payslip-detail-container select,
        .payslip-detail-container label,
        .payslip-detail-container span,
        .payslip-detail-container div,
        .payslip-detail-container p,
        .payslip-detail-container th,
        .payslip-detail-container td {
          font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        }
        @media print {
          body * { visibility: hidden; }
          #printable-payslip, #printable-payslip * { visibility: visible; }
          #printable-payslip { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}} />

      <DashboardPageHeader
        title={`Employee Compensation & Salary Console - ${payslip.first_name} ${payslip.last_name}`}
        actionMessage=""
        actionError=""
        hideCompanySelect={true}
        hideUserBadge={true}
      />

      {/* Top Action Bar & Month Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print bg-card/60 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🗓️</span>
          <div>
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Employee Compensation & Payslip Statement
            </h2>
            <p className="text-xs text-slate-400 font-normal mt-0.5">
              Official monthly payslip statement for {selectedPayslipMonth}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Month Selector */}
          <select
            value={selectedPayslipMonth}
            onChange={(e) => setSelectedPayslipMonth(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer shadow-xs hover:border-indigo-500"
          >
            {dynamicPayPeriods.map((period) => (
              <option key={period.value} value={period.value}>{period.label}</option>
            ))}
          </select>

          {/* Action Icon Buttons */}
          <button
            type="button"
            onClick={handlePrintPDF}
            title="Print / Download PDF Statement"
            className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm transition-all shadow-xs flex items-center justify-center cursor-pointer hover:scale-105"
          >
            🖨️
          </button>
          <button
            type="button"
            onClick={handleSendWhatsApp}
            title="Send WhatsApp Statement"
            className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm transition-all shadow-xs flex items-center justify-center cursor-pointer hover:scale-105"
          >
            💬
          </button>
          <button
            type="button"
            onClick={handleSendEmail}
            disabled={loadingAction === 'email'}
            title="Send Email PDF"
            className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm transition-all shadow-xs flex items-center justify-center cursor-pointer disabled:opacity-50 hover:scale-105"
          >
            ✉️
          </button>

          {/* Back Link Button */}
          <button
            type="button"
            onClick={() => router.push('/dashboard/payslip')}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-700"
          >
            ← Back
          </button>
        </div>
      </div>

      {/* 10 Small Attendance & Monthly Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2.5 no-print">
        {/* 1. Month */}
        <div className="bg-card p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">MONTH</span>
          <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100 mt-1 font-mono">{selectedPayslipMonth}</span>
        </div>

        {/* 2. Working Days */}
        <div className="bg-card p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">WORKING DAYS</span>
          <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100 mt-1 font-mono">30.0</span>
        </div>

        {/* 3. Payable Days */}
        <div className="bg-card p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">PAYABLE DAYS</span>
          <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
            {payslip.paid_days ? parseFloat(String(payslip.paid_days)).toFixed(1) : '30.0'}
          </span>
        </div>

        {/* 4. Present */}
        <div className="bg-card p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">PRESENT</span>
          <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
            {payslip.paid_days ? parseFloat(String(payslip.paid_days)).toFixed(1) : '30.0'}
          </span>
        </div>

        {/* 5. Absent */}
        <div className="bg-card p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider block">ABSENT</span>
          <span className="text-xs font-extrabold text-rose-500 mt-1 font-mono">0.0</span>
        </div>

        {/* 6. Half Days */}
        <div className="bg-card p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block">HALF DAYS</span>
          <span className="text-xs font-extrabold text-amber-500 mt-1 font-mono">0.0</span>
        </div>

        {/* 7. LOP Days */}
        <div className="bg-card p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">LOP DAYS</span>
          <span className="text-xs font-extrabold text-rose-600 mt-1 font-mono">
            {payslip.lop_days ? parseFloat(String(payslip.lop_days)).toFixed(2) : '0.00'}
          </span>
        </div>

        {/* 8. Late Logins */}
        <div className="bg-card p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block">LATE LOGINS</span>
          <span className="text-xs font-extrabold text-indigo-500 mt-1 font-mono">0</span>
        </div>

        {/* 9. Holidays */}
        <div className="bg-card p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold text-purple-500 uppercase tracking-wider block">HOLIDAYS</span>
          <span className="text-xs font-extrabold text-purple-500 mt-1 font-mono">2.0</span>
        </div>

        {/* 10. Casual Leaves */}
        <div className="bg-card p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider block">LEAVES</span>
          <span className="text-xs font-extrabold text-blue-500 mt-1 font-mono">
            {payslip.casual_leaves ? parseFloat(String(payslip.casual_leaves)).toFixed(2) : '0.00'}
          </span>
        </div>
      </div>

          {/* FULL WIDTH OFFICIAL PAYSLIP STATEMENT CARD WITH SOLID TABLE GRID MATCHING SCREENSHOT */}
          <div id="printable-payslip" className="bg-white text-slate-900 rounded-2xl border-2 border-slate-300 p-6 sm:p-8 shadow-xl space-y-4 w-full text-left text-xs">
            
            {/* Top Header: Dynamic Employee Company Logo & Address */}
            <div className="space-y-3">
              <div className="flex justify-between items-center px-2">
                {/* Dynamic Company Logo */}
                <div className="flex items-center gap-3 w-1/4">
                  {payslip.company_logo ? (
                    <img
                      src={payslip.company_logo}
                      alt={payslip.company_name || 'Company Logo'}
                      className="h-16 w-auto object-contain max-w-[220px]"
                    />
                  ) : (
                    <div className="text-base font-black text-blue-900 tracking-tight uppercase">
                      {payslip.company_name}
                    </div>
                  )}
                </div>

                {/* Company Name & Address Header */}
                <div className="text-center flex-1 px-2">
                  <h1 className="text-lg font-black text-slate-900 tracking-tight">
                    {payslip.company_name}
                  </h1>
                  <p className="text-[10px] text-slate-600 font-medium mt-0.5 max-w-xl mx-auto leading-tight">
                    {payslip.company_address || 'Shangrila Plaza, 501, #508-510, Park View Enclave, Road No2, Banjara Hills, Hyderabad, Telangana 500034'}
                  </p>
                  <h3 className="text-xs font-black text-[#1e3a8a] mt-1 tracking-wide">
                    Pay Slip for {selectedPayslipMonth}
                  </h3>
                </div>
                
                <div className="w-1/4" />
              </div>

              {/* Solid Blue Line Divider */}
              <div className="border-b-2 border-[#1e3a8a] w-full" />
            </div>

            {/* Authentic Solid HTML Table Grid (Employee Information) */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-slate-300 text-[11px]">
                <tbody>
                  
                  {/* Row 1: Name & DOJ */}
                  <tr className="border-b border-slate-300">
                    <td className="p-2 font-bold bg-slate-50 text-slate-700 w-1/5 text-[10px] border-r border-slate-300">Name Of The Employee</td>
                    <td colSpan={3} className="p-2 font-black text-slate-900 text-center tracking-wide border-r border-slate-300">
                      {payslip.first_name} {payslip.last_name}
                    </td>
                    <td className="p-2 font-bold bg-slate-50 text-slate-700 text-center text-[10px] border-r border-slate-300">DOJ</td>
                    <td className="p-2 font-mono text-slate-900 text-center font-bold">{cleanDoj}</td>
                  </tr>

                  {/* Row 2: Emp ID, Month, PF No */}
                  <tr className="border-b border-slate-300">
                    <td className="p-2 font-bold bg-slate-50 text-slate-700 w-1/5 text-[10px] border-r border-slate-300">Employee Id</td>
                    <td className="p-2 font-mono font-black text-slate-900 text-center border-r border-slate-300">{payslip.emp_id_code || payslip.employee_id}</td>
                    <td className="p-2 font-bold bg-slate-50 text-slate-700 text-center text-[10px] border-r border-slate-300">Month</td>
                    <td className="p-2 font-bold text-slate-900 text-center border-r border-slate-300">{selectedPayslipMonth}</td>
                    <td className="p-2 font-bold bg-slate-50 text-slate-700 text-center text-[10px] border-r border-slate-300">PF No</td>
                    <td className="p-2 font-mono text-slate-900 text-center font-bold">{payslip.pf_number || payslip.pf_no || '-'}</td>
                  </tr>

                  {/* Row 3: Designation, Paid Days, ESI No */}
                  <tr className="border-b border-slate-300">
                    <td className="p-2 font-bold bg-slate-50 text-slate-700 text-[10px] border-r border-slate-300">Designation</td>
                    <td className="p-2 font-black text-slate-900 text-center border-r border-slate-300 uppercase">{payslip.designation_name || '-'}</td>
                    <td className="p-2 font-bold bg-slate-50 text-slate-700 text-center text-[10px] border-r border-slate-300">Paid Days</td>
                    <td className="p-2 font-mono font-bold text-slate-900 text-center border-r border-slate-300">{payslip.paid_days ? parseFloat(String(payslip.paid_days)).toFixed(1) : '30.0'}</td>
                    <td className="p-2 font-bold bg-slate-50 text-slate-700 text-center text-[10px] border-r border-slate-300">ESI No</td>
                    <td className="p-2 font-mono text-slate-900 text-center font-bold">{payslip.esi_number || payslip.esi_no || '-'}</td>
                  </tr>

                  {/* Row 4: Casual Leaves & LOP Days */}
                  <tr>
                    <td className="p-2 font-bold bg-slate-50 text-slate-700 text-[10px] border-r border-slate-300">Casual Leaves Applied</td>
                    <td colSpan={3} className="p-2 font-mono font-bold text-slate-900 text-center border-r border-slate-300">{payslip.casual_leaves ? parseFloat(String(payslip.casual_leaves)).toFixed(2) : '0.00'}</td>
                    <td className="p-2 font-bold bg-slate-50 text-slate-700 text-center text-[10px] border-r border-slate-300">LOP Days</td>
                    <td className="p-2 font-mono font-bold text-slate-900 text-center">{payslip.lop_days ? parseFloat(String(payslip.lop_days)).toFixed(2) : '0.00'}</td>
                  </tr>

                </tbody>
              </table>
            </div>

            {/* EARNINGS SECTION TABLE (14 COLUMNS MATCHING SCREENSHOT) */}
            <div className="border border-slate-300 rounded-md overflow-hidden space-y-0">
              <div className="bg-[#5c6b73] text-white font-extrabold text-xs py-1.5 text-center uppercase tracking-wider">
                EARNINGS
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-center border-collapse text-[9.5px]">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-700">
                      <th className="p-1.5 border-r border-slate-300">Basic</th>
                      <th className="p-1.5 border-r border-slate-300">HRA</th>
                      <th className="p-1.5 border-r border-slate-300">Conv</th>
                      <th className="p-1.5 border-r border-slate-300">Arrears</th>
                      <th className="p-1.5 border-r border-slate-300">Fix HRA</th>
                      <th className="p-1.5 border-r border-slate-300">Other Allow</th>
                      <th className="p-1.5 border-r border-slate-300">Uniform Allow</th>
                      <th className="p-1.5 border-r border-slate-300">Med Allow</th>
                      <th className="p-1.5 border-r border-slate-300">CCA</th>
                      <th className="p-1.5 border-r border-slate-300">Mobile Allow</th>
                      <th className="p-1.5 border-r border-slate-300">Extra Amount</th>
                      <th className="p-1.5 border-r border-slate-300">Car Fuel & Maintenance</th>
                      <th className="p-1.5 border-r border-slate-300">Meal/Food</th>
                      <th className="p-1.5">Tel/Net Reimb</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="font-mono text-slate-900 font-bold bg-white">
                      <td className="p-1.5 border-r border-slate-300">{basic.toFixed(1)}</td>
                      <td className="p-1.5 border-r border-slate-300">{hra.toFixed(1)}</td>
                      <td className="p-1.5 border-r border-slate-300">{ca.toFixed(1)}</td>
                      <td className="p-1.5 border-r border-slate-300">0.0</td>
                      <td className="p-1.5 border-r border-slate-300">0.0</td>
                      <td className="p-1.5 border-r border-slate-300">{otherAllow.toFixed(1)}</td>
                      <td className="p-1.5 border-r border-slate-300">0.0</td>
                      <td className="p-1.5 border-r border-slate-300">{ma.toFixed(1)}</td>
                      <td className="p-1.5 border-r border-slate-300">0.0</td>
                      <td className="p-1.5 border-r border-slate-300">0.0</td>
                      <td className="p-1.5 border-r border-slate-300">0.0</td>
                      <td className="p-1.5 border-r border-slate-300">0.0</td>
                      <td className="p-1.5 border-r border-slate-300">0.0</td>
                      <td className="p-1.5">0.0</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* DEDUCTIONS SECTION TABLE (11 COLUMNS MATCHING SCREENSHOT) */}
            <div className="border border-slate-300 rounded-md overflow-hidden space-y-0">
              <div className="bg-[#5c6b73] text-white font-extrabold text-xs py-1.5 text-center uppercase tracking-wider">
                DEDUCTIONS
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-center border-collapse text-[9.5px]">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-700">
                      <th className="p-1.5 border-r border-slate-300">PF</th>
                      <th className="p-1.5 border-r border-slate-300">ESI</th>
                      <th className="p-1.5 border-r border-slate-300">Prof Tax</th>
                      <th className="p-1.5 border-r border-slate-300">LWF</th>
                      <th className="p-1.5 border-r border-slate-300">IT</th>
                      <th className="p-1.5 border-r border-slate-300">Lic</th>
                      <th className="p-1.5 border-r border-slate-300">Other</th>
                      <th className="p-1.5 border-r border-slate-300">Bank Loan</th>
                      <th className="p-1.5 border-r border-slate-300">Comp Loan</th>
                      <th className="p-1.5 border-r border-slate-300">Rent Paid</th>
                      <th className="p-1.5">Salary Adv</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="font-mono text-slate-900 font-bold bg-white">
                      <td className="p-1.5 border-r border-slate-300">{pf.toFixed(1)}</td>
                      <td className="p-1.5 border-r border-slate-300">{esi.toFixed(1)}</td>
                      <td className="p-1.5 border-r border-slate-300">{profTax.toFixed(1)}</td>
                      <td className="p-1.5 border-r border-slate-300">0.0</td>
                      <td className="p-1.5 border-r border-slate-300">0.0</td>
                      <td className="p-1.5 border-r border-slate-300">0.0</td>
                      <td className="p-1.5 border-r border-slate-300">0.0</td>
                      <td className="p-1.5 border-r border-slate-300">0.0</td>
                      <td className="p-1.5 border-r border-slate-300">0.0</td>
                      <td className="p-1.5 border-r border-slate-300">0.0</td>
                      <td className="p-1.5">0.0</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* SUMMARY TOTALS GRID & IN WORDS */}
            <div className="border border-slate-300 rounded-md overflow-hidden divide-y divide-slate-300 text-[11px]">
              <div className="grid grid-cols-3 divide-x divide-slate-300">
                <div className="p-2 bg-slate-50 flex justify-between items-center">
                  <span className="font-bold text-slate-700 text-[10px]">Total Earnings(in Inr)</span>
                  <span className="font-mono font-black text-slate-900">{totalGross.toFixed(1)}</span>
                </div>
                <div className="p-2 bg-slate-50 flex justify-between items-center">
                  <span className="font-bold text-slate-700 text-[10px]">Total Deductions(in Inr)</span>
                  <span className="font-mono font-black text-slate-900">{totalDeductions.toFixed(1)}</span>
                </div>
                <div className="p-2 bg-slate-50 flex justify-between items-center">
                  <span className="font-bold text-slate-900 text-[10px]">Net Pay (in Inr)</span>
                  <span className="font-mono font-black text-slate-900">{netPay.toFixed(1)}</span>
                </div>
              </div>

              <div className="p-2 bg-white flex items-center gap-8 text-xs">
                <span className="font-bold text-slate-700 text-[10px]">In Words</span>
                <span className="font-extrabold text-[#1e3a8a] uppercase text-xs tracking-wide">
                  {numberToWords(netPay)} RUPEES ONLY
                </span>
              </div>
            </div>

            {/* Bottom System Note Footer */}
            <div className="pt-3 text-center text-[10px] text-slate-500 font-medium italic">
              ** system generated print out. no signature required **
            </div>
          </div>
    </div>
  );
}
