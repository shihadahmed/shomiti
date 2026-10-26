import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import config from '../config/env.js';

export function hashPassword(plain) {
  return bcrypt.hash(plain, config.bcryptRounds);
}

export function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createSetupToken() {
  const raw = randomToken();
  const hash = hashToken(raw);
  const expires = new Date();
  expires.setHours(expires.getHours() + config.mail.inviteTtlHours);
  return { raw, hash, expires };
}

export function generateTemporaryPassword(length = 14) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const bytes = crypto.randomBytes(length);
  let password = '';
  for (let i = 0; i < length; i += 1) password += alphabet[bytes[i] % alphabet.length];
  return password;
}
