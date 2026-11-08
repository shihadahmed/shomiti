/**
 * Rewrites legacy member codes (SOM-YYYY-NNNN) into the current
 * <YEAR_LETTER><0000><MONTH_LETTER> format.
 *
 * Codes that already match the new format are left untouched. Sequences are
 * allocated chronologically inside each year-month bucket and the shared
 * `member-code:YYYY-MM` counters are advanced to the highest code in use, so
 * new signups cannot collide with migrated members.
 *
 * Usage:
 *   npm run migrate:member-codes                (dry run)
 *   npm run migrate:member-codes -- --apply     (write changes)
 */

import mongoose from 'mongoose';
import config from '../config/env.js';
import Member from '../models/Member.js';
import Counter from '../models/Counter.js';
import { MEMBER_CODE_BASE_YEAR, formatMemberCode } from '../utils/sequence.js';

const MEMBER_CODE_PATTERN = /^[A-Z]\d{4}[A-L]$/;

/** Bucket for a member that already uses the new code format. */
function bucketFromCode(code) {
  return {
    year: MEMBER_CODE_BASE_YEAR + (code.charCodeAt(0) - 65),
    month: code.charCodeAt(5) - 65,
  };
}

/** Bucket for a legacy member, based on the join date (clamped to base year). */
function bucketFromDate(member) {
  const raw = member.joinDate || member.createdAt || new Date();
  const at = new Date(raw);
  const date = Number.isNaN(at.getTime()) ? new Date() : at;
  return {
    year: Math.max(date.getFullYear(), MEMBER_CODE_BASE_YEAR),
    month: date.getMonth(),
  };
}

function bucketKey(bucket) {
  return `${bucket.year}-${String(bucket.month + 1).padStart(2, '0')}`;
}

function getBucket(buckets, bucket) {
  const key = bucketKey(bucket);
  if (!buckets.has(key)) {
    buckets.set(key, { ...bucket, key, maxSequence: 0 });
  }
  return buckets.get(key);
}

async function migrate(apply = false) {
  await mongoose.connect(config.mongoUri);
  console.log(`Connected to MongoDB (${apply ? 'APPLY' : 'DRY RUN'})`);

  try {
    const members = await Member.find({})
      .select('_id code joinDate createdAt')
      .sort({ joinDate: 1, createdAt: 1, _id: 1 })
      .lean();

    const buckets = new Map();
    const legacy = [];

    for (const member of members) {
      if (MEMBER_CODE_PATTERN.test(member.code)) {
        const bucket = getBucket(buckets, bucketFromCode(member.code));
        bucket.maxSequence = Math.max(bucket.maxSequence, Number(member.code.slice(1, 5)));
      } else {
        legacy.push({ member, bucket: getBucket(buckets, bucketFromDate(member)) });
      }
    }

    const updates = legacy.map(({ member, bucket }) => {
      bucket.maxSequence += 1;
      return {
        member,
        code: formatMemberCode(bucket.maxSequence, new Date(bucket.year, bucket.month, 1)),
      };
    });

    for (const { member, code } of updates) {
      console.log(`${member.code || '(no code)'} -> ${code}`);
    }

    if (!apply) {
      console.log(`\nDry run: ${updates.length} member code(s) would change. Re-run with --apply to write.`);
      return;
    }

    if (updates.length) {
      await Member.bulkWrite(
        updates.map(({ member, code }) => ({
          updateOne: { filter: { _id: member._id }, update: { $set: { code } } },
        })),
        { ordered: true },
      );
    }

    for (const bucket of buckets.values()) {
      if (bucket.maxSequence === 0) continue;
      await Counter.updateOne(
        { key: `member-code:${bucket.key}` },
        { $max: { seq: bucket.maxSequence } },
        { upsert: true },
      );
    }

    console.log(
      `\nUpdated ${updates.length} member code(s) and synced ${buckets.size} counter bucket(s).`,
    );
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

const apply = process.argv.includes('--apply');
migrate(apply).catch((error) => {
  console.error('Migration failed:', error);
  process.exitCode = 1;
});

export default migrate;
