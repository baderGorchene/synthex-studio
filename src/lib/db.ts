import Database from 'better-sqlite3';
import path from 'path';
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

// Ensure database file path in workspace
const dbPath = path.join(process.cwd(), 'canvas.db');

interface DbNodeRow {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number | null;
  height: number | null;
  color: string | null;
  title: string;
  content: string | null;
  items: string | null;
  imageUrl: string | null;
  caption: string | null;
  url: string | null;
  domain: string | null;
  description: string | null;
  sectionId?: string | null;
  fileData?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  fileType?: string | null;
  pageCount?: number | null;
  metadata: string | null;
  createdAt: number;
}

interface DbConnectionRow {
  id: string;
  from_node: string;
  to_node: string;
  label: string | null;
  arrowhead: string | null;
  line_style: string | null;
  stroke_pattern: string | null;
  color: string | null;
  animated: number | null;
  metadata: string | null;
}

// Global cache for Next.js development hot-reloading
declare global {
  var _sqliteDb: Database.Database | undefined;
}

function ensureSchemaColumns(db: Database.Database) {
  const nodeColumns = [
    { name: 'metadata', type: 'TEXT' },
    { name: 'projectId', type: "TEXT NOT NULL DEFAULT 'default'" },
    { name: 'sectionId', type: 'TEXT' },
    { name: 'fileData', type: 'TEXT' },
    { name: 'fileName', type: 'TEXT' },
    { name: 'fileSize', type: 'INTEGER' },
    { name: 'fileType', type: 'TEXT' },
    { name: 'pageCount', type: 'INTEGER' }
  ];
  for (const col of nodeColumns) {
    try {
      db.exec(`ALTER TABLE nodes ADD COLUMN ${col.name} ${col.type}`);
    } catch {
      // Column already exists.
    }
  }

  const connColumns = [
    { name: 'arrowhead', type: 'TEXT' },
    { name: 'line_style', type: 'TEXT' },
    { name: 'stroke_pattern', type: 'TEXT' },
    { name: 'color', type: 'TEXT' },
    { name: 'animated', type: 'INTEGER' },
    { name: 'metadata', type: 'TEXT' },
    { name: 'projectId', type: "TEXT NOT NULL DEFAULT 'default'" }
  ];
  for (const col of connColumns) {
    try {
      db.exec(`ALTER TABLE connections ADD COLUMN ${col.name} ${col.type}`);
    } catch {
      // Column already exists, safe to ignore
    }
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS research_sessions (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL DEFAULT 'default',
      query TEXT NOT NULL,
      mode TEXT NOT NULL,
      status TEXT NOT NULL,
      summary TEXT NOT NULL,
      trail TEXT NOT NULL,
      changes TEXT NOT NULL,
      createdAt INTEGER NOT NULL
    )
  `);
  try {
    db.exec("ALTER TABLE research_sessions ADD COLUMN projectId TEXT NOT NULL DEFAULT 'default'");
  } catch {
    // Column already exists.
  }

  migrateProjectScopedIds(db);

  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      createdAt INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS nodes_project_idx ON nodes(projectId);
    CREATE INDEX IF NOT EXISTS connections_project_idx ON connections(projectId);
    CREATE INDEX IF NOT EXISTS research_project_idx ON research_sessions(projectId, createdAt);
    INSERT OR IGNORE INTO projects (id, title, createdAt) VALUES ('default', 'Research workspace', 1761000000000);

    CREATE TABLE IF NOT EXISTS graph_revisions (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL DEFAULT 'default',
      title TEXT NOT NULL,
      nodeCount INTEGER NOT NULL,
      edgeCount INTEGER NOT NULL,
      graphData TEXT NOT NULL,
      createdAt INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS graph_revisions_project_idx ON graph_revisions(projectId, createdAt DESC);
  `);
}

