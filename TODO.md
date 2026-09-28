# Synthex Studio — Feature Roadmap & Issue Backlog

> **Document Status:** Derived from system architecture, security audit, and technical analysis in [AGENTS.md](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/AGENTS.md). Divided into **Code-Only / Local Tasks** (0 external APIs, 100% offline) and **AI & Third-Party Tasks** (requires API keys / cloud services).

---

## Progress Dashboard

| Section | Focus | Pending | In Progress | Completed |
|---|---|---|---|---|
| **Part 1: Code-Only & Local** | Storage, Canvas UI, Math, Exports, Cleanups | 0 | 0 | 18 |
| **Part 2: AI & External Services** | Graph RAG, Agentic Tools, SSE Streaming, Deep Research | 1 | 0 | 5 |
| **Part 3: Cloud, Auth & SaaS** | GCP, Clerk Auth, Landing Page, Stripe, Context Credits | 2 | 0 | 3 |
| **Total** | | **4** | **0** | **26** |

---

# PART 1: Code-Only / Local Tasks (Zero Third-Party Services)
> *Can be built and tested completely offline with TypeScript, Next.js, and local SQLite. No API keys or paid services required.*

## 1.1 Immediate Codebase Cleanups & Technical Debt (P0)

- [x] **Fix ESLint compile errors in active code**
  - Converted `let updates` to `const updates` in [src/app/page.tsx](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/app/page.tsx).
  - Typed CSS variable custom properties (`--node-custom-color`, `--node-custom-ring`) in [src/components/research/GraphCanvas.tsx](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/components/research/GraphCanvas.tsx) avoiding `any`.
  - Resolved `react-hooks/refs` access during render by calculating viewport coordinates cleanly.
- [x] **Fix Duplicate Edge Crash & State Protection**
  - Updated [src/lib/graph.ts](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/lib/graph.ts) `addRelationship` to gracefully return `graph` on duplicate edges and self-loops instead of throwing an uncaught runtime error.
  - Added duplicate connection detection and user toast feedback in `connectNodes` in [src/app/page.tsx](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/app/page.tsx).
  - Protected `updateGraph` state transitions with `try...catch` so unexpected errors never crash the React render tree.
- [x] **Fix Dotted & Dashed Arrow Visuals & Animations**
  - Updated SVG path rendering in [src/components/research/GraphCanvas.tsx](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/components/research/GraphCanvas.tsx) and [src/app/globals.css](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/app/globals.css) with `stroke-linecap: round` and `stroke-linejoin: round`.
  - Configured dotted lines with `strokeDasharray="0 8"` to render true circular beads instead of jagged rectangle slivers.
  - Adjusted marker alignment (`refX="5.5"`) to enclose the stroke cap inside the arrowhead body, eliminating flickering dot artifacts at arrow tips during flow animations.
  - Synchronized animation keyframe offsets (`-32px`) to loop seamlessly with 8px dotted and 16px dashed periods.
- [x] **Interactive Drag-to-Trash Zone**
  - Added bottom floating drop zone with crimson hover state, bounce animation, and drop-to-delete handler.
- [x] **Windows-style Marquee Multi-Select Box**
  - Click-and-drag rectangular selection on empty canvas with shift/additive support.
- [x] **Messenger-style Video & Link Thumbnails**
  - Auto-extracted YouTube video thumbnails (`img.youtube.com/vi/...`) and official YouTube oEmbed integration in `/api/metadata`.
  - Transparent favicon fallback without background color when no thumbnail image exists.
- [x] **Clean Up Orphaned Legacy Prototype Code**
  - Relocated [SourceMetadata.tsx](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/components/research/SourceMetadata.tsx) to active research components.
  - Safely archived unused legacy prototype files into `archive/legacy-prototype/` (`canvas/*`, `modals/*`, `navigation/*`, `hooks/*`, `services/*`).
  - Removed client-side `localStorage` API key handling in `src/services/gemini.ts` from the active source tree.
  - Updated ESLint configuration to ignore archived files.
- [x] **Deprecate Unscoped Legacy API Routes**
  - Archived unscoped `/api/canvas`, `/api/nodes`, and `/api/connections` routes into `archive/legacy-prototype/api/`.
  - All workspace operations now route strictly through project-scoped `/api/graph`.
- [x] **Fix Node.js Typeless Module Warning in Test Suite**
  - Added `"type": "module"` in [package.json](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/package.json), eliminating the `[MODULE_TYPELESS_PACKAGE_JSON]` warning during `npm test`.

