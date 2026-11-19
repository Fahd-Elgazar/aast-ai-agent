import type { User } from "../types";
import { API_BASE } from "../config/api";
import { fetchAndConsumeWithTimeout } from "./httpClient";
import {
  clearAuthSession,
  persistAuthSession,
  type AuthSession,
} from "./authStorage";

type AuthResponse = AuthSession;

async function readAuthResponse(response: Response): Promise<AuthResponse> {
  const payload = await response.json().catch(() => ({})) as Partial<AuthResponse> & { message?: string };
  if (!response.ok) throw new Error(payload.message || `Authentication failed (${response.status})`);
  if (!payload.token || !payload.expiresAt || !payload.user) throw new Error("Authentication response was incomplete");
  return payload as AuthResponse;
}

export async function login(studentId: string, password: string): Promise<AuthSession> {
  const session = await fetchAndConsumeWithTimeout(
    `${API_BASE}/auth/login`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, password }),
    },
    readAuthResponse,
  );
  persistAuthSession(session);
  return session;
}

export async function loginAsGuest(): Promise<AuthSession> {
  const session = await fetchAndConsumeWithTimeout(
    `${API_BASE}/auth/guest`,
    { method: "POST" },
    readAuthResponse,
  );
  persistAuthSession(session);
  return session;
}

export async function validateSession(): Promise<User> {
  return fetchAndConsumeWithTimeout(
    `${API_BASE}/auth/me`,
    {},
    async (response) => {
      const payload = await response.json().catch(() => ({})) as { user?: User };
      if (!response.ok || !payload.user) {
        clearAuthSession();
        throw new Error("Authentication session is no longer valid");
      }
      return payload.user;
    },
  );
}

