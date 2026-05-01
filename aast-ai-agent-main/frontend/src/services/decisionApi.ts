const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000/api";

export interface RecommendationPayload {
  studentProfile: {
    high_school_percentage: number;
    budget: number;
  };
  preferences: {
    interests: string[];
  };
}

export interface RecommendationResponse {
  success: boolean;
  recommended_major?: string;
  confidence?: number;
  reason?: string;
  warnings?: string[];
  confidence_breakdown?: {
    grades_score?: number;
    interests_score?: number;
    market_score?: number;
  };
  career_roadmap?: unknown;
  next_steps?: string[];
  recommendations?: unknown[];
  [key: string]: unknown;
}

export async function getRecommendation(
  data: RecommendationPayload
): Promise<RecommendationResponse> {
  const res = await fetch(`${API_BASE}/decision/recommend`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  let body: RecommendationResponse;
  try {
    body = (await res.json()) as RecommendationResponse;
  } catch {
    throw new Error(`Recommendation API returned invalid JSON with status ${res.status}`);
  }

  if (!res.ok) {
    const message = typeof body.error === "string" ? body.error : res.statusText;
    throw new Error(`Recommendation API failed (${res.status}): ${message}`);
  }

  return body;
}