---

## 1.2 Local Storage, Media & Reliability (P1)

- [x] **Replace Inline Base64 File Storage with Local Disk Storage**
  - Created dedicated multipart upload route `POST /api/upload` saving attachments to `public/uploads/{projectId}/{fileName}` with 50MB limits and filename sanitization.
  - Added client-side `uploadFile` helper in [src/lib/upload.ts](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/lib/upload.ts) with resilient fallback.
  - Extended SQLite table columns (`fileData`, `fileName`, `fileSize`, `fileType`, `sectionId`, `pageCount`) in [src/lib/db.ts](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/lib/db.ts).
  - Connected canvas drag-and-drop, clipboard paste, and property inspector file/media uploaders to disk storage with visual upload progress spinners.
  - Updated [FileAndMediaModal.tsx](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/components/research/FileAndMediaModal.tsx) to dynamically stream disk-stored text/code/data files while preserving backward compatibility for legacy `data:` URIs.
  - Prevents payload bloat and eliminates HTTP 413 "Graph payload is too large" autosave errors on `PUT /api/graph`.
- [x] **Persistent Revision History & Time-Travel Undo/Redo**
  - Added `graph_revisions` table and index in SQLite [src/lib/db.ts](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/lib/db.ts) capturing point-in-time graph states with 100-revision automatic retention.
  - Implemented `POST /api/revisions` and `GET /api/revisions` with fast summary listing and atomic 1-click restore/rollback.
  - Built dedicated Revisions View in [src/components/research/KnowledgeViews.tsx](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/components/research/KnowledgeViews.tsx) with relative timestamps, manual checkpoint creation, and rollback controls.
  - Connected topbar Time-Travel shortcut button `(H)` and navigation menu in [src/app/page.tsx](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/app/page.tsx).
  - Configured automatic checkpointing on research application, file import, and throttled periodic background saves.
  - Added unit tests in [tests/graph.test.mjs](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/tests/graph.test.mjs) verifying creation, listing, atomic restoration, and deletion.
- [x] **Automatic Local Workspace Snapshot & Rollback**
  - Implemented SQLite database snapshot and restore engine in [src/lib/db.ts](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/lib/db.ts) using `db.backup()`, WAL checkpointing, and safe Windows file handle management.
  - Created `/api/backup` route supporting atomic snapshot creation, restore, deletion, and direct `.db` file downloads.
  - Added dual-tab switcher to Revisions View in [src/components/research/KnowledgeViews.tsx](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/components/research/KnowledgeViews.tsx) enabling researchers to inspect, download, and restore both project-level graph checkpoints and full SQLite database snapshots.
  - Added "Download active `canvas.db`" 1-click button for full offline archiving.
  - Configured automatic pre-import safety backups in [src/app/page.tsx](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/app/page.tsx) before applying external graph files.
  - Added unit tests in [tests/graph.test.mjs](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/tests/graph.test.mjs) verifying creation, listing, file verification, restoration, and deletion (7/7 tests passing).

---

## 1.3 Canvas Interaction & Spatial Performance (P3)

- [x] **Canvas Virtualization (60 FPS for 200+ Nodes)**
  - Implemented viewport bounding-box culling in [src/components/research/GraphCanvas.tsx](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/components/research/GraphCanvas.tsx) based on `viewport.pan`, `viewport.zoom`, and container dimensions with a 600px buffer margin.
  - Automatically culls off-screen knowledge cards, clusters, and SVG relationship paths on large graphs while preserving selected, dragged, linking, and editing nodes in the active DOM tree.
  - Added real-time 60 FPS performance status pill indicator with active card telemetry.
  - Verified with unit tests in [tests/graph.test.mjs](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/tests/graph.test.mjs) confirming >75% DOM culling efficiency on a 250-node benchmark.
- [x] **Smart Alignment Guides & Snapping**
  - Added magnetic coordinate snapping when dragging cards within 7px of adjacent cards (left, center, right, top, middle, bottom edges).
  - Implemented dynamic SVG alignment guide lines with animated pulse effect (`.canvas-guide-line`) showing exact collinear axes in real time.
  - Added `Shift` key bypass allowing researchers to disable magnetic snapping on demand for freeform placement.
  - Verified with automated unit tests in [tests/graph.test.mjs](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/tests/graph.test.mjs).
