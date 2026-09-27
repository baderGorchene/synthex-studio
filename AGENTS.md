<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Synthex Studio: Architecture, System Context & Technical Reference

> **Document Purpose:** Complete architectural context, system status, functional audit, known defects, and future improvement roadmap for Synthex Studio (Research Notes). Keep this document updated as the project evolves.

---

## 1. General Purpose of the Application

**Synthex Studio** is an AI-native, desktop-first, local-first research workspace designed to transform open-ended questions, web sources, and unstructured insights into a persistent, structured, and auditable **semantic knowledge graph**.

### Core Philosophy & Principles
1. **The Graph is the Source of Truth:** Freeform whiteboards lose semantic relationships over time; standard note documents obscure dependency networks. Synthex treats typed nodes (`concepts`, `claims`, `questions`, `hypotheses`, `sources`, `notes`, `clusters`) and labeled directional edges as the durable foundation.
2. **Human-in-the-Loop Review (No Silent Writes):** AI models must never unilaterally inject facts into the graph. Research runs generate *proposed changesets* held in a `pending` state until human review accepts or rejects each node and relationship.
3. **Strict Epistemic Provenance:** AI-generated claims enter the workspace with an explicit `unverified` status. Claims must link to grounded sources with citations, excerpts, and confidence ratings to achieve `supported` status.
4. **"Folded Knowledge Sheet" Metaphor:** Rather than a chaotic whiteboard, the visual design emulates a calm, paper-like surface with subtle dot grids, warm tones, and collapsible cluster sheets that act as sub-canvases framing related cards.
5. **Portable Knowledge:** Research accumulated in the graph can be exported deterministically to Mermaid diagrams, structured Context Briefs (`CONTEXT.md`), or raw JSON for consumption by downstream LLM prompts or other tools.

---

## 2. System Architecture & Dual-Generation Analysis

