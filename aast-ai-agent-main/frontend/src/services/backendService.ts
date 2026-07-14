import type { ChatMessage } from "../types";

const CHAT_HISTORY_KEY = "advisor_chat_history";

type PersistedMessage = Omit<ChatMessage, "timestamp"> & {
  timestamp: string;
};

type MessageToPersist = Omit<ChatMessage, "timestamp" | "id"> & {
  id?: string;
  timestamp: string | Date;
};

function readLocalHistory(): PersistedMessage[] {
  try {
    const raw = localStorage.getItem(CHAT_HISTORY_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PersistedMessage[]) : [];
  } catch {
    return [];
  }
}

function writeLocalHistory(messages: PersistedMessage[]): void {
  localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages));
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
  const nextHistory = [...readLocalHistory(), normalized];
  writeLocalHistory(nextHistory);
}
