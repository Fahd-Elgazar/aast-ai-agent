import { Bot, Clock3, Network, UserRound, Volume2 } from "lucide-react";
import DecisionCard from "./DecisionCard";
import type { ChatMessage as ChatMessageType } from "../types";

interface ChatMessageProps {
  message: ChatMessageType;
}

function formatMessageTime(timestamp: Date) {
  const safeDate = timestamp instanceof Date && !Number.isNaN(timestamp.getTime()) ? timestamp : new Date(timestamp);
  return safeDate.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ChatMessage = ({ message }: ChatMessageProps) => {
  const isUser = message.role === "user";

  const handleSpeak = () => {
    if (!message.text) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(message.text);
    utterance.lang = "en-US";
    window.speechSynthesis.speak(utterance);
  };

  const handleShowGraph = () => {
    const graphSection = document.getElementById("graph-section");
    if (graphSection) {
      graphSection.scrollIntoView({ behavior: "smooth" });
    }
    window.dispatchEvent(new Event("aast-show-graph"));
  };

  return (
    <div className={`flex items-end gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-900 text-gold-300 shadow-sm">
          <Bot className="h-4 w-4" aria-hidden="true" />
        </div>
      )}

      <div
        className={`max-w-[88%] rounded-2xl px-4 py-3 shadow-sm ${
          isUser
            ? "rounded-br-md bg-navy-900 text-white shadow-navy-900/15"
            : "rounded-bl-md border border-slate-200 bg-white text-slate-900 shadow-slate-900/5"
        }`}
      >
        {message.source === "decision" && message.decision ? (
          <DecisionCard data={message.decision} />
        ) : (
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="whitespace-pre-wrap text-sm leading-6">
                {message.text}
              </p>

              {message.hasGraph && (
                <button
                  type="button"
                  onClick={handleShowGraph}
                  className="mt-3 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 transition hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                >
                  <Network className="h-3.5 w-3.5" aria-hidden="true" />
                  Open graph evidence
                </button>
              )}

              <p
                className={`mt-3 flex items-center gap-1.5 text-[11px] font-medium ${
                  isUser ? "text-slate-200" : "text-slate-400"
                }`}
              >
                <Clock3 className="h-3 w-3" aria-hidden="true" />
                {formatMessageTime(message.timestamp)}
              </p>
            </div>

            {!isUser && (
              <button
                type="button"
                onClick={handleSpeak}
                className="rounded-full border border-slate-200 p-2 text-slate-400 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                aria-label="Read message aloud"
                title="Read message aloud"
              >
                <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>

      {isUser && (
        <div className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold-100 text-navy-900 shadow-sm">
          <UserRound className="h-4 w-4" aria-hidden="true" />
        </div>
      )}
    </div>
  );
};

export default ChatMessage;
