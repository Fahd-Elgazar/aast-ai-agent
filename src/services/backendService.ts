import type { ChatMessage, DecisionData, GraphData } from "../types";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000/api";
const CHAT_HISTORY_KEY = "advisor_chat_history";
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

interface BackendAdvisorResponse {
  answer: string;
  source?: string;
  decision?: DecisionData | null;
  graph: GraphData | null;
}

type PersistedMessage = Omit<ChatMessage, "timestamp"> & {
  timestamp: string;
};

type MessageToPersist = Omit<ChatMessage, "timestamp" | "id"> & {
  id?: string;
  timestamp: string | Date;
};

function mockResponse(message: string) {
  const msg = message.toLowerCase();

  const isDecision =
    msg.includes("major") ||
    msg.includes("career") ||
    msg.includes("recommend");

  const isGraph =
    msg.includes("graph") ||
    msg.includes("show") ||
    msg.includes("visualize");

  // 🎯 DECISION RESPONSE
  if (isDecision) {
    return {
      answer: "Here is a recommendation for you 👇",
      source: "decision",
      decision: {
        recommended_major: "Artificial Intelligence",
        confidence: 0.87,
        reason: "You enjoy problem solving, data, and intelligent systems.",
        warnings: ["Requires strong math", "Heavy workload"]
      },
      graph: null
    };
  }

  // 🧠 GRAPH RESPONSE
  if (isGraph) {
    return {
      answer: "Here is a knowledge graph 👇",
      source: "graph",
      decision: null,
      graph: {
        nodes: [
          { id: "AI", group: 1 },
          { id: "Machine Learning", group: 2 },
          { id: "Deep Learning", group: 2 },
          { id: "Computer Vision", group: 2 },
          { id: "NLP", group: 2 }
        ],
        links: [
          { source: "AI", target: "Machine Learning" },
          { source: "Machine Learning", target: "Deep Learning" },
          { source: "AI", target: "Computer Vision" },
          { source: "AI", target: "NLP" }
        ]
      }
    };
  }

  // 💬 NORMAL RESPONSE
  return {
    answer: "This is a mock AI response.",
    source: "mock",
    decision: null,
    graph: null
  };
}
async function post<TResponse>(path: string, body: unknown, token?: string): Promise<TResponse> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  return (await res.json()) as TResponse;
}

function getToken(): string | undefined {
  return localStorage.getItem("token") ?? undefined;
}

function normalizeConfidence(raw: unknown): number {
  if (typeof raw !== "number" || Number.isNaN(raw)) return 0;
  return raw > 1 ? Math.max(0, Math.min(raw, 100)) : Math.round(raw * 100);
}

function normalizeDecision(raw: unknown): DecisionData | undefined {
  if (!raw || typeof raw !== "object") return undefined;

  const value = raw as Record<string, unknown>;
  const warnings = Array.isArray(value.warnings)
    ? value.warnings.filter((warning): warning is string => typeof warning === "string")
    : [];

  return {
    recommended_major: String(
      value.recommended_major ??
      value.recommendedMajor ??
      value.major ??
      "Undetermined"
    ),
    confidence: normalizeConfidence(value.confidence),
    reason: String(value.reason ?? value.explanation ?? value.rationale ?? "No reason provided."),
    warnings,
  };
}

function normalizeGraph(raw: unknown): GraphData | null {
  if (!raw || typeof raw !== "object") return null;

  const value = raw as Record<string, unknown>;
  const rawNodes = Array.isArray(value.nodes) ? value.nodes : [];
  const rawLinks = Array.isArray(value.links)
    ? value.links
    : Array.isArray(value.edges)
      ? value.edges
      : [];

  return {
    cypherQuery: typeof value.cypherQuery === "string" ? value.cypherQuery : undefined,
    nodes: rawNodes
      .filter((node): node is Record<string, unknown> => !!node && typeof node === "object")
      .map((node) => ({
        id: String(node.id ?? node.name ?? crypto.randomUUID()),
        label: typeof node.label === "string" ? node.label : undefined,
        group: typeof node.group === "number" ? node.group : 2,
      })),
    links: rawLinks
      .filter((link): link is Record<string, unknown> => !!link && typeof link === "object")
      .map((link) => ({
        source: String(link.source ?? link.from ?? ""),
        target: String(link.target ?? link.to ?? ""),
        value: typeof link.value === "number" ? link.value : 1,
      }))
      .filter((link) => link.source && link.target),
  };
}

function normalizeAdvisorResponse(raw: unknown): BackendAdvisorResponse {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const decision = normalizeDecision(value.decision ?? value.recommendation);
  const source = typeof value.source === "string"
    ? value.source
    : decision
      ? "decision"
      : "advisor";

  return {
    answer: String(value.answer ?? value.text ?? value.responseText ?? "No answer."),
    source,
    decision,
    graph: normalizeGraph(value.graph ?? value.graphUpdate),
  };
}

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

function normalizeHistoryResponse(raw: unknown): PersistedMessage[] {
  if (Array.isArray(raw)) return raw as PersistedMessage[];
  if (!raw || typeof raw !== "object") return [];

  const value = raw as Record<string, unknown>;
  const history = value.history ?? value.messages ?? value.data;
  return Array.isArray(history) ? (history as PersistedMessage[]) : [];
}

export async function login(email: string, password: string) {
  return await post("/auth/login", { email, password });
}

export async function signup(payload: unknown) {
  return await post("/auth/signup", payload);
}

export async function sendMessageToBackend(message: string): Promise<BackendAdvisorResponse> {
  if (USE_MOCK) {
    await new Promise((res) => setTimeout(res, 800));
    return mockResponse(message);
  }

  const result = await post("/graph/ask", { question: message }, getToken());
  return normalizeAdvisorResponse(result);
}

export async function getChatHistory(): Promise<PersistedMessage[]> {
  try {
    const result = await post("/chat/history", {}, getToken());
    const normalized = normalizeHistoryResponse(result);
    if (normalized.length > 0) {
      writeLocalHistory(normalized.map((message) => toPersistedMessage(message)));
    }
    return normalized;
  } catch {
    return readLocalHistory();
  }
}

export async function saveMessage(message: MessageToPersist): Promise<void> {
  const normalized = toPersistedMessage(message);
  const nextHistory = [...readLocalHistory(), normalized];
  writeLocalHistory(nextHistory);

  try {
    await post("/chat/save", normalized, getToken());
  } catch {
    // Local persistence is enough to keep the UI working when the backend is unavailable.
  }
}
