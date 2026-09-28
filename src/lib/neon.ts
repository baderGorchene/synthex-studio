/**
 * Synthex Studio: Neon Serverless PostgreSQL Database Engine
 * Pure HTTP serverless client for durable, production-grade cloud persistence.
 * Zero native binary dependencies, 100% compatible with Vercel and AWS Lambda.
 */

import { neon } from '@neondatabase/serverless';
import type {
  AccentColor,
  ArrowheadType,
  CanvasNode,
  CanvasNodeType,
  Connection,
  ConnectionColor,
  ConnectionLineStyle,
  ConnectionStrokePattern,
  GraphRevision,
  GraphRevisionSummary,
  ResearchChangeStatus,
  ResearchSession
} from '../types/canvas';
import { SEED_CONNECTIONS, SEED_NODES } from '../constants/seedData.ts';
import { addNode, addRelationship, normalizeGraph } from './graph.ts';
import type { CreditTransaction, ResearchProject, UserRecord } from './db.ts';

export function isNeonConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.STORAGE_URL);
}

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.STORAGE_URL;
  if (!url) {
    throw new Error('Neon database connection string (DATABASE_URL, POSTGRES_URL, or STORAGE_URL) is not set.');
  }
  return url;
}

function getSql() {
  return neon(getDatabaseUrl());
}

let schemaInitializationPromise: Promise<void> | null = null;
let isInitializingSchema = false;

