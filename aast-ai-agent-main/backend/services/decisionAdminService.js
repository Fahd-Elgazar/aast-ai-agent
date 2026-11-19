import fetch from "node-fetch";

const API_URL = process.env.DECISION_API_URL || "http://127.0.0.1:8005";
const SECRET_KEY = process.env.INTERNAL_SECRET_KEY || "your-secret-key-here";

async function requestDecisionAdmin(pathname, { method = "GET", body, authorization } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Number(process.env.DECISION_API_TIMEOUT_MS || 7000)
  );
  let response;
  try {
    response = await fetch(`${API_URL}/api/v1/admin${pathname}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": SECRET_KEY,
        Authorization: authorization,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    const proxyError = new Error(
      error?.name === "AbortError"
        ? "Decision administrator request timed out"
        : "Decision administrator service is unavailable"
    );
    proxyError.status = error?.name === "AbortError" ? 504 : 502;
    throw proxyError;
  } finally {
    clearTimeout(timeout);
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = new Error(payload?.detail || `Decision admin API error: ${response.status}`);
    error.status = response.status;
    throw error;
  }
  if (payload === null) {
    const error = new Error("Decision administrator service returned an invalid response");
    error.status = 502;
    throw error;
  }
  return payload;
}

export function getAdminPrograms(authorization) {
  return requestDecisionAdmin("/programs", { authorization });
}

export function updateAdminProgram(programId, update, authorization) {
  return requestDecisionAdmin(`/programs/${encodeURIComponent(programId)}`, {
    method: "PUT",
    body: update,
    authorization,
  });
}
