'use client';

import React, { useState, useEffect } from 'react';
import { useLang } from '@/lib/useLang';
import AppShell from '@/components/layout/AppShell';
import { PageHeader, Card, Badge, Icon, Select, Input, Pagination, EmptyState, formatMoney } from '@/components/ui/common';

export default function AuditPage() {
  const { tr } = useLang();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, pages: 0 });
  const [filter, setFilter] = useState({ action: '', entityType: '', actor: '', search: '' });
  const [entityTypes, setEntityTypes] = useState([]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
      });
      
      if (filter.action) params.append('action', filter.action);
      if (filter.entityType) params.append('entityType', filter.entityType);
      if (filter.actor) params.append('actor', filter.actor);

      const res = await fetch(`/api/audit?${params.toString()}`);
      const data = await res.json();
      
      if (data.success) {
        setLogs(data.data.items);
        setPagination(prev => ({ ...prev, ...data.data.meta }));
        
        // Collect unique entity types for filter dropdown
        const types = [...new Set(data.data.items.map(item => item.entityType).filter(Boolean))];
        setEntityTypes(types);
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [pagination.page, filter.action, filter.entityType, filter.actor]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActionBadge = (action) => {
    if (action.includes('created') || action.includes('uploaded')) return { variant: 'success', label: 'Created' };
    if (action.includes('updated') || action.includes('edited')) return { variant: 'info', label: 'Updated' };
    if (action.includes('deleted') || action.includes('removed')) return { variant: 'danger', label: 'Deleted' };
    if (action.includes('approved')) return { variant: 'success', label: 'Approved' };
    if (action.includes('rejected')) return { variant: 'danger', label: 'Rejected' };
    if (action.includes('login') || action.includes('signin')) return { variant: 'info', label: 'Login' };
    if (action.includes('logout') || action.includes('signout')) return { variant: 'default', label: 'Logout' };
    return { variant: 'default', label: action };
  };

  const handleFilterChange = (key, value) => {
    setFilter(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  return (
    <AppShell>
      <PageHeader 
        title={tr('nav.audit')} 
        subtitle={tr('admin.auditTrail') || 'System audit trail and security logs'}
      />

      <Card className="p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="label">{tr('settings.auditAction') || 'Action'}</label>
            <Input
              type="text"
              placeholder={tr('settings.auditAction') || 'Filter by action...'}
              value={filter.action}
              onChange={(e) => handleFilterChange('action', e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="flex-1">
            <label className="label">{tr('settings.auditEntity') || 'Entity Type'}</label>
            <Select
              value={filter.entityType}
              onChange={(e) => handleFilterChange('entityType', e.target.value)}
              options={[
                { value: '', label: tr('common.all') || 'All' },
                ...entityTypes.map(t => ({ value: t, label: t })),
              ]}
              className="mt-1"
            />
          </div>
          <div className="flex-1">
            <label className="label">{tr('settings.auditActor') || 'Actor'}</label>
            <Input
              type="text"
              placeholder={tr('settings.auditActor') || 'Filter by actor...'}
              value={filter.actor}
              onChange={(e) => handleFilterChange('actor', e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
      </Card>

      <Card className="p-4">
        {loading && logs.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent" />
            <p className="mt-2 text-brand-500">{tr('common.loading')}</p>
          </div>
        ) : logs.length === 0 ? (
          <EmptyState
            icon="file"
            title={tr('settings.noAuditLogs') || 'No audit logs found'}
            description={tr('settings.noAuditLogs') || 'No audit logs match the current filters.'}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th className="w-1/5">{tr('settings.auditDate') || 'Date & Time'}</th>
                    <th className="w-1/5">{tr('settings.auditAction') || 'Action'}</th>
                    <th className="w-1/5">{tr('settings.auditEntity') || 'Entity'}</th>
                    <th className="w-1/5">{tr('settings.auditActor') || 'Actor'}</th>
                    <th className="w-1/5">{tr('settings.auditIp') || 'IP Address'}</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log._id}>
                      <td className="text-sm text-brand-600">{formatDate(log.at)}</td>
                      <td>
                        {(() => {
                          const badge = getActionBadge(log.action);
                          return <Badge variant={badge.variant}>{badge.label}</Badge>;
                        })()}
                      </td>
                      <td className="text-sm text-brand-900">
                        {log.entityType}
                        {log.entityId && <span className="text-brand-400 ml-2 font-mono text-xs">{String(log.entityId).slice(-8)}</span>}
                      </td>
                      <td className="text-sm text-brand-600">
                        {log.actor?.name || log.actor?.email || 'System'}
                        {log.actor?.role && (
                          <Badge variant="default" className="ml-2 text-xs">{log.actor.role}</Badge>
                        )}
                      </td>
                      <td className="text-sm text-brand-400 font-mono">{log.ip || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination.pages > 1 && (
              <Pagination
                current={pagination.page}
                total={pagination.pages}
                onChange={(page) => setPagination(p => ({...p, page}))}
              />
            )}
          </>
        )}
      </Card>
    </AppShell>
  );
}