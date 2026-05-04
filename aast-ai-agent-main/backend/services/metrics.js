import chalk from "chalk";
import boxen from "boxen";
import cliTable3 from "cli-table3";

const startedAt = Date.now();

const counters = new Map();
const timers = new Map();

/* =========================
   INTERNAL HELPERS
========================= */

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

/* =========================
   METRIC COLLECTION
========================= */

export function incrementMetric(name, amount = 1) {
  counters.set(name, getCounter(name) + amount);
}

export function recordDuration(name, durationMs) {
  const timer = getTimer(name);
  const value = Number(durationMs) || 0;

  timer.count += 1;
  timer.totalMs += value;
  timer.minMs =
    timer.minMs === null
      ? value
      : Math.min(timer.minMs, value);

  timer.maxMs = Math.max(timer.maxMs, value);
}

export function startTimer() {
  const start = process.hrtime.bigint();

  return () =>
    Number(process.hrtime.bigint() - start) /
    1_000_000;
}

/* =========================
   SNAPSHOT
========================= */

export function getMetricsSnapshot() {
  const timerSnapshot = {};

  for (const [name, timer] of timers.entries()) {
    timerSnapshot[name] = {
      count: timer.count,
      totalMs: Math.round(timer.totalMs),
      avgMs: timer.count
        ? Math.round(timer.totalMs / timer.count)
        : 0,
      minMs:
        timer.minMs === null
          ? 0
          : Math.round(timer.minMs),
      maxMs: Math.round(timer.maxMs)
    };
  }

  const cacheHits = getCounter("cache.hit");
  const cacheMisses = getCounter("cache.miss");
  const cacheTotal = cacheHits + cacheMisses;

  return {
    uptimeSeconds: Math.round(
      (Date.now() - startedAt) / 1000
    ),
    counters: Object.fromEntries(counters),
    timers: timerSnapshot,
    rates: {
      cacheHitRate: cacheTotal
        ? Number(
            (cacheHits / cacheTotal).toFixed(4)
          )
        : 0
    }
  };
}

/* =========================
   TERMINAL DASHBOARD
========================= */

export function printMetricsDashboard() {
  const snapshot = getMetricsSnapshot();

  /* ---------- HEADER ---------- */
  const header = boxen(
    `
${chalk.white("Uptime        :")} ${chalk.green(
      `${snapshot.uptimeSeconds}s`
    )}
${chalk.white("Cache Hit Rate:")} ${chalk.cyan(
      `${(snapshot.rates.cacheHitRate * 100).toFixed(
        2
      )}%`
    )}
`,
    {
      title: "SYSTEM METRICS DASHBOARD",
      titleAlignment: "center",
      padding: 1,
      borderStyle: "round",
      borderColor: "cyan"
    }
  );

  console.log(header);

  /* ---------- COUNTERS ---------- */
  const counterTable = new cliTable3({
    head: [
      chalk.yellow("Counter"),
      chalk.yellow("Value")
    ],
    colWidths: [35, 15]
  });

  for (const [key, value] of Object.entries(
    snapshot.counters
  )) {
    counterTable.push([
      chalk.white(key),
      chalk.green(value)
    ]);
  }

  console.log(
    boxen(counterTable.toString(), {
      title: "COUNTERS",
      titleAlignment: "center",
      padding: 1,
      borderStyle: "round",
      borderColor: "yellow"
    })
  );

  /* ---------- TIMERS ---------- */
  const timerTable = new cliTable3({
    head: [
      chalk.magenta("Timer"),
      chalk.magenta("Count"),
      chalk.magenta("Avg(ms)"),
      chalk.magenta("Min(ms)"),
      chalk.magenta("Max(ms)"),
      chalk.magenta("Total(ms)")
    ],
    colWidths: [25, 10, 12, 12, 12, 14]
  });

  for (const [key, timer] of Object.entries(
    snapshot.timers
  )) {
    timerTable.push([
      chalk.white(key),
      chalk.green(timer.count),
      chalk.cyan(timer.avgMs),
      chalk.blue(timer.minMs),
      chalk.red(timer.maxMs),
      chalk.yellow(timer.totalMs)
    ]);
  }

  console.log(
    boxen(timerTable.toString(), {
      title: "PERFORMANCE TIMERS",
      titleAlignment: "center",
      padding: 1,
      borderStyle: "round",
      borderColor: "magenta"
    })
  );
}

/* =========================
   CATEGORY HELPERS
========================= */

export const metrics = {
  requestStarted: () =>
    incrementMetric("requests.total"),

  requestFailed: () =>
    incrementMetric("requests.failed"),

  cacheHit: () =>
    incrementMetric("cache.hit"),

  cacheMiss: () =>
    incrementMetric("cache.miss"),

  graphSuccess: () =>
    incrementMetric("graph.success"),

  graphFailure: () =>
    incrementMetric("graph.failure"),

  llmFallback: () =>
    incrementMetric("llm.fallback"),

  faqHit: () =>
    incrementMetric("faq.hit"),

  faqMiss: () =>
    incrementMetric("faq.miss")
};