import type { CanvasNode, Connection } from '@/types/canvas';

const guideOrigin = {
  origin: 'example' as const,
  rationale: 'Official Synthex Studio product documentation and element guide.'
};

export const SEED_NODES: CanvasNode[] = [
  // ==========================================================================
  // Section 1: Welcome & Core Philosophy
  // ==========================================================================
  {
    id: 'guide-section-welcome',
    type: 'group',
    x: 60,
    y: 60,
    width: 880,
    height: 420,
    title: '1. Welcome & Core Philosophy',
    color: 'cobalt',
    createdAt: 1761000000000,
    metadata: { ...guideOrigin, collapsed: false }
  },
  {
    id: 'guide-welcome-note',
    type: 'note',
    x: 100,
    y: 150,
    width: 380,
    height: 290,
    sectionId: 'guide-section-welcome',
    title: 'Welcome to Synthex Studio',
    content: `**Synthex Studio** transforms open-ended questions and web sources into an auditable **semantic knowledge graph**.

### Core Principles
1. **The Graph is Truth:** Every insight is a typed record linked by directional semantic edges.
2. **Human-in-the-Loop Review:** AI never makes silent writes. Research runs stage in a review queue.
3. **Epistemic Provenance:** Claims link directly to grounded sources with citations and confidence ratings.`,
    color: 'cobalt',
    createdAt: 1761000001000,
    metadata: guideOrigin
  },
  {
    id: 'guide-quickstart-task',
    type: 'task',
    x: 520,
    y: 150,
    width: 380,
    height: 290,
    sectionId: 'guide-section-welcome',
    title: 'Quick Start Research Sprint',
    color: 'sage',
    items: [
      { id: 't1', text: 'Double-click any note card to edit Markdown in-place', completed: true },
      { id: 't2', text: 'Click "+" in bottom dock or press N, T to add cards', completed: false },
      { id: 't3', text: 'Drag from card edge ports to draw directional arrows', completed: false },
      { id: 't4', text: 'Press "R" to trigger autonomous web research', completed: false },
      { id: 't5', text: 'Press "?" or Shift+A to query the graph assistant', completed: false },
      { id: 't6', text: 'Export to Obsidian Vault / Context Markdown', completed: false }
    ],
    createdAt: 1761000002000,
    metadata: guideOrigin
  },

  // ==========================================================================
  // Section 2: Semantic Elements & Node Types
  // ==========================================================================
  {
    id: 'guide-section-elements',
    type: 'group',
    x: 60,
    y: 520,
    width: 1300,
    height: 560,
    title: '2. Semantic Elements & Record Types',
    color: 'lavender',
    createdAt: 1761000003000,
    metadata: { ...guideOrigin, collapsed: false }
  },
  {
    id: 'guide-elem-concept',
    type: 'concept',
    x: 100,
    y: 610,
    width: 270,
    height: 200,
    sectionId: 'guide-section-elements',
    title: 'Concepts & Entities',
    content: 'Represents fundamental entities, core models, abstractions, and domain definitions. Serves as the foundation of your conceptual architecture.',
    color: 'cobalt',
    createdAt: 1761000004000,
    metadata: guideOrigin
  },
  {
    id: 'guide-elem-claim',
    type: 'claim',
    x: 400,
    y: 610,
    width: 280,
    height: 200,
    sectionId: 'guide-section-elements',
    title: 'Epistemic Claims',
    content: 'Specific assertions of fact. Features provenance badges (Supported, Disputed, Unverified). Links to grounding sources for rigorous verification.',
    color: 'neutral',
    createdAt: 1761000005000,
    metadata: { ...guideOrigin, claimStatus: 'supported' }
  },
  {
    id: 'guide-elem-question',
    type: 'question',
    x: 710,
    y: 610,
    width: 270,
    height: 200,
    sectionId: 'guide-section-elements',
    title: 'Open Inquiries',
    content: 'Unresolved questions that direct your study. Selected questions can be handed directly to the Deep Research engine to run multi-hop searches.',
    color: 'terracotta',
    createdAt: 1761000006000,
    metadata: guideOrigin
  },
  {
    id: 'guide-elem-hypothesis',
    type: 'hypothesis',
    x: 1010,
    y: 610,
    width: 270,
    height: 200,
    sectionId: 'guide-section-elements',
    title: 'Working Hypotheses',
    content: 'Plausible explanations undergoing empirical testing. Hypotheses link to contradictory or supportive citations across papers.',
    color: 'rose',
    createdAt: 1761000007000,
    metadata: guideOrigin
  },
  {
    id: 'guide-elem-source',
    type: 'source',
    x: 100,
    y: 840,
    width: 270,
    height: 200,
    sectionId: 'guide-section-elements',
    title: 'Grounding Sources',
    url: 'https://arxiv.org/abs/2603.04891',
    domain: 'arxiv.org',
    description: 'Peer-reviewed papers, documentation, web links, or uploaded PDFs. Captures live favicons, domain metadata, and citation excerpts.',
    color: 'sage',
    createdAt: 1761000008000,
    metadata: guideOrigin
  },
  {
    id: 'guide-elem-ai',
    type: 'ai_insight',
    x: 400,
    y: 840,
    width: 280,
    height: 200,
    sectionId: 'guide-section-elements',
    title: 'AI Synthesis Insights',
    content: 'High-signal conceptual breakthroughs distilled by gpt-6-luna or gemini-3.8-flash during autonomous multi-hop research runs.',
    color: 'lavender',
    createdAt: 1761000009000,
    metadata: guideOrigin
  },
  {
    id: 'guide-elem-note',
    type: 'note',
    x: 710,
    y: 840,
    width: 270,
    height: 200,
    sectionId: 'guide-section-elements',
    title: 'Rich Markdown Notes',
    content: 'Double-click to edit! Supports **bold**, *italics*, `inline code`, code blocks, numbered lists, and LaTeX equations.',
    color: 'neutral',
    createdAt: 1761000010000,
    metadata: guideOrigin
  },
  {
    id: 'guide-elem-cluster',
    type: 'concept',
    x: 1010,
    y: 840,
    width: 270,
    height: 200,
    sectionId: 'guide-section-elements',
    title: 'Folded Knowledge Sheets',
    content: 'Collapsible spatial sub-canvases. Enclose related cards, resize with 8 corner handles, and fold into compact index sheets.',
    color: 'amber',
    createdAt: 1761000011000,
    metadata: guideOrigin
  },

  // ==========================================================================
  // Section 3: AI Research Engine & Assistant
  // ==========================================================================
  {
    id: 'guide-section-ai',
    type: 'group',
    x: 980,
    y: 60,
    width: 840,
    height: 420,
    title: '3. AI Research Engine & Grounding',
    color: 'sage',
    createdAt: 1761000012000,
    metadata: { ...guideOrigin, collapsed: false }
  },
  {
    id: 'guide-ai-research',
    type: 'ai_insight',
    x: 1020,
    y: 150,
    width: 370,
    height: 290,
    sectionId: 'guide-section-ai',
    title: 'Autonomous Web Research',
    content: `Press **'R'** or click **Run Research** in the topbar.

- **Quick Research:** Single-shot synthesis with Google Search citations.
- **Deep Research:** Multi-hop recursive search loop that decomposes hard questions and retrieves arXiv sources.
- **Staged Review Queue:** AI findings enter as pending. You accept or reject each node and relation before committing.`,
    color: 'sage',
    createdAt: 1761000013000,
    metadata: guideOrigin
  },
  {
    id: 'guide-ai-chat',
    type: 'concept',
    x: 1420,
    y: 150,
    width: 370,
    height: 290,
    sectionId: 'guide-section-ai',
    title: 'Graph-Grounded Assistant',
    content: `Press **'?'** or **Shift + A** to open graph chat.

- **Zero Hallucination:** Answers are strictly grounded in your visible graph records.
- **Citation Tags:** Every answer cites exact referenced card IDs for transparent auditability.
- **Context Credits Meter:** Live credit consumption balance visible in the top navigation bar.`,
    color: 'cobalt',
    createdAt: 1761000014000,
    metadata: guideOrigin
  },

  // ==========================================================================
  // Section 4: Controls, Shortcuts & Exports
  // ==========================================================================
  {
    id: 'guide-section-tools',
    type: 'group',
    x: 1400,
    y: 520,
    width: 420,
    height: 560,
    title: '4. Canvas Controls & Exports',
    color: 'neutral',
    createdAt: 1761000015000,
    metadata: { ...guideOrigin, collapsed: false }
  },
  {
    id: 'guide-tools-shortcuts',
    type: 'note',
    x: 1430,
    y: 610,
    width: 360,
    height: 215,
    sectionId: 'guide-section-tools',
    title: 'Navigation & Hotkeys',
    content: `- **Pan Canvas:** \`Spacebar\` + Drag, or Middle-click
- **Zoom:** Mouse wheel or trackpad pinch
- **Multi-select:** \`Shift\` + Click or Marquee drag
- **Spotlight Search:** \`Ctrl/Cmd + K\`
- **Run Research:** \`R\`
- **Ask Assistant:** \`?\` or \`Shift + A\`
- **Resize Cards:** Drag corner handles (Lock toggle in dock)
- **Undo / Redo:** \`Ctrl/Cmd + Z\` / \`Ctrl/Cmd + Y\``,
    color: 'neutral',
    createdAt: 1761000016000,
    metadata: guideOrigin
  },
  {
    id: 'guide-tools-export',
    type: 'concept',
    x: 1430,
    y: 840,
    width: 360,
    height: 200,
    sectionId: 'guide-section-tools',
    title: 'Knowledge Portability & Exports',
    content: `Click **Export** in the topbar to export:
- **Obsidian / Logseq Vault ZIP:** Markdown files with \`[[wikilinks]]\`
- **Context Markdown (\`CONTEXT.md\`):** Deterministic LLM prompt brief
- **Mermaid Diagram:** For GitHub, Notion, and docs
- **High-Res SVG & PNG:** Vector graphics for publishing`,
    color: 'amber',
    createdAt: 1761000017000,
    metadata: guideOrigin
  }
];

