import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { AlertCircle, Bot, GripVertical, Mic, Send, Sparkles } from "lucide-react";
import GraphVisualizer from "../GraphVisualizer";
import ChatMessage from "../ChatMessage";
import ConversationHistorySidebar from "../ConversationHistorySidebar";
import type { GraphPanelMode } from "../GraphControls";
import type {
  ChatMessage as ChatMessageType,
  ConversationDetail,
  ConversationMessage,
  ConversationSummary,
  GraphData,
} from "../../types";
import { saveMessage } from "../../services/backendService";
import { askAgent } from "../../services/agentService";
import {
  deleteConversation,
  getConversation,
  listConversations,
  renameConversation,
  setConversationPinned,
} from "../../services/conversationsApi";
import { useNavigate } from "react-router-dom";

const ACTIVE_CID_KEY = "advisor_active_conversation_id";
const SIDEBAR_COLLAPSED_KEY = "advisor_history_sidebar_collapsed";
const GRAPH_PANEL_MODE_KEY = "advisor_graph_panel_mode";
const GRAPH_PANEL_WIDTH_KEY = "advisor_graph_panel_width";

const GRAPH_WIDTH_BY_MODE: Record<Exclude<GraphPanelMode, "custom">, number> = {
  compact: 38,
  balanced: 50,
  expanded: 64,
};

type SaveMessagePayload = Parameters<typeof saveMessage>[0];

interface SpeechRecognitionErrorLike {
  error?: string;
}

