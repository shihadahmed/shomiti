import './helpers/test-env.js';
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Member from '../src/models/Member.js';
import Role from '../src/models/Role.js';
import AuditLog from '../src/models/AuditLog.js';
import { signAccessToken } from '../src/utils/jwt.js';
import { hashPassword } from '../src/utils/password.js';

let mongoServer;
let adminUser;
let adminToken;
let memberUser;
let memberRecord;
let memberToken;
let alternateUser;
let alternateRecord;
let originalNomineeId;

const asAdmin = (req) => req
  .set('Authorization', `Bearer ${adminToken}`)
  .set('X-Requested-With', 'XMLHttpRequest');

const asMember = (req) => req
  .set('Authorization', `Bearer ${memberToken}`)
  .set('X-Requested-With', 'XMLHttpRequest');

const updatePayload = (overrides = {}) => ({
  fullName: 'Requested Update Name',
  fullNameBn: 'অনুরোধকৃত নাম',
  fatherHusbandName: 'Requested Father',
  motherName: 'Requested Mother',
  dateOfBirth: '1991-06-15',
  nid: '2222222222',
  occupation: 'Consultant',
  phone: '01811111111',
  email: 'requested.member@test.local',
  presentAddress: 'Requested Present Address',
  permanentAddress: 'Requested Permanent Address',
  sameAsPresent: false,
  photo: 'https://res.cloudinary.com/demo/image/upload/v1/requested-photo.jpg',
  nidDocument: 'https://res.cloudinary.com/demo/image/upload/v1/requested-nid.pdf',
  nominees: [
    {
      _id: originalNomineeId,
      name: 'Requested Nominee',
      relation: 'child',
      nid: '7777777777',
      phone: '01833333333',
      percentage: 100,
      photo: 'https://res.cloudinary.com/demo/image/upload/v1/requested-nominee.jpg',
      nidDocument: 'https://res.cloudinary.com/demo/image/upload/v1/requested-nominee-nid.pdf',
    },
  ],
  notes: 'Staged update notes',
  ...overrides,
});

const approvedPayload = (overrides = {}) => ({
  fullName: 'Approved Update Name',
  fullNameBn: 'অনুমোদিত নাম',
  fatherHusbandName: 'Approved Father',
  motherName: 'Approved Mother',
  dateOfBirth: '1992-08-20',
  nid: '2222222222',
  occupation: 'Architect',
  phone: '01822222222',
  email: 'approved.member@test.local',
  presentAddress: 'Approved Present Address',
  permanentAddress: 'Approved Permanent Address',
  sameAsPresent: false,
  photo: 'https://res.cloudinary.com/demo/image/upload/v1/approved-photo.jpg',
  nidDocument: 'https://res.cloudinary.com/demo/image/upload/v1/approved-nid.pdf',
  nominees: [
    {
      _id: originalNomineeId,
      name: 'Approved Nominee',
      relation: 'spouse',
      nid: '7777777777',
      phone: '01844444444',
      percentage: 60,
      photo: 'https://res.cloudinary.com/demo/image/upload/v1/approved-nominee.jpg',
      nidDocument: 'https://res.cloudinary.com/demo/image/upload/v1/approved-nominee-nid.pdf',
    },
    {
      name: 'New Nominee',
      relation: 'child',
      nid: '8888888888',
      phone: '01855555555',
      percentage: 40,
      photo: 'https://res.cloudinary.com/demo/image/upload/v1/new-nominee.jpg',
      nidDocument: 'https://res.cloudinary.com/demo/image/upload/v1/new-nominee-nid.pdf',
    },
  ],
  notes: 'Final approved update',
  ...overrides,
});

