import type { User } from "../types";

const AUTH_SESSION_STORAGE_KEY = "aast_ai_agent_auth_session";

export interface AuthSession {
  token: string;
  expiresAt: string;
  user: User;
}

export function readAuthSession(): AuthSession | null {
  try {
    const raw = sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (
      typeof parsed.token !== "string" ||
      typeof parsed.expiresAt !== "string" ||
      !parsed.user ||
      typeof parsed.user.subject !== "string" ||
      !["student", "guest", "admin"].includes(parsed.user.role)
    ) {
      clearAuthSession();
      return null;
    }
    if (Date.parse(parsed.expiresAt) <= Date.now()) {
      clearAuthSession();
      return null;
    }
    return parsed as AuthSession;
  } catch {
    clearAuthSession();
    return null;
  }
}

export function persistAuthSession(session: AuthSession) {
  sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
  localStorage.removeItem("agent_cid");
  localStorage.removeItem("aast_ai_agent_user");
  localStorage.removeItem("aast_ai_agent_is_guest");
}

export function clearAuthSession() {
  sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  localStorage.removeItem("agent_cid");
  localStorage.removeItem("aast_ai_agent_user");
  localStorage.removeItem("aast_ai_agent_is_guest");
}

export function getAccessToken(): string | null {
  return readAuthSession()?.token || null;
}

export function getAuthSubject(): string {
  return readAuthSession()?.user.subject || "anonymous";
}

export function getAuthorizationHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