- [x] **Semantic Relationship Ontology Presets**
  - Canonical ontology definitions (`supports`, `contradicts`, `depends_on`, `derived_from`, `answers`) integrated into [src/types/canvas.ts](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/types/canvas.ts).
  - Built 1-click Ontology Presets selector in [RelationshipControls.tsx](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/components/research/RelationshipControls.tsx) automatically setting label, semantic color accent, line style, stroke pattern, and directional arrow.
  - Upgraded SVG relationship paths, arrowheads, and color palettes across [GraphCanvas.tsx](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/components/research/GraphCanvas.tsx) and [globals.css](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/app/globals.css) with vibrant semantic tokens (`emerald`: `#10b981`, `rose`: `#f43f5e`, `amber`: `#f59e0b`, `indigo`: `#6366f1`, `sky`: `#0ea5e9`, `purple`: `#a855f7`).
  - Added unit test in [tests/graph.test.mjs](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/tests/graph.test.mjs) verifying canonical configurations and accurate edge application (10/10 tests passing).
- [x] **Interactive Mini-Map Navigation**
  - Built interactive glassmorphic bird's-eye canvas minimap in [Minimap.tsx](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/components/research/Minimap.tsx).
  - Dynamically calculates world bounds encompassing all nodes, clusters, and current viewport with smooth scale normalization.
  - Interactive Viewfinder lens (`.canvas-minimap-lens`) displaying current viewport position with real-time drag-to-pan and click-to-center navigation.
  - Integrated 1-click "Fit graph to view" action and collapsible floating pill state with keyboard shortcut (`M`) and `localStorage` preference persistence.
  - Added unit test in [tests/graph.test.mjs](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/tests/graph.test.mjs) verifying world bounds, lens coordinate math, and click-to-pan translation (11/11 tests passing).

---

## 1.4 Local Export & Academic Ingestion (P4)

- [x] **Obsidian / Logseq Vault Export (.zip)**
  - Implemented pure, zero-dependency Vault export engine in [src/lib/vault-export.ts](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/lib/vault-export.ts) using built-in `node:zlib` `deflateRawSync` and `crc32`.
  - Generates typed Markdown files organized into category folders (`concepts/`, `claims/`, `questions/`, `hypotheses/`, `sources/`, `notes/`, `clusters/`).
  - Formats rich YAML frontmatter (`id`, `title`, `type`, `created`, `claimStatus`, `confidence`, `url`, `tags`).
  - Translates directional graph edges into bidirectional `[[wikilinks]]` network (`outgoing` and `incoming` sections).
  - Generates master `Overview.md` index note linking all concepts and claims.
  - Generates native Obsidian Canvas format (`Synthex Knowledge Canvas.canvas`) JSON mapping nodes and visual connectors.
  - Created `/api/export/vault` route supporting both database project exports (`GET`) and immediate client-side graph streaming (`POST`).
  - Added 1-click "Obsidian Vault" export action in topbar dropdown in [src/app/page.tsx](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/app/page.tsx).
  - Verified with unit tests in [tests/graph.test.mjs](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/tests/graph.test.mjs) verifying markdown formatting, wikilinks, canvas JSON, and valid ZIP magic header structure (12/12 tests passing).
- [x] **BibTeX Academic Ingestion (.bib)**
  - Built zero-dependency BibTeX parser in [src/lib/bibtex.ts](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/lib/bibtex.ts) parsing articles, inproceedings, books, DOIs, URLs, and abstracts.
  - Implemented LaTeX brace stripper and accent normalizer (`cleanLatex`) handling complex author formatting and special characters.
  - Added `bibEntriesToCanvasNodes` mapping papers into typed `source` nodes with citation keys, venue/year metadata, and neat grid placement.
  - Added "Import BibTeX" file picker in topbar dropdown and drag-and-drop ingestion on the canvas with toast feedback and automatic card selection in [src/app/page.tsx](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/app/page.tsx).
  - Verified with unit tests in [tests/graph.test.mjs](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/tests/graph.test.mjs) verifying grammar parsing, LaTeX cleanup, and canvas node generation (13/13 tests passing).
- [x] **PNG / SVG High-Resolution Canvas Export**
  - Built publication-ready standalone vector SVG generator (`generateStandaloneSvg`) and high-DPI HTML5 Canvas PNG renderer (`exportGraphToPng`) in [src/lib/canvas-export.ts](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/lib/canvas-export.ts).
  - SVG export embeds full typography, node-type badges, background dot-grid pattern, cluster frames, and flush relationship connectors with ontology markers and labels.
  - Added 1-click "PNG Image" and "Vector SVG" export actions with instantaneous browser download in the topbar export menu in [src/app/page.tsx](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/app/page.tsx).
  - Verified with unit tests in [tests/graph.test.mjs](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/tests/graph.test.mjs) verifying XML declaration, node titles, markers, formatted labels, and valid closing tags (14/14 tests passing).

