import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Base URL for backend API (Public Production HTTPS Domain)
export const API_BASE_URL = 'https://newhrms.brihaspathi.in';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to automatically attach JWT Bearer token
apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('userToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Helper function to resolve relative image URLs (e.g. /uploads/emp_1.jpg) to full URLs
export const getImageUrl = (imagePath?: string | null): string | null => {
  if (!imagePath) return null;
  if (
    imagePath.startsWith('http://') ||
    imagePath.startsWith('https://') ||
    imagePath.startsWith('data:')
  ) {
    return imagePath;
  }
  const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  return `${API_BASE_URL}${cleanPath}`;
};