The repository is currently structured into two distinct architectural layers as a result of refactoring:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       ACTIVE SYSTEM ARCHITECTURE (Next.js 16)                │
│                                                                             │
│  Browser / Client (React 19)                                                 │
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌──────────────────┐  │
│  │ src/app/page.tsx      │  │ GraphCanvas.tsx       │  │ KnowledgeViews   │  │
│  │ (Workspace State,     │  │ (Viewport, Drag,      │  │ (Outline, Claims,│  │
│  │  Autosave, Modals)    │  │  Clusters, Connectors)│  │  Evidence, Hist) │  │
│  └───────────┬───────────┘  └───────────┬───────────┘  └──────────┬───────┘  │
│              │                          │                         │          │
│              └──────────────────────────┼─────────────────────────┘          │
│                                         ▼                                    │
│  Next.js Server API Routes                                                  │
│  ┌────────────────────┐ ┌─────────────────────┐ ┌──────────────────────────┐ │
│  │ /api/graph (PUT/GET)│ │ /api/research (POST)│ │ /api/ai/chat (POST)      │ │
│  │ /api/projects      │ │ /api/research/[id]  │ │ /api/metadata (GET SSRF) │ │
│  └─────────┬──────────┘ └──────────┬──────────┘ └─────────────┬────────────┘ │
│            │                       │                          │              │
│            ▼                       ▼                          ▼              │
│  Server Services & Engine                                                    │
│  ┌────────────────────────────────────────────┐ ┌──────────────────────────┐ │
│  │ src/lib/db.ts (SQLite WAL, Project-Scoped) │ │ src/lib/ai-service.ts    │ │
│  │ src/lib/graph.ts (Graph Algorithms & Norm) │ │ (Gemini 3.8 + Grounding) │ │
│  └────────────────────────────────────────────┘ └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                 LEGACY / ORPHANED PROTOTYPE ARTIFACTS (To Be Cleaned)        │
│                                                                             │
│  • src/components/canvas/* (InfiniteCanvas.tsx, CanvasCard.tsx, etc.)        │
│  • src/components/navigation/CreativeDock.tsx, StudioHeader.tsx             │
│  • src/components/modals/ApiKeyModal.tsx, SpotlightModal.tsx, etc.          │
│  • src/hooks/useCanvasInteraction.ts (Older canvas mouse/touch handler)     │
│  • src/services/gemini.ts (Client-side Gemini API calls & localStorage key) │
│  • /api/canvas, /api/nodes, /api/connections (Unscoped single-tenant routes)│
└─────────────────────────────────────────────────────────────────────────────┘
```

### Technology Stack
- **Framework:** Next.js 16.3.6 (App Router)
- **UI Library:** React 19.2.8 (`use client` state orchestrations, SVG connector rendering)
- **Styling:** Tailwind CSS 4 with custom CSS tokens in `globals.css`
- **Database:** Local SQLite via `better-sqlite3` (WAL mode enabled)
- **Icons:** `lucide-react`
- **Markdown Parsing:** `marked`
- **Testing:** Node.js native test runner (`node --experimental-strip-types --test`)
- **AI Models:** Google `gemini-3.8-flash` via REST with Google Search Grounding

---

## 3. Database Schema & Data Modeling

The database file is located at `canvas.db` in the workspace root and managed by [src/lib/db.ts](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/lib/db.ts).

### Tables
1. **`projects`**:
   - `id` (TEXT PRIMARY KEY)
   - `title` (TEXT NOT NULL)
   - `createdAt` (INTEGER NOT NULL)
   - Seeded with default workspace: `('default', 'Research workspace', 1761000000000)`.

2. **`nodes`** (Composite Primary Key: `(projectId, id)`):
   - `id` (TEXT), `projectId` (TEXT DEFAULT `'default'`)
   - `type` (TEXT: `concept`, `note`, `source`, `claim`, `question`, `hypothesis`, `image`, `link`, `group`, `section`, `task`, `ai_insight`, `research_result`)
   - `x`, `y` (REAL NOT NULL), `width`, `height` (REAL)
   - `color` (TEXT)
   - `title` (TEXT NOT NULL), `content` (TEXT), `items` (JSON text for tasks)
   - `imageUrl`, `caption`, `url`, `domain`, `description` (TEXT)
   - `metadata` (JSON text: `claimStatus`, `confidence`, `sourceIds`, `evidence`, `rationale`, `origin`, `collapsed`)
   - `createdAt` (INTEGER NOT NULL)

3. **`connections`** (Composite Primary Key: `(projectId, id)`):
   - `id` (TEXT), `projectId` (TEXT DEFAULT `'default'`)
   - `from_node` (TEXT NOT NULL), `to_node` (TEXT NOT NULL)
   - `label` (TEXT), `arrowhead` (TEXT: `end`, `both`, `start`, `none`)
   - `line_style` (TEXT: `curved`, `straight`, `stepped`)
   - `stroke_pattern` (TEXT: `solid`, `dashed`, `dotted`)
   - `color` (TEXT: `indigo`, `emerald`, `rose`, `amber`, `sky`, `purple`, `neutral`)
   - `animated` (INTEGER 0/1)
   - `metadata` (JSON text: `evidence`, `confidence`, `sourceId`)

4. **`research_sessions`**:
   - `id` (TEXT PRIMARY KEY), `projectId` (TEXT DEFAULT `'default'`)
   - `query` (TEXT), `mode` (TEXT: `quick` | `deep`), `status` (TEXT: `review` | `complete`)
   - `summary` (TEXT), `trail` (JSON text array of search queries/logs)
   - `changes` (JSON text array of `ResearchChange` payloads)
   - `createdAt` (INTEGER)

---

## 4. Current State: What is Working

The active application in [src/app/page.tsx](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/app/page.tsx) and [src/components/research/GraphCanvas.tsx](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/components/research/GraphCanvas.tsx) provides a rich, operational set of features:

### A. Graph Canvas & Spatial Interaction
- **Pan & Zoom:** Smooth panning via Hand tool, Spacebar+Drag, middle-click, and wheel zoom. Includes "Fit to Canvas" logic.
- **Card Selection & Dragging:** Single-click selection, multi-card selection via `Shift+Click` or marquee rectangular drag, and group-coordinated movement.
- **Collapsible Knowledge Clusters (Sections/Groups):**
  - Clusters calculate bounding boxes dynamically based on member positions + generous padding.
  - 8-point resize handles (`nw`, `n`, `ne`, `e`, `se`, `s`, `sw`, `w`) for manual dimensions.
  - Folding/unfolding clusters: Collapsed mode condenses cluster to a compact index sheet, hiding interior nodes.
  - Dragging nodes inside a cluster establishes `sectionId` parentage; dragging them outside detaches them.
- **Connector Topology & Edge Routing:**
  - Curved Bézier curves, straight lines, or stepped orthogonal connections.
  - Flush card contact (0-gap card attachment calculation tested in `tests/graph.test.mjs`).
  - Edge editing popover: Change relation label, line style, stroke pattern, arrowhead direction, accent color, or delete connection.
- **In-place Markdown Note Editing:** Double-click or click edit on any `note` card to trigger the embedded Markdown editor.
- **File & Media Preview:** Built-in modal viewer for attached images, PDFs, text, and data files.

### B. Project & Multi-Workspace Isolation
- **Workspace Switcher:** Dropdown in the top header to switch between isolated projects.
- **New Project Modal:** Create new blank projects or initialize with the "RAG Reference Architecture" seed graph.
- **Autosave Engine:** Debounced (450ms) autosave syncing active canvas mutations via `PUT /api/graph` with SQLite transactions.

### C. Server-Side AI Research Pipeline (`gemini-3.8-flash`)
- **Web-Grounded Research (`POST /api/research`):**
  - Executes server-side with `gemini-3.8-flash` and Google Search Grounding.
  - Extracts clean citations and verified web sources without LLM hallucinations.
  - Generates structured Blueprints: proposed concepts, claims, questions, and semantic relationships.
- **Review Drawer (`PATCH /api/research/[sessionId]`):**
  - Changes are staged in a dedicated review queue.
  - Users can inspect each proposed card and relationship, then accept or reject individually or in bulk.
  - Commits valid accepted subgraphs atomically to SQLite while dropping orphaned relationships.

### D. Graph-Grounded AI Assistant (`POST /api/ai/chat`)
- Graph Chat modal allows users to query their knowledge base.
- Strict prompt instructions force the assistant to ground responses solely in the current knowledge graph and cite actual `referencedNodeIds`.

### E. Projections & Views ([src/components/research/KnowledgeViews.tsx](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/components/research/KnowledgeViews.tsx))
- **Evidence Paths:** Direct audit view linking claims to supporting or contradicting sources with status pills (`supported`, `disputed`, `unverified`, etc.).
- **Outline View:** Sequential document-style projection of all conceptual records.
- **Sources Library:** Filtered list of all external sources and links with live domain favicons and OpenGraph preview images.
- **Claims & Questions Ledger:** Tabular overview of assertions and open research inquiries.
- **Open Questions:** Targeted list of unresolved questions to steer research.
- **Research Activity History:** Audit trail of all prior research queries, search queries executed, and review logs.

### F. URL Ingestion & Metadata Scraper (`/api/metadata`)
- Scrapes metadata (OpenGraph title, description, image, and Google favicon) for web sources.
- **Security:** Built-in SSRF defense preventing access to localhost, private IP ranges (`10.x.x.x`, `192.168.x.x`, `172.16-31.x.x`, `127.0.0.1`), and link-local addresses.

### G. Exports & Search
- **Mermaid Export:** Generates sanitized, valid Mermaid graph syntax.
- **Context Markdown (`CONTEXT.md`):** Generates deterministic markdown briefs including provenance, evidence quotes, and source URLs.
- **JSON Export:** Complete serialization of the active graph.
- **Spotlight Search (`Ctrl/Cmd+K`):** Real-time client-side search across title, content, description, URL, and node type.

---

## 5. What Parts are NOT Working / Incomplete / Discrepancies

### A. ESLint Failures in Active Code
Running `npm run lint` identifies 3 errors:
1. `src/app/page.tsx:317:13`: `let updates: Partial<CanvasNode> = { ...point };` is never reassigned (`prefer-const`).
2. `src/components/research/GraphCanvas.tsx:415:37`: `['--node-custom-color' as any]: customColor` uses explicit `any`.
3. `src/components/research/GraphCanvas.tsx:416:36`: `['--node-custom-ring' as any]: hexToRgba(...)` uses explicit `any`.

### B. Dual Architecture & Orphaned Dead Code
The repository contains an entire legacy prototype layer that is unreferenced by `src/app/page.tsx`:
- `src/components/canvas/*` (`InfiniteCanvas.tsx`, `CanvasCard.tsx`, `ArrowOptionsToolbar.tsx`, `SelectionFloatingIsland.tsx`, `node-types/*`)
- `src/components/modals/*` (`ApiKeyModal.tsx`, `ImageGenModal.tsx`, `SectionCanvasModal.tsx`, `SpotlightModal.tsx`)
- `src/components/navigation/*` (`CreativeDock.tsx`, `StudioHeader.tsx`)
- `src/hooks/useCanvasInteraction.ts`
- `src/services/gemini.ts`
- `src/app/api/canvas`, `src/app/api/nodes`, `src/app/api/connections`

*Risk:* These legacy files create cognitive overhead, inflate bundle definitions, and expose inconsistent patterns. In particular, `src/services/gemini.ts` contains client-side API key handling via `localStorage` and `NEXT_PUBLIC_GEMINI_API_KEY`, which violates the project's security rule that API keys must only live on the server.

### C. Base64 Storage & Database Bloat
When users attach images or PDF files to nodes, the modal stores the payload as inline `data:` base64 URIs within the `nodes.imageUrl` or `nodes.fileData` columns.
- Storing multi-megabyte base64 strings in SQLite drastically increases DB size and memory consumption.
- `PUT /api/graph` has a 5MB payload limit (`length > 5_000_000` returns 413). Uploading 2-3 images or a PDF can easily cause autosave to fail with an HTTP 413 error.

### D. Volatile In-Memory Undo/Redo
The undo/redo stack (`undoStack.current`, `redoStack.current`) in `src/app/page.tsx` is stored strictly in React component refs. Reloading the page or switching workspaces clears history entirely.

### E. Graph Context Truncation in AI Calls
Because vector embeddings and retrieval indices are not yet integrated:
- The AI context builder (`graphContext()` in `src/lib/ai-service.ts`) slices visible nodes at **80 nodes** and **160 edges**. Graphs larger than 80 nodes suffer truncation, meaning the AI assistant and research grounding will lose visibility into portions of large workspaces.

### F. Typeless Module Warning in Test Runner
Running `npm test` outputs:
`[MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///.../src/lib/graph.ts is not specified and it doesn't parse as CommonJS...`
This can be resolved by configuring module resolution or adding `"type": "module"` in `package.json`.

---

## 6. What Can Be Improved (Actionable Roadmap)

### Immediate Fixes
- [ ] **Fix ESLint Errors:** Convert `let updates` to `const updates` in `page.tsx` and type the CSS variable properties in `GraphCanvas.tsx` (`Record<string, string | number>` or `[key: \`--\${string}\`]: string`).
- [ ] **Clean Up Dead Code:** Archive or remove the orphaned `src/components/canvas/*`, `src/hooks/useCanvasInteraction.ts`, and `src/services/gemini.ts` files to consolidate the codebase exclusively around `src/components/research/*` and `src/lib/*`.
- [ ] **Retire Legacy API Routes:** Remove or alias `/api/nodes`, `/api/connections`, and `/api/canvas` to direct all operations through the project-scoped `/api/graph` endpoint.

### Architectural Enhancements
- [ ] **Filesystem / Blob Storage for Media:** Replace inline base64 image/file storage in SQLite with local disk storage (e.g., `public/uploads` or an OS app data directory) or S3-compatible object storage. Store only the resulting relative URL in the node record.
- [ ] **Canvas Virtualization:** For canvases with >200 nodes, implement viewport bounding box culling so DOM nodes outside the current viewport are unmounted or rendered as lightweight proxies, maintaining 60 FPS pan and zoom.
- [ ] **Vector Search & Embedding Retrieval:** Incorporate local vector embeddings (e.g. SQLite VSS, Transformers.js, or Gemini embeddings) so that graph chat and search can scale beyond the 80-node prompt window.
- [ ] **Bidirectional Markdown / Obsidian Vault Export:** Enable exporting the graph as a directory of Markdown files with `[[wikilinks]]` in frontmatter/body, allowing researchers to open their Synthex graphs directly in Obsidian or Logseq.
- [ ] **Relationship Ontology Presets:** Provide a quick-pick palette for semantic relation types (*supports*, *contradicts*, *derived_from*, *depends_on*, *extends*, *refutes*, *answers*) with semantic color-coding on edges.
- [ ] **Persistent History & Versioning:** Store snapshots of graph revisions in an `audit_log` or `graph_revisions` table in SQLite to allow persistent undo/redo and point-in-time recovery.

---

## 7. Developer & API Reference Cheatsheet

### Environment Configuration
Copy `.env.example` to `.env.local`:
```bash
GEMINI_API_KEY=your_gemini_api_key_here
```
*Note: If omitted, manual graph editing, local workspaces, search, and exports function normally. AI research and graph chat will display a configuration prompt.*

### Key Verification Commands
```bash
# Start development server
npm run dev

# Run graph integrity and math unit tests
npm test

# Run TypeScript compilation check
npx tsc --noEmit

# Run ESLint validation
npm run lint

# Build production bundle
npm run build
```

### Server API Routes Specification
| Route | Method | Description |
|---|---|---|
| `/api/projects` | `GET` | Retrieve list of all research workspace projects |
| `/api/projects` | `POST` | Create a new project (`{ title, template: 'blank' \| 'rag' }`) |
| `/api/graph?projectId=...` | `GET` | Load normalized nodes and relationships for a workspace |
| `/api/graph` | `PUT` | Atomic bulk save of workspace nodes and relationships |
| `/api/research?projectId=...` | `GET` | Retrieve research session history |
| `/api/research` | `POST` | Run web-grounded research (`{ query, mode: 'quick' \| 'deep', projectId }`) |
| `/api/research/[sessionId]` | `PATCH` | Submit review decisions (`{ decisions: [{ changeId, status: 'accepted' \| 'rejected' }] }`) |
| `/api/ai/status` | `GET` | Check if `GEMINI_API_KEY` is configured on the server |
| `/api/ai/chat` | `POST` | Query the graph assistant (`{ question, projectId, selectedNodeId? }`) |
| `/api/metadata?url=...` | `GET` | SSRF-protected metadata and favicon scraper for web sources |
