import config from '../config/env.js';

const TAKE = 100;

/** Convert a BDT amount (taka) to integer paisa. */
export function toPaisa(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) throw new TypeError('Amount must be a finite number');
  return Math.round(amount * 100);
}

/** Convert integer paisa back to a taka number (2 decimal places). */
export function fromPaisa(paisa) {
  return Math.round(Number(paisa || 0)) / 100;
}

/** True when the value is a positive, 2-decimal BDT amount. */
export function isValidTaka(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return false;
  return Math.abs(Math.round(amount * 100) - amount * 100) < 1e-9;
}

export function requiresApproval({ type, method, amountPaisa, threshold = config.approvalThresholdPaisa }) {
  // Every withdrawal is dual-controlled; cash deposits always need verification.
  if (type === 'withdrawal') return true;
  if (method === 'cash') return true;
  return Number(amountPaisa) >= threshold;
}

export function formatTaka(paisa, locale = 'en-BD') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'BDT',
    maximumFractionDigits: 2,
  }).format(fromPaisa(paisa));
}

export default { toPaisa, fromPaisa, isValidTaka, requiresApproval, formatTaka };
