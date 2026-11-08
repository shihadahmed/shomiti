import Counter from '../models/Counter.js';

/**
 * Allocates the next value for a named sequence.
 *
 * Counters are intentionally updated outside the caller's Mongo session: a
 * rolled-back financial transaction may leave a gap in the numbering, but it
 * can never produce a duplicate document number. Gaps are acceptable for
 * audit numbering; collisions are not.
 */
export async function nextSequence(key, { retries = 3 } = {}) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      await Counter.updateOne(
        { key },
        { $setOnInsert: { key, seq: 0 } },
        { upsert: true },
      );
      const counter = await Counter.findOneAndUpdate(
        { key },
        { $inc: { seq: 1 } },
        { returnDocument: 'after' },
      );
      if (!counter) throw new Error(`Counter "${key}" could not be incremented`);
      return counter.seq;
    } catch (error) {
      const isDuplicate = error?.code === 11000;
      if (!isDuplicate || attempt === retries - 1) throw error;
    }
  }
  throw new Error(`Counter "${key}" could not be allocated`);
}

/** Formats a document number such as MEM-2026-0001. */
export function formatDocNo(prefix, sequence, date = new Date(), pad = 4) {
  const year = new Date(date).getFullYear();
  return `${prefix}-${year}-${String(sequence).padStart(pad, '0')}`;
}

export async function nextDocNo(prefix, key, options = {}) {
  const sequence = await nextSequence(key);
  return formatDocNo(prefix, sequence, options.date, options.pad);
}

/** Member codes map years onto letters starting at A for 2024. */
export const MEMBER_CODE_BASE_YEAR = 2024;
const MONTH_LETTERS = 'ABCDEFGHIJKL';
const MEMBER_CODE_MAX_SEQUENCE = 9999;

/** Year letter for a date: 2024 => A, 2025 => B, 2026 => C, ... */
export function memberYearLetter(date = new Date()) {
  return String.fromCharCode(65 + (new Date(date).getFullYear() - MEMBER_CODE_BASE_YEAR));
}

/** Month letter for a date: Jan => A, Nov => K, Dec => L. */
export function memberMonthLetter(date = new Date()) {
  return MONTH_LETTERS[new Date(date).getMonth()];
}

/** Formats a six-character member code, e.g. C0001K for November 2026. */
export function formatMemberCode(sequence, date = new Date()) {
  return `${memberYearLetter(date)}${String(sequence).padStart(4, '0')}${memberMonthLetter(date)}`;
}

/**
 * Allocates the next member code for the month `date` falls in.
 *
 * The sequence restarts at 0001 each month and is incremented atomically by
 * MongoDB, so concurrent signups can never receive the same code.
 */
export async function nextMemberCode(date = new Date()) {
  const at = new Date(date);
  const key = `member-code:${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}`;
  const sequence = await nextSequence(key);
  if (sequence > MEMBER_CODE_MAX_SEQUENCE) {
    throw new Error(`Member code sequence overflow for "${key}".`);
  }
  return formatMemberCode(sequence, at);
}

export default {
  nextSequence,
  formatDocNo,
  nextDocNo,
  memberYearLetter,
  memberMonthLetter,
  formatMemberCode,
  nextMemberCode,
};
