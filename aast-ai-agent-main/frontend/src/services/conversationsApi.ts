import type { ConversationDetail, ConversationSummary } from "../types";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8004/api";

type ConversationListResponse = {
  conversations?: ConversationSummary[];
};

type ConversationResponse = {
  conversation?: ConversationDetail;
};

function buildUrl(path: string, params?: Record<string, string>) {
  const url = new URL(`${API_BASE}${path}`);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  return url.toString();
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(buildUrl(path), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `HTTP ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function listConversations(search = "") {
  const url = buildUrl("/conversations", search ? { search } : undefined);
  const response = await fetch(url);

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `HTTP ${response.status}`);
  }

  const payload = (await response.json()) as ConversationListResponse;
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

export async function getConversation(cid: string) {
  const payload = await request<ConversationResponse>(`/conversations/${encodeURIComponent(cid)}`);
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
