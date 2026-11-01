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

const asAdmin = (req) => req
  .set('Authorization', `Bearer ${adminToken}`)
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
      permissions: ['roles.create', 'roles.view', 'roles.assign'],
    },
    { name: 'treasurer', description: 'Treasurer', isSystemLocked: true, permissions: ['roles.view'] },
    { name: 'member', description: 'Member portal', isSystemLocked: true, permissions: [] },
  ]);

  const admin = await User.create({
    name: 'Test Admin',
    email: 'admin@test.local',
    phone: '01700000000',
    role: 'super_admin',
    passwordHash: await hashPassword('Admin@12345'),
    isActive: true,
  });

  adminToken = signAccessToken(admin);
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('User invite and password setup workflow', () => {
  test('POST /api/auth/users creates an invited account and emails a setup link', async () => {
    const res = await asAdmin(request(app).post('/api/auth/users')).send({
      name: 'Invited Staff',
      email: 'invited@test.local',
      phone: '01711111111',
      nid: '1234567890',
      role: 'treasurer',
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.emailSent, true);

    const user = await User.findOne({ email: 'invited@test.local' }).select('+resetPasswordToken');
    assert.equal(user.status, 'invited');
    assert.equal(user.mustChangePassword, true);
    assert.ok(user.resetPasswordToken, 'only the hashed setup token is stored');

    const mail = testOutbox.find((entry) => entry.to === 'invited@test.local');
    assert.ok(mail, 'invite email captured by the test outbox');
    assert.match(mail.text, /\/reset-password\?token=[a-f0-9]{64}/);
  });

  test('setup-password consumes the token and moves the account to pending_kyc', async () => {
    const mail = testOutbox.find((entry) => entry.to === 'invited@test.local');
    const token = mail.text.match(/token=([a-f0-9]{64})/)[1];

    const res = await request(app)
      .post('/api/auth/setup-password')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ token, password: 'Member@12345' });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.status, 'pending_kyc');

    const user = await User.findOne({ email: 'invited@test.local' })
      .select('+resetPasswordToken +passwordHash');
    assert.equal(user.resetPasswordToken, undefined);
    assert.equal(user.mustChangePassword, false);
    assert.equal(await user.comparePassword('Member@12345'), true);
  });

  test('login works with the newly set password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ identifier: 'invited@test.local', password: 'Member@12345' });

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
    // No email => no portal account
    assert.equal(res.body.data.user, null);
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