export async function ensureNeonSchema(): Promise<void> {
  if (!isNeonConfigured()) return;
  if (isInitializingSchema) return;
  if (!schemaInitializationPromise) {
    schemaInitializationPromise = (async () => {
      isInitializingSchema = true;
      try {
        const sql = getSql();

      // 1. Create tables if not exists
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(64) PRIMARY KEY,
          clerk_id VARCHAR(128) UNIQUE NOT NULL,
          email VARCHAR(255),
          name VARCHAR(255),
          stripe_customer_id VARCHAR(128) UNIQUE,
          stripe_subscription_id VARCHAR(128),
          subscription_tier VARCHAR(32) NOT NULL DEFAULT 'trial',
          subscription_status VARCHAR(32) NOT NULL DEFAULT 'active',
          seat_count INTEGER DEFAULT 1,
          billing_interval VARCHAR(32) DEFAULT 'month',
          current_period_end BIGINT,
          context_credits INTEGER NOT NULL DEFAULT 100,
          trial_ends_at BIGINT,
          created_at BIGINT NOT NULL
        )
      `;

      await sql`CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id)`;

      await sql`
        CREATE TABLE IF NOT EXISTS credit_transactions (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) NOT NULL,
          amount INTEGER NOT NULL,
          action VARCHAR(64) NOT NULL,
          balance_after INTEGER NOT NULL,
          metadata TEXT,
          created_at BIGINT NOT NULL
        )
      `;

      await sql`CREATE INDEX IF NOT EXISTS idx_credit_tx_user_created ON credit_transactions(user_id, created_at DESC)`;

      await sql`
        CREATE TABLE IF NOT EXISTS projects (
          id VARCHAR(64) PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          user_id VARCHAR(64),
          organization_id VARCHAR(128),
          created_at BIGINT NOT NULL
        )
      `;

      await sql`CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)`;

      await sql`
        CREATE TABLE IF NOT EXISTS nodes (
          id VARCHAR(64) NOT NULL,
          project_id VARCHAR(64) NOT NULL,
          user_id VARCHAR(64),
          organization_id VARCHAR(128),
          type VARCHAR(32) NOT NULL,
          x DOUBLE PRECISION NOT NULL,
          y DOUBLE PRECISION NOT NULL,
          width DOUBLE PRECISION,
          height DOUBLE PRECISION,
          color VARCHAR(32),
          title TEXT NOT NULL,
          content TEXT,
          items TEXT,
          image_url TEXT,
          caption TEXT,
          url TEXT,
          domain VARCHAR(255),
          description TEXT,
          section_id VARCHAR(64),
          file_data TEXT,
          file_name VARCHAR(255),
          file_size BIGINT,
          file_type VARCHAR(32),
          page_count INTEGER,
          metadata TEXT,
          created_at BIGINT NOT NULL,
          PRIMARY KEY (project_id, id)
        )
      `;

      await sql`CREATE INDEX IF NOT EXISTS idx_nodes_project ON nodes(project_id)`;

      await sql`
        CREATE TABLE IF NOT EXISTS connections (
          id VARCHAR(64) NOT NULL,
          project_id VARCHAR(64) NOT NULL,
          user_id VARCHAR(64),
          organization_id VARCHAR(128),
          from_node VARCHAR(64) NOT NULL,
          to_node VARCHAR(64) NOT NULL,
          label VARCHAR(64),
          arrowhead VARCHAR(32) DEFAULT 'end',
          line_style VARCHAR(32) DEFAULT 'curved',
          stroke_pattern VARCHAR(32) DEFAULT 'solid',
          color VARCHAR(32) DEFAULT 'neutral',
          animated BOOLEAN DEFAULT TRUE,
          metadata TEXT,
          created_at BIGINT NOT NULL,
          PRIMARY KEY (project_id, id)
        )
      `;

      await sql`CREATE INDEX IF NOT EXISTS idx_connections_project ON connections(project_id)`;

      await sql`
        CREATE TABLE IF NOT EXISTS research_sessions (
          id VARCHAR(64) PRIMARY KEY,
          project_id VARCHAR(64) NOT NULL,
          user_id VARCHAR(64),
          organization_id VARCHAR(128),
          query TEXT NOT NULL,
          mode VARCHAR(32) NOT NULL,
          status VARCHAR(32) NOT NULL,
          summary TEXT NOT NULL,
          trail TEXT NOT NULL,
          changes TEXT NOT NULL,
          created_at BIGINT NOT NULL
        )
      `;

      await sql`CREATE INDEX IF NOT EXISTS idx_research_sessions_project ON research_sessions(project_id, created_at DESC)`;

      await sql`
        CREATE TABLE IF NOT EXISTS graph_revisions (
          id VARCHAR(64) PRIMARY KEY,
          project_id VARCHAR(64) NOT NULL,
          title VARCHAR(255) NOT NULL,
          node_count INTEGER NOT NULL,
          edge_count INTEGER NOT NULL,
          graph_data TEXT NOT NULL,
          created_at BIGINT NOT NULL
        )
      `;

      await sql`CREATE INDEX IF NOT EXISTS idx_graph_revisions_project ON graph_revisions(project_id, created_at DESC)`;

      // 2. Ensure default workspace exists
      const existingProjects = await sql`SELECT id FROM projects WHERE id = 'default' LIMIT 1`;
      if (existingProjects.length === 0) {
        await sql`
          INSERT INTO projects (id, title, created_at)
          VALUES ('default', 'Research workspace', ${Date.now()})
          ON CONFLICT (id) DO NOTHING
        `;
      }

      // 3. Ensure default seed nodes exist
      const existingNodes = await sql`SELECT count(*)::int as count FROM nodes WHERE project_id = 'default'`;
      const nodeCount = Number(existingNodes[0]?.count || 0);
      if (nodeCount === 0) {
        await neonBulkSaveCanvas(SEED_NODES, SEED_CONNECTIONS, 'default');
      }
    } finally {
      isInitializingSchema = false;
    }
  })().catch(err => {
    schemaInitializationPromise = null;
    isInitializingSchema = false;
    console.error('Neon schema initialization failed:', err);
    throw err;
  });
  }

  return schemaInitializationPromise;
}

// ============================================================================
// Projects
// ============================================================================

export async function neonGetProjects(): Promise<ResearchProject[]> {
  await ensureNeonSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT id, title, created_at
    FROM projects
    ORDER BY created_at ASC
  `;
  return rows.map(r => ({
    id: String(r.id),
    title: String(r.title),
    createdAt: Number(r.created_at)
  }));
}

export async function neonProjectExists(id: string): Promise<boolean> {
  await ensureNeonSchema();
  const sql = getSql();
  const rows = await sql`SELECT 1 FROM projects WHERE id = ${id} LIMIT 1`;
  return rows.length > 0;
}

export async function neonCreateProject(
  id: string,
  title: string,
  template: 'blank' | 'rag' = 'blank'
): Promise<ResearchProject> {
  await ensureNeonSchema();
  const sql = getSql();
  const createdAt = Date.now();
  await sql`
    INSERT INTO projects (id, title, created_at)
    VALUES (${id}, ${title}, ${createdAt})
  `;

  if (template === 'rag') {
    const ids = new Map(SEED_NODES.map(node => [node.id, `${id}-${node.id}`]));
    const nodes = SEED_NODES.map(node => ({
      ...node,
      id: ids.get(node.id)!,
      metadata: node.metadata ? { ...node.metadata } : undefined
    }));
    const connections = SEED_CONNECTIONS.map(edge => ({
      ...edge,
      id: `${id}-${edge.id}`,
      from: ids.get(edge.from)!,
      to: ids.get(edge.to)!
    }));
    await neonBulkSaveCanvas(nodes, connections, id);
  }

  return { id, title, createdAt };
}

// ============================================================================
// Nodes
// ============================================================================

