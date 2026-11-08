'use client';

import React, { useState, useEffect } from 'react';
import { useLang } from '@/lib/useLang';
import { useAuthStore } from '@/lib/auth';
import AppShell from '@/components/layout/AppShell';
import { PageHeader, EmptyState, Icon, Button, Card, Alert } from '@/components/ui/common';
import { toast } from 'react-toastify';

export default function CertificatePage() {
  const { tr } = useLang();
  const user = useAuthStore((state) => state.user);
  const [certificate, setCertificate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const fetchCertificate = async () => {
    if (!user?.memberId) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/documents/my?category=certificate&memberId=${user.memberId}`);
      const data = await res.json();
      
      if (data.success && data.data.items.length > 0) {
        // Get the most recent certificate
        setCertificate(data.data.items[0]);
      }
    } catch (error) {
      console.error('Failed to fetch certificate:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCertificate();
  }, [user?.memberId]);

  const handleDownload = async () => {
    if (!certificate) return;
    
    setDownloading(true);
    try {
      const res = await fetch(`/api/documents/${certificate._id}/file`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${certificate.title || 'membership-certificate'}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success(tr('toast.fileUploaded') || 'Certificate downloaded successfully');
      } else {
        throw new Error('Download failed');
      }
    } catch (error) {
      console.error('Download failed:', error);
      toast.error(tr('toast.fileUploadFailed') || 'Failed to download certificate');
    } finally {
      setDownloading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  return (
    <AppShell>
      <PageHeader 
        title={tr('certificate.title') || 'Membership Certificate'}
        subtitle={tr('certificate.download') || 'Download your membership certificate'}
      />

      <div className="max-w-2xl mx-auto">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent" />
            <p className="mt-2 text-brand-500">{tr('common.loading')}</p>
          </div>
        ) : !user?.memberId ? (
          <Alert variant="warning">
            <Icon name="alertTriangle" className="h-5 w-5" />
            <div>
              <p className="font-medium">{tr('profile.noMember') || 'No member profile linked'}</p>
              <p className="text-sm mt-1">{tr('profile.noMemberDesc') || 'Please contact the administrator to link your account to a member profile.'}</p>
            </div>
          </Alert>
        ) : certificate ? (
          <Card className="p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-brand-100 text-brand-600 mb-4">
                <Icon name="award" className="h-10 w-10" />
              </div>
              <h2 className="text-2xl font-bold text-brand-900">{tr('certificate.title') || 'Membership Certificate'}</h2>
              <p className="text-brand-500 mt-1">{certificate.title}</p>
            </div>

            <div className="space-y-4 mb-8 p-6 bg-brand-50 rounded-lg">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-brand-500">{tr('certificate.certificateNumber') || 'Certificate Number'}</p>
                  <p className="font-mono font-medium text-brand-900">{certificate._id?.slice(-8).toUpperCase() || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-brand-500">{tr('certificate.issuedDate') || 'Issued Date'}</p>
                  <p className="font-medium text-brand-900">{formatDate(certificate.createdAt)}</p>
                </div>
                <div>
                  <p className="text-sm text-brand-500">{tr('certificate.memberSince') || 'Member Since'}</p>
                  <p className="font-medium text-brand-900">
                    {user.memberSince ? formatDate(user.memberSince) : (user.createdAt ? formatDate(user.createdAt) : '—')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-brand-500">{tr('settings.memberCode') || 'Member Code'}</p>
                  <p className="font-medium text-brand-900">{user.memberCode || '—'}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-center gap-4">
              <Button 
                onClick={handleDownload}
                disabled={downloading}
                className="w-full sm:w-auto"
                icon="download"
              >
                {downloading 
                  ? (tr('common.saving') || 'Downloading...') 
                  : (tr('certificate.download') || 'Download Certificate')
                }
              </Button>
              <Button 
                variant="outline"
                onClick={() => window.print()}
                className="w-full sm:w-auto"
                icon="printer"
              >
                {tr('common.print') || 'Print'}
              </Button>
            </div>

            <p className="text-center text-sm text-brand-400 mt-6">
              {tr('certificate.footer') || 'This certificate is valid for verification purposes. For official use, please contact the cooperative office.'}
            </p>
          </Card>
        ) : (
          <EmptyState
            icon="award"
            title={tr('certificate.title') || 'Membership Certificate'}
            description={tr('certificate.noCertificate') || 'No membership certificate found for your account. Certificates are issued by the cooperative office.'}
            action={
              <a href="/documents/my" className="btn btn-primary">
                <Icon name="folder" className="mr-2 h-4 w-4" />
                {tr('documents.myDocuments') || 'View My Documents'}
              </a>
            }
          />
        )}
      </div>
    </AppShell>
  );
}