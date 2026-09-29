import type { CanvasNodeType } from '@/types/canvas';
import type { NodeCardProps } from './types';
import { ConceptCard } from './ConceptCard';
import { NoteCard } from './NoteCard';
import { SourceCard } from './SourceCard';
import { LinkCard } from './LinkCard';
import { ClaimCard } from './ClaimCard';
import { QuestionCard } from './QuestionCard';
import { HypothesisCard } from './HypothesisCard';
import { ImageCard } from './ImageCard';
import { ResearchResultCard } from './ResearchResultCard';
import { ResearchTaskCard } from './ResearchTaskCard';
import { AIInsightCard } from './AIInsightCard';
export { NodeGlyph } from './BaseKnowledgeCard';
const cards: Partial<Record<CanvasNodeType, (props: NodeCardProps) => React.JSX.Element>> = {
  concept: ConceptCard, note: NoteCard, source: SourceCard, link: LinkCard, claim: ClaimCard,
  question: QuestionCard, hypothesis: HypothesisCard, image: ImageCard,
  research_result: ResearchResultCard, task: ResearchTaskCard, ai_insight: AIInsightCard
};
export function NodeCard(props: NodeCardProps) {
  const Card = cards[props.node.type];
  return Card ? <Card {...props} /> : null;
}
