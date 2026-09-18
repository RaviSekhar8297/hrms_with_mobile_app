import React, { useState, useEffect, useContext } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { apiClient } from '../config/api';
import { AuthContext } from '../context/AuthContext';
import { ArrowLeft, Building2, MapPin, Mail, Phone, Globe, Shield, Users } from 'lucide-react-native';

interface Company {
  id: string;
  name: string;
  subdomain?: string;
  company_code?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  status?: string;
}

interface Branch {
  id: string;
  name: string;
  address?: string;
}

interface CompanyProps {
  onBack: () => void;
}

export const CompanyScreen: React.FC<CompanyProps> = ({ onBack }) => {
  const { user } = useContext(AuthContext);
  const [company, setCompany] = useState<Company | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchCompanyData();
  }, []);

  const fetchCompanyData = async () => {
    try {
      const [compRes, branchRes] = await Promise.all([
        apiClient.get('/api/v1/companies').catch(() => null),
        apiClient.get('/api/v1/branches').catch(() => null),
      ]);

      if (compRes?.data) {
        const list = Array.isArray(compRes.data) ? compRes.data : compRes.data.companies || [];
        if (list.length > 0) {
          // If user belongs to a company, find that one, otherwise pick the first
          const matched = user?.company_id 
            ? list.find((c: any) => c.id === user.company_id) || list[0]
            : list[0];
          setCompany(matched);
        }
      }

      if (branchRes?.data) {
        const bList = Array.isArray(branchRes.data) ? branchRes.data : branchRes.data.branches || branchRes.data.data || [];
        setBranches(bList);
      }
    } catch (e) {
      console.error('Error fetching company details:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchCompanyData();
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <ArrowLeft size={22} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Company Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading organization info...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Company Brand Hero Card */}
          <View style={styles.heroCard}>
            <View style={styles.heroRow}>
              <View style={styles.heroIconBg}>
                <Building2 size={30} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.companyName} numberOfLines={2}>
                  {company?.name || 'Brihaspathi Technologies'}
                </Text>
                <Text style={styles.companyCode}>
                  Code: {company?.company_code || company?.subdomain || 'BTL-HQ'}
                </Text>
              </View>
            </View>

            <View style={styles.heroBadges}>
              <View style={styles.activeBadge}>
                <Shield size={12} color="#10B981" />
                <Text style={styles.activeText}>Active Tenant</Text>
              </View>
              <View style={styles.activeBadge}>
                <Users size={12} color="#3B82F6" />
                <Text style={[styles.activeText, { color: '#3B82F6' }]}>
                  {branches.length} Registered Branches
                </Text>
              </View>
            </View>
          </View>

          {/* Contact Details Card */}
          <Text style={styles.sectionTitle}>Contact & Location</Text>
          <View style={styles.infoCard}>
            {company?.email && (
              <View style={styles.infoRow}>
                <View style={[styles.infoIconBg, { backgroundColor: '#EFF6FF' }]}>
                  <Mail size={16} color="#2563EB" />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Official Email</Text>
                  <Text style={styles.infoValue}>{company.email}</Text>
                </View>
              </View>
            )}

            {company?.phone && (
              <View style={styles.infoRow}>
                <View style={[styles.infoIconBg, { backgroundColor: '#ECFDF5' }]}>
                  <Phone size={16} color="#059669" />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Support Line</Text>
                  <Text style={styles.infoValue}>{company.phone}</Text>
                </View>
              </View>
            )}

            <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
              <View style={[styles.infoIconBg, { backgroundColor: '#FDF2F8' }]}>
                <MapPin size={16} color="#DB2777" />
              </View>
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Head Office Address</Text>
                <Text style={styles.infoValue}>
                  {company?.address || 'Hitech City, Financial District'}, {company?.city || 'Hyderabad'}
                  {company?.state ? `, ${company.state}` : ''}
                </Text>
              </View>
            </View>
          </View>

          {/* Branches List */}
          <Text style={styles.sectionTitle}>Offices & Branches ({branches.length})</Text>
          {branches.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No branches listed yet.</Text>
            </View>
          ) : (
            branches.map((b, idx) => (
              <View key={b.id || idx} style={styles.branchCard}>
                <View style={styles.branchIconBg}>
                  <Building2 size={18} color="#4F46E5" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.branchName}>{b.name}</Text>
                  {b.address ? (
                    <Text style={styles.branchAddr}>{b.address}</Text>
                  ) : (
                    <Text style={styles.branchAddr}>Operational Unit</Text>
                  )}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingTop: 54,
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: '#1E293B',
    borderRadius: 22,
    padding: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
    marginBottom: 20,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroIconBg: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  companyName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 22,
  },
  companyCode: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  heroBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  activeText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  branchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  branchIconBg: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  branchName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  branchAddr: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
  },
});
