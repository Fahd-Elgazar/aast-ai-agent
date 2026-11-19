import type { ChatMessage } from "../types";
import { getAuthSubject } from "./authStorage";

const CHAT_HISTORY_KEY = "advisor_chat_history";

// This browser copy is only a fallback; canonical conversations live on the
// backend. Bounding it prevents stale guest sessions from exhausting storage
// without deleting or truncating any active server conversation.
export const MAX_LOCAL_CHAT_HISTORY_MESSAGES = 200;

type PersistedMessage = Omit<ChatMessage, "timestamp"> & {
  timestamp: string;
};

type MessageToPersist = Omit<ChatMessage, "timestamp" | "id"> & {
  id?: string;
  timestamp: string | Date;
};

function readLocalHistory(): PersistedMessage[] {
  try {
    const raw = localStorage.getItem(`${CHAT_HISTORY_KEY}:${getAuthSubject()}`);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PersistedMessage[]) : [];
  } catch {
    return [];
  }
}

function writeLocalHistory(messages: PersistedMessage[]): void {
  localStorage.setItem(`${CHAT_HISTORY_KEY}:${getAuthSubject()}`, JSON.stringify(messages));
}

export function retainLocalHistory<T>(messages: readonly T[]): T[] {
  return messages.slice(-MAX_LOCAL_CHAT_HISTORY_MESSAGES);
}

function toPersistedMessage(message: MessageToPersist): PersistedMessage {
  return {
    id: message.id ?? crypto.randomUUID(),
    ...message,
    timestamp: typeof message.timestamp === "string"
      ? message.timestamp
      : message.timestamp.toISOString(),
  };
}

export async function saveMessage(message: MessageToPersist): Promise<void> {
  const normalized = toPersistedMessage(message);
  const nextHistory = retainLocalHistory([...readLocalHistory(), normalized]);
  writeLocalHistory(nextHistory);
}
