'use client';

import React, { useEffect, useState } from 'react';
import DashboardPageHeader from '../components/DashboardPageHeader';
import { getHeaders, getUrl } from '../utils/api';
import SlideDrawer from '../components/SlideDrawer';
import { useDashboard } from '../components/DashboardContext';
import SearchableSelect from '../components/SearchableSelect';
import { Edit3, Trash2 } from 'lucide-react';
import { usePermissions } from '../hooks/usePermissions';

export default function LeaveTypesAndLogsPage() {
  const { showToast, companyId } = useDashboard();
  const { hasPermission, isSuperAdmin } = usePermissions();

  const canView = isSuperAdmin || hasPermission('leaves_view') || hasPermission('view_leave_types') || hasPermission('leaves_types_view');
  const canCreate = isSuperAdmin || hasPermission('leaves_create') || hasPermission('create_leave_types') || hasPermission('leaves_types_create');
  const canEdit = isSuperAdmin || hasPermission('leaves_edit') || hasPermission('edit_leave_types') || hasPermission('leaves_types_edit');
  const canDelete = isSuperAdmin || hasPermission('leaves_delete') || hasPermission('delete_leave_types') || hasPermission('leaves_types_delete');

  const [activeTab, setActiveTab] = useState<'types' | 'transactions'>('types');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [transactionLogs, setTransactionLogs] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  // Drawers & Modals
  const [typeDrawerOpen, setTypeDrawerOpen] = useState(false);
  const [transactionDrawerOpen, setTransactionDrawerOpen] = useState(false);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ open: boolean; item: any | null }>({
    open: false,
    item: null
  });

  const [editingType, setEditingType] = useState<any | null>(null);

  const [typeForm, setTypeForm] = useState({
    name: '',
    code: '',
    allotted_per_year: '12',
    monthly_accrual: false,
    monthly_carry_forward: true,
    monthly_carry_limit: '0',
    yearly_accrual: true,
    yearly_carry_forward: false,
    yearly_carry_limit: '0',
    is_paid: true,
    is_wfh: false,
    is_active: true
  });

  const [transactionForm, setTransactionForm] = useState({
    employee_id: '',
    leave_type_id: '',
    adjustment_type: 'CREDIT',
    amount: '1',
    transaction_type: 'MANUAL_ADJUSTMENT',
    remarks: ''
  });

  const employeeOptions = employees.map(emp => {
    const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Staff Member';
    const code = emp.emp_id_code || emp.employee_id || emp.emp_code || '';
    return {
      value: emp.id,
      label: code ? `${fullName} (${code})` : fullName
    };
  });

  const leaveTypeOptions = leaveTypes
    .filter(lt => lt.is_active !== false)
    .map(lt => ({
      value: lt.id,
      label: `${lt.name} (${lt.code})`
    }));

  useEffect(() => {
    if (canView) {
      fetchLeaveTypes();
      fetchTransactionLogs();
      fetchEmployees();
    }
  }, [companyId, canView]);

  const fetchLeaveTypes = async () => {
    setIsLoading(true);
    const cid = companyId || 'all';
    try {
      const res = await fetch(`/api/v1/leave-types?companyId=${cid}&includeInactive=true`, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) setLeaveTypes(data.leaveTypes || []);
    } catch (e) {
      showToast('Error loading leave types', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean, name?: string) => {
    try {
      const res = await fetch(`/api/v1/leave-types/${id}/toggle-status`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ is_active: !currentStatus, companyId: companyId || undefined })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Leave type ${name ? `'${name}' ` : ''}${!currentStatus ? 'activated' : 'deactivated'} successfully`, 'success');
        fetchLeaveTypes();
      } else {
        showToast(data.error || 'Failed to update status', 'error');
      }
    } catch (e) {
      showToast('Connection error', 'error');
    }
  };

  const fetchTransactionLogs = async () => {
    const cid = companyId || 'all';
    try {
      const res = await fetch(getUrl('/api/v1/leave-requests', cid), {
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) setTransactionLogs(data.transactions || []);
    } catch (e) {}
  };

  const fetchEmployees = async () => {
    const cid = companyId || 'all';
    try {
      const res = await fetch(`/api/v1/employees?companyId=${cid}`, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) setEmployees(data.employees || []);
    } catch (e) {}
  };

  const handleSaveLeaveType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!typeForm.name || !typeForm.code) {
      showToast('Please enter leave type name and code', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const method = editingType ? 'PUT' : 'POST';
      const url = editingType
        ? `/api/v1/leave-types/${editingType.id}`
        : '/api/v1/leave-types';

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify({
          ...typeForm,
          companyId: companyId || undefined,
          allotted_per_year: Number(typeForm.allotted_per_year),
          monthly_carry_limit: Number(typeForm.monthly_carry_limit || 0),
          yearly_carry_limit: Number(typeForm.yearly_carry_limit || 0)
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Leave type ${editingType ? 'updated' : 'created'} successfully`, 'success');
        setTypeDrawerOpen(false);
        setEditingType(null);
        fetchLeaveTypes();
      } else {
        showToast(data.error || 'Failed to save leave type', 'error');
      }
    } catch (e) {
      showToast('Connection error', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLeaveType = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/leave-types/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Leave type deleted successfully', 'success');
        setDeleteConfirmModal({ open: false, item: null });
        fetchLeaveTypes();
      } else {
        showToast(data.error || 'Failed to delete leave type', 'error');
      }
    } catch (e) {
      showToast('Connection failure', 'error');
    }
  };

  const handlePostTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transactionForm.employee_id || !transactionForm.leave_type_id) {
      showToast('Please select employee and leave category', 'error');
      return;
    }
    const numAmount = Math.abs(Number(transactionForm.amount) || 0);
    if (numAmount <= 0) {
      showToast('Please enter a valid adjustment amount greater than 0', 'error');
      return;
    }
    const finalAmount = transactionForm.adjustment_type === 'DEBIT' ? -numAmount : numAmount;

    setIsSaving(true);
    try {
      const res = await fetch(getUrl('/api/v1/leave-requests'), {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          employee_id: transactionForm.employee_id,
          leave_type_id: transactionForm.leave_type_id,
          amount: finalAmount,
          transaction_type: transactionForm.transaction_type,
          remarks: transactionForm.remarks
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Leave transaction posted successfully', 'success');
        setTransactionDrawerOpen(false);
        setTransactionForm({
          employee_id: '',
          leave_type_id: '',
          adjustment_type: 'CREDIT',
          amount: '1',
          transaction_type: 'MANUAL_ADJUSTMENT',
          remarks: ''
        });
        fetchTransactionLogs();
      } else {
        showToast(data.error || 'Failed to post transaction', 'error');
      }
    } catch (e) {
      showToast('Connection failure', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const openEditType = (lt: any) => {
    setEditingType(lt);
    setTypeForm({
      name: lt.name || '',
      code: lt.code || '',
      allotted_per_year: String(lt.allotted_per_year || 12),
      monthly_accrual: lt.monthly_accrual === true || lt.accrual_type === 'MONTHLY',
      monthly_carry_forward: lt.monthly_carry_forward !== false,
      monthly_carry_limit: String(lt.monthly_carry_limit || 0),
      yearly_accrual: lt.yearly_accrual !== false,
      yearly_carry_forward: lt.yearly_carry_forward === true || (lt.carry_forward_type && lt.carry_forward_type !== 'NONE'),
      yearly_carry_limit: String(lt.yearly_carry_limit || lt.max_carry_forward || 0),
      is_paid: lt.is_paid !== false,
      is_wfh: lt.is_wfh === true,
      is_active: lt.is_active !== false
    });
    setTypeDrawerOpen(true);
  };

  const openNewType = () => {
    setEditingType(null);
    setTypeForm({
      name: '',
      code: '',
      allotted_per_year: '12',
      monthly_accrual: false,
      monthly_carry_forward: true,
      monthly_carry_limit: '0',
      yearly_accrual: true,
      yearly_carry_forward: false,
      yearly_carry_limit: '0',
      is_paid: true,
      is_wfh: false,
      is_active: true
    });
    setTypeDrawerOpen(true);
  };

  if (!canView) {
    return (
      <div className="space-y-6 pb-12">
        <DashboardPageHeader
          title="Leave Types Master & Transaction Audit Logs"
          companyId={companyId}
          hideCompanySelect={true}
          hideUserBadge={true}
        />
        <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
          <div className="w-14 h-14 bg-rose-50 dark:bg-rose-950/50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-3 text-2xl font-bold">
            🚫
          </div>
          <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100">Access Restricted</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            You do not have permission to view leave types. Please contact your system administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <DashboardPageHeader
        title="Leave Types Master & Transaction Audit Logs"
        companyId={companyId}
        hideCompanySelect={true}
        hideUserBadge={true}
      >
        {canCreate && (
          <button
            onClick={activeTab === 'types' ? openNewType : () => setTransactionDrawerOpen(true)}
            className="px-4 py-2 bg-[#07518a] hover:bg-[#053d69] text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            <span>{activeTab === 'types' ? 'Create Leave Type' : 'Post Manual Adjustment'}</span>
          </button>
        )}
      </DashboardPageHeader>

      {/* 🎛️ TAB SWITCHER */}
      <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('types')}
          className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === 'types'
              ? 'bg-white dark:bg-slate-900 text-[#07518a] dark:text-[#38bdf8] shadow-sm'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          ⚙️ Leave Types Master ({leaveTypes.length})
        </button>
        <button
          onClick={() => setActiveTab('transactions')}
          className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === 'transactions'
              ? 'bg-white dark:bg-slate-900 text-[#07518a] dark:text-[#38bdf8] shadow-sm'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          📜 Absence Transaction Ledger ({transactionLogs.length})
        </button>
      </div>

      {/* TAB 1: LEAVE TYPES MASTER */}
      {activeTab === 'types' && (
        <div>
          {isLoading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-2.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="w-7 h-7 border-3 border-[#07518a] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#07518a] dark:text-[#38bdf8]">Loading leave types...</span>
            </div>
          ) : leaveTypes.length === 0 ? (
            <div className="p-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
              <span className="text-4xl block mb-2">⚙️</span>
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">No Leave Types Configured</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Create leave categories like Sick Leave (SL), Casual Leave (CL), or Earned Leave (EL) for your organization.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {leaveTypes.map(lt => {
                const formatOneDecimal = (val: any) => {
                  if (val === undefined || val === null || val === '') return '0.0';
                  const num = Number(val);
                  if (isNaN(num)) return '0.0';
                  return (Math.round(num * 10) / 10).toFixed(1);
                };

                return (
                  <div
                    key={lt.id}
                    className={`p-6 rounded-2xl bg-white dark:bg-slate-900 border ${
                      lt.is_active ? 'border-slate-200 dark:border-slate-800' : 'border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 opacity-90'
                    } shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-extrabold text-slate-900 dark:text-white">{lt.name}</h4>
                          <span className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 font-mono font-bold text-[10px]">
                            {lt.code}
                          </span>
                        </div>
                        <span className="text-xs text-slate-400 mt-0.5 block">Accrual: {lt.accrual_type}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={!canEdit}
                          onClick={() => handleToggleStatus(lt.id, lt.is_active, lt.name)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-extrabold transition-all ${
                            !canEdit
                              ? 'opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                              : lt.is_active
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800 cursor-pointer'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 cursor-pointer'
                          }`}
                          title={canEdit ? (lt.is_active ? "Click to Deactivate Policy" : "Click to Activate Policy") : "No edit permission"}
                        >
                          <span className="text-[10.5px] uppercase font-black tracking-wider">{lt.is_active ? 'Active' : 'Inactive'}</span>
                          <div
                            className={`relative inline-flex h-4.5 w-8 shrink-0 rounded-full border border-transparent transition-colors duration-200 ease-in-out ${
                              lt.is_active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                            }`}
                          >
                            <span
                              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                                lt.is_active ? 'translate-x-3.5' : 'translate-x-0'
                              }`}
                            />
                          </div>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-xs border border-slate-200/60 dark:border-slate-800">
                      <div>
                        <span className="text-[9.5px] text-slate-400 uppercase font-bold block">Annual Quota</span>
                        <span className="font-extrabold text-slate-800 dark:text-slate-100 text-xs">{formatOneDecimal(lt.allotted_per_year)} Days</span>
                      </div>
                      <div>
                        <span className="text-[9.5px] text-slate-400 uppercase font-bold block">Monthly Carry</span>
                        <span className="font-extrabold text-slate-800 dark:text-slate-100 text-xs block">
                          {lt.monthly_carry_forward === false ? 'Disabled' : (Number(lt.monthly_carry_limit) > 0 ? `Cap: ${formatOneDecimal(lt.monthly_carry_limit)}` : 'Enabled')}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9.5px] text-slate-400 uppercase font-bold block">Yearly Carry</span>
                        <span className="font-extrabold text-slate-800 dark:text-slate-100 text-xs block">
                          {lt.yearly_carry_forward === true ? (Number(lt.yearly_carry_limit) > 0 ? `Cap: ${formatOneDecimal(lt.yearly_carry_limit)}` : 'Unlimited') : (lt.carry_forward_type && lt.carry_forward_type !== 'NONE' ? `Cap: ${formatOneDecimal(lt.max_carry_forward)}` : 'Disabled')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          lt.is_paid ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {lt.is_paid ? 'Paid Leave' : 'Unpaid Leave'}
                        </span>
                        {lt.is_wfh && (
                          <span className="px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-600 text-[10px] font-bold">
                            Work From Home
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {canEdit && (
                          <button
                            onClick={() => openEditType(lt)}
                            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950 dark:hover:text-indigo-400 transition-all flex items-center justify-center shadow-2xs cursor-pointer"
                            title="Edit Policy"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => setDeleteConfirmModal({ open: true, item: lt })}
                            className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-all flex items-center justify-center shadow-2xs cursor-pointer"
                            title="Delete Leave Type"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ABSENCE TRANSACTION LEDGER */}
      {activeTab === 'transactions' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {transactionLogs.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              No absence ledger transaction logs recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="p-4">Timestamp</th>
                    <th className="p-4">Employee</th>
                    <th className="p-4">Leave Type</th>
                    <th className="p-4">Amount</th>
                    <th className="p-4">Transaction Type</th>
                    <th className="p-4">Action By</th>
                    <th className="p-4">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {transactionLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="p-4 text-slate-500 font-mono text-[11px]">
                        {new Date(log.created_at || Date.now()).toLocaleString()}
                      </td>
                      <td className="p-4 font-bold text-slate-800 dark:text-slate-100">
                        {log.employee_name || 'Staff Member'}
                      </td>
                      <td className="p-4 font-semibold text-slate-700 dark:text-slate-200">
                        <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 font-bold text-[10px]">
                          {log.leave_type_code || log.leave_type_name || 'LEAVE'}
                        </span>
                      </td>
                      <td className="p-4 font-bold">
                        <span className={Number(log.amount) >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                          {Number(log.amount) >= 0 ? `+${log.amount}` : log.amount} Days
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-1 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 font-bold text-[10px]">
                          {log.transaction_type}
                        </span>
                      </td>
                      <td className="p-4 text-slate-500 font-medium">{log.created_by || 'System'}</td>
                      <td className="p-4 text-slate-400 italic max-w-xs truncate">{log.remarks || 'None'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 🚪 CREATE / EDIT LEAVE TYPE DRAWER */}
      <SlideDrawer
        isOpen={typeDrawerOpen}
        onClose={() => setTypeDrawerOpen(false)}
        title={editingType ? 'Edit Leave Type Policy' : 'Create New Leave Type'}
      >
        <form onSubmit={handleSaveLeaveType} className="space-y-4 p-4">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Leave Type Name *</label>
            <input
              type="text"
              placeholder="e.g. Sick Leave, Casual Leave"
              value={typeForm.name}
              onChange={e => setTypeForm(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Leave Code *</label>
            <input
              type="text"
              placeholder="e.g. SL, CL, EL"
              value={typeForm.code}
              onChange={e => setTypeForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs uppercase"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Allotted / Year (Annual Quota Days) *</label>
            <input
              type="number"
              step="0.5"
              value={typeForm.allotted_per_year}
              onChange={e => setTypeForm(prev => ({ ...prev, allotted_per_year: e.target.value }))}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100"
              required
            />
          </div>

          {/* MONTHLY LEAVE POLICY */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 space-y-3">
            <label className="text-xs font-extrabold text-slate-800 dark:text-slate-100 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span>🗓️</span> Monthly Accrual & Carry Policy
              </span>
            </label>

            <div className="space-y-3 pt-1">
              {/* Monthly Accrual Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 block">Monthly Accrual Credit</span>
                  <span className="text-[10px] text-slate-400 block">Leaves credit every month automatically</span>
                </div>
                <button
                  type="button"
                  onClick={() => setTypeForm(prev => ({ ...prev, monthly_accrual: !prev.monthly_accrual }))}
                  className={`relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    typeForm.monthly_accrual ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                    typeForm.monthly_accrual ? 'translate-x-4.5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* Monthly Carry Forward Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 block">Monthly Carry Forward</span>
                  <span className="text-[10px] text-slate-400 block">Unused monthly leaves carry forward to next month</span>
                </div>
                <button
                  type="button"
                  onClick={() => setTypeForm(prev => ({ ...prev, monthly_carry_forward: !prev.monthly_carry_forward }))}
                  className={`relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    typeForm.monthly_carry_forward ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                    typeForm.monthly_carry_forward ? 'translate-x-4.5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {typeForm.monthly_carry_forward && (
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Max Monthly Carry Limit (0 = No limit)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="e.g. 1.0"
                    value={typeForm.monthly_carry_limit}
                    onChange={e => setTypeForm(prev => ({ ...prev, monthly_carry_limit: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500"
                  />
                </div>
              )}
            </div>
          </div>

          {/* YEARLY LEAVE POLICY */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 space-y-3">
            <label className="text-xs font-extrabold text-slate-800 dark:text-slate-100 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span>📅</span> Yearly Accrual & Carry Policy
              </span>
            </label>

            <div className="space-y-3 pt-1">
              {/* Yearly Accrual Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 block">Yearly Upfront Accrual</span>
                  <span className="text-[10px] text-slate-400 block">Full annual quota allotted at start of year</span>
                </div>
                <button
                  type="button"
                  onClick={() => setTypeForm(prev => ({ ...prev, yearly_accrual: !prev.yearly_accrual }))}
                  className={`relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    typeForm.yearly_accrual ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                    typeForm.yearly_accrual ? 'translate-x-4.5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* Yearly Carry Forward Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 block">Yearly Carry Forward</span>
                  <span className="text-[10px] text-slate-400 block">Unused leaves carry forward to next year at year-end</span>
                </div>
                <button
                  type="button"
                  onClick={() => setTypeForm(prev => ({ ...prev, yearly_carry_forward: !prev.yearly_carry_forward }))}
                  className={`relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    typeForm.yearly_carry_forward ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                    typeForm.yearly_carry_forward ? 'translate-x-4.5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {typeForm.yearly_carry_forward && (
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Max Yearly Carry Limit / Cap (0 = Unlimited)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="e.g. 5.0"
                    value={typeForm.yearly_carry_limit}
                    onChange={e => setTypeForm(prev => ({ ...prev, yearly_carry_limit: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Paid Leave Category Toggle Switch */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
            <div>
              <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100 block">Paid Leave Category</span>
              <span className="text-[11px] text-slate-400 block">Select whether this is a paid or unpaid leave category</span>
            </div>
            <button
              type="button"
              onClick={() => setTypeForm(prev => ({ ...prev, is_paid: !prev.is_paid }))}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                typeForm.is_paid ? 'bg-[#07518a]' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  typeForm.is_paid ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Policy Status Toggle Switch */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
            <div>
              <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100 block">Policy Status</span>
              <span className="text-[11px] text-slate-400 block">Enable or disable this leave category</span>
            </div>
            <button
              type="button"
              onClick={() => setTypeForm(prev => ({ ...prev, is_active: !prev.is_active }))}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                typeForm.is_active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  typeForm.is_active ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 bg-[#07518a] hover:bg-[#053d69] text-white font-bold text-xs rounded-xl shadow transition-colors cursor-pointer"
            >
              {isSaving ? 'Saving...' : editingType ? 'Update Policy' : 'Create Policy'}
            </button>
            <button
              type="button"
              onClick={() => setTypeDrawerOpen(false)}
              className="px-4 py-2.5 border text-xs font-bold rounded-xl"
            >
              Cancel
            </button>
          </div>
        </form>
      </SlideDrawer>

      {/* 🚪 POST TRANSACTION DRAWER */}
      <SlideDrawer
        isOpen={transactionDrawerOpen}
        onClose={() => setTransactionDrawerOpen(false)}
        title="Post Manual Leave Adjustment"
      >
        <form onSubmit={handlePostTransaction} className="space-y-4 font-sans">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Select Employee *</label>
            <SearchableSelect
              options={employeeOptions}
              value={transactionForm.employee_id}
              onChange={val => setTransactionForm(prev => ({ ...prev, employee_id: val }))}
              placeholder="-- Search & Choose Employee --"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Select Leave Category *</label>
            <SearchableSelect
              options={leaveTypeOptions}
              value={transactionForm.leave_type_id}
              onChange={val => setTransactionForm(prev => ({ ...prev, leave_type_id: val }))}
              placeholder="-- Search & Choose Category --"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Adjustment Action *</label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setTransactionForm(prev => ({ ...prev, adjustment_type: 'CREDIT' }))}
                className={`py-2 px-3 text-xs font-extrabold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  transactionForm.adjustment_type === 'CREDIT'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <span>➕ Add Balance (Credit)</span>
              </button>
              <button
                type="button"
                onClick={() => setTransactionForm(prev => ({ ...prev, adjustment_type: 'DEBIT' }))}
                className={`py-2 px-3 text-xs font-extrabold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  transactionForm.adjustment_type === 'DEBIT'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <span>➖ Deduct Balance (Debit)</span>
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Adjustment Days (Amount) *
            </label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              placeholder="e.g. 1 or 0.5"
              value={transactionForm.amount}
              onChange={e => {
                const val = e.target.value.replace('-', '');
                setTransactionForm(prev => ({ ...prev, amount: val }));
              }}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Remarks / Audit Note *</label>
            <textarea
              rows={3}
              placeholder="State reason for manual adjustment..."
              value={transactionForm.remarks}
              onChange={e => setTransactionForm(prev => ({ ...prev, remarks: e.target.value }))}
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
              required
            />
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 bg-[#07518a] hover:bg-[#053d69] text-white font-bold text-xs rounded-xl shadow transition-colors cursor-pointer"
            >
              {isSaving ? 'Posting...' : 'Post Adjustment'}
            </button>
            <button
              type="button"
              onClick={() => setTransactionDrawerOpen(false)}
              className="px-4 py-2.5 border text-xs font-bold rounded-xl"
            >
              Cancel
            </button>
          </div>
        </form>
      </SlideDrawer>

      {/* ⚠️ DELETE CONFIRMATION MODAL */}
      {deleteConfirmModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center text-lg flex-shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Confirm Deactivation</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Are you sure you want to delete / deactivate <strong className="text-slate-800 dark:text-slate-200">"{deleteConfirmModal.item?.name}"</strong>?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteConfirmModal({ open: false, item: null })}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteLeaveType(deleteConfirmModal.item?.id)}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 rounded-xl hover:bg-rose-500 shadow-sm transition-colors"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
