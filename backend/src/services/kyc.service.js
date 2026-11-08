import mongoose from 'mongoose';
import User from '../models/User.js';
import Member from '../models/Member.js';
import ApiError from '../utils/ApiError.js';
import { writeAudit } from '../utils/audit.js';
import {
  USER_STATUS,
  KYC_BLOCKED_STATUSES,
  KYC_SUBMITTABLE_STATUSES,
} from '../config/constants.js';
import * as emailService from './email.service.js';
import * as notificationService from './notification.service.js';
import { NOTIFICATION_TYPE } from '../config/constants.js';
import { getPagination, paginationMeta } from '../utils/pagination.js';

const MEMBER_KYC_FIELDS = [
  'fullName',
  'fullNameBn',
  'fatherHusbandName',
  'motherName',
  'spouseName',
  'dateOfBirth',
  'nid',
  'occupation',
  'phone',
  'email',
  'presentAddress',
  'permanentAddress',
  'photo',
  'nidDocument',
  'nominees',
  'shareCount',
  'notes',
  'code',
].join(' ');

const USER_KYC_FIELDS = [
  'name',
  'email',
  'phone',
  'nid',
  'status',
  'rejectionReason',
  'profileData',
  'pendingProfileData',
  'hasPendingKycUpdate',
  'kycSubmittedAt',
  'kycUpdateSubmittedAt',
  'role',
  'createdAt',
  'memberId',
].join(' ');

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** Returns the first defined, non-null, non-blank value. */
function firstFilled(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    return value;
  }
  return '';
}

/** Renders a Member address (string or structured) as one line of text. */
function addressToText(address) {
  if (!address) return '';
  if (typeof address === 'string') return address.trim();
  if (!isPlainObject(address)) return '';

  return (
    firstFilled(address.fullAddress) ||
    [address.village, address.postOffice, address.upazila, address.district]
      .filter((part) => Boolean(part && String(part).trim()))
      .join(', ')
  );
}

/** Reads the old KYC address shape (flat fields) when a member address is absent. */
function legacyAddressToText(snapshot, field) {
  const direct = addressToText(snapshot?.[field]);
  if (direct) return direct;

  if (field === 'presentAddress') {
    return [snapshot?.village, snapshot?.postOffice, snapshot?.upazila, snapshot?.district]
      .filter((part) => Boolean(part && String(part).trim()))
      .join(', ');
  }
  return '';
}

function mapNomineeForProfile(nominee) {
  if (!nominee) return null;
  return {
    ...(nominee._id ? { _id: String(nominee._id) } : {}),
    name: nominee.name || '',
    relation: nominee.relation || '',
    nid: nominee.nid || '',
    phone: nominee.phone || '',
    percentage: Number(nominee.percentage) || 0,
    photo: nominee.photo || '',
    nidDocument: nominee.nidDocument || '',
  };
}

function legacyNominees(snapshot) {
  if (Array.isArray(snapshot?.nominees)) {
    return snapshot.nominees.map(mapNomineeForProfile).filter(Boolean);
  }

  if (snapshot?.nomineeName) {
    return [
      {
        name: snapshot.nomineeName,
        relation: snapshot.nomineeRelation || '',
        nid: snapshot.nomineeNid || '',
        phone: snapshot.nomineePhone || '',
        percentage: Number(snapshot.nomineePercentage) || 100,
        photo: snapshot.nomineePhoto || '',
        nidDocument: snapshot.nomineeDocument || '',
      },
    ];
  }

  return [];
}

/**
 * Builds the form defaults shown on the Complete Profile page and in the
 * reviewer modal. The Member record is canonical; the previous KYC snapshot
 * and the User identity fill any gaps (legacy records, first submission).
 */
