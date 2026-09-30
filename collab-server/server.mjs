// Synthex real-time sync: a Hocuspocus (Yjs) relay for maps.
//
// It keeps each open map in memory while someone has it open and merges everyone's edits. It never touches the
// database: the Next.js app loads maps from, and saves them to, Neon/SQLite as before. A client may join a map only
// with a short-lived token the app signs (COLLAB_SECRET) after checking the user can open that map.
//
// Rooms live in this process's memory, so run exactly one instance (Cloud Run: --max-instances=1).

import { createHmac, timingSafeEqual } from 'node:crypto';
import { Server } from '@hocuspocus/server';

const secret = (process.env.COLLAB_SECRET || '').trim();
if (secret.length < 32) {
  console.error('COLLAB_SECRET must be set to the same value as the app (at least 32 characters). Refusing to start.');
  process.exit(1);
}

const port = Number(process.env.PORT || 1234);
const MAX_MESSAGE_BYTES = 5 * 1024 * 1024; // the app caps a saved map at 5 MB too

/** Token format (see src/lib/collab-token.ts): base64url(JSON claims) + "." + base64url(HMAC-SHA256). */
function verifyToken(token) {
  if (typeof token !== 'string' || token.length > 4096) return null;
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  const expected = createHmac('sha256', secret).update(body).digest();
  const given = Buffer.from(signature, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (typeof claims.p !== 'string' || typeof claims.u !== 'string' || typeof claims.exp !== 'number') return null;
    if (claims.exp * 1000 < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}

const server = new Server({
  name: 'synthex-collab',
  port,
  quiet: true,
  timeout: 30_000,
  websocketOptions: { maxPayload: MAX_MESSAGE_BYTES },

  async onAuthenticate({ token, documentName }) {
    const claims = verifyToken(token);
    // The token is bound to one map: it can't be replayed to open another.
    if (!claims || claims.p !== documentName) throw new Error('Not allowed to open this map.');
    return { userId: claims.u };
  },

  async onRequest({ request, response }) {
    // Health check for Cloud Run and uptime monitors.
    if (request.url === '/healthz') {
      response.writeHead(200, { 'Content-Type': 'text/plain' });
      response.end('ok');
      throw null; // tells Hocuspocus the request was handled
    }
  }
});

await server.listen();
console.log(`Synthex collab server listening on :${port}`);
