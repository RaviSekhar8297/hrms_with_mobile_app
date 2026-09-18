import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
  Image,
} from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { apiClient } from '../config/api';
import {
  Clock,
  MapPin,
  ArrowLeft,
  CheckCircle,
  ShieldAlert,
  Camera,
  RefreshCw,
  X,
} from 'lucide-react-native';

interface AttendanceProps {
  onBack: () => void;
}

export const AttendanceScreen: React.FC<AttendanceProps> = ({ onBack }) => {
  const [punchedIn, setPunchedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locationName, setLocationName] = useState('Fetching GPS Location...');
  const [lastPunchTime, setLastPunchTime] = useState<string | null>(null);

  // Policy & Location States
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

  // Selfie Camera Modal States
  const [selfieModalVisible, setSelfieModalVisible] = useState(false);
  const [capturedSelfie, setCapturedSelfie] = useState<string | null>(null);
  const [isCapturingSelfie, setIsCapturingSelfie] = useState(false);

  useEffect(() => {
    fetchAttendancePolicy();
    fetchDeviceLocation();
    fetchTodayStatus();
  }, []);

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
      }
    } catch (e) {}
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

          const coordText = `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;
          setLocationName(coordText);

          try {
            const reverseGeocode = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
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
          } catch (geoErr) {}
          return;
        }
      }
    } catch (e) {
      console.warn('GPS Location fetch fallback:', e);
    }
    setLocationName('Lat: 17.425716, Lng: 78.420277');
  };

  const fetchTodayStatus = async () => {
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
          setLastPunchTime(`${isIN ? 'IN' : 'OUT'} at ${t}`);
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
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const base64Str = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setCapturedSelfie(base64Str);
      }
    } catch (err: any) {
      console.error('Camera capture error:', err);
      Alert.alert('Camera Error', err?.message || 'Failed to open camera');
    } finally {
      setIsCapturingSelfie(false);
    }
  };

  const handlePunch = async () => {
    // 0. Always fetch freshest company policy from server before punching
    await fetchAttendancePolicy();

    if (attendancePolicy.allow_mobile_punch === false) {
      Alert.alert(
        'Mobile Punch Restricted',
        'Mobile check-in is disabled by company policy. Please use Web Portal or Office Biometric device.'
      );
      return;
    }

    if (attendancePolicy.require_gps && (!currentCoords.latitude || !currentCoords.longitude)) {
      await fetchDeviceLocation();
      if (!currentCoords.latitude || !currentCoords.longitude) {
        Alert.alert(
          'GPS Location Required',
          'GPS location coordinates are mandatory for punching as per company policy. Please enable device location.'
        );
        return;
      }
    }

    if (attendancePolicy.require_selfie) {
      setCapturedSelfie(null);
      setSelfieModalVisible(true);
      return;
    }

    await executePunch(null);
  };

  const executePunch = async (selfieBase64: string | null) => {
    setLoading(true);
    try {
      const isGpsRequired = attendancePolicy.require_gps === true;
      const punchType = punchedIn ? 'OUT' : 'IN';
      const timestamp = new Date().toISOString();

      const payload: any = {
        direction: punchType,
        punch_type: punchType,
        timestamp,
        punch_time: timestamp,
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

      await apiClient.post('/api/v1/attendance/punches', payload);

      const timeFormatted = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setSelfieModalVisible(false);
      setCapturedSelfie(null);
      setPunchedIn(!punchedIn);
      setLastPunchTime(`${punchType} at ${timeFormatted}`);
      Alert.alert('Success', `Successfully Punched ${punchType} at ${timeFormatted}`);
    } catch (error: any) {
      console.error('Punch error:', error);
      const errMsg = error?.response?.data?.error || error?.message || 'Failed to record punch';
      Alert.alert('Punch Error', errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <ArrowLeft size={20} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Attendance & GPS</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Status Card */}
        <View style={styles.statusCard}>
          <Clock size={40} color={punchedIn ? '#10B981' : '#6B7280'} />
          <Text style={styles.statusTitle}>
            {punchedIn ? 'Currently On Duty' : 'Not Punched In'}
          </Text>
          {lastPunchTime && (
            <Text style={styles.lastPunchText}>Last Action: {lastPunchTime}</Text>
          )}

          {/* Location Badge */}
          <View style={styles.locationBadge}>
            <MapPin size={16} color={attendancePolicy.require_gps ? "#4F46E5" : "#94A3B8"} />
            <Text style={styles.locationText}>{attendancePolicy.require_gps ? locationName : 'GPS Geofencing Not Required'}</Text>
          </View>

          {/* Big Punch Button */}
          <TouchableOpacity
            style={[styles.bigPunchBtn, punchedIn ? styles.btnOut : styles.btnIn]}
            onPress={handlePunch}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="large" />
            ) : (
              <>
                <Text style={styles.bigPunchText}>
                  {punchedIn ? 'PUNCH OUT' : 'PUNCH IN'}
                </Text>
                <Text style={styles.bigPunchSub}>Tap to register timestamp</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Attendance Log History */}
        <Text style={styles.sectionHeader}>Today's Logs</Text>
        <View style={styles.logList}>
          {lastPunchTime ? (
            <View style={styles.logItem}>
              <CheckCircle size={20} color="#10B981" />
              <View style={styles.logInfo}>
                <Text style={styles.logTitle}>{lastPunchTime}</Text>
                <Text style={styles.logSub}>Verified via {attendancePolicy.require_selfie ? 'Live Selfie & ' : ''}GPS</Text>
              </View>
            </View>
          ) : (
            <View style={styles.emptyLog}>
              <ShieldAlert size={24} color="#9CA3AF" />
              <Text style={styles.emptyText}>No punch records logged yet today.</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* LIVE SELFIE CAMERA CAPTURE POPUP MODAL */}
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
                onPress={() => setSelfieModalVisible(false)}
                disabled={loading}
                style={styles.selfieCloseBtn}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Selfie Preview or Camera Placeholder */}
            <View style={styles.selfiePreviewContainer}>
              {capturedSelfie ? (
                <View style={styles.selfieImageWrapper}>
                  <Image source={{ uri: capturedSelfie }} style={styles.selfiePreviewImage} resizeMode="cover" />
                  <View style={styles.selfieVerifiedBadge}>
                    <CheckCircle size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                    <Text style={styles.selfieVerifiedText}>Photo Captured</Text>
                  </View>
                </View>
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

            {/* Actions */}
            <View style={styles.selfieActionRow}>
              {capturedSelfie ? (
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
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 24,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 12,
  },
  lastPunchText: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 12,
    gap: 6,
  },
  locationText: {
    fontSize: 12,
    color: '#4F46E5',
    fontWeight: '500',
  },
  bigPunchBtn: {
    width: '100%',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 24,
  },
  btnIn: {
    backgroundColor: '#4F46E5',
  },
  btnOut: {
    backgroundColor: '#EF4444',
  },
  bigPunchText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
  bigPunchSub: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  logList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  logItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logInfo: {
    flex: 1,
  },
  logTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  logSub: {
    fontSize: 12,
    color: '#6B7280',
  },
  emptyLog: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  /* MODAL STYLES */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  selfieModalCard: {
    width: '92%',
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
    height: 230,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000000',
  },
  selfiePreviewImage: {
    width: '100%',
    height: '100%',
  },
  selfieVerifiedBadge: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.92)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  selfieVerifiedText: {
    color: '#FFFFFF',
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
