import mongoose from 'mongoose';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { writeAudit } from '../utils/audit.js';
import {
  USER_STATUS,
  KYC_BLOCKED_STATUSES,
  NOTIFICATION_TYPE,
} from '../config/constants.js';
import emailService from './email.service.js';
import { getPagination, paginationMeta } from '../utils/pagination.js';

const KYC_FIELDS = [
  'fullName',
  'fatherName',
  'motherName',
  'spouseName',
  'nid',
  'dateOfBirth',
  'occupation',
  'email',
  'phone',
  'village',
  'postOffice',
  'upazila',
  'district',
  'nomineeName',
  'nomineeRelation',
  'nomineePhone',
  'shareCount',
  'notes',
];

function pickProfileData(body) {
  const data = {};
  for (const field of KYC_FIELDS) {
    if (body[field] !== undefined && body[field] !== '') {
      data[field] = body[field];
    }
  }
  return data;
}

/** Return the current user's KYC profile summary. */
export async function getMyKyc(userId) {
  const user = await User.findById(userId)
    .select('name email phone nid status rejectionReason profileData kycSubmittedAt role createdAt')
    .lean();
  if (!user) throw ApiError.notFound('User not found.', 'USER_NOT_FOUND');
  return user;
}

/** Submit / resubmit the member profile for KYC review. */
export async function submitKyc(userId, payload, req) {
  const session = await mongoose.startSession();

  try {
    return await session.withTransaction(async () => {
      const user = await User.findById(userId).session(session);
      if (!user) throw ApiError.notFound('User not found.', 'USER_NOT_FOUND');

      if (!KYC_BLOCKED_STATUSES.includes(user.status)) {
        throw ApiError.badRequest(
          'Your profile is not in a state that can be resubmitted.',
          'KYC_NOT_SUBMITTABLE',
        );
      }

      const profileData = pickProfileData(payload);
      if (Object.keys(profileData).length === 0) {
        throw ApiError.badRequest('At least one profile field is required.', 'KYC_EMPTY_PROFILE');
      }

      const before = {
        status: user.status,
        profileData: user.profileData,
        rejectionReason: user.rejectionReason,
      };

      user.profileData = profileData;
      user.kycSubmittedAt = new Date();
      user.status = USER_STATUS.UNDER_REVIEW;
      user.rejectionReason = null;
      await user.save({ session });

      await writeAudit({
        actor: user._id,
        action: 'user.kyc_submitted',
        entityType: 'User',
        entityId: user._id,
        before,
        after: {
          status: user.status,
          profileData: user.profileData,
          kycSubmittedAt: user.kycSubmittedAt,
        },
        req,
        session,
      });

      try {
        await emailService.sendProfileSubmittedEmail({
          to: user.email,
          name: user.name,
        });
      } catch (emailError) {
        // Do not fail the submission if email delivery fails.
        console.error('[KYC Service] profile-submitted email failed:', emailError.message);
      }

      return user;
    });
  } finally {
    await session.endSession();
  }
}

/** List users awaiting KYC review (for approvers). */
export async function listPendingKyc(query = {}) {
  const { page = 1, limit = 20, status, search } = query;
  const skip = (page - 1) * limit;

  const filter = { status: { $in: KYC_BLOCKED_STATUSES } };
  if (status) filter.status = status;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];
  }

  const [items, total] = await Promise.all([
    User.find(filter)
      .select('name email phone nid status rejectionReason profileData kycSubmittedAt role createdAt')
      .sort({ kycSubmittedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  return { items, meta: paginationMeta(total, page, limit) };
}

/** Approve or reject a user's KYC profile (approvers only). */
export async function decideKyc(userId, { decision, reason }, actor, req) {
  if (!mongoose.isValidObjectId(userId)) {
    throw ApiError.badRequest('Invalid user id.', 'INVALID_IDENTIFIER');
  }

  const session = await mongoose.startSession();

  try {
    return await session.withTransaction(async () => {
      const user = await User.findById(userId).session(session);
      if (!user) throw ApiError.notFound('User not found.', 'USER_NOT_FOUND');

      if (user.status === USER_STATUS.ACTIVE) {
        throw ApiError.conflict('This account is already active.', 'KYC_ALREADY_ACTIVE');
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

      const title =
        decision === 'approved'
          ? 'Account Approved & Verified'
          : 'Profile Submission — Not Approved';

      try {
        if (decision === 'approved') {
          await emailService.sendAccountApprovedEmail({ to: user.email, name: user.name });
        } else {
          await emailService.sendAccountRejectedEmail({
            to: user.email,
            name: user.name,
            reason: user.rejectionReason,
          });
        }
      } catch (emailError) {
        console.error('[KYC Service] decision email failed:', emailError.message);
      }

      return user;
    });
  } finally {
    await session.endSession();
  }
}

export default {
  getMyKyc,
  submitKyc,
  listPendingKyc,
  decideKyc,
};
