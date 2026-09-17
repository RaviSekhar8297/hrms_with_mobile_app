import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { ArrowLeft, TrendingUp, Users, Clock, Award, CheckCircle2 } from 'lucide-react-native';

interface AnalyticsProps {
  onBack: () => void;
}

export const AnalyticsScreen: React.FC<AnalyticsProps> = ({ onBack }) => {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <ArrowLeft size={20} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>HR Analytics & Insights</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Key Performance Metrics</Text>

        {/* Metric Cards Grid */}
        <View style={styles.grid}>
          <View style={styles.metricCard}>
            <View style={[styles.iconCircle, { backgroundColor: '#EEF2FF' }]}>
              <Users size={22} color="#4F46E5" />
            </View>
            <Text style={styles.metricVal}>148</Text>
            <Text style={styles.metricLabel}>Total Headcount</Text>
            <Text style={styles.trendText}>+12 this month</Text>
          </View>

          <View style={styles.metricCard}>
            <View style={[styles.iconCircle, { backgroundColor: '#D1FAE5' }]}>
              <Clock size={22} color="#059669" />
            </View>
            <Text style={styles.metricVal}>96.4%</Text>
            <Text style={styles.metricLabel}>Avg Attendance</Text>
            <Text style={styles.trendText}>+1.2% vs Q2</Text>
          </View>

          <View style={styles.metricCard}>
            <View style={[styles.iconCircle, { backgroundColor: '#FEF3C7' }]}>
              <Award size={22} color="#D97706" />
            </View>
            <Text style={styles.metricVal}>4.8 / 5</Text>
            <Text style={styles.metricLabel}>Retention Rate</Text>
            <Text style={styles.trendText}>Top 5% Industry</Text>
          </View>

          <View style={styles.metricCard}>
            <View style={[styles.iconCircle, { backgroundColor: '#F3E8FF' }]}>
              <TrendingUp size={22} color="#9333EA" />
            </View>
            <Text style={styles.metricVal}>92%</Text>
            <Text style={styles.metricLabel}>KPI On-Track</Text>
            <Text style={styles.trendText}>Project WorkBridge</Text>
          </View>
        </View>

        {/* Department Distribution */}
        <Text style={styles.sectionTitle}>Department Breakdown</Text>
        <View style={styles.deptCard}>
          <View style={styles.deptRow}>
            <Text style={styles.deptName}>Engineering & Tech</Text>
            <Text style={styles.deptCount}>64 Employees (43%)</Text>
          </View>
          <View style={styles.barBg}>
            <View style={[styles.barFill, { width: '43%', backgroundColor: '#4F46E5' }]} />
          </View>

          <View style={styles.deptRow}>
            <Text style={styles.deptName}>Human Resources</Text>
            <Text style={styles.deptCount}>22 Employees (15%)</Text>
          </View>
          <View style={styles.barBg}>
            <View style={[styles.barFill, { width: '15%', backgroundColor: '#10B981' }]} />
          </View>

          <View style={styles.deptRow}>
            <Text style={styles.deptName}>Finance & Accounting</Text>
            <Text style={styles.deptCount}>18 Employees (12%)</Text>
          </View>
          <View style={styles.barBg}>
            <View style={[styles.barFill, { width: '12%', backgroundColor: '#F59E0B' }]} />
          </View>

          <View style={styles.deptRow}>
            <Text style={styles.deptName}>Operations & Others</Text>
            <Text style={styles.deptCount}>44 Employees (30%)</Text>
          </View>
          <View style={styles.barBg}>
            <View style={[styles.barFill, { width: '30%', backgroundColor: '#8B5CF6' }]} />
          </View>
        </View>
      </ScrollView>
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
  content: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  metricVal: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  metricLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  trendText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
    marginTop: 6,
  },
  deptCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  deptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 4,
  },
  deptName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  deptCount: {
    fontSize: 12,
    color: '#6B7280',
  },
  barBg: {
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    marginBottom: 10,
  },
  barFill: {
    height: 8,
    borderRadius: 4,
  },
});
