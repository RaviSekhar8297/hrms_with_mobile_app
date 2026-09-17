import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../config/api';

export interface UserProfile {
  id?: string | number;
  email?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  emp_code?: string;
  dob?: string;
  gender?: string;
  blood_group?: string;
  address?: string;
  role?: string;
  department?: string;
  designation?: string;
  company_name?: string;
  company_id?: string | number;
  emp_image?: string;
  profile_image?: string;
  avatar_url?: string;
  photo?: string;
}

interface AuthContextType {
  userToken: string | null;
  user: UserProfile | null;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  userToken: null,
  user: null,
  isLoading: true,
  login: async () => false,
  logout: async () => {},
  refreshUserProfile: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userToken, setUserToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const fetchMyProfile = async (baseUser: UserProfile): Promise<UserProfile> => {
    try {
      const meRes = await apiClient.get('/api/v1/employees/me').catch(() => null);
      if (meRes?.data) {
        const emp = meRes.data.employee || meRes.data;
        if (emp) {
          const empImg = emp.emp_image || emp.profile_image || emp.avatar_url;
          const fullName =
            `${emp.first_name || ''} ${emp.last_name || ''}`.trim() ||
            emp.name ||
            baseUser.name;
          return {
            ...baseUser,
            id: emp.emp_id_code || emp.id || baseUser.id,
            name: fullName,
            first_name: emp.first_name || baseUser.first_name,
            last_name: emp.last_name || baseUser.last_name,
            email: emp.email || baseUser.email,
            phone: emp.phone || emp.mobile_number || emp.phone_number || baseUser.phone,
            role: emp.role_name || emp.role || baseUser.role,
            department: emp.department_name || emp.department || baseUser.department,
            designation: emp.designation_name || emp.designation || baseUser.designation,
            company_name: emp.company_name || baseUser.company_name,
            emp_image: empImg || baseUser.emp_image,
            dob: emp.dob || emp.date_of_birth || baseUser.dob,
            gender: emp.gender || baseUser.gender,
            blood_group: emp.blood_group || baseUser.blood_group,
            address: emp.address || emp.present_address || baseUser.address,
          };
        }
      }
      
      const profRes = await apiClient.get('/api/v1/auth/profile').catch(() => null);
      if (profRes?.data) {
        const p = profRes.data;
        return {
          ...baseUser,
          name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || baseUser.name,
          first_name: p.first_name || baseUser.first_name,
          last_name: p.last_name || baseUser.last_name,
          email: p.email || baseUser.email,
          phone: p.phone || baseUser.phone,
        };
      }
    } catch (e) {
      console.warn('Could not fetch logged-in profile:', e);
    }
    return baseUser;
  };

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('userToken');
      const storedUser = await AsyncStorage.getItem('userData');
      if (storedToken) {
        setUserToken(storedToken);
      }
      if (storedUser) {
        let initialUser: UserProfile = JSON.parse(storedUser);
        setUser(initialUser);
        if (storedToken) {
          fetchMyProfile(initialUser).then((updatedUser) => {
            setUser(updatedUser);
            AsyncStorage.setItem('userData', JSON.stringify(updatedUser));
          });
        }
      }
    } catch (e) {
      console.error('Error loading stored token', e);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUserProfile = async () => {
    if (user) {
      const updated = await fetchMyProfile(user);
      setUser(updated);
      await AsyncStorage.setItem('userData', JSON.stringify(updated));
    }
  };

  const login = async (email: string, password?: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const response = await apiClient.post('/api/v1/auth/login', { username: email, email, password });
      
      const token = response.data?.token || response.data?.access_token;
      if (!token) {
        throw new Error(response.data?.error || 'Login failed. Invalid token received.');
      }

      let userData: UserProfile = response.data?.user || {
        email: email,
        name: email.split('@')[0],
      };

      await AsyncStorage.setItem('userToken', token);
      
      // Fetch full employee profile details using real authenticated JWT token
      userData = await fetchMyProfile(userData);
      await AsyncStorage.setItem('userData', JSON.stringify(userData));

      setUserToken(token);
      setUser(userData);
      return true;
    } catch (error: any) {
      console.error('Login error:', error);
      const errMsg = error?.response?.data?.error || error?.message || 'Login failed. Invalid credentials.';
      throw new Error(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    await AsyncStorage.removeItem('userToken');
    await AsyncStorage.removeItem('userData');
    setUserToken(null);
    setUser(null);
    setIsLoading(false);
  };

  return (
    <AuthContext.Provider
      value={{
        userToken,
        user,
        isLoading,
        login,
        logout,
        refreshUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