interface RawNeonNode {
  id: string;
  project_id: string;
  type: string;
  x: number;
  y: number;
  width: number | null;
  height: number | null;
  color: string | null;
  title: string;
  content: string | null;
  items: string | null;
  image_url: string | null;
  caption: string | null;
  url: string | null;
  domain: string | null;
  description: string | null;
  section_id: string | null;
  file_data: string | null;
  file_name: string | null;
  file_size: number | null;
  file_type: string | null;
  page_count: number | null;
  metadata: string | null;
  created_at: number | string;
}

function mapNeonNode(row: RawNeonNode): CanvasNode {
  return {
    id: row.id,
    type: row.type as CanvasNodeType,
    x: Number(row.x),
    y: Number(row.y),
    width: row.width != null ? Number(row.width) : undefined,
    height: row.height != null ? Number(row.height) : undefined,
    color: (row.color as AccentColor) ?? 'neutral',
    title: row.title || (row.type === 'section' ? 'Untitled cluster' : 'Untitled record'),
    content: row.content ?? undefined,
    items: row.items ? (typeof row.items === 'string' ? JSON.parse(row.items) : row.items) : undefined,
    imageUrl: row.image_url ?? undefined,
    caption: row.caption ?? undefined,
    url: row.url ?? undefined,
    domain: row.domain ?? undefined,
    description: row.description ?? undefined,
    sectionId: row.section_id ?? undefined,
    fileData: row.file_data ?? undefined,
    fileName: row.file_name ?? undefined,
    fileSize: row.file_size != null ? Number(row.file_size) : undefined,
    fileType: row.file_type ?? undefined,
    pageCount: row.page_count != null ? Number(row.page_count) : undefined,
    metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : undefined,
    createdAt: Number(row.created_at)
  };
}

export async function neonGetAllNodes(projectId = 'default'): Promise<CanvasNode[]> {
  await ensureNeonSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT * FROM nodes
    WHERE project_id = ${projectId}
    ORDER BY created_at ASC
  `) as unknown as RawNeonNode[];

  return rows.map(mapNeonNode);
}

export async function neonSaveNode(node: CanvasNode, projectId = 'default'): Promise<void> {
  await ensureNeonSchema();
  const sql = getSql();
  await sql`
    INSERT INTO nodes (
      id, project_id, type, x, y, width, height, color, title, content, items,
      image_url, caption, url, domain, description, section_id, file_data, file_name, file_size, file_type, page_count, metadata, created_at
    ) VALUES (
      ${node.id},
      ${projectId},
      ${node.type},
      ${node.x},
      ${node.y},
      ${node.width ?? null},
      ${node.height ?? null},
      ${node.color ?? 'neutral'},
      ${node.title},
      ${node.content ?? null},
      ${node.items ? JSON.stringify(node.items) : null},
      ${node.imageUrl ?? null},
      ${node.caption ?? null},
      ${node.url ?? null},
      ${node.domain ?? null},
      ${node.description ?? null},
      ${node.sectionId ?? null},
      ${node.fileData ?? null},
      ${node.fileName ?? null},
      ${node.fileSize ?? null},
      ${node.fileType ?? null},
      ${node.pageCount ?? null},
      ${node.metadata ? JSON.stringify(node.metadata) : null},
      ${node.createdAt}
    )
    ON CONFLICT (project_id, id) DO UPDATE SET
      type = EXCLUDED.type,
      x = EXCLUDED.x,
      y = EXCLUDED.y,
      width = EXCLUDED.width,
      height = EXCLUDED.height,
      color = EXCLUDED.color,
      title = EXCLUDED.title,
      content = EXCLUDED.content,
      items = EXCLUDED.items,
      image_url = EXCLUDED.image_url,
      caption = EXCLUDED.caption,
      url = EXCLUDED.url,
      domain = EXCLUDED.domain,
      description = EXCLUDED.description,
      section_id = EXCLUDED.section_id,
      file_data = EXCLUDED.file_data,
      file_name = EXCLUDED.file_name,
      file_size = EXCLUDED.file_size,
      file_type = EXCLUDED.file_type,
      page_count = EXCLUDED.page_count,
      metadata = EXCLUDED.metadata
  `;
}

export async function neonUpdateNodePosition(id: string, x: number, y: number, projectId = 'default'): Promise<void> {
  await ensureNeonSchema();
  const sql = getSql();
  await sql`UPDATE nodes SET x = ${x}, y = ${y} WHERE id = ${id} AND project_id = ${projectId}`;
}

export async function neonUpdateMultipleNodePositions(
  positions: { id: string; x: number; y: number }[],
  projectId = 'default'
): Promise<void> {
  await ensureNeonSchema();
  const sql = getSql();
  if (positions.length === 0) return;
  await Promise.all(
    positions.map(p => sql`UPDATE nodes SET x = ${p.x}, y = ${p.y} WHERE id = ${p.id} AND project_id = ${projectId}`)
  );
}

export async function neonUpdateNode(id: string, fields: Partial<CanvasNode>, projectId = 'default'): Promise<void> {
  await ensureNeonSchema();
  const sql = getSql();
  const rows = (await sql`SELECT * FROM nodes WHERE id = ${id} AND project_id = ${projectId} LIMIT 1`) as unknown as RawNeonNode[];
  if (rows.length === 0) return;
  const existing = mapNeonNode(rows[0]);

  const updated: CanvasNode = {
    ...existing,
    ...fields,
    id,
    createdAt: existing.createdAt
  };

  await neonSaveNode(updated, projectId);
}

export async function neonDeleteNode(id: string, projectId = 'default'): Promise<void> {
  await ensureNeonSchema();
  const sql = getSql();
  await sql`DELETE FROM nodes WHERE id = ${id} AND project_id = ${projectId}`;
  await sql`DELETE FROM connections WHERE (from_node = ${id} OR to_node = ${id}) AND project_id = ${projectId}`;
}

// ============================================================================
// Connections
// ============================================================================

interface RawNeonConnection {
  id: string;
  project_id: string;
  from_node: string;
  to_node: string;
  label: string | null;
  arrowhead: string | null;
  line_style: string | null;
  stroke_pattern: string | null;
  color: string | null;
  animated: boolean | null;
  metadata: string | null;
}

function mapNeonConnection(row: RawNeonConnection): Connection {
  return {
    id: row.id,
    from: row.from_node,
    to: row.to_node,
    label: row.label ?? undefined,
    arrowhead: (row.arrowhead as ArrowheadType) ?? 'end',
    lineStyle: (row.line_style as ConnectionLineStyle) ?? 'curved',
    strokePattern: (row.stroke_pattern as ConnectionStrokePattern) ?? 'dashed',
    color: (row.color as ConnectionColor) ?? 'indigo',
    animated: row.animated != null ? Boolean(row.animated) : true,
    metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : undefined
  };
}

export async function neonGetAllConnections(projectId = 'default'): Promise<Connection[]> {
  await ensureNeonSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT * FROM connections
    WHERE project_id = ${projectId}
  `) as unknown as RawNeonConnection[];

  return rows.map(mapNeonConnection);
}

