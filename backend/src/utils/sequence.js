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
        { new: true },
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

export default { nextSequence, formatDocNo, nextDocNo };
