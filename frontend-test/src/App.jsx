import React, { useEffect, useState, useRef } from "react";
import axios from "axios";

/*
  Simple chat frontend:
  - baseUrl: the backend base (set to e.g. http://localhost:5002 for meili-mode)
  - It calls POST {baseUrl}/api/chatbot/query
  - It also provides health checks:
      GET {baseUrl}/api/meili/check
      GET http://localhost:5001/api/neo4j/check  (neo mode)
      GET http://localhost:5000/api/mysql/check  (sql mode)
*/

export default function App() {
  const [baseUrl, setBaseUrl] = useState("http://localhost:8000"); // default run meili backend
  const [neoUrl, setNeoUrl] = useState("http://localhost:5001");
  const [sqlUrl, setSqlUrl] = useState("http://localhost:5000");

  const [messages, setMessages] = useState([
    { id: 0, role: "system", text: "AAST chatbot — ready" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [debugJson, setDebugJson] = useState(null);
  const [health, setHealth] = useState({ meili: null, neo: null, sql: null });
  const idRef = useRef(1);

  useEffect(() => {
    // Optional: autoscroll to last message
    const el = document.querySelector(".messages");
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  function pushMessage(role, text) {
    const id = idRef.current++;
    setMessages((m) => [...m, { id, role, text }]);
  }

  async function sendMessage() {
    if (!input.trim()) return;
    const q = input.trim();
    pushMessage("user", q);
    setInput("");
    setLoading(true);

    try {
      const resp = await axios.post(`${baseUrl}/api/chatbot/query`, {
        query: q,
        debug: true,
      }, { timeout: 30000 });

      // Response expected: { answer, source, provenance }
      const data = resp.data;
      pushMessage("assistant", data.answer || JSON.stringify(data).slice(0, 1000));
      setDebugJson(data);
    } catch (err) {
      console.error(err);
      const messageText = err.response?.data?.error || err.message || "Network error";
      pushMessage("assistant", `Error: ${messageText}`);
      setDebugJson(err.response?.data || { message: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function healthCheck() {
    // check meili (use baseUrl)
    try {
      const r = await axios.get(`${baseUrl}/api/meili/check`, { timeout: 3000 });
      setHealth((h) => ({ ...h, meili: { ok: true, raw: r.data } }));
    } catch (e) {
      setHealth((h) => ({ ...h, meili: { ok: false, err: e.message } }));
    }
    // neo
    try {
      const r2 = await axios.get(`${neoUrl}/api/neo4j/check`, { timeout: 3000 });
      setHealth((h) => ({ ...h, neo: { ok: true, raw: r2.data } }));
    } catch (e) {
      setHealth((h) => ({ ...h, neo: { ok: false, err: e.message } }));
    }
    // sql
    try {
      const r3 = await axios.get(`${sqlUrl}/api/mysql/check`, { timeout: 3000 });
      setHealth((h) => ({ ...h, sql: { ok: true, raw: r3.data } }));
    } catch (e) {
      setHealth((h) => ({ ...h, sql: { ok: false, err: e.message } }));
    }
  }

  async function addExampleFAQ() {
    // small example to index into Meili via backend
    try {
      const doc = {
        indexName: "faq",
        documents: [
          { id: "faq_1", question: "How to register for AI course?", answer: "Open the portal and fill the form." },
          { id: "faq_2", question: "What are the graduation requirements?", answer: "Complete 180 credits and pass the project." }
        ]
      };
      const r = await axios.post(`${baseUrl}/api/search/add`, doc);
      pushMessage("assistant", `Indexed example FAQ (updateId: ${JSON.stringify(r.data)})`);
    } catch (err) {
      pushMessage("assistant", `Indexing failed: ${err.message}`);
    }
  }

  return (
    <div className="wrap">
      <header>
        <h1>AAST Chat UI</h1>
        <div className="urls">
          <label>Backend base URL:
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
          </label>
          <label>Neo URL:
            <input value={neoUrl} onChange={(e) => setNeoUrl(e.target.value)} />
          </label>
          <label>SQL URL:
            <input value={sqlUrl} onChange={(e) => setSqlUrl(e.target.value)} />
          </label>
          <button onClick={healthCheck}>Run Health Check</button>
          <button onClick={addExampleFAQ}>Add example FAQ</button>
        </div>
      </header>

      <main>
        <section className="left">
          <div className="messages">
            {messages.map((m) => (
              <div key={m.id} className={`message ${m.role}`}>
                <div className="bubble">
                  <div className="role">{m.role}</div>
                  <div className="text">{m.text}</div>
                </div>
              </div>
            ))}
            {loading && <div className="message assistant"><div className="bubble">Thinking...</div></div>}
          </div>

          <div className="composer">
            <textarea
              placeholder="Type your message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            />
            <div className="controls">
              <button onClick={sendMessage} disabled={loading}>Send</button>
            </div>
          </div>
        </section>

        <aside className="right">
          <div className="panel">
            <h3>Health</h3>
            <pre>{JSON.stringify(health, null, 2)}</pre>
          </div>

          <div className="panel">
            <h3>Debug / Raw</h3>
            <pre>{JSON.stringify(debugJson, null, 2)}</pre>
          </div>

          <div className="panel">
            <h3>Quick Links</h3>
            <ul>
              <li><a href={`${baseUrl}/api/meili/check`} target="_blank">Meili check</a></li>
              <li><a href={`${neoUrl}/api/neo4j/check`} target="_blank">Neo4j check</a></li>
              <li><a href={`${sqlUrl}/api/mysql/check`} target="_blank">MySQL check</a></li>
            </ul>
          </div>
        </aside>
      </main>
    </div>
  );
}
