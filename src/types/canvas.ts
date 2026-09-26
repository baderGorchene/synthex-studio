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

export const ELEMENT_PALETTE = [
  "#f94144",
  "#f3722c",
  "#f8961e",
  "#f9844a",
  "#f9c74f",
  "#90be6d",
  "#43aa8b",
  "#4d908e",
  "#577590",
  "#277da1",
] as const;

export type ElementPaletteColor = typeof ELEMENT_PALETTE[number];
export type AccentColor = 'neutral' | 'terracotta' | 'sage' | 'cobalt' | 'lavender' | 'rose' | ElementPaletteColor | string;

export function hexToRgba(hex?: string, alpha: number = 1): string {
  if (!hex || !hex.startsWith('#')) return `rgba(60, 110, 113, ${alpha})`;
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.slice(0, 2), 16);
    const g = parseInt(cleanHex.slice(2, 4), 16);
    const b = parseInt(cleanHex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return hex;
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
  fileData?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  pageCount?: number;
  metadata?: {
    origin?: 'user' | 'imported' | 'ai' | 'inferred' | 'example';
    claimStatus?: 'supported' | 'weakly_supported' | 'disputed' | 'contradicted' | 'unverified' | 'open_question' | 'outdated';
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
