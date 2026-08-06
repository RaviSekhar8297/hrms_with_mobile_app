'use client';

import React, { useEffect, useState } from 'react';
import DashboardPageHeader from '../components/DashboardPageHeader';
import { getHeaders, getUrl } from '../utils/api';
import { useDashboard } from '../components/DashboardContext';

interface Company {
  id: string;
  name: string;
  subdomain: string;
  status: string;
  created_at: string;
}

interface BankInfo {
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  branch_name: string;
}

interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  is_nominee?: boolean;
}

interface EducationEntry {
  degree: string;
  institution: string;
  passing_year: string;
  percentage_gpa: string;
}

interface ExperienceEntry {
  company_name: string;
  designation: string;
  duration_from: string;
  duration_to: string;
  description: string;
}

interface Employee {
  id: string;
  emp_id_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  status: string;
  joining_date: string;
  branch_id?: string;
  branch_name?: string;
  department_id?: string;
  department_name?: string;
  designation_id?: string;
  designation_name?: string;
  role_id?: string;
  role_name?: string;
  dob?: string;
  gender?: string;
  marital_status?: string;
  blood_group?: string;
  personal_email?: string;
  pan_number?: string;
  aadhar_number?: string;
  esi_number?: string;
  uan_number?: string;
  current_address?: string;
  permanent_address?: string;
  employment_type?: string;
  bank_information?: string | BankInfo[];
  emergency_contacts?: string | EmergencyContact[];
  education?: string | EducationEntry[];
  experience?: string | ExperienceEntry[];
  emp_image?: string;
}

