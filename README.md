# Synthex Research Workspace

Synthex is a local-first research workspace built around a persistent knowledge graph. Organize concepts, claims, questions, sources, and relationships on a canvas; review AI research proposals before adding them; and export the graph as JSON, Mermaid, or a context Markdown brief.

## Run locally

```bash
npm install
Copy-Item .env.example .env.local
# Add GEMINI_API_KEY to .env.local to enable graph chat and web-grounded research.
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The SQLite database is `canvas.db` in the project directory. Existing records are retained when the graph schema is upgraded.

Without a Gemini key, manual graph editing, project workspaces, search, and exports still work. The API key is read only on the server and is never sent to the browser.

## Work with the graph

- Add concepts, claims, questions, hypotheses, sources, notes, or knowledge clusters.
- Select the relationship tool, then choose two records to connect them.
- Fold a cluster to focus the sheet; use the inspector to edit records.
- Search with `Ctrl/⌘ K`, use undo/redo, and let changes autosave to SQLite.
- Run quick or deep research. Proposed records remain pending until reviewed; generated claims begin unverified.
- Use the outline, evidence paths, claims, sources, open questions, and research history views to inspect the same graph from different angles.

## API routes

- `GET /api/projects`, `POST /api/projects`
- `GET /api/graph?projectId=…`, `PUT /api/graph`
- `GET /api/research?projectId=…`, `POST /api/research`
- `PATCH /api/research/:sessionId`
- `POST /api/ai/chat`, `GET /api/ai/status`

Projects are currently local workspaces, not authenticated accounts. Authentication, invitations, hosted multi-user storage, provider selection, URL/Markdown source ingestion, and vector search are not configured in this MVP.

## Verify

```bash
npm test
npx tsc --noEmit
npm run build
```
