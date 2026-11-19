import { API_BASE } from "../config/api";
import { fetchAndConsumeWithTimeout } from "./httpClient";

// Interim deadline: production Nginx currently has no explicit proxy timeout,
// so its 60-second proxy_read_timeout is the effective browser-facing ceiling.
// Keep this below that boundary until infrastructure owns one shared end-to-end
// deadline across browser, proxy, and backend.
export const ADVISOR_REQUEST_TIMEOUT_MS = 55_000;

export interface AdvisorRequestToken {
  requestId: number;
  originCid: string | null;
  controller: AbortController;
}

export class AdvisorRequestCoordinator {
  private active: AdvisorRequestToken | null = null;
  private nextRequestId = 1;

  begin(originCid: string | null): AdvisorRequestToken {
    this.cancel();
    const token = {
      requestId: this.nextRequestId++,
      originCid,
      controller: new AbortController(),
    };
    this.active = token;
    return token;
  }

  isLatest(token: AdvisorRequestToken): boolean {
    return this.active?.requestId === token.requestId && !token.controller.signal.aborted;
  }

  isCurrent(token: AdvisorRequestToken, activeCid: string | null): boolean {
    return this.isLatest(token) && token.originCid === activeCid;
  }

  finish(token: AdvisorRequestToken): boolean {
    if (this.active?.requestId !== token.requestId) return false;
    this.active = null;
    return true;
  }

  cancel(): boolean {
    if (!this.active) return false;
    this.active.controller.abort();
    this.active = null;
    return true;
  }
}

// A newly-created conversation CID arrives in the same response as richer UI
// state (citations and graph evidence). Suppress exactly the automatic load
// caused by adopting that CID so an eventually-consistent history read cannot
// replace the response. Later explicit selections still load canonically.
export class ConversationLoadGate {
  private deferredCid: string | null = null;

  deferNextAutomaticLoad(cid: string): void {
    this.deferredCid = cid;
  }

  shouldLoad(cid: string): boolean {
    if (this.deferredCid === cid) {
      this.deferredCid = null;
      return false;
    }
    this.deferredCid = null;
    return true;
  }

  clear(): void {
    this.deferredCid = null;
  }
}

export function getResponseConversationId(
  response: unknown,
  fallback: string | null = null,
): string | null {
  if (!response || typeof response !== "object") return fallback;
  const envelope = response as {
    cid?: unknown;
    conversationId?: unknown;
    conversation?: { cid?: unknown } | null;
  };
  const candidates = [envelope.cid, envelope.conversationId, envelope.conversation?.cid];
  const cid = candidates.find((value) => typeof value === "string" && value.trim());
  return typeof cid === "string" ? cid : fallback;
}

interface AskAgentOptions {
  signal?: AbortSignal;
}

export const askAgent = async (
  input: string,
  cid?: string | null,
  options: AskAgentOptions = {},
) => {
  return fetchAndConsumeWithTimeout(`${API_BASE}/chatbot/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: input, cid: cid || undefined }),
      signal: options.signal,
    },
    async (res) => {
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }
      return res.json();
    },
    ADVISOR_REQUEST_TIMEOUT_MS,
  );
};
