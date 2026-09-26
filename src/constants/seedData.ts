import { CanvasNode, Connection } from '@/types/canvas';

/* Default initial architectural canvas board */
export const SEED_NODES: CanvasNode[] = [
  {
    id: 'section-architecture',
    type: 'section',
    x: 180,
    y: 120,
    width: 680,
    height: 480,
    title: 'Phase 1: Knowledge Graph Topology',
    color: 'lavender',
    createdAt: 1711000000000
  },
  {
    id: 'node-note-core',
    type: 'note',
    x: 210,
    y: 180,
    width: 300,
    color: 'lavender',
    title: 'Research Thesis',
    content: 'Milanote-style spatial computing combined with autonomous multi-hop research.\n\nEvery insight is structured as a tactile flat card with semantic vector relationships instead of chaotic post-it clutter.',
    createdAt: 1711000001000
  },
  {
    id: 'node-tasks-sprint',
    type: 'task',
    x: 540,
    y: 180,
    width: 290,
    color: 'sage',
    title: 'Core Deliverables',
    items: [
      { id: 't1', text: 'Razor-sharp typography & zero 3D distortion', completed: true },
      { id: 't2', text: 'Tactile selection toolbar & color swatches', completed: true },
      { id: 't3', text: 'Architectural container grouping sections', completed: true },
      { id: 't4', text: 'Gemini 3 Flash research graph agent', completed: true },
      { id: 't5', text: 'Curved orthographic vector connectors', completed: true }
    ],
    createdAt: 1711000002000
  },
  {
    id: 'node-image-mood',
    type: 'image',
    x: 900,
    y: 120,
    width: 320,
    color: 'terracotta',
    title: 'Visual Identity',
    imageUrl: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=800&q=80',
    caption: 'Modern Studio Spatial Arrangement',
    createdAt: 1711000003000
  },
  {
    id: 'node-link-source',
    type: 'link',
    x: 540,
    y: 430,
    width: 290,
    color: 'cobalt',
    title: 'Deep Graph Synthesis',
    url: 'https://deepmind.google/technologies/gemini/',
    domain: 'deepmind.google',
    description: 'Grounding autonomous synthesis through live SERP citations and structured node schemas.',
    createdAt: 1711000004000
  }
];

export const SEED_CONNECTIONS: Connection[] = [
  { id: 'c1', from: 'node-note-core', to: 'node-tasks-sprint', label: 'Implements' },
  { id: 'c2', from: 'node-tasks-sprint', to: 'node-link-source', label: 'Cites' },
  { id: 'c3', from: 'node-tasks-sprint', to: 'node-image-mood', label: 'Visualizes' }
];
