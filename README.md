# Synthex Studio: Architecture & System Design

Synthex Studio is an AI-native, desktop-first, local-first research workspace designed to transform open-ended questions, web sources, and unstructured insights into a persistent, structured, and auditable **semantic knowledge graph**.

The system operates on a **graceful degradation** model: it runs 100% offline with zero external services using local SQLite, yet seamlessly scales to enterprise multi-tenant cloud deployments with PostgreSQL, vector search, **Clerk** authentication, **Stripe** billing, **Google Cloud Platform (GCP)** storage & deployment, and multi-model Generative AI (**Google GenAI / Gemini** & **OpenAI**).

---

## 1. System Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                CLIENT / BROWSER LAYER                                  │
│  Next.js 16.3 (App Router) + React 19.2 + Tailwind CSS v4                              │
│                                                                                        │
│  ┌───────────────────────┐  ┌────────────────────────┐  ┌───────────────────────────┐  │
│  │ src/app/app/page.tsx  │  │ GraphCanvas.tsx        │  │ ToolComposer.tsx          │  │
│  │ (Workspace State,     │  │ • SVG Edge Routing     │  │ (Slash Tools: /quick,     │  │
│  │  Autosave, Review)    │  │ • 8-pt Cluster Resize  │  │  /deep, /organize, /check,│  │
│  ├───────────────────────┤  │ • Freehand SketchLayer │  │  /tidy, /audit, /new)     │  │
│  │ DocumentPane.tsx      │  │ • Floating Minimap     │  ├───────────────────────────┤  │
│  │ (PDF & Paper Reader)  │  │ • 12+ Card Node Types  │  │ ChatToolCard.tsx          │  │
│  └───────────┬───────────┘  └───────────┬────────────┘  └─────────────┬─────────────┘  │
│              │                          │                             │                │
│              │ HTTP REST / SSE          │ Yjs WebSockets              │                │
└──────────────┼──────────────────────────┼─────────────────────────────┼────────────────┘
               ▼                          ▼                             ▼
┌──────────────────────────────┐  ┌──────────────────────────────────────────────────────┐
│  NEXT.js 16 SERVER ROUTES    │  │ COLLAB RELAY SERVICE (Standalone Node Process)       │
│  • /api/graph (Autosave)     │  │                                                      │
│  • /api/ai/chat (SSE Stream) │  │ collab-server/server.mjs                             │
│  • /api/research (Deep/Hop)  │  │ Hocuspocus + Yjs CRDT In-Memory Sync                 │
│  • /api/revisions (Snapshots)│  │ Authenticated via HMAC token from /api/collab/token  │
│  • /api/metadata (SSRF-safe) │  │                                                      │
│  • /api/billing & webhooks   │  └──────────────────────────────────────────────────────┘
│  • /api/upload (GCS Vault)   │
└──────────────┬───────────────┘
               │
   ┌───────────┴───────────────────────────────────────────────────────┐
   ▼                                                                   ▼
