'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient, ApiError } from './api';
import { t } from './i18n';

export function describeApiError(error) {
  if (error instanceof ApiError) {
    if (error.status === 0) return t('error.network');
    if (error.status === 401) return t('error.sessionExpired');
    if (error.status === 403) return t('error.forbidden');
    if (error.status === 404) return t('error.notFound');
    if (error.status === 422) {
      const first = error.details?.[0]?.message;
      if (first) return t(first);
      return t('error.validation');
    }
    return error.message || t('error.generic');
  }
  return error?.message || t('error.generic');
}

/**
 * Small data-fetching hook for the admin pages. Returns the `data` object from
 * the API envelope, plus loading/error state and a manual reload function.
 */
export function useApi(path, params, { enabled = true } = {}) {
  const paramsKey = useMemo(() => JSON.stringify(params || {}), [params]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(enabled && path));
  const [error, setError] = useState(null);

  const load = useCallback(
    async ({ quiet = false } = {}) => {
      if (!enabled || !path) {
        setLoading(false);
        return null;
      }
      if (!quiet) setLoading(true);
      try {
        const response = await apiClient.get(path, JSON.parse(paramsKey || '{}'));
        setData(response.data?.data ?? null);
        setError(null);
        return response.data?.data ?? null;
      } catch (requestError) {
        setError(describeApiError(requestError));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [path, paramsKey, enabled],
  );

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load, setData };
}

export async function apiGet(path, params, config) {
  const response = await apiClient.get(path, params, config);
  if (config?.responseType === 'blob') return response.data;
  return response.data?.data;
}

export async function apiPost(path, body, config) {
  const response = await apiClient.post(path, body, config);
  return response.data?.data;
}

export async function apiPatch(path, body) {
  const response = await apiClient.patch(path, body);
  return response.data?.data;
}

export async function apiDelete(path) {
  const response = await apiClient.delete(path);
  return response.data?.data;
}

export default useApi;
