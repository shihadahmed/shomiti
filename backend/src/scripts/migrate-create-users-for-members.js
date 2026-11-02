/**
 * Migration script to create User accounts for existing Members without linked User accounts.
 * Run this after deploying the refactored code to ensure all existing members have portal access.
 * 
 * Usage: node backend/src/scripts/migrate-create-users-for-members.js
 */

import mongoose from 'mongoose';
import config from '../config/env.js';
import Member from '../models/Member.js';
import User from '../models/User.js';
import { hashPassword, createSetupToken } from '../utils/password.js';
import * as emailService from '../services/email.service.js';
import crypto from 'node:crypto';

const ROLES = {
  MEMBER: 'member',
  SUPER_ADMIN: 'super_admin',
  TREASURER: 'treasurer',
  GENERAL_SECRETARY: 'general_secretary',
  PRESIDENT: 'president',
};

const USER_STATUS = {
  INVITED: 'invited',
  PENDING_KYC: 'pending_kyc',
  UNDER_REVIEW: 'under_review',
  ACTIVE: 'active',
  REJECTED: 'rejected',
};

async function migrate() {
  await mongoose.connect(config.mongoUri);
  console.log('Connected to MongoDB');

  try {
    // Find all members without userId
    const membersWithoutUser = await Member.find({ userId: { $exists: false } });
    console.log(`Found ${membersWithoutUser.length} members without linked user accounts`);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const member of membersWithoutUser) {
      try {
        // Check if user already exists with this email or phone
        const existingUser = await User.findOne({
          $or: [
            { email: member.email?.toLowerCase() },
            { phone: member.phone },
          ],
        });

        if (existingUser) {
          // Link existing user to member
          if (!existingUser.memberId || !existingUser.memberId.equals(member._id)) {
            existingUser.memberId = member._id;
            await existingUser.save();
          }
          if (!member.userId || !member.userId.equals(existingUser._id)) {
            member.userId = existingUser._id;
            await member.save();
          }
          console.log(`Linked existing user ${existingUser._id} to member ${member.code}`);
          skipped++;
          continue;
        }

        // Create new user account
        const { raw: rawToken, hash: tokenHash, expires: tokenExpires } = createSetupToken();
        const placeholderPassword = await hashPassword(crypto.randomBytes(32).toString('hex'));

        const user = await User.create({
          name: member.fullName,
          email: member.email?.toLowerCase() || undefined,
          phone: member.phone,
          nid: member.nid,
          role: ROLES.MEMBER,
          memberId: member._id,
          passwordHash: placeholderPassword,
          resetPasswordToken: tokenHash,
          resetPasswordExpires: tokenExpires,
          mustChangePassword: true,
          status: USER_STATUS.INVITED,
        });

        // Link member to user
        member.userId = user._id;
        await member.save();

        // Send invite email if email exists
        if (user.email) {
          try {
            await emailService.sendInviteEmail({
              to: user.email,
              name: user.name,
              token: rawToken,
            });
            console.log(`Sent invite email to ${user.email} for member ${member.code}`);
          } catch (emailError) {
            console.error(`Failed to send invite email to ${user.email}:`, emailError.message);
          }
        }

        console.log(`Created user ${user._id} for member ${member.code}`);
        created++;
      } catch (err) {
        console.error(`Error processing member ${member.code}:`, err.message);
        errors++;
      }
    }

    console.log('\n=== Migration Summary ===');
    console.log(`Created: ${created}`);
    console.log(`Skipped (already had user): ${skipped}`);
    console.log(`Errors: ${errors}`);
    console.log(`Total processed: ${membersWithoutUser.length}`);

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrate().catch(console.error);
}

export default migrate;