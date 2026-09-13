'use client';

import React, { useEffect, useState } from 'react';
import DashboardPageHeader from '../components/DashboardPageHeader';
import { getHeaders, getUrl } from '../utils/api';
import SlideDrawer from '../components/SlideDrawer';
import { useDashboard } from '../components/DashboardContext';
import SearchableSelect from '../components/SearchableSelect';
import { Edit3, Trash2 } from 'lucide-react';

export default function LeaveTypesAndLogsPage() {
  const { showToast, companyId } = useDashboard();

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
    accrual_type: 'YEARLY',
    allotted_per_year: '12',
    carry_forward_type: 'NONE',
    max_carry_forward: '0',
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
    fetchLeaveTypes();
    fetchTransactionLogs();
    fetchEmployees();
  }, [companyId]);

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
          max_carry_forward: Number(typeForm.max_carry_forward)
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
      accrual_type: lt.accrual_type || 'YEARLY',
      allotted_per_year: String(lt.allotted_per_year || 12),
      carry_forward_type: lt.carry_forward_type || 'NONE',
      max_carry_forward: String(lt.max_carry_forward || 0),
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
      accrual_type: 'YEARLY',
      allotted_per_year: '12',
      carry_forward_type: 'NONE',
      max_carry_forward: '0',
      is_paid: true,
      is_wfh: false,
      is_active: true
    });
    setTypeDrawerOpen(true);
  };

  return (
    <div className="space-y-6 pb-12">
      <DashboardPageHeader
        title="Leave Types Master & Transaction Audit Logs"
        companyId={companyId}
        hideCompanySelect={true}
        hideUserBadge={true}
      >
        <button
          onClick={activeTab === 'types' ? openNewType : () => setTransactionDrawerOpen(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>{activeTab === 'types' ? 'Create Leave Type' : 'Post Manual Adjustment'}</span>
        </button>
      </DashboardPageHeader>

      {/* 🎛️ TAB SWITCHER */}
      <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('types')}
          className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'types'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          ⚙️ Leave Types Master ({leaveTypes.length})
        </button>
        <button
          onClick={() => setActiveTab('transactions')}
          className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'transactions'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm'
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
            <div className="p-12 flex flex-col items-center justify-center gap-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="w-8 h-8 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
              <span className="text-xs font-medium text-slate-400">Loading leave types...</span>
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
              {leaveTypes.map(lt => (
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
                        onClick={() => handleToggleStatus(lt.id, lt.is_active, lt.name)}
                        className={`px-3 py-1 rounded-full text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                          lt.is_active
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                        }`}
                        title={lt.is_active ? "Click to Deactivate" : "Click to Activate"}
                      >
                        <span className={`w-2 h-2 rounded-full ${lt.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                        <span>{lt.is_active ? 'Active' : 'Inactive'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Annual Quota</span>
                      <span className="font-extrabold text-slate-800 dark:text-slate-100">{lt.allotted_per_year} Days</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Carry Forward</span>
                      <span className="font-extrabold text-slate-800 dark:text-slate-100">
                        {lt.carry_forward_type === 'NONE' ? 'Disabled' : (lt.carry_forward_type === 'ALL' ? 'Unlimited' : `${lt.max_carry_forward || 0} Days Cap`)}
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
                      <button
                        onClick={() => openEditType(lt)}
                        className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950 dark:hover:text-indigo-400 transition-all flex items-center justify-center shadow-2xs"
                        title="Edit Policy"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmModal({ open: true, item: lt })}
                        className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-all flex items-center justify-center shadow-2xs"
                        title="Delete Leave Type"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Allotted / Year</label>
              <input
                type="number"
                value={typeForm.allotted_per_year}
                onChange={e => setTypeForm(prev => ({ ...prev, allotted_per_year: e.target.value }))}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Accrual Type</label>
              <select
                value={typeForm.accrual_type}
                onChange={e => setTypeForm(prev => ({ ...prev, accrual_type: e.target.value }))}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs"
              >
                <option value="YEARLY">Yearly Upfront</option>
                <option value="MONTHLY">Monthly Accrual</option>
              </select>
            </div>
          </div>

          {/* CARRY FORWARD SETTINGS */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 space-y-3">
            <label className="text-xs font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <i className="fa-solid fa-right-left text-indigo-500"></i>
              <span>Carry Forward Policy</span>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">Rule</label>
                <select
                  value={typeForm.carry_forward_type}
                  onChange={e => setTypeForm(prev => ({ ...prev, carry_forward_type: e.target.value }))}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="NONE">Disabled (No Carry Forward)</option>
                  <option value="LIMIT">Limited (Max Cap)</option>
                  <option value="ALL">Unlimited (Carry Forward All)</option>
                </select>
              </div>

              {typeForm.carry_forward_type === 'LIMIT' && (
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">Max Days Cap</label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="e.g. 5"
                    value={typeForm.max_carry_forward}
                    onChange={e => setTypeForm(prev => ({ ...prev, max_carry_forward: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Paid Leave Category</span>
            <input
              type="checkbox"
              checked={typeForm.is_paid}
              onChange={e => setTypeForm(prev => ({ ...prev, is_paid: e.target.checked }))}
              className="w-4 h-4 text-indigo-600 rounded"
            />
          </div>

          <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
            <div>
              <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100 block">Policy Status</span>
              <span className="text-[11px] text-slate-400 block">Enable or disable this leave category</span>
            </div>
            <button
              type="button"
              onClick={() => setTypeForm(prev => ({ ...prev, is_active: !prev.is_active }))}
              className={`px-3 py-1.5 rounded-full text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                typeForm.is_active
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700'
                  : 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-400 border border-rose-300 dark:border-rose-700'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${typeForm.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span>{typeForm.is_active ? 'Active' : 'Inactive'}</span>
            </button>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 bg-indigo-600 text-white font-bold text-xs rounded-xl shadow"
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
        <form onSubmit={handlePostTransaction} className="space-y-4 p-4">
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
              className="flex-1 py-2.5 bg-indigo-600 text-white font-bold text-xs rounded-xl shadow"
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