interface SpeechRecognitionResultEventLike {
  results: {
    length: number;
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechRecognitionWindow = Window &
  typeof globalThis & {
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
    SpeechRecognition?: SpeechRecognitionConstructor;
  };

function clampGraphWidth(width: number) {
  return Math.max(36, Math.min(width, 72));
}

const buildWelcomeMessage = (): ChatMessageType => ({
  id: "welcome",
  role: "model",
  text: "Hello! I can help with majors, course planning, and academic decisions.",
  timestamp: new Date(),
});

function getStoredBoolean(key: string, fallback: boolean) {
  const raw = localStorage.getItem(key);
  if (raw == null) return fallback;
  return raw === "true";
}

function getStoredNumber(key: string, fallback: number) {
  const raw = localStorage.getItem(key);
  if (raw == null) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getStoredGraphPanelMode(): GraphPanelMode {
  const raw = localStorage.getItem(GRAPH_PANEL_MODE_KEY);
  return raw === "compact" || raw === "balanced" || raw === "expanded" || raw === "custom"
    ? raw
    : "balanced";
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() =>
    typeof window === "undefined" ? true : window.matchMedia(query).matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const handleChange = () => setMatches(mediaQuery.matches);

    handleChange();
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
}

function toChatMessage(message: ConversationMessage): ChatMessageType {
  const createdAt = message.createdAt ? new Date(message.createdAt) : new Date();

  return {
    id: message.id || crypto.randomUUID(),
    role: message.role === "user" ? "user" : "model",
    text: message.text || message.content || "",
    timestamp: Number.isNaN(createdAt.getTime()) ? new Date() : createdAt,
  };
}

function hydrateMessages(conversation: ConversationDetail): ChatMessageType[] {
  const messages = (conversation.messages || []).map(toChatMessage).filter((message) => message.text.trim());
  return messages.length ? messages : [buildWelcomeMessage()];
}

const AdvisorPage = () => {
  const navigate = useNavigate();
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const isDesktopLayout = useMediaQuery("(min-width: 1280px)");
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [currentCid, setCurrentCid] = useState<string | null>(() => localStorage.getItem(ACTIVE_CID_KEY));
  const [messages, setMessages] = useState<ChatMessageType[]>([buildWelcomeMessage()]);
  const [historySearch, setHistorySearch] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    getStoredBoolean(SIDEBAR_COLLAPSED_KEY, false)
  );

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [graph, setGraph] = useState<GraphData | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [graphPanelMode, setGraphPanelMode] = useState<GraphPanelMode>(() => getStoredGraphPanelMode());
  const [graphPanelWidth, setGraphPanelWidth] = useState(() =>
    clampGraphWidth(getStoredNumber(GRAPH_PANEL_WIDTH_KEY, GRAPH_WIDTH_BY_MODE.balanced))
  );

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const inputRef = useRef(input);
  const preventReloadRef = useRef<string | null>(null);

  const currentConversation = useMemo(
    () => conversations.find((conversation) => conversation.cid === currentCid) || null,
    [conversations, currentCid]
  );

  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  useEffect(() => {
    if (currentCid) localStorage.setItem(ACTIVE_CID_KEY, currentCid);
    else localStorage.removeItem(ACTIVE_CID_KEY);
  }, [currentCid]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    localStorage.setItem(GRAPH_PANEL_MODE_KEY, graphPanelMode);
    localStorage.setItem(GRAPH_PANEL_WIDTH_KEY, String(graphPanelWidth));
  }, [graphPanelMode, graphPanelWidth]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const refreshConversations = useCallback(async (searchTerm = "") => {
    setHistoryLoading(true);
    setHistoryError(null);

    try {
      const nextConversations = await listConversations(searchTerm);
      setConversations(nextConversations);

      if (!searchTerm && currentCid && !nextConversations.some((item) => item.cid === currentCid)) {
        setCurrentCid(null);
        setMessages([buildWelcomeMessage()]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load chat history.";
      setHistoryError(message);
    } finally {
      setHistoryLoading(false);
    }
  }, [currentCid]);

  const loadConversation = useCallback(async (cid: string) => {
    setHistoryLoading(true);
    setHistoryError(null);

    try {
      const conversation = await getConversation(cid);
      setMessages(hydrateMessages(conversation));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to restore this chat.";
      if (message.includes("404") || message.toLowerCase().includes("not found")) {
        setCurrentCid(null);
        setMessages([buildWelcomeMessage()]);
        return;
      }
      setHistoryError(message);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshConversations(historySearch);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [historySearch, refreshConversations]);

  useEffect(() => {
    console.log(`[DEBUG] currentCid changed: ${currentCid}, preventReloadRef: ${preventReloadRef.current}`);
    if (currentCid) {
      if (currentCid === preventReloadRef.current) {
        console.log(`[DEBUG] Skipping loadConversation. Reload prevented for CID: ${currentCid}`);
        preventReloadRef.current = null;
        return;
      }
      console.log(`[DEBUG] Executing loadConversation for CID: ${currentCid}`);
      void loadConversation(currentCid);
    } else {
      setMessages([buildWelcomeMessage()]);
    }
  }, [currentCid, loadConversation]);

  const createNewSession = useCallback(() => {
    setCurrentCid(null);
    setMessages([buildWelcomeMessage()]);
    setGraph(null);
    setInput("");
    inputRef.current = "";
  }, []);

  const safeSaveMessage = async (message: SaveMessagePayload) => {
    try {
      await saveMessage(message);
    } catch {
      console.warn("Local save only");
    }
  };

  const handleRenameConversation = useCallback(async (cid: string, title: string) => {
    await renameConversation(cid, title);
    await refreshConversations(historySearch);
  }, [historySearch, refreshConversations]);

  const handleTogglePinConversation = useCallback(async (conversation: ConversationSummary) => {
    await setConversationPinned(conversation.cid, !conversation.pinned);
    await refreshConversations(historySearch);
  }, [historySearch, refreshConversations]);

  const handleDeleteConversation = useCallback(async (conversation: ConversationSummary) => {
    const confirmed = window.confirm(`Delete "${conversation.title}"?`);
    if (!confirmed) return;

    await deleteConversation(conversation.cid);

    if (conversation.cid === currentCid) {
      setCurrentCid(null);
      setMessages([buildWelcomeMessage()]);
      setGraph(null);
    }

    await refreshConversations(historySearch);
  }, [currentCid, historySearch, refreshConversations]);

  const sendMessage = useCallback(async () => {
    const userText = inputRef.current.trim();
    if (!userText || isLoading) return;

    const activeCid = currentCid;

    if (userText.toLowerCase() === "open decision chat") {
      navigate("/decision/chat");
      setInput("");
      inputRef.current = "";
      return;
    }

    const userMessage: ChatMessageType = {
      id: crypto.randomUUID(),
      role: "user",
      text: userText,
      timestamp: new Date(),
    };

    setMessages((prev) => [
      ...prev.filter((message) => message.id !== "welcome"),
      userMessage,
    ]);

    safeSaveMessage({
      role: "user",
      text: userText,
      timestamp: new Date().toISOString(),
    });

    setInput("");
    inputRef.current = "";
    setIsLoading(true);
    setHistoryError(null);

    try {
      const response = await askAgent(userText, activeCid);

      if (!response) {
        throw new Error("No response from backend");
      }

      const nextCid = response.cid || response.conversationId || response.conversation?.cid || activeCid;
      if (nextCid) {
        if (nextCid !== activeCid) {
          console.log(`[DEBUG] Transitioning CID from ${activeCid} to ${nextCid}. Setting preventReloadRef.`);
          preventReloadRef.current = nextCid;
        }
        setCurrentCid(nextCid);
      }

      const botMessage: ChatMessageType = {
        id: crypto.randomUUID(),
        role: "model",
        text: response.answer || response.final_answer || "No response.",
        timestamp: new Date(),
        source: response.source || response.route || "AI",
        decision: response.decision ?? undefined,
        hasGraph: !!response.graph,
      };

      setMessages((prev) => [
        ...prev.filter((message) => message.id !== "welcome"),
        botMessage,
      ]);

      safeSaveMessage({
        role: "model",
        text: botMessage.text,
        timestamp: new Date().toISOString(),
        source: botMessage.source,
        decision: botMessage.decision,
      });

      const graphData = response.graph || null;
      console.log("[DEBUG] Deferring graph render by 100ms");
      const graphRenderStartTime = Date.now();
      window.setTimeout(() => {
        console.log(`[DEBUG] Executing deferred graph render. Start delay: ${Date.now() - graphRenderStartTime}ms`);
        setGraph(graphData);
      }, 100);
      await refreshConversations(historySearch);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev.filter((message) => message.id !== "welcome"),
        {
          id: crypto.randomUUID(),
          role: "model",
          text: "I could not connect to the advisor backend. Please make sure the Node orchestrator is running.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [currentCid, historySearch, isLoading, navigate, refreshConversations]);

  const handleSpeechToText = useCallback(() => {
    const speechWindow = window as SpeechRecognitionWindow;
    const SpeechRecognition = speechWindow.webkitSpeechRecognition || speechWindow.SpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    if (!recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsRecording(true);
        setIsProcessing(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
        setIsProcessing(false);
        if (inputRef.current.trim()) {
          void sendMessage();
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorLike) => {
        setIsRecording(false);
        setIsProcessing(false);
        console.error("Speech Error:", event.error);
      };

      recognition.onresult = (event: SpeechRecognitionResultEventLike) => {
        const transcript = event.results[event.results.length - 1][0].transcript;
        if (transcript) {
          const newText = transcript.trim();
          setInput((prev) => {
            const combined = prev ? `${prev.trim()} ${newText}` : newText;
            inputRef.current = combined;
            return combined;
          });
        }
      };
      recognitionRef.current = recognition;
    }

    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch {
        console.warn("Speech recognition is already started.");
      }
    }
  }, [isRecording, sendMessage]);

  const handleGraphPanelModeChange = useCallback((mode: GraphPanelMode) => {
    setGraphPanelMode(mode);
    if (mode !== "custom") {
      setGraphPanelWidth(GRAPH_WIDTH_BY_MODE[mode]);
    }
  }, []);

  const handleResizeGraphPanel = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDesktopLayout) return;

    event.preventDefault();
    const container = layoutRef.current;
    if (!container) return;

    const pointerId = event.pointerId;
    event.currentTarget.setPointerCapture(pointerId);

    const resize = (clientX: number) => {
      const rect = container.getBoundingClientRect();
      const nextWidth = clampGraphWidth(((rect.right - clientX) / rect.width) * 100);
      setGraphPanelWidth(nextWidth);
      setGraphPanelMode("custom");
    };

    const handlePointerMove = (moveEvent: PointerEvent) => resize(moveEvent.clientX);
    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    resize(event.clientX);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
  }, [isDesktopLayout]);

  const graphMinWidth = graphPanelMode === "compact" ? 440 : graphPanelMode === "expanded" ? 660 : 540;
  const graphPanelStyle: CSSProperties | undefined = isDesktopLayout
    ? {
        width: `${graphPanelWidth}%`,
        minWidth: graphMinWidth,
      }
    : undefined;

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-slate-100">
      <div
        ref={layoutRef}
        className="flex h-full min-h-0 w-full flex-col gap-3 overflow-y-auto transition-none xl:flex-row xl:overflow-hidden"
      >
        <ConversationHistorySidebar
          conversations={conversations}
          activeCid={currentCid}
          collapsed={sidebarCollapsed}
          loading={historyLoading}
          search={historySearch}
          onSearchChange={setHistorySearch}
          onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
          onNewChat={createNewSession}
          onSelectConversation={setCurrentCid}
          onRenameConversation={handleRenameConversation}
          onTogglePinConversation={handleTogglePinConversation}
          onDeleteConversation={handleDeleteConversation}
        />

        <div className="flex min-h-[640px] min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 xl:min-h-0">
          <div className="border-b border-slate-200 bg-white px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy-900 text-gold-300 shadow-lg shadow-navy-900/20">
                <Bot className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-sm font-bold uppercase tracking-[0.14em] text-slate-950">
                    AI Academic Advisor
                  </h1>
                  <Sparkles className="h-4 w-4 text-gold-500" aria-hidden="true" />
                </div>
                <div className="mt-1 truncate text-xs font-medium text-slate-500">
                  {currentConversation?.title || "New conversation"}
                </div>
              </div>
            </div>
          </div>

          {historyError && (
            <div className="flex items-center gap-2 border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {historyError}
            </div>
          )}

          <div className="custom-scrollbar flex-1 min-h-0 overflow-y-auto bg-slate-50/90 p-4">
            <div className="mx-auto flex max-w-3xl flex-col gap-4">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-500 shadow-sm">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                    <span className="h-2 w-2 animate-pulse rounded-full bg-gold-500 [animation-delay:120ms]" />
                    <span className="h-2 w-2 animate-pulse rounded-full bg-slate-400 [animation-delay:240ms]" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="border-t border-slate-200 bg-white p-3">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 shadow-inner">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void sendMessage();
                }}
                placeholder={isRecording ? "Listening..." : "Type a message..."}
                className="min-h-10 flex-1 rounded-xl border border-transparent bg-white px-4 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-navy-300 focus:ring-2 focus:ring-navy-500/20"
              />

              <button
                type="button"
                onClick={handleSpeechToText}
                disabled={isProcessing || isLoading}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-navy-500/30 ${
                  isRecording
                    ? "scale-105 animate-pulse bg-red-500 text-white shadow-lg shadow-red-500/25"
                    : "bg-white text-slate-600 shadow-sm hover:bg-slate-100"
                }`}
                title={isRecording ? "Stop recording" : "Start voice input"}
                aria-label={isRecording ? "Stop recording" : "Start voice input"}
              >
                <Mic className="h-4 w-4" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={isLoading || !input.trim()}
                className="flex h-10 shrink-0 items-center gap-2 rounded-xl bg-navy-900 px-4 text-sm font-bold text-white shadow-lg shadow-navy-900/20 transition hover:-translate-y-0.5 hover:bg-navy-800 focus:outline-none focus:ring-2 focus:ring-navy-500/30 disabled:translate-y-0 disabled:bg-slate-300 disabled:shadow-none"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                Send
              </button>
            </div>
          </div>
        </div>

        <div
          style={graphPanelStyle}
          className="relative flex min-h-[720px] min-w-0 shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-900 bg-slate-950 text-white shadow-2xl shadow-slate-950/20 transition-[width] duration-300 ease-out xl:min-h-0"
        >
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize graph panel"
            title="Drag to resize graph panel"
            onPointerDown={handleResizeGraphPanel}
            className="group absolute left-0 top-0 z-20 hidden h-full w-3 cursor-col-resize items-center justify-center xl:flex"
          >
            <span className="flex h-16 w-5 items-center justify-center rounded-full bg-white/10 opacity-0 transition group-hover:opacity-100">
              <GripVertical className="h-4 w-4 text-white/60" aria-hidden="true" />
            </span>
          </div>
          <div id="graph-section" className="flex min-h-0 min-w-0 flex-1 bg-slate-950 p-2">
            <GraphVisualizer
              graphData={graph}
              isLoading={isLoading}
              panelMode={graphPanelMode}
              onPanelModeChange={handleGraphPanelModeChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvisorPage;
