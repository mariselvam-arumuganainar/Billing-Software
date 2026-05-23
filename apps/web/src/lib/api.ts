import axios from 'axios';
import Cookies from 'js-cookie';

export const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:4000/api/v1';
export const BILLING_ENGINE_URL = process.env.NEXT_PUBLIC_BILLING_ENGINE_URL || 'http://localhost:8082/api/v1';

export const apiClient = axios.create({
  baseURL: API_GATEWAY_URL,
});

export const billingClient = axios.create({
  baseURL: BILLING_ENGINE_URL,
});

apiClient.interceptors.request.use((config) => {
  const token = Cookies.get('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

billingClient.interceptors.request.use((config) => {
  const tenantId = Cookies.get('tenantId');
  if (tenantId) {
    config.headers['X-Tenant-ID'] = tenantId;
  }
  return config;
});

const handle401 = (error: any) => {
  if (error?.response?.status === 401) {
    Cookies.remove('token');
    Cookies.remove('tenantId');
    Cookies.remove('role');
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }
  return Promise.reject(error);
};

apiClient.interceptors.response.use((res) => res, handle401);
billingClient.interceptors.response.use((res) => res, handle401);
