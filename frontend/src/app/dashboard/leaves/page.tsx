'use client';

import React, { useEffect, useState } from 'react';
import DashboardPageHeader from '../components/DashboardPageHeader';
import { getHeaders } from '../utils/api';
import SearchableSelect from '../components/SearchableSelect';
import SlideDrawer from '../components/SlideDrawer';
import { useDashboard } from '../components/DashboardContext';
import { usePermissions } from '../hooks/usePermissions';

interface Company {
  id: string;
  name: string;
  subdomain: string;
  status: string;
  created_at: string;
}

const LEAVE_TABS = [
  { id: 'requests',     label: 'Leave Requests',    permission: 'view_leave_requests' },
  { id: 'balances',     label: 'Leave Balances',    permission: 'view_leave_balances' },
  { id: 'types',        label: 'Leave Types',       permission: 'view_leave_types' },
  { id: 'transactions', label: 'Transaction Logs',  permission: 'view_leave_transactions' },
] as const;
type LeaveTabId = typeof LEAVE_TABS[number]['id'];

export default function LeavesPage() {
  const { showToast } = useDashboard();
  const { hasPermission } = usePermissions();
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);

  // Scope Switcher State ('my' | 'team')
  const [viewScope, setViewScope] = useState<'my' | 'team'>('my');

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<LeaveTabId>('requests');

  // Loaders
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Core Data Lists
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [transactionLogs, setTransactionLogs] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  // Drawers Open/Close States
  const [typeDrawerOpen, setTypeDrawerOpen] = useState(false);
  const [balanceDrawerOpen, setBalanceDrawerOpen] = useState(false);
  const [transactionDrawerOpen, setTransactionDrawerOpen] = useState(false);
  const [applyDrawerOpen, setApplyDrawerOpen] = useState(false);

  // Edit contexts
  const [editingType, setEditingType] = useState<any | null>(null);
  const [editingBalance, setEditingBalance] = useState<any | null>(null);

  // Form States
  const [typeForm, setTypeForm] = useState({
    name: '',
    code: '',
    accrual_type: 'YEARLY',
    allotted_per_year: '12',
    carry_forward_type: 'NONE',
    max_carry_forward: '0',
    is_paid: true,
    is_wfh: false
  });

  const [balanceForm, setBalanceForm] = useState({
    employee_id: '',
    leave_type_id: '',
    balance_year: String(new Date().getFullYear()),
    allotted: '12',
    used: '0',
    remaining: '12'
  });

  const [transactionForm, setTransactionForm] = useState({
    employee_id: '',
    leave_type_id: '',
    amount: '1',
    transaction_type: 'MANUAL_ADJUSTMENT',
    remarks: ''
  });

  const [applyForm, setApplyForm] = useState({
    leave_type_id: '',
    from_date: new Date().toISOString().split('T')[0],
    to_date: new Date().toISOString().split('T')[0],
    total_days: '1',
    reason: ''
  });

  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('superadmin');
  const me = employees.find(emp => emp.email?.toLowerCase() === email.toLowerCase());

  const visibleTabs = LEAVE_TABS.filter(t => hasPermission(t.permission));

  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.find(t => t.id === activeTab)) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [visibleTabs.map(t => t.id).join(',')]);

  useEffect(() => {
    const storedRoles = localStorage.getItem('roles');
    const storedEmail = localStorage.getItem('email');
    const storedCompanyId = localStorage.getItem('companyId');
    let parsedRoles: string[] = [];
    if (storedRoles) {
      parsedRoles = JSON.parse(storedRoles);
      setRoles(parsedRoles);
    }
    if (storedEmail) setEmail(storedEmail);
    if (storedCompanyId) setCompanyId(storedCompanyId);

    const isSuper = parsedRoles.includes('SuperAdmin') || parsedRoles.includes('superadmin');
    if (isSuper) {
      setViewScope('team');
    }
  }, []);

  // Fetch functions
  const fetchEmployees = async () => {
    if (!companyId && !isSuperAdmin) return;
    const cid = companyId || 'all';
    try {
      const res = await fetch(`http://localhost:5000/api/v1/employees?companyId=${cid}`, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) setEmployees(data.employees || []);
    } catch (e) {
      console.error('Error fetching employees:', e);
    }
  };

  const fetchLeaveTypes = async () => {
    if (!companyId && !isSuperAdmin) return;
    const cid = companyId || 'all';
    try {
      const res = await fetch(`http://localhost:5000/api/v1/leave-types?companyId=${cid}`, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) setLeaveTypes(data.leaveTypes || []);
    } catch (e) {
      console.error('Error fetching leave types:', e);
    }
  };

  const fetchLeaveBalances = async () => {
    if (!companyId && !isSuperAdmin) return;
    const cid = companyId || 'all';
    try {
      const res = await fetch(`http://localhost:5000/api/v1/leave-balances/all?companyId=${cid}`, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) setBalances(data.balances || []);
    } catch (e) {
      console.error('Error fetching leave balances:', e);
    }
  };

  const fetchLeaveRequests = async (scopeParam?: 'my' | 'team') => {
    if (!companyId && !isSuperAdmin) return;
    const cid = companyId || 'all';
    const isSuper = roles.includes('SuperAdmin') || roles.includes('superadmin');
    const targetScope = isSuper ? 'team' : (scopeParam || viewScope);
    try {
      const res = await fetch(`http://localhost:5000/api/v1/leave-requests?companyId=${cid}&scope=${targetScope}`, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) setRequests(data.requests || []);
    } catch (e) {
      console.error('Error fetching leave requests:', e);
    }
  };

  const fetchTransactionLogs = async () => {
    if (!companyId && !isSuperAdmin) return;
    const cid = companyId || 'all';
    try {
      const res = await fetch(`http://localhost:5000/api/v1/leave-transaction-logs?companyId=${cid}`, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) setTransactionLogs(data.logs || []);
    } catch (e) {
      console.error('Error fetching leave transactions:', e);
    }
  };

  const fetchCompanies = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/v1/companies', { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) setCompanies(data.companies || []);
    } catch (e) {
      console.error('Error fetching companies:', e);
    }
  };

  const loadAllData = async (targetScope?: 'my' | 'team') => {
    if (!companyId && !isSuperAdmin) return;
    setIsLoading(true);
    await Promise.all([
      fetchEmployees(),
      fetchLeaveTypes(),
      fetchLeaveBalances(),
      fetchLeaveRequests(targetScope || (isSuperAdmin ? 'team' : viewScope)),
      fetchTransactionLogs()
    ]);
    setIsLoading(false);
  };

  useEffect(() => {
    if (isSuperAdmin) {
      fetchCompanies();
    }
  }, [companyId, isSuperAdmin]);

  useEffect(() => {
    if (companyId || isSuperAdmin) {
      loadAllData();
    }
  }, [companyId, isSuperAdmin]);

  const handleCompanyChange = (id: string) => {
    const val = id || null;
    setCompanyId(val);
    if (val) {
      localStorage.setItem('companyId', val);
    } else {
      localStorage.removeItem('companyId');
    }
  };

  const handleScopeChange = (scope: 'my' | 'team') => {
    setViewScope(scope);
    setActiveTab('requests');
    fetchLeaveRequests(scope);
  };

  // Leave Apply Handlers
  const handleOpenApplyDrawer = () => {
    setApplyForm({
      leave_type_id: leaveTypes.length > 0 ? leaveTypes[0].id : '',
      from_date: new Date().toISOString().split('T')[0],
      to_date: new Date().toISOString().split('T')[0],
      total_days: '1',
      reason: ''
    });
    setApplyDrawerOpen(true);
  };

  const handleSaveApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyForm.leave_type_id || !applyForm.from_date || !applyForm.to_date || !applyForm.total_days || !applyForm.reason) {
      showToast('Please fill in all required leave application fields.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('http://localhost:5000/api/v1/leave-requests', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          companyId,
          employee_id: me?.id,
          leave_type_id: applyForm.leave_type_id,
          from_date: applyForm.from_date,
          to_date: applyForm.to_date,
          total_days: parseFloat(applyForm.total_days),
          reason: applyForm.reason
        })
      });

      if (res.ok) {
        showToast('🌴 Leave application submitted successfully!', 'success');
        setApplyDrawerOpen(false);
        fetchLeaveRequests('my');
        fetchLeaveBalances();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to submit leave application', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Connection to server failed', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Leave Types handlers
  const handleOpenTypeDrawer = (typeObj: any = null) => {
    if (typeObj) {
      setEditingType(typeObj);
      setTypeForm({
        name: typeObj.name,
        code: typeObj.code || '',
        accrual_type: typeObj.accrual_type || 'YEARLY',
        allotted_per_year: String(typeObj.allotted_per_year),
        carry_forward_type: typeObj.carry_forward_type || 'NONE',
        max_carry_forward: String(typeObj.max_carry_forward || 0),
        is_paid: typeObj.is_paid,
        is_wfh: typeObj.is_wfh || false
      });
    } else {
      setEditingType(null);
      setTypeForm({
        name: '',
        code: '',
        accrual_type: 'YEARLY',
        allotted_per_year: '12',
        carry_forward_type: 'NONE',
        max_carry_forward: '0',
        is_paid: true,
        is_wfh: false
      });
    }
    setTypeDrawerOpen(true);
  };

  const handleSaveLeaveType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!typeForm.name || !typeForm.code || !typeForm.allotted_per_year) {
      showToast('Name, Code and Allotted Days are required.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const url = editingType 
        ? `http://localhost:5000/api/v1/leave-types/${editingType.id}` 
        : 'http://localhost:5000/api/v1/leave-types';
      const method = editingType ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify({
          companyId,
          ...typeForm,
          allotted_per_year: parseFloat(typeForm.allotted_per_year),
          max_carry_forward: parseFloat(typeForm.max_carry_forward)
        })
      });

      if (res.ok) {
        showToast(editingType ? 'Leave type updated successfully!' : 'Leave type created successfully!', 'success');
        setTypeDrawerOpen(false);
        fetchLeaveTypes();
        fetchLeaveBalances();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to save leave type', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Connection to server failed', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLeaveType = async (id: string) => {
    if (!confirm('Are you sure you want to delete this leave type? It will be marked inactive.')) return;
    try {
      const res = await fetch(`http://localhost:5000/api/v1/leave-types/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
        body: JSON.stringify({ companyId })
      });
      if (res.ok) {
        showToast('Leave type deleted successfully', 'success');
        fetchLeaveTypes();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to delete leave type', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Connection to server failed', 'error');
    }
  };

  // Leave Balances handlers
  const handleOpenBalanceDrawer = (balObj: any = null) => {
    if (balObj) {
      setEditingBalance(balObj);
      setBalanceForm({
        employee_id: balObj.employee_id,
        leave_type_id: balObj.leave_type_id,
        balance_year: String(balObj.balance_year),
        allotted: String(balObj.allotted),
        used: String(balObj.used),
        remaining: String(balObj.remaining)
      });
    } else {
      setEditingBalance(null);
      setBalanceForm({
        employee_id: employees.length > 0 ? employees[0].id : '',
        leave_type_id: leaveTypes.length > 0 ? leaveTypes[0].id : '',
        balance_year: String(new Date().getFullYear()),
        allotted: '12',
        used: '0',
        remaining: '12'
      });
    }
    setBalanceDrawerOpen(true);
  };

  const handleSaveLeaveBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!balanceForm.employee_id || !balanceForm.leave_type_id || !balanceForm.allotted) {
      showToast('Employee, Leave Type and Allotted days are required.', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const url = editingBalance 
        ? `http://localhost:5000/api/v1/leave-balances/${editingBalance.id}` 
        : 'http://localhost:5000/api/v1/leave-balances';
      const method = editingBalance ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify({
          employee_id: balanceForm.employee_id,
          leave_type_id: balanceForm.leave_type_id,
          balance_year: parseInt(balanceForm.balance_year),
          allotted: parseFloat(balanceForm.allotted),
          used: parseFloat(balanceForm.used),
          remaining: parseFloat(balanceForm.remaining)
        })
      });

      if (res.ok) {
        showToast(editingBalance ? 'Leave balance updated successfully!' : 'Leave balance initialized successfully!', 'success');
        setBalanceDrawerOpen(false);
        fetchLeaveBalances();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to save leave balance.', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Connection to server failed', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLeaveBalance = async (id: string) => {
    if (!confirm('Are you sure you want to delete this employee leave balance?')) return;
    try {
      const res = await fetch(`http://localhost:5000/api/v1/leave-balances/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (res.ok) {
        showToast('Leave balance record deleted successfully', 'success');
        fetchLeaveBalances();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to delete leave balance', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Connection to server failed', 'error');
    }
  };

  // Leave Requests handlers (Approve/Reject)
  const handleProcessRequest = async (id: string, action: 'APPROVED' | 'REJECTED') => {
    try {
      const res = await fetch(`http://localhost:5000/api/v1/leave-requests/${id}/action`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ action })
      });
      if (res.ok) {
        showToast(`Leave request ${action.toLowerCase()} successfully.`, action === 'APPROVED' ? 'success' : 'info');
        fetchLeaveRequests(viewScope);
        fetchLeaveBalances();
        fetchTransactionLogs();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to process leave request.', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Connection to server failed', 'error');
    }
  };

  // Transaction Log handler
  const handleOpenTransactionDrawer = () => {
    setTransactionForm({
      employee_id: employees.length > 0 ? employees[0].id : '',
      leave_type_id: leaveTypes.length > 0 ? leaveTypes[0].id : '',
      amount: '1',
      transaction_type: 'MANUAL_ADJUSTMENT',
      remarks: ''
    });
    setTransactionDrawerOpen(true);
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transactionForm.employee_id || !transactionForm.leave_type_id || !transactionForm.amount) {
      showToast('Employee, Leave Type, and Amount are required.', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch('http://localhost:5000/api/v1/leave-transaction-logs', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          employee_id: transactionForm.employee_id,
          leave_type_id: transactionForm.leave_type_id,
          amount: parseFloat(transactionForm.amount),
          transaction_type: transactionForm.transaction_type,
          remarks: transactionForm.remarks
        })
      });

      if (res.ok) {
        showToast('Balance adjustment transaction log added successfully!', 'success');
        setTransactionDrawerOpen(false);
        fetchTransactionLogs();
        fetchLeaveBalances();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to save transaction log.', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Connection to server failed', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate My Quotas & Team Stats
  const myBalances = me ? balances.filter(b => b.employee_id === me.id) : balances;
  const hasSubordinates = isSuperAdmin || roles.includes('Manager') || roles.includes('manager') || (me && employees.some(e => e.reporting_to_id === me.id));
  const pendingTeamCount = requests.filter(r => r.status === 'PENDING').length;
  const approvedTeamCount = requests.filter(r => r.status === 'APPROVED').length;
  const rejectedTeamCount = requests.filter(r => r.status === 'REJECTED').length;

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }} className="font-['DM_Sans',sans-serif] space-y-6 animate-fadeIn w-full text-slate-800 dark:text-slate-100">
      <DashboardPageHeader
        title="Leave Management & Types"
        actionMessage=""
        actionError=""
        companies={companies}
        companyId={companyId}
        handleCompanyChange={handleCompanyChange}
        isSuperAdmin={isSuperAdmin}
        email={email}
        hideCompanySelect={!isSuperAdmin}
        hideUserBadge={true}
        noneLabel="All"
      />

      {/* 🌟 UNIFIED CLEAN HEADER & SCOPE TOGGLE BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center text-lg font-bold border border-blue-100 dark:border-blue-900/30 flex-shrink-0">
            🌴
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">Leave & Absences Console</h2>
              <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase tracking-wider border border-blue-100 dark:border-blue-900/30">
                {isSuperAdmin ? 'Admin Console' : (viewScope === 'my' ? 'Personal View' : 'Manager Console')}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              {isSuperAdmin
                ? 'Manage company-wide leave requests, employee balances, leave types, and transaction logs.'
                : (viewScope === 'my'
                  ? 'Track your entitlements, submit applications, and review absence records.'
                  : 'Manage direct report leave approvals and team availability.')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto flex-wrap sm:flex-nowrap">
          {/* My vs Team Segmented Switcher (Visible ONLY if NOT SuperAdmin AND user has subordinates) */}
          {!isSuperAdmin && hasSubordinates && (
            <div className="p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 flex items-center gap-1">
              <button
                onClick={() => handleScopeChange('my')}
                className={`py-1.5 px-3.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                  viewScope === 'my'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
                My View
              </button>
              <button
                onClick={() => handleScopeChange('team')}
                className={`py-1.5 px-3.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                  viewScope === 'team'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197M12 12.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" />
                </svg>
                Team View
                {pendingTeamCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[9px] font-bold">
                    {pendingTeamCount}
                  </span>
                )}
              </button>
            </div>
          )}

          {/* Primary Action Button (Hidden for SuperAdmin unless permitted) */}
          {!isSuperAdmin && viewScope === 'my' && hasPermission('create_leave_requests') && (
            <button
              onClick={handleOpenApplyDrawer}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 border-0 shadow-xs active:scale-98"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Apply For Leave
            </button>
          )}
        </div>
      </div>

      {/* 👤 MY VIEW COMPACT SLEEK COUNT CARDS (Hidden for SuperAdmin) */}
      {!isSuperAdmin && viewScope === 'my' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {leaveTypes.length === 0 ? (
            <div className="col-span-full p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-center text-xs font-medium text-slate-400">
              No active leave types configured.
            </div>
          ) : (
            leaveTypes.map(type => {
              const b = myBalances.find(item => item.leave_type_id === type.id);
              const remaining = b ? parseFloat(b.remaining) : parseFloat(type.allotted_per_year);
              const allotted = b ? parseFloat(b.allotted) : parseFloat(type.allotted_per_year);
              const used = b ? parseFloat(b.used) : 0;
              const pending = b ? parseFloat(b.pending_approval || 0) : 0;

              return (
                <div 
                  key={type.id} 
                  className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:border-blue-500/30 transition-all duration-200 flex items-center justify-between gap-3 text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center justify-center border border-blue-100 dark:border-blue-900/40 flex-shrink-0">
                      {type.code}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">{type.name}</h4>
                        <span className={`text-[8.5px] font-extrabold px-1.5 py-0.2 rounded uppercase ${type.is_paid ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-rose-50 text-rose-600'}`}>
                          {type.is_paid ? 'PAID' : 'LOP'}
                        </span>
                      </div>
                      <p className="text-[10.5px] font-medium text-slate-400 mt-0.5">Used: {used}d • Pending: {pending}d</p>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className="text-xl font-extrabold text-slate-900 dark:text-white leading-none">
                      {remaining} <span className="text-[10px] font-bold text-slate-400">/ {allotted}</span>
                    </div>
                    <span className="text-[9.5px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                      Available
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 👥 TEAM VIEW COMPACT SUMMARY COUNT CARDS (Hidden for SuperAdmin) */}
      {!isSuperAdmin && viewScope === 'team' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex items-center justify-between text-left">
            <div>
              <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">Total Requests</p>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">{requests.length}</h3>
            </div>
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center text-xs font-bold">
              📋
            </div>
          </div>

          <div className="p-3.5 rounded-2xl border border-amber-200/80 dark:border-amber-900/30 bg-amber-50/40 dark:bg-amber-950/20 shadow-xs flex items-center justify-between text-left">
            <div>
              <p className="text-[10.5px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Pending Review</p>
              <h3 className="text-xl font-extrabold text-amber-700 dark:text-amber-300 mt-0.5">{pendingTeamCount}</h3>
            </div>
            <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xs font-bold">
              ⏳
            </div>
          </div>

          <div className="p-3.5 rounded-2xl border border-emerald-200/80 dark:border-emerald-900/30 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-xs flex items-center justify-between text-left">
            <div>
              <p className="text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Approved</p>
              <h3 className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-0.5">{approvedTeamCount}</h3>
            </div>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-bold">
              ✅
            </div>
          </div>

          <div className="p-3.5 rounded-2xl border border-rose-200/80 dark:border-rose-900/30 bg-rose-50/40 dark:bg-rose-950/20 shadow-xs flex items-center justify-between text-left">
            <div>
              <p className="text-[10.5px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Rejected</p>
              <h3 className="text-xl font-extrabold text-rose-700 dark:text-rose-300 mt-0.5">{rejectedTeamCount}</h3>
            </div>
            <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 flex items-center justify-center text-xs font-bold">
              ❌
            </div>
          </div>
        </div>
      )}

      {/* SUB-NAVIGATION TABS */}
      {visibleTabs.length > 0 && (
        <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-2">
          <nav className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {visibleTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-1.5 px-3.5 rounded-xl text-xs font-bold tracking-wide transition-all duration-200 cursor-pointer flex items-center gap-1.5 flex-shrink-0 ${
                  activeTab === tab.id
                    ? 'bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shadow-2xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                }`}
              >
                <span>
                  {tab.id === 'requests' ? '📝' : tab.id === 'balances' ? '📊' : tab.id === 'types' ? '⚙️' : '📜'}
                </span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* Tab Panels */}
      <div className="space-y-6">

        {/* 1. LEAVE REQUESTS TAB */}
        {activeTab === 'requests' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest text-left">
                  {viewScope === 'my' ? 'My Leave Applications' : 'Team Leave Applications'}
                </h3>
                <p className="text-[10.5px] text-slate-400 dark:text-slate-500 font-medium mt-0.5 text-left">
                  {viewScope === 'my' ? 'Track your personal leave requests status' : 'Review and take administrative actions on team requests'}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-400 font-bold uppercase tracking-wider text-[9.5px]">
                      <th className="py-3 px-3">Employee</th>
                      <th className="py-3 px-3">Leave Type</th>
                      <th className="py-3 px-3">From Date</th>
                      <th className="py-3 px-3">To Date</th>
                      <th className="py-3 px-3 text-center">Days</th>
                      <th className="py-3 px-3">Reason</th>
                      <th className="py-3 px-3 text-center">Status</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400 dark:text-slate-500 font-medium">Loading applications...</td>
                      </tr>
                    ) : requests.length === 0 ? (
                      <tr>
                        <td colSpan={8}>
                          <div className="py-10 px-4 text-center flex flex-col items-center justify-center space-y-2">
                            <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center text-lg">
                              {viewScope === 'my' ? '🌴' : '📋'}
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                {viewScope === 'my' ? 'No Leave Applications Found' : 'No Pending Team Approvals'}
                              </h4>
                              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium max-w-xs mt-0.5">
                                {viewScope === 'my' 
                                  ? 'You have not submitted any leave requests yet.' 
                                  : 'All direct report requests have been processed.'}
                              </p>
                            </div>
                            {viewScope === 'my' && hasPermission('create_leave_requests') && (
                              <button
                                onClick={handleOpenApplyDrawer}
                                className="mt-1 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer border-0"
                              >
                                Apply For Leave
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      requests.map(req => (
                        <tr key={req.id} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all">
                          <td className="py-3.5 px-3 font-bold text-slate-800 dark:text-slate-200">{req.employee_name}</td>
                          <td className="py-3.5 px-3 font-semibold text-slate-600 dark:text-slate-300">
                            {req.leave_type_name} <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-bold">{req.leave_type_code}</span>
                          </td>
                          <td className="py-3.5 px-3 text-slate-600 dark:text-slate-400 font-medium">{new Date(req.from_date).toLocaleDateString()}</td>
                          <td className="py-3.5 px-3 text-slate-600 dark:text-slate-400 font-medium">{new Date(req.to_date).toLocaleDateString()}</td>
                          <td className="py-3.5 px-3 text-center font-bold text-slate-700 dark:text-slate-300">{req.total_days}</td>
                          <td className="py-3.5 px-3 text-slate-500 dark:text-slate-400 italic">"{req.reason}"</td>
                          <td className="py-3.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[9.5px] font-bold uppercase tracking-wider ${
                              req.status === 'APPROVED' 
                                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/30' 
                                : req.status === 'PENDING' 
                                  ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/30' 
                                  : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/50 dark:border-rose-900/30'
                            }`}>
                              {req.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-right">
                            {(viewScope === 'team' || isSuperAdmin) && req.status === 'PENDING' && hasPermission('edit_leave_requests') ? (
                              <div className="flex gap-1.5 justify-end">
                                <button
                                  onClick={() => handleProcessRequest(req.id, 'APPROVED')}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-[10px] font-bold uppercase tracking-wider text-white transition-colors cursor-pointer border-0 shadow-2xs"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleProcessRequest(req.id, 'REJECTED')}
                                  className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-[10px] font-bold uppercase tracking-wider text-white transition-colors cursor-pointer border-0 shadow-2xs"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium italic">
                                {req.status === 'PENDING' ? 'Awaiting Review' : `Processed by ${req.approved_by_name || 'System'}`}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 2. LEAVE BALANCES TAB */}
        {activeTab === 'balances' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest text-left">Employee Leave Quotas</h3>
                <p className="text-[10.5px] text-slate-400 dark:text-slate-500 font-medium mt-0.5 text-left">Track and edit employee leaf balance ledgers</p>
              </div>
              {hasPermission('create_leave_balances') && (
                <button
                  onClick={() => handleOpenBalanceDrawer(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 border-0 shadow-xs"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Initialize Balance
                </button>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-400 font-bold uppercase tracking-wider text-[9.5px]">
                      <th className="py-3 px-3">Employee</th>
                      <th className="py-3 px-3">Leave Type</th>
                      <th className="py-3 px-3 text-center">Year</th>
                      <th className="py-3 px-3 text-center">Allotted</th>
                      <th className="py-3 px-3 text-center">Used</th>
                      <th className="py-3 px-3 text-center">Pending Review</th>
                      <th className="py-3 px-3 text-center">Remaining</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400 dark:text-slate-500 font-medium">Loading...</td>
                      </tr>
                    ) : balances.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400 dark:text-slate-500 font-medium">No leave balances initialized.</td>
                      </tr>
                    ) : (
                      balances.map(bal => (
                        <tr key={bal.id} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all">
                          <td className="py-3.5 px-3">
                            <span className="font-bold text-slate-800 dark:text-slate-200">{bal.employee_name}</span>
                            <span className="block text-[10px] font-mono text-slate-400 dark:text-slate-500 font-semibold mt-0.5">{bal.emp_id_code}</span>
                          </td>
                          <td className="py-3.5 px-3 font-semibold text-slate-600 dark:text-slate-300">
                            {bal.leave_type_name} <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-bold">{bal.leave_type_code}</span>
                          </td>
                          <td className="py-3.5 px-3 text-center font-mono font-semibold text-slate-600 dark:text-slate-400">{bal.balance_year}</td>
                          <td className="py-3.5 px-3 text-center font-bold text-slate-700 dark:text-slate-300">{bal.allotted}</td>
                          <td className="py-3.5 px-3 text-center font-bold text-slate-600 dark:text-slate-400">{bal.used}</td>
                          <td className="py-3.5 px-3 text-center font-bold text-amber-600 dark:text-amber-400">{bal.pending_approval}</td>
                          <td className="py-3.5 px-3 text-center font-extrabold text-blue-600 dark:text-blue-400">{bal.remaining}</td>
                          <td className="py-3.5 px-3 text-right">
                            <div className="flex gap-1.5 justify-end">
                              {hasPermission('edit_leave_balances') && (
                                <button
                                  onClick={() => handleOpenBalanceDrawer(bal)}
                                  className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-[10px] font-bold uppercase tracking-wider text-white transition-colors cursor-pointer border-0 shadow-2xs"
                                >
                                  Edit
                                </button>
                              )}
                              {hasPermission('delete_leave_balances') && (
                                <button
                                  onClick={() => handleDeleteLeaveBalance(bal.id)}
                                  className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-[10px] font-bold uppercase tracking-wider text-white transition-colors cursor-pointer border-0 shadow-2xs"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 3. LEAVE TYPES TAB */}
        {activeTab === 'types' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest text-left">Leave Types</h3>
                <p className="text-[10.5px] text-slate-400 dark:text-slate-500 font-medium mt-0.5 text-left">Configure annual entitlements, accrual patterns and categories</p>
              </div>
              {hasPermission('create_leave_types') && (
                <button
                  onClick={() => handleOpenTypeDrawer(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 border-0 shadow-xs"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Create Leave Type
                </button>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-400 font-bold uppercase tracking-wider text-[9.5px]">
                      <th className="py-3 px-3">Code</th>
                      <th className="py-3 px-3">Leave Name</th>
                      <th className="py-3 px-3">Category</th>
                      <th className="py-3 px-3">Accrual Type</th>
                      <th className="py-3 px-3 text-center">Annual Entitlement</th>
                      <th className="py-3 px-3">Carry Forward</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400 dark:text-slate-500 font-medium">Loading...</td>
                      </tr>
                    ) : leaveTypes.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400 dark:text-slate-500 font-medium">No leave types configured.</td>
                      </tr>
                    ) : (
                      leaveTypes.map(t => (
                        <tr key={t.id} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all">
                          <td className="py-3.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">{t.code}</td>
                          <td className="py-3.5 px-3 font-bold text-slate-800 dark:text-slate-200">
                            <div className="flex items-center gap-2">
                              <span>{t.name}</span>
                              {t.is_wfh && (
                                <span className="bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/30 px-1.5 py-0.2 rounded text-[8.5px] font-bold tracking-wider uppercase">
                                  WFH
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-3">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${t.is_paid ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'}`}>
                              {t.is_paid ? 'PAID' : 'UNPAID'}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 font-medium text-slate-500 dark:text-slate-400">{t.accrual_type}</td>
                          <td className="py-3.5 px-3 text-center font-bold text-slate-700 dark:text-slate-300">{t.allotted_per_year} Days</td>
                          <td className="py-3.5 px-3 font-medium text-slate-500 dark:text-slate-400">
                            {t.carry_forward_type === 'NONE' ? 'No' : `Yes (Max: ${t.max_carry_forward} Days)`}
                          </td>
                          <td className="py-3.5 px-3 text-right">
                            <div className="flex gap-1.5 justify-end">
                              {hasPermission('edit_leave_types') && (
                                <button
                                  onClick={() => handleOpenTypeDrawer(t)}
                                  className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-[10px] font-bold uppercase tracking-wider text-white transition-colors cursor-pointer border-0 shadow-2xs"
                                >
                                  Edit
                                </button>
                              )}
                              {hasPermission('delete_leave_types') && (
                                <button
                                  onClick={() => handleDeleteLeaveType(t.id)}
                                  className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-[10px] font-bold uppercase tracking-wider text-white transition-colors cursor-pointer border-0 shadow-2xs"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 4. TRANSACTION LOGS TAB */}
        {activeTab === 'transactions' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest text-left">Absence Ledger Logs</h3>
                <p className="text-[10.5px] text-slate-400 dark:text-slate-500 font-medium mt-0.5 text-left">Audit log trail of credits, manual entries and usage</p>
              </div>
              {(hasPermission('create_leave_transaction_logs') || hasPermission('edit_leave_balances')) && (
                <button
                  onClick={handleOpenTransactionDrawer}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 border-0 shadow-xs"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Post Adjustment
                </button>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-400 font-bold uppercase tracking-wider text-[9.5px]">
                      <th className="py-3 px-3">Timestamp</th>
                      <th className="py-3 px-3">Employee</th>
                      <th className="py-3 px-3">Leave Type</th>
                      <th className="py-3 px-3 text-center">Amount</th>
                      <th className="py-3 px-3">Transaction Type</th>
                      <th className="py-3 px-3">Action By</th>
                      <th className="py-3 px-3">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400 dark:text-slate-500 font-medium">Loading...</td>
                      </tr>
                    ) : transactionLogs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400 dark:text-slate-500 font-medium">No transaction history found.</td>
                      </tr>
                    ) : (
                      transactionLogs.map(log => {
                        const amt = parseFloat(log.amount);
                        const isPositive = amt > 0;
                        return (
                          <tr key={log.id} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all">
                            <td className="py-3.5 px-3 font-mono text-slate-500 dark:text-slate-400">
                              {new Date(log.transaction_date).toLocaleString()}
                            </td>
                            <td className="py-3.5 px-3">
                              <span className="font-bold text-slate-800 dark:text-slate-200">{log.employee_name}</span>
                              <span className="block text-[10px] font-mono text-slate-400 dark:text-slate-500 font-semibold mt-0.5">{log.emp_id_code}</span>
                            </td>
                            <td className="py-3.5 px-3 font-semibold text-slate-600 dark:text-slate-300">
                              {log.leave_type_name} <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-bold">{log.leave_type_code}</span>
                            </td>
                            <td className={`py-3.5 px-3 text-center font-bold text-sm ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                              {isPositive ? `+${amt}` : amt}
                            </td>
                            <td className="py-3.5 px-3">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                log.transaction_type === 'ACCRUAL' 
                                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' 
                                  : log.transaction_type === 'USAGE'
                                    ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                                    : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400'
                              }`}>
                                {log.transaction_type}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 text-slate-700 dark:text-slate-300 font-semibold">
                              {log.performer_name || 'System'}
                            </td>
                            <td className="py-3.5 px-3 text-slate-500 dark:text-slate-400 italic">
                              "{log.remarks || 'None'}"
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* SLIDE DRAWERS */}
      <SlideDrawer
        isOpen={applyDrawerOpen}
        onClose={() => setApplyDrawerOpen(false)}
        title="Apply For Leave"
      >
        <form onSubmit={handleSaveApplyLeave} className="space-y-4 text-left font-['DM_Sans',sans-serif]">

          {/* 📊 LIVE LEAVE BALANCES QUICK CHIPS SUMMARY */}
          {leaveTypes.length > 0 && (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Your Current Available Balances</span>
                <span className="text-[9.5px] font-bold text-blue-600 dark:text-blue-400">Year {new Date().getFullYear()}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {leaveTypes.map(t => {
                  const b = myBalances.find(item => item.leave_type_id === t.id);
                  const remaining = b ? parseFloat(b.remaining) : parseFloat(t.allotted_per_year);
                  const allotted = b ? parseFloat(b.allotted) : parseFloat(t.allotted_per_year);
                  const isSelected = applyForm.leave_type_id === t.id;
                  return (
                    <div
                      key={t.id}
                      onClick={() => setApplyForm({ ...applyForm, leave_type_id: t.id })}
                      className={`p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-between text-xs ${
                        isSelected 
                          ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-500 text-blue-700 dark:text-blue-300 font-bold shadow-2xs' 
                          : 'bg-white dark:bg-slate-900 border-slate-200/70 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      <span className="truncate">{t.name} ({t.code})</span>
                      <span className={`px-1.5 py-0.2 rounded font-mono text-[10px] font-black ${
                        remaining > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                      }`}>
                        {remaining}/{allotted}d
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="block text-[9.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Select Leave Type *</label>
            <SearchableSelect
              options={leaveTypes.map(t => ({
                value: t.id,
                label: `${t.name} (${t.code}) - ${t.is_paid ? 'PAID' : 'UNPAID'}`
              }))}
              value={applyForm.leave_type_id}
              onChange={val => setApplyForm({ ...applyForm, leave_type_id: val })}
              placeholder="-- Choose Leave Type --"
              required
            />

            {/* Selected Leave Type Balance Indicator Badge */}
            {applyForm.leave_type_id && (() => {
              const selectedType = leaveTypes.find(t => t.id === applyForm.leave_type_id);
              const b = myBalances.find(item => item.leave_type_id === applyForm.leave_type_id);
              const rem = b ? parseFloat(b.remaining) : (selectedType ? parseFloat(selectedType.allotted_per_year) : 0);
              const allot = b ? parseFloat(b.allotted) : (selectedType ? parseFloat(selectedType.allotted_per_year) : 0);
              const used = b ? parseFloat(b.used) : 0;
              const pending = b ? parseFloat(b.pending_approval || 0) : 0;

              return selectedType ? (
                <div className={`p-3 rounded-xl border flex items-center justify-between text-xs mt-2.5 ${
                  rem > 0 
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300' 
                    : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-300'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className="text-base">{rem > 0 ? '✅' : '⚠️'}</span>
                    <div>
                      <span className="font-bold">{selectedType.name} ({selectedType.code}) Balance:</span>
                      <span className="block text-[10.5px] font-medium opacity-85 mt-0.5">
                        Allotted: {allot} Days • Used: {used} Days • Pending: {pending} Days
                      </span>
                    </div>
                  </div>
                  <div className="text-right leading-none">
                    <span className="text-lg font-black">{rem}</span>
                    <span className="text-[9.5px] block font-bold mt-0.5 opacity-80">Days Left</span>
                  </div>
                </div>
              ) : null;
            })()}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[9.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">From Date *</label>
              <input
                type="date"
                required
                value={applyForm.from_date}
                onChange={e => setApplyForm({ ...applyForm, from_date: e.target.value })}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 transition-all shadow-xs"
              />
            </div>
            <div>
              <label className="block text-[9.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">To Date *</label>
              <input
                type="date"
                required
                value={applyForm.to_date}
                onChange={e => setApplyForm({ ...applyForm, to_date: e.target.value })}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 transition-all shadow-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-[9.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Total Days *</label>
            <input
              type="number"
              step="0.5"
              required
              min="0.5"
              value={applyForm.total_days}
              onChange={e => setApplyForm({ ...applyForm, total_days: e.target.value })}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 font-mono transition-all shadow-xs"
            />
          </div>

          <div>
            <label className="block text-[9.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Reason for Absence *</label>
            <textarea
              required
              placeholder="Provide a clear reason for your leave application..."
              value={applyForm.reason}
              onChange={e => setApplyForm({ ...applyForm, reason: e.target.value })}
              rows={3}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 transition-all shadow-xs"
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setApplyDrawerOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 text-xs font-bold text-slate-500 dark:text-slate-400 transition-all cursor-pointer bg-transparent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white shadow-xs transition-all cursor-pointer border-0"
            >
              {isSaving ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </form>
      </SlideDrawer>

      <SlideDrawer
        isOpen={typeDrawerOpen}
        onClose={() => setTypeDrawerOpen(false)}
        title={editingType ? 'Edit Leave Type Scheme' : 'Configure Leave Type Scheme'}
      >
        <form onSubmit={handleSaveLeaveType} className="space-y-4 text-left font-['DM_Sans',sans-serif]">
          <div>
            <label className="block text-[9.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Leave Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Sick Leave"
              value={typeForm.name}
              onChange={e => setTypeForm({ ...typeForm, name: e.target.value })}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 transition-all shadow-xs"
            />
          </div>

          <div>
            <label className="block text-[9.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Type Identifier Code *</label>
            <input
              type="text"
              required
              maxLength={10}
              placeholder="e.g. SL"
              value={typeForm.code}
              onChange={e => setTypeForm({ ...typeForm, code: e.target.value.toUpperCase() })}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 font-mono transition-all shadow-xs"
            />
          </div>

          <div>
            <label className="block text-[9.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Category *</label>
            <div className="grid grid-cols-2 gap-4">
              <label className={`flex items-center justify-center p-2.5 rounded-xl border cursor-pointer select-none transition-all text-center text-xs font-bold ${
                typeForm.is_paid
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                  : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50/20'
              }`}>
                <input
                  type="radio"
                  className="sr-only"
                  checked={typeForm.is_paid}
                  onChange={() => setTypeForm({ ...typeForm, is_paid: true })}
                />
                PAID
              </label>
              <label className={`flex items-center justify-center p-2.5 rounded-xl border cursor-pointer select-none transition-all text-center text-xs font-bold ${
                !typeForm.is_paid
                  ? 'bg-rose-50 border-rose-500 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                  : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50/20'
              }`}>
                <input
                  type="radio"
                  className="sr-only"
                  checked={!typeForm.is_paid}
                  onChange={() => setTypeForm({ ...typeForm, is_paid: false })}
                />
                UNPAID (LOP)
              </label>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 px-1 py-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={typeForm.is_wfh}
                onChange={e => setTypeForm({ ...typeForm, is_wfh: e.target.checked })}
                className="w-4 h-4 rounded border-slate-200 dark:border-slate-800 text-blue-600 focus:ring-blue-500/20"
              />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-350">
                Is Work From Home (WFH) Policy?
              </span>
            </label>
          </div>

          <div>
            <label className="block text-[9.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Annual Allotment Days *</label>
            <input
              type="number"
              step="0.5"
              required
              value={typeForm.allotted_per_year}
              onChange={e => setTypeForm({ ...typeForm, allotted_per_year: e.target.value })}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 transition-all shadow-xs"
            />
          </div>

          <div>
            <label className="block text-[9.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Accrual Type</label>
            <SearchableSelect
              options={[
                { value: 'YEARLY', label: 'YEARLY (Full allotment credited at start of year)' },
                { value: 'MONTHLY', label: 'MONTHLY (Prorated monthly increment)' }
              ]}
              value={typeForm.accrual_type}
              onChange={val => setTypeForm({ ...typeForm, accrual_type: val })}
              placeholder="Select Accrual Type"
            />
          </div>

          <div>
            <label className="block text-[9.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Carry Forward Rule</label>
            <SearchableSelect
              options={[
                { value: 'NONE', label: 'NONE (Expired at end of year)' },
                { value: 'LAPSE', label: 'LAPSE (Carry forward up to limit)' }
              ]}
              value={typeForm.carry_forward_type}
              onChange={val => setTypeForm({ ...typeForm, carry_forward_type: val })}
              placeholder="Select Rule"
            />
          </div>

          {typeForm.carry_forward_type !== 'NONE' && (
            <div>
              <label className="block text-[9.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Max Carry Forward Limit (Days)</label>
              <input
                type="number"
                step="0.5"
                value={typeForm.max_carry_forward}
                onChange={e => setTypeForm({ ...typeForm, max_carry_forward: e.target.value })}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 transition-all shadow-xs"
              />
            </div>
          )}

          <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setTypeDrawerOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 text-xs font-bold text-slate-500 dark:text-slate-400 transition-all cursor-pointer bg-transparent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-xs transition-all cursor-pointer border-0"
            >
              {isSaving ? 'Saving...' : 'Save Type'}
            </button>
          </div>
        </form>
      </SlideDrawer>

      <SlideDrawer
        isOpen={balanceDrawerOpen}
        onClose={() => setBalanceDrawerOpen(false)}
        title={editingBalance ? 'Edit Employee Leave Balance' : 'Initialize Employee Leave Balance'}
      >
        <form onSubmit={handleSaveLeaveBalance} className="space-y-4 text-left font-['DM_Sans',sans-serif]">
          <div>
            <label className="block text-[9.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Employee *</label>
            <SearchableSelect
              options={employees.map(emp => ({
                value: emp.id,
                label: `${emp.emp_id_code} - ${emp.first_name} ${emp.last_name}`
              }))}
              value={balanceForm.employee_id}
              onChange={val => setBalanceForm({ ...balanceForm, employee_id: val })}
              placeholder="-- Select Employee --"
              required
              disabled={!!editingBalance}
            />
          </div>

          <div>
            <label className="block text-[9.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Leave Type *</label>
            <SearchableSelect
              options={leaveTypes.map(t => ({
                value: t.id,
                label: `${t.name} (${t.code})`
              }))}
              value={balanceForm.leave_type_id}
              onChange={val => setBalanceForm({ ...balanceForm, leave_type_id: val })}
              placeholder="-- Select Leave Type --"
              required
              disabled={!!editingBalance}
            />
          </div>

          <div>
            <label className="block text-[9.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Balance Calendar Year *</label>
            <input
              type="number"
              required
              value={balanceForm.balance_year}
              onChange={e => setBalanceForm({ ...balanceForm, balance_year: e.target.value })}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 font-mono transition-all shadow-xs"
              disabled={!!editingBalance}
            />
          </div>

          <div>
            <label className="block text-[9.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Allotted Days *</label>
            <input
              type="number"
              step="0.5"
              required
              value={balanceForm.allotted}
              onChange={e => setBalanceForm({ ...balanceForm, allotted: e.target.value })}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 transition-all shadow-xs"
            />
          </div>

          {editingBalance && (
            <>
              <div>
                <label className="block text-[9.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Used Days</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={balanceForm.used}
                  onChange={e => setBalanceForm({ ...balanceForm, used: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 transition-all shadow-xs"
                />
              </div>

              <div>
                <label className="block text-[9.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Remaining Days</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={balanceForm.remaining}
                  onChange={e => setBalanceForm({ ...balanceForm, remaining: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 transition-all shadow-xs"
                />
              </div>
            </>
          )}

          <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setBalanceDrawerOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 text-xs font-bold text-slate-500 dark:text-slate-400 transition-all cursor-pointer bg-transparent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-xs transition-all cursor-pointer border-0"
            >
              {isSaving ? 'Saving...' : 'Save Balance'}
            </button>
          </div>
        </form>
      </SlideDrawer>

      <SlideDrawer
        isOpen={transactionDrawerOpen}
        onClose={() => setTransactionDrawerOpen(false)}
        title="Post Balance Adjustment Ledger Transaction"
      >
        <form onSubmit={handleSaveTransaction} className="space-y-4 text-left font-['DM_Sans',sans-serif]">
          <div>
            <label className="block text-[9.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Employee *</label>
            <SearchableSelect
              options={employees.map(emp => ({
                value: emp.id,
                label: `${emp.emp_id_code} - ${emp.first_name} ${emp.last_name}`
              }))}
              value={transactionForm.employee_id}
              onChange={val => setTransactionForm({ ...transactionForm, employee_id: val })}
              placeholder="-- Select Employee --"
              required
            />
          </div>

          <div>
            <label className="block text-[9.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Leave Type *</label>
            <SearchableSelect
              options={leaveTypes.map(t => ({
                value: t.id,
                label: `${t.name} (${t.code})`
              }))}
              value={transactionForm.leave_type_id}
              onChange={val => setTransactionForm({ ...transactionForm, leave_type_id: val })}
              placeholder="-- Select Leave Type --"
              required
            />
          </div>

          <div>
            <label className="block text-[9.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Transaction Type *</label>
            <SearchableSelect
              options={[
                { value: 'MANUAL_ADJUSTMENT', label: 'MANUAL_ADJUSTMENT (Admin correction)' },
                { value: 'ACCRUAL', label: 'ACCRUAL (Add extra/bonus allotment)' },
                { value: 'USAGE', label: 'USAGE (Deduct/simulate leave consumption)' },
                { value: 'CARRY_FORWARD', label: 'CARRY_FORWARD (Carry forward adjustment)' }
              ]}
              value={transactionForm.transaction_type}
              onChange={val => setTransactionForm({ ...transactionForm, transaction_type: val })}
              placeholder="Select Transaction Type"
              required
            />
          </div>

          <div>
            <label className="block text-[9.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Amount (Days) *</label>
            <input
              type="number"
              step="0.5"
              required
              placeholder="e.g. 2 for credits or -2 for debits"
              value={transactionForm.amount}
              onChange={e => setTransactionForm({ ...transactionForm, amount: e.target.value })}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 font-sans transition-all shadow-xs"
            />
          </div>

          <div>
            <label className="block text-[9.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Remarks / Reason *</label>
            <textarea
              required
              placeholder="e.g. Prorated balance adjustment / medical review approved"
              value={transactionForm.remarks}
              onChange={e => setTransactionForm({ ...transactionForm, remarks: e.target.value })}
              rows={3}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 transition-all shadow-xs"
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setTransactionDrawerOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 text-xs font-bold text-slate-500 dark:text-slate-400 transition-all cursor-pointer bg-transparent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-xs transition-all cursor-pointer border-0"
            >
              {isSaving ? 'Posting...' : 'Post Transaction'}
            </button>
          </div>
        </form>
      </SlideDrawer>
    </div>
  );
}
