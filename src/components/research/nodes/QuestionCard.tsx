import { BaseKnowledgeCard } from './BaseKnowledgeCard';
import type { NodeCardProps } from './types';

export function QuestionCard(props: NodeCardProps) {
  return <BaseKnowledgeCard {...props} />;
}
