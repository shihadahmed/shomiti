'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth';
import { useLang } from '@/lib/useLang';
import { useApi, apiPost } from '@/lib/useApi';
import AppShell from '@/components/layout/AppShell';
import {
  Icon,
  Button,
  PageHeader,
  EmptyState,
  LoadingSpinner,
  formatDate,
  Tab,
  Tabs,
  Table,
  TableHeader,
  TableRow,
  TableCell,
  TableBody,
  Pagination,
} from '@/components/ui/common';
import { toast } from 'react-toastify';

export default function SettingsPage() {
  const router = useRouter();
  const { tr, lang, setLang } = useLang();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const logout = useAuthStore((state) => state.logout);
  const hasRole = useAuthStore((state) => state.hasRole);

  const [mounted, setMounted] = useState(false);
  const [checking, setChecking] = useState(true);
  const [activeTab, setActiveTab] = useState('general');
  const [auditPage, setAuditPage] = useState(1);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  const { data: auditData, loading: auditLoading, error: auditError } = useApi(
    '/audit',
    { page: auditPage, limit: 20 },
    { enabled: isAuthenticated && activeTab === 'audit' }
  );

  useEffect(() => {
    setMounted(true);
    let active = true;
    Promise.resolve().then(() => {
      if (active) setChecking(false);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (mounted && !checking && !isAuthenticated) {
      router.replace('/login');
    }
  }, [mounted, checking, isAuthenticated, router]);

  const handleLogout = async () => {
    await logout();
  };

  if (!mounted || checking) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </AppShell>
    );
  }

  if (!isAuthenticated) return null;

  const auditLogs = auditData?.items || [];
  const auditMeta = auditData?.meta || { total: 0, pages: 1 };

  const tabs = [
    { value: 'general', label: tr('settings.general') || 'General' },
    ...(hasRole('super_admin') ? [{ value: 'audit', label: tr('settings.audit') || 'Audit Trail' }] : []),
  ];

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        <PageHeader
          title={tr('settings.general') || 'Settings'}
          subtitle={tr('settings.subtitle') || 'Manage your account security, personal preferences, and platform audit records.'}
        />

        <div className="border-b border-brand-200">
          <Tabs value={activeTab} onChange={setActiveTab}>
            {tabs.map((tab) => (
              <Tab key={tab.value} value={tab.value}>
                {tab.label}
              </Tab>
            ))}
          </Tabs>
        </div>

        {activeTab === 'general' && (
          <GeneralSettingsView
            onOpenPasswordModal={() => setIsPasswordModalOpen(true)}
            onLogout={handleLogout}
            currentLang={lang}
            onSelectLang={setLang}
          />
        )}

        {activeTab === 'audit' && (
          <AuditLogView
            logs={auditLogs}
            meta={auditMeta}
            loading={auditLoading}
            error={auditError}
            page={auditPage}
            setPage={setAuditPage}
          />
        )}

        {isPasswordModalOpen && (
          <ChangePasswordModal onClose={() => setIsPasswordModalOpen(false)} />
        )}
      </div>
    </AppShell>
  );
}

