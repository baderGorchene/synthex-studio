import { BaseKnowledgeCard } from './BaseKnowledgeCard';
import type { NodeCardProps } from './types';

export function NoteCard(props: NodeCardProps) {
  return <BaseKnowledgeCard {...props} />;
}
