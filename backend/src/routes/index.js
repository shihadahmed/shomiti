import { Router } from 'express';
import { health, system, refreshDbHealth, systemStream } from '../controllers/health.controller.js';
import authRoutes from './auth.routes.js';
import memberRoutes from './member.routes.js';
import savingsRoutes from './savings.routes.js';
import approvalRoutes from './approval.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import schemeRoutes from './scheme.routes.js';
import expenseRoutes from './expense.routes.js';
import documentRoutes from './document.routes.js';
import ledgerRoutes from './ledger.routes.js';
import auditRoutes from './audit.routes.js';
import roleRoutes from './role.routes.js';
import notificationRoutes from './notification.routes.js';
import uploadRoutes from './upload.routes.js';
import config from '../config/env.js';

const router = Router();

router.get('/health', health);
router.get('/system', system);
router.get('/system/stream', systemStream);
router.post('/system/refresh-db', refreshDbHealth);

// Debug endpoint - shows config state without secrets
router.get('/debug', (_req, res) => {
  res.json({
    success: true,
    data: {
      nodeEnv: config.nodeEnv,
      isLocal: config.isLocal,
      isProduction: config.isProduction,
      detectionSource: config.detectionSource,
      modeLabel: config.modeLabel,
      port: config.port,
      corsOrigins: config.corsOrigins,
      frontendUrl: config.frontendUrl,
      serveFrontend: config.serveFrontend,
      maxUploadBytes: config.maxUploadBytes,
      hasMongoUri: !!config.mongoUri,
      mongoUriPreview: config.mongoUri ? config.mongoUri.substring(0, 20) + '...' : 'NOT SET',
      hasJwtSecret: !!config.jwt.secret,
      jwtSecretPreview: config.jwt.secret ? config.jwt.secret.substring(0, 10) + '...' : 'NOT SET',
      jwtExpiresIn: config.jwt.expiresIn,
      cookieName: config.jwt.cookieName,
      mail: {
        enabled: config.mail.enabled,
        transport: config.mail.transport,
        host: config.mail.host,
        port: config.mail.port,
        secure: config.mail.secure,
        hasUser: !!config.mail.user,
        hasPass: !!config.mail.pass,
      },
      cloudinary: {
        hasCloudName: !!config.cloudinary.cloudName,
        hasApiKey: !!config.cloudinary.apiKey,
        hasApiSecret: !!config.cloudinary.apiSecret,
      },
      processEnv: {
        NODE_ENV: process.env.NODE_ENV,
        VERCEL: process.env.VERCEL,
        PORT: process.env.PORT,
        CLIENT_ORIGIN: process.env.CLIENT_ORIGIN,
        MONGODB_URI: process.env.MONGODB_URI ? 'SET' : 'NOT SET',
        JWT_SECRET: process.env.JWT_SECRET ? 'SET' : 'NOT SET',
      },
    },
  });
});

router.use('/auth', authRoutes);
router.use('/members', memberRoutes);
router.use('/savings', savingsRoutes);
router.use('/approvals', approvalRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/schemes', schemeRoutes);
router.use('/expenses', expenseRoutes);
router.use('/documents', documentRoutes);
router.use('/ledger', ledgerRoutes);
router.use('/audit', auditRoutes);
router.use('/roles', roleRoutes);
router.use('/notifications', notificationRoutes);
router.use('/upload', uploadRoutes);

export default router;
