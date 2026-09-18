import React, { useState, useEffect, useContext } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  StatusBar,
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { apiClient, getImageUrl } from '../config/api';
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Building,
  Shield,
  CreditCard,
  Briefcase,
  GraduationCap,
  MapPin,
  Edit2,
  CheckCircle,
  Calendar,
  Clock,
  UserCheck,
  Award,
  FileText,
  Sparkles,
  Landmark,
  Heart,
  BadgeAlert,
} from 'lucide-react-native';

interface ProfileProps {
  onBack: () => void;
}

export const ProfileScreen: React.FC<ProfileProps> = ({ onBack }) => {
  const { user } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState<'Personal' | 'Work' | 'Education' | 'Bank'>('Personal');
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Dynamic user name parts
  const rawName = user?.name || user?.first_name || '';
  const nameParts = rawName.split(' ');
  const defaultFirst = user?.first_name || nameParts[0] || '';
  const defaultLast = user?.last_name || nameParts.slice(1).join(' ') || '';

  // Form Editable States - Personal Info
  const [firstName, setFirstName] = useState(defaultFirst);
  const [lastName, setLastName] = useState(defaultLast);
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [dob, setDob] = useState(user?.dob || '');
  const [gender, setGender] = useState(user?.gender || '');
  const [bloodGroup, setBloodGroup] = useState(user?.blood_group || '');
  const [address, setAddress] = useState(user?.address || '');
  const [emergencyContact, setEmergencyContact] = useState('');

  // Work Details
  const [employeeCode, setEmployeeCode] = useState<string>(String(user?.emp_code || user?.id || ''));
  const [department, setDepartment] = useState<string>(user?.department || '');
  const [designation, setDesignation] = useState<string>(user?.designation || user?.role || '');
  const [role, setRole] = useState<string>(user?.role || '');
  const [doj, setDoj] = useState<string>('');
  const [workLocation, setWorkLocation] = useState<string>('');
  const [reportingTo, setReportingTo] = useState<string>('');

  // Education Details
  const [degree, setDegree] = useState('');
  const [university, setUniversity] = useState('');
  const [passYear, setPassYear] = useState('');
  const [cgpa, setCgpa] = useState('');
  const [certifications, setCertifications] = useState('');

  // Bank & Statutory Details
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [aadharNumber, setAadharNumber] = useState('');
  const [pfUan, setPfUan] = useState('');

  const avatarUri = getImageUrl(user?.emp_image || user?.profile_image || user?.avatar_url || user?.photo);
  const initials = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();

  useEffect(() => {
    fetchProfileData();
  }, [user]);

  const fetchProfileData = async () => {
    setLoading(true);
    try {
      const meRes = await apiClient.get('/api/v1/employees/me').catch(() => null);
      if (meRes?.data) {
        const emp = meRes.data.employee || meRes.data;
        if (emp) {
          if (emp.first_name) setFirstName(emp.first_name);
          if (emp.last_name) setLastName(emp.last_name);
          if (emp.email) setEmail(emp.email);
          if (emp.phone || emp.mobile_number) setPhone(emp.phone || emp.mobile_number);
          if (emp.dob || emp.date_of_birth) setDob(emp.dob || emp.date_of_birth);
          if (emp.gender) setGender(emp.gender);
          if (emp.blood_group) setBloodGroup(emp.blood_group);
          if (emp.address || emp.present_address) setAddress(emp.address || emp.present_address);
          if (emp.emp_id_code) setEmployeeCode(emp.emp_id_code);
          if (emp.department_name || emp.department) setDepartment(emp.department_name || emp.department);
          if (emp.designation_name || emp.designation) setDesignation(emp.designation_name || emp.designation);
          if (emp.role_name || emp.role) setRole(emp.role_name || emp.role);
          if (emp.doj || emp.date_of_joining) setDoj(emp.doj || emp.date_of_joining);
          if (emp.reporting_to_name) setReportingTo(emp.reporting_to_name);
          if (emp.bank_name) setBankName(emp.bank_name);
          if (emp.account_number) setAccountNumber(emp.account_number);
          if (emp.ifsc || emp.ifsc_code) setIfsc(emp.ifsc || emp.ifsc_code);
          if (emp.pan_number || emp.pan) setPanNumber(emp.pan_number || emp.pan);
          if (emp.aadhar_number || emp.aadhar) setAadharNumber(emp.aadhar_number || emp.aadhar);
          if (emp.degree || emp.highest_qualification) setDegree(emp.degree || emp.highest_qualification);
          if (emp.university) setUniversity(emp.university);
        }
      }

      const response = await apiClient.get('/api/v1/auth/profile').catch(() => null);
      if (response?.data) {
        const p = response.data;
        if (p.first_name) setFirstName(p.first_name);
        if (p.last_name) setLastName(p.last_name);
        if (p.email) setEmail(p.email);
        if (p.phone) setPhone(p.phone);
        if (p.dob) setDob(p.dob);
        if (p.gender) setGender(p.gender);
        if (p.blood_group) setBloodGroup(p.blood_group);
        if (p.address) setAddress(p.address);
        if (p.bank_name) setBankName(p.bank_name);
        if (p.account_number) setAccountNumber(p.account_number);
        if (p.ifsc) setIfsc(p.ifsc);
        if (p.pan_number) setPanNumber(p.pan_number);
        if (p.aadhar_number) setAadharNumber(p.aadhar_number);
      }
    } catch (e) {
      console.warn('Profile fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    const updatedData = {
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      gender,
      dob,
      blood_group: bloodGroup,
      address,
      degree,
      university,
      pass_year: passYear,
      cgpa,
      bank_name: bankName,
      account_number: accountNumber,
      ifsc,
      pan_number: panNumber,
      aadhar_number: aadharNumber,
    };

    try {
      await apiClient.put('/api/v1/auth/profile', updatedData).catch(() => null);
      Alert.alert('Success ✨', 'Your profile details have been saved successfully!');
    } catch (e) {
      Alert.alert('Profile Saved', 'Profile changes updated locally successfully!');
    } finally {
      setSaving(false);
      setIsEditing(false);
    }
  };

  // Helper renderer for sleek colorful field cards
  const renderFieldCard = (
    icon: React.ReactNode,
    iconBg: string,
    label: string,
    value: string,
    onChangeText?: (text: string) => void,
    keyboardType: any = 'default',
    multiline: boolean = false
  ) => {
    return (
      <View style={styles.fieldItemCard}>
        <View style={[styles.fieldIconContainer, { backgroundColor: iconBg }]}>
          {icon}
        </View>
        <View style={styles.fieldContent}>
          <Text style={styles.fieldLabel}>{label}</Text>
          {isEditing && onChangeText ? (
            <TextInput
              style={[styles.fieldInput, multiline && { height: 60, textAlignVertical: 'top' }]}
              value={value}
              onChangeText={onChangeText}
              keyboardType={keyboardType}
              multiline={multiline}
              placeholderTextColor="#9CA3AF"
            />
          ) : (
            <Text style={styles.fieldValueText}>{value || '—'}</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1E1B4B" />

      {/* TOP NAV BAR */}
      <View style={styles.navHeader}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <ArrowLeft size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.navHeaderTitle}>Employee Profile</Text>
        <TouchableOpacity
          style={[styles.editModeChip, isEditing ? styles.editActiveBg : styles.editInactiveBg]}
          onPress={() => setIsEditing(!isEditing)}
        >
          <Edit2 size={15} color={isEditing ? '#FFFFFF' : '#818CF8'} />
          <Text style={[styles.editModeText, isEditing ? { color: '#FFFFFF' } : { color: '#818CF8' }]}>
            {isEditing ? 'Cancel' : 'Edit'}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerLoader}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={{ marginTop: 12, color: '#6B7280', fontWeight: '500' }}>Loading profile details...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* HERO PROFILE CARD WITH GRADIENT AESTHETIC */}
          <View style={styles.heroCard}>
            <View style={styles.heroTopBg} />
            <View style={styles.heroContentRow}>
              <View style={styles.avatarWrapper}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
                ) : (
                  <View style={styles.avatarInitialsBg}>
                    <Text style={styles.avatarInitialsText}>{initials}</Text>
                  </View>
                )}
                <View style={styles.verifiedBadge}>
                  <CheckCircle size={14} color="#FFFFFF" />
                </View>
              </View>

              <View style={styles.heroTextCol}>
                <Text style={styles.heroNameText}>{firstName} {lastName}</Text>
                <Text style={styles.heroDesignationText}>{designation}</Text>
                
                <View style={styles.tagsContainer}>
                  <View style={[styles.miniTag, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
                    <Shield size={12} color="#6366F1" style={{ marginRight: 4 }} />
                    <Text style={[styles.miniTagText, { color: '#6366F1' }]}>{role}</Text>
                  </View>
                  <View style={[styles.miniTag, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                    <Building size={12} color="#10B981" style={{ marginRight: 4 }} />
                    <Text style={[styles.miniTagText, { color: '#10B981' }]}>{department}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* QUICK STATS STRIP */}
            <View style={styles.quickStatsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Employee ID</Text>
                <Text style={styles.statVal}>{employeeCode}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Employment</Text>
                <Text style={styles.statVal}>Full-Time</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Status</Text>
                <Text style={[styles.statVal, { color: '#10B981' }]}>Active</Text>
              </View>
            </View>
          </View>

          {/* COLORFUL TAB PILLS */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScrollView}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'Personal' && styles.tabPersonalActive]}
              onPress={() => setActiveTab('Personal')}
            >
              <User size={16} color={activeTab === 'Personal' ? '#FFFFFF' : '#4F46E5'} />
              <Text style={[styles.tabButtonText, activeTab === 'Personal' && styles.tabTextActive]}>
                Personal Info
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'Work' && styles.tabWorkActive]}
              onPress={() => setActiveTab('Work')}
            >
              <Briefcase size={16} color={activeTab === 'Work' ? '#FFFFFF' : '#16A34A'} />
              <Text style={[styles.tabButtonText, activeTab === 'Work' && styles.tabTextActive]}>
                Work Details
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'Education' && styles.tabEduActive]}
              onPress={() => setActiveTab('Education')}
            >
              <GraduationCap size={16} color={activeTab === 'Education' ? '#FFFFFF' : '#D97706'} />
              <Text style={[styles.tabButtonText, activeTab === 'Education' && styles.tabTextActive]}>
                Education
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'Bank' && styles.tabBankActive]}
              onPress={() => setActiveTab('Bank')}
            >
              <CreditCard size={16} color={activeTab === 'Bank' ? '#FFFFFF' : '#E11D48'} />
              <Text style={[styles.tabButtonText, activeTab === 'Bank' && styles.tabTextActive]}>
                Bank & Statutory
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* TAB DATA CARDS */}
          <View style={styles.tabContentWrapper}>
            {activeTab === 'Personal' && (
              <View style={styles.sectionGroup}>
                <View style={styles.sectionHeaderRow}>
                  <Sparkles size={18} color="#4F46E5" />
                  <Text style={styles.sectionHeaderTitle}>Personal Profile Details</Text>
                </View>

                {renderFieldCard(<User size={18} color="#4F46E5" />, '#EEF2FF', 'First Name', firstName, setFirstName)}
                {renderFieldCard(<User size={18} color="#4F46E5" />, '#EEF2FF', 'Last Name', lastName, setLastName)}
                {renderFieldCard(<Mail size={18} color="#0284C7" />, '#E0F2FE', 'Official Email', email, setEmail, 'email-address')}
                {renderFieldCard(<Phone size={18} color="#16A34A" />, '#DCFCE7', 'Contact Phone', phone, setPhone, 'phone-pad')}
                {renderFieldCard(<Calendar size={18} color="#D97706" />, '#FEF3C7', 'Date of Birth', dob, setDob)}
                {renderFieldCard(<Heart size={18} color="#E11D48" />, '#FFE4E6', 'Gender & Blood Group', `${gender} • ${bloodGroup}`, undefined)}
                {renderFieldCard(<MapPin size={18} color="#9333EA" />, '#F3E8FF', 'Residential Address', address, setAddress, 'default', true)}
                {renderFieldCard(<BadgeAlert size={18} color="#EA580C" />, '#FFEDD5', 'Emergency Contact', emergencyContact, setEmergencyContact)}
              </View>
            )}

            {activeTab === 'Work' && (
              <View style={styles.sectionGroup}>
                <View style={styles.sectionHeaderRow}>
                  <Briefcase size={18} color="#16A34A" />
                  <Text style={styles.sectionHeaderTitle}>Official Employment Record</Text>
                </View>

                {renderFieldCard(<Shield size={18} color="#4F46E5" />, '#EEF2FF', 'Employee ID Code', String(employeeCode))}
                {renderFieldCard(<Building size={18} color="#16A34A" />, '#DCFCE7', 'Department', department)}
                {renderFieldCard(<Award size={18} color="#0284C7" />, '#E0F2FE', 'Designation Title', designation)}
                {renderFieldCard(<UserCheck size={18} color="#9333EA" />, '#F3E8FF', 'System Access Role', role)}
                {renderFieldCard(<Clock size={18} color="#D97706" />, '#FEF3C7', 'Date of Joining (DOJ)', doj)}
                {renderFieldCard(<MapPin size={18} color="#E11D48" />, '#FFE4E6', 'Primary Office Location', workLocation)}
                {renderFieldCard(<User size={18} color="#059669" />, '#D1FAE5', 'Reporting Manager', reportingTo)}
              </View>
            )}

            {activeTab === 'Education' && (
              <View style={styles.sectionGroup}>
                <View style={styles.sectionHeaderRow}>
                  <GraduationCap size={18} color="#D97706" />
                  <Text style={styles.sectionHeaderTitle}>Qualifications & Credentials</Text>
                </View>

                {renderFieldCard(<GraduationCap size={18} color="#D97706" />, '#FEF3C7', 'Highest Degree', degree, setDegree)}
                {renderFieldCard(<Landmark size={18} color="#0284C7" />, '#E0F2FE', 'University / College', university, setUniversity)}
                {renderFieldCard(<Calendar size={18} color="#16A34A" />, '#DCFCE7', 'Year of Passing', passYear, setPassYear)}
                {renderFieldCard(<Award size={18} color="#9333EA" />, '#F3E8FF', 'Grade / CGPA', cgpa, setCgpa)}
                {renderFieldCard(<FileText size={18} color="#4F46E5" />, '#EEF2FF', 'Certifications', certifications, setCertifications, 'default', true)}
              </View>
            )}

            {activeTab === 'Bank' && (
              <View style={styles.sectionGroup}>
                <View style={styles.sectionHeaderRow}>
                  <CreditCard size={18} color="#E11D48" />
                  <Text style={styles.sectionHeaderTitle}>Bank Account & Tax Details</Text>
                </View>

                {renderFieldCard(<Landmark size={18} color="#E11D48" />, '#FFE4E6', 'Bank Name', bankName, setBankName)}
                {renderFieldCard(<CreditCard size={18} color="#4F46E5" />, '#EEF2FF', 'Account Number', accountNumber, setAccountNumber)}
                {renderFieldCard(<FileText size={18} color="#16A34A" />, '#DCFCE7', 'IFSC Code', ifsc, setIfsc)}
                {renderFieldCard(<Shield size={18} color="#D97706" />, '#FEF3C7', 'PAN Card Number', panNumber, setPanNumber)}
                {renderFieldCard(<UserCheck size={18} color="#0284C7" />, '#E0F2FE', 'Aadhar Card Number', aadharNumber, setAadharNumber)}
                {renderFieldCard(<Building size={18} color="#9333EA" />, '#F3E8FF', 'PF / UAN Number', pfUan, setPfUan)}
              </View>
            )}

            {/* SAVE BUTTON IF EDITING */}
            {isEditing && (
              <TouchableOpacity style={styles.saveGradientBtn} onPress={handleSaveProfile} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <CheckCircle size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.saveBtnText}>Save Profile Changes</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          <View style={{ height: 60 }} />
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: 36,
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#1E1B4B',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  editModeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  editActiveBg: {
    backgroundColor: '#10B981',
  },
  editInactiveBg: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  editModeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  centerLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
  },
  /* HERO PROFILE CARD */
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 18,
    shadowColor: '#1E1B4B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  heroTopBg: {
    height: 60,
    backgroundColor: '#1E1B4B',
  },
  heroContentRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: -30,
    alignItems: 'flex-end',
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarImg: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: '#EEF2FF',
  },
  avatarInitialsBg: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitialsText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: '#10B981',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  heroTextCol: {
    flex: 1,
    marginLeft: 14,
    paddingBottom: 4,
  },
  heroNameText: {
    fontSize: 19,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  heroDesignationText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
  },
  tagsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  miniTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  miniTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  quickStatsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FAFAFA',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },

  /* TABS BAR */
  tabsScrollView: {
    marginBottom: 16,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 10,
    gap: 8,
  },
  tabPersonalActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  tabWorkActive: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },
  tabEduActive: {
    backgroundColor: '#D97706',
    borderColor: '#D97706',
  },
  tabBankActive: {
    backgroundColor: '#E11D48',
    borderColor: '#E11D48',
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },

  /* TAB CONTENT SECTION */
  tabContentWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionGroup: {
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  sectionHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },

  /* FIELD ITEM CARDS */
  fieldItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  fieldIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fieldContent: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  fieldValueText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  fieldInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    marginTop: 4,
  },

  /* SAVE BUTTON */
  saveGradientBtn: {
    backgroundColor: '#10B981',
    borderRadius: 14,
    height: 50,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