function migrateProjectScopedIds(db: Database.Database) {
  const nodePrimaryKey = db.prepare('PRAGMA table_info(nodes)').all() as Array<{ name: string; pk: number }>;
  if (nodePrimaryKey.filter(column => column.pk > 0).length < 2) {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE nodes_scoped (
          id TEXT NOT NULL, projectId TEXT NOT NULL DEFAULT 'default', type TEXT NOT NULL,
          x REAL NOT NULL, y REAL NOT NULL, width REAL, height REAL, color TEXT,
          title TEXT NOT NULL, content TEXT, items TEXT, imageUrl TEXT, caption TEXT,
          url TEXT, domain TEXT, description TEXT, metadata TEXT, createdAt INTEGER NOT NULL,
          PRIMARY KEY (projectId, id)
        );
        INSERT INTO nodes_scoped (id, projectId, type, x, y, width, height, color, title, content, items, imageUrl, caption, url, domain, description, metadata, createdAt)
          SELECT id, projectId, type, x, y, width, height, color, title, content, items, imageUrl, caption, url, domain, description, metadata, createdAt FROM nodes;
        DROP TABLE nodes;
        ALTER TABLE nodes_scoped RENAME TO nodes;
      `);
    })();
  }

  const connectionPrimaryKey = db.prepare('PRAGMA table_info(connections)').all() as Array<{ name: string; pk: number }>;
  if (connectionPrimaryKey.filter(column => column.pk > 0).length < 2) {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE connections_scoped (
          id TEXT NOT NULL, projectId TEXT NOT NULL DEFAULT 'default', from_node TEXT NOT NULL,
          to_node TEXT NOT NULL, label TEXT, arrowhead TEXT, line_style TEXT,
          stroke_pattern TEXT, color TEXT, animated INTEGER, metadata TEXT,
          PRIMARY KEY (projectId, id)
        );
        INSERT INTO connections_scoped (id, projectId, from_node, to_node, label, arrowhead, line_style, stroke_pattern, color, animated, metadata)
          SELECT id, projectId, from_node, to_node, label, arrowhead, line_style, stroke_pattern, color, animated, metadata FROM connections;
        DROP TABLE connections;
        ALTER TABLE connections_scoped RENAME TO connections;
      `);
    })();
  }
}

function getDatabase(): Database.Database {
  if (!global._sqliteDb) {
    global._sqliteDb = new Database(dbPath);
    initSchema(global._sqliteDb);
  } else {
    ensureSchemaColumns(global._sqliteDb);
  }

  return global._sqliteDb;
}

