import { BaseKnowledgeCard } from './BaseKnowledgeCard';
import type { NodeCardProps } from './types';

export function ImageCard(props: NodeCardProps) {
  return <BaseKnowledgeCard {...props} />;
}
