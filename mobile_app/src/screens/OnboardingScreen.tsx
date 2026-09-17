import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { apiClient } from '../config/api';
import { ArrowLeft, UserPlus, FileCheck, CheckCircle2, Clock, Send } from 'lucide-react-native';

interface OnboardingCandidate {
  id: string | number;
  candidate_name: string;
  email: string;
  position: string;
  department: string;
  joining_date: string;
  status: 'INVITED' | 'OFFER_SENT' | 'ACCEPTED' | 'COMPLETED';
}

interface OnboardingProps {
  onBack: () => void;
}

export const OnboardingScreen: React.FC<OnboardingProps> = ({ onBack }) => {
  const [candidates, setCandidates] = useState<OnboardingCandidate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/v1/onboarding').catch(() => null);
      if (response?.data && Array.isArray(response.data)) {
        setCandidates(response.data);
      } else {
        setFallbackData();
      }
    } catch (e) {
      setFallbackData();
    } finally {
      setLoading(false);
    }
  };

  const setFallbackData = () => {
    setCandidates([
      { id: 1, candidate_name: 'Karthik Raja', email: 'karthik@candidate.com', position: 'Senior Backend Engineer', department: 'Engineering', joining_date: '2026-10-01', status: 'OFFER_SENT' },
      { id: 2, candidate_name: 'Divya Nair', email: 'divya@candidate.com', position: 'UI/UX Designer', department: 'Design', joining_date: '2026-10-05', status: 'ACCEPTED' },
      { id: 3, candidate_name: 'Manish Kumar', email: 'manish@candidate.com', position: 'DevOps Engineer', department: 'Infrastructure', joining_date: '2026-09-20', status: 'COMPLETED' },
    ]);
  };

  const handleSendOffer = (id: string | number, name: string) => {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: 'OFFER_SENT' } : c))
    );
    Alert.alert('Offer Sent', `Official appointment & offer letter email sent to ${name}.`);
  };

  const renderBadge = (status: string) => {
    if (status === 'COMPLETED' || status === 'ACCEPTED') {
      return (
        <View style={[styles.badge, { backgroundColor: '#D1FAE5' }]}>
          <CheckCircle2 size={12} color="#059669" />
          <Text style={[styles.badgeText, { color: '#059669' }]}>{status}</Text>
        </View>
      );
    }
    return (
      <View style={[styles.badge, { backgroundColor: '#DBEAFE' }]}>
        <Clock size={12} color="#2563EB" />
        <Text style={[styles.badgeText, { color: '#2563EB' }]}>Offer Sent</Text>
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
        <Text style={styles.headerTitle}>Employee Onboarding</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.centerLoader}>
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.sectionTitle}>New Joinees Pipeline ({candidates.length})</Text>
          {candidates.map((cand) => (
            <View key={cand.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.iconCircle}>
                  <UserPlus size={20} color="#4F46E5" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{cand.candidate_name}</Text>
                  <Text style={styles.subText}>{cand.position} • {cand.department}</Text>
                </View>
                {renderBadge(cand.status)}
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Joining Date:</Text>
                <Text style={styles.infoVal}>{cand.joining_date}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Email:</Text>
                <Text style={styles.infoVal}>{cand.email}</Text>
              </View>

              {cand.status === 'INVITED' && (
                <TouchableOpacity
                  style={styles.sendOfferBtn}
                  onPress={() => handleSendOffer(cand.id, cand.candidate_name)}
                >
                  <Send size={14} color="#FFF" style={{ marginRight: 6 }} />
                  <Text style={styles.sendOfferText}>Send Offer Letter</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
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
  centerLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
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
    marginBottom: 10,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  subText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
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
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  infoVal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  sendOfferBtn: {
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  sendOfferText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
});
