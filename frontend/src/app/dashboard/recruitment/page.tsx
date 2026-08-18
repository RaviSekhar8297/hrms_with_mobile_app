'use client';

import React, { useState, useEffect } from 'react';

type Tab = 'overview' | 'jobs' | 'ats' | 'offers' | 'rounds';

export default function RecruitmentDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('ats');
  const [showCreateJobModal, setShowCreateJobModal] = useState(false);
  const [showSmtpModal, setShowSmtpModal] = useState(false);
  const [showWhatsappModal, setShowWhatsappModal] = useState(false);

  const [jobs, setJobs] = useState<any[]>([]);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [smtpCreds, setSmtpCreds] = useState({ fromEmail: '', password: '', smtpServer: '', smtpType: 'SSL' });
  const [whatsappCreds, setWhatsappCreds] = useState({ url: '', apiKey: '' });
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [currentCampaign, setCurrentCampaign] = useState<any>({});
  const [currentRule, setCurrentRule] = useState<any>({});
  const [settingsTab, setSettingsTab] = useState<'email' | 'whatsapp' | 'campaigns' | 'rules'>('email');
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{id: string, type: 'campaign' | 'rule' | 'email' | 'whatsapp' | 'job', provider?: string} | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({message, type});
    setTimeout(() => setToast(null), 3000);
  };

  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const [selectedAtsJobId, setSelectedAtsJobId] = useState<string>('all');
  const [applications, setApplications] = useState<any[]>([]);
  const [showAddCandidateModal, setShowAddCandidateModal] = useState(false);
  const [newCandidate, setNewCandidate] = useState({ first_name: '', last_name: '', email: '', phone: '', job_id: '' });
  const [newCandidateResume, setNewCandidateResume] = useState<File | null>(null);

  // Candidate Profile & Interview Tracking State
  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);
  const [candidateInterviews, setCandidateInterviews] = useState<any[]>([]);
  const [candidateDocuments, setCandidateDocuments] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [jobRounds, setJobRounds] = useState<any[]>([]);
  const [showCandidatePanel, setShowCandidatePanel] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showManageRoundsModal, setShowManageRoundsModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [scheduleData, setScheduleData] = useState({ round_id: '', mode: 'Online', date: '', interviewer_id: '' });
  const [quickRoundName, setQuickRoundName] = useState('');
  const [empSearch, setEmpSearch] = useState('');
  const [showEmpDropdown, setShowEmpDropdown] = useState(false);
  const [newRoundData, setNewRoundData] = useState({ round_name: '', round_type: 'General' });
  const [editingRoundId, setEditingRoundId] = useState<string | null>(null);
  const [feedbackData, setFeedbackData] = useState({ interview_id: '', technical: 0, communication: 0, problem_solving: 0, overall: 0, recommendation: 'PENDING', notes: '' });

  const [newJob, setNewJob] = useState<{
    title: string;
    department_id: string;
    location: string;
    employment_type: string;
    experience_range: string;
    headcount: number;
    salary_range: string;
    currency: string;
    description: string;
    interview_rounds: string[];
  }>({
    title: '',
    department_id: '',
    location: '',
    employment_type: 'Full-Time',
    experience_range: '',
    headcount: 1,
    salary_range: '',
    currency: 'INR',
    description: '',
    interview_rounds: []
  });
  const [customRoundInput, setCustomRoundInput] = useState('');

  // Analytics State
  const [selectedAnalyticsJobId, setSelectedAnalyticsJobId] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  
  const fetchJobAnalytics = async (jobId: string) => {
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`/api/v1/recruitment/jobs/${jobId}/analytics`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setAnalyticsData(await res.json());
        setSelectedAnalyticsJobId(jobId);
        setShowAnalyticsModal(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchApplications = async (jobId: string) => {
    try {
      const token = localStorage.getItem('access_token');
      let url = `/api/v1/recruitment/applications?job_id=${jobId || 'all'}`;
      if (selectedCompanyId) url += `&company_id=${selectedCompanyId}`;
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        setApplications(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem('access_token');
      let url = `/api/v1/recruitment/employees`;
      if (selectedCompanyId) url += `?company_id=${selectedCompanyId}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setEmployees(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [selectedCompanyId]);

  useEffect(() => {
    if (activeTab === 'ats') {
      fetchEmployees();
      fetchApplications(selectedAtsJobId || 'all');
    }
    if (activeTab === 'rounds') {
      fetchRounds();
    }
  }, [activeTab, selectedAtsJobId, jobs]);

  const handleAddCandidate = async () => {
    const jobToUse = newCandidate.job_id || selectedAtsJobId;
    if (!jobToUse || !newCandidate.first_name || !newCandidate.email) {
      showToast('Please fill required fields (Job, First Name, Email)', 'error');
      return;
    }
    try {
      const token = localStorage.getItem('access_token');
      const submitData = new FormData();
      submitData.append('job_id', jobToUse);
      submitData.append('first_name', newCandidate.first_name);
      submitData.append('last_name', newCandidate.last_name);
      submitData.append('email', newCandidate.email);
      submitData.append('phone', newCandidate.phone);
      if (selectedCompanyId) submitData.append('company_id', selectedCompanyId);
      if (newCandidateResume) submitData.append('resume', newCandidateResume);

      const res = await fetch(`/api/v1/recruitment/applications`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: submitData
      });
      if (res.ok) {
        setShowAddCandidateModal(false);
        setNewCandidate({ first_name: '', last_name: '', email: '', phone: '', job_id: '' });
        setNewCandidateResume(null);
        
        if (jobToUse !== selectedAtsJobId) {
          setSelectedAtsJobId(jobToUse);
        } else {
          fetchApplications(selectedAtsJobId);
        }
        
        showToast('Candidate added successfully', 'success');
      } else {
        showToast('Failed to add candidate', 'error');
      }
    } catch (err) {
      showToast('Error adding candidate', 'error');
    }
  };

  // =====================================================================
  // Candidate Profile & Interview Tracking Functions
  // =====================================================================

  const fetchRounds = async () => {
    try {
      const token = localStorage.getItem('access_token');
      let url = `/api/v1/recruitment/rounds`;
      if (selectedCompanyId) url += `?company_id=${selectedCompanyId}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setJobRounds(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const openCandidateProfile = async (candidate: any) => {
    setSelectedCandidate(candidate);
    setShowCandidatePanel(true);
    fetchRounds();
    
    // Fetch interviews for this application
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`/api/v1/recruitment/applications/${candidate.application_id}/interviews`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setCandidateInterviews(await res.json());

      const resDocs = await fetch(`/api/v1/recruitment/applications/${candidate.application_id}/documents`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resDocs.ok) setCandidateDocuments(await resDocs.json());
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateRound = async () => {
    const trimmedName = newRoundData.round_name.trim();
    if (!trimmedName) {
      showToast('Round name is required', 'error');
      return;
    }

    // Check for duplicates
    const exists = jobRounds.some(r => r.round_name.toLowerCase() === trimmedName.toLowerCase() && r.id !== editingRoundId);
    if (exists) {
      showToast('A round with this name already exists', 'error');
      return;
    }

    try {
      const token = localStorage.getItem('access_token');
      const url = editingRoundId 
        ? `/api/v1/recruitment/rounds/${editingRoundId}`
        : `/api/v1/recruitment/rounds`;

      const res = await fetch(url, {
        method: editingRoundId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ round_name: trimmedName, round_type: trimmedName, company_id: selectedCompanyId })
      });
      if (res.ok) {
        showToast(editingRoundId ? 'Round updated successfully' : 'Round created successfully', 'success');
        setNewRoundData({ round_name: '', round_type: 'General' });
        setEditingRoundId(null);
        setShowManageRoundsModal(false);
        fetchRounds();
      } else {
        showToast('Failed to save round', 'error');
      }
    } catch (err) {
      showToast('Error saving round', 'error');
    }
  };

  const handleCreateRoundAndSchedule = async () => {
    if (!scheduleData.date) {
      showToast('Please select a Date & Time', 'error');
      return;
    }
    try {
      const token = localStorage.getItem('access_token');
      // 1. Create a generic round first
      let roundId = scheduleData.round_id;
      if (roundId === 'create_new' || !roundId) {
        if (!quickRoundName.trim()) {
           showToast('Please enter a name for the new round', 'error');
           return;
        }
        const resRound = await fetch(`/api/v1/recruitment/rounds`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ round_name: quickRoundName, round_type: 'General', company_id: selectedCompanyId })
        });
        if (resRound.ok) {
          const newRound = await resRound.json();
          roundId = newRound.id;
        } else {
          showToast('Failed to create round', 'error');
          return;
        }
      }

      // 2. Schedule Interview
      const res = await fetch(`/api/v1/recruitment/applications/${selectedCandidate.application_id}/interviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ ...scheduleData, round_id: roundId, company_id: selectedCompanyId })
      });
      if (res.ok) {
        showToast('Interview scheduled successfully', 'success');
        setShowScheduleModal(false);
        setScheduleData({ round_id: '', mode: 'Online', date: '', interviewer_id: '' });
        openCandidateProfile(selectedCandidate);
      } else {
        showToast('Failed to schedule interview', 'error');
      }
    } catch (err) {
      showToast('Error scheduling interview', 'error');
    }
  };

  const handleDeleteRound = async (id: string) => {
    if (!confirm('Are you sure you want to delete this master round?')) return;
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`/api/v1/recruitment/rounds/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('Round deleted successfully', 'success');
        fetchRounds();
      } else {
        showToast('Failed to delete round', 'error');
      }
    } catch (err) {
      showToast('Error deleting round', 'error');
    }
  };

  const handleScheduleInterview = async () => {
    if (scheduleData.round_id === 'create_new') {
      return handleCreateRoundAndSchedule();
    }
    if (!scheduleData.round_id || !scheduleData.date) {
      showToast('Please select a round and date', 'error');
      return;
    }

    // Check: same round already scheduled and not yet completed
    const alreadyScheduled = candidateInterviews.some(
      (iv: any) => iv.job_interview_round_id === scheduleData.round_id && iv.status !== 'COMPLETED'
    );
    if (alreadyScheduled) {
      showToast('This interview round is already scheduled for this candidate. Please complete the current interview first before scheduling another.', 'error');
      return;
    }

    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`/api/v1/recruitment/applications/${selectedCandidate.application_id}/interviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ ...scheduleData, company_id: selectedCompanyId })
      });
      if (res.ok) {
        showToast('Interview scheduled successfully', 'success');
        setShowScheduleModal(false);
        setScheduleData({ round_id: '', mode: 'Online', date: '', interviewer_id: '' });
        // Refresh interviews
        openCandidateProfile(selectedCandidate);
      } else {
        showToast('Failed to schedule interview', 'error');
      }
    } catch (err) {
      showToast('Error scheduling interview', 'error');
    }
  };

  const handleSubmitFeedback = async () => {
    const tech = Number(feedbackData.technical) || 0;
    const comm = Number(feedbackData.communication) || 0;
    if (tech < 1 || tech > 5 || comm < 1 || comm > 5) {
      showToast('Ratings must be between 1 and 5', 'error');
      return;
    }
    const overallRating = feedbackData.overall || Math.round((tech + comm) / 2);
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`/api/v1/recruitment/interviews/${feedbackData.interview_id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ ...feedbackData, technical: tech, communication: comm, overall: overallRating })
      });
      if (res.ok) {
        showToast('Feedback submitted successfully', 'success');
        setShowFeedbackModal(false);
        setFeedbackData({ interview_id: '', technical: 0, communication: 0, problem_solving: 0, overall: 0, recommendation: 'PENDING', notes: '' });
        // Refresh interviews
        openCandidateProfile(selectedCandidate);
      } else {
        showToast('Failed to submit feedback', 'error');
      }
    } catch (err) {
      showToast('Error submitting feedback', 'error');
    }
  };

  const handleDragStart = (e: React.DragEvent, appId: string) => {
    e.dataTransfer.setData('appId', appId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleMoveCandidateToStage = async (appId: string, newStatus: string) => {
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`/api/v1/recruitment/applications/${appId}/stage`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus, company_id: selectedCompanyId })
      });
      if (res.ok) {
        showToast(`Moved candidate to ${newStatus} stage!`, 'success');
        if (selectedCandidate) {
          setSelectedCandidate({ ...selectedCandidate, status: newStatus });
        }
        fetchApplications(selectedAtsJobId || 'all');
      } else {
        showToast('Failed to update stage', 'error');
      }
    } catch (err) {
      showToast('Error updating stage', 'error');
    }
  };

  const STAGE_ORDER = ['APPLIED', 'SCREENING', 'INTERVIEWING', 'SELECTED', 'OFFERED', 'HIRED'];
  const LOCKED_STAGES = ['SELECTED', 'HIRED', 'REJECTED'];

  const canDragApp = (app: any) => !LOCKED_STAGES.includes(app.status?.toUpperCase());

  const canDropToStage = (appId: string, newStatus: string) => {
    const app = applications.find(a => a.application_id === appId);
    if (!app) return false;
    const currentStage = app.status?.toUpperCase();
    // Block if already in a locked stage
    if (LOCKED_STAGES.includes(currentStage)) return false;
    const currentIdx = STAGE_ORDER.indexOf(currentStage);
    const newIdx = STAGE_ORDER.indexOf(newStatus);
    // Must be a forward move (no going back)
    if (newIdx <= currentIdx) {
      showToast(`Cannot move candidate backward from ${currentStage} to ${newStatus}.`, 'error');
      return false;
    }
    return true;
  };

  const handleDropCandidate = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const appId = e.dataTransfer.getData('appId');
    if (!appId) return;
    if (!canDropToStage(appId, newStatus)) return;
    
    const prevApps = [...applications];
    setApplications(prev => prev.map(app => app.application_id === appId ? { ...app, status: newStatus } : app));
    
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`/api/v1/recruitment/applications/${appId}/stage`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus, company_id: selectedCompanyId })
      });
      if (!res.ok) {
        setApplications(prevApps);
        showToast('Failed to update stage', 'error');
      }
    } catch (err) {
      setApplications(prevApps);
      showToast('Error updating stage', 'error');
    }
  };

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      let url = '/api/v1/recruitment/jobs';
      if (selectedCompanyId) url += `?company_id=${selectedCompanyId}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setJobs(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const token = localStorage.getItem('access_token');
      let url = '/api/v1/departments';
      if (selectedCompanyId) url += `?company_id=${selectedCompanyId}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDepartments(data.departments || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchIntegrations = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const headers = { 'Authorization': `Bearer ${token}` };
      let q = selectedCompanyId ? `?company_id=${selectedCompanyId}` : '';
      
      const [emailRes, whatsappRes, campRes, rulesRes] = await Promise.all([
        fetch(`/api/v1/recruitment/settings/email${q}`, { headers }),
        fetch(`/api/v1/recruitment/settings/whatsapp${q}`, { headers }),
        fetch(`/api/v1/recruitment/settings/whatsapp-campaigns${q}`, { headers }),
        fetch(`/api/v1/recruitment/settings/notification-rules${q}`, { headers })
      ]);
      
      let tempIntegrations: any[] = [];
      if (emailRes.ok) {
        const emailData = await emailRes.json();
        if (emailData) {
          tempIntegrations.push({ provider: 'SMTP', is_active: emailData.is_active, id: emailData.id });
          setSmtpCreds({ fromEmail: emailData.from_email || '', password: emailData.smtp_password_encrypted || '', smtpServer: emailData.smtp_host || '', smtpType: emailData.encryption_type || 'TLS' });
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
      console.error(err);
    }
  };

  const fetchCompanies = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;
      const payload = JSON.parse(atob(token.split('.')[1]));
      const tokenRoles = payload.realm_access?.roles || [];
      const preferredUsername = payload.preferred_username || '';
      const isSuper = tokenRoles.includes('SuperAdmin') || tokenRoles.includes('superadmin') || tokenRoles.includes('Realm Admin') || preferredUsername.toLowerCase() === 'superadmin';
      
      setIsSuperAdmin(!!isSuper);

      if (isSuper) {
        const res = await fetch('/api/v1/companies', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setCompanies(data.companies || []);
          if (data.companies && data.companies.length > 0 && !selectedCompanyId) {
            setSelectedCompanyId(data.companies[0].id);
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
    if (activeTab === 'jobs' || activeTab === 'overview' || activeTab === 'ats') {
      fetchJobs();
    }
    // Fetch departments for the "Create Job" modal
    fetchDepartments();
  }, [activeTab, selectedCompanyId]);

  useEffect(() => {
    if (showCreateJobModal) {
      fetchRounds();
    }
  }, [showCreateJobModal]);

  const handleCreateJob = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const method = editingJobId ? 'PUT' : 'POST';
      const url = editingJobId ? `/api/v1/recruitment/jobs/${editingJobId}` : '/api/v1/recruitment/jobs';
      
      const payload: any = { ...newJob };
      if (selectedCompanyId) payload.company_id = selectedCompanyId;

      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setShowCreateJobModal(false);
        fetchJobs();
        setNewJob({ title: '', department_id: '', location: '', employment_type: 'Full-Time', experience_range: '', headcount: 1, salary_range: '', currency: 'INR', description: '', interview_rounds: [] });
        setEditingJobId(null);
        showToast(editingJobId ? 'Job updated successfully!' : 'Job created successfully!', 'success');
      } else {
        showToast('Failed to save job', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error saving job', 'error');
    }
  };

  const executeDeleteJob = async (id: string) => {
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`/api/v1/recruitment/jobs/${id}/status`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ status: 'CLOSED', company_id: selectedCompanyId })
      });
      if (res.ok) {
        fetchJobs();
        showToast('Job closed successfully!', 'success');
      } else {
        showToast('Failed to close job', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error closing job', 'error');
    }
  };

  const handleSaveIntegration = async (provider: string, credentials: any, isActive: boolean) => {
    try {
      const token = localStorage.getItem('access_token');
      let url = '';
      let payload = {};
      
      if (provider === 'SMTP') {
        url = '/api/v1/recruitment/settings/email';
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
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        fetchIntegrations();
        setShowSmtpModal(false);
        setShowWhatsappModal(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  
  const executeDeleteIntegration = async (provider: string) => {
    try {
      const token = localStorage.getItem('access_token');
      let url = provider === 'email' ? '/api/v1/recruitment/settings/email' : '/api/v1/recruitment/settings/whatsapp';
      if (selectedCompanyId) url += `?company_id=${selectedCompanyId}`;
      await fetch(url, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      fetchIntegrations();
      showToast('Integration deleted successfully', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to delete integration', 'error');
    }
  };

  const handleSaveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('access_token');
      const isUpdate = !!currentCampaign.id;
      const url = isUpdate 
        ? `/api/v1/recruitment/settings/whatsapp-campaigns/${currentCampaign.id}`
        : '/api/v1/recruitment/settings/whatsapp-campaigns';
      
      const res = await fetch(url, {
        method: isUpdate ? 'PUT' : 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...currentCampaign, company_id: selectedCompanyId })
      });
      if (res.ok) {
        setShowCampaignModal(false);
        fetchIntegrations();
        showToast('Campaign saved successfully', 'success');
      } else {
        const error = await res.json();
        showToast(error.error || 'Failed to save campaign', 'error');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const executeDeleteCampaign = async (id: string) => {
    try {
      const token = localStorage.getItem('access_token');
      await fetch(`/api/v1/recruitment/settings/whatsapp-campaigns/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      fetchIntegrations();
      showToast('Campaign deleted successfully', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to delete campaign', 'error');
    }
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('access_token');
      const isUpdate = !!currentRule.id;
      const url = isUpdate 
        ? `/api/v1/recruitment/settings/notification-rules/${currentRule.id}`
        : '/api/v1/recruitment/settings/notification-rules';
      
      const res = await fetch(url, {
        method: isUpdate ? 'PUT' : 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...currentRule, company_id: selectedCompanyId })
      });
      if (res.ok) {
        setShowRuleModal(false);
        fetchIntegrations();
      } else {
        const error = await res.json();
        showToast(error.error || 'Failed to save rule', 'error');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const executeDeleteRule = async (id: string) => {
    try {
      const token = localStorage.getItem('access_token');
      await fetch(`/api/v1/recruitment/settings/notification-rules/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      fetchIntegrations();
      showToast('Rule deleted successfully', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to delete rule', 'error');
    }
  };


  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'ats',
      label: 'ATS Kanban Board',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },
    {
      id: 'jobs',
      label: 'Active Jobs',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      id: 'rounds',
      label: 'Interview Rounds',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16m-7 6h7" /></svg>
      ),
    },
    {
      id: 'offers',
      label: 'Offers',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      id: 'overview',
      label: 'Analytics & Overview',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
        </svg>
      ),
    }
  ];

  return (
    <div style={{ fontFamily: '"DM Sans", sans-serif' }} className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden">
      
      {/* PAGE HEADER */}
      <div className="flex-shrink-0 px-8 pt-6 pb-2 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 flex-shrink-0 border border-white/20">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Recruitment ATS</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50">
                Live Console
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
              End-to-end Hiring Pipeline, Kanban ATS, and Candidate Management
            </p>
          </div>
        </div>

        {isSuperAdmin && companies.length > 0 && (
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3.5 py-1.5 rounded-xl shadow-xs border border-slate-200/80 dark:border-slate-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Company:</span>
            <select 
              value={selectedCompanyId} 
              onChange={e => setSelectedCompanyId(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer pr-1"
            >
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* TOOLBAR CARD (TABS + DYNAMIC ACTION BUTTON) */}
      <div className="flex-shrink-0 px-8 pb-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-1.5 shadow-xs flex flex-col sm:flex-row justify-between items-center gap-3">
          
          {/* TABS */}
          <div className="flex overflow-x-auto no-scrollbar gap-1.5 w-full sm:w-auto p-0.5">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 scale-[1.02]'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* DYNAMIC ACTION BUTTON */}
          <div className="pr-1.5 w-full sm:w-auto flex justify-end">
            {activeTab === 'rounds' && (
              <button 
                onClick={() => {
                  setEditingRoundId(null);
                  setNewRoundData({ round_name: '', round_type: 'General' });
                  setShowManageRoundsModal(true);
                }}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-extrabold transition-all shadow-md shadow-blue-600/20 active:scale-95 whitespace-nowrap cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Create Master Round
              </button>
            )}

            {activeTab === 'jobs' && (
              <button 
                onClick={() => {
                  setEditingJobId(null);
                  setNewJob({ title: '', department_id: '', location: '', employment_type: 'Full-Time', experience_range: '', headcount: 1, salary_range: '', currency: 'INR', description: '', interview_rounds: [] });
                  setShowCreateJobModal(true);
                }}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-extrabold transition-all shadow-md shadow-blue-600/20 active:scale-95 whitespace-nowrap cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Create New Job
              </button>
            )}

            {activeTab === 'ats' && (
              <button 
                onClick={() => setShowAddCandidateModal(true)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-extrabold transition-all shadow-md shadow-blue-600/20 active:scale-95 whitespace-nowrap cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add Candidate
              </button>
            )}
          </div>

        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 overflow-y-auto px-8 pb-8 pt-2 relative">
        
        {/* =============================================================== */}
        {/* === ROUNDS TAB === */}
        {activeTab === 'rounds' && (
          <div className="flex-1 space-y-5 animate-fadeIn">
            <div className="flex justify-between items-center px-1">
              <div>
                <h2 className="text-lg font-black text-slate-800 dark:text-white tracking-tight">Master Interview Rounds</h2>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">Company-wide standardized interview rounds list.</p>
              </div>
              <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-extrabold border border-blue-200/60 dark:border-blue-800/50">
                {jobRounds.length} Rounds Configured
              </span>
            </div>

            {jobRounds.length === 0 ? (
              <div className="p-12 border border-dashed border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 rounded-2xl text-center flex flex-col items-center">
                <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-4">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16m-7 6h7"/></svg>
                </div>
                <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-200">No master rounds found</h3>
                <p className="text-xs text-slate-500 font-medium mt-1 mb-5">Create master interview rounds to standardise candidate evaluations.</p>
                <button onClick={() => { setEditingRoundId(null); setNewRoundData({ round_name: '', round_type: 'General' }); setShowManageRoundsModal(true); }} className="px-4 py-2 bg-blue-600 text-white font-extrabold text-xs rounded-xl shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-colors cursor-pointer">
                  + Create Master Round
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
                {jobRounds.map(round => (
                  <div key={round.id} className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 rounded-2xl shadow-2xs hover:shadow-md transition-all group flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-2.5">
                        <div className="w-8 h-8 bg-gradient-to-tr from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 border border-blue-100 dark:border-blue-900/50 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                        </div>
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md text-[9px] font-black text-slate-500 dark:text-slate-400 tracking-wider uppercase truncate max-w-[100px]">{round.round_type}</span>
                      </div>
                      
                      <h3 className="font-black text-sm text-slate-900 dark:text-white mb-0.5 truncate" title={round.round_name}>{round.round_name}</h3>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium leading-tight mb-3 line-clamp-2">Standardised evaluation round for candidate tracking.</p>
                    </div>
                    
                    <div className="flex gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
                      <button onClick={() => { setEditingRoundId(round.id); setNewRoundData({ round_name: round.round_name, round_type: round.round_type }); setShowManageRoundsModal(true); }} className="flex-1 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-[10.5px] font-extrabold transition-colors flex items-center justify-center gap-1 cursor-pointer">
                        <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        Edit
                      </button>
                      <button onClick={() => handleDeleteRound(round.id)} className="flex-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 rounded-lg text-[10.5px] font-extrabold transition-colors flex items-center justify-center gap-1 cursor-pointer">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* === JOBS TAB === */}
        {/* =============================================================== */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fadeIn">
            {/* Stats Cards */}
            {[
              { label: 'Active Jobs', value: jobs.length.toString(), color: 'blue', icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
              { label: 'Total Applicants', value: '--', color: 'indigo', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
              { label: 'Interviews Scheduled', value: '--', color: 'amber', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
              { label: 'Offers Released', value: '--', color: 'emerald', icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z' },
            ].map((stat, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
                <div className={`absolute -right-6 -top-6 w-24 h-24 bg-${stat.color}-50 dark:bg-${stat.color}-900/20 rounded-full blur-2xl group-hover:bg-${stat.color}-100 dark:group-hover:bg-${stat.color}-900/40 transition-colors`}></div>
                <div className="relative z-10">
                  <div className={`w-10 h-10 mb-4 rounded-xl flex items-center justify-center bg-${stat.color}-100 text-${stat.color}-600 dark:bg-${stat.color}-900/40 dark:text-${stat.color}-400`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={stat.icon} /></svg>
                  </div>
                  <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    {stat.label}
                  </h3>
                  <div className="text-4xl font-black text-slate-800 dark:text-white">
                    {stat.value}
                  </div>
                </div>
              </div>
            ))}
            
            <div className="col-span-1 lg:col-span-4 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-10 min-h-[400px] flex flex-col items-center justify-center text-slate-400 shadow-sm relative overflow-hidden">
               <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03]"></div>
               <svg className="w-16 h-16 mb-4 text-slate-300 dark:text-slate-700 animate-bounce" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
               <p className="font-bold text-lg text-slate-500 dark:text-slate-400">Detailed Analytics Dashboard Coming Soon</p>
               <p className="text-sm font-medium mt-2">Visualizing job_postings and recruitment_activity_logs data.</p>
            </div>
          </div>
        )}

        {/* =============================================================== */}
        {/* JOBS & ROUNDS TAB (CRUD: job_postings, job_interview_rounds) */}
        {/* =============================================================== */}
        {activeTab === 'jobs' && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm animate-fadeIn">
             <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                <div>
                  <h2 className="text-xl font-black text-slate-800 dark:text-white">Active Postings</h2>
                  <p className="text-xs font-semibold text-slate-500 mt-1">Manage job_postings and job_interview_rounds tables</p>
                </div>
                <div className="flex gap-3">
                  <div className="relative">
                    <svg className="w-4 h-4 absolute left-3 top-3 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input type="text" placeholder="Search Jobs..." className="pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" />
                  </div>
                </div>
             </div>
             
             <div className="p-0 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/30 text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <th className="p-5 font-black">Job Code & Title</th>
                      <th className="p-5 font-black">Department</th>
                      <th className="p-5 font-black">Status</th>
                      <th className="p-5 font-black">Applicants</th>
                      <th className="p-5 font-black text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {loading ? (
                      <tr><td colSpan={5} className="p-5 text-center text-slate-500">Loading jobs...</td></tr>
                    ) : jobs.length === 0 ? (
                      <tr><td colSpan={5} className="p-5 text-center text-slate-500">No active job postings found.</td></tr>
                    ) : (
                      jobs.map((job) => (
                        <tr key={job.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-blue-50/30 dark:hover:bg-slate-800/50 transition-colors group">
                          <td className="p-5">
                            <div className="flex flex-col">
                              <span className="font-black text-slate-800 dark:text-slate-100 text-base">{job.title}</span>
                              <span className="text-xs font-bold text-slate-500 mt-1 font-mono bg-slate-100 dark:bg-slate-800 w-fit px-2 py-0.5 rounded">{job.id.substring(0,8)}</span>
                            </div>
                          </td>
                          <td className="p-5 font-semibold text-slate-600 dark:text-slate-300">
                            {departments.find(d => d.id === job.department_id)?.name || job.department_id || 'N/A'}
                          </td>
                          <td className="p-5">
                            <span className="px-3 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg text-xs font-bold border border-emerald-200 dark:border-emerald-800/30 shadow-sm">{job.status}</span>
                          </td>
                          <td className="p-5 font-black text-slate-700 dark:text-slate-200">0 <span className="text-slate-400 text-xs font-semibold ml-1">candidates</span></td>
                          <td className="p-5 text-right">
                            <div className="flex justify-end gap-2 transition-opacity">
                              <button onClick={() => {
                                  setEditingJobId(job.id);
                                  setNewJob({
                                    title: job.title,
                                    department_id: job.department_id || '',
                                    location: job.work_mode || '',
                                    employment_type: job.employment_type || 'Full-Time',
                                    salary_range: (job.min_salary != null && job.max_salary != null) ? `${parseFloat(job.min_salary) / 1000}k-${parseFloat(job.max_salary) / 1000}k` : (job.min_salary != null ? `${parseFloat(job.min_salary) / 1000}k` : ''),
                                    currency: job.currency || 'INR',
                                    experience_range: job.experience_range || '',
                                    headcount: job.openings_count || 1,
                                    description: job.description || '',
                                    interview_rounds: []
                                  });
                                  setShowCreateJobModal(true);
                                }} className="p-2 text-slate-400 hover:text-blue-600 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 transition-all" title="Edit Job">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                              </button>
                              <button className="p-2 text-slate-400 hover:text-indigo-600 bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 transition-all" title="Configure Rounds">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                              </button>
                              <button onClick={() => fetchJobAnalytics(job.id)} className="p-2 text-slate-400 hover:text-emerald-600 bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 transition-all" title="View Job Analytics">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                              </button>
                              <button onClick={() => setDeleteConfirm({ type: 'job', id: job.id })} className="p-2 text-slate-400 hover:text-rose-600 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 transition-all" title="Close Job">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </div>
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
        {/* ATS KANBAN BOARD (CRUD: candidates, job_applications, stage_history, notes, docs) */}
        {/* =============================================================== */}
        {activeTab === 'ats' && (
          <div className="h-full flex flex-col animate-fadeIn">
            <div className="flex justify-between items-center mb-6">
              <div className="flex gap-4">
                <select value={selectedAtsJobId || 'all'} onChange={(e) => setSelectedAtsJobId(e.target.value)} className="px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold shadow-sm focus:ring-2 focus:ring-blue-500">
                  <option value="all">All Jobs</option>
                  {jobs.map(job => (
                    <option key={job.id} value={job.id}>{job.title} ({job.id.substring(0,8)})</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowAddCandidateModal(true)} className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  + Add Candidate Manually
                </button>
              </div>
            </div>
            
            <div className="flex-1 flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
              {/* Kanban Columns */}
              {['APPLIED', 'SCREENING', 'INTERVIEWING', 'SELECTED', 'OFFERED'].map((stage, idx) => {
                const stageApps = applications.filter(a => a.status && a.status.toUpperCase() === stage);
                return (
                <div key={stage} onDragOver={handleDragOver} onDrop={(e) => handleDropCandidate(e, stage)} className="flex-shrink-0 w-[280px] bg-slate-100/50 dark:bg-slate-900/30 rounded-3xl border border-slate-200 dark:border-slate-800 flex flex-col h-full overflow-hidden shadow-inner">
                  
                  <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 flex justify-between items-center backdrop-blur-md">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${idx === 0 ? 'bg-slate-400' : idx === 1 ? 'bg-blue-400' : idx === 2 ? 'bg-amber-400' : idx === 3 ? 'bg-indigo-400' : 'bg-emerald-400'}`}></div>
                      <h3 className="font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider text-xs">{stage}</h3>
                    </div>
                    <span className="px-2 py-1 bg-white dark:bg-slate-800 rounded-lg text-xs font-black text-slate-600 dark:text-slate-400 shadow-sm border border-slate-200 dark:border-slate-700">{stageApps.length}</span>
                  </div>
                  <div className="flex-1 p-4 overflow-y-auto space-y-4">
                      {stageApps.length > 0 ? stageApps.map(app => {
                        const isLocked = LOCKED_STAGES.includes(app.status?.toUpperCase());
                        return (
                        <div 
                          key={app.application_id} 
                          draggable={!isLocked} 
                          onDragStart={(e) => { if (!isLocked) handleDragStart(e, app.application_id); }} 
                          onClick={() => openCandidateProfile(app)}
                          className={`group bg-white dark:bg-slate-800 p-3.5 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-slate-200 dark:border-slate-700 transition-colors ${
                            isLocked
                              ? 'cursor-default opacity-90 border-slate-200 dark:border-slate-700'
                              : 'cursor-grab active:cursor-grabbing hover:border-blue-400 dark:hover:border-blue-500'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2.5">
                            <div className="font-bold text-slate-800 dark:text-white text-[13px] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-tight">{app.first_name} {app.last_name}</div>
                            <button className="text-slate-300 hover:text-slate-500 transition-colors ml-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
                            </button>
                          </div>
                          
                          <div className="space-y-1.5 mb-3">
                            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-[11px] font-medium">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                              <span className="truncate">{app.email}</span>
                            </div>
                            
                            {app.phone && (
                              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-[11px] font-medium">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                <span className="truncate">{app.phone}</span>
                              </div>
                            )}

                            <div className="pt-2 border-t border-slate-100 dark:border-slate-700/40 flex items-center justify-between">
                              <span className="inline-flex items-center gap-1 text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md border border-indigo-200/50">
                                🎯 {app.current_round_name ? app.current_round_name : 'No Round Scheduled'}
                              </span>
                              <span className="text-[10px] font-black text-slate-500 dark:text-slate-400">
                                {app.completed_rounds || 0}/{app.total_rounds || 0} Done
                              </span>
                            </div>
                          </div>

                          <div className="pt-3 border-t border-slate-100 dark:border-slate-700/50 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[9px] font-black border border-blue-100 dark:border-blue-800">
                                {app.first_name?.[0]}{(app.last_name?.[0] || '')}
                              </div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{stage}</span>
                            </div>
                            <div className="text-[10px] font-semibold text-slate-400">
                              {new Date(app.applied_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </div>
                          </div>
                        </div>
                        );
                      }) : (
                        <div className="text-center p-4 text-xs font-semibold text-slate-400">
                          No candidates in this stage
                        </div>
                      )}
                  </div>
                </div>
              )})}
            </div>
          </div>
        )}

        {/* Candidate Profile Off-canvas */}
        {showCandidatePanel && selectedCandidate && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={() => setShowCandidatePanel(false)}></div>
            <div className="relative w-[500px] bg-white dark:bg-slate-900 h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col animate-slideInRight">
              
              <div className="p-8 border-b border-slate-200 dark:border-slate-800 flex justify-between items-start bg-gradient-to-br from-indigo-500/5 to-purple-500/5 dark:from-indigo-900/20 dark:to-purple-900/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl rounded-full"></div>
                <div className="flex gap-5 items-center relative z-10">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-2xl font-black shadow-lg shadow-indigo-500/30 transform hover:scale-105 transition-transform duration-300">
                    {selectedCandidate.first_name?.[0]}{selectedCandidate.last_name?.[0] || ''}
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{selectedCandidate.first_name} {selectedCandidate.last_name}</h2>
                    <div className="flex gap-3 text-[11px] font-bold text-slate-500 mt-2 bg-white/60 dark:bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700/50 backdrop-blur-md">
                      <span className="flex items-center gap-1"><svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>{selectedCandidate.email}</span>
                      <span className="text-slate-300 dark:text-slate-600">|</span>
                      <span className="flex items-center gap-1"><svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>{selectedCandidate.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Stage:</span>
                      <select 
                        value={selectedCandidate.status?.toUpperCase() || 'APPLIED'} 
                        onChange={(e) => handleMoveCandidateToStage(selectedCandidate.application_id, e.target.value)}
                        className="px-3 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-xs font-black rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm cursor-pointer"
                      >
                        <option value="APPLIED">1. APPLIED</option>
                        <option value="SCREENING">2. SCREENING</option>
                        <option value="INTERVIEWING">3. INTERVIEWING</option>
                        <option value="SELECTED">⭐ 4. SELECTED</option>
                        <option value="OFFERED">✉️ 5. OFFERED</option>
                        <option value="HIRED">🎉 6. HIRED</option>
                        <option value="REJECTED">❌ REJECTED</option>
                      </select>
                    </div>
                  </div>
                </div>
                <button onClick={() => setShowCandidatePanel(false)} className="p-2.5 bg-white/80 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-full text-slate-400 hover:text-slate-600 transition-all z-10">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                
                {/* APPLIED STAGE NOTICE BANNER */}
                {selectedCandidate.status?.toUpperCase() === 'APPLIED' && (
                  <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/60 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm shrink-0">
                        📋
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-200">Candidate in Initial Applied Stage</h4>
                        <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">Review full details & resume below. Click 'Move to Screening' to enable interview scheduling.</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleMoveCandidateToStage(selectedCandidate.application_id, 'SCREENING')}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold shadow-sm transition-all cursor-pointer shrink-0"
                    >
                      Move to Screening &rarr;
                    </button>
                  </div>
                )}

                {/* INTERVIEWS SECTION */}
                <section>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-black text-slate-800 dark:text-white flex items-center gap-2">
                      <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      Interview Rounds
                    </h3>
                    <button 
                      onClick={() => {
                        const stage = selectedCandidate?.status?.toUpperCase();
                        if (stage === 'APPLIED') {
                          showToast('Candidate must be moved to Screening stage (or later) before scheduling an interview. Drag candidate to Screening or click Move to Screening below.', 'error');
                          return;
                        }
                        setShowScheduleModal(true);
                      }} 
                      className="text-xs font-bold px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors cursor-pointer"
                    >
                      + Schedule
                    </button>
                  </div>

                  {candidateInterviews.length === 0 ? (
                    <div className="text-center p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                      <p className="text-sm font-bold text-slate-400">No interviews scheduled yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {candidateInterviews.map((interview: any) => (
                        <div key={interview.id} className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h4 className="font-bold text-sm text-slate-800 dark:text-white">{interview.round_name} <span className="text-slate-400 font-normal">({interview.round_type})</span></h4>
                              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                                {new Date(interview.scheduled_start_time).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                              </p>
                              <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500 dark:text-slate-400 font-semibold">
                                <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                <span>Interviewer: <strong className="text-slate-700 dark:text-slate-200">{interview.interviewer_first_name ? `${interview.interviewer_first_name} ${interview.interviewer_last_name || ''}` : 'Unassigned'}</strong></span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-slate-500 dark:text-slate-400 font-semibold">
                                <svg className={`w-3.5 h-3.5 ${interview.status === 'COMPLETED' ? 'text-emerald-500' : 'text-amber-500'}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                <span>Status: <strong className={interview.status === 'COMPLETED' ? 'text-emerald-600 dark:text-emerald-400 font-extrabold' : 'text-amber-600 dark:text-amber-400 font-extrabold'}>
                                  {interview.status === 'COMPLETED' ? 'Completed' : 'In Progress'}
                                </strong></span>
                              </div>
                            </div>
                          </div>
                          
                          {interview.status === 'COMPLETED' ? (
                            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/80 space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Recommendation</span>
                                <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-md ${interview.recommendation === 'HIRE' || interview.recommendation === 'STRONG_HIRE' ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200' : interview.recommendation === 'NO_HIRE' ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200'}`}>
                                  {interview.recommendation || 'PENDING'}
                                </span>
                              </div>

                              {(interview.technical_rating > 0 || interview.communication_rating > 0 || interview.overall_rating > 0) && (
                                <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-800">
                                  {interview.technical_rating > 0 && (
                                    <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                      Technical: <span className="text-blue-600 dark:text-blue-400 font-black">{interview.technical_rating}/5</span>
                                    </div>
                                  )}
                                  {interview.communication_rating > 0 && (
                                    <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                      Comm: <span className="text-blue-600 dark:text-blue-400 font-black">{interview.communication_rating}/5</span>
                                    </div>
                                  )}
                                  {interview.problem_solving_rating > 0 && (
                                    <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                      Problem Solving: <span className="text-blue-600 dark:text-blue-400 font-black">{interview.problem_solving_rating}/5</span>
                                    </div>
                                  )}
                                  {interview.overall_rating > 0 && (
                                    <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                      Overall: <span className="text-emerald-600 dark:text-emerald-400 font-black">⭐ {interview.overall_rating}/5</span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {interview.feedback && (
                                <p className="text-xs text-slate-600 dark:text-slate-300 italic bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/60">"{interview.feedback}"</p>
                              )}
                            </div>
                          ) : (
                            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/80 flex justify-end">
                              <button onClick={() => { setFeedbackData(prev => ({...prev, interview_id: interview.id})); setShowFeedbackModal(true); }} className="text-xs font-extrabold text-blue-600 hover:text-blue-700 dark:text-blue-400 cursor-pointer">
                                + Add Feedback
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* DOCUMENTS & RESUME INLINE PREVIEW SECTION */}
                <section>
                  <h3 className="font-black text-slate-800 dark:text-white flex items-center gap-2 mb-4 uppercase tracking-wider text-xs">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                    </div>
                    Candidate Resume & Documents
                  </h3>
                  {candidateDocuments.length === 0 ? (
                    <div className="text-center p-8 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                      <div className="w-12 h-12 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      </div>
                      <p className="text-sm font-bold text-slate-500">No resume document uploaded.</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {candidateDocuments.map((doc: any) => (
                        <div key={doc.id} className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm space-y-3">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                              </div>
                              <div>
                                <p className="font-bold text-xs text-slate-800 dark:text-white uppercase tracking-wider">{doc.document_type || 'Resume'} Document</p>
                                <p className="text-[10px] font-semibold text-slate-400">Uploaded {new Date(doc.created_at).toLocaleDateString()}</p>
                              </div>
                            </div>
                            {doc.file_url && (
                              <button 
                                onClick={() => {
                                  if (doc.file_url.startsWith('data:')) {
                                    try {
                                      const arr = doc.file_url.split(',');
                                      const mimeMatch = arr[0].match(/:(.*?);/);
                                      const mime = mimeMatch ? mimeMatch[1] : 'application/pdf';
                                      const bstr = atob(arr[1]);
                                      let n = bstr.length;
                                      const u8arr = new Uint8Array(n);
                                      while (n--) {
                                        u8arr[n] = bstr.charCodeAt(n);
                                      }
                                      const blob = new Blob([u8arr], { type: mime });
                                      const blobUrl = URL.createObjectURL(blob);
                                      window.open(blobUrl, '_blank');
                                    } catch (e) {
                                      window.open(doc.file_url, '_blank');
                                    }
                                  } else {
                                    const url = doc.file_url.startsWith('http') ? doc.file_url : `${doc.file_url}`;
                                    window.open(url, '_blank');
                                  }
                                }} 
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                              >
                                Fullscreen ↗
                              </button>
                            )}
                          </div>

                          {/* INLINE EMBEDDED RESUME PREVIEW */}
                          {doc.file_url ? (
                            <div className="w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 shadow-inner">
                              <iframe 
                                src={doc.file_url} 
                                className="w-full h-[450px] border-none" 
                                title={doc.document_type || 'Resume Preview'}
                              />
                            </div>
                          ) : (
                            <div className="p-4 bg-slate-50 dark:bg-slate-900 text-slate-400 text-center text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800">
                              No Document Data Available
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              {/* CANDIDATE DRAWER FOOTER ACTION BAR */}
              {selectedCandidate.status?.toUpperCase() === 'APPLIED' && (
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Candidate details reviewed?</span>
                  </div>
                  <button
                    onClick={() => handleMoveCandidateToStage(selectedCandidate.application_id, 'SCREENING')}
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer flex items-center gap-2"
                  >
                    <span>Move to Screening</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                  </button>
                </div>
              )}

              {['SCREENING', 'INTERVIEWING'].includes(selectedCandidate.status?.toUpperCase()) && (
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-slate-900 dark:to-slate-800 flex justify-between items-center shrink-0 gap-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Candidate Evaluation Complete?</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleMoveCandidateToStage(selectedCandidate.application_id, 'SELECTED')}
                      className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <span>⭐ Mark Selected</span>
                    </button>
                    <button
                      onClick={() => handleMoveCandidateToStage(selectedCandidate.application_id, 'REJECTED')}
                      className="px-3 py-2.5 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )}

              {['SELECTED', 'OFFERED'].includes(selectedCandidate.status?.toUpperCase()) && (
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-slate-900 dark:to-slate-800 flex justify-between items-center shrink-0 gap-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Final Hiring Action:</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleMoveCandidateToStage(selectedCandidate.application_id, 'HIRED')}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md active:scale-95 transition-all cursor-pointer"
                    >
                      🎉 Mark Hired
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Schedule Interview Modal */}
        {showScheduleModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowScheduleModal(false)}></div>
            <div className="relative bg-white dark:bg-slate-900 w-full max-w-[550px] max-h-[90vh] rounded-[32px] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-zoomIn flex flex-col">
              
              <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-br from-indigo-500/5 to-transparent flex justify-between items-start flex-shrink-0">
                <div>
                  <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mb-3 shadow-inner">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </div>
                  <h2 className="font-black text-2xl text-slate-800 dark:text-white tracking-tight">Schedule Interview</h2>
                  <p className="text-sm font-semibold text-slate-500 mt-1">Set up a new interview round for the candidate.</p>
                </div>
                <button onClick={() => setShowScheduleModal(false)} className="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 rounded-full transition-colors cursor-pointer"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
              
              <div className="p-6 md:p-8 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Select Round</label>
                  <select value={scheduleData.round_id} onChange={(e) => { setScheduleData({...scheduleData, round_id: e.target.value}); if (e.target.value !== 'create_new') setQuickRoundName(''); }} className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:border-indigo-500 focus:ring-0 transition-colors shadow-sm cursor-pointer appearance-none">
                    <option value="">Select an existing round...</option>
                    {jobRounds.map(r => <option key={r.id} value={r.id}>{r.round_name}</option>)}
                    <option value="create_new" className="font-black text-indigo-600 bg-indigo-50">&rarr; + Quick Create New Round</option>
                  </select>
                  {scheduleData.round_id === 'create_new' && (
                    <div className="mt-3 animate-fadeIn">
                      <input type="text" placeholder="Enter new round name (e.g. Technical Round 1)" value={quickRoundName} onChange={e => setQuickRoundName(e.target.value)} className="w-full p-3 bg-indigo-50/50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800/50 rounded-xl text-sm font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none placeholder-slate-400 transition-all" autoFocus />
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Date & Time</label>
                    <input type="datetime-local" value={scheduleData.date} onChange={(e) => setScheduleData({...scheduleData, date: e.target.value})} className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:border-indigo-500 focus:ring-0 transition-colors shadow-sm" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Interview Mode</label>
                    <div className="relative">
                      <select value={scheduleData.mode} onChange={(e) => setScheduleData({...scheduleData, mode: e.target.value})} className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:border-indigo-500 focus:ring-0 transition-colors shadow-sm appearance-none cursor-pointer">
                        <option value="Online">Online / Video Call</option>
                        <option value="In-Person">In-Person</option>
                        <option value="Phone">Phone</option>
                      </select>
                      <svg className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Assign Interviewer</label>
                  <div className="relative">
                    <div 
                      className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 cursor-pointer flex justify-between items-center shadow-sm"
                      onClick={() => setShowEmpDropdown(!showEmpDropdown)}
                    >
                      <span className="truncate">
                        {scheduleData.interviewer_id ? 
                          (employees.find(e => e.id === scheduleData.interviewer_id) ? 
                            `${employees.find(e => e.id === scheduleData.interviewer_id).first_name} ${employees.find(e => e.id === scheduleData.interviewer_id).last_name}` : 'Unknown'
                          ) : 'Leave Unassigned'}
                      </span>
                      <svg className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${showEmpDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                    </div>
                    {showEmpDropdown && (
                      <div className="mt-2 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden animate-fadeIn">
                        <div className="p-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                          <input 
                            type="text" 
                            placeholder="Search employees by name..." 
                            value={empSearch}
                            onChange={(e) => setEmpSearch(e.target.value)}
                            className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                            autoFocus
                          />
                        </div>
                        <div className="max-h-64 overflow-y-auto custom-scrollbar">
                          <div 
                            className="p-3 text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-50 dark:border-slate-700/50 transition-colors"
                            onClick={() => { setScheduleData({...scheduleData, interviewer_id: ''}); setShowEmpDropdown(false); setEmpSearch(''); }}
                          >
                            Leave Unassigned
                          </div>
                          {employees.filter(emp => `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(empSearch.toLowerCase())).map(emp => (
                            <div 
                              key={emp.id}
                              className="p-3 text-xs font-bold hover:bg-indigo-50 dark:hover:bg-indigo-900/30 cursor-pointer border-b border-slate-50 dark:border-slate-700/50 flex flex-col transition-colors"
                              onClick={() => { setScheduleData({...scheduleData, interviewer_id: emp.id}); setShowEmpDropdown(false); setEmpSearch(''); }}
                            >
                              <span className="text-slate-800 dark:text-white font-extrabold">{emp.first_name} {emp.last_name}</span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">{emp.designation || 'Employee'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3 flex-shrink-0">
                <button onClick={() => setShowScheduleModal(false)} className="px-6 py-2.5 font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl text-sm transition-all cursor-pointer">Cancel</button>
                <button onClick={handleCreateRoundAndSchedule} className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black rounded-xl text-sm shadow-lg shadow-indigo-500/30 active:scale-95 transition-all cursor-pointer">Confirm Schedule</button>
              </div>
            </div>
          </div>
        )}

        {/* Add Feedback Modal */}
        {showFeedbackModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowFeedbackModal(false)}></div>
            <div className="relative bg-white dark:bg-slate-900 w-[500px] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-zoomIn">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <h2 className="font-black text-lg">Interview Feedback</h2>
                <button onClick={() => setShowFeedbackModal(false)} className="text-slate-400 hover:text-slate-600"><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Technical (1-5)</label>
                    <input 
                      type="number" 
                      min="1" 
                      max="5" 
                      placeholder="1 to 5"
                      value={feedbackData.technical || ''} 
                      onChange={(e) => {
                        let val = parseInt(e.target.value) || 0;
                        if (val > 5) val = 5;
                        setFeedbackData({...feedbackData, technical: val});
                      }} 
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold" 
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Comm (1-5)</label>
                    <input 
                      type="number" 
                      min="1" 
                      max="5" 
                      placeholder="1 to 5"
                      value={feedbackData.communication || ''} 
                      onChange={(e) => {
                        let val = parseInt(e.target.value) || 0;
                        if (val > 5) val = 5;
                        setFeedbackData({...feedbackData, communication: val});
                      }} 
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold" 
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Problem Solving</label>
                    <input 
                      type="number" 
                      min="1" 
                      max="5" 
                      placeholder="Optional"
                      value={feedbackData.problem_solving || ''} 
                      onChange={(e) => {
                        let val = parseInt(e.target.value) || 0;
                        if (val > 5) val = 5;
                        setFeedbackData({...feedbackData, problem_solving: val});
                      }} 
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold" 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Recommendation</label>
                  <select value={feedbackData.recommendation} onChange={(e) => setFeedbackData({...feedbackData, recommendation: e.target.value})} className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold">
                    <option value="PENDING">Pending</option>
                    <option value="STRONG_HIRE">Strong Hire</option>
                    <option value="HIRE">Hire</option>
                    <option value="MAYBE">Maybe</option>
                    <option value="NO_HIRE">No Hire</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Notes / Feedback</label>
                  <textarea rows={3} value={feedbackData.notes} onChange={(e) => setFeedbackData({...feedbackData, notes: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold"></textarea>
                </div>
              </div>
              <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
                <button onClick={() => setShowFeedbackModal(false)} className="px-4 py-2 font-bold text-slate-500 hover:bg-slate-200 rounded-xl text-sm transition-colors">Cancel</button>
                <button onClick={handleSubmitFeedback} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow-md transition-colors">Submit Feedback</button>
              </div>
            </div>
          </div>
        )}


        {/* Job Analytics Off-canvas */}
        {showAnalyticsModal && analyticsData && (
          <div className="fixed inset-0 z-50 overflow-hidden font-sans">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setShowAnalyticsModal(false)}></div>
            <div className="fixed inset-y-0 right-0 max-w-xl w-full flex shadow-2xl transform transition-transform duration-300">
              <div className="w-full h-full bg-white dark:bg-slate-900 flex flex-col">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30">
                  <h2 className="text-xl font-black text-slate-800 dark:text-white">Job Analytics & Pipeline</h2>
                  <button onClick={() => setShowAnalyticsModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                  
                  {/* Summary Stats */}
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-4">Pipeline Overview</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-2xl border border-blue-100 dark:border-blue-800/50">
                        <p className="text-[10px] uppercase font-black tracking-wider text-blue-500 mb-1">Total Applicants</p>
                        <p className="text-3xl font-black text-blue-700 dark:text-blue-400">{analyticsData.summary?.total_applicants || 0}</p>
                      </div>
                      <div className="bg-amber-50 dark:bg-amber-900/20 p-5 rounded-2xl border border-amber-100 dark:border-amber-800/50">
                        <p className="text-[10px] uppercase font-black tracking-wider text-amber-500 mb-1">In Process</p>
                        <p className="text-3xl font-black text-amber-700 dark:text-amber-400">{analyticsData.summary?.in_process || 0}</p>
                      </div>
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-800/50">
                        <p className="text-[10px] uppercase font-black tracking-wider text-emerald-500 mb-1">Selected & Offered</p>
                        <p className="text-3xl font-black text-emerald-700 dark:text-emerald-400">{analyticsData.summary?.selected || 0}</p>
                      </div>
                      <div className="bg-rose-50 dark:bg-rose-900/20 p-5 rounded-2xl border border-rose-100 dark:border-rose-800/50">
                        <p className="text-[10px] uppercase font-black tracking-wider text-rose-500 mb-1">Rejected</p>
                        <p className="text-3xl font-black text-rose-700 dark:text-rose-400">{analyticsData.summary?.rejected || 0}</p>
                      </div>
                    </div>
                  </div>

                  {/* Candidate List */}
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-4">Candidate Breakdown</h3>
                    {analyticsData.candidates?.length === 0 ? (
                      <div className="p-8 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl text-center text-slate-500 font-semibold">
                        No candidates applied yet.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {analyticsData.candidates?.map((c: any) => (
                          <div key={c.id} className="flex justify-between items-center p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm font-black text-slate-600 dark:text-slate-300">
                                {c.first_name[0]}{c.last_name[0]}
                              </div>
                              <div>
                                <p className="font-bold text-slate-800 dark:text-white text-sm">{c.first_name} {c.last_name}</p>
                                <p className="text-[11px] font-semibold text-slate-500">{c.email}</p>
                              </div>
                            </div>
                            <span className={`px-2.5 py-1 text-[10px] font-black tracking-wider uppercase rounded-lg border ${
                              ['SELECTED', 'OFFERED', 'HIRED'].includes(c.status) ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              c.status === 'REJECTED' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                              'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {c.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =============================================================== */}
        {/* OFFERS TAB (CRUD: candidate_offers, offer_negotiations) */}
        {/* =============================================================== */}
        {activeTab === 'offers' && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm animate-fadeIn">
             <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                <div>
                  <h2 className="text-xl font-black text-slate-800 dark:text-white">Generated Offers</h2>
                  <p className="text-xs font-semibold text-slate-500 mt-1">Manage candidate_offers and offer_negotiations</p>
                </div>
                <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-indigo-500/20 active:scale-95 transition-all">
                  + Create Custom Offer
                </button>
             </div>
             
             <div className="p-10 flex flex-col items-center justify-center text-slate-400 min-h-[300px]">
                <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <svg className="w-8 h-8 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <p className="font-bold text-lg text-slate-500 dark:text-slate-400">No offers generated yet</p>
                <p className="text-sm font-medium mt-2 max-w-md text-center">Move a candidate to the "Offered" stage in the ATS board to automatically generate an offer letter payload.</p>
             </div>
          </div>
        )}

        {/* =============================================================== */}
        {/* OFF-CANVAS DRAWER PLACEHOLDERS */}
        {/* =============================================================== */}

        {/* =============================================================== */}
        {/* OFF-CANVAS DRAWER PLACEHOLDERS */}
        {/* =============================================================== */}
        {showCreateJobModal && (
          <div className="fixed inset-0 z-50 overflow-hidden font-sans">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setShowCreateJobModal(false)}></div>
            <div className="fixed inset-y-0 right-0 max-w-lg w-full flex shadow-2xl transform transition-transform duration-300">
              <div className="w-full h-full bg-white dark:bg-slate-900 flex flex-col">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30">
                  <h2 className="text-xl font-black text-slate-800 dark:text-white">{editingJobId ? 'Edit Job Posting' : 'Create New Job Posting'}</h2>
                  <button onClick={() => {
                    setShowCreateJobModal(false);
                    setEditingJobId(null);
                    setNewJob({ title: '', department_id: '', location: '', employment_type: 'Full-Time', experience_range: '', headcount: 1, salary_range: '', currency: 'INR', description: '', interview_rounds: [] });
                  }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Job Form */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Job Title</label>
                    <input type="text" value={newJob.title} onChange={(e) => setNewJob({...newJob, title: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Senior React Developer" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Department</label>
                    <select value={newJob.department_id} onChange={(e) => setNewJob({...newJob, department_id: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Select Department</option>
                      {departments.map(dept => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Location</label>
                    <input type="text" value={newJob.location} onChange={(e) => setNewJob({...newJob, location: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Remote" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Employment Type</label>
                    <select value={newJob.employment_type} onChange={(e) => setNewJob({...newJob, employment_type: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="Full-Time">Full-Time</option>
                      <option value="Contract">Contract</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Currency</label>
                      <select value={newJob.currency || 'INR'} onChange={(e) => setNewJob({...newJob, currency: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="INR">INR (₹)</option>
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="GBP">GBP (£)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Salary Range</label>
                      <input type="text" value={newJob.salary_range} onChange={(e) => setNewJob({...newJob, salary_range: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. 50k-80k" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Headcount (Positions)</label>
                      <input type="number" value={newJob.headcount || ''} onChange={(e) => setNewJob({...newJob, headcount: e.target.value ? parseInt(e.target.value) : 0})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. 1" />
                    </div>
                  </div>

                  {/* OPTIONAL INTERVIEW ROUNDS */}
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Interview Rounds <span className="text-slate-400 font-normal lowercase">(optional)</span></label>
                      <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">{newJob.interview_rounds.length} Rounds Selected</span>
                    </div>

                    {/* QUICK PILLS FROM MASTER ROUNDS */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {(jobRounds.length > 0 
                        ? Array.from(new Set(jobRounds.map((r: any) => r.round_name)))
                        : ['Technical Round 1', 'Technical Round 2', 'Managerial Round', 'HR Interview']
                      ).map((preset: any) => {
                        const isAdded = newJob.interview_rounds.includes(preset);
                        return (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => {
                              if (isAdded) {
                                setNewJob({...newJob, interview_rounds: newJob.interview_rounds.filter(r => r !== preset)});
                              } else {
                                setNewJob({...newJob, interview_rounds: [...newJob.interview_rounds, preset]});
                              }
                            }}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                              isAdded 
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {isAdded ? '✓ ' : '+ '}{preset}
                          </button>
                        );
                      })}
                    </div>

                    {/* CUSTOM ROUND INPUT */}
                    <div className="flex gap-2 mb-3">
                      <input 
                        type="text" 
                        value={customRoundInput} 
                        onChange={e => setCustomRoundInput(e.target.value)} 
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (customRoundInput.trim() && !newJob.interview_rounds.includes(customRoundInput.trim())) {
                              setNewJob({...newJob, interview_rounds: [...newJob.interview_rounds, customRoundInput.trim()]});
                              setCustomRoundInput('');
                            }
                          }
                        }}
                        className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                        placeholder="Add custom round name..." 
                      />
                      <button 
                        type="button"
                        onClick={() => {
                          if (customRoundInput.trim() && !newJob.interview_rounds.includes(customRoundInput.trim())) {
                            setNewJob({...newJob, interview_rounds: [...newJob.interview_rounds, customRoundInput.trim()]});
                            setCustomRoundInput('');
                          }
                        }}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                      >
                        + Add
                      </button>
                    </div>

                    {/* ADDED ROUND TAGS */}
                    {newJob.interview_rounds.length > 0 && (
                      <div className="flex flex-wrap gap-2 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                        {newJob.interview_rounds.map((r, i) => (
                          <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 shadow-sm">
                            <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-black">{i+1}</span>
                            {r}
                            <button type="button" onClick={() => setNewJob({...newJob, interview_rounds: newJob.interview_rounds.filter((_, idx) => idx !== i)})} className="text-slate-400 hover:text-rose-500 font-bold ml-1 cursor-pointer">×</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-900">
                  <button onClick={() => {
                    setShowCreateJobModal(false);
                    setEditingJobId(null);
                    setNewJob({ title: '', department_id: '', location: '', employment_type: 'Full-Time', experience_range: '', headcount: 1, salary_range: '', currency: 'INR', description: '', interview_rounds: [] });
                  }} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-sm">Cancel</button>
                  <button onClick={handleCreateJob} className="px-5 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 active:scale-95 transition-all text-sm">{editingJobId ? 'Save Changes' : 'Publish Job'}</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showSmtpModal && (
          <div className="fixed inset-0 z-50 overflow-hidden font-sans">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setShowSmtpModal(false)}></div>
            <div className="fixed inset-y-0 right-0 max-w-md w-full flex shadow-2xl transform transition-transform duration-300">
              <div className="w-full h-full bg-white dark:bg-slate-900 flex flex-col">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-blue-50/50 dark:bg-blue-900/20">
                  <h2 className="text-xl font-black text-slate-800 dark:text-white">SMTP Settings</h2>
                  <button onClick={() => setShowSmtpModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-full hover:bg-white dark:hover:bg-slate-800 shadow-sm transition-all">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">From Email</label>
                    <input type="email" value={smtpCreds.fromEmail} onChange={e => setSmtpCreds({...smtpCreds, fromEmail: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="hr@company.com" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Password / App Password</label>
                    <input type="password" value={smtpCreds.password} onChange={e => setSmtpCreds({...smtpCreds, password: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="••••••••" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">SMTP Server</label>
                    <input type="text" value={smtpCreds.smtpServer} onChange={e => setSmtpCreds({...smtpCreds, smtpServer: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="smtp.gmail.com" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">SMTP Type</label>
                    <select value={smtpCreds.smtpType} onChange={e => setSmtpCreds({...smtpCreds, smtpType: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="SSL">SSL</option>
                      <option value="TLS">TLS</option>
                      <option value="None">None</option>
                    </select>
                  </div>
                </div>
                <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-900">
                  <button onClick={() => setShowSmtpModal(false)} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-sm">Cancel</button>
                  <button onClick={() => handleSaveIntegration('SMTP', smtpCreds, integrations.find(d => d.provider === 'SMTP')?.is_active || false)} className="px-5 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 active:scale-95 transition-all text-sm">Save Settings</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showWhatsappModal && (
          <div className="fixed inset-0 z-50 overflow-hidden font-sans">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setShowWhatsappModal(false)}></div>
            <div className="fixed inset-y-0 right-0 max-w-md w-full flex shadow-2xl transform transition-transform duration-300">
              <div className="w-full h-full bg-white dark:bg-slate-900 flex flex-col">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-emerald-50/50 dark:bg-emerald-900/20">
                  <h2 className="text-xl font-black text-slate-800 dark:text-white">WhatsApp API Settings</h2>
                  <button onClick={() => setShowWhatsappModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-full hover:bg-white dark:hover:bg-slate-800 shadow-sm transition-all">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">API URL</label>
                    <input type="text" value={whatsappCreds.url} onChange={e => setWhatsappCreds({...whatsappCreds, url: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="https://api.whatsapp.com/v1/messages" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">API Key / Access Token</label>
                    <input type="password" value={whatsappCreds.apiKey} onChange={e => setWhatsappCreds({...whatsappCreds, apiKey: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="••••••••••••••••" />
                  </div>
                </div>
                <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-900">
                  <button onClick={() => setShowWhatsappModal(false)} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-sm">Cancel</button>
                  <button onClick={() => handleSaveIntegration('WHATSAPP', whatsappCreds, integrations.find(d => d.provider === 'WHATSAPP')?.is_active || false)} className="px-5 py-2.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-500/20 active:scale-95 transition-all text-sm">Save Settings</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showCampaignModal && (
          <div className="fixed inset-0 z-50 overflow-hidden font-sans">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setShowCampaignModal(false)}></div>
            <div className="fixed inset-y-0 right-0 max-w-md w-full flex shadow-2xl transform transition-transform duration-300">
              <div className="w-full h-full bg-white dark:bg-slate-900 flex flex-col">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-emerald-50/50 dark:bg-emerald-900/20">
                  <h2 className="text-xl font-black text-slate-800 dark:text-white">{currentCampaign.id ? 'Edit Campaign' : 'New WhatsApp Campaign'}</h2>
                  <button onClick={() => setShowCampaignModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-full hover:bg-white dark:hover:bg-slate-800 shadow-sm transition-all">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Campaign Name</label>
                    <input type="text" value={currentCampaign.campaign_name || ''} onChange={e => setCurrentCampaign({...currentCampaign, campaign_name: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="e.g. Interview Invites" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Campaign Code</label>
                    <input type="text" value={currentCampaign.campaign_code || ''} onChange={e => setCurrentCampaign({...currentCampaign, campaign_code: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="e.g. INTERVIEW_INVITE" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Template Name</label>
                    <input type="text" value={currentCampaign.template_name || ''} onChange={e => setCurrentCampaign({...currentCampaign, template_name: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="e.g. hr_interview_invite_01" />
                  </div>
                  <div>
                    {(() => {
                      let paramsObj: any = {};
                      try {
                        paramsObj = typeof currentCampaign.parameters === 'object' && currentCampaign.parameters !== null ? currentCampaign.parameters : (currentCampaign.parameters ? JSON.parse(currentCampaign.parameters) : {});
                      } catch(e) { paramsObj = {}; }
                      const keys = Object.keys(paramsObj);
                      
                      return (
                        <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 shadow-sm">
                          <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Dynamic Parameters</label>
                            <div className="flex gap-2 items-center">
                              <span className="text-[10px] font-bold text-slate-400 uppercase">Count:</span>
                              <input type="number" min="0" value={keys.length} onChange={(e) => {
                                const count = parseInt(e.target.value) || 0;
                                const newObj = {...paramsObj};
                                const currentKeys = Object.keys(newObj);
                                if (count > currentKeys.length) {
                                  for (let i = currentKeys.length; i < count; i++) {
                                    newObj[`param_${i+1}`] = '';
                                  }
                                } else if (count < currentKeys.length) {
                                  for (let i = currentKeys.length - 1; i >= count; i--) {
                                    delete newObj[currentKeys[i]];
                                  }
                                }
                                setCurrentCampaign({...currentCampaign, parameters: newObj});
                              }} className="w-16 px-2 py-1 text-sm font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-center" />
                            </div>
                          </div>
                          
                          {keys.length === 0 ? (
                            <div className="text-center py-4 text-xs font-semibold text-slate-400">No parameters mapped. Increase count to add.</div>
                          ) : (
                            <div className="space-y-3">
                              {keys.map((k, idx) => (
                                <div key={idx} className="flex gap-3 items-start animate-fadeIn">
                                  <div className="flex-1">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Key {idx+1}</label>
                                    <input type="text" value={k} onChange={(e) => {
                                      const newKey = e.target.value;
                                      const val = paramsObj[k];
                                      const newObj: any = {};
                                      keys.forEach(oldK => {
                                        if (oldK === k) newObj[newKey] = val;
                                        else newObj[oldK] = paramsObj[oldK];
                                      });
                                      setCurrentCampaign({...currentCampaign, parameters: newObj});
                                    }} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="e.g. candidate_name" />
                                  </div>
                                  <div className="flex-1">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Value Mapping</label>
                                    <input type="text" value={paramsObj[k]} onChange={(e) => {
                                      setCurrentCampaign({...currentCampaign, parameters: {...paramsObj, [k]: e.target.value}});
                                    }} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="e.g. {{name}}" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
                <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-900">
                  <button onClick={() => setShowCampaignModal(false)} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-sm">Cancel</button>
                  <button onClick={handleSaveCampaign} className="px-5 py-2.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-500/20 active:scale-95 transition-all text-sm">Save Campaign</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showRuleModal && (
          <div className="fixed inset-0 z-50 overflow-hidden font-sans">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setShowRuleModal(false)}></div>
            <div className="fixed inset-y-0 right-0 max-w-md w-full flex shadow-2xl transform transition-transform duration-300">
              <div className="w-full h-full bg-white dark:bg-slate-900 flex flex-col">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-indigo-50/50 dark:bg-indigo-900/20">
                  <h2 className="text-xl font-black text-slate-800 dark:text-white">{currentRule.id ? 'Edit Notification Rule' : 'New Notification Rule'}</h2>
                  <button onClick={() => setShowRuleModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-full hover:bg-white dark:hover:bg-slate-800 shadow-sm transition-all">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Module</label>
                    <input type="text" value={currentRule.module || ''} onChange={e => setCurrentRule({...currentRule, module: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. RECRUITMENT" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Event Code</label>
                    <input type="text" value={currentRule.event_code || ''} onChange={e => setCurrentRule({...currentRule, event_code: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. INTERVIEW_SCHEDULED" />
                  </div>
                  
                  <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div className="relative">
                        <input type="checkbox" className="sr-only" checked={currentRule.email_enabled || false} onChange={e => setCurrentRule({...currentRule, email_enabled: e.target.checked})} />
                        <div className={`block w-10 h-6 rounded-full transition-colors ${currentRule.email_enabled ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                        <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${currentRule.email_enabled ? 'transform translate-x-4' : ''}`}></div>
                      </div>
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Enable Email Notification</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <div className="relative">
                        <input type="checkbox" className="sr-only" checked={currentRule.whatsapp_enabled || false} onChange={e => setCurrentRule({...currentRule, whatsapp_enabled: e.target.checked})} />
                        <div className={`block w-10 h-6 rounded-full transition-colors ${currentRule.whatsapp_enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                        <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${currentRule.whatsapp_enabled ? 'transform translate-x-4' : ''}`}></div>
                      </div>
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Enable WhatsApp Notification</span>
                    </label>
                  </div>

                  {currentRule.whatsapp_enabled && (
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">WhatsApp Campaign to Trigger</label>
                      <select value={currentRule.whatsapp_campaign_id || ''} onChange={e => setCurrentRule({...currentRule, whatsapp_campaign_id: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="">Select a campaign...</option>
                        {campaigns.map(c => (
                          <option key={c.id} value={c.id}>{c.campaign_name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-900">
                  <button onClick={() => setShowRuleModal(false)} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-sm">Cancel</button>
                  <button onClick={handleSaveRule} className="px-5 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20 active:scale-95 transition-all text-sm">Save Rule</button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ==================== CUSTOM TOAST & CONFIRM ==================== */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[100] animate-fadeIn">
          <div className={`px-4 py-3 rounded-xl shadow-lg border flex items-center gap-3 ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            {toast.type === 'success' ? (
              <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            ) : (
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            )}
            <span className="font-bold text-sm">{toast.message}</span>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center font-sans">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)}></div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 z-10 w-full max-w-sm animate-fadeIn border border-slate-200 dark:border-slate-800">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </div>
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-2">Are you sure?</h3>
            <p className="text-sm font-semibold text-slate-500 mb-6">Do you really want to delete this {deleteConfirm.type}? This action cannot be undone.</p>
            <div className="flex gap-3 w-full">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Cancel</button>
              <button onClick={() => {
                if (deleteConfirm.type === 'job') executeDeleteJob(deleteConfirm.id);
                else if (deleteConfirm.type === 'campaign') executeDeleteCampaign(deleteConfirm.id);
                else if (deleteConfirm.type === 'rule') executeDeleteRule(deleteConfirm.id);
                else if (deleteConfirm.provider) executeDeleteIntegration(deleteConfirm.provider);
                setDeleteConfirm(null);
              }} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 shadow-md shadow-red-500/20 active:scale-95 transition-all">{deleteConfirm.type === 'job' ? 'Close Job' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      {showAddCandidateModal && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowAddCandidateModal(false)}></div>
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 h-full shadow-2xl border-l border-slate-200 dark:border-slate-700 animate-slideInRight flex flex-col">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <h2 className="text-xl font-black text-slate-800 dark:text-white">Add Candidate Manually</h2>
              <button onClick={() => setShowAddCandidateModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Select Job Position *</label>
                <select 
                  value={newCandidate.job_id || selectedAtsJobId} 
                  onChange={(e) => setNewCandidate({...newCandidate, job_id: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a job</option>
                  {jobs.map(job => (
                    <option key={job.id} value={job.id}>{job.title}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">First Name *</label>
                  <input type="text" value={newCandidate.first_name} onChange={(e) => setNewCandidate({...newCandidate, first_name: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. John" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Last Name</label>
                  <input type="text" value={newCandidate.last_name} onChange={(e) => setNewCandidate({...newCandidate, last_name: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Doe" />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email *</label>
                <input type="email" value={newCandidate.email} onChange={(e) => setNewCandidate({...newCandidate, email: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="john@example.com" />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Phone</label>
                <input type="text" value={newCandidate.phone} onChange={(e) => setNewCandidate({...newCandidate, phone: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="+1 234 567 890" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Resume / CV (Optional)</label>
                <input type="file" accept=".pdf,.doc,.docx" onChange={e => setNewCandidateResume(e.target.files?.[0] || null)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-black file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
              <button onClick={() => setShowAddCandidateModal(false)} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-sm">Cancel</button>
              <button onClick={handleAddCandidate} className="px-5 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 active:scale-95 transition-all text-sm">Add Candidate</button>
            </div>
          </div>
        </div>
      )}

        {/* Manage Master Rounds Modal */}
        {showManageRoundsModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => { setShowManageRoundsModal(false); setEditingRoundId(null); setNewRoundData({ round_name: '', round_type: 'General' }); }}></div>
            <div className="relative bg-white dark:bg-slate-900 w-[500px] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-zoomIn">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30">
                <h2 className="font-black text-lg text-slate-800 dark:text-white">{editingRoundId ? 'Edit Master Round' : 'Create Master Round'}</h2>
                <button onClick={() => { setShowManageRoundsModal(false); setEditingRoundId(null); setNewRoundData({ round_name: '', round_type: 'General' }); }} className="text-slate-400 hover:text-slate-600"><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Round Name</label>
                  <input type="text" placeholder="e.g. Technical Interview 1" value={newRoundData.round_name} onChange={e => setNewRoundData({...newRoundData, round_name: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:border-indigo-500 outline-none transition-all" />
                </div>
              </div>
              <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80 flex justify-end gap-3">
                <button onClick={() => { setShowManageRoundsModal(false); setEditingRoundId(null); setNewRoundData({ round_name: '', round_type: 'General' }); }} className="px-5 py-2.5 font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-sm transition-colors">Cancel</button>
                <button onClick={handleCreateRound} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-sm shadow-md transition-colors">{editingRoundId ? 'Save Changes' : 'Create Round'}</button>
              </div>
            </div>
          </div>
        )}

    </div>
  );
}
