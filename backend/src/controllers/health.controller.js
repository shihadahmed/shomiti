import os from 'node:os';
import mongoose from 'mongoose';
import config from '../config/env.js';

const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

/** In-memory cache for DB health */
let dbHealthCache = {
  data: null,
  expiresAt: 0,
  inflight: null,
};

/** Probe DB (actual ping) */
async function probeDatabase() {
  const readyState = mongoose.connection.readyState;
  const state = DB_STATES[readyState] || 'unknown';

  if (readyState !== 1) {
    return { ok: false, state, latencyMs: null, host: null, name: null, cached: false };
  }

  const started = process.hrtime.bigint();
  try {
    await mongoose.connection.db.admin().ping();
    const latencyMs = Number(process.hrtime.bigint() - started) / 1e6;
    return {
      ok: true,
      state: 'connected',
      latencyMs: Math.round(latencyMs * 100) / 100,
      host: mongoose.connection.host || null,
      name: mongoose.connection.name || null,
      cached: false,
    };
  } catch (error) {
    return { ok: false, state: 'error', latencyMs: null, error: error.message, cached: false };
  }
}

/** Get DB health with caching (default 30s TTL) */
export async function getDbHealth(forceRefresh = false, ttlMs = 30000) {
  const now = Date.now();

  if (!forceRefresh && dbHealthCache.data && now < dbHealthCache.expiresAt) {
    return { ...dbHealthCache.data, cached: true, cacheAgeMs: now - (dbHealthCache.expiresAt - ttlMs) };
  }

  // Prevent duplicate concurrent probes
  if (dbHealthCache.inflight) {
    const result = await dbHealthCache.inflight;
    return { ...result, cached: true, cacheAgeMs: 0 };
  }

  dbHealthCache.inflight = probeDatabase();
  try {
    const result = await dbHealthCache.inflight;
    dbHealthCache.data = result;
    dbHealthCache.expiresAt = now + ttlMs;
    return { ...result, cached: false };
  } finally {
    dbHealthCache.inflight = null;
  }
}

/** Invalidate cache (call after known state change) */
export function invalidateDbHealthCache() {
  dbHealthCache.data = null;
  dbHealthCache.expiresAt = 0;
}

export async function health(_req, res) {
  // Lightweight: NO DB ping, just connection state
  const readyState = mongoose.connection.readyState;
  const state = DB_STATES[readyState] || 'unknown';

  res.json({
    success: true,
    data: {
      status: readyState === 1 ? 'ok' : 'degraded',
      mode: config.isLocal ? 'LOCAL' : 'ONLINE',
      env: config.nodeEnv,
      uptimeSeconds: Math.round(process.uptime()),
      db: state,
      time: new Date().toISOString(),
    },
  });
}

export async function system(req, res) {
  // Use cached DB health (no fresh ping unless cache expired)
  const db = await getDbHealth(false, 30000);
  const memory = process.memoryUsage();
  const cpus = os.cpus();

  res.json({
    success: true,
    data: {
      status: db.ok ? 'operational' : 'degraded',
      environment: {
        mode: config.isLocal ? 'LOCAL' : 'ONLINE',
        label: config.modeLabel,
        nodeEnv: config.nodeEnv,
        source: config.detectionSource,
        isProduction: config.isProduction,
      },
      server: {
        uptimeSeconds: Math.round(process.uptime()),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
        hostname: os.hostname(),
        time: new Date().toISOString(),
      },
      memory: {
        rss: memory.rss,
        heapUsed: memory.heapUsed,
        heapTotal: memory.heapTotal,
        external: memory.external,
        systemTotal: os.totalmem(),
        systemFree: os.freemem(),
      },
      cpu: {
        cores: cpus.length,
        model: cpus[0]?.model?.trim() || 'unknown',
        loadAvg: os.loadavg(),
      },
      db,
      client: {
        ip: req.ip,
        forwardedFor: req.get('x-forwarded-for') || null,
        userAgent: req.get('user-agent') || 'unknown',
      },
    },
  });
}

// Admin endpoint to force refresh (optional)
export async function refreshDbHealth(req, res) {
  const db = await getDbHealth(true, 30000);
  res.json({ success: true, data: db });
}

/** Server-Sent Events for real-time system updates */
export async function systemStream(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send initial data
  const initial = await getDbHealth(false, 30000);
  const memory = process.memoryUsage();
  const cpus = os.cpus();
  const server = {
    uptimeSeconds: Math.round(process.uptime()),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    pid: process.pid,
    hostname: os.hostname(),
    time: new Date().toISOString(),
  };
  res.write('data: ' + JSON.stringify({
    status: initial.ok ? 'operational' : 'degraded',
    environment: { mode: config.isLocal ? 'LOCAL' : 'ONLINE', label: config.modeLabel, nodeEnv: config.nodeEnv, source: config.detectionSource, isProduction: config.isProduction },
    server,
    memory: { rss: memory.rss, heapUsed: memory.heapUsed, heapTotal: memory.heapTotal, external: memory.external, systemTotal: os.totalmem(), systemFree: os.freemem() },
    cpu: { cores: cpus.length, model: cpus[0]?.model?.trim() || 'unknown', loadAvg: os.loadavg() },
    db: initial,
    client: { ip: req.ip, forwardedFor: req.get('x-forwarded-for') || null, userAgent: req.get('user-agent') || 'unknown' },
  }) + '\n\n');

  // Heartbeat every 15s
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 15000);

  // Periodic updates (every 30s)
  const updateTimer = setInterval(async () => {
    try {
      const db = await getDbHealth(false, 30000);
      const memory = process.memoryUsage();
      const server = {
        uptimeSeconds: Math.round(process.uptime()),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
        hostname: os.hostname(),
        time: new Date().toISOString(),
      };
      res.write('data: ' + JSON.stringify({
        status: db.ok ? 'operational' : 'degraded',
        server,
        memory: { rss: memory.rss, heapUsed: memory.heapUsed, heapTotal: memory.heapTotal, external: memory.external },
        cpu: { loadAvg: os.loadavg() },
        db,
      }) + '\n\n');
    } catch (e) { /* ignore */ }
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    clearInterval(updateTimer);
  });
}

export default { health, system, refreshDbHealth, systemStream };