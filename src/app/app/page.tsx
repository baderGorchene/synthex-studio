'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import {
  ArrowRight, BookOpenText, Check, ChevronDown,
  FileJson2, FileText, FolderArchive, GitBranch,
  Image as ImageIcon, LoaderCircle, MoreHorizontal, Plus, Redo2,
  Search, Shapes, Share, Square, Undo2, Upload, X
} from 'lucide-react';
import { GraphCanvas, membersOf } from '@/components/research/GraphCanvas';
import { KnowledgeViews } from '@/components/research/KnowledgeViews';
import { NodeInspector } from '@/components/research/NodeInspector';
import { NoteEditor } from '@/components/research/NoteEditor';
import { CanvasToolDock, type ResearchProject, type WorkspaceSection } from '@/components/research/WorkspaceSidebar';
import { extractYouTubeVideoId } from '@/components/research/SourceMetadata';
import { addNode, addRelationship, exportContextMarkdown, exportGraphJson, exportMermaid, normalizeGraph, removeNode, strokeForLabel, updateNode, updateRelationship, type KnowledgeGraph } from '@/lib/graph';
import { parseBibTeX, bibEntriesToCanvasNodes } from '@/lib/bibtex';
import { generateStandaloneSvg, exportGraphToPng } from '@/lib/canvas-export';
import type { CanvasNode, CanvasNodeType, Connection, Coordinates, GraphRevisionSummary, ResearchChange, ResearchSession } from '@/types/canvas';
import type { AIStatus } from '@/lib/ai-service';
import { ChatToolCard } from '@/components/research/ChatToolCard';
import { MarkdownView } from '@/components/research/MarkdownView';
import { DocumentPane } from '@/components/research/DocumentPane';
import { LiveResearchCard, type ResearchLiveProgress } from '@/components/research/LiveResearchCard';
import type { ChatToolCall } from '@/types/chat-tools';
import { computeOrganizedLayout } from '@/lib/graph-organizer';
import { auditGraphTopology } from '@/lib/graph-analyst';
import { UserNav } from '@/components/auth/UserNav';
import { CreditsModal } from '@/components/auth/CreditsModal';
import { SubscriptionOnboardingModal } from '@/components/auth/SubscriptionOnboardingModal';
import { SynthexLogo } from '@/components/brand/SynthexLogo';
import { nodeLabel } from '@/components/research/nodes/BaseKnowledgeCard';
import type { SketchStroke } from '@/components/research/SketchLayer';
import { parseSketchStyle, type SketchStyle } from '@/components/research/inkPalette';

type Viewport = { zoom: number; pan: Coordinates };
type Tool = 'select' | 'connect' | 'hand' | 'pen' | 'marker' | 'eraser';
type ChatLine = {
  role: 'user' | 'assistant';
  text: string;
  referencedNodeIds?: string[];
  provider?: 'OpenAI' | 'Gemini';
  model?: string;
  usedFallback?: boolean;
  toolCall?: ChatToolCall | null;
  isStreaming?: boolean;
  researchProgress?: ResearchLiveProgress;
};
type Modal = 'chat' | 'project' | 'search' | 'credits' | null;

const blankGraph = (): KnowledgeGraph => normalizeGraph([], []);
const newId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const errorText = (body: unknown, fallback: string) => typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string' ? body.error : fallback;

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(errorText(body, 'The request could not be completed.'));
  return body as T;
}