export async function neonSaveConnection(conn: Connection, projectId = 'default'): Promise<void> {
  await ensureNeonSchema();
  const sql = getSql();
  await sql`
    INSERT INTO connections (
      id, project_id, from_node, to_node, label, arrowhead, line_style, stroke_pattern, color, animated, metadata, created_at
    ) VALUES (
      ${conn.id},
      ${projectId},
      ${conn.from},
      ${conn.to},
      ${conn.label ?? null},
      ${conn.arrowhead ?? 'end'},
      ${conn.lineStyle ?? 'curved'},
      ${conn.strokePattern ?? 'dashed'},
      ${conn.color ?? 'indigo'},
      ${conn.animated !== undefined ? conn.animated : true},
      ${conn.metadata ? JSON.stringify(conn.metadata) : null},
      ${Date.now()}
    )
    ON CONFLICT (project_id, id) DO UPDATE SET
      from_node = EXCLUDED.from_node,
      to_node = EXCLUDED.to_node,
      label = EXCLUDED.label,
      arrowhead = EXCLUDED.arrowhead,
      line_style = EXCLUDED.line_style,
      stroke_pattern = EXCLUDED.stroke_pattern,
      color = EXCLUDED.color,
      animated = EXCLUDED.animated,
      metadata = EXCLUDED.metadata
  `;
}

export async function neonUpdateConnection(id: string, fields: Partial<Connection>, projectId = 'default'): Promise<void> {
  await ensureNeonSchema();
  const sql = getSql();
  const rows = (await sql`SELECT * FROM connections WHERE id = ${id} AND project_id = ${projectId} LIMIT 1`) as unknown as RawNeonConnection[];
  if (rows.length === 0) return;
  const existing = mapNeonConnection(rows[0]);

  const updated: Connection = {
    ...existing,
    ...fields,
    id
  };

  await neonSaveConnection(updated, projectId);
}

export async function neonDeleteConnection(id: string, projectId = 'default'): Promise<void> {
  await ensureNeonSchema();
  const sql = getSql();
  await sql`DELETE FROM connections WHERE id = ${id} AND project_id = ${projectId}`;
}

