/**
 * Backfills a Member profile for every User that does not have one yet.
 *
 * The Members module is the single place where roles and portal access are
 * managed, so staff logins must also have a linked cooperative profile.
 *
 * Usage: npm run migrate:create-members
 *        (or: node src/scripts/migrate-create-members-for-users.js)
 */

import mongoose from 'mongoose';
import config from '../config/env.js';
import Member from '../models/Member.js';
import User from '../models/User.js';
import { nextMemberCode } from '../utils/sequence.js';
import { MEMBER_STATUS } from '../config/constants.js';

async function allocateMemberCode() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = await nextMemberCode();
    const exists = await Member.exists({ code });
    if (!exists) return code;
  }
  throw new Error('Could not allocate a unique member code.');
}

async function migrate() {
  await mongoose.connect(config.mongoUri);
  console.log('Connected to MongoDB');

  try {
    const usersWithoutMember = await User.find({
      $or: [{ memberId: { $exists: false } }, { memberId: null }],
    });

    console.log(`Found ${usersWithoutMember.length} users without linked member profiles`);

    let created = 0;
    let linked = 0;
    let skipped = 0;
    let errors = 0;

    for (const user of usersWithoutMember) {
      try {
        // Already linked from the Member side.
        let member = await Member.findOne({ userId: user._id });

        if (!member) {
          const or = [{ phone: user.phone }];
          if (user.email) or.push({ email: user.email });
          if (user.nid) or.push({ nid: user.nid });
          member = await Member.findOne({ $or: or });
        }

        if (member?.userId && !member.userId.equals(user._id)) {
          console.warn(
            `Skipping user ${user.email || user.phone}: Member ${member.code} is already linked to another user`,
          );
          skipped += 1;
          continue;
        }

        if (member) {
          if (!member.userId) {
            member.userId = user._id;
            await member.save();
          }
          user.memberId = member._id;
          await user.save();
          console.log(`Linked existing member ${member.code} to user ${user.email || user.phone}`);
          linked += 1;
          continue;
        }

        const joinDate = user.createdAt || new Date();
        member = await Member.create({
          code: await allocateMemberCode(),
          fullName: user.name,
          phone: user.phone,
          email: user.email || undefined,
          nid: user.nid || `PENDING-${user.phone}`,
          joinDate,
          status: MEMBER_STATUS.ACTIVE,
          shareCount: 1,
          createdBy: user._id,
          notes: 'Staff profile backfilled by migration. Update the NID before editing.',
        });

        user.memberId = member._id;
        await user.save();

        console.log(`Created member ${member.code} for user ${user.email || user.phone}`);
        created += 1;
      } catch (error) {
        console.error(`Error processing user ${user.email || user.phone}:`, error.message);
        errors += 1;
      }
    }

    console.log('\n=== Migration Summary ===');
    console.log(`Created: ${created}`);
    console.log(`Linked existing members: ${linked}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Errors: ${errors}`);
    console.log(`Total processed: ${usersWithoutMember.length}`);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

migrate().catch((error) => {
  console.error('Migration failed:', error);
  process.exitCode = 1;
});

export default migrate;
