import chalk from "chalk";
import boxen from "boxen";
import cliTable3 from "cli-table3";

const startedAt = Date.now();

const counters = new Map();
const timers = new Map();
const gauges = new Map();
const REQUIRED_COUNTERS = [
  "gemma_requests_total",
  "gemma_success_total",
  "gemma_failure_total",
  "gemma_timeout_total",
  "gemini_primary_total",
  "gemini_fallback_total",
  "deterministic_fallback_total"
];
const REQUIRED_TIMERS = ["gemma_latency_ms"];
const REQUIRED_GAUGES = ["gemma_queue_depth", "success_rate", "failure_rate"];

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

export function setGauge(name, value) {
  const numeric = Number(value);
  gauges.set(name, Number.isFinite(numeric) ? numeric : 0);
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
  for (const name of REQUIRED_TIMERS) {
    if (!timerSnapshot[name]) {
      timerSnapshot[name] = {
        count: 0,
        totalMs: 0,
        avgMs: 0,
        minMs: 0,
        maxMs: 0
      };
    }
  }

  const cacheHits = getCounter("cache.hit");
  const cacheMisses = getCounter("cache.miss");
  const cacheTotal = cacheHits + cacheMisses;
  const requestTotal = getCounter("http_chatbot_query_total");
  const requestSuccess = getCounter("http_chatbot_success_total");
  const requestFailure = getCounter("http_chatbot_failure_total");
  const gemmaSuccess = getCounter("gemma_success_total");
  const gemmaFailure = getCounter("gemma_failure_total");
  const gemmaTotal = gemmaSuccess + gemmaFailure;
  const successRate = requestTotal
    ? Number((requestSuccess / requestTotal).toFixed(4))
    : 0;
  const failureRate = requestTotal
    ? Number((requestFailure / requestTotal).toFixed(4))
    : 0;
  const gemmaSuccessRate = gemmaTotal
    ? Number((gemmaSuccess / gemmaTotal).toFixed(4))
    : 0;
  const gemmaFailureRate = gemmaTotal
    ? Number((gemmaFailure / gemmaTotal).toFixed(4))
    : 0;

  const counterSnapshot = Object.fromEntries(counters);
  for (const name of REQUIRED_COUNTERS) {
    if (typeof counterSnapshot[name] !== "number") counterSnapshot[name] = 0;
  }

  const gaugeSnapshot = Object.fromEntries(gauges);
  for (const name of REQUIRED_GAUGES) {
    if (typeof gaugeSnapshot[name] !== "number") gaugeSnapshot[name] = 0;
  }
  gaugeSnapshot.success_rate = successRate;
  gaugeSnapshot.failure_rate = failureRate;

  return {
    uptimeSeconds: Math.round(
      (Date.now() - startedAt) / 1000
    ),
    counters: counterSnapshot,
    gauges: gaugeSnapshot,
    timers: timerSnapshot,
    rates: {
      cacheHitRate: cacheTotal
        ? Number(
            (cacheHits / cacheTotal).toFixed(4)
          )
        : 0,
      success_rate: successRate,
      failure_rate: failureRate,
      gemma_success_rate: gemmaSuccessRate,
      gemma_failure_rate: gemmaFailureRate
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