export async function neonBulkSaveCanvas(
  nodes: CanvasNode[],
  connections: Connection[],
  projectId = 'default'
): Promise<void> {
  await ensureNeonSchema();
  const sql = getSql();

  // Clear existing nodes and connections for the project
  await sql`DELETE FROM nodes WHERE project_id = ${projectId}`;
  await sql`DELETE FROM connections WHERE project_id = ${projectId}`;

  // Batch insert nodes in parallel chunks
  const chunkSize = 25;
  for (let i = 0; i < nodes.length; i += chunkSize) {
    const chunk = nodes.slice(i, i + chunkSize);
    await Promise.all(chunk.map(node => neonSaveNode(node, projectId)));
  }

  // Batch insert connections in parallel chunks
  for (let i = 0; i < connections.length; i += chunkSize) {
    const chunk = connections.slice(i, i + chunkSize);
    await Promise.all(chunk.map(conn => neonSaveConnection(conn, projectId)));
  }
}

// ============================================================================
// Research Sessions
// ============================================================================

interface RawNeonSession {
  id: string;
  project_id: string;
  query: string;
  mode: ResearchSession['mode'];
  status: ResearchSession['status'];
  summary: string;
  trail: string;
  changes: string;
  created_at: number | string;
}

function mapNeonSession(row: RawNeonSession): ResearchSession {
  return {
    id: row.id,
    query: row.query,
    mode: row.mode,
    status: row.status,
    summary: row.summary,
    trail: typeof row.trail === 'string' ? JSON.parse(row.trail) : row.trail,
    changes: typeof row.changes === 'string' ? JSON.parse(row.changes) : row.changes,
    createdAt: Number(row.created_at)
  };
}

export async function neonGetResearchSessions(projectId = 'default'): Promise<ResearchSession[]> {
  await ensureNeonSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT * FROM research_sessions
    WHERE project_id = ${projectId}
    ORDER BY created_at DESC
    LIMIT 30
  `) as unknown as RawNeonSession[];

  return rows.map(mapNeonSession);
}

export async function neonGetResearchSession(id: string, projectId = 'default'): Promise<ResearchSession | undefined> {
  await ensureNeonSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT * FROM research_sessions
    WHERE id = ${id} AND project_id = ${projectId}
    LIMIT 1
  `) as unknown as RawNeonSession[];

  return rows.length > 0 ? mapNeonSession(rows[0]) : undefined;
}

export async function neonSaveResearchSession(session: ResearchSession, projectId = 'default'): Promise<void> {
  await ensureNeonSchema();
  const sql = getSql();
  await sql`
    INSERT INTO research_sessions (id, project_id, query, mode, status, summary, trail, changes, created_at)
    VALUES (
      ${session.id},
      ${projectId},
      ${session.query},
      ${session.mode},
      ${session.status},
      ${session.summary},
      ${JSON.stringify(session.trail)},
      ${JSON.stringify(session.changes)},
      ${session.createdAt}
    )
  `;
}

export async function neonReviewResearchSession(
  id: string,
  decisions: Array<{ changeId: string; status: Exclude<ResearchChangeStatus, 'pending'> }>,
  projectId = 'default'
): Promise<ResearchSession | undefined> {
  await ensureNeonSchema();
  const session = await neonGetResearchSession(id, projectId);
  if (!session) return undefined;

  const decisionById = new Map(decisions.map(item => [item.changeId, item.status]));
  let changes = session.changes.map(change => ({
    ...change,
    status: change.status === 'pending' ? (decisionById.get(change.id) || change.status) : change.status
  }));
  const newlyReviewed = (change: ResearchSession['changes'][number]) => session.changes.find(item => item.id === change.id)?.status === 'pending';

  const [existingNodes, existingConns] = await Promise.all([
    neonGetAllNodes(projectId),
    neonGetAllConnections(projectId)
  ]);
  let graph = normalizeGraph(existingNodes, existingConns);

  const acceptedNodes = changes.filter(change => change.kind === 'node' && change.status === 'accepted' && newlyReviewed(change));
  for (const change of acceptedNodes) {
    graph = addNode(graph, change.payload as CanvasNode);
  }
  const acceptedNodeIds = new Set(Object.keys(graph.nodesById));
  changes = changes.map(change => {
    if (change.kind !== 'relationship' || change.status !== 'accepted' || !newlyReviewed(change)) return change;
    const edge = change.payload as Connection;
    return acceptedNodeIds.has(edge.from) && acceptedNodeIds.has(edge.to)
      ? change
      : { ...change, status: 'rejected', rationale: 'The relationship endpoint was not accepted.' };
  });

  const accepted = changes.filter(change => change.status === 'accepted' && newlyReviewed(change));
  for (const change of accepted.filter(item => item.kind === 'relationship')) {
    graph = addRelationship(graph, change.payload as Connection);
  }

  const updated: ResearchSession = {
    ...session,
    status: changes.some(change => change.status === 'pending') ? 'review' : 'complete',
    changes
  };

  // Commit accepted nodes and connections to database
  await Promise.all([
    ...accepted.filter(item => item.kind === 'node').map(item => neonSaveNode(item.payload as CanvasNode, projectId)),
    ...accepted.filter(item => item.kind === 'relationship').map(item => neonSaveConnection(item.payload as Connection, projectId))
  ]);

  const sql = getSql();
  await sql`
    UPDATE research_sessions
    SET status = ${updated.status}, changes = ${JSON.stringify(updated.changes)}
    WHERE id = ${id} AND project_id = ${projectId}
  `;

  return updated;
}

