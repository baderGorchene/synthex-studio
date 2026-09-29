import { BaseKnowledgeCard } from './BaseKnowledgeCard';
import type { NodeCardProps } from './types';

export function ClaimCard(props: NodeCardProps) {
  return <BaseKnowledgeCard {...props} />;
}
