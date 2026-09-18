import React, { useState, useEffect } from 'react';
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
import { ArrowLeft, Coffee, Calendar, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react-native';

interface WeekoffPolicy {
  id: string;
  name: string;
  off_days?: string[];
  alternate_rules?: Record<string, boolean>;
}

interface WeekOffsProps {
  onBack: () => void;
}

const ALL_DAYS = [
  { key: 'Monday', label: 'Monday', short: 'Mon' },
  { key: 'Tuesday', label: 'Tuesday', short: 'Tue' },
  { key: 'Wednesday', label: 'Wednesday', short: 'Wed' },
  { key: 'Thursday', label: 'Thursday', short: 'Thu' },
  { key: 'Friday', label: 'Friday', short: 'Fri' },
  { key: 'Saturday', label: 'Saturday', short: 'Sat' },
  { key: 'Sunday', label: 'Sunday', short: 'Sun' },
];

export const WeekOffsScreen: React.FC<WeekOffsProps> = ({ onBack }) => {
  const [policy, setPolicy] = useState<WeekoffPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchWeekoffs();
  }, []);

  const fetchWeekoffs = async () => {
    try {
      const res = await apiClient.get('/api/v1/weekoffs');
      if (res.data) {
        const p = res.data.weekoff || (Array.isArray(res.data.weekoffs) ? res.data.weekoffs[0] : null);
        setPolicy(p);
      }
    } catch (e) {
      console.error('Error loading weekoffs:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchWeekoffs();
  };

  const offDays = Array.isArray(policy?.off_days) ? policy.off_days : ['Sunday'];
  const altRules = policy?.alternate_rules || {};

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <ArrowLeft size={22} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Week Offs Policy</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#D97706" />
          <Text style={styles.loadingText}>Loading week-off schedule...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Hero Banner */}
          <View style={styles.heroCard}>
            <View style={styles.heroRow}>
              <View style={styles.heroIconBg}>
                <Coffee size={28} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.heroTitle}>{policy?.name || 'Standard Weekend Off'}</Text>
                <Text style={styles.heroSub}>
                  {offDays.join(', ')} • Paid Rest Days
                </Text>
              </View>
            </View>

            <View style={styles.heroFoot}>
              <Sparkles size={14} color="#FDE68A" />
              <Text style={styles.heroFootText}>
                Automatic attendance calculation &amp; salary credit
              </Text>
            </View>
          </View>

          {/* Weekly Schedule Days */}
          <Text style={styles.sectionTitle}>Weekly Roster Status</Text>
          <View style={styles.daysCard}>
            {ALL_DAYS.map((d, idx) => {
              const isOff = offDays.includes(d.key);
              const isSat = d.key === 'Saturday';
              return (
                <View
                  key={d.key}
                  style={[
                    styles.dayRow,
                    idx === ALL_DAYS.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <View style={styles.dayLeft}>
                    <View
                      style={[
                        styles.dayIndicator,
                        { backgroundColor: isOff ? '#FEF3C7' : '#F1F5F9' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayShort,
                          { color: isOff ? '#D97706' : '#64748B' },
                        ]}
                      >
                        {d.short}
                      </Text>
                    </View>
                    <View style={{ marginLeft: 12 }}>
                      <Text style={styles.dayLabel}>{d.label}</Text>
                      {isSat && Object.keys(altRules).length > 0 && (
                        <Text style={styles.altNote}>Alternate Saturdays Applied</Text>
                      )}
                    </View>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: isOff ? '#ECFDF5' : '#F8FAFC',
                        borderColor: isOff ? '#A7F3D0' : '#E2E8F0',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        { color: isOff ? '#059669' : '#94A3B8' },
                      ]}
                    >
                      {isOff ? 'OFF DAY' : 'WORKING'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Alternate Saturday Rules if configured */}
          {Object.keys(altRules).length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Saturday Roster Rules</Text>
              <View style={styles.satCard}>
                {['1st Saturday', '2nd Saturday', '3rd Saturday', '4th Saturday', '5th Saturday'].map(
                  (sat, i) => {
                    const key = `sat_${i + 1}`;
                    const isOff = !!altRules[key];
                    return (
                      <View key={sat} style={styles.satRow}>
                        <Text style={styles.satLabel}>{sat}</Text>
                        <Text
                          style={[
                            styles.satValue,
                            { color: isOff ? '#059669' : '#64748B' },
                          ]}
                        >
                          {isOff ? '✅ Off Day' : '💼 Working Day'}
                        </Text>
                      </View>
                    );
                  }
                )}
              </View>
            </>
          )}

          {/* Information box */}
          <View style={styles.noticeBox}>
            <AlertCircle size={18} color="#D97706" style={{ marginTop: 2 }} />
            <Text style={styles.noticeText}>
              Working on scheduled week-offs automatically qualifies for Comp-Off / Overtime according to company policy.
            </Text>
          </View>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
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
  heroCard: {
    backgroundColor: '#D97706',
    borderRadius: 22,
    padding: 18,
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
    marginBottom: 20,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroIconBg: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  heroSub: {
    color: '#FEF3C7',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
  heroFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  heroFootText: {
    color: '#FFFBEB',
    fontSize: 11,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  daysCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dayLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayIndicator: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayShort: {
    fontSize: 12,
    fontWeight: '800',
  },
  dayLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  altNote: {
    fontSize: 11,
    color: '#D97706',
    fontWeight: '600',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  satCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  satRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  satLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  satValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  noticeBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    gap: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
    fontWeight: '500',
  },
});
