import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { apiClient } from '../config/api';
import { ArrowLeft, Briefcase, Users, Calendar, Award, CheckCircle2 } from 'lucide-react-native';

interface Job {
  id: string | number;
  title: string;
  department: string;
  location: string;
  type: string;
  applicants_count: number;
  status: string;
}

interface Candidate {
  id: string | number;
  name: string;
  job_title: string;
  stage: 'APPLIED' | 'INTERVIEW' | 'OFFER' | 'HIRED';
  experience: string;
}

interface RecruitmentProps {
  onBack: () => void;
}

export const RecruitmentScreen: React.FC<RecruitmentProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<'Jobs' | 'Candidates'>('Jobs');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecruitmentData();
  }, []);

  const fetchRecruitmentData = async () => {
    setLoading(true);
    try {
      const [jobsRes, candRes] = await Promise.all([
        apiClient.get('/api/v1/recruitment/jobs').catch(() => null),
        apiClient.get('/api/v1/recruitment/candidates').catch(() => null),
      ]);

      if (jobsRes?.data && Array.isArray(jobsRes.data)) {
        setJobs(jobsRes.data);
      } else {
        setFallbackJobs();
      }

      if (candRes?.data && Array.isArray(candRes.data)) {
        setCandidates(candRes.data);
      } else {
        setFallbackCandidates();
      }
    } catch (e) {
      setFallbackJobs();
      setFallbackCandidates();
    } finally {
      setLoading(false);
    }
  };

  const setFallbackJobs = () => {
    setJobs([
      { id: 1, title: 'Senior React Developer', department: 'Engineering', location: 'Hyderabad (Hybrid)', type: 'Full-time', applicants_count: 24, status: 'OPEN' },
      { id: 2, title: 'HR Generalist', department: 'Human Resources', location: 'Bangalore', type: 'Full-time', applicants_count: 14, status: 'OPEN' },
      { id: 3, title: 'Product Designer (UI/UX)', department: 'Design', location: 'Remote', type: 'Full-time', applicants_count: 38, status: 'OPEN' },
    ]);
  };

  const setFallbackCandidates = () => {
    setCandidates([
      { id: 201, name: 'Siddharth Rao', job_title: 'Senior React Developer', stage: 'INTERVIEW', experience: '5 Years' },
      { id: 202, name: 'Ananya Deshmukh', job_title: 'Product Designer', stage: 'OFFER', experience: '3 Years' },
      { id: 203, name: 'Vikram Choudhury', job_title: 'HR Generalist', stage: 'APPLIED', experience: '4 Years' },
    ]);
  };

  const renderStageBadge = (stage: string) => {
    if (stage === 'OFFER' || stage === 'HIRED') {
      return (
        <View style={[styles.badge, { backgroundColor: '#D1FAE5' }]}>
          <CheckCircle2 size={12} color="#059669" />
          <Text style={[styles.badgeText, { color: '#059669' }]}>{stage}</Text>
        </View>
      );
    }
    if (stage === 'INTERVIEW') {
      return (
        <View style={[styles.badge, { backgroundColor: '#DBEAFE' }]}>
          <Calendar size={12} color="#2563EB" />
          <Text style={[styles.badgeText, { color: '#2563EB' }]}>Interview</Text>
        </View>
      );
    }
    return (
      <View style={[styles.badge, { backgroundColor: '#F3F4F6' }]}>
        <Text style={[styles.badgeText, { color: '#6B7280' }]}>Applied</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <ArrowLeft size={20} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recruitment & Hiring</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'Jobs' && styles.tabActive]}
          onPress={() => setActiveTab('Jobs')}
        >
          <Text style={[styles.tabText, activeTab === 'Jobs' && styles.tabTextActive]}>
            Open Jobs ({jobs.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'Candidates' && styles.tabActive]}
          onPress={() => setActiveTab('Candidates')}
        >
          <Text style={[styles.tabText, activeTab === 'Candidates' && styles.tabTextActive]}>
            Applicants ({candidates.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerLoader}>
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {activeTab === 'Jobs' ? (
            jobs.map((job) => (
              <View key={job.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.iconCircle}>
                    <Briefcase size={20} color="#4F46E5" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{job.title}</Text>
                    <Text style={styles.cardSub}>{job.department} • {job.location}</Text>
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <View style={styles.countBadge}>
                    <Users size={14} color="#4F46E5" />
                    <Text style={styles.countText}>{job.applicants_count} Applicants</Text>
                  </View>
                  <Text style={styles.typeText}>{job.type}</Text>
                </View>
              </View>
            ))
          ) : (
            candidates.map((cand) => (
              <View key={cand.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={[styles.iconCircle, { backgroundColor: '#EEF2FF' }]}>
                    <Users size={20} color="#4F46E5" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{cand.name}</Text>
                    <Text style={styles.cardSub}>{cand.job_title} ({cand.experience})</Text>
                  </View>
                  {renderStageBadge(cand.stage)}
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 10,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderColor: 'transparent',
  },
  tabActive: {
    borderColor: '#4F46E5',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#4F46E5',
  },
  centerLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 20,
  },
  card: {
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
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  cardSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: '#F3F4F6',
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4F46E5',
  },
  typeText: {
    fontSize: 12,
    color: '#6B7280',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
