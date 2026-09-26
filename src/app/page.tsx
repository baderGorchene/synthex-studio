'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ArrowDownToLine, ArrowRight, Check, ChevronDown, CircleHelp, Clock3,
  FileJson2, FileText, GitBranch, Layers2, LoaderCircle, MessageCircle, Network, Plus, Redo2,
  Search, Send, Sparkles, Undo2, Upload, X
} from 'lucide-react';
import { GraphCanvas } from '@/components/research/GraphCanvas';
import { KnowledgeViews } from '@/components/research/KnowledgeViews';
import { NodeInspector } from '@/components/research/NodeInspector';
import { CustomSelect } from '@/components/research/CustomSelect';
import { WorkspaceSidebar, type ResearchProject, type WorkspaceSection } from '@/components/research/WorkspaceSidebar';
import { addNode, addRelationship, exportContextMarkdown, exportGraphJson, exportMermaid, normalizeGraph, removeNode, updateNode, updateRelationship, type KnowledgeGraph } from '@/lib/graph';
import type { CanvasNode, CanvasNodeType, Connection, Coordinates, ResearchChange, ResearchSession } from '@/types/canvas';

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
  const [exportMenu, setExportMenu] = useState(false);
  const [addMenu, setAddMenu] = useState(false);
  const [notice, setNotice] = useState('');
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
    setGraph(current => {
      const next = change(current);
      if (next !== current && recordUndo) {
        undoStack.current = [...undoStack.current.slice(-39), current];
        redoStack.current = [];
        setUndoReady(true);
        setRedoReady(false);
      }
      return next;
    });
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
      } catch (error) {
        setSaveState('error');
        announce(error instanceof Error ? error.message : 'Changes could not be saved.');
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [graph, projectId, loadedProject, loading, announce]);

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
      if (event.key === 'Escape') { setModal(null); setActiveSession(null); setLinkingFromId(null); setEditingNoteId(null); setGroupCanvasId(null); setTool('select'); }
      if (!typing && !target?.closest('button, a, [role="button"]') && event.key.toLowerCase() === 'c') { event.preventDefault(); setTool(value => value === 'connect' ? 'select' : 'connect'); setLinkingFromId(null); }
      if (!typing && !target?.closest('button, a, [role="button"]') && event.code === 'Space') { event.preventDefault(); setSpacePressed(true); }
    };
    const onKeyUp = (event: KeyboardEvent) => { if (event.code === 'Space') setSpacePressed(false); };
    const onBlur = () => setSpacePressed(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('blur', onBlur); };
  }, [undo, redo]);

  useEffect(() => {
    const onGlobalPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.closest('.menu-anchor')) { setExportMenu(false); setAddMenu(false); }
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

  const addRecord = useCallback((type: CanvasNodeType) => {
    const now = Date.now();
    const index = Object.keys(graphRef.current.nodesById).length;
    const labels: Record<string, string> = { concept: 'New concept', claim: 'New claim', question: 'New question', hypothesis: 'New hypothesis', source: 'New source', note: 'New note', group: 'New knowledge cluster', ai_insight: 'New insight' };
    const node: CanvasNode = {
      id: newId(), type, x: 260 + (index % 3) * 340, y: 170 + Math.floor(index / 3) * 230,
      width: type === 'group' ? 560 : type === 'question' ? 300 : 280, height: type === 'group' ? 360 : undefined,
      title: labels[type] || 'New knowledge', color: type === 'question' ? 'terracotta' : 'neutral', createdAt: now,
      metadata: { origin: 'user', ...(type === 'claim' ? { claimStatus: 'unverified' as const } : {}) }
    };
    try { updateGraph(current => addNode(current, node)); setSelectedIds([node.id]); setSection('canvas'); setAddMenu(false); }
    catch (error) { announce(error instanceof Error ? error.message : 'Could not add that record.'); }
  }, [announce, updateGraph]);

  const moveNodes = useCallback((positions: Record<string, Coordinates>) => {
    updateGraph(current => {
      let next = current;
      for (const [id, point] of Object.entries(positions)) next = updateNode(next, id, point);
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
    try {
      const edge: Connection = { id: newId(), from, to, label: 'related_to', color: 'neutral', arrowhead: 'end', lineStyle: 'curved', strokePattern: 'dashed', animated: true };
      updateGraph(current => addRelationship(current, edge));
      setLinkingFromId(null); setTool('select');
      announce('Relationship added. Select a record to add a more specific label.');
    } catch (error) { announce(error instanceof Error ? error.message : 'Could not connect those records.'); }
  }, [announce, updateGraph]);

  const toggleGroup = (id: string) => updateGraph(current => {
    const node = current.nodesById[id];
    return node ? updateNode(current, id, { metadata: { ...node.metadata, collapsed: !node.metadata?.collapsed } }) : current;
  }, false);

  const updateSelectedNode = (fields: Partial<CanvasNode>) => {
    if (!selectedNode) return;
    updateGraph(current => updateNode(current, selectedNode.id, fields), false);
  };

  const deleteSelected = () => {
    if (!selectedNode) return;
    updateGraph(current => removeNode(current, selectedNode.id));
    setSelectedIds([]);
    announce('Record deleted.');
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
        updateGraph(() => imported);
        setCanvasFitKey(value => value + 1);
        setSelectedIds([]); setSection('canvas'); setExportMenu(false);
        announce('Graph imported. Saving changes…');
      } catch { announce('That file is not a valid Synthex graph export.'); }
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

  function openSession(session: ResearchSession) { setActiveSession(session); setReviewDecisions({}); }
  function closeSession() { setActiveSession(null); setReviewDecisions({}); }

  return (
    <div className={`workspace-shell ${section === 'canvas' ? 'full-canvas-shell' : ''}`}>
      <WorkspaceSidebar
        projects={projects} projectId={projectId} section={section} aiConfigured={aiConfigured} pendingCount={pendingCount}
        floating={section === 'canvas'}
        activeTool={tool} onSelectTool={value => { setTool(value); setLinkingFromId(null); }}
        onFit={() => setCanvasFitKey(value => value + 1)}
        onSelectProject={setProjectId} onOpenProjects={() => setModal('project')} onNavigate={value => { setSection(value); setSelectedIds([]); setEditingNoteId(null); setLinkingFromId(null); setTool('select'); }}
        onSearch={() => setModal('search')}
      />

      <main className={`workspace-main ${section === 'canvas' ? 'canvas-main' : ''}`} id="workspace">
        <header className="workspace-topbar">
          <div className="topbar-breadcrumb"><span>Workspace</span><span className="breadcrumb-slash">/</span><strong>{project?.title || 'Research space'}</strong></div>
          <div className="topbar-actions">
            <span className={`save-indicator ${saveState}`}><i />{saveState === 'saving' ? 'Saving' : saveState === 'error' ? 'Save issue' : 'All changes saved'}</span>
            <div className="topbar-divider" />
            <button className="icon-button history-action" title="Undo" aria-label="Undo" disabled={!undoReady} onClick={undo}><Undo2 size={16} /></button>
            <button className="icon-button history-action" title="Redo" aria-label="Redo" disabled={!redoReady} onClick={redo}><Redo2 size={16} /></button>
            <div className="menu-anchor">
              <button className="quiet-button export-trigger" onClick={() => setExportMenu(value => !value)}><ArrowDownToLine size={15} /> Export <ChevronDown size={13} /></button>
              {exportMenu && <div className="menu-popover export-menu">
                <button onClick={() => exportAs('json')}><FileJson2 size={15} /><span>Graph JSON</span><small>Full editable graph</small></button>
                <button onClick={() => exportAs('markdown')}><FileText size={15} /><span>Context Markdown</span><small>Readable research brief</small></button>
                <button onClick={() => exportAs('mermaid')}><GitBranch size={15} /><span>Mermaid diagram</span><small>Text-based graph</small></button>
                <div className="menu-separator" /><button onClick={() => fileRef.current?.click()}><Upload size={15} /><span>Import graph</span><small>JSON export</small></button>
              </div>}
            </div>
            <button className="primary-button top-research" onClick={() => setModal('research')}><Sparkles size={15} /> Research</button>
            <button className="icon-button mobile-menu" aria-label="Search knowledge" onClick={() => setModal('search')}><Search size={17} /></button>
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={handleImport} />
        </header>

        <section className="page-heading">
          <div className="heading-copy">
            <span className="heading-icon"><Network size={17} /></span>
            <div><h1>{section === 'canvas' ? (project?.title || 'Knowledge graph') : section === 'table' ? 'Claims & questions' : section === 'history' ? 'Research history' : section === 'evidence' ? 'Evidence paths' : section === 'sources' ? 'Sources' : section === 'questions' ? 'Open questions' : 'Outline'}</h1>
              <p>{plural(nodes.length, 'record')} <span>·</span> {plural(edges.length, 'relationship')} <span>·</span> {plural(nodes.filter(node => node.type === 'source' || node.type === 'link').length, 'source')}</p></div>
          </div>
          <div className="heading-actions">
            <button className="quiet-button assistant-trigger" aria-expanded={modal === 'chat'} onClick={() => setModal(current => current === 'chat' ? null : 'chat')}><MessageCircle size={15} /> Ask this graph</button>
            <div className="menu-anchor">
              <button className="primary-button add-trigger" onClick={() => setAddMenu(value => !value)}><Plus size={16} /> Add record <ChevronDown size={13} /></button>
              {addMenu && <div className="menu-popover add-menu">
                {([['concept', 'Concept'], ['claim', 'Claim'], ['question', 'Question'], ['hypothesis', 'Hypothesis'], ['source', 'Source'], ['note', 'Note'], ['group', 'Knowledge cluster']] as Array<[CanvasNodeType, string]>).map(([type, label]) => <button key={type} onClick={() => addRecord(type)}><Plus size={14} /><span>{label}</span></button>)}
              </div>}
            </div>
          </div>
        </section>

        <section className={`workspace-stage ${section === 'canvas' ? 'stage-canvas' : 'stage-view'}`}>
          {section === 'canvas' ? <>
            <div className="canvas-and-inspector">
              <div className="graph-wrap">
                {loading ? <div className="canvas-loading"><LoaderCircle size={21} className="spin" />Opening research sheet…</div> : nodes.length === 0 ? <div className="canvas-empty"><span className="empty-orbit"><Network size={24} /></span><h2>Your research sheet is ready</h2><p>Add a first idea or run grounded research to build a map of what you know.</p><div><button className="primary-button" onClick={() => setModal('research')}><Sparkles size={15} /> Start with research</button><button className="quiet-button" onClick={() => addRecord('concept')}><Plus size={15} /> Add a concept</button></div></div> : <GraphCanvas
                  graph={graph} selectedNodeIds={selectedIds} viewport={viewport} setViewport={setViewport} activeTool={tool} spacePressed={spacePressed}
                  linkingFromId={linkingFromId} autoFitKey={canvasFitKey} editingNoteId={editingNoteId}
                  onSelectNode={(id, additive) => setSelectedIds(current => additive ? current.includes(id) ? current.filter(value => value !== id) : [...current, id] : [id])}
                  onClearSelection={() => setSelectedIds([])} onClickAway={() => setEditingNoteId(null)} onCancelLinking={() => setLinkingFromId(null)} onMoveNodes={moveNodes} onConnect={connectNodes}
                  onStartLinking={setLinkingFromId} onToggleGroup={toggleGroup} onEditNote={setEditingNoteId}
                  onUpdateNote={(id, content) => updateGraph(current => updateNode(current, id, { content }), false)}
                  onUpdateRelationship={editRelationship} onDeleteRelationship={deleteRelationship} onResizeGroup={resizeGroup} onOpenGroup={id => { setEditingNoteId(null); setGroupCanvasId(id); }}
                />}
              </div>
              {selectedNode && modal !== 'chat' && <NodeInspector floating={section === 'canvas'} node={selectedNode} relationshipCount={edges.filter(edge => edge.from === selectedNode.id || edge.to === selectedNode.id).length} onUpdate={updateSelectedNode} onDelete={deleteSelected} onClose={() => setSelectedIds([])} />}
              {selectedIds.length > 1 && <aside className="inspector-panel multi-inspector"><button className="icon-button" aria-label="Close selection" onClick={() => setSelectedIds([])}><X size={17} /></button><Layers2 size={22} /><h2>{plural(selectedIds.length, 'record')} selected</h2><p>Move them together by dragging one selected record.</p><button className="danger-button" onClick={() => { updateGraph(current => selectedIds.reduce(removeNode, current)); setSelectedIds([]); }}>Delete selection</button></aside>}
            </div>
            <div className="canvas-footer"><span><i className="legend-dot idea" /> Ideas <i className="legend-dot claim" /> Claims <i className="legend-dot source" /> Sources <i className="legend-line" /> Relationships</span><span>{plural(nodes.length, 'record')} · {plural(edges.length, 'relationship')} · {viewport.zoom.toFixed(2)}×</span></div>
          </> : <div className="views-stage">
            <KnowledgeViews section={section} nodes={nodes} edges={edges} sessions={sessions} onSelectNode={id => { setSelectedIds([id]); setSection('canvas'); }} onOpenSession={openSession} />
          </div>}
        </section>
      </main>

      {groupCanvasId && graph.nodesById[groupCanvasId] && (() => {
        const group = graph.nodesById[groupCanvasId];
        const members = nodes.filter(node => node.id !== group.id && node.type !== 'group' && node.type !== 'section' && (node.sectionId === group.id || (node.x >= group.x && node.y >= group.y && node.x < group.x + (group.width || 540) && node.y < group.y + (group.height || 360))));
        const memberIds = new Set(members.map(node => node.id));
        const containedGraph = normalizeGraph(members, edges.filter(edge => memberIds.has(edge.from) && memberIds.has(edge.to)));
        return <div className="group-canvas-scrim" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setGroupCanvasId(null); }}>
          <section className="group-canvas-modal" role="dialog" aria-modal="true" aria-label={`${group.title} sub-canvas`}>
            <header className="group-canvas-header"><div><div className="group-breadcrumb"><span>Workspace</span><span>/</span><strong>{group.title}</strong></div><p>{plural(members.length, 'record')} in this knowledge cluster</p></div><button className="icon-button" aria-label="Close sub-canvas" onClick={() => setGroupCanvasId(null)}><X size={17} /></button></header>
            {members.length ? <GraphCanvas graph={containedGraph} selectedNodeIds={selectedIds.filter(id => memberIds.has(id))} viewport={groupViewport} setViewport={setGroupViewport} activeTool={tool} spacePressed={spacePressed} linkingFromId={linkingFromId} autoFitKey={canvasFitKey + 1} editingNoteId={editingNoteId}
              onSelectNode={(id, additive) => setSelectedIds(current => additive ? current.includes(id) ? current.filter(value => value !== id) : [...current, id] : [id])} onClearSelection={() => setSelectedIds([])} onClickAway={() => setEditingNoteId(null)} onCancelLinking={() => setLinkingFromId(null)} onMoveNodes={moveNodes} onConnect={connectNodes} onStartLinking={setLinkingFromId} onToggleGroup={toggleGroup} onEditNote={setEditingNoteId} onUpdateNote={(id, content) => updateGraph(current => updateNode(current, id, { content }), false)} onUpdateRelationship={editRelationship} onDeleteRelationship={deleteRelationship} onResizeGroup={resizeGroup} onOpenGroup={id => { setEditingNoteId(null); setGroupCanvasId(id); }} /> : <div className="subcanvas-empty"><Layers2 size={22} /><p>This cluster has no member records yet.</p><button className="quiet-button" onClick={() => { addRecord('concept'); setGroupCanvasId(null); }}>Add a concept</button></div>}
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

      {modal === 'chat' && <aside className="inspector-panel floating-inspector floating-chat-sidebar" role="dialog" aria-label="Graph assistant">
          <div className="inspector-head"><div className="inspector-title"><span className="panel-overline">Graph assistant</span><h2>Ask this knowledge sheet</h2></div><button className="icon-button" aria-label="Close graph assistant" onClick={() => setModal(null)}><X size={17} /></button></div>
          <p className="modal-intro">Answers use the saved records and relationships in this workspace. Missing evidence is called out.</p>
          {!aiConfigured && <div className="configuration-note"><CircleHelp size={15} /> Add <code>GEMINI_API_KEY</code> to the server environment to enable answers.</div>}
          <div className="chat-transcript" aria-live="polite">
            {chatLines.length === 0 && <div className="chat-welcome"><span className="chat-sparkle"><Sparkles size={16} /></span><strong>Start from what’s already here</strong><p>Ask how ideas connect, what evidence is missing, or what question to explore next.</p><div className="suggestion-chips">{['What remains unverified?', 'Summarize the main ideas'].map(text => <button key={text} onClick={() => setChatInput(text)}>{text}</button>)}</div></div>}
            {chatLines.map((line, index) => <div className={`chat-line ${line.role}`} key={`${index}-${line.text.slice(0, 10)}`}><span>{line.role === 'assistant' ? <Sparkles size={14} /> : 'You'}</span><p>{line.text}{line.referencedNodeIds?.length ? <small className="answer-citations">Records: {line.referencedNodeIds.map(id => graph.nodesById[id]?.title || id).join(' · ')}</small> : null}</p></div>)}
            {chatBusy && <div className="chat-line assistant"><span><Sparkles size={14} /></span><p><LoaderCircle size={15} className="spin" /> Looking through the graph…</p></div>}
          </div>
          <form className="chat-compose" onSubmit={sendQuestion}><input aria-label="Ask a question about this graph" placeholder="Ask about this graph…" value={chatInput} onChange={event => setChatInput(event.target.value)} maxLength={2000} disabled={!aiConfigured || chatBusy} /><button className="primary-button" disabled={!chatInput.trim() || !aiConfigured || chatBusy} aria-label="Send question"><Send size={15} /></button></form>
          <div className="chat-footnote">AI responses are suggestions; verify claims against original sources.</div>
      </aside>}

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

      {notice && <div role="status" className="toast-note">{notice}</div>}
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
