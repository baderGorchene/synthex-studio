/**
 * Short-lived tokens for the real-time sync server (collab-server/). Server-only: they are signed with COLLAB_SECRET,
 * which the browser never sees. A token lets one user join one map for a few minutes; the provider asks for a fresh
 * one on every reconnect, so losing access to a map also ends live access to it.
 */
import { createHmac } from 'node:crypto';

const TOKEN_TTL_SECONDS = 10 * 60;

export interface CollabConfig {
  url: string;
  secret: string;
}

/** Real-time sync is optional: it's on only when both the server URL and a strong shared secret are set. */
export function getCollabConfig(): CollabConfig | null {
  const url = (process.env.COLLAB_SERVER_URL || '').trim();
  const secret = (process.env.COLLAB_SECRET || '').trim();
  if (!url || secret.length < 32 || !/^wss?:\/\//i.test(url)) return null;
  return { url, secret };
}

/** Token format: base64url(JSON claims) + "." + base64url(HMAC-SHA256(claims)). Verified in collab-server/server.mjs. */
export function signCollabToken(secret: string, projectId: string, userId: string): string {
  const claims = { p: projectId, u: userId, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS };
  const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

// Presence colours: distinct from proof blue (AI drafts) and readable on paper.
const PRESENCE_COLORS = ['#D9480F', '#2B8A3E', '#AE3EC9', '#E8590C', '#0B7285', '#C2255C', '#5F3DC4', '#A61E4D'];

export function presenceColorFor(userId: string): string {
  let hash = 0;
  for (const char of userId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PRESENCE_COLORS[hash % PRESENCE_COLORS.length];
}
