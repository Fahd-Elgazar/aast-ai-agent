import React, { useEffect, useRef, useState } from "react";
import type { User, ChatMessage, GraphData } from "../types";
import GraphVisualizer from "./GraphVisualizer";
import { sendMessageToAdvisor } from "../services/fakeAdvisor"; // keep this service or point to your backend

const DEMO_GRAPH: GraphData = {
  cypherQuery: "MATCH (n)-[r]->(m) RETURN n,r,m LIMIT 20",
  nodes: [
    { id: "You", group: 1, label: "You" },
    { id: "Courses", group: 2, label: "Courses" },
    { id: "CV", group: 2, label: "Computer Vision" },
    { id: "AI", group: 2, label: "Selected Topics in AI" },
  ],
  links: [
    { source: "You", target: "Courses", value: 1 },
    { source: "You", target: "CV", value: 1 },
    { source: "You", target: "AI", value: 1 },
  ],
};

interface DashboardProps {
  user: User;
  onLogout: () => void;
  isGuest?: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout, isGuest = false }) => {
  const [currentTab, setCurrentTab] = useState<"HOME" | "ADVISOR">("HOME");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "model",
      text: `Welcome back${user?.name ? ", " + user.name.split(" ")[0] : ""}! I am your AI Academic Advisor. Ask me about courses, schedules or request a knowledge graph.`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [graphData, setGraphData] = useState<GraphData | null>(DEMO_GRAPH);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // if guest, open advisor directly
    if (isGuest) setCurrentTab("ADVISOR");
  }, [isGuest]);

  useEffect(() => {
    // scroll chat to bottom
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentTab]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      text: input,
      timestamp: new Date(),
    };
    setMessages((p) => [...p, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // sendMessageToAdvisor must return { responseText, graphUpdate? }
      const res = await sendMessageToAdvisor(userMsg.text, `User:${user.name}|Major:${user.major}`);
      const modelMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "model",
        text: res?.responseText ?? "Sorry, no answer available.",
        timestamp: new Date(),
        hasGraph: !!res?.graphUpdate,
      };
      setMessages((p) => [...p, modelMsg]);

      if (res?.graphUpdate) {
        setGraphData(res.graphUpdate);
      }
    } catch (err) {
      setMessages((p) => [
        ...p,
        {
          id: (Date.now() + 2).toString(),
          role: "model",
          text: "Server error — please try again.",
          timestamp: new Date(),
        },
      ]);
      console.error("send error", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar minimal */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r">
        <div className="p-6 border-b">
          <div className="font-bold text-lg">UniPortal AI</div>
        </div>
        <div className="p-6 text-center bg-navy-900 text-white">
          <img src={user.avatarUrl} alt="avatar" className="w-16 h-16 rounded-full mx-auto mb-2 object-cover" />
          <div className="font-semibold">{user.name}</div>
          <div className="text-xs text-gray-300">{user.major}</div>
        </div>
        <nav className="p-4 space-y-1 flex-1">
          <button onClick={() => setCurrentTab("HOME")} className={`w-full text-left px-4 py-2 rounded ${currentTab === "HOME" ? "bg-navy-50" : "hover:bg-gray-50"}`}>Home</button>
          <button onClick={() => setCurrentTab("ADVISOR")} className={`w-full text-left px-4 py-2 rounded ${currentTab === "ADVISOR" ? "bg-navy-50" : "hover:bg-gray-50"}`}>AI Advisor</button>
        </nav>
        <div className="p-4 border-t">
          <button onClick={onLogout} className="w-full text-red-500">Logout</button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 flex items-center justify-between px-6 bg-white border-b">
          <h2 className="font-bold">{currentTab === "HOME" ? "Dashboard" : "AI Advisor"}</h2>
          <div className="flex items-center gap-4">
            <input placeholder="Search services..." className="hidden md:block border rounded-full px-3 py-2 w-64 text-sm" />
            <button onClick={onLogout} className="px-3 py-2 bg-gray-100 rounded">Logout</button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden p-6">
          {currentTab === "HOME" && (
            <div>
              <div className="bg-gradient-to-r from-navy-900 to-blue-900 text-white p-8 rounded-lg mb-6 shadow">
                <h3 className="text-2xl font-bold">Welcome back, {user.name.split(" ")[0]}!</h3>
                <p className="text-sm text-blue-100 mt-2">You have upcoming assignments and schedule updates.</p>
                <button onClick={() => setCurrentTab("ADVISOR")} className="mt-4 bg-gold-500 px-4 py-2 rounded text-navy-900 font-semibold">Ask AI Advisor</button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {["Student Results","Schedule","Transcript","Moodle"].map((s) => (
                  <div key={s} className="bg-white p-4 rounded shadow text-sm">{s}</div>
                ))}
              </div>
            </div>
          )}

          {currentTab === "ADVISOR" && (
            <div className="h-[calc(100vh-6rem)] grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* CHAT */}
              <div className="flex flex-col bg-white rounded-lg shadow border overflow-hidden">
                <div className="p-4 bg-navy-900 text-white flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gold-400 flex items-center justify-center">★</div>
                    <div>
                      <div className="font-bold">AI Academic Advisor</div>
                      <div className="text-xs text-blue-200">Online & Ready</div>
                    </div>
                  </div>
                  <div className="text-xs text-white/70">Gemini 2.5</div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                  {messages.map((m) => (
                    <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] p-3 rounded ${m.role === "user" ? "bg-navy-800 text-white" : "bg-white border"}`}>
                        <div className="text-sm">{m.text}</div>
                        <div className="text-[10px] text-gray-400 mt-2">{m.timestamp.toLocaleTimeString([], {hour: "2-digit", minute:"2-digit"})}</div>
                      </div>
                    </div>
                  ))}
                  {loading && <div className="text-sm text-gray-500">Assistant is typing...</div>}
                  <div ref={messagesEndRef}></div>
                </div>

                <div className="p-4 bg-white border-t">
                  <div className="flex gap-2">
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSend()}
                      className="flex-1 border rounded px-3 py-2"
                      placeholder="Ask about grades, schedule, or request a graph..."
                    />
                    <button onClick={handleSend} className="bg-navy-900 text-white px-4 py-2 rounded">Send</button>
                  </div>
                </div>
              </div>

              {/* GRAPH (Neo4j visualizer) */}
              <div className="flex flex-col h-full">
                <div className="p-4 bg-navy-950 rounded-t-lg text-gold-400 flex items-center justify-between border border-navy-800">
                  <div className="font-mono font-bold">Knowledge Graph</div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setGraphData(DEMO_GRAPH)} className="text-xs px-2 py-1 rounded bg-navy-800 text-gold-300">Run Demo</button>
                    <div className="text-xs text-green-400">ACTIVE</div>
                  </div>
                </div>
                <div className="flex-1 bg-navy-900 rounded-b-lg border border-navy-800 overflow-hidden">
                  <GraphVisualizer data={graphData} />
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