// ============================================================================
// Graph Revisions
// ============================================================================

interface RawNeonRevision {
  id: string;
  project_id: string;
  title: string;
  node_count: number;
  edge_count: number;
  graph_data: string;
  created_at: number | string;
}

export async function neonCreateGraphRevision(
  projectId: string,
  title: string,
  nodes: CanvasNode[],
  relationships: Connection[]
): Promise<GraphRevisionSummary> {
  await ensureNeonSchema();
  const sql = getSql();
  const id = `rev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const createdAt = Date.now();
  const nodeCount = nodes.length;
  const edgeCount = relationships.length;
  const graphData = JSON.stringify({ nodes, relationships });

  const record: GraphRevisionSummary = {
    id,
    projectId,
    title: title.trim() || 'Snapshot checkpoint',
    nodeCount,
    edgeCount,
    createdAt
  };

  await sql`
    INSERT INTO graph_revisions (id, project_id, title, node_count, edge_count, graph_data, created_at)
    VALUES (${id}, ${projectId}, ${record.title}, ${nodeCount}, ${edgeCount}, ${graphData}, ${createdAt})
  `;

  // Prune revisions beyond last 100
  await sql`
    DELETE FROM graph_revisions
    WHERE project_id = ${projectId} AND id NOT IN (
      SELECT id FROM graph_revisions WHERE project_id = ${projectId} ORDER BY created_at DESC LIMIT 100
    )
  `;

  return record;
}

export async function neonGetGraphRevisions(projectId: string, limit = 50): Promise<GraphRevisionSummary[]> {
  await ensureNeonSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT id, project_id, title, node_count, edge_count, created_at
    FROM graph_revisions
    WHERE project_id = ${projectId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `) as unknown as RawNeonRevision[];

  return rows.map(r => ({
    id: r.id,
    projectId: r.project_id,
    title: r.title,
    nodeCount: Number(r.node_count),
    edgeCount: Number(r.edge_count),
    createdAt: Number(r.created_at)
  }));
}

