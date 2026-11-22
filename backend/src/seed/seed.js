import mongoose from 'mongoose';
import config from '../config/env.js';
import { connectDB, disconnectDB } from '../config/db.js';
import User from '../models/User.js';
import Member from '../models/Member.js';
import SavingsScheme from '../models/SavingsScheme.js';
import { ensureChartOfAccounts } from '../services/ledger.service.js';
import { hashPassword } from '../utils/password.js';
import { nextMemberCode } from '../utils/sequence.js';
import { ROLES, BUSINESS_RULES, SAVINGS_TYPES, MEMBER_STATUS } from '../config/constants.js';

/** Super Admin bootstrap user (from env vars). */
const SUPER_ADMIN_USER = {
  name: process.env.SEED_ADMIN_NAME || 'Super Administrator',
  email: process.env.SEED_ADMIN_EMAIL,
  phone: process.env.SEED_ADMIN_PHONE,
  nid: process.env.SEED_ADMIN_NID,
  password: process.env.SEED_ADMIN_PASSWORD,
  role: ROLES.SUPER_ADMIN,
};

/** Allocates a member code, retrying if a manually inserted row already used it. */
async function allocateMemberCode() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = await nextMemberCode();
    const exists = await Member.exists({ code });
    if (!exists) return code;
  }
  throw new Error('Could not allocate a unique member code.');
}

/**
 * Ensures every staff login also has a linked Member profile, so the Members
 * module remains the only place where roles and portal access are managed.
 */
async function ensureMemberForUser(user, userData) {
  let member = await Member.findOne({ userId: user._id });

  if (!member) {
    const or = [{ phone: user.phone }];
    if (user.email) or.push({ email: user.email });
    if (user.nid) or.push({ nid: user.nid });
    member = await Member.findOne({ $or: or });
  }

  if (member) {
    if (!member.userId) {
      member.userId = user._id;
      await member.save();
    }
    if (!user.memberId) {
      user.memberId = member._id;
      await user.save();
    }
    return member;
  }

  const joinDate = user.createdAt || new Date();
  member = await Member.create({
    code: await allocateMemberCode(),
    fullName: user.name,
    phone: user.phone,
    email: user.email || undefined,
    nid: user.nid || userData.nid,
    joinDate,
    status: MEMBER_STATUS.ACTIVE,
    shareCount: 1,
    createdBy: user._id,
    notes: 'Staff profile created by seed.',
  });

  user.memberId = member._id;
  await user.save();

  return member;
}

const FIXED_SCHEMES = [
  {
    savingsType: SAVINGS_TYPES.MONTHLY,
    name: 'Monthly Savings',
    nameBn: 'মাসিক সঞ্চয়',
    description: 'Fixed monthly savings of ৳10,000 due on the 20th of each month. 5% late fee after due date.',
    principalPaisa: BUSINESS_RULES.MONTHLY_PRINCIPAL_PAISA,
    lateFeePercent: BUSINESS_RULES.LATE_FEE_PERCENT,
    isActive: true,
  },
  {
    savingsType: SAVINGS_TYPES.HALF_YEARLY,
    name: 'Half-Yearly Savings',
    nameBn: 'আর্ধবার্ষিক সঞ্চয়',
    description: 'Fixed half-yearly savings of ৳50,000 due on June 30 and December 31. 5% late fee after due date.',
    principalPaisa: BUSINESS_RULES.HALF_YEARLY_PRINCIPAL_PAISA,
    lateFeePercent: BUSINESS_RULES.LATE_FEE_PERCENT,
    isActive: true,
  },
  {
    savingsType: SAVINGS_TYPES.ONE_TIME,
    name: 'One-Time Savings',
    nameBn: 'একবারের সঞ্চয়',
    description: 'Ad-hoc savings deposits with no fixed schedule.',
    principalPaisa: 0,
    lateFeePercent: 0,
    isActive: true,
  },
];

async function seed() {
  await connectDB();
  console.info('[seed] connected to database');

  await ensureChartOfAccounts();
  console.info('[seed] chart of accounts ready');

  // Create Super Admin bootstrap user (if env vars are provided).
  // Other staff roles (Treasurer, GS, President) are assigned later
  // by Super Admin via the Members module UI/API.
  const userData = SUPER_ADMIN_USER;
  if (userData.email && userData.password && userData.phone && userData.nid) {
    let user = await User.findOne({ email: userData.email });
    if (!user) {
      user = await User.create({
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
        nid: userData.nid,
        role: userData.role,
        passwordHash: await hashPassword(userData.password),
        status: 'active',
        mustChangePassword: false,
      });
      console.info(`[seed] ${userData.role} created: ${userData.email}`);
    } else {
      console.info(`[seed] ${userData.role} already exists: ${userData.email}`);
    }

    await ensureMemberForUser(user, userData);
  } else {
    console.warn('[seed] Super Admin env vars not set (SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_ADMIN_PHONE, SEED_ADMIN_NID). Skipping bootstrap user creation.');
    console.warn('[seed] Create the first Super Admin manually via the Members module after signup.');
  }

  for (const scheme of FIXED_SCHEMES) {
    const exists = await SavingsScheme.findOne({ savingsType: scheme.savingsType });
    if (!exists) {
      await SavingsScheme.create(scheme);
      console.info(`[seed] scheme created: ${scheme.savingsType}`);
    } else {
      if (exists.principalPaisa !== scheme.principalPaisa) {
        exists.principalPaisa = scheme.principalPaisa;
        exists.lateFeePercent = scheme.lateFeePercent;
        exists.isActive = scheme.isActive;
        await exists.save();
        console.info(`[seed] scheme updated: ${scheme.savingsType}`);
      }
    }
  }

  console.info('\n[seed] done.');
  if (userData.email && userData.password) {
    console.info(`  Super Admin: ${userData.email} / ${userData.password}`);
    console.info('  Change password immediately after first sign-in.\n');
  } else {
    console.info('  No bootstrap user created. Set SEED_ADMIN_* env vars to auto-create Super Admin.\n');
  }

  await mongoose.disconnect();
  await disconnectDB();
}

seed().catch(async (error) => {
  console.error('[seed] failed:', error);
  await disconnectDB().catch(() => {});
  process.exit(1);
});