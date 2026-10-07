'use client';

import React, { useState, useEffect } from 'react';

type Tab = 'live_logs' | 'pre_approved' | 'visitor_db';

export default function VisitorManagement() {
  const [activeTab, setActiveTab] = useState<Tab>('live_logs');
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [newCheckIn, setNewCheckIn] = useState({
    name: '',
    phone_number: '',
    visitor_type: 'GUEST',
    host_id: null,
    purpose: 'Meeting'
  });

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      const res = await fetch('/api/v1/visitors/logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'live_logs') {
      fetchLogs();
    }
  }, [activeTab]);

  const handleCheckIn = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch('/api/v1/visitors/checkin', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newCheckIn)
      });
      if (res.ok) {
        setShowCheckInModal(false);
        fetchLogs();
        setNewCheckIn({ name: '', phone_number: '', visitor_type: 'GUEST', host_id: null, purpose: 'Meeting' });
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans">
      
      {/* PAGE HEADER */}
      <div className="flex-shrink-0 bg-transparent px-8 pt-8 pb-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">Visitor Management</h1>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mt-2">
            Track Office Walk-ins, Candidates, Vendors & Guests
          </p>
        </div>
      </div>

      {/* TOOLBAR CARD (TABS + CREATE BUTTON) */}
      <div className="flex-shrink-0 px-8 pb-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-4 border-l-[#07518a] rounded-xl p-2 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
          
          {/* TABS */}
          <div className="flex overflow-x-auto no-scrollbar gap-1">
            {[
              { id: 'live_logs', label: "Today's Logs (Live)", icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
              { id: 'pre_approved', label: 'Pre-Approved / Invites', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
              { id: 'visitor_db', label: 'Visitor Database', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as Tab)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                    isActive
                      ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} /></svg>
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* CREATE BUTTON */}
          <div className="pr-2">
            <button 
              onClick={() => setShowCheckInModal(true)}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md shadow-emerald-500/20 active:scale-95 whitespace-nowrap"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Check-in
            </button>
          </div>

        </div>
      </div>

      {/* TAB CONTENT AREA */}
      <div className="flex-1 overflow-y-auto p-8 relative">
        
        {/* =============================================================== */}
        {/* LIVE LOGS TAB (CRUD: visitor_logs) */}
        {/* =============================================================== */}
        {activeTab === 'live_logs' && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm animate-fadeIn">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
              <div>
                <h2 className="text-xl font-black text-slate-800 dark:text-white">Live Check-ins</h2>
                <p className="text-xs font-semibold text-slate-500 mt-1">Manage active visitor_logs</p>
              </div>
              <div className="flex gap-3">
                <select className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 shadow-sm focus:ring-2 focus:ring-emerald-500">
                  <option>All Types</option>
                  <option>Candidates</option>
                  <option>Guests</option>
                  <option>Vendors</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/30 text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <th className="p-5 font-black">Visitor</th>
                    <th className="p-5 font-black">Type</th>
                    <th className="p-5 font-black">Host / Reason</th>
                    <th className="p-5 font-black">Badge No.</th>
                    <th className="p-5 font-black">Entry Time</th>
                    <th className="p-5 font-black text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {loading ? (
                    <tr><td colSpan={6} className="p-5 text-center text-slate-500">Loading logs...</td></tr>
                  ) : logs.length === 0 ? (
                    <tr><td colSpan={6} className="p-5 text-center text-slate-500">No visitors currently checked in today.</td></tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-emerald-50/30 dark:hover:bg-slate-800/50 transition-colors group">
                        <td className="p-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-500">
                              {log.name ? log.name.substring(0, 2).toUpperCase() : 'V'}
                            </div>
                            <div>
                              <p className="font-black text-slate-800 dark:text-slate-100 text-base">{log.name}</p>
                              <p className="text-xs font-bold text-slate-500">{log.phone_number}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-5">
                          <span className={`px-3 py-1 rounded-lg text-xs font-black tracking-wide border shadow-sm ${
                            log.visitor_type === 'CANDIDATE' ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-400' :
                            log.visitor_type === 'VENDOR' ? 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-400' :
                            'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-400'
                          }`}>
                            {log.visitor_type || 'GUEST'}
                          </span>
                        </td>
                        <td className="p-5">
                          <p className="font-bold text-slate-700 dark:text-slate-300">Internal Host</p>
                          <p className="text-xs font-semibold text-slate-500">{log.purpose || 'Meeting'}</p>
                        </td>
                        <td className="p-5 font-mono font-black text-slate-600 dark:text-slate-400">V-{log.id.substring(0,4).toUpperCase()}</td>
                        <td className="p-5 font-black text-emerald-600 dark:text-emerald-400">
                          {new Date(log.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="p-5 text-right">
                          <button className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-rose-50 hover:border-rose-200 dark:hover:bg-rose-900/30 dark:hover:border-rose-800 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 ml-auto" title="Update exit_time">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                            Check Out
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =============================================================== */}
        {/* PRE-APPROVED TAB */}
        {/* =============================================================== */}
        {activeTab === 'pre_approved' && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-10 animate-fadeIn flex flex-col items-center justify-center min-h-[400px] shadow-sm">
            <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-5 border border-slate-200 dark:border-slate-700 shadow-inner">
              <svg className="w-10 h-10 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
            <h3 className="font-black text-xl text-slate-700 dark:text-slate-300 mb-2">No Upcoming Invites</h3>
            <p className="text-slate-500 font-semibold text-center max-w-sm">Scheduled interviews and pre-approved visitors will appear here automatically.</p>
          </div>
        )}

        {/* =============================================================== */}
        {/* VISITOR DB TAB (CRUD: visitors) */}
        {/* =============================================================== */}
        {activeTab === 'visitor_db' && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-10 animate-fadeIn flex flex-col items-center justify-center min-h-[400px] shadow-sm">
            <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-5 border border-slate-200 dark:border-slate-700 shadow-inner">
              <svg className="w-10 h-10 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            </div>
            <h3 className="font-black text-xl text-slate-700 dark:text-slate-300 mb-2">Visitor Master Database</h3>
            <p className="text-slate-500 font-semibold text-center max-w-sm">All historical 'visitors' table data will be listed here.</p>
          </div>
        )}

        {/* =============================================================== */}
        {/* MODAL PLACEHOLDER */}
        {/* =============================================================== */}
        {showCheckInModal && (
          <div className="fixed inset-0 z-50 overflow-hidden font-sans">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setShowCheckInModal(false)}></div>
            <div className="fixed inset-y-0 right-0 max-w-lg w-full flex shadow-2xl transform transition-transform duration-300">
              <div className="w-full h-full bg-white dark:bg-slate-900 flex flex-col">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-emerald-50/50 dark:bg-emerald-900/20">
                  <h2 className="text-xl font-black text-slate-800 dark:text-white">New Visitor Check-in</h2>
                  <button onClick={() => setShowCheckInModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-full hover:bg-white dark:hover:bg-slate-800 shadow-sm transition-all">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Visitor Name</label>
                    <input type="text" value={newCheckIn.name} onChange={e => setNewCheckIn({...newCheckIn, name: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Full Name" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Phone Number</label>
                    <input type="tel" value={newCheckIn.phone_number} onChange={e => setNewCheckIn({...newCheckIn, phone_number: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="+91" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Visitor Type</label>
                    <select value={newCheckIn.visitor_type} onChange={e => setNewCheckIn({...newCheckIn, visitor_type: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500">
                      <option value="CANDIDATE">CANDIDATE</option>
                      <option value="GUEST">GUEST</option>
                      <option value="VENDOR">VENDOR</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Purpose</label>
                    <input type="text" value={newCheckIn.purpose} onChange={e => setNewCheckIn({...newCheckIn, purpose: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="e.g. Interview, Meeting, Delivery" />
                  </div>
                </div>
                <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-900">
                  <button onClick={() => setShowCheckInModal(false)} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-sm">Cancel</button>
                  <button onClick={handleCheckIn} className="px-5 py-2.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-500/20 active:scale-95 transition-all text-sm flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    Check In
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
