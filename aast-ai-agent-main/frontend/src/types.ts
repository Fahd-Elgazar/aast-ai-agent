export const DASHBOARD_VIEWS = {
  HOME: "HOME",
  ADVISOR: "ADVISOR",
  COURSES: "COURSES",
  RESULTS: "RESULTS",
} as const;

export type DashboardView = typeof DASHBOARD_VIEWS[keyof typeof DASHBOARD_VIEWS];

export interface User {
  name: string;
  major: string;
  studentId: string;
  avatarUrl: string;
}

export interface ScoreBreakdown {
  interest_alignment: number;
  affordability: number;
  employment_outlook: number;
  location_preference: number;
  career_flexibility: number;
  certificate_compatibility: number;
  decision_data_completeness: number;
  missing_data_penalty: number;
}

export interface DecisionConfidenceBreakdown {
  grades_score?: number;
  interests_score?: number;
  market_score?: number;
  [key: string]: number | string | boolean | null | undefined;
}

export interface LearningPathStep {
  skill: string;
  steps: string[];
}

export interface CareerRoadmap {
  target_roles: string[];
  top_skills: string[];
  industry_demand: string;
  learning_path?: LearningPathStep[];
}

export interface DecisionData {
  recommended_major: string;
  confidence: number;
  reason: string;
  warnings: string[];
  pros?: string[];
  cons_and_risks?: string[];
  alternatives?: string[];
  career_roadmap?: CareerRoadmap | null;
  confidence_breakdown?: DecisionConfidenceBreakdown;
  next_steps?: string[];
}

export interface DecisionLike {
  recommended_major?: string;
  college_name?: string;
  confidence?: number;
  match_type?: string;
  estimated_semester_fee?: number;
  currency?: string;
  fee_mode?: string;
  affordability_label?: string;
  score_breakdown?: ScoreBreakdown;
  confidence_breakdown?: DecisionConfidenceBreakdown;
  warnings?: string[];
  reason?: string;
  career_roadmap?: CareerRoadmap | null;
  next_steps?: string[];
  [key: string]: unknown;
}

export interface RecommendationCardData {
  program_id?: string;
  program_name: string;
  college_name: string;
  score: number;
  match_type: string;
  confidence_level: string;
  estimated_semester_fee: number | null;
  currency: string;
  fee_mode: string;
  affordability_label: string;
  score_breakdown: ScoreBreakdown;
  warnings: string[];
  career_roadmap?: CareerRoadmap | null;
  next_steps?: string[];
}

export interface AgentDecisionResponse {
  answer?: string;
  recommendations?: RecommendationCardData[];
  decision?: DecisionLike;
}

export interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
  timestamp: Date;
  hasGraph?: boolean;
  source?: string;
  decision?: DecisionData;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
}

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant" | "model";
  content?: string;
  text?: string;
  createdAt?: string;
}

export interface ConversationSummary {
  cid: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastActive: number;
  pinned: boolean;
  titleGenerated?: boolean;
  titleSource?: "auto" | "manual" | string;
  messageCount: number;
  preview?: string;
  lastRoute?: string | null;
}

export interface ConversationDetail extends ConversationSummary {
  messages: ConversationMessage[];
}

export interface GraphNode {
  id: string;
  label?: string;
  group?: number;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphLink {
  source: string;
  target: string;
  type?: string;
  value?: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  cypherQuery?: string;
}
