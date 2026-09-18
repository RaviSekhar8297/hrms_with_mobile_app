import { Buffer } from 'buffer';
const g = globalThis as any;
g.Buffer = g.Buffer || Buffer;

import React, { useContext, useState } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, AuthContext } from './src/context/AuthContext';
import { LoginScreen } from './src/screens/LoginScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { AttendanceScreen } from './src/screens/AttendanceScreen';
import { TasksScreen } from './src/screens/TasksScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { LeavesScreen } from './src/screens/LeavesScreen';
import { EmployeesScreen } from './src/screens/EmployeesScreen';
import { PayrollScreen } from './src/screens/PayrollScreen';
import { VisitorsScreen } from './src/screens/VisitorsScreen';
import { RecruitmentScreen } from './src/screens/RecruitmentScreen';
import { ShiftsScreen } from './src/screens/ShiftsScreen';
import { AttendanceRequestsScreen } from './src/screens/AttendanceRequestsScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { AIAssistantScreen } from './src/screens/AIAssistantScreen';
import { AnalyticsScreen } from './src/screens/AnalyticsScreen';
import { CompanyScreen } from './src/screens/CompanyScreen';
import { HolidaysScreen } from './src/screens/HolidaysScreen';
import { WeekOffsScreen } from './src/screens/WeekOffsScreen';

type ScreenType =
  | 'Dashboard'
  | 'Attendance'
  | 'Tasks'
  | 'Leaves'
  | 'Employees'
  | 'Payroll'
  | 'Visitors'
  | 'Recruitment'
  | 'Shifts'
  | 'AttendanceRequests'
  | 'Onboarding'
  | 'AIAssistant'
  | 'Analytics'
  | 'Company'
  | 'Holidays'
  | 'WeekOffs'
  | 'Profile';

const MainNavigator = () => {
  const { userToken, isLoading } = useContext(AuthContext);
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('Dashboard');

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  if (!userToken) {
    return <LoginScreen />;
  }

  switch (currentScreen) {
    case 'Attendance':
      return <AttendanceScreen onBack={() => setCurrentScreen('Dashboard')} />;
    case 'Tasks':
      return <TasksScreen onBack={() => setCurrentScreen('Dashboard')} />;
    case 'Leaves':
      return <LeavesScreen onBack={() => setCurrentScreen('Dashboard')} />;
    case 'Employees':
      return <EmployeesScreen onBack={() => setCurrentScreen('Dashboard')} />;
    case 'Payroll':
      return <PayrollScreen onBack={() => setCurrentScreen('Dashboard')} />;
    case 'Visitors':
      return <VisitorsScreen onBack={() => setCurrentScreen('Dashboard')} />;
    case 'Recruitment':
      return <RecruitmentScreen onBack={() => setCurrentScreen('Dashboard')} />;
    case 'Shifts':
      return <ShiftsScreen onBack={() => setCurrentScreen('Dashboard')} />;
    case 'AttendanceRequests':
      return <AttendanceRequestsScreen onBack={() => setCurrentScreen('Dashboard')} />;
    case 'Onboarding':
      return <OnboardingScreen onBack={() => setCurrentScreen('Dashboard')} />;
    case 'AIAssistant':
      return <AIAssistantScreen onBack={() => setCurrentScreen('Dashboard')} />;
    case 'Analytics':
      return <AnalyticsScreen onBack={() => setCurrentScreen('Dashboard')} />;
    case 'Company':
      return <CompanyScreen onBack={() => setCurrentScreen('Dashboard')} />;
    case 'Holidays':
      return <HolidaysScreen onBack={() => setCurrentScreen('Dashboard')} />;
    case 'WeekOffs':
      return <WeekOffsScreen onBack={() => setCurrentScreen('Dashboard')} />;
    case 'Profile':
      return <ProfileScreen onBack={() => setCurrentScreen('Dashboard')} />;
    case 'Dashboard':
    default:
      return <DashboardScreen onNavigate={(screen: any) => setCurrentScreen(screen)} />;
  }
};

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="auto" />
      <MainNavigator />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
