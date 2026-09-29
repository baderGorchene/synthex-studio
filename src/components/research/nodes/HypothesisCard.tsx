import { BaseKnowledgeCard } from './BaseKnowledgeCard';
import type { NodeCardProps } from './types';

export function HypothesisCard(props: NodeCardProps) {
  return <BaseKnowledgeCard {...props} />;
}
