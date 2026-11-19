import { getAccessToken } from "./authStorage";

// Shared fetch wrapper: none of the service files previously set a timeout,
// so a hung/slow backend left the UI stuck in a loading state indefinitely.
export const DEFAULT_TIMEOUT_MS = 20000;

export class HttpTimeoutError extends Error {
  constructor(url: string, timeoutMs: number) {
    super(`Request to ${url} timed out after ${timeoutMs}ms`);
    this.name = "HttpTimeoutError";
  }
}

export class HttpRequestCancelledError extends Error {
  constructor(url: string) {
    super(`Request to ${url} was cancelled`);
    this.name = "HttpRequestCancelledError";
  }
}

export function isRequestCancellationError(error: unknown): boolean {
  return error instanceof HttpRequestCancelledError;
}

async function executeWithTimeout<T>(
  input: string,
  init: RequestInit,
  timeoutMs: number,
  consume: (response: Response) => Promise<T> | T,
): Promise<T> {
  const controller = new AbortController();
  const callerSignal = init.signal;
  let timedOut = false;
  let cancelledByCaller = false;

  const cancelFromCaller = () => {
    cancelledByCaller = true;
    controller.abort();
  };

  if (callerSignal?.aborted) cancelFromCaller();
  else callerSignal?.addEventListener("abort", cancelFromCaller, { once: true });

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const headers = new Headers(init.headers);
    const token = getAccessToken();
    if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(input, { ...init, headers, signal: controller.signal });
    return await consume(response);
  } catch (err) {
    // If navigation cancellation and the deadline race, cancellation wins so
    // switching conversations is never presented as a backend timeout.
    if (cancelledByCaller) {
      throw new HttpRequestCancelledError(input);
    }
    if (timedOut) throw new HttpTimeoutError(input, timeoutMs);
    if (controller.signal.aborted) throw new HttpRequestCancelledError(input);
    throw err;
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener("abort", cancelFromCaller);
  }
}

export async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  return executeWithTimeout(input, init, timeoutMs, (response) => response);
}

// Use this helper whenever the caller consumes a response body. Keeping body
// parsing inside the deadline ensures a stalled JSON/text stream remains
// cancellable instead of becoming unbounded after response headers arrive.
export async function fetchAndConsumeWithTimeout<T>(
  input: string,
  init: RequestInit,
  consume: (response: Response) => Promise<T> | T,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  return executeWithTimeout(input, init, timeoutMs, consume);
}
