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

  useEffect(() => {
    setGraph({
      nodes: [
        { id: "1", label: "Student" },
        { id: "2", label: "AI" },
        { id: "3", label: "Machine Learning" }
      ],
      links: [
        { source: "1", target: "2", type: "INTERESTED_IN" },
        { source: "2", target: "3", type: "INCLUDES" }
      ]
    });
  }, []);

  // 🎤 Speech States
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);
  
  const inputRef = useRef(input);

  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  const currentSession = sessions.find((s) => s.id === currentSessionId);
  const messages = currentSession?.messages || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

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

  useEffect(() => {
    localStorage.setItem("chat_sessions", JSON.stringify(sessions));
  }, [sessions]);

  function createNewSession(): string {
    const newSession: ChatSession = {
      id: crypto.randomUUID(),
      title: "New Chat",
      messages: [buildWelcomeMessage()],
      createdAt: new Date().toISOString(),
    };
    setSessions((prev) => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    return newSession.id;
  }

  const safeSaveMessage = async (message: any) => {
    try {
      await saveMessage(message);
    } catch {
      console.warn("Local save only");
    }
  };

  const sendMessage = useCallback(async () => {
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

    setInput("");
    inputRef.current = "";
    setIsLoading(true);

    try {
      const response = await askAgent(userText);

      console.log("Agent Response:", response);

      if (!response) {
        throw new Error("No response from backend");
      }

      const botMessage: ChatMessageType = {
        id: (Date.now() + 1).toString(),
        role: "model",
        text: response.graph
          ? response.answer + "\n\n👉 Click to visualize graph"
          : response.answer || "No response.",
        timestamp: new Date(),
        source: response.source || response.route || "AI",
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

  const handleSpeechToText = useCallback(() => {
    const SpeechRecognition =
      (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition not supported");
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
    /* 
      THE ULTIMATE FIX:
      1. mt-[110px]: Physically moves the container down from the top so it doesn't hide behind the header.
      2. h-[calc(100vh-130px)]: Sets height to the viewport minus the header and a bit extra for the bottom gap.
      3. flex: Used a wrapper to ensure the grid doesn't try to occupy space it shouldn't.
    */
    <div className="flex flex-col w-full h-screen overflow-hidden bg-gray-50">
      <div 
        className="grid grid-cols-[250px_1.6fr_1fr] gap-4 p-4 mt-[110px] w-full"
        style={{ height: 'calc(100vh - 130px)' }}
      >
        {/* 🧭 SIDEBAR */}
        <div className="flex flex-col bg-navy-900 text-white p-4 rounded-xl h-full shadow-lg">
          <button
            onClick={createNewSession}
            className="bg-navy-700 hover:bg-navy-600 p-2 rounded-lg transition-colors mb-4 font-semibold"
          >
            + New Chat
          </button>

          <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => setCurrentSessionId(s.id)}
                className={`block w-full text-left p-3 rounded-lg transition-colors ${
                  s.id === currentSessionId
                    ? "bg-navy-700 border-l-4 border-gold-400"
                    : "hover:bg-navy-800"
                }`}
              >
                {s.title}
              </button>
            ))}
          </div>
        </div>

        {/* 💬 CHAT AREA */}
        <div className="flex flex-col bg-white rounded-xl shadow-xl border border-gray-200 h-full overflow-hidden">
          {/* HEADER */}
          <div className="bg-navy-800 text-white p-4 font-bold">
            AI Academic Advisor
          </div>

          {/* MESSAGES */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((m) => (
              <ChatMessage key={m.id} message={m} />
            ))}

            {isLoading && (
              <p className="text-gray-400 italic animate-pulse">
                AI is thinking...
              </p>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* INPUT */}
          <div className="p-3 border-t bg-white">
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder={isRecording ? "Listening..." : "Type a message..."}
                className="flex-1 border border-gray-300 px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 bg-gray-50"
              />

              <button
                onClick={handleSpeechToText}
                disabled={isProcessing || isLoading}
                className={`flex h-10 w-10 items-center justify-center rounded-full transition-all ${
                  isRecording
                    ? "bg-red-500 animate-pulse scale-110 shadow-lg"
                    : "bg-gray-200 hover:bg-gray-300"
                }`}
              >
                🎤
              </button>

              <button
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                className="bg-navy-800 text-white hover:bg-navy-700 disabled:bg-gray-300 px-6 py-2 rounded-lg font-bold transition-all"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        {/* 📊 GRAPH EXPLORER */}
        <div className="flex flex-col bg-navy-900 text-white rounded-xl border border-navy-800 h-full shadow-lg overflow-hidden">
          {/* HEADER */}
          <div className="p-4 border-b border-navy-800 font-semibold bg-navy-800">
            Neo4j Graph Explorer
          </div>

          {/* GRAPH */}
          <div className="flex-1 p-2 bg-white">
            <GraphVisualizer graphData={graph} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvisorPage;