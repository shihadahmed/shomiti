import config from './config/env.js';
import app from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { initializeDefaultRoles } from './services/role.service.js';
import User from './models/User.js';
import SavingsScheme from './models/SavingsScheme.js';
import { ensureChartOfAccounts } from './services/ledger.service.js';
import { hashPassword } from './utils/password.js';
import { ROLES, BUSINESS_RULES, SAVINGS_TYPES } from './config/constants.js';

let server;

async function seedDefaultData() {
  // Seed default users
  const defaultUsers = [
    {
      name: 'Super Administrator',
      email: config.seed.adminEmail,
      phone: config.seed.adminPhone,
      password: config.seed.adminPassword,
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

  for (const userData of defaultUsers) {
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
    }
  }

  // Seed default savings schemes
  const fixedSchemes = [
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

  for (const scheme of fixedSchemes) {
    const exists = await SavingsScheme.findOne({ savingsType: scheme.savingsType });
    if (!exists) {
      await SavingsScheme.create(scheme);
      console.info(`[seed] scheme created: ${scheme.savingsType}`);
    }
  }

  // Ensure chart of accounts
  await ensureChartOfAccounts();
  console.info('[seed] chart of accounts ready');
}

async function start() {
  try {
    await connectDB();
    await initializeDefaultRoles();
    await seedDefaultData();
    server = app.listen(config.port, () => {
      console.info('═'.repeat(60));
      console.info(`[SYSTEM STATUS]: Running ${config.modeLabel}`);
      console.info(`[DETECTION SOURCE]: ${config.detectionSource}`);
      console.info(`[ENVIRONMENT]: ${config.nodeEnv.toUpperCase()}`);
      console.info(`[SERVER]: SHOPNONIR SOMOBAI SOMITEE API listening on http://localhost:${config.port}`);
      console.info('═'.repeat(60));
    });
  } catch (error) {
    console.error('[server] failed to start:', error.message);
    process.exit(1);
  }
}

async function shutdown(signal) {
  console.info(`[server] ${signal} received, shutting down...`);
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await disconnectDB();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandled rejection:', reason);
});
process.on('uncaughtException', (error) => {
  console.error('[server] uncaught exception:', error);
  process.exit(1);
});

start();