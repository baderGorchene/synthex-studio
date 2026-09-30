import React from 'react';
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
      <section className="ai-card">
        <h4>{mode === 'deep' ? 'Deep research' : 'Quick research'}</h4>
        <p className="note-meta">“{query}”</p>
        <div className="ai-card-actions">
          <button
            type="button"
            className="line-button"
            disabled={applied}
            onClick={() => {
              setApplied(true);
              onExecuteResearch?.(query, mode);
            }}
          >
            {applied ? 'Running' : 'Run research'}
          </button>
        </div>
      </section>
    );
  }

  if (toolCall.tool === 'organize_layout') {
    const { strategy } = toolCall.parameters;
    const positions = toolCall.proposedPositions || [];
    const strategyName =
      strategy === 'hierarchical'
        ? 'Top-down layout'
        : strategy === 'compact'
        ? 'Compact grid'
        : 'Grouped by type';
    const done = toolCall.isApplied || applied;

    return (
      <section className="ai-card">
        <h4>{strategyName}</h4>
        <p className="note-meta">{done ? 'Applied · ' : ''}Moves {positions.length} {positions.length === 1 ? 'note' : 'notes'}</p>
        <div className="ai-card-actions">
          <button
            type="button"
            className={done ? 'text-button' : 'line-button'}
            onClick={() => {
              setApplied(true);
              onApplyLayout?.(positions);
            }}
          >
            {done ? 'Apply again' : 'Apply layout'}
          </button>
        </div>
      </section>
    );
  }

  if (toolCall.tool === 'recommend_improvements') {
    const analysis = toolCall.analysis;
    const unverifiedCount = analysis?.unverifiedClaims.length || 0;
    const isolatedCount = analysis?.isolatedNodes.length || 0;
    const questionsCount = analysis?.openQuestions.length || 0;
    const suggestions = analysis?.suggestedConnections || [];

    return (
      <section className="ai-card">
        <h4>Map check</h4>
        <p className="note-meta">
          {unverifiedCount} unverified · {isolatedCount} not linked · {questionsCount} open {questionsCount === 1 ? 'question' : 'questions'}
        </p>
        {suggestions.length > 0 && (
          <div className="ai-card-section">
            <h5>Possible links</h5>
            <ul className="ai-rows">
              {suggestions.slice(0, 3).map((conn, idx) => (
                <li key={idx}>
                  <span><strong>{conn.fromTitle}</strong> → <strong>{conn.toTitle}</strong></span>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => onConnectNodes?.(conn.fromId, conn.toId, conn.label)}
                  >
                    Link
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    );
  }

  if (toolCall.tool === 'propose_nodes') {
    const { nodes = [], relationships = [] } = toolCall.parameters;
    return (
      <section className="ai-card">
        <h4>Suggested ideas</h4>
        <ul className="ai-rows">
          {nodes.map((node, idx) => (
            <li key={idx}>
              <span><strong>{node.title}</strong><span className="note-meta">{node.type}</span></span>
            </li>
          ))}
        </ul>
        <div className="ai-card-actions">
          <button
            type="button"
            className="line-button"
            disabled={applied || nodes.length === 0}
            onClick={() => {
              setApplied(true);
              onAddProposedItems?.(nodes, relationships);
            }}
          >
            {applied ? 'Added' : 'Add to map'}
          </button>
        </div>
      </section>
    );
  }

  return null;
};
