export type CanvasNodeType =
  | 'concept'
  | 'note'
  | 'source'
  | 'claim'
  | 'question'
  | 'hypothesis'
  | 'image'
  | 'link'
  | 'group'
  | 'research_result'
  | 'task'
  | 'ai_insight'
  | 'section';

export type CanvasTool = 'select' | 'hand' | 'connect' | 'note' | 'task' | 'image' | 'link' | 'section';

export type SectionResizeHandle = 'se' | 's' | 'e' | 'sw' | 'ne' | 'nw' | 'w' | 'n';

export type AccentColor = 'neutral' | 'terracotta' | 'sage' | 'cobalt' | 'lavender' | 'rose';

export interface TaskItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface CanvasNode {
  id: string;
  type: CanvasNodeType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  color?: AccentColor;
  title: string;
  content?: string;
  items?: TaskItem[];
  imageUrl?: string;
  caption?: string;
  url?: string;
  domain?: string;
  description?: string;
  sectionId?: string;
  metadata?: {
    origin?: 'user' | 'imported' | 'ai' | 'inferred' | 'example';
    claimStatus?: 'supported' | 'weakly_supported' | 'disputed' | 'contradicted' | 'unverified' | 'outdated';
    confidence?: number;
    sourceIds?: string[];
    evidence?: Array<{
      sourceId: string;
      excerpt?: string;
      location?: string;
      relation: 'supports' | 'contradicts';
    }>;
    rationale?: string;
    [key: string]: unknown;
  };
  createdAt: number;
}

export type ArrowheadType = 'end' | 'both' | 'start' | 'none';
export type ConnectionLineStyle = 'curved' | 'straight' | 'stepped';
export type ConnectionStrokePattern = 'solid' | 'dashed' | 'dotted';
export type ConnectionColor = 'indigo' | 'emerald' | 'rose' | 'amber' | 'sky' | 'purple' | 'neutral';

export interface Connection {
  id: string;
  from: string;
  to: string;
  label?: string;
  arrowhead?: ArrowheadType;
  lineStyle?: ConnectionLineStyle;
  strokePattern?: ConnectionStrokePattern;
  color?: ConnectionColor;
  animated?: boolean;
  metadata?: {
    confidence?: number;
    evidence?: string;
    sourceId?: string;
    [key: string]: unknown;
  };
}

export interface ConnectionPath extends Connection {
  path: string;
  mid: { x: number; y: number };
}

export type ThemeMode = 'light' | 'dark';

export interface ThemeTokens {
  canvasBg: string;
  dotColor: string;
  cardBase: string;
  cardBorder: string;
  cardBorderHover: string;
  cardSelected: string;
  headerText: string;
  bodyText: string;
  subText: string;
  panelBg: string;
  toolHover: string;
  tagBg: string;
  connectorStroke: string;
  connectorActive: string;
}

export interface AccentSwatch {
  name: string;
  badge: string;
  lightBorder: string;
  darkBorder: string;
  lightHeader: string;
  darkHeader: string;
}

export interface LedgerState {
  monthlyBudgetUsd: number;
  spentUsd: number;
  costPerRun: number;
}

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastMessage {
  id: number;
  msg: string;
  type: ToastType;
}

export type AiActionType = 'summarize' | 'expand' | 'generate-tasks' | 'critique';

export interface Coordinates {
  x: number;
  y: number;
}

export interface ResearchBlueprint {
  topicSummary: string;
  nodes: Array<{
    tempId: string;
    type: CanvasNodeType;
    title: string;
    content?: string;
    color?: AccentColor;
    col: number;
    row: number;
    taskItems?: string[];
    linkUrl?: string;
    linkDomain?: string;
  }>;
  connections: Array<{
    fromTempId: string;
    toTempId: string;
    label: string;
  }>;
}

export type ResearchMode = 'quick' | 'deep';
export type ResearchChangeStatus = 'pending' | 'accepted' | 'rejected';

export interface ResearchChange {
  id: string;
  kind: 'node' | 'relationship';
  payload: CanvasNode | Connection;
  status: ResearchChangeStatus;
  rationale?: string;
}

export interface ResearchSession {
  id: string;
  query: string;
  mode: ResearchMode;
  status: 'review' | 'complete';
  summary: string;
  trail: string[];
  changes: ResearchChange[];
  createdAt: number;
}