function initSchema(db: Database.Database) {
  // Enable WAL mode for concurrent performance
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT NOT NULL,
      projectId TEXT NOT NULL DEFAULT 'default',
      type TEXT NOT NULL,
      x REAL NOT NULL,
      y REAL NOT NULL,
      width REAL,
      height REAL,
      color TEXT,
      title TEXT NOT NULL,
      content TEXT,
      items TEXT,
      imageUrl TEXT,
      caption TEXT,
      url TEXT,
      domain TEXT,
      description TEXT,
      metadata TEXT,
      createdAt INTEGER NOT NULL,
      PRIMARY KEY (projectId, id)
    );

    CREATE TABLE IF NOT EXISTS connections (
      id TEXT NOT NULL,
      projectId TEXT NOT NULL DEFAULT 'default',
      from_node TEXT NOT NULL,
      to_node TEXT NOT NULL,
      label TEXT,
      arrowhead TEXT,
      line_style TEXT,
      stroke_pattern TEXT,
      color TEXT,
      animated INTEGER,
      metadata TEXT,
      PRIMARY KEY (projectId, id)
    );

    CREATE TABLE IF NOT EXISTS research_sessions (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL DEFAULT 'default',
      query TEXT NOT NULL,
      mode TEXT NOT NULL,
      status TEXT NOT NULL,
      summary TEXT NOT NULL,
      trail TEXT NOT NULL,
      changes TEXT NOT NULL,
      createdAt INTEGER NOT NULL
    );
  `);

  ensureSchemaColumns(db);

  // Seed default nodes if database table is newly initialized
  const countStmt = db.prepare("SELECT COUNT(*) as count FROM nodes WHERE projectId = 'default'");
  const result = countStmt.get() as { count: number };

  if (result.count === 0) {
    const insertNode = db.prepare(`
      INSERT INTO nodes (
        id, type, x, y, width, height, color, title, content, items,
        imageUrl, caption, url, domain, description, metadata, createdAt
      ) VALUES (
        @id, @type, @x, @y, @width, @height, @color, @title, @content, @items,
        @imageUrl, @caption, @url, @domain, @description, @metadata, @createdAt
      )
    `);

    const insertManyNodes = db.transaction((nodes: CanvasNode[]) => {
      for (const node of nodes) {
        insertNode.run({
          id: node.id,
          type: node.type,
          x: node.x,
          y: node.y,
          width: node.width ?? null,
          height: node.height ?? null,
          color: node.color ?? 'neutral',
          title: node.title,
          content: node.content ?? null,
          items: node.items ? JSON.stringify(node.items) : null,
          imageUrl: node.imageUrl ?? null,
          caption: node.caption ?? null,
          url: node.url ?? null,
          domain: node.domain ?? null,
          description: node.description ?? null,
          metadata: node.metadata ? JSON.stringify(node.metadata) : null,
          createdAt: node.createdAt
        });
      }
    });

    insertManyNodes(SEED_NODES);

    const insertConn = db.prepare(`
      INSERT INTO connections (id, from_node, to_node, label)
      VALUES (@id, @from_node, @to_node, @label)
    `);

    const insertManyConns = db.transaction((conns: Connection[]) => {
      for (const c of conns) {
        insertConn.run({
          id: c.id,
          from_node: c.from,
          to_node: c.to,
          label: c.label ?? null
        });
      }
    });

    insertManyConns(SEED_CONNECTIONS);
  }
}

export function getAllNodesFromDb(projectId = 'default'): CanvasNode[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM nodes WHERE projectId = ? ORDER BY createdAt ASC').all(projectId) as DbNodeRow[];

  return rows.map(row => ({
    id: row.id,
    type: row.type as CanvasNodeType,
    x: row.x,
    y: row.y,
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    color: (row.color as AccentColor) ?? 'neutral',
    title: row.title || (row.type === 'section' ? 'Untitled cluster' : 'Untitled record'),
    content: row.content ?? undefined,
    items: row.items ? JSON.parse(row.items) : undefined,
    imageUrl: row.imageUrl ?? undefined,
    caption: row.caption ?? undefined,
    url: row.url ?? undefined,
    domain: row.domain ?? undefined,
    description: row.description ?? undefined,
    sectionId: row.sectionId ?? undefined,
    fileData: row.fileData ?? undefined,
    fileName: row.fileName ?? undefined,
    fileSize: row.fileSize ?? undefined,
    fileType: row.fileType ?? undefined,
    pageCount: row.pageCount ?? undefined,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    createdAt: row.createdAt
  }));
}

export function saveNodeToDb(node: CanvasNode, projectId = 'default'): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO nodes (
      id, projectId, type, x, y, width, height, color, title, content, items,
      imageUrl, caption, url, domain, description, sectionId, fileData, fileName, fileSize, fileType, pageCount, metadata, createdAt
    ) VALUES (
      @id, @projectId, @type, @x, @y, @width, @height, @color, @title, @content, @items,
      @imageUrl, @caption, @url, @domain, @description, @sectionId, @fileData, @fileName, @fileSize, @fileType, @pageCount, @metadata, @createdAt
    )
    ON CONFLICT(projectId, id) DO UPDATE SET
      type = excluded.type,
      x = excluded.x,
      y = excluded.y,
      width = excluded.width,
      height = excluded.height,
      color = excluded.color,
      title = excluded.title,
      content = excluded.content,
      items = excluded.items,
      imageUrl = excluded.imageUrl,
      caption = excluded.caption,
      url = excluded.url,
      domain = excluded.domain,
      description = excluded.description,
      sectionId = excluded.sectionId,
      fileData = excluded.fileData,
      fileName = excluded.fileName,
      fileSize = excluded.fileSize,
      fileType = excluded.fileType,
      pageCount = excluded.pageCount,
      metadata = excluded.metadata
  `);

  stmt.run({
    id: node.id,
    projectId,
    type: node.type,
    x: node.x,
    y: node.y,
    width: node.width ?? null,
    height: node.height ?? null,
    color: node.color ?? 'neutral',
    title: node.title,
    content: node.content ?? null,
    items: node.items ? JSON.stringify(node.items) : null,
    imageUrl: node.imageUrl ?? null,
    caption: node.caption ?? null,
    url: node.url ?? null,
    domain: node.domain ?? null,
    description: node.description ?? null,
    sectionId: node.sectionId ?? null,
    fileData: node.fileData ?? null,
    fileName: node.fileName ?? null,
    fileSize: node.fileSize ?? null,
    fileType: node.fileType ?? null,
    pageCount: node.pageCount ?? null,
    metadata: node.metadata ? JSON.stringify(node.metadata) : null,
    createdAt: node.createdAt
  });
}

