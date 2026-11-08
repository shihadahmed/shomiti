'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { apiClient, ApiError } from './api';
import { t } from './i18n';

if (typeof window !== 'undefined') {
  try {
    window.localStorage.removeItem('shomiti-auth');
    window.localStorage.removeItem('shomiti.remember');
  } catch {}
}

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
    (set, get) => {
      /**
       * Backend-derived permissions are the single source of truth. The role is
       * only used for display; feature access must check the permission list
       * returned by /auth/me so custom roles behave correctly.
       */
      const hasPermission = (permission) => {
        const user = get().user;
        if (!user) return false;
        return Array.isArray(user.permissions) && user.permissions.includes(permission);
      };

      return {
        user: null,
        token: null,
        isLoading: false,
        isAuthenticated: false,
        error: null,
        lastSessionFetch: 0,

        login: async (identifier, password) => {
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
          // Prevent multiple simultaneous calls
          if (get().isLoading) return;

          const now = Date.now();
          const lastFetch = get().lastSessionFetch || 0;
          if (now - lastFetch < 5000 && get().user) {
            // Return cached session if less than 5 seconds old
            return;
          }

          set({ isLoading: true, lastSessionFetch: now });
          try {
            const res = await apiClient.get('/auth/me', undefined, { skipAuthRedirect: true });
            const payload = res.data?.data || {};
            set({
              user: payload.user || null,
              isAuthenticated: Boolean(payload.user),
              isLoading: false,
            });
          } catch (error) {
            // Only clear session on genuine auth failure (401)
            // Transient errors (network, 429, 500, CORS) should NOT log the user out
            if (error instanceof ApiError && error.status === 401) {
              set({ user: null, isAuthenticated: false, isLoading: false });
            }
            // For other errors, keep existing state; UI will surface via useApi hooks
          }
        },

        clearError: () => set({ error: null }),

        setUser: (user) => set({ user }),

        hasRole: (...roles) => {
          const user = get().user;
          return Boolean(user && roles.includes(user.role));
        },

        hasPermission,

        canManageFinance: () =>
          hasPermission('savings.configure') || hasPermission('payments.verify_slips'),

        canApprove: () =>
          hasPermission('expenses.approve_tier1') ||
          hasPermission('expenses.approve_tier2') ||
          hasPermission('expenses.approve_tier3') ||
          hasPermission('payments.verify_slips'),

        canManageMembers: () =>
          hasPermission('members.create') || hasPermission('members.edit'),

        canSeeLedger: () => hasPermission('ledger.view'),
      };
    },
    {
      name: 'shomiti-auth',
      storage: createJSONStorage(() => sessionStorage),
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
    hasPermission: state.hasPermission,
    canManageFinance: state.canManageFinance,
    canApprove: state.canApprove,
    canManageMembers: state.canManageMembers,
    canSeeLedger: state.canSeeLedger,
  }));
}
