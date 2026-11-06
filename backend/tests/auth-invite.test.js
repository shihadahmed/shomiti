import './helpers/test-env.js';
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import app from '../src/app.js';
import { testOutbox } from '../src/services/email.service.js';
import User from '../src/models/User.js';
import Role from '../src/models/Role.js';
import Member from '../src/models/Member.js';
import SavingsAccount from '../src/models/SavingsAccount.js';
import { signAccessToken } from '../src/utils/jwt.js';
import { hashPassword } from '../src/utils/password.js';

/** A replica set is required because member creation runs in a transaction. */
let mongoServer;
let adminToken;
let treasurerToken;
let adminUser;
let adminMember;

const asAdmin = (req) => req
  .set('Authorization', `Bearer ${adminToken}`)
  .set('X-Requested-With', 'XMLHttpRequest');

const asTreasurer = (req) => req
  .set('Authorization', `Bearer ${treasurerToken}`)
  .set('X-Requested-With', 'XMLHttpRequest');

const validMemberPayload = (overrides = {}) => ({
  fullName: 'Invited Member',
  nid: '1020304050',
  phone: '01712345678',
  email: 'member@test.local',
  presentAddress: 'House 12, Road 4, Dhanmondi, Dhaka',
  nominees: [
    { name: 'Nominee One', relation: 'spouse', nid: '9988776655', percentage: 100 },
  ],
  ...overrides,
});

before(async () => {
  mongoServer = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  await mongoose.connect(mongoServer.getUri());

  await Role.create([
    {
      name: 'super_admin',
      description: 'Full system access',
      isSystemLocked: true,
      permissions: ['roles.create', 'roles.view', 'roles.assign', 'users.manage_kyc'],
    },
    { name: 'treasurer', description: 'Treasurer', isSystemLocked: true, permissions: ['roles.view'] },
    { name: 'general_secretary', description: 'General Secretary', isSystemLocked: true, permissions: ['roles.view'] },
    { name: 'president', description: 'President', isSystemLocked: true, permissions: ['roles.view'] },
    { name: 'member', description: 'Member portal', isSystemLocked: true, permissions: [] },
  ]);

  adminUser = await User.create({
    name: 'Test Admin',
    email: 'admin@test.local',
    phone: '01700000000',
    role: 'super_admin',
    passwordHash: await hashPassword('Admin@12345'),
    isActive: true,
  });

  adminMember = await Member.create({
    code: 'SOM-TEST-ADMIN',
    fullName: 'Test Admin',
    nid: '3333333333',
    phone: '01700000000',
    email: 'admin@test.local',
    status: 'active',
  });

  adminUser.memberId = adminMember._id;
  await adminUser.save();
  adminMember.userId = adminUser._id;
  await adminMember.save();

  adminToken = signAccessToken(adminUser);

  const treasurer = await User.create({
    name: 'Test Treasurer',
    email: 'treasurer@test.local',
    phone: '01700000010',
    role: 'treasurer',
    passwordHash: await hashPassword('Treasurer@12345'),
    isActive: true,
  });
  treasurerToken = signAccessToken(treasurer);
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Member invite and password setup workflow', () => {
  let testMember;
  let testUser;

  before(async () => {
    const res = await asAdmin(request(app).post('/api/members')).send(validMemberPayload({
      fullName: 'Test Member',
      nid: '1111111111',
      phone: '01799999999',
      email: 'testmember@test.local',
    }));

    assert.equal(res.status, 201);
    testMember = res.body.data.member;
    testUser = res.body.data.user;
  });

  test('registration creates an invited account and emails a setup link', async () => {
    assert.ok(testUser, 'member registration always creates a login account');
    assert.equal(testUser.status, 'invited');
    assert.equal(testUser.mustChangePassword, true);
    assert.equal(testUser.memberId.toString(), testMember._id.toString());

    const stored = await User.findById(testUser._id).select('+resetPasswordToken');
    assert.ok(stored.resetPasswordToken, 'only the hashed setup token is stored');

    const mail = testOutbox.find((entry) => entry.to === testMember.email);
    assert.ok(mail, 'invite email captured by the test outbox');
    assert.match(mail.text, /\/reset-password\?token=[a-f0-9]{64}/);
  });

  test('setup-password consumes the token and moves the account to pending_kyc', async () => {
    const mail = testOutbox.find((entry) => entry.to === testMember.email);
    const token = mail.text.match(/token=([a-f0-9]{64})/)[1];

    const res = await request(app)
      .post('/api/auth/setup-password')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ token, password: 'Member@12345' });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.status, 'pending_kyc');

    const user = await User.findById(testUser._id)
      .select('+resetPasswordToken +passwordHash');
    assert.equal(user.resetPasswordToken, undefined);
    assert.equal(user.mustChangePassword, false);
    assert.equal(await user.comparePassword('Member@12345'), true);
  });

  test('login works with the newly set password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ identifier: testMember.email, password: 'Member@12345' });

    assert.equal(res.status, 200);
    assert.ok(res.body.data.token);
  });

  test('an unknown setup token is rejected', async () => {
    const res = await request(app)
      .post('/api/auth/setup-password')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ token: 'f'.repeat(64), password: 'Member@12345' });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'INVALID_SETUP_TOKEN');
  });

  test('upload endpoint requires authentication', async () => {
    const res = await request(app)
      .post('/api/upload')
      .set('X-Requested-With', 'XMLHttpRequest')
      .attach('file', Buffer.from('not-a-real-image'), 'photo.png');

    assert.equal(res.status, 401);
  });
});

