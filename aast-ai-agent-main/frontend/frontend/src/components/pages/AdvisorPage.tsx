import { useState } from "react";
import GraphVisualizer from "../GraphVisualizer";
import type { ChatMessage, GraphData } from "../../types";
import { sendMessageToBackend } from "../../services/backendService";

const AdvisorPage = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [input, setInput] = useState("");

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      text: input,
      timestamp: new Date()
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    const response = await sendMessageToBackend(input);

    const botMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: "model",
      text: response.answer || "No response",
      timestamp: new Date(),
      hasGraph: !!response.graph
    };

    setMessages((prev) => [...prev, botMessage]);

    if (response.graph) setGraph(response.graph);
  };

  return (
    <div className="grid grid-cols-2 gap-6 h-full">

      {/* CHAT PANEL */}
      <div className="bg-white rounded-xl shadow flex flex-col">
        <div className="p-4 bg-navy-800 text-white font-semibold rounded-t-xl">
          AI Academic Advisor
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`p-3 rounded-lg max-w-[80%] ${
                m.role === "user"
                  ? "ml-auto bg-navy-800 text-white"
                  : "bg-gray-100 border"
              }`}
            >
              {m.text}
            </div>
          ))}
        </div>

        <div className="p-3 flex gap-2 border-t">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 border rounded-lg px-3 py-2"
            placeholder="Ask something..."
          />
          <button
            onClick={sendMessage}
            className="px-4 py-2 bg-gold-400 text-navy-900 rounded-lg"
          >
            Send
          </button>
        </div>
      </div>

      {/* GRAPH PANEL */}
      <div className="bg-navy-900 rounded-xl shadow flex flex-col text-white">
        <div className="p-4 border-b border-navy-700 font-semibold">
          Neo4j Graph Explorer
        </div>
        <div className="flex-1">
          <GraphVisualizer data={graph} />
        </div>
      </div>
    </div>
  );
};

export default AdvisorPage;
