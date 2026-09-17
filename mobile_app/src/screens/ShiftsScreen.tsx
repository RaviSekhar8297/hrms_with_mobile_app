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
import { ArrowLeft, Clock, Calendar, Sun, Moon } from 'lucide-react-native';

interface Shift {
  id: string | number;
  name: string;
  start_time: string;
  end_time: string;
  break_duration: string;
}

interface Holiday {
  id: string | number;
  name: string;
  date: string;
  day: string;
}

interface ShiftsProps {
  onBack: () => void;
}

export const ShiftsScreen: React.FC<ShiftsProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<'Shifts' | 'Holidays'>('Shifts');
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [shiftsRes, holRes] = await Promise.all([
        apiClient.get('/api/v1/shifts').catch(() => null),
        apiClient.get('/api/v1/holidays').catch(() => null),
      ]);

      if (shiftsRes?.data && Array.isArray(shiftsRes.data)) {
        setShifts(shiftsRes.data);
      } else {
        setFallbackShifts();
      }

      if (holRes?.data && Array.isArray(holRes.data)) {
        setHolidays(holRes.data);
      } else {
        setFallbackHolidays();
      }
    } catch (e) {
      setFallbackShifts();
      setFallbackHolidays();
    } finally {
      setLoading(false);
    }
  };

  const setFallbackShifts = () => {
    setShifts([
      { id: 1, name: 'Morning General Shift', start_time: '09:00 AM', end_time: '06:00 PM', break_duration: '60 mins' },
      { id: 2, name: 'Evening Shift', start_time: '02:00 PM', end_time: '11:00 PM', break_duration: '60 mins' },
      { id: 3, name: 'Night Shift', start_time: '10:00 PM', end_time: '07:00 AM', break_duration: '60 mins' },
    ]);
  };

  const setFallbackHolidays = () => {
    setHolidays([
      { id: 1, name: 'Gandhi Jayanti', date: '2026-10-02', day: 'Friday' },
      { id: 2, name: 'Dussehra / Vijayadashami', date: '2026-10-20', day: 'Tuesday' },
      { id: 3, name: 'Diwali', date: '2026-11-08', day: 'Sunday' },
      { id: 4, name: 'Christmas Day', date: '2026-12-25', day: 'Friday' },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <ArrowLeft size={20} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Shifts & Holidays</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'Shifts' && styles.tabActive]}
          onPress={() => setActiveTab('Shifts')}
        >
          <Text style={[styles.tabText, activeTab === 'Shifts' && styles.tabTextActive]}>
            Shift Schedules
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'Holidays' && styles.tabActive]}
          onPress={() => setActiveTab('Holidays')}
        >
          <Text style={[styles.tabText, activeTab === 'Holidays' && styles.tabTextActive]}>
            Holiday Calendar
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerLoader}>
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {activeTab === 'Shifts' ? (
            shifts.map((s) => (
              <View key={s.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.iconCircle}>
                    {s.name.includes('Night') ? <Moon size={20} color="#9333EA" /> : <Sun size={20} color="#D97706" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{s.name}</Text>
                    <Text style={styles.cardSub}>Timing: {s.start_time} - {s.end_time}</Text>
                  </View>
                </View>
                <View style={styles.cardFooter}>
                  <Text style={styles.breakText}>Break Allowance: {s.break_duration}</Text>
                </View>
              </View>
            ))
          ) : (
            holidays.map((h) => (
              <View key={h.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={[styles.iconCircle, { backgroundColor: '#F3E8FF' }]}>
                    <Calendar size={20} color="#9333EA" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{h.name}</Text>
                    <Text style={styles.cardSub}>{h.day}, {h.date}</Text>
                  </View>
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
    backgroundColor: '#FEF3C7',
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
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: '#F3F4F6',
  },
  breakText: {
    fontSize: 12,
    color: '#4B5563',
  },
});