describe('Member registration', () => {
  test('creates the member, savings account and portal account', async () => {
    const res = await asAdmin(request(app).post('/api/members')).send(validMemberPayload());

    assert.equal(res.status, 201);
    const { member, account, user, emailSent } = res.body.data;

    assert.match(member.code, /^SOM-\d{4}-\d{4}$/);
    assert.match(account.accountNo, /^SAV-\d{4}-\d{4}$/);
    assert.equal(user.email, 'member@test.local');
    assert.equal(user.role, 'member');
    assert.equal(user.status, 'invited');
    assert.equal(emailSent, true);

    assert.equal(await SavingsAccount.countDocuments({ member: member._id }), 1);
    assert.ok(testOutbox.some((entry) => entry.to === 'member@test.local'));
  });

  test('persists the camelCase fields the form actually sends', async () => {
    const res = await asAdmin(request(app).post('/api/members')).send(validMemberPayload({
      fullName: 'Field Mapping Member',
      nid: '5556667778',
      phone: '01798765432',
      email: '',
      fatherHusbandName: 'Abdul Karim',
      dob: '1990-05-17',
      presentAddress: 'Chattogram',
      permanentAddress: 'Sylhet',
    }));

    assert.equal(res.status, 201);

    const stored = await Member.findById(res.body.data.member._id);
    assert.equal(stored.fatherHusbandName, 'Abdul Karim');
    assert.equal(stored.dateOfBirth.toISOString().slice(0, 10), '1990-05-17');
    assert.equal(stored.presentAddress.fullAddress, 'Chattogram');
    assert.equal(stored.permanentAddress.fullAddress, 'Sylhet');

    // No email still means a login account exists; it signs in by phone.
    assert.ok(res.body.data.user, 'email-less members still receive an account');
    assert.equal(res.body.data.user.email, undefined);
    assert.equal(res.body.data.user.role, 'member');
    assert.equal(res.body.data.emailSent, false);

    const user = await User.findOne({ memberId: res.body.data.member._id });
    assert.ok(user, 'linked user was persisted');
    assert.equal(user.phone, '01798765432');
  });

  test('rejects an elevated role during registration', async () => {
    const res = await asAdmin(request(app).post('/api/members')).send(validMemberPayload({
      fullName: 'Role Member',
      nid: '6667778889',
      phone: '01744445555',
      email: 'rolemember@test.local',
      role: 'president',
    }));

    assert.equal(res.status, 422);
    assert.ok(res.body.error.details.some((detail) => detail.field === 'role'));
  });

  test('rejects a member without nominees', async () => {
    const { nominees, ...payload } = validMemberPayload({ nid: '1111222233', phone: '01755555555' });
    const res = await asAdmin(request(app).post('/api/members')).send(payload);

    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    assert.ok(res.body.error.details.some((d) => d.message === 'validation.nomineesRequired'));
  });

  test('rejects nominee shares that do not total 100%', async () => {
    const res = await asAdmin(request(app).post('/api/members')).send(validMemberPayload({
      nid: '4444555566',
      phone: '01766666666',
      nominees: [{ name: 'Only Nominee', relation: 'child', nid: '1212121212', percentage: 60 }],
    }));

    assert.equal(res.status, 422);
    assert.ok(res.body.error.details.some((d) => d.message === 'validation.nomineesPercentageSum'));
  });

  test('rejects a member without an NID', async () => {
    const { nid, ...payload } = validMemberPayload({ phone: '01777777777' });
    const res = await asAdmin(request(app).post('/api/members')).send(payload);

    assert.equal(res.status, 422);
    assert.ok(res.body.error.details.some((d) => d.field === 'nid'));
  });

  test('reports a duplicate phone number as a conflict, not a crash', async () => {
    const res = await asAdmin(request(app).post('/api/members')).send(validMemberPayload({
      nid: '7878787878',
      phone: '01712345678',
      email: '',
    }));

    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'DUPLICATE_KEY');
  });

  test('GET /api/members exposes hasPhoto for members with an uploaded photo', async () => {
    await Member.create({
      code: 'SOM-2026-9001',
      fullName: 'Photo Member',
      nid: '9998887776',
      phone: '01700000999',
      photo: 'https://res.cloudinary.com/demo/image/upload/v1/shopnonir/members/a.jpg',
    });

    const res = await asAdmin(request(app).get('/api/members?search=Photo%20Member'));

    assert.equal(res.status, 200);
    const row = res.body.data.items.find((item) => item.fullName === 'Photo Member');
    assert.ok(row);
    assert.equal(row.hasPhoto, true);
  });
});

