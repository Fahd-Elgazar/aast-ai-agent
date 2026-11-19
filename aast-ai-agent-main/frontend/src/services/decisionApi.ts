import type { CareerRoadmap, DecisionConfidenceBreakdown, RecommendationCardData, ScoreBreakdown } from "../types";
import { API_BASE } from "../config/api";
import { validateRecommendationResponse } from "../decision/utils/recommendationTruth";
import { fetchAndConsumeWithTimeout } from "./httpClient";

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
  result_status: "ok" | "no_results";
  recommended_major?: string | null;
  confidence?: number | null;
  reason?: string;
  error?: string;
  error_code?: string;
  warnings?: string[];
  confidence_breakdown?: DecisionConfidenceBreakdown;
  career_roadmap?: CareerRoadmap | null;
  next_steps?: string[];
  score_breakdown?: ScoreBreakdown | null;
  recommendations?: RecommendationCardData[];
  [key: string]: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function getRecommendation(
  data: RecommendationPayload
): Promise<RecommendationResponse> {
  return fetchAndConsumeWithTimeout(
    `${API_BASE}/decision/recommend`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    },
    async (response) => {
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new Error(`Recommendation API returned invalid JSON with status ${response.status}`);
      }

      if (!response.ok) {
        const message = isRecord(body) && typeof body.error === "string" ? body.error : response.statusText;
        throw new Error(`Recommendation API failed (${response.status}): ${message}`);
      }

      if (!validateRecommendationResponse(body)) {
        throw new Error("Recommendation API returned a contradictory or incomplete result");
      }

      return body as RecommendationResponse;
    },
  );
}
