'use client';

import React, { useState, useEffect } from 'react';
import DashboardPageHeader from '../components/DashboardPageHeader';

export default function GlobalConfigurationPage() {
  const [activeTab, setActiveTab] = useState<'email' | 'whatsapp' | 'campaigns' | 'rules'>('email');
  
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [smtpCreds, setSmtpCreds] = useState({ fromEmail: '', password: '', smtpServer: '', smtpType: 'TLS' });
  const [whatsappCreds, setWhatsappCreds] = useState({ url: '', apiKey: '' });
  
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  
  const [showSmtpModal, setShowSmtpModal] = useState(false);
  const [showWhatsappModal, setShowWhatsappModal] = useState(false);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  
  const [currentCampaign, setCurrentCampaign] = useState<any>({
    campaign_name: '',
    campaign_code: '',
    template_name: '',
    status: 'ACTIVE',
    parameters: {}
  });

  const [paramList, setParamList] = useState<{ key: string; val: string }[]>([]);
  const [currentRule, setCurrentRule] = useState<any>({});
  
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; type: 'campaign' | 'rule' | 'email' | 'whatsapp'; provider?: string } | null>(null);

  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchIntegrations = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const headers = { 'Authorization': `Bearer ${token}` };
      let q = selectedCompanyId ? `?company_id=${selectedCompanyId}` : '';
      
      const [emailRes, whatsappRes, campRes, rulesRes] = await Promise.all([
        fetch(`http://localhost:5000/api/v1/recruitment/settings/email${q}`, { headers }),
        fetch(`http://localhost:5000/api/v1/recruitment/settings/whatsapp${q}`, { headers }),
        fetch(`http://localhost:5000/api/v1/recruitment/settings/whatsapp-campaigns${q}`, { headers }),
        fetch(`http://localhost:5000/api/v1/recruitment/settings/notification-rules${q}`, { headers })
      ]);
      
      let tempIntegrations: any[] = [];
      if (emailRes.ok) {
        const emailData = await emailRes.json();
        if (emailData) {
          tempIntegrations.push({ provider: 'SMTP', is_active: emailData.is_active, id: emailData.id });
          setSmtpCreds({ 
            fromEmail: emailData.from_email || '', 
            password: emailData.smtp_password_encrypted || '', 
            smtpServer: emailData.smtp_host || '', 
            smtpType: emailData.encryption_type || 'TLS' 
          });
        } else {
          setSmtpCreds({ fromEmail: '', password: '', smtpServer: '', smtpType: 'TLS' });
        }
      }
      if (whatsappRes.ok) {
        const whatsappData = await whatsappRes.json();
        if (whatsappData) {
          tempIntegrations.push({ provider: 'WHATSAPP', is_active: whatsappData.is_active, id: whatsappData.id });
          setWhatsappCreds({ url: whatsappData.api_url || '', apiKey: whatsappData.api_key_encrypted || '' });
        } else {
          setWhatsappCreds({ url: '', apiKey: '' });
        }
      }
      setIntegrations(tempIntegrations);
      
      if (campRes.ok) setCampaigns(await campRes.json());
      if (rulesRes.ok) setRules(await rulesRes.json());
    } catch (err) {
      console.error('Error fetching integrations:', err);
    }
  };

  const fetchCompanies = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const storedCompanyId = localStorage.getItem('companyId');
      if (storedCompanyId && !selectedCompanyId) {
        setSelectedCompanyId(storedCompanyId);
      }

      if (!token) return;
      const payload = JSON.parse(atob(token.split('.')[1]));
      const tokenRoles = payload.realm_access?.roles || [];
      const preferredUsername = payload.preferred_username || '';
      const isSuper = tokenRoles.includes('SuperAdmin') || tokenRoles.includes('superadmin') || preferredUsername.toLowerCase() === 'superadmin';
      
      setIsSuperAdmin(!!isSuper);

      if (isSuper) {
        const res = await fetch('http://localhost:5000/api/v1/companies', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const comps = data.companies || [];
          setCompanies(comps);
          if (comps.length > 0 && !selectedCompanyId && !storedCompanyId) {
            setSelectedCompanyId(comps[0].id);
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  useEffect(() => {
    fetchIntegrations();
  }, [selectedCompanyId]);

  // Handle Opening Campaign Edit Modal safely preserving all parameters
  const openCreateCampaignModal = () => {
    setCurrentCampaign({
      campaign_name: '',
      campaign_code: '',
      template_name: '',
      status: 'ACTIVE',
      parameters: {}
    });
    setParamList([
      { key: 'candidate_name', val: '{{candidate_name}}' },
      { key: 'job_title', val: '{{job_title}}' }
    ]);
    setShowCampaignModal(true);
  };

  const openEditCampaignModal = (c: any) => {
    let parsed: Record<string, string> = {};
    if (c.parameters) {
      if (typeof c.parameters === 'object' && !Array.isArray(c.parameters)) {
        parsed = { ...c.parameters };
      } else if (typeof c.parameters === 'string') {
        try {
          parsed = JSON.parse(c.parameters);
        } catch {
          parsed = {};
        }
      }
    }

    const items = Object.keys(parsed).map(k => ({
      key: k,
      val: String(parsed[k] ?? '')
    }));

    if (items.length === 0) {
      items.push({ key: 'candidate_name', val: '{{candidate_name}}' });
    }

    setParamList(items);
    setCurrentCampaign({
      ...c,
      parameters: parsed
    });
    setShowCampaignModal(true);
  };

  const handleSaveIntegration = async (provider: string, credentials: any, isActive: boolean) => {
    try {
      const token = localStorage.getItem('access_token');
      let url = '';
      let payload = {};
      
      if (provider === 'SMTP') {
        url = 'http://localhost:5000/api/v1/recruitment/settings/email';
        payload = {
          company_id: selectedCompanyId,
          smtp_host: credentials.smtpServer,
          smtp_port: 587,
          smtp_username: credentials.fromEmail,
          smtp_password_encrypted: credentials.password,
          encryption_type: credentials.smtpType,
          from_email: credentials.fromEmail,
          from_name: 'HR Team',
          is_active: isActive
        };
      } else if (provider === 'WHATSAPP') {
        url = 'http://localhost:5000/api/v1/recruitment/settings/whatsapp';
        payload = {
          company_id: selectedCompanyId,
          provider: 'WHATSAPP',
          api_url: credentials.url,
          api_key_encrypted: credentials.apiKey,
          access_token_encrypted: credentials.apiKey,
          phone_number_id: '',
          business_account_id: '',
          is_active: isActive
        };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setShowSmtpModal(false);
        setShowWhatsappModal(false);
        fetchIntegrations();
        showToast(`${provider} configuration saved!`, 'success');
      } else {
        showToast(`Failed to save ${provider} settings`, 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error saving settings', 'error');
    }
  };

  const handleToggleIntegration = async (provider: string, currentStatus: boolean) => {
    const creds = provider === 'SMTP' ? smtpCreds : whatsappCreds;
    await handleSaveIntegration(provider, creds, !currentStatus);
  };

  const handleSaveCampaign = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const method = currentCampaign.id ? 'PUT' : 'POST';
      const url = currentCampaign.id 
        ? `http://localhost:5000/api/v1/recruitment/settings/whatsapp-campaigns/${currentCampaign.id}`
        : 'http://localhost:5000/api/v1/recruitment/settings/whatsapp-campaigns';
      
      // Reconstruct parameters object from paramList
      const builtParams: Record<string, string> = {};
      paramList.forEach(item => {
        if (item.key.trim()) {
          builtParams[item.key.trim()] = item.val || `{{${item.key.trim()}}}`;
        }
      });

      const payload = {
        ...currentCampaign,
        parameters: builtParams,
        company_id: selectedCompanyId
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setShowCampaignModal(false);
        fetchIntegrations();
        showToast('Campaign template saved successfully!', 'success');
      } else {
        showToast('Failed to save campaign template', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error saving campaign', 'error');
    }
  };

  const handleSaveRule = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const method = currentRule.id ? 'PUT' : 'POST';
      const url = currentRule.id 
        ? `http://localhost:5000/api/v1/recruitment/settings/notification-rules/${currentRule.id}`
        : 'http://localhost:5000/api/v1/recruitment/settings/notification-rules';
      
      const payload = {
        ...currentRule,
        company_id: selectedCompanyId,
        module: currentRule.module || 'RECRUITMENT'
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setShowRuleModal(false);
        fetchIntegrations();
        showToast('Notification rule saved successfully!', 'success');
      } else {
        showToast('Failed to save notification rule', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error saving rule', 'error');
    }
  };

  const executeDelete = async () => {
    if (!deleteConfirm) return;
    const { id, type, provider } = deleteConfirm;
    try {
      const token = localStorage.getItem('access_token');
      const headers = { 'Authorization': `Bearer ${token}` };
      
      if (type === 'email' || type === 'whatsapp') {
        const url = type === 'email' 
          ? 'http://localhost:5000/api/v1/recruitment/settings/email' 
          : 'http://localhost:5000/api/v1/recruitment/settings/whatsapp';
        await fetch(url, { method: 'DELETE', headers });
        fetchIntegrations();
        showToast(`${provider} gateway integration deleted`, 'success');
      } else if (type === 'campaign') {
        await fetch(`http://localhost:5000/api/v1/recruitment/settings/whatsapp-campaigns/${id}`, { method: 'DELETE', headers });
        fetchIntegrations();
        showToast('Campaign deleted successfully', 'success');
      } else if (type === 'rule') {
        await fetch(`http://localhost:5000/api/v1/recruitment/settings/notification-rules/${id}`, { method: 'DELETE', headers });
        fetchIntegrations();
        showToast('Rule deleted successfully', 'success');
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to delete item', 'error');
    } finally {
      setDeleteConfirm(null);
    }
  };

  // Helper to extract parameters count or list safely
  const getParamKeys = (campaign: any): string[] => {
    if (!campaign.parameters) return [];
    if (typeof campaign.parameters === 'object' && !Array.isArray(campaign.parameters)) {
      return Object.keys(campaign.parameters);
    }
    if (typeof campaign.parameters === 'string') {
      try {
        const obj = JSON.parse(campaign.parameters);
        return Object.keys(obj);
      } catch {
        return [];
      }
    }
    return [];
  };

  return (
    <div style={{ fontFamily: '"DM Sans", sans-serif' }} className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-y-auto">
      
      {/* 🔔 FLOATING TOAST NOTIFICATIONS */}
      {toast && (
        <div className={`fixed top-5 right-5 z-[100] px-5 py-3 rounded-2xl shadow-xl border flex items-center gap-3 transition-all animate-bounce ${
          toast.type === 'success' 
            ? 'bg-emerald-50 dark:bg-emerald-950/90 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200' 
            : toast.type === 'error'
            ? 'bg-rose-50 dark:bg-rose-950/90 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
            : 'bg-blue-50 dark:bg-blue-950/90 border-blue-300 dark:border-blue-800 text-blue-800 dark:text-blue-200'
        }`}>
          <span className="font-extrabold text-xs tracking-wide">{toast.message}</span>
        </div>
      )}

      {/* ⚠️ DELETE CONFIRMATION MODAL */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[110] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-100 dark:border-rose-900">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-base font-black text-slate-900 dark:text-white mb-1.5">Confirm Deletion</h3>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              Are you sure you want to delete this configuration item? This action will disable relevant triggers.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-xs"
              >
                Cancel
              </button>
              <button 
                onClick={executeDelete}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-md shadow-rose-600/20 active:scale-95 transition-all text-xs"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PAGE HEADER */}
      <div className="px-8 pt-6 pb-2">
        <DashboardPageHeader
          title="Talent & Operations Configuration"
          companies={companies}
          companyId={selectedCompanyId}
          handleCompanyChange={(id) => setSelectedCompanyId(id)}
          isSuperAdmin={isSuperAdmin}
          hideCompanySelect={!isSuperAdmin}
        />
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="px-8 py-4 space-y-6">
        
        {/* HERO BANNER & QUICK METRICS */}
        <div className="relative rounded-3xl border border-slate-200/70 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-6 md:p-8 shadow-xs overflow-hidden flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500 opacity-90" />
          
          <div className="space-y-2 text-left">
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-3.5 py-1.5 rounded-full border border-blue-100 dark:border-blue-900/30">
              System Control Console
            </span>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white font-outfit tracking-tight">
              Company Communication configurations ⚙️
            </h2>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 max-w-xl leading-relaxed">
              Manage corporate Email SMTP servers, Meta WhatsApp API keys, broadcast campaign templates, and automated candidate notification rules.
            </p>
          </div>

          {/* KPI COUNTERS */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 px-4 py-2.5 rounded-2xl text-left">
              <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400">Email Gateway</span>
              <div className="text-sm font-extrabold text-slate-800 dark:text-white mt-0.5 flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${integrations.find(d => d.provider === 'SMTP')?.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                {integrations.find(d => d.provider === 'SMTP')?.is_active ? 'Active' : 'Not Set'}
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 px-4 py-2.5 rounded-2xl text-left">
              <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400">WhatsApp API</span>
              <div className="text-sm font-extrabold text-slate-800 dark:text-white mt-0.5 flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${integrations.find(d => d.provider === 'WHATSAPP')?.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                {integrations.find(d => d.provider === 'WHATSAPP')?.is_active ? 'Connected' : 'Offline'}
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 px-4 py-2.5 rounded-2xl text-left">
              <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400">Campaign Templates</span>
              <div className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400 mt-0.5">
                {campaigns.length} Defined
              </div>
            </div>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex overflow-x-auto no-scrollbar gap-2 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <button 
            onClick={() => setActiveTab('email')} 
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'email' 
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 scale-[1.02]' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Email SMTP Gateway
          </button>
          
          <button 
            onClick={() => setActiveTab('whatsapp')} 
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'whatsapp' 
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20 scale-[1.02]' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            WhatsApp Business API
          </button>

          <button 
            onClick={() => setActiveTab('campaigns')} 
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'campaigns' 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20 scale-[1.02]' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.684A1.001 1.001 0 014.5 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.5c.4 0 .762.238.916.606l.02.048" />
            </svg>
            Broadcast Campaigns
          </button>

          <button 
            onClick={() => setActiveTab('rules')} 
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'rules' 
                ? 'bg-violet-600 text-white shadow-md shadow-violet-500/20 scale-[1.02]' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Notification Rules
          </button>
        </div>

        {/* TAB 1: EMAIL SMTP CONFIGURATION */}
        {activeTab === 'email' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs text-left space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Corporate SMTP Mail Gateway</h3>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                  Connect your corporate email provider (e.g. Gmail, Outlook, AWS SES) to send automated candidate notifications.
                </p>
              </div>
              <button 
                onClick={() => setShowSmtpModal(true)}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl shadow-md shadow-blue-600/20 active:scale-95 transition-all cursor-pointer"
              >
                Configure SMTP
              </button>
            </div>

            {integrations.find(d => d.provider === 'SMTP') ? (
              <div className="p-6 border border-slate-200/80 dark:border-slate-800 rounded-2xl bg-gradient-to-br from-slate-50 to-white dark:from-slate-800/40 dark:to-slate-900 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-blue-100/80 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center font-black text-2xl border border-blue-200 dark:border-blue-900 shrink-0">
                    ✉️
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">Active Mail Server</h4>
                      <button
                        type="button"
                        onClick={() => handleToggleIntegration('SMTP', integrations.find(d => d.provider === 'SMTP')?.is_active)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          integrations.find(d => d.provider === 'SMTP')?.is_active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            integrations.find(d => d.provider === 'SMTP')?.is_active ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                      <span className={`px-2.5 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider ${
                        integrations.find(d => d.provider === 'SMTP')?.is_active
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200'
                      }`}>
                        {integrations.find(d => d.provider === 'SMTP')?.is_active ? 'ENABLED (LIVE)' : 'OFF (DISABLED)'}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
                      From: <span className="font-extrabold text-slate-800 dark:text-slate-200">{smtpCreds.fromEmail || 'Not specified'}</span> • Server: <span className="font-extrabold text-slate-800 dark:text-slate-200">{smtpCreds.smtpServer || 'Not set'}</span> ({smtpCreds.smtpType})
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <button 
                    onClick={() => setShowSmtpModal(true)}
                    className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-500 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Edit Credentials
                  </button>
                  <button 
                    onClick={() => setDeleteConfirm({ id: 'smtp', type: 'email', provider: 'SMTP' })}
                    className="px-4 py-2 bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-10 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl text-center bg-slate-50/40 dark:bg-slate-900/40 space-y-3">
                <span className="text-4xl">📧</span>
                <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-200">No SMTP Server Connected</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Add your mail server credentials to send interview schedules, offer letters, and candidate updates.
                </p>
                <button 
                  onClick={() => setShowSmtpModal(true)}
                  className="px-5 py-2.5 bg-blue-600 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer mt-2"
                >
                  Configure SMTP Server
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: WHATSAPP GATEWAY */}
        {activeTab === 'whatsapp' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs text-left space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">WhatsApp Business API Integration</h3>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                  Connect official Meta WhatsApp Cloud API or third-party webhooks to send instant candidate messaging.
                </p>
              </div>
              <button 
                onClick={() => setShowWhatsappModal(true)}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
              >
                Configure WhatsApp
              </button>
            </div>

            {integrations.find(d => d.provider === 'WHATSAPP') ? (
              <div className="p-6 border border-slate-200/80 dark:border-slate-800 rounded-2xl bg-gradient-to-br from-slate-50 to-white dark:from-slate-800/40 dark:to-slate-900 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center font-black text-2xl border border-emerald-200 dark:border-emerald-900 shrink-0">
                    💬
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">Meta WhatsApp Gateway</h4>
                      <button
                        type="button"
                        onClick={() => handleToggleIntegration('WHATSAPP', integrations.find(d => d.provider === 'WHATSAPP')?.is_active)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          integrations.find(d => d.provider === 'WHATSAPP')?.is_active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            integrations.find(d => d.provider === 'WHATSAPP')?.is_active ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                      <span className={`px-2.5 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider ${
                        integrations.find(d => d.provider === 'WHATSAPP')?.is_active
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200'
                      }`}>
                        {integrations.find(d => d.provider === 'WHATSAPP')?.is_active ? 'ENABLED (LIVE)' : 'OFF (DISABLED)'}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
                      Endpoint: <span className="font-extrabold text-slate-800 dark:text-slate-200">{whatsappCreds.url || 'Not set'}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <button 
                    onClick={() => setShowWhatsappModal(true)}
                    className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Edit Credentials
                  </button>
                  <button 
                    onClick={() => setDeleteConfirm({ id: 'whatsapp', type: 'whatsapp', provider: 'WHATSAPP' })}
                    className="px-4 py-2 bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-10 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl text-center bg-slate-50/40 dark:bg-slate-900/40 space-y-3">
                <span className="text-4xl">💬</span>
                <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-200">No WhatsApp Gateway Connected</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Set up Meta WhatsApp Business API credentials to send automated WhatsApp messages.
                </p>
                <button 
                  onClick={() => setShowWhatsappModal(true)}
                  className="px-5 py-2.5 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer mt-2"
                >
                  Configure WhatsApp API
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: BROADCAST CAMPAIGNS */}
        {activeTab === 'campaigns' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs text-left space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Broadcast WhatsApp Campaign Templates</h3>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                  Manage pre-approved WhatsApp message templates and their dynamic placeholders (e.g. candidate_name, job_title).
                </p>
              </div>
              <button 
                onClick={openCreateCampaignModal}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-xl shadow-md shadow-indigo-600/20 active:scale-95 transition-all cursor-pointer"
              >
                + New Campaign Template
              </button>
            </div>

            {campaigns.length === 0 ? (
              <div className="p-10 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl text-center bg-slate-50/40 dark:bg-slate-900/40 space-y-3">
                <span className="text-4xl">📢</span>
                <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-200">No Campaign Templates Created</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Create your first WhatsApp message template to automate candidate engagement.
                </p>
                <button 
                  onClick={openCreateCampaignModal}
                  className="px-5 py-2.5 bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer mt-2"
                >
                  Create Campaign Template
                </button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {campaigns.map((c) => {
                  const paramKeys = getParamKeys(c);
                  return (
                    <div key={c.id} className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-card hover:border-indigo-500/50 transition-all flex flex-col justify-between space-y-4 shadow-2xs group">
                      <div>
                        <div className="flex justify-between items-start">
                          <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">{c.campaign_name}</h4>
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                            c.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {c.status}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-md font-mono text-[10.5px] font-bold border border-indigo-200/60 dark:border-indigo-900">
                            {c.campaign_code}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-3">
                          Template: <span className="font-bold text-slate-700 dark:text-slate-300">{c.template_name}</span>
                        </p>

                        {/* PARAMETER BADGES */}
                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                          <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">
                            Dynamic Parameters ({paramKeys.length}):
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {paramKeys.length > 0 ? (
                              paramKeys.map(pk => (
                                <span key={pk} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded font-mono text-[10px] font-bold">
                                  {`{{${pk}}}`}
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] text-slate-400 font-semibold italic">No parameters</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <button 
                          onClick={() => openEditCampaignModal(c)}
                          className="flex-1 py-1.5 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                        >
                          Edit Details & Params
                        </button>
                        <button 
                          onClick={() => setDeleteConfirm({ id: c.id, type: 'campaign' })}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: NOTIFICATION RULES */}
        {activeTab === 'rules' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs text-left space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Automated Notification Triggers</h3>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                  Automate candidate updates when ATS status changes (e.g. Candidate Shortlisted, Interview Scheduled).
                </p>
              </div>
              <button 
                onClick={() => { setCurrentRule({ email_enabled: true, whatsapp_enabled: false }); setShowRuleModal(true); }}
                className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-extrabold rounded-xl shadow-md shadow-violet-600/20 active:scale-95 transition-all cursor-pointer"
              >
                + Add Trigger Rule
              </button>
            </div>

            {rules.length === 0 ? (
              <div className="p-10 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl text-center bg-slate-50/40 dark:bg-slate-900/40 space-y-3">
                <span className="text-4xl">⚡</span>
                <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-200">No Notification Rules Configured</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Add a rule to trigger emails or WhatsApp messages when candidate status changes in the ATS.
                </p>
                <button 
                  onClick={() => { setCurrentRule({ email_enabled: true, whatsapp_enabled: false }); setShowRuleModal(true); }}
                  className="px-5 py-2.5 bg-violet-600 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer mt-2"
                >
                  Create Rule
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200/80 dark:border-slate-800 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800">
                    <tr>
                      <th className="p-4 font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Module & Event Trigger</th>
                      <th className="p-4 font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Active Channels</th>
                      <th className="p-4 font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Associated WhatsApp Template</th>
                      <th className="p-4 font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 bg-white dark:bg-slate-900">
                    {rules.map((r) => {
                      const camp = campaigns.find(x => x.id === r.whatsapp_campaign_id);
                      return (
                        <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="p-4">
                            <div className="font-extrabold text-slate-900 dark:text-white text-sm">{r.event_code}</div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{r.module || 'RECRUITMENT'}</div>
                          </td>
                          <td className="p-4 flex gap-2">
                            {r.email_enabled && (
                              <span className="bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-md text-[10px] font-black">
                                EMAIL
                              </span>
                            )}
                            {r.whatsapp_enabled && (
                              <span className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-md text-[10px] font-black">
                                WHATSAPP
                              </span>
                            )}
                          </td>
                          <td className="p-4 font-semibold text-slate-600 dark:text-slate-400">
                            {camp ? `${camp.campaign_name} (${camp.campaign_code})` : '-'}
                          </td>
                          <td className="p-4 flex gap-3">
                            <button onClick={() => { setCurrentRule(r); setShowRuleModal(true); }} className="text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer">Edit</button>
                            <button onClick={() => setDeleteConfirm({ id: r.id, type: 'rule' })} className="text-rose-500 font-bold hover:underline cursor-pointer">Delete</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>

      {/* 🛠️ MODAL 1: SMTP SETTINGS */}
      {showSmtpModal && (
        <div className="fixed inset-0 z-50 overflow-hidden font-sans">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setShowSmtpModal(false)}></div>
          <div className="fixed inset-y-0 right-0 max-w-md w-full flex shadow-2xl">
            <div className="w-full h-full bg-white dark:bg-slate-900 flex flex-col">
              <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-blue-50/50 dark:bg-blue-950/30">
                <h2 className="text-base font-black text-slate-900 dark:text-white">SMTP Email Gateway Settings</h2>
                <button onClick={() => setShowSmtpModal(false)} className="text-slate-400 hover:text-slate-600 p-2 font-bold">✕</button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4 text-left">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">From Email Address</label>
                  <input type="email" value={smtpCreds.fromEmail} onChange={e => setSmtpCreds({...smtpCreds, fromEmail: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="hr@company.com" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">SMTP Server Host</label>
                  <input type="text" value={smtpCreds.smtpServer} onChange={e => setSmtpCreds({...smtpCreds, smtpServer: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="smtp.gmail.com" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">App Code</label>
                  <input type="password" value={smtpCreds.password} onChange={e => setSmtpCreds({...smtpCreds, password: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="••••••••" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Encryption Method</label>
                  <select value={smtpCreds.smtpType} onChange={e => setSmtpCreds({...smtpCreds, smtpType: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="SSL">SSL (Port 465)</option>
                    <option value="TLS">TLS (Port 587)</option>
                    <option value="None">None (Port 25)</option>
                  </select>
                </div>
              </div>
              <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-900">
                <button onClick={() => setShowSmtpModal(false)} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 text-xs cursor-pointer">Cancel</button>
                <button onClick={() => handleSaveIntegration('SMTP', smtpCreds, true)} className="px-5 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 text-xs cursor-pointer">Save SMTP Credentials</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🛠️ MODAL 2: WHATSAPP SETTINGS */}
      {showWhatsappModal && (
        <div className="fixed inset-0 z-50 overflow-hidden font-sans">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setShowWhatsappModal(false)}></div>
          <div className="fixed inset-y-0 right-0 max-w-md w-full flex shadow-2xl">
            <div className="w-full h-full bg-white dark:bg-slate-900 flex flex-col">
              <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-emerald-50/50 dark:bg-emerald-950/30">
                <h2 className="text-base font-black text-slate-900 dark:text-white">WhatsApp Business API Credentials</h2>
                <button onClick={() => setShowWhatsappModal(false)} className="text-slate-400 hover:text-slate-600 p-2 font-bold">✕</button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4 text-left">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">API Endpoint URL</label>
                  <input type="text" value={whatsappCreds.url} onChange={e => setWhatsappCreds({...whatsappCreds, url: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="https://graph.facebook.com/v18.0/me/messages" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">API Bearer Access Token</label>
                  <input type="password" value={whatsappCreds.apiKey} onChange={e => setWhatsappCreds({...whatsappCreds, apiKey: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="EAAB..." />
                </div>
              </div>
              <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-900">
                <button onClick={() => setShowWhatsappModal(false)} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 text-xs cursor-pointer">Cancel</button>
                <button onClick={() => handleSaveIntegration('WHATSAPP', whatsappCreds, true)} className="px-5 py-2.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 text-xs cursor-pointer">Save WhatsApp API Credentials</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🛠️ MODAL 3: CAMPAIGN TEMPLATE EDIT MODAL WITH STABLE PARAMS BUILDER */}
      {showCampaignModal && (
        <div className="fixed inset-0 z-50 overflow-hidden font-sans">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setShowCampaignModal(false)}></div>
          <div className="fixed inset-y-0 right-0 max-w-lg w-full flex shadow-2xl">
            <div className="w-full h-full bg-white dark:bg-slate-900 flex flex-col">
              <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-indigo-50/50 dark:bg-indigo-950/30">
                <h2 className="text-base font-black text-slate-900 dark:text-white">
                  {currentCampaign.id ? 'Edit Campaign Template' : 'New Broadcast Campaign Template'}
                </h2>
                <button onClick={() => setShowCampaignModal(false)} className="text-slate-400 hover:text-slate-600 p-2 font-bold">✕</button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-5 text-left">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Campaign Name</label>
                  <input type="text" value={currentCampaign.campaign_name || ''} onChange={e => setCurrentCampaign({...currentCampaign, campaign_name: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. Interview Schedule Notice" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Campaign Code</label>
                  <input type="text" value={currentCampaign.campaign_code || ''} onChange={e => setCurrentCampaign({...currentCampaign, campaign_code: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. INTERVIEW_INVITE" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Approved Template Name (Meta)</label>
                  <input type="text" value={currentCampaign.template_name || ''} onChange={e => setCurrentCampaign({...currentCampaign, template_name: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. hr_interview_invite_v1" />
                </div>

                {/* DYNAMIC PARAMETER KEY-VALUE BUILDER */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex justify-between items-center mb-3">
                    <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                      Dynamic Template Parameters ({paramList.length})
                    </label>
                    <button 
                      type="button"
                      onClick={() => setParamList([...paramList, { key: `param_${paramList.length + 1}`, val: `{{param_${paramList.length + 1}}}` }])}
                      className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      + Add Variable Key
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {paramList.map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-center bg-slate-50 dark:bg-slate-800/40 p-2 rounded-xl border border-slate-200/80 dark:border-slate-800">
                        <input 
                          type="text"
                          value={item.key}
                          onChange={(e) => {
                            const copy = [...paramList];
                            copy[idx].key = e.target.value;
                            setParamList(copy);
                          }}
                          placeholder="Parameter Name"
                          className="w-1/2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <span className="text-slate-400 text-xs font-bold">=</span>
                        <input 
                          type="text"
                          value={item.val}
                          onChange={(e) => {
                            const copy = [...paramList];
                            copy[idx].val = e.target.value;
                            setParamList(copy);
                          }}
                          placeholder="Placeholder / Expression"
                          className="w-1/2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button 
                          type="button"
                          onClick={() => setParamList(paramList.filter((_, i) => i !== idx))}
                          className="text-slate-400 hover:text-rose-600 font-bold px-2 py-1 cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-900">
                <button onClick={() => setShowCampaignModal(false)} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 text-xs cursor-pointer">Cancel</button>
                <button onClick={handleSaveCampaign} className="px-5 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 text-xs cursor-pointer">Save Campaign Template</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🛠️ MODAL 4: NOTIFICATION RULE MODAL */}
      {showRuleModal && (
        <div className="fixed inset-0 z-50 overflow-hidden font-sans">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setShowRuleModal(false)}></div>
          <div className="fixed inset-y-0 right-0 max-w-md w-full flex shadow-2xl">
            <div className="w-full h-full bg-white dark:bg-slate-900 flex flex-col">
              <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-violet-50/50 dark:bg-violet-950/30">
                <h2 className="text-base font-black text-slate-900 dark:text-white">
                  {currentRule.id ? 'Edit Notification Trigger Rule' : 'New Notification Trigger Rule'}
                </h2>
                <button onClick={() => setShowRuleModal(false)} className="text-slate-400 hover:text-slate-600 p-2 font-bold">✕</button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4 text-left">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Event Code Trigger</label>
                  <select value={currentRule.event_code || ''} onChange={e => setCurrentRule({...currentRule, event_code: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-violet-500">
                    <option value="">Select Event Trigger</option>
                    <option value="CANDIDATE_SHORTLISTED">CANDIDATE_SHORTLISTED</option>
                    <option value="INTERVIEW_SCHEDULED">INTERVIEW_SCHEDULED</option>
                    <option value="OFFER_LETTER_ISSUED">OFFER_LETTER_ISSUED</option>
                    <option value="REJECTION_SENT">REJECTION_SENT</option>
                  </select>
                </div>
                <div className="space-y-3 pt-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase">Active Notification Channels</label>
                  <label className="flex items-center gap-3 cursor-pointer p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800">
                    <input type="checkbox" checked={!!currentRule.email_enabled} onChange={e => setCurrentRule({...currentRule, email_enabled: e.target.checked})} className="rounded text-blue-600 w-4 h-4 cursor-pointer" />
                    <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Send Email via Corporate SMTP</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800">
                    <input type="checkbox" checked={!!currentRule.whatsapp_enabled} onChange={e => setCurrentRule({...currentRule, whatsapp_enabled: e.target.checked})} className="rounded text-emerald-600 w-4 h-4 cursor-pointer" />
                    <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Send Broadcast via WhatsApp API</span>
                  </label>
                </div>
                {currentRule.whatsapp_enabled && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Associated WhatsApp Template</label>
                    <select value={currentRule.whatsapp_campaign_id || ''} onChange={e => setCurrentRule({...currentRule, whatsapp_campaign_id: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-violet-500">
                      <option value="">Select Campaign Template</option>
                      {campaigns.map(c => (
                        <option key={c.id} value={c.id}>{c.campaign_name} ({c.campaign_code})</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-900">
                <button onClick={() => setShowRuleModal(false)} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 text-xs cursor-pointer">Cancel</button>
                <button onClick={handleSaveRule} className="px-5 py-2.5 rounded-xl font-bold text-white bg-violet-600 hover:bg-violet-700 text-xs cursor-pointer">Save Trigger Rule</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