┌───────────────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ CORE DOMAIN & PERSISTENCE (Dual DAL)          │ │ GENERATIVE AI & HYBRID GRAPH RAG     │
│                                               │ │                                      │
│ 1. Data Access Layer:                         │ │ 1. Multi-Provider GenAI:             │
│    • SQLite (better-sqlite3, WAL mode)        │ │    • Google GenAI (gemini-3.8-flash) │
│    • Neon Serverless Postgres (@neondatabase) │ │    • OpenAI (gpt-6-luna)             │
│ 2. GCP: Google Cloud Storage (Document Vault) │ │ 2. Search Grounding (Web verification)│
│ 3. Clerk: Multi-Tenant Authentication & Teams │ │ 3. Vector Embeddings: 1536d (Gemini) │
│ 4. Stripe: Metered Context Credits & Billing  │ │ 4. Hybrid Search: RRF (BM25 + Dense) │
│ 5. Security: Anti-SSRF Socket & Strict CSP    │ │ 5. Graph Walker: Personalized PageRank│
│ 6. Interoperability: Obsidian/BibTeX/Mermaid  │ │ 6. Layout Engine: Hierarchical/Grid  │
└───────────────────────────────────────────────┘ └──────────────────────────────────────┘
```

---

## 2. Core Architectural Principles

1. **The Graph is the Source of Truth:** Freeform whiteboards lose semantic relationships over time; standard note documents obscure dependency networks. Synthex treats typed nodes (`concept`, `claim`, `question`, `hypothesis`, `source`, `note`, `section`, `task`, `ai_insight`) and labeled directional edges as the durable foundation.
2. **Human-in-the-Loop Review (No Silent Writes):** AI models must never unilaterally inject facts into the graph. Research runs produce a `ResearchSession` with proposed changesets held in a `pending` state until human review accepts or rejects each node and relationship (`PATCH /api/research/[sessionId]`). Dangling edges are dropped automatically.
3. **Strict Epistemic Provenance:** AI-generated claims enter the workspace with an explicit `unverified` status. Citations are retained **only** if the URL was directly returned by the search tool; model-hallucinated URLs are stripped.
4. **"Folded Knowledge Sheet" Metaphor:** Rather than a chaotic whiteboard, the visual design emulates a calm, paper-like surface with subtle dot grids, warm tones, and collapsible cluster sheets that act as sub-canvases framing related cards.
5. **Zero-Dependency Degradation:** Every external integration is optional. Without API keys, authentication, or cloud services, the entire application operates offline using local SQLite.

---

## 3. Technology Stack & Frameworks

### A. Frontend, Visual Canvas & Tactile Design
* **Next.js 16.3.6 (App Router) & React 19.2.8**: Hybrid server/client architecture using React Server Components (RSC) and fine-grained client boundary components.
* **Tailwind CSS v4 & Paper Theming**: Custom typography and tactile style tokens (`paper.css`, `typeset.css`, `mobile.css`, `collab.css`).
* **Spatial Canvas Engine (`GraphCanvas.tsx`)**: Built natively without heavy canvas wrappers. Implements:
  * Pan and zoom matrix transformations with mouse, trackpad, and touch support.
  * 8-point cluster resize handles (`nw`, `n`, `ne`, `e`, `se`, `s`, `sw`, `w`) with dynamic bounding box calculation.
  * Collapsible cluster sheets (folds into a compact summary card, hiding interior nodes).
  * SVG connector engine supporting Bézier curves, straight lines, or orthogonal stepped paths with flush card contact.
* **Spatial Minimap (`Minimap.tsx`)**: Interactive viewport radar rendering micro-proxies of all nodes, clusters, and the viewport rectangle with click-to-pan navigation.
* **Tactile Freehand Sketch Layer (`SketchLayer.tsx`, `inkPalette.ts`)**: Canvas overlay supporting digital pen and marker ink strokes with opacity blending that stay anchored to graph coordinates.
* **Node Type System**: Specialized card renderers in `src/components/research/nodes/` for 12+ card types:
  * `ConceptCard`, `ClaimCard` (with epistemic status badges), `QuestionCard`, `HypothesisCard`
  * `SourceCard` (with favicon & domain preview), `NoteCard` (embedded markdown editor)
  * `TodoList` (interactive checklists with completion progress bars)
  * `ResearchResultCard`, `AIInsightCard`, `LinkCard`, `ImageCard`, `ResearchTaskCard`

### B. Generative AI & LLMs (Google GenAI & OpenAI)
* **Vercel AI SDK (`ai` v7, `@ai-sdk/google`, `@ai-sdk/openai`, `zod`)**: Provider-agnostic model orchestration with strict schema validation.
* **Google GenAI / Gemini (`gemini-3.8-flash`)**: Primary reasoning engine configured with live **Google Search Grounding** for verified source citations. Automatic fallback to `gemini-3.5-flash` on rate limits or service overloads.
* **OpenAI (`gpt-6-luna`)**: Alternative primary reasoning model with `openai.tools.webSearch` tool calling. Automatic 2-minute cooldown routes requests to Gemini upon transient OpenAI errors.
* **Vector Embeddings**: 1536-dimensional embeddings generated via `gemini-embedding-001` or OpenAI `text-embedding-3-small`.

### C. Authentication & Multi-Tenancy (Clerk)
* **Clerk (`@clerk/nextjs`)**:
  * Manages user identity, session lifecycle, and multi-tenant organization memberships.
  * Middleware protection in `src/middleware.ts` guards all private app routes and APIs.
  * Webhook listener at `/api/webhooks/clerk` synchronizes user accounts into the database.
  * **Offline Fallback**: If Clerk API keys are omitted from `.env.local`, the app automatically activates local developer mode (`isLocal: true`), allowing full offline usage without accounts.

### D. Billing, Subscriptions & Metering (Stripe)
* **Stripe (`stripe` SDK)**:
  * Powers subscription checkout sessions and customer portal management for 4 tiers: `trial`, `byok` ($3/mo), `pro` ($9.99/mo), and `team` ($29.99/seat/mo).
  * Webhook listener at `/api/webhooks/stripe` with cryptographic signature verification (`constructEvent`).
  * **Context Credits Engine (`src/lib/credits.ts`)**: Atomic conditional balance deductions (`UPDATE users SET credits = credits - ? WHERE credits >= ?`) prevent double-spend or race conditions. Credits are automatically refunded if an AI run fails or the user aborts.

### E. Cloud Infrastructure & Storage (Google Cloud Platform - GCP)
* **Google Cloud Storage (GCS) (`@google-cloud/storage`)**:
  * Enterprise document vault in `src/lib/storage-gcs.ts` for PDF research papers, data files, and media attachments.
  * Authenticates via `GCP_SERVICE_ACCOUNT_KEY` or ambient Application Default Credentials (ADC).
  * Local fallback to `public/uploads/{projectId}` or inline data URIs when unconfigured.
* **Google Cloud Run Deployment**:
  * Multi-stage container build targeting Cloud Run on port 8080 via [Dockerfile](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/Dockerfile) and [cloudbuild.yaml](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/cloudbuild.yaml).
  * Standalone deployment of the collaboration relay server via [collab-server/Dockerfile](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/collab-server/Dockerfile).

### F. Backend Runtime, Persistence & Security
* **Node.js 20 LTS**: Native ES Modules (`"type": "module"`) with experimental type-stripping for tests.
* **Dual-Mode Persistence (SQLite & Neon PostgreSQL)**:
  * **Local**: `better-sqlite3` in WAL mode targeting `canvas.db`.
  * **Cloud**: `@neondatabase/serverless` targeting serverless PostgreSQL with `pgvector`.
* **Real-Time Collaboration**: Hocuspocus (`@hocuspocus/server`) and Yjs (`yjs`) for WebSockets CRDT sync.
* **Security & SSRF Defense (`/api/metadata`)**:
  * URL metadata scraper checks every hop against a private-range `BlockList` (blocking `127.0.0.1`, `10.x`, `192.168.x`, `169.254.x`).
  * Pinned DNS socket lookup prevents DNS rebinding attacks. Strict CSP is enforced in `middleware.ts`.

---

## 4. Subsystem Design & Domain Engines

### A. Dual-Mode Data Access Layer (`db.ts` + `neon.ts`)
Synthex uses an abstraction layer that selects storage based on environment variables:
* **Local Mode (SQLite)**: Operates on `canvas.db` via `better-sqlite3` in WAL mode.
* **Cloud Mode (PostgreSQL / Neon)**: When `DATABASE_URL` is set, calls delegate to `@neondatabase/serverless` using connection pooling over HTTP/WebSocket.
* **Schema Migration & Tenancy**: Nodes and connections use composite primary keys `(projectId, id)`. Schemas are auto-provisioned on startup in SQLite, Neon, and documented in `scripts/schema-postgres.sql`.

### B. Multi-Provider AI Subsystem & Thinking Modes
Built on the **Vercel AI SDK** ([src/lib/ai-providers.ts](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/lib/ai-providers.ts), [src/lib/ai-research.ts](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/lib/ai-research.ts), [src/lib/ai-chat.ts](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/lib/ai-chat.ts)):
* **`/quick` (Quick Research - 5 credits)**: Single grounded search call generating core concepts and citations.
* **`/deep` (Deep Multi-Hop Research - 25 credits)**:
  1. Decomposes inquiries into 3 investigative axes (foundations, empirical evidence, controversies).
  2. Executes Grounded Hop 1.
  3. Targets unresolved questions in Grounded Hop 2.
  4. Stitches nodes together across hops, namespaces IDs, and merges duplicate titles.
* **`/organize` (Thinking Tool - 2 credits)**: Restructures up to 6,000 characters of raw, messy notes into goals, ideas, claims, hunches, open questions, and to-do cards without hallucinating outside facts.
* **`/check` (Thinking Tool - 10 credits)**: Synthesizes notes, then uses live web search grounding to verify tools, library versions, pricing, and rules for deprecations or better alternatives, linking findings with `contradicts`, `replaces`, or `supports` edges.
* **Unified Input Composer (`ToolComposer.tsx`)**: Single ruled-line composer with a paperclip tool picker and slash commands (`/quick`, `/deep`, `/organize`, `/check`, `/tidy`, `/audit`, `/new`).
* **Chat Memory & Assistant**: Persistent conversation memory in `chat_messages`. Follow-up queries combine earlier questions into search text; cited nodes seed the graph walk (`extraSeedIds`). Emits typed tool calls (`research`, `recommend_improvements`, `organize_layout`, `propose_nodes`).

### C. Graph RAG & Hybrid Retrieval Engine (`src/lib/rag/`)
* **Vector Embeddings**: 1536-dimensional normalized vectors generated using `gemini-embedding-001` or `text-embedding-3-small`. Vectors are provider-tagged to prevent cross-space distance corruption.
* **Dual Index**: Uses `sqlite-vec` + FTS5 in SQLite, or `pgvector` + `tsvector` in Neon PostgreSQL.
* **Hybrid Search (RRF)**: Combines dense vector cosine similarity with sparse full-text search using Reciprocal Rank Fusion.
* **Personalized PageRank**: `graph-walker.ts` extracts semantic subgraphs around retrieved focal nodes to compile a compact, token-budgeted reasoning context.

### D. Real-Time Collaboration Relay (`collab-server/`)
* **Hocuspocus + Yjs CRDTs**: Dedicated Node.js relay process (`collab-server/server.mjs`) holding open map rooms in memory.
* **Authentication**: Clients join using short-lived HMAC-SHA256 tokens generated by `/api/collab/token`.
* **State Management**: Syncs nodes and connections as `Y.Map` collections, broadcasts live user presence (cursors, selections, active card editors), and rebases undo/redo history.

### E. In-Workspace Document Intelligence & PDF Pane
* **Files**: [src/components/research/DocumentPane.tsx](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/components/research/DocumentPane.tsx), [src/lib/document.ts](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/lib/document.ts)
* **What it does**: Split-screen document reader allowing researchers to read uploaded PDFs and research papers side-by-side with the knowledge graph. Supports page-by-page text extraction, excerpt highlighting, and citation jumps that link PDF pages directly to `claim` or `evidence` cards on the board.

### F. Algorithmic Graph Layout Engine (`src/lib/graph-organizer.ts`)
Provides programmatic layout algorithms triggered via the assistant's `organize_layout` tool or the `/tidy` command:
1. **Hierarchical / Tree Layout**: Arranges nodes top-down based on directional edge dependencies (`depends_on`, `derived_from`).
2. **Grouped by Type**: Clusters nodes into neat spatial columns by archetype (`concept`, `claim`, `question`, `source`).
3. **Compact Grid**: Tight packing algorithm that reorganizes sprawling boards to minimize whitespace.

### G. Graph Versioning, Snapshots & Revisions Ledger
* **Point-in-Time Recovery (`/api/revisions`)**: Snapshots complete graph states into an audit table on significant milestones, allowing researchers to inspect revision history and roll back changes.
* **Database Backup (`/api/backup`)**: Allows downloading the raw SQLite `.db` file in local mode.

### H. Knowledge Interoperability & Export Engine
Synthex provides deterministic export pipelines to integrate with external tools:
* **Obsidian & Logseq Vault ZIP ([src/lib/vault-export.ts](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/lib/vault-export.ts))**: Packages the graph into a `.zip` archive containing individual Markdown files per card, with YAML frontmatter and bidirectional `[[wikilinks]]`.
* **Academic BibTeX ([src/lib/bibtex.ts](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/lib/bibtex.ts))**: Generates standard `.bib` bibliographies for Zotero, Mendeley, and LaTeX.
* **Vector Graphic Exporters ([src/lib/canvas-export.ts](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/lib/canvas-export.ts))**: Renders the visual canvas to pure vector SVG and high-resolution PNG image formats.
* **Mermaid & Context Markdown ([src/lib/graph.ts](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/lib/graph.ts))**: Generates clean Mermaid diagrams and structured `CONTEXT.md` briefs for downstream LLM prompts.

---

## 5. Context Credits Economic Model

AI and document extraction operations consume **Context Credits** defined in [src/lib/plans.ts](file:///c:/Users/badrg/OneDrive/Documents/projects/research%20notes/src/lib/plans.ts):

| Action | Slash Command / Trigger | Credit Cost | Description |
|---|---|---|---|
| **Graph Chat** | Plain text / Ask AI | **1 credit** | Query the graph with RAG context and persistent memory |
| **Synthesize Notes** | `/organize` | **2 credits** | Organize raw notes into goals, claims, questions, and to-dos |
| **Quick Research** | `/quick` | **5 credits** | Fast web-grounded research generating initial cards |
| **Fact-Check Specifics** | `/check` | **10 credits** | Organize notes + verify tool versions, pricing, and rules |
| **Deep Multi-Hop Research** | `/deep` | **25 credits** | 3-axis planning + 2-hop grounded deep research |
| **PDF Text Extraction** | Upload PDF / Read | **1 credit / page** | Extract text and index document excerpts for citations |

---

## 6. External Services Summary

| Service | Category | Integration File | Configuration |
|---|---|---|---|
| **Google GenAI / Gemini API** | LLM & Search Grounding | `src/lib/ai-providers.ts` | `GEMINI_API_KEY` (`gemini-3.8-flash`, `gemini-embedding-001`) |
| **OpenAI API** | LLM & Web Search | `src/lib/ai-providers.ts` | `OPENAI_API_KEY` (`gpt-6-luna`, `text-embedding-3-small`) |
| **Clerk** | Authentication & Teams | `src/middleware.ts`, `src/lib/auth.ts` | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` |
| **Stripe** | Subscriptions & Credits | `src/lib/stripe.ts` | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| **Google Cloud Platform (GCP)** | Document Vault (GCS) & Hosting (Cloud Run) | `src/lib/storage-gcs.ts`, `Dockerfile` | `GCS_BUCKET_NAME`, `GCP_SERVICE_ACCOUNT_KEY` |
| **Neon** | Serverless PostgreSQL | `src/lib/neon.ts` | `DATABASE_URL` (with `pgvector` extension) |
| **Hocuspocus (Yjs)** | Real-Time Sync Server | `collab-server/server.mjs` | `COLLAB_SERVER_URL`, `COLLAB_SECRET` |

---

## 7. Development & Verification

### Local Setup
```bash
# 1. Install dependencies
npm install

# 2. Configure environment (Optional - runs offline without keys)
cp .env.example .env.local

# 3. Start development server (UI at http://localhost:3000/app)
npm run dev

# 4. Optional: Start collaboration relay server
npm run collab
```

### Verification & Quality Commands
```bash
# Run unit and graph integrity tests
npm test

# Run TypeScript compilation check
npx tsc --noEmit

# Run ESLint validation
npm run lint

# Build production bundle
npm run build
```

### Docker & Deployment
```bash
# Build production Docker container for Google Cloud Run
docker build -t synthex-studio .

# Run container locally on port 8080
docker run -p 8080:8080 --env-file .env.local synthex-studio
```
