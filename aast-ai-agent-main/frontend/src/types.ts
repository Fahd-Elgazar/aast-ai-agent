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
  confidence_breakdown?: any;
  next_steps?: string[];
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
