import type { CanvasNodeType } from './canvas';

export type ChatToolType =
  | 'research'
  | 'recommend_improvements'
  | 'organize_layout'
  | 'propose_nodes';

export interface ChatResearchToolCall {
  tool: 'research';
  parameters: {
    query: string;
    mode: 'quick' | 'deep';
  };
  isApplied?: boolean;
}

export interface RecommendedConnection {
  fromId: string;
  toId: string;
  fromTitle: string;
  toTitle: string;
  label: string;
  reason: string;
}

export interface GraphAuditAnalysis {
  unverifiedClaims: Array<{ id: string; title: string }>;
  isolatedNodes: Array<{ id: string; title: string; type: CanvasNodeType }>;
  openQuestions: Array<{ id: string; title: string }>;
  suggestedTopics: string[];
  suggestedConnections: RecommendedConnection[];
}

export interface ChatRecommendToolCall {
  tool: 'recommend_improvements';
  parameters: {
    focusArea?: string;
  };
  analysis?: GraphAuditAnalysis;
  isApplied?: boolean;
}

export interface PositionDelta {
  id: string;
  x: number;
  y: number;
}

export interface ChatOrganizeToolCall {
  tool: 'organize_layout';
  parameters: {
    strategy: 'cluster_by_type' | 'hierarchical' | 'compact';
  };
  proposedPositions?: PositionDelta[];
  isApplied?: boolean;
}

export interface ProposedNodeItem {
  title: string;
  type: CanvasNodeType;
  content?: string;
  rationale?: string;
}

export interface ProposedRelationshipItem {
  fromTitle: string;
  toTitle: string;
  label: string;
  evidence?: string;
}

export interface ChatProposeNodesToolCall {
  tool: 'propose_nodes';
  parameters: {
    nodes: ProposedNodeItem[];
    relationships: ProposedRelationshipItem[];
  };
  isApplied?: boolean;
}

export type ChatToolCall =
  | ChatResearchToolCall
  | ChatRecommendToolCall
  | ChatOrganizeToolCall
  | ChatProposeNodesToolCall;
