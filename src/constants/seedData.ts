import type { CanvasNode, Connection } from '@/types/canvas';

const exampleOrigin = {
  origin: 'example' as const,
  rationale: 'Illustrative starter graph. No source evidence has been added yet.'
};

export const SEED_NODES: CanvasNode[] = [
  {
    id: 'group-rag-basics', type: 'group', x: 190, y: 90, width: 980, height: 620,
    title: 'How RAG works', color: 'neutral', createdAt: 1761000000000,
    metadata: { ...exampleOrigin, collapsed: false }
  },
  {
    id: 'concept-retrieval', type: 'concept', x: 255, y: 200, width: 260,
    title: 'Retrieve', content: 'Find relevant passages from an external corpus.',
    color: 'cobalt', createdAt: 1761000001000, metadata: exampleOrigin
  },
  {
    id: 'concept-context', type: 'concept', x: 600, y: 200, width: 260,
    title: 'Augment', content: 'Add retrieved passages to the model context.',
    color: 'sage', createdAt: 1761000002000, metadata: exampleOrigin
  },
  {
    id: 'concept-generation', type: 'concept', x: 925, y: 200, width: 260,
    title: 'Generate', content: 'Draft a response using the question and retrieved context.',
    color: 'lavender', createdAt: 1761000003000, metadata: exampleOrigin
  },
  {
    id: 'claim-grounding', type: 'claim', x: 600, y: 440, width: 300,
    title: 'Grounding depends on retrieved context',
    content: 'Working claim · needs source evidence', color: 'neutral',
    createdAt: 1761000004000,
    metadata: { ...exampleOrigin, claimStatus: 'unverified' }
  },
  {
    id: 'question-evidence', type: 'question', x: 930, y: 440, width: 290,
    title: 'Which sources support the retrieval step?',
    color: 'terracotta', createdAt: 1761000005000, metadata: exampleOrigin
  }
];

export const SEED_CONNECTIONS: Connection[] = [
  { id: 'rag-1', from: 'concept-retrieval', to: 'concept-context', label: 'adds context to', color: 'neutral' },
  { id: 'rag-2', from: 'concept-context', to: 'concept-generation', label: 'conditions', color: 'neutral' },
  { id: 'rag-3', from: 'concept-context', to: 'claim-grounding', label: 'motivates', color: 'neutral' },
  { id: 'rag-4', from: 'claim-grounding', to: 'question-evidence', label: 'needs evidence', color: 'neutral' }
];
