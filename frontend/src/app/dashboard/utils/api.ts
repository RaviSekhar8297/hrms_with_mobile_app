export const API_BASE = typeof window !== 'undefined'
  ? `http://${window.location.hostname}:5000`
  : 'http://localhost:5000';

export const getHeaders = (): Record<string, string> => {
  if (typeof window === 'undefined') return { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('access_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const getUrl = (path: string, companyId?: string | null) => {
  if (companyId) {
    return `${API_BASE}${path}${path.includes('?') ? '&' : '?'}companyId=${companyId}`;
  }
  return `${API_BASE}${path}`;
};
