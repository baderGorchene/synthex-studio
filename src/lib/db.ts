import Database from 'better-sqlite3';
import path from 'path';
import {
  AccentColor,
  ArrowheadType,
  CanvasNode,
  CanvasNodeType,
  Connection,
  ConnectionColor,
  ConnectionLineStyle,
  ConnectionStrokePattern
} from '@/types/canvas';
import { SEED_CONNECTIONS, SEED_NODES } from '@/constants/seedData';

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
}

// Global cache for Next.js development hot-reloading
declare global {
  var _sqliteDb: Database.Database | undefined;
}

function ensureSchemaColumns(db: Database.Database) {
  const connColumns = [
    { name: 'arrowhead', type: 'TEXT' },
    { name: 'line_style', type: 'TEXT' },
    { name: 'stroke_pattern', type: 'TEXT' },
    { name: 'color', type: 'TEXT' },
    { name: 'animated', type: 'INTEGER' }
  ];
  for (const col of connColumns) {
    try {
      db.exec(`ALTER TABLE connections ADD COLUMN ${col.name} ${col.type}`);
    } catch {
      // Column already exists, safe to ignore
    }
  }
}

function getDatabase(): Database.Database {
  if (process.env.NODE_ENV === 'production') {
    const db = new Database(dbPath);
    initSchema(db);
    return db;
  }

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
      id TEXT PRIMARY KEY,
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
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS connections (
      id TEXT PRIMARY KEY,
      from_node TEXT NOT NULL,
      to_node TEXT NOT NULL,
      label TEXT,
      arrowhead TEXT,
      line_style TEXT,
      stroke_pattern TEXT,
      color TEXT,
      animated INTEGER
    );
  `);

  ensureSchemaColumns(db);

  // Seed default nodes if database table is newly initialized
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM nodes');
  const result = countStmt.get() as { count: number };

  if (result.count === 0) {
    const insertNode = db.prepare(`
      INSERT INTO nodes (
        id, type, x, y, width, height, color, title, content, items,
        imageUrl, caption, url, domain, description, createdAt
      ) VALUES (
        @id, @type, @x, @y, @width, @height, @color, @title, @content, @items,
        @imageUrl, @caption, @url, @domain, @description, @createdAt
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

export function getAllNodesFromDb(): CanvasNode[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM nodes ORDER BY createdAt ASC').all() as DbNodeRow[];

  return rows.map(row => ({
    id: row.id,
    type: row.type as CanvasNodeType,
    x: row.x,
    y: row.y,
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    color: (row.color as AccentColor) ?? 'neutral',
    title: row.title,
    content: row.content ?? undefined,
    items: row.items ? JSON.parse(row.items) : undefined,
    imageUrl: row.imageUrl ?? undefined,
    caption: row.caption ?? undefined,
    url: row.url ?? undefined,
    domain: row.domain ?? undefined,
    description: row.description ?? undefined,
    createdAt: row.createdAt
  }));
}

export function saveNodeToDb(node: CanvasNode): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO nodes (
      id, type, x, y, width, height, color, title, content, items,
      imageUrl, caption, url, domain, description, createdAt
    ) VALUES (
      @id, @type, @x, @y, @width, @height, @color, @title, @content, @items,
      @imageUrl, @caption, @url, @domain, @description, @createdAt
    )
    ON CONFLICT(id) DO UPDATE SET
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
      description = excluded.description
  `);

  stmt.run({
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
    createdAt: node.createdAt
  });
}

export function updateNodePositionInDb(id: string, x: number, y: number): void {
  const db = getDatabase();
  db.prepare('UPDATE nodes SET x = ?, y = ? WHERE id = ?').run(x, y, id);
}

export function updateMultipleNodePositionsInDb(positions: { id: string; x: number; y: number }[]): void {
  const db = getDatabase();
  const updateStmt = db.prepare('UPDATE nodes SET x = ?, y = ? WHERE id = ?');
  const tx = db.transaction((items: { id: string; x: number; y: number }[]) => {
    for (const item of items) {
      updateStmt.run(item.x, item.y, item.id);
    }
  });
  tx(positions);
}

export function updateNodeInDb(id: string, fields: Partial<CanvasNode>): void {
  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM nodes WHERE id = ?').get(id) as DbNodeRow | undefined;
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
    createdAt: existing.createdAt
  };

  saveNodeToDb(updated);
}

export function deleteNodeFromDb(id: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM nodes WHERE id = ?').run(id);
  db.prepare('DELETE FROM connections WHERE from_node = ? OR to_node = ?').run(id, id);
}

export function getAllConnectionsFromDb(): Connection[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM connections').all() as DbConnectionRow[];

  return rows.map(row => ({
    id: row.id,
    from: row.from_node,
    to: row.to_node,
    label: row.label ?? undefined,
    arrowhead: (row.arrowhead as ArrowheadType) ?? 'end',
    lineStyle: (row.line_style as ConnectionLineStyle) ?? 'curved',
    strokePattern: (row.stroke_pattern as ConnectionStrokePattern) ?? 'dashed',
    color: (row.color as ConnectionColor) ?? 'indigo',
    animated: row.animated !== null ? Boolean(row.animated) : true
  }));
}

export function saveConnectionToDb(conn: Connection): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO connections (id, from_node, to_node, label, arrowhead, line_style, stroke_pattern, color, animated)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      from_node = excluded.from_node,
      to_node = excluded.to_node,
      label = excluded.label,
      arrowhead = excluded.arrowhead,
      line_style = excluded.line_style,
      stroke_pattern = excluded.stroke_pattern,
      color = excluded.color,
      animated = excluded.animated
  `);

  stmt.run(
    conn.id,
    conn.from,
    conn.to,
    conn.label ?? null,
    conn.arrowhead ?? 'end',
    conn.lineStyle ?? 'curved',
    conn.strokePattern ?? 'dashed',
    conn.color ?? 'indigo',
    conn.animated !== undefined ? (conn.animated ? 1 : 0) : 1
  );
}

export function updateConnectionInDb(id: string, fields: Partial<Connection>): void {
  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM connections WHERE id = ?').get(id) as DbConnectionRow | undefined;
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
    animated: fields.animated !== undefined ? fields.animated : existing.animated !== null ? Boolean(existing.animated) : true
  };

  saveConnectionToDb(updated);
}

export function deleteConnectionFromDb(id: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM connections WHERE id = ?').run(id);
}

export function bulkSaveCanvasToDb(nodes: CanvasNode[], connections: Connection[]): void {
  const db = getDatabase();
  const sync = db.transaction(() => {
    db.prepare('DELETE FROM nodes').run();
    db.prepare('DELETE FROM connections').run();

    for (const node of nodes) {
      saveNodeToDb(node);
    }
    for (const conn of connections) {
      saveConnectionToDb(conn);
    }
  });

  sync();
}