function buildKycProfileData(user, member) {
  const snapshot = isPlainObject(user?.profileData) ? user.profileData : {};
  const memberNominees = Array.isArray(member?.nominees)
    ? member.nominees.map(mapNomineeForProfile).filter(Boolean)
    : [];

  return {
    fullName: firstFilled(member?.fullName, snapshot.fullName, user?.name),
    fullNameBn: firstFilled(member?.fullNameBn, snapshot.fullNameBn),
    fatherHusbandName: firstFilled(
      member?.fatherHusbandName,
      snapshot.fatherHusbandName,
      snapshot.fatherName,
    ),
    motherName: firstFilled(member?.motherName, snapshot.motherName),
    dateOfBirth: firstFilled(member?.dateOfBirth, snapshot.dateOfBirth, snapshot.dob) || null,
    nid: firstFilled(member?.nid, snapshot.nid, user?.nid),
    occupation: firstFilled(member?.occupation, snapshot.occupation),
    phone: firstFilled(member?.phone, snapshot.phone, user?.phone),
    email: firstFilled(member?.email, snapshot.email, user?.email),
    presentAddress: firstFilled(
      addressToText(member?.presentAddress),
      legacyAddressToText(snapshot, 'presentAddress'),
    ),
    permanentAddress: firstFilled(
      addressToText(member?.permanentAddress),
      legacyAddressToText(snapshot, 'permanentAddress'),
    ),
    photo: firstFilled(member?.photo, snapshot.photo),
    nidDocument: firstFilled(member?.nidDocument, snapshot.nidDocument),
    nominees: memberNominees.length ? memberNominees : legacyNominees(snapshot),
    notes: firstFilled(snapshot.notes),
    // Read-only context for reviewers; not editable on the KYC form.
    shareCount: member?.shareCount ?? snapshot.shareCount ?? null,
    spouseName: firstFilled(member?.spouseName, snapshot.spouseName),
  };
}

/** Resolves the Member linked to a User, falling back to the reverse link for legacy records. */
async function findMemberForUser(user, { session, autoLink = false } = {}) {
  const queryOptions = session ? { session } : {};

  if (user.memberId) {
    const member = await Member.findById(user.memberId, null, queryOptions);
    if (member) return member;
  }

  const member = await Member.findOne({ userId: user._id }, null, queryOptions);
  
  // Auto-link the member to the user if found via reverse lookup and not in a transaction
  if (member && !session && autoLink && !user.memberId) {
    user.memberId = member._id;
    await user.save();
  }
  
  return member;
}

function buildNominees(input, existingNominees = []) {
  const existing = Array.isArray(existingNominees) ? existingNominees : [];
  const byId = new Map(existing.map((nominee) => [String(nominee._id), nominee]));
  const byNid = new Map(
    existing
      .filter((nominee) => nominee.nid)
      .map((nominee) => [String(nominee.nid), nominee]),
  );

  return (Array.isArray(input) ? input : []).map((nominee, index) => {
    const previous = nominee._id
      ? byId.get(String(nominee._id))
      : byNid.get(String(nominee.nid)) || existing[index];
    const base = previous
      ? typeof previous.toObject === 'function'
        ? previous.toObject()
        : { ...previous }
      : {};

    // Keep registration-only fields (father/husband name, DOB, address) that
    // are not part of the KYC form but belong to the same nominee record.
    return {
      ...base,
      name: nominee.name,
      relation: nominee.relation,
      nid: nominee.nid,
      phone: nominee.phone || '',
      percentage: Number(nominee.percentage) || 0,
      photo: nominee.photo || '',
      nidDocument: nominee.nidDocument || '',
    };
  });
}

/**
 * Builds the normalized snapshot persisted on the User. The same shape is
 * stored as profileData (last submitted/approved) and pendingProfileData
 * (active-member update awaiting review).
 */
function buildProfileSnapshot(payload, { existingNominees = [], shareCount = null, spouseName = '' } = {}) {
  const presentAddress = String(payload.presentAddress || '').trim();
  const permanentAddress =
    payload.sameAsPresent === true
      ? presentAddress
      : String(payload.permanentAddress || '').trim();

  const nominees = buildNominees(payload.nominees, existingNominees)
    .map((nominee) => {
      const withId = nominee._id
        ? nominee
        : { ...nominee, _id: new mongoose.Types.ObjectId() };
      return mapNomineeForProfile(withId);
    })
    .filter(Boolean);

  return {
    fullName: payload.fullName,
    fullNameBn: payload.fullNameBn || '',
    fatherHusbandName: payload.fatherHusbandName || '',
    motherName: payload.motherName || '',
    dateOfBirth: payload.dateOfBirth || null,
    nid: payload.nid,
    occupation: payload.occupation || '',
    phone: payload.phone,
    email: payload.email ? String(payload.email).toLowerCase() : '',
    presentAddress,
    permanentAddress,
    photo: payload.photo || '',
    nidDocument: payload.nidDocument || '',
    nominees,
    notes: payload.notes || '',
    shareCount: shareCount ?? null,
    spouseName: spouseName || '',
  };
}

