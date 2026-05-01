export enum DashboardView {
  HOME = 'HOME',
  ADVISOR = 'ADVISOR',
  COURSES = 'COURSES',
  RESULTS = 'RESULTS',
}

export interface User {
  name: string;
  major: string;
  studentId: string;
  avatarUrl: string;
}

/* CHAT MESSAGE TYPE */
export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  hasGraph?: boolean;
}

/* GRAPH NODE */
export interface GraphNode {
  id: string;
  label?: string;
  group: number;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

/* GRAPH LINK */
export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  value?: number;
}

/* FULL GRAPH DATA */
export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  cypherQuery?: string;
}
