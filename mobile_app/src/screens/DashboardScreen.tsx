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
import * as ImagePicker from 'expo-image-picker';
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
  Building2,
  Palmtree,
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
  Camera,
  RefreshCw,
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
  const [currentCoords, setCurrentCoords] = useState<{ latitude: number | null; longitude: number | null }>({
    latitude: null,
    longitude: null,
  });
  const [attendancePolicy, setAttendancePolicy] = useState<{
    allow_mobile_punch: boolean;
    allow_web_punch: boolean;
    require_selfie: boolean;
    require_gps: boolean;
  }>({
    allow_mobile_punch: true,
    allow_web_punch: true,
    require_selfie: false,
    require_gps: false,
  });

  // 2. Modals States
  const [punchModalVisible, setPunchModalVisible] = useState(false);
  const [punchModalData, setPunchModalData] = useState<{ type: 'IN' | 'OUT'; time: string; location: string }>({
    type: 'IN',
    time: '',
    location: '',
  });

  // Selfie Camera Modal States
  const [selfieModalVisible, setSelfieModalVisible] = useState(false);
  const [capturedSelfie, setCapturedSelfie] = useState<string | null>(null);
  const [capturedSelfieUri, setCapturedSelfieUri] = useState<string | null>(null);
  const [isCapturingSelfie, setIsCapturingSelfie] = useState(false);

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

  // Fetch Policy (location_tracking_interval_mins, allow_mobile_punch, require_selfie, require_gps)
  const fetchAttendancePolicy = async () => {
    try {
      const res = await apiClient.get('/api/v1/attendance/policies').catch(() => null);
      if (res?.data) {
        const policyObj = res.data.policy || (Array.isArray(res.data.policies) ? res.data.policies[0] : null) || (Array.isArray(res.data.data) ? res.data.data[0] : res.data);
        if (policyObj) {
          setAttendancePolicy({
            allow_mobile_punch: policyObj.allow_mobile_punch !== undefined && policyObj.allow_mobile_punch !== null ? Boolean(policyObj.allow_mobile_punch) : true,
            allow_web_punch: policyObj.allow_web_punch !== undefined && policyObj.allow_web_punch !== null ? Boolean(policyObj.allow_web_punch) : true,
            require_selfie: Boolean(policyObj.require_selfie),
            require_gps: Boolean(policyObj.require_gps),
          });
        }
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
          setCurrentCoords({ latitude: lat, longitude: lng });
          
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

  const takeSelfie = async () => {
    try {
      setIsCapturingSelfie(true);
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera permission is required to capture your live attendance selfie.');
        setIsCapturingSelfie(false);
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        cameraType: ImagePicker.CameraType.front,
        allowsEditing: false,
        quality: 0.3,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        // Store local file URI for instantaneous native image preview
        setCapturedSelfieUri(asset.uri);
        // Store base64 data for the backend API payload
        const base64Str = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setCapturedSelfie(base64Str);
        // Open verification modal directly with the captured photo preview
        setSelfieModalVisible(true);
      }
    } catch (err: any) {
      console.error('Camera capture error:', err);
      Alert.alert('Camera Error', err?.message || 'Failed to open camera');
    } finally {
      setIsCapturingSelfie(false);
    }
  };

  const handleTogglePunch = async () => {
    // 0. Always fetch freshest company policy from server before punching
    await fetchAttendancePolicy();

    // 1. Check Allow Mobile Punch Policy
    if (attendancePolicy.allow_mobile_punch === false) {
      Alert.alert(
        'Mobile Punch Restricted',
        'Mobile check-in is disabled by company policy. Please use Web Portal or Office Biometric device.'
      );
      return;
    }

    // 2. Check GPS Policy
    if (attendancePolicy.require_gps && (!currentCoords.latitude || !currentCoords.longitude)) {
      await fetchDeviceLocation();
      if (!currentCoords.latitude || !currentCoords.longitude) {
        Alert.alert(
          'GPS Location Required',
          'Device GPS location coordinates are mandatory for clocking in/out as per company policy. Please enable location services.'
        );
        return;
      }
    }

    // 3. Check Live Selfie Policy
    if (attendancePolicy.require_selfie) {
      setCapturedSelfie(null);
      setCapturedSelfieUri(null);
      await takeSelfie();
      return;
    }

    // Direct punch if selfie not required
    await executePunch(null);
  };

  const executePunch = async (selfieBase64: string | null) => {
    setLoading(true);
    const newStatus = !punchedIn;
    const nowISO = new Date().toISOString();
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    try {
      const isGpsRequired = attendancePolicy.require_gps === true;

      const payload: any = {
        direction: newStatus ? 'IN' : 'OUT',
        punch_type: newStatus ? 'IN' : 'OUT',
        timestamp: nowISO,
        punch_time: nowISO,
        location: isGpsRequired ? locationName : null,
        location_name: isGpsRequired ? locationName : null,
        source: 'MOBILE',
      };

      if (isGpsRequired && currentCoords.latitude && currentCoords.longitude) {
        payload.latitude = currentCoords.latitude;
        payload.longitude = currentCoords.longitude;
      }

      if (selfieBase64) {
        payload.image_url = selfieBase64;
      }

      const res = await apiClient.post('/api/v1/attendance/punches', payload);
      if (res?.data) {
        setSelfieModalVisible(false);
        setCapturedSelfie(null);
        setCapturedSelfieUri(null);
        setPunchedIn(newStatus);
        setPunchTime(nowTime);

        if (newStatus && isGpsRequired) {
          // Immediately trigger initial location ping upon Punch IN only if GPS is required
          sendLocationTrackingPing();
        }

        // Open Toast/Modal instead of browser alert
        setPunchModalData({
          type: newStatus ? 'IN' : 'OUT',
          time: nowTime,
          location: isGpsRequired ? locationName : 'GPS Disabled by Policy',
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
      setRemainingShiftText('');
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
                <MapPin size={16} color={attendancePolicy.require_gps ? "#4F46E5" : "#94A3B8"} />
                {attendancePolicy.require_gps && <View style={styles.livePulseDot} />}
              </View>
              <Text style={styles.fullLocationText}>
                {attendancePolicy.require_gps ? locationName : 'GPS Geofencing Not Required'}
              </Text>
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

          {/* Company */}
          <TouchableOpacity style={styles.appCard} onPress={() => onNavigate('Company')}>
            <View style={[styles.appIconBg, { backgroundColor: '#EFF6FF' }]}>
              <Building2 size={22} color="#2563EB" />
            </View>
            <View style={styles.appTextContainer}>
              <Text style={styles.appTitle} numberOfLines={1}>Company</Text>
              <Text style={styles.appSub} numberOfLines={1}>Profile & Branches</Text>
            </View>
          </TouchableOpacity>

          {/* Holidays */}
          <TouchableOpacity style={styles.appCard} onPress={() => onNavigate('Holidays')}>
            <View style={[styles.appIconBg, { backgroundColor: '#FDF2F8' }]}>
              <Palmtree size={22} color="#DB2777" />
            </View>
            <View style={styles.appTextContainer}>
              <Text style={styles.appTitle} numberOfLines={1}>Holidays</Text>
              <Text style={styles.appSub} numberOfLines={1}>Festival Calendar</Text>
            </View>
          </TouchableOpacity>

          {/* Week Offs */}
          <TouchableOpacity style={styles.appCard} onPress={() => onNavigate('WeekOffs')}>
            <View style={[styles.appIconBg, { backgroundColor: '#FEF3C7' }]}>
              <Coffee size={22} color="#D97706" />
            </View>
            <View style={styles.appTextContainer}>
              <Text style={styles.appTitle} numberOfLines={1}>Week Offs</Text>
              <Text style={styles.appSub} numberOfLines={1}>Roster & Policy</Text>
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
              {logoutCountdown !== null ? 'Logging Out...' : 'Shift Incomplete Warning'}
            </Text>

            <View style={styles.warningInfoBox}>
              <Text style={styles.warningShiftName}>{shiftDetails.name} ({shiftDetails.startTime} - {shiftDetails.endTime})</Text>
              {remainingShiftText ? (
                <Text style={styles.warningRemainingText}>{remainingShiftText}</Text>
              ) : null}
              <Text style={styles.warningMsgText}>
                {logoutCountdown !== null
                  ? `Logging out automatically in ${logoutCountdown} seconds... Click 'Cancel Logout' below if you changed your mind.`
                  : 'Your required 9 working hours have not yet been completed.\nIf you log out now, your attendance for today may be marked as incomplete and could affect your attendance calculation.'}
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

      {/* 7. LIVE SELFIE CAMERA CAPTURE POPUP MODAL */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={selfieModalVisible}
        onRequestClose={() => {
          if (!loading) setSelfieModalVisible(false);
        }}
      >
        <Pressable style={styles.modalOverlay} onPress={() => { if (!loading) setSelfieModalVisible(false); }}>
          <Pressable style={styles.selfieModalCard} onPress={(e) => e.stopPropagation()}>
            {/* Header */}
            <View style={styles.selfieModalHeader}>
              <View style={styles.selfieHeaderIconBadge}>
                <Camera size={22} color="#4F46E5" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.selfieModalTitle}>Live Selfie Verification</Text>
                <Text style={styles.selfieModalSubtitle}>
                  Attendance policy requires a live photo to clock {punchedIn ? 'OUT' : 'IN'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setSelfieModalVisible(false);
                  setCapturedSelfie(null);
                  setCapturedSelfieUri(null);
                }}
                disabled={loading}
                style={styles.selfieCloseBtn}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Selfie Preview or Camera Placeholder */}
            <View style={styles.selfiePreviewContainer}>
              <View style={styles.selfieImageWrapper}>
                {(capturedSelfieUri || capturedSelfie) ? (
                  <Image
                    source={{ uri: capturedSelfieUri || capturedSelfie! }}
                    style={styles.selfiePreviewImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.selfiePlaceholderBox}>
                    <View style={styles.selfieCircleCameraIcon}>
                      <Camera size={44} color="#6366F1" />
                    </View>
                    <Text style={styles.selfiePlaceholderTitle}>Take a Selfie to Punch</Text>
                    <Text style={styles.selfiePlaceholderText}>
                      Please ensure your face is clearly visible and within good lighting.
                    </Text>
                  </View>
                )}
              </View>
              {(capturedSelfieUri || capturedSelfie) && (
                <View style={styles.selfieSuccessBar}>
                  <CheckCircle size={15} color="#059669" style={{ marginRight: 6 }} />
                  <Text style={styles.selfieSuccessText}>Selfie captured successfully</Text>
                </View>
              )}
            </View>

            {/* Actions */}
            <View style={styles.selfieActionRow}>
              {(capturedSelfieUri || capturedSelfie) ? (
                <>
                  <TouchableOpacity
                    style={styles.selfieRetakeBtn}
                    onPress={takeSelfie}
                    disabled={loading || isCapturingSelfie}
                  >
                    <RefreshCw size={18} color="#475569" style={{ marginRight: 6 }} />
                    <Text style={styles.selfieRetakeBtnText}>Retake</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.selfieConfirmBtn,
                      !punchedIn ? { backgroundColor: '#10B981' } : { backgroundColor: '#EF4444' },
                    ]}
                    onPress={() => executePunch(capturedSelfie)}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <CheckCircle size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={styles.selfieConfirmBtnText}>
                          Punch {!punchedIn ? 'IN' : 'OUT'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.selfieCaptureBtn}
                  onPress={takeSelfie}
                  disabled={isCapturingSelfie}
                >
                  {isCapturingSelfie ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Camera size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={styles.selfieCaptureBtnText}>Open Camera & Take Selfie</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
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
  /* SELFIE CAMERA MODAL STYLING */
  selfieModalCard: {
    width: '90%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  selfieModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  selfieHeaderIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selfieModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  selfieModalSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  selfieCloseBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  selfiePreviewContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  selfiePlaceholderBox: {
    width: '100%',
    height: 210,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  selfieCircleCameraIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  selfiePlaceholderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  selfiePlaceholderText: {
    fontSize: 11.5,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 240,
  },
  selfieImageWrapper: {
    width: '100%',
    height: 240,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
  },
  selfiePreviewImage: {
    width: '100%',
    height: 240,
    borderRadius: 18,
  },
  selfieSuccessBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    marginTop: 10,
    width: '100%',
  },
  selfieSuccessText: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: '700',
  },
  selfieActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  selfieCaptureBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
    paddingVertical: 14,
    borderRadius: 14,
  },
  selfieCaptureBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  selfieRetakeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 13,
    borderRadius: 14,
  },
  selfieRetakeBtnText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
  },
  selfieConfirmBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 14,
  },
  selfieConfirmBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