export function updateNodePositionInDb(id: string, x: number, y: number, projectId = 'default'): void {
  const db = getDatabase();
  db.prepare('UPDATE nodes SET x = ?, y = ? WHERE id = ? AND projectId = ?').run(x, y, id, projectId);
}

export function updateMultipleNodePositionsInDb(positions: { id: string; x: number; y: number }[], projectId = 'default'): void {
  const db = getDatabase();
  const updateStmt = db.prepare('UPDATE nodes SET x = ?, y = ? WHERE id = ? AND projectId = ?');
  const tx = db.transaction((items: { id: string; x: number; y: number }[]) => {
    for (const item of items) {
      updateStmt.run(item.x, item.y, item.id, projectId);
    }
  });
  tx(positions);
}

export function updateNodeInDb(id: string, fields: Partial<CanvasNode>, projectId = 'default'): void {
  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM nodes WHERE id = ? AND projectId = ?').get(id, projectId) as DbNodeRow | undefined;
  if (!existing) return;

  const updated: CanvasNode = {
    id,
    type: (fields.type ?? existing.type) as CanvasNodeType,
    x: fields.x ?? existing.x,
    y: fields.y ?? existing.y,
    width: fields.width !== undefined ? fields.width : (existing.width ?? undefined),
    height: fields.height !== undefined ? fields.height : (existing.height ?? undefined),
    color: (fields.color ?? existing.color ?? 'neutral') as AccentColor,
    title: fields.title ?? existing.title,
    content: fields.content !== undefined ? fields.content : (existing.content ?? undefined),
    items:
      fields.items !== undefined
        ? fields.items
        : existing.items
        ? JSON.parse(existing.items)
        : undefined,
    imageUrl: fields.imageUrl !== undefined ? fields.imageUrl : (existing.imageUrl ?? undefined),
    caption: fields.caption !== undefined ? fields.caption : (existing.caption ?? undefined),
    url: fields.url !== undefined ? fields.url : (existing.url ?? undefined),
    domain: fields.domain !== undefined ? fields.domain : (existing.domain ?? undefined),
    description:
      fields.description !== undefined ? fields.description : (existing.description ?? undefined),
    sectionId: fields.sectionId !== undefined ? fields.sectionId : (existing.sectionId ?? undefined),
    fileData: fields.fileData !== undefined ? fields.fileData : (existing.fileData ?? undefined),
    fileName: fields.fileName !== undefined ? fields.fileName : (existing.fileName ?? undefined),
    fileSize: fields.fileSize !== undefined ? fields.fileSize : (existing.fileSize ?? undefined),
    fileType: fields.fileType !== undefined ? fields.fileType : (existing.fileType ?? undefined),
    pageCount: fields.pageCount !== undefined ? fields.pageCount : (existing.pageCount ?? undefined),
    metadata: fields.metadata !== undefined ? fields.metadata : (existing.metadata ? JSON.parse(existing.metadata) : undefined),
    createdAt: existing.createdAt
  };

  saveNodeToDb(updated, projectId);
}

