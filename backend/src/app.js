import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import config, { backendRoot } from './config/env.js';
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

if (config.nodeEnv !== 'test') {
  app.use(
    morgan(config.isProduction ? 'combined' : 'dev', {
      skip: (req) => {
        // `req.path` is rewritten by the mounted /api router ("/health"),
        // so match against the untouched original URL instead.
        const requestPath = (req.originalUrl || req.url || '').split('?')[0];
        return QUIET_PATHS.some(
          (path) => requestPath === path || requestPath.startsWith(`${path}/`),
        );
      },
    }),
  );
}

app.use('/api', globalLimiter, requireCustomHeader, routes);
app.use('/api', notFound);

// Operations console (served on the backend root)
const opsDir = path.join(backendRoot, 'public', 'ops');
app.use(
  '/ops-assets',
  express.static(opsDir, {
    maxAge: config.isProduction ? '1h' : 0,
    etag: true,
  }),
);
app.get('/', (_req, res) => res.sendFile(path.join(opsDir, 'ops.html')));
app.get('/console', (_req, res) => res.redirect('/'));
app.get('/health', (_req, res) => res.redirect('/api/health'));

if (config.serveFrontend) {
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
  if (req.file?.path) {
    fs.unlink(req.file.path, () => {});
  }
  return errorHandler(error, req, res, next);
});

export default app;
