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
import { ArrowLeft, Calendar, Palmtree, Clock, Sparkles } from 'lucide-react-native';

interface Holiday {
  id: string | number;
  name: string;
  holiday_date: string;
  description?: string;
  is_restricted?: boolean;
}

interface HolidaysProps {
  onBack: () => void;
}

export const HolidaysScreen: React.FC<HolidaysProps> = ({ onBack }) => {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchHolidays();
  }, []);

  const fetchHolidays = async () => {
    try {
      const res = await apiClient.get('/api/v1/holidays');
      const list = res.data?.holidays || res.data || [];
      if (Array.isArray(list)) {
        // Sort by date ascending
        list.sort((a, b) => new Date(a.holiday_date).getTime() - new Date(b.holiday_date).getTime());
        setHolidays(list);
      }
    } catch (e) {
      console.error('Error fetching holidays:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchHolidays();
  };

  const getDayName = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'long' });
  };

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const isUpcoming = (dateStr: string) => {
    if (!dateStr) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(dateStr) >= today;
  };

  const upcomingCount = holidays.filter(h => isUpcoming(h.holiday_date)).length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <ArrowLeft size={22} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Holiday Calendar</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Hero Stats Card */}
      <View style={styles.heroCard}>
        <View style={styles.heroRow}>
          <View style={styles.heroIconBg}>
            <Palmtree size={28} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.heroTitle}>Annual Holidays</Text>
            <Text style={styles.heroSub}>
              {holidays.length} Total Holidays • {upcomingCount} Upcoming
            </Text>
          </View>
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>Loading festival calendar...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {holidays.length === 0 ? (
            <View style={styles.emptyBox}>
              <Calendar size={44} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No Holidays Declared</Text>
              <Text style={styles.emptySub}>No holiday schedule found for this academic/fiscal year.</Text>
            </View>
          ) : (
            holidays.map((h, index) => {
              const upcoming = isUpcoming(h.holiday_date);
              return (
                <View
                  key={h.id || index}
                  style={[styles.holidayCard, upcoming ? styles.upcomingCard : styles.pastCard]}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.dateBadge}>
                      <Calendar size={14} color={upcoming ? '#4F46E5' : '#64748B'} />
                      <Text style={[styles.dateText, { color: upcoming ? '#4F46E5' : '#64748B' }]}>
                        {formatDisplayDate(h.holiday_date)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusPill,
                        { backgroundColor: upcoming ? '#ECFDF5' : '#F1F5F9' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          { color: upcoming ? '#059669' : '#64748B' },
                        ]}
                      >
                        {upcoming ? 'Upcoming' : 'Past'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.holidayName}>{h.name}</Text>
                  <Text style={styles.holidayDay}>{getDayName(h.holiday_date)}</Text>

                  {h.description ? (
                    <Text style={styles.holidayDesc}>{h.description}</Text>
                  ) : null}
                </View>
              );
            })
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
  heroCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#4F46E5',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
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
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
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
  emptyBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginTop: 14,
  },
  emptySub: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 6,
  },
  holidayCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  upcomingCard: {
    borderColor: '#E0E7FF',
  },
  pastCard: {
    borderColor: '#F1F5F9',
    opacity: 0.8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  holidayName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  holidayDay: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  holidayDesc: {
    fontSize: 12,
    color: '#475569',
    marginTop: 8,
    lineHeight: 16,
  },
});
