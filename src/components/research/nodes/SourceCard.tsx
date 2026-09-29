import { BaseKnowledgeCard } from './BaseKnowledgeCard';
import type { NodeCardProps } from './types';

export function SourceCard(props: NodeCardProps) {
  return <BaseKnowledgeCard {...props} />;
}