function GeneralSettingsView({ onOpenPasswordModal, onLogout, currentLang, onSelectLang }) {
  const { tr } = useLang();
  const user = useAuthStore((state) => state.user);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* বাম পাশের প্রোফাইল সামারি কার্ড */}
      <div className="lg:col-span-1">
        <div className="card p-6 text-center space-y-4">
          <div className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-2xl bg-brand-700 text-white shadow-md text-3xl font-bold ring-4 ring-brand-100">
            {user?.name ? user.name.slice(0, 2).toUpperCase() : 'SH'}
          </div>

          <div>
            <h3 className="text-xl font-bold text-brand-900">{user?.name}</h3>
            <p className="text-xs text-brand-500 font-mono mt-0.5">{user?.email || 'No email registered'}</p>
            <span className="inline-flex mt-2.5 items-center px-3 py-1 rounded-full text-xs font-semibold bg-brand-100 text-brand-800 uppercase tracking-wider">
              {user?.role ? tr(`role.${user.role}`) || user.role : 'Member'}
            </span>
          </div>

          <div className="pt-4 border-t border-brand-100 flex items-center justify-between text-xs text-brand-600">
            <span>Account Status</span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span> Active
            </span>
          </div>
        </div>
      </div>

      {/* ডান পাশের ইনফরমেশন, সিকিউরিটি ও প্রেফারেন্স */}
      <div className="lg:col-span-2 space-y-6">
        {/* একাউন্ট তথ্য */}
        <div className="card p-6">
          <div className="flex items-center justify-between pb-4 border-b border-brand-100">
            <h4 className="text-base font-semibold text-brand-900 flex items-center gap-2">
              <Icon name="user" className="h-5 w-5 text-brand-600" />
              {tr('settings.account') || 'Personal Information'}
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-5">
            <div className="p-3 bg-brand-50/50 rounded-xl border border-brand-100/60">
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand-500">{tr('members.name') || 'Full Name'}</span>
              <p className="mt-1 font-semibold text-brand-900">{user?.name || '-'}</p>
            </div>
            <div className="p-3 bg-brand-50/50 rounded-xl border border-brand-100/60">
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand-500">{tr('members.email') || 'Email Address'}</span>
              <p className="mt-1 font-semibold text-brand-900">{user?.email || '-'}</p>
            </div>
            <div className="p-3 bg-brand-50/50 rounded-xl border border-brand-100/60">
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand-500">{tr('members.phone') || 'Contact Number'}</span>
              <p className="mt-1 font-semibold text-brand-900">{user?.phone || '-'}</p>
            </div>
            <div className="p-3 bg-brand-50/50 rounded-xl border border-brand-100/60">
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand-500">System Role</span>
              <p className="mt-1 font-semibold text-brand-900">{user?.role || 'Member'}</p>
            </div>
          </div>
        </div>

        {/* প্রিফারেন্স (ভাষা টগল) */}
        <div className="card p-6">
          <div className="flex items-center justify-between pb-4 border-b border-brand-100">
            <h4 className="text-base font-semibold text-brand-900 flex items-center gap-2">
              <Icon name="globe" className="h-5 w-5 text-brand-600" />
              {tr('settings.preferences') || 'Preferences'}
            </h4>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-brand-900">Interface Language</p>
              <p className="text-xs text-brand-500">Choose your preferred language for the system interface.</p>
            </div>
            <div className="flex items-center gap-1.5 p-1 bg-brand-100 rounded-xl w-fit">
              <button
                type="button"
                onClick={() => onSelectLang && onSelectLang('bn')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  currentLang === 'bn'
                    ? 'bg-brand-700 text-white shadow-sm'
                    : 'text-brand-700 hover:text-brand-900'
                }`}
              >
                বাংলা
              </button>
              <button
                type="button"
                onClick={() => onSelectLang && onSelectLang('en')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  currentLang === 'en'
                    ? 'bg-brand-700 text-white shadow-sm'
                    : 'text-brand-700 hover:text-brand-900'
                }`}
              >
                English
              </button>
            </div>
          </div>
        </div>

        {/* নিরাপত্তা ও লগআউট */}
        <div className="card p-6">
          <div className="flex items-center justify-between pb-4 border-b border-brand-100">
            <h4 className="text-base font-semibold text-brand-900 flex items-center gap-2">
              <Icon name="lock" className="h-5 w-5 text-brand-600" />
              {tr('settings.security') || 'Security & Session'}
            </h4>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-brand-900">Account Credentials</p>
              <p className="text-xs text-brand-500">Update your account password regularly to keep your session protected.</p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Button variant="secondary" onClick={onOpenPasswordModal} className="text-xs px-4 py-2">
                <Icon name="lock" className="h-4 w-4 mr-1.5" />
                Change Password
              </Button>
              <Button variant="danger" onClick={onLogout} className="text-xs px-4 py-2">
                <Icon name="logout" className="h-4 w-4 mr-1.5" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChangePasswordModal({ onClose }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('All fields are required.');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('New password and confirmation do not match.');
      return;
    }

    try {
      setLoading(true);
      await apiPost('/auth/change-password', {
        currentPassword,
        newPassword,
      });
      toast.success('Password changed successfully.');
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="card w-full max-w-md p-6 bg-white shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-brand-100">
          <h3 className="text-lg font-bold text-brand-900 flex items-center gap-2">
            <Icon name="lock" className="h-5 w-5 text-brand-600" />
            Change Password
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-brand-400 hover:bg-brand-100 hover:text-brand-700 transition"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-brand-700 mb-1">
              Current Password
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 border border-brand-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 transition"
              placeholder="Enter current password"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-brand-700 mb-1">
              New Password
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 border border-brand-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 transition"
              placeholder="Enter new password (min. 6 chars)"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-brand-700 mb-1">
              Confirm New Password
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-brand-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 transition"
              placeholder="Re-type new password"
              required
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="show-pass"
              checked={showPassword}
              onChange={(e) => setShowPassword(e.target.checked)}
              className="rounded border-brand-300 text-brand-700 focus:ring-brand-500"
            />
            <label htmlFor="show-pass" className="text-xs text-brand-600 select-none cursor-pointer">
              Show passwords
            </label>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-brand-100">
            <Button variant="secondary" type="button" onClick={onClose} disabled={loading} className="text-xs">
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={loading} className="text-xs">
              {loading ? 'Updating...' : 'Update Password'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AuditLogView({ logs, meta, loading, error, page, setPage }) {
  const { tr } = useLang();

  if (loading) {
    return (
      <div className="card p-12 text-center">
        <LoadingSpinner size="md" />
        <p className="mt-3 text-xs text-brand-500 font-medium tracking-wide">Loading audit trail...</p>
      </div>
    );
  }

  if (error) {
    return <EmptyState icon="alert" title={tr('common.error') || 'Error'} description={error} className="p-8" />;
  }

  if (logs.length === 0) {
    return (
      <EmptyState
        icon="file"
        title={tr('settings.noAuditLogs') || 'No Audit Logs Recorded'}
        description={tr('common.noData') || 'System changes will automatically log here.'}
        className="p-12"
      />
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b border-brand-100 bg-brand-50/40 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-brand-900">Activity Log</h4>
          <p className="text-xs text-brand-500">Security history and administrative changes</p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 bg-brand-100 text-brand-800 rounded-full font-mono">
          Total: {meta.total || logs.length}
        </span>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableCell className="text-xs font-bold uppercase text-brand-500">Action</TableCell>
              <TableCell className="text-xs font-bold uppercase text-brand-500">Entity</TableCell>
              <TableCell className="text-xs font-bold uppercase text-brand-500">Actor</TableCell>
              <TableCell className="text-xs font-bold uppercase text-brand-500">Timestamp</TableCell>
              <TableCell className="text-xs font-bold uppercase text-brand-500">IP Address</TableCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log._id} className="tr-hover transition-colors">
                <TableCell>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-100 text-brand-800">
                    {log.action}
                  </span>
                </TableCell>
                <TableCell className="text-brand-700 text-xs">
                  <span className="font-semibold">{log.entityType}</span>{' '}
                  {log.entityId && (
                    <span className="text-brand-400 font-mono text-[11px]">#{String(log.entityId).slice(0, 8)}</span>
                  )}
                </TableCell>
                <TableCell className="text-brand-800 font-medium text-xs">{log.actor?.name || '-'}</TableCell>
                <TableCell className="text-brand-600 font-mono text-xs whitespace-nowrap">
                  {formatDate(log.at, { time: true })}
                </TableCell>
                <TableCell className="text-brand-400 font-mono text-[11px] whitespace-nowrap">
                  {log.ip || '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="p-4 border-t border-brand-100 bg-white">
        <Pagination meta={meta} onPage={setPage} />
      </div>
    </div>
  );
}