import { API_BASE } from "../config/api";
import { fetchWithTimeout } from "./httpClient";

export const askAgent = async (input: string, cid?: string | null) => {
  let sessionCid = cid === undefined ? localStorage.getItem("agent_cid") : cid;
  const res = await fetchWithTimeout(`${API_BASE}/chatbot/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: input, cid: sessionCid || undefined })
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }

  const response = await res.json();

  if (response.cid) {
    sessionCid = response.cid;
    localStorage.setItem("agent_cid", response.cid);
  }

  return response;
};
