'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { HocuspocusProvider, WebSocketStatus } from '@hocuspocus/provider';
import { normalizeGraph, type KnowledgeGraph } from '@/lib/graph';
import type { CanvasNode, Connection } from '@/types/canvas';

/*
 * Live collaboration on a map, over the Hocuspocus/Yjs sync server (collab-server/).
 *
 * The shared document holds two maps, note id -> note and link id -> link, so people editing different notes never
 * conflict and two people editing the same note resolve per note (last change wins). The database stays the source of
 * truth: the first person to open a map seeds the live document from what they loaded, and everyone keeps autosaving
 * the merged map through PUT /api/graph as before.
 */

export interface PresenceUser { id: string; name: string; color: string }
export interface PresencePeer {
  clientId: number;
  user: PresenceUser;
  cursor: { x: number; y: number } | null;
  selection: string[];
  editing: string | null;
}
export type CollabStatus = 'off' | 'connecting' | 'live' | 'reconnecting';
export interface RemoteChange { nodes: Set<string>; edges: Set<string> }

interface TokenResponse { enabled: boolean; url?: string; token?: string; user?: PresenceUser }

const LOCAL = Symbol('synthex-local'); // transaction origin for our own edits
const CURSOR_INTERVAL_MS = 50;

function fetchToken(projectId: string): Promise<TokenResponse> {
  return fetch(`/api/collab/token?projectId=${encodeURIComponent(projectId)}`, { cache: 'no-store' })
    .then(response => (response.ok ? response.json() : { enabled: false }))
    .catch(() => ({ enabled: false }));
}

/** Builds a valid graph from the shared maps. Links whose notes were removed concurrently are dropped. */
function graphFromDoc(nodes: Y.Map<CanvasNode>, edges: Y.Map<Connection>): KnowledgeGraph {
  const nodeList = [...nodes.values()];
  const ids = new Set(nodeList.map(node => node.id));
  const edgeList = [...edges.values()].filter(edge => ids.has(edge.from) && ids.has(edge.to) && edge.from !== edge.to);
  return normalizeGraph(nodeList, edgeList);
}

