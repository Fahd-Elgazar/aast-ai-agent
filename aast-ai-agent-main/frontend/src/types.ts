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
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  cypherQuery?: string;
}
