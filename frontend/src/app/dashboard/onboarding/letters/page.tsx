'use client';

import React, { useState, useEffect, useRef } from 'react';
import DashboardPageHeader from '../../components/DashboardPageHeader';
import { useDashboard } from '../../components/DashboardContext';
import {
  FileText,
  Printer,
  Mail,
  Edit3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
  Sparkles,
  User,
  Users,
  Send,
  Building2,
  Check,
  Search,
  ChevronDown,
  Bookmark,
  CheckSquare,
  Square,
  Award,
  Briefcase,
  FileCheck,
  Sliders,
  Type,
  Eye,
  Plus
} from 'lucide-react';

interface LetterPreset {
  id: string;
  name: string;
  category: string;
  subject: string;
  body: string;
  signatory: string;
  title: string;
  icon: React.ReactNode;
}

export default function SingleRowTemplatesLettersPage() {
  const { showToast, companyId } = useDashboard();
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  // Company Branding State (Fetched dynamically from companies table)
  const [companyLogo, setCompanyLogo] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('Brihaspathi Technologies Limited');

  // Selected Preset ID
  const [activePresetId, setActivePresetId] = useState<string>('appointment');

  // Multi-Select & Searchable Employee Selection State
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([]);
  const [empDropdownOpen, setEmpDropdownOpen] = useState(false);
  const [empSearchTerm, setEmpSearchTerm] = useState('');

  // Primary Active Employee Details State for Paper Fill
  const [targetEmp, setTargetEmp] = useState({
    name: 'ZAHID',
    code: '10015',
    designation: 'Software Engineer',
    joiningDate: '2024-05-15',
    effectiveDate: new Date().toISOString().split('T')[0],
    salary: '7,50,000',
    email: 'zahid@brihaspathi.com',
    address: 'Hyderabad, Telangana, India'
  });

  // Header & Document Style Controls
  const [headerStyle, setHeaderStyle] = useState<'FULL' | 'CENTER_LOGO' | 'MINIMAL'>('FULL');
  const [fontFamily, setFontFamily] = useState<'font-sans' | 'font-serif' | 'font-mono'>('font-sans');
  const [subjectAlign, setSubjectAlign] = useState<'text-left' | 'text-center' | 'text-right'>('text-center');

  // Formatting States
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(true);

  // Element Show/Hide Toggles
  const [showHeaderLogo, setShowHeaderLogo] = useState(true);
  const [showHeaderAddress, setShowHeaderAddress] = useState(true);
  const [showSeparatorLine, setShowSeparatorLine] = useState(true);
  const [showRefAndDate, setShowRefAndDate] = useState(true);
  const [showOfficialStamp, setShowOfficialStamp] = useState(true);

  // Email Modal State
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('zahid@brihaspathi.com');
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Content Editable Ref & Dropdown Ref
  const letterPaperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Presets Definition
  const letterPresets: LetterPreset[] = [
    {
      id: 'appointment',
      name: 'Appointment Letter',
      category: 'Onboarding',
      icon: <FileCheck className="w-4 h-4" />,
      subject: 'LETTER OF APPOINTMENT - {emp_id_code}',
      body: `Dear {employee_name},

Further to your acceptance of our offer, we take pleasure in appointing you as {designation} at {company_name} effective from {joining_date}.

Terms and Conditions:
1. Probation Period: You will be on probation for a period of 6 months from your date of joining.
2. Code of Conduct: You shall abide by the policies, rules, and regulations enforced by the organization from time to time.
3. Compensation: Your total annual compensation (CTC) will be Rs. {salary} /- per annum as agreed upon.
4. Confidentiality: You will maintain strict confidentiality regarding all official matters, trade secrets, and operational strategies.

We welcome you on board and wish you a successful career with us. Please sign and return the duplicate copy of this letter as a token of your acceptance.

Yours sincerely,`,
      signatory: 'Rajasekhar Papolu',
      title: 'Managing Director'
    },
    {
      id: 'offer',
      name: 'Offer Letter',
      category: 'Recruitment',
      icon: <Briefcase className="w-4 h-4" />,
      subject: 'EMPLOYMENT OFFER LETTER - {designation}',
      body: `Dear {employee_name},

We are pleased to offer you employment for the position of {designation} at {company_name}. 

Key Employment Details:
• Position / Designation: {designation}
• Employee Code: {emp_id_code}
• Date of Joining: {joining_date}
• Total Annual CTC: Rs. {salary} /- per annum

Please review and return a signed copy of this letter on or before {joining_date}.

Warm regards,`,
      signatory: 'Human Resource Manager',
      title: 'Head of Operations'
    },
    {
      id: 'experience',
      name: 'Relieving & Experience',
      category: 'Offboarding',
      icon: <Award className="w-4 h-4" />,
      subject: 'RELIEVING & EXPERIENCE CERTIFICATE - {employee_name}',
      body: `TO WHOMSOEVER IT MAY CONCERN

This is to certify that {employee_name} (Employee Code: {emp_id_code}) was employed with {company_name} as {designation} from {joining_date} to {effective_date}.

During their tenure with us, we found {employee_name} to be sincere, hardworking, and dedicated. All organization dues have been cleared.

We relieve {employee_name} from their duties with effect from {effective_date} and wish them success in all future endeavors.

For {company_name},`,
      signatory: 'HR Operations Manager',
      title: 'Human Resources Department'
    },
    {
      id: 'increment',
      name: 'Salary Revision Letter',
      category: 'Compensation',
      icon: <Sparkles className="w-4 h-4" />,
      subject: 'SALARY REVISION & COMPENSATION REVISION - {effective_date}',
      body: `Dear {employee_name},

In recognition of your exceptional performance and valuable contributions to {company_name}, we are delighted to revise your compensation package.

Effective Date: {effective_date}
Revised Designation: {designation}
New Annual CTC: Rs. {salary} /- per annum

Your continued dedication and passion have been key drivers of our team's success. Congratulations and best wishes!

Sincerely,`,
      signatory: 'Executive Management',
      title: 'Chief People Officer'
    }
  ];

  useEffect(() => {
    const storedRoles = localStorage.getItem('roles');
    const storedEmail = localStorage.getItem('email');
    if (storedRoles) {
      try { setRoles(JSON.parse(storedRoles)); } catch (e) {}
    }
    if (storedEmail) setEmail(storedEmail);

    fetchCompanyBranding();
    fetchEmployees();
  }, [companyId]);

  // Fetch Company Branding Logo from companies table
  const fetchCompanyBranding = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const cid = companyId || localStorage.getItem('companyId');
      const res = await fetch(`/api/v1/companies`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const list: Array<{ id: string; name: string; branding_logo: string }> = data.companies || [];
        const match = list.find(c => c.id === cid) || list[0];
        if (match) {
          if (match.branding_logo) setCompanyLogo(match.branding_logo);
          if (match.name) setCompanyName(match.name);
        }
      }
    } catch (e) {}
  };

  // Click outside listener for employee dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setEmpDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const cid = companyId || 'all';
      const res = await fetch(`/api/v1/employees?companyId=${cid}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const list = data.employees || [];
        setEmployees(list);
        if (list.length > 0) {
          const first = list[0];
          setSelectedEmpIds([first.id]);
          updateTargetEmployee(first);
        }
      }
    } catch (e) {}
  };

  const updateTargetEmployee = (emp: any) => {
    const name = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Employee';
    setTargetEmp({
      name,
      code: emp.emp_id_code || '10015',
      designation: emp.designation_name || 'Software Engineer',
      joiningDate: emp.date_of_joining ? String(emp.date_of_joining).split('T')[0] : '2024-05-15',
      effectiveDate: new Date().toISOString().split('T')[0],
      salary: '7,50,000',
      email: emp.email || 'zahid@brihaspathi.com',
      address: 'Hyderabad, Telangana, India'
    });
    if (emp.email) setRecipientEmail(emp.email);
  };

  // Toggle Single Employee Selection
  const toggleEmployeeSelect = (empId: string) => {
    setSelectedEmpIds(prev => {
      let updated: string[];
      if (prev.includes(empId)) {
        updated = prev.filter(id => id !== empId);
      } else {
        updated = [...prev, empId];
      }

      if (updated.length > 0) {
        const primaryEmp = employees.find(e => e.id === updated[0]);
        if (primaryEmp) updateTargetEmployee(primaryEmp);
      }
      return updated;
    });
  };

  // Select All Employees
  const handleSelectAllEmployees = () => {
    if (selectedEmpIds.length === employees.length) {
      setSelectedEmpIds([]);
    } else {
      const allIds = employees.map(e => e.id);
      setSelectedEmpIds(allIds);
      if (employees.length > 0) updateTargetEmployee(employees[0]);
    }
  };

  // Filtered Employees List
  const filteredEmployees = employees.filter(emp => {
    const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.toLowerCase();
    const code = (emp.emp_id_code || '').toLowerCase();
    const desig = (emp.designation_name || '').toLowerCase();
    const q = empSearchTerm.toLowerCase();
    return fullName.includes(q) || code.includes(q) || desig.includes(q);
  });

  // Switch Letter Preset
  const handleSelectPreset = (preset: LetterPreset) => {
    setActivePresetId(preset.id);
    showToast(`Loaded ${preset.name} template`, 'info');
  };

  // Rich Text Execute Command
  const executeCommand = (cmd: string, val: string = '') => {
    document.execCommand(cmd, false, val);
  };

  // Toggle Underline Workaround
  const handleToggleUnderline = () => {
    setIsUnderline(prev => !prev);
    executeCommand('underline');
  };

  // Insert Variable at Current Caret position
  const insertVariable = (varKey: string) => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && letterPaperRef.current?.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const node = document.createTextNode(varKey);
      range.insertNode(node);
      range.setStartAfter(node);
      range.setEndAfter(node);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      executeCommand('insertText', varKey);
    }
    showToast(`Inserted ${varKey}`, 'success');
  };

  // Replace all variable placeholders on paper with targetEmp details
  const autofillPaperData = () => {
    if (!letterPaperRef.current) return;
    let html = letterPaperRef.current.innerHTML;
    html = html
      .replace(/{employee_name}/g, targetEmp.name)
      .replace(/{emp_id_code}/g, targetEmp.code)
      .replace(/{designation}/g, targetEmp.designation)
      .replace(/{joining_date}/g, targetEmp.joiningDate)
      .replace(/{effective_date}/g, targetEmp.effectiveDate)
      .replace(/{salary}/g, targetEmp.salary)
      .replace(/{company_name}/g, companyName || 'Brihaspathi Technologies Limited');
    
    letterPaperRef.current.innerHTML = html;
    showToast(`Autofilled employee details for ${targetEmp.name}!`, 'success');
  };

  // Action: Print / PDF
  const handlePrint = () => {
    window.print();
  };

  // Action: Email Mock
  const handleSendEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSendingEmail(true);
    setTimeout(() => {
      setIsSendingEmail(false);
      setEmailModalOpen(false);
      showToast(`Letter emailed successfully to ${selectedEmpIds.length > 1 ? `${selectedEmpIds.length} employees` : recipientEmail}!`, 'success');
    }, 1200);
  };

  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('superadmin');
  const activePreset = letterPresets.find(p => p.id === activePresetId) || letterPresets[0];
  const companyInitial = (companyName || 'Brihaspathi Technologies Limited').charAt(0).toUpperCase();

  return (
    <div className="space-y-5 pb-24 font-sans text-slate-800 dark:text-slate-100">

      {/* 📄 PAGE HEADER (Hidden on print) */}
      <div className="print:hidden">
        <DashboardPageHeader
          title="Custom Letter & Document Studio"
          companyId={companyId}
          isSuperAdmin={isSuperAdmin}
          email={email}
          hideCompanySelect={true}
          hideUserBadge={true}
        >
          <div className="flex items-center gap-2">
            <button
              onClick={autofillPaperData}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Autofill Employee Data</span>
            </button>

            <button
              onClick={() => setEmailModalOpen(true)}
              className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Mail className="w-4 h-4" />
              <span>Email Letter ({selectedEmpIds.length})</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save PDF</span>
            </button>
          </div>
        </DashboardPageHeader>
      </div>

      {/* 🔖 SINGLE ROW LETTER TEMPLATES BAR (At Top in Single Row) (Hidden on print) */}
      <div className="print:hidden bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-2.5 shadow-xs flex items-center justify-between gap-3 overflow-x-auto">
        <div className="flex items-center gap-2 shrink-0 px-2 text-xs font-extrabold text-slate-400 uppercase tracking-wider">
          <Bookmark className="w-4 h-4 text-indigo-500" /> Letter Templates:
        </div>

        <div className="flex items-center gap-2 overflow-x-auto flex-1">
          {letterPresets.map(preset => {
            const isSel = preset.id === activePresetId;
            return (
              <button
                key={preset.id}
                onClick={() => handleSelectPreset(preset)}
                className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 flex-1 justify-center ${
                  isSel
                    ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-400/30 font-extrabold'
                    : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300'
                }`}
              >
                <span className={isSel ? 'text-white' : 'text-indigo-500 dark:text-indigo-400'}>
                  {preset.icon}
                </span>
                <span>{preset.name}</span>
                {isSel && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 📐 2-COLUMN STUDIO LAYOUT: Left Control Panel Sidebar + Right A4 Paper Desk */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* 👈 LEFT COLUMN: CONTROL PANEL SIDEBAR (4 cols on lg, 4 cols on xl) (Hidden on print) */}
        <div className="print:hidden lg:col-span-4 xl:col-span-4 space-y-4">

          {/* SECTION 1: SEARCHABLE MULTI-SELECT TARGET EMPLOYEES */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 shadow-xs space-y-2.5 relative" ref={dropdownRef}>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-500" /> Target Employee(s)
              </span>
              <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950">
                {selectedEmpIds.length} Selected
              </span>
            </div>

            {/* Custom Multi-Select Dropdown Trigger Button */}
            <div
              onClick={() => setEmpDropdownOpen(!empDropdownOpen)}
              className="w-full min-h-[38px] p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold flex items-center justify-between cursor-pointer hover:border-indigo-300 transition-all shadow-2xs"
            >
              <div className="flex items-center gap-1.5 flex-wrap max-w-[90%] truncate">
                {selectedEmpIds.length === 0 ? (
                  <span className="text-slate-400 italic">Select employees for letter...</span>
                ) : selectedEmpIds.length === 1 ? (
                  <span className="text-indigo-600 dark:text-indigo-400 font-extrabold truncate">
                    {targetEmp.code} - {targetEmp.name} ({targetEmp.designation})
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-lg bg-indigo-600 text-white font-extrabold text-[11px]">
                    {selectedEmpIds.length} Employees Selected (Bulk Mode)
                  </span>
                )}
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${empDropdownOpen ? 'rotate-180 text-indigo-600' : ''}`} />
            </div>

            {/* SEARCHABLE MULTI-SELECT POPUP PANEL */}
            {empDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-2.5 space-y-2 animate-fadeIn max-h-72 flex flex-col">
                
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      autoFocus
                      placeholder="Search name, emp code..."
                      value={empSearchTerm}
                      onChange={e => setEmpSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-xs rounded-xl font-medium focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSelectAllEmployees}
                    className="px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 text-[11px] font-extrabold rounded-lg hover:bg-indigo-100 transition-all shrink-0"
                  >
                    {selectedEmpIds.length === employees.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                <div className="overflow-y-auto space-y-1 flex-1 pr-1">
                  {filteredEmployees.map(emp => {
                    const isChecked = selectedEmpIds.includes(emp.id);
                    return (
                      <div
                        key={emp.id}
                        onClick={() => toggleEmployeeSelect(emp.id)}
                        className={`p-2 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center justify-between ${
                          isChecked
                            ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-900 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600 shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300 shrink-0" />
                          )}
                          <div className="truncate">
                            <span className="block truncate font-extrabold">
                              {emp.first_name} {emp.last_name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono block">
                              {emp.emp_id_code || 'EMP-101'} • {emp.designation_name || 'Staff'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {filteredEmployees.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-4">No employees found matching search</p>
                  )}
                </div>

              </div>
            )}
          </div>

          {/* SECTION 2: HEADER STYLE SWITCHER */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 shadow-xs space-y-2.5">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-indigo-500" /> Header Layout Style
            </span>
            <div className="grid grid-cols-1 gap-1.5 pt-1">
              <button
                onClick={() => setHeaderStyle('FULL')}
                className={`py-2 px-3 text-xs font-extrabold rounded-xl transition-all text-left flex items-center justify-between ${
                  headerStyle === 'FULL'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <span>Full (Logo, Address & Line)</span>
                {headerStyle === 'FULL' && <Check className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setHeaderStyle('CENTER_LOGO')}
                className={`py-2 px-3 text-xs font-extrabold rounded-xl transition-all text-left flex items-center justify-between ${
                  headerStyle === 'CENTER_LOGO'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <span>Centered Logo Only (No Line)</span>
                {headerStyle === 'CENTER_LOGO' && <Check className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setHeaderStyle('MINIMAL')}
                className={`py-2 px-3 text-xs font-extrabold rounded-xl transition-all text-left flex items-center justify-between ${
                  headerStyle === 'MINIMAL'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <span>Minimal Inline Header</span>
                {headerStyle === 'MINIMAL' && <Check className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* SECTION 3: TYPOGRAPHY & ALIGNMENT CONTROLS */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 shadow-xs space-y-3">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-indigo-500" /> Typography & Formatting
            </span>

            <div className="space-y-2">
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">Font Family</label>
                <select
                  value={fontFamily}
                  onChange={e => setFontFamily(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold focus:outline-none"
                >
                  <option value="font-sans">Modern Sans-Serif</option>
                  <option value="font-serif">Classic Serif</option>
                  <option value="font-mono">Technical Monospace</option>
                </select>
              </div>

              {/* B I U Buttons */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex-1">
                  <button
                    onClick={() => {
                      setIsBold(!isBold);
                      executeCommand('bold');
                    }}
                    className={`flex-1 py-1.5 rounded-lg flex items-center justify-center font-black text-xs cursor-pointer transition-all ${
                      isBold ? 'bg-indigo-600 text-white shadow-xs' : 'hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                    }`}
                    title="Bold Text"
                  >
                    <Bold className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      setIsItalic(!isItalic);
                      executeCommand('italic');
                    }}
                    className={`flex-1 py-1.5 rounded-lg flex items-center justify-center font-bold text-xs cursor-pointer transition-all ${
                      isItalic ? 'bg-indigo-600 text-white shadow-xs' : 'hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                    }`}
                    title="Italic Text"
                  >
                    <Italic className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleToggleUnderline}
                    className={`flex-1 py-1.5 rounded-lg flex items-center justify-center font-bold text-xs cursor-pointer transition-all ${
                      isUnderline ? 'bg-indigo-600 text-white shadow-xs' : 'hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                    }`}
                    title="Toggle Underline"
                  >
                    <Underline className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Subject Line Alignment Toggle */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">Subject Line Alignment</label>
                <div className="grid grid-cols-3 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1">
                  <button
                    onClick={() => setSubjectAlign('text-left')}
                    className={`py-1.5 rounded-lg flex items-center justify-center text-xs transition-all ${
                      subjectAlign === 'text-left' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <AlignLeft className="w-3.5 h-3.5 mr-1" /> Left
                  </button>
                  <button
                    onClick={() => setSubjectAlign('text-center')}
                    className={`py-1.5 rounded-lg flex items-center justify-center text-xs transition-all ${
                      subjectAlign === 'text-center' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <AlignCenter className="w-3.5 h-3.5 mr-1" /> Center
                  </button>
                  <button
                    onClick={() => setSubjectAlign('text-right')}
                    className={`py-1.5 rounded-lg flex items-center justify-center text-xs transition-all ${
                      subjectAlign === 'text-right' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <AlignRight className="w-3.5 h-3.5 mr-1" /> Right
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* SECTION 4: SHOW / HIDE ELEMENT TOGGLES */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 shadow-xs space-y-2.5">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-indigo-500" /> Show / Hide Paper Elements
            </span>
            <div className="grid grid-cols-2 gap-2 pt-1 text-xs font-extrabold">
              {[
                { label: 'Logo', state: showHeaderLogo, setter: setShowHeaderLogo },
                { label: 'Address', state: showHeaderAddress, setter: setShowHeaderAddress },
                { label: 'Black Line', state: showSeparatorLine, setter: setShowSeparatorLine },
                { label: 'Ref No & Date', state: showRefAndDate, setter: setShowRefAndDate },
                { label: 'Official Seal', state: showOfficialStamp, setter: setShowOfficialStamp }
              ].map(item => (
                <button
                  key={item.label}
                  onClick={() => item.setter(!item.state)}
                  className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between text-[11.5px] ${
                    item.state
                      ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800 shadow-2xs'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 opacity-60'
                  }`}
                >
                  <span>{item.label}</span>
                  <span className={`w-2 h-2 rounded-full ${item.state ? 'bg-indigo-600 animate-pulse' : 'bg-slate-400'}`} />
                </button>
              ))}
            </div>
          </div>

          {/* SECTION 5: DYNAMIC VARIABLE INSERTION PILLS */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 shadow-xs space-y-2.5">
            <span className="text-[11px] font-extrabold uppercase text-indigo-600 dark:text-indigo-400 block">
              ⚡ Insert Variable at Caret:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: '+ Name', val: '{employee_name}' },
                { label: '+ Emp ID', val: '{emp_id_code}' },
                { label: '+ Role', val: '{designation}' },
                { label: '+ Joining Date', val: '{joining_date}' },
                { label: '+ Salary', val: '{salary}' },
                { label: '+ Company', val: '{company_name}' }
              ].map(item => (
                <button
                  key={item.val}
                  type="button"
                  onClick={() => insertVariable(item.val)}
                  className="px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[11px] font-extrabold border border-indigo-200 dark:border-indigo-800 transition-all cursor-pointer shadow-2xs"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* 👉 RIGHT COLUMN: REAL A4 STUDIO PAPER DESK (8 cols on lg, 8 cols on xl) */}
        <div className="lg:col-span-8 xl:col-span-8 print:m-0 print:p-0 flex flex-col items-center bg-slate-100/70 dark:bg-slate-950/60 p-6 sm:p-10 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-inner min-h-[1050px] relative">
          
          {/* Desk Header Badge */}
          <div className="print:hidden w-full max-w-[800px] flex items-center justify-between mb-4 text-xs font-bold text-slate-500 px-1">
            <span className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
              <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Direct Paper Canvas — Click ANY text below to edit directly</span>
            </span>
            <span className="bg-white dark:bg-slate-900 px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-800 font-mono">
              Standard A4 Paper (8.27" x 11.69")
            </span>
          </div>

          {/* 📄 THE ULTRA-CRISP A4 PAPER SHEET */}
          <div
            ref={letterPaperRef}
            contentEditable={true}
            suppressContentEditableWarning={true}
            className={`w-full max-w-[800px] min-h-[1050px] bg-white text-slate-900 p-10 sm:p-14 shadow-2xl rounded-sm border border-slate-200 relative flex flex-col justify-between focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all ${fontFamily} print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-none print:w-full`}
          >
            
            {/* TOP DOCUMENT HEADER */}
            <div className="space-y-4">
              
              {/* HEADER LAYOUT VARIATIONS (WITH DYNAMIC BRANDING LOGO & FALLBACK) */}
              {headerStyle === 'CENTER_LOGO' ? (
                /* CENTERED LOGO ONLY (NO ADDRESS, NO LINE) */
                <div className="flex flex-col items-center justify-center text-center pb-4 space-y-2">
                  {showHeaderLogo && (
                    companyLogo ? (
                      <img
                        src={companyLogo}
                        alt={companyName}
                        onError={() => setCompanyLogo('')}
                        className="h-16 max-w-[220px] object-contain mb-2"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-indigo-900 text-white font-black text-3xl flex items-center justify-center font-sans shadow-md">
                        {companyInitial}
                      </div>
                    )
                  )}
                  <h1 className="text-2xl font-black tracking-tight text-slate-900 font-sans uppercase">
                    {companyName}
                  </h1>
                  <p className="text-xs text-slate-600 font-sans font-medium">
                    Enterprise HRMS & Digital Solutions Division
                  </p>
                </div>
              ) : headerStyle === 'MINIMAL' ? (
                /* MINIMAL INLINE HEADER */
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <div className="flex items-center gap-3">
                    {showHeaderLogo && (
                      companyLogo ? (
                        <img
                          src={companyLogo}
                          alt={companyName}
                          onError={() => setCompanyLogo('')}
                          className="h-10 max-w-[150px] object-contain"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-indigo-900 text-white font-black text-xl flex items-center justify-center font-sans shadow-sm">
                          {companyInitial}
                        </div>
                      )
                    )}
                    <div>
                      <h1 className="text-lg font-black text-slate-900 font-sans uppercase">
                        {companyName}
                      </h1>
                      <p className="text-[10px] text-slate-500 font-sans">Official Communication</p>
                    </div>
                  </div>
                </div>
              ) : (
                /* STANDARD FULL HEADER (WITH LOGO, ADDRESS & LINE) */
                <div className={`space-y-4 ${showSeparatorLine ? 'border-b-2 border-slate-900 pb-5' : 'pb-3'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {showHeaderLogo && (
                        companyLogo ? (
                          <img
                            src={companyLogo}
                            alt={companyName}
                            onError={() => setCompanyLogo('')}
                            className="h-12 max-w-[180px] object-contain"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-indigo-900 text-white font-black text-2xl flex items-center justify-center font-sans shadow-md">
                            {companyInitial}
                          </div>
                        )
                      )}
                      <div>
                        <h1 className="text-xl font-black tracking-tight text-slate-900 font-sans uppercase">
                          {companyName}
                        </h1>
                        <p className="text-[11px] text-slate-600 font-sans font-medium">
                          Enterprise HRMS & Digital Solutions Division
                        </p>
                      </div>
                    </div>

                    {showHeaderAddress && (
                      <div className="text-right text-[10.5px] text-slate-600 font-sans leading-tight">
                        <p className="font-bold text-slate-900">Corporate HQ</p>
                        <p>Plot No: 12, Tech Enclave, Hitec City</p>
                        <p>Hyderabad, Telangana - 500081</p>
                        <p className="mt-1 font-semibold text-indigo-700">www.brihaspathi.com</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* DATE & REF NUMBER ROW */}
              {showRefAndDate && (
                <div className="flex items-center justify-between text-xs font-sans text-slate-700 font-semibold pt-1">
                  <div>
                    <span className="text-slate-400 font-normal">Ref No: </span>
                    <span className="font-bold font-mono">BTL/HR/2026/042</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-normal">Date: </span>
                    <span className="font-bold">{new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>
                </div>
              )}

              {/* RECIPIENT ADDRESS BLOCK */}
              <div className="pt-3 text-xs font-sans space-y-0.5 text-slate-800">
                <p className="font-bold text-sm text-slate-950">{targetEmp.name}</p>
                <p className="text-slate-600 font-medium">Employee Code: <span className="font-bold text-slate-900 font-mono">{targetEmp.code}</span></p>
                <p className="text-slate-600 font-medium">{targetEmp.designation}</p>
                <p className="text-slate-500">{targetEmp.address}</p>
              </div>

              {/* SUBJECT LINE (Alignable & Dynamic Underline Fix) */}
              <div className="py-3">
                <h3 className={`text-xs font-bold font-sans uppercase text-slate-900 tracking-wide ${subjectAlign} ${isUnderline ? 'underline underline-offset-4' : ''}`}>
                  SUBJECT: {activePreset.subject.replace('{emp_id_code}', targetEmp.code).replace('{employee_name}', targetEmp.name).replace('{designation}', targetEmp.designation)}
                </h3>
              </div>

              {/* DIRECTLY EDITABLE LETTER BODY CONTENT */}
              <div className="text-xs leading-relaxed text-slate-800 space-y-3 pt-1">
                <p>Dear {targetEmp.name},</p>
                
                <p>
                  Further to your acceptance of our offer, we take pleasure in appointing you as <strong>{targetEmp.designation}</strong> at <strong>{companyName}</strong> effective from <strong>{targetEmp.joiningDate}</strong>.
                </p>

                <p className="font-bold text-slate-900 pt-1">Terms and Conditions:</p>
                <ol className="list-decimal pl-5 space-y-1.5 text-slate-700">
                  <li><strong>Probation Period:</strong> You will be on probation for a period of 6 months from your date of joining.</li>
                  <li><strong>Code of Conduct:</strong> You shall abide by the policies, rules, and regulations enforced by the organization from time to time.</li>
                  <li><strong>Compensation:</strong> Your total annual compensation (CTC) will be <strong>Rs. {targetEmp.salary} /-</strong> per annum as agreed upon.</li>
                  <li><strong>Confidentiality:</strong> You will maintain strict confidentiality regarding all official matters, trade secrets, and operational strategies.</li>
                </ol>

                <p className="pt-2">
                  We welcome you on board and wish you a successful career with us. Please sign and return the duplicate copy of this letter as a token of your acceptance.
                </p>

                <p className="pt-2 font-medium">Yours sincerely,</p>
              </div>

            </div>

            {/* BOTTOM SIGN-OFF & STAMP SECTION */}
            <div className="pt-12 space-y-6">
              
              <div className="flex items-end justify-between font-sans">
                {/* Signature Block */}
                <div className="space-y-2">
                  <div className="h-12 flex items-center">
                    <div className="font-serif italic text-indigo-900 text-lg font-bold opacity-80 border-b border-dashed border-slate-300 pb-1">
                      {activePreset.signatory}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-900">{activePreset.signatory}</p>
                    <p className="text-[11px] font-semibold text-slate-500">{activePreset.title}</p>
                    <p className="text-[10px] font-bold text-indigo-900">{companyName}</p>
                  </div>
                </div>

                {/* Official Seal Emblem */}
                {showOfficialStamp && (
                  <div className="w-24 h-24 rounded-full border-2 border-indigo-900/40 p-1 flex items-center justify-center text-center opacity-70 rotate-[-12deg]">
                    <div className="w-full h-full rounded-full border border-dashed border-indigo-900 flex flex-col items-center justify-center p-1">
                      <span className="text-[8px] font-black uppercase text-indigo-950 tracking-tighter">OFFICIAL SEAL</span>
                      <span className="text-[9px] font-bold text-indigo-900">★ {companyInitial} ★</span>
                      <span className="text-[7.5px] text-indigo-900 font-semibold">HYDERABAD</span>
                    </div>
                  </div>
                )}
              </div>

              {/* FOOTER DISCLAIMER BAR */}
              <div className="border-t border-slate-200 pt-3 flex items-center justify-between text-[9.5px] font-sans text-slate-400">
                <p>Confidential & Proprietary • {companyName}</p>
                <p>Page 1 of 1</p>
              </div>

            </div>

          </div>

        </div>

      </div>

      {/* ✉️ EMAIL MODAL (Hidden on print) */}
      {emailModalOpen && (
        <div className="print:hidden fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center font-bold">
                  <Mail className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                  Email Custom Letter ({selectedEmpIds.length} Selected)
                </h3>
              </div>
              <button
                onClick={() => setEmailModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendEmailSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Recipient Email(s)
                </label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={e => setRecipientEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none font-medium"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Email Subject Line
                </label>
                <input
                  type="text"
                  value={`Official Letter: Appointment Letter - ${targetEmp.code}`}
                  readOnly
                  className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium"
                />
              </div>

              <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900 text-xs text-indigo-900 dark:text-indigo-300 space-y-1">
                <p className="font-bold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Exact Paper Rendering Attached
                </p>
                <p className="text-[11px] text-indigo-700 dark:text-indigo-400">
                  Your customized paper canvas text, fonts, alignments, and logos will be rendered into an official PDF document attached to this email.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSendingEmail}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSendingEmail ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Email ({selectedEmpIds.length})</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setEmailModalOpen(false)}
                  className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
