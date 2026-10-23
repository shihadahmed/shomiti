'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { apiClient, ApiError } from './api';
import { t } from './i18n';

const rolePermissions = {
  super_admin: { finance: true, approve: true, members: true, ledger: true },
  treasurer: { finance: true, approve: true, members: true, ledger: true },
  general_secretary: { finance: false, approve: true, members: false, ledger: true },
  president: { finance: false, approve: true, members: false, ledger: true },
  member: { finance: false, approve: false, members: false, ledger: false },
};

export function translateError(error) {
  if (error instanceof ApiError) {
    if (error.code === 'INVALID_CREDENTIALS') return t('login.badCredentials');
    if (error.code === 'ACCOUNT_INACTIVE') return t('status.inactive');
    if (error.code === 'NETWORK_ERROR' || error.status === 0) return t('error.network');
    if (error.code === 'RATE_LIMITED') return t('error.rateLimited');
    if (error.status === 422 || error.code === 'VALIDATION_ERROR') return t('error.validation');
    return error.message;
  }
  return t('error.generic');
}

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,
      error: null,

      login: async (identifier, password, rememberMe = false) => {
        set({ isLoading: true, error: null });
        try {
          const res = await apiClient.post('/auth/login', { identifier, password });
          const payload = res.data?.data || {};
          set({
            user: payload.user || null,
            token: payload.token || null,
            isAuthenticated: Boolean(payload.user),
            isLoading: false,
            error: null,
          });
          if (typeof window !== 'undefined' && rememberMe) {
            try { localStorage.setItem('shomiti.remember', '1'); } catch {}
          }
          return true;
        } catch (error) {
          set({
            isLoading: false,
            isAuthenticated: false,
            user: null,
            token: null,
            error: translateError(error),
          });
          return false;
        }
      },

      logout: async () => {
        try {
          await apiClient.post('/auth/logout', {});
        } catch {
          // ignore network errors on sign-out
        }
        set({ user: null, token: null, isAuthenticated: false, error: null });
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      },

      loadSession: async () => {
        set({ isLoading: true });
        try {
          const res = await apiClient.get('/auth/me', undefined, { skipAuthRedirect: true });
          const payload = res.data?.data || {};
          set({
            user: payload.user || null,
            isAuthenticated: Boolean(payload.user),
            isLoading: false,
          });
        } catch {
          set({ user: null, isAuthenticated: false, isLoading: false });
        }
      },

      clearError: () => set({ error: null }),

      setUser: (user) => set({ user }),

      hasRole: (...roles) => {
        const user = get().user;
        return Boolean(user && roles.includes(user.role));
      },

      canManageFinance: () => {
        const user = get().user;
        return user ? rolePermissions[user.role]?.finance ?? false : false;
      },

      canApprove: () => {
        const user = get().user;
        return user ? rolePermissions[user.role]?.approve ?? false : false;
      },

      canManageMembers: () => {
        const user = get().user;
        return user ? rolePermissions[user.role]?.members ?? false : false;
      },

      canSeeLedger: () => {
        const user = get().user;
        return user ? rolePermissions[user.role]?.ledger ?? false : false;
      },
    }),
    {
      name: 'shomiti-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export function useAuth() {
  return useAuthStore((state) => ({
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    error: state.error,
    login: state.login,
    logout: state.logout,
    loadSession: state.loadSession,
    clearError: state.clearError,
    hasRole: state.hasRole,
    canManageFinance: state.canManageFinance,
    canApprove: state.canApprove,
    canManageMembers: state.canManageMembers,
    canSeeLedger: state.canSeeLedger,
  }));
}
