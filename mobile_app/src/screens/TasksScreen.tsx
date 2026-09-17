import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { apiClient } from '../config/api';
import { ArrowLeft, CheckCircle2, Clock, AlertCircle } from 'lucide-react-native';

interface Task {
  id: string | number;
  title: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  due_date?: string;
}

interface TasksProps {
  onBack: () => void;
}

export const TasksScreen: React.FC<TasksProps> = ({ onBack }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await apiClient.get('/api/v1/workbridge/tasks').catch(() => null);
      let list: Task[] = [];
      if (response?.data) {
        list = Array.isArray(response.data) ? response.data : response.data.tasks || response.data.data || [];
      }
      if (list.length === 0) {
        const altRes = await apiClient.get('/api/v1/tasks').catch(() => null);
        if (altRes?.data) {
          list = Array.isArray(altRes.data) ? altRes.data : altRes.data.tasks || [];
        }
      }
      setTasks(list);
    } catch (e) {
      console.warn('Tasks fetch error:', e);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    if (status === 'COMPLETED' || status === 'DONE') {
      return (
        <View style={[styles.badge, { backgroundColor: '#D1FAE5' }]}>
          <CheckCircle2 size={12} color="#059669" />
          <Text style={[styles.badgeText, { color: '#059669' }]}>Completed</Text>
        </View>
      );
    }
    if (status === 'IN_PROGRESS' || status === 'DOING') {
      return (
        <View style={[styles.badge, { backgroundColor: '#DBEAFE' }]}>
          <Clock size={12} color="#2563EB" />
          <Text style={[styles.badgeText, { color: '#2563EB' }]}>In Progress</Text>
        </View>
      );
    }
    return (
      <View style={[styles.badge, { backgroundColor: '#FEF3C7' }]}>
        <AlertCircle size={12} color="#D97706" />
        <Text style={[styles.badgeText, { color: '#D97706' }]}>Pending</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <ArrowLeft size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Timesheet & Tasks</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loaderCenter}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={{ marginTop: 10, color: '#6B7280', fontSize: 13 }}>Loading tasks...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>WorkBridge Assigned Tasks ({tasks.length})</Text>
          {tasks.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No timesheet tasks assigned currently.</Text>
            </View>
          ) : (
            tasks.map((task) => (
              <View key={task.id} style={styles.taskCard}>
                <View style={styles.taskHeader}>
                  <Text style={styles.taskTitle}>{task.title}</Text>
                  {renderStatusBadge(task.status)}
                </View>
                <View style={styles.taskFooter}>
                  <Text style={styles.priorityText}>Priority: {task.priority || 'NORMAL'}</Text>
                  {task.due_date && <Text style={styles.dueText}>Due: {task.due_date}</Text>}
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
    paddingTop: 36,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  loaderCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 14,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '500',
  },
  taskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  taskTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
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
    fontWeight: '700',
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
  },
  priorityText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  dueText: {
    fontSize: 12,
    color: '#4F46E5',
    fontWeight: '700',
  },
});