/** Copies a normalized snapshot onto the live Member document (not saved here). */
function applyProfileSnapshot(member, snapshot) {
  member.fullName = snapshot.fullName;
  member.fullNameBn = snapshot.fullNameBn || '';
  member.fatherHusbandName = snapshot.fatherHusbandName || '';
  member.motherName = snapshot.motherName || '';
  member.dateOfBirth = snapshot.dateOfBirth || null;
  member.nid = snapshot.nid;
  member.occupation = snapshot.occupation || '';
  member.phone = snapshot.phone;
  if (snapshot.email) member.email = String(snapshot.email).toLowerCase();
  member.presentAddress = { fullAddress: snapshot.presentAddress || '' };
  member.permanentAddress = { fullAddress: snapshot.permanentAddress || '' };
  member.photo = snapshot.photo || '';
  member.nidDocument = snapshot.nidDocument || '';
  member.nominees = buildNominees(snapshot.nominees, member.nominees);
}

/** Builds a normalized snapshot from a saved Member record. */
function snapshotFromMember(member, { notes = '' } = {}) {
  return {
    fullName: member.fullName,
    fullNameBn: member.fullNameBn || '',
    fatherHusbandName: member.fatherHusbandName || '',
    motherName: member.motherName || '',
    dateOfBirth: member.dateOfBirth || null,
    nid: member.nid,
    occupation: member.occupation || '',
    phone: member.phone,
    email: member.email || '',
    presentAddress: addressToText(member.presentAddress),
    permanentAddress: addressToText(member.permanentAddress),
    photo: member.photo || '',
    nidDocument: member.nidDocument || '',
    nominees: (member.nominees || []).map(mapNomineeForProfile).filter(Boolean),
    notes,
    shareCount: member.shareCount ?? null,
    spouseName: member.spouseName || '',
  };
}

/** Keeps the login identity aligned with the approved member profile. */
function syncUserIdentity(user, snapshot) {
  user.name = snapshot.fullName;
  user.phone = snapshot.phone;
  user.nid = snapshot.nid;
  if (snapshot.email) user.email = String(snapshot.email).toLowerCase();
}

/** Converts a duplicate-index failure into a friendly, actionable 409. */
function translateDuplicateKeyError(error) {
  if (error?.code !== 11000) return error;

  const field = Object.keys(error.keyPattern || error.keyValue || {})[0];
  const labels = {
    phone: 'phone number',
    nid: 'NID',
    email: 'email address',
  };
  const label = labels[field] || 'value';

  return ApiError.conflict(
    `This ${label} is already registered to another member. Please correct the requested update and try again.`,
    'KYC_UPDATE_CONFLICT',
  );
}

/** Return the current user's KYC profile summary with member-backed defaults. */
export async function getMyKyc(userId) {
  const user = await User.findById(userId).select(USER_KYC_FIELDS);
  if (!user) throw ApiError.notFound('User not found.', 'USER_NOT_FOUND');

  const member = await findMemberForUser(user, { autoLink: true });
  return {
    ...user.toJSON(),
    member,
    profileData: buildKycProfileData(user, member),
  };
}

