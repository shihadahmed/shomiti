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
import { signAccessToken } from '../src/utils/jwt.js';
import { hashPassword } from '../src/utils/password.js';

let mongoServer;
let adminUser;
let adminToken;
let memberUser;
let memberRecord;
let memberToken;

const asAdmin = (req) => req
  .set('Authorization', `Bearer ${adminToken}`)
  .set('X-Requested-With', 'XMLHttpRequest');

const asMember = (req) => req
  .set('Authorization', `Bearer ${memberToken}`)
  .set('X-Requested-With', 'XMLHttpRequest');

const kycPayload = (overrides = {}) => ({
  fullName: 'KYC Updated Name',
  fullNameBn: 'কেওয়াইসি নাম',
  fatherHusbandName: 'Father Name',
  motherName: 'Mother Name',
  dateOfBirth: '1990-01-15',
  nid: '1234567890',
  occupation: 'Engineer',
  phone: '01711111111',
  email: 'kyc.member@test.local',
  presentAddress: 'House 7, Road 2, Dhanmondi, Dhaka',
  permanentAddress: 'Village X, Upazila Y, District Z',
  photo: 'https://res.cloudinary.com/demo/image/upload/v1/member-photo.jpg',
  nidDocument: 'https://res.cloudinary.com/demo/image/upload/v1/nid-document.pdf',
  nominees: [
    {
      _id: memberRecord.nominees[0]._id.toString(),
      name: 'Updated Nominee',
      relation: 'spouse',
      nid: '9988776655',
      phone: '01722222222',
      percentage: 100,
      photo: 'https://res.cloudinary.com/demo/image/upload/v1/nominee-photo.jpg',
      nidDocument: 'https://res.cloudinary.com/demo/image/upload/v1/nominee-nid.pdf',
    },
  ],
  notes: 'Please review my documents.',
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
    { name: 'member', description: 'Member portal', isSystemLocked: true, permissions: [] },
  ]);

  adminUser = await User.create({
    name: 'KYC Admin',
    email: 'kyc.admin@test.local',
    phone: '01700000000',
    nid: '3333333333',
    role: 'super_admin',
    passwordHash: await hashPassword('Admin@12345'),
    isActive: true,
    status: 'active',
  });
  adminToken = signAccessToken(adminUser);

  memberRecord = await Member.create({
    code: 'SOM-KYC-0001',
    fullName: 'Legacy Member Name',
    fullNameBn: 'লিগ্যাসি নাম',
    fatherHusbandName: 'Legacy Father',
    motherName: 'Legacy Mother',
    spouseName: 'Legacy Spouse',
    nid: '1111111111',
    dateOfBirth: new Date('1988-05-20'),
    phone: '01799999999',
    email: 'legacy.member@test.local',
    occupation: 'Teacher',
    presentAddress: {
      village: 'Old Village',
      postOffice: 'Old Post Office',
      upazila: 'Old Upazila',
      district: 'Old District',
    },
    permanentAddress: { fullAddress: 'Legacy Permanent Address' },
    photo: 'https://res.cloudinary.com/demo/image/upload/v1/legacy-photo.jpg',
    nidDocument: 'https://res.cloudinary.com/demo/image/upload/v1/legacy-nid.jpg',
    shareCount: 5,
    notes: 'Member register notes',
    nominees: [
      {
        name: 'Legacy Nominee',
        relation: 'spouse',
        fatherHusbandName: 'Nominee Father',
        nid: '5555555555',
        dateOfBirth: new Date('1992-02-02'),
        phone: '01733333333',
        address: { fullAddress: 'Nominee Legacy Address' },
        percentage: 100,
        photo: 'https://res.cloudinary.com/demo/image/upload/v1/legacy-nominee.jpg',
        nidDocument: 'https://res.cloudinary.com/demo/image/upload/v1/legacy-nominee-nid.jpg',
      },
    ],
  });

  memberUser = await User.create({
    name: 'Legacy Member Name',
    email: 'legacy.member@test.local',
    phone: '01799999999',
    nid: '1111111111',
    role: 'member',
    memberId: memberRecord._id,
    passwordHash: await hashPassword('Member@12345'),
    isActive: true,
    status: 'pending_kyc',
  });
  memberRecord.userId = memberUser._id;
  await memberRecord.save();
  memberToken = signAccessToken(memberUser);
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Member KYC flow', () => {
  test('GET /auth/users/me/kyc fills the form from the linked Member record', async () => {
    const res = await asMember(request(app).get('/api/auth/users/me/kyc'));

    assert.equal(res.status, 200);
    const profile = res.body.data.profile;
    const data = profile.profileData;

    assert.equal(profile.status, 'pending_kyc');
    assert.equal(data.fullName, 'Legacy Member Name');
    assert.equal(data.fullNameBn, 'লিগ্যাসি নাম');
    assert.equal(data.fatherHusbandName, 'Legacy Father');
    assert.equal(data.motherName, 'Legacy Mother');
    assert.equal(data.nid, '1111111111');
    assert.equal(data.occupation, 'Teacher');
    assert.equal(data.phone, '01799999999');
    assert.equal(data.email, 'legacy.member@test.local');
    assert.equal(
      data.presentAddress,
      'Old Village, Old Post Office, Old Upazila, Old District',
      'legacy split addresses are rendered as one line',
    );
    assert.equal(data.permanentAddress, 'Legacy Permanent Address');
    assert.equal(data.photo, memberRecord.photo);
    assert.equal(data.nidDocument, memberRecord.nidDocument);
    assert.equal(data.nominees.length, 1);
    assert.equal(data.nominees[0].name, 'Legacy Nominee');
    assert.equal(data.nominees[0].percentage, 100);
    assert.equal(data.shareCount, 5);
  });

  test('POST rejects missing present address, uneven nominee shares and unsafe URLs', async () => {
    const missingAddress = await asMember(
      request(app).post('/api/auth/users/me/kyc').send(kycPayload({ presentAddress: '' })),
    );
    assert.equal(missingAddress.status, 422);
    assert.ok(
      missingAddress.body.error.details.some((detail) => detail.field === 'presentAddress'),
    );

    const unevenShares = await asMember(
      request(app)
        .post('/api/auth/users/me/kyc')
        .send(
          kycPayload({
            nominees: [{ ...kycPayload().nominees[0], percentage: 90 }],
          }),
        ),
    );
    assert.equal(unevenShares.status, 422);
    assert.ok(unevenShares.body.error.details.some((detail) => detail.field === 'nominees'));

    const unsafeUrl = await asMember(
      request(app)
        .post('/api/auth/users/me/kyc')
        .send(kycPayload({ photo: 'javascript:alert(1)' })),
    );
    assert.equal(unsafeUrl.status, 422);
    assert.ok(unsafeUrl.body.error.details.some((detail) => detail.field === 'photo'));
  });

  test('POST updates the Member record and moves the User to under_review', async () => {
    const res = await asMember(
      request(app).post('/api/auth/users/me/kyc').send(kycPayload()),
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.data.profile.status, 'under_review');
    assert.equal(res.body.data.profile.rejectionReason, null);

    const member = await Member.findById(memberRecord._id);
    assert.equal(member.fullName, 'KYC Updated Name');
    assert.equal(member.fullNameBn, 'কেওয়াইসি নাম');
    assert.equal(member.fatherHusbandName, 'Father Name');
    assert.equal(member.motherName, 'Mother Name');
    assert.equal(member.nid, '1234567890');
    assert.equal(member.phone, '01711111111');
    assert.equal(member.email, 'kyc.member@test.local');
    assert.equal(member.occupation, 'Engineer');
    assert.ok(member.dateOfBirth instanceof Date);
    assert.equal(member.presentAddress.fullAddress, 'House 7, Road 2, Dhanmondi, Dhaka');
    assert.equal(member.presentAddress.village, undefined);
    assert.equal(member.permanentAddress.fullAddress, 'Village X, Upazila Y, District Z');
    assert.equal(member.photo, kycPayload().photo);
    assert.equal(member.nidDocument, kycPayload().nidDocument);
    assert.equal(member.nominees.length, 1);
    assert.equal(member.nominees[0].name, 'Updated Nominee');
    assert.equal(member.nominees[0].percentage, 100);
    assert.equal(
      member.nominees[0].fatherHusbandName,
      'Nominee Father',
      'registration-only nominee fields are preserved',
    );
    assert.equal(member.nominees[0].dateOfBirth.toISOString().slice(0, 10), '1992-02-02');
    assert.equal(member.nominees[0].address.fullAddress, 'Nominee Legacy Address');

    const user = await User.findById(memberUser._id);
    assert.equal(user.status, 'under_review');
    assert.equal(user.name, 'KYC Updated Name');
    assert.equal(user.phone, '01711111111');
    assert.equal(user.nid, '1234567890');
    assert.equal(user.email, 'kyc.member@test.local');
    assert.ok(user.kycSubmittedAt instanceof Date);
    assert.equal(user.profileData.presentAddress, 'House 7, Road 2, Dhanmondi, Dhaka');
    assert.equal(user.profileData.permanentAddress, 'Village X, Upazila Y, District Z');
    assert.equal(user.profileData.photo, kycPayload().photo);
    assert.equal(user.profileData.nominees[0].name, 'Updated Nominee');
    assert.equal(user.profileData.notes, 'Please review my documents.');
  });

  test('GET after submission returns the saved member-backed defaults', async () => {
    const res = await asMember(request(app).get('/api/auth/users/me/kyc'));

    assert.equal(res.status, 200);
    const data = res.body.data.profile.profileData;
    assert.equal(data.fullName, 'KYC Updated Name');
    assert.equal(data.presentAddress, 'House 7, Road 2, Dhanmondi, Dhaka');
    assert.equal(data.permanentAddress, 'Village X, Upazila Y, District Z');
    assert.equal(data.nominees.length, 1);
    assert.equal(data.nominees[0].name, 'Updated Nominee');
  });

  test('an under_review profile cannot be resubmitted', async () => {
    const res = await asMember(
      request(app).post('/api/auth/users/me/kyc').send(kycPayload()),
    );

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'KYC_NOT_SUBMITTABLE');
  });

  test('the review queue includes current member data, documents and nominees', async () => {
    const res = await asAdmin(request(app).get('/api/auth/users/kyc-pending'));

    assert.equal(res.status, 200);
    const item = res.body.data.items.find((entry) => entry._id === memberUser._id.toString());
    assert.ok(item, 'submitted member appears in the queue');
    assert.equal(item.profileData.fullName, 'KYC Updated Name');
    assert.equal(item.profileData.presentAddress, 'House 7, Road 2, Dhanmondi, Dhaka');
    assert.equal(item.profileData.photo, kycPayload().photo);
    assert.equal(item.profileData.nominees[0].name, 'Updated Nominee');
  });

  test('an admin can reject the profile with a reason', async () => {
    const res = await asAdmin(
      request(app)
        .post(`/api/auth/users/${memberUser._id}/kyc-decision`)
        .send({ decision: 'rejected', reason: 'NID document is blurry.' }),
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.status, 'rejected');

    const getRes = await asMember(request(app).get('/api/auth/users/me/kyc'));
    assert.equal(getRes.body.data.profile.status, 'rejected');
    assert.equal(getRes.body.data.profile.rejectionReason, 'NID document is blurry.');
  });

  test('a rejected member can fix data and resubmit, clearing the reason', async () => {
    const res = await asMember(
      request(app)
        .post('/api/auth/users/me/kyc')
        .send(
          kycPayload({
            fullName: 'Resubmitted Name',
            notes: 'Blurry document replaced.',
            nominees: [
              {
                ...kycPayload().nominees[0],
                name: 'Resubmitted Nominee',
              },
            ],
          }),
        ),
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.data.profile.status, 'under_review');
    assert.equal(res.body.data.profile.rejectionReason, null);

    const member = await Member.findById(memberRecord._id);
    assert.equal(member.fullName, 'Resubmitted Name');
    assert.equal(member.nominees[0].name, 'Resubmitted Nominee');
    assert.equal(
      member.nominees[0].fatherHusbandName,
      'Nominee Father',
      'resubmission keeps registration-only nominee fields',
    );
  });
});
