# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Next.js 16 warning

This is Next.js 16.3 / React 19.2 and has breaking changes. APIs, conventions, and file structure may all differ from your training data. Before writing framework code, read the relevant guide in `node_modules/next/dist/docs/` and pay attention to deprecation notices. `next dev` keeps a managed rules block in `AGENTS.md`. Leave it in place.

`AGENTS.md`, `README.md`, `GRAPH.md` and `TODO.md` contain long design and audit notes. Parts of them are **out of date**: they describe a SQLite-only, unauthenticated MVP with legacy code in `src/`. The code is the source of truth. The current state is described below.

## Commands

```bash
npm run dev              # dev server on :3000 (workspace UI at /app, landing page at /)
npm run build
npm run lint             # eslint (flat config)
npx tsc --noEmit         # type check
npm test                 # node --experimental-strip-types --test tests/graph.test.mjs
node --experimental-strip-types --test --test-name-pattern="normalizes a graph" tests/graph.test.mjs   # single test
```

The tests in `tests/graph.test.mjs` import the `.ts` sources in `src/lib`, `src/types` and `src/utils` directly through Node type-stripping. Any module these tests reach must therefore use explicit `.ts` extensions in relative imports (e.g. `import { normalizeGraph } from './graph.ts'`). It also must not use TS-only syntax that type-stripping rejects, such as enums and parameter properties. Route handlers and components use the `@/` alias instead.

## Architecture

### Product model
Synthex Studio is a research workspace built on a typed knowledge graph. Nodes include concept, claim, question, hypothesis, source, note, section/group clusters and others; edges are labeled relationships. The core invariant: **AI never writes directly to the graph.** Research runs produce a `ResearchSession` whose `changes` stay `pending` until the user accepts or rejects each one (`PATCH /api/research/[sessionId]`). Only the accepted subgraph is committed; edges left dangling are dropped. AI-generated claims start with `claimStatus: 'unverified'`.

### Frontend
- `src/app/page.tsx` is the marketing landing page. `src/app/app/page.tsx` is the main workspace (~2.4k lines). It holds all client state: the active project, nodes and edges, undo/redo, modals, and a debounced autosave that sends the whole graph with `PUT /api/graph`.
- `src/components/research/GraphCanvas.tsx` handles pan/zoom, dragging, marquee selection, cluster (section) bounding boxes and folding, and SVG connector routing. Each node type has its own card component in `components/research/nodes/`, and `nodes/index.tsx` dispatches between them.
- `KnowledgeViews.tsx` renders the non-canvas views of the same graph: outline, evidence paths, claims, sources, questions, and history.
- Shared types, including `CanvasNode`, `Connection`, `ResearchSession` and `ONTOLOGY_PRESETS`, live in `src/types/canvas.ts`.

### Graph core (`src/lib/graph.ts`)
This module contains the pure functions: `normalizeGraph` (which rejects duplicate or dangling IDs), `addNode`, `addRelationship`, `removeNode`, `neighborhood`, and the Mermaid and `CONTEXT.md` exporters. Both server routes and tests depend on it. Other pure exporters live in `vault-export.ts` (Obsidian zip), `bibtex.ts` and `canvas-export.ts` (SVG).

### Persistence: dual-mode (`src/lib/db.ts` + `src/lib/neon.ts`)
- If `DATABASE_URL`, `POSTGRES_URL` or `STORAGE_URL` is set (`isNeonConfigured()`), every exported `db.ts` function delegates to its `neon*` counterpart in `neon.ts`, which uses Neon serverless Postgres over HTTP. Otherwise the functions use local SQLite (`canvas.db`, WAL, `better-sqlite3`, loaded lazily through `createRequire`).
- Because of this, db functions return `T | Promise<T>`. **Always `await` them.** Any schema change has to be made in three places: SQLite (`ensureSchemaColumns` / create statements in `db.ts`), Neon's auto-init in `neon.ts`, and `scripts/schema-postgres.sql`.
- Nodes and connections have a composite primary key `(projectId, id)`. Every query is scoped by project.
- Graph revisions (persistent history/restore) are served by `/api/revisions`. SQLite file backups are served by `/api/backup`.

### Auth, tenancy, billing
- `src/middleware.ts` + `src/lib/auth.ts` (`getServerAuth()`) use Clerk **only when** both Clerk keys are set. Without them, requests run as a local user (`local_researcher`, pro tier) and `isLocal: true`.
- The route handler pattern is: `getServerAuth()` → `userHasProjectAccess(projectId, userId, orgId, clerkId)` → return 404 if access is denied.
- AI routes check and deduct "Context Credits" (`src/lib/credits.ts`, `CREDIT_RATES`) before calling models. Stripe subscriptions and top-ups go through `src/lib/stripe.ts`, `/api/billing/*` and `/api/webhooks/stripe`. Clerk user sync goes through `/api/webhooks/clerk`.

### AI and retrieval (server-only)
- `src/lib/ai-service.ts` is provider-abstracted. It uses Gemini (`gemini-3.8-flash`, with Google Search grounding for research) and OpenAI as an optional fallback. API keys are read only on the server. Never add client-side model calls.
- Graph RAG (`src/lib/rag/`): embeddings go into a `sqlite-vec` store. `vector-store.ts` does hybrid search and `graph-walker.ts` extracts the reasoning subgraph. `context-builder.ts` assembles a context that fits a token budget. On serverless/Neon, sqlite-vec can fail to load, and the code degrades without it. `PUT /api/graph` calls `indexGraphNodes` to keep embeddings current.
- `graph-analyst.ts` / `graph-organizer.ts` provide AI-assisted analysis and layout of the graph.

### Uploads
`POST /api/upload` stores a file in GCS when `GCS_BUCKET_NAME` is set (`storage-gcs.ts`). Otherwise it writes to `public/uploads/{projectId}/`. On read-only serverless filesystems it falls back to an inline data URI. Nodes store only the returned URL. `PUT /api/graph` rejects bodies over 5 MB, so large base64 payloads in nodes will break autosave.

### Security
`/api/metadata` (OpenGraph scraper) is public and includes SSRF guards that block private, loopback and link-local addresses. Keep those guards when you change it.

## Deployment
The app runs in two targets. The `Dockerfile` and `cloudbuild.yaml` build it for Google Cloud Run (port 8080). On Vercel it uses Neon, and SQLite falls back to `/tmp/canvas.db`. `.env.example` documents all environment variables. Every integration is optional: with only `GEMINI_API_KEY` set, or with nothing at all, the app runs fully offline on SQLite.

## Removed legacy code
The old canvas prototype (client-side Gemini calls, unscoped `/api/nodes|connections|canvas` routes, per-node CRUD in db.ts) was deleted. All writes go through `PUT /api/graph` → `bulkSaveCanvasToDb`. Don't reintroduce per-node write paths.
