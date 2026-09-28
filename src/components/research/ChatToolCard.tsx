import React from 'react';
import {
  Sparkles,
  Search,
  LayoutGrid,
  Check,
  Plus,
  AlertCircle,
  RotateCcw
} from 'lucide-react';
import type { ChatToolCall } from '@/types/chat-tools';

export interface ChatToolCardProps {
  toolCall: ChatToolCall;
  onExecuteResearch?: (query: string, mode: 'quick' | 'deep') => void;
  onApplyLayout?: (positions: Array<{ id: string; x: number; y: number }>) => void;
  onAddProposedItems?: (
    nodes: Array<{ title: string; type: string; content?: string }>,
    relationships: Array<{ fromTitle: string; toTitle: string; label: string }>
  ) => void;
  onConnectNodes?: (fromId: string, toId: string, label: string) => void;
}

export const ChatToolCard: React.FC<ChatToolCardProps> = ({
  toolCall,
  onExecuteResearch,
  onApplyLayout,
  onAddProposedItems,
  onConnectNodes
}) => {
  const [applied, setApplied] = React.useState(Boolean(toolCall.isApplied));

  if (toolCall.tool === 'research') {
    const { query, mode } = toolCall.parameters;
    return (
      <div className="refined-tool-bar">
        <div className="tool-info-row">
          <Sparkles size={13} className="tool-icon-purple" />
          <div className="tool-col-info">
            <span className="tool-title-row">{mode === 'deep' ? 'Deep Web Research' : 'Quick Research'}</span>
            <span className="tool-query-sub">“{query}”</span>
          </div>
        </div>
        <button
          type="button"
          className="refined-action-btn"
          disabled={applied}
          onClick={() => {
            setApplied(true);
            onExecuteResearch?.(query, mode);
          }}
        >
          {applied ? (
            <>
              <Check size={11} /> Running
            </>
          ) : (
            <>
              <Search size={11} /> Run
            </>
          )}
        </button>
      </div>
    );
  }

  if (toolCall.tool === 'organize_layout') {
    const { strategy } = toolCall.parameters;
    const positions = toolCall.proposedPositions || [];
    const strategyName =
      strategy === 'hierarchical'
        ? 'Hierarchical DAG'
        : strategy === 'compact'
        ? 'Compact Grid'
        : 'Semantic Categories';

    if (toolCall.isApplied || applied) {
      return (
        <div className="refined-applied-strip">
          <span className="applied-pill">
            <Check size={11} /> {strategyName} applied ({positions.length} cards)
          </span>
          <button
            type="button"
            className="refined-micro-btn"
            onClick={() => onApplyLayout?.(positions)}
            title="Re-apply this layout configuration"
          >
            <RotateCcw size={10} /> Re-apply
          </button>
        </div>
      );
    }

    return (
      <div className="refined-tool-bar">
        <div className="tool-info-row">
          <LayoutGrid size={13} className="tool-icon-blue" />
          <span>{strategyName} <strong>({positions.length} cards)</strong></span>
        </div>
        <button
          type="button"
          className="refined-action-btn"
          onClick={() => {
            setApplied(true);
            onApplyLayout?.(positions);
          }}
        >
          <Check size={11} /> Apply Layout
        </button>
      </div>
    );
  }

  if (toolCall.tool === 'recommend_improvements') {
    const analysis = toolCall.analysis;
    const unverifiedCount = analysis?.unverifiedClaims.length || 0;
    const isolatedCount = analysis?.isolatedNodes.length || 0;
    const questionsCount = analysis?.openQuestions.length || 0;
    const suggestions = analysis?.suggestedConnections || [];

    return (
      <div className="refined-audit-card">
        <div className="audit-metrics-row" style={{ margin: 0, gap: '4px' }}>
          {unverifiedCount > 0 && (
            <span className="metric-chip alert" title="Claims needing citations or verification">
              <AlertCircle size={10} /> {unverifiedCount} unverified
            </span>
          )}
          {isolatedCount > 0 && (
            <span className="metric-chip warn" title="Records with no connections">
              {isolatedCount} isolated
            </span>
          )}
          {questionsCount > 0 && (
            <span className="metric-chip info" title="Unanswered research questions">
              {questionsCount} questions
            </span>
          )}
        </div>

        {suggestions.length > 0 && (
          <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #f1f5f9' }}>
            <div className="suggested-links-list">
              {suggestions.slice(0, 3).map((conn, idx) => (
                <div key={idx} className="refined-link-row">
                  <span className="link-names">
                    <strong>{conn.fromTitle}</strong> → <strong>{conn.toTitle}</strong>
                  </span>
                  <button
                    type="button"
                    className="refined-micro-btn"
                    title="Connect these records"
                    onClick={() => onConnectNodes?.(conn.fromId, conn.toId, conn.label)}
                  >
                    <Plus size={10} /> Connect
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (toolCall.tool === 'propose_nodes') {
    const { nodes = [], relationships = [] } = toolCall.parameters;
    return (
      <div className="refined-audit-card">
        <div className="proposed-nodes-list" style={{ margin: 0 }}>
          {nodes.map((node, idx) => (
            <div key={idx} className="proposed-node-chip">
              <span className={`chip-type type-${node.type}`}>{node.type}</span>
              <span className="chip-title">{node.title}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '6px' }}>
          <button
            type="button"
            className="refined-action-btn"
            disabled={applied || nodes.length === 0}
            onClick={() => {
              setApplied(true);
              onAddProposedItems?.(nodes, relationships);
            }}
          >
            {applied ? (
              <>
                <Check size={11} /> Added
              </>
            ) : (
              <>
                <Plus size={11} /> Add to Canvas
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return null;
};
