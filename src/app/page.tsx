'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ArrowDownToLine, ArrowRight, BookOpenText, Check, ChevronDown, CircleHelp, Clock3,
  Compass, FileClock, FileJson2, Files, FileText, FolderArchive, FolderKanban, GitBranch,
  History, Image as ImageIcon, Layers2, LoaderCircle, MessageCircle, Network, Plus, Redo2,
  Search, Send, Shapes, SlidersHorizontal, Sparkles, Trash2, Undo2, Upload, X
} from 'lucide-react';
import { GraphCanvas, membersOf } from '@/components/research/GraphCanvas';
import { KnowledgeViews } from '@/components/research/KnowledgeViews';
import { NodeInspector } from '@/components/research/NodeInspector';
import { CustomSelect } from '@/components/research/CustomSelect';
import { CanvasToolDock, addableRecords, type ResearchProject, type WorkspaceSection } from '@/components/research/WorkspaceSidebar';
import { extractYouTubeVideoId } from '@/components/research/SourceMetadata';
import { addNode, addRelationship, exportContextMarkdown, exportGraphJson, exportMermaid, normalizeGraph, removeNode, updateNode, updateRelationship, type KnowledgeGraph } from '@/lib/graph';
import { parseBibTeX, bibEntriesToCanvasNodes } from '@/lib/bibtex';
import { generateStandaloneSvg, exportGraphToPng } from '@/lib/canvas-export';
import type { CanvasNode, CanvasNodeType, Connection, Coordinates, GraphRevisionSummary, ResearchChange, ResearchSession } from '@/types/canvas';
import { ELEMENT_PALETTE } from '@/types/canvas';

type Viewport = { zoom: number; pan: Coordinates };
type Tool = 'select' | 'connect' | 'hand';
type ChatLine = { role: 'user' | 'assistant'; text: string; referencedNodeIds?: string[] };
type Modal = 'research' | 'chat' | 'project' | 'search' | null;

const blankGraph = (): KnowledgeGraph => normalizeGraph([], []);
const newId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const errorText = (body: unknown, fallback: string) => typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string' ? body.error : fallback;

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(errorText(body, 'The request could not be completed.'));
  return body as T;
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

