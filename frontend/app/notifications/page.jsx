'use client';

import React, { useState } from 'react';
import { useLang } from '@/lib/useLang';
import AppShell from '@/components/layout/AppShell';
import { 
  PageHeader, 
  EmptyState, 
  Icon, 
  Button, 
  Pagination,
  LoadingSpinner 
} from '@/components/ui/common';
import { useApi, apiPatch, apiPost } from '@/lib/useApi';

const NOTIFICATION_ICONS = {
  profile_submitted: 'user',
  account_approved: 'check-circle',
  account_rejected: 'alert-circle',
  system: 'bell',
};

export default function NotificationsPage() {
  const { tr } = useLang();
  const [page, setPage] = useState(1);

  const {
    data,
    loading,
    error,
    reload,
  } = useApi('/notifications', {
    page,
    limit: 15,
  });

  const handleMarkRead = async (id) => {
    try {
      await apiPatch(`/notifications/${id}/read`, {});
      reload?.();
    } catch (err) {
      alert(err?.message || tr('error.generic'));
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiPost('/notifications/read-all', {});
      reload?.();
    } catch (err) {
      alert(err?.message || tr('error.generic'));
    }
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-4 mb-6">
        <PageHeader 
          title={tr('notifications.title')} 
          subtitle={tr('notifications.subtitle')} 
        />
        {data?.items?.length > 0 && (
          <div className="flex justify-end">
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={handleMarkAllRead}
            >
              {tr('notifications.markAllRead')}
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : error ? (
        <EmptyState 
          icon="alert" 
          title={tr('common.error')} 
          description={error} 
          className="p-8" 
        />
      ) : data?.items?.length === 0 ? (
        <EmptyState 
          icon="bell" 
          title={tr('notifications.noNotifications')} 
          description={tr('common.noData')} 
          className="p-12" 
        />
      ) : (
        <div className="space-y-3">
          {data.items.map((notification) => (
            <div 
              key={notification._id} 
              className={`card p-4 flex gap-4 items-start transition-all ${
                !notification.isRead ? 'bg-brand-50 ring-1 ring-brand-200' : 'opacity-80'
              }`}
            >
              <div className={`p-2 rounded-full ${
                !notification.isRead ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-500'
              }`}>
                <Icon 
                  name={NOTIFICATION_ICONS[notification.type] || NOTIFICATION_ICONS.system} 
                  className="h-5 w-5" 
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-2">
                  <p className={`text-sm font-semibold truncate ${
                    !notification.isRead ? 'text-brand-900' : 'text-gray-700'
                  }`}>
                    {notification.title}
                  </p>
                  <span className="text-xs text-brand-400 whitespace-nowrap">
                    {notification.createdAt ? new Date(notification.createdAt).toLocaleDateString() : ''}
                  </span>
                </div>
                <p className="text-sm text-brand-600 mt-1 line-clamp-2">
                  {notification.message}
                </p>
              </div>
              {!notification.isRead && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs p-1" 
                  onClick={() => handleMarkRead(notification._id)}
                >
                  {tr('notifications.markRead')}
                </Button>
              )}
            </div>
          ))}
          <Pagination 
            meta={data.meta} 
            onPage={setPage} 
          />
        </div>
      )}
    </AppShell>
  );
}
