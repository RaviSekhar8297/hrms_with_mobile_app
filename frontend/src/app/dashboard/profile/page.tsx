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
  passing_year?: string;
  percentage_gpa?: string;
  year?: string;
  grade?: string;
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

  // Edit Mode & Tab state
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'work' | 'education' | 'skills' | 'compliance' | 'security'>('overview');

  // Skills List state
  const [skillsList, setSkillsList] = useState<string[]>([]);
  const [newSkillInput, setNewSkillInput] = useState('');
  
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

  // Initial Form Snapshot for change detection
  const [initialFormValues, setInitialFormValues] = useState<any>(null);

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
    let parsed = val;
    if (typeof val === 'string') {
      try {
        parsed = JSON.parse(val);
      } catch {
        return [];
      }
    }
    return Array.isArray(parsed) ? parsed : (parsed && typeof parsed === 'object' ? [parsed] : []);
  };

  const initializeFormFields = (emp: Employee) => {
    const init = {
      first_name: emp.first_name || '',
      last_name: emp.last_name || '',
      phone: emp.phone || '',
      personal_email: emp.personal_email || '',
      dob: emp.dob ? emp.dob.split('T')[0] : '',
      gender: emp.gender || '',
      marital_status: emp.marital_status || '',
      blood_group: emp.blood_group || '',
      pan_number: emp.pan_number || '',
      aadhar_number: emp.aadhar_number || '',
      esi_number: emp.esi_number || '',
      uan_number: emp.uan_number || '',
      current_address: emp.current_address || '',
      permanent_address: emp.permanent_address || '',
      employment_type: emp.employment_type || '',
      emp_image: emp.emp_image || '',
      bank_information: JSON.stringify(parseJSONB(emp.bank_information)),
      emergency_contacts: JSON.stringify(parseJSONB(emp.emergency_contacts)),
      education: JSON.stringify(parseJSONB(emp.education)),
      experience: JSON.stringify(parseJSONB(emp.experience)),
    };

    setFirstName(init.first_name);
    setLastName(init.last_name);
    setPhone(init.phone);
    setPersonalEmail(init.personal_email);
    setDob(init.dob);
    setGender(init.gender);
    setMaritalStatus(init.marital_status);
    setBloodGroup(init.blood_group);
    setPanNumber(init.pan_number);
    setAadharNumber(init.aadhar_number);
    setEsiNumber(init.esi_number);
    setUanNumber(init.uan_number);
    setCurrentAddress(init.current_address);
    setPermanentAddress(init.permanent_address);
    setEmploymentType(init.employment_type);
    setEmpImage(init.emp_image);

    const bankList = parseJSONB(emp.bank_information);
    const familyList = parseJSONB(emp.emergency_contacts);
    const eduList = parseJSONB(emp.education);
    const expList = parseJSONB(emp.experience);

    let parsedSkills: string[] = [];
    const rawSkills = (emp as any).skills;
    if (rawSkills) {
      if (Array.isArray(rawSkills)) {
        parsedSkills = rawSkills;
      } else if (typeof rawSkills === 'string') {
        try {
          const jsonP = JSON.parse(rawSkills);
          parsedSkills = Array.isArray(jsonP) ? jsonP : rawSkills.split(',').map(s => s.trim());
        } catch {
          parsedSkills = rawSkills.split(',').map(s => s.trim());
        }
      }
    }

    setBankInfoList(bankList);
    setFamilyContacts(familyList);
    setEducationList(eduList);
    setExperienceList(expList);
    setSkillsList(parsedSkills.filter(Boolean));

    setInitialFormValues(init);
  };

  const currentFormValues = {
    first_name: firstName,
    last_name: lastName,
    phone: phone,
    personal_email: personalEmail,
    dob: dob,
    gender: gender,
    marital_status: maritalStatus,
    blood_group: bloodGroup,
    pan_number: panNumber,
    aadhar_number: aadharNumber,
    esi_number: esiNumber,
    uan_number: uanNumber,
    current_address: currentAddress,
    permanent_address: permanentAddress,
    employment_type: employmentType,
    emp_image: empImage,
    bank_information: JSON.stringify(Array.isArray(bankInfoList) ? bankInfoList : []),
    emergency_contacts: JSON.stringify(Array.isArray(familyContacts) ? familyContacts : []),
    education: JSON.stringify(Array.isArray(educationList) ? educationList : []),
    experience: JSON.stringify(Array.isArray(experienceList) ? experienceList : []),
  };

  const hasProfileChanges = initialFormValues ? Object.keys(currentFormValues).some(
    key => (currentFormValues as any)[key] !== (initialFormValues as any)[key]
  ) : false;

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

    if (!hasProfileChanges) {
      triggerCustomToast('ℹ️ No changes detected to save.', 'info');
      setIsEditing(false);
      return;
    }

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
        setInitialFormValues(currentFormValues);
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
          setInitialFormValues(currentFormValues);
          fetchProfileData(email, companyId);
          setIsEditing(false);
        } else {
          const updated = { ...payload, id: myProfile.id };
          setMyProfile(updated);
          setInitialFormValues(currentFormValues);
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

  const getFieldTheme = (label: string) => {
    const l = label.toLowerCase();
    if (l.includes('name')) return 'bg-gradient-to-br from-indigo-500 via-purple-600 to-indigo-700 text-white shadow-md shadow-indigo-500/20';
    if (l.includes('email') || l.includes('phone')) return 'bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 text-white shadow-md shadow-sky-500/20';
    if (l.includes('birth') || l.includes('dob')) return 'bg-gradient-to-br from-pink-500 via-rose-600 to-red-600 text-white shadow-md shadow-pink-500/20';
    if (l.includes('address') || l.includes('location') || l.includes('branch')) return 'bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-600 text-white shadow-md shadow-emerald-500/20';
    if (l.includes('pan') || l.includes('aadhar') || l.includes('esi') || l.includes('uan')) return 'bg-gradient-to-br from-amber-500 via-orange-600 to-rose-600 text-white shadow-md shadow-amber-500/20';
    if (l.includes('department') || l.includes('designation') || l.includes('role')) return 'bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-700 text-white shadow-md shadow-violet-500/20';
    return 'bg-gradient-to-br from-indigo-500 to-sky-600 text-white shadow-md shadow-indigo-500/20';
  };

  const renderFieldBlock = (label: string, value: string | undefined | null) => {
    const icon = getFieldIcon(label);
    const themeClass = getFieldTheme(label);
    return (
      <div className="group flex items-center gap-3.5 p-3.5 rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-2xs hover:shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-400/50 hover:-translate-y-0.5 transition-all duration-300">
        <div className={`h-10 w-10 rounded-2xl ${themeClass} flex items-center justify-center text-sm font-semibold shrink-0 group-hover:scale-110 transition-transform duration-300`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            {label}
          </span>
          <div className="mt-0.5 truncate text-xs font-extrabold text-slate-900 dark:text-slate-100">
            {renderValueBadge(value)}
          </div>
        </div>
      </div>
    );
  };

  const renderSecureFieldBlock = (label: string, value: string | undefined | null, reveal: boolean, setReveal: (v: boolean) => void) => {
    const icon = getFieldIcon(label);
    const themeClass = getFieldTheme(label);
    const hasVal = value && value.trim() !== '';
    return (
      <div className="group flex items-center gap-3.5 p-3.5 rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-2xs hover:shadow-xl hover:shadow-amber-500/10 hover:border-amber-400/50 hover:-translate-y-0.5 transition-all duration-300">
        <div className={`h-10 w-10 rounded-2xl ${themeClass} flex items-center justify-center text-sm font-semibold shrink-0 group-hover:scale-110 transition-transform duration-300`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
            {label}
          </span>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            {maskValue(value, reveal)}
            {hasVal && (
              <button
                type="button"
                onClick={() => setReveal(!reveal)}
                className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800/80 hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-2xs"
              >
                {reveal ? '🙈 Hide' : '👁 Show'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const safeBankInfoList = Array.isArray(bankInfoList) ? bankInfoList : [];

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



      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent" />
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Syncing Profile Details...</p>
        </div>
      ) : (
        <div className="w-full space-y-6">
          
          {/* 🌄 EXECUTIVE ROYAL BLUE FULL COLOR COVER HEADER */}
          <div className="relative w-full rounded-3xl overflow-hidden bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 border border-blue-600/40 shadow-xl transition-all duration-300">
            
            {/* Cover Scenery Image Overlay */}
            <div 
              className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-overlay transition-all duration-700 hover:scale-105"
              style={{
                backgroundImage: `url('https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=80')`
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-slate-950/20 to-transparent" />

            <div className="p-6 sm:p-8 relative z-10 space-y-6">
              
              {/* Cover Top Inspiration */}
              <div className="flex items-center justify-end">
                <span className="text-xs font-bold text-sky-100/90 italic drop-shadow-md hidden sm:inline-block">
                  "An employee's experience is the sum of all interactions."
                </span>
              </div>

              {/* Profile Info & Action Bar */}
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                
                {/* Avatar + Main Info */}
                <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
                  
                  {/* Avatar - Clickable */}
                  <label className="relative group shrink-0 transition-all duration-500 hover:scale-105 cursor-pointer" title="Click photo to change">
                    <div className="absolute -inset-1.5 rounded-[2.2rem] bg-gradient-to-r from-sky-400 via-indigo-400 to-pink-500 opacity-80 blur-md group-hover:opacity-100 group-hover:blur-lg transition-all duration-500" />
                    
                    <div className="h-28 w-28 sm:h-32 sm:w-32 rounded-[2rem] bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-900 text-white font-black text-3xl sm:text-4xl flex items-center justify-center shadow-2xl relative font-outfit overflow-hidden border-4 border-white group-hover:border-sky-300 transition-all duration-500">
                      {(empImage || myProfile?.emp_image) ? (
                        <img 
                          src={empImage || myProfile?.emp_image} 
                          alt={firstName ? `${firstName} ${lastName}` : 'Profile'} 
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" 
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : null}
                      {!(empImage || myProfile?.emp_image) && (
                        <span>
                          {firstName ? `${firstName.charAt(0).toUpperCase()}${lastName ? lastName.charAt(0).toUpperCase() : ''}` : email.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span className="absolute top-2 right-2 h-4 w-4 rounded-full bg-emerald-400 border-2 border-white z-10 animate-pulse shadow-md shadow-emerald-400/50" title="Active Status" />
                    </div>

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
                            setIsEditing(true);
                            triggerCustomToast('📸 Profile photo updated! Click "Save Changes" to save.', 'info');
                          };
                          reader.readAsDataURL(file);
                        }
                      }} 
                    />
                  </label>

                  {/* Name & Headline - PURE CRISP WHITE */}
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                      <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight font-outfit drop-shadow-md">
                        {firstName ? `${firstName} ${lastName}` : email.split('@')[0]}
                      </h1>
                      <span className="text-sky-300 font-bold text-lg" title="Verified Employee">✓</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                        myProfile?.status === 'ACTIVE' || isSuperAdmin
                          ? 'bg-emerald-500/25 text-emerald-200 border-emerald-400/50'
                          : 'bg-amber-500/25 text-amber-200 border-amber-400/50'
                      }`}>
                        {myProfile?.status || 'ACTIVE'}
                      </span>
                    </div>

                    <p className="text-xs font-extrabold text-sky-200 tracking-wider uppercase drop-shadow-xs">
                      {myProfile?.designation_name || 'Organization Member'}
                    </p>

                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs font-medium text-white pt-1">
                      <span className="bg-white/15 backdrop-blur-md px-3 py-1 rounded-xl border border-white/20 text-white shadow-xs">
                        Emp ID: <strong className="font-mono text-white">{myProfile?.emp_id_code || 'PENDING'}</strong>
                      </span>
                      <span className="bg-white/15 backdrop-blur-md px-3 py-1 rounded-xl border border-white/20 text-white shadow-xs">
                        Role: <strong className="text-white">{isSuperAdmin ? 'SuperAdmin' : (myProfile?.role_name || 'Employee')}</strong>
                      </span>
                      <span className="bg-white/15 backdrop-blur-md px-3 py-1 rounded-xl border border-white/20 text-white shadow-xs">
                        Joined: <strong className="text-white">{myProfile?.joining_date ? new Date(myProfile.joining_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Pending'}</strong>
                      </span>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          </div>

          {/* 📱 SEPARATE STANDALONE FLOATING NAVIGATION BAR WITH EDIT ICON AT END */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-2 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-md">
            
            {/* Left Side: Navigation Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all duration-300 flex items-center gap-2.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'overview'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-600/20 scale-[1.02]'
                    : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <span className="text-sm">👤</span>
                <span>Personal Overview</span>
                {activeTab === 'overview' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('work')}
                className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all duration-300 flex items-center gap-2.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'work'
                    ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-md shadow-sky-600/20 scale-[1.02]'
                    : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <span className="text-sm">🏢</span>
                <span>Work & Organization</span>
                {activeTab === 'work' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('education')}
                className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all duration-300 flex items-center gap-2.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'education'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/20 scale-[1.02]'
                    : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <span className="text-sm">🎓</span>
                <span>Education</span>
                {activeTab === 'education' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('skills')}
                className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all duration-300 flex items-center gap-2.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'skills'
                    ? 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-md shadow-cyan-600/20 scale-[1.02]'
                    : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <span className="text-sm">⚡</span>
                <span>Skills & Expertise</span>
                {activeTab === 'skills' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('compliance')}
                className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all duration-300 flex items-center gap-2.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'compliance'
                    ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md shadow-amber-600/20 scale-[1.02]'
                    : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <span className="text-sm">🛡️</span>
                <span>Compliance & Banking</span>
                {activeTab === 'compliance' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('security')}
                className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all duration-300 flex items-center gap-2.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'security'
                    ? 'bg-gradient-to-r from-rose-600 to-purple-600 text-white shadow-md shadow-rose-600/20 scale-[1.02]'
                    : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <span className="text-sm">🔒</span>
                <span>Security & Account</span>
                {activeTab === 'security' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />}
              </button>
            </div>

            {/* Right Side: ICON-ONLY Edit Button at the end of the tabs bar */}
            <div className="shrink-0 flex items-center gap-2 pr-1">
              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="h-10 w-10 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition-all duration-300 shadow-md shadow-indigo-600/20 hover:scale-110 active:scale-95 cursor-pointer"
                  title="Edit Profile Details"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-3 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold rounded-2xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveChanges}
                    disabled={saving || !hasProfileChanges}
                    className={`px-4 py-2 text-xs font-extrabold rounded-2xl transition-all flex items-center gap-2 ${
                      hasProfileChanges && !saving
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-md shadow-emerald-600/20 active:scale-95'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none opacity-60'
                    }`}
                    title={!hasProfileChanges ? 'No changes detected to save' : 'Click to save profile changes'}
                  >
                    {saving ? (
                      'Saving...'
                    ) : (
                      <>
                        {hasProfileChanges && <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping" />}
                        {hasProfileChanges ? 'Save Changes' : 'No Changes'}
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

          </div>

          {/* MAIN SOCIAL MEDIA FEED GRID */}
          <form onSubmit={handleSaveChanges} className="w-full space-y-6">
            
            <div className="grid gap-6 lg:grid-cols-3 items-start">
              
              {/* LEFT SIDEBAR (1 col): SOCIAL MEDIA STATS & QUICK INFO CARD */}
              <div className="lg:col-span-1 space-y-6 text-left">
                
                <div className="rounded-3xl border border-indigo-100 dark:border-indigo-900/40 bg-white/90 dark:bg-slate-900/90 p-6 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 relative overflow-hidden group w-full space-y-5">
                  <div className="h-1 bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 absolute top-0 inset-x-0" />
                  
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 text-sm font-semibold">📌</span>
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-white font-outfit">Quick Summary</h3>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 text-[10px] font-extrabold uppercase tracking-wider">
                      Verified
                    </span>
                  </div>

                  <div className="space-y-3 text-xs font-medium">
                    <div className="group/item flex items-center gap-3.5 p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50 hover:border-indigo-400/50 hover:bg-white dark:hover:bg-slate-800 transition-all duration-300">
                      <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-sm font-semibold shrink-0 shadow-md shadow-indigo-500/20 group-hover/item:scale-110 transition-transform">
                        📧
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[9.5px] font-extrabold uppercase text-slate-400 tracking-wider block mb-0.5">Work Email</span>
                        <span className="font-bold text-slate-800 dark:text-slate-100 truncate block select-all">{email}</span>
                      </div>
                    </div>

                    <div className="group/item flex items-center gap-3.5 p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50 hover:border-sky-400/50 hover:bg-white dark:hover:bg-slate-800 transition-all duration-300">
                      <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white flex items-center justify-center text-sm font-semibold shrink-0 shadow-md shadow-sky-500/20 group-hover/item:scale-110 transition-transform">
                        📱
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[9.5px] font-extrabold uppercase text-slate-400 tracking-wider block mb-0.5">Primary Phone</span>
                        <span className="font-bold text-slate-800 dark:text-slate-100 block">{phone || 'Not Provided'}</span>
                      </div>
                    </div>

                    <div className="group/item flex items-center gap-3.5 p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50 hover:border-emerald-400/50 hover:bg-white dark:hover:bg-slate-800 transition-all duration-300">
                      <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center text-sm font-semibold shrink-0 shadow-md shadow-emerald-500/20 group-hover/item:scale-110 transition-transform">
                        🏢
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[9.5px] font-extrabold uppercase text-slate-400 tracking-wider block mb-0.5">Office Location</span>
                        <span className="font-bold text-slate-800 dark:text-slate-100 block">{myProfile?.branch_name || 'Not Specified'}</span>
                      </div>
                    </div>

                    <div className="group/item flex items-center gap-3.5 p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50 hover:border-purple-400/50 hover:bg-white dark:hover:bg-slate-800 transition-all duration-300">
                      <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center text-sm font-semibold shrink-0 shadow-md shadow-purple-500/20 group-hover/item:scale-110 transition-transform">
                        💼
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[9.5px] font-extrabold uppercase text-slate-400 tracking-wider block mb-0.5">Department & Designation</span>
                        <span className="font-bold text-slate-800 dark:text-slate-100 block">
                          {myProfile?.department_name ? `${myProfile.department_name} • ${myProfile?.designation_name || 'Member'}` : (myProfile?.designation_name || 'Not Specified')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* RIGHT MAIN SOCIAL FEED (2 cols): TAB CONTENT CARDS */}
              <div className="lg:col-span-2 space-y-6 text-left">
                
                {/* 1️⃣ TAB 1: OVERVIEW & PERSONAL INFO */}
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    
                    {/* Personal Information Card */}
                    <div className="rounded-3xl border border-indigo-100 dark:border-indigo-900/40 bg-white/90 dark:bg-slate-900/90 p-6 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 relative overflow-hidden group w-full">
                      <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 absolute top-0 inset-x-0" />
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-5">
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 text-sm font-semibold">👤</span>
                          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-white font-outfit">Personal Information</h3>
                        </div>
                      </div>
                      
                      {isEditing ? (
                        <div className="grid gap-4 sm:grid-cols-2">
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
                        <div className="grid gap-3 sm:grid-cols-2">
                          {renderFieldBlock("First Name", firstName)}
                          {renderFieldBlock("Last Name", lastName)}
                          <div className="col-span-full">
                            {renderFieldBlock("Official Work Email", email)}
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

                    {/* Residential Address Card */}
                    <div className="rounded-3xl border border-emerald-100 dark:border-emerald-900/40 bg-white/90 dark:bg-slate-900/90 p-6 shadow-sm hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-300 relative overflow-hidden group w-full">
                      <div className="h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 absolute top-0 inset-x-0" />
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-5">
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 text-sm font-semibold">📍</span>
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

                  </div>
                )}

                {/* 2️⃣ TAB 2: WORK & ORGANIZATION */}
                {activeTab === 'work' && (
                  <div className="space-y-6">
                    <div className="rounded-3xl border border-sky-100 dark:border-sky-900/40 bg-white/90 dark:bg-slate-900/90 p-6 shadow-sm hover:shadow-xl hover:shadow-sky-500/10 transition-all duration-300 relative overflow-hidden group w-full">
                      <div className="h-1 bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500 absolute top-0 inset-x-0" />
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-5">
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 text-sm font-semibold">🏢</span>
                          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-white font-outfit">Organization & Employment Info</h3>
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {renderFieldBlock("Assigned Office Branch", myProfile?.branch_name)}
                        {renderFieldBlock("Primary Department", myProfile?.department_name)}
                        {renderFieldBlock("Job Designation", myProfile?.designation_name)}
                        {renderFieldBlock("Employment Type", employmentType || 'Full-Time Regular')}
                        {renderFieldBlock("Date of Joining", myProfile?.joining_date ? new Date(myProfile.joining_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Pending')}
                        {renderFieldBlock("System Access Role", isSuperAdmin ? 'SuperAdmin' : (myProfile?.role_name || 'Employee'))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 🎓 TAB 3: EDUCATION & QUALIFICATIONS */}
                {activeTab === 'education' && (
                  <div className="space-y-6 animate-fadeIn">
                    <div className="rounded-3xl border border-purple-100 dark:border-purple-900/40 bg-white/90 dark:bg-slate-900/90 p-6 shadow-sm hover:shadow-xl hover:shadow-purple-500/10 transition-all duration-300 relative overflow-hidden group w-full">
                      <div className="h-1 bg-gradient-to-r from-purple-500 via-indigo-500 to-pink-500 absolute top-0 inset-x-0" />
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-5">
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 text-sm font-semibold">🎓</span>
                          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-white font-outfit">Education & Academic Qualifications</h3>
                        </div>
                      </div>

                      {isEditing ? (
                        <div className="space-y-4">
                          {educationList.map((edu, index) => (
                            <div key={index} className="grid gap-4 sm:grid-cols-2 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 relative">
                              <button
                                type="button"
                                onClick={() => setEducationList(educationList.filter((_, i) => i !== index))}
                                className="absolute top-3 right-3 text-rose-600 hover:text-rose-700 text-xs font-bold cursor-pointer"
                              >
                                Remove
                              </button>
                              <div>
                                <label className="profile-custom-form-label">Degree / Qualification</label>
                                <input type="text" required value={edu.degree} onChange={(e) => { const list = [...educationList]; list[index].degree = e.target.value; setEducationList(list); }} className="premium-input" placeholder="e.g. B.Tech Computer Science" />
                              </div>
                              <div>
                                <label className="profile-custom-form-label">University / Institution</label>
                                <input type="text" required value={edu.institution} onChange={(e) => { const list = [...educationList]; list[index].institution = e.target.value; setEducationList(list); }} className="premium-input" placeholder="e.g. JNTU / Andhra University" />
                              </div>
                              <div>
                                <label className="profile-custom-form-label">Year of Passing</label>
                                <input type="text" value={edu.year || edu.passing_year || ''} onChange={(e) => { const list = [...educationList]; list[index].year = e.target.value; setEducationList(list); }} className="premium-input" placeholder="e.g. 2020" />
                              </div>
                              <div>
                                <label className="profile-custom-form-label">Grade / CGPA / Percentage</label>
                                <input type="text" value={edu.grade || edu.percentage_gpa || ''} onChange={(e) => { const list = [...educationList]; list[index].grade = e.target.value; setEducationList(list); }} className="premium-input" placeholder="e.g. 8.5 CGPA / 85%" />
                              </div>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => setEducationList([...educationList, { degree: '', institution: '', year: '', grade: '' }])}
                            className="py-3 px-4 border border-dashed border-purple-300 dark:border-purple-700 text-xs font-bold rounded-xl w-full text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-colors cursor-pointer"
                          >
                            + Add Educational Qualification
                          </button>
                        </div>
                      ) : educationList.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-6 border border-dashed border-purple-200 dark:border-purple-900/40 bg-purple-50/40 dark:bg-purple-950/20 rounded-2xl text-center">
                          <span className="text-xl mb-1">🎓</span>
                          <p className="text-xs font-bold text-purple-700 dark:text-purple-300">No Education Records Added</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Click edit to add your degrees & academic qualifications.</p>
                        </div>
                      ) : (
                        <div className="grid gap-4 sm:grid-cols-2">
                          {educationList.map((edu, idx) => (
                            <div key={idx} className="p-4.5 rounded-2xl border border-purple-100 dark:border-purple-900/30 bg-purple-50/30 dark:bg-purple-950/20 hover:border-purple-300 hover:shadow-md transition-all space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-[10px] font-black uppercase tracking-wider">
                                  {edu.year || edu.passing_year || 'Graduated'}
                                </span>
                                {(edu.grade || edu.percentage_gpa) && (
                                  <span className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400">
                                    ★ {edu.grade || edu.percentage_gpa}
                                  </span>
                                )}
                              </div>
                              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white leading-snug">
                                {edu.degree}
                              </h4>
                              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                <span>🏛️</span>
                                <span>{edu.institution}</span>
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ⚡ TAB 4: SKILLS & EXPERTISE */}
                {activeTab === 'skills' && (
                  <div className="space-y-6 animate-fadeIn">
                    <div className="rounded-3xl border border-cyan-100 dark:border-cyan-900/40 bg-white/90 dark:bg-slate-900/90 p-6 shadow-sm hover:shadow-xl hover:shadow-cyan-500/10 transition-all duration-300 relative overflow-hidden group w-full">
                      <div className="h-1 bg-gradient-to-r from-cyan-500 via-teal-500 to-indigo-500 absolute top-0 inset-x-0" />
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-5">
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 text-sm font-semibold">⚡</span>
                          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-white font-outfit">Technical Skills & Professional Expertise</h3>
                        </div>
                      </div>

                      {skillsList.length === 0 && !isEditing ? (
                        <div className="flex flex-col items-center justify-center p-6 border border-dashed border-cyan-200 dark:border-cyan-900/40 bg-cyan-50/40 dark:bg-cyan-950/20 rounded-2xl text-center">
                          <span className="text-xl mb-1">⚡</span>
                          <p className="text-xs font-bold text-cyan-700 dark:text-cyan-300">No Technical Skills Recorded</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Click edit button above to add your technical skills.</p>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {/* Skills Badges Pill Grid */}
                          <div className="flex flex-wrap gap-2.5">
                            {skillsList.map((skill, idx) => (
                              <div
                                key={idx}
                                className="px-4 py-2 rounded-2xl bg-gradient-to-r from-indigo-50 to-sky-50 dark:from-indigo-950/40 dark:to-sky-950/40 border border-indigo-200/80 dark:border-indigo-800/60 text-slate-800 dark:text-slate-100 text-xs font-extrabold flex items-center gap-2 shadow-2xs hover:scale-105 transition-transform"
                              >
                                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                                <span>{skill}</span>
                                {isEditing && (
                                  <button
                                    type="button"
                                    onClick={() => setSkillsList(skillsList.filter((_, i) => i !== idx))}
                                    className="text-rose-500 hover:text-rose-700 ml-1 text-xs font-bold cursor-pointer"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Add Skill Input in Edit Mode */}
                          {isEditing && (
                            <div className="flex items-center gap-3 pt-2">
                              <input
                                type="text"
                                placeholder="Type a skill (e.g. Next.js, Keycloak) and click Add..."
                                value={newSkillInput}
                                onChange={(e) => setNewSkillInput(e.target.value)}
                                className="premium-input flex-1"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    if (newSkillInput.trim()) {
                                      setSkillsList([...skillsList, newSkillInput.trim()]);
                                      setNewSkillInput('');
                                    }
                                  }
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  if (newSkillInput.trim()) {
                                    setSkillsList([...skillsList, newSkillInput.trim()]);
                                    setNewSkillInput('');
                                  }
                                }}
                                className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold rounded-xl uppercase tracking-wider cursor-pointer shadow-md shadow-cyan-600/20"
                              >
                                + Add Skill
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 3️⃣ TAB 3: COMPLIANCE & BANKING */}
                {activeTab === 'compliance' && (
                  <div className="space-y-6">
                    
                    {/* Compliance & Identifiers Card */}
                    <div className="rounded-3xl border border-amber-100 dark:border-amber-900/40 bg-white/90 dark:bg-slate-900/90 p-6 shadow-sm hover:shadow-xl hover:shadow-amber-500/10 transition-all duration-300 relative overflow-hidden group w-full">
                      <div className="h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 absolute top-0 inset-x-0" />
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-5">
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 text-sm font-semibold">🛡️</span>
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

                    {/* Bank Accounts Card */}
                    <div className="rounded-3xl border border-indigo-100 dark:border-indigo-900/40 bg-white/90 dark:bg-slate-900/90 p-6 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 relative overflow-hidden group w-full">
                      <div className="h-1 bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 absolute top-0 inset-x-0" />
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-5">
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 text-sm font-semibold">🏦</span>
                          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-white font-outfit font-bold">Bank Accounts</h3>
                        </div>
                      </div>
                      {isEditing ? (
                        <div className="space-y-4">
                          {safeBankInfoList.map((bank, index) => (
                            <div key={index} className="grid gap-4 sm:grid-cols-2 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 relative">
                              <button
                                type="button"
                                onClick={() => setBankInfoList(safeBankInfoList.filter((_, i) => i !== index))}
                                className="absolute top-3 right-3 text-rose-600 hover:text-rose-700 text-xs font-bold cursor-pointer"
                              >
                                Remove
                              </button>
                              <div>
                                <label className="profile-custom-form-label">Bank Name</label>
                                <input type="text" required value={bank.bank_name} onChange={(e) => { const list = [...safeBankInfoList]; list[index].bank_name = e.target.value; setBankInfoList(list); }} className="premium-input" />
                              </div>
                              <div>
                                <label className="profile-custom-form-label">Account Number</label>
                                <input type="text" required value={bank.account_number} onChange={(e) => { const list = [...safeBankInfoList]; list[index].account_number = e.target.value; setBankInfoList(list); }} className="premium-input" />
                              </div>
                              <div>
                                <label className="profile-custom-form-label">IFSC Code</label>
                                <input type="text" required value={bank.ifsc_code} onChange={(e) => { const list = [...safeBankInfoList]; list[index].ifsc_code = e.target.value; setBankInfoList(list); }} className="premium-input" />
                              </div>
                              <div>
                                <label className="profile-custom-form-label">Branch Name</label>
                                <input type="text" required value={bank.branch_name} onChange={(e) => { const list = [...safeBankInfoList]; list[index].branch_name = e.target.value; setBankInfoList(list); }} className="premium-input" />
                              </div>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => setBankInfoList([...safeBankInfoList, { bank_name: '', account_number: '', ifsc_code: '', branch_name: '' }])}
                            className="py-3 px-4 border border-dashed border-indigo-300 dark:border-indigo-700 text-xs font-bold rounded-xl w-full text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors cursor-pointer"
                          >
                            + Add Bank Account
                          </button>
                        </div>
                      ) : (
                        <>
                          {safeBankInfoList.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-6 border border-dashed border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 rounded-2xl text-center">
                              <span className="text-lg mb-1">⚠️</span>
                              <p className="text-xs font-bold text-amber-700 dark:text-amber-400">Pending Bank Account Records</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Click Edit Profile to add bank details for payroll processing.</p>
                            </div>
                          ) : (
                            <div className="grid gap-4 sm:grid-cols-2">
                              {safeBankInfoList.map((bank, index) => (
                                <div key={index} className="w-full bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-950 text-white rounded-2xl p-5 border border-indigo-500/30 shadow-xl hover:scale-[1.02] transition-all duration-300 relative overflow-hidden flex flex-col justify-between group">
                                  <div className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full bg-indigo-500/10 blur-2xl group-hover:bg-indigo-500/20 transition-all" />
                                  <div className="flex justify-between items-center relative z-10">
                                    <span className="text-xs font-black tracking-widest uppercase text-indigo-200 flex items-center gap-2">
                                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
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

                  </div>
                )}

                {/* 4️⃣ TAB 4: SECURITY & CREDENTIALS */}
                {activeTab === 'security' && (
                  <div className="space-y-6">
                    <div className="rounded-3xl border border-rose-200/90 dark:border-rose-900/50 bg-gradient-to-br from-white via-rose-50/20 to-indigo-50/20 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 p-6 sm:p-7 shadow-lg hover:shadow-2xl hover:shadow-rose-500/10 transition-all duration-500 relative overflow-hidden group w-full">
                      <div className="h-1.5 bg-gradient-to-r from-rose-500 via-purple-500 to-indigo-500 absolute top-0 inset-x-0 animate-pulse" />
                      
                      <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-4 mb-6">
                        <div className="flex items-center gap-3">
                          <span className="p-2 rounded-2xl bg-gradient-to-br from-rose-500 to-indigo-600 text-white text-base font-bold shadow-md shadow-rose-500/20">🔒</span>
                          <div>
                            <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 dark:text-white font-outfit">Update Keycloak Password</h3>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Sync your password directly with Keycloak Identity Server</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-5">
                        <div className="grid gap-5 sm:grid-cols-2">
                          <div>
                            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">New Password</label>
                            <div className="relative flex items-center group/input">
                              <input
                                type={showNewPassword ? "text" : "password"}
                                placeholder="••••••••"
                                value={newPasswordInput}
                                onChange={(e) => setNewPasswordInput(e.target.value)}
                                className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/90 text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/40 focus:border-rose-500 transition-all pr-12 shadow-2xs"
                              />
                              <button
                                type="button"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                                className="absolute right-3.5 text-base text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:scale-110 active:scale-95 transition-all cursor-pointer"
                                title={showNewPassword ? 'Hide password' : 'Show password'}
                              >
                                {showNewPassword ? '🙈' : '👁'}
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">Confirm Password</label>
                            <div className="relative flex items-center group/input">
                              <input
                                type={showConfirmPassword ? "text" : "password"}
                                placeholder="••••••••"
                                value={confirmPasswordInput}
                                onChange={(e) => setConfirmPasswordInput(e.target.value)}
                                className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/90 text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/40 focus:border-rose-500 transition-all pr-12 shadow-2xs"
                              />
                              <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3.5 text-base text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:scale-110 active:scale-95 transition-all cursor-pointer"
                                title={showConfirmPassword ? 'Hide password' : 'Show password'}
                              >
                                {showConfirmPassword ? '🙈' : '👁'}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Real-time Password Strength Meter & Requirement Chips */}
                        {(newPasswordInput || confirmPasswordInput) && (
                          <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-rose-100 dark:border-rose-900/40 space-y-3 shadow-sm animate-fadeIn">
                            {/* Strength Gauge Bar */}
                            <div className="space-y-1.5">
                              <div className="flex justify-between items-center text-[10.5px] font-extrabold uppercase tracking-wider">
                                <span className="text-slate-500 dark:text-slate-400">Password Security Rating</span>
                                <span className={
                                  (() => {
                                    const count = [isLengthValid, hasCapital, hasSmall, hasNumber, hasSpecial, (newPasswordInput && confirmPasswordInput && newPasswordInput === confirmPasswordInput)].filter(Boolean).length;
                                    if (count <= 2) return 'text-rose-600 dark:text-rose-400';
                                    if (count <= 5) return 'text-amber-600 dark:text-amber-400';
                                    return 'text-emerald-600 dark:text-emerald-400';
                                  })()
                                }>
                                  {(() => {
                                    const count = [isLengthValid, hasCapital, hasSmall, hasNumber, hasSpecial, (newPasswordInput && confirmPasswordInput && newPasswordInput === confirmPasswordInput)].filter(Boolean).length;
                                    if (count <= 2) return '🔴 Weak Password';
                                    if (count <= 5) return '🟡 Good Password';
                                    return '🟢 Excellent Strong Password!';
                                  })()}
                                </span>
                              </div>
                              
                              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-200/60 dark:border-slate-700/60">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    (() => {
                                      const count = [isLengthValid, hasCapital, hasSmall, hasNumber, hasSpecial, (newPasswordInput && confirmPasswordInput && newPasswordInput === confirmPasswordInput)].filter(Boolean).length;
                                      if (count <= 2) return 'w-1/3 bg-gradient-to-r from-rose-500 to-red-600 shadow-md shadow-rose-500/50';
                                      if (count <= 5) return 'w-2/3 bg-gradient-to-r from-amber-500 to-orange-500 shadow-md shadow-amber-500/50';
                                      return 'w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600 shadow-md shadow-emerald-500/50';
                                    })()
                                  }`}
                                />
                              </div>
                            </div>

                            {/* Requirements Checklist Chips */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                              <div className={`px-3 py-1.5 rounded-xl border text-[11px] font-extrabold transition-all duration-300 flex items-center gap-2 ${
                                isLengthValid 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60 shadow-2xs scale-[1.02]' 
                                  : 'bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-800/50 dark:text-slate-500 dark:border-slate-700/50'
                              }`}>
                                <span className={`text-xs ${isLengthValid ? 'text-emerald-500 animate-bounce' : 'text-slate-400'}`}>{isLengthValid ? '✓' : '○'}</span>
                                <span>6 to 14 characters</span>
                              </div>

                              <div className={`px-3 py-1.5 rounded-xl border text-[11px] font-extrabold transition-all duration-300 flex items-center gap-2 ${
                                hasCapital 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60 shadow-2xs scale-[1.02]' 
                                  : 'bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-800/50 dark:text-slate-500 dark:border-slate-700/50'
                              }`}>
                                <span className={`text-xs ${hasCapital ? 'text-emerald-500 animate-bounce' : 'text-slate-400'}`}>{hasCapital ? '✓' : '○'}</span>
                                <span>Capital letter (A-Z)</span>
                              </div>

                              <div className={`px-3 py-1.5 rounded-xl border text-[11px] font-extrabold transition-all duration-300 flex items-center gap-2 ${
                                hasSmall 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60 shadow-2xs scale-[1.02]' 
                                  : 'bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-800/50 dark:text-slate-500 dark:border-slate-700/50'
                              }`}>
                                <span className={`text-xs ${hasSmall ? 'text-emerald-500 animate-bounce' : 'text-slate-400'}`}>{hasSmall ? '✓' : '○'}</span>
                                <span>Small letter (a-z)</span>
                              </div>

                              <div className={`px-3 py-1.5 rounded-xl border text-[11px] font-extrabold transition-all duration-300 flex items-center gap-2 ${
                                hasNumber 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60 shadow-2xs scale-[1.02]' 
                                  : 'bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-800/50 dark:text-slate-500 dark:border-slate-700/50'
                              }`}>
                                <span className={`text-xs ${hasNumber ? 'text-emerald-500 animate-bounce' : 'text-slate-400'}`}>{hasNumber ? '✓' : '○'}</span>
                                <span>Number (0-9)</span>
                              </div>

                              <div className={`px-3 py-1.5 rounded-xl border text-[11px] font-extrabold transition-all duration-300 flex items-center gap-2 ${
                                hasSpecial 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60 shadow-2xs scale-[1.02]' 
                                  : 'bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-800/50 dark:text-slate-500 dark:border-slate-700/50'
                              }`}>
                                <span className={`text-xs ${hasSpecial ? 'text-emerald-500 animate-bounce' : 'text-slate-400'}`}>{hasSpecial ? '✓' : '○'}</span>
                                <span>Special char (!@#$)</span>
                              </div>

                              <div className={`px-3 py-1.5 rounded-xl border text-[11px] font-extrabold transition-all duration-300 flex items-center gap-2 ${
                                newPasswordInput && confirmPasswordInput && newPasswordInput === confirmPasswordInput 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60 shadow-2xs scale-[1.02]' 
                                  : 'bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-800/50 dark:text-slate-500 dark:border-slate-700/50'
                              }`}>
                                <span className={`text-xs ${newPasswordInput && confirmPasswordInput && newPasswordInput === confirmPasswordInput ? 'text-emerald-500 animate-bounce' : 'text-slate-400'}`}>{newPasswordInput && confirmPasswordInput && newPasswordInput === confirmPasswordInput ? '✓' : '○'}</span>
                                <span>Passwords match</span>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="flex justify-end pt-3">
                          <button
                            type="button"
                            onClick={handleUpdatePassword}
                            disabled={!isSaveEnabled || updatingPassword}
                            className={`px-6 py-3 text-xs font-black rounded-2xl uppercase tracking-widest transition-all duration-300 flex items-center gap-2.5 ${
                              isSaveEnabled && !updatingPassword
                                ? 'bg-gradient-to-r from-rose-600 via-purple-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white shadow-lg shadow-rose-600/30 hover:scale-105 active:scale-95 cursor-pointer animate-pulse'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed shadow-none opacity-60'
                            }`}
                          >
                            {updatingPassword ? (
                              <>
                                <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                Updating Password...
                              </>
                            ) : (
                              <>
                                <span>🔑 Update Keycloak Password</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

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