export function deleteNodeFromDb(id: string, projectId = 'default'): void {
  const db = getDatabase();
  db.prepare('DELETE FROM nodes WHERE id = ? AND projectId = ?').run(id, projectId);
  db.prepare('DELETE FROM connections WHERE (from_node = ? OR to_node = ?) AND projectId = ?').run(id, id, projectId);
}

export function getAllConnectionsFromDb(projectId = 'default'): Connection[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM connections WHERE projectId = ?').all(projectId) as DbConnectionRow[];

  return rows.map(row => ({
    id: row.id,
    from: row.from_node,
    to: row.to_node,
    label: row.label ?? undefined,
    arrowhead: (row.arrowhead as ArrowheadType) ?? 'end',
    lineStyle: (row.line_style as ConnectionLineStyle) ?? 'curved',
    strokePattern: (row.stroke_pattern as ConnectionStrokePattern) ?? 'dashed',
    color: (row.color as ConnectionColor) ?? 'indigo',
    animated: row.animated !== null ? Boolean(row.animated) : true,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined
  }));
}

export function saveConnectionToDb(conn: Connection, projectId = 'default'): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO connections (id, projectId, from_node, to_node, label, arrowhead, line_style, stroke_pattern, color, animated, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(projectId, id) DO UPDATE SET
      from_node = excluded.from_node,
      to_node = excluded.to_node,
      label = excluded.label,
      arrowhead = excluded.arrowhead,
      line_style = excluded.line_style,
      stroke_pattern = excluded.stroke_pattern,
      color = excluded.color,
      animated = excluded.animated,
      metadata = excluded.metadata
  `);

  stmt.run(
    conn.id,
    projectId,
    conn.from,
    conn.to,
    conn.label ?? null,
    conn.arrowhead ?? 'end',
    conn.lineStyle ?? 'curved',
    conn.strokePattern ?? 'dashed',
    conn.color ?? 'indigo',
    conn.animated !== undefined ? (conn.animated ? 1 : 0) : 1,
    conn.metadata ? JSON.stringify(conn.metadata) : null
  );
}

export function updateConnectionInDb(id: string, fields: Partial<Connection>, projectId = 'default'): void {
  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM connections WHERE id = ? AND projectId = ?').get(id, projectId) as DbConnectionRow | undefined;
  if (!existing) return;

  const updated: Connection = {
    id,
    from: fields.from ?? existing.from_node,
    to: fields.to ?? existing.to_node,
    label: fields.label !== undefined ? fields.label : (existing.label ?? undefined),
    arrowhead: fields.arrowhead ?? (existing.arrowhead as ArrowheadType) ?? 'end',
    lineStyle: fields.lineStyle ?? (existing.line_style as ConnectionLineStyle) ?? 'curved',
    strokePattern: fields.strokePattern ?? (existing.stroke_pattern as ConnectionStrokePattern) ?? 'dashed',
    color: fields.color ?? (existing.color as ConnectionColor) ?? 'indigo',
    animated: fields.animated !== undefined ? fields.animated : existing.animated !== null ? Boolean(existing.animated) : true,
    metadata: fields.metadata !== undefined ? fields.metadata : existing.metadata ? JSON.parse(existing.metadata) : undefined
  };

  saveConnectionToDb(updated, projectId);
}

export function deleteConnectionFromDb(id: string, projectId = 'default'): void {
  const db = getDatabase();
  db.prepare('DELETE FROM connections WHERE id = ? AND projectId = ?').run(id, projectId);
}

export function bulkSaveCanvasToDb(nodes: CanvasNode[], connections: Connection[], projectId = 'default'): void {
  const db = getDatabase();
  const sync = db.transaction(() => {
    db.prepare('DELETE FROM nodes WHERE projectId = ?').run(projectId);
    db.prepare('DELETE FROM connections WHERE projectId = ?').run(projectId);

    for (const node of nodes) {
      saveNodeToDb(node, projectId);
    }
    for (const conn of connections) {
      saveConnectionToDb(conn, projectId);
    }
  });

  sync();
}

interface DbResearchSessionRow {
  id: string;
  projectId: string;
  query: string;
  mode: ResearchSession['mode'];
  status: ResearchSession['status'];
  summary: string;
  trail: string;
  changes: string;
  createdAt: number;
}

function mapResearchSession(row: DbResearchSessionRow): ResearchSession {
  return {
    ...row,
    trail: JSON.parse(row.trail),
    changes: JSON.parse(row.changes)
  };
}

export function getResearchSessions(projectId = 'default'): ResearchSession[] {
  const rows = getDatabase()
    .prepare('SELECT * FROM research_sessions WHERE projectId = ? ORDER BY createdAt DESC LIMIT 30')
    .all(projectId) as DbResearchSessionRow[];
  return rows.map(mapResearchSession);
}

export function getResearchSession(id: string, projectId = 'default'): ResearchSession | undefined {
  const row = getDatabase().prepare('SELECT * FROM research_sessions WHERE id = ? AND projectId = ?').get(id, projectId) as DbResearchSessionRow | undefined;
  return row ? mapResearchSession(row) : undefined;
}

export function saveResearchSession(session: ResearchSession, projectId = 'default'): void {
  getDatabase().prepare(`
    INSERT INTO research_sessions (id, projectId, query, mode, status, summary, trail, changes, createdAt)
    VALUES (@id, @projectId, @query, @mode, @status, @summary, @trail, @changes, @createdAt)
  `).run({
    ...session,
    projectId,
    trail: JSON.stringify(session.trail),
    changes: JSON.stringify(session.changes)
  });
}

export function reviewResearchSession(
  id: string,
  decisions: Array<{ changeId: string; status: Exclude<ResearchChangeStatus, 'pending'> }>,
  projectId = 'default'
): ResearchSession | undefined {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM research_sessions WHERE id = ? AND projectId = ?').get(id, projectId) as DbResearchSessionRow | undefined;
  if (!row) return undefined;
  const session = mapResearchSession(row);
  const decisionById = new Map(decisions.map(item => [item.changeId, item.status]));
  let changes = session.changes.map(change => ({
    ...change,
    status: change.status === 'pending' ? (decisionById.get(change.id) || change.status) : change.status
  }));
  const newlyReviewed = (change: ResearchSession['changes'][number]) => session.changes.find(item => item.id === change.id)?.status === 'pending';

  let graph = normalizeGraph(getAllNodesFromDb(projectId), getAllConnectionsFromDb(projectId));
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
  const commit = db.transaction(() => {
    for (const change of accepted.filter(item => item.kind === 'node')) saveNodeToDb(change.payload as CanvasNode, projectId);
    for (const change of accepted.filter(item => item.kind === 'relationship')) saveConnectionToDb(change.payload as Connection, projectId);
    db.prepare(`
      UPDATE research_sessions SET status = @status, changes = @changes WHERE id = @id AND projectId = @projectId
    `).run({ id, projectId, status: updated.status, changes: JSON.stringify(updated.changes) });
  });
  commit();
  return updated;
}

export interface ResearchProject {
  id: string;
  title: string;
  createdAt: number;
}

export function getProjectsFromDb(): ResearchProject[] {
  return getDatabase().prepare('SELECT id, title, createdAt FROM projects ORDER BY createdAt ASC').all() as ResearchProject[];
}

export function projectExistsInDb(id: string): boolean {
  return Boolean(getDatabase().prepare('SELECT 1 FROM projects WHERE id = ?').get(id));
}

export function createProjectInDb(id: string, title: string, template: 'blank' | 'rag' = 'blank'): ResearchProject {
  const project = { id, title, createdAt: Date.now() };
  getDatabase().prepare('INSERT INTO projects (id, title, createdAt) VALUES (@id, @title, @createdAt)').run(project);
  if (template === 'rag') {
    const ids = new Map(SEED_NODES.map(node => [node.id, `${id}-${node.id}`]));
    const nodes = SEED_NODES.map(node => ({ ...node, id: ids.get(node.id)!, metadata: node.metadata ? { ...node.metadata } : undefined }));
    const connections = SEED_CONNECTIONS.map(edge => ({
      ...edge,
      id: `${id}-${edge.id}`,
      from: ids.get(edge.from)!,
      to: ids.get(edge.to)!
    }));
    bulkSaveCanvasToDb(nodes, connections, id);
  }
  return project;
}

export function createGraphRevision(
  projectId: string,
  title: string,
  nodes: CanvasNode[],
  relationships: Connection[]
): GraphRevisionSummary {
  const db = getDatabase();
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

  db.transaction(() => {
    db.prepare(`
      INSERT INTO graph_revisions (id, projectId, title, nodeCount, edgeCount, graphData, createdAt)
      VALUES (@id, @projectId, @title, @nodeCount, @edgeCount, @graphData, @createdAt)
    `).run({ ...record, graphData });

    // Prune revisions beyond the last 100 per project
    db.prepare(`
      DELETE FROM graph_revisions
      WHERE projectId = ? AND id NOT IN (
        SELECT id FROM graph_revisions WHERE projectId = ? ORDER BY createdAt DESC LIMIT 100
      )
    `).run(projectId, projectId);
  })();

  return record;
}

export function getGraphRevisions(projectId: string, limit = 50): GraphRevisionSummary[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT id, projectId, title, nodeCount, edgeCount, createdAt
    FROM graph_revisions
    WHERE projectId = ?
    ORDER BY createdAt DESC
    LIMIT ?
  `).all(projectId, limit) as GraphRevisionSummary[];
}