export default function ProfilePage() {
  const { showToast: defaultShowToast } = useDashboard();
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  // Custom Toast State within Page
  const [customToast, setCustomToast] = useState<{ message: string; type: 'success' | 'info' | 'error'; visible: boolean } | null>(null);

  // Core Employee profile
  const [myProfile, setMyProfile] = useState<Employee | null>(null);

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 12) return 'Good Morning';
    if (hour >= 12 && hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };
  
  // Fields state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [personalEmail, setPersonalEmail] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [aadharNumber, setAadharNumber] = useState('');
  const [esiNumber, setEsiNumber] = useState('');
  const [uanNumber, setUanNumber] = useState('');
  const [currentAddress, setCurrentAddress] = useState('');
  const [permanentAddress, setPermanentAddress] = useState('');
  const [employmentType, setEmploymentType] = useState('');
  const [empImage, setEmpImage] = useState('');

  // JSONB List states
  const [bankInfoList, setBankInfoList] = useState<BankInfo[]>([]);
  const [familyContacts, setFamilyContacts] = useState<EmergencyContact[]>([]);
  const [educationList, setEducationList] = useState<EducationEntry[]>([]);
  const [experienceList, setExperienceList] = useState<ExperienceEntry[]>([]);

  // Compliance Mask Reveal States
  const [revealPAN, setRevealPAN] = useState(false);
  const [revealAadhar, setRevealAadhar] = useState(false);
  const [revealESI, setRevealESI] = useState(false);
  const [revealUAN, setRevealUAN] = useState(false);

  // Password Update Form State
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const hasCapital = /[A-Z]/.test(newPasswordInput);
  const hasSmall = /[a-z]/.test(newPasswordInput);
  const hasNumber = /[0-9]/.test(newPasswordInput);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(newPasswordInput);
  const isLengthValid = newPasswordInput.length >= 6 && newPasswordInput.length <= 14;
  const isPasswordValid = hasCapital && hasSmall && hasNumber && hasSpecial && isLengthValid;
  const isSaveEnabled = isPasswordValid && newPasswordInput === confirmPasswordInput;

  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('superadmin');

  // Helper trigger for custom animated toast notifications
  const triggerCustomToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setCustomToast({ message, type, visible: true });
    defaultShowToast(message, type);
    setTimeout(() => {
      setCustomToast(prev => prev ? { ...prev, visible: false } : null);
    }, 4000);
  };

  const emptyProfile = (userEmail: string): Employee => ({
    id: '',
    emp_id_code: '',
    first_name: '',
    last_name: '',
    email: userEmail,
    phone: '',
    status: 'PENDING ENTRY',
    joining_date: '',
    designation_name: '',
    role_name: '',
    marital_status: '',
    personal_email: '',
    pan_number: '',
    aadhar_number: '',
    esi_number: '',
    uan_number: '',
    current_address: '',
    permanent_address: '',
    employment_type: '',
    bank_information: [],
    emergency_contacts: [],
    education: [],
    experience: [],
    emp_image: ''
  });

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
      const res = await fetch('http://localhost:5000/api/v1/companies', { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) setCompanies(data.companies || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchProfileData = async (currentEmail: string, currentCompanyId: string | null) => {
    setLoading(true);
    try {
      const res = await fetch(getUrl('/api/v1/employees', currentCompanyId), { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) {
        const list: Employee[] = data.employees || [];
        const found = list.find((emp) => emp.email.toLowerCase() === currentEmail.toLowerCase());
        if (found) {
          setMyProfile(found);
          initializeFormFields(found);
        } else {
          const blank = emptyProfile(currentEmail);
          setMyProfile(blank);
          initializeFormFields(blank);
        }
      } else {
        const blank = emptyProfile(currentEmail);
        setMyProfile(blank);
        initializeFormFields(blank);
      }
    } catch (e) {
      console.error('Offline state or connection issue.');
      const blank = emptyProfile(currentEmail);
      setMyProfile(blank);
      initializeFormFields(blank);
    } finally {
      setLoading(false);
    }
  };

  const parseJSONB = (val: any) => {
    if (!val) return [];
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch {
        return [];
      }
    }
    return val;
  };

  const initializeFormFields = (emp: Employee) => {
    setFirstName(emp.first_name || '');
    setLastName(emp.last_name || '');
    setPhone(emp.phone || '');
    setPersonalEmail(emp.personal_email || '');
    setDob(emp.dob ? emp.dob.split('T')[0] : '');
    setGender(emp.gender || '');
    setMaritalStatus(emp.marital_status || '');
    setBloodGroup(emp.blood_group || '');
    setPanNumber(emp.pan_number || '');
    setAadharNumber(emp.aadhar_number || '');
    setEsiNumber(emp.esi_number || '');
    setUanNumber(emp.uan_number || '');
    setCurrentAddress(emp.current_address || '');
    setPermanentAddress(emp.permanent_address || '');
    setEmploymentType(emp.employment_type || '');
    setEmpImage(emp.emp_image || '');

    setBankInfoList(parseJSONB(emp.bank_information));
    setFamilyContacts(parseJSONB(emp.emergency_contacts));
    setEducationList(parseJSONB(emp.education));
    setExperienceList(parseJSONB(emp.experience));
  };

  useEffect(() => {
    if (email) {
      if (isSuperAdmin) {
        fetchCompanies();
      }
      fetchProfileData(email, companyId);
    } else {
      setLoading(false);
    }
  }, [email, companyId, isSuperAdmin]);

  const handleCompanyChange = (id: string) => {
    const val = id || null;
    setCompanyId(val);
    if (val) {
      localStorage.setItem('companyId', val);
    } else {
      localStorage.removeItem('companyId');
    }
    triggerCustomToast('🏢 Active Company Scope updated', 'info');
  };

  const handleCancel = () => {
    if (myProfile) {
      initializeFormFields(myProfile);
    }
    setIsEditing(false);
  };

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myProfile) return;

    setSaving(true);
    try {
      const payload = {
        companyId: myProfile.branch_id ? undefined : companyId,
        emp_id_code: myProfile.emp_id_code || 'EMP-' + Math.floor(Math.random() * 9000 + 1000),
        first_name: firstName,
        last_name: lastName,
        email: myProfile.email,
        phone,
        branch_id: myProfile.branch_id,
        department_id: myProfile.department_id,
        designation_id: myProfile.designation_id,
        role_id: myProfile.role_id,
        joining_date: myProfile.joining_date || new Date().toISOString().split('T')[0],
        status: myProfile.status || 'ACTIVE',
        dob: dob || undefined,
        gender: gender || undefined,
        marital_status: maritalStatus || undefined,
        blood_group: bloodGroup || undefined,
        personal_email: personalEmail || undefined,
        pan_number: panNumber || undefined,
        aadhar_number: aadharNumber || undefined,
        esi_number: esiNumber || undefined,
        uan_number: uanNumber || undefined,
        current_address: currentAddress || undefined,
        permanent_address: permanentAddress || undefined,
        employment_type: employmentType || undefined,
        bank_information: bankInfoList,
        emergency_contacts: familyContacts,
        education: educationList,
        experience: experienceList,
        emp_image: empImage
      };

      if (!myProfile.id) {
        const mockId = 'emp-' + Math.random().toString(36).substr(2, 9);
        const updated = { ...payload, id: mockId };
        setMyProfile(updated);
        triggerCustomToast('💾 Profile saved successfully (Offline Sync Active)', 'success');
        setIsEditing(false);
      } else {
        const res = await fetch(`http://localhost:5000/api/v1/employees/${myProfile.id}`, {
          method: 'PUT',
          headers: {
            ...getHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          triggerCustomToast('✨ Profile changes saved successfully to DB!', 'success');
          fetchProfileData(email, companyId);
          setIsEditing(false);
        } else {
          const updated = { ...payload, id: myProfile.id };
          setMyProfile(updated);
          triggerCustomToast('💾 Saved changes locally.', 'info');
          setIsEditing(false);
        }
      }
    } catch (err) {
      const updated = {
        ...myProfile,
        first_name: firstName,
        last_name: lastName,
        phone,
        personal_email: personalEmail || undefined,
        dob: dob || undefined,
        gender: gender || undefined,
        marital_status: maritalStatus || undefined,
        blood_group: bloodGroup || undefined,
        pan_number: panNumber || undefined,
        aadhar_number: aadharNumber || undefined,
        esi_number: esiNumber || undefined,
        uan_number: uanNumber || undefined,
        current_address: currentAddress || undefined,
        permanent_address: permanentAddress || undefined,
        employment_type: employmentType || undefined,
        bank_information: bankInfoList,
        emergency_contacts: familyContacts,
        education: educationList,
        experience: experienceList,
        emp_image: empImage
      };
      setMyProfile(updated);
      triggerCustomToast('💾 Saved changes locally.', 'info');
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPasswordInput || !confirmPasswordInput) {
      triggerCustomToast('⚠️ Please enter both password fields', 'error');
      return;
    }

    if (newPasswordInput.length < 6) {
      triggerCustomToast('⚠️ Password must be at least 6 characters', 'error');
      return;
    }

    if (newPasswordInput !== confirmPasswordInput) {
      triggerCustomToast('⚠️ Passwords do not match', 'error');
      return;
    }

    setUpdatingPassword(true);
    try {
      const res = await fetch('http://localhost:5000/api/v1/auth/change-password', {
        method: 'POST',
        headers: {
          ...getHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newPassword: newPasswordInput }),
      });

      const data = await res.json();
      if (res.ok) {
        triggerCustomToast('✨ Password updated successfully!', 'success');
        setNewPasswordInput('');
        setConfirmPasswordInput('');
      } else {
        triggerCustomToast(data.error || 'Failed to update password', 'error');
      }
    } catch (err) {
      triggerCustomToast('❌ Failed to update password. Server offline.', 'error');
    } finally {
      setUpdatingPassword(false);
    }
  };

  const getFieldIcon = (label: string) => {
    const l = label.toLowerCase();
    if (l.includes('first name') || l.includes('last name')) return '👤';
    if (l.includes('phone')) return '📞';
    if (l.includes('email')) return '📧';
    if (l.includes('birth') || l.includes('dob')) return '🎂';
    if (l.includes('gender')) return '⚥';
    if (l.includes('marital')) return '💍';
    if (l.includes('blood')) return '🩸';
    if (l.includes('address')) return '📍';
    if (l.includes('pan')) return '💳';
    if (l.includes('aadhar')) return '🆔';
    if (l.includes('esi')) return '🛡️';
    if (l.includes('uan')) return '🌐';
    if (l.includes('branch')) return '🏢';
    if (l.includes('department')) return '🗂️';
    if (l.includes('designation') || l.includes('role')) return '💼';
    if (l.includes('joining')) return '📅';
    return '📝';
  };

  const renderValueBadge = (val: string | undefined | null) => {
    if (!val || val.trim() === '') {
      return (
        <span className="profile-pending-badge">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping inline-block shrink-0" />
          Pending Entry
        </span>
      );
    }
    return <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 leading-tight">{val}</span>;
  };

  const maskValue = (val: string | undefined | null, reveal: boolean) => {
    if (!val || val.trim() === '') return renderValueBadge(val);
    if (reveal) return <span className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100">{val}</span>;
    const cleaned = val.replace(/\s/g, '');
    if (cleaned.length <= 4) return <span className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100">••••</span>;
    const maskedPart = '•'.repeat(cleaned.length - 4);
    const visiblePart = cleaned.slice(-4);
    const formattedMask = (maskedPart + visiblePart).replace(/(.{4})/g, '$1 ').trim();
    return <span className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100">{formattedMask}</span>;
  };

  const renderFieldBlock = (label: string, value: string | undefined | null) => {
    const icon = getFieldIcon(label);
    const isEmpty = !value || value.trim() === '';
    return (
      <div className={`profile-field-block ${isEmpty ? 'profile-field-empty' : ''}`}>
        <div className="profile-field-accent" />
        <div className="flex-1 flex flex-col justify-center min-w-0">
          <span className="profile-field-label">{label}</span>
          <div className="profile-field-value mt-0.5">{renderValueBadge(value)}</div>
        </div>
        <span className="profile-field-icon">{icon}</span>
      </div>
    );
  };

  const renderSecureFieldBlock = (label: string, value: string | undefined | null, reveal: boolean, setReveal: (v: boolean) => void) => {
    const icon = getFieldIcon(label);
    const hasVal = value && value.trim() !== '';
    const isEmpty = !hasVal;
    return (
      <div className={`profile-field-block ${isEmpty ? 'profile-field-empty' : 'profile-field-secure'}`}>
        <div className="profile-field-accent" />
        <div className="flex-1 flex flex-col justify-center min-w-0">
          <span className="profile-field-label">{label}</span>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            {maskValue(value, reveal)}
            {hasVal && (
              <button
                type="button"
                onClick={() => setReveal(!reveal)}
                className="profile-reveal-btn"
              >
                {reveal ? '🙈 Hide' : '👁 Show'}
              </button>
            )}
          </div>
        </div>
        <span className="profile-field-icon">{icon}</span>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fadeIn w-full relative font-sans text-slate-900 dark:text-slate-100">
      
      {/* FLOATING TOAST NOTIFICATION */}
      {customToast && customToast.visible && (
        <div className="fixed bottom-6 right-6 z-[999] max-w-xs w-full animate-toast-slide">
          <div className={`flex items-center justify-between gap-3.5 px-4.5 py-3.5 rounded-2xl border shadow-2xl backdrop-blur-xl ${
            customToast.type === 'error'
              ? 'bg-rose-950/90 border-rose-500/30 text-rose-200'
              : customToast.type === 'info'
              ? 'bg-blue-950/90 border-blue-500/30 text-blue-200'
              : 'bg-emerald-950/90 border-emerald-500/30 text-emerald-200'
          }`}>
            <div className="flex items-center gap-3">
              <span className="text-sm">
                {customToast.type === 'error' ? '❌' : customToast.type === 'info' ? 'ℹ️' : '✨'}
              </span>
              <div>
                <p className="text-xs font-bold tracking-wide">Notice</p>
                <p className="text-[11px] font-medium opacity-90">{customToast.message}</p>
              </div>
            </div>
            <button onClick={() => setCustomToast(null)} className="text-xs opacity-60 hover:opacity-100 font-bold cursor-pointer">✕</button>
          </div>
        </div>
      )}

      <DashboardPageHeader
        title="My Profile Dashboard"
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

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent" />
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Syncing Profile Details...</p>
        </div>
      ) : (
        <div className="w-full space-y-6">
          
          {/* 🌄 INSPIRATIONAL HERO BANNER */}
          <div className="relative w-full rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl hover:shadow-blue-500/20 border border-white/10 transition-all duration-500 min-h-[160px] sm:min-h-[185px] flex flex-col justify-between p-5 sm:p-7 bg-gradient-to-r from-blue-700 via-sky-600 to-indigo-900 text-white group">
            {/* Mountain / Landscape Background Image */}
            <div 
              className="absolute inset-0 bg-cover bg-center opacity-40 mix-blend-overlay transition-all duration-700 group-hover:scale-105 group-hover:opacity-55"
              style={{
                backgroundImage: `url('https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=80')`
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-900/35 to-slate-900/10 transition-opacity duration-500 group-hover:from-slate-950/75" />

            {/* Top Badge Accent */}
            <div className="relative z-10 flex items-center justify-between w-full">
              <span className="px-3.5 py-0.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-[9.5px] font-extrabold tracking-widest uppercase text-white flex items-center gap-1.5 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Workplace Inspiration
              </span>
            </div>

            {/* Bottom Content */}
            <div className="relative z-10 space-y-1.5 max-w-3xl transform transition-transform duration-500 group-hover:-translate-y-1">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-white drop-shadow-md">
                {getGreeting()}{firstName ? `, ${firstName}` : ''}
              </h1>
              <p className="text-xs sm:text-sm font-medium text-slate-100/95 leading-relaxed italic drop-shadow-xs">
                "An employee's experience is the sum of all interactions they have with the organization."
              </p>
              <p className="text-[10px] font-extrabold tracking-widest uppercase text-sky-200/90 flex items-center gap-2">
                <span className="w-4 h-0.5 bg-sky-400 rounded-full inline-block" />
                MATT MULLENWEG
              </p>
            </div>
          </div>

          {/* PROFILE HEADER CARD */}
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-xs flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 w-full relative overflow-hidden">
            
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 relative z-10 w-full lg:w-auto">
              
              {/* Initials / Profile Picture Avatar */}
              <div className="relative group shrink-0">
                <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-3xl bg-gradient-to-br from-indigo-500 via-purple-600 to-indigo-700 text-white font-extrabold text-2xl sm:text-3xl flex items-center justify-center shadow-lg select-none relative font-outfit overflow-hidden border-2 border-white dark:border-slate-800">
                  {(empImage || myProfile?.emp_image) ? (
                    <img 
                      src={empImage || myProfile?.emp_image} 
                      alt={firstName ? `${firstName} ${lastName}` : 'Profile'} 
                      className="h-full w-full object-cover" 
                      onError={(e) => {
                        // Fallback to initials if image fails to load
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : null}
                  {!(empImage || myProfile?.emp_image) && (
                    <span>
                      {firstName ? `${firstName.charAt(0).toUpperCase()}${lastName ? lastName.charAt(0).toUpperCase() : ''}` : email.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-emerald-500 border-4 border-white dark:border-slate-900 z-10" title="Active" />
                </div>
                {isEditing && (
                  <label className="absolute inset-0 bg-slate-950/70 rounded-3xl flex flex-col items-center justify-center text-white text-[10.5px] font-extrabold cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-md">
                    <span className="text-base">📷</span>
                    <span>Change</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setEmpImage(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }} 
                    />
                  </label>
                )}
              </div>

              {/* Profile Main Headings */}
              <div className="flex-1 text-center sm:text-left space-y-1.5">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                  <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight font-outfit">
                    {firstName ? `${firstName} ${lastName}` : email.split('@')[0]}
                  </h2>
                  <span className={`px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                    myProfile?.status === 'ACTIVE' || isSuperAdmin
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/40'
                      : 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/40'
                  }`}>
                    {myProfile?.status || 'ACTIVE'}
                  </span>
                </div>

                <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 tracking-wide uppercase">
                  {myProfile?.designation_name || 'Organization Member'}
                </p>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs font-medium text-slate-500 dark:text-slate-400 pt-1">
                  <span>
                    Emp ID: <strong className="font-mono text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">{myProfile?.emp_id_code || 'PENDING'}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Role: <strong className="text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">{isSuperAdmin ? 'SuperAdmin' : (myProfile?.role_name || 'Employee')}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Joined: <strong className="text-slate-800 dark:text-slate-200">{myProfile?.joining_date ? new Date(myProfile.joining_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Pending'}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Top Edit Profile Button */}
            <div className="relative z-10 w-full lg:w-auto flex justify-center lg:justify-end">
              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl uppercase tracking-wider transition-all cursor-pointer shadow-md shadow-indigo-600/20 flex items-center gap-2"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Edit Profile
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold rounded-xl uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveChanges}
                    disabled={saving}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl uppercase tracking-wider transition-all cursor-pointer shadow-md shadow-emerald-600/20 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              )}
            </div>

          </div>

          {/* MAIN GRID CARDS */}
          <form onSubmit={handleSaveChanges} className="w-full space-y-6">
            
            <div className="grid gap-6 lg:grid-cols-3 items-start">
              
              {/* LEFT COLUMN (1 col) */}
              <div className="lg:col-span-1 space-y-6">
                
                {/* Personal Information */}
                <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xs relative overflow-hidden transition-all w-full text-left">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-5">
                    <div className="flex items-center gap-2">
                      <span className="text-base">👤</span>
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-white font-outfit">Personal Information</h3>
                    </div>
                  </div>
                  
                  {isEditing ? (
                    <div className="space-y-4">
                      <div>
                        <label className="profile-custom-form-label">Profile Photo (URL or Upload)</label>
                        <div className="flex gap-2 items-center">
                          <input 
                            type="text" 
                            placeholder="Image URL or upload file" 
                            value={empImage} 
                            onChange={(e) => setEmpImage(e.target.value)} 
                            className="premium-input flex-1" 
                          />
                          <label className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer shrink-0 shadow-xs transition-all flex items-center gap-1">
                            <span>📷</span>
                            <span>Upload</span>
                            <input 
                              type="file" 
                              accept="image/*" 
                              className="hidden" 
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    setEmpImage(reader.result as string);
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }} 
                            />
                          </label>
                        </div>
                      </div>
                      <div>
                        <label className="profile-custom-form-label">First Name</label>
                        <input type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="premium-input" />
                      </div>
                      <div>
                        <label className="profile-custom-form-label">Last Name</label>
                        <input type="text" required value={lastName} onChange={(e) => setLastName(e.target.value)} className="premium-input" />
                      </div>
                      <div>
                        <label className="profile-custom-form-label">Phone Number</label>
                        <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="premium-input" />
                      </div>
                      <div>
                        <label className="profile-custom-form-label">Personal Email</label>
                        <input type="email" value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value)} className="premium-input" />
                      </div>
                      <div>
                        <label className="profile-custom-form-label">Date of Birth</label>
                        <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="premium-input" />
                      </div>
                      <div>
                        <label className="profile-custom-form-label">Gender</label>
                        <select value={gender} onChange={(e) => setGender(e.target.value)} className="premium-input">
                          <option value="">Select Gender</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="profile-custom-form-label">Marital Status</label>
                        <select value={maritalStatus} onChange={(e) => setMaritalStatus(e.target.value)} className="premium-input">
                          <option value="">Select Status</option>
                          <option value="Single">Single</option>
                          <option value="Married">Married</option>
                          <option value="Divorced">Divorced</option>
                          <option value="Widowed">Widowed</option>
                        </select>
                      </div>
                      <div>
                        <label className="profile-custom-form-label">Blood Group</label>
                        <input type="text" value={bloodGroup} placeholder="e.g. O+" onChange={(e) => setBloodGroup(e.target.value)} className="premium-input" />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {renderFieldBlock("First Name", firstName)}
                      {renderFieldBlock("Last Name", lastName)}
                      <div className="profile-field-block">
                        <div className="profile-field-accent" />
                        <div className="flex-1 flex flex-col justify-center min-w-0">
                          <span className="profile-field-label">Official Work Email</span>
                          <div className="profile-field-value mt-0.5">
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 leading-tight truncate">{email}</span>
                          </div>
                        </div>
                        <span className="profile-field-icon">📧</span>
                      </div>
                      {renderFieldBlock("Phone Number", phone)}
                      {renderFieldBlock("Personal Email", personalEmail)}
                      {renderFieldBlock("Date of Birth", dob)}
                      {renderFieldBlock("Gender", gender)}
                      {renderFieldBlock("Marital Status", maritalStatus)}
                      {renderFieldBlock("Blood Group", bloodGroup)}
                    </div>
                  )}
                </div>

                {/* Organization Details */}
                <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xs relative overflow-hidden transition-all w-full text-left">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-5">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🏢</span>
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-white font-outfit">Organization Info</h3>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {renderFieldBlock("Assigned Office Branch", myProfile?.branch_name)}
                    {renderFieldBlock("Primary Department", myProfile?.department_name)}
                    {renderFieldBlock("Job Designation", myProfile?.designation_name)}
                    {renderFieldBlock("Employment Type", employmentType)}
                    {renderFieldBlock("Date of Joining", myProfile?.joining_date ? new Date(myProfile.joining_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Pending')}
                  </div>
                </div>

              </div>

              {/* RIGHT COLUMN (2 cols) */}
              <div className="lg:col-span-2 space-y-6 text-left">
                
                {/* Compliance & Identifiers */}
                <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xs relative overflow-hidden transition-all w-full">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-5">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🛡️</span>
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-white font-outfit">Compliance & Identifiers</h3>
                    </div>
                  </div>
                  {isEditing ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="profile-custom-form-label">PAN Card Number</label>
                        <input type="text" value={panNumber} onChange={(e) => setPanNumber(e.target.value)} className="premium-input" />
                      </div>
                      <div>
                        <label className="profile-custom-form-label">Aadhar Card Number</label>
                        <input type="text" value={aadharNumber} onChange={(e) => setAadharNumber(e.target.value)} className="premium-input" />
                      </div>
                      <div>
                        <label className="profile-custom-form-label">ESI Account Number</label>
                        <input type="text" value={esiNumber} onChange={(e) => setEsiNumber(e.target.value)} className="premium-input" />
                      </div>
                      <div>
                        <label className="profile-custom-form-label">UAN (Universal Account Number)</label>
                        <input type="text" value={uanNumber} onChange={(e) => setUanNumber(e.target.value)} className="premium-input" />
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {renderSecureFieldBlock("PAN Card Number", panNumber, revealPAN, setRevealPAN)}
                      {renderSecureFieldBlock("Aadhar Card Number", aadharNumber, revealAadhar, setRevealAadhar)}
                      {renderSecureFieldBlock("ESI Account Number", esiNumber, revealESI, setRevealESI)}
                      {renderSecureFieldBlock("UAN (Universal Account Number)", uanNumber, revealUAN, setRevealUAN)}
                    </div>
                  )}
                </div>

                {/* Bank Details */}
                <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xs relative overflow-hidden transition-all w-full">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-5">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🏦</span>
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-white font-outfit">Bank Accounts</h3>
                    </div>
                  </div>
                  {isEditing ? (
                    <div className="space-y-4">
                      {bankInfoList.map((bank, index) => (
                        <div key={index} className="grid gap-4 sm:grid-cols-2 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 relative">
                          <button
                            type="button"
                            onClick={() => setBankInfoList(bankInfoList.filter((_, i) => i !== index))}
                            className="absolute top-3 right-3 text-rose-600 hover:text-rose-700 text-xs font-bold cursor-pointer"
                          >
                            Remove
                          </button>
                          <div>
                            <label className="profile-custom-form-label">Bank Name</label>
                            <input type="text" required value={bank.bank_name} onChange={(e) => { const list = [...bankInfoList]; list[index].bank_name = e.target.value; setBankInfoList(list); }} className="premium-input" />
                          </div>
                          <div>
                            <label className="profile-custom-form-label">Account Number</label>
                            <input type="text" required value={bank.account_number} onChange={(e) => { const list = [...bankInfoList]; list[index].account_number = e.target.value; setBankInfoList(list); }} className="premium-input" />
                          </div>
                          <div>
                            <label className="profile-custom-form-label">IFSC Code</label>
                            <input type="text" required value={bank.ifsc_code} onChange={(e) => { const list = [...bankInfoList]; list[index].ifsc_code = e.target.value; setBankInfoList(list); }} className="premium-input" />
                          </div>
                          <div>
                            <label className="profile-custom-form-label">Branch Name</label>
                            <input type="text" required value={bank.branch_name} onChange={(e) => { const list = [...bankInfoList]; list[index].branch_name = e.target.value; setBankInfoList(list); }} className="premium-input" />
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setBankInfoList([...bankInfoList, { bank_name: '', account_number: '', ifsc_code: '', branch_name: '' }])}
                        className="py-3 px-4 border border-dashed border-indigo-300 dark:border-indigo-700 text-xs font-bold rounded-xl w-full text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors cursor-pointer"
                      >
                        + Add Bank Account
                      </button>
                    </div>
                  ) : (
                    <>
                      {bankInfoList.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-6 border border-dashed border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 rounded-2xl text-center">
                          <span className="text-lg mb-1">⚠️</span>
                          <p className="text-xs font-bold text-amber-700 dark:text-amber-400">Pending Bank Account Records</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Click Edit Profile to add bank details for payroll processing.</p>
                        </div>
                      ) : (
                        <div className="grid gap-4 sm:grid-cols-2">
                          {bankInfoList.map((bank, index) => (
                            <div key={index} className="w-full bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 border border-white/10 shadow-md relative overflow-hidden flex flex-col justify-between">
                              <div className="flex justify-between items-center relative z-10">
                                <span className="text-xs font-black tracking-widest uppercase text-indigo-200">
                                  {bank.bank_name || 'BANK ACCOUNT'}
                                </span>
                              </div>

                              <div className="my-3 relative z-10">
                                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">Account Number</p>
                                <p className="text-sm font-mono font-extrabold tracking-wider text-white select-all">
                                  {bank.account_number ? bank.account_number.replace(/(.{4})/g, '$1 ').trim() : '•••• •••• ••••'}
                                </p>
                              </div>

                              <div className="flex justify-between items-end relative z-10 pt-2 border-t border-white/10 text-xs">
                                <div>
                                  <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Holder</p>
                                  <p className="font-bold text-white uppercase">{firstName ? `${firstName} ${lastName}` : 'EMPLOYEE'}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">IFSC Code</p>
                                  <p className="font-mono font-bold text-indigo-200 select-all">{bank.ifsc_code}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Residential Address */}
                <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xs relative overflow-hidden transition-all w-full">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-5">
                    <div className="flex items-center gap-2">
                      <span className="text-base">📍</span>
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-white font-outfit">Residential Address</h3>
                    </div>
                  </div>
                  {isEditing ? (
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div>
                        <label className="profile-custom-form-label">Current Residential Address</label>
                        <textarea rows={3} value={currentAddress} onChange={(e) => setCurrentAddress(e.target.value)} className="premium-input resize-none" />
                      </div>
                      <div>
                        <label className="profile-custom-form-label">Permanent Address</label>
                        <textarea rows={3} value={permanentAddress} onChange={(e) => setPermanentAddress(e.target.value)} className="premium-input resize-none" />
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {renderFieldBlock("Current Residential Address", currentAddress)}
                      {renderFieldBlock("Permanent Address", permanentAddress)}
                    </div>
                  )}
                </div>

                {/* Credentials & Password Change */}
                <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xs relative overflow-hidden transition-all w-full">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-5">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🔒</span>
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-white font-outfit">Update Credentials</h3>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="profile-custom-form-label">New Password</label>
                        <div className="relative flex items-center">
                          <input
                            type={showNewPassword ? "text" : "password"}
                            placeholder="••••••••"
                            value={newPasswordInput}
                            onChange={(e) => setNewPasswordInput(e.target.value)}
                            className="premium-input pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                          >
                            {showNewPassword ? '🙈' : '👁'}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="profile-custom-form-label">Confirm Password</label>
                        <div className="relative flex items-center">
                          <input
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="••••••••"
                            value={confirmPasswordInput}
                            onChange={(e) => setConfirmPasswordInput(e.target.value)}
                            className="premium-input pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                          >
                            {showConfirmPassword ? '🙈' : '👁'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {(newPasswordInput || confirmPasswordInput) && (
                      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
                        <p className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">Password Validation Requirements</p>
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div className={`flex items-center gap-1.5 font-semibold ${isLengthValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                            <span>{isLengthValid ? '✓' : '○'}</span> Length: 6 to 14 characters
                          </div>
                          <div className={`flex items-center gap-1.5 font-semibold ${hasCapital ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                            <span>{hasCapital ? '✓' : '○'}</span> 1 Capital letter (A-Z)
                          </div>
                          <div className={`flex items-center gap-1.5 font-semibold ${hasSmall ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                            <span>{hasSmall ? '✓' : '○'}</span> 1 Small letter (a-z)
                          </div>
                          <div className={`flex items-center gap-1.5 font-semibold ${hasNumber ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                            <span>{hasNumber ? '✓' : '○'}</span> 1 Number (0-9)
                          </div>
                          <div className={`flex items-center gap-1.5 font-semibold ${hasSpecial ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                            <span>{hasSpecial ? '✓' : '○'}</span> 1 Special char (!@#$)
                          </div>
                          <div className={`flex items-center gap-1.5 font-semibold ${newPasswordInput && confirmPasswordInput && newPasswordInput === confirmPasswordInput ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                            <span>{newPasswordInput && confirmPasswordInput && newPasswordInput === confirmPasswordInput ? '✓' : '○'}</span> Passwords match
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end pt-2">
                      <button
                        type="button"
                        onClick={handleUpdatePassword}
                        disabled={!isSaveEnabled || updatingPassword}
                        className={`px-5 py-2.5 text-xs font-bold rounded-xl uppercase tracking-wider transition-all shadow-xs cursor-pointer ${
                          isSaveEnabled
                            ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                        }`}
                      >
                        {updatingPassword ? 'Updating Password...' : 'Save Password'}
                      </button>
                    </div>
                  </div>
                </div>

              </div>

            </div>

          </form>

        </div>
      )}

      {/* Styled Overrides */}
      <style>{`
        .profile-custom-form-label {
          font-size: 11px !important;
          font-weight: 700 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
          color: #64748b !important;
          margin-bottom: 4px !important;
          display: block !important;
        }

        .dark .profile-custom-form-label {
          color: #94a3b8 !important;
        }

        .premium-input {
          width: 100%;
          font-size: 13px !important;
          line-height: 1.5;
          font-weight: 500;
          padding: 10px 14px !important;
          border-radius: 12px !important;
          border: 1px solid #cbd5e1 !important;
          background: #f8fafc !important;
          color: #0f172a !important;
          outline: none !important;
          transition: all 0.2s ease !important;
        }

        .dark .premium-input {
          border-color: #334155 !important;
          background: #0f172a !important;
          color: #f8fafc !important;
        }

        .premium-input:focus {
          background: #ffffff !important;
          border-color: #4f46e5 !important;
          box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15) !important;
        }

        .dark .premium-input:focus {
          background: #020617 !important;
          border-color: #6366f1 !important;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2) !important;
        }

        .profile-field-block {
          position: relative;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          border-radius: 14px;
          border: 1px solid rgba(226, 232, 240, 0.8);
          background: rgba(248, 250, 252, 0.7);
          min-height: 60px;
          transition: all 0.2s ease;
          overflow: hidden;
        }

        .dark .profile-field-block {
          border-color: rgba(30, 41, 59, 0.8);
          background: rgba(15, 23, 42, 0.4);
        }

        .profile-field-block:hover {
          border-color: rgba(99, 102, 241, 0.4);
          background: #ffffff;
          box-shadow: 0 4px 12px -2px rgba(15, 23, 42, 0.05);
        }

        .dark .profile-field-block:hover {
          border-color: rgba(99, 102, 241, 0.5);
          background: rgba(15, 23, 42, 0.8);
        }

        .profile-field-accent {
          width: 3.5px;
          min-width: 3.5px;
          height: 32px;
          border-radius: 99px;
          background: linear-gradient(180deg, #4f46e5 0%, #7c3aed 100%);
          opacity: 0.5;
          flex-shrink: 0;
        }

        .profile-field-empty .profile-field-accent {
          background: linear-gradient(180deg, #f59e0b 0%, #ef4444 100%);
          opacity: 0.6;
        }

        .profile-field-secure .profile-field-accent {
          background: linear-gradient(180deg, #06b6d4 0%, #8b5cf6 100%);
          opacity: 0.6;
        }

        .profile-field-label {
          display: block;
          font-size: 10.5px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: #64748b;
          margin-bottom: 2px;
          user-select: none;
        }

        .dark .profile-field-label { color: #94a3b8; }

        .profile-field-value {
          display: flex;
          align-items: center;
        }

        .profile-field-icon {
          font-size: 1.25rem;
          opacity: 0.3;
          flex-shrink: 0;
          margin-left: auto;
          user-select: none;
        }

        .profile-pending-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: #d97706;
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.25);
        }

        .profile-reveal-btn {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          color: #4f46e5;
          cursor: pointer;
          padding: 2px 8px;
          border-radius: 6px;
          background: rgba(79, 70, 229, 0.08);
          border: 1px solid rgba(79, 70, 229, 0.2);
          transition: all 0.15s;
        }

        .profile-reveal-btn:hover {
          background: rgba(79, 70, 229, 0.15);
          color: #4338ca;
        }

        @keyframes toastSlide {
          0% { opacity: 0; transform: translateY(20px); }
          10% { opacity: 1; transform: translateY(0); }
          90% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(15px); }
        }
        .animate-toast-slide { animation: toastSlide 4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>

    </div>
  );
}
