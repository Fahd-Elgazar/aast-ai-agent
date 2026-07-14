// Shared fetch wrapper: none of the service files previously set a timeout,
// so a hung/slow backend left the UI stuck in a loading state indefinitely.
export const DEFAULT_TIMEOUT_MS = 20000;

export class HttpTimeoutError extends Error {
  constructor(url: string, timeoutMs: number) {
    super(`Request to ${url} timed out after ${timeoutMs}ms`);
    this.name = "HttpTimeoutError";
  }
}

export async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: init.signal ?? controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new HttpTimeoutError(input, timeoutMs);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
