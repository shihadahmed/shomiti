import mongoose from 'mongoose';
import config from './env.js';

/**
 * MongoDB connection — Atlas cloud only.
 *
 * Contract:
 *  - Always connects to `process.env.MONGODB_URI` (loaded from backend/.env).
 *  - No in-memory / localhost fallback. If the URI is missing or unreachable,
 *    startup fails loudly instead of silently running on a throwaway database.
 *  - The target database comes from the URI path:
 *      .../test     -> "test"     (development)
 *      .../shomiti  -> "shomiti"  (live)
 */

mongoose.set('strictQuery', true);

/** Mongoose uses "test" when the URI carries no database path. */
const FALLBACK_DB_NAME = 'test';

let listenersAttached = false;
let intentionalDisconnect = false;

/**
 * Extract the database name from a mongodb:// or mongodb+srv:// URI.
 * Returns null when the URI has no path segment.
 */
export function databaseNameFromUri(uri) {
  if (!uri || typeof uri !== 'string') return null;

  try {
    const parsed = new URL(uri);
    const [name] = parsed.pathname.replace(/^\//, '').split('/');
    if (name) return decodeURIComponent(name);
  } catch {
    // URL rejects some unescaped credentials — fall through to manual parsing.
  }

  const withoutQuery = uri.trim().split('?')[0];
  const afterScheme = withoutQuery.replace(/^mongodb(\+srv)?:\/\//i, '');
  const slashIndex = afterScheme.indexOf('/');
  if (slashIndex === -1) return null;

  const [name] = afterScheme.slice(slashIndex + 1).split('/');
  return name ? decodeURIComponent(name) : null;
}

/** Mask the password so connection details are safe to log. */
function redactUri(uri) {
  return String(uri).replace(/\/\/([^:@/]+):([^@/]+)@/, '//$1:***@');
}

/** Mask any occurrence of the password inside a driver error message. */
function redactMessage(message, uri) {
  if (!message) return String(message || '');
  let output = String(message);
  const credentials = String(uri || '').match(/\/\/([^:@/]+):([^@/]+)@/);
  if (credentials?.[2]) output = output.split(credentials[2]).join('***');
  return redactUri(output);
}

/** Turn raw driver errors into an actionable reason + fix. */
function diagnose(error) {
  const message = error?.message || String(error || '');
  const name = error?.name || '';
  const code = error?.code;

  if (code === 18 || code === 8000 || /bad auth|authentication failed|invalid credentials/i.test(message)) {
    return {
      reason: 'Authentication failed',
      hint: 'Atlas → Database Access: verify the username and password inside MONGODB_URI.',
    };
  }

  if (
    name === 'MongooseServerSelectionError' ||
    /ip whitelist|not whitelisted|could not connect to any servers|server selection/i.test(message)
  ) {
    return {
      reason: 'Server selection failed (IP not allowed or cluster unreachable)',
      hint: 'Atlas → Network Access: add your current public IP. On VPN/mobile networks, whitelist that egress IP too.',
    };
  }

  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(message)) {
    return {
      reason: 'DNS lookup failed for the cluster hostname',
      hint: 'Check the cluster host in MONGODB_URI and your internet/DNS connection.',
    };
  }

  if (/ETIMEDOUT|ESOCKETTIMEDOUT|timed out|timeout/i.test(message)) {
    return {
      reason: 'Connection timed out',
      hint: 'Check firewall/VPN egress rules and Atlas Network Access.',
    };
  }

  if (name === 'MongoParseError' || /invalid scheme|must begin with|uri must include/i.test(message)) {
    return {
      reason: 'Invalid connection string',
      hint: 'The URI must start with mongodb:// or mongodb+srv://; percent-encode special characters in the password.',
    };
  }

  return { reason: 'Connection failed', hint: null };
}

/** Attach connection lifecycle listeners exactly once. */
function attachListeners() {
  if (listenersAttached) return;
  listenersAttached = true;

  mongoose.connection.on('error', (error) => {
    const detail = redactMessage(error?.message, process.env.MONGODB_URI);
    console.error(`❌ MongoDB connection error: ${detail}`);
  });

  mongoose.connection.on('disconnected', () => {
    if (intentionalDisconnect) return;
    console.warn('[db] Disconnected from MongoDB — the driver will reconnect automatically.');
  });

  mongoose.connection.on('reconnected', () => {
    console.info(`✅ Reconnected to MongoDB Atlas · 📊 Active Database: ${mongoose.connection.name}`);
  });
}

/**
 * Connect to MongoDB Atlas.
 * @param {string} [uri] Optional override; defaults to process.env.MONGODB_URI.
 * @returns {Promise<import('mongoose').Connection>}
 */
export async function connectDB(uri = process.env.MONGODB_URI) {
  if (mongoose.connection.readyState === 1) return mongoose.connection;

  // A connection attempt is already in flight — wait for it instead of opening a second one.
  if (mongoose.connection.readyState === 2) {
    await new Promise((resolve, reject) => {
      mongoose.connection.once('connected', resolve);
      mongoose.connection.once('error', reject);
    });
    return mongoose.connection;
  }

  const mongoUri = typeof uri === 'string' ? uri.trim() : '';

  if (!mongoUri) {
    console.error('❌ MONGODB_URI missing in .env');
    throw new Error('MONGODB_URI missing in .env');
  }

  if (!/^mongodb(\+srv)?:\/\//i.test(mongoUri)) {
    console.error('❌ Invalid MONGODB_URI — expected mongodb:// or mongodb+srv://');
    throw new Error('Invalid MONGODB_URI: expected mongodb:// or mongodb+srv://');
  }

  const targetDb = databaseNameFromUri(mongoUri) || FALLBACK_DB_NAME;
  const isAtlas = /^mongodb\+srv:/i.test(mongoUri) || /\.mongodb\.net(\/|$)/i.test(mongoUri);
  const label = isAtlas ? 'MongoDB Atlas' : 'MongoDB';

  console.info(`[db] Connecting to ${label} (${redactUri(mongoUri)}) … target database: ${targetDb}`);

  attachListeners();

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 20000,
      socketTimeoutMS: 45000,
      maxPoolSize: 20,
      autoIndex: !config.isProduction,
      retryWrites: true,
    });
  } catch (error) {
    const { reason, hint } = diagnose(error);
    const detail = redactMessage(error?.message, mongoUri);

    console.error(`❌ Could not connect to ${label}`);
    console.error(`   Reason : ${reason}`);
    console.error(`   Error  : ${detail}`);
    if (hint) console.error(`   Fix    : ${hint}`);

    // Preserve the driver error name/message so server.js exits with a real diagnosis.
    const wrapped = new Error(detail);
    wrapped.name = error?.name || 'MongoConnectionError';
    wrapped.cause = error;
    throw wrapped;
  }

  const dbName = mongoose.connection.name || targetDb;
  const host = mongoose.connection.host || 'unknown-host';

  console.info(isAtlas ? '✅ Connected to MongoDB Atlas' : '✅ Connected to MongoDB');
  console.info(`📊 Active Database: ${dbName}`);
  console.info(`[db] Host: ${host} · Pool size: 20`);

  if (targetDb !== dbName) {
    console.warn(`[db] URI specified "${targetDb}" but the driver connected to "${dbName}".`);
  }

  if (config.isProduction && dbName === FALLBACK_DB_NAME) {
    console.warn('⚠️  Production is connected to the "test" database. Point MONGODB_URI at "shomiti".');
  }

  if (!config.isProduction && dbName !== FALLBACK_DB_NAME) {
    console.info(`[db] Development is writing to "${dbName}". Use a "/test" path in MONGODB_URI for scratch data.`);
  }

  return mongoose.connection;
}

export async function disconnectDB() {
  if (mongoose.connection.readyState === 0) return;
  intentionalDisconnect = true;
  try {
    await mongoose.disconnect();
  } finally {
    intentionalDisconnect = false;
  }
}

export default connectDB;
