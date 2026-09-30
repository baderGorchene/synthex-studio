import React from 'react';
import { RESEARCH_MODE_LABELS, type ResearchMode, type ResearchSession } from '@/types/canvas';

export interface ResearchLiveProgress {
  mode: ResearchMode;
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

const domainOf = (url: string) => {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
};

export const LiveResearchCard: React.FC<LiveResearchCardProps> = ({ progress, onOpenReview }) => {
  const completedSteps = progress.steps.filter(s => s.status === 'done').length;
  const totalSteps = progress.steps.length;
  const session = progress.session;
  const ideas = session?.changes.filter(c => c.kind === 'node').length || 0;
  const relations = session?.changes.filter(c => c.kind === 'relationship').length || 0;

  return (
    <section className="ai-card">
      <h4>{RESEARCH_MODE_LABELS[progress.mode]}</h4>
      <p className="note-meta">
        {progress.isComplete ? 'Done' : `Step ${Math.min(completedSteps + 1, totalSteps)} of ${totalSteps}`} · “{progress.query}”
      </p>

      <ol className="ai-steps">
        {progress.steps.map((step, idx) => (
          <li key={step.id || idx} className={step.status}>{step.label}</li>
        ))}
      </ol>

      {progress.queries.length > 0 && (
        <div className="ai-card-section">
          <h5>Searched for</h5>
          <ul className="ai-plain-list">
            {progress.queries.map((q, idx) => <li key={idx}>{q}</li>)}
          </ul>
        </div>
      )}

      {progress.sources.length > 0 && (
        <div className="ai-card-section">
          <h5>Sources found ({progress.sources.length})</h5>
          <ol className="ai-sources">
            {progress.sources.map((src, idx) => (
              <li key={idx}>
                <a href={src.url} target="_blank" rel="noopener noreferrer" title={src.title}>{src.title || src.url}</a>
                {domainOf(src.url) && <span className="note-meta">{domainOf(src.url)}</span>}
              </li>
            ))}
          </ol>
        </div>
      )}

      {progress.isComplete && session && (
        <div className="ai-card-section ai-card-footer">
          <p>{ideas} {ideas === 1 ? 'idea' : 'ideas'} and {relations} {relations === 1 ? 'relation' : 'relations'} drafted on your map.</p>
          <button type="button" className="line-button" onClick={() => onOpenReview(session)}>Review drafts</button>
        </div>
      )}
    </section>
  );
};
