import type { ConversationDetail, ConversationSummary } from "../types";
import { API_BASE } from "../config/api";
import { fetchAndConsumeWithTimeout } from "./httpClient";

type ConversationListResponse = {
  conversations?: ConversationSummary[];
};

type ConversationResponse = {
  conversation?: ConversationDetail;
};

type ConversationRequestOptions = {
  signal?: AbortSignal;
};

function buildUrl(path: string, params?: Record<string, string>) {
  const normalizedBase = API_BASE.endsWith("/") ? API_BASE.slice(0, -1) : API_BASE;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const fallbackOrigin = typeof window === "undefined" ? "http://localhost" : window.location.origin;
  const url = new URL(`${normalizedBase}${normalizedPath}`, fallbackOrigin);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  return url.toString();
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  return fetchAndConsumeWithTimeout(
    buildUrl(path),
    {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    },
    async (response) => {
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `HTTP ${response.status}`);
      }

      if (response.status === 204) return undefined as T;
      return (await response.json()) as T;
    },
  );
}

export async function listConversations(
  search = "",
  options: ConversationRequestOptions = {},
) {
  const url = buildUrl("/conversations", search ? { search } : undefined);
  const payload = await fetchAndConsumeWithTimeout(
    url,
    { signal: options.signal },
    async (response) => {
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `HTTP ${response.status}`);
      }
      return (await response.json()) as ConversationListResponse;
    },
  );
  return payload.conversations || [];
}

export async function createConversation() {
  const payload = await request<ConversationResponse>("/conversations", {
    method: "POST",
    body: JSON.stringify({}),
  });

  if (!payload.conversation) throw new Error("Conversation was not returned.");
  return payload.conversation;
}

export async function getConversation(
  cid: string,
  options: ConversationRequestOptions = {},
) {
  const payload = await request<ConversationResponse>(
    `/conversations/${encodeURIComponent(cid)}`,
    { signal: options.signal },
  );
  if (!payload.conversation) throw new Error("Conversation was not returned.");
  return payload.conversation;
}

export async function renameConversation(cid: string, title: string) {
  const payload = await request<ConversationResponse>(
    `/conversations/${encodeURIComponent(cid)}/title`,
    {
      method: "PATCH",
      body: JSON.stringify({ title }),
    }
  );

  if (!payload.conversation) throw new Error("Conversation was not returned.");
  return payload.conversation;
}

export async function setConversationPinned(cid: string, pinned: boolean) {
  const payload = await request<ConversationResponse>(
    `/conversations/${encodeURIComponent(cid)}/pin`,
    {
      method: "PATCH",
      body: JSON.stringify({ pinned }),
    }
  );

  if (!payload.conversation) throw new Error("Conversation was not returned.");
  return payload.conversation;
}

export async function deleteConversation(cid: string) {
  await request<void>(`/conversations/${encodeURIComponent(cid)}`, {
    method: "DELETE",
  });
}
