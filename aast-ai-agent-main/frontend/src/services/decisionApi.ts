import type { CareerRoadmap, DecisionConfidenceBreakdown, RecommendationCardData, ScoreBreakdown } from "../types";
import { API_BASE } from "../config/api";
import { fetchWithTimeout } from "./httpClient";

export interface RecommendationPayload {
  studentProfile: {
    high_school_percentage: number;
    budget: number;
    preferred_branch?: string | null;
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
  confidence_breakdown?: DecisionConfidenceBreakdown;
  career_roadmap?: CareerRoadmap | null;
  next_steps?: string[];
  score_breakdown?: ScoreBreakdown;
  recommendations?: RecommendationCardData[];
  [key: string]: unknown;
}

export async function getRecommendation(
  data: RecommendationPayload
): Promise<RecommendationResponse> {
  const res = await fetchWithTimeout(`${API_BASE}/decision/recommend`, {
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