---

## 1.5 Local Document Linking (P2)

- [x] **PDF Citation Deep-Linking**
  - Created citation parsing, page extraction, and URL fragment generator (`extractPageNumber`, `formatPdfPageUrl`, `normalizeEvidenceItem`) in [src/utils/citation.ts](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/utils/citation.ts).
  - Extended canvas nodes `metadata.evidence` with page-level referencing (`page?: number;`) in [src/types/canvas.ts](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/types/canvas.ts).
  - Upgraded [src/components/research/FileAndMediaModal.tsx](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/components/research/FileAndMediaModal.tsx) `FileViewerModal` with PDF page navigation (`<` / `>`), numeric direct-jump input, and `Cited: p. N` bookmark pill.
  - Added cited excerpt highlight callout banner above the embedded PDF viewport displaying exact quotes.
  - Replaced plain text counts on canvas cards with interactive evidence pills in [src/components/research/GraphCanvas.tsx](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/components/research/GraphCanvas.tsx); clicking immediately opens the PDF viewer jumped to `#page=N`.
  - Added dedicated **Grounding & Evidence** citation manager in [src/components/research/NodeInspector.tsx](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/components/research/NodeInspector.tsx) allowing researchers to review, attach, and delete document citations with page numbers and excerpts.
  - Enhanced the **Evidence paths** view in [src/components/research/KnowledgeViews.tsx](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/components/research/KnowledgeViews.tsx) with interactive citation badges and PDF deep-linking.
  - Verified with unit tests in [tests/graph.test.mjs](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/tests/graph.test.mjs) verifying page number extraction across multiple formats, URL fragments, and citation normalization (15/15 tests passing).

---

# PART 2: External Services & AI Tasks (Requires Third-Party APIs)
> *Requires cloud connectivity and API keys (`GEMINI_API_KEY`, Search Grounding, or external OAuth).*

## 2.1 AI Scaling & Live Web Grounding

- [x] **Vector Embeddings, Semantic Indexing & Graph RAG (Removed 80-Node Limit)**
  - *Addressed Defect:* Eliminated legacy 80-node hard limit in `src/lib/ai-service.ts`.
  - *Architecture Specification:* Fully documented in [GRAPH.md](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/GRAPH.md).
  - *Implemented Solution:*
    - **OpenAI & Gemini Embedding Pipeline:** Implemented [src/lib/rag/embeddings.ts](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/lib/rag/embeddings.ts) using OpenAI `text-embedding-3-small` (1536d) as primary with fallback to Gemini `text-embedding-004` (768d, normalized & padded to 1536d). Integrated SHA-256 content hashing to avoid redundant embedding generations.
    - **In-Database Vector Index & Hybrid Search:** Implemented [src/lib/rag/vector-store.ts](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/lib/rag/vector-store.ts) with `sqlite-vec` (`vec_nodes` virtual table) and SQLite FTS5 (`nodes_fts` BM25 index), unified through Reciprocal Rank Fusion (RRF).
    - **Epistemic HippoRAG Graph Traversal:** Implemented [src/lib/rag/graph-walker.ts](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/lib/rag/graph-walker.ts) featuring Personalized PageRank (PPR) with semantic edge weighting (`contradicts` 1.35x, `supports` 1.15x, `answers` 1.25x) and multi-hop epistemic path expansion.
    - **Token-Budgeted Context Serialization:** Implemented [src/lib/rag/context-builder.ts](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/lib/rag/context-builder.ts) dynamically generating token-budgeted Markdown subgraphs for `/api/ai/chat` and `/api/research`.
    - **Dual-Provider Engine with Automatic Fallback:** Upgraded [src/lib/ai-service.ts](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/lib/ai-service.ts) to prioritize OpenAI `gpt-6-luna` with medium reasoning (`reasoning_effort: 'medium'`) and automatic fallback to Google Gemini (`gemini-3.8-flash`).
    - **Strict API Key Security:** User's API keys reside exclusively in `.env.local` (git-ignored). `/api/ai/status` exposes provider state, active model name, reasoning level, and fallback readiness without exposing secrets.
    - **Live UI Visibility:** Added real-time provider and fallback badges in the workspace topbar, AI Chat drawer, and Research modal. Assistant responses display provenance indicators (`via gpt-6-luna`).
