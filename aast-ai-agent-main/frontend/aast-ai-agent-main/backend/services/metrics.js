const startedAt = Date.now();

const counters = new Map();
const timers = new Map();

function getCounter(name) {
  return counters.get(name) || 0;
}

function getTimer(name) {
  if (!timers.has(name)) {
    timers.set(name, {
      count: 0,
      totalMs: 0,
      minMs: null,
      maxMs: 0
    });
  }

  return timers.get(name);
}

export function incrementMetric(name, amount = 1) {
  counters.set(name, getCounter(name) + amount);
}

export function recordDuration(name, durationMs) {
  const timer = getTimer(name);
  const value = Number(durationMs) || 0;

  timer.count += 1;
  timer.totalMs += value;
  timer.minMs = timer.minMs === null ? value : Math.min(timer.minMs, value);
  timer.maxMs = Math.max(timer.maxMs, value);
}

export function startTimer() {
  const start = process.hrtime.bigint();
  return () => Number(process.hrtime.bigint() - start) / 1_000_000;
}

export function getMetricsSnapshot() {
  const timerSnapshot = {};

  for (const [name, timer] of timers.entries()) {
    timerSnapshot[name] = {
      count: timer.count,
      totalMs: Math.round(timer.totalMs),
      avgMs: timer.count ? Math.round(timer.totalMs / timer.count) : 0,
      minMs: timer.minMs === null ? 0 : Math.round(timer.minMs),
      maxMs: Math.round(timer.maxMs)
    };
  }

  const cacheHits = getCounter("cache.hit");
  const cacheMisses = getCounter("cache.miss");
  const cacheTotal = cacheHits + cacheMisses;

  return {
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    counters: Object.fromEntries(counters),
    timers: timerSnapshot,
    rates: {
      cacheHitRate: cacheTotal ? Number((cacheHits / cacheTotal).toFixed(4)) : 0
    }
  };
}
