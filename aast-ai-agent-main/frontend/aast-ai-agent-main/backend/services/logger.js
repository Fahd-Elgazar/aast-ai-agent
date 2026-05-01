import fs from "fs";
import path from "path";

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

const LOG_DIR = path.resolve(process.cwd(), process.env.LOG_DIR || "logs");
const configuredLogLevel = (process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "INFO" : "DEBUG")).toUpperCase();
const LOG_LEVEL = LOG_LEVELS.hasOwnProperty(configuredLogLevel) ? configuredLogLevel : "INFO";
const MAX_LOG_BYTES = Number(process.env.LOG_MAX_BYTES || 5 * 1024 * 1024);
const LOG_FILE_PREFIX = process.env.LOG_FILE_PREFIX || "app";

let currentLogDate = null;
let currentLogFile = null;

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function getDateStamp(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function getLogFile() {
  ensureLogDir();

  const dateStamp = getDateStamp();
  if (currentLogFile && currentLogDate === dateStamp) {
    return currentLogFile;
  }

  currentLogDate = dateStamp;
  currentLogFile = path.join(LOG_DIR, `${LOG_FILE_PREFIX}-${dateStamp}.log`);
  return currentLogFile;
}

async function rotateIfNeeded(filePath) {
  try {
    if (!fs.existsSync(filePath)) return;

    const stats = await fs.promises.stat(filePath);
    if (stats.size < MAX_LOG_BYTES) return;

    const rotatedPath = filePath.replace(/\.log$/, `-${Date.now()}.log`);
    await fs.promises.rename(filePath, rotatedPath);
  } catch (err) {
    console.error("Log rotation failed:", err.message);
  }
}

function sanitizeMeta(meta = {}) {
  const safe = {};

  for (const [key, value] of Object.entries(meta || {})) {
    if (/password|secret|token|authorization/i.test(key)) {
      safe[key] = "[REDACTED]";
    } else if (value instanceof Error) {
      safe[key] = {
        message: value.message,
        stack: process.env.NODE_ENV === "production" ? undefined : value.stack
      };
    } else {
      safe[key] = value;
    }
  }

  return safe;
}

function shouldLog(level) {
  return LOG_LEVELS[level] <= LOG_LEVELS[LOG_LEVEL];
}

export function log(level, message, meta = {}) {
  const normalizedLevel = String(level || "INFO").toUpperCase();
  if (!LOG_LEVELS.hasOwnProperty(normalizedLevel) || !shouldLog(normalizedLevel)) return;

  const entry = {
    ts: new Date().toISOString(),
    level: normalizedLevel,
    message,
    ...sanitizeMeta(meta)
  };

  const serialized = `${JSON.stringify(entry)}\n`;

  if (normalizedLevel === "ERROR") {
    console.error(serialized.trim());
  } else if (normalizedLevel === "WARN") {
    console.warn(serialized.trim());
  } else if (normalizedLevel === "DEBUG") {
    console.debug(serialized.trim());
  } else {
    console.log(serialized.trim());
  }

  const filePath = getLogFile();
  rotateIfNeeded(filePath)
    .then(() => fs.promises.appendFile(filePath, serialized, "utf8"))
    .catch(err => console.error("Log write failed:", err.message));
}

export const logger = {
  error: (message, meta) => log("ERROR", message, meta),
  warn: (message, meta) => log("WARN", message, meta),
  info: (message, meta) => log("INFO", message, meta),
  debug: (message, meta) => log("DEBUG", message, meta)
};
