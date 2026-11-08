'use client';

import React from 'react';
import { useLang } from '@/lib/useLang';
import { useAuthStore } from '@/lib/auth';
import {
  Icon,
  Badge,
  StatusBadge,
  formatDate,
} from '@/components/ui/common';

const RELATIONSHIP_LABELS = {
  spouse: 'relationship.spouse',
  child: 'relationship.child',
  parent: 'relationship.parent',
  sibling: 'relationship.sibling',
  other: 'relationship.other',
};

function renderAddress(addressData) {
  if (!addressData) return '—';
  if (typeof addressData === 'string') return addressData;
  if (addressData.fullAddress) return addressData.fullAddress;
  const parts = [
    addressData.village,
    addressData.postOffice,
    addressData.upazila,
    addressData.district,
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : '—';
}

/**
 * @typedef {Object} MemberProfileViewProps
 * @property {Object} member
 * @property {Object|null} [memberUser=null]
 * @property {boolean} [showPortalAccess=false]
 * @property {Function} [onEdit]
 * @property {Function} tr
 */

export default function MemberProfileView({
  member,
  memberUser = null,
  showPortalAccess = false,
  onEdit,
  tr,
}) {
  const { lang } = useLang();
  const isSuperAdmin = useAuthStore((state) => state.hasRole?.('super_admin'));
  const canManageMembers = useAuthStore((state) => state.canManageMembers?.());

  const memberName = lang === 'bn' && member.fullNameBn ? member.fullNameBn : member.fullName;
  const memberRole = memberUser?.role || member.role || 'member';

  return (
    <div className="space-y-6">
      {/* 1. TOP HERO PROFILE SPOTLIGHT */}
      <div className="relative overflow-hidden rounded-2xl border border-brand-200/80 bg-gradient-to-r from-brand-900 via-brand-800 to-brand-950 p-6 text-white shadow-md">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {/* Member Profile Photo */}
            <div className="relative h-24 w-24 shrink-0 rounded-2xl border-2 border-white/30 bg-white/10 p-1 shadow-lg backdrop-blur-sm">
              {member.photo ? (
                <img
                  src={member.photo}
                  alt={memberName}
                  className="h-full w-full rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-xl bg-brand-800 text-brand-300">
                  <Icon name="user" className="h-10 w-10" />
                </div>
              )}
              <span className="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm ring-2 ring-white">
                <Icon name="check" className="h-3.5 w-3.5" />
              </span>
            </div>

            {/* Member Info & Designation */}
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-xl font-bold tracking-tight text-white">{memberName}</h2>
                <span className="rounded-full bg-brand-700/80 px-3 py-0.5 text-xs font-bold tracking-wide uppercase text-brand-100 border border-white/10">
                  {memberRole.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="mt-1 font-mono text-sm text-brand-200">
                Member ID: <span className="font-bold text-white">{member.code || 'PENDING'}</span>
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-4 text-xs text-brand-200">
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="phone" className="h-3.5 w-3.5 text-brand-300" />
                  {member.phone || '—'}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="mail" className="h-3.5 w-3.5 text-brand-300" />
                  {member.email || tr('members.noEmail')}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Metrics Badge */}
          <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-6 gap-2">
            <span className="text-xs uppercase tracking-wider text-brand-300">{tr('members.totalSavings')}</span>
            <span className="font-mono text-2xl font-black text-emerald-400">
              {member.savingsBalance !== undefined ? member.savingsBalance : '—'}
            </span>
            <span className="text-[11px] text-brand-300">
              {tr('members.joined', { date: member.createdAt || member.joinDate ? formatDate(member.createdAt || member.joinDate) : '—' })}
            </span>
          </div>
        </div>
      </div>

      {/* 2. PERSONAL DETAILS & ADDRESS GRID */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Profile Information */}
        <div className="rounded-2xl border border-brand-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-2 border-b border-brand-100 pb-3 mb-4">
            <Icon name="user" className="h-4 w-4 text-brand-700" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand-900">
              {tr('members.section.personalInfo')}
            </h4>
          </div>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between py-1 border-b border-brand-50">
              <dt className="text-brand-500">{tr('members.fullName')}</dt>
              <dd className="font-semibold text-brand-900">{member.fullName || '—'}</dd>
            </div>
            {member.fullNameBn && (
              <div className="flex justify-between py-1 border-b border-brand-50">
                <dt className="text-brand-500">{tr('members.fullNameBn')}</dt>
                <dd className="font-medium text-brand-900">{member.fullNameBn}</dd>
              </div>
            )}
            <div className="flex justify-between py-1 border-b border-brand-50">
              <dt className="text-brand-500">{tr('members.fatherHusbandName')}</dt>
              <dd className="text-brand-800">{member.fatherHusbandName || '—'}</dd>
            </div>
            <div className="flex justify-between py-1 border-b border-brand-50">
              <dt className="text-brand-500">{tr('members.motherName')}</dt>
              <dd className="text-brand-800">{member.motherName || '—'}</dd>
            </div>
            <div className="flex justify-between py-1 border-b border-brand-50">
              <dt className="text-brand-500">{tr('members.nid')}</dt>
              <dd className="font-mono font-semibold text-brand-900">{member.nid || '—'}</dd>
            </div>
            <div className="flex justify-between py-1 border-b border-brand-50">
              <dt className="text-brand-500">{tr('members.dob')}</dt>
              <dd className="text-brand-800">{member.dob || member.dateOfBirth ? formatDate(member.dob || member.dateOfBirth) : '—'}</dd>
            </div>
            <div className="flex justify-between py-1">
              <dt className="text-brand-500">{tr('members.occupation')}</dt>
              <dd className="text-brand-800">{member.occupation || '—'}</dd>
            </div>
          </dl>
        </div>

        {/* Address & NID Attachment View */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-brand-200/80 bg-white p-5 shadow-xs">
            <div className="flex items-center gap-2 border-b border-brand-100 pb-3 mb-4">
              <Icon name="mapPin" className="h-4 w-4 text-brand-700" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand-900">
                {tr('members.section.contactAddress')}
              </h4>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-xs font-semibold text-brand-500 block mb-1">{tr('members.presentAddress')}</span>
                <p className="rounded-xl border border-brand-100 bg-brand-50/40 p-3 text-brand-800">
                  {renderAddress(member.presentAddress)}
                </p>
              </div>
              <div>
                <span className="text-xs font-semibold text-brand-500 block mb-1">{tr('members.permanentAddress')}</span>
                <p className="rounded-xl border border-brand-100 bg-brand-50/40 p-3 text-brand-800">
                  {renderAddress(member.permanentAddress || member.presentAddress)}
                </p>
              </div>
            </div>
          </div>

          {/* Member NID Attachment Preview */}
          <div className="rounded-2xl border border-brand-200/80 bg-white p-4 shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-800 block mb-2">
              {tr('members.nidDocument')}
            </span>
            {member.nidDocument ? (
              <div className="flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50/30 p-3">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-16 overflow-hidden rounded-lg border border-brand-200 bg-white">
                    <img src={member.nidDocument} alt="NID Document" className="h-full w-full object-cover" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-brand-900">{tr('members.nidDocument')}</p>
                    <p className="text-[11px] text-brand-500">{tr('members.verifiedIdentityFile')}</p>
                  </div>
                </div>
                <a
                  href={member.nidDocument}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50 transition"
                >
                  <Icon name="externalLink" className="h-3.5 w-3.5" /> {tr('kyc.viewDocument')}
                </a>
              </div>
            ) : (
              <p className="text-xs text-brand-400 italic">{tr('members.noDocumentUploaded')}</p>
            )}
          </div>
        </div>
      </div>

      {/* 3. PORTAL ACCOUNT & ACCESS CONTROL */}
      {showPortalAccess && memberUser && (
        <div className="rounded-2xl border border-brand-200/80 bg-white p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-brand-100 pb-3 mb-4 gap-3">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand-900">
                {tr('members.access.securityTitle')}
              </h4>
              <p className="text-xs text-brand-500">{tr('members.access.securitySubtitle')}</p>
            </div>

            {isSuperAdmin && onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50 transition shrink-0"
              >
                <Icon name="userCog" className="h-3.5 w-3.5" />
                {tr('members.access.manage')}
              </button>
            )}
          </div>

          <dl className="space-y-3 text-sm grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <dt className="text-brand-500 text-xs font-semibold uppercase">{tr('members.access.accountStatus')}</dt>
              <dd className="mt-1 font-medium text-brand-900">
                <StatusBadge status={memberUser?.status || 'active'} />
              </dd>
            </div>
            <div>
              <dt className="text-brand-500 text-xs font-semibold uppercase">{tr('members.access.role')}</dt>
              <dd className="mt-1 font-bold text-brand-800 uppercase tracking-wide">
                {memberRole.replace(/_/g, ' ')}
              </dd>
            </div>
            <div>
              <dt className="text-brand-500 text-xs font-semibold uppercase">{tr('members.access.portalAccess')}</dt>
              <dd className="mt-1">
                <Badge variant={memberUser?.isActive === false ? 'danger' : 'success'}>
                  {memberUser?.isActive === false ? tr('members.access.disabled') : tr('members.access.enabled')}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-brand-500 text-xs font-semibold uppercase">{tr('members.lastLogin')}</dt>
              <dd className="mt-1 text-brand-700">
                {memberUser?.lastLoginAt ? formatDate(memberUser.lastLoginAt) : tr('members.access.neverLoggedIn')}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {/* 4. NOMINEE SHOWCASE CARDS */}
      <div className="rounded-2xl border border-brand-200/80 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between border-b border-brand-100 pb-3 mb-5">
          <div className="flex items-center gap-2">
            <Icon name="users" className="h-4 w-4 text-brand-700" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand-900">
              {tr('members.section.nomineeInfo')}
            </h4>
          </div>
          <span className="rounded-md bg-brand-100 px-2.5 py-1 text-xs font-bold text-brand-800 border border-brand-200">
            {tr('members.totalNominees', { count: member.nominees?.length || 0 })}
          </span>
        </div>

        {member.nominees?.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {member.nominees.map((nom, idx) => (
              <div
                key={nom._id || idx}
                className="relative overflow-hidden rounded-2xl border border-brand-200/90 bg-gradient-to-b from-white to-brand-50/30 p-4 shadow-xs hover:shadow-md transition"
              >
                {/* Header Share Badge */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-brand-200 bg-white shadow-xs">
                      {nom.photo ? (
                        <img src={nom.photo} alt={nom.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-brand-100 text-brand-400">
                          <Icon name="user" className="h-6 w-6" />
                        </div>
                      )}
                    </div>
                    <div>
                      <h5 className="font-bold text-brand-900 leading-tight">{nom.name}</h5>
                      <span className="text-xs font-medium text-brand-600 capitalize">
                        {tr(RELATIONSHIP_LABELS[nom.relation] || nom.relation || 'nominee')}
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-800 border border-emerald-200">
                    {nom.percentage || 100}%
                  </span>
                </div>

                {/* Nominee Details */}
                <div className="space-y-1.5 border-t border-brand-100 pt-3 text-xs text-brand-700">
                  <p className="flex justify-between">
                    <span className="text-brand-500">{tr('members.nomineeNid')}</span>
                    <span className="font-mono font-medium text-brand-900">{nom.nid || '—'}</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-brand-500">{tr('members.nomineePhone')}</span>
                    <span className="font-mono font-medium text-brand-900">{nom.phone || '—'}</span>
                  </p>
                  {nom.address && (
                    <p className="flex justify-between">
                      <span className="text-brand-500">{tr('members.nomineeAddress')}</span>
                      <span className="text-right text-brand-800 line-clamp-1">{renderAddress(nom.address)}</span>
                    </p>
                  )}
                </div>

                {/* Nominee Document link if exists */}
                {nom.nidDocument && (
                  <div className="mt-3 border-t border-brand-100 pt-2 flex items-center justify-between text-xs">
                    <span className="text-brand-500 flex items-center gap-1">
                      <Icon name="fileText" className="h-3.5 w-3.5 text-brand-600" /> {tr('members.documentAttached')}
                    </span>
                    <a
                      href={nom.nidDocument}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-brand-700 hover:text-brand-900 underline"
                    >
                      {tr('members.viewNid')}
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-brand-500 italic py-2">{tr('members.noNominees')}</p>
        )}
      </div>
    </div>
  );
}