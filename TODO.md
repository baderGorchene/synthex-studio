# Synthex Studio — Feature Roadmap & Issue Backlog

> **Document Status:** Derived from system architecture, security audit, and technical analysis in [AGENTS.md](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/AGENTS.md). Divided into **Code-Only / Local Tasks** (0 external APIs, 100% offline) and **AI & Third-Party Tasks** (requires API keys / cloud services).

---

## Progress Dashboard

| Section | Focus | Pending | In Progress | Completed |
|---|---|---|---|---|
| **Part 1: Code-Only & Local** | Storage, Canvas UI, Math, Exports, Cleanups | 3 | 0 | 15 |
| **Part 2: AI & External Services** | Gemini Embeddings, Google Search Grounding, SSE | 3 | 0 | 0 |
| **Total** | | **6** | **0** | **15** |

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

- [ ] **Obsidian / Logseq Vault Export (.zip)**
  - Export workspace as a `.zip` archive containing standard Markdown files with `[[wikilinks]]` in the body/frontmatter, preserving the semantic network for external markdown tools.
- [ ] **BibTeX Academic Ingestion (.bib)**
  - Local client-side parser for `.bib` files, converting academic papers, DOIs, and abstracts directly into typed `source` nodes.
- [ ] **PNG / SVG High-Resolution Canvas Export**
  - Export visible canvas or entire graph boundary as publication-ready vector SVG or high-DPI PNG image using HTML5 Canvas.

---

## 1.5 Local Document Linking (P2)

- [ ] **PDF Citation Deep-Linking**
  - For attached PDF sources, record page numbers and quote excerpts in `metadata.evidence`.
  - Clicking an evidence badge in a claim opens the built-in PDF viewer directly scrolled to `#page=N`.

---

# PART 2: External Services & AI Tasks (Requires Third-Party APIs)
> *Requires cloud connectivity and API keys (`GEMINI_API_KEY`, Search Grounding, or external OAuth).*

## 2.1 AI Scaling & Live Web Grounding

- [ ] **Vector Embeddings & Semantic Indexing (Remove 80-Node Limit)**
  - *Current Defect:* `graphContext()` in `src/lib/ai-service.ts` hard-truncates graphs at **80 nodes** and **160 edges** to fit context windows. Large workspaces lose grounding.
  - *Third-Party Dependency:* Google Gemini `text-embedding-004` API (or OpenAI Embeddings).
  - *Solution:*
    - Generate vector embeddings for node title/content on create/update.
    - Store vectors in SQLite (via `sqlite-vss` or cosine similarity table).
    - Retrieve top-k relevant subgraphs dynamically for AI Chat and Research runs.
- [ ] **Server-Sent Events (SSE) Streaming for AI Responses**
  - *Third-Party Dependency:* Google Gemini Streaming REST API.
  - *Solution:* Stream response tokens in `/api/ai/chat` and `/api/research` for real-time progress indicators instead of blocking HTTP requests.
- [ ] **Recursive Multi-Step Research Runs ("Deep Research" Mode)**
  - *Third-Party Dependency:* Google Search Grounding Tool + Gemini LLM (`gemini-3.8-flash`).
  - *Solution:* Autonomous multi-hop search execution: generate initial findings, formulate follow-up search queries on unresolved questions, and synthesize cross-source claims.
- [ ] **Cloud Zotero Library Synchronization**
  - *Third-Party Dependency:* Zotero Web API (requires Zotero user API key and OAuth).
  - *Solution:* Bi-directional sync with personal Zotero web library collections.
