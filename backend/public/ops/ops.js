(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes)) return '—';
    var units = ['B', 'KB', 'MB', 'GB', 'TB'];
    var value = bytes;
    var i = 0;
    while (value >= 1024 && i < units.length - 1) {
      value /= 1024;
      i += 1;
    }
    return (i === 0 ? Math.round(value) : value.toFixed(value >= 100 ? 0 : 1)) + ' ' + units[i];
  }

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function formatUptime(seconds) {
    var s = Math.max(0, Math.floor(seconds));
    var days = Math.floor(s / 86400);
    var hours = Math.floor((s % 86400) / 3600);
    var minutes = Math.floor((s % 3600) / 60);
    var secs = s % 60;
    if (days > 0) return days + 'd ' + pad(hours) + 'h ' + pad(minutes) + 'm';
    if (hours > 0) return hours + 'h ' + pad(minutes) + 'm ' + pad(secs) + 's';
    return minutes + 'm ' + pad(secs) + 's';
  }

  function shortUserAgent(ua) {
    if (!ua) return 'unknown';
    var browser = 'Browser';
    if (/Edg\//.test(ua)) browser = 'Edge';
    else if (/OPR\/|Opera/.test(ua)) browser = 'Opera';
    else if (/Chrome\//.test(ua)) browser = 'Chrome';
    else if (/Firefox\//.test(ua)) browser = 'Firefox';
    else if (/Safari\//.test(ua)) browser = 'Safari';

    var os = 'Unknown OS';
    if (/Windows NT 10/.test(ua)) os = 'Windows 10/11';
    else if (/Windows/.test(ua)) os = 'Windows';
    else if (/Android/.test(ua)) os = 'Android';
    else if (/iPhone|iPad|iOS/.test(ua)) os = 'iOS';
    else if (/Mac OS X/.test(ua)) os = 'macOS';
    else if (/Linux/.test(ua)) os = 'Linux';

    return browser + ' · ' + os;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>');
  }

  function highlightJson(value) {
    var json = JSON.stringify(value, null, 2);
    return escapeHtml(json).replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?)/g,
      function (match) {
        var cls = 'tok-num';
        if (/^"/.test(match)) {
          cls = /:$/.test(match) ? 'tok-key' : 'tok-str';
        } else if (/true|false|null/.test(match)) {
          cls = 'tok-bool';
        }
        return '<span class="' + cls + '">' + match + '</span>';
      }
    );
  }

  function setText(id, text) {
    var el = $(id);
    if (el) el.textContent = text;
  }

  /* ============================================================
     Theme
     ============================================================ */
  var THEME_KEY = 'shomiti.ops.theme';
  var root = document.documentElement;

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* ignore */ }
  }

  var storedTheme = null;
  try { storedTheme = localStorage.getItem(THEME_KEY); } catch (e) { /* ignore */ }

  var params = new URLSearchParams(window.location.search);
  var queryTheme = params.get('theme');

  if (queryTheme === 'light' || queryTheme === 'dark') {
    applyTheme(queryTheme);
  } else if (storedTheme === 'light' || storedTheme === 'dark') {
    applyTheme(storedTheme);
  } else {
    applyTheme('dark');
  }

  var themeToggle = $('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
    });
  }

  /* ============================================================
     Toast + copy
     ============================================================ */
  var toastTimer = null;
  function showToast(message) {
    var toast = $('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 1800);
  }

  document.querySelectorAll('[data-copy-target]').forEach(function (button) {
    button.addEventListener('click', function () {
      var target = $(button.getAttribute('data-copy-target'));
      if (!target) return;
      var text = target.textContent;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          showToast('Copied to clipboard');
        }).catch(function () {
          showToast('Copy failed');
        });
      } else {
        var area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        try { document.execCommand('copy'); showToast('Copied to clipboard'); }
        catch (e) { showToast('Copy failed'); }
        document.body.removeChild(area);
      }
    });
  });

  /* ============================================================
     Client telemetry
     ============================================================ */
  function renderClientTelemetry() {
    setText('client-screen', window.screen.width + ' × ' + window.screen.height);
    setText('client-dpr', 'device pixel ratio ' + (window.devicePixelRatio || 1) + '×');
    setText('client-cores', String(navigator.hardwareConcurrency || '—'));
  }

  renderClientTelemetry();
  window.addEventListener('resize', renderClientTelemetry);

  /* ============================================================
     Live server clock
     ============================================================ */
  var serverClockOffset = 0;
  var clockStarted = false;

  function renderClock() {
    var now = new Date(Date.now() + serverClockOffset);
    setText('kpi-clock', pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds()));
    setText(
      'kpi-clock-sub',
      now.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
    );
  }

  function startClock() {
    if (clockStarted) return;
    clockStarted = true;
    renderClock();
    setInterval(renderClock, 1000);
  }

  /* ============================================================
     Live uptime ticker
     ============================================================ */
  var uptimeBaseline = null;
  var uptimeFetchedAt = 0;

  function renderUptime() {
    if (uptimeBaseline === null) return;
    var elapsed = (Date.now() - uptimeFetchedAt) / 1000;
    setText('kpi-uptime', formatUptime(uptimeBaseline + elapsed));
  }

  setInterval(renderUptime, 1000);

  /* ============================================================
     State application
     ============================================================ */
  var pulsePill = $('pulse-pill');
  var radar = $('radar');
  var dbCard = $('db-card');
  var heroTitle = $('hero-status-text');
  var heroSub = $('hero-status-sub');

  function applySystem(data, latencyMs) {
    var env = data.environment || {};
    var server = data.server || {};
    var memory = data.memory || {};
    var cpu = data.cpu || {};
    var db = data.db || {};
    var client = data.client || {};
    var operational = data.status === 'operational';

    /* Hero */
    if (heroTitle) {
      heroTitle.textContent = operational ? 'All systems operational' : 'Service degraded';
    }
    if (heroSub) {
      heroSub.textContent = operational
        ? 'The API is responding normally and the MongoDB connection is open. Metrics below refresh automatically.'
        : 'The API is reachable but MongoDB has no active connection. Check cluster status and network access rules.';
    }

    /* Pulse */
    if (pulsePill) {
      pulsePill.classList.toggle('is-ok', operational);
      pulsePill.classList.toggle('is-down', !operational);
    }
    setText('pulse-label', operational ? 'API live' : 'API degraded');
    setText('pulse-latency', Number.isFinite(latencyMs) ? Math.round(latencyMs) + ' ms' : '—');

    /* Environment */
    var mode = env.mode || 'UNKNOWN';
    setText('env-pill-label', mode);
    setText('hero-env', mode);
    setText('radar-mode', mode);
    setText('radar-mode-sub', env.source || 'runtime environment');
    setText('footer-mode', 'mode: ' + mode.toLowerCase());

    if (radar) {
      radar.classList.toggle('is-online', operational);
      radar.classList.toggle('is-error', !operational);
    }

    /* Database */
    var dbOk = Boolean(db.ok);
    if (dbCard) {
      dbCard.classList.toggle('is-ok', dbOk);
      dbCard.classList.toggle('is-down', !dbOk);
    }
    var chip = $('db-chip');
    if (chip) {
      chip.className = 'chip ' + (dbOk ? 'chip-ok' : 'chip-down');
      chip.textContent = dbOk ? 'OPERATIONAL' : 'UNAVAILABLE';
    }
    var dbDetail = 'state: ' + (db.state || 'unknown');
    if (dbOk && db.name) dbDetail += ' · db "' + db.name + '"';
    if (!dbOk) dbDetail += ' · no active connection';
    setText('db-detail', dbDetail);
    setText('hero-db', dbOk ? 'Operational' : 'Down');

    /* Latency stat */
    setText('hero-latency', Number.isFinite(latencyMs) ? Math.round(latencyMs) + ' ms' : '—');

    /* Server KPIs */
    if (Number.isFinite(server.uptimeSeconds)) {
      uptimeBaseline = server.uptimeSeconds;
      uptimeFetchedAt = Date.now();
      renderUptime();
    }
    setText('kpi-node', server.nodeVersion || '—');
    setText('kpi-node-sub', (server.platform || '—') + ' / ' + (server.arch || '—') + ' · pid ' + (server.pid || '—'));

    var heapPct = memory.heapTotal ? Math.round((memory.heapUsed / memory.heapTotal) * 100) : 0;
    setText('kpi-mem', formatBytes(memory.heapUsed) + ' / ' + formatBytes(memory.heapTotal));
    var memBar = $('kpi-mem-bar');
    if (memBar) memBar.style.width = Math.min(100, Math.max(0, heapPct)) + '%';
    var systemPct = memory.systemTotal
      ? Math.round(((memory.systemTotal - memory.systemFree) / memory.systemTotal) * 100)
      : null;
    setText(
      'kpi-mem-sub',
      'heap ' + heapPct + '% · RSS ' + formatBytes(memory.rss) + (systemPct !== null ? ' · host ' + systemPct + '%' : '')
    );

    /* Server clock */
    if (server.time) {
      var serverMs = new Date(server.time).getTime();
      if (Number.isFinite(serverMs)) serverClockOffset = serverMs - Date.now();
    }
    startClock();

    /* Client telemetry */
    setText('client-ip', client.ip || '—');
    setText('client-ua', shortUserAgent(client.userAgent));
    setText('client-cores', String(cpu.cores || navigator.hardwareConcurrency || '—'));

    /* Footer */
    setText('footer-version', 'node ' + (server.nodeVersion || '—'));
  }

  function applyHealth(payload) {
    var code = $('json-code');
    if (code) code.innerHTML = highlightJson(payload);
  }

  /* ============================================================
     Transport: SSE first, polling only as a fallback
       • SSE connected -> zero polling
       • SSE down      -> 30 s polling floor, never faster
       • Tab hidden    -> every timer and the stream are stopped
     ============================================================ */
  var systemTimer = null;
  var healthTimer = null;
  var sse = null;
  var sseRetryTimer = null;
  var sseOpen = false;
  var isHidden = document.hidden;
  var consecutiveErrors = 0;

  var POLL_MIN_MS = 15000;         // absolute floor for fallback polling
  var POLL_MAX_MS = 30000;         // steady state while SSE is unavailable
  var HEALTH_INTERVAL_MS = 300000; // static /api/health preview: every 5 min
  var SSE_RETRY_MS = 30000;

  function clearSystemTimer() {
    if (systemTimer) { clearTimeout(systemTimer); systemTimer = null; }
  }

  function clearHealthTimer() {
    if (healthTimer) { clearTimeout(healthTimer); healthTimer = null; }
  }

  function scheduleSystemPoll(delay) {
    clearSystemTimer(); // one chain only — never stack timers
    if (isHidden || sseOpen) return;
    systemTimer = setTimeout(pollSystem, Math.max(POLL_MIN_MS, delay || POLL_MAX_MS));
  }

  function scheduleHealthPoll(delay) {
    clearHealthTimer();
    if (isHidden) return;
    healthTimer = setTimeout(pollHealth, delay || HEALTH_INTERVAL_MS);
  }

  function fetchJson(url) {
    var started = performance.now();
    return fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (body) {
        return { body: body, latency: performance.now() - started };
      });
  }

  function pollSystem() {
    clearSystemTimer();
    if (isHidden || sseOpen) return;

    fetchJson('/api/system')
      .then(function (result) {
        consecutiveErrors = 0;
        applySystem(result.body.data || {}, result.latency);
        scheduleSystemPoll(POLL_MAX_MS);
      })
      .catch(function () {
        consecutiveErrors++;
        if (pulsePill) {
          pulsePill.classList.remove('is-ok');
          pulsePill.classList.add('is-down');
        }
        setText('pulse-label', 'API offline');
        setText('pulse-latency', '—');
        setText('hero-status-text', 'API unreachable');
        setText('hero-status-sub', 'The operations console could not reach the API. The server may be restarting or blocked by the network.');
        // Backoff from 15 s up to 60 s — still never rapid.
        var backoff = Math.min(POLL_MIN_MS * Math.pow(1.5, consecutiveErrors), 60000);
        scheduleSystemPoll(backoff);
      });
  }

  function pollHealth() {
    clearHealthTimer();
    if (isHidden) return;

    fetchJson('/api/health')
      .then(function (result) { applyHealth(result.body); })
      .catch(function () { /* pulse already reports connectivity */ })
      .then(function () { scheduleHealthPoll(HEALTH_INTERVAL_MS); });
  }

  function closeStream() {
    if (sseRetryTimer) { clearTimeout(sseRetryTimer); sseRetryTimer = null; }
    if (sse) { sse.close(); sse = null; }
    sseOpen = false;
  }

  function connectSSE() {
    if (isHidden) return;

    if (typeof EventSource === 'undefined') {
      scheduleSystemPoll(POLL_MAX_MS);
      return;
    }

    if (sse) return; // already connected or connecting

    try {
      sse = new EventSource('/api/system/stream');

      sse.onopen = function () {
        sseOpen = true;
        consecutiveErrors = 0;
        clearSystemTimer(); // the stream owns updates now — stop polling
      };

      sse.onmessage = function (event) {
        try {
          // Pushed frames carry no client-measured latency.
          applySystem(JSON.parse(event.data), null);
        } catch (e) { /* ignore malformed frame */ }
      };

      sse.onerror = function () {
        closeStream();
        if (isHidden) return;
        scheduleSystemPoll(POLL_MAX_MS);           // fallback while stream is down
        sseRetryTimer = setTimeout(connectSSE, SSE_RETRY_MS);
      };
    } catch (e) {
      sse = null;
      scheduleSystemPoll(POLL_MAX_MS);
    }
  }

  /* Page Visibility: a background tab makes zero network requests. */
  document.addEventListener('visibilitychange', function () {
    isHidden = document.hidden;

    if (isHidden) {
      clearSystemTimer();
      clearHealthTimer();
      closeStream();
      return;
    }

    // Foreground again: one snapshot, refresh the JSON card, re-attach the stream.
    pollSystem();
    pollHealth();
    connectSSE();
  });

  // Start
  var originEls = document.querySelectorAll('.curl-origin');
  originEls.forEach(function (el) { el.textContent = window.location.origin; });

  connectSSE();   // preferred transport; schedules fallback polling if it fails
  pollSystem();   // instant first paint; stops rescheduling once SSE is open
  pollHealth();   // static payload card

})();