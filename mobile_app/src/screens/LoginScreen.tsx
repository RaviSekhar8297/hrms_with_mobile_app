import React, { useState, useContext, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ScrollView,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path } from 'react-native-svg';
import { AuthContext } from '../context/AuthContext';
import {
  LogIn,
  Mail,
  Lock,
  Building2,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  Sparkles,
} from 'lucide-react-native';

// Official SVG Brand Logos
const GoogleLogo = ({ size = 24 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <Path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <Path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      fill="#FBBC05"
    />
    <Path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      fill="#EA4335"
    />
  </Svg>
);

const AppleLogo = ({ size = 22 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="#000000">
    <Path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.32c.68-.83 1.14-1.99.98-3.15-1 .04-2.2.67-2.9 1.49-.63.73-1.18 1.91-1.03 3.04 1.12.09 2.27-.55 2.95-1.38z" />
  </Svg>
);

const FacebookLogo = ({ size = 24 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
      fill="#1877F2"
    />
  </Svg>
);

export const LoginScreen = () => {
  const [email, setEmail] = useState('superadmin');
  const [password, setPassword] = useState('123');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const { login } = useContext(AuthContext);

  useEffect(() => {
    loadRememberedCredentials();
  }, []);

  const loadRememberedCredentials = async () => {
    try {
      const savedEmail = await AsyncStorage.getItem('rememberedEmail');
      const savedRememberMe = await AsyncStorage.getItem('rememberMeState');
      if (savedRememberMe === 'true' && savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      } else if (savedRememberMe === 'false') {
        setRememberMe(false);
        setEmail('');
      }
    } catch (e) {}
  };

  const handleLogin = async () => {
    if (!email.trim()) {
      Alert.alert('Validation Error', 'Please enter your email or username');
      return;
    }

    setLoading(true);

    try {
      if (rememberMe) {
        await AsyncStorage.setItem('rememberedEmail', email.trim());
        await AsyncStorage.setItem('rememberMeState', 'true');
      } else {
        await AsyncStorage.removeItem('rememberedEmail');
        await AsyncStorage.setItem('rememberMeState', 'false');
      }

      await login(email.trim(), password);
    } catch (err: any) {
      Alert.alert('Login Failed ❌', err?.message || 'Invalid credentials. Please verify your username and password.');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = (provider: string) => {
    Alert.alert(`${provider} Authentication`, `Redirecting to secure ${provider} SSO login portal...`);
    login('superadmin', '123');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" backgroundColor="#312E81" />

      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false} showsVerticalScrollIndicator={false}>
        {/* TOP GLOWING HERO HEADER */}
        <View style={styles.topHeroSection}>
          <View style={styles.glowingRing}>
            <View style={styles.logoBadge}>
              <Building2 size={34} color="#FFFFFF" />
            </View>
          </View>

          <View style={styles.titleContainer}>
            <Text style={styles.brandTitle}>ENTERPRISE HRMS</Text>
            <View style={styles.tagLineRow}>
              <Sparkles size={13} color="#A5B4FC" />
              <Text style={styles.tagLineText}>Smart Workplace Portal</Text>
            </View>
          </View>
        </View>

        {/* MODERN CURVED FLOATING FORM SHEET */}
        <View style={styles.formCard}>
          <View style={styles.formCardInner}>
            <Text style={styles.welcomeHeading}>Welcome Back 👋</Text>
            <Text style={styles.welcomeSub}>Sign in to access your HR dashboard & attendance</Text>

            <View style={styles.formFields}>
              {/* Username/Email Input */}
              <Text style={styles.inputLabel}>Email / Username</Text>
              <View style={styles.inputPill}>
                <View style={styles.iconCircle}>
                  <Mail size={18} color="#4F46E5" />
                </View>
                <TextInput
                  style={styles.textInput}
                  placeholder="superadmin or email@company.com"
                  placeholderTextColor="#94A3B8"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                />
              </View>

              {/* Password Input */}
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.inputPill}>
                <View style={styles.iconCircle}>
                  <Lock size={18} color="#4F46E5" />
                </View>
                <TextInput
                  style={styles.textInput}
                  placeholder="••••••••"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} color="#64748B" /> : <Eye size={18} color="#64748B" />}
                </TouchableOpacity>
              </View>

              {/* Options Row */}
              <View style={styles.optionsRow}>
                <TouchableOpacity
                  style={styles.rememberRow}
                  onPress={() => setRememberMe(!rememberMe)}
                >
                  <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
                    {rememberMe && <CheckCircle2 size={14} color="#FFFFFF" />}
                  </View>
                  <Text style={styles.rememberText}>Remember Me</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => Alert.alert('Reset Password', 'Password reset instructions sent to your administrator.')}>
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>
              </View>

              {/* Main Action Button */}
              <TouchableOpacity style={styles.submitButton} onPress={handleLogin} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <View style={styles.btnInner}>
                    <Text style={styles.submitBtnText}>Sign In to Dashboard</Text>
                    <View style={styles.arrowCircle}>
                      <ArrowRight size={16} color="#4F46E5" />
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* SEPARATOR */}
            <View style={styles.separatorContainer}>
              <View style={styles.sepLine} />
              <Text style={styles.sepText}>OR CONTINUE WITH</Text>
              <View style={styles.sepLine} />
            </View>

            {/* SOCIAL LOGIN BUTTONS (FULL-WIDTH STACKED ROWS WITH NAMES - GLASSDOOR STYLE) */}
            <View style={styles.socialStackContainer}>
              <TouchableOpacity style={styles.googleRowBtn} onPress={() => handleSocialLogin('Google')}>
                <View style={styles.brandIconWrapper}>
                  <GoogleLogo size={22} />
                </View>
                <Text style={styles.googleBtnText}>Continue with Google</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.appleRowBtn} onPress={() => handleSocialLogin('Apple')}>
                <View style={styles.brandIconWrapper}>
                  <AppleLogo size={20} />
                </View>
                <Text style={styles.appleBtnText}>Continue with Apple</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.facebookRowBtn} onPress={() => handleSocialLogin('Facebook')}>
                <View style={styles.brandIconWrapper}>
                  <FacebookLogo size={22} />
                </View>
                <Text style={styles.facebookBtnText}>Continue with Facebook</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#312E81',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  topHeroSection: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 36 : 26,
    paddingBottom: 22,
    alignItems: 'center',
  },
  glowingRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  logoBadge: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  titleContainer: {
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 21,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  tagLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  tagLineText: {
    fontSize: 11,
    color: '#C7D2FE',
    fontWeight: '600',
  },
  formCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  formCardInner: {
    flex: 1,
    justifyContent: 'center',
  },
  welcomeHeading: {
    fontSize: 21,
    fontWeight: '800',
    color: '#0F172A',
  },
  welcomeSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 16,
  },
  formFields: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginTop: 8,
    marginBottom: 4,
  },
  inputPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 48,
  },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '500',
  },
  eyeBtn: {
    padding: 6,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 10,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  rememberText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  forgotText: {
    fontSize: 12,
    color: '#4F46E5',
    fontWeight: '700',
  },
  submitButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 14,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  btnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  arrowCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  separatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  sepLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  sepText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    paddingHorizontal: 10,
    letterSpacing: 0.8,
  },
  socialStackContainer: {
    gap: 10,
    marginBottom: 10,
  },
  googleRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    position: 'relative',
    paddingHorizontal: 16,
  },
  googleBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  appleRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 14,
    backgroundColor: '#0F172A',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
    position: 'relative',
    paddingHorizontal: 16,
  },
  appleBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  facebookRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F0F6FF',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    shadowColor: '#1877F2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    position: 'relative',
    paddingHorizontal: 16,
  },
  facebookBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1877F2',
  },
  brandIconWrapper: {
    position: 'absolute',
    left: 16,
  },
});

