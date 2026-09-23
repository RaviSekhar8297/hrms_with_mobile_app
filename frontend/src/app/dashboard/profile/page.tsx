'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import DashboardPageHeader from '../components/DashboardPageHeader';
import { getHeaders, getUrl } from '../utils/api';
import { useDashboard } from '../components/DashboardContext';
import { 
  User, Mail, Phone, Calendar, MapPin, CreditCard, ShieldCheck, Building2, 
  Layers, Briefcase, GraduationCap, Zap, Landmark, Lock, Heart, FileText, 
  CheckCircle2, Edit3, Eye, EyeOff, Plus, Trash2, Award, FileSpreadsheet, Globe, KeyRound, Sparkles, Pin, Printer, QrCode
} from 'lucide-react';
import { DatePickerSimple } from '@/components/ui/custom-controls';

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
  const [canEditProfile, setCanEditProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'work' | 'education' | 'skills' | 'compliance' | 'security'>('overview');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('permissions');
      const storedRoles = localStorage.getItem('roles');
      if (stored) {
        const perms = JSON.parse(stored);
        const roles = JSON.parse(storedRoles || '[]');
        const isSuper = roles.map((r: string) => r.toLowerCase()).includes('superadmin');
        if (isSuper || perms.includes('*')) {
          setCanEditProfile(true);
        } else {
          const hasEdit = perms.some((p: string) => p.includes('edit_employees') || p.includes('edit_profile') || p.includes('edit'));
          setCanEditProfile(hasEdit);
        }
      }
    } catch {}
  }, []);

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
  const [workEmail, setWorkEmail] = useState('');
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
  const [imgLoadError, setImgLoadError] = useState(false);
  const [showIdCardModal, setShowIdCardModal] = useState(false);
  const [companyDetails, setCompanyDetails] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const compressImage = (file: File, callback: (base64: string) => void) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 500;
        const MAX_HEIGHT = 500;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            width = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          callback(dataUrl);
        } else {
          callback(event.target?.result as string);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

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
      const res = await fetch('/api/v1/companies', { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) {
        setCompanies(data.companies || []);
        if (data.companies && data.companies.length > 0) {
          const currentCompanyId = companyId || localStorage.getItem('companyId');
          const foundCo = data.companies.find((c: any) => c.id === currentCompanyId) || data.companies[0];
          setCompanyDetails(foundCo);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchProfileData = async (currentEmail: string, currentCompanyId: string | null) => {
    setLoading(true);
    try {
      // 1. Try logged-in profile endpoint first
      const meRes = await fetch('/api/v1/employees/me', { headers: getHeaders() });
      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData.employee && meData.employee.id && meData.employee.emp_id_code !== 'EMP-ME') {
          setMyProfile(meData.employee);
          initializeFormFields(meData.employee);
          setLoading(false);
          return;
        }
      }

      // 2. Fallback to list search by email or username
      const res = await fetch(getUrl('/api/v1/employees', currentCompanyId), { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) {
        const list: Employee[] = data.employees || [];
        const found = list.find((emp) => 
          emp.email.toLowerCase() === currentEmail.toLowerCase() ||
          emp.emp_id_code.toLowerCase() === currentEmail.toLowerCase() ||
          emp.email.toLowerCase().startsWith(currentEmail.toLowerCase() + '@')
        );
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
      email: emp.email || email || '',
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
    setWorkEmail(init.email);
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
    email: workEmail,
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
      fetchCompanies();
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

    // 1. Phone number validation: strip whitespace, check 10 digits starting with 6,7,8,9 if entered
    const cleanPhone = phone ? phone.replace(/\s+/g, '') : '';
    if (phone && phone.trim() !== '') {
      if (cleanPhone.length !== 10 || !/^[6-9]\d{9}$/.test(cleanPhone)) {
        triggerCustomToast('⚠️ Primary Phone number must be exactly 10 digits starting with 6, 7, 8, or 9 (no spaces allowed).', 'error');
        return;
      }
    }

    // 2. Work Email validation: if entered, valid email and length <= 30 chars
    const emailToValidate = workEmail || myProfile.email;
    if (emailToValidate && emailToValidate.trim() !== '') {
      if (emailToValidate.length > 30) {
        triggerCustomToast('⚠️ Work Email must be below 30 characters.', 'error');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailToValidate.trim())) {
        triggerCustomToast('⚠️ Please enter a valid Work Email address.', 'error');
        return;
      }
    }

    // 3. First Name & Last Name validation: if entered, letters only & length <= 25 chars
    if (firstName && firstName.trim() !== '') {
      if (firstName.length > 25) {
        triggerCustomToast('⚠️ First Name must be below 25 characters.', 'error');
        return;
      }
      if (!/^[A-Za-z\s]+$/.test(firstName.trim())) {
        triggerCustomToast('⚠️ First Name must contain letters only.', 'error');
        return;
      }
    }

    if (lastName && lastName.trim() !== '') {
      if (lastName.length > 25) {
        triggerCustomToast('⚠️ Last Name must be below 25 characters.', 'error');
        return;
      }
      if (!/^[A-Za-z\s]+$/.test(lastName.trim())) {
        triggerCustomToast('⚠️ Last Name must contain letters only.', 'error');
        return;
      }
    }

    // 4. Current & Permanent Address validation: if entered, length <= 100 chars
    if (currentAddress && currentAddress.length > 100) {
      triggerCustomToast('⚠️ Current Address must be below 100 characters.', 'error');
      return;
    }
    if (permanentAddress && permanentAddress.length > 100) {
      triggerCustomToast('⚠️ Permanent Address must be below 100 characters.', 'error');
      return;
    }

    // 5. Education List Validation:
    if (Array.isArray(educationList)) {
      for (let i = 0; i < educationList.length; i++) {
        const edu = educationList[i];
        const degree = edu.degree || '';
        const inst = edu.institution || '';
        const passYr = edu.passing_year || edu.year || '';
        const grade = edu.percentage_gpa || edu.grade || '';

        if (degree && degree.length > 25) {
          triggerCustomToast(`⚠️ Education Degree #${i + 1} must be below 25 characters.`, 'error');
          return;
        }
        if (inst && inst.length > 25) {
          triggerCustomToast(`⚠️ Institution Name #${i + 1} must be below 25 characters.`, 'error');
          return;
        }
        if (passYr && String(passYr).trim() !== '') {
          if (!/^[12]\d{3}$/.test(String(passYr).trim())) {
            triggerCustomToast(`⚠️ Year of Passing #${i + 1} must be 4 digits starting with 1 or 2 (e.g. 2022).`, 'error');
            return;
          }
        }
        if (grade && String(grade).trim() !== '') {
          const gNum = parseFloat(String(grade));
          if (isNaN(gNum) || gNum < 35 || gNum > 100) {
            triggerCustomToast(`⚠️ Grade / Percentage #${i + 1} must be between 35 and 100.`, 'error');
            return;
          }
        }
      }
    }

    // 6. PAN Number validation: if entered, 5 capital letters + 4 digits + 1 capital letter
    if (panNumber && panNumber.trim() !== '') {
      const panUpper = panNumber.trim().toUpperCase();
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panUpper)) {
        triggerCustomToast('⚠️ PAN Number must be 5 capital letters, followed by 4 digits, and 1 capital letter (e.g. ABCDE1234F).', 'error');
        return;
      }
    }

    // 7. Aadhaar Number validation: if entered, exactly 12 digits
    if (aadharNumber && aadharNumber.trim() !== '') {
      const cleanAadhar = aadharNumber.replace(/\s+/g, '');
      if (!/^\d{12}$/.test(cleanAadhar)) {
        triggerCustomToast('⚠️ Aadhaar Number must be exactly 12 digits.', 'error');
        return;
      }
    }

    // 8. ESI & UAN validation: if entered, exactly 10 digits each
    if (esiNumber && esiNumber.trim() !== '') {
      const cleanEsi = esiNumber.replace(/\s+/g, '');
      if (!/^\d{10}$/.test(cleanEsi)) {
        triggerCustomToast('⚠️ ESI Number must be exactly 10 digits.', 'error');
        return;
      }
    }

    if (uanNumber && uanNumber.trim() !== '') {
      const cleanUan = uanNumber.replace(/\s+/g, '');
      if (!/^\d{10}$/.test(cleanUan)) {
        triggerCustomToast('⚠️ UAN Number must be exactly 10 digits.', 'error');
        return;
      }
    }

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
        email: workEmail || myProfile.email,
        phone: cleanPhone || phone,
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
        const res = await fetch(`/api/v1/employees/${myProfile.id}`, {
          method: 'PUT',
          headers: {
            ...getHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          triggerCustomToast('✨ Profile changes saved successfully to DB!', 'success');
          const updatedEmail = workEmail || email;
          if (workEmail && workEmail !== email) {
            setEmail(workEmail);
            localStorage.setItem('email', workEmail);
          }
          setInitialFormValues(currentFormValues);
          fetchProfileData(updatedEmail, companyId);
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
      const res = await fetch('/api/v1/auth/change-password', {
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
    if (l.includes('first name') || l.includes('last name')) return <User className="w-5 h-5" />;
    if (l.includes('phone')) return <Phone className="w-5 h-5" />;
    if (l.includes('email')) return <Mail className="w-5 h-5" />;
    if (l.includes('birth') || l.includes('dob')) return <Calendar className="w-5 h-5" />;
    if (l.includes('gender')) return <User className="w-5 h-5" />;
    if (l.includes('marital')) return <Heart className="w-5 h-5" />;
    if (l.includes('blood')) return <Heart className="w-5 h-5" />;
    if (l.includes('address')) return <MapPin className="w-5 h-5" />;
    if (l.includes('pan')) return <CreditCard className="w-5 h-5" />;
    if (l.includes('aadhar')) return <FileText className="w-5 h-5" />;
    if (l.includes('esi')) return <ShieldCheck className="w-5 h-5" />;
    if (l.includes('uan')) return <Globe className="w-5 h-5" />;
    if (l.includes('branch')) return <Building2 className="w-5 h-5" />;
    if (l.includes('department')) return <Layers className="w-5 h-5" />;
    if (l.includes('designation') || l.includes('role')) return <Briefcase className="w-5 h-5" />;
    if (l.includes('joining')) return <Calendar className="w-5 h-5" />;
    return <FileText className="w-5 h-5" />;
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
              <div className="flex items-center justify-end border-b border-white/10 pb-4">
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
                    
                    <div className="h-32 w-32 sm:h-36 sm:w-36 rounded-[2.2rem] bg-gradient-to-br from-[#07518a] via-blue-700 to-indigo-900 text-white font-black text-3xl sm:text-4xl flex items-center justify-center shadow-2xl relative font-outfit overflow-hidden border-4 border-white group-hover:border-sky-300 transition-all duration-500">
                      {(empImage || myProfile?.emp_image) && !imgLoadError ? (
                        <img 
                          src={empImage || myProfile?.emp_image} 
                          alt={firstName ? `${firstName} ${lastName}` : 'Profile'} 
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" 
                          onError={() => setImgLoadError(true)}
                        />
                      ) : (
                        <span>
                          {firstName ? `${firstName.charAt(0).toUpperCase()}${lastName ? lastName.charAt(0).toUpperCase() : ''}` : (email ? email.charAt(0).toUpperCase() : 'M')}
                        </span>
                      )}
                      
                      {/* CAMERA HOVER OVERLAY */}
                      <div className="absolute inset-0 bg-slate-950/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center text-white text-[11px] font-black uppercase tracking-wider gap-1 backdrop-blur-2xs">
                        <Edit3 className="w-6 h-6 text-white drop-shadow-md" />
                        <span>Upload</span>
                      </div>

                      <span className="absolute top-2 right-2 h-4 w-4 rounded-full bg-emerald-400 border-2 border-white z-10 animate-pulse shadow-md shadow-emerald-400/50" title="Active Status" />
                    </div>

                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          compressImage(file, (base64) => {
                            setEmpImage(base64);
                            setImgLoadError(false);
                            setIsEditing(true);
                            triggerCustomToast('📸 Profile photo selected! Click "Save Changes" to apply.', 'info');
                          });
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

                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 text-xs font-medium text-white pt-2.5">
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

                {/* Right Side: QR Code Badge (Increased QR Code Size) */}
                <div className="shrink-0 flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => setShowIdCardModal(true)}
                    className="relative group bg-white p-2.5 rounded-2xl shadow-2xl border-2 border-white/80 hover:border-sky-300 transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer flex flex-col items-center"
                    title="Click to view & print Digital Employee ID Card"
                  >
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent((typeof window !== 'undefined' ? window.location.origin : 'https://newhrms.brihaspathi.in') + '/idcard/' + (myProfile?.emp_id_code || '101'))}`}
                      alt="Employee Verification QR Code"
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-contain"
                    />
                    <div className="absolute inset-0 bg-slate-950/65 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center text-white text-[10px] font-black uppercase tracking-wider gap-1 backdrop-blur-2xs p-1 text-center">
                      <QrCode className="w-5 h-5 text-sky-300" />
                      <span>ID Card</span>
                    </div>
                  </button>
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
                <User className="w-4 h-4" />
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
                <Building2 className="w-4 h-4" />
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
                <GraduationCap className="w-4 h-4" />
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
                <Zap className="w-4 h-4" />
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
                <ShieldCheck className="w-4 h-4" />
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
                <Lock className="w-4 h-4" />
                <span>Security & Account</span>
                {activeTab === 'security' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />}
              </button>
            </div>

            {/* Right Side: ICON-ONLY Edit Button at the end of the tabs bar */}
            <div className="shrink-0 flex items-center gap-2 pr-1">
              {!isEditing && canEditProfile ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="h-10 w-10 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition-all duration-300 shadow-md shadow-indigo-600/20 hover:scale-110 active:scale-95 cursor-pointer"
                  title="Edit Profile Details"
                >
                  <Edit3 className="w-4.5 h-4.5" />
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
              <div className={`${activeTab === 'overview' ? 'block' : 'hidden'} lg:block lg:col-span-1 space-y-6 text-left`}>
                
                <div className="rounded-3xl border border-indigo-100 dark:border-indigo-900/40 bg-white/90 dark:bg-slate-900/90 p-6 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 relative overflow-hidden group w-full space-y-5">
                  <div className="h-1 bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 absolute top-0 inset-x-0" />
                  
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                        <Pin className="w-4 h-4" />
                      </span>
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-white font-outfit">Quick Summary</h3>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 text-[10px] font-extrabold uppercase tracking-wider">
                      Verified
                    </span>
                  </div>

                  <div className="space-y-3 text-xs font-medium">
                    <div className="group/item flex items-center gap-3.5 p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50 hover:border-indigo-400/50 hover:bg-white dark:hover:bg-slate-800 transition-all duration-300">
                      <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-500/20 group-hover/item:scale-110 transition-transform">
                        <Mail className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[9.5px] font-extrabold uppercase text-slate-400 tracking-wider block mb-0.5">Work Email</span>
                        {isEditing ? (
                          <input
                            type="email"
                            value={workEmail || email}
                            onChange={e => setWorkEmail(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500"
                          />
                        ) : (
                          <span className="font-bold text-slate-800 dark:text-slate-100 truncate block select-all">{workEmail || email}</span>
                        )}
                      </div>
                    </div>

                    <div className="group/item flex items-center gap-3.5 p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50 hover:border-sky-400/50 hover:bg-white dark:hover:bg-slate-800 transition-all duration-300">
                      <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-sky-500/20 group-hover/item:scale-110 transition-transform">
                        <Phone className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[9.5px] font-extrabold uppercase text-slate-400 tracking-wider block mb-0.5">Primary Phone</span>
                        {isEditing ? (
                          <input
                            type="text"
                            maxLength={10}
                            value={phone}
                            onChange={e => setPhone(e.target.value.replace(/\s+/g, ''))}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500"
                          />
                        ) : (
                          <span className="font-bold text-slate-800 dark:text-slate-100 block">{phone || 'Not Provided'}</span>
                        )}
                      </div>
                    </div>

                    <div className="group/item flex items-center gap-3.5 p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50 hover:border-emerald-400/50 hover:bg-white dark:hover:bg-slate-800 transition-all duration-300">
                      <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20 group-hover/item:scale-110 transition-transform">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[9.5px] font-extrabold uppercase text-slate-400 tracking-wider block mb-0.5">Office Location</span>
                        <span className="font-bold text-slate-800 dark:text-slate-100 block">{myProfile?.branch_name || 'Not Specified'}</span>
                      </div>
                    </div>

                    <div className="group/item flex items-center gap-3.5 p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50 hover:border-purple-400/50 hover:bg-white dark:hover:bg-slate-800 transition-all duration-300">
                      <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-purple-500/20 group-hover/item:scale-110 transition-transform">
                        <Briefcase className="w-4 h-4" />
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
                    <div className="rounded-3xl border border-indigo-100 dark:border-indigo-900/40 bg-white/90 dark:bg-slate-900/90 p-6 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 relative overflow-visible group w-full z-10">
                      <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 absolute top-0 inset-x-0 rounded-t-3xl" />
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
                            <input type="text" maxLength={25} required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="premium-input" />
                          </div>
                          <div>
                            <label className="profile-custom-form-label">Last Name</label>
                            <input type="text" maxLength={25} required value={lastName} onChange={(e) => setLastName(e.target.value)} className="premium-input" />
                          </div>
                          <div>
                            <label className="profile-custom-form-label">Official Work Email</label>
                            <input type="email" maxLength={30} value={workEmail} onChange={(e) => setWorkEmail(e.target.value)} className="premium-input" />
                          </div>
                          <div>
                            <label className="profile-custom-form-label">Primary Phone Number</label>
                            <input type="text" maxLength={10} placeholder="e.g. 9876543210" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\s+/g, ''))} className="premium-input" />
                          </div>
                          <div>
                            <label className="profile-custom-form-label">Personal Email</label>
                            <input type="email" value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value)} className="premium-input" />
                          </div>
                          <div className="relative z-30">
                            <label className="profile-custom-form-label">Date of Birth</label>
                            <DatePickerSimple
                              value={dob}
                              onChange={(val) => setDob(val)}
                              maxDate={new Date()}
                              placeholder="Select date of birth"
                            />
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

      {/* 🎴 DIGITAL EMPLOYEE ID CARD MODAL (Portaled to document.body to cover 100% full viewport) */}
      {showIdCardModal && mounted && createPortal(
        <div 
          className="fixed inset-0 z-[999999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-fadeIn"
          onClick={() => setShowIdCardModal(false)}
        >
          <div 
            className="relative w-[95vw] max-w-sm sm:max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-[0_25px_90px_rgba(0,0,0,0.5)] border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col items-center animate-scaleUp max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Modal Header Actions */}
            <div className="w-full flex items-center justify-between px-6 py-4 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-xs shadow-md">
                  🎴
                </div>
                <div className="flex flex-col text-left leading-tight">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <span>Official Digital ID Card</span>
                    <span className="text-[8.5px] px-2 py-0.5 rounded-full bg-emerald-500 text-white font-mono font-extrabold shadow-2xs">VERIFIED</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">Official Employee Identity Pass</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-600 transition-all cursor-pointer shadow-2xs"
                  title="Print ID Card"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowIdCardModal(false)}
                  className="w-8 h-8 rounded-xl bg-slate-200/80 dark:bg-slate-700/80 hover:bg-rose-500 hover:text-white text-slate-500 transition-all cursor-pointer font-black flex items-center justify-center shadow-2xs"
                  title="Close Modal"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* 🎴 PHYSICAL ID CARD CONTAINER VIEW */}
            <div className="p-4 sm:p-6 w-full flex-1 overflow-y-auto no-scrollbar flex justify-center bg-slate-100/70 dark:bg-slate-950/70">
              
              <div className="w-[320px] sm:w-[345px] rounded-3xl border border-slate-300 dark:border-slate-700 bg-white text-slate-900 shadow-2xl overflow-hidden relative flex flex-col font-sans select-none border-t-4 border-t-blue-600 shrink-0">
                
                {/* 1. Header Section with Smooth Vector Curves & Branding Logo */}
                <div className="relative bg-[#07518a] pt-7 pb-16 px-4 text-center text-white overflow-hidden">
                  
                  {/* Background Decorative Vector Waves & Circles Pattern */}
                  <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
                    <div className="absolute -top-12 -left-12 w-56 h-56 rounded-full bg-sky-400/20 blur-xl" />
                    <div className="absolute -bottom-16 -right-16 w-60 h-60 rounded-full bg-cyan-300/15 blur-xl" />

                    <svg className="absolute inset-0 w-full h-full opacity-35" preserveAspectRatio="none" viewBox="0 0 400 160">
                      <path d="M -50 160 C 90 20, 260 180, 450 30 L 450 0 L -50 0 Z" fill="#ffffff" fillOpacity="0.1" />
                      <path d="M -20 0 C 130 140, 270 10, 420 120 L 420 0 Z" fill="#38bdf8" fillOpacity="0.1" />
                      <circle cx="60" cy="40" r="90" fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.25" />
                      <circle cx="340" cy="120" r="110" fill="none" stroke="#7dd3fc" strokeWidth="1" opacity="0.2" />
                    </svg>
                  </div>
                  
                  {/* Company Logo / Branding Header */}
                  <div className="relative z-10 flex flex-col items-center justify-center">
                    {companyDetails?.branding_logo ? (
                      <img 
                        src={companyDetails.branding_logo} 
                        alt="Company Branding Logo" 
                        className="max-h-12 max-w-[240px] object-contain drop-shadow-md brightness-0 invert"
                      />
                    ) : (
                      <div className="flex flex-col items-center">
                        <div className="flex items-center gap-1.5">
                          <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <circle cx="12" cy="12" r="9" strokeOpacity="0.4" />
                            <path d="M12 3a9 9 0 0 1 9 9 9 9 0 0 1-9 9" strokeLinecap="round" />
                          </svg>
                          <span className="text-xl font-black tracking-tight text-white drop-shadow-sm font-outfit uppercase">
                            Brihaspathi
                          </span>
                        </div>
                        <span className="text-[9px] text-blue-100 font-bold tracking-widest uppercase mt-0.5 opacity-90">
                          ...The Guru of Tomorrow's Technology
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Circular Photo Section & Card Body Background (NO overflow-hidden to prevent photo top clipping) */}
                <div className="relative bg-gradient-to-b from-slate-50 via-white to-sky-50/40 text-slate-900">
                  
                  {/* Centered Circular Employee Photo overlapping header cleanly */}
                  <div className="-mt-14 flex justify-center relative z-30">
                    <div className="w-32 h-32 rounded-full border-4 border-white bg-gradient-to-tr from-[#07518a] via-blue-600 to-sky-400 p-1 shadow-2xl flex items-center justify-center overflow-hidden shrink-0">
                      {(empImage || myProfile?.emp_image) && !imgLoadError ? (
                        <img 
                          src={empImage || myProfile?.emp_image} 
                          alt="Employee Portrait" 
                          className="w-full h-full rounded-full object-cover object-top"
                        />
                      ) : (
                        <div className="w-full h-full rounded-full bg-gradient-to-br from-[#07518a] to-blue-900 text-white font-black text-4xl flex items-center justify-center uppercase">
                          {firstName ? firstName.charAt(0) : (email ? email.charAt(0).toUpperCase() : 'R')}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 3. Employee Name & Designation */}
                  <div className="px-5 pt-3 pb-2 text-center flex flex-col items-center relative z-10">
                    <h2 className="text-xl font-black text-blue-950 tracking-tight leading-snug">
                      {firstName ? `${firstName} ${lastName}`.trim() : (myProfile?.first_name ? `${myProfile.first_name} ${myProfile.last_name}` : 'Rajasekhar Papolu')}
                    </h2>
                    <div className="w-16 h-0.5 bg-[#07518a] my-1.5 rounded-full opacity-80" />
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                      {myProfile?.designation_name || employmentType || 'MANAGING DIRECTOR'}
                    </span>
                  </div>

                  {/* 4. Blue Pill Box: ID No & Blood Group */}
                  <div className="px-5 my-2.5 relative z-10">
                    <div className="bg-[#07518a] text-white rounded-xl px-4 py-2.5 flex items-center justify-between shadow-md text-xs font-bold font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sky-200">ID No:</span>
                        <span className="text-white font-extrabold tracking-wider">
                          {myProfile?.emp_id_code || '101'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="text-rose-400 text-sm">🩸 :</span>
                        <span className="text-blue-100 font-extrabold">
                          {bloodGroup || myProfile?.blood_group ? (bloodGroup.includes('Ve') ? bloodGroup : `${bloodGroup} Ve`) : 'A+ Ve'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 5. Issuing Authority Cursive Green Signature Section */}
                  <div className="px-5 pt-1 pb-3 flex flex-col items-end text-right relative z-10">
                    <div className="h-9 w-28 flex items-center justify-end pr-1">
                      <svg className="w-full h-full text-emerald-600" viewBox="0 0 120 40" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M 22 28 C 12 18, 20 8, 28 14 C 36 20, 26 34, 34 34 C 44 34, 38 20, 48 20 C 56 20, 52 32, 62 30 C 72 28, 78 16, 88 22 C 94 26, 100 20, 106 23" />
                        <path d="M 60 28 L 92 28" />
                      </svg>
                    </div>
                    <span className="text-[9.5px] font-extrabold text-[#07518a] uppercase tracking-wider border-t border-slate-300/80 pt-0.5 mt-0.5">
                      Issuing Authority
                    </span>
                  </div>
                </div>

                {/* 6. Bottom Blue Footer Banner */}
                <div className="bg-[#07518a] text-white p-3.5 text-center text-[9px] leading-snug font-sans space-y-1.5 relative overflow-hidden">
                  {/* Subtly curved light glow behind footer */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-sky-400/10 rounded-full blur-xl pointer-events-none" />

                  <p className="font-extrabold text-[11px] tracking-wide uppercase relative z-10">
                    {companyDetails?.name || 'Brihaspathi Technologies Limited'}
                  </p>
                  <p className="text-[8.5px] text-sky-200 font-medium italic relative z-10">
                    (Formerly known as Brihaspathi Technologies Private Limited)
                  </p>
                  <p className="font-semibold text-blue-100 text-[9px] relative z-10">
                    Toll Free: 1800 296 8899, Phone: +91-9989994488
                  </p>
                  <p className="font-extrabold text-sky-200 hover:underline cursor-pointer text-[9.5px] relative z-10">
                    www.brihaspathi.com
                  </p>

                  {/* 2-Column Side-by-Side Office Addresses */}
                  <div className="border-t border-sky-300/30 pt-1.5 grid grid-cols-2 gap-2 text-left text-[8px] sm:text-[8.5px] leading-tight text-blue-100 relative z-10">
                    <div className="space-y-0.5">
                      <span className="font-extrabold text-white block uppercase tracking-wide border-b border-sky-300/30 pb-0.5 mb-1">Corporate Office</span>
                      <p className="opacity-95">#501, #508-510, Shangrila Plaza, Road No. 2, Banjara Hills, Hyd - 34</p>
                    </div>
                    <div className="space-y-0.5 border-l border-sky-300/30 pl-2">
                      <span className="font-extrabold text-white block uppercase tracking-wide border-b border-sky-300/30 pb-0.5 mb-1">Registered Office</span>
                      <p className="opacity-95">#7-1-621/259, Sahithi Arcade, V Floor, S R Nagar, Hyd -38</p>
                    </div>
                  </div>
                </div>

              </div>

            </div>

          </div>
        </div>,
        document.body
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
