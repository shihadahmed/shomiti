import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path to the backend package root (contains .env and uploads/). */
export const backendRoot = path.resolve(here, '../..');

dotenv.config({ path: path.join(backendRoot, '.env'), quiet: true });

const bool = (value, fallback = false) => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const int = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Dynamically detect if running in production (hosted/cloud) or local development.
 * Priority: explicit NODE_ENV=production > cloud platform indicators > local defaults.
 */
function detectEnvironment() {
  // 1. Explicit production override (set on server via systemd/Docker/PM2)
  if (process.env.NODE_ENV === 'production') {
    return { isLocal: false, isProduction: true, source: 'NODE_ENV=production' };
  }

  // 2. Cloud/hosting platform detection (production indicators)
  const cloudIndicators = [
    { key: 'VERCEL', name: 'Vercel' },
    { key: 'RENDER', name: 'Render' },
    { key: 'RAILWAY_ENVIRONMENT', name: 'Railway' },
    { key: 'HEROKU_APP_NAME', name: 'Heroku' },
    { key: 'AWS_LAMBDA_FUNCTION_NAME', name: 'AWS Lambda' },
    { key: 'GOOGLE_CLOUD_PROJECT', name: 'Google Cloud' },
    { key: 'AZURE_WEBSITE_NAME', name: 'Azure App Service' },
    { key: 'CF_PAGES', name: 'Cloudflare Pages' },
    { key: 'NETLIFY', name: 'Netlify' },
    { key: 'DOKKU_APP_NAME', name: 'Dokku' },
    { key: 'FLY_APP_NAME', name: 'Fly.io' },
    { key: 'KUBERNETES_SERVICE_HOST', name: 'Kubernetes' },
  ];

  for (const indicator of cloudIndicators) {
    if (process.env[indicator.key]) {
      return { isLocal: false, isProduction: true, source: `detected ${indicator.name} (${indicator.key})` };
    }
  }

  // 3. Check for production-like hostnames/ports (not localhost)
  const host = process.env.HOST || process.env.HOSTNAME || '';
  const port = process.env.PORT || '4000';
  const isLocalHost = ['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(host) || host === '';
  const isLocalPort = ['3000', '4000', '5173', '8080', '8000'].includes(port);

  // 4. Check for common CI/CD indicators
  const ciIndicators = ['CI', 'CONTINUOUS_INTEGRATION', 'GITHUB_ACTIONS', 'GITLAB_CI', 'BUILDKITE', 'CIRCLECI', 'TRAVIS'];
  const isCI = ciIndicators.some((key) => process.env[key]);

  if (!isLocalHost || !isLocalPort || isCI) {
    return { isLocal: false, isProduction: true, source: `non-local host/port/CI (host=${host}, port=${port}, CI=${isCI})` };
  }

  // 5. Default: local development
  return { isLocal: true, isProduction: false, source: 'local development defaults' };
}

const { isLocal, isProduction, source } = detectEnvironment();

/** Human-readable mode label for logging */
const modeLabel = isProduction ? 'LIVE / ONLINE PRODUCTION' : 'LOCAL / DEVELOPMENT';

const config = {
  nodeEnv: isProduction ? 'production' : 'development',
  isLocal,
  isProduction,
  detectionSource: source,
  modeLabel,
  port: int(process.env.PORT, 4000),
  mongoUri: process.env.MONGODB_URI || (isLocal ? 'mongodb://127.0.0.1:27017/shomiti' : ''),
  jwt: {
    secret: process.env.JWT_SECRET || (isLocal ? 'dev-only-insecure-secret-change-me' : ''),
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    cookieName: process.env.COOKIE_NAME || 'sn_token',
  },
  corsOrigins: (process.env.CLIENT_ORIGIN || (isLocal ? 'http://localhost:3000,http://localhost:5173' : ''))
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  frontendUrl: process.env.FRONTEND_URL || (isLocal ? 'http://localhost:3000' : ''),
  mail: {
    enabled: bool(process.env.MAIL_ENABLED, true),
    transport: process.env.MAIL_TRANSPORT || (isLocal ? 'json' : 'smtp'),
    host: process.env.SMTP_HOST,
    port: int(process.env.SMTP_PORT, 587),
    secure: bool(process.env.SMTP_SECURE, false),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM || 'SHOMITI <no-reply@shomiti.local>',
    inviteTtlHours: int(process.env.INVITE_TOKEN_TTL_HOURS, 24),
  },
  serveFrontend: bool(process.env.SERVE_FRONTEND, true),
  uploadDir: path.resolve(backendRoot, process.env.UPLOAD_DIR || 'uploads'),
  maxUploadBytes: int(process.env.MAX_UPLOAD_BYTES, 5 * 1024 * 1024),
  approvalThresholdPaisa: int(process.env.APPROVAL_THRESHOLD_TAKA, 10000) * 100,
  bcryptRounds: int(process.env.BCRYPT_ROUNDS, 12),
  seed: {
    adminName: process.env.SEED_ADMIN_NAME || 'System Administrator',
    adminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@shomiti.local',
    adminPhone: process.env.SEED_ADMIN_PHONE || '01700000000',
    adminPassword: process.env.SEED_ADMIN_PASSWORD || 'Admin@12345',
  },
};

if (isProduction) {
  const missing = ['MONGODB_URI', 'JWT_SECRET'].filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
  }
  if (config.jwt.secret.startsWith('dev-only')) {
    throw new Error('JWT_SECRET must be set to a strong random value in production');
  }
  // Ensure mail is configured if enabled in production
  if (config.mail.enabled && config.mail.transport === 'smtp') {
    const mailMissing = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'].filter((key) => !process.env[key]);
    if (mailMissing.length) {
      throw new Error(`Missing required production mail variables: ${mailMissing.join(', ')}`);
    }
  }
}

export default config;