describe('Member access management', () => {
  let accessMember;
  let accessUser;
  let noEmailMember;

  before(async () => {
    const accessRes = await asAdmin(request(app).post('/api/members')).send(validMemberPayload({
      fullName: 'Access Member',
      nid: '1231231231',
      phone: '01711112222',
      email: 'access@test.local',
    }));
    assert.equal(accessRes.status, 201);
    accessMember = accessRes.body.data.member;
    accessUser = accessRes.body.data.user;

    const noEmailRes = await asAdmin(request(app).post('/api/members')).send(validMemberPayload({
      fullName: 'No Email Member',
      nid: '3213213211',
      phone: '01733334444',
      email: '',
    }));
    assert.equal(noEmailRes.status, 201);
    noEmailMember = noEmailRes.body.data.member;
  });

  test('GET /api/members includes the linked role and portal status', async () => {
    const res = await asAdmin(request(app).get('/api/members?search=Access%20Member'));

    assert.equal(res.status, 200);
    const row = res.body.data.items.find((item) => item._id === accessMember._id);
    assert.ok(row);
    assert.equal(row.user.role, 'member');
    assert.equal(row.user.isActive, true);
    assert.equal(row.user.status, 'invited');
  });

  test('GET /api/members/:id includes the linked user', async () => {
    const res = await asAdmin(request(app).get(`/api/members/${accessMember._id}`));

    assert.equal(res.status, 200);
    assert.equal(res.body.data.user._id, accessUser._id);
    assert.equal(res.body.data.user.role, 'member');
  });

  test('PATCH /api/members/:id/role updates the linked User record', async () => {
    const res = await asAdmin(request(app).patch(`/api/members/${accessMember._id}/role`))
      .send({ role: 'general_secretary' });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.role, 'general_secretary');

    const user = await User.findById(accessUser._id);
    assert.equal(user.role, 'general_secretary');

    const reset = await asAdmin(request(app).patch(`/api/members/${accessMember._id}/role`))
      .send({ role: 'member' });
    assert.equal(reset.status, 200);
  });

  test('rejects assigning super_admin through member management', async () => {
    const res = await asAdmin(request(app).patch(`/api/members/${accessMember._id}/role`))
      .send({ role: 'super_admin' });

    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  test('only a Super Admin can change a member role', async () => {
    const res = await asTreasurer(request(app).patch(`/api/members/${accessMember._id}/role`))
      .send({ role: 'treasurer' });

    assert.equal(res.status, 403);
  });

  test('blocks self role changes', async () => {
    const res = await asAdmin(request(app).patch(`/api/members/${adminMember._id}/role`))
      .send({ role: 'member' });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'SELF_DEMOTION_FORBIDDEN');
  });

  test('PATCH /api/members/:id/account-status toggles portal access', async () => {
    const disable = await asAdmin(
      request(app).patch(`/api/members/${accessMember._id}/account-status`),
    ).send({ isActive: false });

    assert.equal(disable.status, 200);
    assert.equal(disable.body.data.user.isActive, false);

    let user = await User.findById(accessUser._id);
    assert.equal(user.isActive, false);

    const enable = await asAdmin(
      request(app).patch(`/api/members/${accessMember._id}/account-status`),
    ).send({ isActive: true });

    assert.equal(enable.status, 200);
    user = await User.findById(accessUser._id);
    assert.equal(user.isActive, true);
  });

  test('blocks self-disabling portal access', async () => {
    const res = await asAdmin(request(app).patch(`/api/members/${adminMember._id}/account-status`))
      .send({ isActive: false });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'SELF_SUSPENSION_FORBIDDEN');
  });

  test('only a Super Admin can change portal access', async () => {
    const res = await asTreasurer(
      request(app).patch(`/api/members/${accessMember._id}/account-status`),
    ).send({ isActive: false });

    assert.equal(res.status, 403);
  });

  test('issues a one-time temporary password', async () => {
    const res = await asAdmin(request(app).post(`/api/members/${accessMember._id}/reset-password`))
      .send({});

    assert.equal(res.status, 200);
    assert.ok(res.body.data.temporaryPassword);

    const user = await User.findById(accessUser._id).select('+passwordHash +tokenVersion');
    assert.equal(user.mustChangePassword, true);
    assert.equal(await user.comparePassword(res.body.data.temporaryPassword), true);
  });

  test('sends a password reset email when the member has an email', async () => {
    const res = await asAdmin(
      request(app).post(`/api/members/${accessMember._id}/reset-password-email`),
    ).send({});

    assert.equal(res.status, 200);
    assert.equal(res.body.data.emailSent, true);
    assert.ok(testOutbox.some((entry) => entry.to === 'access@test.local'));
  });

  test('refuses a reset email when the member has no email', async () => {
    const res = await asAdmin(
      request(app).post(`/api/members/${noEmailMember._id}/reset-password-email`),
    ).send({});

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'NO_EMAIL_ON_FILE');
  });

  test('PATCH /api/members/:id rejects role changes', async () => {
    const res = await asAdmin(request(app).patch(`/api/members/${accessMember._id}`))
      .send({ role: 'president' });

    assert.equal(res.status, 422);
    assert.ok(res.body.error.details.some((detail) => detail.field === 'role'));
  });

  test('removed /api/auth/users management endpoints return 404', async () => {
    const id = adminUser._id.toString();
    const routes = [
      request(app).get('/api/auth/users'),
      request(app).post('/api/auth/users'),
      request(app).patch(`/api/auth/users/${id}/role`),
      request(app).patch(`/api/auth/users/${id}/status`),
      request(app).post(`/api/auth/users/${id}/reset-password`),
      request(app).post(`/api/auth/users/${id}/resend-reset-email`),
      request(app).delete(`/api/auth/users/${id}`),
      request(app).get('/api/auth/users/metrics'),
    ];

    for (const route of routes) {
      const res = await asAdmin(route);
      assert.equal(res.status, 404);
    }
  });

  test('the KYC review queue still works under its existing path', async () => {
    const res = await asAdmin(request(app).get('/api/auth/users/kyc-pending'));

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data.items));
  });
});