function assertLiveMemberUnchanged(member, expected = {}) {
  assert.equal(member.fullName, expected.fullName ?? 'Original Active Member');
  assert.equal(member.fullNameBn, expected.fullNameBn ?? 'মূল নাম');
  assert.equal(member.fatherHusbandName, expected.fatherHusbandName ?? 'Original Father');
  assert.equal(member.motherName, expected.motherName ?? 'Original Mother');
  assert.equal(member.spouseName, expected.spouseName ?? 'Original Spouse');
  assert.equal(member.nid, expected.nid ?? '1111111111');
  assert.equal(member.phone, expected.phone ?? '01766666666');
  assert.equal(member.email, expected.email ?? 'active.member@test.local');
  assert.equal(member.occupation, expected.occupation ?? 'Farmer');
  assert.equal(member.presentAddress.fullAddress, expected.presentAddress ?? 'Original Present Address');
  assert.equal(member.permanentAddress.fullAddress, expected.permanentAddress ?? 'Original Permanent Address');
  assert.equal(member.shareCount, expected.shareCount ?? 7);
  assert.equal(member.notes, expected.notes ?? 'Register notes');
  assert.equal(member.nominees.length, expected.nomineeCount ?? 1);
  assert.equal(member.nominees[0].name, expected.nomineeName ?? 'Original Nominee');
  assert.equal(member.nominees[0].nid, expected.nomineeNid ?? '5555555555');
  assert.equal(member.nominees[0].percentage, expected.nomineePercentage ?? 100);
  assert.equal(
    member.nominees[0].fatherHusbandName,
    'Nominee Father',
    'registration-only nominee fields must survive staging and decisions',
  );
  assert.equal(member.nominees[0].address.fullAddress, 'Nominee Legacy Address');
}

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
      permissions: ['users.manage_kyc'],
    },
    { name: 'member', description: 'Member portal', isSystemLocked: true, permissions: [] },
  ]);

  adminUser = await User.create({
    name: 'Update Reviewer',
    email: 'update.admin@test.local',
    phone: '01700000001',
    nid: '3333333333',
    role: 'super_admin',
    passwordHash: await hashPassword('Admin@12345'),
    isActive: true,
    status: 'active',
  });
  adminToken = signAccessToken(adminUser);

  memberRecord = await Member.create({
    code: 'SOM-UPD-0001',
    fullName: 'Original Active Member',
    fullNameBn: 'মূল নাম',
    fatherHusbandName: 'Original Father',
    motherName: 'Original Mother',
    spouseName: 'Original Spouse',
    nid: '1111111111',
    dateOfBirth: new Date('1985-04-10'),
    phone: '01766666666',
    email: 'active.member@test.local',
    occupation: 'Farmer',
    presentAddress: { fullAddress: 'Original Present Address' },
    permanentAddress: { fullAddress: 'Original Permanent Address' },
    photo: 'https://res.cloudinary.com/demo/image/upload/v1/original-photo.jpg',
    nidDocument: 'https://res.cloudinary.com/demo/image/upload/v1/original-nid.pdf',
    shareCount: 7,
    notes: 'Register notes',
    nominees: [
      {
        name: 'Original Nominee',
        relation: 'spouse',
        fatherHusbandName: 'Nominee Father',
        nid: '5555555555',
        dateOfBirth: new Date('1990-01-01'),
        phone: '01777777777',
        address: { fullAddress: 'Nominee Legacy Address' },
        percentage: 100,
        photo: 'https://res.cloudinary.com/demo/image/upload/v1/original-nominee.jpg',
        nidDocument: 'https://res.cloudinary.com/demo/image/upload/v1/original-nominee-nid.pdf',
      },
    ],
  });
  originalNomineeId = memberRecord.nominees[0]._id.toString();

  memberUser = await User.create({
    name: 'Original Active Member',
    email: 'active.member@test.local',
    phone: '01766666666',
    nid: '1111111111',
    role: 'member',
    memberId: memberRecord._id,
    passwordHash: await hashPassword('Member@12345'),
    isActive: true,
    status: 'active',
    profileData: {
      fullName: 'Original Active Member',
      fullNameBn: 'মূল নাম',
      fatherHusbandName: 'Original Father',
      motherName: 'Original Mother',
      dateOfBirth: new Date('1985-04-10'),
      nid: '1111111111',
      occupation: 'Farmer',
      phone: '01766666666',
      email: 'active.member@test.local',
      presentAddress: 'Original Present Address',
      permanentAddress: 'Original Permanent Address',
      photo: 'https://res.cloudinary.com/demo/image/upload/v1/original-photo.jpg',
      nidDocument: 'https://res.cloudinary.com/demo/image/upload/v1/original-nid.pdf',
      nominees: [
        {
          _id: originalNomineeId,
          name: 'Original Nominee',
          relation: 'spouse',
          nid: '5555555555',
          phone: '01777777777',
          percentage: 100,
          photo: 'https://res.cloudinary.com/demo/image/upload/v1/original-nominee.jpg',
          nidDocument: 'https://res.cloudinary.com/demo/image/upload/v1/original-nominee-nid.pdf',
        },
      ],
      notes: '',
      shareCount: 7,
      spouseName: 'Original Spouse',
    },
    kycSubmittedAt: new Date('2024-01-01'),
  });
  memberRecord.userId = memberUser._id;
  await memberRecord.save();
  memberToken = signAccessToken(memberUser);

  alternateRecord = await Member.create({
    code: 'SOM-UPD-0002',
    fullName: 'Alternate Member',
    nid: '4444444444',
    phone: '01755555555',
    email: 'alternate.member@test.local',
    presentAddress: { fullAddress: 'Alternate Address' },
    shareCount: 1,
  });

  alternateUser = await User.create({
    name: 'Alternate Member',
    email: 'alternate.member@test.local',
    phone: '01755555555',
    nid: '4444444444',
    role: 'member',
    memberId: alternateRecord._id,
    passwordHash: await hashPassword('Member@12345'),
    isActive: true,
    status: 'active',
  });
  alternateRecord.userId = alternateUser._id;
  await alternateRecord.save();
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Active member profile update staging', () => {
  test('GET /auth/users/me/kyc returns live data with no pending request', async () => {
    const res = await asMember(request(app).get('/api/auth/users/me/kyc'));

    assert.equal(res.status, 200);
    const profile = res.body.data.profile;
    assert.equal(profile.status, 'active');
    assert.equal(profile.hasPendingKycUpdate, false);
    assert.equal(profile.pendingProfileData, null);
    assert.equal(profile.profileData.fullName, 'Original Active Member');
    assert.equal(profile.profileData.phone, '01766666666');
  });

  test('POST stages the requested snapshot without touching the live Member or identity', async () => {
    const res = await asMember(
      request(app).post('/api/auth/users/me/kyc').send(updatePayload()),
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.message, 'Profile update request submitted for review');
    assert.equal(res.body.data.requestType, 'update');
    assert.equal(res.body.data.profile.status, 'active');
    assert.equal(res.body.data.profile.hasPendingKycUpdate, true);

    const pending = res.body.data.profile.pendingProfileData;
    assert.equal(pending.fullName, 'Requested Update Name');
    assert.equal(pending.phone, '01811111111');
    assert.equal(pending.email, 'requested.member@test.local');
    assert.equal(pending.presentAddress, 'Requested Present Address');
    assert.equal(pending.permanentAddress, 'Requested Permanent Address');
    assert.equal(pending.nominees.length, 1);
    assert.equal(pending.nominees[0]._id, originalNomineeId, 'nominee ids are retained for merging');
    assert.equal(pending.nominees[0].name, 'Requested Nominee');

    const member = await Member.findById(memberRecord._id);
    assertLiveMemberUnchanged(member);

    const user = await User.findById(memberUser._id);
    assert.equal(user.status, 'active');
    assert.equal(user.name, 'Original Active Member');
    assert.equal(user.phone, '01766666666');
    assert.equal(user.nid, '1111111111');
    assert.equal(user.email, 'active.member@test.local');
    assert.equal(user.hasPendingKycUpdate, true);
    assert.ok(user.kycUpdateSubmittedAt instanceof Date);
    assert.equal(user.profileData.fullName, 'Original Active Member');

    const audit = await AuditLog.findOne({
      action: 'member.profile_update_requested',
      entityId: memberRecord._id,
    });
    assert.ok(audit, 'the staged request is audited');
    assert.equal(audit.actor.toString(), memberUser._id.toString());
    assert.equal(audit.before.fullName, 'Original Active Member');
    assert.equal(audit.after.fullName, 'Requested Update Name');
  });

  test('a second active submission is blocked while a request is pending', async () => {
    const before = await User.findById(memberUser._id);

    const res = await asMember(
      request(app)
        .post('/api/auth/users/me/kyc')
        .send(updatePayload({ fullName: 'Replacement Request', phone: '01899999999' })),
    );

    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'KYC_UPDATE_PENDING');

    const afterUser = await User.findById(memberUser._id);
    assert.equal(afterUser.hasPendingKycUpdate, true);
    assert.equal(afterUser.pendingProfileData.fullName, 'Requested Update Name');
    assert.equal(afterUser.pendingProfileData.phone, '01811111111');
    assert.equal(
      afterUser.kycUpdateSubmittedAt.getTime(),
      before.kycUpdateSubmittedAt.getTime(),
      'the original submission timestamp is kept',
    );
  });

  test('the review queue exposes live and requested data for pending updates', async () => {
    const filtered = await asAdmin(
      request(app).get('/api/auth/users/kyc-pending').query({ status: 'active' }),
    );

    assert.equal(filtered.status, 200);
    const filteredItem = filtered.body.data.items.find(
      (entry) => entry._id === memberUser._id.toString(),
    );
    assert.ok(filteredItem, 'active pending update is listed by the Pending Updates filter');
    assert.equal(filteredItem.requestType, 'update');
    assert.equal(filteredItem.status, 'active');
    assert.equal(filteredItem.liveData.fullName, 'Original Active Member');
    assert.equal(filteredItem.liveData.phone, '01766666666');
    assert.equal(filteredItem.requestedData.fullName, 'Requested Update Name');
    assert.equal(filteredItem.requestedData.phone, '01811111111');
    assert.equal(filteredItem.profileData.fullName, 'Requested Update Name');
    assert.equal(filteredItem.liveData.nominees[0].name, 'Original Nominee');
    assert.equal(filteredItem.requestedData.nominees[0].name, 'Requested Nominee');

    const all = await asAdmin(request(app).get('/api/auth/users/kyc-pending'));
    assert.ok(
      all.body.data.items.some((entry) => entry._id === memberUser._id.toString()),
      'pending updates also appear in the unfiltered queue',
    );
  });

  test('rejecting an update clears staging, keeps the Member untouched and records a reason', async () => {
    const beforeDecision = await User.findById(memberUser._id);
    const submittedAt = beforeDecision.kycUpdateSubmittedAt;

    const res = await asAdmin(
      request(app)
        .post(`/api/auth/users/${memberUser._id}/kyc-decision`)
        .send({ decision: 'rejected', reason: 'Please keep your registered phone number.' }),
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.data.requestType, 'update');
    assert.equal(res.body.data.user.status, 'active');
    assert.equal(res.body.data.user.hasPendingKycUpdate, false);
    assert.equal(res.body.data.user.pendingProfileData, null);
    assert.equal(res.body.data.user.rejectionReason, 'Please keep your registered phone number.');
    assert.equal(
      new Date(res.body.data.user.kycUpdateSubmittedAt).getTime(),
      submittedAt.getTime(),
      'the last request timestamp is retained after a decision',
    );

    const member = await Member.findById(memberRecord._id);
    assertLiveMemberUnchanged(member);

    const user = await User.findById(memberUser._id);
    assert.equal(user.status, 'active');
    assert.equal(user.hasPendingKycUpdate, false);
    assert.equal(user.pendingProfileData, null);
    assert.equal(user.rejectionReason, 'Please keep your registered phone number.');

    const audit = await AuditLog.findOne({
      action: 'member.profile_update_rejected',
      entityId: memberRecord._id,
    });
    assert.ok(audit, 'the rejection is audited');
    assert.equal(audit.before.fullName, 'Original Active Member');

    const getRes = await asMember(request(app).get('/api/auth/users/me/kyc'));
    assert.equal(getRes.body.data.profile.status, 'active');
    assert.equal(getRes.body.data.profile.hasPendingKycUpdate, false);
    assert.equal(getRes.body.data.profile.profileData.fullName, 'Original Active Member');
  });

  test('an active member can submit a fresh request after a rejection', async () => {
    const res = await asMember(
      request(app)
        .post('/api/auth/users/me/kyc')
        .send(updatePayload({ phone: '01755555555', fullName: 'Conflicting Request' })),
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.data.profile.status, 'active');
    assert.equal(res.body.data.profile.hasPendingKycUpdate, true);
    assert.equal(res.body.data.profile.pendingProfileData.fullName, 'Conflicting Request');
    assert.equal(res.body.data.profile.rejectionReason, null);

    const member = await Member.findById(memberRecord._id);
    assertLiveMemberUnchanged(member);
  });

  test('approval reports a friendly conflict and rolls the whole update back', async () => {
    const res = await asAdmin(
      request(app)
        .post(`/api/auth/users/${memberUser._id}/kyc-decision`)
        .send({ decision: 'approved', reason: '' }),
    );

    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'KYC_UPDATE_CONFLICT');
    assert.match(res.body.error.message, /phone number/i);

    const member = await Member.findById(memberRecord._id);
    assertLiveMemberUnchanged(member);

    const user = await User.findById(memberUser._id);
    assert.equal(user.status, 'active');
    assert.equal(user.hasPendingKycUpdate, true, 'failed approval keeps the staged request');
    assert.equal(user.pendingProfileData.fullName, 'Conflicting Request');
    assert.equal(user.name, 'Original Active Member');
    assert.equal(user.phone, '01766666666');

    const rejected = await asAdmin(
      request(app)
        .post(`/api/auth/users/${memberUser._id}/kyc-decision`)
        .send({ decision: 'rejected', reason: 'Phone belongs to another member.' }),
    );
    assert.equal(rejected.status, 200);
    assert.equal(rejected.body.data.user.hasPendingKycUpdate, false);
  });

  test('approval atomically applies staged data, syncs identity and preserves nominee details', async () => {
    const submitRes = await asMember(
      request(app).post('/api/auth/users/me/kyc').send(approvedPayload()),
    );
    assert.equal(submitRes.status, 200);
    const submittedAt = new Date(submitRes.body.data.profile.kycUpdateSubmittedAt);

    const memberBefore = await Member.findById(memberRecord._id);
    assertLiveMemberUnchanged(memberBefore);

    const res = await asAdmin(
      request(app)
        .post(`/api/auth/users/${memberUser._id}/kyc-decision`)
        .send({ decision: 'approved', reason: '' }),
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.data.requestType, 'update');
    assert.equal(res.body.data.user.status, 'active');
    assert.equal(res.body.data.user.hasPendingKycUpdate, false);
    assert.equal(res.body.data.user.pendingProfileData, null);
    assert.equal(res.body.data.user.rejectionReason, null);
    assert.equal(
      new Date(res.body.data.user.kycUpdateSubmittedAt).getTime(),
      submittedAt.getTime(),
      'the last request timestamp is retained after approval',
    );

    const member = await Member.findById(memberRecord._id);
    assert.equal(member.fullName, 'Approved Update Name');
    assert.equal(member.fullNameBn, 'অনুমোদিত নাম');
    assert.equal(member.fatherHusbandName, 'Approved Father');
    assert.equal(member.motherName, 'Approved Mother');
    assert.equal(member.spouseName, 'Original Spouse', 'spouse name is not part of the KYC form');
    assert.equal(member.nid, '2222222222');
    assert.equal(member.phone, '01822222222');
    assert.equal(member.email, 'approved.member@test.local');
    assert.equal(member.occupation, 'Architect');
    assert.equal(member.presentAddress.fullAddress, 'Approved Present Address');
    assert.equal(member.permanentAddress.fullAddress, 'Approved Permanent Address');
    assert.equal(member.photo, approvedPayload().photo);
    assert.equal(member.nidDocument, approvedPayload().nidDocument);
    assert.equal(member.shareCount, 7, 'share count is not part of the KYC form');
    assert.equal(member.notes, 'Register notes', 'register notes are separate from KYC notes');
    assert.equal(member.nominees.length, 2);
    assert.equal(member.nominees[0].name, 'Approved Nominee');
    assert.equal(member.nominees[0].percentage, 60);
    assert.equal(
      member.nominees[0].fatherHusbandName,
      'Nominee Father',
      'existing nominee registration details are preserved on approval',
    );
    assert.equal(
      member.nominees[0].dateOfBirth.toISOString().slice(0, 10),
      '1990-01-01',
    );
    assert.equal(member.nominees[0].address.fullAddress, 'Nominee Legacy Address');
    assert.equal(member.nominees[1].name, 'New Nominee');
    assert.equal(member.nominees[1].nid, '8888888888');
    assert.equal(member.nominees[1].percentage, 40);

    const user = await User.findById(memberUser._id);
    assert.equal(user.name, 'Approved Update Name');
    assert.equal(user.phone, '01822222222');
    assert.equal(user.nid, '2222222222');
    assert.equal(user.email, 'approved.member@test.local');
    assert.equal(user.profileData.fullName, 'Approved Update Name');
    assert.equal(user.profileData.nominees.length, 2);
    assert.equal(user.pendingProfileData, null);

    const audit = await AuditLog.findOne({
      action: 'member.profile_update_approved',
      entityId: memberRecord._id,
    });
    assert.ok(audit, 'the approval is audited');
    assert.equal(audit.before.fullName, 'Original Active Member');
    assert.equal(audit.after.fullName, 'Approved Update Name');

    const getRes = await asMember(request(app).get('/api/auth/users/me/kyc'));
    assert.equal(getRes.body.data.profile.profileData.fullName, 'Approved Update Name');
    assert.equal(getRes.body.data.profile.profileData.phone, '01822222222');
    assert.equal(getRes.body.data.profile.hasPendingKycUpdate, false);
  });

  test('approval keeps the existing email when the requested email is blank', async () => {
    const submitRes = await asMember(
      request(app)
        .post('/api/auth/users/me/kyc')
        .send(
          approvedPayload({
            fullName: 'Email Empty Name',
            email: '',
            phone: '01866666666',
            nid: '2222222222',
          }),
        ),
    );
    assert.equal(submitRes.status, 200);
    assert.equal(submitRes.body.data.profile.pendingProfileData.email, '');

    const res = await asAdmin(
      request(app)
        .post(`/api/auth/users/${memberUser._id}/kyc-decision`)
        .send({ decision: 'approved', reason: '' }),
    );

    assert.equal(res.status, 200);
    const member = await Member.findById(memberRecord._id);
    assert.equal(member.fullName, 'Email Empty Name');
    assert.equal(member.phone, '01866666666');
    assert.equal(
      member.email,
      'approved.member@test.local',
      'a blank requested email must not clear the live email',
    );

    const user = await User.findById(memberUser._id);
    assert.equal(user.name, 'Email Empty Name');
    assert.equal(user.email, 'approved.member@test.local');
  });
});