export default function SynthexWorkspace() {
  const [projects, setProjects] = useState<ResearchProject[]>([]);
  const [projectId, setProjectId] = useState('default');
  const [graph, setGraph] = useState<KnowledgeGraph>(blankGraph);
  const [sessions, setSessions] = useState<ResearchSession[]>([]);
  const [section, setSection] = useState<WorkspaceSection>('canvas');
  const [loading, setLoading] = useState(true);
  const [loadedProject, setLoadedProject] = useState('');
  const [spacePressed, setSpacePressed] = useState(false);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const [aiConfigured, setAiConfigured] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewport, setViewport] = useState<Viewport>({ zoom: 0.82, pan: { x: 76, y: 52 } });
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
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [addRecordMenuOpen, setAddRecordMenuOpen] = useState(false);
  const navMenuRef = useRef<HTMLDivElement>(null);
  const projectMenuRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const addRecordMenuRef = useRef<HTMLDivElement>(null);
  const [notice, setNotice] = useState('');

  const navigateTo = useCallback((targetSection: WorkspaceSection) => {
    setSection(targetSection);
    setSelectedIds([]);
    setEditingNoteId(null);
    setLinkingFromId(null);
    setTool('select');
  }, []);

  useEffect(() => {
    if (!navMenuOpen && !projectMenuOpen && !exportMenu && !addRecordMenuOpen) return;
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
    };
    window.addEventListener('pointerdown', handlePointerDown, true);
    return () => window.removeEventListener('pointerdown', handlePointerDown, true);
  }, [navMenuOpen, projectMenuOpen, exportMenu, addRecordMenuOpen]);
  const [researchQuery, setResearchQuery] = useState('');
  const [researchMode, setResearchMode] = useState<'quick' | 'deep'>('quick');
  const [researching, setResearching] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [chatLines, setChatLines] = useState<ChatLine[]>([]);
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
    fetch('/api/projects', { cache: 'no-store' }).then(response => readJson<{ projects: ResearchProject[] }>(response)).then(data => {
      if (cancelled) return;
      setProjects(data.projects);
      if (!data.projects.some(project => project.id === 'default')) setProjectId(data.projects[0]?.id || 'default');
    }).catch(error => announce(error instanceof Error ? error.message : 'Could not load projects.'));
    fetch('/api/ai/status', { cache: 'no-store' }).then(response => response.json()).then(data => setAiConfigured(Boolean(data.configured))).catch(() => setAiConfigured(false));
    return () => { cancelled = true; };
  }, [announce]);

  useEffect(() => {
    if (projects.length) void loadProject(projectId);
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
          }).catch(() => {});
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
    updateGraph(current => {
      let next = current;
      for (const id of ids) {
        next = removeNode(next, id);
      }
      return next;
    });
    setSelectedIds(current => current.filter(id => !ids.includes(id)));
    if (editingNoteId && ids.includes(editingNoteId)) setEditingNoteId(null);
    announce(ids.length === 1 ? 'Record deleted.' : `${ids.length} records deleted.`);
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
    if (ids.length > 0) {
      setDrawerTab('inspector');
      setRightDrawerOpen(true);
    }
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
  const pendingCount = sessions.reduce((sum, session) => sum + session.changes.filter(change => change.status === 'pending').length, 0);
  const searchResults = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    return needle ? nodes.filter(node => `${node.title} ${node.content || ''} ${node.description || ''} ${node.url || ''} ${node.type}`.toLowerCase().includes(needle)).slice(0, 30) : [];
  }, [nodes, searchQuery]);

  const addRecord = useCallback((type: CanvasNodeType, initialData?: Partial<CanvasNode>) => {
    const now = Date.now();
    const index = Object.keys(graphRef.current.nodesById).length;
    const labels: Record<string, string> = { concept: 'New concept', claim: 'New claim', question: 'New question', hypothesis: 'New hypothesis', source: 'New source', note: 'New note', group: 'New knowledge cluster', ai_insight: 'New insight', image: 'Media & figure' };
    const node: CanvasNode = {
      id: newId(),
      type,
      x: initialData?.x ?? (260 + (index % 3) * 340),
      y: initialData?.y ?? (170 + Math.floor(index / 3) * 230),
      width: initialData?.width ?? (type === 'group' ? 560 : type === 'image' ? 320 : type === 'question' ? 300 : 280),
      height: type === 'group' ? 360 : undefined,
      title: initialData?.title || labels[type] || 'New knowledge',
      color: initialData?.color || (type === 'question' ? 'terracotta' : 'neutral'),
      createdAt: now,
      metadata: { origin: 'user', ...(type === 'claim' ? { claimStatus: 'unverified' as const } : {}), ...initialData?.metadata },
      ...initialData
    };
    try {
      updateGraph(current => addNode(current, node));
      setSelectedIds([node.id]);
      setSection('canvas');
      setDrawerTab('inspector');
      setRightDrawerOpen(true);
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
        setDrawerTab('inspector');
        setRightDrawerOpen(true);
        return;
      }
      if (event.key === 'Escape') { setModal(null); setActiveSession(null); setLinkingFromId(null); setEditingNoteId(null); setGroupCanvasId(null); setTool('select'); }
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
          setModal('research');
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
  }, [undo, redo, selectedIds, deleteSelected, addRecord, announce]);

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

  const connectNodes = useCallback((from: string, to: string) => {
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
        label: 'related_to',
        color: 'neutral',
        arrowhead: 'end',
        lineStyle: 'curved',
        strokePattern: 'dashed',
        animated: true
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
    updateGraph(current => updateNode(current, selectedNode.id, fields), false);
  };

  const reloadGraph = async () => {
    const data = await readJson<{ nodes: CanvasNode[]; relationships: Connection[] }>(await fetch(`/api/graph?projectId=${encodeURIComponent(projectId)}`, { cache: 'no-store' }));
    setGraph(normalizeGraph(data.nodes, data.relationships));
    setCanvasFitKey(value => value + 1);
  };
  const reloadHistory = async () => {
    const data = await readJson<{ sessions: ResearchSession[] }>(await fetch(`/api/research?projectId=${encodeURIComponent(projectId)}`, { cache: 'no-store' }));
    setSessions(data.sessions);
  };

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
      setProjectTitleDraft(''); setModal(null); setProjectId(data.project.id);
      announce('Workspace created.');
    } catch (error) { announce(error instanceof Error ? error.message : 'Could not create workspace.'); }
    finally { setCreatingProject(false); }
  }

  async function runResearch(event: FormEvent) {
    event.preventDefault();
    if (!researchQuery.trim() || researching) return;
    setResearching(true);
    try {
      const data = await readJson<{ session: ResearchSession }>(await fetch('/api/research', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, query: researchQuery.trim(), mode: researchMode })
      }));
      setResearchQuery(''); setActiveSession(data.session); setReviewDecisions({}); setModal(null);
      await reloadHistory();
      announce('Research proposals are ready for review.');
    } catch (error) { announce(error instanceof Error ? error.message : 'Research could not complete.'); }
    finally { setResearching(false); }
  }

  async function sendQuestion(event: FormEvent) {
    event.preventDefault();
    const question = chatInput.trim();
    if (!question || chatBusy) return;
    setChatInput(''); setChatLines(current => [...current, { role: 'user', text: question }]); setChatBusy(true);
    try {
      const data = await readJson<{ answer: string; referencedNodeIds: string[] }>(await fetch('/api/ai/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, question, selectedNodeId: selectedNode?.id })
      }));
      setChatLines(current => [...current, { role: 'assistant', text: data.answer, referencedNodeIds: data.referencedNodeIds }]);
    } catch (error) {
      setChatLines(current => [...current, { role: 'assistant', text: error instanceof Error ? error.message : 'The assistant could not answer.' }]);
    } finally { setChatBusy(false); }
  }

  async function saveReview(session: ResearchSession, decisions: Array<{ changeId: string; status: 'accepted' | 'rejected' }>) {
    try {
      const data = await readJson<{ session: ResearchSession }>(await fetch(`/api/research/${encodeURIComponent(session.id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, decisions })
      }));
      setActiveSession(data.session); setReviewDecisions({});
      await Promise.all([reloadHistory(), reloadGraph()]);
      fetch('/api/revisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          action: 'create',
          title: `Research review applied (${decisions.filter(d => d.status === 'accepted').length} accepted)`
        })
      }).catch(() => {});
      announce('Review saved. Accepted changes are now in the graph.');
    } catch (error) { announce(error instanceof Error ? error.message : 'Could not save this review.'); }
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
        }).catch(() => {});
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
        }).catch(() => {});
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

  return (
    <div className={`workspace-shell ${section === 'canvas' ? 'full-canvas-shell' : ''}`}>
      {section === 'canvas' && (
        <CanvasToolDock
          activeTool={tool}
          onSelectTool={value => { setTool(value); setLinkingFromId(null); }}
          onFit={() => setCanvasFitKey(value => value + 1)}
          onAddRecord={addRecord}
        />
      )}

      <main className={`workspace-main ${section === 'canvas' ? 'canvas-main' : ''}`} id="workspace">
        <header className="workspace-topbar">
          {/* Left: Home Button + Project Selector + Navigation Menu Dropdown */}
          <div className="topbar-left">
            <button
              className={`topbar-home-button ${section === 'canvas' ? 'is-active' : ''}`}
              title="Home (Knowledge Canvas)"
              aria-label="Home (Knowledge Canvas)"
              onClick={() => navigateTo('canvas')}
            >
              <span className="home-brand-icon">
                <Sparkles size={13} />
              </span>
              <span className="home-brand-text">Home</span>
            </button>

            <span className="topbar-slash" aria-hidden="true">/</span>

            {/* Project Switcher Menu */}
            <div className="menu-anchor topbar-project-anchor" ref={projectMenuRef}>
              <button
                className="topbar-project-trigger"
                aria-label="Switch project"
                aria-expanded={projectMenuOpen}
                onClick={() => { setProjectMenuOpen(v => !v); setNavMenuOpen(false); setExportMenu(false); }}
              >
                <FolderKanban size={13} className="project-icon" />
                <span className="project-title">{project?.title || 'Research space'}</span>
                <ChevronDown size={11} className="project-arrow" />
              </button>
              {projectMenuOpen && (
                <div className="menu-popover topbar-project-menu" role="menu">
                  <div className="popover-heading">Research Projects</div>
                  {projects.map(p => (
                    <button
                      key={p.id}
                      className={`project-menu-item ${p.id === projectId ? 'is-active' : ''}`}
                      onClick={() => { setProjectId(p.id); setProjectMenuOpen(false); }}
                    >
                      <FolderKanban size={14} />
                      <div className="project-item-text">
                        <strong>{p.title}</strong>
                      </div>
                      {p.id === projectId && <Check size={14} className="project-check" />}
                    </button>
                  ))}
                  <div className="menu-separator" />
                  <button
                    className="project-menu-item new-project-item"
                    onClick={() => { setModal('project'); setProjectMenuOpen(false); }}
                  >
                    <Plus size={14} />
                    <span>Create new project</span>
                  </button>
                </div>
              )}
            </div>

            <span className="topbar-slash" aria-hidden="true">/</span>

            {/* View Navigation Menu Dropdown */}
            <div className="menu-anchor topbar-nav-anchor" ref={navMenuRef}>
              <button
                className={`topbar-nav-trigger ${navMenuOpen ? 'is-open' : ''}`}
                aria-label="Open navigation menu"
                aria-expanded={navMenuOpen}
                onClick={() => { setNavMenuOpen(v => !v); setProjectMenuOpen(false); setExportMenu(false); }}
              >
                <Compass size={13} className="nav-compass-icon" />
                <span className="nav-trigger-label">
                  {section === 'canvas' ? 'Knowledge graph' : section === 'outline' ? 'Outline' : section === 'evidence' ? 'Evidence paths' : section === 'table' ? 'Claims & questions' : section === 'sources' ? 'Sources' : section === 'questions' ? 'Open questions' : 'Research history'}
                </span>
                <ChevronDown size={11} className="nav-arrow" />
                {pendingCount > 0 && <span className="nav-badge">{pendingCount}</span>}
              </button>

              {navMenuOpen && (
                <div className="menu-popover topbar-navigation-menu" role="menu" aria-label="Views and navigation">
                  <div className="nav-menu-group">
                    <span className="nav-menu-heading">Research Spaces</span>
                    <button className={`nav-menu-item ${section === 'canvas' ? 'is-active' : ''}`} onClick={() => { navigateTo('canvas'); setNavMenuOpen(false); }}>
                      <Network size={15} />
                      <div className="nav-item-content">
                        <strong>Knowledge Graph</strong>
                        <small>Interactive visual research canvas</small>
                      </div>
                      {section === 'canvas' && <Check size={13} className="active-tick" />}
                    </button>
                    <button className={`nav-menu-item ${section === 'outline' ? 'is-active' : ''}`} onClick={() => { navigateTo('outline'); setNavMenuOpen(false); }}>
                      <BookOpenText size={15} />
                      <div className="nav-item-content">
                        <strong>Outline</strong>
                        <small>Structured conceptual document</small>
                      </div>
                      {section === 'outline' && <Check size={13} className="active-tick" />}
                    </button>
                    <button className={`nav-menu-item ${section === 'evidence' ? 'is-active' : ''}`} onClick={() => { navigateTo('evidence'); setNavMenuOpen(false); }}>
                      <Shapes size={15} />
                      <div className="nav-item-content">
                        <strong>Evidence Paths</strong>
                        <small>Traceability from sources to claims</small>
                      </div>
                      {section === 'evidence' && <Check size={13} className="active-tick" />}
                    </button>
                    <button className={`nav-menu-item ${section === 'table' ? 'is-active' : ''}`} onClick={() => { navigateTo('table'); setNavMenuOpen(false); }}>
                      <Files size={15} />
                      <div className="nav-item-content">
                        <strong>Claims & Questions</strong>
                        <small>Tabular inventory & audit table</small>
                      </div>
                      {section === 'table' && <Check size={13} className="active-tick" />}
                    </button>
                  </div>

                  <div className="menu-separator" />

                  <div className="nav-menu-group">
                    <span className="nav-menu-heading">Library & History</span>
                    <button className={`nav-menu-item ${section === 'sources' ? 'is-active' : ''}`} onClick={() => { navigateTo('sources'); setNavMenuOpen(false); }}>
                      <FolderKanban size={15} />
                      <div className="nav-item-content">
                        <strong>Sources</strong>
                        <small>{nodes.filter(n => n.type === 'source' || n.type === 'link').length} references saved</small>
                      </div>
                      {section === 'sources' && <Check size={13} className="active-tick" />}
                    </button>
                    <button className={`nav-menu-item ${section === 'questions' ? 'is-active' : ''}`} onClick={() => { navigateTo('questions'); setNavMenuOpen(false); }}>
                      <CircleHelp size={15} />
                      <div className="nav-item-content">
                        <strong>Open Questions</strong>
                        <small>{nodes.filter(n => n.type === 'question').length} questions open</small>
                      </div>
                      {section === 'questions' && <Check size={13} className="active-tick" />}
                    </button>
                    <button className={`nav-menu-item ${section === 'history' ? 'is-active' : ''}`} onClick={() => { navigateTo('history'); setNavMenuOpen(false); }}>
                      <FileClock size={15} />
                      <div className="nav-item-content">
                        <strong>Research History</strong>
                        <small>{sessions.length} sessions recorded</small>
                      </div>
                      {pendingCount > 0 && <span className="nav-item-badge">{pendingCount} pending</span>}
                      {section === 'history' && <Check size={13} className="active-tick" />}
                    </button>
                    <button className={`nav-menu-item ${section === 'revisions' ? 'is-active' : ''}`} onClick={() => { navigateTo('revisions'); setNavMenuOpen(false); }}>
                      <History size={15} />
                      <div className="nav-item-content">
                        <strong>Revisions & Time-Travel</strong>
                        <small>Point-in-time snapshots & rollback</small>
                      </div>
                      {section === 'revisions' && <Check size={13} className="active-tick" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Center: Quick View Switcher Segmented Tabs */}
          <nav className="topbar-center-nav" aria-label="Quick view switcher">
            <button
              className={`topbar-view-tab ${section === 'canvas' ? 'is-active' : ''}`}
              title="Knowledge Graph"
              aria-label="Knowledge Graph"
              onClick={() => navigateTo('canvas')}
            >
              <Network size={13} />
              <span>Canvas</span>
            </button>
            <button
              className={`topbar-view-tab ${section === 'outline' ? 'is-active' : ''}`}
              title="Structured Outline"
              aria-label="Outline"
              onClick={() => navigateTo('outline')}
            >
              <BookOpenText size={13} />
              <span>Outline</span>
            </button>
            <button
              className={`topbar-view-tab ${section === 'evidence' ? 'is-active' : ''}`}
              title="Evidence Paths"
              aria-label="Evidence Paths"
              onClick={() => navigateTo('evidence')}
            >
              <Shapes size={13} />
              <span>Evidence</span>
            </button>
            <button
              className={`topbar-view-tab ${section === 'table' ? 'is-active' : ''}`}
              title="Claims & Questions"
              aria-label="Claims and Questions"
              onClick={() => navigateTo('table')}
            >
              <Files size={13} />
              <span>Table</span>
            </button>
          </nav>

          {/* Right: Add Record, Search, Save Beacon, History Undo/Redo, Export, Chat Assistant & Research */}
          <div className="topbar-actions">
            {/* + Add Record Menu */}
            <div className="menu-anchor topbar-add-anchor" ref={addRecordMenuRef}>
              <button
                className="topbar-add-btn"
                aria-label="Add record to graph"
                title="Add record (N)"
                aria-expanded={addRecordMenuOpen}
                onClick={() => {
                  setAddRecordMenuOpen(v => !v);
                  setNavMenuOpen(false);
                  setProjectMenuOpen(false);
                  setExportMenu(false);
                }}
              >
                <Plus size={14} />
                <span>Add</span>
                <ChevronDown size={11} className="add-chevron" />
              </button>
              {addRecordMenuOpen && (
                <div className="menu-popover topbar-add-menu" role="menu" aria-label="Add record types">
                  <div className="popover-heading">Create Record</div>
                  {addableRecords.map(({ type, label, description, icon: Icon, shortcut }) => (
                    <button
                      key={type}
                      className={`record-create-item type-${type}`}
                      role="menuitem"
                      title={`${label} (${shortcut})`}
                      onClick={() => {
                        addRecord(type);
                        setAddRecordMenuOpen(false);
                      }}
                    >
                      <span className="record-item-icon"><Icon size={14} /></span>
                      <div className="record-item-text">
                        <strong>{label}</strong>
                        <small>{description}</small>
                      </div>
                      <kbd className="record-shortcut-badge">{shortcut}</kbd>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              className="topbar-search-btn"
              title="Search knowledge (⌘K / Ctrl+K)"
              aria-label="Search knowledge"
              onClick={() => setModal('search')}
            >
              <Search size={13} />
              <span className="search-text">Search...</span>
              <kbd className="topbar-kbd">⌘K</kbd>
            </button>

            <span className={`save-indicator ${saveState}`} title={saveState === 'saving' ? 'Saving changes' : saveState === 'error' ? 'Save issue' : 'All changes saved locally'}>
              <i />
              <span className="save-label">{saveState === 'saving' ? 'Saving' : saveState === 'error' ? 'Issue' : 'Saved'}</span>
            </span>

            <div className="topbar-divider" />

            <button className="icon-button history-action" title="Undo (⌘Z / Ctrl+Z)" aria-label="Undo" disabled={!undoReady} onClick={undo}>
              <Undo2 size={15} />
            </button>
            <button className="icon-button history-action" title="Redo (⌘Shift+Z / Ctrl+Y)" aria-label="Redo" disabled={!redoReady} onClick={redo}>
              <Redo2 size={15} />
            </button>
            <button
              className={`icon-button history-action ${section === 'revisions' ? 'is-active' : ''}`}
              title="Persistent Revisions & Time-Travel (H)"
              aria-label="Revisions and Time-Travel"
              onClick={() => navigateTo('revisions')}
            >
              <History size={15} />
            </button>

            <div className="menu-anchor" ref={exportMenuRef}>
              <button
                className="quiet-button export-trigger"
                aria-label="Export or import knowledge graph"
                aria-expanded={exportMenu}
                onClick={() => { setExportMenu(v => !v); setNavMenuOpen(false); setProjectMenuOpen(false); setAddRecordMenuOpen(false); }}
              >
                <ArrowDownToLine size={14} />
                <span>Export</span>
                <ChevronDown size={12} />
              </button>
              {exportMenu && (
                <div className="menu-popover export-menu">
                  <button onClick={() => exportAs('json')}><FileJson2 size={15} /><span>Graph JSON</span><small>Full editable graph</small></button>
                  <button onClick={() => exportAs('markdown')}><FileText size={15} /><span>Context Markdown</span><small>Readable research brief</small></button>
                  <button onClick={() => exportAs('mermaid')}><GitBranch size={15} /><span>Mermaid diagram</span><small>Text-based graph</small></button>
                  <button onClick={exportObsidianVault}><FolderArchive size={15} /><span>Obsidian Vault</span><small>.zip with [[wikilinks]] & canvas</small></button>
                  <button onClick={exportPngCanvas}><ImageIcon size={15} /><span>PNG Image</span><small>High-DPI publication image</small></button>
                  <button onClick={exportSvgCanvas}><Shapes size={15} /><span>Vector SVG</span><small>Scalable standalone vector</small></button>
                  <div className="menu-separator" />
                  <button onClick={() => fileRef.current?.click()}><Upload size={15} /><span>Import graph</span><small>JSON export</small></button>
                  <button onClick={() => bibRef.current?.click()}><BookOpenText size={15} /><span>Import BibTeX</span><small>.bib academic papers</small></button>
                </div>
              )}
            </div>

            <button
              className={`quiet-button topbar-chat-btn ${rightDrawerOpen && drawerTab === 'chat' ? 'is-active' : ''}`}
              title="Ask this knowledge graph (? / Shift+A)"
              aria-label="Ask this knowledge graph"
              onClick={() => {
                if (rightDrawerOpen && drawerTab === 'chat') {
                  setRightDrawerOpen(false);
                } else {
                  setDrawerTab('chat');
                  setRightDrawerOpen(true);
                }
              }}
            >
              <MessageCircle size={14} />
              <span>Ask AI</span>
            </button>

            <button className="primary-button top-research" title="Run web research (R)" onClick={() => setModal('research')}>
              <Sparkles size={14} />
              <span>Research</span>
            </button>

            <button className="icon-button mobile-menu" aria-label="Search knowledge" onClick={() => setModal('search')}>
              <Search size={16} />
            </button>
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={handleImport} />
          <input ref={bibRef} type="file" accept=".bib,.txt" hidden onChange={handleBibImport} />
        </header>

        {section !== 'canvas' && (
          <section className="page-heading">
            <div className="heading-copy">
              <span className="heading-icon">
                {section === 'table' ? <Files size={17} /> : section === 'history' ? <FileClock size={17} /> : section === 'revisions' ? <History size={17} /> : section === 'evidence' ? <Shapes size={17} /> : section === 'sources' ? <FolderKanban size={17} /> : section === 'questions' ? <CircleHelp size={17} /> : <BookOpenText size={17} />}
              </span>
              <div>
                <h1>{section === 'table' ? 'Claims & questions' : section === 'history' ? 'Research history' : section === 'revisions' ? 'Persistent revisions & time-travel' : section === 'evidence' ? 'Evidence paths' : section === 'sources' ? 'Sources' : section === 'questions' ? 'Open questions' : 'Outline'}</h1>
                <p>{plural(nodes.length, 'record')} <span>·</span> {plural(edges.length, 'relationship')} <span>·</span> {plural(nodes.filter(node => node.type === 'source' || node.type === 'link').length, 'source')}</p>
              </div>
            </div>
            <div className="heading-actions">
              <button
                className={`quiet-button assistant-trigger ${rightDrawerOpen && drawerTab === 'chat' ? 'is-active' : ''}`}
                aria-expanded={rightDrawerOpen && drawerTab === 'chat'}
                onClick={() => {
                  if (rightDrawerOpen && drawerTab === 'chat') setRightDrawerOpen(false);
                  else { setDrawerTab('chat'); setRightDrawerOpen(true); }
                }}
              >
                <MessageCircle size={15} /> Ask this graph
              </button>
            </div>
          </section>
        )}

        <section className={`workspace-stage ${section === 'canvas' ? 'stage-canvas' : 'stage-view'}`}>
          {section === 'canvas' ? <>
            <div className="canvas-and-inspector">
              <div className="graph-wrap">
                {loading ? <div className="canvas-loading"><LoaderCircle size={21} className="spin" />Opening research sheet…</div> : nodes.length === 0 ? <div className="canvas-empty"><span className="empty-orbit"><Network size={24} /></span><h2>Your research sheet is ready</h2><p>Add a first idea or run grounded research to build a map of what you know.</p><div><button className="primary-button" onClick={() => setModal('research')}><Sparkles size={15} /> Start with research</button><button className="quiet-button" onClick={() => addRecord('note')}><Plus size={15} /> Add a note & idea</button></div></div> : <GraphCanvas
                  graph={graph} selectedNodeIds={selectedIds} viewport={viewport} setViewport={setViewport} activeTool={tool} spacePressed={spacePressed}
                  linkingFromId={linkingFromId} autoFitKey={canvasFitKey} editingNoteId={editingNoteId}
                  onSelectNode={(id, additive) => {
                    setSelectedIds(current => additive ? current.includes(id) ? current.filter(value => value !== id) : [...current, id] : [id]);
                    setDrawerTab('inspector');
                    setRightDrawerOpen(true);
                  }}
                  onSelectMultipleNodes={selectMultipleNodes}
                  onDeleteNodes={deleteNodes}
                  onClearSelection={() => setSelectedIds([])} onClickAway={() => setEditingNoteId(null)} onCancelLinking={() => setLinkingFromId(null)} onMoveNodes={moveNodes} onConnect={connectNodes}
                  onStartLinking={setLinkingFromId} onToggleGroup={toggleGroup} onEditNote={setEditingNoteId}
                  onUpdateNote={(id, content) => updateGraph(current => updateNode(current, id, { content }), false)}
                  onUpdateRelationship={editRelationship} onDeleteRelationship={deleteRelationship} onResizeGroup={resizeGroup} onOpenGroup={id => { setEditingNoteId(null); setGroupCanvasId(id); }}
                  onAddRecordWithData={addRecord}
                  projectId={projectId}
                />}
              </div>

              <aside className={`workspace-drawer ${rightDrawerOpen ? 'is-open' : ''}`} aria-label="Workspace tools and details">
                <div className="drawer-header">
                  <div className="drawer-tabs">
                    <button
                      className={`drawer-tab ${drawerTab === 'inspector' ? 'active' : ''}`}
                      onClick={() => setDrawerTab('inspector')}
                      title="Inspect and edit properties"
                    >
                      <SlidersHorizontal size={13} />
                      <span>Properties</span>
                      {selectedIds.length > 0 && <span className="tab-badge">{selectedIds.length}</span>}
                    </button>
                    <button
                      className={`drawer-tab ${drawerTab === 'chat' ? 'active' : ''}`}
                      onClick={() => setDrawerTab('chat')}
                      title="Ask AI assistant"
                    >
                      <Sparkles size={13} />
                      <span>Ask AI</span>
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
                      <div className="drawer-multi-select">
                        <div className="multi-select-icon"><Layers2 size={26} /></div>
                        <h3>{plural(selectedIds.length, 'record')} selected</h3>
                        <p>Drag any of the selected records to move them together across the canvas.</p>

                        <div className="inspector-color-section" style={{ width: '100%', boxSizing: 'border-box', marginTop: 12 }}>
                          <div className="inspector-color-head">
                            <label className="field-label" style={{ margin: 0 }}>Color accent for selection</label>
                            <button
                              type="button"
                              className="color-reset-btn"
                              onClick={() => {
                                updateGraph(current => selectedIds.reduce((g, id) => updateNode(g, id, { color: undefined }), current), false);
                              }}
                              title="Reset all selected to default color"
                            >
                              Reset
                            </button>
                          </div>
                          <div className="inspector-palette-grid">
                            {ELEMENT_PALETTE.map(hex => (
                              <button
                                key={hex}
                                type="button"
                                className="palette-swatch"
                                style={{ backgroundColor: hex }}
                                onClick={() => {
                                  updateGraph(current => selectedIds.reduce((g, id) => updateNode(g, id, { color: hex }), current), false);
                                }}
                                title={`Set ${hex} for all selected`}
                              />
                            ))}
                          </div>
                        </div>

                        <button
                          className="danger-button"
                          title="Delete selection (Delete / Backspace)"
                          onClick={() => {
                            deleteSelected();
                            setRightDrawerOpen(false);
                          }}
                        >
                          <Trash2 size={14} /> Delete selection
                        </button>
                      </div>
                    ) : (
                      <div className="drawer-empty-state">
                        <div className="empty-state-icon"><Layers2 size={24} /></div>
                        <h3>No record selected</h3>
                        <p>Click any card, cluster, or connection on the canvas to inspect and edit details.</p>
                        <div className="empty-quick-actions">
                          <button className="quiet-button" onClick={() => addRecord('concept')}><Plus size={13} /> Add Concept</button>
                          <button className="quiet-button" onClick={() => addRecord('claim')}><Plus size={13} /> Add Claim</button>
                          <button className="quiet-button" onClick={() => setDrawerTab('chat')}><Sparkles size={13} /> Ask AI</button>
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="drawer-chat-pane">
                      <div className="chat-intro-card">
                        <span className="chat-sparkle-pill"><Sparkles size={12} /> Graph assistant</span>
                        <p>Answers use records in this workspace{selectedNode ? ` with focus on "${selectedNode.title}"` : ''}.</p>
                      </div>
                      {!aiConfigured && (
                        <div className="configuration-note"><CircleHelp size={14} /> Add <code>GEMINI_API_KEY</code> to enable answers.</div>
                      )}
                      <div className="chat-transcript" aria-live="polite">
                        {chatLines.length === 0 && (
                          <div className="chat-welcome">
                            <span className="chat-sparkle"><Sparkles size={16} /></span>
                            <strong>{selectedNode ? `Ask about "${selectedNode.title}"` : 'Start from what’s already here'}</strong>
                            <p>{selectedNode ? 'Explore supporting evidence, connections, or critique this record.' : 'Ask how ideas connect, what evidence is missing, or what question to explore next.'}</p>
                            <div className="suggestion-chips">
                              {(selectedNode ? [
                                'What evidence supports this?',
                                'How does this connect to other ideas?',
                                'What are potential counterarguments?'
                              ] : [
                                'What remains unverified?',
                                'Summarize the main ideas',
                                'Find open questions'
                              ]).map(text => (
                                <button key={text} onClick={() => setChatInput(text)}>{text}</button>
                              ))}
                            </div>
                          </div>
                        )}
                        {chatLines.map((line, index) => (
                          <div className={`chat-line ${line.role}`} key={`${index}-${line.text.slice(0, 10)}`}>
                            <span>{line.role === 'assistant' ? <Sparkles size={13} /> : 'You'}</span>
                            <p>
                              {line.text}
                              {line.referencedNodeIds?.length ? (
                                <small className="answer-citations">
                                  Records: {line.referencedNodeIds.map(id => graph.nodesById[id]?.title || id).join(' · ')}
                                </small>
                              ) : null}
                            </p>
                          </div>
                        ))}
                        {chatBusy && (
                          <div className="chat-line assistant">
                            <span><Sparkles size={13} /></span>
                            <p><LoaderCircle size={14} className="spin" /> Looking through the graph…</p>
                          </div>
                        )}
                      </div>
                      <form className="chat-compose" onSubmit={sendQuestion}>
                        <input
                          aria-label="Ask a question about this graph"
                          placeholder={selectedNode ? `Ask about "${selectedNode.title.slice(0, 24)}"…` : 'Ask about this graph…'}
                          value={chatInput}
                          onChange={event => setChatInput(event.target.value)}
                          maxLength={2000}
                          disabled={!aiConfigured || chatBusy}
                        />
                        <button className="primary-button" disabled={!chatInput.trim() || !aiConfigured || chatBusy} aria-label="Send question">
                          <Send size={14} />
                        </button>
                      </form>
                      <div className="chat-footnote">AI responses are suggestions; verify claims against original sources.</div>
                    </div>
                  )}
                </div>
              </aside>
            </div>
            <div className="canvas-footer"><span><i className="legend-dot idea" /> Ideas <i className="legend-dot claim" /> Claims <i className="legend-dot source" /> Sources <i className="legend-line" /> Relationships</span><span>{plural(nodes.length, 'record')} · {plural(edges.length, 'relationship')} · {viewport.zoom.toFixed(2)}×</span></div>
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
          <section className="group-canvas-modal" role="dialog" aria-modal="true" aria-label={`${group.title} sub-canvas`}>
            <header className="group-canvas-header"><div><div className="group-breadcrumb"><span>Workspace</span><span>/</span><strong>{group.title}</strong></div><p>{plural(members.length, 'record')} in this knowledge cluster</p></div><button className="icon-button" aria-label="Close sub-canvas" onClick={() => setGroupCanvasId(null)}><X size={17} /></button></header>
            {members.length ? <GraphCanvas graph={containedGraph} selectedNodeIds={selectedIds.filter(id => memberIds.has(id))} viewport={groupViewport} setViewport={setGroupViewport} activeTool={tool} spacePressed={spacePressed} linkingFromId={linkingFromId} autoFitKey={canvasFitKey + 1} editingNoteId={editingNoteId}
              onSelectNode={(id, additive) => setSelectedIds(current => additive ? current.includes(id) ? current.filter(value => value !== id) : [...current, id] : [id])} onClearSelection={() => setSelectedIds([])} onClickAway={() => setEditingNoteId(null)} onCancelLinking={() => setLinkingFromId(null)} onMoveNodes={moveNodes} onConnect={connectNodes} onStartLinking={setLinkingFromId} onToggleGroup={toggleGroup} onEditNote={setEditingNoteId} onUpdateNote={(id, content) => updateGraph(current => updateNode(current, id, { content }), false)} onUpdateRelationship={editRelationship} onDeleteRelationship={deleteRelationship} onResizeGroup={resizeGroup} onOpenGroup={id => { setEditingNoteId(null); setGroupCanvasId(id); }} onAddRecordWithData={addRecord} /> : <div className="subcanvas-empty"><Layers2 size={22} /><p>This cluster has no member records yet.</p><button className="quiet-button" onClick={() => { addRecord('note'); setGroupCanvasId(null); }}>Add a note & idea</button></div>}
          </section>
        </div>;
      })()}

      {modal === 'research' && <div className="modal-scrim" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setModal(null); }}>
        <section className="work-modal research-modal" role="dialog" aria-modal="true" aria-labelledby="research-title">
          <div className="modal-head"><span className="modal-icon"><Sparkles size={18} /></span><button className="icon-button" aria-label="Close research" onClick={() => setModal(null)}><X size={17} /></button></div>
          <span className="panel-overline">Grounded research</span><h2 id="research-title">Extend the knowledge sheet</h2>
          <p className="modal-intro">Explore a question against the web and this graph. New ideas and sources stay in review until you accept them.</p>
          <form onSubmit={runResearch}>
            <label className="field-label" htmlFor="research-question">What are you trying to understand?</label>
            <textarea id="research-question" className="field-input research-input" value={researchQuery} onChange={event => setResearchQuery(event.target.value)} maxLength={500} placeholder="e.g. How do retrieval methods affect answer quality?" autoFocus />
            <div className="research-mode-row"><span>Research depth</span><div className="segmented-control"><button type="button" className={researchMode === 'quick' ? 'selected' : ''} onClick={() => setResearchMode('quick')}>Quick <small>5 proposals</small></button><button type="button" className={researchMode === 'deep' ? 'selected' : ''} onClick={() => setResearchMode('deep')}>Deep <small>12 proposals</small></button></div></div>
            {!aiConfigured && <div className="configuration-note"><CircleHelp size={15} /> Add <code>GEMINI_API_KEY</code> to the server environment to enable web research.</div>}
            <div className="modal-footer"><span><i className="ai-status-dot ready" /> Proposals require your review</span><button className="primary-button" disabled={researching || !researchQuery.trim() || !aiConfigured}>{researching ? <><LoaderCircle size={15} className="spin" /> Researching…</> : <><Sparkles size={15} /> Run research <ArrowRight size={14} /></>}</button></div>
          </form>
        </section>
      </div>}


      {modal === 'project' && <div className="modal-scrim" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setModal(null); }}>
        <section className="work-modal project-modal" role="dialog" aria-modal="true" aria-labelledby="project-title">
          <div className="modal-head"><span className="modal-icon"><Layers2 size={18} /></span><button className="icon-button" aria-label="Close new workspace" onClick={() => setModal(null)}><X size={17} /></button></div>
          <span className="panel-overline">Workspaces</span><h2 id="project-title">Choose a research sheet</h2><p className="modal-intro">Each workspace keeps its graph and research history separate.</p>
          <div className="project-picker"><span className="field-label">Your workspaces</span>{projects.map(item => <button key={item.id} className={`project-pick-button ${item.id === projectId ? 'current' : ''}`} onClick={() => { setProjectId(item.id); setModal(null); }}><span>{item.title}</span>{item.id === projectId && <Check size={14} />}</button>)}</div>
          <div className="project-form-divider"><span>Or create a new one</span></div>
          <form onSubmit={createProject}>
            <label className="field-label" htmlFor="project-name">Workspace name</label><input className="field-input" id="project-name" autoFocus value={projectTitleDraft} onChange={event => setProjectTitleDraft(event.target.value)} maxLength={80} minLength={2} placeholder="e.g. Small language models" required />
            <span className="field-label">Start with</span><CustomSelect className="field-input project-template-select" ariaLabel="Start with" value={projectTemplate} options={[{ value: 'rag', label: 'A sample knowledge sheet' }, { value: 'blank', label: 'An empty sheet' }]} onChange={value => setProjectTemplate(value as 'blank' | 'rag')} />
            <div className="modal-footer"><span>Stored in this local workspace</span><button className="primary-button" disabled={creatingProject || projectTitleDraft.trim().length < 2}>{creatingProject ? <><LoaderCircle size={15} className="spin" /> Creating…</> : <><Plus size={15} /> Create workspace</>}</button></div>
          </form>
        </section>
      </div>}

      {modal === 'search' && <div className="modal-scrim search-scrim" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setModal(null); }}>
        <section className="search-modal" role="dialog" aria-modal="true" aria-label="Search knowledge">
          <div className="search-input-row"><Search size={18} /><input autoFocus placeholder="Search records in this workspace…" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} /><kbd>ESC</kbd><button className="icon-button" aria-label="Close search" onClick={() => setModal(null)}><X size={16} /></button></div>
          <div className="search-results">{searchQuery.trim() ? searchResults.length ? searchResults.map(node => <button className="search-result" key={node.id} onClick={() => { setSelectedIds([node.id]); setSection('canvas'); setModal(null); setSearchQuery(''); }}><span className={`record-icon type-${node.type}`}><Search size={14} /></span><span><strong>{node.title}</strong><small>{node.type} · {(node.content || node.url || 'No notes').slice(0, 100)}</small></span><ArrowRight size={15} /></button>) : <div className="search-empty">No records match “{searchQuery}”.</div> : <div className="search-empty">Search titles, notes, sources, and record types.</div>}</div>
          <div className="search-bottom"><span><Search size={13} /> {plural(nodes.length, 'record')} indexed in this workspace</span><span>Press <kbd>Ctrl/⌘ K</kbd> to search</span></div>
        </section>
      </div>}

      {activeSession && <div className="modal-scrim" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) closeSession(); }}>
        <section className="work-modal review-modal" role="dialog" aria-modal="true" aria-labelledby="review-title">
          <div className="modal-head"><span className="modal-icon"><Clock3 size={18} /></span><button className="icon-button" aria-label="Close review" onClick={closeSession}><X size={17} /></button></div>
          <span className="panel-overline">{activeSession.mode === 'deep' ? 'Deep research' : 'Quick research'} · {new Date(activeSession.createdAt).toLocaleDateString()}</span>
          <h2 id="review-title">{activeSession.query}</h2>
          <p className="review-summary">{activeSession.summary}</p>
          <details className="research-trail"><summary>Research trail <ChevronDown size={14} /></summary><ul>{activeSession.trail.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></details>
          <div className="review-list-heading"><strong>Proposed changes</strong><span>{plural(activeSession.changes.filter(change => change.status === 'pending').length, 'pending review')}</span></div>
          <div className="review-changes">{activeSession.changes.length === 0 ? <div className="empty-review">No graph changes were proposed for this run.</div> : activeSession.changes.map(change => <ReviewChangeCard key={change.id} change={change} graph={graph} sessionChanges={activeSession.changes} decision={reviewDecisions[change.id]} onDecision={status => setReviewDecisions(current => ({ ...current, [change.id]: status }))} />)}</div>
          <div className="modal-footer review-footer"><button className="quiet-button" disabled={!activeSession.changes.some(change => change.status === 'pending')} onClick={() => setReviewDecisions(Object.fromEntries(activeSession.changes.filter(change => change.status === 'pending').map(change => [change.id, 'accepted'] as const)))}>Accept all pending</button><button className="primary-button" disabled={!Object.keys(reviewDecisions).length} onClick={() => saveReview(activeSession, Object.entries(reviewDecisions).map(([changeId, status]) => ({ changeId, status })))}><Check size={15} /> Save review</button></div>
        </section>
      </div>}

      {notice && (
        <div role="status" className="toast-note">
          <CircleHelp size={15} className="toast-icon" />
          <span>{notice}</span>
          <button className="toast-close" onClick={() => setNotice('')} aria-label="Dismiss notification">
            <X size={13} />
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
  const title = node?.title || `${nodeTitle(edge?.from || '') || 'Record'} ${edge?.label || 'relates to'} ${nodeTitle(edge?.to || '') || 'record'}`;
  const subtitle = node ? `${node.type.replaceAll('_', ' ')}${node.type === 'claim' ? ' · unverified' : ''}` : 'Relationship';
  return <article className={`review-change ${decision ? `decision-${decision}` : ''}`}>
    <span className="change-kind-icon">{isNode ? <Layers2 size={15} /> : <GitBranch size={15} />}</span>
    <div className="change-copy"><span>{subtitle}</span><strong>{title}</strong>{change.rationale && <small>{change.rationale}</small>}{node?.url && <a href={node.url} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()}>{node.url}</a>}</div>
    {change.status === 'pending' ? <div className="review-actions"><button className={decision === 'accepted' ? 'chosen accept' : ''} aria-label="Accept proposal" title="Accept" onClick={() => onDecision('accepted')}><Check size={14} /></button><button className={decision === 'rejected' ? 'chosen reject' : ''} aria-label="Reject proposal" title="Reject" onClick={() => onDecision('rejected')}><X size={14} /></button></div> : <span className={`review-status ${change.status}`}>{change.status === 'accepted' ? 'Added' : 'Rejected'}</span>}
  </article>;
}
