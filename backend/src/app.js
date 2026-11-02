import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import config, { backendRoot } from './config/env.js';
import { ensureDbConnected } from './config/db.js';
import routes from './routes/index.js';
import { requireCustomHeader } from './middleware/csrf.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { notFound, errorHandler } from './middleware/error.js';
import ApiError from './utils/ApiError.js';

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", ...config.corsOrigins],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        upgradeInsecureRequests: config.isProduction ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
      console.warn(
        `[cors] blocked origin "${origin}". Allowed origins: ${config.corsOrigins.join(', ') || '(none configured)'}`,
      );
      return callback(ApiError.forbidden('Origin is not allowed.', 'CORS_DENIED'));
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieParser());

/** High-frequency probes — never worth a log line on either side. */
const QUIET_PATHS = ['/api/health', '/api/system'];

function isQuietPath(url) {
  // `req.path` is rewritten by the mounted /api router ("/health"),
  // so always match against the untouched original URL.
  const requestPath = (url || '').split('?')[0];
  return QUIET_PATHS.some(
    (path) => requestPath === path || requestPath.startsWith(`${path}/`),
  );
}

if (config.nodeEnv !== 'test') {
  app.use(
    morgan(config.isProduction ? 'combined' : 'dev', {
      skip: (req) => isQuietPath(req.originalUrl || req.url),
    }),
  );
}

/**
 * Vercel's Express preset loads this module and serves the exported app
 * directly; it never runs the `start()` sequence in server.js. Nothing would
 * therefore connect Mongoose, and every query would fail with a buffering
 * timeout.
 *
 * Connect on the first API request instead and reuse the connection for the
 * rest of the instance's lifetime. Health probes are still let through when
 * the connection fails — their job is to report the outage, not to become a
 * 500 of their own.
 */
if (config.nodeEnv !== 'test') {
  app.use('/api', (req, _res, next) => {
    ensureDbConnected().then(
      () => next(),
      (error) => {
        console.error(`[db] lazy connect failed: ${error.message}`);
        if (isQuietPath(req.originalUrl || req.url)) return next();
        return next(
          new ApiError(
            503,
            'DB_UNAVAILABLE',
            'The database is unavailable. Please try again shortly.',
          ),
        );
      },
    );
  });
}

app.use('/api', globalLimiter, requireCustomHeader, routes);
app.use('/api', notFound);

// Operations console (served on the backend root) — available in all environments.
// Files are referenced through `new URL(..., import.meta.url)` so Vercel's file
// tracer bundles them into the serverless function. `res.sendFile()` and
// `express.static()` are invisible to the tracer, which caused ENOENT on Vercel.
const OPS_ASSETS = new Map([
  ['ops.html', { type: 'text/html; charset=utf-8', url: new URL('../public/ops/ops.html', import.meta.url) }],
  ['ops.css', { type: 'text/css; charset=utf-8', url: new URL('../public/ops/ops.css', import.meta.url) }],
  ['ops.js', { type: 'text/javascript; charset=utf-8', url: new URL('../public/ops/ops.js', import.meta.url) }],
  ['lucide.css', { type: 'text/css; charset=utf-8', url: new URL('../public/ops/lucide.css', import.meta.url) }],
  ['lucide.woff2', { type: 'font/woff2', url: new URL('../public/ops/lucide.woff2', import.meta.url) }],
  ['favicon.png', { type: 'image/png', url: new URL('../public/ops/favicon.png', import.meta.url) }],
]);

function sendOpsAsset(res, name) {
  const asset = OPS_ASSETS.get(name);
  if (!asset) return false;
  asset.body = asset.body || fs.readFileSync(asset.url);
  res.set('Cache-Control', config.isProduction ? 'public, max-age=3600' : 'no-cache');
  res.type(asset.type).send(asset.body);
  return true;
}

app.get('/ops-assets/:asset', (req, res, next) => {
  if (!sendOpsAsset(res, req.params.asset)) return next();
  return undefined;
});
app.get('/', (_req, res) => sendOpsAsset(res, 'ops.html'));
app.get('/console', (_req, res) => res.redirect('/'));
app.get('/health', (_req, res) => res.redirect('/api/health'));

// Frontend serving — only in local development (production frontend is on separate domain)
if (config.serveFrontend && !config.isProduction) {
  const frontendDir = path.resolve(backendRoot, '../frontend');
  app.use(
    express.static(frontendDir, {
      index: false,
      maxAge: config.isProduction ? '1h' : 0,
      etag: true,
    }),
  );
  app.get('/app', (_req, res) => res.sendFile(path.join(frontendDir, 'app.html')));
}

app.use(notFound);

app.use((error, req, res, next) => {
  // No local file cleanup needed - using memory storage for Cloudinary
  return errorHandler(error, req, res, next);
});

export default app;
