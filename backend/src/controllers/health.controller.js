import os from 'node:os';
import mongoose from 'mongoose';
import config from '../config/env.js';

const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

/**
 * Database status is derived from Mongoose's in-memory readyState only.
 *
 * No `db.admin().ping()`, no collection counts, no network roundtrip: this
 * costs ~0 ms even when Atlas is on another continent, which makes it safe to
 * call on every health check / SSE tick.
 *
 * readyState: 0 disconnected · 1 connected · 2 connecting · 3 disconnecting
 */
export function getDbHealth() {
  const readyState = mongoose.connection.readyState;
  const state = DB_STATES[readyState] || 'unknown';

  return {
    ok: readyState === 1,
    state,
    readyState,
    name: mongoose.connection.name || null,
    host: mongoose.connection.host || null,
    // Retained so existing clients keep a stable shape. Always null: no roundtrip is performed.
    latencyMs: null,
    source: 'connection-state',
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Kept for API compatibility. There is no cached probe anymore — the status is
 * a synchronous memory read, so there is nothing to invalidate.
 */
export function invalidateDbHealthCache() {
  /* no-op */
}

function serverSnapshot() {
  const memory = process.memoryUsage();
  const cpus = os.cpus();

  return {
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
  };
}

function environmentSnapshot() {
  return {
    mode: config.isLocal ? 'LOCAL' : 'ONLINE',
    label: config.modeLabel,
    nodeEnv: config.nodeEnv,
    source: config.detectionSource,
    isProduction: config.isProduction,
  };
}

export function health(_req, res) {
  const db = getDbHealth();

  res.set('Cache-Control', 'no-store');
  res.json({
    success: true,
    data: {
      status: db.ok ? 'ok' : 'degraded',
      mode: config.isLocal ? 'LOCAL' : 'ONLINE',
      env: config.nodeEnv,
      uptimeSeconds: Math.round(process.uptime()),
      db: db.state,
      database: db.name,
      time: new Date().toISOString(),
    },
  });
}

export function system(req, res) {
  const db = getDbHealth();

  res.set('Cache-Control', 'no-store');
  res.json({
    success: true,
    data: {
      status: db.ok ? 'operational' : 'degraded',
      environment: environmentSnapshot(),
      ...serverSnapshot(),
      db,
      client: {
        ip: req.ip,
        forwardedFor: req.get('x-forwarded-for') || null,
        userAgent: req.get('user-agent') || 'unknown',
      },
    },
  });
}

/** Admin endpoint kept for compatibility — returns the current snapshot. */
export function refreshDbHealth(_req, res) {
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, data: getDbHealth() });
}

/** Server-Sent Events for real-time system updates. */
export function systemStream(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (event) => {
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch {
      /* client vanished mid-write */
    }
  };

  const buildSnapshot = (includeClient) => {
    const db = getDbHealth();

    return {
      status: db.ok ? 'operational' : 'degraded',
      environment: environmentSnapshot(),
      ...serverSnapshot(),
      db,
      ...(includeClient
        ? {
            client: {
              ip: req.ip,
              forwardedFor: req.get('x-forwarded-for') || null,
              userAgent: req.get('user-agent') || 'unknown',
            },
          }
        : {}),
    };
  };

  // Initial payload carries the client block; periodic updates do not.
  send(buildSnapshot(true));

  // Heartbeat keeps proxies from closing the idle connection (comment line, no JSON).
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      /* ignore */
    }
  }, 15000);

  // Metrics push: 30 s is plenty for a dashboard and keeps Atlas traffic at zero.
  const updateTimer = setInterval(() => {
    if (res.writableEnded) return;
    send(buildSnapshot(false));
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    clearInterval(updateTimer);
  });
}

export default { health, system, refreshDbHealth, systemStream, getDbHealth, invalidateDbHealthCache };
