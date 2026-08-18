'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardPageHeader from '../components/DashboardPageHeader';
import { getHeaders, getUrl } from '../utils/api';
import { useDashboard } from '../components/DashboardContext';

interface PayslipRecord {
  id: string;
  payslip_number?: string;
  employee_id: string;
  emp_id_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  department_name?: string;
  designation_name?: string;
  branch_name?: string;
  gross_salary: number;
  total_deductions: number;
  net_salary: number;
  basic_amount?: number;
  hra_amount?: number;
  ca_amount?: number;
  ma_amount?: number;
  sa_amount?: number;
  pay_period: string;
  status: string;
}

interface Company {
  id: string;
  name: string;
  subdomain: string;
  status: string;
  created_at: string;
}

export default function PayslipPage() {
  const router = useRouter();
  const { showToast } = useDashboard();

  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [payslips, setPayslips] = useState<PayslipRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search (Default to Previous Month - e.g. July 07)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return String(prev.getMonth() + 1).padStart(2, '0');
  });
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pagination State (50, 100, 200, 500)
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('superadmin');

  useEffect(() => {
    const storedRoles = localStorage.getItem('roles');
    const storedEmail = localStorage.getItem('email');
    const storedCompanyId = localStorage.getItem('companyId');
    if (storedRoles) setRoles(JSON.parse(storedRoles));
    if (storedEmail) setEmail(storedEmail || '');
    if (storedCompanyId) setCompanyId(storedCompanyId);
  }, []);

  const fetchCompanies = async () => {
    try {
      const res = await fetch('/api/v1/companies', { headers: getHeaders() });
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        setCompanies(data.companies || []);
      }
    } catch (e) { console.error(e); }
  };

  const fetchLivePayslips = async () => {
    setLoading(true);
    try {
      let url = '/api/v1/payroll/employee-payslips';
      if (companyId) url += `?companyId=${companyId}`;
      const res = await fetch(url, { headers: getHeaders() });
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        setPayslips(data.payslips || []);
      } else {
        setPayslips([]);
      }
    } catch (e) {
      console.error('Error fetching live payslips:', e);
      setPayslips([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) fetchCompanies();
  }, [isSuperAdmin]);

  useEffect(() => {
    fetchLivePayslips();
  }, [companyId]);

  // Reset page to 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedMonth, selectedYear, searchQuery, pageSize]);

  const handleCompanyChange = (id: string) => {
    const val = id || null;
    setCompanyId(val);
    if (val) localStorage.setItem('companyId', val);
    else localStorage.removeItem('companyId');
  };

  const handleViewEmployeeStatement = (empId: string) => {
    router.push(`/dashboard/payslip/${empId}`);
  };

  const filteredPayslips = payslips.filter(ps => {
    const matchesSearch = `${ps.first_name} ${ps.last_name} ${ps.emp_id_code} ${ps.department_name}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase());

    let matchesMonth = true;
    let matchesYear = true;

    if (ps.pay_period) {
      if (selectedMonth !== 'ALL') {
        matchesMonth = ps.pay_period.includes(`-${selectedMonth}`) || ps.pay_period.includes(selectedMonth);
      }
      if (selectedYear !== 'ALL') {
        matchesYear = ps.pay_period.includes(selectedYear);
      }
    }

    return matchesSearch && matchesMonth && matchesYear;
  });

  // Pagination Math
  const totalItems = filteredPayslips.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedPayslips = filteredPayslips.slice(startIndex, endIndex);

  return (
    <div style={{ fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif" }} className="payslip-page-container font-sans space-y-6 animate-fadeIn w-full text-left pb-24">
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap');
        .payslip-page-container,
        .payslip-page-container button,
        .payslip-page-container input,
        .payslip-page-container select,
        .payslip-page-container label,
        .payslip-page-container span,
        .payslip-page-container div,
        .payslip-page-container p,
        .payslip-page-container th,
        .payslip-page-container td {
          font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        }
      `}} />

      <DashboardPageHeader
        title="Employee Payslip Directory (Live DB)"
        actionMessage=""
        actionError=""
        companies={companies}
        companyId={companyId}
        handleCompanyChange={handleCompanyChange}
        isSuperAdmin={isSuperAdmin}
        email={email}
        hideCompanySelect={true}
        hideUserBadge={true}
      />

      {/* Top Filter Bar */}
      <div className="bg-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            Employee Payslip Directory
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 text-xs font-bold border border-indigo-200 dark:border-indigo-900">
              {totalItems} Total Records
            </span>
          </h2>
          <p className="text-xs text-slate-400 font-normal mt-0.5">
            Click on any row to open the official payslip statement with PDF, WhatsApp & Email actions
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Month & Year Select */}
          <div className="flex items-center gap-1.5">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 cursor-pointer shadow-xs"
            >
              <option value="01">January</option>
              <option value="02">February</option>
              <option value="03">March</option>
              <option value="04">April</option>
              <option value="05">May</option>
              <option value="06">June</option>
              <option value="07">July</option>
              <option value="08">August</option>
              <option value="09">September</option>
              <option value="10">October</option>
              <option value="11">November</option>
              <option value="12">December</option>
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 cursor-pointer shadow-xs"
            >
              <option value="ALL">All Years</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
            </select>
          </div>

          {/* Items Per Page Select */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500 hidden sm:inline">Per Page:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-bold text-indigo-600 dark:text-indigo-400 outline-none focus:border-indigo-500 cursor-pointer shadow-xs"
            >
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
              <option value={200}>200 per page</option>
              <option value={500}>500 per page</option>
            </select>
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Search employee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3.5 py-2 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Main Employee Salary List Table */}
      <div className="bg-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold text-xs uppercase tracking-wider">
                <th className="py-3 px-3">Employee Name</th>
                <th className="py-3 px-3">Department</th>
                <th className="py-3 px-3 text-right">Basic</th>
                <th className="py-3 px-3 text-right">HRA</th>
                <th className="py-3 px-3 text-right">CA</th>
                <th className="py-3 px-3 text-right">MA</th>
                <th className="py-3 px-3 text-right">SA</th>
                <th className="py-3 px-3 text-right">Net Pay</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 font-medium">
                    Loading live payslips from database...
                  </td>
                </tr>
              ) : paginatedPayslips.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 font-medium">
                    No payslips found matching search query.
                  </td>
                </tr>
              ) : (
                paginatedPayslips.map((ps) => {
                  return (
                    <tr
                      key={ps.id}
                      onClick={() => handleViewEmployeeStatement(ps.employee_id || ps.id)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-3 font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2.5">
                        <span className="h-7 w-7 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 flex items-center justify-center text-xs font-bold shrink-0">
                          {(ps.first_name || 'E')[0]}
                        </span>
                        <div className="flex flex-col text-left">
                          <span className="font-bold text-slate-800 dark:text-slate-100">{ps.first_name} {ps.last_name}</span>
                          <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 tracking-tight">{ps.emp_id_code || 'EMP101'}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 font-medium text-slate-600 dark:text-slate-400">
                        <div className="flex flex-col text-left">
                          <span className="font-bold text-slate-700 dark:text-slate-300">{ps.department_name || 'General'}</span>
                          <span className="text-[10px] font-semibold text-slate-400">{ps.designation_name || 'Staff'}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-right font-semibold text-slate-700 dark:text-slate-200 tracking-tight">
                        ₹{(parseFloat(String(ps.basic_amount || 0)) || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-3 text-right font-semibold text-slate-700 dark:text-slate-200 tracking-tight">
                        ₹{(parseFloat(String(ps.hra_amount || 0)) || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-3 text-right font-semibold text-slate-700 dark:text-slate-200 tracking-tight">
                        ₹{(parseFloat(String(ps.ca_amount || 0)) || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-3 text-right font-semibold text-slate-700 dark:text-slate-200 tracking-tight">
                        ₹{(parseFloat(String(ps.ma_amount || 0)) || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-3 text-right font-semibold text-slate-700 dark:text-slate-200 tracking-tight">
                        ₹{(parseFloat(String(ps.sa_amount || 0)) || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-3 text-right font-extrabold text-indigo-600 dark:text-indigo-400 text-xs tracking-tight">
                        ₹{(parseFloat(String(ps.net_salary)) || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                          {ps.status || 'GENERATED'}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewEmployeeStatement(ps.employee_id || ps.id);
                          }}
                          className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                        >
                          View Payslip
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Clean Modern Pagination Control Footer Bar */}
        {totalItems > 0 && (
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs">
            <div className="text-slate-500 dark:text-slate-400 font-medium">
              Showing <span className="font-bold text-slate-800 dark:text-slate-200">{totalItems > 0 ? startIndex + 1 : 0}</span> to <span className="font-bold text-slate-800 dark:text-slate-200">{endIndex}</span> of <span className="font-bold text-indigo-600 dark:text-indigo-400">{totalItems}</span> employee records
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={validCurrentPage <= 1}
                onClick={() => setCurrentPage(1)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition-all"
              >
                « First
              </button>
              <button
                type="button"
                disabled={validCurrentPage <= 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition-all"
              >
                ‹ Prev
              </button>

              <span className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900 text-indigo-700 dark:text-indigo-300 font-extrabold text-xs">
                Page {validCurrentPage} of {totalPages}
              </span>

              <button
                type="button"
                disabled={validCurrentPage >= totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition-all"
              >
                Next ›
              </button>
              <button
                type="button"
                disabled={validCurrentPage >= totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition-all"
              >
                Last »
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
