import axios from 'axios';
import { getLang } from './i18n';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '/api';

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.message = message;
    this.details = details;
  }
}

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'X-Requested-With': 'XMLHttpRequest',
    Accept: 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const lang = getLang();
  config.headers['Accept-Language'] = lang;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const config = error.config;
      if (!config?.skipAuthRedirect && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('session-expired'));
      }
    }
    const data = error.response?.data;
    throw new ApiError(
      error.response?.status || 0,
      data?.error?.code || 'REQUEST_FAILED',
      data?.error?.message || 'Something went wrong',
      data?.error?.details
    );
  }
);

export const apiClient = {
  get: (url, params, config) =>
    api.get(url, { params, ...config }),
  post: (url, data, config) =>
    api.post(url, data, config),
  patch: (url, data, config) =>
    api.patch(url, data, config),
  delete: (url, config) =>
    api.delete(url, config),
  upload: (url, formData, config) =>
    api.post(url, formData, {
      ...config,
      headers: { ...config?.headers, 'Content-Type': 'multipart/form-data' },
    }),
  raw: api,
  baseURL: API_BASE,
};

export default apiClient;