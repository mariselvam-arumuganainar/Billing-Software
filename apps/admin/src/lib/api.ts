import axios from 'axios';
import Cookies from 'js-cookie';

const BASE = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:4000/api/v1';

export const apiClient = axios.create({ baseURL: BASE });

apiClient.interceptors.request.use((config) => {
  const token = Cookies.get('sa_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error?.response?.status === 401) {
      Cookies.remove('sa_token');
      Cookies.remove('sa_role');
      if (typeof window !== 'undefined') window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
