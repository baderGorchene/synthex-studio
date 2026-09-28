import React from 'react';
import {
  Sparkles,
  Zap,
  Globe,
  Search,
  Check,
  LoaderCircle,
  BookOpenText,
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import type { ResearchSession } from '@/types/canvas';

export interface ResearchLiveProgress {
  mode: 'quick' | 'deep';
  query: string;
  steps: Array<{ id: string; label: string; status: 'pending' | 'running' | 'done' }>;
  queries: string[];
  sources: Array<{ title: string; url: string; domain?: string; snippet?: string }>;
  session?: ResearchSession;
  isComplete?: boolean;
}

export interface LiveResearchCardProps {
  progress: ResearchLiveProgress;
  onOpenReview: (session: ResearchSession) => void;
}

export const LiveResearchCard: React.FC<LiveResearchCardProps> = ({
  progress,
  onOpenReview
}) => {
  const isDeep = progress.mode === 'deep';
  const completedSteps = progress.steps.filter(s => s.status === 'done').length;
  const totalSteps = progress.steps.length;

  return (
    <div className={`chat-live-research-card ${progress.isComplete ? 'complete' : 'active'}`}>
      {/* Header bar */}
      <div className="live-research-header">
        <div className="live-research-title-group">
          <div className={`live-research-badge ${isDeep ? 'deep' : 'quick'}`}>
            {isDeep ? <Sparkles size={13} /> : <Zap size={13} />}
            <span>{isDeep ? 'Deep Research' : 'Quick Research'}</span>
          </div>
          <span className="live-research-query-title" title={progress.query}>
            “{progress.query}”
          </span>
        </div>
        <div className="live-research-status-pill">
          {progress.isComplete ? (
            <span className="status-complete">
              <Check size={11} /> Complete
            </span>
          ) : (
            <span className="status-running">
              <LoaderCircle size={11} className="spin" /> Step {completedSteps + 1}/{totalSteps}
            </span>
          )}
        </div>
      </div>

      {/* Intermediate Steps Progression */}
      <div className="live-research-steps-container">
        <div className="live-steps-timeline">
          {progress.steps.map((step, idx) => (
            <div key={step.id || idx} className={`live-step-row ${step.status}`}>
              <div className="live-step-bullet">
                {step.status === 'done' ? (
                  <Check size={11} className="step-icon-done" />
                ) : step.status === 'running' ? (
                  <LoaderCircle size={11} className="spin step-icon-running" />
                ) : (
                  <span className="step-bullet-pending" />
                )}
              </div>
              <span className="live-step-label">{step.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Live Formulated Search Queries */}
      {progress.queries.length > 0 && (
        <div className="live-queries-section">
          <span className="live-section-subtitle">Search Formulations</span>
          <div className="live-queries-chips">
            {progress.queries.map((q, idx) => (
              <span key={idx} className="live-query-chip" title={q}>
                <Search size={10} /> {q}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Live Discovered Sources */}
      {progress.sources.length > 0 && (
        <div className="live-sources-section">
          <div className="live-sources-header">
            <span className="live-section-subtitle">
              Discovered Grounded Sources ({progress.sources.length})
            </span>
            {!progress.isComplete && <span className="streaming-badge">Streaming live</span>}
          </div>
          <div className="live-sources-grid">
            {progress.sources.map((src, idx) => {
              let domain = '';
              try {
                domain = new URL(src.url).hostname.replace(/^www\./, '');
              } catch {
                domain = '';
              }
              return (
                <a
                  key={idx}
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="live-source-card"
                  title={src.title}
                >
                  <Globe size={11} className="source-domain-icon" />
                  <div className="source-card-text">
                    <span className="source-card-title">{src.title || src.url}</span>
                    {domain && <span className="source-card-domain">{domain}</span>}
                  </div>
                  <ExternalLink size={10} className="external-link-arrow" />
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Review Drawer CTA when finished */}
      {progress.isComplete && progress.session && (
        <div className="live-research-footer">
          <div className="live-research-summary-stat">
            <BookOpenText size={14} />
            <span>
              <strong>{progress.session.changes.length}</strong> proposed items ready for review (
              {progress.session.changes.filter(c => c.kind === 'node').length} nodes,{' '}
              {progress.session.changes.filter(c => c.kind === 'relationship').length} relationships)
            </span>
          </div>
          <button
            type="button"
            className="live-review-btn"
            onClick={() => onOpenReview(progress.session!)}
          >
            <span>Open Review Queue</span>
            <ArrowRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
};
