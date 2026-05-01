const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000/api";

async function post(path: string, body: any, token?: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  return await res.json();
}

/**
 * Login + Signup (unchanged)
 */
export async function login(email: string, password: string) {
  return await post("/auth/login", { email, password });
}

export async function signup(payload: any) {
  return await post("/auth/signup", payload);
}

/**
 * MAIN FIX:
 * Make backend responses match what the new Dashboard expects.
 */
export async function sendMessageToBackend(message: string) {
  const token = localStorage.getItem("token");

  const result = await post("/graph/ask", { question: message }, token);

  // ---- NORMALIZE THE BACKEND RESPONSE ----
  return {
    responseText: result.text || result.answer || "No answer.",
    graphUpdate: result.graph
      ? {
          nodes: result.graph.nodes || [],
          links: (result.graph.links || result.graph.edges || []).map((l: any) => ({
            source: l.source || l.from,
            target: l.target || l.to,
            value: l.value || 1,
          })),
        }
      : null,
  };
}