/** Submit KYC for review, or stage an active-member profile update. */
export async function submitKyc(userId, payload, req) {
  const session = await mongoose.startSession();
  let result;

  try {
    result = await session.withTransaction(async () => {
      const user = await User.findById(userId).session(session);
      if (!user) throw ApiError.notFound('User not found.', 'USER_NOT_FOUND');

      const isActive = user.status === USER_STATUS.ACTIVE;
      if (!isActive && !KYC_SUBMITTABLE_STATUSES.includes(user.status)) {
        throw ApiError.badRequest(
          user.status === USER_STATUS.UNDER_REVIEW
            ? 'Your profile is currently under review and cannot be resubmitted.'
            : 'Your profile is not in a state that can be submitted.',
          'KYC_NOT_SUBMITTABLE',
        );
      }

      const member = await findMemberForUser(user, { session });
      if (!member) {
        throw ApiError.notFound(
          'No member record is linked to this account. Please contact an administrator.',
          'MEMBER_NOT_FOUND',
        );
      }

      const snapshot = buildProfileSnapshot(payload, {
        existingNominees: member.nominees,
        shareCount: member.shareCount,
        spouseName: member.spouseName,
      });

      if (isActive) {
        if (user.hasPendingKycUpdate) {
          throw ApiError.conflict(
            'A profile update request is already pending review.',
            'KYC_UPDATE_PENDING',
          );
        }

        // Staging only: the live Member record must remain untouched until an
        // approver explicitly accepts the requested changes.
        const before = buildKycProfileData(user, member);
        user.pendingProfileData = snapshot;
        user.hasPendingKycUpdate = true;
        user.kycUpdateSubmittedAt = new Date();
        user.rejectionReason = null;
        await user.save({ session });

        await writeAudit({
          actor: user._id,
          action: 'member.profile_update_requested',
          entityType: 'Member',
          entityId: member._id,
          before,
          after: snapshot,
          req,
          session,
        });

        return { user, requestType: 'update' };
      }

      // Repair a legacy one-sided link while the records are in hand.
      if (!user.memberId) user.memberId = member._id;
      if (!member.userId) member.userId = user._id;

      const memberBefore = member.toObject();
      const userBefore = {
        status: user.status,
        rejectionReason: user.rejectionReason,
        profileData: user.profileData,
      };

      applyProfileSnapshot(member, snapshot);
      await member.save({ session });

      const profileData = snapshotFromMember(member, { notes: snapshot.notes });

      // Keep the login identity aligned with the member record.
      syncUserIdentity(user, profileData);
      user.profileData = profileData;
      user.kycSubmittedAt = new Date();
      user.status = USER_STATUS.UNDER_REVIEW;
      user.rejectionReason = null;
      user.pendingProfileData = null;
      user.hasPendingKycUpdate = false;
      await user.save({ session });

      await writeAudit({
        actor: user._id,
        action: 'member.kyc_updated',
        entityType: 'Member',
        entityId: member._id,
        before: memberBefore,
        after: member,
        req,
        session,
      });

      await writeAudit({
        actor: user._id,
        action: 'user.kyc_submitted',
        entityType: 'User',
        entityId: user._id,
        before: userBefore,
        after: {
          status: user.status,
          rejectionReason: user.rejectionReason,
          profileData: user.profileData,
          kycSubmittedAt: user.kycSubmittedAt,
        },
        req,
        session,
      });

      return { user, requestType: 'initial' };
    });
  } finally {
    await session.endSession();
  }

  // Email delivery must never hold the transaction open or roll it back.
  if (result?.requestType === 'initial' && result.user?.email) {
    try {
      await emailService.sendProfileSubmittedEmail({
        to: result.user.email,
        name: result.user.name,
      });
    } catch (emailError) {
      console.error('[KYC Service] profile-submitted email failed:', emailError.message);
    }
  }

  // Send in-app notification to all users with KYC approval permission.
  if (result?.requestType === 'initial') {
    try {
      await notificationService.notifyPermissionHolders({
        permission: 'users.manage_kyc',
        excludeUserId: result.user._id,
        type: NOTIFICATION_TYPE.KYC_REVIEW_REQUESTED,
        title: 'New KYC Submission for Review',
        message: `${result.user.name} has submitted their profile for KYC review.`,
        link: '/approvals?tab=kyc',
        metadata: { userId: result.user._id.toString(), memberCode: result.user.memberId?.toString() },
        actor: result.user,
        req,
      });
    } catch (notificationError) {
      console.error('[KYC Service] KYC review requested notification failed:', notificationError.message);
    }
  }

  return result;
}

