import React, { useContext, useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Image,
  Platform,
  Alert,
  Dimensions,
  Modal,
  Pressable,
} from 'react-native';
import * as Location from 'expo-location';
import { AuthContext } from '../context/AuthContext';
import { apiClient, getImageUrl } from '../config/api';
import {
  Bell,
  LogOut,
  Clock,
  CheckSquare,
  User,
  Calendar,
  Users,
  DollarSign,
  UserCheck,
  Building,
  FileCheck,
  UserPlus,
  TrendingUp,
  MapPin,
  Home,
  Mic,
  Coffee,
  Briefcase,
  CheckCircle,
  AlertTriangle,
  X,
  Sparkles,
} from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.floor((SCREEN_WIDTH - 42) / 2);

interface DashboardProps {
  onNavigate: (screen: string) => void;
}

export const DashboardScreen: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { user, logout } = useContext(AuthContext);
  const [punchedIn, setPunchedIn] = useState(false);
  const [punchTime, setPunchTime] = useState<string | null>(null);
  const [locationName, setLocationName] = useState('Fetching GPS Location...');
  const [loading, setLoading] = useState(false);

  // 1. Dynamic Policy & Shift States
  const [trackingIntervalMins, setTrackingIntervalMins] = useState<number>(15);
  const [shiftDetails, setShiftDetails] = useState({
    name: 'General Shift',
    startTime: '09:30',
    endTime: '18:30',
  });

  // 2. Modals States
  const [punchModalVisible, setPunchModalVisible] = useState(false);
  const [punchModalData, setPunchModalData] = useState<{ type: 'IN' | 'OUT'; time: string; location: string }>({
    type: 'IN',
    time: '',
    location: '',
  });

  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [remainingShiftText, setRemainingShiftText] = useState('');
  const [logoutCountdown, setLogoutCountdown] = useState<number | null>(null);

  const trackingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startLogoutCountdown = () => {
    if (logoutTimerRef.current) clearInterval(logoutTimerRef.current);
    setLogoutCountdown(5);

    let current = 5;
    logoutTimerRef.current = setInterval(() => {
      current -= 1;
      if (current <= 0) {
        if (logoutTimerRef.current) clearInterval(logoutTimerRef.current);
        logoutTimerRef.current = null;
        setLogoutCountdown(null);
        setLogoutModalVisible(false);
        stopLocationTrackingLoop();
        logout();
      } else {
        setLogoutCountdown(current);
      }
    }, 1000);
  };

  const cancelLogoutCountdown = () => {
    if (logoutTimerRef.current) {
      clearInterval(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
    setLogoutCountdown(null);
    setLogoutModalVisible(false);
  };

  // Dynamic user header data
  const displayName = user?.name || `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.email?.split('@')[0] || 'User';
  const displayDesignation = user?.designation || user?.role || '';
  const userInitials = displayName.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U';

  const rawAvatar = user?.emp_image;
  const avatarUri = getImageUrl(rawAvatar);

  useEffect(() => {
    fetchLiveStatus();
    fetchDeviceLocation();
    fetchAttendancePolicy();
    fetchEmployeeShift();
  }, []);

  // 3. Dynamic Location Tracking Loop
  useEffect(() => {
    if (punchedIn && trackingIntervalMins && trackingIntervalMins > 0) {
      startLocationTrackingLoop();
    } else {
      stopLocationTrackingLoop();
    }
    return () => stopLocationTrackingLoop();
  }, [punchedIn, trackingIntervalMins, shiftDetails.endTime]);

  const startLocationTrackingLoop = () => {
    stopLocationTrackingLoop();
    if (!trackingIntervalMins || trackingIntervalMins <= 0) return;

    const intervalMs = trackingIntervalMins * 60 * 1000;
    
    // Initial track ping
    sendLocationTrackingPing();

    trackingTimerRef.current = setInterval(() => {
      // Check if current time exceeds shift end time (18:30)
      if (isShiftEnded(shiftDetails.endTime)) {
        stopLocationTrackingLoop();
        return;
      }
      sendLocationTrackingPing();
    }, intervalMs);
  };

  const stopLocationTrackingLoop = () => {
    if (trackingTimerRef.current) {
      clearInterval(trackingTimerRef.current);
      trackingTimerRef.current = null;
    }
  };

  const sendLocationTrackingPing = async () => {
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null);
      const lat = loc?.coords?.latitude ?? 17.4257163;
      const lng = loc?.coords?.longitude ?? 78.4202773;
      const displayLocation = locationName && !locationName.includes('Fetching') ? locationName : `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;

      await apiClient.post('/api/v1/attendance/live-location', {
        latitude: lat,
        longitude: lng,
        location_name: displayLocation,
      }).catch((e) => console.log('Live location ping API error:', e));
    } catch (e) {
      // Silent catch
    }
  };

  const isShiftEnded = (endTimeStr: string): boolean => {
    try {
      const [endH, endM] = endTimeStr.split(':').map(Number);
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const endMinutes = (endH || 18) * 60 + (endM || 30);
      return currentMinutes >= endMinutes;
    } catch (e) {
      return false;
    }
  };

  // Fetch Policy (location_tracking_interval_mins / location_tracking_interval_min)
  const fetchAttendancePolicy = async () => {
    try {
      const res = await apiClient.get('/api/v1/attendance/policies').catch(() => null);
      if (res?.data) {
        const policyObj = res.data.policy || (Array.isArray(res.data.policies) ? res.data.policies[0] : null) || (Array.isArray(res.data.data) ? res.data.data[0] : res.data);
        const interval = policyObj?.location_tracking_interval_mins ?? policyObj?.location_tracking_interval_min;
        if (interval !== undefined && interval !== null && !isNaN(Number(interval)) && Number(interval) > 0) {
          setTrackingIntervalMins(Number(interval));
        }
      }
    } catch (e) {}
  };

  // Fetch Employee Shift from employee_shifts / shift_masters (Fallback: 09:30 to 18:30)
  const fetchEmployeeShift = async () => {
    try {
      const res = await apiClient.get('/api/v1/employee-shifts').catch(() => null);
      const shifts = res?.data?.employeeShifts || res?.data?.shifts || (Array.isArray(res?.data) ? res.data : []);
      if (Array.isArray(shifts) && shifts.length > 0) {
        const s = shifts[0];
        setShiftDetails({
          name: s.shift_name || s.name || 'General Shift',
          startTime: s.start_time || '09:30',
          endTime: s.end_time || '18:30',
        });
      }
    } catch (e) {
      // Default fallback: 09:30 to 18:30
    }
  };

  const fetchDeviceLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (loc?.coords) {
          const lat = loc.coords.latitude;
          const lng = loc.coords.longitude;
          
          // Instant Lat/Lng coordinate display
          const coordText = `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;
          setLocationName(coordText);

          // Reverse geocode in background for readable address if available
          try {
            const reverseGeocode = await Location.reverseGeocodeAsync({
              latitude: lat,
              longitude: lng,
            });
            if (reverseGeocode && reverseGeocode.length > 0) {
              const item = reverseGeocode[0];
              const street = (item.streetNumber || item.street) ? `${item.streetNumber || ''} ${item.street || ''}`.trim() : '';
              const subLocality = item.district || item.subregion || item.name || '';
              const city = item.city || item.region || '';
              const postalCode = item.postalCode ? ` - ${item.postalCode}` : '';
              
              const fullAddress = [street, subLocality, city].filter(Boolean).join(', ') + postalCode;
              if (fullAddress) {
                setLocationName(fullAddress);
              }
            }
          } catch (geoErr) {
            // Keep Lat/Lng display if address lookup fails
          }
          return;
        }
      }
    } catch (e) {
      console.warn('GPS Location fetch fallback:', e);
    }
    setLocationName('Lat: 17.425716, Lng: 78.420277');
  };

  const fetchLiveStatus = async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const res = await apiClient.get(`/api/v1/attendance/punches?start_date=${todayStr}&end_date=${todayStr}&scope=SELF`).catch(() => null);
      const punchesList = Array.isArray(res?.data?.data)
        ? res.data.data
        : Array.isArray(res?.data?.punches)
        ? res.data.punches
        : Array.isArray(res?.data)
        ? res.data
        : [];

      if (punchesList.length > 0) {
        const lastPunch = punchesList[0];
        const isIN = lastPunch.direction === 'IN' || lastPunch.punch_type === 'IN';
        setPunchedIn(isIN);
        if (lastPunch.punch_time) {
          const t = new Date(lastPunch.punch_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          setPunchTime(t);
        }
        if (lastPunch.location_name) {
          setLocationName(lastPunch.location_name);
        }
      }
    } catch (e) {}
  };

  const handleTogglePunch = async () => {
    setLoading(true);
    const newStatus = !punchedIn;
    const nowISO = new Date().toISOString();
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    try {
      const payload = {
        direction: newStatus ? 'IN' : 'OUT',
        punch_type: newStatus ? 'IN' : 'OUT',
        timestamp: nowISO,
        punch_time: nowISO,
        location: locationName,
        location_name: locationName,
        source: 'MOBILE',
      };

      const res = await apiClient.post('/api/v1/attendance/punches', payload);
      if (res?.data) {
        setPunchedIn(newStatus);
        setPunchTime(nowTime);

        if (newStatus) {
          // Immediately trigger initial location ping upon Punch IN
          sendLocationTrackingPing();
        }

        // Open Toast/Modal instead of browser alert
        setPunchModalData({
          type: newStatus ? 'IN' : 'OUT',
          time: nowTime,
          location: locationName,
        });
        setPunchModalVisible(true);
      }
    } catch (e: any) {
      console.error('Punch Error:', e);
      const errMsg = e?.response?.data?.error || e?.message || 'Failed to record punch';
      Alert.alert('Punch Error', errMsg);
    } finally {
      setLoading(false);
    }
  };

  // 4. Smart Logout Press Handler
  const handleLogoutPress = async () => {
    let isCurrentlyPunchedIn = punchedIn;

    // Double-check live status from backend if state was not yet updated
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const res = await apiClient.get(`/api/v1/attendance/punches?start_date=${todayStr}&end_date=${todayStr}&scope=SELF`).catch(() => null);
      const punchesList = Array.isArray(res?.data?.data)
        ? res.data.data
        : Array.isArray(res?.data?.punches)
        ? res.data.punches
        : Array.isArray(res?.data)
        ? res.data
        : [];

      if (punchesList.length > 0) {
        const lastPunch = punchesList[0];
        isCurrentlyPunchedIn = lastPunch.direction === 'IN' || lastPunch.punch_type === 'IN';
        if (isCurrentlyPunchedIn) {
          setPunchedIn(true);
        }
      }
    } catch (e) {}

    // Check if shift is still active
    const now = new Date();
    const [endH, endM] = shiftDetails.endTime.split(':').map(Number);
    const endMinutes = (endH || 18) * 60 + (endM || 30);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    if (isCurrentlyPunchedIn && currentMinutes < endMinutes) {
      const diffMins = endMinutes - currentMinutes;
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      setRemainingShiftText(`Remaining Shift: ${hours > 0 ? `${hours} Hours ` : ''}${mins} Minutes`);
    } else {
      setRemainingShiftText('Are you sure you want to log out of your session?');
    }

    // ALWAYS open Logout Modal with 5-second countdown option
    setLogoutModalVisible(true);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* 1. TOP HEADER */}
      <View style={styles.topHeader}>
        <TouchableOpacity style={styles.avatarButton} onPress={() => onNavigate('Profile')}>
          <View style={styles.avatarCircle}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarInitials}>{userInitials}</Text>
            )}
          </View>
        </TouchableOpacity>

        <View style={styles.headerInfoContainer}>
          <Text style={styles.userNameText}>{displayName}</Text>
          <Text style={styles.companyNameText}>{displayDesignation}</Text>
        </View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity style={styles.headerIconCircle} onPress={() => onNavigate('AttendanceRequests')}>
            <Bell size={20} color="#374151" />
            <View style={styles.badgeDot}>
              <Text style={styles.badgeDotText}>3</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.headerIconCircle, { backgroundColor: '#FEE2E2' }]} onPress={handleLogoutPress}>
            <LogOut size={18} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 2. REFINED ATTENDANCE BANNER CARD */}
        <View style={styles.heroPunchCard}>
          {/* Top Status Info */}
          <View style={styles.punchHeaderRow}>
            <View style={styles.clockIconBg}>
              <Clock size={22} color="#4F46E5" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.punchCardTitle}>Daily Attendance</Text>
              <Text style={styles.punchStatusSubtitle}>
                {punchedIn ? `Status: Punched In at ${punchTime}` : 'Status: Not Punched In Today'}
              </Text>
            </View>
            <TouchableOpacity style={styles.breakChip}>
              <Coffee size={14} color="#D97706" style={{ marginRight: 4 }} />
              <Text style={styles.breakChipText}>Break</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.cardDivider} />

          {/* Bottom Split: Location (Left) | Punch Button (Right) */}
          <View style={styles.punchBottomSplit}>
            <View style={styles.locationSide}>
              <View style={styles.locationTitleRow}>
                <MapPin size={16} color="#4F46E5" />
                <View style={styles.livePulseDot} />
              </View>
              <Text style={styles.fullLocationText}>{locationName}</Text>
            </View>

            <View style={styles.punchBtnSide}>
              <TouchableOpacity
                style={[styles.mainPunchButton, punchedIn ? styles.punchOutBg : styles.punchInBg]}
                onPress={handleTogglePunch}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.mainPunchButtonText}>PUNCH</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 3. HRMS MODULES GRID - ALWAYS EXACTLY 2 CARDS PER ROW */}
        <Text style={styles.sectionHeading}>HRMS Applications & Services</Text>
        <View style={styles.grid}>
          {/* Profile Card */}
          <TouchableOpacity style={styles.appCard} onPress={() => onNavigate('Profile')}>
            <View style={[styles.appIconBg, { backgroundColor: '#EEF2FF' }]}>
              <User size={22} color="#4F46E5" />
            </View>
            <View style={styles.appTextContainer}>
              <Text style={styles.appTitle} numberOfLines={1}>My Profile</Text>
              <Text style={styles.appSub} numberOfLines={1}>Personal & Work</Text>
            </View>
          </TouchableOpacity>

          {/* Employees Directory / Team */}
          <TouchableOpacity style={styles.appCard} onPress={() => onNavigate('Employees')}>
            <View style={[styles.appIconBg, { backgroundColor: '#DCFCE7' }]}>
              <Users size={22} color="#16A34A" />
            </View>
            <View style={styles.appTextContainer}>
              <Text style={styles.appTitle} numberOfLines={1}>Employees</Text>
              <Text style={styles.appSub} numberOfLines={1}>Team Directory</Text>
            </View>
          </TouchableOpacity>

          {/* Leave Plan */}
          <TouchableOpacity style={styles.appCard} onPress={() => onNavigate('Leaves')}>
            <View style={[styles.appIconBg, { backgroundColor: '#E0F2FE' }]}>
              <Calendar size={22} color="#0284C7" />
            </View>
            <View style={styles.appTextContainer}>
              <Text style={styles.appTitle} numberOfLines={1}>Leave Plan</Text>
              <Text style={styles.appSub} numberOfLines={1}>Apply & Balance</Text>
            </View>
          </TouchableOpacity>

          {/* Attendance Logs */}
          <TouchableOpacity style={styles.appCard} onPress={() => onNavigate('Attendance')}>
            <View style={[styles.appIconBg, { backgroundColor: '#F3E8FF' }]}>
              <Clock size={22} color="#9333EA" />
            </View>
            <View style={styles.appTextContainer}>
              <Text style={styles.appTitle} numberOfLines={1}>Attendance</Text>
              <Text style={styles.appSub} numberOfLines={1}>Punch & GPS Logs</Text>
            </View>
          </TouchableOpacity>

          {/* WorkBridge Tasks */}
          <TouchableOpacity style={styles.appCard} onPress={() => onNavigate('Tasks')}>
            <View style={[styles.appIconBg, { backgroundColor: '#FEF3C7' }]}>
              <CheckSquare size={22} color="#D97706" />
            </View>
            <View style={styles.appTextContainer}>
              <Text style={styles.appTitle} numberOfLines={1}>WorkBridge</Text>
              <Text style={styles.appSub} numberOfLines={1}>Tasks & Projects</Text>
            </View>
          </TouchableOpacity>

          {/* Payroll */}
          <TouchableOpacity style={styles.appCard} onPress={() => onNavigate('Payroll')}>
            <View style={[styles.appIconBg, { backgroundColor: '#D1FAE5' }]}>
              <DollarSign size={22} color="#059669" />
            </View>
            <View style={styles.appTextContainer}>
              <Text style={styles.appTitle} numberOfLines={1}>Payroll</Text>
              <Text style={styles.appSub} numberOfLines={1}>Salary & Payslips</Text>
            </View>
          </TouchableOpacity>

          {/* Visitors */}
          <TouchableOpacity style={styles.appCard} onPress={() => onNavigate('Visitors')}>
            <View style={[styles.appIconBg, { backgroundColor: '#FCE7F3' }]}>
              <UserCheck size={22} color="#DB2777" />
            </View>
            <View style={styles.appTextContainer}>
              <Text style={styles.appTitle} numberOfLines={1}>Visitors</Text>
              <Text style={styles.appSub} numberOfLines={1}>Gate Pass Logs</Text>
            </View>
          </TouchableOpacity>

          {/* Assets */}
          <TouchableOpacity style={styles.appCard} onPress={() => onNavigate('Assets')}>
            <View style={[styles.appIconBg, { backgroundColor: '#E0E7FF' }]}>
              <Building size={22} color="#4338CA" />
            </View>
            <View style={styles.appTextContainer}>
              <Text style={styles.appTitle} numberOfLines={1}>My Assets</Text>
              <Text style={styles.appSub} numberOfLines={1}>Laptops & Hardware</Text>
            </View>
          </TouchableOpacity>

          {/* Documents */}
          <TouchableOpacity style={styles.appCard} onPress={() => onNavigate('Documents')}>
            <View style={[styles.appIconBg, { backgroundColor: '#CCFBF1' }]}>
              <FileCheck size={22} color="#0D9488" />
            </View>
            <View style={styles.appTextContainer}>
              <Text style={styles.appTitle} numberOfLines={1}>Documents</Text>
              <Text style={styles.appSub} numberOfLines={1}>Letters & Policies</Text>
            </View>
          </TouchableOpacity>

          {/* Recruitment */}
          <TouchableOpacity style={styles.appCard} onPress={() => onNavigate('Recruitment')}>
            <View style={[styles.appIconBg, { backgroundColor: '#FFEDD5' }]}>
              <UserPlus size={22} color="#EA580C" />
            </View>
            <View style={styles.appTextContainer}>
              <Text style={styles.appTitle} numberOfLines={1}>Recruitment</Text>
              <Text style={styles.appSub} numberOfLines={1}>Jobs & Hiring</Text>
            </View>
          </TouchableOpacity>

          {/* Onboarding */}
          <TouchableOpacity style={styles.appCard} onPress={() => onNavigate('Onboarding')}>
            <View style={[styles.appIconBg, { backgroundColor: '#F1F5F9' }]}>
              <Briefcase size={22} color="#475569" />
            </View>
            <View style={styles.appTextContainer}>
              <Text style={styles.appTitle} numberOfLines={1}>Onboarding</Text>
              <Text style={styles.appSub} numberOfLines={1}>New Joinees</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* 4. BOTTOM TAB NAV */}
      <View style={styles.bottomTabBar}>
        <TouchableOpacity style={styles.bottomTabItem} onPress={() => onNavigate('Dashboard')}>
          <Home size={22} color="#4F46E5" />
          <Text style={[styles.bottomTabText, { color: '#4F46E5', fontWeight: '700' }]}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bottomTabItem} onPress={() => onNavigate('Attendance')}>
          <Clock size={22} color="#6B7280" />
          <Text style={styles.bottomTabText}>Attendance</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.centerMicFab} onPress={() => onNavigate('AIAssistant')}>
          <Mic size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.bottomTabItem} onPress={() => onNavigate('Tasks')}>
          <CheckSquare size={22} color="#6B7280" />
          <Text style={styles.bottomTabText}>Timesheet</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bottomTabItem} onPress={() => onNavigate('Profile')}>
          <User size={22} color="#6B7280" />
          <Text style={styles.bottomTabText}>Profile</Text>
        </TouchableOpacity>
      </View>

      {/* 5. SLEEK ANIMATED PUNCH CONFIRMATION MODAL */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={punchModalVisible}
        onRequestClose={() => setPunchModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setPunchModalVisible(false)}>
          <Pressable style={styles.punchModalCard} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.punchModalHeaderBg, punchModalData.type === 'IN' ? { backgroundColor: '#D1FAE5' } : { backgroundColor: '#FEE2E2' }]}>
              <View style={[styles.punchIconCircle, punchModalData.type === 'IN' ? { backgroundColor: '#10B981' } : { backgroundColor: '#EF4444' }]}>
                <CheckCircle size={32} color="#FFFFFF" />
              </View>
            </View>

            <Text style={styles.punchModalTitle}>
              {punchModalData.type === 'IN' ? 'PUNCH IN SUCCESSFUL' : 'PUNCH OUT SUCCESSFUL'}
            </Text>
            
            <View style={styles.punchDetailsBox}>
              <View style={styles.punchDetailRow}>
                <Clock size={16} color="#4F46E5" />
                <Text style={styles.punchDetailLabel}>Timestamp:</Text>
                <Text style={styles.punchDetailVal}>{punchModalData.time}</Text>
              </View>

              <View style={styles.punchDetailRow}>
                <MapPin size={16} color="#4F46E5" />
                <Text style={styles.punchDetailLabel}>Location:</Text>
                <Text style={styles.punchDetailVal} numberOfLines={2}>{punchModalData.location}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.modalDoneBtn, punchModalData.type === 'IN' ? { backgroundColor: '#10B981' } : { backgroundColor: '#EF4444' }]}
              onPress={() => setPunchModalVisible(false)}
            >
              <Sparkles size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.modalDoneBtnText}>Done</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 6. SMART LOGOUT SHIFT WARNING MODAL */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={logoutModalVisible}
        onRequestClose={cancelLogoutCountdown}
      >
        <Pressable style={styles.modalOverlay} onPress={cancelLogoutCountdown}>
          <Pressable style={styles.warningModalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.warningIconHeader}>
              <AlertTriangle size={34} color={logoutCountdown !== null ? '#DC2626' : '#EA580C'} />
            </View>

            <Text style={styles.warningModalTitle}>
              {logoutCountdown !== null ? 'Logging Out...' : 'Shift Incomplete Warning ⚠️'}
            </Text>

            <View style={styles.warningInfoBox}>
              <Text style={styles.warningShiftName}>{shiftDetails.name} ({shiftDetails.startTime} - {shiftDetails.endTime})</Text>
              <Text style={styles.warningRemainingText}>{remainingShiftText}</Text>
              <Text style={styles.warningMsgText}>
                {logoutCountdown !== null
                  ? `Logging out automatically in ${logoutCountdown} seconds... Click 'Cancel Logout' below if you changed your mind.`
                  : 'Your daily shift is not complete yet. If you log out now, automatic background location tracking will stop and your shift hours may be affected.'}
              </Text>
            </View>

            <View style={styles.warningActionButtons}>
              <TouchableOpacity
                style={styles.stayLoggedInBtn}
                onPress={cancelLogoutCountdown}
              >
                <Text style={styles.stayLoggedInText}>
                  {logoutCountdown !== null ? 'Cancel Logout' : 'Stay Logged In'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmLogoutBtn,
                  logoutCountdown !== null && { backgroundColor: '#FCA5A5', opacity: 0.8 }
                ]}
                disabled={logoutCountdown !== null}
                onPress={startLogoutCountdown}
              >
                <Text style={styles.confirmLogoutText}>
                  {logoutCountdown !== null ? `Logging out in ${logoutCountdown}s...` : 'Proceed to Logout'}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: 36,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  avatarButton: {
    marginRight: 12,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4F46E5',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  avatarInitials: {
    fontSize: 15,
    fontWeight: '800',
    color: '#4F46E5',
  },
  headerInfoContainer: {
    flex: 1,
  },
  userNameText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  companyNameText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 1,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeDotText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  heroPunchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  punchHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clockIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  punchCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  punchStatusSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  breakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  breakChipText: {
    color: '#D97706',
    fontWeight: '700',
    fontSize: 12,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  punchBottomSplit: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    gap: 12,
  },
  locationSide: {
    flex: 1.3,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    justifyContent: 'center',
  },
  locationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  fullLocationText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0F172A',
    lineHeight: 16,
  },
  livePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
    marginLeft: 'auto',
  },
  punchBtnSide: {
    flex: 0.9,
    justifyContent: 'center',
  },
  mainPunchButton: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  punchInBg: {
    backgroundColor: '#10B981',
  },
  punchOutBg: {
    backgroundColor: '#EF4444',
  },
  mainPunchButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.8,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  appCard: {
    width: CARD_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  appIconBg: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appTextContainer: {
    flex: 1,
  },
  appTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  appSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  bottomTabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    height: Platform.OS === 'ios' ? 82 : 70,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  bottomTabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    minWidth: 50,
  },
  bottomTabText: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 3,
  },
  centerMicFab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -24,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },

  /* MODALS STYLING */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  punchModalCard: {
    width: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  punchModalHeaderBg: {
    width: '100%',
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  punchIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  punchModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 14,
    letterSpacing: 0.5,
  },
  punchDetailsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    width: '88%',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
    marginBottom: 18,
  },
  punchDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  punchDetailLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  punchDetailVal: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  modalDoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '88%',
    height: 48,
    borderRadius: 14,
  },
  modalDoneBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },

  /* WARNING MODAL */
  warningModalCard: {
    width: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  warningIconHeader: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFEDD5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  warningModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  warningInfoBox: {
    backgroundColor: '#FFF7ED',
    borderRadius: 14,
    padding: 14,
    width: '100%',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    alignItems: 'center',
    marginBottom: 18,
  },
  warningShiftName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#C2410C',
  },
  warningRemainingText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EA580C',
    marginTop: 4,
  },
  warningMsgText: {
    fontSize: 12,
    color: '#7C2D12',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  warningActionButtons: {
    width: '100%',
    gap: 10,
  },
  stayLoggedInBtn: {
    backgroundColor: '#10B981',
    borderRadius: 14,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stayLoggedInText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  confirmLogoutBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 14,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmLogoutText: {
    color: '#EF4444',
    fontWeight: '700',
    fontSize: 13,
  },
});
