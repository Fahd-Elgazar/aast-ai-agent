import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import GraphVisualizer from "../GraphVisualizer";
import ChatMessage from "../ChatMessage";
import ConversationHistorySidebar from "../ConversationHistorySidebar";
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

const defaultGraph: GraphData = {
  nodes: [
    { id: "1", label: "Student" },
    { id: "2", label: "AI" },
    { id: "3", label: "Machine Learning" },
  ],
  links: [
    { source: "1", target: "2", type: "INTERESTED_IN" },
    { source: "2", target: "3", type: "INCLUDES" },
  ],
};

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
  const [graph, setGraph] = useState<GraphData | null>(defaultGraph);

  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef(input);

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
    if (currentCid) {
      void loadConversation(currentCid);
    } else {
      setMessages([buildWelcomeMessage()]);
    }
  }, [currentCid, loadConversation]);

  const createNewSession = useCallback(() => {
    setCurrentCid(null);
    setMessages([buildWelcomeMessage()]);
    setGraph(defaultGraph);
    setInput("");
    inputRef.current = "";
  }, []);

  const safeSaveMessage = async (message: any) => {
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
      setGraph(defaultGraph);
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
      if (nextCid) setCurrentCid(nextCid);

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

      setGraph(response.graph || null);
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
    const SpeechRecognition =
      (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;

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

      recognition.onerror = (event: any) => {
        setIsRecording(false);
        setIsProcessing(false);
        console.error("Speech Error:", event.error);
      };

      recognition.onresult = (event: any) => {
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

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-gray-50">
      <div
        className={`grid h-full min-h-0 w-full gap-4 transition-[grid-template-columns] ${
          sidebarCollapsed
            ? "grid-cols-[72px_minmax(0,1.7fr)_minmax(280px,0.9fr)]"
            : "grid-cols-[280px_minmax(0,1.7fr)_minmax(300px,0.95fr)]"
        }`}
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

        <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="border-b bg-navy-800 p-4 text-white">
            <div className="font-bold">AI Academic Advisor</div>
            <div className="mt-1 truncate text-xs text-slate-300">
              {currentConversation?.title || "New conversation"}
            </div>
          </div>

          {historyError && (
            <div className="border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">
              {historyError}
            </div>
          )}

          <div className="custom-scrollbar flex-1 overflow-y-auto bg-gray-50 p-4">
            <div className="mx-auto flex max-w-3xl flex-col gap-4">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}

              {isLoading && (
                <p className="text-gray-400 italic animate-pulse">
                  AI is thinking...
                </p>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="border-t bg-white p-3">
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void sendMessage();
                }}
                placeholder={isRecording ? "Listening..." : "Type a message..."}
                className="flex-1 rounded-lg border border-gray-300 bg-gray-50 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-navy-500"
              />

              <button
                onClick={handleSpeechToText}
                disabled={isProcessing || isLoading}
                className={`flex h-10 w-10 items-center justify-center rounded-full transition-all ${
                  isRecording
                    ? "scale-110 animate-pulse bg-red-500 shadow-lg"
                    : "bg-gray-200 hover:bg-gray-300"
                }`}
                title={isRecording ? "Stop recording" : "Start voice input"}
              >
                Mic
              </button>

              <button
                onClick={() => void sendMessage()}
                disabled={isLoading || !input.trim()}
                className="rounded-lg bg-navy-800 px-6 py-2 font-bold text-white transition-all hover:bg-navy-700 disabled:bg-gray-300"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-navy-800 bg-navy-900 text-white shadow-lg">
          <div className="border-b border-navy-800 bg-navy-800 p-4 font-semibold">
            Neo4j Graph Explorer
          </div>

          <div id="graph-section" className="flex-1 bg-white p-2">
            <GraphVisualizer graphData={graph} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvisorPage;