/** List users awaiting KYC review, including active pending profile updates. */
export async function listPendingKyc(query = {}) {
  const { page = 1, limit = 20, status, search } = query;
  const skip = (page - 1) * limit;

  const conditions = [
    {
      $or: [
        { status: { $in: KYC_BLOCKED_STATUSES } },
        { status: USER_STATUS.ACTIVE, hasPendingKycUpdate: true },
      ],
    },
  ];
  if (status) conditions.push({ status });
  if (search) {
    conditions.push({
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ],
    });
  }
  const filter = conditions.length === 1 ? conditions[0] : { $and: conditions };

  const [users, total] = await Promise.all([
    User.find(filter)
      .select(USER_KYC_FIELDS)
      .sort({ kycUpdateSubmittedAt: -1, kycSubmittedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('memberId', MEMBER_KYC_FIELDS)
      .lean(),
    User.countDocuments(filter),
  ]);

  const items = users.map((user) => {
    const member =
      user.memberId && typeof user.memberId === 'object' && user.memberId._id
        ? user.memberId
        : null;
    const liveData = buildKycProfileData(user, member);
    const requestType =
      user.status === USER_STATUS.ACTIVE && user.hasPendingKycUpdate ? 'update' : 'initial';
    const requestedData =
      requestType === 'update' && isPlainObject(user.pendingProfileData)
        ? user.pendingProfileData
        : liveData;

    return {
      ...user,
      profileData: requestedData,
      liveData,
      requestedData,
      requestType,
    };
  });

  return { items, meta: paginationMeta(total, page, limit) };
}

/** Approve or reject a KYC profile or a staged profile update (approvers only). */
export async function decideKyc(userId, { decision, reason }, actor, req) {
  if (!mongoose.isValidObjectId(userId)) {
    throw ApiError.badRequest('Invalid user id.', 'INVALID_IDENTIFIER');
  }

  const session = await mongoose.startSession();
  let result;

  try {
    result = await session.withTransaction(async () => {
      const user = await User.findById(userId).session(session);
      if (!user) throw ApiError.notFound('User not found.', 'USER_NOT_FOUND');

      const isUpdate = user.status === USER_STATUS.ACTIVE && user.hasPendingKycUpdate;

      if (user.status === USER_STATUS.ACTIVE && !isUpdate) {
        throw ApiError.conflict('This account is already active.', 'KYC_ALREADY_ACTIVE');
      }

      if (isUpdate) {
        const pending = isPlainObject(user.pendingProfileData) ? user.pendingProfileData : null;
        if (!pending) {
          throw ApiError.conflict(
            'There is no pending profile update to review.',
            'KYC_UPDATE_NOT_PENDING',
          );
        }

        const member = await findMemberForUser(user, { session });
        if (!member) {
          throw ApiError.notFound(
            'No member record is linked to this account. Please contact an administrator.',
            'MEMBER_NOT_FOUND',
          );
        }

        const before = buildKycProfileData(user, member);
        const rejectionReason = decision === 'rejected' ? String(reason || '').trim() : '';

        if (decision === 'approved') {
          applyProfileSnapshot(member, pending);
          try {
            await member.save({ session });
          } catch (error) {
            throw translateDuplicateKeyError(error);
          }

          // Reflect the applied Member values, including any unchanged email.
          const applied = snapshotFromMember(member, { notes: pending.notes });
          syncUserIdentity(user, applied);
          user.profileData = applied;
          user.status = USER_STATUS.ACTIVE;
          user.rejectionReason = null;
        } else {
          user.rejectionReason = rejectionReason;
        }

        user.pendingProfileData = null;
        user.hasPendingKycUpdate = false;
        try {
          await user.save({ session });
        } catch (error) {
          throw translateDuplicateKeyError(error);
        }

        await writeAudit({
          actor: actor._id,
          action:
            decision === 'approved'
              ? 'member.profile_update_approved'
              : 'member.profile_update_rejected',
          entityType: 'Member',
          entityId: member._id,
          before,
          after:
            decision === 'approved'
              ? user.profileData
              : {
                  pendingProfileData: pending,
                  rejectionReason: user.rejectionReason,
                  kycUpdateSubmittedAt: user.kycUpdateSubmittedAt,
                },
          req,
          session,
        });

        return { user, requestType: 'update' };
      }

      const before = { status: user.status, rejectionReason: user.rejectionReason };

      if (decision === 'approved') {
        user.status = USER_STATUS.ACTIVE;
        user.rejectionReason = null;
      } else {
        user.status = USER_STATUS.REJECTED;
        user.rejectionReason = reason.trim();
      }
      await user.save({ session });

      const action = decision === 'approved' ? 'user.kyc_approved' : 'user.kyc_rejected';
      await writeAudit({
        actor: actor._id,
        action,
        entityType: 'User',
        entityId: user._id,
        before,
        after: { status: user.status, rejectionReason: user.rejectionReason },
        req,
        session,
      });

      return { user, requestType: 'initial' };
    });
  } finally {
    await session.endSession();
  }

  // Account-level emails apply to initial onboarding decisions only; profile
  // update requests are resolved without messaging the member's account.
  if (result?.requestType === 'initial') {
    try {
      if (decision === 'approved') {
        await emailService.sendAccountApprovedEmail({
          to: result.user.email,
          name: result.user.name,
        });
      } else {
        await emailService.sendAccountRejectedEmail({
          to: result.user.email,
          name: result.user.name,
          reason: result.user.rejectionReason,
        });
      }
    } catch (emailError) {
      console.error('[KYC Service] decision email failed:', emailError.message);
    }
  }

  return result;
}

export default {
  getMyKyc,
  submitKyc,
  listPendingKyc,
  decideKyc,
};
