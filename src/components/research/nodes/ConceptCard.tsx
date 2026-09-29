import { BaseKnowledgeCard } from './BaseKnowledgeCard';
import type { NodeCardProps } from './types';

export function ConceptCard(props: NodeCardProps) {
  return <BaseKnowledgeCard {...props} />;
}
