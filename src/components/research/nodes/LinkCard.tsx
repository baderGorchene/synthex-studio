import { BaseKnowledgeCard } from './BaseKnowledgeCard';
import type { NodeCardProps } from './types';

export function LinkCard(props: NodeCardProps) {
  return <BaseKnowledgeCard {...props} />;
}