export function getGraphRevisionById(projectId: string, revisionId: string): GraphRevision | null {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT id, projectId, title, nodeCount, edgeCount, graphData, createdAt
    FROM graph_revisions
    WHERE id = ? AND projectId = ?
  `).get(revisionId, projectId) as (GraphRevisionSummary & { graphData: string }) | undefined;

  if (!row) return null;

  try {
    const parsed = JSON.parse(row.graphData);
    return {
      id: row.id,
      projectId: row.projectId,
      title: row.title,
      nodeCount: row.nodeCount,
      edgeCount: row.edgeCount,
      createdAt: row.createdAt,
      nodes: parsed.nodes || [],
      relationships: parsed.relationships || []
    };
  } catch {
    return null;
  }
}

export function restoreGraphRevision(
  projectId: string,
  revisionId: string
): { revision: GraphRevisionSummary; nodes: CanvasNode[]; relationships: Connection[] } | null {
  const target = getGraphRevisionById(projectId, revisionId);
  if (!target) return null;

  // Atomically save the target graph to the database and record a restoration checkpoint
  bulkSaveCanvasToDb(target.nodes, target.relationships, projectId);
  const restoreCheckpoint = createGraphRevision(
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

export function deleteGraphRevision(projectId: string, revisionId: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM graph_revisions WHERE id = ? AND projectId = ?').run(revisionId, projectId);
  return result.changes > 0;
}