export const SEED_CONNECTIONS: Connection[] = [
  {
    id: 'guide-conn-1',
    from: 'guide-welcome-note',
    to: 'guide-quickstart-task',
    label: 'guides',
    color: 'indigo',
    lineStyle: 'curved',
    strokePattern: 'solid',
    arrowhead: 'end'
  },
  {
    id: 'guide-conn-2',
    from: 'guide-quickstart-task',
    to: 'guide-elem-concept',
    label: 'explores',
    color: 'indigo',
    lineStyle: 'curved',
    strokePattern: 'solid',
    arrowhead: 'end'
  },
  {
    id: 'guide-conn-3',
    from: 'guide-elem-question',
    to: 'guide-ai-research',
    label: 'steers_query',
    color: 'amber',
    lineStyle: 'curved',
    strokePattern: 'dashed',
    arrowhead: 'end'
  },
  {
    id: 'guide-conn-4',
    from: 'guide-ai-research',
    to: 'guide-elem-source',
    label: 'discovers',
    color: 'emerald',
    lineStyle: 'curved',
    strokePattern: 'solid',
    arrowhead: 'end'
  },
  {
    id: 'guide-conn-5',
    from: 'guide-elem-source',
    to: 'guide-elem-claim',
    label: 'supports',
    color: 'emerald',
    lineStyle: 'curved',
    strokePattern: 'solid',
    arrowhead: 'end'
  },
  {
    id: 'guide-conn-6',
    from: 'guide-elem-claim',
    to: 'guide-elem-hypothesis',
    label: 'validates',
    color: 'rose',
    lineStyle: 'curved',
    strokePattern: 'solid',
    arrowhead: 'end'
  },
  {
    id: 'guide-conn-7',
    from: 'guide-ai-research',
    to: 'guide-elem-ai',
    label: 'synthesizes',
    color: 'purple',
    lineStyle: 'curved',
    strokePattern: 'solid',
    arrowhead: 'end'
  },
  {
    id: 'guide-conn-8',
    from: 'guide-ai-chat',
    to: 'guide-tools-shortcuts',
    label: 'references',
    color: 'sky',
    lineStyle: 'stepped',
    strokePattern: 'dashed',
    arrowhead: 'end'
  },
  {
    id: 'guide-conn-9',
    from: 'guide-elem-cluster',
    to: 'guide-tools-export',
    label: 'exports_to',
    color: 'amber',
    lineStyle: 'curved',
    strokePattern: 'solid',
    arrowhead: 'end'
  }
];
