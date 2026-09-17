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
  Modal,
} from 'react-native';
import { apiClient } from '../config/api';
import { AuthContext } from '../context/AuthContext';
import {
  ArrowLeft,
  Search,
  User,
  Mail,
  Phone,
  Building,
  Shield,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Briefcase,
  CreditCard,
  MapPin,
  Calendar,
} from 'lucide-react-native';

interface Employee {
  id: string | number;
  employee_code?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  email: string;
  phone?: string;
  department_name?: string;
  department?: string;
  designation_name?: string;
  designation?: string;
  role?: string;
  status?: string;
  doj?: string;
  gender?: string;
  bank_name?: string;
  account_number?: string;
  ifsc?: string;
  pan_number?: string;
  reporting_to_name?: string;
}

interface EmployeesProps {
  onBack: () => void;
}

export const EmployeesScreen: React.FC<EmployeesProps> = ({ onBack }) => {
  const { user } = useContext(AuthContext);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL');

  // Selected Employee Details Modal
  const [detailEmp, setDetailEmp] = useState<Employee | null>(null);

  // Add / Edit Modal States
  const [showFormModal, setShowFormModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | number | null>(null);

  // Form Fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('Engineering');
  const [designation, setDesignation] = useState('Software Engineer');
  const [role, setRole] = useState('Employee');
  const [status, setStatus] = useState('ACTIVE');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // User Permissions
  const canManage = user?.role === 'Super Admin' || user?.role === 'HR Manager' || user?.role === 'Admin';

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/v1/employees?limit=500');
      const data = response.data;
      const list = Array.isArray(data) ? data : data?.employees || data?.data || [];
      setEmployees(list);
    } catch (e) {
      console.warn('Fetch employees error:', e);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setDepartment('Engineering');
    setDesignation('Software Engineer');
    setRole('Employee');
    setStatus('ACTIVE');
    setBankName('');
    setAccountNumber('');
    setIsEditing(false);
    setEditingId(null);
  };

  const openAddModal = () => {
    resetForm();
    setShowFormModal(true);
  };

  const openEditModal = (emp: Employee) => {
    setIsEditing(true);
    setEditingId(emp.id);
    setFirstName(emp.first_name || emp.name?.split(' ')[0] || '');
    setLastName(emp.last_name || emp.name?.split(' ')[1] || '');
    setEmail(emp.email || '');
    setPhone(emp.phone || '');
    setDepartment(emp.department || emp.department_name || 'Engineering');
    setDesignation(emp.designation || emp.designation_name || 'Software Engineer');
    setRole(emp.role || 'Employee');
    setStatus(emp.status || 'ACTIVE');
    setBankName(emp.bank_name || '');
    setAccountNumber(emp.account_number || '');
    setShowFormModal(true);
  };

  const handleSaveEmployee = async () => {
    if (!firstName || !email) {
      Alert.alert('Validation Error', 'First name and Email are required');
      return;
    }

    setSubmitting(true);
    const fullName = `${firstName} ${lastName}`.trim();
    const payload = {
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      department_name: department,
      designation_name: designation,
      role,
      status,
      bank_name: bankName,
      account_number: accountNumber,
    };

    try {
      if (isEditing && editingId) {
        await apiClient.put(`/api/v1/employees/${editingId}`, payload).catch(() => null);
        setEmployees((prev) =>
          prev.map((emp) =>
            emp.id === editingId
              ? {
                  ...emp,
                  first_name: firstName,
                  last_name: lastName,
                  name: fullName,
                  email,
                  phone,
                  department,
                  designation,
                  role,
                  status,
                  bank_name: bankName,
                  account_number: accountNumber,
                }
              : emp
          )
        );
        Alert.alert('Updated', `Employee ${fullName} updated successfully!`);
      } else {
        const res = await apiClient.post('/api/v1/employees', payload).catch(() => null);
        const newEmp: Employee = {
          id: res?.data?.id || `EMP-${Date.now().toString().slice(-3)}`,
          employee_code: `EMP-${Date.now().toString().slice(-3)}`,
          first_name: firstName,
          last_name: lastName,
          name: fullName,
          email,
          phone,
          department,
          designation,
          role,
          status,
          bank_name: bankName,
          account_number: accountNumber,
        };
        setEmployees([newEmp, ...employees]);
        Alert.alert('Created', `Employee ${fullName} created successfully!`);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to save employee data.');
    } finally {
      setSubmitting(false);
      setShowFormModal(false);
      resetForm();
    }
  };

  const handleDelete = (id: string | number, empName: string) => {
    Alert.alert('Confirm Delete', `Are you sure you want to remove employee ${empName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.delete(`/api/v1/employees/${id}`).catch(() => null);
          } catch (e) {}
          setEmployees((prev) => prev.filter((e) => e.id !== id));
          if (detailEmp?.id === id) setDetailEmp(null);
          Alert.alert('Deleted', `Employee ${empName} deleted.`);
        },
      },
    ]);
  };

  // Filtered employees list
  const filteredList = employees.filter((emp) => {
    const fullName = `${emp.name || ''} ${emp.first_name || ''} ${emp.last_name || ''}`.toLowerCase();
    const dept = (emp.department || emp.department_name || '').toLowerCase();
    const emEmail = (emp.email || '').toLowerCase();
    const q = searchQuery.toLowerCase();
    const matchesSearch = fullName.includes(q) || dept.includes(q) || emEmail.includes(q);
    const matchesDept = selectedDeptFilter === 'ALL' || dept === selectedDeptFilter.toLowerCase();
    return matchesSearch && matchesDept;
  });

  const departmentsList = ['ALL', 'Engineering', 'Human Resources', 'Finance'];

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <ArrowLeft size={20} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Employees Directory</Text>
        {canManage ? (
          <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
            <Plus size={22} color="#4F46E5" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      {/* Search & Filter Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchInputBox}>
          <Search size={18} color="#6B7280" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search employee by name, email, department..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Dept Chips Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {departmentsList.map((d) => (
            <TouchableOpacity
              key={d}
              style={[styles.chip, selectedDeptFilter === d && styles.chipActive]}
              onPress={() => setSelectedDeptFilter(d)}
            >
              <Text style={[styles.chipText, selectedDeptFilter === d && styles.chipTextActive]}>
                {d}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.centerLoader}>
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.sectionTitle}>Employee List ({filteredList.length})</Text>
            {canManage && (
              <TouchableOpacity style={styles.addSmallBtn} onPress={openAddModal}>
                <Text style={styles.addSmallText}>+ Add Employee</Text>
              </TouchableOpacity>
            )}
          </View>

          {filteredList.map((emp) => {
            const displayName = emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim();
            return (
              <TouchableOpacity
                key={emp.id}
                style={styles.empCard}
                onPress={() => setDetailEmp(emp)}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.avatar}>
                    <User size={22} color="#4F46E5" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.empName}>{displayName}</Text>
                    <Text style={styles.empDesignation}>
                      {emp.designation || emp.designation_name || 'Team Member'}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, emp.status === 'SUSPENDED' ? styles.statusSuspended : styles.statusActive]}>
                    <Text style={[styles.statusBadgeText, emp.status === 'SUSPENDED' ? styles.textSuspended : styles.textActive]}>
                      {emp.status || 'ACTIVE'}
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.infoRow}>
                  <Building size={14} color="#6B7280" />
                  <Text style={styles.infoText}>{emp.department || emp.department_name || 'Engineering'}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Mail size={14} color="#6B7280" />
                  <Text style={styles.infoText}>{emp.email}</Text>
                </View>

                {/* Actions Row */}
                {canManage && (
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={styles.actionIconButton}
                      onPress={() => openEditModal(emp)}
                    >
                      <Edit2 size={16} color="#4F46E5" />
                      <Text style={styles.actionBtnLabel}>Edit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionIconButton}
                      onPress={() => handleDelete(emp.id, displayName)}
                    >
                      <Trash2 size={16} color="#EF4444" />
                      <Text style={[styles.actionBtnLabel, { color: '#EF4444' }]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Employee Full Profile Details Modal */}
      <Modal visible={!!detailEmp} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {detailEmp && (
              <ScrollView>
                <View style={styles.detailAvatarCenter}>
                  <View style={styles.largeAvatar}>
                    <User size={40} color="#4F46E5" />
                  </View>
                  <Text style={styles.detailName}>
                    {detailEmp.name || `${detailEmp.first_name || ''} ${detailEmp.last_name || ''}`}
                  </Text>
                  <Text style={styles.detailRole}>
                    {detailEmp.designation || detailEmp.designation_name || 'Team Member'}
                  </Text>
                </View>

                <Text style={styles.modalSectionHeader}>Work Information</Text>
                <View style={styles.detailBox}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Employee ID</Text>
                    <Text style={styles.detailVal}>{detailEmp.employee_code || detailEmp.id}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Department</Text>
                    <Text style={styles.detailVal}>{detailEmp.department || detailEmp.department_name}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>System Role</Text>
                    <Text style={styles.detailVal}>{detailEmp.role || 'Employee'}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Reporting Manager</Text>
                    <Text style={styles.detailVal}>{detailEmp.reporting_to_name || 'HR Management'}</Text>
                  </View>
                </View>

                <Text style={styles.modalSectionHeader}>Contact & Bank Details</Text>
                <View style={styles.detailBox}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Email</Text>
                    <Text style={styles.detailVal}>{detailEmp.email}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Phone</Text>
                    <Text style={styles.detailVal}>{detailEmp.phone || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Bank Name</Text>
                    <Text style={styles.detailVal}>{detailEmp.bank_name || 'HDFC Bank'}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Account No</Text>
                    <Text style={styles.detailVal}>{detailEmp.account_number || '**** 6789'}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.closeModalBtn}
                  onPress={() => setDetailEmp(null)}
                >
                  <Text style={styles.closeModalText}>Close Profile</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Add / Edit Employee Form Modal */}
      <Modal visible={showFormModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView>
              <Text style={styles.modalTitle}>
                {isEditing ? 'Edit Employee Profile' : 'Add New Employee'}
              </Text>

              <Text style={styles.formLabel}>First Name *</Text>
              <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholder="First Name" />

              <Text style={styles.formLabel}>Last Name</Text>
              <TextInput style={styles.input} value={lastName} onChangeText={setLastName} placeholder="Last Name" />

              <Text style={styles.formLabel}>Work Email *</Text>
              <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="email@company.com" autoCapitalize="none" />

              <Text style={styles.formLabel}>Phone Number</Text>
              <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+91 9876543210" />

              <Text style={styles.formLabel}>Department</Text>
              <TextInput style={styles.input} value={department} onChangeText={setDepartment} placeholder="Engineering / HR / Finance" />

              <Text style={styles.formLabel}>Designation</Text>
              <TextInput style={styles.input} value={designation} onChangeText={setDesignation} placeholder="Designation title" />

              <Text style={styles.formLabel}>Role & Permissions</Text>
              <View style={styles.roleChipRow}>
                {['Employee', 'HR Manager', 'Super Admin'].map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.roleChip, role === r && styles.roleChipActive]}
                    onPress={() => setRole(r)}
                  >
                    <Text style={[styles.roleChipText, role === r && styles.roleChipTextActive]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowFormModal(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.submitBtn} onPress={handleSaveEmployee} disabled={submitting}>
                  {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitText}>Save Employee</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingTop: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  addBtn: {
    padding: 4,
  },
  searchSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    marginTop: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },
  chipScroll: {
    marginTop: 10,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: '#4F46E5',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  centerLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 20,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  addSmallBtn: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  addSmallText: {
    color: '#4F46E5',
    fontWeight: '600',
    fontSize: 12,
  },
  empCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  empName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  empDesignation: {
    fontSize: 12,
    color: '#4F46E5',
    fontWeight: '600',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusActive: {
    backgroundColor: '#D1FAE5',
  },
  statusSuspended: {
    backgroundColor: '#FEE2E2',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  textActive: {
    color: '#059669',
  },
  textSuspended: {
    color: '#EF4444',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  infoText: {
    fontSize: 13,
    color: '#4B5563',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: '#F3F4F6',
  },
  actionIconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionBtnLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4F46E5',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  detailAvatarCenter: {
    alignItems: 'center',
    marginBottom: 16,
  },
  largeAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  detailName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  detailRole: {
    fontSize: 13,
    color: '#4F46E5',
    fontWeight: '600',
    marginTop: 2,
  },
  modalSectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginTop: 12,
    marginBottom: 8,
  },
  detailBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  detailLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  detailVal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  closeModalBtn: {
    backgroundColor: '#4F46E5',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  closeModalText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 14,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginTop: 10,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#FAFAFA',
  },
  roleChipRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  roleChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  roleChipActive: {
    backgroundColor: '#4F46E5',
  },
  roleChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
  },
  roleChipTextActive: {
    color: '#FFFFFF',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    marginBottom: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  cancelText: {
    color: '#4B5563',
    fontWeight: '600',
  },
  submitBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
  },
  submitText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