export async function neonGetGraphRevisionById(projectId: string, revisionId: string): Promise<GraphRevision | null> {
  await ensureNeonSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT id, project_id, title, node_count, edge_count, graph_data, created_at
    FROM graph_revisions
    WHERE id = ${revisionId} AND project_id = ${projectId}
    LIMIT 1
  `) as unknown as RawNeonRevision[];

  if (rows.length === 0) return null;
  const row = rows[0];
  try {
    const parsed = typeof row.graph_data === 'string' ? JSON.parse(row.graph_data) : row.graph_data;
    return {
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      nodeCount: Number(row.node_count),
      edgeCount: Number(row.edge_count),
      createdAt: Number(row.created_at),
      nodes: parsed.nodes || [],
      relationships: parsed.relationships || []
    };
  } catch {
    return null;
  }
}

export async function neonRestoreGraphRevision(
  projectId: string,
  revisionId: string
): Promise<{ revision: GraphRevisionSummary; nodes: CanvasNode[]; relationships: Connection[] } | null> {
  const target = await neonGetGraphRevisionById(projectId, revisionId);
  if (!target) return null;

  await neonBulkSaveCanvas(target.nodes, target.relationships, projectId);
  const restoreCheckpoint = await neonCreateGraphRevision(
    projectId,
    `Restored: ${target.title}`,
    target.nodes,
    target.relationships
  );

  return {
    revision: restoreCheckpoint,
    nodes: target.nodes,
    relationships: target.relationships
  };
}

export async function neonDeleteGraphRevision(projectId: string, revisionId: string): Promise<boolean> {
  await ensureNeonSchema();
  const sql = getSql();
  const res = await sql`
    DELETE FROM graph_revisions WHERE id = ${revisionId} AND project_id = ${projectId} RETURNING id
  `;
  return res.length > 0;
}

// ============================================================================
// Multi-Tenant Users & Context Credits Ledger
// ============================================================================

interface RawNeonUser {
  id: string;
  clerk_id: string;
  email: string | null;
  name: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_tier: UserRecord['subscriptionTier'];
  subscription_status: UserRecord['subscriptionStatus'];
  seat_count: number | null;
  billing_interval: UserRecord['billingInterval'];
  current_period_end: number | string | null;
  context_credits: number | string;
  trial_ends_at: number | string | null;
  created_at: number | string;
}

function mapNeonUser(row: RawNeonUser): UserRecord {
  return {
    id: row.id,
    clerkId: row.clerk_id,
    email: row.email,
    name: row.name,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    subscriptionTier: row.subscription_tier,
    subscriptionStatus: row.subscription_status,
    seatCount: row.seat_count != null ? Number(row.seat_count) : 1,
    billingInterval: row.billing_interval || 'month',
    currentPeriodEnd: row.current_period_end != null ? Number(row.current_period_end) : null,
    contextCredits: Number(row.context_credits || 0),
    trialEndsAt: row.trial_ends_at != null ? Number(row.trial_ends_at) : null,
    createdAt: Number(row.created_at)
  };
}

export async function neonGetUserById(id: string): Promise<UserRecord | null> {
  await ensureNeonSchema();
  const sql = getSql();
  const rows = (await sql`SELECT * FROM users WHERE id = ${id} LIMIT 1`) as unknown as RawNeonUser[];
  return rows.length > 0 ? mapNeonUser(rows[0]) : null;
}

export async function neonGetUserByClerkId(clerkId: string): Promise<UserRecord | null> {
  await ensureNeonSchema();
  const sql = getSql();
  const rows = (await sql`SELECT * FROM users WHERE clerk_id = ${clerkId} LIMIT 1`) as unknown as RawNeonUser[];
  return rows.length > 0 ? mapNeonUser(rows[0]) : null;
}

export async function neonGetUserByStripeCustomerId(stripeCustomerId: string): Promise<UserRecord | null> {
  await ensureNeonSchema();
  const sql = getSql();
  const rows = (await sql`SELECT * FROM users WHERE stripe_customer_id = ${stripeCustomerId} LIMIT 1`) as unknown as RawNeonUser[];
  return rows.length > 0 ? mapNeonUser(rows[0]) : null;
}

export async function neonGetUserByStripeSubscriptionId(stripeSubscriptionId: string): Promise<UserRecord | null> {
  await ensureNeonSchema();
  const sql = getSql();
  const rows = (await sql`SELECT * FROM users WHERE stripe_subscription_id = ${stripeSubscriptionId} LIMIT 1`) as unknown as RawNeonUser[];
  return rows.length > 0 ? mapNeonUser(rows[0]) : null;
}

export async function neonUpdateUserSubscription(userId: string, data: Partial<UserRecord>): Promise<UserRecord | null> {
  await ensureNeonSchema();
  const existing = await neonGetUserById(userId);
  if (!existing) return null;

  const updated: UserRecord = {
    ...existing,
    ...data,
    id: existing.id
  };

  const sql = getSql();
  await sql`
    UPDATE users SET
      stripe_customer_id = ${updated.stripeCustomerId || null},
      stripe_subscription_id = ${updated.stripeSubscriptionId || null},
      subscription_tier = ${updated.subscriptionTier},
      subscription_status = ${updated.subscriptionStatus},
      seat_count = ${updated.seatCount || 1},
      billing_interval = ${updated.billingInterval || 'month'},
      current_period_end = ${updated.currentPeriodEnd || null},
      context_credits = ${updated.contextCredits},
      trial_ends_at = ${updated.trialEndsAt || null}
    WHERE id = ${userId}
  `;

  return updated;
}

export async function neonUpsertUser(user: Partial<UserRecord> & { clerkId: string }): Promise<UserRecord> {
  await ensureNeonSchema();
  const existing = await neonGetUserByClerkId(user.clerkId);
  const now = Date.now();
  const sql = getSql();

  if (existing) {
    const next: UserRecord = {
      ...existing,
      ...user,
      id: existing.id,
      clerkId: user.clerkId,
      createdAt: existing.createdAt
    };

    await sql`
      UPDATE users SET
        email = ${next.email},
        name = ${next.name},
        stripe_customer_id = ${next.stripeCustomerId},
        stripe_subscription_id = ${next.stripeSubscriptionId || null},
        subscription_tier = ${next.subscriptionTier},
        subscription_status = ${next.subscriptionStatus},
        seat_count = ${next.seatCount || 1},
        billing_interval = ${next.billingInterval || 'month'},
        current_period_end = ${next.currentPeriodEnd || null},
        context_credits = ${next.contextCredits},
        trial_ends_at = ${next.trialEndsAt}
      WHERE clerk_id = ${next.clerkId}
    `;

    return next;
  }

  const id = `usr-${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2, 10)}`;
  const trialEnds = user.trialEndsAt !== undefined ? user.trialEndsAt : (now + 3 * 24 * 60 * 60 * 1000);
  const newUser: UserRecord = {
    id,
    clerkId: user.clerkId,
    email: user.email || null,
    name: user.name || null,
    stripeCustomerId: user.stripeCustomerId || null,
    stripeSubscriptionId: user.stripeSubscriptionId || null,
    subscriptionTier: user.subscriptionTier || 'trial',
    subscriptionStatus: user.subscriptionStatus || 'trialing',
    seatCount: user.seatCount || 1,
    billingInterval: user.billingInterval || 'month',
    currentPeriodEnd: user.currentPeriodEnd || null,
    contextCredits: typeof user.contextCredits === 'number' ? user.contextCredits : 100,
    trialEndsAt: trialEnds,
    createdAt: now
  };

  await sql`
    INSERT INTO users (
      id, clerk_id, email, name, stripe_customer_id, stripe_subscription_id,
      subscription_tier, subscription_status, seat_count, billing_interval,
      current_period_end, context_credits, trial_ends_at, created_at
    ) VALUES (
      ${newUser.id}, ${newUser.clerkId}, ${newUser.email}, ${newUser.name},
      ${newUser.stripeCustomerId}, ${newUser.stripeSubscriptionId},
      ${newUser.subscriptionTier}, ${newUser.subscriptionStatus},
      ${newUser.seatCount}, ${newUser.billingInterval},
      ${newUser.currentPeriodEnd}, ${newUser.contextCredits},
      ${newUser.trialEndsAt}, ${newUser.createdAt}
    )
  `;

  return newUser;
}

export async function neonDeductUserCredits(
  userIdentifier: string,
  amount: number,
  action: CreditTransaction['action'],
  metadata?: string
): Promise<{ success: boolean; balance: number; error?: string }> {
  await ensureNeonSchema();
  const user = (await neonGetUserByClerkId(userIdentifier)) || (await neonGetUserById(userIdentifier));
  if (!user) {
    return { success: false, balance: 0, error: 'User account not found.' };
  }

  if (user.contextCredits < amount) {
    return {
      success: false,
      balance: user.contextCredits,
      error: `Insufficient Context Credits (${user.contextCredits} available, ${amount} required). Please refill your credits.`
    };
  }

  const nextBalance = user.contextCredits - amount;
  const txId = `ctx-${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2, 10)}`;
  const now = Date.now();
  const sql = getSql();

  await sql`UPDATE users SET context_credits = ${nextBalance} WHERE id = ${user.id}`;
  await sql`
    INSERT INTO credit_transactions (id, user_id, amount, action, balance_after, metadata, created_at)
    VALUES (${txId}, ${user.id}, ${-amount}, ${action}, ${nextBalance}, ${metadata || null}, ${now})
  `;

  return { success: true, balance: nextBalance };
}

export async function neonTopUpUserCredits(
  userIdentifier: string,
  amount: number,
  action: CreditTransaction['action'] = 'refill',
  metadata?: string
): Promise<{ success: boolean; balance: number }> {
  await ensureNeonSchema();
  let user = (await neonGetUserByClerkId(userIdentifier)) || (await neonGetUserById(userIdentifier));
  if (!user) {
    user = await neonUpsertUser({ clerkId: userIdentifier });
  }

  const nextBalance = user.contextCredits + amount;
  const txId = `ctx-${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2, 10)}`;
  const now = Date.now();
  const sql = getSql();

  await sql`UPDATE users SET context_credits = ${nextBalance} WHERE id = ${user.id}`;
  await sql`
    INSERT INTO credit_transactions (id, user_id, amount, action, balance_after, metadata, created_at)
    VALUES (${txId}, ${user.id}, ${amount}, ${action}, ${nextBalance}, ${metadata || null}, ${now})
  `;

  return { success: true, balance: nextBalance };
}

export async function neonGetCreditTransactions(userId: string, limit = 50): Promise<CreditTransaction[]> {
  await ensureNeonSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT id, user_id as "userId", amount, action, balance_after as "balanceAfter", metadata, created_at as "createdAt"
    FROM credit_transactions
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return rows.map(r => ({
    id: String(r.id),
    userId: String(r.userId),
    amount: Number(r.amount),
    action: String(r.action),
    balanceAfter: Number(r.balanceAfter),
    metadata: r.metadata ? String(r.metadata) : null,
    createdAt: Number(r.createdAt)
  }));
}