- [x] **Agentic Chat Tools (Research, Deep Research, Topology Audit & Canvas Organization)**
  - *Addressed Requirement:* Transformed AI Graph Assistant chat from passive Q&A into an active copilot equipped with actionable tools and 1-click execution cards adhering to Synthex Principle #2 (Human-in-the-Loop review, zero silent writes).
  - *Implemented Tools:*
    - **`research` & `deep_research`**: Chat dynamically triggers quick or multi-step deep web-grounded research sessions, formulating synthesized queries.
    - **`recommend_improvements`**: Topological & epistemic audit engine ([src/lib/graph-analyst.ts](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/lib/graph-analyst.ts)) auditing unverified claims, isolated cards, open questions, and recommending candidate connections based on shared terminology.
    - **`organize_layout`**: Spatial reorganization engine ([src/lib/graph-organizer.ts](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/lib/graph-organizer.ts)) supporting topological semantic clustering (`cluster_by_type`), hierarchical DAG ordering, and compact grid packing with animated card realignment.
    - **`propose_nodes`**: Proposes adding new typed cards (concepts, claims, hypotheses) and relationships directly from conversation.
  - *Interactive UI & Architecture:*
    - Created [src/components/research/ChatToolCard.tsx](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/components/research/ChatToolCard.tsx) with actionable preview cards (`[Run Deep Research]`, `[Apply Layout]`, `[Add Cards to Canvas]`, `[Connect Nodes]`) and undo support.
    - Added quick-trigger action chips in the chat drawer (`Deep Research`, `Organize Layout`, `Audit & Recommend`).
    - Compatible with `gpt-6-luna` (medium reasoning) via structured JSON schema and automatic fallback to Gemini.
    - Verified with unit tests in [tests/graph.test.mjs](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/tests/graph.test.mjs) (20/20 tests passing).
- [x] **Server-Sent Events (SSE) Streaming for AI Responses & Live Thinking Progress**
  - *Addressed Requirement:* Eliminated blocking HTTP requests for `/api/ai/chat` by implementing native SSE streaming (`ReadableStream`), displaying word-by-word streaming responses with a blinking cursor, and live animated thinking indicators (`chat-thinking-card`).
  - *Implemented Architecture:*
    - Created `askGraphStream` in [src/lib/ai-service.ts](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/lib/ai-service.ts) streaming `status`, `thinking`, `delta`, `tool`, and `done` events.
    - Updated [src/app/api/ai/chat/route.ts](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/app/api/ai/chat/route.ts) with `ReadableStream` yielding `text/event-stream` SSE payloads.
    - Added high-contrast assistant responses (slate-900 `#0f172a` text on pristine `#ffffff` card with elevated shadow) and muted right-aligned user messages in [src/app/globals.css](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/app/globals.css).
    - **Draggable Canvas Dock Organization & Focused Chat Research:** Moved canvas organization algorithms (`Semantic Categories`, `Hierarchical DAG`, `Compact Grid`) directly onto the draggable canvas tool dock ([WorkspaceSidebar.tsx](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/components/research/WorkspaceSidebar.tsx)) with a dedicated popover menu. Removed layout organization from the chat assistant and chat tools menu, keeping the chat assistant strictly focused on research tools (`research`, `deep_research`, `recommend_improvements`, and `propose_nodes`).
    - **Refined Typography & Slim Tool Cards:** Replaced raw text wrapping with [MarkdownView](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/components/research/MarkdownView.tsx) to render full GFM headers (`###`), bold highlights (`**14**`), lists, and code blocks. Redesigned [ChatToolCard](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/components/research/ChatToolCard.tsx) to eliminate bulky nested cards, replacing redundant block buttons with sleek confirmation strips (`✓ Applied to canvas · 14 cards positioned`) and micro re-apply buttons.
