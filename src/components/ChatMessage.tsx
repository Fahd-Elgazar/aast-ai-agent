import DecisionCard from "./DecisionCard";
import type { ChatMessage as ChatMessageType } from "../types";

interface ChatMessageProps {
  message: ChatMessageType;
}

const ChatMessage = ({ message }: ChatMessageProps) => {
  const isUser = message.role === "user";

  // 🔊 Text-to-Speech
  const handleSpeak = () => {
    if (!message.text) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(message.text);
    utterance.lang = "en-US";
    window.speechSynthesis.speak(utterance);
  };

  // 📊 Scroll to Graph
  const handleShowGraph = () => {
    const graphSection = document.getElementById("graph-section");
    if (graphSection) {
      graphSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl p-3 shadow-sm ${isUser
            ? "bg-navy-800 text-white"
            : "border border-slate-200 bg-white text-slate-900"
          }`}
      >
        {/* 🧠 Decision Rendering */}
        {message.source === "decision" && message.decision ? (
          <DecisionCard data={message.decision} />
        ) : (
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              {/* 💬 Message */}
              <p className="whitespace-pre-wrap text-sm leading-6">
                {message.text}
              </p>

              {/* 📊 Graph Button */}
              {message.hasGraph && (
                <button
                  onClick={handleShowGraph}
                  className="mt-2 text-xs text-blue-600 hover:underline"
                >
                  👉 Show Graph
                </button>
              )}

              {/* ⏱ Timestamp */}
              <p
                className={`mt-2 text-[10px] ${isUser ? "text-slate-200" : "text-slate-400"
                  }`}
              >
                {message.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>

            {/* 🔊 Speak Button */}
            {!isUser && (
              <button
                type="button"
                onClick={handleSpeak}
                className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                aria-label="Read message aloud"
                title="Read message aloud"
              >
                🔊
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;