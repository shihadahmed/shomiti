import mongoose from 'mongoose';
import config from '../config/env.js';
import { connectDB, disconnectDB } from '../config/db.js';
import User from '../models/User.js';
import SavingsScheme from '../models/SavingsScheme.js';
import { ensureChartOfAccounts } from '../services/ledger.service.js';
import { hashPassword } from '../utils/password.js';
import { ROLES, BUSINESS_RULES, SAVINGS_TYPES } from '../config/constants.js';

const DEFAULT_USERS = [
  {
    name: 'Super Administrator',
    email: process.env.SEED_ADMIN_EMAIL || 'admin@shomiti.local',
    phone: process.env.SEED_ADMIN_PHONE || '01700000000',
    password: process.env.SEED_ADMIN_PASSWORD || 'Admin@12345',
    role: ROLES.SUPER_ADMIN,
  },
  {
    name: 'Treasurer',
    email: process.env.SEED_TREASURER_EMAIL || 'treasurer@shomiti.local',
    phone: process.env.SEED_TREASURER_PHONE || '01700000001',
    password: process.env.SEED_TREASURER_PASSWORD || 'Treasurer@12345',
    role: ROLES.TREASURER,
  },
  {
    name: 'General Secretary',
    email: process.env.SEED_GS_EMAIL || 'gs@shomiti.local',
    phone: process.env.SEED_GS_PHONE || '01700000002',
    password: process.env.SEED_GS_PASSWORD || 'GS@12345',
    role: ROLES.GENERAL_SECRETARY,
  },
  {
    name: 'President',
    email: process.env.SEED_PRESIDENT_EMAIL || 'president@shomiti.local',
    phone: process.env.SEED_PRESIDENT_PHONE || '01700000003',
    password: process.env.SEED_PRESIDENT_PASSWORD || 'President@12345',
    role: ROLES.PRESIDENT,
  },
];

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

  for (const userData of DEFAULT_USERS) {
    const existing = await User.findOne({ email: userData.email });
    if (!existing) {
      await User.create({
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
        role: userData.role,
        passwordHash: await hashPassword(userData.password),
      });
      console.info(`[seed] ${userData.role} created: ${userData.email}`);
    } else {
      console.info(`[seed] ${userData.role} already exists: ${userData.email}`);
    }
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

  console.info('\n[seed] done. Sign in with:');
  for (const userData of DEFAULT_USERS) {
    console.info(`  ${userData.role.padEnd(20)} : ${userData.email} / ${userData.password}`);
  }
  console.info('  Change all passwords immediately after first sign-in.\n');

  await mongoose.disconnect();
  await disconnectDB();
}

seed().catch(async (error) => {
  console.error('[seed] failed:', error);
  await disconnectDB().catch(() => {});
  process.exit(1);
});