- [x] **Recursive Multi-Step Research Runs ("Deep Research" Mode)**
  - *Addressed Requirement:* Upgraded Deep Research from single-shot query execution into an autonomous, recursive multi-hop investigation pipeline leveraging OpenAI's multi-step planning and Google Gemini's Google Search Grounding.
  - *Implemented Architecture:*
    - **OpenAI Multi-Hop Planner (`gpt-6-luna` / Deep Research):**
      - **Hop 1 (Axis Decomposition):** Deconstructs the research inquiry into three specialized investigative axes: (1) Core theoretical foundations & architectural mechanics, (2) Empirical benchmarks, recent real-world breakthroughs (2025-2026), and (3) Limitations, edge cases, and counterarguments. Formulates preliminary testable hypotheses.
      - **Hop 2 (Deep Synthesis & Epistemic Cross-Linking):** Recursively explores the decomposed axes, formulating 10-14 rich nodes (`concept`, `claim`, `hypothesis`, `question`), 12-18 directional semantic relationships (`supports`, `contradicts`, `depends_on`, `answers`, `derived_from`, `extends`), and grounded academic citations.
    - **Google Gemini Multi-Hop Grounding (`gemini-3.8-flash` with Google Search Grounding):**
      - **Hop 1 (Broad Exploration):** Issues broad search-grounded queries via `google_search` tools to explore the landscape, retrieve initial citations, and isolate 3-4 specific sub-questions.
      - **Hop 2 (Targeted Facet Deep-Dive):** Issues targeted follow-up search queries directly on the unresolved sub-questions to collect empirical data, statistics, and opposing viewpoints.
      - **Hop 3 (Deduplication & Cross-Source Synthesis):** Merges web sources across both hops (deduplicating URLs), combines all executed search queries into the audit trail, and synthesizes 10-14 nodes with rich cross-hop links.
    - **Audit Trail & Provenance Logging:** Captures all executed search queries across hops in `ResearchSession.trail`, displayed in the Research Activity History drawer.
    - **Verified with Unit Tests:** Added `Deep Research Engine: validates multi-hop research session structure and search trail` to [tests/graph.test.mjs](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/tests/graph.test.mjs) (21/21 tests passing).
