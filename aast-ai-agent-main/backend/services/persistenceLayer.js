import fs from "fs";
import path from "path";
import { logger } from "./logger.js";

const DEFAULT_DEBOUNCE_MS = 500;

export function createJsonPersistence({
  filePath,
  defaultValue,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  logLabel = "json-store"
}) {
  let pendingData = null;
  let timer = null;
  let writeQueue = Promise.resolve();

  async function ensureDirectory() {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  }

  async function load() {
    await ensureDirectory();

    try {
      const raw = await fs.promises.readFile(filePath, "utf8");
      if (!raw.trim()) return cloneDefault();
      return JSON.parse(raw);
    } catch (err) {
      if (err.code === "ENOENT") return cloneDefault();

      logger.error(`${logLabel} load failed`, {
        filePath,
        error: err.message
      });
      return cloneDefault();
    }
  }

  function scheduleSave(data) {
    pendingData = data;
    if (timer) clearTimeout(timer);

    timer = setTimeout(() => {
      timer = null;
      flush().catch(err => {
        logger.error(`${logLabel} debounced flush failed`, {
          filePath,
          error: err.message
        });
      });
    }, debounceMs);
  }

  async function flush() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }

    if (!pendingData) return writeQueue;

    const snapshot = pendingData;
    pendingData = null;

    writeQueue = writeQueue
      .catch(() => {
        // Keep later writes alive even if a previous disk write failed.
      })
      .then(async () => {
      await ensureDirectory();
      const tempFile = `${filePath}.tmp`;
      const payload = JSON.stringify(snapshot, null, 2);

      await fs.promises.writeFile(tempFile, payload, "utf8");
      await fs.promises.rename(tempFile, filePath);
    });

    return writeQueue.catch(err => {
      logger.error(`${logLabel} write failed`, {
        filePath,
        error: err.message
      });
      throw err;
    });
  }

  function getStatus() {
    return {
      filePath,
      debounceMs,
      saveQueued: Boolean(timer || pendingData)
    };
  }

  function cloneDefault() {
    return typeof defaultValue === "function"
      ? defaultValue()
      : JSON.parse(JSON.stringify(defaultValue));
  }

  return {
    load,
    scheduleSave,
    flush,
    getStatus
  };
}
