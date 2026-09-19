'use client';

import React, { useState, useEffect } from 'react';
import { useDashboard } from '../components/DashboardContext';

export default function GlobalConfigurationPage() {
  const { companyId: globalCompanyId } = useDashboard();
  const [activeTab, setActiveTab] = useState<'email' | 'whatsapp' | 'campaigns' | 'rules'>('email');
  
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [smtpList, setSmtpList] = useState<any[]>([]);
  const [smtpCreds, setSmtpCreds] = useState({ id: '', fromEmail: '', password: '', smtpServer: '', smtpType: 'TLS' });
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

  const [permissions, setPermissions] = useState<string[]>([]);
  useEffect(() => {
    try {
      const stored = localStorage.getItem('permissions');
      if (stored) setPermissions(JSON.parse(stored));
    } catch {}
  }, []);

  const canViewEmail = isSuperAdmin || permissions.includes('view_email_integrations') || permissions.includes('*');
  const canCreateEmail = isSuperAdmin || permissions.includes('create_email_integrations') || permissions.includes('*');
  const canEditEmail = isSuperAdmin || permissions.includes('edit_email_integrations') || permissions.includes('*');
  const canDeleteEmail = isSuperAdmin || permissions.includes('delete_email_integrations') || permissions.includes('*');

  const canViewWhatsapp = isSuperAdmin || permissions.includes('view_whatsapp_integrations') || permissions.includes('*');
  const canCreateWhatsapp = isSuperAdmin || permissions.includes('create_whatsapp_integrations') || permissions.includes('*');
  const canEditWhatsapp = isSuperAdmin || permissions.includes('edit_whatsapp_integrations') || permissions.includes('*');
  const canDeleteWhatsapp = isSuperAdmin || permissions.includes('delete_whatsapp_integrations') || permissions.includes('*');

  const canViewCampaigns = isSuperAdmin || permissions.includes('view_whatsapp_campaigns') || permissions.includes('*');
  const canCreateCampaigns = isSuperAdmin || permissions.includes('create_whatsapp_campaigns') || permissions.includes('*');
  const canEditCampaigns = isSuperAdmin || permissions.includes('edit_whatsapp_campaigns') || permissions.includes('*');
  const canDeleteCampaigns = isSuperAdmin || permissions.includes('delete_whatsapp_campaigns') || permissions.includes('*');

  const canViewRules = isSuperAdmin || permissions.includes('view_notification_configurations') || permissions.includes('*');
  const canCreateRules = isSuperAdmin || permissions.includes('create_notification_configurations') || permissions.includes('*');
  const canEditRules = isSuperAdmin || permissions.includes('edit_notification_configurations') || permissions.includes('*');
  const canDeleteRules = isSuperAdmin || permissions.includes('delete_notification_configurations') || permissions.includes('*');

  const activeCompanyId = globalCompanyId || selectedCompanyId;

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchIntegrations = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const headers = { 'Authorization': `Bearer ${token}` };
      const cid = activeCompanyId || localStorage.getItem('companyId');
      let q = cid && cid !== 'all' ? `?company_id=${cid}&list=true` : '?list=true';
      
      const [emailRes, whatsappRes, campRes, rulesRes] = await Promise.all([
        fetch(`/api/v1/recruitment/settings/email${q}`, { headers }),
        fetch(`/api/v1/recruitment/settings/whatsapp${q.replace('&list=true', '').replace('?list=true', '')}`, { headers }),
        fetch(`/api/v1/recruitment/settings/whatsapp-campaigns${q.replace('&list=true', '').replace('?list=true', '')}`, { headers }),
        fetch(`/api/v1/recruitment/settings/notification-rules${q.replace('&list=true', '').replace('?list=true', '')}`, { headers })
      ]);
      
      let tempIntegrations: any[] = [];
      if (emailRes.ok) {
        const emailData = await emailRes.json();
        const list = Array.isArray(emailData) ? emailData : (emailData ? [emailData] : []);
        setSmtpList(list);
        if (list.length > 0) {
          tempIntegrations.push({ provider: 'SMTP', is_active: list.some((item: any) => item.is_active) });
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
        const res = await fetch('/api/v1/companies', {
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
  }, [activeCompanyId]);

  const openNewSmtpModal = () => {
    setSmtpCreds({ id: '', fromEmail: '', password: '', smtpServer: 'smtp.gmail.com', smtpType: 'TLS' });
    setShowSmtpModal(true);
  };

  const openEditSmtpModal = (account: any) => {
    setSmtpCreds({
      id: account.id || '',
      fromEmail: account.from_email || account.smtp_username || '',
      password: account.smtp_password_encrypted || '',
      smtpServer: account.smtp_host || '',
      smtpType: account.encryption_type || 'TLS'
    });
    setShowSmtpModal(true);
  };

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
        url = '/api/v1/recruitment/settings/email';
        payload = {
          id: credentials.id || undefined,
          company_id: selectedCompanyId,
          smtp_host: credentials.smtpServer,
          smtp_port: credentials.smtpType === 'SSL' ? 465 : 587,
          smtp_username: credentials.fromEmail,
          smtp_password_encrypted: credentials.password,
          encryption_type: credentials.smtpType,
          from_email: credentials.fromEmail,
          from_name: 'HR Team',
          is_active: isActive
        };
      } else if (provider === 'WHATSAPP') {
        url = '/api/v1/recruitment/settings/whatsapp';
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

  const handleToggleSmtpAccount = async (account: any) => {
    const creds = {
      id: account.id,
      fromEmail: account.from_email || account.smtp_username,
      password: account.smtp_password_encrypted,
      smtpServer: account.smtp_host,
      smtpType: account.encryption_type || 'TLS'
    };
    await handleSaveIntegration('SMTP', creds, !account.is_active);
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
        ? `/api/v1/recruitment/settings/whatsapp-campaigns/${currentCampaign.id}`
        : '/api/v1/recruitment/settings/whatsapp-campaigns';
      
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
        ? `/api/v1/recruitment/settings/notification-rules/${currentRule.id}`
        : '/api/v1/recruitment/settings/notification-rules';
      
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
          ? '/api/v1/recruitment/settings/email' 
          : '/api/v1/recruitment/settings/whatsapp';
        await fetch(url, { method: 'DELETE', headers });
        fetchIntegrations();
        showToast(`${provider} gateway integration deleted`, 'success');
      } else if (type === 'campaign') {
        await fetch(`/api/v1/recruitment/settings/whatsapp-campaigns/${id}`, { method: 'DELETE', headers });
        fetchIntegrations();
        showToast('Campaign deleted successfully', 'success');
      } else if (type === 'rule') {
        await fetch(`/api/v1/recruitment/settings/notification-rules/${id}`, { method: 'DELETE', headers });
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
    <div className="space-y-3.5 sm:space-y-4 animate-fadeIn w-full relative">
      
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

      {/* HERO BANNER & QUICK METRICS */}
      <div className="relative rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl p-4 sm:p-5 md:p-6 shadow-xs overflow-hidden flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 sm:gap-5">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#07518a] via-blue-600 to-sky-500 opacity-90" />
        
        <div className="space-y-1 text-left">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[9px] sm:text-[9.5px] font-bold uppercase tracking-wider text-[#07518a] dark:text-[#38bdf8] bg-[#07518a]/10 dark:bg-[#07518a]/20 px-2 py-0.5 rounded-full border border-[#07518a]/20">
              System Control Console
            </span>
            <span className="text-[9px] sm:text-[9.5px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">• Communications & Triggers</span>
          </div>
          <h2 className="text-sm sm:text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight">
            Company Communication Configurations ⚙️
          </h2>
          <p className="text-[11.5px] sm:text-xs font-normal text-slate-500 dark:text-slate-400 max-w-xl leading-relaxed">
            Manage corporate Email SMTP gateways, Meta WhatsApp API keys, broadcast campaign templates, and automated candidate notification rules.
          </p>
        </div>

        {/* KPI COUNTERS */}
        <div className="grid grid-cols-1 xs:grid-cols-3 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5 w-full sm:w-auto shrink-0">
          <div className="bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 px-3 py-2 rounded-xl text-left shadow-2xs transition-all hover:border-blue-300 dark:hover:border-blue-700">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#07518a]"></div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Email Gateway</span>
            </div>
            <div className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-0.5 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${integrations.find(d => d.provider === 'SMTP')?.is_active ? 'bg-emerald-500 animate-pulse shadow-xs shadow-emerald-500/50' : 'bg-slate-400'}`} />
              {integrations.find(d => d.provider === 'SMTP')?.is_active ? 'Active' : 'Not Configured'}
            </div>
          </div>

          <div className="bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 px-3 py-2 rounded-xl text-left shadow-2xs transition-all hover:border-emerald-300 dark:hover:border-emerald-700">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Whatsap Gateway</span>
            </div>
            <div className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-0.5 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${integrations.find(d => d.provider === 'WHATSAPP')?.is_active ? 'bg-emerald-500 animate-pulse shadow-xs shadow-emerald-500/50' : 'bg-slate-400'}`} />
              {integrations.find(d => d.provider === 'WHATSAPP')?.is_active ? 'Connected' : 'Offline'}
            </div>
          </div>

          <div className="bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 px-3 py-2 rounded-xl text-left shadow-2xs transition-all hover:border-indigo-300 dark:hover:border-indigo-700">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Templates</span>
            </div>
            <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
              {campaigns.length} Configured
            </div>
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex overflow-x-auto no-scrollbar gap-1.5 sm:gap-2 bg-white dark:bg-slate-900 p-1.5 sm:p-2 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        {canViewEmail && (
          <button 
            onClick={() => setActiveTab('email')} 
            className={`flex items-center gap-2 px-3.5 py-2 sm:px-5 sm:py-2.5 rounded-lg sm:rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'email' 
                ? 'bg-[#07518a] text-white shadow-md shadow-[#07518a]/25 scale-[1.01]' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
            }`}
          >
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Email Gateway
          </button>
        )}
        
        {canViewWhatsapp && (
          <button 
            onClick={() => setActiveTab('whatsapp')} 
            className={`flex items-center gap-2 px-3.5 py-2 sm:px-5 sm:py-2.5 rounded-lg sm:rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'whatsapp' 
                ? 'bg-[#07518a] text-white shadow-md shadow-[#07518a]/25 scale-[1.01]' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
            }`}
          >
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Whatsap Gateway
          </button>
        )}

        {canViewCampaigns && (
          <button 
            onClick={() => setActiveTab('campaigns')} 
            className={`flex items-center gap-2 px-3.5 py-2 sm:px-5 sm:py-2.5 rounded-lg sm:rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'campaigns' 
                ? 'bg-[#07518a] text-white shadow-md shadow-[#07518a]/25 scale-[1.01]' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
            }`}
          >
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.684A1.001 1.001 0 014.5 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.5c.4 0 .762.238.916.606l.02.048" />
            </svg>
            Broadcast Campaigns
          </button>
        )}

        {canViewRules && (
          <button 
            onClick={() => setActiveTab('rules')} 
            className={`flex items-center gap-2 px-3.5 py-2 sm:px-5 sm:py-2.5 rounded-lg sm:rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'rules' 
                ? 'bg-[#07518a] text-white shadow-md shadow-[#07518a]/25 scale-[1.01]' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
            }`}
          >
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Notification Rules
          </button>
        )}
      </div>

      {/* TAB 1: EMAIL SMTP CONFIGURATION */}
      {activeTab === 'email' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-5 md:p-6 shadow-xs text-left space-y-4 sm:space-y-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 pb-3.5 sm:pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Corporate SMTP Mail Gateway</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/80 dark:border-blue-900/60">
                  {smtpList.length} Server{smtpList.length === 1 ? '' : 's'}
                </span>
              </div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                Connect your corporate email provider (e.g. Gmail, Outlook, AWS SES) to send automated candidate notifications.
              </p>
            </div>
            <button 
              onClick={openNewSmtpModal}
              className="w-full sm:w-auto px-4 sm:px-5 py-2 sm:py-2.5 bg-[#07518a] hover:bg-[#064270] text-white text-xs font-extrabold rounded-xl shadow-md shadow-[#07518a]/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Configure New SMTP
            </button>
          </div>

          {smtpList.length > 0 ? (
            <div className="space-y-3 sm:space-y-3.5">
                {smtpList.map((acc: any, idx: number) => (
                  <div 
                    key={acc.id || idx} 
                    className="p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 rounded-xl sm:rounded-2xl bg-white dark:bg-slate-900/90 hover:border-blue-400/50 dark:hover:border-blue-700/50 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sm:gap-6 group"
                  >
                    <div className="flex items-start sm:items-center gap-3.5 sm:gap-4.5 flex-1 min-w-0">
                      {/* SLEEK ICON CONTAINER */}
                      <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-indigo-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/70 dark:border-blue-900/60 shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                        </svg>
                      </div>

                      <div className="space-y-1.5 sm:space-y-2 flex-1 min-w-0">
                        {/* TITLE & TOGGLE SWITCH ROW */}
                        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                          <h4 className="font-black text-sm text-slate-900 dark:text-white tracking-tight">
                            Mail Gateway {smtpList.length > 1 ? `#${idx + 1}` : ''}
                          </h4>

                          {/* TOGGLE SWITCH */}
                          <button
                            type="button"
                            onClick={() => handleToggleSmtpAccount(acc)}
                            className={`relative inline-flex h-5.5 w-10 sm:h-6 sm:w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              acc.is_active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                            }`}
                            title={acc.is_active ? 'Click to Disable' : 'Click to Enable'}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4.5 w-4.5 sm:h-5 sm:w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                acc.is_active ? 'translate-x-4.5 sm:translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>

                          {/* STATUS BADGE */}
                          <span className={`px-2.5 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                            acc.is_active
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${acc.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                            {acc.is_active ? 'ENABLED (LIVE)' : 'OFF (DISABLED)'}
                          </span>
                        </div>

                        {/* METADATA PILLS */}
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 rounded-lg sm:rounded-xl text-slate-700 dark:text-slate-300 font-medium text-[11px] sm:text-xs">
                            <span className="text-[9.5px] sm:text-[10px] font-extrabold uppercase text-slate-400">From:</span>
                            <span className="font-extrabold text-slate-900 dark:text-white truncate max-w-[160px] sm:max-w-none">{acc.from_email || acc.smtp_username || 'Not specified'}</span>
                          </span>

                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 rounded-lg sm:rounded-xl text-slate-700 dark:text-slate-300 font-medium text-[11px] sm:text-xs">
                            <span className="text-[9.5px] sm:text-[10px] font-extrabold uppercase text-slate-400">Server:</span>
                            <span className="font-extrabold text-slate-900 dark:text-white truncate max-w-[140px] sm:max-w-none">{acc.smtp_host || 'Not set'}</span>
                          </span>

                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 sm:px-2.5 sm:py-1 bg-blue-50/70 dark:bg-blue-950/50 border border-blue-200/60 dark:border-blue-900/60 rounded-lg sm:rounded-xl text-blue-700 dark:text-blue-300 font-bold text-[10px] sm:text-[10.5px]">
                            ⚡ {acc.encryption_type || 'TLS'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* ACTION BUTTONS */}
                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center w-full md:w-auto">
                      <button 
                        onClick={() => openEditSmtpModal(acc)}
                        className="flex-1 md:flex-none px-3.5 sm:px-4 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-[#07518a]/10 dark:hover:bg-[#07518a]/20 hover:text-[#07518a] dark:hover:text-[#38bdf8] text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200/80 dark:border-slate-700 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                        </svg>
                        Edit
                      </button>

                      <button 
                        onClick={() => setDeleteConfirm({ id: acc.id || 'smtp', type: 'email', provider: 'SMTP' })}
                        className="px-3 sm:px-3.5 py-2 bg-rose-50/80 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-xl border border-rose-200/80 dark:border-rose-900/60 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        title="Delete Gateway"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 sm:p-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl text-center bg-slate-50/40 dark:bg-slate-900/40 space-y-3 sm:space-y-4">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl sm:rounded-3xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto border border-blue-100 dark:border-blue-900/60 shadow-xs">
                  <svg className="w-7 h-7 sm:w-8 sm:h-8" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">No SMTP Server Connected</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    Add your corporate mail server credentials to send interview schedules, offer letters, and candidate updates.
                  </p>
                </div>
                <button 
                  onClick={openNewSmtpModal}
                  className="px-5 sm:px-6 py-2 sm:py-2.5 bg-[#07518a] hover:bg-[#064270] text-white font-extrabold text-xs rounded-xl shadow-md shadow-[#07518a]/20 active:scale-95 transition-all cursor-pointer inline-flex items-center gap-2 mt-2"
                >
                  <span>➕</span> Configure SMTP Server
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: WHATSAPP GATEWAY */}
        {activeTab === 'whatsapp' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-5 md:p-6 shadow-xs text-left space-y-3.5 sm:space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 pb-3.5 sm:pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">WhatsApp Business API Integration</h3>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                  Connect official Meta WhatsApp Cloud API or third-party webhooks to send instant candidate messaging.
                </p>
              </div>
              <button 
                onClick={() => setShowWhatsappModal(true)}
                className="w-full sm:w-auto px-4 sm:px-5 py-2 sm:py-2.5 bg-[#07518a] hover:bg-[#064270] text-white text-xs font-extrabold rounded-xl shadow-md shadow-[#07518a]/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Configure WhatsApp
              </button>
            </div>

            {integrations.find(d => d.provider === 'WHATSAPP') ? (
              <div className="p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 rounded-xl sm:rounded-2xl bg-white dark:bg-slate-900/90 hover:border-emerald-400/50 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sm:gap-6 group">
                <div className="flex items-start sm:items-center gap-3.5 sm:gap-4.5 flex-1 min-w-0">
                  <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-teal-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/70 dark:border-emerald-900/60 shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a.596.596 0 01-.743-.65l.362-2.71A8.136 8.136 0 013 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                    </svg>
                  </div>
                  <div className="space-y-1.5 sm:space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                      <h4 className="font-black text-sm text-slate-900 dark:text-white tracking-tight">Meta WhatsApp Gateway</h4>
                      <button
                        type="button"
                        onClick={() => handleToggleIntegration('WHATSAPP', integrations.find(d => d.provider === 'WHATSAPP')?.is_active)}
                        className={`relative inline-flex h-5.5 w-10 sm:h-6 sm:w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          integrations.find(d => d.provider === 'WHATSAPP')?.is_active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4.5 w-4.5 sm:h-5 sm:w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            integrations.find(d => d.provider === 'WHATSAPP')?.is_active ? 'translate-x-4.5 sm:translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                      <span className={`px-2.5 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                        integrations.find(d => d.provider === 'WHATSAPP')?.is_active
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${integrations.find(d => d.provider === 'WHATSAPP')?.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                        {integrations.find(d => d.provider === 'WHATSAPP')?.is_active ? 'ENABLED (LIVE)' : 'OFF (DISABLED)'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 rounded-lg sm:rounded-xl text-slate-700 dark:text-slate-300 text-xs">
                        <span className="text-[9.5px] sm:text-[10px] font-extrabold uppercase text-slate-400">Endpoint:</span>
                        <span className="font-extrabold text-slate-900 dark:text-white truncate max-w-[200px] sm:max-w-md">{whatsappCreds.url || 'Not set'}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end md:self-center w-full md:w-auto">
                  <button 
                    onClick={() => setShowWhatsappModal(true)}
                    className="flex-1 md:flex-none px-3.5 sm:px-4 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-[#07518a]/10 dark:hover:bg-[#07518a]/20 hover:text-[#07518a] dark:hover:text-[#38bdf8] text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200/80 dark:border-slate-700 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    Edit Credentials
                  </button>
                  <button 
                    onClick={() => setDeleteConfirm({ id: 'whatsapp', type: 'whatsapp', provider: 'WHATSAPP' })}
                    className="px-3 sm:px-3.5 py-2 bg-rose-50/80 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-xl border border-rose-200/80 dark:border-rose-900/60 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-8 sm:p-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl text-center bg-slate-50/40 dark:bg-slate-900/40 space-y-3 sm:space-y-4">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl sm:rounded-3xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-100 dark:border-emerald-900/60 shadow-xs">
                  <svg className="w-7 h-7 sm:w-8 sm:h-8" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a.596.596 0 01-.743-.65l.362-2.71A8.136 8.136 0 013 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                  </svg>
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">No WhatsApp Gateway Connected</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    Set up Meta WhatsApp Business API credentials to send automated WhatsApp messages to candidates.
                  </p>
                </div>
                <button 
                  onClick={() => setShowWhatsappModal(true)}
                  className="px-5 sm:px-6 py-2 sm:py-2.5 bg-[#07518a] hover:bg-[#064270] text-white font-extrabold text-xs rounded-xl shadow-md shadow-[#07518a]/20 cursor-pointer mt-2"
                >
                  Configure WhatsApp API
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: BROADCAST CAMPAIGNS */}
        {activeTab === 'campaigns' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-5 md:p-6 shadow-xs text-left space-y-3.5 sm:space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 pb-3.5 sm:pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Broadcast WhatsApp Campaign Templates</h3>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                  Manage pre-approved WhatsApp message templates and their dynamic placeholders (e.g. candidate_name, job_title).
                </p>
              </div>
              <button 
                onClick={openCreateCampaignModal}
                className="w-full sm:w-auto px-4 sm:px-5 py-2 sm:py-2.5 bg-[#07518a] hover:bg-[#064270] text-white text-xs font-extrabold rounded-xl shadow-md shadow-[#07518a]/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                New Campaign Template
              </button>
            </div>

            {campaigns.length === 0 ? (
              <div className="p-8 sm:p-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl text-center bg-slate-50/40 dark:bg-slate-900/40 space-y-3 sm:space-y-4">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl sm:rounded-3xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto border border-indigo-100 dark:border-indigo-900/60 shadow-xs">
                  <svg className="w-7 h-7 sm:w-8 sm:h-8" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.38-.09-2.072-.09C6.44 15.75 3 17.5 3 19.5V21h10.5v-1.5c0-.663-.263-1.29-.73-1.76l-.43-.4zM16.5 13.5A3.75 3.75 0 1016.5 6a3.75 3.75 0 000 7.5z" />
                  </svg>
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">No Campaign Templates Created</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    Create your first WhatsApp message template to automate candidate engagement.
                  </p>
                </div>
                <button 
                  onClick={openCreateCampaignModal}
                  className="px-5 sm:px-6 py-2 sm:py-2.5 bg-[#07518a] hover:bg-[#064270] text-white font-extrabold text-xs rounded-xl shadow-md shadow-[#07518a]/20 cursor-pointer mt-2"
                >
                  Create Campaign Template
                </button>
              </div>
            ) : (
              <div className="grid gap-3.5 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {campaigns.map((c) => {
                  const paramKeys = getParamKeys(c);
                  return (
                    <div key={c.id} className="p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-400/50 dark:hover:border-indigo-700/50 transition-all flex flex-col justify-between space-y-3.5 sm:space-y-4 shadow-2xs hover:shadow-md group">
                      <div>
                        <div className="flex justify-between items-start">
                          <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">{c.campaign_name}</h4>
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                            c.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {c.status}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="bg-[#07518a]/10 text-[#07518a] dark:text-[#38bdf8] px-2.5 py-1 rounded-lg font-mono text-[10.5px] font-bold border border-[#07518a]/20">
                            {c.campaign_code}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-3">
                          Template: <span className="font-extrabold text-slate-800 dark:text-slate-200">{c.template_name}</span>
                        </p>

                        {/* PARAMETER BADGES */}
                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                          <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">
                            Dynamic Parameters ({paramKeys.length}):
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {paramKeys.length > 0 ? (
                              paramKeys.map(pk => (
                                <span key={pk} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md font-mono text-[10px] font-bold border border-slate-200/60 dark:border-slate-700/60">
                                  {`{{${pk}}}`}
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] text-slate-400 font-semibold italic">No parameters</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <button 
                          onClick={() => openEditCampaignModal(c)}
                          className="flex-1 py-2 bg-[#07518a]/10 hover:bg-[#07518a]/20 text-[#07518a] dark:text-[#38bdf8] font-extrabold rounded-xl text-xs transition-colors cursor-pointer"
                        >
                          Edit Details & Params
                        </button>
                        <button 
                          onClick={() => setDeleteConfirm({ id: c.id, type: 'campaign' })}
                          className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-extrabold rounded-xl text-xs transition-colors cursor-pointer"
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
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-5 md:p-6 shadow-xs text-left space-y-3.5 sm:space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 pb-3.5 sm:pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Automated Notification Triggers</h3>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                  Automate candidate updates when ATS status changes (e.g. Candidate Shortlisted, Interview Scheduled).
                </p>
              </div>
              <button 
                onClick={() => { setCurrentRule({ email_enabled: true, whatsapp_enabled: false }); setShowRuleModal(true); }}
                className="w-full sm:w-auto px-4 sm:px-5 py-2 sm:py-2.5 bg-[#07518a] hover:bg-[#064270] text-white text-xs font-extrabold rounded-xl shadow-md shadow-[#07518a]/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add Trigger Rule
              </button>
            </div>

            {rules.length === 0 ? (
              <div className="p-8 sm:p-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl text-center bg-slate-50/40 dark:bg-slate-900/40 space-y-3 sm:space-y-4">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl sm:rounded-3xl bg-[#07518a]/10 text-[#07518a] dark:text-[#38bdf8] flex items-center justify-center mx-auto border border-[#07518a]/20 shadow-xs">
                  <svg className="w-7 h-7 sm:w-8 sm:h-8" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">No Notification Rules Configured</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    Add a rule to trigger emails or WhatsApp messages when candidate status changes in the ATS.
                  </p>
                </div>
                <button 
                  onClick={() => { setCurrentRule({ email_enabled: true, whatsapp_enabled: false }); setShowRuleModal(true); }}
                  className="px-5 sm:px-6 py-2 sm:py-2.5 bg-[#07518a] hover:bg-[#064270] text-white font-extrabold text-xs rounded-xl shadow-md shadow-[#07518a]/20 cursor-pointer mt-2"
                >
                  Create Trigger Rule
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200/80 dark:border-slate-800 rounded-xl sm:rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800">
                    <tr>
                      <th className="p-3 sm:p-4 font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Module & Event Trigger</th>
                      <th className="p-3 sm:p-4 font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Active Channels</th>
                      <th className="p-3 sm:p-4 font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Associated WhatsApp Template</th>
                      <th className="p-3 sm:p-4 font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 bg-white dark:bg-slate-900">
                    {rules.map((r) => {
                      const camp = campaigns.find(x => x.id === r.whatsapp_campaign_id);
                      return (
                        <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="p-3 sm:p-4">
                            <div className="font-black text-slate-900 dark:text-white text-sm">{r.event_code}</div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{r.module || 'RECRUITMENT'}</div>
                          </td>
                          <td className="p-3 sm:p-4">
                            <div className="flex gap-2">
                              {r.email_enabled && (
                                <span className="bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-lg text-[10px] font-black">
                                  EMAIL
                                </span>
                              )}
                              {r.whatsapp_enabled && (
                                <span className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-lg text-[10px] font-black">
                                  WHATSAPP
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 sm:p-4 font-semibold text-slate-600 dark:text-slate-400">
                            {camp ? `${camp.campaign_name} (${camp.campaign_code})` : '-'}
                          </td>
                          <td className="p-3 sm:p-4 text-right">
                            <div className="flex items-center justify-end gap-3">
                              <button onClick={() => { setCurrentRule(r); setShowRuleModal(true); }} className="text-[#07518a] dark:text-[#38bdf8] font-extrabold hover:underline cursor-pointer">Edit</button>
                              <button onClick={() => setDeleteConfirm({ id: r.id, type: 'rule' })} className="text-rose-500 font-extrabold hover:underline cursor-pointer">Delete</button>
                            </div>
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

      {/* 🛠️ MODAL 1: SMTP SETTINGS */}
      {showSmtpModal && (
        <div className="fixed inset-0 z-50 overflow-hidden font-sans">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity" onClick={() => setShowSmtpModal(false)}></div>
          <div className="fixed inset-y-0 right-0 max-w-md w-full flex shadow-2xl">
            <div className="w-full h-full bg-white dark:bg-slate-900 flex flex-col">
              <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-blue-50/60 dark:bg-blue-950/40">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#07518a] text-white flex items-center justify-center font-bold">
                    ✉️
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-900 dark:text-white">SMTP Email Gateway Settings</h2>
                    <p className="text-[11px] text-slate-500 font-medium">Configure corporate outgoing mail server</p>
                  </div>
                </div>
                <button onClick={() => setShowSmtpModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 font-bold cursor-pointer rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800">✕</button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-5 text-left">
                <div>
                  <label className="block text-xs font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">From Email Address</label>
                  <input type="email" value={smtpCreds.fromEmail} onChange={e => setSmtpCreds({...smtpCreds, fromEmail: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#07518a]" placeholder="hr@company.com" />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">SMTP Server Host</label>
                  <input type="text" value={smtpCreds.smtpServer} onChange={e => setSmtpCreds({...smtpCreds, smtpServer: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#07518a]" placeholder="smtp.gmail.com" />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">App Password / Security Token</label>
                  <input type="password" value={smtpCreds.password} onChange={e => setSmtpCreds({...smtpCreds, password: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#07518a]" placeholder="••••••••" />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">Encryption Protocol</label>
                  <select value={smtpCreds.smtpType} onChange={e => setSmtpCreds({...smtpCreds, smtpType: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#07518a]">
                    <option value="SSL">SSL (Port 465)</option>
                    <option value="TLS">TLS (Port 587)</option>
                    <option value="None">None (Port 25)</option>
                  </select>
                </div>
              </div>

              <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-slate-50/50 dark:bg-slate-900">
                <button onClick={() => setShowSmtpModal(false)} className="px-5 py-2.5 rounded-xl font-extrabold text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 text-xs cursor-pointer">Cancel</button>
                <button onClick={() => handleSaveIntegration('SMTP', smtpCreds, true)} className="px-5 py-2.5 rounded-xl font-extrabold text-white bg-[#07518a] hover:bg-[#064270] text-xs shadow-md shadow-[#07518a]/20 cursor-pointer">Save SMTP Credentials</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🛠️ MODAL 2: WHATSAPP SETTINGS */}
      {showWhatsappModal && (
        <div className="fixed inset-0 z-50 overflow-hidden font-sans">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity" onClick={() => setShowWhatsappModal(false)}></div>
          <div className="fixed inset-y-0 right-0 max-w-md w-full flex shadow-2xl">
            <div className="w-full h-full bg-white dark:bg-slate-900 flex flex-col">
              <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-emerald-50/60 dark:bg-emerald-950/40">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#07518a] text-white flex items-center justify-center font-bold">
                    💬
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-900 dark:text-white">WhatsApp Business API</h2>
                    <p className="text-[11px] text-slate-500 font-medium">Configure Meta Cloud API details</p>
                  </div>
                </div>
                <button onClick={() => setShowWhatsappModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 font-bold cursor-pointer rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800">✕</button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-5 text-left">
                <div>
                  <label className="block text-xs font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">API Endpoint URL</label>
                  <input type="text" value={whatsappCreds.url} onChange={e => setWhatsappCreds({...whatsappCreds, url: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#07518a]" placeholder="https://graph.facebook.com/v18.0/me/messages" />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">API Bearer Access Token</label>
                  <input type="password" value={whatsappCreds.apiKey} onChange={e => setWhatsappCreds({...whatsappCreds, apiKey: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#07518a]" placeholder="EAAB..." />
                </div>
              </div>

              <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-slate-50/50 dark:bg-slate-900">
                <button onClick={() => setShowWhatsappModal(false)} className="px-5 py-2.5 rounded-xl font-extrabold text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 text-xs cursor-pointer">Cancel</button>
                <button onClick={() => handleSaveIntegration('WHATSAPP', whatsappCreds, true)} className="px-5 py-2.5 rounded-xl font-extrabold text-white bg-[#07518a] hover:bg-[#064270] text-xs shadow-md shadow-[#07518a]/20 cursor-pointer">Save WhatsApp API</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🛠️ MODAL 3: CAMPAIGN TEMPLATE EDIT MODAL */}
      {showCampaignModal && (
        <div className="fixed inset-0 z-50 overflow-hidden font-sans">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity" onClick={() => setShowCampaignModal(false)}></div>
          <div className="fixed inset-y-0 right-0 max-w-lg w-full flex shadow-2xl">
            <div className="w-full h-full bg-white dark:bg-slate-900 flex flex-col">
              <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-indigo-50/60 dark:bg-indigo-950/40">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#07518a] text-white flex items-center justify-center font-bold">
                    📢
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-900 dark:text-white">
                      {currentCampaign.id ? 'Edit Campaign Template' : 'New Broadcast Campaign Template'}
                    </h2>
                    <p className="text-[11px] text-slate-500 font-medium">Define Meta WhatsApp template and parameters</p>
                  </div>
                </div>
                <button onClick={() => setShowCampaignModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 font-bold cursor-pointer rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800">✕</button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-5 text-left">
                <div>
                  <label className="block text-xs font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">Campaign Name</label>
                  <input type="text" value={currentCampaign.campaign_name || ''} onChange={e => setCurrentCampaign({...currentCampaign, campaign_name: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#07518a]" placeholder="e.g. Interview Schedule Notice" />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">Campaign Code</label>
                  <input type="text" value={currentCampaign.campaign_code || ''} onChange={e => setCurrentCampaign({...currentCampaign, campaign_code: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#07518a]" placeholder="e.g. INTERVIEW_INVITE" />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">Approved Template Name (Meta)</label>
                  <input type="text" value={currentCampaign.template_name || ''} onChange={e => setCurrentCampaign({...currentCampaign, template_name: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#07518a]" placeholder="e.g. hr_interview_invite_v1" />
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
                      className="text-[11px] font-black text-[#07518a] dark:text-[#38bdf8] hover:underline cursor-pointer"
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
                          className="w-1/2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold font-mono focus:outline-none focus:ring-2 focus:ring-[#07518a]"
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
                          className="w-1/2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#07518a]"
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

              <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-slate-50/50 dark:bg-slate-900">
                <button onClick={() => setShowCampaignModal(false)} className="px-5 py-2.5 rounded-xl font-extrabold text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 text-xs cursor-pointer">Cancel</button>
                <button onClick={handleSaveCampaign} className="px-5 py-2.5 rounded-xl font-extrabold text-white bg-[#07518a] hover:bg-[#064270] text-xs shadow-md shadow-[#07518a]/20 cursor-pointer">Save Campaign Template</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🛠️ MODAL 4: NOTIFICATION RULE MODAL */}
      {showRuleModal && (
        <div className="fixed inset-0 z-50 overflow-hidden font-sans">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity" onClick={() => setShowRuleModal(false)}></div>
          <div className="fixed inset-y-0 right-0 max-w-md w-full flex shadow-2xl">
            <div className="w-full h-full bg-white dark:bg-slate-900 flex flex-col">
              <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-violet-50/60 dark:bg-violet-950/40">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#07518a] text-white flex items-center justify-center font-bold">
                    ⚡
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-900 dark:text-white">
                      {currentRule.id ? 'Edit Notification Trigger Rule' : 'New Notification Trigger Rule'}
                    </h2>
                    <p className="text-[11px] text-slate-500 font-medium">Automate status update messaging</p>
                  </div>
                </div>
                <button onClick={() => setShowRuleModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 font-bold cursor-pointer rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800">✕</button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-5 text-left">
                <div>
                  <label className="block text-xs font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">Event Code Trigger</label>
                  <select value={currentRule.event_code || ''} onChange={e => {
                    const selectedEvent = e.target.value;
                    let moduleName = 'RECRUITMENT';
                    if (selectedEvent.startsWith('LEAVE_') || selectedEvent.startsWith('COMPOFF_')) moduleName = 'LEAVES';
                    else if (selectedEvent.startsWith('REGULARIZATION_') || selectedEvent.startsWith('PERMISSION_')) moduleName = 'ATTENDANCE';
                    else if (selectedEvent.startsWith('PAYSLIP_')) moduleName = 'PAYROLL';
                    else if (selectedEvent.startsWith('SHIFT_')) moduleName = 'SHIFTS';
                    else if (selectedEvent.startsWith('HOLIDAY_')) moduleName = 'HOLIDAYS';
                    else if (selectedEvent.startsWith('VISITOR_')) moduleName = 'VISITORS';
                    setCurrentRule({...currentRule, event_code: selectedEvent, module: moduleName});
                  }} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#07518a]">
                    <option value="">Select Event Trigger</option>
                    <optgroup label="Leaves">
                      <option value="LEAVE_APPLIED">LEAVE_APPLIED (Notify Manager)</option>
                      <option value="LEAVE_APPROVED">LEAVE_APPROVED (Notify Employee)</option>
                      <option value="LEAVE_REJECTED">LEAVE_REJECTED (Notify Employee)</option>
                      <option value="COMPOFF_CLAIMED">COMPOFF_CLAIMED (Notify Manager)</option>
                    </optgroup>
                    <optgroup label="Attendance">
                      <option value="REGULARIZATION_SUBMITTED">REGULARIZATION_SUBMITTED (Notify Manager)</option>
                      <option value="REGULARIZATION_APPROVED">REGULARIZATION_APPROVED (Notify Employee)</option>
                      <option value="PERMISSION_REQUESTED">PERMISSION_REQUESTED (Notify Manager)</option>
                      <option value="PERMISSION_APPROVED">PERMISSION_APPROVED (Notify Employee)</option>
                    </optgroup>
                    <optgroup label="Payroll">
                      <option value="PAYSLIP_RELEASED">PAYSLIP_RELEASED (Notify Employee)</option>
                    </optgroup>
                    <optgroup label="Shifts & Holidays">
                      <option value="SHIFT_ASSIGNED">SHIFT_ASSIGNED (Notify Employee)</option>
                      <option value="HOLIDAY_ANNOUNCED">HOLIDAY_ANNOUNCED (Notify All Employees)</option>
                    </optgroup>
                    <optgroup label="Recruitment & Operations">
                      <option value="CANDIDATE_SHORTLISTED">CANDIDATE_SHORTLISTED (Notify Candidate)</option>
                      <option value="INTERVIEW_SCHEDULED">INTERVIEW_SCHEDULED (Notify Interviewer & Candidate)</option>
                      <option value="OFFER_LETTER_ISSUED">OFFER_LETTER_ISSUED (Notify Candidate)</option>
                      <option value="REJECTION_SENT">REJECTION_SENT (Notify Candidate)</option>
                      <option value="VISITOR_CHECKED_IN">VISITOR_CHECKED_IN (Notify Host Employee)</option>
                    </optgroup>
                  </select>
                </div>
                <div className="space-y-3 pt-2">
                  <label className="block text-xs font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Active Notification Channels</label>
                  <label className="flex items-center gap-3 cursor-pointer p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:border-blue-300 transition-colors">
                    <input type="checkbox" checked={!!currentRule.email_enabled} onChange={e => setCurrentRule({...currentRule, email_enabled: e.target.checked})} className="rounded text-[#07518a] w-4 h-4 cursor-pointer" />
                    <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Send Email via Corporate SMTP</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:border-emerald-300 transition-colors">
                    <input type="checkbox" checked={!!currentRule.whatsapp_enabled} onChange={e => setCurrentRule({...currentRule, whatsapp_enabled: e.target.checked})} className="rounded text-emerald-600 w-4 h-4 cursor-pointer" />
                    <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Send Broadcast via WhatsApp API</span>
                  </label>
                </div>
                {currentRule.whatsapp_enabled && (
                  <div>
                    <label className="block text-xs font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">Associated WhatsApp Template</label>
                    <select value={currentRule.whatsapp_campaign_id || ''} onChange={e => setCurrentRule({...currentRule, whatsapp_campaign_id: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#07518a]">
                      <option value="">Select Campaign Template</option>
                      {campaigns.map(c => (
                        <option key={c.id} value={c.id}>{c.campaign_name} ({c.campaign_code})</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-slate-50/50 dark:bg-slate-900">
                <button onClick={() => setShowRuleModal(false)} className="px-5 py-2.5 rounded-xl font-extrabold text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 text-xs cursor-pointer">Cancel</button>
                <button onClick={handleSaveRule} className="px-5 py-2.5 rounded-xl font-extrabold text-white bg-[#07518a] hover:bg-[#064270] text-xs shadow-md shadow-[#07518a]/20 cursor-pointer">Save Trigger Rule</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
