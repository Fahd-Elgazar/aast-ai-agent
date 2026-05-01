import { useEffect, useRef, useState, useCallback } from "react";
import GraphVisualizer from "../GraphVisualizer";
import ChatMessage from "../ChatMessage";
import type { ChatMessage as ChatMessageType, ChatSession, GraphData } from "../../types";
import { saveMessage } from "../../services/backendService";
import { askAgent } from "../../services/agentService";
import { useNavigate } from "react-router-dom";

// 🧠 Welcome message
const buildWelcomeMessage = (): ChatMessageType => ({
  id: "welcome",
  role: "model",
  text: "Hello! I can help with majors, course planning, and academic decisions.",
  timestamp: new Date(),
});

const AdvisorPage = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [graph, setGraph] = useState<GraphData | null>(null);

  // 🎤 Speech States
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);
  
  // 🔥 Crucial: Track input in a ref so the speech 'onend' callback 
  // can read the latest value without stale closures.
  const inputRef = useRef(input);

  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  const currentSession = sessions.find((s) => s.id === currentSessionId);
  const messages = currentSession?.messages || [];

  // 🔄 Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // 📦 Load sessions
  useEffect(() => {
    const saved = localStorage.getItem("chat_sessions");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const hydrated = parsed.map((s: ChatSession) => ({
          ...s,
          messages: s.messages.map((m: ChatMessageType) => ({
            ...m,
            timestamp: new Date(m.timestamp),
          })),
        }));
        setSessions(hydrated);
        if (hydrated.length > 0) {
          setCurrentSessionId(hydrated[0].id);
        } else {
          createNewSession();
        }
      } catch {
        createNewSession();
      }
    } else {
      createNewSession();
    }
  }, []);

  // 💾 Save sessions
  useEffect(() => {
    localStorage.setItem("chat_sessions", JSON.stringify(sessions));
  }, [sessions]);

  // 🆕 Create session
  function createNewSession(): string {
    const newSession: ChatSession = {
      id: crypto.randomUUID(),
      title: "New Chat",
      messages: [buildWelcomeMessage()],
      createdAt: new Date().toISOString(),
    };
    setSessions((prev) => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setGraph(null);
    return newSession.id;
  }

  // 💾 Save message safely
  const safeSaveMessage = async (message: any) => {
    try {
      await saveMessage(message);
    } catch {
      console.warn("Local save only");
    }
  };

  // 🚀 SEND MESSAGE logic (Extracted for reuse)
  const sendMessage = useCallback(async () => {
    // Read from ref to ensure we have the most recent voice transcript
    const userText = inputRef.current.trim();
    if (!userText) return;

    let sessionId = currentSessionId;
    if (!sessionId) sessionId = createNewSession();

    if (userText.toLowerCase() === "open decision chat") {
      navigate("/decision/chat");
      setInput("");
      return;
    }

    const userMessage: ChatMessageType = {
      id: Date.now().toString(),
      role: "user",
      text: userText,
      timestamp: new Date(),
    };

    let newTitle = currentSession?.title;
    if (currentSession?.title === "New Chat") {
      const words = userText.split(/\s+/);
      newTitle = words.slice(0, 5).join(" ") + (words.length > 5 ? "..." : "");
    }

    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? { ...s, title: newTitle || s.title, messages: [...s.messages, userMessage] }
          : s
      )
    );

    safeSaveMessage({
      role: "user",
      text: userText,
      timestamp: new Date().toISOString(),
    });

    setInput(""); // Clear UI
    inputRef.current = ""; // Clear Ref
    setIsLoading(true);

    try {
      const response = await askAgent(userText);
      if (!response || !response.source) return;

      const botMessage: ChatMessageType = {
        id: (Date.now() + 1).toString(),
        role: "model",
        text: response.graph
          ? response.answer + "\n\n👉 Click to visualize graph"
          : response.answer || "No response.",
        timestamp: new Date(),
        source: response.source,
        decision: response.decision ?? undefined,
        hasGraph: !!response.graph,
      };

      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId ? { ...s, messages: [...s.messages, botMessage] } : s
        )
      );

      safeSaveMessage({
        role: "model",
        text: botMessage.text,
        timestamp: new Date().toISOString(),
        source: botMessage.source,
        decision: botMessage.decision,
      });

      setGraph(response.graph);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [currentSessionId, currentSession, navigate]);

  // 🎤 SPEECH-TO-TEXT WITH AUTO-STOP & AUTO-SEND
  const handleSpeechToText = useCallback(() => {
    const SpeechRecognition =
      (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition not supported");
      return;
    }

    if (!recognitionRef.current) {
      const recognition = new SpeechRecognition();
      // continuous: false ensures 'onend' triggers as soon as user stops talking
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
        // 🔥 Trigger send automatically if voice captured text
        if (inputRef.current.trim()) {
          sendMessage();
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
      } catch (err) {
        console.warn("Instance already started");
      }
    }
  }, [isRecording, sendMessage]);

  return (
    <div className="grid h-full grid-cols-[250px_1fr_1fr] gap-6 p-4">
      {/* 🧭 SIDEBAR */}
      <div className="flex flex-col gap-4 bg-navy-900 text-white p-4 rounded-xl">
        <button onClick={createNewSession} className="bg-navy-700 hover:bg-navy-600 p-2 rounded-lg transition-colors">
          + New Chat
        </button>
        <div className="flex-1 overflow-y-auto space-y-2">
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => setCurrentSessionId(s.id)}
              className={`block w-full text-left p-2 rounded transition-colors ${s.id === currentSessionId ? "bg-navy-700" : "hover:bg-navy-800"}`}
            >
              {s.title}
            </button>
          ))}
        </div>
      </div>

      {/* 💬 CHAT AREA */}
      <div className="flex flex-col bg-white rounded-xl shadow overflow-hidden border border-gray-200">
        <div className="bg-navy-800 text-white p-4 font-bold">AI Academic Advisor</div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m) => <ChatMessage key={m.id} message={m} />)}
          {isLoading && <p className="text-gray-400 italic animate-pulse">AI is thinking...</p>}
          <div ref={messagesEndRef} />
        </div>

        <div className="flex items-center gap-2 p-3 border-t bg-gray-50">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder={isRecording ? "Listening..." : "Type a message..."}
            className="flex-1 border border-gray-300 px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 bg-white"
          />

          {/* 🎤 Production Mic Button */}
          <button 
            onClick={handleSpeechToText}
            disabled={isProcessing || isLoading}
            className={`flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300 ${
              isRecording ? 'bg-red-500 animate-pulse shadow-lg scale-110' : 'bg-gray-200 hover:bg-gray-300'
            } ${isProcessing ? 'cursor-wait opacity-50' : ''}`}
            title="Voice Input"
          >
            {isProcessing ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-navy-500 border-t-transparent" />
            ) : isRecording ? (
              <div className="h-3 w-3 bg-white rounded-sm" />
            ) : (
              <span className="text-lg">🎤</span>
            )}
          </button>

          <button 
            onClick={sendMessage} 
            disabled={isLoading || !input.trim()}
            className="bg-gold-400 hover:bg-gold-500 disabled:bg-gray-300 px-6 py-2 rounded-lg font-bold transition-colors"
          >
            Send
          </button>
        </div>
      </div>

      {/* 📊 GRAPH EXPLORER */}
      <div className="bg-navy-900 text-white rounded-xl flex flex-col border border-navy-800">
        <div className="p-4 border-b border-navy-800 font-semibold">Neo4j Graph Explorer</div>
        <div className="flex-1">
          <GraphVisualizer data={graph} />
        </div>
      </div>
    </div>
  );
};

export default AdvisorPage;