- [x] **User-Prompted Research & Streaming Live Intermediate Steps / Results in Chat**
  - *Addressed Requirement:* Solved auto-guess research execution by having research tools wait for explicit user query, and streaming live intermediate progress and grounded sources directly inside the chat interface.
  - *Implemented Architecture:*
    - **Interactive Intent Staging:** Selecting "Deep Web Research" or "Quick Research" from the tools popover or welcome chips no longer auto-fires on arbitrary canvas cards. Instead, it mounts an active research banner (`.active-research-banner`) above the chat composer, updates the input placeholder, and automatically focuses the input field to await the user's specific inquiry.
    - **Server-Sent Events (SSE) Streaming Endpoint:** Updated `POST /api/research` to stream events (`step`, `query`, `source`, `hop`, `done`, `error`) via `text/event-stream` when requested, while retaining standard JSON response for backwards compatibility.
    - **Live Research Card (`LiveResearchCard.tsx`):**
      - Displays real-time step progression with animated spinners for active steps and green checkmarks for completed steps.
      - Displays live search queries formulated across investigative axes.
      - Streams discovered grounded sources in real time with domain tags, titles, and direct external links.
      - Upon completion, displays synthesized summary and a 1-click **"Open Review Queue"** button to review and stage proposals without silent writes (Synthex Principle #2).
- [ ] **Cloud Zotero Library Synchronization**
  - *Third-Party Dependency:* Zotero Web API (requires Zotero user API key and OAuth).
  - *Solution:* Bi-directional sync with personal Zotero web library collections.

---

# PART 3: Commercialization, Cloud Platform & SaaS Scaling
> *Enterprise cloud infrastructure, Clerk authentication, marketing landing page, Stripe billing with 3-day free trial, multi-tenant team plan, and abstract Context Credits economic engine.*

## 3.1 Google Cloud Platform (GCP) & Multi-Tenant Data Architecture (P0)

- [x] **Dual-Mode Database Architecture (Local SQLite + Cloud SQL PostgreSQL)**
  - *Objective:* Maintain zero-friction local development on SQLite while enabling multi-tenant PostgreSQL with `pgvector` in production.
  - *Architecture:*
    - Abstract DB operations in [src/lib/db.ts](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/lib/db.ts) behind a unified interface (`DatabaseProvider`).
    - Added multi-tenant columns: `userId` (TEXT) and `organizationId` (TEXT) to `projects`, `nodes`, `connections`, and `research_sessions` with tenant-isolated indexing.
    - Created `users` table: `id`, `clerkId`, `email`, `stripeCustomerId`, `subscriptionTier`, `contextCredits`, `trialEndsAt`, `createdAt`.
    - Created `credit_transactions` ledger: `id`, `userId`, `amount`, `action` (`chat`, `quick_research`, `deep_research`, `pdf_extract`, `refill`), `balanceAfter`, `metadata`, `createdAt`.
    - Provided production PostgreSQL DDL with `pgvector` HNSW indexes in [scripts/schema-postgres.sql](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/scripts/schema-postgres.sql).
- [x] **Google Cloud Storage (GCS) Document Vault**
  - *Objective:* Replace local disk `public/uploads` with enterprise durable object storage for research papers and attachments.
  - *Architecture:*
    - Configured `@google-cloud/storage` in [src/lib/storage-gcs.ts](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/lib/storage-gcs.ts).
    - Upgraded [src/app/api/upload/route.ts](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/app/api/upload/route.ts) with dynamic GCS upload when `GCS_BUCKET_NAME` is configured, automatically falling back to local disk (`public/uploads`) for zero-friction offline development.
    - Path structure: `workspaces/{projectId}/{fileName}`.
- [x] **Google Cloud Run Production Deployment**
  - *Objective:* Auto-scaling containerized Next.js deployment scaling down to 0 during idle periods to minimize operational costs.
  - *Architecture:*
    - Configured `output: 'standalone'` in [next.config.ts](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/next.config.ts).
    - Created multi-stage production [Dockerfile](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/Dockerfile) with non-root security user `nextjs` and node:20-slim.
    - Created [.dockerignore](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/.dockerignore) preventing local databases and secrets from leaking into container images.
    - Created [cloudbuild.yaml](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/cloudbuild.yaml) for automated Cloud Build pipeline deploying to Cloud Run (2 CPU, 2GB, 0 to 10 instances).

---

## 3.2 Authentication & Multi-Tenant Team Management (Clerk) (P0)

- [ ] **Clerk Authentication & App Router Route Protection**
  - *Objective:* Secure all workspace routes with seamless user onboarding, social logins, and session management.
  - *Architecture:*
    - Install `@clerk/nextjs`.
    - Configure Clerk middleware (`middleware.ts`) protecting `/app/(.*)` and `/api/(.*)`.
    - Add custom `/sign-in` and `/sign-up` views with Google OAuth and Email magic links matching Synthex's clean, minimalist aesthetic.
    - Synchronize Clerk user creation to local/cloud database via Clerk Webhook (`user.created`).
- [ ] **Clerk Organizations for Team Plan (RBAC & Shared Workspaces)**
  - *Objective:* Enable multi-user collaboration for the $29.99/seat/month Team Plan.
  - *Architecture:*
    - Integrate Clerk Organization Switcher in the top navigation bar.
    - Define Organization Roles: **Admin** (billing management, member invites, credit top-ups), **Researcher** (canvas mutations, deep research runs), **Reviewer/Viewer** (read-only and review queue approvals).
    - Workspaces can be scoped to personal (`userId`) or shared across the team (`organizationId`).

---

## 3.3 High-Converting Marketing Landing Page (P1)

- [ ] **Marketing Route Restructuring (`/` Landing Page vs `/app` Workspace)**
  - *Objective:* First-time visitors experience a stunning marketing showcase; logged-in users seamlessly enter their studio.
  - *Architecture:*
    - Move current workspace from [src/app/page.tsx](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/app/page.tsx) to `src/app/app/page.tsx`.
    - Middleware rule: Authenticated visitors hitting `/` automatically redirect to `/app`.
- [ ] **Landing Page Design & Components (`src/app/page.tsx`)**
  - *Sections:*
    1. **Navbar:** Synthex brand mark, feature anchors, live status badge, "Sign In" and "Start Free Trial" buttons.
    2. **Hero Section:** High-impact value proposition: *"Transform Unstructured Knowledge into Grounded Semantic Graphs"*. Interactive live mini-canvas demo showing cards connecting in real time.
    3. **Interactive Demo / Visual Showcase:** Highlighting the "Folded Knowledge Sheet" design metaphor, collapsible clusters, and live research streaming.
    4. **Feature Grid:**
       - *Recursive Multi-Hop Research:* Autonomous investigation via `gpt-6-luna` and Google Search Grounding.
       - *Human-in-the-Loop Review:* Zero silent writes; inspect every claim and source before committing to the canvas.
       - *Epistemic Evidence Paths:* Audit trails connecting assertions to verified source citations.
       - *PDF Citation Deep-Linking:* Direct `#page=N` page jumps and cited quote highlights.
       - *Portable Intelligence:* One-click exports to Mermaid, Obsidian/Logseq Markdown vaults, and Context Briefs.
    5. **Interactive Pricing Matrix:** Dynamic monthly / annual toggle displaying the 4 core tiers.
    6. **Social Proof & Academic / Technical Use Cases:** Testimonials from researchers, systems architects, and analysts.
    7. **FAQ Accordion & Footer:** Common questions on data ownership, privacy, API keys, and cancellation.

---

## 3.4 Stripe Monetization, Subscriptions & 3-Day Free Trial (P1)

- [ ] **Stripe Checkout & Billing Integration**
  - *Objective:* Seamless payment flow supporting subscriptions, per-seat billing, and one-click credit refills.
  - *Architecture:*
    - Install `stripe` SDK and configure Stripe Client in [src/lib/stripe.ts](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/lib/stripe.ts).
    - Create `POST /api/billing/checkout` generating Stripe Checkout sessions with pre-populated customer emails.
    - Create `POST /api/billing/portal` launching the Stripe Customer Portal for self-service subscription upgrades, payment method changes, and tax invoices.
    - Idempotent Stripe Webhook handler (`/api/webhooks/stripe`):
      - `customer.subscription.created`: Provision tier and allocate monthly credits.
      - `invoice.payment_succeeded`: Monthly credit replenishment and invoice record.
      - `customer.subscription.updated`: Handle seat count changes for Team Plans.
      - `customer.subscription.deleted`: Gracefully downgrade to Free/BYOK tier.
- [ ] **Subscription Tier Definitions & Rules**
  1. **3-Day Free Trial (No Credit Card Upfront)**
     - Triggered automatically upon Clerk signup.
     - Allocates **100 Context Credits** to explore the studio.
     - Topbar shows subtle countdown pill (`2 days left in trial`).
     - At end of Day 3 or when credits hit 0, prompts user to select a subscription plan.
  2. **BYOK / No-AI Tier ($3.00 / month)**
     - Cloud storage, multi-device sync, unlimited workspaces, GCS vault, and PDF citation deep-linking.
     - 0 platform AI credits included; user enters their own OpenAI or Gemini API key in settings.
     - Perfect for developers and researchers with existing API access.
  3. **Pro Tier ($9.99 / month)**
     - 1 User.
     - **1,500 Context Credits / month** (auto-refreshed each billing cycle).
     - Full access to managed multi-hop research (`gpt-6-luna` + Google Search Grounding), priority model queue, and 20 GB GCS vault.
  4. **Team Plan ($29.99 / seat / month)**
     - Multi-seat collaboration with Clerk Organization RBAC.
     - **5,000 Pooled Context Credits / month** shared across team members.
     - Shared collaborative workspaces, centralized review queue, and unified team billing.
  5. **Pay-as-You-Go Credit Refill Packs**
     - $5.00 for 500 Context Credits.
     - Instant replenishment without altering monthly subscription billing.

---

## 3.5 Context Credits Economic Engine & Metering UI (P1)

- [ ] **Context Credits Ledger & Deduction Middleware**
  - *Objective:* Abstract away raw dollar/token figures into a clean, predictable research currency.
  - *Architecture:*
    - Deduction engine in [src/lib/credits.ts](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/lib/credits.ts):
      - `deductCredits(userId: string, amount: number, action: string)`: Atomic transaction verifying and decrementing credit balance.
    - **Consumption Rates:**
      - **Graph Chat Question:** 1 Context Credit
      - **Quick Web-Grounded Research:** 5 Context Credits
      - **Deep Multi-Hop Research:** 20 Context Credits (multi-axis decomposition, 3 web hops, synthesis)
      - **Document AI / PDF Layout Extraction:** 2 Context Credits per page
    - Protect `/api/ai/chat` and `/api/research` routes with credit pre-check; return HTTP 402 with credit refill modal trigger when balance is insufficient.
- [ ] **Context Credits User Experience & Metering Components**
  - *UI Components:*
    - **Top Navigation Meter:** Compact pill displaying `⚡ 1,240 Context Credits` with an animated fill bar and click-to-expand breakdown drawer.
    - **Chat Composer Cost Badge:** Subtle indicator in the chat compose box displaying action cost (e.g. `1 credit` or `20 credits for Deep Research`).
    - **Refill Modal:** Sleek modal allowing users to top up 500 credits for $5 with 1-click Stripe Checkout or upgrade plan.
    - **Credits History View:** Transparency log in workspace settings showing historical deductions per session.
