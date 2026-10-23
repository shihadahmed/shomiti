import config from './config/env.js';
import app from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { initializeDefaultRoles } from './services/role.service.js';

let server;

async function start() {
  try {
    await connectDB();
    await initializeDefaultRoles();
    server = app.listen(config.port, () => {
      console.info('═'.repeat(60));
      console.info(`[SYSTEM STATUS]: Running ${config.modeLabel}`);
      console.info(`[DETECTION SOURCE]: ${config.detectionSource}`);
      console.info(`[ENVIRONMENT]: ${config.nodeEnv.toUpperCase()}`);
      console.info(`[SERVER]: SHOPNONIR SOMOBAI SOMITEE API listening on http://localhost:${config.port}`);
      console.info('═'.repeat(60));
    });
  } catch (error) {
    console.error('[server] failed to start:', error.message);
    process.exit(1);
  }
}

async function shutdown(signal) {
  console.info(`[server] ${signal} received, shutting down...`);
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await disconnectDB();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandled rejection:', reason);
});
process.on('uncaughtException', (error) => {
  console.error('[server] uncaught exception:', error);
  process.exit(1);
});

start();