export function useCollaboration({
  projectId,
  ready,
  graph,
  onRemoteGraph,
  onPeerJoined,
  onPeerLeft
}: {
  projectId: string;
  /** True once this map's graph has loaded from the database. */
  ready: boolean;
  graph: KnowledgeGraph;
  onRemoteGraph: (graph: KnowledgeGraph, changed: RemoteChange) => void;
  onPeerJoined?: (user: PresenceUser) => void;
  onPeerLeft?: (user: PresenceUser) => void;
}) {
  const [status, setStatus] = useState<CollabStatus>('off');
  const [peers, setPeers] = useState<PresencePeer[]>([]);
  const [self, setSelf] = useState<PresenceUser | null>(null);

  const providerRef = useRef<HocuspocusProvider | null>(null);
  const docRef = useRef<Y.Doc | null>(null);
  const syncedRef = useRef(false);
  // What the shared document last agreed on, per id, as JSON: the baseline for sending only our changes.
  const sentNodes = useRef(new Map<string, string>());
  const sentEdges = useRef(new Map<string, string>());
  const jsonCache = useRef(new WeakMap<object, string>());
  const graphRef = useRef(graph);
  const callbacks = useRef({ onRemoteGraph, onPeerJoined, onPeerLeft });
  useEffect(() => {
    graphRef.current = graph;
    callbacks.current = { onRemoteGraph, onPeerJoined, onPeerLeft };
  });

  const toJson = useCallback((value: object) => {
    let json = jsonCache.current.get(value);
    if (json === undefined) { json = JSON.stringify(value); jsonCache.current.set(value, json); }
    return json;
  }, []);

  /** Sends what changed locally since the document last agreed with us. */
  const pushLocal = useCallback((current: KnowledgeGraph) => {
    const doc = docRef.current;
    if (!doc || !syncedRef.current) return;
    const nodes = doc.getMap<CanvasNode>('nodes');
    const edges = doc.getMap<Connection>('edges');
    doc.transact(() => {
      const push = <T extends { id: string }>(items: Record<string, T>, target: Y.Map<T>, sent: Map<string, string>) => {
        for (const item of Object.values(items)) {
          const json = toJson(item);
          if (sent.get(item.id) !== json) { target.set(item.id, JSON.parse(json)); sent.set(item.id, json); }
        }
        for (const id of [...sent.keys()]) {
          if (!items[id]) { target.delete(id); sent.delete(id); }
        }
      };
      push(current.nodesById, nodes, sentNodes.current);
      push(current.edgesById, edges, sentEdges.current);
    }, LOCAL);
  }, [toJson]);

  // Join the map's live session once it has loaded; leave when the map changes or the page closes.
  useEffect(() => {
    if (!ready || !projectId) return;
    let cancelled = false;
    let provider: HocuspocusProvider | null = null;
    const doc = new Y.Doc();
    let known = new Map<string, PresenceUser>();

    void fetchToken(projectId).then(first => {
      if (cancelled || !first.enabled || !first.url || !first.token || !first.user) {
        if (!cancelled) setStatus('off');
        return;
      }
      const me = first.user;
      setSelf(me);
      setStatus('connecting');
      let firstToken: string | null = first.token;

      const nodes = doc.getMap<CanvasNode>('nodes');
      const edges = doc.getMap<Connection>('edges');

      provider = new HocuspocusProvider({
        url: first.url,
        name: projectId,
        document: doc,
        // A fresh token on every (re)connect, so access is re-checked and expired tokens never strand a session.
        token: async () => {
          if (firstToken) { const token = firstToken; firstToken = null; return token; }
          const next = await fetchToken(projectId);
          return next.token || '';
        },
        onStatus: ({ status: socketStatus }) => {
          if (cancelled || socketStatus === WebSocketStatus.Connected) return;
          // While disconnected, edits keep going into the local document; Yjs merges them when we're back.
          setStatus(syncedRef.current ? 'reconnecting' : 'connecting');
        },
        onSynced: ({ state }) => {
          if (cancelled || !state) return;
          if (!syncedRef.current) {
            if (nodes.size === 0 && edges.size === 0) {
              // First one here: the live document starts from the map we loaded.
              sentNodes.current = new Map();
              sentEdges.current = new Map();
              syncedRef.current = true;
              pushLocal(graphRef.current);
            } else {
              // Others are already here: their live map replaces the copy we loaded.
              sentNodes.current = new Map([...nodes.entries()].map(([id, node]) => [id, JSON.stringify(node)]));
              sentEdges.current = new Map([...edges.entries()].map(([id, edge]) => [id, JSON.stringify(edge)]));
              syncedRef.current = true;
              try {
                callbacks.current.onRemoteGraph(graphFromDoc(nodes, edges), { nodes: new Set(nodes.keys()), edges: new Set(edges.keys()) });
              } catch (error) {
                console.warn('Could not open the live map:', error);
              }
            }
          }
          setStatus('live');
        },
        onAuthenticationFailed: () => { if (!cancelled) setStatus('off'); },
        onAwarenessUpdate: ({ states }) => {
          if (cancelled) return;
          const next: PresencePeer[] = [];
          for (const state of states) {
            if (state.clientId === doc.clientID || !state.user) continue;
            next.push({
              clientId: state.clientId,
              user: state.user as PresenceUser,
              cursor: state.cursor ?? null,
              selection: Array.isArray(state.selection) ? state.selection : [],
              editing: typeof state.editing === 'string' ? state.editing : null
            });
          }
          // One person may have several tabs open: announce people, not tabs.
          const people = new Map(next.filter(peer => peer.user.id !== me.id).map(peer => [peer.user.id, peer.user]));
          for (const [id, user] of people) if (!known.has(id)) callbacks.current.onPeerJoined?.(user);
          for (const [id, user] of known) if (!people.has(id)) callbacks.current.onPeerLeft?.(user);
          known = people;
          setPeers(next);
        }
      });
      provider.setAwarenessField('user', me);
      providerRef.current = provider;
      docRef.current = doc;

      // Apply teammates' edits, batched per frame so a dragged note doesn't re-render the board for every message.
      let pending: RemoteChange | null = null;
      let frame = 0;
      const flush = () => {
        frame = 0;
        const changed = pending;
        pending = null;
        if (!changed || cancelled) return;
        for (const id of changed.nodes) {
          const node = nodes.get(id);
          if (node) sentNodes.current.set(id, JSON.stringify(node)); else sentNodes.current.delete(id);
        }
        for (const id of changed.edges) {
          const edge = edges.get(id);
          if (edge) sentEdges.current.set(id, JSON.stringify(edge)); else sentEdges.current.delete(id);
        }
        try {
          callbacks.current.onRemoteGraph(graphFromDoc(nodes, edges), changed);
        } catch (error) {
          console.warn('Skipped an invalid live update:', error);
        }
      };
      const collect = <T,>(kind: 'nodes' | 'edges') => (event: Y.YMapEvent<T>, transaction: Y.Transaction) => {
        if (transaction.origin === LOCAL || !syncedRef.current) return;
        pending ??= { nodes: new Set(), edges: new Set() };
        for (const key of event.keysChanged) pending[kind].add(key);
        if (!frame) frame = requestAnimationFrame(flush);
      };
      nodes.observe(collect<CanvasNode>('nodes'));
      edges.observe(collect<Connection>('edges'));
    });

    return () => {
      cancelled = true;
      syncedRef.current = false;
      provider?.destroy();
      doc.destroy();
      providerRef.current = null;
      docRef.current = null;
      sentNodes.current = new Map();
      sentEdges.current = new Map();
      setPeers([]);
      setStatus('off');
    };
  }, [projectId, ready, pushLocal]);

  // Our own edits go out as they happen. Graphs that came from teammates are skipped by the JSON baseline.
  useEffect(() => { pushLocal(graph); }, [graph, pushLocal]);

  // Presence: where our pointer is on the board, what we have selected, what we're writing in.
  const lastCursorAt = useRef(0);
  const pendingCursor = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setCursor = useCallback((point: { x: number; y: number } | null) => {
    const send = () => {
      lastCursorAt.current = Date.now();
      providerRef.current?.setAwarenessField('cursor', point ? { x: Math.round(point.x), y: Math.round(point.y) } : null);
    };
    if (pendingCursor.current) clearTimeout(pendingCursor.current);
    const wait = CURSOR_INTERVAL_MS - (Date.now() - lastCursorAt.current);
    if (wait <= 0 || !point) send(); else pendingCursor.current = setTimeout(send, wait);
  }, []);
  const setSelection = useCallback((ids: string[]) => {
    providerRef.current?.setAwarenessField('selection', ids.slice(0, 50));
  }, []);
  const setEditing = useCallback((id: string | null) => {
    providerRef.current?.setAwarenessField('editing', id);
  }, []);

  return { status, peers, self, setCursor, setSelection, setEditing };
}
