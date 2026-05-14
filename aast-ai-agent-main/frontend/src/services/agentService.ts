const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000/api";

export const askAgent = async (input: string, cid?: string | null) => {
  let sessionCid = cid === undefined ? localStorage.getItem("agent_cid") : cid;
  const res = await fetch(`${API_BASE}/chatbot/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: input, cid: sessionCid || undefined })
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }

  const response = await res.json();
  console.log("BACKEND RESPONSE:", response);

  if (response.cid) {
    sessionCid = response.cid;
    localStorage.setItem("agent_cid", response.cid);
  }

  return response;
};
