'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardPageHeader from '../components/DashboardPageHeader';
import SlideDrawer from '../components/SlideDrawer';
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
  payable_days?: number;
  working_days?: number;
  remarks?: string;
  created_at?: string;
  created_by_name?: string;
  updated_at?: string;
  updated_by_name?: string;
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
  const [permissions, setPermissions] = useState<string[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [payslips, setPayslips] = useState<PayslipRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return String(prev.getMonth() + 1).padStart(2, '0');
  });
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pagination State
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Edit Drawer State
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [editingPayslip, setEditingPayslip] = useState<PayslipRecord | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editForm, setEditForm] = useState({
    payable_days: '30',
    gross_salary: '0',
    basic_amount: '0',
    hra_amount: '0',
    ca_amount: '0',
    ma_amount: '0',
    sa_amount: '0',
    net_salary: '0',
    status: 'GENERATED',
    remarks: ''
  });

  // Delete Confirmation Modal State
  const [deleteConfirm, setDeleteConfirm] = useState<PayslipRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('superadmin');
  const canEdit = isSuperAdmin || permissions.includes('edit_payslips') || permissions.includes('*');
  const canDelete = isSuperAdmin || permissions.includes('delete_payslips') || permissions.includes('*');

  useEffect(() => {
    const storedRoles = localStorage.getItem('roles');
    const storedEmail = localStorage.getItem('email');
    const storedCompanyId = localStorage.getItem('companyId');
    const storedPermissions = localStorage.getItem('permissions');
    if (storedRoles) setRoles(JSON.parse(storedRoles));
    if (storedPermissions) setPermissions(JSON.parse(storedPermissions));
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
      console.error(e);
      setPayslips([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
    fetchLivePayslips();
  }, [companyId]);

  const handleCompanyChange = (id: string) => {
    setCompanyId(id);
    localStorage.setItem('companyId', id);
  };

  const handleViewEmployeeStatement = (employeeId: string) => {
    router.push(`/dashboard/payslip/${employeeId}`);
  };

  // Open Edit Drawer
  const openEditDrawer = (ps: PayslipRecord) => {
    setEditingPayslip(ps);
    setEditForm({
      payable_days: String(ps.payable_days ?? ps.working_days ?? 30),
      gross_salary: String(ps.gross_salary || 0),
      basic_amount: String(ps.basic_amount || 0),
      hra_amount: String(ps.hra_amount || 0),
      ca_amount: String(ps.ca_amount || 0),
      ma_amount: String(ps.ma_amount || 0),
      sa_amount: String(ps.sa_amount || 0),
      net_salary: String(ps.net_salary || 0),
      status: ps.status || 'GENERATED',
      remarks: ps.remarks || ''
    });
    setEditDrawerOpen(true);
  };

  // Handle Save Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayslip) return;
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/v1/payslips/${editingPayslip.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          payable_days: parseFloat(editForm.payable_days) || 0,
          gross_salary: parseFloat(editForm.gross_salary) || 0,
          basic_amount: parseFloat(editForm.basic_amount) || 0,
          hra_amount: parseFloat(editForm.hra_amount) || 0,
          ca_amount: parseFloat(editForm.ca_amount) || 0,
          ma_amount: parseFloat(editForm.ma_amount) || 0,
          sa_amount: parseFloat(editForm.sa_amount) || 0,
          net_salary: parseFloat(editForm.net_salary) || 0,
          status: editForm.status,
          remarks: editForm.remarks
        })
      });

      if (res.ok) {
        showToast('Payslip updated successfully!', 'success');
        setEditDrawerOpen(false);
        fetchLivePayslips();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to update payslip', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error updating payslip record', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle Execute Delete
  const handleExecuteDelete = async () => {
    if (!deleteConfirm) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/v1/payslips/${deleteConfirm.id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });

      if (res.ok) {
        showToast('Payslip record deleted successfully!', 'success');
        setDeleteConfirm(null);
        fetchLivePayslips();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to delete payslip', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error deleting payslip record', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter Logic
  const filteredPayslips = payslips.filter((ps) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const nameMatch = `${ps.first_name || ''} ${ps.last_name || ''}`.toLowerCase().includes(query);
      const codeMatch = (ps.emp_id_code || '').toLowerCase().includes(query);
      const deptMatch = (ps.department_name || '').toLowerCase().includes(query);
      if (!nameMatch && !codeMatch && !deptMatch) return false;
    }
    if (ps.pay_period) {
      const [year, month] = ps.pay_period.split('-');
      if (selectedYear !== 'ALL' && year !== selectedYear) return false;
      if (selectedMonth !== 'ALL' && month !== selectedMonth) return false;
    }
    return true;
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
        title="Employee Payslip Directory"
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
      <div className="bg-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
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
      <div className="bg-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold text-xs uppercase tracking-wider">
                <th className="py-3 px-3">Employee Name</th>
                <th className="py-3 px-3">Department</th>
                <th className="py-3 px-3 text-center">Payable Days</th>
                <th className="py-3 px-3 text-right">Gross Salary</th>
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
                  <td colSpan={12} className="py-12 text-center text-slate-400 font-medium">
                    Loading live payslips from database...
                  </td>
                </tr>
              ) : paginatedPayslips.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400 font-medium">
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
                      <td className="py-3.5 px-3 text-center font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
                          {ps.payable_days ?? ps.working_days ?? 0}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                        ₹{(parseFloat(String(ps.gross_salary || 0)) || 0).toLocaleString('en-IN')}
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
                      <td className="py-3.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleViewEmployeeStatement(ps.employee_id || ps.id)}
                            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                          >
                            View Payslip
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => openEditDrawer(ps)}
                              className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
                              title="Edit Payslip Details"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                              </svg>
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => setDeleteConfirm(ps)}
                              className="p-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-600 text-rose-600 hover:text-white font-bold transition-all cursor-pointer border border-rose-200 dark:border-rose-800"
                              title="Delete Payslip Record"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Control Bar */}
        {totalItems > 0 && (
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/80 backdrop-blur-xl shadow-xs">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Showing <span className="font-extrabold text-slate-800 dark:text-slate-100">{startIndex + 1}</span> to <span className="font-extrabold text-slate-800 dark:text-slate-100">{endIndex}</span> of <span className="font-extrabold text-slate-800 dark:text-slate-100">{totalItems}</span> payslip records
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Records per page:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs font-extrabold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 transition-colors cursor-pointer"
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value={500}>500</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                disabled={validCurrentPage === 1}
                onClick={() => setCurrentPage(1)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="First Page"
              >
                « First
              </button>
              <button
                disabled={validCurrentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Previous Page"
              >
                ‹ Prev
              </button>

              <span className="px-3 py-1 text-xs font-extrabold text-slate-700 dark:text-slate-300">
                Page {validCurrentPage} of {totalPages}
              </span>

              <button
                disabled={validCurrentPage >= totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Next Page"
              >
                Next ›
              </button>
              <button
                disabled={validCurrentPage >= totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Last Page"
              >
                Last »
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 🟢 SLIDE DRAWER FOR EDITING PAYSLIP */}
      <SlideDrawer
        isOpen={editDrawerOpen}
        onClose={() => setEditDrawerOpen(false)}
        title={`Edit Payslip Statement (${editingPayslip?.first_name || ''} ${editingPayslip?.last_name || ''})`}
      >
        <form onSubmit={handleSaveEdit} className="space-y-4 text-left p-1">
          <div className="p-3 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">EMPLOYEE</span>
              <span className="font-extrabold text-slate-800 dark:text-slate-100">
                {editingPayslip?.first_name} {editingPayslip?.last_name} ({editingPayslip?.emp_id_code})
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">PAY PERIOD</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">{editingPayslip?.pay_period || 'July 2026'}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Payable Days</label>
              <input
                type="number"
                step="0.5"
                value={editForm.payable_days}
                onChange={(e) => setEditForm({ ...editForm, payable_days: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-bold outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Status</label>
              <select
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-bold outline-none focus:border-indigo-500"
              >
                <option value="GENERATED">GENERATED</option>
                <option value="PAID">PAID</option>
                <option value="DRAFT">DRAFT</option>
                <option value="APPROVED">APPROVED</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Gross Salary (₹)</label>
              <input
                type="number"
                value={editForm.gross_salary}
                onChange={(e) => setEditForm({ ...editForm, gross_salary: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-bold outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Net Salary (₹)</label>
              <input
                type="number"
                value={editForm.net_salary}
                onChange={(e) => setEditForm({ ...editForm, net_salary: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-bold outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Salary Components Breakdown</h4>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Basic (₹)</label>
                <input
                  type="number"
                  value={editForm.basic_amount}
                  onChange={(e) => setEditForm({ ...editForm, basic_amount: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">HRA (₹)</label>
                <input
                  type="number"
                  value={editForm.hra_amount}
                  onChange={(e) => setEditForm({ ...editForm, hra_amount: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Conveyance (CA) (₹)</label>
                <input
                  type="number"
                  value={editForm.ca_amount}
                  onChange={(e) => setEditForm({ ...editForm, ca_amount: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Medical (MA) (₹)</label>
                <input
                  type="number"
                  value={editForm.ma_amount}
                  onChange={(e) => setEditForm({ ...editForm, ma_amount: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Special Allowance (SA) (₹)</label>
              <input
                type="number"
                value={editForm.sa_amount}
                onChange={(e) => setEditForm({ ...editForm, sa_amount: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Remarks / Audit Notes</label>
            <textarea
              rows={2}
              value={editForm.remarks}
              onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })}
              placeholder="Reason for editing payslip..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium outline-none focus:border-indigo-500"
            />
          </div>

          {/* 🔍 REQUIREMENT 3: AUDIT TRACKING INFO */}
          <div className="p-3 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-[11px] space-y-1">
            <div className="flex items-center justify-between text-amber-800 dark:text-amber-300">
              <span className="font-extrabold uppercase tracking-wider">Created By:</span>
              <span className="font-semibold">{editingPayslip?.created_by_name || 'System Admin'}</span>
            </div>
            <div className="flex items-center justify-between text-amber-800 dark:text-amber-300">
              <span className="font-extrabold uppercase tracking-wider">Created Date:</span>
              <span className="font-mono">{editingPayslip?.created_at ? new Date(editingPayslip.created_at).toLocaleString() : 'N/A'}</span>
            </div>
            {editingPayslip?.updated_at && (
              <>
                <div className="border-t border-amber-200/40 dark:border-amber-900/40 my-1 pt-1 flex items-center justify-between text-indigo-800 dark:text-indigo-300">
                  <span className="font-extrabold uppercase tracking-wider">Last Updated By:</span>
                  <span className="font-semibold">{editingPayslip?.updated_by_name || 'Admin'}</span>
                </div>
                <div className="flex items-center justify-between text-indigo-800 dark:text-indigo-300">
                  <span className="font-extrabold uppercase tracking-wider">Last Updated Date:</span>
                  <span className="font-mono">{new Date(editingPayslip.updated_at).toLocaleString()}</span>
                </div>
              </>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditDrawerOpen(false)}
              className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUpdating}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold transition-all shadow-md shadow-indigo-600/20 cursor-pointer disabled:opacity-50"
            >
              {isUpdating ? 'Updating...' : 'Update Payslip'}
            </button>
          </div>
        </form>
      </SlideDrawer>

      {/* 🔴 DELETE CONFIRMATION MODAL */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl text-center space-y-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 via-red-600 to-amber-500" />
            
            <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto border border-rose-200/80 dark:border-rose-900/60 shadow-inner">
              <svg className="w-7 h-7 animate-bounce" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </div>

            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                Delete Payslip Statement
              </h3>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                Are you sure you want to permanently delete the payslip statement for{' '}
                <strong className="text-slate-900 dark:text-slate-100 font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                  {deleteConfirm.first_name} {deleteConfirm.last_name} ({deleteConfirm.emp_id_code})
                </strong>{' '}
                for <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{deleteConfirm.pay_period || 'July 2026'}</span>?
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40 text-[11px] text-rose-700 dark:text-rose-300 font-semibold text-left flex items-center gap-2">
              <span className="text-base">⚠️</span>
              <span>This action cannot be undone. All linked item details will be removed.</span>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-slate-700 dark:text-slate-300 text-xs transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-extrabold rounded-xl shadow-md shadow-rose-600/30 text-xs transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Yes, Delete</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
