'use client';

import React, { useEffect, useState } from 'react';
import DashboardPageHeader from '../components/DashboardPageHeader';
import { getHeaders, getUrl } from '../utils/api';
import SlideDrawer from '../components/SlideDrawer';
import { useDashboard } from '../components/DashboardContext';

export default function LeaveTypesAndLogsPage() {
  const { showToast } = useDashboard();
  const [companyId, setCompanyId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'types' | 'transactions'>('types');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [transactionLogs, setTransactionLogs] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  // Drawers
  const [typeDrawerOpen, setTypeDrawerOpen] = useState(false);
  const [transactionDrawerOpen, setTransactionDrawerOpen] = useState(false);

  const [editingType, setEditingType] = useState<any | null>(null);

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

  const [transactionForm, setTransactionForm] = useState({
    employee_id: '',
    leave_type_id: '',
    amount: '1',
    transaction_type: 'MANUAL_ADJUSTMENT',
    remarks: ''
  });

  useEffect(() => {
    const storedCompanyId = localStorage.getItem('companyId');
    if (storedCompanyId) setCompanyId(storedCompanyId);
  }, []);

  useEffect(() => {
    fetchLeaveTypes();
    fetchTransactionLogs();
    fetchEmployees();
  }, [companyId]);

  const fetchLeaveTypes = async () => {
    setIsLoading(true);
    const cid = companyId || 'all';
    try {
      const res = await fetch(`/api/v1/leave-types?companyId=${cid}`, {
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
    if (!confirm('Are you sure you want to delete this leave type?')) return;
    try {
      const res = await fetch(`/api/v1/leave-types/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Leave type deleted', 'success');
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
    setIsSaving(true);
    try {
      const res = await fetch(getUrl('/api/v1/leave-requests'), {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          ...transactionForm,
          amount: Number(transactionForm.amount)
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Leave transaction posted successfully', 'success');
        setTransactionDrawerOpen(false);
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
      is_wfh: lt.is_wfh === true
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
      is_wfh: false
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
                  className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
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

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditType(lt)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Edit Leave Type"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteLeaveType(lt.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Delete Leave Type"
                      >
                        🗑️
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

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
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
            <select
              value={transactionForm.employee_id}
              onChange={e => setTransactionForm(prev => ({ ...prev, employee_id: e.target.value }))}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs"
              required
            >
              <option value="">-- Choose Employee --</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name} ({emp.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Select Leave Category *</label>
            <select
              value={transactionForm.leave_type_id}
              onChange={e => setTransactionForm(prev => ({ ...prev, leave_type_id: e.target.value }))}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs"
              required
            >
              <option value="">-- Choose Category --</option>
              {leaveTypes.map(lt => (
                <option key={lt.id} value={lt.id}>
                  {lt.name} ({lt.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Adjustment Amount (Use + for credit, - for debit)
            </label>
            <input
              type="number"
              step="0.5"
              value={transactionForm.amount}
              onChange={e => setTransactionForm(prev => ({ ...prev, amount: e.target.value }))}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs"
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
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs"
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
    </div>
  );
}