// Per-viewer preferences (layout, note-size lock). /app is prerendered with the defaults, so they are read
// through useSyncExternalStore: hydration uses the server snapshot, then React re-renders with the saved value.
// The in-memory copy keeps the controls working when localStorage is blocked (private windows).
const PREFS_EVENT = 'synthex-prefs';
const prefsMemory = new Map<string, string>();
function readPref(key: string): string | null {
  if (prefsMemory.has(key)) return prefsMemory.get(key)!;
  try { return localStorage.getItem(key); } catch { return null; }
}
function writePref(key: string, value: string) {
  prefsMemory.set(key, value);
  try { localStorage.setItem(key, value); } catch { /* per-viewer convenience only */ }
  window.dispatchEvent(new Event(PREFS_EVENT));
}
function subscribePrefs(onChange: () => void) {
  // Another tab changed storage: drop the in-memory copy so the new value is read.
  const onStorage = () => { prefsMemory.clear(); onChange(); };
  window.addEventListener('storage', onStorage);
  window.addEventListener(PREFS_EVENT, onChange);
  return () => { window.removeEventListener('storage', onStorage); window.removeEventListener(PREFS_EVENT, onChange); };
}
function parseSketch(raw: string | null): SketchStroke[] {
  try { const parsed = JSON.parse(raw || '[]'); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}
function useStoredPref(key: string) {
  return useSyncExternalStore(subscribePrefs, () => readPref(key), () => null);
}

function downloadText(filename: string, content: string, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

const plural = (count: number, singular: string, many = `${singular}s`) => `${count} ${count === 1 ? singular : many}`;

// A new note takes its title from its first line until the person names it themselves.
function withAutoTitle(node: CanvasNode | undefined, fields: Partial<CanvasNode>): Partial<CanvasNode> {
  if (!node || node.metadata?.autoTitle !== true) return fields;
  if (fields.title !== undefined) return { ...fields, metadata: { ...node.metadata, ...fields.metadata, autoTitle: false } };
  const firstLine = fields.content?.split(/\r?\n/).find(line => line.trim())?.replace(/^[#>*\-\s]+/, '').trim().slice(0, 80);
  return firstLine ? { ...fields, title: firstLine } : fields;
}

type Layout = 'map' | 'split' | 'doc';
const LAYOUTS: Array<[Layout, string]> = [['map', 'Map'], ['split', 'Map + Doc'], ['doc', 'Doc']];
const MORE_VIEWS: Array<[WorkspaceSection, string, string]> = [
  ['evidence', 'Evidence paths', 'How sources back each claim'],
  ['table', 'Claims & questions', 'Every assertion in one table'],
  ['sources', 'Sources', 'Everything the map cites'],
  ['questions', 'Open questions', 'What is still unanswered'],
  ['history', 'Research history', 'Every research run and its drafts'],
  ['revisions', 'Revisions', 'Snapshots you can restore']
];

const STARTERS = [
  { label: 'Map the evidence on sleep and memory', kind: 'Research question', prompt: 'How does sleep affect memory? What is well supported and what is still debated?' },
  { label: 'Plan a video essay on urban heat islands', kind: 'Creator brief', prompt: 'Plan a video essay on urban heat islands: causes, who is most affected, and what cities are doing about it.' },
  { label: 'Weigh three pricing models for a SaaS product', kind: 'Work decision', prompt: 'Compare per-seat, usage-based and flat-rate pricing for a B2B SaaS product: trade-offs, risks, and when each fits.' },
  { label: 'Turn a topic into a revision map', kind: 'Study notes', prompt: 'Build a revision map of the causes and consequences of the French Revolution.' }
];

export default function SynthexWorkspace() {
  const [projects, setProjects] = useState<ResearchProject[]>([]);
  const [projectId, setProjectId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('synthex_active_project_id') || '';
    }
    return '';
  });
  const [graph, setGraph] = useState<KnowledgeGraph>(blankGraph);
  const [sessions, setSessions] = useState<ResearchSession[]>([]);
  const [section, setSection] = useState<WorkspaceSection>('canvas');
  const savedLayout = useStoredPref('synthex_layout');
  const layout: Layout = savedLayout === 'split' || savedLayout === 'doc' ? savedLayout : 'map';
  const chooseLayout = useCallback((value: Layout) => writePref('synthex_layout', value), []);
  const [loading, setLoading] = useState(true);
  const [loadedProject, setLoadedProject] = useState('');
  const [spacePressed, setSpacePressed] = useState(false);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
  const [userAuth, setUserAuth] = useState<{
    contextCredits?: number;
    subscriptionTier?: string;
    hasSelectedPlan?: boolean;
  } | null>(null);
  const aiConfigured = Boolean(aiStatus?.configured);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewport, setViewport] = useState<Viewport>({ zoom: 0.82, pan: { x: 76, y: 52 } });
  const viewportRef = useRef(viewport);
  useEffect(() => { viewportRef.current = viewport; }, [viewport]);
  // New items that are not pinned yet (see GraphCanvas): they pin once they sit on free board.
  const [placingIds, setPlacingIds] = useState<string[]>([]);
  const markPlaced = useCallback((id: string) => setPlacingIds(current => current.filter(value => value !== id)), []);
  const [canvasFitKey, setCanvasFitKey] = useState(0);
  const [tool, setTool] = useState<Tool>('select');
  const [linkingFromId, setLinkingFromId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [groupCanvasId, setGroupCanvasId] = useState<string | null>(null);
  const [groupViewport, setGroupViewport] = useState<Viewport>({ zoom: 0.72, pan: { x: 60, y: 54 } });
  const [modal, setModal] = useState<Modal>(null);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'inspector' | 'chat'>('inspector');
  const [exportMenu, setExportMenu] = useState(false);
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const [overflowMenuOpen, setOverflowMenuOpen] = useState(false);
  const overflowMenuRef = useRef<HTMLDivElement>(null);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [addRecordMenuOpen, setAddRecordMenuOpen] = useState(false);
  const navMenuRef = useRef<HTMLDivElement>(null);
  const projectMenuRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const addRecordMenuRef = useRef<HTMLDivElement>(null);
  const [thinkingStep, setThinkingStep] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const navigateTo = useCallback((targetSection: WorkspaceSection) => {
    setSection(targetSection);
    setSelectedIds([]);
    setEditingNoteId(null);
    setLinkingFromId(null);
    setTool('select');
  }, []);

  useEffect(() => {
    if (!navMenuOpen && !projectMenuOpen && !exportMenu && !addRecordMenuOpen && !overflowMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (navMenuOpen && navMenuRef.current && !navMenuRef.current.contains(target)) {
        setNavMenuOpen(false);
      }
      if (projectMenuOpen && projectMenuRef.current && !projectMenuRef.current.contains(target)) {
        setProjectMenuOpen(false);
      }
      if (exportMenu && exportMenuRef.current && !exportMenuRef.current.contains(target)) {
        setExportMenu(false);
      }
      if (addRecordMenuOpen && addRecordMenuRef.current && !addRecordMenuRef.current.contains(target)) {
        setAddRecordMenuOpen(false);
      }
      if (overflowMenuOpen && overflowMenuRef.current && !overflowMenuRef.current.contains(target)) {
        setOverflowMenuOpen(false);
      }
    };
    window.addEventListener('pointerdown', handlePointerDown, true);
    return () => window.removeEventListener('pointerdown', handlePointerDown, true);
  }, [navMenuOpen, projectMenuOpen, exportMenu, addRecordMenuOpen, overflowMenuOpen]);
  const [composerText, setComposerText] = useState('');
  const [composerMode, setComposerMode] = useState<'quick' | 'deep'>('quick');
  const composerRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const researchAbort = useRef<AbortController | null>(null);
  const [detachingIds, setDetachingIds] = useState<string[]>([]);
  // The note or cluster open in the full-screen editor (opened from its Edit button or Enter).
  const [editorId, setEditorId] = useState<string | null>(null);
  const [keptIds, setKeptIds] = useState<string[]>([]);
  const [researching, setResearching] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [chatLines, setChatLines] = useState<ChatLine[]>([]);
  const [activeResearchIntent, setActiveResearchIntent] = useState<{ mode: 'quick' | 'deep' } | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const [activeSession, setActiveSession] = useState<ResearchSession | null>(null);
  const [reviewDecisions, setReviewDecisions] = useState<Record<string, 'accepted' | 'rejected'>>({});
  const [projectTitleDraft, setProjectTitleDraft] = useState('');
  const [projectTemplate, setProjectTemplate] = useState<'blank' | 'rag'>('rag');
  const [creatingProject, setCreatingProject] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [undoReady, setUndoReady] = useState(false);
  const [redoReady, setRedoReady] = useState(false);
  const undoStack = useRef<KnowledgeGraph[]>([]);
  const redoStack = useRef<KnowledgeGraph[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const bibRef = useRef<HTMLInputElement>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadRequest = useRef(0);
  const graphRef = useRef(graph);
  graphRef.current = graph;

  const announce = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 3600);
  }, []);

  const isResizeLocked = useStoredPref('synthex_resize_locked') === 'true';

  // Pen and marker drawings: saved per map in this browser only. They never touch the graph, the document or AI context.
  const sketchKey = `synthex_sketch_${projectId || 'default'}`;
  const sketchRaw = useStoredPref(sketchKey);
  const sketch = useMemo(() => parseSketch(sketchRaw), [sketchRaw]);
  const sketchStyleRaw = useStoredPref('synthex_sketch_style');
  const sketchStyle = useMemo(() => parseSketchStyle(sketchStyleRaw), [sketchStyleRaw]);
  const saveSketchStyle = useCallback((tool: 'pen' | 'marker', patch: Partial<SketchStyle['pen']>) => {
    const saved = parseSketchStyle(readPref('synthex_sketch_style')); // merge against the saved value so quick changes never undo each other
    writePref('synthex_sketch_style', JSON.stringify({ ...saved, [tool]: { ...saved[tool], ...patch } }));
  }, []);
  // Updates read the saved strokes at write time, so strokes finished in quick succession never overwrite each other.
  const saveSketch = useCallback((update: (strokes: SketchStroke[]) => SketchStroke[]) => writePref(sketchKey, JSON.stringify(update(parseSketch(readPref(sketchKey))))), [sketchKey]);

  const toggleResizeLock = useCallback(() => {
    const next = !isResizeLocked;
    writePref('synthex_resize_locked', String(next));
    announce(next ? 'Note sizes locked.' : 'Note sizes unlocked. Drag a corner to resize.');
  }, [announce, isResizeLocked]);

  const updateGraph = useCallback((change: (current: KnowledgeGraph) => KnowledgeGraph, recordUndo = true) => {
    let didRecord = false;
    setGraph(current => {
      try {
        const next = change(current);
        if (next !== current && recordUndo) {
          undoStack.current = [...undoStack.current.slice(-39), current];
          redoStack.current = [];
          didRecord = true;
        }
        return next;
      } catch (err) {
        console.warn('Graph update prevented:', err);
        return current;
      }
    });
    if (didRecord) {
      setUndoReady(true);
      setRedoReady(false);
    }
  }, []);

  const undo = useCallback(() => {
    const previous = undoStack.current.pop();
    if (!previous) return;
    redoStack.current.push(graphRef.current);
    setGraph(previous);
    setUndoReady(undoStack.current.length > 0);
    setRedoReady(true);
  }, []);
  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(graphRef.current);
    setGraph(next);
    setUndoReady(true);
    setRedoReady(redoStack.current.length > 0);
  }, []);

  const lastRevisionTime = useRef(Date.now());

  const restoreRevision = useCallback(async (revisionId: string) => {
    try {
      const res = await fetch('/api/revisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, action: 'restore', revisionId })
      });
      const data = await readJson<{ success: boolean; nodes: CanvasNode[]; relationships: Connection[]; revision: GraphRevisionSummary }>(res);
      if (data.nodes) {
        updateGraph(() => normalizeGraph(data.nodes, data.relationships || []));
        setCanvasFitKey(v => v + 1);
        setSelectedIds([]);
        announce(`Restored snapshot: ${data.revision.title}`);
      }
    } catch (err) {
      announce(err instanceof Error ? err.message : 'Could not restore this revision.');
    }
  }, [projectId, updateGraph, announce]);

  const createCheckpoint = useCallback(async (customTitle?: string) => {
    try {
      const title = customTitle?.trim() || `Manual checkpoint (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
      const res = await fetch('/api/revisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          action: 'create',
          title,
          nodes: Object.values(graph.nodesById),
          relationships: Object.values(graph.edgesById)
        })
      });
      const data = await readJson<{ success: boolean; revision: GraphRevisionSummary }>(res);
      if (data.success) {
        announce(`Checkpoint saved: "${data.revision.title}"`);
      }
    } catch (err) {
      announce(err instanceof Error ? err.message : 'Could not create checkpoint.');
    }
  }, [projectId, graph, announce]);

  const loadProject = useCallback(async (id: string) => {
    const requestId = ++loadRequest.current;
    setLoading(true);
    setLoadedProject('');
    setSelectedIds([]);
    undoStack.current = [];
    redoStack.current = [];
    setUndoReady(false);
    setRedoReady(false);
    try {
      const [graphResponse, historyResponse] = await Promise.all([
        fetch(`/api/graph?projectId=${encodeURIComponent(id)}`, { cache: 'no-store' }),
        fetch(`/api/research?projectId=${encodeURIComponent(id)}`, { cache: 'no-store' })
      ]);
      const [graphBody, historyBody] = await Promise.all([
        readJson<{ nodes: CanvasNode[]; relationships: Connection[] }>(graphResponse),
        readJson<{ sessions: ResearchSession[] }>(historyResponse)
      ]);
      if (requestId !== loadRequest.current) return;
      setGraph(normalizeGraph(graphBody.nodes, graphBody.relationships));
      setCanvasFitKey(value => value + 1);
      setSessions(historyBody.sessions);
      setLoadedProject(id);
    } catch (error) {
      if (requestId !== loadRequest.current) return;
      announce(error instanceof Error ? error.message : 'Could not load this workspace.');
      setGraph(blankGraph());
      setSessions([]);
    } finally {
      if (requestId === loadRequest.current) setLoading(false);
    }
  }, [announce]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/projects', { cache: 'no-store' })
      .then(response => readJson<{ projects: ResearchProject[] }>(response))
      .then(data => {
        if (cancelled) return;
        setProjects(data.projects);
        if (data.projects.length > 0) {
          const stored = typeof window !== 'undefined' ? localStorage.getItem('synthex_active_project_id') : null;
          const matching = data.projects.find(p => p.id === stored);
          const nextId = matching ? matching.id : data.projects[0].id;
          setProjectId(nextId);
          if (typeof window !== 'undefined') {
            localStorage.setItem('synthex_active_project_id', nextId);
          }
        }
      })
      .catch(error => announce(error instanceof Error ? error.message : 'Could not load projects.'));
    fetch('/api/ai/status', { cache: 'no-store' })
      .then(response => response.json())
      .then((data: AIStatus) => {
        if (!cancelled) setAiStatus(data);
      })
      .catch(() => {
        if (!cancelled) setAiStatus(null);
      });
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(response => response.json())
      .then(data => {
        if (!cancelled) {
          setUserAuth({
            contextCredits: data.user?.contextCredits ?? data.contextCredits ?? 0,
            subscriptionTier: data.user?.subscriptionTier ?? data.subscriptionTier ?? 'none',
            hasSelectedPlan: Boolean(data.hasSelectedPlan)
          });
        }
      })
      .catch(() => { });
    return () => { cancelled = true; };
  }, [announce]);

  useEffect(() => {
    if (projectId && projects.length) void loadProject(projectId);
  }, [projectId, projects.length, loadProject]);

  useEffect(() => {
    if (!loadedProject || loadedProject !== projectId || loading) return;
    setSaveState('saving');
    const timer = setTimeout(async () => {
      try {
        await readJson(await fetch('/api/graph', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, nodes: Object.values(graph.nodesById), relationships: Object.values(graph.edgesById) })
        }));
        setSaveState('saved');
        const now = Date.now();
        if (now - lastRevisionTime.current > 120_000) {
          lastRevisionTime.current = now;
          fetch('/api/revisions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId,
              action: 'create',
              title: `Auto-saved snapshot (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
              nodes: Object.values(graph.nodesById),
              relationships: Object.values(graph.edgesById)
            })
          }).catch(() => { });
        }
      } catch (error) {
        setSaveState('error');
        announce(error instanceof Error ? error.message : 'Changes could not be saved.');
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [graph, projectId, loadedProject, loading, announce]);

  const deleteNodes = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const remove = () => {
      updateGraph(current => {
        let next = current;
        for (const id of ids) {
          if (next.nodesById[id]) next = removeNode(next, id);
        }
        return next;
      });
      setDetachingIds(current => current.filter(id => !ids.includes(id)));
    };
    setSelectedIds(current => current.filter(id => !ids.includes(id)));
    if (editingNoteId && ids.includes(editingNoteId)) setEditingNoteId(null);
    announce(ids.length === 1 ? 'Removed from the map. Undo with Ctrl+Z.' : `${ids.length} ideas removed. Undo with Ctrl+Z.`);
    // Let the pin pop and the note drop (typeset.css) before the node leaves the graph.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { remove(); return; }
    setDetachingIds(current => [...current, ...ids]);
    setTimeout(remove, 580);
  }, [announce, updateGraph, editingNoteId]);

  const deleteSelected = useCallback(() => {
    deleteNodes(selectedIds);
  }, [deleteNodes, selectedIds]);

  const selectMultipleNodes = useCallback((ids: string[], additive = false) => {
    setSelectedIds(current => {
      if (additive) {
        const set = new Set(current);
        ids.forEach(id => set.add(id));
        return Array.from(set);
      }
      return ids;
    });
  }, []);

  useEffect(() => {
    const onGlobalPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.closest('.menu-anchor')) setExportMenu(false);
      if (editingNoteId) {
        const activeNote = target.closest('.knowledge-card')?.getAttribute('data-graph-node');
        if (activeNote !== editingNoteId) setEditingNoteId(null);
      }
    };
    window.addEventListener('pointerdown', onGlobalPointerDown, true);
    return () => window.removeEventListener('pointerdown', onGlobalPointerDown, true);
  }, [editingNoteId]);

  const nodes = useMemo(() => Object.values(graph.nodesById), [graph]);
  const edges = useMemo(() => Object.values(graph.edgesById), [graph]);
  const selectedNode = selectedIds.length === 1 ? graph.nodesById[selectedIds[0]] : undefined;
  const project = projects.find(item => item.id === projectId);


  // Draft layer: the newest research run with undecided changes sits on the board in proof blue.
  const draftSession = useMemo(
    () => [...sessions].sort((a, b) => b.createdAt - a.createdAt).find(session => session.changes.some(change => change.status === 'pending')),
    [sessions]
  );
  const { displayGraph, draftIds } = useMemo(() => {
    if (!draftSession) return { displayGraph: graph, draftIds: undefined };
    const nodesById = { ...graph.nodesById };
    const edgesById = { ...graph.edgesById };
    const ids = new Set<string>();
    const pending = draftSession.changes.filter(change => change.status === 'pending');
    for (const change of pending) {
      if (change.kind !== 'node') continue;
      const node = change.payload as CanvasNode;
      nodesById[node.id] = node;
      ids.add(node.id);
    }
    for (const change of pending) {
      if (change.kind !== 'relationship') continue;
      const edge = change.payload as Connection;
      if (!nodesById[edge.from] || !nodesById[edge.to]) continue;
      edgesById[edge.id] = edge;
      ids.add(edge.id);
    }
    return { displayGraph: { nodesById, edgesById }, draftIds: ids };
  }, [graph, draftSession]);
  const draftNodeCount = draftSession?.changes.filter(change => change.status === 'pending' && change.kind === 'node').length ?? 0;
  const draftSourceCount = draftSession?.changes.filter(change => change.status === 'pending' && change.kind === 'node' && (change.payload as CanvasNode).type === 'source').length ?? 0;
  const searchResults = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    return needle ? nodes.filter(node => `${node.title} ${node.content || ''} ${node.description || ''} ${node.url || ''} ${node.type}`.toLowerCase().includes(needle)).slice(0, 30) : [];
  }, [nodes, searchQuery]);

  const addRecord = useCallback((type: CanvasNodeType, initialData?: Partial<CanvasNode>) => {
    const now = Date.now();
    const index = Object.keys(graphRef.current.nodesById).length;
    const width = initialData?.width ?? (type === 'group' ? 560 : type === 'image' ? 320 : type === 'question' ? 300 : 280);
    // Without a given position, a new item appears in the middle of what you're looking at.
    const board = document.querySelector('.graph-canvas')?.getBoundingClientRect();
    const view = viewportRef.current;
    const centred = initialData?.x === undefined && board
      ? { x: Math.round((board.width / 2 - view.pan.x) / view.zoom - width / 2), y: Math.round((board.height / 2 - view.pan.y) / view.zoom - (type === 'group' ? 180 : 70)) }
      : null;
    const labels: Record<string, string> = { concept: 'New concept', claim: 'New claim', question: 'New question', hypothesis: 'New hypothesis', source: 'New source', note: 'New note', group: 'New knowledge cluster', ai_insight: 'New insight', image: 'Media & figure' };
    const node: CanvasNode = {
      id: newId(),
      type,
      x: initialData?.x ?? centred?.x ?? (260 + (index % 3) * 340),
      y: initialData?.y ?? centred?.y ?? (170 + Math.floor(index / 3) * 230),
      width,
      height: type === 'group' ? 360 : undefined,
      title: initialData?.title || labels[type] || 'New knowledge',
      color: initialData?.color || (type === 'question' ? 'terracotta' : 'neutral'),
      createdAt: now,
      metadata: { origin: 'user', ...(type === 'claim' ? { claimStatus: 'unverified' as const } : {}), ...(type === 'note' && !initialData?.title ? { autoTitle: true } : {}), ...initialData?.metadata },
      ...initialData
    };
    try {
      updateGraph(current => addNode(current, node));
      if (centred && type !== 'group') setPlacingIds(current => [...current, node.id]);
      setSelectedIds([node.id]);
      if (type === 'note') setEditingNoteId(node.id);
      setSection('canvas');
    } catch (error) {
      announce(error instanceof Error ? error.message : 'Could not add that record.');
    }
  }, [announce, updateGraph]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.matches('input, textarea, select, [contenteditable="true"]');
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setModal('search'); return; }
      if (!typing && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo(); else undo();
        return;
      }
      if (!typing && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
        return;
      }
      if (!typing && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        setSelectedIds(Object.keys(graphRef.current.nodesById));
        return;
      }
      // While the full-screen editor is open it owns the keyboard: only Esc (close) reaches the board.
      if (editorId) { if (event.key === 'Escape') setEditorId(null); return; }
      if (!typing && event.key === 'Enter' && !target?.closest('button, a, [role="button"]') && selectedIds.length === 1 && !draftIds?.has(selectedIds[0])) {
        event.preventDefault();
        setEditorId(selectedIds[0]);
        return;
      }
      if (event.key === 'Escape') { setOverflowMenuOpen(false); setModal(null); setActiveSession(null); setLinkingFromId(null); setEditingNoteId(null); setGroupCanvasId(null); setTool('select'); setRightDrawerOpen(false); }
      if (!typing && !target?.closest('button, a, [role="button"]')) {
        const key = event.key.toLowerCase();
        if (event.key === 'Delete' || event.key === 'Backspace') {
          if (selectedIds.length > 0) {
            event.preventDefault();
            deleteSelected();
          }
        } else if (key === 'v') {
          event.preventDefault();
          setTool('select');
        } else if (key === 'h') {
          event.preventDefault();
          setTool('hand');
        } else if (key === 'c' && !event.shiftKey) {
          event.preventDefault();
          setTool(value => value === 'connect' ? 'select' : 'connect');
          setLinkingFromId(null);
        } else if (key === 'p' || key === 'b' || key === 'e') {
          event.preventDefault();
          const drawTool: Tool = key === 'p' ? 'pen' : key === 'b' ? 'marker' : 'eraser';
          setTool(value => value === drawTool ? 'select' : drawTool);
          setLinkingFromId(null);
        } else if (key === 'f') {
          event.preventDefault();
          setCanvasFitKey(k => k + 1);
        } else if (key === 'n') {
          event.preventDefault();
          addRecord('note');
        } else if (key === 'k' || (key === 'c' && event.shiftKey)) {
          event.preventDefault();
          addRecord('claim');
        } else if (key === 's') {
          event.preventDefault();
          addRecord('source');
        } else if (key === 'i') {
          event.preventDefault();
          addRecord('image');
        } else if (key === 'g') {
          event.preventDefault();
          addRecord('group');
        } else if (key === 'r') {
          event.preventDefault();
          composerRef.current?.focus();
        } else if (event.key === '?' || (event.shiftKey && key === 'a')) {
          event.preventDefault();
          setDrawerTab('chat');
          setRightDrawerOpen(true);
        }
      }
      if (!typing && !target?.closest('button, a, [role="button"]') && event.code === 'Space') { event.preventDefault(); setSpacePressed(true); }
    };
    const onKeyUp = (event: KeyboardEvent) => { if (event.code === 'Space') setSpacePressed(false); };
    const onBlur = () => setSpacePressed(false);

    const onPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.matches('input, textarea, select, [contenteditable="true"]');
      if (typing) return;
      const text = event.clipboardData?.getData('text')?.trim();
      if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
        event.preventDefault();
        const ytId = extractYouTubeVideoId(text);
        addRecord('source', {
          title: ytId ? 'YouTube video' : 'Web link',
          url: text,
          domain: ytId ? 'youtube.com' : undefined,
          imageUrl: ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : undefined,
          metadata: {
            origin: 'user',
            siteName: ytId ? 'YouTube' : undefined,
            image: ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : undefined
          }
        });
        announce(ytId ? 'YouTube video card added.' : 'Link card added.');
      }
    };

    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('paste', onPaste);
    };
  }, [undo, redo, selectedIds, deleteSelected, addRecord, announce, editorId, draftIds]);

  const moveNodes = useCallback((positions: Record<string, Coordinates>) => {
    updateGraph(current => {
      let next = current;
      const allGroups = Object.values(next.nodesById).filter(n => n.type === 'group' || n.type === 'section');

      for (const [id, point] of Object.entries(positions)) {
        const node = next.nodesById[id];
        if (!node) continue;

        const updates: Partial<CanvasNode> = { ...point };

        // If not a cluster itself, check if dragged inside or outside any cluster
        if (node.type !== 'group' && node.type !== 'section') {
          const nodeWidth = node.width || 280;
          const nodeHeight = node.height || 150;
          const centerX = point.x + nodeWidth / 2;
          const centerY = point.y + nodeHeight / 2;

          let targetGroupId: string | undefined = undefined;
          for (const g of allGroups) {
            const gw = Math.max(340, g.width || 560);
            const gh = Math.max(240, g.height || 360);
            if (centerX >= g.x && centerX <= g.x + gw && centerY >= g.y && centerY <= g.y + gh) {
              targetGroupId = g.id;
              break;
            }
          }

          if (targetGroupId && node.sectionId !== targetGroupId) {
            updates.sectionId = targetGroupId;
          } else if (!targetGroupId && node.sectionId) {
            const currentGroup = next.nodesById[node.sectionId];
            if (currentGroup) {
              const gw = Math.max(340, currentGroup.width || 560);
              const gh = Math.max(240, currentGroup.height || 360);
              if (centerX < currentGroup.x - 70 || centerX > currentGroup.x + gw + 70 ||
                centerY < currentGroup.y - 70 || centerY > currentGroup.y + gh + 70) {
                updates.sectionId = undefined;
              }
            }
          }
        }

        next = updateNode(next, id, updates);
      }
      return next;
    }, false);
  }, [updateGraph]);

  const resizeGroup = useCallback((id: string, fields: Partial<CanvasNode>) => {
    updateGraph(current => updateNode(current, id, fields), false);
  }, [updateGraph]);

  const editRelationship = useCallback((id: string, fields: Partial<Connection>) => {
    updateGraph(current => updateRelationship(current, id, fields), false);
  }, [updateGraph]);

  const deleteRelationship = useCallback((id: string) => {
    updateGraph(current => {
      if (!current.edgesById[id]) return current;
      const edgesById = { ...current.edgesById };
      delete edgesById[id];
      return { ...current, edgesById };
    });
    announce('Relationship deleted.');
  }, [announce, updateGraph]);

  const connectNodes = useCallback((from: string, to: string, label?: string) => {
    if (from === to) {
      announce('A record cannot connect to itself.');
      setLinkingFromId(null);
      setTool('select');
      return;
    }
    const currentEdges = Object.values(graphRef.current.edgesById);
    const existing = currentEdges.find(
      edge => (edge.from === from && edge.to === to) || (edge.from === to && edge.to === from)
    );
    if (existing) {
      announce('That relationship already exists.');
      setLinkingFromId(null);
      setTool('select');
      return;
    }

    try {
      const edge: Connection = {
        id: newId(),
        from,
        to,
        label: label || 'related_to',
        color: 'neutral',
        arrowhead: 'end',
        lineStyle: 'curved',
        strokePattern: strokeForLabel(label || 'related_to'),
        animated: false
      };
      updateGraph(current => addRelationship(current, edge));
      setLinkingFromId(null);
      setTool('select');
      announce('Relationship added. Click the connection pill to customize style or label.');
    } catch (error) {
      announce(error instanceof Error ? error.message : 'Could not connect those records.');
      setLinkingFromId(null);
      setTool('select');
    }
  }, [announce, updateGraph]);

  const toggleGroup = (id: string) => updateGraph(current => {
    const node = current.nodesById[id];
    if (!node) return current;
    const willCollapse = !node.metadata?.collapsed;
    let nextGraph = updateNode(current, id, { metadata: { ...node.metadata, collapsed: willCollapse } });
    if (willCollapse) {
      const allNodes = Object.values(current.nodesById);
      const members = membersOf(node, allNodes);
      for (const member of members) {
        if (member.sectionId !== id) {
          nextGraph = updateNode(nextGraph, member.id, { sectionId: id });
        }
      }
    }
    return nextGraph;
  }, false);

  const updateSelectedNode = (fields: Partial<CanvasNode>) => {
    if (!selectedNode) return;
    updateGraph(current => updateNode(current, selectedNode.id, withAutoTitle(current.nodesById[selectedNode.id], fields)), false);
  };

  const reloadGraph = useCallback(async () => {
    const data = await readJson<{ nodes: CanvasNode[]; relationships: Connection[] }>(await fetch(`/api/graph?projectId=${encodeURIComponent(projectId)}`, { cache: 'no-store' }));
    setGraph(normalizeGraph(data.nodes, data.relationships));
    setCanvasFitKey(value => value + 1);
  }, [projectId]);

  const reloadHistory = useCallback(async () => {
    const data = await readJson<{ sessions: ResearchSession[] }>(await fetch(`/api/research?projectId=${encodeURIComponent(projectId)}`, { cache: 'no-store' }));
    setSessions(data.sessions);
  }, [projectId]);

  async function createProject(event: FormEvent) {
    event.preventDefault();
    if (creatingProject) return;
    setCreatingProject(true);
    try {
      const data = await readJson<{ project: ResearchProject }>(await fetch('/api/projects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: projectTitleDraft, template: projectTemplate })
      }));
      setProjects(current => [...current, data.project]);
      setProjectTitleDraft(''); setProjectMenuOpen(false); setProjectId(data.project.id);
      if (typeof window !== 'undefined') {
        localStorage.setItem('synthex_active_project_id', data.project.id);
      }
      announce('Map created.');
    } catch (error) { announce(error instanceof Error ? error.message : 'Could not create the map.'); }
    finally { setCreatingProject(false); }
  }

  const executeStreamingResearch = useCallback(async (query: string, mode: 'quick' | 'deep') => {
    setResearching(true);
    setChatBusy(true);

    const initialSteps = mode === 'deep' ? [
      { id: 'axes', label: 'Decomposing inquiry across analytical axes', status: 'running' as const },
      { id: 'queries', label: 'Formulating web search queries', status: 'pending' as const },
      { id: 'hop1', label: 'Hop 1: Exploring foundational literature & landscape', status: 'pending' as const },
      { id: 'hop2', label: 'Hop 2: Deep-dive investigations & technical details', status: 'pending' as const },
      { id: 'synthesis', label: 'Synthesizing evidence & staging verified graph cards', status: 'pending' as const }
    ] : [
      { id: 'queries', label: 'Formulating grounded search query', status: 'running' as const },
      { id: 'search', label: 'Searching live web & retrieving citations', status: 'pending' as const },
      { id: 'synthesis', label: 'Synthesizing findings & staging graph cards', status: 'pending' as const }
    ];

    setChatLines(current => [
      ...current,
      {
        role: 'assistant',
        text: `### Grounded ${mode === 'deep' ? 'Deep' : 'Quick'} Research\nInquiry: **"${query}"**\nStreaming live intermediate steps and discovered sources...`,
        model: aiStatus?.activeModel || (aiStatus?.activeProvider === 'OpenAI' ? 'gpt-6-luna' : 'gemini-3.8-flash'),
        provider: aiStatus?.activeProvider as 'OpenAI' | 'Gemini' | undefined,
        isStreaming: true,
        researchProgress: {
          mode,
          query,
          steps: initialSteps,
          queries: [],
          sources: [],
          isComplete: false
        }
      }
    ]);

    const controller = new AbortController();
    researchAbort.current = controller;
    try {
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify({ projectId, query, mode, stream: true }),
        signal: controller.signal
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        if (response.status === 402) {
          setThinkingStep(null);
          setChatLines(current => {
            const lastIdx = current.length - 1;
            if (lastIdx < 0) return current;
            const updated = [...current];
            updated[lastIdx] = {
              role: 'assistant',
              text: `**Not enough credits**\n\n${errBody.message || 'This research run needs more credits.'}`,
              isStreaming: false
            };
            return updated;
          });
          announce('Not enough credits. Top up to keep going.');
          setModal('credits');
          return;
        }
        throw new Error(errorText(errBody, 'Research request failed.'));
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported by server.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.startsWith('event:')) {
            const eventType = line.slice(6).trim();
            const nextLine = lines[i + 1]?.trim() || '';
            if (nextLine.startsWith('data:')) {
              i++;
              try {
                const eventData = JSON.parse(nextLine.slice(5).trim());

                if (eventType === 'step') {
                  const stepText = String(eventData.step || '');
                  setThinkingStep(stepText);
                  setChatLines(current => {
                    const lastIdx = current.length - 1;
                    if (lastIdx < 0) return current;
                    const last = current[lastIdx];
                    if (!last.researchProgress) return current;
                    const updated = [...current];
                    const steps = [...last.researchProgress.steps];
                    const runningIdx = steps.findIndex(s => s.status === 'running');
                    if (runningIdx !== -1 && runningIdx < steps.length - 1) {
                      steps[runningIdx] = { ...steps[runningIdx], status: 'done' };
                      steps[runningIdx + 1] = { ...steps[runningIdx + 1], status: 'running' };
                    }
                    updated[lastIdx] = {
                      ...last,
                      researchProgress: { ...last.researchProgress, steps }
                    };
                    return updated;
                  });
                } else if (eventType === 'query' && eventData.query) {
                  setChatLines(current => {
                    const lastIdx = current.length - 1;
                    if (lastIdx < 0) return current;
                    const last = current[lastIdx];
                    if (!last.researchProgress) return current;
                    if (last.researchProgress.queries.includes(eventData.query)) return current;
                    const updated = [...current];
                    updated[lastIdx] = {
                      ...last,
                      researchProgress: {
                        ...last.researchProgress,
                        queries: [...last.researchProgress.queries, eventData.query]
                      }
                    };
                    return updated;
                  });
                } else if (eventType === 'source' && eventData.source) {
                  setChatLines(current => {
                    const lastIdx = current.length - 1;
                    if (lastIdx < 0) return current;
                    const last = current[lastIdx];
                    if (!last.researchProgress) return current;
                    if (last.researchProgress.sources.some(s => s.url === eventData.source.url)) return current;
                    const updated = [...current];
                    updated[lastIdx] = {
                      ...last,
                      researchProgress: {
                        ...last.researchProgress,
                        sources: [...last.researchProgress.sources, eventData.source]
                      }
                    };
                    return updated;
                  });
                } else if (eventType === 'hop') {
                  setThinkingStep(eventData.description || `Hop ${eventData.hop}`);
                  setChatLines(current => {
                    const lastIdx = current.length - 1;
                    if (lastIdx < 0) return current;
                    const last = current[lastIdx];
                    if (!last.researchProgress) return current;
                    const updated = [...current];
                    const steps = last.researchProgress.steps.map(s => {
                      if (s.id === `hop${eventData.hop}`) return { ...s, status: 'running' as const };
                      if (eventData.hop === 2 && s.id === 'hop1') return { ...s, status: 'done' as const };
                      if (eventData.hop >= 1 && (s.id === 'axes' || s.id === 'queries')) return { ...s, status: 'done' as const };
                      return s;
                    });
                    updated[lastIdx] = {
                      ...last,
                      researchProgress: { ...last.researchProgress, steps }
                    };
                    return updated;
                  });
                } else if (eventType === 'done' && eventData.session) {
                  setThinkingStep(null);
                  const session: ResearchSession = eventData.session;
                  setChatLines(current => {
                    const lastIdx = current.length - 1;
                    if (lastIdx < 0) return current;
                    const last = current[lastIdx];
                    if (!last.researchProgress) return current;
                    const updated = [...current];
                    const completedSteps = last.researchProgress.steps.map(s => ({ ...s, status: 'done' as const }));
                    const nodesCount = session.changes.filter(c => c.kind === 'node').length;
                    const relsCount = session.changes.filter(c => c.kind === 'relationship').length;
                    const finalText = `### Research Proposals Ready\n` +
                      `Completed ${last.researchProgress.mode === 'deep' ? 'deep multi-hop' : 'quick'} research for **"${query}"**.\n\n` +
                      `Staged **${nodesCount} nodes** and **${relsCount} relationships** for human review across ${last.researchProgress.sources.length} grounded sources.\n\n` +
                      `> ${session.summary || 'Summary synthesized from web citations and knowledge graph context.'}`;

                    updated[lastIdx] = {
                      ...last,
                      text: finalText,
                      isStreaming: false,
                      researchProgress: {
                        ...last.researchProgress,
                        steps: completedSteps,
                        session,
                        isComplete: true
                      }
                    };
                    return updated;
                  });
                  if (typeof eventData.creditsRemaining === 'number') {
                    setUserAuth(prev => prev ? { ...prev, contextCredits: eventData.creditsRemaining } : { contextCredits: eventData.creditsRemaining });
                  }
                  await reloadHistory();
                  setCanvasFitKey(value => value + 1);
                  announce('Drafts are on your map. Keep what is right.');
                } else if (eventType === 'error') {
                  throw new Error(eventData.error || 'Research failed.');
                }
              } catch (pErr) {
                if (pErr instanceof Error && pErr.message === 'Research failed.') throw pErr;
              }
            }
          }
        }
      }
    } catch (err) {
      setThinkingStep(null);
      setChatLines(current => {
        const lastIdx = current.length - 1;
        if (lastIdx < 0) return current;
        const last = current[lastIdx];
        if (!last.researchProgress) return current;
        const updated = [...current];
        updated[lastIdx] = {
          ...last,
          text: `### Research Error\n${err instanceof Error ? err.message : 'Research run could not complete.'}`,
          isStreaming: false,
          researchProgress: {
            ...last.researchProgress,
            isComplete: true
          }
        };
        return updated;
      });
      const stopped = err instanceof DOMException && err.name === 'AbortError';
      announce(stopped ? 'Stopped. Nothing was added to your map.' : err instanceof Error ? err.message : 'Research run failed.');
    } finally {
      researchAbort.current = null;
      setThinkingStep(null);
      setChatBusy(false);
      setResearching(false);
    }
  }, [projectId, aiStatus, reloadHistory, announce]);

  async function sendQuestion(event: FormEvent) {
    event.preventDefault();
    const question = chatInput.trim();
    if (!question || chatBusy) return;

    if (activeResearchIntent) {
      const mode = activeResearchIntent.mode;
      setActiveResearchIntent(null);
      setChatInput('');
      setChatLines(current => [...current, { role: 'user', text: question }]);
      await executeStreamingResearch(question, mode);
      return;
    }

    setChatInput('');
    setChatLines(current => [...current, { role: 'user', text: question }]);
    setChatBusy(true);
    setThinkingStep('Retrieving knowledge graph context & semantic paths...');

    // Append an initial streaming assistant message
    setChatLines(current => [
      ...current,
      {
        role: 'assistant',
        text: '',
        model: aiStatus?.activeModel || 'gpt-6-luna',
        isStreaming: true
      }
    ]);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify({ projectId, question, selectedNodeId: selectedNode?.id, stream: true })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 402) {
          setThinkingStep(null);
          setChatLines(current => {
            const lastIdx = current.length - 1;
            if (lastIdx < 0) return current;
            const updated = [...current];
            updated[lastIdx] = {
              role: 'assistant',
              text: `**Not enough credits**\n\n${errorData.message || 'Asking a question takes 1 credit.'}`,
              isStreaming: false
            };
            return updated;
          });
          setModal('credits');
          return;
        }
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/event-stream') || !response.body) {
        const data = await response.json();
        setThinkingStep(null);
        if (typeof data.creditsRemaining === 'number') {
          setUserAuth(prev => prev ? { ...prev, contextCredits: data.creditsRemaining } : { contextCredits: data.creditsRemaining });
        }
        setChatLines(current => {
          const lastIdx = current.length - 1;
          if (lastIdx < 0) return current;
          const updated = [...current];
          updated[lastIdx] = {
            role: 'assistant',
            text: data.answer || '',
            referencedNodeIds: data.referencedNodeIds,
            provider: data.provider,
            model: data.model,
            usedFallback: data.usedFallback,
            toolCall: data.toolCall,
            isStreaming: false
          };
          return updated;
        });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.startsWith('event:')) {
            const eventType = line.slice(6).trim();
            const nextLine = lines[i + 1]?.trim() || '';
            if (nextLine.startsWith('data:')) {
              i++;
              try {
                const eventData = JSON.parse(nextLine.slice(5).trim());
                if (eventType === 'thinking' || eventType === 'status') {
                  setThinkingStep(eventData.step || eventData.status || null);
                } else if (eventType === 'delta' && eventData.text) {
                  setThinkingStep(null);
                  setChatLines(current => {
                    const lastIdx = current.length - 1;
                    if (lastIdx < 0) return current;
                    const last = current[lastIdx];
                    if (last.role !== 'assistant') return current;
                    const updated = [...current];
                    updated[lastIdx] = {
                      ...last,
                      text: last.text + eventData.text,
                      isStreaming: true
                    };
                    return updated;
                  });
                } else if (eventType === 'tool' && eventData.toolCall) {
                  setChatLines(current => {
                    const lastIdx = current.length - 1;
                    if (lastIdx < 0) return current;
                    const updated = [...current];
                    updated[lastIdx] = {
                      ...updated[lastIdx],
                      toolCall: eventData.toolCall
                    };
                    return updated;
                  });
                } else if (eventType === 'done') {
                  setThinkingStep(null);
                  setChatLines(current => {
                    const lastIdx = current.length - 1;
                    if (lastIdx < 0) return current;
                    const updated = [...current];
                    updated[lastIdx] = {
                      ...updated[lastIdx],
                      text: eventData.text || updated[lastIdx].text,
                      referencedNodeIds: eventData.referencedNodeIds,
                      model: eventData.model,
                      provider: eventData.provider,
                      usedFallback: eventData.usedFallback,
                      toolCall: eventData.toolCall || updated[lastIdx].toolCall,
                      isStreaming: false
                    };
                    return updated;
                  });

                  if (eventData.usedFallback) {
                    announce('OpenAI was unavailable; response provided via Gemini fallback.');
                    fetch('/api/ai/status', { cache: 'no-store' }).then(r => r.json()).then(setAiStatus).catch(() => { });
                  }
                } else if (eventType === 'credits' && typeof eventData.creditsRemaining === 'number') {
                  setUserAuth(prev => prev ? { ...prev, contextCredits: eventData.creditsRemaining } : { contextCredits: eventData.creditsRemaining });
                } else if (eventType === 'error') {
                  throw new Error(eventData.error || 'Chat stream failed.');
                }
              } catch (parseErr) {
                if (parseErr instanceof Error && parseErr.message === 'Chat stream failed.') {
                  throw parseErr;
                }
              }
            }
          }
        }
      }
    } catch (error) {
      setThinkingStep(null);
      setChatLines(current => {
        const lastIdx = current.length - 1;
        if (lastIdx >= 0 && current[lastIdx].role === 'assistant' && !current[lastIdx].text) {
          const updated = [...current];
          updated[lastIdx] = {
            role: 'assistant',
            text: error instanceof Error ? error.message : 'The assistant could not answer.',
            isStreaming: false
          };
          return updated;
        }
        return [...current, { role: 'assistant', text: error instanceof Error ? error.message : 'The assistant could not answer.' }];
      });
    } finally {
      setThinkingStep(null);
      setChatBusy(false);
    }
  }

  const handleExecuteResearch = useCallback(async (query: string, mode: 'quick' | 'deep') => {
    setChatLines(current => [...current, { role: 'user', text: query }]);
    await executeStreamingResearch(query, mode);
  }, [executeStreamingResearch]);

  const buildMap = useCallback((query: string) => {
    const trimmed = query.trim().slice(0, 500);
    if (!trimmed || researching) return;
    if (!aiConfigured) { announce('AI is not set up on this server yet. Add OPENAI_API_KEY or GEMINI_API_KEY to build maps.'); return; }
    setComposerText('');
    setSection('canvas');
    void handleExecuteResearch(trimmed, composerMode);
  }, [researching, aiConfigured, announce, handleExecuteResearch, composerMode]);

  const handleApplyLayout = useCallback((positions: Array<{ id: string; x: number; y: number }>) => {
    updateGraph(current => {
      let next = current;
      for (const pos of positions) {
        if (next.nodesById[pos.id]) {
          next = updateNode(next, pos.id, { x: pos.x, y: pos.y });
        }
      }
      return next;
    });
    setCanvasFitKey(v => v + 1);
    announce(`Reorganized ${positions.length} cards across the canvas.`);
  }, [updateGraph, announce]);

  const handleAddProposedItems = useCallback((
    proposedNodes: Array<{ title: string; type: string; content?: string }>,
    proposedEdges: Array<{ fromTitle: string; toTitle: string; label: string }>
  ) => {
    updateGraph(current => {
      let next = current;
      const titleToId = new Map<string, string>();
      for (const node of Object.values(current.nodesById)) {
        titleToId.set(node.title.toLowerCase().trim(), node.id);
      }

      const maxX = Math.max(100, ...Object.values(current.nodesById).map(n => n.x + (n.width || 280)));
      const minY = Math.min(120, ...Object.values(current.nodesById).map(n => n.y));

      for (let i = 0; i < proposedNodes.length; i++) {
        const item = proposedNodes[i];
        const id = `node-${newId()}`;
        titleToId.set(item.title.toLowerCase().trim(), id);
        const newNode: CanvasNode = {
          id,
          title: item.title,
          type: (item.type as CanvasNodeType) || 'concept',
          content: item.content || '',
          x: maxX + 100 + (i % 2) * 320,
          y: minY + Math.floor(i / 2) * 220,
          width: 280,
          createdAt: Date.now()
        };
        next = addNode(next, newNode);
      }

      for (const edge of proposedEdges) {
        const fromId = titleToId.get(edge.fromTitle.toLowerCase().trim());
        const toId = titleToId.get(edge.toTitle.toLowerCase().trim());
        if (fromId && toId && fromId !== toId) {
          const newEdge: Connection = {
            id: `edge-${newId()}`,
            from: fromId,
            to: toId,
            label: edge.label || 'related_to',
            lineStyle: 'curved',
            arrowhead: 'end',
            strokePattern: strokeForLabel(edge.label),
            color: 'neutral',
            animated: false
          };
          next = addRelationship(next, newEdge);
        }
      }

      return next;
    });
    announce(`Added ${proposedNodes.length} cards and ${proposedEdges.length} connections to graph.`);
  }, [updateGraph, announce]);

  const handleConnectSuggestedNodes = useCallback((fromId: string, toId: string, label?: string) => {
    connectNodes(fromId, toId, label);
  }, [connectNodes]);

  const executeToolDirectly = useCallback(async (toolType: 'deep_research' | 'quick_research' | 'recommend_improvements') => {
    if (toolType === 'recommend_improvements') {
      setThinkingStep('Checking your map…');
      setChatBusy(true);

      setTimeout(() => {
        const audit = auditGraphTopology(graphRef.current);
        setThinkingStep(null);
        setChatBusy(false);

        const totalNodes = Object.keys(graphRef.current.nodesById).length;
        const totalEdges = Object.keys(graphRef.current.edgesById).length;

        const text = `### Map check\n` +
          `Looked at **${totalNodes}** ideas and **${totalEdges}** relations on this map.\n\n` +
          `- **${audit.unverifiedClaims.length}** claims without a source yet.\n` +
          `- **${audit.isolatedNodes.length}** ideas not linked to anything.\n` +
          `- **${audit.openQuestions.length}** open questions.\n` +
          `- **${audit.suggestedConnections.length}** possible links worth a look.`;

        setChatLines(current => [
          ...current,
          {
            role: 'assistant',
            text,
            model: 'Graph Topology Auditor',
            toolCall: {
              tool: 'recommend_improvements',
              parameters: {},
              analysis: audit
            }
          }
        ]);
        announce('Map check done. Suggestions are in Ask AI.');
      }, 350);
      return;
    }

    if (toolType === 'deep_research' || toolType === 'quick_research') {
      const mode = toolType === 'deep_research' ? 'deep' : 'quick';
      setActiveResearchIntent({ mode });
      setTimeout(() => {
        chatInputRef.current?.focus();
      }, 50);
      announce(`Entered ${mode === 'deep' ? 'Deep' : 'Quick'} Research mode. Type your question in the chat input to begin.`);
      return;
    }
  }, [announce]);

  async function saveReview(session: ResearchSession, decisions: Array<{ changeId: string; status: 'accepted' | 'rejected' }>) {
    try {
      const data = await readJson<{ session: ResearchSession }>(await fetch(`/api/research/${encodeURIComponent(session.id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, decisions })
      }));
      // Only refresh the review dialog if it is open; "Keep all" from the draft bar must not pop it open.
      setActiveSession(current => current ? data.session : null); setReviewDecisions({});
      // Kept drafts turn ink with a 1px press (.is-kept in typeset.css); the class lives 400ms past the reload.
      const acceptedIds = new Set(decisions.filter(decision => decision.status === 'accepted').map(decision => decision.changeId));
      const keptNodeIds = session.changes.filter(change => change.kind === 'node' && acceptedIds.has(change.id)).map(change => (change.payload as CanvasNode).id);
      setKeptIds(keptNodeIds);
      await Promise.all([reloadHistory(), reloadGraph()]);
      if (keptNodeIds.length) setTimeout(() => setKeptIds([]), 400);
      fetch('/api/revisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          action: 'create',
          title: `Research review applied (${decisions.filter(d => d.status === 'accepted').length} accepted)`
        })
      }).catch(() => { });
      const kept = decisions.filter(decision => decision.status === 'accepted').length;
      announce(kept ? `Kept ${plural(kept, 'change')}. They are now part of your map.` : 'Drafts discarded.');
    } catch (error) { announce(error instanceof Error ? error.message : 'Could not save this review.'); }
  }

  function decideDrafts(status: 'accepted' | 'rejected') {
    if (!draftSession) return;
    void saveReview(draftSession, draftSession.changes.filter(change => change.status === 'pending').map(change => ({ changeId: change.id, status })));
  }

  function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const imported = normalizeGraph(parsed.nodes, parsed.relationships || parsed.connections || []);
        fetch('/api/backup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            label: `Pre-import snapshot: ${file.name.replace(/\.[^/.]+$/, '')}`
          })
        }).catch(() => { });
        updateGraph(() => imported);
        fetch('/api/revisions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            action: 'create',
            title: `Imported graph: ${file.name.replace(/\.[^/.]+$/, '')}`,
            nodes: Object.values(imported.nodesById),
            relationships: Object.values(imported.edgesById)
          })
        }).catch(() => { });
        setCanvasFitKey(value => value + 1);
        setSelectedIds([]); setSection('canvas'); setExportMenu(false);
        announce('Graph imported. Saving changes…');
      } catch { announce('That file is not a valid Synthex graph export.'); }
      event.target.value = '';
    };
    reader.readAsText(file);
  }

  function handleBibImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const text = String(reader.result || '');
        const entries = parseBibTeX(text);
        if (entries.length === 0) {
          announce('No valid BibTeX entries found in file.');
          return;
        }

        const safeZoom = Math.max(0.1, viewport.zoom);
        const startX = Math.round(-viewport.pan.x / safeZoom + 80);
        const startY = Math.round(-viewport.pan.y / safeZoom + 80);

        const newNodes = bibEntriesToCanvasNodes(entries, startX, startY);

        updateGraph(current => {
          let updated = current;
          for (const node of newNodes) {
            updated = addNode(updated, node);
          }
          return updated;
        });

        setSelectedIds(newNodes.map(n => n.id));
        setSection('canvas');
        setExportMenu(false);
        announce(`Imported ${entries.length} academic ${entries.length === 1 ? 'source' : 'sources'} from BibTeX.`);
      } catch (err) {
        console.error('Failed to import BibTeX:', err);
        announce('Failed to parse that BibTeX file.');
      }
      event.target.value = '';
    };
    reader.readAsText(file);
  }

  function exportAs(format: 'json' | 'markdown' | 'mermaid') {
    const safeTitle = (project?.title || 'knowledge-graph').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'knowledge-graph';
    const content = format === 'json' ? exportGraphJson(graph) : format === 'markdown' ? exportContextMarkdown(graph, project?.title || 'Knowledge graph') : exportMermaid(graph);
    const extension = format === 'markdown' ? 'md' : format === 'mermaid' ? 'mmd' : 'json';
    const mime = format === 'json' ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8';
    downloadText(`${safeTitle}.${extension}`, content, mime);
    setExportMenu(false); announce(`${format === 'markdown' ? 'Context Markdown' : format === 'mermaid' ? 'Mermaid graph' : 'Graph JSON'} exported.`);
  }

  async function exportObsidianVault() {
    try {
      announce('Generating Obsidian / Logseq vault archive…');
      const safeTitle = (project?.title || 'knowledge-graph').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'knowledge-graph';
      const response = await fetch('/api/export/vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ graph, title: project?.title || 'Research Workspace' })
      });
      if (!response.ok) throw new Error('Failed to generate vault archive');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeTitle}-obsidian-vault.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportMenu(false);
      announce('Obsidian / Logseq Vault (.zip) exported successfully.');
    } catch (err) {
      console.error('Failed to export vault:', err);
      announce('Could not export vault. Please try again.');
    }
  }

  function exportSvgCanvas() {
    const safeTitle = (project?.title || 'knowledge-graph').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'knowledge-graph';
    const svg = generateStandaloneSvg(graph, project?.title || 'Synthex Knowledge Graph');
    downloadText(`${safeTitle}-canvas.svg`, svg, 'image/svg+xml;charset=utf-8');
    setExportMenu(false);
    announce('Vector SVG canvas exported.');
  }

  async function exportPngCanvas() {
    try {
      announce('Rendering high-resolution PNG image…');
      const safeTitle = (project?.title || 'knowledge-graph').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'knowledge-graph';
      const blob = await exportGraphToPng(graph, project?.title || 'Synthex Knowledge Graph', 2);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeTitle}-canvas.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportMenu(false);
      announce('High-resolution PNG canvas exported.');
    } catch (err) {
      console.error('PNG export failed:', err);
      announce('Could not render PNG. Try exporting as SVG instead.');
    }
  }

  function openSession(session: ResearchSession) { setActiveSession(session); setReviewDecisions({}); }
  function closeSession() { setActiveSession(null); setReviewDecisions({}); }

  const liveProgress = researching ? chatLines[chatLines.length - 1]?.researchProgress : undefined;
  const composerStatus = (
    <div className="composer-status" role="status">
      <div>
        <strong>{thinkingStep || 'Reading your question…'}</strong>
        <small>{plural(liveProgress?.sources.length ?? 0, 'source')} found · {composerMode === 'deep' ? 'Deep research' : 'Quick map'} · nothing joins your map until you keep it</small>
      </div>
      <button type="button" className="line-button" onClick={() => researchAbort.current?.abort()}><Square size={12} fill="currentColor" /> Stop</button>
    </div>
  );

  return (
    <div className={`workspace-shell ${section === 'canvas' ? 'full-canvas-shell' : ''}`}>
      {section === 'canvas' && (
        <CanvasToolDock
          activeTool={tool}
          onSelectTool={value => { setTool(value); setLinkingFromId(null); }}
          onFit={() => setCanvasFitKey(value => value + 1)}
          onAddRecord={addRecord}
          sketchStyle={sketchStyle}
          onSketchStyleChange={saveSketchStyle}
          onOrganizeLayout={strategy => {
            const positions = computeOrganizedLayout(graphRef.current, strategy);
            handleApplyLayout(positions);
            const strategyName = strategy === 'cluster_by_type' ? 'Grouped by type' : strategy === 'hierarchical' ? 'Top-down layout' : 'Compact grid';
            announce(`${strategyName}: moved ${plural(positions.length, 'note')}. Undo with Ctrl+Z.`);
          }}
        />
      )}

      <main className={`workspace-main ${section === 'canvas' ? 'canvas-main' : ''}`} id="workspace">
        <header className="workspace-topbar">
          {/* Left: Home Button + Project Selector + Navigation Menu Dropdown */}
          <div className="topbar-left">
            <button
              className={`topbar-home-button ${section === 'canvas' ? 'is-active' : ''}`}
              title="Back to the map"
              aria-label="Synthex, back to the map"
              onClick={() => navigateTo('canvas')}
            >
              <SynthexLogo size={18} />
            </button>

            <span className="topbar-slash" aria-hidden="true">/</span>

            {/* Project Switcher Menu */}
            <div className="menu-anchor topbar-project-anchor" ref={projectMenuRef}>
              <button
                className="topbar-project-trigger"
                aria-label={`Map: ${project?.title || 'Untitled map'}. Switch or create a map`}
                aria-expanded={projectMenuOpen}
                onClick={() => { setProjectMenuOpen(v => !v); setNavMenuOpen(false); setExportMenu(false); }}
              >
                <span className="project-title">{project?.title || 'Untitled map'}</span>
                <ChevronDown size={16} strokeWidth={1.75} className="project-arrow" />
              </button>
              {projectMenuOpen && (
                <div className="menu-popover topbar-project-menu map-menu">
                  <div className="map-menu-list" role="menu" aria-label="Your maps">
                    {projects.map(p => (
                      <button
                        key={p.id}
                        role="menuitemradio"
                        aria-checked={p.id === projectId}
                        className={p.id === projectId ? 'is-active' : ''}
                        onClick={() => {
                          setProjectId(p.id);
                          if (typeof window !== 'undefined') {
                            localStorage.setItem('synthex_active_project_id', p.id);
                          }
                          setProjectMenuOpen(false);
                        }}
                      >
                        <strong>{p.title}</strong>
                        {p.id === projectId && <Check size={16} strokeWidth={1.75} />}
                      </button>
                    ))}
                  </div>
                  <form className="map-menu-new" onSubmit={createProject}>
                    <p className="map-menu-title">New map</p>
                    <label className="field-label" htmlFor="project-name">Name</label>
                    <input className="field-input" id="project-name" value={projectTitleDraft} onChange={event => setProjectTitleDraft(event.target.value)} maxLength={80} minLength={2} placeholder="e.g. Small language models" required />
                    <div className="layout-switch map-menu-starter" role="group" aria-label="Start with">
                      <button type="button" aria-pressed={projectTemplate === 'blank'} onClick={() => setProjectTemplate('blank')}>Empty map</button>
                      <button type="button" aria-pressed={projectTemplate === 'rag'} onClick={() => setProjectTemplate('rag')}>Guided example</button>
                    </div>
                    <button type="submit" className="ink-button" disabled={creatingProject || projectTitleDraft.trim().length < 2}>{creatingProject ? 'Creating…' : 'Create map'}</button>
                  </form>
                </div>
              )}
            </div>

            <span className={`topbar-save ${saveState}`} role="status">{saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Not saved' : 'Saved'}</span>
          </div>

          <div className="topbar-center">
            <div className="layout-switch" role="group" aria-label="View">
              {LAYOUTS.map(([value, label]) => (
                <button key={value} type="button" aria-pressed={section === 'canvas' && layout === value} onClick={() => { chooseLayout(value); navigateTo('canvas'); }}>{label}</button>
              ))}
            </div>
            <div className="menu-anchor" ref={navMenuRef}>
              <button type="button" className={`more-views ${section !== 'canvas' ? 'is-active' : ''}`} aria-expanded={navMenuOpen} onClick={() => { setNavMenuOpen(v => !v); setProjectMenuOpen(false); setExportMenu(false); }}>
                <span>{MORE_VIEWS.find(([key]) => key === section)?.[1] || 'More views'}</span>
                <ChevronDown size={14} />
              </button>
              {navMenuOpen && (
                <div className="menu-popover views-menu" role="menu" aria-label="More views">
                  {MORE_VIEWS.map(([key, label, hint]) => (
                    <button key={key} type="button" role="menuitem" className={section === key ? 'is-active' : ''} onClick={() => { navigateTo(key); setNavMenuOpen(false); }}>
                      <strong>{label}</strong>
                      <small>{hint}</small>
                    </button>
                  ))}
                  <div className="menu-separator" />
                  {sketch.length > 0 && (
                    <button type="button" role="menuitem" onClick={() => { saveSketch(() => []); setNavMenuOpen(false); announce('Drawings cleared.'); }}>
                      <strong>Clear drawings</strong>
                      <small>Removes pen and marker marks from this map</small>
                    </button>
                  )}
                  <button type="button" role="menuitemcheckbox" aria-checked={isResizeLocked} onClick={() => { toggleResizeLock(); setNavMenuOpen(false); }}>
                    <strong>{isResizeLocked ? 'Unlock note sizes' : 'Lock note sizes'}</strong>
                    <small>{isResizeLocked ? 'Notes can be resized again' : 'Stop notes being resized by accident'}</small>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="topbar-actions">
            {/* Phones: one "…" menu holds search, undo/redo, Ask AI, Share and the other views */}
            <div className="menu-anchor topbar-overflow" ref={overflowMenuRef}>
              <button type="button" className="icon-button" aria-label="More actions" aria-expanded={overflowMenuOpen} onClick={() => { setOverflowMenuOpen(v => !v); setNavMenuOpen(false); setProjectMenuOpen(false); setExportMenu(false); }}><MoreHorizontal size={20} strokeWidth={1.75} /></button>
              {overflowMenuOpen && (
                <div className="menu-popover views-menu overflow-menu" role="menu" aria-label="More actions">
                  <button type="button" role="menuitem" onClick={() => { setOverflowMenuOpen(false); setModal('search'); }}><strong>Search</strong></button>
                  <button type="button" role="menuitem" disabled={!undoReady} onClick={() => { undo(); setOverflowMenuOpen(false); }}><strong>Undo</strong></button>
                  <button type="button" role="menuitem" disabled={!redoReady} onClick={() => { redo(); setOverflowMenuOpen(false); }}><strong>Redo</strong></button>
                  <button type="button" role="menuitem" onClick={() => { setOverflowMenuOpen(false); setDrawerTab('chat'); setRightDrawerOpen(true); }}><strong>Ask AI</strong></button>
                  <button type="button" role="menuitem" onClick={() => { setOverflowMenuOpen(false); setExportMenu(true); }}><strong>Share</strong></button>
                  <button type="button" role="menuitem" onClick={() => { setOverflowMenuOpen(false); setModal('credits'); }}><strong>Credits</strong></button>
                  <div className="menu-separator" />
                  {MORE_VIEWS.map(([key, label]) => (
                    <button key={key} type="button" role="menuitem" className={section === key ? 'is-active' : ''} onClick={() => { navigateTo(key); setOverflowMenuOpen(false); }}><strong>{label}</strong></button>
                  ))}
                </div>
              )}
            </div>
            <button type="button" className="icon-button" aria-label="Search the map" title="Search (Ctrl+K)" onClick={() => setModal('search')}><Search size={18} strokeWidth={1.75} /></button>
            <button type="button" className="icon-button" title="Undo (Ctrl+Z)" aria-label="Undo" disabled={!undoReady} onClick={undo}><Undo2 size={18} strokeWidth={1.75} /></button>
            <button type="button" className="icon-button" title="Redo (Ctrl+Y)" aria-label="Redo" disabled={!redoReady} onClick={redo}><Redo2 size={18} strokeWidth={1.75} /></button>
            <button
              type="button"
              className={`text-button ask-button ${rightDrawerOpen && drawerTab === 'chat' ? 'is-active' : ''}`}
              title="Ask questions about this map"
              onClick={() => { if (rightDrawerOpen && drawerTab === 'chat') setRightDrawerOpen(false); else { setDrawerTab('chat'); setRightDrawerOpen(true); } }}
            >
              Ask AI
            </button>
            <div className="menu-anchor" ref={exportMenuRef}>
              <button type="button" className="ink-button share-button" aria-expanded={exportMenu} onClick={() => { setExportMenu(v => !v); setNavMenuOpen(false); setProjectMenuOpen(false); }}>
                <Share size={17} /><span>Share</span>
              </button>
              {exportMenu && (
                <div className="menu-popover share-panel" role="dialog" aria-label="Share this map">
                  <p className="share-title">Share this map</p>
                  <div className="share-group">
                    <span>Present it</span>
                    <button type="button" onClick={exportPngCanvas}><ImageIcon size={18} /><span><strong>Image</strong><small>High-resolution PNG of the map</small></span></button>
                    <button type="button" onClick={exportSvgCanvas}><Shapes size={18} /><span><strong>Vector image</strong><small>SVG that stays sharp in slides and print</small></span></button>
                  </div>
                  <div className="share-group">
                    <span>Keep writing elsewhere</span>
                    <button type="button" onClick={() => exportAs('markdown')}><FileText size={18} /><span><strong>Markdown brief</strong><small>The document with its sources; also works as AI context</small></span></button>
                    <button type="button" onClick={exportObsidianVault}><FolderArchive size={18} /><span><strong>Obsidian vault</strong><small>One linked note per idea</small></span></button>
                  </div>
                  <div className="share-group">
                    <span>Give it to another tool</span>
                    <button type="button" onClick={() => exportAs('mermaid')}><GitBranch size={18} /><span><strong>Mermaid diagram</strong><small>Diagram code for docs and READMEs</small></span></button>
                    <button type="button" onClick={() => exportAs('json')}><FileJson2 size={18} /><span><strong>JSON</strong><small>The full map, re-importable here</small></span></button>
                  </div>
                  <div className="share-footer">
                    <button type="button" className="text-button" onClick={() => fileRef.current?.click()}><Upload size={15} /> Import a map</button>
                    <button type="button" className="text-button" onClick={() => bibRef.current?.click()}><BookOpenText size={15} /> Import BibTeX</button>
                  </div>
                </div>
              )}
            </div>
            <UserNav contextCredits={userAuth?.contextCredits} subscriptionTier={userAuth?.subscriptionTier} onOpenCreditsModal={() => setModal('credits')} />
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={handleImport} />
          <input ref={bibRef} type="file" accept=".bib,.txt" hidden onChange={handleBibImport} />
        </header>

        <section className={`workspace-stage ${section === 'canvas' ? 'stage-canvas' : 'stage-view'}`}>
          {section === 'canvas' ? <>
            <div className={`canvas-and-inspector layout-${layout}`}>
              <div className="graph-wrap">
                {loading ? <div className="canvas-loading"><LoaderCircle size={21} className="spin" />Opening your map…</div> : Object.keys(displayGraph.nodesById).length === 0 ? <div className="map-start">
                  <div className="map-start-inner">
                    <h1>What are you trying to figure&nbsp;out?</h1>
                    <p className="map-start-lede">Ask a question, dump your thoughts, or paste notes. Synthex pins it onto a map you can reshape, then share anywhere.</p>
                    <form className="composer" onSubmit={event => { event.preventDefault(); buildMap(composerText); }}>
                      {researching ? composerStatus : <>
                        <label htmlFor="map-question" className="sr-only">Your question or notes</label>
                        <textarea
                          id="map-question"
                          ref={element => { composerRef.current = element; }}
                          value={composerText}
                          onChange={event => setComposerText(event.target.value)}
                          onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); buildMap(composerText); } }}
                          maxLength={500}
                          placeholder="How does sleep affect memory? What do we actually know, and what is still debated?"
                          autoFocus
                        />
                        <div className="composer-row">
                          <div><button type="button" className="line-button" onClick={() => addRecord('note')}><Plus size={16} /> Write a note instead</button></div>
                          <div>
                            <label htmlFor="map-depth" className="sr-only">Depth</label>
                            <select id="map-depth" value={composerMode} onChange={event => setComposerMode(event.target.value as 'quick' | 'deep')}>
                              <option value="quick">Quick map</option>
                              <option value="deep">Deep research</option>
                            </select>
                            <button type="submit" className="ink-button" disabled={!composerText.trim()}>Build map <ArrowRight size={18} /></button>
                          </div>
                        </div>
                      </>}
                    </form>
                    {!aiConfigured && <p className="composer-note">AI is not set up on this server yet, so maps can only be built by hand. Add OPENAI_API_KEY or GEMINI_API_KEY to enable it.</p>}
                    <div className="map-starters">
                      {STARTERS.map(starter => (
                        <button key={starter.label} type="button" className="map-starter" onClick={() => { setComposerText(starter.prompt); composerRef.current?.focus(); }}>
                          <strong>{starter.label}</strong>
                          <span>{starter.kind}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div> : <GraphCanvas
                  graph={displayGraph} draftIds={draftIds} detachingIds={detachingIds} keptIds={keptIds} sketch={sketch} sketchStyle={sketchStyle} onSketchChange={saveSketch} selectedNodeIds={selectedIds} viewport={viewport} setViewport={setViewport} activeTool={tool} spacePressed={spacePressed}
                  linkingFromId={linkingFromId} autoFitKey={canvasFitKey} editingNoteId={editingNoteId}
                  onSelectNode={(id, additive) => {
                    setSelectedIds(current => additive ? current.includes(id) ? current.filter(value => value !== id) : [...current, id] : [id]);
                  }}
                  onOpenEditor={setEditorId}
                  placingIds={placingIds}
                  onPlaced={markPlaced}
                  onSelectMultipleNodes={selectMultipleNodes}
                  onDeleteNodes={deleteNodes}
                  onClearSelection={() => setSelectedIds([])} onClickAway={() => setEditingNoteId(null)} onCancelLinking={() => setLinkingFromId(null)} onMoveNodes={moveNodes} onConnect={connectNodes}
                  onStartLinking={setLinkingFromId} onToggleGroup={toggleGroup} onEditNote={setEditingNoteId}
                  onUpdateNote={(id, content) => updateGraph(current => updateNode(current, id, withAutoTitle(current.nodesById[id], { content })), false)}
                  onUpdateRelationship={editRelationship} onDeleteRelationship={deleteRelationship} onResizeGroup={resizeGroup} onOpenGroup={id => { setEditingNoteId(null); setGroupCanvasId(id); }}
                  onAddRecordWithData={addRecord}
                  projectId={projectId}
                  isResizeLocked={isResizeLocked}
                />}

                {!loading && Object.keys(displayGraph.nodesById).length > 0 && (
                  <div className="relation-legend" aria-label="How relations are drawn">
                    <span><i />supports</span>
                    <span><i className="challenges" />challenges</span>
                    <span><i className="asks" />asks</span>
                  </div>
                )}

                {!loading && draftSession && !researching && (
                  <div className="draft-bar" role="status">
                    <span>
                      {plural(draftNodeCount - draftSourceCount, 'idea')}{draftSourceCount ? ` and ${plural(draftSourceCount, 'source')}` : ''} drafted · nothing joins your map until you keep it
                    </span>
                    <div>
                      <button type="button" className="text-button" onClick={() => decideDrafts('rejected')}>Discard</button>
                      <button type="button" className="line-button" onClick={() => openSession(draftSession)}>Review one by one</button>
                      <button type="button" className="ink-button" onClick={() => decideDrafts('accepted')}>Keep all</button>
                    </div>
                  </div>
                )}

                {!loading && Object.keys(displayGraph.nodesById).length > 0 && (
                  <form className="composer dock-composer" onSubmit={event => { event.preventDefault(); buildMap(selectedNode ? `${composerText.trim()} (about "${selectedNode.title}")` : composerText); }}>
                    {researching ? composerStatus : <>
                      {selectedNode && (
                        <div className="composer-context">
                          <span className="composer-target" title={selectedNode.title}>On “{selectedNode.title}”</span>
                          <button type="button" className="line-button" onClick={() => buildMap(`Expand on "${selectedNode.title}": the key sub-ideas, mechanisms and examples.`)}>Expand</button>
                          <button type="button" className="line-button" onClick={() => buildMap(`Find authoritative sources that support or dispute: "${selectedNode.title}".`)}>Find sources</button>
                          <button type="button" className="line-button" onClick={() => buildMap(`What evidence or arguments challenge "${selectedNode.title}"?`)}>Challenge it</button>
                        </div>
                      )}
                      <div className="composer-input">
                        <label htmlFor="dock-question" className="sr-only">Ask to grow the map</label>
                        <input
                          id="dock-question"
                          type="text"
                          ref={element => { composerRef.current = element; }}
                          value={composerText}
                          onChange={event => setComposerText(event.target.value)}
                          maxLength={400}
                          placeholder={selectedNode ? 'Ask about this idea' : 'Ask a question to grow the map'}
                          title="Press N anywhere on the map to write a note by hand"
                        />
                        <button type="submit" className="ink-button icon-send" aria-label="Grow the map" disabled={!composerText.trim()}><ArrowRight size={18} /></button>
                      </div>
                    </>}
                  </form>
                )}
              </div>

              {layout !== 'map' && !loading && (
                <DocumentPane
                  graph={graph}
                  title={project?.title || 'Untitled map'}
                  selectedIds={selectedIds}
                  draftCount={draftNodeCount}
                  fullWidth={layout === 'doc'}
                  onSelect={id => setSelectedIds([id])}
                  onUpdate={(id, fields) => updateGraph(current => current.nodesById[id] ? updateNode(current, id, withAutoTitle(current.nodesById[id], fields)) : current)}
                />
              )}

              <aside className={`workspace-drawer ${rightDrawerOpen ? 'is-open' : ''}`} aria-label="Details and Ask AI">
                <div className="drawer-header">
                  <div className="drawer-tabs" role="tablist">
                    <button
                      role="tab"
                      aria-selected={drawerTab === 'inspector'}
                      className={`drawer-tab ${drawerTab === 'inspector' ? 'active' : ''}`}
                      onClick={() => setDrawerTab('inspector')}
                    >
                      Properties{selectedIds.length > 0 && ` (${selectedIds.length})`}
                    </button>
                    <button
                      role="tab"
                      aria-selected={drawerTab === 'chat'}
                      className={`drawer-tab ${drawerTab === 'chat' ? 'active' : ''}`}
                      onClick={() => setDrawerTab('chat')}
                    >
                      Ask AI
                    </button>
                  </div>
                  <button className="icon-button close-drawer-btn" aria-label="Close panel" onClick={() => { setRightDrawerOpen(false); setSelectedIds([]); }}>
                    <X size={15} />
                  </button>
                </div>

                <div className="drawer-body">
                  {drawerTab === 'inspector' ? (
                    selectedNode ? (
                      <NodeInspector
                        hideHeader
                        floating={false}
                        node={selectedNode}
                        relationshipCount={edges.filter(edge => edge.from === selectedNode.id || edge.to === selectedNode.id).length}
                        onUpdate={updateSelectedNode}
                        onDelete={() => { deleteSelected(); setRightDrawerOpen(false); }}
                        onClose={() => { setSelectedIds([]); setRightDrawerOpen(false); }}
                        projectId={projectId}
                        allNodes={nodes}
                      />
                    ) : selectedIds.length > 1 ? (
                      <div className="drawer-state">
                        <h3>{plural(selectedIds.length, 'idea')} selected</h3>
                        <p>Drag any of them to move them together.</p>
                        <button
                          className="text-button danger-text"
                          title="Remove from map (Delete / Backspace)"
                          onClick={() => {
                            deleteSelected();
                            setRightDrawerOpen(false);
                          }}
                        >
                          Remove from map
                        </button>
                      </div>
                    ) : (
                      <div className="drawer-state">
                        <p>Nothing selected. Click a note to see its details.</p>
                        <div className="drawer-state-actions">
                          <button className="line-button" onClick={() => addRecord('concept')}><Plus size={16} strokeWidth={1.75} /> Add an idea</button>
                          <button className="line-button" onClick={() => addRecord('claim')}><Plus size={16} strokeWidth={1.75} /> Add a claim</button>
                          <button className="text-button" onClick={() => setDrawerTab('chat')}>Ask AI</button>
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="drawer-chat-pane">
                      <p className="note-meta chat-scope">
                        Answers use only what&apos;s on your map{selectedNode ? ` · On "${selectedNode.title.slice(0, 28)}"` : ''}
                      </p>

                      {!aiConfigured && (
                        <p className="chat-config-note">Add <code>OPENAI_API_KEY</code> or <code>GEMINI_API_KEY</code> to turn on Ask AI.</p>
                      )}

                      <div className="chat-transcript" aria-live="polite">
                        {chatLines.length === 0 && (
                          <div className="chat-welcome">
                            <h3>{selectedNode ? `Ask about "${selectedNode.title}"` : 'Ask about your map'}</h3>
                            <p>
                              {selectedNode
                                ? 'Ask for evidence, counterarguments or related ideas.'
                                : 'Ask anything about what’s on your map. To grow the map, use the composer on the board.'}
                            </p>
                            <button type="button" className="line-button" onClick={() => executeToolDirectly('recommend_improvements')}>
                              Audit my map
                            </button>
                          </div>
                        )}

                        {chatLines.map((line, index) => (
                          line.role === 'user' ? (
                            <p className="chat-line user" key={`${index}-${line.text.slice(0, 10)}`}>{line.text}</p>
                          ) : (
                            <div className="chat-line assistant" key={`${index}-${line.text.slice(0, 10)}`}>
                              <div>
                                <div className="chat-markdown-body">
                                  <MarkdownView content={line.text} />
                                  {line.isStreaming && !line.researchProgress && <span className="streaming-cursor" />}
                                </div>

                                {line.researchProgress && (
                                  <LiveResearchCard
                                    progress={line.researchProgress}
                                    onOpenReview={(session) => {
                                      setActiveSession(session);
                                      setReviewDecisions({});
                                    }}
                                  />
                                )}

                                {!line.isStreaming && !line.researchProgress && line.referencedNodeIds && line.referencedNodeIds.length > 0 && (
                                  <p className="note-meta">Cites {plural(line.referencedNodeIds.length, 'idea')}</p>
                                )}

                                {line.toolCall && (
                                  <ChatToolCard
                                    toolCall={line.toolCall}
                                    onExecuteResearch={handleExecuteResearch}
                                    onApplyLayout={handleApplyLayout}
                                    onAddProposedItems={handleAddProposedItems}
                                    onConnectNodes={handleConnectSuggestedNodes}
                                  />
                                )}
                              </div>
                            </div>
                          )
                        ))}

                        {chatBusy && thinkingStep && (
                          <p className="chat-thinking">{thinkingStep}</p>
                        )}
                      </div>

                      <div className="chat-compose-wrapper">
                        {activeResearchIntent && (
                          <div className="active-research-banner">
                            <span>{activeResearchIntent.mode === 'deep' ? 'Deep research' : 'Quick research'} · type your question</span>
                            <button type="button" className="text-button" onClick={() => setActiveResearchIntent(null)}>Cancel</button>
                          </div>
                        )}

                        <form className="composer chat-compose-box" onSubmit={sendQuestion}>
                          <textarea
                            ref={chatInputRef}
                            rows={3}
                            aria-label="Ask a question about your map"
                            placeholder={
                              activeResearchIntent
                                ? 'What should the research look into?'
                                : selectedNode
                                  ? `Ask about "${selectedNode.title.slice(0, 24)}"…`
                                  : 'Ask about your map'
                            }
                            value={chatInput}
                            onChange={event => setChatInput(event.target.value)}
                            onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }}
                            maxLength={2000}
                            disabled={!aiConfigured || chatBusy}
                          />
                          <div className="chat-compose-actions">
                            <button
                              type="button"
                              onClick={() => setModal('credits')}
                              className="chat-cost"
                              title="Credits this costs. Click to see your balance."
                            >
                              {activeResearchIntent?.mode === 'deep'
                                ? '20 credits'
                                : activeResearchIntent?.mode === 'quick'
                                  ? '5 credits'
                                  : '1 credit'}
                            </button>
                            <button
                              type="submit"
                              className="ink-button icon-send"
                              disabled={!chatInput.trim() || !aiConfigured || chatBusy}
                              aria-label="Send question"
                            >
                              <ArrowRight size={18} strokeWidth={1.75} />
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              </aside>
            </div>
          </> : <div className="views-stage">
            <KnowledgeViews
              section={section}
              nodes={nodes}
              edges={edges}
              sessions={sessions}
              onSelectNode={id => { setSelectedIds([id]); setSection('canvas'); }}
              onOpenSession={openSession}
              projectId={projectId}
              onRestoreRevision={restoreRevision}
              onCreateCheckpoint={createCheckpoint}
              onRestoreDatabase={() => { window.location.reload(); }}
            />
          </div>}
        </section>
      </main>

      {groupCanvasId && graph.nodesById[groupCanvasId] && (() => {
        const group = graph.nodesById[groupCanvasId];
        const members = membersOf(group, nodes);
        const memberIds = new Set(members.map(node => node.id));
        const containedGraph = normalizeGraph(members, edges.filter(edge => memberIds.has(edge.from) && memberIds.has(edge.to)));
        return <div className="group-canvas-scrim" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setGroupCanvasId(null); }}>
          <section className="group-canvas-modal" role="dialog" aria-modal="true" aria-label={`Cluster: ${group.title}`}>
            <header className="group-canvas-header"><div><h2>{group.title}</h2><p className="note-meta">Cluster · {plural(members.length, 'idea')}</p></div><button className="icon-button" aria-label="Close cluster" onClick={() => setGroupCanvasId(null)}><X size={18} strokeWidth={1.75} /></button></header>
            {members.length ? <GraphCanvas graph={containedGraph} selectedNodeIds={selectedIds.filter(id => memberIds.has(id))} viewport={groupViewport} setViewport={setGroupViewport} activeTool={tool} spacePressed={spacePressed} linkingFromId={linkingFromId} autoFitKey={canvasFitKey + 1} editingNoteId={editingNoteId}
              onSelectNode={(id, additive) => setSelectedIds(current => additive ? current.includes(id) ? current.filter(value => value !== id) : [...current, id] : [id])} onClearSelection={() => setSelectedIds([])} onClickAway={() => setEditingNoteId(null)} onCancelLinking={() => setLinkingFromId(null)} onMoveNodes={moveNodes} onConnect={connectNodes} onStartLinking={setLinkingFromId} onToggleGroup={toggleGroup} onEditNote={setEditingNoteId} onUpdateNote={(id, content) => updateGraph(current => updateNode(current, id, withAutoTitle(current.nodesById[id], { content })), false)} onUpdateRelationship={editRelationship} onDeleteRelationship={deleteRelationship} onResizeGroup={resizeGroup} onOpenGroup={id => { setEditingNoteId(null); setGroupCanvasId(id); }} onAddRecordWithData={addRecord} isResizeLocked={isResizeLocked} /> : <div className="subcanvas-empty"><p>This cluster is empty.</p><button className="line-button" onClick={() => { addRecord('note'); setGroupCanvasId(null); }}><Plus size={16} strokeWidth={1.75} /> Add a note</button></div>}
          </section>
        </div>;
      })()}


      {modal === 'search' && <div className="modal-scrim search-scrim" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setModal(null); }}>
        <section className="search-modal" role="dialog" aria-modal="true" aria-label="Search this map">
          <div className="search-input-row"><Search size={20} strokeWidth={1.75} /><input autoFocus aria-label="Search this map" placeholder="Search ideas, notes and sources" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} /><button className="icon-button" aria-label="Close search (Esc)" onClick={() => setModal(null)}><X size={18} strokeWidth={1.75} /></button></div>
          <div className="search-results">{searchQuery.trim() ? searchResults.length ? searchResults.map(node => {
            const cited = node.metadata?.evidence?.length || 0;
            return <button className="search-result" key={node.id} onClick={() => { setSelectedIds([node.id]); setSection('canvas'); setModal(null); setSearchQuery(''); }}>
              <strong>{node.title}</strong>
              <small>{[nodeLabel[node.type] || 'Idea', cited ? plural(cited, 'source') : null, (node.content || node.url || '').slice(0, 80) || null].filter(Boolean).join(' · ')}</small>
            </button>;
          }) : <div className="search-empty">Nothing on this map matches “{searchQuery}”.</div> : <div className="search-empty">Type to search titles, notes and sources.</div>}</div>
          <div className="search-bottom"><span>{plural(nodes.length, 'idea')} on this map</span><span><kbd>Ctrl K</kbd> opens search · <kbd>Esc</kbd> closes it</span></div>
        </section>
      </div>}

      <CreditsModal
        isOpen={modal === 'credits'}
        onClose={() => setModal(null)}
        currentBalance={userAuth?.contextCredits}
        subscriptionTier={userAuth?.subscriptionTier}
        onRefillSuccess={(newBalance) => {
          setUserAuth(prev => prev ? { ...prev, contextCredits: newBalance } : { contextCredits: newBalance });
        }}
      />

      <SubscriptionOnboardingModal
        isOpen={userAuth !== null && userAuth.hasSelectedPlan === false}
        onPlanSelected={({ tier, credits, project }) => {
          setUserAuth(prev => ({
            ...(prev || {}),
            subscriptionTier: tier,
            contextCredits: credits,
            hasSelectedPlan: true
          }));
          if (project) {
            setProjects(prev => {
              if (!prev.some(p => p.id === project.id)) {
                return [project as ResearchProject, ...prev];
              }
              return prev;
            });
            setProjectId(project.id);
            if (typeof window !== 'undefined') {
              localStorage.setItem('synthex_active_project_id', project.id);
            }
          }
        }}
      />

      {activeSession && <div className="modal-scrim" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) closeSession(); }}>
        <section className="work-modal review-modal" role="dialog" aria-modal="true" aria-labelledby="review-title">
          <div className="review-head">
            <div>
              <h2 id="review-title">{activeSession.query}</h2>
              <p className="note-meta">{activeSession.mode === 'deep' ? 'Deep research' : 'Quick research'} · {new Date(activeSession.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {plural(activeSession.changes.length, 'draft')}</p>
            </div>
            <button className="icon-button" aria-label="Close review" onClick={closeSession}><X size={18} strokeWidth={1.75} /></button>
          </div>
          {activeSession.summary && <p className="review-summary">{activeSession.summary}</p>}
          {activeSession.trail.length > 0 && <details className="research-trail"><summary>How it was researched <ChevronDown size={16} strokeWidth={1.75} /></summary><ol>{activeSession.trail.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ol></details>}
          <div className="review-changes">{activeSession.changes.length === 0 ? <p className="empty-review">This run didn&apos;t draft anything.</p> : activeSession.changes.map(change => <ReviewChangeCard key={change.id} change={change} graph={graph} sessionChanges={activeSession.changes} decision={reviewDecisions[change.id]} onDecision={status => setReviewDecisions(current => ({ ...current, [change.id]: status }))} />)}</div>
          <div className="review-footer"><span className="note-meta">{plural(activeSession.changes.filter(change => change.status === 'pending').length, 'draft')} left to decide</span><div><button className="line-button" disabled={!activeSession.changes.some(change => change.status === 'pending')} onClick={() => setReviewDecisions(Object.fromEntries(activeSession.changes.filter(change => change.status === 'pending').map(change => [change.id, 'accepted'] as const)))}>Keep all</button><button className="ink-button" disabled={!Object.keys(reviewDecisions).length} onClick={() => saveReview(activeSession, Object.entries(reviewDecisions).map(([changeId, status]) => ({ changeId, status })))}>Save decisions</button></div></div>
        </section>
      </div>}

      {editorId && graph.nodesById[editorId] && (
        <NoteEditor
          node={graph.nodesById[editorId]}
          relationshipCount={edges.filter(edge => edge.from === editorId || edge.to === editorId).length}
          projectId={projectId}
          allNodes={nodes}
          onUpdate={fields => updateGraph(current => current.nodesById[editorId] ? updateNode(current, editorId, withAutoTitle(current.nodesById[editorId], fields)) : current, false)}
          onDelete={() => { const id = editorId; setEditorId(null); deleteNodes([id]); }}
          onClose={() => setEditorId(null)}
        />
      )}

      {notice && (
        <div role="status" className="toast-note" key={notice}>
          <span>{notice}</span>
          <button className="toast-close" onClick={() => setNotice('')} aria-label="Dismiss">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>
      )}
    </div>
  );
}

function ReviewChangeCard({ change, graph, sessionChanges, decision, onDecision }: {
  change: ResearchChange;
  graph: KnowledgeGraph;
  sessionChanges: ResearchChange[];
  decision?: 'accepted' | 'rejected';
  onDecision: (status: 'accepted' | 'rejected') => void;
}) {
  const isNode = change.kind === 'node';
  const node = isNode ? change.payload as CanvasNode : null;
  const edge = !isNode ? change.payload as Connection : null;
  const proposedNodes = sessionChanges.filter(item => item.kind === 'node').map(item => item.payload as CanvasNode);
  const nodeTitle = (id: string) => graph.nodesById[id]?.title || proposedNodes.find(item => item.id === id)?.title;
  const title = node?.title || `${nodeTitle(edge?.from || '') || 'Idea'} ${(edge?.label || 'relates to').replaceAll('_', ' ')} ${nodeTitle(edge?.to || '') || 'idea'}`;
  const meta = node ? `${nodeLabel[node.type] || 'Idea'}${node.type === 'claim' ? ' · Unverified' : ''}` : 'Relation';
  return <article className={`review-change ${decision ? `decision-${decision}` : ''} ${change.status !== 'pending' ? `is-${change.status}` : ''}`}>
    <div className="change-copy"><strong>{title}</strong>{change.rationale && <p>{change.rationale}</p>}{node?.url && <a href={node.url} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()}>{node.url}</a>}<span className="note-meta">{meta}</span></div>
    {change.status === 'pending'
      ? <div className="review-actions" role="group" aria-label={`Decide on ${title}`}>
          <button type="button" className="ink-button" aria-pressed={decision === 'accepted'} onClick={() => onDecision('accepted')}>{decision === 'accepted' ? <><Check size={16} strokeWidth={1.75} /> Keep</> : 'Keep'}</button>
          <button type="button" className="text-button" aria-pressed={decision === 'rejected'} onClick={() => onDecision('rejected')}>{decision === 'rejected' ? 'Discarded' : 'Discard'}</button>
        </div>
      : <span className="note-meta review-status">{change.status === 'accepted' ? 'Kept' : 'Discarded'}</span>}
  </article>;
}
