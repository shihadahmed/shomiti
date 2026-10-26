import AuditLog from '../models/AuditLog.js';

/** Removes sensitive or noisy fields before an audit snapshot is persisted. */
export function sanitizeSnapshot(value) {
  if (!value) return value;
  const plain = typeof value.toObject === 'function' ? value.toObject() : { ...value };
  delete plain.passwordHash;
  delete plain.tokenVersion;
  delete plain.resetPasswordToken;
  delete plain.resetPasswordExpires;
  delete plain.__v;
  return plain;
}

export async function writeAudit(
  { actor, action, entityType, entityId, before, after, req, session },
) {
  const entry = new AuditLog({
    actor,
    action,
    entityType,
    entityId,
    before: sanitizeSnapshot(before),
    after: sanitizeSnapshot(after),
    ip: req?.ip,
    userAgent: req?.get?.('user-agent')?.slice(0, 300),
    at: new Date(),
  });

  await entry.save(session ? { session } : {});
  return entry;
}

export default writeAudit;
